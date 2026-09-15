/**
 * Malha viária construída: asfalto, sinalização horizontal, calçadas elevadas,
 * meios-fios, faixas de pedestre, canteiros centrais e pontes sobre o rio.
 */

import * as THREE from 'three'
import { clamp, makeRng } from '../core/math'
import { GeometryBatcher, makeBox, makeRibbon, transform, withColor } from './geometry'
import { CityLayout, SIDEWALK, type RoadLine } from './layout'
import { terrainHeight, WATER_LEVEL } from './terrain'
import type { CollisionWorld } from './collision'
import { addSign, addTrafficLight, decorateSidewalk, type PropContext, type TrafficLightHandle } from './props'

const ASFALTO = new THREE.Color(0xffffff)
const FAIXA_BRANCA = new THREE.Color(0xe9e6de)
const FAIXA_AMARELA = new THREE.Color(0xd8b23a)
const CALCADA = new THREE.Color(0xffffff)
const MEIO_FIO = new THREE.Color(0xd6d2c8)

export const CURB_HEIGHT = 0.15
const ROAD_LIFT = 0.035

/** Altura do tabuleiro da ponte num ponto do vão. */
function bridgeDeckHeight(): number { return WATER_LEVEL + 5.6 }

interface SectorBounds { x0: number; z0: number; x1: number; z1: number }

/** Interseção de dois intervalos. */
function clipSpan(a: [number, number], b: [number, number]): [number, number] | null {
  const lo = Math.max(a[0], b[0])
  const hi = Math.min(a[1], b[1])
  return hi - lo > 1 ? [lo, hi] : null
}

function pointsAlong(line: RoadLine, from: number, to: number, step: number): { x: number; z: number }[] {
  const pts: { x: number; z: number }[] = []
  const n = Math.max(1, Math.ceil((to - from) / step))
  for (let i = 0; i <= n; i++) {
    const t = from + ((to - from) * i) / n
    pts.push(line.axis === 'x' ? { x: line.pos, z: t } : { x: t, z: line.pos })
  }
  return pts
}

/** Altura da via considerando pontes. */
function roadHeight(line: RoadLine, x: number, z: number): number {
  const t = line.axis === 'x' ? z : x
  for (const [a, b] of line.bridges) {
    if (t >= a && t <= b) {
      const deck = bridgeDeckHeight()
      const edgeFade = clamp(Math.min(t - a, b - t) / 16, 0, 1)
      return Math.max(terrainHeight(x, z), terrainHeight(x, z) * (1 - edgeFade) + deck * edgeFade)
    }
  }
  return terrainHeight(x, z)
}

export interface RoadBuildResult {
  trafficLights: TrafficLightHandle[]
}

