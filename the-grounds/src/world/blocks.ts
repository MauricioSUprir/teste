/**
 * Conteúdo das quadras que não são edificadas: praças, campos de futebol,
 * quadras poliesportivas, parques, estacionamentos e a arena do bairro
 * esportivo.
 */

import * as THREE from 'three'
import { makeRng, pick, randInt, randRange, type Rng } from '../core/math'
import { GeometryBatcher, makeBox, makeCylinder, makeGroundQuad, transform, withColor, type NivelDetalhe } from './geometry'
import { addBench, addBin, addBush, addStreetLight, addTree, type PropContext } from './props'
import type { Block } from './layout'
import { terrainHeight } from './terrain'
import type { CollisionWorld } from './collision'

export interface PitchSpec {
  id: string
  name: string
  /** Centro do campo. */
  x: number; z: number; y: number
  yaw: number
  /** Meias dimensões do gramado jogável. */
  halfLength: number
  halfWidth: number
  /** Dimensões da meta. */
  goalWidth: number
  goalHeight: number
  surface: 'grama' | 'cimento' | 'terra'
  kind: 'campo' | 'quadra' | 'arena'
}

const NOMES_CAMPO = [
  'Campo da Vila', 'Campo do Sanhaço', 'Campinho da Aurora', 'Campo do Ipê',
  'Várzea do Cruzeiro', 'Campo da Pedreira', 'Campo Novo Horizonte',
]
const NOMES_QUADRA = [
  'Quadra do Centro', 'Quadra da Praça', 'Quadra Coberta Aurora', 'Quadra do Mirante',
]

const BRANCO = new THREE.Color(0xf0efe9)
const CONCRETO = new THREE.Color(0xc4c0b7)


/** Calcula a ficha de um campo/quadra sem gerar geometria (usado no índice global). */
export function planPitchForBlock(block: Block): PitchSpec | null {
  if (block.kind !== 'campo' && block.kind !== 'quadra' && block.kind !== 'arena') return null
  const rng = makeRng(0x1234 ^ (block.id * 2246822519))
  const alongX = block.width >= block.depth
  const cx = block.cx, cz = block.cz
  const y = terrainHeight(cx, cz)
  const yaw = alongX ? 0 : Math.PI / 2

  if (block.kind === 'campo') {
    const halfLength = Math.min(alongX ? block.width : block.depth, 96) / 2 - 3
    const halfWidth = Math.min(alongX ? block.depth : block.width, 62) / 2 - 3
    const surface: PitchSpec['surface'] = rng() < 0.55 ? 'grama' : 'terra'
    return {
      id: `campo-${block.id}`, name: pick(rng, NOMES_CAMPO), x: cx, z: cz, y, yaw,
      halfLength, halfWidth, goalWidth: 7.0, goalHeight: 2.35, surface, kind: 'campo',
    }
  }
  if (block.kind === 'quadra') {
    const halfLength = Math.min(alongX ? block.width : block.depth, 42) / 2 - 2
    const halfWidth = Math.min(alongX ? block.depth : block.width, 24) / 2 - 2
    return {
      id: `quadra-${block.id}`, name: pick(rng, NOMES_QUADRA), x: cx, z: cz, y, yaw,
      halfLength, halfWidth, goalWidth: 3.2, goalHeight: 2.0, surface: 'cimento', kind: 'quadra',
    }
  }
  const halfLength = Math.min(alongX ? block.width : block.depth, 104) / 2 - 8
  const halfWidth = Math.min(alongX ? block.depth : block.width, 68) / 2 - 8
  return {
    id: `arena-${block.id}`, name: 'Arena Vila Preciosa', x: cx, z: cz, y, yaw,
    halfLength, halfWidth, goalWidth: 7.32, goalHeight: 2.44, surface: 'grama', kind: 'arena',
  }
}

