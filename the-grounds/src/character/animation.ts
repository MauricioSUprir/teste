/**
 * Animação procedural do humanoide.
 *
 * Não há arquivos de animação: cada estado (parado, andando, correndo,
 * saltando, chutando…) é descrito como uma função que devolve os ângulos dos
 * ossos ao longo de um ciclo. O sistema mistura estados com pesos, aplica
 * inércia por osso e corrige o apoio dos pés no terreno, de modo que não haja
 * deslizamento nem trocas instantâneas de pose.
 */

import * as THREE from 'three'
import { clamp, damp, lerp, smoothstep, TAU } from '../core/math'
import { BONE_INDEX, type BoneName } from './rig'

/** Rotação alvo de um osso, em radianos, no espaço local. */
export type Pose = Partial<Record<BoneName, [number, number, number]>>

export interface AnimInput {
  /** Velocidade horizontal em m/s. */
  speed: number
  /** Velocidade máxima de caminhada antes de virar corrida. */
  walkSpeed: number
  runSpeed: number
  sprintSpeed: number
  /** Está no chão. */
  grounded: boolean
  /** Velocidade vertical (m/s). */
  verticalSpeed: number
  /** Direção do movimento em relação à frente do corpo (-1 ré, 1 frente). */
  forwardness: number
  /** Componente lateral do movimento (-1 esquerda, 1 direita). */
  strafe: number
  /** Taxa de giro do corpo (rad/s), para inclinação nas curvas. */
  turnRate: number
  /** Agachado. */
  crouched: boolean
  /** Inclinação do olhar em radianos (cabeça). */
  lookPitch: number
  /** Giro do olhar em relação ao corpo. */
  lookYaw: number
  /** Ação pontual em curso e seu progresso 0..1. */
  action: ActionKind | null
  actionProgress: number
  /** Conduzindo bola: muda o balanço dos braços e o passo. */
  comBola: boolean
  /** Dentro de veículo. */
  dirigindo: boolean
  /** Ângulo do volante (-1..1) para posicionar as mãos. */
  volante: number
  /** Sentado (banco, cadeira). */
  sentado: boolean
  /** Carregando objeto nas mãos. */
  carregando: boolean
}

export type ActionKind =
  | 'chute' | 'chuteForte' | 'passe' | 'cabeceio' | 'carrinho' | 'drible'
  | 'aceno' | 'conversa' | 'interagir' | 'comemorar' | 'defesaGoleiro' | 'pulo'

export function defaultAnimInput(): AnimInput {
  return {
    speed: 0, walkSpeed: 1.6, runSpeed: 4.0, sprintSpeed: 7.0,
    grounded: true, verticalSpeed: 0, forwardness: 1, strafe: 0, turnRate: 0,
    crouched: false, lookPitch: 0, lookYaw: 0,
    action: null, actionProgress: 0,
    comBola: false, dirigindo: false, volante: 0, sentado: false, carregando: false,
  }
}

const ALL_BONES = Object.keys(BONE_INDEX) as BoneName[]

/** Acumulador de pose com mistura ponderada. */
class PoseBlender {
  private acc = new Map<BoneName, [number, number, number]>()
  private wsum = new Map<BoneName, number>()

  reset(): void { this.acc.clear(); this.wsum.clear() }

  add(pose: Pose, weight: number): void {
    if (weight <= 0.0005) return
    for (const key of Object.keys(pose) as BoneName[]) {
      const v = pose[key]!
      const a = this.acc.get(key)
      if (a) {
        a[0] += v[0] * weight; a[1] += v[1] * weight; a[2] += v[2] * weight
        this.wsum.set(key, (this.wsum.get(key) ?? 0) + weight)
      } else {
        this.acc.set(key, [v[0] * weight, v[1] * weight, v[2] * weight])
        this.wsum.set(key, weight)
      }
    }
  }

  /** Normaliza e devolve a pose final. */
  result(): Map<BoneName, [number, number, number]> {
    for (const [k, v] of this.acc) {
      const w = this.wsum.get(k) ?? 1
      if (w > 0.0001) { v[0] /= w; v[1] /= w; v[2] /= w }
    }
    return this.acc
  }
}

