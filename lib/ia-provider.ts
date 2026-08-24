import Anthropic from "@anthropic-ai/sdk";

// Camada de IA com dois provedores:
// - Claude (Anthropic): pago por uso — defina ANTHROPIC_API_KEY
// - Gemini (Google): tem plano gratuito — defina GEMINI_API_KEY
// Se as duas chaves existirem, o Claude tem preferência
// (mude com IA_PROVEDOR="gemini" ou "claude").

export type MensagemIA = { role: "user" | "assistant"; content: string };
export type ImagemIA = { mimeType: string; dataBase64: string };

export type PedidoIA = {
  system: string;
  messages: MensagemIA[];
  imagens?: ImagemIA[]; // anexadas à última mensagem do usuário
  json?: boolean; // pede resposta em JSON puro
  maxTokens?: number;
};

export function provedorAtivo(): "claude" | "gemini" | null {
  const preferido = process.env.IA_PROVEDOR;
  const temClaude = Boolean(process.env.ANTHROPIC_API_KEY);
  const temGemini = Boolean(process.env.GEMINI_API_KEY);
  if (preferido === "gemini" && temGemini) return "gemini";
  if (preferido === "claude" && temClaude) return "claude";
  if (temClaude) return "claude";
  if (temGemini) return "gemini";
  return null;
}

export function iaDisponivel(): boolean {
  return provedorAtivo() !== null;
}

export async function gerarResposta(pedido: PedidoIA): Promise<string> {
  const provedor = provedorAtivo();
  if (provedor === "claude") return viaClaude(pedido);
  if (provedor === "gemini") return viaGemini(pedido);
  throw new Error(
    "Nenhuma IA configurada. Defina ANTHROPIC_API_KEY (Claude, pago) ou GEMINI_API_KEY (Gemini, gratuito) no .env — veja docs/INTEGRACOES.md."
  );
}

// ── Claude (Anthropic) ───────────────────────────────────────

async function viaClaude(pedido: PedidoIA): Promise<string> {
  const client = new Anthropic();
  const model = process.env.CLAUDE_MODEL || "claude-opus-5";

  const messages: Anthropic.MessageParam[] = pedido.messages.map((m, i) => {
    const ehUltimaDoUsuario =
      m.role === "user" && i === pedido.messages.length - 1;
    if (ehUltimaDoUsuario && pedido.imagens?.length) {
      return {
        role: "user",
        content: [
          ...pedido.imagens.map(
            (img): Anthropic.ImageBlockParam => ({
              type: "image",
              source: {
                type: "base64",
                media_type: img.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: img.dataBase64,
              },
            })
          ),
          { type: "text", text: m.content },
        ],
      };
    }
    return { role: m.role, content: m.content };
  });

  const system = pedido.json
    ? `${pedido.system}\n\nResponda APENAS com JSON válido, sem texto antes ou depois, sem cercas de código.`
    : pedido.system;

  // Streaming no servidor evita timeout em respostas longas
  const stream = client.messages.stream({
    model,
    max_tokens: pedido.maxTokens ?? 16000,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages,
  });
  const resposta = await stream.finalMessage();

  if (resposta.stop_reason === "refusal") {
    throw new Error("A IA não pôde responder a esse pedido. Tente reformular.");
  }

  return resposta.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

// ── Gemini (Google) ──────────────────────────────────────────

type ParteGemini =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

async function viaGemini(pedido: PedidoIA): Promise<string> {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const contents = pedido.messages.map((m, i) => {
    const partes: ParteGemini[] = [];
    const ehUltimaDoUsuario = m.role === "user" && i === pedido.messages.length - 1;
    if (ehUltimaDoUsuario && pedido.imagens?.length) {
      for (const img of pedido.imagens) {
        partes.push({ inline_data: { mime_type: img.mimeType, data: img.dataBase64 } });
      }
    }
    partes.push({ text: m.content });
    return { role: m.role === "assistant" ? "model" : "user", parts: partes };
  });

  const body: Record<string, unknown> = {
    system_instruction: { parts: [{ text: pedido.system }] },
    contents,
    generationConfig: {
      maxOutputTokens: pedido.maxTokens ?? 8192,
      ...(pedido.json ? { response_mime_type: "application/json" } : {}),
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY ?? "",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detalhe = await res.text().catch(() => "");
    if (res.status === 429) {
      throw new Error(
        "Limite gratuito do Gemini atingido por agora. Aguarde um minuto e tente de novo."
      );
    }
    if (res.status === 400 || res.status === 403) {
      throw new Error("Chave do Gemini inválida ou sem acesso. Confira GEMINI_API_KEY no .env.");
    }
    throw new Error(`Erro na API do Gemini (${res.status}): ${detalhe.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const texto = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("");

  if (!texto) throw new Error("A IA não retornou resposta. Tente de novo.");
  return texto;
}

// ── Utilitário: extrair JSON de uma resposta de IA ───────────

export function extrairJson<T>(texto: string): T {
  const limpo = texto
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "");
  const inicio = limpo.search(/[[{]/);
  if (inicio === -1) throw new Error("A IA não retornou JSON.");
  return JSON.parse(limpo.slice(inicio)) as T;
}
