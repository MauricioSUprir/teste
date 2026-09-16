/**
 * Capsule-vs-world collision.
 *
 * The whole game - static geometry, moving platforms, spinning hammers - is
 * expressed as a small set of convex primitives. Every query reduces to
 * "closest point on shape to a point", which keeps the code short enough to
 * reason about and fast enough to run 32 characters at 60 Hz on a phone.
 *
 * Contains no renderer types on purpose: the authoritative server imports it.
 */
import {
  Vec3, v3, v3set, v3copy, v3add, v3sub, v3scale, v3dot, v3len, v3lenSq,
  v3normalize, v3cross, clamp,
} from './math';
import { Quat, qIdentity, qRotate, qRotateInv, isIdentity } from './quat';

export const enum ShapeKind {
  Box = 0,
  Sphere = 1,
  Cylinder = 2,
  Capsule = 3,
}

/** Surface flavour drives footstep audio, particle colour and friction feel. */
export const enum Surface {
  Metal = 0,
  Rubber = 1,
  Glass = 2,
  Grate = 3,
  Slime = 4,
  Conveyor = 5,
  Padded = 6,
}

export interface Collider {
  id: number;
  kind: ShapeKind;
  pos: Vec3;
  rot: Quat;
  /** Box: half extents. Sphere: (r,r,r). Cylinder: (r, halfHeight, r). Capsule: (r, halfLength, r) along local Y. */
  half: Vec3;
  friction: number;
  /** 0 = no bounce, 1 = perfectly elastic. Trampolines go above 1 for comedy. */
  bounce: number;
  surface: Surface;
  /** Linear velocity of the surface (moving platforms) in world units/second. */
  vel: Vec3;
  /** Angular velocity as axis*radiansPerSecond, about `pos`. */
  angVel: Vec3;
  /** Extra surface drag, e.g. conveyor belts, in world space. */
  conveyor: Vec3 | null;
  /** Knockback strength applied to anything touching it (hammers, pistons). */
  impact: number;
  /** When true the collider is solid; obstacles toggle this (disappearing platforms). */
  enabled: boolean;
  /** Skips ground snapping so walls never read as floor. */
  noStand: boolean;
  /** Broadphase bounds, refreshed by `refreshAabb`. */
  aabbMin: Vec3;
  aabbMax: Vec3;
  /** Owning obstacle instance, used for event routing. */
  ownerId: number;
  tag: string;
}

let nextColliderId = 1;

export interface ColliderOptions {
  friction?: number;
  bounce?: number;
  surface?: Surface;
  impact?: number;
  noStand?: boolean;
  ownerId?: number;
  tag?: string;
  rot?: Quat;
}

export function makeCollider(kind: ShapeKind, pos: Vec3, half: Vec3, opts: ColliderOptions = {}): Collider {
  const c: Collider = {
    id: nextColliderId++,
    kind,
    pos: { ...pos },
    rot: opts.rot ? { ...opts.rot } : qIdentity(),
    half: { ...half },
    friction: opts.friction ?? 1,
    bounce: opts.bounce ?? 0,
    surface: opts.surface ?? Surface.Metal,
    vel: v3(),
    angVel: v3(),
    conveyor: null,
    impact: opts.impact ?? 0,
    enabled: true,
    noStand: opts.noStand ?? false,
    aabbMin: v3(),
    aabbMax: v3(),
    ownerId: opts.ownerId ?? 0,
    tag: opts.tag ?? '',
  };
  refreshAabb(c);
  return c;
}

/** Conservative world AABB (rotation handled by bounding the rotated extents). */
export function refreshAabb(c: Collider): void {
  let ex = c.half.x, ey = c.half.y, ez = c.half.z;
  if (c.kind === ShapeKind.Capsule) { ex = c.half.x; ey = c.half.y + c.half.x; ez = c.half.x; }
  if (!isIdentity(c.rot)) {
    // Bound the rotated box by the radius of its extents - cheap and safe.
    const r = Math.hypot(ex, ey, ez);
    ex = ey = ez = r;
  }
  v3set(c.aabbMin, c.pos.x - ex, c.pos.y - ey, c.pos.z - ez);
  v3set(c.aabbMax, c.pos.x + ex, c.pos.y + ey, c.pos.z + ez);
}

