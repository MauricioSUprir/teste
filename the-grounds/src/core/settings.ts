/** Configurações persistentes do jogo (gráficos, áudio, controles, acessibilidade). */

import { clamp } from './math'

export type QualityPreset = 'baixo' | 'medio' | 'alto' | 'ultra'
export type ShadowQuality = 'off' | 'baixo' | 'medio' | 'alto'
export type AAMode = 'off' | 'fxaa' | 'taa'

export interface GraphicsSettings {
  preset: QualityPreset
  /** Escala da resolução de renderização em relação ao tamanho do canvas (0.5 - 2.0). */
  renderScale: number
  /** Resolução de saída máxima desejada em largura (ex.: 3840 para 4K). 0 = seguir a janela. */
  outputWidthCap: number
  shadows: ShadowQuality
  /** Distância de visão em metros. */
  viewDistance: number
  /** Densidade de pedestres 0..1. */
  pedestrianDensity: number
  /** Densidade de tráfego 0..1. */
  trafficDensity: number
  antialias: AAMode
  ssao: boolean
  motionBlur: boolean
  bloom: boolean
  /** Resolução dinâmica: reduz renderScale para sustentar o alvo de fps. */
  dynamicResolution: boolean
  targetFps: number
  textureQuality: 'baixo' | 'medio' | 'alto'
  vegetationDensity: number
  anisotropy: number
}

export interface AudioSettings {
  master: number
  sfx: number
  music: number
  ambience: number
  voice: number
}

export interface GameplaySettings {
  fov: number
  sensitivity: number
  invertY: boolean
  /** Reduz balanço/tremor de câmera (acessibilidade). */
  reduceCameraMotion: boolean
  showMinimap: boolean
  showHud: boolean
  units: 'metrico'
  language: 'pt-BR'
  subtitles: boolean
  /** Perfil do apontador: 'auto' detecta trackpad pelo padrão do movimento. */
  pointerProfile: 'auto' | 'mouse' | 'trackpad'
  /** Suavização da câmera (0 = crua, 1 = bem suave). Não perde rotação. */
  lookSmoothing: number
}

export type ActionName =
  | 'frente' | 'tras' | 'esquerda' | 'direita'
  | 'correr' | 'pular' | 'agachar'
  | 'interagir' | 'entrarVeiculo' | 'trocarCamera' | 'primeiraPessoa'
  | 'chutar' | 'passar' | 'drible' | 'carrinho'
  | 'mapa' | 'foto' | 'pausa' | 'buzina' | 'freioMao' | 'faroisLuz'

export type KeyBindings = Record<ActionName, string>

export interface Settings {
  graphics: GraphicsSettings
  audio: AudioSettings
  gameplay: GameplaySettings
  bindings: KeyBindings
}

export const DEFAULT_BINDINGS: KeyBindings = {
  frente: 'KeyW',
  tras: 'KeyS',
  esquerda: 'KeyA',
  direita: 'KeyD',
  correr: 'ShiftLeft',
  pular: 'Space',
  agachar: 'ControlLeft',
  interagir: 'KeyE',
  entrarVeiculo: 'KeyF',
  trocarCamera: 'KeyV',
  primeiraPessoa: 'KeyC',
  chutar: 'KeyJ',
  passar: 'KeyK',
  drible: 'KeyL',
  carrinho: 'KeyH',
  mapa: 'KeyM',
  foto: 'KeyP',
  pausa: 'Escape',
  buzina: 'KeyB',
  freioMao: 'Space',
  faroisLuz: 'KeyN',
}

