/**
 * Rastreamento da navegação (PostHog) — a jornada de cada cliente no site:
 * páginas e produtos vistos, buscas, sacola, checkout e pedido, com origem
 * (UTM) e gravação da sessão. Serve para o painel de estatísticas no PostHog.
 *
 * LGPD (docs/08): nada carrega antes do aceite no aviso de cookies
 * (categoria "desempenho"). Sem aceite, `registrar` não faz nada.
 * Cliente logado é identificado pelo e-mail para dar para achar a jornada
 * dele; ao sair da conta, o vínculo é desfeito neste navegador.
 *
 * A chave do projeto (phc_…) é a chave PÚBLICA de envio do PostHog — feita
 * para ficar no navegador, não dá acesso a nenhum dado. Pode trocar por
 * NEXT_PUBLIC_POSTHOG_KEY no build.
 */
import type { PostHog } from "posthog-js";

const CHAVE_PUBLICA = process.env.NEXT_PUBLIC_POSTHOG_KEY || "phc_sJDNUHqQA7kAuV386UDMUUytRvphyY354WhRuMxATF9d";
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

const CHAVE_CONSENTIMENTO = "bn:cookies:v1";
export const EVENTO_CONSENTIMENTO = "bn:cookies-mudou";

export interface Consentimento {
  desempenho: boolean;
  marketing: boolean;
  /** quando a pessoa escolheu (ISO) — registro do aceite, como pede a LGPD */
  em: string;
}

export function lerConsentimento(): Consentimento | null {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_CONSENTIMENTO) ?? "null") as Consentimento | null;
    return salvo && typeof salvo.desempenho === "boolean" ? salvo : null;
  } catch {
    return null;
  }
}

export function gravarConsentimento(desempenho: boolean, marketing: boolean) {
  const c: Consentimento = { desempenho, marketing, em: new Date().toISOString() };
  try {
    localStorage.setItem(CHAVE_CONSENTIMENTO, JSON.stringify(c));
  } catch {
    // sem armazenamento: vale só nesta visita
  }
  window.dispatchEvent(new Event(EVENTO_CONSENTIMENTO));
  if (desempenho) void ligar();
  else desligar();
}

let ph: PostHog | null = null;
let carregando: Promise<PostHog | null> | null = null;
/** eventos que chegaram antes do PostHog carregar (carrega depois do aceite, sem pesar a página) */
const fila: [string, Record<string, unknown>][] = [];
let quem: { email: string; nome?: string } | null = null;

async function ligar(): Promise<PostHog | null> {
  if (ph) {
    ph.opt_in_capturing();
    return ph;
  }
  carregando ??= import("posthog-js").then(({ default: posthog }) => {
    posthog.init(CHAVE_PUBLICA, {
      api_host: HOST,
      // cada visitante ganha um perfil (dá para seguir a jornada mesmo antes do login)
      person_profiles: "always",
      // o site troca de página sem recarregar: conta cada troca como página vista
      capture_pageview: "history_change",
      capture_pageleave: true,
      autocapture: true,
      // gravação da navegação: campos de formulário saem mascarados (senha, CPF, cartão…)
      session_recording: { maskAllInputs: true },
      loaded: (p) => {
        if (lerConsentimento()?.desempenho !== true) p.opt_out_capturing();
      },
    });
    posthog.register({ loja: document.documentElement.dataset.loja ?? "beautynow" });
    ph = posthog;
    if (quem) posthog.identify(quem.email, { email: quem.email, ...(quem.nome ? { name: quem.nome } : {}) });
    for (const [evento, props] of fila.splice(0)) posthog.capture(evento, props);
    return posthog;
  });
  return carregando;
}

function desligar() {
  fila.length = 0;
  ph?.opt_out_capturing();
}

/** liga o rastreamento se a pessoa já aceitou numa visita anterior */
export function iniciarRastreio() {
  if (lerConsentimento()?.desempenho) void ligar();
}

/** registra um evento da jornada (só com aceite) */
export function registrar(evento: string, props: Record<string, unknown> = {}) {
  if (typeof window === "undefined" || lerConsentimento()?.desempenho !== true) return;
  if (ph) ph.capture(evento, props);
  else {
    if (fila.length < 50) fila.push([evento, props]);
    void ligar();
  }
}

/** cliente entrou na conta: a jornada passa a ter nome e e-mail no painel */
export function identificarCliente(email: string, nome?: string) {
  quem = { email: email.toLowerCase(), nome };
  if (ph && lerConsentimento()?.desempenho) ph.identify(quem.email, { email: quem.email, ...(nome ? { name: nome } : {}) });
}

/** saiu da conta: desfaz o vínculo neste navegador (a próxima visita é anônima) */
export function esquecerCliente() {
  quem = null;
  ph?.reset();
}
