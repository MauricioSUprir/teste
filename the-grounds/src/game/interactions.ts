/**
 * Camada de interação com o mundo: o que o jogador pode fazer ao se aproximar
 * de portas, bancos, interruptores, lojas, elevadores, veículos, bolas e
 * pessoas.
 *
 * Cada ponto de interação é registrado com uma posição, um raio e um rótulo; o
 * sistema escolhe o melhor candidato conforme a distância e o ângulo do olhar,
 * o que evita o "prompt" pulando entre objetos próximos.
 */

import * as THREE from 'three'
import { clamp } from '../core/math'

export type InteractionKind =
  | 'porta' | 'portaSaida' | 'sentar' | 'levantar' | 'interruptor' | 'elevador'
  | 'veiculo' | 'sairVeiculo' | 'bola' | 'pessoa' | 'loja' | 'guardaRoupa'
  | 'cama' | 'espelho' | 'geladeira' | 'garagem' | 'placar' | 'pontoOnibus'
  | 'lixeira' | 'maquina' | 'entrega' | 'campo' | 'foto' | 'catraca' | 'tv'

export interface Interaction {
  id: number
  kind: InteractionKind
  /** Texto exibido: "Entrar", "Sentar", "Conversar com Ana"… */
  rotulo: string
  position: THREE.Vector3
  /** Distância máxima para aparecer. */
  raio: number
  /** Executa a ação. Devolve uma mensagem opcional para a interface. */
  executar: () => string | void
  /** Quando presente, só aparece se devolver true. */
  disponivel?: () => boolean
  /** Prioridade em empate (maior ganha). */
  prioridade?: number
  /** Dono do registro, para remoção em lote. */
  owner?: string
  /** Ícone curto para o aviso. */
  icone?: string
}

const ICONES: Partial<Record<InteractionKind, string>> = {
  porta: '🚪', portaSaida: '🚪', sentar: '🪑', levantar: '🧍', interruptor: '💡',
  elevador: '🛗', veiculo: '🚗', sairVeiculo: '🚶', bola: '⚽', pessoa: '💬',
  loja: '🛍️', guardaRoupa: '👕', cama: '🛏️', espelho: '🪞', geladeira: '🍽️',
  garagem: '🚙', placar: '📋', pontoOnibus: '🚌', lixeira: '🗑️', maquina: '🥤',
  entrega: '📦', campo: '🥅', foto: '📷', catraca: '🎫', tv: '📺',
}

export class InteractionSystem {
  private items = new Map<number, Interaction>()
  private byOwner = new Map<string, number[]>()
  private nextId = 1
  /** Melhor candidato do quadro atual. */
  atual: Interaction | null = null
  /** Mensagem temporária exibida depois de uma ação. */
  mensagem = ''
  private mensagemTimer = 0

  registrar(i: Omit<Interaction, 'id'>): number {
    const id = this.nextId++
    const item: Interaction = { ...i, id, icone: i.icone ?? ICONES[i.kind] ?? '·' }
    this.items.set(id, item)
    if (item.owner) {
      const l = this.byOwner.get(item.owner)
      if (l) l.push(id)
      else this.byOwner.set(item.owner, [id])
    }
    return id
  }

  remover(id: number): void {
    this.items.delete(id)
  }

  removerOwner(owner: string): void {
    const l = this.byOwner.get(owner)
    if (!l) return
    for (const id of l) this.items.delete(id)
    this.byOwner.delete(owner)
  }

  limpar(): void {
    this.items.clear()
    this.byOwner.clear()
  }

  get total(): number { return this.items.size }

  /**
   * Escolhe o melhor alvo: combina proximidade e alinhamento com o olhar, de
   * modo que objetos atrás do jogador não roubem o foco.
   */
  atualizar(dt: number, pos: THREE.Vector3, olhar: THREE.Vector3): void {
    this.mensagemTimer = Math.max(0, this.mensagemTimer - dt)
    if (this.mensagemTimer <= 0) this.mensagem = ''

    let melhor: Interaction | null = null
    let melhorNota = -Infinity
    for (const item of this.items.values()) {
      const dx = item.position.x - pos.x
      const dy = item.position.y - pos.y
      const dz = item.position.z - pos.z
      const d = Math.hypot(dx, dy * 0.5, dz)
      if (d > item.raio) continue
      if (item.disponivel && !item.disponivel()) continue

      const len = Math.hypot(dx, dz) || 1
      const alinhamento = (dx / len) * olhar.x + (dz / len) * olhar.z
      if (alinhamento < -0.35 && d > 1.4) continue

      const nota = (1 - d / item.raio) * 2 + clamp(alinhamento, -1, 1) * 1.4 + (item.prioridade ?? 0)
      if (nota > melhorNota) { melhorNota = nota; melhor = item }
    }
    this.atual = melhor
  }

  /** Executa a interação em foco. */
  acionar(): boolean {
    if (!this.atual) return false
    const msg = this.atual.executar()
    if (typeof msg === 'string' && msg.length > 0) this.notificar(msg)
    return true
  }

  notificar(texto: string, segundos = 3): void {
    this.mensagem = texto
    this.mensagemTimer = segundos
  }
}
