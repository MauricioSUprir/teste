/**
 * HUD do jogo: informação contextual e discreta — bairro, horário, aviso de
 * interação, fôlego, painel do veículo, placar da partida e minimapa.
 *
 * Tudo aparece apenas quando é útil, e tudo pode ser desligado nas opções.
 */

import { el } from './dom'
import { MapRenderer, type MarcadorMapa } from './minimap'
import { keyLabel } from '../core/input'
import type { Game } from '../game/game'
import { formatHour } from '../game/game'

export class Hud {
  readonly root: HTMLElement
  private local: HTMLElement
  private relogio: HTMLElement
  private clima: HTMLElement
  private interacao: HTMLElement
  private interacaoTexto: HTMLElement
  private interacaoTecla: HTMLElement
  private mensagem: HTMLElement
  private folego: HTMLElement
  private folegoBarra: HTMLElement
  private painelCarro: HTMLElement
  private velocidade: HTMLElement
  private nomeCarro: HTMLElement
  private placar: HTMLElement
  private escolha: HTMLElement
  private avisoPartida: HTMLElement
  private minimapa: HTMLElement
  private minimapaCtx: CanvasRenderingContext2D | null = null
  private debug: HTMLElement
  private mapRenderer: MapRenderer | null = null
  private tickMinimapa = 0
  mostrarDebug = false

  constructor(private readonly game: Game) {
    this.local = el('div', { class: 'hud-local', text: '—' })
    this.relogio = el('div', { class: 'hud-relogio', text: '00:00' })
    this.clima = el('div', { class: 'hud-clima', text: '' })

    this.interacaoTecla = el('span', { class: 'tecla', text: 'E' })
    this.interacaoTexto = el('span', { text: '' })
    this.interacao = el('div', { class: 'hud-interacao' }, [this.interacaoTecla, this.interacaoTexto])

    this.mensagem = el('div', { class: 'hud-mensagem' })
    this.folegoBarra = el('i')
    this.folego = el('div', { class: 'hud-folego' }, [this.folegoBarra])

    this.velocidade = el('div', { class: 'vel', html: '0<small>km/h</small>' })
    this.nomeCarro = el('div', { class: 'nome', text: '' })
    this.painelCarro = el('div', { class: 'hud-painel-carro' }, [this.velocidade, this.nomeCarro])
    this.painelCarro.style.display = 'none'

    this.placar = el('div', { class: 'hud-placar' })
    this.placar.style.display = 'none'
    this.escolha = el('div', { class: 'hud-escolha' })
    this.escolha.style.display = 'none'
    this.avisoPartida = el('div', { class: 'hud-aviso-partida' })

    const canvas = el('canvas')
    canvas.width = 356
    canvas.height = 356
    this.minimapaCtx = canvas.getContext('2d')
    this.minimapa = el('div', { class: 'hud-minimapa' }, [canvas])

    this.debug = el('div', { class: 'hud-debug' })
    this.debug.style.display = 'none'

    this.root = el('div', { id: 'hud' }, [
      el('div', { class: 'hud-canto-superior-esq' }, [this.local, this.relogio, this.clima]),
      this.minimapa,
      this.placar,
      this.avisoPartida,
      this.escolha,
      this.interacao,
      this.mensagem,
      this.folego,
      this.painelCarro,
      this.debug,
    ])
  }

  montar(pai: HTMLElement): void {
    pai.appendChild(this.root)
    this.mapRenderer = new MapRenderer(this.game.world.layout, this.game.world.pitches)
  }

