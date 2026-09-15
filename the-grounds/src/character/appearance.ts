/**
 * Aparência do personagem: pele, rosto, cabelo, pelos faciais, roupas e
 * acessórios. Tudo é gerado sobre o mesmo esqueleto, de modo que qualquer
 * combinação acompanha as animações sem deformações.
 */

import * as THREE from 'three'
import { lerp, makeRng, pick, randRange } from '../core/math'
import { PALETTE } from '../world/materials'
import {
  buildBodyGeometry, BONE_INDEX, boneOffsetsFor, clampBodyShape,
  defaultBodyShape, defaultFaceShape, HEAD_CENTER_Y, HEAD_RADII,
  type BodyRegion, type BodyShape, type FaceShape,
} from './rig'

export type TorsoItem = 'camiseta' | 'camisa' | 'moletom' | 'jaqueta' | 'regata' | 'uniforme' | 'semCamisa'
export type LegsItem = 'calca' | 'bermuda' | 'calcaSocial' | 'shortEsportivo' | 'saia'
export type FeetItem = 'tenis' | 'chuteira' | 'sapato' | 'sandalia' | 'descalco'
export type HeadItem = 'nenhum' | 'bone' | 'boneTras' | 'gorro' | 'bandana'
export type EyewearItem = 'nenhum' | 'oculosSol' | 'oculosGrau'
export type BackItem = 'nenhum' | 'mochila'
export type WristItem = 'nenhum' | 'relogio' | 'pulseira'
export type HairStyle =
  | 'raspado' | 'curto' | 'medio' | 'longo' | 'cacheado' | 'blackPower'
  | 'coque' | 'moicano' | 'tranças' | 'careca'
export type BeardStyle = 'nenhum' | 'cavanhaque' | 'barbaCurta' | 'barbaCheia' | 'bigode' | 'costeleta'
export type EyebrowStyle = 'finas' | 'medias' | 'grossas' | 'arqueadas'

export interface Appearance {
  nome: string
  corpo: BodyShape
  rosto: FaceShape
  /** Índice na paleta de pele ou cor livre. */
  pele: number
  corOlhos: number
  cabelo: HairStyle
  corCabelo: number
  sobrancelha: EyebrowStyle
  barba: BeardStyle
  corBarba: number
  torso: TorsoItem
  corTorso: number
  corTorsoSec: number
  pernas: LegsItem
  corPernas: number
  pes: FeetItem
  corPes: number
  corMeias: number
  chapeu: HeadItem
  corChapeu: number
  oculos: EyewearItem
  mochila: BackItem
  corMochila: number
  pulso: WristItem
  /** Número da camisa, quando uniforme. */
  numero: number
}

export function defaultAppearance(): Appearance {
  return {
    nome: 'Jogador',
    corpo: defaultBodyShape(),
    rosto: defaultFaceShape(),
    pele: 0xd9a878,
    corOlhos: 0x4a3524,
    cabelo: 'curto',
    corCabelo: 0x2b1a12,
    sobrancelha: 'medias',
    barba: 'nenhum',
    corBarba: 0x2b1a12,
    torso: 'camiseta',
    corTorso: 0xe8e8e8,
    corTorsoSec: 0x2f5fb3,
    pernas: 'bermuda',
    corPernas: 0x2f4058,
    pes: 'tenis',
    corPes: 0xf0f0f0,
    corMeias: 0xffffff,
    chapeu: 'nenhum',
    corChapeu: 0xd83a3a,
    oculos: 'nenhum',
    mochila: 'nenhum',
    corMochila: 0x2a2a2a,
    pulso: 'nenhum',
    numero: 10,
  }
}

