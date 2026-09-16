/**
 * Third-person camera.
 *
 * A party game lives or dies by whether you can see what is about to hit you,
 * so this camera is deliberately calm: it follows with spring smoothing, never
 * clips through geometry, widens slightly with speed for a sense of rush, and
 * leans back when you fall so the ground stays in frame.
 */
import * as THREE from 'three';
import { clamp, damp, dampAngle, lerp, angleDelta, smoothstep } from '../shared/math';
import { CollisionWorld, Collider } from '../shared/collision';
import { CHAR } from '../shared/config';

export interface CameraSettings {
  sensitivity: number;
  invertY: boolean;
  shakeAmount: number;
  fov: number;
  distance: number;
  smoothing: number;
}

export const DEFAULT_CAMERA_SETTINGS: CameraSettings = {
  sensitivity: 1,
  invertY: false,
  shakeAmount: 1,
  fov: 62,
  distance: 7.1,
  smoothing: 1,
};

const _target = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _scratch: Collider[] = [];

export class CameraController {
  yaw = 0;
  pitch = 0.3;
  settings: CameraSettings = { ...DEFAULT_CAMERA_SETTINGS };

  private curYaw = 0;
  private curPitch = 0.3;
  private focus = new THREE.Vector3();
  private curDist = 6.4;
  private fov = 62;
  private introT = 0;
  private introPath: THREE.Vector3[] = [];
  private mode: 'follow' | 'intro' | 'orbit' = 'follow';
  private orbitAngle = 0;
  /** Seconds left of the swoop from a cinematic pose into gameplay follow. */
  private blend = 0;
  private blendDuration = 0.75;
  private blendFrom = new THREE.Vector3();

  constructor(private camera: THREE.PerspectiveCamera) {
    this.camera.fov = this.settings.fov;
    this.camera.updateProjectionMatrix();
  }

  /** Mouse/touch look input, already scaled to radians by the input layer. */
  look(dx: number, dy: number): void {
    const s = this.settings.sensitivity;
    this.yaw -= dx * s;
    this.pitch += (this.settings.invertY ? -dy : dy) * s;
    this.pitch = clamp(this.pitch, -0.62, 1.15);
  }

  snapTo(yaw: number): void {
    this.yaw = yaw;
    this.curYaw = yaw;
  }

  /** Cinematic flyover before a round. */
  startIntro(points: [number, number, number][], duration: number): void {
    this.introPath = points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    this.introT = 0;
    this.mode = 'intro';
    this.introDuration = duration;
  }
  private introDuration = 5;

  /**
   * Ends the flyover by *blending* into the gameplay pose rather than cutting.
   * A hard cut from a camera 25 m up to one 7 m behind the player is a visual
   * bug even though every number involved is correct.
   */
  endIntro(): void {
    if (this.mode !== 'intro') return;
    this.mode = 'follow';
    this.blendFrom.copy(this.camera.position);
    this.blend = this.blendDuration;
  }
  isIntro(): boolean { return this.mode === 'intro'; }

  /** Slow orbit used by the menu and the winner podium. */
  setOrbit(center: THREE.Vector3, radius: number, height: number): void {
    this.mode = 'orbit';
    this.focus.copy(center);
    this.orbitRadius = radius;
    this.orbitHeight = height;
  }
  private orbitRadius = 5;
  private orbitHeight = 2;

  setFollow(): void { this.mode = 'follow'; }

