/**
 * Mobiliário urbano e vegetação: postes, semáforos, bancos, lixeiras, pontos de
 * ônibus, placas, hidrantes, bancas, muros, árvores e arbustos.
 *
 * Tudo é escrito no `GeometryBatcher` do setor para virar poucas malhas.
 */

import * as THREE from 'three'
import { clamp, lerp, makeRng, pick, randInt, randRange, type Rng } from '../core/math'
import { GeometryBatcher, makeBox, makeCylinder, transform, withColor } from './geometry'
import type { CollisionWorld } from './collision'
import { terrainHeight } from './terrain'
import { buildVehicleMeshes, makeVehicleSpec, type VehicleClass } from '../vehicle/model'

const CINZA = new THREE.Color(0x8a8f94)
const CINZA_ESCURO = new THREE.Color(0x3b4045)
const CONCRETO = new THREE.Color(0xc2beb5)

export interface PropContext {
  batcher: GeometryBatcher
  collision: CollisionWorld
  owner: string
  /** Luzes noturnas registradas pelo setor (posição dos postes). */
  lamps: { x: number; y: number; z: number }[]
}

function ground(x: number, z: number): number { return terrainHeight(x, z) }

/** Poste de iluminação pública com braço e luminária. */
export function addStreetLight(ctx: PropContext, x: number, z: number, yaw: number): void {
  const y = ground(x, z)
  const h = 7.4
  ctx.batcher.add('metal', withColor(transform(makeCylinder(0.12, h, 8, 1.4), x, y + h / 2, z), CINZA))
  ctx.batcher.add('concreto', withColor(transform(makeBox(0.52, 0.5, 0.52, { uvScale: 0.6 }), x, y + 0.25, z), CONCRETO))
  // Braço curvo aproximado por dois segmentos
  const ax = Math.sin(yaw), az = Math.cos(yaw)
  ctx.batcher.add('metal', withColor(
    transform(makeCylinder(0.085, 1.5, 6, 1), x + ax * 0.55, y + h + 0.32, z + az * 0.55, yaw, 1, 1, 1), CINZA))
  const arm = makeCylinder(0.085, 1.9, 6, 1)
  arm.rotateZ(Math.PI / 2)
  ctx.batcher.add('metal', withColor(transform(arm, x + ax * 1.0, y + h + 0.62, z + az * 1.0, yaw), CINZA))
  // Luminária
  ctx.batcher.add('metal', withColor(
    transform(makeBox(0.42, 0.18, 0.95, { uvScale: 0.5 }), x + ax * 1.9, y + h + 0.5, z + az * 1.9, yaw), CINZA_ESCURO))
  ctx.batcher.add('luz', withColor(
    transform(makeBox(0.34, 0.06, 0.82, { uvScale: 0.5 }), x + ax * 1.9, y + h + 0.40, z + az * 1.9, yaw),
    new THREE.Color(0xffe6b0)))
  ctx.lamps.push({ x: x + ax * 1.9, y: y + h + 0.4, z: z + az * 1.9 })
  ctx.collision.add({ x, y: y + h / 2, z }, { x: 0.16, y: h / 2, z: 0.16 }, 0, 'prop', ctx.owner)
}

export interface TrafficLightHandle {
  x: number; z: number
  /** Índice do grupo de fases (0 = eixo X livre, 1 = eixo Z livre). */
  phase: 0 | 1
  /** Malhas emissivas das três lentes (verm/amar/verde). */
  lensColors: { r: THREE.Color; y: THREE.Color; g: THREE.Color }
}

