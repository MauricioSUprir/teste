/** Ícones de traço (outline) dos atalhos da home — design system, "Atalhos (chips)". */
const traco = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export type NomeIcone = "estrela" | "cupom" | "presente" | "pix" | "selo" | "conversa" | "pessoas" | "predio";

export function IconeAtalho({ nome }: { nome: NomeIcone }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
      {nome === "estrela" && <path {...traco} d="M12 3.5 l2.6 5.3 5.8.8 -4.2 4.1 1 5.8 -5.2-2.7 -5.2 2.7 1-5.8 -4.2-4.1 5.8-.8 z" />}
      {nome === "cupom" && (
        <>
          <path {...traco} d="M3.5 7 h17 v3 a2 2 0 0 0 0 4 v3 h-17 v-3 a2 2 0 0 0 0-4 z" />
          <path {...traco} d="M9.5 14.5 l5-5 M9.8 9.8 h.01 M14.2 14.2 h.01" />
        </>
      )}
      {nome === "presente" && (
        <>
          <path {...traco} d="M4 10 h16 v10 h-16 z M3 7 h18 v3 h-18 z M12 7 v13" />
          <path {...traco} d="M12 7 c-1.5-3.5 -5.5-3.5 -5-1 .3 1 2.5 1 5 1 c2.5 0 4.7 0 5-1 .5-2.5 -3.5-2.5 -5 1" />
        </>
      )}
      {nome === "pix" && <path {...traco} d="M12 3 l9 9 -9 9 -9-9 z M8 12 l4-4 4 4 -4 4 z" />}
      {nome === "selo" && (
        <>
          <circle {...traco} cx="12" cy="10" r="6" />
          <path {...traco} d="M8.5 15 l-1.5 6 5-2.5 5 2.5 -1.5-6 M9.5 10 l1.8 1.8 3.2-3.3" />
        </>
      )}
      {nome === "conversa" && <path {...traco} d="M12 3.5 a8 8 0 0 0 -7 11.9 L4 20 l4.7-1.1 A8 8 0 1 0 12 3.5 z" />}
      {nome === "pessoas" && (
        <>
          <circle {...traco} cx="9" cy="8" r="3" />
          <path {...traco} d="M3.5 19 a5.5 5.5 0 0 1 11 0 M15.5 5.5 a3 3 0 0 1 0 5.5 M17 14 a5.5 5.5 0 0 1 3.5 5" />
        </>
      )}
      {nome === "predio" && <path {...traco} d="M4 20 h16 M6 20 V5 h8 v15 M14 9 h4 v11 M9 8 h2 M9 11 h2 M9 14 h2" />}
    </svg>
  );
}
