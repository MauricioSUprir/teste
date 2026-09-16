/** Quaternion helpers for the simulation (renderer-independent). */
import { Vec3, v3set, TAU } from './math';

export interface Quat { x: number; y: number; z: number; w: number; }

export const qIdentity = (): Quat => ({ x: 0, y: 0, z: 0, w: 1 });
export const qCopy = (out: Quat, a: Quat): Quat => { out.x = a.x; out.y = a.y; out.z = a.z; out.w = a.w; return out; };

export function qSetAxisAngle(out: Quat, ax: number, ay: number, az: number, angle: number): Quat {
  const h = angle * 0.5;
  const s = Math.sin(h);
  const l = Math.hypot(ax, ay, az) || 1;
  out.x = (ax / l) * s; out.y = (ay / l) * s; out.z = (az / l) * s; out.w = Math.cos(h);
  return out;
}

/**
 * Builds a quaternion from an XYZ euler triple applied in YXZ order
 * (yaw, then pitch, then roll) - the convention the map data uses.
 *
 * Argument order is (rx, ry, rz) to match the `[x, y, z]` arrays in map files.
 * Prefer `qFromEulerArray` at call sites: passing these three separately is
 * exactly how every caller once ended up swapping pitch and yaw, which drew
 * ramps on screen while their colliders stayed flat.
 */
export function qSetEulerYXZ(out: Quat, rx: number, ry: number, rz: number): Quat {
  const c1 = Math.cos(ry * 0.5), s1 = Math.sin(ry * 0.5);
  const c2 = Math.cos(rx * 0.5), s2 = Math.sin(rx * 0.5);
  const c3 = Math.cos(rz * 0.5), s3 = Math.sin(rz * 0.5);
  out.x = c1 * s2 * c3 + s1 * c2 * s3;
  out.y = s1 * c2 * c3 - c1 * s2 * s3;
  out.z = c1 * c2 * s3 - s1 * s2 * c3;
  out.w = c1 * c2 * c3 + s1 * s2 * s3;
  return out;
}

export function qMul(out: Quat, a: Quat, b: Quat): Quat {
  const ax = a.x, ay = a.y, az = a.z, aw = a.w;
  const bx = b.x, by = b.y, bz = b.z, bw = b.w;
  out.x = aw * bx + ax * bw + ay * bz - az * by;
  out.y = aw * by - ax * bz + ay * bw + az * bx;
  out.z = aw * bz + ax * by - ay * bx + az * bw;
  out.w = aw * bw - ax * bx - ay * by - az * bz;
  return out;
}

/** out = q * v (rotate vector by quaternion). */
export function qRotate(out: Vec3, q: Quat, v: Vec3): Vec3 {
  const { x, y, z, w } = q;
  const tx = 2 * (y * v.z - z * v.y);
  const ty = 2 * (z * v.x - x * v.z);
  const tz = 2 * (x * v.y - y * v.x);
  return v3set(out,
    v.x + w * tx + (y * tz - z * ty),
    v.y + w * ty + (z * tx - x * tz),
    v.z + w * tz + (x * ty - y * tx));
}

/** out = q^-1 * v (assumes unit quaternion). */
export function qRotateInv(out: Vec3, q: Quat, v: Vec3): Vec3 {
  const { x, y, z, w } = q;
  const tx = 2 * (-y * v.z + z * v.y);
  const ty = 2 * (-z * v.x + x * v.z);
  const tz = 2 * (-x * v.y + y * v.x);
  return v3set(out,
    v.x + w * tx + (-y * tz + z * ty),
    v.y + w * ty + (-z * tx + x * tz),
    v.z + w * tz + (-x * ty + y * tx));
}

/** Builds a rotation from a map-style `[x, y, z]` euler array. */
export function qFromEulerArray(out: Quat, e: readonly [number, number, number], mirror = 1): Quat {
  // Mirroring across X flips the sign of yaw and roll, never of pitch.
  return qSetEulerYXZ(out, e[0], e[1] * mirror, e[2] * mirror);
}

export const isIdentity = (q: Quat): boolean =>
  q.x === 0 && q.y === 0 && q.z === 0 && (q.w === 1 || q.w === -1);

export const yawOf = (q: Quat): number =>
  Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.z * q.z));

export const wrapAngle = (a: number): number => {
  let x = a % TAU;
  if (x < 0) x += TAU;
  return x;
};
