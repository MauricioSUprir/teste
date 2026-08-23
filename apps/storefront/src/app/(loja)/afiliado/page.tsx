import type { Metadata } from "next";
import { copy } from "@/lib/copy";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PaginaAfiliado } from "@/components/afiliado/PaginaAfiliado";

export const metadata: Metadata = {
  title: copy.afiliado.paginaTitulo,
  description: copy.afiliado.paginaTexto,
};

/** Programa de afiliados — cadastro (CNPJ opcional) e login por e-mail + código. */
export default function Pagina() {
  return (
    <div className="container-bn max-w-[720px] py-6">
      <Breadcrumb itens={[{ rotulo: copy.afiliado.paginaTitulo }]} />
      <h1 className="font-titulo mt-2 text-[clamp(1.625rem,3.5vw,2.25rem)] font-semibold">
        {copy.afiliado.paginaTitulo}
      </h1>
      <p className="mt-1 max-w-[70ch] text-[0.9375rem] text-grafite">{copy.afiliado.paginaTexto}</p>
      <div className="mt-6">
        <PaginaAfiliado />
      </div>
    </div>
  );
}
