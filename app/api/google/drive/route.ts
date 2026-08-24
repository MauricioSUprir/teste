import { NextResponse } from "next/server";
import { arquivosRecentes, contaConectada } from "@/lib/google";

// Lista arquivos recentes do Google Drive.
export async function GET() {
  const auth = await contaConectada();
  if (!auth) {
    return NextResponse.json({ error: "Nenhuma conta Google conectada." }, { status: 401 });
  }

  try {
    const arquivos = await arquivosRecentes(auth);
    return NextResponse.json({ arquivos });
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : "erro desconhecido";
    return NextResponse.json(
      { error: `Falha ao consultar o Drive: ${mensagem}` },
      { status: 502 }
    );
  }
}
