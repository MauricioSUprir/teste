/**
 * Aplicação: monta a tela de carregamento, o menu, o editor de personagem e a
 * sessão de jogo, cuidando das transições entre eles.
 */

import { Game } from './game/game'
import { Hud } from './ui/hud'
import { CharacterCreator } from './ui/creator'
import { SettingsScreen } from './ui/settings'
import { CreditsScreen, LoadScreen, MainMenu, PauseMenu, type AcaoMenu } from './ui/menu'
import { el } from './ui/dom'
import {
  gravar, ler, apagar, progressoInicial, resumos, saveDisponivel,
  type ProgressoJogo,
} from './save/save'
import { defaultAppearance, type Appearance } from './character/appearance'
import * as THREE from 'three'

export const VERSAO = '0.9.0'

type Estado = 'carregando' | 'menu' | 'editor' | 'jogando' | 'pausa'

/** Ponto de partida do jogador: a casa inicial, no bairro Vila Aurora. */
const SPAWN = { x: -388, z: -364 }

export class App {
  private raiz: HTMLElement
  private jogo!: Game
  private hud!: Hud
  private estado: Estado = 'carregando'
  private telaAtual: HTMLElement | null = null
  private menu!: MainMenu
  private creator: CharacterCreator | null = null
  private settingsScreen: SettingsScreen | null = null
  private aparencia: Appearance = defaultAppearance()
  private progresso: ProgressoJogo = progressoInicial()
  private slotAtual = 0
  private podeSalvar = saveDisponivel()
  private tempoSessao = 0
  private ultimaPos = new THREE.Vector3()

  constructor(private readonly canvas: HTMLCanvasElement, raiz: HTMLElement) {
    this.raiz = raiz
  }

  async iniciar(): Promise<void> {
    const carregando = this.telaCarregando()
    this.raiz.appendChild(carregando.root)

    this.jogo = new Game(this.canvas, this.aparencia)
    this.hud = new Hud(this.jogo)
    this.hud.montar(this.raiz)
    this.hud.root.style.display = 'none'

    await this.jogo.prepare(SPAWN.x, SPAWN.z, (p, texto) => carregando.progresso(p, texto))
    this.jogo.definirCinematica(true)
    this.jogo.start()

    carregando.root.remove()
    this.abrirMenu()

    window.addEventListener('keydown', this.onKey)
    // O áudio precisa de um gesto do usuário para começar.
    const liberar = () => {
      this.jogo.audio.iniciar()
      this.jogo.audio.retomar()
      window.removeEventListener('pointerdown', liberar)
      window.removeEventListener('keydown', liberar)
    }
    window.addEventListener('pointerdown', liberar)
    window.addEventListener('keydown', liberar)

    this.laçoInterface()
  }

  // ----------------------------------------------------------------------
  // Telas
  // ----------------------------------------------------------------------

  private telaCarregando() {
    const barra = el('i')
    const etapa = el('div', { class: 'etapa', text: 'Iniciando' })
    const root = el('div', { id: 'carregando' }, [
      el('div', { class: 'titulo', text: 'THE GROUNDS' }),
      el('div', { class: 'sub', text: 'Vila Preciosa' }),
      el('div', { class: 'trilho' }, [barra]),
      etapa,
    ])
    return {
      root,
      progresso: (p: number, texto: string) => {
        barra.style.width = `${Math.round(p * 100)}%`
        etapa.textContent = texto
      },
    }
  }

  private trocarTela(nova: HTMLElement | null): void {
    if (this.telaAtual) this.telaAtual.remove()
    this.telaAtual = nova
    if (nova) this.raiz.appendChild(nova)
  }

  private abrirMenu(): void {
    this.estado = 'menu'
    this.jogo.paused = true
    this.jogo.definirCinematica(true)
    this.hud.root.style.display = 'none'
    this.jogo.input.exitPointerLock()

    const temSave = resumos((x, z) => this.jogo.world.districtName(x, z)).some((r) => r.existe)
    this.menu = new MainMenu((id) => this.acaoMenu(id), VERSAO)
    this.menu.definirOpcoes([
      { id: 'novo', titulo: 'Novo jogo', descricao: 'Começar na rua, em Vila Aurora', disponivel: true },
      {
        id: 'continuar', titulo: 'Continuar',
        descricao: 'Retomar de onde parou', disponivel: temSave && this.podeSalvar,
        motivo: this.podeSalvar ? 'Nenhum jogo salvo ainda' : 'Armazenamento indisponível neste navegador',
      },
      {
        id: 'personalizar', titulo: 'Personalizar personagem',
        descricao: 'Editor completo de aparência', disponivel: false,
        motivo: 'Em conserto: o editor ainda trava em algumas máquinas',
      },
      { id: 'config', titulo: 'Configurações', descricao: 'Gráficos, áudio, jogabilidade e controles', disponivel: true },
      { id: 'creditos', titulo: 'Créditos e controles', descricao: 'Como jogar e o que foi usado', disponivel: true },
    ])
    this.trocarTela(this.menu.root)
  }