/** Semáforo de coluna com três lentes e placa de rua. */
export function addTrafficLight(
  ctx: PropContext, x: number, z: number, yaw: number, phase: 0 | 1,
): TrafficLightHandle {
  const y = ground(x, z)
  const h = 3.6
  ctx.batcher.add('metal', withColor(transform(makeCylinder(0.09, h, 8, 1), x, y + h / 2, z), CINZA_ESCURO))
  ctx.batcher.add('concreto', withColor(transform(makeBox(0.45, 0.3, 0.45, { uvScale: 0.5 }), x, y + 0.15, z), CONCRETO))
  const bx = Math.sin(yaw) * 0.22
  const bz = Math.cos(yaw) * 0.22
  ctx.batcher.add('metal', withColor(
    transform(makeBox(0.42, 1.22, 0.3, { uvScale: 0.4 }), x + bx, y + h - 0.35, z + bz, yaw), CINZA_ESCURO))
  const lens = (dy: number, col: number) => {
    const g = makeCylinder(0.115, 0.07, 10, 0.4)
    g.rotateX(Math.PI / 2)
    ctx.batcher.add('luz', withColor(
      transform(g, x + bx + Math.sin(yaw) * 0.17, y + h - 0.35 + dy, z + bz + Math.cos(yaw) * 0.17, yaw),
      new THREE.Color(col)))
  }
  lens(0.4, 0x3a0d0d)
  lens(0.0, 0x3a2f0d)
  lens(-0.4, 0x0d3a18)
  ctx.collision.add({ x, y: y + h / 2, z }, { x: 0.16, y: h / 2, z: 0.16 }, 0, 'prop', ctx.owner)
  return {
    x, z, phase,
    lensColors: { r: new THREE.Color(0xff2b1a), y: new THREE.Color(0xffc21a), g: new THREE.Color(0x1aff5c) },
  }
}

export function addBench(ctx: PropContext, x: number, z: number, yaw: number, rng: Rng): void {
  const y = ground(x, z)
  const wood = new THREE.Color(0x6b4a2c).lerp(new THREE.Color(0x8a6238), rng())
  for (let i = 0; i < 3; i++) {
    ctx.batcher.add('madeira', withColor(
      transform(makeBox(1.9, 0.07, 0.15, { uvScale: 0.8 }), x, y + 0.46, z - 0.22 + i * 0.2, yaw), wood))
  }
  for (let i = 0; i < 3; i++) {
    ctx.batcher.add('madeira', withColor(
      transform(makeBox(1.9, 0.15, 0.07, { uvScale: 0.8 }), x, y + 0.66 + i * 0.18, z + 0.28, yaw), wood))
  }
  for (const s of [-0.82, 0.82]) {
    ctx.batcher.add('metal', withColor(
      transform(makeBox(0.09, 0.46, 0.55, { uvScale: 0.4 }), x + Math.cos(yaw) * s, y + 0.23, z - Math.sin(yaw) * s, yaw), CINZA_ESCURO))
  }
  ctx.collision.add({ x, y: y + 0.28, z }, { x: 1.0, y: 0.28, z: 0.35 }, yaw, 'prop', ctx.owner)
}

export function addBin(ctx: PropContext, x: number, z: number, rng: Rng): void {
  const y = ground(x, z)
  const col = rng() < 0.5 ? new THREE.Color(0x2c6b3f) : new THREE.Color(0x3f4a52)
  ctx.batcher.add('metal', withColor(transform(makeCylinder(0.28, 0.86, 10, 0.8), x, y + 0.55, z), col))
  ctx.batcher.add('metal', withColor(transform(makeCylinder(0.05, 1.0, 6, 0.6), x + 0.3, y + 0.5, z), CINZA))
  ctx.batcher.add('plastico', withColor(transform(makeCylinder(0.3, 0.06, 10, 0.5), x, y + 1.0, z), CINZA_ESCURO))
  ctx.collision.add({ x, y: y + 0.45, z }, { x: 0.3, y: 0.45, z: 0.3 }, 0, 'prop', ctx.owner)
}

