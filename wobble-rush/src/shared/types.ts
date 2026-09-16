/** Core simulation data shapes shared by client prediction and the server. */
import { Vec3, v3 } from './math';
import { Surface } from './collision';

export const enum MoveState {
  Idle = 0,
  Run = 1,
  Air = 2,
  Dive = 3,
  DiveSlide = 4,
  GetUp = 5,
  Stumble = 6,
  Ragdoll = 7,
  Respawning = 8,
  Finished = 9,
  Eliminated = 10,
  Frozen = 11,
  Emote = 12,
}

export const enum Btn {
  Jump = 1 << 0,
  Dive = 1 << 1,
  Ability1 = 1 << 2,
  Ability2 = 1 << 3,
  Emote = 1 << 4,
  Grab = 1 << 5,
}

/** One tick of player intent. Fixed layout so it can be packed for the wire. */
export interface InputCmd {
  seq: number;
  tick: number;
  /** Movement axes in camera space, each in [-1, 1]. */
  moveX: number;
  moveZ: number;
  /** Camera yaw in radians - movement is resolved against it. */
  camYaw: number;
  buttons: number;
  /** Which loadout slot an Ability button refers to (0-2). */
  emoteId: number;
}

export function makeInput(): InputCmd {
  return { seq: 0, tick: 0, moveX: 0, moveZ: 0, camYaw: 0, buttons: 0, emoteId: 0 };
}

export function copyInput(out: InputCmd, a: InputCmd): InputCmd {
  out.seq = a.seq; out.tick = a.tick; out.moveX = a.moveX; out.moveZ = a.moveZ;
  out.camYaw = a.camYaw; out.buttons = a.buttons; out.emoteId = a.emoteId;
  return out;
}

/** Transient per-tick effects granted by abilities. */
export interface AbilityRuntime {
  /** Remaining cooldown per equipped slot, seconds. */
  cooldowns: number[];
  /** Charges left per slot (abilities with limited uses per round). */
  charges: number[];
  /** Seconds of damage/knockback immunity from a shield. */
  shield: number;
  /** Seconds of outgoing repulsion field. */
  repulse: number;
  /** Multiplier on max speed while a boost runs. */
  speedBoost: number;
  speedBoostTime: number;
  /** Extra air jumps available this airtime. */
  airJumps: number;
  /** Seconds of slow applied to this player by someone else. */
  slowTime: number;
  /** Anchor recorded by the rewind ability: position + tick. */
  anchorPos: Vec3;
  anchorTick: number;
  anchorValid: boolean;
  /** Grapple state. */
  grappleActive: boolean;
  grappleTarget: Vec3;
  grappleTime: number;
}

export function makeAbilityRuntime(slots = 3): AbilityRuntime {
  return {
    cooldowns: new Array(slots).fill(0),
    charges: new Array(slots).fill(0),
    shield: 0,
    repulse: 0,
    speedBoost: 1,
    speedBoostTime: 0,
    airJumps: 0,
    slowTime: 0,
    anchorPos: v3(),
    anchorTick: 0,
    anchorValid: false,
    grappleActive: false,
    grappleTarget: v3(),
    grappleTime: 0,
  };
}

export interface PlayerSim {
  id: number;
  name: string;
  /** Bots are simulated by the server with synthetic input. */
  isBot: boolean;
  teamId: number;

  pos: Vec3;
  vel: Vec3;
  /** Facing yaw, radians. Visual only but simulated for dive direction. */
  yaw: number;

  state: MoveState;
  stateTime: number;
  prevState: MoveState;

  grounded: boolean;
  groundNormal: Vec3;
  groundColliderId: number;
  groundSurface: Surface;
  /** World velocity of the surface underfoot (platforms, belts, rollers). */
  groundVel: Vec3;
  coyote: number;
  jumpBuffer: number;
  jumpHeld: boolean;
  /** Jumps consumed since leaving the ground (for ability air jumps). */
  airJumpsUsed: number;

  diveCooldown: number;
  stateTimer: number;
  /** Last hazard collider that knocked this player, with a short re-hit lockout. */
  lastHitId: number;
  hitCd: number;

  /** Set while respawn/invulnerability protects the player. */
  invuln: number;

  checkpoint: number;
  /** Distance travelled along the route spline - drives live ranking. */
  progress: number;
  bestProgress: number;
  /** Server tick the player crossed the finish line, -1 until then. */
  finishTick: number;
  rank: number;
  qualified: boolean;
  eliminated: boolean;
  /** Tick this player went out, -1 while alive. Survival ranks by this. */
  eliminatedTick: number;
  /** Round score for point-based modes (Grand Prix, collect, survival). */
  score: number;
  falls: number;

  ability: AbilityRuntime;
  /** Ability definition ids in the equipped slots. */
  loadout: string[];

  emote: number;
  emoteTime: number;

  /** Ticks with no meaningful input, used by AFK handling. */
  idleTicks: number;
  /** Ticks without forward progress - drives the bot anti-stall reset. */
  stallTicks: number;
  connected: boolean;
  /** Last input sequence acknowledged - echoed back for reconciliation. */
  lastSeq: number;
}

export const enum SimEventKind {
  Jump = 0,
  Land = 1,
  Footstep = 2,
  Dive = 3,
  DiveLand = 4,
  Impact = 5,
  Ragdoll = 6,
  GetUp = 7,
  Checkpoint = 8,
  Finish = 9,
  Fall = 10,
  Respawn = 11,
  Eliminated = 12,
  AbilityUsed = 13,
  AbilityFailed = 14,
  Bounce = 15,
  PlayerBump = 16,
  Qualified = 17,
  Collect = 18,
  Emote = 19,
}

export interface SimEvent {
  kind: SimEventKind;
  playerId: number;
  /** Magnitude: impact strength, land speed, etc. */
  value: number;
  x: number;
  y: number;
  z: number;
  /** Context id: checkpoint index, ability slot, surface type... */
  ref: number;
  /** String payload for ability ids and similar. */
  tag?: string;
}
