/**
 * Esqueleto humanoide e malha com pesos de deformação, gerados por código.
 *
 * O corpo é construído como um conjunto de tubos ao longo dos ossos, com raio
 * variável por perfil anatômico. Cada vértice recebe peso do osso que o gerou,
 * misturado com o osso vizinho perto das articulações — o que produz dobras
 * suaves em cotovelos, joelhos e quadril sem precisar de malha importada.
 */

import * as THREE from 'three'
import { clamp, lerp } from '../core/math'

export type BoneName =
  | 'raiz' | 'quadril' | 'lombar' | 'torax' | 'pescoco' | 'cabeca'
  | 'ombroE' | 'bracoE' | 'antebracoE' | 'maoE'
  | 'ombroD' | 'bracoD' | 'antebracoD' | 'maoD'
  | 'coxaE' | 'canelaE' | 'peE' | 'dedosE'
  | 'coxaD' | 'canelaD' | 'peD' | 'dedosD'

export interface BoneDef {
  name: BoneName
  parent: BoneName | null
  /** Posição local em relação ao pai, na pose de repouso (metros, altura 1.75). */
  offset: [number, number, number]
}

/** Hierarquia de referência para 1,75 m de altura. */
export const BONE_DEFS: BoneDef[] = [
  { name: 'raiz', parent: null, offset: [0, 0, 0] },
  { name: 'quadril', parent: 'raiz', offset: [0, 0.94, 0] },
  { name: 'lombar', parent: 'quadril', offset: [0, 0.13, 0] },
  { name: 'torax', parent: 'lombar', offset: [0, 0.16, 0] },
  { name: 'pescoco', parent: 'torax', offset: [0, 0.222, 0] },
  { name: 'cabeca', parent: 'pescoco', offset: [0, 0.092, 0] },

  { name: 'ombroE', parent: 'torax', offset: [0.050, 0.126, 0] },
  { name: 'bracoE', parent: 'ombroE', offset: [0.108, -0.028, 0] },
  { name: 'antebracoE', parent: 'bracoE', offset: [0, -0.295, 0] },
  { name: 'maoE', parent: 'antebracoE', offset: [0, -0.265, 0] },

  { name: 'ombroD', parent: 'torax', offset: [-0.050, 0.126, 0] },
  { name: 'bracoD', parent: 'ombroD', offset: [-0.108, -0.028, 0] },
  { name: 'antebracoD', parent: 'bracoD', offset: [0, -0.295, 0] },
  { name: 'maoD', parent: 'antebracoD', offset: [0, -0.265, 0] },

  { name: 'coxaE', parent: 'quadril', offset: [0.093, -0.04, 0] },
  { name: 'canelaE', parent: 'coxaE', offset: [0, -0.43, 0] },
  { name: 'peE', parent: 'canelaE', offset: [0, -0.42, 0] },
  { name: 'dedosE', parent: 'peE', offset: [0, -0.06, 0.11] },

  { name: 'coxaD', parent: 'quadril', offset: [-0.093, -0.04, 0] },
  { name: 'canelaD', parent: 'coxaD', offset: [0, -0.43, 0] },
  { name: 'peD', parent: 'canelaD', offset: [0, -0.42, 0] },
  { name: 'dedosD', parent: 'peD', offset: [0, -0.06, 0.11] },
]

export const BONE_INDEX: Record<BoneName, number> = (() => {
  const m = {} as Record<BoneName, number>
  BONE_DEFS.forEach((b, i) => { m[b.name] = i })
  return m
})()

/** Parâmetros corporais do editor de personagem. */
export interface BodyShape {
  /** Altura total em metros (1.50 – 2.05). */
  altura: number
  /** Largura dos ombros, multiplicador (0.82 – 1.25). */
  ombros: number
  /** Largura do quadril, multiplicador (0.85 – 1.25). */
  quadril: number
  /** Volume geral de tronco e membros (0.75 – 1.45). */
  corpo: number
  /** Massa muscular aparente nos membros (0.8 – 1.3). */
  musculatura: number
  /** Comprimento relativo das pernas (0.92 – 1.08). */
  pernas: number
  /** Tamanho da cabeça (0.9 – 1.1). */
  cabeca: number
  /** Volume abdominal (0.85 – 1.35). */
  abdomen: number
}

