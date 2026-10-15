"use client";

/**
 * Endereços antigos → página certa.
 *
 * O Google ainda mostra links da loja anterior da Be2Beauty (ex.:
 * be2beauty.com.br/acidificante, /aguas-de-ipanema) e de produtos que saíram
 * do catálogo. Esses endereços não existem neste site e caíam no 404. Aqui,
 * na própria página 404, o endereço é traduzido: nome de marca vai para a
 * marca, nome de categoria para a categoria e o resto vira uma busca com as
 * palavras do endereço. O texto do 404 só aparece se nada servir.
 */
import { useEffect, useState } from "react";
import { BASE } from "@/lib/caminho";
import { categorias, marcas } from "@/lib/catalogo/consultas";
import { copy } from "@/lib/copy";

/** palavras do endereço, sem código de barras/números soltos e sem termos de URL */
function palavrasDoEndereco(caminho: string): string {
  return decodeURIComponent(caminho)
    .split("/")
    .filter((p) => p && !["produto", "produtos", "p", "categoria", "marca", "loja"].includes(p.toLowerCase()))
    .join(" ")
    .replace(/\.(html?|php|aspx?)$/i, "")
    .replace(/[-_+]+/g, " ")
    .replace(/\b\d{6,}\b/g, " ") // EAN e códigos internos atrapalham a busca
    .replace(/\s+/g, " ")
    .trim();
}

export function EnderecoAntigo({ children }: { children: React.ReactNode }) {
  const [procurando, setProcurando] = useState(true);

  useEffect(() => {
    let caminho = window.location.pathname;
    if (BASE && caminho.startsWith(BASE)) caminho = caminho.slice(BASE.length);
    const ultimo = caminho.split("/").filter(Boolean).pop()?.toLowerCase() ?? "";

    // arquivo que não existe (imagem, script): nada a fazer
    if (!ultimo || /\.(png|jpe?g|webp|gif|svg|ico|css|js|json|xml|txt|pdf)$/i.test(ultimo)) {
      setProcurando(false);
      return;
    }

    let destino: string | null = null;
    if (marcas.some((m) => m.slug === ultimo)) destino = `/marca/${ultimo}/`;
    else if (categorias.some((c) => c.slug === ultimo)) destino = `/categoria/${ultimo}/`;
    else {
      const termo = palavrasDoEndereco(caminho);
      if (termo.length >= 2) destino = `/busca/?q=${encodeURIComponent(termo)}`;
    }

    if (destino) window.location.replace(`${BASE}${destino}`);
    else setProcurando(false);
  }, []);

  if (procurando) {
    return (
      <p role="status" className="container-bn py-24 text-center text-[0.9375rem] text-grafite">
        {copy.naoEncontrada.procurando}
      </p>
    );
  }
  return <>{children}</>;
}
