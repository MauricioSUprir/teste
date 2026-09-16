// Estado global + persistencia no localStorage. Um objeto so, salvo a cada
// mudanca; nada sai do dispositivo.
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Phrase, SaveData, SrsCard, LessonProgress } from './types'
import { makeCard, review as reviewCard, cardId } from '../lib/srs'
import { today, daysBetween, clamp } from '../lib/util'

const KEY = 'voca-ia:v1'
export const MAX_HEARTS = 5
const HEART_REFILL_MS = 20 * 60 * 1000

function emptySave(): SaveData {
  return {
    version: 1,
    profile: {
      name: '',
      difficulty: 'medio',
      levels: {},
      placed: [],
      mood: 'brutal',
      lang: 'en',
      langs: ['en'],
      dailyGoal: 50,
      voiceRate: 0.95,
      voiceName: null,
      sound: true,
      autoListen: true,
      showPt: true,
      onboarded: false,
    },
    xp: 0,
    hearts: MAX_HEARTS,
    heartsAt: Date.now(),
    streak: 0,
    bestStreak: 0,
    freezes: 1,
    lastStudyDay: null,
    lessons: {},
    srs: {},
    achievements: [],
    history: [],
    stats: { answers: 0, correct: 0, lessonsDone: 0, conversationTurns: 0, conversationSeconds: 0, wordsSpoken: 0 },
    weakSpots: {},
    account: null,
    plan: 'free',
    proUntil: null,
    syncedAt: null,
  }
}

function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptySave()
    const parsed = JSON.parse(raw) as SaveData
    return { ...emptySave(), ...parsed, profile: { ...emptySave().profile, ...parsed.profile } }
  } catch {
    return emptySave()
  }
}

/** Vidas voltam sozinhas com o tempo. */
function regenHearts(s: SaveData): SaveData {
  if (s.hearts >= MAX_HEARTS) return { ...s, heartsAt: Date.now() }
  const elapsed = Date.now() - s.heartsAt
  const gained = Math.floor(elapsed / HEART_REFILL_MS)
  if (gained <= 0) return s
  const hearts = Math.min(MAX_HEARTS, s.hearts + gained)
  return { ...s, hearts, heartsAt: hearts >= MAX_HEARTS ? Date.now() : s.heartsAt + gained * HEART_REFILL_MS }
}

export const ACHIEVEMENTS: { id: string; icon: string; title: string; desc: string }[] = [
  { id: 'first', icon: '🎬', title: 'Primeira lição', desc: 'Terminou a primeira lição.' },
  { id: 'streak3', icon: '🔥', title: '3 dias seguidos', desc: 'Estudou 3 dias sem falhar.' },
  { id: 'streak7', icon: '🏅', title: 'Uma semana', desc: '7 dias de ofensiva.' },
  { id: 'streak30', icon: '👑', title: 'Um mês inteiro', desc: '30 dias de ofensiva.' },
  { id: 'talk1', icon: '🗣️', title: 'Falou!', desc: 'Primeira conversa contínua.' },
  { id: 'talk50', icon: '🎙️', title: 'Tagarela', desc: '50 falas numa conversa.' },
  { id: 'poly2', icon: '🌍', title: 'Bilíngue em treino', desc: 'Estudou 2 idiomas.' },
  { id: 'poly4', icon: '🧠', title: 'Poliglota', desc: 'Estudou 4 idiomas.' },
  { id: 'xp500', icon: '⚡', title: '500 XP', desc: 'Juntou 500 pontos.' },
  { id: 'xp2000', icon: '💎', title: '2000 XP', desc: 'Juntou 2000 pontos.' },
  { id: 'srs50', icon: '📚', title: '50 frases firmes', desc: '50 frases na memória de longo prazo.' },
  { id: 'perfect', icon: '💯', title: 'Lição perfeita', desc: 'Terminou uma lição sem errar nada.' },
]

