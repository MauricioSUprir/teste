/**
 * Placas de loja com o nome escrito.
 *
 * A cidade tem poucos nomes de comércio (duas dúzias), então todos cabem numa
 * única textura: um atlas desenhado em canvas, uma célula por nome. Cada placa
 * é um retângulo cujas coordenadas de textura apontam para a célula dela, e
 * todas as placas de um setor saem num desenho só.
 *
 * O atlas é também o encaixe para arte gerada. Se `src/assets/placas.json`
 * listar o nome de um arquivo, a imagem `public/placas/<arquivo>.png` substitui
 * o desenho daquela célula quando chega. Assim uma placa pintada por um
 * gerador de imagem entra no jogo só com o arquivo, sem mexer em código — e o
 * jogo continua completo quando a imagem não existe.
 */

import * as THREE from 'three'
import listaImagens from '../assets/placas.json'

const CEL_W = 512
const CEL_H = 128
const COLS = 4
const LINHAS = 8
/** Proporção de uma célula: a placa na fachada respeita a mesma, para o texto não esticar. */
export const PROPORCAO_PLACA = CEL_W / CEL_H

/** Paletas de placa pintada: fundo, letra, borda. Tons de fachada de comércio de bairro. */
const ESTILOS: [string, string, string][] = [
  ['#1d4e89', '#f6c945', '#f6c945'], // azul e amarelo
  ['#b3261e', '#fff4e0', '#fff4e0'], // vermelho e creme
  ['#1f6b3a', '#ffffff', '#f2d16b'], // verde bandeira
  ['#f2c230', '#1c1c1c', '#1c1c1c'], // amarelo e preto
  ['#fbf7ee', '#1d4e89', '#b3261e'], // branco, azul e vermelho
  ['#2d2a32', '#f59e3b', '#f59e3b'], // grafite e laranja
  ['#7a1f3d', '#fbe8c6', '#fbe8c6'], // vinho e bege
  ['#0f766e', '#fdf6e3', '#fdf6e3'], // petróleo
]

