#!/usr/bin/env node
/**
 * Sincroniza o catálogo do Hub Suprir → apps/storefront/src/lib/catalogo/dados-hub.json
 *
 * Uso:
 *   HUB_API_KEY=sk_live_... node scripts/sincronizar-catalogo.mjs
 *
 * A chave NUNCA vai para o repositório: fica só na variável de ambiente do
 * build. As fotos usam as URLs públicas do Hub (nada é baixado).
 * Depois de rodar, refaça o build do storefront para publicar.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SAIDA = join(RAIZ, "apps/storefront/src/lib/catalogo/dados-hub.json");
const BRUTO = join(RAIZ, "scripts/.cache/catalogo-bruto.json"); // gitignored — para depurar mapeamento

const URL_BASE = process.env.HUB_API_URL ?? "https://comercial.thebeautyhub.app/api/loja";
const CHAVE = process.env.HUB_API_KEY;
if (!CHAVE) {
  console.error("Defina HUB_API_KEY no ambiente (a chave não fica em código).");
  process.exit(1);
}

async function api(caminho) {
  const resposta = await fetch(`${URL_BASE}${caminho}`, {
    headers: { "X-API-Key": CHAVE },
  });
  if (!resposta.ok) {
    throw new Error(`${caminho} → HTTP ${resposta.status}: ${(await resposta.text()).slice(0, 300)}`);
  }
  return resposta.json();
}

/** primeiro valor definido entre vários nomes de campo possíveis */
const campo = (obj, ...nomes) => {
  for (const n of nomes) {
    const v = n.split(".").reduce((acc, parte) => (acc == null ? acc : acc[parte]), obj);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
};

const slugificar = (texto) =>
  String(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";

/** preço em reais (number|string "12,90") → centavos int; já-em-centavos int grande passa direto */
function centavos(v) {
  if (v === undefined) return undefined;
  if (typeof v === "string") v = Number(v.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(v)) return undefined;
  // heurística: valores inteiros ≥ 1000 sem casa decimal provavelmente já são centavos
  if (Number.isInteger(v) && v >= 1000 && v % 1 !== 0.0) return v;
  return Math.round(v * 100);
}

function listaImagens(bruto) {
  const v = campo(bruto, "imagens", "fotos", "images", "galeria");
  if (Array.isArray(v)) {
    return v.map((i) => (typeof i === "string" ? i : campo(i, "url", "src", "imagem"))).filter(Boolean);
  }
  const unica = campo(bruto, "imagem", "imagem_url", "foto", "image", "url_imagem", "thumbnail");
  return unica ? [unica] : [];
}

const paletaFallback = ["#7C3AED", "#0EA5A4", "#E8467C", "#2B4C7E", "#DC2626", "#B8730C", "#0891B2"];

function mapearProduto(bruto, detalhe, slugsUsados) {
  const titulo = campo(bruto, "nome", "titulo", "descricao_curta", "name") ?? "Produto";
  const sku = String(campo(bruto, "sku", "codigo", "id") ?? slugificar(titulo));
  let slug = slugificar(`${campo(bruto, "marca.nome", "marca") ?? ""} ${titulo}`);
  while (slugsUsados.has(slug)) slug = `${slug}-${sku.toLowerCase()}`;
  slugsUsados.add(slug);

  const marcaNome = String(campo(bruto, "marca.nome", "marca", "brand") ?? "BeautyNow");
  const categoriaNome = String(campo(bruto, "categoria.nome", "categoria", "category") ?? "Geral");
  const precoPor = centavos(campo(bruto, "preco", "preco_venda", "valor", "price")) ?? 0;
  const precoDe = centavos(campo(bruto, "preco_de", "preco_cheio", "preco_original"));
  const estoque = Number(campo(bruto, "estoque", "quantidade", "stock", "disponivel") ?? 0);
  const d = detalhe ?? bruto;

  return {
    slug,
    titulo: String(titulo),
    marca: slugificar(marcaNome),
    linha: campo(bruto, "linha") ? String(campo(bruto, "linha")) : undefined,
    categorias: [slugificar(categoriaNome)],
    descricao: String(campo(d, "descricao", "descricao_completa", "description") ?? ""),
    beneficios: [],
    modoDeUso: (() => {
      const v = campo(d, "modo_de_uso", "como_usar");
      return v ? [String(v)] : [];
    })(),
    composicao: String(campo(d, "composicao", "ingredientes") ?? ""),
    especificacoes: (() => {
      const e = {};
      const volume = campo(bruto, "volume", "conteudo", "tamanho");
      const ean = campo(bruto, "ean", "codigo_barras", "gtin");
      if (volume) e["Volume"] = String(volume);
      if (ean) e["EAN"] = String(ean);
      e["SKU"] = sku;
      return e;
    })(),
    atributos: {},
    variantes: [
      {
        sku,
        tituloVariacao: String(campo(bruto, "volume", "conteudo", "variacao") ?? "Único"),
        precoDe: precoDe && precoDe > precoPor ? precoDe : null,
        precoPor,
        estoque: Number.isFinite(estoque) ? estoque : 0,
        pesoG: Number(campo(bruto, "peso_g", "peso") ?? 300),
      },
    ],
    avaliacoes: [],
    imagens: listaImagens(bruto).concat(detalhe ? listaImagens(detalhe).filter((u) => !listaImagens(bruto).includes(u)) : []),
    visual: { corA: "#4A2882", corB: "#B9A6E8", forma: "frasco" },
    _marcaNome: marcaNome,
    _categoriaNome: categoriaNome,
  };
}

async function principal() {
  console.log(`Sincronizando de ${URL_BASE} …`);

  // 1. paginação completa da lista
  const brutos = [];
  let pagina = 1;
  for (;;) {
    const lote = await api(`/produtos?pagina=${pagina}&por_pagina=100`);
    const itens = Array.isArray(lote) ? lote : (lote.produtos ?? lote.dados ?? lote.data ?? lote.items ?? []);
    if (!itens.length) break;
    brutos.push(...itens);
    console.log(`  página ${pagina}: +${itens.length} (total ${brutos.length})`);
    const totalPaginas = campo(lote, "total_paginas", "totalPages", "meta.total_paginas", "meta.last_page");
    if (totalPaginas && pagina >= Number(totalPaginas)) break;
    if (itens.length < 100) break;
    pagina++;
  }

  // 2. ficha completa (descrição) com concorrência limitada
  console.log("Buscando fichas completas…");
  const detalhes = new Map();
  const skus = brutos.map((b) => campo(b, "sku", "codigo", "id")).filter(Boolean);
  let feitos = 0;
  const CONCORRENCIA = 8;
  for (let i = 0; i < skus.length; i += CONCORRENCIA) {
    await Promise.all(
      skus.slice(i, i + CONCORRENCIA).map(async (sku) => {
        try {
          detalhes.set(String(sku), await api(`/produtos/${encodeURIComponent(sku)}`));
        } catch {
          // ficha indisponível — segue com os dados da listagem
        }
      })
    );
    feitos = Math.min(i + CONCORRENCIA, skus.length);
    if (feitos % 200 < CONCORRENCIA) console.log(`  fichas: ${feitos}/${skus.length}`);
  }

  // 3. mapeamento
  const slugsUsados = new Set();
  const produtos = brutos.map((b) =>
    mapearProduto(b, detalhes.get(String(campo(b, "sku", "codigo", "id"))), slugsUsados)
  );

  // marcas e categorias derivadas dos produtos
  const marcasMapa = new Map();
  const categoriasMapa = new Map();
  for (const p of produtos) {
    if (!marcasMapa.has(p.marca)) {
      marcasMapa.set(p.marca, {
        slug: p.marca,
        nome: p._marcaNome,
        cor: paletaFallback[marcasMapa.size % paletaFallback.length],
        descricao: `Produtos ${p._marcaNome} com garantia de originalidade BeautyNow.`,
      });
    }
    const catSlug = p.categorias[0];
    if (!categoriasMapa.has(catSlug)) {
      categoriasMapa.set(catSlug, {
        slug: catSlug,
        nome: p._categoriaNome,
        descricao: `Seleção de ${p._categoriaNome.toLowerCase()} com curadoria BeautyNow.`,
      });
    }
    delete p._marcaNome;
    delete p._categoriaNome;
  }

  mkdirSync(dirname(BRUTO), { recursive: true });
  writeFileSync(BRUTO, JSON.stringify({ brutos, detalhes: [...detalhes.entries()] }, null, 1));

  const saida = {
    origem: URL_BASE,
    atualizadoEm: new Date().toISOString(),
    categorias: [...categoriasMapa.values()],
    marcas: [...marcasMapa.values()],
    produtos,
  };
  writeFileSync(SAIDA, JSON.stringify(saida));
  console.log(
    `OK: ${produtos.length} produtos, ${marcasMapa.size} marcas, ${categoriasMapa.size} categorias → dados-hub.json`
  );
  console.log("Agora rode o build do storefront para publicar o catálogo real.");
}

principal().catch((erro) => {
  console.error("Falha na sincronização:", erro.message);
  process.exit(1);
});
