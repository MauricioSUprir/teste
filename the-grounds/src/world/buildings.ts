/**
 * Geração de edificações: loteamento das quadras, volumetria por zona e
 * detalhamento de fachada (janelas rebaixadas, sacadas, cornijas, toldos,
 * letreiros, telhados e equipamentos de cobertura).
 *
 * Todo edifício recebe um térreo oco com vão de porta — o interior em si é
 * construído sob demanda por `interiors.ts` quando o jogador se aproxima.
 */

import * as THREE from 'three'
import { hash2, lerp, makeRng, pick, randInt, randRange, type Rng } from '../core/math'
import { GeometryBatcher, makeBox, makeCylinder, transform, withColor, type NivelDetalhe } from './geometry'
import { PALETTE } from './materials'
import type { CollisionWorld } from './collision'
import type { Block, Zone } from './layout'
import { terrainHeight } from './terrain'

export type BuildingType =
  | 'torre' | 'predio' | 'sobrado' | 'casa' | 'casaSimples' | 'galpao'
  | 'quiosque' | 'chacara' | 'loja' | 'mercado' | 'cafe' | 'lojaEsporte' | 'vestiario'

export type InteriorKind =
  | 'casa' | 'apartamento' | 'lojaRoupas' | 'lojaEsporte' | 'cafe' | 'mercado'
  | 'saguao' | 'escritorio' | 'garagem' | 'vestiario' | 'generico'

export interface BuildingSpec {
  id: number
  x: number; z: number
  /** Direção da fachada frontal (aponta para a rua). */
  yaw: number
  width: number   // largura ao longo da fachada
  depth: number   // profundidade
  floors: number
  floorHeight: number
  baseY: number
  type: BuildingType
  zone: Zone
  color: number
  trimColor: number
  roofColor: number
  /** Porta principal em coordenadas de mundo. */
  door: { x: number; z: number; yaw: number }
  interior: InteriorKind
  /** Nome do estabelecimento, quando houver letreiro. */
  label?: string
  /** Número de unidades acessíveis por elevador/escada (0 = só térreo). */
  units: number
  seed: number
}

const NOMES_LOJA = ['Modas Aurora', 'Bazar do Zé', 'Casa Bonita', 'Tecidos Sul', 'Loja Cometa', 'Ateliê Ipê']
const NOMES_ESPORTE = ['Esporte Total', 'Gol de Placa', 'Casa do Atleta', 'Pé na Bola', 'Arena Sport']
const NOMES_CAFE = ['Café do Mercado', 'Padaria Estrela', 'Cantinho do Pão', 'Bar do Nando', 'Lanches Aurora']
const NOMES_MERCADO = ['Mercado Preciosa', 'Empório Bom Preço', 'Mercearia Ribeiro', 'Super Vila']
const NOMES_PREDIO = ['Ed. Solar', 'Ed. Jequitibá', 'Res. Bela Vista', 'Ed. Atlântico', 'Cond. Mirante']

const FLOOR_H = 3.15

// --------------------------------------------------------------------------
// Loteamento
// --------------------------------------------------------------------------

interface LotSizing { min: number; max: number; depth: number; floors: [number, number]; gap: number }

function sizingFor(zone: Zone): LotSizing {
  switch (zone) {
    case 'centro': return { min: 14, max: 26, depth: 20, floors: [5, 22], gap: 0.4 }
    case 'comercio': return { min: 11, max: 20, depth: 17, floors: [2, 7], gap: 0.5 }
    case 'residencial': return { min: 10, max: 16, depth: 13, floors: [1, 3], gap: 1.6 }
    case 'condominio': return { min: 14, max: 22, depth: 15, floors: [1, 2], gap: 3.2 }
    case 'orla': return { min: 10, max: 18, depth: 14, floors: [1, 4], gap: 1.2 }
    case 'esportivo': return { min: 12, max: 20, depth: 15, floors: [1, 3], gap: 1.4 }
    case 'industrial': return { min: 22, max: 40, depth: 26, floors: [1, 2], gap: 2.0 }
    case 'periferia': return { min: 7, max: 12, depth: 11, floors: [1, 2], gap: 0.9 }
    case 'rural': return { min: 12, max: 18, depth: 14, floors: [1, 1], gap: 14 }
    default: return { min: 10, max: 16, depth: 13, floors: [1, 3], gap: 1.2 }
  }
}

function pickType(zone: Zone, rng: Rng, floors: number): BuildingType {
  const r = rng()
  switch (zone) {
    case 'centro': return floors >= 9 ? 'torre' : (r < 0.3 ? 'loja' : 'predio')
    case 'comercio':
      if (r < 0.17) return 'loja'
      if (r < 0.28) return 'cafe'
      if (r < 0.36) return 'mercado'
      if (r < 0.43) return 'lojaEsporte'
      return 'predio'
    case 'residencial': return r < 0.16 ? 'sobrado' : (r < 0.24 ? 'loja' : 'casa')
    case 'condominio': return r < 0.3 ? 'sobrado' : 'casa'
    case 'orla': return r < 0.3 ? 'quiosque' : (r < 0.5 ? 'cafe' : 'predio')
    case 'esportivo': return r < 0.22 ? 'lojaEsporte' : (r < 0.36 ? 'vestiario' : (r < 0.6 ? 'casa' : 'predio'))
    case 'industrial': return r < 0.75 ? 'galpao' : 'predio'
    case 'periferia': return r < 0.14 ? 'loja' : (r < 0.2 ? 'mercado' : 'casaSimples')
    case 'rural': return r < 0.25 ? 'galpao' : 'chacara'
    default: return 'casa'
  }
}

