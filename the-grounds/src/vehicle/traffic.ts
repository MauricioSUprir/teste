/**
 * Tráfego urbano: rotas pela malha viária, faixas, cruzamentos com semáforo,
 * distância de segurança e reaproveitamento de veículos fora de vista.
 *
 * Os carros próximos rodam a física completa; os distantes usam integração
 * simplificada, o que mantém a cidade viva sem custo proporcional ao tamanho.
 */

import * as THREE from 'three'
import { clamp, hash2, makeRng, pick, randInt, type Rng } from '../core/math'
import { CityLayout, type RoadLine } from '../world/layout'
import type { CollisionWorld } from '../world/collision'
import { Vehicle, emptyVehicleInput, type VehicleMaterials, type VehicleSurfaceQuery } from './vehicle'
import type { VehicleClass } from './model'

/** Um nó da rota: ponto na pista com direção. */
interface RouteNode {
  x: number
  z: number
  /** Direção de avanço em radianos. */
  yaw: number
  /** Linha viária a que pertence. */
  line: RoadLine
  /** Coordenada ao longo da linha. */
  t: number
  /** Sentido: +1 avança no eixo livre, -1 recua. */
  dir: 1 | -1
}

const LANE_OFFSET = 2.35

interface TrafficCar {
  vehicle: Vehicle
  owner: string
  node: RouteNode
  /** Velocidade desejada em m/s. */
  cruise: number
  /** Distância percorrida no trecho atual. */
  progress: number
  /** Espera em semáforo. */
  waiting: number
  detalhado: boolean
}

const CLASSES: VehicleClass[] = ['hatch', 'hatch', 'sedan', 'sedan', 'suv', 'picape', 'van', 'taxi', 'esportivo']

export class Traffic {
  private cars: TrafficCar[] = []
  private nextId = 1
  private rng: Rng
  /** Raio em que o tráfego existe. */
  radius = 190
  /** Raio em que a física completa roda. */
  detailRadius = 70
  private spawnTimer = 0

  constructor(
    private readonly layout: CityLayout,
    private readonly scene: THREE.Object3D,
    private readonly collision: CollisionWorld,
    private readonly materials: VehicleMaterials,
    private readonly surfaces: VehicleSurfaceQuery,
    seed = 4242,
  ) {
    this.rng = makeRng(seed)
  }

  get count(): number { return this.cars.length }
  get veiculos(): readonly TrafficCar[] { return this.cars }

  /** Encontra um ponto de partida válido em uma pista perto do jogador. */
  private findSpawn(center: THREE.Vector3, minDist: number, maxDist: number): RouteNode | null {
    for (let tries = 0; tries < 40; tries++) {
      const ang = this.rng() * Math.PI * 2
      const dist = minDist + this.rng() * (maxDist - minDist)
      const px = center.x + Math.cos(ang) * dist
      const pz = center.z + Math.sin(ang) * dist
      const near = this.layout.nearestRoad(px, pz)
      if (!near) continue
      const line = near.line
      const dir: 1 | -1 = this.rng() < 0.5 ? 1 : -1
      const node = this.nodeOn(line, near.t, dir)
      if (!node) continue
      // Evita nascer em cima de outro carro.
      if (this.cars.some((c) => Math.hypot(c.vehicle.position.x - node.x, c.vehicle.position.z - node.z) < 9)) continue
      return node
    }
    return null
  }

  /** Constrói um nó de rota sobre uma linha, na faixa correta do sentido. */
  private nodeOn(line: RoadLine, t: number, dir: 1 | -1): RouteNode | null {
    if (!CityLayout.hasSpanAt(line, t)) return null
    const off = LANE_OFFSET * dir * (line.avenue ? 1.7 : 1)
    if (line.axis === 'x') {
      // Linha vertical: anda em Z, faixa deslocada em X.
      return { x: line.pos - off, z: t, yaw: dir > 0 ? 0 : Math.PI, line, t, dir }
    }
    return { x: t, z: line.pos + off, yaw: dir > 0 ? Math.PI / 2 : -Math.PI / 2, line, t, dir }
  }

