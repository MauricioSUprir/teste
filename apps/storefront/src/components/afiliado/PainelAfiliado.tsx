"use client";

/**
 * Painel do afiliado — link, vendas, comissão e gráfico por mês. Aparece
 * quando o cadastro (por e-mail) está aprovado. Os dados vêm do servidor
 * (/afiliados/painel).
 */
import { useCallback, useEffect, useState } from "react";
import { copy } from "@/lib/copy";
import { useAfiliado } from "@/lib/afiliado/contexto";
import { formatarPreco } from "@/lib/preco";
import { LinksProdutos } from "./LinksProdutos";
import {
  consultarPainelAfiliado,
  gerarLinkAfiliado,
  pedirSaqueAfiliado,
  type PainelAfiliado as DadosPainel,
} from "@/lib/servidor";

/** agrega as vendas dos últimos 6 meses para o gráfico de barras */
function porMes(vendas: DadosPainel["vendas"]) {
  const meses: { rotulo: string; chave: string; qtd: number; totalCentavos: number }[] = [];
  const agora = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    meses.push({
      rotulo: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      chave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      qtd: 0,
      totalCentavos: 0,
    });
  }
  for (const v of vendas) {
    const chave = v.data.slice(0, 7);
    const mes = meses.find((m) => m.chave === chave);
    if (mes) {
      mes.qtd += 1;
      mes.totalCentavos += v.totalCentavos;
    }
  }
  return meses;
}

