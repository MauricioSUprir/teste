/**
 * Geração procedural de veículos.
 *
 * A carroceria é construída por lofting: uma sequência de seções transversais
 * (retângulos arredondados) ao longo do comprimento, interpoladas para formar
 * capô, cabine e traseira com silhueta convincente. Sobre ela entram vidros,
 * colunas, para-choques, faróis, grade, retrovisores e rodas.
 */

import * as THREE from 'three'
import { clamp, lerp, makeRng, pick } from '../core/math'
import { makeBox, makeCylinder, mergeGeometries, transform, withColor } from '../world/geometry'
import { PALETTE } from '../world/materials'

export type VehicleClass = 'hatch' | 'sedan' | 'suv' | 'picape' | 'van' | 'esportivo' | 'taxi' | 'onibus'

export interface Section {
  /** Posição ao longo do comprimento (metros, + = frente). */
  z: number
  halfWidth: number
  yBottom: number
  yTop: number
  /** Raio de arredondamento dos cantos. */
  radius: number
}

export interface VehicleSpec {
  classe: VehicleClass
  nome: string
  comprimento: number
  largura: number
  altura: number
  /** Distância entre eixos. */
  entreEixos: number
  raioRoda: number
  larguraRoda: number
  cor: number
  corSecundaria: number
  corVidro: number
  /** Massa em kg. */
  massa: number
  /** Potência relativa (afeta aceleração). */
  potencia: number
  /** Aderência lateral relativa. */
  aderencia: number
  /** Assentos: posição local de cada lugar. */
  assentos: { x: number; y: number; z: number }[]
  seed: number
}

const NOMES: Record<VehicleClass, string[]> = {
  hatch: ['Corina 1.0', 'Pulse SL', 'Vento GT', 'Brisa 1.4'],
  sedan: ['Aurora LX', 'Marlim SE', 'Coral 2.0', 'Delta Prime'],
  suv: ['Serra XT', 'Pampa 4x4', 'Cume Sport', 'Trilha LE'],
  picape: ['Bandeira D20', 'Bruta 4x4', 'Carga 1500'],
  van: ['Furgão 9', 'Transporte VP', 'Entrega Max'],
  esportivo: ['Falcão GTR', 'Raio V8', 'Lâmina RS'],
  taxi: ['Aurora LX Táxi', 'Marlim Táxi'],
  onibus: ['Urbano 12m', 'Linha 204'],
}

/** Dimensões e caráter de cada classe. */
export function makeVehicleSpec(classe: VehicleClass, seed: number): VehicleSpec {
  const rng = makeRng(seed)
  const base = {
    hatch: { c: 3.98, l: 1.74, a: 1.47, ee: 2.52, rr: 0.31, m: 1050, p: 1.0, ad: 1.0 },
    sedan: { c: 4.64, l: 1.82, a: 1.46, ee: 2.70, rr: 0.33, m: 1300, p: 1.15, ad: 1.05 },
    suv: { c: 4.55, l: 1.86, a: 1.72, ee: 2.68, rr: 0.36, m: 1620, p: 1.12, ad: 0.94 },
    picape: { c: 5.30, l: 1.92, a: 1.82, ee: 3.12, rr: 0.38, m: 1950, p: 1.10, ad: 0.90 },
    van: { c: 5.10, l: 1.95, a: 2.20, ee: 3.20, rr: 0.35, m: 2050, p: 0.95, ad: 0.86 },
    esportivo: { c: 4.42, l: 1.90, a: 1.24, ee: 2.62, rr: 0.34, m: 1380, p: 1.75, ad: 1.28 },
    taxi: { c: 4.64, l: 1.82, a: 1.46, ee: 2.70, rr: 0.33, m: 1340, p: 1.10, ad: 1.02 },
    onibus: { c: 11.8, l: 2.50, a: 3.10, ee: 6.0, rr: 0.50, m: 12000, p: 0.70, ad: 0.80 },
  }[classe]

  const cor = classe === 'taxi' ? 0xe8b22a : pick(rng, PALETTE.carros)
  const spec: VehicleSpec = {
    classe,
    nome: pick(rng, NOMES[classe]),
    comprimento: base.c * lerp(0.97, 1.03, rng()),
    largura: base.l,
    altura: base.a,
    entreEixos: base.ee,
    raioRoda: base.rr,
    larguraRoda: classe === 'onibus' ? 0.30 : 0.22,
    cor,
    corSecundaria: classe === 'taxi' ? 0x1a1a1a : new THREE.Color(cor).multiplyScalar(0.55).getHex(),
    corVidro: 0x2a3c48,
    massa: base.m,
    potencia: base.p * lerp(0.94, 1.06, rng()),
    aderencia: base.ad,
    assentos: [],
    seed,
  }

  const half = spec.comprimento / 2
  if (classe === 'onibus') {
    spec.assentos.push({ x: -0.62, y: 0.95, z: half - 1.6 })
  } else {
    spec.assentos.push({ x: -0.36, y: spec.altura * 0.40, z: 0.16 })
    spec.assentos.push({ x: 0.36, y: spec.altura * 0.40, z: 0.16 })
    if (classe !== 'esportivo') {
      spec.assentos.push({ x: -0.40, y: spec.altura * 0.40, z: -0.72 })
      spec.assentos.push({ x: 0.40, y: spec.altura * 0.40, z: -0.72 })
    }
  }
  return spec
}

