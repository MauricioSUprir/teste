import { NextResponse } from "next/server";
import { gerarResposta, iaDisponivel } from "@/lib/ia-provider";

export const maxDuration = 300;

// Técnica Feynman: o aluno explica um tópico com as próprias palavras
// e a IA avalia a explicação, apontando acertos, erros e lacunas.
export async function POST(request: Request) {
  if (!iaDisponivel()) {
    return NextResponse.json(
      { error: "Conecte uma IA primeiro (página Integrações)." },
      { status: 503 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    topico?: string;
    explicacao?: string;
  };
  const topico = body.topico?.trim();
  const explicacao = body.explicacao?.trim();
  if (!topico || !explicacao) {
    return NextResponse.json(
      { error: "Preencha o tópico e a sua explicação." },
      { status: 400 }
    );
  }

  try {
    const feedback = await gerarResposta({
      system: `Você aplica a técnica Feynman com estudantes brasileiros.
O estudante explica um tópico com as próprias palavras; você avalia como um professor gentil e direto:
1. ✅ O que está correto na explicação
2. ⚠️ O que está errado ou impreciso (corrija com clareza)
3. 🕳️ O que faltou (lacunas importantes)
4. 💡 Uma pergunta desafio para aprofundar
Seja específico e conciso. Responda em português do Brasil.`,
      messages: [
        {
          role: "user",
          content: `Tópico: ${topico}\n\nMinha explicação com minhas palavras:\n${explicacao}`,
        },
      ],
    });
    return NextResponse.json({ feedback });
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : "Falha ao avaliar.";
    return NextResponse.json({ error: mensagem }, { status: 502 });
  }
}
