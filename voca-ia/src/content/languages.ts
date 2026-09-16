// Registro dos 10 idiomas. Cada um traz seu curriculo e o locale usado
// pela voz (TTS) e pelo reconhecimento de fala (STT).
import type { Unit } from '../state/types'
import { EN_UNITS } from './langs/en'
import { ES_UNITS } from './langs/es'
import { FR_UNITS } from './langs/fr'
import { IT_UNITS } from './langs/it'
import { DE_UNITS } from './langs/de'
import { JA_UNITS } from './langs/ja'
import { KO_UNITS } from './langs/ko'
import { ZH_UNITS } from './langs/zh'
import { RU_UNITS } from './langs/ru'
import { AR_UNITS } from './langs/ar'

export type LangDef = {
  id: string
  name: string
  native: string
  flag: string
  /** BCP-47 usado na voz e no microfone */
  locale: string
  /** idioma escrito da direita para a esquerda */
  rtl?: boolean
  /** tem transliteracao aceita como resposta */
  romanized?: boolean
  /** nome do sistema de transliteracao, para a interface */
  romName?: string
  units: Unit[]
}

export const LANGUAGES: LangDef[] = [
  { id: 'en', name: 'Inglês', native: 'English', flag: '🇬🇧', locale: 'en-US', units: EN_UNITS },
  { id: 'es', name: 'Espanhol', native: 'Español', flag: '🇪🇸', locale: 'es-ES', units: ES_UNITS },
  { id: 'fr', name: 'Francês', native: 'Français', flag: '🇫🇷', locale: 'fr-FR', units: FR_UNITS },
  { id: 'it', name: 'Italiano', native: 'Italiano', flag: '🇮🇹', locale: 'it-IT', units: IT_UNITS },
  { id: 'de', name: 'Alemão', native: 'Deutsch', flag: '🇩🇪', locale: 'de-DE', units: DE_UNITS },
  { id: 'ja', name: 'Japonês', native: '日本語', flag: '🇯🇵', locale: 'ja-JP', romanized: true, romName: 'romaji', units: JA_UNITS },
  { id: 'ko', name: 'Coreano', native: '한국어', flag: '🇰🇷', locale: 'ko-KR', romanized: true, romName: 'romanização', units: KO_UNITS },
  { id: 'zh', name: 'Mandarim', native: '中文', flag: '🇨🇳', locale: 'zh-CN', romanized: true, romName: 'pinyin', units: ZH_UNITS },
  { id: 'ru', name: 'Russo', native: 'Русский', flag: '🇷🇺', locale: 'ru-RU', romanized: true, romName: 'transliteração', units: RU_UNITS },
  { id: 'ar', name: 'Árabe', native: 'العربية', flag: '🇸🇦', locale: 'ar-SA', rtl: true, romanized: true, romName: 'transliteração', units: AR_UNITS },
]

export function getLang(id: string): LangDef {
  return LANGUAGES.find((l) => l.id === id) ?? LANGUAGES[0]
}

export function findLesson(langId: string, lessonId: string) {
  const lang = getLang(langId)
  for (const u of lang.units) {
    const l = u.lessons.find((x) => x.id === lessonId)
    if (l) return { unit: u, lesson: l }
  }
  return null
}

/** Chave usada no progresso: idioma + licao. */
export function key(langId: string, lessonId: string) {
  return `${langId}:${lessonId}`
}
