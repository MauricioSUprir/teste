/**
 * Personagem completo: malha deformável montada a partir da aparência,
 * esqueleto, animação procedural e correção dos pés no terreno.
 *
 * A mesma classe serve ao jogador e aos habitantes da cidade — o que muda é
 * quem alimenta o `AnimInput` e o nível de detalhe da simulação.
 */

import * as THREE from 'three'
import { clamp, damp } from '../core/math'
import { Animator, defaultAnimInput, type AnimInput } from './animation'
import { solveTwoBoneIK } from './ik'
import {
  buildAppearanceParts, buildFaceDetails, type Appearance,
} from './appearance'
import {
  BONE_INDEX, buildSkeleton, clampBodyShape, eyeHeight, type BoneName,
} from './rig'

export interface CharacterMaterials {
  pele: THREE.MeshPhysicalMaterial
  roupa: THREE.MeshStandardMaterial
  roupaBrilho: THREE.MeshStandardMaterial
  cabelo: THREE.MeshStandardMaterial
  olho: THREE.MeshStandardMaterial
  iris: THREE.MeshStandardMaterial
  calcado: THREE.MeshStandardMaterial
  acessorio: THREE.MeshStandardMaterial
}

/** Cria o conjunto de materiais de um personagem a partir da aparência. */
function makeMaterials(app: Appearance, fabric?: THREE.Texture, fabricNormal?: THREE.Texture): CharacterMaterials {
  const pele = new THREE.MeshPhysicalMaterial({
    color: app.pele,
    roughness: 0.66,
    metalness: 0,
    sheen: 0.35,
    sheenRoughness: 0.75,
    sheenColor: new THREE.Color(app.pele).multiplyScalar(1.25),
    clearcoat: 0.06,
    clearcoatRoughness: 0.8,
  })
  const roupa = new THREE.MeshStandardMaterial({
    color: app.corTorso, roughness: 0.88, metalness: 0,
    map: fabric ?? null, normalMap: fabricNormal ?? null,
  })
  const roupaBrilho = new THREE.MeshStandardMaterial({
    color: app.corTorsoSec, roughness: 0.55, metalness: 0.05,
  })
  const cabelo = new THREE.MeshStandardMaterial({
    color: app.corCabelo, roughness: 0.52, metalness: 0.02,
  })
  const olho = new THREE.MeshStandardMaterial({ color: 0xf4f2ee, roughness: 0.22 })
  const iris = new THREE.MeshStandardMaterial({ color: app.corOlhos, roughness: 0.18, metalness: 0.05 })
  const calcado = new THREE.MeshStandardMaterial({ color: app.corPes, roughness: 0.62 })
  const acessorio = new THREE.MeshStandardMaterial({ color: app.corChapeu, roughness: 0.7 })
  return { pele, roupa, roupaBrilho, cabelo, olho, iris, calcado, acessorio }
}

export interface CharacterOptions {
  castShadow?: boolean
  /** Tecido compartilhado (textura) para as roupas. */
  fabric?: THREE.Texture
  fabricNormal?: THREE.Texture
  /** Simplifica: sem rosto detalhado nem acessórios pequenos. */
  lod?: 'alto' | 'medio' | 'baixo'
}

export class Character {
  readonly group = new THREE.Group()
  readonly input: AnimInput = defaultAnimInput()
  readonly animator = new Animator()

  private bones: THREE.Bone[] = []
  private skeleton!: THREE.Skeleton
  private meshes: THREE.SkinnedMesh[] = []
  private materials!: CharacterMaterials
  private appearance: Appearance
  private options: CharacterOptions
  private hipRest = 0
  /** Altura do olho acima da base, para primeira pessoa. */
  eyeY = 1.62
  /** Alturas dos pés no frame anterior, para suavizar a correção. */
  private footY: [number, number] = [0, 0]
  private footTarget = new THREE.Vector3()
  private poleTarget = new THREE.Vector3()
  private worldPos = new THREE.Vector3()
  private elapsed = 0
  /** Desliga a correção de pés (diagnóstico). */
  ikAtivo = true
  /** Escala de raio de colisão derivada do corpo. */
  radius = 0.32
  height = 1.78

  constructor(appearance: Appearance, options: CharacterOptions = {}) {
    this.appearance = appearance
    this.options = options
    this.rebuild(appearance)
  }