/** Aparência aleatória coerente, usada para os habitantes da cidade. */
export function randomAppearance(seed: number): Appearance {
  const rng = makeRng(seed)
  const a = defaultAppearance()
  const alto = randRange(rng, 1.55, 1.95)
  a.corpo = clampBodyShape({
    altura: alto,
    ombros: randRange(rng, 0.90, 1.14),
    quadril: randRange(rng, 0.90, 1.16),
    corpo: randRange(rng, 0.86, 1.28),
    musculatura: randRange(rng, 0.86, 1.18),
    pernas: randRange(rng, 0.94, 1.06),
    cabeca: randRange(rng, 0.93, 1.07),
    abdomen: randRange(rng, 0.88, 1.3),
  })
  a.rosto = {
    largura: randRange(rng, 0.9, 1.12),
    alongamento: randRange(rng, 0.92, 1.1),
    queixo: randRange(rng, 0.88, 1.18),
    macas: randRange(rng, 0.9, 1.16),
    nariz: randRange(rng, 0.85, 1.25),
    orbitas: randRange(rng, 0.88, 1.18),
    mandibula: randRange(rng, 0.88, 1.18),
  }
  a.pele = pick(rng, PALETTE.pele)
  a.corCabelo = pick(rng, PALETTE.cabelo)
  a.corBarba = a.corCabelo
  a.cabelo = pick(rng, ['raspado', 'curto', 'curto', 'medio', 'longo', 'cacheado', 'blackPower', 'coque', 'tranças'] as HairStyle[])
  a.barba = pick(rng, ['nenhum', 'nenhum', 'nenhum', 'cavanhaque', 'barbaCurta', 'barbaCheia', 'bigode'] as BeardStyle[])
  a.sobrancelha = pick(rng, ['finas', 'medias', 'grossas', 'arqueadas'] as EyebrowStyle[])
  a.torso = pick(rng, ['camiseta', 'camiseta', 'camisa', 'regata', 'moletom', 'jaqueta'] as TorsoItem[])
  a.corTorso = pick(rng, PALETTE.roupas)
  a.corTorsoSec = pick(rng, PALETTE.roupas)
  a.pernas = pick(rng, ['bermuda', 'calca', 'calca', 'shortEsportivo', 'calcaSocial'] as LegsItem[])
  a.corPernas = pick(rng, [0x2f4058, 0x3a3a42, 0x1e2733, 0x5a4a3a, 0x8a8577, 0x2a2a2a])
  a.pes = pick(rng, ['tenis', 'tenis', 'sapato', 'sandalia'] as FeetItem[])
  a.corPes = pick(rng, [0xf0f0f0, 0x2a2a2a, 0x8c1f22, 0x1d3f6e, 0xd8a32a])
  a.chapeu = pick(rng, ['nenhum', 'nenhum', 'nenhum', 'bone', 'boneTras', 'gorro'] as HeadItem[])
  a.corChapeu = pick(rng, PALETTE.roupas)
  a.oculos = pick(rng, ['nenhum', 'nenhum', 'nenhum', 'oculosSol', 'oculosGrau'] as EyewearItem[])
  a.mochila = rng() < 0.18 ? 'mochila' : 'nenhum'
  a.corMochila = pick(rng, PALETTE.roupas)
  a.pulso = rng() < 0.25 ? 'relogio' : 'nenhum'
  a.numero = 1 + Math.floor(rng() * 30)
  return a
}

// --------------------------------------------------------------------------
// Construção das peças
// --------------------------------------------------------------------------

/** Regiões cobertas por cada peça de roupa. */
const TORSO_REGIONS: Record<TorsoItem, BodyRegion[]> = {
  camiseta: ['torso', 'braco'],
  camisa: ['torso', 'braco', 'antebraco'],
  moletom: ['torso', 'braco', 'antebraco'],
  jaqueta: ['torso', 'braco', 'antebraco'],
  regata: ['torso'],
  uniforme: ['torso', 'braco'],
  semCamisa: [],
}

/** Toda peça de baixo inclui o tronco: é o cós que fecha a cintura. */
const LEGS_REGIONS: Record<LegsItem, BodyRegion[]> = {
  calca: ['torso', 'coxa', 'canela'],
  bermuda: ['torso', 'coxa'],
  calcaSocial: ['torso', 'coxa', 'canela'],
  shortEsportivo: ['torso', 'coxa'],
  saia: ['torso', 'coxa'],
}

/** Até onde a peça de baixo sobe no tronco (fração do segmento quadril→tórax). */
const WAIST_RISE: Record<LegsItem, number> = {
  calca: 0.20, bermuda: 0.18, calcaSocial: 0.26, shortEsportivo: 0.15, saia: 0.22,
}

/** Quanto cada peça "engorda" o corpo, em metros. */
const INFLATE: Record<string, number> = {
  camiseta: 0.014, camisa: 0.016, moletom: 0.026, jaqueta: 0.030,
  regata: 0.012, uniforme: 0.013,
  calca: 0.013, bermuda: 0.015, calcaSocial: 0.014, shortEsportivo: 0.017, saia: 0.03,
}

/** Fração do segmento coberta pela manga/perna (0 = nada, 1 = todo). */
const COVER_FRACTION: Record<string, number> = {
  camiseta: 0.45, camisa: 1, moletom: 1, jaqueta: 1, regata: 0, uniforme: 0.42,
  bermuda: 0.62, shortEsportivo: 0.48, calca: 1, calcaSocial: 1, saia: 0.5,
}

export interface AppearanceParts {
  pele: THREE.BufferGeometry
  roupaTorso: THREE.BufferGeometry | null
  roupaPernas: THREE.BufferGeometry | null
  calcados: THREE.BufferGeometry | null
  meias: THREE.BufferGeometry | null
  cabelo: THREE.BufferGeometry | null
  barba: THREE.BufferGeometry | null
  rosto: THREE.BufferGeometry | null
  acessorios: THREE.BufferGeometry | null
  detalheRoupa: THREE.BufferGeometry | null
}

/**
 * Gera uma peça de roupa como uma casca do próprio corpo, engordada e
 * limitada às regiões (e frações de segmento) que a peça cobre.
 */
