// Roda uma licao (ou uma sessao de revisao). Erro tira vida, a frase errada
// volta no fim da fila e a correcao traz dica, audio e, quando existe, um
// clipe de filme/serie/desenho com a mesma estrutura.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, MAX_HEARTS, ACHIEVEMENTS } from '../state/store'
import { findLesson, getLang } from '../content/languages'
import { getMood } from '../content/moods'
import { buildLesson, buildReview } from '../lib/lessonBuilder'
import { dueCards } from '../lib/srs'
import { judge, one, shuffle, norm } from '../lib/util'
import { speak, speakPt, sttSupported, listen } from '../lib/speech'
import { findClip } from '../content/clips'
import { ClipCard } from '../components/ClipCard'
import { Voca } from '../components/Voca'
import { HintBar } from '../components/HintBar'
import { ExplainPanel } from '../components/ExplainPanel'
import type { Difficulty, Exercise } from '../state/types'

const SLACK: Record<Difficulty, number> = { facil: 1.6, medio: 1, dificil: 0 }

/** Rotulo de nivel usado nos prompts da IA. */
function levelOf(langId: string, levels: Record<string, string>) {
  return levels[langId] ?? 'A1'
}

type Phase = 'answer' | 'right' | 'almost' | 'wrong'

export function Lesson({
  lessonId,
  review,
  onExit,
  onPaywall,
}: {
  lessonId?: string
  review?: boolean
  onExit: () => void
  onPaywall: () => void
}) {
  const { save, addXp, loseHeart, recordAnswer, finishLesson, gradeCard, refillHearts } = useStore()
  const lang = getLang(save.profile.lang)
  const mood = getMood(save.profile.mood)
  const found = lessonId ? findLesson(lang.id, lessonId) : null

  const [queue, setQueue] = useState<Exercise[]>([])
  const [i, setI] = useState(0)
  const [phase, setPhase] = useState<Phase>('answer')
  const [hits, setHits] = useState(0)
  const [tries, setTries] = useState(0)
  const [done, setDone] = useState(false)
  const [unlocked, setUnlocked] = useState<string[]>([])
  const [ajudas, setAjudas] = useState(0)
  const [explicando, setExplicando] = useState(false)
  const startedAt = useRef(Date.now())
  const dificuldade = save.profile.difficulty
  const nivel = levelOf(lang.id, save.profile.levels)

  useEffect(() => {
    const speech = sttSupported()
    if (review) {
      const cards = dueCards(save.srs).filter((c) => c.lang === lang.id)
      setQueue(buildReview(cards, lang, speech))
    } else if (found) {
      const attempt = save.lessons[`${lang.id}:${found.lesson.id}`]?.times ?? 0
      setQueue(buildLesson(lang, found.lesson, attempt, { speech, difficulty: dificuldade }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ex = queue[i]

  function next(correct: boolean, quality: 0 | 1 | 2 | 3) {
    recordAnswer(correct)
    setTries((t) => t + 1)
    if (correct) setHits((h) => h + 1)
    if (ex && 'phrase' in ex) {
      const id = 'c' + hashId(lang.id + '|' + ex.phrase.t)
      if (save.srs[id]) gradeCard(id, quality)
    }
    if (!correct) {
      loseHeart()
      // a frase errada volta no fim da fila
      setQueue((q) => (ex ? [...q, ex] : q))
    }
  }

  function advance() {
    setPhase('answer')
    if (i + 1 >= queue.length) finish()
    else setI(i + 1)
  }

  function finish() {
    const acc = tries ? hits / tries : 1
    const base = review ? 15 : 20
    const bonusDificuldade = dificuldade === 'dificil' ? 12 : dificuldade === 'facil' ? -5 : 0
    const xp = Math.max(5, Math.round(base + acc * 20 + (acc >= 1 ? 10 : 0) + bonusDificuldade - ajudas * 2))
    if (review || !found) {
      addXp(xp)
    } else {
      const novos = finishLesson(lang.id, found.lesson.id, acc, xp, found.lesson.phrases)
      setUnlocked(novos)
    }
    setDone(true)
  }

  if (!queue.length) return <div className="screen loading">carregando…</div>

  if (save.hearts <= 0 && !done) {
    return (
      <div className="screen empty-hearts">
        <Voca state="idle" face={mood.face} color={mood.color} size={150} />
        <h2>Acabaram as vidas</h2>
        <p>{one(mood.wrong)}</p>
        <p className="muted">Elas voltam sozinhas (uma a cada 20 minutos) — ou você continua sem contar pontos.</p>
        <button className="btn primary" onClick={onExit}>Voltar</button>
        <button className="btn ghost" onClick={refillHearts}>Recarregar agora</button>
      </div>
    )
  }

  if (done) {
    const acc = tries ? hits / tries : 1
    return (
      <div className="screen result">
        <Voca state="talking" face={mood.face} color={mood.color} size={160} energy={0.7} />
        <h1>{acc >= 0.95 ? 'Perfeito.' : acc >= 0.8 ? 'Bom trabalho.' : 'Passou raspando.'}</h1>
        <p className="roast">{acc >= 0.8 ? one(mood.praise) : one(mood.wrong)}</p>
        <div className="result-grid">
          <div><b>{Math.round(acc * 100)}%</b><small>acerto</small></div>
          <div><b>{hits}</b><small>certas</small></div>
          <div><b>{Math.round((Date.now() - startedAt.current) / 1000)}s</b><small>tempo</small></div>
        </div>
        {unlocked.length > 0 && (
          <div className="unlocked">
            {unlocked.map((id) => {
              const a = ACHIEVEMENTS.find((x) => x.id === id)
              return a ? <span key={id} className="badge">{a.icon} {a.title}</span> : null
            })}
          </div>
        )}
        <button className="btn primary big" onClick={onExit}>Continuar</button>
      </div>
    )
  }

  return (
    <div className="screen lesson">
      <header className="lesson-top">
        <button className="x" onClick={onExit} aria-label="Sair">✕</button>
        <div className="bar"><i style={{ width: `${(i / queue.length) * 100}%` }} /></div>
        <span className="hearts">{'❤️'.repeat(save.hearts)}{'🤍'.repeat(MAX_HEARTS - save.hearts)}</span>
      </header>

      <div className="lesson-body">
        {found && i === 0 && phase === 'answer' && found.lesson.grammar && (
          <div className="grammar">
            <b>{found.lesson.grammar.title}</b>
            <p>{found.lesson.grammar.body}</p>
          </div>
        )}
        <ExerciseView key={ex.id + i} ex={ex} langId={lang.id} locale={lang.locale} rate={save.profile.voiceRate} voiceName={save.profile.voiceName} phase={phase} setPhase={setPhase} onJudged={next} slack={SLACK[dificuldade]} />

        {phase === 'answer' && 'phrase' in ex && (
          <HintBar
            key={'hint' + ex.id + i}
            phrase={ex.phrase}
            prompt={'prompt' in ex ? ex.prompt : ex.phrase.pt}
            given=""
            langName={lang.name}
            level={nivel}
            onUse={() => setAjudas((a) => a + 1)}
            onPaywall={onPaywall}
          />
        )}
      </div>

      {phase !== 'answer' && (
        <Feedback
          ex={ex}
          phase={phase}
          langId={lang.id}
          lessonId={found?.lesson.id ?? 'rev'}
          moodLines={phase === 'right' ? mood.praise : mood.wrong}
          onNext={advance}
          locale={lang.locale}
          rate={save.profile.voiceRate}
          voiceName={save.profile.voiceName}
          onExplain={() => setExplicando(true)}
          falarBronca={
            save.profile.ptVoice
              ? (texto: string) =>
                  speakPt(texto, {
                    rate: mood.voz.rate,
                    pitch: mood.voz.pitch,
                    voiceName: save.profile.ptVoiceName,
                    nivel: mood.nivel,
                    semIa: !save.profile.naturalVoice,
                    voiceId: save.profile.naturalVoiceId,
                  })
              : undefined
          }
        />
      )}

      {explicando && 'phrase' in ex && (
        <ExplainPanel
          phrase={ex.phrase}
          given=""
          prompt={'prompt' in ex ? ex.prompt : ex.phrase.pt}
          langName={lang.name}
          locale={lang.locale}
          level={nivel}
          lessonTitle={found?.lesson.title}
          grammar={found?.lesson.grammar}
          onClose={() => setExplicando(false)}
          onPaywall={() => {
            setExplicando(false)
            onPaywall()
          }}
        />
      )}
    </div>
  )
}

function hashId(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// --------------------------------------------------------------- exercicios

type ExProps = {
  ex: Exercise
  langId: string
  locale: string
  rate: number
  voiceName: string | null
  phase: Phase
  setPhase: (p: Phase) => void
  onJudged: (correct: boolean, quality: 0 | 1 | 2 | 3) => void
  /** tolerancia a erro de digitacao, vinda da dificuldade */
  slack: number
}

function ExerciseView(p: ExProps) {
  const { ex, phase } = p
  const disabled = phase !== 'answer'
  const say = (text: string) => speak(text, { locale: p.locale, rate: p.rate, voiceName: p.voiceName })

  const commit = (verdict: 'certo' | 'quase' | 'errado') => {
    p.setPhase(verdict === 'certo' ? 'right' : verdict === 'quase' ? 'almost' : 'wrong')
    p.onJudged(verdict !== 'errado', verdict === 'certo' ? 2 : verdict === 'quase' ? 1 : 0)
    if (verdict !== 'errado' && 'phrase' in ex) say(ex.phrase.t)
  }

  switch (ex.kind) {
    case 'translate-pt-en':
      return <TypeEx title="Traduza para o idioma que você está estudando" prompt={ex.prompt} answers={ex.answers} disabled={disabled} onDone={commit} slack={p.slack} />
    case 'translate-en-pt':
      return <TypeEx title="O que isso quer dizer em português?" prompt={ex.prompt} answers={ex.answers} disabled={disabled} onDone={commit} speakPrompt={() => say(ex.prompt)} slack={p.slack} />
    case 'listen':
      return <ListenEx text={ex.phrase.t} answers={ex.answers} disabled={disabled} onDone={commit} say={say} slack={p.slack} />
    case 'choice':
      return <ChoiceEx prompt={ex.prompt} sub={ex.sub} options={ex.options} correct={ex.correct} disabled={disabled} onDone={commit} />
    case 'bank':
      return <BankEx prompt={ex.prompt} bank={ex.bank} answers={ex.answers} disabled={disabled} onDone={commit} slack={p.slack} />
    case 'fill':
      return <FillEx before={ex.before} after={ex.after} options={ex.options} answers={ex.answers} pt={ex.phrase.pt} disabled={disabled} onDone={commit} />
    case 'match':
      return <MatchEx pairs={ex.pairs} disabled={disabled} onDone={commit} say={say} />
    case 'speak':
      return <SpeakEx phrase={ex.phrase} locale={p.locale} disabled={disabled} onDone={commit} say={say} />
  }
}

function TypeEx({ title, prompt, answers, disabled, onDone, speakPrompt, slack }: { title: string; prompt: string; answers: string[]; disabled: boolean; onDone: (v: 'certo' | 'quase' | 'errado') => void; speakPrompt?: () => void; slack: number }) {
  const [v, setV] = useState('')
  return (
    <div className="ex">
      <h3 className="ex-title">{title}</h3>
      <p className="ex-prompt">
        {prompt}
        {speakPrompt && <button className="mini-speak" onClick={speakPrompt} aria-label="Ouvir">🔊</button>}
      </p>
      <textarea autoFocus value={v} disabled={disabled} onChange={(e) => setV(e.target.value)} placeholder="escreva aqui" rows={2}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (v.trim() && !disabled) onDone(judge(v, answers, slack)) } }} />
      <button className="btn primary big" disabled={!v.trim() || disabled} onClick={() => onDone(judge(v, answers, slack))}>Verificar</button>
    </div>
  )
}

function ListenEx({ text, answers, disabled, onDone, say, slack }: { text: string; answers: string[]; disabled: boolean; onDone: (v: 'certo' | 'quase' | 'errado') => void; say: (t: string) => void; slack: number }) {
  const [v, setV] = useState('')
  useEffect(() => { const t = setTimeout(() => say(text), 350); return () => clearTimeout(t) }, [])
  return (
    <div className="ex">
      <h3 className="ex-title">Escute e escreva o que ouviu</h3>
      <div className="listen-row">
        <button className="big-speak" onClick={() => say(text)}>🔊</button>
        <button className="btn ghost sm" onClick={() => speak(text, { locale: 'en-US', rate: 0.6 })}>devagar</button>
      </div>
      <textarea autoFocus value={v} disabled={disabled} onChange={(e) => setV(e.target.value)} rows={2} placeholder="o que ele falou?"
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (v.trim() && !disabled) onDone(judge(v, answers, slack)) } }} />
      <button className="btn primary big" disabled={!v.trim() || disabled} onClick={() => onDone(judge(v, answers, slack))}>Verificar</button>
    </div>
  )
}

