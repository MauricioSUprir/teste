/**
 * The Wobbler - the player character.
 *
 * Built entirely in code: a rounded, big-headed silhouette that reads clearly
 * at any distance, with a real bone hierarchy underneath.
 *
 * Animation is procedural and blends by *damping*: each frame we compute the
 * target pose for the current state and ease every joint toward it. That gives
 * smooth transitions everywhere for free - no clip can ever pop - and costs a
 * few dozen lerps per character.
 */
import * as THREE from 'three';
import { MoveState } from '../shared/types';
import { clamp, lerp, damp, smoothstep, TAU } from '../shared/math';
import { CHAR } from '../shared/config';

export interface WobblerLook {
  skin: number;
  accent: number;
  /** Cosmetic ids - resolved by the cosmetic system later. */
  hat?: string;
  trail?: string;
}

interface Bone {
  obj: THREE.Object3D;
  /** Current eased rotation. */
  rx: number; ry: number; rz: number;
  /** Target rotation for this frame. */
  tx: number; ty: number; tz: number;
}

const BONE_NAMES = [
  'hips', 'torso', 'head',
  'armUpL', 'armLoL', 'armUpR', 'armLoR',
  'legUpL', 'legLoL', 'legUpR', 'legLoR',
] as const;
type BoneName = typeof BONE_NAMES[number];

/** Reusable geometry - shared by every character in the match. */
export const PART_GEO = {
  head: new THREE.SphereGeometry(0.42, 20, 16),
  torso: new THREE.CapsuleGeometry(0.28, 0.22, 6, 14),
  armUp: new THREE.CapsuleGeometry(0.098, 0.16, 5, 10),
  armLo: new THREE.CapsuleGeometry(0.088, 0.15, 5, 10),
  hand: new THREE.SphereGeometry(0.115, 12, 10),
  legUp: new THREE.CapsuleGeometry(0.115, 0.15, 5, 10),
  legLo: new THREE.CapsuleGeometry(0.105, 0.14, 5, 10),
  foot: new THREE.CapsuleGeometry(0.115, 0.14, 5, 10),
  eye: new THREE.SphereGeometry(0.105, 12, 10),
  pupil: new THREE.SphereGeometry(0.052, 10, 8),
  brow: new THREE.BoxGeometry(0.16, 0.038, 0.05),
};

export type PartGeoKey = keyof typeof PART_GEO;
/** Which material a part uses; 'skin' and 'accent' are per-character colours. */
export type PartMaterial = 'skin' | 'accent' | 'eye' | 'dark';

export interface CharacterPart {
  /** Attachment point in the rig; its world matrix is the part's transform. */
  node: THREE.Object3D;
  geo: PartGeoKey;
  mat: PartMaterial;
  /** Detail level: 0 always drawn, 1 dropped at distance, 2 dropped sooner. */
  lod: number;
}

export class Wobbler {
  readonly root = new THREE.Group();
  /** Yaw pivot: pos on root, facing here, so squash/stretch stays upright. */
  readonly body = new THREE.Group();
  private bones = new Map<BoneName, Bone>();
  readonly parts: CharacterPart[] = [];
  skinColor: number;
  accentColor: number;
  /** Bumped whenever colours change so the batch re-uploads them. */
  colorVersion = 0;
  private eyeL!: THREE.Object3D;
  private eyeR!: THREE.Object3D;
  private pupilL!: THREE.Object3D;
  private pupilR!: THREE.Object3D;
  private browL!: THREE.Object3D;
  private browR!: THREE.Object3D;

  /** Animation clocks. */
  private runPhase = 0;
  private idlePhase = Math.random() * TAU;
  private squash = 1;
  private squashVel = 0;
  private leanX = 0;
  private leanZ = 0;
  private blink = 0;
  private blinkTimer = 2 + Math.random() * 3;
  private lookAt = new THREE.Vector3();
  private lookWeight = 0;
  private lastState: MoveState = MoveState.Idle;
  private emoteTime = 0;
  private emoteId = 0;

  constructor(look: WobblerLook) {
    this.skinColor = look.skin;
    this.accentColor = look.accent;
    this.root.add(this.body);
    this.build();
  }

