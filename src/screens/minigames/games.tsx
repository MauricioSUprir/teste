import React, { useEffect, useRef, useState } from 'react'
import { sfxError, sfxStamp, sfxSuccess, sfxTap } from '../../audio/sound'

export interface MiniProps {
  onError: () => void
  onComplete: () => void
}

/* ---------- EV-01: Estilometria ---------- */
const SAMPLES = [
  {
    id: 'danglars',
    who: 'Amostra A — Danglars',
    text: '“Registro: 3 fardos, 2 barris. O comandante alterou a ROTA sem lançar nos livros...”',
    sim: 87,
  },
  {
    id: 'fernand',
    who: 'Amostra B — Fernand',
    text: '“as rede rasgou de novo. o mar tava brabo e o peixe sumiu da enseada...”',
    sim: 41,
  },
  {
    id: 'villefort',
    who: 'Amostra C — Villefort',
    text: '“Considerando o exposto nos autos, e data venia o nobre causídico, DECIDO...”',
    sim: 32,
  },
]

export function GameEv1({ onError, onComplete }: MiniProps) {
  const [chosen, setChosen] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)

  const pick = (id: string) => {
    if (locked) return
    sfxTap()
    setChosen(id)
    if (id === 'danglars') {
      setLocked(true)
      sfxSuccess()
      setTimeout(onComplete, 1600)
    } else {
      sfxError()
      onError()
    }
  }

  return (
    <div className="mini-stage">
      <div className="paper" style={{ width: '100%' }}>
        <span className="tape">DENÚNCIA ANÔNIMA</span>
        <p className="mono" style={{ fontSize: '0.85rem' }}>
          “Aviso ao procurador do rei: o imediato do Pharaon desviou a ROTA até a ilha de Elba e
          porta carta bonapartista. Registro aqui a denúncia, como quem lança um débito.”
        </p>
      </div>
      <p className="mono" style={{ color: 'var(--manila)' }}>
        Toque na amostra de escrita que BATE com o padrão da denúncia:
      </p>
      {SAMPLES.map((s) => (
        <button
          key={s.id}
          className={`choice-card ${chosen === s.id ? 'sel' : ''} ${
            chosen === s.id && s.id !== 'danglars' ? 'shake' : ''
          }`}
          onClick={() => pick(s.id)}
        >
          <b>{s.who}</b>
          <br />
          {s.text}
          {chosen && (
            <div style={{ marginTop: 6 }}>
              <div className="simbar" style={{ width: chosen ? `${s.sim}%` : '0%' }} />
              <small>similaridade {s.sim}%</small>
            </div>
          )}
        </button>
      ))}
    </div>
  )
}

/* ---------- EV-02: Siga o dinheiro ---------- */
const MONEY_CARDS = [
  { id: 'a', text: 'Nota fiscal de vinho da taberna de Caderousse. Nada relevante.', win: false },
  {
    id: 'b',
    text: 'ATA DA COMPANHIA MORREL: “Com a vaga aberta, indica-se o Sr. DANGLARS ao posto de capitão do Pharaon.”',
    win: true,
  },
  { id: 'c', text: 'Recibo de redes de pesca em nome de Fernand. Nada relevante.', win: false },
]

