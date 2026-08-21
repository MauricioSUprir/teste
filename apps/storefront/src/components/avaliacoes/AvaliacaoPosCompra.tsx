"use client";

/**
 * Avaliação logo após o pagamento: nota do produto + nota da experiência
 * (estrelas) e comentário opcional. Vai para as avaliações públicas da loja.
 */
import { useState } from "react";
import Link from "next/link";
import { copy } from "@/lib/copy";
import { enviarAvaliacao, servidorConfigurado } from "@/lib/servidor";
import { EstrelasEscolha } from "./Estrelas";

export function AvaliacaoPosCompra({
  pedido,
  nomeCliente,
}: {
  pedido?: string;
  nomeCliente?: string;
}) {
  const [notaProduto, setNotaProduto] = useState(0);
  const [notaExperiencia, setNotaExperiencia] = useState(0);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState(false);
  const [erro, setErro] = useState("");

  if (!servidorConfigurado()) return null;

  if (enviada) {
    return (
      <div className="mt-8 w-full max-w-md rounded-[16px] bg-[#E7F5EE] p-6 text-center">
        <p className="text-[0.9375rem] font-medium text-sucesso">{copy.avaliacoes.obrigado}</p>
        <Link href="/avaliacoes" className="mt-2 inline-block text-[0.875rem] font-medium text-violeta underline">
          {copy.avaliacoes.titulo} →
        </Link>
      </div>
    );
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    if (notaProduto === 0 && notaExperiencia === 0) {
      setErro(copy.avaliacoes.escolhaEstrelas);
      return;
    }
    setEnviando(true);
    setErro("");
    const notas = [notaProduto, notaExperiencia].filter((n) => n > 0);
    const media = Math.round(notas.reduce((s, n) => s + n, 0) / notas.length);
    const r = await enviarAvaliacao({
      nome: nomeCliente ?? "",
      nota: media,
      notaProduto: notaProduto || undefined,
      notaExperiencia: notaExperiencia || undefined,
      texto: texto.trim(),
      pedido,
    });
    setEnviando(false);
    if (r.ok) setEnviada(true);
    else setErro(r.erro ?? copy.avaliacoes.falha);
  }

  return (
    <form onSubmit={enviar} className="mt-8 w-full max-w-md rounded-[16px] border border-linha bg-white p-6 text-left">
      <h2 className="font-titulo text-[1.125rem] font-semibold">{copy.avaliacoes.posCompraTitulo}</h2>
      <p className="mt-1 text-[0.8125rem] text-grafite">{copy.avaliacoes.posCompraTexto}</p>
      <div className="mt-4 space-y-3">
        <EstrelasEscolha rotulo={copy.avaliacoes.notaProduto} valor={notaProduto} aoMudar={setNotaProduto} />
        <EstrelasEscolha rotulo={copy.avaliacoes.notaExperiencia} valor={notaExperiencia} aoMudar={setNotaExperiencia} />
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder={copy.avaliacoes.seuComentario}
          className="w-full rounded-[6px] border border-linha bg-white px-3 py-2 text-[0.9375rem] outline-none focus:border-violeta"
        />
      </div>
      {erro && (
        <p role="alert" className="mt-2 rounded-[6px] bg-roxo-claro px-3 py-2 text-[0.8125rem] font-medium text-erro">
          {erro}
        </p>
      )}
      <button
        type="submit"
        disabled={enviando}
        className="mt-3 w-full rounded-[999px] bg-roxo py-3 text-[0.9375rem] font-semibold text-white hover:bg-roxo-escuro disabled:bg-cinza"
      >
        {enviando ? copy.avaliacoes.enviando : copy.avaliacoes.enviar}
      </button>
    </form>
  );
}
