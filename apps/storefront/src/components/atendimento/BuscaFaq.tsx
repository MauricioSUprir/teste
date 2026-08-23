"use client";

import { useState } from "react";
import { copy } from "@/lib/copy";
import { Acordeao } from "@/components/produto/Acordeao";

interface ItemFaq {
  pergunta: string;
  resposta: string;
}

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Lista de FAQ com filtro por texto (pergunta + resposta, sem acento). */
export function BuscaFaq({ itens }: { itens: ItemFaq[] }) {
  const [termo, setTermo] = useState("");
  const termoNorm = normalizar(termo.trim());
  const filtrados = termoNorm
    ? itens.filter(
        (i) =>
          normalizar(i.pergunta).includes(termoNorm) ||
          normalizar(i.resposta).includes(termoNorm)
      )
    : itens;

  return (
    <div>
      <div className="relative">
        <svg
          width="18"
          height="18"
          viewBox="0 0 20 20"
          aria-hidden="true"
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cinza"
        >
          <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M13 13 L17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          aria-label={copy.atendimento.buscaRotulo}
          placeholder={copy.atendimento.buscaPlaceholder}
          className="h-12 w-full rounded-[999px] border border-linha bg-white pl-11 pr-4 text-[0.9375rem] outline-none focus:border-violeta"
        />
      </div>

      <div className="mt-5" aria-live="polite">
        {filtrados.length === 0 ? (
          <p className="rounded-[10px] bg-superficie px-4 py-6 text-center text-[0.9375rem] text-grafite">
            {copy.atendimento.nenhuma(termo.trim())}
          </p>
        ) : (
          filtrados.map((item) => (
            <Acordeao key={item.pergunta} titulo={item.pergunta}>
              <p>{item.resposta}</p>
            </Acordeao>
          ))
        )}
      </div>
    </div>
  );
}
