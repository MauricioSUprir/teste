"use client";

/**
 * Botão "Atualizar catálogo agora": pede ao robô para puxar o catálogo do
 * Hub Suprir sem esperar a rodada diária. O robô atende em até ~10 minutos
 * e a publicação das quatro lojas leva mais uns 15; o quadro acompanha.
 */
import { useEffect, useState } from "react";
import { copy } from "@/lib/copy";
import {
  consultarAtualizacaoCatalogo,
  pedirAtualizacaoCatalogo,
  type EstadoAtualizacaoCatalogo,
} from "@/lib/servidor";

const t = copy.conta.admin.atualizarCatalogo;
const hora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function AtualizarCatalogo() {
  const [estado, setEstado] = useState<EstadoAtualizacaoCatalogo | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(false);

  // rodada sem fim há mais de 1h = o robô morreu no caminho; libera o botão
  const emAndamento = Boolean(
    estado?.iniciadoEm &&
      !estado?.terminadoEm &&
      Date.now() - new Date(estado.iniciadoEm).getTime() < 60 * 60_000
  );

  useEffect(() => {
    let ativo = true;
    const ler = () =>
      consultarAtualizacaoCatalogo().then((e) => {
        if (ativo && e) setEstado(e);
      });
    void ler();
    // acompanha sozinho enquanto há pedido ou rodada em andamento
    const id = setInterval(ler, 30_000);
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, []);

  async function pedir() {
    setEnviando(true);
    setErro(false);
    const e = await pedirAtualizacaoCatalogo();
    setEnviando(false);
    if (e) setEstado(e);
    else setErro(true);
  }

  let situacao: string | null = null;
  if (estado?.pendente && estado.pedidoEm) situacao = t.pedido(hora(estado.pedidoEm));
  else if (emAndamento && estado?.iniciadoEm) situacao = t.andamento(hora(estado.iniciadoEm));
  else if (estado?.terminadoEm && estado.resultado) situacao = t.resultado[estado.resultado](hora(estado.terminadoEm));

  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[8px] border border-linha bg-superficie p-4">
      <button
        type="button"
        onClick={pedir}
        disabled={enviando || estado?.pendente || emAndamento}
        className="rounded-[40px] bg-roxo px-5 py-2.5 text-[0.875rem] font-semibold text-white hover:bg-roxo-escuro disabled:opacity-60"
      >
        {enviando ? t.enviando : t.botao}
      </button>
      <p role="status" className="text-[0.8125rem] text-grafite">
        {erro ? t.erro : (situacao ?? t.dica)}
      </p>
    </div>
  );
}
