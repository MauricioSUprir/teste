/**
 * Confere se a FOTO de cada produto bate com o NOME — roda no runner do
 * GitHub (que alcança o Hub). Baixa miniaturas de uma amostra de produtos
 * de várias marcas e salva em imagens-check/ para inspeção visual.
 *
 * Uso: node scripts/conferir-imagens.mjs
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";

const dados = JSON.parse(
  readFileSync("apps/storefront/src/lib/catalogo/dados-hub.json", "utf8")
);

// amostra: 2 produtos por marca (o 1º e um do meio)
const porMarca = new Map();
for (const p of dados.produtos) {
  const lista = porMarca.get(p.marca) ?? [];
  lista.push(p);
  porMarca.set(p.marca, lista);
}

mkdirSync("imagens-check", { recursive: true });
const relatorio = [];
let n = 0;

for (const [marca, lista] of porMarca) {
  const amostra = [lista[0], lista[Math.floor(lista.length / 2)]].filter(
    (p, i, a) => p && a.indexOf(p) === i
  );
  for (const p of amostra) {
    const url = p.imagens?.[0];
    if (!url) {
      relatorio.push({ marca, titulo: p.titulo, imagem: "SEM IMAGEM" });
      continue;
    }
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const bytes = Buffer.from(await r.arrayBuffer());
      const nome = `imagens-check/${String(n).padStart(2, "0")}-${marca}.jpg`;
      writeFileSync(nome, bytes);
      relatorio.push({ marca, titulo: p.titulo.slice(0, 70), arquivo: nome, bytes: bytes.length });
      n += 1;
    } catch (erro) {
      relatorio.push({ marca, titulo: p.titulo.slice(0, 70), erro: erro.message });
    }
  }
}

writeFileSync("imagens-check/relatorio.json", JSON.stringify(relatorio, null, 2));
console.log("miniaturas salvas:", n);
