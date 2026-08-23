"use client";

/**
 * Aba Catálogo — tabela com busca, filtro de estoque, exportação CSV e
 * gestão manual: adicionar, editar e excluir produtos. Produtos adicionados
 * aqui vivem no navegador (demo); edições sobre o catálogo base viram
 * ajustes que a loja aplica por cima. Com o Hub/ERP conectado, a fonte da
 * verdade volta a ser o sistema central.
 */
import { useMemo, useState } from "react";
import {
  catalogoReal,
  categorias,
  marcas,
  obterMarca,
  produtos,
  temEstoque,
} from "@/lib/catalogo/consultas";
import {
  aplicarEdicao,
  criarProdutoLocal,
  editarProduto,
  excluirProduto,
  lerAjustes,
  marcarEsgotado,
  produtosLocais,
  restaurarProduto,
  type EdicaoProduto,
} from "@/lib/catalogo/ajustes";
import type { Produto } from "@/lib/catalogo/tipos";
import { formatarPreco } from "@/lib/preco";
import { definirPrecoManual, servidorConfigurado } from "@/lib/servidor";

function reaisParaCentavos(texto: string): number | null {
  const limpo = texto.trim().replace(/\./g, "").replace(",", ".");
  if (!limpo) return null;
  const numero = Number(limpo);
  if (!Number.isFinite(numero) || numero < 0) return null;
  return Math.round(numero * 100);
}

interface LinhaCatalogo {
  produto: Produto;
  marca: string;
  excluido: boolean;
  editado: boolean;
}

