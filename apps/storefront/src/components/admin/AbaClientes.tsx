"use client";

/** Aba Clientes — contas criadas no site, com histórico de compras por e-mail. */
import { useMemo } from "react";
import type { Pedido } from "@/lib/pedidos";
import { formatarPreco } from "@/lib/preco";

export interface ClienteResumo {
  nome: string;
  email: string;
  viaGoogle?: boolean;
}

export function AbaClientes({ clientes, pedidos }: { clientes: ClienteResumo[]; pedidos: Pedido[] }) {
  const comprasPorEmail = useMemo(() => {
    const mapa = new Map<string, { qtd: number; totalCentavos: number }>();
    for (const p of pedidos) {
      if (p.status === "cancelado") continue;
      const atual = mapa.get(p.clienteEmail) ?? { qtd: 0, totalCentavos: 0 };
      atual.qtd += 1;
      atual.totalCentavos += p.totalCentavos;
      mapa.set(p.clienteEmail, atual);
    }
    return mapa;
  }, [pedidos]);

  if (clientes.length === 0) {
    return (
      <p className="rounded-[10px] bg-superficie px-5 py-8 text-center text-[0.875rem] leading-relaxed text-grafite">
        Nenhuma conta criada neste navegador ainda. Com o servidor no ar, todas as contas de
        clientes aparecem aqui, com histórico de compras.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[10px] border border-linha">
      <table className="w-full min-w-[560px] text-[0.875rem]">
        <thead>
          <tr className="bg-superficie text-left text-[0.75rem] uppercase tracking-wide text-cinza">
            <th className="px-4 py-2.5 font-semibold">Nome</th>
            <th className="px-4 py-2.5 font-semibold">E-mail</th>
            <th className="px-4 py-2.5 font-semibold">Origem</th>
            <th className="px-4 py-2.5 text-right font-semibold">Compras</th>
            <th className="px-4 py-2.5 text-right font-semibold">Total gasto</th>
          </tr>
        </thead>
        <tbody>
          {clientes.map((c) => {
            const compras = comprasPorEmail.get(c.email);
            return (
              <tr key={c.email} className="border-t border-linha">
                <td className="px-4 py-2.5 text-tinta">{c.nome}</td>
                <td className="px-4 py-2.5 text-grafite">{c.email}</td>
                <td className="px-4 py-2.5 text-grafite">{c.viaGoogle ? "Google" : "E-mail e senha"}</td>
                <td className="num px-4 py-2.5 text-right">{compras?.qtd ?? 0}</td>
                <td className="num px-4 py-2.5 text-right font-medium">
                  {compras ? formatarPreco(compras.totalCentavos) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
