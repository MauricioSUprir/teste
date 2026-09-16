/**
 * Futebol jogável: jogadores controlados por IA, goleiros, partida reduzida
 * com placar e tempo, além do treino livre.
 *
 * O jogador humano usa o mesmo controlador de personagem do resto do jogo; os
 * bots usam uma máquina de decisão avaliada algumas vezes por segundo, com
 * posicionamento por formação, marcação, passe e chute.
 */

import * as THREE from 'three'
import { clamp, damp, dampAngle, makeRng, randRange, type Rng } from '../core/math'
import { Character } from '../character/character'
import { randomAppearance, type Appearance } from '../character/appearance'
import { ACTION_CONTACT, ACTION_DURATION, type ActionKind } from '../character/animation'
import type { PitchSpec } from '../world/blocks'
import type { CollisionWorld } from '../world/collision'
import type { World } from '../world/world'
import { Ball, BALL_RADIUS, type BallSurfaceQuery } from './ball'

export type Team = 0 | 1
export type Role = 'goleiro' | 'zagueiro' | 'meia' | 'atacante'

export type MatchPhase = 'aquecimento' | 'saida' | 'jogando' | 'gol' | 'intervalo' | 'fim'

export interface Footballer {
  id: number
  team: Team
  role: Role
  character: Character
  position: THREE.Vector3
  velocity: THREE.Vector3
  yaw: number
  speed: number
  /** Posição de referência na formação, em espaço do campo. */
  home: THREE.Vector2
  /** Alvo de deslocamento atual. */
  destino: THREE.Vector3
  action: ActionKind | null
  actionTime: number
  /** Cooldown de decisão. */
  pensar: number
  /** Impede tocar a bola logo após tocá-la. */
  travaToque: number
  rng: Rng
  /** True para o jogador humano. */
  humano: boolean
  /** Ação do quadro anterior, para saber quando uma ação nova começou. */
  acaoAnterior: ActionKind | null
  /** True depois que o contato desta ação já foi resolvido. */
  contatoFeito: boolean
  nome: string
  energia: number
}

export interface MatchConfig {
  pitch: PitchSpec
  /** Jogadores por lado, incluindo goleiro. */
  porLado: number
  /** Duração de cada tempo, em segundos. */
  duracao: number
  /** Time do jogador humano. */
  timeDoJogador: Team
  /** Dificuldade 0..1. */
  dificuldade: number
  /**
   * 'partida' é o jogo disputado com placar e tempo. 'treino' é a sessão livre
   * no campo: sem relógio, sem adversários de linha, bola sempre de volta ao
   * pé e um resumo do que você acertou.
   */
  modo?: 'partida' | 'treino'
}

/** Números de uma sessão de treino livre. */
export interface TreinoResumo {
  chutes: number
  gols: number
  /** Velocidade do chute mais forte que entrou, em km/h. */
  melhorKmh: number
  /** Chute mais forte tentado, em km/h. */
  maiorKmh: number
  /** Defesas do goleiro. */
  defesas: number
}

export interface MatchState {
  fase: MatchPhase
  placar: [number, number]
  tempo: number
  periodo: 1 | 2
  /** Time que reinicia a jogada. */
  saidaDe: Team
  /** Mensagem curta para a interface. */
  aviso: string
  avisoTimer: number
  ultimoGoleador: string
}

const CORES_TIME: [number, number][] = [
  [0xf2c230, 0x1f3f7a], // amarelo/azul
  [0xd83a3a, 0xf2f2f2], // vermelho/branco
]

export class Match {
  /** True quando a sessão é treino livre em vez de partida disputada. */
  get treino(): boolean { return this.config.modo === 'treino' }

  /** Números acumulados da sessão de treino. */
  readonly resumoTreino: TreinoResumo = {
    chutes: 0, gols: 0, melhorKmh: 0, maiorKmh: 0, defesas: 0,
  }

  /** Velocidade da bola no quadro anterior, para detectar um chute novo. */
  private velAnterior = 0
  /** Espera antes de devolver a bola ao jogador no treino. */
  private devolverEm = 0

  readonly state: MatchState = {
    fase: 'aquecimento', placar: [0, 0], tempo: 0, periodo: 1,
    saidaDe: 0, aviso: '', avisoTimer: 0, ultimoGoleador: '',
  }
  readonly jogadores: Footballer[] = []
  readonly ball: Ball
  readonly group = new THREE.Group()
  config: MatchConfig
  /** Jogador humano, quando participa. */
  humano: Footballer | null = null
  /** Potência do próximo contato do jogador humano (0..1). */
  potenciaHumano = 1
  private rng: Rng
  private nextId = 1
  private surfaces: BallSurfaceQuery
  private goalGuard = 0

