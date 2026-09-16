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

/**
 * Section colours. Beyond looking better than grey concrete, they tell a player
 * mid-scramble exactly which part of the course they are in.
 */
const C = {
  start: 0xffb347,
  span: 0x4fd1b5,
  press: 0xff9e7a,
  salvage: 0x8b7fd6,
  left: 0xa78bfa,
  centre: 0x5ba8f5,
  right: 0xf472b6,
  upper: 0x7ee8c8,
  merge: 0xffc65c,
  turbine: 0xffd166,
  drop: 0x2fd4bf,
  finish: 0xffe066,
} as const;

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
floor(0, -8, 15, 16, 0, { color: C.start });
rail(-15, -8, 0.5, 16);
rail(15, -8, 0.5, 16);
rail(0, -24, 15, 0.5);
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
cp(0, 0, 0, -8, 15, 16);

// ══════════════════════════════════════════════════════════════════════════
// SECTION 1 - SWEEPER SPAN  (z 8 .. 52)
// First contact with hazards. Everything here is survivable: the sweepers are
// slow, the bridge is wide, the edges are safe lanes for the cautious.
// ══════════════════════════════════════════════════════════════════════════
floor(0, 30, 11, 22, 0, { color: C.span });
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
floor(0, 55, 9, 4, 0, { color: C.press });
// Full-width belt: the floor before it and the belt itself line up exactly, so
// nobody is eaten by an invisible edge.
obs({
  kind: 'conveyor', id: nid('belt'), group: 'always', pos: [0, 0, 66],
  size: [9, 0.4, 7], dir: [0, 0, -1.9], surface: Surface.Conveyor, color: 0x2f3b52,
});
// Three presses, widely spaced and on a readable rhythm. Force is tuned to
// *stumble*, not to flatten: being shoved back onto a belt is already a
// punishment, and a ragdoll here would feel unfair.
for (let i = 0; i < 3; i++) {
  const x = -5.6 + i * 5.6;
  const pz = 61.5 + (i % 2) * 7.5;
  obs({
    kind: 'piston', id: nid('press'), group: 'always', pos: [x, 4.8, pz],
    size: [1.4, 1.2, 1.4], dir: [0, -1, 0], range: 3.9, speed: 0.92 + (i % 2) * 0.12,
    phase: i * 0.85, force: 9.5, dwell: 0.55, surface: Surface.Padded, color: 0xff5470,
  });
  cyl(x, 7.6, pz, 0.4, 2.4, { style: 'pipe', decorOnly: true });
}
floor(0, 77, 9, 3.5, 0, { color: C.press });
rail(-9, 77, 0.4, 3.5);
rail(9, 77, 0.4, 3.5);
// Two ferries shuttle across the drop on opposite phases: wait for yours, or
// gamble on a dive. They are wide enough for a crowd to share and quick enough
// that 32 players are not queueing.
for (let i = 0; i < 2; i++) {
  obs({
    kind: 'platform', id: nid('ferry'), group: 'always', pos: [i === 0 ? -4.6 : 4.6, 0, 81],
    size: [3.8, 0.4, 3.4], dir: [0, 0, 1], range: 8.2, speed: 1.15, phase: i * 1.7,
    dwell: 0.55, surface: Surface.Grate,
  });
}
// Salvage deck. Missing the ferry drops you one level, not out of the round:
// you lose ~6 seconds jogging up the ramp while everyone laughs. A pit that
// only ever means "respawn" turns crowd chaos into frustration.
floor(0, 78, 8, 4, -6.5, { color: C.salvage });
rail(-8, 78, 0.4, 4, -6.5);
rail(8, 78, 0.4, 4, -6.5);
// 37 degree climb back to the course - steep enough to cost time, shallow
// enough to run up without fighting the controller.
// Both ends are buried into their decks: a ramp whose tip rests *on* the floor
// presents its end face as a wall, and players walk straight underneath it.
ramp(0, -3.35, 85.75, 8, 6.34, -0.595, { color: C.salvage });
box(0, -5.6, 78, 5.5, 0.5, 0.3, { style: 'lightPanel', decorOnly: true, color: 0xffcf5c });
floor(0, 95, 10, 4.5, 0, { color: C.merge });
cp(2, 0, 0, 95, 10, 4);

