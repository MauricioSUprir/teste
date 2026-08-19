"use client";

/**
 * Favoritos (♡) — persistidos em localStorage por slug de produto.
 * Na integração real passam a ser sincronizados com a conta do cliente.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface FavoritosContexto {
  slugs: string[];
  ehFavorito: (slug: string) => boolean;
  alternar: (slug: string) => void;
}

const Contexto = createContext<FavoritosContexto | null>(null);
const CHAVE = "beautynow:favoritos:v1";

export function FavoritosProvider({ children }: { children: ReactNode }) {
  const [slugs, setSlugs] = useState<string[]>([]);
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE);
      if (salvo) setSlugs(JSON.parse(salvo) as string[]);
    } catch {
      // storage indisponível — favoritos só em memória
    }
    setHidratado(true);
  }, []);

  useEffect(() => {
    if (!hidratado) return;
    try {
      localStorage.setItem(CHAVE, JSON.stringify(slugs));
    } catch {
      // sem persistência — aceitável
    }
  }, [slugs, hidratado]);

  const alternar = useCallback((slug: string) => {
    setSlugs((atual) =>
      atual.includes(slug) ? atual.filter((s) => s !== slug) : [...atual, slug]
    );
  }, []);

  const valor = useMemo<FavoritosContexto>(
    () => ({
      slugs,
      ehFavorito: (slug: string) => slugs.includes(slug),
      alternar,
    }),
    [slugs, alternar]
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useFavoritos(): FavoritosContexto {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useFavoritos precisa estar dentro de <FavoritosProvider>");
  return ctx;
}
