import type { RankEntry, Settings } from './types'

const SETTINGS_KEY = 'dantes.settings'
const RANK_KEY = 'dantes.ranking'

export const DEFAULT_SETTINGS: Settings = {
  offline: (import.meta as any).env?.VITE_OFFLINE === 'true',
  minutes: 6,
  sound: true,
  voice: false,
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    /* ignora */
  }
  return { ...DEFAULT_SETTINGS }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {
    /* ok */
  }
}

/** Ranking TOP 10 do dia (guarda por data; so mostra o dia atual). */
interface RankStore {
  date: string
  entries: RankEntry[]
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function loadRanking(): RankEntry[] {
  try {
    const raw = localStorage.getItem(RANK_KEY)
    if (raw) {
      const store: RankStore = JSON.parse(raw)
      if (store.date === today() && Array.isArray(store.entries)) return store.entries
    }
  } catch {
    /* ignora */
  }
  return []
}

export function addToRanking(entry: RankEntry): { list: RankEntry[]; position: number } {
  const list = [...loadRanking(), entry]
    .sort((a, b) => b.score - a.score || a.timeUsed - b.timeUsed)
    .slice(0, 10)
  try {
    localStorage.setItem(RANK_KEY, JSON.stringify({ date: today(), entries: list }))
  } catch {
    /* ok */
  }
  return { list, position: list.indexOf(entry) }
}

export function resetRanking() {
  try {
    localStorage.removeItem(RANK_KEY)
  } catch {
    /* ok */
  }
}