export function buildRoadsForSector(
  layout: CityLayout,
  bounds: SectorBounds,
  batcher: GeometryBatcher,
  collision: CollisionWorld,
  owner: string,
  propCtx: PropContext,
  detail: 'alto' | 'baixo',
): RoadBuildResult {
  const trafficLights: TrafficLightHandle[] = []
  const rng = makeRng(Math.round(bounds.x0 * 131 + bounds.z0 * 977) >>> 0)

  const lines = layout.linesInRect(bounds.x0, bounds.z0, bounds.x1, bounds.z1)
  for (const line of lines) {
    const axisMin = line.axis === 'x' ? bounds.z0 : bounds.x0
    const axisMax = line.axis === 'x' ? bounds.z1 : bounds.x1
    const posInSector = line.axis === 'x'
      ? line.pos >= bounds.x0 - 20 && line.pos <= bounds.x1 + 20
      : line.pos >= bounds.z0 - 20 && line.pos <= bounds.z1 + 20
    if (!posInSector) continue

    const hw = CityLayout.halfWidth(line)
    for (const span of line.spans) {
      const clipped = clipSpan(span, [axisMin - 2, axisMax + 2])
      if (!clipped) continue
      const pts = pointsAlong(line, clipped[0], clipped[1], 8)
      const h = (x: number, z: number) => roadHeight(line, x, z)

      // Pista
      const road = makeRibbon(pts, hw, h, 6, ROAD_LIFT)
      if (road) batcher.add('asfalto', withColor(road, ASFALTO))

      // Calçadas elevadas dos dois lados
      for (const side of [1, -1]) {
        const offPts = pts.map((p) => line.axis === 'x'
          ? { x: p.x + side * (hw + SIDEWALK / 2), z: p.z }
          : { x: p.x, z: p.z + side * (hw + SIDEWALK / 2) })
        const walk = makeRibbon(offPts, SIDEWALK / 2, h, 3, ROAD_LIFT + CURB_HEIGHT)
        if (walk) batcher.add('calcada', withColor(walk, CALCADA))

        // Meio-fio: faixa vertical no limite da pista
        const curbPts = pts.map((p) => line.axis === 'x'
          ? { x: p.x + side * hw, z: p.z }
          : { x: p.x, z: p.z + side * hw })
        const curb = makeRibbon(curbPts, 0.12, (x, z) => h(x, z) + CURB_HEIGHT / 2, 1.5, ROAD_LIFT)
        if (curb) batcher.add('meioFio', withColor(curb, MEIO_FIO))

        // Colisor de degrau: permite subir na calçada e impede atravessar de carro
        const segLen = clipped[1] - clipped[0]
        const midT = (clipped[0] + clipped[1]) / 2
        const cx = line.axis === 'x' ? line.pos + side * (hw + SIDEWALK / 2) : midT
        const cz = line.axis === 'x' ? midT : line.pos + side * (hw + SIDEWALK / 2)
        const cy = h(cx, cz)
        collision.add(
          { x: cx, y: cy + CURB_HEIGHT / 2 + ROAD_LIFT, z: cz },
          line.axis === 'x'
            ? { x: SIDEWALK / 2, y: CURB_HEIGHT / 2 + 0.02, z: segLen / 2 }
            : { x: segLen / 2, y: CURB_HEIGHT / 2 + 0.02, z: SIDEWALK / 2 },
          0, 'prop', owner, { solid: false, walkable: true },
        )

        // Mobiliário urbano na calçada
        if (detail === 'alto') {
          const a = line.axis === 'x' ? { x: line.pos + side * (hw + SIDEWALK), z: clipped[0] } : { x: clipped[0], z: line.pos + side * (hw + SIDEWALK) }
          const b = line.axis === 'x' ? { x: line.pos + side * (hw + SIDEWALK), z: clipped[1] } : { x: clipped[1], z: line.pos + side * (hw + SIDEWALK) }
          const nx = line.axis === 'x' ? side : 0
          const nz = line.axis === 'x' ? 0 : side
          decorateSide(propCtx, a, b, nx, nz, line, rng())
        }
      }

      if (detail === 'alto') {
        addMarkings(line, clipped, hw, batcher, h)
        addBridge(line, clipped, hw, batcher, collision, owner)
      }
    }
  }

  // Semáforos e faixas de pedestres nos cruzamentos de avenidas
  if (detail === 'alto') {
    for (const lx of layout.xLines) {
      if (lx.pos < bounds.x0 || lx.pos >= bounds.x1) continue
      for (const lz of layout.zLines) {
        if (lz.pos < bounds.z0 || lz.pos >= bounds.z1) continue
        if (!CityLayout.hasSpanAt(lx, lz.pos) || !CityLayout.hasSpanAt(lz, lx.pos)) continue
        const bigX = lx.avenue
        const bigZ = lz.avenue
        const hwx = CityLayout.halfWidth(lx)
        const hwz = CityLayout.halfWidth(lz)
        addCrosswalks(lx.pos, lz.pos, hwx, hwz, batcher)
        if (bigX || bigZ) {
          for (const [sx, sz, phase] of [
            [1, 1, 0], [-1, -1, 0], [1, -1, 1], [-1, 1, 1],
          ] as const) {
            const px = lx.pos + sx * (hwx + 1.6)
            const pz = lz.pos + sz * (hwz + 1.6)
            const yaw = Math.atan2(-sx, -sz)
            trafficLights.push(addTrafficLight(propCtx, px, pz, yaw, phase as 0 | 1))
          }
        } else if (Math.random() < 0) {
          // reservado
        } else {
          const px = lx.pos + (hwx + 1.4)
          const pz = lz.pos + (hwz + 1.4)
          addSign(propCtx, px, pz, Math.atan2(-1, -1), 'pare')
        }
      }
    }
  }

  return { trafficLights }
}

