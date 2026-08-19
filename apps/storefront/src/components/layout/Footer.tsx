import Link from "next/link";
import { copy } from "@/lib/copy";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-linha bg-superficie">
      <div className="container-bn grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo altura={24} />
          <p className="mt-3 max-w-[28ch] text-[0.875rem] leading-relaxed text-grafite">
            {copy.marca.slogan}
          </p>
          <p className="mt-4 text-[0.75rem] leading-relaxed text-cinza">
            {copy.rodape.cnpj}
            <br />
            {copy.rodape.endereco}
          </p>
        </div>

        <nav aria-label={copy.rodape.institucional}>
          <p className="text-[0.8125rem] font-semibold uppercase tracking-wide text-tinta">
            {copy.rodape.institucional}
          </p>
          <ul className="mt-3 space-y-2 text-[0.875rem]">
            <li><Link className="text-grafite hover:text-roxo" href="/institucional/quem-somos">{copy.rodape.quemSomos}</Link></li>
            <li><Link className="text-grafite hover:text-roxo" href="/institucional/politica-de-privacidade">{copy.rodape.politicaPrivacidade}</Link></li>
            <li><Link className="text-grafite hover:text-roxo" href="/institucional/termos-de-uso">{copy.rodape.termosUso}</Link></li>
            <li><Link className="text-grafite hover:text-roxo" href="/institucional/politica-de-entrega">{copy.rodape.politicaEntrega}</Link></li>
            <li><Link className="text-grafite hover:text-roxo" href="/institucional/trocas-e-devolucoes">{copy.rodape.trocasDevolucoes}</Link></li>
          </ul>
        </nav>

        <nav aria-label={copy.rodape.ajuda}>
          <p className="text-[0.8125rem] font-semibold uppercase tracking-wide text-tinta">
            {copy.rodape.ajuda}
          </p>
          <ul className="mt-3 space-y-2 text-[0.875rem]">
            <li><Link className="text-grafite hover:text-roxo" href="/atendimento">{copy.rodape.faq}</Link></li>
            <li><Link className="text-grafite hover:text-roxo" href="/atendimento#contato">{copy.rodape.contato}</Link></li>
            <li><Link className="text-grafite hover:text-roxo" href="/conta">{copy.rodape.rastrearPedido}</Link></li>
          </ul>
        </nav>

        <div>
          <p className="text-[0.8125rem] font-semibold uppercase tracking-wide text-tinta">
            {copy.rodape.pagamento}
          </p>
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Meios de pagamento aceitos">
            {["Pix", "Visa", "Master", "Elo", "Boleto"].map((meio) => (
              <li
                key={meio}
                className="rounded-[6px] border border-linha bg-white px-2.5 py-1 text-[0.75rem] font-medium text-grafite"
              >
                {meio}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-[0.8125rem] font-semibold uppercase tracking-wide text-tinta">
            {copy.rodape.seguranca}
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            <li className="rounded-[6px] border border-linha bg-white px-2.5 py-1 text-[0.75rem] font-medium text-grafite">
              🔒 SSL
            </li>
            <li className="rounded-[6px] border border-linha bg-white px-2.5 py-1 text-[0.75rem] font-medium text-grafite">
              ✓ {copy.pdp.distribuidorAutorizado}
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-linha py-4">
        <p className="container-bn text-[0.75rem] text-cinza">{copy.rodape.direitos}</p>
      </div>
    </footer>
  );
}