/** Perfil do corpo (parte inferior) por classe. */
function bodySections(s: VehicleSpec): Section[] {
  const h = s.comprimento / 2
  const w = s.largura / 2
  const rideH = s.classe === 'suv' || s.classe === 'picape' ? 0.26 : s.classe === 'esportivo' ? 0.13 : 0.19
  const beltline = s.classe === 'esportivo' ? s.altura * 0.60 : s.altura * 0.56

  const p = (t: number, hw: number, yb: number, yt: number, r = 0.16): Section =>
    ({ z: t * h, halfWidth: hw * w, yBottom: yb, yTop: yt, radius: r })

  switch (s.classe) {
    case 'picape':
      return [
        p(-1.00, 0.90, rideH + 0.10, beltline * 0.92, 0.10),
        p(-0.86, 0.98, rideH, beltline * 0.98, 0.12),
        p(-0.30, 1.00, rideH, beltline, 0.14),
        p(-0.10, 1.00, rideH, beltline, 0.14),
        p(0.34, 1.00, rideH, beltline, 0.16),
        p(0.78, 0.98, rideH + 0.02, beltline * 0.94, 0.18),
        p(0.94, 0.90, rideH + 0.08, beltline * 0.86, 0.20),
        p(1.00, 0.80, rideH + 0.14, beltline * 0.80, 0.18),
      ]
    case 'van': case 'onibus':
      return [
        p(-1.00, 0.92, rideH + 0.06, s.altura * 0.94, 0.12),
        p(-0.90, 1.00, rideH, s.altura * 0.97, 0.14),
        p(0.00, 1.00, rideH, s.altura, 0.16),
        p(0.86, 1.00, rideH, s.altura * 0.97, 0.16),
        p(1.00, 0.94, rideH + 0.06, s.altura * 0.88, 0.16),
      ]
    case 'esportivo':
      return [
        p(-1.00, 0.86, rideH + 0.06, beltline * 0.84, 0.14),
        p(-0.82, 0.98, rideH, beltline * 0.94, 0.16),
        p(-0.30, 1.00, rideH, beltline, 0.18),
        p(0.18, 1.00, rideH, beltline * 0.99, 0.18),
        p(0.64, 0.98, rideH, beltline * 0.90, 0.18),
        p(0.90, 0.90, rideH + 0.02, beltline * 0.80, 0.16),
        p(1.00, 0.78, rideH + 0.06, beltline * 0.72, 0.14),
      ]
    default:
      return [
        p(-1.00, 0.84, rideH + 0.08, beltline * 0.88, 0.16),
        p(-0.90, 0.96, rideH + 0.02, beltline * 0.96, 0.18),
        p(-0.55, 1.00, rideH, beltline, 0.20),
        p(0.00, 1.00, rideH, beltline, 0.20),
        p(0.52, 1.00, rideH, beltline * 0.99, 0.20),
        p(0.86, 0.96, rideH + 0.02, beltline * 0.92, 0.18),
        p(1.00, 0.86, rideH + 0.08, beltline * 0.84, 0.16),
      ]
  }
}

