import { LOJA } from "@/lib/loja";

/**
 * Logo da loja — monograma + wordmark vetoriais, recriação da identidade
 * oficial. BeautyNow: "BN BEAUTY NOW". Be2Beauty: "B2B BE2BEAUTY"
 * (placeholder vetorial até o Mauricio enviar a logo oficial pela página
 * de envio). As cores vêm das variáveis do tema, então cada pele pinta
 * a logo com a própria paleta (roxo ou azul-marinho).
 */
export function Logo({ altura = 28 }: { altura?: number }) {
  const b2b = LOJA.id === "be2beauty";
  return (
    <span
      className="inline-flex items-baseline"
      style={{ gap: altura * 0.35, height: altura }}
    >
      <span
        aria-hidden="true"
        className="font-titulo font-semibold leading-none"
        style={{ fontSize: altura, color: "var(--bn-roxo)", letterSpacing: "-0.03em" }}
      >
        {b2b ? "B2B" : "BN"}
      </span>
      <span
        className="font-medium leading-none"
        style={{
          fontSize: altura * 0.4,
          color: "var(--bn-violeta)",
          letterSpacing: "0.3em",
        }}
      >
        {b2b ? <>BE2BEAUTY</> : <>BEAUTY&nbsp;NOW</>}
      </span>
    </span>
  );
}