function clothingShell(
  shape: BodyShape, inflate: number, regions: ReadonlySet<BodyRegion>,
  cuts?: Partial<Record<BodyRegion, [number, number]>>,
): THREE.BufferGeometry | null {
  if (regions.size === 0) return null
  const built = buildBodyGeometry(shape, inflate, regions, cuts)
  const geo = built.geometry
  if (geo.index && geo.index.count === 0) { geo.dispose(); return null }
  return geo
}

/** Constrói todas as peças da aparência em pose de repouso. */
export function buildAppearanceParts(app: Appearance): AppearanceParts {
  const shape = clampBodyShape(app.corpo)

  // Pele: corpo inteiro (as roupas ficam por cima; o corpo fica visível nas
  // extremidades e sob roupas justas, o que evita buracos em qualquer combinação).
  const pele = buildBodyGeometry(shape, 0).geometry

  const torsoRegions = new Set(TORSO_REGIONS[app.torso])
  let roupaTorso: THREE.BufferGeometry | null = null
  if (torsoRegions.size > 0) {
    const cuts: Partial<Record<BodyRegion, [number, number]>> = {}
    const frac = COVER_FRACTION[app.torso] ?? 1
    if (torsoRegions.has('braco') && frac < 1) cuts.braco = [0, frac]
    roupaTorso = clothingShell(shape, INFLATE[app.torso] ?? 0.015, torsoRegions, cuts)
  }

  const legsRegions = new Set(LEGS_REGIONS[app.pernas])
  const legCuts: Partial<Record<BodyRegion, [number, number]>> = {
    torso: [0, WAIST_RISE[app.pernas] ?? 0.18],
  }
  const legFrac = COVER_FRACTION[app.pernas] ?? 1
  if (legsRegions.has('coxa') && legFrac < 1) legCuts.coxa = [0, legFrac]
  const roupaPernas = clothingShell(shape, INFLATE[app.pernas] ?? 0.014, legsRegions, legCuts)

  const calcados = app.pes === 'descalco' ? null : buildFootwear(app, shape)
  const meias = app.pes === 'chuteira' || app.pes === 'tenis'
    // Meiões sobem do tornozelo: a faixa vai do meio da canela até o pé.
    ? clothingShell(shape, 0.009, new Set<BodyRegion>(['canela']), { canela: app.pes === 'chuteira' ? [0.30, 1] : [0.80, 1] })
    : null

  const cabelo = buildHair(app, shape)
  const barba = buildBeard(app, shape)
  const rosto = buildFaceFeatures(app, shape)
  const acessorios = buildAccessories(app, shape)
  const detalheRoupa = buildClothingDetails(app, shape)

  return { pele, roupaTorso, roupaPernas, calcados, meias, cabelo, barba, rosto, acessorios, detalheRoupa }
}

// --- utilidades para peças presas a um único osso ---------------------------

interface PartBuilder {
  positions: number[]
  normals: number[]
  uvs: number[]
  skinIndices: number[]
  skinWeights: number[]
  indices: number[]
}

function newPart(): PartBuilder {
  return { positions: [], normals: [], uvs: [], skinIndices: [], skinWeights: [], indices: [] }
}

function finishPart(p: PartBuilder): THREE.BufferGeometry | null {
  if (p.positions.length === 0) return null
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(p.positions, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(p.normals, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(p.uvs, 2))
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(p.skinIndices, 4))
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(p.skinWeights, 4))
  g.setIndex(p.indices)
  g.computeVertexNormals()
  return g
}

/** Adiciona uma geometria já posicionada, presa a um osso. */
function attach(p: PartBuilder, geo: THREE.BufferGeometry, boneIdx: number): void {
  const pos = geo.attributes.position as THREE.BufferAttribute
  const nor = geo.attributes.normal as THREE.BufferAttribute | undefined
  const uv = geo.attributes.uv as THREE.BufferAttribute | undefined
  const base = p.positions.length / 3
  for (let i = 0; i < pos.count; i++) {
    p.positions.push(pos.getX(i), pos.getY(i), pos.getZ(i))
    if (nor) p.normals.push(nor.getX(i), nor.getY(i), nor.getZ(i))
    else p.normals.push(0, 1, 0)
    if (uv) p.uvs.push(uv.getX(i), uv.getY(i))
    else p.uvs.push(0, 0)
    p.skinIndices.push(boneIdx, 0, 0, 0)
    p.skinWeights.push(1, 0, 0, 0)
  }
  const idx = geo.index
  if (idx) for (let i = 0; i < idx.count; i++) p.indices.push(idx.getX(i) + base)
  else for (let i = 0; i < pos.count; i++) p.indices.push(base + i)
  geo.dispose()
}

