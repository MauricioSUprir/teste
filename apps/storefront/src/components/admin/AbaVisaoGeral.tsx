"use client";

/** Aba Visão geral — KPIs, gráfico de receita e resumos escritos por período. */
import { useState } from "react";
import {
  agregarPorFaixa,
  porFormaPagamento,
  resumoDoPeriodo,
  topProdutos,
  type Periodo,
} from "@/lib/analise";
import type { Pedido } from "@/lib/pedidos";
import { formatarPreco } from "@/lib/preco";

const periodos: { id: Periodo; rotulo: string; tituloGrafico: string; nomeFalado: string; comparativo: string; semBase: string }[] = [
  { id: "dia", rotulo: "Hoje", tituloGrafico: "Receita por hora — hoje", nomeFalado: "hoje", comparativo: "em relação a ontem", semBase: "Ontem não houve vendas para comparar." },
  { id: "semana", rotulo: "7 dias", tituloGrafico: "Receita por dia — últimos 7 dias", nomeFalado: "nos últimos 7 dias", comparativo: "em relação aos 7 dias anteriores", semBase: "Nos 7 dias anteriores não houve vendas para comparar." },
  { id: "mes", rotulo: "30 dias", tituloGrafico: "Receita por dia — últimos 30 dias", nomeFalado: "nos últimos 30 dias", comparativo: "em relação aos 30 dias anteriores", semBase: "Nos 30 dias anteriores não houve vendas para comparar." },
  { id: "ano", rotulo: "12 meses", tituloGrafico: "Receita por mês — últimos 12 meses", nomeFalado: "nos últimos 12 meses", comparativo: "em relação aos 12 meses anteriores", semBase: "Nos 12 meses anteriores não houve vendas para comparar." },
];

import { GraficoBarras, BarrasRanqueadas } from "./GraficoBarras";

export function AbaVisaoGeral({ pedidos }: { pedidos: Pedido[] }) {
  const [periodo, setPeriodo] = useState<Periodo>("semana");
  const config = periodos.find((p) => p.id === periodo)!;

  const resumo = resumoDoPeriodo(pedidos, periodo);
  const faixas = agregarPorFaixa(pedidos, periodo);
  const top = topProdutos(pedidos, periodo);
  const formas = porFormaPagamento(pedidos, periodo);

  return (
    <div>
      {/* seletor de período — uma linha, acima dos gráficos */}
      <div role="group" aria-label="Período de análise" className="flex flex-wrap gap-1.5">
        {periodos.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={periodo === p.id}
            onClick={() => setPeriodo(p.id)}
            className={`min-h-[38px] rounded-[999px] px-4 text-[0.8125rem] font-medium transition-colors ${
              periodo === p.id
                ? "bg-roxo text-white"
                : "border border-linha text-grafite hover:border-roxo hover:text-roxo"
            }`}
          >
            {p.rotulo}
          </button>
        ))}
      </div>

      {/* KPIs com comparativo */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CartaoKpi valor={formatarPreco(resumo.totalCentavos)} rotulo="receita" variacao={resumo.variacaoReceitaPct} />
        <CartaoKpi valor={String(resumo.qtdPedidos)} rotulo="pedidos" variacao={resumo.variacaoPedidosPct} />
        <CartaoKpi valor={formatarPreco(resumo.ticketMedioCentavos)} rotulo="ticket médio" />
        <CartaoKpi valor={`${resumo.pctPix}%`} rotulo="pedidos via Pix" />
      </div>

      {/* resumo escrito */}
      <p className="mt-4 rounded-[10px] bg-superficie px-4 py-3 text-[0.875rem] leading-relaxed text-grafite">
        {resumo.qtdPedidos === 0 ? (
          <>Nenhuma venda {config.nomeFalado}. Assim que os pedidos entrarem, o resumo e os gráficos ganham vida aqui.</>
        ) : (
          <>
            Você vendeu <strong className="num text-tinta">{formatarPreco(resumo.totalCentavos)}</strong> {config.nomeFalado},
            em <strong className="num text-tinta">{resumo.qtdPedidos === 1 ? "1 pedido" : `${resumo.qtdPedidos} pedidos`}</strong>{" "}
            (ticket médio de <strong className="num text-tinta">{formatarPreco(resumo.ticketMedioCentavos)}</strong>).{" "}
            {resumo.variacaoReceitaPct !== null ? (
              resumo.variacaoReceitaPct >= 0 ? (
                <>A receita cresceu <strong className="text-sucesso">{resumo.variacaoReceitaPct}%</strong> {config.comparativo}.</>
              ) : (
                <>A receita caiu <strong className="text-erro">{Math.abs(resumo.variacaoReceitaPct)}%</strong> {config.comparativo}.</>
              )
            ) : (
              <>{config.semBase}</>
            )}{" "}
            {resumo.pctPix > 0 && <>O Pix respondeu por {resumo.pctPix}% dos pedidos.</>}
          </>
        )}
      </p>

      {/* gráfico principal */}
      <section className="mt-5 rounded-[16px] border border-linha bg-white p-5">
        <h3 className="text-[0.9375rem] font-semibold text-tinta">{config.tituloGrafico}</h3>
        <div className="mt-3">
          <GraficoBarras faixas={faixas} titulo={config.tituloGrafico} />
        </div>
      </section>

      {/* rankings */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className="rounded-[16px] border border-linha bg-white p-5">
          <h3 className="text-[0.9375rem] font-semibold text-tinta">Produtos mais vendidos</h3>
          <div className="mt-4">
            <BarrasRanqueadas itens={top} formatoQtd={(q) => (q === 1 ? "1 un." : `${q} un.`)} />
          </div>
        </section>
        <section className="rounded-[16px] border border-linha bg-white p-5">
          <h3 className="text-[0.9375rem] font-semibold text-tinta">Receita por forma de pagamento</h3>
          <div className="mt-4">
            <BarrasRanqueadas itens={formas} formatoQtd={(q) => (q === 1 ? "1 pedido" : `${q} pedidos`)} />
          </div>
        </section>
      </div>
    </div>
  );
}

function CartaoKpi({ valor, rotulo, variacao }: { valor: string; rotulo: string; variacao?: number | null }) {
  return (
    <div className="rounded-[16px] border border-linha bg-white p-4">
      <p className="num text-[1.375rem] font-bold leading-none text-tinta">{valor}</p>
      <p className="mt-1 flex items-center gap-2 text-[0.8125rem] text-grafite">
        {rotulo}
        {variacao !== undefined && variacao !== null && (
          <span
            className={`num inline-flex items-center gap-0.5 rounded-[999px] px-1.5 py-0.5 text-[0.6875rem] font-semibold ${
              variacao >= 0 ? "bg-[#E7F5EE] text-sucesso" : "bg-roxo-claro text-erro"
            }`}
          >
            <span aria-hidden="true">{variacao >= 0 ? "▲" : "▼"}</span>
            {Math.abs(variacao)}%
            <span className="sr-only">{variacao >= 0 ? "de crescimento" : "de queda"} vs. período anterior</span>
          </span>
        )}
      </p>
    </div>
  );
}