  /** Avança o nó ao longo da linha; nos cruzamentos decide se vira. */
  private advance(node: RouteNode, distance: number): RouteNode | null {
    const nextT = node.t + distance * node.dir
    if (!CityLayout.hasSpanAt(node.line, nextT)) {
      return this.turnAt(node, nextT)
    }
    // Chance de virar em um cruzamento próximo.
    const cross = this.crossingNear(node, nextT)
    if (cross && hash2(Math.round(nextT), node.line.index, 77) < 0.28) {
      const turned = this.turnInto(node, cross, nextT)
      if (turned) return turned
    }
    return this.nodeOn(node.line, nextT, node.dir)
  }

  /** Linha perpendicular que cruza próximo à posição. */
  private crossingNear(node: RouteNode, t: number): RoadLine | null {
    const perp = node.line.axis === 'x' ? this.layout.zLines : this.layout.xLines
    for (const l of perp) {
      if (Math.abs(l.pos - t) > 2.2) continue
      if (!CityLayout.hasSpanAt(l, node.line.pos)) continue
      return l
    }
    return null
  }

  private turnInto(node: RouteNode, cross: RoadLine, t: number): RouteNode | null {
    const dir: 1 | -1 = this.rng() < 0.5 ? 1 : -1
    void t
    return this.nodeOn(cross, node.line.pos, dir)
  }

  /** No fim de um trecho, tenta entrar em qualquer via disponível. */
  private turnAt(node: RouteNode, t: number): RouteNode | null {
    const cross = this.crossingNear(node, t)
    if (cross) {
      for (const dir of [1, -1] as const) {
        const n = this.nodeOn(cross, node.line.pos, dir)
        if (n) return n
      }
    }
    // Retorna no mesmo eixo, sentido contrário.
    return this.nodeOn(node.line, node.t, node.dir === 1 ? -1 : 1)
  }

  /** Semáforo à frente exige parada? */
  private mustStop(node: RouteNode, trafficPhase: 0 | 1, amber: boolean): boolean {
    const lookahead = 9
    const t = node.t + lookahead * node.dir
    const cross = this.crossingNear(node, t)
    if (!cross) return false
    if (!cross.avenue && !node.line.avenue) return false
    // Fase 0 libera as linhas verticais (eixo X), fase 1 as horizontais.
    const minhaFase: 0 | 1 = node.line.axis === 'x' ? 0 : 1
    if (minhaFase === trafficPhase) return amber && Math.abs(t - cross.pos) > 4
    return true
  }

