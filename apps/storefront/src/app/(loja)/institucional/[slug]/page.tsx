import { notFound } from "next/navigation";
import type { Metadata } from "next";

/**
 * Páginas legais — estrutura do Sprint 7 (ticket 7.1).
 * Os textos abaixo são rascunhos de demonstração: antes do go-live devem ser
 * substituídos pelos textos finais de docs/08-juridico-fiscal-lgpd.md,
 * revisados juridicamente. O site não sobe para produção sem isso (CLAUDE.md §6).
 */
const paginas: Record<string, { titulo: string; paragrafos: string[] }> = {
  "quem-somos": {
    titulo: "Quem somos",
    paragrafos: [
      "A BeautyNow nasceu de uma operação com 15 anos de mercado na distribuição de cosméticos profissionais no Rio de Janeiro e Espírito Santo. Depois de mais de uma década abastecendo salões e profissionais de beleza, trouxemos a mesma curadoria para quem cuida do cabelo e da pele em casa.",
      "Trabalhamos apenas com marcas que conhecemos de perto, como distribuidores autorizados: cada produto vem direto do fabricante, com garantia de originalidade e nota fiscal.",
      "Nosso compromisso é simples: seleção intencional em vez de prateleira infinita, informação honesta em vez de promessa milagrosa, e atendimento de gente que entende do produto que vende.",
    ],
  },
  "politica-de-privacidade": {
    titulo: "Política de privacidade",
    paragrafos: [
      "Esta política descreve como a BeautyNow trata seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).",
      "Coletamos apenas os dados necessários para processar seu pedido (nome, CPF, e-mail, telefone e endereço de entrega) e, com seu consentimento, para comunicações de marketing. Você pode revogar o consentimento a qualquer momento.",
      "Não vendemos nem compartilhamos seus dados com terceiros, exceto os operadores estritamente necessários à operação: meios de pagamento, transportadoras e emissão de nota fiscal.",
      "Para exercer seus direitos de titular (acesso, correção, exclusão, portabilidade), escreva para privacidade@beautynow.com.br.",
      "Texto de demonstração — versão final conforme docs/08-juridico-fiscal-lgpd.md antes do lançamento.",
    ],
  },
  "termos-de-uso": {
    titulo: "Termos de uso",
    paragrafos: [
      "Ao utilizar o site da BeautyNow você concorda com estes termos, com a legislação brasileira aplicável ao comércio eletrônico (Decreto nº 7.962/2013) e com o Código de Defesa do Consumidor.",
      "Os preços e condições promocionais são válidos enquanto exibidos no site. O pedido mínimo é de R$ 99. Boleto somente à vista; cartão em até 6x sem juros; Pix com 5% de desconto.",
      "Em caso de divergência de estoque, o pedido pode ser cancelado com reembolso integral e comunicação imediata.",
      "Texto de demonstração — versão final conforme docs/08-juridico-fiscal-lgpd.md antes do lançamento.",
    ],
  },
  "politica-de-entrega": {
    titulo: "Política de entrega",
    paragrafos: [
      "Pedidos aprovados até 15h em dias úteis são despachados no mesmo dia. Os prazos exibidos no checkout contam a partir do despacho.",
      "No Rio de Janeiro (capital), oferecemos entrega expressa por motoboy no dia útil seguinte. Para o restante do Brasil, a entrega é feita por transportadoras parceiras com rastreio ponta a ponta.",
      "Se a entrega falhar por endereço incorreto ou ausência de recebedor após duas tentativas, o pedido retorna ao nosso centro de distribuição e nossa equipe entra em contato.",
    ],
  },
  "trocas-e-devolucoes": {
    titulo: "Trocas e devoluções",
    paragrafos: [
      "Direito de arrependimento: você pode desistir da compra em até 7 dias corridos após o recebimento (CDC, art. 49), com reembolso integral, inclusive do frete. O produto deve estar sem uso e na embalagem original.",
      "Produto com defeito ou avaria de transporte: comunique em até 30 dias e faremos a troca ou o reembolso, com frete de retorno por nossa conta.",
      "Para iniciar qualquer troca, fale com nosso atendimento pelo WhatsApp (21) 99732-2464 ou por atendimento@beautynow.com.br informando o número do pedido.",
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
  return { title: pagina.titulo };
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
    <div className="container-bn max-w-3xl py-10">
      <h1 className="font-titulo text-[clamp(1.625rem,3.5vw,2.25rem)] font-semibold">
        {pagina.titulo}
      </h1>
      <div className="mt-6 space-y-4">
        {pagina.paragrafos.map((p) => (
          <p key={p.slice(0, 40)} className="text-[0.9375rem] leading-relaxed text-grafite">
            {p}
          </p>
        ))}
      </div>
    </div>
  );
}
