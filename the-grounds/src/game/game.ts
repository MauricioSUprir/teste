/**
 * Jogo: laço principal, integração dos sistemas e estado da sessão.
 */

import * as THREE from 'three'
import { damp } from '../core/math'
import { Engine } from '../core/engine'
import { Input } from '../core/input'
import { loadSettings, sanitizeSettings, saveSettings, type Settings } from '../core/settings'
import { MaterialLibrary, type WorldMaterialKey } from '../world/materials'
import { World } from '../world/world'
import { CDN_PRIORITY, CdnTextureLoader } from '../assets/cdnTextures'
import { Player } from './player'
import { defaultAppearance, type Appearance } from '../character/appearance'
import { MAP_HALF } from '../world/terrain'
import { Traffic } from '../vehicle/traffic'
import { makeVehicleMaterials, type VehicleMaterials } from '../vehicle/vehicle'
import { Crowd } from '../npc/crowd'
import { AudioManager, superficieSonora } from '../audio/audio'
import { InteractionSystem } from './interactions'
import { Ball, makeBallMaterial } from '../football/ball'
import { Match, type MatchConfig } from '../football/match'

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
  readonly traffic: Traffic
  readonly crowd: Crowd
  readonly audio: AudioManager
  readonly interacoes = new InteractionSystem()
  readonly vehicleMaterials: VehicleMaterials
  /** Bola livre para bater pelada em qualquer lugar. */
  readonly bolaLivre: Ball
  /** Partida em andamento, quando houver. */
  partida: Match | null = null
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
  /** Câmera cinematográfica usada como fundo do menu. */
  cinematica = false
  private cineT = 0
  private cineAlvo = new THREE.Vector3()
  private cineOlho = new THREE.Vector3()
  /** Pontos de sobrevoo do menu (marcos da cidade). */
  private cinePontos: { x: number; z: number; alt: number; raio: number }[] = [
    { x: -400, z: -378, alt: 34, raio: 86 },   // Vila Aurora (onde o jogo começa)
    { x: 0, z: -150, alt: 62, raio: 125 },     // Centro
    { x: 520, z: 330, alt: 40, raio: 108 },    // Campo Grande
    { x: -40, z: 520, alt: 32, raio: 104 },    // Parque da Enseada
    { x: 250, z: 60, alt: 44, raio: 112 },     // Beira do Sanhaço
  ]
  private cineIndice = 0

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

    const superficies = {
      surface: (x: number, z: number, fromY: number) => this.world.surfaceHeight(x, z, fromY),
      normal: (x: number, z: number, out: THREE.Vector3) => this.world.groundNormal(x, z, out),
    }
    this.vehicleMaterials = makeVehicleMaterials()
    this.traffic = new Traffic(
      this.world.layout, this.world.root, this.world.collision,
      this.vehicleMaterials, superficies,
    )
    this.crowd = new Crowd(this.world, this.world.layout, this.world.collision)
    this.audio = new AudioManager(this.settings.audio)

    this.bolaLivre = new Ball(makeBallMaterial())
    this.bolaLivre.mesh.visible = false
    this.world.root.add(this.bolaLivre.mesh)

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

    if (this.cinematica) {
      this.world.update(dt, this.cineAlvo, this.engine.fog, this.engine.sun, this.engine.hemi)
    } else if (!this.paused) {
      this.world.update(dt, this.player.position, this.engine.fog, this.engine.sun, this.engine.hemi)
      this.player.update(dt, this.input, allow)
      this.world.updateStreaming(this.player.position)
      this.world.processBuildQueue(4.5)

      this.traffic.update(
        dt, this.player.position, this.settings.graphics.trafficDensity,
        this.world.trafficPhase, this.world.trafficAmber,
      )
      this.crowd.update(
        dt, this.player.position, this.settings.graphics.pedestrianDensity,
        this.world.trafficPhase, this.world.hour,
      )
      this.sincronizarJogadorNaPartida()
      this.partida?.update(dt)
      if (this.bolaLivre.mesh.visible && !this.partida) {
        this.bolaLivre.update(dt, this.world.collision, this.superficieBola)
      }
      this.atualizarInteracoes(dt)
      this.atualizarAudio(dt)

      // Rede de segurança: fora do mapa ou preso, volta para um ponto seguro.
      const p = this.player.position
      if (Math.abs(p.x) > MAP_HALF + 40 || Math.abs(p.z) > MAP_HALF + 40 || p.y < -40) {
        const safe = this.world.findSafeSpot(clamp(p.x), clamp(p.z))
        this.player.teleport(safe.x, safe.z, this.player.controller.yaw)
      }
    } else {
      this.player.update(dt, this.input, false)
    }

    if (this.cinematica) this.atualizarCinematica(dt)

    this.engine.updateSunShadow(
      this.cinematica ? this.cineAlvo : this.player.position,
      this.world.sky.sunDirection,
    )
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

  /**
   * Sobrevoo lento para o fundo do menu: a câmera orbita marcos da cidade e
   * troca de ponto suavemente, sem cortes bruscos.
   */
  private atualizarCinematica(dt: number): void {
    this.cineT += dt
    const ponto = this.cinePontos[this.cineIndice]
    const duracao = 16
    if (this.cineT > duracao) {
      this.cineT = 0
      this.cineIndice = (this.cineIndice + 1) % this.cinePontos.length
    }
    const p = this.cinePontos[this.cineIndice]
    const t = this.cineT / duracao
    const ang = t * 0.9 + this.cineIndice * 1.7
    const base = this.world.groundHeight(p.x, p.z)
    this.cineAlvo.set(p.x, base + 12, p.z)
    this.cineOlho.set(
      p.x + Math.cos(ang) * p.raio,
      base + p.alt + Math.sin(this.cineT * 0.22) * 4,
      p.z + Math.sin(ang) * p.raio,
    )
    // Entrada e saída suaves entre pontos.
    const fade = Math.min(1, Math.min(this.cineT, duracao - this.cineT) / 2.2)
    const cam = this.engine.camera
    const lambda = 1.6 + fade * 1.4
    cam.position.x = damp(cam.position.x, this.cineOlho.x, lambda, dt)
    cam.position.y = damp(cam.position.y, this.cineOlho.y, lambda, dt)
    cam.position.z = damp(cam.position.z, this.cineOlho.z, lambda, dt)
    cam.lookAt(this.cineAlvo)
    this.engine.setFov(42)
    void ponto
    // Mantém o mundo carregado em torno do ponto observado.
    this.world.updateStreaming(this.cineAlvo)
    this.world.processBuildQueue(4)
  }

  /** Entra ou sai do modo de fundo do menu. */
  definirCinematica(ativo: boolean): void {
    this.cinematica = ativo
    if (ativo) {
      this.cineT = 0
      // Começa pelo marco mais próximo do que já está carregado, e coloca a
      // câmera direto na posição — sem isso o menu abriria olhando para nada.
      const p0 = this.player.position
      let melhor = 0
      let melhorD = Infinity
      this.cinePontos.forEach((p, i) => {
        const d = Math.hypot(p.x - p0.x, p.z - p0.z)
        if (d < melhorD) { melhorD = d; melhor = i }
      })
      this.cineIndice = melhor
      const p = this.cinePontos[melhor]
      const base = this.world.groundHeight(p.x, p.z)
      this.cineAlvo.set(p.x, base + 12, p.z)
      this.cineOlho.set(p.x + p.raio, base + p.alt, p.z)
      this.engine.camera.position.copy(this.cineOlho)
      this.engine.camera.lookAt(this.cineAlvo)
      this.world.updateStreaming(this.cineAlvo)
      this.player.character.setVisible(false)
    } else {
      this.player.character.setVisible(true)
      this.engine.setFov(this.settings.gameplay.fov)
      this.player.rig.snapTo({
        position: this.player.position,
        yaw: this.player.controller.yaw,
        speed: 0,
        height: this.player.character.height,
      })
    }
  }

  /** Consulta de superfície usada pela bola. */
  private superficieBola = {
    surface: (x: number, z: number, fromY: number) => this.world.surfaceHeight(x, z, fromY),
    normal: (x: number, z: number, out: THREE.Vector3) => this.world.groundNormal(x, z, out),
    kind: (x: number, z: number): 'grama' | 'cimento' | 'terra' | 'asfalto' | 'interno' => {
      if (this.world.layout.isOnRoad(x, z)) return 'asfalto'
      if (this.world.layout.isOnSidewalk(x, z)) return 'cimento'
      return 'grama'
    },
  }

  /** Recria a lista de interações próximas a cada quadro. */
  private atualizarInteracoes(dt: number): void {
    const p = this.player.position
    const f = this.player.rig.forward
    this.interacoes.limpar()

    if (this.player.mode === 'dirigindo' && this.player.veiculo) {
      const v = this.player.veiculo
      this.interacoes.registrar({
        kind: 'sairVeiculo', rotulo: 'Sair do veículo', raio: 99, prioridade: 5,
        position: v.position.clone(),
        executar: () => {
          if (!this.player.sairDoVeiculo()) return 'Reduza a velocidade para sair'
          this.audio.porta(true, v.position.x, v.position.y + 0.9, v.position.z)
          this.audio.pararMotor(1)
        },
      })
    } else {
      const v = this.traffic.veiculoProximo(p.x, p.z, 4.2)
      if (v) {
        this.interacoes.registrar({
          kind: 'veiculo', rotulo: `Entrar no ${v.spec.nome}`, raio: 4.2, prioridade: 2,
          position: v.position.clone(),
          executar: () => {
            this.traffic.liberar(v)
            if (this.player.entrarNoVeiculo(v)) {
              this.audio.porta(false, v.position.x, v.position.y + 0.9, v.position.z)
              return `${v.spec.nome}`
            }
          },
        })
      }

      const pessoa = this.crowd.maisProxima(p.x, p.z, 3.2)
      if (pessoa) {
        this.interacoes.registrar({
          kind: 'pessoa', rotulo: `Falar com ${pessoa.nome}`, raio: 3.2, prioridade: 1,
          position: pessoa.position.clone(),
          executar: () => {
            pessoa.state = 'conversando'
            pessoa.stateTimer = 8
            pessoa.action = 'conversa'
            this.player.playAction('conversa')
            return `${pessoa.nome}: ${falaDe(pessoa.assunto)}`
          },
        })
      }

      // Campo de futebol próximo
      const campo = this.world.nearestPitch(p.x, p.z)
      if (campo && campo.dist < 26) {
        this.interacoes.registrar({
          kind: 'campo', rotulo: this.partida ? 'Encerrar partida' : `Jogar em ${campo.pitch.name}`,
          raio: 26, prioridade: 0,
          position: new THREE.Vector3(campo.pitch.x, campo.pitch.y, campo.pitch.z),
          executar: () => {
            if (this.partida) { this.encerrarPartida(); return 'Partida encerrada' }
            this.iniciarPartida(campo.pitch.id)
            return `${campo.pitch.name}`
          },
        })
      }
    }

    this.interacoes.atualizar(dt, p, f)
    if (this.input.isPressed('interagir') && !this.paused) {
      if (this.interacoes.acionar()) this.audio.interface('confirmar')
    }
  }

  private atualizarAudio(dt: number): void {
    if (!this.audio.iniciado) return
    const cam = this.engine.camera
    const f = this.player.rig.forward
    this.audio.atualizarEscuta(cam.position, f, new THREE.Vector3(0, 1, 0))

    const p = this.player.position
    const naRua = this.world.layout.isOnRoad(p.x, p.z)
    const naCalcada = this.world.layout.isOnSidewalk(p.x, p.z)
    const molhado = this.world.weather.wetness > 0.35

    if (this.player.mode !== 'dirigindo') {
      this.audio.atualizarPassos(
        dt, this.player.controller.speed, this.player.controller.grounded,
        superficieSonora(naRua, naCalcada, molhado, false),
        p.x, p.y, p.z,
      )
    } else if (this.player.veiculo) {
      const v = this.player.veiculo
      const rpm = Math.min(1, Math.abs(v.forwardSpeed) / 32)
      this.audio.motor(1, rpm, this.player.entradaVeiculo.acelerador, 0, true)
      if (this.player.entradaVeiculo.buzina && Math.random() < dt * 4) {
        this.audio.buzina(v.position.x, v.position.y + 0.8, v.position.z)
      }
    }

    const perto = this.crowd.count
    this.audio.definirAmbiente({
      vento: 0.4 + this.world.weather.windSpeed * 0.5,
      trafego: Math.min(1, this.traffic.count / 14),
      murmurio: Math.min(1, perto / 18),
      chuva: this.world.weather.rain,
      rio: Math.max(0, 1 - Math.min(1, Math.hypot(p.x, p.z) / 500)) * 0,
      interior: 0,
    })
    this.audio.atualizar(dt, {
      chuva: this.world.weather.rain,
      vegetacao: 0.6,
      dia: this.world.sky.daylight,
    })

    // Impactos da bola
    const bola = this.partida?.ball ?? this.bolaLivre
    for (const i of bola.impactos) {
      const tipo = i.tipo === 'trave' ? 'trave' : i.tipo === 'jogador' ? 'chute' : 'quique'
      this.audio.bola(tipo, i.forca, i.x, i.y, i.z)
    }
  }

  /**
   * O jogador humano é movido pelo controlador comum; a partida só precisa
   * conhecer sua posição, orientação e ação para resolver o toque na bola.
   */
  private sincronizarJogadorNaPartida(): void {
    const m = this.partida
    if (!m || !m.humano) return
    const h = m.humano
    const c = this.player.controller
    h.position.copy(c.position)
    h.yaw = c.yaw
    h.speed = c.speed
    h.action = this.player.currentAction
    h.actionTime = this.player.actionProgress * 0.6
    // A mira do chute do jogador vem da câmera, não da formação.
    h.destino.copy(c.position).addScaledVector(this.player.miraPlano, 14)
    m.potenciaHumano = this.player.potenciaChute
  }

  /** Inicia uma partida no campo indicado. */
  iniciarPartida(pitchId: string, porLado = 5): void {
    if (this.partida) this.encerrarPartida()
    const pitch = this.world.pitches.find((x) => x.id === pitchId)
    if (!pitch) return
    const cfg: MatchConfig = {
      pitch, porLado, duracao: 180, timeDoJogador: 0, dificuldade: 0.55,
    }
    this.partida = new Match(cfg, this.world, this.world.collision, makeBallMaterial())
    this.partida.montar(this.player.character.aparencia, this.player.position.clone())
    this.player.mode = 'futebol'
    this.player.rig.setMode('futebol')
    this.bolaLivre.mesh.visible = false
    this.audio.apito()
  }

  encerrarPartida(): void {
    this.partida?.encerrar()
    this.partida = null
    this.player.mode = 'aPe'
    this.player.rig.setMode(this.player.cameraOnFoot)
  }

  /** Coloca uma bola livre à frente do jogador (pelada de rua). */
  soltarBola(): void {
    const p = this.player.position
    const f = this.player.miraPlano
    this.bolaLivre.reset(p.x + f.x * 1.4, p.y + 0.4, p.z + f.z * 1.4)
    this.bolaLivre.mesh.visible = true
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
    this.audio.aplicarSettings(this.settings.audio)
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
    this.traffic.dispose()
    this.crowd.dispose()
    this.partida?.encerrar()
    this.audio.dispose()
    this.world.dispose()
    this.materials.dispose()
    this.engine.dispose()
  }
}

const FALAS = [
  'O campo da vila enche depois das seis.',
  'Tá bom o dia, hein? Aproveita.',
  'Se for pro centro, vai de ônibus. Trânsito hoje tá pesado.',
  'A padaria da esquina abre cedo, vale a pena.',
  'Ouvi dizer que vai chover mais tarde.',
  'Meu time joga sábado na arena. Aparece lá.',
  'Cuidado pra atravessar aí, o pessoal não respeita a faixa.',
  'Bonito esse tempo, né? Bom pra bater uma bola.',
]

function falaDe(i: number): string {
  return FALAS[i % FALAS.length]
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
