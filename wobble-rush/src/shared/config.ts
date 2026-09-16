/**
 * Tuning constants for the simulation.
 *
 * Everything that shapes "game feel" lives here so it can be tweaked in one
 * place - and so a server-sent RuleSet can scale it per mode/event without any
 * system reaching into the controller internals.
 */

export const TICK_RATE = 60;
export const TICK_DT = 1 / TICK_RATE;
/** Snapshots per second sent to clients. */
export const SNAPSHOT_RATE = 20;

export const CHAR = {
  radius: 0.36,
  /** Total standing height, capsule included. */
  height: 1.62,
  /** Height while diving/ragdolling - the capsule lies down. */
  proneHeight: 0.78,
  mass: 1,
  eyeHeight: 1.35,
} as const;

export const MOVE = {
  maxSpeed: 7.3,
  /** Ground acceleration toward the wish velocity (u/s^2). */
  accel: 62,
  /** Extra brake applied when input opposes current velocity - makes turns crisp. */
  turnBrake: 34,
  /** Deceleration with no input. */
  friction: 48,
  airAccel: 26,
  /** How much of the ground steering authority survives in the air. */
  airControl: 0.62,
  airFriction: 1.4,
  /** Turn rate of the visual//facing yaw, radians per second. */
  turnRate: 16,
  /** Below this the character is considered idle. */
  idleSpeed: 0.35,
  /** Slopes steeper than this cannot be stood on. */
  maxSlopeCos: Math.cos((52 * Math.PI) / 180),
  /** Slide acceleration on too-steep ground. */
  slideAccel: 18,
  /** Max distance the capsule snaps down to stay glued to slopes/steps. */
  groundSnap: 0.32,
  stepHeight: 0.42,
} as const;

export const JUMP = {
  velocity: 9.35,
  /** Gravity while moving up with jump held - floaty ascent. */
  gravityUp: 26,
  /** Gravity while falling - snappy descent, the classic platformer trick. */
  gravityDown: 38,
  /** Extra gravity when the jump button is released early. */
  gravityCut: 0.42,
  maxFall: 46,
  coyoteTime: 0.12,
  bufferTime: 0.14,
  /** Landings softer than this play the light land anim. */
  softLandSpeed: 9,
  hardLandSpeed: 20,
} as const;

export const DIVE = {
  /** Forward impulse, applied along facing. */
  forward: 12.0,
  up: 5.2,
  /** Steering authority retained mid-dive. */
  control: 0.18,
  cooldown: 1.05,
  /** Minimum airtime before a dive can end on landing. */
  minTime: 0.12,
  /** Ground friction while sliding after the dive lands. */
  slideFriction: 26,
  /** Slide ends below this speed. */
  slideEndSpeed: 1.6,
  getUpTime: 0.42,
  /** Impulse transferred to players hit mid-dive. */
  hitImpulse: 7.5,
} as const;

export const IMPACT = {
  /** Impulse thresholds that classify a hit. */
  nudge: 2.5,
  stumble: 6.5,
  fall: 11,
  ragdoll: 16,
  /** Hard cap so nothing launches a player into orbit. */
  maxImpulse: 26,
  stumbleTime: 0.45,
  /** Ragdoll duration scales with impulse between these bounds. */
  ragdollMin: 0.75,
  ragdollMax: 2.1,
  ragdollDrag: 0.6,
  ragdollBounce: 0.32,
  getUpTime: 0.55,
} as const;

export const PVP = {
  /** Soft body radius used for player-vs-player pushing. */
  radius: 0.42,
  /** Separation stiffness. */
  push: 26,
  /** Max separation speed, keeps crowds from exploding. */
  maxPush: 5.5,
  /** Fraction of relative momentum transferred on a solid bump. */
  transfer: 0.45,
} as const;

export const RESPAWN = {
  /** Time spent falling/fading before the respawn completes. */
  delay: 0.85,
  invulnTime: 1.6,
  /** Candidate offsets tried around a checkpoint to find a free spot. */
  spreadRadius: 2.4,
} as const;

/**
 * Per-match rules the server can change without a client update.
 * Event modifiers, custom rooms and map variants all go through this.
 */
export interface RuleSet {
  gravityScale: number;
  speedScale: number;
  jumpScale: number;
  /** Visual + collision scale of characters (giant/tiny modifiers). */
  sizeScale: number;
  playerCollision: boolean;
  friendlyCollision: boolean;
  abilitiesEnabled: boolean;
  respawnEnabled: boolean;
  checkpointsEnabled: boolean;
  diveEnabled: boolean;
  /** Obstacle speed multiplier. */
  hazardScale: number;
  /** Extra obstacle layers injected by event modifiers. */
  extras: string[];
  /** Runs the map mirrored on X. */
  mirrored: boolean;
}

export const DEFAULT_RULES: RuleSet = {
  gravityScale: 1,
  speedScale: 1,
  jumpScale: 1,
  sizeScale: 1,
  playerCollision: true,
  friendlyCollision: true,
  abilitiesEnabled: true,
  respawnEnabled: true,
  checkpointsEnabled: true,
  diveEnabled: true,
  hazardScale: 1,
  extras: [],
  mirrored: false,
};

export function makeRules(overrides: Partial<RuleSet> = {}): RuleSet {
  return { ...DEFAULT_RULES, ...overrides, extras: [...(overrides.extras ?? DEFAULT_RULES.extras)] };
}
