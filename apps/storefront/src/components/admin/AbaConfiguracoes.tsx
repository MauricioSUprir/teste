"use client";

/** Aba Configurações — status das integrações e referências rápidas. */
import { ADMIN_EMAIL, GOOGLE_CLIENT_ID } from "@/lib/conta/config";
import { catalogoReal } from "@/lib/catalogo/consultas";
import { servidorConfigurado } from "@/lib/servidor";

interface Integracao {
  nome: string;
  descricao: string;
  ativa: boolean;
  pendencia: string;
}

export function AbaConfiguracoes() {
  const integracoes: Integracao[] = [
    {
      nome: "Catálogo Hub Suprir",
      descricao: "1.222 produtos reais com fotos, preços e estoque sincronizados.",
      ativa: catalogoReal,
      pendencia: "Liberar a rede do ambiente Claude (ou anexar export JSON/CSV) e rodar a sincronização.",
    },
    {
      nome: "Servidor BeautyNow",
      descricao: "Código de verificação por e-mail real e pedidos gravados no Hub.",
      ativa: servidorConfigurado(),
      pendencia: "Hospedar apps/servidor (Render ou VPS) e configurar NEXT_PUBLIC_SERVIDOR_URL no build.",
    },
    {
      nome: "Entrar com o Google",
      descricao: "Botão oficial do Google Identity Services.",
      ativa: GOOGLE_CLIENT_ID.length > 0,
      pendencia: "Criar o Client ID OAuth no Google Cloud e configurá-lo no site.",
    },
    {
      nome: "Mercado Pago",
      descricao: "Pix, cartão e boleto reais — o valor de cada venda cai na conta MP da loja.",
      ativa: false,
      pendencia: "Enviar o Access Token do painel de desenvolvedor do Mercado Pago.",
    },
    {
      nome: "Notificações de venda",
      descricao: "E-mail com a logo BeautyNow para o admin a cada pedido concluído.",
      ativa: false,
      pendencia: "Ativa junto com o servidor hospedado + senha de app do Gmail.",
    },
  ];

  return (
    <div className="max-w-3xl">
      <section className="rounded-[16px] border border-linha bg-white p-5">
        <h3 className="text-[0.9375rem] font-semibold text-tinta">Conta do administrador</h3>
        <p className="mt-2 text-[0.875rem] text-grafite">
          {ADMIN_EMAIL} · senha protegida por PBKDF2 · verificação em 2 etapas obrigatória
        </p>
      </section>

      <section className="mt-4 rounded-[16px] border border-linha bg-white p-5">
        <h3 className="text-[0.9375rem] font-semibold text-tinta">Integrações</h3>
        <ul className="mt-3 divide-y divide-linha">
          {integracoes.map((i) => (
            <li key={i.nome} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-[0.875rem] font-medium text-tinta">{i.nome}</p>
                <p className="mt-0.5 text-[0.8125rem] text-grafite">{i.descricao}</p>
                {!i.ativa && <p className="mt-1 text-[0.75rem] text-cinza">Para ativar: {i.pendencia}</p>}
              </div>
              <span
                className={`shrink-0 rounded-[999px] px-2.5 py-1 text-[0.6875rem] font-semibold ${
                  i.ativa ? "bg-[#E7F5EE] text-sucesso" : "bg-superficie text-cinza"
                }`}
              >
                {i.ativa ? "✓ Ativa" : "Pendente"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 rounded-[16px] border border-linha bg-white p-5">
        <h3 className="text-[0.9375rem] font-semibold text-tinta">Referências rápidas</h3>
        <ul className="mt-2 space-y-1.5 text-[0.8125rem] text-grafite">
          <li>• Regras comerciais: pedido mínimo R$ 99 · Pix -5% · até 6x sem juros · frete grátis ≥ R$ 199 · brinde ≥ R$ 250</li>
          <li>• Pendências e plano do projeto: arquivo <code className="rounded bg-superficie px-1">PENDENCIAS.md</code> no repositório</li>
          <li>• Dados desta demonstração ficam no navegador; com o servidor no ar, tudo passa a ser centralizado</li>
        </ul>
      </section>
    </div>
  );
}
