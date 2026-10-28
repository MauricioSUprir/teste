/**
 * Servidor do Shopping da Beleza 3D — quem está no shopping agora.
 *
 * Cada visitante abre um WebSocket em /ws, se apresenta (nome e visual do
 * avatar) e manda onde está ~8 vezes por segundo. O servidor junta as
 * posições e repassa a todos 10 vezes por segundo, e espalha o chat e os
 * gestos (acenar, aplaudir, dançar…). Nada é gravado: quem sai, some; o chat
 * guarda só as últimas mensagens na memória, para quem chega ver a conversa.
 *
 * Mensagens (JSON):
 *   visitante → servidor
 *     { t: "oi", nome, visual: { avatar, cabelo, cima, baixo } }
 *     { t: "pos", x, z, r, v }            posição (m), rumo (rad), velocidade (m/s)
 *     { t: "chat", texto }
 *     { t: "gesto", g, alvo? }            alvo = id de quem recebe o aceno
 *     { t: "visual", nome, visual }
 *   servidor → visitante
 *     { t: "bemvindo", id, outros: [...], chat: [...] }
 *     { t: "entrou", p } · { t: "saiu", id } · { t: "visual", p }
 *     { t: "estados", l: [[id, x, z, r, v], ...] }
 *     { t: "chat", m: { id, nome, texto, hora } }
 *     { t: "gesto", id, g, alvo? }
 *     { t: "total", n }
 *
 *   GET /saude → { ok, pessoas }
 */
import http from "node:http";
import { randomBytes } from "node:crypto";
import { WebSocketServer } from "ws";

