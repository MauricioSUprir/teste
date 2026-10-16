/**
 * Configuração da loja — o mesmo código serve duas "peles":
 *
 *  - beautynow  (padrão): consumidor final, tema roxo, preço do Hub ×1,7
 *  - be2beauty:           comunicação para o profissional da beleza, tema
 *                         azul-marinho. Desde 16/10 aberta a todos (com ou
 *                         sem CNPJ), preço do Hub ×1,3 e desconto por cupom.
 *
 * Escolhida no build por NEXT_PUBLIC_LOJA=be2beauty. Markup do BeautyNow
 * definido pelo Mauricio em 23/08 após pesquisa de mercado: ×1,4 sobre o
 * preço do Hub (o ×1,7 anterior ficava acima dos concorrentes).
 */

export type LojaId = "beautynow" | "be2beauty" | "pulse" | "bradeco";

export const LOJA_ID: LojaId =
  process.env.NEXT_PUBLIC_LOJA === "be2beauty"
    ? "be2beauty"
    : process.env.NEXT_PUBLIC_LOJA === "pulse"
      ? "pulse"
      : process.env.NEXT_PUBLIC_LOJA === "bradeco"
        ? "bradeco"
        : "beautynow";

interface ConfigLoja {
  id: LojaId;
  nome: string;
  /** multiplicador aplicado sobre o preço do Hub (centavos) ao carregar o catálogo */
  multiplicadorPreco: number;
  /** loja voltada ao profissional (textos, cadastro de CNPJ, FAQ) */
  b2b: boolean;
  /** true = preço e compra só com CNPJ aprovado no admin */
  precoFechado: boolean;
  /** home abre com as linhas profissionais em destaque (lib/catalogo/destaques.ts) */
  vitrineProfissional: boolean;
}

const CONFIGS: Record<LojaId, ConfigLoja> = {
  beautynow: {
    id: "beautynow",
    nome: "BeautyNow",
    multiplicadorPreco: 1.3,
    b2b: false,
    precoFechado: false,
    vitrineProfissional: false,
  },
  // 16/10 (pedido comercial): aberta a todos, inclusive sem CNPJ; preço mais
  // alto (mesmo ×1,3 do BeautyNow) para trabalhar com cupom sem comprometer o
  // valor final; a comunicação continua voltada ao profissional
  be2beauty: {
    id: "be2beauty",
    nome: "Be2Beauty",
    multiplicadorPreco: 1.3,
    b2b: true,
    precoFechado: false,
    vitrineProfissional: true,
  },
  // 3ª loja (12/09): varejo com o mesmo catálogo e preço do BeautyNow,
  // identidade visual própria — formas retas e tipografia display forte
  pulse: {
    id: "pulse",
    nome: "Pulse",
    multiplicadorPreco: 1.3,
    b2b: false,
    precoFechado: false,
    vitrineProfissional: false,
  },
  // 4ª loja (12/09): distribuidora em SP — elo entre indústria e varejo.
  // Igual à Be2Beauty na regra comercial (preço do Hub sem acréscimo, fechado
  // até o CNPJ ser aprovado), com identidade preto/laranja própria.
  bradeco: {
    id: "bradeco",
    nome: "Bradeco",
    multiplicadorPreco: 1,
    b2b: true,
    precoFechado: true,
    vitrineProfissional: false,
  },
};

export const LOJA: ConfigLoja = CONFIGS[LOJA_ID];

/** ajusta um valor em centavos pela política de preço da loja */
export function ajustarPrecoLoja(centavos: number): number {
  return Math.round(centavos * LOJA.multiplicadorPreco);
}
