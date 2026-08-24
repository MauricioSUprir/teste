import { db } from "@/lib/db";
import { criarTarefa } from "@/lib/actions";
import { QuadroTarefas } from "@/components/QuadroTarefas";
import { pontuacaoUrgencia } from "@/lib/urgencia";

export const dynamic = "force-dynamic";

export default async function Tarefas() {
  const [tarefas, materias] = await Promise.all([
    db.task.findMany({ include: { subject: true } }),
    db.subject.findMany({ orderBy: { name: "asc" } }),
  ]);

  // Mais urgente primeiro (prazo + dificuldade + vale nota)
  const ordenadas = [...tarefas].sort(
    (a, b) => pontuacaoUrgencia(b) - pontuacaoUrgencia(a)
  );

  return (
    <>
      <h1>Tarefas</h1>
      <p className="subtitulo">
        Deveres de casa e trabalhos avaliativos, ordenados por urgência — calculada pelo
        prazo, pela dificuldade e por valer nota. As atividades do Google Classroom entram
        aqui já classificadas.
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
          <select name="kind" aria-label="Tipo" defaultValue="CASA">
            <option value="CASA">Dever de casa</option>
            <option value="AVALIATIVO">Avaliativo (vale nota)</option>
          </select>
          <select name="difficulty" aria-label="Dificuldade" defaultValue="3">
            <option value="1">Dificuldade 1 — muito fácil</option>
            <option value="2">Dificuldade 2 — fácil</option>
            <option value="3">Dificuldade 3 — média</option>
            <option value="4">Dificuldade 4 — difícil</option>
            <option value="5">Dificuldade 5 — muito difícil</option>
          </select>
          <input type="date" name="dueDate" aria-label="Prazo" />
          <button type="submit" className="btn-principal">
            Adicionar
          </button>
        </div>
      </form>

      <QuadroTarefas
        tarefas={ordenadas.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          kind: t.kind,
          difficulty: t.difficulty,
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
