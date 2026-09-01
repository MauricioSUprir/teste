/**
 * Comunicação com o servidor BeautyNow (apps/servidor).
 *
 * O servidor é quem envia o código de verificação por e-mail de verdade e
 * repassa pedidos ao Hub Suprir com a X-API-Key (que nunca chega ao
 * navegador). Enquanto NEXT_PUBLIC_SERVIDOR_URL não estiver configurada no
 * build, o site funciona em modo demonstração: código exibido na tela e
 * pedidos registrados apenas localmente.
 */
import { LOJA_ID } from "./loja";
import type { Pedido } from "./pedidos";

export const SERVIDOR_URL = (process.env.NEXT_PUBLIC_SERVIDOR_URL ?? "").replace(/\/$/, "");

export function servidorConfigurado(): boolean {
  return SERVIDOR_URL.length > 0;
}

/** fetch com limite de espera — o plano gratuito do Render dorme e pode
 * demorar até ~1 min para acordar; sem timeout o botão pareceria travado. */
async function fetchComTimeout(url: string, ms: number, init?: RequestInit): Promise<Response> {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controle.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function chamar(caminho: string, corpo: unknown): Promise<{ ok: boolean; erro?: string }> {
  try {
    const resposta = await fetchComTimeout(`${SERVIDOR_URL}${caminho}`, 75_000, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const dados = (await resposta.json().catch(() => ({}))) as { erro?: string };
    if (!resposta.ok) return { ok: false, erro: dados.erro ?? "O servidor não respondeu. Tente novamente." };
    return { ok: true };
  } catch {
    return {
      ok: false,
      erro: "O servidor está acordando — aguarde uns 30 segundos e tente de novo.",
    };
  }
}

interface Saude {
  emailModo?: string;
  mp?: boolean;
}

let cacheSaude: { valor: Saude | null; expira: number } | null = null;

/** Consulta /saude do servidor com cache — decide quais recursos reais estão ligados. */
async function consultarSaude(): Promise<Saude | null> {
  if (!servidorConfigurado()) return null;
  if (cacheSaude && Date.now() < cacheSaude.expira) return cacheSaude.valor;
  try {
    // 65s: tempo suficiente para o servidor gratuito acordar na 1ª visita
    const resposta = await fetchComTimeout(`${SERVIDOR_URL}/saude`, 65_000);
    const dados = (await resposta.json()) as Saude;
    cacheSaude = { valor: resposta.ok ? dados : null, expira: Date.now() + 5 * 60_000 };
  } catch {
    cacheSaude = { valor: null, expira: Date.now() + 30_000 };
  }
  return cacheSaude.valor;
}

/**
 * Acorda o servidor em segundo plano assim que o site abre. Quando a pessoa
 * chegar no login ou no checkout, ele já está de pé e a resposta é imediata.
 */
export function acordarServidor() {
  if (!servidorConfigurado()) return;
  void consultarSaude();
}

/**
 * O envio de código pelo servidor só é usado quando o e-mail real (Gmail)
 * está configurado lá — senão o site mantém o modo demonstração local
 * (código visível na tela). Ligar o Gmail no servidor ativa o e-mail real
 * automaticamente, sem republicar o site.
 */
export async function emailRealAtivo(): Promise<boolean> {
  const modo = (await consultarSaude())?.emailModo;
  return modo === "gmail" || modo === "brevo";
}

/** Mercado Pago ligado no servidor → checkout usa pagamento real. */
export async function mercadoPagoAtivo(): Promise<boolean> {
  return (await consultarSaude())?.mp === true;
}

export interface PixReal {
  paymentId: number | string;
  copiaCola: string | null;
  qrBase64: string | null;
}

/** Cria o pagamento Pix real no Mercado Pago (via servidor). */
export async function criarPagamentoPix(
  pedido: Pedido,
  cpf: string
): Promise<{ ok: boolean; pix?: PixReal; erro?: string }> {
  try {
    const resposta = await fetch(`${SERVIDOR_URL}/pagamentos/pix`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pedido, cpf }),
    });
    const dados = (await resposta.json()) as PixReal & { erro?: string };
    if (!resposta.ok) return { ok: false, erro: dados.erro ?? "Falha ao gerar o Pix." };
    return { ok: true, pix: dados };
  } catch {
    return { ok: false, erro: "Sem conexão com o servidor de pagamento." };
  }
}

