/**
 * Atividades da cidade: entregas, desafios de direção, pontos de interesse,
 * desafios esportivos e fotografia.
 *
 * Cada atividade reaproveita os sistemas que já existem — o mapa, os veículos,
 * a bola, a câmera — em vez de criar mecânicas paralelas.
 */

import * as THREE from 'three'
import { clamp, makeRng, pick, randRange, type Rng } from '../core/math'
import type { World } from '../world/world'
import type { BuildingSpec } from '../world/buildings'
import type { ProgressoJogo } from '../save/save'

export type TipoAtividade = 'entrega' | 'direcao' | 'ponto' | 'esporte' | 'foto'

export interface Atividade {
  id: string
  tipo: TipoAtividade
  titulo: string
  descricao: string
  /** Posição do objetivo atual. */
  alvo: THREE.Vector3
  /** Raio de conclusão do objetivo. */
  raio: number
  /** Recompensa em dinheiro. */
  recompensa: number
  /** Etapas restantes (percursos têm várias). */
  etapas: THREE.Vector3[]
  etapaAtual: number
  /** Limite de tempo em segundos; 0 = sem limite. */
  tempoLimite: number
  tempoDecorrido: number
  ativa: boolean
  concluida: boolean
  /** Exige estar dirigindo. */
  exigeVeiculo: boolean
}

const NOMES_ENTREGA = [
  'Encomenda para a padaria', 'Pacote da loja de esportes', 'Documentos do escritório',
  'Remédio da farmácia', 'Peças para a oficina', 'Marmita do almoço',
]

const NOMES_PONTO = [
  'Mirante do Alto', 'Ponte do Sanhaço', 'Praça Central', 'Campo da Vila',
  'Orla do Rio', 'Estação Velha', 'Arena Vila Preciosa', 'Parque da Enseada',
]

export interface MarcadorAtividade {
  x: number
  z: number
  cor: string
  rotulo: string
}

export class ActivityManager {
  readonly disponiveis: Atividade[] = []
  ativa: Atividade | null = null
  private rng: Rng
  private proximaGeracao = 0
  /** Pontos de interesse fixos, descobertos ao chegar perto. */
  readonly pontosInteresse: { id: string; nome: string; x: number; z: number; raio: number }[] = []

  constructor(private readonly world: World, seed = 31337) {
    this.rng = makeRng(seed)
    this.montarPontosInteresse()
  }

  private montarPontosInteresse(): void {
    const marcos: [string, number, number][] = [
      ['mirante', 430, -470], ['ponte', 250, 40], ['praca-central', 0, -150],
      ['orla', -520, 260], ['ferroviario', -660, -60], ['parque', -40, 520],
    ]
    marcos.forEach(([id, x, z], i) => {
      this.pontosInteresse.push({ id, nome: NOMES_PONTO[i % NOMES_PONTO.length], x, z, raio: 34 })
    })
    for (const p of this.world.pitches) {
      this.pontosInteresse.push({ id: p.id, nome: p.name, x: p.x, z: p.z, raio: 30 })
    }
  }

  /** Gera ofertas de atividade ao redor do jogador. */
  atualizar(dt: number, posicao: THREE.Vector3, progresso: ProgressoJogo, dirigindo: boolean): string | null {
    this.proximaGeracao -= dt
    if (this.proximaGeracao <= 0) {
      this.proximaGeracao = 20
      this.repor(posicao)
    }

    // Descoberta de pontos de interesse
    for (const p of this.pontosInteresse) {
      if (progresso.descobertos.includes(p.id)) continue
      if (Math.hypot(p.x - posicao.x, p.z - posicao.z) < p.raio) {
        progresso.descobertos.push(p.id)
        progresso.dinheiro += 25
        return `Ponto de interesse descoberto: ${p.nome} (+R$ 25)`
      }
    }

    const a = this.ativa
    if (!a) return null

    a.tempoDecorrido += dt
    if (a.tempoLimite > 0 && a.tempoDecorrido > a.tempoLimite) {
      this.ativa = null
      return `Tempo esgotado — ${a.titulo}`
    }
    if (a.exigeVeiculo && !dirigindo) {
      // Não cancela: apenas não conta progresso fora do carro.
      return null
    }

    const alvo = a.etapas[a.etapaAtual]
    if (!alvo) return null
    if (Math.hypot(alvo.x - posicao.x, alvo.z - posicao.z) < a.raio) {
      a.etapaAtual++
      if (a.etapaAtual >= a.etapas.length) {
        a.concluida = true
        this.ativa = null
        progresso.dinheiro += a.recompensa
        if (a.tipo === 'entrega') progresso.entregas++
        if (a.tipo === 'direcao' && !progresso.desafios.includes(a.id)) progresso.desafios.push(a.id)
        if (a.tipo === 'foto' && !progresso.fotos.includes(a.id)) progresso.fotos.push(a.id)
        const i = this.disponiveis.indexOf(a)
        if (i >= 0) this.disponiveis.splice(i, 1)
        return `${a.titulo} concluída — R$ ${a.recompensa}`
      }
      a.alvo.copy(a.etapas[a.etapaAtual])
      return `Ponto ${a.etapaAtual} de ${a.etapas.length}`
    }
    return null
  }