  private makeBone(name: BoneName, parent: THREE.Object3D, x: number, y: number, z: number): Bone {
    const obj = new THREE.Object3D();
    obj.position.set(x, y, z);
    parent.add(obj);
    const b: Bone = { obj, rx: 0, ry: 0, rz: 0, tx: 0, ty: 0, tz: 0 };
    this.bones.set(name, b);
    return b;
  }

  /**
   * Creates an attachment point rather than a mesh. Geometry is drawn later by
   * the CharacterBatch as one instanced draw per part type, which is what lets
   * 32 characters share a dozen draw calls instead of needing seven hundred.
   */
  private part(geo: PartGeoKey, mat: PartMaterial, parent: THREE.Object3D,
               x: number, y: number, z: number,
               scale?: [number, number, number], lod = 0): THREE.Object3D {
    const node = new THREE.Object3D();
    node.position.set(x, y, z);
    if (scale) node.scale.set(scale[0], scale[1], scale[2]);
    parent.add(node);
    this.parts.push({ node, geo, mat, lod });
    return node;
  }

  private build(): void {
    const hips = this.makeBone('hips', this.body, 0, 0.52, 0);
    const torso = this.makeBone('torso', hips.obj, 0, 0.12, 0);
    this.part('torso', 'skin', torso.obj, 0, 0.12, 0, [1.05, 1, 0.82]);
    // A chest plate in the accent colour: reads as clothing without textures.
    this.part('torso', 'accent', torso.obj, 0, 0.02, 0.01, [1.02, 0.62, 0.85], 1);

    const head = this.makeBone('head', torso.obj, 0, 0.5, 0);
    this.part('head', 'skin', head.obj, 0, 0.04, 0, [1, 0.94, 0.96]);

    // Face. Eyes sit proud of the skull so they catch light from any angle.
    this.eyeL = this.part('eye', 'eye', head.obj, -0.155, 0.07, 0.335, [1, 1.12, 0.8], 1);
    this.eyeR = this.part('eye', 'eye', head.obj, 0.155, 0.07, 0.335, [1, 1.12, 0.8], 1);
    this.pupilL = this.part('pupil', 'dark', this.eyeL, 0, 0, 0.07, undefined, 2);
    this.pupilR = this.part('pupil', 'dark', this.eyeR, 0, 0, 0.07, undefined, 2);
    this.browL = this.part('brow', 'dark', head.obj, -0.155, 0.2, 0.36, undefined, 2);
    this.browR = this.part('brow', 'dark', head.obj, 0.155, 0.2, 0.36, undefined, 2);

    for (const side of [-1, 1] as const) {
      const s = side < 0 ? 'L' : 'R';
      const up = this.makeBone(`armUp${s}` as BoneName, torso.obj, side * 0.31, 0.26, 0);
      this.part('armUp', 'skin', up.obj, 0, -0.14, 0);
      const lo = this.makeBone(`armLo${s}` as BoneName, up.obj, 0, -0.28, 0);
      this.part('armLo', 'skin', lo.obj, 0, -0.13, 0);
      this.part('hand', 'accent', lo.obj, 0, -0.27, 0, undefined, 1);

      const lup = this.makeBone(`legUp${s}` as BoneName, hips.obj, side * 0.145, -0.04, 0);
      this.part('legUp', 'skin', lup.obj, 0, -0.14, 0);
      const llo = this.makeBone(`legLo${s}` as BoneName, lup.obj, 0, -0.27, 0);
      this.part('legLo', 'skin', llo.obj, 0, -0.13, 0);
      this.part('foot', 'accent', llo.obj, 0, -0.255, 0.05, [1, 0.7, 1.5], 1);
    }
  }

  /** Cosmetic recolour without rebuilding the character. */
  setLook(look: WobblerLook): void {
    this.skinColor = look.skin;
    this.accentColor = look.accent;
    this.colorVersion++;
  }

  setVisible(v: boolean): void { this.root.visible = v; }

  /** Nudges the head to glance at a world point (players, hazards, the finish). */
  glanceAt(x: number, y: number, z: number, weight = 1): void {
    this.lookAt.set(x, y, z);
    this.lookWeight = clamp(weight, 0, 1);
  }

