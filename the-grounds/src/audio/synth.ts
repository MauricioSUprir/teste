/**
 * Síntese de áudio em tempo real.
 *
 * Todos os sons do jogo são gerados por código (ruído filtrado, osciladores,
 * envelopes e modulação), sem depender de arquivos externos. Isso mantém o
 * projeto leve, evita questões de licença e permite variar cada repetição —
 * dois passos nunca soam exatamente iguais.
 */

export type SurfaceSound = 'asfalto' | 'calcada' | 'grama' | 'terra' | 'madeira' | 'agua' | 'interno' | 'areia'

/** Buffers de ruído reaproveitados (gerá-los a cada som seria caro). */
export class NoiseBank {
  readonly branco: AudioBuffer
  readonly rosa: AudioBuffer
  readonly marrom: AudioBuffer

  constructor(ctx: BaseAudioContext) {
    this.branco = this.gerar(ctx, 2, 'branco')
    this.rosa = this.gerar(ctx, 2, 'rosa')
    this.marrom = this.gerar(ctx, 3, 'marrom')
  }

  private gerar(ctx: BaseAudioContext, segundos: number, tipo: 'branco' | 'rosa' | 'marrom'): AudioBuffer {
    const n = Math.floor(ctx.sampleRate * segundos)
    const buf = ctx.createBuffer(1, n, ctx.sampleRate)
    const d = buf.getChannelData(0)
    if (tipo === 'branco') {
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
    } else if (tipo === 'rosa') {
      // Aproximação de Voss-McCartney: soma de oitavas.
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
      for (let i = 0; i < n; i++) {
        const w = Math.random() * 2 - 1
        b0 = 0.99886 * b0 + w * 0.0555179
        b1 = 0.99332 * b1 + w * 0.0750759
        b2 = 0.96900 * b2 + w * 0.1538520
        b3 = 0.86650 * b3 + w * 0.3104856
        b4 = 0.55000 * b4 + w * 0.5329522
        b5 = -0.7616 * b5 - w * 0.0168980
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
        b6 = w * 0.115926
      }
    } else {
      let last = 0
      for (let i = 0; i < n; i++) {
        const w = Math.random() * 2 - 1
        last = (last + 0.02 * w) / 1.02
        d[i] = last * 3.5
      }
    }
    return buf
  }
}

export interface SynthTarget {
  ctx: AudioContext
  destino: AudioNode
  ruido: NoiseBank
}

function agora(ctx: AudioContext): number { return ctx.currentTime }

/** Envelope percussivo padrão. */
function env(ctx: AudioContext, gain: GainNode, pico: number, ataque: number, decaimento: number, t = agora(ctx)): void {
  gain.gain.cancelScheduledValues(t)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(Math.max(pico, 0.0002), t + ataque)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + ataque + decaimento)
}

/** Passo, com timbre por superfície. */
export function passo(s: SynthTarget, superficie: SurfaceSound, forca = 1, correndo = false): void {
  const { ctx, destino, ruido } = s
  const src = ctx.createBufferSource()
  src.buffer = ruido.branco
  src.playbackRate.value = 0.7 + Math.random() * 0.6

  const filtro = ctx.createBiquadFilter()
  const corpo = ctx.createBiquadFilter()
  const g = ctx.createGain()

  const perfis: Record<SurfaceSound, { tipo: BiquadFilterType; freq: number; q: number; corpoFreq: number; dur: number; ganho: number }> = {
    asfalto: { tipo: 'bandpass', freq: 1900, q: 1.1, corpoFreq: 220, dur: 0.075, ganho: 0.28 },
    calcada: { tipo: 'bandpass', freq: 2600, q: 1.5, corpoFreq: 280, dur: 0.065, ganho: 0.30 },
    grama: { tipo: 'bandpass', freq: 1100, q: 0.7, corpoFreq: 150, dur: 0.11, ganho: 0.20 },
    terra: { tipo: 'lowpass', freq: 900, q: 0.8, corpoFreq: 130, dur: 0.10, ganho: 0.24 },
    madeira: { tipo: 'bandpass', freq: 800, q: 3.2, corpoFreq: 190, dur: 0.13, ganho: 0.30 },
    agua: { tipo: 'bandpass', freq: 3400, q: 0.8, corpoFreq: 340, dur: 0.16, ganho: 0.26 },
    interno: { tipo: 'bandpass', freq: 2200, q: 2.0, corpoFreq: 240, dur: 0.08, ganho: 0.26 },
    areia: { tipo: 'lowpass', freq: 1500, q: 0.6, corpoFreq: 120, dur: 0.14, ganho: 0.18 },
  }
  const p = perfis[superficie]
  filtro.type = p.tipo
  filtro.frequency.value = p.freq * (0.85 + Math.random() * 0.3)
  filtro.Q.value = p.q

  corpo.type = 'lowpass'
  corpo.frequency.value = p.corpoFreq * (0.9 + Math.random() * 0.2)

  const t = agora(ctx)
  const amp = p.ganho * forca * (correndo ? 1.5 : 1)
  env(ctx, g, amp, 0.004, p.dur * (correndo ? 0.8 : 1), t)

  src.connect(filtro)
  filtro.connect(corpo)
  corpo.connect(g)
  g.connect(destino)
  src.start(t)
  src.stop(t + p.dur + 0.06)
}