export function buildBlockContent(
  block: Block,
  batcher: GeometryBatcher,
  collision: CollisionWorld,
  owner: string,
  ctx: PropContext,
  detail: NivelDetalhe,
  outPitches: PitchSpec[],
): void {
  const rng = makeRng(0x1234 ^ (block.id * 2246822519))
  switch (block.kind) {
    case 'praca': buildPraca(block, batcher, ctx, rng, detail); break
    case 'parque': buildParque(block, batcher, ctx, rng, detail); break
    case 'campo': case 'quadra': case 'arena': {
      const spec = planPitchForBlock(block)
      if (!spec) break
      if (block.kind === 'campo') buildCampo(block, spec, batcher, collision, owner, ctx, detail)
      else if (block.kind === 'quadra') buildQuadra(block, spec, batcher, collision, owner, ctx, detail)
      else buildArena(block, spec, batcher, collision, owner, ctx, detail)
      outPitches.push(spec)
      break
    }
    case 'estacionamento': buildEstacionamento(block, batcher, ctx, rng, detail); break
    case 'vazio': buildVazio(block, batcher, ctx, rng, detail); break
    default: break
  }
}

function groundQuad(
  batcher: GeometryBatcher, mat: string, cx: number, cz: number, w: number, d: number,
  uv: number, color: THREE.Color, lift = 0.02,
): void {
  // Subdivide para acompanhar o relevo.
  const segs = Math.max(1, Math.round(Math.max(w, d) / 8))
  const geo = new THREE.PlaneGeometry(w, d, segs, segs)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const uvs = geo.attributes.uv as THREE.BufferAttribute
  // O plano nasce centrado na origem: cada vértice precisa receber a posição
  // real da quadra, senão o piso é desenhado no centro do mundo.
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + cx
    const z = pos.getZ(i) + cz
    pos.setXYZ(i, x, terrainHeight(x, z) + lift, z)
    uvs.setXY(i, x / uv, z / uv)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  batcher.add(mat, withColor(geo, color))
}

function buildPraca(block: Block, batcher: GeometryBatcher, ctx: PropContext, rng: Rng, detail: NivelDetalhe): void {
  const { cx, cz, width: w, depth: d } = block
  groundQuad(batcher, 'grama', cx, cz, w, d, 4, new THREE.Color(0xffffff))
  // Caminhos em cruz de paralelepípedo
  groundQuad(batcher, 'paralelepipedo', cx, cz, w, 3.2, 2, new THREE.Color(0xffffff), 0.05)
  groundQuad(batcher, 'paralelepipedo', cx, cz, 3.2, d, 2, new THREE.Color(0xffffff), 0.05)
  if (detail === 'baixo') return

  // Chafariz ou coreto no centro
  const y = terrainHeight(cx, cz)
  if (rng() < 0.45 && Math.min(w, d) > 22) {
    batcher.add('concreto', withColor(transform(makeCylinder(3.0, 0.55, 18, 1.5), cx, y + 0.28, cz), CONCRETO))
    batcher.add('concreto', withColor(transform(makeCylinder(2.7, 0.2, 18, 1.5), cx, y + 0.62, cz), new THREE.Color(0x9fb8c4)))
    batcher.add('concreto', withColor(transform(makeCylinder(0.55, 1.5, 12, 1), cx, y + 1.2, cz), CONCRETO))
    ctx.collision.add({ x: cx, y: y + 0.5, z: cz }, { x: 3.1, y: 0.5, z: 3.1 }, 0, 'prop', ctx.owner)
  } else if (Math.min(w, d) > 18) {
    // Coreto
    batcher.add('concreto', withColor(transform(makeCylinder(3.4, 0.4, 12, 1.5), cx, y + 0.2, cz), CONCRETO))
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      batcher.add('madeira', withColor(
        transform(makeCylinder(0.13, 3.0, 8, 1), cx + Math.cos(a) * 3.0, y + 1.9, cz + Math.sin(a) * 3.0), new THREE.Color(0xe6dfd0)))
    }
    batcher.add('telha', withColor(transform(makeCylinder(3.9, 0.35, 12, 1.2), cx, y + 3.55, cz), new THREE.Color(0x8a4a34)))
    ctx.collision.add({ x: cx, y: y + 0.25, z: cz }, { x: 3.5, y: 0.25, z: 3.5 }, 0, 'prop', ctx.owner, { walkable: true })
  }

  // Árvores, bancos e postes na borda
  const n = Math.floor((w * d) / 130)
  for (let i = 0; i < n; i++) {
    const px = cx + randRange(rng, -w / 2 + 2, w / 2 - 2)
    const pz = cz + randRange(rng, -d / 2 + 2, d / 2 - 2)
    if (Math.abs(px - cx) < 5 && Math.abs(pz - cz) < 5) continue
    const r = rng()
    if (r < 0.5) addTree(ctx, px, pz, rng)
    else if (r < 0.7) addBush(ctx, px, pz, rng)
    else if (r < 0.88) addBench(ctx, px, pz, rng() * Math.PI * 2, rng)
    else addBin(ctx, px, pz, rng)
  }
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    addStreetLight(ctx, cx + sx * (w / 2 - 2.2), cz + sz * (d / 2 - 2.2), Math.atan2(-sx, -sz))
  }
}

