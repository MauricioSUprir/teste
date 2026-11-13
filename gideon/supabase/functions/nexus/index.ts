// GIDEON — Nexus OS (fase 6, decisão 019): o servidor da área de trabalho no navegador (home/nexus.html).
// Função separada e pequena, para não mexer na função "gideon", que já funciona. Entra com a mesma chave do GIDEON Home
// (link /home do Telegram, vale 30 dias). Rotas (POST, cabeçalho x-gideon-home):
//   painel     ← central de notificações: aprovações pendentes, lembretes, tarefas, avisos, erros, PC, equipe, testes
//   conversa   ← { texto } fala com a GIDEON pelo núcleo de verdade (canal home, sessão nexus)
//   historico  ← últimas mensagens da conversa do Nexus
//   aprovar    ← { id, aprovar } aprova ou nega um pedido da fila; quem executa é a função gideon; o dono recebe um aviso no Telegram
//   automacoes ← agendador (pg_cron), baterias de testes, melhorias e missões da equipe
//   memoria    ← últimos itens que entraram na memória
//   comando    ← números reais do centro de comando do GIDEON Core (modelos, automações, documentos, projetos, PC, hoje)
// Arquivos e terminal do PC, Drive, tarefas e busca na memória: o navegador chama direto a rota home-ferramenta da função gideon.
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_SB = Deno.env.get("SUPABASE_URL")!;
const CHAVE_SB = (() => {
  try { return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}")["default"]; } catch { return undefined; }
})() ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(URL_SB, CHAVE_SB, { auth: { persistSession: false } });
const GIDEON = `${URL_SB}/functions/v1/gideon/`;

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, x-gideon-home", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json; charset=utf-8", ...CORS } });
const agora = () => new Date().toISOString();

