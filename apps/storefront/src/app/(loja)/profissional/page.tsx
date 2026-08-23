import type { Metadata } from "next";
import Link from "next/link";
import { copy } from "@/lib/copy";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { CadastroProfissional } from "@/components/b2b/CadastroProfissional";

export const metadata: Metadata = {
  title: copy.b2b.paginaTitulo,
  description: copy.b2b.paginaTexto,
};

/** Cadastro profissional (CNPJ) — libera preços e compra na Be2Beauty. */
export default function PaginaProfissional() {
  return (
    <div className="container-bn max-w-[720px] py-6">
      <Breadcrumb itens={[{ rotulo: copy.b2b.paginaTitulo }]} />
      <h1 className="font-titulo mt-2 text-[clamp(1.625rem,3.5vw,2.25rem)] font-semibold">
        {copy.b2b.paginaTitulo}
      </h1>
      <p className="mt-1 max-w-[70ch] text-[0.9375rem] text-grafite">{copy.b2b.paginaTexto}</p>
      <div className="mt-6">
        <CadastroProfissional />
      </div>
      <p className="mt-6 text-[0.9375rem] text-grafite">
        Quer divulgar e ganhar comissão por venda?{" "}
        <Link href="/afiliado" className="font-semibold text-roxo underline">
          Conheça o programa de afiliados
        </Link>
        .
      </p>
    </div>
  );
}
