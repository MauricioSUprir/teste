/** Entrada unificada: teclado, mouse (pointer lock) e gamepad, com remapeamento. */

import { clamp } from './math'
import type { ActionName, KeyBindings } from './settings'

export interface InputFrame {
  moveX: number
  moveY: number
  lookX: number
  lookY: number
  /** Eixo analógico do acelerador (gamepad) ou 0/1 do teclado. */
  throttle: number
  brake: number
}

/** Mapeamento padrão gamepad (layout "standard"). */
const PAD_BUTTON_ACTIONS: Partial<Record<number, ActionName>> = {
  0: 'pular',
  1: 'agachar',
  2: 'interagir',
  3: 'entrarVeiculo',
  4: 'passar',
  5: 'chutar',
  8: 'mapa',
  9: 'pausa',
  10: 'correr',
  12: 'primeiraPessoa',
  13: 'trocarCamera',
}

export class Input {
  readonly frame: InputFrame = { moveX: 0, moveY: 0, lookX: 0, lookY: 0, throttle: 0, brake: 0 }

  private down = new Set<string>()
  private pressedThisFrame = new Set<string>()
  private releasedThisFrame = new Set<string>()
  private padPrev: boolean[] = []
  private padDown = new Set<ActionName>()
  private padPressed = new Set<ActionName>()
  private mouseDelta = { x: 0, y: 0 }
  private wheel = 0
  mouseButtons = new Set<number>()
  private mousePressed = new Set<number>()
  private bindings: KeyBindings
  private enabled = true
  pointerLocked = false
  sensitivity = 1
  invertY = false
  /**
   * Perfil do apontador. O trackpad entrega poucos eventos por segundo, com
   * passadas curtas e degraus grandes: sem ganho extra a câmera fica pesada e
   * sem suavização ela fica aos trancos.
   */
  perfilApontador: 'mouse' | 'trackpad' | 'auto' = 'auto'
  /** 0 = sem suavização (cru), 1 = bem suave. Não perde rotação, só espalha. */
  suavizacaoOlhar = 0.35
  /** Perfil efetivo quando `perfilApontador` é 'auto'. */
  private perfilDetectado: 'mouse' | 'trackpad' = 'mouse'
  private amostrasApontador = 0
  private amostrasCurtas = 0
  /** Resto de rotação ainda não entregue, usado pela suavização. */
  private restoOlhar = { x: 0, y: 0 }
  private ultimoUpdate = 0
  /** Acumulador de rolagem contínua (trackpad manda dezenas de eventos). */
  private rolagemBruta = 0
  /** Quando true, o próximo evento de tecla é capturado para remapeamento. */
  private captureResolve: ((code: string) => void) | null = null
  /**
   * Sobreposição usada pelos testes automatizados: quando definida, substitui
   * o eixo de movimento depois da leitura do teclado e do gamepad.
   */
  override: { moveX: number; moveY: number; sprint: boolean } | null = null

  private readonly onKeyDown: (e: KeyboardEvent) => void
  private readonly onKeyUp: (e: KeyboardEvent) => void
  private readonly onMouseMove: (e: MouseEvent) => void
  private readonly onMouseDown: (e: MouseEvent) => void
  private readonly onMouseUp: (e: MouseEvent) => void
  private readonly onWheel: (e: WheelEvent) => void
  private readonly onPointerLockChange: () => void
  private readonly onBlur: () => void

