/**
 * Estoque ao vivo: o catálogo publicado traz o estoque do dia em que o site
 * foi gerado; por cima dele vale o retrato que o servidor refaz no Hub a
 * cada 2 h (GET /catalogo/estoque). Aplicado em todo produto do navegador
 * (aplicarAjustesProduto), então página do produto, listas, sacola e
 * checkout enxergam o mesmo número. SKU fora do retrato (produto criado no
 * painel) fica com o estoque do catálogo.
 *
 * Fica guardado no navegador para valer já na próxima página, antes de o
 * servidor responder.
 */
import type { Produto } from "./tipos";

const CHAVE = "bn:estoque-vivo:v1";
/** retrato mais velho que isto não vale (o servidor parou de atualizar) */
const VALIDADE_MS = 12 * 3600_000;
/** retrato com menos SKUs que isto veio pela metade: ignora */
const MIN_SKUS = 900;

export interface RetratoEstoque {
  atualizadoEm: string | null;
  total: number;
  porSku: Record<string, number>;
}

let porSku: Record<string, number> | null = null;

function valido(r: RetratoEstoque | null): r is RetratoEstoque {
  return (
    !!r &&
    !!r.atualizadoEm &&
    typeof r.porSku === "object" &&
    Object.keys(r.porSku).length >= MIN_SKUS &&
    Date.now() - new Date(r.atualizadoEm).getTime() < VALIDADE_MS
  );
}

if (typeof window !== "undefined") {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) ?? "null") as RetratoEstoque | null;
    if (valido(salvo)) porSku = salvo.porSku;
  } catch {
    // sem armazenamento: espera o servidor
  }
}

/** guarda o retrato que veio do servidor; true se mudou algo */
export function definirEstoqueVivo(r: RetratoEstoque): boolean {
  if (!valido(r)) return false;
  const mudou = JSON.stringify(r.porSku) !== JSON.stringify(porSku);
  porSku = r.porSku;
  try {
    localStorage.setItem(CHAVE, JSON.stringify(r));
  } catch {
    // vale só nesta página
  }
  return mudou;
}

/** o produto com o estoque do retrato (sem retrato, o do catálogo) */
export function comEstoqueVivo(produto: Produto): Produto {
  const mapa = porSku;
  if (!mapa || !produto.variantes.some((v) => v.sku in mapa)) return produto;
  return {
    ...produto,
    variantes: produto.variantes.map((v) => (v.sku in mapa ? { ...v, estoque: mapa[v.sku] } : v)),
  };
}
