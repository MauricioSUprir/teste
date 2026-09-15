/**
 * Traçado urbano de Vila Preciosa: malha viária, quadras, zonas e pontes.
 *
 * A malha é uma grade irregular (espaçamentos variáveis) cortada pelo rio,
 * pelos parques e pela zona rural, com avenidas a cada poucas linhas e uma
 * marginal acompanhando o rio. Tudo é determinístico a partir de uma semente.
 */

import { hash2, makeRng, pick, type Rng } from '../core/math'
import { isInRiverCorridor, MAP_HALF, riverDistance, terrainSlope } from './terrain'

export type Zone =
  | 'centro' | 'comercio' | 'residencial' | 'condominio' | 'esportivo'
  | 'orla' | 'parque' | 'periferia' | 'rural' | 'industrial'

export const CITY_SEED = 20260915

export interface RoadLine {
  /** Coordenada fixa da linha (x para linhas verticais, z para horizontais). */
  pos: number
  axis: 'x' | 'z'
  avenue: boolean
  /** Índice sequencial na direção. */
  index: number
  name: string
  /** Trechos válidos ao longo do eixo livre [de, ate]. */
  spans: [number, number][]
  /** Trechos que são ponte sobre o rio. */
  bridges: [number, number][]
}

export interface Block {
  id: number
  x0: number; z0: number; x1: number; z1: number
  cx: number; cz: number
  width: number; depth: number
  zone: Zone
  kind: BlockKind
}

export type BlockKind =
  | 'edificado' | 'praca' | 'campo' | 'quadra' | 'estacionamento'
  | 'parque' | 'vazio' | 'arena'

export const ROAD_HALF = { rua: 4.6, avenida: 8.4 }
export const SIDEWALK = 3.2

const AVENUE_NAMES = [
  'Av. das Palmeiras', 'Av. Rio Claro', 'Av. Central', 'Av. dos Ipês',
  'Av. Marechal', 'Av. Boa Vista', 'Av. Perimetral', 'Av. do Trabalhador',
]
const STREET_NAMES = [
  'R. das Acácias', 'R. Bento Freire', 'R. do Sol', 'R. Nova Esperança',
  'R. Maranhão', 'R. Cel. Osório', 'R. da Lapa', 'R. Iracema', 'R. dos Andradas',
  'R. Tiradentes', 'R. Aurora', 'R. Serra Azul', 'R. das Oliveiras', 'R. Bandeirantes',
  'R. do Comércio', 'R. Paraguaçu', 'R. Genipapo', 'R. Ipiranga', 'R. Juazeiro',
  'R. Campo Belo', 'R. Santa Rita', 'R. Ribeirão', 'R. das Gaivotas', 'R. Nazaré',
]

interface DistrictDef {
  name: string
  zone: Zone
  cx: number; cz: number; rx: number; rz: number
  priority: number
}

export const DISTRICTS: DistrictDef[] = [
  { name: 'Centro', zone: 'centro', cx: 0, cz: -160, rx: 250, rz: 220, priority: 10 },
  { name: 'Baixo Comércio', zone: 'comercio', cx: 0, cz: -160, rx: 400, rz: 340, priority: 4 },
  { name: 'Vila Aurora', zone: 'residencial', cx: -430, cz: -430, rx: 280, rz: 250, priority: 8 },
  { name: 'Alto da Pedreira', zone: 'condominio', cx: 440, cz: -470, rx: 270, rz: 240, priority: 8 },
  { name: 'Campo Grande', zone: 'esportivo', cx: 520, cz: 330, rx: 270, rz: 240, priority: 8 },
  { name: 'Parque da Enseada', zone: 'parque', cx: -40, cz: 540, rx: 300, rz: 190, priority: 9 },
  { name: 'Distrito Ferroviário', zone: 'industrial', cx: -660, cz: -60, rx: 200, rz: 190, priority: 8 },
]

export function districtAt(x: number, z: number): string {
  let best = 'Periferia'
  let bestPriority = -1
  for (const d of DISTRICTS) {
    const q = Math.max(Math.abs(x - d.cx) / d.rx, Math.abs(z - d.cz) / d.rz)
    if (q <= 1 && d.priority > bestPriority) { best = d.name; bestPriority = d.priority }
  }
  if (bestPriority < 0) {
    if (isInRiverCorridor(x, z, 70)) return 'Beira do Sanhaço'
    const r = Math.max(Math.abs(x), Math.abs(z))
    if (r > 840) return 'Estrada do Contorno'
    return 'Periferia'
  }
  return best
}

export function zoneAt(x: number, z: number): Zone {
  const r = Math.max(Math.abs(x), Math.abs(z))
  if (r > 860) return 'rural'

  let best: Zone | null = null
  let bestPriority = -1
  for (const d of DISTRICTS) {
    const q = Math.max(Math.abs(x - d.cx) / d.rx, Math.abs(z - d.cz) / d.rz)
    if (q <= 1 && d.priority > bestPriority) { best = d.zone; bestPriority = d.priority }
  }
  // A faixa junto ao rio é sempre orla (calçadão, quiosques, ciclovia).
  if (riverDistance(x, z) < 72 && best !== 'parque') return 'orla'
  if (best) return best
  if (r > 660) return 'periferia'
  return 'residencial'
}

