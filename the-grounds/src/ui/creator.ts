/**
 * Editor de personagem em 3D.
 *
 * Cena própria com iluminação de estúdio, giro e zoom com o mouse, e
 * reconstrução imediata da malha a cada alteração. Mudanças de cor não
 * reconstroem a geometria — só trocam o material, o que mantém o editor fluido.
 */

import * as THREE from 'three'
import { clamp, damp } from '../core/math'
import { Character } from '../character/character'
import {
  defaultAppearance, randomAppearance,
  type Appearance, type BeardStyle, type EyewearItem, type FeetItem,
  type HairStyle, type HeadItem, type LegsItem, type TorsoItem, type WristItem,
} from '../character/appearance'
import { PALETTE } from '../world/materials'
import { botao, el, limpar, opcoes, paleta, secao, slider } from './dom'

type Aba = 'corpo' | 'rosto' | 'cabelo' | 'roupas' | 'acessorios'

const ABAS: { id: Aba; nome: string }[] = [
  { id: 'corpo', nome: 'Corpo' },
  { id: 'rosto', nome: 'Rosto' },
  { id: 'cabelo', nome: 'Cabelo' },
  { id: 'roupas', nome: 'Roupas' },
  { id: 'acessorios', nome: 'Acessórios' },
]

export interface CreatorResult {
  aparencia: Appearance
  confirmado: boolean
}

export class CharacterCreator {
  readonly root: HTMLElement
  private cena = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private personagem: Character
  private aparencia: Appearance
  private aba: Aba = 'corpo'
  private corpoPainel: HTMLElement
  private canvas: HTMLCanvasElement
  private giro = 0.4
  private giroAlvo = 0.4
  private altura = 1.1
  private distancia = 3.0
  private distanciaAlvo = 3.0
  private arrastando = false
  private ultimoX = 0
  private ultimoY = 0
  private animando = true
  private raf = 0
  private relogio = new THREE.Clock()
  private aoConcluir: (r: CreatorResult) => void
  private nomeInput: HTMLInputElement
  /** Passada mostrada no editor para conferir a animação. */
  private andando = false

  constructor(aparenciaInicial: Appearance, aoConcluir: (r: CreatorResult) => void) {
    this.aparencia = JSON.parse(JSON.stringify(aparenciaInicial)) as Appearance
    this.aoConcluir = aoConcluir

    this.canvas = el('canvas') as HTMLCanvasElement
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    this.camera = new THREE.PerspectiveCamera(34, 1, 0.05, 40)
    this.montarEstudio()

    this.personagem = new Character(this.aparencia, { castShadow: true })
    this.cena.add(this.personagem.group)

    this.corpoPainel = el('div', { class: 'corpo' })
    this.nomeInput = el('input') as HTMLInputElement
    this.nomeInput.type = 'text'
    this.nomeInput.maxLength = 22
    this.nomeInput.value = this.aparencia.nome
    this.nomeInput.placeholder = 'Nome do personagem'
    this.nomeInput.addEventListener('input', () => { this.aparencia.nome = this.nomeInput.value })

    const abasEl = el('div', { class: 'abas' })
    for (const a of ABAS) {
      const b = el('button', { class: `aba ${a.id === this.aba ? 'ativa' : ''}`, text: a.nome })
      b.addEventListener('click', () => {
        this.aba = a.id
        for (const outro of abasEl.children) outro.classList.remove('ativa')
        b.classList.add('ativa')
        this.renderPainel()
      })
      abasEl.append(b)
    }

    const visual = el('div', { class: 'editor-visual' }, [
      this.canvas,
      el('div', { class: 'editor-dicas' }, [
        el('span', { html: '<b>Arrastar</b> girar' }),
        el('span', { html: '<b>Roda</b> aproximar' }),
        el('span', { html: '<b>Espaço</b> andar' }),
      ]),
    ])

    const painel = el('div', { class: 'editor-painel' }, [
      el('div', { class: 'topo' }, [
        el('h2', { text: 'Personalizar personagem' }),
        this.nomeInput,
      ]),
      abasEl,
      this.corpoPainel,
      el('footer', {}, [
        botao('Aleatório', () => this.aleatorio()),
        botao('Restaurar', () => this.restaurar()),
        el('div', { class: 'espaco' }),
        botao('Voltar', () => this.fechar(false)),
        botao('Confirmar', () => this.fechar(true), { classe: 'primario' }),
      ]),
    ])
    ;(painel.querySelector('.espaco') as HTMLElement).style.flex = '1'

    this.root = el('div', { class: 'tela tela-editor' }, [visual, painel])
    this.renderPainel()
    this.ligarEventos()
  }

