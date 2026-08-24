import { useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '../game/state'
import { addToRanking } from '../game/storage'
import { fmtTime, rankTitle } from '../game/scoring'
import { QrImage } from '../components/QrImage'
import { qrEntryUrl } from '../qr/entry'
import { Confetti } from '../components/Confetti'
import { clearChats } from './Interrogation'
import { sfxStamp } from '../audio/sound'
import type { RankEntry } from '../game/types'

export function Result() {
  const { state, dispatch } = useGame()
  const s = state.session
  const timeUsed = state.settings.minutes * 60 - s.timeLeft
  const savedRef = useRef(false)
  const [rank, setRank] = useState<{ list: RankEntry[]; position: number } | null>(null)
  const [showCert, setShowCert] = useState(false)

  useEffect(() => {
    if (savedRef.current) return
    savedRef.current = true
    const entry: RankEntry = {
      name: s.name || 'ANÔNIMO',
      badge: s.badge,
      score: s.score,
      timeUsed,
      date: new Date().toISOString(),
      viaQr: s.viaQr,
    }
    setRank(addToRanking(entry))
  }, [])

  const title = useMemo(() => rankTitle(s.score), [s.score])
  const dateStr = new Date().toLocaleDateString('pt-BR')

  const nextDetective = () => {
    sfxStamp()
    clearChats()
    dispatch({ type: 'RESET' })
  }

  if (showCert) {
    return (
      <div className="screen" style={{ justifyContent: 'center', gap: 16 }}>
        <div className="certificado">
          <p style={{ letterSpacing: '0.2em', fontSize: '0.8rem' }}>REPÚBLICA DO ARQUIVO · 1815→2026</p>
          <h2 style={{ color: 'var(--lacre)', margin: '6px 0' }}>CERTIFICADO DE DETETIVE</h2>
          <p>CASO DANTÈS: ARQUIVO REABERTO</p>
          <p style={{ marginTop: 14 }}>certifica-se que</p>
          <div className="nome">
            {s.badge} {s.name || 'DETETIVE'}
          </div>
          <p>
            alcançou a patente de
            <br />
            <b style={{ fontSize: '1.15rem', color: 'var(--lacre)' }}>{title}</b>
          </p>
          <p style={{ marginTop: 10 }}>
            {s.score} pontos · tempo {fmtTime(timeUsed)} · {dateStr}
            {s.viaQr ? ' · acesso via QR 📱' : ''}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
            <QrImage value={qrEntryUrl()} size={96} label="Jogue você também" />
          </div>
          <p style={{ marginTop: 12, fontStyle: 'italic' }}>“Esperar e confiar.” — A. Dumas</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn" onClick={() => window.print()}>
            🖨 IMPRIMIR / PDF
          </button>
          <button className="btn secondary" onClick={() => setShowCert(false)}>
            ◂ VOLTAR
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      {s.solved && <Confetti count={16} />}
      <div className="wrap" style={{ alignItems: 'center', textAlign: 'center' }}>
        <h2 className="stamp-title" style={{ fontSize: '1.7rem' }}>
          RELATÓRIO FINAL
        </h2>
        <div className="paper" style={{ width: 'min(440px, 92vw)' }}>
          <span className="tape">{s.solved ? 'CASO RESOLVIDO' : 'CASO ARQUIVADO'}</span>
          <h3 className="stamp-title" style={{ fontSize: '2.4rem' }}>{s.score} pts</h3>
          <p className="mono" style={{ fontSize: '0.9rem', margin: '8px 0' }}>
            {s.badge} {s.name} — <b>{title}</b>
          </p>
          <ul className="mono" style={{ listStyle: 'none', fontSize: '0.82rem', lineHeight: 1.7 }}>
            <li>🔍 Evidências: {Object.values(s.evidence).filter((e) => e.done).length}/6</li>
            <li>⚡ Contradições: {Object.values(s.contradictions).filter(Boolean).length}/3</li>
            <li>⚖️ Acusação: {s.solved ? 'correta (+500)' : 'não concluída'}</li>
            <li>⏱ Tempo de investigação: {fmtTime(timeUsed)}</li>
            {s.viaQr && <li>📱 Entrada registrada via QR code</li>}
          </ul>
        </div>

        {rank && (
          <ul className="ranking-mini" style={{ width: 'min(440px, 92vw)' }}>
            <li style={{ justifyContent: 'center', color: 'var(--lacre)' }}>
              <b>★ RANKING TOP 10 DO DIA ★</b>
            </li>
            {rank.list.map((r, i) => (
              <li
                key={i}
                className={i === rank.position ? 'pulse' : ''}
                style={i === rank.position ? { color: 'var(--pericia)', fontWeight: 700 } : {}}
              >
                <span>
                  {i + 1}. {r.badge} {r.name}
                  {r.viaQr ? ' 📱' : ''}
                  {i === rank.position ? ' ◂ VOCÊ' : ''}
                </span>
                <b>
                  {r.score} · {fmtTime(r.timeUsed)}
                </b>
              </li>
            ))}
          </ul>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn" onClick={() => setShowCert(true)}>
            📜 MEU CERTIFICADO
          </button>
          <button className="btn big" onClick={nextDetective}>
            👉 PRÓXIMO DETETIVE
          </button>
        </div>
      </div>
    </div>
  )
}
