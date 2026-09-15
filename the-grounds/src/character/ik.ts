/**
 * Cinemática inversa de dois ossos (perna e braço).
 *
 * É o que impede o pé de flutuar ou afundar em rampas, degraus e calçadas:
 * depois da animação procedural, o pé de apoio é reposicionado sobre a
 * superfície real e o joelho é recalculado para acompanhar.
 *
 * Implementação clássica em três etapas: corrige o ângulo da raiz e do meio
 * pela lei dos cossenos, aponta a cadeia para o alvo e, por fim, gira em torno
 * do eixo raiz→alvo para levar o joelho na direção do polo.
 */

import * as THREE from 'three'
import { clamp } from '../core/math'

const _rootPos = new THREE.Vector3()
const _midPos = new THREE.Vector3()
const _tipPos = new THREE.Vector3()
const _rootToMid = new THREE.Vector3()
const _rootToTip = new THREE.Vector3()
const _midToRoot = new THREE.Vector3()
const _midToTip = new THREE.Vector3()
const _rootToTarget = new THREE.Vector3()
const _axis = new THREE.Vector3()
const _poleDir = new THREE.Vector3()
const _projMid = new THREE.Vector3()
const _projPole = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _parentQ = new THREE.Quaternion()
const _invParentQ = new THREE.Quaternion()
const _target = new THREE.Vector3()
const _tmp = new THREE.Vector3()

/** Aplica uma rotação global a um osso, preservando a hierarquia. */
function rotateBoneWorld(bone: THREE.Object3D, worldRot: THREE.Quaternion): void {
  if (bone.parent) bone.parent.getWorldQuaternion(_parentQ)
  else _parentQ.identity()
  _invParentQ.copy(_parentQ).invert()
  // q_local' = inv(pai) · R · pai · q_local
  bone.quaternion.premultiply(_parentQ).premultiply(worldRot).premultiply(_invParentQ).normalize()
  bone.updateMatrixWorld(true)
}

function angleBetween(a: THREE.Vector3, b: THREE.Vector3): number {
  const d = clamp(a.dot(b) / Math.max(a.length() * b.length(), 1e-8), -1, 1)
  return Math.acos(d)
}

/**
 * Resolve a cadeia raiz→meio→ponta para alcançar `target` (espaço de mundo).
 * `poleHint` indica para onde o cotovelo/joelho deve apontar.
 * Devolve quanto do alcance foi usado (1 = esticado).
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

  // Alvo ponderado: interpola entre onde a ponta está e onde deveria ficar.
  _target.copy(target).sub(_tipPos).multiplyScalar(clamp(weight, 0, 1)).add(_tipPos)
  _rootToTarget.copy(_target).sub(_rootPos)
  const reach = _rootToTarget.length()
  if (reach < 1e-5) return 0
  const maxReach = (l1 + l2) * 0.999
  const minReach = Math.abs(l1 - l2) * 1.001 + 1e-4
  const d = clamp(reach, minReach, maxReach)
  if (d !== reach) _rootToTarget.setLength(d)

  // --- Eixo de dobra ------------------------------------------------------
  _rootToMid.copy(_midPos).sub(_rootPos)
  _rootToTip.copy(_tipPos).sub(_rootPos)
  _axis.crossVectors(_rootToMid, _rootToTip)
  if (_axis.lengthSq() < 1e-10) {
    // Cadeia esticada: usa o polo para definir o plano.
    _poleDir.copy(poleHint).sub(_rootPos)
    _axis.crossVectors(_rootToMid, _poleDir)
    if (_axis.lengthSq() < 1e-10) _axis.set(1, 0, 0).cross(_rootToMid)
    if (_axis.lengthSq() < 1e-10) _axis.set(0, 0, 1).cross(_rootToMid)
  }
  _axis.normalize()

  // --- Ângulos atuais e desejados (lei dos cossenos) ----------------------
  const aCur = angleBetween(_rootToMid, _rootToTip)
  _midToRoot.copy(_rootPos).sub(_midPos)
  _midToTip.copy(_tipPos).sub(_midPos)
  const bCur = angleBetween(_midToRoot, _midToTip)

  const aWanted = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1))
  const bWanted = Math.acos(clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1))

  _q.setFromAxisAngle(_axis, aWanted - aCur)
  rotateBoneWorld(root, _q)
  _q.setFromAxisAngle(_axis, bWanted - bCur)
  rotateBoneWorld(mid, _q)

  // --- Aponta a cadeia para o alvo ---------------------------------------
  tip.updateMatrixWorld(true)
  _tipPos.setFromMatrixPosition(tip.matrixWorld)
  _rootToTip.copy(_tipPos).sub(_rootPos)
  if (_rootToTip.lengthSq() > 1e-10) {
    _tmp.copy(_rootToTip).normalize()
    _q.setFromUnitVectors(_tmp, _target.copy(_rootToTarget).normalize())
    rotateBoneWorld(root, _q)
  }

  // --- Leva o joelho/cotovelo na direção do polo -------------------------
  mid.updateMatrixWorld(true)
  _midPos.setFromMatrixPosition(mid.matrixWorld)
  _rootToTarget.normalize()
  _projMid.copy(_midPos).sub(_rootPos)
  _projMid.addScaledVector(_rootToTarget, -_projMid.dot(_rootToTarget))
  _poleDir.copy(poleHint).sub(_rootPos)
  _projPole.copy(_poleDir)
  _projPole.addScaledVector(_rootToTarget, -_projPole.dot(_rootToTarget))
  if (_projMid.lengthSq() > 1e-8 && _projPole.lengthSq() > 1e-8) {
    _projMid.normalize()
    _projPole.normalize()
    let ang = angleBetween(_projMid, _projPole)
    _tmp.crossVectors(_projMid, _projPole)
    if (_tmp.dot(_rootToTarget) < 0) ang = -ang
    _q.setFromAxisAngle(_rootToTarget, ang)
    rotateBoneWorld(root, _q)
  }

  return clamp(reach / maxReach, 0, 1)
}

/** Orienta um osso para que seu eixo local aponte na direção dada. */
export function aimBone(
  bone: THREE.Object3D, localAxis: THREE.Vector3, worldDir: THREE.Vector3, weight = 1,
): void {
  if (weight <= 0.001) return
  bone.updateMatrixWorld(true)
  bone.getWorldQuaternion(_parentQ)
  _tmp.copy(localAxis).applyQuaternion(_parentQ).normalize()
  _q.setFromUnitVectors(_tmp, _target.copy(worldDir).normalize())
  if (weight < 1) _q.slerp(_invParentQ.identity(), 1 - weight)
  rotateBoneWorld(bone, _q)
}
