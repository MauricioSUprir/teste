import { LOJA } from "@/lib/loja";
import { NEGOCIO } from "@/lib/negocio";
import { copy } from "@/lib/copy";

/**
 * Marcação de negócio para os buscadores (JSON-LD), presente em todas as
 * páginas. Quando há endereço público, sobe como negócio local (LocalBusiness),
 * que é o que faz a loja aparecer no mapa e no painel lateral do Google;
 * sem endereço confirmado, sobe como organização — nunca com endereço chutado.
 */
export function DadosDoNegocio() {
  const e = NEGOCIO.endereco;
  const dados = {
    "@context": "https://schema.org",
    "@type": e ? "HealthAndBeautyBusiness" : "Organization",
    "@id": `${NEGOCIO.site}/#negocio`,
    name: LOJA.nome,
    legalName: NEGOCIO.nomeLegal,
    description: copy.marca.slogan,
    url: `${NEGOCIO.site}/`,
    email: NEGOCIO.email,
    ...(NEGOCIO.whatsappVisivel ? { telephone: `+55${NEGOCIO.whatsapp?.slice(2)}` } : {}),
    ...(NEGOCIO.cnpj ? { taxID: NEGOCIO.cnpj } : {}),
    ...(NEGOCIO.instagram ? { sameAs: [NEGOCIO.instagram] } : {}),
    ...(e
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: e.rua,
            addressLocality: `${e.bairro}, ${e.cidade}`,
            addressRegion: e.uf,
            postalCode: e.cep,
            addressCountry: "BR",
          },
          openingHours: "Mo-Fr 09:00-18:00",
        }
      : {}),
    ...(NEGOCIO.whatsappVisivel
      ? {
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "customer service",
            telephone: `+55${NEGOCIO.whatsapp?.slice(2)}`,
            email: NEGOCIO.email,
            availableLanguage: "Portuguese",
          },
        }
      : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(dados) }}
    />
  );
}
