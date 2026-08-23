/**
 * Testa os 3 meios de pagamento no servidor de produção (roda no runner do
 * GitHub, que alcança o Render). Cria um Pix real (fica "pendente" e expira
 * sozinho, sem cobrar ninguém) e duas preferências de Checkout Pro (cartão e
 * boleto) — se os três voltarem ok, o pagamento está operante de ponta a ponta.
 *
 * Uso: node scripts/testar-pagamentos.mjs
 */
import { writeFileSync } from "node:fs";

const BASE = "https://beautynow-servidor.onrender.com";
const resultado = { quando: new Date().toISOString(), testes: {} };

async function chamar(caminho, corpo) {
  const r = await fetch(`${BASE}${caminho}`, {
    method: corpo ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: corpo ? JSON.stringify(corpo) : undefined,
    signal: AbortSignal.timeout(90_000),
  });
  const dados = await r.json().catch(() => ({}));
  return { status: r.status, dados };
}

const pedidoBase = {
  numero: `BN-TESTE-${Date.now().toString(36).toUpperCase()}`,
  data: new Date().toISOString(),
  clienteNome: "Teste Automatico BeautyNow",
  clienteEmail: "teste-pagamentos@beautynow.com.br",
  itens: [{ sku: "TESTE-1", titulo: "Item de teste (ignorar)", quantidade: 1, precoCentavos: 500 }],
  totalCentavos: 500,
  freteNome: "Teste",
};

// 1. saúde geral
const saude = await chamar("/saude");
resultado.testes.saude = { ok: saude.status === 200, mp: saude.dados?.mp, bling: saude.dados?.bling, emailModo: saude.dados?.emailModo };

// 2. Pix (cria pagamento real que fica pendente e expira — ninguém é cobrado)
const pix = await chamar("/pagamentos/pix", { pedido: { ...pedidoBase, meio: "pix" }, cpf: "12345678909" });
resultado.testes.pix = {
  ok: pix.status === 200 && Boolean(pix.dados?.copiaCola),
  status: pix.status,
  temQr: Boolean(pix.dados?.qrBase64),
  temCopiaCola: Boolean(pix.dados?.copiaCola),
  paymentId: pix.dados?.paymentId ?? null,
  erro: pix.dados?.erro ?? null,
};

// 3. Cartão (Checkout Pro)
const cartao = await chamar("/pagamentos/checkout-pro", { pedido: { ...pedidoBase, numero: pedidoBase.numero + "-C", meio: "cartao" }, meio: "cartao" });
resultado.testes.cartao = {
  ok: cartao.status === 200 && Boolean(cartao.dados?.initPoint),
  status: cartao.status,
  temLink: Boolean(cartao.dados?.initPoint),
  erro: cartao.dados?.erro ?? null,
};

// 4. Boleto (Checkout Pro)
const boleto = await chamar("/pagamentos/checkout-pro", { pedido: { ...pedidoBase, numero: pedidoBase.numero + "-B", meio: "boleto" }, meio: "boleto" });
resultado.testes.boleto = {
  ok: boleto.status === 200 && Boolean(boleto.dados?.initPoint),
  status: boleto.status,
  temLink: Boolean(boleto.dados?.initPoint),
  erro: boleto.dados?.erro ?? null,
};

// 5. consulta de status do Pix criado
if (resultado.testes.pix.paymentId) {
  const st = await chamar(`/pagamentos/status/${resultado.testes.pix.paymentId}`);
  resultado.testes.statusPix = { ok: st.status === 200, statusPagamento: st.dados?.status ?? null };
}

writeFileSync("teste-pagamentos.json", JSON.stringify(resultado, null, 2));
const resumo = Object.entries(resultado.testes).map(([k, v]) => `${k}=${v.ok ? "OK" : "FALHOU"}`).join(" | ");
console.log("[pagamentos]", resumo);