function buildParque(block: Block, batcher: GeometryBatcher, ctx: PropContext, rng: Rng, detail: NivelDetalhe): void {
  const { cx, cz, width: w, depth: d } = block
  groundQuad(batcher, 'grama', cx, cz, w + 10, d + 10, 6, new THREE.Color(0xffffff))
  // Trilha sinuosa
  const pts: { x: number; z: number }[] = []
  for (let i = 0; i <= 10; i++) {
    const t = i / 10
    pts.push({ x: cx - w / 2 + w * t, z: cz + Math.sin(t * Math.PI * 1.6 + block.id) * d * 0.22 })
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2
    const len = Math.hypot(b.x - a.x, b.z - a.z)
    const yaw = Math.atan2(b.x - a.x, b.z - a.z)
    const g = makeGroundQuad(2.6, len + 0.6, 3)
    batcher.add('terra', withColor(transform(g, mx, terrainHeight(mx, mz) + 0.04, mz, yaw), new THREE.Color(0xffffff)))
  }
  if (detail === 'baixo') return
  const n = Math.floor((w * d) / 85)
  for (let i = 0; i < n; i++) {
    const px = cx + randRange(rng, -w / 2, w / 2)
    const pz = cz + randRange(rng, -d / 2, d / 2)
    const r = rng()
    if (r < 0.62) addTree(ctx, px, pz, rng, randRange(rng, 0.9, 1.5))
    else if (r < 0.9) addBush(ctx, px, pz, rng)
    else addBench(ctx, px, pz, rng() * Math.PI * 2, rng)
  }
}

function buildCampo(
  block: Block, spec: PitchSpec, batcher: GeometryBatcher, collision: CollisionWorld, owner: string,
  ctx: PropContext, detail: NivelDetalhe,
): void {
  const alongX = block.width >= block.depth
  const { halfLength, halfWidth, yaw, x: cx, z: cz, y, surface } = spec

  const w = alongX ? halfLength * 2 : halfWidth * 2
  const d = alongX ? halfWidth * 2 : halfLength * 2
  groundQuad(batcher, surface === 'grama' ? 'gramado' : 'terra', cx, cz, w + 6, d + 6, 6, new THREE.Color(0xffffff))
  if (detail !== 'baixo') addPitchMarkings(batcher, cx, cz, y, halfLength, halfWidth, yaw)

  addGoals(batcher, collision, owner, spec)
  if (detail !== 'baixo') {
    // Alambrado nas laterais e postes de luz
    addFenceRect(batcher, collision, owner, cx, cz, w + 6, d + 6, 3.2, yaw)
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      addStreetLight(ctx, cx + sx * (w / 2 + 2), cz + sz * (d / 2 + 2), Math.atan2(-sx, -sz))
    }
    // Arquibancada simples de um lado
    const bx = alongX ? cx : cx + halfWidth + 4
    const bz = alongX ? cz + halfWidth + 4 : cz
    for (let i = 0; i < 3; i++) {
      const gw = alongX ? halfLength * 1.4 : 1.2
      const gd = alongX ? 1.2 : halfLength * 1.4
      const g = makeBox(gw, 0.42, gd, { uvScale: 2 })
      const ox = alongX ? 0 : i * 1.1
      const oz = alongX ? i * 1.1 : 0
      batcher.add('concreto', withColor(transform(g, bx + ox, y + 0.21 + i * 0.42, bz + oz), CONCRETO))
      collision.add({ x: bx + ox, y: y + 0.21 + i * 0.42, z: bz + oz },
        { x: gw / 2, y: 0.21 + i * 0.21, z: gd / 2 }, 0, 'prop', owner, { walkable: true })
    }
  }
}