export function AbaCatalogo() {
  const [busca, setBusca] = useState("");
  const [soBaixoEstoque, setSoBaixoEstoque] = useState(false);
  const [visiveis, setVisiveis] = useState(30);
  const [versao, setVersao] = useState(0);
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const recarregar = () => setVersao((v) => v + 1);

  const linhas = useMemo<LinhaCatalogo[]>(() => {
    void versao;
    const ajustes = lerAjustes();
    const locais: LinhaCatalogo[] = produtosLocais().map((p) => ({
      produto: p,
      marca: obterMarca(p.marca)?.nome ?? p.marca,
      excluido: false,
      editado: false,
    }));
    const base: LinhaCatalogo[] = produtos.map((p) => {
      const edicao = ajustes.editados[p.slug];
      const excluido = ajustes.excluidos.includes(p.slug);
      return {
        produto: edicao ? aplicarEdicao(p, edicao) : p,
        marca: obterMarca(p.marca)?.nome ?? p.marca,
        excluido,
        editado: Boolean(edicao),
      };
    });
    const termo = busca.trim().toLowerCase();
    return [...locais, ...base].filter((l) => {
      const v = l.produto.variantes[0];
      if (soBaixoEstoque && v.estoque > 5) return false;
      if (!termo) return true;
      return (
        l.produto.titulo.toLowerCase().includes(termo) ||
        v.sku.toLowerCase().includes(termo) ||
        l.marca.toLowerCase().includes(termo)
      );
    });
  }, [busca, soBaixoEstoque, versao]);

  const ativos = linhas.filter((l) => !l.excluido);
  const esgotados = ativos.filter((l) => !temEstoque(l.produto)).length;
  const baixoEstoque = ativos.filter((l) => {
    const e = l.produto.variantes[0].estoque;
    return e > 0 && e <= 5;
  }).length;

  function exportarCsv() {
    const csvLinhas = [
      ["produto", "marca", "sku", "preco_reais", "estoque", "situacao"],
      ...linhas.map((l) => [
        l.produto.titulo,
        l.marca,
        l.produto.variantes[0].sku,
        (l.produto.variantes[0].precoPor / 100).toFixed(2).replace(".", ","),
        String(l.produto.variantes[0].estoque),
        l.excluido ? "excluído" : l.produto.local ? "criado no painel" : l.editado ? "editado" : "catálogo",
      ]),
    ];
    const csv = csvLinhas
      .map((linha) => linha.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `catalogo-beautynow-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {!catalogoReal && (
        <p className="mb-4 rounded-[10px] border border-violeta/30 bg-violeta-claro px-4 py-3 text-[0.8125rem] text-grafite">
          Catálogo de demonstração. Assim que a importação do Hub Suprir rodar, os 1.222 produtos
          reais aparecem aqui e em toda a loja. Produtos adicionados manualmente ficam salvos
          neste navegador.
        </p>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid grid-cols-3 gap-3">
          <Cartao valor={String(ativos.length)} rotulo="produtos ativos" />
          <Cartao valor={String(esgotados)} rotulo="esgotados" alerta={esgotados > 0} />
          <Cartao valor={String(baixoEstoque)} rotulo="estoque baixo" alerta={baixoEstoque > 0} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[0.8125rem] text-grafite">
            <input
              type="checkbox"
              checked={soBaixoEstoque}
              onChange={(e) => setSoBaixoEstoque(e.target.checked)}
              className="h-4 w-4 accent-[#4A2882]"
            />
            Só estoque baixo/esgotado
          </label>
          <input
            type="search"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setVisiveis(30);
            }}
            placeholder="Buscar por nome, SKU ou marca"
            aria-label="Buscar no catálogo"
            className="h-10 w-60 rounded-[6px] border border-linha bg-white px-3 text-[0.875rem] outline-none focus:border-violeta"
          />
          <button
            type="button"
            onClick={exportarCsv}
            className="h-10 rounded-[999px] border border-linha px-4 text-[0.8125rem] font-medium text-grafite hover:bg-superficie"
          >
            ⬇ CSV
          </button>
          <button
            type="button"
            onClick={() => setFormAberto((a) => !a)}
            className="h-10 rounded-[999px] bg-roxo px-5 text-[0.8125rem] font-semibold text-white hover:bg-roxo-escuro"
          >
            {formAberto ? "Fechar formulário" : "+ Adicionar produto"}
          </button>
        </div>
      </div>

      {formAberto && (
        <FormNovoProduto
          aoCriar={() => {
            setFormAberto(false);
            recarregar();
          }}
        />
      )}

      <div className="mt-4 overflow-x-auto rounded-[10px] border border-linha">
        <table className="w-full min-w-[760px] text-[0.875rem]">
          <thead>
            <tr className="bg-superficie text-left text-[0.75rem] uppercase tracking-wide text-cinza">
              <th className="px-4 py-2.5 font-semibold">Produto</th>
              <th className="px-4 py-2.5 font-semibold">Marca</th>
              <th className="px-4 py-2.5 font-semibold">SKU</th>
              <th className="px-4 py-2.5 text-right font-semibold">Preço</th>
              <th className="px-4 py-2.5 text-right font-semibold">Estoque</th>
              <th className="px-4 py-2.5 font-semibold">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.slice(0, visiveis).map((l) => {
              const v = l.produto.variantes[0];
              return (
                <FragmentoLinha
                  key={l.produto.slug}
                  linha={l}
                  variante={v}
                  emEdicao={editando === l.produto.slug}
                  aoEditar={() => setEditando(editando === l.produto.slug ? null : l.produto.slug)}
                  aoSalvar={(edicao) => {
                    editarProduto(l.produto.slug, edicao);
                    setEditando(null);
                    recarregar();
                  }}
                  aoExcluir={() => {
                    excluirProduto(l.produto.slug);
                    recarregar();
                  }}
                  aoRestaurar={() => {
                    restaurarProduto(l.produto.slug);
                    // limpa também o preço manual global (volta ao preço padrão p/ todos)
                    if (servidorConfigurado()) void definirPrecoManual(l.produto.slug, null, null);
                    recarregar();
                  }}
                  aoEsgotar={(esgotado) => {
                    marcarEsgotado(l.produto.slug, esgotado);
                    if (!esgotado) {
                      // catálogo base já sem estoque: repõe com 10 unidades
                      const original = produtos.find((p) => p.slug === l.produto.slug);
                      if (original && !temEstoque(original)) {
                        editarProduto(l.produto.slug, { estoque: 10 });
                      }
                    }
                    recarregar();
                  }}
                />
              );
            })}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-grafite">
                  Nenhum item encontrado com esse filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {linhas.length > visiveis && (
        <button
          type="button"
          onClick={() => setVisiveis((n) => n + 50)}
          className="num mt-3 rounded-[999px] border border-linha px-5 py-2 text-[0.875rem] font-medium text-grafite hover:bg-superficie"
        >
          Mostrar mais ({linhas.length - visiveis} restantes)
        </button>
      )}
      <p className="mt-3 text-[0.75rem] text-cinza">
        {marcas.length} marcas no catálogo · edições e produtos manuais ficam salvos neste navegador
      </p>
    </div>
  );
}

function FragmentoLinha({
  linha,
  variante,
  emEdicao,
  aoEditar,
  aoSalvar,
  aoExcluir,
  aoRestaurar,
  aoEsgotar,
}: {
  linha: LinhaCatalogo;
  variante: Produto["variantes"][number];
  emEdicao: boolean;
  aoEditar: () => void;
  aoSalvar: (edicao: EdicaoProduto) => void;
  aoExcluir: () => void;
  aoRestaurar: () => void;
  aoEsgotar: (esgotado: boolean) => void;
}) {
  const p = linha.produto;
  const disponivel = temEstoque(p);
  return (
    <>
      <tr className={`border-t border-linha ${linha.excluido ? "opacity-45" : ""}`}>
        <td className="px-4 py-2.5 text-tinta">
          {p.titulo}
          {p.variantes.length > 1 && (
            <span className="text-cinza"> · {variante.tituloVariacao}</span>
          )}
          {p.local && (
            <span className="ml-2 rounded-[6px] bg-violeta-claro px-1.5 py-0.5 text-[0.6875rem] font-semibold text-violeta">
              criado no painel
            </span>
          )}
          {linha.editado && !linha.excluido && (
            <span className="ml-2 rounded-[6px] bg-roxo-claro px-1.5 py-0.5 text-[0.6875rem] font-semibold text-roxo">
              editado
            </span>
          )}
          {linha.excluido && (
            <span className="ml-2 rounded-[6px] bg-superficie px-1.5 py-0.5 text-[0.6875rem] font-semibold text-cinza">
              excluído da loja
            </span>
          )}
          {!disponivel && !linha.excluido && (
            <span className="ml-2 rounded-[6px] bg-erro/10 px-1.5 py-0.5 text-[0.6875rem] font-semibold text-erro">
              esgotado
            </span>
          )}
        </td>
        <td className="px-4 py-2.5 text-grafite">{linha.marca}</td>
        <td className="num px-4 py-2.5 text-grafite">{variante.sku}</td>
        <td className="num px-4 py-2.5 text-right">{formatarPreco(variante.precoPor)}</td>
        <td
          className={`num px-4 py-2.5 text-right font-medium ${
            variante.estoque === 0 ? "text-erro" : variante.estoque <= 5 ? "text-alerta" : "text-sucesso"
          }`}
        >
          {variante.estoque}
        </td>
        <td className="px-4 py-2.5 text-right">
          <span className="flex justify-end gap-3 text-[0.8125rem]">
            {linha.excluido ? (
              <button type="button" onClick={aoRestaurar} className="text-sucesso underline">
                Restaurar
              </button>
            ) : (
              <>
                <button type="button" onClick={aoEditar} className="text-roxo underline">
                  {emEdicao ? "Fechar" : "Editar"}
                </button>
                {disponivel ? (
                  <button
                    type="button"
                    onClick={() => aoEsgotar(true)}
                    title="Marca o produto como sem estoque: o card mostra 'Esgotado' e a compra fica travada"
                    className="text-alerta underline"
                  >
                    Esgotar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => aoEsgotar(false)}
                    title="Devolve o produto à venda com o estoque anterior"
                    className="text-sucesso underline"
                  >
                    Repor
                  </button>
                )}
                {linha.editado && !p.local && (
                  <button type="button" onClick={aoRestaurar} className="text-cinza underline">
                    Desfazer
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Excluir "${p.titulo}" da loja?`)) aoExcluir();
                  }}
                  className="text-erro underline"
                >
                  Excluir
                </button>
              </>
            )}
          </span>
        </td>
      </tr>
      {emEdicao && !linha.excluido && (
        <tr className="border-t border-linha bg-superficie/60">
          <td colSpan={6} className="px-4 py-4">
            <FormEditarProduto produto={p} variante={variante} aoSalvar={aoSalvar} />
          </td>
        </tr>
      )}
    </>
  );
}

