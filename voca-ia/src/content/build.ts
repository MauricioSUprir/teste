// Helpers compartilhados por todos os curriculos.
import type { Unit, Phrase, Lesson } from '../state/types'

/** [alvo, portugues, dica?, alternativas separadas por |, romanizacao?] */
export type Row = [string, string, string?, string?, string?]

export function ph(r: Row): Phrase {
  return {
    t: r[0],
    pt: r[1],
    tip: r[2],
    alt: r[3] ? r[3].split('|').map((s) => s.trim()) : undefined,
    rom: r[4],
  }
}

export function lesson(
  id: string,
  icon: string,
  title: string,
  focus: string,
  grammar: { title: string; body: string } | undefined,
  rows: Row[],
): Lesson {
  return { id, icon, title, focus, grammar, phrases: rows.map(ph) }
}

export function unit(
  id: string,
  title: string,
  subtitle: string,
  cefr: Unit['cefr'],
  color: string,
  lessons: Lesson[],
): Unit {
  return { id, title, subtitle, cefr, color, lessons }
}