// --- scratch vectors (module-scoped: the sim is single-threaded per world) ---
const _local = v3();
const _localClosest = v3();
const _world = v3();
const _dir = v3();
const _tmp = v3();
const _tmp2 = v3();

/**
 * Closest point on the shape's surface to `p`, both in the shape's local frame.
 * Returns the signed-ish depth: negative when `p` is inside the shape.
 */
function closestPointLocal(c: Collider, p: Vec3, out: Vec3): number {
  switch (c.kind) {
    case ShapeKind.Box: {
      const hx = c.half.x, hy = c.half.y, hz = c.half.z;
      const cx = clamp(p.x, -hx, hx), cy = clamp(p.y, -hy, hy), cz = clamp(p.z, -hz, hz);
      const inside = cx === p.x && cy === p.y && cz === p.z;
      if (!inside) { v3set(out, cx, cy, cz); return v3len(v3set(_tmp, p.x - cx, p.y - cy, p.z - cz)); }
      // Deep inside: push out through the nearest face.
      const dx = hx - Math.abs(p.x), dy = hy - Math.abs(p.y), dz = hz - Math.abs(p.z);
      if (dx <= dy && dx <= dz) { v3set(out, Math.sign(p.x || 1) * hx, p.y, p.z); return -dx; }
      if (dy <= dz) { v3set(out, p.x, Math.sign(p.y || 1) * hy, p.z); return -dy; }
      v3set(out, p.x, p.y, Math.sign(p.z || 1) * hz); return -dz;
    }
    case ShapeKind.Sphere: {
      const r = c.half.x;
      const d = v3len(p);
      if (d < 1e-6) { v3set(out, 0, r, 0); return -r; }
      v3scale(out, p, r / d);
      return d - r;
    }
    case ShapeKind.Cylinder: {
      const r = c.half.x, hy = c.half.y;
      const radial = Math.hypot(p.x, p.z);
      const insideY = Math.abs(p.y) <= hy;
      const insideR = radial <= r;
      if (insideY && insideR) {
        const dy = hy - Math.abs(p.y);
        const dr = r - radial;
        if (dy <= dr) { v3set(out, p.x, Math.sign(p.y || 1) * hy, p.z); return -dy; }
        const s = radial < 1e-6 ? 0 : r / radial;
        v3set(out, radial < 1e-6 ? r : p.x * s, p.y, radial < 1e-6 ? 0 : p.z * s);
        return -dr;
      }
      const cy = clamp(p.y, -hy, hy);
      if (insideR) { v3set(out, p.x, cy, p.z); return Math.abs(p.y) - hy; }
      const s = r / (radial || 1);
      v3set(out, p.x * s, cy, p.z * s);
      return v3len(v3set(_tmp, p.x - out.x, p.y - out.y, p.z - out.z));
    }
    case ShapeKind.Capsule: {
      const r = c.half.x, hl = c.half.y;
      const cy = clamp(p.y, -hl, hl);
      const dx = p.x, dy = p.y - cy, dz = p.z;
      const d = Math.hypot(dx, dy, dz);
      if (d < 1e-6) { v3set(out, r, cy, 0); return -r; }
      const s = r / d;
      v3set(out, dx * s, cy + dy * s, dz * s);
      return d - r;
    }
  }
}

export interface Contact {
  collider: Collider;
  /** World-space unit normal pointing away from the collider, toward the capsule. */
  normal: Vec3;
  /** Penetration depth (positive when overlapping). */
  depth: number;
  /** World-space contact point on the collider surface. */
  point: Vec3;
}