function buildQuadra(
  block: Block, spec: PitchSpec, batcher: GeometryBatcher, collision: CollisionWorld, owner: string,
  ctx: PropContext, detail: NivelDetalhe,
): void {
  const alongX = block.width >= block.depth
  const { halfLength, halfWidth, yaw, x: cx, z: cz, y } = spec
  const w = alongX ? halfLength * 2 : halfWidth * 2
  const d = alongX ? halfWidth * 2 : halfLength * 2

  groundQuad(batcher, 'concreto', cx, cz, w + 4, d + 4, 5, new THREE.Color(0xb8c4cc))
  if (detail !== 'baixo') addPitchMarkings(batcher, cx, cz, y, halfLength, halfWidth, yaw)

  addGoals(batcher, collision, owner, spec)
  if (detail !== 'baixo') {
    addFenceRect(batcher, collision, owner, cx, cz, w + 4, d + 4, 4.2, yaw)
    for (const [sx, sz] of [[-1, 0], [1, 0]] as const) {
      addStreetLight(ctx, cx + sx * (w / 2 + 2), cz + sz * (d / 2 + 2), Math.atan2(-sx, -sz))
    }
  }
}

function buildArena(
  block: Block, spec: PitchSpec, batcher: GeometryBatcher, collision: CollisionWorld, owner: string,
  ctx: PropContext, detail: NivelDetalhe,
): void {
  const alongX = block.width >= block.depth
  const { halfLength, halfWidth, yaw, x: cx, z: cz, y } = spec
  const w = alongX ? halfLength * 2 : halfWidth * 2
  const d = alongX ? halfWidth * 2 : halfLength * 2

  groundQuad(batcher, 'gramado', cx, cz, w + 10, d + 10, 6, new THREE.Color(0xffffff))
  if (detail !== 'baixo') addPitchMarkings(batcher, cx, cz, y, halfLength, halfWidth, yaw)

  addGoals(batcher, collision, owner, spec)

  if (detail !== 'baixo') {
    // Arquibancadas em degraus nos quatro lados
    const steps = 8
    for (const side of [-1, 1]) {
      for (let i = 0; i < steps; i++) {
        const off = (alongX ? d / 2 : w / 2) + 6 + i * 1.35
        const gw = alongX ? w + 16 : 1.35
        const gd = alongX ? 1.35 : d + 16
        const px = alongX ? cx : cx + side * off
        const pz = alongX ? cz + side * off : cz
        batcher.add('concreto', withColor(
          transform(makeBox(gw, 0.7 + i * 0.7, gd, { uvScale: 3 }), px, y + (0.7 + i * 0.7) / 2, pz), CONCRETO))
        collision.add({ x: px, y: y + (0.7 + i * 0.7) / 2, z: pz },
          { x: gw / 2, y: (0.7 + i * 0.7) / 2, z: gd / 2 }, 0, 'prop', owner, { walkable: true })
      }
    }
    // Refletores nos cantos
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      const px = cx + sx * (w / 2 + 14)
      const pz = cz + sz * (d / 2 + 14)
      const hgt = 20
      batcher.add('metal', withColor(transform(makeCylinder(0.35, hgt, 8, 2), px, terrainHeight(px, pz) + hgt / 2, pz), new THREE.Color(0x9aa0a6)))
      for (let i = 0; i < 6; i++) {
        batcher.add('luz', withColor(
          transform(makeBox(1.0, 0.7, 0.2, { uvScale: 0.5 }),
            px + (i % 3 - 1) * 1.15, terrainHeight(px, pz) + hgt + 0.6 + Math.floor(i / 3) * 0.8, pz,
            Math.atan2(-sx, -sz)),
          new THREE.Color(0xfff6e0)))
      }
      ctx.lamps.push({ x: px, y: terrainHeight(px, pz) + hgt, z: pz })
    }
  }
}