// --------------------------------------------------------------------------
// Poses de base
// --------------------------------------------------------------------------

/** Postura neutra de pé, com leve respiração. */
function poseIdle(t: number, comBola: boolean): Pose {
  const breath = Math.sin(t * 1.5) * 0.012
  const sway = Math.sin(t * 0.6) * 0.02
  return {
    quadril: [0.012 + breath * 0.4, sway * 0.5, 0],
    lombar: [-0.02 - breath, 0, sway * 0.3],
    torax: [0.015 + breath, sway * 0.4, 0],
    pescoco: [-0.02, 0, 0],
    ombroE: [0, 0, -0.06],
    ombroD: [0, 0, 0.06],
    bracoE: [comBola ? -0.28 : -0.06, 0, -0.10 + Math.sin(t * 0.7) * 0.012],
    bracoD: [comBola ? -0.28 : -0.06, 0, 0.10 - Math.sin(t * 0.7 + 1) * 0.012],
    antebracoE: [comBola ? -0.55 : -0.16, 0, 0],
    antebracoD: [comBola ? -0.55 : -0.16, 0, 0],
    maoE: [0, 0, 0], maoD: [0, 0, 0],
    coxaE: [0.02, 0, 0.018],
    coxaD: [0.02, 0, -0.018],
    canelaE: [-0.04, 0, 0],
    canelaD: [-0.04, 0, 0],
    peE: [0.02, 0, 0],
    peD: [0.02, 0, 0],
  }
}

/**
 * Ciclo de passada. `phase` de 0 a 1. `intensity` controla amplitude
 * (caminhada, corrida, sprint). Perna esquerda e direita em oposição.
 */
function poseLocomotion(phase: number, intensity: number, forwardness: number, comBola: boolean): Pose {
  const a = phase * TAU
  const amp = intensity
  // Amplitudes calibradas: coxa abre à frente, canela dobra atrás.
  const thighAmp = lerp(0.42, 0.95, amp)
  const shinAmp = lerp(0.50, 1.35, amp)
  const armAmp = lerp(0.34, 0.92, amp) * (comBola ? 0.55 : 1)
  const dir = forwardness >= 0 ? 1 : -1

  const sinL = Math.sin(a)
  const sinR = Math.sin(a + Math.PI)
  // A canela dobra principalmente na fase de recuperação.
  const shinL = Math.max(0, Math.sin(a - 0.9)) ** 1.4
  const shinR = Math.max(0, Math.sin(a + Math.PI - 0.9)) ** 1.4
  // Subida e descida do tronco: dois picos por ciclo.
  const bob = -Math.cos(a * 2) * lerp(0.010, 0.035, amp)
  const lean = lerp(0.04, 0.22, amp) * dir

  return {
    quadril: [lean * 0.35 + bob * 0.2, Math.sin(a) * lerp(0.03, 0.10, amp), Math.sin(a * 2) * lerp(0.01, 0.045, amp)],
    lombar: [lean * 0.30, -Math.sin(a) * lerp(0.04, 0.13, amp), 0],
    torax: [lean * 0.35, -Math.sin(a) * lerp(0.05, 0.17, amp), 0],
    pescoco: [-lean * 0.55, 0, 0],

    ombroE: [0, 0, -0.06 - amp * 0.05],
    ombroD: [0, 0, 0.06 + amp * 0.05],
    bracoE: [comBola ? -0.30 : sinR * armAmp * dir, 0, -0.12 - amp * 0.08],
    bracoD: [comBola ? -0.30 : sinL * armAmp * dir, 0, 0.12 + amp * 0.08],
    antebracoE: [comBola ? -0.60 : -(0.22 + Math.max(0, sinR * dir) * lerp(0.35, 1.0, amp)), 0, 0],
    antebracoD: [comBola ? -0.60 : -(0.22 + Math.max(0, sinL * dir) * lerp(0.35, 1.0, amp)), 0, 0],

    coxaE: [sinL * thighAmp * dir + lerp(0.02, 0.12, amp), 0, 0.02],
    coxaD: [sinR * thighAmp * dir + lerp(0.02, 0.12, amp), 0, -0.02],
    canelaE: [-shinL * shinAmp - 0.05, 0, 0],
    canelaD: [-shinR * shinAmp - 0.05, 0, 0],
    peE: [clamp(-sinL * 0.42 * dir + 0.12, -0.5, 0.65), 0, 0],
    peD: [clamp(-sinR * 0.42 * dir + 0.12, -0.5, 0.65), 0, 0],
  }
}

