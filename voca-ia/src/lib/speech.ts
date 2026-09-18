// Voz do app: sintese (o Voca falando) e reconhecimento (voce falando).
// Tudo roda no proprio navegador — nao sobe audio para lugar nenhum.

let cachedVoices: SpeechSynthesisVoice[] = []

export function voicesReady(cb: (v: SpeechSynthesisVoice[]) => void) {
  if (!('speechSynthesis' in window)) return cb([])
  const load = () => {
    cachedVoices = window.speechSynthesis.getVoices()
    if (cachedVoices.length) cb(cachedVoices)
  }
  load()
  window.speechSynthesis.onvoiceschanged = load
}

export function voicesFor(locale: string) {
  const base = locale.split('-')[0]
  const all = cachedVoices.length ? cachedVoices : window.speechSynthesis?.getVoices?.() ?? []
  return all.filter((v) => v.lang.toLowerCase().startsWith(base))
}

export function hasVoiceFor(locale: string) {
  return voicesFor(locale).length > 0
}

export type SpeakOpts = {
  locale: string
  rate?: number
  pitch?: number
  voiceName?: string | null
  onStart?: () => void
  onEnd?: () => void
  /** progresso da fala (0..1) — move a boca do bonequinho */
  onProgress?: (p: number) => void
}

let currentUtterance: SpeechSynthesisUtterance | null = null
/**
 * O Chrome corta a sintese de voz perto dos 15 segundos e, pior, as vezes nem
 * avisa que terminou — a fala some no meio e quem esperava o `onend` fica
 * plantado. O truque conhecido e dar um pause/resume antes de bater o limite.
 */
let resumeTicker: number | null = null
const ehChromium = () => typeof navigator !== 'undefined' && /Chrome|Chromium|Edg/.test(navigator.userAgent)

function pararTicker() {
  if (resumeTicker !== null) {
    clearInterval(resumeTicker)
    resumeTicker = null
  }
}

export function speak(text: string, opts: SpeakOpts) {
  if (!('speechSynthesis' in window) || !text.trim()) {
    opts.onEnd?.()
    return () => {}
  }
  stopSpeaking()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = opts.locale
  u.rate = opts.rate ?? 1
  u.pitch = opts.pitch ?? 1
  const pool = voicesFor(opts.locale)
  const chosen = (opts.voiceName && pool.find((v) => v.name === opts.voiceName)) || pool[0]
  if (chosen) u.voice = chosen
  u.onstart = () => opts.onStart?.()
  u.onboundary = (e) => opts.onProgress?.(Math.min(1, (e.charIndex || 0) / Math.max(1, text.length)))
  u.onend = () => {
    currentUtterance = null
    pararTicker()
    opts.onEnd?.()
  }
  u.onerror = () => {
    currentUtterance = null
    pararTicker()
    opts.onEnd?.()
  }
  currentUtterance = u
  window.speechSynthesis.speak(u)
  pararTicker()
  if (ehChromium()) {
    resumeTicker = window.setInterval(() => {
      const s = window.speechSynthesis
      if (!s.speaking) return pararTicker()
      s.pause()
      s.resume()
    }, 9000)
  }
  return stopSpeaking
}

// ------------------------------------------------------- voz natural (IA)
// Quando o servidor tem ElevenLabs, a fala em portugues vem de la — bem menos
// robotica. O audio fica guardado nesta sessao, entao a mesma frase nao e
// pedida duas vezes. Falhou, sem chave ou sem credito? Cai na voz do navegador.
let audioAtual: HTMLAudioElement | null = null
const cacheAudio = new Map<string, string>()
let ttsDisponivel: boolean | null = null

export function setNaturalVoiceAvailable(v: boolean | null) {
  ttsDisponivel = v
}

export function naturalVoiceAvailable() {
  return ttsDisponivel
}

export function stopAudio() {
  if (audioAtual) {
    audioAtual.pause()
    audioAtual.currentTime = 0
    audioAtual = null
  }
}

type PtOpts = {
  rate?: number
  pitch?: number
  voiceName?: string | null
  /** nivel do humor: 0 calmo ... 3 insuportavel */
  nivel?: number
  /** desliga a voz natural e usa a do navegador */
  semIa?: boolean
  /** voz escolhida no perfil */
  voiceId?: string | null
  onStart?: () => void
  onEnd?: () => void
}

