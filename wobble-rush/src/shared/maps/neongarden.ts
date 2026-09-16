/**
 * NEON GARDEN - the friendly map.
 *
 * Short, wide, and forgiving: this is where a new player learns that jumping
 * feels good before SKY FOUNDRY starts throwing hammers. Every hazard here
 * knocks you about rather than off, and the only real drops are clearly framed.
 */
import { Surface } from '../collision';
import { MapDef, RouteDef, registerMap } from '../mapdef';
import { createBuild } from './kit';

const b = createBuild();
const { floor, rail, obs, vol, cp, spawn, cyl, box, ramp } = b;

const C = {
  lawn: 0x6ee7a8,
  path: 0xffe08a,
  water: 0x67c9ff,
  bloom: 0xff9ad5,
  stone: 0xd7c9f5,
};

// ── START GARDEN ─────────────────────────────────────────────────────────
floor(0, -9, 13, 13, 0, { color: C.lawn });
rail(-13, -9, 0.5, 13);
rail(13, -9, 0.5, 13);
rail(0, -22, 13, 0.5);
for (let row = 0; row < 4; row++) {
  for (let col = 0; col < 8; col++) spawn(-9 + col * 2.6, 0.1, -17 + row * 2.4);
}
cp(0, 0, 0, -9, 13, 13);
// A flowering arch marks the start line.
cyl(-8, 3, 4, 0.45, 3, { style: 'accent', color: C.bloom });
cyl(8, 3, 4, 0.45, 3, { style: 'accent', color: C.bloom });
box(0, 6.2, 4, 8.5, 0.45, 0.45, { style: 'accent', color: C.bloom });

// ── A: STEPPING BLOOMS - discs you hop between ───────────────────────────
floor(0, 10, 9, 6, 0, { color: C.path });
for (let i = 0; i < 4; i++) {
  obs({
    kind: 'spinner', id: b.nid('bloom'), pos: [i % 2 === 0 ? -3 : 3, 0, 22 + i * 7],
    size: [4.2, 0.4, 4.2], speed: 0.28 + i * 0.05, phase: i * 1.1,
    meta: { reverse: i % 2 === 1 }, surface: Surface.Grate, color: C.bloom,
  });
}
floor(0, 54, 9, 6, 0, { color: C.path });
cp(1, 0, 0, 54, 9, 6);

// ── B: BOUNCE POND - trampolines across shallow water ────────────────────
floor(0, 73, 12, 13, -3.2, { color: C.water, surface: Surface.Slime });
for (const [x, z] of [[-3.5, 64], [3.5, 69], [-3.5, 74], [3.5, 79]] as [number, number][]) {
  obs({
    kind: 'trampoline', id: b.nid('pad'), pos: [x, 0, z],
    size: [2.3, 0.35, 2.3], range: 1.6, color: 0x5cf2c8,
  });
  floor(x, z, 2.3, 2.3, 0, { color: C.stone });
}
// Falling in only costs time: the pond is shallow and pushes you onward.
vol({
  kind: 'wind', id: b.nid('current'), pos: [0, -2, 73], size: [12, 1.8, 13],
  dir: [0, 0, 1], force: 12,
});
ramp(0, -1.6, 87, 6, 4.6, -0.42);
floor(0, 92, 9, 6, 0, { color: C.path });
cp(2, 0, 0, 92, 9, 6);

// ── C: HEDGE RUN - rollers and a belt ────────────────────────────────────
obs({
  kind: 'conveyor', id: b.nid('belt'), pos: [0, 0, 104], size: [8, 0.4, 7],
  dir: [0, 0, -1.4], surface: Surface.Conveyor, color: 0x3b7a5a,
});
for (let i = 0; i < 3; i++) {
  obs({
    kind: 'roller', id: b.nid('roll'), pos: [-4 + i * 4, 0.8, 100 + i * 5],
    rot: [0, 0, Math.PI / 2], size: [0.8, 3.6, 0.8], speed: 0.9 + i * 0.1, force: 6,
    color: C.bloom,
  });
}
floor(0, 118, 9, 7, 0, { color: C.path });
// Hedges: soft cover that also blocks the line of sight to the finish.
for (let i = 0; i < 4; i++) {
  box((i % 2 === 0 ? -1 : 1) * 5.5, 0.9, 114 + i * 3, 2.2, 0.9, 0.7,
    { style: 'rubber', color: 0x3fae76, surface: Surface.Padded });
}
cp(3, 0, 0, 118, 9, 7);