  constructor(bindings: KeyBindings, private readonly element: HTMLElement) {
    this.bindings = bindings

    this.onKeyDown = (e) => {
      if (this.captureResolve) {
        e.preventDefault()
        const r = this.captureResolve
        this.captureResolve = null
        r(e.code)
        return
      }
      if (!this.enabled) return
      if (e.repeat) return
      // Evita rolagem da página com espaço/setas enquanto joga.
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault()
      this.down.add(e.code)
      this.pressedThisFrame.add(e.code)
    }
    this.onKeyUp = (e) => {
      this.down.delete(e.code)
      this.releasedThisFrame.add(e.code)
    }
    this.onMouseMove = (e) => {
      if (!this.pointerLocked) return
      // O travamento de ponteiro ocasionalmente entrega um salto absurdo em um
      // único evento; sem limite isso vira um giro de 180° sem motivo.
      const dx = Math.max(-180, Math.min(180, e.movementX))
      const dy = Math.max(-180, Math.min(180, e.movementY))
      // Detecção de trackpad: passadas curtas e constantes, sem cauda longa.
      const m = Math.abs(dx) + Math.abs(dy)
      if (m > 0) {
        this.amostrasApontador++
        if (m <= 6) this.amostrasCurtas++
        if (this.amostrasApontador >= 60) {
          this.perfilDetectado = this.amostrasCurtas / this.amostrasApontador > 0.82
            ? 'trackpad' : 'mouse'
          this.amostrasApontador = 0
          this.amostrasCurtas = 0
        }
      }
      this.mouseDelta.x += dx
      this.mouseDelta.y += dy
    }
    this.onMouseDown = (e) => {
      this.mouseButtons.add(e.button)
      this.mousePressed.add(e.button)
    }
    this.onMouseUp = (e) => this.mouseButtons.delete(e.button)
    this.onWheel = (e) => {
      // No trackpad a rolagem chega em dezenas de eventos pequenos; acumulamos
      // e só emitimos um passo a cada limiar, senão o zoom dispara.
      this.rolagemBruta += e.deltaY
      while (Math.abs(this.rolagemBruta) >= 48) {
        const passo = Math.sign(this.rolagemBruta)
        this.wheel += passo
        this.rolagemBruta -= passo * 48
      }
    }
    this.onPointerLockChange = () => {
      this.pointerLocked = document.pointerLockElement === this.element
    }
    this.onBlur = () => {
      this.down.clear()
      this.mouseButtons.clear()
    }

    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('mousemove', this.onMouseMove)
    window.addEventListener('mousedown', this.onMouseDown)
    window.addEventListener('mouseup', this.onMouseUp)
    window.addEventListener('wheel', this.onWheel, { passive: true })
    document.addEventListener('pointerlockchange', this.onPointerLockChange)
    window.addEventListener('blur', this.onBlur)
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('mousemove', this.onMouseMove)
    window.removeEventListener('mousedown', this.onMouseDown)
    window.removeEventListener('mouseup', this.onMouseUp)
    window.removeEventListener('wheel', this.onWheel)
    document.removeEventListener('pointerlockchange', this.onPointerLockChange)
    window.removeEventListener('blur', this.onBlur)
  }

  setBindings(b: KeyBindings): void { this.bindings = b }
  setEnabled(v: boolean): void {
    this.enabled = v
    if (!v) this.down.clear()
  }

  /** Aguarda a próxima tecla pressionada e devolve seu código (remapeamento). */
  captureNextKey(): Promise<string> {
    return new Promise((resolve) => { this.captureResolve = resolve })
  }
  cancelCapture(): void { this.captureResolve = null }

  requestPointerLock(): void {
    if (document.pointerLockElement !== this.element) {
      void this.element.requestPointerLock?.()
    }
  }
  exitPointerLock(): void {
    if (document.pointerLockElement === this.element) document.exitPointerLock()
  }

  isDown(action: ActionName): boolean {
    if (this.override && action === 'correr') return this.override.sprint
    return this.down.has(this.bindings[action]) || this.padDown.has(action)
  }
  /** True se esta tecla física foi pressionada neste quadro (menus). */
  teclaPressionada(code: string): boolean {
    return this.enabled && this.pressedThisFrame.has(code)
  }

  isPressed(action: ActionName): boolean {
    return this.pressedThisFrame.has(this.bindings[action]) || this.padPressed.has(action)
  }
  isReleased(action: ActionName): boolean {
    return this.releasedThisFrame.has(this.bindings[action])
  }
  isKeyDown(code: string): boolean { return this.down.has(code) }
  isKeyPressed(code: string): boolean { return this.pressedThisFrame.has(code) }
  isMousePressed(button: number): boolean { return this.mousePressed.has(button) }
  /** Perfil de apontador realmente em uso neste quadro. */
  get perfilEmUso(): 'mouse' | 'trackpad' {
    return this.perfilApontador === 'auto' ? this.perfilDetectado : this.perfilApontador
  }

