"use client";

/**
 * "Ver no seu espaço": o produto em 3D, em tamanho real, em cima da mesa ou do
 * chão, pela câmera do celular (realidade aumentada).
 *
 * - o modelo é montado na hora a partir da foto (ar/modelo-ar.ts) e vira um
 *   arquivo 3D (GLB) só neste navegador;
 * - quem mostra é o <model-viewer> do Google: no Android abre a câmera dentro
 *   do Chrome (WebXR); no iPhone, o Quick Look da Apple (o arquivo do iPhone é
 *   gerado pelo próprio model-viewer);
 * - tamanho travado (ar-scale="fixed"): a pinça não aumenta nem diminui;
 * - no computador o produto aparece em 3D para girar, com a dica de abrir no
 *   celular.
 * Nada disso pesa a página: as bibliotecas só baixam quando a pessoa toca no botão.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { Produto } from "@/lib/catalogo/tipos";
import { copy } from "@/lib/copy";
import { registrar } from "@/lib/rastreio";
import { FOTOS_VERSO } from "@/lib/catalogo/versos";
import { comBase } from "@/lib/caminho";

interface ElementoModelViewer extends HTMLElement {
  canActivateAR: boolean;
  activateAR: () => Promise<void>;
}

type Estado = "montando" | "pronto" | "erro";

const cm = (n: number) => `${n < 10 ? n.toFixed(1).replace(".", ",") : Math.round(n)} cm`;

function IconeCubo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.8 20 7.2v9.6L12 21.2 4 16.8V7.2Z" />
      <path d="M4 7.2 12 11.6l8-4.4M12 11.6v9.6" />
    </svg>
  );
}

function PainelAR({ produto, aoFechar }: { produto: Produto; aoFechar: () => void }) {
  const idTitulo = useId();
  const palco = useRef<HTMLDivElement>(null);
  const visor = useRef<ElementoModelViewer | null>(null);
  const botaoFechar = useRef<HTMLButtonElement>(null);
  const [estado, setEstado] = useState<Estado>("montando");
  const [podeCamera, setPodeCamera] = useState(false);
  const [medida, setMedida] = useState<{
    altura: number;
    largura: number;
    aproximado: boolean;
    base: "conteudo" | "medidas" | "aproximado";
    conta: { conteudo: number | null; medidas: number | null };
  } | null>(null);
  const [verso, setVerso] = useState<"foto" | "liso" | null>(null);
  // tela de toque sem câmera 3D: em geral navegador dentro de app (Instagram, WhatsApp)
  const [celular] = useState(() => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);

  // monta o modelo e o visor 3D (bibliotecas baixadas só agora)
  useEffect(() => {
    const foto = produto.imagens?.[0];
    if (!foto) return;
    let cancelado = false;
    let enderecoGlb: string | null = null;
    let descartar: (() => void) | null = null;
    (async () => {
      try {
        const [{ montarModeloAR }, { GLTFExporter }] = await Promise.all([
          import("./ar/modelo-ar"),
          import("three/examples/jsm/exporters/GLTFExporter.js"),
          import("@google/model-viewer"),
        ]);
        const v = produto.variantes[0];
        // a frente sai da 1ª foto de fundo branco; o verso, da foto cadastrada (se houver)
        const verso = v ? FOTOS_VERSO[v.sku] : undefined;
        const modelo = await montarModeloAR(
          produto.imagens ?? [foto],
          { medidasCm: v?.medidasCm, conteudo: v?.conteudo },
          verso ? (verso.startsWith("/") ? comBase(verso) : verso) : undefined
        );
        descartar = modelo.descartar;
        const glb = (await new GLTFExporter().parseAsync(modelo.objeto, { binary: true, maxTextureSize: 1024 })) as ArrayBuffer;
        if (cancelado || !palco.current) return;
        enderecoGlb = URL.createObjectURL(new Blob([glb], { type: "model/gltf-binary" }));
        setMedida({
          altura: modelo.alturaCm,
          largura: modelo.larguraCm,
          aproximado: modelo.aproximado,
          base: modelo.base,
          conta: modelo.estimativas,
        });
        setVerso(modelo.verso);

        const mv = document.createElement("model-viewer") as ElementoModelViewer;
        const atributos: Record<string, string> = {
          src: enderecoGlb,
          alt: copy.ar.alt(produto.titulo),
          ar: "",
          "ar-modes": "webxr quick-look",
          "ar-scale": "fixed",
          "ar-placement": "floor",
          "camera-controls": "",
          "auto-rotate": "",
          "auto-rotate-delay": "1500",
          "rotation-per-second": "24deg",
          "touch-action": "pan-y",
          "shadow-intensity": "1",
          "shadow-softness": "0.8",
          "environment-image": "neutral",
          exposure: "1.05",
          "interaction-prompt": "none",
        };
        for (const [nome, valor] of Object.entries(atributos)) mv.setAttribute(nome, valor);
        mv.style.width = "100%";
        mv.style.height = "100%";
        mv.style.setProperty("--poster-color", "transparent");
        // o botão de câmera é o nosso (texto em português, embaixo); o padrão fica escondido
        const semBotao = document.createElement("span");
        semBotao.slot = "ar-button";
        semBotao.style.display = "none";
        mv.appendChild(semBotao);
        const conferirCamera = () => setPodeCamera(Boolean(mv.canActivateAR));
        mv.addEventListener("load", () => {
          setEstado("pronto");
          conferirCamera();
          // o suporte à câmera (WebXR) é conferido em segundo plano pelo model-viewer
          window.setTimeout(conferirCamera, 600);
        });
        mv.addEventListener("error", () => setEstado("erro"));
        palco.current.appendChild(mv);
        visor.current = mv;
      } catch {
        if (!cancelado) setEstado("erro");
      }
    })();
    return () => {
      cancelado = true;
      visor.current?.remove();
      visor.current = null;
      if (enderecoGlb) URL.revokeObjectURL(enderecoGlb);
      descartar?.();
    };
  }, [produto]);

  // tela cheia: sem rolagem por baixo, Esc fecha, foco no fechar
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    botaoFechar.current?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") aoFechar();
    };
    window.addEventListener("keydown", tecla);
    return () => {
      document.body.style.overflow = antes;
      window.removeEventListener("keydown", tecla);
    };
  }, [aoFechar]);

  const abrirCamera = () => {
    registrar("ver_no_espaco", { produto: produto.slug, etapa: "camera" });
    void visor.current?.activateAR();
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby={idTitulo} data-verso={verso ?? undefined}
      data-base={medida?.base}
      data-cm-conteudo={medida?.conta.conteudo?.toFixed(1)}
      data-cm-medidas={medida?.conta.medidas?.toFixed(1)}
      className="fixed inset-0 z-[95] flex flex-col bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-linha px-4 py-3">
        <div className="min-w-0">
          <h2 id={idTitulo} className="font-titulo text-[1.125rem] font-semibold text-tinta">
            {copy.ar.titulo}
          </h2>
          <p className="truncate text-[0.8125rem] text-grafite">{produto.titulo}</p>
        </div>
        <button
          ref={botaoFechar}
          type="button"
          onClick={aoFechar}
          className="shrink-0 rounded-full border border-linha px-4 py-2 text-[0.875rem] font-semibold text-tinta hover:border-cinza"
        >
          {copy.ar.fechar}
        </button>
      </div>

      <div ref={palco} className="relative min-h-0 flex-1 bg-[#f6f5f8]">
        {estado !== "pronto" && (
          <p role="status" className="absolute inset-0 flex items-center justify-center px-6 text-center text-[0.9375rem] text-grafite">
            {estado === "erro" ? copy.ar.falhou : copy.ar.montando}
          </p>
        )}
      </div>

      <div className="border-t border-linha px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {medida && (
          <p className="text-[0.875rem] font-semibold text-tinta">
            {copy.ar.medida(cm(medida.altura), cm(medida.largura))}
          </p>
        )}
        {medida?.base === "conteudo" && produto.variantes[0]?.conteudo && (
          <p className="mt-0.5 text-[0.8125rem] text-grafite">{copy.ar.pelaConta(produto.variantes[0].conteudo, produto.variantes[0].conteudoUn ?? "ml")}</p>
        )}
        {medida?.base === "medidas" && <p className="mt-0.5 text-[0.8125rem] text-grafite">{copy.ar.pelasMedidas}</p>}
        {medida?.aproximado && <p className="mt-0.5 text-[0.8125rem] text-grafite">{copy.ar.aproximado}</p>}
        {verso === "liso" && <p className="mt-0.5 text-[0.8125rem] text-grafite">{copy.ar.versoLiso}</p>}
        {estado === "pronto" &&
          (podeCamera ? (
            <>
              <button
                type="button"
                onClick={abrirCamera}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-roxo px-5 py-3.5 text-[1rem] font-semibold text-white hover:bg-violeta"
              >
                <IconeCubo />
                {copy.ar.abrirCamera}
              </button>
              <p className="mt-2 text-[0.8125rem] text-grafite">{copy.ar.dicaCamera}</p>
            </>
          ) : (
            <p className="mt-2 text-[0.875rem] text-grafite">{celular ? copy.ar.semCameraCelular : copy.ar.semCamera}</p>
          ))}
        <p className="mt-2 text-[0.75rem] text-cinza">{copy.ar.aviso}</p>
      </div>
    </div>
  );
}

export function VerNoEspaco({ produto }: { produto: Produto }) {
  const [aberto, setAberto] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  const fechar = useCallback(() => {
    setAberto(false);
    botao.current?.focus();
  }, []);
  if (!produto.imagens?.length) return null;
  return (
    <>
      <button
        ref={botao}
        type="button"
        onClick={() => {
          registrar("ver_no_espaco", { produto: produto.slug, etapa: "abriu" });
          setAberto(true);
        }}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-roxo/40 bg-white px-4 py-2.5 text-[0.9375rem] font-semibold text-roxo hover:border-roxo hover:bg-[#f6f1fe]"
      >
        <IconeCubo />
        <span>
          {copy.ar.botao}
          <span className="ml-1 font-normal text-grafite">· {copy.ar.botaoDetalhe}</span>
        </span>
      </button>
      {aberto && <PainelAR produto={produto} aoFechar={fechar} />}
    </>
  );
}