/** Espaçamentos por zona (metros entre eixos de rua). */
function spacingFor(rng: Rng, coord: number): number {
  const absc = Math.abs(coord)
  if (absc < 260) return 52 + rng() * 22      // centro: quadras curtas
  if (absc < 560) return 62 + rng() * 34      // bairros
  if (absc < 820) return 84 + rng() * 52      // periferia
  return 140 + rng() * 120                    // rural
}

export class CityLayout {
  readonly xLines: RoadLine[] = []
  readonly zLines: RoadLine[] = []
  readonly blocks: Block[] = []
  /** Índice espacial de quadras por célula de 128 m. */
  private blockGrid = new Map<string, Block[]>()
  private readonly rng: Rng

  constructor(seed = CITY_SEED) {
    this.rng = makeRng(seed)
    this.buildLines()
    this.buildBlocks()
  }

  private buildLines(): void {
    const mkLines = (axis: 'x' | 'z'): RoadLine[] => {
      const out: RoadLine[] = []
      let p = -MAP_HALF - 40
      let i = 0
      const nameRng = makeRng(axis === 'x' ? 9111 : 5333)
      while (p < MAP_HALF + 40) {
        const avenue = i % 5 === 2
        const name = avenue ? pick(nameRng, AVENUE_NAMES) : pick(nameRng, STREET_NAMES)
        out.push({ pos: p, axis, avenue, index: i, name, spans: [], bridges: [] })
        p += spacingFor(this.rng, p) * (avenue ? 1.05 : 1)
        i++
      }
      return out
    }
    this.xLines.push(...mkLines('x'))
    this.zLines.push(...mkLines('z'))
    for (const l of this.xLines) this.computeSpans(l)
    for (const l of this.zLines) this.computeSpans(l)
  }

  /**
   * Calcula os trechos válidos da linha: corta onde atravessa água sem ponte,
   * onde o declive é impraticável e fora dos limites do mapa.
   */
  private computeSpans(line: RoadLine): void {
    const STEP = 8
    const from = -MAP_HALF
    const to = MAP_HALF
    let spanStart: number | null = null
    let bridgeStart: number | null = null
    const canBridge = line.avenue || hash2(line.index, line.axis === 'x' ? 1 : 2, 404) > 0.62

    for (let t = from; t <= to; t += STEP) {
      const x = line.axis === 'x' ? line.pos : t
      const z = line.axis === 'x' ? t : line.pos
      const overWater = isInRiverCorridor(x, z, 6)
      const steep = terrainSlope(x, z) > 26
      const zone = zoneAt(x, z)
      const forbidden = (overWater && !canBridge) || steep || zone === 'parque'

      if (!forbidden) {
        if (spanStart === null) spanStart = t
        if (overWater && canBridge) { if (bridgeStart === null) bridgeStart = t }
        else if (bridgeStart !== null) { line.bridges.push([bridgeStart - 14, t + 14]); bridgeStart = null }
      } else {
        if (bridgeStart !== null) { line.bridges.push([bridgeStart - 14, t + 14]); bridgeStart = null }
        if (spanStart !== null) {
          if (t - spanStart > 40) line.spans.push([spanStart, t - STEP])
          spanStart = null
        }
      }
    }
    if (bridgeStart !== null) line.bridges.push([bridgeStart - 14, to])
    if (spanStart !== null && to - spanStart > 40) line.spans.push([spanStart, to])
  }

  private buildBlocks(): void {
    let id = 0
    for (let i = 0; i < this.xLines.length - 1; i++) {
      for (let j = 0; j < this.zLines.length - 1; j++) {
        const a = this.xLines[i], b = this.xLines[i + 1]
        const c = this.zLines[j], d = this.zLines[j + 1]
        const insetA = (a.avenue ? ROAD_HALF.avenida : ROAD_HALF.rua) + SIDEWALK
        const insetB = (b.avenue ? ROAD_HALF.avenida : ROAD_HALF.rua) + SIDEWALK
        const insetC = (c.avenue ? ROAD_HALF.avenida : ROAD_HALF.rua) + SIDEWALK
        const insetD = (d.avenue ? ROAD_HALF.avenida : ROAD_HALF.rua) + SIDEWALK
        const x0 = a.pos + insetA, x1 = b.pos - insetB
        const z0 = c.pos + insetC, z1 = d.pos - insetD
        const width = x1 - x0
        const depth = z1 - z0
        if (width < 16 || depth < 16) continue
        const cx = (x0 + x1) / 2
        const cz = (z0 + z1) / 2
        if (Math.abs(cx) > MAP_HALF || Math.abs(cz) > MAP_HALF) continue

        const zone = zoneAt(cx, cz)
        const kind = this.blockKind(zone, cx, cz, width, depth)
        const block: Block = { id: id++, x0, z0, x1, z1, cx, cz, width, depth, zone, kind }
        this.blocks.push(block)
        const key = cellKey(cx, cz)
        const arr = this.blockGrid.get(key)
        if (arr) arr.push(block)
        else this.blockGrid.set(key, [block])
      }
    }
  }

