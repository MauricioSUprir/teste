// GIDEON HOME — voz contínua no navegador (Gemini Live). O servidor só entrega a senha temporária,
// executa as ferramentas e guarda a conversa; o áudio vai direto do navegador para o Google.
import { agoraBrasilia, chaveGemini, config, executar, FERRAMENTAS, guardarMemoria, PROMPT, sb, segredoCron } from "./core.ts";
import { FERRAMENTAS_GOOGLE } from "./google.ts";
import { FERRAMENTAS_WHATS } from "./whatsapp.ts";

export const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, x-gideon-home", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json", ...CORS } });

async function hmac(chave: string, msg: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(chave), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
  return [...new Uint8Array(s)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
// Chave de acesso do Home: validade + assinatura (só o GIDEON sabe gerar). Entregue ao dono pelo Telegram (/home).
export async function tokenHome(dias = 30) {
  const exp = String(Date.now() + dias * 86400_000);
  return `${exp}.${(await hmac(await segredoCron(), "home:" + exp)).slice(0, 40)}`;
}
async function validarHome(req: Request) {
  const [exp, sig] = (req.headers.get("x-gideon-home") ?? "").split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return sig === (await hmac(await segredoCron(), "home:" + exp)).slice(0, 40);
}

const VOZ = `

Você está no GIDEON HOME, conversando por VOZ em tempo real com o dono.
- Fale como numa conversa: frases curtas e naturais, em português do Brasil, sem listas, sem markdown, sem emojis e sem ler links em voz alta (diga "mandei o link no Telegram" só se tiver mandado).
- Se ele te interromper, pare e escute.
- Para confirmar ações (criar evento, enviar mensagem), repita em voz alta o que vai fazer e espere ele dizer "sim".
- Use buscar_memoria quando ele perguntar sobre algo do passado que você não sabe.`;

export async function rotaHome(rota: string, req: Request) {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (!(await validarHome(req))) return json({ erro: "acesso negado: peça um link novo ao GIDEON no Telegram com /home" }, 401);
  const cfg = await config();
  const modelo = cfg.modelo_voz || "gemini-3.8-live";

  if (rota === "home-sessao") {
    const agora = Date.now();
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens", {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": chaveGemini() },
      body: JSON.stringify({ uses: 1, expireTime: new Date(agora + 30 * 60_000).toISOString(), newSessionExpireTime: new Date(agora + 2 * 60_000).toISOString(),
        bidiGenerateContentSetup: { model: `models/${modelo}` } }),
    });
    const t = await r.json();
    if (!r.ok || !t.name) return json({ erro: "Google recusou a senha temporária: " + JSON.stringify(t).slice(0, 200) }, 502);
    const { data: hist } = await sb.from("gideon_mensagens").select("papel, texto").eq("sessao", "voz").order("criado_em", { ascending: false }).limit(6);
    const recentes = (hist ?? []).reverse().map((m) => `${m.papel === "user" ? "Dono" : "GIDEON"}: ${m.texto}`).join("\n");
    const sistema = PROMPT + VOZ + `\n\nData e hora atuais: ${agoraBrasilia()} (horário de Brasília).` + (recentes ? `\n\nÚltimas falas por voz (contexto):\n${recentes}` : "");
    return json({
      token: t.name, modelo, voz: cfg.voz_gideon || "Charon", sistema,
      url: "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained",
      ferramentas: [...FERRAMENTAS, ...FERRAMENTAS_GOOGLE, ...FERRAMENTAS_WHATS],
    });
  }
  if (rota === "home-ferramenta") {
    const b = await req.json();
    const resultado = await executar(String(b.nome), b.args ?? {}, "voz").catch((e) => ({ erro: String((e as Error).message ?? e) }));
    return json({ resultado });
  }
  if (rota === "home-conversa") {
    const b = await req.json();
    const pedido = String(b.pedido ?? "").trim().slice(0, 4000), resposta = String(b.resposta ?? "").trim().slice(0, 4000);
    if (!pedido && !resposta) return json({ ok: true });
    await sb.from("gideon_mensagens").insert([{ sessao: "voz", papel: "user", texto: pedido || "(silêncio)", canal: "voz" }, { sessao: "voz", papel: "model", texto: resposta || "(sem resposta)", canal: "voz" }]);
    await sb.from("gideon_execucoes").insert({ canal: "voz", pedido_resumo: pedido.slice(0, 200), ferramenta: (b.ferramentas ?? []).join(",") || "conversa",
      modelo, tempo_ms: Number(b.tempo_ms) || null, status: "sucesso", workflow: "supabase:gideon/home" });
    if (pedido && resposta) await guardarMemoria({ conteudo: `Dono (voz): ${pedido}\nGIDEON: ${resposta}`, resumo: pedido.slice(0, 200), tipo: "conversa", origem: "voz" }).catch(() => 0);
    return json({ ok: true });
  }
  return json({ erro: "rota desconhecida" }, 404);
}
