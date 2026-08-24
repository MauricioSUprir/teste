import { useState } from 'react'
import { useGame } from '../game/state'
import { Hud } from '../components/Hud'
import { sfxTap } from '../audio/sound'

const CARDS = [
  {
    title: 'MARSELHA, 1815',
    text: 'O jovem marinheiro Edmond Dantès foi preso no dia do próprio noivado, acusado por uma denúncia anônima de ser agente bonapartista. Sumiu sem julgamento.',
  },
  {
    title: 'ARQUIVO REABERTO, 2026',
    text: 'Uma IA forense reabriu o caso e digitalizou o arquivo: documentos, mapas e registros apontam que a denúncia foi uma armação.',
  },
  {
    title: 'SUA MISSÃO',
    text: 'Analise as 6 evidências, interrogue os 3 suspeitos, capture as 3 contradições e carimbe a acusação certa. O relógio está correndo, detetive.',
  },
]

export function Briefing() {
  const { dispatch, goto } = useGame()
  const [i, setI] = useState(0)

  const next = () => {
    sfxTap()
    if (i < CARDS.length - 1) {
      setI(i + 1)
    } else {
      dispatch({ type: 'START_TIMER' })
      goto('evidence')
    }
  }

  return (
    <div className="screen">
      <Hud />
      <div className="wrap" style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
        <div className="paper" style={{ width: 'min(480px, 92vw)', minHeight: 220 }} onClick={next}>
          <span className="tape">DOSSIÊ {i + 1}/3</span>
          <h3 className="stamp-title" style={{ marginBottom: 10, fontSize: '1.4rem' }}>
            {CARDS[i].title}
          </h3>
          <p style={{ fontSize: '1.05rem', lineHeight: 1.5 }}>{CARDS[i].text}</p>
        </div>
        <button className="btn big" onClick={next}>
          {i < CARDS.length - 1 ? 'PRÓXIMO ▸' : 'ABRIR A SALA DE EVIDÊNCIAS 🔍'}
        </button>
      </div>
    </div>
  )
}
