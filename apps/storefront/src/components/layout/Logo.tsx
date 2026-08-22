import { LOJA } from "@/lib/loja";

/**
 * Logo da loja — recriação vetorial da identidade oficial de cada marca.
 * BeautyNow: monograma "BN" + wordmark "BEAUTY NOW".
 * Be2Beauty: wordmark "BE2BEAUTY" ("BE2" em peso forte) com a assinatura
 * "O E-COMMERCE DO CABELEIREIRO." — como no site oficial da marca.
 * As cores vêm das variáveis do tema, então cada pele pinta com a própria
 * paleta (roxo ou azul-marinho).
 */
export function Logo({ altura = 28 }: { altura?: number }) {
  if (LOJA.id === "be2beauty") {
    return (
      <span className="inline-flex flex-col justify-center" style={{ height: altura }}>
        <span
          className="leading-none"
          style={{ fontSize: altura * 0.72, color: "var(--bn-roxo)", letterSpacing: "0.04em" }}
        >
          <strong className="font-extrabold">BE2</strong>
          <span className="font-light">BEAUTY</span>
        </span>
        <span
          className="font-semibold leading-none"
          style={{
            fontSize: altura * 0.22,
            color: "var(--bn-roxo)",
            letterSpacing: "0.14em",
            marginTop: altura * 0.12,
          }}
        >
          O E-COMMERCE DO CABELEIREIRO.
        </span>
      </span>
    );
  }
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
        BN
      </span>
      <span
        className="font-medium leading-none"
        style={{
          fontSize: altura * 0.4,
          color: "var(--bn-violeta)",
          letterSpacing: "0.3em",
        }}
      >
        BEAUTY&nbsp;NOW
      </span>
    </span>
  );
}
