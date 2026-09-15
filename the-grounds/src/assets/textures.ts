/**
 * Geração procedural de texturas PBR (albedo + normal + roughness) em canvas.
 *
 * Todas as texturas são criadas em tempo de execução: nenhum download externo é
 * necessário e a escala pode ser ajustada pelo perfil gráfico. Cada gerador
 * escreve simultaneamente um mapa de altura (usado para derivar a normal por
 * Sobel) e um mapa de rugosidade, evitando "iluminação embutida" na cor base.
 */

import * as THREE from 'three'
import { clamp, fbm2, hash2, lerp, makeRng, type Rng } from '../core/math'

export type TextureSizeProfile = 'baixo' | 'medio' | 'alto'

const SIZE_BY_PROFILE: Record<TextureSizeProfile, number> = { baixo: 256, medio: 512, alto: 1024 }

export interface PbrMaps {
  map: THREE.Texture
  normalMap: THREE.Texture
  roughnessMap: THREE.Texture
}

interface Buffers {
  size: number
  albedo: Uint8ClampedArray // RGB
  height: Float32Array
  rough: Float32Array
}

function makeBuffers(size: number): Buffers {
  return {
    size,
    albedo: new Uint8ClampedArray(size * size * 3),
    height: new Float32Array(size * size),
    rough: new Float32Array(size * size).fill(0.8),
  }
}

function setPx(b: Buffers, i: number, r: number, g: number, bl: number, h: number, rough: number): void {
  b.albedo[i * 3] = r * 255
  b.albedo[i * 3 + 1] = g * 255
  b.albedo[i * 3 + 2] = bl * 255
  b.height[i] = h
  b.rough[i] = rough
}

function toColorTexture(b: Buffers, srgb: boolean): THREE.DataTexture {
  const data = new Uint8Array(b.size * b.size * 4)
  for (let i = 0; i < b.size * b.size; i++) {
    data[i * 4] = b.albedo[i * 3]
    data[i * 4 + 1] = b.albedo[i * 3 + 1]
    data[i * 4 + 2] = b.albedo[i * 3 + 2]
    data[i * 4 + 3] = 255
  }
  const tex = new THREE.DataTexture(data, b.size, b.size, THREE.RGBAFormat)
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.needsUpdate = true
  return tex
}

function toRoughTexture(b: Buffers): THREE.DataTexture {
  const data = new Uint8Array(b.size * b.size * 4)
  for (let i = 0; i < b.size * b.size; i++) {
    const v = clamp(b.rough[i], 0, 1) * 255
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v
    data[i * 4 + 3] = 255
  }
  const tex = new THREE.DataTexture(data, b.size, b.size, THREE.RGBAFormat)
  tex.colorSpace = THREE.NoColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.needsUpdate = true
  return tex
}

/** Deriva a normal do mapa de altura por diferenças centrais com wrap (tileável). */
function toNormalTexture(b: Buffers, strength: number): THREE.DataTexture {
  const s = b.size
  const data = new Uint8Array(s * s * 4)
  const at = (x: number, y: number) => b.height[((y + s) % s) * s + ((x + s) % s)]
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength
      // Normal tangencial: (-dx, -dy, 1) normalizada.
      const len = Math.hypot(dx, dy, 1)
      const i = (y * s + x) * 4
      data[i] = ((-dx / len) * 0.5 + 0.5) * 255
      data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255
      data[i + 2] = (1 / len) * 0.5 * 255 + 127.5
      data[i + 3] = 255
    }
  }
  const tex = new THREE.DataTexture(data, s, s, THREE.RGBAFormat)
  tex.colorSpace = THREE.NoColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.needsUpdate = true
  return tex
}

