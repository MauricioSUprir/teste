/**
 * Obstacle library.
 *
 * Every obstacle is a *pure function of match time*: given the tick, its
 * transform is fully determined. That single rule buys a lot:
 *   - zero network traffic for hazards, no matter how many are on a map;
 *   - perfect client prediction (the client already knows where the hammer is);
 *   - bots can look into the future to time their jumps.
 *
 * Obstacles are data (ObstacleDef) so new maps - and the Round Director's
 * layout variants - never require new code.
 */
import { Vec3, v3, v3set, clamp, TAU, smoothstep, lerp } from './math';
import { Quat, qIdentity, qSetEulerYXZ, qSetAxisAngle, qMul, qRotate } from './quat';
import {
  Collider, CollisionWorld, ShapeKind, Surface, makeCollider, refreshAabb,
} from './collision';

export type ObstacleKind =
  | 'rotator'        // spinning arm(s) sweeping a platform
  | 'pendulum'       // swinging hammer
  | 'roller'         // spinning cylinder that shoves you sideways
  | 'piston'         // thrusting block
  | 'platform'       // linear moving platform
  | 'elevator'       // vertical lift with dwell time
  | 'conveyor'       // belt that drags you along
  | 'fan'            // wind volume (no collision, pure force)
  | 'trampoline'     // bounce pad
  | 'blinker'        // platform that phases in and out
  | 'crumble'        // floor that falls away once stepped on
  | 'cannon'         // launches whoever enters
  | 'tilt'           // platform rocking on one axis
  | 'gate'           // sliding door / shutter
  | 'sweeper'        // low rotating bar - jump or get clipped
  | 'ball'           // heavy ball rolling a fixed path
  | 'spinner'        // rotating disc you can ride
  | 'pusher';        // wall that shoves out of a recess

export interface ObstacleDef {
  kind: ObstacleKind;
  /** Stable id, used by the Round Director and the map editor. */
  id: string;
  /** Layout group - the Director enables/disables whole groups at once. */
  group?: string;
  pos: [number, number, number];
  /** Euler YXZ in radians. */
  rot?: [number, number, number];
  /** Meaning depends on kind; generally the half-extents of the main body. */
  size?: [number, number, number];
  /** Cycle speed multiplier (1 = design speed). */
  speed?: number;
  /** Seconds offset into the cycle - stagger identical obstacles with this. */
  phase?: number;
  /** Travel distance / swing angle / blink period, kind dependent. */
  range?: number;
  /** Knockback strength. */
  force?: number;
  /** Seconds the obstacle waits at each end of its cycle. */
  dwell?: number;
  /** Number of arms (rotator/sweeper). */
  count?: number;
  surface?: Surface;
  /** Direction for fans, conveyors and cannons. */
  dir?: [number, number, number];
  /** Optional colour override for the renderer. */
  color?: number;
  /** Free-form extras (renderer hints, editor metadata). */
  meta?: Record<string, number | string | boolean>;
}

/** Non-solid volume that pushes, kills, scores or triggers. */
export interface VolumeDef {
  kind: 'wind' | 'kill' | 'checkpoint' | 'finish' | 'collect' | 'slow' | 'boost' | 'trigger';
  id: string;
  group?: string;
  pos: [number, number, number];
  size: [number, number, number];
  dir?: [number, number, number];
  force?: number;
  /** Checkpoint ordering index. */
  index?: number;
  meta?: Record<string, number | string | boolean>;
}

export interface ObstacleRuntime {
  def: ObstacleDef;
  colliders: Collider[];
  /** Local offsets used to rebuild world transforms each tick. */
  offsets: Vec3[];
  active: boolean;
  /** Per-instance state for stateful obstacles (crumble, gate triggers). */
  state: number;
  timer: number;
  /** Cached values so the renderer can mirror the sim exactly. */
  phaseValue: number;
}

const _q = qIdentity();
const _q2 = qIdentity();
const _base = qIdentity();
const _tmp = v3();

