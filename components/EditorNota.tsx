"use client";

import { useState, useTransition } from "react";
import { excluirNota, salvarNota } from "@/lib/actions";

type Nota = {
  id: string;
  title: string;
  content: string;
  subjectName: string | null;
  subjectColor: string | null;
  updatedAt: string;
};

export function EditorNota({ nota }: { nota: Nota }) {
  const [aberta, setAberta] = useState(false);
  const [conteudo, setConteudo] = useState(nota.content);
  const [salvo, setSalvo] = useState(true);
  const [pendente, startTransition] = useTransition();

  return (
    <div className="cartao">
      <div className="linha-flex">
        {nota.subjectColor && (
          <span className="ponto-cor" style={{ background: nota.subjectColor }} />
        )}
        <button
          className="btn-fantasma"
          style={{ color: "var(--tinta)", fontWeight: 700, fontSize: "1rem", flex: 1, textAlign: "left" }}
          onClick={() => setAberta((a) => !a)}
        >
          {nota.title} {aberta ? "▾" : "▸"}
        </button>
        {nota.subjectName && <span className="pilula">{nota.subjectName}</span>}
        <span className="texto-suave">
          {new Date(nota.updatedAt).toLocaleDateString("pt-BR")}
        </span>
        <button
          className="btn-fantasma"
          title="Excluir nota"
          onClick={() => {
            if (confirm(`Excluir a nota "${nota.title}"?`)) {
              startTransition(() => excluirNota(nota.id));
            }
          }}
        >
          ✕
        </button>
      </div>

      {aberta && (
        <div className="pilha" style={{ marginTop: 12 }}>
          <textarea
            rows={10}
            value={conteudo}
            placeholder="Escreva sua anotação aqui… (aceita markdown simples)"
            onChange={(e) => {
              setConteudo(e.target.value);
              setSalvo(false);
            }}
          />
          <div className="linha-flex">
            <button
              className="btn-principal"
              disabled={salvo || pendente}
              onClick={() =>
                startTransition(async () => {
                  await salvarNota(nota.id, conteudo);
                  setSalvo(true);
                })
              }
            >
              {pendente ? "Salvando…" : salvo ? "Salvo ✓" : "Salvar"}
            </button>
            {!salvo && <span className="texto-suave">alterações não salvas</span>}
          </div>
        </div>
      )}
    </div>
  );
}