export function defaultBodyShape(): BodyShape {
  return {
    altura: 1.76, ombros: 1, quadril: 1, corpo: 1,
    musculatura: 1, pernas: 1, cabeca: 1, abdomen: 1,
  }
}

export function clampBodyShape(s: BodyShape): BodyShape {
  return {
    altura: clamp(s.altura, 1.5, 2.05),
    ombros: clamp(s.ombros, 0.82, 1.25),
    quadril: clamp(s.quadril, 0.85, 1.25),
    corpo: clamp(s.corpo, 0.75, 1.45),
    musculatura: clamp(s.musculatura, 0.8, 1.3),
    pernas: clamp(s.pernas, 0.92, 1.08),
    cabeca: clamp(s.cabeca, 0.9, 1.1),
    abdomen: clamp(s.abdomen, 0.85, 1.35),
  }
}

/** Calcula os deslocamentos dos ossos para um corpo específico. */
export function boneOffsetsFor(shape: BodyShape): THREE.Vector3[] {
  const s = clampBodyShape(shape)
  const scale = s.altura / 1.75
  const out: THREE.Vector3[] = []
  for (const def of BONE_DEFS) {
    const v = new THREE.Vector3(...def.offset).multiplyScalar(scale)
    switch (def.name) {
      case 'ombroE': case 'ombroD':
        v.x *= s.ombros; break
      case 'bracoE': case 'bracoD':
        v.x *= s.ombros; break
      case 'coxaE': case 'coxaD':
        v.x *= s.quadril
        v.y *= s.pernas
        break
      case 'canelaE': case 'canelaD': case 'peE': case 'peD':
        v.y *= s.pernas; break
      case 'quadril':
        v.y *= lerp(1, s.pernas, 0.75); break
      default: break
    }
    out.push(v)
  }
  return out
}

/** Cria a hierarquia de ossos do Three a partir dos deslocamentos. */
export function buildSkeleton(shape: BodyShape): { bones: THREE.Bone[]; skeleton: THREE.Skeleton; root: THREE.Bone } {
  const offsets = boneOffsetsFor(shape)
  const bones: THREE.Bone[] = BONE_DEFS.map((def, i) => {
    const b = new THREE.Bone()
    b.name = def.name
    b.position.copy(offsets[i])
    return b
  })
  BONE_DEFS.forEach((def, i) => {
    if (def.parent) bones[BONE_INDEX[def.parent]].add(bones[i])
  })
  const root = bones[0]
  root.updateMatrixWorld(true)
  return { bones, skeleton: new THREE.Skeleton(bones), root }
}

// --------------------------------------------------------------------------
// Geração da malha
// --------------------------------------------------------------------------

/** Um trecho tubular do corpo, gerado entre dois ossos. */
interface Segment {
  from: BoneName
  to: BoneName | null
  /** Quanto o tubo avança acima da origem (deltoide, nádega, panturrilha). */
  overhang?: number
  /** Quando `to` é nulo, usa esta extensão local a partir de `from`. */
  extend?: [number, number, number]
  /** Perfil de raio ao longo do segmento (t de 0 a 1). */
  profile: (t: number, shape: BodyShape) => { rx: number; rz: number }
  rings: number
  sides: number
  region: BodyRegion
  capStart?: boolean
  capEnd?: boolean
  /** Junta no início do segmento, para não deixar fenda ao dobrar. */
  jointStart?: number
  /** Escala da junta em (x, y, z) locais do segmento — deltoide é achatado. */
  jointScale?: [number, number, number]
}

export type BodyRegion = 'torso' | 'braco' | 'antebraco' | 'mao' | 'coxa' | 'canela' | 'pe' | 'pescoco' | 'cabeca'

const M = (v: number) => v // legibilidade: metros

function torsoProfile(t: number, s: BodyShape) {
  // Quadril -> tórax: cintura mais estreita, caixa torácica mais larga.
  const w = lerp(M(0.138) * s.quadril, M(0.152) * s.ombros, Math.pow(t, 0.7))
  const waist = 1 - 0.115 * Math.sin(t * Math.PI)
  const belly = 1 + (s.abdomen - 1) * Math.max(0, 1 - Math.abs(t - 0.30) * 2.1)
  const d = lerp(M(0.100) * s.quadril, M(0.114), t) * Math.max(0.62, belly)
  // Ganho de massa aparece sobretudo na profundidade: escalar a largura na
  // mesma proporção produziria troncos em barril.
  return { rx: w * waist * lerp(1, s.corpo, 0.45), rz: d * lerp(1, s.corpo, 0.95) }
}