function decorateSide(
  ctx: PropContext,
  a: { x: number; z: number }, b: { x: number; z: number },
  nx: number, nz: number, line: RoadLine, seed: number,
): void {
  decorateSidewalk(ctx, a.x, a.z, b.x, b.z, nx, nz, line.avenue ? 1 : 0.7, 0.8, Math.floor(seed * 1e9))
}

function addMarkings(
  line: RoadLine, span: [number, number], hw: number,
  batcher: GeometryBatcher, h: (x: number, z: number) => number,
): void {
  const isAvenue = line.avenue
  const step = 4.5
  const dashLen = 2.4
  const n = Math.floor((span[1] - span[0]) / step)

  if (isAvenue) {
    // Canteiro central estreito com faixa dupla amarela
    for (const off of [-0.35, 0.35]) {
      const pts = pointsAlong(line, span[0], span[1], 10).map((p) => line.axis === 'x'
        ? { x: p.x + off, z: p.z } : { x: p.x, z: p.z + off })
      const g = makeRibbon(pts, 0.09, h, 2, ROAD_LIFT + 0.012)
      if (g) batcher.add('faixa', withColor(g, FAIXA_AMARELA))
    }
    // Faixas divisórias de pista (tracejado branco)
    for (const off of [-hw * 0.5, hw * 0.5]) {
      for (let i = 0; i < n; i++) {
        const t = span[0] + i * step
        const x = line.axis === 'x' ? line.pos + off : t + dashLen / 2
        const z = line.axis === 'x' ? t + dashLen / 2 : line.pos + off
        const g = makeBox(line.axis === 'x' ? 0.14 : dashLen, 0.02, line.axis === 'x' ? dashLen : 0.14, { uvScale: 1 })
        batcher.add('faixa', withColor(transform(g, x, h(x, z) + ROAD_LIFT + 0.012, z), FAIXA_BRANCA))
      }
    }
  } else {
    for (let i = 0; i < n; i++) {
      const t = span[0] + i * step
      const x = line.axis === 'x' ? line.pos : t + dashLen / 2
      const z = line.axis === 'x' ? t + dashLen / 2 : line.pos
      const g = makeBox(line.axis === 'x' ? 0.13 : dashLen, 0.02, line.axis === 'x' ? dashLen : 0.13, { uvScale: 1 })
      batcher.add('faixa', withColor(transform(g, x, h(x, z) + ROAD_LIFT + 0.012, z), FAIXA_BRANCA))
    }
  }

  // Linha de bordo contínua
  for (const side of [-1, 1]) {
    const off = side * (hw - 0.35)
    const pts = pointsAlong(line, span[0], span[1], 10).map((p) => line.axis === 'x'
      ? { x: p.x + off, z: p.z } : { x: p.x, z: p.z + off })
    const g = makeRibbon(pts, 0.07, h, 2, ROAD_LIFT + 0.01)
    if (g) batcher.add('faixa', withColor(g, FAIXA_BRANCA))
  }
}

