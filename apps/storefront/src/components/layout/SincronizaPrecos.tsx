"use client";

/**
 * Ao abrir o site, busca no servidor os preços fixados manualmente pelo admin
 * e aplica por cima do catálogo — assim uma mudança de preço feita no painel
 * vale para todos os clientes, não só para o navegador do admin.
 */
import { useEffect } from "react";
import { anunciarAjustes, aplicarPrecosServidor } from "@/lib/catalogo/ajustes";
import { consultarPrecosManuais } from "@/lib/servidor";

export function SincronizaPrecos() {
  useEffect(() => {
    let ativo = true;
    consultarPrecosManuais().then((precos) => {
      if (!ativo || precos === null) return;
      if (aplicarPrecosServidor(precos)) anunciarAjustes();
    });
    return () => {
      ativo = false;
    };
  }, []);
  return null;
}
