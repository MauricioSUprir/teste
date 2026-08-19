/**
 * Logo BeautyNow — monograma "BN" em roxo profundo com wordmark
 * "BEAUTY NOW" em violeta, recriação vetorial da identidade oficial.
 */
export function Logo({ altura = 28 }: { altura?: number }) {
  return (
    <span
      className="inline-flex items-baseline"
      style={{ gap: altura * 0.35, height: altura }}
    >
      <span
        aria-hidden="true"
        className="font-titulo font-semibold leading-none"
        style={{ fontSize: altura, color: "#4A2882", letterSpacing: "-0.03em" }}
      >
        BN
      </span>
      <span
        className="font-medium leading-none"
        style={{
          fontSize: altura * 0.4,
          color: "#6847C8",
          letterSpacing: "0.3em",
        }}
      >
        BEAUTY&nbsp;NOW
      </span>
    </span>
  );
}
