export const POINTS = {
  contradiction: 300,
  accusation: 500,
  accusationPenalty: 150,
  timeBonusPerSecond: 2,
  evidenceErrorPenalty: 25,
}

/**
 * Pontuacao de um mini-game de evidencia: ate 100,
 * com bonus de velocidade e penalidade por erro.
 */
export function evidenceScore(elapsedSec: number, errors: number): number {
  const speedBonus = Math.max(0, 30 - Math.floor(elapsedSec))
  const raw = 70 + speedBonus - errors * POINTS.evidenceErrorPenalty
  return Math.max(10, Math.min(100, raw))
}

export function rankTitle(score: number): string {
  if (score >= 2000) return 'Lenda do Arquivo — nível Monte Cristo'
  if (score >= 1400) return 'Detetive de 1ª Classe'
  if (score >= 800) return 'Investigador'
  return 'Estagiário do Arquivo'
}

export function fmtTime(sec: number): string {
  const m = Math.floor(Math.max(0, sec) / 60)
  const s = Math.max(0, sec) % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
