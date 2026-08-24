// Sons gerados por codigo com WebAudio — sem arquivos de audio.

let ctx: AudioContext | null = null
let mutedFlag = false
let heartbeatTimer: number | null = null

function ac(): AudioContext | null {
  if (mutedFlag) return null
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

export function setMuted(m: boolean) {
  mutedFlag = m
  if (m) stopHeartbeat()
}

export function isMuted() {
  return mutedFlag
}

function tone(freq: number, dur: number, type: OscillatorType, gain = 0.15, when = 0) {
  const c = ac()
  if (!c) return
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.value = freq
  g.gain.setValueAtTime(gain, c.currentTime + when)
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + when + dur)
  o.connect(g).connect(c.destination)
  o.start(c.currentTime + when)
  o.stop(c.currentTime + when + dur + 0.02)
}

function noise(dur: number, gain = 0.2, filterFreq = 1200, when = 0) {
  const c = ac()
  if (!c) return
  const len = Math.max(1, Math.floor(c.sampleRate * dur))
  const buf = c.createBuffer(1, len, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = c.createBufferSource()
  src.buffer = buf
  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = filterFreq
  const g = c.createGain()
  g.gain.value = gain
  src.connect(f).connect(g).connect(c.destination)
  src.start(c.currentTime + when)
}

/** Tecla de maquina de escrever. */
export function sfxKey() {
  noise(0.03, 0.12, 3500)
  tone(1800 + Math.random() * 600, 0.03, 'square', 0.03)
}

/** "Thud" de carimbo batendo. */
export function sfxStamp() {
  const c = ac()
  if (!c) return
  noise(0.12, 0.5, 500)
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(150, c.currentTime)
  o.frequency.exponentialRampToValueAtTime(40, c.currentTime + 0.15)
  g.gain.setValueAtTime(0.6, c.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18)
  o.connect(g).connect(c.destination)
  o.start()
  o.stop(c.currentTime + 0.2)
}

export function sfxTap() {
  tone(700, 0.05, 'sine', 0.08)
}

export function sfxSuccess() {
  tone(523, 0.12, 'triangle', 0.15)
  tone(659, 0.12, 'triangle', 0.15, 0.1)
  tone(784, 0.2, 'triangle', 0.18, 0.2)
}

export function sfxError() {
  tone(160, 0.2, 'sawtooth', 0.12)
  tone(110, 0.25, 'sawtooth', 0.12, 0.08)
}

/** Alerta dramatico da contradicao. */
export function sfxContradiction() {
  tone(880, 0.09, 'square', 0.14)
  tone(660, 0.09, 'square', 0.14, 0.1)
  tone(880, 0.09, 'square', 0.14, 0.2)
  tone(1174, 0.35, 'sawtooth', 0.1, 0.3)
}

/** Fanfarra curta de vitoria. */
export function sfxFanfare() {
  const seq: Array<[number, number]> = [
    [523, 0],
    [659, 0.15],
    [784, 0.3],
    [1046, 0.45],
    [784, 0.65],
    [1046, 0.8],
  ]
  for (const [f, t] of seq) tone(f, 0.22, 'triangle', 0.18, t)
  tone(1318, 0.5, 'triangle', 0.2, 1.0)
}

function heartBeatOnce() {
  const c = ac()
  if (!c) return
  const beat = (when: number) => {
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(70, c.currentTime + when)
    o.frequency.exponentialRampToValueAtTime(45, c.currentTime + when + 0.1)
    g.gain.setValueAtTime(0.25, c.currentTime + when)
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + when + 0.13)
    o.connect(g).connect(c.destination)
    o.start(c.currentTime + when)
    o.stop(c.currentTime + when + 0.15)
  }
  beat(0)
  beat(0.22)
}

/** Batida de coracao em loop (interrogatorio). */
export function startHeartbeat() {
  if (heartbeatTimer !== null || mutedFlag) return
  heartBeatOnce()
  heartbeatTimer = window.setInterval(heartBeatOnce, 900)
}

export function stopHeartbeat() {
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}
