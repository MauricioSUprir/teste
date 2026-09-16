// Avaliação de pronúncia sem servidor: comparamos o que o reconhecimento de
// fala ENTENDEU com o que era para ela dizer. Não é um medidor de sotaque —
// é um medidor de "deu para entender?", que no fim é o que importa na rua.
import { canon, levenshtein } from './util'

export type Avaliacao = {
  /** 0 a 100 */
  score: number
  /** palavras que saíram diferentes do esperado */
  erradas: string[]
  /** o que dava para entender do que ela falou */
  ouvido: string
  veredito: 'perfeito' | 'bom' | 'quase' | 'refaz'
}

function palavras(s: string) {
  return canon(s).split(/\s+/).filter(Boolean)
}

/** Duas palavras "batem" se forem iguais ou quase (uma letra de diferença). */
function bate(a: string, b: string) {
  if (a === b) return true
  const tol = a.length > 6 ? 2 : a.length > 3 ? 1 : 0
  return levenshtein(a, b) <= tol
}

export function avaliarFala(alvo: string, ouvido: string): Avaliacao {
  const esperadas = palavras(alvo)
  const ditas = palavras(ouvido)
  if (!esperadas.length) return { score: 0, erradas: [], ouvido, veredito: 'refaz' }

  const sobrando = [...ditas]
  const erradas: string[] = []
  let acertos = 0

  for (const p of esperadas) {
    const i = sobrando.findIndex((d) => bate(p, d))
    if (i >= 0) {
      acertos++
      sobrando.splice(i, 1)
    } else {
      erradas.push(p)
    }
  }

  // falar palavras a mais também atrapalha, mas menos do que faltar
  const excesso = Math.max(0, sobrando.length - 1) * 0.5
  const score = Math.max(0, Math.round(((acertos - excesso) / esperadas.length) * 100))
  const veredito = score >= 95 ? 'perfeito' : score >= 80 ? 'bom' : score >= 55 ? 'quase' : 'refaz'
  return { score, erradas, ouvido, veredito }
}

/** Média de uma sessão, para o relatório do fim. */
export function mediaDeFala(notas: number[]) {
  if (!notas.length) return 0
  return Math.round(notas.reduce((a, b) => a + b, 0) / notas.length)
}

/** As palavras que mais deram trabalho na sessão. */
export function palavrasDificeis(todas: string[][], limite = 5) {
  const conta = new Map<string, number>()
  for (const lista of todas) for (const p of lista) conta.set(p, (conta.get(p) ?? 0) + 1)
  return [...conta.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limite)
    .map(([p, n]) => ({ palavra: p, vezes: n }))
}
