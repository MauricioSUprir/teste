/**
 * Telas de configuração: gráficos, áudio, jogabilidade, controles e dados.
 *
 * Toda opção aplica imediatamente e é gravada; as que dependem do equipamento
 * trazem uma nota explicando o custo, em vez de prometer o impossível.
 */

import {
  applyPreset, DEFAULT_BINDINGS, defaultSettings,
  type ActionName, type Settings,
} from '../core/settings'
import { keyLabel, type Input } from '../core/input'
import { alternador, botao, el, limpar, opcoes, secao, slider } from './dom'
import { apagarTudo } from '../save/save'

type AbaConfig = 'grafico' | 'audio' | 'jogo' | 'controles' | 'dados'

const ABAS: { id: AbaConfig; nome: string }[] = [
  { id: 'grafico', nome: 'Gráficos' },
  { id: 'audio', nome: 'Áudio' },
  { id: 'jogo', nome: 'Jogabilidade' },
  { id: 'controles', nome: 'Controles' },
  { id: 'dados', nome: 'Dados' },
]

const ACOES: { id: ActionName; nome: string; grupo: string }[] = [
  { id: 'frente', nome: 'Frente', grupo: 'Movimento' },
  { id: 'tras', nome: 'Trás', grupo: 'Movimento' },
  { id: 'esquerda', nome: 'Esquerda', grupo: 'Movimento' },
  { id: 'direita', nome: 'Direita', grupo: 'Movimento' },
  { id: 'correr', nome: 'Correr', grupo: 'Movimento' },
  { id: 'pular', nome: 'Pular / transpor', grupo: 'Movimento' },
  { id: 'agachar', nome: 'Agachar', grupo: 'Movimento' },
  { id: 'interagir', nome: 'Interagir', grupo: 'Ações' },
  { id: 'entrarVeiculo', nome: 'Entrar / sair do veículo', grupo: 'Ações' },
  { id: 'trocarCamera', nome: 'Trocar câmera', grupo: 'Câmera' },
  { id: 'primeiraPessoa', nome: 'Primeira pessoa', grupo: 'Câmera' },
  { id: 'foto', nome: 'Modo fotografia', grupo: 'Câmera' },
  { id: 'mapa', nome: 'Mapa', grupo: 'Interface' },
  { id: 'pausa', nome: 'Pausar', grupo: 'Interface' },
  { id: 'chutar', nome: 'Chutar (segurar carrega)', grupo: 'Futebol' },
  { id: 'passar', nome: 'Passar', grupo: 'Futebol' },
  { id: 'drible', nome: 'Drible', grupo: 'Futebol' },
  { id: 'carrinho', nome: 'Carrinho', grupo: 'Futebol' },
  { id: 'freioMao', nome: 'Freio de mão', grupo: 'Veículo' },
  { id: 'buzina', nome: 'Buzina', grupo: 'Veículo' },
  { id: 'faroisLuz', nome: 'Faróis', grupo: 'Veículo' },
]

export class SettingsScreen {
  readonly root: HTMLElement
  private corpo: HTMLElement
  private aba: AbaConfig = 'grafico'
  private capturando = false

  constructor(
    private settings: Settings,
    private readonly input: Input,
    private readonly aoAplicar: (s: Settings) => void,
    private readonly aoFechar: () => void,
    private readonly info: () => { resolucao: string; fps: number; escala: number },
  ) {
    this.corpo = el('div', { class: 'corpo' })

    const abasEl = el('div', { class: 'abas' })
    for (const a of ABAS) {
      const b = el('button', { class: `aba ${a.id === this.aba ? 'ativa' : ''}`, text: a.nome })
      b.addEventListener('click', () => {
        this.aba = a.id
        for (const o of abasEl.children) o.classList.remove('ativa')
        b.classList.add('ativa')
        this.render()
      })
      abasEl.append(b)
    }

    const painel = el('div', { class: 'painel' }, [
      el('header', {}, [el('h2', { text: 'Configurações' }), abasEl]),
      this.corpo,
      el('footer', {}, [
        botao('Restaurar padrões', () => {
          this.settings = defaultSettings()
          this.aplicar()
          this.render()
        }),
        botao('Fechar', () => this.aoFechar(), { classe: 'primario' }),
      ]),
    ])
    this.root = el('div', { class: 'tela tela-painel' }, [painel])
    this.render()
  }

  private aplicar(): void {
    this.aoAplicar(this.settings)
  }

  private render(): void {
    limpar(this.corpo)
    switch (this.aba) {
      case 'grafico': this.renderGraficos(); break
      case 'audio': this.renderAudio(); break
      case 'jogo': this.renderJogo(); break
      case 'controles': this.renderControles(); break
      case 'dados': this.renderDados(); break
    }
  }

