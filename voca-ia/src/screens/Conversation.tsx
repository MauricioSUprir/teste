// CONVERSA CONTINUA — o coracao do app.
// Ciclo: microfone escuta -> transcreve -> IA responde -> o Voca fala em voz
// alta -> volta a escutar sozinho. O bonequinho reage em cada etapa e o humor
// pode ser trocado NO MEIO da conversa.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { getLang } from '../content/languages'
import { MOODS, getMood } from '../content/moods'
import { SCENARIOS, getScenario } from '../content/scenarios'
import { Voca, type VocaState } from '../components/Voca'
import { listen, speak, speakPt, stopSpeaking, sttSupported } from '../lib/speech'
import { checkServer, sendChat, sendReport, type ChatReply, type Report } from '../lib/api'
import { offlineGreeting, offlineReply } from '../content/offlineChat'
import { contextoDaSerie } from '../content/series'
import { avaliarFala, mediaDeFala, palavrasDificeis, type Avaliacao } from '../lib/pronuncia'
import type { ChatTurn, Correction } from '../state/types'
import { words } from '../lib/util'

type Stage = 'setup' | 'live' | 'report'

export function Conversation({ onExit }: { onExit: () => void }) {
  const { save, patchProfile, addXp, addConversationCard, noteWeakSpot, logConversation, bumpDaily } = useStore()
  const lang = getLang(save.profile.lang)
  const mood = getMood(save.profile.mood)

  const [stage, setStage] = useState<Stage>('setup')
  const [scenarioId, setScenarioId] = useState('free')
  const scenario = getScenario(scenarioId)

  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [state, setState] = useState<VocaState>('idle')
  const [energy, setEnergy] = useState(0)
  const [partial, setPartial] = useState('')
  const [typed, setTyped] = useState('')
  const [online, setOnline] = useState<boolean | null>(null)
  const [micError, setMicError] = useState<string | null>(null)
  const [last, setLast] = useState<ChatReply | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [busyReport, setBusyReport] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  // ---- treino de fala
  const [modo, setModo] = useState<'livre' | 'treino'>('treino')
  const [drill, setDrill] = useState<{ text: string; pt?: string; why?: string } | null>(null)
  const [nota, setNota] = useState<Avaliacao | null>(null)
  const [ouvindoDrill, setOuvindoDrill] = useState(false)
  const notas = useRef<number[]>([])
  const errosFala = useRef<string[][]>([])

  const micCtl = useRef<{ stop: () => void } | null>(null)
  const startedAt = useRef(Date.now())
  const turnsRef = useRef<ChatTurn[]>([])
  turnsRef.current = turns
  const autoRef = useRef(save.profile.autoListen)
  autoRef.current = save.profile.autoListen
  const moodRef = useRef(save.profile.mood)
  moodRef.current = save.profile.mood
  const speechOk = useMemo(() => sttSupported(), [])

  useEffect(() => {
    checkServer().then(setOnline)
    return () => {
      micCtl.current?.stop()
      stopSpeaking()
    }
  }, [])

  // boca mexendo enquanto fala
  useEffect(() => {
    if (state !== 'talking') return
    const t = setInterval(() => setEnergy(Math.random()), 110)
    return () => clearInterval(t)
  }, [state])

  function stopMic() {
    micCtl.current?.stop()
    micCtl.current = null
  }

  function startMic() {
    if (!speechOk) return
    stopSpeaking() // se ele ainda estiver falando, cala a boca e escuta
    stopMic()
    setPartial('')
    setState('listening')
    micCtl.current = listen(
      lang.locale,
      {
        onPartial: (t) => {
          setPartial(t)
          setEnergy(Math.min(1, t.length / 40))
        },
        onFinal: (t) => {
          stopMic()
          setPartial('')
          send(t)
        },
        onError: (e) => {
          setMicError(e === 'not-allowed' ? 'Permissão do microfone negada.' : `Microfone: ${e}`)
          setState('idle')
        },
      },
      false,
    )
  }

  function sayOut(reply: ChatReply) {
    setState('talking')
    const terminar = () => {
      setState('idle')
      if (autoRef.current && speechOk) setTimeout(startMic, 260)
    }
    speak(reply.reply, {
      locale: lang.locale,
      rate: save.profile.voiceRate,
      voiceName: save.profile.voiceName,
      onProgress: (p) => setEnergy(0.3 + p * 0.5),
      onEnd: () => {
        // a bronca vem depois, em portugues: é ela que tem graça de ouvir
        if (save.profile.ptVoice && reply.roast) {
          setState('talking')
          speakPt(reply.roast, {
            rate: mood.voz.rate,
            pitch: mood.voz.pitch,
            voiceName: save.profile.ptVoiceName,
            nivel: mood.nivel,
            semIa: !save.profile.naturalVoice,
            voiceId: save.profile.naturalVoiceId,
            onEnd: terminar,
          })
        } else {
          terminar()
        }
      },
    })
  }

  async function send(text: string) {
    const clean = text.trim()
    if (!clean) return
    stopSpeaking()
    const mine: ChatTurn = { role: 'user', text: clean, at: Date.now() }
    setTurns((t) => [...t, mine])
    setState('thinking')

    let reply: ChatReply
    try {
      if (online) {
        reply = await sendChat({
          langId: lang.id,
          langName: lang.name,
          mood: moodRef.current,
          scenarioId: scenario.id,
          scenarioTitle: scenario.title,
          situation: scenario.situation,
          level: levelLabel(save.xp),
          userName: save.profile.name,
          history: turnsRef.current,
          message: clean,
          weakSpots: Object.entries(save.weakSpots).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => k),
          treino: modo === 'treino',
          serie: contextoDaSerie(save.profile.schoolYear),
        })
      } else {
        reply = offlineReply(clean, { lang, mood: moodRef.current as never, history: turnsRef.current })
      }
    } catch (e) {
      reply = offlineReply(clean, { lang, mood: moodRef.current as never, history: turnsRef.current })
      reply.roast = 'O servidor não respondeu — segui no modo offline. ' + (reply.roast ?? '')
    }

    // erros viram cartao de revisao: e o que faz a conversa virar estudo
    for (const c of reply.corrections ?? []) {
      if (c.right && c.right.length > 2) {
        addConversationCard({ t: c.right, pt: c.why, tip: c.why }, lang.id)
        noteWeakSpot(c.why.slice(0, 60))
      }
    }
    addXp(3)
    bumpDaily('conversa')

    const his: ChatTurn = {
      role: 'grimm',
      text: reply.reply,
      pt: reply.replyPt,
      roast: reply.roast,
      corrections: reply.corrections,
      suggestion: reply.suggestion,
      score: reply.score,
      at: Date.now(),
    }
    setLast(reply)
    setTurns((t) => [...t, his])
    setNota(null)
    setDrill(reply.drill ? { text: reply.drill, pt: reply.drillPt, why: reply.drillWhy } : null)
    sayOut(reply)
  }

  async function begin() {
    setStage('live')
    startedAt.current = Date.now()
    if (online) {
      // quem abre a cena e a propria IA, no personagem escolhido
      setState('thinking')
      try {
        const hi = await sendChat({
          langId: lang.id,
          langName: lang.name,
          mood: moodRef.current,
          scenarioId: scenario.id,
          scenarioTitle: scenario.title,
          situation: scenario.situation,
          level: levelLabel(save.xp),
          userName: save.profile.name,
          history: [],
          message: '',
          weakSpots: [],
          opening: true,
          treino: modo === 'treino',
          serie: contextoDaSerie(save.profile.schoolYear),
        })
        setTurns([{ role: 'grimm', text: hi.reply, pt: hi.replyPt, roast: hi.roast, suggestion: hi.suggestion, at: Date.now() }])
        setLast(hi)
        setDrill(hi.drill ? { text: hi.drill, pt: hi.drillPt, why: hi.drillWhy } : null)
        sayOut(hi)
        return
      } catch {
        /* cai para a abertura offline */
      }
    }
    const hello = offlineGreeting({ lang, mood: save.profile.mood as never, history: [] })
    setTurns([{ role: 'grimm', text: hello.reply, pt: hello.replyPt, roast: hello.roast, at: Date.now() }])
    setLast(hello)
    setTimeout(() => sayOut(hello), 300)
  }

  function switchMood(id: string) {
    patchProfile({ mood: id })
    moodRef.current = id
    const m = getMood(id)
    setNotice(m.onSwitch)
    setTimeout(() => setNotice(null), 3500)
  }

  /** No treino, ela repete a frase e o app mede o quanto deu para entender. */
  function ouvirDrill() {
    if (!drill || !speechOk) return
    stopSpeaking()
    stopMic()
    setNota(null)
    setOuvindoDrill(true)
    setState('listening')
    micCtl.current = listen(
      lang.locale,
      {
        onPartial: (t) => setPartial(t),
        onFinal: (t) => {
          stopMic()
          setPartial('')
          setOuvindoDrill(false)
          setState('idle')
          const a = avaliarFala(drill.text, t)
          setNota(a)
          notas.current.push(a.score)
          if (a.erradas.length) errosFala.current.push(a.erradas)
          addXp(a.score >= 80 ? 4 : 2)
          bumpDaily('falas')
        },
        onError: () => {
          setOuvindoDrill(false)
          setState('idle')
        },
      },
      false,
    )
  }

  async function finish() {
    stopMic()
    stopSpeaking()
    setState('idle')
    const mine = turns.filter((t) => t.role === 'user')
    const secs = Math.round((Date.now() - startedAt.current) / 1000)
    logConversation(mine.length, secs, mine.reduce((n, t) => n + words(t.text).length, 0))
    addXp(Math.min(60, mine.length * 5))
    setStage('report')
    if (online && mine.length >= 2) {
      setBusyReport(true)
      try {
        setReport(await sendReport({ langName: lang.name, mood: save.profile.mood, turns, userName: save.profile.name }))
      } catch {
        setReport(null)
      }
      setBusyReport(false)
    }
  }

  // ------------------------------------------------------------- telas

  if (stage === 'setup')
    return (
      <div className="screen conv-setup">
        <header className="conv-top">
          <button className="x" onClick={onExit}>✕</button>
          <h2>Conversa contínua · {lang.flag} {lang.name}</h2>
        </header>
        <Voca state="idle" face={mood.face} color={mood.color} size={140} />
        <p className="muted center">
          {speechOk
            ? 'Fale no microfone; ele responde em voz alta e volta a escutar sozinho.'
            : 'Seu navegador não tem reconhecimento de fala — dá para conversar digitando (no Chrome funciona por voz).'}
        </p>
        {online === false && (
          <p className="offline-warn">
            📴 <b>Modo offline</b> — o Voca ainda responde, mas com perguntas do próprio curso.
            Para ele virar agente de IA de verdade, ligue a IA no seu perfil (ícone no canto da tela inicial).
          </p>
        )}

        <h3 className="sec">Humor do Voca</h3>
        <MoodRow current={save.profile.mood} onPick={switchMood} />

        <h3 className="sec">Onde vocês estão?</h3>
        <div className="scen-grid">
          {SCENARIOS.map((s) => (
            <button key={s.id} className={`scen ${scenarioId === s.id ? 'on' : ''}`} onClick={() => setScenarioId(s.id)}>
              <span className="emoji">{s.emoji}</span>
              <b>{s.title}</b>
              <small>{s.goal}</small>
            </button>
          ))}
        </div>
        <button className="btn primary big" onClick={begin}>Começar a conversa</button>
      </div>
    )

  if (stage === 'report') {
    const allCorrections = turns.flatMap((t) => t.corrections ?? [])
    return (
      <div className="screen conv-report">
        <Voca state="idle" face={mood.face} color={mood.color} size={130} />
        <h1>Fim da conversa</h1>
        <div className="result-grid">
          <div><b>{turns.filter((t) => t.role === 'user').length}</b><small>falas suas</small></div>
          <div><b>{Math.round((Date.now() - startedAt.current) / 1000)}s</b><small>de conversa</small></div>
          <div><b>{allCorrections.length}</b><small>correções</small></div>
        </div>

        {notas.current.length > 0 && (
          <div className="report">
            <h3>Como foi sua pronúncia</h3>
            <div className="result-grid">
              <div><b>{mediaDeFala(notas.current)}</b><small>nota média</small></div>
              <div><b>{notas.current.length}</b><small>frases repetidas</small></div>
              <div><b>{notas.current.filter((n) => n >= 80).length}</b><small>saíram limpas</small></div>
            </div>
            {palavrasDificeis(errosFala.current).length > 0 && (
              <>
                <h3>Palavras para treinar</h3>
                <ul>
                  {palavrasDificeis(errosFala.current).map((p) => (
                    <li key={p.palavra}>🔁 <b>{p.palavra}</b> — travou {p.vezes}x</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
        {busyReport && <p className="muted">montando seu diagnóstico…</p>}
        {report && (
          <div className="report">
            <p className="rep-summary">{report.summary}</p>
            <h3>Você mandou bem em</h3>
            <ul>{report.strengths.map((s, i) => <li key={i}>✅ {s}</li>)}</ul>
            <h3>Para consertar</h3>
            <ul>{report.fix.map((f, i) => <li key={i}>🔧 <b>{f.what}</b><br /><span className="ex-good">{f.example}</span></li>)}</ul>
            <p className="next-goal">🎯 {report.nextGoal}</p>
          </div>
        )}
        {!report && allCorrections.length > 0 && (
          <div className="report">
            <h3>O que corrigir</h3>
            <ul>{allCorrections.slice(0, 8).map((c, i) => <li key={i}>🔧 <b>{c.right}</b><br /><small>{c.why}</small></li>)}</ul>
          </div>
        )}
        <p className="muted center">As correções viraram cartões de revisão — elas voltam pra você nos próximos dias.</p>
        <button className="btn primary big" onClick={onExit}>Voltar</button>
      </div>
    )
  }

  const lastTurn = turns[turns.length - 1]
  return (
    <div className="screen conv-live" style={{ ['--mood' as string]: mood.color }}>
      <header className="conv-top">
        <button className="x" onClick={finish}>✕</button>
        <span className="scen-chip">{scenario.emoji} {scenario.title}</span>
        <span className="mode-chip">{online ? '🤖 IA ao vivo' : '📴 modo offline'}</span>
      </header>

      <div className="modo-row">
        <button className={modo === 'treino' ? 'on' : ''} onClick={() => setModo('treino')}>
          🎤 treino de fala
        </button>
        <button className={modo === 'livre' ? 'on' : ''} onClick={() => setModo('livre')}>
          💬 conversa livre
        </button>
      </div>

      <MoodRow current={save.profile.mood} onPick={switchMood} compact />
      {notice && <div className="notice">{notice}</div>}

      <div className="stage">
        <Voca state={state} face={mood.face} color={mood.color} size={230} energy={energy} />
        <div className="bubble">
          {state === 'thinking' ? (
            <p className="thinking">pensando…</p>
          ) : (
            <>
              <p className="said" lang={lang.locale} dir={lang.rtl ? 'rtl' : 'ltr'}>{lastTurn?.role === 'grimm' ? lastTurn.text : '…'}</p>
              {save.profile.showPt && lastTurn?.pt && (
                <p className="said-pt">
                  <button
                    className="mini-speak"
                    onClick={() => speakPt(lastTurn.pt!, { rate: 1, pitch: 1, voiceName: save.profile.ptVoiceName, nivel: 0, semIa: !save.profile.naturalVoice, voiceId: save.profile.naturalVoiceId })}
                    aria-label="Ouvir em português"
                  >
                    🔊
                  </button>
                  {lastTurn.pt}
                </p>
              )}
            </>
          )}
        </div>
        {last?.roast && (
        <p className="roast-line">
          <button
            className="mini-speak"
            onClick={() => speakPt(last.roast!, { rate: mood.voz.rate, pitch: mood.voz.pitch, voiceName: save.profile.ptVoiceName, nivel: mood.nivel, semIa: !save.profile.naturalVoice, voiceId: save.profile.naturalVoiceId })}
            aria-label="Ouvir a bronca"
          >
            🔊
          </button>
          {last.roast}
        </p>
      )}
      </div>

      {last?.corrections && last.corrections.length > 0 && (
        <div className="fixes">
          {last.corrections.slice(0, 3).map((c: Correction, i) => (
            <div key={i} className="fix">
              <span className="bad">{c.wrong}</span>
              <span className="arrow">→</span>
              <span className="good">{c.right}</span>
              <small>{c.why}</small>
            </div>
          ))}
        </div>
      )}

      {drill && (
        <div className={`drill ${nota ? nota.veredito : ''}`}>
          <div className="drill-top">
            <b>🎤 repete em voz alta</b>
            <button className="mini-speak" onClick={() => speak(drill.text, { locale: lang.locale, rate: 0.9, voiceName: save.profile.voiceName })}>🔊</button>
            <button className="mini-speak" onClick={() => speak(drill.text, { locale: lang.locale, rate: 0.6 })}>🐢</button>
          </div>
          <p className="drill-text" lang={lang.locale} dir={lang.rtl ? 'rtl' : 'ltr'}>{drill.text}</p>
          {drill.pt && <p className="drill-pt">{drill.pt}</p>}
          {drill.why && <p className="drill-why">👂 {drill.why}</p>}

          {nota ? (
            <div className="drill-nota">
              <div className="nota-num">
                <b>{nota.score}</b>
                <small>/100</small>
              </div>
              <div className="nota-txt">
                <b>
                  {nota.veredito === 'perfeito' && 'Saiu perfeito.'}
                  {nota.veredito === 'bom' && 'Deu para entender bem.'}
                  {nota.veredito === 'quase' && 'Quase — travou em algumas palavras.'}
                  {nota.veredito === 'refaz' && 'Não deu para entender. De novo.'}
                </b>
                <small>ouvi: “{nota.ouvido}”</small>
                {nota.erradas.length > 0 && (
                  <small>
                    treina: <b>{nota.erradas.join(', ')}</b>
                  </small>
                )}
              </div>
            </div>
          ) : null}

          <div className="drill-btns">
            <button className={`mic ${ouvindoDrill ? 'rec' : ''}`} onClick={ouvirDrill} disabled={!speechOk}>
              {ouvindoDrill ? '🎙️ pode falar' : nota ? '🎤 falar de novo' : '🎤 falar'}
            </button>
            {nota && nota.score >= 55 && (
              <button className="btn ghost sm" onClick={() => { setDrill(null); setNota(null) }}>
                seguir a conversa →
              </button>
            )}
          </div>
        </div>
      )}

      {last?.suggestion && state === 'idle' && (
        <button className="suggestion" onClick={() => send(last.suggestion!)}>
          💬 responder: “{last.suggestion}”
        </button>
      )}

      <div className="mic-area">
        {partial && <p className="partial">“{partial}”</p>}
        {micError && <p className="mic-error">{micError}</p>}
        {speechOk ? (
          <button
            className={`mic big ${state === 'listening' ? 'rec' : ''}`}
            onClick={() => (state === 'listening' ? (stopMic(), setState('idle')) : startMic())}
            disabled={state === 'thinking'}
          >
            {state === 'listening' ? '🎙️ pode falar' : '🎤 falar'}
          </button>
        ) : null}
        {modo === 'livre' && (
        <form
          className="type-row"
          onSubmit={(e) => {
            e.preventDefault()
            const t = typed
            setTyped('')
            send(t)
          }}
        >
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={`escreva em ${lang.name}…`} lang={lang.locale} />
          <button className="btn primary" disabled={!typed.trim() || state === 'thinking'}>enviar</button>
        </form>
        )}
        {modo === 'treino' && (
          <p className="muted small center">
            No treino de fala é só voz: fale, ele corrige e devolve outra frase para repetir.
          </p>
        )}
        <div className="toggles">
          <label>
            <input type="checkbox" checked={save.profile.autoListen} onChange={(e) => patchProfile({ autoListen: e.target.checked })} />
            escutar sozinho
          </label>
          <label>
            <input type="checkbox" checked={save.profile.showPt} onChange={(e) => patchProfile({ showPt: e.target.checked })} />
            mostrar tradução
          </label>
          <label>
            <input type="checkbox" checked={save.profile.ptVoice} onChange={(e) => patchProfile({ ptVoice: e.target.checked })} />
            falar em português
          </label>
          <button className="btn ghost sm" onClick={() => lastTurn && sayOut({ reply: lastTurn.text, corrections: [] })}>🔊 repetir</button>
        </div>
      </div>

      <details className="transcript">
        <summary>transcrição ({turns.length})</summary>
        {turns.map((t, i) => (
          <p key={i} className={t.role}>
            <b>{t.role === 'user' ? 'você' : 'voca'}:</b> {t.text}
          </p>
        ))}
      </details>
    </div>
  )
}

function MoodRow({ current, onPick, compact }: { current: string; onPick: (id: string) => void; compact?: boolean }) {
  return (
    <div className={`mood-row ${compact ? 'compact' : ''}`}>
      {MOODS.map((m) => (
        <button
          key={m.id}
          className={`mood-chip ${current === m.id ? 'on' : ''}`}
          style={{ ['--c' as string]: m.color }}
          onClick={() => onPick(m.id)}
          title={m.desc}
        >
          <span>{m.emoji}</span>
          {!compact && <b>{m.label}</b>}
          {compact && <b>{m.label}</b>}
        </button>
      ))}
    </div>
  )
}

function levelLabel(xp: number) {
  if (xp < 300) return 'A1 (iniciante)'
  if (xp < 1200) return 'A2 (básico)'
  if (xp < 3000) return 'B1 (intermediário)'
  return 'B2 (avançado)'
}