const DEFAULTS = {
  speed: 1,
  phase: 0,
  range: 4,
  force: 0,
  dwell: 0,
  count: 1,
};

function sizeOf(def: ObstacleDef, dx: number, dy: number, dz: number): Vec3 {
  const s = def.size;
  return v3(s ? s[0] : dx, s ? s[1] : dy, s ? s[2] : dz);
}

function dirOf(def: ObstacleDef, dx = 0, dy = 1, dz = 0): Vec3 {
  const d = def.dir;
  return v3(d ? d[0] : dx, d ? d[1] : dy, d ? d[2] : dz);
}

/** Builds the colliders for one obstacle and registers them with the world. */
export function createObstacle(def: ObstacleDef, world: CollisionWorld, ownerId: number): ObstacleRuntime {
  const rt: ObstacleRuntime = {
    def, colliders: [], offsets: [], active: true, state: 0, timer: 0, phaseValue: 0,
  };
  const p = v3(def.pos[0], def.pos[1], def.pos[2]);
  const rot = def.rot ?? [0, 0, 0];
  qSetEulerYXZ(_base, rot[1], rot[0], rot[2]);
  const baseRot: Quat = { ..._base };
  const surface = def.surface ?? Surface.Metal;
  const force = def.force ?? DEFAULTS.force;
  const count = def.count ?? DEFAULTS.count;

  const add = (kind: ShapeKind, offset: Vec3, half: Vec3, opts: Parameters<typeof makeCollider>[3] = {}) => {
    const c = makeCollider(kind, v3(p.x + offset.x, p.y + offset.y, p.z + offset.z), half, {
      surface, ownerId, rot: baseRot, ...opts,
    });
    rt.colliders.push(c);
    rt.offsets.push({ ...offset });
    world.addDynamic(c);
    return c;
  };

  switch (def.kind) {
    case 'rotator': {
      const arm = sizeOf(def, 4.2, 0.35, 0.5);
      for (let i = 0; i < Math.max(1, count); i++) {
        add(ShapeKind.Box, v3(), v3(arm.x, arm.y, arm.z), { impact: force || 13, tag: 'arm' });
      }
      // Hub the arms spin around (solid, safe to stand on).
      add(ShapeKind.Cylinder, v3(0, -0.15, 0), v3(0.7, 0.45, 0.7), { tag: 'hub', friction: 1 });
      break;
    }
    case 'sweeper': {
      const arm = sizeOf(def, 5.5, 0.28, 0.32);
      for (let i = 0; i < Math.max(1, count); i++) {
        add(ShapeKind.Box, v3(), v3(arm.x, arm.y, arm.z), { impact: force || 9, tag: 'arm' });
      }
      break;
    }
    case 'pendulum': {
      const head = sizeOf(def, 1.15, 1.15, 1.15);
      add(ShapeKind.Sphere, v3(0, -(def.range ?? 5), 0), v3(head.x, head.x, head.x), {
        impact: force || 17, surface: Surface.Padded, tag: 'head',
      });
      break;
    }
    case 'roller': {
      const s = sizeOf(def, 0.85, 3.4, 0.85);
      add(ShapeKind.Capsule, v3(), v3(s.x, s.y, s.z), { impact: force || 7, surface: Surface.Rubber, tag: 'roller' });
      break;
    }
    case 'piston': {
      const s = sizeOf(def, 0.9, 0.9, 0.9);
      add(ShapeKind.Box, v3(), v3(s.x, s.y, s.z), { impact: force || 15, tag: 'head' });
      break;
    }
    case 'pusher': {
      const s = sizeOf(def, 1.6, 1.2, 0.6);
      add(ShapeKind.Box, v3(), v3(s.x, s.y, s.z), { impact: force || 12, tag: 'head' });
      break;
    }
    case 'platform':
    case 'elevator':
    case 'blinker':
    case 'crumble':
    case 'tilt':
    case 'spinner': {
      const s = sizeOf(def, 2.4, 0.35, 2.4);
      const kind = def.kind === 'spinner' ? ShapeKind.Cylinder : ShapeKind.Box;
      add(kind, v3(), v3(s.x, s.y, s.z), { tag: 'deck' });
      break;
    }
    case 'conveyor': {
      const s = sizeOf(def, 3, 0.35, 6);
      const c = add(ShapeKind.Box, v3(), v3(s.x, s.y, s.z), { surface: Surface.Conveyor, tag: 'belt' });
      const d = dirOf(def, 0, 0, 1);
      c.conveyor = v3(d.x, d.y, d.z);
      break;
    }
    case 'trampoline': {
      const s = sizeOf(def, 1.6, 0.3, 1.6);
      add(ShapeKind.Cylinder, v3(), v3(s.x, s.y, s.z), {
        surface: Surface.Rubber, bounce: def.range ?? 1.35, tag: 'pad',
      });
      break;
    }
    case 'gate': {
      const s = sizeOf(def, 2, 2.2, 0.35);
      add(ShapeKind.Box, v3(), v3(s.x, s.y, s.z), { tag: 'door', noStand: false });
      break;
    }
    case 'ball': {
      const r = def.size ? def.size[0] : 1.5;
      add(ShapeKind.Sphere, v3(), v3(r, r, r), {
        impact: force || 14, surface: Surface.Rubber, tag: 'ball',
      });
      break;
    }
    case 'cannon':
    case 'fan':
      // Force-only: handled as a volume, no collider.
      break;
  }
  return rt;
}