  constructor(
    config: MatchConfig,
    private readonly world: World,
    private readonly collision: CollisionWorld,
    ballMaterial: THREE.Material,
    seed = 777,
  ) {
    this.config = config
    this.rng = makeRng(seed)
    this.ball = new Ball(ballMaterial)
    this.group.name = 'partida'
    this.group.add(this.ball.mesh)
    world.root.add(this.group)

    const kind = config.pitch.surface === 'grama' ? 'grama'
      : config.pitch.surface === 'cimento' ? 'cimento' : 'terra'
    this.surfaces = {
      surface: (x, z, fromY) => world.surfaceHeight(x, z, fromY),
      normal: (x, z, out) => world.groundNormal(x, z, out),
      kind: () => kind,
    }
  }

  // ------------------------------------------------------------------------
  // Montagem
  // ------------------------------------------------------------------------

  /** Converte coordenadas do campo (x ao longo, z transversal) para o mundo. */
  paraMundo(fx: number, fz: number, out = new THREE.Vector3()): THREE.Vector3 {
    const p = this.config.pitch
    const cos = Math.cos(p.yaw)
    const sin = Math.sin(p.yaw)
    return out.set(
      p.x + fx * cos - fz * sin,
      p.y,
      p.z + fx * sin + fz * cos,
    )
  }

  /** Converte mundo para coordenadas do campo. */
  paraCampo(x: number, z: number, out = new THREE.Vector2()): THREE.Vector2 {
    const p = this.config.pitch
    const cos = Math.cos(p.yaw)
    const sin = Math.sin(p.yaw)
    const dx = x - p.x
    const dz = z - p.z
    return out.set(dx * cos + dz * sin, -dx * sin + dz * cos)
  }

  /** Formação simples, escalada para o tamanho do campo. */
  private formacao(team: Team, index: number, total: number): THREE.Vector2 {
    const p = this.config.pitch
    const L = p.halfLength
    const W = p.halfWidth
    const lado = team === 0 ? -1 : 1
    if (index === 0) return new THREE.Vector2(lado * L * 0.93, 0)

    const linha = total <= 3 ? [0.35] : total <= 5 ? [0.55, 0.2] : [0.62, 0.28, 0.05]
    const campo = total - 1
    const porLinha = Math.ceil(campo / linha.length)
    const i = index - 1
    const l = Math.min(linha.length - 1, Math.floor(i / porLinha))
    const j = i % porLinha
    const n = Math.min(porLinha, campo - l * porLinha)
    const spread = n <= 1 ? 0 : ((j / (n - 1)) - 0.5) * 2
    return new THREE.Vector2(lado * L * linha[l], spread * W * 0.62)
  }

  /** Cria os elencos. `aparenciaHumano` define o visual do jogador. */
  montar(aparenciaHumano?: Appearance, posicaoHumano?: THREE.Vector3): void {
    const { porLado, timeDoJogador } = this.config
    for (const team of [0, 1] as Team[]) {
      // No treino o campo fica livre: só você e o goleiro do outro lado.
      const nesteTime = this.treino ? (team === timeDoJogador ? 2 : 1) : porLado
      // Você joga na frente: começar como zagueiro deixaria a partida inteira
      // acontecendo a trinta metros de distância.
      const idxHumano = Math.max(1, nesteTime - 1)
      for (let i = 0; i < nesteTime; i++) {
        const humano = team === timeDoJogador && i === idxHumano && !!aparenciaHumano
        const role: Role = i === 0 ? 'goleiro'
          : i <= Math.ceil((porLado - 1) / 3) ? 'zagueiro'
            : i <= Math.ceil(((porLado - 1) * 2) / 3) ? 'meia' : 'atacante'

        const seed = Math.floor(this.rng() * 1e9)
        const app = humano && aparenciaHumano ? { ...aparenciaHumano } : randomAppearance(seed)
        app.torso = 'uniforme'
        app.pernas = 'shortEsportivo'
        app.pes = 'chuteira'
        app.corTorso = CORES_TIME[team][0]
        app.corTorsoSec = CORES_TIME[team][1]
        app.corPernas = team === 0 ? 0x1f3f7a : 0xf2f2f2
        app.corMeias = CORES_TIME[team][0]
        app.numero = i + 1
        if (role === 'goleiro') { app.corTorso = 0x2fa85a; app.corTorsoSec = 0x1a1a1a }

        const character = new Character(app, { castShadow: true, lod: 'medio' })
        const home = this.formacao(team, i, this.treino ? Math.max(2, nesteTime) : porLado)
        const pos = this.paraMundo(home.x, home.y)
        character.setPosition(pos.x, pos.y, pos.z)
        this.group.add(character.group)

        const f: Footballer = {
          id: this.nextId++,
          team, role, character,
          position: pos.clone(),
          velocity: new THREE.Vector3(),
          yaw: team === 0 ? Math.PI / 2 : -Math.PI / 2,
          speed: 0,
          home,
          destino: pos.clone(),
          action: null,
          actionTime: 0,
          pensar: this.rng() * 0.3,
          travaToque: 0,
          rng: makeRng(seed ^ 0x2a2a),
          humano,
          acaoAnterior: null,
          contatoFeito: false,
          nome: humano ? 'Você' : `#${i + 1}`,
          energia: 1,
        }
        this.jogadores.push(f)
        if (humano) {
          this.humano = f
          if (posicaoHumano) f.position.copy(posicaoHumano)
        }
      }
    }
    this.reposicionar(0)
    if (this.treino) {
      this.state.fase = 'jogando'
      this.posicionarTreino()
      this.aviso('Treino livre — chute à vontade', 3)
    } else {
      this.state.fase = 'saida'
      this.aviso('Bola ao centro', 2)
    }
  }

