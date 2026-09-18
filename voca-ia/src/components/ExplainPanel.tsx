// "Explicaçãozinha": o Voca explica POR QUE errou — e a pessoa pode continuar
// perguntando ali mesmo, num chat preso ao contexto daquela questão.
import { useEffect, useRef, useState } from 'react'
import { explain, offlineExplanation, ask, type Explanation } from '../lib/tutor'
import { speak } from '../lib/speech'
import { useStore } from '../state/store'
import { canUse } from '../lib/plan'
import { getMood } from '../content/moods'
import { Voca } from './Voca'
import type { Phrase } from '../state/types'

type Msg = { role: 'user' | 'voca'; text: string; examples?: string[] }

export function ExplainPanel({
  phrase,
  given,
  prompt,
  langName,
  locale,
  level,
  lessonTitle,
  grammar,
  onClose,
  onPaywall,
}: {
  phrase: Phrase
  given: string
  prompt: string
  langName: string
  locale: string
  level: string
  lessonTitle?: string
  grammar?: { title: string; body: string }
  onClose: () => void
  onPaywall: () => void
}) {
  const { save } = useStore()
  const mood = getMood(save.profile.mood)
  const [exp, setExp] = useState<Explanation | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [q, setQ] = useState('')
  const [pensando, setPensando] = useState(false)
  const fim = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!canUse(save, 'explicacao')) {
      onPaywall()
      return
    }
    let vivo = true
    explain({
      langName,
      prompt,
      correct: phrase.t,
      given,
      lessonTitle,
      grammar: grammar ? `${grammar.title}: ${grammar.body}` : undefined,
      level,
      mood: save.profile.mood,
    })
      .then((e) => vivo && setExp(e))
      .catch((e) => {
        if (!vivo) return
        setErro(e instanceof Error ? e.message : 'falhou')
        setExp(offlineExplanation(phrase, given, grammar))
      })
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, pensando])

  async function perguntar(texto: string) {
    const t = texto.trim()
    if (!t) return
    if (!canUse(save, 'duvidas')) return onPaywall()
    setQ('')
    setMsgs((m) => [...m, { role: 'user', text: t }])
    setPensando(true)
    try {
      const r = await ask({
        langName,
        question: t,
        level,
        context: { prompt, correct: phrase.t, given, explanation: exp?.rule },
        history: msgs,
      })
      setMsgs((m) => [...m, { role: 'voca', text: r.answer, examples: r.examples }])
    } catch (e) {
      setMsgs((m) => [
        ...m,
        {
          role: 'voca',
          text:
            'Não consegui falar com a IA agora (' +
            (e instanceof Error ? e.message : 'erro') +
            '). Ligue o Modo IA no seu perfil para o chat de dúvidas funcionar.',
        },
      ])
    }
    setPensando(false)
  }

  const sugestoes = ['Por que não pode ser do outro jeito?', 'Me dá mais um exemplo', 'Como eu falo isso no passado?', 'Quando eu uso isso na vida real?']

  return (
    <div className="explain-wrap" role="dialog">
      <div className="explain">
        <header className="explain-top">
          <Voca state={pensando ? 'thinking' : 'idle'} face={mood.face} color={mood.color} size={54} />
          <b>Explicação do Voca</b>
          <button className="x" onClick={onClose} aria-label="Fechar">✕</button>
        </header>

        {!exp && <p className="muted">escrevendo a explicação…</p>}

        {exp && (
          <div className="explain-body">
            {exp.offline && (
              <p className="offline-warn small">
                Explicação simples (sem IA agora{erro ? `: ${erro}` : ''}). Ligue o Modo IA no perfil para a versão completa.
              </p>
            )}
            <p className="exp-short">{exp.short}</p>

            <h4>A regra</h4>
            <p>{exp.rule}</p>

            {exp.examples?.length > 0 && (
              <>
                <h4>Exemplos</h4>
                <ul className="exp-examples">
                  {exp.examples.map((ex, i) => (
                    <li key={i}>
                      <button className="mini-speak" onClick={() => speak(ex.text, { locale })} aria-label="Ouvir">▶</button>
                      <b>{ex.text}</b>
                      <small>{ex.pt}</small>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <p className="exp-trick">{exp.trick}</p>
            {exp.mistake && <p className="exp-mistake">{exp.mistake}</p>}

            <h4>Ficou dúvida? Pergunta.</h4>
            <div className="chat">
              {msgs.map((m, i) => (
                <div key={i} className={`msg ${m.role}`}>
                  <p>{m.text}</p>
                  {m.examples?.map((e, j) => (
                    <p key={j} className="msg-ex">
                      <button className="mini-speak" onClick={() => speak(e, { locale })}>▶</button> {e}
                    </p>
                  ))}
                </div>
              ))}
              {pensando && <div className="msg voca"><p className="thinking">pensando…</p></div>}
              <div ref={fim} />
            </div>

            {msgs.length === 0 && (
              <div className="chips">
                {sugestoes.map((s) => (
                  <button key={s} className="chip" onClick={() => perguntar(s)}>{s}</button>
                ))}
              </div>
            )}

            <form
              className="type-row"
              onSubmit={(e) => {
                e.preventDefault()
                perguntar(q)
              }}
            >
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="pergunte qualquer coisa sobre essa questão…" />
              <button className="btn primary" disabled={!q.trim() || pensando}>perguntar</button>
            </form>
          </div>
        )}

        <button className="btn ghost big" onClick={onClose}>Fechar</button>
      </div>
    </div>
  )
}
