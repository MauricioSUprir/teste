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

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const ARQ = join(RAIZ, "apps/storefront/src/lib/catalogo/dados-hub.json");

const dados = JSON.parse(readFileSync(ARQ, "utf8"));
const antes = dados.produtos.length;
const { produtos, relatorio } = aplicarCorrecoes(dados.produtos);
dados.produtos = produtos;

// marca/categoria que ficou sem produto sai da navegação
const marcasUsadas = new Set(produtos.map((p) => p.marca));
const categoriasUsadas = new Set(produtos.flatMap((p) => p.categorias));
dados.marcas = dados.marcas.filter((m) => marcasUsadas.has(m.slug));
dados.categorias = dados.categorias.filter((c) => categoriasUsadas.has(c.slug));

writeFileSync(ARQ, JSON.stringify(dados));
console.log(`produtos: ${antes} → ${produtos.length}`);
console.log(JSON.stringify({ ...relatorio, duplicados: relatorio.duplicados.length }, null, 1));
for (const d of relatorio.duplicados) console.log(`  EAN ${d.ean}: fica ${d.fica}, saem ${d.saem.join(", ")}`);