function finish(b: Buffers, normalStrength: number, aniso: number): PbrMaps {
  const map = toColorTexture(b, true)
  const normalMap = toNormalTexture(b, normalStrength)
  const roughnessMap = toRoughTexture(b)
  for (const t of [map, normalMap, roughnessMap]) {
    t.anisotropy = aniso
    t.generateMipmaps = true
    t.minFilter = THREE.LinearMipmapLinearFilter
    t.magFilter = THREE.LinearFilter
    t.needsUpdate = true
  }
  return { map, normalMap, roughnessMap }
}

// --------------------------------------------------------------------------
// Geradores por material
// --------------------------------------------------------------------------

function genAsphalt(size: number, rng: Rng): Buffers {
  const b = makeBuffers(size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      const u = (x / size) * 24
      const v = (y / size) * 24
      const grain = fbm2(u * 4, v * 4, 4, 11)
      const cracks = Math.pow(1 - Math.abs(fbm2(u * 0.8, v * 0.8, 3, 77) - 0.5) * 2, 14)
      const pebble = hash2(x, y, 5) > 0.986 ? 0.22 : 0
      let base = 0.085 + grain * 0.07 + pebble
      // manchas de óleo/desgaste
      const stain = Math.pow(fbm2(u * 0.35, v * 0.35, 3, 991), 3)
      base = lerp(base, base * 0.6, stain * 0.7)
      base -= cracks * 0.05
      const h = grain * 0.6 + pebble * 2 - cracks * 1.4
      const rough = clamp(0.94 - stain * 0.35 - pebble * 0.2 + rng() * 0.02, 0.2, 1)
      setPx(b, i, base * 1.02, base, base * 0.98, h, rough)
    }
  }
  return b
}

function genConcrete(size: number, rng: Rng): Buffers {
  const b = makeBuffers(size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      const u = (x / size) * 12
      const v = (y / size) * 12
      const n = fbm2(u * 3, v * 3, 5, 31)
      const blotch = fbm2(u * 0.6, v * 0.6, 3, 313)
      // escorrimento vertical (sujeira urbana)
      const streak = Math.pow(fbm2(u * 6, v * 0.25, 3, 707), 4) * 0.5
      let c = 0.56 + n * 0.16 - blotch * 0.1 - streak * 0.35
      const pit = hash2(x, y, 17) > 0.994 ? -0.6 : 0
      c += pit * 0.05
      const h = n * 0.5 + pit
      setPx(b, i, c * 1.01, c, c * 0.97, h, clamp(0.85 + n * 0.1 + rng() * 0.02, 0, 1))
    }
  }
  return b
}

function genPlaster(size: number, rng: Rng, tint: [number, number, number]): Buffers {
  const b = makeBuffers(size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      const u = (x / size) * 10
      const v = (y / size) * 10
      const n = fbm2(u * 5, v * 5, 4, 57)
      const wear = Math.pow(fbm2(u * 1.2, v * 1.2, 3, 401), 2.4)
      // manchas de umidade na base da parede
      const damp = Math.pow(1 - y / size, 3) * 0.35
      const f = 0.88 + n * 0.14 - wear * 0.22 - damp * 0.3
      setPx(b, i, tint[0] * f, tint[1] * f, tint[2] * f, n * 0.4 - wear * 0.6,
        clamp(0.78 + wear * 0.18 + rng() * 0.02, 0, 1))
    }
  }
  return b
}

function genBrick(size: number, rng: Rng): Buffers {
  const b = makeBuffers(size)
  const rows = 12
  const cols = 6
  const bh = size / rows
  const bw = size / cols
  const mortar = 0.055 * size / Math.max(bh, 1) * 0.9
  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / bh)
    const offset = row % 2 === 0 ? 0 : bw / 2
    const fy = (y % bh) / bh
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      const fx = (((x + offset) % bw) + bw) % bw / bw
      const edge = Math.min(fx, 1 - fx, fy, 1 - fy)
      const isMortar = edge < mortar * 0.5
      const bi = Math.floor((x + offset) / bw) + row * 31
      const shade = hash2(bi, row, 3)
      const n = fbm2((x / size) * 30, (y / size) * 30, 3, 91)
      if (isMortar) {
        const c = 0.62 + n * 0.1
        setPx(b, i, c, c * 0.99, c * 0.95, -0.9 + n * 0.2, 0.92)
      } else {
        const r = lerp(0.46, 0.63, shade) * (0.9 + n * 0.2)
        const g = lerp(0.22, 0.31, shade) * (0.9 + n * 0.2)
        const bl = lerp(0.17, 0.24, shade) * (0.9 + n * 0.2)
        setPx(b, i, r, g, bl, 0.4 + n * 0.3, clamp(0.8 + n * 0.12 + rng() * 0.02, 0, 1))
      }
    }
  }
  return b
}

