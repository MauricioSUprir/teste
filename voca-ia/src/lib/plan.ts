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

export function isPro(save: SaveData) {
  if (save.plan !== 'pro') return false
  return !save.proUntil || save.proUntil > Date.now()
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
  months: number
  /** quanto sai por mes, so para comparar */
  perMonth: string
  badge?: string
  destaque?: boolean
  perks: string[]
}

/** Tres planos, pagamento so por Pix. */
export const PLANS: Plano[] = [
  {
    id: 'mensal',
    title: 'Mensal',
    price: 14.9,
    months: 1,
    perMonth: 'R$ 14,90 por mês',
    perks: ['Conversa contínua ilimitada', 'Explicação de cada erro', 'Chat de dúvidas', 'Ajuda do Voca nas questões'],
  },
  {
    id: 'trimestral',
    title: '3 meses',
    price: 37.9,
    months: 3,
    perMonth: 'sai por R$ 12,63 por mês',
    badge: 'economiza 15%',
    perks: ['Tudo do mensal', 'Um mês sai de graça na conta', 'Bom para fechar um semestre de estudo'],
  },
  {
    id: 'anual',
    title: '1 ano',
    price: 119.9,
    months: 12,
    perMonth: 'sai por R$ 9,99 por mês',
    badge: 'economiza 33%',
    destaque: true,
    perks: ['Tudo do mensal', 'Quase 4 meses de graça', 'O preço trava: reajuste não pega você'],
  },
]

export function reais(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
