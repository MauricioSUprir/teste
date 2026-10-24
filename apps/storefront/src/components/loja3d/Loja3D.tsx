"use client";

/**
 * Loja 3D — moldura React da cena (components/loja3d/cena.ts): botões dos
 * corredores, dica de como andar e o card do produto selecionado no canto
 * vazio da tela. O card é o mesmo CardProduto do site (preço, Pix, Adicionar),
 * então a sacola e o pagamento são os de sempre.
 *
 * three.js só baixa nesta página (import dinâmico) — as outras não pesam nada.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { copy } from "@/lib/copy";
import { LOJA } from "@/lib/loja";
import type { Produto } from "@/lib/catalogo/tipos";
import { CardProduto } from "@/components/produto/CardProduto";
import type { Cena, PosicaoCena } from "./cena";

const t = copy.loja3d;
const BASE_IMAGEM = "https://comercial.thebeautyhub.app/api/ecom/imagem/";

// Quem abre um produto e toca em "Voltar" cai no mesmo corredor, com o mesmo card aberto.
const CHAVE_VOLTA = "bn:loja3d";
type Volta = PosicaoCena & { slug: string | null };

function lerVolta(): Volta | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(CHAVE_VOLTA) ?? "null") as Partial<Volta> | null;
    if (!v || ![v.x, v.z, v.yaw, v.pitch].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
    return v as Volta;
  } catch {
    return null;
  }
}

export interface Corredor3D {
  slug: string;
  nome: string;
  produtos: Produto[];
}

export function Loja3D({ corredores }: { corredores: Corredor3D[] }) {
  const moldura = useRef<HTMLDivElement>(null);
  const palco = useRef<HTMLDivElement>(null);
  const cena = useRef<Cena | null>(null);
  const [estado, setEstado] = useState<"montando" | "pronta" | "erro">("montando");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [corredorAtual, setCorredorAtual] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [mostrarDica, setMostrarDica] = useState(true);
  const [toque, setToque] = useState(false);
  const selecionadoAgora = useRef<string | null>(null);
  useEffect(() => {
    selecionadoAgora.current = selecionado;
  }, [selecionado]);

  const porSlug = useMemo(() => {
    const mapa = new Map<string, Produto>();
    for (const c of corredores) for (const p of c.produtos) mapa.set(p.slug, p);
    return mapa;
  }, [corredores]);
  const produto = selecionado ? porSlug.get(selecionado) : undefined;

  // a moldura ocupa o resto da tela abaixo do cabeçalho
  useEffect(() => {
    const el = moldura.current;
    if (!el) return;
    const ajustar = () => {
      const topo = el.getBoundingClientRect().top + window.scrollY;
      el.style.height = `${Math.max(480, window.innerHeight - Math.min(topo, window.innerHeight * 0.4))}px`;
    };
    ajustar();
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, []);

  useEffect(() => {
    setToque(window.matchMedia("(pointer: coarse)").matches);
    const el = palco.current;
    if (!el) return;
    let cancelado = false;
    const volta = lerVolta();
    (async () => {
      try {
        const [{ criarCena }] = await Promise.all([import("./cena"), document.fonts?.ready]);
        if (cancelado) return;
        if (volta?.slug && corredores.some((c) => c.produtos.some((p) => p.slug === volta.slug))) {
          setSelecionado(volta.slug);
        }
        const raiz = getComputedStyle(document.documentElement);
        const cor = (nome: string, padrao: string) => raiz.getPropertyValue(nome).trim() || padrao;
        cena.current = criarCena(el, {
          corredores: corredores.map((c, i) => ({
            numero: String(i + 1).padStart(2, "0"),
            nome: c.nome,
            produtos: c.produtos
              .filter((p) => p.imagens?.length)
              .map((p) => {
                const foto = p.imagens![0];
                return { slug: p.slug, foto: foto.startsWith("http") ? foto : BASE_IMAGEM + foto };
              }),
          })),
          nomeLoja: LOJA.nome,
          corPrimaria: cor("--bn-roxo", "#6B2BD9"),
          corEscura: cor("--bn-roxo-escuro", "#3E1A8C"),
          fonte: getComputedStyle(document.body).fontFamily || "sans-serif",
          aoSelecionarProduto: (slug) => setSelecionado(slug),
          aoMudarCorredor: (i) => setCorredorAtual(i),
          aoChegarPrateleira: () => setAviso(t.naPrateleira),
          inicio: volta ?? undefined,
        });
        setEstado("pronta");
      } catch {
        if (!cancelado) setEstado("erro");
      }
    })();
    return () => {
      cancelado = true;
      if (cena.current) {
        try {
          sessionStorage.setItem(CHAVE_VOLTA, JSON.stringify({ ...cena.current.posicao(), slug: selecionadoAgora.current }));
        } catch {
          // sem armazenamento: volta pela entrada
        }
      }
      cena.current?.destruir();
      cena.current = null;
    };
  }, [corredores]);

  // a dica some sozinha; o aviso da prateleira também
  useEffect(() => {
    if (estado !== "pronta") return;
    const id = setTimeout(() => setMostrarDica(false), 7000);
    return () => clearTimeout(id);
  }, [estado]);
  useEffect(() => {
    if (!aviso) return;
    const id = setTimeout(() => setAviso(null), 3500);
    return () => clearTimeout(id);
  }, [aviso]);

  if (estado === "erro") {
    return (
      <div className="container-bn py-16 text-center">
        <p className="mx-auto max-w-[52ch] text-[0.9375rem] text-grafite">{t.semWebgl}</p>
        <Link href="/" className="mt-4 inline-block font-medium text-violeta underline">
          {t.verEmLista}
        </Link>
      </div>
    );
  }

  const corredor = corredorAtual !== null ? corredores[corredorAtual] : null;

  return (
    <div ref={moldura} className="relative w-full overflow-hidden bg-[#f3f3f6]">
      <div
        ref={palco}
        className="absolute inset-0 outline-none"
        tabIndex={0}
        role="application"
        aria-label={t.rotuloCena}
      />

      {estado === "montando" && (
        <p role="status" className="absolute inset-0 flex items-center justify-center text-[0.9375rem] font-medium text-grafite">
          {t.montando}
        </p>
      )}

      {/* dica de uso e aviso de chegada na prateleira */}
      {estado === "pronta" && (mostrarDica || aviso) && (
        <p
          role="status"
          className="pointer-events-none absolute left-1/2 top-4 max-w-[90%] -translate-x-1/2 rounded-[40px] bg-tinta/85 px-4 py-2 text-center text-[0.8125rem] font-medium text-white"
        >
          {aviso ?? (toque ? t.dicaToque : t.dica)}
        </p>
      )}

      {/* corredores */}
      {estado === "pronta" && (
        <nav
          aria-label={t.corredores}
          className="absolute inset-x-0 bottom-0 flex gap-2 overflow-x-auto bg-gradient-to-t from-black/25 to-transparent px-4 pb-4 pt-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <button
            type="button"
            onClick={() => cena.current?.irParaEntrada()}
            aria-pressed={corredorAtual === null}
            className={`shrink-0 rounded-[40px] px-3.5 py-2 text-[0.8125rem] font-semibold shadow-sm ${
              corredorAtual === null ? "bg-roxo text-white" : "bg-white text-tinta hover:text-roxo"
            }`}
          >
            {t.entrada}
          </button>
          {corredores.map((c, i) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => cena.current?.irParaCorredor(i)}
              aria-pressed={corredorAtual === i}
              className={`shrink-0 whitespace-nowrap rounded-[40px] px-3.5 py-2 text-[0.8125rem] font-semibold shadow-sm ${
                corredorAtual === i ? "bg-roxo text-white" : "bg-white text-tinta hover:text-roxo"
              }`}
            >
              <span className="num opacity-70">{String(i + 1).padStart(2, "0")}</span> {c.nome}
            </button>
          ))}
        </nav>
      )}

      {/* dentro de um corredor: atalho para a lista completa da categoria */}
      {estado === "pronta" && corredor && !produto && (
        <Link
          href={`/categoria/${corredor.slug}`}
          className="absolute right-4 top-4 rounded-[40px] bg-white px-4 py-2 text-[0.8125rem] font-semibold text-roxo shadow-sm hover:bg-roxo-claro"
        >
          {t.verTodos(corredor.nome)} →
        </Link>
      )}

      {/* card do produto no canto vazio da tela — o mesmo do site */}
      {produto && (
        <aside
          aria-label={produto.titulo}
          className="absolute bottom-20 right-3 w-[min(210px,calc(100%-24px))] md:bottom-auto md:right-5 md:top-5 md:w-[260px]"
        >
          <div className="relative rounded-[10px] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
            <button
              type="button"
              onClick={() => setSelecionado(null)}
              aria-label={t.fechar}
              className="absolute -right-2 -top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-tinta text-white shadow hover:bg-black"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M2 2 L10 10 M10 2 L2 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
            <CardProduto key={produto.slug} produto={produto} prioridade />
          </div>
        </aside>
      )}
    </div>
  );
}
