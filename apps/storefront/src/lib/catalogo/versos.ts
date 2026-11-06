/**
 * Fotos do VERSO dos produtos, para o "Ver no seu espaço" (o produto em 3D).
 * O Hub só tem fotos da frente; sem foto do verso, o 3D mostra o verso liso,
 * nas cores do produto.
 *
 * Para cadastrar: foto do verso de frente, no fundo branco, com o produto
 * inteiro e em pé (do mesmo jeito da foto da frente do Hub). Guardar em
 * public/fotos-produtos/versos/<sku>.jpg e acrescentar a linha aqui:
 *   "777": "/fotos-produtos/versos/777.jpg",
 * A chave é o SKU do Hub.
 */
export const FOTOS_VERSO: Record<string, string> = {};
