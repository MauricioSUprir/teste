/**
 * Relevo da cidade: campo de altura analítico (determinístico), vale do rio,
 * platôs urbanos e malha em pedaços com nível de detalhe.
 *
 * O relevo é uma função pura h(x,z): qualquer sistema (carros, bots, futebol)
 * consulta a mesma altura sem depender da malha carregada.
 */

import * as THREE from 'three'
import { clamp, fbm2, lerp, smoothstep } from '../core/math'

export const MAP_HALF = 1024 // mapa de 2048 x 2048 metros
export const WATER_LEVEL = 1.2

/** Eixo do rio: polilinha suave atravessando o mapa na diagonal. */
const RIVER_POINTS: readonly [number, number][] = [
  [-1100, 470], [-760, 400], [-470, 300], [-230, 205], [10, 130],
  [250, 40], [470, -70], [700, -150], [980, -190], [1150, -205],
]

const RIVER_HALF_WIDTH = 26
const RIVER_BANK = 44
const RIVER_DEPTH = 5.4

/** Distância (aproximada) de um ponto ao eixo do rio e posição ao longo dele. */
export function riverDistance(x: number, z: number): number {
  let best = Infinity
  for (let i = 0; i < RIVER_POINTS.length - 1; i++) {
    const [ax, az] = RIVER_POINTS[i]
    const [bx, bz] = RIVER_POINTS[i + 1]
    const dx = bx - ax
    const dz = bz - az
    const len2 = dx * dx + dz * dz
    let t = ((x - ax) * dx + (z - az) * dz) / len2
    t = clamp(t, 0, 1)
    const px = ax + dx * t
    const pz = az + dz * t
    const d = Math.hypot(x - px, z - pz)
    if (d < best) best = d
  }
  return best
}

/** Regiões planas (praças, campos, centro) que recebem platô. */
interface Plateau { x: number; z: number; rx: number; rz: number; height: number; falloff: number }

const PLATEAUS: Plateau[] = [
  { x: 0, z: -140, rx: 300, rz: 260, height: 6.5, falloff: 130 },   // Centro
  { x: -420, z: -420, rx: 240, rz: 200, height: 9.0, falloff: 120 }, // Vila Aurora
  { x: 430, z: -470, rx: 250, rz: 220, height: 11.5, falloff: 130 }, // Alto da Pedreira
  { x: -520, z: 260, rx: 220, rz: 170, height: 4.2, falloff: 110 },  // Orla oeste
  { x: 520, z: 330, rx: 260, rz: 220, height: 5.0, falloff: 120 },   // Bairro esportivo
  { x: -30, z: 520, rx: 300, rz: 200, height: 4.6, falloff: 140 },   // Parque da Enseada
]

/** Altura do terreno em metros. Função pura e determinística. */
export function terrainHeight(x: number, z: number): number {
  // Relevo base: colinas suaves, mais fortes nas bordas (periferia/rural).
  const edge = smoothstep(560, 1050, Math.max(Math.abs(x), Math.abs(z)))
  const hills = fbm2(x * 0.0016, z * 0.0016, 4, 101) - 0.5
  const detail = fbm2(x * 0.0085, z * 0.0085, 3, 307) - 0.5
  let h = 9 + hills * 26 * (0.42 + edge * 1.35) + detail * 2.4 * (0.3 + edge)

  // Platôs urbanos: achatam e nivelam bairros.
  for (const p of PLATEAUS) {
    const d = Math.max(Math.abs(x - p.x) / p.rx, Math.abs(z - p.z) / p.rz)
    const w = 1 - smoothstep(1, 1 + p.falloff / Math.max(p.rx, p.rz), d)
    if (w > 0) h = lerp(h, p.height, w * w * (3 - 2 * w))
  }

  // Vale do rio: rampa suave até o leito.
  const rd = riverDistance(x, z)
  if (rd < RIVER_BANK * 3) {
    const valley = 1 - smoothstep(RIVER_HALF_WIDTH, RIVER_BANK * 2.4, rd)
    const bed = 1 - smoothstep(0, RIVER_HALF_WIDTH * 1.15, rd)
    h -= valley * 2.6
    h = lerp(h, WATER_LEVEL - RIVER_DEPTH, bed * 0.96)
  }

  return h
}

/** Normal do terreno por diferenças centrais. */
export function terrainNormal(x: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
  const e = 1.2
  const hl = terrainHeight(x - e, z)
  const hr = terrainHeight(x + e, z)
  const hd = terrainHeight(x, z - e)
  const hu = terrainHeight(x, z + e)
  return out.set(hl - hr, 2 * e, hd - hu).normalize()
}

/** Inclinação do terreno em graus (0 = plano). */
export function terrainSlope(x: number, z: number): number {
  const n = terrainNormal(x, z)
  return Math.acos(clamp(n.y, -1, 1)) * (180 / Math.PI)
}

export function isWater(x: number, z: number): boolean {
  return terrainHeight(x, z) < WATER_LEVEL - 0.05
}

export function isInRiverCorridor(x: number, z: number, margin = 0): boolean {
  return riverDistance(x, z) < RIVER_HALF_WIDTH + margin
}

/** Constrói a malha de um pedaço de terreno. `step` controla o nível de detalhe. */
export function buildTerrainChunk(
  cx: number, cz: number, size: number, step: number,
): THREE.BufferGeometry {
  const segs = Math.max(1, Math.round(size / step))
  const geo = new THREE.PlaneGeometry(size, size, segs, segs)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const uvAttr = geo.attributes.uv as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  const c = new THREE.Color()
  const UV_METERS = 9 // metros por repetição da textura de solo

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + cx
    const z = pos.getZ(i) + cz
    const h = terrainHeight(x, z)
    pos.setY(i, h)
    uvAttr.setXY(i, x / UV_METERS, z / UV_METERS)

    // Cor de vértice: mistura grama / terra / areia conforme altura e declive.
    const slope = 1 - terrainNormal(x, z).y
    const dryness = fbm2(x * 0.004, z * 0.004, 3, 71)
    const rd = riverDistance(x, z)
    const sand = 1 - smoothstep(RIVER_HALF_WIDTH + 2, RIVER_HALF_WIDTH + 16, rd)
    const grass = new THREE.Color(0.20, 0.34, 0.15).lerp(new THREE.Color(0.30, 0.38, 0.17), dryness)
    const dirt = new THREE.Color(0.36, 0.28, 0.19)
    const sandC = new THREE.Color(0.58, 0.52, 0.38)
    c.copy(grass).lerp(dirt, clamp(slope * 2.6, 0, 1)).lerp(sandC, sand)
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  // Os vértices já carregam a altura de mundo; falta deslocar em X/Z.
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, pos.getX(i) + cx)
    pos.setZ(i, pos.getZ(i) + cz)
  }
  pos.needsUpdate = true
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  return geo
}

/** Pontos onde o rio é atravessado por pontes (definidos junto com a malha viária). */
export function riverCrossingHeight(): number {
  return WATER_LEVEL + 6.2
}
