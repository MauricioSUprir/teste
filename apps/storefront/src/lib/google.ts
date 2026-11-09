/**
 * Google Analytics 4 e Google Tag Manager — só carregam depois do aceite no
 * aviso de cookies (LGPD, docs/08), com o Modo de Consentimento do Google:
 * "Desempenho" libera a medição (analytics_storage) e "Marketing" libera
 * anúncios (ad_storage, ad_user_data, ad_personalization).
 *
 * Os IDs entram por variável de ambiente no build de cada loja:
 *   NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX  GA4 direto: páginas e etapas da compra já
 *                                   chegam ao Analytics, sem configurar nada
 *   NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX  Tag Manager, para o marketing pôr outras
 *                                   tags (Google Ads, Meta, TikTok…) sem mexer
 *                                   no site. Recebe as etapas da compra no
 *                                   dataLayer ({ event, ecommerce }).
 * Pode usar um, outro ou os dois. Com os dois, a tag do GA4 NÃO deve ser
 * criada dentro do Tag Manager (o site já manda direto; contaria em dobro).
 * Sem nenhum dos dois, nada é carregado.
 *
 * As etapas da compra vão no formato de e-commerce do GA4 (view_item,
 * add_to_cart, begin_checkout, purchase…), para o Analytics e o Google Ads.
 */
import type { Consentimento } from "./rastreio";
import { LOJA_ID } from "./loja";

/**
 * Códigos do Google de cada loja. São públicos (aparecem no HTML de qualquer
 * site que usa o Google) e ficam aqui para TODO build sair com eles — inclusive
 * a publicação diária do robô do catálogo, que não passa variáveis do Google.
 * Variável de ambiente, se houver, vale por cima.
 * GA4: uma propriedade só ("Beauty Now/Be2Beauty") para as duas lojas; nos
 * relatórios, separe pelo "Nome do host". Tag Manager: um contêiner para as
 * duas (sem a tag do GA4 dentro dele — o site já manda direto).
 * Search Console: verificado pelo domínio (DNS), sem meta tag.
 */
const POR_LOJA: Partial<Record<string, { ga?: string; gtm?: string; searchConsole?: string }>> = {
  beautynow: { ga: "G-Z8D6GPPFYQ", gtm: "GTM-TXHT6QRC" },
  be2beauty: { ga: "G-Z8D6GPPFYQ", gtm: "GTM-TXHT6QRC" },
};
const DA_LOJA = POR_LOJA[LOJA_ID] ?? {};

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || DA_LOJA.gtm || "";
const GA_ID = process.env.NEXT_PUBLIC_GA_ID || DA_LOJA.ga || "";

type JanelaGoogle = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };

let carregado = false;

export const googleConfigurado = () => Boolean(GTM_ID || GA_ID);

/** IDs deste build (para o painel do admin mostrar o que está ligado) */
export const GOOGLE_IDS = {
  ga: GA_ID,
  gtm: GTM_ID,
  searchConsole: process.env.NEXT_PUBLIC_GOOGLE_VERIFICACAO || DA_LOJA.searchConsole || "",
};

function gtag(...args: unknown[]) {
  const w = window as JanelaGoogle;
  w.dataLayer = w.dataLayer || [];
  // o gtag precisa do objeto "arguments" (é assim que o Google lê a fila)
  // eslint-disable-next-line prefer-rest-params
  w.dataLayer.push(arguments);
  void args;
}

function estados(c: Consentimento | null) {
  const sim = (v: boolean | undefined) => (v ? "granted" : "denied");
  return {
    analytics_storage: sim(c?.desempenho),
    ad_storage: sim(c?.marketing),
    ad_user_data: sim(c?.marketing),
    ad_personalization: sim(c?.marketing),
  };
}

function script(src: string) {
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

/** aplica a escolha de cookies: carrega o Google na 1ª permissão e atualiza o consentimento */
export function aplicarConsentimentoGoogle(c: Consentimento | null) {
  if (!googleConfigurado() || typeof window === "undefined") return;
  if (!carregado) {
    if (!c || (!c.desempenho && !c.marketing)) return; // sem permissão: nada do Google
    carregado = true;
    const w = window as JanelaGoogle;
    w.gtag = gtag;
    gtag("consent", "default", { ...estados(null), wait_for_update: 500 });
    gtag("consent", "update", estados(c));
    if (GA_ID) {
      script(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`);
      gtag("js", new Date());
      gtag("config", GA_ID);
    }
    if (GTM_ID) {
      w.dataLayer!.push({ "gtm.start": Date.now(), event: "gtm.js" });
      script(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`);
    }
    return;
  }
  gtag("consent", "update", estados(c));
}

const reais = (centavos: unknown) => (typeof centavos === "number" ? centavos / 100 : undefined);

/**
 * traduz os eventos da jornada para o e-commerce do GA4. item_id = SKU, o
 * mesmo id do feed do Merchant (/merchant/google.xml), para o Google Ads ligar
 * o anúncio ao produto.
 */
function paraGa4(evento: string, p: Record<string, unknown>): [string, Record<string, unknown>] | null {
  switch (evento) {
    case "produto_visto":
      return [
        "view_item",
        {
          currency: "BRL",
          value: reais(p.preco_centavos),
          items: [{ item_id: p.sku ?? p.produto, item_name: p.titulo, item_brand: p.marca, price: reais(p.preco_centavos) }],
        },
      ];
    case "adicionou_a_sacola": {
      const unit = reais(p.preco_centavos);
      const qtd = typeof p.quantidade === "number" ? p.quantidade : 1;
      return [
        "add_to_cart",
        { currency: "BRL", value: unit !== undefined ? unit * qtd : undefined, items: [{ item_id: p.sku ?? p.produto, item_group_id: p.produto, price: unit, quantity: qtd }] },
      ];
    }
    case "removeu_da_sacola":
      return ["remove_from_cart", { currency: "BRL", items: [{ item_id: p.sku }] }];
    case "busca":
      return ["search", { search_term: p.termo }];
    case "checkout_iniciado":
      return ["begin_checkout", { currency: "BRL", value: reais(p.subtotal_centavos) }];
    case "pedido_feito":
      return ["purchase", { transaction_id: p.pedido, currency: "BRL", value: reais(p.total_centavos), payment_type: p.meio }];
    default:
      return null;
  }
}

/** manda a etapa da compra ao Google (se ele já carregou com permissão) */
export function enviarAoGoogle(evento: string, props: Record<string, unknown>, consentimento: Consentimento) {
  // a página pode registrar antes do <Analytics /> montar: carrega aqui mesmo
  if (!carregado) aplicarConsentimentoGoogle(consentimento);
  if (!carregado) return;
  const ga = paraGa4(evento, props);
  if (!ga) return;
  const [nome, params] = ga;
  const w = window as JanelaGoogle;
  if (GA_ID) gtag("event", nome, params);
  if (GTM_ID) {
    w.dataLayer!.push({ ecommerce: null });
    w.dataLayer!.push({ event: nome, ecommerce: params });
  }
}
