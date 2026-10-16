#!/usr/bin/env node
/**
 * Roda a busca do site no terminal, com o catálogo atual:
 *   node --experimental-strip-types scripts/buscar.mjs "shampoo widi" ["outra busca" …]
 * Mostra quantos resultados e os 10 primeiros (marca · categoria · nome).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pesquisar } from "../apps/storefront/src/lib/catalogo/busca.ts";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const hub = JSON.parse(readFileSync(join(RAIZ, "apps/storefront/src/lib/catalogo/dados-hub.json"), "utf8"));
const nomeMarca = Object.fromEntries(hub.marcas.map((m) => [m.slug, m.nome]));
const nomeCategoria = Object.fromEntries(hub.categorias.map((c) => [c.slug, c.nome]));
const fonte = { nomeMarca: (s) => nomeMarca[s] ?? s, nomeCategoria: (s) => nomeCategoria[s] ?? s };

for (const termo of process.argv.slice(2)) {
  const r = pesquisar(hub.produtos, termo, fonte);
  console.log(`\n"${termo}": ${r.produtos.length} resultado(s)${r.aproximado ? " (só parecidos)" : ""}`);
  for (const p of r.produtos.slice(0, 10)) {
    const est = p.variantes.some((v) => v.estoque > 0) ? "" : " [sem estoque]";
    console.log(`  ${nomeMarca[p.marca] ?? p.marca} · ${p.categorias[0]} · ${p.titulo}${est}`);
  }
}