  private renderGraficos(): void {
    const g = this.settings.graphics
    const i = this.info()
    const telaLargura = Math.round(window.innerWidth * (window.devicePixelRatio || 1))

    this.corpo.append(
      el('div', {
        class: 'aviso-indisponivel',
        text: `Renderizando em ${i.resolucao} (escala ${i.escala.toFixed(2)}), ${i.fps} fps. `
          + `Sua tela oferece até ${telaLargura} px de largura. `
          + `A resolução de saída acompanha a janela; o teto de 3840 px vale quando a tela permite.`,
      }),
      secao('Perfil', [
        opcoes('Predefinição', [
          { valor: 'baixo', texto: 'Baixo' },
          { valor: 'medio', texto: 'Médio' },
          { valor: 'alto', texto: 'Alto' },
          { valor: 'ultra', texto: 'Ultra' },
        ], g.preset, (v) => {
          this.settings.graphics = applyPreset(g, v as typeof g.preset)
          this.aplicar()
          this.render()
        }),
      ]),
      secao('Resolução', [
        slider('Escala de renderização', 0.5, 2, 0.05, g.renderScale, (v) => {
          g.renderScale = v; this.aplicar()
        }, (v) => `${Math.round(v * 100)} %`),
        opcoes('Teto de saída', [
          { valor: 0, texto: 'Seguir janela' },
          { valor: 1920, texto: '1920' },
          { valor: 2560, texto: '2560' },
          { valor: 3840, texto: '3840 (4K)' },
        ], g.outputWidthCap, (v) => { g.outputWidthCap = Number(v); this.aplicar() }),
        alternador('Resolução dinâmica', g.dynamicResolution, (v) => { g.dynamicResolution = v; this.aplicar() }),
        opcoes('Alvo de quadros', [
          { valor: 30, texto: '30' },
          { valor: 60, texto: '60' },
          { valor: 120, texto: '120' },
          { valor: 144, texto: '144' },
        ], g.targetFps, (v) => { g.targetFps = Number(v); this.aplicar() }),
      ]),
      secao('Qualidade', [
        opcoes('Sombras', [
          { valor: 'off', texto: 'Desligadas' },
          { valor: 'baixo', texto: 'Baixas' },
          { valor: 'medio', texto: 'Médias' },
          { valor: 'alto', texto: 'Altas' },
        ], g.shadows, (v) => { g.shadows = v as typeof g.shadows; this.aplicar() }),
        slider('Distância de visão', 150, 1600, 25, g.viewDistance, (v) => { g.viewDistance = v; this.aplicar() }, (v) => `${v} m`),
        opcoes('Texturas', [
          { valor: 'baixo', texto: 'Baixa' },
          { valor: 'medio', texto: 'Média' },
          { valor: 'alto', texto: 'Alta' },
        ], g.textureQuality, (v) => { g.textureQuality = v as typeof g.textureQuality; this.aplicar() }),
        alternador('Oclusão de ambiente', g.ssao, (v) => { g.ssao = v; this.aplicar() }),
        alternador('Brilho (bloom)', g.bloom, (v) => { g.bloom = v; this.aplicar() }),
        opcoes('Antialiasing', [
          { valor: 'off', texto: 'Desligado' },
          { valor: 'fxaa', texto: 'FXAA' },
        ], g.antialias, (v) => { g.antialias = v as typeof g.antialias; this.aplicar() }),
        alternador('Desfoque de movimento', g.motionBlur, (v) => { g.motionBlur = v; this.aplicar() }),
      ]),
      secao('Densidade', [
        slider('Pedestres', 0, 1, 0.05, g.pedestrianDensity, (v) => { g.pedestrianDensity = v; this.aplicar() }, (v) => `${Math.round(v * 100)} %`),
        slider('Trânsito', 0, 1, 0.05, g.trafficDensity, (v) => { g.trafficDensity = v; this.aplicar() }, (v) => `${Math.round(v * 100)} %`),
        slider('Vegetação', 0, 1, 0.05, g.vegetationDensity, (v) => { g.vegetationDensity = v; this.aplicar() }, (v) => `${Math.round(v * 100)} %`),
      ]),
    )
  }

  private renderAudio(): void {
    const a = this.settings.audio
    const pct = (v: number) => `${Math.round(v * 100)} %`
    this.corpo.append(
      secao('Volumes', [
        slider('Geral', 0, 1, 0.02, a.master, (v) => { a.master = v; this.aplicar() }, pct),
        slider('Efeitos', 0, 1, 0.02, a.sfx, (v) => { a.sfx = v; this.aplicar() }, pct),
        slider('Ambiente', 0, 1, 0.02, a.ambience, (v) => { a.ambience = v; this.aplicar() }, pct),
        slider('Música', 0, 1, 0.02, a.music, (v) => { a.music = v; this.aplicar() }, pct),
        slider('Vozes', 0, 1, 0.02, a.voice, (v) => { a.voice = v; this.aplicar() }, pct),
      ]),
      el('div', {
        class: 'aviso-indisponivel',
        text: 'Todo o áudio é sintetizado em tempo real pelo próprio jogo — não há arquivos de som externos. '
          + 'O navegador só libera o som após um clique ou tecla.',
      }),
    )
  }

