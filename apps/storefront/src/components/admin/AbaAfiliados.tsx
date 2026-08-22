"use client";

/**
 * Aba Afiliados — o admin vê todos os afiliados (profissionais aprovados da
 * Be2Beauty), as vendas e comissões de cada um, os totais gerais, e define a
 * comissão (%) individual. A % nova vale para as PRÓXIMAS vendas.
 */
import { useEffect, useState } from "react";
import { copy } from "@/lib/copy";
import { formatarPreco } from "@/lib/preco";
import {
  decidirSaqueAfiliado,
  definirComissaoAfiliado,
  listarAfiliadosAdmin,
  type AfiliadoAdmin,
  type SaqueAfiliado,
  type VendaAfiliado,
} from "@/lib/servidor";

function formatarCnpj(d: string): string {
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export function AbaAfiliados() {
  const [afiliados, setAfiliados] = useState<AfiliadoAdmin[]>([]);
  const [geral, setGeral] = useState({
    vendas: 0,
    vendidoCentavos: 0,
    comissaoCentavos: 0,
    saquesPendentes: 0,
    aPagarCentavos: 0,
  });
  const [ultimas, setUltimas] = useState<VendaAfiliado[]>([]);
  const [saques, setSaques] = useState<SaqueAfiliado[]>([]);
  const [decidindoSaque, setDecidindoSaque] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [falha, setFalha] = useState(false);
  const [pctEdicao, setPctEdicao] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState<string | null>(null);
  const [salvoOk, setSalvoOk] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    const r = await listarAfiliadosAdmin();
    setFalha(!r.ok);
    setAfiliados(r.afiliados);
    setGeral(r.geral);
    setUltimas(r.ultimas);
    setSaques(r.saques);
    setCarregando(false);
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function decidirSaque(id: string, status: "pago" | "recusado") {
    setDecidindoSaque(id);
    const r = await decidirSaqueAfiliado(id, status);
    setDecidindoSaque(null);
    if (r.ok) void carregar();
  }

  async function salvarPct(cnpj: string) {
    const pct = Number(String(pctEdicao[cnpj] ?? "").replace(",", "."));
    if (!Number.isFinite(pct) || pct < 0 || pct > 90) return;
    setSalvando(cnpj);
    const r = await definirComissaoAfiliado(cnpj, pct);
    setSalvando(null);
    if (r.ok) {
      setAfiliados((lista) => lista.map((a) => (a.cnpj === cnpj ? { ...a, pct } : a)));
      setSalvoOk(cnpj);
      setTimeout(() => setSalvoOk(null), 2500);
    }
  }

  return (
    <div>
      <p className="max-w-[70ch] text-[0.9375rem] text-grafite">{copy.b2b.afiliado.admin.texto}</p>

      {/* totais gerais */}
      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [copy.b2b.afiliado.admin.geralVendas, String(geral.vendas)],
          [copy.b2b.afiliado.admin.geralVendido, formatarPreco(geral.vendidoCentavos)],
          [copy.b2b.afiliado.admin.geralComissao, formatarPreco(geral.comissaoCentavos)],
          [copy.b2b.afiliado.admin.aPagar, formatarPreco(geral.aPagarCentavos)],
        ].map(([rotulo, valor]) => (
          <div key={rotulo} className="rounded-[10px] bg-superficie p-4 text-center">
            <dt className="text-[0.75rem] font-medium uppercase tracking-wide text-cinza">{rotulo}</dt>
            <dd className="num mt-1 text-[1.25rem] font-bold text-tinta">{valor}</dd>
          </div>
        ))}
      </dl>

      {/* pedidos de saque pendentes primeiro — é o que precisa de ação */}
      {saques.some((s) => s.status === "pendente") && (
        <div className="mt-6 rounded-[10px] border border-alerta/40 bg-alerta/5 p-4">
          <h3 className="text-[0.9375rem] font-semibold text-tinta">
            💸 {copy.b2b.afiliado.admin.saquesTitulo}
          </h3>
          <p className="mt-1 text-[0.8125rem] text-grafite">{copy.b2b.afiliado.admin.saquesTexto}</p>
          <ul className="mt-3 space-y-2">
            {saques
              .filter((s) => s.status === "pendente")
              .map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[6px] bg-white p-3"
                >
                  <div className="min-w-0 grow text-[0.875rem]">
                    <p className="font-semibold text-tinta">
                      {s.razao || s.nome} ·{" "}
                      <span className="num text-sucesso">{formatarPreco(s.valorCentavos)}</span>
                    </p>
                    <p className="num mt-0.5 text-[0.8125rem] text-grafite">
                      Pix: <strong>{s.chavePix}</strong> ·{" "}
                      {new Date(s.data).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={decidindoSaque === s.id}
                      onClick={() => void decidirSaque(s.id, "pago")}
                      className="h-10 rounded-[999px] bg-sucesso px-4 text-[0.8125rem] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {copy.b2b.afiliado.admin.marcarPago}
                    </button>
                    <button
                      type="button"
                      disabled={decidindoSaque === s.id}
                      onClick={() => void decidirSaque(s.id, "recusado")}
                      className="h-10 rounded-[999px] border border-erro px-4 text-[0.8125rem] font-semibold text-erro hover:bg-erro/5 disabled:opacity-50"
                    >
                      {copy.b2b.afiliado.admin.recusarSaque}
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      )}

      {carregando && <p className="mt-6 text-[0.9375rem] text-cinza">Carregando…</p>}
      {!carregando && falha && (
        <p className="mt-6 text-[0.9375rem] font-medium text-erro">
          Não foi possível falar com o servidor agora.{" "}
          <button type="button" onClick={() => void carregar()} className="underline">
            Tentar de novo
          </button>
        </p>
      )}
      {!carregando && !falha && afiliados.length === 0 && (
        <p className="mt-6 text-[0.9375rem] text-cinza">{copy.b2b.afiliado.admin.vazio}</p>
      )}

      <ul className="mt-4 space-y-3">
        {afiliados.map((a) => (
          <li
            key={a.cnpj}
            className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-[10px] border border-linha p-4"
          >
            <div className="min-w-0 grow">
              <p className="font-semibold text-tinta">{a.razao || a.nome}</p>
              <p className="num mt-0.5 text-[0.8125rem] text-grafite">
                CNPJ {formatarCnpj(a.cnpj)}
                {" · "}
                {a.codigo ? (
                  <>
                    link <span className="font-medium text-roxo">?af={a.codigo}</span>
                  </>
                ) : (
                  <span className="text-cinza">{copy.b2b.afiliado.admin.semCodigo}</span>
                )}
              </p>
              <p className="num mt-0.5 text-[0.8125rem] text-cinza">
                {a.vendas} vendas · {formatarPreco(a.vendidoCentavos)} vendido ·{" "}
                <strong className="text-sucesso">{formatarPreco(a.comissaoCentavos)}</strong> de comissão ·{" "}
                {formatarPreco(a.disponivelCentavos)} disponível p/ saque
              </p>
            </div>
            <label className="flex items-center gap-2 text-[0.875rem] text-grafite">
              {copy.b2b.afiliado.admin.colComissao}
              <input
                type="text"
                inputMode="decimal"
                value={pctEdicao[a.cnpj] ?? String(a.pct)}
                onChange={(e) => setPctEdicao((s) => ({ ...s, [a.cnpj]: e.target.value }))}
                className="num h-10 w-16 rounded-[6px] border border-linha px-2 text-center outline-none focus:border-violeta"
              />
              <button
                type="button"
                disabled={salvando === a.cnpj}
                onClick={() => void salvarPct(a.cnpj)}
                className="h-10 rounded-[999px] bg-roxo px-4 text-[0.8125rem] font-semibold text-white hover:bg-roxo-escuro disabled:opacity-50"
              >
                {salvoOk === a.cnpj ? copy.b2b.afiliado.admin.salvo : copy.b2b.afiliado.admin.salvarPct}
              </button>
            </label>
          </li>
        ))}
      </ul>

      {/* últimas vendas por link */}
      {ultimas.length > 0 && (
        <>
          <h3 className="mt-8 text-[0.9375rem] font-semibold text-tinta">
            {copy.b2b.afiliado.admin.ultimasVendas}
          </h3>
          <ul className="mt-2 divide-y divide-linha">
            {ultimas.slice(0, 15).map((v) => (
              <li key={v.pedido} className="flex items-baseline justify-between gap-4 py-2 text-[0.875rem]">
                <span className="text-grafite">
                  {new Date(v.data).toLocaleDateString("pt-BR")} · Pedido{" "}
                  <span className="num">{v.pedido}</span> · <span className="text-roxo">{v.codigo}</span>
                </span>
                <span className="num shrink-0">
                  {formatarPreco(v.totalCentavos)} · {v.pct}% ={" "}
                  <strong className="text-sucesso">{formatarPreco(v.comissaoCentavos)}</strong>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
