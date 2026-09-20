"use client";

/**
 * Carrossel de banners da home — as artes são gerenciadas na aba Banners do
 * painel admin e servidas pelo servidor em tempo real (troca sem redeploy).
 * Avança sozinho a cada 20s; bolinhas para navegar; pausa em aba oculta.
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
        <div className="relative overflow-hidden md:rounded-[14px]">
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
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
              {banners.map((b, i) => (
                <button
                  key={b.slot}
                  type="button"
                  aria-label={`Ir para o banner ${i + 1}`}
                  aria-current={atual === i}
                  onClick={() => setAtual(i)}
                  className={`h-2.5 rounded-[999px] border border-white/70 transition-all ${
                    atual === i ? "w-6 bg-white" : "w-2.5 bg-white/40 hover:bg-white/70"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