const SEGMENTS: Segment[] = [
  {
    from: 'quadril', to: 'torax', region: 'torso', rings: 8, sides: 16,
    profile: torsoProfile, capStart: true,
  },
  {
    from: 'torax', to: 'pescoco', region: 'torso', rings: 4, sides: 16,
    // Dos ombros ao pescoço: trapézio descendo até a base do pescoço.
    // A rampa do trapézio evita o efeito de "cilindro com pescoço espetado".
    profile: (t, s) => ({
      rx: lerp(M(0.152) * s.ombros, M(0.068), Math.pow(t, 0.92)) * lerp(1, s.corpo, 0.45),
      rz: lerp(M(0.114), M(0.070), Math.pow(t, 0.80)) * lerp(1, s.corpo, 0.85),
    }),
  },
  {
    from: 'pescoco', to: 'cabeca', region: 'pescoco', rings: 2, sides: 12,
    profile: (t, s) => ({
      rx: lerp(M(0.066), M(0.060), t) * lerp(1, s.corpo, 0.6),
      rz: lerp(M(0.064), M(0.060), t) * lerp(1, s.corpo, 0.6),
    }),
  },
  // Braços: o ombro vira uma esfera (deltóide) e o tubo começa no braço.
  ...(['E', 'D'] as const).flatMap((side): Segment[] => [
    {
      from: `braco${side}` as BoneName, to: `antebraco${side}` as BoneName, region: 'braco',
      rings: 6, sides: 12, overhang: 0.018,
      profile: (t, s) => {
        const biceps = 1 + 0.14 * Math.exp(-Math.pow((t - 0.32) * 3.0, 2)) * (s.musculatura - 0.5)
        const r = lerp(M(0.050), M(0.041), Math.pow(clamp(t, 0, 1), 0.85))
          * s.musculatura * biceps * lerp(1, s.corpo, 0.4)
        return { rx: r, rz: r * 0.95 }
      },
      // Deltoide: elipsoide alargado em X, que costura tórax e braço.
      jointStart: 0.047,
      jointScale: [1.34, 1.02, 0.98],
    },
    {
      from: `antebraco${side}` as BoneName, to: `mao${side}` as BoneName, region: 'antebraco', rings: 5, sides: 12,
      profile: (t, s) => {
        const swell = 1 + 0.16 * Math.exp(-Math.pow((t - 0.15) * 3.2, 2)) * (s.musculatura - 0.5)
        const r = lerp(M(0.043), M(0.028), Math.pow(t, 0.75)) * s.musculatura * swell * lerp(1, s.corpo, 0.4)
        return { rx: r, rz: r * 0.86 }
      },
      jointStart: 0.041,
    },
  ]),
  // Pernas
  ...(['E', 'D'] as const).flatMap((side): Segment[] => [
    {
      from: `coxa${side}` as BoneName, to: `canela${side}` as BoneName, region: 'coxa', rings: 6, sides: 14,
      profile: (t, s) => {
        const bulge = 1 + 0.12 * Math.sin(Math.min(1, t * 1.25) * Math.PI) * (s.musculatura - 0.45)
        const r = lerp(M(0.098), M(0.062), Math.pow(t, 0.8)) * s.corpo * bulge
        return { rx: r, rz: r * 1.03 }
      },
      jointStart: 0.092,
    },
    {
      from: `canela${side}` as BoneName, to: `pe${side}` as BoneName, region: 'canela', rings: 6, sides: 14,
      profile: (t, s) => {
        const calf = 1 + 0.26 * Math.exp(-Math.pow((t - 0.20) * 3.2, 2)) * (s.musculatura - 0.35)
        const r = lerp(M(0.060), M(0.036), Math.pow(t, 0.85)) * s.corpo * calf
        return { rx: r, rz: r * 0.94 }
      },
      jointStart: 0.060,
    },
    {
      // Só o tornozelo é tubular; o pé em si é modelado em blocos.
      from: `pe${side}` as BoneName, to: `dedos${side}` as BoneName, region: 'pe', rings: 2, sides: 10,
      profile: (t) => ({ rx: M(0.037) - t * 0.002, rz: M(0.040) - t * 0.002 }),
      capStart: true, jointStart: 0.038,
    },
  ]),
]

