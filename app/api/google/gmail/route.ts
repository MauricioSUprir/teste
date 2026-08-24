import { NextResponse } from "next/server";
import { contaConectada, emailsDeEstudo } from "@/lib/google";

// Lista e-mails recentes relacionados a estudos.
export async function GET() {
  const auth = await contaConectada();
  if (!auth) {
    return NextResponse.json({ error: "Nenhuma conta Google conectada." }, { status: 401 });
  }

  try {
    const mensagens = await emailsDeEstudo(auth);
    return NextResponse.json({ mensagens });
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : "erro desconhecido";
    return NextResponse.json(
      { error: `Falha ao consultar o Gmail: ${mensagem}` },
      { status: 502 }
    );
  }
}
