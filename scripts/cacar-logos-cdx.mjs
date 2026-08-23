/**
 * Caçada de logos v6 — busca no ÍNDICE do Web Archive (CDX) por arquivos de
 * imagem com "logo" no caminho, dentro dos domínios das marcas que faltam.
 * Não depende da home carregar: procura direto os arquivos já arquivados.
 * Salva até 3 candidatos por marca para inspeção visual.
 *
 * Uso: node scripts/cacar-logos-cdx.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";

const ALVOS = {
  "bruna-tavares": ["lojabrunatavares.com.br", "www.lojabrunatavares.com.br", "brunatavares.com.br"],
  evoly: ["evoly.com.br", "www.evoly.com.br", "evolyprofessional.com.br", "lojaevoly.com.br"],
  melu: ["melubyrubyrose.com.br", "www.melubyrubyrose.com.br", "melu.com.br"],
  rebeel: ["rebeel.com.br", "www.rebeel.com.br", "rebeelprofessional.com.br"],
};

const UA = { "User-Agent": "Mozilla/5.0 (compatible; BeautyNowBot/1.0)" };
const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg", "image/gif": "gif" };

async function cdx(dominio) {
  const url =
    `https://web.archive.org/cdx/search/cdx?url=${dominio}%2F*` +
    `&filter=urlkey:.*logo.*&filter=statuscode:200&collapse=urlkey&output=json&limit=60`;
  try {
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(45_000) });
    if (!r.ok) return [];
    const linhas = await r.json();
    return linhas.slice(1); // primeira linha é o cabeçalho
  } catch {
    return [];
  }
}

async function imagem(url) {
  try {
    const r = await fetch(url, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(45_000) });
    if (!r.ok) return null;
    const tipo = (r.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!tipo.startsWith("image/")) return null;
    const bytes = Buffer.from(await r.arrayBuffer());
    return bytes.length > 800 ? { tipo, bytes } : null;
  } catch {
    return null;
  }
}

mkdirSync("logos-extra", { recursive: true });
const relatorio = {};

for (const [slug, dominios] of Object.entries(ALVOS)) {
  const salvos = [];
  for (const dominio of dominios) {
    const linhas = await cdx(dominio);
    // prioriza imagens com cara de logo do cabeçalho
    const candidatas = linhas
      .filter((l) => /image\//.test(l[3] ?? ""))
      .filter((l) => !/sprite|favicon-16|thumb|banner|selo/i.test(l[2] ?? ""))
      .sort((a, b) => {
        const nota = (l) =>
          (/logo[^/]*\.(svg|png|webp)/i.test(l[2]) ? 2 : 0) + (/header|topo|marca/i.test(l[2]) ? 1 : 0);
        return nota(b) - nota(a);
      })
      .slice(0, 6);
    for (const l of candidatas) {
      const [_, carimbo, original, mime] = l;
      const url = `https://web.archive.org/web/${carimbo}im_/${original}`;
      const img = await imagem(url);
      if (!img) continue;
      const ext = EXT[img.tipo] ?? "png";
      const nome = `logos-extra/cdx-${slug}-${salvos.length + 1}.${ext}`;
      writeFileSync(nome, img.bytes);
      salvos.push({ nome, original, bytes: img.bytes.length });
      if (salvos.length >= 3) break;
    }
    if (salvos.length >= 3) break;
  }
  relatorio[slug] = salvos;
  console.log(`[v6] ${slug}: ${salvos.length} candidatas`);
}

writeFileSync("logos-extra/relatorio-v6.json", JSON.stringify(relatorio, null, 2));
console.log("v6 pronto:", JSON.stringify(Object.fromEntries(Object.entries(relatorio).map(([k, v]) => [k, v.length]))));