function addCrosswalks(
  cx: number, cz: number, hwx: number, hwz: number, batcher: GeometryBatcher,
): void {
  const stripeW = 0.45
  const gap = 0.42
  // Faixas atravessando a via vertical (linha X), posicionadas ao norte/sul
  for (const side of [-1, 1]) {
    const zPos = cz + side * (hwz + 1.4)
    const count = Math.floor((hwx * 2 - 0.6) / (stripeW + gap))
    for (let i = 0; i < count; i++) {
      const x = cx - hwx + 0.5 + i * (stripeW + gap)
      const g = makeBox(stripeW, 0.02, 2.6, { uvScale: 1 })
      batcher.add('faixa', withColor(transform(g, x, terrainHeight(x, zPos) + ROAD_LIFT + 0.013, zPos), FAIXA_BRANCA))
    }
  }
  for (const side of [-1, 1]) {
    const xPos = cx + side * (hwx + 1.4)
    const count = Math.floor((hwz * 2 - 0.6) / (stripeW + gap))
    for (let i = 0; i < count; i++) {
      const z = cz - hwz + 0.5 + i * (stripeW + gap)
      const g = makeBox(2.6, 0.02, stripeW, { uvScale: 1 })
      batcher.add('faixa', withColor(transform(g, xPos, terrainHeight(xPos, z) + ROAD_LIFT + 0.013, z), FAIXA_BRANCA))
    }
  }
}

function addBridge(
  line: RoadLine, span: [number, number], hw: number,
  batcher: GeometryBatcher, collision: CollisionWorld, owner: string,
): void {
  for (const bridge of line.bridges) {
    const clipped = clipSpan(bridge, span)
    if (!clipped) continue
    const deck = bridgeDeckHeight()
    const len = clipped[1] - clipped[0]
    const midT = (clipped[0] + clipped[1]) / 2
    const cx = line.axis === 'x' ? line.pos : midT
    const cz = line.axis === 'x' ? midT : line.pos

    // Estrutura do tabuleiro
    const deckGeo = makeBox(
      line.axis === 'x' ? hw * 2 + SIDEWALK * 2 : len, 0.9,
      line.axis === 'x' ? len : hw * 2 + SIDEWALK * 2, { uvScale: 3 })
    batcher.add('concreto', withColor(transform(deckGeo, cx, deck - 0.5, cz), new THREE.Color(0xb6b2a8)))
    collision.add({ x: cx, y: deck - 0.5, z: cz },
      line.axis === 'x'
        ? { x: hw + SIDEWALK, y: 0.5, z: len / 2 }
        : { x: len / 2, y: 0.5, z: hw + SIDEWALK },
      0, 'ponte', owner, { solid: false, walkable: true })

    // Guarda-corpos
    for (const side of [-1, 1]) {
      const gx = line.axis === 'x' ? line.pos + side * (hw + SIDEWALK) : midT
      const gz = line.axis === 'x' ? midT : line.pos + side * (hw + SIDEWALK)
      const g = makeBox(
        line.axis === 'x' ? 0.24 : len, 1.15,
        line.axis === 'x' ? len : 0.24, { uvScale: 2 })
      batcher.add('concreto', withColor(transform(g, gx, deck + 0.6, gz), new THREE.Color(0xc8c4ba)))
      collision.add({ x: gx, y: deck + 0.6, z: gz },
        line.axis === 'x' ? { x: 0.14, y: 0.6, z: len / 2 } : { x: len / 2, y: 0.6, z: 0.14 },
        0, 'ponte', owner)
    }

    // Pilares
    const piers = Math.max(2, Math.round(len / 22))
    for (let i = 1; i < piers; i++) {
      const t = clipped[0] + (len * i) / piers
      const px = line.axis === 'x' ? line.pos : t
      const pz = line.axis === 'x' ? t : line.pos
      const base = terrainHeight(px, pz)
      const hgt = Math.max(1, deck - 0.9 - base)
      batcher.add('concreto', withColor(
        transform(makeBox(2.2, hgt, 2.2, { uvScale: 2 }), px, base + hgt / 2, pz),
        new THREE.Color(0xa9a59c)))
    }
  }
}
