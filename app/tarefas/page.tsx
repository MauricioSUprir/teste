import { db } from "@/lib/db";
import { criarTarefa } from "@/lib/actions";
import { QuadroTarefas } from "@/components/QuadroTarefas";

export const dynamic = "force-dynamic";

export default async function Tarefas() {
  const [tarefas, materias] = await Promise.all([
    db.task.findMany({
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      include: { subject: true },
    }),
    db.subject.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <h1>Tarefas</h1>
      <p className="subtitulo">
        Trabalhos, listas, leituras e provas — as atividades importadas do Google Classroom
        também aparecem aqui.
      </p>

      <form action={criarTarefa} className="cartao pilha" style={{ marginBottom: 20 }}>
        <div className="linha-flex">
          <input name="title" placeholder="Nova tarefa (ex.: Lista 3 de Física)" required style={{ flex: 2, minWidth: 220 }} />
          <select name="subjectId" aria-label="Matéria" defaultValue="">
            <option value="">Sem matéria</option>
            {materias.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <select name="priority" aria-label="Prioridade" defaultValue="MEDIA">
            <option value="BAIXA">Prioridade baixa</option>
            <option value="MEDIA">Prioridade média</option>
            <option value="ALTA">Prioridade alta</option>
          </select>
          <input type="date" name="dueDate" aria-label="Prazo" />
          <button type="submit" className="btn-principal">
            Adicionar
          </button>
        </div>
      </form>

      <QuadroTarefas
        tarefas={tarefas.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate?.toISOString() ?? null,
          source: t.source,
          link: t.link,
          subjectName: t.subject?.name ?? null,
          subjectColor: t.subject?.color ?? null,
        }))}
      />
    </>
  );
}
