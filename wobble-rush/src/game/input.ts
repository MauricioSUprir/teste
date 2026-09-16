/**
 * Input: keyboard + mouse, touch, and gamepad.
 *
 * Everything funnels into one small intent struct, so the rest of the game
 * never knows or cares which device produced it. Bindings are remappable and
 * the touch layer is built for thumbs, not for mouse users holding a phone.
 */
import { Btn } from '../shared/types';
import { clamp } from '../shared/math';

export interface InputIntent {
  moveX: number;
  moveZ: number;
  buttons: number;
  lookX: number;
  lookY: number;
}

export type ActionName = 'forward' | 'back' | 'left' | 'right' | 'jump' | 'dive' | 'ability1' | 'ability2' | 'emote';

export const DEFAULT_BINDINGS: Record<ActionName, string[]> = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  dive: ['ShiftLeft', 'ControlLeft', 'KeyE'],
  ability1: ['KeyQ'],
  ability2: ['KeyF'],
  emote: ['KeyT'],
};

export class InputManager {
  readonly intent: InputIntent = { moveX: 0, moveZ: 0, buttons: 0, lookX: 0, lookY: 0 };
  bindings: Record<ActionName, string[]> = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
  touchEnabled = false;
  mouseSensitivity = 0.0022;
  touchSensitivity = 0.0052;
  /** Set while the player is typing in a menu. */
  suspended = false;

