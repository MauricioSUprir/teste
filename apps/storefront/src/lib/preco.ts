/**
 * Regras de preço — CLAUDE.md: preços sempre em centavos (inteiro).
 * Formatação apenas na borda de apresentação.
 */

export const DESCONTO_PIX_PCT = 5;
export const MAX_PARCELAS = 6;
export const PARCELA_MINIMA_CENTAVOS = 3000; // R$ 30,00
export const FRETE_GRATIS_MINIMO_CENTAVOS = 19900; // R$ 199,00
// pedido mínimo desligado a pedido do Mauricio (20/08) — qualquer valor finaliza
export const PEDIDO_MINIMO_CENTAVOS = 0;
export const FAIXA_BRINDE_CENTAVOS = 25000; // R$ 250,00

export function formatarPreco(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function precoPix(centavos: number): number {
  return Math.round(centavos * (1 - DESCONTO_PIX_PCT / 100));
}

export function parcelamento(centavos: number): { vezes: number; valor: number } {
  let vezes = Math.min(MAX_PARCELAS, Math.floor(centavos / PARCELA_MINIMA_CENTAVOS));
  if (vezes < 1) vezes = 1;
  return { vezes, valor: Math.round(centavos / vezes) };
}

export function percentualDesconto(precoDe: number, precoPor: number): number {
  return Math.round(((precoDe - precoPor) / precoDe) * 100);
}
