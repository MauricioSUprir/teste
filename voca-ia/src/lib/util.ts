// Utilidades puras: normalizacao de texto, comparacao tolerante a typo, sorteio.

export function stripAccents(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Normaliza para comparar respostas: minusculas, sem acento, sem pontuacao, espacos colapsados. */
export function norm(s: string) {
  return stripAccents(s.toLowerCase())
    .replace(/[’']/g, "'")
    .replace(/[.,!?;:"“”()\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Contracoes e variantes que valem a mesma coisa numa resposta digitada. */
const EQUIV: [RegExp, string][] = [
  [/\bi'm\b/g, 'i am'],
  [/\byou're\b/g, 'you are'],
  [/\bhe's\b/g, 'he is'],
  [/\bshe's\b/g, 'she is'],
  [/\bit's\b/g, 'it is'],
  [/\bwe're\b/g, 'we are'],
  [/\bthey're\b/g, 'they are'],
  [/\bdon't\b/g, 'do not'],
  [/\bdoesn't\b/g, 'does not'],
  [/\bdidn't\b/g, 'did not'],
  [/\bcan't\b/g, 'can not'],
  [/\bcannot\b/g, 'can not'],
  [/\bwon't\b/g, 'will not'],
  [/\bisn't\b/g, 'is not'],
  [/\baren't\b/g, 'are not'],
  [/\bi've\b/g, 'i have'],
  [/\bi'd\b/g, 'i would'],
  [/\bi'll\b/g, 'i will'],
  [/\blet's\b/g, 'let us'],
  [/\bpra\b/g, 'para'],
  [/\bvc\b/g, 'voce'],
]

export function canon(s: string) {
  let t = norm(s)
  for (const [re, to] of EQUIV) t = t.replace(re, to)
  return t.replace(/\s+/g, ' ').trim()
}

export function levenshtein(a: string, b: string) {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  if (!m) return n
  if (!n) return m
  let prev = new Array(n + 1)
  let cur = new Array(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j
  for (let i = 1; i <= m; i++) {
    cur[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
    }
    const t = prev
    prev = cur
    cur = t
  }
  return prev[n]
}

export type Verdict = 'certo' | 'quase' | 'errado'

/** Compara a resposta com as alternativas aceitas, com tolerancia a erro de digitacao. */
export function judge(input: string, answers: string[]): Verdict {
  const given = canon(input)
  if (!given) return 'errado'
  let best = Infinity
  for (const a of answers) {
    const target = canon(a)
    if (given === target) return 'certo'
    best = Math.min(best, levenshtein(given, target))
  }
  const tolerance = given.length > 22 ? 3 : given.length > 12 ? 2 : 1
  return best <= tolerance ? 'quase' : 'errado'
}

export function shuffle<T>(arr: T[], rnd: () => number = Math.random): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function pick<T>(arr: T[], n: number, rnd: () => number = Math.random): T[] {
  return shuffle(arr, rnd).slice(0, n)
}

export function one<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** Gerador deterministico: a mesma licao gera os mesmos exercicios no mesmo dia. */
export function seeded(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) % 100000) / 100000
  }
}

export function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function today(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function daysBetween(a: string, b: string) {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000)
}

export function words(s: string) {
  return s.trim().split(/\s+/).filter(Boolean)
}

export function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}
