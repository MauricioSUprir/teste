/**
 * MatchSim - the authoritative match world.
 *
 * Owns the collision world, obstacles, volumes, players and the Round
 * Director. The server runs it for real; every client runs the very same class
 * for prediction, which is why it must never touch Math.random, Date.now or
 * anything renderer-shaped.
 */
import {
  v3, v3set, v3copy, clamp, Rng, hashString, lerp,
} from './math';
import {
  CollisionWorld, Collider, ShapeKind, Surface, makeCollider, refreshAabb,
} from './collision';
import { qFromEulerArray, qIdentity } from './quat';
import {
  MapDef, RouteDef, GameModeKind, groupsForVariant,
} from './mapdef';
import {
  ObstacleRuntime, createObstacle, updateObstacle, setObstacleActive, triggerCrumble, VolumeDef,
} from './obstacles';
import { RuleSet, TICK_DT, CHAR, RESPAWN } from './config';
import {
  PlayerSim, InputCmd, MoveState, SimEvent, SimEventKind, makeInput, makeAbilityRuntime,
} from './types';
import {
  SimContext, stepCharacter, resolvePlayerCollisions, applyImpulse, emit, capsuleSegment,
} from './character';

export const enum RoundPhase {
  Loading = 0,
  Intro = 1,
  Countdown = 2,
  Running = 3,
  Ending = 4,
  Over = 5,
}

interface RouteRuntime {
  def: RouteDef;
  /** Cumulative length at each point. */
  cum: number[];
  total: number;
}

export interface DirectorState {
  variantId: string;
  /** Phase events that already fired. */
  fired: string[];
  /** Currently telegraphed event, if any. */
  pending: string | null;
  pendingIn: number;
  hazardScale: number;
  activeGroups: string[];
}

export interface MatchConfig {
  map: MapDef;
  /** Defaults to the map's first declared mode. */
  mode?: GameModeKind;
  /** Number of teams; 0 means free-for-all. */
  teamCount?: number;
  rules: RuleSet;
  seed: number;
  /** Forces a layout instead of rolling one (custom rooms, replays, time trials). */
  variantId?: string;
  /** Disable Director phase events (ranked/time-trial purity). */
  phaseEventsEnabled?: boolean;
  qualifyCount?: number;
  countdownTime?: number;
  introTime?: number;
}

const _tmp = v3();
const _capA = v3();
const _capB = v3();

export class MatchSim {
  readonly map: MapDef;
  readonly rules: RuleSet;
  readonly world = new CollisionWorld(10);
  readonly players: PlayerSim[] = [];
  readonly byId = new Map<number, PlayerSim>();
  readonly events: SimEvent[] = [];
  readonly obstacles: ObstacleRuntime[] = [];
  readonly volumes: VolumeDef[] = [];
  readonly director: DirectorState;

  readonly mode: GameModeKind;
  readonly teamCount: number;
  phase: RoundPhase = RoundPhase.Loading;
  phaseTime = 0;
  /** Ticks since the sim was created (obstacles use this: they move during the countdown). */
  tick = 0;
  /** Seconds since GO. Negative during the countdown. */
  runTime = 0;
  countdownTime: number;
  introTime: number;
  qualifyCount: number;
  qualifiedCount = 0;
  finishedOrder: number[] = [];
  rng: Rng;

  private ctx: SimContext;
  private routes: RouteRuntime[] = [];
  private activeGroups = new Set<string>();
  private groupProps = new Map<string, Collider[]>();
  private groupObstacles = new Map<string, ObstacleRuntime[]>();
  private volumeGroups = new Map<string, VolumeDef[]>();
  private obstacleByColliderOwner = new Map<number, ObstacleRuntime>();
  private colliderScratch: Collider[] = [];
  private hazardScale = 1;
  private phaseEventsEnabled: boolean;
  private lastFinishTime = -99;
  private readonly seed: number;

