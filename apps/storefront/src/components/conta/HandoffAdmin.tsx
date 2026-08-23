"use client";

/**
 * Login direto do admin vindo de outra loja — link com ?entrar=direto
 * (usado pelo botão "Conectar" entre BeautyNow e Be2Beauty). Ao chegar,
 * dispara o envio do código na hora, pulando e-mail/senha: a pessoa já
 * provou quem é ao entrar na loja de origem.
 */
import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useConta } from "@/lib/conta/contexto";

export function HandoffAdmin() {
  const params = useSearchParams();
  const conta = useConta();
  const disparado = useRef(false);

  useEffect(() => {
    if (disparado.current) return;
    if (params.get("entrar") !== "direto") return;
    if (conta.usuario?.admin || conta.aguardandoCodigo) return;
    disparado.current = true;
    void conta.iniciarLoginDiretoAdmin();
  }, [params, conta]);

  return null;
}
