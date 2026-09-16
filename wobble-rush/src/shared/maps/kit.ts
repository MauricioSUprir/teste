/**
 * Map authoring kit.
 *
 * Maps are data, but data written by hand is unreadable, so each map builds
 * its arrays through these helpers. Keeping the DSL in one place means a new
 * map is a short file rather than a copy of the last one - which is the whole
 * point of a content pipeline.
 */
import { Surface } from '../collision';
import { ObstacleDef, VolumeDef } from '../obstacles';
import { PropDef, SpawnDef, CheckpointDef } from '../mapdef';

export interface MapBuild {
  props: PropDef[];
  obstacles: ObstacleDef[];
  volumes: VolumeDef[];
  spawns: SpawnDef[];
  checkpoints: CheckpointDef[];
  /** Unique id generator, scoped to this map. */
  nid: (prefix: string) => string;
}

type Opt = Partial<Omit<PropDef, 'shape' | 'pos' | 'size'>>;

export function createBuild(): MapBuild & {
  box: (x: number, y: number, z: number, hx: number, hy: number, hz: number, o?: Opt) => PropDef;
  cyl: (x: number, y: number, z: number, r: number, hy: number, o?: Opt) => PropDef;
  floor: (x: number, z: number, hx: number, hz: number, y?: number, o?: Opt) => PropDef;
  rail: (x: number, z: number, hx: number, hz: number, y?: number, o?: Opt) => PropDef;
  ramp: (x: number, y: number, z: number, hx: number, hz: number, pitch: number, o?: Opt) => PropDef;
  disc: (x: number, y: number, z: number, r: number, o?: Opt) => PropDef;
  obs: (d: ObstacleDef) => ObstacleDef;
  vol: (d: VolumeDef) => VolumeDef;
  spawn: (x: number, y: number, z: number, yaw?: number, group?: string) => void;
  /** Rings a set of spawn points around a centre - arenas start in a circle. */
  spawnRing: (cx: number, cz: number, radius: number, count: number, y?: number) => void;
  cp: (index: number, x: number, y: number, z: number, hx: number, hz: number, group?: string) => void;
} {
  const props: PropDef[] = [];
  const obstacles: ObstacleDef[] = [];
  const volumes: VolumeDef[] = [];
  const spawns: SpawnDef[] = [];
  const checkpoints: CheckpointDef[] = [];
  let uid = 0;

  const box = (x: number, y: number, z: number, hx: number, hy: number, hz: number, o: Opt = {}): PropDef => {
    const p: PropDef = { shape: 'box', pos: [x, y, z], size: [hx, hy, hz], style: 'floor', ...o };
    props.push(p);
    return p;
  };
  const cyl = (x: number, y: number, z: number, r: number, hy: number, o: Opt = {}): PropDef => {
    const p: PropDef = { shape: 'cylinder', pos: [x, y, z], size: [r, hy, r], style: 'metal', ...o };
    props.push(p);
    return p;
  };
  return {
    props, obstacles, volumes, spawns, checkpoints,
    nid: (prefix: string) => `${prefix}_${uid++}`,
    box,
    cyl,
    floor: (x, z, hx, hz, y = 0, o = {}) =>
      box(x, y - 0.4, z, hx, 0.4, hz, { style: 'floor', surface: Surface.Metal, ...o }),
    rail: (x, z, hx, hz, y = 0, o = {}) =>
      box(x, y + 0.45, z, hx, 0.45, hz, { style: 'trim', surface: Surface.Metal, ...o }),
    ramp: (x, y, z, hx, hz, pitch, o = {}) =>
      box(x, y, z, hx, 0.35, hz, { rot: [pitch, 0, 0], style: 'floor', surface: Surface.Metal, ...o }),
    disc: (x, y, z, r, o = {}) =>
      cyl(x, y - 0.35, z, r, 0.35, { style: 'floor', surface: Surface.Metal, ...o }),
    obs: (d) => { obstacles.push(d); return d; },
    vol: (d) => { volumes.push(d); return d; },
    spawn: (x, y, z, yaw = 0, group?: string) => { spawns.push({ pos: [x, y, z], yaw, group }); },
    spawnRing: (cx, cz, radius, count, y = 0.2) => {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const x = cx + Math.cos(a) * radius;
        const z = cz + Math.sin(a) * radius;
        // Face the centre: an arena should open with everyone looking inward.
        spawns.push({ pos: [x, y, z], yaw: Math.atan2(cx - x, cz - z) });
      }
    },
    cp: (index, x, y, z, hx, hz, group) => {
      checkpoints.push({
        id: `cp${index}`, index, pos: [x, y + 1.6, z], size: [hx, 2.6, hz],
        respawn: [x, y + 0.6, z], respawnYaw: 0, group,
      });
    },
  };
}
