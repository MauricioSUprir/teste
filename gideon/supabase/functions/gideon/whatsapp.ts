// GIDEON — WhatsApp via WAHA (Render). Duas funções:
//  1) conversar com o GIDEON (o dono manda mensagem para si mesmo, ou do número dele para o número do GIDEON)
//  2) o GIDEON enviar mensagens em nome do dono, sempre com confirmação
import { atender, config, sb, segredoCron, sha256 } from "./core.ts";

const WAHA = () => (Deno.env.get("WAHA_URL") ?? "https://jarvis-waha.onrender.com").trim().replace(/\/$/, "");
const chaveWaha = () => (Deno.env.get("WAHA_API_KEY") ?? "").trim();
const SESSAO = "default";
const PREFIXO = "🤖";
const digitos = (s: unknown) => String(s ?? "").split("@")[0].replace(/\D/g, "");
export const segredoWebhookWhats = async () => (await sha256((await segredoCron()) + ":gideon-whatsapp")).slice(0, 48);

async function waha(caminho: string, init: RequestInit = {}) {
  if (!chaveWaha()) throw new Error("WAHA_API_KEY não cadastrada no Supabase");
  const r = await fetch(WAHA() + caminho, { ...init, headers: { "Content-Type": "application/json", "X-Api-Key": chaveWaha(), ...(init.headers ?? {}) } });
  const txt = await r.text();
  let j: any = {}; try { j = txt ? JSON.parse(txt) : {}; } catch { j = { texto: txt }; }
  if (!r.ok) throw Object.assign(new Error(`WAHA ${r.status}: ${txt.slice(0, 200)}`), { status: r.status });
  return j;
}
export async function enviarWhats(chatId: string, texto: string) {
  if (!texto.trim()) return; // nunca enviar mensagem vazia
  return waha("/api/sendText", { method: "POST", body: JSON.stringify({ session: SESSAO, chatId, text: texto.slice(0, 4000) }) });
}

// Cria/atualiza a sessão com o webhook do GIDEON e, se pedir número, gera o código de pareamento
export async function configurarWhatsapp(numero?: string) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/gideon/whatsapp`;
  const conf = { webhooks: [{ url, events: ["message.any"], customHeaders: [{ name: "x-gideon-whatsapp", value: await segredoWebhookWhats() }] }] };
  try { await waha("/api/sessions", { method: "POST", body: JSON.stringify({ name: SESSAO, start: true, config: conf }) }); }
  catch (e) {
    if (![409, 422].includes((e as any).status)) throw e;
    await waha(`/api/sessions/${SESSAO}`, { method: "PUT", body: JSON.stringify({ config: conf }) });
    await waha(`/api/sessions/${SESSAO}/start`, { method: "POST" }).catch(() => {});
  }
  for (let i = 0; i < 10; i++) { // espera a sessão sair de STARTING
    const s = await waha(`/api/sessions/${SESSAO}`);
    if (s.status !== "STARTING") {
      if (s.status === "SCAN_QR_CODE" && numero) {
        const c = await waha(`/api/${SESSAO}/auth/request-code`, { method: "POST", body: JSON.stringify({ phoneNumber: digitos(numero) }) });
        return { status: s.status, codigo: c.code ?? c };
      }
      return { status: s.status, numero: s.me?.id ?? null };
    }
    await new Promise((ok) => setTimeout(ok, 2000));
  }
  return { status: "STARTING" };
}

// Webhook do WAHA: só atende o dono; ignora as próprias respostas (começam com 🤖) e mensagens de outras pessoas
export async function receberWhatsapp(req: Request) {
  if (req.headers.get("x-gideon-whatsapp") !== (await segredoWebhookWhats())) return new Response("nao autorizado", { status: 401 });
  const ev = await req.json();
  const m = ev.payload ?? {};
  const corpo = String(m.body ?? "").trim();
  if (!["message", "message.any"].includes(ev.event) || !corpo || corpo.startsWith(PREFIXO)) return new Response("ok");
  const eu = digitos(ev.me?.id);
  const cfg = await config();
  const paraSiMesmo = m.fromMe && eu && digitos(m.to) === eu;                         // dono escreveu no chat "você mesmo"
  const doNumeroDoDono = !m.fromMe && cfg.whatsapp_dono && digitos(m.from) === cfg.whatsapp_dono; // dono escreveu para o número do GIDEON
  if (!paraSiMesmo && !doNumeroDoDono) return new Response("ok");
  const chat = paraSiMesmo ? m.to : m.from;
  const trabalho = (async () => {
    const r = await atender({ texto: corpo, canal: "whatsapp", sessao: "wa:" + digitos(chat) });
    await enviarWhats(chat, `${PREFIXO} ${r.resposta}`);
    await r.posResposta;
  })().catch((e) => console.error("whatsapp:", e));
  EdgeRuntime.waitUntil(trabalho);
  return new Response("ok");
}

// Ferramenta do agente: enviar mensagem em nome do dono (sempre com confirmação)
export const FERRAMENTAS_WHATS = [
  { name: "whatsapp_enviar", description: "Envia uma mensagem de WhatsApp em nome do dono. Primeiro chame com confirmado=false para mostrar para quem e o texto; só envie (confirmado=true) depois de um 'sim' explícito.", parameters: { type: "object", properties: {
      numero: { type: "string", description: "Número com DDI e DDD, só dígitos, ex.: 5511999998888" },
      texto: { type: "string" }, confirmado: { type: "boolean" } }, required: ["numero", "texto", "confirmado"] } },
];
export async function executarWhats(nome: string, a: Record<string, any>): Promise<unknown> {
  if (nome !== "whatsapp_enviar") return { erro: "ferramenta desconhecida" };
  const num = digitos(a.numero);
  if (num.length < 12) return { erro: "Número incompleto: use DDI + DDD + número, ex.: 5511999998888." };
  const resumo = { para: "+" + num, texto: String(a.texto) };
  if (a.confirmado !== true) return { precisa_confirmacao: true, resumo, instrucao: "Mostre para quem e o texto, e pergunte se pode enviar." };
  const r = await enviarWhats(`${num}@c.us`, String(a.texto));
  await sb.from("gideon_acoes").insert({ quem: "gideon/nucleo", acao: "whatsapp_enviar", alvo: "+" + num, detalhes: resumo, reversivel: false });
  return { enviado: true, id: r?.id ?? null, resumo };
}