function genSidewalk(size: number, _rng: Rng): Buffers {
  const b = makeBuffers(size)
  const tiles = 8
  const t = size / tiles
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      const fx = (x % t) / t
      const fy = (y % t) / t
      const edge = Math.min(fx, 1 - fx, fy, 1 - fy)
      const groove = edge < 0.035
      const ti = Math.floor(x / t) + Math.floor(y / t) * 17
      const shade = hash2(ti, 7, 13)
      const n = fbm2((x / size) * 26, (y / size) * 26, 4, 137)
      // padrão pontilhado do "piso podotátil" clássico brasileiro
      const dot = (Math.sin((x / t) * Math.PI * 4) * Math.sin((y / t) * Math.PI * 4)) > 0.92 ? 0.35 : 0
      let c = 0.63 + shade * 0.08 + n * 0.1 + dot * 0.05
      if (groove) c *= 0.72
      const h = groove ? -1 : n * 0.4 + dot * 1.2
      setPx(b, i, c * 1.0, c * 0.99, c * 0.94, h, clamp(0.88 + n * 0.08, 0, 1))
    }
  }
  return b
}

function genGrass(size: number, rng: Rng, pitch = false): Buffers {
  const b = makeBuffers(size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      const u = (x / size) * 30
      const v = (y / size) * 30
      const blade = fbm2(u * 8, v * 8, 3, 23)
      const patch = fbm2(u * 0.9, v * 0.9, 4, 271)
      let g = 0.30 + blade * 0.16 + patch * 0.1
      let r = g * 0.48
      let bl = g * 0.32
      if (pitch) {
        // faixas de corte do gramado (listras alternadas)
        const stripe = Math.floor((y / size) * 6) % 2 === 0 ? 1.1 : 0.9
        g *= stripe; r *= stripe; bl *= stripe
        // desgaste onde mais se pisa
        const worn = Math.pow(patch, 4) * 0.5
        r = lerp(r, 0.35, worn); g = lerp(g, 0.28, worn); bl = lerp(bl, 0.2, worn)
      } else {
        const dirt = Math.pow(patch, 5)
        r = lerp(r, 0.34, dirt); g = lerp(g, 0.26, dirt); bl = lerp(bl, 0.18, dirt)
      }
      setPx(b, i, r, g, bl, blade * 0.8, clamp(0.92 - blade * 0.08 + rng() * 0.02, 0, 1))
    }
  }
  return b
}

function genDirt(size: number, rng: Rng): Buffers {
  const b = makeBuffers(size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      const u = (x / size) * 18
      const v = (y / size) * 18
      const n = fbm2(u * 4, v * 4, 5, 61)
      const rock = hash2(x, y, 29) > 0.991 ? 0.25 : 0
      const c = 0.32 + n * 0.16 + rock
      setPx(b, i, c * 1.22, c * 0.94, c * 0.68, n * 0.7 + rock * 2, clamp(0.95 - rock * 0.2 + rng() * 0.02, 0, 1))
    }
  }
  return b
}

