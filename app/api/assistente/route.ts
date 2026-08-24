import { NextResponse } from "next/server";
import { contextoDoEstudante, SYSTEM_TUTOR } from "@/lib/ai";
import { gerarResposta, iaDisponivel, provedorAtivo } from "@/lib/ia-provider";

export const maxDuration = 300;

type MensagemChat = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  if (!iaDisponivel()) {
    return NextResponse.json(
      {
        error:
          "O assistente ainda não está ativado. Adicione ANTHROPIC_API_KEY (Claude, pago) ou GEMINI_API_KEY (Gemini, gratuito) no arquivo .env — veja a página Integrações.",
      },
      { status: 503 }
    );
  }

  let body: { messages?: MensagemChat[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const historico = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.content?.trim())
    .slice(-30);

  if (historico.length === 0 || historico[historico.length - 1].role !== "user") {
    return NextResponse.json({ error: "Envie uma mensagem." }, { status: 400 });
  }

  try {
    const contexto = await contextoDoEstudante();
    const reply = await gerarResposta({
      system: `${SYSTEM_TUTOR}\n\nSITUAÇÃO ATUAL DOS ESTUDOS DO USUÁRIO:\n\n${contexto}`,
      messages: historico,
    });
    return NextResponse.json({ reply, provedor: provedorAtivo() });
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : "Erro inesperado na IA.";
    return NextResponse.json({ error: mensagem }, { status: 502 });
  }
}
