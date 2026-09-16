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
    opts.onEnd?.()
  }
  u.onerror = () => {
    currentUtterance = null
    opts.onEnd?.()
  }
  currentUtterance = u
  window.speechSynthesis.speak(u)
  return stopSpeaking
}

/**
 * Fala em portugues do Brasil — usado para a bronca e para a traducao.
 * rate/pitch vem do humor: no modo bravo a voz fica mais grave e acelerada.
 */
export function speakPt(
  text: string,
  opts: { rate?: number; pitch?: number; voiceName?: string | null; onEnd?: () => void } = {},
) {
  return speak(text, {
    locale: 'pt-BR',
    rate: opts.rate ?? 1.1,
    pitch: opts.pitch ?? 0.85,
    voiceName: opts.voiceName ?? null,
    onEnd: opts.onEnd,
  })
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  currentUtterance = null
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
          if (text) h.onFinal?.(text)
        } else {
          interim += r[0]?.transcript ?? ''
        }
      }
      if (interim) h.onPartial?.(interim.trim())
    }
    rec.onerror = (e: any) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return
      h.onError?.(e.error || 'erro')
    }
    rec.onend = () => {
      if (!stopped && keepAlive) {
        setTimeout(start, 250)
      } else {
        h.onEnd?.()
      }
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
