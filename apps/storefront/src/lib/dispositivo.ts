import { useEffect, useState } from "react";

/**
 * Aparelho de toque = celular ou tablet (o dedo é o ponteiro principal). A loja
 * 3D abre em todos, mas no de toque começa mais leve e ganha o controle de
 * andar na tela.
 *
 * Fica null enquanto a página ainda não abriu no navegador (o HTML é o mesmo para todos).
 */
export function useToque(): boolean | null {
  const [toque, setToque] = useState<boolean | null>(null);
  useEffect(() => {
    const consulta = window.matchMedia("(pointer: coarse)");
    const atualizar = () => setToque(consulta.matches);
    atualizar();
    consulta.addEventListener("change", atualizar);
    return () => consulta.removeEventListener("change", atualizar);
  }, []);
  return toque;
}
