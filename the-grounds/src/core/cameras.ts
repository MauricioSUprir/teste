/**
 * Sistema de câmeras: terceira pessoa com braço elástico e desvio de paredes,
 * primeira pessoa, câmeras de direção, câmera de futebol e modo fotografia.
 *
 * Todas compartilham o mesmo estado de mira (yaw/pitch) para que a troca entre
 * modos seja contínua, sem "pulo" de enquadramento.
 */

import * as THREE from 'three'
import { clamp, damp, dampAngle, lerp, smoothstep } from './math'
import type { CollisionWorld } from '../world/collision'

export type CameraMode =
  | 'terceiraPessoa' | 'primeiraPessoa' | 'veiculo' | 'veiculoInterno'
  | 'futebol' | 'foto' | 'orbital' | 'cinematica'

export interface CameraTarget {
  /** Ponto que a câmera enquadra (normalmente a cabeça ou o centro do carro). */
  position: THREE.Vector3
  /** Orientação do alvo, usada por câmeras que seguem atrás. */
  yaw: number
  /** Velocidade do alvo, para efeitos de distância e campo de visão. */
  speed: number
  /** Meia-altura do alvo, para posicionar o foco. */
  height: number
}

export interface CameraSettings {
  sensitivity: number
  invertY: boolean
  fovBase: number
  /** Reduz balanço e tremor (acessibilidade). */
  reduceMotion: boolean
  smoothing: number
}

interface ModeConfig {
  /** Distância do braço, em metros. */
  distance: number
  /** Deslocamento lateral (ombro). */
  shoulder: number
  /** Altura do ponto focal acima da base do alvo. */
  focusHeight: number
  pitchMin: number
  pitchMax: number
  fovBoost: number
  /** Quanto a câmera se alinha sozinha atrás do alvo (0 = nunca). */
  autoAlign: number
}

const MODES: Record<CameraMode, ModeConfig> = {
  terceiraPessoa: { distance: 4.1, shoulder: 0.55, focusHeight: 1.48, pitchMin: -1.15, pitchMax: 0.95, fovBoost: 0, autoAlign: 0 },
  primeiraPessoa: { distance: 0, shoulder: 0, focusHeight: 1.62, pitchMin: -1.35, pitchMax: 1.25, fovBoost: 6, autoAlign: 0 },
  veiculo: { distance: 7.2, shoulder: 0, focusHeight: 1.55, pitchMin: -0.75, pitchMax: 0.75, fovBoost: 4, autoAlign: 1.6 },
  veiculoInterno: { distance: 0, shoulder: 0, focusHeight: 1.12, pitchMin: -0.85, pitchMax: 0.75, fovBoost: 2, autoAlign: 0 },
  futebol: { distance: 6.4, shoulder: 0, focusHeight: 1.35, pitchMin: -0.85, pitchMax: 0.45, fovBoost: 8, autoAlign: 0.9 },
  foto: { distance: 3.0, shoulder: 0, focusHeight: 1.5, pitchMin: -1.5, pitchMax: 1.5, fovBoost: 0, autoAlign: 0 },
  orbital: { distance: 3.4, shoulder: 0, focusHeight: 1.0, pitchMin: -0.6, pitchMax: 0.9, fovBoost: 0, autoAlign: 0 },
  cinematica: { distance: 8, shoulder: 0, focusHeight: 1.5, pitchMin: -1.2, pitchMax: 1.2, fovBoost: 0, autoAlign: 0 },
}

const _focus = new THREE.Vector3()
const _desired = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _smoothFocus = new THREE.Vector3()

export class CameraRig {
  mode: CameraMode = 'terceiraPessoa'
  /** Rotação horizontal da câmera. */
  yaw = 0
  /** Inclinação vertical. */
  pitch = -0.12
  /** Distância atual do braço (suavizada e reduzida por colisão). */
  private armLength = 4.1
  private armTarget = 4.1
  private currentFov = 60
  private bobTime = 0
  private shake = 0
  private shakeDecay = 4
  private initialized = false
  /** Deslocamento livre no modo fotografia. */
  readonly freeOffset = new THREE.Vector3()
  freeYaw = 0
  freePitch = 0
  /** Zoom adicional aplicado pelo jogador (roda do mouse). */
  zoom = 0

