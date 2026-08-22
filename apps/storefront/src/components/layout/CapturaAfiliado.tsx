"use client";

/** Guarda o ?af= do link de afiliado assim que qualquer página da loja abre. */
import { useEffect } from "react";
import { capturarAfiliado } from "@/lib/afiliado";

export function CapturaAfiliado() {
  useEffect(() => {
    capturarAfiliado();
  }, []);
  return null;
}