  constructor(cfg: MatchConfig) {
    this.map = cfg.map;
    this.mode = cfg.mode ?? cfg.map.modes[0] ?? 'race';
    this.teamCount = cfg.teamCount ?? 0;
    this.rules = cfg.rules;
    this.seed = cfg.seed;
    this.rng = new Rng((cfg.seed ^ hashString(cfg.map.id)) >>> 0);
    this.countdownTime = cfg.countdownTime ?? 3.2;
    this.introTime = cfg.introTime ?? 0;
    this.phaseEventsEnabled = cfg.phaseEventsEnabled !== false;
    this.qualifyCount = cfg.qualifyCount ?? Math.max(1, Math.round(cfg.map.maxPlayers * cfg.map.qualifyRatio));

    const variantId = cfg.variantId ?? this.rollVariant();
    this.director = {
      variantId, fired: [], pending: null, pendingIn: 0, hazardScale: 1, activeGroups: [],
    };

    this.ctx = {
      world: this.world,
      rules: this.rules,
      events: this.events,
      rng: this.rng.fork(0x5eed),
      tick: 0,
      killY: cfg.map.killY,
    };

    this.build(variantId);
  }

  /** Seeded weighted roll - every client can reproduce it from the match seed. */
  private rollVariant(): string {
    return rollVariantFor(this.map, this.seed);
  }

  // ── construction ────────────────────────────────────────────────────────
  private build(variantId: string): void {
    const map = this.map;
    this.activeGroups = groupsForVariant(map, variantId);
    const variant = map.variants.find((v) => v.id === variantId);
    this.hazardScale = (variant?.hazardScale ?? 1) * this.rules.hazardScale;
    this.director.hazardScale = this.hazardScale;
    this.director.activeGroups = [...this.activeGroups];

    const mirror = this.rules.mirrored ? -1 : 1;

    // Static geometry.
    for (const p of map.props) {
      if (p.decorOnly) continue;
      const group = p.group ?? '';
      const kind = p.shape === 'cylinder' ? ShapeKind.Cylinder
        : p.shape === 'sphere' ? ShapeKind.Sphere
          : p.shape === 'capsule' ? ShapeKind.Capsule : ShapeKind.Box;
      const rot = p.rot ?? [0, 0, 0];
      const q = qIdentity();
      qFromEulerArray(q, rot as [number, number, number], mirror);
      const c = makeCollider(kind, v3(p.pos[0] * mirror, p.pos[1], p.pos[2]), v3(p.size[0], p.size[1], p.size[2]), {
        surface: p.surface ?? Surface.Metal,
        friction: p.friction ?? 1,
        bounce: p.bounce ?? 0,
        noStand: p.noStand ?? false,
        rot: q,
        tag: p.id ?? '',
      });
      this.world.addStatic(c);
      if (group) {
        let list = this.groupProps.get(group);
        if (!list) { list = []; this.groupProps.set(group, list); }
        list.push(c);
      }
      if (group && !this.activeGroups.has(group)) {
        c.enabled = false;
        refreshAabb(c);
      }
    }

    // Obstacles.
    let ownerId = 1;
    for (const def of map.obstacles) {
      const mirrored = mirror === -1
        ? { ...def, pos: [def.pos[0] * -1, def.pos[1], def.pos[2]] as [number, number, number],
            dir: def.dir ? [def.dir[0] * -1, def.dir[1], def.dir[2]] as [number, number, number] : undefined }
        : def;
      const rt = createObstacle(mirrored, this.world, ownerId++);
      this.obstacles.push(rt);
      this.obstacleByColliderOwner.set(ownerId - 1, rt);
      const group = def.group ?? '';
      if (group) {
        let list = this.groupObstacles.get(group);
        if (!list) { list = []; this.groupObstacles.set(group, list); }
        list.push(rt);
        if (!this.activeGroups.has(group)) setObstacleActive(rt, false);
      }
    }

    // Volumes.
    for (const v of map.volumes) {
      const mv = mirror === -1
        ? { ...v, pos: [v.pos[0] * -1, v.pos[1], v.pos[2]] as [number, number, number],
            dir: v.dir ? [v.dir[0] * -1, v.dir[1], v.dir[2]] as [number, number, number] : undefined }
        : v;
      this.volumes.push(mv);
      const group = v.group ?? '';
      if (group) {
        let list = this.volumeGroups.get(group);
        if (!list) { list = []; this.volumeGroups.set(group, list); }
        list.push(mv);
      }
    }

    // Routes with cached lengths (progress is queried every tick per player).
    for (const r of map.routes) {
      const cum: number[] = [0];
      let total = 0;
      for (let i = 1; i < r.points.length; i++) {
        const a = r.points[i - 1], b = r.points[i];
        total += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        cum.push(total);
      }
      this.routes.push({ def: r, cum, total });
    }

    this.phase = this.introTime > 0 ? RoundPhase.Intro : RoundPhase.Countdown;
    this.phaseTime = 0;
    this.runTime = -this.countdownTime;
  }

