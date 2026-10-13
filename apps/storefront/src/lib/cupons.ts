/**
 * Cupons de desconto — docs/04 §5.
 * O admin cria no painel e eles ficam no servidor, valendo em qualquer
 * aparelho. Ordem de aplicação das regras comerciais:
 * desconto de produto → cupom → desconto Pix (sempre por último).
 */

export interface Cupom {
  codigo: string; // sempre em maiúsculas
  tipo: "percentual" | "valor";
  /** percentual (ex.: 10) ou valor em centavos (ex.: 1500 = R$ 15) */
  valor: number;
  minimoCentavos: number;
  ativo: boolean;
}

/** cupom que todo visitante já tem — também anunciado na faixa do topo */
export const CUPOM_BOAS_VINDAS: Cupom = {
  codigo: "BEMVINDA10",
  tipo: "percentual",
  valor: 10,
  minimoCentavos: 9900,
  ativo: true,
};

export function normalizarCodigo(codigo: string): string {
  return codigo.trim().toUpperCase().replace(/\s+/g, "");
}

export function calcularDesconto(cupom: Cupom, subtotalCentavos: number): number {
  const desconto =
    cupom.tipo === "percentual"
      ? Math.round(subtotalCentavos * (cupom.valor / 100))
      : cupom.valor;
  return Math.min(desconto, subtotalCentavos);
}

const reais = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Regras que dependem do carrinho (por enquanto, o valor mínimo). */
export function conferirRegrasCupom(cupom: Cupom, subtotalCentavos: number): { ok: boolean; erro?: string } {
  if (!cupom.ativo) return { ok: false, erro: "Cupom não encontrado ou expirado. Confira o código." };
  if (subtotalCentavos < cupom.minimoCentavos) {
    return {
      ok: false,
      erro: `Este cupom vale para compras a partir de ${reais(cupom.minimoCentavos)} — faltam ${reais(cupom.minimoCentavos - subtotalCentavos)}.`,
    };
  }
  return { ok: true };
}

/**
 * Procura o cupom no servidor — é lá que ficam os cupons criados no painel,
 * valendo para qualquer aparelho. Antes eles ficavam só no navegador de quem
 * criou, e o cliente recebia "cupom não encontrado". Com o servidor fora do
 * ar, só o cupom de boas-vindas (fixo no site) é aceito.
 */
export async function buscarCupom(codigo: string): Promise<{ ok: boolean; cupom?: Cupom; erro?: string }> {
  const normalizado = normalizarCodigo(codigo);
  if (!normalizado) return { ok: false, erro: "Digite o código do cupom." };
  const { buscarCupomServidor } = await import("./servidor");
  const resposta = await buscarCupomServidor(normalizado);
  if (resposta && resposta !== "inexistente") return { ok: true, cupom: resposta };
  if (resposta === null && normalizado === CUPOM_BOAS_VINDAS.codigo) return { ok: true, cupom: CUPOM_BOAS_VINDAS };
  if (resposta === null) {
    return { ok: false, erro: "Não consegui conferir o cupom agora. Aguarde uns segundos e tente de novo." };
  }
  return { ok: false, erro: "Cupom não encontrado ou expirado. Confira o código." };
}