  update(dt: number, center: THREE.Vector3, densidade: number, trafficPhase: 0 | 1, amber: boolean): void {
    const alvo = Math.round(clamp(densidade, 0, 1) * 26)

    // Remove os que ficaram longe demais.
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i]
      const d = Math.hypot(c.vehicle.position.x - center.x, c.vehicle.position.z - center.z)
      if (d > this.radius * 1.35) {
        this.guardar(c.vehicle, c.owner)
        this.cars.splice(i, 1)
      }
    }

    // Repõe gradualmente.
    this.spawnTimer -= dt
    if (this.cars.length < alvo && this.spawnTimer <= 0 && this.permitirNovos) {
      this.spawnTimer = 0.25
      const node = this.findSpawn(center, this.detailRadius * 0.9, this.radius)
      if (node) this.spawn(node)
    }

    for (const car of this.cars) {
      const v = car.vehicle
      const dist = Math.hypot(v.position.x - center.x, v.position.z - center.z)
      car.detalhado = dist < this.detailRadius

      // Distância de segurança ao carro da frente.
      let alvoVel = car.cruise
      const ahead = this.carAhead(car)
      if (ahead) {
        const gap = Math.hypot(ahead.vehicle.position.x - v.position.x, ahead.vehicle.position.z - v.position.z)
        const seguro = 6 + Math.abs(v.forwardSpeed) * 0.75
        if (gap < seguro) alvoVel = Math.min(alvoVel, Math.max(0, ahead.vehicle.forwardSpeed * (gap / seguro)))
      }
      if (this.mustStop(car.node, trafficPhase, amber)) {
        car.waiting += dt
        alvoVel = 0
      } else {
        car.waiting = 0
      }
      // Trava anti-bloqueio: depois de muito tempo parado, força a travessia.
      if (car.waiting > 22) alvoVel = car.cruise * 0.5

      const passo = Math.max(0, v.forwardSpeed) * dt
      car.progress += passo
      if (car.progress > 2.2) {
        car.progress = 0
        const next = this.advance(car.node, 2.2)
        if (next) car.node = next
      }

      // Alvo de direção: mira um ponto adiante na faixa.
      const lead = this.advance(car.node, 6 + Math.abs(v.forwardSpeed) * 0.5)
      const targetYaw = lead
        ? Math.atan2(lead.x - v.position.x, lead.z - v.position.z)
        : car.node.yaw

      if (car.detalhado) {
        const input = emptyVehicleInput()
        const erro = ((targetYaw - v.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI
        input.direcao = clamp(erro * 1.9, -1, 1)
        const dv = alvoVel - v.forwardSpeed
        input.acelerador = clamp(dv * 0.42, 0, 1)
        input.freio = clamp(-dv * 0.30, 0, 1)
        input.farois = false
        v.update(dt, input, this.collision, this.surfaces)
      } else {
        v.updateSimple(dt, alvoVel, targetYaw, this.surfaces)
      }
    }
  }

  /** Carro mais próximo à frente, na mesma direção. */
  private carAhead(car: TrafficCar): TrafficCar | null {
    const v = car.vehicle
    const fx = Math.sin(v.yaw)
    const fz = Math.cos(v.yaw)
    let best: TrafficCar | null = null
    let bestDist = 26
    for (const other of this.cars) {
      if (other === car) continue
      const dx = other.vehicle.position.x - v.position.x
      const dz = other.vehicle.position.z - v.position.z
      const along = dx * fx + dz * fz
      if (along <= 0.5 || along > bestDist) continue
      const lateral = Math.abs(dx * fz - dz * fx)
      if (lateral > 2.4) continue
      best = other
      bestDist = along
    }
    return best
  }

  /**
   * Quando false, nenhum carro novo é montado neste quadro. Montar um veículo
   * gera geometria; num quadro já apertado isso vira tranco na imagem.
   */
  permitirNovos = true

  /** Carros prontos guardados para reaproveitar em vez de reconstruir. */
  private reserva: Vehicle[] = []
  private readonly reservaMax = 10

  /** Tira o carro de cena, guardando-o se ainda houver espaço na reserva. */
  private guardar(v: Vehicle, owner: string): void {
    if (this.reserva.length < this.reservaMax) {
      this.scene.remove(v.group)
      this.collision.removeOwner(owner)
      this.reserva.push(v)
    } else {
      v.dispose(this.scene, this.collision, owner)
    }
  }

  private spawn(node: RouteNode): void {
    const classe = pick(this.rng, CLASSES)
    const seed = randInt(this.rng, 1, 1e9)
    const owner = `traf-${this.nextId++}`
    const v = this.reserva.pop() ?? new Vehicle(classe, seed, this.materials, { comLuzes: false })
    v.place(node.x, node.z, node.yaw, this.surfaces)
    v.attachCollider(this.collision, owner)
    this.scene.add(v.group)
    const limite = node.line.avenue ? 14.5 : 9.5
    this.cars.push({
      vehicle: v, owner, node,
      cruise: limite * (0.82 + this.rng() * 0.3),
      progress: 0, waiting: 0, detalhado: false,
    })
  }

  /** Veículo estacionado mais próximo que o jogador possa usar. */
  veiculoProximo(x: number, z: number, raio: number): Vehicle | null {
    let best: Vehicle | null = null
    let bestD = raio
    for (const c of this.cars) {
      const d = Math.hypot(c.vehicle.position.x - x, c.vehicle.position.z - z)
      if (d < bestD) { bestD = d; best = c.vehicle }
    }
    return best
  }

  /** Remove um veículo do tráfego (quando o jogador assume o volante). */
  liberar(v: Vehicle): void {
    const i = this.cars.findIndex((c) => c.vehicle === v)
    if (i >= 0) this.cars.splice(i, 1)
  }

  dispose(): void {
    for (const c of this.cars) c.vehicle.dispose(this.scene, this.collision, c.owner)
    for (const v of this.reserva) v.dispose(this.scene)
    this.reserva = []
    this.cars = []
  }
}
