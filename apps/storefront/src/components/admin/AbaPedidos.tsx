"use client";

/**
 * Aba Pedidos — lista vinda do servidor (todos os clientes, com endereço e
 * contato completos). Clicar num pedido abre o detalhe: valor, itens,
 * localização de entrega, CPF, telefone, frete, cupom e afiliado.
 * Sem servidor (demo), mostra os pedidos registrados neste navegador.
 */
import { useEffect, useMemo, useState } from "react";
import type { Pedido, StatusPedido } from "@/lib/pedidos";
import { formatarPreco } from "@/lib/preco";
import {
  listarPedidosAdmin,
  mudarStatusPedidoAdmin,
  servidorConfigurado,
  type PedidoAdmin,
} from "@/lib/servidor";
import { LOJA_ID } from "@/lib/loja";

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

interface Linha extends PedidoAdmin {
  origem: "servidor" | "local";
}

function deLocal(p: Pedido): Linha {
  return {
    ...p,
    loja: LOJA_ID,
    cpf: "",
    telefone: "",
    endereco: null,
    itens: p.itens,
    cupom: p.cupom ?? null,
    descontoCentavos: p.descontoCentavos ?? 0,
    afiliado: null,
    origem: "local",
  };
}

export function AbaPedidos({
  pedidos,
  aoMudarStatus,
}: {
  pedidos: Pedido[];
  aoMudarStatus: (numero: string, status: StatusPedido) => void;
}) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [servidor, setServidor] = useState<PedidoAdmin[] | null>(null);
  const [carregando, setCarregando] = useState(servidorConfigurado());
  const [aberto, setAberto] = useState<string | null>(null);

  async function carregar() {
    if (!servidorConfigurado()) return;
    setCarregando(true);
    const r = await listarPedidosAdmin();
    if (r.ok) setServidor(r.pedidos);
    setCarregando(false);
  }

  useEffect(() => {
    void carregar();
  }, []);

  // servidor primeiro; pedidos locais que o servidor não conhece entram junto
  const linhas = useMemo<Linha[]>(() => {
    const doServidor: Linha[] = (servidor ?? []).map((p) => ({ ...p, origem: "servidor" }));
    const numeros = new Set(doServidor.map((p) => p.numero));
    const locais = pedidos.filter((p) => !numeros.has(p.numero)).map(deLocal);
    return [...doServidor, ...locais].sort((a, b) => (a.data < b.data ? 1 : -1));
  }, [servidor, pedidos]);

  const filtrados = useMemo(
    () => (filtro === "todos" ? linhas : linhas.filter((p) => p.status === filtro)),
    [linhas, filtro]
  );

  async function mudarStatus(linha: Linha, status: StatusPedido) {
    if (linha.origem === "servidor") {
      const r = await mudarStatusPedidoAdmin(linha.numero, status);
      if (r.ok) void carregar();
    }
    aoMudarStatus(linha.numero, status); // mantém o espelho local em dia
  }

  function exportarCsv() {
    const linhasCsv = [
      ["pedido", "data", "loja", "cliente", "email", "telefone", "cpf", "cidade", "uf", "itens", "pagamento", "cupom", "total_reais", "status"],
      ...filtrados.map((p) => [
        p.numero,
        new Date(p.data).toLocaleString("pt-BR"),
        p.loja,
        p.clienteNome,
        p.clienteEmail,
        p.telefone,
        p.cpf,
        p.endereco?.cidade ?? "",
        p.endereco?.uf ?? "",
        p.itens.map((i) => `${i.quantidade}x ${i.titulo}`).join(" | "),
        p.meio,
        p.cupom ?? "",
        (p.totalCentavos / 100).toFixed(2).replace(".", ","),
        rotuloStatus[p.status],
      ]),
    ];
    const csv = linhasCsv
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
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void carregar()}
            disabled={carregando}
            className="min-h-[38px] rounded-[999px] border border-linha px-4 text-[0.8125rem] font-medium text-grafite hover:bg-superficie disabled:opacity-40"
          >
            {carregando ? "Atualizando…" : "↻ Atualizar"}
          </button>
          <button
            type="button"
            onClick={exportarCsv}
            disabled={filtrados.length === 0}
            className="min-h-[38px] rounded-[999px] border border-linha px-4 text-[0.8125rem] font-medium text-grafite hover:bg-superficie disabled:opacity-40"
          >
            ⬇ Exportar CSV
          </button>
        </div>
      </div>

      <p className="mt-2 text-[0.75rem] text-cinza">
        Clique num pedido para ver todos os dados (itens, endereço de entrega e contato).
      </p>

      {filtrados.length === 0 ? (
        <p className="mt-4 rounded-[10px] bg-superficie px-5 py-8 text-center text-[0.875rem] leading-relaxed text-grafite">
          {carregando
            ? "Carregando pedidos do servidor…"
            : linhas.length === 0
              ? "Nenhum pedido registrado ainda."
              : "Nenhum pedido com esse status."}
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-[10px] border border-linha">
          <table className="w-full min-w-[760px] text-[0.875rem]">
            <thead>
              <tr className="bg-superficie text-left text-[0.75rem] uppercase tracking-wide text-cinza">
                <th className="px-4 py-2.5 font-semibold">Pedido</th>
                <th className="px-4 py-2.5 font-semibold">Data</th>
                <th className="px-4 py-2.5 font-semibold">Cliente</th>
                <th className="px-4 py-2.5 font-semibold">Pagamento</th>
                <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => (
                <PedidoLinha
                  key={`${p.origem}-${p.numero}`}
                  pedido={p}
                  aberto={aberto === p.numero}
                  aoAbrir={() => setAberto(aberto === p.numero ? null : p.numero)}
                  aoMudarStatus={(status) => void mudarStatus(p, status)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PedidoLinha({
  pedido: p,
  aberto,
  aoAbrir,
  aoMudarStatus,
}: {
  pedido: Linha;
  aberto: boolean;
  aoAbrir: () => void;
  aoMudarStatus: (status: StatusPedido) => void;
}) {
  const e = p.endereco;
  return (
    <>
      <tr
        className="cursor-pointer border-t border-linha align-top hover:bg-superficie"
        onClick={aoAbrir}
      >
        <td className="px-4 py-3">
          <button type="button" className="num font-semibold text-roxo underline" aria-expanded={aberto}>
            {p.numero}
          </button>
          {p.loja === "be2beauty" && (
            <span className="mt-1 block w-fit rounded-[6px] bg-[#E9EFF6] px-1.5 py-0.5 text-[0.6875rem] font-semibold text-[#13315C]">
              Be2Beauty
            </span>
          )}
        </td>
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
          {p.meio === "pix" ? "Pix" : p.meio === "cartao" ? "Cartão" : "Boleto"}
          {p.cupom && (
            <span className="num mt-1 block w-fit rounded-[6px] bg-violeta-claro px-1.5 py-0.5 text-[0.6875rem] font-semibold text-violeta">
              {p.cupom}
            </span>
          )}
        </td>
        <td className="num px-4 py-3 text-right font-semibold">{formatarPreco(p.totalCentavos)}</td>
        <td className="px-4 py-3">
          <span
            className={`inline-block rounded-[999px] px-2.5 py-1 text-[0.6875rem] font-semibold ${corStatus[p.status]}`}
          >
            {rotuloStatus[p.status]}
          </span>
        </td>
      </tr>
      {aberto && (
        <tr className="border-t border-linha bg-superficie/60">
          <td colSpan={6} className="px-4 py-4">
            <div className="grid gap-4 text-[0.8125rem] sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-cinza">Itens</p>
                <ul className="mt-1 space-y-0.5 text-grafite">
                  {p.itens.map((i) => (
                    <li key={i.sku} className="flex justify-between gap-3">
                      <span>
                        {i.quantidade}× {i.titulo}
                      </span>
                      <span className="num shrink-0">{formatarPreco(i.precoCentavos * i.quantidade)}</span>
                    </li>
                  ))}
                </ul>
                <p className="num mt-1.5 border-t border-linha pt-1.5 font-semibold text-tinta">
                  Total: {formatarPreco(p.totalCentavos)}
                  {p.descontoCentavos > 0 && (
                    <span className="ml-2 font-normal text-sucesso">
                      (−{formatarPreco(p.descontoCentavos)} de desconto)
                    </span>
                  )}
                </p>
                {p.freteNome && <p className="mt-0.5 text-grafite">Frete: {p.freteNome}</p>}
              </div>
              <div>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-cinza">
                  Endereço de entrega
                </p>
                {e ? (
                  <p className="mt-1 leading-relaxed text-grafite">
                    {e.logradouro}, {e.numero}
                    {e.complemento ? ` — ${e.complemento}` : ""}
                    <br />
                    {e.bairro && `${e.bairro} · `}
                    {e.cidade}
                    {e.uf ? `/${e.uf}` : ""}
                    <br />
                    <span className="num">CEP {e.cep}</span>
                    {e.referencia && (
                      <>
                        <br />
                        Ref.: {e.referencia}
                      </>
                    )}
                  </p>
                ) : (
                  <p className="mt-1 text-cinza">
                    Pedido registrado só neste navegador — sem os dados de entrega.
                  </p>
                )}
              </div>
              <div>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-cinza">
                  Contato e origem
                </p>
                <p className="mt-1 leading-relaxed text-grafite">
                  {p.telefone && (
                    <>
                      WhatsApp: <span className="num">{p.telefone}</span>
                      <br />
                    </>
                  )}
                  {p.cpf && (
                    <>
                      CPF: <span className="num">{p.cpf}</span>
                      <br />
                    </>
                  )}
                  E-mail: {p.clienteEmail}
                  {(p.vendedorUsuario || p.afiliado) && (
                    <>
                      <br />
                      Veio do vendedor:{" "}
                      <span className="num font-semibold text-roxo">
                        {p.vendedorUsuario ?? p.afiliado}
                      </span>
                    </>
                  )}
                </p>
                {p.status === "aguardando_pagamento" && (
                  <p className="mt-2 flex gap-3 text-[0.8125rem]">
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        aoMudarStatus("pago");
                      }}
                      className="font-medium text-sucesso underline"
                    >
                      Marcar pago
                    </button>
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        aoMudarStatus("cancelado");
                      }}
                      className="font-medium text-erro underline"
                    >
                      Cancelar
                    </button>
                  </p>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