  /**
   * Coloca a bola e o jogador numa posição de finalização: bola à frente, gol
   * adversário na direção do olhar. É o que o treino repete a cada gol ou a
   * cada bola perdida.
   */
  private posicionarTreino(): void {
    const h = this.humano
    if (!h) return
    const p = this.config.pitch
    const lado = h.team === 0 ? 1 : -1
    // Distância de finalização sorteada, entre a entrada da área e o meio.
    const dist = p.halfLength * (0.30 + this.rng() * 0.34)
    const desvio = (this.rng() - 0.5) * p.halfWidth * 1.1
    const pos = this.paraMundo(lado * (p.halfLength - dist), desvio)
    h.position.copy(pos)
    h.velocity.set(0, 0, 0)
    h.speed = 0
    const alvo = this.golAdversario(h.team)
    h.yaw = Math.atan2(alvo.x - pos.x, alvo.z - pos.z)
    // 1,2 m: dentro do alcance de toque, para o primeiro chute sair sem que o
    // jogador precise caminhar até a bola.
    const frente = this.paraMundo(lado * (p.halfLength - dist + 1.2), desvio)
    this.ball.reset(frente.x, frente.y + BALL_RADIUS + 0.02, frente.z)
    this.ball.ultimoToque = 0
    this.devolverEm = 0
  }

  /** Recoloca só a bola à frente do jogador, sem mover ninguém. */
  devolverBola(): void {
    const h = this.humano
    if (!h) return
    const alvo = this.golAdversario(h.team)
    const dx = alvo.x - h.position.x
    const dz = alvo.z - h.position.z
    const n = Math.hypot(dx, dz) || 1
    const y = this.world.surfaceHeight(h.position.x + (dx / n) * 1.2, h.position.z + (dz / n) * 1.2,
      h.position.y + 1.2)
    this.ball.reset(h.position.x + (dx / n) * 1.2, y + BALL_RADIUS + 0.02, h.position.z + (dz / n) * 1.2)
    this.ball.ultimoToque = 0
    this.devolverEm = 0
  }

  /** Coloca todos na formação e a bola no centro. */
  reposicionar(saidaDe: Team): void {
    for (const f of this.jogadores) {
      const p = this.paraMundo(f.home.x, f.home.y)
      f.position.copy(p)
      f.velocity.set(0, 0, 0)
      f.speed = 0
      f.destino.copy(p)
      f.action = null
      f.yaw = f.team === 0 ? Math.PI / 2 : -Math.PI / 2
      // Corrige a orientação: o gol adversário fica no sentido do campo.
      const alvo = this.golAdversario(f.team)
      f.yaw = Math.atan2(alvo.x - p.x, alvo.z - p.z)
    }
    const c = this.paraMundo(0, 0)
    this.ball.reset(c.x, c.y + BALL_RADIUS + 0.02, c.z)
    this.state.saidaDe = saidaDe

    // Quem bate a saída fica atrás da bola. Sem isso o jogador humano nasce na
    // própria linha defensiva e a partida começa com uma corrida de trinta
    // metros atrás de uma bola que os bots já pegaram.
    const batedor = this.humano && this.humano.team === saidaDe
      ? this.humano
      : this.jogadores.find((j) => j.team === saidaDe && j.role !== 'goleiro')
    if (batedor) {
      const golAdv = this.golAdversario(batedor.team)
      const dx = golAdv.x - c.x
      const dz = golAdv.z - c.z
      const n = Math.hypot(dx, dz) || 1
      const pos = new THREE.Vector3(c.x - (dx / n) * 1.9, c.y, c.z - (dz / n) * 1.9)
      pos.y = this.world.surfaceHeight(pos.x, pos.z, pos.y + 1.2)
      batedor.position.copy(pos)
      batedor.destino.copy(pos)
      batedor.yaw = Math.atan2(dx, dz)
    }
    this.goalGuard = 1.2
  }

