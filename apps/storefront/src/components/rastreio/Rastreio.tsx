"use client";

/**
 * Liga o rastreamento (se já houve aceite) e acompanha o login: cliente
 * logado vira um perfil com nome e e-mail no PostHog; ao sair, volta a ser
 * anônimo neste navegador. Mora dentro do ContaProvider.
 */
import { useEffect, useRef } from "react";
import { useConta } from "@/lib/conta/contexto";
import { esquecerCliente, identificarCliente, iniciarRastreio } from "@/lib/rastreio";

export function Rastreio() {
  const conta = useConta();
  const anterior = useRef<string | null>(null);

  useEffect(() => {
    iniciarRastreio();
  }, []);

  useEffect(() => {
    const email = conta.usuario?.email ?? null;
    if (email && email !== anterior.current) identificarCliente(email, conta.usuario?.nome);
    else if (!email && anterior.current) esquecerCliente();
    anterior.current = email;
  }, [conta.usuario]);

  return null;
}