function interiorFor(type: BuildingType, rng: Rng): InteriorKind {
  switch (type) {
    case 'loja': return 'lojaRoupas'
    case 'lojaEsporte': return 'lojaEsporte'
    case 'cafe': return 'cafe'
    case 'mercado': return 'mercado'
    case 'vestiario': return 'vestiario'
    case 'galpao': return 'garagem'
    case 'torre': return 'saguao'
    case 'predio': return rng() < 0.45 ? 'saguao' : 'lojaRoupas'
    case 'casa': case 'casaSimples': case 'sobrado': case 'chacara': return 'casa'
    case 'quiosque': return 'cafe'
    default: return 'generico'
  }
}

function paletteFor(zone: Zone): readonly number[] {
  if (zone === 'centro') return PALETTE.fachadasCentro
  if (zone === 'periferia' || zone === 'rural') return PALETTE.fachadasPeriferia
  return PALETTE.fachadas
}

/** Distribui edifícios ao longo dos quatro lados de uma quadra. */
export function planBlockBuildings(block: Block, idBase: number): BuildingSpec[] {
  if (block.kind !== 'edificado') return []
  const rng = makeRng(0x9e37 ^ (block.id * 2654435761))
  const sz = sizingFor(block.zone)
  const out: BuildingSpec[] = []
  const state = { id: idBase }

  // Quadra pequena: um único edifício ocupa o lote inteiro (típico de centro
  // adensado e de vilas estreitas).
  if (Math.min(block.width, block.depth) < 24 || block.width * block.depth < 620) {
    const alongX = block.width >= block.depth
    const yaw = alongX ? 0 : Math.PI / 2
    const w = (alongX ? block.width : block.depth) - 0.8
    const d = (alongX ? block.depth : block.width) - 0.8
    if (w > 5 && d > 5) {
      out.push(makeSpec(state, block, rng, sz, block.cx, block.cz, yaw, w, d))
    }
    return out
  }

  const sides: { yaw: number; nx: number; nz: number; ax: 0 | 1; az: 0 | 1; ox: number; oz: number; len: number }[] = [
    { yaw: Math.PI, nx: 0, nz: -1, ax: 1, az: 0, ox: block.x0, oz: block.z0, len: block.width },
    { yaw: 0, nx: 0, nz: 1, ax: 1, az: 0, ox: block.x0, oz: block.z1, len: block.width },
    { yaw: -Math.PI / 2, nx: -1, nz: 0, ax: 0, az: 1, ox: block.x0, oz: block.z0, len: block.depth },
    { yaw: Math.PI / 2, nx: 1, nz: 0, ax: 0, az: 1, ox: block.x1, oz: block.z0, len: block.depth },
  ]

  for (const side of sides) {
    const perp = side.ax === 1 ? block.depth : block.width
    // Profundidade adaptada: nunca consome a corrida útil da fachada.
    let depth = Math.min(sz.depth, perp / 2 - 1.0)
    depth = Math.min(depth, (side.len - sz.min - 1.2) / 2)
    depth = Math.max(6, depth)
    const setback = depth + 0.4
    const runStart = setback
    const runEnd = side.len - setback
    if (runEnd - runStart < sz.min * 0.7) continue

    let cursor = runStart
    while (runEnd - cursor >= sz.min * 0.7) {
      const remaining = runEnd - cursor
      let w = randRange(rng, sz.min, sz.max)
      // Absorve a sobra final em vez de deixar um vão inútil.
      if (remaining - w < sz.min * 0.7) w = remaining
      const center = cursor + w / 2

      const cx = side.ax === 1 ? side.ox + center : side.ox - side.nx * (depth / 2)
      const cz = side.az === 1 ? side.oz + center : side.oz - side.nz * (depth / 2)
      const fx = side.ax === 1 ? cx : cx
      const fz = side.az === 1 ? cz : cz
      const bx = side.ax === 1 ? fx : side.ox - side.nx * (depth / 2)
      const bz = side.az === 1 ? fz : side.oz - side.nz * (depth / 2)

      out.push(makeSpec(state, block, rng, sz, bx, bz, side.yaw, Math.max(4, w - sz.gap), depth))
      cursor += w
    }
  }
  return out
}

/** Monta a ficha de um edifício já posicionado. */
function makeSpec(
  state: { id: number }, block: Block, rng: Rng, sz: LotSizing,
  cx: number, cz: number, yaw: number, width: number, depth: number,
): BuildingSpec {
  const floors = randInt(rng, sz.floors[0], sz.floors[1])
  const type = pickType(block.zone, rng, floors)
  const realFloors = type === 'casa' || type === 'casaSimples' || type === 'chacara' || type === 'quiosque'
    ? 1 : (type === 'sobrado' ? 2 : (type === 'galpao' ? 1 : Math.max(1, floors)))
  const fh = type === 'galpao' ? 6.5 : (type === 'torre' ? 3.35 : FLOOR_H)
  const baseY = terrainHeight(cx, cz)
  const color = pick(rng, paletteFor(block.zone))

  // Frente em +Z local: a porta fica sobre o plano externo da fachada.
  const dirX = Math.sin(yaw)
  const dirZ = Math.cos(yaw)

  return {
    id: state.id++,
    x: cx, z: cz, yaw,
    width, depth,
    floors: realFloors,
    floorHeight: fh,
    baseY,
    type,
    zone: block.zone,
    color,
    trimColor: rng() < 0.4 ? 0xf2efe8 : new THREE.Color(color).multiplyScalar(0.82).getHex(),
    roofColor: pick(rng, PALETTE.telhados),
    door: { x: cx + dirX * (depth / 2 + 0.55), z: cz + dirZ * (depth / 2 + 0.55), yaw },
    interior: interiorFor(type, rng),
    label: labelFor(type, rng),
    units: realFloors > 2 ? Math.min(6, realFloors - 1) : 0,
    seed: Math.floor(rng() * 1e9),
  }
}

