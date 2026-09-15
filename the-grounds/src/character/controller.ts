/**
 * Controle do personagem: cápsula com aceleração, atrito, degraus, rampas,
 * salto, transposição de obstáculos baixos e giro com inércia.
 *
 * A movimentação é resolvida contra o `CollisionWorld` do mundo, e a altura
 * de apoio vem do terreno ou de qualquer superfície pisável (calçada, ponte,
 * laje, arquibancada).
 */

import * as THREE from 'three'
import { clamp, damp, dampAngle, angleDelta, moveTowards } from '../core/math'
import type { CollisionWorld, Collider } from '../world/collision'

export interface MoveIntent {
  /** Eixo lateral (-1 esquerda, 1 direita) já normalizado. */
  x: number
  /** Eixo frente/trás (-1 trás, 1 frente). */
  y: number
  /** Direção da câmera, usada como referência do movimento. */
  cameraYaw: number
  sprint: boolean
  crouch: boolean
  jumpPressed: boolean
  /** True quando o personagem deve olhar para onde a câmera aponta. */
  mirar: boolean
}

export interface SurfaceQuery {
  /** Altura do terreno puro. */
  ground(x: number, z: number): number
  /** Altura pisável considerando calçadas, pontes e lajes. */
  surface(x: number, z: number, fromY: number): number
  /** Normal do terreno. */
  normal(x: number, z: number, out: THREE.Vector3): THREE.Vector3
}

export type LocomotionState = 'parado' | 'andando' | 'correndo' | 'sprint' | 'ar' | 'agachado' | 'transpondo'

export interface ControllerConfig {
  walkSpeed: number
  runSpeed: number
  sprintSpeed: number
  crouchSpeed: number
  accelGround: number
  accelAir: number
  decel: number
  jumpSpeed: number
  gravity: number
  /** Altura máxima de degrau que sobe sem saltar. */
  stepHeight: number
  /** Inclinação máxima caminhável, em graus. */
  maxSlope: number
  turnRate: number
  radius: number
  height: number
  crouchHeight: number
  /** Altura máxima de obstáculo transponível correndo. */
  vaultHeight: number
}

export function defaultConfig(radius = 0.30, height = 1.78): ControllerConfig {
  return {
    walkSpeed: 1.75,
    runSpeed: 4.25,
    sprintSpeed: 7.1,
    crouchSpeed: 1.15,
    accelGround: 26,
    accelAir: 5.5,
    decel: 30,
    jumpSpeed: 4.85,
    gravity: -19.5,
    stepHeight: 0.46,
    maxSlope: 48,
    turnRate: 12,
    radius,
    height,
    crouchHeight: height * 0.62,
    vaultHeight: 1.25,
  }
}

const _tmpA = new THREE.Vector3()
const _normal = new THREE.Vector3()

export class CharacterController {
  readonly position = new THREE.Vector3()
  readonly velocity = new THREE.Vector3()
  /** Direção para onde o corpo aponta (radianos). */
  yaw = 0
  /** Direção desejada pelo movimento, antes da suavização. */
  targetYaw = 0
  grounded = true
  state: LocomotionState = 'parado'
  config: ControllerConfig
  /** Velocidade horizontal atual. */
  speed = 0
  /** Taxa de giro suavizada, usada pela animação (inclinação nas curvas). */
  turnRate = 0
  /** Progresso da transposição de obstáculo, 0 quando inativa. */
  vaultProgress = 0
  private vaultFrom = new THREE.Vector3()
  private vaultTo = new THREE.Vector3()
  private vaultDuration = 0.55
  private coyote = 0
  private jumpBuffer = 0
  private crouching = false
  private lastGroundY = 0
  /** Altura de queda acumulada, para efeitos de aterrissagem. */
  fallDistance = 0
  landedThisFrame = false
  jumpedThisFrame = false
  /** Colisores a ignorar (ex.: o próprio veículo ao sair). */
  ignore: ((c: Collider) => boolean) | null = null

  constructor(config: ControllerConfig = defaultConfig()) {
    this.config = config
  }

