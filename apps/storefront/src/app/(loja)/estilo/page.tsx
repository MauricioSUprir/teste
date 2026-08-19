import type { Metadata } from "next";
import { produtos } from "@/lib/catalogo/consultas";
import { CardProduto } from "@/components/produto/CardProduto";

export const metadata: Metadata = { title: "Guia de estilo", robots: { index: false } };

/** Página /estilo — ticket 0.4: paleta, escala tipográfica e componentes base. */
const cores = [
  ["--bn-roxo", "#4A2882", "Ação primária, preço em destaque"],
  ["--bn-roxo-escuro", "#381D65", "Hover/pressed, selo de oferta"],
  ["--bn-roxo-claro", "#F2EDFA", "Fundo de destaque suave"],
  ["--bn-violeta", "#6847C8", "Confiança: selos, informação, links"],
  ["--bn-violeta-claro", "#EFEBFA", "Fundo informativo"],
  ["--bn-tinta", "#14161A", "Texto principal"],
  ["--bn-grafite", "#4A4F57", "Texto secundário"],
  ["--bn-cinza", "#8A9099", "Texto terciário, placeholder"],
  ["--bn-linha", "#E4E6EA", "Bordas, divisores"],
  ["--bn-superficie", "#F7F8FA", "Fundo de seção"],
  ["--bn-sucesso", "#1E8E5A", "Em estoque, Pix, aprovado"],
  ["--bn-alerta", "#B8730C", "Últimas unidades, aviso"],
  ["--bn-erro", "#C6273E", "Erro, indisponível"],
] as const;

export default function PaginaEstilo() {
  return (
    <div className="container-bn py-10">
      <h1 className="font-titulo text-[clamp(1.625rem,3.5vw,2.25rem)] font-semibold">
        Guia de estilo BeautyNow
      </h1>
      <p className="mt-2 max-w-[70ch] text-[0.9375rem] text-grafite">
        Tokens de docs/03-design-system.md renderizados. Página interna de referência (noindex).
      </p>

      <h2 className="font-titulo mt-10 text-[1.375rem] font-semibold">Paleta</h2>
      <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
        {cores.map(([token, hexa, uso]) => (
          <li key={token} className="overflow-hidden rounded-[10px] border border-linha">
            <span className="block h-16" style={{ background: hexa }} />
            <span className="block p-3">
              <code className="block text-[0.75rem] font-semibold">{token}</code>
              <code className="num block text-[0.75rem] text-cinza">{hexa}</code>
              <span className="mt-1 block text-[0.75rem] leading-snug text-grafite">{uso}</span>
            </span>
          </li>
        ))}
      </ul>

      <h2 className="font-titulo mt-10 text-[1.375rem] font-semibold">Escala tipográfica</h2>
      <div className="mt-4 space-y-3 rounded-[10px] border border-linha p-5">
        <p className="font-titulo" style={{ fontSize: "var(--t-hero)" }}>Hero — Fraunces</p>
        <p className="font-titulo" style={{ fontSize: "var(--t-h1)" }}>H1 — Fraunces</p>
        <p className="font-titulo" style={{ fontSize: "var(--t-h2)" }}>H2 — Fraunces</p>
        <p style={{ fontSize: "var(--t-h3)" }} className="font-semibold">H3 — Inter Semibold</p>
        <p style={{ fontSize: "var(--t-corpo)" }}>Corpo — Inter Regular, para texto de interface e leitura.</p>
        <p style={{ fontSize: "var(--t-peq)" }} className="text-grafite">Pequeno — informações de apoio.</p>
        <p style={{ fontSize: "var(--t-micro)" }} className="text-cinza">MICRO — MARCA, SELOS E METADADOS.</p>
        <p className="num text-[1.25rem] font-semibold">R$ 1.234,56 — preço sempre tabular-nums</p>
      </div>

      <h2 className="font-titulo mt-10 text-[1.375rem] font-semibold">Botões</h2>
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[10px] border border-linha p-5">
        <button type="button" className="rounded-[999px] bg-roxo px-6 py-3 text-[0.9375rem] font-semibold text-white hover:bg-roxo-escuro">
          Ação primária
        </button>
        <button type="button" className="rounded-[999px] border-2 border-tinta px-6 py-3 text-[0.9375rem] font-semibold text-tinta hover:bg-superficie">
          Ação secundária
        </button>
        <button type="button" className="rounded-[6px] bg-violeta px-5 py-2.5 text-[0.875rem] font-semibold text-white">
          Ação informativa
        </button>
        <button type="button" disabled className="rounded-[999px] bg-cinza px-6 py-3 text-[0.9375rem] font-semibold text-white">
          Desabilitado
        </button>
      </div>

      <h2 className="font-titulo mt-10 text-[1.375rem] font-semibold">
        CardProduto — estados (ticket 2.4)
      </h2>
      <p className="mt-1 text-[0.875rem] text-grafite">
        Com desconto · esgotado · com variações · sem avaliação · lançamento.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {[
          "keralab-shampoo-reconstrutor-queratina",
          "keralab-acidificante-ph-balance",
          "colorpro-base-liquida-hd",
          "keralab-ampola-choque-queratina",
          "nuvelle-creme-cachos-definidos",
        ].map((slug) => {
          const p = produtos.find((x) => x.slug === slug);
          return p ? <CardProduto key={slug} produto={p} /> : null;
        })}
      </div>
    </div>
  );
}