/** Posição de repouso (espaço do modelo) de um osso. */
function restPos(shape: BodyShape, bone: keyof typeof BONE_INDEX): THREE.Vector3 {
  const offsets = boneOffsetsFor(shape)
  const rest: THREE.Vector3[] = []
  const defs = Object.keys(BONE_INDEX) as (keyof typeof BONE_INDEX)[]
  void defs
  // Reconstrói acumulando pela hierarquia declarada em rig.ts
  const { BONE_DEFS } = require_rig()
  BONE_DEFS.forEach((def, i) => {
    const p = offsets[i].clone()
    if (def.parent) p.add(rest[BONE_INDEX[def.parent]])
    rest.push(p)
  })
  return rest[BONE_INDEX[bone]]
}

import * as RigModule from './rig'
function require_rig(): typeof RigModule { return RigModule }

function sphere(r: number, seg = 10): THREE.BufferGeometry {
  return new THREE.SphereGeometry(r, seg, Math.max(4, Math.round(seg * 0.6)))
}

function box(w: number, h: number, d: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d)
}

function put(g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): THREE.BufferGeometry {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(1, 1, 1),
  )
  g.applyMatrix4(m)
  return g
}

// --- cabelo, barba, rosto, acessórios --------------------------------------


/**
 * Domo de cabelo: a borda inferior varia com o azimute — recua na testa
 * (linha do cabelo), desce nas laterais e cobre a nuca. Uma calota esférica
 * simples cobriria o rosto inteiro.
 */
