/**
 * Ajustes manuais do catálogo feitos no painel admin — produtos adicionados,
 * editados e excluídos à mão. Na demo ficam no navegador (localStorage);
 * com o ERP/Hub conectado, o catálogo central é a fonte da verdade e estes
 * ajustes viram exceções pontuais.
 *
 * As páginas estáticas continuam geradas com o catálogo base; os componentes
 * client aplicam os ajustes após a hidratação (sem mismatch de SSR).
 */
import type { Produto } from "./tipos";

export interface EdicaoProduto {
  titulo?: string;
  descricao?: string;
  /** preços em centavos — aplicados à 1ª variação */
  precoPor?: number;
  precoDe?: number | null;
  estoque?: number;
  /** URL de foto que substitui/da imagem principal */
  imagem?: string;
  /** true = todas as variações ficam sem estoque (produto some da venda) */
  esgotado?: boolean;
}

export interface AjustesCatalogo {
  adicionados: Produto[];
  editados: Record<string, EdicaoProduto>;
  excluidos: string[];
}

const CHAVE = "beautynow:catalogo-ajustes:v1";
const VAZIO: AjustesCatalogo = { adicionados: [], editados: {}, excluidos: [] };

export function lerAjustes(): AjustesCatalogo {
  if (typeof window === "undefined") return VAZIO;
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return VAZIO;
    const a = JSON.parse(bruto) as Partial<AjustesCatalogo>;
    return {
      adicionados: a.adicionados ?? [],
      editados: a.editados ?? {},
      excluidos: a.excluidos ?? [],
    };
  } catch {
    return VAZIO;
  }
}

export function gravarAjustes(ajustes: AjustesCatalogo) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(ajustes));
  } catch {
    // storage indisponível
  }
}

/** Aplica edição/exclusão a um produto do catálogo base (ou devolve um local). */
export function aplicarAjustesProduto(produto: Produto): Produto | null {
  const ajustes = lerAjustes();
  if (ajustes.excluidos.includes(produto.slug)) return null;
  const edicao = ajustes.editados[produto.slug];
  if (!edicao) return produto;
  return aplicarEdicao(produto, edicao);
}

export function aplicarEdicao(produto: Produto, e: EdicaoProduto): Produto {
  let variantes = produto.variantes.map((v, i) =>
    i === 0
      ? {
          ...v,
          precoPor: e.precoPor ?? v.precoPor,
          precoDe: e.precoDe !== undefined ? e.precoDe : v.precoDe,
          estoque: e.estoque ?? v.estoque,
        }
      : v
  );
  if (e.esgotado) {
    variantes = variantes.map((v) => ({ ...v, estoque: 0 }));
  }
  return {
    ...produto,
    titulo: e.titulo ?? produto.titulo,
    descricao: e.descricao ?? produto.descricao,
    imagens: e.imagem ? [e.imagem, ...(produto.imagens ?? []).slice(1)] : produto.imagens,
    variantes,
  };
}

/** Lista com exclusões e edições aplicadas (não inclui os adicionados). */
export function aplicarAjustesLista(produtos: Produto[]): Produto[] {
  const ajustes = lerAjustes();
  if (
    ajustes.excluidos.length === 0 &&
    Object.keys(ajustes.editados).length === 0
  ) {
    return produtos;
  }
  return produtos
    .filter((p) => !ajustes.excluidos.includes(p.slug))
    .map((p) => (ajustes.editados[p.slug] ? aplicarEdicao(p, ajustes.editados[p.slug]) : p));
}

export function produtosLocais(): Produto[] {
  return lerAjustes().adicionados;
}

export function obterProdutoLocal(slug: string): Produto | undefined {
  return lerAjustes().adicionados.find((p) => p.slug === slug);
}

export function slugificar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface NovoProdutoDados {
  titulo: string;
  marca: string; // slug
  categoria: string; // slug
  descricao: string;
  precoPorCentavos: number;
  precoDeCentavos: number | null;
  estoque: number;
  imagem: string;
  destacar: boolean;
}