  /**
   * Converte o deslocamento bruto do apontador em rotação do quadro.
   *
   * A suavização não descarta rotação: ela guarda o resto e entrega numa taxa
   * exponencial, então o total girado é exatamente o total movido — só deixa
   * de chegar em degraus. É o que torna o trackpad utilizável sem criar
   * aquela sensação de câmera "escorregando" depois que o dedo para.
   */
  private montarOlhar(f: InputFrame): void {
    const agora = performance.now()
    const dt = this.ultimoUpdate === 0
      ? 1 / 60
      : Math.min(0.1, (agora - this.ultimoUpdate) / 1000)
    this.ultimoUpdate = agora

    let dx = this.mouseDelta.x
    let dy = this.mouseDelta.y
    this.mouseDelta.x = 0
    this.mouseDelta.y = 0

    const trackpad = this.perfilEmUso === 'trackpad'
    if (trackpad) {
      // Curva suave: passadas curtas mantêm a precisão, passadas longas viram
      // o personagem depressa sem precisar de várias repetições do gesto.
      const m = Math.hypot(dx, dy)
      if (m > 0.0001) {
        const ganho = 1 + 1.25 * Math.min(1, m / 38)
        dx *= ganho
        dy *= ganho
      }
    }

    this.restoOlhar.x += dx
    this.restoOlhar.y += dy

    const suav = Math.max(0, Math.min(0.95, this.suavizacaoOlhar + (trackpad ? 0.18 : 0)))
    // Meia-vida constante em segundos: independe da taxa de quadros.
    const taxa = suav <= 0.001 ? 1 : 1 - Math.exp(-dt / (0.006 + suav * 0.052))
    const libX = this.restoOlhar.x * taxa
    const libY = this.restoOlhar.y * taxa
    this.restoOlhar.x -= libX
    this.restoOlhar.y -= libY
    // Evita resto residual infinitesimal preso no acumulador.
    if (Math.abs(this.restoOlhar.x) < 0.01) this.restoOlhar.x = 0
    if (Math.abs(this.restoOlhar.y) < 0.01) this.restoOlhar.y = 0

    const base = trackpad ? 0.0030 : 0.0022
    f.lookX = libX * base * this.sensitivity
    f.lookY = libY * base * this.sensitivity * (this.invertY ? -1 : 1)

    // Setas viram a câmera sem apontador, útil em notebook.
    const setas = (this.enabled ? 1 : 0) * 2.1 * dt * this.sensitivity
    if (setas > 0) {
      if (this.down.has('ArrowLeft')) f.lookX -= setas
      if (this.down.has('ArrowRight')) f.lookX += setas
      if (this.down.has('ArrowUp')) f.lookY -= setas * (this.invertY ? -1 : 1)
      if (this.down.has('ArrowDown')) f.lookY += setas * (this.invertY ? -1 : 1)
    }
  }

  takeWheel(): number { const w = this.wheel; this.wheel = 0; return w }

  private pollGamepad(): void {
    this.padPressed.clear()
    this.padDown.clear()
    const pads = navigator.getGamepads?.() ?? []
    const pad = Array.from(pads).find((p) => p && p.connected)
    if (!pad) { this.padPrev.length = 0; return }

    const dz = (v: number) => (Math.abs(v) < 0.18 ? 0 : v)
    this.frame.moveX += dz(pad.axes[0] ?? 0)
    this.frame.moveY += -dz(pad.axes[1] ?? 0)
    this.frame.lookX += dz(pad.axes[2] ?? 0) * 8
    this.frame.lookY += dz(pad.axes[3] ?? 0) * 8
    this.frame.throttle = Math.max(this.frame.throttle, pad.buttons[7]?.value ?? 0)
    this.frame.brake = Math.max(this.frame.brake, pad.buttons[6]?.value ?? 0)

    for (let i = 0; i < pad.buttons.length; i++) {
      const action = PAD_BUTTON_ACTIONS[i]
      if (!action) continue
      const pressed = pad.buttons[i].pressed
      if (pressed) this.padDown.add(action)
      if (pressed && !this.padPrev[i]) this.padPressed.add(action)
      this.padPrev[i] = pressed
    }
  }

  /** Atualiza o quadro de entrada. Chamar uma vez por frame, antes da lógica. */
  update(): void {
    const f = this.frame
    f.moveX = 0; f.moveY = 0

    if (this.enabled) {
      if (this.isDown('frente')) f.moveY += 1
      if (this.isDown('tras')) f.moveY -= 1
      if (this.isDown('direita')) f.moveX += 1
      if (this.isDown('esquerda')) f.moveX -= 1
    }
    f.throttle = this.isDown('frente') ? 1 : 0
    f.brake = this.isDown('tras') ? 1 : 0

    this.montarOlhar(f)

    this.pollGamepad()

    if (this.override) {
      f.moveX = this.override.moveX
      f.moveY = this.override.moveY
    }

    // Normaliza diagonal para não andar mais rápido na diagonal.
    const len = Math.hypot(f.moveX, f.moveY)
    if (len > 1) { f.moveX /= len; f.moveY /= len }
    f.moveX = clamp(f.moveX, -1, 1)
    f.moveY = clamp(f.moveY, -1, 1)
  }

  /** Limpa estados de "pressionado neste frame". Chamar no fim do frame. */
  endFrame(): void {
    this.pressedThisFrame.clear()
    this.releasedThisFrame.clear()
    this.mousePressed.clear()
  }
}

/** Nome legível de um código de tecla, para a tela de controles. */
export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6)
  const map: Record<string, string> = {
    ShiftLeft: 'Shift Esq', ShiftRight: 'Shift Dir',
    ControlLeft: 'Ctrl Esq', ControlRight: 'Ctrl Dir',
    AltLeft: 'Alt Esq', AltRight: 'Alt Dir',
    Space: 'Espaço', Escape: 'Esc', Enter: 'Enter', Tab: 'Tab',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
    Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\',
  }
  return map[code] ?? code
}
