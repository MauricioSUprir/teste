/**
 * Gerente de áudio: barramentos de volume, escuta posicional, camadas de
 * ambiente por região, passos sincronizados com a passada, motores dos
 * veículos e sons pontuais do futebol e da interface.
 */

import * as THREE from 'three'
import { clamp, damp } from '../core/math'
import type { AudioSettings } from '../core/settings'
import {
  AmbienteSynth, MotorSynth, NoiseBank, apito, buzina, clique, gota, passaro,
  passo, porta, toqueBola, type SurfaceSound, type SynthTarget,
} from './synth'

export type Barramento = 'sfx' | 'musica' | 'ambiente' | 'voz'

export class AudioManager {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private buses = new Map<Barramento, GainNode>()
  private ruido: NoiseBank | null = null
  private ambientes = new Map<string, AmbienteSynth>()
  private motores = new Map<number, MotorSynth>()
  private listener = new THREE.Vector3()
  private forward = new THREE.Vector3(0, 0, 1)
  settings: AudioSettings
  iniciado = false
  /** Fator aplicado dentro de interiores (abafa o exterior). */
  private interior = 0
  private passoTimer = 0
  private birdTimer = 3
  private dropTimer = 0

  constructor(settings: AudioSettings) {
    this.settings = settings
  }

  /**
   * O navegador só permite áudio depois de um gesto do usuário; esta função
   * deve ser chamada a partir de um clique ou tecla.
   */
  iniciar(): void {
    if (this.iniciado) return
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    try {
      this.ctx = new Ctor()
    } catch {
      return
    }
    this.master = this.ctx.createGain()
    this.master.gain.value = this.settings.master
    // Compressor evita estouro quando muitos sons coincidem.
    const comp = this.ctx.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.knee.value = 24
    comp.ratio.value = 8
    comp.attack.value = 0.004
    comp.release.value = 0.22
    this.master.connect(comp)
    comp.connect(this.ctx.destination)

    for (const b of ['sfx', 'musica', 'ambiente', 'voz'] as Barramento[]) {
      const g = this.ctx.createGain()
      g.gain.value = this.volumeDe(b)
      g.connect(this.master)
      this.buses.set(b, g)
    }
    this.ruido = new NoiseBank(this.ctx)
    this.iniciado = true

    for (const nome of ['vento', 'trafego', 'murmurio', 'chuva', 'rio'] as const) {
      const a = new AmbienteSynth(this.alvo('ambiente'), nome)
      a.iniciar()
      this.ambientes.set(nome, a)
    }
  }

  retomar(): void {
    void this.ctx?.resume()
  }

  private volumeDe(b: Barramento): number {
    switch (b) {
      case 'sfx': return this.settings.sfx
      case 'musica': return this.settings.music
      case 'ambiente': return this.settings.ambience
      case 'voz': return this.settings.voice
    }
  }

  aplicarSettings(s: AudioSettings): void {
    this.settings = s
    if (!this.ctx || !this.master) return
    this.master.gain.setTargetAtTime(s.master, this.ctx.currentTime, 0.05)
    for (const [b, g] of this.buses) {
      g.gain.setTargetAtTime(this.volumeDe(b), this.ctx.currentTime, 0.05)
    }
  }

  private alvo(bus: Barramento): SynthTarget {
    return { ctx: this.ctx!, destino: this.buses.get(bus)!, ruido: this.ruido! }
  }

  /** Cria um alvo espacializado numa posição do mundo. */
  private alvoEspacial(bus: Barramento, x: number, y: number, z: number, alcance = 45): SynthTarget | null {
    if (!this.ctx || !this.ruido) return null
    const dist = Math.hypot(x - this.listener.x, y - this.listener.y, z - this.listener.z)
    if (dist > alcance) return null
    const panner = this.ctx.createPanner()
    panner.panningModel = 'HRTF'
    panner.distanceModel = 'inverse'
    panner.refDistance = 2.2
    panner.maxDistance = alcance
    panner.rolloffFactor = 1.35
    panner.positionX.value = x
    panner.positionY.value = y
    panner.positionZ.value = z
    panner.connect(this.buses.get(bus)!)
    return { ctx: this.ctx, destino: panner, ruido: this.ruido }
  }

  /** Atualiza a posição e a orientação de quem escuta. */
  atualizarEscuta(pos: THREE.Vector3, forward: THREE.Vector3, up: THREE.Vector3): void {
    if (!this.ctx) return
    this.listener.copy(pos)
    this.forward.copy(forward)
    const l = this.ctx.listener
    const t = this.ctx.currentTime
    if (l.positionX) {
      l.positionX.setTargetAtTime(pos.x, t, 0.02)
      l.positionY.setTargetAtTime(pos.y, t, 0.02)
      l.positionZ.setTargetAtTime(pos.z, t, 0.02)
      l.forwardX.setTargetAtTime(forward.x, t, 0.02)
      l.forwardY.setTargetAtTime(forward.y, t, 0.02)
      l.forwardZ.setTargetAtTime(forward.z, t, 0.02)
      l.upX.setTargetAtTime(up.x, t, 0.02)
      l.upY.setTargetAtTime(up.y, t, 0.02)
      l.upZ.setTargetAtTime(up.z, t, 0.02)
    } else {
      // Navegadores antigos
      const legacy = l as unknown as {
        setPosition(x: number, y: number, z: number): void
        setOrientation(fx: number, fy: number, fz: number, ux: number, uy: number, uz: number): void
      }
      legacy.setPosition?.(pos.x, pos.y, pos.z)
      legacy.setOrientation?.(forward.x, forward.y, forward.z, up.x, up.y, up.z)
    }
  }

