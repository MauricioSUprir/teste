/**
 * Física da bola de futebol.
 *
 * Integração com arrasto do ar, efeito Magnus (a bola curva conforme o giro),
 * quique com restituição dependente da superfície, atrito de rolamento e
 * transição para rolagem quando a velocidade vertical é baixa. Colide com o
 * mundo, com traves e com os jogadores.
 */

import * as THREE from 'three'
import { clamp, damp } from '../core/math'
import type { CollisionWorld } from '../world/collision'

export const BALL_RADIUS = 0.111
const MASS = 0.43
const GRAVITY = -9.81
/** Coeficiente de arrasto combinado com área e densidade do ar. */
const DRAG = 0.0135
/** Coeficiente do efeito Magnus. */
const MAGNUS = 0.00042
const SPIN_DECAY = 0.72

export type SurfaceKind = 'grama' | 'cimento' | 'terra' | 'asfalto' | 'interno'

const RESTITUTION: Record<SurfaceKind, number> = {
  grama: 0.56, cimento: 0.74, terra: 0.42, asfalto: 0.70, interno: 0.66,
}
const ROLL_FRICTION: Record<SurfaceKind, number> = {
  grama: 0.62, cimento: 0.30, terra: 0.95, asfalto: 0.34, interno: 0.40,
}

export interface BallSurfaceQuery {
  surface(x: number, z: number, fromY: number): number
  normal(x: number, z: number, out: THREE.Vector3): THREE.Vector3
  kind(x: number, z: number): SurfaceKind
}

export interface BallImpact {
  tipo: 'chao' | 'parede' | 'trave' | 'jogador' | 'rede'
  forca: number
  x: number
  y: number
  z: number
}

const _n = new THREE.Vector3()
const _v = new THREE.Vector3()
const _cross = new THREE.Vector3()

export class Ball {
  readonly position = new THREE.Vector3()
  readonly velocity = new THREE.Vector3()
  /** Vetor de rotação (rad/s) — define a curva pelo efeito Magnus. */
  readonly spin = new THREE.Vector3()
  readonly mesh: THREE.Mesh
  /** True quando está rolando no chão. */
  rolando = false
  /** Jogador que tocou por último (id), para regras simples. */
  ultimoToque = -1
  /** Tempo desde o último toque, para evitar toques repetidos. */
  tempoDesdeToque = 999
  /** Impactos do último quadro, consumidos pelo áudio. */
  readonly impactos: BallImpact[] = []
  /** Escala visual de deformação no impacto. */
  private squash = 0

  constructor(material: THREE.Material) {
    const geo = new THREE.IcosahedronGeometry(BALL_RADIUS, 3)
    this.mesh = new THREE.Mesh(geo, material)
    this.mesh.castShadow = true
    this.mesh.receiveShadow = true
    this.mesh.name = 'bola'
  }

  reset(x: number, y: number, z: number): void {
    this.position.set(x, y, z)
    this.velocity.set(0, 0, 0)
    this.spin.set(0, 0, 0)
    this.rolando = false
    this.ultimoToque = -1
    this.tempoDesdeToque = 999
  }

  /** Aplica um impulso (chute, passe, cabeceio). */
  aplicarImpulso(dir: THREE.Vector3, forca: number, efeito: THREE.Vector3 | null, jogador: number): void {
    this.velocity.addScaledVector(dir, forca / MASS * 0.045)
    if (efeito) this.spin.add(efeito)
    this.rolando = false
    this.ultimoToque = jogador
    this.tempoDesdeToque = 0
    this.impactos.push({ tipo: 'jogador', forca, x: this.position.x, y: this.position.y, z: this.position.z })
  }

  /** Empurrão suave usado na condução de bola. */
  conduzir(dir: THREE.Vector3, velocidade: number, jogador: number): void {
    this.velocity.x = damp(this.velocity.x, dir.x * velocidade, 12, 1 / 60)
    this.velocity.z = damp(this.velocity.z, dir.z * velocidade, 12, 1 / 60)
    this.ultimoToque = jogador
    this.tempoDesdeToque = 0
  }

