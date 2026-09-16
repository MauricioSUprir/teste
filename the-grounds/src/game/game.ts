/**
 * Jogo: laço principal, integração dos sistemas e estado da sessão.
 */

import * as THREE from 'three'
import { damp } from '../core/math'
import { Engine } from '../core/engine'
import { Input } from '../core/input'
import {
  applyPreset, loadSettings, sanitizeSettings, saveSettings,
  type QualityPreset, type Settings,
} from '../core/settings'
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
import { InteriorManager } from '../world/interiors'

export interface GameStats {
  fps: number
  frameMs: number
  /** Intervalo real entre quadros, em ms — a leitura honesta de fluidez. */
  quadroMs: number
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
  /** Estado da partida em andamento (diagnóstico). */
  futebol: string
  /** Custo em ms por subsistema, média móvel (diagnóstico de fluidez). */
  perfil: string
}

/** Uma escolha contextual apresentada no HUD (ex.: jogar ou treinar). */
export interface OpcaoContexto {
  rotulo: string
  descricao?: string
  executar: () => string | void
}

export interface EscolhaContexto {
  titulo: string
  opcoes: OpcaoContexto[]
  indice: number
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
  readonly interiores: InteriorManager
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
  /** Cache dos edifícios ao redor, recalculado por tempo e por deslocamento. */
  private vizinhos: import('../world/buildings').BuildingSpec[] = []
  private vizinhosTimer = 0
  private readonly vizinhosOnde = new THREE.Vector3(1e6, 0, 1e6)
  /** Luz e direção do sol da última atualização do mapa de ambiente. */
  private envLuz = -1
  private readonly envSol = new THREE.Vector3()
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
    this.input.perfilApontador = this.settings.gameplay.pointerProfile
    this.input.suavizacaoOlhar = this.settings.gameplay.lookSmoothing

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
    this.interiores = new InteriorManager(this.materials, this.world.root, this.world.collision)
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

