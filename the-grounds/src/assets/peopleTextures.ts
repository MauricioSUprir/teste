/**
 * Tecidos fotográficos CC0 (Poly Haven) para as roupas dos personagens.
 *
 * Pele, cabelo e barba continuam procedurais: não existe varredura CC0 de pele
 * humana no acervo, e um tecido no lugar dela fica pior que a procedural.
 *
 * O carregamento é em segundo plano. O personagem nasce com a textura
 * procedural e cada peça é trocada assim que o tecido dela chega — quem está
 * jogando vê a roupa ganhar trama, não uma tela de espera.
 */

import * as THREE from 'three'
import manifesto from './people-manifest.json'

export type TecidoKey =
  | 'camiseta' | 'moletom' | 'jaqueta' | 'camisa' | 'jeans' | 'calcaSocial'
  | 'veludo' | 'esportivo' | 'agasalho' | 'couro' | 'linho' | 'malhaGrossa'

interface EntradaManifesto {
  id: string
  uvScale: number
  credit: string
  normalIsDirectX?: boolean
  res: Record<string, Partial<Record<'map' | 'normalMap' | 'roughnessMap', string>>>
}

interface Tecido {
  map: THREE.Texture
  normalMap: THREE.Texture | null
  roughnessMap: THREE.Texture | null
}

/** Material à espera do tecido dele, com a repetição já decidida. */
interface Pendente {
  material: THREE.MeshStandardMaterial
  repeatX: number
  repeatY: number
  forcaNormal: number
}

const TECIDOS = manifesto.tecidos as unknown as Record<string, EntradaManifesto>

/** Ordem de chegada: o que está no corpo inteiro antes do que é detalhe. */
export const PRIORIDADE_TECIDOS: TecidoKey[] = [
  'camiseta', 'jeans', 'esportivo', 'moletom', 'camisa', 'jaqueta',
  'linho', 'couro', 'calcaSocial', 'agasalho', 'malhaGrossa', 'veludo',
]

export class PeopleTextureLoader {
  private carregados = new Map<TecidoKey, Tecido>()
  private pendentes = new Map<TecidoKey, Pendente[]>()
  private emCurso = new Set<TecidoKey>()
  private readonly loader = new THREE.TextureLoader()
  private aniso = 4
  /** Créditos das texturas efetivamente aplicadas. */
  readonly creditos: string[] = []
  prontos = 0

  constructor(maxAnisotropy: number) {
    this.aniso = Math.min(8, maxAnisotropy)
    this.loader.setCrossOrigin('anonymous')
  }

  get total(): number { return Object.keys(TECIDOS).length }

  /**
   * Registra um material para receber o tecido `key`. Se ele já chegou, aplica
   * na hora; se não, entra na fila e é servido quando chegar.
   */
  aplicar(
    material: THREE.MeshStandardMaterial, key: TecidoKey,
    repeatX: number, repeatY = repeatX, forcaNormal = 1,
  ): void {
    const pronto = this.carregados.get(key)
    if (pronto) { this.vestir(material, pronto, repeatX, repeatY, forcaNormal); return }
    const fila = this.pendentes.get(key)
    if (fila) fila.push({ material, repeatX, repeatY, forcaNormal })
    else this.pendentes.set(key, [{ material, repeatX, repeatY, forcaNormal }])
    void this.buscar(key)
  }

  /** Baixa um tecido uma única vez, sem derrubar nada se falhar. */
  private async buscar(key: TecidoKey): Promise<void> {
    if (this.emCurso.has(key) || this.carregados.has(key)) return
    const entrada = TECIDOS[key]
    if (!entrada) return
    this.emCurso.add(key)
    const urls = entrada.res['1k']
    if (!urls?.map) { this.emCurso.delete(key); return }

    const carregar = (url: string, srgb: boolean): Promise<THREE.Texture> =>
      new Promise((ok, erro) => {
        const t = setTimeout(() => erro(new Error('tempo esgotado')), 25000)
        this.loader.load(url, (tex) => {
          clearTimeout(t)
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping
          if (srgb) tex.colorSpace = THREE.SRGBColorSpace
          tex.anisotropy = this.aniso
          ok(tex)
        }, undefined, (e) => { clearTimeout(t); erro(e as Error) })
      })

    try {
      const map = await carregar(urls.map, true)
      const normalMap = urls.normalMap ? await carregar(urls.normalMap, false).catch(() => null) : null
      const roughnessMap = urls.roughnessMap ? await carregar(urls.roughnessMap, false).catch(() => null) : null
      const tecido: Tecido = { map, normalMap, roughnessMap }
      this.carregados.set(key, tecido)
      this.prontos++
      this.creditos.push(entrada.credit)
      for (const p of this.pendentes.get(key) ?? []) {
        this.vestir(p.material, tecido, p.repeatX, p.repeatY, p.forcaNormal)
      }
      this.pendentes.delete(key)
    } catch {
      // Sem rede ou CDN fora: a textura procedural continua valendo.
      this.pendentes.delete(key)
    } finally {
      this.emCurso.delete(key)
    }
  }

  /**
   * Cada peça precisa da própria repetição, então o mapa é clonado por
   * combinação de repetição — e só por combinação. Clonar por personagem
   * esgotaria a memória de textura numa partida cheia.
   */
  private variantes = new Map<string, Tecido>()

  private vestir(
    m: THREE.MeshStandardMaterial, t: Tecido,
    repeatX: number, repeatY: number, forcaNormal: number,
  ): void {
    const chave = `${t.map.uuid}:${repeatX}x${repeatY}`
    let v = this.variantes.get(chave)
    if (!v) {
      const clonar = (tex: THREE.Texture | null): THREE.Texture | null => {
        if (!tex) return null
        const c = tex.clone()
        c.wrapS = c.wrapT = THREE.RepeatWrapping
        c.repeat.set(repeatX, repeatY)
        c.needsUpdate = true
        return c
      }
      v = { map: clonar(t.map)!, normalMap: clonar(t.normalMap), roughnessMap: clonar(t.roughnessMap) }
      this.variantes.set(chave, v)
    }
    m.map = v.map
    m.normalMap = v.normalMap
    m.roughnessMap = v.roughnessMap
    m.normalScale = new THREE.Vector2(forcaNormal, forcaNormal)
    m.needsUpdate = true
  }
}

let instancia: PeopleTextureLoader | null = null

/** Instância única: os tecidos são compartilhados por todos os personagens. */
export function tecidosPessoas(maxAnisotropy = 4): PeopleTextureLoader {
  if (!instancia) instancia = new PeopleTextureLoader(maxAnisotropy)
  return instancia
}

/** Tecido de cada peça de tronco. */
export function tecidoDoTorso(item: string): TecidoKey {
  switch (item) {
    case 'camisa': return 'camisa'
    case 'moletom': return 'moletom'
    case 'jaqueta': return 'jaqueta'
    case 'uniforme': return 'esportivo'
    case 'regata': return 'malhaGrossa'
    default: return 'camiseta'
  }
}

/** Tecido de cada peça de perna. */
export function tecidoDasPernas(item: string): TecidoKey {
  switch (item) {
    case 'calca': return 'jeans'
    case 'calcaSocial': return 'calcaSocial'
    case 'shortEsportivo': return 'esportivo'
    case 'saia': return 'veludo'
    default: return 'linho'
  }
}
