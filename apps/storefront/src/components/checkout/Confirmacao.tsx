"use client";

/**
 * Página de confirmação — ticket 4.9.
 * Com o Mercado Pago ativo, mostra o QR Pix REAL e verifica sozinha quando
 * o pagamento é aprovado. Sem MP, mantém o Pix ilustrativo da demonstração.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { copy } from "@/lib/copy";
import { atualizarStatus } from "@/lib/pedidos";
import { formatarPreco } from "@/lib/preco";
import { statusPagamento } from "@/lib/servidor";

interface UltimoPedido {
  numero: string;
  meio: "pix" | "cartao" | "boleto";
  totalCentavos: number;
  dataPrevista: string;
  email: string;
  pixReal?: {
    paymentId: number | string;
    copiaCola: string | null;
    qrBase64: string | null;
  } | null;
}

// código Pix ilustrativo da demo (o real vem do Mercado Pago)
const CODIGO_PIX_DEMO =
  "00020126580014BR.GOV.BCB.PIX0136beautynow-demo-nao-pagavel520400005303986540510.005802BR5909BEAUTYNOW6014RIO DE JANEIRO62070503***6304ABCD";

export function Confirmacao() {
  const [pedido, setPedido] = useState<UltimoPedido | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [aprovado, setAprovado] = useState(false);

  useEffect(() => {
    try {
      const salvo = sessionStorage.getItem("beautynow:ultimo-pedido");
      if (salvo) setPedido(JSON.parse(salvo) as UltimoPedido);
    } catch {
      // sem pedido salvo
    }
  }, []);

  // Pix real: verifica a aprovação a cada 5s até aprovar (máx. 5 min)
  useEffect(() => {
    const paymentId = pedido?.pixReal?.paymentId;
    if (!paymentId || aprovado) return;
    let tentativas = 0;
    const intervalo = setInterval(async () => {
      tentativas += 1;
      if (tentativas > 60) {
        clearInterval(intervalo);
        return;
      }
      const status = await statusPagamento(paymentId);
      if (status === "approved") {
        setAprovado(true);
        if (pedido) atualizarStatus(pedido.numero, "pago");
        clearInterval(intervalo);
      }
    }, 5000);
    return () => clearInterval(intervalo);
  }, [pedido, aprovado]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(pedido?.pixReal?.copiaCola ?? CODIGO_PIX_DEMO);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // clipboard bloqueado — dá para selecionar manualmente
    }
  }

  const pixReal = pedido?.pixReal ?? null;

  return (
    <div className="container-bn flex flex-col items-center py-16 text-center">
      <span
        aria-hidden="true"
        className="flex h-16 w-16 items-center justify-center rounded-full bg-sucesso text-[1.75rem] text-white"
      >
        ✓
      </span>
      <h1 className="font-titulo mt-5 text-[clamp(1.625rem,3.5vw,2.25rem)] font-semibold">
        {aprovado ? "Pagamento aprovado!" : copy.confirmacao.titulo}
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

      {(!pedido || pedido.meio === "pix") && !aprovado && (
        <div className="mt-8 w-full max-w-md rounded-[16px] border border-linha p-6">
          <h2 className="font-titulo text-[1.125rem] font-semibold">
            {copy.confirmacao.pixTitulo}
          </h2>

          {pixReal?.qrBase64 ? (
            <>
              {/* QR real do Mercado Pago */}
              {/* eslint-disable-next-line @next/next/no-img-element -- imagem base64 gerada pelo Mercado Pago */}
              <img
                src={`data:image/png;base64,${pixReal.qrBase64}`}
                alt="QR Code Pix do seu pedido"
                className="mx-auto mt-4 w-52 rounded-[10px] border border-linha p-2"
              />
              <p className="mt-2 flex items-center justify-center gap-1.5 text-[0.8125rem] text-grafite">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-sucesso" aria-hidden="true" />
                Aguardando pagamento — esta página confirma sozinha quando aprovar
              </p>
            </>
          ) : (
            /* QR ilustrativo da demonstração */
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
          )}

          <button
            type="button"
            onClick={copiar}
            className="mt-4 w-full rounded-[999px] bg-sucesso py-3 text-[0.9375rem] font-semibold text-white hover:opacity-90"
          >
            {copiado ? `✓ ${copy.confirmacao.pixCopiado}` : copy.confirmacao.pixCopiar}
          </button>
        </div>
      )}

      {aprovado && (
        <p className="mt-8 rounded-[16px] bg-[#E7F5EE] px-6 py-4 text-[0.9375rem] font-medium text-sucesso">
          ✓ Pix recebido! Seu pedido já entrou na fila de separação.
        </p>
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
