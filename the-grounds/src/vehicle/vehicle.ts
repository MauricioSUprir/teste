/**
 * Física e comportamento dos veículos.
 *
 * Modelo de direção com sensação arcade porém coerente: tração e frenagem no
 * eixo longitudinal, aderência lateral com limite de derrapagem, transferência
 * de peso, suspensão por mola em cada roda apoiada na superfície e colisão
 * contra o mundo usando o mesmo hash espacial do resto do jogo.
 */

import * as THREE from 'three'
import { clamp, damp, dampAngle, lerp, moveTowards } from '../core/math'
import type { Collider, CollisionWorld } from '../world/collision'
import { buildVehicleMeshes, makeVehicleSpec, type VehicleClass, type VehicleSpec } from './model'

export interface VehicleMaterials {
  pintura: THREE.Material
  vidro: THREE.Material
  cromo: THREE.Material
  escuro: THREE.Material
  luz: THREE.MeshStandardMaterial
  lanterna: THREE.MeshStandardMaterial
  roda: THREE.Material
}

export interface VehicleInput {
  /** -1 (ré/freio) a 1 (acelerar). */
  acelerador: number
  freio: number
  /** -1 (esquerda) a 1 (direita). */
  direcao: number
  freioMao: boolean
  buzina: boolean
  farois: boolean
}

export function emptyVehicleInput(): VehicleInput {
  return { acelerador: 0, freio: 0, direcao: 0, freioMao: false, buzina: false, farois: false }
}

export interface VehicleSurfaceQuery {
  surface(x: number, z: number, fromY: number): number
  normal(x: number, z: number, out: THREE.Vector3): THREE.Vector3
}

const _v = new THREE.Vector3()
const _n = new THREE.Vector3()

export class Vehicle {
  readonly spec: VehicleSpec
  readonly group = new THREE.Group()
  readonly position = new THREE.Vector3()
  readonly velocity = new THREE.Vector3()
  yaw = 0
  pitch = 0
  roll = 0
  /** Velocidade no eixo longitudinal (m/s, negativa em marcha à ré). */
  forwardSpeed = 0
  /** Velocidade angular de guinada. */
  yawRate = 0
  /** Ângulo das rodas dianteiras. */
  steer = 0
  /** Quanto o carro está derrapando (0..1), usado por som e partículas. */
  slip = 0
  grounded = true
  farolLigado = false
  freando = false
  /** Rotação acumulada das rodas. */
  private wheelSpin = 0
  private wheels: THREE.Object3D[] = []
  private farolMesh: THREE.Mesh | null = null
  private lanternaMesh: THREE.Mesh | null = null
  private headlights: THREE.SpotLight[] = []
  private collider: Collider | null = null
  private suspensionOffset = 0
  /** Motorista atual (null quando vazio). */
  ocupado = false
  /** Dano acumulado, afeta som e desempenho. */
  dano = 0

  constructor(
    classe: VehicleClass,
    seed: number,
    materials: VehicleMaterials,
    opts: { comLuzes?: boolean } = {},
  ) {
    this.spec = makeVehicleSpec(classe, seed)
    const m = buildVehicleMeshes(this.spec)

    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, name: string): THREE.Mesh | null => {
      if (!geo.attributes.position || geo.attributes.position.count === 0) return null
      const mesh = new THREE.Mesh(geo, mat)
      mesh.name = name
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.group.add(mesh)
      return mesh
    }
    add(m.corpo, materials.pintura, 'corpo')
    add(m.vidros, materials.vidro, 'vidros')
    add(m.cromados, materials.cromo, 'cromados')
    add(m.escuros, materials.escuro, 'escuros')
    this.farolMesh = add(m.farois, materials.luz.clone(), 'farois')
    this.lanternaMesh = add(m.lanternas, materials.lanterna.clone(), 'lanternas')

    for (const p of m.posicoesRodas) {
      const pivot = new THREE.Object3D()
      pivot.position.set(p.x, p.y, p.z)
      pivot.userData.dianteira = p.dianteira
      const mesh = new THREE.Mesh(m.roda.clone(), materials.roda)
      mesh.castShadow = true
      pivot.add(mesh)
      this.group.add(pivot)
      this.wheels.push(pivot)
    }

