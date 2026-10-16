/**
 * Linhas profissionais em destaque — pedido comercial de 16/10 para a
 * Be2Beauty: na primeira impressão, Evoly, as linhas de 1 litro, os
 * finalizadores, o pó descolorante e as OX da D'vence, a Theoric e a
 * maquiagem. Cada
 * seleção tem página própria em /destaques/[slug] e é montada por regra (nome,
 * marca, categoria), então produto novo do Hub entra sozinho.
 */
import { copy } from "@/lib/copy";
import { produtos } from "./consultas";
import type { Produto } from "./tipos";

export type SlugDestaque = keyof typeof copy.destaques.itens;

export interface Destaque {
  slug: SlugDestaque;
  nome: string;
  chamada: string;
  texto: string;
  produtos: Produto[];
}

const LITRO = /\b(1\s?l|1\s?litro|1000\s?ml|1\.000\s?ml|1\s?kg|1000\s?g)\b/i;
const FINALIZADOR =
  /\b(finalizador|finalizadora|leave[- ]?in|creme de pentear|ativador|modelador|gelatina|óleo|oleo|s[ée]rum|spray|fluido|reparador de pontas|termoprotetor|protetor t[ée]rmico|bruma|pomada|cera|style stick|mousse|day after|brilho|reparador)\b/i;
// lavatório, química e outras categorias não são finalizador, mesmo citando "óleo" ou "spray"
const NAO_FINALIZADOR =
  /\b(shampoo|xampu|condicionador|m[áa]scara|kit|co[- ]?wash|acidificante|tonalizante|colora[çc][ãa]o|descolorante|oxi|emuls|ampola|prote[íi]na|reconstrutor|sabonete|corporal|body|facial|labial|lip|unhas?)\b/i;
const DESCOLORACAO =
  /\b(descolorante|p[óo] desc|emuls[ãa]o reveladora|oxi|ox|água oxigenada|agua oxigenada|white blond|\d+\s?vol(umes)?)\b/i;

const temEstoque = (p: Produto) => p.variantes.some((v) => v.estoque > 0);
const temFoto = (p: Produto) => (p.imagens?.length ?? 0) > 0;

/** marcas que o comercial pediu em evidência vêm primeiro em toda seleção */
const MARCAS_PRIMEIRO = ["evoly", "d-vence", "theoric"];
const ordem = (p: Produto) => {
  const i = MARCAS_PRIMEIRO.indexOf(p.marca);
  return (i < 0 ? MARCAS_PRIMEIRO.length : i) * 10 + (temEstoque(p) ? 0 : 2) + (temFoto(p) ? 0 : 1);
};

const REGRAS: Record<SlugDestaque, (p: Produto) => boolean> = {
  evoly: (p) => p.marca === "evoly",
  "linhas-de-litro": (p) => p.categorias[0] === "cabelos" && LITRO.test(p.titulo),
  finalizadores: (p) =>
    p.categorias[0] === "cabelos" && FINALIZADOR.test(p.titulo) && !NAO_FINALIZADOR.test(p.titulo),
  descoloracao: (p) => p.categorias[0] === "cabelos" && DESCOLORACAO.test(p.titulo),
  theoric: (p) => p.marca === "theoric",
  maquiagem: (p) => p.categorias[0] === "maquiagem",
};

export const destaques: Destaque[] = (Object.keys(REGRAS) as SlugDestaque[])
  .map((slug) => ({
    slug,
    ...copy.destaques.itens[slug],
    produtos: produtos.filter(REGRAS[slug]).sort((a, b) => ordem(a) - ordem(b)),
  }))
  .filter((d) => d.produtos.length > 0);

export function obterDestaque(slug: string): Destaque | undefined {
  return destaques.find((d) => d.slug === slug);
}
