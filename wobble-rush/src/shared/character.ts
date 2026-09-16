/**
 * The character controller - the single most important system in the game.
 *
 * Design notes:
 *  - Fully deterministic: same inputs + same tick => same result on client and
 *    server, which is what makes prediction/reconciliation invisible.
 *  - Kinematic capsule with depenetration rather than a rigid body, because a
 *    party game needs *predictable* movement with *unpredictable* comedy: the
 *    comedy comes from hazards and ragdolls, never from the controller.
 *  - Split gravity (floaty up, heavy down), coyote time, jump buffering and
 *    landing squash are all here because they are what make a jump feel good.
 */
import {
  Vec3, v3, v3set, v3copy, v3add, v3sub, v3scale, v3addScaled, v3dot, v3len,
  v3lenSq, v3normalize, v3clampLength, clamp, angleDelta, Rng,
} from './math';
import {
  CollisionWorld, Collider, Contact, makeContact, capsuleVsCollider,
  colliderPointVelocity, Surface,
} from './collision';
import { CHAR, MOVE, JUMP, DIVE, IMPACT, PVP, RESPAWN, RuleSet } from './config';
import { MoveState, Btn, InputCmd, PlayerSim, SimEvent, SimEventKind } from './types';

export interface SimContext {
  world: CollisionWorld;
  rules: RuleSet;
  events: SimEvent[];
  rng: Rng;
  tick: number;
  /** Anything below this Y is a fall. */
  killY: number;
}

export function emit(ctx: SimContext, kind: SimEventKind, p: PlayerSim, value = 0, ref = 0, tag?: string): void {
  ctx.events.push({ kind, playerId: p.id, value, x: p.pos.x, y: p.pos.y, z: p.pos.z, ref, tag });
}

// --- scratch ---
const _wish = v3();
const _delta = v3();
const _tmp = v3();
const _tmp2 = v3();
const _relVel = v3();
const _contact: Contact = makeContact();
const _candidates: Collider[] = [];
const _normals: Vec3[] = [v3(), v3(), v3(), v3(), v3(), v3()];
const _capA = v3();
const _capB = v3();

/** Capsule segment endpoints for a player, honouring the prone states. */
export function capsuleSegment(p: PlayerSim, scale: number, outA: Vec3, outB: Vec3): number {
  const prone = p.state === MoveState.Dive || p.state === MoveState.DiveSlide ||
    p.state === MoveState.Ragdoll || p.state === MoveState.GetUp;
  const r = CHAR.radius * scale;
  const h = (prone ? CHAR.proneHeight : CHAR.height) * scale;
  const half = Math.max(h * 0.5 - r, 0.01);
  v3set(outA, p.pos.x, p.pos.y + r + half * 0 + half, p.pos.z);
  v3set(outB, p.pos.x, p.pos.y + r, p.pos.z);
  // pos is at the feet: bottom sphere centre sits at r, top at height - r.
  v3set(outA, p.pos.x, p.pos.y + h - r, p.pos.z);
  v3set(outB, p.pos.x, p.pos.y + r, p.pos.z);
  return r;
}

const _hitNormals: Vec3[] = _normals;

interface MoveResult {
  hitCount: number;
  grounded: boolean;
  groundNormal: Vec3;
  groundCollider: Collider | null;
  hitWall: boolean;
  maxImpact: number;
}

const _moveResult: MoveResult = {
  hitCount: 0, grounded: false, groundNormal: v3(0, 1, 0), groundCollider: null, hitWall: false, maxImpact: 0,
};

/**
 * Moves the capsule by `delta`, resolving collisions by depenetration.
 * Substeps keep fast movers from tunnelling through thin geometry.
 */
