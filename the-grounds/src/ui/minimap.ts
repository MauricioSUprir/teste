/**
 * Minimapa e mapa grande, desenhados em canvas 2D a partir do traçado urbano.
 *
 * Desenhar o mapa a partir dos mesmos dados que geram a cidade garante que ele
 * nunca fique desatualizado, e custa muito menos que renderizar a cena de cima.
 */

import type { CityLayout } from '../world/layout'
import { CityLayout as Layout } from '../world/layout'
import { MAP_HALF, riverDistance } from '../world/terrain'
import type { PitchSpec } from '../world/blocks'

export interface MarcadorMapa {
  x: number
  z: number
  cor: string
  rotulo?: string
  tipo?: 'destino' | 'campo' | 'loja' | 'casa' | 'veiculo' | 'ponto'
}

const COR = {
  fundo: '#10171f',
  agua: '#17394a',
  quadra: '#1b2530',
  parque: '#1d3324',
  rua: '#39434e',
  avenida: '#4d5865',
  calcada: '#2a323b',
  campo: '#2f6b3f',
  texto: '#9fb0be',
}

export class MapRenderer {
  constructor(private readonly layout: CityLayout, private readonly pitches: readonly PitchSpec[]) {}

  /**
   * Desenha a região ao redor de (cx, cz). `escala` é em pixels por metro.
   * `rotacionar` alinha o mapa com a direção do jogador (típico de minimapa).
   */
  desenhar(
    ctx: CanvasRenderingContext2D,
    largura: number, altura: number,
    cx: number, cz: number, escala: number,
    opts: {
      rotacao?: number
      marcadores?: MarcadorMapa[]
      jogadorYaw?: number
      mostrarNomes?: boolean
      redondo?: boolean
    } = {},
  ): void {
    const raio = Math.hypot(largura, altura) / (2 * escala)
    ctx.save()
    ctx.clearRect(0, 0, largura, altura)
    ctx.fillStyle = COR.fundo
    ctx.fillRect(0, 0, largura, altura)

    if (opts.redondo) {
      ctx.beginPath()
      ctx.arc(largura / 2, altura / 2, Math.min(largura, altura) / 2, 0, Math.PI * 2)
      ctx.clip()
    }

    ctx.translate(largura / 2, altura / 2)
    if (opts.rotacao) ctx.rotate(opts.rotacao)
    ctx.scale(escala, escala)
    ctx.translate(-cx, -cz)

    this.desenharAgua(ctx, cx, cz, raio)
    this.desenharQuadras(ctx, cx, cz, raio)
    this.desenharVias(ctx, cx, cz, raio)
    this.desenharCampos(ctx, cx, cz, raio, escala, opts.mostrarNomes ?? false)

    for (const m of opts.marcadores ?? []) {
      if (Math.hypot(m.x - cx, m.z - cz) > raio * 1.1) continue
      ctx.fillStyle = m.cor
      ctx.beginPath()
      const r = 4 / escala
      ctx.arc(m.x, m.z, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.lineWidth = 1.4 / escala
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'
      ctx.stroke()
    }

    ctx.restore()

    // Seta do jogador, sempre no centro.
    ctx.save()
    ctx.translate(largura / 2, altura / 2)
    if (!opts.rotacao && opts.jogadorYaw !== undefined) ctx.rotate(-opts.jogadorYaw)
    ctx.fillStyle = '#f2c230'
    ctx.strokeStyle = 'rgba(0,0,0,0.75)'
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(0, -8)
    ctx.lineTo(5.6, 6)
    ctx.lineTo(0, 3)
    ctx.lineTo(-5.6, 6)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }

  private desenharAgua(ctx: CanvasRenderingContext2D, cx: number, cz: number, raio: number): void {
    // Amostragem grosseira do corredor do rio dentro da janela visível.
    const passo = Math.max(6, raio / 26)
    ctx.fillStyle = COR.agua
    for (let x = cx - raio; x <= cx + raio; x += passo) {
      for (let z = cz - raio; z <= cz + raio; z += passo) {
        if (riverDistance(x, z) < 30) ctx.fillRect(x - passo / 2, z - passo / 2, passo * 1.05, passo * 1.05)
      }
    }
  }

  private desenharQuadras(ctx: CanvasRenderingContext2D, cx: number, cz: number, raio: number): void {
    for (const b of this.layout.blocksNear(cx, cz, raio)) {
      if (b.kind === 'vazio') continue
      ctx.fillStyle = b.kind === 'parque' || b.kind === 'praca' ? COR.parque
        : b.kind === 'campo' || b.kind === 'quadra' || b.kind === 'arena' ? COR.campo
          : COR.quadra
      ctx.fillRect(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0)
    }
  }

  private desenharVias(ctx: CanvasRenderingContext2D, cx: number, cz: number, raio: number): void {
    ctx.lineCap = 'round'
    for (const grupo of [this.layout.xLines, this.layout.zLines]) {
      for (const l of grupo) {
        const perto = l.axis === 'x'
          ? Math.abs(l.pos - cx) < raio + 20
          : Math.abs(l.pos - cz) < raio + 20
        if (!perto) continue
        ctx.strokeStyle = l.avenue ? COR.avenida : COR.rua
        ctx.lineWidth = Layout.halfWidth(l) * 2
        for (const [a, b] of l.spans) {
          const de = Math.max(a, (l.axis === 'x' ? cz : cx) - raio - 20)
          const ate = Math.min(b, (l.axis === 'x' ? cz : cx) + raio + 20)
          if (ate - de < 1) continue
          ctx.beginPath()
          if (l.axis === 'x') { ctx.moveTo(l.pos, de); ctx.lineTo(l.pos, ate) }
          else { ctx.moveTo(de, l.pos); ctx.lineTo(ate, l.pos) }
          ctx.stroke()
        }
      }
    }
  }

  private desenharCampos(
    ctx: CanvasRenderingContext2D, cx: number, cz: number, raio: number,
    escala: number, nomes: boolean,
  ): void {
    for (const p of this.pitches) {
      if (Math.hypot(p.x - cx, p.z - cz) > raio * 1.15) continue
      ctx.save()
      ctx.translate(p.x, p.z)
      ctx.rotate(p.yaw)
      ctx.strokeStyle = '#5fce8a'
      ctx.lineWidth = 1.6 / escala
      ctx.strokeRect(-p.halfLength, -p.halfWidth, p.halfLength * 2, p.halfWidth * 2)
      ctx.restore()
      if (nomes) {
        ctx.save()
        ctx.translate(p.x, p.z - p.halfWidth - 6 / escala)
        ctx.scale(1 / escala, 1 / escala)
        ctx.fillStyle = COR.texto
        ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(p.name, 0, 0)
        ctx.restore()
      }
    }
  }

  /** Mapa completo da cidade, ajustado ao tamanho do canvas. */
  desenharCompleto(
    ctx: CanvasRenderingContext2D, largura: number, altura: number,
    jogadorX: number, jogadorZ: number, jogadorYaw: number,
    marcadores: MarcadorMapa[] = [],
  ): void {
    const escala = Math.min(largura, altura) / (MAP_HALF * 2 + 80)
    ctx.save()
    ctx.clearRect(0, 0, largura, altura)
    ctx.fillStyle = COR.fundo
    ctx.fillRect(0, 0, largura, altura)
    ctx.translate(largura / 2, altura / 2)
    ctx.scale(escala, escala)

    this.desenharAgua(ctx, 0, 0, MAP_HALF * 1.45)
    this.desenharQuadras(ctx, 0, 0, MAP_HALF * 1.45)
    this.desenharVias(ctx, 0, 0, MAP_HALF * 1.45)
    this.desenharCampos(ctx, 0, 0, MAP_HALF * 1.45, escala, false)

    for (const m of marcadores) {
      ctx.fillStyle = m.cor
      ctx.beginPath()
      ctx.arc(m.x, m.z, 6 / escala, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()

    // Jogador
    ctx.save()
    ctx.translate(largura / 2 + jogadorX * escala, altura / 2 + jogadorZ * escala)
    ctx.rotate(-jogadorYaw)
    ctx.fillStyle = '#f2c230'
    ctx.strokeStyle = 'rgba(0,0,0,0.8)'
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(0, -9)
    ctx.lineTo(6, 7)
    ctx.lineTo(0, 3.5)
    ctx.lineTo(-6, 7)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }
}
