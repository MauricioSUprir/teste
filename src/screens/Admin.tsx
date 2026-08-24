import { useState } from 'react'
import { useGame } from '../game/state'
import { resetRanking } from '../game/storage'
import { loadQrStats, qrEntriesToday, resetQrStats, qrEntryUrl } from '../qr/entry'
import { QrImage } from '../components/QrImage'
import { sfxStamp, sfxTap } from '../audio/sound'

const PIN = '1815'

export function Admin() {
  const { state, updateSettings, dispatch, goto } = useGame()
  const [pin, setPin] = useState('')
  const [authed, setAuthed] = useState(false)
  const [msg, setMsg] = useState('')
  const [, refresh] = useState(0)

  if (!authed) {
    return (
      <div className="screen" style={{ justifyContent: 'center', gap: 16, textAlign: 'center' }}>
        <h2 className="stamp-title">ÁREA RESTRITA</h2>
        <input
          className="name-input"
          type="password"
          inputMode="numeric"
          placeholder="PIN"
          value={pin}
          maxLength={6}
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && pin === PIN && setAuthed(true)}
        />
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn"
            onClick={() => {
              if (pin === PIN) {
                setAuthed(true)
                sfxStamp()
              } else {
                setPin('')
                sfxTap()
              }
            }}
          >
            ENTRAR
          </button>
          <button className="btn secondary" onClick={() => dispatch({ type: 'RESET' })}>
            ◂ VOLTAR AO JOGO
          </button>
        </div>
      </div>
    )
  }

  const stats = loadQrStats()

  return (
    <div className="screen">
      <div className="admin-panel" style={{ margin: 'auto' }}>
        <h2 className="stamp-title" style={{ textAlign: 'center' }}>
          ⚙️ ADMIN DO QUIOSQUE
        </h2>
        {msg && <div className="qr-banner">{msg}</div>}

        <div className="admin-row">
          <span>Modo de interrogatório</span>
          <button className="btn secondary" onClick={() => updateSettings({ offline: !state.settings.offline })}>
            {state.settings.offline ? '📴 OFFLINE (roteirizado)' : '🌐 ONLINE (IA via API)'}
          </button>
        </div>

        <div className="admin-row">
          <span>Tempo da partida</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {([4, 6, 8] as const).map((m) => (
              <button
                key={m}
                className="btn secondary"
                style={state.settings.minutes === m ? { borderColor: 'var(--lacre)', color: 'var(--lacre)' } : {}}
                onClick={() => updateSettings({ minutes: m })}
              >
                {m} min
              </button>
            ))}
          </div>
        </div>

        <div className="admin-row">
          <span>Sons</span>
          <button className="btn secondary" onClick={() => updateSettings({ sound: !state.settings.sound })}>
            {state.settings.sound ? '🔊 LIGADOS' : '🔇 MUDOS'}
          </button>
        </div>

        <div className="admin-row">
          <span>Voz dos suspeitos</span>
          <button className="btn secondary" onClick={() => updateSettings({ voice: !state.settings.voice })}>
            {state.settings.voice ? '🗣 LIGADA' : '🤐 DESLIGADA'}
          </button>
        </div>

        <div className="admin-row">
          <span>
            📱 Entradas via QR code
            <br />
            <small style={{ opacity: 0.7 }}>
              hoje: <b>{qrEntriesToday()}</b> · total: <b>{stats.total}</b>
              {stats.entries.length > 0 &&
                ` · última: ${new Date(stats.entries[stats.entries.length - 1]).toLocaleTimeString('pt-BR')}`}
            </small>
          </span>
          <button
            className="btn secondary"
            onClick={() => {
              resetQrStats()
              refresh((n) => n + 1)
              setMsg('Contador de QR zerado ✔')
            }}
          >
            ZERAR
          </button>
        </div>

        <div className="admin-row">
          <span>Ranking do dia</span>
          <button
            className="btn secondary"
            onClick={() => {
              resetRanking()
              setMsg('Ranking zerado ✔')
              sfxStamp()
            }}
          >
            🗑 ZERAR RANKING
          </button>
        </div>

        <div className="admin-row" style={{ justifyContent: 'center' }}>
          <QrImage value={qrEntryUrl()} label={qrEntryUrl()} />
        </div>

        <button className="btn big" onClick={() => { sfxTap(); goto('attract') }}>
          ◂ VOLTAR AO JOGO
        </button>
      </div>
    </div>
  )
}