const _cpA = v3();
const _cpB = v3();

/**
 * Capsule (segment `a`->`b`, radius `r`) against one collider.
 * Uses two rounds of "closest point on segment -> closest point on shape",
 * which converges fast for convex shapes and is stable at interactive rates.
 */
export function capsuleVsCollider(a: Vec3, b: Vec3, r: number, c: Collider, out: Contact): boolean {
  if (!c.enabled) return false;

  const identity = isIdentity(c.rot);
  // Segment endpoints in the collider's local frame.
  v3sub(_tmp, a, c.pos);
  const la = identity ? v3copy(_cpA, _tmp) : qRotateInv(_cpA, c.rot, _tmp);
  v3sub(_tmp, b, c.pos);
  const lb = identity ? v3copy(_cpB, c.rot ? _tmp : _tmp) : qRotateInv(_cpB, c.rot, _tmp);

  // Start from the segment midpoint, then refine.
  let t = 0.5;
  let depth = 0;
  for (let iter = 0; iter < 3; iter++) {
    v3set(_local, la.x + (lb.x - la.x) * t, la.y + (lb.y - la.y) * t, la.z + (lb.z - la.z) * t);
    depth = closestPointLocal(c, _local, _localClosest);
    // Project the shape's closest point back onto the segment.
    const abx = lb.x - la.x, aby = lb.y - la.y, abz = lb.z - la.z;
    const abLenSq = abx * abx + aby * aby + abz * abz;
    if (abLenSq < 1e-9) break;
    const nt = clamp(((_localClosest.x - la.x) * abx + (_localClosest.y - la.y) * aby + (_localClosest.z - la.z) * abz) / abLenSq, 0, 1);
    if (Math.abs(nt - t) < 1e-4) { t = nt; break; }
    t = nt;
  }
  v3set(_local, la.x + (lb.x - la.x) * t, la.y + (lb.y - la.y) * t, la.z + (lb.z - la.z) * t);
  depth = closestPointLocal(c, _local, _localClosest);
  if (depth >= r) return false;

  // Local normal points from the shape surface toward the capsule axis.
  if (depth > 1e-6) {
    v3sub(_dir, _local, _localClosest);
    v3normalize(_dir, _dir);
  } else {
    // Inside the shape: normal is the escape direction from the surface point.
    v3sub(_dir, _localClosest, _local);
    if (v3lenSq(_dir) < 1e-9) v3set(_dir, 0, 1, 0);
    else v3normalize(_dir, _dir);
  }

  if (identity) {
    v3copy(out.normal, _dir);
    v3add(out.point, c.pos, _localClosest);
  } else {
    qRotate(out.normal, c.rot, _dir);
    qRotate(_world, c.rot, _localClosest);
    v3add(out.point, c.pos, _world);
  }
  out.depth = r - depth;
  out.collider = c;
  return true;
}

/** Surface velocity of a (possibly spinning) collider at a world point. */
export function colliderPointVelocity(out: Vec3, c: Collider, point: Vec3): Vec3 {
  v3copy(out, c.vel);
  if (c.angVel.x !== 0 || c.angVel.y !== 0 || c.angVel.z !== 0) {
    v3sub(_tmp, point, c.pos);
    v3cross(_tmp2, c.angVel, _tmp);
    v3add(out, out, _tmp2);
  }
  if (c.conveyor) v3add(out, out, c.conveyor);
  return out;
}

/**
 * Uniform grid broadphase over the XZ plane. Static geometry is bucketed once;
 * dynamic colliders are kept in a short list and tested every frame.
 */
export class CollisionWorld {
  readonly cellSize: number;
  private cells = new Map<number, Collider[]>();
  readonly statics: Collider[] = [];
  readonly dynamics: Collider[] = [];
  private queryStamp = 0;
  private stamps = new Map<number, number>();

  constructor(cellSize = 8) {
    this.cellSize = cellSize;
  }

