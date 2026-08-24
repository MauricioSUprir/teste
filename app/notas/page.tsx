import { db } from "@/lib/db";
import { criarNota } from "@/lib/actions";
import { EditorNota } from "@/components/EditorNota";

export const dynamic = "force-dynamic";

export default async function Notas() {
  const [notas, materias] = await Promise.all([
    db.note.findMany({
      orderBy: { updatedAt: "desc" },
      include: { subject: true },
    }),
    db.subject.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <h1>Notas</h1>
      <p className="subtitulo">
        Anotações de aula e resumos por matéria. Peça ao Assistente IA para resumir uma nota
        ou transformá-la em flashcards.
      </p>

      <form action={criarNota} className="cartao linha-flex" style={{ marginBottom: 20 }}>
        <input name="title" placeholder="Título da nota (ex.: Aula 4 — Termodinâmica)" required style={{ flex: 1, minWidth: 220 }} />
        <select name="subjectId" aria-label="Matéria" defaultValue="">
          <option value="">Sem matéria</option>
          {materias.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-principal">
          Nova nota
        </button>
      </form>

      {notas.length === 0 ? (
        <p className="texto-suave">Nenhuma nota ainda.</p>
      ) : (
        <div className="pilha">
          {notas.map((n) => (
            <EditorNota
              key={n.id}
              nota={{
                id: n.id,
                title: n.title,
                content: n.content,
                subjectName: n.subject?.name ?? null,
                subjectColor: n.subject?.color ?? null,
                updatedAt: n.updatedAt.toISOString(),
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}
