// Deteccao e registro de entradas via QR code.
// O QR da tela de atracao aponta para <url-do-jogo>?entrada=qr .
// Quando alguem abre o link, o jogo detecta, registra a visita
// (contador + historico em localStorage) e marca a sessao como "via QR".

const STATS_KEY = 'dantes.qrStats'
const SESSION_FLAG = 'dantes.viaQr'

export interface QrStats {
  total: number
  entries: string[] // timestamps ISO (ultimas 200)
}

export function loadQrStats(): QrStats {
  try {
    const raw = localStorage.getItem(STATS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (typeof parsed.total === 'number' && Array.isArray(parsed.entries)) {
        return parsed
      }
    }
  } catch {
    /* ignora e recomeca */
  }
  return { total: 0, entries: [] }
}

function saveQrStats(stats: QrStats) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats))
  } catch {
    /* localStorage cheio/indisponivel */
  }
}

/**
 * Chamada uma vez na inicializacao do app.
 * Se a URL contiver ?entrada=qr, registra a entrada e limpa a URL.
 * Retorna true se esta visita chegou pelo QR code.
 */
export function detectQrEntry(): boolean {
  const params = new URLSearchParams(window.location.search)
  if (params.get('entrada') === 'qr') {
    const stats = loadQrStats()
    stats.total += 1
    stats.entries.push(new Date().toISOString())
    if (stats.entries.length > 200) stats.entries = stats.entries.slice(-200)
    saveQrStats(stats)
    try {
      sessionStorage.setItem(SESSION_FLAG, '1')
    } catch {
      /* ok */
    }
    // Limpa o parametro para o refresh nao contar de novo
    params.delete('entrada')
    const clean =
      window.location.pathname + (params.toString() ? `?${params}` : '') + window.location.hash
    window.history.replaceState({}, '', clean)
    return true
  }
  try {
    return sessionStorage.getItem(SESSION_FLAG) === '1'
  } catch {
    return false
  }
}

export function qrEntriesToday(): number {
  const today = new Date().toISOString().slice(0, 10)
  return loadQrStats().entries.filter((e) => e.startsWith(today)).length
}

export function resetQrStats() {
  saveQrStats({ total: 0, entries: [] })
}

/** URL que o QR da tela de atracao codifica. */
export function qrEntryUrl(): string {
  return `${window.location.origin}${window.location.pathname}?entrada=qr`
}
