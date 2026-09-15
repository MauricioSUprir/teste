/**
 * Colisão do mundo: caixas orientadas (OBB no plano XZ com faixa vertical)
 * indexadas por hash espacial. Leve o bastante para milhares de colisores e
 * preciso o bastante para paredes, móveis, postes e veículos.
 */

import * as THREE from 'three'
import { clamp } from '../core/math'

export type ColliderTag = 'predio' | 'parede' | 'movel' | 'prop' | 'veiculo' | 'trave' | 'cerca' | 'ponte' | 'porta'

export interface Collider {
  id: number
  x: number; y: number; z: number      // centro
  hx: number; hy: number; hz: number   // meias-extensões (hy vertical)
  cos: number; sin: number             // rotação em torno de Y pré-computada
  yaw: number
  tag: ColliderTag
  /** Falso para gatilhos (porta, zona) que não empurram o jogador. */
  solid: boolean
  /** Identificador do grupo (setor/entidade) para remoção em lote. */
  owner: string
  /** Se true, o topo é pisável (calçada alta, ponte, degrau, móvel). */
  walkable: boolean
}

const CELL = 16

export class CollisionWorld {
  private cells = new Map<number, Collider[]>()
  private byOwner = new Map<string, Collider[]>()
  private nextId = 1

  private static key(cx: number, cz: number): number {
    // Empacota duas coordenadas de célula com sinal em um único número.
    return ((cx + 4096) << 14) | (cz + 4096)
  }

  add(
    center: THREE.Vector3 | { x: number; y: number; z: number },
    half: { x: number; y: number; z: number },
    yaw: number,
    tag: ColliderTag,
    owner: string,
    opts: { solid?: boolean; walkable?: boolean } = {},
  ): Collider {
    const c: Collider = {
      id: this.nextId++,
      x: center.x, y: center.y, z: center.z,
      hx: half.x, hy: half.y, hz: half.z,
      cos: Math.cos(yaw), sin: Math.sin(yaw), yaw,
      tag,
      solid: opts.solid ?? true,
      walkable: opts.walkable ?? true,
      owner,
    }
    this.insert(c)
    const list = this.byOwner.get(owner)
    if (list) list.push(c)
    else this.byOwner.set(owner, [c])
    return c
  }