/**
 * Fala em portugues do Brasil — a bronca e a traducao.
 * Tenta a voz natural primeiro; se nao der, usa a do navegador com o tom do humor.
 */
export function speakPt(text: string, opts: PtOpts = {}) {
  const limpo = text.trim()
  if (!limpo) {
    opts.onEnd?.()
    return () => {}
  }

  const navegador = () =>
    speak(limpo, {
      locale: 'pt-BR',
      rate: opts.rate ?? 1.1,
      pitch: opts.pitch ?? 0.85,
      voiceName: opts.voiceName ?? null,
      onStart: opts.onStart,
      onEnd: opts.onEnd,
    })

  if (opts.semIa || ttsDisponivel === false) return navegador()

  const nivel = opts.nivel ?? 2
  const chave = `${opts.voiceId ?? ''}|${nivel}|${limpo}`
  const tocar = (url: string) => {
    stopSpeaking()
    stopAudio()
    const a = new Audio(url)
    audioAtual = a
    a.onplay = () => opts.onStart?.()
    a.onended = () => {
      audioAtual = null
      opts.onEnd?.()
    }
    a.onerror = () => {
      audioAtual = null
      navegador()
    }
    a.play().catch(() => {
      audioAtual = null
      navegador()
    })
  }

  const pronto = cacheAudio.get(chave)
  if (pronto) {
    tocar(pronto)
    return stopAudio
  }

  fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: limpo, nivel, voiceId: opts.voiceId || undefined }),
  })
    .then(async (r) => {
      if (!r.ok) {
        // sem chave ou sem credito: nao insiste mais nesta sessao
        if (r.status === 503 || r.status === 429) ttsDisponivel = false
        throw new Error(String(r.status))
      }
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      cacheAudio.set(chave, url)
      ttsDisponivel = true
      tocar(url)
    })
    .catch(() => navegador())

  return stopAudio
}

export function stopSpeaking() {
  pararTicker()
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  currentUtterance = null
  stopAudio()
}

export function isSpeaking() {
  return !!currentUtterance
}

// ---------------------------------------------------------------- microfone

type SR = any

export function sttSupported() {
  return typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
}

export type ListenHandlers = {
  onPartial?: (text: string) => void
  onFinal?: (text: string) => void
  onError?: (err: string) => void
  onEnd?: () => void
  /** volume aproximado (0..1) para animar o bonequinho */
  onLevel?: (level: number) => void
}

/**
 * Escuta continua: devolve um controle com stop(). Reinicia sozinho enquanto
 * `keepAlive` for verdadeiro (o navegador corta a escuta a cada ~60s).
 */
export function listen(locale: string, h: ListenHandlers, keepAlive = true) {
  const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (!Ctor) {
    h.onError?.('unsupported')
    return { stop() {}, alive: false }
  }
  let stopped = false
  let rec: SR = null

  const start = () => {
    if (stopped) return
    // um "final" por escuta: o Chrome as vezes repete o mesmo resultado e
    // isso disparava duas rodadas de IA ao mesmo tempo
    let entregou = false
    rec = new Ctor()
    rec.lang = locale
    rec.continuous = false
    rec.interimResults = true
    rec.maxAlternatives = 1
    rec.onresult = (e: any) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) {
          const text = (r[0]?.transcript ?? '').trim()
          if (text && !entregou && !stopped) {
            entregou = true
            h.onFinal?.(text)
          }
        } else {
          interim += r[0]?.transcript ?? ''
        }
      }
      if (interim && !entregou && !stopped) h.onPartial?.(interim.trim())
    }
    rec.onerror = (e: any) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return
      h.onError?.(e.error || 'erro')
    }
    rec.onend = () => {
      // Parada deliberada (alguem chamou stop()): quem parou ja sabe disso.
      // Avisar aqui criava um laco — o proximo abrirMic() parava o anterior,
      // que disparava onEnd, que mandava abrir de novo, e assim por diante.
      if (stopped) return
      // Fim natural: o navegador encerra a escuta sozinho depois de um tempo
      // de silencio. Quem chamou decide se reabre.
      if (keepAlive) setTimeout(start, 250)
      else h.onEnd?.()
    }
    try {
      rec.start()
    } catch {
      /* já estava rodando */
    }
  }
  start()
  return {
    alive: true,
    stop() {
      stopped = true
      try {
        rec?.stop()
      } catch {
        /* ignora */
      }
    },
  }
}