  /** Centro do gol que o time `team` ataca. */
  golAdversario(team: Team, out = new THREE.Vector3()): THREE.Vector3 {
    const L = this.config.pitch.halfLength
    return this.paraMundo(team === 0 ? L : -L, 0, out)
  }

  /** Centro do gol que o time `team` defende. */
  golProprio(team: Team, out = new THREE.Vector3()): THREE.Vector3 {
    const L = this.config.pitch.halfLength
    return this.paraMundo(team === 0 ? -L : L, 0, out)
  }

  aviso(texto: string, segundos: number): void {
    this.state.aviso = texto
    this.state.avisoTimer = segundos
  }

  // ------------------------------------------------------------------------
  // Laço
  // ------------------------------------------------------------------------

  update(dt: number): void {
    const s = this.state
    s.avisoTimer = Math.max(0, s.avisoTimer - dt)
    this.goalGuard = Math.max(0, this.goalGuard - dt)

    if (this.treino) {
      s.tempo += dt
      this.atualizarTreino(dt)
    } else if (s.fase === 'jogando') {
      s.tempo += dt
      if (s.tempo >= this.config.duracao) {
        if (s.periodo === 1) {
          s.periodo = 2
          s.tempo = 0
          this.reposicionar(1)
          s.fase = 'saida'
          this.aviso('Segundo tempo', 2.5)
        } else {
          s.fase = 'fim'
          this.aviso(s.placar[0] === s.placar[1] ? 'Empate' : (s.placar[0] > s.placar[1] ? 'Time amarelo venceu' : 'Time vermelho venceu'), 6)
        }
      }
    } else if (s.fase === 'saida' && s.avisoTimer <= 0) {
      s.fase = 'jogando'
    } else if (s.fase === 'gol' && s.avisoTimer <= 0) {
      this.reposicionar(s.saidaDe)
      s.fase = 'saida'
      this.aviso('Bola ao centro', 1.6)
    }

    this.ball.update(dt, this.collision, this.surfaces)

    for (const f of this.jogadores) {
      f.travaToque = Math.max(0, f.travaToque - dt)
      if (!f.humano) this.pensarBot(dt, f)
      this.moverJogador(dt, f)
      this.resolverToque(f)
      this.animar(dt, f)
    }

    this.checarGol()
    this.checarLimites()
  }

  /**
   * Contabiliza a sessão de treino: conta cada chute pela aceleração súbita da
   * bola, marca a defesa quando o goleiro devolve e traz a bola de volta ao pé
   * quando ela morre longe.
   */
  private atualizarTreino(dt: number): void {
    const v = this.ball.velocity.length()
    const h = this.humano
    if (h) {
      // Um salto grande de velocidade com a bola perto do jogador é um chute.
      const perto = this.ball.position.distanceTo(h.position) < 2.6
      if (perto && v > this.velAnterior + 4 && v > 7) {
        this.resumoTreino.chutes++
        this.resumoTreino.maiorKmh = Math.max(this.resumoTreino.maiorKmh, v * 3.6)
      }
    }
    // Defesa: o goleiro adversário tocou na bola depois de um chute forte.
    const ult = this.jogadores.find((j) => j.id === this.ball.ultimoToque)
    if (ult && ult.role === 'goleiro' && h && ult.team !== h.team && this.velAnterior > 9 && v < this.velAnterior) {
      this.resumoTreino.defesas++
      this.ball.ultimoToque = 0
      this.aviso('Defesa do goleiro', 1.4)
    }
    this.velAnterior = v

    if (this.devolverEm > 0) {
      this.devolverEm -= dt
      if (this.devolverEm <= 0) this.posicionarTreino()
      return
    }
    // Bola parada e longe: devolve sozinha, ninguém quer correr atrás.
    if (h && v < 0.6 && this.ball.position.distanceTo(h.position) > 22) {
      this.devolverEm = 0.6
    }
  }

