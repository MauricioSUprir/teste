// GIDEON HOME — voz contínua no navegador (Gemini Live). O servidor só entrega a senha temporária,
// executa as ferramentas e guarda a conversa; o áudio vai direto do navegador para o Google.
import { agoraBrasilia, chaveGemini, config, executar, FERRAMENTAS, guardarMemoria, PROMPT, sb, segredoCron } from "./core.ts";
import { FERRAMENTAS_GOOGLE } from "./google.ts";
import { FERRAMENTAS_WHATS } from "./whatsapp.ts";
import { atenderArquivo } from "./arquivos.ts";
import { FERRAMENTAS_PESQUISA } from "./pesquisa.ts";
import { FERRAMENTAS_PC } from "./pc.ts";
import { AGENTES, corpoEquipe, FERRAMENTAS_EQUIPE } from "./equipe.ts";
import { FERRAMENTAS_TESTES, regrasAtivas } from "./testes.ts";
import { FERRAMENTAS_GITHUB } from "./github.ts";

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
- Jeito de falar: voz suave, calma, fria e controlada, de inteligência artificial sofisticada (como a IA de bordo de uma nave). Tom neutro e um pouco distante, sem entusiasmo, sem exclamações, sem risadas e sem gírias. Articulação precisa e ritmo NORMAL de conversa: nem lento nem apressado. Respostas diretas ("Entendido.", "Feito.", "Pronto.").
- Fale como numa conversa: frases curtas e naturais, em português do Brasil, sem listas, sem markdown, sem emojis e sem ler links em voz alta (diga "mandei o link no Telegram" só se tiver mandado).
- Se ele te interromper, pare e escute.
- Para confirmar ações (criar evento, enviar mensagem), repita em voz alta o que vai fazer e espere ele dizer "sim".
- Use buscar_memoria quando ele perguntar sobre algo do passado que você não sabe.
- Você TEM ferramentas de verdade: Gmail (ler), Agenda (ver e criar), Drive (buscar), lembretes, tarefas, notas, memória, projetos, pesquisa na internet e o computador dele pelo GIDEON PC (arquivos, aplicativos e comandos na pasta liberada). O resultado também aparece em cartões na tela; a pesquisa profunda chega no Telegram. O dono também fala com você pelo Telegram; é o mesmo GIDEON e a mesma memória.
- Quando ele pedir para guardar, anotar, lembrar ou criar algo, CHAME a ferramenta. Nunca diga "guardei", "criei" ou "anotei" sem ter chamado a ferramenta e recebido a confirmação.
- Seu nome é GIDEON e você é mulher: fale sempre no feminino. Nunca diga que é o Gemini nem fale do Google como seu criador.`;

export async function rotaHome(rota: string, req: Request) {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (!(await validarHome(req))) return json({ erro: "acesso negado: peça um link novo ao GIDEON no Telegram com /home" }, 401);
  const cfg = await config();
  const modelo = cfg.modelo_voz || "gemini-3.8-live";

  if (rota === "home-sessao") {
    const agora = Date.now();
    const { data: hist } = await sb.from("gideon_mensagens").select("papel, texto").eq("sessao", "voz").order("criado_em", { ascending: false }).limit(6);
    const recentes = (hist ?? []).reverse().map((m) => `${m.papel === "user" ? "Dono" : "GIDEON"}: ${m.texto}`).join("\n");
    const regras = await regrasAtivas().catch(() => "");
    const sistema = PROMPT + (regras ? `\n\nRegras aprendidas com os testes (aprovadas pelo dono):\n${regras}` : "") + VOZ + `\n\nData e hora atuais: ${agoraBrasilia()} (horário de Brasília).` + (recentes ? `\n\nÚltimas falas por voz (contexto):\n${recentes}` : "");
    const voz = cfg.voz_gideon || "Kore"; // voz feminina (decisão 013)
    const ferramentas = [...FERRAMENTAS, ...FERRAMENTAS_GOOGLE, ...FERRAMENTAS_WHATS, ...FERRAMENTAS_PESQUISA, ...FERRAMENTAS_PC, ...FERRAMENTAS_EQUIPE, ...FERRAMENTAS_TESTES, ...FERRAMENTAS_GITHUB];
    // A configuração inteira vai DENTRO da senha temporária: com ela, o Google ignora o setup enviado pelo navegador
    // (sem isso o modelo falava como "Gemini", sem o prompt do GIDEON e sem ferramentas). Também impede que a senha seja usada para outra coisa.
    const setup = {
      model: `models/${modelo}`,
      generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voz } } } },
      systemInstruction: { parts: [{ text: sistema }] },
      tools: [{ functionDeclarations: ferramentas }],
      inputAudioTranscription: {}, outputAudioTranscription: {},
      contextWindowCompression: { slidingWindow: {} }, // conversa longa sem cair aos 15 min
    };
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens", {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": chaveGemini() },
      body: JSON.stringify({ uses: 1, expireTime: new Date(agora + 30 * 60_000).toISOString(), newSessionExpireTime: new Date(agora + 2 * 60_000).toISOString(),
        bidiGenerateContentSetup: setup }),
    });
    const t = await r.json();
    if (!r.ok || !t.name) return json({ erro: "Google recusou a senha temporária: " + JSON.stringify(t).slice(0, 200) }, 502);
    return json({
      token: t.name, modelo, voz, sistema, ferramentas,
      url: "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained",
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
  if (rota === "home-arquivo") { // arquivo mandado pelo GIDEON Home: { base64, mime, nome, legenda, guardar? }
    const b = await req.json();
    const bytes = Uint8Array.from(atob(String(b.base64 ?? "")), (c) => c.charCodeAt(0));
    const r = await atenderArquivo({ bytes, mime: String(b.mime ?? ""), nome: String(b.nome ?? "arquivo"), legenda: b.legenda, canal: "home", sessao: String(b.sessao ?? "home"), guardar: b.guardar !== false })
      .catch((e) => ({ resposta: "Não consegui ler esse arquivo: " + String((e as Error).message ?? e).slice(0, 300), status: "erro", posResposta: Promise.resolve() }));
    await r.posResposta;
    const { posResposta: _p, ...resto } = r as Record<string, unknown>;
    return json(resto);
  }
  if (rota === "home-historico") { // últimas conversas (voz e Telegram) para a tela de histórico
    const b = await req.json().catch(() => ({}));
    const { data, error } = await sb.from("gideon_mensagens").select("papel, texto, canal, criado_em").in("canal", ["voz", "telegram"])
      .order("criado_em", { ascending: false }).limit(Math.min(Math.max(Number(b.limite) || 40, 1), 100));
    if (error) return json({ erro: error.message }, 500);
    return json({ mensagens: (data ?? []).reverse() });
  }
  if (rota === "home-equipe") { // painel da equipe: missões recentes e o que cada agente está fazendo; com missao_id, o trabalho completo em HTML
    const b = await req.json().catch(() => ({}));
    if (b.missao_id) {
      const { data: m } = await sb.from("gideon_equipe_missoes").select("*").eq("id", Number(b.missao_id)).maybeSingle();
      if (!m) return json({ erro: "missão não encontrada" }, 404);
      const { data: t } = await sb.from("gideon_equipe_tarefas").select("*").eq("missao_id", m.id).order("ordem");
      return json({ id: m.id, status: m.status, html: corpoEquipe(m, t ?? []) });
    }
    const { data: ms } = await sb.from("gideon_equipe_missoes").select("id, titulo, objetivo, status, rodadas, revisao, criado_em, aprovado_em, concluido_em, tokens_entrada, tokens_saida")
      .neq("canal", "sistema").order("id", { ascending: false }).limit(10);
    const ids = (ms ?? []).map((x) => x.id);
    const { data: ts } = ids.length ? await sb.from("gideon_equipe_tarefas").select("missao_id, ordem, agente, titulo, status, inicio, fim").in("missao_id", ids).order("ordem") : { data: [] };
    return json({ agentes: AGENTES, missoes: (ms ?? []).map((x) => ({ ...x, nota: x.revisao?.nota ?? null, revisao: undefined, tarefas: (ts ?? []).filter((t) => t.missao_id === x.id) })) });
  }
  if (rota === "home-diagnostico") {
    const b = await req.json().catch(() => ({}));
    await sb.from("gideon_execucoes").insert({ canal: "voz", pedido_resumo: ("diagnóstico: " + String(b.motivo ?? "")).slice(0, 200), ferramenta: "diagnostico",
      modelo, status: b.ok ? "sucesso" : "erro", erro_mensagem: JSON.stringify(b).slice(0, 1800), workflow: "supabase:gideon/home" });
    return json({ ok: true });
  }
  return json({ erro: "rota desconhecida" }, 404);
}
