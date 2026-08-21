"use client";

/**
 * Gráfico de barras de receita por faixa de tempo — SVG puro, sem biblioteca.
 * Specs do design de dados: barras finas com topo arredondado (4px) ancorado
 * na linha de base, 2px de respiro entre barras, grade recessiva, texto em
 * tinta (nunca na cor da série), tooltip por barra e rótulo direto apenas no
 * pico. Visão em tabela disponível para leitores de tela e conferência.
 */
import { useId, useState } from "react";
import type { Faixa } from "@/lib/analise";
import { formatarPreco } from "@/lib/preco";

const LARGURA = 720;
const ALTURA = 240;
const PAD_ESQ = 64;
const PAD_DIR = 8;
const PAD_TOPO = 18;
const PAD_BASE = 26;

const COR_BARRA = "#6847C8"; // violeta — validada (banda de luminância, contraste, CVD)
const COR_BARRA_ATIVA = "#4A2882";
const COR_GRADE = "#E4E6EA";
const COR_TEXTO = "#4A4F57";
const COR_TEXTO_FRACO = "#8A9099";

/** teto "bonito" para o eixo: 1/2/5 × 10^n */
function tetoEixo(maximo: number): number {
  if (maximo <= 0) return 10000; // R$ 100 de teto para gráfico vazio
  const expoente = Math.floor(Math.log10(maximo));
  const base = Math.pow(10, expoente);
  for (const m of [1, 2, 5, 10]) {
    if (maximo <= m * base) return m * base;
  }
  return 10 * base;
}

