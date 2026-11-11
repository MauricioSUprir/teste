// GIDEON — botões do Telegram: 👍/👎 (a resposta ajudou?) e ✅ Aprovar / ❌ Negar (ações que pedem OK do dono).
import { executar, sb, telegram } from "./core.ts";
import { cancelarMissao } from "./equipe.ts";
import { recusarMelhoria } from "./testes.ts";

// Aprovar ou negar um pedido da fila (gideon_aprovacoes). Só executa uma vez, mesmo com dois toques.
export async function resolverAprovacao(id: number, aprovar: boolean, via: string) {
  const { data: ap } = await sb.from("gideon_aprovacoes").select("id, acao, descricao, detalhes, status, expira_em").eq("id", id).maybeSingle();
  if (!ap) return { texto: "Não achei esse pedido." };
  if (ap.status !== "pendente") return { texto: `Esse pedido já foi ${ap.status === "aprovada" ? "aprovado" : ap.status === "negada" ? "negado" : "encerrado"}.` };
  if (ap.expira_em && new Date(ap.expira_em) < new Date()) {
    await sb.from("gideon_aprovacoes").update({ status: "expirada", decidido_em: new Date().toISOString(), decidido_via: via }).eq("id", id).eq("status", "pendente");
    return { texto: "Esse pedido expirou (vale por 2 horas). Se ainda quiser, me peça de novo." };
  }
  const { data: pego } = await sb.from("gideon_aprovacoes").update({ status: aprovar ? "aprovada" : "negada", decidido_em: new Date().toISOString(), decidido_via: via })
    .eq("id", id).eq("status", "pendente").select("id"); // só um toque ganha
  if (!pego?.length) return { texto: "Esse pedido já foi resolvido." };
  if (!aprovar) {
    const det = (ap.detalhes ?? {}) as { args?: Record<string, unknown> };
    if (ap.acao === "equipe_iniciar" && det.args?.missao_id) await cancelarMissao(Number(det.args.missao_id), via).catch(() => {}); // plano negado: a missão não fica esperando
    if (ap.acao === "melhoria_ativar" && det.args?.melhoria_id) await recusarMelhoria(Number(det.args.melhoria_id), via).catch(() => {});
    return { texto: `❌ Cancelado: ${ap.descricao}` };
  }
  const d = (ap.detalhes ?? {}) as { nome?: string; args?: Record<string, unknown>; canal?: string };
  const res = await executar(String(d.nome), { ...(d.args ?? {}), confirmado: true }, String(d.canal ?? "telegram"))
    .catch((e) => ({ erro: String((e as Error).message ?? e) })) as Record<string, unknown>;
  if (res?.erro) return { texto: `⚠️ Aprovado, mas não consegui fazer: ${res.erro}`, resultado: res };
  return { texto: `✅ Feito: ${ap.descricao}${res?.link ? "\n" + res.link : ""}`, resultado: res };
}

// Toque num botão (callback_query do Telegram). Responde ao toque na hora e depois faz o trabalho.
export async function tratarBotao(q: any) {
  const [tipo, idTexto] = String(q.data ?? "").split(":");
  const id = Number(idTexto), chat = q.message?.chat?.id, mensagem = q.message?.message_id;
  const tirarBotoes = (linhas: unknown[] = []) =>
    telegram("editMessageReplyMarkup", { chat_id: chat, message_id: mensagem, reply_markup: { inline_keyboard: linhas } }).catch(() => {});

  if (tipo === "u" || tipo === "n") {
    const util = tipo === "u";
    await telegram("answerCallbackQuery", { callback_query_id: q.id, text: util ? "Obrigada! 💙" : "Anotei. Vou melhorar." }).catch(() => {});
    await sb.from("gideon_execucoes").update({ nota_usuario: util ? "util" : "nao_util" }).eq("id", id);
    await tirarBotoes([[{ text: util ? "👍 Útil" : "👎 Não ajudou", callback_data: "ok" }]]);
    if (!util) await telegram("sendMessage", { chat_id: chat, text: "Anotei que essa resposta não ajudou. Se quiser, me diga o que faltou que eu corrijo." }).catch(() => {});
    return;
  }
  if (tipo === "c") { // ⛔ Cancelar na mensagem de andamento da equipe
    const r = await cancelarMissao(id, "telegram:botao");
    await telegram("answerCallbackQuery", { callback_query_id: q.id, text: (r as { erro?: string }).erro ? "Essa missão já tinha parado" : "Equipe cancelada" }).catch(() => {});
    return;
  }
  if (tipo === "a" || tipo === "x") {
    const aprovar = tipo === "a";
    await telegram("answerCallbackQuery", { callback_query_id: q.id, text: aprovar ? "Aprovado — fazendo…" : "Negado" }).catch(() => {});
    const r = await resolverAprovacao(id, aprovar, "telegram:botao");
    await tirarBotoes();
    await telegram("sendMessage", { chat_id: chat, text: r.texto, ...(mensagem ? { reply_to_message_id: mensagem } : {}) }).catch(() => {});
    return;
  }
  await telegram("answerCallbackQuery", { callback_query_id: q.id }).catch(() => {});
}