function hairDome(
  padX: number, padY: number, padZ: number,
  frontCut: number, sideCut: number, backCut: number,
  hx: number, hy: number, hz: number,
): THREE.BufferGeometry {
  const LON = 20
  const LAT = 12
  const pos: number[] = []
  const idx: number[] = []
  const uvs: number[] = []
  for (let j = 0; j <= LON; j++) {
    const theta = (j / LON) * Math.PI * 2
    // theta = PI/2 aponta para +Z (frente)
    const front = Math.sin(theta)
    const limit = front > 0
      ? lerp(sideCut, frontCut, front)
      : lerp(sideCut, backCut, -front)
    for (let i = 0; i <= LAT; i++) {
      const phi = (i / LAT) * Math.PI * limit
      const sx = Math.sin(phi) * Math.cos(theta)
      const sy = Math.cos(phi)
      const sz = Math.sin(phi) * Math.sin(theta)
      pos.push(sx * (hx + padX), sy * (hy + padY), sz * (hz + padZ))
      uvs.push(j / LON, 1 - i / LAT)
    }
  }
  for (let j = 0; j < LON; j++) {
    for (let i = 0; i < LAT; i++) {
      const a = j * (LAT + 1) + i
      const b = a + 1
      const c = (j + 1) * (LAT + 1) + i
      const d = c + 1
      idx.push(a, c, b, b, c, d)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function buildHair(app: Appearance, shape: BodyShape): THREE.BufferGeometry | null {
  if (app.cabelo === 'careca') return null
  const p = newPart()
  const head = BONE_INDEX['cabeca']
  const c = restPos(shape, 'cabeca')
  const k = (shape.altura / 1.75) * shape.cabeca
  const top = c.clone().add(new THREE.Vector3(0, HEAD_CENTER_Y * k, 0))
  // O cabelo acompanha o crânio com uma folga proporcional.
  const HX = HEAD_RADII.x * app.rosto.largura
  const HY = HEAD_RADII.y * app.rosto.alongamento
  const HZ = HEAD_RADII.z

  /** pad = folga do cabelo; os cortes são frações de PI a partir do topo. */
  const cap = (pad: number, frontCut: number, sideCut = frontCut + 0.10, backCut = frontCut + 0.20, oy = 0, oz = 0) => {
    const g = hairDome(pad * k, pad * 0.8 * k, pad * k, frontCut, sideCut, backCut, HX * k, HY * k, HZ * k)
    attach(p, put(g, top.x, top.y + oy, top.z + oz), head)
  }

  switch (app.cabelo) {
    case 'raspado': cap(0.0035, 0.40, 0.52, 0.66); break
    case 'curto': cap(0.009, 0.42, 0.56, 0.72); break
    case 'medio':
      cap(0.014, 0.44, 0.62, 0.80)
      attach(p, put(box(0.19 * k, 0.09 * k, 0.03 * k), top.x, top.y - 0.06 * k, top.z - 0.10 * k), head)
      break
    case 'longo':
      cap(0.016, 0.44, 0.66, 0.86)
      attach(p, put(box(0.20 * k, 0.26 * k, 0.07 * k), top.x, top.y - 0.16 * k, top.z - 0.085 * k), head)
      break
    case 'cacheado': {
      cap(0.015, 0.43, 0.60, 0.78)
      const rng = makeRng(7)
      for (let i = 0; i < 22; i++) {
        const a = rng() * Math.PI * 2
        const e = rng() * 0.9
        const r = (HZ + 0.016) * k
        attach(p, put(sphere(randRange(rng, 0.022, 0.04) * k, 6),
          top.x + Math.cos(a) * Math.sin(e) * r,
          top.y + Math.cos(e) * r * 0.95,
          top.z + Math.sin(a) * Math.sin(e) * r), head)
      }
      break
    }
    case 'blackPower': {
      const g = hairDome(0.046 * k, 0.032 * k, 0.042 * k, 0.44, 0.66, 0.86, HX * k, HY * k, HZ * k)
      attach(p, put(g, top.x, top.y + 0.008 * k, top.z - 0.004 * k), head)
      break
    }
    case 'coque':
      cap(0.008, 0.42, 0.58, 0.74)
      attach(p, put(sphere(0.052 * k, 8), top.x, top.y + 0.055 * k, top.z - 0.085 * k), head)
      break
    case 'moicano': {
      cap(0.0025, 0.38, 0.48, 0.60)
      const g = box(0.045 * k, 0.10 * k, 0.21 * k)
      attach(p, put(g, top.x, top.y + 0.065 * k, top.z - 0.005 * k), head)
      break
    }
    case 'tranças': {
      cap(0.009, 0.42, 0.56, 0.74)
      const rng = makeRng(11)
      for (let i = 0; i < 9; i++) {
        const a = -0.9 + (i / 8) * 1.8
        attach(p, put(box(0.016 * k, 0.20 * k, 0.016 * k),
          top.x + Math.sin(a) * 0.075 * k,
          top.y - 0.10 * k - rng() * 0.02 * k,
          top.z - 0.085 * k + Math.cos(a) * 0.01 * k), head)
      }
      break
    }
    default: cap(0.009, 0.42, 0.56, 0.72)
  }
  return finishPart(p)
}

function buildBeard(app: Appearance, shape: BodyShape): THREE.BufferGeometry | null {
  if (app.barba === 'nenhum') return null
  const p = newPart()
  const head = BONE_INDEX['cabeca']
  const c = restPos(shape, 'cabeca')
  const k = (shape.altura / 1.75) * shape.cabeca
  const g = faceAnchors(app, k)
  const jawY = c.y + g.mouthY - 0.026 * k
  const faceZ = c.z + g.mouthZ

  switch (app.barba) {
    case 'bigode':
      attach(p, put(box(0.042 * k, 0.013 * k, 0.018 * k), c.x, jawY + 0.038 * k, faceZ + 0.014 * k), head)
      break
    case 'cavanhaque':
      attach(p, put(box(0.042 * k, 0.046 * k, 0.024 * k), c.x, jawY - 0.014 * k, faceZ + 0.006 * k), head)
      attach(p, put(box(0.042 * k, 0.012 * k, 0.018 * k), c.x, jawY + 0.038 * k, faceZ + 0.014 * k), head)
      break
    case 'costeleta':
      for (const sgn of [-1, 1]) {
        attach(p, put(box(0.014 * k, 0.070 * k, 0.045 * k),
          c.x + sgn * g.earX * 0.94, jawY + 0.046 * k, c.z + g.earZ + 0.018 * k), head)
      }
      break
    case 'barbaCurta': case 'barbaCheia': {
      const pad = app.barba === 'barbaCheia' ? 0.010 : 0.004
      const beard = new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, Math.PI * 0.52, Math.PI * 0.40)
      beard.scale(
        (HEAD_RADII.x * app.rosto.largura + pad) * k,
        (HEAD_RADII.y * app.rosto.alongamento + pad) * k,
        (HEAD_RADII.z + pad) * k,
      )
      attach(p, put(beard, c.x, c.y + HEAD_CENTER_Y * k, c.z), head)
      attach(p, put(box(0.042 * k, 0.012 * k, 0.018 * k), c.x, jawY + 0.038 * k, faceZ + 0.014 * k), head)
      break
    }
    default: break
  }
  return finishPart(p)
}

function buildFaceFeatures(app: Appearance, shape: BodyShape): THREE.BufferGeometry | null {
  const p = newPart()
  const head = BONE_INDEX['cabeca']
  const c = restPos(shape, 'cabeca')
  const k = (shape.altura / 1.75) * shape.cabeca
  const f = app.rosto
  const g = faceAnchors(app, k)
  const cx = c.x, cy = c.y, cz = c.z

  // Globo ocular alojado na órbita
  for (const sgn of [-1, 1]) {
    const eye = sphere(g.eyeR, 10)
    attach(p, put(eye, cx + sgn * g.eyeX, cy + g.eyeY, cz + g.eyeZ), head)
    // Pálpebra superior: fatia fina que dá profundidade à órbita
    const lid = sphere(g.eyeR * 1.16, 10)
    lid.scale(1, 0.42, 1)
    attach(p, put(lid, cx + sgn * g.eyeX, cy + g.eyeY + g.eyeR * 0.72, cz + g.eyeZ * 0.98), head)
  }

  // Nariz: cana, ponta e asas
  const bridgeH = 0.052 * k * f.alongamento
  attach(p, put(box(0.019 * k, bridgeH, 0.022 * k * f.nariz),
    cx, cy + g.noseTopY - bridgeH * 0.35, cz + g.noseZ - 0.008 * k), head)
  attach(p, put(sphere(0.0135 * k * f.nariz, 8), cx, cy + g.noseTipY, cz + g.noseZ), head)
  for (const sgn of [-1, 1]) {
    attach(p, put(sphere(0.0085 * k * f.nariz, 6),
      cx + sgn * 0.0145 * k * f.nariz, cy + g.noseTipY - 0.002 * k, cz + g.noseZ - 0.008 * k), head)
  }

  // Lábios
  const mouthW = 0.023 * k
  for (const [oy, h] of [[0.0045, 0.0075], [-0.0045, 0.0090]] as const) {
    const lip = sphere(1, 10)
    lip.scale(mouthW, h * k, 0.010 * k)
    attach(p, put(lip, cx, cy + g.mouthY + oy * k, cz + g.mouthZ), head)
  }

  // Orelhas
  for (const sgn of [-1, 1]) {
    const ear = sphere(1, 8)
    ear.scale(0.007 * k, 0.026 * k, 0.017 * k)
    attach(p, put(ear, cx + sgn * g.earX, cy + g.earY, cz + g.earZ), head)
  }

  return finishPart(p)
}

/** Pontos de ancoragem do rosto derivados dos raios reais do crânio. */
function faceAnchors(app: Appearance, k: number) {
  const f = app.rosto
  const hx = HEAD_RADII.x * f.largura * k
  const hy = HEAD_RADII.y * f.alongamento * k
  const hz = HEAD_RADII.z * k
  const cy = HEAD_CENTER_Y * k
  const eyeY = cy + hy * 0.10
  // Superfície frontal na altura dos olhos (elipsoide), recuada pela órbita.
  const surfZ = hz * Math.sqrt(Math.max(0, 1 - Math.pow((eyeY - cy) / hy, 2)))
  return {
    eyeR: 0.0118 * k,
    eyeX: hx * 0.42,
    eyeY,
    eyeZ: surfZ * (0.90 - (f.orbitas - 1) * 0.06),
    noseTopY: cy + hy * 0.12,
    noseTipY: cy - hy * 0.12,
    noseZ: hz * 0.99 + 0.006 * k * f.nariz,
    mouthY: cy - hy * 0.42,
    mouthZ: hz * 0.80,
    earX: hx * 0.99,
    earY: cy + hy * 0.02,
    earZ: -hz * 0.06,
    browY: cy + hy * 0.30,
    browZ: surfZ * 0.95,
  }
}

/** Sobrancelhas, íris e demais detalhes coloridos do rosto. */
export function buildFaceDetails(app: Appearance, shape: BodyShape): {
  sobrancelhas: THREE.BufferGeometry | null
  iris: THREE.BufferGeometry | null
} {
  const brow = newPart()
  const iris = newPart()
  const head = BONE_INDEX['cabeca']
  const c = restPos(shape, 'cabeca')
  const k = (shape.altura / 1.75) * shape.cabeca
  const g = faceAnchors(app, k)

  const dims: Record<EyebrowStyle, [number, number, number, number]> = {
    // largura, altura, profundidade, inclinação
    finas: [0.028, 0.0055, 0.009, 0.06],
    medias: [0.031, 0.0085, 0.010, 0.09],
    grossas: [0.034, 0.0125, 0.011, 0.07],
    arqueadas: [0.031, 0.0075, 0.010, 0.22],
  }
  const [bw, bh, bd, tilt] = dims[app.sobrancelha]
  for (const sgn of [-1, 1]) {
    attach(brow, put(box(bw * k, bh * k, bd * k),
      c.x + sgn * g.eyeX, c.y + g.browY, c.z + g.browZ, 0, 0, sgn * tilt), head)
  }
  for (const sgn of [-1, 1]) {
    const eyeball = sphere(g.eyeR * 0.52, 8)
    attach(iris, put(eyeball,
      c.x + sgn * g.eyeX, c.y + g.eyeY, c.z + g.eyeZ + g.eyeR * 0.72), head)
  }
  return { sobrancelhas: finishPart(brow), iris: finishPart(iris) }
}

function buildFootwear(app: Appearance, shape: BodyShape): THREE.BufferGeometry | null {
  const p = newPart()
  const k = shape.altura / 1.75
  for (const side of ['E', 'D'] as const) {
    const footBone = BONE_INDEX[`pe${side}` as keyof typeof BONE_INDEX]
    const f = restPos(shape, `pe${side}` as keyof typeof BONE_INDEX)
    const toe = restPos(shape, `dedos${side}` as keyof typeof BONE_INDEX)
    const cx = (f.x + toe.x) / 2
    const cy = (f.y + toe.y) / 2 - 0.005 * k
    const cz = (f.z + toe.z) / 2 + 0.012 * k

    switch (app.pes) {
      case 'sandalia':
        attach(p, put(box(0.085 * k, 0.020 * k, 0.24 * k), cx, cy - 0.028 * k, cz), footBone)
        attach(p, put(box(0.085 * k, 0.016 * k, 0.05 * k), cx, cy + 0.018 * k, cz + 0.02 * k, -0.25), footBone)
        break
      case 'sapato':
        attach(p, put(box(0.092 * k, 0.062 * k, 0.255 * k), cx, cy - 0.006 * k, cz), footBone)
        attach(p, put(box(0.095 * k, 0.018 * k, 0.26 * k), cx, cy - 0.036 * k, cz), footBone)
        break
      case 'chuteira':
        attach(p, put(box(0.090 * k, 0.058 * k, 0.255 * k), cx, cy - 0.004 * k, cz), footBone)
        attach(p, put(box(0.094 * k, 0.016 * k, 0.262 * k), cx, cy - 0.034 * k, cz), footBone)
        // travas
        for (let i = 0; i < 6; i++) {
          const tx = cx + (i % 2 === 0 ? -0.026 : 0.026) * k
          const tz = cz - 0.09 * k + Math.floor(i / 2) * 0.085 * k
          attach(p, put(box(0.012 * k, 0.014 * k, 0.012 * k), tx, cy - 0.046 * k, tz), footBone)
        }
        break
      default: // tênis
        attach(p, put(box(0.098 * k, 0.070 * k, 0.262 * k), cx, cy - 0.002 * k, cz), footBone)
        attach(p, put(box(0.102 * k, 0.026 * k, 0.268 * k), cx, cy - 0.036 * k, cz), footBone)
        attach(p, put(box(0.090 * k, 0.045 * k, 0.05 * k), cx, cy + 0.030 * k, cz - 0.095 * k), footBone)
        break
    }
  }
  return finishPart(p)
}

function buildAccessories(app: Appearance, shape: BodyShape): THREE.BufferGeometry | null {
  const p = newPart()
  const k = (shape.altura / 1.75)
  const kc = k * shape.cabeca
  const head = BONE_INDEX['cabeca']
  const c = restPos(shape, 'cabeca')

  // Chapéus
  const HX = HEAD_RADII.x * app.rosto.largura * kc
  const HY = HEAD_RADII.y * app.rosto.alongamento * kc
  const HZ = HEAD_RADII.z * kc
  const cy = HEAD_CENTER_Y * kc

  if (app.chapeu === 'bone' || app.chapeu === 'boneTras') {
    const crown = new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.52)
    crown.scale(HX + 0.014 * kc, HY + 0.008 * kc, HZ + 0.014 * kc)
    attach(p, put(crown, c.x, c.y + cy + 0.006 * kc, c.z), head)
    const dir = app.chapeu === 'bone' ? 1 : -1
    attach(p, put(box((HX + 0.014 * kc) * 1.9, 0.010 * kc, 0.105 * kc),
      c.x, c.y + cy + HY * 0.34, c.z + dir * (HZ + 0.055 * kc), dir * 0.14), head)
  } else if (app.chapeu === 'gorro') {
    const g = new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62)
    g.scale(HX + 0.016 * kc, HY + 0.012 * kc, HZ + 0.016 * kc)
    attach(p, put(g, c.x, c.y + cy, c.z), head)
    const rim = new THREE.CylinderGeometry(HX + 0.018 * kc, HX + 0.018 * kc, 0.034 * kc, 18, 1, true)
    rim.scale(1, 1, (HZ + 0.018 * kc) / (HX + 0.018 * kc))
    attach(p, put(rim, c.x, c.y + cy + HY * 0.34, c.z), head)
  } else if (app.chapeu === 'bandana') {
    const g = new THREE.CylinderGeometry(HX + 0.010 * kc, HX + 0.012 * kc, 0.042 * kc, 18, 1, true)
    g.scale(1, 1, (HZ + 0.010 * kc) / (HX + 0.010 * kc))
    attach(p, put(g, c.x, c.y + cy + HY * 0.50, c.z), head)
  }

  // Óculos
  if (app.oculos !== 'nenhum') {
    const g = faceAnchors(app, kc)
    for (const sgn of [-1, 1]) {
      attach(p, put(box(0.032 * kc, 0.024 * kc, 0.005 * kc),
        c.x + sgn * g.eyeX, c.y + g.eyeY, c.z + g.eyeZ + 0.012 * kc), head)
      attach(p, put(box(0.010 * kc, 0.004 * kc, 0.070 * kc),
        c.x + sgn * g.earX * 0.96, c.y + g.eyeY + 0.004 * kc, c.z + g.earZ + 0.038 * kc), head)
    }
    attach(p, put(box(0.016 * kc, 0.004 * kc, 0.005 * kc),
      c.x, c.y + g.eyeY + 0.004 * kc, c.z + g.eyeZ + 0.014 * kc), head)
  }

  // Mochila
  if (app.mochila === 'mochila') {
    const torso = BONE_INDEX['torax']
    const t = restPos(shape, 'torax')
    attach(p, put(box(0.24 * k, 0.32 * k, 0.14 * k), t.x, t.y + 0.02 * k, t.z - 0.17 * k), torso)
    attach(p, put(box(0.20 * k, 0.10 * k, 0.10 * k), t.x, t.y - 0.10 * k, t.z - 0.20 * k), torso)
    for (const s of [-1, 1]) {
      attach(p, put(box(0.035 * k, 0.28 * k, 0.02 * k), t.x + s * 0.085 * k, t.y - 0.02 * k, t.z + 0.085 * k), torso)
    }
  }

  // Relógio / pulseira
  if (app.pulso !== 'nenhum') {
    const hand = BONE_INDEX['maoE']
    const h = restPos(shape, 'maoE')
    const band = new THREE.CylinderGeometry(0.030 * k, 0.030 * k, 0.018 * k, 12, 1, true)
    attach(p, put(band, h.x, h.y + 0.035 * k, h.z), hand)
    if (app.pulso === 'relogio') {
      attach(p, put(box(0.030 * k, 0.010 * k, 0.026 * k), h.x + 0.028 * k, h.y + 0.035 * k, h.z), hand)
    }
  }

  return finishPart(p)
}