  settings: CameraSettings = {
    sensitivity: 1, invertY: false, fovBase: 60, reduceMotion: false, smoothing: 1,
  }

  constructor(private readonly camera: THREE.PerspectiveCamera) {
    this.currentFov = this.settings.fovBase
  }

  setMode(mode: CameraMode): void {
    if (this.mode === mode) return
    this.mode = mode
    const cfg = MODES[mode]
    this.armTarget = cfg.distance
    this.zoom = 0
  }

  /** Aplica movimento de mira (mouse/analógico). */
  look(dx: number, dy: number): void {
    const cfg = MODES[this.mode]
    this.yaw -= dx
    this.pitch = clamp(this.pitch - dy, cfg.pitchMin, cfg.pitchMax)
  }

  /** Zoom relativo (roda do mouse). */
  applyZoom(delta: number): void {
    this.zoom = clamp(this.zoom + delta * 0.45, -2.2, 3.5)
  }

  /** Solicita tremor de câmera (colisão, impacto, corrida). */
  addShake(amount: number, decay = 4): void {
    if (this.settings.reduceMotion) return
    this.shake = Math.min(1.2, this.shake + amount)
    this.shakeDecay = decay
  }

  /**
   * Atualiza a câmera. `collision` é opcional: quando presente, o braço encolhe
   * para não atravessar paredes.
   */
  update(dt: number, target: CameraTarget, collision?: CollisionWorld): void {
    const cfg = MODES[this.mode]
    const s = this.settings

    // Alinhamento automático atrás do alvo (carro, futebol).
    if (cfg.autoAlign > 0 && target.speed > 1.2) {
      const strength = cfg.autoAlign * smoothstep(1.2, 9, target.speed)
      this.yaw = dampAngle(this.yaw, target.yaw, strength, dt)
    }

    // Ponto focal, com suavização para não tremer com o passo.
    _focus.copy(target.position)
    _focus.y += cfg.focusHeight * (target.height / 1.78)
    if (!this.initialized) { _smoothFocus.copy(_focus); this.initialized = true }
    const focusLambda = this.mode === 'primeiraPessoa' ? 40 : lerp(9, 16, clamp(target.speed / 10, 0, 1)) * s.smoothing
    _smoothFocus.x = damp(_smoothFocus.x, _focus.x, focusLambda, dt)
    _smoothFocus.y = damp(_smoothFocus.y, _focus.y, focusLambda * 0.7, dt)
    _smoothFocus.z = damp(_smoothFocus.z, _focus.z, focusLambda, dt)

    // Direção da câmera
    const cp = Math.cos(this.pitch)
    _dir.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp).normalize()

