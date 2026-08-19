"use client";

import { copy } from "@/lib/copy";
import { useFavoritos } from "@/lib/favoritos/contexto";

/** Coração de favoritar — canto superior direito do card (docs/03 §5). */
export function BotaoFavorito({ slug, classeExtra = "" }: { slug: string; classeExtra?: string }) {
  const favoritos = useFavoritos();
  const ativo = favoritos.ehFavorito(slug);

  return (
    <button
      type="button"
      aria-label={ativo ? copy.conta.desfavoritar : copy.conta.favoritar}
      aria-pressed={ativo}
      onClick={(e) => {
        // o botão vive dentro do Link do card — não pode navegar
        e.preventDefault();
        e.stopPropagation();
        favoritos.alternar(slug);
      }}
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm transition-transform hover:scale-110 ${classeExtra}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 21c-4.8-3.5-8.5-6.6-8.5-10.4C3.5 7.5 5.9 5.5 8.5 5.5c1.4 0 2.7.6 3.5 1.7.8-1.1 2.1-1.7 3.5-1.7 2.6 0 5 2 5 5.1C20.5 14.4 16.8 17.5 12 21z"
          fill={ativo ? "#6847C8" : "none"}
          stroke={ativo ? "#6847C8" : "#6B7280"}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