function labelFor(type: BuildingType, rng: Rng): string | undefined {
  switch (type) {
    case 'loja': return pick(rng, NOMES_LOJA)
    case 'lojaEsporte': return pick(rng, NOMES_ESPORTE)
    case 'cafe': case 'quiosque': return pick(rng, NOMES_CAFE)
    case 'mercado': return pick(rng, NOMES_MERCADO)
    case 'predio': case 'torre': return rng() < 0.5 ? pick(rng, NOMES_PREDIO) : undefined
    default: return undefined
  }
}

// --------------------------------------------------------------------------
// Construção da malha
// --------------------------------------------------------------------------

const WALL_T = 0.28
const DOOR_W = 1.55
const DOOR_H = 2.32

/** Só a face frontal (+Z local): usado para decalques de fachada. */
const ONLY_FRONT: ReadonlySet<string> = new Set(['px', 'nx', 'py', 'ny', 'nz'])
const SKIP_BOTTOM: ReadonlySet<string> = new Set(['ny'])


/**
 * Revestimento da fachada. A mistura entre reboco pintado, pastilha e tijolo
 * aparente é o que mais diferencia os bairros visualmente.
 */
function facadeMaterialFor(spec: BuildingSpec, rng: Rng): string {
  if (spec.type === 'galpao') return 'metalPintado'
  const r = rng()
  switch (spec.zone) {
    case 'centro':
      if (r < 0.28) return 'fachadaPastilha'
      if (r < 0.36) return 'concreto'
      return 'fachada'
    case 'comercio':
      if (r < 0.22) return 'fachadaPastilha'
      if (r < 0.30) return 'fachadaGasta'
      return 'fachada'
    case 'periferia':
      if (r < 0.34) return 'tijolo'
      if (r < 0.58) return 'fachadaGasta'
      return 'fachada'
    case 'rural':
      if (r < 0.22) return 'tijolo'
      return 'fachadaGasta'
    case 'industrial':
      return r < 0.5 ? 'metalPintado' : 'concreto'
    case 'orla':
      return r < 0.3 ? 'fachadaPastilha' : 'fachada'
    default:
      if (r < 0.14) return 'tijolo'
      if (r < 0.26) return 'fachadaGasta'
      if (r < 0.34) return 'fachadaPastilha'
      return 'fachada'
  }
}