export function GameEv2({ onError, onComplete }: MiniProps) {
  const [flipped, setFlipped] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const [order] = useState(() => [...MONEY_CARDS].sort(() => Math.random() - 0.5))

  const flip = (id: string, win: boolean) => {
    if (done || flipped.includes(id)) return
    sfxTap()
    setFlipped((f) => [...f, id])
    if (win) {
      setDone(true)
      sfxSuccess()
      setTimeout(onComplete, 1700)
    } else {
      sfxError()
      onError()
    }
  }

  return (
    <div className="mini-stage">
      <p className="mono" style={{ color: 'var(--manila)' }}>
        QUEM LUCRA COM A PRISÃO? Vire as cartas até achar a prova. (erros custam pontos)
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, width: '100%' }}>
        {order.map((c) => (
          <div
            key={c.id}
            className={`flipcard ${flipped.includes(c.id) ? 'flipped' : ''}`}
            onPointerDown={() => flip(c.id, c.win)}
          >
            <div className="inner">
              <div className="face front">💰</div>
              <div className="face back" style={c.win ? { outline: '3px solid var(--pericia)' } : {}}>
                {c.text}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------- EV-03: Geolocalizacao ---------- */
const SPOTS = [
  { id: 'farol', x: 12, y: 22, label: 'Farol' },
  { id: 'catalaes', x: 78, y: 18, label: 'Vila dos Catalães' },
  { id: 'mercado', x: 42, y: 30, label: 'Mercado' },
  { id: 'taberna', x: 30, y: 66, label: 'Taberna de Caderousse' },
  { id: 'igreja', x: 70, y: 58, label: 'Igreja' },
]

export function GameEv3({ onError, onComplete }: MiniProps) {
  const [found, setFound] = useState(false)
  const [wrong, setWrong] = useState<string | null>(null)

  const tap = (id: string) => {
    if (found) return
    if (id === 'taberna') {
      setFound(true)
      sfxSuccess()
      setTimeout(onComplete, 2000)
    } else {
      setWrong(id)
      sfxError()
      onError()
      setTimeout(() => setWrong(null), 600)
    }
  }

  return (
    <div className="mini-stage">
      <p className="mono" style={{ color: 'var(--manila)' }}>
        Onde a denúncia foi postada? Dicas: <b>“perto do porto”</b> · <b>“onde se bebe”</b>
      </p>
      <svg viewBox="0 0 100 80" style={{ width: '100%', maxWidth: 520, background: '#233042', borderRadius: 10 }}>
        <path d="M0,80 L0,52 Q20,42 35,50 Q55,58 70,48 Q85,40 100,46 L100,80 Z" fill="#1b2533" />
        <path d="M0,52 Q20,42 35,50 Q55,58 70,48 Q85,40 100,46" fill="none" stroke="#6FA86B" strokeWidth="0.8" strokeDasharray="2 1.4" />
        <text x="50" y="74" textAnchor="middle" fill="#6FA86B" fontSize="4" fontFamily="monospace">
          PORTO DE MARSELHA
        </text>
        {SPOTS.map((s) => (
          <g key={s.id} onPointerDown={() => tap(s.id)} style={{ cursor: 'pointer' }}>
            <circle
              cx={s.x}
              cy={s.y}
              r="6"
              fill={found && s.id === 'taberna' ? '#6FA86B' : wrong === s.id ? '#C23B2E' : '#E3C98F'}
              opacity="0.9"
            />
            <text x={s.x} y={s.y + 1.4} textAnchor="middle" fontSize="4.4">
              {s.id === 'taberna' ? '🍷' : s.id === 'farol' ? '🗼' : s.id === 'igreja' ? '⛪' : s.id === 'mercado' ? '🧺' : '⛵'}
            </text>
            <text x={s.x} y={s.y + 10} textAnchor="middle" fill="#EDE7DA" fontSize="3.2" fontFamily="monospace">
              {s.label}
            </text>
          </g>
        ))}
      </svg>
      {found && (
        <div className="paper" style={{ width: '100%' }}>
          <b className="mono">📍 TABERNA DE CADEROUSSE — lista de presentes naquela noite:</b>
          <p className="mono" style={{ marginTop: 6 }}>
            ✔ Danglars &nbsp; ✔ Fernand &nbsp; ✔ Caderousse
          </p>
        </div>
      )}
    </div>
  )
}

/* ---------- EV-04: Quadro de vinculos ---------- */
interface Link {
  from: string
  to: string
  label: string
}
const CORRECT_LINKS: Link[] = [
  { from: 'fernand', to: 'mercedes', label: 'pretendente' },
  { from: 'edmond', to: 'mercedes', label: 'noivos' },
  { from: 'fernand', to: 'edmond', label: 'rival' },
]
const NODES = [
  { id: 'fernand', label: 'Fernand', x: 15, y: 25 },
  { id: 'edmond', label: 'Edmond', x: 85, y: 25 },
  { id: 'mercedes', label: 'Mercédès', x: 50, y: 75 },
]

export function GameEv4({ onError, onComplete }: MiniProps) {
  const [pendingLabel, setPendingLabel] = useState<string | null>(null)
  const [firstNode, setFirstNode] = useState<string | null>(null)
  const [placed, setPlaced] = useState<Link[]>([])

  const remaining = CORRECT_LINKS.filter((c) => !placed.some((p) => p.label === c.label))

  const tapNode = (id: string) => {
    if (!pendingLabel) return
    sfxTap()
    if (!firstNode) {
      setFirstNode(id)
      return
    }
    if (firstNode === id) return
    const correct = CORRECT_LINKS.find((c) => c.label === pendingLabel)!
    const ok =
      (correct.from === firstNode && correct.to === id) ||
      (correct.from === id && correct.to === firstNode)
    if (ok) {
      const next = [...placed, correct]
      setPlaced(next)
      sfxSuccess()
      if (next.length === 3) setTimeout(onComplete, 1500)
    } else {
      sfxError()
      onError()
    }
    setPendingLabel(null)
    setFirstNode(null)
  }

  const nodePos = (id: string) => NODES.find((n) => n.id === id)!

  return (
    <div className="mini-stage">
      <p className="mono" style={{ color: 'var(--manila)' }}>
        Ligue os FIOS VERMELHOS: toque num rótulo, depois nas DUAS pessoas do vínculo.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        {remaining.map((l) => (
          <button
            key={l.label}
            className={`btn secondary ${pendingLabel === l.label ? 'pulse' : ''}`}
            style={pendingLabel === l.label ? { borderColor: 'var(--lacre)', color: 'var(--lacre)' } : {}}
            onClick={() => {
              setPendingLabel(l.label)
              setFirstNode(null)
              sfxTap()
            }}
          >
            🧵 {l.label}
          </button>
        ))}
      </div>
      <svg viewBox="0 0 100 100" style={{ width: '100%', maxWidth: 440, background: 'var(--grafite-2)', borderRadius: 10, border: '1px dashed rgba(227,201,143,.4)' }}>
        {placed.map((l) => {
          const a = nodePos(l.from)
          const b = nodePos(l.to)
          return (
            <g key={l.label}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#C23B2E" strokeWidth="1.4" />
              <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 2} textAnchor="middle" fill="#C23B2E" fontSize="4" fontFamily="monospace">
                {l.label}
              </text>
            </g>
          )
        })}
        {NODES.map((n) => (
          <g key={n.id} onPointerDown={() => tapNode(n.id)} style={{ cursor: 'pointer' }}>
            <circle cx={n.x} cy={n.y} r="9" fill={firstNode === n.id ? '#C23B2E' : '#E3C98F'} />
            <text x={n.x} y={n.y + 1.5} textAnchor="middle" fontSize="6">
              {n.id === 'mercedes' ? '👩' : n.id === 'edmond' ? '⚓' : '🎣'}
            </text>
            <text x={n.x} y={n.y + 15} textAnchor="middle" fill="#EDE7DA" fontSize="4" fontFamily="monospace">
              {n.label}
            </text>
          </g>
        ))}
      </svg>
      <p className="mono" style={{ fontSize: '0.8rem', opacity: 0.7 }}>
        {pendingLabel
          ? firstNode
            ? `Fio “${pendingLabel}”: agora toque na segunda pessoa`
            : `Fio “${pendingLabel}”: toque na primeira pessoa`
          : placed.length === 3
            ? 'QUADRO COMPLETO ✔'
            : 'Escolha um fio para começar'}
      </p>
    </div>
  )
}

/* ---------- EV-05: Restaurar o queimado ---------- */
export function GameEv5({ onComplete }: MiniProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const doneRef = useRef(false)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = (canvas.width = 440)
    const H = (canvas.height = 260)
    // camada "queimada"
    ctx.fillStyle = '#2b2016'
    ctx.fillRect(0, 0, W, H)
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = `rgba(${20 + Math.random() * 40},${15 + Math.random() * 25},10,0.6)`
      ctx.beginPath()
      ctx.arc(Math.random() * W, Math.random() * H, 2 + Math.random() * 14, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'destination-out'

    let rubbing = false
    const rub = (e: PointerEvent) => {
      if (!rubbing || doneRef.current) return
      const rect = canvas.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * W
      const y = ((e.clientY - rect.top) / rect.height) * H
      ctx.beginPath()
      ctx.arc(x, y, 26, 0, Math.PI * 2)
      ctx.fill()
    }
    const start = (e: PointerEvent) => {
      rubbing = true
      rub(e)
    }
    const stop = () => {
      rubbing = false
      if (doneRef.current) return
      // mede quanto ja foi revelado
      const data = ctx.getImageData(0, 0, W, H).data
      let clear = 0
      for (let i = 3; i < data.length; i += 4 * 8) if (data[i] < 40) clear++
      const total = data.length / (4 * 8)
      if (clear / total > 0.5) {
        doneRef.current = true
        setRevealed(true)
        sfxStamp()
        setTimeout(onComplete, 2100)
      }
    }
    canvas.addEventListener('pointerdown', start)
    canvas.addEventListener('pointermove', rub)
    window.addEventListener('pointerup', stop)
    return () => {
      canvas.removeEventListener('pointerdown', start)
      canvas.removeEventListener('pointermove', rub)
      window.removeEventListener('pointerup', stop)
    }
  }, [onComplete])

  return (
    <div className="mini-stage">
      <p className="mono" style={{ color: 'var(--manila)' }}>
        Documento recuperado da lareira. ESFREGUE O DEDO para restaurar o que foi queimado:
      </p>
      <div style={{ position: 'relative', width: '100%', maxWidth: 440 }}>
        <div className="paper" style={{ minHeight: 260, display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
          <p className="mono" style={{ fontSize: '0.8rem' }}>CARTA INTERCEPTADA — ILHA DE ELBA</p>
          <h3 className="stamp-title" style={{ fontSize: '1.5rem', margin: '10px 0' }}>
            DESTINATÁRIO:
            <br />
            NOIRTIER
          </h3>
          <p className="mono" style={{ fontSize: '0.85rem' }}>
            — pai do procurador VILLEFORT —
          </p>
        </div>
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            borderRadius: 4,
            touchAction: 'none',
            opacity: revealed ? 0 : 1,
            transition: 'opacity 0.8s',
          }}
        />
      </div>
      {revealed && (
        <div className="stamp hit" style={{ fontSize: '1.1rem' }}>
          REVELADO: NOIRTIER — PAI DE VILLEFORT
        </div>
      )}
    </div>
  )
}

/* ---------- EV-06: Ache a anomalia ---------- */
const DESPACHOS = [
  { id: 1, text: 'Réu: J. Bertrand — contrabando. Encaminhe-se a JULGAMENTO em júri ordinário.', anomalo: false },
  { id: 2, text: 'Réu: P. Morin — deserção. Encaminhe-se a JULGAMENTO em conselho.', anomalo: false },
  {
    id: 3,
    text: 'Réu: E. DANTÈS — conspiração. SEM julgamento: isolamento por tempo INDETERMINADO. Ass.: Villefort',
    anomalo: true,
  },
  { id: 4, text: 'Réu: L. Fabre — furto no cais. Encaminhe-se a JULGAMENTO em júri ordinário.', anomalo: false },
]

export function GameEv6({ onError, onComplete }: MiniProps) {
  const [found, setFound] = useState(false)
  const [order] = useState(() => [...DESPACHOS].sort(() => Math.random() - 0.5))

  const tap = (d: (typeof DESPACHOS)[0]) => {
    if (found) return
    if (d.anomalo) {
      setFound(true)
      sfxSuccess()
      setTimeout(onComplete, 1500)
    } else {
      sfxError()
      onError()
    }
  }

  return (
    <div className="mini-stage">
      <p className="mono" style={{ color: 'var(--manila)' }}>
        4 despachos judiciais. Toque no ÚNICO que foge do procedimento normal:
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, width: '100%' }}>
        {order.map((d) => (
          <button
            key={d.id}
            className="choice-card"
            style={found && d.anomalo ? { outline: '4px solid var(--lacre)' } : {}}
            onClick={() => tap(d)}
          >
            <b className="mono">DESPACHO Nº {d.id}/1815</b>
            <br />
            {d.text}
          </button>
        ))}
      </div>
    </div>
  )
}