const PORTA = Number(process.env.PORT) || 8787;
const MAXIMO = Number(process.env.MAXIMO_PESSOAS) || 120;
// endereços do shopping que podem conectar (vazio = qualquer um, para testar)
const ORIGENS = (process.env.ORIGENS_PERMITIDAS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const AVATARES = new Set([
  "Female_Adult_01", "Female_Adult_03", "Female_Adult_05", "Female_Adult_11", "Female_Adult_12", "Female_Adult_13", "Female_Adult_17", "Female_Party_02",
  "Male_Adult_01", "Male_Adult_04", "Male_Adult_06", "Male_Adult_09", "Male_Adult_10", "Male_Adult_12", "Male_Adult_16", "Male_Adult_17",
]);
const GESTOS = new Set(["acenar", "aplaudir", "dancar", "rir", "comemorar", "falar"]);
// palavrões mais comuns: viram asteriscos (o chat é aberto a qualquer visitante)
const PALAVROES = /\b(porra|caralh\w*|merda|puta\w*|fdp|buceta|cu|pau no cu|viad\w*|arrombad\w*|vagabund\w*|desgraç\w*|piranha|otári\w*|babac\w*)\b/gi;

const pessoas = new Map();
const historico = [];

const cor = /^#[0-9a-fA-F]{6}$/;
const limparTexto = (s, max) =>
  String(s ?? "")
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
const limparNome = (s) => limparTexto(s, 18) || "Visitante";
function limparVisual(v) {
  const o = v && typeof v === "object" ? v : {};
  return {
    avatar: AVATARES.has(o.avatar) ? o.avatar : "Female_Adult_01",
    cabelo: cor.test(o.cabelo) ? o.cabelo : null,
    cima: cor.test(o.cima) ? o.cima : null,
    baixo: cor.test(o.baixo) ? o.baixo : null,
  };
}
const num = (v, min, max, padrao = 0) => (Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : padrao);
const publico = (p) => ({ id: p.id, nome: p.nome, visual: p.visual, x: p.x, z: p.z, r: p.r, v: p.v });

function enviar(ws, msg) {
  if (ws.readyState === 1) ws.send(typeof msg === "string" ? msg : JSON.stringify(msg));
}
function espalhar(msg, menos) {
  const texto = JSON.stringify(msg);
  for (const p of pessoas.values()) if (p.id !== menos && p.pronto) enviar(p.ws, texto);
}

const servidor = http.createServer((req, res) => {
  if (req.url === "/saude" || req.url === "/") {
    res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*", "cache-control": "no-store" });
    res.end(JSON.stringify({ ok: true, pessoas: [...pessoas.values()].filter((p) => p.pronto).length }));
    return;
  }
  res.writeHead(404, { "content-type": "text/plain" });
  res.end("não encontrado");
});

const wss = new WebSocketServer({ server: servidor, path: "/ws", maxPayload: 4096 });

wss.on("connection", (ws, req) => {
  const origem = req.headers.origin ?? "";
  if (ORIGENS.length && !ORIGENS.includes(origem)) {
    ws.close(1008, "origem");
    return;
  }
  if (pessoas.size >= MAXIMO) {
    ws.close(1013, "cheio");
    return;
  }
  const id = randomBytes(6).toString("base64url");
  const p = { id, ws, nome: "Visitante", visual: limparVisual(null), x: 0, z: 31, r: Math.PI, v: 0, mudou: false, pronto: false, vivo: true, chatEm: 0, gestoEm: 0, msgs: 0, janela: Date.now() };
  pessoas.set(id, p);

  ws.on("pong", () => (p.vivo = true));
  ws.on("message", (bruto) => {
    // no máximo ~40 mensagens por segundo por pessoa
    const agora = Date.now();
    if (agora - p.janela > 1000) {
      p.janela = agora;
      p.msgs = 0;
    }
    if (++p.msgs > 40) return;
    let m;
    try {
      m = JSON.parse(String(bruto));
    } catch {
      return;
    }
    if (!m || typeof m !== "object") return;
    if (m.t === "oi" && !p.pronto) {
      p.nome = limparNome(m.nome);
      p.visual = limparVisual(m.visual);
      p.pronto = true;
      enviar(ws, { t: "bemvindo", id, outros: [...pessoas.values()].filter((o) => o.pronto && o.id !== id).map(publico), chat: historico });
      espalhar({ t: "entrou", p: publico(p) }, id);
      espalhar({ t: "total", n: [...pessoas.values()].filter((o) => o.pronto).length });
      return;
    }
    if (!p.pronto) return;
    if (m.t === "pos") {
      p.x = num(m.x, -40, 40, p.x);
      p.z = num(m.z, -70, 40, p.z);
      p.r = num(m.r, -10, 10, p.r);
      p.v = num(m.v, 0, 6, 0);
      p.mudou = true;
    } else if (m.t === "chat") {
      if (agora - p.chatEm < 1200) return;
      const texto = limparTexto(m.texto, 140).replace(PALAVROES, (w) => "*".repeat(w.length));
      if (!texto) return;
      p.chatEm = agora;
      const msg = { id, nome: p.nome, texto, hora: agora };
      historico.push(msg);
      if (historico.length > 30) historico.shift();
      espalhar({ t: "chat", m: msg });
    } else if (m.t === "gesto") {
      if (agora - p.gestoEm < 800 || !GESTOS.has(m.g)) return;
      p.gestoEm = agora;
      const alvo = typeof m.alvo === "string" && pessoas.has(m.alvo) ? m.alvo : undefined;
      espalhar({ t: "gesto", id, g: m.g, alvo }, id);
    } else if (m.t === "visual") {
      p.nome = limparNome(m.nome);
      p.visual = limparVisual(m.visual);
      espalhar({ t: "visual", p: publico(p) }, id);
    }
  });
  ws.on("close", () => {
    pessoas.delete(id);
    if (p.pronto) {
      espalhar({ t: "saiu", id });
      espalhar({ t: "total", n: [...pessoas.values()].filter((o) => o.pronto).length });
    }
  });
  ws.on("error", () => ws.terminate());
});

// posições de todo mundo, 10 vezes por segundo (só de quem mexeu)
setInterval(() => {
  const l = [];
  for (const p of pessoas.values()) {
    if (!p.pronto || !p.mudou) continue;
    p.mudou = false;
    l.push([p.id, Math.round(p.x * 100) / 100, Math.round(p.z * 100) / 100, Math.round(p.r * 100) / 100, Math.round(p.v * 10) / 10]);
  }
  if (l.length) espalhar({ t: "estados", l });
}, 100);

// conexão que caiu sem avisar (celular que perdeu o sinal): sai depois de ~40 s
setInterval(() => {
  for (const p of pessoas.values()) {
    if (!p.vivo) {
      p.ws.terminate();
      continue;
    }
    p.vivo = false;
    p.ws.ping();
  }
}, 20000);

servidor.listen(PORTA, () => console.log(`Shopping da Beleza: servidor na porta ${PORTA}${ORIGENS.length ? ` (origens: ${ORIGENS.join(", ")})` : ""}`));
