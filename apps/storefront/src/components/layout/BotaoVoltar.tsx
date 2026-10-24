"use client";

/**
 * "Voltar" das páginas de produto. Volta para a tela anterior do site (a loja 3D,
 * a lista ou a busca de onde a pessoa veio). Quem chegou direto por um link
 * (WhatsApp, Google, Instagram) não tem tela anterior aqui: vai para
 * `alternativa`, em vez de sair do site.
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { copy } from "@/lib/copy";

const CHAVE = "bn:trilha";

function lerTrilha(): string[] {
  try {
    const v: unknown = JSON.parse(sessionStorage.getItem(CHAVE) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Anota as páginas que a pessoa abriu nesta aba (fica no layout da loja). */
export function TrilhaNavegacao() {
  const caminho = usePathname();
  useEffect(() => {
    const trilha = lerTrilha();
    if (trilha.at(-1) === caminho) return; // recarregou a mesma página
    if (trilha.at(-2) === caminho) trilha.pop(); // voltou uma tela
    else trilha.push(caminho);
    try {
      sessionStorage.setItem(CHAVE, JSON.stringify(trilha.slice(-30)));
    } catch {
      // aba anônima sem armazenamento: o botão só usa a alternativa
    }
  }, [caminho]);
  return null;
}

export function BotaoVoltar({ alternativa }: { alternativa: string }) {
  const router = useRouter();
  return (
    <Link
      href={alternativa}
      onClick={(ev) => {
        if (lerTrilha().length > 1) {
          ev.preventDefault();
          router.back();
        }
      }}
      className="inline-flex h-9 items-center gap-1.5 rounded-[40px] border border-roxo/25 bg-white pl-2.5 pr-4 text-[0.875rem] font-semibold text-roxo hover:border-roxo/60 hover:bg-roxo-claro"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15 5 L8 12 L15 19" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {copy.nav.voltar}
    </Link>
  );
}