  /** Impede que a bola saia do mundo do campo (linhas laterais suaves). */
  private checarLimites(): void {
    const p = this.config.pitch
    const b = this.paraCampo(this.ball.position.x, this.ball.position.z)
    const margemL = p.halfLength + 6
    const margemW = p.halfWidth + 5
    if (Math.abs(b.x) > margemL || Math.abs(b.y) > margemW) {
      const cx = clamp(b.x, -p.halfLength * 0.8, p.halfLength * 0.8)
      const cz = clamp(b.y, -p.halfWidth * 0.8, p.halfWidth * 0.8)
      if (this.treino) {
        this.devolverBola()
        this.aviso('Bola de volta', 1.2)
        return
      }
      const w = this.paraMundo(cx, cz)
      this.ball.reset(w.x, w.y + BALL_RADIUS + 0.02, w.z)
      this.aviso('Bola fora — reposição', 1.4)
    }
  }

  private checarGol(): void {
    if (this.state.fase !== 'jogando' || this.goalGuard > 0) return
    const p = this.config.pitch
    const b = this.paraCampo(this.ball.position.x, this.ball.position.z)
    const dentroDaMeta = Math.abs(b.y) < p.goalWidth / 2
    const altura = this.ball.position.y - p.y
    if (!dentroDaMeta || altura > p.goalHeight) return

    if (b.x > p.halfLength + BALL_RADIUS * 0.5) this.marcarGol(0)
    else if (b.x < -(p.halfLength + BALL_RADIUS * 0.5)) this.marcarGol(1)
  }

  private marcarGol(team: Team): void {
    if (this.treino) {
      const h = this.humano
      if (h && team === h.team) {
        this.resumoTreino.gols++
        this.resumoTreino.melhorKmh = Math.max(this.resumoTreino.melhorKmh, this.velAnterior * 3.6)
        this.aviso(`Gol! ${this.resumoTreino.gols} de ${this.resumoTreino.chutes}`
          + ` · ${Math.round(this.velAnterior * 3.6)} km/h`, 2.4)
      } else {
        this.aviso('Gol contra — bola de volta', 2)
      }
      this.goalGuard = 1.2
      this.devolverEm = 1.1
      return
    }
    this.state.placar[team]++
    this.state.fase = 'gol'
    this.state.saidaDe = team === 0 ? 1 : 0
    const autor = this.jogadores.find((j) => j.id === this.ball.ultimoToque)
    this.state.ultimoGoleador = autor ? autor.nome : ''
    this.aviso(`GOL! ${this.state.placar[0]} x ${this.state.placar[1]}`, 3.2)
    for (const f of this.jogadores) {
      if (f.team === team && !f.humano) { f.action = 'comemorar'; f.actionTime = 0 }
    }
  }

  // ------------------------------------------------------------------------
  // Inteligência dos bots
  // ------------------------------------------------------------------------

  private pensarBot(dt: number, f: Footballer): void {
    f.pensar -= dt
    if (f.pensar > 0) return
    f.pensar = 0.14 + f.rng() * 0.12

    const ball = this.ball.position
    const campoBola = this.paraCampo(ball.x, ball.z)
    const dificuldade = this.config.dificuldade

    if (f.role === 'goleiro') {
      this.pensarGoleiro(f, campoBola)
      return
    }

    const distBola = f.position.distanceTo(ball)
    const meuTime = this.jogadores.filter((j) => j.team === f.team && j.role !== 'goleiro')
    const maisPerto = meuTime.reduce((a, b) => (a.position.distanceTo(ball) < b.position.distanceTo(ball) ? a : b))
    const possePropria = this.ball.ultimoToque > 0
      && this.jogadores.find((j) => j.id === this.ball.ultimoToque)?.team === f.team

    // Com a bola nos pés
    if (distBola < 1.35 && f.travaToque <= 0) {
      this.decidirComBola(f, dificuldade)
      return
    }

    if (maisPerto === f && distBola < 26) {
      // Persegue, interceptando o movimento da bola.
      const lead = Math.min(0.9, distBola / 14)
      f.destino.set(
        ball.x + this.ball.velocity.x * lead,
        ball.y,
        ball.z + this.ball.velocity.z * lead,
      )
      return
    }

    // Posicionamento: acompanha a bola sem abandonar a função.
    const p = this.config.pitch
    const lado = f.team === 0 ? 1 : -1
    const avanco = possePropria ? 0.42 : 0.16
    const alvoX = clamp(
      f.home.x + campoBola.x * avanco + lado * (possePropria ? p.halfLength * 0.12 : -p.halfLength * 0.06),
      -p.halfLength * 0.95, p.halfLength * 0.95,
    )
    const alvoZ = clamp(f.home.y * 0.72 + campoBola.y * 0.42, -p.halfWidth * 0.92, p.halfWidth * 0.92)
    this.paraMundo(alvoX, alvoZ, f.destino)

    // Marcação: o defensor mais próximo cola no adversário com a bola.
    if (!possePropria && f.role !== 'atacante') {
      const portador = this.jogadores.find((j) => j.id === this.ball.ultimoToque)
      if (portador && portador.team !== f.team) {
        const d = f.position.distanceTo(portador.position)
        if (d < 18) {
          const golMeu = this.golProprio(f.team)
          f.destino.lerpVectors(portador.position, golMeu, 0.22)
        }
      }
    }
  }