/** Detalhes coloridos da roupa: gola, listras e capuz, moldados no corpo. */
function buildClothingDetails(app: Appearance, shape: BodyShape): THREE.BufferGeometry | null {
  const k = shape.altura / 1.75
  const pieces: THREE.BufferGeometry[] = []
  const torsoOnly = new Set<BodyRegion>(['torso'])
  const inflate = (INFLATE[app.torso] ?? 0.015) + 0.004

  if (app.torso === 'uniforme') {
    // Faixas horizontais acompanhando exatamente a silhueta do tronco.
    for (const [de, ate] of [[0.30, 0.42], [0.52, 0.64], [0.74, 0.86]] as const) {
      const g = clothingShell(shape, inflate, torsoOnly, { torso: [de, ate] })
      if (g) pieces.push(g)
    }
  }
  if (app.torso === 'camisa' || app.torso === 'jaqueta') {
    const collar = clothingShell(shape, inflate + 0.006, torsoOnly, { torso: [0.94, 1.0] })
    if (collar) pieces.push(collar)
  }
  if (app.torso === 'moletom') {
    // Capuz caído sobre as costas
    const p = newPart()
    const t = restPos(shape, 'torax')
    const hood = sphere(1, 12)
    hood.scale(0.105 * k, 0.085 * k, 0.075 * k)
    attach(p, put(hood, t.x, t.y + 0.150 * k, t.z - 0.095 * k), BONE_INDEX['torax'])
    const g = finishPart(p)
    if (g) pieces.push(g)
  }

  if (pieces.length === 0) return null
  if (pieces.length === 1) return pieces[0]
  return mergeParts(pieces)
}

