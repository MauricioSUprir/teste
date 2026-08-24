import { iaDisponivel, provedorAtivo } from "@/lib/ia-provider";
import { ChatAssistente } from "@/components/ChatAssistente";

export const dynamic = "force-dynamic";

export default function Assistente() {
  const provedor = provedorAtivo();
  return (
    <>
      <h1>Assistente IA</h1>
      <p className="subtitulo">
        Um tutor que conhece suas matérias, tarefas, cronograma e horas de estudo — e usa
        isso para montar planos, explicar conteúdos, gerar quizzes e sugerir flashcards.
        {provedor && (
          <>
            {" "}
            Conectado via <strong>{provedor === "claude" ? "Claude" : "Gemini"}</strong>.
          </>
        )}
      </p>
      <ChatAssistente ativo={iaDisponivel()} />
    </>
  );
}
