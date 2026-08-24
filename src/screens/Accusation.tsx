import { useState } from 'react'
import { useGame } from '../game/state'
import { Hud } from '../components/Hud'
import { Confetti } from '../components/Confetti'
import type { AccusedId } from '../game/types'
import { sfxError, sfxFanfare, sfxStamp, sfxTap } from '../audio/sound'
import { POINTS } from '../game/scoring'

const FICHAS: Array<{ id: AccusedId; name: string; role: string; emoji: string }> = [
  { id: 'danglars', name: 'Danglars', role: 'guarda-livros', emoji: '🖋️' },
  { id: 'fernand', name: 'Fernand', role: 'pescador catalão', emoji: '🎣' },
  { id: 'villefort', name: 'Villefort', role: 'procurador do rei', emoji: '⚖️' },
  { id: 'caderousse', name: 'Caderousse', role: 'taberneiro', emoji: '🍷' },
  { id: 'mercedes', name: 'Mercédès', role: 'noiva de Edmond', emoji: '👩' },
  { id: 'morrel', name: 'Morrel', role: 'armador do Pharaon', emoji: '🚢' },
]

const CULPADOS: AccusedId[] = ['danglars', 'fernand', 'villefort']
const NOMES: Record<AccusedId, string> = {
  danglars: 'Danglars',
  fernand: 'Fernand',
  villefort: 'Villefort',
  caderousse: 'Caderousse',
  mercedes: 'Mercédès',
  morrel: 'Morrel',
}

export function Accusation() {
  const { dispatch, goto } = useGame()
  const [marked, setMarked] = useState<AccusedId[]>([])
  const [feedback, setFeedback] = useState<string[] | null>(null)
  const [solved, setSolved] = useState(false)
  const [stamping, setStamping] = useState(false)

  const toggle = (id: AccusedId) => {
    if (solved) return
    sfxStamp()
    setMarked((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]))
  }

  const carimbar = () => {
    if (marked.length === 0 || stamping || solved) return
    setStamping(true)
    sfxStamp()
    setTimeout(() => {
      setStamping(false)
      const correct =
        marked.length === CULPADOS.length && CULPADOS.every((c) => marked.includes(c))
      if (correct) {
        setSolved(true)
        setFeedback(null)
        dispatch({ type: 'ACCUSE_SUCCESS' })
        sfxFanfare()
      } else {
        const dicas: string[] = []
        for (const m of marked) {
          if (!CULPADOS.includes(m)) dicas.push(`Você acusou um inocente: ${NOMES[m]}.`)
        }
        const faltam = CULPADOS.filter((c) => !marked.includes(c)).length
        if (faltam > 0) dicas.push(`Ainda falta${faltam > 1 ? 'm' : ''} ${faltam} culpado${faltam > 1 ? 's' : ''}.`)
        setFeedback(dicas)
        dispatch({ type: 'ACCUSE_FAIL' })
        sfxError()
      }
    }, 700)
  }

  if (solved) {
    return (
      <div className="screen">
        <Confetti />
        <Hud />
        <div className="wrap" style={{ alignItems: 'center', textAlign: 'center' }}>
          <div className="stamp hit" style={{ fontSize: '2rem' }}>
            CASO RESOLVIDO
          </div>
          <div className="paper" style={{ maxWidth: 520 }}>
            <span className="tape">A VERDADE DE 1815</span>
            <p style={{ lineHeight: 1.55, fontSize: '0.95rem' }}>
              No romance de Dumas, <b>Danglars</b> escreveu a denúncia por inveja do posto de
              capitão; <b>Fernand</b> a levou ao correio por ciúme de Mercédès; e <b>Villefort</b>{' '}
              queimou a carta endereçada ao próprio pai, Noirtier, e enterrou Edmond no Château
              d'If para salvar a carreira. Caderousse sabia e calou. Catorze anos depois, Edmond
              voltaria como o Conde de Monte Cristo.
            </p>
            <p className="stamp-title" style={{ marginTop: 12, fontSize: '1.2rem' }}>
              “Esperar e confiar.”
            </p>
          </div>
          <button className="btn big" onClick={() => goto('result')}>
            VER MINHA PONTUAÇÃO ▸
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
          ACUSAÇÃO FINAL
        </h2>
        <p className="mono" style={{ textAlign: 'center', color: 'var(--manila)', fontSize: '0.85rem' }}>
          Marque com X TODOS os culpados pela prisão de Edmond Dantès — e só eles.
        </p>
        <div className="accuse-grid">
          {FICHAS.map((f) => (
            <button key={f.id} className="accuse-card" onClick={() => toggle(f.id)}>
              <div style={{ fontSize: '2rem' }}>{f.emoji}</div>
              <b>{f.name}</b>
              <br />
              <small>{f.role}</small>
              {marked.includes(f.id) && <span className="x-stamp hit">✗</span>}
            </button>
          ))}
        </div>

        {feedback && (
          <div className="paper shake" style={{ borderLeft: '6px solid var(--lacre)' }}>
            <b className="stamp-title">ACUSAÇÃO REJEITADA (−{POINTS.accusationPenalty} pts)</b>
            <ul style={{ marginTop: 6, paddingLeft: 18, fontSize: '0.9rem' }}>
              {feedback.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
            <p className="mono" style={{ fontSize: '0.78rem', marginTop: 6 }}>
              Corrija as fichas e carimbe de novo.
            </p>
          </div>
        )}

        <button
          className={`btn big ${stamping ? 'shake' : ''}`}
          disabled={marked.length === 0}
          onClick={carimbar}
        >
          🔴 CARIMBAR ACUSAÇÃO ({marked.length} marcado{marked.length !== 1 ? 's' : ''})
        </button>
        <button className="btn secondary" onClick={() => { sfxTap(); goto('interrogation') }}>
          ◂ VOLTAR AO INTERROGATÓRIO
        </button>
      </div>
    </div>
  )
}