function FormEditarProduto({
  produto,
  variante,
  aoSalvar,
}: {
  produto: Produto;
  variante: Produto["variantes"][number];
  aoSalvar: (edicao: EdicaoProduto) => void;
}) {
  const [titulo, setTitulo] = useState(produto.titulo);
  const [marca, setMarca] = useState(produto.marca);
  const [preco, setPreco] = useState((variante.precoPor / 100).toFixed(2).replace(".", ","));
  const [precoDe, setPrecoDe] = useState(
    variante.precoDe ? (variante.precoDe / 100).toFixed(2).replace(".", ",") : ""
  );
  const [estoque, setEstoque] = useState(String(variante.estoque));
  const [imagem, setImagem] = useState(produto.imagens?.[0] ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    const precoCent = reaisParaCentavos(preco);
    if (!titulo.trim()) return setErro("Informe o nome do produto.");
    if (precoCent === null || precoCent <= 0) return setErro("Preço inválido. Use o formato 89,90.");
    const precoDeCent = precoDe.trim() ? reaisParaCentavos(precoDe) : null;
    if (precoDe.trim() && precoDeCent === null) return setErro("Preço 'De' inválido.");
    if (precoDeCent !== null && precoDeCent <= precoCent) {
      return setErro("O preço 'De' precisa ser maior que o preço 'Por'.");
    }
    const estoqueNum = Number(estoque);
    if (!Number.isInteger(estoqueNum) || estoqueNum < 0) return setErro("Estoque inválido.");

    // preço mudou num produto do catálogo → fixa no servidor, para valer em
    // TODOS os navegadores (não só neste). Sem servidor (demo), fica local.
    const precoMudou =
      precoCent !== variante.precoPor || (precoDeCent ?? null) !== (variante.precoDe ?? null);
    if (precoMudou && !produto.local && servidorConfigurado()) {
      setSalvando(true);
      setErro(null);
      const r = await definirPrecoManual(produto.slug, precoCent, precoDeCent, produto.titulo);
      setSalvando(false);
      if (!r.ok) {
        return setErro(r.erro ?? "Não deu para salvar o preço no servidor. Tente de novo.");
      }
    }

    aoSalvar({
      titulo: titulo.trim(),
      marca,
      precoPor: precoCent,
      precoDe: precoDeCent,
      estoque: estoqueNum,
      imagem: imagem.trim() || undefined,
    });
  }

  return (
    <form onSubmit={salvar} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <CampoAdmin rotulo="Nome" valor={titulo} aoMudar={setTitulo} classeExtra="lg:col-span-2" />
      <label className="block">
        <span className="text-[0.8125rem] font-medium text-grafite">Marca</span>
        <select
          value={marca}
          onChange={(e) => setMarca(e.target.value)}
          className="mt-1 h-10 w-full rounded-[6px] border border-linha bg-white px-3 text-[0.875rem] outline-none focus:border-violeta"
        >
          {marcas.map((m) => (
            <option key={m.slug} value={m.slug}>
              {m.nome}
            </option>
          ))}
        </select>
      </label>
      <CampoAdmin rotulo="Preço (R$)" valor={preco} aoMudar={setPreco} numerico />
      <CampoAdmin rotulo="De (R$, opcional)" valor={precoDe} aoMudar={setPrecoDe} numerico />
      <CampoAdmin rotulo="Estoque" valor={estoque} aoMudar={setEstoque} numerico />
      <CampoAdmin
        rotulo="URL da foto (opcional)"
        valor={imagem}
        aoMudar={setImagem}
        classeExtra="sm:col-span-2 lg:col-span-4"
      />
      <div className="flex items-end gap-3">
        <button
          type="submit"
          disabled={salvando}
          aria-busy={salvando}
          className="h-10 rounded-[999px] bg-roxo px-5 text-[0.8125rem] font-semibold text-white hover:bg-roxo-escuro disabled:opacity-60"
        >
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
      {!produto.local && servidorConfigurado() && (
        <p className="text-[0.75rem] text-cinza sm:col-span-2 lg:col-span-5">
          Preço alterado aqui vale para todos os clientes da loja (fica salvo no servidor).
          &quot;Restaurar&quot; volta ao preço padrão do catálogo.
        </p>
      )}
      {produto.variantes.length > 1 && (
        <p className="text-[0.75rem] text-cinza sm:col-span-2 lg:col-span-5">
          Preço e estoque editados valem para a 1ª variação ({variante.tituloVariacao}).
        </p>
      )}
      {erro && (
        <p role="alert" className="text-[0.8125rem] font-medium text-erro sm:col-span-2 lg:col-span-5">
          {erro}
        </p>
      )}
    </form>
  );
}

