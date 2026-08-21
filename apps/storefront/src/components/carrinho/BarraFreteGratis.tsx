"use client";

import { copy } from "@/lib/copy";
import { FAIXA_BRINDE_CENTAVOS, formatarPreco } from "@/lib/preco";

/**
 * Barra de progresso da faixa de brinde — docs/03 §5.
 * (A mecânica de frete grátis por valor foi removida a pedido do Mauricio.)
 */
export function BarraFreteGratis({ subtotalCentavos }: { subtotalCentavos: number }) {
  const pct = Math.min(100, (subtotalCentavos / FAIXA_BRINDE_CENTAVOS) * 100);
  const atingiuBrinde = subtotalCentavos >= FAIXA_BRINDE_CENTAVOS;
  const faltaBrinde = FAIXA_BRINDE_CENTAVOS - subtotalCentavos;

  return (
    <div className="rounded-[10px] bg-superficie p-3" aria-live="polite">
      <p className={`text-[0.875rem] font-medium ${atingiuBrinde ? "text-sucesso" : "text-tinta"}`}>
        {atingiuBrinde
          ? `🎁 ${copy.carrinho.brindeAtingido}`
          : copy.carrinho.brindeFaltam(formatarPreco(faltaBrinde))}
      </p>
      <div
        className="mt-2 h-2 overflow-hidden rounded-[999px] bg-linha"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso para ganhar o brinde"
      >
        <div
          className={`h-full rounded-[999px] transition-[width] duration-300 ${
            atingiuBrinde ? "bg-sucesso" : "bg-roxo"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
