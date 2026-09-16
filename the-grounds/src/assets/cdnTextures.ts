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
  /**
   * ImageBitmapLoader decodifica a imagem fora da thread principal. Com o
   * TextureLoader comum, cada mapa que chegava era decodificado no meio do
   * quadro — e como os mapas chegam em série, o jogo travava de poucos em
   * poucos segundos durante o primeiro minuto.
   */
  private bitmap = new THREE.ImageBitmapLoader()
  private loader = new THREE.TextureLoader()
  private cache = new Map<string, Promise<THREE.Texture>>()
  private aborted = false
  private anisotropy: number
  private resolution: '1k' | '2k'
  readonly credits: string[] = []

  constructor(anisotropy: number, quality: 'baixo' | 'medio' | 'alto') {
    this.anisotropy = anisotropy
    // 2k só quando pedido de propósito. Vinte e um materiais em 2k com quatro
    // mapas cada passam de cem megabytes de download e de decodificação, o que
    // não se paga: a diferença na tela é pequena e o custo é enorme.
    this.resolution = quality === 'alto' ? '2k' : '1k'
    this.loader.setCrossOrigin('anonymous')
    this.bitmap.setOptions({ imageOrientation: 'flipY' })
    this.bitmap.setCrossOrigin('anonymous')
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
      const preparar = (tex: THREE.Texture) => {
        clearTimeout(timer)
        tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping
        tex.anisotropy = this.anisotropy
        tex.minFilter = THREE.LinearMipmapLinearFilter
        tex.magFilter = THREE.LinearFilter
        tex.generateMipmaps = true
        tex.needsUpdate = true
        resolve(tex)
      }
      this.bitmap.load(
        url,
        (bmp) => preparar(new THREE.CanvasTexture(bmp as unknown as HTMLCanvasElement)),
        undefined,
        () => {
          // Navegador sem ImageBitmap ou CORS recusado: cai no caminho comum.
          this.loader.load(url, preparar, undefined,
            () => { clearTimeout(timer); reject(new Error('falha ao baixar')) })
        },
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
    // O mapa de oclusão sai: é um quarto download por material para uma
    // diferença que quase não aparece com luz de céu aberto.
    void urls.aoMap
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
      // Respira entre materiais: a troca de mapas de um material sobe textura
      // para a placa, e emendar vinte e uma dessas seguidas é justamente o que
      // se sente como travada periódica.
      await new Promise((r) => setTimeout(r, 450))
      onProgress?.({ total: keys.length, done, failed, current: key })
    }
  }
}

/** Ordem de prioridade: o que cobre mais pixels na tela primeiro. */
export const CDN_PRIORITY: CdnKey[] = [
  'asfalto', 'calcada', 'fachada', 'concreto', 'grama',
  'tijolo', 'telhaCeramica', 'telha', 'fachadaPastilha', 'fachadaGasta',
  'meioFio', 'paralelepipedo', 'terra', 'metal', 'pisoInterno',
  'madeira', 'azulejo', 'madeiraEscura', 'metalPintado', 'asfaltoGasto',
  'vidroPredio',
]
