// Repeticao espacada (SM-2 enxuto). Cartao errado volta no mesmo dia;
// cartao acertado vai ficando mais raro.
import type { SrsCard, Phrase } from '../state/types'
import { hash } from './util'

export const DAY = 86400000

export function cardId(en: string) {
  return 'c' + hash(en.toLowerCase())
}

export function makeCard(p: Phrase, lang: string, source: SrsCard['source'] = 'lesson'): SrsCard {
  return {
    id: cardId(lang + '|' + p.t),
    lang,
    t: p.t,
    pt: p.pt,
    rom: p.rom,
    tip: p.tip,
    source,
    ease: 2.3,
    interval: 0,
    due: Date.now(),
    reps: 0,
    lapses: 0,
  }
}

/** quality: 0 = errou, 1 = quase, 2 = acertou, 3 = acertou de primeira e rapido */
export function review(card: SrsCard, quality: 0 | 1 | 2 | 3): SrsCard {
  const c = { ...card, reps: card.reps + 1 }
  if (quality === 0) {
    c.lapses += 1
    c.ease = Math.max(1.4, c.ease - 0.25)
    c.interval = 0
    c.due = Date.now() + 8 * 60000 // volta em 8 minutos
    return c
  }
  if (quality === 1) {
    c.ease = Math.max(1.5, c.ease - 0.1)
    c.interval = Math.max(1, Math.round(c.interval * 0.6)) || 1
  } else {
    c.ease = Math.min(3.1, c.ease + (quality === 3 ? 0.12 : 0.04))
    c.interval = c.interval === 0 ? 1 : c.interval === 1 ? 3 : Math.round(c.interval * c.ease)
  }
  c.interval = Math.min(c.interval, 180)
  c.due = Date.now() + c.interval * DAY
  return c
}

export function dueCards(srs: Record<string, SrsCard>, now = Date.now()) {
  return Object.values(srs)
    .filter((c) => c.due <= now)
    .sort((a, b) => a.due - b.due)
}

/** Quantos cartoes ja estao "firmes" (intervalo >= 7 dias). */
export function mastered(srs: Record<string, SrsCard>) {
  return Object.values(srs).filter((c) => c.interval >= 7).length
}