  private montarEstudio(): void {
    this.cena.background = null

    const chao = new THREE.Mesh(
      new THREE.CircleGeometry(3.2, 48),
      new THREE.MeshStandardMaterial({ color: 0x161c23, roughness: 0.92, metalness: 0 }),
    )
    chao.rotation.x = -Math.PI / 2
    chao.receiveShadow = true
    this.cena.add(chao)

    // Anel de referência para dar escala ao personagem.
    const anel = new THREE.Mesh(
      new THREE.RingGeometry(0.72, 0.76, 64),
      new THREE.MeshBasicMaterial({ color: 0x2a3540, side: THREE.DoubleSide }),
    )
    anel.rotation.x = -Math.PI / 2
    anel.position.y = 0.002
    this.cena.add(anel)

    // Luz principal quente, preenchimento frio e contraluz — trio clássico.
    const principal = new THREE.DirectionalLight(0xfff0dc, 3.1)
    principal.position.set(2.4, 3.4, 2.8)
    principal.castShadow = true
    principal.shadow.mapSize.set(1024, 1024)
    principal.shadow.camera.left = -2.4
    principal.shadow.camera.right = 2.4
    principal.shadow.camera.top = 3.2
    principal.shadow.camera.bottom = -0.4
    principal.shadow.camera.near = 0.5
    principal.shadow.camera.far = 12
    principal.shadow.bias = -0.0004
    principal.shadow.normalBias = 0.02
    this.cena.add(principal)

    const preenchimento = new THREE.DirectionalLight(0x9ec2e8, 1.0)
    preenchimento.position.set(-3.0, 1.6, 1.4)
    this.cena.add(preenchimento)

    const contraluz = new THREE.DirectionalLight(0xffd9a0, 1.7)
    contraluz.position.set(-1.2, 2.2, -3.2)
    this.cena.add(contraluz)

    this.cena.add(new THREE.HemisphereLight(0x8fb4d8, 0x1a1f26, 0.75))
  }