/** Movimento lateral: passo cruzado com tronco voltado à frente. */
function poseStrafe(phase: number, strafe: number, intensity: number): Pose {
  const a = phase * TAU
  const amp = lerp(0.25, 0.55, intensity)
  const s = Math.sign(strafe) || 1
  return {
    quadril: [0.02, 0, -s * 0.05],
    torax: [0.03, -s * 0.10, 0],
    coxaE: [Math.sin(a) * amp * 0.5, 0, s * 0.18 + Math.sin(a) * 0.1],
    coxaD: [Math.sin(a + Math.PI) * amp * 0.5, 0, s * 0.18 + Math.sin(a + Math.PI) * 0.1],
    canelaE: [-Math.max(0, Math.sin(a - 0.8)) * amp, 0, 0],
    canelaD: [-Math.max(0, Math.sin(a + Math.PI - 0.8)) * amp, 0, 0],
    bracoE: [0, 0, -0.22],
    bracoD: [0, 0, 0.22],
  }
}

function poseAir(verticalSpeed: number): Pose {
  const rising = clamp(verticalSpeed / 5, -1, 1)
  const tuck = smoothstep(1, -3, verticalSpeed)
  return {
    quadril: [0.06, 0, 0],
    lombar: [0.05 + rising * 0.05, 0, 0],
    torax: [0.06 - rising * 0.08, 0, 0],
    bracoE: [-0.9 - rising * 0.5, 0, -0.45],
    bracoD: [-0.9 - rising * 0.5, 0, 0.45],
    antebracoE: [-0.7, 0, 0],
    antebracoD: [-0.7, 0, 0],
    coxaE: [0.45 + tuck * 0.55, 0, 0.05],
    coxaD: [0.20 + tuck * 0.35, 0, -0.05],
    canelaE: [-0.65 - tuck * 0.6, 0, 0],
    canelaD: [-0.40 - tuck * 0.4, 0, 0],
    peE: [0.28, 0, 0],
    peD: [0.22, 0, 0],
  }
}

function poseCrouch(t: number): Pose {
  const breath = Math.sin(t * 1.9) * 0.01
  return {
    quadril: [0.30, 0, 0],
    lombar: [0.14 + breath, 0, 0],
    torax: [0.10, 0, 0],
    pescoco: [-0.18, 0, 0],
    bracoE: [-0.25, 0, -0.16],
    bracoD: [-0.25, 0, 0.16],
    antebracoE: [-0.55, 0, 0],
    antebracoD: [-0.55, 0, 0],
    coxaE: [1.05, 0, 0.10],
    coxaD: [1.05, 0, -0.10],
    canelaE: [-1.75, 0, 0],
    canelaD: [-1.75, 0, 0],
    peE: [0.58, 0, 0],
    peD: [0.58, 0, 0],
  }
}

function poseSeated(volante: number, dirigindo: boolean): Pose {
  return {
    quadril: [0.06, 0, 0],
    lombar: [0.05, 0, 0],
    torax: [0.02, 0, 0],
    bracoE: dirigindo ? [-1.28, 0.20, -0.40 + volante * 0.45] : [-0.35, 0, -0.18],
    bracoD: dirigindo ? [-1.28, -0.20, 0.40 + volante * 0.45] : [-0.35, 0, 0.18],
    antebracoE: dirigindo ? [-0.55, 0, 0] : [-0.95, 0, 0],
    antebracoD: dirigindo ? [-0.55, 0, 0] : [-0.95, 0, 0],
    coxaE: [1.48, 0, 0.12],
    coxaD: [1.48, 0, -0.12],
    canelaE: [-1.42, 0, 0],
    canelaD: [-1.42, 0, 0],
    peE: [0.28, 0, 0],
    peD: [0.28, 0, 0],
  }
}