  private acaoMenu(id: AcaoMenu['id']): void {
    this.jogo.audio.interface(id === 'voltar' ? 'voltar' : 'confirmar')
    switch (id) {
      // O editor de personagem está desativado até parar de travar. Enquanto
      // isso, "Novo jogo" coloca o jogador direto na rua, de pé, com a
      // aparência padrão.
      case 'novo': this.comecarJogo(true); break
      case 'continuar': this.abrirCarregar(); break
      case 'personalizar': break
      case 'config': this.abrirConfig(); break
      case 'creditos': this.abrirCreditos(); break
      case 'salvar': this.salvar(); break
      case 'sair': this.abrirMenu(); break
      case 'voltar': this.retomarJogo(); break
      default: break
    }
  }

  /**
   * Editor de personagem. Desligado do menu por ora: ele abre um segundo
   * contexto WebGL e ainda trava em algumas máquinas. O código fica aqui,
   * inteiro, para voltar assim que o problema estiver resolvido.
   */
  // @ts-expect-error mantido de propósito enquanto o editor está desativado
  private abrirEditor(novoJogo: boolean): void {
    this.estado = 'editor'
    // O editor tem renderizador próprio. Deixar o jogo desenhando a cidade
    // inteira atrás dele significa dois contextos WebGL disputando a placa ao
    // mesmo tempo: é o que travava tudo e apagava a tela do editor.
    this.jogo.stop()
    this.creator = new CharacterCreator(this.aparencia, (r) => {
      this.creator?.dispose()
      this.creator = null
      this.jogo.start()
      if (r.confirmado) {
        this.aparencia = r.aparencia
        this.jogo.player.applyAppearance(this.aparencia)
      }
      if (novoJogo && r.confirmado) this.comecarJogo(true)
      else if (this.estado === 'editor' && this.jogo.paused && !this.jogo.cinematica) this.retomarJogo()
      else this.abrirMenu()
    })
    this.trocarTela(this.creator.root)
    this.creator.iniciar()
  }

  private abrirCarregar(): void {
    const tela = new LoadScreen(
      resumos((x, z) => this.jogo.world.districtName(x, z)),
      (slot) => this.carregar(slot),
      (slot) => { apagar(slot); this.abrirCarregar() },
      () => this.abrirMenu(),
    )
    this.trocarTela(tela.root)
  }

  private abrirConfig(): void {
    this.settingsScreen = new SettingsScreen(
      this.jogo.settings,
      this.jogo.input,
      (s) => this.jogo.applySettings(s),
      () => {
        this.settingsScreen = null
        if (this.estado === 'pausa') this.abrirPausa()
        else this.abrirMenu()
      },
      () => ({
        resolucao: this.jogo.stats().resolucao,
        fps: this.jogo.stats().fps,
        escala: this.jogo.stats().escala,
      }),
    )
    this.trocarTela(this.settingsScreen.root)
  }

  private abrirCreditos(): void {
    const tela = new CreditsScreen(this.jogo.settings.bindings, () => {
      if (this.estado === 'pausa') this.abrirPausa()
      else this.abrirMenu()
    })
    this.trocarTela(tela.root)
  }

  private abrirPausa(): void {
    this.estado = 'pausa'
    this.jogo.paused = true
    this.jogo.input.exitPointerLock()
    const tela = new PauseMenu((id) => this.acaoMenu(id), this.podeSalvar)
    this.trocarTela(tela.root)
  }

  // ----------------------------------------------------------------------
  // Sessão
  // ----------------------------------------------------------------------

