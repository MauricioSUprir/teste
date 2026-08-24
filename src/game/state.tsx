import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import type { EvidenceId, Screen, Session, Settings, SuspectId } from './types'
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './storage'
import { POINTS } from './scoring'
import { setMuted } from '../audio/sound'
import { setVoiceEnabled, stopSpeaking } from '../audio/voice'

const emptyEvidence = () => ({
  ev1: { done: false, points: 0 },
  ev2: { done: false, points: 0 },
  ev3: { done: false, points: 0 },
  ev4: { done: false, points: 0 },
  ev5: { done: false, points: 0 },
  ev6: { done: false, points: 0 },
})

const emptyContradictions = () => ({ danglars: false, fernand: false, villefort: false })

function freshSession(minutes: number, viaQr: boolean): Session {
  return {
    name: '',
    badge: '🕵️',
    score: 0,
    timeLeft: minutes * 60,
    running: false,
    evidence: emptyEvidence(),
    contradictions: emptyContradictions(),
    accusationAttempts: 0,
    solved: false,
    viaQr,
  }
}

export interface GameState {
  screen: Screen
  settings: Settings
  session: Session
  viaQr: boolean
}

type Action =
  | { type: 'GOTO'; screen: Screen }
  | { type: 'REGISTER'; name: string; badge: string }
  | { type: 'START_TIMER' }
  | { type: 'TICK' }
  | { type: 'EVIDENCE_DONE'; id: EvidenceId; points: number }
  | { type: 'CONTRADICTION'; suspect: SuspectId }
  | { type: 'ACCUSE_FAIL' }
  | { type: 'ACCUSE_SUCCESS' }
  | { type: 'RESET' }
  | { type: 'SET_SETTINGS'; settings: Settings }
  | { type: 'SET_VIAQR'; viaQr: boolean }

function reducer(state: GameState, action: Action): GameState {
  const s = state.session
  switch (action.type) {
    case 'GOTO':
      return { ...state, screen: action.screen }
    case 'REGISTER':
      return {
        ...state,
        screen: 'briefing',
        session: { ...freshSession(state.settings.minutes, state.viaQr), name: action.name, badge: action.badge },
      }
    case 'START_TIMER':
      return { ...state, session: { ...s, running: true } }
    case 'TICK': {
      if (!s.running || s.timeLeft <= 0) return state
      return { ...state, session: { ...s, timeLeft: s.timeLeft - 1 } }
    }
    case 'EVIDENCE_DONE':
      if (s.evidence[action.id].done) return state
      return {
        ...state,
        session: {
          ...s,
          score: s.score + action.points,
          evidence: { ...s.evidence, [action.id]: { done: true, points: action.points } },
        },
      }
    case 'CONTRADICTION':
      if (s.contradictions[action.suspect]) return state
      return {
        ...state,
        session: {
          ...s,
          score: s.score + POINTS.contradiction,
          contradictions: { ...s.contradictions, [action.suspect]: true },
        },
      }
    case 'ACCUSE_FAIL':
      return {
        ...state,
        session: {
          ...s,
          score: Math.max(0, s.score - POINTS.accusationPenalty),
          accusationAttempts: s.accusationAttempts + 1,
        },
      }
    case 'ACCUSE_SUCCESS': {
      const timeBonus = s.timeLeft * POINTS.timeBonusPerSecond
      return {
        ...state,
        session: {
          ...s,
          running: false,
          solved: true,
          score: s.score + POINTS.accusation + timeBonus,
          accusationAttempts: s.accusationAttempts + 1,
        },
      }
    }
    case 'RESET':
      return {
        ...state,
        screen: 'attract',
        viaQr: false,
        session: freshSession(state.settings.minutes, false),
      }
    case 'SET_SETTINGS':
      return { ...state, settings: action.settings }
    case 'SET_VIAQR':
      return { ...state, viaQr: action.viaQr, session: { ...s, viaQr: action.viaQr } }
    default:
      return state
  }
}

interface GameCtx {
  state: GameState
  dispatch: React.Dispatch<Action>
  goto: (screen: Screen) => void
  updateSettings: (patch: Partial<Settings>) => void
}

const Ctx = createContext<GameCtx | null>(null)

export function GameProvider({ children, viaQr }: { children: React.ReactNode; viaQr: boolean }) {
  const initialSettings = useMemo(loadSettings, [])
  const [state, dispatch] = useReducer(reducer, {
    screen: 'attract',
    settings: initialSettings,
    session: freshSession(initialSettings.minutes, viaQr),
    viaQr,
  })

  // aplica mute/voz nas engines de audio
  useEffect(() => {
    setMuted(!state.settings.sound)
    setVoiceEnabled(state.settings.voice)
  }, [state.settings.sound, state.settings.voice])

  // cronometro global
  const running = state.session.running && state.session.timeLeft > 0
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => dispatch({ type: 'TICK' }), 1000)
    return () => clearInterval(t)
  }, [running])

  // tempo esgotado durante o jogo -> vai direto para a acusacao final
  const outOfTime =
    state.session.running &&
    state.session.timeLeft <= 0 &&
    (state.screen === 'evidence' || state.screen === 'interrogation' || state.screen === 'briefing')
  useEffect(() => {
    if (outOfTime) dispatch({ type: 'GOTO', screen: 'accusation' })
  }, [outOfTime])

  // reset por inatividade (90s) em qualquer tela fora do attract
  const lastActivity = useRef(Date.now())
  useEffect(() => {
    const bump = () => (lastActivity.current = Date.now())
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'pointermove', 'keydown', 'touchstart']
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }))
    const check = setInterval(() => {
      if (Date.now() - lastActivity.current > 90_000) {
        stopSpeaking()
        dispatch({ type: 'RESET' })
        lastActivity.current = Date.now()
      }
    }, 5000)
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump))
      clearInterval(check)
    }
  }, [])

  const api = useMemo<GameCtx>(
    () => ({
      state,
      dispatch,
      goto: (screen) => dispatch({ type: 'GOTO', screen }),
      updateSettings: (patch) => {
        const next = { ...state.settings, ...patch }
        saveSettings(next)
        dispatch({ type: 'SET_SETTINGS', settings: next })
      },
    }),
    [state],
  )

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useGame(): GameCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useGame fora do GameProvider')
  return ctx
}

export { DEFAULT_SETTINGS }
