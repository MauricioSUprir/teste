/**
 * Texturas do personagem, geradas por código.
 *
 * A cor base é mantida próxima do branco para que o tom escolhido no editor
 * continue mandando na aparência; o que as texturas acrescentam é relevo
 * (poros, trama do tecido, fios do cabelo, grão do couro) e variação de
 * rugosidade — que é o que faz a luz "pegar" na superfície em vez de deixá-la
 * com aspecto de plástico chapado.
 */

import * as THREE from 'three'
import { clamp, fbm2, hash2 } from '../core/math'

interface Buffers {
  size: number
  albedo: Float32Array   // 1 canal (multiplicador da cor base)
  height: Float32Array
  rough: Float32Array
}

function novo(size: number): Buffers {
  return {
    size,
    albedo: new Float32Array(size * size).fill(1),
    height: new Float32Array(size * size),
    rough: new Float32Array(size * size).fill(0.7),
  }
}

function paraAlbedo(b: Buffers, matiz: [number, number, number] = [1, 1, 1]): THREE.DataTexture {
  const data = new Uint8Array(b.size * b.size * 4)
  for (let i = 0; i < b.size * b.size; i++) {
    const v = clamp(b.albedo[i], 0, 2)
    data[i * 4] = clamp(v * matiz[0], 0, 1) * 255
    data[i * 4 + 1] = clamp(v * matiz[1], 0, 1) * 255
    data[i * 4 + 2] = clamp(v * matiz[2], 0, 1) * 255
    data[i * 4 + 3] = 255
  }
  const t = new THREE.DataTexture(data, b.size, b.size, THREE.RGBAFormat)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.needsUpdate = true
  return t
}

function paraRugosidade(b: Buffers): THREE.DataTexture {
  const data = new Uint8Array(b.size * b.size * 4)
  for (let i = 0; i < b.size * b.size; i++) {
    const v = clamp(b.rough[i], 0, 1) * 255
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v
    data[i * 4 + 3] = 255
  }
  const t = new THREE.DataTexture(data, b.size, b.size, THREE.RGBAFormat)
  t.colorSpace = THREE.NoColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.needsUpdate = true
  return t
}

function paraNormal(b: Buffers, forca: number): THREE.DataTexture {
  const s = b.size
  const data = new Uint8Array(s * s * 4)
  const at = (x: number, y: number) => b.height[((y + s) % s) * s + ((x + s) % s)]
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * forca
      const dy = (at(x, y + 1) - at(x, y - 1)) * forca
      const len = Math.hypot(dx, dy, 1)
      const i = (y * s + x) * 4
      data[i] = ((-dx / len) * 0.5 + 0.5) * 255
      data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255
      data[i + 2] = (1 / len) * 0.5 * 255 + 127.5
      data[i + 3] = 255
    }
  }
  const t = new THREE.DataTexture(data, s, s, THREE.RGBAFormat)
  t.colorSpace = THREE.NoColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.needsUpdate = true
  return t
}

export interface MapaPersonagem {
  map: THREE.Texture
  normalMap: THREE.Texture
  roughnessMap: THREE.Texture
}

/** Pele: poros finos, variação de tom e brilho irregular. */
function gerarPele(size: number): Buffers {
  const b = novo(size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      const u = (x / size) * 90
      const v = (y / size) * 90
      // Poros: ruído de alta frequência, com alguns mais fundos.
      const poro = hash2(x, y, 41)
      const fundo = poro > 0.972 ? -1 : poro > 0.90 ? -0.35 : 0
      // Variação lenta de tom (manchas naturais da pele).
      const mancha = fbm2(u * 0.12, v * 0.12, 4, 17)
      // Microrrelevo geral
      const micro = fbm2(u * 1.6, v * 1.6, 3, 91)

      b.albedo[i] = 0.94 + mancha * 0.12 - Math.max(0, -fundo) * 0.05
      b.height[i] = fundo * 0.9 + micro * 0.25
      // Testa e nariz brilham mais; o resto é fosco. Sem mapa de rosto
      // dedicado, a variação vem do próprio ruído.
      b.rough[i] = clamp(0.66 - mancha * 0.10 + micro * 0.06, 0.35, 0.92)
    }
  }
  return b
}

/** Tecido: trama cruzada com fios irregulares e costuras periódicas. */
function gerarTecido(size: number): Buffers {
  const b = novo(size)
  const passo = 4
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      // Trama: fios alternados na horizontal e na vertical.
      const fx = Math.floor(x / passo) % 2
      const fy = Math.floor(y / passo) % 2
      const cruzamento = fx === fy ? 1 : -1
      const dentro = Math.min(x % passo, passo - 1 - (x % passo), y % passo, passo - 1 - (y % passo)) / (passo / 2)
      const fio = cruzamento * (0.35 + dentro * 0.65)
      // Irregularidade do fio e pequenos pelinhos.
      const ruido = fbm2((x / size) * 120, (y / size) * 120, 3, 53)
      const pelo = hash2(x, y, 7) > 0.985 ? 0.5 : 0

      b.albedo[i] = 0.90 + ruido * 0.16 + fio * 0.045
      b.height[i] = fio * 0.75 + ruido * 0.28 + pelo
      b.rough[i] = clamp(0.86 + ruido * 0.10 - fio * 0.03, 0.55, 1)
    }
  }
  // Costura horizontal a cada 1/4 da altura: dá escala de peça de roupa.
  const costuras = [Math.floor(size * 0.24), Math.floor(size * 0.76)]
  for (const cy of costuras) {
    for (let x = 0; x < size; x++) {
      for (let d = -1; d <= 1; d++) {
        const i = ((cy + d + size) % size) * size + x
        const ponto = (x % 7) < 4 ? 1 : 0
        b.height[i] += 0.9 * ponto
        b.albedo[i] *= 0.94
      }
    }
  }
  return b
}