  private renderJogo(): void {
    const j = this.settings.gameplay
    this.corpo.append(
      secao('Câmera', [
        slider('Campo de visão', 45, 100, 1, j.fov, (v) => { j.fov = v; this.aplicar() }, (v) => `${Math.round(v)}°`),
        slider('Sensibilidade', 0.1, 5, 0.05, j.sensitivity, (v) => { j.sensitivity = v; this.aplicar() }),
        alternador('Inverter eixo vertical', j.invertY, (v) => { j.invertY = v; this.aplicar() }),
        opcoes('Apontador', [
          { valor: 'auto', texto: 'Automático' },
          { valor: 'mouse', texto: 'Mouse' },
          { valor: 'trackpad', texto: 'Trackpad' },
        ], j.pointerProfile, (v) => { j.pointerProfile = v; this.aplicar() }),
        slider('Suavização da câmera', 0, 0.9, 0.05, j.lookSmoothing,
          (v) => { j.lookSmoothing = v; this.aplicar() },
          (v) => (v < 0.05 ? 'crua' : `${Math.round(v * 100)}%`)),
        alternador('Reduzir movimento de câmera', j.reduceCameraMotion, (v) => { j.reduceCameraMotion = v; this.aplicar() }),
      ]),
      secao('Interface', [
        alternador('Mostrar HUD', j.showHud, (v) => { j.showHud = v; this.aplicar() }),
        alternador('Mostrar minimapa', j.showMinimap, (v) => { j.showMinimap = v; this.aplicar() }),
        alternador('Legendas', j.subtitles, (v) => { j.subtitles = v; this.aplicar() }),
      ]),
      el('div', {
        class: 'aviso-indisponivel',
        text: 'No trackpad a câmera ganha uma curva de aceleração e mais suavização, para que '
          + 'passadas curtas continuem precisas e passadas longas virem depressa. As setas do '
          + 'teclado também giram a câmera. Reduzir movimento de câmera desliga o balanço em '
          + 'primeira pessoa, o tremor por impacto e a variação de campo de visão com a velocidade.',
      }),
    )
  }

  private renderControles(): void {
    const grupos = new Map<string, HTMLElement[]>()
    for (const acao of ACOES) {
      const linha = el('div', { class: 'campo' })
      const lab = el('label', { text: acao.nome })
      const b = el('button', { class: 'opcao', text: keyLabel(this.settings.bindings[acao.id]) })
      b.style.minWidth = '110px'
      b.addEventListener('click', async () => {
        if (this.capturando) return
        this.capturando = true
        b.textContent = 'Pressione…'
        b.classList.add('ativa')
        const code = await this.input.captureNextKey()
        this.settings.bindings[acao.id] = code
        b.textContent = keyLabel(code)
        b.classList.remove('ativa')
        this.capturando = false
        this.aplicar()
      })
      linha.append(lab, b, el('span'))
      const lista = grupos.get(acao.grupo)
      if (lista) lista.push(linha)
      else grupos.set(acao.grupo, [linha])
    }
    for (const [nome, linhas] of grupos) this.corpo.append(secao(nome, linhas))
    this.corpo.append(
      el('div', {
        class: 'aviso-indisponivel',
        text: 'Mouse: olhar e roda para aproximar a câmera. Controle (gamepad) é reconhecido automaticamente '
          + 'no layout padrão; o remapeamento acima vale para o teclado.',
      }),
      botao('Restaurar controles padrão', () => {
        this.settings.bindings = { ...DEFAULT_BINDINGS }
        this.aplicar()
        this.render()
      }),
    )
  }

  private renderDados(): void {
    this.corpo.append(
      secao('Progresso', [
        el('div', {
          class: 'aviso-indisponivel',
          text: 'O jogo grava aparência, posição, horário, itens, veículos e progresso no armazenamento '
            + 'do navegador. Apagar os dados não pode ser desfeito.',
        }),
        botao('Apagar todo o progresso', () => {
          if (confirm('Apagar todos os saves e configurações? Esta ação não pode ser desfeita.')) {
            apagarTudo()
            this.settings = defaultSettings()
            this.aplicar()
            this.render()
          }
        }, { classe: 'perigo' }),
      ]),
      secao('Créditos técnicos', [
        el('div', {
          class: 'aviso-indisponivel',
          html: 'Geometria, animação, áudio e texturas base gerados por código neste projeto.<br>'
            + 'Materiais fotogramétricos: <b>Poly Haven</b> (CC0, domínio público).<br>'
            + 'Motor de renderização: <b>three.js</b> (licença MIT).',
        }),
      ]),
    )
  }

  atualizarSettings(s: Settings): void {
    this.settings = s
  }
}
