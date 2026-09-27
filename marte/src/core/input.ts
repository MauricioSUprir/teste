// Entrada unificada: teclado/mouse (pointer lock) e toque (joystick flutuante + arrastar para olhar).
export type Action = 'jump' | 'interact' | 'camera' | 'light' | 'build' | 'map' | 'inventory' | 'pause' | 'sprint' | 'crouch' | 'vehicle';

export class Input {
  move = { x: 0, y: 0 }; // x = direita, y = frente
  look = { x: 0, y: 0 }; // delta acumulado em pixels (consumido a cada quadro)
  sprint = false;
  private keys = new Set<string>();
  private pressed = new Set<Action>();
  private held = new Set<Action>();
  locked = false;
  touchMode = false;
  sensitivity = 1;
  invertY = false;
  private skipNextMouse = false;
  enabled = true;
  // toque
  private joyId: number | null = null;
  private joyOrigin = { x: 0, y: 0 };
  private joyVec = { x: 0, y: 0 };
  private lookId: number | null = null;
  private lookLast = { x: 0, y: 0 };
  joyEl: HTMLElement | null = null;
  joyKnob: HTMLElement | null = null;

  constructor(private canvas: HTMLElement) {
    addEventListener('keydown', (e) => this.onKey(e, true));
    addEventListener('keyup', (e) => this.onKey(e, false));
    addEventListener('blur', () => { this.keys.clear(); this.held.clear(); this.move.x = this.move.y = 0; });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      this.skipNextMouse = true;
    });
    addEventListener('mousemove', (e) => {
      if (!this.locked || !this.enabled) return;
      if (this.skipNextMouse) { this.skipNextMouse = false; return; }
      // descarta picos espúrios de alguns navegadores
      if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
      this.look.x += e.movementX * this.sensitivity;
      this.look.y += e.movementY * this.sensitivity * (this.invertY ? -1 : 1);
    });
    addEventListener('mousedown', (e) => {
      if (!this.locked || !this.enabled) return;
      if (e.button === 0) { this.fire('interact'); this.held.add('interact'); }
    });
    addEventListener('mouseup', (e) => { if (e.button === 0 && !this.keys.has('KeyE')) this.held.delete('interact'); });
    canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    addEventListener('pointermove', (e) => this.onPointerMove(e));
    addEventListener('pointerup', (e) => this.onPointerUp(e));
    addEventListener('pointercancel', (e) => this.onPointerUp(e));
  }

  requestLock() {
    if (this.touchMode) return;
    try {
      const p = (this.canvas as HTMLCanvasElement).requestPointerLock?.() as unknown as Promise<void> | undefined;
      p?.catch?.(() => {});
    } catch { /* ignore */ }
  }

  private static KEYMAP: Record<string, Action> = {
    Space: 'jump', KeyE: 'interact', KeyV: 'camera', KeyL: 'light', KeyB: 'build', KeyM: 'map', Tab: 'inventory', KeyI: 'inventory', Escape: 'pause', KeyF: 'vehicle', KeyC: 'crouch', KeyP: 'pause',
  };

  private onKey(e: KeyboardEvent, down: boolean) {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    if (e.code === 'Tab') e.preventDefault();
    if (down) this.keys.add(e.code); else this.keys.delete(e.code);
    const a = Input.KEYMAP[e.code];
    if (a) {
      if (down && !e.repeat) this.fire(a);
      if (down) this.held.add(a); else this.held.delete(a);
    }
    this.touchMode = false;
    this.updateKeyMove();
  }

  private updateKeyMove() {
    const k = this.keys;
    const x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const l = Math.hypot(x, y) || 1;
    this.move.x = x / l; this.move.y = y / l;
    this.sprint = k.has('ShiftLeft') || k.has('ShiftRight');
  }

  fire(a: Action) { if (this.enabled || a === 'pause') this.pressed.add(a); }
  consume(a: Action) { const had = this.pressed.has(a); this.pressed.delete(a); return had; }
  isHeld(a: Action) { return this.held.has(a); }
  setHeld(a: Action, on: boolean) { if (on) this.held.add(a); else this.held.delete(a); }
  takeLook() { const l = { ...this.look }; this.look.x = this.look.y = 0; return l; }
  clearPressed() { this.pressed.clear(); }

  // ---------- toque
  private onPointerDown(e: PointerEvent) {
    if (e.pointerType === 'mouse') { this.touchMode = false; return; }
    this.touchMode = true;
    if (!this.enabled) return;
    const w = innerWidth;
    if (e.clientX < w * 0.45 && e.clientY > innerHeight * 0.3 && this.joyId === null) {
      this.joyId = e.pointerId;
      this.joyVec = { x: 0, y: 0 };
      // joystick fixo: se o toque for perto da base, usa a base; senão a base vai até o dedo
      const home = this.joyHome();
      if (home && Math.hypot(e.clientX - home.x, e.clientY - home.y) < 110) this.joyOrigin = home;
      else {
        this.joyOrigin = { x: e.clientX, y: e.clientY };
        if (this.joyEl) { this.joyEl.style.left = `${e.clientX}px`; this.joyEl.style.top = `${e.clientY}px`; }
      }
      this.joyEl?.classList.add('on');
      this.onPointerMove(e);
    } else if (this.lookId === null) {
      this.lookId = e.pointerId;
      this.lookLast = { x: e.clientX, y: e.clientY };
    }
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }
  /** centro da base do joystick na posição de repouso */
  private joyHome() {
    if (!this.joyEl) return null;
    const r = this.joyEl.getBoundingClientRect();
    if (!r.width) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  private onPointerMove(e: PointerEvent) {
    if (e.pointerId === this.joyId) {
      const R = 60;
      let dx = e.clientX - this.joyOrigin.x, dy = e.clientY - this.joyOrigin.y;
      const l = Math.hypot(dx, dy);
      if (l > R) { dx *= R / l; dy *= R / l; }
      let nx = dx / R, ny = -dy / R;
      const m = Math.hypot(nx, ny);
      if (m < 0.12) { nx = 0; ny = 0; }
      this.move.x = nx; this.move.y = ny;
      this.sprint = m > 0.92;
      if (this.joyKnob) this.joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.joyEl?.classList.toggle('run', this.sprint);
    } else if (e.pointerId === this.lookId) {
      const dx = e.clientX - this.lookLast.x, dy = e.clientY - this.lookLast.y;
      this.lookLast = { x: e.clientX, y: e.clientY };
      this.look.x += dx * 1.6 * this.sensitivity;
      this.look.y += dy * 1.6 * this.sensitivity * (this.invertY ? -1 : 1);
    }
  }
  private onPointerUp(e: PointerEvent) {
    if (e.pointerId === this.joyId) {
      this.joyId = null; this.move.x = this.move.y = 0; this.sprint = false;
      if (this.joyEl) { this.joyEl.classList.remove('on', 'run'); this.joyEl.style.left = ''; this.joyEl.style.top = ''; }
      if (this.joyKnob) this.joyKnob.style.transform = '';
    }
    if (e.pointerId === this.lookId) this.lookId = null;
  }
}