  // ── players ─────────────────────────────────────────────────────────────
  addPlayer(id: number, name: string, opts: { isBot?: boolean; teamId?: number; loadout?: string[] } = {}): PlayerSim {
    const spawnIndex = this.players.length % Math.max(1, this.map.spawns.length);
    const s = this.map.spawns[spawnIndex];
    const mirror = this.rules.mirrored ? -1 : 1;
    const p: PlayerSim = {
      id, name,
      isBot: opts.isBot ?? false,
      teamId: opts.teamId ?? 0,
      pos: v3(s ? s.pos[0] * mirror : 0, s ? s.pos[1] : 1, s ? s.pos[2] : 0),
      vel: v3(),
      yaw: s?.yaw ?? 0,
      state: MoveState.Frozen,
      stateTime: 0,
      prevState: MoveState.Idle,
      grounded: false,
      groundNormal: v3(0, 1, 0),
      groundColliderId: 0,
      groundSurface: Surface.Metal,
      groundVel: v3(),
      coyote: 0,
      jumpBuffer: 0,
      jumpHeld: false,
      airJumpsUsed: 0,
      diveCooldown: 0,
      stateTimer: 0,
      lastHitId: 0,
      hitCd: 0,
      invuln: 0,
      checkpoint: 0,
      progress: 0,
      bestProgress: 0,
      finishTick: -1,
      rank: 0,
      qualified: false,
      eliminated: false,
      eliminatedTick: -1,
      score: 0,
      falls: 0,
      ability: makeAbilityRuntime(3),
      loadout: opts.loadout ?? [],
      emote: 0,
      emoteTime: 0,
      idleTicks: 0,
      stallTicks: 0,
      connected: true,
      lastSeq: 0,
    };
    this.players.push(p);
    this.byId.set(id, p);
    return p;
  }

  removePlayer(id: number): void {
    const i = this.players.findIndex((p) => p.id === id);
    if (i >= 0) this.players.splice(i, 1);
    this.byId.delete(id);
  }

