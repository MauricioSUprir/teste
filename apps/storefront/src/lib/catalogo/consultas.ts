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
import { LOJA, ajustarPrecoLoja } from "@/lib/loja";
import type { Categoria, CategoriaSlug, Marca, Necessidade, Produto } from "./tipos";

interface CatalogoHub {
  origem: string;
  atualizadoEm: string | null;
  categorias: Categoria[];
  marcas: Marca[];
  produtos: Produto[];
}

const hub = dadosHub as unknown as CatalogoHub;
const usaHub = hub.produtos.length > 0;

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
const categorias: Categoria[] = usaHub ? hub.categorias : categoriasDemo;
const marcas: Marca[] = usaHub ? hub.marcas : marcasDemo;
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

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Sinônimos PT-BR — docs/04 §8 */
const sinonimos: Record<string, string[]> = {
  xampu: ["shampoo"],
  shampoo: ["xampu"],
  capilar: ["cabelo"],
  cabelo: ["capilar"],
  "filtro solar": ["protetor solar"],
  fps: ["protetor solar"],
  labial: ["batom"],
  cacho: ["cacheado"],
  crespo: ["cacheado"],
  hialuronico: ["acido hialuronico"],
};

export function buscar(termo: string): Produto[] {
  const t = normalizar(termo.trim());
  if (!t) return [];
  const termos = [t, ...(sinonimos[t] ?? [])];
  const marcaPorSlug = new Map(marcas.map((m) => [m.slug, normalizar(m.nome)]));
  // busca roda só no cliente — inclui produtos locais e aplica edições/exclusões
  const universo =
    typeof window === "undefined"
      ? produtos
      : [
          ...lerAjustes().adicionados,
          ...produtos
            .map((p) => aplicarAjustesProduto(p))
            .filter((p): p is Produto => p !== null),
        ];
  return universo
    .map((p) => {
      const alvos = [
        normalizar(p.titulo),
        marcaPorSlug.get(p.marca) ?? "",
        normalizar(p.linha ?? ""),
        normalizar(p.descricao),
        p.categorias.join(" "),
        Object.values(p.atributos).flat().join(" "),
      ];
      let pontos = 0;
      for (const termoBusca of termos) {
        if (alvos[0].includes(termoBusca)) pontos += 10;
        if (alvos[1].includes(termoBusca)) pontos += 6;
        if (alvos[2].includes(termoBusca)) pontos += 4;
        if (alvos.slice(3).some((a) => normalizar(String(a)).includes(termoBusca))) pontos += 2;
      }
      return { p, pontos };
    })
    .filter((r) => r.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos)
    .map((r) => r.p);
}

export { categorias, marcas, necessidades, produtos };
