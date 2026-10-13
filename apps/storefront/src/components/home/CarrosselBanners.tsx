"use client";

/**
 * Carrossel de banners da home — as artes são gerenciadas na aba Banners do
 * painel admin e servidas pelo servidor em tempo real (troca sem redeploy).
 * Avança sozinho a cada 20s; pausa em aba oculta.
 *
 * Design system ("Hero carousel"): setas brancas quadradas nas laterais,
 * marcadores ABAIXO da arte (o ativo é uma barra alongada na cor primária
 * escura) e uma linha legal pequena sob o banner.
 *
 * Tamanho: em telas largas o banner para de sangrar de ponta a ponta — fica um
 * pouco menor, com um respiro nas laterais e cantos arredondados — e tem teto
 * de altura para arte quadrada ou em pé não comer a primeira dobra.
 *
 * Celular: quando o lojista sobe a arte vertical do slot "-mobile", ela entra
 * no lugar da arte larga nas telas pequenas — um banner de desktop no telefone
 * vira uma tira fininha e o texto fica ilegível.
 */
import { useEffect, useState } from "react";
import { copy } from "@/lib/copy";
import { listarBanners, type BannerDaLoja } from "@/lib/servidor";

const INTERVALO_MS = 20_000;

export function CarrosselBanners() {
  const [banners, setBanners] = useState<BannerDaLoja[]>([]);
  const [atual, setAtual] = useState(0);

  useEffect(() => {
    let ativo = true;
    void listarBanners().then((lista) => {
      if (ativo) setBanners(lista);
    });
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (banners.length < 2) return;
    const intervalo = setInterval(() => {
      if (document.visibilityState === "visible") {
        setAtual((a) => (a + 1) % banners.length);
      }
    }, INTERVALO_MS);
    return () => clearInterval(intervalo);
  }, [banners.length]);

  if (banners.length === 0) return null;

  return (
    <section aria-label="Destaques" className="bg-white">
      <div className="mx-auto w-full max-w-[1600px] md:px-4 md:pt-3">
        <div className="relative overflow-hidden md:rounded-[8px]">
          {/* transição por opacidade, e não deslize: artes de alturas diferentes
              deixavam um vão branco do tamanho da arte mais alta */}
          {banners.map((b, i) => (
            <picture
              key={b.slot}
              className={`block w-full transition-opacity duration-700 ease-in-out ${
                i === atual ? "relative opacity-100" : "pointer-events-none absolute inset-0 opacity-0"
              }`}
            >
              {b.urlMobile && <source media="(max-width: 767px)" srcSet={b.urlMobile} />}
              {/* eslint-disable-next-line @next/next/no-img-element -- artes do lojista servidas pelo servidor */}
              <img
                src={b.url}
                alt={`Banner ${i + 1}`}
                /* o teto de altura segura arte quadrada ou em pé; arte deitada
                   cabe inteira e não é cortada */
                className={`h-full w-full object-cover object-center ${
                  b.urlMobile ? "max-h-[78vh] md:max-h-[620px]" : "max-h-[60vh] md:max-h-[620px]"
                }`}
                loading={i === 0 ? "eager" : "lazy"}
              />
            </picture>
          ))}
          {banners.length > 1 && (
            <>
              <SetaBanner
                lado="esquerda"
                aoClicar={() => setAtual((a) => (a - 1 + banners.length) % banners.length)}
              />
              <SetaBanner lado="direita" aoClicar={() => setAtual((a) => (a + 1) % banners.length)} />
            </>
          )}
        </div>

        <div className="container-bn flex flex-col items-center gap-2 pt-3 md:px-0">
          {banners.length > 1 && (
            <div className="flex items-center gap-2">
              {banners.map((b, i) => (
                <button
                  key={b.slot}
                  type="button"
                  aria-label={`${copy.home.irParaBanner} ${i + 1}`}
                  aria-current={atual === i}
                  onClick={() => setAtual(i)}
                  /* área de toque de 24px; o desenho é a barrinha de dentro */
                  className="flex h-6 items-center justify-center px-0.5"
                >
                  <span
                    className={`block h-2 rounded-[40px] transition-all ${
                      atual === i ? "w-6 bg-roxo-escuro" : "w-2 bg-[#c4c4c4] hover:bg-cinza"
                    }`}
                  />
                </button>
              ))}
            </div>
          )}
          <p className="text-center text-[0.6875rem] text-cinza">{copy.home.legalBanner}</p>
        </div>
      </div>
    </section>
  );
}

function SetaBanner({ lado, aoClicar }: { lado: "esquerda" | "direita"; aoClicar: () => void }) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-label={lado === "esquerda" ? copy.home.bannerAnterior : copy.home.proximoBanner}
      className={`absolute top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[4px] border border-linha bg-white text-tinta hover:text-roxo md:flex ${
        lado === "esquerda" ? "left-3" : "right-3"
      }`}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <path
          d={lado === "esquerda" ? "M9 2 L4 7 L9 12" : "M5 2 L10 7 L5 12"}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
