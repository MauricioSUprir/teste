"use client";

/**
 * Ponte entre os painéis admin das lojas do grupo (mesma conta admin, mesmo
 * servidor). Clicar abre a loja irmã numa aba nova já em modo "?entrar=direto":
 * lá, o HandoffAdmin dispara o código de verificação na hora (pula e-mail e
 * senha, já que a pessoa acabou de provar quem é aqui) — só falta digitar o
 * código que chega por e-mail.
 */
import { LOJA } from "@/lib/loja";
import type { LojaId } from "@/lib/loja";

const DESTINOS: Record<
  LojaId,
  { url: string; rotulo: string; cor: string; corHover: string; marca: string }
> = {
  beautynow: {
    url: "https://www.beautynowstore.com.br/admin/?entrar=direto",
    rotulo: "Conectar no BeautyNow",
    cor: "#4A2882",
    corHover: "#381D65",
    marca: "BN",
  },
  be2beauty: {
    url: "https://www.be2beauty.com.br/admin/?entrar=direto",
    rotulo: "Conectar no Be2Beauty",
    cor: "#13315C",
    corHover: "#0B2545",
    marca: "B2",
  },
  pulse: {
    url: "https://www.beautynowstore.com.br/pulse/admin/?entrar=direto",
    rotulo: "Conectar na Pulse",
    cor: "#1C1714",
    corHover: "#000000",
    marca: "PL",
  },
  bradeco: {
    url: "https://www.beautynowstore.com.br/bradeco/admin/?entrar=direto",
    rotulo: "Conectar na Bradeco",
    cor: "#0B0B0D",
    corHover: "#ED7B2F",
    marca: "BR",
  },
};

export function BotaoConectarLojaIrma() {
  // mostra todas as lojas do grupo, menos a que está aberta
  const outras = (Object.keys(DESTINOS) as LojaId[]).filter((id) => id !== LOJA.id);
  return (
    <>
      {outras.map((id) => {
        const destino = DESTINOS[id];
        return (
          <a
            key={id}
            href={destino.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[999px] px-4 text-[0.875rem] font-semibold text-white shadow-card transition-colors"
            style={{ background: destino.cor }}
            onMouseEnter={(e) => (e.currentTarget.style.background = destino.corHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = destino.cor)}
          >
            <span
              aria-hidden="true"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] bg-white/15 text-[0.6875rem] font-extrabold tracking-tight"
            >
              {destino.marca}
            </span>
            {destino.rotulo}
          </a>
        );
      })}
    </>
  );
}
