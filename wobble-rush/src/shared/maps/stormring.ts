/**
 * STORM RING - elimination arena.
 *
 * No finish line: the goal is simply to still be standing. The floor retreats
 * in telegraphed stages, so the danger is not the sweepers themselves but the
 * shrinking space you have to dodge them in - crowding is the real hazard, and
 * that is what makes a survival round funny instead of arbitrary.
 */
import { Surface } from '../collision';
import { MapDef, RouteDef, registerMap } from '../mapdef';
import { createBuild } from './kit';

const b = createBuild();
const { obs, disc, cyl, box, spawnRing, cp, vol } = b;

const C = {
  core: 0xffd166,
  mid: 0x4fd1b5,
  rim: 0xff7a9c,
  frame: 0x2f3b6e,
};

const R_CORE = 11;
const R_MID = 19;
const R_RIM = 26;

// Three concentric decks. The Director removes them from the outside in.
disc(0, 0, 0, R_CORE, { color: C.core, surface: Surface.Metal });
disc(0, 0, 0, R_MID, { color: C.mid, surface: Surface.Grate, group: 'mid' });
disc(0, 0, 0, R_RIM, { color: C.rim, surface: Surface.Glass, group: 'rim' });
// Lip so a nudge at the very edge is survivable, and the edge is readable.
for (let i = 0; i < 48; i++) {
  const a = (i / 48) * Math.PI * 2;
  box(Math.cos(a) * R_RIM, 0.35, Math.sin(a) * R_RIM, 1.9, 0.35, 1.9,
    { rot: [0, -a, 0], style: 'trim', color: C.frame, group: 'rim' });
}

// A low kerb around the outermost deck: being shoved near the edge should be a
// scare, not an automatic elimination.
for (let i = 0; i < 64; i++) {
  const a = (i / 64) * Math.PI * 2;
  box(Math.cos(a) * (R_RIM - 0.4), 0.42, Math.sin(a) * (R_RIM - 0.4), 1.4, 0.42, 0.35,
    { rot: [0, -a, 0], style: 'trim', color: C.frame, group: 'rim' });
}

// Central pillar with three sweeping arms of different lengths and speeds:
// one you duck under at the core, one that patrols the middle, one at the rim.
cyl(0, 3, 0, 1.5, 3, { style: 'metal', color: C.frame });
const arms: [number, number, number, string, number][] = [
  [R_CORE - 2, 0.8, 1.05, 'always', 2],
  [R_MID - 3, 0.55, 1.15, 'mid', 2],
  [R_RIM - 4, 0.4, 1.2, 'rim', 2],
];
arms.forEach(([len, speed, height, group, count], i) => {
  obs({
    kind: 'sweeper', id: b.nid('arm'), group,
    pos: [0, height, 0], size: [len, 0.3, 0.45],
    speed, phase: i * 1.9, count, force: 6.5,
    surface: Surface.Rubber, color: i === 0 ? C.core : i === 1 ? C.mid : C.rim,
  });
});

// Pistons punch up through the middle deck on a readable rhythm.
for (let i = 0; i < 6; i++) {
  const a = (i / 6) * Math.PI * 2;
  obs({
    kind: 'piston', id: b.nid('punch'), group: 'mid',
    pos: [Math.cos(a) * 14.5, 4.4, Math.sin(a) * 14.5], size: [1.3, 1.1, 1.3],
    dir: [0, -1, 0], range: 3.6, speed: 0.85 + (i % 3) * 0.12, phase: i * 0.7,
    force: 8, dwell: 0.9, surface: Surface.Padded, color: 0xff5470,
  });
}

// Bounce pads on the core: a way back into the fight, and a way to launch
// yourself somewhere regrettable.
for (let i = 0; i < 3; i++) {
  const a = (i / 3) * Math.PI * 2 + 0.5;
  obs({
    kind: 'trampoline', id: b.nid('pad'), pos: [Math.cos(a) * 6.5, 0, Math.sin(a) * 6.5],
    size: [2, 0.35, 2], range: 1.5, color: 0x5cf2c8,
  });
}

