/**
 * Teclado, mouse e toque.
 *
 *  - teclado: WASD/setas, Shift para correr, E para a ação do lugar;
 *  - arrastar a tela (mouse ou um dedo fora do joystick): gira a câmera;
 *  - clique/toque sem arrastar: "apertou" naquele ponto (ir até lá, produto);
 *  - roda do mouse ou pinça com dois dedos: aproxima e afasta;
 *  - joystick na tela do celular (criado por ui.ts) escreve em `joystick`.
 */

export interface Apertou {
  x: number;
  y: number;
  toque: boolean;
}

export class Entrada {
  readonly teclas = new Set<string>();
  /** giro acumulado desde o último quadro (pixels) */
  giroX = 0;
  giroY = 0;
  zoom = 0;
  /** posição do mouse sobre a tela (null = fora / toque) */
  mouse: { x: number; y: number } | null = null;
  mouseMexeu = false;
  joystick = { x: 0, y: 0 };
  /** botão "Correr" do celular ligado */
  correndo = false;
  aoApertar: ((a: Apertou) => void) | null = null;
  aoAcao: (() => void) | null = null;
  aoTecla: ((tecla: string) => void) | null = null;
  ativo = true;
  private dedos = new Map<number, { x: number; y: number; x0: number; y0: number; t0: number; arrastou: boolean }>();
  private pinca = 0;

  constructor(alvo: HTMLElement) {
    const digitando = (e: Event) => {
      const el = e.target as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
    };
    addEventListener("keydown", (e) => {
      if (digitando(e) || !this.ativo) return;
      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
      this.teclas.add(k);
      if (k === "e" && !e.repeat) this.aoAcao?.();
      if (!e.repeat) this.aoTecla?.(k);
    });
    addEventListener("keyup", (e) => this.teclas.delete(e.key.toLowerCase()));
    addEventListener("blur", () => this.teclas.clear());

    alvo.addEventListener("pointerdown", (e) => {
      if (!this.ativo) return;
      alvo.setPointerCapture(e.pointerId);
      this.dedos.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: e.timeStamp, arrastou: false });
      if (this.dedos.size === 2) this.pinca = this.distanciaDedos();
    });
    alvo.addEventListener("pointermove", (e) => {
      if (e.pointerType === "mouse") {
        this.mouse = { x: e.clientX, y: e.clientY };
        this.mouseMexeu = true;
      }
      const d = this.dedos.get(e.pointerId);
      if (!d) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      d.x = e.clientX;
      d.y = e.clientY;
      if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 7) d.arrastou = true;
      if (this.dedos.size === 2) {
        const dist = this.distanciaDedos();
        if (this.pinca) this.zoom += (this.pinca - dist) * 0.012;
        this.pinca = dist;
        return;
      }
      if (d.arrastou) {
        this.giroX += dx;
        this.giroY += dy;
      }
    });
    const soltar = (e: PointerEvent) => {
      const d = this.dedos.get(e.pointerId);
      this.dedos.delete(e.pointerId);
      if (this.dedos.size < 2) this.pinca = 0;
      if (!d || !this.ativo) return;
      // hora do próprio evento: quadro lento no meio não transforma clique em "segurar"
      if (!d.arrastou && e.timeStamp - d.t0 < 700 && e.type === "pointerup") this.aoApertar?.({ x: e.clientX, y: e.clientY, toque: e.pointerType !== "mouse" });
    };
    alvo.addEventListener("pointerup", soltar);
    alvo.addEventListener("pointercancel", soltar);
    alvo.addEventListener("pointerleave", (e) => {
      if (e.pointerType === "mouse") this.mouse = null;
    });
    alvo.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.zoom += Math.sign(e.deltaY) * 0.6;
      },
      { passive: false }
    );
    alvo.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  private distanciaDedos() {
    const [a, b] = [...this.dedos.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  /** direção pedida pelo teclado/joystick: x = lado (direita +), y = frente (+) */
  direcao(): { x: number; y: number; rapido: boolean } {
    let x = this.joystick.x;
    let y = this.joystick.y;
    const t = this.teclas;
    if (t.has("w") || t.has("arrowup")) y += 1;
    if (t.has("s") || t.has("arrowdown")) y -= 1;
    if (t.has("d") || t.has("arrowright")) x += 1;
    if (t.has("a") || t.has("arrowleft")) x -= 1;
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    return { x, y, rapido: t.has("shift") || this.correndo || Math.hypot(this.joystick.x, this.joystick.y) > 0.92 };
  }

  consumirGiro() {
    const g = { x: this.giroX, y: this.giroY, zoom: this.zoom };
    this.giroX = this.giroY = this.zoom = 0;
    return g;
  }
}
