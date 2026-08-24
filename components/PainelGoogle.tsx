"use client";

import { useState, useTransition } from "react";
import { desconectarGoogle } from "@/lib/actions";

type Email = { id: string; assunto: string; de: string; resumo: string; link: string };
type Arquivo = { id: string; nome: string; tipo: string; link: string; modificado: string };

export function PainelGoogle({
  configurado,
  contaEmail,
}: {
  configurado: boolean;
  contaEmail: string | null;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [emails, setEmails] = useState<Email[] | null>(null);
  const [arquivos, setArquivos] = useState<Arquivo[] | null>(null);
  const [carregando, setCarregando] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (!configurado) {
    return (
      <div className="cartao">
        <h2>Configuração necessária</h2>
        <p style={{ marginBottom: 8 }}>
          Para ativar as integrações, crie credenciais gratuitas no Google Cloud e adicione ao
          arquivo <code>.env</code>. O passo a passo completo, com telas, está em{" "}
          <code>docs/INTEGRACOES.md</code>. Em resumo:
        </p>
        <ol style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
          <li>Crie um projeto em console.cloud.google.com</li>
          <li>Ative as APIs: Classroom, Gmail e Drive</li>
          <li>Crie um "OAuth Client ID" do tipo aplicativo web</li>
          <li>
            Preencha <code>GOOGLE_CLIENT_ID</code> e <code>GOOGLE_CLIENT_SECRET</code> no{" "}
            <code>.env</code> e reinicie o servidor
          </li>
        </ol>
      </div>
    );
  }

  const chamar = async (rotulo: string, fn: () => Promise<void>) => {
    setCarregando(rotulo);
    setStatus(null);
    try {
      await fn();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Algo deu errado.");
    } finally {
      setCarregando(null);
    }
  };

  return (
    <div className="pilha">
      <div className="cartao linha-flex">
        {contaEmail ? (
          <>
            <span className="pilula pilula-acento">conectado</span>
            <span style={{ flex: 1 }}>{contaEmail}</span>
            <button
              onClick={() => {
                if (confirm("Desconectar a conta Google?")) {
                  startTransition(() => desconectarGoogle());
                }
              }}
            >
              Desconectar
            </button>
          </>
        ) : (
          <>
            <span style={{ flex: 1 }}>Nenhuma conta conectada.</span>
            <a href="/api/google/auth">
              <button className="btn-principal">Conectar conta Google</button>
            </a>
          </>
        )}
      </div>

      {contaEmail && (
        <div className="grade grade-3">
          <div className="cartao pilha">
            <h2>Classroom</h2>
            <p className="texto-suave">
              Importa as atividades dos seus cursos como tarefas (sem duplicar) e cria as
              matérias correspondentes.
            </p>
            <button
              className="btn-principal"
              disabled={carregando !== null}
              onClick={() =>
                chamar("classroom", async () => {
                  const res = await fetch("/api/google/classroom", { method: "POST" });
                  const data = await res.json();
                  if (data.error) throw new Error(data.error);
                  setStatus(
                    `Classroom: ${data.cursos} cursos verificados, ${data.importadas} novas atividades importadas para as Tarefas.`
                  );
                })
              }
            >
              {carregando === "classroom" ? "Sincronizando…" : "Sincronizar atividades"}
            </button>
          </div>

          <div className="cartao pilha">
            <h2>Gmail</h2>
            <p className="texto-suave">
              Mostra e-mails recentes de professores, do Classroom e sobre prazos.
            </p>
            <button
              disabled={carregando !== null}
              onClick={() =>
                chamar("gmail", async () => {
                  const res = await fetch("/api/google/gmail");
                  const data = await res.json();
                  if (data.error) throw new Error(data.error);
                  setEmails(data.mensagens);
                })
              }
            >
              {carregando === "gmail" ? "Buscando…" : "Ver e-mails de estudo"}
            </button>
          </div>

          <div className="cartao pilha">
            <h2>Drive</h2>
            <p className="texto-suave">Lista seus arquivos recentes — materiais, resumos, slides.</p>
            <button
              disabled={carregando !== null}
              onClick={() =>
                chamar("drive", async () => {
                  const res = await fetch("/api/google/drive");
                  const data = await res.json();
                  if (data.error) throw new Error(data.error);
                  setArquivos(data.arquivos);
                })
              }
            >
              {carregando === "drive" ? "Buscando…" : "Ver arquivos recentes"}
            </button>
          </div>
        </div>
      )}

      {status && (
        <div className="cartao" style={{ borderColor: "var(--acento)" }}>
          {status}
        </div>
      )}

      {emails && (
        <div className="cartao">
          <h2>E-mails de estudo (14 dias)</h2>
          {emails.length === 0 ? (
            <p className="texto-suave">Nenhum e-mail de estudo encontrado.</p>
          ) : (
            <ul className="lista-limpa">
              {emails.map((e) => (
                <li key={e.id} className="item-lista" style={{ alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <a href={e.link} target="_blank" rel="noreferrer" style={{ fontWeight: 700 }}>
                      {e.assunto || "(sem assunto)"}
                    </a>
                    <div className="texto-suave">{e.de}</div>
                    <div className="texto-suave">{e.resumo}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {arquivos && (
        <div className="cartao">
          <h2>Arquivos recentes do Drive</h2>
          {arquivos.length === 0 ? (
            <p className="texto-suave">Nenhum arquivo encontrado.</p>
          ) : (
            <ul className="lista-limpa">
              {arquivos.map((a) => (
                <li key={a.id} className="item-lista">
                  <a href={a.link} target="_blank" rel="noreferrer" style={{ flex: 1 }}>
                    {a.nome}
                  </a>
                  <span className="texto-suave">
                    {a.modificado ? new Date(a.modificado).toLocaleDateString("pt-BR") : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