type Ctx = {
  save: SaveData
  set: (fn: (s: SaveData) => SaveData) => void
  patchProfile: (p: Partial<SaveData['profile']>) => void
  addXp: (n: number) => void
  loseHeart: () => void
  refillHearts: () => void
  recordAnswer: (correct: boolean) => void
  finishLesson: (langId: string, lessonId: string, accuracy: number, xp: number, phrases: Phrase[]) => string[]
  gradeCard: (id: string, quality: 0 | 1 | 2 | 3) => void
  addConversationCard: (p: Phrase, langId: string) => void
  noteWeakSpot: (what: string) => void
  logConversation: (turns: number, seconds: number, words: number) => string[]
  reset: () => void
  /** troca o save inteiro (usado ao trazer o progresso da nuvem) */
  replaceAll: (s: SaveData) => void
  minutesToHeart: number
}

const StoreContext = createContext<Ctx | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [save, setSave] = useState<SaveData>(() => regenHearts(load()))
  const saveRef = useRef(save)
  saveRef.current = save
  const [, force] = useState(0)

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(save))
  }, [save])

  // relogio das vidas
  useEffect(() => {
    const t = setInterval(() => {
      setSave((s) => regenHearts(s))
      force((n) => n + 1)
    }, 30000)
    return () => clearInterval(t)
  }, [])

  const api = useMemo<Ctx>(() => {
    const set = (fn: (s: SaveData) => SaveData) => setSave((s) => fn(s))

    const unlock = (s: SaveData, ids: string[]) => {
      const novos = ids.filter((id) => !s.achievements.includes(id))
      if (novos.length) s.achievements = [...s.achievements, ...novos]
      return novos
    }

    const touchDay = (s: SaveData, xp: number): SaveData => {
      const d = today()
      let streak = s.streak
      let freezes = s.freezes
      if (s.lastStudyDay !== d) {
        const gap = s.lastStudyDay ? daysBetween(s.lastStudyDay, d) : 1
        if (gap === 1) streak = s.streak + 1
        else if (gap > 1 && freezes > 0 && gap === 2) {
          freezes -= 1 // usa um congelamento e mantem a ofensiva
          streak = s.streak + 1
        } else if (gap > 1) streak = 1
        else streak = Math.max(1, s.streak)
      }
      const history = [...s.history]
      const idx = history.findIndex((h) => h.day === d)
      if (idx >= 0) history[idx] = { ...history[idx], xp: history[idx].xp + xp }
      else history.push({ day: d, xp, minutes: 0 })
      return {
        ...s,
        streak,
        freezes,
        bestStreak: Math.max(s.bestStreak, streak),
        lastStudyDay: d,
        history: history.slice(-120),
      }
    }

    return {
      save,
      set,
      patchProfile: (p) => set((s) => ({ ...s, profile: { ...s.profile, ...p } })),
      addXp: (n) =>
        set((s) => {
          const next = touchDay({ ...s, xp: s.xp + n }, n)
          unlock(next, [
            ...(next.xp >= 500 ? ['xp500'] : []),
            ...(next.xp >= 2000 ? ['xp2000'] : []),
            ...(next.streak >= 3 ? ['streak3'] : []),
            ...(next.streak >= 7 ? ['streak7'] : []),
            ...(next.streak >= 30 ? ['streak30'] : []),
          ])
          return next
        }),
      loseHeart: () =>
        set((s) => ({
          ...s,
          hearts: Math.max(0, s.hearts - 1),
          heartsAt: s.hearts === MAX_HEARTS ? Date.now() : s.heartsAt,
        })),
      refillHearts: () => set((s) => ({ ...s, hearts: MAX_HEARTS, heartsAt: Date.now() })),
      recordAnswer: (correct) =>
        set((s) => ({
          ...s,
          stats: { ...s.stats, answers: s.stats.answers + 1, correct: s.stats.correct + (correct ? 1 : 0) },
        })),
      finishLesson: (langId, lessonId, accuracy, xp, phrases) => {
        let novos: string[] = []
        set((s) => {
          const k = `${langId}:${lessonId}`
          const prev: LessonProgress = s.lessons[k] ?? { completed: false, stars: 0, bestAccuracy: 0, times: 0, lastAt: 0 }
          const stars = accuracy >= 0.95 ? 3 : accuracy >= 0.8 ? 2 : 1
          const srs = { ...s.srs }
          for (const p of phrases) {
            const id = cardId(langId + '|' + p.t)
            if (!srs[id]) srs[id] = makeCard(p, langId, 'lesson')
          }
          let next: SaveData = {
            ...s,
            srs,
            lessons: {
              ...s.lessons,
              [k]: {
                completed: true,
                stars: Math.max(prev.stars, stars),
                bestAccuracy: Math.max(prev.bestAccuracy, accuracy),
                times: prev.times + 1,
                lastAt: Date.now(),
              },
            },
            stats: { ...s.stats, lessonsDone: s.stats.lessonsDone + 1 },
            profile: { ...s.profile, langs: Array.from(new Set([...s.profile.langs, langId])) },
          }
          next = touchDay({ ...next, xp: next.xp + xp }, xp)
          const firmes = Object.values(next.srs).filter((c) => c.interval >= 7).length
          novos = unlock(next, [
            'first',
            ...(accuracy >= 1 ? ['perfect'] : []),
            ...(next.xp >= 500 ? ['xp500'] : []),
            ...(next.xp >= 2000 ? ['xp2000'] : []),
            ...(next.streak >= 3 ? ['streak3'] : []),
            ...(next.streak >= 7 ? ['streak7'] : []),
            ...(next.streak >= 30 ? ['streak30'] : []),
            ...(next.profile.langs.length >= 2 ? ['poly2'] : []),
            ...(next.profile.langs.length >= 4 ? ['poly4'] : []),
            ...(firmes >= 50 ? ['srs50'] : []),
          ])
          return next
        })
        return novos
      },
      gradeCard: (id, quality) =>
        set((s) => {
          const c = s.srs[id]
          if (!c) return s
          return { ...s, srs: { ...s.srs, [id]: reviewCard(c, quality) } }
        }),
      addConversationCard: (p, langId) =>
        set((s) => {
          const id = cardId(langId + '|' + p.t)
          if (s.srs[id]) return s
          const card: SrsCard = makeCard(p, langId, 'conversa')
          return { ...s, srs: { ...s.srs, [id]: card } }
        }),
      noteWeakSpot: (what) =>
        set((s) => ({ ...s, weakSpots: { ...s.weakSpots, [what]: (s.weakSpots[what] ?? 0) + 1 } })),
      logConversation: (turns, seconds, words) => {
        let novos: string[] = []
        set((s) => {
          const next: SaveData = {
            ...s,
            stats: {
              ...s.stats,
              conversationTurns: s.stats.conversationTurns + turns,
              conversationSeconds: s.stats.conversationSeconds + seconds,
              wordsSpoken: s.stats.wordsSpoken + words,
            },
          }
          novos = unlock(next, [
            ...(next.stats.conversationTurns >= 1 ? ['talk1'] : []),
            ...(next.stats.conversationTurns >= 50 ? ['talk50'] : []),
          ])
          return next
        })
        return novos
      },
      reset: () => setSave(emptySave()),
      replaceAll: (novo) => setSave({ ...emptySave(), ...novo, profile: { ...emptySave().profile, ...novo.profile } }),
      minutesToHeart:
        save.hearts >= MAX_HEARTS
          ? 0
          : clamp(Math.ceil((HEART_REFILL_MS - (Date.now() - save.heartsAt)) / 60000), 0, 20),
    }
  }, [save])

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>
}

export function useStore() {
  const c = useContext(StoreContext)
  if (!c) throw new Error('useStore fora do StoreProvider')
  return c
}

/** Nivel simples: cada 100 XP sobe um nivel. */
export function levelOf(xp: number) {
  return Math.floor(xp / 100) + 1
}
export function levelProgress(xp: number) {
  return (xp % 100) / 100
}
