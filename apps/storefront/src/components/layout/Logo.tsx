import { LOJA } from "@/lib/loja";

/**
 * Logo da loja — recriação vetorial da identidade oficial de cada marca.
 * BeautyNow: monograma "BN" + wordmark "BEAUTY NOW".
 * Be2Beauty: wordmark "BE2BEAUTY" ("BE2" em peso forte) com a assinatura
 * "ONLY PROFESSIONAL" — assinatura da marca.
 * As cores vêm das variáveis do tema, então cada pele pinta com a própria
 * paleta (roxo ou azul-marinho).
 *
 * Acessibilidade: o desenho do wordmark é decorativo (aria-hidden) e o nome da
 * loja aparece uma única vez, em sr-only. Sem isso o leitor de tela anunciava
 * o texto visível junto do rótulo do link e os dois não batiam.
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
        <span className="sr-only">Pulse Beauty Store</span>
        <span aria-hidden="true" className="inline-flex flex-col justify-center">
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
  if (LOJA.id === "bradeco") {
    // wordmark oficial (@bradecodistribuidora): "BRADECO" largo e quadrado em
    // branco, com o "A" desenhado como uma seta laranja cheia (sem travessão),
    // e "Distribuidora" em laranja bem espaçado embaixo.
    // O A é um SVG e não a letra: nenhuma fonte tem esse desenho.
    const corpo = altura * 0.52; // tamanho das letras
    const caixaAlta = corpo * 0.72; // altura da maiúscula, para casar com o A
    return (
      <span
        className="inline-flex flex-col items-center justify-center"
        style={{ height: altura }}
      >
        <span className="sr-only">Bradeco Distribuidora</span>
        <span
          aria-hidden="true"
          className="leading-none"
          style={{
            fontFamily: "var(--font-michroma), Arial, sans-serif",
            fontSize: corpo,
            color: "var(--bn-tinta)",
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
          }}
        >
          BR
          <svg
            viewBox="0 0 100 100"
            style={{
              display: "inline-block",
              verticalAlign: "baseline",
              height: caixaAlta,
              width: caixaAlta * 0.92,
              marginLeft: corpo * 0.06,
              marginRight: corpo * 0.06,
            }}
          >
            <path d="M50 0 L100 100 L72 100 L50 44 L28 100 L0 100 Z" fill="#ED7B2F" />
          </svg>
          DECO
        </span>
        <span
          aria-hidden="true"
          className="leading-none"
          style={{
            fontSize: altura * 0.2,
            fontWeight: 500,
            color: "#ED7B2F",
            letterSpacing: "0.3em",
            marginTop: altura * 0.17,
          }}
        >
          Distribuidora
        </span>
      </span>
    );
  }
  if (LOJA.id === "be2beauty") {
    return (
      <span className="inline-flex flex-col justify-center" style={{ height: altura }}>
        <span className="sr-only">Be2Beauty — only professional</span>
        <span
          aria-hidden="true"
          className="leading-none"
          /* marinho da logo oficial (o azul dos botões é mais claro) e os
             pesos que a Jost tem carregados: 900 no BE2, 400 no BEAUTY */
          style={{ fontSize: altura * 0.72, color: "var(--bn-roxo-escuro)", letterSpacing: "0.04em" }}
        >
          <strong className="font-black">BE2</strong>
          <span className="font-normal">BEAUTY</span>
        </span>
        {/* assinatura na mesma LARGURA do BE2BEAUTY (pedido do Mauricio, 18/10):
            cada letra é um item e o flex distribui de ponta a ponta — sem
            engrossar a fonte; a largura vem do wordmark de cima */}
        <span
          aria-hidden="true"
          className="flex justify-between font-medium leading-none"
          style={{
            fontSize: altura * 0.24,
            color: "var(--bn-roxo-escuro)",
            marginTop: altura * 0.12,
          }}
        >
          {"ONLY PROFESSIONAL".split("").map((letra, i) => (
            <span key={i}>{letra === " " ? " " : letra}</span>
          ))}
        </span>
      </span>
    );
  }
  // logo oficial (2026): wordmark empilhado — "BEAUTY" fino e espaçado por
  // cima, "NOW!" em peso máximo embaixo, nos dois roxos da marca. "NOW!" manda
  // na cor primária (var), então a pele pinta com o próprio tom; o "BEAUTY" é
  // o roxo claro de apoio da identidade BeautyNow.
  return (
    <span className="inline-flex flex-col justify-center" style={{ height: altura }}>
      <span className="sr-only">BeautyNow</span>
      <span
        aria-hidden="true"
        className="font-titulo leading-none"
        style={{
          fontSize: altura * 0.32,
          fontWeight: 400,
          color: "#8B45E6",
          letterSpacing: "0.345em",
        }}
      >
        BEAUTY
      </span>
      <span
        aria-hidden="true"
        className="font-titulo leading-none"
        style={{
          fontSize: altura * 0.66,
          fontWeight: 900,
          color: "var(--bn-roxo)",
          letterSpacing: "-0.015em",
          marginTop: altura * 0.04,
        }}
      >
        NOW!
      </span>
    </span>
  );
}
