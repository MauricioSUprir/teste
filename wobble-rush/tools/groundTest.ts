/**
 * Ground-contact stability harness.
 *
 * "The physics feels buggy on the floor" is not actionable, so these tests turn
 * it into numbers: does the character jitter at rest, drift on a slope, climb or
 * shake against a wall, lose speed crossing a seam, ride a moving platform?
 */
import { CollisionWorld, makeCollider, ShapeKind, Surface } from '../src/shared/collision';
import { qSetEulerYXZ, qIdentity } from '../src/shared/quat';
import { stepCharacter } from '../src/shared/character';
import { makeRules, TICK_DT, MOVE } from '../src/shared/config';
import { makeInput, MoveState, PlayerSim, makeAbilityRuntime, Btn } from '../src/shared/types';
import { v3, Rng } from '../src/shared/math';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
  if (!ok) failures++;
};
const n = (x: number, d = 3) => x.toFixed(d);

function makePlayer(x = 0, y = 2, z = 0): PlayerSim {
  return {
    id: 1, name: 'T', isBot: false, teamId: 0,
    pos: v3(x, y, z), vel: v3(), yaw: 0,
    state: MoveState.Idle, stateTime: 0, prevState: MoveState.Idle,
    grounded: false, groundNormal: v3(0, 1, 0), groundColliderId: 0,
    groundSurface: Surface.Metal, groundVel: v3(),
    coyote: 0, jumpBuffer: 0, jumpHeld: false, airJumpsUsed: 0,
    diveCooldown: 0, stateTimer: 0, lastHitId: 0, hitCd: 0, invuln: 0,
    checkpoint: 0, progress: 0, bestProgress: 0, finishTick: -1, rank: 0,
    qualified: false, eliminated: false, eliminatedTick: -1, score: 0, falls: 0,
    ability: makeAbilityRuntime(3), loadout: [], emote: 0, emoteTime: 0,
    idleTicks: 0, stallTicks: 0, connected: true, lastSeq: 0,
  };
}

function ctxFor(world: CollisionWorld) {
  return { world, rules: makeRules(), events: [], rng: new Rng(1), tick: 0, killY: -50 };
}

function run(p: PlayerSim, ctx: ReturnType<typeof ctxFor>, ticks: number,
             fn?: (t: number, cmd: ReturnType<typeof makeInput>) => void) {
  const cmd = makeInput();
  for (let t = 0; t < ticks; t++) {
    cmd.moveX = 0; cmd.moveZ = 0; cmd.buttons = 0; cmd.camYaw = 0;
    fn?.(t, cmd);
    ctx.tick = t;
    stepCharacter(p, cmd, ctx, TICK_DT);
    ctx.events.length = 0;
  }
}

console.log('\n=== Ground contact stability ===\n');

// ── 1. Flat ground: no jitter, no sinking ────────────────────────────────
{
  const world = new CollisionWorld(16);
  world.addStatic(makeCollider(ShapeKind.Box, v3(0, -0.5, 0), v3(20, 0.5, 20), {}));
  const p = makePlayer(0, 1.5, 0);
  const ctx = ctxFor(world);
  run(p, ctx, 120);
  const restY = p.pos.y;
  let maxDev = 0;
  run(p, ctx, 120, () => { maxDev = Math.max(maxDev, Math.abs(p.pos.y - restY)); });
  check('rests exactly on the surface', Math.abs(p.pos.y) < 0.02, `y=${n(p.pos.y)}`);
  check('no vertical jitter at rest', maxDev < 0.002, `max deviation ${n(maxDev, 5)} m`);
}

