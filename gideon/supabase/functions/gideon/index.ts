// GIDEON — porta de entrada única no Supabase. Rotas:
//   POST /gideon/telegram   ← Telegram (confere o segredo do webhook)
//   POST /gideon/nucleo     ← outros canais e testes (x-gideon-chave)
//   POST /gideon/lembretes  ← pg_cron, a cada minuto (x-gideon-chave)
//   POST /gideon/relatorio  ← pg_cron, domingo 19h (x-gideon-chave)
//   POST /gideon/registrar  ← liga o Telegram nesta função (x-gideon-chave)
//   POST /gideon/status     ← situação do webhook do Telegram (x-gideon-chave)
//   POST /gideon/google/conectar ← manda ao dono o link de autorização do Google (x-gideon-chave)
//   GET  /gideon/google/retorno  ← o Google volta aqui depois da autorização
//   POST /gideon/whatsapp        ← WAHA entrega mensagens (cabeçalho x-gideon-whatsapp)
//   POST /gideon/configurar-whatsapp ← cria a sessão no WAHA e gera o código de pareamento (x-gideon-chave)
//   POST /gideon/home-sessao|home-ferramenta|home-conversa ← GIDEON Home (cabeçalho x-gideon-home)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { atender, config, dispararLembretes, relatorioSemanal, segredoCron, sha256, telegram, tokenTelegram } from "./core.ts";
import { linkConectar, retorno } from "./google.ts";
import { configurarWhatsapp, receberWhatsapp } from "./whatsapp.ts";
import { rotaHome, tokenHome } from "./home.ts";

const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
const segredoWebhook = async () => (await sha256(tokenTelegram() + ":gideon-webhook")).slice(0, 64);
async function autorizado(req: Request) {
  const h = req.headers.get("x-gideon-chave") ?? "";
  return h.length > 0 && h === await segredoCron();
}

Deno.serve(async (req) => {
  const rota = new URL(req.url).pathname.split("/").filter(Boolean).pop();
  try {
    if (rota === "telegram") {
      if (req.headers.get("x-telegram-bot-api-secret-token") !== await segredoWebhook()) return json({ ok: false }, 401);
      const upd = await req.json();
      const m = upd.message;
      const cfg = await config();
      if (!m || String(m.from?.id) !== cfg.dono_telegram_id) return json({ ok: true }); // só o dono
      const texto = m.text || m.caption || "[O dono enviou algo sem texto (foto, áudio ou arquivo). Diga que ainda não consegue ler esse tipo de mensagem.]";
      if (/^\/home\b/i.test(texto.trim())) { // link pessoal do GIDEON Home (vale 30 dias)
        const link = cfg.home_url ? `${cfg.home_url}#t=${await tokenHome()}` : "";
        EdgeRuntime.waitUntil(telegram("sendMessage", { chat_id: m.chat.id, text: link ? `🎙️ Seu GIDEON Home (link pessoal, vale 30 dias — não compartilhe):\n${link}` : "O GIDEON Home ainda não foi publicado." }).catch(() => {}));
        return json({ ok: true });
      }
      const trabalho = (async () => {
        await telegram("sendChatAction", { chat_id: m.chat.id, action: "typing" }).catch(() => {});
        const r = await atender({ texto, canal: "telegram", sessao: String(m.chat.id) });
        await telegram("sendMessage", { chat_id: m.chat.id, text: r.resposta.slice(0, 4000) || "…" });
        await r.posResposta;
      })().catch((e) => console.error("telegram:", e));
      EdgeRuntime.waitUntil(trabalho);
      return json({ ok: true }); // responde já, para o Telegram não reenviar
    }
    if (rota === "retorno") return await retorno(req); // o Google volta aqui (protegido pelo state assinado)
    if (rota === "whatsapp") return await receberWhatsapp(req); // WAHA (protegido pelo cabeçalho secreto)
    if (rota?.startsWith("home-")) return await rotaHome(rota, req); // GIDEON Home (protegido pela chave do Home)
    if (!(await autorizado(req))) return json({ erro: "não autorizado" }, 401);
    if (rota === "conectar") return json(await linkConectar());
    if (rota === "configurar-whatsapp") { const b = await req.json().catch(() => ({})); return json(await configurarWhatsapp(b.numero)); }
    if (rota === "nucleo") {
      const b = await req.json();
      const r = await atender({ texto: String(b.texto ?? ""), canal: String(b.canal ?? "sistema"), sessao: String(b.sessao ?? "teste") });
      await r.posResposta;
      const { posResposta: _p, ...resto } = r;
      return json(resto);
    }
    if (rota === "lembretes") return json(await dispararLembretes());
    if (rota === "relatorio") {
      const b = await req.json().catch(() => ({}));
      return json(await relatorioSemanal(b.enviar !== false));
    }
    if (rota === "registrar") {
      const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/gideon/telegram`;
      const r = await telegram("setWebhook", { url, secret_token: await segredoWebhook(), allowed_updates: ["message", "callback_query"], drop_pending_updates: false });
      return json({ registrado: r, url });
    }
    if (rota === "status") return json(await telegram("getWebhookInfo", {}));
    return json({ erro: "rota desconhecida" }, 404);
  } catch (e) {
    console.error(rota, e);
    return json({ erro: String((e as Error).message ?? e).slice(0, 300) }, 500);
  }
});
