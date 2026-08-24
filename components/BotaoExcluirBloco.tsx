"use client";

import { useTransition } from "react";
import { excluirBloco } from "@/lib/actions";

export function BotaoExcluirBloco({ id }: { id: string }) {
  const [, startTransition] = useTransition();
  return (
    <button
      className="btn-fantasma"
      title="Remover bloco"
      style={{ position: "absolute", top: 2, right: 2, color: "inherit", opacity: 0.7 }}
      onClick={() => startTransition(() => excluirBloco(id))}
    >
      ✕
    </button>
  );
}
