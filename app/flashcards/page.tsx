import { db } from "@/lib/db";
import { criarFlashcard } from "@/lib/actions";
import { RevisaoFlashcards } from "@/components/RevisaoFlashcards";

export const dynamic = "force-dynamic";

export default async function Flashcards() {
  const agora = new Date();
  const [vencidos, total, materias, proximos] = await Promise.all([
    db.flashcard.findMany({
      where: { dueDate: { lte: agora } },
      orderBy: { dueDate: "asc" },
      take: 50,
      include: { subject: true },
    }),
    db.flashcard.count(),
    db.subject.findMany({ orderBy: { name: "asc" } }),
    db.flashcard.findMany({
      where: { dueDate: { gt: agora } },
      orderBy: { dueDate: "asc" },
      take: 5,
      include: { subject: true },
    }),
  ]);

  return (
    <>
      <h1>Flashcards</h1>
      <p className="subtitulo">
        Revisão com repetição espaçada (algoritmo SM-2, o mesmo princípio do Anki): o sistema
        decide quando cada cartão volta. O assistente de IA pode gerar cartões a partir das
        suas notas.
      </p>

      <div className="grade grade-2" style={{ marginBottom: 20 }}>
        <RevisaoFlashcards
          cartoes={vencidos.map((c) => ({
            id: c.id,
            front: c.front,
            back: c.back,
            subjectName: c.subject?.name ?? null,
          }))}
          totalCartoes={total}
        />

        <div className="pilha">
          <form action={criarFlashcard} className="cartao pilha">
            <h2>Novo cartão</h2>
            <input name="front" placeholder="Frente (pergunta)" required />
            <textarea name="back" placeholder="Verso (resposta)" required rows={3} />
            <div className="linha-flex">
              <select name="subjectId" aria-label="Matéria" defaultValue="" style={{ flex: 1 }}>
                <option value="">Sem matéria</option>
                {materias.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn-principal">
                Criar
              </button>
            </div>
          </form>

          <div className="cartao">
            <h2>Próximas revisões</h2>
            {proximos.length === 0 ? (
              <p className="texto-suave">Nenhum cartão agendado.</p>
            ) : (
              <ul className="lista-limpa">
                {proximos.map((c) => (
                  <li key={c.id} className="item-lista">
                    <span style={{ flex: 1 }}>{c.front}</span>
                    <span className="pilula">
                      {c.dueDate.toLocaleDateString("pt-BR")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
