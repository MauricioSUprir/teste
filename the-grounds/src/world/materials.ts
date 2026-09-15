/**
 * Biblioteca de materiais do mundo. Todos usam cor de vértice para permitir
 * variação (fachadas, carros, roupas) mantendo um único material por tipo de
 * superfície — o que possibilita mesclar setores inteiros em poucas malhas.
 */

import * as THREE from 'three'
import { TextureLibrary, type MaterialKey as TexKey, type TextureSizeProfile } from '../assets/textures'

export type WorldMaterialKey =
  | 'asfalto' | 'faixa' | 'calcada' | 'meioFio' | 'grama' | 'gramado' | 'terra'
  | 'concreto' | 'fachada' | 'tijolo' | 'vidro' | 'vidroEscuro' | 'metal' | 'madeira'
  | 'madeiraEscura' | 'azulejo' | 'pisoInterno' | 'tecido' | 'paralelepipedo'
  | 'folhagem' | 'tronco' | 'pintura' | 'plastico' | 'luz' | 'borracha' | 'cromo'
  | 'telha' | 'toldo' | 'rede' | 'fachadaGasta' | 'fachadaPastilha' | 'asfaltoGasto'
  | 'metalPintado' | 'grade' | 'telhaCeramica' | 'vidroPredio'

export class MaterialLibrary {
  readonly textures: TextureLibrary
  private cache = new Map<WorldMaterialKey, THREE.Material>()

  constructor(profile: TextureSizeProfile, maxAnisotropy: number) {
    this.textures = new TextureLibrary(profile, maxAnisotropy)
  }