// ── 2. Slope: stands without sliding, walks up without stalling ──────────
{
  for (const deg of [10, 25, 40]) {
    const world = new CollisionWorld(16);
    const rot = qIdentity();
    // Negative pitch tips the +Z end up, so 'forward' is uphill.
    qSetEulerYXZ(rot, (-deg * Math.PI) / 180, 0, 0);
    world.addStatic(makeCollider(ShapeKind.Box, v3(0, 0, 0), v3(20, 0.5, 20), { rot }));
    const p = makePlayer(0, 4, 0);
    const ctx = ctxFor(world);
    run(p, ctx, 150);
    const settled = { x: p.pos.x, z: p.pos.z };
    run(p, ctx, 120);
    const drift = Math.hypot(p.pos.x - settled.x, p.pos.z - settled.z);
    check(`stands still on a ${deg}° slope`, drift < 0.06, `drift ${n(drift)} m`);

    const beforeZ = p.pos.z;
    run(p, ctx, 120, (_t, c) => { c.moveZ = -1; });
    const climbed = p.pos.z - beforeZ;
    const rose = p.pos.y;
    // Ground covered must fall off with steepness - that is the whole point.
    check(`walks up a ${deg}° slope`, climbed > 3 && rose > 0.5,
      `${n(climbed, 2)} m forward, ${n(rose, 2)} m up`);
  }
}

// ── 3. Wall: stops cleanly, never climbs, never shakes ──────────────────
{
  const world = new CollisionWorld(16);
  world.addStatic(makeCollider(ShapeKind.Box, v3(0, -0.5, 0), v3(20, 0.5, 20), {}));
  world.addStatic(makeCollider(ShapeKind.Box, v3(0, 2, 10), v3(20, 2, 0.5), {}));
  const p = makePlayer(0, 1, 0);
  const ctx = ctxFor(world);
  run(p, ctx, 60);
  run(p, ctx, 150, (_t, c) => { c.moveZ = -1; });
  const restZ = p.pos.z, restY = p.pos.y;
  let jitter = 0, maxY = p.pos.y;
  run(p, ctx, 120, (_t, c) => {
    c.moveZ = -1;
    jitter = Math.max(jitter, Math.abs(p.pos.z - restZ));
    maxY = Math.max(maxY, p.pos.y);
  });
  check('stops against a wall', p.pos.z < 9.6 && p.pos.z > 8.9, `z=${n(p.pos.z, 2)}`);
  check('does not shake against a wall', jitter < 0.02, `jitter ${n(jitter, 4)} m`);
  check('does not climb a wall', maxY - restY < 0.05, `rose ${n(maxY - restY, 4)} m`);
}

// ── 4. Seam between two slabs: full speed preserved ──────────────────────
{
  const world = new CollisionWorld(16);
  world.addStatic(makeCollider(ShapeKind.Box, v3(0, -0.5, 0), v3(10, 0.5, 10), {}));
  world.addStatic(makeCollider(ShapeKind.Box, v3(0, -0.5, 20), v3(10, 0.5, 10), {}));
  const p = makePlayer(0, 1, -5);
  const ctx = ctxFor(world);
  run(p, ctx, 60);
  let minSpeed = 99;
  let minAt = 0;
  run(p, ctx, 260, (_t, c) => {
    c.moveZ = -1;
    if (p.grounded && p.pos.z > 5 && p.pos.z < 15) {
      const sp = Math.hypot(p.vel.x, p.vel.z);
      if (sp < minSpeed) { minSpeed = sp; minAt = p.pos.z; }
    }
  });
  check('keeps full speed across a floor seam', minSpeed > 7.0,
    `min ${n(minSpeed, 2)} u/s at z=${n(minAt, 1)}`);
  check('crosses the seam', p.pos.z > 20, `z=${n(p.pos.z, 1)}`);
}

