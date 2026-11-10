// GIDEON no iPhone (app Atalhos): "E aí Siri, GIDEON" → o atalho dita o pedido, manda para cá (rota celular) e fala a resposta.
// Ações no celular: a GIDEON devolve UM link para o iPhone abrir (ligar, SMS, WhatsApp, rota, música, vídeo, site, app).
// Ligar e mandar mensagem só abrem com tudo preenchido: o próprio iPhone pede a confirmação ou o toque em "enviar". Nada sai sem o dono.
import { atender, config, responderTelegram, segredoCron, telegram } from "./core.ts";

const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json; charset=utf-8" } });

async function hmac(chave: string, msg: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(chave), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
  return [...new Uint8Array(s)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
// Chave do celular: validade + assinatura (só o GIDEON sabe gerar). Entregue ao dono pelo Telegram (/celular). Vale 1 ano.
export async function tokenCelular(dias = 365) {
  const exp = String(Date.now() + dias * 86400_000);
  return `${exp}.${(await hmac(await segredoCron(), "cel:" + exp)).slice(0, 40)}`;
}
async function validarCelular(req: Request) {
  const [exp, sig] = (req.headers.get("x-gideon-celular") ?? "").trim().split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return sig === (await hmac(await segredoCron(), "cel:" + exp)).slice(0, 40);
}

// ---------- ferramenta (só aparece para o modelo quando o pedido vem do iPhone) ----------
const APPS: Record<string, string> = {
  whatsapp: "whatsapp://", instagram: "instagram://", spotify: "spotify://", youtube: "youtube://", telegram: "tg://", waze: "waze://",
  "google maps": "comgooglemaps://", gmail: "googlegmail://", netflix: "nflx://", uber: "uber://", ifood: "ifood://",
  mapas: "maps://", musica: "music://", "apple music": "music://", calendario: "calshow://", agenda: "calshow://", notas: "mobilenotes://",
  fotos: "photos-redirect://", lembretes: "x-apple-reminderkit://", atalhos: "shortcuts://",
};
export const FERRAMENTAS_CELULAR = [
  { name: "celular_abrir", description: "Abre algo no iPhone do dono assim que você terminar de falar (uma ação por pedido). Ligar, SMS e WhatsApp só abrem com tudo preenchido: o próprio iPhone pede para ele confirmar a ligação ou tocar em enviar.", parameters: { type: "object", properties: {
      tipo: { type: "string", enum: ["ligar", "sms", "whatsapp", "rota", "musica", "video", "site", "pesquisa", "app"] },
      numero: { type: "string", description: "Telefone com DDD (com DDI se não for do Brasil). Para ligar, sms e whatsapp." },
      texto: { type: "string", description: "Mensagem (sms, whatsapp); o que buscar (musica, video, pesquisa); ou o destino (rota)" },
      url: { type: "string", description: "Endereço completo começando com https:// (tipo site)" },
      app: { type: "string", description: "Tipo app: whatsapp, instagram, spotify, youtube, telegram, waze, google maps, gmail, netflix, uber, ifood, mapas, musica, calendario, notas, fotos, lembretes. Tipo musica: spotify, youtube music ou apple music. Tipo rota: waze, google maps ou mapas." } },
    required: ["tipo"] } },
];
const sem = (t: unknown) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
function telefone(n: unknown) { // devolve só dígitos com DDI (Brasil por padrão)
  const bruto = String(n ?? "").trim(), d = bruto.replace(/\D/g, "");
  if (d.length < 8) return "";
  if (bruto.startsWith("+") || bruto.startsWith("00")) return d.replace(/^00/, "");
  return d.length <= 11 ? "55" + d.replace(/^0/, "") : d;
}
function montarLink(a: Record<string, unknown>): { url?: string; descricao?: string; erro?: string } {
  const tipo = sem(a.tipo), q = encodeURIComponent(String(a.texto ?? "").trim()), app = sem(a.app);
  const tel = telefone(a.numero), txt = String(a.texto ?? "").trim();
  switch (tipo) {
    case "ligar": return tel ? { url: `tel:+${tel}`, descricao: `ligar para +${tel} (o iPhone pede para confirmar)` } : { erro: "Falta o número com DDD." };
    case "sms": return tel ? { url: `sms:+${tel}${txt ? "&body=" + encodeURIComponent(txt) : ""}`, descricao: `abrir o SMS para +${tel} com o texto pronto (ele toca em enviar)` } : { erro: "Falta o número com DDD." };
    case "whatsapp": return tel ? { url: `https://wa.me/${tel}${txt ? "?text=" + encodeURIComponent(txt) : ""}`, descricao: `abrir o WhatsApp para +${tel} com o texto pronto (ele toca em enviar)` } : { erro: "Falta o número com DDD." };
    case "rota":
      if (!q) return { erro: "Falta o destino." };
      if (app.includes("waze")) return { url: `https://waze.com/ul?q=${q}&navigate=yes`, descricao: `rota no Waze até ${txt}` };
      if (app.includes("google")) return { url: `https://www.google.com/maps/dir/?api=1&destination=${q}`, descricao: `rota no Google Maps até ${txt}` };
      return { url: `https://maps.apple.com/?daddr=${q}`, descricao: `rota no Mapas até ${txt}` };
    case "musica":
      if (!q) return { erro: "Falta o que tocar." };
      if (app.includes("spotify")) return { url: `spotify:search:${q}`, descricao: `buscar "${txt}" no Spotify` };
      if (app.includes("apple")) return { url: `https://music.apple.com/search?term=${q}`, descricao: `buscar "${txt}" no Apple Music` };
      return { url: `https://music.youtube.com/search?q=${q}`, descricao: `buscar "${txt}" no YouTube Music` };
    case "video": return q ? { url: `https://www.youtube.com/results?search_query=${q}`, descricao: `buscar "${txt}" no YouTube` } : { erro: "Falta o que buscar." };
    case "pesquisa": return q ? { url: `https://www.google.com/search?q=${q}`, descricao: `pesquisar "${txt}" no Google` } : { erro: "Falta o que pesquisar." };
    case "site": {
      const u = String(a.url ?? "").trim();
      return /^https:\/\/[^\s]+$/i.test(u) ? { url: u, descricao: `abrir ${u}` } : { erro: "O endereço precisa começar com https://." };
    }
    case "app": {
      const chave = Object.keys(APPS).find((k) => app === k || app.replace(/\s+/g, "") === k.replace(/\s+/g, ""));
      return chave ? { url: APPS[chave], descricao: `abrir o ${a.app}` } : { erro: `Ainda não sei abrir "${a.app}". Sei abrir: ${Object.keys(APPS).join(", ")}.` };
    }
  }
  return { erro: "Tipo desconhecido." };
}
export function executarCelular(_nome: string, a: Record<string, unknown>, canal: string) {
  if (canal !== "celular") return { erro: "Isso só funciona quando o dono fala pelo atalho GIDEON do iPhone." };
  const l = montarLink(a);
  if (l.erro || !l.url) return { erro: l.erro ?? "não consegui montar o link" };
  return { ok: true, celular: { abrir: l.url, descricao: l.descricao }, descricao: `Quando você terminar de falar, o iPhone vai ${l.descricao}.` };
}

// ---------- rota usada pelo atalho do iPhone ----------
const LINK = /https?:\/\/[^\s)\]]+/g;
function paraFala(t: string) { // o iPhone lê em voz alta: sem links, markdown nem emojis
  return t.replace(LINK, "").replace(/[*_#`>|]/g, "").replace(/\p{Extended_Pictographic}/gu, "").replace(/\(\s*\)/g, "")
    .replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").replace(/ +([.,;:!?])/g, "$1").trim();
}
export async function rotaCelular(req: Request) {
  if (!(await validarCelular(req))) return json({ fala: "Minha chave do celular está errada ou venceu. Mande barra celular no Telegram para pegar outra.", erro: "chave" }); // 200 para a Siri falar o aviso
  const bruto = await req.text();
  let texto = "", guardar = true;
  try { const b = JSON.parse(bruto); texto = String(b.texto ?? b.text ?? ""); guardar = b.guardar !== false; } catch { texto = bruto; } // aceita JSON {texto} ou texto puro
  texto = texto.trim().slice(0, 2000);
  if (!texto) return json({ fala: "Não ouvi nada. Pode repetir?" });
  const r = await atender({ texto, canal: "celular", sessao: "celular", guardar }); // guardar=false só nos testes
  EdgeRuntime.waitUntil(Promise.resolve(r.posResposta).catch(() => {})); // memória grava depois de responder
  const cfg = await config();
  let fala = paraFala(r.resposta) || "Pronto.";
  const temLink = /https?:\/\//.test(r.resposta);
  if (r.aprovacoes.length) { // pedido que precisa de OK: os botões Aprovar/Negar vão para o Telegram
    await responderTelegram(cfg.dono_telegram_id, { resposta: "📱 Pedido feito pelo iPhone:\n\n" + r.resposta, aprovacoes: r.aprovacoes }).catch((e) => console.error("celular→telegram:", e));
  } else if (temLink) { // links não dá para ouvir: a resposta completa vai para o Telegram
    await telegram("sendMessage", { chat_id: cfg.dono_telegram_id, text: ("📱 Pelo iPhone:\n\n" + r.resposta).slice(0, 4000) }).catch((e) => console.error("celular→telegram:", e));
    fala += " Mandei os links no seu Telegram.";
  }
  return json({ fala: fala.slice(0, 1500), ...(r.celular?.abrir ? { abrir: r.celular.abrir } : {}) }); // sem "abrir" quando não há o que abrir (o "Se" do atalho confere)
}
