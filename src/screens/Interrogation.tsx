import { useEffect, useRef, useState } from 'react'
import { useGame } from '../game/state'
import { Hud } from '../components/Hud'
import { SUSPECTS, getSuspect, offlineReply, type Suspect } from '../data/suspects'
import type { ChatMsg, SuspectId } from '../game/types'
import { sfxContradiction, sfxKey, sfxTap, startHeartbeat, stopHeartbeat } from '../audio/sound'
import { speak, stopSpeaking } from '../audio/voice'
import { POINTS } from '../game/scoring'

// Historico de chat por suspeito (fora do React para sobreviver a troca de telas)
const chatStore: Record<SuspectId, ChatMsg[]> = { danglars: [], fernand: [], villefort: [] }

export function clearChats() {
  chatStore.danglars = []
  chatStore.fernand = []
  chatStore.villefort = []
}

async function onlineReply(suspect: Suspect, history: ChatMsg[], playerText: string): Promise<string> {
  const messages = [
    ...history.map((m) => ({
      role: m.from === 'player' ? 'user' : 'assistant',
      content: m.text,
    })),
    { role: 'user', content: playerText },
  ]
  const res = await fetch('/api/interrogar', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ system: suspect.systemPrompt, messages }),
  })
  if (!res.ok) throw new Error(`api ${res.status}`)
  const data = await res.json()
  if (!data.text) throw new Error('resposta vazia')
  return data.text as string
}

export function Interrogation() {
  const { state, dispatch, goto } = useGame()
  const [suspectId, setSuspectId] = useState<SuspectId>('danglars')
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [overlay, setOverlay] = useState<{ suspect: string; excerpt: string } | null>(null)
  const [, forceRender] = useState(0)
  const chatRef = useRef<HTMLDivElement>(null)

  const suspect = getSuspect(suspectId)
  const history = chatStore[suspectId]

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight })
  })

  useEffect(() => () => {
    stopHeartbeat()
    stopSpeaking()
  }, [])

  const send = async (text: string, intentHint: string | null) => {
    const clean = text.trim()
    if (!clean || typing) return
    setInput('')
    history.push({ from: 'player', text: clean })
    forceRender((n) => n + 1)
    setTyping(true)
    startHeartbeat()

    const priorCount = history.filter((m) => m.from === 'suspect').length
    let reply: string
    if (state.settings.offline) {
      await new Promise((r) => setTimeout(r, 900 + Math.random() * 800))
      reply = offlineReply(suspect, clean, intentHint, priorCount)
    } else {
      try {
        reply = await onlineReply(suspect, history.slice(0, -1), clean)
      } catch {
        // API caiu -> arvore roteirizada (modo offline obrigatorio)
        reply = offlineReply(suspect, clean, intentHint, priorCount)
      }
    }

    stopHeartbeat()
    setTyping(false)

    const isNew = !state.session.contradictions[suspectId]
    const match = suspect.contradictionRegex.exec(reply)
    const contradiction = Boolean(match) && isNew
    history.push({ from: 'suspect', text: reply, contradiction })
    forceRender((n) => n + 1)
    speak(reply, suspectId)

    if (contradiction && match) {
      dispatch({ type: 'CONTRADICTION', suspect: suspectId })
      sfxContradiction()
      const idx = reply.toLowerCase().indexOf(match[0].toLowerCase().slice(0, 12))
      const excerpt =
        idx >= 0 ? `“…${reply.slice(Math.max(0, idx - 30), idx + 90)}…”` : `“${reply.slice(0, 110)}…”`
      setOverlay({ suspect: suspect.name, excerpt })
    }
  }

  const cCount = Object.values(state.session.contradictions).filter(Boolean).length

  return (
    <div className="screen">
      <Hud />
      <div className="wrap">
        <div className="suspect-tabs">
          {SUSPECTS.map((s) => (
            <button
              key={s.id}
              className={s.id === suspectId ? 'sel' : ''}
              onClick={() => {
                stopSpeaking()
                setSuspectId(s.id)
                sfxTap()
              }}
            >
              {s.emoji} {s.name}
              {state.session.contradictions[s.id] ? ' ⚡' : ''}
              <br />
              <small style={{ opacity: 0.7 }}>{s.tone}</small>
            </button>
          ))}
        </div>

        <div className="chat" ref={chatRef}>
          {history.length === 0 && (
            <p className="mono" style={{ opacity: 0.6, fontSize: '0.8rem', textAlign: 'center' }}>
              {suspect.emoji} {suspect.name} — {suspect.role}. Faça uma pergunta ou use um confronto.
            </p>
          )}
          {history.map((m, i) => (
            <div key={i} className={`msg ${m.from} ${m.contradiction ? 'contradiction' : ''}`}>
              {m.contradiction && <b>⚡ </b>}
              {m.text}
            </div>
          ))}
          {typing && (
            <div className="msg suspect pulse mono" style={{ opacity: 0.8 }}>
              {suspect.name} está digitando…
            </div>
          )}
        </div>

        <div className="confronts">
          {suspect.confronts.map((c) => {
            const unlocked = state.session.evidence[c.needsEvidence].done
            return (
              <button
                key={c.intent}
                disabled={!unlocked || typing}
                onClick={() => send(c.playerLine, c.intent)}
              >
                {unlocked ? c.label : `🔒 ${c.label} (complete ${c.needsEvidence.toUpperCase().replace('EV', 'EV-0')})`}
              </button>
            )
          })}
        </div>

        <div className="chat-input">
          <input
            value={input}
            placeholder={`Pergunte a ${suspect.name}…`}
            onChange={(e) => {
              setInput(e.target.value)
              sfxKey()
            }}
            onKeyDown={(e) => e.key === 'Enter' && send(input, null)}
          />
          <button className="btn" disabled={typing || !input.trim()} onClick={() => send(input, null)}>
            ▶
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn secondary" onClick={() => goto('evidence')}>
            ◂ EVIDÊNCIAS
          </button>
          <button className="btn" onClick={() => goto('accusation')}>
            ⚖️ ACUSAÇÃO FINAL {cCount < 3 ? `(⚡ ${cCount}/3)` : '▸'}
          </button>
        </div>
      </div>

      {overlay && (
        <div className="overlay-contradiction" onPointerDown={() => setOverlay(null)}>
          <h2>⚡ CONTRADIÇÃO DETECTADA +{POINTS.contradiction}</h2>
          <p className="mono" style={{ color: 'var(--manila)' }}>
            {overlay.suspect} se entregou:
          </p>
          <div className="paper" style={{ maxWidth: 460 }}>
            <p className="mono" style={{ fontSize: '0.9rem' }}>{overlay.excerpt}</p>
          </div>
          <button className="btn" onClick={() => setOverlay(null)}>
            ANOTADO NO DOSSIÊ ✔
          </button>
        </div>
      )}
    </div>
  )
}