/** Impacto da bola: componente grave e estalo. */
export function toqueBola(s: SynthTarget, forca: number, tipo: 'chute' | 'quique' | 'trave' | 'rede'): void {
  const { ctx, destino, ruido } = s
  const t = agora(ctx)
  const f = Math.min(1, forca / 12)

  if (tipo !== 'rede') {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = tipo === 'trave' ? 'triangle' : 'sine'
    const base = tipo === 'trave' ? 320 : tipo === 'chute' ? 130 : 95
    osc.frequency.setValueAtTime(base * (1.3 + f), t)
    osc.frequency.exponentialRampToValueAtTime(base * 0.55, t + 0.14)
    env(ctx, g, 0.36 * (0.35 + f), 0.002, tipo === 'trave' ? 0.42 : 0.16, t)
    osc.connect(g)
    g.connect(destino)
    osc.start(t)
    osc.stop(t + 0.6)
  }

  const src = ctx.createBufferSource()
  src.buffer = ruido.branco
  src.playbackRate.value = 0.8 + Math.random() * 0.5
  const hp = ctx.createBiquadFilter()
  hp.type = tipo === 'rede' ? 'bandpass' : 'highpass'
  hp.frequency.value = tipo === 'rede' ? 4200 : 1400
  hp.Q.value = tipo === 'rede' ? 0.9 : 0.7
  const g2 = ctx.createGain()
  env(ctx, g2, (tipo === 'rede' ? 0.16 : 0.20) * (0.3 + f), 0.002, tipo === 'rede' ? 0.22 : 0.09, t)
  src.connect(hp)
  hp.connect(g2)
  g2.connect(destino)
  src.start(t)
  src.stop(t + 0.4)
}

/** Porta: dobradiça e trinco. */
export function porta(s: SynthTarget, abrindo: boolean): void {
  const { ctx, destino, ruido } = s
  const t = agora(ctx)

  // Rangido: ruído filtrado com frequência deslizante.
  const src = ctx.createBufferSource()
  src.buffer = ruido.rosa
  src.playbackRate.value = 0.5 + Math.random() * 0.2
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 7
  const f0 = abrindo ? 620 : 900
  bp.frequency.setValueAtTime(f0, t)
  bp.frequency.exponentialRampToValueAtTime(abrindo ? 980 : 540, t + 0.34)
  const g = ctx.createGain()
  env(ctx, g, 0.09, 0.03, 0.34, t)
  src.connect(bp); bp.connect(g); g.connect(destino)
  src.start(t); src.stop(t + 0.5)

  // Trinco no fim
  const tl = t + (abrindo ? 0.05 : 0.36)
  const cl = ctx.createBufferSource()
  cl.buffer = ruido.branco
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 2400
  const g2 = ctx.createGain()
  env(ctx, g2, 0.16, 0.002, 0.05, tl)
  cl.connect(hp); hp.connect(g2); g2.connect(destino)
  cl.start(tl); cl.stop(tl + 0.12)
}

/** Clique da interface. */
export function clique(s: SynthTarget, tipo: 'mover' | 'confirmar' | 'voltar' | 'erro'): void {
  const { ctx, destino } = s
  const t = agora(ctx)
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'sine'
  const freqs: Record<string, [number, number]> = {
    mover: [880, 880], confirmar: [660, 990], voltar: [660, 440], erro: [320, 240],
  }
  const [a, b] = freqs[tipo]
  osc.frequency.setValueAtTime(a, t)
  osc.frequency.exponentialRampToValueAtTime(b, t + 0.09)
  env(ctx, g, tipo === 'mover' ? 0.05 : 0.09, 0.004, tipo === 'erro' ? 0.22 : 0.11, t)
  osc.connect(g); g.connect(destino)
  osc.start(t); osc.stop(t + 0.4)
}

