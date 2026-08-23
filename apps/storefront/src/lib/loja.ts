/**
 * Configuração da loja — o mesmo código serve duas "peles":
 *
 *  - beautynow  (padrão): consumidor final, tema roxo, preço do Hub ×1,7
 *  - be2beauty:           venda profissional (B2B), tema azul-marinho,
 *                         preço do Hub sem acréscimo e FECHADO até o
 *                         cadastro com CNPJ ser aprovado no admin.
 *
 * Escolhida no build por NEXT_PUBLIC_LOJA=be2beauty. Markup do BeautyNow
 * definido pelo Mauricio em 23/08 após pesquisa de mercado: ×1,4 sobre o
 * preço do Hub (o ×1,7 anterior ficava acima dos concorrentes).
 */

export type LojaId = "beautynow" | "be2beauty";

export const LOJA_ID: LojaId =
  process.env.NEXT_PUBLIC_LOJA === "be2beauty" ? "be2beauty" : "beautynow";

interface ConfigLoja {
  id: LojaId;
  nome: string;
  /** multiplicador aplicado sobre o preço do Hub (centavos) ao carregar o catálogo */
  multiplicadorPreco: number;
  /** true = catálogo aberto mas preço/compra só com CNPJ aprovado */
  b2b: boolean;
}

const CONFIGS: Record<LojaId, ConfigLoja> = {
  beautynow: {
    id: "beautynow",
    nome: "BeautyNow",
    multiplicadorPreco: 1.3,
    b2b: false,
  },
  be2beauty: {
    id: "be2beauty",
    nome: "Be2Beauty",
    multiplicadorPreco: 1,
    b2b: true,
  },
};

export const LOJA: ConfigLoja = CONFIGS[LOJA_ID];

/** ajusta um valor em centavos pela política de preço da loja */
export function ajustarPrecoLoja(centavos: number): number {
  return Math.round(centavos * LOJA.multiplicadorPreco);
}
