/**
 * Salvamento local.
 *
 * Guarda aparência, posição segura, progresso, itens, veículos e horário do
 * mundo. Tudo é versionado e validado na leitura: um arquivo corrompido ou de
 * versão antiga nunca derruba o jogo — ele volta ao estado inicial e avisa.
 */

import type { Appearance } from '../character/appearance'
import { defaultAppearance } from '../character/appearance'

export const VERSAO_SAVE = 3
const PREFIXO = 'thegrounds.save'

export interface ProgressoJogo {
  /** Dinheiro do jogador. */
  dinheiro: number
  /** Identificadores de pontos de interesse descobertos. */
  descobertos: string[]
  /** Itens de vestuário desbloqueados. */
  itens: string[]
  /** Veículos na garagem (classe + semente). */
  garagem: { classe: string; seed: number; nome: string }[]
  /** Entregas concluídas. */
  entregas: number
  /** Partidas jogadas, vitórias e gols. */
  partidas: number
  vitorias: number
  gols: number
  /** Desafios de direção concluídos. */
  desafios: string[]
  /** Fotos tiradas em locais marcados. */
  fotos: string[]
  /** Distância percorrida a pé e de carro, em metros. */
  distanciaAPe: number
  distanciaDeCarro: number
  /** Tempo total jogado, em segundos. */
  tempoJogado: number
}

export function progressoInicial(): ProgressoJogo {
  return {
    dinheiro: 250,
    descobertos: [],
    itens: [],
    garagem: [],
    entregas: 0,
    partidas: 0,
    vitorias: 0,
    gols: 0,
    desafios: [],
    fotos: [],
    distanciaAPe: 0,
    distanciaDeCarro: 0,
    tempoJogado: 0,
  }
}

export interface SaveData {
  versao: number
  criadoEm: number
  atualizadoEm: number
  nome: string
  aparencia: Appearance
  posicao: { x: number; y: number; z: number; yaw: number }
  hora: number
  progresso: ProgressoJogo
}

export interface ResumoSave {
  slot: number
  existe: boolean
  nome: string
  atualizadoEm: number
  tempoJogado: number
  bairro: string
}

function chave(slot: number): string { return `${PREFIXO}.${slot}` }

export function saveDisponivel(): boolean {
  try {
    const k = `${PREFIXO}.teste`
    localStorage.setItem(k, '1')
    localStorage.removeItem(k)
    return true
  } catch {
    return false
  }
}

export function gravar(slot: number, dados: Omit<SaveData, 'versao' | 'criadoEm' | 'atualizadoEm'>): boolean {
  try {
    const anterior = ler(slot)
    const completo: SaveData = {
      versao: VERSAO_SAVE,
      criadoEm: anterior?.criadoEm ?? Date.now(),
      atualizadoEm: Date.now(),
      ...dados,
    }
    localStorage.setItem(chave(slot), JSON.stringify(completo))
    return true
  } catch {
    return false
  }
}

export function ler(slot: number): SaveData | null {
  try {
    const bruto = localStorage.getItem(chave(slot))
    if (!bruto) return null
    const d = JSON.parse(bruto) as Partial<SaveData>
    if (!d || typeof d !== 'object') return null
    if (d.versao !== VERSAO_SAVE) return null
    if (!d.aparencia || !d.posicao) return null
    return {
      versao: VERSAO_SAVE,
      criadoEm: d.criadoEm ?? Date.now(),
      atualizadoEm: d.atualizadoEm ?? Date.now(),
      nome: d.nome ?? 'Jogador',
      aparencia: { ...defaultAppearance(), ...d.aparencia },
      posicao: {
        x: Number(d.posicao.x) || 0,
        y: Number(d.posicao.y) || 0,
        z: Number(d.posicao.z) || 0,
        yaw: Number(d.posicao.yaw) || 0,
      },
      hora: typeof d.hora === 'number' ? d.hora : 9.5,
      progresso: { ...progressoInicial(), ...(d.progresso ?? {}) },
    }
  } catch {
    return null
  }
}

export function apagar(slot: number): void {
  try { localStorage.removeItem(chave(slot)) } catch { /* sem armazenamento */ }
}

export function apagarTudo(): void {
  try {
    for (let i = 0; i < 4; i++) localStorage.removeItem(chave(i))
    localStorage.removeItem('thegrounds.settings.v1')
  } catch { /* sem armazenamento */ }
}

export function resumos(nomeBairro: (x: number, z: number) => string): ResumoSave[] {
  const out: ResumoSave[] = []
  for (let slot = 0; slot < 3; slot++) {
    const d = ler(slot)
    out.push(d
      ? {
        slot, existe: true, nome: d.nome, atualizadoEm: d.atualizadoEm,
        tempoJogado: d.progresso.tempoJogado,
        bairro: nomeBairro(d.posicao.x, d.posicao.z),
      }
      : { slot, existe: false, nome: '', atualizadoEm: 0, tempoJogado: 0, bairro: '' })
  }
  return out
}

/** "2 h 14 min" a partir de segundos. */
export function formatarDuracao(segundos: number): string {
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  if (h > 0) return `${h} h ${m} min`
  if (m > 0) return `${m} min`
  return `${Math.floor(segundos)} s`
}

export function formatarData(ts: number): string {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
