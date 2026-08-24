"use client";

import { useTransition } from "react";
import { alternarTopico, criarTopico, excluirMateria, excluirTopico } from "@/lib/actions";

type Topico = { id: string; name: string; done: boolean };
type Materia = {
  id: string;
  name: string;
  color: string;
  topics: Topico[];
  _count: { tasks: number; cards: number; notes: number };
};

export function CartaoMateria({ materia }: { materia: Materia }) {
  const [, startTransition] = useTransition();
  const feitos = materia.topics.filter((t) => t.done).length;
  const progresso =
    materia.topics.length > 0 ? Math.round((feitos / materia.topics.length) * 100) : 0;

  return (
    <div className="cartao">
      <div className="linha-flex" style={{ marginBottom: 8 }}>
        <span className="ponto-cor" style={{ background: materia.color }} />
        <h2 style={{ margin: 0, flex: 1 }}>{materia.name}</h2>
        <button
          className="btn-fantasma"
          title="Excluir matéria"
          onClick={() => {
            if (confirm(`Excluir "${materia.name}" e tudo relacionado a ela?`)) {
              startTransition(() => excluirMateria(materia.id));
            }
          }}
        >
          ✕
        </button>
      </div>

      <div className="barra" style={{ marginBottom: 6 }}>
        <div style={{ width: `${progresso}%`, background: materia.color }} />
      </div>
      <div className="texto-suave" style={{ marginBottom: 12 }}>
        {feitos}/{materia.topics.length} tópicos · {materia._count.tasks} tarefas ·{" "}
        {materia._count.cards} cartões · {materia._count.notes} notas
      </div>

      <ul className="lista-limpa" style={{ marginBottom: 12 }}>
        {materia.topics.map((t) => (
          <li key={t.id} className="linha-flex" style={{ gap: 8 }}>
            <input
              type="checkbox"
              checked={t.done}
              id={`topico-${t.id}`}
              onChange={(e) => {
                const done = e.target.checked;
                startTransition(() => alternarTopico(t.id, done));
              }}
            />
            <label htmlFor={`topico-${t.id}`} className={t.done ? "riscado" : ""} style={{ flex: 1 }}>
              {t.name}
            </label>
            <button
              className="btn-fantasma"
              title="Excluir tópico"
              onClick={() => startTransition(() => excluirTopico(t.id))}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <form
        action={(fd) => {
          startTransition(() => criarTopico(materia.id, fd));
        }}
        className="linha-flex"
      >
        <input name="name" placeholder="Novo tópico…" required style={{ flex: 1 }} />
        <button type="submit">+</button>
      </form>
    </div>
  );
}