  update(dt: number, collision: CollisionWorld, surfaces: BallSurfaceQuery): void {
    this.impactos.length = 0
    this.tempoDesdeToque += dt

    const speed = this.velocity.length()

    // Arrasto do ar (quadrático) e efeito Magnus
    if (speed > 0.01) {
      const dragMag = DRAG * speed * speed / MASS
      _v.copy(this.velocity).normalize()
      this.velocity.addScaledVector(_v, -dragMag * dt)
      _cross.crossVectors(this.spin, this.velocity).multiplyScalar(MAGNUS / MASS)
      this.velocity.addScaledVector(_cross, dt)
    }
    this.velocity.y += GRAVITY * dt
    this.spin.multiplyScalar(Math.pow(SPIN_DECAY, dt))

    // Integração com subdivisão: evita atravessar paredes em chutes fortes.
    const steps = clamp(Math.ceil(speed * dt / (BALL_RADIUS * 0.8)), 1, 6)
    const h = dt / steps
    for (let i = 0; i < steps; i++) {
      this.integrate(h, collision, surfaces)
    }

    // Visual
    this.mesh.position.copy(this.position)
    if (speed > 0.05) {
      // Giro visual coerente com o deslocamento (rolagem sem escorregar).
      _cross.set(this.velocity.z, 0, -this.velocity.x)
      const len = _cross.length()
      if (len > 1e-4) {
        _cross.divideScalar(len)
        const ang = (speed * dt) / BALL_RADIUS
        this.mesh.rotateOnWorldAxis(_cross, ang)
      }
      if (this.spin.lengthSq() > 0.01) {
        _v.copy(this.spin).normalize()
        this.mesh.rotateOnWorldAxis(_v, this.spin.length() * dt * 0.25)
      }
    }
    this.squash = damp(this.squash, 0, 14, dt)
    const s = 1 - this.squash * 0.22
    this.mesh.scale.set(1 + this.squash * 0.1, s, 1 + this.squash * 0.1)
  }

  private integrate(dt: number, collision: CollisionWorld, surfaces: BallSurfaceQuery): void {
    const prevY = this.position.y
    this.position.addScaledVector(this.velocity, dt)

    // --- Chão ---------------------------------------------------------------
    const ground = surfaces.surface(this.position.x, this.position.z, this.position.y + 2)
    const floor = ground + BALL_RADIUS
    if (this.position.y <= floor) {
      const kind = surfaces.kind(this.position.x, this.position.z)
      surfaces.normal(this.position.x, this.position.z, _n)
      const impact = Math.abs(this.velocity.y)
      this.position.y = floor

      if (impact > 0.55) {
        const e = RESTITUTION[kind]
        // Reflete em torno da normal do terreno (quica torto em rampa).
        const dot = this.velocity.dot(_n)
        this.velocity.addScaledVector(_n, -(1 + e) * dot)
        // Atrito tangencial no quique: converte parte do giro em velocidade.
        this.velocity.x *= 0.86
        this.velocity.z *= 0.86
        this.velocity.x += this.spin.z * 0.012
        this.velocity.z -= this.spin.x * 0.012
        this.spin.multiplyScalar(0.72)
        this.squash = clamp(impact / 10, 0, 1)
        this.impactos.push({ tipo: 'chao', forca: impact, x: this.position.x, y: this.position.y, z: this.position.z })
        this.rolando = false
      } else {
        this.velocity.y = 0
        this.rolando = true
        // Atrito de rolamento
        const f = ROLL_FRICTION[kind]
        const vh = Math.hypot(this.velocity.x, this.velocity.z)
        if (vh > 0.01) {
          const dec = f * dt
          const nv = Math.max(0, vh - dec)
          this.velocity.x *= nv / vh
          this.velocity.z *= nv / vh
        } else {
          this.velocity.x = 0
          this.velocity.z = 0
        }
        // A bola desce a ladeira sozinha.
        this.velocity.x += _n.x * 9.5 * dt
        this.velocity.z += _n.z * 9.5 * dt
        // Giro acompanha a rolagem.
        this.spin.set(this.velocity.z / BALL_RADIUS, this.spin.y * 0.9, -this.velocity.x / BALL_RADIUS)
      }
    } else if (prevY <= floor + 0.001 && this.velocity.y > 0) {
      this.rolando = false
    }

    // --- Obstáculos ---------------------------------------------------------
    const near = collision.query(this.position.x, this.position.z, BALL_RADIUS + 0.6)
    for (const c of near) {
      if (!c.solid) continue
      if (this.position.y + BALL_RADIUS < c.y - c.hy) continue
      if (this.position.y - BALL_RADIUS > c.y + c.hy) continue

      const px = this.position.x - c.x
      const pz = this.position.z - c.z
      const lx = px * c.cos + pz * c.sin
      const lz = -px * c.sin + pz * c.cos
      const ly = this.position.y - c.y
      const cx = clamp(lx, -c.hx, c.hx)
      const cy = clamp(ly, -c.hy, c.hy)
      const cz = clamp(lz, -c.hz, c.hz)
      const dx = lx - cx
      const dy = ly - cy
      const dz = lz - cz
      const d2 = dx * dx + dy * dy + dz * dz
      if (d2 >= BALL_RADIUS * BALL_RADIUS) continue

      let nx: number, ny: number, nz: number
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2)
        nx = dx / d; ny = dy / d; nz = dz / d
        const push = BALL_RADIUS - d
        const wx = nx * c.cos - nz * c.sin
        const wz = nx * c.sin + nz * c.cos
        this.position.x += wx * push
        this.position.y += ny * push
        this.position.z += wz * push
        _n.set(wx, ny, wz)
      } else {
        continue
      }

