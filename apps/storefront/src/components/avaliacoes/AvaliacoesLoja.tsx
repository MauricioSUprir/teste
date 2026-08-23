"use client";

/**
 * Página pública de avaliações da loja: nota média, lista de depoimentos e
 * formulário para o cliente avaliar (estrelas + comentário).
 */
import { useEffect, useState } from "react";
import { copy } from "@/lib/copy";
import {
  enviarAvaliacao,
  listarAvaliacoes,
  servidorConfigurado,
  type AvaliacaoLoja,
} from "@/lib/servidor";
import { EstrelasEscolha, EstrelasExibicao } from "./Estrelas";

export function AvaliacoesLoja() {
  const [carregando, setCarregando] = useState(true);
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoLoja[]>([]);
  const [media, setMedia] = useState<number | null>(null);
  const [total, setTotal] = useState(0);

  const [nome, setNome] = useState("");
  const [nota, setNota] = useState(0);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  async function carregar() {
    const r = await listarAvaliacoes();
    setAvaliacoes(r.avaliacoes);
    setMedia(r.media);
    setTotal(r.total);
    setCarregando(false);
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    if (nota === 0) {
      setMensagem({ tipo: "erro", texto: copy.avaliacoes.escolhaEstrelas });
      return;
    }
    setEnviando(true);
    setMensagem(null);
    const r = await enviarAvaliacao({ nome: nome.trim(), nota, texto: texto.trim() });
    setEnviando(false);
    if (r.ok) {
      setMensagem({ tipo: "ok", texto: copy.avaliacoes.obrigado });
      setNome("");
      setNota(0);
      setTexto("");
      void carregar();
    } else {
      setMensagem({ tipo: "erro", texto: r.erro ?? copy.avaliacoes.falha });
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* resumo */}
      <div className="rounded-[16px] border border-linha bg-white p-6 text-center">
        {media !== null ? (
          <>
            <p className="num text-[2.5rem] font-bold leading-none text-tinta">{media.toFixed(1)}</p>
            <div className="mt-2 flex justify-center">
              <EstrelasExibicao nota={media} tamanho={24} />
            </div>
            <p className="mt-1 text-[0.875rem] text-grafite">
              {total} {total === 1 ? copy.avaliacoes.avaliacao : copy.avaliacoes.avaliacoes}
            </p>
          </>
        ) : (
          <p className="text-[0.9375rem] text-grafite">
            {carregando ? copy.avaliacoes.carregando : copy.avaliacoes.sejaPrimeira}
          </p>
        )}
      </div>

      {/* formulário */}
      <form onSubmit={enviar} className="mt-6 rounded-[16px] border border-linha bg-white p-6">
        <h2 className="font-titulo text-[1.125rem] font-semibold">{copy.avaliacoes.deixeAvaliacao}</h2>
        <div className="mt-4 space-y-4">
          <EstrelasEscolha rotulo={copy.avaliacoes.suaNota} valor={nota} aoMudar={setNota} />
          <label className="block">
            <span className="text-[0.8125rem] font-medium text-grafite">{copy.avaliacoes.seuNome}</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={80}
              className="mt-1 h-11 w-full rounded-[6px] border border-linha bg-white px-3 text-[0.9375rem] outline-none focus:border-violeta"
            />
          </label>
          <label className="block">
            <span className="text-[0.8125rem] font-medium text-grafite">{copy.avaliacoes.seuComentario}</span>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={4}
              maxLength={1000}
              className="mt-1 w-full rounded-[6px] border border-linha bg-white px-3 py-2 text-[0.9375rem] outline-none focus:border-violeta"
            />
          </label>
        </div>
        {mensagem && (
          <p
            role="alert"
            className={`mt-3 rounded-[6px] px-3 py-2 text-[0.875rem] font-medium ${
              mensagem.tipo === "ok" ? "bg-[#E7F5EE] text-sucesso" : "bg-roxo-claro text-erro"
            }`}
          >
            {mensagem.texto}
          </p>
        )}
        <button
          type="submit"
          disabled={enviando || !servidorConfigurado()}
          className="mt-4 rounded-[999px] bg-roxo px-6 py-3 text-[0.9375rem] font-semibold text-white hover:bg-roxo-escuro disabled:cursor-not-allowed disabled:bg-cinza"
        >
          {enviando ? copy.avaliacoes.enviando : copy.avaliacoes.enviar}
        </button>
      </form>

      {/* lista */}
      <div className="mt-6 space-y-3">
        {avaliacoes.map((a) => (
          <article key={a.id} className="rounded-[16px] border border-linha bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[0.9375rem] font-semibold text-tinta">{a.nome}</span>
              <EstrelasExibicao nota={a.nota} />
            </div>
            <p className="num mt-0.5 text-[0.75rem] text-cinza">
              {new Date(a.data).toLocaleDateString("pt-BR")}
              {a.pedido ? ` · ${copy.avaliacoes.compraVerificada}` : ""}
            </p>
            {a.texto && (
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-grafite">{a.texto}</p>
            )}
          </article>
        ))}
        {!carregando && avaliacoes.length === 0 && media === null && (
          <p className="py-6 text-center text-[0.9375rem] text-grafite">
            {copy.avaliacoes.nenhumaAinda}
          </p>
        )}
      </div>
    </div>
  );
}
