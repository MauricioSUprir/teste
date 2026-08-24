import { useRef } from 'react'
import { useGame } from '../game/state'
import { loadRanking } from '../game/storage'
import { QrImage } from '../components/QrImage'
import { qrEntryUrl } from '../qr/entry'
import { sfxStamp } from '../audio/sound'

export function Attract() {
  const { state, goto } = useGame()
  const top5 = loadRanking().slice(0, 5)
  const taps = useRef<number[]>([])

  // toque quintuplo no canto superior esquerdo abre o admin
  const cornerTap = () => {
    const now = Date.now()
    taps.current = [...taps.current.filter((t) => now - t < 2500), now]
    if (taps.current.length >= 5) {
      taps.current = []
      goto('admin')
    }
  }

  return (
    <div className="screen attract">
      <div
        onPointerDown={cornerTap}
        style={{ position: 'fixed', top: 0, left: 0, width: 80, height: 80, zIndex: 40 }}
      />
      <span className="stamp hit" style={{ fontSize: '1rem' }}>
        CASO REABERTO — 1815 → 2026
      </span>
      <h1 className="glitch">
        CASO <span>DANTÈS</span>
        <br />
        ARQUIVO REABERTO
      </h1>
      <div className="silhuetas" aria-hidden>
        <span>🖋️</span>
        <span>🎣</span>
        <span>⚖️</span>
      </div>

      {state.viaQr && <div className="qr-banner">📱 ENTRADA VIA QR CODE REGISTRADA ✓</div>}

      <button
        className="btn big pulse"
        onClick={() => {
          sfxStamp()
          goto('register')
        }}
      >
        TOQUE PARA INVESTIGAR
      </button>

      <div
        style={{
          display: 'flex',
          gap: 20,
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'flex-start',
        }}
      >
        {top5.length > 0 && (
          <ul className="ranking-mini">
            <li style={{ justifyContent: 'center', color: 'var(--lacre)' }}>
              <b>★ TOP 5 DO DIA ★</b>
            </li>
            {top5.map((r, i) => (
              <li key={i}>
                <span>
                  {i + 1}. {r.badge} {r.name}
                  {r.viaQr ? ' 📱' : ''}
                </span>
                <b>{r.score}</b>
              </li>
            ))}
          </ul>
        )}
        <QrImage value={qrEntryUrl()} label="ESCANEIE PARA ENTRAR NO CASO 🔍" />
      </div>
      <p className="mono" style={{ opacity: 0.55, fontSize: '0.72rem' }}>
        E se Edmond Dantès vivesse em 2026? · Sarau literário · O Conde de Monte Cristo
      </p>
    </div>
  )
}