  private blockKind(zone: Zone, cx: number, cz: number, w: number, d: number): BlockKind {
    if (isInRiverCorridor(cx, cz, 10)) return 'vazio'
    const slope = terrainSlope(cx, cz)
    if (slope > 22) return 'vazio'
    const h = hash2(Math.round(cx), Math.round(cz), 7331)

    switch (zone) {
      case 'parque':
        return 'parque'
      case 'esportivo':
        if (w > 105 && d > 70 && h > 0.72) return 'arena'
        if (w > 78 && d > 52) return h > 0.34 ? 'campo' : 'quadra'
        return h > 0.72 ? 'praca' : 'edificado'
      case 'centro':
        if (h > 0.93) return 'praca'
        if (h > 0.87) return 'estacionamento'
        return 'edificado'
      case 'comercio':
        if (h > 0.92) return 'praca'
        if (h > 0.87) return 'estacionamento'
        return 'edificado'
      case 'orla':
        if (h > 0.55) return 'praca'
        return 'edificado'
      case 'residencial':
        if (h > 0.94) return 'praca'
        if (h > 0.90 && w > 70 && d > 50) return 'quadra'
        return 'edificado'
      case 'periferia':
        if (h > 0.90 && w > 70 && d > 50) return 'campo'
        if (h > 0.84) return 'praca'
        return 'edificado'
      case 'rural':
        if (h > 0.30) return 'vazio'
        return 'edificado'
      default:
        return h > 0.95 ? 'praca' : 'edificado'
    }
  }

  blocksNear(x: number, z: number, radius: number): Block[] {
    const out: Block[] = []
    const r = Math.ceil(radius / 128)
    const bx = Math.floor(x / 128)
    const bz = Math.floor(z / 128)
    for (let i = -r; i <= r; i++) {
      for (let j = -r; j <= r; j++) {
        const arr = this.blockGrid.get(`${bx + i},${bz + j}`)
        if (arr) out.push(...arr)
      }
    }
    return out
  }

  blocksInRect(x0: number, z0: number, x1: number, z1: number): Block[] {
    const out: Block[] = []
    for (let bx = Math.floor(x0 / 128); bx <= Math.floor(x1 / 128); bx++) {
      for (let bz = Math.floor(z0 / 128); bz <= Math.floor(z1 / 128); bz++) {
        const arr = this.blockGrid.get(`${bx},${bz}`)
        if (!arr) continue
        for (const b of arr) {
          if (b.cx >= x0 && b.cx < x1 && b.cz >= z0 && b.cz < z1) out.push(b)
        }
      }
    }
    return out
  }

  /** Linhas viárias que cruzam um retângulo. */
  linesInRect(x0: number, z0: number, x1: number, z1: number): RoadLine[] {
    const out: RoadLine[] = []
    for (const l of this.xLines) if (l.pos >= x0 - 30 && l.pos <= x1 + 30) out.push(l)
    for (const l of this.zLines) if (l.pos >= z0 - 30 && l.pos <= z1 + 30) out.push(l)
    return out
  }

  /** Metade da largura da pista de uma linha. */
  static halfWidth(line: RoadLine): number {
    return line.avenue ? ROAD_HALF.avenida : ROAD_HALF.rua
  }

  /** Verifica se a linha existe (tem trecho) na coordenada dada. */
  static hasSpanAt(line: RoadLine, t: number): boolean {
    return line.spans.some(([a, b]) => t >= a && t <= b)
  }

  static isBridgeAt(line: RoadLine, t: number): boolean {
    return line.bridges.some(([a, b]) => t >= a && t <= b)
  }

  /** Distância até o eixo viário mais próximo e a linha correspondente. */
  nearestRoad(x: number, z: number): { line: RoadLine; t: number; dist: number } | null {
    let best: { line: RoadLine; t: number; dist: number } | null = null
    for (const l of this.xLines) {
      const d = Math.abs(x - l.pos)
      if (d > 60) continue
      if (!CityLayout.hasSpanAt(l, z)) continue
      if (!best || d < best.dist) best = { line: l, t: z, dist: d }
    }
    for (const l of this.zLines) {
      const d = Math.abs(z - l.pos)
      if (d > 60) continue
      if (!CityLayout.hasSpanAt(l, x)) continue
      if (!best || d < best.dist) best = { line: l, t: x, dist: d }
    }
    return best
  }

  /** True se o ponto está sobre asfalto. */
  isOnRoad(x: number, z: number): boolean {
    const n = this.nearestRoad(x, z)
    return !!n && n.dist <= CityLayout.halfWidth(n.line)
  }

  /** True se o ponto está sobre calçada. */
  isOnSidewalk(x: number, z: number): boolean {
    const n = this.nearestRoad(x, z)
    if (!n) return false
    const hw = CityLayout.halfWidth(n.line)
    return n.dist > hw && n.dist <= hw + SIDEWALK
  }
}

function cellKey(x: number, z: number): string {
  return `${Math.floor(x / 128)},${Math.floor(z / 128)}`
}
