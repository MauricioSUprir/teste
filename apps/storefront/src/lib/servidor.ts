/**
 * Comunicação com o servidor BeautyNow (apps/servidor).
 *
 * O servidor é quem envia o código de verificação por e-mail de verdade e
 * repassa pedidos ao Hub Suprir com a X-API-Key (que nunca chega ao
 * navegador). Enquanto NEXT_PUBLIC_SERVIDOR_URL não estiver configurada no
 * build, o site funciona em modo demonstração: código exibido na tela e
 * pedidos registrados apenas localmente.
 */
import type { Pedido } from "./pedidos";

export const SERVIDOR_URL = (process.env.NEXT_PUBLIC_SERVIDOR_URL ?? "").replace(/\/$/, "");

export function servidorConfigurado(): boolean {
  return SERVIDOR_URL.length > 0;
}

async function chamar(caminho: string, corpo: unknown): Promise<{ ok: boolean; erro?: string }> {
  try {
    const resposta = await fetch(`${SERVIDOR_URL}${caminho}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const dados = (await resposta.json().catch(() => ({}))) as { erro?: string };
    if (!resposta.ok) return { ok: false, erro: dados.erro ?? "O servidor não respondeu. Tente novamente." };
    return { ok: true };
  } catch {
    return { ok: false, erro: "Sem conexão com o servidor. Tente novamente em instantes." };
  }
}

let cacheEmailReal: { valor: boolean; expira: number } | null = null;

/**
 * O envio de código pelo servidor só é usado quando o e-mail real (Gmail)
 * está configurado lá — senão o site mantém o modo demonstração local
 * (código visível na tela). Assim, ligar o Gmail no servidor ativa o
 * e-mail real automaticamente, sem republicar o site.
 */
export async function emailRealAtivo(): Promise<boolean> {
  if (!servidorConfigurado()) return false;
  if (cacheEmailReal && Date.now() < cacheEmailReal.expira) return cacheEmailReal.valor;
  try {
    const resposta = await fetch(`${SERVIDOR_URL}/saude`);
    const dados = (await resposta.json()) as { emailModo?: string };
    const valor = resposta.ok && dados.emailModo === "gmail";
    cacheEmailReal = { valor, expira: Date.now() + 5 * 60_000 };
    return valor;
  } catch {
    cacheEmailReal = { valor: false, expira: Date.now() + 60_000 };
    return false;
  }
}

/** Pede ao servidor que gere e envie o código de verificação por e-mail. */
export function solicitarCodigoPorEmail(email: string) {
  return chamar("/codigo", { email });
}

/** Confirma no servidor o código digitado. */
export function verificarCodigoNoServidor(email: string, codigo: string) {
  return chamar("/codigo/verificar", { email, codigo });
}

/** Envia o pedido ao servidor, que repassa ao Hub Suprir. */
export async function enviarPedidoAoServidor(
  pedido: Pedido,
  extras: { endereco: unknown; cpf: string; telefone: string }
): Promise<void> {
  if (!servidorConfigurado()) return; // modo demonstração: pedido só local
  // falha aqui não pode travar a confirmação da compra — o registro local fica
  await chamar("/pedidos", { ...pedido, ...extras }).catch(() => undefined);
}