  update(dt: number, px: number, py: number, pz: number, speed: number, vy: number,
         world: CollisionWorld | null): void {
    if (this.mode === 'intro') { this.updateIntro(dt); return; }
    if (this.mode === 'orbit') { this.updateOrbit(dt); return; }

    const sm = this.settings.smoothing;
    this.curYaw = dampAngle(this.curYaw, this.yaw, 16 * sm, dt);
    this.curPitch = damp(this.curPitch, this.pitch, 14 * sm, dt);

    // Focus a little above the head, and drift the focus forward with speed so
    // the player sees where they are going rather than where they have been.
    _target.set(px, py + CHAR.height * 0.72, pz);
    const lead = clamp(speed / 7.3, 0, 1) * 0.9;
    _target.x += Math.sin(this.curYaw) * lead;
    _target.z += Math.cos(this.curYaw) * lead;
    // Falling: ease the focus down so the ground rushing up stays visible.
    if (vy < -6) _target.y += clamp(vy * 0.045, -1.1, 0);

    this.focus.x = damp(this.focus.x, _target.x, 13 * sm, dt);
    this.focus.y = damp(this.focus.y, _target.y, 9 * sm, dt);
    this.focus.z = damp(this.focus.z, _target.z, 13 * sm, dt);

    // Desired camera position: BEHIND the player, opposite the direction they
    // run. Input maps W to +Z when camYaw is 0, so the boom must sit at -Z -
    // getting this sign wrong puts the camera in front and you sprint straight
    // into the lens.
    const wanted = this.settings.distance;
    const cp = Math.cos(this.curPitch);
    const dirX = -Math.sin(this.curYaw) * cp;
    const dirY = Math.sin(this.curPitch);
    const dirZ = -Math.cos(this.curYaw) * cp;

    let dist = wanted;
    if (world) dist = this.collide(world, this.focus, dirX, dirY, dirZ, wanted);
    // Pull in fast, push out slow: never let geometry clip, but do not pop.
    this.curDist = dist < this.curDist
      ? dist
      : damp(this.curDist, dist, 6, dt);

    _desired.set(
      this.focus.x + dirX * this.curDist,
      this.focus.y + dirY * this.curDist + 0.35,
      this.focus.z + dirZ * this.curDist,
    );
    if (this.blend > 0) {
      this.blend = Math.max(0, this.blend - dt);
      const k = smoothstep(1 - this.blend / this.blendDuration);
      this.camera.position.lerpVectors(this.blendFrom, _desired, k);
    } else {
      this.camera.position.copy(_desired);
    }
    this.camera.lookAt(this.focus);

    // Speed FOV: subtle, and it snaps back faster than it opens.
    const targetFov = this.settings.fov + clamp(speed / 7.3, 0, 1.4) * 7.5;
    const rate = targetFov > this.fov ? 3.5 : 6;
    this.fov = damp(this.fov, targetFov, rate, dt);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  /** Shortens the boom until the camera is clear of walls. */
  private collide(world: CollisionWorld, focus: THREE.Vector3,
                  dx: number, dy: number, dz: number, wanted: number): number {
    const hit = world.raycast(focus.x, focus.y, focus.z, dx, dy, dz, wanted + 0.4, _scratch);
    if (hit < 0) return wanted;
    return Math.max(1.3, hit - 0.42);
  }

  private updateIntro(dt: number): void {
    this.introT += dt / Math.max(0.5, this.introDuration);
    const t = clamp(this.introT, 0, 1);
    const pts = this.introPath;
    if (pts.length < 2) { this.mode = 'follow'; return; }
    const st = smoothstep(t) * (pts.length - 1);
    const i = Math.min(pts.length - 2, Math.floor(st));
    const f = st - i;
    const a = pts[i], b = pts[i + 1];
    this.camera.position.set(lerp(a.x, b.x, f), lerp(a.y, b.y, f), lerp(a.z, b.z, f));
    // Aim a little further along the path than we are, so the shot leads the
    // course instead of swinging when a waypoint is reached.
    const ahead = pts[Math.min(pts.length - 1, i + 1)];
    const ahead2 = pts[Math.min(pts.length - 1, i + 2)];
    this.camera.lookAt(
      lerp(ahead.x, ahead2.x, 0.5),
      lerp(ahead.y, ahead2.y, 0.5) - 3.5,
      lerp(ahead.z, ahead2.z, 0.5),
    );
    if (t >= 1) this.endIntro();
  }

  private updateOrbit(dt: number): void {
    this.orbitAngle += dt * 0.28;
    this.camera.position.set(
      this.focus.x + Math.sin(this.orbitAngle) * this.orbitRadius,
      this.focus.y + this.orbitHeight,
      this.focus.z + Math.cos(this.orbitAngle) * this.orbitRadius,
    );
    this.camera.lookAt(this.focus);
  }

  /** Yaw used to resolve movement input. */
  getYaw(): number { return this.curYaw; }

  /** Instantly places the camera behind the player (round starts, respawns). */
  snapBehind(px: number, py: number, pz: number): void {
    this.curYaw = this.yaw;
    this.curPitch = this.pitch;
    this.focus.set(px, py + CHAR.height * 0.72, pz);
    this.curDist = this.settings.distance;
    const cp = Math.cos(this.curPitch);
    this.camera.position.set(
      this.focus.x - Math.sin(this.curYaw) * cp * this.curDist,
      this.focus.y + Math.sin(this.curPitch) * this.curDist + 0.35,
      this.focus.z - Math.cos(this.curYaw) * cp * this.curDist,
    );
    this.camera.lookAt(this.focus);
  }
}

export { angleDelta };