  private keys = new Set<string>();
  private pointerLocked = false;
  private stickId = -1;
  private stickOrigin = { x: 0, y: 0 };
  private stickPos = { x: 0, y: 0 };
  private lookId = -1;
  private lastLook = { x: 0, y: 0 };
  private touchButtons = new Set<string>();
  private canvas: HTMLCanvasElement;
  private onBlurBound = () => this.keys.clear();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.touchEnabled = matchMedia('(hover: none)').matches || 'ontouchstart' in window;
    this.attach();
  }

  private attach(): void {
    window.addEventListener('keydown', (e) => {
      if (this.suspended) return;
      this.keys.add(e.code);
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', this.onBlurBound);

    this.canvas.addEventListener('mousedown', () => {
      if (!this.touchEnabled && !this.pointerLocked) this.canvas.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked || this.suspended) return;
      this.intent.lookX += e.movementX * this.mouseSensitivity;
      this.intent.lookY += e.movementY * this.mouseSensitivity;
    });

    // Touch: left half drives a floating stick, right half drives the camera.
    const opts = { passive: false } as AddEventListenerOptions;
    this.canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), opts);
    this.canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), opts);
    this.canvas.addEventListener('touchend', (e) => this.onTouchEnd(e), opts);
    this.canvas.addEventListener('touchcancel', (e) => this.onTouchEnd(e), opts);
  }

  private onTouchStart(e: TouchEvent): void {
    if (this.suspended) return;
    for (const t of Array.from(e.changedTouches)) {
      if (t.clientX < window.innerWidth * 0.5) {
        if (this.stickId === -1) {
          this.stickId = t.identifier;
          this.stickOrigin = { x: t.clientX, y: t.clientY };
          this.stickPos = { x: t.clientX, y: t.clientY };
        }
      } else if (this.lookId === -1) {
        this.lookId = t.identifier;
        this.lastLook = { x: t.clientX, y: t.clientY };
      }
    }
    e.preventDefault();
  }

  private onTouchMove(e: TouchEvent): void {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === this.stickId) {
        this.stickPos = { x: t.clientX, y: t.clientY };
      } else if (t.identifier === this.lookId) {
        this.intent.lookX += (t.clientX - this.lastLook.x) * this.touchSensitivity;
        this.intent.lookY += (t.clientY - this.lastLook.y) * this.touchSensitivity;
        this.lastLook = { x: t.clientX, y: t.clientY };
      }
    }
    e.preventDefault();
  }

  private onTouchEnd(e: TouchEvent): void {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === this.stickId) { this.stickId = -1; this.stickPos = this.stickOrigin; }
      if (t.identifier === this.lookId) this.lookId = -1;
    }
    e.preventDefault();
  }

  /** On-screen buttons call these. */
  setTouchButton(name: string, down: boolean): void {
    if (down) this.touchButtons.add(name); else this.touchButtons.delete(name);
  }

  /** Where to draw the virtual stick, or null when it is not in use. */
  getStick(): { ox: number; oy: number; x: number; y: number } | null {
    if (this.stickId === -1) return null;
    return { ox: this.stickOrigin.x, oy: this.stickOrigin.y, x: this.stickPos.x, y: this.stickPos.y };
  }

  private held(action: ActionName): boolean {
    if (this.touchButtons.has(action)) return true;
    for (const code of this.bindings[action]) if (this.keys.has(code)) return true;
    return false;
  }

  /** Collects this frame's intent. Look deltas are consumed by the caller. */
  poll(): InputIntent {
    const i = this.intent;
    i.moveX = 0; i.moveZ = 0; i.buttons = 0;
    if (this.suspended) return i;

    if (this.held('forward')) i.moveZ -= 1;
    if (this.held('back')) i.moveZ += 1;
    if (this.held('left')) i.moveX -= 1;
    if (this.held('right')) i.moveX += 1;

    // Virtual stick overrides keys when it is active.
    if (this.stickId !== -1) {
      const dx = this.stickPos.x - this.stickOrigin.x;
      const dy = this.stickPos.y - this.stickOrigin.y;
      const radius = Math.min(window.innerWidth, window.innerHeight) * 0.11;
      i.moveX = clamp(dx / radius, -1, 1);
      i.moveZ = clamp(dy / radius, -1, 1);
    }

    const gp = this.pollGamepad();
    if (gp) { i.moveX = gp.x; i.moveZ = gp.y; i.buttons |= gp.buttons; }

    if (this.held('jump')) i.buttons |= Btn.Jump;
    if (this.held('dive')) i.buttons |= Btn.Dive;
    if (this.held('ability1')) i.buttons |= Btn.Ability1;
    if (this.held('ability2')) i.buttons |= Btn.Ability2;
    if (this.held('emote')) i.buttons |= Btn.Emote;
    return i;
  }

  private pollGamepad(): { x: number; y: number; buttons: number } | null {
    const pads = navigator.getGamepads?.() ?? [];
    for (const p of pads) {
      if (!p) continue;
      const dead = 0.22;
      const ax = Math.abs(p.axes[0]) > dead ? p.axes[0] : 0;
      const ay = Math.abs(p.axes[1]) > dead ? p.axes[1] : 0;
      const rx = Math.abs(p.axes[2]) > dead ? p.axes[2] : 0;
      const ry = Math.abs(p.axes[3]) > dead ? p.axes[3] : 0;
      this.intent.lookX += rx * 0.045;
      this.intent.lookY += ry * 0.035;
      let buttons = 0;
      if (p.buttons[0]?.pressed) buttons |= Btn.Jump;
      if (p.buttons[1]?.pressed || p.buttons[2]?.pressed) buttons |= Btn.Dive;
      if (p.buttons[4]?.pressed) buttons |= Btn.Ability1;
      if (p.buttons[5]?.pressed) buttons |= Btn.Ability2;
      if (p.buttons[3]?.pressed) buttons |= Btn.Emote;
      if (ax || ay || buttons) return { x: ax, y: ay, buttons };
    }
    return null;
  }

  /** Reads and clears accumulated look delta. */
  consumeLook(): { x: number; y: number } {
    const out = { x: this.intent.lookX, y: this.intent.lookY };
    this.intent.lookX = 0;
    this.intent.lookY = 0;
    return out;
  }

  rebind(action: ActionName, code: string): void {
    this.bindings[action] = [code];
  }

  resetBindings(): void {
    this.bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
  }
}