const reaisCurto = (centavos: number) => {
  const reais = centavos / 100;
  if (reais >= 1000) return `R$ ${(reais / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `R$ ${reais.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
};

export function GraficoBarras({ faixas, titulo }: { faixas: Faixa[]; titulo: string }) {
  const [ativa, setAtiva] = useState<number | null>(null);
  const idClip = useId();

  const maximo = Math.max(...faixas.map((f) => f.totalCentavos));
  const teto = tetoEixo(maximo);
  const areaLarg = LARGURA - PAD_ESQ - PAD_DIR;
  const areaAlt = ALTURA - PAD_TOPO - PAD_BASE;
  const baseY = PAD_TOPO + areaAlt;
  const n = faixas.length;
  const passo = areaLarg / n;
  const largBarra = Math.max(3, Math.min(28, passo - 2));

  const alturaDe = (v: number) => (v / teto) * areaAlt;
  const indicePico = maximo > 0 ? faixas.findIndex((f) => f.totalCentavos === maximo) : -1;

  // rótulos do eixo x: no máximo ~8, espaçados uniformemente
  const cadaQuantos = Math.max(1, Math.ceil(n / 8));

  const vazio = maximo === 0;

  return (
    <div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${LARGURA} ${ALTURA}`}
          role="img"
          aria-label={`${titulo}: gráfico de barras de receita por período`}
          style={{ width: "100%", height: "auto", display: "block" }}
        >
          <defs>
            {/* âncora o arredondamento só no topo: barra estendida 4px abaixo da base, cortada aqui */}
            <clipPath id={idClip}>
              <rect x="0" y="0" width={LARGURA} height={baseY} />
            </clipPath>
          </defs>

          {/* grade recessiva: 3 linhas + base */}
          {[1 / 3, 2 / 3, 1].map((fr) => (
            <g key={fr}>
              <line
                x1={PAD_ESQ}
                x2={LARGURA - PAD_DIR}
                y1={baseY - areaAlt * fr}
                y2={baseY - areaAlt * fr}
                stroke={COR_GRADE}
                strokeWidth="1"
              />
              <text
                x={PAD_ESQ - 8}
                y={baseY - areaAlt * fr + 4}
                textAnchor="end"
                fontSize="11"
                fill={COR_TEXTO_FRACO}
                className="num"
              >
                {reaisCurto(teto * fr)}
              </text>
            </g>
          ))}
          <line x1={PAD_ESQ} x2={LARGURA - PAD_DIR} y1={baseY} y2={baseY} stroke={COR_GRADE} strokeWidth="1" />
          <text x={PAD_ESQ - 8} y={baseY + 4} textAnchor="end" fontSize="11" fill={COR_TEXTO_FRACO} className="num">
            R$ 0
          </text>

          {/* barras */}
          <g clipPath={`url(#${idClip})`}>
            {faixas.map((f, i) => {
              const x = PAD_ESQ + i * passo + (passo - largBarra) / 2;
              const alt = alturaDe(f.totalCentavos);
              if (f.totalCentavos === 0) return null;
              return (
                <rect
                  key={f.rotulo}
                  x={x}
                  y={baseY - alt}
                  width={largBarra}
                  height={alt + 4}
                  rx="4"
                  fill={ativa === i ? COR_BARRA_ATIVA : COR_BARRA}
                />
              );
            })}
          </g>

          {/* alvos de hover maiores que a barra (coluna inteira) */}
          {faixas.map((f, i) => (
            <rect
              key={`alvo-${f.rotulo}`}
              x={PAD_ESQ + i * passo}
              y={PAD_TOPO}
              width={passo}
              height={areaAlt}
              fill="transparent"
              onMouseEnter={() => setAtiva(i)}
              onMouseLeave={() => setAtiva(null)}
            />
          ))}

          {/* rótulo direto apenas no pico */}
          {indicePico >= 0 && ativa === null && (
            <text
              x={PAD_ESQ + indicePico * passo + passo / 2}
              y={baseY - alturaDe(faixas[indicePico].totalCentavos) - 6}
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill={COR_TEXTO}
              className="num"
            >
              {reaisCurto(faixas[indicePico].totalCentavos)}
            </text>
          )}

          {/* eixo x seletivo */}
          {faixas.map((f, i) =>
            i % cadaQuantos === 0 ? (
              <text
                key={`eixo-${f.rotulo}`}
                x={PAD_ESQ + i * passo + passo / 2}
                y={ALTURA - 8}
                textAnchor="middle"
                fontSize="11"
                fill={COR_TEXTO_FRACO}
              >
                {f.rotuloEixo}
              </text>
            ) : null
          )}

          {vazio && (
            <text x={PAD_ESQ + areaLarg / 2} y={PAD_TOPO + areaAlt / 2} textAnchor="middle" fontSize="13" fill={COR_TEXTO_FRACO}>
              Sem vendas neste período ainda
            </text>
          )}
        </svg>

        {/* tooltip */}
        {ativa !== null && faixas[ativa] && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 rounded-[6px] border border-linha bg-white px-3 py-1.5 text-[0.75rem] shadow-card"
            style={{
              left: `${((PAD_ESQ + ativa * passo + passo / 2) / LARGURA) * 100}%`,
              top: 0,
            }}
          >
            <span className="block font-medium text-tinta">{faixas[ativa].rotulo}</span>
            <span className="num block text-grafite">
              {formatarPreco(faixas[ativa].totalCentavos)} ·{" "}
              {faixas[ativa].qtdPedidos === 1 ? "1 pedido" : `${faixas[ativa].qtdPedidos} pedidos`}
            </span>
          </div>
        )}
      </div>

      {/* visão em tabela — acessibilidade e conferência */}
      {!vazio && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[0.75rem] text-cinza underline">
            Ver como tabela
          </summary>
          <table className="mt-2 w-full max-w-md text-[0.8125rem]">
            <thead>
              <tr className="text-left text-[0.6875rem] uppercase tracking-wide text-cinza">
                <th className="py-1 font-semibold">Período</th>
                <th className="py-1 text-right font-semibold">Receita</th>
                <th className="py-1 text-right font-semibold">Pedidos</th>
              </tr>
            </thead>
            <tbody>
              {faixas
                .filter((f) => f.qtdPedidos > 0)
                .map((f) => (
                  <tr key={f.rotulo} className="border-t border-linha">
                    <td className="py-1 text-grafite">{f.rotulo}</td>
                    <td className="num py-1 text-right">{formatarPreco(f.totalCentavos)}</td>
                    <td className="num py-1 text-right">{f.qtdPedidos}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}

/** barras horizontais ranqueadas (top produtos, formas de pagamento) — uma cor, identidade no rótulo */
export function BarrasRanqueadas({ itens, formatoQtd }: { itens: { rotulo: string; totalCentavos: number; qtd: number }[]; formatoQtd: (qtd: number) => string }) {
  const maximo = Math.max(...itens.map((i) => i.totalCentavos), 1);
  if (itens.length === 0) {
    return <p className="text-[0.8125rem] text-cinza">Sem dados neste período ainda.</p>;
  }
  return (
    <ul className="space-y-3">
      {itens.map((item) => (
        <li key={item.rotulo}>
          <div className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
            <span className="min-w-0 truncate text-tinta">{item.rotulo}</span>
            <span className="num shrink-0 font-semibold text-tinta">{formatarPreco(item.totalCentavos)}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="h-2 grow overflow-hidden rounded-[999px] bg-superficie">
              <span
                className="block h-full rounded-[999px]"
                style={{ width: `${(item.totalCentavos / maximo) * 100}%`, background: "#6847C8" }}
              />
            </span>
            <span className="num shrink-0 text-[0.6875rem] text-cinza">{formatoQtd(item.qtd)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
