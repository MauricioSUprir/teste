"use client";

/**
 * Carrossel de banners da home — troca automática a cada 20s, bolinhas de
 * navegação e pausa quando a aba está em segundo plano.
 */
import { useEffect, useState } from "react";
import { comBase } from "@/lib/caminho";
import { BANNERS } from "@/lib/banners";

const INTERVALO_MS = 20_000;

export function CarrosselBanners() {
  const [atual, setAtual] = useState(0);

  useEffect(() => {
    if (BANNERS.length < 2) return;
    const intervalo = setInterval(() => {
      if (document.visibilityState === "visible") {
        setAtual((a) => (a + 1) % BANNERS.length);
      }
    }, INTERVALO_MS);
    return () => clearInterval(intervalo);
  }, []);

  if (BANNERS.length === 0) return null;

  return (
    <section aria-label="Destaques" className="relative">
      <div className="relative overflow-hidden">
        <div
          className="flex transition-transform duration-700 ease-in-out"
          style={{ transform: `translateX(-${atual * 100}%)` }}
        >
          {BANNERS.map((banner, i) => (
            /* eslint-disable-next-line @next/next/no-img-element -- artes enviadas pelo lojista */
            <img
              key={banner}
              src={comBase(banner)}
              alt={`Banner ${i + 1}`}
              className="w-full shrink-0 object-cover"
              loading={i === 0 ? "eager" : "lazy"}
            />
          ))}
        </div>
      </div>
      {BANNERS.length > 1 && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
          {BANNERS.map((banner, i) => (
            <button
              key={banner}
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
