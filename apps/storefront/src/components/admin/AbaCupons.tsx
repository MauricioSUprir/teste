"use client";

import { useEffect, useState } from "react";
import { copy } from "@/lib/copy";
import { gravarCupons, lerCupons, type Cupom } from "@/lib/cupons";
import { formatarPreco } from "@/lib/preco";

/** Aba Cupons do painel admin — criar, ativar/desativar e excluir códigos. */
export function AbaCupons() {
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [codigo, setCodigo] = useState("");
  const [tipo, setTipo] = useState<Cupom["tipo"]>("percentual");
  const [valor, setValor] = useState("");
  const [minimo, setMinimo] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setCupons(lerCupons());
  }, []);

  function salvar(nova: Cupom[]) {
    setCupons(nova);
    gravarCupons(nova);
  }

  function criar(e: React.FormEvent) {
    e.preventDefault();
    const cod = codigo.trim().toUpperCase().replace(/\s+/g, "");
    const valorNum = Number(valor.replace(",", "."));
    const minimoNum = minimo ? Number(minimo.replace(",", ".")) : 0;
    if (!cod) {
      setErro("Informe o código do cupom.");
      return;
    }
    if (cupons.some((c) => c.codigo === cod)) {
      setErro(`Já existe um cupom com o código ${cod}.`);
      return;
    }
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      setErro("Informe um valor de desconto maior que zero.");
      return;
    }
    if (tipo === "percentual" && valorNum > 90) {
      setErro("Percentual máximo de 90% — confira o valor.");
      return;
    }
    const novo: Cupom = {
      codigo: cod,
      tipo,
      valor: tipo === "percentual" ? Math.round(valorNum) : Math.round(valorNum * 100),
      minimoCentavos: Math.round(minimoNum * 100),
      ativo: true,
    };
    salvar([novo, ...cupons]);
    setCodigo("");
    setValor("");
    setMinimo("");
    setErro(null);
  }

  function alternarAtivo(cod: string) {
    salvar(cupons.map((c) => (c.codigo === cod ? { ...c, ativo: !c.ativo } : c)));
  }

  function excluir(cod: string) {
    salvar(cupons.filter((c) => c.codigo !== cod));
  }

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-[0.9375rem] text-grafite">{copy.conta.admin.cuponsTexto}</p>

      <form
        onSubmit={criar}
        className="rounded-[16px] border border-linha bg-white p-5"
      >
        <h2 className="font-titulo text-[1.125rem] font-semibold">{copy.conta.admin.cupomCriar}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="text-[0.8125rem] font-medium text-grafite">
              {copy.conta.admin.cupomCodigo}
            </span>
            <input
              type="text"
              value={codigo}
              onChange={(e) => {
                setCodigo(e.target.value.toUpperCase());
                setErro(null);
              }}
              placeholder="EX.: PRIMAVERA15"
              className="num mt-1 h-11 w-full rounded-[6px] border border-linha px-3 text-[0.9375rem] uppercase outline-none focus:border-violeta"
            />
          </label>
          <label className="block">
            <span className="text-[0.8125rem] font-medium text-grafite">
              {copy.conta.admin.cupomTipo}
            </span>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as Cupom["tipo"])}
              className="mt-1 h-11 w-full rounded-[6px] border border-linha bg-white px-3 text-[0.9375rem] outline-none focus:border-violeta"
            >
              <option value="percentual">{copy.conta.admin.cupomPercentual}</option>
              <option value="valor">{copy.conta.admin.cupomValorFixo}</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[0.8125rem] font-medium text-grafite">
              {copy.conta.admin.cupomValor} {tipo === "percentual" ? "(%)" : "(R$)"}
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={valor}
              onChange={(e) => {
                setValor(e.target.value);
                setErro(null);
              }}
              placeholder={tipo === "percentual" ? "10" : "15,00"}
              className="num mt-1 h-11 w-full rounded-[6px] border border-linha px-3 text-[0.9375rem] outline-none focus:border-violeta"
            />
          </label>
          <label className="block">
            <span className="text-[0.8125rem] font-medium text-grafite">
              {copy.conta.admin.cupomMinimo}
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={minimo}
              onChange={(e) => setMinimo(e.target.value)}
              placeholder="99,00"
              className="num mt-1 h-11 w-full rounded-[6px] border border-linha px-3 text-[0.9375rem] outline-none focus:border-violeta"
            />
          </label>
        </div>
        {erro && (
          <p role="alert" className="mt-3 text-[0.8125rem] font-medium text-erro">
            {erro}
          </p>
        )}
        <button
          type="submit"
          className="mt-4 rounded-[999px] bg-roxo px-6 py-2.5 text-[0.9375rem] font-semibold text-white hover:bg-roxo-escuro"
        >
          {copy.conta.admin.cupomCriar}
        </button>
      </form>

      <div className="overflow-x-auto rounded-[16px] border border-linha bg-white">
        {cupons.length === 0 ? (
          <p className="p-5 text-[0.9375rem] text-grafite">{copy.conta.admin.cupomVazio}</p>
        ) : (
          <table className="w-full min-w-[560px] text-left text-[0.875rem]">
            <thead>
              <tr className="border-b border-linha text-[0.75rem] uppercase tracking-wide text-cinza">
                <th className="px-5 py-3 font-medium">{copy.conta.admin.cupomCodigo}</th>
                <th className="px-5 py-3 font-medium">{copy.conta.admin.cupomValor}</th>
                <th className="px-5 py-3 font-medium">{copy.conta.admin.cupomMinimo}</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linha">
              {cupons.map((c) => (
                <tr key={c.codigo}>
                  <td className="num px-5 py-3 font-semibold text-tinta">{c.codigo}</td>
                  <td className="num px-5 py-3">
                    {c.tipo === "percentual" ? `${c.valor}%` : formatarPreco(c.valor)}
                  </td>
                  <td className="num px-5 py-3">
                    {c.minimoCentavos > 0 ? formatarPreco(c.minimoCentavos) : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() => alternarAtivo(c.codigo)}
                      aria-pressed={c.ativo}
                      className={`rounded-[999px] px-2.5 py-1 text-[0.6875rem] font-semibold ${
                        c.ativo
                          ? "bg-[#E7F5EE] text-sucesso"
                          : "bg-superficie text-cinza"
                      }`}
                    >
                      {c.ativo ? copy.conta.admin.cupomAtivo : copy.conta.admin.cupomInativo}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => excluir(c.codigo)}
                      className="text-[0.8125rem] text-cinza underline hover:text-erro"
                    >
                      {copy.conta.admin.cupomExcluir}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