    if (cfg.distance === 0) {
      // Primeira pessoa / cabine
      this.camera.position.copy(_smoothFocus)
      if (!s.reduceMotion && this.mode === 'primeiraPessoa') {
        this.bobTime += dt * clamp(target.speed, 0, 9)
        const amp = clamp(target.speed / 9, 0, 1) * 0.035
        this.camera.position.y += Math.sin(this.bobTime * 2.1) * amp
        this.camera.position.x += Math.cos(this.bobTime * 1.05) * amp * 0.55
      }
      this.camera.lookAt(
        this.camera.position.x + _dir.x,
        this.camera.position.y + _dir.y,
        this.camera.position.z + _dir.z,
      )
    } else {
      // Terceira pessoa: braço elástico com desvio de obstáculos
      const wanted = clamp(cfg.distance + this.zoom + target.speed * 0.045, 1.1, 14)
      this.armTarget = wanted
      let allowed = this.armTarget

      if (collision) {
        const ox = _smoothFocus.x
        const oy = _smoothFocus.y
        const oz = _smoothFocus.z
        const hit = collision.raycast(ox, oy, oz, -_dir.x, -_dir.y, -_dir.z, this.armTarget + 0.45)
        if (hit) allowed = Math.max(0.85, hit.dist - 0.35)
        // Amostras laterais evitam que a câmera raspe quinas.
        for (const side of [-1, 1]) {
          const sx = Math.cos(this.yaw) * side * 0.35
          const sz = -Math.sin(this.yaw) * side * 0.35
          const h2 = collision.raycast(ox + sx, oy, oz + sz, -_dir.x, -_dir.y, -_dir.z, allowed + 0.35)
          if (h2) allowed = Math.max(0.85, Math.min(allowed, h2.dist - 0.3))
        }
      }

      // Aproxima rápido (evita atravessar), afasta devagar (evita solavanco).
      const lambda = allowed < this.armLength ? 30 : 6 * s.smoothing
      this.armLength = damp(this.armLength, allowed, lambda, dt)

      _desired.copy(_smoothFocus).addScaledVector(_dir, -this.armLength)

      // Rede de segurança: se ainda assim a câmera terminar dentro de um
      // colisor (paredes finas, quinas), encurta até sair.
      if (collision) {
        for (let tentativa = 0; tentativa < 6; tentativa++) {
          const dentro = collision.query(_desired.x, _desired.z, 0.36).some((c) => {
            if (!c.solid) return false
            if (_desired.y < c.y - c.hy - 0.1 || _desired.y > c.y + c.hy + 0.1) return false
            const px = _desired.x - c.x
            const pz = _desired.z - c.z
            const lx = px * c.cos + pz * c.sin
            const lz = -px * c.sin + pz * c.cos
            return Math.abs(lx) < c.hx + 0.22 && Math.abs(lz) < c.hz + 0.22
          })
          if (!dentro) break
          this.armLength = Math.max(0.55, this.armLength - 0.32)
          _desired.copy(_smoothFocus).addScaledVector(_dir, -this.armLength)
        }
      }
      // Deslocamento de ombro some quando a câmera está muito perto.
      const shoulder = cfg.shoulder * clamp((this.armLength - 1.2) / 1.6, 0, 1)
      _desired.x += Math.cos(this.yaw) * shoulder
      _desired.z += -Math.sin(this.yaw) * shoulder

      this.camera.position.copy(_desired)
      this.camera.lookAt(
        _smoothFocus.x + Math.cos(this.yaw) * shoulder * 0.55,
        _smoothFocus.y,
        _smoothFocus.z - Math.sin(this.yaw) * shoulder * 0.55,
      )
    }

    // Tremor
    if (this.shake > 0.001) {
      const a = this.shake * 0.045
      this.camera.position.x += (Math.random() - 0.5) * a
      this.camera.position.y += (Math.random() - 0.5) * a
      this.camera.position.z += (Math.random() - 0.5) * a
      this.shake = Math.max(0, this.shake - this.shakeDecay * dt)
    }

    // Campo de visão cresce com a velocidade (sensação de aceleração).
    const speedFov = s.reduceMotion ? 0 : clamp(target.speed / 24, 0, 1) * 12
    const targetFov = s.fovBase + MODES[this.mode].fovBoost + speedFov
    this.currentFov = damp(this.currentFov, targetFov, 5, dt)
    if (Math.abs(this.camera.fov - this.currentFov) > 0.02) {
      this.camera.fov = this.currentFov
      this.camera.updateProjectionMatrix()
    }
  }

  /** Move livremente a câmera no modo fotografia. */
  updateFreeCam(dt: number, forward: number, right: number, up: number, fast: boolean): void {
    const speed = (fast ? 14 : 4.5) * dt
    const cp = Math.cos(this.pitch)
    const fx = Math.sin(this.yaw) * cp
    const fy = Math.sin(this.pitch)
    const fz = Math.cos(this.yaw) * cp
    const rx = Math.cos(this.yaw)
    const rz = -Math.sin(this.yaw)
    this.camera.position.x += (fx * forward + rx * right) * speed
    this.camera.position.y += (fy * forward + up) * speed
    this.camera.position.z += (fz * forward + rz * right) * speed
    this.camera.lookAt(
      this.camera.position.x + fx,
      this.camera.position.y + fy,
      this.camera.position.z + fz,
    )
  }

  /** Reposiciona instantaneamente (troca de cena, carregamento). */
  snapTo(target: CameraTarget): void {
    this.initialized = false
    this.armLength = MODES[this.mode].distance
    this.update(0.016, target)
  }

  get forward(): THREE.Vector3 {
    const cp = Math.cos(this.pitch)
    return new THREE.Vector3(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp)
  }
}
