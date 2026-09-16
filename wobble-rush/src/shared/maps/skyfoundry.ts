/**
 * SKY FOUNDRY - the benchmark map.
 *
 * A machine-city drifting above the clouds: wide, readable, and loud about
 * where you should go. Authored with a small builder DSL rather than raw
 * literals so the layout stays legible and so the Round Director's groups are
 * obvious at a glance.
 *
 * Geometry is tuned against the real jump arc:
 *   plain jump  ~4.8 m gap,  dive ~6.5 m.
 * Anything wider than that is meant to be a fall.
 */
import { Surface } from '../collision';
import { ObstacleDef, VolumeDef } from '../obstacles';
import { MapDef, PropDef, SpawnDef, CheckpointDef, RouteDef, registerMap } from '../mapdef';

const props: PropDef[] = [];
const obstacles: ObstacleDef[] = [];
const volumes: VolumeDef[] = [];
const spawns: SpawnDef[] = [];
const checkpoints: CheckpointDef[] = [];

let uid = 0;
const nid = (p: string) => `${p}_${uid++}`;

type Opt = Partial<Omit<PropDef, 'shape' | 'pos' | 'size'>>;

/** Solid box. Half-extents, like every collider in the game. */
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
/** Floor slab with the standard thickness and walkable surface. */
const floor = (x: number, z: number, hx: number, hz: number, y = 0, o: Opt = {}) =>
  box(x, y - 0.4, z, hx, 0.4, hz, { style: 'floor', surface: Surface.Metal, ...o });
/** Guard rail - low enough to dive over, high enough to save a stumble. */
const rail = (x: number, z: number, hx: number, hz: number, y = 0, o: Opt = {}) =>
  box(x, y + 0.45, z, hx, 0.45, hz, { style: 'trim', surface: Surface.Metal, ...o });
const ramp = (x: number, y: number, z: number, hx: number, hz: number, pitch: number, o: Opt = {}) =>
  box(x, y, z, hx, 0.35, hz, { rot: [pitch, 0, 0], style: 'floor', surface: Surface.Metal, ...o });

const obs = (d: ObstacleDef): ObstacleDef => { obstacles.push(d); return d; };
const vol = (d: VolumeDef): VolumeDef => { volumes.push(d); return d; };

const cp = (index: number, x: number, y: number, z: number, hx: number, hz: number, group?: string) => {
  checkpoints.push({
    id: `cp${index}`, index, pos: [x, y + 1.6, z], size: [hx, 2.6, hz],
    respawn: [x, y + 0.6, z], respawnYaw: 0, group,
  });
};

// ══════════════════════════════════════════════════════════════════════════
// SECTION 0 - START DECK  (z -16 .. 8)
// Wide and calm: 32 players need room to not shove each other into the void
// before the race even begins.
// ══════════════════════════════════════════════════════════════════════════
floor(0, -4, 15, 12);
rail(-15, -4, 0.5, 12);
rail(15, -4, 0.5, 12);
rail(0, -16, 15, 0.5);
// Starting grid: 4 rows of 8, staggered so the front row is not a free win.
for (let row = 0; row < 4; row++) {
  for (let col = 0; col < 8; col++) {
    spawns.push({ pos: [-10.5 + col * 3, 0.1, -13 + row * 2.6], yaw: 0 });
  }
}
// Launch arch - a big readable "this way" gate.
cyl(-9, 3.4, 7, 0.55, 3.4, { style: 'accent' });
cyl(9, 3.4, 7, 0.55, 3.4, { style: 'accent' });
box(0, 7.2, 7, 9.6, 0.55, 0.55, { style: 'accent' });
box(0, 6.1, 7, 4.2, 0.7, 0.25, { style: 'lightPanel', decorOnly: true, color: 0x5cf2c8 });
cp(0, 0, 0, -4, 15, 12);