/** Cabelo: fios finos alinhados, com falhas e brilho direcional. */
function gerarCabelo(size: number): Buffers {
  const b = novo(size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      // Fios ao longo de v, levemente ondulados.
      const onda = fbm2((x / size) * 6, (y / size) * 1.4, 3, 29) * 8
      const fio = Math.sin((x + onda) * 1.25)
      const macico = fbm2((x / size) * 14, (y / size) * 5, 3, 311)
      b.albedo[i] = 0.82 + macico * 0.26 + fio * 0.07
      b.height[i] = fio * 0.8 + macico * 0.3
      // Brilho em faixa: cabelo reflete em banda, não uniformemente.
      b.rough[i] = clamp(0.48 + macico * 0.24 - Math.abs(fio) * 0.10, 0.20, 0.85)
    }
  }
  return b
}

/** Couro / borracha do calçado: grão fino e costura de solado. */
function gerarCouro(size: number): Buffers {
  const b = novo(size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      const grao = fbm2((x / size) * 70, (y / size) * 70, 4, 601)
      const celula = hash2(Math.floor(x / 3), Math.floor(y / 3), 13)
      b.albedo[i] = 0.88 + grao * 0.18
      b.height[i] = grao * 0.6 + (celula > 0.86 ? -0.4 : 0)
      b.rough[i] = clamp(0.52 + grao * 0.26, 0.25, 0.9)
    }
  }
  return b
}

const GERADORES = {
  pele: gerarPele,
  tecido: gerarTecido,
  cabelo: gerarCabelo,
  couro: gerarCouro,
} as const

export type TipoMapaPersonagem = keyof typeof GERADORES

const FORCA_NORMAL: Record<TipoMapaPersonagem, number> = {
  pele: 1.2, tecido: 2.6, cabelo: 3.0, couro: 2.0,
}

/**
 * Biblioteca compartilhada. Os mapas são gerados uma única vez e reutilizados
 * por todos os personagens — o que muda entre eles é a cor do material.
 */
export class CharacterTextureLibrary {
  private cache = new Map<TipoMapaPersonagem, MapaPersonagem>()
  private size: number
  private aniso: number

  constructor(qualidade: 'baixo' | 'medio' | 'alto', maxAnisotropy: number) {
    this.size = qualidade === 'alto' ? 512 : qualidade === 'medio' ? 256 : 128
    this.aniso = maxAnisotropy
  }

  get(tipo: TipoMapaPersonagem): MapaPersonagem {
    const hit = this.cache.get(tipo)
    if (hit) return hit
    const b = GERADORES[tipo](this.size)
    const maps: MapaPersonagem = {
      map: paraAlbedo(b),
      normalMap: paraNormal(b, FORCA_NORMAL[tipo]),
      roughnessMap: paraRugosidade(b),
    }
    for (const t of [maps.map, maps.normalMap, maps.roughnessMap]) {
      t.anisotropy = this.aniso
      t.generateMipmaps = true
      t.minFilter = THREE.LinearMipmapLinearFilter
      t.magFilter = THREE.LinearFilter
      t.needsUpdate = true
    }
    this.cache.set(tipo, maps)
    return maps
  }

  /** Aplica os mapas a um material, com repetição própria. */
  aplicar(
    mat: THREE.MeshStandardMaterial, tipo: TipoMapaPersonagem,
    repeatX: number, repeatY = repeatX, forcaNormal = 1,
  ): void {
    const m = this.get(tipo)
    mat.map = m.map.clone()
    mat.normalMap = m.normalMap.clone()
    mat.roughnessMap = m.roughnessMap.clone()
    for (const t of [mat.map, mat.normalMap, mat.roughnessMap]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(repeatX, repeatY)
      t.anisotropy = this.aniso
      t.needsUpdate = true
    }
    mat.normalScale = new THREE.Vector2(forcaNormal, forcaNormal)
    mat.needsUpdate = true
  }

  dispose(): void {
    for (const m of this.cache.values()) {
      m.map.dispose(); m.normalMap.dispose(); m.roughnessMap.dispose()
    }
    this.cache.clear()
  }
}

/** Instância única usada por todos os personagens do jogo. */
let compartilhada: CharacterTextureLibrary | null = null

export function bibliotecaPersonagem(
  qualidade: 'baixo' | 'medio' | 'alto' = 'alto', maxAnisotropy = 8,
): CharacterTextureLibrary {
  if (!compartilhada) compartilhada = new CharacterTextureLibrary(qualidade, maxAnisotropy)
  return compartilhada
}

