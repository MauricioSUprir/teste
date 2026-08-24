"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { registrarSessao } from "@/lib/actions";

type Materia = { id: string; name: string };
type Modo = "foco" | "pausa";

export function TimerPomodoro({ materias }: { materias: Materia[] }) {
  const [focoMin, setFocoMin] = useState(25);
  const [pausaMin, setPausaMin] = useState(5);
  const [modo, setModo] = useState<Modo>("foco");
  const [segundos, setSegundos] = useState(25 * 60);
  const [rodando, setRodando] = useState(false);
  const [materiaId, setMateriaId] = useState("");
  const [ciclos, setCiclos] = useState(0);
  const [, startTransition] = useTransition();
  const intervalo = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!rodando) return;
    intervalo.current = setInterval(() => {
      setSegundos((s) => s - 1);
    }, 1000);
    return () => {
      if (intervalo.current) clearInterval(intervalo.current);
    };
  }, [rodando]);

  useEffect(() => {
    if (segundos > 0) return;
    setRodando(false);
    if (modo === "foco") {
      // Ciclo de foco concluído: registra no banco e passa para a pausa
      setCiclos((c) => c + 1);
      startTransition(() => registrarSessao(focoMin, materiaId || null));
      setModo("pausa");
      setSegundos(pausaMin * 60);
    } else {
      setModo("foco");
      setSegundos(focoMin * 60);
    }
    // Aviso sonoro simples ao trocar de modo
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      osc.frequency.value = 660;
      osc.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {
      // sem áudio disponível — segue sem aviso
    }
  }, [segundos, modo, focoMin, pausaMin, materiaId, startTransition]);

  const reiniciar = (novoModo: Modo = "foco") => {
    setRodando(false);
    setModo(novoModo);
    setSegundos((novoModo === "foco" ? focoMin : pausaMin) * 60);
  };

  const mm = String(Math.floor(segundos / 60)).padStart(2, "0");
  const ss = String(segundos % 60).padStart(2, "0");

  return (
    <div className="cartao pilha" style={{ alignItems: "center" }}>
      <span className={`pilula ${modo === "foco" ? "pilula-acento" : "pilula-ambar"}`}>
        {modo === "foco" ? "FOCO" : "PAUSA"} · ciclo {ciclos + (modo === "foco" ? 1 : 0)}
      </span>
      <div className="pomodoro-mostrador" aria-live="polite">
        {mm}:{ss}
      </div>

      <div className="linha-flex" style={{ justifyContent: "center" }}>
        {!rodando ? (
          <button className="btn-principal" onClick={() => setRodando(true)} style={{ minWidth: 120 }}>
            {segundos === (modo === "foco" ? focoMin : pausaMin) * 60 ? "Começar" : "Continuar"}
          </button>
        ) : (
          <button onClick={() => setRodando(false)} style={{ minWidth: 120 }}>
            Pausar
          </button>
        )}
        <button onClick={() => reiniciar(modo)}>Zerar</button>
      </div>

      <div className="linha-flex" style={{ justifyContent: "center" }}>
        <label className="texto-suave">
          Foco{" "}
          <select
            value={focoMin}
            disabled={rodando}
            onChange={(e) => {
              const v = Number(e.target.value);
              setFocoMin(v);
              if (modo === "foco") setSegundos(v * 60);
            }}
          >
            {[15, 25, 30, 45, 50].map((v) => (
              <option key={v} value={v}>
                {v} min
              </option>
            ))}
          </select>
        </label>
        <label className="texto-suave">
          Pausa{" "}
          <select
            value={pausaMin}
            disabled={rodando}
            onChange={(e) => {
              const v = Number(e.target.value);
              setPausaMin(v);
              if (modo === "pausa") setSegundos(v * 60);
            }}
          >
            {[5, 10, 15].map((v) => (
              <option key={v} value={v}>
                {v} min
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="texto-suave" style={{ width: "100%", textAlign: "center" }}>
        Estudando:{" "}
        <select value={materiaId} onChange={(e) => setMateriaId(e.target.value)}>
          <option value="">sem matéria</option>
          {materias.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
