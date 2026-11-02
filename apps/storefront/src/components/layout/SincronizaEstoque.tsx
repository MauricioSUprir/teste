"use client";

/**
 * Ao abrir o site, busca no servidor o estoque atual do Hub e aplica por
 * cima do catálogo (lib/catalogo/estoque-vivo.ts): o que acabou sai de venda
 * sem esperar uma nova publicação do site.
 */
import { useEffect } from "react";
import { anunciarAjustes } from "@/lib/catalogo/ajustes";
import { definirEstoqueVivo } from "@/lib/catalogo/estoque-vivo";
import { consultarEstoqueVivo } from "@/lib/servidor";

export function SincronizaEstoque() {
  useEffect(() => {
    let ativo = true;
    void consultarEstoqueVivo().then((r) => {
      if (ativo && r && definirEstoqueVivo(r)) anunciarAjustes();
    });
    return () => {
      ativo = false;
    };
  }, []);
  return null;
}
