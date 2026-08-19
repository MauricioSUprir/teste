"use client";

import { copy } from "@/lib/copy";
import {
  FAIXA_BRINDE_CENTAVOS,
  FRETE_GRATIS_MINIMO_CENTAVOS,
  formatarPreco,
} from "@/lib/preco";

/**
 * Barra de progresso de frete grátis + faixa de brinde — docs/03 §5.
 * Estados: longe, quase, atingido (frete) e brinde por cima.
 */
export function BarraFreteGratis({ subtotalCentavos }: { subtotalCentavos: number }) {
  const pctFrete = Math.min(100, (subtotalCentavos / FRETE_GRATIS_MINIMO_CENTAVOS) * 100);
  const atingiuFrete = subtotalCentavos >= FRETE_GRATIS_MINIMO_CENTAVOS;
  const atingiuBrinde = subtotalCentavos >= FAIXA_BRINDE_CENTAVOS;
  const faltaFrete = FRETE_GRATIS_MINIMO_CENTAVOS - subtotalCentavos;
  const faltaBrinde = FAIXA_BRINDE_CENTAVOS - subtotalCentavos;

  return (
    <div className="rounded-[10px] bg-superficie p-3" aria-live="polite">
      <p className={`text-[0.875rem] font-medium ${atingiuFrete ? "text-sucesso" : "text-tinta"}`}>
        {atingiuFrete
          ? copy.carrinho.freteGratisAtingido
          : copy.carrinho.freteGratisFaltam(formatarPreco(faltaFrete))}
      </p>
      <div
        className="mt-2 h-2 overflow-hidden rounded-[999px] bg-linha"
        role="progressbar"
        aria-valuenow={Math.round(pctFrete)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso para frete grátis"
      >
        <div
          className={`h-full rounded-[999px] transition-[width] duration-300 ${
            atingiuFrete ? "bg-sucesso" : "bg-roxo"
          }`}
          style={{ width: `${pctFrete}%` }}
        />
      </div>
      <p className={`mt-2 text-[0.75rem] ${atingiuBrinde ? "font-medium text-sucesso" : "text-grafite"}`}>
        {atingiuBrinde
          ? `🎁 ${copy.carrinho.brindeAtingido}`
          : copy.carrinho.brindeFaltam(formatarPreco(faltaBrinde))}
      </p>
    </div>
  );
}