function moveAndCollide(p: PlayerSim, delta: Vec3, ctx: SimContext, scale: number, dt: number): MoveResult {
  const res = _moveResult;
  res.hitCount = 0; res.grounded = false; res.groundCollider = null; res.hitWall = false; res.maxImpact = 0;
  v3set(res.groundNormal, 0, 1, 0);

  const dist = v3len(delta);
  const maxStep = CHAR.radius * scale * 0.55;
  const steps = Math.max(1, Math.min(8, Math.ceil(dist / maxStep)));
  const inv = 1 / steps;
  v3scale(_tmp2, delta, inv);

  for (let s = 0; s < steps; s++) {
    p.pos.x += _tmp2.x; p.pos.y += _tmp2.y; p.pos.z += _tmp2.z;

    for (let iter = 0; iter < 4; iter++) {
      const r = capsuleSegment(p, scale, _capA, _capB);
      const pad = 0.05;
      ctx.world.query(
        Math.min(_capA.x, _capB.x) - r - pad, Math.min(_capA.y, _capB.y) - r - pad, Math.min(_capA.z, _capB.z) - r - pad,
        Math.max(_capA.x, _capB.x) + r + pad, Math.max(_capA.y, _capB.y) + r + pad, Math.max(_capA.z, _capB.z) + r + pad,
        _candidates,
      );
      let resolved = 0;
      for (let i = 0; i < _candidates.length; i++) {
        const c = _candidates[i];
        if (!capsuleVsCollider(_capA, _capB, r, c, _contact)) continue;
        const n = _contact.normal;
        const depth = _contact.depth;
        if (depth <= 0.0005) continue;
        resolved++;

        const standable = !c.noStand && n.y > MOVE.maxSlopeCos;

        // Relative velocity against the surface decides bounce vs slide.
        colliderPointVelocity(_tmp, c, _contact.point);
        v3sub(_relVel, p.vel, _tmp);
        const vn = v3dot(_relVel, n);

        if (standable) {
          // Walkable ground is resolved *vertically*, not along the contact
          // normal. Pushing along the normal turns every floor seam and
          // platform edge into a wall that steals horizontal speed - the
          // single most common way a capsule controller feels bad.
          p.pos.y += depth / Math.max(n.y, 0.35);
          if (!res.grounded || n.y > res.groundNormal.y) {
            res.grounded = true;
            v3copy(res.groundNormal, n);
            res.groundCollider = c;
          }
          if (vn < 0) {
            if (c.bounce > 0 && -vn > 2.5) {
              const bounceVel = -vn * c.bounce;
              v3addScaled(p.vel, p.vel, n, -vn + bounceVel);
              ctx.events.push({
                kind: SimEventKind.Bounce, playerId: p.id, value: bounceVel,
                x: _contact.point.x, y: _contact.point.y, z: _contact.point.z, ref: c.surface,
              });
            } else if (p.vel.y < _tmp.y) {
              // Land: cancel only the downward motion, keep the run intact.
              p.vel.y = _tmp.y;
            }
          }
        } else {
          p.pos.x += n.x * depth; p.pos.y += n.y * depth; p.pos.z += n.z * depth;
          if (n.y < 0.5) res.hitWall = true;
          if (vn < 0) {
            if (c.bounce > 0 && n.y > 0.3 && -vn > 2.5) {
              const bounceVel = -vn * c.bounce;
              v3addScaled(p.vel, p.vel, n, -vn + bounceVel);
              ctx.events.push({
                kind: SimEventKind.Bounce, playerId: p.id, value: bounceVel,
                x: _contact.point.x, y: _contact.point.y, z: _contact.point.z, ref: c.surface,
              });
            } else {
              v3addScaled(p.vel, p.vel, n, -vn);
            }
          }
        }

        // Hazard knockback (hammers, pistons, spinning arms, fans...).
        if (c.impact > 0 && p.invuln <= 0 && (p.lastHitId !== c.id || p.hitCd <= 0)) {
          applyHazardImpact(p, c, n, ctx, dt);
        }
        if (res.hitCount < _hitNormals.length) v3copy(_hitNormals[res.hitCount], n);
        res.hitCount++;
      }
      if (resolved === 0) break;
    }
  }
  return res;
}

