// CONVERSA CONTÍNUA — funciona como uma LIGAÇÃO.
//
// Você aperta "ligar" uma vez e acabou o botão: o microfone fica aberto, você
// fala, ele escuta, corrige, responde em voz alta e o microfone reabre sozinho.
// Enquanto isso as correções vão aparecendo na tela, ao vivo.
//
// Um microfone só, um ciclo só:
//   escutar → transcrever → IA responde → falar → escutar de novo
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { getLang } from '../content/languages'
import { MOODS, getMood } from '../content/moods'
import { SCENARIOS, getScenario } from '../content/scenarios'
import { contextoDaSerie } from '../content/series'
import { Voca, type VocaState } from '../components/Voca'
import { listen, speak, speakPt, stopSpeaking, sttSupported } from '../lib/speech'
import { checkServer, sendChat, sendReport, type ChatReply, type Report } from '../lib/api'
import { offlineGreeting, offlineReply } from '../content/offlineChat'
import { avaliarFala, mediaDeFala, palavrasDificeis, type Avaliacao } from '../lib/pronuncia'
import type { ChatTurn, Correction } from '../state/types'
import { words } from '../lib/util'

type Stage = 'setup' | 'live' | 'report'
/** Em que ponto do ciclo a ligação está. */
type Fase = 'ouvindo' | 'pensando' | 'falando' | 'pausado' | 'parado'