  private textured(tex: TexKey, params: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, ...params })
    const maps = this.textures.get(tex)
    m.map = maps.map
    m.normalMap = maps.normalMap
    m.roughnessMap = maps.roughnessMap
    m.normalScale = new THREE.Vector2(1, 1)
    return m
  }

  get(key: WorldMaterialKey): THREE.Material {
    const hit = this.cache.get(key)
    if (hit) return hit
    const m = this.create(key)
    this.cache.set(key, m)
    return m
  }

  private create(key: WorldMaterialKey): THREE.Material {
    switch (key) {
      case 'asfalto':
        return this.textured('asfalto', { roughness: 0.95, metalness: 0.0 })
      case 'faixa':
        return new THREE.MeshStandardMaterial({
          vertexColors: true, roughness: 0.72, metalness: 0,
          polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
        })
      case 'calcada':
        return this.textured('calcada', { roughness: 0.92 })
      case 'meioFio':
        return this.textured('concreto', { roughness: 0.9 })
      case 'grama':
        return this.textured('grama', { roughness: 0.95 })
      case 'gramado':
        return this.textured('gramado', { roughness: 0.93 })
      case 'terra':
        return this.textured('terra', { roughness: 0.97 })
      case 'concreto':
        return this.textured('concreto', { roughness: 0.88 })
      case 'fachada':
        return this.textured('reboco', { roughness: 0.82 })
      case 'fachadaGasta':
        return this.textured('reboco', { roughness: 0.9 })
      case 'fachadaPastilha':
        return this.textured('azulejo', { roughness: 0.42, metalness: 0.02 })
      case 'asfaltoGasto':
        return this.textured('asfalto', { roughness: 0.96 })
      case 'metalPintado':
        return this.textured('metal', { roughness: 0.48, metalness: 0.35 })
      case 'grade':
        return new THREE.MeshStandardMaterial({
          vertexColors: true, roughness: 0.55, metalness: 0.6,
          transparent: true, opacity: 0.92, side: THREE.DoubleSide,
        })
      case 'tijolo':
        return this.textured('tijolo', { roughness: 0.88 })
      case 'vidro':
        return new THREE.MeshPhysicalMaterial({
          vertexColors: true, color: 0xffffff, roughness: 0.06, metalness: 0.0,
          transmission: 0.0, opacity: 0.42, transparent: true,
          reflectivity: 0.6, clearcoat: 0.9, clearcoatRoughness: 0.05,
          envMapIntensity: 1.5, side: THREE.DoubleSide,
        })
      case 'vidroEscuro':
        return new THREE.MeshPhysicalMaterial({
          vertexColors: true, color: 0x1a2430, roughness: 0.09, metalness: 0.15,
          opacity: 0.86, transparent: true, clearcoat: 1, clearcoatRoughness: 0.04,
          envMapIntensity: 1.8,
        })
      case 'metal':
        return this.textured('metal', { roughness: 0.42, metalness: 0.85 })
      case 'cromo':
        return new THREE.MeshStandardMaterial({
          vertexColors: true, roughness: 0.12, metalness: 1, envMapIntensity: 1.6,
        })
      case 'madeira':
        return this.textured('madeira', { roughness: 0.62 })
      case 'madeiraEscura':
        return this.textured('madeiraEscura', { roughness: 0.55 })
      case 'azulejo':
        return this.textured('azulejo', { roughness: 0.22, metalness: 0.02 })
      case 'pisoInterno':
        return this.textured('pisoInterno', { roughness: 0.42 })
      case 'tecido':
        return this.textured('tecido', { roughness: 0.92 })
      case 'paralelepipedo':
        return this.textured('paralelepipedo', { roughness: 0.9 })
      case 'folhagem':
        return new THREE.MeshStandardMaterial({
          vertexColors: true, roughness: 0.86, metalness: 0,
          side: THREE.DoubleSide, alphaTest: 0.35,
        })
      case 'tronco':
        return this.textured('madeiraEscura', { roughness: 0.94 })
      case 'pintura':
        return new THREE.MeshPhysicalMaterial({
          vertexColors: true, roughness: 0.28, metalness: 0.35,
          clearcoat: 0.85, clearcoatRoughness: 0.12, envMapIntensity: 1.4,
        })
      case 'plastico':
        return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.02 })
      case 'borracha':
        return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 })
      case 'luz':
        return new THREE.MeshStandardMaterial({
          vertexColors: true, roughness: 0.4, metalness: 0,
          emissive: 0xffffff, emissiveIntensity: 1.0,
        })
      case 'telha':
        return this.textured('concreto', { roughness: 0.88 })
      case 'telhaCeramica':
        return this.textured('tijolo', { roughness: 0.9 })
      case 'vidroPredio':
        return this.textured('concreto', { roughness: 0.32, metalness: 0.15 })
      case 'toldo':
        return this.textured('tecido', { roughness: 0.88, side: THREE.DoubleSide })
      case 'rede':
        return new THREE.MeshStandardMaterial({
          vertexColors: true, roughness: 0.9, transparent: true, opacity: 0.45,
          side: THREE.DoubleSide, depthWrite: false,
        })
      default:
        return new THREE.MeshStandardMaterial({ vertexColors: true })
    }
  }

  /** Ajusta a intensidade emissiva das luzes artificiais conforme o horário. */
  setNightLights(intensity: number): void {
    const luz = this.cache.get('luz') as THREE.MeshStandardMaterial | undefined
    if (luz) luz.emissiveIntensity = intensity
  }

  setEnvironment(env: THREE.Texture | null): void {
    for (const m of this.cache.values()) {
      const s = m as THREE.MeshStandardMaterial
      if ('envMap' in s) { s.envMap = env; s.needsUpdate = true }
    }
    for (const m of this.upgraded) {
      const s = m as THREE.MeshStandardMaterial
      if ('envMap' in s) { s.envMap = env; s.needsUpdate = true }
    }
  }

  private upgraded = new Set<THREE.Material>()
  private cdnApplied = new Set<WorldMaterialKey>()

  /** Materiais que já receberam textura fotogramétrica. */
  get cdnKeys(): ReadonlySet<WorldMaterialKey> { return this.cdnApplied }

  /**
   * Troca os mapas procedurais de um material pelos fotogramétricos baixados.
   * Mantém cor de vértice, rugosidade base e o restante das propriedades.
   */
  applyCdnMaps(
    key: WorldMaterialKey,
    maps: { map?: THREE.Texture; normalMap?: THREE.Texture; roughnessMap?: THREE.Texture; aoMap?: THREE.Texture },
  ): void {
    const m = this.get(key) as THREE.MeshStandardMaterial
    if (!('map' in m)) return
    if (maps.map) m.map = maps.map
    if (maps.normalMap) { m.normalMap = maps.normalMap; m.normalScale = new THREE.Vector2(1.1, 1.1) }
    if (maps.roughnessMap) { m.roughnessMap = maps.roughnessMap; m.roughness = 1.0 }
    if (maps.aoMap) {
      m.aoMap = maps.aoMap
      // A geometria do mundo tem um único canal de UV.
      m.aoMap.channel = 0
      // Oclusão embutida forte deixa tudo com cara de encardido; entra apenas
      // como um reforço sutil dos sulcos.
      m.aoMapIntensity = 0.42
    }
    m.needsUpdate = true
    this.upgraded.add(m)
    this.cdnApplied.add(key)
  }

  dispose(): void {
    for (const m of this.cache.values()) m.dispose()
    this.cache.clear()
    this.textures.dispose()
  }
}

