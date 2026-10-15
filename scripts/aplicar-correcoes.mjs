/**
 * Aplica scripts/correcoes-catalogo.json (e as regras de correcoes-catalogo.mjs)
 * no catálogo JÁ gerado (apps/storefront/src/lib/catalogo/dados-hub.json),
 * sem esperar a próxima sincronização com o Hub.
 *
 * Uso: node scripts/aplicar-correcoes.mjs
 *
 * Seguro de rodar mais de uma vez: o que já foi removido não volta, e o que
 * já está limpo continua igual. Para DESFAZER uma correção, apague a entrada
 * do JSON e rode a sincronização (que parte de novo dos dados do Hub).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { aplicarCorrecoes } from "./correcoes-catalogo.mjs";
import { categorizar } from "./categorias-catalogo.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const ARQ = join(RAIZ, "apps/storefront/src/lib/catalogo/dados-hub.json");

const dados = JSON.parse(readFileSync(ARQ, "utf8"));
const antes = dados.produtos.length;

// categoria refeita com a regra atual (scripts/categorias-catalogo.mjs) — a
// sincronização faz o mesmo; as correções por SKU vêm depois e prevalecem
const slug = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const nomeMarca = Object.fromEntries(dados.marcas.map((m) => [m.slug, m.nome]));
const nomeCategoria = Object.fromEntries(dados.categorias.map((c) => [c.slug, c.nome]));
let recategorizados = 0;
for (const p of dados.produtos) {
  const nome = categorizar(p.titulo, nomeMarca[p.marca] ?? p.marca);
  const c = slug(nome);
  nomeCategoria[c] ??= nome;
  if (p.categorias[0] !== c) {
    p.categorias = [c];
    recategorizados++;
  }
}
const { produtos, relatorio } = aplicarCorrecoes(dados.produtos);
dados.produtos = produtos;

// marca/categoria que ficou sem produto sai da navegação
const marcasUsadas = new Set(produtos.map((p) => p.marca));
const categoriasUsadas = new Set(produtos.flatMap((p) => p.categorias));
dados.marcas = dados.marcas.filter((m) => marcasUsadas.has(m.slug));
const existentes = new Set(dados.categorias.map((c) => c.slug));
for (const c of categoriasUsadas) {
  if (!existentes.has(c)) dados.categorias.push({ slug: c, nome: nomeCategoria[c] ?? c, descricao: `Seleção de ${String(nomeCategoria[c] ?? c).toLowerCase()} com curadoria BeautyNow.` });
}
dados.categorias = dados.categorias.filter((c) => categoriasUsadas.has(c.slug));

writeFileSync(ARQ, JSON.stringify(dados));
console.log(`produtos: ${antes} → ${produtos.length} · categorias refeitas: ${recategorizados}`);
console.log(JSON.stringify({ ...relatorio, duplicados: relatorio.duplicados.length }, null, 1));
for (const d of relatorio.duplicados) console.log(`  EAN ${d.ean}: fica ${d.fica}, saem ${d.saem.join(", ")}`);