export function PainelAfiliado() {
  const { email, sair } = useAfiliado();
  const [dados, setDados] = useState<DadosPainel | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [falha, setFalha] = useState(false);
  const [chavePix, setChavePix] = useState("");
  const [valorSaque, setValorSaque] = useState("");
  const [pedindoSaque, setPedindoSaque] = useState(false);
  const [saqueMsg, setSaqueMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  const carregar = useCallback(async () => {
    if (!email) return;
    setCarregando(true);
    const r = await consultarPainelAfiliado(email);
    setFalha(r === null);
    if (r) setDados(r);
    setCarregando(false);
  }, [email]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (!email) return null;

  async function gerar() {
    if (!email) return;
    setGerando(true);
    const r = await gerarLinkAfiliado(email);
    setGerando(false);
    if (r.ok) void carregar();
  }

  async function copiar() {
    if (!dados?.url) return;
    try {
      await navigator.clipboard.writeText(dados.url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      /* navegador sem clipboard — o campo permite selecionar e copiar à mão */
    }
  }

  async function pedirSaque(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !dados) return;
    setSaqueMsg(null);
    const disponivel = dados.totais.disponivelCentavos;
    // campo vazio = sacar tudo; senão converte "12,34" → centavos
    const valor = valorSaque.trim()
      ? Math.round(Number(valorSaque.replace(/\./g, "").replace(",", ".")) * 100)
      : disponivel;
    if (!Number.isFinite(valor) || valor <= 0 || valor > disponivel) {
      setSaqueMsg({ ok: false, texto: "Valor inválido — confira o saldo disponível." });
      return;
    }
    setPedindoSaque(true);
    const r = await pedirSaqueAfiliado(email, chavePix.trim(), valor);
    setPedindoSaque(false);
    if (r.ok) {
      setSaqueMsg({ ok: true, texto: copy.b2b.afiliado.saqueOk });
      setValorSaque("");
      void carregar();
    } else {
      setSaqueMsg({ ok: false, texto: r.erro ?? copy.b2b.afiliado.falha });
    }
  }

  const meses = dados ? porMes(dados.vendas) : [];
  const maiorMes = Math.max(1, ...meses.map((m) => m.qtd));

  return (
    <section aria-labelledby="afiliado-titulo" className="rounded-[16px] border border-linha p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="afiliado-titulo" className="font-titulo text-[1.25rem] font-semibold text-tinta">
            {dados?.nome ? `Olá, ${dados.nome.split(" ")[0]}!` : copy.b2b.afiliado.titulo}
          </h2>
          <p className="mt-1 max-w-[70ch] text-[0.9375rem] text-grafite">{copy.b2b.afiliado.texto}</p>
        </div>
        <button
          type="button"
          onClick={sair}
          className="shrink-0 text-[0.8125rem] font-medium text-grafite underline"
        >
          {copy.afiliado.sair}
        </button>
      </div>

      {falha && (
        <p className="mt-4 text-[0.875rem] font-medium text-erro">
          {copy.b2b.afiliado.falha}{" "}
          <button type="button" onClick={() => void carregar()} className="underline">
            {copy.b2b.afiliado.atualizar}
          </button>
        </p>
      )}

      {/* link */}
      {dados && !dados.codigo && (
        <button
          type="button"
          disabled={gerando}
          onClick={() => void gerar()}
          className="mt-4 h-12 rounded-[999px] bg-roxo px-6 text-[0.9375rem] font-semibold text-white hover:bg-roxo-escuro disabled:opacity-60"
        >
          {gerando ? copy.b2b.afiliado.gerando : copy.b2b.afiliado.gerarLink}
        </button>
      )}
      {dados?.url && (
        <div className="mt-4 rounded-[10px] bg-roxo-claro p-4">
          <p className="text-[0.8125rem] font-semibold uppercase tracking-wide text-roxo-escuro">
            {copy.b2b.afiliado.seuLink}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              readOnly
              value={dados.url}
              onFocus={(e) => e.currentTarget.select()}
              aria-label={copy.b2b.afiliado.seuLink}
              className="num h-11 min-w-0 grow rounded-[6px] border border-linha bg-white px-3 text-[0.875rem] text-tinta outline-none"
            />
            <button
              type="button"
              onClick={() => void copiar()}
              className="h-11 shrink-0 rounded-[999px] bg-roxo px-5 text-[0.875rem] font-semibold text-white hover:bg-roxo-escuro"
            >
              {copiado ? copy.b2b.afiliado.copiado : copy.b2b.afiliado.copiar}
            </button>
          </div>
          <p className="mt-2 text-[0.8125rem] text-grafite">{copy.b2b.afiliado.comoUsar}</p>
          <p className="mt-1 text-[0.8125rem] font-semibold text-roxo">
            {copy.b2b.afiliado.suaComissao(dados.pct)}
          </p>
        </div>
      )}

      {/* pesquisa de produtos: um link individual por produto */}
      {dados?.codigo && <LinksProdutos codigo={dados.codigo} />}

      {/* números */}
      {dados && (
        <>
          <dl className="mt-5 grid grid-cols-3 gap-3">
            {[
              [copy.b2b.afiliado.cardVendas, String(dados.totais.vendas)],
              [copy.b2b.afiliado.cardVendido, formatarPreco(dados.totais.vendidoCentavos)],
              [copy.b2b.afiliado.cardComissao, formatarPreco(dados.totais.comissaoCentavos)],
            ].map(([rotulo, valor]) => (
              <div key={rotulo} className="rounded-[10px] bg-superficie p-3 text-center">
                <dt className="text-[0.75rem] font-medium uppercase tracking-wide text-cinza">
                  {rotulo}
                </dt>
                <dd className="num mt-1 text-[1.125rem] font-bold text-tinta">{valor}</dd>
              </div>
            ))}
          </dl>

          {/* resgate da comissão (saque via Pix) */}
          <div className="mt-6 rounded-[10px] border border-linha bg-superficie p-4">
            <h3 className="text-[0.9375rem] font-semibold text-tinta">
              💸 {copy.b2b.afiliado.saqueTitulo}
            </h3>
            <p className="mt-1 text-[0.8125rem] text-grafite">{copy.b2b.afiliado.saqueTexto}</p>
            <dl className="mt-3 grid grid-cols-3 gap-2">
              {[
                [copy.b2b.afiliado.saqueDisponivel, formatarPreco(dados.totais.disponivelCentavos), "text-sucesso"],
                [copy.b2b.afiliado.saqueAguardando, formatarPreco(dados.totais.aguardandoSaqueCentavos), "text-alerta"],
                [copy.b2b.afiliado.saqueRecebido, formatarPreco(dados.totais.sacadoCentavos), "text-tinta"],
              ].map(([rotulo, valor, cor]) => (
                <div key={rotulo} className="rounded-[6px] bg-white p-2 text-center">
                  <dt className="text-[0.6875rem] font-medium uppercase tracking-wide text-cinza">
                    {rotulo}
                  </dt>
                  <dd className={`num mt-0.5 text-[0.9375rem] font-bold ${cor}`}>{valor}</dd>
                </div>
              ))}
            </dl>
            {dados.totais.disponivelCentavos > 0 ? (
              <form onSubmit={pedirSaque} className="mt-3">
                <div className="flex flex-wrap gap-2">
                  <label className="min-w-0 grow basis-52">
                    <span className="text-[0.8125rem] font-medium text-tinta">
                      {copy.b2b.afiliado.saqueChavePix}
                    </span>
                    <input
                      type="text"
                      required
                      value={chavePix}
                      onChange={(e) => setChavePix(e.target.value)}
                      placeholder="CPF, e-mail, celular ou aleatória"
                      className="mt-1 h-11 w-full rounded-[6px] border border-linha bg-white px-3 text-[0.875rem] outline-none focus:border-violeta"
                    />
                  </label>
                  <label className="basis-36">
                    <span className="text-[0.8125rem] font-medium text-tinta">
                      {copy.b2b.afiliado.saqueValor}
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={valorSaque}
                      onChange={(e) => setValorSaque(e.target.value)}
                      placeholder={(dados.totais.disponivelCentavos / 100).toFixed(2).replace(".", ",")}
                      className="num mt-1 h-11 w-full rounded-[6px] border border-linha bg-white px-3 text-[0.875rem] outline-none focus:border-violeta"
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={pedindoSaque}
                  className="mt-3 h-11 rounded-[999px] bg-roxo px-6 text-[0.875rem] font-semibold text-white hover:bg-roxo-escuro disabled:opacity-60"
                >
                  {pedindoSaque ? copy.b2b.afiliado.saquePedindo : copy.b2b.afiliado.saquePedir}
                </button>
              </form>
            ) : (
              dados.totais.aguardandoSaqueCentavos === 0 && (
                <p className="mt-3 text-[0.8125rem] text-cinza">{copy.b2b.afiliado.saqueSemSaldo}</p>
              )
            )}
            {saqueMsg && (
              <p
                role="status"
                className={`mt-2 text-[0.875rem] font-medium ${saqueMsg.ok ? "text-sucesso" : "text-erro"}`}
              >
                {saqueMsg.texto}
              </p>
            )}
            {dados.saques.length > 0 && (
              <>
                <h4 className="mt-4 text-[0.8125rem] font-semibold text-tinta">
                  {copy.b2b.afiliado.saqueHistorico}
                </h4>
                <ul className="mt-1 divide-y divide-linha">
                  {dados.saques.slice(0, 8).map((s) => (
                    <li key={s.id} className="flex items-baseline justify-between gap-4 py-1.5 text-[0.8125rem]">
                      <span className="text-grafite">
                        {new Date(s.data).toLocaleDateString("pt-BR")} ·{" "}
                        <span className="num">{formatarPreco(s.valorCentavos)}</span>
                      </span>
                      <span className="shrink-0 font-medium">
                        {s.status === "pago"
                          ? copy.b2b.afiliado.saqueStatusPago
                          : s.status === "recusado"
                            ? copy.b2b.afiliado.saqueStatusRecusado
                            : copy.b2b.afiliado.saqueStatusPendente}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* gráfico de barras — vendas por mês (últimos 6) */}
          <h3 className="mt-6 text-[0.9375rem] font-semibold text-tinta">
            {copy.b2b.afiliado.graficoTitulo}
          </h3>
          <div className="mt-2 flex h-32 items-end gap-2" role="img" aria-label={copy.b2b.afiliado.graficoTitulo}>
            {meses.map((m) => (
              <div key={m.chave} className="flex grow flex-col items-center gap-1">
                <span className="num text-[0.75rem] font-semibold text-grafite">{m.qtd}</span>
                <div
                  className="w-full rounded-t-[4px] bg-roxo"
                  style={{ height: `${Math.max(4, (m.qtd / maiorMes) * 88)}px`, opacity: m.qtd ? 1 : 0.15 }}
                />
                <span className="text-[0.6875rem] text-cinza">{m.rotulo}</span>
              </div>
            ))}
          </div>

          {/* vendas recentes */}
          <h3 className="mt-6 text-[0.9375rem] font-semibold text-tinta">
            {copy.b2b.afiliado.vendasRecentes}
          </h3>
          {dados.vendas.length === 0 ? (
            <p className="mt-2 text-[0.875rem] text-cinza">{copy.b2b.afiliado.semVendas}</p>
          ) : (
            <ul className="mt-2 divide-y divide-linha">
              {dados.vendas.slice(0, 10).map((v) => (
                <li key={v.pedido} className="flex items-baseline justify-between gap-4 py-2 text-[0.875rem]">
                  <span className="text-grafite">
                    {new Date(v.data).toLocaleDateString("pt-BR")} · Pedido{" "}
                    <span className="num">{v.pedido}</span>
                  </span>
                  <span className="num shrink-0">
                    {formatarPreco(v.totalCentavos)} →{" "}
                    <strong className="text-sucesso">{formatarPreco(v.comissaoCentavos)}</strong>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            disabled={carregando}
            onClick={() => void carregar()}
            className="mt-4 h-10 rounded-[999px] border border-linha px-4 text-[0.8125rem] font-medium text-grafite hover:border-roxo disabled:opacity-50"
          >
            {carregando ? "…" : copy.b2b.afiliado.atualizar}
          </button>
        </>
      )}
    </section>
  );
}
