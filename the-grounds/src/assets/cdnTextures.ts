/**
 * Carregamento progressivo de materiais PBR fotogramétricos (CC0, Poly Haven).
 *
 * O jogo começa com as texturas procedurais — que funcionam sem rede — e cada
 * material é substituído assim que sua versão fotográfica termina de baixar.
 * Falha de rede não quebra nada: o material procedural permanece.
 */

import * as THREE from 'three'
import manifest from './cdn-manifest.json'

export interface CdnMaterialEntry {
  id: string
  uvScale: number
  credit: string
  normalIsDirectX?: boolean
  res: Record<string, Partial<Record<'map' | 'normalMap' | 'roughnessMap' | 'aoMap', string>>>
}

export type CdnKey = keyof typeof manifest.materials

export interface LoadedMaps {
  map?: THREE.Texture
  normalMap?: THREE.Texture
  roughnessMap?: THREE.Texture
  aoMap?: THREE.Texture
}

export interface CdnProgress {
  total: number
  done: number
  failed: number
  current: string
}

export class CdnTextureLoader {
  private loader = new THREE.TextureLoader()
  private cache = new Map<string, Promise<THREE.Texture>>()
  private aborted = false
  private anisotropy: number
  private resolution: '1k' | '2k'
  readonly credits: string[] = []

  constructor(anisotropy: number, quality: 'baixo' | 'medio' | 'alto') {
    this.anisotropy = anisotropy
    this.resolution = quality === 'alto' ? '2k' : '1k'
    this.loader.setCrossOrigin('anonymous')
  }

  static get keys(): CdnKey[] {
    return Object.keys(manifest.materials) as CdnKey[]
  }

  static entry(key: CdnKey): CdnMaterialEntry {
    return (manifest.materials as Record<string, CdnMaterialEntry>)[key]
  }

  abort(): void { this.aborted = true }

  private loadTexture(url: string, srgb: boolean): Promise<THREE.Texture> {
    const hit = this.cache.get(url)
    if (hit) return hit
    const p = new Promise<THREE.Texture>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('tempo esgotado')), 30000)
      this.loader.load(
        url,
        (tex) => {
          clearTimeout(timer)
          tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping
          tex.anisotropy = this.anisotropy
          tex.minFilter = THREE.LinearMipmapLinearFilter
          tex.magFilter = THREE.LinearFilter
          tex.generateMipmaps = true
          tex.needsUpdate = true
          resolve(tex)
        },
        undefined,
        () => { clearTimeout(timer); reject(new Error('falha ao baixar')) },
      )
    })
    this.cache.set(url, p)
    return p
  }

  /** Baixa o conjunto de mapas de um material. Devolve o que conseguiu. */
  async load(key: CdnKey): Promise<LoadedMaps | null> {
    if (this.aborted) return null
    const entry = CdnTextureLoader.entry(key)
    if (!entry) return null
    const urls = entry.res[this.resolution] ?? entry.res['1k']
    if (!urls) return null

    const out: LoadedMaps = {}
    const jobs: Promise<void>[] = []
    if (urls.map) jobs.push(this.loadTexture(urls.map, true).then((t) => { out.map = t }).catch(() => {}))
    if (urls.normalMap) jobs.push(this.loadTexture(urls.normalMap, false).then((t) => { out.normalMap = t }).catch(() => {}))
    if (urls.roughnessMap) jobs.push(this.loadTexture(urls.roughnessMap, false).then((t) => { out.roughnessMap = t }).catch(() => {}))
    if (urls.aoMap) jobs.push(this.loadTexture(urls.aoMap, false).then((t) => { out.aoMap = t }).catch(() => {}))
    await Promise.all(jobs)
    if (!out.map) return null
    if (!this.credits.includes(entry.credit)) this.credits.push(entry.credit)
    return out
  }

  /** Baixa vários materiais em série, por ordem de importância visual. */
  async loadAll(
    keys: CdnKey[],
    onMaterial: (key: CdnKey, maps: LoadedMaps) => void,
    onProgress?: (p: CdnProgress) => void,
  ): Promise<void> {
    let done = 0
    let failed = 0
    for (const key of keys) {
      if (this.aborted) return
      onProgress?.({ total: keys.length, done, failed, current: key })
      try {
        const maps = await this.load(key)
        if (maps) onMaterial(key, maps)
        else failed++
      } catch {
        failed++
      }
      done++
      onProgress?.({ total: keys.length, done, failed, current: key })
    }
  }
}

/** Ordem de prioridade: o que cobre mais pixels na tela primeiro. */
export const CDN_PRIORITY: CdnKey[] = [
  'asfalto', 'calcada', 'fachada', 'concreto', 'grama',
  'tijolo', 'telha', 'fachadaPastilha', 'fachadaGasta', 'meioFio',
  'paralelepipedo', 'terra', 'metal', 'madeira', 'pisoInterno',
  'azulejo', 'madeiraEscura', 'metalPintado', 'asfaltoGasto',
]