  playEmote(id: number): void {
    this.emoteId = id;
    this.emoteTime = 1.8;
  }

  private set(name: BoneName, x: number, y: number, z: number): void {
    const b = this.bones.get(name)!;
    b.tx = x; b.ty = y; b.tz = z;
  }

  /**
   * Drives the whole rig for one frame.
   * `speed` is horizontal speed, `vy` vertical velocity, `grounded` self-explanatory.
   */
  update(dt: number, state: MoveState, speed: number, vy: number, grounded: boolean,
         yaw: number, stateTime: number, turnRate = 0): void {
    const maxSpeed = 7.3;
    const run = clamp(speed / maxSpeed, 0, 1.3);

    // --- clocks -----------------------------------------------------------
    // Stride frequency follows speed, so feet never skate.
    this.runPhase += dt * (4.6 + run * 7.2);
    this.idlePhase += dt * 1.9;
    if (this.emoteTime > 0) this.emoteTime -= dt;

    // Landing squash: an impulse into a spring, which is what gives weight.
    if (state !== this.lastState) {
      if ((this.lastState === MoveState.Air || this.lastState === MoveState.Dive) && grounded) {
        this.squashVel -= clamp(Math.abs(vy) * 0.055 + 0.18, 0, 0.55);
      }
      if (state === MoveState.Air && this.lastState !== MoveState.Dive) {
        this.squashVel += 0.28;
      }
      this.lastState = state;
    }
    // Critically damped-ish spring back to 1.
    this.squashVel += (1 - this.squash) * 62 * dt;
    this.squashVel *= Math.exp(-11 * dt);
    this.squash += this.squashVel * dt;
    this.squash = clamp(this.squash, 0.68, 1.28);

    // --- pose -------------------------------------------------------------
    switch (state) {
      case MoveState.Run: this.poseRun(run); break;
      case MoveState.Air: this.poseAir(vy); break;
      case MoveState.Dive: this.poseDive(); break;
      case MoveState.DiveSlide: this.poseSlide(); break;
      case MoveState.Ragdoll: this.poseRagdoll(stateTime); break;
      case MoveState.GetUp: this.poseGetUp(stateTime); break;
      case MoveState.Stumble: this.poseStumble(stateTime); break;
      case MoveState.Finished: this.poseCelebrate(stateTime); break;
      case MoveState.Eliminated: this.poseLose(); break;
      case MoveState.Frozen: this.poseReady(); break;
      default:
        if (this.emoteTime > 0) this.poseEmote();
        else this.poseIdle(run);
        break;
    }

    // --- body transform ---------------------------------------------------
    const prone = state === MoveState.Dive || state === MoveState.DiveSlide ||
      state === MoveState.Ragdoll;
    // Lean into acceleration and turns - the single cheapest way to make a
    // character look like it has momentum.
    const targetLean = prone ? 0 : clamp(run * 0.22, 0, 0.3);
    this.leanX = damp(this.leanX, targetLean, 9, dt);
    // Bank into the turn like a runner leaning through a corner. This is the
    // cheapest animation in the game and the one that most makes movement read
    // as weight rather than a sliding puppet.
    const bank = prone ? 0 : clamp(turnRate * 0.16, -0.42, 0.42) * clamp(run, 0, 1);
    this.leanZ = damp(this.leanZ, bank, 7, dt);

    this.body.rotation.y = yaw;
    this.body.position.y = 0;
    const stretch = 2 - this.squash;
    this.body.scale.set(
      lerp(1, this.squash, 0.55) * (prone ? 1 : 1),
      this.squash,
      lerp(1, this.squash, 0.55),
    );
    void stretch;

    const hips = this.bones.get('hips')!;
    hips.obj.rotation.x = this.leanX;
    hips.obj.rotation.z = this.leanZ;

    // --- eased application ------------------------------------------------
    // One damp per axis: this *is* the blending system.
    const rate = prone ? 16 : 18;
    for (const name of BONE_NAMES) {
      const b = this.bones.get(name)!;
      b.rx = damp(b.rx, b.tx, rate, dt);
      b.ry = damp(b.ry, b.ty, rate, dt);
      b.rz = damp(b.rz, b.tz, rate, dt);
      if (name === 'hips') {
        b.obj.rotation.x = b.rx + this.leanX;
        b.obj.rotation.y = b.ry;
        b.obj.rotation.z = b.rz + this.leanZ;
      } else {
        b.obj.rotation.set(b.rx, b.ry, b.rz);
      }
    }

    this.updateFace(dt, state, run);
  }

