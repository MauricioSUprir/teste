"use client";

/**
 * Estado B2B da Be2Beauty — catálogo aberto, preço fechado.
 *
 * O CNPJ cadastrado fica no localStorage do navegador junto com o último
 * status conhecido (o servidor no plano grátis pode levar ~1min para acordar,
 * então o status em cache libera a tela na hora e a checagem real roda em
 * segundo plano). No BeautyNow (LOJA.b2b = false) tudo é liberado sempre.
 */
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { LOJA } from "@/lib/loja";
import { consultarStatusB2B, type StatusB2B } from "@/lib/servidor";

const CHAVE_CNPJ = "b2b-cnpj";
const CHAVE_STATUS = "b2b-status";

interface ContextoB2B {
  /** true = pode ver preço e comprar */
  liberado: boolean;
  /** situação conhecida do cadastro (null = sem CNPJ salvo neste navegador) */
  status: StatusB2B | null;
  cnpj: string | null;
  /** guarda o CNPJ recém-cadastrado e o status devolvido pelo servidor */
  registrar: (cnpj: string, status: StatusB2B) => void;
  /** reconsulta o servidor (botão "verificar novamente") */
  verificar: () => Promise<StatusB2B | null>;
  /** esquece o CNPJ deste navegador */
  limpar: () => void;
}

const Contexto = createContext<ContextoB2B>({
  liberado: !LOJA.b2b,
  status: null,
  cnpj: null,
  registrar: () => {},
  verificar: async () => null,
  limpar: () => {},
});

export function B2BProvider({ children }: { children: React.ReactNode }) {
  const [cnpj, setCnpj] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusB2B | null>(null);

  // hidrata do cache e reconsulta o servidor em segundo plano
  useEffect(() => {
    if (!LOJA.b2b) return;
    const salvoCnpj = localStorage.getItem(CHAVE_CNPJ);
    const salvoStatus = localStorage.getItem(CHAVE_STATUS) as StatusB2B | null;
    if (!salvoCnpj) return;
    setCnpj(salvoCnpj);
    if (salvoStatus) setStatus(salvoStatus);
    consultarStatusB2B(salvoCnpj).then((s) => {
      if (s) {
        setStatus(s);
        localStorage.setItem(CHAVE_STATUS, s);
      }
    });
  }, []);

  const registrar = useCallback((novoCnpj: string, novoStatus: StatusB2B) => {
    setCnpj(novoCnpj);
    setStatus(novoStatus);
    localStorage.setItem(CHAVE_CNPJ, novoCnpj);
    localStorage.setItem(CHAVE_STATUS, novoStatus);
  }, []);

  const verificar = useCallback(async () => {
    if (!cnpj) return null;
    const s = await consultarStatusB2B(cnpj);
    if (s) {
      setStatus(s);
      localStorage.setItem(CHAVE_STATUS, s);
    }
    return s;
  }, [cnpj]);

  const limpar = useCallback(() => {
    setCnpj(null);
    setStatus(null);
    localStorage.removeItem(CHAVE_CNPJ);
    localStorage.removeItem(CHAVE_STATUS);
  }, []);

  return (
    <Contexto.Provider
      value={{
        liberado: !LOJA.b2b || status === "aprovado",
        status,
        cnpj,
        registrar,
        verificar,
        limpar,
      }}
    >
      {children}
    </Contexto.Provider>
  );
}

export function useB2B() {
  return useContext(Contexto);
}
