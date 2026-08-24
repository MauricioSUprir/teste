import { useGame } from '../game/state'
import { fmtTime } from '../game/scoring'
import { isMuted } from '../audio/sound'

export function Hud() {
  const { state, updateSettings } = useGame()
  const s = state.session
  const evCount = Object.values(s.evidence).filter((e) => e.done).length
  const cCount = Object.values(s.contradictions).filter(Boolean).length
  const low = s.timeLeft <= 60

  return (
    <div className="hud">
      <span className={`timer ${low ? 'low' : ''}`}>⏱ {fmtTime(s.timeLeft)}</span>
      <span className="mono">
        {s.badge} {s.name || 'DETETIVE'} · <b>{s.score}</b> pts
        {s.viaQr && ' · 📱QR'}
      </span>
      <span className="check">
        Evidências {evCount}/6 · Contradições {cCount}/3 · Acusação {s.solved ? '✔' : '—'}
      </span>
      <button
        className="muteBtn"
        aria-label={state.settings.sound ? 'Desligar sons' : 'Ligar sons'}
        onClick={() => updateSettings({ sound: !state.settings.sound })}
      >
        {state.settings.sound && !isMuted() ? '🔊' : '🔇'}
      </button>
    </div>
  )
}
