"use client";

import { useEffect, useRef, useState } from "react";

type Mensagem = { role: "user" | "assistant"; content: string };

const SUGESTOES = [
  "Monte um plano de estudos para esta semana com base no meu cronograma e nas minhas tarefas.",
  "O que devo priorizar hoje?",
  "Crie um quiz de 5 questões sobre o tópico que estou estudando.",
  "Atrasei meus estudos — replaneje minha semana.",
];

export function ChatAssistente({ ativo }: { ativo: boolean }) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, carregando]);

  const enviar = async (conteudo: string) => {
    const msg = conteudo.trim();
    if (!msg || carregando) return;
    setErro(null);
    const novas: Mensagem[] = [...mensagens, { role: "user", content: msg }];
    setMensagens(novas);
    setTexto("");
    setCarregando(true);

    try {
      const res = await fetch("/api/assistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: novas }),
      });
      const data = await res.json();
      if (data.error) {
        setErro(data.error);
      } else {
        setMensagens([...novas, { role: "assistant", content: data.reply }]);
      }
    } catch {
      setErro("Não consegui falar com o servidor. Ele está rodando?");
    } finally {
      setCarregando(false);
    }
  };

  if (!ativo) {
    return (
      <div className="cartao">
        <h2>Assistente desativado</h2>
        <p style={{ marginBottom: 8 }}>
          Para ativar, crie uma chave da API do Claude e adicione ao arquivo{" "}
          <code>.env</code>:
        </p>
        <ol style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
          <li>
            Acesse{" "}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--acento)", fontWeight: 700 }}
            >
              console.anthropic.com
            </a>{" "}
            e crie uma chave.
          </li>
          <li>
            Copie <code>.env.example</code> para <code>.env</code> e preencha{" "}
            <code>ANTHROPIC_API_KEY</code>.
          </li>
          <li>Reinicie o servidor (<code>npm run dev</code>).</li>
        </ol>
      </div>
    );
  }

  return (
    <div className="cartao pilha">
      <div className="chat-janela">
        {mensagens.length === 0 && (
          <div className="pilha">
            <p className="texto-suave">Comece com uma das sugestões, ou pergunte qualquer coisa:</p>
            <div className="linha-flex">
              {SUGESTOES.map((s) => (
                <button key={s} onClick={() => enviar(s)} style={{ fontSize: "0.85rem" }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {mensagens.map((m, i) => (
          <div key={i} className={`balao ${m.role === "user" ? "balao-usuario" : "balao-ia"}`}>
            {m.content}
          </div>
        ))}
        {carregando && <div className="balao balao-ia texto-suave">pensando…</div>}
        {erro && (
          <div className="balao balao-ia" style={{ color: "var(--perigo)" }}>
            {erro}
          </div>
        )}
        <div ref={fimRef} />
      </div>

      <form
        className="linha-flex"
        onSubmit={(e) => {
          e.preventDefault();
          enviar(texto);
        }}
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Pergunte ao seu tutor…"
          style={{ flex: 1 }}
          disabled={carregando}
        />
        <button type="submit" className="btn-principal" disabled={carregando || !texto.trim()}>
          Enviar
        </button>
      </form>
    </div>
  );
}
