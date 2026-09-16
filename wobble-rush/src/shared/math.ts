/**
 * Minimal, allocation-conscious math used by the deterministic simulation.
 * Deliberately free of any renderer dependency so the authoritative server
 * (plain Node) and the client run byte-identical code paths.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const v3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const v3copy = (out: Vec3, a: Vec3): Vec3 => { out.x = a.x; out.y = a.y; out.z = a.z; return out; };
export const v3clone = (a: Vec3): Vec3 => ({ x: a.x, y: a.y, z: a.z });
export const v3set = (out: Vec3, x: number, y: number, z: number): Vec3 => { out.x = x; out.y = y; out.z = z; return out; };
export const v3add = (out: Vec3, a: Vec3, b: Vec3): Vec3 => v3set(out, a.x + b.x, a.y + b.y, a.z + b.z);
export const v3sub = (out: Vec3, a: Vec3, b: Vec3): Vec3 => v3set(out, a.x - b.x, a.y - b.y, a.z - b.z);
export const v3scale = (out: Vec3, a: Vec3, s: number): Vec3 => v3set(out, a.x * s, a.y * s, a.z * s);
export const v3addScaled = (out: Vec3, a: Vec3, b: Vec3, s: number): Vec3 =>
  v3set(out, a.x + b.x * s, a.y + b.y * s, a.z + b.z * s);
export const v3dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const v3lenSq = (a: Vec3): number => a.x * a.x + a.y * a.y + a.z * a.z;
export const v3len = (a: Vec3): number => Math.sqrt(v3lenSq(a));
export const v3distSq = (a: Vec3, b: Vec3): number => {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
};
export const v3dist = (a: Vec3, b: Vec3): number => Math.sqrt(v3distSq(a, b));
export const v3cross = (out: Vec3, a: Vec3, b: Vec3): Vec3 =>
  v3set(out, a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);

export function v3normalize(out: Vec3, a: Vec3): Vec3 {
  const l = v3len(a);
  if (l < 1e-9) return v3set(out, 0, 0, 0);
  return v3set(out, a.x / l, a.y / l, a.z / l);
}

export function v3lerp(out: Vec3, a: Vec3, b: Vec3, t: number): Vec3 {
  return v3set(out, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
}

/** Removes the component of `v` along `n` (used to slide along surfaces). */
export function v3projectOnPlane(out: Vec3, v: Vec3, n: Vec3): Vec3 {
  const d = v3dot(v, n);
  return v3set(out, v.x - n.x * d, v.y - n.y * d, v.z - n.z * d);
}

export function v3clampLength(out: Vec3, a: Vec3, max: number): Vec3 {
  const l = v3len(a);
  if (l <= max || l < 1e-9) return v3copy(out, a);
  return v3scale(out, a, max / l);
}

export const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);
export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const invLerp = (a: number, b: number, x: number): number => (b - a === 0 ? 0 : clamp01((x - a) / (b - a)));
export const smoothstep = (t: number): number => { const x = clamp01(t); return x * x * (3 - 2 * x); };
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - clamp01(t), 3);
export const easeInCubic = (t: number): number => Math.pow(clamp01(t), 3);
export const easeOutBack = (t: number): number => {
  const c1 = 1.70158, c3 = c1 + 1, x = clamp01(t);
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

export const TAU = Math.PI * 2;

/** Shortest signed angular difference, in radians, wrapped to [-PI, PI]. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export function angleLerp(from: number, to: number, t: number): number {
  return from + angleDelta(from, to) * clamp01(t);
}

/**
 * Framerate-independent exponential smoothing.
 * `rate` is roughly "how many e-folds per second" - higher is snappier.
 */
export function damp(current: number, target: number, rate: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-rate * dt));
}

export function dampAngle(current: number, target: number, rate: number, dt: number): number {
  return current + angleDelta(current, target) * (1 - Math.exp(-rate * dt));
}

export function dampVec3(out: Vec3, current: Vec3, target: Vec3, rate: number, dt: number): Vec3 {
  const t = 1 - Math.exp(-rate * dt);
  return v3lerp(out, current, target, t);
}

/** Moves `current` toward `target` by at most `maxDelta`. */
export function moveTowards(current: number, target: number, maxDelta: number): number {
  const d = target - current;
  if (Math.abs(d) <= maxDelta) return target;
  return current + Math.sign(d) * maxDelta;
}

/**
 * Deterministic PRNG (mulberry32). The simulation must never touch Math.random:
 * every client replaying a tick has to land on exactly the same result.
 */
export class Rng {
  private state: number;

  constructor(seed = 0x9e3779b9) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number { return min + this.next() * (max - min); }
  int(min: number, maxExclusive: number): number { return Math.floor(this.range(min, maxExclusive)); }
  pick<T>(arr: readonly T[]): T { return arr[this.int(0, arr.length)]; }
  bool(chance = 0.5): boolean { return this.next() < chance; }
  /** Approximately normal, mean 0, stddev ~0.4 - handy for humanising bots. */
  noise(): number { return (this.next() + this.next() + this.next()) / 1.5 - 1; }
  fork(salt: number): Rng { return new Rng((this.state ^ Math.imul(salt, 0x85ebca6b)) >>> 0); }
}

/** Hashes a string to a 32-bit seed (stable across runs and platforms). */
export function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
