/**
 * Habitantes da cidade: navegação por calçadas, travessias nas faixas, espera
 * no sinal, conversas em grupo, permanência em bancos e praças, entrada em
 * estabelecimentos e reação à aproximação do jogador.
 *
 * Nada depende de serviço externo: as decisões são locais e determinísticas
 * a partir da semente de cada pessoa.
 */

import * as THREE from 'three'
import { clamp, damp, dampAngle, makeRng, pick, randRange, type Rng } from '../core/math'
import { Character } from '../character/character'
import { randomAppearance } from '../character/appearance'
import type { ActionKind } from '../character/animation'
import { CityLayout, SIDEWALK, type RoadLine } from '../world/layout'
import type { CollisionWorld } from '../world/collision'
import type { World } from '../world/world'

export type PedestrianState =
  | 'andando' | 'esperandoSinal' | 'atravessando' | 'parado'
  | 'conversando' | 'sentado' | 'entrando' | 'observando' | 'correndo'

interface WalkNode {
  x: number
  z: number
  line: RoadLine
  t: number
  dir: 1 | -1
  /** Lado da via (-1 ou 1). */
  side: 1 | -1
}

export interface Pedestrian {
  id: number
  character: Character
  position: THREE.Vector3
  yaw: number
  speed: number
  targetSpeed: number
  state: PedestrianState
  stateTimer: number
  node: WalkNode
  rng: Rng
  /** Detalhe atual da simulação. */
  lod: 'alto' | 'medio' | 'baixo'
  /** Ação pontual em curso. */
  action: ActionKind | null
  actionTime: number
  /** Companheiros de conversa. */
  grupo: number[]
  /** Nome fictício, exibido na interação. */
  nome: string
  /** Assunto curto para o diálogo. */
  assunto: number
  /** Já foi cumprimentado pelo jogador. */
  cumprimentado: boolean
}

const NOMES = [
  'Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabi', 'Heitor',
  'Ivone', 'Jonas', 'Kelly', 'Lucas', 'Marina', 'Nando', 'Olívia', 'Paulo',
  'Quéren', 'Rafa', 'Sônia', 'Tiago', 'Ubirajara', 'Vera', 'Wesley', 'Ximena',
  'Yara', 'Zeca', 'Bia', 'Caio', 'Dora', 'Edu', 'Fernanda', 'Gil',
]

const WALK_SPEED = 1.32
const RUN_SPEED = 3.6

export class Crowd {
  private people: Pedestrian[] = []
  private nextId = 1
  private rng: Rng
  private spawnTimer = 0
  private group = new THREE.Group()
  radius = 95
  detailRadius = 34
  /** Quantas pessoas no máximo, antes da densidade. */
  maxPeople = 44

  constructor(
    private readonly world: World,
    private readonly layout: CityLayout,
    private readonly collision: CollisionWorld,
    seed = 9182,
  ) {
    this.rng = makeRng(seed)
    this.group.name = 'pessoas'
    world.root.add(this.group)
  }

  get count(): number { return this.people.length }
  get todos(): readonly Pedestrian[] { return this.people }

  /** Pessoa mais próxima dentro de um raio, para interação. */
  maisProxima(x: number, z: number, raio: number): Pedestrian | null {
    let best: Pedestrian | null = null
    let bestD = raio
    for (const p of this.people) {
      const d = Math.hypot(p.position.x - x, p.position.z - z)
      if (d < bestD) { bestD = d; best = p }
    }
    return best
  }

  private nodeOn(line: RoadLine, t: number, dir: 1 | -1, side: 1 | -1): WalkNode | null {
    if (!CityLayout.hasSpanAt(line, t)) return null
    const off = (CityLayout.halfWidth(line) + SIDEWALK * 0.5) * side
    if (line.axis === 'x') return { x: line.pos + off, z: t, line, t, dir, side }
    return { x: t, z: line.pos + off, line, t, dir, side }
  }

  private findSpawn(center: THREE.Vector3, min: number, max: number): WalkNode | null {
    for (let i = 0; i < 40; i++) {
      const a = this.rng() * Math.PI * 2
      const d = min + this.rng() * (max - min)
      const px = center.x + Math.cos(a) * d
      const pz = center.z + Math.sin(a) * d
      const near = this.layout.nearestRoad(px, pz)
      if (!near) continue
      const node = this.nodeOn(near.line, near.t, this.rng() < 0.5 ? 1 : -1, this.rng() < 0.5 ? 1 : -1)
      if (!node) continue
      if (this.people.some((p) => Math.hypot(p.position.x - node.x, p.position.z - node.z) < 2.2)) continue
      return node
    }
    return null
  }

  private advance(node: WalkNode, distance: number): WalkNode | null {
    const nextT = node.t + distance * node.dir
    const n = this.nodeOn(node.line, nextT, node.dir, node.side)
    if (n) return n
    // Fim do trecho: vira em uma perpendicular ou dá meia-volta.
    const perp = node.line.axis === 'x' ? this.layout.zLines : this.layout.xLines
    for (const l of perp) {
      if (Math.abs(l.pos - nextT) > 12) continue
      const turned = this.nodeOn(l, node.line.pos, this.rng() < 0.5 ? 1 : -1, this.rng() < 0.5 ? 1 : -1)
      if (turned) return turned
    }
    return this.nodeOn(node.line, node.t, node.dir === 1 ? -1 : 1, node.side)
  }