  aceitar(a: Atividade): void {
    this.ativa = a
    a.ativa = true
    a.etapaAtual = 0
    a.tempoDecorrido = 0
    a.alvo.copy(a.etapas[0])
  }

  cancelar(): void {
    if (this.ativa) this.ativa.ativa = false
    this.ativa = null
  }

  /** Repõe as ofertas próximas ao jogador. */
  private repor(posicao: THREE.Vector3): void {
    // Descarta ofertas distantes que não foram aceitas.
    for (let i = this.disponiveis.length - 1; i >= 0; i--) {
      const a = this.disponiveis[i]
      if (a === this.ativa) continue
      if (a.etapas[0].distanceTo(posicao) > 300) this.disponiveis.splice(i, 1)
    }
    if (this.disponiveis.length >= 5) return

    const predios = this.world.buildingsNear(posicao.x, posicao.z, 180)
    if (predios.length < 4) return

    const tipo: TipoAtividade = pick(this.rng, ['entrega', 'entrega', 'direcao', 'foto', 'esporte'])
    switch (tipo) {
      case 'entrega': this.criarEntrega(predios); break
      case 'direcao': this.criarDesafioDirecao(posicao); break
      case 'foto': this.criarFoto(posicao); break
      case 'esporte': this.criarEsporte(posicao); break
      default: break
    }
  }

  private criarEntrega(predios: BuildingSpec[]): void {
    const origem = pick(this.rng, predios)
    const destino = pick(this.rng, predios.filter((b) => b !== origem))
    if (!destino) return
    const dist = Math.hypot(destino.x - origem.x, destino.z - origem.z)
    const a: Atividade = {
      id: `entrega-${origem.id}-${destino.id}`,
      tipo: 'entrega',
      titulo: pick(this.rng, NOMES_ENTREGA),
      descricao: `Retirar e levar a ${Math.round(dist)} m`,
      alvo: new THREE.Vector3(origem.door.x, origem.baseY, origem.door.z),
      raio: 3.5,
      recompensa: Math.round(40 + dist * 0.35),
      etapas: [
        new THREE.Vector3(origem.door.x, origem.baseY, origem.door.z),
        new THREE.Vector3(destino.door.x, destino.baseY, destino.door.z),
      ],
      etapaAtual: 0,
      tempoLimite: Math.max(120, dist * 1.4),
      tempoDecorrido: 0,
      ativa: false,
      concluida: false,
      exigeVeiculo: false,
    }
    if (!this.disponiveis.some((x) => x.id === a.id)) this.disponiveis.push(a)
  }

  private criarDesafioDirecao(posicao: THREE.Vector3): void {
    // Cinco pontos sobre a malha viária, formando um percurso.
    const etapas: THREE.Vector3[] = []
    let atual = posicao.clone()
    for (let i = 0; i < 5; i++) {
      let achou: THREE.Vector3 | null = null
      for (let t = 0; t < 30; t++) {
        const ang = this.rng() * Math.PI * 2
        const raio = randRange(this.rng, 70, 150)
        const x = atual.x + Math.cos(ang) * raio
        const z = atual.z + Math.sin(ang) * raio
        const perto = this.world.layout.nearestRoad(x, z)
        if (perto && perto.dist < 6) {
          const px = perto.line.axis === 'x' ? perto.line.pos : perto.t
          const pz = perto.line.axis === 'x' ? perto.t : perto.line.pos
          achou = new THREE.Vector3(px, this.world.groundHeight(px, pz), pz)
          break
        }
      }
      if (!achou) break
      etapas.push(achou)
      atual = achou
    }
    if (etapas.length < 3) return
    const id = `direcao-${Math.round(etapas[0].x)}-${Math.round(etapas[0].z)}`
    if (this.disponiveis.some((x) => x.id === id)) return
    this.disponiveis.push({
      id, tipo: 'direcao',
      titulo: 'Percurso cronometrado',
      descricao: `${etapas.length} pontos pela cidade, de carro`,
      alvo: etapas[0].clone(),
      raio: 9,
      recompensa: 120 + etapas.length * 25,
      etapas,
      etapaAtual: 0,
      tempoLimite: etapas.length * 26,
      tempoDecorrido: 0,
      ativa: false, concluida: false, exigeVeiculo: true,
    })
  }