  private decidirComBola(f: Footballer, dificuldade: number): void {
    const golAdv = this.golAdversario(f.team)
    const distGol = f.position.distanceTo(golAdv)
    const p = this.config.pitch

    // Chute
    const alcance = p.halfLength * 0.55 + dificuldade * 8
    if (distGol < alcance && this.linhaLivre(f.position, golAdv, f)) {
      this.executarAcao(f, distGol > alcance * 0.55 ? 'chuteForte' : 'chute')
      return
    }

    // Passe para o companheiro mais bem posicionado
    const opcoes = this.jogadores.filter(
      (j) => j.team === f.team && j !== f && j.role !== 'goleiro'
        && j.position.distanceTo(f.position) > 3.5 && j.position.distanceTo(f.position) < 26,
    )
    let melhor: Footballer | null = null
    let melhorNota = -Infinity
    for (const o of opcoes) {
      if (!this.linhaLivre(f.position, o.position, f)) continue
      const avancoGol = distGol - o.position.distanceTo(golAdv)
      const livre = this.espacoLivre(o)
      const nota = avancoGol * 1.2 + livre * 2.2 - o.position.distanceTo(f.position) * 0.08
      if (nota > melhorNota) { melhorNota = nota; melhor = o }
    }
    if (melhor && (melhorNota > 2.5 || f.rng() < 0.25)) {
      f.destino.copy(melhor.position)
      this.executarAcao(f, 'passe')
      return
    }

    // Conduz em direção ao gol, desviando de quem marca
    const dir = new THREE.Vector3().subVectors(golAdv, f.position).setY(0).normalize()
    const marcador = this.adversarioMaisProximo(f)
    if (marcador && f.position.distanceTo(marcador.position) < 2.6) {
      if (f.rng() < 0.35 + dificuldade * 0.25) {
        this.executarAcao(f, 'drible')
        const lateral = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(f.rng() < 0.5 ? 1 : -1)
        dir.addScaledVector(lateral, 1.1).normalize()
      }
    }
    f.destino.copy(f.position).addScaledVector(dir, 5.5)
  }

  private pensarGoleiro(f: Footballer, campoBola: THREE.Vector2): void {
    const p = this.config.pitch
    const lado = f.team === 0 ? -1 : 1
    const linha = lado * p.halfLength * 0.93
    // Acompanha a bola lateralmente, limitado à largura da meta.
    const alvoZ = clamp(campoBola.y * 0.55, -p.goalWidth * 0.85, p.goalWidth * 0.85)
    // Sai do gol quando a bola se aproxima muito.
    const distX = Math.abs(campoBola.x - linha)
    const avanco = distX < p.halfLength * 0.3 ? clamp(1 - distX / (p.halfLength * 0.3), 0, 1) * 3.4 : 0
    this.paraMundo(linha - lado * avanco * -1, alvoZ, f.destino)

    // Defesa: se a bola vem rápido e perto, mergulha.
    const ball = this.ball.position
    const d = f.position.distanceTo(ball)
    if (d < 3.2 && this.ball.velocity.length() > 6 && f.travaToque <= 0) {
      this.executarAcao(f, 'defesaGoleiro')
    } else if (d < 1.3 && f.travaToque <= 0) {
      this.executarAcao(f, 'passe')
      f.destino.copy(this.paraMundo(0, 0))
    }
  }

  private adversarioMaisProximo(f: Footballer): Footballer | null {
    let best: Footballer | null = null
    let bestD = Infinity
    for (const o of this.jogadores) {
      if (o.team === f.team) continue
      const d = o.position.distanceTo(f.position)
      if (d < bestD) { bestD = d; best = o }
    }
    return best
  }