let cacheSegredo: string | null = null;
async function segredo() {
  if (cacheSegredo) return cacheSegredo;
  const { data, error } = await sb.rpc("gideon_segredo", { nome: "gideon_cron_segredo" });
  if (error || !data) throw new Error("segredo indisponível");
  cacheSegredo = String(data);
  return cacheSegredo;
}
async function hmac(chave: string, msg: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(chave), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
  return [...new Uint8Array(s)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
// A mesma conta da chave do GIDEON Home (home.ts): validade + assinatura
async function validar(req: Request) {
  const [exp, sig] = (req.headers.get("x-gideon-home") ?? "").split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return sig === (await hmac(await segredo(), "home:" + exp)).slice(0, 40);
}
async function chamarGideon(rota: string, corpo: unknown) {
  const r = await fetch(GIDEON + rota, { method: "POST", headers: { "Content-Type": "application/json", "x-gideon-chave": await segredo() }, body: JSON.stringify(corpo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(String(j.erro ?? `a função gideon respondeu ${r.status}`));
  return j;
}
async function avisarDono(texto: string) { // o que é decidido pelo Nexus também aparece no Telegram (o dono vê se alguém mais usou a chave)
  const token = (Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "").trim();
  const { data } = await sb.from("gideon_config").select("valor").eq("chave", "dono_telegram_id").maybeSingle();
  if (!token || !data?.valor || !texto.trim()) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: data.valor, text: texto.slice(0, 4000) }) }).then((r) => r.body?.cancel()).catch(() => {});
}

// ---------- central de notificações ----------
async function painel() {
  const desde24h = new Date(Date.now() - 86400_000).toISOString();
  const [aps, lems, tars, avisos, erros, nErros, pc, missoes, rodada, melhorias] = await Promise.all([
    sb.from("gideon_aprovacoes").select("id, acao, descricao, pedido_por, criado_em, expira_em").eq("status", "pendente").order("criado_em", { ascending: false }).limit(30),
    sb.from("gideon_lembretes").select("id, texto, quando, recorrencia").eq("ativo", true).is("enviado_em", null).order("quando").limit(30),
    sb.from("gideon_tarefas").select("id, titulo, descricao, prazo, projeto, criado_em").eq("status", "aberta").order("prazo", { nullsFirst: false }).limit(40),
    sb.from("gideon_mensagens").select("id, texto, criado_em").eq("sessao", "telegram-avisos").order("criado_em", { ascending: false }).limit(15),
    sb.from("gideon_execucoes").select("id, canal, pedido_resumo, ferramenta, erro_mensagem, data_hora").eq("status", "erro").neq("canal", "teste").gt("data_hora", desde24h).order("data_hora", { ascending: false }).limit(8),
    sb.from("gideon_execucoes").select("id", { count: "exact", head: true }).eq("status", "erro").neq("canal", "teste").gt("data_hora", desde24h),
    sb.from("gideon_dispositivos").select("visto_em, info").eq("nome", "pc").maybeSingle(),
    sb.from("gideon_equipe_missoes").select("id, titulo, status").neq("canal", "sistema").in("status", ["aguardando_ok", "executando", "revisando"]).order("id", { ascending: false }).limit(5),
    sb.from("gideon_testes_rodadas").select("id, status, nota, passou, total, concluido_em").eq("motivo", "semanal").order("id", { ascending: false }).limit(1),
    sb.from("gideon_melhorias").select("id").eq("status", "aguardando_ok"),
  ]);
  const vale = (a: { expira_em: string | null }) => !a.expira_em || new Date(a.expira_em) > new Date();
  const visto = pc.data?.visto_em ? Math.round((Date.now() - new Date(pc.data.visto_em).getTime()) / 1000) : null;
  return {
    agora: agora(),
    aprovacoes: (aps.data ?? []).filter(vale),
    lembretes: lems.data ?? [], tarefas: tars.data ?? [],
    avisos: avisos.data ?? [],
    erros: { total_24h: nErros.count ?? 0, ultimos: (erros.data ?? []).map((e) => ({ ...e, erro_mensagem: String(e.erro_mensagem ?? "").slice(0, 300) })) },
    pc: pc.data ? { ligado: visto !== null && visto <= 75, visto_ha_segundos: visto, versao: (pc.data.info as Record<string, unknown>)?.versao ?? null,
      pasta: (pc.data.info as Record<string, unknown>)?.pasta ?? null } : { ligado: false, instalado: false },
    equipe: missoes.data ?? [],
    testes: rodada.data?.[0] ?? null,
    melhorias_esperando: melhorias.data?.length ?? 0,
  };
}

async function automacoes() {
  const [cron, rodadas, mels, missoes] = await Promise.all([
    sb.rpc("gideon_nexus_automacoes"),
    sb.from("gideon_testes_rodadas").select("id, motivo, status, nota, passou, total, criado_em, concluido_em").neq("motivo", "melhoria").order("id", { ascending: false }).limit(6),
    sb.from("gideon_melhorias").select("id, tipo, status, diagnostico, proposta, ganho, regressao, motivo_fim, criado_em").order("id", { ascending: false }).limit(8),
    sb.from("gideon_equipe_missoes").select("id, titulo, status, criado_em, concluido_em, revisao").neq("canal", "sistema").order("id", { ascending: false }).limit(8),
  ]);
  return { agendador: cron.data ?? [], erro_agendador: cron.error?.message ?? null, testes: rodadas.data ?? [], melhorias: mels.data ?? [],
    equipe: (missoes.data ?? []).map((m) => ({ id: m.id, titulo: m.titulo, status: m.status, criado_em: m.criado_em, concluido_em: m.concluido_em, nota: m.revisao?.nota ?? null })) };
}

// ---------- centro de comando (GIDEON Core, módulos 41 e 100): números reais do sistema ----------
async function comando() {
  const semana = new Date(Date.now() - 7 * 86400_000).toISOString(), hora = new Date(Date.now() - 3600_000).toISOString();
  const hoje = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  hoje.setHours(0, 0, 0, 0);
  const inicioHoje = new Date(hoje.getTime() + 3 * 3600_000).toISOString(); // meia-noite de Brasília em UTC
  const [mods, cron, mem, projs, github, pc, errosHora, execHoje, testes, missoes, aps] = await Promise.all([
    sb.from("gideon_execucoes").select("modelo").gt("data_hora", semana).neq("canal", "teste").not("modelo", "is", null).limit(10000),
    sb.rpc("gideon_nexus_automacoes"),
    sb.from("gideon_memoria").select("tipo, parte:metadados->>parte").limit(20000),
    sb.from("gideon_projetos").select("nome").eq("ativo", true).order("nome"),
    sb.from("gideon_memoria").select("link").eq("origem", "github").limit(500),
    sb.from("gideon_dispositivos").select("visto_em, info").eq("nome", "pc").maybeSingle(),
    sb.from("gideon_execucoes").select("id", { count: "exact", head: true }).eq("status", "erro").neq("canal", "teste").gt("data_hora", hora),
    sb.from("gideon_execucoes").select("status, ferramenta, tokens_entrada, tokens_saida").neq("canal", "teste").gt("data_hora", inicioHoje).limit(5000),
    sb.from("gideon_testes_rodadas").select("nota, passou, total, concluido_em").eq("motivo", "semanal").eq("status", "pronta").order("id", { ascending: false }).limit(1),
    sb.from("gideon_equipe_missoes").select("id").neq("canal", "sistema").in("status", ["aguardando_ok", "executando", "revisando"]),
    sb.from("gideon_aprovacoes").select("id, expira_em").eq("status", "pendente"),
  ]);
  const usos = new Map<string, number>();
  for (const { modelo } of mods.data ?? []) if (modelo && modelo !== "cache") usos.set(modelo, (usos.get(modelo) ?? 0) + 1);
  const tarefas = (cron.data ?? []) as { nome: string; ativo: boolean; falhas_24h: number }[];
  const porTipo: Record<string, number> = {};
  let documentos = 0;
  for (const m of mem.data ?? []) if (!m.parte || m.parte === "1") { documentos++; porTipo[m.tipo] = (porTipo[m.tipo] ?? 0) + 1; }
  const repos = new Set((github.data ?? []).map((g) => String(g.link ?? "").split("/").slice(0, 5).join("/")).filter(Boolean));
  const info = (pc.data?.info ?? {}) as Record<string, unknown>;
  const visto = pc.data?.visto_em ? Math.round((Date.now() - new Date(pc.data.visto_em).getTime()) / 1000) : null;
  const ex = execHoje.data ?? [];
  const falhasCron = tarefas.reduce((s, t) => s + Number(t.falhas_24h || 0), 0);
  const nErros = errosHora.count ?? 0;
  const motivo = nErros >= 3 ? `${nErros} erros na última hora` : falhasCron ? `${falhasCron} falha(s) no agendador em 24 h` : "";
  return {
    agora: agora(),
    sistema: { status: motivo ? "atencao" : "operacional", motivo },
    modelos: [...usos].sort((a, b) => b[1] - a[1]).map(([nome, n]) => ({ nome, usos_7d: n })),
    automacoes: { ativas: tarefas.filter((t) => t.ativo).length, total: tarefas.length, falhas_24h: falhasCron },
    documentos: { total: documentos, por_tipo: porTipo },
    projetos: { nomes: (projs.data ?? []).map((p) => p.nome), github: repos.size },
    pc: { ligado: visto !== null && visto <= 75, visto_ha_segundos: visto, versao: info.versao ?? null, computador: info.computador ?? null, uso: info.uso ?? null },
    hoje: { pedidos: ex.length, erros: ex.filter((e) => e.status === "erro").length, cache: ex.filter((e) => e.ferramenta === "cache").length,
      tokens: ex.reduce((s, e) => s + Number(e.tokens_entrada || 0) + Number(e.tokens_saida || 0), 0) },
    testes: testes.data?.[0] ?? null,
    equipe_ativas: missoes.data?.length ?? 0,
    aprovacoes_pendentes: (aps.data ?? []).filter((a) => !a.expira_em || new Date(a.expira_em) > new Date()).length,
  };
}

async function memoriaRecente() {
  const { data } = await sb.from("gideon_memoria").select("id, conteudo, resumo, tipo, origem, projeto, link, data_ref, criado_em, metadados").order("id", { ascending: false }).limit(80);
  const vistos = new Set<string>(), itens = [];
  for (const m of data ?? []) { // a memória guarda textos longos em partes: mostra cada item uma vez
    const chave = `${m.tipo}|${m.resumo ?? ""}|${m.link ?? ""}|${m.metadados?.de > 1 ? m.data_ref : m.id}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    itens.push({ id: m.id, tipo: m.tipo, origem: m.origem, projeto: m.projeto, link: m.link, data_ref: m.data_ref, resumo: m.resumo, trecho: String(m.conteudo ?? "").slice(0, 280) });
    if (itens.length >= 30) break;
  }
  return { itens };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const rota = new URL(req.url).pathname.split("/").filter(Boolean).pop();
  try {
    if (!(await validar(req))) return json({ erro: "acesso negado: abra o link /home do Telegram uma vez neste navegador" }, 401);
    const b = await req.json().catch(() => ({}));
    if (rota === "painel") return json(await painel());
    if (rota === "automacoes") return json(await automacoes());
    if (rota === "comando") return json(await comando());
    if (rota === "memoria") return json(await memoriaRecente());
    if (rota === "historico") {
      const { data } = await sb.from("gideon_mensagens").select("papel, texto, criado_em").eq("sessao", "nexus").order("criado_em", { ascending: false }).limit(40);
      return json({ mensagens: (data ?? []).reverse() });
    }
    if (rota === "conversa") {
      const texto = String(b.texto ?? "").trim().slice(0, 4000);
      if (!texto) return json({ erro: "mensagem vazia" }, 400);
      const r = await chamarGideon("nucleo", { texto, canal: "home", sessao: "nexus" });
      return json({ resposta: r.resposta, status: r.status, ferramentas: r.ferramentas ?? [], tempo_ms: r.tempo_ms });
    }
    if (rota === "aprovar") {
      const id = Number(b.id), aprovar = b.aprovar === true;
      if (!id) return json({ erro: "falta o id" }, 400);
      const r = await chamarGideon("aprovacao", { id, aprovar });
      await sb.from("gideon_aprovacoes").update({ decidido_via: "nexus" }).eq("id", id).eq("decidido_via", "teste"); // a rota de teste marca "teste"
      await avisarDono(`🖥️ Pelo Nexus: ${r.texto ?? (aprovar ? "aprovado" : "negado")}`);
      return json({ texto: r.texto, resultado: r.resultado ?? null });
    }
    return json({ erro: "rota desconhecida" }, 404);
  } catch (e) {
    console.error(rota, e);
    return json({ erro: String((e as Error).message ?? e).slice(0, 300) }, 500);
  }
});