function addPitchMarkings(
  batcher: GeometryBatcher, cx: number, cz: number, y: number,
  halfLength: number, halfWidth: number, yaw: number,
): void {
  const put = (lx: number, lz: number, w: number, d: number) => {
    const g = makeBox(w, 0.02, d, { uvScale: 1 })
    const wx = cx + lx * Math.cos(yaw) - lz * Math.sin(yaw)
    const wz = cz + lx * Math.sin(yaw) + lz * Math.cos(yaw)
    batcher.add('faixa', withColor(transform(g, wx, y + 0.05, wz, yaw), BRANCO))
  }
  const t = 0.12
  put(0, -halfWidth, halfLength * 2, t)
  put(0, halfWidth, halfLength * 2, t)
  put(-halfLength, 0, t, halfWidth * 2)
  put(halfLength, 0, t, halfWidth * 2)
  put(0, 0, t, halfWidth * 2) // linha de meio
  // Círculo central
  const segs = 28
  const r = Math.min(halfWidth * 0.36, 9.15)
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2
    const px = Math.cos(a0) * r
    const pz = Math.sin(a0) * r
    const g = makeBox((Math.PI * 2 * r) / segs + 0.05, 0.02, t, { uvScale: 1 })
    const wx = cx + px * Math.cos(yaw) - pz * Math.sin(yaw)
    const wz = cz + px * Math.sin(yaw) + pz * Math.cos(yaw)
    batcher.add('faixa', withColor(transform(g, wx, y + 0.05, wz, yaw + a0 + Math.PI / 2), BRANCO))
  }
  // Grandes áreas
  const boxL = Math.min(halfLength * 0.22, 16.5)
  const boxW = Math.min(halfWidth * 0.75, 20.16)
  for (const s of [-1, 1]) {
    put(s * (halfLength - boxL), 0, t, boxW * 2)
    put(s * (halfLength - boxL / 2), -boxW, boxL, t)
    put(s * (halfLength - boxL / 2), boxW, boxL, t)
  }
}

function addGoals(batcher: GeometryBatcher, collision: CollisionWorld, owner: string, spec: PitchSpec): void {
  const postR = spec.kind === 'quadra' ? 0.05 : 0.06
  for (const side of [-1, 1]) {
    const gx = side * spec.halfLength
    for (const p of [-1, 1]) {
      const lz = p * (spec.goalWidth / 2)
      const wx = spec.x + gx * Math.cos(spec.yaw) - lz * Math.sin(spec.yaw)
      const wz = spec.z + gx * Math.sin(spec.yaw) + lz * Math.cos(spec.yaw)
      batcher.add('plastico', withColor(
        transform(makeCylinder(postR, spec.goalHeight, 8, 0.5), wx, spec.y + spec.goalHeight / 2, wz), BRANCO))
      collision.add({ x: wx, y: spec.y + spec.goalHeight / 2, z: wz },
        { x: postR * 1.4, y: spec.goalHeight / 2, z: postR * 1.4 }, 0, 'trave', owner)
    }
    // Travessão
    const bar = makeCylinder(postR, spec.goalWidth, 8, 0.5)
    bar.rotateX(Math.PI / 2)
    const bx = spec.x + gx * Math.cos(spec.yaw)
    const bz = spec.z + gx * Math.sin(spec.yaw)
    batcher.add('plastico', withColor(transform(bar, bx, spec.y + spec.goalHeight, bz, spec.yaw), BRANCO))
    collision.add({ x: bx, y: spec.y + spec.goalHeight, z: bz },
      { x: postR * 1.4, y: postR * 1.4, z: spec.goalWidth / 2 }, spec.yaw, 'trave', owner)

    // Rede: plano traseiro e laterais
    const depth = spec.kind === 'quadra' ? 1.1 : 1.8
    const backX = gx + side * depth
    const bwx = spec.x + backX * Math.cos(spec.yaw)
    const bwz = spec.z + backX * Math.sin(spec.yaw)
    batcher.add('rede', withColor(
      transform(makeBox(0.04, spec.goalHeight, spec.goalWidth, { uvScale: 0.4 }), bwx, spec.y + spec.goalHeight / 2, bwz, spec.yaw),
      new THREE.Color(0xf2f2f2)))
    for (const p of [-1, 1]) {
      const lz = p * (spec.goalWidth / 2)
      const mx = gx + (side * depth) / 2
      const wx = spec.x + mx * Math.cos(spec.yaw) - lz * Math.sin(spec.yaw)
      const wz = spec.z + mx * Math.sin(spec.yaw) + lz * Math.cos(spec.yaw)
      batcher.add('rede', withColor(
        transform(makeBox(depth, spec.goalHeight, 0.04, { uvScale: 0.4 }), wx, spec.y + spec.goalHeight / 2, wz, spec.yaw),
        new THREE.Color(0xf2f2f2)))
    }
  }
}

