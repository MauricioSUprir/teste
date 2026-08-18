import type { Metadata } from "next";
import { Acordeao } from "@/components/produto/Acordeao";

export const metadata: Metadata = {
  title: "Central de atendimento",
  description: "Perguntas frequentes, trocas, rastreio e contato da BeautyNow.",
};

const faq: Array<{ pergunta: string; resposta: string }> = [
  {
    pergunta: "Os produtos são originais?",
    resposta:
      "Sim. A BeautyNow é distribuidora autorizada das marcas do catálogo há 15 anos: todo produto vem direto do fabricante, com nota fiscal.",
  },
  {
    pergunta: "Qual o prazo de envio?",
    resposta:
      "Pedidos com pagamento aprovado até 15h (dias úteis) são despachados no mesmo dia. Após o envio, você recebe o código de rastreio por e-mail e WhatsApp.",
  },
  {
    pergunta: "Como funciona o frete grátis?",
    resposta:
      "Compras a partir de R$ 199 têm frete grátis na entrega padrão para todo o Brasil. O valor restante para atingir o frete grátis aparece na barra da sua sacola.",
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
    resposta:
      "Pelo link de rastreio enviado por e-mail e WhatsApp, ou na área Minha conta. Qualquer dúvida, nossa equipe responde no WhatsApp em horário comercial.",
  },
];

export default function PaginaAtendimento() {
  return (
    <div className="container-bn max-w-3xl py-10">
      <h1 className="font-titulo text-[clamp(1.625rem,3.5vw,2.25rem)] font-semibold">
        Central de atendimento
      </h1>
      <p className="mt-2 text-[0.9375rem] text-grafite">
        Respostas rápidas para as dúvidas mais comuns. Não achou a sua? Fale com a gente.
      </p>

      <section aria-label="Perguntas frequentes" className="mt-8">
        {faq.map((item) => (
          <Acordeao key={item.pergunta} titulo={item.pergunta}>
            <p>{item.resposta}</p>
          </Acordeao>
        ))}
      </section>

      <section id="contato" className="mt-10 rounded-[16px] bg-superficie p-6">
        <h2 className="font-titulo text-[1.25rem] font-semibold">Fale com a gente</h2>
        <ul className="mt-3 space-y-2 text-[0.9375rem] text-grafite">
          <li>
            <strong>WhatsApp:</strong> <span className="num">(21) 99999-0000</span> — seg. a sex., 9h às 18h
          </li>
          <li>
            <strong>E-mail:</strong> atendimento@beautynow.com.br
          </li>
        </ul>
      </section>
    </div>
  );
}
