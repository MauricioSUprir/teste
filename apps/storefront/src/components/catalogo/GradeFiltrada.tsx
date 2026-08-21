"use client";

/**
 * PLP client-side: filtros facetados + ordenação, refletidos na URL
 * (compartilhável e indexável) — ticket 2.3. Na integração real, as facetas
 * vêm do Meilisearch; a lógica de URL e UI permanece.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { copy } from "@/lib/copy";
import { marcas, menorPreco, notaMedia, temEstoque } from "@/lib/catalogo/consultas";
import { aplicarAjustesLista, produtosLocais } from "@/lib/catalogo/ajustes";
import type { Produto } from "@/lib/catalogo/tipos";
import { CardProduto } from "@/components/produto/CardProduto";

type Ordenacao =
  | "relevancia"
  | "mais-vendidos"
  | "menor-preco"
  | "maior-preco"
  | "lancamentos"
  | "melhor-avaliados";

const faixasPreco = [
  { id: "ate-50", rotulo: "Até R$ 50", min: 0, max: 5000 },
  { id: "50-100", rotulo: "R$ 50 a R$ 100", min: 5000, max: 10000 },
  { id: "100-200", rotulo: "R$ 100 a R$ 200", min: 10000, max: 20000 },
  { id: "acima-200", rotulo: "Acima de R$ 200", min: 20000, max: Infinity },
];

const opcoesTipoCabelo = ["liso", "ondulado", "cacheado", "crespo"];
const opcoesTipoPele = ["oleosa", "mista", "normal", "seca", "sensivel"];
const opcoesCaracteristicas = [
  { id: "vegano", rotulo: "Vegano" },
  { id: "sem-sulfato", rotulo: "Sem sulfato" },
  { id: "sem-silicone", rotulo: "Sem silicone" },
  { id: "cruelty-free", rotulo: "Cruelty-free" },
];

function capitalizar(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function GradeFiltrada({
  produtos,
  categoria,
  marca,
}: {
  produtos: Produto[];
  /** slug da categoria da página — inclui produtos criados no admin */
  categoria?: string;
  /** slug da marca da página — inclui produtos criados no admin */
  marca?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [filtrosAbertosMobile, setFiltrosAbertosMobile] = useState(false);
  const [base, setBase] = useState(produtos);

  // após a hidratação: aplica edições/exclusões do admin e soma os produtos locais
  useEffect(() => {
    const ajustada = aplicarAjustesLista(produtos);
    const locais = produtosLocais().filter((p) =>
      categoria ? p.categorias.includes(categoria) : marca ? p.marca === marca : false
    );
    if (locais.length > 0 || ajustada !== produtos) setBase([...locais, ...ajustada]);
  }, [produtos, categoria, marca]);

  const lerLista = useCallback(
    (chave: string): string[] => params.get(chave)?.split(",").filter(Boolean) ?? [],
    [params]
  );

  const filtroMarcas = lerLista("marca");
  const filtroPreco = lerLista("preco");
  const filtroCabelo = lerLista("cabelo");
  const filtroPele = lerLista("pele");
  const filtroCarac = lerLista("carac");
  const soDisponiveis = params.get("disp") === "1";
  const ordenacao = (params.get("ordem") as Ordenacao) ?? "relevancia";

  const atualizarParam = useCallback(
    (chave: string, valores: string[] | string | null) => {
      const novos = new URLSearchParams(params.toString());
      const valor = Array.isArray(valores) ? valores.join(",") : valores;
      if (!valor) novos.delete(chave);
      else novos.set(chave, valor);
      router.replace(`${pathname}${novos.size ? `?${novos}` : ""}`, { scroll: false });
    },
    [params, pathname, router]
  );

  const alternarValor = useCallback(
    (chave: string, atual: string[], valor: string) => {
      const novo = atual.includes(valor) ? atual.filter((v) => v !== valor) : [...atual, valor];
      atualizarParam(chave, novo);
    },
    [atualizarParam]
  );

  const temFiltroAtivo =
    filtroMarcas.length + filtroPreco.length + filtroCabelo.length + filtroPele.length + filtroCarac.length > 0 || soDisponiveis;

  const filtrados = useMemo(() => {
    let lista = base.filter((p) => {
      if (filtroMarcas.length && !filtroMarcas.includes(p.marca)) return false;
      if (filtroPreco.length) {
        const preco = menorPreco(p);
        const dentro = filtroPreco.some((id) => {
          const faixa = faixasPreco.find((f) => f.id === id);
          return faixa ? preco >= faixa.min && preco < faixa.max : false;
        });
        if (!dentro) return false;
      }
      if (filtroCabelo.length && !filtroCabelo.some((t) => p.atributos.tipoCabelo?.includes(t)))
        return false;
      if (filtroPele.length && !filtroPele.some((t) => p.atributos.tipoPele?.includes(t)))
        return false;
      for (const c of filtroCarac) {
        if (c === "vegano" && !p.atributos.vegano) return false;
        if (c === "sem-sulfato" && !p.atributos.semSulfato) return false;
        if (c === "sem-silicone" && !p.atributos.semSilicone) return false;
        if (c === "cruelty-free" && !p.atributos.crueltyFree) return false;
      }
      if (soDisponiveis && !temEstoque(p)) return false;
      return true;
    });

    lista = [...lista];
    switch (ordenacao) {
      case "menor-preco":
        lista.sort((a, b) => menorPreco(a) - menorPreco(b));
        break;
      case "maior-preco":
        lista.sort((a, b) => menorPreco(b) - menorPreco(a));
        break;
      case "mais-vendidos":
        lista.sort((a, b) => Number(b.maisVendido ?? false) - Number(a.maisVendido ?? false));
        break;
      case "lancamentos":
        lista.sort((a, b) => Number(b.lancamento ?? false) - Number(a.lancamento ?? false));
        break;
      case "melhor-avaliados":
        lista.sort((a, b) => notaMedia(b).media - notaMedia(a).media);
        break;
      default:
        // relevância: disponíveis primeiro, mais vendidos primeiro
        lista.sort(
          (a, b) =>
            Number(temEstoque(b)) - Number(temEstoque(a)) ||
            Number(b.maisVendido ?? false) - Number(a.maisVendido ?? false)
        );
    }
    return lista;
  }, [base, filtroMarcas, filtroPreco, filtroCabelo, filtroPele, filtroCarac, soDisponiveis, ordenacao]);

  const marcasPresentes = useMemo(() => {
    const slugs = new Set(base.map((p) => p.marca));
    return marcas.filter((m) => slugs.has(m.slug));
  }, [base]);

  const temCabelo = produtos.some((p) => p.atributos.tipoCabelo?.length);
  const temPele = produtos.some((p) => p.atributos.tipoPele?.length);

  const painelFiltros = (
    <div className="space-y-5">
      {temFiltroAtivo && (
        <button
          type="button"
          onClick={() => router.replace(pathname, { scroll: false })}
          className="text-[0.8125rem] font-medium text-roxo underline"
        >
          {copy.plp.limparFiltros}
        </button>
      )}

      {marcasPresentes.length > 1 && (
        <GrupoFiltro titulo={copy.plp.filtroMarca}>
          {marcasPresentes.map((m) => (
            <Opcao
              key={m.slug}
              rotulo={m.nome}
              marcado={filtroMarcas.includes(m.slug)}
              aoMudar={() => alternarValor("marca", filtroMarcas, m.slug)}
            />
          ))}
        </GrupoFiltro>
      )}

      <GrupoFiltro titulo={copy.plp.filtroPreco}>
        {faixasPreco.map((f) => (
          <Opcao
            key={f.id}
            rotulo={f.rotulo}
            marcado={filtroPreco.includes(f.id)}
            aoMudar={() => alternarValor("preco", filtroPreco, f.id)}
          />
        ))}
      </GrupoFiltro>

      {temCabelo && (
        <GrupoFiltro titulo={copy.plp.filtroTipoCabelo}>
          {opcoesTipoCabelo.map((t) => (
            <Opcao
              key={t}
              rotulo={capitalizar(t)}
              marcado={filtroCabelo.includes(t)}
              aoMudar={() => alternarValor("cabelo", filtroCabelo, t)}
            />
          ))}
        </GrupoFiltro>
      )}

      {temPele && (
        <GrupoFiltro titulo={copy.plp.filtroTipoPele}>
          {opcoesTipoPele.map((t) => (
            <Opcao
              key={t}
              rotulo={capitalizar(t === "sensivel" ? "sensível" : t)}
              marcado={filtroPele.includes(t)}
              aoMudar={() => alternarValor("pele", filtroPele, t)}
            />
          ))}
        </GrupoFiltro>
      )}

      <GrupoFiltro titulo={copy.plp.filtroBeneficios}>
        {opcoesCaracteristicas.map((c) => (
          <Opcao
            key={c.id}
            rotulo={c.rotulo}
            marcado={filtroCarac.includes(c.id)}
            aoMudar={() => alternarValor("carac", filtroCarac, c.id)}
          />
        ))}
      </GrupoFiltro>

      <Opcao
        rotulo={copy.plp.disponiveis}
        marcado={soDisponiveis}
        aoMudar={() => atualizarParam("disp", soDisponiveis ? null : "1")}
      />
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      {/* filtros desktop */}
      <aside aria-label={copy.plp.filtros} className="hidden lg:block">
        {painelFiltros}
      </aside>

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="num text-[0.875rem] text-grafite" aria-live="polite">
            {filtrados.length}{" "}
            {filtrados.length === 1 ? copy.plp.produto : copy.plp.produtos}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFiltrosAbertosMobile((v) => !v)}
              aria-expanded={filtrosAbertosMobile}
              className="rounded-[6px] border border-linha px-3 py-2 text-[0.875rem] font-medium lg:hidden"
            >
              {copy.plp.filtros}
              {temFiltroAtivo && <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-roxo" />}
            </button>
            <label className="flex items-center gap-2 text-[0.875rem] text-grafite">
              <span className="hidden sm:inline">{copy.plp.ordenar}</span>
              <select
                value={ordenacao}
                onChange={(e) => atualizarParam("ordem", e.target.value === "relevancia" ? null : e.target.value)}
                className="h-10 rounded-[6px] border border-linha bg-white px-2 text-[0.875rem]"
              >
                <option value="relevancia">{copy.plp.ordenacao.relevancia}</option>
                <option value="mais-vendidos">{copy.plp.ordenacao.maisVendidos}</option>
                <option value="menor-preco">{copy.plp.ordenacao.menorPreco}</option>
                <option value="maior-preco">{copy.plp.ordenacao.maiorPreco}</option>
                <option value="lancamentos">{copy.plp.ordenacao.lancamentos}</option>
                <option value="melhor-avaliados">{copy.plp.ordenacao.melhorAvaliados}</option>
              </select>
            </label>
          </div>
        </div>

        {/* filtros mobile */}
        {filtrosAbertosMobile && (
          <div className="mb-4 rounded-[10px] border border-linha p-4 lg:hidden">{painelFiltros}</div>
        )}

        {filtrados.length === 0 ? (
          <p className="rounded-[10px] bg-superficie px-6 py-12 text-center text-[0.9375rem] text-grafite">
            {copy.plp.nenhumResultado}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {filtrados.map((p) => (
              <CardProduto key={p.slug} produto={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GrupoFiltro({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-linha pt-4 first:border-t-0 first:pt-0">
      <legend className="pb-2 text-[0.8125rem] font-semibold uppercase tracking-wide text-tinta">
        {titulo}
      </legend>
      <div className="space-y-1.5">{children}</div>
    </fieldset>
  );
}

function Opcao({
  rotulo,
  marcado,
  aoMudar,
}: {
  rotulo: string;
  marcado: boolean;
  aoMudar: () => void;
}) {
  return (
    <label className="flex min-h-[32px] cursor-pointer items-center gap-2.5 text-[0.875rem] text-grafite hover:text-tinta">
      <input
        type="checkbox"
        checked={marcado}
        onChange={aoMudar}
        className="h-4 w-4 accent-[#4A2882]"
      />
      {rotulo}
    </label>
  );
}