/** Buzina de carro (dois tons, típico). */
export function buzina(s: SynthTarget, duracao = 0.45): void {
  const { ctx, destino } = s
  const t = agora(ctx)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.16, t + 0.02)
  g.gain.setValueAtTime(0.16, t + duracao - 0.05)
  g.gain.exponentialRampToValueAtTime(0.0001, t + duracao)
  for (const f of [440, 554, 880, 1108]) {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = f * (0.995 + Math.random() * 0.01)
    const og = ctx.createGain()
    og.gain.value = f > 800 ? 0.18 : 0.45
    o.connect(og); og.connect(g)
    o.start(t); o.stop(t + duracao + 0.1)
  }
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 3200
  g.connect(lp); lp.connect(destino)
}

/** Apito do árbitro. */
export function apito(s: SynthTarget, duracao = 0.5): void {
  const { ctx, destino, ruido } = s
  const t = agora(ctx)
  const g = ctx.createGain()
  env(ctx, g, 0.18, 0.02, duracao, t)

  const o = ctx.createOscillator()
  o.type = 'sine'
  o.frequency.value = 2650
  const lfo = ctx.createOscillator()
  lfo.type = 'sine'
  lfo.frequency.value = 26
  const lfoGain = ctx.createGain()
  lfoGain.gain.value = 160
  lfo.connect(lfoGain)
  lfoGain.connect(o.frequency)

  const n = ctx.createBufferSource()
  n.buffer = ruido.branco
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 2800
  bp.Q.value = 5
  const ng = ctx.createGain()
  ng.gain.value = 0.35

  o.connect(g)
  n.connect(bp); bp.connect(ng); ng.connect(g)
  g.connect(destino)
  o.start(t); o.stop(t + duracao + 0.1)
  lfo.start(t); lfo.stop(t + duracao + 0.1)
  n.start(t); n.stop(t + duracao + 0.1)
}

/** Motor de combustão: fundamental + harmônicos + ruído de admissão. */
export class MotorSynth {
  private osc: OscillatorNode[] = []
  private oscGains: GainNode[] = []
  private noiseSrc: AudioBufferSourceNode
  private noiseGain: GainNode
  private noiseFilter: BiquadFilterType extends never ? never : BiquadFilterNode
  private master: GainNode
  private lp: BiquadFilterNode
  private ctx: AudioContext
  private iniciado = false

  constructor(s: SynthTarget, cilindros = 4) {
    this.ctx = s.ctx
    this.master = s.ctx.createGain()
    this.master.gain.value = 0
    this.lp = s.ctx.createBiquadFilter()
    this.lp.type = 'lowpass'
    this.lp.frequency.value = 2600

    // Harmônicos correspondem às ordens de explosão do motor.
    const ordens = cilindros === 8 ? [1, 2, 4, 6] : cilindros === 6 ? [1, 1.5, 3, 4.5] : [1, 2, 3, 5]
    for (const ordem of ordens) {
      const o = s.ctx.createOscillator()
      o.type = ordem === 1 ? 'sawtooth' : 'square'
      o.frequency.value = 40 * ordem
      const g = s.ctx.createGain()
      g.gain.value = 0.32 / ordem
      o.connect(g)
      g.connect(this.lp)
      this.osc.push(o)
      this.oscGains.push(g)
    }

    this.noiseSrc = s.ctx.createBufferSource()
    this.noiseSrc.buffer = s.ruido.marrom
    this.noiseSrc.loop = true
    this.noiseFilter = s.ctx.createBiquadFilter()
    this.noiseFilter.type = 'bandpass'
    this.noiseFilter.frequency.value = 340
    this.noiseFilter.Q.value = 0.7
    this.noiseGain = s.ctx.createGain()
    this.noiseGain.gain.value = 0.12
    this.noiseSrc.connect(this.noiseFilter)
    this.noiseFilter.connect(this.noiseGain)
    this.noiseGain.connect(this.lp)

    this.lp.connect(this.master)
    this.master.connect(s.destino)
  }

  iniciar(): void {
    if (this.iniciado) return
    this.iniciado = true
    const t = this.ctx.currentTime
    for (const o of this.osc) o.start(t)
    this.noiseSrc.start(t)
  }

  /** `rpmNorm` 0..1, `carga` 0..1 (acelerador), `volume` final. */
  atualizar(rpmNorm: number, carga: number, volume: number): void {
    if (!this.iniciado) return
    const t = this.ctx.currentTime
    const base = 26 + rpmNorm * 92
    for (let i = 0; i < this.osc.length; i++) {
      const ordem = [1, 2, 3, 5][i] ?? (i + 1)
      this.osc[i].frequency.setTargetAtTime(base * ordem, t, 0.045)
      this.oscGains[i].gain.setTargetAtTime((0.30 / ordem) * (0.45 + carga * 0.55), t, 0.08)
    }
    this.noiseFilter.frequency.setTargetAtTime(220 + rpmNorm * 1500, t, 0.08)
    this.noiseGain.gain.setTargetAtTime(0.05 + carga * 0.14, t, 0.09)
    this.lp.frequency.setTargetAtTime(900 + rpmNorm * 3200 + carga * 1200, t, 0.08)
    this.master.gain.setTargetAtTime(volume, t, 0.07)
  }

