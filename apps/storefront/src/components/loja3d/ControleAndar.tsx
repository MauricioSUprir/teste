"use client";

/**
 * Controle de andar da loja 3D no celular: arrastar a bolinha para cima anda
 * para a frente, para baixo volta e para os lados vira. Soltou, parou. Quem usa
 * teclado tem W/A/S/D; o controle é só para o dedo (fica fora do leitor de tela).
 */
import { useEffect, useRef, useState } from "react";

const RAIO = 40; // px do centro até onde a bolinha vai

/** um pouco de folga no meio e começo suave: dá para ir devagarinho até a prateleira */
function curva(v: number) {
  const a = Math.max(0, Math.abs(v) - 0.12) / 0.88;
  return Math.sign(v) * Math.pow(a, 1.4);
}

export function ControleAndar({ aoMover }: { aoMover: (frente: number, vira: number) => void }) {
  const base = useRef<HTMLDivElement>(null);
  const dedo = useRef<number | null>(null);
  const mover = useRef(aoMover);
  const [bolinha, setBolinha] = useState({ x: 0, y: 0 });
  useEffect(() => {
    mover.current = aoMover;
  }, [aoMover]);
  // sumiu no meio do arraste (abriu um card): não pode continuar andando sozinho
  useEffect(() => () => mover.current(0, 0), []);

  function seguir(ev: React.PointerEvent) {
    const r = base.current?.getBoundingClientRect();
    if (!r) return;
    let dx = ev.clientX - (r.left + r.width / 2);
    let dy = ev.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > RAIO) {
      dx *= RAIO / d;
      dy *= RAIO / d;
    }
    setBolinha({ x: dx, y: dy });
    mover.current(curva(-dy / RAIO), curva(-dx / RAIO));
  }
  function soltar(ev: React.PointerEvent) {
    if (dedo.current !== ev.pointerId) return;
    dedo.current = null;
    setBolinha({ x: 0, y: 0 });
    mover.current(0, 0);
  }

  return (
    <div
      ref={base}
      aria-hidden="true"
      onPointerDown={(ev) => {
        dedo.current = ev.pointerId;
        ev.currentTarget.setPointerCapture(ev.pointerId);
        seguir(ev);
      }}
      onPointerMove={(ev) => {
        if (dedo.current === ev.pointerId) seguir(ev);
      }}
      onPointerUp={soltar}
      onPointerCancel={soltar}
      className="absolute bottom-[4.75rem] left-4 flex h-[112px] w-[112px] touch-none select-none items-center justify-center rounded-full border border-white/70 bg-white/30 shadow-[0_4px_18px_rgba(0,0,0,0.18)] backdrop-blur-[2px]"
    >
      {/* setinhas: frente, trás e os lados */}
      <svg width="112" height="112" viewBox="0 0 112 112" className="pointer-events-none absolute inset-0 text-white">
        <path d="M50 16 L56 9 L62 16 M50 96 L56 103 L62 96 M16 50 L9 56 L16 62 M96 50 L103 56 L96 62" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div
        className="pointer-events-none h-12 w-12 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.25)]"
        style={{ transform: `translate(${bolinha.x}px, ${bolinha.y}px)` }}
      >
        <div className="m-auto mt-[17px] h-3.5 w-3.5 rounded-full bg-roxo" />
      </div>
    </div>
  );
}