  private comecarJogo(novo: boolean): void {
    if (novo) {
      this.progresso = progressoInicial()
      this.jogo.world.hour = 9.0
      // Começa de pé na calçada, de frente para a rua — não dentro de um lote
      // nem em cima de uma laje.
      const p = this.jogo.world.pontoInicial(SPAWN)
      this.jogo.player.teleport(p.x, p.z, p.yaw)
      this.jogo.player.rig.yaw = p.yaw
    }
    this.jogo.definirCinematica(false)
    this.jogo.paused = false
    this.estado = 'jogando'
    this.trocarTela(null)
    this.hud.root.style.display = ''
    this.ultimaPos.copy(this.jogo.player.position)
    this.jogo.input.requestPointerLock()
    this.jogo.interacoes.notificar(
      novo
        ? 'Clique na tela para capturar o mouse. WASD anda, Shift corre, E interage.'
        : 'Bem-vindo de volta.',
      6,
    )
  }

  private retomarJogo(): void {
    this.estado = 'jogando'
    this.jogo.paused = false
    this.jogo.definirCinematica(false)
    this.trocarTela(null)
    this.hud.root.style.display = ''
    this.jogo.input.requestPointerLock()
  }

  private carregar(slot: number): void {
    const d = ler(slot)
    if (!d) {
      this.jogo.interacoes.notificar('Não foi possível ler este espaço de salvamento.', 4)
      return
    }
    this.slotAtual = slot
    this.aparencia = d.aparencia
    this.progresso = d.progresso
    this.jogo.player.applyAppearance(this.aparencia)
    this.jogo.world.hour = d.hora
    // Posição segura: se o ponto salvo estiver dentro de geometria, procura perto.
    const seguro = this.jogo.world.findSafeSpot(d.posicao.x, d.posicao.z)
    this.jogo.player.teleport(seguro.x, seguro.z, d.posicao.yaw)
    this.comecarJogo(false)
  }

  private salvar(): void {
    if (!this.podeSalvar) return
    const p = this.jogo.player.position
    const ok = gravar(this.slotAtual, {
      nome: this.aparencia.nome,
      aparencia: this.aparencia,
      posicao: { x: p.x, y: p.y, z: p.z, yaw: this.jogo.player.controller.yaw },
      hora: this.jogo.world.hour,
      progresso: this.progresso,
    })
    this.jogo.interacoes.notificar(ok ? 'Progresso salvo.' : 'Falha ao salvar.', 3)
    this.jogo.audio.interface(ok ? 'confirmar' : 'erro')
    if (this.estado === 'pausa') this.retomarJogo()
  }

  // ----------------------------------------------------------------------
  // Entrada e laço de interface
  // ----------------------------------------------------------------------

  private onKey = (e: KeyboardEvent): void => {
    const b = this.jogo.settings.bindings
    if (e.code === b.pausa) {
      e.preventDefault()
      if (this.estado === 'jogando') this.abrirPausa()
      else if (this.estado === 'pausa') this.retomarJogo()
      return
    }
    if (this.estado !== 'jogando') return
    if (e.code === 'F3') { e.preventDefault(); this.hud.mostrarDebug = !this.hud.mostrarDebug }
    if (e.code === 'F5') { e.preventDefault(); this.salvar() }
    if (e.code === 'KeyG') { e.preventDefault(); this.jogo.soltarBola() }
  }

  private laçoInterface(): void {
    let anterior = performance.now()
    const passo = () => {
      requestAnimationFrame(passo)
      const agora = performance.now()
      const dt = Math.min(0.1, (agora - anterior) / 1000)
      anterior = agora

      if (this.estado === 'jogando') {
        this.hud.atualizar(dt)
        this.tempoSessao += dt
        this.progresso.tempoJogado += dt
        // Distância percorrida, para estatísticas.
        const p = this.jogo.player.position
        const d = p.distanceTo(this.ultimaPos)
        if (d < 30) {
          if (this.jogo.player.mode === 'dirigindo') this.progresso.distanciaDeCarro += d
          else this.progresso.distanciaAPe += d
        }
        this.ultimaPos.copy(p)
        // Salvamento automático a cada dois minutos.
        if (this.podeSalvar && this.tempoSessao > 120) {
          this.tempoSessao = 0
          this.salvarSilencioso()
        }
      }
    }
    passo()
  }

  private salvarSilencioso(): void {
    const p = this.jogo.player.position
    gravar(this.slotAtual, {
      nome: this.aparencia.nome,
      aparencia: this.aparencia,
      posicao: { x: p.x, y: p.y, z: p.z, yaw: this.jogo.player.controller.yaw },
      hora: this.jogo.world.hour,
      progresso: this.progresso,
    })
  }
}