  private ligarEventos(): void {
    this.canvas.addEventListener('pointerdown', (e) => {
      this.arrastando = true
      this.ultimoX = e.clientX
      this.ultimoY = e.clientY
      this.canvas.setPointerCapture(e.pointerId)
    })
    this.canvas.addEventListener('pointerup', (e) => {
      this.arrastando = false
      this.canvas.releasePointerCapture(e.pointerId)
    })
    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.arrastando) return
      this.giroAlvo -= (e.clientX - this.ultimoX) * 0.009
      this.altura = clamp(this.altura + (e.clientY - this.ultimoY) * 0.004, 0.35, 1.85)
      this.ultimoX = e.clientX
      this.ultimoY = e.clientY
    })
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault()
      this.distanciaAlvo = clamp(this.distanciaAlvo + Math.sign(e.deltaY) * 0.22, 0.85, 5.5)
    }, { passive: false })
    window.addEventListener('keydown', this.onKey)
  }

  private onKey = (e: KeyboardEvent): void => {
    if (!this.root.isConnected) return
    if (e.code === 'Space') { e.preventDefault(); this.andando = !this.andando }
    if (e.code === 'Escape') this.fechar(false)
  }

  // ----------------------------------------------------------------------
  // Painel de opções
  // ----------------------------------------------------------------------

  private aplicarEstrutura(): void {
    this.personagem.rebuild(this.aparencia)
  }

  private aplicarCores(): void {
    this.personagem.updateColors(this.aparencia)
  }

  private renderPainel(): void {
    limpar(this.corpoPainel)
    const a = this.aparencia
    switch (this.aba) {
      case 'corpo':
        this.corpoPainel.append(
          secao('Proporções', [
            slider('Altura', 1.50, 2.05, 0.01, a.corpo.altura, (v) => { a.corpo.altura = v; this.aplicarEstrutura() }, (v) => `${(v * 100).toFixed(0)} cm`),
            slider('Ombros', 0.82, 1.25, 0.01, a.corpo.ombros, (v) => { a.corpo.ombros = v; this.aplicarEstrutura() }),
            slider('Quadril', 0.85, 1.25, 0.01, a.corpo.quadril, (v) => { a.corpo.quadril = v; this.aplicarEstrutura() }),
            slider('Volume do corpo', 0.75, 1.45, 0.01, a.corpo.corpo, (v) => { a.corpo.corpo = v; this.aplicarEstrutura() }),
            slider('Musculatura', 0.80, 1.30, 0.01, a.corpo.musculatura, (v) => { a.corpo.musculatura = v; this.aplicarEstrutura() }),
            slider('Abdômen', 0.85, 1.35, 0.01, a.corpo.abdomen, (v) => { a.corpo.abdomen = v; this.aplicarEstrutura() }),
            slider('Comprimento das pernas', 0.92, 1.08, 0.01, a.corpo.pernas, (v) => { a.corpo.pernas = v; this.aplicarEstrutura() }),
            slider('Tamanho da cabeça', 0.90, 1.10, 0.01, a.corpo.cabeca, (v) => { a.corpo.cabeca = v; this.aplicarEstrutura() }),
          ]),
          secao('Pele', [
            paleta('Tom de pele', PALETTE.pele, a.pele, (c) => { a.pele = c; this.aplicarCores() }),
          ]),
        )
        break

      case 'rosto':
        this.corpoPainel.append(
          secao('Formato', [
            slider('Largura do rosto', 0.88, 1.14, 0.01, a.rosto.largura, (v) => { a.rosto.largura = v; this.aplicarEstrutura() }),
            slider('Alongamento', 0.90, 1.12, 0.01, a.rosto.alongamento, (v) => { a.rosto.alongamento = v; this.aplicarEstrutura() }),
            slider('Queixo', 0.85, 1.20, 0.01, a.rosto.queixo, (v) => { a.rosto.queixo = v; this.aplicarEstrutura() }),
            slider('Mandíbula', 0.85, 1.20, 0.01, a.rosto.mandibula, (v) => { a.rosto.mandibula = v; this.aplicarEstrutura() }),
            slider('Maçãs do rosto', 0.88, 1.18, 0.01, a.rosto.macas, (v) => { a.rosto.macas = v; this.aplicarEstrutura() }),
            slider('Nariz', 0.80, 1.30, 0.01, a.rosto.nariz, (v) => { a.rosto.nariz = v; this.aplicarEstrutura() }),
            slider('Órbitas', 0.85, 1.20, 0.01, a.rosto.orbitas, (v) => { a.rosto.orbitas = v; this.aplicarEstrutura() }),
          ]),
          secao('Olhos e sobrancelhas', [
            paleta('Cor dos olhos', [0x4a3524, 0x2d1b10, 0x6b8f5a, 0x4a6b8a, 0x8a6b4a, 0x3a3a3a, 0x7a9aa8], a.corOlhos, (c) => { a.corOlhos = c; this.aplicarCores() }),
            opcoes('Sobrancelhas', [
              { valor: 'finas', texto: 'Finas' },
              { valor: 'medias', texto: 'Médias' },
              { valor: 'grossas', texto: 'Grossas' },
              { valor: 'arqueadas', texto: 'Arqueadas' },
            ], a.sobrancelha, (v) => { a.sobrancelha = v as typeof a.sobrancelha; this.aplicarEstrutura() }),
          ]),
        )
        break

      case 'cabelo':
        this.corpoPainel.append(
          secao('Cabelo', [
            opcoes('Corte', [
              { valor: 'careca', texto: 'Careca' },
              { valor: 'raspado', texto: 'Raspado' },
              { valor: 'curto', texto: 'Curto' },
              { valor: 'medio', texto: 'Médio' },
              { valor: 'longo', texto: 'Longo' },
              { valor: 'cacheado', texto: 'Cacheado' },
              { valor: 'blackPower', texto: 'Black power' },
              { valor: 'coque', texto: 'Coque' },
              { valor: 'moicano', texto: 'Moicano' },
              { valor: 'tranças', texto: 'Tranças' },
            ], a.cabelo, (v) => { a.cabelo = v as HairStyle; this.aplicarEstrutura() }),
            paleta('Cor do cabelo', PALETTE.cabelo, a.corCabelo, (c) => { a.corCabelo = c; this.aplicarCores() }),
          ]),
          secao('Pelos faciais', [
            opcoes('Barba', [
              { valor: 'nenhum', texto: 'Sem barba' },
              { valor: 'bigode', texto: 'Bigode' },
              { valor: 'cavanhaque', texto: 'Cavanhaque' },
              { valor: 'costeleta', texto: 'Costeletas' },
              { valor: 'barbaCurta', texto: 'Barba curta' },
              { valor: 'barbaCheia', texto: 'Barba cheia' },
            ], a.barba, (v) => { a.barba = v as BeardStyle; this.aplicarEstrutura() }),
            paleta('Cor da barba', PALETTE.cabelo, a.corBarba, (c) => { a.corBarba = c; this.aplicarCores() }),
          ]),
        )
        break

      case 'roupas':
        this.corpoPainel.append(
          secao('Parte de cima', [
            opcoes('Peça', [
              { valor: 'camiseta', texto: 'Camiseta' },
              { valor: 'regata', texto: 'Regata' },
              { valor: 'camisa', texto: 'Camisa' },
              { valor: 'moletom', texto: 'Moletom' },
              { valor: 'jaqueta', texto: 'Jaqueta' },
              { valor: 'uniforme', texto: 'Uniforme' },
              { valor: 'semCamisa', texto: 'Sem camisa' },
            ], a.torso, (v) => { a.torso = v as TorsoItem; this.aplicarEstrutura() }),
            paleta('Cor principal', PALETTE.roupas, a.corTorso, (c) => { a.corTorso = c; this.aplicarCores() }),
            paleta('Cor secundária', PALETTE.roupas, a.corTorsoSec, (c) => { a.corTorsoSec = c; this.aplicarCores() }),
          ]),
          secao('Parte de baixo', [
            opcoes('Peça', [
              { valor: 'bermuda', texto: 'Bermuda' },
              { valor: 'shortEsportivo', texto: 'Short' },
              { valor: 'calca', texto: 'Calça' },
              { valor: 'calcaSocial', texto: 'Calça social' },
              { valor: 'saia', texto: 'Saia' },
            ], a.pernas, (v) => { a.pernas = v as LegsItem; this.aplicarEstrutura() }),
            paleta('Cor', [0x2f4058, 0x3a3a42, 0x1e2733, 0x5a4a3a, 0x8a8577, 0x2a2a2a, 0xd9d2c2, 0x7a4a2a, 0x2f6b4a], a.corPernas, (c) => { a.corPernas = c; this.aplicarCores() }),
          ]),
          secao('Calçado', [
            opcoes('Tipo', [
              { valor: 'tenis', texto: 'Tênis' },
              { valor: 'chuteira', texto: 'Chuteira' },
              { valor: 'sapato', texto: 'Sapato' },
              { valor: 'sandalia', texto: 'Sandália' },
              { valor: 'descalco', texto: 'Descalço' },
            ], a.pes, (v) => { a.pes = v as FeetItem; this.aplicarEstrutura() }),
            paleta('Cor', [0xf0f0f0, 0x2a2a2a, 0x8c1f22, 0x1d3f6e, 0xd8a32a, 0x2f9e5a, 0x7a2f4a], a.corPes, (c) => { a.corPes = c; this.aplicarCores() }),
            paleta('Meias', [0xffffff, 0x2a2a2a, 0xf2c230, 0xd83a3a, 0x2f5fb3], a.corMeias, (c) => { a.corMeias = c; this.aplicarCores() }),
          ]),
        )
        break

      case 'acessorios':
        this.corpoPainel.append(
          secao('Cabeça', [
            opcoes('Chapéu', [
              { valor: 'nenhum', texto: 'Nenhum' },
              { valor: 'bone', texto: 'Boné' },
              { valor: 'boneTras', texto: 'Boné ao contrário' },
              { valor: 'gorro', texto: 'Gorro' },
              { valor: 'bandana', texto: 'Bandana' },
            ], a.chapeu, (v) => { a.chapeu = v as HeadItem; this.aplicarEstrutura() }),
            paleta('Cor', PALETTE.roupas, a.corChapeu, (c) => { a.corChapeu = c; this.aplicarCores() }),
            opcoes('Óculos', [
              { valor: 'nenhum', texto: 'Nenhum' },
              { valor: 'oculosSol', texto: 'De sol' },
              { valor: 'oculosGrau', texto: 'De grau' },
            ], a.oculos, (v) => { a.oculos = v as EyewearItem; this.aplicarEstrutura() }),
          ]),
          secao('Outros', [
            opcoes('Mochila', [
              { valor: 'nenhum', texto: 'Sem mochila' },
              { valor: 'mochila', texto: 'Mochila' },
            ], a.mochila, (v) => { a.mochila = v as 'nenhum' | 'mochila'; this.aplicarEstrutura() }),
            opcoes('Pulso', [
              { valor: 'nenhum', texto: 'Nada' },
              { valor: 'relogio', texto: 'Relógio' },
              { valor: 'pulseira', texto: 'Pulseira' },
            ], a.pulso, (v) => { a.pulso = v as WristItem; this.aplicarEstrutura() }),
            slider('Número da camisa', 1, 99, 1, a.numero, (v) => { a.numero = Math.round(v) }, (v) => String(Math.round(v))),
          ]),
        )
        break
    }
  }

  private aleatorio(): void {
    const nome = this.aparencia.nome
    this.aparencia = randomAppearance(Math.floor(Math.random() * 1e9))
    this.aparencia.nome = nome
    this.aplicarEstrutura()
    this.renderPainel()
  }

  private restaurar(): void {
    const nome = this.aparencia.nome
    this.aparencia = defaultAppearance()
    this.aparencia.nome = nome
    this.aplicarEstrutura()
    this.renderPainel()
  }

  // ----------------------------------------------------------------------
  // Laço
  // ----------------------------------------------------------------------

  iniciar(): void {
    this.relogio.start()
    const loop = () => {
      this.raf = requestAnimationFrame(loop)
      if (!this.root.isConnected) return
      const dt = Math.min(0.05, this.relogio.getDelta())
      this.atualizar(dt)
    }
    loop()
  }

  private atualizar(dt: number): void {
    const w = this.canvas.clientWidth || 1
    const h = this.canvas.clientHeight || 1
    if (this.canvas.width !== Math.floor(w * devicePixelRatio) || this.canvas.height !== Math.floor(h * devicePixelRatio)) {
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
      this.renderer.setSize(w, h, false)
      this.camera.aspect = w / h
      this.camera.updateProjectionMatrix()
    }

    if (!this.arrastando && this.animando) this.giroAlvo += dt * 0.16
    this.giro = damp(this.giro, this.giroAlvo, 9, dt)
    this.distancia = damp(this.distancia, this.distanciaAlvo, 8, dt)

    const alvoY = this.altura
    this.camera.position.set(
      Math.sin(this.giro) * this.distancia,
      alvoY + 0.30,
      Math.cos(this.giro) * this.distancia,
    )
    this.camera.lookAt(0, alvoY, 0)

    const inp = this.personagem.input
    inp.speed = this.andando ? 1.6 : 0
    inp.grounded = true
    inp.forwardness = 1
    this.personagem.setYaw(0)
    this.personagem.update(dt, () => 0)

    this.renderer.render(this.cena, this.camera)
  }

  private fechar(confirmado: boolean): void {
    cancelAnimationFrame(this.raf)
    window.removeEventListener('keydown', this.onKey)
    this.aoConcluir({ aparencia: this.aparencia, confirmado })
  }

  dispose(): void {
    cancelAnimationFrame(this.raf)
    window.removeEventListener('keydown', this.onKey)
    this.personagem.dispose()
    this.renderer.dispose()
    // dispose() libera os recursos mas não devolve o contexto WebGL. Sem isso,
    // abrir e fechar o editor algumas vezes esgota o número de contextos que o
    // navegador permite e a próxima tela nasce preta.
    this.renderer.forceContextLoss()
  }
}
