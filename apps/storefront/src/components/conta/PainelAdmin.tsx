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
import { Suspense, useEffect, useMemo, useState } from "react";
import { copy } from "@/lib/copy";
import { LOJA } from "@/lib/loja";
import { useConta } from "@/lib/conta/contexto";
import { atualizarStatus, lerPedidos, type Pedido, type StatusPedido } from "@/lib/pedidos";
import { listarPedidosAdmin, servidorConfigurado, type PedidoAdmin } from "@/lib/servidor";
import { AbaVisaoGeral } from "@/components/admin/AbaVisaoGeral";
import { AbaPedidos } from "@/components/admin/AbaPedidos";
import { AbaCatalogo } from "@/components/admin/AbaCatalogo";
import { AbaClientes, type ClienteResumo } from "@/components/admin/AbaClientes";
import { AbaCupons } from "@/components/admin/AbaCupons";
import { AbaBanners } from "@/components/admin/AbaBanners";
import { AbaProfissionais } from "@/components/admin/AbaProfissionais";
import { AbaAfiliados } from "@/components/admin/AbaAfiliados";
import { AbaConfiguracoes } from "@/components/admin/AbaConfiguracoes";
import { FormEntrar } from "./FormEntrar";
import { HandoffAdmin } from "./HandoffAdmin";
import { BotaoConectarLojaIrma } from "./BotaoConectarLojaIrma";

type Aba =
  | "visao"
  | "pedidos"
  | "catalogo"
  | "banners"
  | "profissionais"
  | "afiliados"
  | "cupons"
  | "clientes"
  | "config";

const abas: { id: Aba; rotulo: string }[] = [
  { id: "visao", rotulo: "Visão geral" },
  { id: "pedidos", rotulo: "Pedidos" },
  { id: "catalogo", rotulo: "Catálogo" },
  { id: "banners", rotulo: "Banners" },
  { id: "profissionais", rotulo: "Profissionais" },
  { id: "afiliados", rotulo: "Afiliados" },
  { id: "cupons", rotulo: "Cupons" },
  { id: "clientes", rotulo: "Clientes" },
  { id: "config", rotulo: "Configurações" },
];

/** pedido do servidor no formato que os gráficos e a aba Clientes usam */
function deServidor(p: PedidoAdmin): Pedido {
  return {
    numero: p.numero,
    data: p.data,
    clienteNome: p.clienteNome,
    clienteEmail: p.clienteEmail,
    itens: p.itens,
    totalCentavos: p.totalCentavos,
    meio: p.meio === "pix" || p.meio === "boleto" ? p.meio : "cartao",
    freteNome: p.freteNome,
    cupom: p.cupom ?? undefined,
    descontoCentavos: p.descontoCentavos,
    status: p.status,
  };
}

export function PainelAdmin() {
  const conta = useConta();
  const [aba, setAba] = useState<Aba>("visao");
  // pedidos feitos NESTE navegador (demonstração / compras do próprio admin)
  const [pedidosLocais, setPedidosLocais] = useState<Pedido[]>([]);
  // todos os pedidos das lojas, guardados no servidor (24/10: a visão geral,
  // os gráficos e os clientes liam só os do navegador e ficavam zerados)
  const [pedidosServidor, setPedidosServidor] = useState<Pedido[] | null>(null);
  const [carregandoPedidos, setCarregandoPedidos] = useState(false);
  const [clientes, setClientes] = useState<ClienteResumo[]>([]);

  useEffect(() => {
    if (!conta.usuario?.admin) return;
    setPedidosLocais(lerPedidos());
    if (servidorConfigurado()) {
      setCarregandoPedidos(true);
      void listarPedidosAdmin().then((r) => {
        if (r.ok) setPedidosServidor(r.pedidos.map(deServidor));
        setCarregandoPedidos(false);
      });
    }
    try {
      const bruto = localStorage.getItem("beautynow:usuarios:v1");
      const lista = bruto ? (JSON.parse(bruto) as ClienteResumo[]) : [];
      setClientes(lista.map(({ nome, email, viaGoogle }) => ({ nome, email, viaGoogle })));
    } catch {
      setClientes([]);
    }
  }, [conta.usuario]);

  // servidor primeiro; pedido local que o servidor não conhece entra junto
  const pedidos = useMemo(() => {
    const doServidor = pedidosServidor ?? [];
    const numeros = new Set(doServidor.map((p) => p.numero));
    return [...doServidor, ...pedidosLocais.filter((p) => !numeros.has(p.numero))].sort((a, b) =>
      a.data < b.data ? 1 : -1
    );
  }, [pedidosServidor, pedidosLocais]);

  // clientes: contas deste navegador + quem comprou (pedidos do servidor)
  const todosClientes = useMemo(() => {
    const porEmail = new Map(clientes.map((c) => [c.email.toLowerCase(), c]));
    for (const p of pedidos) {
      const email = p.clienteEmail.trim().toLowerCase();
      if (email && !porEmail.has(email)) porEmail.set(email, { nome: p.clienteNome, email: p.clienteEmail });
    }
    return [...porEmail.values()];
  }, [clientes, pedidos]);

  function mudarStatus(numero: string, status: StatusPedido) {
    atualizarStatus(numero, status);
    setPedidosLocais(lerPedidos());
    setPedidosServidor((lista) => lista && lista.map((p) => (p.numero === numero ? { ...p, status } : p)));
  }

  if (!conta.usuario?.admin) {
    return (
      <div className="container-bn max-w-md py-12">
        <h1 className="font-titulo text-[clamp(1.625rem,3.5vw,2.25rem)] font-semibold">
          {copy.conta.admin.titulo}
        </h1>
        <p className="mt-2 text-[0.9375rem] text-grafite">{copy.conta.admin.acessoNegado}</p>
        <Suspense fallback={null}>
          <HandoffAdmin />
        </Suspense>
        <div className="mt-6 rounded-[8px] border border-linha bg-white p-6">
          <FormEntrar destino="/admin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container-bn py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[0.8125rem] font-semibold uppercase tracking-widest text-violeta">
            {copy.conta.admin.subtitulo}
          </p>
          <h1 className="font-titulo mt-1 text-[clamp(1.625rem,3.5vw,2.25rem)] font-semibold">
            {copy.conta.admin.titulo}
          </h1>
        </div>
        <BotaoConectarLojaIrma />
      </div>

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
              <span className="num ml-1.5 rounded-[40px] bg-roxo-claro px-1.5 py-0.5 text-[0.6875rem] font-semibold text-roxo">
                {pedidos.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="pt-6">
        {aba === "visao" && <AbaVisaoGeral pedidos={pedidos} carregando={carregandoPedidos} />}
        {aba === "pedidos" && <AbaPedidos pedidos={pedidosLocais} aoMudarStatus={mudarStatus} />}
        {aba === "catalogo" && <AbaCatalogo />}
        {aba === "banners" && <AbaBanners />}
        {aba === "profissionais" && <AbaProfissionais />}
        {aba === "afiliados" && <AbaAfiliados />}
        {aba === "cupons" && <AbaCupons />}
        {aba === "clientes" && <AbaClientes clientes={todosClientes} pedidos={pedidos} />}
        {aba === "config" && <AbaConfiguracoes />}
      </div>
    </div>
  );
}
