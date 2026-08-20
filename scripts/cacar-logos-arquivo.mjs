/**
 * Caçada de logos v5 — Web Archive (archive.org). Sites com anti-robô
 * bloqueiam acesso direto, mas o arquivo histórico da internet guarda
 * cópias das páginas E das imagens, e serve tudo sem bloqueio.
 *
 * Uso: node scripts/cacar-logos-arquivo.mjs
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";

const ALVOS = {
  arvensis: ["arvensis.com.br", "www.arvensis.com.br"],
  "bruna-tavares": ["lojabrunatavares.com.br", "www.lojabrunatavares.com.br"],
  evoly: ["evoly.com.br", "www.evoly.com.br", "evolyprofessional.com.br"],
  melu: ["melubyrubyrose.com.br", "www.melubyrubyrose.com.br"],
  rebeel: ["rebeel.com.br", "www.rebeel.com.br"],
};

const UA = { "User-Agent": "Mozilla/5.0 (compatible; BeautyNowBot/1.0)" };
const EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/gif": "gif",
};

async function json(url) {
  try {
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30_000) });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

async function texto(url) {
  try {
    const r = await fetch(url, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(45_000) });
    return r.ok ? await r.text() : null;
  } catch {
    return null;
  }
}

async function imagem(url) {
  try {
    const r = await fetch(url, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(45_000) });
    if (!r.ok) return null;
    const tipo = (r.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!tipo.startsWith("image/")) return null;
    const bytes = Buffer.from(await r.arrayBuffer());
    return bytes.length > 600 ? { tipo, bytes } : null;
  } catch {
    return null;
  }
}

// candidatos de logo no HTML arquivado (URLs já vêm reescritas para /web/...)
function candidatos(html) {
  const c = [];
  const topo = html.slice(0, Math.floor(html.length / 2));
  for (const m of topo.matchAll(/<img[^>]+>/gi)) {
    const tag = m[0];
    if (!/logo/i.test(tag)) continue;
    const src = tag.match(/(?:data-src|src)=["']([^"'\s]+)/i)?.[1];
    if (src) c.push(src);
  }
  const og = topo.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (og) c.push(og[1]);
  return [...new Set(c)].slice(0, 6);
}

function absolutaDoArchive(href) {
  if (!href) return null;
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("/web/")) return `https://web.archive.org${href}`;
  return null;
}

mkdirSync("logos-extra", { recursive: true });
const achados = {};
const falhas = [];

for (const [slug, dominios] of Object.entries(ALVOS)) {
  let ok = false;
  for (const dominio of dominios) {
    const disp = await json(`https://archive.org/wayback/available?url=${dominio}`);
    const snapshot = disp?.archived_snapshots?.closest?.url;
    if (!snapshot) continue;
    const html = await texto(snapshot.replace(/^http:/, "https:"));
    if (!html) continue;
    for (const bruto of candidatos(html)) {
      // "im_" força o archive a servir a imagem original, sem moldura
      const url = absolutaDoArchive(bruto)?.replace(/\/web\/(\d+)\//, "/web/$1im_/");
      if (!url) continue;
      const img = await imagem(url);
      if (!img) continue;
      const ext = EXT[img.tipo] ?? "png";
      writeFileSync(`logos-extra/arquivo-${slug}.${ext}`, img.bytes);
      achados[slug] = { dominio, snapshot, url, tipo: img.tipo, bytes: img.bytes.length };
      ok = true;
      break;
    }
    if (ok) break;
  }
  if (!ok) falhas.push(slug);
  console.log(`[v5] ${slug}: ${ok ? "ok (" + achados[slug].url + ")" : "FALHOU"}`);
}

writeFileSync("logos-extra/relatorio-v5.json", JSON.stringify({ achados, falhas }, null, 2));
console.log("v5 total ok:", Object.keys(achados).length, "| falhas:", JSON.stringify(falhas));
