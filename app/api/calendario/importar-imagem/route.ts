import { NextResponse } from "next/server";
import { extrairJson, gerarResposta, iaDisponivel } from "@/lib/ia-provider";

export const maxDuration = 300;

type EventoExtraido = { title: string; date: string; type: string; notes?: string };

const MIMES_ACEITOS = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// Recebe uma imagem (foto de calendário escolar, aviso, cronograma de provas)
// e devolve os eventos que a IA identificou — o usuário confirma antes de salvar.
export async function POST(request: Request) {
  if (!iaDisponivel()) {
    return NextResponse.json(
      { error: "Conecte uma IA primeiro (página Integrações) para importar por imagem." },
      { status: 503 }
    );
  }

  const form = await request.formData();
  const arquivo = form.get("imagem");
  if (!(arquivo instanceof File)) {
    return NextResponse.json({ error: "Envie uma imagem." }, { status: 400 });
  }
  if (!MIMES_ACEITOS.includes(arquivo.type)) {
    return NextResponse.json(
      { error: "Formato não suportado. Envie JPG, PNG, WebP ou GIF." },
      { status: 400 }
    );
  }
  if (arquivo.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "Imagem muito grande (máx. 8 MB)." }, { status: 400 });
  }

  const dataBase64 = Buffer.from(await arquivo.arrayBuffer()).toString("base64");
  const hoje = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  try {
    const resposta = await gerarResposta({
      system: `Você extrai eventos escolares de imagens (fotos de calendários, quadros de avisos, cronogramas de provas, prints de mensagens).
Hoje é ${hoje}. Ao interpretar datas sem ano, use o ano que faz sentido a partir de hoje (a data futura mais próxima).
Retorne um array JSON de eventos com os campos:
- "title": título curto e claro (ex.: "Prova de Matemática — trigonometria")
- "date": data no formato YYYY-MM-DD
- "type": "PROVA" | "TRABALHO" | "AULA" | "EVENTO"
- "notes": detalhes extras se houver (opcional)
Inclua apenas o que tiver data identificável. Se não houver nenhum evento, retorne [].`,
      messages: [
        {
          role: "user",
          content:
            "Extraia os eventos desta imagem para o meu calendário de estudos. Responda apenas com o JSON.",
        },
      ],
      imagens: [{ mimeType: arquivo.type, dataBase64 }],
      json: true,
    });

    const eventos = extrairJson<EventoExtraido[]>(resposta);
    if (!Array.isArray(eventos)) {
      return NextResponse.json({ error: "A IA não encontrou eventos na imagem." }, { status: 422 });
    }

    const validos = eventos.filter(
      (e) => e?.title && /^\d{4}-\d{2}-\d{2}$/.test(e?.date ?? "")
    );
    return NextResponse.json({ eventos: validos });
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : "Falha ao ler a imagem.";
    return NextResponse.json({ error: mensagem }, { status: 502 });
  }
}
