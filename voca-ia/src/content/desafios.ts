// Desafio do dia. Muda sozinho a cada dia (sempre o mesmo para o mesmo dia),
// vale XP extra e serve para dar um motivo a mais de abrir o app.
export type TipoDesafio = 'acertos' | 'licoes' | 'falas' | 'revisoes' | 'conversa' | 'traducoes'

export type Desafio = {
  id: string
  emoji: string
  titulo: string
  tipo: TipoDesafio
  meta: number
  xp: number
}

export const DESAFIOS: Desafio[] = [
  { id: 'd1', emoji: '🎯', titulo: 'Acerte 20 respostas hoje', tipo: 'acertos', meta: 20, xp: 30 },
  { id: 'd2', emoji: '📚', titulo: 'Termine 2 lições', tipo: 'licoes', meta: 2, xp: 40 },
  { id: 'd3', emoji: '🗣️', titulo: 'Fale 5 frases em voz alta', tipo: 'falas', meta: 5, xp: 35 },
  { id: 'd4', emoji: '🧠', titulo: 'Revise 15 frases antigas', tipo: 'revisoes', meta: 15, xp: 30 },
  { id: 'd5', emoji: '💬', titulo: 'Converse 10 falas com o Voca', tipo: 'conversa', meta: 10, xp: 45 },
  { id: 'd6', emoji: '🔁', titulo: 'Traduza 5 frases suas', tipo: 'traducoes', meta: 5, xp: 25 },
  { id: 'd7', emoji: '🔥', titulo: 'Acerte 30 respostas hoje', tipo: 'acertos', meta: 30, xp: 50 },
  { id: 'd8', emoji: '🎤', titulo: 'Converse 20 falas com o Voca', tipo: 'conversa', meta: 20, xp: 60 },
]

/** O desafio de hoje — o mesmo para o dia inteiro, e diferente amanhã. */
export function desafioDoDia(dia: string): Desafio {
  let h = 0
  for (let i = 0; i < dia.length; i++) h = (h * 31 + dia.charCodeAt(i)) % 100000
  return DESAFIOS[h % DESAFIOS.length]
}