function applyHazardImpact(p: PlayerSim, c: Collider, n: Vec3, ctx: SimContext, _dt: number): void {
  colliderPointVelocity(_tmp, c, p.pos);
  // Blend the surface push direction with the contact normal so hammers send
  // players flying *along the swing*, which reads much better than pure normals.
  v3set(_tmp2, _tmp.x, _tmp.y, _tmp.z);
  const surfSpeed = v3len(_tmp2);
  if (surfSpeed > 0.01) v3scale(_tmp2, _tmp2, 1 / surfSpeed);
  const blend = clamp(surfSpeed / 12, 0, 0.8);
  v3set(_wish,
    n.x * (1 - blend) + _tmp2.x * blend,
    n.y * (1 - blend) + _tmp2.y * blend + 0.28,
    n.z * (1 - blend) + _tmp2.z * blend);
  v3normalize(_wish, _wish);

  let strength = c.impact * (0.65 + Math.min(surfSpeed, 18) / 18 * 0.75);
  if (p.ability.shield > 0) strength *= 0.25;
  strength = Math.min(strength, IMPACT.maxImpulse);

  applyImpulse(p, _wish, strength, ctx);
  p.lastHitId = c.id;
  p.hitCd = 0.22;
}

/** Applies a knockback and picks the reaction that matches its strength. */
export function applyImpulse(p: PlayerSim, dir: Vec3, strength: number, ctx: SimContext): void {
  if (p.state === MoveState.Finished || p.state === MoveState.Eliminated || p.state === MoveState.Respawning) return;
  const s = Math.min(strength, IMPACT.maxImpulse);
  v3addScaled(p.vel, p.vel, dir, s);
  v3clampLength(p.vel, p.vel, 34);

  if (s >= IMPACT.ragdoll) {
    enterRagdoll(p, s, ctx);
  } else if (s >= IMPACT.fall) {
    enterRagdoll(p, s * 0.8, ctx);
  } else if (s >= IMPACT.stumble) {
    if (p.state !== MoveState.Ragdoll && p.state !== MoveState.GetUp) {
      p.state = MoveState.Stumble;
      p.stateTime = 0;
      p.stateTimer = IMPACT.stumbleTime;
      ctx.events.push({ kind: SimEventKind.Impact, playerId: p.id, value: s, x: p.pos.x, y: p.pos.y, z: p.pos.z, ref: 1 });
    }
  } else if (s >= IMPACT.nudge) {
    ctx.events.push({ kind: SimEventKind.Impact, playerId: p.id, value: s, x: p.pos.x, y: p.pos.y, z: p.pos.z, ref: 0 });
  }
}

export function enterRagdoll(p: PlayerSim, strength: number, ctx: SimContext): void {
  if (p.state === MoveState.Finished || p.state === MoveState.Eliminated) return;
  const t = clamp((strength - IMPACT.fall) / (IMPACT.maxImpulse - IMPACT.fall), 0, 1);
  p.state = MoveState.Ragdoll;
  p.stateTime = 0;
  p.stateTimer = IMPACT.ragdollMin + (IMPACT.ragdollMax - IMPACT.ragdollMin) * t;
  ctx.events.push({ kind: SimEventKind.Ragdoll, playerId: p.id, value: strength, x: p.pos.x, y: p.pos.y, z: p.pos.z, ref: 0 });
}

/** True while the player has no control (used by bots and the HUD too). */
export function isHelpless(p: PlayerSim): boolean {
  return p.state === MoveState.Ragdoll || p.state === MoveState.GetUp ||
    p.state === MoveState.Respawning || p.state === MoveState.Eliminated ||
    p.state === MoveState.Frozen;
}

export function canAct(p: PlayerSim): boolean {
  return !isHelpless(p) && p.state !== MoveState.Finished;
}

/**
 * Advances one player by one fixed tick.
 */