/** Constrói a geometria de um edifício e registra seus colisores. */
export function buildBuilding(
  spec: BuildingSpec,
  batcher: GeometryBatcher,
  collision: CollisionWorld,
  owner: string,
  detail: NivelDetalhe,
): void {
  const rng = makeRng(spec.seed)
  const w = spec.width
  const d = spec.depth
  const fh = spec.floorHeight
  const totalH = spec.floors * fh
  const base = spec.baseY
  const color = new THREE.Color(spec.color)
  const trim = new THREE.Color(spec.trimColor)
  // Térreo frequentemente pintado em tom próprio (loja, zócalo, reforma).
  const groundColor = rng() < 0.45
    ? new THREE.Color(spec.color).offsetHSL(0, rng() * 0.08 - 0.04, rng() * 0.22 - 0.16)
    : color
  const yaw = spec.yaw

  // Malha local: eixo X = largura da fachada, eixo Z = profundidade,
  // frente em +Z local (rotacionada por `yaw`).
  const place = (geo: THREE.BufferGeometry, lx: number, ly: number, lz: number, ryaw = 0) => {
    transform(geo, 0, 0, 0, ryaw)
    const cos = Math.cos(yaw), sin = Math.sin(yaw)
    const wx = spec.x + lx * cos + lz * sin
    const wz = spec.z - lx * sin + lz * cos
    transform(geo, wx, base + ly, wz, yaw)
    return geo
  }

  const addCollider = (lx: number, ly: number, lz: number, hx: number, hy: number, hz: number, tag: 'predio' | 'parede' = 'predio') => {
    const cos = Math.cos(yaw), sin = Math.sin(yaw)
    const wx = spec.x + lx * cos + lz * sin
    const wz = spec.z - lx * sin + lz * cos
    collision.add({ x: wx, y: base + ly, z: wz }, { x: hx, y: hy, z: hz }, yaw, tag, owner)
  }

  const facadeKey = facadeMaterialFor(spec, rng)
  // Cada edifício desloca e reescala a UV: sem isso, quarteirões inteiros
  // exibem o mesmo desenho de textura alinhado, o que denuncia a repetição.
  const uvOff: [number, number] = [rng() * 8, rng() * 8]
  const uvFach = 2.3 * randRange(rng, 0.88, 1.16)

  // ---- Térreo oco: 4 paredes com vão de porta na frente --------------------
  const gh = Math.min(fh, spec.type === 'galpao' ? 6.5 : 3.15)
  const hw = w / 2, hd = d / 2

  // Parede traseira e laterais
  batcher.add(facadeKey, withColor(place(makeBox(w, gh, WALL_T, { uvScale: uvFach, uvOffset: uvOff }), 0, gh / 2, -hd + WALL_T / 2), groundColor))
  batcher.add(facadeKey, withColor(place(makeBox(WALL_T, gh, d, { uvScale: uvFach, uvOffset: uvOff }), -hw + WALL_T / 2, gh / 2, 0), groundColor))
  batcher.add(facadeKey, withColor(place(makeBox(WALL_T, gh, d, { uvScale: uvFach, uvOffset: uvOff }), hw - WALL_T / 2, gh / 2, 0), groundColor))
  addCollider(0, gh / 2, -hd + WALL_T / 2, hw, gh / 2, WALL_T / 2, 'parede')
  addCollider(-hw + WALL_T / 2, gh / 2, 0, WALL_T / 2, gh / 2, hd, 'parede')
  addCollider(hw - WALL_T / 2, gh / 2, 0, WALL_T / 2, gh / 2, hd, 'parede')

  // Fachada frontal com vão de porta
  const doorHalf = DOOR_W / 2
  const leftW = hw - doorHalf
  if (leftW > 0.05) {
    batcher.add(facadeKey, withColor(place(makeBox(leftW, gh, WALL_T, { uvScale: uvFach, uvOffset: uvOff }), -(doorHalf + leftW / 2), gh / 2, hd - WALL_T / 2), groundColor))
    batcher.add(facadeKey, withColor(place(makeBox(leftW, gh, WALL_T, { uvScale: uvFach, uvOffset: uvOff }), doorHalf + leftW / 2, gh / 2, hd - WALL_T / 2), groundColor))
    addCollider(-(doorHalf + leftW / 2), gh / 2, hd - WALL_T / 2, leftW / 2, gh / 2, WALL_T / 2, 'parede')
    addCollider(doorHalf + leftW / 2, gh / 2, hd - WALL_T / 2, leftW / 2, gh / 2, WALL_T / 2, 'parede')
  }
  // Verga acima da porta
  const lintelH = gh - DOOR_H
  if (lintelH > 0.05) {
    batcher.add(facadeKey, withColor(place(makeBox(DOOR_W, lintelH, WALL_T, { uvScale: uvFach, uvOffset: uvOff }), 0, DOOR_H + lintelH / 2, hd - WALL_T / 2), groundColor))
    addCollider(0, DOOR_H + lintelH / 2, hd - WALL_T / 2, doorHalf, lintelH / 2, WALL_T / 2, 'parede')
  }
  // Batente e soleira
  batcher.add('madeiraEscura', withColor(place(makeBox(DOOR_W + 0.18, 0.12, 0.34, { uvScale: 1 }), 0, DOOR_H + 0.06, hd - 0.1), trim))
  batcher.add('concreto', withColor(place(makeBox(DOOR_W + 0.5, 0.12, 0.7, { uvScale: 1 }), 0, 0.06, hd + 0.18), new THREE.Color(0xcfcabf)))

  // Laje entre térreo e primeiro andar
  batcher.add('concreto', withColor(place(makeBox(w, 0.22, d, { uvScale: 2 }), 0, gh + 0.11, 0), new THREE.Color(0xcac6bd)))
  addCollider(0, gh + 0.11, 0, hw, 0.11, hd)

  // ---- Andares superiores: volume sólido -----------------------------------
  const upperH = totalH - gh
  if (upperH > 0.3) {
    const skip = new Set(['ny'])
    batcher.add(facadeKey, withColor(
      place(makeBox(w, upperH, d, { uvScale: uvFach * 1.05, uvOffset: uvOff, skip }), 0, gh + upperH / 2, 0), color))
    addCollider(0, gh + upperH / 2, 0, hw, upperH / 2, hd)
  }

  // ---- Detalhamento de fachada --------------------------------------------
  if (detail !== 'baixo') {
    addFacadeDetails(spec, batcher, place, rng, color, trim, gh, totalH, detail)
    addUrbanClutter(spec, batcher, place, rng, gh, totalH)
  }

  // ---- Cobertura -----------------------------------------------------------
  addRoof(spec, batcher, place, rng, totalH)

  // Colisor de topo (para andar sobre lajes acessíveis de casas baixas)
  void collision
}

type PlaceFn = (geo: THREE.BufferGeometry, lx: number, ly: number, lz: number, ryaw?: number) => THREE.BufferGeometry

