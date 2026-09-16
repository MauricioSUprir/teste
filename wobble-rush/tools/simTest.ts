/**
 * Headless simulation harness.
 *
 * Runs the authoritative sim with no renderer so the core can be measured
 * before a single pixel is drawn: jump arc, dive range, tunnelling, crowd
 * performance. Run with `npm run test:sim`.
 */
import { MatchSim, RoundPhase } from '../src/shared/world';
import { SKY_FOUNDRY } from '../src/shared/maps/skyfoundry';
import { makeRules, TICK_DT } from '../src/shared/config';
import { makeInput, InputCmd, Btn, MoveState, PlayerSim } from '../src/shared/types';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
  if (!ok) failures++;
};
const num = (x: number, d = 2) => x.toFixed(d);

function newSim(variant?: string, playerCount = 1) {
  const sim = new MatchSim({
    map: SKY_FOUNDRY, rules: makeRules(), seed: 12345, variantId: variant, countdownTime: 0,
  });
  for (let i = 0; i < playerCount; i++) sim.addPlayer(i + 1, `P${i + 1}`, { isBot: i > 0 });
  return sim;
}

function run(sim: MatchSim, ticks: number, fn?: (t: number, cmds: Map<number, InputCmd>) => void) {
  const cmds = new Map<number, InputCmd>();
  for (const p of sim.players) cmds.set(p.id, makeInput());
  for (let t = 0; t < ticks; t++) {
    for (const c of cmds.values()) { c.moveX = 0; c.moveZ = 0; c.buttons = 0; c.tick = sim.tick; }
    fn?.(t, cmds);
    sim.step(cmds);
    sim.clearEvents();
  }
}

console.log('\n=== WOBBLE RUSH - core simulation checks ===\n');

// ── 1. Settling on the start deck ────────────────────────────────────────
{
  const sim = newSim('standard');
  const p = sim.players[0];
  const startY = p.pos.y;
  run(sim, 60);
  check('player settles on the start deck', p.grounded && Math.abs(p.pos.y) < 0.35,
    `y=${num(p.pos.y)} (spawned ${num(startY)}) grounded=${p.grounded}`);
  check('no jitter at rest', Math.abs(p.vel.y) < 0.6 && Math.hypot(p.vel.x, p.vel.z) < 0.05,
    `vel=(${num(p.vel.x)},${num(p.vel.y)},${num(p.vel.z)})`);
}

// ── 2. Run-up speed and acceleration feel ────────────────────────────────
{
  const sim = newSim('standard');
  const p = sim.players[0];
  run(sim, 30);
  let timeTo90 = -1;
  const target = 7.3 * 0.9;
  run(sim, 120, (t, cmds) => {
    const c = cmds.get(1)!; c.moveZ = -1;
    if (timeTo90 < 0 && Math.hypot(p.vel.x, p.vel.z) >= target) timeTo90 = t * TICK_DT;
  });
  const speed = Math.hypot(p.vel.x, p.vel.z);
  check('reaches top speed', speed > 7.0 && speed < 7.6, `${num(speed)} u/s`);
  check('acceleration feels snappy but not instant', timeTo90 > 0.06 && timeTo90 < 0.35,
    `${num(timeTo90, 3)}s to 90% speed`);
}

// ── 3. Jump arc ──────────────────────────────────────────────────────────
{
  const sim = newSim('standard');
  const p = sim.players[0];
  run(sim, 30);
  const y0 = p.pos.y;
  let peak = y0, airTicks = 0, landed = false;
  run(sim, 120, (t, cmds) => {
    const c = cmds.get(1)!;
    if (t < 20) c.buttons |= Btn.Jump;
    if (t > 0 && !landed) {
      if (!p.grounded) airTicks++;
      peak = Math.max(peak, p.pos.y);
      if (airTicks > 3 && p.grounded) landed = true;
    }
  });
  const height = peak - y0;
  check('jump height is platformer-appropriate', height > 1.4 && height < 2.1, `${num(height)} m`);
  check('airtime is snappy', airTicks * TICK_DT > 0.45 && airTicks * TICK_DT < 0.85,
    `${num(airTicks * TICK_DT, 3)} s`);
}

// ── 4. Jump distance while running (the number level design is tuned to) ──
{
  const sim = newSim('standard');
  const p = sim.players[0];
  run(sim, 30);
  run(sim, 40, (_t, cmds) => { cmds.get(1)!.moveZ = -1; });
  const z0 = p.pos.z, y0 = p.pos.y;
  let jumped = false, dist = 0;
  run(sim, 120, (t, cmds) => {
    const c = cmds.get(1)!; c.moveZ = -1;
    if (t < 18) c.buttons |= Btn.Jump;
    if (!p.grounded) jumped = true;
    if (jumped && p.grounded && dist === 0 && p.pos.y > y0 - 1) dist = Math.abs(p.pos.z - z0);
  });
  check('running jump clears a ~4.5 m gap', dist > 4.0 && dist < 6.0, `${num(dist)} m`);
}

