"use client";

/**
 * Google Analytics 4 / Google Tag Manager (lib/google.ts): nada carrega
 * antes da escolha no aviso de cookies; quando a pessoa muda a escolha, o
 * consentimento do Google acompanha.
 */
import { useEffect } from "react";
import { aplicarConsentimentoGoogle, googleConfigurado } from "@/lib/google";
import { EVENTO_CONSENTIMENTO, lerConsentimento } from "@/lib/rastreio";

export function Analytics() {
  useEffect(() => {
    if (!googleConfigurado()) return;
    const aplicar = () => aplicarConsentimentoGoogle(lerConsentimento());
    aplicar();
    window.addEventListener(EVENTO_CONSENTIMENTO, aplicar);
    return () => window.removeEventListener(EVENTO_CONSENTIMENTO, aplicar);
  }, []);
  return null;
}
