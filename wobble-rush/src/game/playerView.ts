/**
 * Visual representation of a simulated player.
 *
 * The simulation runs at a fixed 60 Hz; the screen does not. This keeps the
 * previous and current sim states and interpolates between them, which is what
 * makes movement look smooth at 144 Hz and still correct at 30.
 */
import { Wobbler, WobblerLook } from '../render/character';
import { PlayerSim, MoveState } from '../shared/types';
import { lerp, angleLerp, clamp, damp } from '../shared/math';
import { CHAR } from '../shared/config';

export class PlayerView {
  readonly wobbler: Wobbler;
  readonly id: number;
  name: string;
  isLocal = false;

  private prevX = 0; private prevY = 0; private prevZ = 0; private prevYaw = 0;
  private curX = 0; private curY = 0; private curZ = 0; private curYaw = 0;
  private renderX = 0; private renderY = 0; private renderZ = 0;
  private state: MoveState = MoveState.Idle;
  private stateTime = 0;
  private speed = 0;
  private vy = 0;
  private grounded = false;
  private invuln = 0;
  private footPhase = 0;
  /** Set by the client when this player should emit footstep effects. */
  onFootstep?: (x: number, y: number, z: number, surface: number) => void;
  private surface = 0;

  constructor(player: PlayerSim, look: WobblerLook) {
    this.id = player.id;
    this.name = player.name;
    this.wobbler = new Wobbler(look);
    this.prevX = this.curX = this.renderX = player.pos.x;
    this.prevY = this.curY = this.renderY = player.pos.y;
    this.prevZ = this.curZ = this.renderZ = player.pos.z;
    this.prevYaw = this.curYaw = player.yaw;
  }

  /** Called once per simulation tick. */
  pushState(p: PlayerSim): void {
    this.prevX = this.curX; this.prevY = this.curY; this.prevZ = this.curZ;
    this.prevYaw = this.curYaw;
    this.curX = p.pos.x; this.curY = p.pos.y; this.curZ = p.pos.z;
    this.curYaw = p.yaw;
    this.state = p.state;
    this.stateTime = p.stateTime;
    this.speed = Math.hypot(p.vel.x, p.vel.z);
    this.vy = p.vel.y;
    this.grounded = p.grounded;
    this.invuln = p.invuln;
    this.surface = p.groundSurface;
  }

  /** Called once per rendered frame. `alpha` is progress into the next tick. */
  render(dt: number, alpha: number): void {
    this.renderX = lerp(this.prevX, this.curX, alpha);
    this.renderY = lerp(this.prevY, this.curY, alpha);
    this.renderZ = lerp(this.prevZ, this.curZ, alpha);
    const yaw = angleLerp(this.prevYaw, this.curYaw, alpha);

    const w = this.wobbler;
    w.root.position.set(this.renderX, this.renderY, this.renderZ);

    // Dives and ragdolls lay the body down; everything else stands up.
    const prone = this.state === MoveState.Dive || this.state === MoveState.DiveSlide;
    const ragdoll = this.state === MoveState.Ragdoll;
    const tilt = prone ? -1.35 : ragdoll ? -1.5 : 0;
    w.proneTilt(tilt, dt);

    w.update(dt, this.state, this.speed, this.vy, this.grounded, yaw, this.stateTime);

    // Invulnerability flicker after a respawn, so players understand the state.
    if (this.invuln > 0) {
      const f = Math.sin(this.invuln * 26) > -0.2;
      w.root.visible = f;
    } else if (!w.root.visible) {
      w.root.visible = true;
    }

    // Footsteps are driven by the visual stride, so sound matches the feet.
    if (this.grounded && this.speed > 1.2 &&
        (this.state === MoveState.Run || this.state === MoveState.Idle)) {
      this.footPhase += dt * (4.6 + clamp(this.speed / 7.3, 0, 1.3) * 7.2);
      if (this.footPhase > Math.PI) {
        this.footPhase -= Math.PI;
        this.onFootstep?.(this.renderX, this.renderY, this.renderZ, this.surface);
      }
    } else {
      this.footPhase = 0;
    }
  }

  get position(): { x: number; y: number; z: number } {
    return { x: this.renderX, y: this.renderY, z: this.renderZ };
  }

  get headPosition(): { x: number; y: number; z: number } {
    return { x: this.renderX, y: this.renderY + CHAR.height, z: this.renderZ };
  }

  get currentState(): MoveState { return this.state; }
  get currentSpeed(): number { return this.speed; }
  get verticalSpeed(): number { return this.vy; }

  setLook(look: WobblerLook): void { this.wobbler.setLook(look); }

  dispose(): void { this.wobbler.dispose(); }
}

export { damp };