/** Paletas de cores coerentes com a direção de arte (fachadas brasileiras). */
export const PALETTE = {
  /** Fachadas de bairro: a variedade cromática é o que dá leitura brasileira. */
  fachadas: [
    0xf0e4c8, 0xe8d9a8, 0xf2c96b, 0xe6a94e, 0xd9825a, 0xc86b4a,
    0xe8e2d6, 0xdfe6dc, 0xbcd6c4, 0x9ec9bd, 0xa8c4de, 0x7fa8cc,
    0xf5efe2, 0xd6d0c2, 0xe0c7cf, 0xc9a9b8, 0xeadfcf, 0xcfd9c9,
  ],
  /** Centro: tons mais sóbrios e pedra, com alguns prédios claros. */
  fachadasCentro: [
    0xdfe3e6, 0xcdd4da, 0xb9c3cb, 0xe6e8ea, 0xa9b4bd, 0xd4d8db,
    0xe8dfc9, 0xcfc3a8, 0xbdc9d2, 0xf0ece2,
  ],
  /** Periferia: mais tijolo aparente, cal e cores fortes de tinta barata. */
  fachadasPeriferia: [
    0xd9c9a8, 0xc9b79a, 0xe0cfae, 0xbfa98a, 0xd3c4a6,
    0x9ec5d8, 0x7fb5a0, 0xe8b65a, 0xd4734f, 0xb85c4a,
    0xcdb9d0, 0xa8c4c0, 0xe6e0d2, 0xc4a678,
  ],
  /** Telhas cerâmicas e lajes. */
  telhados: [0x9c4f30, 0x8a4a34, 0xa85c38, 0x7b4230, 0xb06a40, 0x5b5f63, 0x474b4f],
  carros: [
    0xb8bcc0, 0x2e3338, 0xf1f2f3, 0x8c1f22, 0x1d3f6e, 0x2c6b4f,
    0xd8a32a, 0x5c5f66, 0x7a2f4a, 0x274c52, 0xe6e7e9, 0x3a3f45,
  ],
  pele: [0xf3d4bd, 0xe8c39e, 0xd9a878, 0xc08b5c, 0xa06a41, 0x7d4c2e, 0x5c3620, 0x422518],
  /** Naturais repetidas de propósito: tinturas fortes devem ser exceção. */
  cabelo: [
    0x120d0a, 0x120d0a, 0x1c130e, 0x2b1a12, 0x2b1a12, 0x3a2418, 0x4a2d1c,
    0x4a2d1c, 0x5e3a22, 0x6e4526, 0x8a5c33, 0x9a6b3c, 0xc9a86a,
    0x6b6b6b, 0x8a8a8a, 0xd8d5cf, 0x7a1f1f, 0x2b4a7a,
  ],
  roupas: [
    0xd83a3a, 0x2f5fb3, 0x2f9e5a, 0xf2c230, 0xe8e8e8, 0x2a2a2a, 0xf07c2a,
    0x8f3fb5, 0x1fb3c0, 0xc4577e, 0x3d5a3d, 0x9c2a4a, 0x1a2b4a, 0xd9d2c2,
  ],
} as const