function genWood(size: number, rng: Rng, tint: [number, number, number]): Buffers {
  const b = makeBuffers(size)
  const planks = 6
  const pw = size / planks
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      const pi = Math.floor(y / pw)
      const fy = (y % pw) / pw
      const gap = fy < 0.02 || fy > 0.98
      const shade = hash2(pi, 3, 5)
      const grain = Math.sin((x / size) * 60 + fbm2((x / size) * 6, (y / size) * 2, 3, 401 + pi) * 18) * 0.5 + 0.5
      const n = fbm2((x / size) * 20, (y / size) * 40, 3, 809)
      let f = 0.78 + grain * 0.2 + shade * 0.12 + n * 0.06
      if (gap) f *= 0.4
      setPx(b, i, tint[0] * f, tint[1] * f, tint[2] * f, gap ? -1 : grain * 0.4,
        clamp(0.55 + grain * 0.22 + rng() * 0.02, 0, 1))
    }
  }
  return b
}

function genTile(size: number, _rng: Rng, tint: [number, number, number], tiles = 10): Buffers {
  const b = makeBuffers(size)
  const t = size / tiles
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      const fx = (x % t) / t
      const fy = (y % t) / t
      const edge = Math.min(fx, 1 - fx, fy, 1 - fy)
      const grout = edge < 0.05
      const ti = Math.floor(x / t) * 13 + Math.floor(y / t) * 7
      const shade = 0.94 + hash2(ti, 2, 9) * 0.1
      const n = fbm2((x / size) * 40, (y / size) * 40, 2, 123) * 0.06
      if (grout) {
        const c = 0.7 + n
        setPx(b, i, c, c * 0.99, c * 0.96, -0.8, 0.9)
      } else {
        setPx(b, i, tint[0] * shade + n, tint[1] * shade + n, tint[2] * shade + n, 0.2, 0.22)
      }
    }
  }
  return b
}

function genFabric(size: number, rng: Rng, tint: [number, number, number]): Buffers {
  const b = makeBuffers(size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      const weave = ((Math.floor(x / 2) + Math.floor(y / 2)) % 2) * 0.12
      const n = fbm2((x / size) * 60, (y / size) * 60, 3, 555) * 0.12
      const f = 0.88 + weave + n
      setPx(b, i, tint[0] * f, tint[1] * f, tint[2] * f, weave * 3 + n,
        clamp(0.86 + n + rng() * 0.02, 0, 1))
    }
  }
  return b
}

function genCobble(size: number, rng: Rng): Buffers {
  const b = makeBuffers(size)
  const cells = 8
  const cs = size / cells
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      const cx = Math.floor(x / cs)
      const cy = Math.floor(y / cs)
      // Centro deslocado por célula: pedras irregulares (Voronoi simplificado)
      let best = 1e9
      let second = 1e9
      let bestId = 0
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const gx = cx + ox
          const gy = cy + oy
          const px = (gx + 0.2 + hash2(gx, gy, 1) * 0.6) * cs
          const py = (gy + 0.2 + hash2(gx, gy, 2) * 0.6) * cs
          const d = Math.hypot(x - px, y - py)
          if (d < best) { second = best; best = d; bestId = gx * 71 + gy * 131 }
          else if (d < second) second = d
        }
      }
      const edge = second - best
      const isGap = edge < cs * 0.14
      const shade = hash2(bestId, 3, 11)
      const n = fbm2((x / size) * 40, (y / size) * 40, 3, 13) * 0.12
      const c = isGap ? 0.24 + n : (0.42 + shade * 0.18 + n)
      setPx(b, i, c * 1.02, c, c * 0.95, isGap ? -1.2 : clamp(edge / (cs * 0.5), 0, 1) * 0.9,
        clamp(0.88 - shade * 0.1 + rng() * 0.02, 0, 1))
    }
  }
  return b
}

function genMetal(size: number, rng: Rng, tint: [number, number, number]): Buffers {
  const b = makeBuffers(size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      const brush = fbm2((x / size) * 200, (y / size) * 3, 3, 17)
      const rust = Math.pow(fbm2((x / size) * 3, (y / size) * 3, 4, 991), 4)
      const f = 0.82 + brush * 0.2
      const r = lerp(tint[0] * f, 0.45, rust)
      const g = lerp(tint[1] * f, 0.24, rust)
      const bl = lerp(tint[2] * f, 0.14, rust)
      setPx(b, i, r, g, bl, brush * 0.2 + rust * 0.6,
        clamp(lerp(0.32, 0.85, rust) + brush * 0.06 + rng() * 0.02, 0, 1))
    }
  }
  return b
}

