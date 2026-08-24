import { useMemo } from 'react'

/** Confete de papeizinhos "CONFIDENCIAL". */
export function Confetti({ count = 26 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 1.2,
        dur: 2.2 + Math.random() * 2,
        key: i,
        text: i % 3 === 0 ? 'CONFIDENCIAL' : i % 3 === 1 ? 'ARQUIVO' : '1815',
      })),
    [count],
  )
  return (
    <>
      {pieces.map((p) => (
        <span
          key={p.key}
          className="confetti"
          style={{
            left: `${p.left}vw`,
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
            fontSize: '0.6rem',
          }}
        >
          {p.text}
        </span>
      ))}
    </>
  )
}
