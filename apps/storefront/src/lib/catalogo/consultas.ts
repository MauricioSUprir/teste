/**
 * Consultas sobre o catálogo.
 *
 * Fonte dos dados: se `dados-hub.json` estiver preenchido (gerado por
 * `scripts/sincronizar-catalogo.mjs` a partir da API do Hub Suprir), o site
 * usa o catálogo real; caso contrário, usa o seed de demonstração.
 */
import {
  categorias as categoriasDemo,
  marcas as marcasDemo,
  necessidades as necessidadesDemo,
  produtos as produtosDemo,
} from "./dados";
import dadosHub from "./dados-hub.json";
import { aplicarAjustesProduto, lerAjustes, obterProdutoLocal } from "./ajustes";
import { normalizar as normalizarBusca, pesquisar, type FonteBusca, type ResultadoBusca } from "./busca";
import { LOJA, ajustarPrecoLoja } from "@/lib/loja";
import { comBase } from "@/lib/caminho";
import type { Categoria, CategoriaSlug, Marca, Necessidade, Produto } from "./tipos";

interface CatalogoHub {
  origem: string;
  atualizadoEm: string | null;
  /** prefixo das fotos, guardado uma vez em vez de repetido em cada URL */
  baseImagem?: string;
  categorias: Categoria[];
  marcas: Marca[];
  produtos: Produto[];
}

/**
 * O catálogo vai inteiro para o navegador de quem visita o site, então ele é
 * gravado enxuto: as fotos guardam só o número e o `visual` (o desenho de
 * frasco usado quando não há foto) não é repetido produto a produto, já que
 * era sempre igual. Aqui os dois voltam ao formato que o resto do site espera.
 * A ponta que grava é `compactar()`, em scripts/sincronizar-catalogo.mjs.
 */
const CORES_DESENHO = {
  beautynow: { corA: "#4A2882", corB: "#B9A6E8" },
  be2beauty: { corA: "#13315C", corB: "#9DBCE3" },
  pulse: { corA: "#7A3A1B", corB: "#E3B79E" },
  bradeco: { corA: "#8F4205", corB: "#F2C29C" },
} as const;
// cada build é de uma loja só: o desenho sai na cor dela
const VISUAL_PADRAO = { ...CORES_DESENHO[LOJA.id], forma: "frasco" } as const;

function expandirCatalogo(catalogo: CatalogoHub) {
  const base = catalogo.baseImagem;
  if (!base) return; // catálogo antigo, já vem por extenso
  // número = foto do Hub; "/fotos-produtos/…" = foto guardada no próprio site
  const inteiro = (u: string) => (/^\d+$/.test(u) ? `${base}${u}` : u.startsWith("/") ? comBase(u) : u);
  for (const p of catalogo.produtos) {
    if (p.imagens?.length) p.imagens = p.imagens.map(inteiro);
    p.visual ??= { ...VISUAL_PADRAO };
  }
  for (const m of catalogo.marcas) {
    if (m.imagem) m.imagem = inteiro(m.imagem);
  }
}

const hub = dadosHub as unknown as CatalogoHub;
const usaHub = hub.produtos.length > 0;
if (usaHub) expandirCatalogo(hub);

// dados-hub.json guarda o preço do Hub (tabela profissional). A política de
// preço de cada loja entra AQUI, num ponto único: BeautyNow ×1,7 e
// Be2Beauty ×1 (regra do Mauricio, 22/08). Tudo rio abaixo (PLP, PDP,
// carrinho, checkout, Mercado Pago) já enxerga o valor ajustado.
if (LOJA.multiplicadorPreco !== 1) {
  for (const p of hub.produtos) {
    for (const v of p.variantes) {
      v.precoPor = ajustarPrecoLoja(v.precoPor);
      if (v.precoDe != null) v.precoDe = ajustarPrecoLoja(v.precoDe);
    }
  }
}

export const catalogoReal = usaHub;
// o JSON traz a descrição no molde "Seleção de X com curadoria BeautyNow." —
// a mesma frase em toda categoria, com o nome de outra loja. Aqui vira uma
// linha curta e sem jargão, com o nome certo da casa
const categorias: Categoria[] = (usaHub ? hub.categorias : categoriasDemo).map((c) => ({
  ...c,
  descricao: c.descricao
    .replace(/^Seleção de (.+) com curadoria BeautyNow\.$/i, "Nossa seleção de $1.")
    .replace(/curadoria BeautyNow/g, `curadoria ${LOJA.nome}`),
}));
// mesma história das marcas: "Produtos X com garantia de originalidade
// BeautyNow." repetido marca a marca, e com o nome de outra loja
const marcas: Marca[] = (usaHub ? hub.marcas : marcasDemo).map((m) => ({
  ...m,
  descricao: m.descricao?.replace(
    /^Produtos (.+) com garantia de originalidade BeautyNow\.$/i,
    "Produtos $1 originais, direto do fabricante."
  ),
}));
const produtos: Produto[] = usaHub ? hub.produtos : produtosDemo;
// necessidades são curadoria editorial — o Hub não as fornece
const necessidades: Necessidade[] = usaHub ? [] : necessidadesDemo;