// --------------------------------------------------------------------------
// Ações pontuais
// --------------------------------------------------------------------------

/** Curva de ataque/sustentação/retorno para golpes. */
function strike(p: number, wind: number, hit: number): number {
  if (p < wind) return -smoothstep(0, wind, p)
  if (p < hit) return lerp(-1, 1, smoothstep(wind, hit, p))
  return lerp(1, 0, smoothstep(hit, 1, p))
}

function poseAction(kind: ActionKind, p: number, comBola: boolean): Pose {
  switch (kind) {
    case 'chute': case 'chuteForte': {
      const forte = kind === 'chuteForte'
      const s = strike(p, forte ? 0.34 : 0.26, forte ? 0.55 : 0.48)
      const plant = smoothstep(0, 0.3, p) * (1 - smoothstep(0.7, 1, p))
      return {
        quadril: [-s * 0.16, -s * 0.18, 0],
        lombar: [-s * 0.10, s * 0.14, 0],
        torax: [-s * 0.14, s * 0.26, s * 0.06],
        // Perna de chute (direita)
        coxaD: [s * (forte ? 1.45 : 1.15), 0, -0.04],
        canelaD: [-(1 - Math.max(0, s)) * (forte ? 1.5 : 1.2) - 0.12, 0, 0],
        peD: [clamp(0.10 + s * 0.45, -0.4, 0.62), 0, 0],
        // Perna de apoio (esquerda)
        coxaE: [-0.16 - plant * 0.18, 0, 0.12],
        canelaE: [-0.26 - plant * 0.20, 0, 0],
        peE: [0.12, 0, 0],
        // Braços fazem contrapeso
        bracoE: [-s * 0.85, 0, -0.55 - Math.max(0, s) * 0.35],
        bracoD: [s * 0.55, 0, 0.42],
        antebracoE: [-0.55, 0, 0],
        antebracoD: [-0.42, 0, 0],
      }
    }
    case 'passe': {
      const s = strike(p, 0.24, 0.44)
      return {
        quadril: [-s * 0.08, -s * 0.10, 0],
        torax: [-s * 0.06, s * 0.16, 0],
        coxaD: [s * 0.62, 0, -0.22 - Math.max(0, s) * 0.2],
        canelaD: [-(1 - Math.max(0, s)) * 0.55 - 0.1, 0, 0],
        peD: [0.10, 0.45 * Math.max(0, s), 0],
        coxaE: [-0.10, 0, 0.12],
        canelaE: [-0.18, 0, 0],
        bracoE: [-s * 0.45, 0, -0.42],
        bracoD: [s * 0.30, 0, 0.32],
      }
    }
    case 'cabeceio': {
      const s = strike(p, 0.34, 0.56)
      return {
        quadril: [-s * 0.18, 0, 0],
        lombar: [-s * 0.22, 0, 0],
        torax: [-s * 0.30, 0, 0],
        pescoco: [-s * 0.34, 0, 0],
        cabeca: [-s * 0.20, 0, 0],
        bracoE: [-0.7 - s * 0.4, 0, -0.65],
        bracoD: [-0.7 - s * 0.4, 0, 0.65],
        coxaE: [0.25 + Math.max(0, -s) * 0.3, 0, 0.1],
        coxaD: [0.25 + Math.max(0, -s) * 0.3, 0, -0.1],
        canelaE: [-0.40, 0, 0],
        canelaD: [-0.40, 0, 0],
      }
    }
    case 'carrinho': {
      const slide = smoothstep(0, 0.22, p) * (1 - smoothstep(0.62, 1, p))
      return {
        quadril: [slide * 0.9, 0, slide * 0.55],
        lombar: [slide * 0.35, 0, slide * 0.25],
        torax: [slide * 0.25, 0, slide * 0.2],
        coxaD: [slide * 1.35, 0, -0.1],
        canelaD: [-0.12, 0, 0],
        coxaE: [slide * 0.55, 0, 0.18],
        canelaE: [-slide * 1.55, 0, 0],
        bracoE: [-slide * 1.2, 0, -0.8],
        bracoD: [-slide * 0.8, 0, 0.5],
      }
    }
    case 'drible': {
      const s = Math.sin(p * Math.PI)
      return {
        quadril: [0, 0, s * 0.18],
        torax: [0.04, -s * 0.2, -s * 0.12],
        coxaD: [s * 0.55, 0, -0.26 * s],
        canelaD: [-s * 0.7, 0, 0],
        coxaE: [-s * 0.15, 0, 0.1],
        bracoE: [-s * 0.4, 0, -0.5],
        bracoD: [s * 0.3, 0, 0.45],
      }
    }
    case 'defesaGoleiro': {
      const s = smoothstep(0, 0.28, p) * (1 - smoothstep(0.7, 1, p))
      return {
        quadril: [0.1, 0, s * 0.5],
        torax: [0.12, 0, s * 0.35],
        bracoE: [-2.2 * s - 0.3, 0, -0.9 * s - 0.3],
        bracoD: [-2.2 * s - 0.3, 0, 0.9 * s + 0.3],
        antebracoE: [-0.25, 0, 0],
        antebracoD: [-0.25, 0, 0],
        coxaE: [0.5 + s * 0.4, 0, 0.25],
        coxaD: [0.5 + s * 0.4, 0, -0.25],
        canelaE: [-0.9 - s * 0.5, 0, 0],
        canelaD: [-0.9 - s * 0.5, 0, 0],
      }
    }
    case 'aceno': {
      const wave = Math.sin(p * Math.PI * 4) * smoothstep(0, 0.2, p) * (1 - smoothstep(0.8, 1, p))
      return {
        bracoD: [-2.35, 0, 0.55 + wave * 0.30],
        antebracoD: [-0.32, 0, wave * 0.55],
        maoD: [0, 0, wave * 0.5],
        torax: [0, -0.10, 0],
        cabeca: [0, -0.08, 0],
      }
    }
    case 'conversa': {
      const g = Math.sin(p * Math.PI * 2.5)
      return {
        bracoE: [-0.55 - Math.max(0, g) * 0.35, 0, -0.30],
        antebracoE: [-1.15 - g * 0.25, 0, 0],
        bracoD: [-0.45 + g * 0.2, 0, 0.28],
        antebracoD: [-0.95 + g * 0.3, 0, 0],
        torax: [0.02, g * 0.06, 0],
        cabeca: [g * 0.05, -g * 0.08, 0],
      }
    }
    case 'interagir': {
      const reach = Math.sin(p * Math.PI)
      return {
        bracoD: [-1.15 * reach - 0.08, 0, 0.22],
        antebracoD: [-0.42 * reach - 0.12, 0, 0],
        torax: [reach * 0.10, -reach * 0.14, 0],
        lombar: [reach * 0.06, 0, 0],
      }
    }
    case 'comemorar': {
      const up = smoothstep(0, 0.25, p) * (1 - smoothstep(0.75, 1, p))
      const shake = Math.sin(p * Math.PI * 6) * up
      return {
        bracoE: [-2.6 * up - 0.1, 0, -0.55 - up * 0.25],
        bracoD: [-2.6 * up - 0.1, 0, 0.55 + up * 0.25],
        antebracoE: [-0.2, 0, 0],
        antebracoD: [-0.2, 0, 0],
        torax: [-up * 0.22, shake * 0.12, 0],
        cabeca: [-up * 0.25, 0, 0],
        coxaE: [-up * 0.12, 0, 0.12],
        coxaD: [-up * 0.12, 0, -0.12],
      }
    }
    case 'pulo': {
      const crouch = 1 - smoothstep(0, 0.3, p)
      return {
        quadril: [crouch * 0.35, 0, 0],
        coxaE: [crouch * 0.75, 0, 0.1],
        coxaD: [crouch * 0.75, 0, -0.1],
        canelaE: [-crouch * 1.1, 0, 0],
        canelaD: [-crouch * 1.1, 0, 0],
        bracoE: [crouch * 0.5, 0, -0.3],
        bracoD: [crouch * 0.5, 0, 0.3],
      }
    }
    default:
      return poseIdle(p * 6, comBola)
  }
}

