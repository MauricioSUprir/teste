// Controle do limite diário das IAs.
// Os planos gratuitos do Gemini e do Groq têm cota por dia. Quando as DUAS
// acabam, o app não pode fingir que está tudo bem: ele avisa, explica o que
// continua funcionando e volta sozinho no dia seguinte.
const STORE = 'voca-ia:limite'

export class LimitError extends Error {
  code = 'limite_diario'
  constructor(msg = 'limite diário das IAs atingido') {
    super(msg)
    this.name = 'LimitError'
  }
}

function hoje() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

type Ouvinte = () => void
const ouvintes = new Set<Ouvinte>()

export function onLimit(cb: Ouvinte) {
  ouvintes.add(cb)
  return () => {
    ouvintes.delete(cb)
  }
}

/** Marca que hoje bateu no teto e avisa quem estiver ouvindo. */
export function reportLimit() {
  try {
    localStorage.setItem(STORE, hoje())
  } catch {
    /* navegador sem storage */
  }
  ouvintes.forEach((cb) => cb())
}

/** Bateu no limite hoje? (vira sozinho na virada do dia) */
export function limitHitToday() {
  try {
    return localStorage.getItem(STORE) === hoje()
  } catch {
    return false
  }
}

export function clearLimit() {
  try {
    localStorage.removeItem(STORE)
  } catch {
    /* navegador sem storage */
  }
}

/** Quanto falta para a virada do dia, em texto curto. */
export function tempoAteAmanha() {
  const agora = new Date()
  const amanha = new Date(agora)
  amanha.setDate(agora.getDate() + 1)
  amanha.setHours(0, 0, 0, 0)
  const min = Math.max(1, Math.round((amanha.getTime() - agora.getTime()) / 60000))
  const h = Math.floor(min / 60)
  return h >= 1 ? `${h}h${String(min % 60).padStart(2, '0')}` : `${min} min`
}
