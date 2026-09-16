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
import { bibliotecaPersonagem } from '../assets/characterTextures'
import { tecidoDasPernas, tecidoDoTorso, tecidosPessoas } from '../assets/peopleTextures'

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

/**
 * Cria o conjunto de materiais de um personagem.
 *
 * As texturas trazem relevo e variação de rugosidade; a cor continua vindo do
 * editor, o que permite qualquer combinação sem gerar mapas novos.
 */
function makeMaterials(app: Appearance): CharacterMaterials {
  const lib = bibliotecaPersonagem()
  const tecidos = tecidosPessoas()

  const pele = new THREE.MeshPhysicalMaterial({
    color: app.pele,
    roughness: 1,
    metalness: 0,
    vertexColors: true,
    // Brilho aveludado aproxima a dispersão sob a pele sem custo de subsurface.
    sheen: 0.45,
    sheenRoughness: 0.72,
    sheenColor: new THREE.Color(app.pele).multiplyScalar(1.3),
    clearcoat: 0.10,
    clearcoatRoughness: 0.72,
  })
  // A repetição é alta de propósito: os poros precisam ser densos na escala
  // da malha, cuja UV vai de 0 a 1 por segmento do corpo.
  lib.aplicar(pele as unknown as THREE.MeshStandardMaterial, 'pele', 3, 4, 0.55)

  const roupa = new THREE.MeshStandardMaterial({ color: app.corTorso, roughness: 1, metalness: 0, vertexColors: true })
  lib.aplicar(roupa, 'tecido', 4, 5, 0.85)
  // Tecido fotográfico por cima da procedural: a peça nasce vestida com a
  // procedural e ganha a trama de verdade quando o download chega.
  tecidos.aplicar(roupa, tecidoDoTorso(app.torso), 4, 5, 0.9)

  const roupaBrilho = new THREE.MeshStandardMaterial({ color: app.corTorsoSec, roughness: 1, metalness: 0.04, vertexColors: true })
  lib.aplicar(roupaBrilho, 'tecido', 4, 5, 0.7)

  const cabelo = new THREE.MeshStandardMaterial({ color: app.corCabelo, roughness: 1, metalness: 0.03, vertexColors: true })
  lib.aplicar(cabelo, 'cabelo', 2, 2, 1.1)

  const olho = new THREE.MeshStandardMaterial({ color: 0xf6f4f0, roughness: 0.18, vertexColors: true })
  const iris = new THREE.MeshStandardMaterial({ color: app.corOlhos, roughness: 0.12, metalness: 0.06, vertexColors: true })

  const calcado = new THREE.MeshStandardMaterial({ color: app.corPes, roughness: 1, vertexColors: true })
  lib.aplicar(calcado, 'couro', 3, 3, 0.9)
  tecidos.aplicar(calcado, 'couro', 3, 3, 0.95)

  const acessorio = new THREE.MeshStandardMaterial({ color: app.corChapeu, roughness: 1, vertexColors: true })
  lib.aplicar(acessorio, 'tecido', 4, 4, 0.7)

  return { pele, roupa, roupaBrilho, cabelo, olho, iris, calcado, acessorio }
}

export interface CharacterOptions {
  castShadow?: boolean
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
  /** Recortes finos do rosto e da roupa, desligados à distância. */
  private detalhes: THREE.SkinnedMesh[] = []
  private detalheLigado = true
  private sombraLigada = true
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

    this.materials = makeMaterials(appearance)
    const parts = buildAppearanceParts(appearance)
    const lod = this.options.lod ?? 'alto'

    const add = (geo: THREE.BufferGeometry | null, mat: THREE.Material, name: string,
                 detalhe = false) => {
      if (!geo) return
      const m = new THREE.SkinnedMesh(geo, mat)
      m.name = name
      // Só o corpo projeta sombra: recortes de rosto, íris e sobrancelha
      // dobrariam o número de desenhos sem mudar nada na imagem.
      m.castShadow = (this.options.castShadow ?? true) && !detalhe
      m.receiveShadow = true
      // A pele deformada sai da caixa de repouso, então inflamos a esfera
      // limite em vez de desligar o descarte: assim o personagem fora da tela
      // não custa nada e mesmo assim nunca some em quadro.
      geo.computeBoundingSphere()
      const bs = geo.boundingSphere
      if (bs) { bs.center.set(0, shape.altura * 0.5, 0); bs.radius = Math.max(bs.radius * 1.35, shape.altura * 0.62) }
      m.frustumCulled = true
      // A raiz do esqueleto já está no grupo; a malha apenas se vincula a ele.
      m.bind(this.skeleton)
      this.group.add(m)
      this.meshes.push(m)
      if (detalhe) this.detalhes.push(m)
    }