/** Cycle helper: ping-pongs 0..1..0 with optional dwell at both ends. */
function pingPong(t: number, period: number, dwell: number): number {
  const total = period + dwell * 2;
  const x = ((t % total) + total) % total;
  const half = period * 0.5;
  if (x < half) return smoothstep(x / half);
  if (x < half + dwell) return 1;
  if (x < period + dwell) return smoothstep(1 - (x - half - dwell) / half);
  return 0;
}

/**
 * Advances one obstacle to match time `t` (seconds since round start).
 * `hazardScale` lets events/variants speed everything up coherently.
 */
export function updateObstacle(rt: ObstacleRuntime, t: number, hazardScale: number, dt: number): void {
  const def = rt.def;
  if (!rt.active) return;
  const speed = (def.speed ?? DEFAULTS.speed) * hazardScale;
  const phase = def.phase ?? DEFAULTS.phase;
  const time = (t + phase) * speed;
  const range = def.range ?? DEFAULTS.range;
  const dwell = def.dwell ?? DEFAULTS.dwell;
  const pos = def.pos;
  const rot = def.rot ?? [0, 0, 0];
  qSetEulerYXZ(_base, rot[1], rot[0], rot[2]);

  switch (def.kind) {
    case 'rotator':
    case 'sweeper': {
      const omega = (def.kind === 'sweeper' ? 1.5 : 1.1) * speed;
      const angle = time * omega;
      const n = Math.max(1, def.count ?? 1);
      rt.phaseValue = angle;
      for (let i = 0; i < rt.colliders.length; i++) {
        const c = rt.colliders[i];
        if (c.tag === 'hub') { refreshAabb(c); continue; }
        const armAngle = angle + (TAU / n) * i;
        qSetAxisAngle(_q, 0, 1, 0, armAngle);
        qMul(c.rot, _q, _base);
        v3set(c.pos, pos[0], pos[1], pos[2]);
        v3set(c.angVel, 0, omega, 0);
        refreshAabb(c);
      }
      break;
    }

    case 'pendulum': {
      const amp = (def.meta?.amp as number) ?? 1.05;
      const omega = 1.5 * speed;
      const angle = Math.sin(time * omega) * amp;
      rt.phaseValue = angle;
      // Swing about the pivot on the local X axis (rotation applied first).
      qSetAxisAngle(_q, 1, 0, 0, angle);
      qMul(_q2, _base, _q);
      const c = rt.colliders[0];
      if (c) {
        v3set(_tmp, 0, -range, 0);
        qRotate(_tmp, _q2, _tmp);
        v3set(c.pos, pos[0] + _tmp.x, pos[1] + _tmp.y, pos[2] + _tmp.z);
        // Tangential velocity of the head: omega * amp * cos(phase) * radius.
        const angVel = Math.cos(time * omega) * omega * amp;
        v3set(_tmp, angVel, 0, 0);
        qRotate(c.angVel, _base, _tmp);
        // Express the head's linear speed through angVel about the pivot by
        // writing the actual world velocity instead.
        const tangential = angVel * range;
        v3set(_tmp, 0, 0, 1);
        qRotate(_tmp, _q2, _tmp);
        v3set(c.vel, _tmp.x * tangential, _tmp.y * tangential, _tmp.z * tangential);
        v3set(c.angVel, 0, 0, 0);
        refreshAabb(c);
      }
      break;
    }

    case 'roller': {
      const omega = 4.5 * speed * (def.meta?.reverse ? -1 : 1);
      rt.phaseValue = time * omega;
      const c = rt.colliders[0];
      if (c) {
        // Spin about the roller's own long axis (local Y after base rotation).
        v3set(_tmp, 0, omega, 0);
        qRotate(c.angVel, _base, _tmp);
        refreshAabb(c);
      }
      break;
    }

    case 'piston': {
      const period = 1.9 / Math.max(speed, 0.01);
      const k = pingPong(time, period, dwell || 0.35);
      rt.phaseValue = k;
      const d = dirOf(def, 0, 1, 0);
      const c = rt.colliders[0];
      if (c) {
        const prevY = c.pos.y, prevX = c.pos.x, prevZ = c.pos.z;
        v3set(c.pos, pos[0] + d.x * range * k, pos[1] + d.y * range * k, pos[2] + d.z * range * k);
        if (dt > 0) v3set(c.vel, (c.pos.x - prevX) / dt, (c.pos.y - prevY) / dt, (c.pos.z - prevZ) / dt);
        refreshAabb(c);
      }
      break;
    }

    case 'pusher': {
      const period = 2.6 / Math.max(speed, 0.01);
      const k = pingPong(time, period, dwell || 0.6);
      rt.phaseValue = k;
      const d = dirOf(def, 1, 0, 0);
      const c = rt.colliders[0];
      if (c) {
        const px = c.pos.x, py = c.pos.y, pz = c.pos.z;
        v3set(c.pos, pos[0] + d.x * range * k, pos[1] + d.y * range * k, pos[2] + d.z * range * k);
        if (dt > 0) v3set(c.vel, (c.pos.x - px) / dt, (c.pos.y - py) / dt, (c.pos.z - pz) / dt);
        refreshAabb(c);
      }
      break;
    }

    case 'platform':
    case 'elevator': {
      const period = (def.kind === 'elevator' ? 4.5 : 3.6) / Math.max(speed, 0.01);
      const k = pingPong(time, period, dwell || 0.8);
      rt.phaseValue = k;
      const d = def.kind === 'elevator' ? dirOf(def, 0, 1, 0) : dirOf(def, 1, 0, 0);
      const c = rt.colliders[0];
      if (c) {
        const px = c.pos.x, py = c.pos.y, pz = c.pos.z;
        v3set(c.pos, pos[0] + d.x * range * k, pos[1] + d.y * range * k, pos[2] + d.z * range * k);
        if (dt > 0) v3set(c.vel, (c.pos.x - px) / dt, (c.pos.y - py) / dt, (c.pos.z - pz) / dt);
        refreshAabb(c);
      }
      break;
    }

    case 'spinner': {
      const omega = 0.9 * speed * (def.meta?.reverse ? -1 : 1);
      rt.phaseValue = time * omega;
      const c = rt.colliders[0];
      if (c) {
        qSetAxisAngle(_q, 0, 1, 0, time * omega);
        qMul(c.rot, _q, _base);
        v3set(c.angVel, 0, omega, 0);
        refreshAabb(c);
      }
      break;
    }

    case 'tilt': {
      const omega = 1.15 * speed;
      const amp = (def.meta?.amp as number) ?? 0.42;
      const angle = Math.sin(time * omega) * amp;
      rt.phaseValue = angle;
      const c = rt.colliders[0];
      if (c) {
        qSetAxisAngle(_q, (def.dir?.[0] ?? 0) || 0, 0, (def.dir?.[2] ?? 1) || 1, angle);
        qMul(c.rot, _q, _base);
        refreshAabb(c);
      }
      break;
    }

    case 'blinker': {
      const period = Math.max(0.6, range) / Math.max(speed, 0.01);
      const x = ((time % (period * 2)) + period * 2) % (period * 2);
      const on = x < period;
      rt.phaseValue = on ? 1 - x / period : 0;
      const c = rt.colliders[0];
      if (c) { c.enabled = on; refreshAabb(c); }
      break;
    }

    case 'crumble': {
      // state: 0 idle, 1 shaking, 2 gone, 3 respawning
      const c = rt.colliders[0];
      if (!c) break;
      if (rt.state === 1) {
        rt.timer -= dt;
        rt.phaseValue = rt.timer;
        if (rt.timer <= 0) { rt.state = 2; rt.timer = (def.meta?.respawn as number) ?? 3.2; c.enabled = false; }
      } else if (rt.state === 2) {
        rt.timer -= dt;
        if (rt.timer <= 0) { rt.state = 0; c.enabled = true; rt.phaseValue = 0; }
      }
      refreshAabb(c);
      break;
    }

    case 'gate': {
      const period = 3.4 / Math.max(speed, 0.01);
      const k = pingPong(time, period, dwell || 1.1);
      rt.phaseValue = k;
      const c = rt.colliders[0];
      if (c) {
        const d = dirOf(def, 0, 1, 0);
        const px = c.pos.x, py = c.pos.y, pz = c.pos.z;
        v3set(c.pos, pos[0] + d.x * range * k, pos[1] + d.y * range * k, pos[2] + d.z * range * k);
        if (dt > 0) v3set(c.vel, (c.pos.x - px) / dt, (c.pos.y - py) / dt, (c.pos.z - pz) / dt);
        refreshAabb(c);
      }
      break;
    }

    case 'ball': {
      // Rolls back and forth along `dir`, spinning to match its travel.
      const period = 5.2 / Math.max(speed, 0.01);
      const k = pingPong(time, period, dwell || 0.2);
      rt.phaseValue = k;
      const d = dirOf(def, 0, 0, 1);
      const c = rt.colliders[0];
      if (c) {
        const px = c.pos.x, py = c.pos.y, pz = c.pos.z;
        v3set(c.pos, pos[0] + d.x * range * k, pos[1] + d.y * range * k, pos[2] + d.z * range * k);
        if (dt > 0) v3set(c.vel, (c.pos.x - px) / dt, (c.pos.y - py) / dt, (c.pos.z - pz) / dt);
        refreshAabb(c);
      }
      break;
    }

    case 'trampoline':
    case 'conveyor':
    case 'fan':
    case 'cannon':
      rt.phaseValue = time;
      break;
  }
}

/** Called when a player stands on a crumbling platform. */
export function triggerCrumble(rt: ObstacleRuntime): void {
  if (rt.def.kind !== 'crumble' || rt.state !== 0) return;
  rt.state = 1;
  rt.timer = (rt.def.meta?.delay as number) ?? 0.55;
}

export function setObstacleActive(rt: ObstacleRuntime, active: boolean): void {
  rt.active = active;
  for (const c of rt.colliders) {
    c.enabled = active;
    refreshAabb(c);
  }
  if (active && rt.def.kind === 'crumble') { rt.state = 0; rt.timer = 0; }
}

export { clamp, lerp };
