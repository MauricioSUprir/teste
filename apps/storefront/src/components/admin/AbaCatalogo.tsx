"use client";

/** Aba Catálogo — tabela com busca, filtro de estoque e exportação CSV. */
import { useMemo, useState } from "react";
import { catalogoReal, marcas, obterMarca, produtos, temEstoque } from "@/lib/catalogo/consultas";
import { formatarPreco } from "@/lib/preco";

export function AbaCatalogo() {
  const [busca, setBusca] = useState("");
  const [soBaixoEstoque, setSoBaixoEstoque] = useState(false);
  const [visiveis, setVisiveis] = useState(30);

  const linhas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return produtos
      .flatMap((p) =>
        p.variantes.map((v) => ({
          produto: p,
          variante: v,
          marca: obterMarca(p.marca)?.nome ?? p.marca,
        }))
      )
      .filter((l) => {
        if (soBaixoEstoque && l.variante.estoque > 5) return false;
        if (!termo) return true;
        return (
          l.produto.titulo.toLowerCase().includes(termo) ||
          l.variante.sku.toLowerCase().includes(termo) ||
          l.marca.toLowerCase().includes(termo)
        );
      });
  }, [busca, soBaixoEstoque]);

  const esgotados = produtos.filter((p) => !temEstoque(p)).length;
  const baixoEstoque = produtos.flatMap((p) => p.variantes).filter((v) => v.estoque > 0 && v.estoque <= 5).length;

  function exportarCsv() {
    const csvLinhas = [
      ["produto", "variacao", "marca", "sku", "preco_reais", "estoque"],
      ...linhas.map((l) => [
        l.produto.titulo,
        l.variante.tituloVariacao,
        l.marca,
        l.variante.sku,
        (l.variante.precoPor / 100).toFixed(2).replace(".", ","),
        String(l.variante.estoque),
      ]),
    ];
    const csv = csvLinhas
      .map((linha) => linha.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `catalogo-beautynow-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {!catalogoReal && (
        <p className="mb-4 rounded-[10px] border border-violeta/30 bg-violeta-claro px-4 py-3 text-[0.8125rem] text-grafite">
          Catálogo de demonstração. Assim que a importação do Hub Suprir rodar, os 1.222 produtos
          reais aparecem aqui e em toda a loja.
        </p>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid grid-cols-3 gap-3">
          <Cartao valor={String(produtos.length)} rotulo="produtos" />
          <Cartao valor={String(esgotados)} rotulo="esgotados" alerta={esgotados > 0} />
          <Cartao valor={String(baixoEstoque)} rotulo="estoque baixo" alerta={baixoEstoque > 0} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[0.8125rem] text-grafite">
            <input
              type="checkbox"
              checked={soBaixoEstoque}
              onChange={(e) => setSoBaixoEstoque(e.target.checked)}
              className="h-4 w-4 accent-[#4A2882]"
            />
            Só estoque baixo/esgotado
          </label>
          <input
            type="search"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setVisiveis(30);
            }}
            placeholder="Buscar por nome, SKU ou marca"
            aria-label="Buscar no catálogo"
            className="h-10 w-60 rounded-[6px] border border-linha bg-white px-3 text-[0.875rem] outline-none focus:border-violeta"
          />
          <button
            type="button"
            onClick={exportarCsv}
            className="h-10 rounded-[999px] border border-linha px-4 text-[0.8125rem] font-medium text-grafite hover:bg-superficie"
          >
            ⬇ CSV
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-[10px] border border-linha">
        <table className="w-full min-w-[640px] text-[0.875rem]">
          <thead>
            <tr className="bg-superficie text-left text-[0.75rem] uppercase tracking-wide text-cinza">
              <th className="px-4 py-2.5 font-semibold">Produto</th>
              <th className="px-4 py-2.5 font-semibold">Marca</th>
              <th className="px-4 py-2.5 font-semibold">SKU</th>
              <th className="px-4 py-2.5 text-right font-semibold">Preço</th>
              <th className="px-4 py-2.5 text-right font-semibold">Estoque</th>
            </tr>
          </thead>
          <tbody>
            {linhas.slice(0, visiveis).map((l) => (
              <tr key={l.variante.sku} className="border-t border-linha">
                <td className="px-4 py-2.5 text-tinta">
                  {l.produto.titulo}
                  {l.produto.variantes.length > 1 && (
                    <span className="text-cinza"> · {l.variante.tituloVariacao}</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-grafite">{l.marca}</td>
                <td className="num px-4 py-2.5 text-grafite">{l.variante.sku}</td>
                <td className="num px-4 py-2.5 text-right">{formatarPreco(l.variante.precoPor)}</td>
                <td
                  className={`num px-4 py-2.5 text-right font-medium ${
                    l.variante.estoque === 0 ? "text-erro" : l.variante.estoque <= 5 ? "text-alerta" : "text-sucesso"
                  }`}
                >
                  {l.variante.estoque}
                </td>
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-grafite">
                  Nenhum item encontrado com esse filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {linhas.length > visiveis && (
        <button
          type="button"
          onClick={() => setVisiveis((n) => n + 50)}
          className="num mt-3 rounded-[999px] border border-linha px-5 py-2 text-[0.875rem] font-medium text-grafite hover:bg-superficie"
        >
          Mostrar mais ({linhas.length - visiveis} restantes)
        </button>
      )}
      <p className="mt-3 text-[0.75rem] text-cinza">
        {marcas.length} marcas no catálogo · preços e estoque atualizados na última sincronização
      </p>
    </div>
  );
}

function Cartao({ valor, rotulo, alerta = false }: { valor: string; rotulo: string; alerta?: boolean }) {
  return (
    <div className="rounded-[16px] border border-linha bg-white px-4 py-3">
      <p className={`num text-[1.25rem] font-bold leading-none ${alerta ? "text-alerta" : "text-tinta"}`}>{valor}</p>
      <p className="mt-1 text-[0.75rem] text-grafite">{rotulo}</p>
    </div>
  );
}
