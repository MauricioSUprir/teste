"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { copy } from "@/lib/copy";
import { useConta } from "@/lib/conta/contexto";
import { lerPedidos, type Pedido } from "@/lib/pedidos";
import { formatarPreco } from "@/lib/preco";
import { FormEntrar } from "./FormEntrar";

const rotuloStatus = {
  aguardando_pagamento: "Aguardando pagamento",
  pago: "Pago",
  cancelado: "Cancelado",
} as const;

const corStatus = {
  aguardando_pagamento: "bg-violeta-claro text-violeta",
  pago: "bg-[#E7F5EE] text-sucesso",
  cancelado: "bg-roxo-claro text-erro",
} as const;

export function PaginaConta() {
  const conta = useConta();
  const [meusPedidos, setMeusPedidos] = useState<Pedido[]>([]);

  useEffect(() => {
    if (!conta.usuario) return;
    setMeusPedidos(lerPedidos().filter((p) => p.clienteEmail === conta.usuario?.email));
  }, [conta.usuario]);

  if (!conta.usuario) {
    return (
      <div className="container-bn max-w-md py-12">
        <h1 className="font-titulo text-[clamp(1.625rem,3.5vw,2.25rem)] font-semibold">
          {copy.conta.entrarTitulo}
        </h1>
        <div className="mt-6 rounded-[16px] border border-linha bg-white p-6">
          <FormEntrar />
        </div>
      </div>
    );
  }

  const u = conta.usuario;

  return (
    <div className="container-bn max-w-2xl py-12">
      <h1 className="font-titulo text-[clamp(1.625rem,3.5vw,2.25rem)] font-semibold">
        {copy.conta.ola(u.nome)}
      </h1>

      {u.admin && (
        <Link
          href="/admin"
          className="mt-4 inline-block rounded-[999px] bg-roxo px-6 py-3 text-[0.9375rem] font-semibold text-white hover:bg-roxo-escuro"
        >
          {copy.conta.painelAdmin} →
        </Link>
      )}

      <section className="mt-6 rounded-[16px] border border-linha bg-white p-6">
        <h2 className="font-titulo text-[1.125rem] font-semibold">{copy.conta.meusDados}</h2>
        <dl className="mt-3 space-y-1.5 text-[0.9375rem]">
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-cinza">{copy.conta.nome.split(" ")[0]}</dt>
            <dd className="text-tinta">{u.nome}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-cinza">{copy.conta.email}</dt>
            <dd className="text-tinta">{u.email}</dd>
          </div>
        </dl>
        {u.viaGoogle && (
          <p className="mt-3 inline-block rounded-[999px] bg-violeta-claro px-3 py-1 text-[0.75rem] font-medium text-violeta">
            {copy.conta.contaGoogle}
          </p>
        )}
      </section>

      <section className="mt-4 rounded-[16px] border border-linha bg-white p-6">
        <h2 className="font-titulo text-[1.125rem] font-semibold">{copy.conta.endereco}</h2>
        {u.cep ? (
          <dl className="mt-3 space-y-1.5 text-[0.9375rem]">
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-cinza">{copy.conta.cep}</dt>
              <dd className="num text-tinta">{u.cep}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-cinza">Número</dt>
              <dd className="num text-tinta">{u.numero}</dd>
            </div>
            {u.complemento && (
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-cinza">Compl.</dt>
                <dd className="text-tinta">{u.complemento}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="mt-3 text-[0.9375rem] text-grafite">{copy.conta.semEndereco}</p>
        )}
      </section>

      <section className="mt-4 rounded-[16px] border border-linha bg-white p-6">
        <h2 className="font-titulo text-[1.125rem] font-semibold">Meus pedidos</h2>
        {meusPedidos.length === 0 ? (
          <p className="mt-3 text-[0.9375rem] text-grafite">
            Você ainda não fez nenhum pedido.{" "}
            <Link href="/" className="font-medium text-violeta underline">
              Conheça os produtos
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-linha">
            {meusPedidos.map((p) => (
              <li key={p.numero} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="num text-[0.9375rem] font-semibold text-tinta">{p.numero}</p>
                  <p className="text-[0.8125rem] text-cinza">
                    {new Date(p.data).toLocaleDateString("pt-BR")} ·{" "}
                    {p.itens.reduce((acc, i) => acc + i.quantidade, 0)}{" "}
                    {p.itens.reduce((acc, i) => acc + i.quantidade, 0) === 1 ? "item" : "itens"} ·{" "}
                    {p.meio === "pix" ? "Pix" : p.meio === "cartao" ? "Cartão" : "Boleto"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="num text-[0.9375rem] font-semibold">{formatarPreco(p.totalCentavos)}</span>
                  <span className={`rounded-[999px] px-2.5 py-1 text-[0.6875rem] font-semibold ${corStatus[p.status]}`}>
                    {rotuloStatus[p.status]}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button
        type="button"
        onClick={conta.sair}
        className="mt-6 rounded-[999px] border-2 border-tinta px-6 py-2.5 text-[0.9375rem] font-semibold text-tinta hover:bg-superficie"
      >
        {copy.conta.sair}
      </button>
    </div>
  );
}
