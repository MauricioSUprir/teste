/**
 * Jogo: laço principal, integração dos sistemas e estado da sessão.
 */

import * as THREE from 'three'
import { Engine } from '../core/engine'
import { Input } from '../core/input'
import { loadSettings, sanitizeSettings, saveSettings, type Settings } from '../core/settings'
import { MaterialLibrary, type WorldMaterialKey } from '../world/materials'
import { World } from '../world/world'
import { CDN_PRIORITY, CdnTextureLoader } from '../assets/cdnTextures'
import { Player } from './player'
import { defaultAppearance, type Appearance } from '../character/appearance'
import { MAP_HALF } from '../world/terrain'

export interface GameStats {
  fps: number
  frameMs: number
  setores: number
  pendentes: number
  colisores: number
  draws: number
  tris: number
  resolucao: string
  escala: number
  bairro: string
  posicao: string
  /** Diagnóstico de apoio: terreno, superfície, base, pé e cabeça. */
  alturas: string
  estado: string
  hora: string
  chuva: number
  cdn: string
  /** Vértices por malha do personagem, para diagnóstico visual. */
  malhas: string
  /** Caixas deformadas de partes do corpo (diagnóstico). */
  partes: string
  /** Colisores sobrepostos ao jogador (diagnóstico de travamento). */
  obstaculos: string
  /** Entrada e velocidade (diagnóstico). */
  entrada: string
  /** O que a câmera enxerga no caminho até os pés (diagnóstico de oclusão). */
  oclusao: string
}

export class Game {
  readonly engine: Engine
  readonly input: Input
  readonly materials: MaterialLibrary
  readonly world: World
  player!: Player
  settings: Settings
  private cdn: CdnTextureLoader
  private cdnDone = 0
  private cdnTotal = CDN_PRIORITY.length
  private clock = new THREE.Clock()
  private running = false
  private raf = 0
  private cpuMs = 0
  private envTimer = 0
  /** Congela o tempo do mundo e a entrada (menus). */
  paused = false

  constructor(canvas: HTMLCanvasElement, appearance: Appearance = defaultAppearance()) {
    this.settings = sanitizeSettings(loadSettings())
    this.engine = new Engine(canvas, this.settings.graphics)
    this.input = new Input(this.settings.bindings, canvas)
    this.input.sensitivity = this.settings.gameplay.sensitivity
    this.input.invertY = this.settings.gameplay.invertY

    this.materials = new MaterialLibrary(this.settings.graphics.textureQuality, this.engine.maxAnisotropy)
    this.world = new World(this.materials, this.settings.graphics)
    this.engine.scene.add(this.world.root)

    this.player = new Player(appearance, this.world, this.engine.camera)
    this.player.rig.settings = {
      sensitivity: this.settings.gameplay.sensitivity,
      invertY: this.settings.gameplay.invertY,
      fovBase: this.settings.gameplay.fov,
      reduceMotion: this.settings.gameplay.reduceCameraMotion,
      smoothing: 1,
    }

    this.cdn = new CdnTextureLoader(this.engine.maxAnisotropy, this.settings.graphics.textureQuality)

    window.addEventListener('resize', this.onResize)
  }

  private onResize = () => this.engine.resize()