  /** Reconstrói a malha inteira (usado pelo editor de personagem). */
  rebuild(appearance: Appearance): void {
    this.dispose(false)
    this.appearance = appearance
    const shape = clampBodyShape(appearance.corpo)

    const { bones, skeleton, root } = buildSkeleton(shape)
    this.bones = bones
    this.skeleton = skeleton
    this.group.add(root)

    this.materials = makeMaterials(appearance, this.options.fabric, this.options.fabricNormal)
    const parts = buildAppearanceParts(appearance)
    const lod = this.options.lod ?? 'alto'

    const add = (geo: THREE.BufferGeometry | null, mat: THREE.Material, name: string) => {
      if (!geo) return
      const m = new THREE.SkinnedMesh(geo, mat)
      m.name = name
      m.castShadow = this.options.castShadow ?? true
      m.receiveShadow = true
      m.frustumCulled = false
      // A raiz do esqueleto já está no grupo; a malha apenas se vincula a ele.
      m.bind(this.skeleton)
      this.group.add(m)
      this.meshes.push(m)
    }

    add(parts.pele, this.materials.pele, 'pele')
    add(parts.roupaTorso, this.materials.roupa, 'torso')
    add(parts.roupaPernas, new THREE.MeshStandardMaterial({
      color: appearance.corPernas, roughness: 0.86,
      map: this.options.fabric ?? null, normalMap: this.options.fabricNormal ?? null,
    }), 'pernas')
    add(parts.meias, new THREE.MeshStandardMaterial({ color: appearance.corMeias, roughness: 0.92 }), 'meias')
    add(parts.calcados, this.materials.calcado, 'calcados')
    add(parts.cabelo, this.materials.cabelo, 'cabelo')
    add(parts.barba, new THREE.MeshStandardMaterial({ color: appearance.corBarba, roughness: 0.6 }), 'barba')
    if (lod !== 'baixo') {
      add(parts.rosto, this.materials.pele, 'rosto')
      add(parts.acessorios, this.materials.acessorio, 'acessorios')
      add(parts.detalheRoupa, this.materials.roupaBrilho, 'detalheRoupa')
      const face = buildFaceDetails(appearance, shape)
      add(face.sobrancelhas, new THREE.MeshStandardMaterial({ color: appearance.corCabelo, roughness: 0.72 }), 'sobrancelhas')
      add(face.iris, this.materials.iris, 'iris')
    }

    // Referências úteis
    this.hipRest = bones[BONE_INDEX['quadril']].position.y
    this.eyeY = eyeHeight(shape)
    this.height = shape.altura
    this.radius = clamp(0.26 * shape.corpo * Math.max(shape.ombros, shape.quadril), 0.22, 0.45)
    this.animator.reset()
  }

  get bonesRef(): THREE.Bone[] { return this.bones }
  get aparencia(): Appearance { return this.appearance }

  bone(name: BoneName): THREE.Bone { return this.bones[BONE_INDEX[name]] }

  /** Posição de mundo da mão direita (para segurar objetos). */
  handPosition(out = new THREE.Vector3()): THREE.Vector3 {
    return out.setFromMatrixPosition(this.bone('maoD').matrixWorld)
  }

  /** Posição de mundo de um pé. */
  footPosition(right: boolean, out = new THREE.Vector3()): THREE.Vector3 {
    return out.setFromMatrixPosition(this.bone(right ? 'peD' : 'peE').matrixWorld)
  }

  /**
   * Atualiza a animação. `groundAt` devolve a altura da superfície num ponto,
   * usada para assentar os pés.
   */
  update(dt: number, groundAt?: (x: number, z: number) => number): void {
    this.elapsed += dt
    this.animator.update(dt, this.input, this.bones, this.elapsed)

    // Oscilação do quadril acompanhando a passada
    const hip = this.bones[BONE_INDEX['quadril']]
    hip.position.y = this.hipRest + this.animator.hipOffset

    this.group.updateMatrixWorld(true)

    if (this.ikAtivo && groundAt && this.input.grounded && !this.input.sentado && !this.input.dirigindo) {
      this.applyFootIK(dt, groundAt)
    }
  }

