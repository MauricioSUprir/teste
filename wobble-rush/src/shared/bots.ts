/**
 * Bot brains.
 *
 * Bots drive the *same* InputCmd a human sends - they never get extra speed,
 * extra grip or knowledge of the future they could not have earned. What makes
 * a hard bot hard is better decisions: cleaner lines, earlier jumps, fewer
 * panic moments. What makes an easy bot easy is hesitation and mistakes.
 *
 * Because obstacles are deterministic functions of time, a bot can legitimately
 * "read the rhythm" of a hammer the same way a practised player does.
 */
import { Vec3, v3, v3set, clamp, Rng, angleDelta } from './math';
import { Collider, colliderPointVelocity } from './collision';
import { MapDef, RouteDef } from './mapdef';
import { InputCmd, Btn, MoveState, PlayerSim, makeInput } from './types';
import { MatchSim } from './world';
import { DIVE } from './config';

/** How far a bot believes it can travel: measured from the sim, not guessed. */
const JUMP_REACH = 4.4;
const DIVE_REACH = 7.4;
/** Where a bot commits to a jump - roughly one stride from the edge. */
const TAKEOFF_PROBE = 1.5;
/** Ground probes start this far above the feet so climbs read correctly. */
const PROBE_RISE = 3.0;
const PROBE_REACH = 6.5;
/** A drop bigger than this counts as a gap rather than a step. */
const MAX_SAFE_DROP = 2.8;

export type BotDifficulty = 'easy' | 'normal' | 'hard' | 'expert';
export type BotPersonality = 'cautious' | 'aggressive' | 'speedrunner' | 'beginner' | 'risktaker';

interface DifficultyProfile {
  /** Seconds between decisions - higher means slower reactions. */
  reaction: number;
  /** Chance per decision of doing something daft. */
  errorRate: number;
  /** How early a gap is spotted, in metres. */
  lookahead: number;
  /** Steering noise amplitude. */
  wobble: number;
  /** Probability of using a dive when one would help. */
  diveSkill: number;
  /** How well it dodges a swinging hazard, 0..1. */
  hazardRead: number;
}

const DIFFICULTY: Record<BotDifficulty, DifficultyProfile> = {
  easy:   { reaction: 0.30, errorRate: 0.15, lookahead: 3.4, wobble: 0.45, diveSkill: 0.22, hazardRead: 0.38 },
  normal: { reaction: 0.20, errorRate: 0.09, lookahead: 4.2, wobble: 0.30, diveSkill: 0.38, hazardRead: 0.58 },
  hard:   { reaction: 0.14, errorRate: 0.05, lookahead: 5.4, wobble: 0.16, diveSkill: 0.6,  hazardRead: 0.72 },
  expert: { reaction: 0.08, errorRate: 0.02, lookahead: 6.5, wobble: 0.07, diveSkill: 0.8,  hazardRead: 0.9 },
};

interface PersonalityProfile {
  /** Preference for risky routes, 0..1. */
  risk: number;
  /** Multiplier on how aggressively it dives at other players. */
  aggression: number;
  /** Tendency to take the same line as everyone else (0 = loves alternatives). */
  conformity: number;
  /** Extra caution near hazards. */
  patience: number;
}

const PERSONALITY: Record<BotPersonality, PersonalityProfile> = {
  cautious:   { risk: 0.12, aggression: 0.1, conformity: 0.75, patience: 1.5 },
  aggressive: { risk: 0.55, aggression: 1.0, conformity: 0.4,  patience: 0.55 },
  speedrunner:{ risk: 0.85, aggression: 0.35, conformity: 0.15, patience: 0.35 },
  beginner:   { risk: 0.3,  aggression: 0.25, conformity: 0.9,  patience: 1.1 },
  risktaker:  { risk: 1.0,  aggression: 0.6, conformity: 0.1,  patience: 0.4 },
};