/** Quais ossos uma ação domina completamente (não mistura com locomoção). */
const ACTION_DOMINANCE: Record<ActionKind, number> = {
  chute: 0.92, chuteForte: 0.95, passe: 0.85, cabeceio: 0.9, carrinho: 0.98,
  drible: 0.6, aceno: 0.55, conversa: 0.5, interagir: 0.55, comemorar: 0.9,
  defesaGoleiro: 0.95, pulo: 0.7,
}

export const ACTION_DURATION: Record<ActionKind, number> = {
  chute: 0.62, chuteForte: 0.80, passe: 0.48, cabeceio: 0.70, carrinho: 1.05,
  drible: 0.42, aceno: 1.30, conversa: 2.20, interagir: 0.85, comemorar: 1.90,
  defesaGoleiro: 0.95, pulo: 0.35,
}

/** Instante do ciclo em que o pé/cabeça toca a bola (0..1). */
export const ACTION_CONTACT: Partial<Record<ActionKind, number>> = {
  chute: 0.48, chuteForte: 0.55, passe: 0.44, cabeceio: 0.56, carrinho: 0.34, drible: 0.45,
}

// --------------------------------------------------------------------------
// Animador
// --------------------------------------------------------------------------

export class Animator {
  private phase = 0
  private blender = new PoseBlender()
  /** Rotações suavizadas por osso (evita trancos). */
  private current = new Map<BoneName, THREE.Vector3>()
  private euler = new THREE.Euler()
  /** Deslocamento vertical do quadril produzido pela passada. */
  hipOffset = 0
  /** Fase de contato de cada pé (1 = apoiado). */
  footPlant: [number, number] = [1, 1]
  /** Inclinação lateral do corpo nas curvas. */
  private bankAngle = 0