export interface BuiltBody {
  geometry: THREE.BufferGeometry
  /** Índice de região por vértice, para mapear pele e roupas. */
  regions: Uint8Array
  regionNames: BodyRegion[]
}

const REGION_ORDER: BodyRegion[] = ['torso', 'braco', 'antebraco', 'mao', 'coxa', 'canela', 'pe', 'pescoco', 'cabeca']

/**
 * Gera a malha do corpo em pose de repouso com índices e pesos de deformação.
 *
 * - `inflate` engorda o perfil (usado para gerar roupas sobre o corpo).
 * - `only` restringe as regiões geradas.
 * - `cuts` limita a faixa `[de, até]` de um segmento (manga curta, bermuda,
 *   meião), sempre alinhada a anéis inteiros, o que evita bordas serrilhadas.
 */
export function buildBodyGeometry(
  shape: BodyShape,
  inflate = 0,
  only?: ReadonlySet<BodyRegion>,
  cuts?: Partial<Record<BodyRegion, [number, number]>>,
): BuiltBody {
  const s = clampBodyShape(shape)
  const offsets = boneOffsetsFor(s)

  const rest: THREE.Vector3[] = []
  BONE_DEFS.forEach((def, i) => {
    const p = offsets[i].clone()
    if (def.parent) p.add(rest[BONE_INDEX[def.parent]])
    rest.push(p)
  })

  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const skinIndices: number[] = []
  const skinWeights: number[] = []
  const regions: number[] = []
  const indices: number[] = []
  /** Oclusão pintada por vértice: escurece dobras, axilas e vincos. */
  const colors: number[] = []
  const scale = s.altura / 1.75

  /** Junta elipsoidal: preenche a dobra e liga o membro ao tronco. */
  const addJoint = (
    center: THREE.Vector3, radius: number, boneIdx: number, regionId: number,
    sx = 1, sy = 1, sz = 1,
  ) => {
    const LATJ = 6, LONJ = 10
    const base = positions.length / 3
    for (let i = 0; i <= LATJ; i++) {
      const phi = (i / LATJ) * Math.PI
      for (let j = 0; j <= LONJ; j++) {
        const theta = (j / LONJ) * Math.PI * 2
        const nx = Math.sin(phi) * Math.cos(theta)
        const ny = Math.cos(phi)
        const nz = Math.sin(phi) * Math.sin(theta)
        positions.push(center.x + nx * radius * sx, center.y + ny * radius * sy, center.z + nz * radius * sz)
        const n = new THREE.Vector3(nx / sx, ny / sy, nz / sz).normalize()
        normals.push(n.x, n.y, n.z)
        uvs.push(j / LONJ, 1 - i / LATJ)
        skinIndices.push(boneIdx, 0, 0, 0)
        skinWeights.push(1, 0, 0, 0)
        regions.push(regionId)
        // A junta é uma concavidade em relação aos tubos vizinhos.
        colors.push(0.90, 0.90, 0.90)
      }
    }
    for (let i = 0; i < LATJ; i++) {
      for (let j = 0; j < LONJ; j++) {
        const a = base + i * (LONJ + 1) + j
        const b = a + 1
        const c = base + (i + 1) * (LONJ + 1) + j
        const d = c + 1
        indices.push(a, b, c, b, d, c)
      }
    }
  }

  for (const seg of SEGMENTS) {
    if (only && !only.has(seg.region)) continue
    const fromIdx = BONE_INDEX[seg.from]
    const a = rest[fromIdx]
    let b: THREE.Vector3
    let toIdx = fromIdx
    if (seg.to) {
      toIdx = BONE_INDEX[seg.to]
      b = rest[toIdx]
    } else {
      b = a.clone().add(new THREE.Vector3(...(seg.extend ?? [0, -0.1, 0])).multiplyScalar(scale))
    }

    let axis = b.clone().sub(a)
    const len = axis.length()
    if (len < 1e-5) continue
    const dir = axis.clone().normalize()
    // O avanço acima da origem cobre deltoide/quadril sem esfera de junta.
    const over = (seg.overhang ?? 0) * scale
    const origin = a.clone().addScaledVector(dir, -over)
    if (over > 0) axis = b.clone().sub(origin)
    const up = Math.abs(dir.y) > 0.92 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0)
    const right = new THREE.Vector3().crossVectors(up, dir).normalize()
    const fwd = new THREE.Vector3().crossVectors(dir, right).normalize()

    const regionId = REGION_ORDER.indexOf(seg.region)

    const cutRange = cuts?.[seg.region]
    const firstRing = cutRange ? Math.min(seg.rings - 1, Math.round(clamp(cutRange[0], 0, 1) * seg.rings)) : 0
    const lastRing = cutRange
      ? Math.max(firstRing + 1, Math.round(clamp(cutRange[1], 0, 1) * seg.rings))
      : seg.rings

    // Junta esférica no início (ombro, cotovelo, joelho, tornozelo).
    // Só entra quando a peça de fato começa na origem do segmento.
    if (seg.jointStart !== undefined && firstRing === 0) {
      const mass = seg.region === 'coxa' || seg.region === 'canela'
        ? lerp(1, s.corpo, 0.8)
        : s.musculatura
      const js = seg.jointScale ?? [1, 1, 1]
      // A roupa engorda menos na junta do que no tubo: aplicar o mesmo valor
      // produziria ombreiras e cotoveleiras que não existem na peça real.
      addJoint(a, (seg.jointStart + inflate * 0.40) * scale * mass, fromIdx, regionId, js[0], js[1], js[2])
    }

    const baseVertex = positions.length / 3
    for (let r = firstRing; r <= lastRing; r++) {
      const t = r / seg.rings
      const center = origin.clone().addScaledVector(axis, t)
      const prof = seg.profile(t, s)
      const rx = (prof.rx + inflate) * scale
      const rz = (prof.rz + inflate) * scale
      const wTo = clamp((t - 0.5) / 0.5, 0, 1) * 0.7
      const wFrom = 1 - wTo

      for (let k = 0; k < seg.sides; k++) {
        const ang = (k / seg.sides) * Math.PI * 2
        const nx = Math.cos(ang)
        const nz = Math.sin(ang)
        positions.push(
          center.x + right.x * nx * rx + fwd.x * nz * rz,
          center.y + right.y * nx * rx + fwd.y * nz * rz,
          center.z + right.z * nx * rx + fwd.z * nz * rz,
        )
        const n = new THREE.Vector3(
          right.x * nx * rz + fwd.x * nz * rx,
          right.y * nx * rz + fwd.y * nz * rx,
          right.z * nx * rz + fwd.z * nz * rx,
        ).normalize()
        normals.push(n.x, n.y, n.z)
        uvs.push(k / seg.sides, t)
        skinIndices.push(fromIdx, toIdx, 0, 0)
        skinWeights.push(wFrom, wTo, 0, 0)
        regions.push(regionId)
        // Escurece perto das pontas do segmento (onde há dobra) e na face
        // interna dos membros, que recebe menos luz do céu.
        const dobra = 1 - Math.min(t, 1 - t) * 2
        const interno = seg.region === 'braco' || seg.region === 'antebraco'
          || seg.region === 'coxa' || seg.region === 'canela'
          ? clamp(-nx * Math.sign(a.x || 1), 0, 1) * 0.10
          : 0
        const ao = clamp(1 - dobra * 0.13 - interno, 0.72, 1)
        colors.push(ao, ao, ao)
      }
    }

    for (let r = firstRing; r < lastRing; r++) {
      const ra = (r - firstRing) * seg.sides
      const rb = (r + 1 - firstRing) * seg.sides
      for (let k = 0; k < seg.sides; k++) {
        const k2 = (k + 1) % seg.sides
        indices.push(
          baseVertex + ra + k, baseVertex + ra + k2, baseVertex + rb + k,
          baseVertex + ra + k2, baseVertex + rb + k2, baseVertex + rb + k,
        )
      }
    }

    const addCap = (ringIndex: number, center: THREE.Vector3, normal: THREE.Vector3, boneIdx: number) => {
      const cIdx = positions.length / 3
      positions.push(center.x, center.y, center.z)
      normals.push(normal.x, normal.y, normal.z)
      uvs.push(0.5, ringIndex === 0 ? 0 : 1)
      skinIndices.push(boneIdx, 0, 0, 0)
      skinWeights.push(1, 0, 0, 0)
      regions.push(regionId)
      colors.push(0.88, 0.88, 0.88)
      const row = (ringIndex - firstRing) * seg.sides
      for (let k = 0; k < seg.sides; k++) {
        const k2 = (k + 1) % seg.sides
        const i0 = baseVertex + row + k
        const i1 = baseVertex + row + k2
        if (ringIndex === firstRing) indices.push(cIdx, i1, i0)
        else indices.push(cIdx, i0, i1)
      }
    }
    // Bordas: tampa onde o segmento começa/termina ou onde a peça foi cortada.
    if (seg.capStart || firstRing > 0) {
      const t0 = firstRing / seg.rings
      addCap(firstRing, origin.clone().addScaledVector(axis, t0), dir.clone().negate(), fromIdx)
    }
    if (seg.capEnd || lastRing < seg.rings) {
      const t1 = lastRing / seg.rings
      addCap(lastRing, origin.clone().addScaledVector(axis, t1), dir.clone(), lastRing === seg.rings ? toIdx : fromIdx)
    }
  }

  // Mãos, pés e cabeça têm forma própria.
  if (!only || only.has('mao')) {
    addHands(s, rest, positions, normals, uvs, skinIndices, skinWeights, regions, indices, inflate, REGION_ORDER.indexOf('mao'), colors)
  }
  if (!only || only.has('pe')) {
    addFeet(s, rest, positions, normals, uvs, skinIndices, skinWeights, regions, indices, inflate, REGION_ORDER.indexOf('pe'), colors)
  }
  if (!only || only.has('cabeca')) {
    addHead(shape, rest, positions, normals, uvs, skinIndices, skinWeights, regions, indices, inflate, colors)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4))
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4))
  if (colors.length === positions.length) {
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  }
  geo.setIndex(indices)
  geo.computeBoundingSphere()

  return { geometry: geo, regions: new Uint8Array(regions), regionNames: REGION_ORDER }
}