export const QUALITY_PRESETS: Record<QualityPreset, Partial<GraphicsSettings>> = {
  baixo: {
    renderScale: 0.7, shadows: 'off', viewDistance: 320, pedestrianDensity: 0.3,
    trafficDensity: 0.3, antialias: 'off', ssao: false, bloom: false, motionBlur: false,
    textureQuality: 'baixo', vegetationDensity: 0.3, anisotropy: 1,
  },
  medio: {
    renderScale: 0.9, shadows: 'baixo', viewDistance: 520, pedestrianDensity: 0.55,
    trafficDensity: 0.55, antialias: 'fxaa', ssao: false, bloom: true, motionBlur: false,
    textureQuality: 'medio', vegetationDensity: 0.6, anisotropy: 4,
  },
  alto: {
    renderScale: 1.0, shadows: 'medio', viewDistance: 750, pedestrianDensity: 0.8,
    trafficDensity: 0.8, antialias: 'fxaa', ssao: true, bloom: true, motionBlur: false,
    textureQuality: 'alto', vegetationDensity: 0.85, anisotropy: 8,
  },
  ultra: {
    renderScale: 1.0, shadows: 'alto', viewDistance: 1100, pedestrianDensity: 1,
    trafficDensity: 1, antialias: 'fxaa', ssao: true, bloom: true, motionBlur: false,
    textureQuality: 'alto', vegetationDensity: 1, anisotropy: 16,
  },
}

export function defaultSettings(): Settings {
  const base: GraphicsSettings = {
    preset: 'alto',
    renderScale: 1,
    outputWidthCap: 0,
    shadows: 'medio',
    viewDistance: 750,
    pedestrianDensity: 0.8,
    trafficDensity: 0.8,
    antialias: 'fxaa',
    ssao: true,
    bloom: true,
    motionBlur: false,
    dynamicResolution: true,
    targetFps: 60,
    textureQuality: 'alto',
    vegetationDensity: 0.85,
    anisotropy: 8,
  }
  return {
    graphics: base,
    audio: { master: 0.8, sfx: 0.9, music: 0.5, ambience: 0.8, voice: 1 },
    gameplay: {
      fov: 60, sensitivity: 1, invertY: false, reduceCameraMotion: false,
      showMinimap: true, showHud: true, units: 'metrico', language: 'pt-BR', subtitles: true,
      pointerProfile: 'auto', lookSmoothing: 0.35,
    },
    bindings: { ...DEFAULT_BINDINGS },
  }
}

export function applyPreset(g: GraphicsSettings, preset: QualityPreset): GraphicsSettings {
  return { ...g, ...QUALITY_PRESETS[preset], preset }
}

const STORAGE_KEY = 'thegrounds.settings.v1'

export function loadSettings(): Settings {
  const def = defaultSettings()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return def
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      graphics: { ...def.graphics, ...(parsed.graphics ?? {}) },
      audio: { ...def.audio, ...(parsed.audio ?? {}) },
      gameplay: { ...def.gameplay, ...(parsed.gameplay ?? {}) },
      bindings: { ...def.bindings, ...(parsed.bindings ?? {}) },
    }
  } catch {
    return def
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    /* armazenamento indisponível (aba privada): segue com valores em memória */
  }
}

export function sanitizeSettings(s: Settings): Settings {
  const g = s.graphics
  g.renderScale = clamp(g.renderScale, 0.5, 2)
  g.viewDistance = clamp(g.viewDistance, 150, 1600)
  g.pedestrianDensity = clamp(g.pedestrianDensity, 0, 1)
  g.trafficDensity = clamp(g.trafficDensity, 0, 1)
  g.vegetationDensity = clamp(g.vegetationDensity, 0, 1)
  g.targetFps = clamp(g.targetFps, 30, 240)
  s.gameplay.fov = clamp(s.gameplay.fov, 45, 100)
  s.gameplay.sensitivity = clamp(s.gameplay.sensitivity, 0.1, 5)
  s.gameplay.lookSmoothing = clamp(s.gameplay.lookSmoothing ?? 0.35, 0, 0.95)
  if (s.gameplay.pointerProfile !== 'mouse' && s.gameplay.pointerProfile !== 'trackpad') {
    s.gameplay.pointerProfile = 'auto'
  }
  for (const k of Object.keys(s.audio) as (keyof AudioSettings)[]) {
    s.audio[k] = clamp(s.audio[k], 0, 1)
  }
  return s
}