    if (opts.comLuzes) {
      for (const side of [-1, 1]) {
        const l = new THREE.SpotLight(0xfff0d8, 0, 42, Math.PI * 0.18, 0.55, 1.4)
        l.position.set(side * this.spec.largura * 0.34, 0.78, this.spec.comprimento / 2 - 0.1)
        l.target.position.set(side * this.spec.largura * 0.4, -0.4, this.spec.comprimento / 2 + 14)
        this.group.add(l)
        this.group.add(l.target)
        this.headlights.push(l)
      }
    }
  }

  /** Registra o volume de colisão no mundo. */
  attachCollider(collision: CollisionWorld, owner: string): void {
    this.collider = collision.add(
      { x: this.position.x, y: this.position.y + this.spec.altura / 2, z: this.position.z },
      { x: this.spec.largura / 2, y: this.spec.altura / 2, z: this.spec.comprimento / 2 },
      this.yaw, 'veiculo', owner, { walkable: false },
    )
  }

  get colisor(): Collider | null { return this.collider }

  place(x: number, z: number, yaw: number, surfaces: VehicleSurfaceQuery): void {
    this.position.set(x, surfaces.surface(x, z, 1e4), z)
    this.yaw = yaw
    this.velocity.set(0, 0, 0)
    this.forwardSpeed = 0
    this.yawRate = 0
    this.syncTransform()
  }

  /** Velocidade em km/h para o painel. */
  get velocidadeKmh(): number { return Math.abs(this.forwardSpeed) * 3.6 }

  update(
    dt: number, input: VehicleInput, collision: CollisionWorld, surfaces: VehicleSurfaceQuery,
  ): void {
    const s = this.spec
    const massFactor = 1400 / s.massa

    // --- Direção ------------------------------------------------------------
    // O ângulo máximo cai com a velocidade: evita giros impossíveis a 120 km/h.
    const speedAbs = Math.abs(this.forwardSpeed)
    const maxSteer = lerp(0.62, 0.16, clamp(speedAbs / 32, 0, 1))
    const steerRate = lerp(5.2, 2.4, clamp(speedAbs / 28, 0, 1))
    this.steer = moveTowards(this.steer, input.direcao * maxSteer, steerRate * dt)
    if (Math.abs(input.direcao) < 0.05) {
      this.steer = damp(this.steer, 0, 6, dt)
    }

    // --- Motor e freio ------------------------------------------------------
    const potencia = 12.5 * s.potencia * massFactor * (1 - this.dano * 0.35)
    const arrasto = 0.42 + speedAbs * 0.016
    let accel = 0

    if (input.acelerador > 0.02) {
      // Curva de torque: cai em alta velocidade.
      const fade = clamp(1 - speedAbs / (s.classe === 'esportivo' ? 78 : 56), 0, 1)
      accel += input.acelerador * potencia * (0.35 + fade * 0.65)
    }
    if (input.freio > 0.02) {
      if (this.forwardSpeed > 0.4) accel -= input.freio * 17 * massFactor
      else accel -= input.freio * 7.5 * massFactor  // ré
    }
    accel -= this.forwardSpeed * arrasto * 0.12
    if (Math.abs(input.acelerador) < 0.02 && Math.abs(input.freio) < 0.02) {
      accel -= Math.sign(this.forwardSpeed) * 2.4
    }
    if (input.freioMao) {
      accel -= Math.sign(this.forwardSpeed) * 11
    }

    this.forwardSpeed += accel * dt
    if (Math.abs(this.forwardSpeed) < 0.06 && Math.abs(input.acelerador) < 0.02) this.forwardSpeed = 0
    this.forwardSpeed = clamp(this.forwardSpeed, -11, s.classe === 'esportivo' ? 82 : 60)
    this.freando = input.freio > 0.05 || input.freioMao

    // --- Guinada ------------------------------------------------------------
    // Modelo de bicicleta: o raio de curva vem do ângulo e da distância entre eixos.
    const desiredYawRate = (this.forwardSpeed / Math.max(s.entreEixos, 0.6)) * Math.tan(this.steer)
    const grip = s.aderencia * (input.freioMao ? 0.42 : 1) * (this.grounded ? 1 : 0.15)
    // O excesso de guinada pedida em relação à aderência vira derrapagem.
    const limite = grip * 1.45
    const clamped = clamp(desiredYawRate, -limite, limite)
    this.slip = damp(this.slip, clamp(Math.abs(desiredYawRate - clamped) * 1.6, 0, 1), 6, dt)
    this.yawRate = damp(this.yawRate, clamped, 7.5, dt)
    this.yaw += this.yawRate * dt

    // --- Velocidade em espaço de mundo -------------------------------------
    const fx = Math.sin(this.yaw)
    const fz = Math.cos(this.yaw)
    const rx = Math.cos(this.yaw)
    const rz = -Math.sin(this.yaw)

    // Componente lateral residual (derrapagem) decai conforme a aderência.
    const lateral = this.velocity.x * rx + this.velocity.z * rz
    const lateralKeep = Math.exp(-dt * lerp(13, 2.4, this.slip) * grip)
    const newLateral = lateral * lateralKeep

    this.velocity.x = fx * this.forwardSpeed + rx * newLateral
    this.velocity.z = fz * this.forwardSpeed + rz * newLateral

    // --- Integração e colisão ----------------------------------------------
    const prevX = this.position.x
    const prevZ = this.position.z
    this.position.x += this.velocity.x * dt
    this.position.z += this.velocity.z * dt

    const res = collision.resolveCircle(
      this.position, Math.max(s.largura, s.comprimento) * 0.36,
      this.position.y + 0.2, this.position.y + s.altura - 0.1,
      (col) => col === this.collider,
    )
    if (res.hits > 0) {
      const impact = Math.hypot(this.position.x - prevX - this.velocity.x * dt, this.position.z - prevZ - this.velocity.z * dt)
      const nl = Math.hypot(res.dx, res.dz)
      if (nl > 1e-5) {
        const ux = res.dx / nl
        const uz = res.dz / nl
        const into = this.velocity.x * ux + this.velocity.z * uz
        if (into < 0) {
          // Perde parte da energia e desvia ao longo da parede.
          this.velocity.x -= ux * into * 1.35
          this.velocity.z -= uz * into * 1.35
          const perdido = Math.abs(into)
          this.forwardSpeed *= clamp(1 - perdido * 0.12, 0.2, 1)
          this.dano = clamp(this.dano + perdido * 0.004, 0, 1)
        }
      }
      void impact
    }

    // --- Suspensão e apoio --------------------------------------------------
    const ground = surfaces.surface(this.position.x, this.position.z, this.position.y + 1.2)
    const targetY = ground
    if (this.position.y < targetY + 0.02) {
      this.position.y = targetY
      this.velocity.y = 0
      this.grounded = true
    } else if (this.position.y - targetY < 0.35) {
      this.position.y = damp(this.position.y, targetY, 18, dt)
      this.grounded = true
    } else {
      this.velocity.y -= 19.5 * dt
      this.position.y += this.velocity.y * dt
      if (this.position.y <= targetY) { this.position.y = targetY; this.velocity.y = 0; this.grounded = true }
      else this.grounded = false
    }

    // Inclinação: acompanha a normal do terreno e a transferência de peso.
    surfaces.normal(this.position.x, this.position.z, _n)
    const terrainPitch = Math.atan2(-(_n.z * fz + _n.x * fx), Math.max(_n.y, 0.2))
    const terrainRoll = Math.atan2(_n.x * rx + _n.z * rz, Math.max(_n.y, 0.2))
    const squat = clamp(-accel * 0.0045, -0.10, 0.10)
    const bodyRoll = clamp(-this.yawRate * this.forwardSpeed * 0.0055, -0.14, 0.14)
    this.pitch = damp(this.pitch, terrainPitch + squat, 8, dt)
    this.roll = damp(this.roll, terrainRoll + bodyRoll, 8, dt)
    this.suspensionOffset = damp(this.suspensionOffset, clamp(accel * 0.0016, -0.035, 0.035), 9, dt)

    // --- Rodas --------------------------------------------------------------
    this.wheelSpin += (this.forwardSpeed / Math.max(s.raioRoda, 0.05)) * dt
    for (const w of this.wheels) {
      w.rotation.set(0, 0, 0)
      if (w.userData.dianteira) w.rotation.y = this.steer
      w.rotation.x = -this.wheelSpin
    }

    // --- Luzes --------------------------------------------------------------
    this.farolLigado = input.farois
    const farolMat = this.farolMesh?.material as THREE.MeshStandardMaterial | undefined
    if (farolMat) farolMat.emissiveIntensity = input.farois ? 3.2 : 0.05
    const lantMat = this.lanternaMesh?.material as THREE.MeshStandardMaterial | undefined
    if (lantMat) lantMat.emissiveIntensity = this.freando ? 4.5 : (input.farois ? 1.1 : 0.05)
    for (const l of this.headlights) l.intensity = input.farois ? 38 : 0

    this.syncTransform()
    if (this.collider) {
      collision.moveCollider(
        this.collider,
        this.position.x, this.position.y + s.altura / 2, this.position.z, this.yaw,
      )
    }
  }

  /** Movimento simplificado para veículos distantes (tráfego). */
  updateSimple(dt: number, targetSpeed: number, targetYaw: number, surfaces: VehicleSurfaceQuery): void {
    this.forwardSpeed = damp(this.forwardSpeed, targetSpeed, 2.2, dt)
    this.yaw = dampAngle(this.yaw, targetYaw, 3.4, dt)
    const fx = Math.sin(this.yaw)
    const fz = Math.cos(this.yaw)
    this.velocity.set(fx * this.forwardSpeed, 0, fz * this.forwardSpeed)
    this.position.x += this.velocity.x * dt
    this.position.z += this.velocity.z * dt
    this.position.y = surfaces.surface(this.position.x, this.position.z, this.position.y + 1.2)
    this.wheelSpin += (this.forwardSpeed / Math.max(this.spec.raioRoda, 0.05)) * dt
    for (const w of this.wheels) {
      w.rotation.set(0, 0, 0)
      w.rotation.x = -this.wheelSpin
    }
    this.syncTransform()
  }

  private syncTransform(): void {
    this.group.position.set(this.position.x, this.position.y + this.suspensionOffset, this.position.z)
    this.group.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ')
  }

  /** Ponto de mundo de um assento. */
  assentoMundo(index: number, out = new THREE.Vector3()): THREE.Vector3 {
    const a = this.spec.assentos[Math.min(index, this.spec.assentos.length - 1)]
    _v.set(a.x, a.y, a.z)
    _v.applyEuler(new THREE.Euler(this.pitch, this.yaw, this.roll, 'YXZ'))
    return out.copy(this.position).add(_v)
  }

  /** Ponto de desembarque livre ao lado do veículo. */
  pontoDesembarque(
    collision: CollisionWorld, surfaces: VehicleSurfaceQuery, out = new THREE.Vector3(),
  ): THREE.Vector3 {
    const s = this.spec
    const candidates: [number, number][] = [
      [-(s.largura / 2 + 0.75), 0.2], [s.largura / 2 + 0.75, 0.2],
      [-(s.largura / 2 + 0.75), -1.2], [s.largura / 2 + 0.75, -1.2],
      [0, -(s.comprimento / 2 + 0.9)], [0, s.comprimento / 2 + 0.9],
    ]
    for (const [lx, lz] of candidates) {
      const wx = this.position.x + lx * Math.cos(this.yaw) + lz * Math.sin(this.yaw)
      const wz = this.position.z - lx * Math.sin(this.yaw) + lz * Math.cos(this.yaw)
      const y = surfaces.surface(wx, wz, this.position.y + 1.5)
      const blocked = collision.query(wx, wz, 0.42).some(
        (c) => c.solid && c !== this.collider && c.y + c.hy > y + 0.35 && c.y - c.hy < y + 1.5,
      )
      if (!blocked) return out.set(wx, y, wz)
    }
    return out.set(this.position.x, this.position.y + 0.2, this.position.z)
  }

  dispose(scene: THREE.Object3D, collision?: CollisionWorld, owner?: string): void {
    scene.remove(this.group)
    this.group.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.geometry) m.geometry.dispose()
    })
    if (collision && owner) collision.removeOwner(owner)
  }
}

/** Cria os materiais compartilhados dos veículos. */
export function makeVehicleMaterials(): VehicleMaterials {
  return {
    pintura: new THREE.MeshPhysicalMaterial({
      vertexColors: true, roughness: 0.26, metalness: 0.42,
      clearcoat: 0.92, clearcoatRoughness: 0.09, envMapIntensity: 1.5,
    }),
    vidro: new THREE.MeshPhysicalMaterial({
      vertexColors: true, roughness: 0.05, metalness: 0.1,
      transparent: true, opacity: 0.70, clearcoat: 1, clearcoatRoughness: 0.03,
      envMapIntensity: 2.0, side: THREE.DoubleSide,
    }),
    cromo: new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.12, metalness: 1, envMapIntensity: 1.8,
    }),
    escuro: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.2 }),
    luz: new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.14, metalness: 0,
      emissive: 0xfff2dc, emissiveIntensity: 0.05,
    }),
    lanterna: new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.2, metalness: 0,
      emissive: 0xff2a1e, emissiveIntensity: 0.05,
    }),
    roda: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.25 }),
  }
}
