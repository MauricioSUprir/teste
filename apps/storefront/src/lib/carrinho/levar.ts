/**
 * Sacola que chega de fora (o caixa do Beauty Shopping manda para /levar).
 *
 * O link traz só QUAIS produtos e QUANTOS: ?itens=slug:2,outro-slug:1
 * Preço, estoque e variação saem sempre do catálogo deste site — um link
 * mexido não muda o valor de nada.
 */
export const MAX_ITENS_LEVAR = 40;
export const MAX_QTD_LEVAR = 20;

const SLUG = /^[a-z0-9][a-z0-9-]{0,159}$/;

export interface ItemLevar {
  slug: string;
  quantidade: number;
}

/** lê ?itens=… ignorando o que não tem cara de produto; repetidos somam */
export function lerItensLevar(valor: string | null): ItemLevar[] {
  if (!valor) return [];
  const porSlug = new Map<string, number>();
  for (const parte of valor.split(",").slice(0, MAX_ITENS_LEVAR)) {
    const [slug, qtd] = parte.trim().split(":");
    if (!slug || !SLUG.test(slug)) continue;
    const n = Number.parseInt(qtd ?? "1", 10);
    if (!Number.isFinite(n) || n < 1) continue;
    porSlug.set(slug, Math.min(MAX_QTD_LEVAR, (porSlug.get(slug) ?? 0) + n));
  }
  return [...porSlug].map(([slug, quantidade]) => ({ slug, quantidade }));
}