// ── 5. Dive range ────────────────────────────────────────────────────────
{
  const sim = newSim('standard');
  const p = sim.players[0];
  run(sim, 30);
  run(sim, 40, (_t, cmds) => { cmds.get(1)!.moveZ = -1; });
  const z0 = p.pos.z;
  let dived = false, dist = 0;
  run(sim, 150, (t, cmds) => {
    const c = cmds.get(1)!; c.moveZ = -1;
    if (t === 2) c.buttons |= Btn.Dive;
    if (p.state === MoveState.Dive) dived = true;
    if (dived && (p.state === MoveState.GetUp || p.state === MoveState.Idle) && dist === 0) {
      dist = Math.abs(p.pos.z - z0);
    }
  });
  check('dive covers more ground than a jump', dist > 6.0 && dist < 11.0, `${num(dist)} m`);
  check('dive resolves back to standing', p.state === MoveState.Idle || p.state === MoveState.Run,
    `state=${p.state}`);
}

// ── 6. Hazards actually knock players about ──────────────────────────────
{
  const sim = newSim('standard');
  const p = sim.players[0];
  run(sim, 30);
  let sawKnock = false;
  // Stand in the sweep path, away from the hub where the arm actually moves fast.
  p.pos.x = 5;
  run(sim, 60 * 12, (_t, cmds) => {
    const c = cmds.get(1)!;
    c.moveZ = p.pos.z < 15 ? -1 : 0;
    if (p.state === MoveState.Ragdoll || p.state === MoveState.Stumble) sawKnock = true;
  });
  check('sweepers knock players over', sawKnock, `final state=${p.state}`);
  check('player never falls through the floor', p.pos.y > SKY_FOUNDRY.killY, `y=${num(p.pos.y)}`);
}

// ── 7. Respawn after a fall ──────────────────────────────────────────────
{
  const sim = newSim('standard');
  const p = sim.players[0];
  run(sim, 30);
  p.pos.x = 60; p.pos.y = 5; p.pos.z = 60;   // shove into the void
  let respawned = false;
  run(sim, 60 * 6, () => { if (p.checkpoint >= 0 && p.pos.y > -10 && p.invuln > 0) respawned = true; });
  check('falling respawns at a checkpoint', respawned && p.pos.y > -10,
    `pos=(${num(p.pos.x)},${num(p.pos.y)},${num(p.pos.z)}) falls=${p.falls}`);
}

// ── 8. Round Director: variants really change the world ──────────────────
{
  const a = newSim('standard');
  const b = newSim('highroad');
  check('variant standard opens the risky right route', a.isGroupActive('routeR'));
  check('variant highroad closes the right route', !b.isGroupActive('routeR'));
  check('variant highroad opens the upper catwalk', b.isGroupActive('upper'));

  const c = newSim('standard');
  c.phase = RoundPhase.Running;
  c.runTime = 0;
  const tilesBefore = c.isGroupActive('routeR_tiles');
  // Fast-forward past the collapse event.
  run(c, 60 * 50);
  check('phase event collapses the tile path mid-round',
    tilesBefore && !c.isGroupActive('routeR_tiles') && c.isGroupActive('routeR_broken'),
    `fired=[${c.director.fired.join(',')}]`);
}

// ── 9. Variant rolls differ across matches ───────────────────────────────
{
  const seen = new Set<string>();
  for (let seed = 0; seed < 40; seed++) {
    const sim = new MatchSim({ map: SKY_FOUNDRY, rules: makeRules(), seed, countdownTime: 0 });
    seen.add(sim.director.variantId);
  }
  check('director rolls a spread of layouts', seen.size >= 3, `layouts=${[...seen].join(',')}`);
}

// ── 10. Determinism: same seed + same inputs => same result ──────────────
{
  const hashRun = () => {
    const sim = newSim('standard', 4);
    run(sim, 300, (t, cmds) => {
      let i = 0;
      for (const c of cmds.values()) {
        c.moveZ = -1;
        c.moveX = Math.sin((t + i * 30) * 0.05);
        if (t % 40 === i * 7 % 40) c.buttons |= Btn.Jump;
        i++;
      }
    });
    return sim.players.map((p) => `${p.pos.x.toFixed(6)},${p.pos.y.toFixed(6)},${p.pos.z.toFixed(6)}`).join('|');
  };
  check('simulation is deterministic', hashRun() === hashRun());
}

// ── 11. Crowd performance ────────────────────────────────────────────────
{
  const sim = newSim('overdrive', 32);
  run(sim, 60);
  const t0 = process.hrtime.bigint();
  const TICKS = 600;
  run(sim, TICKS, (t, cmds) => {
    let i = 0;
    for (const c of cmds.values()) {
      c.moveZ = -1;
      c.moveX = Math.sin((t + i * 11) * 0.07) * 0.6;
      if ((t + i) % 45 === 0) c.buttons |= Btn.Jump;
      i++;
    }
  });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const perTick = ms / TICKS;
  check('32 players simulate well inside the 16.6 ms budget', perTick < 3.0,
    `${num(perTick, 3)} ms/tick (${num(perTick / 16.67 * 100, 1)}% of a frame)`);

  const alive = sim.players.filter((p) => p.pos.y > SKY_FOUNDRY.killY).length;
  const advanced = sim.players.filter((p) => p.bestProgress > 20).length;
  check('crowd makes progress instead of jamming at the start', advanced >= 24,
    `${advanced}/32 past 20 m, ${alive} in bounds`);
}

// ── 12. Progress and ranking ─────────────────────────────────────────────
{
  const sim = newSim('standard', 3);
  run(sim, 30);
  sim.players[0].pos.z = 120;
  sim.players[1].pos.z = 60;
  sim.players[2].pos.z = 10;
  run(sim, 5);
  const order = sim.liveRanking().map((p: PlayerSim) => p.id);
  check('ranking follows course progress', order[0] === 1 && order[2] === 3, `order=${order.join('>')}`);
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
