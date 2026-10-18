import Link from "next/link";
import { copy } from "@/lib/copy";
import { comBase } from "@/lib/caminho";
import { LOJA } from "@/lib/loja";
import { NEGOCIO, linkWhatsapp } from "@/lib/negocio";
import {
  categorias,
  lancamentos,
  maisVendidos,
  marcas,
  necessidades,
  produtos,
  produtosPorCategoria,
  produtosPorMarca,
} from "@/lib/catalogo/consultas";
import type { CategoriaSlug, Produto } from "@/lib/catalogo/tipos";
import { CardProduto } from "@/components/produto/CardProduto";
import { ImagemProduto } from "@/components/produto/ImagemProduto";
import { ProdutosLocaisDestaque } from "@/components/produto/ProdutosLocaisDestaque";
import { NewsletterForm } from "@/components/home/NewsletterForm";
import { CarrosselBanners } from "@/components/home/CarrosselBanners";
import { CasesDaLoja } from "@/components/home/CasesDaLoja";
import { ItemPrateleira, Prateleira } from "@/components/home/Prateleira";
import { MiniProduto } from "@/components/home/MiniProduto";
import { TituloSecao } from "@/components/home/TituloSecao";
import { IconeAtalho, type NomeIcone } from "@/components/home/IconesAtalho";

const t = copy.home;
/** marcas profissionais de cabelo que abrem o mosaico da Be2Beauty */
const MARCAS_PRO = ["theoric", "d-vence", "k-pro", "senscience", "joico", "widi-care", "jacques-janine", "evoly"];
const POR_PRATELEIRA = 8;

/** produto que dá vitrine: tem foto e tem estoque */
const vitrinavel = (p: Produto) => (p.imagens?.length ?? 0) > 0 && p.variantes.some((v) => v.estoque > 0);
const emPromocao = (p: Produto) => p.variantes.some((v) => v.precoDe != null && v.precoDe > v.precoPor);

/**
 * Escolhe `n` produtos alternando as marcas (um de cada, depois o segundo de
 * cada...), para a vitrine não virar uma fileira da mesma marca.
 */
function variados(lista: Produto[], n: number): Produto[] {
  const porMarca = new Map<string, Produto[]>();
  for (const p of lista.filter(vitrinavel)) {
    const fila = porMarca.get(p.marca) ?? [];
    fila.push(p);
    porMarca.set(p.marca, fila);
  }
  const filas = [...porMarca.values()];
  const escolhidos: Produto[] = [];
  for (let rodada = 0; escolhidos.length < n && filas.some((f) => f.length > rodada); rodada++) {
    for (const fila of filas) {
      if (fila[rodada]) escolhidos.push(fila[rodada]);
      if (escolhidos.length === n) break;
    }
  }
  return escolhidos;
}

/** categorias com produto suficiente para uma vitrine, da mais cheia para a menor */
const categoriasCheias = categorias
  .map((c) => ({ ...c, lista: produtosPorCategoria(c.slug as CategoriaSlug).filter(vitrinavel) }))
  .filter((c) => c.lista.length >= 4)
  .sort((a, b) => b.lista.length - a.lista.length);

/**
 * Home — ordem do design system (docs: BeautyNow Design System, §4):
 * hero → trio de vitrines → atalhos → vitrine com banner lateral → faixa
 * editorial → mosaico de marcas → prateleiras por categoria. Toda vitrine
 * usa conteúdo real: "Promoções" e "Lançamentos" só entram com 3 produtos ou
 * mais; senão o espaço vai para as categorias mais cheias.
 */
