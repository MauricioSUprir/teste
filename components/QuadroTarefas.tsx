"use client";

import { useTransition } from "react";
import { ajustarTarefa, excluirTarefa, moverTarefa } from "@/lib/actions";
import { nivelUrgencia, ROTULO_URGENCIA } from "@/lib/urgencia";

export type TarefaView = {
  id: string;
  title: string;
  status: string;
  kind: string;
  difficulty: number;
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
              const urgencia = nivelUrgencia({
                dueDate: t.dueDate,
                difficulty: t.difficulty,
                kind: t.kind,
                status: t.status,
              });
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
                    {t.status !== "DONE" && (
                      <span
                        className={`pilula ${
                          urgencia === "CRITICA" || urgencia === "ALTA"
                            ? "pilula-perigo"
                            : urgencia === "MEDIA"
                              ? "pilula-ambar"
                              : ""
                        }`}
                      >
                        {ROTULO_URGENCIA[urgencia]}
                      </span>
                    )}
                    <span className={`pilula ${t.kind === "AVALIATIVO" ? "pilula-ambar" : ""}`}>
                      {t.kind === "AVALIATIVO" ? "vale nota" : "dever de casa"}
                    </span>
                    {t.subjectName && <span className="pilula">{t.subjectName}</span>}
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
                  {t.status !== "DONE" && (
                    <div className="linha-flex" style={{ gap: 6, marginBottom: 8 }}>
                      <label className="texto-suave" style={{ fontSize: "0.8rem" }}>
                        Dificuldade{" "}
                        <select
                          value={t.difficulty}
                          onChange={(e) => {
                            const dif = Number(e.target.value);
                            startTransition(() => ajustarTarefa(t.id, { difficulty: dif }));
                          }}
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="texto-suave" style={{ fontSize: "0.8rem" }}>
                        Tipo{" "}
                        <select
                          value={t.kind}
                          onChange={(e) => {
                            const kind = e.target.value;
                            startTransition(() => ajustarTarefa(t.id, { kind }));
                          }}
                        >
                          <option value="CASA">casa</option>
                          <option value="AVALIATIVO">vale nota</option>
                        </select>
                      </label>
                    </div>
                  )}
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