export function addBusStop(ctx: PropContext, x: number, z: number, yaw: number): void {
  const y = ground(x, z)
  const w = 4.2, d = 1.5, h = 2.55
  ctx.batcher.add('metal', withColor(transform(makeBox(w, 0.1, d, { uvScale: 1 }), x, y + h, z, yaw), CINZA_ESCURO))
  for (const s of [-w / 2 + 0.12, w / 2 - 0.12]) {
    const px = x + Math.cos(yaw) * s
    const pz = z - Math.sin(yaw) * s
    ctx.batcher.add('metal', withColor(transform(makeBox(0.12, h, 0.12, { uvScale: 0.5 }), px, y + h / 2, pz, yaw), CINZA_ESCURO))
    ctx.collision.add({ x: px, y: y + h / 2, z: pz }, { x: 0.12, y: h / 2, z: 0.12 }, yaw, 'prop', ctx.owner)
  }
  // Fundo de vidro
  ctx.batcher.add('vidro', withColor(
    transform(makeBox(w - 0.3, h - 0.55, 0.05, { uvScale: 1 }), x + Math.sin(yaw) * (d / 2 - 0.08), y + h / 2 + 0.2, z + Math.cos(yaw) * (d / 2 - 0.08), yaw),
    new THREE.Color(0xc4d6e0)))
  // Banco
  ctx.batcher.add('metal', withColor(
    transform(makeBox(w - 0.8, 0.08, 0.42, { uvScale: 0.8 }), x, y + 0.46, z, yaw), CINZA))
  // Painel de informação iluminado
  ctx.batcher.add('luz', withColor(
    transform(makeBox(0.8, 1.3, 0.06, { uvScale: 0.5 }), x + Math.cos(yaw) * (w / 2 - 0.55), y + 1.5, z - Math.sin(yaw) * (w / 2 - 0.55), yaw),
    new THREE.Color(0xdfe9f2)))
  ctx.collision.add({ x, y: y + 0.4, z }, { x: w / 2 - 0.4, y: 0.4, z: 0.25 }, yaw, 'prop', ctx.owner)
  ctx.lamps.push({ x, y: y + h - 0.2, z })
}

export function addHydrant(ctx: PropContext, x: number, z: number): void {
  const y = ground(x, z)
  const col = new THREE.Color(0xb02a22)
  ctx.batcher.add('metal', withColor(transform(makeCylinder(0.13, 0.62, 8, 0.5), x, y + 0.31, z), col))
  ctx.batcher.add('metal', withColor(transform(makeCylinder(0.16, 0.1, 8, 0.4), x, y + 0.66, z), col))
  ctx.batcher.add('metal', withColor(transform(makeBox(0.42, 0.1, 0.1, { uvScale: 0.3 }), x, y + 0.45, z), col))
  ctx.collision.add({ x, y: y + 0.35, z }, { x: 0.18, y: 0.35, z: 0.18 }, 0, 'prop', ctx.owner)
}

/** Placa de trânsito (regulamentação ou identificação de rua). */
export function addSign(ctx: PropContext, x: number, z: number, yaw: number, kind: 'pare' | 'rua' | 'velocidade'): void {
  const y = ground(x, z)
  const h = kind === 'rua' ? 2.6 : 2.25
  ctx.batcher.add('metal', withColor(transform(makeCylinder(0.045, h, 6, 0.6), x, y + h / 2, z), CINZA))
  if (kind === 'rua') {
    ctx.batcher.add('plastico', withColor(
      transform(makeBox(1.35, 0.3, 0.04, { uvScale: 0.5 }), x, y + h - 0.2, z, yaw), new THREE.Color(0x1f5aa8)))
  } else if (kind === 'pare') {
    const g = makeCylinder(0.32, 0.04, 8, 0.4)
    g.rotateX(Math.PI / 2)
    ctx.batcher.add('plastico', withColor(transform(g, x, y + h - 0.2, z, yaw), new THREE.Color(0xb5231c)))
  } else {
    const g = makeCylinder(0.3, 0.04, 14, 0.4)
    g.rotateX(Math.PI / 2)
    ctx.batcher.add('plastico', withColor(transform(g, x, y + h - 0.2, z, yaw), new THREE.Color(0xf0f0ee)))
    const gi = makeCylinder(0.31, 0.02, 14, 0.4)
    gi.rotateX(Math.PI / 2)
    ctx.batcher.add('plastico', withColor(transform(gi, x, y + h - 0.2, z + 0.01, yaw), new THREE.Color(0xc02a22)))
  }
  ctx.collision.add({ x, y: y + h / 2, z }, { x: 0.1, y: h / 2, z: 0.1 }, 0, 'prop', ctx.owner)
}

