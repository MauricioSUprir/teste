"use client";

/** Aba Pedidos — lista com filtro por status, mudança de status e exportação CSV. */
import { useMemo, useState } from "react";
import type { Pedido, StatusPedido } from "@/lib/pedidos";
import { formatarPreco } from "@/lib/preco";

const rotuloStatus: Record<StatusPedido, string> = {
  aguardando_pagamento: "Aguardando pagamento",
  pago: "Pago",
  cancelado: "Cancelado",
};

const corStatus: Record<StatusPedido, string> = {
  aguardando_pagamento: "bg-violeta-claro text-violeta",
  pago: "bg-[#E7F5EE] text-sucesso",
  cancelado: "bg-roxo-claro text-erro",
};

type Filtro = "todos" | StatusPedido;

export function AbaPedidos({
  pedidos,
  aoMudarStatus,
}: {
  pedidos: Pedido[];
  aoMudarStatus: (numero: string, status: StatusPedido) => void;
}) {
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const filtrados = useMemo(
    () => (filtro === "todos" ? pedidos : pedidos.filter((p) => p.status === filtro)),
    [pedidos, filtro]
  );

  function exportarCsv() {
    const linhas = [
      ["pedido", "data", "cliente", "email", "itens", "pagamento", "cupom", "total_reais", "status"],
      ...filtrados.map((p) => [
        p.numero,
        new Date(p.data).toLocaleString("pt-BR"),
        p.clienteNome,
        p.clienteEmail,
        p.itens.map((i) => `${i.quantidade}x ${i.titulo}`).join(" | "),
        p.meio,
        p.cupom ?? "",
        (p.totalCentavos / 100).toFixed(2).replace(".", ","),
        rotuloStatus[p.status],
      ]),
    ];
    const csv = linhas
      .map((linha) => linha.map((celula) => `"${String(celula).replaceAll('"', '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pedidos-beautynow-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filtrar por status" className="flex flex-wrap gap-1.5">
          {(
            [
              ["todos", "Todos"],
              ["aguardando_pagamento", "Aguardando"],
              ["pago", "Pagos"],
              ["cancelado", "Cancelados"],
            ] as const
          ).map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              aria-pressed={filtro === id}
              onClick={() => setFiltro(id)}
              className={`min-h-[38px] rounded-[999px] px-4 text-[0.8125rem] font-medium transition-colors ${
                filtro === id
                  ? "bg-roxo text-white"
                  : "border border-linha text-grafite hover:border-roxo hover:text-roxo"
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={exportarCsv}
          disabled={filtrados.length === 0}
          className="min-h-[38px] rounded-[999px] border border-linha px-4 text-[0.8125rem] font-medium text-grafite hover:bg-superficie disabled:opacity-40"
        >
          ⬇ Exportar CSV
        </button>
      </div>

      {filtrados.length === 0 ? (
        <p className="mt-4 rounded-[10px] bg-superficie px-5 py-8 text-center text-[0.875rem] leading-relaxed text-grafite">
          {pedidos.length === 0
            ? "Nenhum pedido registrado neste navegador ainda. Com o servidor conectado ao Hub Suprir, esta lista mostra os pedidos reais de todos os clientes."
            : "Nenhum pedido com esse status."}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-[10px] border border-linha">
          <table className="w-full min-w-[760px] text-[0.875rem]">
            <thead>
              <tr className="bg-superficie text-left text-[0.75rem] uppercase tracking-wide text-cinza">
                <th className="px-4 py-2.5 font-semibold">Pedido</th>
                <th className="px-4 py-2.5 font-semibold">Data</th>
                <th className="px-4 py-2.5 font-semibold">Cliente</th>
                <th className="px-4 py-2.5 font-semibold">Itens</th>
                <th className="px-4 py-2.5 font-semibold">Pagamento</th>
                <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => (
                <tr key={p.numero} className="border-t border-linha align-top">
                  <td className="num px-4 py-3 font-semibold text-tinta">{p.numero}</td>
                  <td className="num px-4 py-3 text-grafite">
                    {new Date(p.data).toLocaleDateString("pt-BR")}{" "}
                    <span className="text-cinza">
                      {new Date(p.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="block text-tinta">{p.clienteNome}</span>
                    <span className="block text-[0.75rem] text-cinza">{p.clienteEmail}</span>
                  </td>
                  <td className="px-4 py-3 text-grafite">
                    {p.itens.map((i) => (
                      <span key={i.sku} className="block">
                        {i.quantidade}× {i.titulo}
                      </span>
                    ))}
                  </td>
                  <td className="px-4 py-3 text-grafite">
                    {p.meio === "pix" ? "Pix" : p.meio === "cartao" ? "Cartão" : "Boleto"}
                    {p.cupom && (
                      <span className="num mt-1 block rounded-[6px] bg-violeta-claro px-1.5 py-0.5 text-[0.6875rem] font-semibold text-violeta">
                        {p.cupom}
                      </span>
                    )}
                  </td>
                  <td className="num px-4 py-3 text-right font-semibold">{formatarPreco(p.totalCentavos)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-[999px] px-2.5 py-1 text-[0.6875rem] font-semibold ${corStatus[p.status]}`}>
                      {rotuloStatus[p.status]}
                    </span>
                    {p.status === "aguardando_pagamento" && (
                      <span className="mt-1.5 flex gap-2 text-[0.75rem]">
                        <button type="button" onClick={() => aoMudarStatus(p.numero, "pago")} className="text-sucesso underline">
                          Marcar pago
                        </button>
                        <button type="button" onClick={() => aoMudarStatus(p.numero, "cancelado")} className="text-erro underline">
                          Cancelar
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
