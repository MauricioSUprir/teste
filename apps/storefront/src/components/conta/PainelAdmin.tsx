"use client";

/**
 * Painel do administrador — acesso restrito à conta admin (config em
 * src/lib/conta/config.ts), com verificação em 2 etapas.
 *
 * Os pedidos exibidos são os registrados neste navegador (demonstração).
 * Com o servidor no ar, o painel passa a listar os pedidos reais gravados
 * no Hub Suprir — mesma tela, outra fonte de dados.
 */
import { useEffect, useMemo, useState } from "react";
import { copy } from "@/lib/copy";
import { useConta } from "@/lib/conta/contexto";
import { marcas, obterMarca, produtos, temEstoque } from "@/lib/catalogo/consultas";
import { atualizarStatus, lerPedidos, type Pedido, type StatusPedido } from "@/lib/pedidos";
import { formatarPreco } from "@/lib/preco";
import { FormEntrar } from "./FormEntrar";

interface ClienteResumo {
  nome: string;
  email: string;
  viaGoogle?: boolean;
}

const rotuloStatus: Record<StatusPedido, string> = {
  aguardando_pagamento: "Aguardando pagamento",
  pago: "Pago",
  cancelado: "Cancelado",
};

const corStatus: Record<StatusPedido, string> = {
  aguardando_pagamento: "bg-violeta-claro text-violeta",
  pago: "bg-[#E7F5EE] text-sucesso",
  cancelado: "bg-roxo-claro text-erro",
};

