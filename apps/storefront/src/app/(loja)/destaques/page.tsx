import type { Metadata } from "next";
import { copy } from "@/lib/copy";
import { destaques } from "@/lib/catalogo/destaques";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { LinhasProfissionais } from "@/components/home/LinhasProfissionais";

export const metadata: Metadata = {
  title: copy.destaques.paginaTitulo,
  description: copy.destaques.paginaTexto,
};

export default function PaginaDestaques() {
  return (
    <div className="container-bn py-6">
      <Breadcrumb itens={[{ rotulo: copy.destaques.paginaTitulo }]} />
      <h1 className="font-titulo mt-2 text-[clamp(1.625rem,3.5vw,2.25rem)] font-semibold">{copy.destaques.paginaTitulo}</h1>
      <p className="mt-1 max-w-[70ch] text-[0.9375rem] text-grafite">{copy.destaques.paginaTexto}</p>
      <div className="mt-6">
        <LinhasProfissionais destaques={destaques} />
      </div>
    </div>
  );
}