export function stepCharacter(p: PlayerSim, cmd: InputCmd, ctx: SimContext, dt: number): void {
  const rules = ctx.rules;
  const scale = rules.sizeScale;

  // --- timers -------------------------------------------------------------
  p.stateTime += dt;
  if (p.hitCd > 0) p.hitCd -= dt;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.diveCooldown > 0) p.diveCooldown -= dt;
  if (p.emoteTime > 0) { p.emoteTime -= dt; if (p.emoteTime <= 0) p.emote = 0; }
  const ab = p.ability;
  for (let i = 0; i < ab.cooldowns.length; i++) if (ab.cooldowns[i] > 0) ab.cooldowns[i] -= dt;
  if (ab.shield > 0) ab.shield -= dt;
  if (ab.repulse > 0) ab.repulse -= dt;
  if (ab.speedBoostTime > 0) { ab.speedBoostTime -= dt; if (ab.speedBoostTime <= 0) ab.speedBoost = 1; }
  if (ab.slowTime > 0) ab.slowTime -= dt;

  if (p.state === MoveState.Frozen || p.state === MoveState.Eliminated) {
    v3set(p.vel, 0, 0, 0);
    return;
  }

  if (p.state === MoveState.Respawning) {
    p.stateTimer -= dt;
    v3set(p.vel, 0, 0, 0);
    return;
  }

  // Finished players jog to a stop and then idle at the finish area.
  const frozenInput = p.state === MoveState.Finished;

  // --- intent -------------------------------------------------------------
  let inX = frozenInput ? 0 : cmd.moveX;
  let inZ = frozenInput ? 0 : cmd.moveZ;
  const inLenSq = inX * inX + inZ * inZ;
  if (inLenSq > 1) { const l = Math.sqrt(inLenSq); inX /= l; inZ /= l; }
  const hasInput = inLenSq > 0.02;

  // Camera-relative basis. Input uses screen axes (moveZ = -1 is "forward"),
  // camYaw 0 means the camera looks down +Z.
  const cy = Math.cos(cmd.camYaw), sy = Math.sin(cmd.camYaw);
  const fwd = -inZ, strafe = inX;
  v3set(_wish, sy * fwd + cy * strafe, 0, cy * fwd - sy * strafe);

  const jumpPressed = !frozenInput && (cmd.buttons & Btn.Jump) !== 0;
  if (jumpPressed && !p.jumpHeld) p.jumpBuffer = JUMP.bufferTime;
  p.jumpHeld = jumpPressed;
  if (p.jumpBuffer > 0) p.jumpBuffer -= dt;
  if (p.coyote > 0) p.coyote -= dt;

  // --- state machine ------------------------------------------------------
  const gravityUp = JUMP.gravityUp * rules.gravityScale;
  const gravityDown = JUMP.gravityDown * rules.gravityScale;
  let speedCap = MOVE.maxSpeed * rules.speedScale * ab.speedBoost;
  if (ab.slowTime > 0) speedCap *= 0.55;

  switch (p.state) {
    case MoveState.Idle:
    case MoveState.Run:
    case MoveState.Air:
    case MoveState.Stumble: {
      if (p.state === MoveState.Stumble) {
        p.stateTimer -= dt;
        if (p.stateTimer <= 0) p.state = p.grounded ? MoveState.Idle : MoveState.Air;
      }
      const control = p.state === MoveState.Stumble ? 0.35 : 1;
      if (p.grounded) {
        groundMove(p, _wish, hasInput, speedCap * control, dt);
      } else {
        airMove(p, _wish, hasInput, speedCap * control, dt);
        const rising = p.vel.y > 0;
        let g = rising ? gravityUp : gravityDown;
        if (rising && !p.jumpHeld) g *= 1 + JUMP.gravityCut;
        p.vel.y -= g * dt;
      }
      break;
    }

    case MoveState.Dive: {
      // Committed: only a sliver of steering, and gravity does the rest.
      airMove(p, _wish, hasInput, speedCap, dt, DIVE.control);
      p.vel.y -= (p.vel.y > 0 ? gravityUp : gravityDown) * dt;
      break;
    }

    case MoveState.DiveSlide: {
      const fric = DIVE.slideFriction * (p.groundSurface === Surface.Slime ? 0.25 : 1);
      applyFriction(p, fric, dt);
      if (!p.grounded) { p.vel.y -= gravityDown * dt; }
      const hSpeed = Math.hypot(p.vel.x, p.vel.z);
      if (p.grounded && hSpeed < DIVE.slideEndSpeed) {
        p.state = MoveState.GetUp;
        p.stateTime = 0;
        p.stateTimer = DIVE.getUpTime;
      }
      break;
    }

    case MoveState.Ragdoll: {
      p.stateTimer -= dt;
      p.vel.y -= gravityDown * dt;
      applyFriction(p, p.grounded ? 5.5 : IMPACT.ragdollDrag, dt);
      if (p.stateTimer <= 0 && p.grounded && Math.hypot(p.vel.x, p.vel.z) < 3) {
        p.state = MoveState.GetUp;
        p.stateTime = 0;
        p.stateTimer = IMPACT.getUpTime;
        emit(ctx, SimEventKind.GetUp, p);
      }
      break;
    }

    case MoveState.GetUp: {
      p.stateTimer -= dt;
      applyFriction(p, 9, dt);
      if (!p.grounded) p.vel.y -= gravityDown * dt;
      if (p.stateTimer <= 0) p.state = p.grounded ? MoveState.Idle : MoveState.Air;
      break;
    }

    case MoveState.Finished: {
      applyFriction(p, 7, dt);
      if (!p.grounded) p.vel.y -= gravityDown * dt;
      break;
    }

    default:
      break;
  }

  // --- jump ---------------------------------------------------------------
  if (canAct(p) && p.state !== MoveState.Dive && p.state !== MoveState.DiveSlide && p.jumpBuffer > 0) {
    const canGround = p.grounded || p.coyote > 0;
    const canAir = !canGround && ab.airJumps > 0 && p.airJumpsUsed < ab.airJumps;
    if (canGround || canAir) {
      p.vel.y = JUMP.velocity * rules.jumpScale * Math.sqrt(rules.gravityScale);
      // Inherit the platform we were standing on, so jumping off a conveyor
      // or a moving lift carries momentum like players expect.
      p.vel.x += p.groundVel.x; p.vel.z += p.groundVel.z;
      if (p.groundVel.y > 0) p.vel.y += Math.min(p.groundVel.y, 6);
      v3set(p.groundVel, 0, 0, 0);
      p.jumpBuffer = 0;
      p.coyote = 0;
      p.grounded = false;
      p.state = MoveState.Air;
      p.stateTime = 0;
      if (canAir) p.airJumpsUsed++;
      emit(ctx, SimEventKind.Jump, p, canAir ? 2 : 1);
    }
  }

  // --- dive ---------------------------------------------------------------
  if (rules.diveEnabled && canAct(p) && p.diveCooldown <= 0 &&
      p.state !== MoveState.Dive && p.state !== MoveState.DiveSlide &&
      (cmd.buttons & Btn.Dive) !== 0) {
    const dirLen = Math.hypot(_wish.x, _wish.z);
    let dx: number, dz: number;
    if (dirLen > 0.1) { dx = _wish.x / dirLen; dz = _wish.z / dirLen; }
    else { dx = Math.sin(p.yaw); dz = Math.cos(p.yaw); }
    p.yaw = Math.atan2(dx, dz);
    const power = rules.speedScale;
    p.vel.x = dx * DIVE.forward * power + p.vel.x * 0.25;
    p.vel.z = dz * DIVE.forward * power + p.vel.z * 0.25;
    p.vel.y = Math.max(p.vel.y, 0) + DIVE.up * rules.jumpScale;
    p.state = MoveState.Dive;
    p.stateTime = 0;
    p.grounded = false;
    p.diveCooldown = DIVE.cooldown;
    emit(ctx, SimEventKind.Dive, p, DIVE.forward);
  }

  // --- integrate ----------------------------------------------------------
  p.vel.y = Math.max(p.vel.y, -JUMP.maxFall);

  // Carry by the surface underneath before integrating our own velocity.
  v3scale(_delta, p.vel, dt);
  if (p.grounded) {
    _delta.x += p.groundVel.x * dt;
    _delta.y += p.groundVel.y * dt;
    _delta.z += p.groundVel.z * dt;
  }

  const wasGrounded = p.grounded;
  const prevVelY = p.vel.y;
  const res = moveAndCollide(p, _delta, ctx, scale, dt);

  // --- ground state -------------------------------------------------------
  p.grounded = res.grounded;
  if (res.grounded && res.groundCollider) {
    v3copy(p.groundNormal, res.groundNormal);
    p.groundColliderId = res.groundCollider.id;
    p.groundSurface = res.groundCollider.surface;
    colliderPointVelocity(p.groundVel, res.groundCollider, p.pos);
    p.coyote = JUMP.coyoteTime;
    p.airJumpsUsed = 0;
  } else {
    v3set(p.groundNormal, 0, 1, 0);
    p.groundColliderId = 0;
    // Platform momentum bleeds off quickly once airborne.
    v3scale(p.groundVel, p.groundVel, Math.max(0, 1 - dt * 6));
  }

  // Snap down small gaps so ramps and steps do not cause bunny-hopping.
  if (!p.grounded && wasGrounded && p.vel.y <= 0.5 && p.state !== MoveState.Dive) {
    const snap = MOVE.groundSnap * scale;
    v3set(_tmp, 0, -snap, 0);
    const before = p.pos.y;
    const snapRes = moveAndCollide(p, _tmp, ctx, scale, dt);
    if (snapRes.grounded && snapRes.groundCollider) {
      p.grounded = true;
      v3copy(p.groundNormal, snapRes.groundNormal);
      p.groundColliderId = snapRes.groundCollider.id;
      p.groundSurface = snapRes.groundCollider.surface;
      colliderPointVelocity(p.groundVel, snapRes.groundCollider, p.pos);
      p.coyote = JUMP.coyoteTime;
      p.vel.y = Math.min(p.vel.y, 0);
    } else {
      p.pos.y = before;
    }
  }

  // --- landing ------------------------------------------------------------
  if (p.grounded && !wasGrounded) {
    const impactSpeed = -prevVelY;
    if (p.state === MoveState.Dive && p.stateTime > DIVE.minTime) {
      p.state = MoveState.DiveSlide;
      p.stateTime = 0;
      emit(ctx, SimEventKind.DiveLand, p, impactSpeed);
    } else if (p.state === MoveState.Air) {
      p.state = Math.hypot(p.vel.x, p.vel.z) > MOVE.idleSpeed ? MoveState.Run : MoveState.Idle;
      p.stateTime = 0;
    }
    if (impactSpeed > 1.5) {
      ctx.events.push({
        kind: SimEventKind.Land, playerId: p.id, value: impactSpeed,
        x: p.pos.x, y: p.pos.y, z: p.pos.z, ref: p.groundSurface,
      });
    }
    // A brutal landing knocks the wind out - pure comedy, and it teaches players
    // to respect height.
    if (impactSpeed > JUMP.hardLandSpeed && p.state !== MoveState.DiveSlide) {
      enterRagdoll(p, IMPACT.fall + (impactSpeed - JUMP.hardLandSpeed) * 0.4, ctx);
    }
  } else if (!p.grounded && wasGrounded && p.state !== MoveState.Dive &&
             p.state !== MoveState.Ragdoll && p.state !== MoveState.GetUp) {
    if (p.state === MoveState.Idle || p.state === MoveState.Run) {
      p.state = MoveState.Air;
      p.stateTime = 0;
    }
  }

  // --- slope sliding ------------------------------------------------------
  if (p.grounded && p.groundNormal.y < MOVE.maxSlopeCos + 0.02 && p.state !== MoveState.Ragdoll) {
    const n = p.groundNormal;
    v3set(_tmp, n.x, 0, n.z);
    const l = v3len(_tmp);
    if (l > 0.001) {
      v3scale(_tmp, _tmp, 1 / l);
      v3addScaled(p.vel, p.vel, _tmp, MOVE.slideAccel * dt);
    }
  }

  // --- grounded state tidy-up --------------------------------------------
  if (p.grounded && (p.state === MoveState.Idle || p.state === MoveState.Run)) {
    const hs = Math.hypot(p.vel.x, p.vel.z);
    p.state = hs > MOVE.idleSpeed ? MoveState.Run : MoveState.Idle;
  }

  // --- facing -------------------------------------------------------------
  if (p.state !== MoveState.Dive && p.state !== MoveState.Ragdoll) {
    const hs = Math.hypot(p.vel.x, p.vel.z);
    let targetYaw = p.yaw;
    if (hasInput && canAct(p)) targetYaw = Math.atan2(_wish.x, _wish.z);
    else if (hs > 1.2) targetYaw = Math.atan2(p.vel.x, p.vel.z);
    const rate = p.grounded ? MOVE.turnRate : MOVE.turnRate * 0.6;
    p.yaw += angleDelta(p.yaw, targetYaw) * Math.min(1, rate * dt);
  }

  // --- idle / AFK bookkeeping --------------------------------------------
  if (hasInput || cmd.buttons !== 0) p.idleTicks = 0; else p.idleTicks++;

  // --- fall out of the world ---------------------------------------------
  const stNow = p.state as MoveState;
  if (p.pos.y < ctx.killY && stNow !== MoveState.Respawning && stNow !== MoveState.Eliminated) {
    emit(ctx, SimEventKind.Fall, p, 0);
    p.state = MoveState.Respawning;
    p.stateTime = 0;
    p.stateTimer = RESPAWN.delay;
    p.falls++;
    v3set(p.vel, 0, 0, 0);
  }
}