function addFenceRect(
  batcher: GeometryBatcher, collision: CollisionWorld, owner: string,
  cx: number, cz: number, w: number, d: number, h: number, _yaw: number,
): void {
  const col = new THREE.Color(0xd8dde0)
  const sides: [number, number, number, number][] = [
    [cx, cz - d / 2, w, 0.12],
    [cx, cz + d / 2, w, 0.12],
    [cx - w / 2, cz, 0.12, d],
    [cx + w / 2, cz, 0.12, d],
  ]
  for (const [px, pz, sw, sd] of sides) {
    const y = terrainHeight(px, pz)
    batcher.add('rede', withColor(transform(makeBox(sw, h, sd, { uvScale: 0.6 }), px, y + h / 2, pz), col))
    collision.add({ x: px, y: y + h / 2, z: pz }, { x: sw / 2 + 0.05, y: h / 2, z: sd / 2 + 0.05 }, 0, 'cerca', owner)
  }
}

function buildEstacionamento(block: Block, batcher: GeometryBatcher, ctx: PropContext, rng: Rng, detail: NivelDetalhe): void {
  const { cx, cz, width: w, depth: d } = block
  groundQuad(batcher, 'asfalto', cx, cz, w, d, 6, new THREE.Color(0xffffff))
  if (detail === 'baixo') return
  const rows = Math.floor(d / 6)
  for (let r = 0; r < rows; r++) {
    const z = cz - d / 2 + 3 + r * 6
    const slots = Math.floor(w / 2.6)
    for (let s = 0; s <= slots; s++) {
      const x = cx - w / 2 + s * 2.6
      const g = makeBox(0.1, 0.02, 4.8, { uvScale: 1 })
      batcher.add('faixa', withColor(transform(g, x, terrainHeight(x, z) + 0.04, z), new THREE.Color(0xe8e4da)))
    }
  }
  for (let i = 0; i < 3; i++) {
    addStreetLight(ctx, cx + randRange(rng, -w / 2 + 3, w / 2 - 3), cz + randRange(rng, -d / 2 + 3, d / 2 - 3), rng() * 6.28)
  }
}

function buildVazio(block: Block, batcher: GeometryBatcher, ctx: PropContext, rng: Rng, detail: NivelDetalhe): void {
  const { cx, cz, width: w, depth: d } = block
  groundQuad(batcher, 'grama', cx, cz, w, d, 5, new THREE.Color(0xffffff))
  if (detail === 'baixo') return
  const n = randInt(rng, 0, Math.max(1, Math.floor((w * d) / 260)))
  for (let i = 0; i < n; i++) {
    addTree(ctx, cx + randRange(rng, -w / 2, w / 2), cz + randRange(rng, -d / 2, d / 2), rng, randRange(rng, 0.8, 1.3))
  }
}
