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
import { buscarCupom, calcularDesconto, conferirRegrasCupom, type Cupom } from "@/lib/cupons";

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
  /** desconto do cupom aplicado (cupom entra depois do desconto de produto, antes do Pix) */
  descontoCentavos: number;
  cupomAplicado: string | null;
  totalItens: number;
  aberto: boolean;
  abrir: () => void;
  fechar: () => void;
  /** `abrirSacola: false` só põe na sacola, sem abrir a gaveta (a loja 3D mostra na cesta) */
  adicionar: (produtoSlug: string, sku: string, quantidade?: number, abrirSacola?: boolean) => void;
  remover: (sku: string) => void;
  alterarQuantidade: (sku: string, quantidade: number) => void;
  aplicarCupom: (codigo: string) => Promise<{ ok: boolean; erro?: string }>;
  removerCupom: () => void;
  limpar: () => void;
}

const Contexto = createContext<CarrinhoContexto | null>(null);
const CHAVE_STORAGE = "beautynow:carrinho:v1";
const CHAVE_CUPOM = "beautynow:cupom:v1";

export function CarrinhoProvider({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<ItemCarrinho[]>([]);
  // o cupom inteiro (não só o código): a conferência é no servidor, e o
  // desconto precisa ser recalculado a cada mudança do carrinho sem esperar rede
  const [cupom, setCupom] = useState<Cupom | null>(null);
  const cupomAplicado = cupom?.codigo ?? null;
  const [aberto, setAberto] = useState(false);
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_STORAGE);
      if (salvo) setItens(JSON.parse(salvo) as ItemCarrinho[]);
      const salvoCupom = localStorage.getItem(CHAVE_CUPOM);
      if (salvoCupom) {
        // versão antiga guardava só o código; a nova guarda o cupom inteiro
        const codigo = salvoCupom.startsWith("{") ? (JSON.parse(salvoCupom) as Cupom).codigo : salvoCupom;
        if (salvoCupom.startsWith("{")) setCupom(JSON.parse(salvoCupom) as Cupom);
        // reconfere no servidor: o admin pode ter desativado ou mudado o cupom
        void buscarCupom(codigo).then((r) => {
          if (r.ok && r.cupom) setCupom(r.cupom);
          else if (!r.erro?.startsWith("Não consegui")) setCupom(null);
        });
      }
    } catch {
      // storage indisponível (modo privado) — segue com carrinho em memória
    }
    setHidratado(true);
  }, []);

  useEffect(() => {
    if (!hidratado) return;
    try {
      localStorage.setItem(CHAVE_STORAGE, JSON.stringify(itens));
      if (cupom) localStorage.setItem(CHAVE_CUPOM, JSON.stringify(cupom));
      else localStorage.removeItem(CHAVE_CUPOM);
    } catch {
      // sem persistência — aceitável
    }
  }, [itens, cupom, hidratado]);

  const adicionar = useCallback((produtoSlug: string, sku: string, quantidade = 1, abrirSacola = true) => {
    setItens((atual) => {
      const existente = atual.find((i) => i.sku === sku);
      if (existente) {
        return atual.map((i) =>
          i.sku === sku ? { ...i, quantidade: i.quantidade + quantidade } : i
        );
      }
      return [...atual, { produtoSlug, sku, quantidade }];
    });
    if (abrirSacola) setAberto(true);
  }, []);

  const remover = useCallback((sku: string) => {
    setItens((atual) => atual.filter((i) => i.sku !== sku));
  }, []);

  const alterarQuantidade = useCallback((sku: string, quantidade: number) => {
    if (quantidade < 1) return;
    setItens((atual) => atual.map((i) => (i.sku === sku ? { ...i, quantidade } : i)));
  }, []);

  const limpar = useCallback(() => {
    setItens([]);
    setCupom(null);
  }, []);
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

    // revalida o cupom salvo a cada mudança do carrinho — se deixou de valer
    // (mínimo não atingido, cupom desativado), o desconto zera sem apagar o código
    let descontoCentavos = 0;
    if (cupom && hidratado && conferirRegrasCupom(cupom, subtotalCentavos).ok) {
      descontoCentavos = calcularDesconto(cupom, subtotalCentavos);
    }

    const aplicarCupom = async (codigo: string) => {
      const resultado = await buscarCupom(codigo);
      if (!resultado.ok || !resultado.cupom) return { ok: false, erro: resultado.erro };
      const regras = conferirRegrasCupom(resultado.cupom, subtotalCentavos);
      if (!regras.ok) return regras;
      setCupom(resultado.cupom);
      return { ok: true };
    };

    return {
      itens: detalhados,
      subtotalCentavos,
      descontoCentavos,
      cupomAplicado,
      totalItens,
      aberto,
      abrir,
      fechar,
      adicionar,
      remover,
      alterarQuantidade,
      aplicarCupom,
      removerCupom: () => setCupom(null),
      limpar,
    };
  }, [itens, cupom, cupomAplicado, hidratado, aberto, abrir, fechar, adicionar, remover, alterarQuantidade, limpar]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useCarrinho(): CarrinhoContexto {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useCarrinho precisa estar dentro de <CarrinhoProvider>");
  return ctx;
}