/** Perfil da cabine (estufa envidraçada). */
function cabinSections(s: VehicleSpec): Section[] {
  const h = s.comprimento / 2
  const w = s.largura / 2
  const belt = s.classe === 'esportivo' ? s.altura * 0.60 : s.altura * 0.56
  const roof = s.altura
  const p = (t: number, hw: number, yt: number, r = 0.14): Section =>
    ({ z: t * h, halfWidth: hw * w, yBottom: belt - 0.02, yTop: yt, radius: r })

  switch (s.classe) {
    case 'picape':
      return [p(-0.16, 0.82, belt + 0.02, 0.10), p(-0.06, 0.92, roof * 0.97), p(0.34, 0.92, roof), p(0.62, 0.84, belt + 0.06, 0.10)]
    case 'van':
      return [p(-0.92, 0.94, roof * 0.99), p(0.62, 0.94, roof), p(0.90, 0.86, belt + 0.10, 0.10)]
    case 'onibus':
      return [p(-0.96, 0.96, roof * 0.99), p(0.88, 0.96, roof), p(0.99, 0.92, roof * 0.94, 0.10)]
    case 'esportivo':
      return [p(-0.52, 0.80, belt + 0.02, 0.10), p(-0.30, 0.90, roof * 0.98), p(0.12, 0.90, roof), p(0.52, 0.78, belt + 0.04, 0.10)]
    default:
      return [p(-0.62, 0.84, belt + 0.02, 0.10), p(-0.46, 0.94, roof * 0.97), p(0.10, 0.94, roof), p(0.42, 0.92, roof * 0.96), p(0.66, 0.80, belt + 0.03, 0.10)]
  }
}

/** Amostra um retângulo arredondado em N pontos, no sentido horário. */
function roundedRect(hw: number, yB: number, yT: number, r: number, samples: number): [number, number][] {
  const hh = (yT - yB) / 2
  const cy = (yT + yB) / 2
  const rr = Math.min(r, hw * 0.92, hh * 0.92)
  const pts: [number, number][] = []
  for (let i = 0; i < samples; i++) {
    const a = (i / samples) * Math.PI * 2
    // Superelipse: aproxima um retângulo arredondado com custo baixo.
    const n = lerp(2.2, 6.5, clamp(1 - rr / Math.min(hw, hh), 0, 1))
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    const x = Math.sign(ca) * Math.pow(Math.abs(ca), 2 / n) * hw
    const y = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / n) * hh
    pts.push([x, cy + y])
  }
  return pts
}

/** Loft entre seções, produzindo um tubo fechado. */
function loft(sections: Section[], samples = 20, capFront = true, capBack = true): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  const rings = sections.map((s) => roundedRect(s.halfWidth, s.yBottom, s.yTop, s.radius, samples))

  for (let i = 0; i < sections.length; i++) {
    const z = sections[i].z
    for (let k = 0; k < samples; k++) {
      const [x, y] = rings[i][k]
      positions.push(x, y, z)
      normals.push(0, 0, 0)
      uvs.push(k / samples, i / (sections.length - 1))
    }
  }
  for (let i = 0; i < sections.length - 1; i++) {
    for (let k = 0; k < samples; k++) {
      const k2 = (k + 1) % samples
      const a = i * samples + k
      const b = i * samples + k2
      const c = (i + 1) * samples + k
      const d = (i + 1) * samples + k2
      indices.push(a, c, b, b, c, d)
    }
  }
  const cap = (index: number, front: boolean) => {
    const center = positions.length / 3
    const s = sections[index]
    positions.push(0, (s.yTop + s.yBottom) / 2, s.z)
    normals.push(0, 0, front ? 1 : -1)
    uvs.push(0.5, 0.5)
    for (let k = 0; k < samples; k++) {
      const k2 = (k + 1) % samples
      const a = index * samples + k
      const b = index * samples + k2
      if (front) indices.push(center, a, b)
      else indices.push(center, b, a)
    }
  }
  if (capBack) cap(0, false)
  if (capFront) cap(sections.length - 1, true)

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

export interface VehicleMeshes {
  /** Carroceria pintada (inclui colunas e detalhes na cor do carro). */
  corpo: THREE.BufferGeometry
  vidros: THREE.BufferGeometry
  cromados: THREE.BufferGeometry
  escuros: THREE.BufferGeometry
  /** Faróis (material emissivo controlado em tempo real). */
  farois: THREE.BufferGeometry
  lanternas: THREE.BufferGeometry
  /** Roda única, instanciada quatro vezes. */
  roda: THREE.BufferGeometry
  /** Posições locais das rodas. */
  posicoesRodas: { x: number; y: number; z: number; dianteira: boolean }[]
}

/** Constrói todas as malhas de um veículo a partir da ficha. */
/**
 * Monta a geometria de um veículo.
 *
 * `simples` é a versão de carro parado: mesma carroceria e mesma cabine — a
 * silhueta é o que se enxerga — mas com roda mais barata e sem os miúdos que
 * ninguém distingue num carro encostado no meio-fio (retrovisor, maçaneta,
 * vinco de porta, raio de roda).
 */
