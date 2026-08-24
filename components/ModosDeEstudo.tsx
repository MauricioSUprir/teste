"use client";

import { useState } from "react";

type Nota = { id: string; title: string };
type Questao = {
  pergunta: string;
  alternativas: string[];
  correta: number;
  explicacao: string;
};

export function ModosDeEstudo({ iaAtiva, notas }: { iaAtiva: boolean; notas: Nota[] }) {
  const [aba, setAba] = useState<"quiz" | "feynman">("quiz");

  if (!iaAtiva) {
    return (
      <div className="cartao">
        <p className="texto-suave">
          Os modos de estudo usam IA. Conecte o Gemini (gratuito) ou o Claude na página
          Integrações para ativar.
        </p>
      </div>
    );
  }

  return (
    <div className="pilha">
      <div className="linha-flex">
        <button
          className={aba === "quiz" ? "btn-principal" : ""}
          onClick={() => setAba("quiz")}
        >
          🎯 Quiz
        </button>
        <button
          className={aba === "feynman" ? "btn-principal" : ""}
          onClick={() => setAba("feynman")}
        >
          🗣️ Técnica Feynman
        </button>
      </div>
      {aba === "quiz" ? <ModoQuiz notas={notas} /> : <ModoFeynman />}
    </div>
  );
}

// ── Quiz ─────────────────────────────────────────────────────

function ModoQuiz({ notas }: { notas: Nota[] }) {
  const [assunto, setAssunto] = useState("");
  const [notaId, setNotaId] = useState("");
  const [questoes, setQuestoes] = useState<Questao[] | null>(null);
  const [respostas, setRespostas] = useState<(number | null)[]>([]);
  const [corrigido, setCorrigido] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const gerar = async () => {
    setCarregando(true);
    setErro(null);
    setQuestoes(null);
    setCorrigido(false);
    try {
      const res = await fetch("/api/estudar/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notaId ? { notaId } : { assunto }),
      });
      const data = await res.json();
      if (data.error) setErro(data.error);
      else {
        setQuestoes(data.questoes);
        setRespostas(data.questoes.map(() => null));
      }
    } catch {
      setErro("Não consegui falar com o servidor.");
    } finally {
      setCarregando(false);
    }
  };

  const acertos =
    questoes?.filter((q, i) => respostas[i] === q.correta).length ?? 0;

  return (
    <div className="cartao pilha">
      {!questoes && (
        <>
          <h2>Quiz gerado por IA</h2>
          <div className="linha-flex">
            <input
              value={assunto}
              onChange={(e) => {
                setAssunto(e.target.value);
                setNotaId("");
              }}
              placeholder="Assunto (ex.: Leis de Newton)"
              style={{ flex: 1, minWidth: 200 }}
            />
            {notas.length > 0 && (
              <select
                value={notaId}
                onChange={(e) => {
                  setNotaId(e.target.value);
                  setAssunto("");
                }}
                aria-label="Ou usar uma nota como base"
              >
                <option value="">…ou usar uma nota minha</option>
                {notas.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                  </option>
                ))}
              </select>
            )}
            <button
              className="btn-principal"
              disabled={carregando || (!assunto.trim() && !notaId)}
              onClick={gerar}
            >
              {carregando ? "Gerando…" : "Gerar quiz"}
            </button>
          </div>
          {erro && <p style={{ color: "var(--perigo)" }}>{erro}</p>}
        </>
      )}

      {questoes && (
        <>
          {corrigido && (
            <div className="linha-flex">
              <span className="numero-grande">
                {acertos}/{questoes.length}
              </span>
              <span className="texto-suave">
                {acertos === questoes.length
                  ? "Perfeito! 🎉"
                  : acertos >= questoes.length / 2
                    ? "Bom resultado — revise as explicações abaixo."
                    : "Vale revisar esse conteúdo — veja as explicações."}
              </span>
              <button style={{ marginLeft: "auto" }} onClick={() => setQuestoes(null)}>
                Novo quiz
              </button>
            </div>
          )}
          {questoes.map((q, i) => (
            <div key={i} className="cartao pilha" style={{ gap: 8 }}>
              <strong>
                {i + 1}. {q.pergunta}
              </strong>
              {q.alternativas.map((alt, j) => {
                const escolhida = respostas[i] === j;
                const certa = corrigido && j === q.correta;
                const errada = corrigido && escolhida && j !== q.correta;
                return (
                  <label
                    key={j}
                    className="item-lista"
                    style={{
                      cursor: corrigido ? "default" : "pointer",
                      borderColor: certa
                        ? "var(--acento)"
                        : errada
                          ? "var(--perigo)"
                          : undefined,
                      background: certa ? "var(--acento-suave)" : undefined,
                    }}
                  >
                    <input
                      type="radio"
                      name={`questao-${i}`}
                      checked={escolhida}
                      disabled={corrigido}
                      onChange={() => {
                        const novas = [...respostas];
                        novas[i] = j;
                        setRespostas(novas);
                      }}
                    />
                    <span style={{ flex: 1 }}>{alt}</span>
                    {certa && <span>✓</span>}
                    {errada && <span>✗</span>}
                  </label>
                );
              })}
              {corrigido && (
                <p className="texto-suave" style={{ fontSize: "0.85rem" }}>
                  💡 {q.explicacao}
                </p>
              )}
            </div>
          ))}
          {!corrigido && (
            <button
              className="btn-principal"
              disabled={respostas.some((r) => r === null)}
              onClick={() => setCorrigido(true)}
            >
              Corrigir
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ── Feynman ──────────────────────────────────────────────────

function ModoFeynman() {
  const [topico, setTopico] = useState("");
  const [explicacao, setExplicacao] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const avaliar = async () => {
    setCarregando(true);
    setErro(null);
    setFeedback(null);
    try {
      const res = await fetch("/api/estudar/feynman", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topico, explicacao }),
      });
      const data = await res.json();
      if (data.error) setErro(data.error);
      else setFeedback(data.feedback);
    } catch {
      setErro("Não consegui falar com o servidor.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="cartao pilha">
      <h2>Técnica Feynman</h2>
      <p className="texto-suave">
        Explique um tópico como se estivesse ensinando alguém. A IA aponta o que está certo,
        o que está errado e o que faltou — é onde você descobre o que ainda não domina.
      </p>
      <input
        value={topico}
        onChange={(e) => setTopico(e.target.value)}
        placeholder="Tópico (ex.: fotossíntese)"
      />
      <textarea
        rows={7}
        value={explicacao}
        onChange={(e) => setExplicacao(e.target.value)}
        placeholder="Explique com as suas palavras, sem consultar nada…"
      />
      <button
        className="btn-principal"
        style={{ alignSelf: "flex-start" }}
        disabled={carregando || !topico.trim() || !explicacao.trim()}
        onClick={avaliar}
      >
        {carregando ? "Avaliando…" : "Avaliar minha explicação"}
      </button>
      {erro && <p style={{ color: "var(--perigo)" }}>{erro}</p>}
      {feedback && (
        <div className="balao balao-ia" style={{ maxWidth: "100%" }}>
          {feedback}
        </div>
      )}
    </div>
  );
}
