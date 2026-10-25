"use client";

/**
 * Loja 3D — moldura React da cena (components/loja3d/cena.ts): botões da visão
 * geral e de cada categoria, dica de como andar, atalho para a marca da seção
 * onde a pessoa parou e o card do produto selecionado no canto vazio da tela.
 * O card é o mesmo CardProduto do site (preço, Pix, Adicionar); o Adicionar põe
 * na sacola de sempre sem abrir a gaveta, e a cena mostra o produto caindo na cesta.
 *
 * Também: o guia "onde fica?" (busca de produto/marca que acende a trilha no
 * chão), o botão do som e o card da Larissa, que leva ao WhatsApp já com o
 * que está na cesta. As etiquetas de preço da cena seguem os preços do painel.
 *
 * three.js só baixa nesta página (import dinâmico) — as outras não pesam nada.
 * No celular e no tablet a cena começa mais leve, ganha o controle de andar na
 * tela (ControleAndar) e os cards sobem da parte de baixo da tela.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { copy } from "@/lib/copy";
import { LOJA } from "@/lib/loja";
import { NEGOCIO, linkWhatsapp } from "@/lib/negocio";
import { comBase } from "@/lib/caminho";
import { percentualDesconto } from "@/lib/preco";
import { useToque } from "@/lib/dispositivo";
import { useCarrinho } from "@/lib/carrinho/contexto";
import { EVENTO_AJUSTES, aplicarAjustesProduto } from "@/lib/catalogo/ajustes";
import { normalizar } from "@/lib/catalogo/busca";
import { listarBanners } from "@/lib/servidor";
import type { Produto } from "@/lib/catalogo/tipos";
import { CardProduto } from "@/components/produto/CardProduto";
import { ControleAndar } from "./ControleAndar";
import type { AlvoGuia, Cena, ModoCena, PosicaoCena, PrecoCena, Qualidade } from "./cena";

const t = copy.loja3d;
const BASE_IMAGEM = "https://comercial.thebeautyhub.app/api/ecom/imagem/";

// Quem abre um produto e toca em "Voltar" cai no mesmo lugar da loja, com o mesmo card aberto.
const CHAVE_VOLTA = "bn:loja3d";
const CHAVE_SOM = "bn:som";
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

function lerSom(): boolean {
  try {
    return localStorage.getItem(CHAVE_SOM) !== "0";
  } catch {
    return true;
  }
}

/** ?qualidade=alta|media|baixa fixa a qualidade (para conferir a imagem); sem isso ela se ajusta sozinha */
function qualidadeDaUrl(): Qualidade | undefined {
  const q = new URLSearchParams(window.location.search).get("qualidade");
  return q === "alta" || q === "media" || q === "baixa" ? q : undefined;
}

