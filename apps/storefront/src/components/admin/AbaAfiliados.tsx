"use client";

/**
 * Aba Afiliados — programa independente do B2B (CNPJ é opcional). O admin
 * primeiro aprova/recusa os PEDIDOS de entrada (por e-mail); depois, para
 * quem já está aprovado, acompanha vendas e comissões e define a % de cada um.
 */
import { useEffect, useState } from "react";
import { copy } from "@/lib/copy";
import { formatarPreco } from "@/lib/preco";
import {
  decidirCadastroAfiliado,
  decidirSaqueAfiliado,
  definirComissaoAfiliado,
  excluirAfiliado,
  listarAfiliadosAdmin,
  listarCadastrosAfiliado,
  type AfiliadoAdmin,
  type CadastroAfiliado,
  type SaqueAfiliado,
  type VendaAfiliado,
} from "@/lib/servidor";

function formatarCnpj(d: string): string {
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export function AbaAfiliados() {
  const [cadastros, setCadastros] = useState<CadastroAfiliado[]>([]);
  const [carregandoCadastros, setCarregandoCadastros] = useState(true);
  const [decidindo, setDecidindo] = useState<string | null>(null);

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

  async function carregarCadastros() {
    setCarregandoCadastros(true);
    const r = await listarCadastrosAfiliado();
    setCadastros(r.cadastros);
    setCarregandoCadastros(false);
  }

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
    void carregarCadastros();
    void carregar();
  }, []);

  async function decidirPedido(email: string, status: "aprovado" | "recusado") {
    setDecidindo(email);
    const r = await decidirCadastroAfiliado(email, status);
    setDecidindo(null);
    if (r.ok) {
      setCadastros((lista) => lista.map((c) => (c.email === email ? { ...c, status } : c)));
      if (status === "aprovado") void carregar();
    }
  }

  async function excluirPedido(email: string) {
    setDecidindo(email);
    const r = await excluirAfiliado(email);
    setDecidindo(null);
    if (r.ok) {
      setCadastros((lista) => lista.filter((c) => c.email !== email));
      void carregar();
    }
  }

  async function decidirSaque(id: string, status: "pago" | "recusado") {
    setDecidindoSaque(id);
    const r = await decidirSaqueAfiliado(id, status);
    setDecidindoSaque(null);
    if (r.ok) void carregar();
  }

  async function salvarPct(id: string) {
    const pct = Number(String(pctEdicao[id] ?? "").replace(",", "."));
    if (!Number.isFinite(pct) || pct < 0 || pct > 90) return;
    setSalvando(id);
    const r = await definirComissaoAfiliado(id, pct);
    setSalvando(null);
    if (r.ok) {
      setAfiliados((lista) => lista.map((a) => (a.id === id ? { ...a, pct } : a)));
      setSalvoOk(id);
      setTimeout(() => setSalvoOk(null), 2500);
    }
  }

  const pendentes = cadastros.filter((c) => c.status === "pendente");

  return (
    <div>
      {/* pedidos de entrada no programa — precisam de decisão */}
      <div>
        <h3 className="text-[0.9375rem] font-semibold text-tinta">{copy.afiliado.admin.titulo}</h3>
        <p className="mt-1 max-w-[70ch] text-[0.875rem] text-grafite">{copy.afiliado.admin.texto}</p>
        {carregandoCadastros && <p className="mt-4 text-[0.875rem] text-cinza">Carregando…</p>}
        {!carregandoCadastros && cadastros.length === 0 && (
          <p className="mt-4 text-[0.875rem] text-cinza">{copy.afiliado.admin.vazio}</p>
        )}
        <ul className="mt-3 space-y-2">
          {(pendentes.length > 0 ? pendentes : cadastros.slice(0, 10)).map((c) => (
            <li
              key={c.email}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[10px] border border-linha p-3"
            >
              <div className="min-w-0 grow text-[0.875rem]">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-tinta">{c.nome}</span>
                  <span
                    className={`rounded-[999px] px-2 py-0.5 text-[0.75rem] font-semibold ${
                      c.status === "aprovado"
                        ? "bg-sucesso/10 text-sucesso"
                        : c.status === "recusado"
                          ? "bg-erro/10 text-erro"
                          : "bg-alerta/10 text-alerta"
                    }`}
                  >
                    {c.status === "aprovado"
                      ? copy.afiliado.admin.aprovado
                      : c.status === "recusado"
                        ? copy.afiliado.admin.recusadoRotulo
                        : copy.afiliado.admin.pendente}
                  </span>
                </p>
                <p className="mt-0.5 text-[0.8125rem] text-grafite">
                  {c.email} · {c.whatsapp} ·{" "}
                  {c.cnpj ? <span className="num">CNPJ {formatarCnpj(c.cnpj)}</span> : copy.afiliado.admin.semCnpj}
                </p>
              </div>
              <div className="flex gap-2">
                {c.status !== "aprovado" && (
                  <button
                    type="button"
                    disabled={decidindo === c.email}
                    onClick={() => void decidirPedido(c.email, "aprovado")}
                    className="h-10 rounded-[999px] bg-sucesso px-4 text-[0.8125rem] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {copy.afiliado.admin.aprovar}
                  </button>
                )}
                {c.status !== "recusado" && (
                  <button
                    type="button"
                    disabled={decidindo === c.email}
                    onClick={() => void decidirPedido(c.email, "recusado")}
                    className="h-10 rounded-[999px] border border-erro px-4 text-[0.8125rem] font-semibold text-erro hover:bg-erro/5 disabled:opacity-50"
                  >
                    {copy.afiliado.admin.recusar}
                  </button>
                )}
                <button
                  type="button"
                  disabled={decidindo === c.email}
                  onClick={() => void excluirPedido(c.email)}
                  className="h-10 rounded-[999px] border border-linha px-4 text-[0.8125rem] font-medium text-grafite hover:border-erro hover:text-erro disabled:opacity-50"
                >
                  {copy.afiliado.admin.excluir}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <hr className="my-6 border-linha" />

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
                      {s.nome} ·{" "}
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
            key={a.id}
            className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-[10px] border border-linha p-4"
          >
            <div className="min-w-0 grow">
              <p className="font-semibold text-tinta">{a.nome}</p>
              <p className="text-[0.8125rem] text-grafite">
                {a.email}
                {a.cnpj && <span className="num"> · CNPJ {formatarCnpj(a.cnpj)}</span>}
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
                value={pctEdicao[a.id] ?? String(a.pct)}
                onChange={(e) => setPctEdicao((s) => ({ ...s, [a.id]: e.target.value }))}
                className="num h-10 w-16 rounded-[6px] border border-linha px-2 text-center outline-none focus:border-violeta"
              />
              <button
                type="button"
                disabled={salvando === a.id}
                onClick={() => void salvarPct(a.id)}
                className="h-10 rounded-[999px] bg-roxo px-4 text-[0.8125rem] font-semibold text-white hover:bg-roxo-escuro disabled:opacity-50"
              >
                {salvoOk === a.id ? copy.b2b.afiliado.admin.salvo : copy.b2b.afiliado.admin.salvarPct}
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
