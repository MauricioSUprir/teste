import { useState } from 'react'
import { useGame } from '../game/state'
import { sfxKey, sfxStamp } from '../audio/sound'
import { clearChats } from './Interrogation'

const BADGES = ['🕵️', '🦊', '🦉', '🐺', '⚓', '🗝️']

export function Register() {
  const { state, dispatch } = useGame()
  const [name, setName] = useState('')
  const [badge, setBadge] = useState(BADGES[0])
  const [stamping, setStamping] = useState(false)

  const confirm = () => {
    if (!name.trim() || stamping) return
    setStamping(true)
    sfxStamp()
    clearChats()
    setTimeout(() => {
      dispatch({ type: 'REGISTER', name: name.trim().toUpperCase(), badge })
    }, 900)
  }

  return (
    <div className="screen" style={{ justifyContent: 'center', gap: 20, textAlign: 'center' }}>
      <h2 className="stamp-title" style={{ fontSize: '1.8rem' }}>
        REGISTRO DO DETETIVE
      </h2>
      {state.viaQr && <div className="qr-banner">📱 Detetive identificado via QR code</div>}

      <div className="paper" style={{ width: 'min(420px, 92vw)' }}>
        <span className="tape">CONFIDENCIAL</span>
        <p className="mono" style={{ marginBottom: 8, fontSize: '0.8rem' }}>
          NOME OU APELIDO (máx. 12)
        </p>
        <input
          className="name-input"
          maxLength={12}
          value={name}
          autoFocus
          placeholder="SEU NOME"
          onChange={(e) => {
            setName(e.target.value)
            sfxKey()
          }}
          onKeyDown={(e) => e.key === 'Enter' && confirm()}
        />
        <p className="mono" style={{ margin: '14px 0 8px', fontSize: '0.8rem' }}>
          ESCOLHA SEU DISTINTIVO
        </p>
        <div className="badge-grid">
          {BADGES.map((b) => (
            <button
              key={b}
              className={badge === b ? 'sel' : ''}
              onClick={() => setBadge(b)}
              aria-label={`Distintivo ${b}`}
            >
              {b}
            </button>
          ))}
        </div>
        {stamping && (
          <div className="stamp hit" style={{ marginTop: 14, fontSize: '1.3rem' }}>
            {badge} {name.toUpperCase() || 'DETETIVE'} — EM SERVIÇO
          </div>
        )}
      </div>

      <button className="btn big" disabled={!name.trim()} onClick={confirm}>
        ASSUMIR O CASO
      </button>
    </div>
  )
}