export type EspecieArvore = 'ipeAmarelo' | 'ipeRosa' | 'copaLarga' | 'palmeira' | 'coqueiro' | 'jovem' | 'sibipiruna'

const VERDES_COPA: [number, number][] = [
  [0x2c5a28, 0x4a8438], [0x27522a, 0x3f7a35], [0x2f6338, 0x53904a],
  [0x33602c, 0x4d8a3c], [0x2a5630, 0x447a40],
]

/**
 * Copa em aglomerados: várias elipsoides achatadas e deformadas, com a face
 * externa mais clara que o interior. Dá volume e leitura de folhagem sem
 * recorrer a bilhoards nem a malhas importadas.
 */
function copaAglomerada(
  ctx: PropContext, x: number, y: number, z: number,
  raio: number, achatamento: number, grupos: number,
  claro: THREE.Color, escuro: THREE.Color, rng: Rng,
): void {
  for (let i = 0; i < grupos; i++) {
    const ang = (i / grupos) * Math.PI * 2 + rng() * 0.8
    const dist = i === 0 ? 0 : raio * randRange(rng, 0.30, 0.62)
    const r = raio * (i === 0 ? randRange(rng, 0.72, 0.9) : randRange(rng, 0.42, 0.68))
    const cx = x + Math.cos(ang) * dist
    const cz = z + Math.sin(ang) * dist
    const cy = y + (i === 0 ? 0 : randRange(rng, -0.25, 0.42) * raio)

    const g = new THREE.IcosahedronGeometry(r, 1)
    const p = g.attributes.position as THREE.BufferAttribute
    const cores = new Float32Array(p.count * 3)
    const uv = new Float32Array(p.count * 2)
    const n = new THREE.Vector3()
    for (let v = 0; v < p.count; v++) {
      n.set(p.getX(v), p.getY(v), p.getZ(v))
      const len = n.length() || 1
      // Deformação irregular, mais forte na horizontal que na vertical.
      const ruido = 0.78 + rng() * 0.44
      p.setXYZ(v,
        n.x * ruido,
        n.y * ruido * achatamento,
        n.z * ruido)
      // Topo e bordas mais claros; interior e parte de baixo mais escuros.
      const t = clamp((n.y / len) * 0.5 + 0.55, 0, 1)
      const c = escuro.clone().lerp(claro, t * randRange(rng, 0.75, 1.0))
      cores[v * 3] = c.r; cores[v * 3 + 1] = c.g; cores[v * 3 + 2] = c.b
      uv[v * 2] = rng(); uv[v * 2 + 1] = rng()
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    g.setAttribute('color', new THREE.BufferAttribute(cores, 3))
    g.computeVertexNormals()
    transform(g, cx, cy, cz)
    ctx.batcher.add('folhagem', g)
  }
}

/** Tronco com leve inclinação e afinamento. */
function troncoArvore(
  ctx: PropContext, x: number, y: number, z: number,
  altura: number, raioBase: number, inclinacao: number, cor: THREE.Color, rng: Rng,
): { topoX: number; topoY: number; topoZ: number } {
  const segs = 3
  const dir = rng() * Math.PI * 2
  let px = x, pz = z
  let py = y
  for (let i = 0; i < segs; i++) {
    const h = altura / segs
    const r = lerp(raioBase, raioBase * 0.55, i / segs)
    const dx = Math.cos(dir) * inclinacao * h * (i / segs)
    const dz = Math.sin(dir) * inclinacao * h * (i / segs)
    const g = makeCylinder(r, h * 1.04, 8, 1.2)
    transform(g, px + dx / 2, py + h / 2, pz + dz / 2)
    ctx.batcher.add('tronco', withColor(g, cor.clone().multiplyScalar(lerp(1.0, 0.86, i / segs))))
    px += dx
    pz += dz
    py += h
  }
  return { topoX: px, topoY: py, topoZ: pz }
}

/** Fronde de palmeira: uma folha alongada e arqueada. */
function fronde(
  ctx: PropContext, x: number, y: number, z: number,
  comprimento: number, angulo: number, queda: number, cor: THREE.Color,
): void {
  const segs = 5
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs
    const t1 = (i + 1) / segs
    const meio = (t0 + t1) / 2
    const larg = Math.sin(meio * Math.PI) * 0.34 + 0.06
    const raio = comprimento * meio
    const alturaSeg = -queda * meio * meio * comprimento
    const g = makeBox(comprimento / segs * 1.08, 0.025, larg, { uvScale: 0.5 })
    transform(g,
      x + Math.cos(angulo) * raio,
      y + alturaSeg + comprimento * 0.10 * Math.sin(meio * Math.PI),
      z + Math.sin(angulo) * raio,
      -angulo)
    ctx.batcher.add('folhagem', withColor(g, cor.clone().multiplyScalar(lerp(1.06, 0.82, meio))))
  }
}