// ══════════════════════════════════════════════════════════════════════════
// SECTION 1 - SWEEPER SPAN  (z 8 .. 52)
// First contact with hazards. Everything here is survivable: the sweepers are
// slow, the bridge is wide, the edges are safe lanes for the cautious.
// ══════════════════════════════════════════════════════════════════════════
floor(0, 30, 11, 22);
rail(-11, 30, 0.4, 22, 0, { style: 'trim' });
rail(11, 30, 0.4, 22, 0, { style: 'trim' });
for (let i = 0; i < 3; i++) {
  const z = 15 + i * 12;
  cyl(0, 0.5, z, 0.9, 0.5, { style: 'metal' });
  obs({
    kind: 'sweeper', id: nid('sweep'), group: 'always',
    pos: [0, 1.15, z], size: [7.4, 0.3, 0.42],
    speed: 0.82 + i * 0.12, phase: i * 1.6, count: 2, force: 9, surface: Surface.Rubber,
    color: 0xff8a3d,
  });
}
// Rollers: shove you off-line without ever being lethal on their own.
obs({
  kind: 'roller', id: nid('roll'), group: 'always', pos: [-4.5, 0.85, 22],
  rot: [0, 0, Math.PI / 2], size: [0.85, 4.2, 0.85], speed: 1.1, force: 7,
});
obs({
  kind: 'roller', id: nid('roll'), group: 'always', pos: [4.5, 0.85, 34],
  rot: [0, 0, Math.PI / 2], size: [0.85, 4.2, 0.85], speed: 1.1, force: 7,
  meta: { reverse: true },
});
cp(1, 0, 0, 50, 11, 3);

// ══════════════════════════════════════════════════════════════════════════
// SECTION 2 - PRESS LINE  (z 52 .. 92)
// The belt pushes you back while presses punch down. Teaches the dive: the
// fastest way through is a dive between two press cycles.
// ══════════════════════════════════════════════════════════════════════════
floor(0, 55, 9, 4);
obs({
  kind: 'conveyor', id: nid('belt'), group: 'always', pos: [0, 0, 66],
  size: [7, 0.4, 7], dir: [0, 0, -3.1], surface: Surface.Conveyor, color: 0x2f3b52,
});
for (let i = 0; i < 4; i++) {
  const x = -4.5 + i * 3;
  obs({
    kind: 'piston', id: nid('press'), group: 'always', pos: [x, 4.6, 62 + (i % 2) * 7],
    size: [1.1, 1.1, 1.1], dir: [0, -1, 0], range: 3.6, speed: 1.05 + (i % 3) * 0.14,
    phase: i * 0.55, force: 15, dwell: 0.32, surface: Surface.Padded, color: 0xff5470,
  });
  cyl(x, 7.4, 62 + (i % 2) * 7, 0.35, 2.4, { style: 'pipe', decorOnly: true });
}
floor(0, 76, 9, 3);
// Gap crossed by two platforms sliding on opposite phases.
obs({
  kind: 'platform', id: nid('plat'), group: 'always', pos: [-5, 0, 83],
  size: [2.6, 0.4, 2.6], dir: [1, 0, 0], range: 10, speed: 0.85, dwell: 0.7, surface: Surface.Grate,
});
obs({
  kind: 'platform', id: nid('plat'), group: 'always', pos: [5, 0, 88],
  size: [2.6, 0.4, 2.6], dir: [-1, 0, 0], range: 10, speed: 0.85, phase: 1.9, dwell: 0.7, surface: Surface.Grate,
});
floor(0, 95, 10, 4);
cp(2, 0, 0, 95, 10, 4);

