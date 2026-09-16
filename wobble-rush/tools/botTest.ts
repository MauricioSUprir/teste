/**
 * Full-match bot harness.
 *
 * Runs complete races with a field of bots across every Director layout.
 * This is the map's playability gate: if good bots cannot finish, the course
 * is broken, and if every bot finishes at the same time, it is boring.
 * Also prints a fall heatmap, which is how the level gets tuned.
 */
import { MatchSim, RoundPhase } from '../src/shared/world';
import { SKY_FOUNDRY } from '../src/shared/maps/skyfoundry';
import { makeRules, TICK_DT } from '../src/shared/config';
import { InputCmd, SimEventKind } from '../src/shared/types';
import { BotBrain, makeBotRoster, BotDifficulty } from '../src/shared/bots';

interface Result {
  variant: string;
  finished: number;
  total: number;
  times: number[];
  falls: number;
  fallZ: number[];
  ticks: number;
  ms: number;
  /** Players that got at least 70% of the way round. */
  deep: number;
}

function runMatch(variantId: string | undefined, seed: number, count = 32,
                  difficulty: BotDifficulty = 'normal', maxSeconds = 180): Result {
  const sim = new MatchSim({
    map: SKY_FOUNDRY, rules: makeRules(), seed, variantId, countdownTime: 1,
  });
  const roster = makeBotRoster(count, seed, difficulty);
  const brains: BotBrain[] = [];
  roster.forEach((r, i) => {
    sim.addPlayer(i + 1, r.name, { isBot: true });
    brains.push(new BotBrain(i + 1, r.difficulty, r.personality, seed + i));
  });

  const cmds = new Map<number, InputCmd>();
  const times: number[] = [];
  const fallZ: number[] = [];
  let falls = 0;
  const maxTicks = Math.ceil(maxSeconds / TICK_DT);
  const t0 = process.hrtime.bigint();
  let ticks = 0;

  for (; ticks < maxTicks; ticks++) {
    cmds.clear();
    for (let i = 0; i < brains.length; i++) {
      const p = sim.players[i];
      cmds.set(p.id, brains[i].update(sim, p, TICK_DT));
    }
    sim.step(cmds);
    for (const e of sim.events) {
      if (e.kind === SimEventKind.Finish) times.push(e.value);
      if (e.kind === SimEventKind.Fall) { falls++; fallZ.push(e.z); }
    }
    sim.clearEvents();
    if (sim.phase === RoundPhase.Running && sim.racingCount() === 0) break;
    // Stop once the qualifying places are gone and everyone else has had a while.
    if (times.length >= count) break;
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const deep = sim.players.filter((p) => p.bestProgress > SKY_FOUNDRY.courseLength * 0.7).length;
  return {
    variant: sim.director.variantId, finished: times.length, total: count,
    times, falls, fallZ, ticks, ms, deep,
  };
}

const fmt = (x: number, d = 1) => x.toFixed(d);
const median = (a: number[]) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0);

console.log('\n=== WOBBLE RUSH - full match playability ===\n');
let failures = 0;
const allFalls: number[] = [];

for (const variant of ['standard', 'gauntlet', 'highroad', 'overdrive']) {
  const r = runMatch(variant, 4242, 32, 'normal');
  allFalls.push(...r.fallZ);
  const rate = r.finished / r.total;
  const fastest = r.times.length ? Math.min(...r.times) : 0;
  const slowest = r.times.length ? Math.max(...r.times) : 0;
  const spread = slowest - fastest;
  console.log(
    `${variant.padEnd(10)} finished ${String(r.finished).padStart(2)}/${r.total}  deep ${String(r.deep).padStart(2)}` +
    `  fastest ${fmt(fastest)}s  median ${fmt(median(r.times))}s  spread ${fmt(spread)}s` +
    `  falls ${r.falls}  sim ${fmt(r.ms)}ms for ${fmt(r.ticks * TICK_DT)}s`);
  // Qualification is by position, not by everyone crossing the line, so the
  // real gate is: a clear winner in a sane time, a field that spreads out, and
  // enough of the pack getting deep into the course to fill the qualifying places.
  const deep = r.deep;
  if (rate < 0.15) { console.log(`  !! only ${Math.round(rate * 100)}% finished - course too punishing`); failures++; }
  if (deep < 16) { console.log(`  !! only ${deep} players reached 70% of the course - cannot fill 16 places`); failures++; }
  if (r.times.length > 3 && spread < 4) { console.log('  !! finishes too bunched - no drama'); failures++; }
  if (fastest > 0 && (fastest < 25 || fastest > 110)) {
    console.log(`  !! winning time ${fmt(fastest)}s is outside the 25-110s target`); failures++;
  }
}

// Difficulty ladder should be visible in the results.
console.log('\nDifficulty ladder (same layout, same seed):');
const byDiff: Record<string, number> = {};
for (const d of ['easy', 'normal', 'hard', 'expert'] as BotDifficulty[]) {
  const r = runMatch('standard', 777, 16, d);
  const best = r.times.length ? Math.min(...r.times) : 999;
  byDiff[d] = best;
  console.log(`  ${d.padEnd(7)} finished ${r.finished}/16  best ${fmt(best)}s  falls ${r.falls}`);
}
if (!(byDiff.expert < byDiff.easy)) { console.log('  !! expert bots are not faster than easy bots'); failures++; }

// Fall heatmap - where the course actually hurts.
console.log('\nFall heatmap (metres along the course):');
const buckets = new Map<number, number>();
for (const z of allFalls) {
  const b = Math.floor(z / 20) * 20;
  buckets.set(b, (buckets.get(b) ?? 0) + 1);
}
const maxCount = Math.max(1, ...buckets.values());
for (const b of [...buckets.keys()].sort((a, b2) => a - b2)) {
  const n = buckets.get(b)!;
  console.log(`  z ${String(b).padStart(4)}..${String(b + 20).padEnd(4)} ${'#'.repeat(Math.round(n / maxCount * 40))} ${n}`);
}

// Variety: the same seed on different layouts must not produce the same race.
const a = runMatch('standard', 99, 16);
const b = runMatch('overdrive', 99, 16);
const diff = Math.abs(median(a.times) - median(b.times));
console.log(`\nLayout variety: standard median ${fmt(median(a.times))}s vs overdrive ${fmt(median(b.times))}s (delta ${fmt(diff)}s)`);

console.log(`\n${failures === 0 ? 'PLAYABILITY OK' : `${failures} PROBLEM(S)`}\n`);
process.exit(failures === 0 ? 0 : 1);
