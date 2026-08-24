import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { aiDisponivel, contextoDoEstudante, getClient, MODEL, SYSTEM_TUTOR } from "@/lib/ai";

export const maxDuration = 300;

type MensagemChat = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  if (!aiDisponivel()) {
    return NextResponse.json(
      {
        error:
          "O assistente ainda não está ativado. Adicione sua ANTHROPIC_API_KEY no arquivo .env (veja o README) e reinicie o servidor.",
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

  const contexto = await contextoDoEstudante();
  const client = getClient();

  try {
    // Streaming no servidor evita timeout em respostas longas (planos de
    // estudo completos); a resposta final é devolvida de uma vez ao navegador.
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      system: [
        { type: "text", text: SYSTEM_TUTOR, cache_control: { type: "ephemeral" } },
        { type: "text", text: `SITUAÇÃO ATUAL DOS ESTUDOS DO USUÁRIO:\n\n${contexto}` },
      ],
      messages: historico.map((m) => ({ role: m.role, content: m.content })),
    });
    const resposta = await stream.finalMessage();

    if (resposta.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "O assistente não pôde responder a esse pedido. Tente reformular." },
        { status: 200 }
      );
    }

    const texto = resposta.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    return NextResponse.json({ reply: texto });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "Chave da API inválida. Confira a ANTHROPIC_API_KEY no .env." },
        { status: 401 }
      );
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Limite de uso da API atingido. Tente de novo em instantes." },
        { status: 429 }
      );
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Erro na API do Claude (${error.status}). Tente novamente.` },
        { status: 502 }
      );
    }
    throw error;
  }
}
