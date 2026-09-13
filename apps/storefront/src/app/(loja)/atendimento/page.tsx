import type { Metadata } from "next";
import { BuscaFaq } from "@/components/atendimento/BuscaFaq";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { MapaERotas } from "@/components/atendimento/MapaERotas";
import { LOJA } from "@/lib/loja";
import { NEGOCIO, linkWhatsapp } from "@/lib/negocio";

export const metadata: Metadata = {
  title: "Central de atendimento",
  description: `Perguntas frequentes, trocas, rastreio e contato da ${LOJA.nome}. ${NEGOCIO.promessaResposta}`,
};

/** As respostas mudam conforme a loja: varejo fala de Pix e troca, as lojas
 *  de venda profissional falam de CNPJ e tabela liberada. */
const faq: Array<{ pergunta: string; resposta: string }> = LOJA.b2b
  ? [
      {
        pergunta: "Quem pode comprar aqui?",
        resposta: `A ${LOJA.nome} vende para empresas: basta ter CNPJ ativo. Cadastre o CNPJ em "Cadastro de lojista", e assim que a gente aprovar os preços e a compra ficam liberados no seu navegador.`,
      },
      {
        pergunta: "Quanto tempo leva para aprovar meu cadastro?",
        resposta: `Conferimos os dados em horário comercial (${NEGOCIO.horario}). ${NEGOCIO.promessaResposta} Assim que aprovar, você recebe um aviso por e-mail.`,
      },
      {
        pergunta: "Os produtos são originais e com nota fiscal?",
        resposta:
          "Sim. Trabalhamos como distribuidores autorizados das marcas do catálogo: todo produto vem direto do fabricante e toda venda sai com nota fiscal.",
      },
      {
        pergunta: "Quais formas de pagamento vocês aceitam?",
        resposta:
          "Pix (com 5% de desconto), cartão de crédito em até 6x sem juros e boleto à vista. Condições especiais de volume são combinadas com a nossa equipe.",
      },
      {
        pergunta: "Como acompanho meu pedido?",
        resposta:
          "Pelo link de rastreio enviado por e-mail, ou na área Minha conta. Qualquer dúvida, fale com a gente pelos contatos abaixo.",
      },
    ]
  : [
      {
        pergunta: "Os produtos são originais?",
        resposta: `Sim. A ${LOJA.nome} trabalha como distribuidora autorizada das marcas do catálogo: todo produto vem direto do fabricante, com nota fiscal.`,
      },
      {
        pergunta: "Qual o prazo de envio?",
        resposta:
          "Pedidos com pagamento aprovado até 15h (dias úteis) são despachados no mesmo dia. Após o envio, você recebe o código de rastreio por e-mail e WhatsApp.",
      },
      {
        pergunta: "Posso trocar ou devolver um produto?",
        resposta:
          "Sim. Você tem 7 dias corridos após o recebimento para desistir da compra (CDC, art. 49), com reembolso integral. Produtos com defeito têm prazo de 30 dias. Fale com a gente pelo WhatsApp para iniciar a troca.",
      },
      {
        pergunta: "Quais formas de pagamento vocês aceitam?",
        resposta:
          "Pix (com 5% de desconto), cartão de crédito em até 6x sem juros e boleto à vista. O pedido mínimo é de R$ 99.",
      },
      {
        pergunta: "Como acompanho meu pedido?",
        resposta: `Pelo link de rastreio enviado por e-mail e WhatsApp, ou na área Minha conta. Qualquer dúvida, nossa equipe responde em horário comercial (${NEGOCIO.horario}).`,
      },
    ];

export default function PaginaAtendimento() {
  // marcação de perguntas frequentes: o Google pode exibir as respostas
  // direto no resultado de busca
  const jsonLdFaq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.pergunta,
      acceptedAnswer: { "@type": "Answer", text: item.resposta },
    })),
  };

  return (
    <div className="container-bn max-w-3xl py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }}
      />
      <Breadcrumb itens={[{ rotulo: "Central de atendimento" }]} />
      <h1 className="font-titulo mt-2 text-[clamp(1.625rem,3.5vw,2.25rem)] font-semibold">
        Central de atendimento
      </h1>
      <p className="mt-2 text-[0.9375rem] text-grafite">
        Respostas rápidas para as dúvidas mais comuns. Não achou a sua? Fale com a gente.
      </p>
      {/* promessa de resposta — a pessoa sabe quanto tempo vai esperar */}
      <p className="mt-3 inline-flex items-center gap-2 rounded-[6px] bg-roxo-claro px-3 py-2 text-[0.875rem] font-medium text-roxo-escuro">
        <span aria-hidden="true">⏱</span>
        {NEGOCIO.promessaResposta}
      </p>

      <section aria-label="Perguntas frequentes" className="mt-8">
        <BuscaFaq itens={faq} />
      </section>

      <section id="contato" className="mt-10 rounded-[16px] bg-superficie p-6">
        <h2 className="font-titulo text-[1.25rem] font-semibold">Fale com a gente</h2>
        <ul className="mt-3 space-y-2 text-[0.9375rem] text-grafite">
          {NEGOCIO.whatsapp && NEGOCIO.whatsappVisivel && (
            <li>
              <strong>WhatsApp:</strong>{" "}
              <a
                href={linkWhatsapp(NEGOCIO.whatsapp, `Olá! Vim pelo site da ${LOJA.nome}.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="num font-semibold text-roxo underline"
              >
                {NEGOCIO.whatsappVisivel}
              </a>{" "}
              — {NEGOCIO.horario}
            </li>
          )}
          <li>
            <strong>E-mail:</strong>{" "}
            <a href={`mailto:${NEGOCIO.email}`} className="text-roxo underline">
              {NEGOCIO.email}
            </a>
          </li>
          <li>
            <strong>Atendimento:</strong> {NEGOCIO.regiao}
          </li>
        </ul>
      </section>

      <MapaERotas />
    </div>
  );
}
