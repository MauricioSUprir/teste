import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { contaConectada, sincronizarClassroom } from "@/lib/google";

// Sincroniza as atividades do Google Classroom como tarefas.
export async function POST() {
  const auth = await contaConectada();
  if (!auth) {
    return NextResponse.json({ error: "Nenhuma conta Google conectada." }, { status: 401 });
  }

  try {
    const resultado = await sincronizarClassroom(auth);
    revalidatePath("/", "layout");
    return NextResponse.json(resultado);
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : "erro desconhecido";
    return NextResponse.json(
      { error: `Falha ao sincronizar com o Classroom: ${mensagem}` },
      { status: 502 }
    );
  }
}