  /** Cruzamento perpendicular próximo ao ponto. */
  private crossingNear(node: WalkNode, t: number): RoadLine | null {
    const perp = node.line.axis === 'x' ? this.layout.zLines : this.layout.xLines
    for (const l of perp) {
      if (Math.abs(l.pos - t) > 3.5) continue
      if (!CityLayout.hasSpanAt(l, node.line.pos)) continue
      return l
    }
    return null
  }

  private spawn(node: WalkNode, hora: number): void {
    const seed = Math.floor(this.rng() * 1e9)
    const app = randomAppearance(seed)
    const id = this.nextId++
    const rng = makeRng(seed ^ 0x5bd1)
    // Roupas coerentes com o horário e o bairro.
    const zona = this.world.districtName(node.x, node.z)
    if (zona === 'Campo Grande' && rng() < 0.45) {
      app.torso = 'uniforme'
      app.pernas = 'shortEsportivo'
      app.pes = 'chuteira'
    }
    if (hora < 7 || hora > 20) {
      if (rng() < 0.4) app.torso = 'jaqueta'
    }

    const lodDist = Math.hypot(node.x, node.z)
    void lodDist
    const character = new Character(app, { castShadow: true, lod: 'medio' })
    character.setPosition(node.x, this.world.surfaceHeight(node.x, node.z, 1e4), node.z)
    this.group.add(character.group)

    this.people.push({
      id,
      character,
      position: new THREE.Vector3(node.x, character.group.position.y, node.z),
      yaw: node.line.axis === 'x' ? (node.dir > 0 ? 0 : Math.PI) : (node.dir > 0 ? Math.PI / 2 : -Math.PI / 2),
      speed: 0,
      targetSpeed: WALK_SPEED * randRange(rng, 0.82, 1.18),
      state: 'andando',
      stateTimer: randRange(rng, 3, 14),
      node,
      rng,
      lod: 'medio',
      action: null,
      actionTime: 0,
      grupo: [],
      nome: pick(rng, NOMES),
      assunto: Math.floor(rng() * 8),
      cumprimentado: false,
    })
  }

  private despawn(index: number): void {
    const p = this.people[index]
    this.group.remove(p.character.group)
    p.character.dispose()
    this.people.splice(index, 1)
  }

  /**
   * Quando false, nenhum pedestre novo é criado neste quadro. Construir um
   * personagem custa alguns milissegundos; fazer isso num quadro já apertado é
   * exatamente o que produz o engasgo que se sente ao virar uma esquina.
   */
  permitirNovos = true

  update(dt: number, center: THREE.Vector3, densidade: number, trafficPhase: 0 | 1, hora: number): void {
    const alvo = Math.round(clamp(densidade, 0, 1) * this.maxPeople * horaFator(hora))

    for (let i = this.people.length - 1; i >= 0; i--) {
      const p = this.people[i]
      const d = Math.hypot(p.position.x - center.x, p.position.z - center.z)
      if (d > this.radius * 1.3 || this.people.length > alvo + 6) { this.despawn(i); continue }
    }

    this.spawnTimer -= dt
    if (this.people.length < alvo && this.spawnTimer <= 0 && this.permitirNovos) {
      this.spawnTimer = 0.18
      const node = this.findSpawn(center, this.detailRadius * 0.8, this.radius)
      if (node) this.spawn(node, hora)
    }

    for (const p of this.people) {
      const dist = Math.hypot(p.position.x - center.x, p.position.z - center.z)
      p.lod = dist < this.detailRadius ? 'alto' : dist < this.radius * 0.7 ? 'medio' : 'baixo'
      this.updatePerson(dt, p, trafficPhase, dist)
    }
  }

