import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { extrairJson, gerarResposta, iaDisponivel } from "@/lib/ia-provider";

export const maxDuration = 300;

export type QuestaoQuiz = {
  pergunta: string;
  alternativas: string[]; // 4 opções
  correta: number; // índice 0-3
  explicacao: string;
};

// Gera um quiz de 5 questões sobre um assunto (e, se houver, usa a nota como base).
export async function POST(request: Request) {
  if (!iaDisponivel()) {
    return NextResponse.json(
      { error: "Conecte uma IA primeiro (página Integrações)." },
      { status: 503 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    assunto?: string;
    notaId?: string;
  };

  let base = body.assunto?.trim() ?? "";
  if (body.notaId) {
    const nota = await db.note.findUnique({ where: { id: body.notaId } });
    if (nota) base = `${nota.title}\n\n${nota.content}`;
  }
  if (!base) {
    return NextResponse.json({ error: "Informe o assunto do quiz." }, { status: 400 });
  }

  try {
    const resposta = await gerarResposta({
      system: `Você cria quizzes de estudo em português do Brasil.
Retorne um array JSON com exatamente 5 questões de múltipla escolha sobre o assunto dado.
Cada questão: {"pergunta": string, "alternativas": [4 strings], "correta": índice 0-3, "explicacao": explicação curta de por que a resposta certa está certa}.
Misture níveis de dificuldade. Alternativas erradas devem ser plausíveis.`,
      messages: [{ role: "user", content: `Assunto/material de base:\n\n${base}` }],
      json: true,
    });

    const questoes = extrairJson<QuestaoQuiz[]>(resposta).filter(
      (q) =>
        q?.pergunta &&
        Array.isArray(q.alternativas) &&
        q.alternativas.length >= 2 &&
        typeof q.correta === "number" &&
        q.correta >= 0 &&
        q.correta < q.alternativas.length
    );

    if (questoes.length === 0) {
      return NextResponse.json({ error: "Não consegui gerar o quiz. Tente outro assunto." }, { status: 422 });
    }
    return NextResponse.json({ questoes });
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : "Falha ao gerar o quiz.";
    return NextResponse.json({ error: mensagem }, { status: 502 });
  }
}
