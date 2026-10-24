"use client";

/**
 * Loja 3D — moldura React da cena (components/loja3d/cena.ts): botões da visão
 * geral e de cada categoria, dica de como andar, atalho para a marca da seção
 * onde a pessoa parou e o card do produto selecionado no canto vazio da tela.
 * O card é o mesmo CardProduto do site (preço, Pix, Adicionar); o Adicionar põe
 * na sacola de sempre sem abrir a gaveta, e a cena mostra o produto caindo na cesta.
 *
 * three.js só baixa nesta página (import dinâmico) — as outras não pesam nada.
 * Só abre no computador: no celular e no tablet aparece o convite para a loja normal.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { copy } from "@/lib/copy";
import { LOJA } from "@/lib/loja";
import { useEhComputador } from "@/lib/dispositivo";
import { useCarrinho } from "@/lib/carrinho/contexto";
import type { Produto } from "@/lib/catalogo/tipos";
import { CardProduto } from "@/components/produto/CardProduto";
import type { Cena, ModoCena, PosicaoCena, Qualidade } from "./cena";

const t = copy.loja3d;
const BASE_IMAGEM = "https://comercial.thebeautyhub.app/api/ecom/imagem/";

// Quem abre um produto e toca em "Voltar" cai no mesmo lugar da loja, com o mesmo card aberto.
const CHAVE_VOLTA = "bn:loja3d";
type Volta = PosicaoCena & { slug: string | null };

function lerVolta(): Volta | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(CHAVE_VOLTA) ?? "null") as Partial<Volta> | null;
    if (!v || (v.modo !== "alto" && v.modo !== "perto")) return null;
    if (![v.x, v.z, v.yaw, v.pitch].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
    return v as Volta;
  } catch {
    return null;
  }
}

/** ?qualidade=alta|media|baixa fixa a qualidade (para conferir a imagem); sem isso ela se ajusta sozinha */
function qualidadeDaUrl(): Qualidade | undefined {
  const q = new URLSearchParams(window.location.search).get("qualidade");
  return q === "alta" || q === "media" || q === "baixa" ? q : undefined;
}

/** uma seção da loja = uma marca */
export interface Setor3D {
  slug: string;
  nome: string;
  logo?: string;
  categoria: string;
  produtos: Produto[];
}

export interface Categoria3D {
  slug: string;
  nome: string;
}

