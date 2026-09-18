// O boneco. Cabeca quadrada, traco duro, sem brilho nem bochecha rosada —
// ele pisca, respira, mexe a boca quando fala, inclina a cabeca quando escuta
// e muda de cara conforme o humor escolhido.
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
          {/* sombra dura, deslocada — cartaz serigrafado, nao brilho de gel */}
          <filter id="vocaShadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="5" dy="5" stdDeviation="0" floodColor="#000" floodOpacity="0.9" />
          </filter>
        </defs>

        {/* antena de humor */}
        <g className="voca-antenna">
          <line x1="100" y1="42" x2="100" y2="18" stroke={color} strokeWidth="4" />
          <rect x="93" y="8" width="14" height="10" fill={color} className="voca-antenna-dot" />
        </g>

        {/* orelhas / fones — pulsam quando ele escuta */}
        <g className="voca-ears">
          <rect x="18" y="92" width="18" height="34" fill={color} opacity="0.9" />
          <rect x="164" y="92" width="18" height="34" fill={color} opacity="0.9" />
        </g>

        {/* cabeca */}
        <g className="voca-head" filter="url(#vocaShadow)">
          <rect x="34" y="44" width="132" height="124" rx="4" fill={color} />
          <rect x="42" y="54" width="116" height="90" rx="2" fill="#08090A" />

          {/* sobrancelhas */}
          <g stroke="#FFFFFF" strokeWidth="7" opacity="0.95">
            <line x1="63" y1="82" x2="87" y2="82" transform={`rotate(${browL} 75 82)`} />
            <line x1="113" y1="82" x2="137" y2="82" transform={`rotate(${browR} 125 82)`} />
          </g>

          {/* olhos */}
          <g fill="#FFFFFF">
            <rect x="66" y={98 - eyeH / 2} width={smirk ? 16 : 18} height={eyeH} />
            <rect x="116" y={98 - eyeH / 2} width="18" height={eyeH} />
          </g>

          {/* boca */}
          {state === 'talking' ? (
            <rect x={100 - (16 + energy * 6)} y={126 - (4 + mouthOpen * 12) / 2} width={(16 + energy * 6) * 2} height={4 + mouthOpen * 12} fill="#FFFFFF" className="voca-mouth-talk" />
          ) : state === 'listening' ? (
            <rect x="93" y="122" width="14" height="8" fill="#FFFFFF" opacity="0.85" />
          ) : happy ? (
            <path d="M84 120 Q100 136 116 120" stroke="#FFFFFF" strokeWidth="6" fill="none" />
          ) : angry ? (
            <path d="M82 130 Q100 116 118 130" stroke="#FFFFFF" strokeWidth="6" fill="none" />
          ) : smirk ? (
            <path d="M84 126 Q98 134 116 120" stroke="#FFFFFF" strokeWidth="6" fill="none" />
          ) : drama ? (
            <rect x="89" y="120" width="22" height="16" fill="#FFFFFF" />
          ) : (
            <line x1="86" y1="126" x2="114" y2="126" stroke="#FFFFFF" strokeWidth="6" />
          )}

          {/* detalhes por humor */}
          {drama && <rect x="129" y="108" width="6" height="10" fill="#E8EAED" className="voca-tear" />}
        </g>

        {/* corpo */}
        <rect x="62" y="162" width="76" height="26" fill={color} opacity="0.85" />

        {/* sinais de raiva */}
        {angry && (
          <g className="voca-steam" stroke="#FF2E2E" strokeWidth="4" fill="none">
            <path d="M172 58 q8 -10 0 -20" />
            <path d="M28 58 q-8 -10 0 -20" />
          </g>
        )}
        {/* quepe do sargento */}
        {stern && (
          <g>
            <rect x="52" y="34" width="96" height="16" fill="#3F4A52" />
            <rect x="40" y="48" width="120" height="8" fill="#2B343A" />
          </g>
        )}
        {/* pensando */}
        {state === 'thinking' && (
          <g className="voca-think" fill={color}>
            <rect x="154" y="36" width="8" height="8" />
            <rect x="166" y="24" width="12" height="12" />
            <rect x="180" y="10" width="16" height="16" />
          </g>
        )}
      </svg>
    </div>
  )
}
