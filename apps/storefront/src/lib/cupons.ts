/**
 * Cupons de desconto — docs/04 §5.
 * Na demo ficam no navegador (o admin cria no painel); com o servidor no ar,
 * passam a ser centralizados. Ordem de aplicação das regras comerciais:
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

const CHAVE = "beautynow:cupons:v1";

const seedInicial: Cupom[] = [
  { codigo: "BEMVINDA10", tipo: "percentual", valor: 10, minimoCentavos: 9900, ativo: true },
];

export function lerCupons(): Cupom[] {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto === null) {
      localStorage.setItem(CHAVE, JSON.stringify(seedInicial));
      return seedInicial;
    }
    return JSON.parse(bruto) as Cupom[];
  } catch {
    return seedInicial;
  }
}

export function gravarCupons(cupons: Cupom[]) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(cupons));
  } catch {
    // storage indisponível
  }
}

export function calcularDesconto(cupom: Cupom, subtotalCentavos: number): number {
  const desconto =
    cupom.tipo === "percentual"
      ? Math.round(subtotalCentavos * (cupom.valor / 100))
      : cupom.valor;
  return Math.min(desconto, subtotalCentavos);
}

export function validarCupom(
  codigo: string,
  subtotalCentavos: number
): { ok: boolean; cupom?: Cupom; erro?: string } {
  const normalizado = codigo.trim().toUpperCase();
  if (!normalizado) return { ok: false, erro: "Digite o código do cupom." };
  const cupom = lerCupons().find((c) => c.codigo === normalizado);
  if (!cupom || !cupom.ativo) {
    return { ok: false, erro: "Cupom não encontrado ou expirado. Confira o código." };
  }
  if (subtotalCentavos < cupom.minimoCentavos) {
    const falta = ((cupom.minimoCentavos - subtotalCentavos) / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    return { ok: false, erro: `Este cupom vale para compras a partir de ${(cupom.minimoCentavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} — faltam ${falta}.` };
  }
  return { ok: true, cupom };
}
