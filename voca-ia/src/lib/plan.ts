// Controle de plano. Hoje TUDO esta liberado; a estrutura ja esta pronta para
// quando a cobranca entrar (basta VITE_PAYWALL=on no build, ou ligar pela conta).
import type { SaveData } from '../state/types'

/** Funcoes que serao pagas quando a cobranca for ligada. */
export type ProFeature = 'conversa' | 'explicacao' | 'duvidas' | 'dica-ia'

export const PRO_FEATURES: Record<ProFeature, { title: string; desc: string }> = {
  conversa: { title: 'Conversa contínua', desc: 'Falar por voz com o Voca, sem roteiro, em 10 idiomas.' },
  explicacao: { title: 'Explicação do erro', desc: 'O Voca explica por que errou, com a regra e exemplos.' },
  duvidas: { title: 'Chat de dúvidas', desc: 'Perguntar qualquer coisa sobre a questão e ele responde.' },
  'dica-ia': { title: 'Ajuda do Voca na questão', desc: 'Pistas na hora, sem entregar a resposta.' },
}

/** Liga/desliga a cobranca inteira. Enquanto for false, todo mundo tem tudo. */
export const PAYWALL_ON = import.meta.env.VITE_PAYWALL === 'on'

/** Quantos dias a pessoa tem para pagar depois do vencimento antes de cancelar. */
export const DIAS_DE_CARENCIA = 7
const DIA = 86400000

export type EstadoPlano =
  | 'free' // nunca assinou
  | 'ativo' // em dia
  | 'vencendo' // vence em 3 dias ou menos
  | 'carencia' // venceu, mas ainda dá para pagar
  | 'cancelado' // passou da carência

export function estadoPlano(save: SaveData): EstadoPlano {
  if (save.plan !== 'pro' || !save.proUntil) return save.plan === 'pro' ? 'ativo' : 'free'
  const agora = Date.now()
  if (agora < save.proUntil) {
    return save.proUntil - agora <= 3 * DIA ? 'vencendo' : 'ativo'
  }
  return agora < save.proUntil + DIAS_DE_CARENCIA * DIA ? 'carencia' : 'cancelado'
}

/** Dias que faltam para vencer (positivo) ou para cancelar de vez (na carência). */
export function diasRestantes(save: SaveData) {
  if (!save.proUntil) return 0
  const estado = estadoPlano(save)
  const alvo = estado === 'carencia' ? save.proUntil + DIAS_DE_CARENCIA * DIA : save.proUntil
  return Math.max(0, Math.ceil((alvo - Date.now()) / DIA))
}

/** Na carência o acesso continua: ninguém perde o estudo por causa de um boleto. */
export function isPro(save: SaveData) {
  const e = estadoPlano(save)
  return e === 'ativo' || e === 'vencendo' || e === 'carencia'
}

/** Pode usar a funcao agora? */
export function canUse(save: SaveData, _f: ProFeature) {
  return !PAYWALL_ON || isPro(save)
}

export type Plano = {
  id: string
  title: string
  /** valor cheio, em reais */
  price: number
  /** quantos dias de acesso o pagamento libera */
  days: number
  /** quanto sai por mes, so para comparar */
  perMonth: string
  badge?: string
  destaque?: boolean
  perks: string[]
}

/** Tres planos, pagamento so por Pix. */
export const PLANS: Plano[] = [
  {
    id: 'semanal',
    title: '1 semana',
    price: 14.99,
    days: 7,
    perMonth: 'para experimentar sem compromisso',
    perks: ['Conversa contínua ilimitada', 'Explicação de cada erro', 'Chat de dúvidas', 'Ajuda do Voca nas questões'],
  },
  {
    id: 'mensal',
    title: '1 mês',
    price: 29.99,
    days: 30,
    perMonth: 'R$ 29,99 por mês',
    badge: 'o mais escolhido',
    perks: ['Tudo do semanal', 'Um mês inteiro para criar o hábito', 'Sai menos da metade do preço por dia'],
  },
  {
    id: 'anual',
    title: '1 ano',
    price: 189.99,
    days: 365,
    perMonth: 'sai por R$ 15,83 por mês',
    badge: 'economiza 47%',
    destaque: true,
    perks: ['Tudo do mensal', 'Quase 6 meses de graça na conta', 'O preço trava: reajuste não pega você'],
  },
]

export function reais(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
