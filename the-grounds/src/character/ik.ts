/**
 * Cinemática inversa de dois ossos (perna e braço).
 *
 * É o que impede o pé de flutuar ou afundar em rampas, degraus e calçadas:
 * depois da animação procedural, o pé de apoio é reposicionado sobre a
 * superfície real e o joelho é recalculado para acompanhar.
 */

import * as THREE from 'three'
import { clamp } from '../core/math'

const _rootPos = new THREE.Vector3()
const _midPos = new THREE.Vector3()
const _tipPos = new THREE.Vector3()
const _toTip = new THREE.Vector3()
const _toTarget = new THREE.Vector3()
const _toMid = new THREE.Vector3()
const _axis = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _parentQ = new THREE.Quaternion()
const _invParentQ = new THREE.Quaternion()
const _pole = new THREE.Vector3()
const _planeNormal = new THREE.Vector3()
const _tmp = new THREE.Vector3()

/** Aplica uma rotação global a um osso, preservando a hierarquia. */
function rotateBoneWorld(bone: THREE.Object3D, worldRot: THREE.Quaternion): void {
  bone.parent?.getWorldQuaternion(_parentQ)
  _invParentQ.copy(_parentQ).invert()
  // q_local_novo = inv(pai) * rot * pai * q_local
  bone.quaternion.premultiply(_parentQ).premultiply(worldRot).premultiply(_invParentQ)
  bone.updateMatrixWorld(true)
}

/**
 * Resolve a cadeia raiz→meio→ponta para alcançar `target` (espaço de mundo).
 * `poleHint` indica para onde o cotovelo/joelho deve apontar.
 * Devolve o quanto do alcance foi usado (1 = esticado).
 */
export function solveTwoBoneIK(
  root: THREE.Object3D,
  mid: THREE.Object3D,
  tip: THREE.Object3D,
  target: THREE.Vector3,
  poleHint: THREE.Vector3,
  weight = 1,
): number {
  if (weight <= 0.001) return 0
  root.updateMatrixWorld(true)

  _rootPos.setFromMatrixPosition(root.matrixWorld)
  _midPos.setFromMatrixPosition(mid.matrixWorld)
  _tipPos.setFromMatrixPosition(tip.matrixWorld)

  const l1 = _rootPos.distanceTo(_midPos)
  const l2 = _midPos.distanceTo(_tipPos)
  if (l1 < 1e-5 || l2 < 1e-5) return 0

  // Alvo com peso: interpola entre a ponta atual e o destino.
  _toTarget.copy(target).sub(_tipPos).multiplyScalar(weight).add(_tipPos)
  const desired = _tmp.copy(_toTarget).sub(_rootPos)
  const maxReach = (l1 + l2) * 0.999
  let dist = desired.length()
  if (dist < 1e-5) return 0
  const reachRatio = dist / maxReach
  if (dist > maxReach) { desired.multiplyScalar(maxReach / dist); dist = maxReach }

  // 1) Aponta a cadeia inteira para o alvo.
  _toTip.copy(_tipPos).sub(_rootPos).normalize()
  _toTarget.copy(desired).normalize()
  _q.setFromUnitVectors(_toTip, _toTarget)
  rotateBoneWorld(root, _q)

  // 2) Plano de dobra definido pelo polo (joelho para a frente).
  _rootPos.setFromMatrixPosition(root.matrixWorld)
  _midPos.setFromMatrixPosition(mid.matrixWorld)
  _pole.copy(poleHint).sub(_rootPos)
  _planeNormal.copy(desired).cross(_pole)
  if (_planeNormal.lengthSq() < 1e-8) {
    _planeNormal.set(1, 0, 0).cross(desired)
    if (_planeNormal.lengthSq() < 1e-8) _planeNormal.set(0, 0, 1).cross(desired)
  }
  _planeNormal.normalize()

  // Ângulo desejado na raiz (lei dos cossenos).
  const cosRoot = clamp((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), -1, 1)
  const angleRoot = Math.acos(cosRoot)

  // Ângulo atual entre (raiz→meio) e (raiz→alvo).
  _toMid.copy(_midPos).sub(_rootPos).normalize()
  _toTarget.copy(desired).normalize()
  const cosCurrent = clamp(_toMid.dot(_toTarget), -1, 1)
  const angleCurrent = Math.acos(cosCurrent)

  // Sinal: de que lado do plano o meio está hoje.
  _axis.copy(_toTarget).cross(_toMid)
  const sign = _axis.dot(_planeNormal) >= 0 ? 1 : -1
  const delta = angleRoot - angleCurrent * sign

  _q.setFromAxisAngle(_planeNormal, -delta * sign)
  rotateBoneWorld(root, _q)

  // 3) Alinha a ponta exatamente no alvo girando o osso do meio.
  mid.updateMatrixWorld(true)
  _midPos.setFromMatrixPosition(mid.matrixWorld)
  _tipPos.setFromMatrixPosition(tip.matrixWorld)
  _toTip.copy(_tipPos).sub(_midPos).normalize()
  _toTarget.copy(desired).add(_rootPos).sub(_midPos).normalize()
  _q.setFromUnitVectors(_toTip, _toTarget)
  rotateBoneWorld(mid, _q)

  return Math.min(1, reachRatio)
}

/** Orienta um osso para que seu eixo local aponte na direção dada. */
export function aimBone(
  bone: THREE.Object3D, localAxis: THREE.Vector3, worldDir: THREE.Vector3, weight = 1,
): void {
  if (weight <= 0.001) return
  bone.updateMatrixWorld(true)
  const worldQ = new THREE.Quaternion()
  bone.getWorldQuaternion(worldQ)
  const current = localAxis.clone().applyQuaternion(worldQ).normalize()
  const q = new THREE.Quaternion().setFromUnitVectors(current, worldDir.clone().normalize())
  if (weight < 1) q.slerp(new THREE.Quaternion(), 1 - weight)
  rotateBoneWorld(bone, q)
}
