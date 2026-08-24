"use client";

import { useState, useTransition } from "react";
import { excluirEvento } from "@/lib/actions";

type Item = {
  id: string;
  eventoId: string | null; // null = prazo de tarefa (gerenciado na tela Tarefas)
  titulo: string;
  dataISO: string;
  tipo: string;
  cor: string | null;
  ehTarefa: boolean;
};

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const EMOJI_TIPO: Record<string, string> = {
  PROVA: "📝",
  TRABALHO: "📌",
  ENTREGA: "📌",
  AULA: "🏫",
  EVENTO: "📅",
};

export function CalendarioMensal({ itens }: { itens: Item[] }) {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const [, startTransition] = useTransition();

  const navegar = (delta: number) => {
    const d = new Date(ano, mes + delta, 1);
    setAno(d.getFullYear());
    setMes(d.getMonth());
  };

  const primeiroDia = new Date(ano, mes, 1);
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const offset = primeiroDia.getDay();
  const celulas: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ];
  while (celulas.length % 7 !== 0) celulas.push(null);

  const itensDoDia = (dia: number) =>
    itens.filter((item) => {
      const d = new Date(item.dataISO);
      return d.getFullYear() === ano && d.getMonth() === mes && d.getDate() === dia;
    });

  const ehHoje = (dia: number) =>
    hoje.getFullYear() === ano && hoje.getMonth() === mes && hoje.getDate() === dia;

  return (
    <div className="cartao">
      <div className="linha-flex" style={{ marginBottom: 12 }}>
        <button onClick={() => navegar(-1)} aria-label="Mês anterior">
          ←
        </button>
        <h2 style={{ margin: 0, flex: 1, textAlign: "center" }}>
          {MESES[mes]} de {ano}
        </h2>
        <button onClick={() => navegar(1)} aria-label="Próximo mês">
          →
        </button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 6,
            minWidth: 640,
          }}
        >
          {DIAS.map((d) => (
            <div
              key={d}
              className="texto-suave"
              style={{
                textAlign: "center",
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: 700,
              }}
            >
              {d}
            </div>
          ))}
          {celulas.map((dia, i) => (
            <div
              key={i}
              style={{
                minHeight: 84,
                borderRadius: 8,
                border: "1px solid var(--linha)",
                background: dia === null ? "transparent" : "var(--superficie)",
                padding: 6,
                outline: dia !== null && ehHoje(dia) ? "2px solid var(--acento)" : "none",
              }}
            >
              {dia !== null && (
                <>
                  <div
                    style={{
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      color: ehHoje(dia) ? "var(--acento)" : "var(--tinta-suave)",
                      marginBottom: 4,
                    }}
                  >
                    {dia}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {itensDoDia(dia).map((item) => (
                      <div
                        key={item.id}
                        title={`${item.titulo}${item.ehTarefa ? " (prazo de tarefa)" : ""}`}
                        style={{
                          fontSize: "0.72rem",
                          lineHeight: 1.25,
                          padding: "2px 6px",
                          borderRadius: 6,
                          background: "var(--superficie-2)",
                          borderLeft: `3px solid ${item.cor ?? "var(--acento)"}`,
                          display: "flex",
                          gap: 4,
                          alignItems: "baseline",
                        }}
                      >
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {EMOJI_TIPO[item.tipo] ?? "📅"} {item.titulo}
                        </span>
                        {item.eventoId && (
                          <button
                            className="btn-fantasma"
                            style={{ padding: 0, fontSize: "0.72rem" }}
                            title="Excluir evento"
                            onClick={() => {
                              const id = item.eventoId!;
                              startTransition(() => excluirEvento(id));
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <p className="texto-suave" style={{ marginTop: 10, fontSize: "0.8rem" }}>
        📝 prova · 📌 trabalho/entrega · 🏫 aula · 📅 evento — itens com 📌 vindos das
        Tarefas são gerenciados na tela de Tarefas.
      </p>
    </div>
  );
}