function FormNovoProduto({ aoCriar }: { aoCriar: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [marca, setMarca] = useState(marcas[0]?.slug ?? "");
  const [categoria, setCategoria] = useState(categorias[0]?.slug ?? "");
  const [preco, setPreco] = useState("");
  const [precoDe, setPrecoDe] = useState("");
  const [estoque, setEstoque] = useState("10");
  const [imagem, setImagem] = useState("");
  const [descricao, setDescricao] = useState("");
  const [destacar, setDestacar] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  function criar(e: React.FormEvent) {
    e.preventDefault();
    const precoCent = reaisParaCentavos(preco);
    if (!titulo.trim()) return setErro("Informe o nome do produto.");
    if (precoCent === null || precoCent <= 0) return setErro("Preço inválido. Use o formato 89,90.");
    const precoDeCent = precoDe.trim() ? reaisParaCentavos(precoDe) : null;
    if (precoDe.trim() && precoDeCent === null) return setErro("Preço 'De' inválido.");
    const estoqueNum = Number(estoque);
    if (!Number.isInteger(estoqueNum) || estoqueNum < 0) return setErro("Estoque inválido.");
    const resultado = criarProdutoLocal({
      titulo,
      marca,
      categoria,
      descricao,
      precoPorCentavos: precoCent,
      precoDeCentavos: precoDeCent,
      estoque: estoqueNum,
      imagem: imagem.trim(),
      destacar,
    });
    if (!resultado.ok) return setErro(resultado.erro ?? "Não foi possível criar o produto.");
    aoCriar();
  }

  return (
    <form onSubmit={criar} className="mt-4 rounded-[16px] border border-linha bg-white p-5">
      <h2 className="font-titulo text-[1.125rem] font-semibold">Novo produto</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CampoAdmin rotulo="Nome do produto" valor={titulo} aoMudar={setTitulo} classeExtra="sm:col-span-2" />
        <label className="block">
          <span className="text-[0.8125rem] font-medium text-grafite">Marca</span>
          <select
            value={marca}
            onChange={(e) => setMarca(e.target.value)}
            className="mt-1 h-10 w-full rounded-[6px] border border-linha bg-white px-3 text-[0.875rem] outline-none focus:border-violeta"
          >
            {marcas.map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[0.8125rem] font-medium text-grafite">Categoria</span>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="mt-1 h-10 w-full rounded-[6px] border border-linha bg-white px-3 text-[0.875rem] outline-none focus:border-violeta"
          >
            {categorias.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <CampoAdmin rotulo="Preço (R$)" valor={preco} aoMudar={setPreco} numerico placeholder="89,90" />
        <CampoAdmin rotulo="De (R$, opcional)" valor={precoDe} aoMudar={setPrecoDe} numerico placeholder="109,90" />
        <CampoAdmin rotulo="Estoque" valor={estoque} aoMudar={setEstoque} numerico />
        <CampoAdmin
          rotulo="URL da foto (opcional)"
          valor={imagem}
          aoMudar={setImagem}
          placeholder="https://…/foto.jpg"
        />
        <label className="block sm:col-span-2 lg:col-span-4">
          <span className="text-[0.8125rem] font-medium text-grafite">Descrição</span>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-[6px] border border-linha bg-white px-3 py-2 text-[0.875rem] outline-none focus:border-violeta"
          />
        </label>
        <label className="flex items-center gap-2 text-[0.875rem] text-grafite sm:col-span-2">
          <input
            type="checkbox"
            checked={destacar}
            onChange={(e) => setDestacar(e.target.checked)}
            className="h-4 w-4 accent-[#4A2882]"
          />
          Destacar na home (seção Mais vendidos)
        </label>
      </div>
      {erro && (
        <p role="alert" className="mt-3 text-[0.8125rem] font-medium text-erro">
          {erro}
        </p>
      )}
      <button
        type="submit"
        className="mt-4 rounded-[999px] bg-roxo px-6 py-2.5 text-[0.9375rem] font-semibold text-white hover:bg-roxo-escuro"
      >
        Criar produto
      </button>
      <p className="mt-3 text-[0.75rem] text-cinza">
        O produto entra na loja na hora: aparece na categoria escolhida, na busca e (se marcado)
        na home. Sem foto, a loja usa uma imagem ilustrativa nas cores da marca.
      </p>
    </form>
  );
}

function CampoAdmin({
  rotulo,
  valor,
  aoMudar,
  numerico = false,
  placeholder,
  classeExtra = "",
}: {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  numerico?: boolean;
  placeholder?: string;
  classeExtra?: string;
}) {
  return (
    <label className={`block ${classeExtra}`}>
      <span className="text-[0.8125rem] font-medium text-grafite">{rotulo}</span>
      <input
        type="text"
        inputMode={numerico ? "decimal" : undefined}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        placeholder={placeholder}
        className={`mt-1 h-10 w-full rounded-[6px] border border-linha bg-white px-3 text-[0.875rem] outline-none focus:border-violeta ${numerico ? "num" : ""}`}
      />
    </label>
  );
}

function Cartao({ valor, rotulo, alerta = false }: { valor: string; rotulo: string; alerta?: boolean }) {
  return (
    <div className="rounded-[16px] border border-linha bg-white px-4 py-3">
      <p className={`num text-[1.25rem] font-bold leading-none ${alerta ? "text-alerta" : "text-tinta"}`}>{valor}</p>
      <p className="mt-1 text-[0.75rem] text-grafite">{rotulo}</p>
    </div>
  );
}
