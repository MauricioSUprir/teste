import { useMemo, useRef, useState } from 'react'
import { useGame } from '../game/state'
import { Hud } from '../components/Hud'
import { EVIDENCES, getEvidence } from '../data/evidence'
import type { EvidenceId } from '../game/types'
import { evidenceScore } from '../game/scoring'
import { sfxStamp, sfxTap } from '../audio/sound'
import { GameEv1, GameEv2, GameEv3, GameEv4, GameEv5, GameEv6 } from './minigames/games'

const GAMES: Record<EvidenceId, React.ComponentType<{ onError: () => void; onComplete: () => void }>> = {
  ev1: GameEv1,
  ev2: GameEv2,
  ev3: GameEv3,
  ev4: GameEv4,
  ev5: GameEv5,
  ev6: GameEv6,
}

export function EvidenceRoom() {
  const { state, dispatch, goto } = useGame()
  const [active, setActive] = useState<EvidenceId | null>(null)
  const [summary, setSummary] = useState<{ id: EvidenceId; points: number } | null>(null)
  const startRef = useRef(0)
  const errorsRef = useRef(0)

  const doneCount = useMemo(
    () => Object.values(state.session.evidence).filter((e) => e.done).length,
    [state.session.evidence],
  )

  const open = (id: EvidenceId) => {
    if (state.session.evidence[id].done) return
    sfxTap()
    errorsRef.current = 0
    startRef.current = Date.now()
    setActive(id)
  }

  const complete = () => {
    if (!active) return
    const elapsed = (Date.now() - startRef.current) / 1000
    const points = evidenceScore(elapsed, errorsRef.current)
    dispatch({ type: 'EVIDENCE_DONE', id: active, points })
    setSummary({ id: active, points })
    setActive(null)
    sfxStamp()
  }

  if (active) {
    const Game = GAMES[active]
    const meta = getEvidence(active)
    return (
      <div className="screen">
        <Hud />
        <div className="wrap">
          <h2 className="stamp-title" style={{ textAlign: 'center' }}>
            {meta.code} · {meta.title} — {meta.game}
          </h2>
          <Game onError={() => (errorsRef.current += 1)} onComplete={complete} />
          <button className="btn secondary" onClick={() => setActive(null)}>
            ◂ VOLTAR (sem concluir)
          </button>
        </div>
      </div>
    )
  }

  if (summary) {
    const meta = getEvidence(summary.id)
    return (
      <div className="screen">
        <Hud />
        <div className="wrap" style={{ alignItems: 'center' }}>
          <div className="stamp hit" style={{ fontSize: '1.2rem' }}>
            EVIDÊNCIA ARQUIVADA +{summary.points} pts
          </div>
          <div className="paper" style={{ width: 'min(480px, 92vw)' }}>
            <span className="tape">{meta.code} · CARTÃO-RESUMO</span>
            <h3 className="stamp-title" style={{ fontSize: '1.3rem', marginBottom: 8 }}>
              {meta.icon} {meta.title}
            </h3>
            <p style={{ marginBottom: 10 }}>{meta.docSummary}</p>
            <p className="mono glitch" style={{ fontSize: '0.82rem', color: '#2e5c2b', borderTop: '1px dashed var(--ink)', paddingTop: 8 }}>
              🤖 {meta.aiAnalysis}
            </p>
          </div>
          <button className="btn big" onClick={() => setSummary(null)}>
            CONTINUAR ▸
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <Hud />
      <div className="wrap">
        <h2 className="stamp-title" style={{ textAlign: 'center', fontSize: '1.6rem' }}>
          SALA DE EVIDÊNCIAS
        </h2>
        <p className="mono" style={{ textAlign: 'center', color: 'var(--manila)', fontSize: '0.85rem' }}>
          Complete os 6 exames forenses. Cada um desbloqueia confrontos no interrogatório.
        </p>
        <div className="ev-grid">
          {EVIDENCES.map((ev) => {
            const st = state.session.evidence[ev.id]
            return (
              <button key={ev.id} className={`ev-card ${st.done ? 'done' : ''}`} onClick={() => open(ev.id)}>
                <span className="icon">{st.done ? '✅' : ev.icon}</span>
                <b>{ev.code}</b>
                <span style={{ fontSize: '0.78rem' }}>{ev.title}</span>
                <small>{st.done ? `+${st.points} pts` : ev.game}</small>
              </button>
            )
          })}
        </div>
        <button className="btn big" onClick={() => goto('interrogation')}>
          🎙️ IR AO INTERROGATÓRIO {doneCount < 6 ? `(${doneCount}/6 evidências)` : '▸'}
        </button>
        {doneCount === 6 && (
          <button className="btn secondary" onClick={() => goto('accusation')}>
            ⚖️ PULAR PARA A ACUSAÇÃO FINAL
          </button>
        )}
      </div>
    </div>
  )
}
