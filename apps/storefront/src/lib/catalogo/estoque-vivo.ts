/**
 * Estoque ao vivo: o catálogo publicado traz o estoque do dia em que o site
 * foi gerado; por cima dele vale o retrato que o servidor refaz no Hub a
 * cada 2 h (GET /catalogo/estoque). Aplicado em todo produto do navegador
 * (aplicarAjustesProduto), então página do produto, listas, sacola e
 * checkout enxergam o mesmo número.
 *
 * O Hub só lista o que tem estoque: produto do catálogo do Hub que não veio
 * no retrato esgotou (ou saiu do Hub) e fica zerado. SKU que não é do Hub
 * (produto criado no painel) fica com o estoque do catálogo.
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
/** SKUs do catálogo publicado que vieram do Hub (lib/catalogo/consultas registra) */
let skusDoHub: Set<string> = new Set();

export function registrarSkusDoHub(skus: Iterable<string>) {
  skusDoHub = new Set(skus);
}

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

/** estoque de um SKU pelo retrato; undefined = sem retrato ou SKU fora do Hub (vale o do catálogo) */
function estoqueDoRetrato(mapa: Record<string, number>, sku: string): number | undefined {
  if (Object.hasOwn(mapa, sku)) return mapa[sku];
  return skusDoHub.has(sku) ? 0 : undefined;
}

/** o produto com o estoque do retrato (sem retrato, o do catálogo) */
export function comEstoqueVivo(produto: Produto): Produto {
  const mapa = porSku;
  if (!mapa) return produto;
  let mudou = false;
  const variantes = produto.variantes.map((v) => {
    const n = estoqueDoRetrato(mapa, v.sku);
    if (n === undefined || n === v.estoque) return v;
    mudou = true;
    return { ...v, estoque: n };
  });
  return mudou ? { ...produto, variantes } : produto;
}