export const BOT_NAMES = [
  'Pip', 'Nova', 'Bolt', 'Wisp', 'Tango', 'Juno', 'Rex', 'Momo', 'Zuzu', 'Kip',
  'Vega', 'Dash', 'Ollie', 'Sable', 'Pixel', 'Bramble', 'Cosmo', 'Nix', 'Fig', 'Dot',
  'Quill', 'Rune', 'Sprocket', 'Tilly', 'Umbra', 'Vim', 'Waffle', 'Yolk', 'Zephyr', 'Ash',
  'Biscuit', 'Clover',
];

const _tmp = v3();
const _probe = v3();
const _hazVel = v3();

export class BotBrain {
  readonly playerId: number;
  readonly difficulty: BotDifficulty;
  readonly personality: BotPersonality;
  private rng: Rng;
  private cmd: InputCmd = makeInput();
  private decisionTimer = 0;
  private routeId = '';
  private nodeIndex = 1;
  /** Latched steering target, refreshed on each decision tick. */
  private target: Vec3 = v3();
  private wobblePhase: number;
  private stuckTimer = 0;
  private lastProgress = 0;
  private jumpHold = 0;
  private diveHold = 0;
  private waitTimer = 0;
  private edgeWait = 0;
  private hazardWait = 0;
  private hazardCommit = 0;
  private hazardReact = 0;
  private nodeTimer = 0;
  private scratch: Collider[] = [];

  constructor(playerId: number, difficulty: BotDifficulty, personality: BotPersonality, seed: number) {
    this.playerId = playerId;
    this.difficulty = difficulty;
    this.personality = personality;
    this.rng = new Rng((seed ^ (playerId * 0x9e3779b9)) >>> 0);
    this.wobblePhase = this.rng.next() * Math.PI * 2;
  }

  /** Picks a branch at the fork according to taste - not everyone runs the same line. */
  private chooseRoute(sim: MatchSim, p: PlayerSim): RouteDef | null {
    const map: MapDef = sim.map;
    const groups = sim.getActiveGroups();
    const pers = PERSONALITY[this.personality];
    const diff = DIFFICULTY[this.difficulty];
    let best: RouteDef | null = null;
    let bestScore = -Infinity;
    for (const r of map.routes) {
      if (r.group && !groups.has(r.group)) continue;
      // Only consider routes that cover where we are now AND still lead
      // somewhere. A route that ends where we already stand is a dead end, and
      // following one to its last waypoint is how a bot stands still forever.
      if (p.progress < r.startDist - 8) continue;
      if (p.progress >= r.endDist - 1.5) continue;
      // Risky lines pay off only if this bot can actually handle them.
      const capability = 1 - diff.errorRate * 2.4;
      const appetite = pers.risk * capability;
      let score = 1 - Math.abs(r.risk - appetite) * 1.4;
      score += (1 - pers.conformity) * this.rng.noise() * 0.5;
      // Follow the route you are actually standing on. Without this a bot that
      // falls onto a lower deck keeps steering toward the path above its head.
      const near = nearestPointDistance(r, p.pos);
      score -= clamp(near / 12, 0, 1) * 2.2;
      if (score > bestScore) { bestScore = score; best = r; }
    }
    return best;
  }

  private routeById(sim: MatchSim, id: string): RouteDef | undefined {
    return sim.map.routes.find((r) => r.id === id);
  }