  private updatePerson(
    dt: number, p: Pedestrian, trafficPhase: 0 | 1, distToPlayer: number,
  ): void {
    p.stateTimer -= dt

    // Reage à aproximação do jogador.
    if (distToPlayer < 3.4 && p.state === 'andando' && !p.cumprimentado && p.rng() < dt * 1.4) {
      p.cumprimentado = true
      p.action = 'aceno'
      p.actionTime = 0
      p.state = 'observando'
      p.stateTimer = 1.6
    }
    if (distToPlayer > 12) p.cumprimentado = false

    switch (p.state) {
      case 'andando': {
        p.targetSpeed = WALK_SPEED
        if (p.stateTimer <= 0) {
          const r = p.rng()
          if (r < 0.16) { p.state = 'parado'; p.stateTimer = randRange(p.rng, 2, 6) }
          else if (r < 0.24) { p.state = 'conversando'; p.stateTimer = randRange(p.rng, 6, 16); p.action = 'conversa'; p.actionTime = 0 }
          else if (r < 0.30) { p.state = 'correndo'; p.stateTimer = randRange(p.rng, 4, 10) }
          else p.stateTimer = randRange(p.rng, 6, 20)
        }
        // Travessia: ao chegar perto de um cruzamento, decide atravessar.
        const cross = this.crossingNear(p.node, p.node.t + 4 * p.node.dir)
        if (cross && p.rng() < dt * 0.9) {
          const minhaFase: 0 | 1 = p.node.line.axis === 'x' ? 1 : 0
          if (minhaFase === trafficPhase) {
            p.state = 'atravessando'
            p.stateTimer = 4.5
          } else {
            p.state = 'esperandoSinal'
            p.stateTimer = 8
          }
        }
        break
      }
      case 'correndo':
        p.targetSpeed = RUN_SPEED
        if (p.stateTimer <= 0) { p.state = 'andando'; p.stateTimer = randRange(p.rng, 6, 18) }
        break
      case 'esperandoSinal': {
        p.targetSpeed = 0
        const minhaFase: 0 | 1 = p.node.line.axis === 'x' ? 1 : 0
        if (minhaFase === trafficPhase || p.stateTimer <= 0) {
          p.state = 'atravessando'
          p.stateTimer = 4.5
        }
        break
      }
      case 'atravessando':
        p.targetSpeed = WALK_SPEED * 1.25
        if (p.stateTimer <= 0) { p.state = 'andando'; p.stateTimer = randRange(p.rng, 6, 18) }
        break
      case 'parado':
      case 'observando':
        p.targetSpeed = 0
        if (p.stateTimer <= 0) { p.state = 'andando'; p.stateTimer = randRange(p.rng, 8, 22) }
        break
      case 'conversando':
        p.targetSpeed = 0
        if (p.stateTimer <= 0) { p.state = 'andando'; p.stateTimer = randRange(p.rng, 8, 22); p.action = null }
        else if (!p.action) { p.action = 'conversa'; p.actionTime = 0 }
        break
      default:
        p.targetSpeed = 0
        break
    }

    // Movimento ao longo da calçada
    p.speed = damp(p.speed, p.targetSpeed, 4.5, dt)
    if (p.speed > 0.02) {
      const next = this.advance(p.node, Math.max(0.6, p.speed * dt * 4))
      if (next) {
        const dx = next.x - p.position.x
        const dz = next.z - p.position.z
        const len = Math.hypot(dx, dz)
        if (len > 0.001) {
          const step = Math.min(p.speed * dt, len)
          p.position.x += (dx / len) * step
          p.position.z += (dz / len) * step
          p.yaw = dampAngle(p.yaw, Math.atan2(dx, dz), 6, dt)
        }
        // Avança o nó quando estiver perto o bastante.
        if (len < 0.8) p.node = next
      }
    }

    // Evita atravessar pessoas e postes.
    if (p.lod === 'alto') {
      const before = { x: p.position.x, z: p.position.z }
      this.collision.resolveCircle(before, 0.34, p.position.y + 0.3, p.position.y + 1.6)
      p.position.x = before.x
      p.position.z = before.z
      for (const other of this.people) {
        if (other === p) continue
        const dx = p.position.x - other.position.x
        const dz = p.position.z - other.position.z
        const d2 = dx * dx + dz * dz
        if (d2 < 0.36 && d2 > 1e-6) {
          const d = Math.sqrt(d2)
          const push = (0.6 - d) * 0.5
          p.position.x += (dx / d) * push
          p.position.z += (dz / d) * push
        }
      }
    }

    p.position.y = this.world.surfaceHeight(p.position.x, p.position.z, p.position.y + 0.9)

    // Ação pontual
    if (p.action) {
      p.actionTime += dt
      if (p.actionTime > 1.6 && p.state !== 'conversando') { p.action = null; p.actionTime = 0 }
    }

    // Visual
    const ch = p.character
    ch.setPosition(p.position.x, p.position.y, p.position.z)
    ch.setYaw(p.yaw)
    const inp = ch.input
    inp.speed = p.speed
    inp.grounded = true
    inp.forwardness = 1
    inp.action = p.action
    inp.actionProgress = p.action ? (p.actionTime % 1.6) / 1.6 : 0
    inp.lookYaw = 0
    inp.lookPitch = 0

    ch.ajustarDetalhe(distToPlayer)

    // Distantes atualizam menos vezes por segundo.
    if (p.lod === 'baixo') {
      if (((p.id + Math.floor(performance.now() / 100)) & 3) !== 0) return
      ch.update(dt * 4)
      return
    }
    ch.update(dt, p.lod === 'alto'
      ? (x, z) => this.world.surfaceHeight(x, z, p.position.y + 0.9)
      : undefined)
  }

  dispose(): void {
    for (const p of this.people) p.character.dispose()
    this.people = []
    this.world.root.remove(this.group)
  }
}

/** Movimento da cidade ao longo do dia. */
function horaFator(h: number): number {
  if (h < 5) return 0.12
  if (h < 7) return 0.35
  if (h < 10) return 1.0
  if (h < 12) return 0.8
  if (h < 14) return 0.95
  if (h < 18) return 0.85
  if (h < 21) return 1.0
  if (h < 23) return 0.6
  return 0.25
}
