"use client";

/**
 * Coluna de compra da PDP — seletor de variação (chips), preço, quantidade,
 * CTA sticky em mobile e cálculo de frete por CEP (tickets 3.1, 3.3, 3.4, 3.8).
 */
import { useState } from "react";
import { copy } from "@/lib/copy";
import { useCarrinho } from "@/lib/carrinho/contexto";
import type { Produto } from "@/lib/catalogo/tipos";
import { calcularFrete, validarCep, type OpcaoFrete } from "@/lib/frete";
import {
  DESCONTO_PIX_PCT,
  formatarPreco,
  parcelamento,
  percentualDesconto,
  precoPix,
} from "@/lib/preco";

export function ColunaCompra({ produto }: { produto: Produto }) {
  const carrinho = useCarrinho();
  const [skuAtivo, setSkuAtivo] = useState(
    () => (produto.variantes.find((v) => v.estoque > 0) ?? produto.variantes[0]).sku
  );
  const [quantidade, setQuantidade] = useState(1);
  const [feedback, setFeedback] = useState(false);
  const [cep, setCep] = useState("");
  const [erroCep, setErroCep] = useState(false);
  const [fretes, setFretes] = useState<OpcaoFrete[] | null>(null);
  const [aviseMeEmail, setAviseMeEmail] = useState("");
  const [aviseMeOk, setAviseMeOk] = useState(false);

  const variante = produto.variantes.find((v) => v.sku === skuAtivo) ?? produto.variantes[0];
  const disponivel = variante.estoque > 0;
  const desconto =
    variante.precoDe && variante.precoDe > variante.precoPor
      ? percentualDesconto(variante.precoDe, variante.precoPor)
      : null;
  const parcela = parcelamento(variante.precoPor);

  function adicionar() {
    carrinho.adicionar(produto.slug, variante.sku, quantidade);
    setFeedback(true);
    setTimeout(() => setFeedback(false), 2000);
  }

  function calcular(e: React.FormEvent) {
    e.preventDefault();
    if (!validarCep(cep)) {
      setErroCep(true);
      setFretes(null);
      return;
    }
    setErroCep(false);
    setFretes(calcularFrete(cep, variante.precoPor * quantidade));
  }

  return (
    <div>
      {/* preço */}
      <div className="mt-4 border-y border-linha py-4">
        {disponivel ? (
          <>
            <p className="flex items-center gap-2.5">
              <span className="num text-[1.75rem] font-bold leading-none text-tinta">
                {formatarPreco(variante.precoPor)}
              </span>
              {desconto !== null && (
                <span className="rounded-[6px] bg-oferta px-1.5 py-1 text-[0.8125rem] font-bold text-white num">
                  -{desconto}%
                </span>
              )}
            </p>
            {variante.precoDe && variante.precoDe > variante.precoPor && (
              <p className="num mt-1 text-[0.875rem] text-cinza">
                {copy.pdp.de} <s>{formatarPreco(variante.precoDe)}</s>
              </p>
            )}
            <p className="num mt-2 text-[1.0625rem] font-semibold text-sucesso">
              {formatarPreco(precoPix(variante.precoPor))} {copy.pdp.noPix}{" "}
              <span className="text-[0.8125rem] font-medium">
                ({DESCONTO_PIX_PCT}% {copy.pdp.off})
              </span>
            </p>
            <p className="num mt-0.5 text-[0.875rem] text-grafite">
              {copy.pdp.emAte} {parcela.vezes}x de {formatarPreco(parcela.valor)}{" "}
              {copy.pdp.semJuros}
            </p>
            {variante.estoque <= 5 && (
              <p className="mt-2 text-[0.8125rem] font-medium text-alerta">
                {copy.pdp.ultimasUnidades(variante.estoque)}
              </p>
            )}
          </>
        ) : (
          <p className="text-[1.125rem] font-semibold text-erro">{copy.pdp.esgotado}</p>
        )}
      </div>

      {/* variação — chips, não select (docs/03) */}
      {produto.variantes.length > 1 && (
        <fieldset className="mt-4">
          <legend className="text-[0.875rem] font-medium text-tinta">Opções</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {produto.variantes.map((v) => (
              <button
                key={v.sku}
                type="button"
                aria-pressed={v.sku === skuAtivo}
                disabled={v.estoque === 0}
                onClick={() => {
                  setSkuAtivo(v.sku);
                  setQuantidade(1);
                  setFretes(null);
                }}
                className={`min-h-[44px] rounded-[999px] border px-4 text-[0.875rem] font-medium transition-colors ${
                  v.sku === skuAtivo
                    ? "border-rosa bg-rosa-claro text-rosa-escuro"
                    : v.estoque === 0
                      ? "cursor-not-allowed border-linha text-cinza line-through"
                      : "border-linha text-grafite hover:border-rosa"
                }`}
              >
                {v.tituloVariacao}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {disponivel ? (
        <>
          {/* quantidade + CTA — fixo no rodapé em mobile: preço e CTA sempre
              visíveis sem rolagem em 360×640 (regra crítica de docs/03 §5) */}
          <p className="fixed inset-x-0 bottom-[72px] z-30 flex items-baseline justify-between border-t border-linha bg-white px-4 pt-2 md:hidden">
            <span className="num text-[1.0625rem] font-bold">{formatarPreco(variante.precoPor)}</span>
            <span className="num text-[0.875rem] font-semibold text-sucesso">
              {formatarPreco(precoPix(variante.precoPor))} {copy.pdp.noPix}
            </span>
          </p>
          <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 bg-white px-4 pb-4 pt-2 md:static md:mx-0 md:mt-5 md:border-0 md:p-0">
            <div className="flex items-center rounded-[999px] border border-linha">
              <button
                type="button"
                aria-label="Diminuir quantidade"
                onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
                disabled={quantidade <= 1}
                className="h-12 w-11 text-[1.125rem] text-grafite disabled:opacity-30"
              >
                −
              </button>
              <span className="num w-8 text-center text-[1rem] font-medium" aria-live="polite">
                {quantidade}
              </span>
              <button
                type="button"
                aria-label="Aumentar quantidade"
                onClick={() => setQuantidade((q) => Math.min(variante.estoque, q + 1))}
                disabled={quantidade >= variante.estoque}
                className="h-12 w-11 text-[1.125rem] text-grafite disabled:opacity-30"
              >
                +
              </button>
            </div>
            <button
              type="button"
              onClick={adicionar}
              className={`h-12 grow rounded-[999px] text-[1rem] font-semibold text-white transition-colors ${
                feedback ? "bg-sucesso" : "bg-rosa hover:bg-rosa-escuro"
              }`}
            >
              {feedback ? `✓ ${copy.pdp.adicionado}` : copy.pdp.adicionarSacola}
            </button>
          </div>

          {/* espaço para a barra fixa mobile não cobrir conteúdo */}
          <div aria-hidden="true" className="h-2 md:hidden" />

          {/* frete por CEP dentro da PDP — decisão de PRD */}
          <form onSubmit={calcular} className="mt-5 rounded-[10px] bg-superficie p-4">
            <label htmlFor="cep-pdp" className="flex items-center gap-1.5 text-[0.875rem] font-medium text-tinta">
              📍 {copy.pdp.calcularFrete}
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="cep-pdp"
                type="text"
                inputMode="numeric"
                autoComplete="postal-code"
                placeholder={copy.pdp.cepPlaceholder}
                value={cep}
                onChange={(e) => setCep(e.target.value)}
                aria-invalid={erroCep}
                aria-describedby={erroCep ? "cep-erro" : undefined}
                className="h-11 w-36 rounded-[6px] border border-linha bg-white px-3 text-[0.9375rem] num outline-none focus:border-azul"
              />
              <button
                type="submit"
                className="h-11 rounded-[6px] bg-azul px-5 text-[0.875rem] font-semibold text-white hover:opacity-90"
              >
                {copy.pdp.calcular}
              </button>
            </div>
            {erroCep && (
              <p id="cep-erro" className="mt-2 text-[0.8125rem] font-medium text-erro">
                {copy.pdp.cepErro}
              </p>
            )}
            {fretes && (
              <ul className="mt-3 space-y-1.5" aria-live="polite">
                {fretes.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-baseline justify-between rounded-[6px] bg-white px-3 py-2 text-[0.875rem]"
                  >
                    <span className="text-grafite">
                      {f.nome} · Chega até <strong className="num">{f.dataPrevista}</strong>
                    </span>
                    <span className={`num font-semibold ${f.valorCentavos === 0 ? "text-sucesso" : "text-tinta"}`}>
                      {f.valorCentavos === 0 ? "Grátis" : formatarPreco(f.valorCentavos)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </form>
        </>
      ) : (
        /* estado esgotado com avise-me — ticket 3.8 */
        <div className="mt-5 rounded-[10px] bg-superficie p-4">
          {aviseMeOk ? (
            <p role="status" className="text-[0.9375rem] font-medium text-sucesso">
              {copy.pdp.aviseMeOk}
            </p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (aviseMeEmail.includes("@")) setAviseMeOk(true);
              }}
            >
              <label htmlFor="avise-email" className="text-[0.875rem] font-medium text-tinta">
                {copy.pdp.aviseMe}
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="avise-email"
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  placeholder="seu@email.com"
                  value={aviseMeEmail}
                  onChange={(e) => setAviseMeEmail(e.target.value)}
                  className="h-11 grow rounded-[6px] border border-linha bg-white px-3 text-[0.9375rem] outline-none focus:border-azul"
                />
                <button
                  type="submit"
                  className="h-11 shrink-0 rounded-[6px] bg-azul px-5 text-[0.875rem] font-semibold text-white hover:opacity-90"
                >
                  Avisar
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* selos de confiança */}
      <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 text-[0.8125rem] text-grafite">
        <li>✓ {copy.pdp.distribuidorAutorizado}</li>
        <li>✓ {copy.pdp.trocaFacil}</li>
        <li>✓ {copy.pdp.envio24h}</li>
      </ul>
    </div>
  );
}