function addFacadeDetails(
  spec: BuildingSpec, batcher: GeometryBatcher, place: PlaceFn, rng: Rng,
  color: THREE.Color, trim: THREE.Color, groundH: number, totalH: number,
  nivel: NivelDetalhe = 'alto',
): void {
  /** Miúdos que só existem no anel colado no jogador. */
  const fino = nivel === 'alto'
  const w = spec.width
  const d = spec.depth
  const hw = w / 2, hd = d / 2
  const fh = spec.floorHeight
  const glassTint = new THREE.Color(spec.zone === 'centro' ? 0x9fb8cc : 0xbcd0dc)
  const dark = new THREE.Color(0x101418)

  // Vitrine / porta de vidro no térreo para tipos comerciais
  const comercial = ['loja', 'cafe', 'mercado', 'lojaEsporte', 'torre', 'predio'].includes(spec.type)
  if (comercial && w > 5) {
    const vw = Math.min(w - 2.2, w * 0.66)
    const vh = Math.min(groundH - 1.0, 2.1)
    batcher.add('vidro', withColor(place(makeBox(vw, vh, 0.06, { uvScale: 1 }), 0, 0.85 + vh / 2, hd + 0.02), glassTint))
    batcher.add('metal', withColor(place(makeBox(vw + 0.16, 0.12, 0.14, { uvScale: 1 }), 0, 0.85 + vh + 0.06, hd + 0.05), trim))
    batcher.add('metal', withColor(place(makeBox(vw + 0.16, 0.12, 0.14, { uvScale: 1 }), 0, 0.79, hd + 0.05), trim))
    // Toldo
    if (rng() < 0.55) {
      const tw = vw + 0.8
      const awn = place(makeBox(tw, 0.08, 1.5, { uvScale: 1.2 }), 0, groundH - 0.35, hd + 0.72)
      batcher.add('toldo', withColor(awn, new THREE.Color(pick(rng, PALETTE.roupas)).lerp(new THREE.Color(0xffffff), 0.25)))
      batcher.add('metal', withColor(place(makeBox(0.06, 0.5, 0.06, { uvScale: 1 }), -tw / 2 + 0.1, groundH - 0.62, hd + 1.4), dark))
      batcher.add('metal', withColor(place(makeBox(0.06, 0.5, 0.06, { uvScale: 1 }), tw / 2 - 0.1, groundH - 0.62, hd + 1.4), dark))
    }
    // Letreiro
    if (spec.label) {
      batcher.add('plastico', withColor(place(makeBox(Math.min(w - 1, vw + 1.2), 0.62, 0.12, { uvScale: 1 }), 0, groundH - 0.05, hd + 0.16),
        new THREE.Color(pick(rng, PALETTE.roupas))))
      batcher.add('luz', withColor(place(makeBox(Math.min(w - 1.4, vw + 0.9), 0.36, 0.05, { uvScale: 1 }), 0, groundH - 0.05, hd + 0.24),
        new THREE.Color(0xfff4d8)))
    }
  }

  // Janelas dos andares superiores, em todas as quatro faces.
  //
  // Uma janela plana colada na parede é o que mais achata uma fachada: sem
  // profundidade não há sombra e o prédio vira um adesivo. Aqui cada janela é
  // um anel de moldura que avança da parede, com o vidro lá no fundo — o
  // olho lê isso como um vão recuado, que é o efeito que interessa.
  const winW = 1.15
  const winH = 1.35
  const startFloor = 1
  /** Quanto a moldura avança da parede (profundidade aparente do vão). */
  const PROF = 0.19
  /** Espessura das peças da moldura. */
  const ESP = 0.085
  const SEM_FUNDO: ReadonlySet<string> = new Set(['nz'])
  const corMoldura = trim.clone().lerp(new THREE.Color(0xffffff), 0.28)
  const corCaixilho = new THREE.Color(0x3b4148)
  const faces: { sx: number; sz: number; len: number; yawOff: number; off: number }[] = [
    { sx: 1, sz: 0, len: w, yawOff: 0, off: hd },        // frente (+Z local)
    { sx: 1, sz: 0, len: w, yawOff: Math.PI, off: -hd }, // fundos
    { sx: 0, sz: 1, len: d, yawOff: Math.PI / 2, off: hw },
    { sx: 0, sz: 1, len: d, yawOff: -Math.PI / 2, off: -hw },
  ]

  for (const f of faces) {
    const cols = Math.max(1, Math.floor((f.len - 1.4) / 2.55))
    const spacing = (f.len - 1.0) / cols
    for (let fl = startFloor; fl < spec.floors; fl++) {
      const y = groundH + (fl - 1) * fh + fh * 0.42
      if (y + winH / 2 > totalH - 0.25) continue
      for (let c = 0; c < cols; c++) {
        const t = -f.len / 2 + 0.5 + spacing * (c + 0.5)
        const lx = f.sx ? t : f.off
        const lz = f.sz ? t : f.off
        const nx = f.sx ? 0 : Math.sign(f.off)
        const nz = f.sz ? 0 : Math.sign(f.off)
        const ox = nx * 0.02
        const oz = nz * 0.02

        const lit = hash2(spec.id * 7 + c, fl, 991)
        /** Sujeira acumulada: mais forte embaixo, onde a chuva escorre. */
        const sujo = lerp(0.82, 1.0, Math.min(1, (fl - 1) / Math.max(1, spec.floors - 2)))

        // Vidro no fundo do vão, quase no plano da parede.
        batcher.add('vidro', withColor(
          place(makeBox(winW, winH, 0.02, { uvScale: 1, skip: ONLY_FRONT }), lx + ox, y, lz + oz, f.yawOff),
          glassTint.clone().multiplyScalar(lerp(0.52, 0.92, lit))))
        // Caixilho em cruz, no fundo do vão: dá escala à janela.
        if (fino) {
          batcher.add('plastico', withColor(
            place(makeBox(0.05, winH, 0.03, { uvScale: 1, skip: ONLY_FRONT }), lx + ox * 2, y, lz + oz * 2, f.yawOff), corCaixilho))
        }
        batcher.add('plastico', withColor(
          place(makeBox(winW, 0.05, 0.03, { uvScale: 1, skip: ONLY_FRONT }), lx + ox * 2, y + winH * 0.14, lz + oz * 2, f.yawOff), corCaixilho))

        // Anel da moldura: as faces internas destas peças são o recuo do vão,
        // e é a sombra delas sobre o vidro que cria a profundidade.
        const meio = PROF / 2
        const mx = nx * meio
        const mz = nz * meio
        batcher.add('reboco', withColor(  // verga (peça de cima)
          place(makeBox(winW + ESP * 2, ESP, PROF, { uvScale: 1, skip: SEM_FUNDO }),
            lx + mx, y + winH / 2 + ESP / 2, lz + mz, f.yawOff), corMoldura.clone().multiplyScalar(sujo)))
        batcher.add('reboco', withColor(  // jamba esquerda
          place(makeBox(ESP, winH, PROF, { uvScale: 1, skip: SEM_FUNDO }),
            lx + mx - (f.sx ? winW / 2 + ESP / 2 : 0), y, lz + mz - (f.sz ? winW / 2 + ESP / 2 : 0), f.yawOff),
          corMoldura.clone().multiplyScalar(sujo * 0.97)))
        batcher.add('reboco', withColor(  // jamba direita
          place(makeBox(ESP, winH, PROF, { uvScale: 1, skip: SEM_FUNDO }),
            lx + mx + (f.sx ? winW / 2 + ESP / 2 : 0), y, lz + mz + (f.sz ? winW / 2 + ESP / 2 : 0), f.yawOff),
          corMoldura.clone().multiplyScalar(sujo * 0.97)))

        // Peitoril: avança mais que a moldura e pinga chuva na parede abaixo.
        batcher.add('concreto', withColor(
          place(makeBox(winW + ESP * 2 + 0.16, 0.10, PROF + 0.12, { uvScale: 1, skip: SKIP_BOTTOM }),
            lx + nx * (meio + 0.06), y - winH / 2 - 0.05, lz + nz * (meio + 0.06), f.yawOff),
          corMoldura.clone().multiplyScalar(sujo * 0.93)))
        // Escorrido de chuva sob o peitoril.
        if (fino) batcher.add('reboco', withColor(
          place(makeBox(winW + 0.1, fh * 0.42, 0.012, { uvScale: 1, skip: ONLY_FRONT }),
            lx + ox * 0.6, y - winH / 2 - 0.1 - fh * 0.21, lz + oz * 0.6, f.yawOff),
          color.clone().multiplyScalar(0.84)))

        // Verga superior larga, marcando a linha da janela na fachada.
        if (fino) batcher.add('concreto', withColor(
          place(makeBox(winW + 0.62, 0.13, PROF + 0.05, { uvScale: 1, skip: SKIP_BOTTOM }),
            lx + nx * (meio + 0.02), y + winH / 2 + ESP + 0.07, lz + nz * (meio + 0.02), f.yawOff),
          corMoldura.clone().multiplyScalar(sujo)))

        // Grade de proteção nos primeiros andares — presença constante nas
        // cidades brasileiras e o que dá densidade à fachada de perto.
        const residencial = spec.type === 'predio' || spec.type === 'sobrado' || spec.type === 'casa'
        if (fino && residencial && fl <= 3 && hash2(spec.id * 13 + c, fl, 71) < 0.62) {
          const barras = 4
          for (let b = 0; b < barras; b++) {
            const t2 = (b / (barras - 1) - 0.5) * (winW - 0.1)
            batcher.add('grade', withColor(
              place(makeBox(0.028, winH - 0.05, 0.028, { uvScale: 1 }),
                lx + nx * (PROF - 0.03) + (f.sx ? t2 : 0), y, lz + nz * (PROF - 0.03) + (f.sz ? t2 : 0), f.yawOff),
              new THREE.Color(0x4a4d51)))
          }
          batcher.add('grade', withColor(
            place(makeBox(winW - 0.05, 0.03, 0.03, { uvScale: 1 }),
              lx + nx * (PROF - 0.03), y + winH / 2 - 0.05, lz + nz * (PROF - 0.03), f.yawOff),
            new THREE.Color(0x4a4d51)))
        }

        // Ar-condicionado: pendurado no peitoril, com suporte e mancha.
        if (fino && rng() < 0.2) {
          batcher.add('metal', withColor(
            place(makeBox(0.68, 0.44, 0.40, { uvScale: 1 }),
              lx + nx * (PROF + 0.16), y - winH / 2 - 0.34, lz + nz * (PROF + 0.16), f.yawOff),
            new THREE.Color(0xd8d8d4).multiplyScalar(sujo)))
          batcher.add('metal', withColor(
            place(makeBox(0.74, 0.05, 0.06, { uvScale: 1 }),
              lx + nx * (PROF + 0.30), y - winH / 2 - 0.58, lz + nz * (PROF + 0.30), f.yawOff),
            new THREE.Color(0x6e7276)))
        }
      }
    }
  }

  // Sacadas nas fachadas frontais de prédios residenciais
  if ((spec.type === 'predio' || spec.type === 'torre') && spec.floors > 2 && w > 8) {
    for (let fl = 1; fl < spec.floors; fl++) {
      if (hash2(spec.id, fl, 33) < 0.45) continue
      const y = groundH + (fl - 1) * fh + 0.12
      const bw = Math.min(w - 1.6, 4.4)
      batcher.add('concreto', withColor(place(makeBox(bw, 0.16, 1.25, { uvScale: 1.5 }), 0, y, hd + 0.6), new THREE.Color(0xd2cec5)))
      // Guarda-corpo de vidro + corrimão
      batcher.add('vidro', withColor(place(makeBox(bw, 0.95, 0.05, { uvScale: 1 }), 0, y + 0.55, hd + 1.2), glassTint))
      batcher.add('metal', withColor(place(makeBox(bw, 0.06, 0.09, { uvScale: 1 }), 0, y + 1.05, hd + 1.2), new THREE.Color(0xa8adb2)))
      batcher.add('vidro', withColor(place(makeBox(0.05, 0.95, 1.2, { uvScale: 1 }), -bw / 2, y + 0.55, hd + 0.62), glassTint))
      batcher.add('vidro', withColor(place(makeBox(0.05, 0.95, 1.2, { uvScale: 1 }), bw / 2, y + 0.55, hd + 0.62), glassTint))
    }
  }

  // Cornijas horizontais (marcação de pavimentos)
  if (spec.floors > 3) {
    for (let fl = 1; fl < spec.floors; fl += 2) {
      const y = groundH + (fl - 1) * fh
      batcher.add('concreto', withColor(
        place(makeBox(w + 0.22, 0.14, d + 0.22, { uvScale: 2 }), 0, y, 0), trim))
    }
  }

  // Faixa de base (rodapé de granito/pastilha)
  batcher.add('concreto', withColor(place(makeBox(w + 0.14, 0.75, d + 0.14, { uvScale: 1.6 }), 0, 0.37, 0),
    new THREE.Color(0x8d8880).lerp(color, 0.25)))

  void spec.zone
}

