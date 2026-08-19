"use client";

/**
 * Botão "Entrar com o Google".
 *
 * Com GOOGLE_CLIENT_ID configurado, renderiza o botão OFICIAL do Google
 * Identity Services (aquele popup tradicional de escolher a conta).
 * Sem Client ID, mostra o botão demonstrativo com aviso — o Client ID é
 * gratuito e criado no Google Cloud Console do dono da loja.
 */
import { useEffect, useRef, useState } from "react";
import { copy } from "@/lib/copy";
import { GOOGLE_CLIENT_ID } from "@/lib/conta/config";
import { useConta } from "@/lib/conta/contexto";

interface CredencialGoogle {
  credential: string;
}

interface GoogleIdentity {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (resposta: CredencialGoogle) => void;
      }) => void;
      renderButton: (
        elemento: HTMLElement,
        opcoes: { theme: string; size: string; text: string; width: number; locale: string }
      ) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

export function BotaoGoogle() {
  const conta = useConta();
  const alvo = useRef<HTMLDivElement>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !alvo.current) return;

    function renderizar() {
      if (!window.google || !alvo.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (resposta) => {
          // após o Google confirmar a conta, a etapa do código assume a tela
          void conta.entrarComGoogleCredencial(resposta.credential).then((r) => {
            if (!r.ok) setErro(r.erro ?? "");
          });
        },
      });
      window.google.accounts.id.renderButton(alvo.current, {
        theme: "outline",
        size: "large",
        text: "signin_with",
        width: 320,
        locale: "pt-BR",
      });
    }

    if (window.google) {
      renderizar();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = renderizar;
    document.head.appendChild(script);
  }, [conta]);

  if (GOOGLE_CLIENT_ID) {
    return (
      <div>
        <div ref={alvo} className="flex justify-center" />
        {erro && (
          <p role="alert" className="mt-2 text-center text-[0.8125rem] font-medium text-erro">
            {erro}
          </p>
        )}
      </div>
    );
  }

  // fallback demonstrativo enquanto o Client ID não é configurado
  return (
    <div>
      <button
        type="button"
        onClick={() => conta.entrarComGoogle()}
        className="flex w-full items-center justify-center gap-2.5 rounded-[999px] border border-linha bg-white py-3 text-[0.9375rem] font-medium text-tinta hover:bg-superficie"
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
        {copy.conta.entrarComGoogle}
      </button>
      <p className="mt-1.5 text-center text-[0.6875rem] text-cinza">
        Demonstração — o botão oficial do Google ativa com o Client ID configurado.
      </p>
    </div>
  );
}
