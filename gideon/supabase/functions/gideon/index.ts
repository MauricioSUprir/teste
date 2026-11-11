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
//   POST /gideon/nucleo-arquivo  ← teste de leitura de arquivo: { base64, mime, nome, legenda } (x-gideon-chave)
//   POST /gideon/aprovacao | modelos | modelo-teste ← fila de aprovações; lista de modelos; testa se modelos respondem { modelos: [...] } (x-gideon-chave)
//   POST /gideon/pesquisa-teste  ← testa a busca na internet sem passar pelo modelo { pergunta, cache?, modelos?, modo? (google|tavily|livre) } ou { url } (x-gideon-chave)
//   POST /gideon/pc-buscar | pc-resultado ← programa GIDEON PC busca ordens e devolve resultados (cabeçalho x-gideon-pc)
//   POST /gideon/celular         ← atalho GIDEON do iPhone: { texto } → { fala, abrir } (cabeçalho x-gideon-celular)
//   POST /gideon/pc-teste        ← testa uma ferramenta do PC sem passar pelo modelo { nome, args } (x-gideon-chave)
//   POST /gideon/memoria-claude  ← o que o dono combinou com o Claude vira nota na memória { notas: [{ titulo, texto }], substituir? } (x-gideon-chave)
//   POST /gideon/equipe-passo    ← equipe de agentes: roda a próxima tarefa ou fecha a missão { esperar? } (x-gideon-chave; o agendador chama a cada minuto se há missão andando)
//   POST /gideon/indexar         ← pg_cron: Gmail, Agenda e Drive viram memória { fontes?, esperar? } (x-gideon-chave)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { atender, chaveGemini, config, dispararLembretes, executar, gerar, guardarMemoria, relatorioSemanal, responderTelegram, sb, segredoCron, sha256, telegram, tokenTelegram } from "./core.ts";
import { linkConectar, retorno } from "./google.ts";
import { configurarWhatsapp, receberWhatsapp } from "./whatsapp.ts";
import { rotaHome, tokenHome } from "./home.ts";
import { arquivoDaMensagem, atenderArquivo, receberArquivoTelegram } from "./arquivos.ts";
import { resolverAprovacao, tratarBotao } from "./botoes.ts";
import { indexar } from "./indexador.ts";
import { lerPagina, pesquisarWeb } from "./pesquisa.ts";
import { responderPrivado, rotaPC, tokenPC } from "./pc.ts";
import { rotaCelular, tokenCelular } from "./celular.ts";
import { equipePasso, textoPainel } from "./equipe.ts";

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
      if (upd.callback_query) { // toque num botão (👍/👎, Aprovar/Negar): só do dono
        if (String(upd.callback_query.from?.id) === cfg.dono_telegram_id) EdgeRuntime.waitUntil(tratarBotao(upd.callback_query).catch((e) => console.error("botão:", e)));
        return json({ ok: true });
      }
      if (!m || String(m.from?.id) !== cfg.dono_telegram_id) return json({ ok: true }); // só o dono
      const arquivo = arquivoDaMensagem(m);
      if (arquivo) { EdgeRuntime.waitUntil(receberArquivoTelegram(m, arquivo).catch((e) => console.error("arquivo:", e))); return json({ ok: true }); } // foto, PDF, áudio...
      const texto = m.text || "[O dono enviou algo que não é texto nem arquivo (figurinha, localização ou contato). Diga que ainda não consegue ler esse tipo de mensagem.]";
      if (/^\/home\b/i.test(texto.trim())) { // link pessoal do GIDEON Home (vale 30 dias)
        const link = cfg.home_url ? `${cfg.home_url}#t=${await tokenHome()}` : "";
        EdgeRuntime.waitUntil(telegram("sendMessage", { chat_id: m.chat.id, text: link ? `🎙️ Seu GIDEON Home (link pessoal, vale 30 dias — não compartilhe):\n${link}` : "O GIDEON Home ainda não foi publicado." }).catch(() => {}));
        return json({ ok: true });
      }
      if (/^\/pc\b/i.test(texto.trim())) { // chave do programa GIDEON PC (vale 1 ano)
        const chave = await tokenPC();
        EdgeRuntime.waitUntil(telegram("sendMessage", { chat_id: m.chat.id, text: `💻 Chave do GIDEON PC (vale 1 ano — não compartilhe). Cole quando o programa pedir:\n\n${chave}` }).catch(() => {}));
        return json({ ok: true });
      }
      if (/^\/celular\b/i.test(texto.trim())) { // chave do atalho GIDEON no iPhone (vale 1 ano)
        const chave = await tokenCelular();
        const guia = cfg.home_url ? `${cfg.home_url.replace(/\/+$/, "")}/celular.html` : "";
        EdgeRuntime.waitUntil((async () => {
          await telegram("sendMessage", { chat_id: m.chat.id, text: `📱 GIDEON no iPhone${guia ? `\nPasso a passo: ${guia}` : ""}\n\nNa próxima mensagem vai a chave do celular (vale 1 ano — não compartilhe). Copie e cole no atalho, no campo x-gideon-celular.` });
          await telegram("sendMessage", { chat_id: m.chat.id, text: chave });
        })().catch(() => {}));
        return json({ ok: true });
      }
      if (/^\/equipe\b/i.test(texto.trim())) { // painel da equipe de agentes: o que cada um está fazendo
        EdgeRuntime.waitUntil((async () => {
          const { data: ms } = await sb.from("gideon_equipe_missoes").select("*").neq("canal", "sistema").order("id", { ascending: false }).limit(3);
          const ativas = (ms ?? []).filter((x) => ["aguardando_ok", "executando", "revisando"].includes(x.status));
          const mostrar = ativas.length ? ativas : (ms ?? []).slice(0, 1);
          if (!mostrar.length) { await telegram("sendMessage", { chat_id: m.chat.id, text: "👥 A equipe ainda não fez nenhum trabalho. Peça algo grande, por exemplo: \"chama a equipe para comparar 3 notebooks até 4 mil reais e me recomendar um\"." }); return; }
          for (const x of mostrar.reverse()) {
            const { data: t } = await sb.from("gideon_equipe_tarefas").select("ordem, agente, titulo, status").eq("missao_id", x.id).order("ordem");
            await telegram("sendMessage", { chat_id: m.chat.id, text: textoPainel(x, t ?? []) + (cfg.home_url ? `\n\nPainel: ${cfg.home_url.replace(/\/+$/, "")}/equipe.html` : "") });
          }
        })().catch((e) => console.error("/equipe:", e)));
        return json({ ok: true });
      }
      const privado = texto.trim().match(/^\/?privad[oa]\b[\s:,.-]*/i);
      if (privado) { // "privado: ..." vai direto para a IA do PC do dono: não passa pelo Google nem fica guardado
        EdgeRuntime.waitUntil(responderPrivado(m.chat.id, texto.trim().slice(privado[0].length).trim()).catch((e) => console.error("privado:", e)));
        return json({ ok: true });
      }
      const trabalho = (async () => {
        await telegram("sendChatAction", { chat_id: m.chat.id, action: "typing" }).catch(() => {});
        const r = await atender({ texto, canal: "telegram", sessao: String(m.chat.id) });
        await responderTelegram(m.chat.id, r); // com botões 👍/👎 ou Aprovar/Negar
        await r.posResposta;
      })().catch((e) => console.error("telegram:", e));
      EdgeRuntime.waitUntil(trabalho);
      return json({ ok: true }); // responde já, para o Telegram não reenviar
    }
    if (rota === "retorno") return await retorno(req); // o Google volta aqui (protegido pelo state assinado)
    if (rota === "whatsapp") return await receberWhatsapp(req); // WAHA (protegido pelo cabeçalho secreto)
    if (rota?.startsWith("home-")) return await rotaHome(rota, req); // GIDEON Home (protegido pela chave do Home)
    if (rota === "pc-buscar" || rota === "pc-resultado") return await rotaPC(rota, req); // programa GIDEON PC (protegido pela chave do PC)
    if (rota === "celular") return await rotaCelular(req); // atalho do iPhone (protegido pela chave do celular)
    if (!(await autorizado(req))) return json({ erro: "não autorizado" }, 401);
    if (rota === "conectar") return json(await linkConectar());
    if (rota === "configurar-whatsapp") { const b = await req.json().catch(() => ({})); return json(await configurarWhatsapp(b.numero)); }
    if (rota === "nucleo") {
      const b = await req.json();
      const r = await atender({ texto: String(b.texto ?? ""), canal: String(b.canal ?? "sistema"), sessao: String(b.sessao ?? "teste"), guardar: b.guardar !== false });
      await r.posResposta;
      const { posResposta: _p, ...resto } = r;
      return json(resto);
    }
    if (rota === "nucleo-arquivo") { // teste da leitura de arquivos sem passar pelo Telegram (não grava na memória)
      const b = await req.json();
      const bytes = Uint8Array.from(atob(String(b.base64 ?? "")), (c) => c.charCodeAt(0));
      const r = await atenderArquivo({ bytes, mime: String(b.mime ?? ""), nome: String(b.nome ?? "arquivo"), legenda: b.legenda, canal: "sistema", sessao: String(b.sessao ?? "teste-arquivos"), guardar: false });
      await r.posResposta;
      const { posResposta: _p, ...resto } = r as Record<string, unknown>;
      return json(resto);
    }
    if (rota === "aprovacao") { const b = await req.json(); return json(await resolverAprovacao(Number(b.id), b.aprovar === true, "teste")); } // teste da fila de aprovações
    if (rota === "modelos") { // modelos do Gemini disponíveis para esta chave (para escolher o reserva)
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": chaveGemini() } });
      const j = await r.json();
      return json((j.models ?? []).filter((x: any) => (x.supportedGenerationMethods ?? []).includes("generateContent")).map((x: any) => x.name));
    }
    if (rota === "modelo-teste") { // testa se cada modelo responde com esta chave (1 pedido pequeno por modelo)
      const b = await req.json().catch(() => ({}));
      const saida: Record<string, string> = {};
      for (const m of (Array.isArray(b.modelos) ? b.modelos : []).map(String).slice(0, 10)) {
        const t0 = Date.now();
        saida[m] = await gerar({ contents: [{ role: "user", parts: [{ text: "Responda só: ok" }] }] }, [m])
          .then(() => `ok ${Date.now() - t0} ms`).catch((e) => String((e as Error).message ?? e).slice(0, 160));
      }
      return json(saida);
    }
    if (rota === "pesquisa-teste") { // teste direto da busca: { pergunta, cache? } ou { url }
      const b = await req.json().catch(() => ({}));
      const r = await (b.url ? lerPagina(String(b.url)) : pesquisarWeb(String(b.pergunta ?? ""), b.cache === true, { modelos: Array.isArray(b.modelos) ? b.modelos.map(String) : undefined, modo: b.modo ? String(b.modo) : undefined })).catch((e) => ({ erro: String((e as Error).message ?? e).slice(0, 1500) }));
      return json(r);
    }
    if (rota === "equipe-passo") { // um passo da equipe; responde já e trabalha em segundo plano (esperar=true só nos testes)
      const b = await req.json().catch(() => ({}));
      if (b.esperar) return json(await equipePasso());
      EdgeRuntime.waitUntil(equipePasso().catch((e) => console.error("equipe:", e)));
      return json({ ok: true });
    }
    if (rota === "pc-teste" || rota === "ferramenta-teste") { // teste direto das ferramentas do PC: { nome, args }
      const b = await req.json().catch(() => ({}));
      return json(await executar(String(b.nome), b.args ?? {}, "sistema").catch((e) => ({ erro: String((e as Error).message ?? e) })));
    }
    if (rota === "memoria-claude") { // resumo do que o dono combinou com o Claude (quem constrói o GIDEON); mesmo título = substitui a nota antiga
      const b = await req.json().catch(() => ({}));
      const notas = (Array.isArray(b.notas) ? b.notas : [b]).map((n: Record<string, unknown>) => ({ titulo: String(n.titulo ?? "").trim().slice(0, 200), texto: String(n.texto ?? "").trim() }))
        .filter((n: { texto: string }) => n.texto);
      let trechos = 0;
      for (const n of notas) {
        if (b.substituir !== false && n.titulo) await sb.from("gideon_memoria").delete().eq("origem", "claude").eq("resumo", n.titulo);
        trechos += await guardarMemoria({ conteudo: `Combinado com o Claude (quem constrói o GIDEON)${n.titulo ? " — " + n.titulo : ""}:\n${n.texto}`, resumo: n.titulo || n.texto.slice(0, 200),
          tipo: "nota", origem: "claude", projeto: "GIDEON", metadados: { fonte: "conversa com o Claude" } });
      }
      return json({ ok: true, notas: notas.length, trechos });
    }
    if (rota === "indexar") { // pg_cron: lê Gmail, Agenda e Drive e guarda na memória ({ fontes, esperar })
      const b = await req.json().catch(() => ({}));
      const fontes: string[] = Array.isArray(b.fontes) && b.fontes.length ? b.fontes.map(String) : ["gmail", "agenda", "drive"];
      if (b.esperar) return json(await indexar(fontes));
      EdgeRuntime.waitUntil(indexar(fontes).catch((e) => console.error("indexar:", e)));
      return json({ ok: true, fontes });
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