export function obterProduto(slug: string): Produto | undefined {
  const base = produtos.find((p) => p.slug === slug);
  // no navegador, aplica os ajustes manuais do admin (edição/exclusão/locais);
  // no build estático (window indefinido), devolve sempre o catálogo base
  if (typeof window === "undefined") return base;
  if (base) return aplicarAjustesProduto(base) ?? undefined;
  return obterProdutoLocal(slug);
}

export function obterMarca(slug: string): Marca | undefined {
  return marcas.find((m) => m.slug === slug);
}

export function obterCategoria(slug: string) {
  return categorias.find((c) => c.slug === slug);
}

export function obterNecessidade(slug: string) {
  return necessidades.find((n) => n.slug === slug);
}

export function produtosPorCategoria(slug: CategoriaSlug): Produto[] {
  return produtos.filter((p) => p.categorias.includes(slug));
}

export function produtosPorMarca(slug: string): Produto[] {
  return produtos.filter((p) => p.marca === slug);
}

export function produtosPorNecessidade(slug: string): Produto[] {
  return produtos.filter((p) => p.atributos.necessidade?.includes(slug));
}

export function maisVendidos(): Produto[] {
  return produtos.filter((p) => p.maisVendido);
}

export function lancamentos(): Produto[] {
  return produtos.filter((p) => p.lancamento);
}

export function mesmaLinha(produto: Produto): Produto[] {
  if (!produto.linha) return [];
  return produtos.filter(
    (p) => p.slug !== produto.slug && p.marca === produto.marca && p.linha === produto.linha
  );
}

export function relacionados(produto: Produto): Produto[] {
  return produtos
    .filter((p) => p.slug !== produto.slug && p.categorias.some((c) => produto.categorias.includes(c)))
    .slice(0, 4);
}

export function notaMedia(produto: Produto): { media: number; total: number } {
  const total = produto.avaliacoes.length;
  if (total === 0) return { media: 0, total: 0 };
  const soma = produto.avaliacoes.reduce((acc, a) => acc + a.nota, 0);
  return { media: Math.round((soma / total) * 10) / 10, total };
}

export function temEstoque(produto: Produto): boolean {
  return produto.variantes.some((v) => v.estoque > 0);
}

export function menorPreco(produto: Produto): number {
  return Math.min(...produto.variantes.map((v) => v.precoPor));
}

const fonteBusca: FonteBusca = {
  nomeMarca: (slug) => marcas.find((m) => m.slug === slug)?.nome ?? slug,
  nomeCategoria: (slug) => categorias.find((c) => c.slug === slug)?.nome ?? slug,
};

/** produtos da busca: os do catálogo com as edições do admin, mais os criados no admin */
function universoBusca(): Produto[] {
  // busca roda só no cliente — inclui produtos locais e aplica edições/exclusões
  if (typeof window === "undefined") return produtos;
  return [
    ...lerAjustes().adicionados,
    ...produtos.map((p) => aplicarAjustesProduto(p)).filter((p): p is Produto => p !== null),
  ];
}

/** busca com o aviso de "só parecidos" (lib/catalogo/busca.ts explica as regras) */
export function buscarDetalhado(termo: string): ResultadoBusca {
  return pesquisar(universoBusca(), termo, fonteBusca);
}

export function buscar(termo: string): Produto[] {
  return buscarDetalhado(termo).produtos;
}

/**
 * Marcas e categorias que combinam com o que está sendo digitado — atalhos no
 * topo das sugestões da busca ("wid" → Widi Care).
 */
export function atalhosDaBusca(termo: string): { tipo: "marca" | "categoria"; nome: string; href: string }[] {
  const t = normalizarBusca(termo).trim();
  if (t.length < 2) return [];
  const compacto = t.replace(/[^a-z0-9]/g, "");
  const casa = (nome: string, slug: string) => {
    const n = normalizarBusca(nome);
    const junto = n.replace(/[^a-z0-9]/g, "");
    return junto.startsWith(compacto) || n.split(/[^a-z0-9]+/).some((p) => p.length > 1 && p.startsWith(t)) || slug.startsWith(t);
  };
  return [
    ...marcas.filter((m) => casa(m.nome, m.slug)).map((m) => ({ tipo: "marca" as const, nome: m.nome, href: `/marca/${m.slug}` })),
    ...categorias.filter((c) => casa(c.nome, c.slug)).map((c) => ({ tipo: "categoria" as const, nome: c.nome, href: `/categoria/${c.slug}` })),
  ].slice(0, 3);
}

export { categorias, marcas, necessidades, produtos };