    add(parts.pele, this.materials.pele, 'pele')
    add(parts.roupaTorso, this.materials.roupa, 'torso')
    const lib = bibliotecaPersonagem()
    const tecidosLib = tecidosPessoas()
    const matPernas = new THREE.MeshStandardMaterial({ color: appearance.corPernas, roughness: 1, vertexColors: true })
    lib.aplicar(matPernas, 'tecido', 4, 6, 0.85)
    tecidosLib.aplicar(matPernas, tecidoDasPernas(appearance.pernas), 4, 6, 0.9)
    add(parts.roupaPernas, matPernas, 'pernas')
    const matMeias = new THREE.MeshStandardMaterial({ color: appearance.corMeias, roughness: 1, vertexColors: true })
    lib.aplicar(matMeias, 'tecido', 3, 3, 0.8)
    tecidosLib.aplicar(matMeias, 'esportivo', 3, 3, 0.85)
    add(parts.meias, matMeias, 'meias')
    add(parts.calcados, this.materials.calcado, 'calcados')
    add(parts.cabelo, this.materials.cabelo, 'cabelo')
    const matBarba = new THREE.MeshStandardMaterial({ color: appearance.corBarba, roughness: 1, vertexColors: true })
    lib.aplicar(matBarba, 'cabelo', 3, 3, 0.9)
    add(parts.barba, matBarba, 'barba')
    if (lod !== 'baixo') {
      add(parts.rosto, this.materials.pele, 'rosto', true)
      add(parts.acessorios, this.materials.acessorio, 'acessorios', true)
      add(parts.detalheRoupa, this.materials.roupaBrilho, 'detalheRoupa', true)
      const face = buildFaceDetails(appearance, shape)
      add(face.esclera, this.materials.olho, 'olhos', true)
      const matSobr = new THREE.MeshStandardMaterial({ color: appearance.corCabelo, roughness: 1, vertexColors: true })
      lib.aplicar(matSobr, 'cabelo', 2, 2, 0.8)
      add(face.sobrancelhas, matSobr, 'sobrancelhas', true)
      add(face.iris, this.materials.iris, 'iris', true)
    }

    // Referências úteis
    this.hipRest = bones[BONE_INDEX['quadril']].position.y
    this.eyeY = eyeHeight(shape)
    this.height = shape.altura
    this.radius = clamp(0.26 * shape.corpo * Math.max(shape.ombros, shape.quadril), 0.22, 0.45)
    this.animator.reset()
  }

  /**
   * Liga ou desliga os recortes finos (rosto, íris, sobrancelha, acessórios) e
   * a projeção de sombra conforme a distância da câmera. São dezenas de
   * desenhos por personagem que ninguém enxerga a partir de poucos metros.
   */
  ajustarDetalhe(distancia: number): void {
    const mostrar = distancia < 14
    if (mostrar !== this.detalheLigado) {
      this.detalheLigado = mostrar
      for (const m of this.detalhes) m.visible = mostrar
    }
    const sombra = distancia < 28 && (this.options.castShadow ?? true)
    if (sombra !== this.sombraLigada) {
      this.sombraLigada = sombra
      for (const m of this.meshes) {
        if (!this.detalhes.includes(m)) m.castShadow = sombra
      }
    }
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
      // As texturas são compartilhadas pela biblioteca; só o material
      // (que é por personagem) é descartado aqui.
      const mat = m.material as THREE.Material | THREE.Material[]
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
      else mat.dispose()
      this.group.remove(m)
    }
    this.meshes = []
    this.detalhes = []
    this.detalheLigado = true
    this.sombraLigada = true
    if (this.bones[0]) this.group.remove(this.bones[0])
    this.skeleton?.dispose?.()
    if (full) this.group.clear()
  }
}
