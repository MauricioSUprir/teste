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

export const PLANS = [
  {
    id: 'mensal',
    title: 'VOCA PRO mensal',
    price: 'R$ 19,90',
    period: '/mês',
    perks: ['Conversa contínua ilimitada', 'Explicação de cada erro', 'Chat de dúvidas', 'Ajuda do Voca nas questões'],
  },
  {
    id: 'anual',
    title: 'VOCA PRO anual',
    price: 'R$ 149',
    period: '/ano',
    badge: 'economiza 37%',
    perks: ['Tudo do mensal', '2 meses de graça', 'Prioridade nas novidades'],
  },
]

/** Link de checkout (Stripe, Mercado Pago...). Vazio = pagamento ainda nao ligado. */
export const CHECKOUT_URL = import.meta.env.VITE_CHECKOUT_URL ?? ''
