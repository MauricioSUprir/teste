"use client";

/**
 * Guarda o ?af= do link de afiliado assim que qualquer página da loja abre e
 * mostra uma mini-notificação dizendo por qual vendedor a pessoa entrou.
 * O usuário do vendedor vem do servidor e fica guardado para pré-preencher
 * o campo "usuário do vendedor" no pagamento.
 */
import { useEffect, useState } from "react";
import { copy } from "@/lib/copy";
import { capturarAfiliado, guardarVendedorUsuario } from "@/lib/afiliado";
import { consultarVendedor } from "@/lib/servidor";

const DURACAO_MS = 7000;

export function CapturaAfiliado() {
  const [vendedor, setVendedor] = useState<string | null>(null);

  useEffect(() => {
    const codigo = capturarAfiliado();
    if (!codigo) return;
    let ativo = true;
    consultarVendedor({ codigo }).then((r) => {
      if (!ativo || !r.ok) return;
      const nome = r.usuario ?? codigo;
      if (r.usuario) guardarVendedorUsuario(r.usuario);
      setVendedor(nome);
      setTimeout(() => {
        if (ativo) setVendedor(null);
      }, DURACAO_MS);
    });
    return () => {
      ativo = false;
    };
  }, []);

  if (!vendedor) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-[12px] bg-tinta px-4 py-3 text-[0.875rem] text-white shadow-lg"
    >
      <p className="font-medium">
        🛍️ {copy.afiliado.aviso.entrouPeloLink}{" "}
        <strong className="num">{vendedor}</strong>
      </p>
      <p className="mt-0.5 text-[0.75rem] text-white/70">{copy.afiliado.aviso.compraCreditada}</p>
    </div>
  );
}
