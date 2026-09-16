// Gera os exercicios de uma licao a partir das frases. Usa um gerador
// pseudo-aleatorio com semente: muda a cada tentativa, mas continua estavel
// dentro da mesma sessao.
import type { Difficulty, Exercise, Lesson, Phrase, SrsCard } from '../state/types'
import type { LangDef } from '../content/languages'
import { pick, seeded, shuffle, hash } from './util'

/** Todas as respostas aceitas para uma frase (script nativo, romanizacao e variantes). */
export function answersFor(p: Phrase) {
  return [p.t, ...(p.rom ? [p.rom] : []), ...(p.alt ?? [])]
}

/** Texto que a pessoa digita: romanizacao quando o alfabeto nao e latino. */
export function typedForm(p: Phrase, lang: LangDef) {
  return lang.romanized && p.rom ? p.rom : p.t
}

function bankTokens(text: string, rnd: () => number, extra: string[]) {
  const real = text.split(/\s+/).filter(Boolean)
  const noise = extra
    .flatMap((s) => s.split(/\s+/))
    .filter((w) => w.length > 1 && !real.includes(w))
  return shuffle([...real, ...pick(noise, Math.min(3, noise.length), rnd)], rnd)
}

export type BuildOpts = {
  /** inclui exercicio de fala (so quando o microfone existe) */
  speech: boolean
  /** quantas frases entram */
  size?: number
  /** quanto o app pega no pe */
  difficulty?: Difficulty
}

/**
 * Que tipos de exercicio cada dificuldade usa.
 * facil   — reconhecer: escolher, ligar, montar com blocos
 * medio   — mistura tudo
 * dificil — produzir: escrever do zero, ouvir sem apoio, falar
 */
const SLOTS: Record<Difficulty, number[]> = {
  facil: [1, 2, 4, 1, 2, 3],
  medio: [0, 1, 2, 3, 4, 5],
  dificil: [0, 3, 5, 0, 3, 0],
}

export function buildLesson(lang: LangDef, lesson: Lesson, attempt: number, opts: BuildOpts): Exercise[] {
  const rnd = seeded(hash(lang.id + lesson.id) + attempt * 7919)
  const phrases = lesson.phrases
  const chosen = opts.size ? pick(phrases, opts.size, rnd) : shuffle(phrases, rnd)
  const out: Exercise[] = []

  chosen.forEach((p, i) => {
    const others = phrases.filter((x) => x.t !== p.t)
    const id = `${lesson.id}-${i}`
    const answers = answersFor(p)
    const typed = typedForm(p, lang)
    // roda os tipos de exercicio para nao cair tudo igual, dentro do que a
    // dificuldade escolhida permite
    const table = SLOTS[opts.difficulty ?? 'medio']
    const slot = table[(i + Math.floor(rnd() * 3)) % table.length]
    if (slot === 0) {
      out.push({ kind: 'translate-pt-en', id, phrase: p, prompt: p.pt, answers })
    } else if (slot === 1) {
      const c = buildChoice(p, others, rnd)
      out.push({ kind: 'choice', id, phrase: p, prompt: p.pt, sub: 'Escolha a tradução certa', options: c.options, correct: c.correct })
    } else if (slot === 2) {
      out.push({ kind: 'bank', id, phrase: p, prompt: p.pt, answers: [typed, ...answers], bank: bankTokens(typed, rnd, others.map((o) => typedForm(o, lang))) })
    } else if (slot === 3) {
      out.push({ kind: 'listen', id, phrase: p, answers })
    } else if (slot === 4) {
      out.push({ kind: 'translate-en-pt', id, phrase: p, prompt: p.t, answers: [p.pt] })
    } else {
      const f = buildFill(p, others, rnd, lang)
      if (f) out.push({ ...f, id })
      else out.push({ kind: 'translate-pt-en', id, phrase: p, prompt: p.pt, answers })
    }
  })

  // ligar pares so nos niveis mais leves — no dificil ela tem que produzir
  if (phrases.length >= 4 && (opts.difficulty ?? 'medio') !== 'dificil') {
    const pairs = pick(phrases, 4, rnd).map((p) => ({ t: p.t, pt: p.pt }))
    out.splice(Math.min(3, out.length), 0, { kind: 'match', id: `${lesson.id}-match`, pairs })
  }

  // fala no fim, quando o navegador tem microfone
  if (opts.speech) {
    const p = pick(phrases, 1, rnd)[0]
    out.push({ kind: 'speak', id: `${lesson.id}-speak`, phrase: p })
  }
  return out
}

function buildChoice(p: Phrase, others: Phrase[], rnd: () => number) {
  const wrong = pick(others, 3, rnd).map((o) => o.t)
  const options = shuffle([p.t, ...wrong], rnd)
  return { options, correct: options.indexOf(p.t) }
}

function buildFill(p: Phrase, others: Phrase[], rnd: () => number, lang: LangDef) {
  const text = typedForm(p, lang)
  const tokens = text.split(/\s+/)
  if (tokens.length < 3) return null
  const idx = 1 + Math.floor(rnd() * (tokens.length - 2))
  const target = tokens[idx]
  const distract = pick(
    others.flatMap((o) => typedForm(o, lang).split(/\s+/)).filter((w) => w.length > 1 && w !== target),
    3,
    rnd,
  )
  return {
    kind: 'fill' as const,
    phrase: p,
    before: tokens.slice(0, idx).join(' '),
    after: tokens.slice(idx + 1).join(' '),
    answers: [target],
    options: shuffle([target, ...distract], rnd),
  }
}

/** Sessao de revisao montada a partir dos cartoes vencidos. */
export function buildReview(cards: SrsCard[], lang: LangDef, speech: boolean): Exercise[] {
  const rnd = seeded(Date.now() % 100000)
  const out: Exercise[] = []
  cards.slice(0, 15).forEach((c, i) => {
    const p: Phrase = { t: c.t, pt: c.pt, rom: c.rom, tip: c.tip }
    const answers = answersFor(p)
    const id = `rev-${i}`
    const slot = i % 3
    if (slot === 0) out.push({ kind: 'translate-pt-en', id, phrase: p, prompt: p.pt, answers })
    else if (slot === 1) out.push({ kind: 'listen', id, phrase: p, answers })
    else {
      const typed = typedForm(p, lang)
      out.push({
        kind: 'bank',
        id,
        phrase: p,
        prompt: p.pt,
        answers: [typed, ...answers],
        bank: bankTokens(typed, rnd, cards.filter((x) => x.id !== c.id).map((x) => (lang.romanized && x.rom ? x.rom : x.t))),
      })
    }
  })
  if (speech && cards.length) {
    const c = cards[0]
    out.push({ kind: 'speak', id: 'rev-speak', phrase: { t: c.t, pt: c.pt, rom: c.rom, tip: c.tip } })
  }
  return out
}