/** Emite um paralelepípedo preso a um osso, com normais corretas. */
function pushBlock(
  positions: number[], normals: number[], uvs: number[],
  skinIndices: number[], skinWeights: number[], regions: number[], indices: number[],
  px: number, py: number, pz: number, ex: number, ey: number, ez: number,
  boneIdx: number, regionId: number, colors?: number[], ao = 1,
): void {
  const corners: [number, number, number][] = [
    [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
    [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
  ]
  const faces: [number, number, number, number, [number, number, number]][] = [
    [0, 3, 2, 1, [0, 0, -1]], [4, 5, 6, 7, [0, 0, 1]],
    [0, 1, 5, 4, [0, -1, 0]], [3, 7, 6, 2, [0, 1, 0]],
    [0, 4, 7, 3, [-1, 0, 0]], [1, 2, 6, 5, [1, 0, 0]],
  ]
  for (const [a, b, c, d, n] of faces) {
    const start = positions.length / 3
    for (const ci of [a, b, c, d]) {
      const [sx, sy, sz] = corners[ci]
      positions.push(px + sx * ex, py + sy * ey, pz + sz * ez)
      normals.push(n[0], n[1], n[2])
      uvs.push((sx + 1) / 2, (sy + 1) / 2)
      skinIndices.push(boneIdx, 0, 0, 0)
      skinWeights.push(1, 0, 0, 0)
      regions.push(regionId)
      if (colors) colors.push(ao, ao, ao)
    }
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3)
  }
}

/** Pé descalço: calcanhar, planta e dedos em blocos com proporção humana. */
function addFeet(
  s: BodyShape, rest: THREE.Vector3[],
  positions: number[], normals: number[], uvs: number[],
  skinIndices: number[], skinWeights: number[], regions: number[], indices: number[],
  inflate: number, regionId: number, colors?: number[],
): void {
  const scale = s.altura / 1.75
  for (const side of ['E', 'D'] as const) {
    const footIdx = BONE_INDEX[`pe${side}` as BoneName]
    const o = rest[footIdx]
    const blocks: [number, number, number, number, number, number][] = [
      [0, -0.038, 0.024, 0.040, 0.030, 0.090], // planta
      [0, -0.020, -0.038, 0.036, 0.042, 0.030], // calcanhar
      [0, -0.040, 0.116, 0.036, 0.022, 0.026],  // dedos
    ]
    for (const [cx, cy, cz, hx, hy, hz] of blocks) {
      pushBlock(positions, normals, uvs, skinIndices, skinWeights, regions, indices,
        o.x + cx * scale, o.y + cy * scale, o.z + cz * scale,
        (hx + inflate) * scale, (hy + inflate) * scale, (hz + inflate) * scale,
        footIdx, regionId, colors, 0.94)
    }
  }
}

/** Mão: palma achatada, polegar e bloco dos dedos. */
function addHands(
  s: BodyShape, rest: THREE.Vector3[],
  positions: number[], normals: number[], uvs: number[],
  skinIndices: number[], skinWeights: number[], regions: number[], indices: number[],
  inflate: number, regionId: number, colors?: number[],
): void {
  const scale = s.altura / 1.75
  for (const side of ['E', 'D'] as const) {
    const handIdx = BONE_INDEX[`mao${side}` as BoneName]
    const o = rest[handIdx]
    const sgn = side === 'E' ? 1 : -1
    const blocks: [number, number, number, number, number, number][] = [
      [0, -0.040, 0.002, 0.028, 0.044, 0.018],          // palma
      [0, -0.098, 0.004, 0.025, 0.028, 0.016],          // dedos
      [sgn * 0.028, -0.034, 0.014, 0.011, 0.023, 0.012], // polegar
    ]
    for (const [cx, cy, cz, hx, hy, hz] of blocks) {
      pushBlock(positions, normals, uvs, skinIndices, skinWeights, regions, indices,
        o.x + cx * scale, o.y + cy * scale, o.z + cz * scale,
        (hx + inflate) * scale, (hy + inflate) * scale, (hz + inflate) * scale,
        handIdx, regionId, colors, 0.95)
    }
  }
}

/** Formato da cabeça: crânio, maxilar e queixo em uma malha única. */
export interface FaceShape {
  /** Largura do crânio (0.88 – 1.14). */
  largura: number
  /** Altura/alongamento do rosto (0.9 – 1.12). */
  alongamento: number
  /** Projeção do queixo (0.85 – 1.2). */
  queixo: number
  /** Maçãs do rosto (0.88 – 1.18). */
  macas: number
  /** Projeção do nariz (0.8 – 1.3). */
  nariz: number
  /** Profundidade das órbitas (0.85 – 1.2). */
  orbitas: number
  /** Largura da mandíbula (0.85 – 1.2). */
  mandibula: number
}

export function defaultFaceShape(): FaceShape {
  return { largura: 1, alongamento: 1, queixo: 1, macas: 1, nariz: 1, orbitas: 1, mandibula: 1 }
}

/** Raios do crânio de referência (1,75 m), em metros. */
export const HEAD_RADII = { x: 0.079, y: 0.113, z: 0.098 }
/** Deslocamento do centro do crânio acima do osso da cabeça. */
export const HEAD_CENTER_Y = 0.048

function addHead(
  shape: BodyShape,
  rest: THREE.Vector3[],
  positions: number[], normals: number[], uvs: number[],
  skinIndices: number[], skinWeights: number[], regions: number[], indices: number[],
  inflate: number,
  colors?: number[],
): void {
  const s = clampBodyShape(shape)
  const scale = (s.altura / 1.75) * s.cabeca
  const headIdx = BONE_INDEX['cabeca']
  const origin = rest[headIdx]
  const regionId = REGION_ORDER.indexOf('cabeca')
  const f = defaultFaceShape()

  const LAT = 18
  const LON = 24
  const base = positions.length / 3

  for (let i = 0; i <= LAT; i++) {
    const v = i / LAT
    const phi = v * Math.PI
    for (let j = 0; j <= LON; j++) {
      const u = j / LON
      const theta = u * Math.PI * 2
      const sx = Math.sin(phi) * Math.cos(theta)
      const sy = Math.cos(phi)
      const sz = Math.sin(phi) * Math.sin(theta)

      const down = clamp(-sy, 0, 1)        // metade inferior (maxilar)
      const up = clamp(sy, 0, 1)           // calota craniana
      const front = clamp(sz, 0, 1)        // face
      const back = clamp(-sz, 0, 1)        // nuca
      const lado = Math.abs(sx)

      let rx = (HEAD_RADII.x + inflate) * scale * f.largura
      let ry = (HEAD_RADII.y + inflate) * scale * f.alongamento
      let rz = (HEAD_RADII.z + inflate) * scale

      // Crânio: largo nas parietais, estreitando para o topo.
      rx *= lerp(1, 1.06, Math.sin(phi))
      ry *= 1
      // Mandíbula: estreita e com ângulo, não uma ponta.
      const maxilar = Math.pow(down, 1.35)
      rx *= lerp(1, 0.74 * f.mandibula, maxilar)
      rz *= lerp(1, 0.88, maxilar * 0.7)
      // Testa levemente recuada acima das sobrancelhas.
      if (up > 0.30 && front > 0.25) rz *= lerp(1, 0.94, (up - 0.30) / 0.70)
      // Maçãs do rosto.
      if (front > 0.2 && Math.abs(sy) < 0.42) rx *= lerp(1, f.macas, 0.30)
      // Nuca mais cheia.
      if (back > 0.2) rz *= lerp(1, 1.07, back)

      let px = sx * rx
      let py = sy * ry + HEAD_CENTER_Y * scale
      let pz = sz * rz

      // Arcada supraciliar: pequena saliência acima dos olhos.
      const arcada = front * Math.exp(-Math.pow((sy - 0.30) * 6.5, 2)) * Math.exp(-Math.pow(lado * 2.6, 2))
      pz += arcada * 0.0075 * scale

      // Queixo projetado, com base plana em vez de bico.
      const queixo = front * Math.pow(down, 2.2)
      pz += queixo * 0.030 * scale * f.queixo
      py -= queixo * 0.008 * scale * f.queixo

      // Concavidade das órbitas.
      const orbita = front * Math.exp(-Math.pow((sy - 0.13) * 8.0, 2))
        * Math.exp(-Math.pow((lado - 0.36) * 6.0, 2))
      pz -= orbita * 0.011 * scale * f.orbitas
      // Sulco sob a maçã do rosto.
      const sulco = front * Math.exp(-Math.pow((sy + 0.12) * 7.5, 2))
        * Math.exp(-Math.pow((lado - 0.30) * 5.5, 2))
      pz -= sulco * 0.006 * scale

      // Encontro com o pescoço: a base do crânio se fecha.
      if (sy < -0.58) {
        const blend = (-sy - 0.58) / 0.42
        px = lerp(px, px * 0.64, blend)
        pz = lerp(pz, pz * 0.70, blend)
      }

      positions.push(origin.x + px, origin.y + py, origin.z + pz)
      const n = new THREE.Vector3(px / (rx * rx), (py - HEAD_CENTER_Y * scale) / (ry * ry), pz / (rz * rz)).normalize()
      normals.push(n.x, n.y, n.z)
      uvs.push(u, 1 - v)
      skinIndices.push(headIdx, 0, 0, 0)
      skinWeights.push(1, 0, 0, 0)
      regions.push(regionId)

      if (colors) {
        // Oclusão pintada: sem ela o rosto fica com aparência de manequim.
        let ao = 1
        ao -= orbita * 0.34                                   // órbitas
        ao -= sulco * 0.12                                    // sulco nasogeniano
        ao -= front * Math.exp(-Math.pow((sy + 0.34) * 7.0, 2)) * 0.16  // sob o lábio
        ao -= clamp((-sy - 0.45) / 0.55, 0, 1) * 0.28         // sob o queixo
        ao -= back * up * 0.06                                // nuca
        colors.push(ao, ao, ao)
      }
    }
  }

  for (let i = 0; i < LAT; i++) {
    for (let j = 0; j < LON; j++) {
      const a = base + i * (LON + 1) + j
      const b = a + 1
      const c = base + (i + 1) * (LON + 1) + j
      const d = c + 1
      indices.push(a, b, c, b, d, c)
    }
  }
}

/** Altura do olho acima do chão (usada pela câmera em primeira pessoa). */
export function eyeHeight(shape: BodyShape): number {
  const offsets = boneOffsetsFor(shape)
  let y = 0
  for (const name of ['quadril', 'lombar', 'torax', 'pescoco', 'cabeca'] as BoneName[]) {
    y += offsets[BONE_INDEX[name]].y
  }
  const k = (shape.altura / 1.75) * shape.cabeca
  return y + (HEAD_CENTER_Y + HEAD_RADII.y * 0.10) * k
}

/** Altura total real do modelo (topo da cabeça), para conferência. */
export function modelTopHeight(shape: BodyShape): number {
  const offsets = boneOffsetsFor(shape)
  let y = 0
  for (const name of ['quadril', 'lombar', 'torax', 'pescoco', 'cabeca'] as BoneName[]) {
    y += offsets[BONE_INDEX[name]].y
  }
  const k = (shape.altura / 1.75) * shape.cabeca
  return y + (HEAD_CENTER_Y + HEAD_RADII.y * clampBodyShape(shape).altura / shape.altura) * k
}