      const dot = this.velocity.dot(_n)
      if (dot < 0) {
        const e = c.tag === 'trave' ? 0.62 : c.tag === 'cerca' ? 0.48 : 0.55
        const forca = Math.abs(dot)
        this.velocity.addScaledVector(_n, -(1 + e) * dot)
        this.velocity.multiplyScalar(0.94)
        this.spin.multiplyScalar(0.75)
        this.squash = clamp(forca / 12, 0, 1)
        this.impactos.push({
          tipo: c.tag === 'trave' ? 'trave' : 'parede',
          forca, x: this.position.x, y: this.position.y, z: this.position.z,
        })
      }
    }
  }

  /** Velocidade escalar em km/h (painel de chute). */
  get velocidadeKmh(): number { return this.velocity.length() * 3.6 }

  dispose(): void {
    this.mesh.geometry.dispose()
  }
}

/** Textura procedural de bola: gomos claros e escuros com costura. */
export function makeBallMaterial(): THREE.MeshStandardMaterial {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#f2f2ef'
  ctx.fillRect(0, 0, size, size)

  // Pentágonos escuros distribuídos como numa bola clássica.
  ctx.fillStyle = '#20242a'
  const pts: [number, number][] = [
    [0.18, 0.22], [0.62, 0.16], [0.86, 0.46], [0.40, 0.52],
    [0.12, 0.72], [0.58, 0.80], [0.90, 0.86],
  ]
  for (const [u, v] of pts) {
    ctx.beginPath()
    const cx = u * size
    const cy = v * size
    const r = size * 0.085
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2
      const x = cx + Math.cos(a) * r
      const y = cy + Math.sin(a) * r
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fill()
  }

  // Costura sutil
  ctx.strokeStyle = 'rgba(0,0,0,0.20)'
  ctx.lineWidth = 2
  for (const [u, v] of pts) {
    ctx.beginPath()
    ctx.arc(u * size, v * size, size * 0.115, 0, Math.PI * 2)
    ctx.stroke()
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return new THREE.MeshStandardMaterial({
    map: tex, roughness: 0.58, metalness: 0.02,
  })
}