/** Árvore urbana. As espécies mudam a silhueta da rua de forma perceptível. */
export function addTree(ctx: PropContext, x: number, z: number, rng: Rng, scale = 1, especie?: EspecieArvore): void {
  const y = ground(x, z)
  const esp: EspecieArvore = especie ?? pick(rng, [
    'copaLarga', 'copaLarga', 'copaLarga', 'sibipiruna', 'sibipiruna',
    'ipeAmarelo', 'ipeRosa', 'palmeira', 'coqueiro', 'jovem',
  ])
  const troncoCor = new THREE.Color(0x5b4632).multiplyScalar(lerp(0.82, 1.18, rng()))

  switch (esp) {
    case 'palmeira': case 'coqueiro': {
      const altura = randRange(rng, 6.5, 11.5) * scale
      const r = randRange(rng, 0.16, 0.24) * scale
      const topo = troncoArvore(ctx, x, y, z, altura, r, esp === 'coqueiro' ? 0.10 : 0.03,
        new THREE.Color(0x7a6a52).multiplyScalar(lerp(0.9, 1.1, rng())), rng)
      const verde = new THREE.Color(0x2f6b34).lerp(new THREE.Color(0x4f9440), rng())
      const n = randInt(rng, 7, 11)
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rng() * 0.3
        fronde(ctx, topo.topoX, topo.topoY, topo.topoZ,
          randRange(rng, 1.9, 2.9) * scale, a, randRange(rng, 0.45, 0.85), verde)
      }
      if (esp === 'coqueiro') {
        for (let i = 0; i < 4; i++) {
          const a = rng() * Math.PI * 2
          const g = new THREE.IcosahedronGeometry(0.14 * scale, 0)
          transform(g, topo.topoX + Math.cos(a) * 0.3, topo.topoY - 0.25, topo.topoZ + Math.sin(a) * 0.3)
          ctx.batcher.add('folhagem', withColor(g, new THREE.Color(0x7a6a3a)))
        }
      }
      ctx.collision.add({ x, y: y + altura / 2, z }, { x: r + 0.1, y: altura / 2, z: r + 0.1 }, 0, 'prop', ctx.owner)
      break
    }

    case 'ipeAmarelo': case 'ipeRosa': {
      const altura = randRange(rng, 5.0, 8.0) * scale
      const r = randRange(rng, 0.17, 0.27) * scale
      const topo = troncoArvore(ctx, x, y, z, altura * 0.52, r, 0.09, troncoCor, rng)
      const flor = esp === 'ipeAmarelo'
        ? new THREE.Color(0xf2c230)
        : new THREE.Color(0xe08ab4)
      const florEsc = flor.clone().multiplyScalar(0.72)
      copaAglomerada(ctx, topo.topoX, topo.topoY + altura * 0.22, topo.topoZ,
        randRange(rng, 2.1, 3.1) * scale, 0.62, randInt(rng, 4, 6), flor, florEsc, rng)
      ctx.collision.add({ x, y: y + altura * 0.3, z }, { x: r + 0.12, y: altura * 0.3, z: r + 0.12 }, 0, 'prop', ctx.owner)
      break
    }

    case 'jovem': {
      const altura = randRange(rng, 2.6, 4.0) * scale
      const r = randRange(rng, 0.07, 0.12) * scale
      const topo = troncoArvore(ctx, x, y, z, altura * 0.55, r, 0.05, troncoCor, rng)
      const [c1, c2] = pick(rng, VERDES_COPA)
      copaAglomerada(ctx, topo.topoX, topo.topoY + altura * 0.22, topo.topoZ,
        randRange(rng, 0.9, 1.4) * scale, 0.78, 3, new THREE.Color(c2), new THREE.Color(c1), rng)
      ctx.collision.add({ x, y: y + altura * 0.3, z }, { x: r + 0.1, y: altura * 0.3, z: r + 0.1 }, 0, 'prop', ctx.owner)
      break
    }

    case 'sibipiruna': {
      const altura = randRange(rng, 6.0, 9.5) * scale
      const r = randRange(rng, 0.20, 0.32) * scale
      const topo = troncoArvore(ctx, x, y, z, altura * 0.48, r, 0.11, troncoCor, rng)
      const [c1, c2] = pick(rng, VERDES_COPA)
      // Copa larga e rala, típica de árvore de calçada.
      copaAglomerada(ctx, topo.topoX, topo.topoY + altura * 0.20, topo.topoZ,
        randRange(rng, 2.6, 3.8) * scale, 0.48, randInt(rng, 5, 7), new THREE.Color(c2), new THREE.Color(c1), rng)
      ctx.collision.add({ x, y: y + altura * 0.3, z }, { x: r + 0.14, y: altura * 0.3, z: r + 0.14 }, 0, 'prop', ctx.owner)
      break
    }

    default: {
      const altura = randRange(rng, 5.5, 9.0) * scale
      const r = randRange(rng, 0.22, 0.36) * scale
      const topo = troncoArvore(ctx, x, y, z, altura * 0.44, r, 0.08, troncoCor, rng)
      const [c1, c2] = pick(rng, VERDES_COPA)
      copaAglomerada(ctx, topo.topoX, topo.topoY + altura * 0.26, topo.topoZ,
        randRange(rng, 2.4, 3.6) * scale, 0.78, randInt(rng, 5, 8), new THREE.Color(c2), new THREE.Color(c1), rng)
      ctx.collision.add({ x, y: y + altura * 0.32, z }, { x: r + 0.14, y: altura * 0.32, z: r + 0.14 }, 0, 'prop', ctx.owner)
      break
    }
  }
}