// Heavy balls rolling across the middle ring once the storm picks up.
for (let i = 0; i < 2; i++) {
  obs({
    kind: 'ball', id: b.nid('ball'), group: 'storm',
    pos: [i === 0 ? -R_MID : R_MID, 1.6, i === 0 ? -6 : 6],
    size: [1.6, 1.6, 1.6], dir: [i === 0 ? 1 : -1, 0, 0], range: R_MID * 2,
    speed: 0.7, phase: i * 2.2, force: 11,
  });
}

spawnRing(0, 0, R_CORE - 2.5, 16);
spawnRing(0, 0, R_CORE + 3.5, 16);
cp(0, 0, 0, 0, R_CORE, R_CORE);
// Anything below the deck is out. There is no coming back in this mode.
vol({ kind: 'kill', id: 'void', pos: [0, -9, 0], size: [60, 2, 60] });

// Decor: storm towers around the arena.
for (let i = 0; i < 10; i++) {
  const a = (i / 10) * Math.PI * 2;
  cyl(Math.cos(a) * 42, 9 + (i % 3) * 4, Math.sin(a) * 42, 2.4, 11 + (i % 4) * 3,
    { style: 'pipe', color: 0x6f86b8, decorOnly: true });
}

// Bots orbit the arena; their own edge-detection keeps them off the drop.
const routes: RouteDef[] = [
  {
    id: 'orbit',
    points: Array.from({ length: 13 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return [Math.cos(a) * 8, 0.6, Math.sin(a) * 8] as [number, number, number];
    }),
    startDist: 0, endDist: 100, risk: 0.2, width: 9,
  },
];

export const STORM_RING: MapDef = registerMap({
  id: 'storm_ring',
  nameKey: 'map.storm_ring.name',
  theme: 'storm',
  difficulty: 'hard',
  modes: ['survival', 'team'],
  maxPlayers: 32,
  qualifyRatio: 0.4,
  timeLimit: 120,
  killY: -16,
  courseLength: 100,
  spawns: b.spawns,
  checkpoints: b.checkpoints,
  props: b.props,
  obstacles: b.obstacles,
  volumes: b.volumes,
  routes,
  allGroups: ['always', 'mid', 'rim', 'storm'],
  variants: [
    {
      id: 'gathering', nameKey: 'variant.gathering', weight: 55,
      enable: ['always', 'mid', 'rim'], descKey: 'variant.gathering.desc',
    },
    {
      id: 'tempest', nameKey: 'variant.tempest', weight: 45,
      enable: ['always', 'mid', 'rim', 'storm'], hazardScale: 1.15,
      descKey: 'variant.tempest.desc',
    },
  ],
  // The arena closes in. Each stage is announced before it happens, because a
  // floor that vanishes without warning is not a challenge, it is a coin flip.
  phaseEvents: [
    {
      id: 'rimfall', at: 26, telegraph: 5, disable: ['rim'],
      bannerKey: 'phase.rimfall', fx: 'collapse', intensity: 0.7,
    },
    {
      id: 'surge2', at: 48, telegraph: 4, hazardScale: 1.25, enable: ['storm'],
      bannerKey: 'phase.surge', fx: 'overdrive', intensity: 0.5,
    },
    {
      id: 'midfall', at: 70, telegraph: 5, disable: ['mid'],
      bannerKey: 'phase.midfall', fx: 'collapse', intensity: 0.9,
    },
  ],
  ambient: {
    skyTop: 0x1d2b5c, skyBottom: 0xff9e7a, fog: 0x7f8fc4, fogDensity: 0.004,
    sunColor: 0xffd9c0, sunIntensity: 1.7, ambientColor: 0x8fa6e8, ambientIntensity: 0.95,
    sunDir: [-0.55, 0.7, 0.45], palette: 'foundry',
  },
  musicKey: 'survival',
  bpm: 134,
  version: 1,
});