  get height(): number {
    return this.crouching ? this.config.crouchHeight : this.config.height
  }

  teleport(x: number, y: number, z: number, yaw = this.yaw): void {
    this.position.set(x, y, z)
    this.velocity.set(0, 0, 0)
    this.yaw = yaw
    this.targetYaw = yaw
    this.grounded = true
    this.vaultProgress = 0
    this.fallDistance = 0
  }

  update(dt: number, intent: MoveIntent, collision: CollisionWorld, surfaces: SurfaceQuery): void {
    this.landedThisFrame = false
    this.jumpedThisFrame = false
    const c = this.config

    if (this.vaultProgress > 0) {
      this.updateVault(dt)
      return
    }

    // --- Direção desejada em espaço de mundo -------------------------------
    const cos = Math.cos(intent.cameraYaw)
    const sin = Math.sin(intent.cameraYaw)
    // Frente da câmera no plano XZ
    const fx = sin
    const fz = cos
    const rx = cos
    const rz = -sin
    let dx = fx * intent.y + rx * intent.x
    let dz = fz * intent.y + rz * intent.x
    const len = Math.hypot(dx, dz)
    if (len > 1e-4) { dx /= len; dz /= len }

    // --- Agachar ----------------------------------------------------------
    const wantCrouch = intent.crouch && this.grounded
    if (this.crouching && !wantCrouch) {
      // Só levanta se houver espaço acima.
      const ceiling = collision.ceilingHeight(this.position.x, this.position.z, this.position.y + c.crouchHeight, c.radius)
      if (ceiling === null || ceiling > this.position.y + c.height + 0.05) this.crouching = false
    } else {
      this.crouching = wantCrouch
    }

    // --- Velocidade alvo --------------------------------------------------
    const moving = len > 1e-4
    let target = 0
    if (moving) {
      if (this.crouching) target = c.crouchSpeed
      else if (intent.sprint) target = c.sprintSpeed
      else target = intent.x !== 0 || intent.y !== 0 ? c.runSpeed : c.walkSpeed
      // Andar devagar quando o analógico está parcialmente inclinado
      target *= clamp(len, 0, 1)
      // Recuar é mais lento
      const backwards = dx * Math.sin(this.yaw) + dz * Math.cos(this.yaw)
      if (backwards < -0.2) target *= 0.62
    }

    // --- Aceleração horizontal --------------------------------------------
    const accel = this.grounded ? c.accelGround : c.accelAir
    const vx = this.velocity.x
    const vz = this.velocity.z
    const desiredVx = dx * target
    const desiredVz = dz * target
    const rate = moving ? accel : (this.grounded ? c.decel : c.accelAir * 0.5)
    this.velocity.x = moveTowards(vx, desiredVx, rate * dt)
    this.velocity.z = moveTowards(vz, desiredVz, rate * dt)
    this.speed = Math.hypot(this.velocity.x, this.velocity.z)

    // --- Orientação do corpo ----------------------------------------------
    const prevYaw = this.yaw
    if (intent.mirar) {
      this.targetYaw = intent.cameraYaw
    } else if (moving && this.speed > 0.25) {
      this.targetYaw = Math.atan2(this.velocity.x, this.velocity.z)
    }
    // Gira mais devagar em alta velocidade: dá peso ao corpo.
    const agility = clamp(1 - this.speed / (c.sprintSpeed * 1.6), 0.35, 1)
    this.yaw = dampAngle(this.yaw, this.targetYaw, c.turnRate * agility, dt)
    this.turnRate = damp(this.turnRate, angleDelta(prevYaw, this.yaw) / Math.max(dt, 1e-4), 10, dt)

    // --- Salto -------------------------------------------------------------
    this.coyote = this.grounded ? 0.12 : Math.max(0, this.coyote - dt)
    this.jumpBuffer = intent.jumpPressed ? 0.15 : Math.max(0, this.jumpBuffer - dt)
    if (this.jumpBuffer > 0 && this.coyote > 0 && !this.crouching) {
      if (this.tryVault(collision, surfaces, dx, dz)) {
        this.jumpBuffer = 0
        return
      }
      this.velocity.y = c.jumpSpeed
      this.grounded = false
      this.coyote = 0
      this.jumpBuffer = 0
      this.jumpedThisFrame = true
    }

    // --- Gravidade ---------------------------------------------------------
    if (!this.grounded) {
      this.velocity.y += c.gravity * dt
      this.velocity.y = Math.max(this.velocity.y, -55)
    }

    // --- Integração e colisão ---------------------------------------------
    this.position.x += this.velocity.x * dt
    this.position.z += this.velocity.z * dt

    const feetY = this.position.y
    const headY = this.position.y + this.height
    const before = { x: this.position.x, z: this.position.z }
    const res = collision.resolveCircle(
      this.position, c.radius, feetY + 0.22, headY - 0.12, this.ignore ?? undefined,
    )

    if (res.hits > 0) {
      // Tenta subir o degrau antes de aceitar o bloqueio.
      const blockedX = this.position.x - before.x
      const blockedZ = this.position.z - before.z
      const pushed = Math.hypot(blockedX, blockedZ)
      if (pushed > 0.001 && this.grounded) {
        const aheadX = before.x + dx * (c.radius + 0.12)
        const aheadZ = before.z + dz * (c.radius + 0.12)
        const stepTop = collision.supportHeight(aheadX, aheadZ, this.position.y + c.stepHeight, c.radius * 0.7)
        const groundAhead = Math.max(surfaces.ground(aheadX, aheadZ), stepTop ?? -Infinity)
        const rise = groundAhead - this.position.y
        if (rise > 0.02 && rise <= c.stepHeight) {
          const headroom = collision.ceilingHeight(aheadX, aheadZ, groundAhead + 0.1, c.radius * 0.7)
          if (headroom === null || headroom > groundAhead + this.height * 0.9) {
            this.position.x = before.x
            this.position.z = before.z
            this.position.y = groundAhead + 0.001
            this.position.x += dx * Math.min(pushed + 0.02, 0.12)
            this.position.z += dz * Math.min(pushed + 0.02, 0.12)
          }
        }
      }
      // Remove a componente da velocidade contra a parede.
      const nx = res.dx
      const nz = res.dz
      const nl = Math.hypot(nx, nz)
      if (nl > 1e-5) {
        const ux = nx / nl
        const uz = nz / nl
        const into = this.velocity.x * ux + this.velocity.z * uz
        if (into < 0) {
          this.velocity.x -= ux * into
          this.velocity.z -= uz * into
        }
      }
    }

    // --- Apoio vertical ----------------------------------------------------
    this.position.y += this.velocity.y * dt
    const support = surfaces.surface(this.position.x, this.position.z, this.position.y + 0.6)

    if (this.position.y <= support + 0.02) {
      if (!this.grounded && this.velocity.y < -0.5) {
        this.landedThisFrame = true
        this.fallDistance = Math.max(0, this.lastGroundY - support)
      }
      this.position.y = support
      if (this.velocity.y < 0) this.velocity.y = 0
      this.grounded = true
      this.lastGroundY = support
    } else if (this.position.y - support < 0.24 && this.velocity.y <= 0.01) {
      // Cola no chão ao descer rampas, evitando "voar" em declives.
      this.position.y = support
      this.velocity.y = 0
      this.grounded = true
      this.lastGroundY = support
    } else {
      this.grounded = false
      if (this.velocity.y > 0) this.lastGroundY = this.position.y
    }

    // Teto: bate a cabeça
    if (!this.grounded && this.velocity.y > 0) {
      const ceiling = collision.ceilingHeight(this.position.x, this.position.z, this.position.y + this.height * 0.5, c.radius * 0.8)
      if (ceiling !== null && ceiling < this.position.y + this.height) {
        this.position.y = ceiling - this.height - 0.01
        this.velocity.y = Math.min(0, this.velocity.y)
      }
    }

    // --- Rampas íngremes ---------------------------------------------------
    if (this.grounded) {
      surfaces.normal(this.position.x, this.position.z, _normal)
      const slope = Math.acos(clamp(_normal.y, -1, 1)) * (180 / Math.PI)
      if (slope > c.maxSlope) {
        // Escorrega ladeira abaixo.
        const slide = 6.5 * (slope - c.maxSlope) / 40
        this.velocity.x += _normal.x * slide * dt * 9
        this.velocity.z += _normal.z * slide * dt * 9
      }
    }

    // --- Estado ------------------------------------------------------------
    this.speed = Math.hypot(this.velocity.x, this.velocity.z)
    if (!this.grounded) this.state = 'ar'
    else if (this.crouching) this.state = 'agachado'
    else if (this.speed < 0.15) this.state = 'parado'
    else if (this.speed < c.walkSpeed * 1.35) this.state = 'andando'
    else if (this.speed < c.runSpeed * 1.25) this.state = 'correndo'
    else this.state = 'sprint'
  }

