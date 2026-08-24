import { aiDisponivel } from "@/lib/ai";
import { ChatAssistente } from "@/components/ChatAssistente";

export const dynamic = "force-dynamic";

export default function Assistente() {
  return (
    <>
      <h1>Assistente IA</h1>
      <p className="subtitulo">
        Um tutor que conhece suas matérias, tarefas, cronograma e horas de estudo — e usa
        isso para montar planos, explicar conteúdos, gerar quizzes e sugerir flashcards.
      </p>
      <ChatAssistente ativo={aiDisponivel()} />
    </>
  );
}