  /** Quão livre está um jogador (distância ao adversário mais próximo). */
  private espacoLivre(f: Footballer): number {
    const o = this.adversarioMaisProximo(f)
    return o ? clamp(o.position.distanceTo(f.position) / 8, 0, 1.6) : 1.6
  }

  /** Verifica se não há adversário entre dois pontos. */
  private linhaLivre(de: THREE.Vector3, para: THREE.Vector3, quem: Footballer): boolean {
    const dx = para.x - de.x
    const dz = para.z - de.z
    const len = Math.hypot(dx, dz)
    if (len < 0.5) return true
    const ux = dx / len
    const uz = dz / len
    for (const o of this.jogadores) {
      if (o.team === quem.team || o === quem) continue
      const rx = o.position.x - de.x
      const rz = o.position.z - de.z
      const along = rx * ux + rz * uz
      if (along < 0.6 || along > len) continue
      const lateral = Math.abs(rx * uz - rz * ux)
      if (lateral < 1.05) return false
    }
    return true
  }

  // ------------------------------------------------------------------------
  // Movimento, toque e animação
  // ------------------------------------------------------------------------

  private moverJogador(dt: number, f: Footballer): void {
    if (f.humano) return  // o humano é movido pelo controlador do jogador

    const dx = f.destino.x - f.position.x
    const dz = f.destino.z - f.position.z
    const dist = Math.hypot(dx, dz)

    const base = f.role === 'goleiro' ? 4.4 : 6.2
    const alvo = dist < 0.6 ? 0 : clamp(dist * 1.6, 0.8, base) * (0.7 + this.config.dificuldade * 0.3) * f.energia
    f.speed = damp(f.speed, alvo, 5.5, dt)

    if (dist > 0.05) {
      const ux = dx / dist
      const uz = dz / dist
      f.position.x += ux * f.speed * dt
      f.position.z += uz * f.speed * dt
      f.yaw = dampAngle(f.yaw, Math.atan2(ux, uz), 9, dt)
    }

    // Separação entre jogadores
    for (const o of this.jogadores) {
      if (o === f) continue
      const ox = f.position.x - o.position.x
      const oz = f.position.z - o.position.z
      const d2 = ox * ox + oz * oz
      if (d2 < 0.55 && d2 > 1e-6) {
        const d = Math.sqrt(d2)
        const push = (0.75 - d) * 0.5
        f.position.x += (ox / d) * push
        f.position.z += (oz / d) * push
      }
    }

    // Mantém dentro do campo com folga
    const p = this.config.pitch
    const c = this.paraCampo(f.position.x, f.position.z)
    const lx = clamp(c.x, -p.halfLength - 2.5, p.halfLength + 2.5)
    const lz = clamp(c.y, -p.halfWidth - 2.5, p.halfWidth + 2.5)
    if (lx !== c.x || lz !== c.y) this.paraMundo(lx, lz, f.position)

    f.position.y = this.world.surfaceHeight(f.position.x, f.position.z, f.position.y + 0.8)
    f.energia = clamp(f.energia + (f.speed > 5 ? -dt * 0.012 : dt * 0.02), 0.62, 1)
  }

  /** Toque na bola: condução quando perto, impulso quando há ação. */
  private resolverToque(f: Footballer): void {
    const ball = this.ball
    const d = f.position.distanceTo(ball.position)

    // Ação nova: o contato dela ainda não foi resolvido.
    if (f.action !== f.acaoAnterior) {
      f.acaoAnterior = f.action
      f.contatoFeito = false
    }

    // Ação com contato programado (chute, passe, cabeceio).
    //
    // O instante do contato é testado por travamento, não por uma janela de um
    // quadro: com uma janela fixa de 1/60 s, qualquer taxa abaixo de 60 fps
    // passava por cima do contato e o chute simplesmente não saía.
    if (f.action && ACTION_CONTACT[f.action] !== undefined) {
      const dur = ACTION_DURATION[f.action]
      const contato = ACTION_CONTACT[f.action]!
      if (!f.contatoFeito && f.actionTime / dur >= contato && d < 2.0) {
        f.contatoFeito = true
        if (f.humano) {
          const mira = new THREE.Vector3().subVectors(f.destino, ball.position).setY(0)
          this.aplicarChute(f, f.action, mira, this.potenciaHumano)
        } else {
          this.aplicarChute(f, f.action)
        }
      }
      return
    }

    // Condução: a bola fica ligeiramente à frente dos pés.
    if (d < 1.15 && f.travaToque <= 0 && f.speed > 0.4) {
      const fx = Math.sin(f.yaw)
      const fz = Math.cos(f.yaw)
      const alvoX = f.position.x + fx * 0.85
      const alvoZ = f.position.z + fz * 0.85
      const dir = new THREE.Vector3(alvoX - ball.position.x, 0, alvoZ - ball.position.z)
      const len = dir.length()
      if (len > 0.02) {
        dir.divideScalar(len)
        ball.velocity.x = damp(ball.velocity.x, dir.x * (f.speed + len * 2.2), 10, 1 / 60)
        ball.velocity.z = damp(ball.velocity.z, dir.z * (f.speed + len * 2.2), 10, 1 / 60)
        ball.ultimoToque = f.id
        ball.tempoDesdeToque = 0
      }
    }
  }