function groundMove(p: PlayerSim, wish: Vec3, hasInput: boolean, maxSpeed: number, dt: number): void {
  // Work in the frame of the surface we stand on, so belts and platforms feel
  // right instead of fighting the player's own velocity.
  const rvx = p.vel.x - p.groundVel.x;
  const rvz = p.vel.z - p.groundVel.z;

  if (!hasInput) {
    const speed = Math.hypot(rvx, rvz);
    if (speed > 0.001) {
      const drop = Math.min(speed, MOVE.friction * dt);
      const s = (speed - drop) / speed;
      p.vel.x = p.groundVel.x + rvx * s;
      p.vel.z = p.groundVel.z + rvz * s;
    }
    if (p.vel.y > 0) p.vel.y = 0;
    return;
  }

  const targetX = wish.x * maxSpeed;
  const targetZ = wish.z * maxSpeed;
  let dx = targetX - rvx;
  let dz = targetZ - rvz;
  const dLen = Math.hypot(dx, dz);
  if (dLen > 0.0001) {
    // Turning against current motion brakes harder: crisp direction changes
    // without making top speed feel twitchy.
    const align = (rvx * wish.x + rvz * wish.z) / (Math.hypot(rvx, rvz) + 0.001) / (maxSpeed || 1);
    const accel = MOVE.accel + (align < 0 ? MOVE.turnBrake : 0);
    const step = Math.min(dLen, accel * dt);
    p.vel.x += (dx / dLen) * step;
    p.vel.z += (dz / dLen) * step;
  }
  if (p.vel.y > 0) p.vel.y = 0;
}