export function criarProdutoLocal(dados: NovoProdutoDados): { ok: boolean; erro?: string } {
  const ajustes = lerAjustes();
  const base = slugificar(dados.titulo);
  if (!base) return { ok: false, erro: "Informe o nome do produto." };
  let slug = `local-${base}`;
  let n = 2;
  while (ajustes.adicionados.some((p) => p.slug === slug)) {
    slug = `local-${base}-${n}`;
    n += 1;
  }
  const produto: Produto = {
    slug,
    titulo: dados.titulo.trim(),
    marca: dados.marca,
    categorias: dados.categoria ? [dados.categoria] : [],
    descricao: dados.descricao.trim(),
    beneficios: [],
    modoDeUso: [],
    composicao: "",
    especificacoes: {},
    atributos: {},
    variantes: [
      {
        sku: `LOCAL-${Date.now().toString(36).toUpperCase()}`,
        tituloVariacao: "Único",
        precoDe: dados.precoDeCentavos,
        precoPor: dados.precoPorCentavos,
        estoque: dados.estoque,
        pesoG: 300,
      },
    ],
    avaliacoes: [],
    maisVendido: dados.destacar,
    imagens: dados.imagem ? [dados.imagem] : undefined,
    local: true,
    visual: { corA: "#4A2882", corB: "#6847C8", forma: "frasco" },
  };
  gravarAjustes({ ...ajustes, adicionados: [produto, ...ajustes.adicionados] });
  return { ok: true };
}

export function editarProduto(slug: string, edicao: EdicaoProduto) {
  const ajustes = lerAjustes();
  const local = ajustes.adicionados.find((p) => p.slug === slug);
  if (local) {
    gravarAjustes({
      ...ajustes,
      adicionados: ajustes.adicionados.map((p) =>
        p.slug === slug ? aplicarEdicao(p, edicao) : p
      ),
    });
    return;
  }
  gravarAjustes({
    ...ajustes,
    editados: { ...ajustes.editados, [slug]: { ...ajustes.editados[slug], ...edicao } },
  });
}

/** Produto base: marca como excluído. Produto local: remove de vez. */
export function excluirProduto(slug: string) {
  const ajustes = lerAjustes();
  if (ajustes.adicionados.some((p) => p.slug === slug)) {
    gravarAjustes({
      ...ajustes,
      adicionados: ajustes.adicionados.filter((p) => p.slug !== slug),
    });
    return;
  }
  if (!ajustes.excluidos.includes(slug)) {
    gravarAjustes({ ...ajustes, excluidos: [...ajustes.excluidos, slug] });
  }
}

/**
 * Marca/desmarca o produto como esgotado (acabou o estoque físico).
 * Esgotado: some o botão de compra e o card mostra "Esgotado", sem excluir
 * o produto da loja. Repor volta ao estoque anterior (base) ou padrão (local).
 */
export function marcarEsgotado(slug: string, esgotado: boolean) {
  const ajustes = lerAjustes();
  const local = ajustes.adicionados.find((p) => p.slug === slug);
  if (local) {
    gravarAjustes({
      ...ajustes,
      adicionados: ajustes.adicionados.map((p) =>
        p.slug === slug
          ? {
              ...p,
              variantes: p.variantes.map((v) => ({
                ...v,
                estoque: esgotado ? 0 : Math.max(v.estoque, 10),
              })),
            }
          : p
      ),
    });
    return;
  }
  const edicao: EdicaoProduto = { ...ajustes.editados[slug], esgotado };
  if (!esgotado) {
    // repor: além de tirar a marcação, zera um estoque editado manualmente
    // para o valor original do catálogo voltar a valer
    if (edicao.estoque === 0) delete edicao.estoque;
    delete edicao.esgotado;
  }
  gravarAjustes({ ...ajustes, editados: { ...ajustes.editados, [slug]: edicao } });
}

export function restaurarProduto(slug: string) {
  const ajustes = lerAjustes();
  const { [slug]: _removida, ...editados } = ajustes.editados; // eslint-disable-line @typescript-eslint/no-unused-vars
  gravarAjustes({
    ...ajustes,
    editados,
    excluidos: ajustes.excluidos.filter((s) => s !== slug),
  });
}