    // Só o que está ao redor do jogador precisa estar pronto para entrar. O
    // resto do horizonte continua sendo construído com o jogo já rodando, pelo
    // orçamento adaptativo do laço — que é exatamente para isso que ele existe.
    const faltam0 = Math.max(1, this.world.pendingNearSectors())
    let guard = 0
    while (this.world.pendingNearSectors() > 0 && guard < 400) {
      this.world.processBuildQueue(28)
      guard++
      const faltam = this.world.pendingNearSectors()
      onProgress?.(0.05 + 0.55 * (1 - faltam / faltam0), 'Levantando a cidade')
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

  /** Erros capturados no laço, expostos no diagnóstico. */
  ultimoErro = ''

  private loop = (): void => {
    if (!this.running) return
    this.raf = requestAnimationFrame(this.loop)
    const dt = Math.min(0.05, this.clock.getDelta())
    const t0 = performance.now()
    try {
      this.passo(dt, t0)
    } catch (e) {
      // Um sistema com defeito não pode derrubar o jogo inteiro: registra,
      // segue renderizando e deixa o problema visível no diagnóstico.
      this.ultimoErro = e instanceof Error ? `${e.message}` : String(e)
      console.error('[the-grounds] falha no laço:', e)
      try { this.engine.render(dt, performance.now() - t0) } catch { /* ignora */ }
      this.input.endFrame()
    }
  }

  /**
   * Queda automática de perfil.
   *
   * Nenhum jogador deveria precisar descobrir sozinho que o problema está nas
   * opções. Se o quadro fica bem acima do orçamento por alguns segundos
   * seguidos, o jogo desce um degrau de qualidade e avisa. Só desce: subir
   * sozinho produziria oscilação, e essa escolha é de quem joga.
   */
  private quedaTimer = 0
  private quedaFeitas = 0
  /** Mensagem para a interface quando o perfil cai sozinho. */
  avisoQualidade = ''

  private ajustarQualidade(dt: number): void {
    const ordem: QualityPreset[] = ['ultra', 'alto', 'medio', 'baixo']
    const i = ordem.indexOf(this.settings.graphics.preset)
    if (i < 0 || i >= ordem.length - 1 || this.quedaFeitas >= 3) return

    const alvo = 1000 / Math.max(30, this.settings.graphics.targetFps)
    // Espera a resolução dinâmica chegar no fundo antes de culpar o perfil:
    // se ainda há escala para ceder, o problema pode se resolver sozinho.
    const noFundo = this.engine.perf.renderScale <= this.settings.graphics.renderScale * 0.62
    if (this.engine.perf.frameMs > alvo * 1.6 && noFundo) {
      this.quedaTimer += dt
    } else {
      this.quedaTimer = Math.max(0, this.quedaTimer - dt * 0.5)
    }

    if (this.quedaTimer > 5) {
      this.quedaTimer = 0
      this.quedaFeitas++
      const novo = ordem[i + 1]
      this.applySettings({ ...this.settings, graphics: applyPreset(this.settings.graphics, novo) })
      this.avisoQualidade = `Gráficos reduzidos para "${novo}" para manter a fluidez.`
      this.interacoes.notificar(this.avisoQualidade, 6)
    }
  }

  /** Menu contextual aberto (jogar/treinar, por exemplo), ou null. */
  escolha: EscolhaContexto | null = null

  /** Abre um menu de escolha; o movimento fica suspenso enquanto ele estiver aberto. */
  abrirEscolha(titulo: string, opcoes: OpcaoContexto[]): void {
    if (opcoes.length === 0) return
    this.escolha = { titulo, opcoes, indice: 0 }
  }

  fecharEscolha(): void { this.escolha = null }

  /**
   * Navegação do menu contextual. Aceita as teclas de movimento, as setas e os
   * números; confirma em E/Enter e cancela em Esc.
   */
  private atualizarEscolha(): boolean {
    const e = this.escolha
    if (!e) return false
    const inp = this.input
    const desce = inp.isPressed('tras') || inp.teclaPressionada('ArrowDown')
    const sobe = inp.isPressed('frente') || inp.teclaPressionada('ArrowUp')
    if (desce) { e.indice = (e.indice + 1) % e.opcoes.length; this.audio.interface('mover') }
    if (sobe) { e.indice = (e.indice - 1 + e.opcoes.length) % e.opcoes.length; this.audio.interface('mover') }
    for (let i = 0; i < e.opcoes.length && i < 9; i++) {
      if (inp.teclaPressionada(`Digit${i + 1}`)) e.indice = i
    }
    if (inp.teclaPressionada('Escape')) {
      this.fecharEscolha()
      this.audio.interface('voltar')
      return true
    }
    if (inp.isPressed('interagir') || inp.teclaPressionada('Enter')) {
      const op = e.opcoes[e.indice]
      this.fecharEscolha()
      this.audio.interface('confirmar')
      const msg = op?.executar()
      if (msg) this.interacoes.notificar(msg)
    }
    return true
  }

  /**
   * Orçamento de construção de setores por quadro, em ms. Ele encolhe quando o
   * quadro está caro e volta a crescer quando sobra folga, para que o
   * carregamento do mundo nunca provoque engasgos visíveis.
   */
  private orcamentoConstrucao = 4.5

  /** Média móvel do custo de cada etapa do quadro, em ms. */
  private readonly perfil: Record<string, number> = {
    mundo: 0, jogador: 0, stream: 0, transito: 0, gente: 0,
    futebol: 0, vizinhos: 0, interior: 0, audio: 0, sombra: 0, render: 0,
  }

  /** Pior quadro visto em cada etapa nos últimos segundos. */
  private readonly picos: Record<string, number> = {}
  private picoDecay = 0

  /** Mede `fn`, acumula na média móvel e guarda o pico recente de `chave`. */
  private medir(chave: string, fn: () => void): void {
    const a = performance.now()
    fn()
    const d = performance.now() - a
    this.perfil[chave] = this.perfil[chave] * 0.9 + d * 0.1
    if (d > (this.picos[chave] ?? 0)) this.picos[chave] = d
  }

  private passo(dt: number, t0: number): void {

    this.input.update()
    const emMenu = this.atualizarEscolha()
    const allow = !this.paused && this.input.pointerLocked && !emMenu

    if (this.cinematica) {
      this.world.update(dt, this.cineAlvo, this.engine.fog, this.engine.sun, this.engine.hemi)
    } else if (!this.paused) {
      this.medir('mundo', () => {
        this.world.update(dt, this.player.position, this.engine.fog, this.engine.sun, this.engine.hemi)
      })
      this.medir('jogador', () => this.player.update(dt, this.input, allow))
      this.medir('stream', () => {
        this.world.updateStreaming(this.player.position)
        this.world.processBuildQueue(this.orcamentoConstrucao)
      })

      const folgadoParaNovos = this.engine.perf.frameMs
        < (1000 / Math.max(30, this.settings.graphics.targetFps)) * 1.25
      this.traffic.permitirNovos = folgadoParaNovos
      this.medir('transito', () => this.traffic.update(
        dt, this.player.position, this.settings.graphics.trafficDensity,
        this.world.trafficPhase, this.world.trafficAmber,
      ))
      this.crowd.permitirNovos = folgadoParaNovos
      this.medir('gente', () => this.crowd.update(
        dt, this.player.position, this.settings.graphics.pedestrianDensity,
        this.world.trafficPhase, this.world.hour,
      ))
      this.medir('futebol', () => {
        this.sincronizarJogadorNaPartida()
        this.partida?.update(dt)
        if (this.bolaLivre.mesh.visible && !this.partida) {
          this.bolaLivre.update(dt, this.world.collision, this.superficieBola)
        }
      })
      this.medir('vizinhos', () => {
        // A lista de edifícios ao redor muda pouco: refazê-la a cada quadro é
        // trabalho jogado fora.
        this.vizinhosTimer -= dt
        const p2 = this.player.position
        if (this.vizinhosTimer <= 0 || this.vizinhosOnde.distanceToSquared(p2) > 64) {
          this.vizinhosTimer = 0.5
          this.vizinhosOnde.copy(p2)
          this.vizinhos = this.world.buildingsNear(p2.x, p2.z, 48)
        }
      })
      this.medir('interior', () => {
        // Quando o quadro está caro o orçamento encolhe: o interior chega um
        // instante depois e ninguém percebe, mas a imagem não tranca.
        const alvo = 1000 / Math.max(30, this.settings.graphics.targetFps)
        const orcamento = this.engine.perf.frameMs < alvo * 1.2 ? 2.5 : 0.8
        this.interiores.atualizar(this.player.position, this.vizinhos, 26, 44, 6, orcamento)
        this.interiores.atualizarLuzes(this.world.sky.daylight)
      })
      this.atualizarInteracoes(dt)
      this.medir('audio', () => this.atualizarAudio(dt))

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

    this.medir('sombra', () => this.engine.updateSunShadow(
      this.cinematica ? this.cineAlvo : this.player.position,
      this.world.sky.sunDirection,
    ))
    // O mapa de ambiente é caro (render de cubo + convolução). Refazê-lo num
    // relógio fixo cria um engasgo periódico; aqui ele só é refeito quando a
    // luz mudou de verdade e o quadro tem folga para pagar a conta.
    this.envTimer -= dt
    if (this.envTimer <= 0) {
      const luzAtual = this.world.sky.daylight
      const sol = this.world.sky.sunDirection
      const mudou = Math.abs(luzAtual - this.envLuz) > 0.02
        || sol.dot(this.envSol) < 0.9986
      const folgado = this.engine.perf.frameMs < (1000 / Math.max(30, this.settings.graphics.targetFps)) * 1.15
      if (mudou && (folgado || this.envTimer < -6)) {
        this.envLuz = luzAtual
        this.envSol.copy(sol)
        this.envTimer = 2.5
        const env = this.engine.refreshEnvironment(this.world.sky.mesh, dt, true)
        if (env) this.materials.setEnvironment(env)
      } else if (!mudou) {
        this.envTimer = 1
      }
    }

    if (!this.paused) this.ajustarQualidade(dt)

    // Os picos envelhecem: interessa o pior quadro recente, não o da abertura.
    this.picoDecay -= dt
    if (this.picoDecay <= 0) {
      this.picoDecay = 4
      for (const k of Object.keys(this.picos)) this.picos[k] *= 0.5
    }

    // Ajusta o orçamento de streaming pela folga real do quadro anterior.
    const alvoMs = 1000 / Math.max(30, this.settings.graphics.targetFps)
    const folga = alvoMs - this.engine.perf.frameMs
    this.orcamentoConstrucao = Math.min(6, Math.max(0.6,
      this.orcamentoConstrucao + (folga > 1 ? 0.4 : -0.8)))

    this.cpuMs = performance.now() - t0
    this.medir('render', () => this.engine.render(dt, this.cpuMs))
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

      // Interiores montados: portas, interruptores, assentos, lojas…
      for (const { interior, ponto } of this.interiores.pontos()) {
        if (Math.hypot(ponto.x - p.x, ponto.z - p.z) > ponto.raio + 1) continue
        this.interacoes.registrar({
          kind: ponto.kind === 'balcao' ? 'loja' : ponto.kind,
          rotulo: ponto.rotulo,
          raio: ponto.raio,
          prioridade: 3,
          position: new THREE.Vector3(ponto.x, ponto.y, ponto.z),
          executar: () => this.executarPontoInterior(interior, ponto),
        })
      }

      if (this.player.mode === 'sentado') {
        this.interacoes.registrar({
          kind: 'levantar', rotulo: 'Levantar', raio: 99, prioridade: 9,
          position: p.clone(),
          executar: () => { this.player.levantar() },
        })
      }

      // Campo de futebol próximo
      const campo = this.world.nearestPitch(p.x, p.z)
      if (campo && campo.dist < 26) {
        const emTreino = this.partida?.treino === true
        this.interacoes.registrar({
          kind: 'campo',
          rotulo: this.partida
            ? (emTreino ? 'Encerrar treino' : 'Encerrar partida')
            : `Entrar em ${campo.pitch.name}`,
          raio: 26, prioridade: 0,
          position: new THREE.Vector3(campo.pitch.x, campo.pitch.y, campo.pitch.z),
          executar: () => {
            if (this.partida) {
              const r = emTreino ? this.resumoDoTreino() : 'Partida encerrada'
              this.encerrarPartida()
              return r
            }
            this.abrirEscolha(campo.pitch.name, [
              {
                rotulo: 'Partida 5 contra 5',
                descricao: 'Dois tempos de 3 minutos, com placar, goleiros e adversários.',
                executar: () => { this.iniciarPartida(campo.pitch.id, 5); return `${campo.pitch.name}` },
              },
              {
                rotulo: 'Treino livre',
                descricao: 'Campo só seu e o goleiro no gol. Sem relógio, bola sempre de volta ao pé.',
                executar: () => { this.iniciarTreino(campo.pitch.id); return 'Treino livre' },
              },
              {
                rotulo: 'Bater uma bola sozinho',
                descricao: 'Só a bola no gramado, sem goleiro e sem contagem.',
                executar: () => { this.soltarBola(); return 'Bola no gramado' },
              },
            ])
          },
        })
      }

      // No treino, E longe da bola traz a bola de volta ao pé.
      if (this.partida?.treino && this.partida.distanciaHumanoBola() > 4) {
        this.interacoes.registrar({
          kind: 'campo', rotulo: 'Trazer a bola', raio: 99, prioridade: 4,
          position: p.clone(),
          executar: () => { this.partida?.devolverBola() },
        })
      }
    }

    this.interacoes.atualizar(dt, p, f)
    if (this.input.isPressed('interagir') && !this.paused) {
      if (this.interacoes.acionar()) this.audio.interface('confirmar')
    }
  }

  /** Resolve a ação de um ponto de interação de interior. */
  private executarPontoInterior(
    interior: import('../world/interiors').InteriorConstruido,
    ponto: import('../world/interiors').PontoInterativo,
  ): string | void {
    switch (ponto.kind) {
      case 'interruptor':
        this.interiores.alternarLuz(interior)
        return interior.acesa ? 'Luz acesa' : 'Luz apagada'
      case 'sentar':
        this.player.sentar(ponto.x, this.world.surfaceHeight(ponto.x, ponto.z, ponto.y + 1), ponto.z, ponto.yaw ?? 0)
        return
      case 'cama':
        this.world.hour = 7.5
        return 'Você dormiu até as 7h30'
      case 'porta':
        this.audio.porta(true, ponto.x, ponto.y, ponto.z)
        return
      case 'guardaRoupa':
        return 'Guarda-roupa: personalize pelo menu de pausa'
      case 'geladeira':
        return 'Você comeu alguma coisa. Fôlego recuperado.'
      case 'espelho':
        return 'Espelho: personalize pelo menu de pausa'
      case 'tv':
        return 'A televisão está passando o jogo de sábado'
      case 'elevador':
        return 'Elevador em manutenção — por enquanto só o térreo é acessível'
      case 'loja':
      case 'balcao':
        return `${interior.spec.label ?? 'Estabelecimento'} — atendimento em breve`
      case 'maquina':
        return 'Garagem: guarde ou troque de veículo aqui'
      default:
        return
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
        superficieSonora(naRua, naCalcada, molhado, !!this.interiores.atual),
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
      rio: 0,
      interior: this.interiores.atual ? 1 : 0,
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
  iniciarPartida(pitchId: string, porLado = 5, modo: 'partida' | 'treino' = 'partida'): void {
    if (this.partida) this.encerrarPartida()
    const pitch = this.world.pitches.find((x) => x.id === pitchId)
    if (!pitch) return
    const cfg: MatchConfig = {
      pitch, porLado, duracao: 180, timeDoJogador: 0, dificuldade: 0.55, modo,
    }
    this.partida = new Match(cfg, this.world, this.world.collision, makeBallMaterial())
    this.partida.montar(this.player.character.aparencia, this.player.position.clone())
    // Leva o jogador para a posição de saída do time dele, olhando para o gol adversário.
    const h = this.partida.humano
    if (h) {
      const alvo = this.partida.golAdversario(h.team)
      const yaw = Math.atan2(alvo.x - h.position.x, alvo.z - h.position.z)
      this.player.teleport(h.position.x, h.position.z, yaw, pitch.y + 0.6)
      this.player.rig.yaw = yaw
    }
    this.player.mode = 'futebol'
    this.player.rig.setMode('futebol')
    this.bolaLivre.mesh.visible = false
    this.audio.apito()
  }

  /** Abre uma sessão de treino livre no campo indicado. */
  iniciarTreino(pitchId: string): void {
    this.iniciarPartida(pitchId, 5, 'treino')
  }

  /** Texto final de uma sessão de treino, para a mensagem do HUD. */
  private resumoDoTreino(): string {
    const r = this.partida?.resumoTreino
    if (!r) return 'Treino encerrado'
    if (r.chutes === 0) return 'Treino encerrado — nenhum chute'
    return `Treino: ${r.gols} gol(s) em ${r.chutes} chute(s)`
      + `, ${r.defesas} defesa(s), mais forte ${Math.round(r.maiorKmh)} km/h`
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
    this.input.perfilApontador = this.settings.gameplay.pointerProfile
    this.input.suavizacaoOlhar = this.settings.gameplay.lookSmoothing
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
      quadroMs: Number(p.realMs.toFixed(2)),
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
          + ` cam=(${this.engine.camera.position.x.toFixed(1)},${this.engine.camera.position.y.toFixed(1)},${this.engine.camera.position.z.toFixed(1)})`
          + ` fov=${this.engine.camera.fov.toFixed(1)} modoCam=${this.player.rig.mode}`
          + ` sol=${this.engine.sun.intensity.toFixed(2)}`
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
      futebol: (() => {
        const m = this.partida
        if (!m) return 'sem partida'
        const s2 = m.state
        const b = m.ball
        const h = m.humano
        const ult = m.jogadores.find((j) => j.id === m.ball.ultimoToque)
        const dono = ult ? `${ult.nome}(t${ult.team})` : '-'
        const dh = h ? Math.hypot(b.position.x - h.position.x, b.position.z - h.position.z) : -1
        return `${s2.fase} ${s2.placar[0]}x${s2.placar[1]} t=${s2.tempo.toFixed(0)}s p${s2.periodo}`
          + ` bola=(${b.position.x.toFixed(1)},${b.position.y.toFixed(1)},${b.position.z.toFixed(1)})`
          + ` v=${b.velocity.length().toFixed(1)} posse=${dono} dJog=${dh.toFixed(1)}`
          + ` jogadores=${m.jogadores.length} aviso="${s2.aviso}"`
          + (m.treino
            ? ` treino=${m.resumoTreino.gols}/${m.resumoTreino.chutes}`
              + ` def=${m.resumoTreino.defesas} maior=${Math.round(m.resumoTreino.maiorKmh)}km/h`
            : '')
      })(),
      perfil: Object.entries(this.perfil)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k}=${v.toFixed(1)}${(this.picos[k] ?? 0) > v * 2 + 1
          ? `(pico ${this.picos[k].toFixed(0)})` : ''}`)
        .join(' '),
    }
  }

  dispose(): void {
    this.stop()
    window.removeEventListener('resize', this.onResize)
    this.input.dispose()
    this.traffic.dispose()
    this.crowd.dispose()
    this.interiores.dispose()
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