  /** Returns the input this bot wants to send this tick. */
  update(sim: MatchSim, p: PlayerSim, dt: number): InputCmd {
    const cmd = this.cmd;
    cmd.buttons = 0;
    cmd.moveX = 0;
    cmd.moveZ = 0;
    cmd.camYaw = 0;
    cmd.tick = sim.tick;

    if (p.state === MoveState.Frozen || p.state === MoveState.Eliminated ||
        p.state === MoveState.Finished || p.state === MoveState.Respawning) {
      return cmd;
    }

    const diff = DIFFICULTY[this.difficulty];
    const pers = PERSONALITY[this.personality];

    this.decisionTimer -= dt;
    if (this.jumpHold > 0) this.jumpHold -= dt;
    if (this.diveHold > 0) this.diveHold -= dt;
    if (this.waitTimer > 0) this.waitTimer -= dt;

    // --- route selection -------------------------------------------------
    let route = this.routeId ? this.routeById(sim, this.routeId) : undefined;
    const groups = sim.getActiveGroups();
    const routeDead = route && route.group && !groups.has(route.group);
    const routeExhausted = route != null &&
      (p.progress > route.endDist - 2.5 ||
       (this.nodeIndex >= route.points.length - 1 &&
        Math.hypot(p.pos.x - route.points[route.points.length - 1][0],
                   p.pos.z - route.points[route.points.length - 1][2]) < 3));
    if (!route || routeDead || routeExhausted) {
      const next = this.chooseRoute(sim, p);
      if (next) {
        route = next;
        this.routeId = next.id;
        this.nodeIndex = this.nearestNodeAhead(next, p.pos);
      }
    }

    // --- steering target -------------------------------------------------
    if (route) {
      const pts = route.points;
      // Advance along the polyline as we reach each node. This has to be a 3D
      // test: on a ramp the next waypoints are stacked almost vertically above
      // us, and a flat distance check happily skips them - which steers the bot
      // off the side of the ramp it is currently climbing.
      let advanced = false;
      while (this.nodeIndex < pts.length - 1) {
        const n = pts[this.nodeIndex];
        const d = Math.hypot(p.pos.x - n[0], (p.pos.y - n[1]) * 0.9, p.pos.z - n[2]);
        if (d < Math.min(3.2, Math.max(1.8, route.width * 0.4))) { this.nodeIndex++; advanced = true; }
        else break;
      }
      // Deadlock guard: if we have hovered near a waypoint for seconds without
      // reaching it, take it as reached and move on rather than orbiting it.
      if (advanced) this.nodeTimer = 0; else this.nodeTimer += dt;
      if (this.nodeTimer > 4 && this.nodeIndex < pts.length - 1) {
        const n = pts[this.nodeIndex];
        if (Math.hypot(p.pos.x - n[0], p.pos.z - n[2]) < 4) this.nodeIndex++;
        this.nodeTimer = 0;
      }
      const n = pts[Math.min(this.nodeIndex, pts.length - 1)];
      v3set(this.target, n[0], n[1], n[2]);
      // Spread out across the corridor so 32 bots do not form a conga line.
      const spread = (1 - pers.conformity) * route.width * 0.35;
      const off = Math.sin(this.wobblePhase + sim.tick * 0.012) * spread;
      this.target.x += off;
    } else {
      v3set(this.target, p.pos.x, p.pos.y, p.pos.z + 10);
    }

    // --- movement --------------------------------------------------------
    let dx = this.target.x - p.pos.x;
    let dz = this.target.z - p.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len; dz /= len;

    // Steering noise: bots should not run on rails.
    const wob = Math.sin(sim.tick * 0.05 + this.wobblePhase) * diff.wobble * 0.35;
    const cosW = Math.cos(wob), sinW = Math.sin(wob);
    const sx = dx * cosW - dz * sinW;
    const sz = dx * sinW + dz * cosW;

    // Bots steer in world space, so convert to the same camera-relative axes a
    // human sends with camYaw 0: forward is +Z (moveZ = -1) and screen-right
    // is -X (moveX = +1).
    cmd.moveX = clamp(-sx, -1, 1);
    cmd.moveZ = clamp(-sz, -1, 1);

    if (this.waitTimer > 0) {
      // Hold position: back off slightly rather than standing perfectly still.
      cmd.moveX *= -0.25;
      cmd.moveZ *= -0.25;
    }

    // --- hazard reading --------------------------------------------------
    // Two different answers to a hazard, and picking the wrong one is what
    // separates a good bot from a twitchy one:
    //   low and sweeping  -> jump over it
    //   tall or swinging  -> stop and let it pass
    // Panic-jumping at everything leaves a bot airborne and helpless, so
    // reactions are rate-limited and the bot commits if it has waited too long.
    if (this.hazardCommit > 0) this.hazardCommit -= dt;
    if (this.hazardReact > 0) this.hazardReact -= dt;
    const threat = this.readHazards(sim, p, dx, dz, diff.lookahead);
    // Skill is *perception*, not twitchiness. Gating the reaction on a skill
    // roll made expert bots react to everything - including things that were
    // never going to hit them - and finish slower than beginners. Instead,
    // skill sharpens the estimate: a weak bot both panics at ghosts and walks
    // into real hammers, a strong one reads the situation as it truly is.
    const perceived = clamp(
      threat.danger + this.rng.noise() * (1 - diff.hazardRead) * 0.9, 0, 1.5);
    if (perceived > 0.45 && this.hazardCommit <= 0 && this.hazardReact <= 0) {
      if (threat.low && p.grounded && this.jumpHold <= 0) {
        cmd.buttons |= Btn.Jump;
        this.jumpHold = 0.5;
        this.hazardReact = 0.75;
      } else if (!threat.low) {
        const wait = 0.2 + pers.patience * 0.3 * this.rng.range(0.6, 1.2);
        this.waitTimer = Math.max(this.waitTimer, wait);
        this.hazardWait += wait;
        this.hazardReact = 0.3;
        // Standing still forever in front of a swinging hammer is not caution,
        // it is a stuck bot. After a while, take the hit and push through.
        if (this.hazardWait > 1.6) { this.hazardCommit = 2.2; this.hazardWait = 0; this.waitTimer = 0; }
      }
    }
    if (perceived <= 0.1) this.hazardWait = Math.max(0, this.hazardWait - dt * 0.5);

    // --- gaps ------------------------------------------------------------
    // Two different questions need two different probes, and conflating them
    // was making bots jump 4 m early and land short of the gap they feared:
    //   "should I take off NOW?"  -> a probe at the take-off point
    //   "should I slow down?"     -> a probe scaled by how fast I am moving
    const speedNow = Math.hypot(p.vel.x, p.vel.z);
    const probeTop = p.pos.y + PROBE_RISE;
    const groundAt = (dist: number): number => {
      v3set(_probe, p.pos.x + dx * dist, probeTop, p.pos.z + dz * dist);
      const hit = sim.world.raycastDown(_probe.x, _probe.y, _probe.z, PROBE_REACH, this.scratch);
      return hit < 0 ? Infinity : p.pos.y - (probeTop - hit);
    };

    const takeoffGap = groundAt(TAKEOFF_PROBE) > MAX_SAFE_DROP;
    const brakeGap = groundAt(1.2 + speedNow * 0.32) > MAX_SAFE_DROP;

    if (p.grounded && (takeoffGap || brakeGap)) {
      const far = this.gapWidth(sim, p, dx, dz);
      const canJump = far <= JUMP_REACH;
      const canDive = far <= DIVE_REACH && p.diveCooldown <= 0;
      const mistake = this.rng.next() < diff.errorRate * 0.6;

      if (takeoffGap && canJump && this.jumpHold <= 0 && !mistake) {
        cmd.buttons |= Btn.Jump;
        this.jumpHold = 0.45;
        if (far > JUMP_REACH * 0.78 && this.rng.next() < diff.diveSkill) this.diveHold = 0.13;
      } else if (takeoffGap && canDive && this.jumpHold <= 0 && this.rng.next() < diff.diveSkill && !mistake) {
        cmd.buttons |= Btn.Jump;
        this.diveHold = 0.12;
        this.jumpHold = 0.55;
      } else if (!canJump && !canDive && !mistake) {
        // Genuinely uncrossable: stop at the lip and wait for a ferry, a
        // platform, or a better line. Brake harder the faster we are going.
        const urgency = clamp(speedNow / 5.5, 0.35, 1.3);
        const brake = (pers.patience > 0.8 ? -0.4 : -0.22) * urgency;
        cmd.moveX *= brake;
        cmd.moveZ *= brake;
        this.edgeWait += dt;
        if (this.edgeWait > 4.5) { this.nodeIndex = Math.max(1, this.nodeIndex - 1); this.edgeWait = 0; }
      }
    } else {
      this.edgeWait = 0;
    }

    // Dive follows the jump by a beat, exactly like a good human player does.
    if (this.diveHold > 0 && !p.grounded && p.state === MoveState.Air && p.diveCooldown <= 0) {
      if (this.diveHold < 0.06) {
        cmd.buttons |= Btn.Dive;
        this.diveHold = 0;
      }
    }

    // --- opportunistic dive at the finish line ---------------------------
    if (route && p.progress > sim.map.courseLength - 12 && p.diveCooldown <= 0 &&
        this.rng.next() < diff.diveSkill * 0.4) {
      cmd.buttons |= Btn.Dive;
    }

    // --- shoving other players -------------------------------------------
    if (pers.aggression > 0.3 && p.diveCooldown <= 0 && p.grounded) {
      const victim = this.findVictim(sim, p, dx, dz);
      if (victim && this.rng.next() < 0.012 * pers.aggression * (0.5 + diff.hazardRead)) {
        cmd.buttons |= Btn.Dive;
      }
    }

    // --- unsticking -------------------------------------------------------
    if (Math.abs(p.progress - this.lastProgress) < 0.02) this.stuckTimer += dt;
    else this.stuckTimer = 0;
    this.lastProgress = p.progress;
    if (this.stuckTimer > 1.1) {
      cmd.buttons |= Btn.Jump;
      cmd.moveX = clamp(cmd.moveX + this.rng.range(-1, 1), -1, 1);
      if (this.stuckTimer > 2.4 && p.diveCooldown <= 0) cmd.buttons |= Btn.Dive;
      if (this.stuckTimer > 3.2) {
        this.nodeIndex = Math.min(this.nodeIndex + 1, (route?.points.length ?? 2) - 1);
        this.stuckTimer = 0;
      }
    }

    // --- occasional human error -------------------------------------------
    if (this.decisionTimer <= 0) {
      this.decisionTimer = diff.reaction * this.rng.range(0.7, 1.3);
      if (this.rng.next() < diff.errorRate * 0.5) {
        // A wrong step, a late jump, a moment of panic.
        this.waitTimer = this.rng.range(0.1, 0.35);
      }
    }

    return cmd;
  }