export function Loja3D({ setores, categorias }: { setores: Setor3D[]; categorias: Categoria3D[] }) {
  const moldura = useRef<HTMLDivElement>(null);
  const palco = useRef<HTMLDivElement>(null);
  const cena = useRef<Cena | null>(null);
  const [estado, setEstado] = useState<"montando" | "pronta" | "erro">("montando");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [setorAtual, setSetorAtual] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [mostrarDica, setMostrarDica] = useState(true);
  const [modo, setModo] = useState<ModoCena>("perto");
  const computador = useEhComputador();
  const carrinho = useCarrinho();
  const selecionadoAgora = useRef<string | null>(null);
  useEffect(() => {
    selecionadoAgora.current = selecionado;
  }, [selecionado]);

  const porSlug = useMemo(() => {
    const mapa = new Map<string, Produto>();
    for (const s of setores) for (const p of s.produtos) mapa.set(p.slug, p);
    return mapa;
  }, [setores]);
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
    if (!computador) return;
    const el = palco.current;
    if (!el) return;
    let cancelado = false;
    const volta = lerVolta();
    (async () => {
      try {
        const [{ criarCena }] = await Promise.all([import("./cena"), document.fonts?.ready]);
        if (cancelado) return;
        if (volta?.slug && porSlug.has(volta.slug)) setSelecionado(volta.slug);
        const raiz = getComputedStyle(document.documentElement);
        const cor = (nome: string, padrao: string) => raiz.getPropertyValue(nome).trim() || padrao;
        const profissional = LOJA.id === "be2beauty";
        cena.current = criarCena(el, {
          setores: setores.map((s) => ({
            slug: s.slug,
            nome: s.nome,
            logo: s.logo,
            categoria: s.categoria,
            produtos: s.produtos
              .filter((p) => p.imagens?.length)
              .map((p) => {
                const foto = p.imagens![0];
                return { slug: p.slug, foto: foto.startsWith("http") ? foto : BASE_IMAGEM + foto };
              }),
          })),
          categorias: categorias.map((c) => c.slug),
          estilo: profissional ? "profissional" : "conceito",
          logo: [...t.logo],
          fraseVitrine: t.fraseVitrine,
          tituloDestaques: t.destaques,
          corPrimaria: cor("--bn-roxo", "#6B2BD9"),
          corEscura: cor("--bn-roxo-escuro", "#3E1A8C"),
          // a cesta é roxa; na Be2Beauty, do azul da marca
          corCesta: profissional ? cor("--bn-roxo", "#1f5fa8") : "#6d35d8",
          fonte: getComputedStyle(document.body).fontFamily || "sans-serif",
          qualidade: qualidadeDaUrl(),
          aoSelecionarProduto: (slug) => setSelecionado(slug),
          aoMudarSetor: (i) => setSetorAtual(i),
          aoMudarModo: (m) => setModo(m),
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
  }, [setores, categorias, porSlug, computador]);

  // a cesta espelha a sacola: o que entra agora voa da prateleira; o resto já está lá
  const quantidades = useRef<Map<string, number> | null>(null);
  useEffect(() => {
    if (estado !== "pronta" || !cena.current) return;
    const agora = new Map<string, number>();
    for (const i of carrinho.itens) agora.set(i.produtoSlug, (agora.get(i.produtoSlug) ?? 0) + i.quantidade);
    const antes = quantidades.current;
    const lista = [...agora.entries()].flatMap(([slug, q]) => Array.from({ length: Math.min(q, 3) }, () => slug));
    const novos = antes ? [...agora.entries()].filter(([slug, q]) => q > (antes.get(slug) ?? 0)).map(([slug]) => slug) : [];
    const removeu = antes ? [...antes.entries()].some(([slug, q]) => (agora.get(slug) ?? 0) < q) : true;
    if (removeu || !antes) cena.current.definirCesta(lista);
    else for (const slug of novos) cena.current.colocarNaCesta(slug);
    quantidades.current = agora;
  }, [carrinho.itens, estado]);

  // a dica some sozinha; o aviso da prateleira também
  useEffect(() => {
    if (estado !== "pronta") return;
    const id = setTimeout(() => setMostrarDica(false), 9000);
    return () => clearTimeout(id);
  }, [estado]);
  useEffect(() => {
    if (!aviso) return;
    const id = setTimeout(() => setAviso(null), 3500);
    return () => clearTimeout(id);
  }, [aviso]);

  if (computador === false) {
    return (
      <div className="container-bn py-16 text-center">
        <p className="text-[1.125rem] font-semibold text-tinta">{t.soComputador}</p>
        <p className="mx-auto mt-2 max-w-[48ch] text-[0.9375rem] text-grafite">{t.soComputadorTexto}</p>
        <Link
          href="/"
          className="mt-6 inline-flex h-11 items-center rounded-[40px] bg-roxo px-6 text-[0.9375rem] font-semibold text-white hover:bg-roxo-escuro"
        >
          {t.irParaLoja}
        </Link>
      </div>
    );
  }

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

  const setor = setorAtual !== null ? setores[setorAtual] : null;
  const categoriaAtual = setor?.categoria ?? null;

  return (
    <div ref={moldura} className="relative w-full overflow-hidden bg-[#ecebee]">
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
          {aviso ?? (modo === "alto" ? t.dicaAlto : t.dica)}
        </p>
      )}

      {/* visão geral e categorias */}
      {estado === "pronta" && (
        <nav
          aria-label={t.setores}
          className="absolute inset-x-0 bottom-0 flex gap-2 overflow-x-auto bg-gradient-to-t from-black/25 to-transparent px-4 pb-4 pt-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <button
            type="button"
            onClick={() => cena.current?.irParaVisaoGeral()}
            aria-pressed={modo === "alto"}
            className={`shrink-0 rounded-[40px] px-3.5 py-2 text-[0.8125rem] font-semibold shadow-sm ${
              modo === "alto" ? "bg-roxo text-white" : "bg-white text-tinta hover:text-roxo"
            }`}
          >
            {t.visaoGeral}
          </button>
          {categorias.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => cena.current?.irParaCategoria(c.slug)}
              aria-pressed={categoriaAtual === c.slug}
              className={`shrink-0 whitespace-nowrap rounded-[40px] px-3.5 py-2 text-[0.8125rem] font-semibold shadow-sm ${
                categoriaAtual === c.slug ? "bg-roxo text-white" : "bg-white text-tinta hover:text-roxo"
              }`}
            >
              {c.nome}
            </button>
          ))}
        </nav>
      )}

      {/* na seção de uma marca: atalho para a página dela */}
      {estado === "pronta" && setor && !produto && (
        <Link
          href={`/marca/${setor.slug}`}
          className="absolute right-4 top-4 rounded-[40px] bg-white px-4 py-2 text-[0.8125rem] font-semibold text-roxo shadow-sm hover:bg-roxo-claro"
        >
          {t.verTodos(setor.nome)} →
        </Link>
      )}

      {/* card do produto no canto vazio da tela — o mesmo do site */}
      {produto && (
        <aside aria-label={produto.titulo} className="absolute right-5 top-5 w-[260px]">
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
            <CardProduto key={produto.slug} produto={produto} prioridade abrirSacola={false} />
          </div>
        </aside>
      )}
    </div>
  );
}