function ChoiceEx({ prompt, sub, options, correct, disabled, onDone }: { prompt: string; sub?: string; options: string[]; correct: number; disabled: boolean; onDone: (v: 'certo' | 'quase' | 'errado') => void }) {
  const [sel, setSel] = useState<number | null>(null)
  return (
    <div className="ex">
      <h3 className="ex-title">{sub ?? 'Escolha a resposta certa'}</h3>
      <p className="ex-prompt">{prompt}</p>
      <div className="options">
        {options.map((o, idx) => (
          <button key={idx} className={`opt ${sel === idx ? 'on' : ''} ${disabled && idx === correct ? 'good' : ''}`} disabled={disabled} onClick={() => setSel(idx)}>{o}</button>
        ))}
      </div>
      <button className="btn primary big" disabled={sel === null || disabled} onClick={() => onDone(sel === correct ? 'certo' : 'errado')}>Verificar</button>
    </div>
  )
}

function BankEx({ prompt, bank, answers, disabled, onDone, slack }: { prompt: string; bank: string[]; answers: string[]; disabled: boolean; onDone: (v: 'certo' | 'quase' | 'errado') => void; slack: number }) {
  const [picked, setPicked] = useState<number[]>([])
  const sentence = picked.map((idx) => bank[idx]).join(' ')
  return (
    <div className="ex">
      <h3 className="ex-title">Monte a frase</h3>
      <p className="ex-prompt">{prompt}</p>
      <div className="bank-line">{sentence || <span className="muted">toque nas palavras</span>}</div>
      <div className="bank">
        {bank.map((w, idx) => (
          <button key={idx} className={`token ${picked.includes(idx) ? 'used' : ''}`} disabled={disabled}
            onClick={() => setPicked((p) => (p.includes(idx) ? p.filter((x) => x !== idx) : [...p, idx]))}>{w}</button>
        ))}
      </div>
      <div className="row">
        <button className="btn ghost sm" disabled={disabled || !picked.length} onClick={() => setPicked([])}>limpar</button>
        <button className="btn primary big" disabled={!picked.length || disabled} onClick={() => onDone(judge(sentence, answers, slack))}>Verificar</button>
      </div>
    </div>
  )
}

