"use client";

/**
 * Painel do administrador — acesso restrito à conta admin (config em
 * src/lib/conta/config.ts), com a mesma verificação em 2 etapas do login.
 * Métricas de pedidos/vendas reais chegam com a integração da API do painel.
 */
import { useEffect, useState } from "react";
import { copy } from "@/lib/copy";
import { useConta } from "@/lib/conta/contexto";
import { marcas, produtos, temEstoque } from "@/lib/catalogo/consultas";
import { formatarPreco } from "@/lib/preco";
import { FormEntrar } from "./FormEntrar";

export function PainelAdmin() {
  const conta = useConta();
  const [totalClientes, setTotalClientes] = useState(0);

  useEffect(() => {
    try {
      const bruto = localStorage.getItem("beautynow:usuarios:v1");
      setTotalClientes(bruto ? (JSON.parse(bruto) as unknown[]).length : 0);
    } catch {
      setTotalClientes(0);
    }
  }, [conta.usuario]);

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

  const esgotados = produtos.filter((p) => !temEstoque(p));

  return (
    <div className="container-bn py-12">
      <p className="text-[0.8125rem] font-semibold uppercase tracking-widest text-violeta">
        {copy.conta.admin.subtitulo}
      </p>
      <h1 className="font-titulo mt-1 text-[clamp(1.625rem,3.5vw,2.25rem)] font-semibold">
        {copy.conta.admin.titulo}
      </h1>

      {/* visão geral */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <CartaoNumero valor={produtos.length} rotulo={copy.conta.admin.produtos} />
        <CartaoNumero valor={marcas.length} rotulo={copy.conta.admin.marcas} />
        <CartaoNumero valor={esgotados.length} rotulo={copy.conta.admin.esgotados} alerta={esgotados.length > 0} />
      </div>

      {/* catálogo */}
      <section className="mt-8">
        <h2 className="font-titulo text-[1.25rem] font-semibold">{copy.conta.admin.catalogo}</h2>
        <div className="mt-3 overflow-x-auto rounded-[10px] border border-linha">
          <table className="w-full min-w-[560px] text-[0.875rem]">
            <thead>
              <tr className="bg-superficie text-left text-[0.75rem] uppercase tracking-wide text-cinza">
                <th className="px-4 py-2.5 font-semibold">Produto</th>
                <th className="px-4 py-2.5 font-semibold">SKU</th>
                <th className="px-4 py-2.5 text-right font-semibold">Preço</th>
                <th className="px-4 py-2.5 text-right font-semibold">Estoque</th>
              </tr>
            </thead>
            <tbody>
              {produtos.flatMap((p) =>
                p.variantes.map((v) => (
                  <tr key={v.sku} className="border-t border-linha">
                    <td className="px-4 py-2.5 text-tinta">
                      {p.titulo}
                      {p.variantes.length > 1 && (
                        <span className="text-cinza"> · {v.tituloVariacao}</span>
                      )}
                    </td>
                    <td className="num px-4 py-2.5 text-grafite">{v.sku}</td>
                    <td className="num px-4 py-2.5 text-right">{formatarPreco(v.precoPor)}</td>
                    <td className={`num px-4 py-2.5 text-right font-medium ${v.estoque === 0 ? "text-erro" : v.estoque <= 5 ? "text-alerta" : "text-sucesso"}`}>
                      {v.estoque}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* pedidos e clientes */}
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <section className="rounded-[16px] border border-linha p-5">
          <h2 className="font-titulo text-[1.125rem] font-semibold">{copy.conta.admin.pedidos}</h2>
          <p className="mt-2 text-[0.875rem] leading-relaxed text-grafite">
            {copy.conta.admin.pedidosVazio}
          </p>
        </section>
        <section className="rounded-[16px] border border-linha p-5">
          <h2 className="font-titulo text-[1.125rem] font-semibold">{copy.conta.admin.clientes}</h2>
          <p className="mt-2 text-[0.875rem] text-grafite">
            {copy.conta.admin.clientesTexto(totalClientes)}
          </p>
        </section>
      </div>
    </div>
  );
}

function CartaoNumero({ valor, rotulo, alerta = false }: { valor: number; rotulo: string; alerta?: boolean }) {
  return (
    <div className="rounded-[16px] border border-linha bg-white p-5">
      <p className={`num text-[2rem] font-bold leading-none ${alerta ? "text-alerta" : "text-tinta"}`}>
        {valor}
      </p>
      <p className="mt-1 text-[0.875rem] text-grafite">{rotulo}</p>
    </div>
  );
}
