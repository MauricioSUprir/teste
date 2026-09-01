"use client";

/**
 * Links por produto — o afiliado pesquisa ou filtra por marca e copia o link
 * individual de cada produto (abre direto na página do produto, com o código
 * de afiliado no ?af= para creditar a comissão).
 */
import { useMemo, useState } from "react";
import { copy } from "@/lib/copy";
import { buscar, marcas, obterMarca, produtos } from "@/lib/catalogo/consultas";
import type { Produto } from "@/lib/catalogo/tipos";
import { formatarPreco } from "@/lib/preco";

const LOJA_VAREJO = "https://www.beautynowstore.com.br";
const MAX_VISIVEIS = 30;

export function LinksProdutos({ codigo }: { codigo: string }) {
  const [termo, setTermo] = useState("");
  const [marca, setMarca] = useState("");
  const [copiado, setCopiado] = useState<string | null>(null);

  const resultados = useMemo<Produto[]>(() => {
    let lista = termo.trim() ? buscar(termo) : produtos;
    if (marca) lista = lista.filter((p) => p.marca === marca);
    return lista.filter((p) => !p.local);
  }, [termo, marca]);

  async function copiar(slug: string) {
    const url = `${LOJA_VAREJO}/produto/${slug}/?af=${encodeURIComponent(codigo)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(slug);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      // navegador sem clipboard — mostra o link para copiar à mão
      window.prompt(copy.afiliado.links.copiar, url);
    }
  }

  return (
    <div className="mt-6 rounded-[10px] border border-linha bg-superficie p-4">
      <h3 className="text-[0.9375rem] font-semibold text-tinta">🔗 {copy.afiliado.links.titulo}</h3>
      <p className="mt-1 text-[0.8125rem] text-grafite">{copy.afiliado.links.texto}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          type="search"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder={copy.afiliado.links.busca}
          aria-label={copy.afiliado.links.busca}
          className="h-11 min-w-0 grow basis-52 rounded-[6px] border border-linha bg-white px-3 text-[0.875rem] outline-none focus:border-violeta"
        />
        <select
          value={marca}
          onChange={(e) => setMarca(e.target.value)}
          aria-label="Filtrar por marca"
          className="h-11 basis-44 rounded-[6px] border border-linha bg-white px-3 text-[0.875rem] outline-none focus:border-violeta"
        >
          <option value="">{copy.afiliado.links.todasMarcas}</option>
          {marcas.map((m) => (
            <option key={m.slug} value={m.slug}>
              {m.nome}
            </option>
          ))}
        </select>
      </div>

      {resultados.length === 0 ? (
        <p className="mt-4 text-[0.875rem] text-cinza">{copy.afiliado.links.nenhum}</p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-linha">
            {resultados.slice(0, MAX_VISIVEIS).map((p) => (
              <li key={p.slug} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-[0.875rem] font-medium text-tinta">{p.titulo}</p>
                  <p className="text-[0.75rem] text-cinza">
                    {obterMarca(p.marca)?.nome ?? p.marca} ·{" "}
                    <span className="num">{formatarPreco(p.variantes[0].precoPor)}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void copiar(p.slug)}
                  className="h-9 shrink-0 rounded-[999px] bg-roxo px-4 text-[0.8125rem] font-semibold text-white hover:bg-roxo-escuro"
                >
                  {copiado === p.slug ? copy.afiliado.links.copiado : copy.afiliado.links.copiar}
                </button>
              </li>
            ))}
          </ul>
          {resultados.length > MAX_VISIVEIS && (
            <p className="mt-2 text-[0.8125rem] text-cinza">
              {copy.afiliado.links.maisResultados(resultados.length - MAX_VISIVEIS)}
            </p>
          )}
        </>
      )}
    </div>
  );
}
