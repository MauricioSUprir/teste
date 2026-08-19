"use client";

import Link from "next/link";
import { copy } from "@/lib/copy";
import { useConta } from "@/lib/conta/contexto";
import { FormEntrar } from "./FormEntrar";

export function PaginaConta() {
  const conta = useConta();

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
