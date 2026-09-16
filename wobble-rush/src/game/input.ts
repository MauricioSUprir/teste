/**
 * Input: keyboard + mouse, touch, and gamepad.
 *
 * Everything funnels into one small intent struct, so the rest of the game
 * never knows or cares which device produced it. Bindings are remappable and
 * the touch layer is built for thumbs, not for mouse users holding a phone.
 */
import { Btn } from '../shared/types';


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

/**
 * Radius of the virtual stick, in CSS pixels.
 * Derived from the short axis but floored: on a landscape phone the viewport is
 * barely 300 px tall, and a radius scaled purely off that makes the stick so
 * twitchy that small thumb movements peg the input.
 */
export function touchStickRadius(): number {
  const short = Math.min(window.innerWidth, window.innerHeight);
  return Math.max(52, Math.min(short * 0.22, 96));
}

/**
 * Resting place of the stick: bottom-left, clear of the safe area, and far
 * enough in that the base is fully on screen.
 */
/** Sentinel id for a mouse-driven stick, kept out of real touch ids. */
const MOUSE_STICK_ID = -777;

export function touchStickAnchor(): { x: number; y: number } {
  const r = touchStickRadius();
  return { x: r + 26, y: window.innerHeight - r - 22 };
}

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
  private pointerLockBlocked = false;
  private mouseDown = false;
  private stickId = -1;
  private forceOnScreen = false;
  private nativeTouch = false;
  private mouseStick = false;
  private stickOrigin = { x: 0, y: 0 };
  private stickPos = { x: 0, y: 0 };
  private lookId = -1;
  private lastLook = { x: 0, y: 0 };
  private touchButtons = new Set<string>();
  private canvas: HTMLCanvasElement;
  private onBlurBound = () => this.keys.clear();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.nativeTouch = matchMedia('(hover: none)').matches || 'ontouchstart' in window;
    this.touchEnabled = this.nativeTouch;
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

    this.canvas.addEventListener('mousedown', (e) => {
      this.mouseDown = true;
      if (this.forceOnScreen && this.inStickZone(e.clientX, e.clientY)) {
        this.mouseStick = true;
        this.stickId = MOUSE_STICK_ID;
        this.stickOrigin = { x: e.clientX, y: e.clientY };
        this.stickPos = { x: e.clientX, y: e.clientY };
        return;
      }
      // Pointer lock is the good experience, but it is unavailable in some
      // embedded contexts. Falling back to drag-to-look keeps the camera
      // usable instead of dead.
      if (!this.touchEnabled && !this.pointerLocked) {
        const req = this.canvas.requestPointerLock();
        if (req && typeof (req as Promise<void>).catch === 'function') {
          (req as unknown as Promise<void>).catch(() => { this.pointerLockBlocked = true; });
        }
      }
    });
    window.addEventListener('mouseup', () => {
      this.mouseDown = false;
      if (this.mouseStick) { this.mouseStick = false; this.stickId = -1; }
    });
    document.addEventListener('pointerlockerror', () => { this.pointerLockBlocked = true; });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
      if (this.pointerLocked) this.pointerLockBlocked = false;
    });
    window.addEventListener('mousemove', (e) => {
      if (this.suspended) return;
      if (this.mouseStick) { this.stickPos = { x: e.clientX, y: e.clientY }; return; }
      const dragging = this.mouseDown && !this.pointerLocked;
      if (!this.pointerLocked && !dragging) return;
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

  /**
   * Forces the on-screen controls on a device that has a mouse.
   * The stick then also accepts mouse drags, but only ones that start inside
   * its own zone - everywhere else keeps driving the camera.
   */
  setOnScreenControls(on: boolean): void {
    this.forceOnScreen = on;
    this.touchEnabled = on || this.nativeTouch;
  }

  /** True when a pointer is inside the stick's grab zone. */
  private inStickZone(x: number, y: number): boolean {
    const a = touchStickAnchor();
    const r = touchStickRadius() * 1.9;
    return Math.hypot(x - a.x, y - a.y) <= r;
  }

  /** On-screen buttons call these. */
  setTouchButton(name: string, down: boolean): void {
    if (down) this.touchButtons.add(name); else this.touchButtons.delete(name);
  }

  /**
   * Where to draw the virtual stick.
   * `active` is false when nobody is touching it - the caller still draws it,
   * parked at its resting anchor, so the control is visible before first use.
   */
  getStick(): { ox: number; oy: number; x: number; y: number; active: boolean } {
    if (this.stickId === -1) {
      const a = touchStickAnchor();
      return { ox: a.x, oy: a.y, x: a.x, y: a.y, active: false };
    }
    return {
      ox: this.stickOrigin.x, oy: this.stickOrigin.y,
      x: this.stickPos.x, y: this.stickPos.y, active: true,
    };
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
      let nx = (this.stickPos.x - this.stickOrigin.x) / touchStickRadius();
      let ny = (this.stickPos.y - this.stickOrigin.y) / touchStickRadius();
      // Clamp the magnitude, not each axis: a square clamp lets a diagonal push
      // reach 1.41 while a straight one reaches 1, so diagonals feel faster and
      // fine analog control disappears.
      const len = Math.hypot(nx, ny);
      if (len > 1) { nx /= len; ny /= len; }
      // A small dead zone stops a resting thumb from drifting the character.
      if (len < 0.14) { nx = 0; ny = 0; }
      i.moveX = nx;
      i.moveZ = ny;
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

  /** True when the camera must be dragged rather than locked. */
  get needsDragToLook(): boolean { return this.pointerLockBlocked && !this.touchEnabled; }

  rebind(action: ActionName, code: string): void {
    this.bindings[action] = [code];
  }

  resetBindings(): void {
    this.bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
  }
}
