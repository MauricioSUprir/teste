/**
 * Map format.
 *
 * A map is pure data: geometry, obstacles, volumes, routes, and - crucially -
 * *layout variants* and *phase events* for the Round Director. Adding a map,
 * or a new way to play an existing one, never touches engine code. The same
 * format is what the Workshop editor reads and writes.
 */
import { Surface } from './collision';
import { ObstacleDef, VolumeDef } from './obstacles';

export type Difficulty = 'easy' | 'normal' | 'hard' | 'expert' | 'legendary';

export type GameModeKind =
  | 'race' | 'survival' | 'arena' | 'collect' | 'team' | 'hunt'
  | 'escape' | 'puzzle' | 'relay' | 'rhythm' | 'endless' | 'final';

export interface PropDef {
  id?: string;
  /** Layout group toggled by the Round Director / variants. */
  group?: string;
  shape: 'box' | 'cylinder' | 'sphere' | 'capsule';
  pos: [number, number, number];
  size: [number, number, number];
  /** Euler YXZ radians. */
  rot?: [number, number, number];
  surface?: Surface;
  /** Material key resolved by the renderer's palette. */
  style?: string;
  noStand?: boolean;
  bounce?: number;
  friction?: number;
  /** Visual only - no collider is created. */
  decorOnly?: boolean;
  /** Collider only - not drawn (used for invisible walls). */
  collisionOnly?: boolean;
  color?: number;
  meta?: Record<string, number | string | boolean>;
}

export interface SpawnDef {
  pos: [number, number, number];
  yaw?: number;
  group?: string;
}

export interface CheckpointDef {
  id: string;
  index: number;
  pos: [number, number, number];
  size: [number, number, number];
  /** Where players respawn for this checkpoint (defaults to pos). */
  respawn?: [number, number, number];
  respawnYaw?: number;
  group?: string;
}

/**
 * A traversable route through the map. `points` is a polyline used for
 * (a) live progress/ranking and (b) bot navigation.
 * Branches share the same distance space so a shortcut genuinely saves metres.
 */
export interface RouteDef {
  id: string;
  /** 'main' is always available; branches can be toggled by variants. */
  group?: string;
  points: [number, number, number][];
  /** Distance value at the first point (metres along the course). */
  startDist: number;
  /** Distance at the last point. */
  endDist: number;
  /** Bot preference: higher = more attractive. Risky shortcuts score lower for cautious bots. */
  risk: number;
  /** Width of the navigable corridor, used for bot steering noise. */
  width: number;
}

/**
 * Round Director: one possible layout of the map.
 * The server picks one per round from a seeded weighted roll.
 */
export interface LayoutVariant {
  id: string;
  nameKey: string;
  weight: number;
  /** Groups that exist in this layout. Anything in `allGroups` not listed is disabled. */
  enable: string[];
  /** Extra hazard speed for this layout. */
  hazardScale?: number;
  /** Description shown on the round intro card. */
  descKey?: string;
}

/**
 * A mid-match transformation. Telegraphed first, then applied.
 * Times are seconds from round start (after the countdown).
 */
export interface PhaseEventDef {
  id: string;
  /** Fires at this time. */
  at: number;
  /** Seconds of warning before it happens. */
  telegraph: number;
  enable?: string[];
  disable?: string[];
  /** Multiplier applied to all obstacle speeds from this moment. */
  hazardScale?: number;
  /** HUD banner key. */
  bannerKey: string;
  /** Renderer hook: 'blackout' | 'flood' | 'collapse' | 'storm' | 'overdrive'. */
  fx?: string;
  /** Only fires in these variants (empty = all). */
  variants?: string[];
  /** Camera shake / audio sting strength 0..1. */
  intensity?: number;
}

export interface MapAmbient {
  skyTop: number;
  skyBottom: number;
  fog: number;
  fogDensity: number;
  sunColor: number;
  sunIntensity: number;
  ambientColor: number;
  ambientIntensity: number;
  /** Direction the sun points from. */
  sunDir: [number, number, number];
  /** Renderer theme key for prop palettes. */
  palette: string;
}

export interface MapDef {
  id: string;
  nameKey: string;
  theme: string;
  difficulty: Difficulty;
  modes: GameModeKind[];
  maxPlayers: number;
  /** Fraction of starters that qualify (race modes). */
  qualifyRatio: number;
  timeLimit: number;
  killY: number;
  /** Total course length in metres, for progress normalisation. */
  courseLength: number;
  spawns: SpawnDef[];
  checkpoints: CheckpointDef[];
  props: PropDef[];
  obstacles: ObstacleDef[];
  volumes: VolumeDef[];
  routes: RouteDef[];
  /** Every group name used anywhere in the map. */
  allGroups: string[];
  variants: LayoutVariant[];
  phaseEvents: PhaseEventDef[];
  ambient: MapAmbient;
  musicKey: string;
  bpm: number;
  /** Author + workshop metadata (community maps reuse this format verbatim). */
  author?: string;
  workshopCode?: string;
  version?: number;
}

const registry = new Map<string, MapDef>();

export function registerMap(def: MapDef): MapDef {
  registry.set(def.id, def);
  return def;
}

export function getMap(id: string): MapDef | undefined {
  return registry.get(id);
}

export function allMaps(): MapDef[] {
  return [...registry.values()];
}

/** Groups active for a given variant (plus always-on groups with no variant gate). */
export function groupsForVariant(map: MapDef, variantId: string): Set<string> {
  const variant = map.variants.find((v) => v.id === variantId) ?? map.variants[0];
  const set = new Set<string>(variant ? variant.enable : []);
  set.add('');       // ungrouped content is always on
  set.add('always');
  return set;
}

/** Projects a world position onto the route polylines; returns metres travelled. */
export function routeProgress(
  map: MapDef, activeGroups: Set<string>, x: number, y: number, z: number,
): number {
  let best = -1;
  let bestDistSq = Infinity;
  for (const route of map.routes) {
    if (route.group && !activeGroups.has(route.group)) continue;
    const pts = route.points;
    let acc = 0;
    // Pre-compute the polyline length so distance maps linearly onto start..end.
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
    }
    if (total <= 0) continue;
    for (let i = 1; i < pts.length; i++) {
      const ax = pts[i - 1][0], ay = pts[i - 1][1], az = pts[i - 1][2];
      const bx = pts[i][0], by = pts[i][1], bz = pts[i][2];
      const ex = bx - ax, ey = by - ay, ez = bz - az;
      const segLen = Math.hypot(ex, ey, ez);
      if (segLen < 1e-6) continue;
      let t = ((x - ax) * ex + (y - ay) * ey + (z - az) * ez) / (segLen * segLen);
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = ax + ex * t, py = ay + ey * t, pz = az + ez * t;
      // Vertical error matters less than horizontal: players jump.
      const dSq = (x - px) * (x - px) + (y - py) * (y - py) * 0.35 + (z - pz) * (z - pz);
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        const along = (acc + segLen * t) / total;
        best = route.startDist + (route.endDist - route.startDist) * along;
      }
      acc += segLen;
    }
  }
  return best < 0 ? 0 : best;
}
