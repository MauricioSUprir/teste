"use client";

/** Página de confirmação com Pix copia-e-cola — ticket 4.9. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { copy } from "@/lib/copy";
import { formatarPreco } from "@/lib/preco";

interface UltimoPedido {
  numero: string;
  meio: "pix" | "cartao" | "boleto";
  totalCentavos: number;
  dataPrevista: string;
  email: string;
}

// código Pix ilustrativo da demo (payload EMV real vem do Mercado Pago)
const CODIGO_PIX_DEMO =
  "00020126580014BR.GOV.BCB.PIX0136beautynow-demo-nao-pagavel520400005303986540510.005802BR5909BEAUTYNOW6014RIO DE JANEIRO62070503***6304ABCD";

export function Confirmacao() {
  const [pedido, setPedido] = useState<UltimoPedido | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    try {
      const salvo = sessionStorage.getItem("beautynow:ultimo-pedido");
      if (salvo) setPedido(JSON.parse(salvo) as UltimoPedido);
    } catch {
      // sem pedido salvo
    }
  }, []);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(CODIGO_PIX_DEMO);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // clipboard bloqueado — usuária pode selecionar manualmente
    }
  }

  return (
    <div className="container-bn flex flex-col items-center py-16 text-center">
      <span
        aria-hidden="true"
        className="flex h-16 w-16 items-center justify-center rounded-full bg-sucesso text-[1.75rem] text-white"
      >
        ✓
      </span>
      <h1 className="font-titulo mt-5 text-[clamp(1.625rem,3.5vw,2.25rem)] font-semibold">
        {copy.confirmacao.titulo}
      </h1>
      <p className="mt-2 max-w-[52ch] text-[0.9375rem] text-grafite">
        {copy.confirmacao.subtitulo(pedido?.numero ?? "—")}
      </p>

      {pedido && (
        <dl className="mt-6 flex flex-wrap justify-center gap-x-8 gap-y-2 text-[0.9375rem]">
          <div>
            <dt className="text-[0.75rem] uppercase tracking-wide text-cinza">Total</dt>
            <dd className="num font-semibold">{formatarPreco(pedido.totalCentavos)}</dd>
          </div>
          <div>
            <dt className="text-[0.75rem] uppercase tracking-wide text-cinza">
              {copy.confirmacao.prazo}
            </dt>
            <dd className="num font-semibold">até {pedido.dataPrevista}</dd>
          </div>
        </dl>
      )}

      {(!pedido || pedido.meio === "pix") && (
        <div className="mt-8 w-full max-w-md rounded-[16px] border border-linha p-6">
          <h2 className="font-titulo text-[1.125rem] font-semibold">
            {copy.confirmacao.pixTitulo}
          </h2>
          {/* QR ilustrativo */}
          <svg
            viewBox="0 0 84 84"
            aria-label="QR Code Pix de demonstração"
            className="mx-auto mt-4 w-40 rounded-[10px] border border-linha p-2"
          >
            {Array.from({ length: 21 }, (_, y) =>
              Array.from({ length: 21 }, (_, x) => {
                const semente = (x * 31 + y * 17 + x * y) % 7;
                const borda = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
                const pintar = borda
                  ? (x % 6 === 0 || y % 6 === 0 || (x % 6 > 1 && x % 6 < 5 && y % 6 > 1 && y % 6 < 5))
                  : semente < 3;
                return pintar ? (
                  <rect key={`${x}-${y}`} x={x * 4} y={y * 4} width="4" height="4" fill="#14161A" />
                ) : null;
              })
            )}
          </svg>
          <button
            type="button"
            onClick={copiar}
            className="mt-4 w-full rounded-[999px] bg-sucesso py-3 text-[0.9375rem] font-semibold text-white hover:opacity-90"
          >
            {copiado ? `✓ ${copy.confirmacao.pixCopiado}` : copy.confirmacao.pixCopiar}
          </button>
        </div>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/conta"
          className="rounded-[999px] border-2 border-tinta px-6 py-3 text-[0.9375rem] font-semibold text-tinta hover:bg-superficie"
        >
          {copy.confirmacao.acompanhar}
        </Link>
        <Link
          href="/"
          className="rounded-[999px] bg-roxo px-6 py-3 text-[0.9375rem] font-semibold text-white hover:bg-roxo-escuro"
        >
          {copy.checkout.voltarLoja}
        </Link>
      </div>
    </div>
  );
}