// ── 5. Step up onto a small ledge, blocked by a tall one ─────────────────
{
  for (const [h, shouldClimb] of [[0.15, true], [0.3, true], [0.45, false], [0.9, false]] as [number, boolean][]) {
    const world = new CollisionWorld(16);
    world.addStatic(makeCollider(ShapeKind.Box, v3(0, -0.5, 0), v3(10, 0.5, 10), {}));
    world.addStatic(makeCollider(ShapeKind.Box, v3(0, h - 2, 14), v3(10, 2, 6), {}));
    const p = makePlayer(0, 1, 0);
    const ctx = ctxFor(world);
    run(p, ctx, 60);
    // Track the peak: running on past the ledge and off its far end would
    // otherwise read as "never climbed".
    let peak = p.pos.y;
    run(p, ctx, 150, (_t, c) => { c.moveZ = -1; peak = Math.max(peak, p.pos.y); });
    const climbed = peak > h - 0.06;
    check(`${shouldClimb ? 'steps up' : 'is blocked by'} a ${h} m ledge`,
      climbed === shouldClimb, `peak y=${n(peak, 2)} (ledge ${h})`);
  }
}

// ── 6. Moving platform: rides it instead of sliding off ─────────────────
{
  const world = new CollisionWorld(16);
  const plat = makeCollider(ShapeKind.Box, v3(0, -0.4, 0), v3(4, 0.4, 4), {});
  world.addDynamic(plat);
  const p = makePlayer(0, 1, 0);
  const ctx = ctxFor(world);
  run(p, ctx, 60);
  // Slide the platform along X at 3 m/s and let the character stand still.
  let maxOffset = 0;
  const cmd = makeInput();
  for (let t = 0; t < 180; t++) {
    plat.vel.x = 3;
    plat.pos.x += 3 * TICK_DT;
    (world as unknown as { dynamics: typeof plat[] }).dynamics;
    plat.aabbMin.x = plat.pos.x - 4; plat.aabbMax.x = plat.pos.x + 4;
    plat.aabbMin.y = plat.pos.y - 0.4; plat.aabbMax.y = plat.pos.y + 0.4;
    plat.aabbMin.z = plat.pos.z - 4; plat.aabbMax.z = plat.pos.z + 4;
    cmd.moveX = 0; cmd.moveZ = 0; cmd.buttons = 0;
    stepCharacter(p, cmd, ctx, TICK_DT);
    ctx.events.length = 0;
    maxOffset = Math.max(maxOffset, Math.abs(p.pos.x - plat.pos.x));
  }
  check('rides a moving platform', maxOffset < 1.2 && p.grounded,
    `drifted ${n(maxOffset, 2)} m from centre, grounded=${p.grounded}`);
}

// ── 7. Landing does not bounce ──────────────────────────────────────────
{
  const world = new CollisionWorld(16);
  world.addStatic(makeCollider(ShapeKind.Box, v3(0, -0.5, 0), v3(20, 0.5, 20), {}));
  const p = makePlayer(0, 9, 0);
  const ctx = ctxFor(world);
  let landings = 0;
  let wasGrounded = false;
  run(p, ctx, 240, () => {
    if (p.grounded && !wasGrounded) landings++;
    wasGrounded = p.grounded;
  });
  check('lands once, without bouncing', landings === 1, `${landings} ground contacts`);
}

// ── 8. Jump off a moving platform carries momentum ──────────────────────
{
  const world = new CollisionWorld(16);
  world.addStatic(makeCollider(ShapeKind.Box, v3(0, -0.5, 0), v3(30, 0.5, 30), {}));
  const belt = makeCollider(ShapeKind.Box, v3(0, 0.2, 0), v3(5, 0.3, 5), { surface: Surface.Conveyor });
  belt.conveyor = v3(0, 0, 4);
  world.addDynamic(belt);
  const p = makePlayer(0, 1.2, 0);
  const ctx = ctxFor(world);
  run(p, ctx, 90);
  const carried = p.vel.z;
  check('a belt carries a standing player', carried > 3 && carried < 5, `${n(carried, 2)} u/s`);
  run(p, ctx, 6, (_t, c) => { c.buttons |= Btn.Jump; });
  check('jumping off a belt keeps its momentum', p.vel.z > 3, `${n(p.vel.z, 2)} u/s`);
}

console.log(`\n${failures === 0 ? 'GROUND OK' : `${failures} GROUND PROBLEM(S)`}\n`);
void MOVE;
process.exit(failures === 0 ? 0 : 1);