// ══════════════════════════════════════════════════════════════════════════
// SECTION 3 - THE FORK  (z 92 .. 148)
// Three genuinely different answers to the same problem. The Director opens
// and closes these, so the same map plays differently round to round.
// ══════════════════════════════════════════════════════════════════════════
// -- LEFT: the long way round. Safe, wide, gated. ---------------------------
floor(-13, 106, 4.5, 12, 0, { group: 'routeL', color: C.left });
rail(-17.5, 106, 0.4, 12, 0, { group: 'routeL', style: 'trim' });
floor(-13, 128, 4.5, 11, 0, { group: 'routeL', color: C.left });
floor(-7, 141, 6, 4, 0, { group: 'routeL', color: C.left });
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
floor(0, 99, 8.5, 4, 0, { group: 'routeC', color: C.centre });
rail(-6.6, 103, 1.9, 0.4, 0, { group: 'routeC' });
rail(6.6, 103, 1.9, 0.4, 0, { group: 'routeC' });
for (let i = 0; i < 4; i++) {
  obs({
    kind: 'spinner', id: nid('disc'), group: 'routeC', pos: [i % 2 === 0 ? -2.2 : 2.2, 0, 108 + i * 7.6],
    size: [4.5, 0.4, 4.5], speed: 0.3 + i * 0.07, phase: i * 1.3,
    meta: { reverse: i % 2 === 1 }, surface: Surface.Grate,
  });
}
for (let i = 0; i < 2; i++) {
  obs({
    kind: 'pendulum', id: nid('hammer'), group: 'routeC', pos: [0, 7.9, 111.5 + i * 15.5],
    range: 6.2, size: [1.25, 1.25, 1.25], speed: 0.95, phase: i * 1.05, force: 12,
    meta: { amp: 1.0 }, color: 0xff5470,
  });
  cyl(0, 8.0, 111.5 + i * 15.5, 0.3, 0.35, { group: 'routeC', style: 'metal', decorOnly: true });
}
floor(0, 141, 5, 4, 0, { group: 'routeC', color: C.centre });
// -- RIGHT: the gamble. Crumbling tiles and a trampoline skip. -------------
floor(12, 99, 4, 4, 0, { group: 'routeR', color: C.right });
for (let i = 0; i < 5; i++) {
  obs({
    kind: 'crumble', id: nid('tile'), group: 'routeR_tiles',
    pos: [12 + (i % 2 === 0 ? -1.6 : 1.6), 0, 106 + i * 4.2],
    size: [1.9, 0.35, 1.9], surface: Surface.Glass, color: 0x8ad6ff,
    meta: { delay: 0.5, respawn: 3.4 },
  });
}
// Fallback island that only exists once the tiles collapse for good.
floor(12, 116, 2.4, 9, -0.2, { group: 'routeR_broken', color: C.right });
obs({
  kind: 'trampoline', id: nid('tramp'), group: 'routeR', pos: [12, 0, 128],
  size: [2.1, 0.35, 2.1], range: 1.55, color: 0x5cf2c8,
});
floor(12, 128, 2.6, 2.6, 0, { group: 'routeR', color: C.right });
floor(9, 137, 5, 5, 0, { group: 'routeR', color: C.right });
// -- Upper catwalk: only in the 'highroad' layout. --------------------------
floor(0, 120, 4.2, 20, 7.5, { group: 'upper', color: C.upper });
ramp(0, 3.9, 103, 4.2, 6.5, -0.55, { group: 'upper', color: C.upper });
ramp(0, 3.9, 137, 4.2, 6.5, 0.55, { group: 'upper', color: C.upper });
obs({
  kind: 'sweeper', id: nid('sweep'), group: 'upper', pos: [0, 8.6, 120],
  size: [4.6, 0.28, 0.35], speed: 1.35, count: 3, force: 10,
});
// Merge deck.
floor(0, 148, 12, 5, 0, { color: C.merge });
cp(3, 0, 0, 148, 12, 5);

// ══════════════════════════════════════════════════════════════════════════
// SECTION 4 - TURBINE HALL  (z 148 .. 190)
// The set piece. A giant updraft in the middle, hammers on the flanks, and a
// heavy ball patrolling the only comfortable line.
// ══════════════════════════════════════════════════════════════════════════
floor(0, 160, 13, 8, 0, { color: C.turbine });
floor(0, 184, 13, 8, 0, { color: C.turbine });
// The pit between them: cross it on the updraft, the rim, or a long dive.
floor(-11.5, 172, 1.6, 8, 0, { style: 'grate', color: 0x6fc6d9 });
floor(11.5, 172, 1.6, 8, 0, { style: 'grate', color: 0x6fc6d9 });
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
cp(5, 0, -5.2, 214, 9, 6);

