"use client";

import { useState, useTransition } from "react";
import { criarEventosEmLote } from "@/lib/actions";

type EventoExtraido = { title: string; date: string; type: string; notes?: string };

const ROTULO: Record<string, string> = {
  PROVA: "Prova",
  TRABALHO: "Trabalho",
  AULA: "Aula",
  EVENTO: "Evento",
};

export function ImportarImagem({ iaAtiva }: { iaAtiva: boolean }) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [extraidos, setExtraidos] = useState<EventoExtraido[] | null>(null);
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [pendente, startTransition] = useTransition();

  const enviarImagem = async (arquivo: File) => {
    setCarregando(true);
    setErro(null);
    setSucesso(null);
    setExtraidos(null);
    try {
      const fd = new FormData();
      fd.append("imagem", arquivo);
      const res = await fetch("/api/calendario/importar-imagem", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (data.error) {
        setErro(data.error);
      } else if (data.eventos.length === 0) {
        setErro("Nenhum evento com data foi encontrado na imagem.");
      } else {
        setExtraidos(data.eventos);
        setMarcados(new Set(data.eventos.map((_: unknown, i: number) => i)));
      }
    } catch {
      setErro("Não consegui enviar a imagem. Tente de novo.");
    } finally {
      setCarregando(false);
    }
  };

  const confirmar = () => {
    if (!extraidos) return;
    const escolhidos = extraidos.filter((_, i) => marcados.has(i));
    startTransition(async () => {
      const qtd = await criarEventosEmLote(escolhidos);
      setExtraidos(null);
      setSucesso(`${qtd} ${qtd === 1 ? "evento adicionado" : "eventos adicionados"} ao calendário.`);
    });
  };

  return (
    <div className="cartao pilha">
      <h2>Importar de uma imagem 📷</h2>
      {!iaAtiva ? (
        <p className="texto-suave">
          Conecte uma IA (página Integrações — o Gemini é gratuito) para enviar uma foto do
          calendário da escola e adicionar tudo automaticamente.
        </p>
      ) : (
        <>
          <p className="texto-suave">
            Foto do calendário da escola, cronograma de provas ou aviso do professor — a IA
            lê e você confirma antes de salvar.
          </p>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={carregando}
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) enviarImagem(arquivo);
              e.target.value = "";
            }}
          />
          {carregando && <p className="texto-suave">Lendo a imagem…</p>}
          {erro && <p style={{ color: "var(--perigo)" }}>{erro}</p>}
          {sucesso && <p style={{ color: "var(--acento)", fontWeight: 700 }}>{sucesso}</p>}

          {extraidos && (
            <div className="pilha">
              <strong>Encontrei {extraidos.length} {extraidos.length === 1 ? "evento" : "eventos"} — confira e confirme:</strong>
              <ul className="lista-limpa">
                {extraidos.map((ev, i) => (
                  <li key={i} className="item-lista">
                    <input
                      type="checkbox"
                      checked={marcados.has(i)}
                      id={`extraido-${i}`}
                      onChange={(e) => {
                        const novo = new Set(marcados);
                        if (e.target.checked) novo.add(i);
                        else novo.delete(i);
                        setMarcados(novo);
                      }}
                    />
                    <label htmlFor={`extraido-${i}`} style={{ flex: 1 }}>
                      <strong>{ev.title}</strong>
                      {ev.notes && <span className="texto-suave"> — {ev.notes}</span>}
                    </label>
                    <span className="pilula">{ROTULO[ev.type] ?? ev.type}</span>
                    <span className="pilula pilula-acento">
                      {new Date(ev.date + "T12:00:00").toLocaleDateString("pt-BR")}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="linha-flex">
                <button
                  className="btn-principal"
                  disabled={pendente || marcados.size === 0}
                  onClick={confirmar}
                >
                  {pendente ? "Salvando…" : `Adicionar ${marcados.size} ao calendário`}
                </button>
                <button onClick={() => setExtraidos(null)}>Cancelar</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
