// Tutoria com IA: explicar o erro, tirar duvida e dar dica sem entregar a
// resposta. Tudo tem plano B local, para o app nunca ficar mudo.
import type { Phrase } from '../state/types'


export type Explanation = {
  /** qual servico respondeu */
  by?: string
  short: string
  rule: string
  examples: { text: string; pt: string }[]
  trick: string
  mistake?: string
  offline?: boolean
}

export type AskReply = { answer: string; examples?: string[]; offline?: boolean }

import { chainFor } from './api'

async function post<T>(path: string, body: unknown, task: 'fast' | 'smart' = 'smart'): Promise<T> {
  const chain = chainFor(task)
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...(body as object), ...(chain.length ? { chain } : {}) }),
  })
  if (!r.ok) {
    let msg = `servidor respondeu ${r.status}`
    try {
      const j = await r.json()
      if (j.error) msg = String(j.error)
    } catch {
      /* resposta sem json */
    }
    throw new Error(msg)
  }
  return (await r.json()) as T
}

export type ExplainCtx = {
  langName: string
  prompt: string
  correct: string
  given: string
  lessonTitle?: string
  grammar?: string
  level: string
  mood: string
}

export async function explain(ctx: ExplainCtx): Promise<Explanation> {
  return post<Explanation>('/api/explain', ctx)
}

/** Explicacao de emergencia, montada com o que o proprio curso ja sabe. */
export function offlineExplanation(phrase: Phrase, given: string, grammar?: { title: string; body: string }): Explanation {
  return {
    short: given.trim()
      ? `Você respondeu “${given.trim()}”, e o certo é “${phrase.t}”.`
      : `A resposta certa é “${phrase.t}”.`,
    rule: phrase.tip ?? grammar?.body ?? 'Compare palavra por palavra com a resposta certa: quase sempre o que muda é a ordem ou uma palavrinha pequena.',
    examples: [{ text: phrase.t, pt: phrase.pt }, ...(phrase.rom ? [{ text: phrase.rom, pt: 'como se lê' }] : [])],
    trick: grammar?.title ? `Lembra do ponto da lição: ${grammar.title}.` : 'Leia a frase certa em voz alta três vezes — o ouvido grava o que a gramática não grava.',
    offline: true,
  }
}

export async function ask(body: {
  langName: string
  question: string
  level: string
  context: { prompt: string; correct: string; given: string; explanation?: string }
  history: { role: 'user' | 'voca'; text: string }[]
}): Promise<AskReply> {
  return post<AskReply>('/api/ask', body)
}

export async function hint(body: {
  langName: string
  prompt: string
  correct: string
  given: string
  level: string
  strength: number
}): Promise<{ hint: string }> {
  // dica e no meio do exercicio: aqui velocidade importa mais
  return post<{ hint: string }>('/api/hint', body, 'fast')
}

/** Dica local: nao precisa de IA nem de internet. */
export function offlineHint(correct: string, strength: number, tip?: string) {
  const palavras = correct.trim().split(/\s+/)
  if (strength <= 1) {
    return tip
      ? `💡 ${tip}`
      : `💡 A resposta tem ${palavras.length} ${palavras.length === 1 ? 'palavra' : 'palavras'}.`
  }
  return `💡 Começa com “${palavras[0]}” e tem ${palavras.length} ${palavras.length === 1 ? 'palavra' : 'palavras'}.`
}
