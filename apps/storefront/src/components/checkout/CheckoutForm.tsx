"use client";

/**
 * Checkout em página única: identificação → entrega → pagamento com resumo
 * fixo (tickets 4.4–4.6). Sem menu, sem distração — docs/03 §5.
 * Pagamento é simulado na demo; na integração real entra o SDK do Mercado
 * Pago com tokenização no cliente (nenhum dado de cartão toca o servidor).
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { copy } from "@/lib/copy";
import { useCarrinho } from "@/lib/carrinho/contexto";
import { useConta } from "@/lib/conta/contexto";
import { calcularFrete, validarCep, type OpcaoFrete } from "@/lib/frete";
import {
  PEDIDO_MINIMO_CENTAVOS,
  formatarPreco,
  parcelamento,
  precoPix,
} from "@/lib/preco";
import { Logo } from "@/components/layout/Logo";
import { ImagemProduto } from "@/components/produto/ImagemProduto";
import { gravarPedido, type Pedido } from "@/lib/pedidos";
import {
  acordarServidor,
  consultarVendedor,
  criarCheckoutPro,
  criarPagamentoPix,
  enviarPedidoAoServidor,
  mercadoPagoAtivo,
} from "@/lib/servidor";
import { obterVendedorUsuario } from "@/lib/afiliado";

type MeioPagamento = "pix" | "cartao" | "boleto";

interface Endereco {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  referencia: string;
}

export function CheckoutForm() {
  const carrinho = useCarrinho();
  const conta = useConta();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState<Endereco>({
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
    referencia: "",
  });
  const [fretes, setFretes] = useState<OpcaoFrete[]>([]);
  const [freteEscolhido, setFreteEscolhido] = useState<string>("");
  const [meio, setMeio] = useState<MeioPagamento>("pix");
  // quem chegou por link de afiliado já encontra o usuário do vendedor preenchido
  const [vendedorUsuario, setVendedorUsuario] = useState("");
  useEffect(() => {
    setVendedorUsuario((atual) => atual || obterVendedorUsuario() || "");
  }, []);
  const [erro, setErro] = useState("");
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [etapa, setEtapa] = useState("");

  // acorda o servidor de pagamento assim que o checkout abre — quando a
  // pessoa terminar de preencher, ele já está de pé e a conclusão é rápida
  useEffect(() => {
    acordarServidor();
  }, []);

  // compra exige conta: nome e e-mail vêm dela (o e-mail identifica o pedido)
  useEffect(() => {
    if (!conta.usuario) return;
    setEmail(conta.usuario.email);
    setNome((atual) => atual || conta.usuario?.nome || "");
  }, [conta.usuario]);

  // sem conta: marca que a pessoa veio do checkout — depois do login/cadastro
  // a página da conta traz ela de volta para cá automaticamente
  useEffect(() => {
    try {
      if (!conta.usuario && carrinho.itens.length > 0) {
        sessionStorage.setItem("bn:voltar-checkout", "1");
      }
    } catch {
      // sem storage, a pessoa volta pelo carrinho
    }
  }, [conta.usuario, carrinho.itens.length]);

  const frete = fretes.find((f) => f.id === freteEscolhido);
  const totalProdutos = carrinho.subtotalCentavos;
  // ordem comercial: desconto de produto → cupom → Pix (sempre por último)
  const baseComCupom = totalProdutos - carrinho.descontoCentavos;
  const totalComFrete = baseComCupom + (frete?.valorCentavos ?? 0);
  const totalFinal =
    meio === "pix" ? precoPix(baseComCupom) + (frete?.valorCentavos ?? 0) : totalComFrete;
  const parcela = useMemo(() => parcelamento(totalComFrete), [totalComFrete]);

  // o frete aparece assim que o CEP fica completo — não depende da busca
  // de endereço (ViaCEP), que pode falhar ou demorar
  useEffect(() => {
    if (validarCep(endereco.cep)) {
      const opcoes = calcularFrete(endereco.cep, totalProdutos);
      setFretes(opcoes);
      setFreteEscolhido((atual) =>
        opcoes.some((o) => o.id === atual) ? atual : (opcoes[0]?.id ?? "")
      );
    } else {
      setFretes([]);
      setFreteEscolhido("");
    }
  }, [endereco.cep, totalProdutos]);

  async function aoSairDoCep() {
    const cepLimpo = endereco.cep.replace(/\D/g, "");
    if (cepLimpo.length !== 8) return;
    setBuscandoCep(true);
    try {
      // Autopreenchimento via ViaCEP — ticket 4.5
      const resposta = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const dados = await resposta.json();
      if (!dados.erro) {
        setEndereco((e) => ({
          ...e,
          logradouro: dados.logradouro || e.logradouro,
          bairro: dados.bairro || e.bairro,
          cidade: dados.localidade || e.cidade,
          uf: dados.uf || e.uf,
        }));
      }
    } catch {
      // sem rede, preenchimento manual continua funcionando
    } finally {
      setBuscandoCep(false);
    }
  }

  async function concluir(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return; // evita clique duplo enquanto processa
    if (!email || !nome || !cpf || !telefone || !endereco.cep || !endereco.logradouro || !endereco.numero) {
      setErro(copy.checkout.camposObrigatorios);
      return;
    }
    if (!frete) {
      setErro("Confira o CEP (8 números): o frete aparece na etapa 2 assim que ele estiver completo.");
      return;
    }
    // usuário do vendedor informado → precisa existir para creditar a venda
    let afiliadoCodigo: string | null = null;
    const vendedorLimpo = vendedorUsuario.trim();
    if (vendedorLimpo) {
      setEtapa("Conferindo o vendedor…");
      const v = await consultarVendedor({ usuario: vendedorLimpo });
      if (!v.ok || !v.codigo) {
        setErro(copy.checkout.vendedorNaoEncontrado);
        setEtapa("");
        return;
      }
      afiliadoCodigo = v.codigo;
    }
    setErro("");
    setEnviando(true);
    try {
      const numeroPedido = `BN-${String(Math.floor(100000 + Math.random() * 900000))}`;
      const pedido = {
        numero: numeroPedido,
        data: new Date().toISOString(),
        clienteNome: nome,
        clienteEmail: email,
        itens: carrinho.itens.map((i) => ({
          sku: i.sku,
          titulo: i.produto.titulo,
          quantidade: i.quantidade,
          precoCentavos: i.variante.precoPor,
        })),
        totalCentavos: totalFinal,
        meio,
        freteNome: frete.nome,
        cupom: carrinho.cupomAplicado ?? undefined,
        descontoCentavos: carrinho.descontoCentavos || undefined,
        status: "aguardando_pagamento" as const,
      };
      gravarPedido(pedido);
      setEtapa("Registrando o pedido…");
      await enviarPedidoAoServidor(pedido, {
        endereco,
        cpf,
        telefone,
        afiliadoCodigo,
        vendedorUsuario: vendedorLimpo || null,
      });

      // pagamento real via Mercado Pago, quando configurado no servidor
      setEtapa("Conectando ao pagamento… na 1ª compra pode levar até 1 minuto.");
      const mpAtivo = await mercadoPagoAtivo();
      let pixReal: { paymentId: number | string; copiaCola: string | null; qrBase64: string | null } | null = null;
      if (mpAtivo && meio === "pix") {
        setEtapa("Gerando o Pix…");
        const r = await criarPagamentoPix(pedido, cpf);
        if (!r.ok || !r.pix) {
          setErro(r.erro ?? "Não foi possível gerar o Pix. Tente novamente.");
          return;
        }
        pixReal = r.pix;
      }

      try {
        sessionStorage.setItem(
          "beautynow:ultimo-pedido",
          JSON.stringify({
            numero: numeroPedido,
            meio,
            totalCentavos: totalFinal,
            dataPrevista: frete.dataPrevista,
            email,
            pixReal,
          })
        );
      } catch {
        // segue sem resumo persistido
      }

      if (mpAtivo && (meio === "cartao" || meio === "boleto")) {
        // página segura do Mercado Pago — nenhum dado de cartão passa pelo site
        setEtapa("Abrindo a página segura do Mercado Pago…");
        const r = await criarCheckoutPro(pedido, meio);
        if (!r.ok || !r.initPoint) {
          setErro(r.erro ?? "Não foi possível iniciar o pagamento. Tente novamente.");
          return;
        }
        carrinho.limpar();
        window.location.href = r.initPoint;
        return; // o navegador troca para a página do MP em seguida
      }

      carrinho.limpar();
      router.push("/checkout/confirmacao");
    } catch {
      setErro("Não foi possível concluir agora. Confira a internet e tente de novo.");
    } finally {
      setEnviando(false);
      setEtapa("");
    }
  }

  if (carrinho.itens.length === 0) {
    return (
      <div className="container-bn flex flex-col items-center gap-4 py-24 text-center">
        <p className="text-[1rem] text-grafite">{copy.carrinho.vazio}</p>
        <Link
          href="/"
          className="rounded-[999px] bg-roxo px-6 py-3 text-[0.9375rem] font-semibold text-white hover:bg-roxo-escuro"
        >
          {copy.checkout.voltarLoja}
        </Link>
      </div>
    );
  }

  // finalizar compra exige conta — o carrinho segue guardado enquanto entra
  if (!conta.usuario) {
    return (
      <div className="min-h-dvh bg-superficie">
        <header className="border-b border-linha bg-white">
          <div className="container-bn flex h-16 items-center justify-between">
            <Link href="/" aria-label={`${copy.marca.nome} — página inicial`}>
              <Logo altura={24} />
            </Link>
            <p className="hidden items-center gap-4 text-[0.8125rem] text-grafite sm:flex">
              <span>🔒 {copy.checkout.seguro}</span>
              <span className="num">{copy.checkout.atendimento}</span>
            </p>
          </div>
        </header>
        <div className="container-bn max-w-md py-16 text-center">
          <h1 className="font-titulo text-[1.5rem] font-semibold text-tinta">
            {copy.checkout.precisaContaTitulo}
          </h1>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-grafite">
            {copy.checkout.precisaContaTexto}
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              href="/conta"
              className="rounded-[999px] bg-roxo py-3 text-[0.9375rem] font-semibold text-white hover:bg-roxo-escuro"
            >
              {copy.checkout.precisaContaEntrar}
            </Link>
            <Link
              href="/conta/criar"
              className="rounded-[999px] border-2 border-roxo py-3 text-[0.9375rem] font-semibold text-roxo hover:bg-roxo-claro"
            >
              {copy.checkout.precisaContaCriar}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const abaixoDoMinimo = totalProdutos < PEDIDO_MINIMO_CENTAVOS;

  return (
    <div className="min-h-dvh bg-superficie">
      {/* header reduzido: logo, selo e telefone — sem navegação */}
      <header className="border-b border-linha bg-white">
        <div className="container-bn flex h-16 items-center justify-between">
          <Link href="/" aria-label="BeautyNow — página inicial">
            <Logo altura={24} />
          </Link>
          <p className="hidden items-center gap-4 text-[0.8125rem] text-grafite sm:flex">
            <span>🔒 {copy.checkout.seguro}</span>
            <span className="num">{copy.checkout.atendimento}</span>
          </p>
        </div>
      </header>

      <form onSubmit={concluir} className="container-bn grid gap-6 py-8 lg:grid-cols-[1fr_380px]">
        <h1 className="sr-only">{copy.checkout.titulo}</h1>

        <div className="space-y-5">
          {/* 1. Identificação — e-mail primeiro (recuperação de abandono) */}
          <Bloco numero={1} titulo={copy.checkout.identificacao}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo
                rotulo={copy.checkout.email}
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                valor={email}
                aoMudar={setEmail}
                required
                classeExtra="sm:col-span-2"
                somenteLeitura
              />
              <Campo
                rotulo={copy.checkout.nome}
                id="nome"
                autoComplete="name"
                valor={nome}
                aoMudar={setNome}
                required
                classeExtra="sm:col-span-2"
              />
              <Campo
                rotulo={copy.checkout.cpf}
                id="cpf"
                inputMode="numeric"
                valor={cpf}
                aoMudar={setCpf}
                required
              />
              <Campo
                rotulo={copy.checkout.telefone}
                id="telefone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                valor={telefone}
                aoMudar={setTelefone}
                required
              />
            </div>
          </Bloco>

          {/* 2. Entrega */}
          <Bloco numero={2} titulo={copy.checkout.entrega}>
            <div className="grid gap-3 sm:grid-cols-3">
              <Campo
                rotulo={copy.checkout.cep}
                id="cep"
                inputMode="numeric"
                autoComplete="postal-code"
                valor={endereco.cep}
                aoMudar={(v) => setEndereco((e) => ({ ...e, cep: v }))}
                aoDesfocar={aoSairDoCep}
                required
              />
              <Campo
                rotulo={copy.checkout.logradouro}
                id="logradouro"
                autoComplete="address-line1"
                valor={endereco.logradouro}
                aoMudar={(v) => setEndereco((e) => ({ ...e, logradouro: v }))}
                required
                classeExtra="sm:col-span-2"
              />
              <Campo
                rotulo={copy.checkout.numero}
                id="numero"
                inputMode="numeric"
                valor={endereco.numero}
                aoMudar={(v) => setEndereco((e) => ({ ...e, numero: v }))}
                required
              />
              <Campo
                rotulo={copy.checkout.complemento}
                id="complemento"
                valor={endereco.complemento}
                aoMudar={(v) => setEndereco((e) => ({ ...e, complemento: v }))}
              />
              <Campo
                rotulo={copy.checkout.bairro}
                id="bairro"
                valor={endereco.bairro}
                aoMudar={(v) => setEndereco((e) => ({ ...e, bairro: v }))}
                required
              />
              <Campo
                rotulo={copy.checkout.cidade}
                id="cidade"
                autoComplete="address-level2"
                valor={endereco.cidade}
                aoMudar={(v) => setEndereco((e) => ({ ...e, cidade: v }))}
                required
                classeExtra="sm:col-span-2"
              />
              <Campo
                rotulo={copy.checkout.uf}
                id="uf"
                autoComplete="address-level1"
                valor={endereco.uf}
                aoMudar={(v) => setEndereco((e) => ({ ...e, uf: v.toUpperCase().slice(0, 2) }))}
                required
              />
              <Campo
                rotulo={copy.checkout.referencia}
                id="referencia"
                valor={endereco.referencia}
                aoMudar={(v) => setEndereco((e) => ({ ...e, referencia: v }))}
                classeExtra="sm:col-span-3"
              />
            </div>
            {buscandoCep && (
              <p className="mt-2 text-[0.8125rem] text-cinza">Buscando endereço…</p>
            )}
            {fretes.length > 0 && (
              <fieldset className="mt-4">
                <legend className="text-[0.875rem] font-medium">Escolha o frete</legend>
                <div className="mt-2 space-y-2">
                  {fretes.map((f) => (
                    <label
                      key={f.id}
                      className={`flex cursor-pointer items-center justify-between rounded-[10px] border px-4 py-3 text-[0.875rem] ${
                        freteEscolhido === f.id ? "border-roxo bg-roxo-claro" : "border-linha bg-white"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="frete"
                          value={f.id}
                          checked={freteEscolhido === f.id}
                          onChange={() => setFreteEscolhido(f.id)}
                          className="h-4 w-4 accent-[#4A2882]"
                        />
                        <span>
                          {f.nome} · Chega até <strong className="num">{f.dataPrevista}</strong>
                        </span>
                      </span>
                      <strong className={`num ${f.valorCentavos === 0 ? "text-sucesso" : ""}`}>
                        {f.valorCentavos === 0 ? "Grátis" : formatarPreco(f.valorCentavos)}
                      </strong>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          </Bloco>

          {/* 3. Pagamento — Pix destacado */}
          <Bloco numero={3} titulo={copy.checkout.pagamento}>
            <div className="space-y-2">
              {(
                [
                  ["pix", copy.checkout.pix, copy.checkout.pixDetalhe],
                  ["cartao", copy.checkout.cartao, copy.checkout.cartaoDetalhe],
                  ["boleto", copy.checkout.boleto, copy.checkout.boletoDetalhe],
                ] as const
              ).map(([id, rotulo, detalhe]) => (
                <label
                  key={id}
                  className={`flex cursor-pointer items-center gap-3 rounded-[10px] border px-4 py-3.5 ${
                    meio === id ? "border-roxo bg-roxo-claro" : "border-linha bg-white"
                  }`}
                >
                  <input
                    type="radio"
                    name="pagamento"
                    value={id}
                    checked={meio === id}
                    onChange={() => setMeio(id)}
                    className="h-4 w-4 accent-[#4A2882]"
                  />
                  <span>
                    <span className="block text-[0.9375rem] font-semibold">
                      {rotulo}
                      {id === "pix" && (
                        <span className="num ml-2 rounded-[6px] bg-sucesso px-1.5 py-0.5 text-[0.6875rem] font-bold text-white">
                          -5%
                        </span>
                      )}
                    </span>
                    <span className="block text-[0.8125rem] text-cinza">{detalhe}</span>
                  </span>
                </label>
              ))}
            </div>
            {meio === "cartao" && (
              <p className="num mt-3 text-[0.875rem] text-grafite">
                {copy.pdp.emAte} {parcela.vezes}x de {formatarPreco(parcela.valor)} {copy.pdp.semJuros}
              </p>
            )}
            {/* venda indicada por afiliado: o usuário do vendedor credita a comissão */}
            <label className="mt-4 block">
              <span className="text-[0.8125rem] font-medium text-grafite">
                {copy.checkout.vendedorRotulo}
              </span>
              <input
                type="text"
                value={vendedorUsuario}
                onChange={(e) => setVendedorUsuario(e.target.value.toUpperCase())}
                placeholder="MARIA#22"
                className="num mt-1 h-11 w-full rounded-[6px] border border-linha bg-white px-3 text-[0.9375rem] uppercase outline-none focus:border-violeta sm:max-w-xs"
              />
              <span className="mt-1 block text-[0.75rem] text-cinza">
                {copy.checkout.vendedorDica}
              </span>
            </label>
          </Bloco>
        </div>

        {/* resumo fixo */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-[16px] border border-linha bg-white p-5">
            <h2 className="font-titulo text-[1.125rem] font-semibold">{copy.checkout.resumo}</h2>
            <ul className="mt-3 space-y-3 border-b border-linha pb-3">
              {carrinho.itens.map((item) => (
                <li key={item.sku} className="flex items-center gap-3 text-[0.875rem]">
                  <span className="relative w-12 shrink-0 overflow-hidden rounded-[6px] border border-linha">
                    <ImagemProduto produto={item.produto} alt="" />
                    <span className="num absolute right-0 top-0 rounded-bl-[6px] bg-tinta/75 px-1 text-[0.6875rem] font-semibold text-white">
                      {item.quantidade}
                    </span>
                  </span>
                  <span className="line-clamp-2 grow leading-snug text-grafite">
                    {item.produto.titulo}
                  </span>
                  <span className="num shrink-0 font-medium">
                    {formatarPreco(item.variante.precoPor * item.quantidade)}
                  </span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1.5 text-[0.9375rem]">
              <div className="flex justify-between">
                <dt className="text-grafite">{copy.carrinho.subtotal}</dt>
                <dd className="num">{formatarPreco(totalProdutos)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-grafite">{copy.checkout.frete}</dt>
                <dd className="num">
                  {frete ? (frete.valorCentavos === 0 ? "Grátis" : formatarPreco(frete.valorCentavos)) : "—"}
                </dd>
              </div>
              {carrinho.descontoCentavos > 0 && (
                <div className="flex justify-between text-roxo">
                  <dt>
                    {copy.checkout.desconto}
                    {carrinho.cupomAplicado && (
                      <span className="num ml-1 text-[0.75rem]">({carrinho.cupomAplicado})</span>
                    )}
                  </dt>
                  <dd className="num">-{formatarPreco(carrinho.descontoCentavos)}</dd>
                </div>
              )}
              {meio === "pix" && (
                <div className="flex justify-between text-sucesso">
                  <dt>{copy.carrinho.descontoPix}</dt>
                  <dd className="num">-{formatarPreco(baseComCupom - precoPix(baseComCupom))}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-linha pt-2 text-[1.0625rem] font-bold">
                <dt>{copy.checkout.total}</dt>
                <dd className="num">{formatarPreco(totalFinal)}</dd>
              </div>
            </dl>

            {erro && (
              <p role="alert" className="mt-3 rounded-[6px] bg-roxo-claro px-3 py-2 text-[0.8125rem] font-medium text-erro">
                {erro}
              </p>
            )}
            {abaixoDoMinimo && (
              <p className="mt-3 rounded-[6px] bg-roxo-claro px-3 py-2 text-[0.8125rem] text-roxo-escuro">
                {copy.carrinho.pedidoMinimo(formatarPreco(PEDIDO_MINIMO_CENTAVOS))}
              </p>
            )}

            <button
              type="submit"
              disabled={abaixoDoMinimo || enviando}
              className="mt-4 w-full rounded-[999px] bg-roxo py-3.5 text-[1rem] font-semibold text-white hover:bg-roxo-escuro disabled:cursor-not-allowed disabled:bg-cinza"
            >
              {enviando ? "Processando…" : copy.checkout.concluir}
            </button>
            {enviando && (
              <p role="status" className="mt-3 rounded-[6px] bg-roxo-claro px-3 py-2 text-center text-[0.8125rem] font-medium text-roxo-escuro">
                ⏳ {etapa || "Processando…"} Não feche esta página.
              </p>
            )}
            <p className="mt-3 text-center text-[0.75rem] text-cinza">
              🔒 {copy.checkout.seguro} · {copy.checkout.atendimento}
            </p>
          </div>
        </aside>
      </form>
    </div>
  );
}

function Bloco({
  numero,
  titulo,
  children,
}: {
  numero: number;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[16px] border border-linha bg-white p-5">
      <h2 className="flex items-center gap-2.5 font-titulo text-[1.125rem] font-semibold">
        <span className="num flex h-7 w-7 items-center justify-center rounded-full bg-tinta text-[0.875rem] font-bold text-white">
          {numero}
        </span>
        {titulo}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Campo({
  rotulo,
  id,
  valor,
  aoMudar,
  aoDesfocar,
  required = false,
  type = "text",
  autoComplete,
  inputMode,
  classeExtra = "",
  somenteLeitura = false,
}: {
  rotulo: string;
  id: string;
  valor: string;
  aoMudar: (v: string) => void;
  aoDesfocar?: () => void;
  required?: boolean;
  type?: string;
  autoComplete?: string;
  inputMode?: "numeric" | "tel" | "email" | "text";
  classeExtra?: string;
  somenteLeitura?: boolean;
}) {
  return (
    <div className={classeExtra}>
      <label htmlFor={id} className="block text-[0.8125rem] font-medium text-grafite">
        {rotulo}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        onBlur={aoDesfocar}
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        readOnly={somenteLeitura}
        className={`mt-1 h-11 w-full rounded-[6px] border border-linha px-3 text-[0.9375rem] outline-none focus:border-violeta ${
          somenteLeitura ? "bg-superficie text-grafite" : "bg-white"
        }`}
      />
    </div>
  );
}
