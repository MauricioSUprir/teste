/**
 * Tipos do catálogo — espelham docs/04-modelo-de-dados.md.
 * Hoje alimentados por dados de demonstração (src/lib/catalogo/dados.ts);
 * na integração real, a mesma interface é servida pelo Medusa v2 (réplica do Bling).
 */

/**
 * Slug de categoria. Com o catálogo do Hub Suprir importado, as categorias
 * são dinâmicas (vêm do sistema); os slugs do seed de demonstração seguem
 * válidos como fallback.
 */
export type CategoriaSlug = string;

export interface Categoria {
  slug: CategoriaSlug;
  nome: string;
  descricao: string;
}

export interface Marca {
  slug: string;
  nome: string;
  descricao: string;
  /** cor de identidade usada nos placeholders de imagem */
  cor: string;
  /** foto real que representa a marca (produto dela no Hub ou logo oficial) */
  imagem?: string;
}

export interface Necessidade {
  slug: string;
  nome: string;
}

/** Atributos facetados — subconjunto da taxonomia de docs/04 §2 */
export interface AtributosProduto {
  tipoCabelo?: string[];
  necessidade?: string[];
  tipoPele?: string[];
  ativo?: string[];
  semSulfato?: boolean;
  semSilicone?: boolean;
  vegano?: boolean;
  crueltyFree?: boolean;
  fps?: number;
}

export interface Variante {
  sku: string;
  tituloVariacao: string; // ex.: "300ml"
  /** preços SEMPRE em centavos — CLAUDE.md §4 */
  precoDe: number | null;
  precoPor: number;
  estoque: number;
  pesoG: number;
}

export interface Avaliacao {
  nota: 1 | 2 | 3 | 4 | 5;
  titulo: string;
  texto: string;
  autor: string;
  data: string; // ISO
  compraVerificada: boolean;
}

export interface Produto {
  slug: string;
  titulo: string;
  marca: string; // slug da marca
  linha?: string;
  categorias: CategoriaSlug[];
  descricao: string;
  beneficios: string[];
  modoDeUso: string[];
  composicao: string;
  especificacoes: Record<string, string>;
  atributos: AtributosProduto;
  variantes: Variante[];
  avaliacoes: Avaliacao[];
  /** slugs de produtos para o bloco "compre junto" */
  compreJunto?: string[];
  maisVendido?: boolean;
  lancamento?: boolean;
  /** URLs públicas das fotos reais (catálogo do Hub Suprir) */
  imagens?: string[];
  /** produto criado manualmente no painel admin (vive no navegador) */
  local?: boolean;
  /** semente visual do placeholder — usada quando não há foto real */
  visual: { corA: string; corB: string; forma: "frasco" | "pote" | "tubo" | "spray" | "ampola" };
}
