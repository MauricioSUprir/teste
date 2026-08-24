import { db } from "@/lib/db";
import { criarEvento } from "@/lib/actions";
import { CalendarioMensal } from "@/components/CalendarioMensal";
import { ImportarImagem } from "@/components/ImportarImagem";
import { iaDisponivel } from "@/lib/ia-provider";

export const dynamic = "force-dynamic";

export default async function Calendario() {
  const [eventos, tarefasComPrazo, materias] = await Promise.all([
    db.event.findMany({ include: { subject: true }, orderBy: { date: "asc" } }),
    db.task.findMany({
      where: { dueDate: { not: null }, status: { not: "DONE" } },
      include: { subject: true },
    }),
    db.subject.findMany({ orderBy: { name: "asc" } }),
  ]);

  const itens = [
    ...eventos.map((e) => ({
      id: `ev-${e.id}`,
      eventoId: e.id,
      titulo: e.title,
      dataISO: e.date.toISOString(),
      tipo: e.type,
      cor: e.subject?.color ?? null,
      ehTarefa: false,
    })),
    ...tarefasComPrazo.map((t) => ({
      id: `ta-${t.id}`,
      eventoId: null,
      titulo: t.title,
      dataISO: t.dueDate!.toISOString(),
      tipo: t.kind === "AVALIATIVO" ? "TRABALHO" : "ENTREGA",
      cor: t.subject?.color ?? null,
      ehTarefa: true,
    })),
  ];

  return (
    <>
      <h1>Calendário</h1>
      <p className="subtitulo">
        Provas, entregas e eventos da escola em um só lugar. Adicione manualmente, ou envie
        uma foto do calendário/aviso da escola e a IA coloca cada coisa na data certa. Os
        prazos das suas tarefas aparecem automaticamente.
      </p>

      <div className="grade grade-2" style={{ marginBottom: 20 }}>
        <form action={criarEvento} className="cartao pilha">
          <h2>Adicionar evento</h2>
          <input name="title" placeholder="Ex.: Prova de Matemática" required />
          <div className="linha-flex">
            <input type="date" name="date" required aria-label="Data" />
            <select name="type" aria-label="Tipo" defaultValue="PROVA">
              <option value="PROVA">Prova</option>
              <option value="TRABALHO">Trabalho/entrega</option>
              <option value="AULA">Aula especial</option>
              <option value="EVENTO">Evento</option>
            </select>
            <select name="subjectId" aria-label="Matéria" defaultValue="">
              <option value="">Sem matéria</option>
              {materias.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <input name="notes" placeholder="Observações (opcional)" />
          <button type="submit" className="btn-principal" style={{ alignSelf: "flex-start" }}>
            Adicionar ao calendário
          </button>
        </form>

        <ImportarImagem iaAtiva={iaDisponivel()} />
      </div>

      <CalendarioMensal itens={itens} />
    </>
  );
}
