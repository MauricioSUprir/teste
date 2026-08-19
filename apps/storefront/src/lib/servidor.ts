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

/** fetch com limite de espera — o plano gratuito do Render dorme e pode
 * demorar até ~1 min para acordar; sem timeout o botão pareceria travado. */
async function fetchComTimeout(url: string, ms: number, init?: RequestInit): Promise<Response> {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controle.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function chamar(caminho: string, corpo: unknown): Promise<{ ok: boolean; erro?: string }> {
  try {
    const resposta = await fetchComTimeout(`${SERVIDOR_URL}${caminho}`, 75_000, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const dados = (await resposta.json().catch(() => ({}))) as { erro?: string };
    if (!resposta.ok) return { ok: false, erro: dados.erro ?? "O servidor não respondeu. Tente novamente." };
    return { ok: true };
  } catch {
    return {
      ok: false,
      erro: "O servidor está acordando — aguarde uns 30 segundos e tente de novo.",
    };
  }
}

interface Saude {
  emailModo?: string;
  mp?: boolean;
}

let cacheSaude: { valor: Saude | null; expira: number } | null = null;

/** Consulta /saude do servidor com cache — decide quais recursos reais estão ligados. */
async function consultarSaude(): Promise<Saude | null> {
  if (!servidorConfigurado()) return null;
  if (cacheSaude && Date.now() < cacheSaude.expira) return cacheSaude.valor;
  try {
    // 65s: tempo suficiente para o servidor gratuito acordar na 1ª visita
    const resposta = await fetchComTimeout(`${SERVIDOR_URL}/saude`, 65_000);
    const dados = (await resposta.json()) as Saude;
    cacheSaude = { valor: resposta.ok ? dados : null, expira: Date.now() + 5 * 60_000 };
  } catch {
    cacheSaude = { valor: null, expira: Date.now() + 30_000 };
  }
  return cacheSaude.valor;
}

/**
 * Acorda o servidor em segundo plano assim que o site abre. Quando a pessoa
 * chegar no login ou no checkout, ele já está de pé e a resposta é imediata.
 */
export function acordarServidor() {
  if (!servidorConfigurado()) return;
  void consultarSaude();
}

/**
 * O envio de código pelo servidor só é usado quando o e-mail real (Gmail)
 * está configurado lá — senão o site mantém o modo demonstração local
 * (código visível na tela). Ligar o Gmail no servidor ativa o e-mail real
 * automaticamente, sem republicar o site.
 */
export async function emailRealAtivo(): Promise<boolean> {
  const modo = (await consultarSaude())?.emailModo;
  return modo === "gmail" || modo === "brevo";
}

/** Mercado Pago ligado no servidor → checkout usa pagamento real. */
export async function mercadoPagoAtivo(): Promise<boolean> {
  return (await consultarSaude())?.mp === true;
}

export interface PixReal {
  paymentId: number | string;
  copiaCola: string | null;
  qrBase64: string | null;
}

/** Cria o pagamento Pix real no Mercado Pago (via servidor). */
export async function criarPagamentoPix(
  pedido: Pedido,
  cpf: string
): Promise<{ ok: boolean; pix?: PixReal; erro?: string }> {
  try {
    const resposta = await fetch(`${SERVIDOR_URL}/pagamentos/pix`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pedido, cpf }),
    });
    const dados = (await resposta.json()) as PixReal & { erro?: string };
    if (!resposta.ok) return { ok: false, erro: dados.erro ?? "Falha ao gerar o Pix." };
    return { ok: true, pix: dados };
  } catch {
    return { ok: false, erro: "Sem conexão com o servidor de pagamento." };
  }
}

/** Cria o Checkout Pro (cartão/boleto) e devolve o link seguro do Mercado Pago. */
export async function criarCheckoutPro(
  pedido: Pedido,
  meio: "cartao" | "boleto"
): Promise<{ ok: boolean; initPoint?: string; erro?: string }> {
  try {
    const resposta = await fetch(`${SERVIDOR_URL}/pagamentos/checkout-pro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pedido, meio }),
    });
    const dados = (await resposta.json()) as { initPoint?: string; erro?: string };
    if (!resposta.ok || !dados.initPoint) return { ok: false, erro: dados.erro ?? "Falha ao iniciar o pagamento." };
    return { ok: true, initPoint: dados.initPoint };
  } catch {
    return { ok: false, erro: "Sem conexão com o servidor de pagamento." };
  }
}

/** Consulta o status de um pagamento (para a confirmação virar "aprovado" sozinha). */
export async function statusPagamento(paymentId: number | string): Promise<string | null> {
  try {
    const resposta = await fetch(`${SERVIDOR_URL}/pagamentos/status/${paymentId}`);
    const dados = (await resposta.json()) as { status?: string };
    return resposta.ok ? (dados.status ?? null) : null;
  } catch {
    return null;
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