  // ── stepping ────────────────────────────────────────────────────────────
  /**
   * Advances the world by exactly one tick.
   * `inputs` maps player id -> command for this tick.
   */
  step(inputs: Map<number, InputCmd>, dt = TICK_DT): void {
    this.tick++;
    this.ctx.tick = this.tick;
    this.phaseTime += dt;

    // Obstacles run during the intro and countdown too, so players can read
    // their rhythm before the gate drops.
    const obstacleTime = this.tick * dt;
    this.stepDirector(dt);
    for (let i = 0; i < this.obstacles.length; i++) {
      const rt = this.obstacles[i];
      if (rt.active) updateObstacle(rt, obstacleTime, this.hazardScale, dt);
      else if (rt.def.kind === 'crumble') updateObstacle(rt, obstacleTime, this.hazardScale, dt);
    }

    switch (this.phase) {
      case RoundPhase.Intro:
        if (this.phaseTime >= this.introTime) { this.phase = RoundPhase.Countdown; this.phaseTime = 0; }
        break;
      case RoundPhase.Countdown:
        this.runTime = -Math.max(0, this.countdownTime - this.phaseTime);
        if (this.phaseTime >= this.countdownTime) {
          this.phase = RoundPhase.Running;
          this.phaseTime = 0;
          this.runTime = 0;
          for (const p of this.players) {
            if (p.state === MoveState.Frozen) { p.state = MoveState.Idle; p.stateTime = 0; }
          }
        }
        break;
      case RoundPhase.Running:
        this.runTime += dt;
        break;
      default:
        break;
    }

    // Players.
    const empty = EMPTY_INPUT;
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.connected && p.state !== MoveState.Eliminated) {
        // Disconnected players stand still but keep their slot for reconnects.
        stepCharacter(p, empty, this.ctx, dt);
        continue;
      }
      const cmd = inputs.get(p.id) ?? empty;
      p.lastSeq = cmd.seq || p.lastSeq;
      this.applyVolumes(p, dt);
      stepCharacter(p, cmd, this.ctx, dt);
      this.postStepPlayer(p, dt);
    }

    resolvePlayerCollisions(this.players, this.ctx, dt);
  }

  /** Round Director: telegraph, then transform. */
  private stepDirector(dt: number): void {
    if (!this.phaseEventsEnabled || this.phase !== RoundPhase.Running) return;
    const d = this.director;
    for (const ev of this.map.phaseEvents) {
      if (d.fired.includes(ev.id)) continue;
      if (ev.variants && ev.variants.length && !ev.variants.includes(d.variantId)) continue;
      const warnAt = ev.at - ev.telegraph;
      if (d.pending !== ev.id && this.runTime >= warnAt && this.runTime < ev.at) {
        d.pending = ev.id;
        d.pendingIn = ev.at - this.runTime;
        this.events.push({
          kind: SimEventKind.AbilityUsed, playerId: 0, value: ev.telegraph,
          x: 0, y: 0, z: 0, ref: -1, tag: `telegraph:${ev.id}`,
        });
      }
      if (d.pending === ev.id) d.pendingIn = Math.max(0, ev.at - this.runTime);
      if (this.runTime >= ev.at) {
        this.applyPhaseEvent(ev.id);
        d.fired.push(ev.id);
        if (d.pending === ev.id) { d.pending = null; d.pendingIn = 0; }
      }
    }
    void dt;
  }

  applyPhaseEvent(id: string): void {
    const ev = this.map.phaseEvents.find((e) => e.id === id);
    if (!ev) return;
    if (ev.disable) for (const g of ev.disable) this.setGroupActive(g, false);
    if (ev.enable) for (const g of ev.enable) this.setGroupActive(g, true);
    if (ev.hazardScale) {
      this.hazardScale = ev.hazardScale * this.rules.hazardScale;
      this.director.hazardScale = this.hazardScale;
    }
    this.director.activeGroups = [...this.activeGroups];
    this.events.push({
      kind: SimEventKind.AbilityUsed, playerId: 0, value: ev.intensity ?? 0.5,
      x: 0, y: 0, z: 0, ref: -2, tag: `phase:${ev.id}`,
    });
  }

  setGroupActive(group: string, active: boolean): void {
    if (active) this.activeGroups.add(group); else this.activeGroups.delete(group);
    const props = this.groupProps.get(group);
    if (props) for (const c of props) { c.enabled = active; refreshAabb(c); }
    const obs = this.groupObstacles.get(group);
    if (obs) for (const rt of obs) setObstacleActive(rt, active);
  }

  isGroupActive(group: string): boolean {
    return this.activeGroups.has(group);
  }

  /** Wind, boosts, checkpoints, finish and collectibles. */
  private applyVolumes(p: PlayerSim, dt: number): void {
    if (p.state === MoveState.Eliminated) return;
    const px = p.pos.x, py = p.pos.y + CHAR.height * 0.5, pz = p.pos.z;
    for (let i = 0; i < this.volumes.length; i++) {
      const v = this.volumes[i];
      if (v.group && !this.activeGroups.has(v.group)) continue;
      if (Math.abs(px - v.pos[0]) > v.size[0]) continue;
      if (Math.abs(py - v.pos[1]) > v.size[1]) continue;
      if (Math.abs(pz - v.pos[2]) > v.size[2]) continue;

      switch (v.kind) {
        case 'wind': {
          const d = v.dir ?? [0, 1, 0];
          const f = (v.force ?? 20) * dt;
          // Wind fights gravity rather than replacing it, so players keep control.
          p.vel.x += d[0] * f;
          p.vel.y += d[1] * f;
          p.vel.z += d[2] * f;
          if (d[1] > 0) p.vel.y = Math.min(p.vel.y, 14);
          break;
        }
        case 'boost': {
          const d = v.dir ?? [0, 0, 1];
          const f = (v.force ?? 14);
          p.vel.x = d[0] * f; p.vel.z = d[2] * f;
          if (d[1] !== 0) p.vel.y = d[1] * f;
          break;
        }
        case 'slow':
          p.ability.slowTime = Math.max(p.ability.slowTime, 0.2);
          break;
        case 'kill':
          if (p.state !== MoveState.Respawning && p.invuln <= 0) {
            emit(this.ctx, SimEventKind.Fall, p, 1);
            p.state = MoveState.Respawning;
            p.stateTime = 0;
            p.stateTimer = RESPAWN.delay;
            p.falls++;
            v3set(p.vel, 0, 0, 0);
          }
          break;
        case 'finish':
          this.finishPlayer(p);
          break;
        case 'collect':
          p.score += 1;
          emit(this.ctx, SimEventKind.Collect, p, 1, v.index ?? 0);
          break;
        default:
          break;
      }
    }

    // Checkpoints (ordered - you cannot skip backwards into a later one).
    if (this.rules.checkpointsEnabled) {
      for (const c of this.map.checkpoints) {
        if (c.group && !this.activeGroups.has(c.group)) continue;
        if (c.index <= p.checkpoint) continue;
        if (Math.abs(px - c.pos[0]) > c.size[0]) continue;
        if (Math.abs(py - c.pos[1]) > c.size[1]) continue;
        if (Math.abs(pz - c.pos[2]) > c.size[2]) continue;
        p.checkpoint = c.index;
        emit(this.ctx, SimEventKind.Checkpoint, p, 0, c.index);
      }
    }
  }

  private postStepPlayer(p: PlayerSim, dt: number): void {
    // Crumbling platforms react to being stood on.
    if (p.grounded && p.groundColliderId) {
      const rt = this.findObstacleByCollider(p.groundColliderId);
      if (rt && rt.def.kind === 'crumble') triggerCrumble(rt);
    }

    // Respawn once the fall timer expires - unless the mode says a fall is
    // final, in which case that timer is the player's last half second.
    if (p.state === MoveState.Respawning && p.stateTimer <= 0) {
      if (this.rules.respawnEnabled) this.respawn(p);
      else this.eliminate(p, 'fell');
    }

    // Live progress for the ranking board.
    const prog = this.computeProgress(p);
    p.progress = prog;
    if (prog > p.bestProgress + 0.25) {
      p.bestProgress = prog;
      p.stallTicks = 0;
    } else if (this.phase === RoundPhase.Running && p.finishTick < 0 && !p.eliminated) {
      p.stallTicks++;
    }

    // Anti-stall, bots only. A bot wedged in scenery for a quarter of a minute
    // makes the whole race look broken, so it resets to its own checkpoint -
    // the same thing a fall would do, with no advantage gained. Human players
    // are never moved: being stuck is their business to solve.
    if (p.isBot && p.stallTicks > BOT_STALL_TICKS && p.state !== MoveState.Respawning) {
      p.stallTicks = 0;
      this.respawn(p);
    }
    void dt;
  }

  private findObstacleByCollider(colliderId: number): ObstacleRuntime | undefined {
    for (let i = 0; i < this.obstacles.length; i++) {
      const rt = this.obstacles[i];
      for (let j = 0; j < rt.colliders.length; j++) {
        if (rt.colliders[j].id === colliderId) return rt;
      }
    }
    return undefined;
  }

  computeProgress(p: PlayerSim): number {
    let best = p.bestProgress;
    let bestDistSq = Infinity;
    let found = -1;
    for (let r = 0; r < this.routes.length; r++) {
      const rt = this.routes[r];
      if (rt.def.group && !this.activeGroups.has(rt.def.group)) continue;
      const pts = rt.def.points;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const ex = b[0] - a[0], ey = b[1] - a[1], ez = b[2] - a[2];
        const segLenSq = ex * ex + ey * ey + ez * ez;
        if (segLenSq < 1e-6) continue;
        let t = ((p.pos.x - a[0]) * ex + (p.pos.y - a[1]) * ey + (p.pos.z - a[2]) * ez) / segLenSq;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const cx = a[0] + ex * t, cy = a[1] + ey * t, cz = a[2] + ez * t;
        const dx = p.pos.x - cx, dy = (p.pos.y - cy) * 0.5, dz = p.pos.z - cz;
        const dSq = dx * dx + dy * dy + dz * dz;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          const along = (rt.cum[i - 1] + Math.sqrt(segLenSq) * t) / rt.total;
          found = rt.def.startDist + (rt.def.endDist - rt.def.startDist) * along;
        }
      }
    }
    if (found >= 0) best = found;
    return best;
  }

  finishPlayer(p: PlayerSim): void {
    if (p.finishTick >= 0 || p.state === MoveState.Eliminated) return;
    p.finishTick = this.tick;
    p.qualified = true;
    p.state = MoveState.Finished;
    p.stateTime = 0;
    this.finishedOrder.push(p.id);
    p.rank = this.finishedOrder.length;
    this.qualifiedCount++;
    // Photo finish: two players inside a tenth of a second.
    const now = this.tick * TICK_DT;
    const photo = now - this.lastFinishTime < 0.18 ? 1 : 0;
    this.lastFinishTime = now;
    this.events.push({
      kind: SimEventKind.Finish, playerId: p.id, value: now,
      x: p.pos.x, y: p.pos.y, z: p.pos.z, ref: p.rank, tag: photo ? 'photo' : undefined,
    });
  }

  eliminate(p: PlayerSim, reason = 'eliminated'): void {
    if (p.eliminated) return;
    p.eliminated = true;
    p.eliminatedTick = this.tick;
    p.state = MoveState.Eliminated;
    p.stateTime = 0;
    v3set(p.vel, 0, 0, 0);
    this.events.push({
      kind: SimEventKind.Eliminated, playerId: p.id, value: 0,
      x: p.pos.x, y: p.pos.y, z: p.pos.z, ref: 0, tag: reason,
    });
  }

  /** Puts a player back at their checkpoint, on a spot nobody else occupies. */
  respawn(p: PlayerSim): void {
    const cp = this.map.checkpoints.find((c) => c.index === p.checkpoint)
      ?? this.map.checkpoints[0];
    const mirror = this.rules.mirrored ? -1 : 1;
    const base = cp?.respawn ?? cp?.pos ?? [0, 2, 0];
    let bx = base[0] * mirror, by = base[1] + 0.4, bz = base[2];

    // Try a ring of offsets and take the first that is clear of other players.
    const rng = this.rng.fork(p.id * 7919 + this.tick);
    for (let attempt = 0; attempt < 8; attempt++) {
      const a = rng.next() * Math.PI * 2;
      const r = attempt === 0 ? 0 : RESPAWN.spreadRadius * (0.35 + rng.next() * 0.65);
      const tx = bx + Math.cos(a) * r;
      const tz = bz + Math.sin(a) * r;
      if (this.isSpotFree(tx, by, tz, p.id)) { bx = tx; bz = tz; break; }
    }

    v3set(p.pos, bx, by, bz);
    v3set(p.vel, 0, 0, 0);
    v3set(p.groundVel, 0, 0, 0);
    p.state = MoveState.Idle;
    p.stateTime = 0;
    p.stateTimer = 0;
    p.invuln = RESPAWN.invulnTime;
    p.yaw = cp?.respawnYaw ?? 0;
    p.grounded = false;
    p.lastHitId = 0;
    emit(this.ctx, SimEventKind.Respawn, p, 0, p.checkpoint);
  }

  private isSpotFree(x: number, y: number, z: number, selfId: number): boolean {
    for (const o of this.players) {
      if (o.id === selfId || o.state === MoveState.Eliminated) continue;
      const dx = o.pos.x - x, dz = o.pos.z - z, dy = o.pos.y - y;
      if (Math.abs(dy) < 2 && dx * dx + dz * dz < 1.3) return false;
    }
    // Reject spots with no floor under them.
    const drop = this.world.raycastDown(x, y + 1.2, z, 4, this.colliderScratch);
    return drop >= 0;
  }

  /**
   * Live standings.
   * Race: finishers by time, then by distance covered.
   * Survival: whoever is still up, then the fallen in reverse order of falling -
   * lasting longer is the entire achievement, so it has to rank you higher.
   * Collect/team: by score, with progress as the tiebreak.
   */
  liveRanking(out: PlayerSim[] = []): PlayerSim[] {
    out.length = 0;
    for (const p of this.players) out.push(p);

    if (this.mode === 'survival' || this.mode === 'arena' || this.mode === 'escape') {
      out.sort((a, b) => {
        if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
        if (a.eliminated && b.eliminated) return b.eliminatedTick - a.eliminatedTick;
        return b.progress - a.progress;
      });
    } else if (this.mode === 'collect' || this.mode === 'hunt' || this.mode === 'team') {
      out.sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
        return b.progress - a.progress;
      });
    } else {
      // Race.
      const alive = out.filter((p) => !p.eliminated);
      out.length = 0;
      out.push(...alive);
      out.sort((a, b) => {
        if (a.finishTick >= 0 && b.finishTick >= 0) return a.finishTick - b.finishTick;
        if (a.finishTick >= 0) return -1;
        if (b.finishTick >= 0) return 1;
        return b.progress - a.progress;
      });
    }
    for (let i = 0; i < out.length; i++) if (out[i].finishTick < 0) out[i].rank = i + 1;
    return out;
  }

  /** Combined score of a team, used by team modes. */
  teamScore(teamId: number): number {
    let total = 0;
    for (const p of this.players) if (p.teamId === teamId) total += p.score;
    return total;
  }

  /** How many players are still in the round. */
  aliveCount(): number {
    let n = 0;
    for (const p of this.players) if (!p.eliminated) n++;
    return n;
  }

  positionOf(playerId: number): number {
    const p = this.byId.get(playerId);
    if (!p) return 0;
    if (p.finishTick >= 0) return p.rank;
    let pos = 1;
    for (const o of this.players) {
      if (o.id === playerId || o.eliminated) continue;
      if (o.finishTick >= 0 || o.progress > p.progress) pos++;
    }
    return pos;
  }

  clearEvents(): void {
    this.events.length = 0;
  }

  /** Total active players still racing (not finished, not eliminated). */
  racingCount(): number {
    let n = 0;
    for (const p of this.players) if (!p.eliminated && p.finishTick < 0) n++;
    return n;
  }

  applyObstacleTimeTo(t: number): void {
    for (const rt of this.obstacles) updateObstacle(rt, t, this.hazardScale, TICK_DT);
  }

  getHazardScale(): number { return this.hazardScale; }
  getActiveGroups(): Set<string> { return this.activeGroups; }
  getContext(): SimContext { return this.ctx; }
}

/**
 * The same seeded weighted roll the simulation uses, exposed so the pre-match
 * screen can present the drawn layout. Keeping one implementation means the
 * card the player sees is always the layout they actually get.
 */
export function rollVariantFor(map: MapDef, seed: number): string {
  const rng = new Rng((seed ^ hashString(map.id)) >>> 0);
  const variants = map.variants;
  if (!variants.length) return 'standard';
  let total = 0;
  for (const v of variants) total += v.weight;
  let r = rng.next() * total;
  for (const v of variants) {
    r -= v.weight;
    if (r <= 0) return v.id;
  }
  return variants[variants.length - 1].id;
}

const EMPTY_INPUT: InputCmd = makeInput();

/** 15 seconds without forward progress. */
const BOT_STALL_TICKS = 15 * 60;

export { applyImpulse, capsuleSegment, clamp, lerp, v3copy, _tmp, _capA, _capB };