/** Nome de arquivo estável a partir do nome da loja. */
export function slugPlaca(nome: string): string {
  return nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function hashTexto(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

class AtlasPlacas {
  readonly canvas: HTMLCanvasElement
  readonly textura: THREE.CanvasTexture
  private readonly ctx: CanvasRenderingContext2D
  private celulas = new Map<string, number>()
  private readonly comImagem = new Set<string>((listaImagens as { placas: string[] }).placas)

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.width = CEL_W * COLS
    this.canvas.height = CEL_H * LINHAS
    this.ctx = this.canvas.getContext('2d')!
    this.ctx.fillStyle = '#6b6b6b'
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    this.textura = new THREE.CanvasTexture(this.canvas)
    this.textura.colorSpace = THREE.SRGBColorSpace
    this.textura.anisotropy = 4
    this.textura.generateMipmaps = true
    this.textura.minFilter = THREE.LinearMipmapLinearFilter
  }

  /**
   * Retângulo de textura [u0, v0, u1, v1] da placa `nome`, desenhando-a na
   * primeira vez que é pedida.
   */
  uv(nome: string): [number, number, number, number] {
    let i = this.celulas.get(nome)
    if (i === undefined) {
      i = this.celulas.size % (COLS * LINHAS)
      this.celulas.set(nome, i)
      this.desenhar(nome, i)
      const slug = slugPlaca(nome)
      if (this.comImagem.has(slug)) this.carregarImagem(slug, i)
    }
    const c = i % COLS
    const r = Math.floor(i / COLS)
    const W = this.canvas.width
    const H = this.canvas.height
    // Meio texel para dentro, para a célula vizinha não sangrar no mipmap.
    const m = 2
    return [
      (c * CEL_W + m) / W,
      1 - ((r + 1) * CEL_H - m) / H,
      ((c + 1) * CEL_W - m) / W,
      1 - (r * CEL_H + m) / H,
    ]
  }

  /** Placa pintada à mão: fundo chapado, borda, letra pesada e algum desgaste. */
  private desenhar(nome: string, i: number): void {
    const ctx = this.ctx
    const x0 = (i % COLS) * CEL_W
    const y0 = Math.floor(i / COLS) * CEL_H
    const h = hashTexto(nome)
    const [fundo, letra, borda] = ESTILOS[h % ESTILOS.length]

    ctx.save()
    ctx.beginPath()
    ctx.rect(x0, y0, CEL_W, CEL_H)
    ctx.clip()

    ctx.fillStyle = fundo
    ctx.fillRect(x0, y0, CEL_W, CEL_H)

    // Borda dupla, como placa de letrista.
    ctx.strokeStyle = borda
    ctx.lineWidth = 6
    ctx.strokeRect(x0 + 9, y0 + 9, CEL_W - 18, CEL_H - 18)
    ctx.lineWidth = 2
    ctx.strokeRect(x0 + 18, y0 + 18, CEL_W - 36, CEL_H - 36)

    // Texto: cabe na largura útil, o mais alto possível.
    ctx.fillStyle = letra
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const texto = nome.toUpperCase()
    let tam = 72
    const util = CEL_W - 64
    do {
      ctx.font = `900 ${tam}px "Arial Black", "Helvetica Neue", Arial, sans-serif`
      tam -= 2
    } while (ctx.measureText(texto).width > util && tam > 18)
    // Sombra de letra pintada, deslocada.
    ctx.globalAlpha = 0.28
    ctx.fillStyle = '#000'
    ctx.fillText(texto, x0 + CEL_W / 2 + 3, y0 + CEL_H / 2 + 4)
    ctx.globalAlpha = 1
    ctx.fillStyle = letra
    ctx.fillText(texto, x0 + CEL_W / 2, y0 + CEL_H / 2 + 2)

    // Desgaste: respingos e escorridos discretos, sempre os mesmos por nome.
    let s = h
    const rnd = () => { s = Math.imul(s ^ (s >>> 15), 2246822507) >>> 0; return s / 4294967296 }
    ctx.globalAlpha = 0.10
    for (let k = 0; k < 140; k++) {
      ctx.fillStyle = rnd() < 0.5 ? '#000' : '#fff'
      ctx.fillRect(x0 + rnd() * CEL_W, y0 + rnd() * CEL_H, 1 + rnd() * 3, 1 + rnd() * 3)
    }
    ctx.globalAlpha = 0.12
    ctx.fillStyle = '#000'
    for (let k = 0; k < 5; k++) {
      const ex = x0 + rnd() * CEL_W
      ctx.fillRect(ex, y0 + CEL_H * 0.55, 2 + rnd() * 3, CEL_H * (0.2 + rnd() * 0.4))
    }
    ctx.restore()
    ctx.globalAlpha = 1
    this.textura.needsUpdate = true
  }

  /** Troca o desenho da célula pela arte gerada, se o arquivo chegar. */
  private carregarImagem(slug: string, i: number): void {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const x0 = (i % COLS) * CEL_W
      const y0 = Math.floor(i / COLS) * CEL_H
      this.ctx.drawImage(img, x0, y0, CEL_W, CEL_H)
      this.textura.needsUpdate = true
    }
    // Sem o arquivo, a placa desenhada continua valendo.
    img.onerror = () => {}
    img.src = `placas/${slug}.png`
  }
}

let atlas: AtlasPlacas | null = null

/** Atlas único de placas, compartilhado pela cidade inteira. */
export function atlasPlacas(): AtlasPlacas {
  if (!atlas) atlas = new AtlasPlacas()
  return atlas
}

/**
 * Retângulo de placa voltado para +Z, com as coordenadas de textura apontando
 * para a célula de `nome` no atlas.
 */
export function geometriaPlaca(nome: string, largura: number, altura: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(largura, altura)
  const [u0, v0, u1, v1] = atlasPlacas().uv(nome)
  const uv = g.attributes.uv as THREE.BufferAttribute
  for (let k = 0; k < uv.count; k++) {
    uv.setXY(k, u0 + uv.getX(k) * (u1 - u0), v0 + uv.getY(k) * (v1 - v0))
  }
  return g
}
