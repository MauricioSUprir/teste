// Teste de nivelamento: descobre em que nivel a pessoa entra, em vez de
// jogar todo mundo na primeira licao. Vai subindo de dificuldade e para
// quando ela comeca a errar — nao adianta martelar frase que ela nao viu.
import { useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { getLang } from '../content/languages'
import { getMood } from '../content/moods'
import { Voca } from '../components/Voca'
import { judge, pick, shuffle, seeded, hash } from '../lib/util'
import { speak } from '../lib/speech'
import type { Cefr, Difficulty, Phrase } from '../state/types'

type Q = {
  cefr: Cefr
  phrase: Phrase
  kind: 'choice' | 'type'
  options?: string[]
}

const ORDER: Cefr[] = ['A1', 'A2', 'B1', 'B2']

export function Placement({ langId, onDone }: { langId: string; onDone: () => void }) {
  const { save, patchProfile } = useStore()
  const lang = getLang(langId)
  const mood = getMood(save.profile.mood)

  const blocks = useMemo(() => buildBlocks(langId), [langId])
  const [block, setBlock] = useState(0)
  const [i, setI] = useState(0)
  const [answer, setAnswer] = useState('')
  const [hits, setHits] = useState<Record<string, { ok: number; total: number }>>({})
  const [done, setDone] = useState<Cefr | null>(null)
  const [flash, setFlash] = useState<'certo' | 'errado' | null>(null)

  const atual = blocks[block]
  const q = atual?.perguntas[i]
  const totalPerguntas = blocks.reduce((n, b) => n + b.perguntas.length, 0)
  const feitas = blocks.slice(0, block).reduce((n, b) => n + b.perguntas.length, 0) + i

  function responder(correct: boolean) {
    setFlash(correct ? 'certo' : 'errado')
    const cefr = atual.cefr
    const nowHits = {
      ...hits,
      [cefr]: { ok: (hits[cefr]?.ok ?? 0) + (correct ? 1 : 0), total: (hits[cefr]?.total ?? 0) + 1 },
    }
    setHits(nowHits)
    setTimeout(() => {
      setFlash(null)
      setAnswer('')
      if (i + 1 < atual.perguntas.length) {
        setI(i + 1)
        return
      }
      // fim do bloco: so sobe de nivel quem acertou a maioria
      const r = nowHits[cefr]
      const passou = r.ok / r.total >= 0.6
      if (!passou || block + 1 >= blocks.length) {
        finalizar(nowHits)
      } else {
        setBlock(block + 1)
        setI(0)
      }
    }, 550)
  }

  function finalizar(r: Record<string, { ok: number; total: number }>) {
    // o nivel e o ultimo bloco em que ela acertou a maioria
    let nivel: Cefr = 'A1'
    for (const c of ORDER) {
      const b = r[c]
      if (b && b.ok / b.total >= 0.6) nivel = c
    }
    const acertoGeral =
      Object.values(r).reduce((n, b) => n + b.ok, 0) / Math.max(1, Object.values(r).reduce((n, b) => n + b.total, 0))
    const dificuldade: Difficulty = acertoGeral >= 0.85 ? 'dificil' : acertoGeral >= 0.5 ? 'medio' : 'facil'
    patchProfile({
      levels: { ...save.profile.levels, [langId]: nivel },
      placed: Array.from(new Set([...save.profile.placed, langId])),
      difficulty: dificuldade,
    })
    setDone(nivel)
  }

  if (done) {
    const desc: Record<Cefr, string> = {
      A1: 'Você está começando — vamos do zero, com calma e muita repetição.',
      A2: 'Você já se vira no básico. Vou abrir as unidades do dia a dia.',
      B1: 'Você entende bem e já monta frase sozinha. Liberei o conteúdo mais solto.',
      B2: 'Você manda bem. O que falta é conversar muito e lapidar detalhe.',
    }
    return (
      <div className="screen result">
        <Voca state="talking" face={mood.face} color={mood.color} size={150} energy={0.6} />
        <h1>Nível {done}</h1>
        <p className="roast">{desc[done]}</p>
        <div className="result-grid">
          {ORDER.filter((c) => hits[c]).map((c) => (
            <div key={c}>
              <b>
                {hits[c].ok}/{hits[c].total}
              </b>
              <small>{c}</small>
            </div>
          ))}
        </div>
        <p className="muted center">
          Dificuldade escolhida para você: <b>{save.profile.difficulty}</b> — dá para mudar no perfil quando quiser.
        </p>
        <button className="btn primary big" onClick={onDone}>
          Ir para as lições
        </button>
      </div>
    )
  }

  if (!q) return <div className="screen loading">montando o teste…</div>

  return (
    <div className={`screen lesson placement ${flash ?? ''}`}>
      <header className="lesson-top">
        <button className="x" onClick={onDone} aria-label="Pular">
          pular
        </button>
        <div className="bar">
          <i style={{ width: `${(feitas / totalPerguntas) * 100}%` }} />
        </div>
        <span className="hearts">{atual.cefr}</span>
      </header>

      <div className="lesson-body">
        <h3 className="ex-title">
          {q.kind === 'choice' ? 'Qual é a tradução certa?' : `Escreva em ${lang.name}`}
        </h3>
        <p className="ex-prompt">{q.phrase.pt}</p>

        {q.kind === 'choice' ? (
          <div className="options">
            {q.options!.map((o) => (
              <button
                key={o}
                className="opt"
                onClick={() => {
                  speak(o, { locale: lang.locale, rate: save.profile.voiceRate })
                  responder(o === q.phrase.t)
                }}
              >
                {o}
              </button>
            ))}
          </div>
        ) : (
          <>
            <textarea
              autoFocus
              rows={2}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="escreva aqui (ou deixe em branco se não souber)"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  responder(judge(answer, [q.phrase.t, ...(q.phrase.rom ? [q.phrase.rom] : []), ...(q.phrase.alt ?? [])], 1.5) !== 'errado')
                }
              }}
            />
            <button
              className="btn primary big"
              onClick={() =>
                responder(judge(answer, [q.phrase.t, ...(q.phrase.rom ? [q.phrase.rom] : []), ...(q.phrase.alt ?? [])], 1.5) !== 'errado')
              }
            >
              {answer.trim() ? 'Responder' : 'Não sei essa'}
            </button>
          </>
        )}
        <p className="muted center small">
          Sem vidas, sem pressa: isso aqui só serve para eu saber por onde te colocar.
        </p>
      </div>
    </div>
  )
}