export default function Home() {
  // ---- Be2Beauty: a entrada é a divisão por categorias (substitui o antigo
  // bloco de "linhas profissionais", que não convertia). Cada categoria com
  // vitrine vira um quadro com foto e nome, logo abaixo do hero.
  const categoriasVitrine = LOJA.vitrineProfissional
    ? categoriasCheias.map((c) => ({ ...c, foto: c.lista.find((p) => (p.imagens?.length ?? 0) > 0) }))
    : [];

  // ---- trio de vitrines (promoções, lançamentos e, se faltar, categorias cheias)
  const trio: { titulo: string; link: string; lista: Produto[] }[] = [];
  const promocoes = produtos.filter((p) => emPromocao(p) && vitrinavel(p));
  if (promocoes.length >= 3) trio.push({ titulo: t.vitrinePromocoes, link: "/busca?q=promo%C3%A7%C3%B5es", lista: variados(promocoes, 3) });
  const novidades = lancamentos().filter(vitrinavel);
  if (novidades.length >= 3) trio.push({ titulo: t.vitrineLancamentos, link: "/busca?q=lan%C3%A7amentos", lista: variados(novidades, 3) });
  for (const c of categoriasCheias) {
    if (trio.length === 3) break;
    trio.push({ titulo: t.vitrineCategoria(c.nome), link: `/categoria/${c.slug}`, lista: variados(c.lista, 3) });
  }

  // ---- vitrine com banner lateral: mais vendidos ou, sem sinal ainda, a categoria campeã
  const vendidos = maisVendidos().filter(vitrinavel);
  const campanha = vendidos.length >= 4 ? vendidos : (categoriasCheias[0]?.lista ?? produtos);
  const linkCategoriaCampea = categoriasCheias[0] ? `/categoria/${categoriasCheias[0].slug}` : "/busca?q=mais+vendidos";
  const linkCampanha = LOJA.b2b ? t.campanha.link : linkCategoriaCampea;

  // ---- prateleiras por categoria (as que não foram para o banner lateral)
  const prateleiras = categoriasCheias.slice(vendidos.length >= 4 ? 0 : 1, (vendidos.length >= 4 ? 0 : 1) + 3);

  // ---- mosaico: as três marcas com mais produto (1 grande + 2 estreitas); na
  // Be2Beauty as marcas profissionais de cabelo vêm na frente
  const prioridadeMosaico = (slug: string) => {
    const i = LOJA.vitrineProfissional ? MARCAS_PRO.indexOf(slug) : -1;
    return i < 0 ? MARCAS_PRO.length : i;
  };
  const marcasMosaico = marcas
    .map((m) => ({ ...m, total: produtosPorMarca(m.slug).length, foto: produtosPorMarca(m.slug).find(vitrinavel) }))
    .filter((m) => m.total > 0 && m.foto)
    .sort((a, b) => prioridadeMosaico(a.slug) - prioridadeMosaico(b.slug) || b.total - a.total);

  const atalhos: { rotulo: string; href: string; icone: NomeIcone; externo?: boolean }[] = [
    { rotulo: t.atalhos.maisVendidos, href: "/busca?q=mais+vendidos", icone: "estrela" },
    LOJA.b2b
      ? { rotulo: t.atalhos.cadastroCnpj, href: "/profissional", icone: "predio" }
      : { rotulo: t.atalhos.cupom, href: "/conta/criar", icone: "cupom" },
    { rotulo: t.atalhos.brinde, href: linkCategoriaCampea, icone: "presente" },
    { rotulo: t.atalhos.pix, href: "/atendimento", icone: "pix" },
    { rotulo: t.atalhos.marcas, href: "/marcas", icone: "selo" },
    NEGOCIO.whatsapp
      ? { rotulo: t.atalhos.whatsapp, href: linkWhatsapp(NEGOCIO.whatsapp), icone: "conversa", externo: true }
      : { rotulo: t.atalhos.afiliado, href: "/afiliado", icone: "pessoas" },
  ];

  return (
    <>
      {/* 1. Hero: banners do lojista (troca a cada 20s) */}
      <CarrosselBanners />

      {/* 2a. Be2Beauty: divisão por categorias logo na entrada */}
      {categoriasVitrine.length > 0 && (
        <section aria-labelledby="titulo-categorias" className="container-bn pt-8 md:pt-10">
          <TituloSecao id="titulo-categorias" link="/categorias">
            {t.porCategoria}
          </TituloSecao>
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4">
            {categoriasVitrine.map((c, i) => (
              <li key={c.slug}>
                <Link
                  href={`/categoria/${c.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-[8px] border border-roxo/25 bg-white transition-colors hover:border-roxo/60"
                >
                  <div className="bg-white">
                    {c.foto ? (
                      <ImagemProduto produto={c.foto} alt="" prioridade={i < 4} />
                    ) : (
                      <span className="flex aspect-square items-center justify-center text-[0.75rem] text-cinza">
                        {c.nome}
                      </span>
                    )}
                  </div>
                  <div className="border-t border-linha px-3 py-3">
                    <span className="block text-[0.9375rem] font-semibold leading-tight text-tinta group-hover:text-roxo">
                      {c.nome}
                    </span>
                    <span className="mt-0.5 block text-[0.75rem] text-grafite">
                      {t.verProdutos} →
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 2. Trio de vitrines */}
      {trio.length > 0 && (
        <section aria-label={t.vitrines} className="container-bn pt-8 md:pt-10">
          {/* no celular as três vitrines deslizam de lado em vez de empilhar */}
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
            {trio.map((v) => (
              <div key={v.titulo} className="flex w-[85%] shrink-0 snap-start flex-col rounded-[8px] border border-linha bg-white p-4 md:w-auto">
                <h2 className="text-[1.125rem] font-medium text-tinta">{v.titulo}</h2>
                <ul className="mt-2 grow divide-y divide-linha">
                  {v.lista.map((p) => (
                    <MiniProduto key={p.slug} produto={p} />
                  ))}
                </ul>
                <Link href={v.link} className="mt-3 self-start text-[0.875rem] font-medium text-violeta hover:underline">
                  {t.verProdutos} →
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. Atalhos (chips) */}
      <nav aria-label={t.atalhosRotulo} className="container-bn pt-8">
        <ul className="grid grid-cols-3 gap-2 md:grid-cols-6 md:gap-3">
          {atalhos.map((a) => {
            const conteudo = (
              <>
                <span className="text-roxo">
                  <IconeAtalho nome={a.icone} />
                </span>
                <span className="text-[0.8125rem] font-medium leading-tight text-tinta md:text-[0.875rem]">{a.rotulo}</span>
              </>
            );
            const classe =
              "flex h-full min-h-[88px] flex-col items-center justify-center gap-1.5 rounded-[8px] border border-linha bg-white px-2 py-3 text-center transition-colors hover:border-roxo md:flex-row md:min-h-[64px] md:justify-start md:gap-3 md:px-4 md:text-left";
            return (
              <li key={a.rotulo}>
                {a.externo ? (
                  <a href={a.href} target="_blank" rel="noopener noreferrer" className={classe}>
                    {conteudo}
                  </a>
                ) : (
                  <Link href={a.href} className={classe}>
                    {conteudo}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* 4. Vitrine com banner lateral (campanha com regra real: brinde ou preço de CNPJ) */}
      <section id="mais-vendidos" aria-labelledby="titulo-campanha" className="container-bn pt-16 md:pt-20">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="flex flex-col justify-between gap-6 rounded-[8px] bg-roxo-claro p-6 md:p-8">
            <div>
              <p className="text-[0.75rem] font-bold uppercase tracking-wide text-roxo-escuro">{t.campanha.sobretitulo}</p>
              <h2 id="titulo-campanha" className="mt-2 text-[clamp(1.375rem,1.9vw,1.625rem)] font-black uppercase leading-[1.1] text-roxo-escuro [overflow-wrap:anywhere]">
                {t.campanha.titulo}
              </h2>
              <p className="mt-3 text-[0.875rem] text-grafite">{t.campanha.texto}</p>
            </div>
            <Link
              href={linkCampanha}
              className="inline-flex h-10 items-center gap-2 self-start rounded-[40px] bg-tinta px-5 text-[0.875rem] font-bold uppercase tracking-wide text-white hover:bg-black"
            >
              {t.campanha.cta} <span aria-hidden="true">›</span>
            </Link>
          </div>
          <Prateleira rotulo={t.campanha.titulo}>
            <ProdutosLocaisDestaque emPrateleira />
            {variados(campanha, POR_PRATELEIRA).map((p, i) => (
              <ItemPrateleira key={p.slug}>
                <CardProduto produto={p} prioridade={i < 2} />
              </ItemPrateleira>
            ))}
          </Prateleira>
        </div>
      </section>

      {/* 5. Faixa editorial */}
      <section aria-label={t.editorial.titulo} className="container-bn pt-16 md:pt-20">
        <div className="flex flex-col items-start gap-4 rounded-[8px] bg-[#f4ece6] px-6 py-6 md:flex-row md:items-center md:gap-10 md:px-10">
          <p className="font-titulo text-[clamp(1.5rem,2.6vw,2rem)] font-black uppercase leading-none text-tinta md:shrink-0">
            {t.editorial.titulo}
          </p>
          <p className="text-[0.9375rem] text-grafite md:grow md:text-center">{t.editorial.texto}</p>
          <Link
            href={t.editorial.link}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-[40px] border border-tinta px-5 text-[0.875rem] font-bold uppercase tracking-wide text-tinta hover:bg-white"
          >
            {t.editorial.cta} <span aria-hidden="true">›</span>
          </Link>
        </div>
      </section>

      {/* 6. Mosaico de marcas (1 grande + 2 estreitas) e logos */}
      {marcasMosaico.length >= 3 && (
        <section aria-labelledby="titulo-mosaico" className="container-bn pt-16 md:pt-20">
          <TituloSecao id="titulo-mosaico" link="/marcas">
            {t.mosaicoTitulo}
          </TituloSecao>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-[2fr_1fr_1fr] md:gap-4">
            {marcasMosaico.slice(0, 3).map((m, i) => (
              <Link
                key={m.slug}
                href={`/marca/${m.slug}`}
                className={`group relative flex overflow-hidden rounded-[8px] border border-linha bg-superficie ${
                  i === 0 ? "col-span-2 min-h-[240px] md:col-span-1 md:min-h-[340px]" : "min-h-[250px] md:min-h-[340px]"
                }`}
              >
                {m.foto?.imagens?.[0] && (
                  // eslint-disable-next-line @next/next/no-img-element -- foto do catálogo, servidor externo
                  <img
                    src={m.foto.imagens[0]}
                    alt=""
                    loading="lazy"
                    className={`absolute inset-0 h-full w-full bg-white object-contain p-6 ${
                      i === 0 ? "pb-24" : "pb-32 md:pb-24"
                    } transition-transform duration-300 group-hover:scale-[1.03]`}
                  />
                )}
                {/* nos dois cards estreitos do celular (meia largura) a logo vai
                    para cima do nome: lado a lado, o nome quebrava letra a letra */}
                <span
                  className={`relative mt-auto flex w-full gap-3 bg-white/95 px-4 py-3 ${
                    i === 0 ? "items-center" : "flex-col items-start md:flex-row md:items-center"
                  }`}
                >
                  {m.logo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={comBase(m.logo)} alt="" loading="lazy" className="h-8 w-[100px] shrink-0 object-contain object-left md:h-10" />
                  )}
                  <span className="min-w-0">
                    <span className="block text-[1rem] font-bold uppercase leading-tight text-tinta [overflow-wrap:anywhere]">{m.nome}</span>
                    <span className="block text-[0.8125rem] text-grafite">
                      {t.produtosDaMarca(m.total)} · {t.conhecerMarca} →
                    </span>
                  </span>
                </span>
              </Link>
            ))}
          </div>
          <ul className="mt-4 grid grid-cols-3 gap-3 md:grid-cols-6">
            {marcasMosaico.slice(3, 9).map((m) => (
              <li key={m.slug}>
                <Link
                  href={`/marca/${m.slug}`}
                  className="flex h-20 items-center justify-center rounded-[8px] border border-linha bg-white p-3 transition-colors hover:border-roxo"
                >
                  {m.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={comBase(m.logo)} alt={m.nome} loading="lazy" className="h-14 w-auto max-w-full object-contain" />
                  ) : (
                    <span className="text-[0.875rem] font-bold uppercase text-tinta">{m.nome}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 7. Prateleiras por categoria */}
      {prateleiras.map((c) => (
        <section key={c.slug} aria-labelledby={`titulo-${c.slug}`} className="container-bn pt-16 md:pt-20">
          <TituloSecao id={`titulo-${c.slug}`} link={`/categoria/${c.slug}`}>
            {c.nome}
          </TituloSecao>
          <div className="mt-6">
            <Prateleira rotulo={c.nome}>
              {variados(c.lista, POR_PRATELEIRA).map((p) => (
                <ItemPrateleira key={p.slug}>
                  <CardProduto produto={p} />
                </ItemPrateleira>
              ))}
            </Prateleira>
          </div>
        </section>
      ))}

      {/* Necessidades (só no catálogo de demonstração, que tem curadoria) */}
      {necessidades.length > 0 && (
        <section aria-labelledby="titulo-necessidades" className="container-bn pt-16 md:pt-20">
          <TituloSecao id="titulo-necessidades">{t.porNecessidade}</TituloSecao>
          <ul className="mt-6 flex flex-wrap justify-center gap-2">
            {necessidades.map((n) => (
              <li key={n.slug}>
                <Link
                  href={`/necessidade/${n.slug}`}
                  className="inline-block rounded-[40px] border border-linha px-4 py-2.5 text-[0.9375rem] text-grafite transition-colors hover:border-roxo hover:text-roxo"
                >
                  {n.nome}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Por que comprar aqui */}
      <section aria-labelledby="titulo-vantagens" className="mt-16 bg-superficie py-12 md:mt-20">
        <div className="container-bn">
          <TituloSecao id="titulo-vantagens">{t.vantagensTitulo}</TituloSecao>
          <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {(
              [
                [t.seloOriginal, t.seloOriginalTexto, "selo"],
                [t.seloEnvio, t.seloEnvioTexto, "estrela"],
                [t.seloTroca, t.seloTrocaTexto, "presente"],
                [t.seloPix, t.seloPixTexto, "pix"],
              ] as const
            ).map(([titulo, texto, icone]) => (
              <li key={titulo} className="flex flex-col items-center gap-2 rounded-[8px] border border-linha bg-white p-4 text-center">
                <span className="text-roxo">
                  <IconeAtalho nome={icone} />
                </span>
                <span className="text-[0.9375rem] font-bold text-tinta">{titulo}</span>
                <span className="text-[0.8125rem] leading-snug text-grafite">{texto}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Depoimentos reais de quem já comprou (some se ainda não houver) */}
      <CasesDaLoja />

      {/* Newsletter */}
      <section className="container-bn pt-16 md:pt-20">
        <div className="rounded-[8px] bg-violeta-claro px-6 py-10 text-center md:px-12">
          <h2 className="font-titulo text-[clamp(1.5rem,2.6vw,2rem)] font-normal text-tinta">{t.newsletterTitulo}</h2>
          <p className="mt-2 text-[0.9375rem] text-grafite">{t.newsletterTexto}</p>
          <NewsletterForm />
        </div>
      </section>
    </>
  );
}
