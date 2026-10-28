/**
 * Produtos das lojas do shopping. Nesta prévia vêm de src/dados/catalogo.json
 * (gerado do catálogo do Hub por scripts/gerar-catalogo.mjs); quando cada
 * lojista tiver o seu cadastro, a mesma forma chega pelo servidor.
 *
 * Preço sempre em centavos (inteiro); texto de dinheiro só na hora de mostrar.
 */
import dados from "./catalogo.json";
import { fichaDoProduto, type Ficha } from "./ficha";

export interface Produto {
  id: string;
  titulo: string;
  marca: string;
  categorias: string[];
  descricao: string;
  /** centavos */
  preco: number;
  precoDe: number | null;
  /** id da foto no Hub ou endereço completo */
  foto: string;
  atributos: Record<string, unknown>;
  especificacoes: Record<string, string>;
}

interface Catalogo {
  atualizadoEm: string;
  baseImagem: string;
  marcas: Record<string, { nome: string; cor: string }>;
  lojas: Record<string, Produto[]>;
}

const catalogo = dados as unknown as Catalogo;

export const DESCONTO_PIX_PCT = 5;
export const MAX_PARCELAS = 6;
export const PARCELA_MINIMA = 3000;

export function produtosDaLoja(id: string): Produto[] {
  return catalogo.lojas[id] ?? [];
}

/** todos os produtos do catálogo de demonstração (para as lojas montadas na prévia) */
export function todosProdutos(): Produto[] {
  const vistos = new Set<string>();
  return Object.values(catalogo.lojas)
    .flat()
    .filter((p) => (vistos.has(p.id) ? false : (vistos.add(p.id), true)));
}

export function nomeMarca(slug: string): string {
  return catalogo.marcas[slug]?.nome ?? slug;
}

/** número = foto do Hub; "/fotos-produtos/…" = foto guardada junto com o shopping (public/) */
export function fotoDe(p: Produto): string {
  if (/^\d+$/.test(p.foto)) return `${catalogo.baseImagem}${p.foto}`;
  return p.foto.startsWith("/") ? `.${p.foto}` : p.foto;
}

const fichas = new Map<string, Ficha>();
export function fichaDe(p: Produto): Ficha {
  let f = fichas.get(p.id);
  if (!f) {
    f = fichaDoProduto({ titulo: p.titulo, descricao: p.descricao, categorias: p.categorias, atributos: p.atributos as never, especificacoes: p.especificacoes });
    fichas.set(p.id, f);
  }
  return f;
}

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const formatarPreco = (centavos: number) => fmt.format(centavos / 100);
export const precoPix = (centavos: number) => Math.round((centavos * (100 - DESCONTO_PIX_PCT)) / 100);
export function parcelamento(centavos: number) {
  const vezes = Math.max(1, Math.min(MAX_PARCELAS, Math.floor(centavos / PARCELA_MINIMA)));
  return { vezes, valor: Math.ceil(centavos / vezes) };
}
export function descontoPct(p: Produto): number | null {
  return p.precoDe && p.precoDe > p.preco ? Math.round((1 - p.preco / p.precoDe) * 100) : null;
}