  /** Detecta um obstáculo baixo à frente e inicia a transposição. */
  private tryVault(collision: CollisionWorld, surfaces: SurfaceQuery, dx: number, dz: number): boolean {
    const c = this.config
    if (this.speed < c.walkSpeed * 0.9) return false
    if (Math.hypot(dx, dz) < 0.5) return false

    const probeX = this.position.x + dx * (c.radius + 0.35)
    const probeZ = this.position.z + dz * (c.radius + 0.35)
    const top = collision.supportHeight(probeX, probeZ, this.position.y + c.vaultHeight, c.radius * 0.6)
    if (top === null) return false
    const rise = top - this.position.y
    if (rise < c.stepHeight || rise > c.vaultHeight) return false

    // Precisa haver espaço livre do outro lado.
    const landX = this.position.x + dx * (c.radius + 1.15)
    const landZ = this.position.z + dz * (c.radius + 1.15)
    const landY = surfaces.surface(landX, landZ, top + 0.5)
    if (landY > top + 0.15) return false
    const blocked = collision.query(landX, landZ, c.radius * 0.8)
      .some((col) => col.solid && col.y + col.hy > landY + 0.5 && col.y - col.hy < landY + 1.4)
    if (blocked) return false

    this.vaultFrom.copy(this.position)
    this.vaultTo.set(landX, landY, landZ)
    this.vaultDuration = 0.42 + rise * 0.18
    this.vaultProgress = 0.0001
    this.state = 'transpondo'
    this.velocity.set(0, 0, 0)
    return true
  }

