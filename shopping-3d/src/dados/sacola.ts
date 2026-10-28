/**
 * A sacola do visitante: produtos de várias lojas do shopping, guardados no
 * aparelho. Cada loja fecha o que é dela no próprio caixa.
 */
import type { Produto } from "./catalogo";

export interface ItemSacola {
  produto: Produto;
  lojaId: string;
  lojaNome: string;
  unidade: string;
  qtd: number;
}

const CHAVE = "shopping3d.sacola";
type Ouvinte = (itens: ItemSacola[]) => void;

class Sacola {
  private itens: ItemSacola[] = [];
  private ouvintes: Ouvinte[] = [];

  constructor() {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE) ?? "[]");
      if (Array.isArray(salvo)) this.itens = salvo.filter((i) => i?.produto?.id && i.qtd > 0);
    } catch {
      this.itens = [];
    }
  }

  private mudou() {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(this.itens));
    } catch {
      /* sem armazenamento: a sacola vale até fechar */
    }
    this.ouvintes.forEach((f) => f(this.itens));
  }

  ouvir(f: Ouvinte) {
    this.ouvintes.push(f);
    f(this.itens);
  }

  lista() {
    return this.itens;
  }

  quantidade() {
    return this.itens.reduce((n, i) => n + i.qtd, 0);
  }

  colocar(produto: Produto, loja: { id: string; nome: string; unidade: string }, qtd = 1) {
    const i = this.itens.find((x) => x.produto.id === produto.id && x.lojaId === loja.id);
    if (i) i.qtd += qtd;
    else this.itens.push({ produto, lojaId: loja.id, lojaNome: loja.nome, unidade: loja.unidade, qtd });
    this.mudou();
  }

  mudar(produtoId: string, lojaId: string, delta: number) {
    const i = this.itens.find((x) => x.produto.id === produtoId && x.lojaId === lojaId);
    if (!i) return;
    i.qtd += delta;
    if (i.qtd <= 0) this.itens = this.itens.filter((x) => x !== i);
    this.mudou();
  }

  daLoja(lojaId: string) {
    return this.itens.filter((i) => i.lojaId === lojaId);
  }

  /** lojas com itens, na ordem em que entraram na sacola */
  lojas() {
    const vistas = new Map<string, { id: string; nome: string; unidade: string }>();
    for (const i of this.itens) if (!vistas.has(i.lojaId)) vistas.set(i.lojaId, { id: i.lojaId, nome: i.lojaNome, unidade: i.unidade });
    return [...vistas.values()];
  }
}

export const sacola = new Sacola();
export const totalDe = (itens: ItemSacola[]) => itens.reduce((s, i) => s + i.produto.preco * i.qtd, 0);