  /** Assenta os pés na superfície e ajusta o quadril quando necessário. */
  private applyFootIK(dt: number, groundAt: (x: number, z: number) => number): void {
    this.group.getWorldPosition(this.worldPos)
    const baseY = this.worldPos.y
    const plant = this.animator.footPlant

    for (let i = 0; i < 2; i++) {
      const right = i === 1
      const foot = this.bone(right ? 'peD' : 'peE')
      const shin = this.bone(right ? 'canelaD' : 'canelaE')
      const thigh = this.bone(right ? 'coxaD' : 'coxaE')

      foot.updateMatrixWorld(true)
      this.footTarget.setFromMatrixPosition(foot.matrixWorld)

      const ground = groundAt(this.footTarget.x, this.footTarget.z)
      const ankleClearance = 0.085 * (this.height / 1.75)
      const desiredY = ground + ankleClearance

      // Só corrige quando o pé está (ou deveria estar) apoiado, e nunca
      // puxa o pé para baixo do que a animação já pede.
      const w = plant[i]
      if (w < 0.02) { this.footY[i] = damp(this.footY[i], this.footTarget.y, 12, dt); continue }

      const lift = Math.max(0, this.footTarget.y - baseY)
      const target = Math.max(desiredY, baseY + lift * 0.25)
      this.footY[i] = damp(this.footY[i] || target, target, 18, dt)

      // Não estica além do alcance da perna.
      const hipPos = new THREE.Vector3().setFromMatrixPosition(thigh.matrixWorld)
      const maxLen = hipPos.distanceTo(new THREE.Vector3().setFromMatrixPosition(shin.matrixWorld))
        + new THREE.Vector3().setFromMatrixPosition(shin.matrixWorld)
          .distanceTo(new THREE.Vector3().setFromMatrixPosition(foot.matrixWorld))
      this.footTarget.y = this.footY[i]
      if (hipPos.distanceTo(this.footTarget) > maxLen * 0.99) {
        this.footTarget.sub(hipPos).setLength(maxLen * 0.99).add(hipPos)
      }

      // Polo do joelho: à frente do personagem.
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.group.quaternion)
      this.poleTarget.copy(hipPos).addScaledVector(fwd, 1.2).setY(hipPos.y - 0.1)

      solveTwoBoneIK(thigh, shin, foot, this.footTarget, this.poleTarget, w * 0.85)
    }
  }

  setPosition(x: number, y: number, z: number): void {
    this.group.position.set(x, y, z)
  }

  setYaw(yaw: number): void {
    this.group.rotation.y = yaw
  }

  setVisible(v: boolean): void { this.group.visible = v }

  /** Troca só as cores (sem reconstruir a malha) — usado no editor. */
  updateColors(app: Appearance): void {
    this.appearance.pele = app.pele
    this.materials.pele.color.set(app.pele)
    this.materials.pele.sheenColor.set(new THREE.Color(app.pele).multiplyScalar(1.25))
    this.materials.roupa.color.set(app.corTorso)
    this.materials.roupaBrilho.color.set(app.corTorsoSec)
    this.materials.cabelo.color.set(app.corCabelo)
    this.materials.iris.color.set(app.corOlhos)
    this.materials.calcado.color.set(app.corPes)
    this.materials.acessorio.color.set(app.corChapeu)
    for (const m of this.meshes) {
      if (m.name === 'pernas') (m.material as THREE.MeshStandardMaterial).color.set(app.corPernas)
      if (m.name === 'meias') (m.material as THREE.MeshStandardMaterial).color.set(app.corMeias)
      if (m.name === 'barba') (m.material as THREE.MeshStandardMaterial).color.set(app.corBarba)
      if (m.name === 'sobrancelhas') (m.material as THREE.MeshStandardMaterial).color.set(app.corCabelo)
    }
  }

  /**
   * Diagnóstico: calcula a posição deformada de vértices ligados a um osso,
   * exatamente como o shader faz. Serve para verificar se uma parte do corpo
   * está sendo desenhada onde deveria.
   */
  diagnosticarOsso(nome: BoneName, amostras = 6): { min: THREE.Vector3; max: THREE.Vector3; n: number } | null {
    const mesh = this.meshes.find((m) => m.name === 'pele')
    if (!mesh) return null
    const geo = mesh.geometry
    const si = geo.attributes.skinIndex as THREE.BufferAttribute | undefined
    const sw = geo.attributes.skinWeight as THREE.BufferAttribute | undefined
    const pos = geo.attributes.position as THREE.BufferAttribute
    if (!si || !sw) return null

    const alvo = BONE_INDEX[nome]
    const min = new THREE.Vector3(Infinity, Infinity, Infinity)
    const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity)
    const v = new THREE.Vector3()
    let n = 0
    const passo = Math.max(1, Math.floor(pos.count / (amostras * 40)))
    for (let i = 0; i < pos.count; i += passo) {
      let liga = false
      for (let k = 0; k < 4; k++) {
        if (si.getComponent(i, k) === alvo && sw.getComponent(i, k) > 0.5) { liga = true; break }
      }
      if (!liga) continue
      v.fromBufferAttribute(pos, i)
      mesh.applyBoneTransform(i, v)
      mesh.localToWorld(v)
      min.min(v)
      max.max(v)
      n++
      if (n >= amostras * 40) break
    }
    return n > 0 ? { min, max, n } : null
  }

  dispose(full = true): void {
    for (const m of this.meshes) {
      m.geometry.dispose()
      const mat = m.material as THREE.Material | THREE.Material[]
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
      else mat.dispose()
      this.group.remove(m)
    }
    this.meshes = []
    if (this.bones[0]) this.group.remove(this.bones[0])
    this.skeleton?.dispose?.()
    if (full) this.group.clear()
  }
}