/** o preço que o card mostra (variação com estoque), em centavos, e o % de promoção */
function precoDe(p: Produto): PrecoCena {
  const v = p.variantes.find((x) => x.estoque > 0) ?? p.variantes[0];
  const promo = v?.precoDe && v.precoDe > v.precoPor ? percentualDesconto(v.precoDe, v.precoPor) : null;
  return { preco: v?.precoPor ?? 0, desconto: promo };
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

/** sem acento e sem pontuação: "kpro" acha "K.Pro" e "k pro" também */
const limpar = (texto: string) => normalizar(texto).replace(/[^a-z0-9\s]/g, "");

interface Sugestao {
  chave: string;
  alvo: AlvoGuia;
  nome: string;
  detalhe: string;
}

const iconeFechar = (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
    <path d="M2 2 L10 10 M10 2 L2 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

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
  const [larissaAberta, setLarissaAberta] = useState(false);
  const [som, setSom] = useState(true);
  const [busca, setBusca] = useState<string | null>(null); // null = fechada
  const [marcada, setMarcada] = useState(0);
  const [guia, setGuia] = useState<string | null>(null); // nome do destino
  const toque = useToque();
  const carrinho = useCarrinho();
  const selecionadoAgora = useRef<string | null>(null);
  useEffect(() => {
    selecionadoAgora.current = selecionado;
  }, [selecionado]);
  useEffect(() => setSom(lerSom()), []);

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
    if (toque === null) return; // espera saber se é celular (a cena nasce leve ou não)
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
              .map((p) => aplicarAjustesProduto(p)) // o admin pode ter mudado preço ou tirado o produto
              .filter((p): p is Produto => !!p && !!p.imagens?.length)
              .map((p) => {
                const foto = p.imagens![0];
                return { slug: p.slug, titulo: p.titulo, foto: foto.startsWith("http") ? foto : BASE_IMAGEM + foto, ...precoDe(p) };
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
          celular: toque,
          aoSelecionarProduto: (slug) => {
            setLarissaAberta(false);
            setSelecionado(slug);
          },
          aoMudarSetor: (i) => setSetorAtual(i),
          aoMudarModo: (m) => setModo(m),
          aoChegarPrateleira: () => setAviso(t.naPrateleira),
          inicio: volta ?? undefined,
          urlModelos: comBase("/loja3d/modelos/"),
          // atendente 3D com o blazer da loja
          larissa: { nome: t.larissa.nome, balao: toque ? t.larissa.balaoToque : t.larissa.balao, modelo: comBase(`/loja3d/modelos/atendente-${profissional ? "azul" : "roxa"}.glb`) },
          aoFalarComLarissa: () => {
            setSelecionado(null);
            setLarissaAberta(true);
          },
          aoChegarNoGuia: () => {
            setGuia(null);
            setAviso(t.guia.chegou);
          },
          somLigado: lerSom(),
        });
        setEstado("pronta");
        // painel de LED atrás do caixa: os mesmos banners do carrossel da home (na Be2Beauty, com a arte de abertura)
        void listarBanners().then((lista) => {
          if (cancelado) return;
          const intro = LOJA.vitrineProfissional ? [comBase("/banner-b2b-intro.webp")] : [];
          cena.current?.definirBanners([...intro, ...lista.map((b) => b.url)]);
        });
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
  }, [setores, categorias, porSlug, toque]);

  // preço mudou no painel (chega do servidor depois de abrir): as etiquetas acompanham
  useEffect(() => {
    if (estado !== "pronta") return;
    const atualizar = () => {
      const precos = new Map<string, PrecoCena>();
      for (const p of porSlug.values()) {
        const a = aplicarAjustesProduto(p);
        if (a) precos.set(p.slug, precoDe(a));
      }
      cena.current?.atualizarPrecos(precos);
    };
    window.addEventListener(EVENTO_AJUSTES, atualizar);
    return () => window.removeEventListener(EVENTO_AJUSTES, atualizar);
  }, [estado, porSlug]);

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

  // ---- guia "onde fica?": marcas primeiro, depois produtos (todas as palavras têm de aparecer)
  const indice = useMemo(() => {
    const marcas: Sugestao[] = setores.map((s) => ({ chave: `m:${s.slug}`, alvo: { marca: s.slug }, nome: s.nome, detalhe: t.guia.marca }));
    const itens: Sugestao[] = setores.flatMap((s) =>
      s.produtos.map((p) => ({ chave: `p:${p.slug}`, alvo: { produto: p.slug }, nome: p.titulo, detalhe: s.nome }))
    );
    return [...marcas, ...itens].map((x) => ({ ...x, texto: limpar(`${x.nome} ${x.detalhe}`) }));
  }, [setores]);
  const sugestoes = useMemo(() => {
    const palavras = limpar(busca ?? "").split(/\s+/).filter(Boolean);
    if (!palavras.length) return [];
    return indice.filter((x) => palavras.every((w) => x.texto.includes(w))).slice(0, 8);
  }, [busca, indice]);
  useEffect(() => setMarcada(0), [busca]);
  function escolher(s: Sugestao) {
    setBusca(null);
    setSelecionado(null);
    setLarissaAberta(false);
    if (cena.current?.guiarPara(s.alvo)) setGuia(s.nome);
    else setAviso(t.guia.semResultado);
    palco.current?.focus();
  }

  function alternarSom() {
    const novo = !som;
    setSom(novo);
    cena.current?.definirSom(novo);
    try {
      localStorage.setItem(CHAVE_SOM, novo ? "1" : "0");
    } catch {
      // sem armazenamento: vale só nesta visita
    }
  }

  const linkLarissa = NEGOCIO.whatsapp
    ? linkWhatsapp(
        NEGOCIO.whatsapp,
        t.larissa.mensagem(carrinho.itens.map((i) => (i.quantidade > 1 ? `${i.produto.titulo} (${i.quantidade})` : i.produto.titulo)))
      )
    : null;

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
  const pilula = "rounded-[40px] bg-white px-3.5 py-2 text-[0.8125rem] font-semibold text-tinta shadow-sm hover:text-roxo";

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
          className="pointer-events-none absolute left-1/2 top-[7.25rem] w-max max-w-[min(90%,640px)] -translate-x-1/2 rounded-[20px] bg-tinta/85 px-4 py-2 text-center text-[0.8125rem] font-medium text-white sm:top-16 sm:rounded-[40px]"
        >
          {aviso ?? (modo === "alto" ? (toque ? t.dicaAltoToque : t.dicaAlto) : toque ? t.dicaToque : t.dica)}
        </p>
      )}

      {/* guia "onde fica?" e som, no canto de cima à esquerda */}
      {estado === "pronta" && (
        <div className="absolute left-4 top-4 flex w-[calc(100%-2rem)] max-w-[300px] flex-col items-start gap-2">
          <div className="flex gap-2">
            {busca === null ? (
              <button type="button" onClick={() => setBusca("")} className={`${pilula} flex items-center gap-1.5`}>
                <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                  <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path d="M11 11 L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                {t.guia.botao}
              </button>
            ) : (
              <input
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onBlur={() => setTimeout(() => setBusca((b) => (b === "" ? null : b)), 150)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setBusca(null);
                  else if (e.key === "ArrowDown") setMarcada((m) => Math.min(m + 1, sugestoes.length - 1));
                  else if (e.key === "ArrowUp") setMarcada((m) => Math.max(m - 1, 0));
                  else if (e.key === "Enter" && sugestoes[marcada]) escolher(sugestoes[marcada]);
                  else return;
                  e.preventDefault();
                }}
                placeholder={t.guia.placeholder}
                aria-label={t.guia.rotulo}
                role="combobox"
                aria-expanded={sugestoes.length > 0}
                aria-controls="sugestoes-guia"
                aria-activedescendant={sugestoes[marcada] ? `sug-${marcada}` : undefined}
                className="h-9 w-[min(230px,calc(100vw-6.5rem))] rounded-[40px] border-0 bg-white px-4 text-[0.8125rem] text-tinta shadow-sm outline-none ring-roxo focus-visible:ring-2"
              />
            )}
            <button
              type="button"
              onClick={alternarSom}
              aria-pressed={som}
              aria-label={som ? t.som.desligar : t.som.ligar}
              title={som ? t.som.desligar : t.som.ligar}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-tinta shadow-sm hover:text-roxo"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M2 6 H5 L9 2.5 V13.5 L5 10 H2 Z" fill="currentColor" />
                {som ? (
                  <path d="M11.5 5 Q13.5 8 11.5 11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                ) : (
                  <path d="M11 5.5 L15 10.5 M15 5.5 L11 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                )}
              </svg>
            </button>
          </div>
          {busca !== null && busca.trim() !== "" && (
            <ul
              id="sugestoes-guia"
              role="listbox"
              aria-label={t.guia.rotulo}
              className="w-full overflow-hidden rounded-[10px] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.18)]"
            >
              {sugestoes.length ? (
                sugestoes.map((s, i) => (
                  <li key={s.chave} id={`sug-${i}`} role="option" aria-selected={i === marcada}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => escolher(s)}
                      className={`block w-full px-3 py-2 text-left text-[0.8125rem] ${i === marcada ? "bg-roxo-claro" : "hover:bg-roxo-claro"}`}
                    >
                      <span className="line-clamp-1 font-medium text-tinta">{s.nome}</span>
                      <span className="text-[0.75rem] text-grafite">{s.detalhe}</span>
                    </button>
                  </li>
                ))
              ) : (
                <li className="px-3 py-2 text-[0.8125rem] text-grafite">{t.guia.semResultado}</li>
              )}
            </ul>
          )}
          {guia && (
            <div role="status" className="flex w-full items-center gap-2 rounded-[10px] bg-white p-2 pl-3 text-[0.8125rem] text-tinta shadow-sm">
              <span className="line-clamp-2 flex-1 font-medium">{t.guia.seguindo(guia)}</span>
              <button
                type="button"
                onClick={() => cena.current?.irAteGuia()}
                className="shrink-0 rounded-[40px] bg-roxo px-3 py-1.5 text-[0.75rem] font-semibold text-white hover:bg-roxo-escuro"
              >
                {t.guia.meLeva}
              </button>
              <button
                type="button"
                onClick={() => {
                  cena.current?.pararGuia();
                  setGuia(null);
                }}
                aria-label={t.guia.parar}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-grafite hover:bg-roxo-claro hover:text-tinta"
              >
                {iconeFechar}
              </button>
            </div>
          )}
        </div>
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

      {/* celular: a bolinha de andar (de perto, sem card aberto por cima) */}
      {estado === "pronta" && toque && modo === "perto" && !produto && !larissaAberta && (
        <ControleAndar aoMover={(frente, vira) => cena.current?.mover(frente, vira)} />
      )}

      {/* na seção de uma marca: atalho para a página dela */}
      {estado === "pronta" && setor && !produto && !larissaAberta && busca === null && !guia && (
        <Link
          href={`/marca/${setor.slug}`}
          className="absolute right-4 top-4 max-w-[44%] truncate rounded-[40px] bg-white px-4 py-2 text-[0.8125rem] font-semibold text-roxo shadow-sm hover:bg-roxo-claro sm:max-w-none"
        >
          {t.verTodos(setor.nome)} →
        </Link>
      )}

      {/* card do produto no canto vazio da tela — o mesmo do site; no celular, deitado embaixo */}
      {produto && (
        <aside aria-label={produto.titulo} className="absolute inset-x-3 bottom-[4.5rem] sm:inset-x-auto sm:bottom-auto sm:right-5 sm:top-5 sm:w-[260px]">
          <div className="relative rounded-[10px] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
            <button
              type="button"
              onClick={() => setSelecionado(null)}
              aria-label={t.fechar}
              className="absolute -right-2 -top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-tinta text-white shadow hover:bg-black"
            >
              {iconeFechar}
            </button>
            <CardProduto key={produto.slug} produto={produto} prioridade abrirSacola={false} deitadoNoCelular />
          </div>
        </aside>
      )}

      {/* a Larissa: conversa no WhatsApp com o que está na cesta */}
      {larissaAberta && !produto && (
        <aside
          aria-label={t.larissa.titulo}
          className="absolute inset-x-3 bottom-[4.5rem] rounded-[10px] bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.18)] sm:inset-x-auto sm:bottom-auto sm:right-5 sm:top-5 sm:w-[290px]"
        >
          <button
            type="button"
            onClick={() => setLarissaAberta(false)}
            aria-label={t.larissa.fechar}
            className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-tinta text-white shadow hover:bg-black"
          >
            {iconeFechar}
          </button>
          <div className="flex items-center gap-3">
            <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
              <circle cx="24" cy="24" r="24" className="fill-roxo" />
              <path d="M10 42 Q12 31 24 31 Q36 31 38 42 Z" fill="#ffffff" opacity="0.9" />
              <circle cx="24" cy="21" r="10" fill="#c98f6c" />
              <path d="M13 21 Q13 9 24 9 Q35 9 35 21 Q31 13 24 13 Q17 13 13 21 Z" fill="#3a2a21" />
              <path d="M20 22 Q21 23.5 22 22 M26 22 Q27 23.5 28 22" stroke="#2a1c16" strokeWidth="1.2" fill="none" strokeLinecap="round" />
              <path d="M21.5 25.5 Q24 27.5 26.5 25.5" stroke="#9b3f45" strokeWidth="1.2" fill="none" strokeLinecap="round" />
            </svg>
            <p className="text-[1rem] font-bold text-tinta">{t.larissa.titulo}</p>
          </div>
          <p className="mt-3 text-[0.875rem] leading-snug text-grafite">{t.larissa.texto}</p>
          {linkLarissa && (
            <a
              href={linkLarissa}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex h-11 items-center justify-center gap-2 rounded-[40px] bg-[#1f7a46] px-4 text-[0.875rem] font-semibold text-white hover:bg-[#176238]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z" />
              </svg>
              {t.larissa.botao}
            </a>
          )}
          <button
            type="button"
            onClick={() => {
              setLarissaAberta(false);
              palco.current?.focus();
            }}
            className="mt-2 h-10 w-full rounded-[40px] text-[0.8125rem] font-semibold text-roxo hover:bg-roxo-claro"
          >
            {t.larissa.continuar}
          </button>
        </aside>
      )}
    </div>
  );
}
