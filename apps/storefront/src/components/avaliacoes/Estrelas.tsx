"use client";

/** Estrelas de avaliação — exibição e seleção interativa (1 a 5). */

export function EstrelasExibicao({ nota, tamanho = 18 }: { nota: number; tamanho?: number }) {
  return (
    <span aria-label={`${nota} de 5 estrelas`} className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Estrela key={i} cheia={i <= Math.round(nota)} tamanho={tamanho} />
      ))}
    </span>
  );
}

export function EstrelasEscolha({
  valor,
  aoMudar,
  rotulo,
}: {
  valor: number;
  aoMudar: (n: number) => void;
  rotulo: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[0.9375rem] text-grafite">{rotulo}</span>
      <span role="radiogroup" aria-label={rotulo} className="inline-flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={valor === i}
            aria-label={`${i} ${i === 1 ? "estrela" : "estrelas"}`}
            onClick={() => aoMudar(i)}
            className="rounded-[4px] p-0.5 transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-roxo"
          >
            <Estrela cheia={i <= valor} tamanho={26} />
          </button>
        ))}
      </span>
    </div>
  );
}

function Estrela({ cheia, tamanho }: { cheia: boolean; tamanho: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M10 1.7 L12.47 7.03 L18.3 7.7 L14 11.66 L15.16 17.4 L10 14.53 L4.84 17.4 L6 11.66 L1.7 7.7 L7.53 7.03 Z"
        fill={cheia ? "#F5A623" : "none"}
        stroke={cheia ? "#F5A623" : "#B9B3C9"}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