export function Conversation({ onExit }: { onExit: () => void }) {
  const { save, patchProfile, addXp, addConversationCard, noteWeakSpot, logConversation, bumpDaily } = useStore()
  const lang = getLang(save.profile.lang)
  const mood = getMood(save.profile.mood)

  const [stage, setStage] = useState<Stage>('setup')
  const [scenarioId, setScenarioId] = useState('free')
  const scenario = getScenario(scenarioId)
  const [modo, setModo] = useState<'livre' | 'treino'>('treino')

  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [fase, setFase] = useState<Fase>('parado')
  const [energy, setEnergy] = useState(0)
  const [partial, setPartial] = useState('')
  const [typed, setTyped] = useState('')
  const [online, setOnline] = useState<boolean | null>(null)
  const [micError, setMicError] = useState<string | null>(null)
  const [last, setLast] = useState<ChatReply | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [busyReport, setBusyReport] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [segundos, setSegundos] = useState(0)

  // treino de fala
  const [drill, setDrill] = useState<{ text: string; pt?: string; why?: string } | null>(null)
  const [nota, setNota] = useState<Avaliacao | null>(null)
  const notas = useRef<number[]>([])
  const errosFala = useRef<string[][]>([])

  const micCtl = useRef<{ stop: () => void } | null>(null)
  const startedAt = useRef(Date.now())
  const turnsRef = useRef<ChatTurn[]>([])
  turnsRef.current = turns
  const drillRef = useRef<typeof drill>(null)
  drillRef.current = drill
  const moodRef = useRef(save.profile.mood)
  moodRef.current = save.profile.mood
  const modoRef = useRef(modo)
  modoRef.current = modo
  /** a ligação está no ar? (ref porque os callbacks do microfone leem isso) */
  const naChamada = useRef(false)
  const [pausado, setPausado] = useState(false)
  const pausadoRef = useRef(false)
  pausadoRef.current = pausado
  /** está mandando/ouvindo a resposta? (nessa hora o microfone fica fechado) */
  const processando = useRef(false)
  /**
   * Conta as rodadas da ligacao. Cada fala do Voca ganha um numero; quando uma
   * rodada nova comeca (ou a pessoa pausa/desliga), o numero muda e os
   * callbacks atrasados da rodada anterior viram letra morta. Sem isso, o
   * timer de socorro de uma fala antiga abria o microfone no meio da proxima.
   */
  const ciclo = useRef(0)
  /** quantas vezes o microfone reabriu seguidamente sem ouvir nada */
  const reaberturas = useRef(0)
  const ultimaAbertura = useRef(0)
  const [semSom, setSemSom] = useState(false)
  const timerSilencio = useRef<number | null>(null)

  const speechOk = useMemo(() => sttSupported(), [])

  useEffect(() => {
    checkServer().then(setOnline)
    return () => {
      naChamada.current = false
      micCtl.current?.stop()
      stopSpeaking()
    }
  }, [])

  // boca mexendo enquanto ele fala
  useEffect(() => {
    if (fase !== 'falando') return
    const t = setInterval(() => setEnergy(Math.random()), 110)
    return () => clearInterval(t)
  }, [fase])

  // cronômetro da ligação
  useEffect(() => {
    if (stage !== 'live') return
    const t = setInterval(() => setSegundos(Math.round((Date.now() - startedAt.current) / 1000)), 1000)
    return () => clearInterval(t)
  }, [stage])

  const estadoVoca: VocaState =
    fase === 'falando' ? 'talking' : fase === 'pensando' ? 'thinking' : fase === 'ouvindo' ? 'listening' : 'idle'

  // ------------------------------------------------------------- microfone

  function pararMic() {
    micCtl.current?.stop()
    micCtl.current = null
    if (timerSilencio.current) clearTimeout(timerSilencio.current)
  }

  /**
   * Abre o microfone e espera ela falar.
   *
   * Detalhe que quebrava a ligação inteira: o reconhecimento do navegador
   * ENCERRA SOZINHO depois de alguns segundos de silêncio. Se a gente não
   * reabrir, a tela continua dizendo "pode falar" com o microfone morto — era
   * só ela pensar um pouco antes de responder para a chamada travar. Por isso
   * todo fim de escuta reabre, desde que a ligação ainda esteja de pé.
   */
  function abrirMic() {
    if (!naChamada.current || pausadoRef.current || !speechOk || processando.current) return

    // proteção contra laço: se reabrir muitas vezes em poucos segundos, algo
    // está errado de verdade e insistir só esquenta o aparelho
    const agora = Date.now()
    if (agora - ultimaAbertura.current < 1200) reaberturas.current += 1
    else reaberturas.current = 0
    ultimaAbertura.current = agora
    if (reaberturas.current > 8) {
      setMicError('O microfone não está abrindo. Toque em "voltar" para tentar de novo.')
      setPausado(true)
      pausadoRef.current = true
      setFase('pausado')
      return
    }

    pararMic()
    setPartial('')
    setSemSom(false)
    setMicError(null)
    setFase('ouvindo')

    // se ficar muito tempo sem ouvir nada, avisa em vez de deixar no vácuo
    if (timerSilencio.current) clearTimeout(timerSilencio.current)
    timerSilencio.current = window.setTimeout(() => setSemSom(true), 20000)

    micCtl.current = listen(
      lang.locale,
      {
        onPartial: (t) => {
          setSemSom(false)
          if (timerSilencio.current) clearTimeout(timerSilencio.current)
          setPartial(t)
          setEnergy(Math.min(1, t.length / 40))
        },
        onFinal: (t) => {
          // ja estamos tratando uma fala: resultado repetido nao vira rodada nova
          if (processando.current) return
          processando.current = true
          reaberturas.current = 0
          if (timerSilencio.current) clearTimeout(timerSilencio.current)
          pararMic()
          setPartial('')
          setSemSom(false)
          ouviuAlgo(t)
        },
        onError: (e) => {
          if (e === 'not-allowed' || e === 'service-not-allowed') {
            // sem permissão não tem o que tentar: a pessoa precisa liberar
            setMicError('Libere o microfone para o site e toque em "voltar" — no Chrome é o cadeado ao lado do endereço.')
            setPausado(true)
            pausadoRef.current = true
            setFase('pausado')
            return
          }
          // falha passageira (rede, aba escondida): o onEnd abaixo reabre
          setMicError(null)
        },
        onEnd: () => {
          // AQUI está o conserto: fim de escuta não é fim de conversa
          if (naChamada.current && !pausadoRef.current && !processando.current) {
            setTimeout(abrirMic, 300)
          }
        },
      },
      false,
    )
  }

  /** Chegou uma fala dela: pontua o treino (se houver) e segue a conversa. */
  function ouviuAlgo(texto: string) {
    const t = texto.trim()
    // ruído e engasgo não merecem uma rodada inteira de IA
    if (t.length < 2) {
      processando.current = false
      return abrirMic()
    }

    const alvo = drillRef.current
    if (alvo) {
      const a = avaliarFala(alvo.text, t)
      setNota(a)
      notas.current.push(a.score)
      if (a.erradas.length) errosFala.current.push(a.erradas)
      addXp(a.score >= 80 ? 4 : 2)
      bumpDaily('falas')
    }
    enviar(t)
  }

  // ------------------------------------------------------------- a conversa

  function falarResposta(reply: ChatReply) {
    // Enquanto o Voca fala, o microfone fica FECHADO. Sem isso ele escuta a
    // propria voz pelo alto-falante, transcreve e responde a si mesmo.
    processando.current = true
    pararMic()
    const rodada = ++ciclo.current
    setFase('falando')
    // se a voz do navegador engasgar, o microfone abre assim mesmo
    let seguiu = false
    const seguir = () => {
      if (seguiu || rodada !== ciclo.current) return
      seguiu = true
      processando.current = false
      if (!naChamada.current || pausadoRef.current) {
        setFase(pausadoRef.current ? 'pausado' : 'parado')
        return
      }
      // um respiro antes de abrir o microfone, para ele não ouvir a si mesmo
      setTimeout(abrirMic, 400)
    }
    // rede de segurança: se a voz do navegador engasgar e nunca avisar que
    // terminou, a chamada segue assim mesmo
    let socorro = window.setTimeout(seguir, Math.max(8000, reply.reply.length * 140))
    const depois = () => {
      clearTimeout(socorro)
      seguir()
    }
    speak(reply.reply, {
      locale: lang.locale,
      rate: save.profile.voiceRate,
      voiceName: save.profile.voiceName,
      onProgress: (p) => setEnergy(0.3 + p * 0.5),
      onEnd: () => {
        // a bronca sai em português, depois da fala no idioma
        if (save.profile.ptVoice && reply.roast) {
          setFase('falando')
          // a bronca vem depois: estica o socorro para ele não abrir o
          // microfone no meio da fala (e acabar ouvindo a si mesmo)
          clearTimeout(socorro)
          socorro = window.setTimeout(seguir, Math.max(8000, reply.roast.length * 160))
          speakPt(reply.roast, {
            rate: mood.voz.rate,
            pitch: mood.voz.pitch,
            voiceName: save.profile.ptVoiceName,
            nivel: mood.nivel,
            semIa: !save.profile.naturalVoice,
            voiceId: save.profile.naturalVoiceId,
            onEnd: depois,
          })
        } else {
          depois()
        }
      },
    })
  }

  async function enviar(texto: string) {
    const clean = texto.trim()
    if (!clean) {
      processando.current = false
      return
    }
    processando.current = true
    stopSpeaking()
    setTurns((t) => [...t, { role: 'user', text: clean, at: Date.now() }])
    setFase('pensando')

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
          level: save.profile.levels[lang.id] ?? nivelPorXp(save.xp),
          userName: save.profile.name,
          history: turnsRef.current,
          message: clean,
          weakSpots: Object.entries(save.weakSpots).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => k),
          treino: modoRef.current === 'treino',
          serie: contextoDaSerie(save.profile.schoolYear),
        })
      } else {
        reply = offlineReply(clean, { lang, mood: moodRef.current as never, history: turnsRef.current })
      }
    } catch {
      reply = offlineReply(clean, { lang, mood: moodRef.current as never, history: turnsRef.current })
      reply.roast = 'A IA não respondeu agora — segui no modo offline. ' + (reply.roast ?? '')
    }

    // os erros viram cartão de revisão: é o que faz a conversa virar estudo
    for (const c of reply.corrections ?? []) {
      if (c.right && c.right.length > 2) {
        addConversationCard({ t: c.right, pt: c.why, tip: c.why }, lang.id)
        noteWeakSpot(c.why.slice(0, 60))
      }
    }
    addXp(3)
    bumpDaily('conversa')

    setLast(reply)
    setTurns((t) => [
      ...t,
      {
        role: 'grimm',
        text: reply.reply,
        pt: reply.replyPt,
        roast: reply.roast,
        corrections: reply.corrections,
        suggestion: reply.suggestion,
        score: reply.score,
        at: Date.now(),
      },
    ])
    setDrill(reply.drill ? { text: reply.drill, pt: reply.drillPt, why: reply.drillWhy } : null)

    // desligou ou pausou enquanto a IA pensava? entao ele nao fala sozinho por
    // cima da tela de resumo
    if (!naChamada.current || pausadoRef.current) {
      processando.current = false
      setFase(pausadoRef.current ? 'pausado' : 'parado')
      return
    }
    falarResposta(reply)
  }

  // --------------------------------------------------------- ligar/desligar

  async function ligar() {
    setStage('live')
    startedAt.current = Date.now()
    naChamada.current = true
    setPausado(false)
    pausadoRef.current = false
    processando.current = false
    reaberturas.current = 0
    setMicError(null)
    setFase('pensando')

    if (online) {
      try {
        const hi = await sendChat({
          langId: lang.id,
          langName: lang.name,
          mood: moodRef.current,
          scenarioId: scenario.id,
          scenarioTitle: scenario.title,
          situation: scenario.situation,
          level: save.profile.levels[lang.id] ?? nivelPorXp(save.xp),
          userName: save.profile.name,
          history: [],
          message: '',
          weakSpots: [],
          opening: true,
          treino: modoRef.current === 'treino',
          serie: contextoDaSerie(save.profile.schoolYear),
        })
        setTurns([{ role: 'grimm', text: hi.reply, pt: hi.replyPt, roast: hi.roast, at: Date.now() }])
        setLast(hi)
        setDrill(hi.drill ? { text: hi.drill, pt: hi.drillPt, why: hi.drillWhy } : null)
        falarResposta(hi)
        return
      } catch {
        /* cai para a abertura offline */
      }
    }
    const hello = offlineGreeting({ lang, mood: save.profile.mood as never, history: [] })
    setTurns([{ role: 'grimm', text: hello.reply, pt: hello.replyPt, roast: hello.roast, at: Date.now() }])
    setLast(hello)
    falarResposta(hello)
  }

  function pausar() {
    const vaiPausar = !pausado
    setPausado(vaiPausar)
    pausadoRef.current = vaiPausar
    setNotice(null)
    if (vaiPausar) {
      ciclo.current += 1
      processando.current = false
      pararMic()
      stopSpeaking()
      setFase('pausado')
      setSemSom(false)
      return
    }
    // voltando: a chamada pode ter caído junto, então religa o ciclo
    setMicError(null)
    naChamada.current = true
    processando.current = false
    reaberturas.current = 0
    setFase('ouvindo')
    setTimeout(abrirMic, 100)
  }

  function switchMood(id: string) {
    patchProfile({ mood: id })
    moodRef.current = id
    setNotice(getMood(id).onSwitch)
    setTimeout(() => setNotice(null), 3500)
  }

  async function desligar() {
    naChamada.current = false
    ciclo.current += 1
    processando.current = false
    pararMic()
    stopSpeaking()
    setFase('parado')
    const minhas = turns.filter((t) => t.role === 'user')
    const secs = Math.round((Date.now() - startedAt.current) / 1000)
    logConversation(minhas.length, secs, minhas.reduce((n, t) => n + words(t.text).length, 0))
    addXp(Math.min(60, minhas.length * 5))
    setStage('report')
    if (online && minhas.length >= 2) {
      setBusyReport(true)
      try {
        setReport(await sendReport({ langName: lang.name, mood: save.profile.mood, turns, userName: save.profile.name }))
      } catch {
        setReport(null)
      }
      setBusyReport(false)
    }
  }

  // ----------------------------------------------------------------- telas

  if (stage === 'setup')
    return (
      <div className="screen conv-setup">
        <header className="conv-top">
          <button className="x" onClick={onExit}>✕</button>
          <h2>Ligar para o Voca · {lang.flag} {lang.name}</h2>
        </header>
        <Voca state="idle" face={mood.face} color={mood.color} size={130} />

        <p className="muted center">
          {speechOk
            ? 'É uma ligação de verdade: você aperta ligar uma vez e depois é só falar. Ele escuta, corrige e responde em voz alta — o microfone reabre sozinho.'
            : 'Seu navegador não tem reconhecimento de fala. Dá para conversar digitando, mas a ligação por voz só funciona no Chrome ou Edge.'}
        </p>
        {online === false && (
          <p className="offline-warn">
            <b>Modo offline</b> — o Voca responde com perguntas do próprio curso. Para a conversa
            de verdade, ligue o Modo IA no seu perfil.
          </p>
        )}

        <h3 className="sec">Como você quer treinar</h3>
        <div className="modo-row">
          <button className={modo === 'treino' ? 'on' : ''} onClick={() => setModo('treino')}>
            treino de fala
          </button>
          <button className={modo === 'livre' ? 'on' : ''} onClick={() => setModo('livre')}>
            conversa livre
          </button>
        </div>
        <p className="muted small">
          {modo === 'treino'
            ? 'Ele fala pouco e te dá frases para repetir em voz alta, com nota de pronúncia.'
            : 'Papo solto: ele puxa assunto e corrige no meio da conversa.'}
        </p>

        <h3 className="sec">Humor do Voca</h3>
        <MoodRow current={save.profile.mood} onPick={switchMood} />

        <h3 className="sec">Onde vocês estão?</h3>
        <div className="scen-grid">
          {SCENARIOS.map((s) => (
            <button key={s.id} className={`scen ${scenarioId === s.id ? 'on' : ''}`} onClick={() => setScenarioId(s.id)}>
                            <b>{s.title}</b>
              <small>{s.goal}</small>
            </button>
          ))}
        </div>
        <button className="btn ligar" onClick={ligar}>ligar para o Voca</button>
      </div>
    )

  if (stage === 'report') {
    const todas = turns.flatMap((t) => t.corrections ?? [])
    return (
      <div className="screen conv-report">
        <Voca state="idle" face={mood.face} color={mood.color} size={120} />
        <h1>Chamada encerrada</h1>
        <div className="result-grid">
          <div><b>{turns.filter((t) => t.role === 'user').length}</b><small>falas suas</small></div>
          <div><b>{Math.floor(segundos / 60)}min {segundos % 60}s</b><small>de ligação</small></div>
          <div><b>{todas.length}</b><small>correções</small></div>
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
                    <li key={p.palavra}><b>{p.palavra}</b> — travou {p.vezes}x</li>
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
            <ul>{report.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
            <h3>Para consertar</h3>
            <ul>{report.fix.map((f, i) => <li key={i}><b>{f.what}</b><br /><span className="ex-good">{f.example}</span></li>)}</ul>
            <p className="next-goal">{report.nextGoal}</p>
          </div>
        )}
        {!report && todas.length > 0 && (
          <div className="report">
            <h3>O que corrigir</h3>
            <ul>{todas.slice(0, 8).map((c, i) => <li key={i}><b>{c.right}</b><br /><small>{c.why}</small></li>)}</ul>
          </div>
        )}

        <p className="muted center">As correções viraram cartões de revisão — elas voltam nos próximos dias.</p>
        <button className="btn primary big" onClick={onExit}>Voltar</button>
      </div>
    )
  }

  // ----------------------------------------------------- a ligação, ao vivo
  const ultimo = turns[turns.length - 1]
  const statusTexto = {
    ouvindo: 'pode falar',
    pensando: 'pensando…',
    falando: 'falando',
    pausado: 'microfone pausado',
    parado: '…',
  }[fase]

  return (
    <div className="screen conv-live em-chamada" style={{ ['--mood' as string]: mood.color }}>
      <header className="chamada-top">
        <span className="chamada-scen">{scenario.title}</span>
        <span className="chamada-tempo">{String(Math.floor(segundos / 60)).padStart(2, '0')}:{String(segundos % 60).padStart(2, '0')}</span>
        <span className="mode-chip">{online ? 'IA' : 'offline'}</span>
      </header>

      <MoodRow current={save.profile.mood} onPick={switchMood} compact />
      {notice && <div className="notice">{notice}</div>}

      <div className="stage">
        <Voca state={estadoVoca} face={mood.face} color={mood.color} size={200} energy={energy} />
        <div className={`status ${fase}`}>{statusTexto}</div>

        <div className="bubble">
          {fase === 'pensando' ? (
            <p className="thinking">pensando…</p>
          ) : (
            <>
              <p className="said" lang={lang.locale} dir={lang.rtl ? 'rtl' : 'ltr'}>
                {ultimo?.role === 'grimm' ? ultimo.text : '…'}
              </p>
              {save.profile.showPt && ultimo?.pt && <p className="said-pt">{ultimo.pt}</p>}
            </>
          )}
        </div>
        {last?.roast && <p className="roast-line">{last.roast}</p>}

        {/* o que ela está falando agora */}
        {partial && <p className="voce-falando">você: “{partial}”</p>}
        {semSom && !partial && fase === 'ouvindo' && (
          <p className="sem-som">
            não estou te ouvindo — fala mais perto do microfone, ou toque em pausar e voltar
          </p>
        )}
      </div>

      {drill && (
        <div className={`drill ${nota ? nota.veredito : ''}`}>
          <div className="drill-top">
            <b>repete em voz alta</b>
            <button className="mini-speak" onClick={() => speak(drill.text, { locale: lang.locale, rate: 0.9, voiceName: save.profile.voiceName })}>▶</button>
            <button className="mini-speak" onClick={() => speak(drill.text, { locale: lang.locale, rate: 0.6 })}>½×</button>
          </div>
          <p className="drill-text" lang={lang.locale} dir={lang.rtl ? 'rtl' : 'ltr'}>{drill.text}</p>
          {drill.pt && <p className="drill-pt">{drill.pt}</p>}
          {drill.why && <p className="drill-why">{drill.why}</p>}
          <p className="muted small">é só falar — o microfone já está aberto</p>
        </div>
      )}

      {nota && (
        <div className={`nota-flutuante ${nota.veredito}`}>
          <b>{nota.score}</b>
          <div>
            <span>
              {nota.veredito === 'perfeito' && 'saiu perfeito'}
              {nota.veredito === 'bom' && 'deu para entender bem'}
              {nota.veredito === 'quase' && 'quase — travou em algumas'}
              {nota.veredito === 'refaz' && 'não deu para entender'}
            </span>
            {nota.erradas.length > 0 && <small>treina: {nota.erradas.join(', ')}</small>}
          </div>
        </div>
      )}

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

      {micError && <p className="mic-error">{micError}</p>}

      {/* sem microfone no navegador: sobra digitar */}
      {!speechOk && (
        <form
          className="type-row"
          onSubmit={(e) => {
            e.preventDefault()
            const t = typed
            setTyped('')
            enviar(t)
          }}
        >
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={`escreva em ${lang.name}…`} />
          <button className="btn primary" disabled={!typed.trim() || fase === 'pensando'}>enviar</button>
        </form>
      )}

      <div className="chamada-controles">
        {speechOk && (
          <button className={`ctl ${pausado ? 'on' : ''}`} onClick={pausar}>
            {pausado ? 'voltar' : 'pausar'}
          </button>
        )}
        <button className="ctl desligar" onClick={desligar}>desligar</button>
        <button className="ctl" onClick={() => ultimo && falarResposta({ reply: ultimo.text, corrections: [] })}>
          repetir
        </button>
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
          <u className="mood-dot" />
          <b>{m.label}</b>
        </button>
      ))}
    </div>
  )
}

function nivelPorXp(xp: number) {
  if (xp < 300) return 'A1 (iniciante)'
  if (xp < 1200) return 'A2 (básico)'
  if (xp < 3000) return 'B1 (intermediário)'
  return 'B2 (avançado)'
}