export function addBush(ctx: PropContext, x: number, z: number, rng: Rng): void {
  const y = ground(x, z)
  const r = randRange(rng, 0.5, 1.15)
  const [c1, c2] = pick(rng, VERDES_COPA)
  copaAglomerada(ctx, x, y + r * 0.62, z, r, 0.68, randInt(rng, 2, 4),
    new THREE.Color(c2), new THREE.Color(c1), rng)
}

/** Muro baixo com grade (divisa de lote residencial). */
export function addFence(owner: PropContext, x0: number, z0: number, x1: number, z1: number): void {
  const dx = x1 - x0, dz = z1 - z0
  const len = Math.hypot(dx, dz)
  if (len < 0.6) return
  const yaw = Math.atan2(dx, dz)
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2
  const y = ground(cx, cz)
  owner.batcher.add('concreto', withColor(
    transform(makeBox(0.2, 0.55, len, { uvScale: 1 }), cx, y + 0.28, cz, yaw), CONCRETO))
  owner.batcher.add('metal', withColor(
    transform(makeBox(0.06, 0.95, len, { uvScale: 1 }), cx, y + 1.02, cz, yaw), CINZA_ESCURO))
  const posts = Math.max(2, Math.floor(len / 2))
  for (let i = 0; i <= posts; i++) {
    const t = i / posts
    const px = lerp(x0, x1, t), pz = lerp(z0, z1, t)
    owner.batcher.add('metal', withColor(
      transform(makeBox(0.1, 1.5, 0.1, { uvScale: 0.5 }), px, ground(px, pz) + 0.75, pz, yaw), CINZA_ESCURO))
  }
  owner.collision.add({ x: cx, y: y + 0.75, z: cz }, { x: 0.15, y: 0.75, z: len / 2 }, yaw, 'cerca', owner.owner)
}

