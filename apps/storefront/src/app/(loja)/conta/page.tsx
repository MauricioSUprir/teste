import type { Metadata } from "next";
import Link from "next/link";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: "Minha conta", robots: { index: false } };

export default function PaginaConta() {
  return (
    <div className="container-bn flex flex-col items-center py-24 text-center">
      <h1 className="font-titulo text-[clamp(1.625rem,3.5vw,2.25rem)] font-semibold">
        {copy.conta.titulo}
      </h1>
      <p className="mt-3 max-w-[56ch] text-[0.9375rem] leading-relaxed text-grafite">
        {copy.conta.texto}
      </p>
      <Link
        href="/"
        className="mt-6 rounded-[999px] bg-rosa px-6 py-3 text-[0.9375rem] font-semibold text-white hover:bg-rosa-escuro"
      >
        {copy.checkout.voltarLoja}
      </Link>
    </div>
  );
}
