"use client";

/**
 * Prova social na home: os melhores depoimentos REAIS deixados na página de
 * avaliações (nota 4+ e com texto escrito). Nada é inventado — se ainda não
 * houver avaliação com comentário, a seção some da página em vez de exibir
 * depoimento fictício.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { listarAvaliacoes, type AvaliacaoLoja } from "@/lib/servidor";
import { EstrelasExibicao } from "@/components/avaliacoes/Estrelas";
import { copy } from "@/lib/copy";

export function CasesDaLoja() {
  const [cases, setCases] = useState<AvaliacaoLoja[]>([]);
  const [media, setMedia] = useState<number | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let ativo = true;
    void listarAvaliacoes().then((r) => {
      if (!ativo) return;
      setCases(r.avaliacoes.filter((a) => a.nota >= 4 && a.texto.trim().length > 24).slice(0, 3));
      setMedia(r.media);
      setTotal(r.total);
    });
    return () => {
      ativo = false;
    };
  }, []);

  if (cases.length === 0) return null;

  return (
    <section aria-labelledby="cases" className="container-bn mt-12">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="cases" className="font-titulo text-[clamp(1.25rem,2.5vw,1.5rem)] font-semibold">
          {copy.home.cases}
        </h2>
        <Link href="/avaliacoes" className="text-[0.875rem] font-semibold text-violeta hover:underline">
          {copy.home.verTudo} →
        </Link>
      </div>

      {media !== null && total > 0 && (
        <p className="mt-2 flex items-center gap-2 text-[0.9375rem] text-grafite">
          <EstrelasExibicao nota={media} />
          <span className="num font-semibold text-tinta">{media.toFixed(1).replace(".", ",")}</span>
          <span className="num text-cinza">
            · {total} {total === 1 ? copy.home.casesUma : copy.home.casesMuitas}
          </span>
        </p>
      )}

      <ul className="mt-5 grid gap-4 md:grid-cols-3">
        {cases.map((c, i) => (
          <li
            key={`${c.nome}-${i}`}
            className="rounded-[12px] border border-linha bg-white p-5 shadow-card"
          >
            <EstrelasExibicao nota={c.nota} />
            <blockquote className="mt-3 text-[0.9375rem] leading-relaxed text-grafite">
              “{c.texto}”
            </blockquote>
            <p className="mt-3 text-[0.875rem] font-semibold text-tinta">{c.nome}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