// ══════════════════════════════════════════════════════════════════════════
// SECTION 5 - DROP RUN  (z 190 .. 232)
// Downhill, fast, and finished with a jump you can win or lose by 10 cm.
// ══════════════════════════════════════════════════════════════════════════
ramp(0, -1.4, 200, 9, 9, 0.22, { color: C.drop });
obs({
  kind: 'rotator', id: nid('rot'), group: 'always', pos: [0, -2.6, 202],
  size: [6.2, 0.36, 0.5], speed: 1.25, count: 3, force: 12,
});
floor(0, 214, 9, 6, -5.2, { color: C.drop });
// Optional launch pad: dropping onto it from the ramp throws you over the gap
// with room to spare. Ignore it and you still make the jump - if you commit.
obs({
  kind: 'trampoline', id: nid('tramp'), group: 'always', pos: [0, -5.2, 217.5],
  size: [2.4, 0.35, 2.4], range: 1.72, color: 0x5cf2c8,
});
// The last gap is 4.5 m: a running jump clears it, a stumble does not. This is
// where photo finishes come from.
floor(0, 230, 11, 6, -5.2, { color: C.finish });
box(0, -2.8, 233.5, 11, 1.6, 0.4, { style: 'accent', decorOnly: true, color: 0x5cf2c8 });
cyl(-10.5, -3.2, 224.5, 0.5, 2, { style: 'accent' });
cyl(10.5, -3.2, 224.5, 0.5, 2, { style: 'accent' });
vol({ kind: 'finish', id: 'finish', pos: [0, -3.4, 230], size: [11, 4, 6] });

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
    // Waypoints sit on the actual discs - a route that does not match the
    // geometry is just an instruction to walk into the void.
    id: 'r_centre', group: 'routeC',
    points: [[0, 0.6, 97], [0, 0.6, 102], [-2.2, 0.6, 108], [2.2, 0.6, 115.6], [-2.2, 0.6, 123.2],
      [2.2, 0.6, 130.8], [0, 0.6, 138], [0, 0.6, 148]],
    startDist: 96, endDist: 152, risk: 0.5, width: 3.0,
  },
  {
    id: 'r_right', group: 'routeR',
    points: [[6, 0.6, 97], [12, 0.6, 101], [10.4, 0.6, 106], [13.6, 0.6, 110.2],
      [10.4, 0.6, 114.4], [13.6, 0.6, 118.6], [10.4, 0.6, 122.8], [12, 0.6, 128],
      [9, 0.6, 138], [4, 0.6, 144], [0, 0.6, 148]],
    startDist: 96, endDist: 152, risk: 0.85, width: 2.4,
  },
  {
    id: 'r_upper', group: 'upper',
    points: [[0, 0.6, 96], [0, 4, 103], [0, 8.1, 112], [0, 8.1, 128], [0, 4, 137], [0, 0.6, 148]],
    startDist: 96, endDist: 152, risk: 0.35, width: 2.8,
  },
  {
    // Salvage deck -> ramp -> back on course. Bots pick this only when they are
    // actually down there, because route choice weighs 3D proximity.
    id: 'r_salvage',
    points: [[0, -6.1, 76], [0, -6.1, 81], [0, -4, 85], [0, -1.6, 89], [0, 0.6, 93], [0, 0.6, 97]],
    startDist: 78, endDist: 99, risk: 0, width: 7,
  },
  {
    // Round the turbine pit on the rim walkway. Routing straight through the
    // fan shaft is exactly how you send a whole bot field into a hole.
    id: 'r_end',
    points: [[0, 0.6, 152], [0, 0.6, 161], [11.5, 0.6, 166], [11.5, 0.6, 178],
      [0, 0.6, 184], [0, 0.6, 191], [0, -1.4, 200], [0, -4.6, 210], [0, -4.6, 219],
      [0, -4.6, 226], [0, -4.6, 231]],
    startDist: 152, endDist: 240, risk: 0.2, width: 7,
  },
  {
    // The updraft line: ride the fan, cross the shaft on air. Shorter, and far
    // more likely to end with you in the basement.
    id: 'r_updraft', group: 'always',
    points: [[0, 0.6, 152], [0, 0.6, 162], [0, 2, 170], [0, 4, 176], [0, 0.6, 184],
      [0, 0.6, 191], [0, -1.4, 200], [0, -4.6, 210], [0, -4.6, 219],
      [0, -4.6, 226], [0, -4.6, 231]],
    startDist: 152, endDist: 240, risk: 0.8, width: 4,
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
      hazardScale: 1.12, descKey: 'variant.overdrive.desc',
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
    skyTop: 0x2f6fd0, skyBottom: 0xffe0bd, fog: 0xc6d8f0, fogDensity: 0.0026,
    sunColor: 0xfff0d8, sunIntensity: 2.15, ambientColor: 0x9fc4ff, ambientIntensity: 0.85,
    sunDir: [-0.45, 0.82, -0.36], palette: 'foundry',
  },
  musicKey: 'race_a',
  bpm: 128,
  version: 1,
});
