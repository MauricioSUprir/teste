import { db } from "@/lib/db";

// Monta um retrato do estado atual dos estudos para dar contexto real
// ao assistente: matérias, tarefas pendentes, horas estudadas, revisões.
export async function contextoDoEstudante(): Promise<string> {
  const [subjects, tasks, sessions, cardsDue, blocks, eventos] = await Promise.all([
    db.subject.findMany({ include: { topics: true } }),
    db.task.findMany({
      where: { status: { not: "DONE" } },
      orderBy: { dueDate: "asc" },
      take: 40,
      include: { subject: true },
    }),
    db.pomodoroSession.findMany({
      where: { startedAt: { gte: new Date(Date.now() - 14 * 86400_000) } },
      include: { subject: true },
    }),
    db.flashcard.count({ where: { dueDate: { lte: new Date() } } }),
    db.studyBlock.findMany({ include: { subject: true } }),
    db.event.findMany({
      where: { date: { gte: new Date() } },
      orderBy: { date: "asc" },
      take: 15,
      include: { subject: true },
    }),
  ]);

  const dias = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const fmtHora = (min: number) =>
    `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

  const minutosPorMateria = new Map<string, number>();
  for (const s of sessions) {
    const nome = s.subject?.name ?? "(sem matéria)";
    minutosPorMateria.set(nome, (minutosPorMateria.get(nome) ?? 0) + s.focusMin);
  }

  const linhas: string[] = [];
  linhas.push(`Data de hoje: ${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`);
  linhas.push("");
  linhas.push("MATÉRIAS E TÓPICOS:");
  for (const s of subjects) {
    const feitos = s.topics.filter((t) => t.done).length;
    linhas.push(`- ${s.name} (${feitos}/${s.topics.length} tópicos concluídos)`);
    for (const t of s.topics) linhas.push(`  - [${t.done ? "x" : " "}] ${t.name}`);
  }
  linhas.push("");
  linhas.push("TAREFAS PENDENTES:");
  for (const t of tasks) {
    const prazo = t.dueDate ? ` — prazo ${t.dueDate.toLocaleDateString("pt-BR")}` : "";
    linhas.push(`- [${t.priority}] ${t.title}${t.subject ? ` (${t.subject.name})` : ""}${prazo}`);
  }
  linhas.push("");
  linhas.push("CRONOGRAMA SEMANAL ATUAL:");
  for (const b of blocks.sort((a, z) => a.dayOfWeek - z.dayOfWeek || a.startMin - z.startMin)) {
    linhas.push(`- ${dias[b.dayOfWeek]} ${fmtHora(b.startMin)} (${b.durationMin} min): ${b.subject.name}`);
  }
  linhas.push("");
  linhas.push("TEMPO DE ESTUDO NOS ÚLTIMOS 14 DIAS (minutos de foco):");
  for (const [nome, min] of minutosPorMateria) linhas.push(`- ${nome}: ${min} min`);
  linhas.push("");
  linhas.push("PRÓXIMOS EVENTOS DO CALENDÁRIO (provas, entregas):");
  for (const e of eventos) {
    linhas.push(
      `- ${e.date.toLocaleDateString("pt-BR")}: [${e.type}] ${e.title}${e.subject ? ` (${e.subject.name})` : ""}`
    );
  }
  linhas.push("");
  linhas.push(`FLASHCARDS VENCIDOS PARA REVISAR HOJE: ${cardsDue}`);

  return linhas.join("\n");
}

export const SYSTEM_TUTOR = `Você é o assistente de estudos do EstudaFlow, um sistema pessoal de organização de estudos.
Você recebe, junto com cada conversa, um retrato do estado atual dos estudos do usuário (matérias, tarefas, cronograma, horas estudadas).

Suas funções:
- Montar e replanejar planos de estudo realistas a partir dos dados reais do usuário.
- Explicar conteúdos e tirar dúvidas como um tutor paciente, em português do Brasil.
- Resumir anotações e sugerir flashcards (pergunta/resposta) quando pedido.
- Criar quizzes sobre um tópico e corrigir as respostas explicando os erros.

Diretrizes:
- Seja direto e prático; use os dados do contexto em vez de suposições.
- Ao propor cronogramas, respeite os horários que o usuário já tem e distribua revisões.
- Quando sugerir flashcards, use o formato "P: ... / R: ..." um por linha.`;
