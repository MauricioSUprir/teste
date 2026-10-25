"use client";

/**
 * Troca entre a loja normal e a loja em 3D, na barra de atalhos do topo (no
 * celular, a barra não aparece: o mesmo atalho fica no menu — LinkVersaoMenu).
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { copy } from "@/lib/copy";
import { LOJA } from "@/lib/loja";

const v = copy.header.atalhos.versao;
const opcao = "rounded-[40px] px-3 py-0.5 text-[0.75rem] font-semibold";

export function AlternarVersao() {
  const caminho = usePathname();
  if (!LOJA.loja3d) return null;
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

const cubo = (
  <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
    <path d="M9 1.8 L15.5 5.4 V12.6 L9 16.2 L2.5 12.6 V5.4 Z M2.5 5.4 L9 9 L15.5 5.4 M9 9 V16.2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

/** no topo do celular, em todas as páginas: o atalho curto para a loja 3D (no computador, a barra de cima já tem) */
export function Atalho3D() {
  const caminho = usePathname();
  if (!LOJA.loja3d || caminho.replace(/\/$/, "") === "/loja-3d") return null;
  return (
    <Link
      href="/loja-3d"
      aria-label={v.menu3d}
      className="flex h-9 shrink-0 items-center gap-1.5 rounded-[40px] bg-roxo-claro px-3 text-[0.8125rem] font-bold text-roxo hover:bg-roxo hover:text-white lg:hidden"
    >
      {cubo}
      {v.curto}
    </Link>
  );
}

/** no menu do celular: um botão para entrar na loja 3D (ou voltar para a normal) */
export function LinkVersaoMenu({ aoClicar }: { aoClicar: () => void }) {
  const caminho = usePathname();
  if (!LOJA.loja3d) return null;
  const em3d = caminho.replace(/\/$/, "") === "/loja-3d";
  return (
    <Link
      href={em3d ? "/" : "/loja-3d"}
      onClick={aoClicar}
      className="flex items-center gap-2.5 rounded-[8px] border border-roxo/30 px-3 py-3 text-[0.9375rem] font-semibold text-roxo hover:bg-roxo-claro"
    >
      {cubo}
      {em3d ? v.menuNormal : v.menu3d}
    </Link>
  );
}