// ── D: LAST HOP ──────────────────────────────────────────────────────────
for (let i = 0; i < 3; i++) {
  obs({
    kind: 'platform', id: b.nid('lily'), pos: [(i - 1) * 4.5, 0, 130],
    size: [2.6, 0.4, 2.6], dir: [0, 0, 1], range: 7, speed: 0.9, phase: i * 1.3,
    dwell: 0.6, surface: Surface.Grate, color: C.stone,
  });
}
floor(0, 146, 11, 7, 0, { color: C.lawn });
box(0, 2.4, 149, 11, 1.6, 0.4, { style: 'accent', decorOnly: true, color: C.bloom });
vol({ kind: 'finish', id: 'finish', pos: [0, 1.4, 146], size: [11, 4, 7] });
cp(4, 0, 0, 146, 11, 7);

// Decoration: tall glowing stalks, so the sky is not empty.
for (let i = 0; i < 16; i++) {
  const side = i % 2 === 0 ? -1 : 1;
  cyl(side * (20 + (i % 3) * 6), 5 + (i % 4) * 3, -16 + i * 11, 0.7 + (i % 3) * 0.3,
    7 + (i % 5) * 3, { style: 'pipe', color: 0x8f7fd6, decorOnly: true });
  cyl(side * (20 + (i % 3) * 6), 12 + (i % 4) * 3, -16 + i * 11, 1.5, 1.2,
    { style: 'accent', color: i % 2 ? C.bloom : 0xffe08a, decorOnly: true });
}

const routes: RouteDef[] = [
  {
    id: 'main',
    points: [[0, 0.6, -16], [0, 0.6, 8], [-3, 0.6, 22], [3, 0.6, 29], [-3, 0.6, 36],
      [3, 0.6, 43], [0, 0.6, 54], [-3.5, 0.6, 64], [3.5, 0.6, 69], [-3.5, 0.6, 74],
      [3.5, 0.6, 79], [0, 0.6, 92], [0, 0.6, 104], [0, 0.6, 118], [0, 0.6, 128],
      [0, 0.6, 138], [0, 0.6, 146]],
    startDist: 0, endDist: 170, risk: 0.2, width: 7,
  },
];

export const NEON_GARDEN: MapDef = registerMap({
  id: 'neon_garden',
  nameKey: 'map.neon_garden.name',
  theme: 'garden',
  difficulty: 'easy',
  modes: ['race'],
  maxPlayers: 32,
  qualifyRatio: 0.5,
  timeLimit: 150,
  killY: -18,
  courseLength: 170,
  spawns: b.spawns,
  checkpoints: b.checkpoints,
  props: b.props,
  obstacles: b.obstacles,
  volumes: b.volumes,
  routes,
  allGroups: ['always'],
  variants: [
    { id: 'bloom', nameKey: 'variant.bloom', weight: 50, enable: ['always'], descKey: 'variant.bloom.desc' },
    { id: 'dusk', nameKey: 'variant.dusk', weight: 50, enable: ['always'], hazardScale: 1.15, descKey: 'variant.dusk.desc' },
  ],
  phaseEvents: [
    { id: 'breeze', at: 30, telegraph: 3.5, hazardScale: 1.18, bannerKey: 'phase.breeze', fx: 'overdrive', intensity: 0.3 },
  ],
  ambient: {
    skyTop: 0x5b3fa8, skyBottom: 0xffc2e0, fog: 0xe4c9f2, fogDensity: 0.0024,
    sunColor: 0xfff0f6, sunIntensity: 1.9, ambientColor: 0xc9b6ff, ambientIntensity: 1.0,
    sunDir: [0.4, 0.78, -0.48], palette: 'dusk',
  },
  musicKey: 'race_b',
  bpm: 118,
  version: 1,
});
