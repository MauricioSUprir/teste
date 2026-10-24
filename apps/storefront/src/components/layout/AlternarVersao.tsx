"use client";

/**
 * Troca entre a loja normal e a loja em 3D, na barra de atalhos do topo. Só
 * aparece no computador: no celular e no tablet a loja é sempre a normal.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { copy } from "@/lib/copy";
import { LOJA } from "@/lib/loja";
import { useEhComputador } from "@/lib/dispositivo";

const v = copy.header.atalhos.versao;
const opcao = "rounded-[40px] px-3 py-0.5 text-[0.75rem] font-semibold";

export function AlternarVersao() {
  const computador = useEhComputador();
  const caminho = usePathname();
  if (!LOJA.loja3d || !computador) return null;
  const em3d = caminho.replace(/\/$/, "") === "/loja-3d";
  return (
    <li className="flex items-center gap-2">
      <span id="rotulo-versao">{v.rotulo}</span>
      <div role="group" aria-labelledby="rotulo-versao" className="flex rounded-[40px] border border-roxo/25 bg-white p-0.5">
        {em3d ? (
          <Link href="/" className={`${opcao} text-grafite hover:text-roxo`}>
            {v.normal}
          </Link>
        ) : (
          <span aria-current="page" className={`${opcao} bg-roxo text-white`}>
            {v.normal}
          </span>
        )}
        {em3d ? (
          <span aria-current="page" className={`${opcao} bg-roxo text-white`}>
            {v.tresD}
          </span>
        ) : (
          <Link href="/loja-3d" className={`${opcao} text-grafite hover:text-roxo`}>
            {v.tresD}
          </Link>
        )}
      </div>
    </li>
  );
}
