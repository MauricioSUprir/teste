/**
 * Caçada de logos v3 — roda NO RUNNER do GitHub (internet aberta).
 * Para cada marca que ainda falta, abre a home do site oficial e procura a
 * logo do cabeçalho: og:image, <img> com "logo" no src/alt/class e ícones
 * de alta resolução. Salva o melhor achado em logos-extra/{slug}.{ext}.
 *
 * Uso: node scripts/buscar-logos-extra.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";

const ALVOS = {
  arvensis: ["arvensis.com.br", "www.arvensis.com.br", "loja.arvensis.com.br"],
  "bruna-tavares": ["lojabrunatavares.com.br", "www.lojabrunatavares.com.br", "btbeauty.com.br"],
  evoly: ["evoly.com.br", "www.evoly.com.br", "evolyprofessional.com.br", "lojaevoly.com.br"],
  melu: ["melubyrubyrose.com.br", "www.melubyrubyrose.com.br", "rubyrose.com.br"],
  rebeel: ["rebeel.com.br", "www.rebeel.com.br", "rebeelprofessional.com.br"],
};

// candidatos extras que não dependem do site da marca (avatar oficial de rede
// social via unavatar) — inspecionar visualmente antes de usar, pode vir foto
const AVATARES = {
  arvensis: ["https://unavatar.io/instagram/arvensisoficial", "https://unavatar.io/arvensis.com.br"],
  "bruna-tavares": ["https://unavatar.io/instagram/lojabrunatavares", "https://unavatar.io/lojabrunatavares.com.br"],
  evoly: ["https://unavatar.io/instagram/evolyprofessional", "https://unavatar.io/evoly.com.br"],
  melu: ["https://unavatar.io/instagram/melubyrubyrose", "https://unavatar.io/melubyrubyrose.com.br"],
  rebeel: ["https://unavatar.io/instagram/rebeelprofessional", "https://unavatar.io/rebeel.com.br"],
};

const UA = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,image/avif,image/webp,image/*,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.6",
};

const EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/gif": "gif",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
};

async function baixarImagem(url) {
  try {
    const r = await fetch(url, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(20_000) });
    if (!r.ok) return null;
    const tipo = (r.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!tipo.startsWith("image/")) return null;
    const bytes = Buffer.from(await r.arrayBuffer());
    if (bytes.length < 500) return null; // degenerado
    return { tipo, bytes };
  } catch {
    return null;
  }
}

function resolver(href, dominio) {
  if (!href) return null;
  href = href.trim().replace(/&amp;/g, "&");
  if (href.startsWith("data:")) return null;
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  return `https://${dominio}${href.startsWith("/") ? "" : "/"}${href}`;
}

function candidatosDoHtml(html, dominio) {
  const c = [];
  // og:image costuma ser a marca em destaque
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (og) c.push(resolver(og[1], dominio));
  // <img> com cara de logo (só no primeiro terço da página — cabeçalho)
  const topo = html.slice(0, Math.floor(html.length / 3));
  for (const m of topo.matchAll(/<img[^>]+>/gi)) {
    const tag = m[0];
    if (!/logo/i.test(tag)) continue;
    const src =
      tag.match(/(?:data-src|data-original|srcset|src)=["']([^"'\s]+)/i)?.[1] ?? null;
    const u = resolver(src, dominio);
    if (u) c.push(u);
  }
  // ícones de alta resolução declarados
  for (const m of html.matchAll(/<link[^>]+rel=["'][^"']*(?:apple-touch|icon)[^"']*["'][^>]*>/gi)) {
    const href = m[0].match(/href=["']([^"']+)["']/i)?.[1];
    const u = resolver(href, dominio);
    if (u) c.push(u);
  }
  c.push(`https://${dominio}/apple-touch-icon.png`);
  return [...new Set(c.filter(Boolean))];
}

mkdirSync("logos-extra", { recursive: true });
const achados = {};
const falhas = [];

for (const [slug, dominios] of Object.entries(ALVOS)) {
  let ok = false;
  for (const dominio of dominios) {
    let html = "";
    try {
      const r = await fetch(`https://${dominio}/`, {
        headers: UA,
        redirect: "follow",
        signal: AbortSignal.timeout(25_000),
      });
      if (!r.ok) continue;
      html = (await r.text()).slice(0, 400_000);
    } catch {
      continue;
    }
    for (const url of candidatosDoHtml(html, dominio).slice(0, 8)) {
      const img = await baixarImagem(url);
      if (!img) continue;
      const ext = EXT[img.tipo] ?? "png";
      writeFileSync(`logos-extra/${slug}.${ext}`, img.bytes);
      achados[slug] = { dominio, url, tipo: img.tipo, bytes: img.bytes.length };
      ok = true;
      break;
    }
    if (ok) break;
  }
  // plano B: avatar oficial (salvo à parte para inspeção visual — pode vir foto)
  if (!ok) {
    for (const url of AVATARES[slug] ?? []) {
      const img = await baixarImagem(url);
      if (!img) continue;
      const ext = EXT[img.tipo] ?? "png";
      writeFileSync(`logos-extra/avatar-${slug}.${ext}`, img.bytes);
      achados[slug] = { dominio: "unavatar", url, tipo: img.tipo, bytes: img.bytes.length, avatar: true };
      ok = true;
      break;
    }
  }
  if (!ok) falhas.push(slug);
  console.log(`[logos-extra] ${slug}: ${ok ? "ok (" + achados[slug].url + ")" : "FALHOU"}`);
}

writeFileSync("logos-extra/relatorio.json", JSON.stringify({ achados, falhas }, null, 2));
console.log("total ok:", Object.keys(achados).length, "| falhas:", JSON.stringify(falhas));