  private updateVault(dt: number): void {
    this.vaultProgress += dt / this.vaultDuration
    const t = clamp(this.vaultProgress, 0, 1)
    // Arco: sobe na primeira metade, desce na segunda.
    const arc = Math.sin(t * Math.PI) * 0.35
    _tmpA.lerpVectors(this.vaultFrom, this.vaultTo, t)
    this.position.set(_tmpA.x, _tmpA.y + arc, _tmpA.z)
    this.yaw = this.targetYaw
    if (t >= 1) {
      this.vaultProgress = 0
      this.position.copy(this.vaultTo)
      this.grounded = true
      this.state = 'parado'
    }
  }

  /** Velocidade relativa à frente do corpo (-1 ré, 1 frente). */
  get forwardness(): number {
    if (this.speed < 0.05) return 1
    const fx = Math.sin(this.yaw)
    const fz = Math.cos(this.yaw)
    return clamp((this.velocity.x * fx + this.velocity.z * fz) / Math.max(this.speed, 0.01), -1, 1)
  }

  /** Componente lateral do movimento (-1 esquerda, 1 direita). */
  get strafe(): number {
    if (this.speed < 0.05) return 0
    const rx = Math.cos(this.yaw)
    const rz = -Math.sin(this.yaw)
    return clamp((this.velocity.x * rx + this.velocity.z * rz) / Math.max(this.speed, 0.01), -1, 1)
  }

  get isCrouching(): boolean { return this.crouching }
}
