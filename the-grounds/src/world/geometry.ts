/**
 * Utilidades de geometria: caixas com UV em escala de mundo (essenciais para
 * mesclar malhas sem distorcer texturas), prismas, rampas e fusão por material.
 */

import * as THREE from 'three'

export interface BoxFaceOptions {
  /** Metros por repetição da textura. */
  uvScale?: number
  /** Omite faces para economizar triângulos: 'px','nx','py','ny','pz','nz'. */
  skip?: ReadonlySet<string>
  /** Cor de vértice aplicada à caixa inteira. */
  color?: THREE.Color
}

const FACES: { key: string; n: [number, number, number]; u: [number, number, number]; v: [number, number, number] }[] = [
  { key: 'px', n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
  { key: 'nx', n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { key: 'py', n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { key: 'ny', n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  { key: 'pz', n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { key: 'nz', n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
]

/**
 * Caixa centrada na origem com UV proporcional ao tamanho real, de modo que a
 * textura mantenha a mesma escala em qualquer objeto após a fusão de malhas.
 */
export function makeBox(w: number, h: number, d: number, opts: BoxFaceOptions = {}): THREE.BufferGeometry {
  const uvScale = opts.uvScale ?? 1
  const hw = w / 2, hh = h / 2, hd = d / 2
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const colors: number[] = []
  let vi = 0

  for (const f of FACES) {
    if (opts.skip?.has(f.key)) continue
    const [nx, ny, nz] = f.n
    const cx = nx * hw, cy = ny * hh, cz = nz * hd
    // Extensões nos eixos tangentes
    const ux = f.u[0] * hw, uy = f.u[1] * hh, uz = f.u[2] * hd
    const vx = f.v[0] * hw, vy = f.v[1] * hh, vz = f.v[2] * hd
    const uLen = Math.abs(f.u[0]) * w + Math.abs(f.u[1]) * h + Math.abs(f.u[2]) * d
    const vLen = Math.abs(f.v[0]) * w + Math.abs(f.v[1]) * h + Math.abs(f.v[2]) * d
    const su = uLen / uvScale
    const sv = vLen / uvScale

    const corners: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
    for (const [a, b] of corners) {
      positions.push(cx + ux * a + vx * b, cy + uy * a + vy * b, cz + uz * a + vz * b)
      normals.push(nx, ny, nz)
      uvs.push(((a + 1) / 2) * su, ((b + 1) / 2) * sv)
      if (opts.color) colors.push(opts.color.r, opts.color.g, opts.color.b)
    }
    // A ordem dos triângulos precisa concordar com a normal da face: u × v
    // aponta para fora apenas em parte das faces, e inverter aqui evita que
    // topos e bases sumam por descarte de face traseira.
    const cross: [number, number, number] = [
      f.u[1] * f.v[2] - f.u[2] * f.v[1],
      f.u[2] * f.v[0] - f.u[0] * f.v[2],
      f.u[0] * f.v[1] - f.u[1] * f.v[0],
    ]
    const facingOut = cross[0] * nx + cross[1] * ny + cross[2] * nz > 0
    if (facingOut) indices.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3)
    else indices.push(vi, vi + 2, vi + 1, vi, vi + 3, vi + 2)
    vi += 4
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  if (colors.length) geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.setIndex(indices)
  return geo
}

/** Plano horizontal com UV em escala de mundo (piso, calçada, asfalto). */
export function makeGroundQuad(w: number, d: number, uvScale: number, faceUp = true): THREE.BufferGeometry {
  const hw = w / 2, hd = d / 2
  const su = w / uvScale
  const sv = d / uvScale
  const geo = new THREE.BufferGeometry()
  const y = faceUp ? 1 : -1
  geo.setAttribute('position', new THREE.Float32BufferAttribute(
    [-hw, 0, -hd, hw, 0, -hd, hw, 0, hd, -hw, 0, hd], 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(
    [0, y, 0, 0, y, 0, 0, y, 0, 0, y, 0], 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, su, 0, su, sv, 0, sv], 2))
  geo.setIndex(faceUp ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3])
  return geo
}

/**
 * Faixa poligonal seguindo uma polilinha (usada para ruas, calçadas e ciclovia),
 * com a altura amostrada por callback para acompanhar o terreno.
 */
export function makeRibbon(
  points: readonly { x: number; z: number }[],
  halfWidth: number,
  heightAt: (x: number, z: number) => number,
  uvScale: number,
  yOffset = 0,
): THREE.BufferGeometry | null {
  if (points.length < 2) return null
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  let dist = 0

  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    const prev = points[Math.max(0, i - 1)]
    const next = points[Math.min(points.length - 1, i + 1)]
    let dx = next.x - prev.x
    let dz = next.z - prev.z
    const len = Math.hypot(dx, dz) || 1
    dx /= len; dz /= len
    const nx = -dz, nz = dx
    if (i > 0) dist += Math.hypot(p.x - points[i - 1].x, p.z - points[i - 1].z)

    const lx = p.x + nx * halfWidth
    const lz = p.z + nz * halfWidth
    const rx = p.x - nx * halfWidth
    const rz = p.z - nz * halfWidth
    positions.push(lx, heightAt(lx, lz) + yOffset, lz)
    positions.push(rx, heightAt(rx, rz) + yOffset, rz)
    normals.push(0, 1, 0, 0, 1, 0)
    const v = dist / uvScale
    uvs.push(0, v, (halfWidth * 2) / uvScale, v)

    if (i > 0) {
      const a = (i - 1) * 2
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

/** Cilindro com UV em escala de mundo (postes, troncos, traves). */
export function makeCylinder(
  radius: number, height: number, segments = 10, uvScale = 1, capped = true,
): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(radius, radius, height, segments, 1, !capped)
  const uv = geo.attributes.uv as THREE.BufferAttribute
  const circ = Math.PI * 2 * radius
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * (circ / uvScale), uv.getY(i) * (height / uvScale))
  }
  uv.needsUpdate = true
  return geo
}

/** Aplica uma transformação e devolve a mesma geometria (encadeável). */
export function transform(
  geo: THREE.BufferGeometry,
  x: number, y: number, z: number,
  yaw = 0, sx = 1, sy = 1, sz = 1,
): THREE.BufferGeometry {
  const m = new THREE.Matrix4()
  m.compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)),
    new THREE.Vector3(sx, sy, sz),
  )
  geo.applyMatrix4(m)
  return geo
}

/**
 * Acumulador de geometria por material: junta tudo em uma malha por material
 * para manter poucas chamadas de desenho por setor.
 */
export class GeometryBatcher {
  private groups = new Map<string, THREE.BufferGeometry[]>()

  add(materialKey: string, geo: THREE.BufferGeometry): void {
    const g = this.groups.get(materialKey)
    if (g) g.push(geo)
    else this.groups.set(materialKey, [geo])
  }

  get isEmpty(): boolean { return this.groups.size === 0 }

  /** Constrói as malhas finais. `resolve` devolve o material de cada chave. */
  build(resolve: (key: string) => THREE.Material): THREE.Mesh[] {
    const out: THREE.Mesh[] = []
    for (const [key, list] of this.groups) {
      const merged = mergeGeometries(list)
      if (!merged) continue
      merged.computeBoundingSphere()
      const mesh = new THREE.Mesh(merged, resolve(key))
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.name = key
      out.push(mesh)
      for (const g of list) g.dispose()
    }
    this.groups.clear()
    return out
  }
}

/** Fusão de geometrias indexadas com os mesmos atributos (position/normal/uv). */
export function mergeGeometries(list: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  const usable = list.filter((g) => g.attributes.position && g.attributes.position.count > 0)
  if (usable.length === 0) return null
  // Todos os materiais do mundo usam cor de vértice: a ausência do atributo em
  // uma única geometria deixaria o lote inteiro preto, então sempre emitimos.
  const hasColor = true

  let vCount = 0
  let iCount = 0
  for (const g of usable) {
    vCount += g.attributes.position.count
    iCount += g.index ? g.index.count : g.attributes.position.count
  }

  const positions = new Float32Array(vCount * 3)
  const normals = new Float32Array(vCount * 3)
  const uvs = new Float32Array(vCount * 2)
  const colors = hasColor ? new Float32Array(vCount * 3) : null
  const indices = vCount > 65535 ? new Uint32Array(iCount) : new Uint16Array(iCount)

  let vo = 0
  let io = 0
  for (const g of usable) {
    const p = g.attributes.position as THREE.BufferAttribute
    const n = g.attributes.normal as THREE.BufferAttribute | undefined
    const u = g.attributes.uv as THREE.BufferAttribute | undefined
    const c = g.attributes.color as THREE.BufferAttribute | undefined
    positions.set(p.array as Float32Array, vo * 3)
    if (n) normals.set(n.array as Float32Array, vo * 3)
    if (u) uvs.set(u.array as Float32Array, vo * 2)
    if (colors) {
      if (c) colors.set(c.array as Float32Array, vo * 3)
      else colors.fill(1, vo * 3, (vo + p.count) * 3)
    }

    if (g.index) {
      const src = g.index.array
      for (let i = 0; i < src.length; i++) indices[io + i] = src[i] + vo
      io += src.length
    } else {
      for (let i = 0; i < p.count; i++) indices[io + i] = vo + i
      io += p.count
    }
    vo += p.count
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  if (colors) geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.setIndex(new THREE.BufferAttribute(indices, 1))
  return geo
}

export function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.geometry) m.geometry.dispose()
    // Materiais são compartilhados pela biblioteca: não são descartados aqui.
  })
}

/** Garante um atributo de cor de vértice uniforme (necessário para mesclar). */
export function withColor(geo: THREE.BufferGeometry, color: THREE.Color | number): THREE.BufferGeometry {
  const c = color instanceof THREE.Color ? color : new THREE.Color(color)
  const count = geo.attributes.position.count
  const arr = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    arr[i * 3] = c.r
    arr[i * 3 + 1] = c.g
    arr[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return geo
}