  parar(): void {
    if (!this.iniciado) return
    const t = this.ctx.currentTime
    this.master.gain.setTargetAtTime(0, t, 0.12)
    for (const o of this.osc) o.stop(t + 0.5)
    this.noiseSrc.stop(t + 0.5)
    this.iniciado = false
  }
}

/** Camada de ambiente contínua: vento, chuva, tráfego distante, murmúrio. */
export class AmbienteSynth {
  private src: AudioBufferSourceNode
  private filtro: BiquadFilterNode
  private ganho: GainNode
  private lfo: OscillatorNode
  private lfoGain: GainNode
  private ctx: AudioContext
  private iniciado = false

  constructor(
    s: SynthTarget,
    private readonly perfil: 'vento' | 'chuva' | 'trafego' | 'murmurio' | 'rio' | 'interior',
  ) {
    this.ctx = s.ctx
    this.src = s.ctx.createBufferSource()
    this.src.buffer = perfil === 'chuva' ? s.ruido.branco : s.ruido.rosa
    this.src.loop = true
    this.src.playbackRate.value = perfil === 'trafego' ? 0.45 : 1

    this.filtro = s.ctx.createBiquadFilter()
    const perfis = {
      vento: { tipo: 'lowpass' as BiquadFilterType, freq: 520, q: 0.6, lfoFreq: 0.13, lfoDepth: 240 },
      chuva: { tipo: 'highpass' as BiquadFilterType, freq: 1400, q: 0.5, lfoFreq: 0.4, lfoDepth: 260 },
      trafego: { tipo: 'lowpass' as BiquadFilterType, freq: 380, q: 0.7, lfoFreq: 0.07, lfoDepth: 130 },
      murmurio: { tipo: 'bandpass' as BiquadFilterType, freq: 640, q: 1.4, lfoFreq: 0.22, lfoDepth: 170 },
      rio: { tipo: 'bandpass' as BiquadFilterType, freq: 900, q: 0.5, lfoFreq: 0.18, lfoDepth: 220 },
      interior: { tipo: 'lowpass' as BiquadFilterType, freq: 260, q: 0.8, lfoFreq: 0.05, lfoDepth: 60 },
    }
    const p = perfis[perfil]
    this.filtro.type = p.tipo
    this.filtro.frequency.value = p.freq
    this.filtro.Q.value = p.q

    this.lfo = s.ctx.createOscillator()
    this.lfo.frequency.value = p.lfoFreq
    this.lfoGain = s.ctx.createGain()
    this.lfoGain.gain.value = p.lfoDepth
    this.lfo.connect(this.lfoGain)
    this.lfoGain.connect(this.filtro.frequency)

    this.ganho = s.ctx.createGain()
    this.ganho.gain.value = 0
    this.src.connect(this.filtro)
    this.filtro.connect(this.ganho)
    this.ganho.connect(s.destino)
  }

  iniciar(): void {
    if (this.iniciado) return
    this.iniciado = true
    this.src.start()
    this.lfo.start()
  }

  definirVolume(v: number, suavidade = 0.6): void {
    this.ganho.gain.setTargetAtTime(Math.max(0, v), this.ctx.currentTime, suavidade)
  }

  get perfilNome(): string { return this.perfil }
}

/** Canto de pássaro: duas notas moduladas em frequência. */
export function passaro(s: SynthTarget): void {
  const { ctx, destino } = s
  const t = agora(ctx)
  const n = 2 + Math.floor(Math.random() * 3)
  for (let i = 0; i < n; i++) {
    const t0 = t + i * (0.09 + Math.random() * 0.07)
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    const f = 2200 + Math.random() * 1800
    o.frequency.setValueAtTime(f, t0)
    o.frequency.exponentialRampToValueAtTime(f * (0.6 + Math.random() * 0.9), t0 + 0.07)
    env(ctx, g, 0.05, 0.006, 0.07, t0)
    o.connect(g); g.connect(destino)
    o.start(t0); o.stop(t0 + 0.2)
  }
}

/** Gota de chuva em superfície próxima. */
export function gota(s: SynthTarget): void {
  const { ctx, destino, ruido } = s
  const t = agora(ctx)
  const src = ctx.createBufferSource()
  src.buffer = ruido.branco
  src.playbackRate.value = 1.4 + Math.random()
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 2600 + Math.random() * 2600
  bp.Q.value = 6
  const g = ctx.createGain()
  env(ctx, g, 0.035, 0.001, 0.05, t)
  src.connect(bp); bp.connect(g); g.connect(destino)
  src.start(t); src.stop(t + 0.15)
}