// --------------------------------------------------------------------------
// Biblioteca com cache
// --------------------------------------------------------------------------

export type MaterialKey =
  | 'asfalto' | 'concreto' | 'reboco' | 'tijolo' | 'calcada' | 'grama' | 'gramado'
  | 'terra' | 'madeira' | 'madeiraEscura' | 'azulejo' | 'pisoInterno' | 'tecido' | 'paralelepipedo' | 'metal'

const GENERATORS: Record<MaterialKey, (size: number, rng: Rng) => Buffers> = {
  asfalto: genAsphalt,
  concreto: genConcrete,
  reboco: (s, r) => genPlaster(s, r, [0.92, 0.9, 0.85]),
  tijolo: genBrick,
  calcada: genSidewalk,
  grama: (s, r) => genGrass(s, r, false),
  gramado: (s, r) => genGrass(s, r, true),
  terra: genDirt,
  madeira: (s, r) => genWood(s, r, [0.72, 0.52, 0.34]),
  madeiraEscura: (s, r) => genWood(s, r, [0.36, 0.24, 0.16]),
  azulejo: (s, r) => genTile(s, r, [0.92, 0.94, 0.93], 10),
  pisoInterno: (s, r) => genTile(s, r, [0.82, 0.78, 0.72], 6),
  tecido: (s, r) => genFabric(s, r, [0.55, 0.28, 0.24]),
  paralelepipedo: genCobble,
  metal: (s, r) => genMetal(s, r, [0.62, 0.64, 0.68]),
}

const NORMAL_STRENGTH: Partial<Record<MaterialKey, number>> = {
  asfalto: 2.2, concreto: 1.6, tijolo: 4, calcada: 3.5, grama: 2.2, gramado: 1.6,
  terra: 2.6, madeira: 1.6, madeiraEscura: 1.6, azulejo: 2.6, pisoInterno: 2.2,
  tecido: 1.2, paralelepipedo: 4.5, metal: 1.0, reboco: 1.4,
}

export class TextureLibrary {
  private cache = new Map<string, PbrMaps>()
  private size: number
  private aniso: number

  constructor(profile: TextureSizeProfile, maxAnisotropy: number) {
    this.size = SIZE_BY_PROFILE[profile]
    this.aniso = maxAnisotropy
  }

  get(key: MaterialKey): PbrMaps {
    const cacheKey = `${key}:${this.size}`
    const hit = this.cache.get(cacheKey)
    if (hit) return hit
    const rng = makeRng(keyToSeed(key))
    const buffers = GENERATORS[key](this.size, rng)
    const maps = finish(buffers, NORMAL_STRENGTH[key] ?? 2, this.aniso)
    this.cache.set(cacheKey, maps)
    return maps
  }

  /** Aplica os mapas a um material, com repetição em metros. */
  apply(mat: THREE.MeshStandardMaterial, key: MaterialKey, repeatX: number, repeatY = repeatX): THREE.MeshStandardMaterial {
    const maps = this.get(key)
    mat.map = maps.map.clone()
    mat.normalMap = maps.normalMap.clone()
    mat.roughnessMap = maps.roughnessMap.clone()
    for (const t of [mat.map, mat.normalMap, mat.roughnessMap]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(repeatX, repeatY)
      t.anisotropy = this.aniso
      t.needsUpdate = true
    }
    mat.needsUpdate = true
    return mat
  }

  dispose(): void {
    for (const m of this.cache.values()) {
      m.map.dispose(); m.normalMap.dispose(); m.roughnessMap.dispose()
    }
    this.cache.clear()
  }
}

function keyToSeed(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
