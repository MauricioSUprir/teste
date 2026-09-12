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
  if (LOJA.id === "pulse") {
    // identidade oficial (@pulse.beautystore): selo redondo quase-preto com
    // "P U L S E" fino (o avatar da marca) + wordmark minúsculo "pulse." com
    // o ponto dourado e a assinatura "BEAUTY STORE" espaçada
    const selo = altura * 1.35;
    return (
      <span className="inline-flex items-center" style={{ height: altura, gap: altura * 0.4 }}>
        <span
          aria-hidden="true"
          className="flex shrink-0 items-center justify-center rounded-full"
          style={{
            width: selo,
            height: selo,
            background: "#1c1714",
            border: "1px solid rgba(217, 154, 78, 0.55)",
          }}
        >
          <span
            className="leading-none"
            style={{
              fontSize: selo * 0.17,
              fontWeight: 400,
              color: "#f3ede6",
              letterSpacing: "0.3em",
              textIndent: "0.3em",
            }}
          >
            PULSE
          </span>
        </span>
        <span className="inline-flex flex-col justify-center">
          <span className="leading-none" style={{ fontSize: altura * 0.72 }}>
            <span style={{ fontWeight: 700, color: "var(--bn-tinta)", letterSpacing: "-0.01em" }}>
              pulse
            </span>
            <span style={{ fontWeight: 700, color: "var(--bn-roxo)" }}>.</span>
          </span>
          <span
            className="leading-none"
            style={{
              fontSize: altura * 0.2,
              fontWeight: 600,
              color: "var(--bn-grafite)",
              letterSpacing: "0.32em",
              marginTop: altura * 0.12,
              textTransform: "uppercase",
            }}
          >
            Beauty Store
          </span>
        </span>
      </span>
    );
  }
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