/** Banca de jornal / quiosque pequeno. */
export function addKiosk(ctx: PropContext, x: number, z: number, yaw: number, rng: Rng): void {
  const y = ground(x, z)
  const col = new THREE.Color(pick(rng, [0x2f6b8a, 0x8a4a2f, 0x3f7a4a, 0x8a7a2f]))
  ctx.batcher.add('metal', withColor(transform(makeBox(3.0, 2.5, 2.2, { uvScale: 1 }), x, y + 1.25, z, yaw), col))
  ctx.batcher.add('toldo', withColor(transform(makeBox(3.6, 0.1, 2.9, { uvScale: 1 }), x, y + 2.6, z, yaw), new THREE.Color(0xe8e2d6)))
  ctx.batcher.add('vidro', withColor(
    transform(makeBox(2.4, 1.2, 0.06, { uvScale: 1 }), x + Math.sin(yaw) * 1.12, y + 1.5, z + Math.cos(yaw) * 1.12, yaw),
    new THREE.Color(0xc8d8e2)))
  ctx.batcher.add('luz', withColor(
    transform(makeBox(2.6, 0.08, 0.1, { uvScale: 0.5 }), x + Math.sin(yaw) * 1.2, y + 2.3, z + Math.cos(yaw) * 1.2, yaw),
    new THREE.Color(0xfff0cc)))
  ctx.collision.add({ x, y: y + 1.25, z }, { x: 1.5, y: 1.25, z: 1.1 }, yaw, 'prop', ctx.owner)
  ctx.lamps.push({ x, y: y + 2.4, z })
}

