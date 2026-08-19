"use client";

/**
 * Painel do administrador — acesso restrito à conta admin (config em
 * src/lib/conta/config.ts), com verificação em 2 etapas.
 *
 * Abas: Visão geral (KPIs + gráficos) · Pedidos · Catálogo · Clientes ·
 * Configurações. Os dados de pedidos/clientes exibidos são os registrados
 * neste navegador (demonstração); com o servidor no ar, a mesma tela passa
 * a mostrar os dados reais centralizados.
 */
import { useEffect, useState } from "react";
import { copy } from "@/lib/copy";
import { useConta } from "@/lib/conta/contexto";
import { atualizarStatus, lerPedidos, type Pedido, type StatusPedido } from "@/lib/pedidos";
import { AbaVisaoGeral } from "@/components/admin/AbaVisaoGeral";
import { AbaPedidos } from "@/components/admin/AbaPedidos";
import { AbaCatalogo } from "@/components/admin/AbaCatalogo";
import { AbaClientes, type ClienteResumo } from "@/components/admin/AbaClientes";
import { AbaConfiguracoes } from "@/components/admin/AbaConfiguracoes";
import { FormEntrar } from "./FormEntrar";

type Aba = "visao" | "pedidos" | "catalogo" | "clientes" | "config";

const abas: { id: Aba; rotulo: string }[] = [
  { id: "visao", rotulo: "Visão geral" },
  { id: "pedidos", rotulo: "Pedidos" },
  { id: "catalogo", rotulo: "Catálogo" },
  { id: "clientes", rotulo: "Clientes" },
  { id: "config", rotulo: "Configurações" },
];

export function PainelAdmin() {
  const conta = useConta();
  const [aba, setAba] = useState<Aba>("visao");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [clientes, setClientes] = useState<ClienteResumo[]>([]);

  useEffect(() => {
    if (!conta.usuario?.admin) return;
    setPedidos(lerPedidos());
    try {
      const bruto = localStorage.getItem("beautynow:usuarios:v1");
      const lista = bruto ? (JSON.parse(bruto) as ClienteResumo[]) : [];
      setClientes(lista.map(({ nome, email, viaGoogle }) => ({ nome, email, viaGoogle })));
    } catch {
      setClientes([]);
    }
  }, [conta.usuario]);

  function mudarStatus(numero: string, status: StatusPedido) {
    atualizarStatus(numero, status);
    setPedidos(lerPedidos());
  }

  if (!conta.usuario?.admin) {
    return (
      <div className="container-bn max-w-md py-12">
        <h1 className="font-titulo text-[clamp(1.625rem,3.5vw,2.25rem)] font-semibold">
          {copy.conta.admin.titulo}
        </h1>
        <p className="mt-2 text-[0.9375rem] text-grafite">{copy.conta.admin.acessoNegado}</p>
        <div className="mt-6 rounded-[16px] border border-linha bg-white p-6">
          <FormEntrar destino="/admin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container-bn py-10">
      <p className="text-[0.8125rem] font-semibold uppercase tracking-widest text-violeta">
        {copy.conta.admin.subtitulo}
      </p>
      <h1 className="font-titulo mt-1 text-[clamp(1.625rem,3.5vw,2.25rem)] font-semibold">
        {copy.conta.admin.titulo}
      </h1>

      {/* abas */}
      <div
        role="tablist"
        aria-label="Seções do painel"
        className="mt-5 flex gap-1 overflow-x-auto border-b border-linha scroll-sem-barra"
      >
        {abas.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={aba === a.id}
            onClick={() => setAba(a.id)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-[0.875rem] font-medium transition-colors ${
              aba === a.id
                ? "border-roxo text-roxo"
                : "border-transparent text-grafite hover:text-tinta"
            }`}
          >
            {a.rotulo}
            {a.id === "pedidos" && pedidos.length > 0 && (
              <span className="num ml-1.5 rounded-[999px] bg-roxo-claro px-1.5 py-0.5 text-[0.6875rem] font-semibold text-roxo">
                {pedidos.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="pt-6">
        {aba === "visao" && <AbaVisaoGeral pedidos={pedidos} />}
        {aba === "pedidos" && <AbaPedidos pedidos={pedidos} aoMudarStatus={mudarStatus} />}
        {aba === "catalogo" && <AbaCatalogo />}
        {aba === "clientes" && <AbaClientes clientes={clientes} pedidos={pedidos} />}
        {aba === "config" && <AbaConfiguracoes />}
      </div>
    </div>
  );
}