// ══════════════════════════════════════════════════════════════════════════
// SECTION 3 - THE FORK  (z 92 .. 148)
// Three genuinely different answers to the same problem. The Director opens
// and closes these, so the same map plays differently round to round.
// ══════════════════════════════════════════════════════════════════════════
// -- LEFT: the long way round. Safe, wide, gated. ---------------------------
floor(-13, 106, 4.5, 12, 0, { group: 'routeL' });
rail(-17.5, 106, 0.4, 12, 0, { group: 'routeL', style: 'trim' });
floor(-13, 128, 4.5, 11, 0, { group: 'routeL' });
floor(-7, 141, 6, 4, 0, { group: 'routeL' });
for (let i = 0; i < 2; i++) {
  obs({
    kind: 'gate', id: nid('gate'), group: 'routeL', pos: [-13, 2.4, 112 + i * 16],
    size: [4.4, 2.4, 0.4], dir: [0, 1, 0], range: 4.6, speed: 0.8, phase: i * 2.1, dwell: 1.2,
    color: 0x7be3ff,
  });
  box(-17.6, 2.4, 112 + i * 16, 0.4, 2.6, 0.5, { group: 'routeL', style: 'metal' });
  box(-8.4, 2.4, 112 + i * 16, 0.4, 2.6, 0.5, { group: 'routeL', style: 'metal' });
}
// -- CENTRE: spinning discs over the drop. The default line. ---------------
floor(0, 99, 5, 4, 0, { group: 'routeC' });
for (let i = 0; i < 4; i++) {
  obs({
    kind: 'spinner', id: nid('disc'), group: 'routeC', pos: [i % 2 === 0 ? -2.6 : 2.6, 0, 108 + i * 8],
    size: [3.4, 0.4, 3.4], speed: 0.6 + i * 0.1, phase: i * 1.3,
    meta: { reverse: i % 2 === 1 }, surface: Surface.Grate,
  });
}
for (let i = 0; i < 2; i++) {
  obs({
    kind: 'pendulum', id: nid('hammer'), group: 'routeC', pos: [0, 9.5, 112 + i * 16],
    range: 6.2, size: [1.25, 1.25, 1.25], speed: 0.95, phase: i * 1.05, force: 17,
    meta: { amp: 1.0 }, color: 0xff5470,
  });
  cyl(0, 9.6, 112 + i * 16, 0.3, 0.35, { group: 'routeC', style: 'metal', decorOnly: true });
}
floor(0, 141, 5, 4, 0, { group: 'routeC' });
// -- RIGHT: the gamble. Crumbling tiles and a trampoline skip. -------------
floor(12, 99, 4, 4, 0, { group: 'routeR' });
for (let i = 0; i < 5; i++) {
  obs({
    kind: 'crumble', id: nid('tile'), group: 'routeR_tiles',
    pos: [12 + (i % 2 === 0 ? -1.6 : 1.6), 0, 106 + i * 4.2],
    size: [1.9, 0.35, 1.9], surface: Surface.Glass, color: 0x8ad6ff,
    meta: { delay: 0.5, respawn: 3.4 },
  });
}
// Fallback island that only exists once the tiles collapse for good.
floor(12, 116, 2.4, 9, -0.2, { group: 'routeR_broken', style: 'accent' });
obs({
  kind: 'trampoline', id: nid('tramp'), group: 'routeR', pos: [12, 0, 128],
  size: [2.1, 0.35, 2.1], range: 1.55, color: 0x5cf2c8,
});
floor(12, 128, 2.6, 2.6, 0, { group: 'routeR' });
floor(8, 141, 5, 4, 0, { group: 'routeR' });
// -- Upper catwalk: only in the 'highroad' layout. --------------------------
floor(0, 120, 3, 20, 7.5, { group: 'upper', style: 'accent' });
ramp(0, 3.9, 103, 3, 6.5, -0.55, { group: 'upper' });
ramp(0, 3.9, 137, 3, 6.5, 0.55, { group: 'upper' });
obs({
  kind: 'sweeper', id: nid('sweep'), group: 'upper', pos: [0, 8.6, 120],
  size: [4.6, 0.28, 0.35], speed: 1.35, count: 3, force: 10,
});
// Merge deck.
floor(0, 148, 12, 5);
cp(3, 0, 0, 148, 12, 5);

// ══════════════════════════════════════════════════════════════════════════
// SECTION 4 - TURBINE HALL  (z 148 .. 190)
// The set piece. A giant updraft in the middle, hammers on the flanks, and a
// heavy ball patrolling the only comfortable line.
// ══════════════════════════════════════════════════════════════════════════
floor(0, 160, 13, 8);
floor(0, 184, 13, 8);
// The pit between them: cross it on the updraft, the rim, or a long dive.
floor(-11.5, 172, 1.6, 8, 0, { style: 'accent' });
floor(11.5, 172, 1.6, 8, 0, { style: 'accent' });
cyl(0, -2.2, 172, 7.5, 0.6, { style: 'metal' });
vol({
  kind: 'wind', id: nid('updraft'), group: 'always',
  pos: [0, 4.5, 172], size: [6.5, 8, 6.5], dir: [0, 1, 0], force: 34,
});
obs({
  kind: 'spinner', id: nid('fan'), group: 'always', pos: [0, -1.4, 172],
  size: [6.8, 0.25, 6.8], speed: 3.4, surface: Surface.Grate, color: 0x3b4a66,
});
for (let i = 0; i < 2; i++) {
  obs({
    kind: 'pendulum', id: nid('hammer'), group: 'always',
    pos: [i === 0 ? -8 : 8, 10, 172], range: 7.4, size: [1.5, 1.5, 1.5],
    speed: 0.8, phase: i * 1.9, force: 19, rot: [0, Math.PI / 2, 0],
    meta: { amp: 0.85 }, color: 0xff5470,
  });
}
obs({
  kind: 'ball', id: nid('ball'), group: 'hazB', pos: [-10, 1.7, 160],
  size: [1.7, 1.7, 1.7], dir: [1, 0, 0], range: 20, speed: 0.9, force: 15,
});
obs({
  kind: 'ball', id: nid('ball'), group: 'hazB', pos: [10, 1.7, 184],
  size: [1.7, 1.7, 1.7], dir: [-1, 0, 0], range: 20, speed: 1.05, phase: 2.4, force: 15,
});
for (let i = 0; i < 3; i++) {
  obs({
    kind: 'tilt', id: nid('tilt'), group: 'hazA', pos: [-8 + i * 8, 0.1, 190],
    size: [3.2, 0.35, 3.2], speed: 0.9 + i * 0.15, phase: i * 0.8,
    dir: [0, 0, 1], meta: { amp: 0.4 }, surface: Surface.Grate,
  });
}
cp(4, 0, 0, 190, 13, 4);