  /** Converte a ação em impulso na bola. */
  aplicarChute(f: Footballer, kind: ActionKind, miraOverride?: THREE.Vector3, potencia = 1): void {
    const ball = this.ball
    const dir = new THREE.Vector3()
    if (miraOverride) dir.copy(miraOverride)
    else if (kind === 'passe' && f.destino) dir.subVectors(f.destino, ball.position)
    else dir.subVectors(this.golAdversario(f.team), ball.position)
    dir.y = 0
    if (dir.lengthSq() < 1e-6) dir.set(Math.sin(f.yaw), 0, Math.cos(f.yaw))
    dir.normalize()

    const precisao = f.humano ? 1 : (0.55 + this.config.dificuldade * 0.4)
    const erro = (1 - precisao) * randRange(f.rng, -0.16, 0.16)
    const cos = Math.cos(erro), sin = Math.sin(erro)
    const nx = dir.x * cos - dir.z * sin
    const nz = dir.x * sin + dir.z * cos
    dir.set(nx, 0, nz)

    let forca: number
    let elevacao: number
    switch (kind) {
      case 'chuteForte': forca = 285 * potencia; elevacao = 0.30; break
      case 'chute': forca = 190 * potencia; elevacao = 0.22; break
      case 'passe': forca = 105 * potencia; elevacao = 0.08; break
      case 'cabeceio': forca = 150 * potencia; elevacao = 0.35; break
      default: forca = 120 * potencia; elevacao = 0.16; break
    }
    dir.y = elevacao
    dir.normalize()

    // Efeito lateral proporcional ao ângulo do pé em relação ao corpo.
    const lateral = new THREE.Vector3(-dir.z, 0, dir.x)
    const curva = randRange(f.rng, -1, 1) * (f.humano ? 0.6 : 1.0) * 14
    const spin = lateral.multiplyScalar(0).setY(curva)

    ball.velocity.set(0, 0, 0)
    ball.aplicarImpulso(dir, forca, spin, f.id)
    f.travaToque = 0.42
  }

  private executarAcao(f: Footballer, kind: ActionKind): void {
    if (f.action) return
    f.action = kind
    f.actionTime = 0
  }

  private animar(dt: number, f: Footballer): void {
    if (f.action) {
      f.actionTime += dt
      if (f.actionTime >= ACTION_DURATION[f.action]) { f.action = null; f.actionTime = 0 }
    }
    const ch = f.character
    if (!f.humano) {
      ch.setPosition(f.position.x, f.position.y, f.position.z)
      ch.setYaw(f.yaw)
    }
    const inp = ch.input
    inp.speed = f.speed
    inp.runSpeed = 4.2
    inp.sprintSpeed = 6.6
    inp.grounded = true
    inp.forwardness = 1
    inp.action = f.action
    inp.actionProgress = f.action ? clamp(f.actionTime / ACTION_DURATION[f.action], 0, 1) : 0
    inp.comBola = this.ball.position.distanceTo(f.position) < 1.4
    if (!f.humano) {
      ch.ajustarDetalhe(this.humano ? f.position.distanceTo(this.humano.position) : 0)
      ch.update(dt, (x, z) => this.world.surfaceHeight(x, z, f.position.y + 0.8))
    }
  }

  /** Distância da bola ao jogador humano. */
  distanciaHumanoBola(): number {
    if (!this.humano) return Infinity
    return this.humano.position.distanceTo(this.ball.position)
  }

  encerrar(): void {
    for (const f of this.jogadores) {
      this.group.remove(f.character.group)
      f.character.dispose()
    }
    this.jogadores.length = 0
    this.ball.dispose()
    this.world.root.remove(this.group)
  }
}