/** Junta geometrias de peças que compartilham os mesmos atributos. */
function mergeParts(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry()
  let vCount = 0
  let iCount = 0
  for (const g of list) {
    vCount += g.attributes.position.count
    iCount += g.index ? g.index.count : g.attributes.position.count
  }
  const pos = new Float32Array(vCount * 3)
  const nor = new Float32Array(vCount * 3)
  const uv = new Float32Array(vCount * 2)
  const si = new Uint16Array(vCount * 4)
  const sw = new Float32Array(vCount * 4)
  const idx = vCount > 65535 ? new Uint32Array(iCount) : new Uint16Array(iCount)
  let vo = 0
  let io = 0
  for (const g of list) {
    const p = g.attributes.position as THREE.BufferAttribute
    pos.set(p.array as Float32Array, vo * 3)
    const n = g.attributes.normal as THREE.BufferAttribute | undefined
    if (n) nor.set(n.array as Float32Array, vo * 3)
    const u = g.attributes.uv as THREE.BufferAttribute | undefined
    if (u) uv.set(u.array as Float32Array, vo * 2)
    const a = g.attributes.skinIndex as THREE.BufferAttribute | undefined
    if (a) si.set(a.array as Uint16Array, vo * 4)
    const w = g.attributes.skinWeight as THREE.BufferAttribute | undefined
    if (w) sw.set(w.array as Float32Array, vo * 4)
    if (g.index) {
      for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.getX(i) + vo
      io += g.index.count
    } else {
      for (let i = 0; i < p.count; i++) idx[io + i] = vo + i
      io += p.count
    }
    vo += p.count
    g.dispose()
  }
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  out.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4))
  out.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4))
  out.setIndex(new THREE.BufferAttribute(idx, 1))
  return out
}
