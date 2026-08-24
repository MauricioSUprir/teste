"use client";

import { useState, useTransition } from "react";
import { excluirFlashcard, revisarFlashcard } from "@/lib/actions";

type Cartao = { id: string; front: string; back: string; subjectName: string | null };

// Notas do SM-2 traduzidas em botões simples
const NOTAS = [
  { quality: 1, rotulo: "Errei", cor: "var(--perigo)" },
  { quality: 3, rotulo: "Difícil", cor: "var(--ambar)" },
  { quality: 4, rotulo: "Lembrei", cor: "var(--acento)" },
  { quality: 5, rotulo: "Fácil", cor: "var(--acento)" },
];

export function RevisaoFlashcards({
  cartoes,
  totalCartoes,
}: {
  cartoes: Cartao[];
  totalCartoes: number;
}) {
  // Ids já tratados nesta sessão de revisão — a lista vinda do servidor
  // muda a cada resposta, então o controle é por id, não por índice.
  const [tratados, setTratados] = useState<Set<string>>(new Set());
  const [virado, setVirado] = useState(false);
  const [, startTransition] = useTransition();

  const fila = cartoes.filter((c) => !tratados.has(c.id));
  const atual = fila[0];
  const revisados = tratados.size;

  if (totalCartoes === 0) {
    return (
      <div className="cartao">
        <h2>Revisão de hoje</h2>
        <p className="texto-suave">
          Você ainda não tem flashcards. Crie o primeiro ao lado, ou peça ao Assistente IA
          para gerar cartões a partir das suas notas.
        </p>
      </div>
    );
  }

  if (!atual) {
    return (
      <div className="cartao">
        <h2>Revisão de hoje</h2>
        <p className="texto-suave">
          {revisados > 0
            ? `Revisão concluída — ${revisados} ${revisados === 1 ? "cartão revisado" : "cartões revisados"}. 🎉`
            : "Nenhum cartão vencido agora. Volte amanhã!"}
        </p>
      </div>
    );
  }

  const marcarTratado = (id: string) => {
    setTratados((s) => new Set(s).add(id));
    setVirado(false);
  };

  const responder = (quality: number) => {
    const id = atual.id;
    startTransition(() => revisarFlashcard(id, quality));
    marcarTratado(id);
  };

  return (
    <div className="cartao pilha">
      <div className="linha-flex">
        <h2 style={{ margin: 0, flex: 1 }}>Revisão de hoje</h2>
        <span className="pilula pilula-acento">
          {revisados + 1} / {revisados + fila.length}
        </span>
      </div>

      <div
        className="cartao flashcard-revisao"
        role="button"
        tabIndex={0}
        onClick={() => setVirado((v) => !v)}
        onKeyDown={(e) => e.key === " " && setVirado((v) => !v)}
        title="Clique para virar"
      >
        <div>
          {atual.subjectName && (
            <div className="texto-suave" style={{ marginBottom: 8 }}>
              {atual.subjectName}
            </div>
          )}
          {virado ? atual.back : atual.front}
          {!virado && (
            <div className="texto-suave" style={{ marginTop: 12, fontSize: "0.8rem" }}>
              clique para ver a resposta
            </div>
          )}
        </div>
      </div>

      {virado && (
        <div className="linha-flex" style={{ justifyContent: "center" }}>
          {NOTAS.map((n) => (
            <button
              key={n.quality}
              onClick={() => responder(n.quality)}
              style={{ borderColor: n.cor, color: n.cor, fontWeight: 700 }}
            >
              {n.rotulo}
            </button>
          ))}
        </div>
      )}

      <button
        className="btn-fantasma"
        style={{ alignSelf: "center" }}
        onClick={() => {
          const id = atual.id;
          startTransition(() => excluirFlashcard(id));
          marcarTratado(id);
        }}
      >
        excluir este cartão
      </button>
    </div>
  );
}