function airMove(p: PlayerSim, wish: Vec3, hasInput: boolean, maxSpeed: number, dt: number, controlScale = 1): void {
  if (hasInput) {
    const control = MOVE.airControl * controlScale;
    const targetX = wish.x * maxSpeed;
    const targetZ = wish.z * maxSpeed;
    let dx = targetX - p.vel.x;
    let dz = targetZ - p.vel.z;
    const dLen = Math.hypot(dx, dz);
    if (dLen > 0.0001) {
      const step = Math.min(dLen, MOVE.airAccel * control * dt);
      p.vel.x += (dx / dLen) * step;
      p.vel.z += (dz / dLen) * step;
    }
  } else {
    const speed = Math.hypot(p.vel.x, p.vel.z);
    if (speed > maxSpeed) {
      const drop = Math.min(speed - maxSpeed, MOVE.airFriction * dt);
      const s = (speed - drop) / speed;
      p.vel.x *= s; p.vel.z *= s;
    }
  }
}

function applyFriction(p: PlayerSim, amount: number, dt: number): void {
  const speed = Math.hypot(p.vel.x, p.vel.z);
  if (speed < 0.001) return;
  const drop = Math.min(speed, amount * dt);
  const s = (speed - drop) / speed;
  p.vel.x *= s; p.vel.z *= s;
}

