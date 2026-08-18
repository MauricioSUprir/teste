"use client";

/**
 * Estado do carrinho — persistido em localStorage na demo.
 * Na integração real, o carrinho vive no Medusa e este contexto vira
 * um espelho otimista da API.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { obterProduto } from "@/lib/catalogo/consultas";
import type { Produto, Variante } from "@/lib/catalogo/tipos";

export interface ItemCarrinho {
  produtoSlug: string;
  sku: string;
  quantidade: number;
}

export interface ItemDetalhado extends ItemCarrinho {
  produto: Produto;
  variante: Variante;
}

interface CarrinhoContexto {
  itens: ItemDetalhado[];
  subtotalCentavos: number;
  totalItens: number;
  aberto: boolean;
  abrir: () => void;
  fechar: () => void;
  adicionar: (produtoSlug: string, sku: string, quantidade?: number) => void;
  remover: (sku: string) => void;
  alterarQuantidade: (sku: string, quantidade: number) => void;
  limpar: () => void;
}

const Contexto = createContext<CarrinhoContexto | null>(null);
const CHAVE_STORAGE = "beautynow:carrinho:v1";

export function CarrinhoProvider({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<ItemCarrinho[]>([]);
  const [aberto, setAberto] = useState(false);
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_STORAGE);
      if (salvo) setItens(JSON.parse(salvo) as ItemCarrinho[]);
    } catch {
      // storage indisponível (modo privado) — segue com carrinho em memória
    }
    setHidratado(true);
  }, []);

  useEffect(() => {
    if (!hidratado) return;
    try {
      localStorage.setItem(CHAVE_STORAGE, JSON.stringify(itens));
    } catch {
      // sem persistência — aceitável
    }
  }, [itens, hidratado]);

  const adicionar = useCallback((produtoSlug: string, sku: string, quantidade = 1) => {
    setItens((atual) => {
      const existente = atual.find((i) => i.sku === sku);
      if (existente) {
        return atual.map((i) =>
          i.sku === sku ? { ...i, quantidade: i.quantidade + quantidade } : i
        );
      }
      return [...atual, { produtoSlug, sku, quantidade }];
    });
    setAberto(true);
  }, []);

  const remover = useCallback((sku: string) => {
    setItens((atual) => atual.filter((i) => i.sku !== sku));
  }, []);

  const alterarQuantidade = useCallback((sku: string, quantidade: number) => {
    if (quantidade < 1) return;
    setItens((atual) => atual.map((i) => (i.sku === sku ? { ...i, quantidade } : i)));
  }, []);

  const limpar = useCallback(() => setItens([]), []);
  const abrir = useCallback(() => setAberto(true), []);
  const fechar = useCallback(() => setAberto(false), []);

  const valor = useMemo<CarrinhoContexto>(() => {
    const detalhados: ItemDetalhado[] = [];
    for (const item of itens) {
      const produto = obterProduto(item.produtoSlug);
      const variante = produto?.variantes.find((v) => v.sku === item.sku);
      if (produto && variante) detalhados.push({ ...item, produto, variante });
    }
    const subtotalCentavos = detalhados.reduce(
      (acc, i) => acc + i.variante.precoPor * i.quantidade,
      0
    );
    const totalItens = detalhados.reduce((acc, i) => acc + i.quantidade, 0);
    return {
      itens: detalhados,
      subtotalCentavos,
      totalItens,
      aberto,
      abrir,
      fechar,
      adicionar,
      remover,
      alterarQuantidade,
      limpar,
    };
  }, [itens, aberto, abrir, fechar, adicionar, remover, alterarQuantidade, limpar]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useCarrinho(): CarrinhoContexto {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useCarrinho precisa estar dentro de <CarrinhoProvider>");
  return ctx;
}