  private updateFace(dt: number, state: MoveState, run: number): void {
    // Blinking, because a face that never blinks looks dead.
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) { this.blink = 1; this.blinkTimer = 2.2 + Math.random() * 3.4; }
    if (this.blink > 0) this.blink = Math.max(0, this.blink - dt * 7);
    const open = state === MoveState.Ragdoll ? 0.25 : 1 - smoothstep(this.blink) * 0.9;
    this.eyeL.scale.y = 1.12 * open;
    this.eyeR.scale.y = 1.12 * open;

    // Brows carry the whole performance: worried in the air, determined running.
    let browAngle = 0;
    let browLift = 0;
    switch (state) {
      case MoveState.Air: browAngle = -0.35; browLift = 0.045; break;
      case MoveState.Dive: browAngle = 0.4; browLift = -0.012; break;
      case MoveState.Ragdoll: browAngle = -0.5; browLift = 0.02; break;
      case MoveState.Finished: browAngle = -0.2; browLift = 0.05; break;
      case MoveState.Eliminated: browAngle = -0.45; browLift = 0.01; break;
      default: browAngle = run > 0.5 ? 0.22 : 0.04; browLift = run > 0.5 ? -0.012 : 0;
    }
    this.browL.rotation.z = damp(this.browL.rotation.z, -browAngle, 12, dt);
    this.browR.rotation.z = damp(this.browR.rotation.z, browAngle, 12, dt);
    this.browL.position.y = damp(this.browL.position.y, 0.2 + browLift, 12, dt);
    this.browR.position.y = damp(this.browR.position.y, 0.2 + browLift, 12, dt);

