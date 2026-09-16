// Série escolar. O conteúdo acompanha o ano da pessoa: o que ela vê na escola,
// o nível esperado e os assuntos que fazem sentido para a idade dela.
import type { Cefr, Difficulty } from '../state/types'

export type Serie = {
  id: string
  label: string
  etapa: 'Fundamental' | 'Médio' | 'Livre'
  idade: string
  /** nível de onde ela costuma partir */
  cefr: Cefr
  dificuldade: Difficulty
  /** assuntos que a escola cobra nesse ano — entram nas conversas e nos exemplos */
  focos: string[]
  /** o que o app prioriza */
  meta: string
}

export const SERIES: Serie[] = [
  {
    id: '6ano',
    label: '6º ano',
    etapa: 'Fundamental',
    idade: '11-12 anos',
    cefr: 'A1',
    dificuldade: 'facil',
    focos: ['alfabeto e números', 'cores e objetos da sala', 'verbo to be', 'família', 'rotina simples'],
    meta: 'Montar as primeiras frases sem medo.',
  },
  {
    id: '7ano',
    label: '7º ano',
    etapa: 'Fundamental',
    idade: '12-13 anos',
    cefr: 'A1',
    dificuldade: 'facil',
    focos: ['presente simples', 'horas e dias', 'comida', 'escola e matérias', 'gostos (like / don’t like)'],
    meta: 'Falar da própria rotina do começo ao fim.',
  },
  {
    id: '8ano',
    label: '8º ano',
    etapa: 'Fundamental',
    idade: '13-14 anos',
    cefr: 'A1',
    dificuldade: 'medio',
    focos: ['presente contínuo', 'passado do verbo to be', 'comparativos', 'lugares da cidade', 'planos'],
    meta: 'Contar o que está acontecendo e o que já aconteceu.',
  },
  {
    id: '9ano',
    label: '9º ano',
    etapa: 'Fundamental',
    idade: '14-15 anos',
    cefr: 'A2',
    dificuldade: 'medio',
    focos: ['passado simples', 'verbos irregulares', 'futuro (will / going to)', 'modais', 'internet e redes'],
    meta: 'Narrar uma história inteira no passado.',
  },
  {
    id: '1em',
    label: '1º ano — Ensino Médio',
    etapa: 'Médio',
    idade: '15-16 anos',
    cefr: 'A2',
    dificuldade: 'medio',
    focos: ['present perfect', 'condicionais básicas', 'opinião', 'trabalho e estágio', 'phrasal verbs'],
    meta: 'Sustentar uma conversa sem travar.',
  },
  {
    id: '2em',
    label: '2º ano — Ensino Médio',
    etapa: 'Médio',
    idade: '16-17 anos',
    cefr: 'B1',
    dificuldade: 'medio',
    focos: ['voz passiva', 'reported speech', 'condicionais', 'textos e interpretação', 'vocabulário acadêmico'],
    meta: 'Entender texto de prova e defender uma opinião.',
  },
  {
    id: '3em',
    label: '3º ano — Ensino Médio',
    etapa: 'Médio',
    idade: '17-18 anos',
    cefr: 'B1',
    dificuldade: 'dificil',
    focos: ['interpretação de texto (ENEM)', 'falsos cognatos', 'conectivos', 'vocabulário de atualidades', 'redação'],
    meta: 'Passar no inglês do ENEM e do vestibular.',
  },
  {
    id: 'livre',
    label: 'Não estou na escola',
    etapa: 'Livre',
    idade: 'qualquer idade',
    cefr: 'A1',
    dificuldade: 'medio',
    focos: ['dia a dia', 'viagem', 'trabalho', 'séries e música'],
    meta: 'Aprender no seu ritmo, sem prova nenhuma.',
  },
]

export function getSerie(id: string | null | undefined) {
  return SERIES.find((s) => s.id === id) ?? null
}

/** Texto que entra no prompt da IA, para ela falar no nível certo. */
export function contextoDaSerie(id: string | null | undefined) {
  const s = getSerie(id)
  if (!s) return ''
  return `The learner is in "${s.label}" of Brazilian school (${s.idade}), expected level ${s.cefr}. ` +
    `School is currently covering: ${s.focos.join(', ')}. Prefer vocabulary and situations that match this age and these topics.` +
    (s.id === '3em' ? ' She is preparing for ENEM/vestibular, so reading comprehension and false friends matter.' : '')
}
