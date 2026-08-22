"use client";

/**
 * Gate de preço da Be2Beauty — mostra o conteúdo (preço/compra) só quando o
 * CNPJ do navegador está aprovado. No lugar do preço aparece o convite para
 * o cadastro profissional. No BeautyNow `liberado` é sempre true e o gate
 * é transparente.
 *
 * `comLink=false` para uso DENTRO de um <Link> (ex.: CardProduto) — HTML não
 * permite link dentro de link, então ali o convite é só texto e o clique do
 * card leva à PDP, onde o botão com link aparece.
 */
import Link from "next/link";
import { copy } from "@/lib/copy";
import { useB2B } from "@/lib/b2b/contexto";

export function PrecoProtegido({
  children,
  comLink = true,
  compacto = false,
}: {
  children: React.ReactNode;
  comLink?: boolean;
  compacto?: boolean;
}) {
  const { liberado, status } = useB2B();
  if (liberado) return <>{children}</>;

  const texto =
    status === "pendente"
      ? copy.b2b.aguardandoAprovacao
      : status === "recusado"
        ? copy.b2b.recusado
        : copy.b2b.liberarPrecos;

  if (!comLink) {
    return (
      <p
        className={`flex items-center gap-1.5 font-medium text-roxo ${
          compacto ? "text-[0.8125rem]" : "text-[0.9375rem]"
        }`}
      >
        <span aria-hidden="true">🔒</span> {texto}
      </p>
    );
  }

  return (
    <div className="rounded-[10px] bg-roxo-claro p-4">
      <p className="flex items-center gap-2 text-[0.9375rem] font-semibold text-roxo-escuro">
        <span aria-hidden="true">🔒</span> {copy.b2b.precoFechado}
      </p>
      <p className="mt-1 text-[0.875rem] text-grafite">{texto}</p>
      {status !== "pendente" && (
        <Link
          href="/profissional"
          className="mt-3 inline-flex h-11 items-center rounded-[999px] bg-roxo px-5 text-[0.875rem] font-semibold text-white hover:bg-roxo-escuro"
        >
          {copy.b2b.paginaTitulo} →
        </Link>
      )}
      {status === "pendente" && (
        <Link
          href="/profissional"
          className="mt-3 inline-flex h-11 items-center rounded-[999px] border border-roxo px-5 text-[0.875rem] font-semibold text-roxo hover:bg-white"
        >
          {copy.b2b.statusTitulo} →
        </Link>
      )}
    </div>
  );
}
