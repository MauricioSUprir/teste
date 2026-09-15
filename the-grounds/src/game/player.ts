/**
 * Jogador: liga controle, personagem visual, câmera e estado de jogo.
 */

import * as THREE from 'three'
import { clamp, damp } from '../core/math'
import { CameraRig, type CameraMode, type CameraTarget } from '../core/cameras'
import type { Input } from '../core/input'
import { Character } from '../character/character'
import { CharacterController, defaultConfig, type MoveIntent, type SurfaceQuery } from '../character/controller'
import { ACTION_DURATION, type ActionKind } from '../character/animation'
import type { Appearance } from '../character/appearance'
import type { World } from '../world/world'

export type PlayerMode = 'aPe' | 'dirigindo' | 'futebol' | 'sentado' | 'foto' | 'menu'

export class Player {
  readonly character: Character
  readonly controller: CharacterController
  readonly rig: CameraRig
  mode: PlayerMode = 'aPe'
  /** Câmera preferida quando a pé. */
  cameraOnFoot: CameraMode = 'terceiraPessoa'

  private action: ActionKind | null = null
  private actionTime = 0
  private surfaces: SurfaceQuery
  private readonly camTarget: CameraTarget = {
    position: new THREE.Vector3(), yaw: 0, speed: 0, height: 1.78,
  }
  /** Fôlego: cai no sprint, recupera parado. */
  stamina = 1
  private staminaLock = 0

  constructor(
    appearance: Appearance,
    private readonly world: World,
    camera: THREE.PerspectiveCamera,
    fabric?: THREE.Texture,
  ) {
    this.character = new Character(appearance, { castShadow: true, fabric })
    this.controller = new CharacterController(
      defaultConfig(this.character.radius, this.character.height),
    )
    this.rig = new CameraRig(camera)
    this.surfaces = {
      ground: (x, z) => world.groundHeight(x, z),
      surface: (x, z, fromY) => world.surfaceHeight(x, z, fromY),
      normal: (x, z, out) => world.groundNormal(x, z, out),
    }
    world.root.add(this.character.group)
  }

  get position(): THREE.Vector3 { return this.controller.position }

  teleport(x: number, z: number, yaw = 0): void {
    const y = this.world.surfaceHeight(x, z, 1e4)
    this.controller.teleport(x, y, z, yaw)
    this.character.setPosition(x, y, z)
    this.character.setYaw(yaw)
    this.rig.yaw = yaw
    this.rig.snapTo(this.cameraTarget())
  }

  /** Reconstrói o visual depois de editar a aparência. */
  applyAppearance(app: Appearance): void {
    this.character.rebuild(app)
    this.controller.config = {
      ...this.controller.config,
      radius: this.character.radius,
      height: this.character.height,
      crouchHeight: this.character.height * 0.62,
    }
  }

  /** Dispara uma ação pontual (chute, aceno, interação). */
  playAction(kind: ActionKind): void {
    this.action = kind
    this.actionTime = 0
  }

  get currentAction(): ActionKind | null { return this.action }
  /** Progresso 0..1 da ação atual. */
  get actionProgress(): number {
    return this.action ? clamp(this.actionTime / ACTION_DURATION[this.action], 0, 1) : 0
  }

  private cameraTarget(): CameraTarget {
    this.camTarget.position.copy(this.controller.position)
    this.camTarget.yaw = this.controller.yaw
    this.camTarget.speed = this.controller.speed
    this.camTarget.height = this.character.height
    return this.camTarget
  }

  update(dt: number, input: Input, allowControl: boolean): void {
    // Mira
    if (allowControl) {
      this.rig.look(input.frame.lookX, input.frame.lookY)
      const wheel = input.takeWheel()
      if (wheel !== 0) this.rig.applyZoom(wheel)
      if (input.isPressed('primeiraPessoa')) {
        this.cameraOnFoot = this.cameraOnFoot === 'primeiraPessoa' ? 'terceiraPessoa' : 'primeiraPessoa'
        this.rig.setMode(this.cameraOnFoot)
      }
    }

    if (this.mode === 'aPe' || this.mode === 'futebol') {
      this.updateOnFoot(dt, input, allowControl)
    }

    // Ação em curso
    if (this.action) {
      this.actionTime += dt
      if (this.actionTime >= ACTION_DURATION[this.action]) this.action = null
    }

    this.syncCharacter(dt)
    this.rig.update(dt, this.cameraTarget(), this.world.collision)
  }

  private updateOnFoot(dt: number, input: Input, allowControl: boolean): void {
    const c = this.controller
    const wantSprint = allowControl && input.isDown('correr') && this.stamina > 0.02 && this.staminaLock <= 0

    const intent: MoveIntent = {
      x: allowControl ? input.frame.moveX : 0,
      y: allowControl ? input.frame.moveY : 0,
      cameraYaw: this.rig.yaw,
      sprint: wantSprint,
      crouch: allowControl && input.isDown('agachar'),
      jumpPressed: allowControl && input.isPressed('pular'),
      mirar: this.rig.mode === 'primeiraPessoa',
    }
    c.update(dt, intent, this.world.collision, this.surfaces)

    // Fôlego
    if (c.state === 'sprint') {
      this.stamina = Math.max(0, this.stamina - dt * 0.14)
      if (this.stamina <= 0.001) this.staminaLock = 2.5
    } else {
      const rate = c.speed < 0.2 ? 0.30 : 0.14
      this.stamina = Math.min(1, this.stamina + dt * rate)
    }
    this.staminaLock = Math.max(0, this.staminaLock - dt)

    // Efeitos de câmera
    if (c.landedThisFrame && c.fallDistance > 1.6) {
      this.rig.addShake(clamp(c.fallDistance / 8, 0.1, 0.9), 6)
    }
  }

  private syncCharacter(dt: number): void {
    const c = this.controller
    const ch = this.character
    ch.setPosition(c.position.x, c.position.y, c.position.z)
    ch.setYaw(c.yaw)

    const inp = ch.input
    inp.speed = c.speed
    inp.walkSpeed = c.config.walkSpeed
    inp.runSpeed = c.config.runSpeed
    inp.sprintSpeed = c.config.sprintSpeed
    inp.grounded = c.grounded && c.vaultProgress === 0
    inp.verticalSpeed = c.velocity.y
    inp.forwardness = c.forwardness
    inp.strafe = c.strafe
    inp.turnRate = c.turnRate
    inp.crouched = c.isCrouching
    inp.action = this.action
    inp.actionProgress = this.actionProgress
    inp.dirigindo = this.mode === 'dirigindo'
    inp.sentado = this.mode === 'sentado'

    // A cabeça acompanha a câmera, limitada para não torcer o pescoço.
    const rel = ((this.rig.yaw - c.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI
    inp.lookYaw = damp(inp.lookYaw, clamp(rel, -1.25, 1.25), 9, dt)
    inp.lookPitch = damp(inp.lookPitch, clamp(-this.rig.pitch, -0.6, 0.7), 9, dt)

    // Em primeira pessoa o corpo do jogador não aparece na frente da lente.
    const fp = this.rig.mode === 'primeiraPessoa'
    ch.setVisible(!fp || this.mode === 'dirigindo')

    ch.update(dt, (x, z) => this.world.surfaceHeight(x, z, c.position.y + 1.0))
  }
}