export function buildVehicleMeshes(spec: VehicleSpec, simples = false): VehicleMeshes {
  const rng = makeRng(spec.seed ^ 0x77)
  const corpoParts: THREE.BufferGeometry[] = []
  const vidroParts: THREE.BufferGeometry[] = []
  const cromoParts: THREE.BufferGeometry[] = []
  const escuroParts: THREE.BufferGeometry[] = []
  const farolParts: THREE.BufferGeometry[] = []
  const lanternaParts: THREE.BufferGeometry[] = []

  const cor = new THREE.Color(spec.cor)
  const cor2 = new THREE.Color(spec.corSecundaria)
  const vidro = new THREE.Color(spec.corVidro)
  const preto = new THREE.Color(0x15181b)
  const cromo = new THREE.Color(0xc8ccd0)

  const half = spec.comprimento / 2
  const w = spec.largura / 2

  // Carroceria
  corpoParts.push(withColor(loft(bodySections(spec), 22), cor))

  // Cabine: vidro por fora, teto pintado por cima
  const cabin = cabinSections(spec)
  vidroParts.push(withColor(loft(cabin, 20, true, true), vidro))
  const roofSections = cabin
    .filter((s) => s.yTop > spec.altura * 0.9)
    .map((s) => ({ ...s, yBottom: s.yTop - 0.10, halfWidth: s.halfWidth * 0.985 }))
  if (roofSections.length >= 2) corpoParts.push(withColor(loft(roofSections, 20), cor))

  // Colunas (A, B, C) — barras finas na cor do carro
  for (const s of cabin) {
    if (s.yTop < spec.altura * 0.9) continue
    void s
  }
  const pillarAt = (z: number, hw: number, yBot: number, yTop: number, tilt: number) => {
    for (const side of [-1, 1]) {
      const g = makeBox(0.075, Math.hypot(yTop - yBot, 0.02), 0.085, { uvScale: 1 })
      transform(g, side * hw, (yTop + yBot) / 2, z, 0)
      g.rotateX(tilt)
      corpoParts.push(withColor(g, cor))
    }
  }
  const belt = spec.classe === 'esportivo' ? spec.altura * 0.60 : spec.altura * 0.56
  if (spec.classe !== 'onibus') {
    pillarAt(cabin[0].z + 0.06, w * 0.86, belt, spec.altura * 0.97, 0)
    pillarAt(cabin[cabin.length - 1].z - 0.06, w * 0.84, belt, spec.altura * 0.96, 0)
    if (cabin.length > 3) pillarAt((cabin[1].z + cabin[2].z) / 2, w * 0.93, belt, spec.altura * 0.99, 0)
  }

  // Para-choques
  const bumper = (z: number, front: boolean) => {
    const g = makeBox(spec.largura * 0.98, 0.26, 0.24, { uvScale: 1 })
    escuroParts.push(withColor(transform(g, 0, 0.42, z), front ? cor : cor))
    const lip = makeBox(spec.largura * 0.92, 0.10, 0.16, { uvScale: 1 })
    escuroParts.push(withColor(transform(lip, 0, 0.28, z + (front ? 0.02 : -0.02)), preto))
  }
  if (spec.classe !== 'onibus') {
    bumper(half - 0.10, true)
    bumper(-half + 0.10, false)
  }

  // Grade frontal
  const grillW = spec.largura * (spec.classe === 'esportivo' ? 0.62 : 0.52)
  escuroParts.push(withColor(
    transform(makeBox(grillW, 0.20, 0.06, { uvScale: 1 }), 0, 0.70, half - 0.04), preto))
  cromoParts.push(withColor(
    transform(makeBox(grillW + 0.10, 0.05, 0.05, { uvScale: 1 }), 0, 0.82, half - 0.02), cromo))

  // Faróis e lanternas
  const lampW = spec.largura * 0.20
  for (const side of [-1, 1]) {
    farolParts.push(withColor(
      transform(makeBox(lampW, 0.15, 0.08, { uvScale: 1 }), side * w * 0.68, 0.78, half - 0.03),
      new THREE.Color(0xfff4de)))
    lanternaParts.push(withColor(
      transform(makeBox(lampW * 1.05, 0.17, 0.07, { uvScale: 1 }), side * w * 0.70, 0.82, -half + 0.03),
      new THREE.Color(0xd8262a)))
  }

  // Retrovisores
  if (spec.classe !== 'onibus' && !simples) {
    for (const side of [-1, 1]) {
      const arm = makeBox(0.10, 0.05, 0.06, { uvScale: 1 })
      corpoParts.push(withColor(transform(arm, side * (w + 0.05), belt + 0.10, cabin[1].z + 0.15), cor))
      const cap = makeBox(0.19, 0.12, 0.09, { uvScale: 1 })
      corpoParts.push(withColor(transform(cap, side * (w + 0.16), belt + 0.12, cabin[1].z + 0.15), cor))
      const mir = makeBox(0.15, 0.09, 0.02, { uvScale: 1 })
      cromoParts.push(withColor(transform(mir, side * (w + 0.19), belt + 0.12, cabin[1].z + 0.14), cromo))
    }
  }

  // Vincos de porta e maçanetas
  if (spec.classe !== 'onibus' && !simples) {
    for (const side of [-1, 1]) {
      const doorZ = spec.classe === 'esportivo' ? [0.1] : [0.42, -0.62]
      for (const dz of doorZ) {
        escuroParts.push(withColor(
          transform(makeBox(0.02, 0.05, 0.86, { uvScale: 1 }), side * (w + 0.005), belt * 0.62, dz), cor2))
        cromoParts.push(withColor(
          transform(makeBox(0.03, 0.04, 0.14, { uvScale: 1 }), side * (w + 0.02), belt * 0.80, dz + 0.30), cromo))
      }
    }
  }

  // Caçamba da picape
  if (spec.classe === 'picape') {
    const bedZ = -half * 0.55
    const bedLen = spec.comprimento * 0.36
    for (const [ox, oz, sx, sz] of [
      [-w * 0.98, bedZ, 0.06, bedLen / 2],
      [w * 0.98, bedZ, 0.06, bedLen / 2],
      [0, bedZ - bedLen / 2, w, 0.06],
    ] as const) {
      corpoParts.push(withColor(
        transform(makeBox(sx * 2, 0.36, sz * 2, { uvScale: 1 }), ox, belt + 0.18, oz), cor))
    }
  }

  // Ônibus: janelas laterais em faixa
  if (spec.classe === 'onibus') {
    for (const side of [-1, 1]) {
      vidroParts.push(withColor(
        transform(makeBox(0.04, 1.0, spec.comprimento * 0.82, { uvScale: 1 }), side * (w + 0.01), spec.altura * 0.66, -0.4),
        vidro))
    }
    escuroParts.push(withColor(
      transform(makeBox(0.10, 1.9, 1.1, { uvScale: 1 }), w, spec.altura * 0.42, half - 1.9), preto))
  }

  // Roda: pneu + aro + calota
  const tire = makeCylinder(spec.raioRoda, spec.larguraRoda, simples ? 12 : 18, 0.5)
  tire.rotateZ(Math.PI / 2)
  const rim = makeCylinder(spec.raioRoda * 0.62, spec.larguraRoda + 0.012, simples ? 9 : 14, 0.4)
  rim.rotateZ(Math.PI / 2)
  const rodaParts = [
    withColor(tire, new THREE.Color(0x1a1c1e)),
    withColor(rim, new THREE.Color(0xb9bdc2)),
  ]
  for (let i = 0; i < (simples ? 0 : 5); i++) {
    const a = (i / 5) * Math.PI * 2
    const spoke = makeBox(spec.larguraRoda + 0.02, spec.raioRoda * 0.10, spec.raioRoda * 1.0, { uvScale: 1 })
    spoke.rotateX(a)
    rodaParts.push(withColor(spoke, new THREE.Color(0xa8adb3)))
  }
  const roda = mergeGeometries(rodaParts) ?? new THREE.BufferGeometry()

  const axleFront = spec.entreEixos / 2
  const trackHalf = w - spec.larguraRoda * 0.55
  const posicoesRodas = [
    { x: -trackHalf, y: spec.raioRoda, z: axleFront, dianteira: true },
    { x: trackHalf, y: spec.raioRoda, z: axleFront, dianteira: true },
    { x: -trackHalf, y: spec.raioRoda, z: -axleFront, dianteira: false },
    { x: trackHalf, y: spec.raioRoda, z: -axleFront, dianteira: false },
  ]

  // Para-lamas escurecidos ao redor das rodas
  for (const p of posicoesRodas) {
    const arch = makeCylinder(spec.raioRoda * 1.22, 0.05, 16, 0.5)
    arch.rotateZ(Math.PI / 2)
    escuroParts.push(withColor(transform(arch, p.x * 1.02, p.y, p.z), preto))
  }

  void rng
  return {
    corpo: mergeGeometries(corpoParts) ?? new THREE.BufferGeometry(),
    vidros: mergeGeometries(vidroParts) ?? new THREE.BufferGeometry(),
    cromados: mergeGeometries(cromoParts) ?? new THREE.BufferGeometry(),
    escuros: mergeGeometries(escuroParts) ?? new THREE.BufferGeometry(),
    farois: mergeGeometries(farolParts) ?? new THREE.BufferGeometry(),
    lanternas: mergeGeometries(lanternaParts) ?? new THREE.BufferGeometry(),
    roda,
    posicoesRodas,
  }
}
