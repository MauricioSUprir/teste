// GIDEON — cache por significado (Base 0.4, decisão 023): pergunta geral repetida, mesmo escrita de outro jeito,
// é respondida na hora com a resposta guardada, sem chamar o modelo (não gasta o limite grátis do Google).
// Só entra no cache o que não depende do dono, da hora nem de ação:
//  - pergunta sem palavras pessoais, de tempo ou de ação (meu, hoje, agora, lembrete, manda, pesquisa...);
//  - começo de conversa (nada na mesma conversa nos últimos 20 min; senão pode ser continuação);
//  - resposta feita sem ferramenta e sem trecho forte da memória.
// Para usar a resposta guardada: mesmo canal, mesma versão do prompt, significado ≥ cache_limite (0,93)
// e as mesmas palavras importantes e os mesmos números (assim "capital da Austrália" não responde "capital da Áustria").
// Vale cache_dias (3). 👎 na resposta apaga do cache. gideon_config.cache = "nao" desliga.
import { config, sb } from "./core.ts";

type Achado = { id: number; pergunta: string; resposta: string; usos: number; similaridade: number };
const VAZIAS = new Set(("a o as os um uma uns umas de do da dos das e em no na nos nas que qual quais quem quanto quanta quantos quantas quando como onde " +
  "por para pra pro com sem sobre se ser sao foi era esta estao isso esse essa este aquilo aquele aquela ao aos mais menos muito muita muitos muitas " +
  "me te lhe voce vc gideon oi ola ei explica explique explicar diz diga dizer fala fale falar sabe saber sabia quero queria gostaria pode poderia favor ai entao tipo algo").split(" "));
// Palavras pessoais, de tempo, de ação ou que dependem da conversa (testadas no texto sem acentos)
const PESSOAL_OU_TEMPO = new RegExp("\\b(eu|meu|minha|meus|minhas|comigo|nosso|nossa|ele|ela|eles|elas|dele|dela|isso|disso|aquilo|hoje|amanha|ontem|agora|ainda|semana|mes|dia|data|" +
  "hora(s|rio)?|atual\\w*|ultim\\w*|recente\\w*|proxim\\w*|lanca\\w*|noticia\\w*|preco\\w*|cotac\\w*|dolar|clima|temperatura|chuva|chove|lembr\\w*|agenda\\w*|" +
  "e ?mails?|tarefa\\w*|projeto\\w*|arquivo\\w*|pc|computador|tela|drive|github|whats\\w*|zap|telegram|manda\\w*|envi\\w*|anot\\w*|guard\\w*|apag\\w*|pesquis\\w*|" +
  "procur\\w*|busc\\w*|abr[ae]\\w*|lig[ae]\\w*|toc[ae]\\w*|bom dia|boa tarde|boa noite|obrigad\\w*|valeu|teste\\w*|equipe|melhoria\\w*)\\b");

const normalizar = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9.,]+/g, " ").trim();
export const palavras = (t: string) => [...new Set(normalizar(t).replace(/[.,]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !VAZIAS.has(w) && !/^\d/.test(w)))];
const numeros = (t: string) => (normalizar(t).match(/\d+(?:[.,]\d+)?/g) ?? []).sort().join("|");

// A pergunta pode usar ou entrar no cache? (ultimaMensagemEm: a mensagem mais recente da mesma conversa)
export function cacheavel(p: { canal: string; anexos?: unknown[]; regraExtra?: string }, texto: string, ultimaMensagemEm: string | null) {
  if (p.canal === "teste" || p.anexos?.length || p.regraExtra) return false; // a bateria de testes precisa do modelo de verdade
  const t = texto.trim();
  if (t.length < 8 || t.length > 300 || PESSOAL_OU_TEMPO.test(normalizar(t)) || !palavras(t).length) return false;
  if (ultimaMensagemEm && Date.now() - new Date(ultimaMensagemEm).getTime() < 20 * 60_000) return false; // meio de conversa: pode ser continuação
  return true;
}
export async function cacheLigado() { return (await config()).cache !== "nao"; }

// Resposta guardada para uma pergunta com o mesmo significado (ou null)
export async function buscarNoCache(texto: string, vetor: number[], canal: string, versao: string): Promise<Achado | null> {
  const cfg = await config();
  const { data, error } = await sb.rpc("gideon_cache_buscar", { consulta: JSON.stringify(vetor), p_canal: canal, p_versao: versao, limite: Number(cfg.cache_limite || 0.93) });
  if (error) throw new Error("cache: " + error.message);
  const alvo = palavras(texto), nums = numeros(texto);
  for (const c of (data ?? []) as Achado[]) {
    const ps = new Set(palavras(c.pergunta));
    const comuns = alvo.filter((w) => ps.has(w)).length, todas = new Set([...alvo, ...ps]).size;
    if (todas && comuns / todas >= 0.7 && numeros(c.pergunta) === nums) return c; // mesmas palavras importantes e mesmos números
  }
  return null;
}
export async function usarDoCache(c: Achado, execucaoId: number | null) {
  await sb.from("gideon_cache_respostas").update({ usos: (c.usos ?? 0) + 1, ultimo_uso: new Date().toISOString(), ultima_execucao: execucaoId }).eq("id", c.id);
}
export async function guardarNoCache(r: { pergunta: string; vetor: number[]; resposta: string; canal: string; versao: string; modelo: string; execucaoId: number | null }) {
  const cfg = await config();
  const agora = Date.now();
  await sb.from("gideon_cache_respostas").delete().lt("expira_em", new Date(agora).toISOString()); // limpa os vencidos
  await sb.from("gideon_cache_respostas").insert({ pergunta: r.pergunta.slice(0, 300), embedding: JSON.stringify(r.vetor), resposta: r.resposta.slice(0, 4000), canal: r.canal,
    versao: r.versao, modelo: r.modelo || null, execucao_id: r.execucaoId, expira_em: new Date(agora + Number(cfg.cache_dias || 3) * 86400_000).toISOString() });
}
// 👎 numa resposta: ela sai do cache (a que foi guardada nessa conversa ou a que foi usada nela)
export async function esquecerDoCache(execucaoId: number) {
  if (!Number.isFinite(execucaoId) || execucaoId <= 0) return;
  await sb.from("gideon_cache_respostas").delete().or(`execucao_id.eq.${execucaoId},ultima_execucao.eq.${execucaoId}`);
}