  private criarFoto(posicao: THREE.Vector3): void {
    const candidatos = this.pontosInteresse.filter(
      (p) => Math.hypot(p.x - posicao.x, p.z - posicao.z) < 420,
    )
    if (candidatos.length === 0) return
    const p = pick(this.rng, candidatos)
    const id = `foto-${p.id}`
    if (this.disponiveis.some((x) => x.id === id)) return
    this.disponiveis.push({
      id, tipo: 'foto',
      titulo: `Fotografar: ${p.nome}`,
      descricao: 'Vá até o local e use o modo fotografia',
      alvo: new THREE.Vector3(p.x, this.world.groundHeight(p.x, p.z), p.z),
      raio: 16,
      recompensa: 60,
      etapas: [new THREE.Vector3(p.x, this.world.groundHeight(p.x, p.z), p.z)],
      etapaAtual: 0,
      tempoLimite: 0,
      tempoDecorrido: 0,
      ativa: false, concluida: false, exigeVeiculo: false,
    })
  }

  private criarEsporte(posicao: THREE.Vector3): void {
    const campo = this.world.nearestPitch(posicao.x, posicao.z)
    if (!campo || campo.dist > 400) return
    const id = `esporte-${campo.pitch.id}`
    if (this.disponiveis.some((x) => x.id === id)) return
    this.disponiveis.push({
      id, tipo: 'esporte',
      titulo: `Partida em ${campo.pitch.name}`,
      descricao: 'Chegue ao campo e comece um jogo',
      alvo: new THREE.Vector3(campo.pitch.x, campo.pitch.y, campo.pitch.z),
      raio: 18,
      recompensa: 150,
      etapas: [new THREE.Vector3(campo.pitch.x, campo.pitch.y, campo.pitch.z)],
      etapaAtual: 0,
      tempoLimite: 0,
      tempoDecorrido: 0,
      ativa: false, concluida: false, exigeVeiculo: false,
    })
  }

  /** Marcadores para o mapa e o minimapa. */
  marcadores(): MarcadorAtividade[] {
    const out: MarcadorAtividade[] = []
    if (this.ativa) {
      const alvo = this.ativa.etapas[this.ativa.etapaAtual]
      if (alvo) out.push({ x: alvo.x, z: alvo.z, cor: '#f2c230', rotulo: this.ativa.titulo })
    }
    for (const a of this.disponiveis) {
      if (a === this.ativa) continue
      out.push({ x: a.etapas[0].x, z: a.etapas[0].z, cor: '#7fb2e8', rotulo: a.titulo })
    }
    return out
  }

  /** Distância restante até o objetivo atual, em metros. */
  distanciaAoAlvo(posicao: THREE.Vector3): number | null {
    if (!this.ativa) return null
    const alvo = this.ativa.etapas[this.ativa.etapaAtual]
    if (!alvo) return null
    return Math.hypot(alvo.x - posicao.x, alvo.z - posicao.z)
  }

  /** Oferta mais próxima que o jogador pode aceitar. */
  ofertaProxima(posicao: THREE.Vector3, raio = 6): Atividade | null {
    if (this.ativa) return null
    let melhor: Atividade | null = null
    let d = raio
    for (const a of this.disponiveis) {
      const dd = a.etapas[0].distanceTo(posicao)
      if (dd < d) { d = dd; melhor = a }
    }
    return melhor
  }
}

/** Formata o tempo restante de uma atividade. */
export function tempoRestante(a: Atividade): string {
  if (a.tempoLimite <= 0) return ''
  const r = clamp(a.tempoLimite - a.tempoDecorrido, 0, 9999)
  const m = Math.floor(r / 60)
  const s = Math.floor(r % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