/** Cria o Checkout Pro (cartão/boleto) e devolve o link seguro do Mercado Pago. */
export async function criarCheckoutPro(
  pedido: Pedido,
  meio: "cartao" | "boleto"
): Promise<{ ok: boolean; initPoint?: string; erro?: string }> {
  try {
    const resposta = await fetch(`${SERVIDOR_URL}/pagamentos/checkout-pro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pedido, meio, loja: LOJA_ID }),
    });
    const dados = (await resposta.json()) as { initPoint?: string; erro?: string };
    if (!resposta.ok || !dados.initPoint) return { ok: false, erro: dados.erro ?? "Falha ao iniciar o pagamento." };
    return { ok: true, initPoint: dados.initPoint };
  } catch {
    return { ok: false, erro: "Sem conexão com o servidor de pagamento." };
  }
}

/** Consulta o status de um pagamento (para a confirmação virar "aprovado" sozinha). */
export async function statusPagamento(paymentId: number | string): Promise<string | null> {
  try {
    const resposta = await fetch(`${SERVIDOR_URL}/pagamentos/status/${paymentId}`);
    const dados = (await resposta.json()) as { status?: string };
    return resposta.ok ? (dados.status ?? null) : null;
  } catch {
    return null;
  }
}

// ===== Preços manuais (admin fixa um preço e vale para todos os clientes) =====

export interface PrecoManual {
  precoPorCentavos: number;
  precoDeCentavos: number | null;
  titulo?: string;
  em?: string;
}

/** Preços fixados manualmente no admin desta loja — o site aplica ao carregar. */
export async function consultarPrecosManuais(): Promise<Record<string, PrecoManual> | null> {
  if (!servidorConfigurado()) return null;
  try {
    const resposta = await fetchComTimeout(
      `${SERVIDOR_URL}/catalogo/precos?loja=${LOJA_ID}`,
      75_000,
      {}
    );
    if (!resposta.ok) return null;
    const dados = (await resposta.json()) as { precos?: Record<string, PrecoManual> };
    return dados.precos ?? {};
  } catch {
    return null;
  }
}

/** Admin fixa (ou remove, com precoPorCentavos null) o preço manual de um produto. */
export async function definirPrecoManual(
  slug: string,
  precoPorCentavos: number | null,
  precoDeCentavos: number | null,
  titulo?: string
): Promise<{ ok: boolean; erro?: string }> {
  try {
    const resposta = await fetchComTimeout(`${SERVIDOR_URL}/catalogo/precos`, 30_000, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug,
        precoPorCentavos,
        precoDeCentavos,
        titulo,
        loja: LOJA_ID,
        chave: CHAVE_ADMIN_SERVIDOR,
      }),
    });
    const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string };
    return { ok: resposta.ok, erro: corpo.erro };
  } catch {
    return { ok: false, erro: "Sem conexão com o servidor. Tente de novo em instantes." };
  }
}

/** Pede ao servidor que gere e envie o código de verificação por e-mail. */
export function solicitarCodigoPorEmail(email: string) {
  return chamar("/codigo", { email });
}

/** Confirma no servidor o código digitado. */
export function verificarCodigoNoServidor(email: string, codigo: string) {
  return chamar("/codigo/verificar", { email, codigo });
}

/** Envia o pedido ao servidor, que repassa ao Hub Suprir. */
export async function enviarPedidoAoServidor(
  pedido: Pedido,
  extras: {
    endereco: unknown;
    cpf: string;
    telefone: string;
    /** código do afiliado — só vai quando o usuário do vendedor foi informado e validado */
    afiliadoCodigo?: string | null;
    vendedorUsuario?: string | null;
  }
): Promise<void> {
  if (!servidorConfigurado()) return; // modo demonstração: pedido só local
  const { afiliadoCodigo, vendedorUsuario, ...resto } = extras;
  // falha aqui não pode travar a confirmação da compra — o registro local fica
  await chamar("/pedidos", {
    ...pedido,
    ...resto,
    afiliado: afiliadoCodigo ?? undefined,
    vendedorUsuario: vendedorUsuario ?? undefined,
    loja: LOJA_ID,
  }).catch(() => undefined);
}

// ===== Pedidos no painel do admin (histórico completo no servidor) =====

export interface EnderecoPedido {
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  referencia?: string;
}

export interface PedidoAdmin {
  numero: string;
  data: string;
  loja: "beautynow" | "be2beauty";
  clienteNome: string;
  clienteEmail: string;
  cpf: string;
  telefone: string;
  endereco: EnderecoPedido | null;
  itens: { sku: string; titulo: string; quantidade: number; precoCentavos: number }[];
  totalCentavos: number;
  meio: string;
  freteNome: string;
  cupom: string | null;
  descontoCentavos: number;
  afiliado: string | null;
  vendedorUsuario?: string | null;
  status: "aguardando_pagamento" | "pago" | "cancelado";
}

/** Admin: todos os pedidos do site, com endereço e contato do cliente. */
export async function listarPedidosAdmin(): Promise<{ ok: boolean; pedidos: PedidoAdmin[] }> {
  try {
    const resposta = await fetchComTimeout(
      `${SERVIDOR_URL}/pedidos/lista?chave=${encodeURIComponent(CHAVE_ADMIN_SERVIDOR)}`,
      75_000,
      {}
    );
    if (!resposta.ok) return { ok: false, pedidos: [] };
    const dados = (await resposta.json()) as { pedidos?: PedidoAdmin[] };
    return { ok: true, pedidos: dados.pedidos ?? [] };
  } catch {
    return { ok: false, pedidos: [] };
  }
}

/** Admin muda o status de um pedido no servidor (pago fora do MP, cancelado…). */
export async function mudarStatusPedidoAdmin(
  numero: string,
  status: "pago" | "cancelado" | "aguardando_pagamento"
) {
  try {
    const resposta = await fetchComTimeout(`${SERVIDOR_URL}/pedidos/status`, 30_000, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numero, status, chave: CHAVE_ADMIN_SERVIDOR }),
    });
    return { ok: resposta.ok };
  } catch {
    return { ok: false };
  }
}

// ===== Avaliações da loja =====

export interface AvaliacaoLoja {
  id: string;
  data: string;
  nome: string;
  nota: number;
  notaProduto?: number;
  notaExperiencia?: number;
  texto: string;
  pedido?: string;
}

/** Lista as avaliações públicas da loja (mais recentes primeiro). */
export async function listarAvaliacoes(): Promise<{
  ok: boolean;
  media: number | null;
  total: number;
  avaliacoes: AvaliacaoLoja[];
}> {
  try {
    const resposta = await fetchComTimeout(`${SERVIDOR_URL}/avaliacoes`, 65_000, {});
    const dados = (await resposta.json()) as {
      media: number | null;
      total: number;
      avaliacoes: AvaliacaoLoja[];
    };
    return { ok: resposta.ok, media: dados.media ?? null, total: dados.total ?? 0, avaliacoes: dados.avaliacoes ?? [] };
  } catch {
    return { ok: false, media: null, total: 0, avaliacoes: [] };
  }
}

/** Envia uma avaliação (estrelas + comentário). */
export function enviarAvaliacao(dados: {
  nome: string;
  nota: number;
  notaProduto?: number;
  notaExperiencia?: number;
  texto: string;
  pedido?: string;
}) {
  return chamar("/avaliacoes", dados);
}

// ===== Banners do carrossel (gerenciados no painel admin) =====

/** Chave administrativa das rotas de banner (mesma do exportador). */
export const CHAVE_ADMIN_SERVIDOR = "exporta-bn-2026";

/** Lista os banners ativos, na ordem (URLs absolutas prontas para <img>). */
export async function listarBanners(): Promise<{ slot: string; url: string }[]> {
  if (!servidorConfigurado()) return [];
  try {
    const resposta = await fetchComTimeout(`${SERVIDOR_URL}/banners`, 65_000, {});
    if (!resposta.ok) return [];
    const dados = (await resposta.json()) as { banners?: { slot: string; url: string }[] };
    return (dados.banners ?? []).map((b) => ({ ...b, url: `${SERVIDOR_URL}${b.url}` }));
  } catch {
    return [];
  }
}

/** Envia/substitui um banner (admin). */
export async function enviarBanner(slot: string, mime: string, base64: string) {
  try {
    const resposta = await fetchComTimeout(
      `${SERVIDOR_URL}/enviar-banners/salvar?chave=${encodeURIComponent(CHAVE_ADMIN_SERVIDOR)}`,
      75_000,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot, mime, base64 }),
      }
    );
    const dados = (await resposta.json().catch(() => ({}))) as { erro?: string };
    return { ok: resposta.ok, erro: dados.erro };
  } catch {
    return { ok: false, erro: "Sem conexão com o servidor. Tente de novo em instantes." };
  }
}

/** Remove um banner (admin). */
export async function excluirBanner(slot: string) {
  try {
    const resposta = await fetchComTimeout(
      `${SERVIDOR_URL}/enviar-banners/excluir?chave=${encodeURIComponent(CHAVE_ADMIN_SERVIDOR)}`,
      30_000,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot }),
      }
    );
    return { ok: resposta.ok };
  } catch {
    return { ok: false };
  }
}

// ===== Cadastro profissional Be2Beauty (B2B) =====

export type StatusB2B = "nao_cadastrado" | "pendente" | "aprovado" | "recusado";

export interface CadastroB2B {
  cnpj: string;
  razao: string;
  nome: string;
  email: string;
  whatsapp: string;
  criadoEm: string;
  status: StatusB2B;
}

/** Envia o cadastro profissional (CNPJ) para análise. */
export async function cadastrarB2B(dados: {
  cnpj: string;
  razao: string;
  nome: string;
  email: string;
  whatsapp: string;
}): Promise<{ ok: boolean; status?: StatusB2B; erro?: string }> {
  try {
    const resposta = await fetchComTimeout(`${SERVIDOR_URL}/b2b/cadastro`, 75_000, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    });
    const corpo = (await resposta.json().catch(() => ({}))) as { status?: StatusB2B; erro?: string };
    return { ok: resposta.ok, status: corpo.status, erro: corpo.erro };
  } catch {
    return { ok: false, erro: "Sem conexão com o servidor. Tente de novo em instantes." };
  }
}

/** Consulta a situação de um CNPJ cadastrado. */
export async function consultarStatusB2B(cnpj: string): Promise<StatusB2B | null> {
  try {
    const resposta = await fetchComTimeout(
      `${SERVIDOR_URL}/b2b/status?cnpj=${encodeURIComponent(cnpj)}`,
      65_000,
      {}
    );
    if (!resposta.ok) return null;
    const dados = (await resposta.json()) as { status?: StatusB2B };
    return dados.status ?? null;
  } catch {
    return null;
  }
}

/** Lista os cadastros B2B (admin). */
export async function listarCadastrosB2B(): Promise<{ ok: boolean; cadastros: CadastroB2B[] }> {
  try {
    const resposta = await fetchComTimeout(
      `${SERVIDOR_URL}/b2b/lista?chave=${encodeURIComponent(CHAVE_ADMIN_SERVIDOR)}`,
      65_000,
      {}
    );
    if (!resposta.ok) return { ok: false, cadastros: [] };
    const dados = (await resposta.json()) as { cadastros?: CadastroB2B[] };
    return { ok: true, cadastros: dados.cadastros ?? [] };
  } catch {
    return { ok: false, cadastros: [] };
  }
}

/** Aprova/recusa um cadastro B2B (admin). */
export async function decidirCadastroB2B(cnpj: string, status: "aprovado" | "recusado" | "pendente") {
  try {
    const resposta = await fetchComTimeout(`${SERVIDOR_URL}/b2b/decidir`, 30_000, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cnpj, status, chave: CHAVE_ADMIN_SERVIDOR }),
    });
    return { ok: resposta.ok };
  } catch {
    return { ok: false };
  }
}

// ===== Afiliados — programa independente do B2B (login por e-mail + código) =====

export interface VendaAfiliado {
  pedido: string;
  codigo: string;
  afiliadoId: string;
  data: string;
  totalCentavos: number;
  pct: number;
  comissaoCentavos: number;
}

export interface SaqueAfiliado {
  id: string;
  afiliadoId: string;
  codigo: string | null;
  nome: string;
  email: string;
  data: string;
  valorCentavos: number;
  chavePix: string;
  status: "pendente" | "pago" | "recusado";
}

export interface PainelAfiliado {
  nome: string;
  usuario: string | null;
  chavePix: string | null;
  codigo: string | null;
  url: string | null;
  pct: number;
  totais: {
    vendas: number;
    vendidoCentavos: number;
    comissaoCentavos: number;
    disponivelCentavos: number;
    aguardandoSaqueCentavos: number;
    sacadoCentavos: number;
  };
  vendas: VendaAfiliado[];
  saques: SaqueAfiliado[];
}

export interface AfiliadoAdmin {
  id: string;
  email: string;
  nome: string;
  usuario?: string | null;
  chavePix?: string | null;
  whatsapp: string;
  cnpj: string | null;
  codigo: string | null;
  pct: number;
  vendas: number;
  vendidoCentavos: number;
  comissaoCentavos: number;
  disponivelCentavos: number;
}

export interface CadastroAfiliado {
  id: string;
  email: string;
  nome: string;
  usuario?: string | null;
  chavePix?: string | null;
  whatsapp: string;
  cnpj: string | null;
  criadoEm: string;
  status: "pendente" | "aprovado" | "recusado";
  codigoAfiliado: string | null;
  comissaoPct: number;
}

/** Regra do usuário de vendedor: SÓ MAIÚSCULAS + número + caractere especial. */
export const USUARIO_VENDEDOR_RE = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%&*_.\-])[A-Z0-9!@#$%&*_.\-]{4,20}$/;

/** Pede entrada no programa de afiliados. CNPJ é opcional; usuário e Pix, não. */
export async function cadastrarAfiliado(dados: {
  email: string;
  nome: string;
  usuario: string;
  chavePix: string;
  whatsapp: string;
  cnpj?: string;
}): Promise<{ ok: boolean; status?: string; erro?: string }> {
  try {
    const resposta = await fetchComTimeout(`${SERVIDOR_URL}/afiliados/cadastro`, 30_000, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    });
    const corpo = (await resposta.json().catch(() => ({}))) as { status?: string; erro?: string };
    return { ok: resposta.ok, ...corpo };
  } catch {
    return { ok: false, erro: "Sem conexão com o servidor. Tente de novo em instantes." };
  }
}

/** Consulta pública da situação do cadastro pelo e-mail. */
export async function consultarStatusAfiliado(
  email: string
): Promise<{ ok: boolean; status: string; usuario?: string | null }> {
  try {
    const resposta = await fetchComTimeout(
      `${SERVIDOR_URL}/afiliados/cadastro/status?email=${encodeURIComponent(email)}`,
      30_000,
      {}
    );
    if (!resposta.ok) return { ok: false, status: "nao_cadastrado" };
    return (await resposta.json()) as { ok: boolean; status: string; usuario?: string | null };
  } catch {
    return { ok: false, status: "nao_cadastrado" };
  }
}

/** Vendedor público: pelo código do link (?af=) ou pelo usuário digitado. */
export async function consultarVendedor(filtro: {
  codigo?: string;
  usuario?: string;
}): Promise<{ ok: boolean; usuario?: string | null; codigo?: string | null }> {
  try {
    const q = filtro.codigo
      ? `codigo=${encodeURIComponent(filtro.codigo)}`
      : `usuario=${encodeURIComponent(filtro.usuario ?? "")}`;
    const resposta = await fetchComTimeout(`${SERVIDOR_URL}/afiliados/vendedor?${q}`, 30_000, {});
    if (!resposta.ok) return { ok: false };
    return (await resposta.json()) as { ok: boolean; usuario: string | null; codigo: string | null };
  } catch {
    return { ok: false };
  }
}

/** Confere se o usuário de vendedor bate com o cadastro daquele e-mail. */
export async function conferirUsuarioAfiliado(
  email: string,
  usuario: string
): Promise<{ ok: boolean; confere: boolean }> {
  try {
    const resposta = await fetchComTimeout(
      `${SERVIDOR_URL}/afiliados/conferir-usuario?email=${encodeURIComponent(email)}&usuario=${encodeURIComponent(usuario)}`,
      30_000,
      {}
    );
    if (!resposta.ok) return { ok: false, confere: false };
    return (await resposta.json()) as { ok: boolean; confere: boolean };
  } catch {
    return { ok: false, confere: false };
  }
}

/** Admin: lista completa de cadastros de afiliado (para aprovar/recusar). */
export async function listarCadastrosAfiliado(): Promise<{ ok: boolean; cadastros: CadastroAfiliado[] }> {
  try {
    const resposta = await fetchComTimeout(
      `${SERVIDOR_URL}/afiliados/lista?chave=${encodeURIComponent(CHAVE_ADMIN_SERVIDOR)}`,
      30_000,
      {}
    );
    if (!resposta.ok) return { ok: false, cadastros: [] };
    const dados = (await resposta.json()) as { cadastros?: CadastroAfiliado[] };
    return { ok: true, cadastros: dados.cadastros ?? [] };
  } catch {
    return { ok: false, cadastros: [] };
  }
}

/** Admin aprova/recusa um pedido de entrada no programa de afiliados. */
export async function decidirCadastroAfiliado(email: string, status: "aprovado" | "recusado") {
  try {
    const resposta = await fetchComTimeout(`${SERVIDOR_URL}/afiliados/decidir`, 30_000, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, status, chave: CHAVE_ADMIN_SERVIDOR }),
    });
    return { ok: resposta.ok };
  } catch {
    return { ok: false };
  }
}

/** Admin exclui um cadastro de afiliado e tudo dele (vendas, saques). */
export async function excluirAfiliado(email: string) {
  try {
    const resposta = await fetchComTimeout(`${SERVIDOR_URL}/afiliados/excluir`, 30_000, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, chave: CHAVE_ADMIN_SERVIDOR }),
    });
    return { ok: resposta.ok };
  } catch {
    return { ok: false };
  }
}

/** Gera (ou devolve) o link do afiliado aprovado. */
export async function gerarLinkAfiliado(
  email: string
): Promise<{ ok: boolean; codigo?: string; url?: string; pct?: number; erro?: string }> {
  try {
    const resposta = await fetchComTimeout(`${SERVIDOR_URL}/afiliados/link`, 75_000, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const corpo = (await resposta.json().catch(() => ({}))) as {
      codigo?: string;
      url?: string;
      pct?: number;
      erro?: string;
    };
    return { ok: resposta.ok, ...corpo };
  } catch {
    return { ok: false, erro: "Sem conexão com o servidor. Tente de novo em instantes." };
  }
}

/** Painel do próprio afiliado: link, vendas e comissão (exige o usuário). */
export async function consultarPainelAfiliado(
  email: string,
  usuario: string
): Promise<PainelAfiliado | null> {
  try {
    const resposta = await fetchComTimeout(
      `${SERVIDOR_URL}/afiliados/painel?email=${encodeURIComponent(email)}&usuario=${encodeURIComponent(usuario)}`,
      75_000,
      {}
    );
    if (!resposta.ok) return null;
    return (await resposta.json()) as PainelAfiliado;
  } catch {
    return null;
  }
}

interface GeralAfiliados {
  vendas: number;
  vendidoCentavos: number;
  comissaoCentavos: number;
  saquesPendentes: number;
  aPagarCentavos: number;
}

/** Visão do admin: todos os afiliados, totais gerais e saques. */
export async function listarAfiliadosAdmin(): Promise<{
  ok: boolean;
  afiliados: AfiliadoAdmin[];
  geral: GeralAfiliados;
  ultimas: VendaAfiliado[];
  saques: SaqueAfiliado[];
}> {
  const vazio: GeralAfiliados = {
    vendas: 0,
    vendidoCentavos: 0,
    comissaoCentavos: 0,
    saquesPendentes: 0,
    aPagarCentavos: 0,
  };
  try {
    const resposta = await fetchComTimeout(
      `${SERVIDOR_URL}/afiliados/admin?chave=${encodeURIComponent(CHAVE_ADMIN_SERVIDOR)}`,
      75_000,
      {}
    );
    if (!resposta.ok) return { ok: false, afiliados: [], geral: vazio, ultimas: [], saques: [] };
    const dados = (await resposta.json()) as {
      afiliados?: AfiliadoAdmin[];
      geral?: GeralAfiliados;
      ultimas?: VendaAfiliado[];
      saques?: SaqueAfiliado[];
    };
    return {
      ok: true,
      afiliados: dados.afiliados ?? [],
      geral: dados.geral ?? vazio,
      ultimas: dados.ultimas ?? [],
      saques: dados.saques ?? [],
    };
  } catch {
    return { ok: false, afiliados: [], geral: vazio, ultimas: [], saques: [] };
  }
}

/** Afiliado pede o resgate da comissão via Pix. */
export async function pedirSaqueAfiliado(
  email: string,
  chavePix: string,
  valorCentavos?: number
): Promise<{ ok: boolean; erro?: string }> {
  try {
    const resposta = await fetchComTimeout(`${SERVIDOR_URL}/afiliados/saque`, 75_000, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, chavePix, valorCentavos }),
    });
    const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string };
    return { ok: resposta.ok, erro: corpo.erro };
  } catch {
    return { ok: false, erro: "Sem conexão com o servidor. Tente de novo em instantes." };
  }
}

/** Admin marca um saque como pago (após fazer o Pix) ou recusa. */
export async function decidirSaqueAfiliado(id: string, status: "pago" | "recusado") {
  try {
    const resposta = await fetchComTimeout(`${SERVIDOR_URL}/afiliados/saque-decidir`, 30_000, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, chave: CHAVE_ADMIN_SERVIDOR }),
    });
    return { ok: resposta.ok };
  } catch {
    return { ok: false };
  }
}

/** Admin define a comissão (%) de um afiliado. */
export async function definirComissaoAfiliado(email: string, pct: number) {
  try {
    const resposta = await fetchComTimeout(`${SERVIDOR_URL}/afiliados/comissao`, 30_000, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, pct, chave: CHAVE_ADMIN_SERVIDOR }),
    });
    return { ok: resposta.ok };
  } catch {
    return { ok: false };
  }
}
