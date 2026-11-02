/**
 * Feed de produtos do Google Merchant Center (Google Shopping), gerado no
 * build de cada loja: /merchant/google.xml.
 *
 * No Merchant Center: Produtos → Feeds → adicionar "Busca programada" com
 * este endereço (atualização diária). Preço e estoque são os do catálogo
 * publicado (o robô diário republica o site com o Hub).
 * Be2Beauty (preço só para CNPJ aprovado) sai sem produtos: não dá para
 * anunciar preço que o site não mostra.
 */
import { obterCategoria, obterMarca, produtos } from "@/lib/catalogo/consultas";
import { LOJA, LOJA_ID } from "@/lib/loja";
import { parcelamento } from "@/lib/preco";

export const dynamic = "force-static";

const BASE =
  LOJA_ID === "be2beauty"
    ? "https://www.be2beauty.com.br"
    : LOJA_ID === "pulse"
      ? "https://www.beautynowstore.com.br/pulse"
      : LOJA_ID === "bradeco"
        ? "https://www.beautynowstore.com.br/bradeco"
        : "https://www.beautynowstore.com.br";

const xml = (s: string) =>
  s
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** centavos → "29.90 BRL" (formato do Merchant) */
const preco = (centavos: number) => `${(centavos / 100).toFixed(2)} BRL`;

const gtinValido = (v: unknown) => typeof v === "string" && /^(\d{8}|\d{12,14})$/.test(v.trim());

export function GET() {
  const itens = LOJA.precoFechado
    ? []
    : produtos.flatMap((p) => {
        const marca = obterMarca(p.marca)?.nome ?? p.marca;
        const categoria = obterCategoria(p.categorias[0])?.nome;
        const ean = p.especificacoes?.EAN;
        const imagens = p.imagens ?? [];
        const varias = p.variantes.length > 1;
        return p.variantes
          .filter((v) => v.precoPor > 0 && imagens.length > 0)
          .map((v) => {
            const cheio = v.precoDe && v.precoDe > v.precoPor ? v.precoDe : v.precoPor;
            const titulo = varias && v.tituloVariacao !== "Único" ? `${p.titulo} - ${v.tituloVariacao}` : p.titulo;
            return [
              "<item>",
              `<g:id>${xml(v.sku)}</g:id>`,
              varias ? `<g:item_group_id>${xml(p.slug)}</g:item_group_id>` : "",
              `<title>${xml(titulo).slice(0, 150)}</title>`,
              `<description>${xml(p.descricao || p.titulo).slice(0, 4900)}</description>`,
              `<link>${BASE}/produto/${p.slug}/</link>`,
              `<g:image_link>${xml(imagens[0])}</g:image_link>`,
              ...imagens.slice(1, 6).map((i) => `<g:additional_image_link>${xml(i)}</g:additional_image_link>`),
              `<g:availability>${v.estoque > 0 ? "in_stock" : "out_of_stock"}</g:availability>`,
              `<g:price>${preco(cheio)}</g:price>`,
              cheio !== v.precoPor ? `<g:sale_price>${preco(v.precoPor)}</g:sale_price>` : "",
              // cartão em até 6x sem juros (mesma regra da página do produto)
              parcelamento(v.precoPor).vezes > 1
                ? `<g:installment><g:months>${parcelamento(v.precoPor).vezes}</g:months><g:amount>${preco(parcelamento(v.precoPor).valor)}</g:amount></g:installment>`
                : "",
              `<g:brand>${xml(marca)}</g:brand>`,
              gtinValido(ean) ? `<g:gtin>${String(ean).trim()}</g:gtin>` : `<g:mpn>${xml(v.sku)}</g:mpn>`,
              "<g:condition>new</g:condition>",
              categoria ? `<g:product_type>${xml(categoria)}</g:product_type>` : "",
              v.pesoG ? `<g:shipping_weight>${v.pesoG} g</g:shipping_weight>` : "",
              "</item>",
            ]
              .filter(Boolean)
              .join("");
          });
      });

  const corpo = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>${xml(LOJA.nome)}</title>
<link>${BASE}/</link>
<description>${xml(`Produtos da ${LOJA.nome}`)}</description>
${itens.join("\n")}
</channel>
</rss>
`;
  return new Response(corpo, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
