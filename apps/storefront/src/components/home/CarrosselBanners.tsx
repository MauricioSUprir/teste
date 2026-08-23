"use client";

/**
 * Carrossel de banners da home — as artes são gerenciadas na aba Banners do
 * painel admin e servidas pelo servidor em tempo real (troca sem redeploy).
 * Avança sozinho a cada 20s; bolinhas para navegar; pausa em aba oculta.
 */
import { useEffect, useState } from "react";
import { listarBanners } from "@/lib/servidor";

const INTERVALO_MS = 20_000;

export function CarrosselBanners() {
  const [banners, setBanners] = useState<{ slot: string; url: string }[]>([]);
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
    <section aria-label="Destaques" className="relative">
      <div className="relative overflow-hidden">
        <div
          className="flex transition-transform duration-700 ease-in-out"
          style={{ transform: `translateX(-${atual * 100}%)` }}
        >
          {banners.map((b, i) => (
            /* eslint-disable-next-line @next/next/no-img-element -- artes do lojista servidas pelo servidor */
            <img
              key={b.slot}
              src={b.url}
              alt={`Banner ${i + 1}`}
              className="w-full shrink-0 object-cover"
              loading={i === 0 ? "eager" : "lazy"}
            />
          ))}
        </div>
      </div>
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
    </section>
  );
}
