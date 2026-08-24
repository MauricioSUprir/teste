import { db } from "@/lib/db";
import { criarMateria } from "@/lib/actions";
import { CartaoMateria } from "@/components/CartaoMateria";

export const dynamic = "force-dynamic";

export default async function Materias() {
  const materias = await db.subject.findMany({
    orderBy: { createdAt: "asc" },
    include: { topics: true, _count: { select: { tasks: true, cards: true, notes: true } } },
  });

  return (
    <>
      <h1>Matérias</h1>
      <p className="subtitulo">
        Cadastre suas disciplinas e os tópicos de cada uma — o progresso é calculado pelos
        tópicos concluídos.
      </p>

      <form action={criarMateria} className="cartao linha-flex" style={{ marginBottom: 20 }}>
        <input name="name" placeholder="Nome da matéria (ex.: Matemática)" required style={{ flex: 1, minWidth: 200 }} />
        <label className="linha-flex texto-suave" style={{ gap: 6 }}>
          Cor
          <input type="color" name="color" defaultValue="#2E6E54" style={{ padding: 2, width: 44, height: 36 }} />
        </label>
        <button type="submit" className="btn-principal">
          Adicionar matéria
        </button>
      </form>

      {materias.length === 0 ? (
        <p className="texto-suave">Nenhuma matéria ainda. Comece adicionando a primeira acima.</p>
      ) : (
        <div className="grade grade-2">
          {materias.map((m) => (
            <CartaoMateria key={m.id} materia={m} />
          ))}
        </div>
      )}
    </>
  );
}