function addRoof(
  spec: BuildingSpec, batcher: GeometryBatcher, place: PlaceFn, rng: Rng, totalH: number,
): void {
  const w = spec.width, d = spec.depth
  const roofColor = new THREE.Color(spec.roofColor)
  const isHouse = ['casa', 'casaSimples', 'sobrado', 'chacara', 'quiosque'].includes(spec.type)

  if (isHouse) {
    // Telhado de duas águas em prismas escalonados (silhueta correta, barato)
    const steps = 7
    const rise = Math.min(d * 0.32, 2.6)
    for (let i = 0; i < steps; i++) {
      const t = i / steps
      const sd = d * (1 - t) + 0.9
      const sw = w + 0.9 - t * 0.25
      const y = totalH + rise * t + rise / (steps * 2)
      batcher.add('telhaCeramica', withColor(
        place(makeBox(sw, rise / steps + 0.03, sd, { uvScale: 1.15, uvOffset: [t * 0.4, 0] }), 0, y, 0),
        roofColor.clone().multiplyScalar(lerp(0.92, 1.08, t))))
    }
    // Beiral
    batcher.add('telhaCeramica', withColor(place(makeBox(w + 1.1, 0.12, d + 1.1, { uvScale: 1.15 }), 0, totalH + 0.06, 0), roofColor))
  } else {
    // Laje plana com platibanda
    const pb = 0.85
    batcher.add('concreto', withColor(place(makeBox(w + 0.2, 0.2, d + 0.2, { uvScale: 2 }), 0, totalH + 0.1, 0), new THREE.Color(0xb9b5ac)))
    for (const [sx, sz, lw, ld] of [
      [0, (d + 0.2) / 2 - 0.1, w + 0.2, 0.2],
      [0, -((d + 0.2) / 2 - 0.1), w + 0.2, 0.2],
      [(w + 0.2) / 2 - 0.1, 0, 0.2, d + 0.2],
      [-((w + 0.2) / 2 - 0.1), 0, 0.2, d + 0.2],
    ] as const) {
      batcher.add('concreto', withColor(
        place(makeBox(lw, pb, ld, { uvScale: 1.5 }), sx, totalH + 0.2 + pb / 2, sz), new THREE.Color(0xc6c2b8)))
    }
    // Equipamentos de cobertura
    if (spec.floors >= 2) {
      // Caixa d'água
      const cy = totalH + 0.2 + 1.1
      const tank = makeCylinder(Math.min(1.1, w * 0.16), 1.7, 12, 1.2)
      batcher.add('plastico', withColor(place(tank, w * 0.22, cy, -d * 0.2), new THREE.Color(0x2f4d7a)))
      // Casa de máquinas
      if (spec.floors > 4) {
        batcher.add('concreto', withColor(
          place(makeBox(Math.min(w * 0.4, 4), 2.6, Math.min(d * 0.4, 4), { uvScale: 2 }), -w * 0.18, totalH + 1.5, d * 0.12),
          new THREE.Color(0xbdb9b0)))
      }
      // Antenas
      const n = randInt(rng, 1, 3)
      for (let i = 0; i < n; i++) {
        const ax = randRange(rng, -w * 0.35, w * 0.35)
        const az = randRange(rng, -d * 0.35, d * 0.35)
        const hgt = randRange(rng, 1.2, 3.4)
        batcher.add('metal', withColor(place(makeCylinder(0.045, hgt, 6, 1), ax, totalH + 0.2 + hgt / 2, az), new THREE.Color(0x8d9298)))
      }
      // Condensadoras
      const units = randInt(rng, 0, 3)
      for (let i = 0; i < units; i++) {
        batcher.add('metal', withColor(
          place(makeBox(0.9, 0.7, 0.6, { uvScale: 1 }), randRange(rng, -w * 0.3, w * 0.3), totalH + 0.55, randRange(rng, -d * 0.3, d * 0.3)),
          new THREE.Color(0xcfd2d4)))
      }
    }
  }
}

