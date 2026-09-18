// Ajuda durante a questão: primeiro uma dica de graça (local), depois o Voca
// dá uma pista de verdade — sem nunca entregar a resposta inteira.
import { useState } from 'react'
import { hint as aiHint, offlineHint } from '../lib/tutor'
import { canUse } from '../lib/plan'
import { useStore } from '../state/store'
import type { Phrase } from '../state/types'

export function HintBar({
  phrase,
  prompt,
  given,
  langName,
  level,
  onUse,
  onPaywall,
}: {
  phrase: Phrase
  prompt: string
  given: string
  langName: string
  level: string
  onUse: () => void
  onPaywall: () => void
}) {
  const { save } = useStore()
  const [dicas, setDicas] = useState<string[]>([])
  const [carregando, setCarregando] = useState(false)
  const usos = dicas.length

  function dicaLocal() {
    onUse()
    setDicas((d) => [...d, offlineHint(phrase.t, d.length + 1, phrase.tip)])
  }

  async function pedirAoVoca() {
    if (!canUse(save, 'dica-ia')) return onPaywall()
    onUse()
    setCarregando(true)
    try {
      const r = await aiHint({
        langName,
        prompt,
        correct: phrase.t,
        given,
        level,
        strength: usos >= 1 ? 2 : 1,
      })
      setDicas((d) => [...d, '' + r.hint])
    } catch {
      setDicas((d) => [...d, offlineHint(phrase.t, d.length + 1, phrase.tip)])
    }
    setCarregando(false)
  }

  return (
    <div className="hintbar">
      <div className="hint-btns">
        <button className="btn ghost sm" onClick={dicaLocal} disabled={usos >= 2}>dica</button>
        <button className="btn ghost sm" onClick={pedirAoVoca} disabled={carregando}>
          {carregando ? 'pensando…' : 'pedir ajuda ao Voca'}
        </button>
      </div>
      {dicas.map((d, i) => (
        <p key={i} className="hint">{d}</p>
      ))}
    </div>
  )
}
