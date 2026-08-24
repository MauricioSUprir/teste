"use client";

import { useEffect, useState } from "react";

function base64ParaUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function PainelNotificacoes({
  pushConfigurado,
  vapidPublicKey,
  dispositivosInscritos,
  emailConectado,
}: {
  pushConfigurado: boolean;
  vapidPublicKey: string;
  dispositivosInscritos: number;
  emailConectado: string | null;
}) {
  const [suportado, setSuportado] = useState(true);
  const [inscritoAqui, setInscritoAqui] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setSuportado(false);
      return;
    }
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      setInscritoAqui(Boolean(sub));
    });
  }, []);

  const ativar = async () => {
    setCarregando(true);
    setStatus(null);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        setStatus(
          "Permissão negada pelo navegador. Libere as notificações para este site nas configurações do navegador."
        );
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ParaUint8Array(vapidPublicKey),
      });
      const res = await fetch("/api/notificacoes/inscrever", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error();
      setInscritoAqui(true);
      setStatus("✅ Notificações ativadas neste dispositivo!");
    } catch {
      setStatus("Não consegui ativar. Tente de novo (o site precisa estar em HTTPS ou localhost).");
    } finally {
      setCarregando(false);
    }
  };

  const desativar = async () => {
    setCarregando(true);
    setStatus(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/notificacoes/inscrever", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setInscritoAqui(false);
      setStatus("Notificações desativadas neste dispositivo.");
    } finally {
      setCarregando(false);
    }
  };

  const testar = async () => {
    setCarregando(true);
    setStatus(null);
    try {
      const res = await fetch("/api/notificacoes/enviar?sempre=1", { method: "POST" });
      const data = await res.json();
      if (data.error) setStatus(data.error);
      else
        setStatus(
          `Enviado! Push: ${data.push?.enviados ?? 0} dispositivo(s)` +
            (data.email?.ok
              ? " · E-mail: enviado ✉️"
              : ` · E-mail: ${data.email?.erro ?? "não enviado"}`)
        );
    } catch {
      setStatus("Falha ao disparar o teste.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="pilha">
      <div className="cartao pilha">
        <h2>🔔 Notificação na tela (push)</h2>
        {!pushConfigurado ? (
          <p className="texto-suave">
            Falta configurar as chaves de push. Rode <code>npx web-push generate-vapid-keys</code>{" "}
            e preencha <code>NEXT_PUBLIC_VAPID_PUBLIC_KEY</code> e{" "}
            <code>VAPID_PRIVATE_KEY</code> no .env (veja docs/NOTIFICACOES.md).
          </p>
        ) : !suportado ? (
          <p className="texto-suave">
            Este navegador não suporta notificações push. No iPhone, adicione o site à tela
            de início primeiro (Compartilhar → Adicionar à Tela de Início).
          </p>
        ) : (
          <>
            <p className="texto-suave">
              {dispositivosInscritos} dispositivo(s) recebendo ·{" "}
              {inscritoAqui ? "este dispositivo está inscrito ✅" : "este dispositivo ainda não recebe"}
            </p>
            <div className="linha-flex">
              {!inscritoAqui ? (
                <button className="btn-principal" onClick={ativar} disabled={carregando}>
                  Ativar neste dispositivo
                </button>
              ) : (
                <button onClick={desativar} disabled={carregando}>
                  Desativar neste dispositivo
                </button>
              )}
              <button onClick={testar} disabled={carregando}>
                {carregando ? "Enviando…" : "Enviar resumo agora (teste)"}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="cartao pilha">
        <h2>✉️ E-mail diário</h2>
        {emailConectado ? (
          <p className="texto-suave">
            O resumo será enviado para <strong>{emailConectado}</strong> pelo seu próprio
            Gmail. Se o e-mail de teste falhar por permissão, vá em Integrações, desconecte
            e conecte a conta de novo (o acesso de envio foi adicionado depois da primeira
            conexão).
          </p>
        ) : (
          <p className="texto-suave">
            Conecte sua conta Google na página Integrações para receber o resumo também por
            e-mail.
          </p>
        )}
      </div>

      <div className="cartao pilha">
        <h2>⏰ Quando chega?</h2>
        <p className="texto-suave">
          Publicado na internet (Vercel), o resumo dispara automaticamente todo dia às 8h
          (horário de Brasília) — e só quando há algo pendente. Rodando apenas no seu
          computador, use o botão de teste acima ou deixe o navegador aberto.
        </p>
      </div>

      {status && <div className="cartao">{status}</div>}
    </div>
  );
}