    // Pupils drift toward whatever we last glanced at.
    const head = this.bones.get('head')!.obj;
    let px = 0, py = 0;
    if (this.lookWeight > 0.01) {
      head.updateWorldMatrix(true, false);
      const local = this.lookAt.clone();
      head.worldToLocal(local);
      const l = local.length() || 1;
      px = clamp(local.x / l, -1, 1) * 0.035 * this.lookWeight;
      py = clamp(local.y / l, -1, 1) * 0.028 * this.lookWeight;
      this.lookWeight = Math.max(0, this.lookWeight - dt * 0.55);
    }
    this.pupilL.position.x = damp(this.pupilL.position.x, px, 10, dt);
    this.pupilR.position.x = damp(this.pupilR.position.x, px, 10, dt);
    this.pupilL.position.y = damp(this.pupilL.position.y, py, 10, dt);
    this.pupilR.position.y = damp(this.pupilR.position.y, py, 10, dt);
  }

  // ── poses ───────────────────────────────────────────────────────────────
  private poseIdle(run: number): void {
    const b = Math.sin(this.idlePhase) * 0.045;
    const sway = Math.sin(this.idlePhase * 0.5) * 0.06;
    this.set('hips', 0.02 + b * 0.3, sway * 0.3, 0);
    this.set('torso', -b * 0.5, sway * 0.4, 0);
    this.set('head', b * 0.6 - 0.04, -sway * 0.8, 0);
    this.set('armUpL', b * 0.5, 0, 0.16 + b * 0.25);
    this.set('armUpR', b * 0.5, 0, -0.16 - b * 0.25);
    this.set('armLoL', 0.12, 0, 0.06);
    this.set('armLoR', 0.12, 0, -0.06);
    this.set('legUpL', 0, 0, 0.03);
    this.set('legUpR', 0, 0, -0.03);
    this.set('legLoL', 0.04, 0, 0);
    this.set('legLoR', 0.04, 0, 0);
    void run;
  }

  private poseReady(): void {
    // Crouched on the start line, weight forward.
    this.set('hips', 0.22, 0, 0);
    this.set('torso', 0.1, 0, 0);
    this.set('head', -0.26, 0, 0);
    this.set('armUpL', -0.55, 0, 0.3);
    this.set('armUpR', -0.55, 0, -0.3);
    this.set('armLoL', -0.8, 0, 0);
    this.set('armLoR', -0.8, 0, 0);
    this.set('legUpL', 0.45, 0, 0.05);
    this.set('legUpR', 0.25, 0, -0.05);
    this.set('legLoL', -0.7, 0, 0);
    this.set('legLoR', -0.45, 0, 0);
  }

  private poseRun(run: number): void {
    const p = this.runPhase;
    const amp = 0.55 + run * 0.62;
    const swing = Math.sin(p);
    const swing2 = Math.sin(p + Math.PI);
    const bob = Math.abs(Math.cos(p)) * 0.07 * run;

    this.set('hips', 0.06 + bob, Math.sin(p) * 0.08, 0);
    this.set('torso', 0.05, -Math.sin(p) * 0.12, 0);
    this.set('head', -0.06 - run * 0.05, Math.sin(p) * 0.06, 0);

    // Arms counter-swing the legs, elbows always slightly bent.
    this.set('armUpL', swing2 * amp * 0.85, 0, 0.12);
    this.set('armUpR', swing * amp * 0.85, 0, -0.12);
    this.set('armLoL', -0.35 - Math.max(0, swing2) * 0.45, 0, 0);
    this.set('armLoR', -0.35 - Math.max(0, swing) * 0.45, 0, 0);

    this.set('legUpL', swing * amp, 0, 0.02);
    this.set('legUpR', swing2 * amp, 0, -0.02);
    // Knees only bend backwards, and most on the recovery stroke.
    this.set('legLoL', Math.max(0, -swing) * amp * 1.25 + 0.06, 0, 0);
    this.set('legLoR', Math.max(0, -swing2) * amp * 1.25 + 0.06, 0, 0);
  }

  private poseAir(vy: number): void {
    const rising = clamp(vy / 9, -1, 1);
    // Tuck going up, reach going down.
    this.set('hips', 0.1 - rising * 0.2, 0, 0);
    this.set('torso', 0.08, 0, 0);
    this.set('head', -0.12 - rising * 0.1, 0, 0);
    this.set('armUpL', -1.9 - rising * 0.5, 0, 0.5);
    this.set('armUpR', -1.9 - rising * 0.5, 0, -0.5);
    this.set('armLoL', -0.5, 0, 0);
    this.set('armLoR', -0.5, 0, 0);
    this.set('legUpL', 0.55 + rising * 0.45, 0, 0.12);
    this.set('legUpR', 0.2 + rising * 0.35, 0, -0.12);
    this.set('legLoL', -0.95 - rising * 0.4, 0, 0);
    this.set('legLoR', -0.55 - rising * 0.3, 0, 0);
  }

  private poseDive(): void {
    // Superman. The body pivot is laid flat by the caller via proneTilt().
    this.set('hips', 0.1, 0, 0);
    this.set('torso', -0.15, 0, 0);
    this.set('head', -0.45, 0, 0);
    this.set('armUpL', -2.75, 0, 0.16);
    this.set('armUpR', -2.75, 0, -0.16);
    this.set('armLoL', -0.1, 0, 0);
    this.set('armLoR', -0.1, 0, 0);
    this.set('legUpL', 0.28, 0, 0.1);
    this.set('legUpR', 0.28, 0, -0.1);
    this.set('legLoL', 0.4, 0, 0);
    this.set('legLoR', 0.4, 0, 0);
  }

  private poseSlide(): void {
    this.set('hips', 0.05, 0, 0);
    this.set('torso', -0.05, 0, 0);
    this.set('head', -0.35, 0, 0);
    this.set('armUpL', -2.5, 0, 0.5);
    this.set('armUpR', -2.3, 0, -0.35);
    this.set('armLoL', -0.35, 0, 0);
    this.set('armLoR', -0.2, 0, 0);
    this.set('legUpL', 0.15, 0, 0.18);
    this.set('legUpR', 0.2, 0, -0.14);
    this.set('legLoL', 0.55, 0, 0);
    this.set('legLoR', 0.4, 0, 0);
  }

  private poseRagdoll(t: number): void {
    // Loose, floppy, and never quite the same twice.
    const w = Math.sin(t * 9) * 0.5;
    const w2 = Math.cos(t * 7.3) * 0.5;
    this.set('hips', 0.2 + w * 0.3, w2 * 0.4, w * 0.3);
    this.set('torso', -0.3 + w2 * 0.3, w * 0.3, -w2 * 0.25);
    this.set('head', 0.5 + w * 0.45, w2 * 0.5, w * 0.4);
    this.set('armUpL', -2.4 + w * 0.9, 0, 0.9 + w2 * 0.5);
    this.set('armUpR', -2.4 + w2 * 0.9, 0, -0.9 - w * 0.5);
    this.set('armLoL', -0.9 + w2 * 0.6, 0, 0);
    this.set('armLoR', -0.9 + w * 0.6, 0, 0);
    this.set('legUpL', 0.7 + w2 * 0.7, 0, 0.35);
    this.set('legUpR', 0.5 + w * 0.7, 0, -0.35);
    this.set('legLoL', 0.6 + w * 0.5, 0, 0);
    this.set('legLoR', 0.75 + w2 * 0.5, 0, 0);
  }

  private poseGetUp(t: number): void {
    const k = smoothstep(clamp(t / 0.5, 0, 1));
    this.set('hips', lerp(0.55, 0.05, k), 0, 0);
    this.set('torso', lerp(-0.4, 0, k), 0, 0);
    this.set('head', lerp(0.35, -0.05, k), 0, 0);
    this.set('armUpL', lerp(-1.6, -0.1, k), 0, lerp(0.7, 0.15, k));
    this.set('armUpR', lerp(-1.6, -0.1, k), 0, lerp(-0.7, -0.15, k));
    this.set('armLoL', lerp(-1.0, -0.15, k), 0, 0);
    this.set('armLoR', lerp(-1.0, -0.15, k), 0, 0);
    this.set('legUpL', lerp(1.1, 0, k), 0, 0.05);
    this.set('legUpR', lerp(0.8, 0, k), 0, -0.05);
    this.set('legLoL', lerp(-1.3, 0.05, k), 0, 0);
    this.set('legLoR', lerp(-1.0, 0.05, k), 0, 0);
  }

  private poseStumble(t: number): void {
    const w = Math.sin(t * 22) * 0.35;
    this.set('hips', 0.3 + w * 0.2, w, w * 0.6);
    this.set('torso', -0.25, -w * 0.5, -w * 0.4);
    this.set('head', 0.2 + w * 0.3, w * 0.6, 0);
    this.set('armUpL', -2.3, 0, 0.9 + w);
    this.set('armUpR', -2.3, 0, -0.9 + w);
    this.set('armLoL', -0.4, 0, 0);
    this.set('armLoR', -0.4, 0, 0);
    this.set('legUpL', 0.5 + w, 0, 0.1);
    this.set('legUpR', 0.1 - w, 0, -0.1);
    this.set('legLoL', 0.25, 0, 0);
    this.set('legLoR', 0.45, 0, 0);
  }

  private poseCelebrate(t: number): void {
    const p = t * 7;
    const jump = Math.abs(Math.sin(p)) * 0.4;
    this.set('hips', -0.1, Math.sin(p * 0.5) * 0.3, 0);
    this.set('torso', -0.12, Math.sin(p * 0.5) * 0.2, 0);
    this.set('head', -0.25, Math.sin(p * 0.5) * 0.25, 0);
    this.set('armUpL', -2.9 - jump * 0.3, 0, 0.55);
    this.set('armUpR', -2.9 - jump * 0.3, 0, -0.55);
    this.set('armLoL', -0.15, 0, 0);
    this.set('armLoR', -0.15, 0, 0);
    this.set('legUpL', jump * 0.5, 0, 0.06);
    this.set('legUpR', -jump * 0.3, 0, -0.06);
    this.set('legLoL', 0.15, 0, 0);
    this.set('legLoR', 0.15, 0, 0);
  }

  private poseLose(): void {
    this.set('hips', 0.18, 0, 0);
    this.set('torso', 0.3, 0, 0);
    this.set('head', 0.55, 0, 0);
    this.set('armUpL', 0.25, 0, 0.1);
    this.set('armUpR', 0.25, 0, -0.1);
    this.set('armLoL', -0.1, 0, 0);
    this.set('armLoR', -0.1, 0, 0);
    this.set('legUpL', 0, 0, 0.04);
    this.set('legUpR', 0, 0, -0.04);
    this.set('legLoL', 0.08, 0, 0);
    this.set('legLoR', 0.08, 0, 0);
  }

  private poseEmote(): void {
    const t = 1.8 - this.emoteTime;
    const p = t * 9;
    switch (this.emoteId % 5) {
      case 0: // wave
        this.set('armUpR', -2.7, 0, -0.9 - Math.sin(p) * 0.35);
        this.set('armLoR', -0.35, 0, 0);
        this.set('armUpL', -0.1, 0, 0.14);
        this.set('armLoL', -0.15, 0, 0);
        this.set('head', -0.08, Math.sin(p * 0.5) * 0.18, 0);
        this.set('hips', 0.03, 0, 0);
        this.set('torso', 0, 0, 0);
        break;
      case 1: // dance
        this.set('hips', 0.06, Math.sin(p * 0.5) * 0.45, Math.sin(p) * 0.14);
        this.set('torso', Math.sin(p) * 0.12, -Math.sin(p * 0.5) * 0.3, 0);
        this.set('head', -0.05, Math.sin(p * 0.5) * 0.4, Math.sin(p) * 0.15);
        this.set('armUpL', -1.5 + Math.sin(p) * 0.9, 0, 0.6);
        this.set('armUpR', -1.5 - Math.sin(p) * 0.9, 0, -0.6);
        this.set('armLoL', -0.7, 0, 0);
        this.set('armLoR', -0.7, 0, 0);
        this.set('legUpL', Math.sin(p) * 0.35, 0, 0.05);
        this.set('legUpR', -Math.sin(p) * 0.35, 0, -0.05);
        break;
      case 3: { // applause
        const clap = Math.abs(Math.sin(p * 1.4));
        this.set('armUpL', -1.5, 0, 0.35 + clap * 0.3);
        this.set('armUpR', -1.5, 0, -0.35 - clap * 0.3);
        this.set('armLoL', -1.1, 0, 0);
        this.set('armLoR', -1.1, 0, 0);
        this.set('head', -0.1, 0, 0);
        this.set('hips', 0.04 + clap * 0.05, 0, 0);
        this.set('torso', -0.04, 0, 0);
        break;
      }
      case 4: { // point forward
        this.set('armUpR', -2.1, 0, -0.25);
        this.set('armLoR', -0.05, 0, 0);
        this.set('armUpL', -0.2, 0, 0.2);
        this.set('armLoL', -0.5, 0, 0);
        this.set('head', -0.18, Math.sin(p * 0.6) * 0.1, 0);
        this.set('torso', -0.08, 0.15, 0);
        this.set('hips', 0.03, 0.1, 0);
        break;
      }
      default: // taunt / shrug
        this.set('armUpL', -0.9, 0, 0.95);
        this.set('armUpR', -0.9, 0, -0.95);
        this.set('armLoL', -1.3, 0, 0.2);
        this.set('armLoR', -1.3, 0, -0.2);
        this.set('head', -0.12 + Math.sin(p * 0.4) * 0.08, 0, Math.sin(p * 0.3) * 0.12);
        this.set('torso', -0.05, 0, 0);
        break;
    }
  }

  /**
   * Lays the whole character flat for dives and ragdolls.
   * Returns the tilt so the caller can position the root correctly.
   */
  proneTilt(target: number, dt: number): void {
    this.body.rotation.x = damp(this.body.rotation.x, target, 13, dt);
    const prone = Math.abs(target) > 0.1;
    this.body.position.y = damp(this.body.position.y, prone ? -0.18 : 0, 12, dt);
  }

  dispose(): void {
    this.parts.length = 0;
  }
}

export const CHARACTER_HEIGHT = CHAR.height;