// ══════════════════════════════════════════════════════════════════════════
// SECTION 5 - DROP RUN  (z 190 .. 232)
// Downhill, fast, and finished with a jump you can win or lose by 10 cm.
// ══════════════════════════════════════════════════════════════════════════
ramp(0, -1.4, 200, 9, 9, 0.22);
obs({
  kind: 'rotator', id: nid('rot'), group: 'always', pos: [0, -2.6, 202],
  size: [6.2, 0.36, 0.5], speed: 1.25, count: 3, force: 12,
});
floor(0, 214, 9, 5, -5.2);
obs({
  kind: 'trampoline', id: nid('tramp'), group: 'always', pos: [0, -5.2, 215],
  size: [2.6, 0.35, 2.6], range: 1.72, color: 0x5cf2c8,
});
// Final gap: reachable from the trampoline, or with a committed dive.
floor(0, 228, 11, 6, -1.2);
box(0, 1.2, 231.5, 11, 1.6, 0.4, { style: 'accent', decorOnly: true, color: 0x5cf2c8 });
vol({ kind: 'finish', id: 'finish', pos: [0, 0.6, 228], size: [11, 4, 6] });

// Decorative skyline: the map should feel like a working factory, not a box.
for (let i = 0; i < 14; i++) {
  const side = i % 2 === 0 ? -1 : 1;
  const z = -10 + i * 17;
  cyl(side * (26 + (i % 3) * 5), 6 + (i % 4) * 3, z, 2.2 + (i % 3) * 0.6, 8 + (i % 5) * 3,
    { style: 'pipe', decorOnly: true });
  box(side * (34 + (i % 2) * 6), 2 + (i % 3) * 4, z + 6, 5, 3.5, 5,
    { style: 'metal', decorOnly: true });
}
for (let i = 0; i < 6; i++) {
  obs({
    kind: 'spinner', id: nid('deco_fan'), group: 'always',
    pos: [(i % 2 === 0 ? -1 : 1) * 30, 14 + i * 2, 10 + i * 34],
    size: [4.5, 0.3, 4.5], speed: 2.2 + i * 0.3, rot: [Math.PI / 2, 0, 0],
    color: 0x3b4a66, meta: { decor: true },
  });
}
// Emergency lighting that only switches on during a blackout event.
for (let i = 0; i < 12; i++) {
  box((i % 2 === 0 ? -1 : 1) * 10.6, 0.6, 12 + i * 18, 0.3, 0.3, 1.6,
    { group: 'emergency', style: 'lightPanel', decorOnly: true, color: 0xff5470 });
}