  private insert(c: Collider): void {
    const r = Math.hypot(c.hx, c.hz)
    const minX = Math.floor((c.x - r) / CELL)
    const maxX = Math.floor((c.x + r) / CELL)
    const minZ = Math.floor((c.z - r) / CELL)
    const maxZ = Math.floor((c.z + r) / CELL)
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        const k = CollisionWorld.key(cx, cz)
        const arr = this.cells.get(k)
        if (arr) arr.push(c)
        else this.cells.set(k, [c])
      }
    }
  }

  private remove(c: Collider): void {
    const r = Math.hypot(c.hx, c.hz)
    const minX = Math.floor((c.x - r) / CELL)
    const maxX = Math.floor((c.x + r) / CELL)
    const minZ = Math.floor((c.z - r) / CELL)
    const maxZ = Math.floor((c.z + r) / CELL)
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        const k = CollisionWorld.key(cx, cz)
        const arr = this.cells.get(k)
        if (!arr) continue
        const i = arr.indexOf(c)
        if (i >= 0) arr.splice(i, 1)
        if (arr.length === 0) this.cells.delete(k)
      }
    }
  }

  removeOwner(owner: string): void {
    const list = this.byOwner.get(owner)
    if (!list) return
    for (const c of list) this.remove(c)
    this.byOwner.delete(owner)
  }

  /** Move um colisor dinâmico (veículo) sem recriá-lo. */
  moveCollider(c: Collider, x: number, y: number, z: number, yaw: number): void {
    this.remove(c)
    c.x = x; c.y = y; c.z = z
    c.yaw = yaw; c.cos = Math.cos(yaw); c.sin = Math.sin(yaw)
    this.insert(c)
  }

  query(x: number, z: number, radius: number, out: Collider[] = []): Collider[] {
    out.length = 0
    const minX = Math.floor((x - radius) / CELL)
    const maxX = Math.floor((x + radius) / CELL)
    const minZ = Math.floor((z - radius) / CELL)
    const maxZ = Math.floor((z + radius) / CELL)
    const seen = new Set<number>()
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        const arr = this.cells.get(CollisionWorld.key(cx, cz))
        if (!arr) continue
        for (const c of arr) {
          if (seen.has(c.id)) continue
          seen.add(c.id)
          out.push(c)
        }
      }
    }
    return out
  }

  /**
   * Empurra um círculo (raio `r`, altura de `yBase` a `yTop`) para fora dos
   * colisores sólidos. Retorna o deslocamento total aplicado.
   */
  resolveCircle(
    pos: { x: number; z: number }, r: number, yBase: number, yTop: number,
    ignore?: (c: Collider) => boolean,
  ): { dx: number; dz: number; hits: number } {
    const candidates = this.query(pos.x, pos.z, r + 3)
    let dx = 0, dz = 0, hits = 0
    for (let iter = 0; iter < 3; iter++) {
      let moved = false
      for (const c of candidates) {
        if (!c.solid) continue
        if (ignore?.(c)) continue
        if (yTop < c.y - c.hy || yBase > c.y + c.hy) continue
        // Para o espaço local da caixa
        const px = pos.x - c.x
        const pz = pos.z - c.z
        const lx = px * c.cos + pz * c.sin
        const lz = -px * c.sin + pz * c.cos
        const cx = clamp(lx, -c.hx, c.hx)
        const cz = clamp(lz, -c.hz, c.hz)
        const ddx = lx - cx
        const ddz = lz - cz
        const d2 = ddx * ddx + ddz * ddz
        if (d2 >= r * r) continue

        let nx: number, nz: number, push: number
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2)
          nx = ddx / d; nz = ddz / d
          push = r - d
        } else {
          // Centro dentro da caixa: sai pela face mais próxima.
          const ox = c.hx - Math.abs(lx)
          const oz = c.hz - Math.abs(lz)
          if (ox < oz) { nx = Math.sign(lx) || 1; nz = 0; push = ox + r }
          else { nx = 0; nz = Math.sign(lz) || 1; push = oz + r }
        }
        const wx = nx * c.cos - nz * c.sin
        const wz = nx * c.sin + nz * c.cos
        pos.x += wx * push
        pos.z += wz * push
        dx += wx * push
        dz += wz * push
        moved = true
        hits++
      }
      if (!moved) break
    }
    return { dx, dz, hits }
  }

  /**
   * Altura da superfície pisável mais alta abaixo de `fromY` num raio `r`.
   * Retorna null quando não há nenhuma (usa-se então o terreno).
   */
  supportHeight(x: number, z: number, fromY: number, r = 0.32): number | null {
    const candidates = this.query(x, z, r + 0.6)
    let best: number | null = null
    for (const c of candidates) {
      if (!c.walkable) continue
      const top = c.y + c.hy
      if (top > fromY + 0.55) continue
      const px = x - c.x
      const pz = z - c.z
      const lx = px * c.cos + pz * c.sin
      const lz = -px * c.sin + pz * c.cos
      if (Math.abs(lx) > c.hx + r || Math.abs(lz) > c.hz + r) continue
      if (best === null || top > best) best = top
    }
    return best
  }

  /** Teto mais baixo acima de `fromY` (para impedir pular dentro de laje). */
  ceilingHeight(x: number, z: number, fromY: number, r = 0.3): number | null {
    const candidates = this.query(x, z, r + 0.6)
    let best: number | null = null
    for (const c of candidates) {
      if (!c.solid) continue
      const bottom = c.y - c.hy
      if (bottom < fromY) continue
      const px = x - c.x
      const pz = z - c.z
      const lx = px * c.cos + pz * c.sin
      const lz = -px * c.sin + pz * c.cos
      if (Math.abs(lx) > c.hx + r || Math.abs(lz) > c.hz + r) continue
      if (best === null || bottom < best) best = bottom
    }
    return best
  }

  /** Raio-segmento contra colisores sólidos. Usado pela câmera e pela IA. */
  raycast(
    ox: number, oy: number, oz: number,
    dx: number, dy: number, dz: number,
    maxDist: number,
    filter?: (c: Collider) => boolean,
  ): { dist: number; collider: Collider } | null {
    const candidates = this.query(ox + dx * maxDist * 0.5, oz + dz * maxDist * 0.5, maxDist * 0.5 + 6)
    let best: { dist: number; collider: Collider } | null = null
    for (const c of candidates) {
      if (!c.solid) continue
      if (filter && !filter(c)) continue
      // Origem e direção no espaço da caixa
      const px = ox - c.x, pz = oz - c.z
      const lx = px * c.cos + pz * c.sin
      const lz = -px * c.sin + pz * c.cos
      const ly = oy - c.y
      const ldx = dx * c.cos + dz * c.sin
      const ldz = -dx * c.sin + dz * c.cos
      const ldy = dy

      let tmin = 0
      let tmax = maxDist
      const slab = (o: number, d: number, h: number): boolean => {
        if (Math.abs(d) < 1e-7) return o >= -h && o <= h
        const t1 = (-h - o) / d
        const t2 = (h - o) / d
        const lo = Math.min(t1, t2)
        const hi = Math.max(t1, t2)
        if (lo > tmin) tmin = lo
        if (hi < tmax) tmax = hi
        return tmax >= tmin
      }
      if (!slab(lx, ldx, c.hx)) continue
      if (!slab(ly, ldy, c.hy)) continue
      if (!slab(lz, ldz, c.hz)) continue
      if (tmin < 0 || tmin > maxDist) continue
      if (!best || tmin < best.dist) best = { dist: tmin, collider: c }
    }
    return best
  }

  get count(): number {
    let n = 0
    for (const l of this.byOwner.values()) n += l.length
    return n
  }

  clear(): void {
    this.cells.clear()
    this.byOwner.clear()
  }
}
