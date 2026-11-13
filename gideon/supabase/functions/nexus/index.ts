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
//   mapas | mapa-criar | mapa-expandir | mapa-salvar | mapa-tarefa | mapa-apagar ← Thought Map do GIDEON Core (módulo 72, decisão 026)
//   entrar     ← { codigo } SEM chave: troca um código de entrada de uso único (15 min) pela chave do Home (30 dias). Para quando o Telegram está fora.
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

// ---------- Thought Map (módulo 72): o problema vira um mapa de partes, hipóteses, alternativas, riscos e dependências ----------
type No = { id: string; pai: string | null; titulo: string; tipo: string; nota?: string; tarefa_id?: number | null };
const TIPOS = ["raiz", "parte", "hipotese", "alternativa", "risco", "dependencia"];
async function config(chaves: string[]) {
  const { data } = await sb.from("gideon_config").select("chave, valor").in("chave", chaves);
  return Object.fromEntries((data ?? []).map((r) => [r.chave, r.valor])) as Record<string, string>;
}
// IA do Google (a mesma chave da GIDEON); tenta o modelo forte e depois os mais leves; tudo fica no registro de execuções
async function iaJSON(pedido: string, rotulo: string) {
  const cfg = await config(["modelo_relatorio", "modelo_conversa", "modelo_reserva"]);
  const modelos = [cfg.modelo_relatorio || "gemini-3.5-flash", cfg.modelo_conversa, cfg.modelo_reserva].filter((m, i, l) => m && l.indexOf(m) === i);
  const inicio = Date.now(); let erro = "";
  for (const modelo of modelos) {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 45_000);
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, { method: "POST", signal: c.signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": (Deno.env.get("GEMINI_API_KEY") ?? "").trim() },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: pedido }] }], generationConfig: { temperature: 0.4, responseMimeType: "application/json" } }) });
      if (!r.ok) { erro = `${modelo} ${r.status}`; continue; }
      const j = await r.json();
      const texto = (j.candidates?.[0]?.content?.parts ?? []).map((x: { text?: string }) => x.text ?? "").join("");
      const dados = JSON.parse(texto);
      await sb.from("gideon_execucoes").insert({ canal: "home", pedido_resumo: rotulo.slice(0, 200), ferramenta: "mapa", modelo, tokens_entrada: j.usageMetadata?.promptTokenCount ?? 0,
        tokens_saida: j.usageMetadata?.candidatesTokenCount ?? 0, custo_estimado: 0, tempo_ms: Date.now() - inicio, status: "sucesso", workflow: "supabase:nexus/mapa" });
      return dados;
    } catch (e) { erro = `${modelo}: ${String((e as Error).message ?? e).slice(0, 120)}`; }
    finally { clearTimeout(t); }
  }
  await sb.from("gideon_execucoes").insert({ canal: "home", pedido_resumo: rotulo.slice(0, 200), ferramenta: "mapa", tempo_ms: Date.now() - inicio, status: "erro", erro_mensagem: erro, workflow: "supabase:nexus/mapa" });
  throw new Error("a IA não respondeu agora (" + erro + "); tente de novo em um minuto");
}
const limpar = (t: unknown, n: number) => String(t ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const REGRAS_MAPA = `Tipos de nó: parte (um pedaço do problema), hipotese (algo a testar), alternativa (outro caminho possível), risco (o que pode dar errado), dependencia (o que precisa existir antes).
Títulos curtos (até 6 palavras). Nota: 1 frase curta e prática (até 20 palavras). Português do Brasil. Não invente números, preços, nomes de produtos ou fatos específicos: é um mapa para pensar, não uma pesquisa.`;
async function mapaCriar(objetivo: string) {
  const obj = limpar(objetivo, 600);
  if (obj.length < 3) throw new Error("escreva o problema ou objetivo");
  const r = await iaJSON(`Você é a GIDEON. Monte um MAPA DE PENSAMENTO para o objetivo do dono: "${obj}".
Divida em 4 a 7 ramos principais (tipo "parte") e, em cada ramo, 2 a 4 nós filhos com os tipos que fizerem sentido. No máximo 30 nós no total.
${REGRAS_MAPA}
Responda só JSON: {"titulo": "até 6 palavras", "ramos": [{"titulo": "...", "tipo": "parte", "nota": "...", "filhos": [{"titulo": "...", "tipo": "risco", "nota": "..."}]}]}`, `mapa: ${obj}`);
  const titulo = limpar(r.titulo, 80) || obj.slice(0, 60);
  const nos: No[] = [{ id: "1", pai: null, titulo, tipo: "raiz", nota: obj }];
  (Array.isArray(r.ramos) ? r.ramos : []).slice(0, 8).forEach((ramo: Record<string, unknown>, i: number) => {
    const id = `1.${i + 1}`;
    nos.push({ id, pai: "1", titulo: limpar(ramo.titulo, 60) || `Parte ${i + 1}`, tipo: "parte", nota: limpar(ramo.nota, 200) });
    (Array.isArray(ramo.filhos) ? ramo.filhos : []).slice(0, 5).forEach((f: Record<string, unknown>, k: number) => {
      nos.push({ id: `${id}.${k + 1}`, pai: id, titulo: limpar(f.titulo, 60) || "…", tipo: TIPOS.includes(String(f.tipo)) && f.tipo !== "raiz" ? String(f.tipo) : "parte", nota: limpar(f.nota, 200) });
    });
  });
  if (nos.length < 3) throw new Error("a IA não conseguiu dividir esse objetivo; tente com mais detalhes");
  const { data, error } = await sb.from("gideon_mapas").insert({ titulo, objetivo: obj, nos }).select("*").single();
  if (error) throw new Error("não consegui guardar o mapa: " + error.message);
  return data;
}
async function mapaPegar(id: number) {
  const { data } = await sb.from("gideon_mapas").select("*").eq("id", id).maybeSingle();
  if (!data) throw new Error("mapa não encontrado");
  return data as { id: number; titulo: string; objetivo: string; nos: No[] };
}
async function mapaExpandir(mapaId: number, noId: string) {
  const m = await mapaPegar(mapaId);
  const no = m.nos.find((n) => n.id === noId);
  if (!no) throw new Error("nó não encontrado");
  const caminho: No[] = []; for (let n: No | undefined = no; n; n = m.nos.find((x) => x.id === n!.pai)) caminho.unshift(n);
  const irmaos = m.nos.filter((n) => n.pai === no.id).map((n) => n.titulo);
  const r = await iaJSON(`Você é a GIDEON. Mapa de pensamento sobre: "${m.objetivo}".
Caminho até o nó escolhido: ${caminho.map((n) => n.titulo).join(" → ")}.
${irmaos.length ? `Ele já tem estes filhos (não repita): ${irmaos.join("; ")}.` : ""}
Crie de 3 a 5 novos nós filhos para "${no.titulo}", que ajudem a resolver essa parte.
${REGRAS_MAPA}
Responda só JSON: {"nos": [{"titulo": "...", "tipo": "parte", "nota": "..."}]}`, `mapa #${mapaId}: expandir "${no.titulo}"`);
  let k = m.nos.filter((n) => n.pai === no.id).length;
  const usados = new Set(m.nos.map((n) => n.id));
  const novos: No[] = [];
  for (const f of (Array.isArray(r.nos) ? r.nos : []).slice(0, 6)) {
    let id; do { id = `${no.id}.${++k}`; } while (usados.has(id));
    usados.add(id);
    novos.push({ id, pai: no.id, titulo: limpar(f.titulo, 60) || "…", tipo: TIPOS.includes(String(f.tipo)) && f.tipo !== "raiz" ? String(f.tipo) : "parte", nota: limpar(f.nota, 200) });
  }
  if (m.nos.length + novos.length > 120) throw new Error("o mapa já está grande demais (120 nós); crie um mapa novo para essa parte");
  const { data } = await sb.from("gideon_mapas").update({ nos: [...m.nos, ...novos], atualizado_em: agora() }).eq("id", mapaId).select("*").single();
  return data;
}
async function mapaSalvar(mapaId: number, nos: unknown, titulo?: string) {
  if (!Array.isArray(nos) || !nos.length || nos.length > 120) throw new Error("mapa inválido");
  const ids = new Set<string>();
  const limpos: No[] = nos.map((n: Record<string, unknown>) => ({ id: limpar(n.id, 40), pai: n.pai == null ? null : limpar(n.pai, 40), titulo: limpar(n.titulo, 60) || "…",
    tipo: TIPOS.includes(String(n.tipo)) ? String(n.tipo) : "parte", nota: limpar(n.nota, 200), tarefa_id: Number(n.tarefa_id) || null }));
  for (const n of limpos) { if (!n.id || ids.has(n.id)) throw new Error("nós repetidos"); ids.add(n.id); }
  if (limpos.filter((n) => n.pai === null).length !== 1 || limpos.some((n) => n.pai !== null && !ids.has(n.pai))) throw new Error("o mapa precisa de uma raiz e de pais que existam");
  const extra = titulo ? { titulo: limpar(titulo, 80) } : {};
  const { data } = await sb.from("gideon_mapas").update({ nos: limpos, atualizado_em: agora(), ...extra }).eq("id", mapaId).select("*").single();
  return data;
}
async function mapaTarefa(mapaId: number, noId: string) {
  const m = await mapaPegar(mapaId);
  const no = m.nos.find((n) => n.id === noId);
  if (!no) throw new Error("nó não encontrado");
  if (no.tarefa_id) return { ja_existe: true, tarefa_id: no.tarefa_id, mapa: m };
  const { data: t, error } = await sb.from("gideon_tarefas").insert({ titulo: no.titulo, descricao: `${no.nota ? no.nota + " " : ""}(do mapa "${m.titulo}")`.slice(0, 500), origem: "core" }).select("id").single();
  if (error || !t) throw new Error("não consegui criar a tarefa: " + (error?.message ?? ""));
  no.tarefa_id = t.id;
  const { data } = await sb.from("gideon_mapas").update({ nos: m.nos, atualizado_em: agora() }).eq("id", mapaId).select("*").single();
  return { tarefa_id: t.id, mapa: data };
}

// ---------- código de entrada: entrar sem o Telegram ----------
async function sha256(txt: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function entrar(codigo: string) {
  const limpo = codigo.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (limpo.length < 6 || limpo.length > 12) return { ok: false, erro: "código inválido" };
  const { data } = await sb.from("gideon_codigos_entrada").update({ usado_em: agora() })
    .eq("hash", await sha256(limpo)).is("usado_em", null).gt("expira_em", agora()).lt("tentativas", 8).select("id"); // só um uso
  if (!data?.length) {
    // errou: conta a tentativa em todos os códigos que ainda valem (8 erros e eles param de valer)
    const { data: ativos } = await sb.from("gideon_codigos_entrada").select("id, tentativas").is("usado_em", null).gt("expira_em", agora());
    for (const a of ativos ?? []) await sb.from("gideon_codigos_entrada").update({ tentativas: a.tentativas + 1 }).eq("id", a.id);
    return { ok: false, erro: "código errado, usado ou vencido" };
  }
  const exp = String(Date.now() + 30 * 86400_000);
  const chave = `${exp}.${(await hmac(await segredo(), "home:" + exp)).slice(0, 40)}`; // a mesma conta da chave do /home (home.ts)
  await sb.from("gideon_acoes").insert({ quem: "gideon/nexus", acao: "entrada_por_codigo", alvo: String(data[0].id), detalhes: { validade_dias: 30 }, reversivel: false });
  await avisarDono("🔑 Alguém entrou no GIDEON Home/Core com um código de entrada (vale 30 dias neste aparelho). Se não foi você, avise o Claude.");
  return { ok: true, chave };
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
    if (rota === "entrar") { // única rota sem chave
      const b = await req.json().catch(() => ({}));
      const r = await entrar(String(b.codigo ?? ""));
      return json(r, r.ok ? 200 : 403);
    }
    if (!(await validar(req))) return json({ erro: "acesso negado: abra o link /home do Telegram uma vez neste navegador" }, 401);
    const b = await req.json().catch(() => ({}));
    if (rota === "painel") return json(await painel());
    if (rota === "automacoes") return json(await automacoes());
    if (rota === "comando") return json(await comando());
    if (rota === "mapas") { const { data } = await sb.from("gideon_mapas").select("id, titulo, objetivo, atualizado_em").order("atualizado_em", { ascending: false }).limit(20); return json({ mapas: data ?? [] }); }
    if (rota === "mapa") return json(await mapaPegar(Number(b.id)));
    if (rota === "mapa-criar") return json(await mapaCriar(String(b.objetivo ?? "")));
    if (rota === "mapa-expandir") return json(await mapaExpandir(Number(b.id), String(b.no ?? "")));
    if (rota === "mapa-salvar") return json(await mapaSalvar(Number(b.id), b.nos, b.titulo ? String(b.titulo) : undefined));
    if (rota === "mapa-tarefa") return json(await mapaTarefa(Number(b.id), String(b.no ?? "")));
    if (rota === "mapa-apagar") { await sb.from("gideon_mapas").delete().eq("id", Number(b.id)); return json({ apagado: true }); }
    if (rota === "memoria") return json(await memoriaRecente());
    if (rota === "historico") {
      const { data } = await sb.from("gideon_mensagens").select("papel, texto, criado_em").eq("sessao", "nexus").order("criado_em", { ascending: false }).limit(40);
      return json({ mensagens: (data ?? []).reverse() });
    }
    if (rota === "conversa") {
      const texto = String(b.texto ?? "").trim().slice(0, 4000);
      if (!texto) return json({ erro: "mensagem vazia" }, 400);
      const r = await chamarGideon("nucleo", { texto, canal: "home", sessao: "nexus" });
      return json({ resposta: r.resposta, status: r.status, ferramentas: r.ferramentas ?? [], tempo_ms: r.tempo_ms, abrir: r.abrir ?? null }); // abrir: tela que a GIDEON pediu para abrir
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