  atualizar(dt: number): void {
    const g = this.game
    const cfg = g.settings.gameplay
    this.root.style.display = cfg.showHud ? '' : 'none'
    if (!cfg.showHud) return

    const p = g.player.position
    this.local.textContent = g.world.districtName(p.x, p.z)
    this.relogio.textContent = formatHour(g.world.hour)
    const chuva = g.world.weather.rain
    this.clima.textContent = chuva > 0.55 ? 'Chuva forte'
      : chuva > 0.15 ? 'Garoa'
        : g.world.weather.cloudCover > 0.6 ? 'Nublado' : 'Céu limpo'

    // Menu contextual (jogar / treinar)
    const esc = g.escolha
    if (esc) {
      this.escolha.style.display = ''
      const teclaOk = keyLabel(g.settings.bindings.interagir)
      this.escolha.innerHTML = `<h3>${esc.titulo}</h3>`
        + esc.opcoes.map((o, i) => `
          <div class="opcao${i === esc.indice ? ' ativa' : ''}">
            <span class="num">${i + 1}</span>
            <span class="txt"><b>${o.rotulo}</b>${o.descricao ? `<small>${o.descricao}</small>` : ''}</span>
          </div>`).join('')
        + `<div class="dica">W/S ou setas para escolher · ${teclaOk} confirma · Esc cancela</div>`
    } else if (this.escolha.style.display !== 'none') {
      this.escolha.style.display = 'none'
    }

    // Interação
    const alvo = g.interacoes.atual
    if (alvo) {
      this.interacaoTexto.textContent = `${alvo.icone ?? ''} ${alvo.rotulo}`.trim()
      this.interacaoTecla.textContent = keyLabel(g.settings.bindings.interagir)
      this.interacao.classList.add('visivel')
    } else {
      this.interacao.classList.remove('visivel')
    }

    // Mensagem
    if (g.interacoes.mensagem) {
      this.mensagem.textContent = g.interacoes.mensagem
      this.mensagem.classList.add('visivel')
    } else {
      this.mensagem.classList.remove('visivel')
    }

    // Fôlego (só aparece quando não está cheio)
    const st = g.player.stamina
    this.folego.classList.toggle('visivel', st < 0.985 && g.player.mode !== 'dirigindo')
    this.folegoBarra.style.width = `${Math.round(st * 100)}%`

    // Painel do veículo
    const v = g.player.veiculo
    if (v) {
      this.painelCarro.style.display = ''
      this.velocidade.innerHTML = `${Math.round(v.velocidadeKmh)}<small>km/h</small>`
      this.nomeCarro.textContent = v.spec.nome
    } else {
      this.painelCarro.style.display = 'none'
    }

    // Placar
    const m = g.partida
    if (m && m.treino) {
      // No treino não há placar nem relógio: o que interessa é o aproveitamento.
      this.placar.style.display = ''
      const r = m.resumoTreino
      const aprov = r.chutes > 0 ? Math.round((r.gols / r.chutes) * 100) : 0
      this.placar.innerHTML = `
        <span class="time">Treino livre</span>
        <span class="gols">${r.gols}/${r.chutes}</span>
        <span class="time">${aprov}% no gol</span>
        <span class="tempo">defesas ${r.defesas}`
        + `${r.maiorKmh > 0 ? ` · mais forte ${Math.round(r.maiorKmh)} km/h` : ''}</span>`
      if (m.state.avisoTimer > 0) {
        this.avisoPartida.textContent = m.state.aviso
        this.avisoPartida.classList.add('visivel')
      } else {
        this.avisoPartida.classList.remove('visivel')
      }
    } else if (m) {
      this.placar.style.display = ''
      const restante = Math.max(0, m.config.duracao - m.state.tempo)
      this.placar.innerHTML = `
        <span class="time"><i class="cor-time" style="background:#f2c230"></i>Amarelo</span>
        <span class="gols">${m.state.placar[0]} — ${m.state.placar[1]}</span>
        <span class="time"><i class="cor-time" style="background:#d83a3a"></i>Vermelho</span>
        <span class="tempo">${m.state.periodo}º · ${formatHour(restante / 60).slice(0, 5)}</span>`
      if (m.state.avisoTimer > 0) {
        this.avisoPartida.textContent = m.state.aviso
        this.avisoPartida.classList.add('visivel')
      } else {
        this.avisoPartida.classList.remove('visivel')
      }
    } else {
      this.placar.style.display = 'none'
      this.avisoPartida.classList.remove('visivel')
    }

    // Minimapa
    this.minimapa.style.display = cfg.showMinimap ? '' : 'none'
    this.tickMinimapa -= dt
    if (cfg.showMinimap && this.tickMinimapa <= 0 && this.minimapaCtx && this.mapRenderer) {
      this.tickMinimapa = 0.1
      const marcadores: MarcadorMapa[] = []
      const campo = g.world.nearestPitch(p.x, p.z)
      if (campo && campo.dist < 260) {
        marcadores.push({ x: campo.pitch.x, z: campo.pitch.z, cor: '#5fce8a', tipo: 'campo' })
      }
      this.mapRenderer.desenhar(
        this.minimapaCtx, 356, 356, p.x, p.z, 1.1,
        { rotacao: g.player.rig.yaw, marcadores, redondo: false },
      )
    }

    // Diagnóstico
    this.debug.style.display = this.mostrarDebug ? '' : 'none'
    if (this.mostrarDebug) {
      const s = g.stats()
      this.debug.textContent =
        `${s.fps} fps · quadro ${s.quadroMs} ms · ${s.resolucao} (x${s.escala})\n`
        + `desenhos ${s.draws} · ${(s.tris / 1000).toFixed(0)}k tri · setores ${s.setores}(+${s.pendentes})\n`
        + `carros ${g.traffic.count} · pessoas ${g.crowd.count} · colisores ${s.colisores}\n`
        + `${s.posicao} · ${s.estado} · texturas ${s.cdn}\n`
        + `${s.perfil}`
    }
  }
}
