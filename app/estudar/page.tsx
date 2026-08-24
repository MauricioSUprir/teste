import { db } from "@/lib/db";
import { iaDisponivel } from "@/lib/ia-provider";
import { ModosDeEstudo } from "@/components/ModosDeEstudo";

export const dynamic = "force-dynamic";

export default async function Estudar() {
  const notas = await db.note.findMany({
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true },
    take: 30,
  });

  return (
    <>
      <h1>Modos de estudo</h1>
      <p className="subtitulo">
        Além do Pomodoro e dos flashcards: quiz gerado por IA para se testar, e a técnica
        Feynman — explicar com suas palavras e descobrir o que ainda não domina.
      </p>
      <ModosDeEstudo iaAtiva={iaDisponivel()} notas={notas} />
    </>
  );
}