// ── Routes ────────────────────────────────────────────────────────────────
const routes: RouteDef[] = [
  {
    id: 'r_start', points: [[0, 0.6, -10], [0, 0.6, 6], [0, 0.6, 30], [0, 0.6, 52], [0, 0.6, 66],
      [0, 0.6, 78], [0, 0.6, 88], [0, 0.6, 95]],
    startDist: 0, endDist: 96, risk: 0, width: 8,
  },
  {
    id: 'r_left', group: 'routeL',
    points: [[-4, 0.6, 96], [-13, 0.6, 102], [-13, 0.6, 118], [-13, 0.6, 134], [-8, 0.6, 143], [0, 0.6, 148]],
    startDist: 96, endDist: 152, risk: 0.15, width: 4,
  },
  {
    id: 'r_centre', group: 'routeC',
    points: [[0, 0.6, 96], [0, 0.6, 104], [-2.6, 0.6, 112], [2.6, 0.6, 120], [-2.6, 0.6, 128],
      [0, 0.6, 138], [0, 0.6, 148]],
    startDist: 96, endDist: 152, risk: 0.5, width: 3.2,
  },
  {
    id: 'r_right', group: 'routeR',
    points: [[4, 0.6, 96], [12, 0.6, 102], [12, 0.6, 114], [12, 0.6, 126], [12, 2.4, 130],
      [8, 0.6, 142], [0, 0.6, 148]],
    startDist: 96, endDist: 152, risk: 0.85, width: 2.6,
  },
  {
    id: 'r_upper', group: 'upper',
    points: [[0, 0.6, 96], [0, 4, 103], [0, 8.1, 112], [0, 8.1, 128], [0, 4, 137], [0, 0.6, 148]],
    startDist: 96, endDist: 152, risk: 0.35, width: 2.8,
  },
  {
    id: 'r_end',
    points: [[0, 0.6, 152], [0, 0.6, 162], [6, 0.6, 172], [0, 0.6, 184], [0, 0.6, 192],
      [0, -1, 200], [0, -4.6, 212], [0, -4.6, 218], [0, -0.6, 228]],
    startDist: 152, endDist: 240, risk: 0.2, width: 7,
  },
];

const allGroups = [
  'always', 'routeL', 'routeC', 'routeR', 'routeR_tiles', 'routeR_broken',
  'upper', 'hazA', 'hazB', 'emergency',
];

export const SKY_FOUNDRY: MapDef = registerMap({
  id: 'sky_foundry',
  nameKey: 'map.sky_foundry.name',
  theme: 'foundry',
  difficulty: 'normal',
  modes: ['race'],
  maxPlayers: 32,
  qualifyRatio: 0.5,
  timeLimit: 180,
  killY: -26,
  courseLength: 240,
  spawns,
  checkpoints,
  props,
  obstacles,
  volumes,
  routes,
  allGroups,
  // ── Round Director layouts ──────────────────────────────────────────────
  variants: [
    {
      id: 'standard', nameKey: 'variant.standard', weight: 34,
      enable: ['always', 'routeL', 'routeC', 'routeR', 'routeR_tiles', 'hazA'],
      descKey: 'variant.standard.desc',
    },
    {
      id: 'gauntlet', nameKey: 'variant.gauntlet', weight: 24,
      enable: ['always', 'routeC', 'routeR', 'routeR_tiles', 'hazA', 'hazB'],
      hazardScale: 1.12, descKey: 'variant.gauntlet.desc',
    },
    {
      id: 'highroad', nameKey: 'variant.highroad', weight: 24,
      enable: ['always', 'routeL', 'routeC', 'upper', 'hazA'],
      descKey: 'variant.highroad.desc',
    },
    {
      id: 'overdrive', nameKey: 'variant.overdrive', weight: 18,
      enable: ['always', 'routeL', 'routeC', 'routeR', 'routeR_tiles', 'upper', 'hazA', 'hazB'],
      hazardScale: 1.26, descKey: 'variant.overdrive.desc',
    },
  ],
  // ── Mid-match transformations (always telegraphed) ──────────────────────
  phaseEvents: [
    {
      id: 'surge', at: 24, telegraph: 4, hazardScale: 1.2,
      bannerKey: 'phase.surge', fx: 'overdrive', intensity: 0.45,
    },
    {
      id: 'collapse', at: 48, telegraph: 4.5,
      disable: ['routeR_tiles'], enable: ['routeR_broken'],
      bannerKey: 'phase.collapse', fx: 'collapse', intensity: 0.7,
      variants: ['standard', 'gauntlet', 'overdrive'],
    },
    {
      id: 'blackout', at: 72, telegraph: 3.5, enable: ['emergency'], hazardScale: 1.32,
      bannerKey: 'phase.blackout', fx: 'blackout', intensity: 0.85,
    },
  ],
  ambient: {
    skyTop: 0x2a3f7a, skyBottom: 0xf7c9a8, fog: 0xa9bde0, fogDensity: 0.0032,
    sunColor: 0xfff0d8, sunIntensity: 2.15, ambientColor: 0x9fc4ff, ambientIntensity: 0.85,
    sunDir: [-0.45, 0.82, -0.36], palette: 'foundry',
  },
  musicKey: 'race_a',
  bpm: 128,
  version: 1,
});