/** Monta blocos de perguntas por nivel, do mais facil ao mais dificil. */
function buildBlocks(langId: string) {
  const lang = getLang(langId)
  const rnd = seeded(hash(langId) + Math.floor(Date.now() / 60000))
  const porNivel = new Map<Cefr, Phrase[]>()
  for (const u of lang.units) {
    const lista = porNivel.get(u.cefr) ?? []
    lista.push(...u.lessons.flatMap((l) => l.phrases))
    porNivel.set(u.cefr, lista)
  }
  const todas = lang.units.flatMap((u) => u.lessons.flatMap((l) => l.phrases))

  return ORDER.filter((c) => porNivel.has(c)).map((cefr) => {
    const pool = porNivel.get(cefr)!
    const escolhidas = pick(pool, Math.min(5, pool.length), rnd)
    return {
      cefr,
      perguntas: escolhidas.map((phrase, idx): Q => {
        // escrever no fim de cada bloco, para separar quem reconhece de quem produz
        const kind: Q['kind'] = idx >= 3 ? 'type' : 'choice'
        if (kind === 'type') return { cefr, phrase, kind }
        const erradas = pick(
          todas.filter((p) => p.t !== phrase.t),
          3,
          rnd,
        ).map((p) => p.t)
        return { cefr, phrase, kind, options: shuffle([phrase.t, ...erradas], rnd) }
      }),
    }
  })
}
