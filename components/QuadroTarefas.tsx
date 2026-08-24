"use client";

import { useTransition } from "react";
import { excluirTarefa, moverTarefa } from "@/lib/actions";

export type TarefaView = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  source: string;
  link: string | null;
  subjectName: string | null;
  subjectColor: string | null;
};

const COLUNAS = [
  { status: "TODO", titulo: "A fazer" },
  { status: "DOING", titulo: "Fazendo" },
  { status: "DONE", titulo: "Concluídas" },
];

const ROTULO_PRIORIDADE: Record<string, string> = {
  BAIXA: "baixa",
  MEDIA: "média",
  ALTA: "alta",
};

export function QuadroTarefas({ tarefas }: { tarefas: TarefaView[] }) {
  const [, startTransition] = useTransition();

  return (
    <div className="kanban">
      {COLUNAS.map((coluna) => {
        const itens = tarefas.filter((t) => t.status === coluna.status);
        return (
          <div key={coluna.status} className="kanban-coluna">
            <div className="kanban-titulo">
              {coluna.titulo} ({itens.length})
            </div>
            {itens.map((t) => {
              const atrasada =
                t.status !== "DONE" && t.dueDate && new Date(t.dueDate) < new Date();
              return (
                <div key={t.id} className="cartao" style={{ padding: "12px 14px" }}>
                  <div className="linha-flex" style={{ marginBottom: 6 }}>
                    {t.subjectColor && (
                      <span className="ponto-cor" style={{ background: t.subjectColor }} />
                    )}
                    <span className={t.status === "DONE" ? "riscado" : ""} style={{ flex: 1 }}>
                      {t.title}
                    </span>
                    <button
                      className="btn-fantasma"
                      title="Excluir tarefa"
                      onClick={() => startTransition(() => excluirTarefa(t.id))}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="linha-flex" style={{ gap: 6, marginBottom: 8 }}>
                    {t.subjectName && <span className="pilula">{t.subjectName}</span>}
                    {t.priority === "ALTA" && (
                      <span className="pilula pilula-ambar">prioridade alta</span>
                    )}
                    {t.priority !== "ALTA" && (
                      <span className="pilula">{ROTULO_PRIORIDADE[t.priority] ?? t.priority}</span>
                    )}
                    {t.dueDate && (
                      <span className={`pilula ${atrasada ? "pilula-perigo" : ""}`}>
                        {atrasada ? "atrasada · " : ""}
                        {new Date(t.dueDate).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                    {t.source === "CLASSROOM" && (
                      <span className="pilula pilula-acento">Classroom</span>
                    )}
                  </div>
                  <div className="linha-flex" style={{ gap: 6 }}>
                    {coluna.status !== "TODO" && (
                      <button
                        onClick={() =>
                          startTransition(() =>
                            moverTarefa(t.id, coluna.status === "DONE" ? "DOING" : "TODO")
                          )
                        }
                      >
                        ←
                      </button>
                    )}
                    {coluna.status !== "DONE" && (
                      <button
                        className="btn-principal"
                        onClick={() =>
                          startTransition(() =>
                            moverTarefa(t.id, coluna.status === "TODO" ? "DOING" : "DONE")
                          )
                        }
                      >
                        {coluna.status === "DOING" ? "Concluir ✓" : "Começar →"}
                      </button>
                    )}
                    {t.link && (
                      <a
                        href={t.link}
                        target="_blank"
                        rel="noreferrer"
                        className="texto-suave"
                        style={{ marginLeft: "auto" }}
                      >
                        abrir ↗
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
            {itens.length === 0 && <div className="texto-suave" style={{ padding: 8 }}>vazio</div>}
          </div>
        );
      })}
    </div>
  );
}