  constructor() {
    for (const b of ALL_BONES) this.current.set(b, new THREE.Vector3())
  }

  reset(): void {
    this.phase = 0
    for (const v of this.current.values()) v.set(0, 0, 0)
  }

  /** Avança a animação e escreve as rotações nos ossos. */
  update(dt: number, input: AnimInput, bones: THREE.Bone[], elapsed: number): void {
    const { speed, walkSpeed, runSpeed, sprintSpeed } = input

    // Intensidade 0 (parado) .. 1 (sprint)
    const moveAmount = smoothstep(0.06, walkSpeed * 0.8, speed)
    const intensity = clamp(
      speed <= runSpeed
        ? (speed / Math.max(runSpeed, 0.01)) * 0.55
        : 0.55 + ((speed - runSpeed) / Math.max(sprintSpeed - runSpeed, 0.01)) * 0.45,
      0, 1,
    )

    // Frequência do passo cresce com a velocidade (e com pernas mais curtas)
    const stepsPerSecond = speed < 0.05 ? 0 : lerp(1.05, 2.55, intensity) * (speed / Math.max(walkSpeed, 0.01)) ** 0.22
    this.phase = (this.phase + dt * stepsPerSecond) % 1
    if (speed < 0.05) this.phase = damp(this.phase, this.phase > 0.5 ? 1 : 0, 6, dt) % 1

    this.blender.reset()

    if (input.sentado || input.dirigindo) {
      this.blender.add(poseSeated(input.volante, input.dirigindo), 1)
    } else if (!input.grounded) {
      this.blender.add(poseAir(input.verticalSpeed), 1)
    } else if (input.crouched) {
      this.blender.add(poseCrouch(elapsed), 1)
      this.blender.add(poseLocomotion(this.phase, intensity * 0.5, input.forwardness, input.comBola), moveAmount * 0.55)
    } else {
      this.blender.add(poseIdle(elapsed, input.comBola), 1 - moveAmount)
      const lateral = Math.abs(input.strafe) * (1 - Math.abs(input.forwardness))
      this.blender.add(poseLocomotion(this.phase, intensity, input.forwardness, input.comBola), moveAmount * (1 - lateral * 0.7))
      if (lateral > 0.02) {
        this.blender.add(poseStrafe(this.phase, input.strafe, intensity), moveAmount * lateral * 0.7)
      }
    }

    if (input.action) {
      const p = clamp(input.actionProgress, 0, 1)
      // Entrada e saída suaves para não cortar a locomoção bruscamente.
      const env = smoothstep(0, 0.12, p) * (1 - smoothstep(0.86, 1, p))
      this.blender.add(poseAction(input.action, p, input.comBola), ACTION_DOMINANCE[input.action] * env * 4)
    }

    const target = this.blender.result()

    // Inclinação lateral nas curvas (peso do corpo)
    const bankTarget = clamp(-input.turnRate * 0.10, -0.22, 0.22) * moveAmount
    this.bankAngle = damp(this.bankAngle, bankTarget, 7, dt)

    // Olhar: distribuído entre tórax, pescoço e cabeça
    const lookY = clamp(input.lookYaw, -1.5, 1.5)
    const lookX = clamp(input.lookPitch, -0.9, 0.7)
    addTo(target, 'torax', [0, lookY * 0.18, this.bankAngle * 0.5])
    addTo(target, 'pescoco', [lookX * 0.35, lookY * 0.30, 0])
    addTo(target, 'cabeca', [lookX * 0.55, lookY * 0.42, 0])
    addTo(target, 'quadril', [0, 0, this.bankAngle])

    // Suavização por osso com constantes diferentes: extremidades respondem
    // mais rápido que o tronco, o que dá sensação de peso.
    for (const name of ALL_BONES) {
      const cur = this.current.get(name)!
      const t = target.get(name) ?? ZERO
      const lambda = LAMBDA[name] ?? 16
      cur.x = damp(cur.x, t[0], lambda, dt)
      cur.y = damp(cur.y, t[1], lambda, dt)
      cur.z = damp(cur.z, t[2], lambda, dt)
      const bone = bones[BONE_INDEX[name]]
      if (!bone) continue
      this.euler.set(cur.x, cur.y, cur.z, 'YXZ')
      bone.quaternion.setFromEuler(this.euler)
    }

    // Oscilação vertical do quadril, para o corpo acompanhar a passada.
    const bobAmp = lerp(0.008, 0.052, intensity) * moveAmount
    this.hipOffset = -Math.abs(Math.sin(this.phase * Math.PI * 2)) * bobAmp
    if (!input.grounded) this.hipOffset = 0

    // Fase de apoio de cada pé, usada pela correção no terreno.
    const a = this.phase * TAU
    this.footPlant = [
      clamp(1 - Math.max(0, Math.sin(a)) * 1.6, 0, 1),
      clamp(1 - Math.max(0, Math.sin(a + Math.PI)) * 1.6, 0, 1),
    ]
  }

  get strideFase(): number { return this.phase }
}

const ZERO: [number, number, number] = [0, 0, 0]

/** Constantes de suavização por osso (maior = mais rápido). */
const LAMBDA: Partial<Record<BoneName, number>> = {
  quadril: 12, lombar: 12, torax: 13, pescoco: 18, cabeca: 20,
  ombroE: 14, ombroD: 14,
  bracoE: 17, bracoD: 17, antebracoE: 20, antebracoD: 20, maoE: 22, maoD: 22,
  coxaE: 19, coxaD: 19, canelaE: 22, canelaD: 22, peE: 24, peD: 24,
}

function addTo(map: Map<BoneName, [number, number, number]>, name: BoneName, v: [number, number, number]): void {
  const cur = map.get(name)
  if (cur) { cur[0] += v[0]; cur[1] += v[1]; cur[2] += v[2] }
  else map.set(name, [...v])
}
