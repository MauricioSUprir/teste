import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { NossoTime } from "@/components/institucional/NossoTime";
import { LOJA } from "@/lib/loja";
import { NEGOCIO, enderecoEmLinha } from "@/lib/negocio";

/**
 * Páginas institucionais e legais (Sprint 7, ticket 7.1).
 * Os textos abaixo são os mesmos para as lojas do grupo, com nome, contato e
 * praça de cada uma preenchidos a partir de `lib/negocio`. Antes de campanhas
 * pagas, revisar juridicamente conforme docs/08-juridico-fiscal-lgpd.md.
 */
const contato = NEGOCIO.whatsappVisivel
  ? `pelo WhatsApp ${NEGOCIO.whatsappVisivel} ou por ${NEGOCIO.email}`
  : `por ${NEGOCIO.email}`;

const quemSomos = LOJA.b2b
  ? [
      `A ${LOJA.nome} é o braço de venda para empresas de uma operação com 15 anos de estrada na distribuição de cosméticos. ${NEGOCIO.regiao}.`,
      "Atendemos salões, clínicas, farmácias, lojas e redes: catálogo aberto para consulta, preço de distribuidor liberado assim que o CNPJ é aprovado, e nota fiscal em toda venda.",
      "Trabalhamos apenas com marcas das quais somos distribuidores autorizados — o produto sai do fabricante e chega no seu estoque sem intermediário desconhecido no meio do caminho.",
    ]
  : [
      `A ${LOJA.nome} nasceu de uma operação com 15 anos de mercado na distribuição de cosméticos profissionais. Depois de mais de uma década abastecendo salões e profissionais de beleza, trouxemos a mesma curadoria para quem cuida do cabelo e da pele em casa.`,
      "Trabalhamos apenas com marcas que conhecemos de perto, como distribuidores autorizados: cada produto vem direto do fabricante, com garantia de originalidade e nota fiscal.",
      "Nosso compromisso é simples: seleção intencional em vez de prateleira infinita, informação honesta em vez de promessa milagrosa, e atendimento de gente que entende do produto que vende.",
    ];

const paginas: Record<string, { titulo: string; paragrafos: string[] }> = {
  "quem-somos": {
    titulo: "Quem somos",
    paragrafos: [
      ...quemSomos,
      NEGOCIO.endereco
        ? `Você encontra a gente em ${enderecoEmLinha(NEGOCIO.endereco)}. Atendimento ${NEGOCIO.horario.toLowerCase()}.`
        : `Atendimento ${NEGOCIO.horario.toLowerCase()} — fale com a gente ${contato}.`,
    ],
  },
  "politica-de-privacidade": {
    titulo: "Política de privacidade",
    paragrafos: [
      `Esta política descreve como a ${LOJA.nome} trata seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).`,
      "Coletamos apenas os dados necessários para processar seu pedido (nome, CPF ou CNPJ, e-mail, telefone e endereço de entrega) e, com seu consentimento, para comunicações de marketing. Você pode revogar o consentimento a qualquer momento.",
      "Usamos cookies e ferramentas de medição de audiência para entender como o site é usado e melhorar a experiência. Esses dados são tratados de forma agregada e você pode bloqueá-los nas configurações do seu navegador.",
      "Não vendemos nem compartilhamos seus dados com terceiros, exceto os operadores estritamente necessários à operação: meios de pagamento, transportadoras e emissão de nota fiscal.",
      `Para exercer seus direitos de titular (acesso, correção, exclusão, portabilidade), escreva para ${NEGOCIO.email}. Respondemos dentro dos prazos da LGPD.`,
    ],
  },
  "termos-de-uso": {
    titulo: "Termos de uso",
    paragrafos: [
      `Ao utilizar o site da ${LOJA.nome} você concorda com estes termos, com a legislação brasileira aplicável ao comércio eletrônico (Decreto nº 7.962/2013) e com o Código de Defesa do Consumidor.`,
      "Os preços e condições promocionais são válidos enquanto exibidos no site. Boleto somente à vista; cartão em até 6x sem juros; Pix com 5% de desconto.",
      "As imagens são ilustrativas e as embalagens podem variar conforme o lote do fabricante. Informações de uso e composição seguem o que consta na embalagem do produto.",
      "Em caso de divergência de estoque, o pedido pode ser cancelado com reembolso integral e comunicação imediata.",
      `Dúvidas sobre estes termos: fale com a gente ${contato}.`,
    ],
  },
  "politica-de-entrega": {
    titulo: "Política de entrega",
    paragrafos: [
      "Pedidos aprovados até 15h em dias úteis são despachados no mesmo dia. Os prazos exibidos no checkout contam a partir do despacho.",
      "A entrega é feita por transportadoras parceiras e Correios, com rastreio ponta a ponta. O código de rastreio é enviado assim que o pedido é despachado.",
      "Se a entrega falhar por endereço incorreto ou ausência de recebedor após duas tentativas, o pedido retorna ao nosso centro de distribuição e nossa equipe entra em contato.",
      `Precisa de uma entrega com urgência ou combinada? Fale com a gente ${contato}.`,
    ],
  },
  "trocas-e-devolucoes": {
    titulo: "Trocas e devoluções",
    paragrafos: [
      "Direito de arrependimento: você pode desistir da compra em até 7 dias corridos após o recebimento (CDC, art. 49), com reembolso integral, inclusive do frete. O produto deve estar sem uso e na embalagem original.",
      "Produto com defeito ou avaria de transporte: comunique em até 30 dias e faremos a troca ou o reembolso, com frete de retorno por nossa conta.",
      `Para iniciar qualquer troca, fale com a gente ${contato} informando o número do pedido.`,
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(paginas).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const pagina = paginas[slug];
  if (!pagina) return {};
  // título único e descrição própria em cada página (o resumo que aparece no Google)
  return {
    title: pagina.titulo,
    description: `${pagina.titulo} da ${LOJA.nome}. ${pagina.paragrafos[0].slice(0, 120)}…`,
  };
}

export default async function PaginaInstitucional({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pagina = paginas[slug];
  if (!pagina) notFound();

  return (
    <div className="container-bn max-w-3xl py-6">
      <Breadcrumb itens={[{ rotulo: pagina.titulo }]} />
      <h1 className="font-titulo mt-2 text-[clamp(1.625rem,3.5vw,2.25rem)] font-semibold">
        {pagina.titulo}
      </h1>
      <div className="mt-6 space-y-4">
        {pagina.paragrafos.map((p) => (
          <p key={p.slice(0, 40)} className="text-[0.9375rem] leading-relaxed text-grafite">
            {p}
          </p>
        ))}
      </div>
      {slug === "quem-somos" && <NossoTime />}
    </div>
  );
}
