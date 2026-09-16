// O bonequinho. Ele pisca, respira, mexe a boca quando fala, inclina a
// cabeca quando escuta e muda de cara conforme o humor escolhido.
import { useEffect, useState } from 'react'
import type { Face } from '../content/moods'

export type VocaState = 'idle' | 'listening' | 'thinking' | 'talking'

type Props = {
  state: VocaState
  face: Face
  color: string
  size?: number
  /** 0..1 — quanto a boca abre (fala) ou quanto a orelha pulsa (escuta) */
  energy?: number
}

export function Voca({ state, face, color, size = 220, energy = 0 }: Props) {
  const [blink, setBlink] = useState(false)

  // pisca de tempos em tempos, com intervalo irregular
  useEffect(() => {
    let t: number
    const loop = () => {
      t = window.setTimeout(() => {
        setBlink(true)
        window.setTimeout(() => setBlink(false), 130)
        loop()
      }, 1800 + Math.random() * 3200)
    }
    loop()
    return () => clearTimeout(t)
  }, [])

  const angry = face === 'angry'
  const stern = face === 'stern'
  const happy = face === 'happy'
  const smirk = face === 'smirk'
  const drama = face === 'drama'

  // sobrancelhas: angulo conforme o humor
  const browL = angry ? 22 : stern ? 12 : smirk ? -14 : drama ? -18 : happy ? -6 : 0
  const browR = angry ? -22 : stern ? -12 : smirk ? 4 : drama ? -18 : happy ? 6 : 0

  const mouthOpen = state === 'talking' ? 0.35 + energy * 0.65 : 0
  const eyeH = blink ? 1.2 : state === 'thinking' ? 7 : 9

  return (
    <div className={`voca voca-${state}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label="Voca, seu professor de idiomas">
        <defs>
          <radialGradient id="vocaBody" cx="35%" cy="28%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="100%" stopColor={color} stopOpacity="1" />
          </radialGradient>
          <filter id="vocaShadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor={color} floodOpacity="0.45" />
          </filter>
        </defs>

        {/* antena de humor */}
        <g className="voca-antenna">
          <line x1="100" y1="42" x2="100" y2="22" stroke={color} strokeWidth="5" strokeLinecap="round" />
          <circle cx="100" cy="17" r="7" fill={color} className="voca-antenna-dot" />
        </g>

        {/* orelhas / fones — pulsam quando ele escuta */}
        <g className="voca-ears">
          <rect x="18" y="92" rx="9" width="18" height="34" fill={color} opacity="0.9" />
          <rect x="164" y="92" rx="9" width="18" height="34" fill={color} opacity="0.9" />
        </g>

        {/* cabeca */}
        <g className="voca-head" filter="url(#vocaShadow)">
          <rect x="34" y="44" width="132" height="124" rx="40" fill="url(#vocaBody)" />
          <rect x="44" y="56" width="112" height="86" rx="30" fill="#10141B" opacity="0.92" />

          {/* sobrancelhas */}
          <g stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" opacity="0.95">
            <line x1="63" y1="82" x2="87" y2="82" transform={`rotate(${browL} 75 82)`} />
            <line x1="113" y1="82" x2="137" y2="82" transform={`rotate(${browR} 125 82)`} />
          </g>

          {/* olhos */}
          <g fill="#FFFFFF">
            <rect x="66" y={98 - eyeH / 2} width={smirk ? 16 : 18} height={eyeH} rx={eyeH / 2} />
            <rect x="116" y={98 - eyeH / 2} width="18" height={eyeH} rx={eyeH / 2} />
          </g>

          {/* boca */}
          {state === 'talking' ? (
            <ellipse cx="100" cy="126" rx={16 + energy * 6} ry={4 + mouthOpen * 12} fill="#FF7A7A" className="voca-mouth-talk" />
          ) : state === 'listening' ? (
            <circle cx="100" cy="126" r="7" fill="#FFFFFF" opacity="0.85" />
          ) : happy ? (
            <path d="M84 120 Q100 136 116 120" stroke="#FFFFFF" strokeWidth="6" fill="none" strokeLinecap="round" />
          ) : angry ? (
            <path d="M82 130 Q100 116 118 130" stroke="#FFFFFF" strokeWidth="6" fill="none" strokeLinecap="round" />
          ) : smirk ? (
            <path d="M84 126 Q98 134 116 120" stroke="#FFFFFF" strokeWidth="6" fill="none" strokeLinecap="round" />
          ) : drama ? (
            <ellipse cx="100" cy="128" rx="11" ry="9" fill="#FF7A7A" />
          ) : (
            <line x1="86" y1="126" x2="114" y2="126" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" />
          )}

          {/* detalhes por humor */}
          {happy && (
            <g fill="#FF8FA3" opacity="0.65">
              <circle cx="58" cy="118" r="8" />
              <circle cx="142" cy="118" r="8" />
            </g>
          )}
          {drama && <circle cx="132" cy="112" r="5" fill="#8ED0FF" className="voca-tear" />}
        </g>

        {/* corpo */}
        <rect x="62" y="162" width="76" height="26" rx="13" fill={color} opacity="0.85" />

        {/* sinais de raiva */}
        {angry && (
          <g className="voca-steam" stroke="#FF6B6B" strokeWidth="4" fill="none" strokeLinecap="round">
            <path d="M172 58 q8 -10 0 -20" />
            <path d="M28 58 q-8 -10 0 -20" />
          </g>
        )}
        {/* quepe do sargento */}
        {stern && (
          <g>
            <rect x="52" y="34" width="96" height="16" rx="6" fill="#3F4A52" />
            <rect x="40" y="48" width="120" height="8" rx="4" fill="#2B343A" />
          </g>
        )}
        {/* pensando */}
        {state === 'thinking' && (
          <g className="voca-think" fill={color}>
            <circle cx="158" cy="40" r="4" />
            <circle cx="170" cy="30" r="6" />
            <circle cx="184" cy="18" r="8" />
          </g>
        )}
      </svg>
      <div className="voca-floor" style={{ background: `radial-gradient(ellipse, ${color}44, transparent 70%)` }} />
    </div>
  )
}