/**
 * Player-vs-player separation. Soft enough that crowds jostle instead of
 * exploding, firm enough that nobody phases through anybody.
 */
export function resolvePlayerCollisions(players: PlayerSim[], ctx: SimContext, dt: number): void {
  const rules = ctx.rules;
  if (!rules.playerCollision) return;
  const r = PVP.radius * rules.sizeScale;
  const minDist = r * 2;
  const minDistSq = minDist * minDist;

  for (let i = 0; i < players.length; i++) {
    const a = players[i];
    if (!isActiveBody(a)) continue;
    for (let j = i + 1; j < players.length; j++) {
      const b = players[j];
      if (!isActiveBody(b)) continue;
      if (!rules.friendlyCollision && a.teamId !== 0 && a.teamId === b.teamId) continue;

      const dx = b.pos.x - a.pos.x;
      const dz = b.pos.z - a.pos.z;
      const dy = b.pos.y - a.pos.y;
      if (Math.abs(dy) > CHAR.height * rules.sizeScale) continue;
      const dSq = dx * dx + dz * dz;
      if (dSq > minDistSq || dSq < 1e-8) continue;

      const d = Math.sqrt(dSq);
      const nx = dx / d, nz = dz / d;
      const overlap = minDist - d;

      // Positional correction, split between both bodies.
      const corr = Math.min(overlap * 0.5, PVP.maxPush * dt);
      a.pos.x -= nx * corr; a.pos.z -= nz * corr;
      b.pos.x += nx * corr; b.pos.z += nz * corr;

      // Velocity exchange along the contact normal.
      const rel = (b.vel.x - a.vel.x) * nx + (b.vel.z - a.vel.z) * nz;
      if (rel < 0) {
        const imp = clamp(-rel * PVP.transfer, 0, PVP.maxPush);
        a.vel.x -= nx * imp; a.vel.z -= nz * imp;
        b.vel.x += nx * imp; b.vel.z += nz * imp;

        const speed = Math.abs(rel);
        if (speed > 4) {
          ctx.events.push({
            kind: SimEventKind.PlayerBump, playerId: a.id, value: speed,
            x: (a.pos.x + b.pos.x) * 0.5, y: a.pos.y + 0.8, z: (a.pos.z + b.pos.z) * 0.5, ref: b.id,
          });
        }
      }

      // A dive is a weapon: whoever is airborne and diving shoves the other.
      const aDive = a.state === MoveState.Dive, bDive = b.state === MoveState.Dive;
      if (aDive !== bDive) {
        const attacker = aDive ? a : b;
        const victim = aDive ? b : a;
        if (victim.invuln <= 0 && victim.ability.shield <= 0) {
          const sx = aDive ? nx : -nx, sz = aDive ? nz : -nz;
          const power = DIVE.hitImpulse * (Math.hypot(attacker.vel.x, attacker.vel.z) / DIVE.forward);
          v3set(_tmp, sx, 0.22, sz);
          v3normalize(_tmp, _tmp);
          applyImpulse(victim, _tmp, Math.max(power, IMPACT.stumble + 0.5), ctx);
        }
      }

      // Repulsion field ability pushes everyone else away.
      if (a.ability.repulse > 0 || b.ability.repulse > 0) {
        const pusher = a.ability.repulse > 0 ? a : b;
        const target = a.ability.repulse > 0 ? b : a;
        const sx = pusher === a ? nx : -nx, sz = pusher === a ? nz : -nz;
        v3set(_tmp, sx, 0.3, sz);
        v3normalize(_tmp, _tmp);
        applyImpulse(target, _tmp, IMPACT.stumble + 1.5, ctx);
      }
    }
  }
}

function isActiveBody(p: PlayerSim): boolean {
  return p.state !== MoveState.Respawning && p.state !== MoveState.Eliminated && p.connected;
}

export { v3lenSq, v3add };