  clear(): void {
    this.cells.clear();
    this.statics.length = 0;
    this.dynamics.length = 0;
    this.stamps.clear();
  }

  addStatic(c: Collider): Collider {
    this.statics.push(c);
    this.index(c);
    return c;
  }

  addDynamic(c: Collider): Collider {
    this.dynamics.push(c);
    return c;
  }

  private key(ix: number, iz: number): number {
    return (ix + 4096) * 16384 + (iz + 4096);
  }

  private index(c: Collider): void {
    const s = this.cellSize;
    const x0 = Math.floor(c.aabbMin.x / s), x1 = Math.floor(c.aabbMax.x / s);
    const z0 = Math.floor(c.aabbMin.z / s), z1 = Math.floor(c.aabbMax.z / s);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const k = this.key(ix, iz);
        let list = this.cells.get(k);
        if (!list) { list = []; this.cells.set(k, list); }
        list.push(c);
      }
    }
  }

  /**
   * Collects candidate colliders overlapping an AABB into `out` (cleared first).
   * Static hits are de-duplicated across cells via a stamp map.
   */
  query(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number, out: Collider[]): Collider[] {
    out.length = 0;
    const stamp = ++this.queryStamp;
    const s = this.cellSize;
    const x0 = Math.floor(minX / s), x1 = Math.floor(maxX / s);
    const z0 = Math.floor(minZ / s), z1 = Math.floor(maxZ / s);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const list = this.cells.get(this.key(ix, iz));
        if (!list) continue;
        for (let i = 0; i < list.length; i++) {
          const c = list[i];
          if (this.stamps.get(c.id) === stamp) continue;
          this.stamps.set(c.id, stamp);
          if (!c.enabled) continue;
          if (c.aabbMax.x < minX || c.aabbMin.x > maxX) continue;
          if (c.aabbMax.y < minY || c.aabbMin.y > maxY) continue;
          if (c.aabbMax.z < minZ || c.aabbMin.z > maxZ) continue;
          out.push(c);
        }
      }
    }
    for (let i = 0; i < this.dynamics.length; i++) {
      const c = this.dynamics[i];
      if (!c.enabled) continue;
      if (c.aabbMax.x < minX || c.aabbMin.x > maxX) continue;
      if (c.aabbMax.y < minY || c.aabbMin.y > maxY) continue;
      if (c.aabbMax.z < minZ || c.aabbMin.z > maxZ) continue;
      out.push(c);
    }
    return out;
  }

  /** Downward ray used by bots and spawn-safety checks. Returns hit distance or -1. */
  raycastDown(x: number, y: number, z: number, maxDist: number, scratch: Collider[] = []): number {
    this.query(x - 0.2, y - maxDist, z - 0.2, x + 0.2, y, z + 0.2, scratch);
    let best = -1;
    const origin = v3set(_tmp2, x, y, z);
    for (let i = 0; i < scratch.length; i++) {
      const c = scratch[i];
      if (c.noStand) continue;
      // Approximate: sample the shape's surface directly beneath the origin.
      const localP = isIdentity(c.rot)
        ? v3set(_local, origin.x - c.pos.x, origin.y - c.pos.y, origin.z - c.pos.z)
        : qRotateInv(_local, c.rot, v3set(_tmp, origin.x - c.pos.x, origin.y - c.pos.y, origin.z - c.pos.z));
      const d = closestPointLocal(c, localP, _localClosest);
      if (d > 0.6) continue;
      const surfaceY = isIdentity(c.rot)
        ? c.pos.y + _localClosest.y
        : c.pos.y + qRotate(_world, c.rot, _localClosest).y;
      const dist = y - surfaceY;
      if (dist >= -0.05 && dist <= maxDist && (best < 0 || dist < best)) best = dist;
    }
    return best;
  }
}

export function makeContact(): Contact {
  return { collider: null as unknown as Collider, normal: v3(), depth: 0, point: v3() };
}

export { v3dot, v3scale };