/** Distribui vegetação e mobiliário ao longo de uma calçada. */
export function decorateSidewalk(
  ctx: PropContext,
  ax: number, az: number, bx: number, bz: number,
  normalX: number, normalZ: number,
  density: number, vegetation: number, seed: number,
  /** Distância da linha da calçada até o eixo da vaga, já dentro da pista. */
  recuoVaga = 4.2,
  /** Carros estacionados só no anel colado no jogador: são caros. */
  comVagas = true,
): void {
  const rng = makeRng(seed)
  const len = Math.hypot(bx - ax, bz - az)
  if (len < 8) return
  const dirX = (bx - ax) / len
  const dirZ = (bz - az) / len
  const yaw = Math.atan2(-normalX, -normalZ)
  const step = 13
  const n = Math.floor(len / step)
  for (let i = 1; i < n; i++) {
    const t = (i + (rng() - 0.5) * 0.3) * step
    const px = ax + dirX * t + normalX * 1.3
    const pz = az + dirZ * t + normalZ * 1.3
    const r = rng()
    if (i % 3 === 0 && rng() < density) {
      addStreetLight(ctx, px, pz, yaw)
    } else if (r < 0.34 * vegetation) {
      addTree(ctx, px, pz, rng)
    } else if (r < 0.46 * density) {
      addBench(ctx, ax + dirX * t + normalX * 1.0, az + dirZ * t + normalZ * 1.0, yaw, rng)
    } else if (r < 0.56 * density) {
      addBin(ctx, px, pz, rng)
    } else if (r < 0.60 * density) {
      addHydrant(ctx, ax + dirX * t + normalX * 0.6, az + dirZ * t + normalZ * 0.6)
    } else if (r < 0.66 * vegetation) {
      addBush(ctx, px, pz, rng)
    }
  }

  // Fila de carros estacionados junto ao meio-fio. O passo é o comprimento de
  // uma vaga; os buracos vêm de garagens, hidrantes e esquinas, não de sorte
  // pura, então a rua fica cheia sem virar um paredão contínuo de carros.
  if (!comVagas) return
  const vaga = 7.2
  // Segmento curto é esquina ou entrada de garagem: não recebe fila de vagas.
  if (len < 30) return
  const vagas = Math.floor((len - 6) / vaga)
  const yawCarro = Math.atan2(dirX, dirZ)
  for (let i = 0; i < vagas; i++) {
    const t = 3 + i * vaga + vaga / 2
    if (t > len - 3) break
    // Deixa livre perto das esquinas e abre um vão de vez em quando.
    if (t < 11 || t > len - 11) continue
    if (rng() < 0.34 * (2 - density)) continue
    const px = ax + dirX * t - normalX * recuoVaga
    const pz = az + dirZ * t - normalZ * recuoVaga
    addParkedCar(ctx, px, pz, yawCarro + (rng() < 0.15 ? Math.PI : 0), rng)
  }
}

/** Classes de carro que aparecem estacionadas na rua. */
const CLASSES_PARADAS: readonly VehicleClass[] = ['hatch', 'sedan', 'hatch', 'suv', 'sedan', 'picape', 'van']

/**
 * Carro estacionado no meio-fio.
 *
 * Usa o mesmo modelo dos carros que circulam — carroceria lofteada, cabine,
 * colunas, rodas — mas congelado em geometria mesclada no setor. O carro
 * parado fica idêntico ao que anda, sem custar um veículo simulado nem um
 * desenho a mais.
 */
export function addParkedCar(ctx: PropContext, x: number, z: number, yaw: number, rng: Rng): void {
  const y = ground(x, z)
  const spec = makeVehicleSpec(pick(rng, CLASSES_PARADAS), randInt(rng, 1, 1e9))
  const m = buildVehicleMeshes(spec, true)

  // A origem do modelo de veículo já fica no chão: as rodas nascem em
  // y = raioRoda. Somar o raio aqui fazia o carro flutuar.
  const base = y

  /** Leva uma peça do referencial do carro para o mundo. */
  const por = (geo: THREE.BufferGeometry, chave: string): void => {
    if (!geo.attributes.position || geo.attributes.position.count === 0) return
    ctx.batcher.add(chave, transform(geo, x, base, z, yaw))
  }

  // Materiais de carro, não de prédio: pintura com verniz, vidro escuro e
  // cromo. Com os materiais do mundo a lataria saía com textura de porta de
  // aço e o vidro com o tom das janelas de fachada.
  // A cor da lataria é reaplicada aqui: sem isso a carroceria chegava branca
  // ao lote do setor e a rua inteira virava uma fila de carros claros.
  por(withColor(m.corpo, new THREE.Color(spec.cor)), 'pintura')
  por(m.vidros, 'vidroEscuro')
  por(m.cromados, 'cromo')
  por(m.escuros, 'borracha')
  por(m.farois, 'luz')
  por(m.lanternas, 'plastico')

  for (const r of m.posicoesRodas) {
    const g = m.roda.clone()
    transform(g, r.x, r.y, r.z, 0)
    ctx.batcher.add('borracha', transform(g, x, base, z, yaw))
  }
  m.roda.dispose()

  ctx.collision.add(
    { x, y: base + spec.altura / 2, z },
    { x: spec.largura / 2, y: spec.altura / 2, z: spec.comprimento / 2 },
    yaw, 'prop', ctx.owner,
  )
}
