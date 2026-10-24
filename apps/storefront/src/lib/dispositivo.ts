import { useEffect, useState } from "react";

/**
 * Computador = mouse ou trackpad de verdade e tela larga. Celular e tablet
 * ficam com a loja normal (a loja 3D pede mouse e tela grande).
 */
export function ehComputador(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches && window.innerWidth >= 1024;
}

/** null enquanto a página ainda não abriu no navegador (o HTML é o mesmo para todos) */
export function useEhComputador(): boolean | null {
  const [computador, setComputador] = useState<boolean | null>(null);
  useEffect(() => {
    const atualizar = () => setComputador(ehComputador());
    atualizar();
    window.addEventListener("resize", atualizar);
    return () => window.removeEventListener("resize", atualizar);
  }, []);
  return computador;
}