export function PainelAdmin() {
  const conta = useConta();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [clientes, setClientes] = useState<ClienteResumo[]>([]);
  const [buscaCatalogo, setBuscaCatalogo] = useState("");
  const [soBaixoEstoque, setSoBaixoEstoque] = useState(false);
  const [linhasVisiveis, setLinhasVisiveis] = useState(30);

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

  const metricas = useMemo(() => {
    const validos = pedidos.filter((p) => p.status !== "cancelado");
    const receita = validos.reduce((acc, p) => acc + p.totalCentavos, 0);
    return {
      qtdPedidos: validos.length,
      receita,
      ticketMedio: validos.length ? Math.round(receita / validos.length) : 0,
      pctPix: validos.length
        ? Math.round((validos.filter((p) => p.meio === "pix").length / validos.length) * 100)
        : 0,
    };
  }, [pedidos]);

  const linhasCatalogo = useMemo(() => {
    const termo = buscaCatalogo.trim().toLowerCase();
    return produtos
      .flatMap((p) =>
        p.variantes.map((v) => ({
          produto: p,
          variante: v,
          marca: obterMarca(p.marca)?.nome ?? p.marca,
        }))
      )
      .filter((l) => {
        if (soBaixoEstoque && l.variante.estoque > 5) return false;
        if (!termo) return true;
        return (
          l.produto.titulo.toLowerCase().includes(termo) ||
          l.variante.sku.toLowerCase().includes(termo) ||
          l.marca.toLowerCase().includes(termo)
        );
      });
  }, [buscaCatalogo, soBaixoEstoque]);

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

  const esgotados = produtos.filter((p) => !temEstoque(p)).length;
  const baixoEstoque = produtos.flatMap((p) => p.variantes).filter((v) => v.estoque > 0 && v.estoque <= 5).length;

  return (
    <div className="container-bn py-12">
      <p className="text-[0.8125rem] font-semibold uppercase tracking-widest text-violeta">
        {copy.conta.admin.subtitulo}
      </p>
      <h1 className="font-titulo mt-1 text-[clamp(1.625rem,3.5vw,2.25rem)] font-semibold">
        {copy.conta.admin.titulo}
      </h1>

      {/* vendas */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CartaoNumero valor={String(metricas.qtdPedidos)} rotulo="pedidos" />
        <CartaoNumero valor={formatarPreco(metricas.receita)} rotulo="receita" />
        <CartaoNumero valor={formatarPreco(metricas.ticketMedio)} rotulo="ticket médio" />
        <CartaoNumero valor={`${metricas.pctPix}%`} rotulo="pedidos via Pix" />
      </div>

      {/* pedidos */}
      <section className="mt-8">
        <h2 className="font-titulo text-[1.25rem] font-semibold">{copy.conta.admin.pedidos}</h2>
        {pedidos.length === 0 ? (
          <p className="mt-3 rounded-[10px] bg-superficie px-5 py-6 text-[0.875rem] leading-relaxed text-grafite">
            Nenhum pedido registrado neste navegador ainda. Os pedidos aparecem aqui assim que
            alguém conclui o checkout — e, com o servidor conectado ao Hub Suprir, esta lista
            passa a mostrar os pedidos reais de todos os clientes.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-[10px] border border-linha">
            <table className="w-full min-w-[720px] text-[0.875rem]">
              <thead>
                <tr className="bg-superficie text-left text-[0.75rem] uppercase tracking-wide text-cinza">
                  <th className="px-4 py-2.5 font-semibold">Pedido</th>
                  <th className="px-4 py-2.5 font-semibold">Data</th>
                  <th className="px-4 py-2.5 font-semibold">Cliente</th>
                  <th className="px-4 py-2.5 font-semibold">Itens</th>
                  <th className="px-4 py-2.5 font-semibold">Pagamento</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p) => (
                  <tr key={p.numero} className="border-t border-linha align-top">
                    <td className="num px-4 py-3 font-semibold text-tinta">{p.numero}</td>
                    <td className="num px-4 py-3 text-grafite">
                      {new Date(p.data).toLocaleDateString("pt-BR")}{" "}
                      <span className="text-cinza">
                        {new Date(p.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block text-tinta">{p.clienteNome}</span>
                      <span className="block text-[0.75rem] text-cinza">{p.clienteEmail}</span>
                    </td>
                    <td className="px-4 py-3 text-grafite">
                      {p.itens.map((i) => (
                        <span key={i.sku} className="block">
                          {i.quantidade}× {i.titulo}
                        </span>
                      ))}
                    </td>
                    <td className="px-4 py-3 capitalize text-grafite">
                      {p.meio === "pix" ? "Pix" : p.meio === "cartao" ? "Cartão" : "Boleto"}
                    </td>
                    <td className="num px-4 py-3 text-right font-semibold">{formatarPreco(p.totalCentavos)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-[999px] px-2.5 py-1 text-[0.6875rem] font-semibold ${corStatus[p.status]}`}>
                        {rotuloStatus[p.status]}
                      </span>
                      {p.status === "aguardando_pagamento" && (
                        <span className="mt-1.5 flex gap-2 text-[0.75rem]">
                          <button type="button" onClick={() => mudarStatus(p.numero, "pago")} className="text-sucesso underline">
                            Marcar pago
                          </button>
                          <button type="button" onClick={() => mudarStatus(p.numero, "cancelado")} className="text-erro underline">
                            Cancelar
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* catálogo */}
      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-titulo text-[1.25rem] font-semibold">{copy.conta.admin.catalogo}</h2>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-[0.8125rem] text-grafite">
              <input
                type="checkbox"
                checked={soBaixoEstoque}
                onChange={(e) => setSoBaixoEstoque(e.target.checked)}
                className="h-4 w-4 accent-[#4A2882]"
              />
              Só estoque baixo/esgotado
            </label>
            <input
              type="search"
              value={buscaCatalogo}
              onChange={(e) => {
                setBuscaCatalogo(e.target.value);
                setLinhasVisiveis(30);
              }}
              placeholder="Buscar por nome, SKU ou marca"
              aria-label="Buscar no catálogo"
              className="h-10 w-64 rounded-[6px] border border-linha bg-white px-3 text-[0.875rem] outline-none focus:border-violeta"
            />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 sm:max-w-md">
          <CartaoNumero valor={String(produtos.length)} rotulo={copy.conta.admin.produtos} compacto />
          <CartaoNumero valor={String(esgotados)} rotulo={copy.conta.admin.esgotados} alerta={esgotados > 0} compacto />
          <CartaoNumero valor={String(baixoEstoque)} rotulo="estoque baixo" alerta={baixoEstoque > 0} compacto />
        </div>
        <div className="mt-3 overflow-x-auto rounded-[10px] border border-linha">
          <table className="w-full min-w-[640px] text-[0.875rem]">
            <thead>
              <tr className="bg-superficie text-left text-[0.75rem] uppercase tracking-wide text-cinza">
                <th className="px-4 py-2.5 font-semibold">Produto</th>
                <th className="px-4 py-2.5 font-semibold">Marca</th>
                <th className="px-4 py-2.5 font-semibold">SKU</th>
                <th className="px-4 py-2.5 text-right font-semibold">Preço</th>
                <th className="px-4 py-2.5 text-right font-semibold">Estoque</th>
              </tr>
            </thead>
            <tbody>
              {linhasCatalogo.slice(0, linhasVisiveis).map((l) => (
                <tr key={l.variante.sku} className="border-t border-linha">
                  <td className="px-4 py-2.5 text-tinta">
                    {l.produto.titulo}
                    {l.produto.variantes.length > 1 && (
                      <span className="text-cinza"> · {l.variante.tituloVariacao}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-grafite">{l.marca}</td>
                  <td className="num px-4 py-2.5 text-grafite">{l.variante.sku}</td>
                  <td className="num px-4 py-2.5 text-right">{formatarPreco(l.variante.precoPor)}</td>
                  <td
                    className={`num px-4 py-2.5 text-right font-medium ${
                      l.variante.estoque === 0
                        ? "text-erro"
                        : l.variante.estoque <= 5
                          ? "text-alerta"
                          : "text-sucesso"
                    }`}
                  >
                    {l.variante.estoque}
                  </td>
                </tr>
              ))}
              {linhasCatalogo.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-grafite">
                    Nenhum item encontrado com esse filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {linhasCatalogo.length > linhasVisiveis && (
          <button
            type="button"
            onClick={() => setLinhasVisiveis((n) => n + 50)}
            className="num mt-3 rounded-[999px] border border-linha px-5 py-2 text-[0.875rem] font-medium text-grafite hover:bg-superficie"
          >
            Mostrar mais ({linhasCatalogo.length - linhasVisiveis} restantes)
          </button>
        )}
      </section>

      {/* clientes */}
      <section className="mt-8">
        <h2 className="font-titulo text-[1.25rem] font-semibold">{copy.conta.admin.clientes}</h2>
        {clientes.length === 0 ? (
          <p className="mt-3 rounded-[10px] bg-superficie px-5 py-6 text-[0.875rem] text-grafite">
            Nenhuma conta criada neste navegador ainda.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-[10px] border border-linha">
            <table className="w-full min-w-[480px] text-[0.875rem]">
              <thead>
                <tr className="bg-superficie text-left text-[0.75rem] uppercase tracking-wide text-cinza">
                  <th className="px-4 py-2.5 font-semibold">Nome</th>
                  <th className="px-4 py-2.5 font-semibold">E-mail</th>
                  <th className="px-4 py-2.5 font-semibold">Origem</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => (
                  <tr key={c.email} className="border-t border-linha">
                    <td className="px-4 py-2.5 text-tinta">{c.nome}</td>
                    <td className="px-4 py-2.5 text-grafite">{c.email}</td>
                    <td className="px-4 py-2.5 text-grafite">{c.viaGoogle ? "Google" : "E-mail e senha"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function CartaoNumero({
  valor,
  rotulo,
  alerta = false,
  compacto = false,
}: {
  valor: string;
  rotulo: string;
  alerta?: boolean;
  compacto?: boolean;
}) {
  return (
    <div className={`rounded-[16px] border border-linha bg-white ${compacto ? "p-3" : "p-5"}`}>
      <p className={`num font-bold leading-none ${compacto ? "text-[1.25rem]" : "text-[1.5rem]"} ${alerta ? "text-alerta" : "text-tinta"}`}>
        {valor}
      </p>
      <p className="mt-1 text-[0.8125rem] text-grafite">{rotulo}</p>
    </div>
  );
}
