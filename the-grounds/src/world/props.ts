/**
 * Mobiliário urbano e vegetação: postes, semáforos, bancos, lixeiras, pontos de
 * ônibus, placas, hidrantes, bancas, muros, árvores e arbustos.
 *
 * Tudo é escrito no `GeometryBatcher` do setor para virar poucas malhas.
 */

import * as THREE from 'three'
import { lerp, makeRng, pick, randInt, randRange, type Rng } from '../core/math'
import { GeometryBatcher, makeBox, makeCylinder, transform, withColor } from './geometry'
import type { CollisionWorld } from './collision'
import { terrainHeight } from './terrain'

const CINZA = new THREE.Color(0x8a8f94)
const CINZA_ESCURO = new THREE.Color(0x3b4045)
const CONCRETO = new THREE.Color(0xc2beb5)
const VERDE_FOLHA = [0x2f5d2a, 0x3a6b30, 0x27522a, 0x437a35, 0x2b6338, 0x4d7f3a]
const TRONCO = new THREE.Color(0x5b4632)

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

/** Árvore: tronco cônico e copa em camadas com variação de cor. */
export function addTree(ctx: PropContext, x: number, z: number, rng: Rng, scale = 1): void {
  const y = ground(x, z)
  const h = randRange(rng, 4.2, 7.6) * scale
  const trunkR = lerp(0.14, 0.26, rng()) * scale
  const leafColor = new THREE.Color(pick(rng, VERDE_FOLHA))
  ctx.batcher.add('tronco', withColor(
    transform(makeCylinder(trunkR, h * 0.55, 7, 1.2), x, y + h * 0.275, z), TRONCO.clone().multiplyScalar(lerp(0.85, 1.15, rng()))))

  const layers = randInt(rng, 3, 5)
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1 || 1)
    const r = lerp(2.5, 0.9, t) * scale * lerp(0.85, 1.15, rng())
    const ly = y + h * 0.5 + t * h * 0.5
    const sphere = new THREE.IcosahedronGeometry(r, 0)
    const jitter = sphere.attributes.position as THREE.BufferAttribute
    for (let v = 0; v < jitter.count; v++) {
      jitter.setXYZ(v,
        jitter.getX(v) * lerp(0.82, 1.18, rng()),
        jitter.getY(v) * lerp(0.7, 1.0, rng()),
        jitter.getZ(v) * lerp(0.82, 1.18, rng()))
    }
    sphere.computeVertexNormals()
    // UVs simples para o material com textura
    const uv = new Float32Array(jitter.count * 2)
    for (let v = 0; v < jitter.count; v++) { uv[v * 2] = rng(); uv[v * 2 + 1] = rng() }
    sphere.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    ctx.batcher.add('folhagem', withColor(
      transform(sphere, x + randRange(rng, -0.5, 0.5) * scale, ly, z + randRange(rng, -0.5, 0.5) * scale),
      leafColor.clone().multiplyScalar(lerp(0.78, 1.18, rng()))))
  }
  ctx.collision.add({ x, y: y + h * 0.3, z }, { x: trunkR + 0.12, y: h * 0.3, z: trunkR + 0.12 }, 0, 'prop', ctx.owner)
}

export function addBush(ctx: PropContext, x: number, z: number, rng: Rng): void {
  const y = ground(x, z)
  const r = randRange(rng, 0.5, 1.1)
  const g = new THREE.IcosahedronGeometry(r, 0)
  const p = g.attributes.position as THREE.BufferAttribute
  for (let v = 0; v < p.count; v++) {
    p.setXYZ(v, p.getX(v) * randRange(rng, 0.8, 1.2), p.getY(v) * randRange(rng, 0.6, 0.95), p.getZ(v) * randRange(rng, 0.8, 1.2))
  }
  g.computeVertexNormals()
  const uv = new Float32Array(p.count * 2)
  for (let v = 0; v < p.count; v++) { uv[v * 2] = rng(); uv[v * 2 + 1] = rng() }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  ctx.batcher.add('folhagem', withColor(transform(g, x, y + r * 0.6, z), new THREE.Color(pick(rng, VERDE_FOLHA)).multiplyScalar(randRange(rng, 0.8, 1.15))))
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
}