  /** Nearest route node that is still ahead of us. */
  private nearestNodeAhead(route: RouteDef, pos: Vec3): number {
    let best = 1;
    let bestD = Infinity;
    for (let i = 1; i < route.points.length; i++) {
      const n = route.points[i];
      const d = Math.hypot(pos.x - n[0], (pos.y - n[1]) * 1.4, pos.z - n[2]);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  /**
   * Looks for hazards we are about to run into.
   * Only counts a hazard as dangerous if it is close *and* closing - a hammer
   * swinging away from you is scenery, not a threat.
   */
  private readHazards(sim: MatchSim, p: PlayerSim, dx: number, dz: number, lookahead: number):
    { danger: number; low: boolean } {
    const reach = Math.min(lookahead, 4.5);
    const cx = p.pos.x + dx * reach * 0.5;
    const cz = p.pos.z + dz * reach * 0.5;
    const r = reach * 0.75;
    sim.world.query(cx - r, p.pos.y - 1.5, cz - r, cx + r, p.pos.y + 2.8, cz + r, this.scratch);
    let worst = 0;
    let worstLow = false;
    for (let i = 0; i < this.scratch.length; i++) {
      const c = this.scratch[i];
      if (c.impact <= 0) continue;
      const ox = p.pos.x - c.pos.x, oz = p.pos.z - c.pos.z;
      const d = Math.hypot(ox, oz);
      if (d > reach + 1.5) continue;
      colliderPointVelocity(_hazVel, c, p.pos);
      // Closing speed along the line from the hazard to us.
      const inv = d > 0.01 ? 1 / d : 0;
      const closing = (_hazVel.x * ox + _hazVel.z * oz) * inv;
      const spin = Math.hypot(c.angVel.x, c.angVel.y, c.angVel.z);
      if (closing < 1.2 && spin < 1.0) continue;
      const proximity = clamp(1 - d / (reach + 1.5), 0, 1);
      const danger = proximity * clamp((Math.max(closing, 0) + spin * 2) / 7, 0.25, 1.3);
      if (danger > worst) {
        worst = danger;
        // "Low" means it passes below the head: hurdle it.
        worstLow = (c.pos.y - p.pos.y) < 1.15 && c.half.y < 1.0;
      }
    }
    return { danger: clamp(worst, 0, 1), low: worstLow };
  }

  /** Walks a probe forward to find where landable ground resumes. */
  private gapWidth(sim: MatchSim, p: PlayerSim, dx: number, dz: number): number {
    const top = p.pos.y + PROBE_RISE;
    for (let d = 1.8; d <= 9; d += 0.6) {
      const hit = sim.world.raycastDown(
        p.pos.x + dx * d, top, p.pos.z + dz * d, PROBE_REACH, this.scratch);
      if (hit >= 0 && (p.pos.y - (top - hit)) <= MAX_SAFE_DROP) return d;
    }
    return 99;
  }

  private findVictim(sim: MatchSim, p: PlayerSim, dx: number, dz: number): PlayerSim | null {
    for (const o of sim.players) {
      if (o.id === p.id || o.eliminated) continue;
      const ox = o.pos.x - p.pos.x, oz = o.pos.z - p.pos.z;
      const d = Math.hypot(ox, oz);
      if (d > DIVE.forward * 0.5 || d < 0.6) continue;
      if ((ox / d) * dx + (oz / d) * dz < 0.7) continue;
      return o;
    }
    return null;
  }
}

/** Shortest 3D distance from a position to a route polyline. */
function nearestPointDistance(route: RouteDef, pos: Vec3): number {
  let best = Infinity;
  const pts = route.points;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const ex = b[0] - a[0], ey = b[1] - a[1], ez = b[2] - a[2];
    const lenSq = ex * ex + ey * ey + ez * ez;
    if (lenSq < 1e-6) continue;
    let t = ((pos.x - a[0]) * ex + (pos.y - a[1]) * ey + (pos.z - a[2]) * ez) / lenSq;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = pos.x - (a[0] + ex * t);
    const dy = (pos.y - (a[1] + ey * t)) * 1.6;
    const dz = pos.z - (a[2] + ez * t);
    const d = dx * dx + dy * dy + dz * dz;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

/** Builds a varied field of bots: never 32 clones of the same runner. */
export function makeBotRoster(count: number, seed: number, avgDifficulty: BotDifficulty = 'normal'): {
  difficulty: BotDifficulty; personality: BotPersonality; name: string;
}[] {
  const rng = new Rng(seed >>> 0);
  const personalities: BotPersonality[] = ['cautious', 'aggressive', 'speedrunner', 'beginner', 'risktaker'];
  const ladder: BotDifficulty[] = ['easy', 'normal', 'hard', 'expert'];
  const centre = ladder.indexOf(avgDifficulty);
  const out: { difficulty: BotDifficulty; personality: BotPersonality; name: string }[] = [];
  const names = [...BOT_NAMES];
  for (let i = 0; i < count; i++) {
    // Spread difficulty around the lobby's level so a match has a shape:
    // a couple of stragglers, a pack, and one or two genuinely quick runners.
    const offset = Math.round(rng.noise() * 1.3);
    const d = ladder[clamp(centre + offset, 0, ladder.length - 1)];
    const personality = personalities[rng.int(0, personalities.length)];
    const idx = rng.int(0, names.length);
    const name = names.length ? names.splice(idx, 1)[0] : `Runner ${i + 1}`;
    out.push({ difficulty: d, personality, name });
  }
  return out;
}

export { angleDelta, _tmp };
