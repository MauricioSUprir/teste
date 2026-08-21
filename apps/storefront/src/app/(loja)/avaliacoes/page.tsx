import type { Metadata } from "next";
import { copy } from "@/lib/copy";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { AvaliacoesLoja } from "@/components/avaliacoes/AvaliacoesLoja";

export const metadata: Metadata = {
  title: copy.avaliacoes.titulo,
  description: copy.avaliacoes.subtitulo,
};

/** Página pública de avaliações da loja (estrelas + comentários). */
export default function PaginaAvaliacoes() {
  return (
    <div className="container-bn py-6">
      <Breadcrumb itens={[{ rotulo: copy.avaliacoes.titulo }]} />
      <h1 className="font-titulo mt-2 text-[clamp(1.625rem,3.5vw,2.25rem)] font-semibold">
        {copy.avaliacoes.titulo}
      </h1>
      <p className="mt-1 max-w-[70ch] text-[0.9375rem] text-grafite">
        {copy.avaliacoes.subtitulo}
      </p>
      <div className="mt-6">
        <AvaliacoesLoja />
      </div>
    </div>
  );
}