  /**
   * Mistura as camadas de ambiente conforme o contexto.
   * Todos os valores vão de 0 a 1.
   */
  definirAmbiente(opts: {
    vento: number
    trafego: number
    murmurio: number
    chuva: number
    rio: number
    interior: number
  }): void {
    if (!this.iniciado) return
    this.interior = damp(this.interior, opts.interior, 3, 1 / 60)
    const fora = 1 - this.interior * 0.78
    this.ambientes.get('vento')?.definirVolume(opts.vento * 0.32 * fora)
    this.ambientes.get('trafego')?.definirVolume(opts.trafego * 0.42 * fora)
    this.ambientes.get('murmurio')?.definirVolume(opts.murmurio * 0.30 * fora)
    this.ambientes.get('chuva')?.definirVolume(opts.chuva * 0.55 * fora)
    this.ambientes.get('rio')?.definirVolume(opts.rio * 0.40 * fora)
  }

  /** Chamado a cada quadro: dispara sons ambientes aleatórios. */
  atualizar(dt: number, opts: { chuva: number; vegetacao: number; dia: number }): void {
    if (!this.iniciado) return
    this.birdTimer -= dt
    if (this.birdTimer <= 0) {
      this.birdTimer = 2.5 + Math.random() * 9
      if (opts.vegetacao > 0.25 && opts.dia > 0.35 && opts.chuva < 0.3 && Math.random() < opts.vegetacao) {
        const a = Math.random() * Math.PI * 2
        const d = 6 + Math.random() * 18
        const t = this.alvoEspacial('ambiente',
          this.listener.x + Math.cos(a) * d, this.listener.y + 4 + Math.random() * 5, this.listener.z + Math.sin(a) * d, 40)
        if (t) passaro(t)
      }
    }
    if (opts.chuva > 0.15) {
      this.dropTimer -= dt
      if (this.dropTimer <= 0) {
        this.dropTimer = 0.03 + Math.random() * 0.12 / Math.max(opts.chuva, 0.1)
        const t = this.alvoEspacial('ambiente',
          this.listener.x + (Math.random() - 0.5) * 6, this.listener.y - 1, this.listener.z + (Math.random() - 0.5) * 6, 12)
        if (t) gota(t)
      }
    }
  }

  /** Passos: chamado quando a fase da passada cruza o contato. */
  passo(superficie: SurfaceSound, x: number, y: number, z: number, forca = 1, correndo = false): void {
    if (!this.iniciado) return
    const t = this.alvoEspacial('sfx', x, y, z, 26)
    if (t) passo(t, superficie, forca, correndo)
  }

  /** Gerencia o ritmo dos passos a partir da velocidade. */
  atualizarPassos(
    dt: number, velocidade: number, noChao: boolean, superficie: SurfaceSound,
    x: number, y: number, z: number,
  ): void {
    if (!this.iniciado || !noChao || velocidade < 0.4) { this.passoTimer = 0; return }
    const passosPorSegundo = clamp(0.55 + velocidade * 0.36, 0.6, 3.4)
    this.passoTimer -= dt * passosPorSegundo
    if (this.passoTimer <= 0) {
      this.passoTimer += 1
      this.passo(superficie, x, y, z, clamp(velocidade / 6, 0.4, 1.2), velocidade > 4.6)
    }
  }

  bola(tipo: 'chute' | 'quique' | 'trave' | 'rede', forca: number, x: number, y: number, z: number): void {
    if (!this.iniciado) return
    const t = this.alvoEspacial('sfx', x, y, z, 60)
    if (t) toqueBola(t, forca, tipo)
  }

  porta(abrindo: boolean, x: number, y: number, z: number): void {
    if (!this.iniciado) return
    const t = this.alvoEspacial('sfx', x, y, z, 22)
    if (t) porta(t, abrindo)
  }

  buzina(x: number, y: number, z: number): void {
    if (!this.iniciado) return
    const t = this.alvoEspacial('sfx', x, y, z, 90)
    if (t) buzina(t)
  }

  apito(): void {
    if (!this.iniciado) return
    apito(this.alvo('sfx'))
  }

  interface(tipo: 'mover' | 'confirmar' | 'voltar' | 'erro'): void {
    if (!this.iniciado) return
    clique(this.alvo('sfx'), tipo)
  }

  /** Motor de um veículo; `id` identifica a instância. */
  motor(id: number, rpmNorm: number, carga: number, distancia: number, dentro: boolean): void {
    if (!this.iniciado) return
    let m = this.motores.get(id)
    if (!m) {
      m = new MotorSynth(this.alvo('sfx'), 4)
      m.iniciar()
      this.motores.set(id, m)
    }
    const vol = dentro ? 0.24 : clamp(0.30 * (1 - distancia / 60), 0, 0.30)
    m.atualizar(rpmNorm, carga, vol)
  }

  pararMotor(id: number): void {
    const m = this.motores.get(id)
    if (m) { m.parar(); this.motores.delete(id) }
  }

  dispose(): void {
    for (const m of this.motores.values()) m.parar()
    this.motores.clear()
    void this.ctx?.close()
    this.ctx = null
    this.iniciado = false
  }
}

/** Traduz o material do piso para o timbre do passo. */
export function superficieSonora(
  emEstrada: boolean, emCalcada: boolean, molhado: boolean, interior: boolean,
): SurfaceSound {
  if (interior) return 'interno'
  if (molhado) return 'agua'
  if (emEstrada) return 'asfalto'
  if (emCalcada) return 'calcada'
  return 'grama'
}