function FillEx({ before, after, options, answers, pt, disabled, onDone }: { before: string; after: string; options: string[]; answers: string[]; pt: string; disabled: boolean; onDone: (v: 'certo' | 'quase' | 'errado') => void }) {
  const [sel, setSel] = useState<string | null>(null)
  return (
    <div className="ex">
      <h3 className="ex-title">Complete a frase</h3>
      <p className="ex-prompt fill">
        {before} <span className="gap">{sel ?? '＿＿'}</span> {after}
      </p>
      <p className="muted center">{pt}</p>
      <div className="options">
        {options.map((o) => (
          <button key={o} className={`opt ${sel === o ? 'on' : ''}`} disabled={disabled} onClick={() => setSel(o)}>{o}</button>
        ))}
      </div>
      <button className="btn primary big" disabled={!sel || disabled} onClick={() => onDone(judge(sel!, answers))}>Verificar</button>
    </div>
  )
}

function MatchEx({ pairs, disabled, onDone, say }: { pairs: { t: string; pt: string }[]; disabled: boolean; onDone: (v: 'certo' | 'quase' | 'errado') => void; say: (t: string) => void }) {
  const left = useMemo(() => shuffle(pairs.map((p) => p.t)), [pairs])
  const right = useMemo(() => shuffle(pairs.map((p) => p.pt)), [pairs])
  const [selT, setSelT] = useState<string | null>(null)
  const [okPairs, setOk] = useState<string[]>([])
  const [erros, setErros] = useState(0)

  useEffect(() => {
    if (okPairs.length === pairs.length && okPairs.length) onDone(erros === 0 ? 'certo' : 'quase')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [okPairs])

  const choose = (pt: string) => {
    if (!selT) return
    const pair = pairs.find((p) => p.t === selT)
    if (pair && pair.pt === pt) {
      setOk((o) => [...o, selT])
      say(selT)
    } else setErros((e) => e + 1)
    setSelT(null)
  }

  return (
    <div className="ex">
      <h3 className="ex-title">Ligue os pares</h3>
      <div className="match">
        <div className="col">
          {left.map((t) => (
            <button key={t} className={`opt ${selT === t ? 'on' : ''} ${okPairs.includes(t) ? 'good' : ''}`} disabled={disabled || okPairs.includes(t)} onClick={() => setSelT(t)}>{t}</button>
          ))}
        </div>
        <div className="col">
          {right.map((pt) => {
            const solved = okPairs.some((t) => pairs.find((p) => p.t === t)?.pt === pt)
            return (
              <button key={pt} className={`opt ${solved ? 'good' : ''}`} disabled={disabled || solved} onClick={() => choose(pt)}>{pt}</button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function SpeakEx({ phrase, locale, disabled, onDone, say }: { phrase: { t: string; pt: string; rom?: string }; locale: string; disabled: boolean; onDone: (v: 'certo' | 'quase' | 'errado') => void; say: (t: string) => void }) {
  const [heard, setHeard] = useState('')
  const [rec, setRec] = useState(false)
  const ctl = useRef<{ stop: () => void } | null>(null)

  useEffect(() => () => ctl.current?.stop(), [])

  const start = () => {
    setHeard('')
    setRec(true)
    ctl.current = listen(locale, {
      onPartial: setHeard,
      onFinal: (t) => {
        setHeard(t)
        ctl.current?.stop()
        setRec(false)
        const v = judge(t, [phrase.t, ...(phrase.rom ? [phrase.rom] : [])])
        // na fala, "quase" ja conta como acerto: sotaque nao e erro
        onDone(v === 'errado' ? (norm(t).length > 2 ? 'quase' : 'errado') : 'certo')
      },
      onError: () => setRec(false),
    }, false)
  }

  return (
    <div className="ex">
      <h3 className="ex-title">Fale esta frase em voz alta</h3>
      <p className="ex-prompt">{phrase.t}</p>
      {phrase.rom && <p className="rom">{phrase.rom}</p>}
      <p className="muted center">{phrase.pt}</p>
      <div className="listen-row">
        <button className="btn ghost sm" onClick={() => say(phrase.t)}>🔊 ouvir</button>
      </div>
      <button className={`mic ${rec ? 'rec' : ''}`} disabled={disabled} onClick={start}>{rec ? '🎙️ ouvindo…' : '🎤 falar'}</button>
      {heard && <p className="heard">ouvi: “{heard}”</p>}
      <button className="btn ghost sm" disabled={disabled} onClick={() => onDone('quase')}>pular</button>
    </div>
  )
}

// ---------------------------------------------------------------- correcao

function Feedback({ ex, phase, langId, lessonId, moodLines, onNext, locale, rate, voiceName, onExplain, falarBronca }: { ex: Exercise; phase: Phase; langId: string; lessonId: string; moodLines: string[]; onNext: () => void; locale: string; rate: number; voiceName: string | null; onExplain: () => void; falarBronca?: (t: string) => void }) {
  const line = useMemo(() => one(moodLines), [moodLines, ex])

  // ele fala a bronca em voz alta assim que a correcao aparece
  useEffect(() => {
    if (falarBronca) falarBronca(line)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line])
  const phrase = 'phrase' in ex ? ex.phrase : null
  const clip = useMemo(() => (phrase && phase !== 'right' ? findClip(langId, lessonId, phrase.t) : null), [phrase, phase, langId, lessonId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter') onNext() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onNext])

  return (
    <div className={`feedback ${phase}`}>
      <div className="fb-head">
        <b>{phase === 'right' ? 'Certo!' : phase === 'almost' ? 'Quase lá' : 'Errado'}</b>
        <span className="fb-roast">{line}</span>
        {falarBronca && (
          <button className="mini-speak" onClick={() => falarBronca(line)} aria-label="Ouvir de novo">🔊</button>
        )}
      </div>
      {phrase && phase !== 'right' && (
        <div className="fb-answer">
          <span className="label">resposta</span>
          <p>
            {phrase.t}
            <button className="mini-speak" onClick={() => speak(phrase.t, { locale, rate, voiceName })}>🔊</button>
          </p>
          {phrase.rom && <p className="rom">{phrase.rom}</p>}
          <p className="pt">{phrase.pt}</p>
        </div>
      )}
      {phrase?.tip && <p className="fb-tip">💡 {phrase.tip}</p>}
      {clip && phrase && <ClipCard clip={clip} phrase={phrase.t} lang={langId} />}
      {phrase && (
        <button className="btn ghost big explain-btn" onClick={onExplain}>
          🧠 {phase === 'right' ? 'entender melhor essa' : 'me explica por que errei'}
        </button>
      )}
      <button className="btn primary big" onClick={onNext}>Continuar</button>
    </div>
  )
}