/** Versão de baixo custo para setores distantes: apenas o volume e o telhado. */
export function buildBuildingLod(spec: BuildingSpec, batcher: GeometryBatcher): void {
  const totalH = spec.floors * spec.floorHeight
  const geo = makeBox(spec.width, totalH, spec.depth, { uvScale: 3.2, skip: new Set(['ny']) })
  transform(geo, spec.x, spec.baseY + totalH / 2, spec.z, spec.yaw)
  batcher.add('fachada', withColor(geo, new THREE.Color(spec.color).multiplyScalar(0.96)))
  const roof = makeBox(spec.width + 0.4, 0.5, spec.depth + 0.4, { uvScale: 3 })
  transform(roof, spec.x, spec.baseY + totalH + 0.25, spec.z, spec.yaw)
  batcher.add('concreto', withColor(roof, new THREE.Color(spec.roofColor).lerp(new THREE.Color(0xb9b5ac), 0.5)))
}

/**
 * Detritos e aparatos que se acumulam nas fachadas brasileiras: antenas
 * parabólicas, varais com roupa, condensadoras, caixas de luz, grades nas
 * janelas do térreo e fiação descendo a parede.
 */
function addUrbanClutter(
  spec: BuildingSpec, batcher: GeometryBatcher, place: PlaceFn, rng: Rng,
  groundH: number, totalH: number,
): void {
  const w = spec.width
  const d = spec.depth
  const hw = w / 2, hd = d / 2
  const metalCol = new THREE.Color(0x9aa0a6)
  const darkCol = new THREE.Color(0x24282c)

  // Grades de segurança nas aberturas do térreo (muito comum)
  if (rng() < 0.62 && w > 5) {
    const gw = Math.min(w - 2.0, w * 0.6)
    const bars = Math.max(3, Math.round(gw / 0.22))
    for (let i = 0; i < bars; i++) {
      const gx = -gw / 2 + (gw * i) / (bars - 1)
      batcher.add('grade', withColor(
        place(makeBox(0.035, 1.9, 0.035, { uvScale: 0.4 }), gx, 1.05, hd + 0.14), darkCol))
    }
    batcher.add('grade', withColor(place(makeBox(gw, 0.05, 0.05, { uvScale: 0.4 }), 0, 2.02, hd + 0.14), darkCol))
    batcher.add('grade', withColor(place(makeBox(gw, 0.05, 0.05, { uvScale: 0.4 }), 0, 0.12, hd + 0.14), darkCol))
  }

  // Caixa de força e relógio de luz junto à porta
  batcher.add('metalPintado', withColor(
    place(makeBox(0.36, 0.5, 0.16, { uvScale: 0.5 }), Math.min(hw - 0.5, DOOR_W / 2 + 0.7), 1.55, hd + 0.08),
    new THREE.Color(0xb8b4aa)))

  // Fiação descendo pela fachada até o poste
  if (rng() < 0.7) {
    const startY = Math.min(totalH - 0.4, groundH + 2.6)
    const segs = 5
    for (let i = 0; i < segs; i++) {
      const y0 = startY - (startY - 2.6) * (i / segs)
      const y1 = startY - (startY - 2.6) * ((i + 1) / segs)
      const mid = (y0 + y1) / 2
      const len = Math.abs(y0 - y1) + 0.02
      batcher.add('borracha', withColor(
        place(makeBox(0.035, len, 0.035, { uvScale: 0.3 }), hw - 0.5, mid, hd + 0.06), darkCol))
    }
  }

  // Antenas parabólicas e varais nas sacadas / janelas
  const floors = spec.floors
  for (let fl = 1; fl < floors; fl++) {
    const y = groundH + (fl - 1) * spec.floorHeight + spec.floorHeight * 0.55
    if (rng() < 0.18) {
      // Parabólica
      const dish = new THREE.SphereGeometry(0.34, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.42)
      const uvc = dish.attributes.position.count
      const uv = new Float32Array(uvc * 2)
      for (let i = 0; i < uvc; i++) { uv[i * 2] = rng(); uv[i * 2 + 1] = rng() }
      dish.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
      dish.rotateX(Math.PI * 0.62)
      const dx = (rng() - 0.5) * (w - 1.4)
      batcher.add('plastico', withColor(place(dish, dx, y, hd + 0.34), new THREE.Color(0xd8d5cd)))
      batcher.add('metal', withColor(place(makeBox(0.06, 0.06, 0.4, { uvScale: 0.3 }), dx, y - 0.1, hd + 0.16), metalCol))
    }
    if (rng() < 0.22) {
      // Varal com roupas
      const lx = (rng() - 0.5) * (w - 2.4)
      const lineW = Math.min(w - 1.6, 2.6)
      batcher.add('borracha', withColor(
        place(makeBox(lineW, 0.03, 0.03, { uvScale: 0.3 }), lx, y + 0.5, hd + 0.5), darkCol))
      const pieces = randInt(rng, 2, 5)
      for (let i = 0; i < pieces; i++) {
        const px = lx - lineW / 2 + (lineW * (i + 0.5)) / pieces
        const ph = randRange(rng, 0.35, 0.7)
        batcher.add('toldo', withColor(
          place(makeBox(randRange(rng, 0.26, 0.45), ph, 0.02, { uvScale: 0.5 }), px, y + 0.5 - ph / 2, hd + 0.5),
          new THREE.Color(pick(rng, PALETTE.roupas)).lerp(new THREE.Color(0xffffff), 0.25)))
      }
      // Suportes do varal
      batcher.add('metal', withColor(place(makeBox(0.04, 0.04, 0.5, { uvScale: 0.3 }), lx - lineW / 2, y + 0.5, hd + 0.26), metalCol))
      batcher.add('metal', withColor(place(makeBox(0.04, 0.04, 0.5, { uvScale: 0.3 }), lx + lineW / 2, y + 0.5, hd + 0.26), metalCol))
    }
  }

  // Marquise sobre a porta em casas e sobrados
  if (['casa', 'casaSimples', 'sobrado', 'chacara'].includes(spec.type)) {
    batcher.add('concreto', withColor(
      place(makeBox(DOOR_W + 1.3, 0.1, 1.0, { uvScale: 1 }), 0, DOOR_H + 0.35, hd + 0.5),
      new THREE.Color(0xd8d4ca)))
  }
}