  /** Carrega o essencial antes de mostrar o mundo. */
  async prepare(spawnX: number, spawnZ: number, onProgress?: (p: number, texto: string) => void): Promise<void> {
    onProgress?.(0.05, 'Levantando a cidade')
    this.player.teleport(spawnX, spawnZ, 0)
    this.world.updateStreaming(this.player.position)

    // Constrói os setores próximos antes de entrar.
    let guard = 0
    while (this.world.pendingSectors > 0 && guard < 400) {
      this.world.processBuildQueue(28)
      guard++
      const total = this.world.loadedSectors + this.world.pendingSectors
      onProgress?.(0.05 + 0.55 * (this.world.loadedSectors / Math.max(total, 1)), 'Levantando a cidade')
      await frame()
    }

    onProgress?.(0.62, 'Assentando o personagem')
    this.player.teleport(spawnX, spawnZ, 0)

    onProgress?.(0.66, 'Baixando materiais')
    // As texturas fotogramétricas entram em segundo plano: o jogo já é jogável
    // com as procedurais, e cada material é trocado assim que chega.
    void this.cdn.loadAll(
      CDN_PRIORITY,
      (key, maps) => this.materials.applyCdnMaps(key as WorldMaterialKey, maps),
      (p) => { this.cdnDone = p.done - p.failed },
    )

    this.world.update(0.016, this.player.position, this.engine.fog, this.engine.sun, this.engine.hemi)
    const env = this.engine.refreshEnvironment(this.world.sky.mesh, 0, true)
    this.materials.setEnvironment(env)
    onProgress?.(1, 'Pronto')
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.clock.start()
    this.loop()
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.raf)
  }

  private loop = (): void => {
    if (!this.running) return
    this.raf = requestAnimationFrame(this.loop)
    const dt = Math.min(0.05, this.clock.getDelta())
    const t0 = performance.now()

    this.input.update()
    const allow = !this.paused && this.input.pointerLocked

    if (!this.paused) {
      this.world.update(dt, this.player.position, this.engine.fog, this.engine.sun, this.engine.hemi)
      this.player.update(dt, this.input, allow)
      this.world.updateStreaming(this.player.position)
      this.world.processBuildQueue(4.5)

      // Rede de segurança: fora do mapa ou preso, volta para um ponto seguro.
      const p = this.player.position
      if (Math.abs(p.x) > MAP_HALF + 40 || Math.abs(p.z) > MAP_HALF + 40 || p.y < -40) {
        const safe = this.world.findSafeSpot(clamp(p.x), clamp(p.z))
        this.player.teleport(safe.x, safe.z, this.player.controller.yaw)
      }
    } else {
      this.player.update(dt, this.input, false)
    }

    this.engine.updateSunShadow(this.player.position, this.world.sky.sunDirection)
    this.envTimer -= dt
    if (this.envTimer <= 0) {
      this.envTimer = 3
      const env = this.engine.refreshEnvironment(this.world.sky.mesh, dt, true)
      if (env) this.materials.setEnvironment(env)
    }

    this.cpuMs = performance.now() - t0
    this.engine.render(dt, this.cpuMs)
    this.input.endFrame()
  }

  applySettings(next: Settings): void {
    this.settings = sanitizeSettings(next)
    saveSettings(this.settings)
    this.engine.applySettings(this.settings.graphics)
    this.engine.setFov(this.settings.gameplay.fov)
    this.world.applySettings(this.settings.graphics)
    this.input.setBindings(this.settings.bindings)
    this.input.sensitivity = this.settings.gameplay.sensitivity
    this.input.invertY = this.settings.gameplay.invertY
    this.player.rig.settings = {
      sensitivity: this.settings.gameplay.sensitivity,
      invertY: this.settings.gameplay.invertY,
      fovBase: this.settings.gameplay.fov,
      reduceMotion: this.settings.gameplay.reduceCameraMotion,
      smoothing: 1,
    }
  }

  stats(): GameStats {
    const p = this.engine.perf
    const pos = this.player.position
    return {
      fps: Math.round(p.fps),
      frameMs: Number(p.frameMs.toFixed(2)),
      setores: this.world.loadedSectors,
      pendentes: this.world.pendingSectors,
      colisores: this.world.collision.count,
      draws: p.drawCalls,
      tris: p.triangles,
      resolucao: `${p.width}x${p.height}`,
      escala: Number(p.renderScale.toFixed(2)),
      bairro: this.world.districtName(pos.x, pos.z),
      posicao: `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`,
      alturas: (() => {
        const ch = this.player.character
        const pe = new THREE.Vector3().setFromMatrixPosition(ch.bone('peE').matrixWorld)
        const joelho = new THREE.Vector3().setFromMatrixPosition(ch.bone('canelaE').matrixWorld)
        const coxa = new THREE.Vector3().setFromMatrixPosition(ch.bone('coxaE').matrixWorld)
        const cab = new THREE.Vector3().setFromMatrixPosition(ch.bone('cabeca').matrixWorld)
        return `t=${this.world.groundHeight(pos.x, pos.z).toFixed(2)} s=${this.world.surfaceHeight(pos.x, pos.z, pos.y + 1).toFixed(2)}`
          + ` base=${ch.group.position.y.toFixed(2)} coxa=${coxa.y.toFixed(2)} joelho=${joelho.y.toFixed(2)}`
          + ` pe=${pe.y.toFixed(2)} cab=${cab.y.toFixed(2)}`
          + ` cam=${this.engine.camera.position.y.toFixed(2)}`
      })(),
      estado: this.player.controller.state,
      hora: formatHour(this.world.hour),
      chuva: Number(this.world.weather.rain.toFixed(2)),
      cdn: `${this.cdnDone}/${this.cdnTotal}`,
      malhas: (() => {
        const out: string[] = []
        this.player.character.group.traverse((o) => {
          const m = o as THREE.Mesh
          if (m.isMesh && m.geometry?.attributes?.position) {
            out.push(`${m.name}:${m.geometry.attributes.position.count}${m.visible ? '' : '(oculto)'}`)
          }
        })
        return out.join(' ')
      })(),
      partes: (['coxaE', 'canelaE', 'peE', 'torax'] as const)
        .map((b) => {
          const d = this.player.character.diagnosticarOsso(b)
          return d ? `${b}:[${d.min.y.toFixed(2)}..${d.max.y.toFixed(2)}]x${d.n}` : `${b}:-`
        })
        .join(' '),
      obstaculos: (() => {
        const p2 = this.player.position
        const perto = this.world.collision.query(p2.x, p2.z, 1.6)
        const dentro = perto.filter((c) => {
          if (!c.solid) return false
          if (c.y + c.hy < p2.y + 0.2 || c.y - c.hy > p2.y + 1.7) return false
          const dx = p2.x - c.x
          const dz = p2.z - c.z
          const lx = dx * c.cos + dz * c.sin
          const lz = -dx * c.sin + dz * c.cos
          return Math.abs(lx) < c.hx + 0.45 && Math.abs(lz) < c.hz + 0.45
        })
        return dentro.length === 0
          ? 'livre'
          : dentro.slice(0, 5).map((c) => `${c.tag}(${c.hx.toFixed(1)}x${c.hy.toFixed(1)}x${c.hz.toFixed(1)}@${(c.y - c.hy).toFixed(1)}-${(c.y + c.hy).toFixed(1)})`).join(' ')
      })(),
      entrada: (() => {
        const f = this.input.frame
        const c = this.player.controller
        return `mov=${f.moveX.toFixed(2)},${f.moveY.toFixed(2)}`
          + ` vel=${c.velocity.x.toFixed(2)},${c.velocity.y.toFixed(2)},${c.velocity.z.toFixed(2)}`
          + ` v=${c.speed.toFixed(2)} lock=${this.input.pointerLocked} ov=${this.input.override ? 'sim' : 'nao'}`
          + ` modo=${this.player.mode} vault=${c.vaultProgress.toFixed(2)}`
      })(),
      oclusao: (() => {
        const cam = this.engine.camera.position
        const alvo = new THREE.Vector3(pos.x, pos.y + 0.12, pos.z)
        const dir = alvo.clone().sub(cam)
        const dist = dir.length()
        dir.normalize()
        const rc = new THREE.Raycaster(cam, dir, 0.05, dist - 0.05)
        const hits = rc.intersectObject(this.world.root, true)
          .filter((h) => h.object !== this.player.character.group)
        if (hits.length === 0) return `livre (d=${dist.toFixed(1)})`
        return hits.slice(0, 3)
          .map((h) => `${h.object.name || h.object.type}@${h.distance.toFixed(1)}y=${h.point.y.toFixed(2)}`)
          .join(' | ')
      })(),
    }
  }

  dispose(): void {
    this.stop()
    window.removeEventListener('resize', this.onResize)
    this.input.dispose()
    this.world.dispose()
    this.materials.dispose()
    this.engine.dispose()
  }
}

function clamp(v: number): number {
  return Math.max(-MAP_HALF + 20, Math.min(MAP_HALF - 20, v))
}

export function formatHour(h: number): string {
  const hh = Math.floor(h) % 24
  const mm = Math.floor((h - Math.floor(h)) * 60)
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function frame(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => r()))
}
