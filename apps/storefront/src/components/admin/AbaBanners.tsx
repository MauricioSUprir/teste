"use client";

/**
 * Aba Banners — o lojista sobe/troca/remove as artes do carrossel da home
 * direto do painel. As imagens vivem no servidor; o site atualiza na hora.
 */
import { useEffect, useState } from "react";
import {
  enviarBanner,
  excluirBanner,
  listarBanners,
  servidorConfigurado,
} from "@/lib/servidor";

const SLOTS = ["banner-1", "banner-2", "banner-3", "banner-4", "banner-5"];

export function AbaBanners() {
  const [ativos, setAtivos] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [status, setStatus] = useState<Record<string, string>>({});

  async function carregar() {
    const lista = await listarBanners();
    const mapa: Record<string, string> = {};
    for (const b of lista) mapa[b.slot] = `${b.url}?v=${Date.now()}`;
    setAtivos(mapa);
    setCarregando(false);
  }

  useEffect(() => {
    void carregar();
  }, []);

  function aoEscolher(slot: string, input: HTMLInputElement) {
    const arquivo = input.files?.[0];
    if (!arquivo) return;
    setStatus((s) => ({ ...s, [slot]: "enviando…" }));
    const leitor = new FileReader();
    leitor.onload = async () => {
      const base64 = String(leitor.result).split(",")[1] ?? "";
      const r = await enviarBanner(slot, arquivo.type || "image/png", base64);
      setStatus((s) => ({ ...s, [slot]: r.ok ? "✅ publicado!" : `❌ ${r.erro ?? "falhou"}` }));
      if (r.ok) void carregar();
    };
    leitor.readAsDataURL(arquivo);
    input.value = "";
  }

  async function remover(slot: string) {
    if (!window.confirm("Remover este banner do site?")) return;
    setStatus((s) => ({ ...s, [slot]: "removendo…" }));
    const r = await excluirBanner(slot);
    setStatus((s) => ({ ...s, [slot]: r.ok ? "removido" : "❌ falhou" }));
    if (r.ok) void carregar();
  }

  if (!servidorConfigurado()) {
    return (
      <p className="rounded-[10px] bg-superficie px-5 py-8 text-center text-[0.875rem] text-grafite">
        Os banners dependem do servidor, que não está configurado nesta versão.
      </p>
    );
  }

  return (
    <div>
      <p className="rounded-[10px] border border-violeta/30 bg-violeta-claro px-4 py-3 text-[0.8125rem] leading-relaxed text-grafite">
        As artes aparecem no topo da home, na ordem dos números, trocando sozinhas a cada
        20 segundos. <b>Formato ideal: deitado, 1600×600</b> (mínimo 1200 de largura), até 7MB.
        A troca vale na hora — sem esperar atualização do site.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {SLOTS.map((slot, i) => (
          <div key={slot} className="rounded-[16px] border border-linha bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-[0.9375rem] font-semibold text-tinta">
                Banner {i + 1}
                {i === 0 ? "" : <span className="ml-1 text-[0.75rem] font-normal text-cinza">(opcional)</span>}
              </p>
              {status[slot] && <span className="text-[0.75rem] text-grafite">{status[slot]}</span>}
            </div>
            <div className="mt-3 flex min-h-24 items-center justify-center overflow-hidden rounded-[10px] border border-dashed border-linha bg-superficie">
              {ativos[slot] ? (
                /* eslint-disable-next-line @next/next/no-img-element -- prévia da arte do lojista */
                <img src={ativos[slot]} alt={`Banner ${i + 1}`} className="max-h-40 w-full object-cover" />
              ) : (
                <span className="py-6 text-[0.8125rem] text-cinza">
                  {carregando ? "carregando…" : "vazio"}
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="cursor-pointer rounded-[999px] bg-roxo px-4 py-2 text-[0.8125rem] font-semibold text-white hover:bg-roxo-escuro">
                {ativos[slot] ? "Trocar imagem" : "Enviar imagem"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => aoEscolher(slot, e.currentTarget)}
                />
              </label>
              {ativos[slot] && (
                <button type="button" onClick={() => remover(slot)} className="text-[0.8125rem] text-erro underline">
                  Remover
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
