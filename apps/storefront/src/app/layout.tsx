import type { Metadata } from "next";
import { Archivo, Fraunces, Inter, Michroma, Saira } from "next/font/google";
import { B2BProvider } from "@/lib/b2b/contexto";
import { CarrinhoProvider } from "@/lib/carrinho/contexto";
import { ContaProvider } from "@/lib/conta/contexto";
import { FavoritosProvider } from "@/lib/favoritos/contexto";
import { LOJA, LOJA_ID } from "@/lib/loja";
import { Analytics } from "@/components/layout/Analytics";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

// fonte display da PULSE (geométrica, minimalista) — as outras lojas não a usam
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-archivo",
  display: "swap",
  // só a loja dona dessa fonte a usa: sem preload nas outras
  preload: false,
});

// fonte display da BRADECO — larga, geométrica e técnica, como o logo da
// distribuidora; serve também para os preços
const saira = Saira({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-saira",
  display: "swap",
  // só a loja dona dessa fonte a usa: sem preload nas outras
  preload: false,
});

// fonte do logo da BRADECO: larga e quadrada, como o wordmark da marca
const michroma = Michroma({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-michroma",
  display: "swap",
  // só a loja dona dessa fonte a usa: sem preload nas outras
  preload: false,
});

// O site pode ser servido num subcaminho (/pro, /pulse, /bradeco). Caminho
// relativo em ícone e manifest faz o navegador procurar o arquivo DENTRO da
// pasta da página aberta (/categoria/cabelos/icone-192.png → 404), então todos
// levam o prefixo na frente.
const prefixo = process.env.BASE_PATH ?? "";

const tituloLoja =
  LOJA_ID === "be2beauty"
    ? "Be2Beauty: o e-commerce do cabeleireiro"
    : LOJA_ID === "pulse"
      ? "Pulse Beauty Store: cuidado no ritmo certo"
      : LOJA_ID === "bradeco"
        ? "Bradeco Distribuidora: elo entre indústria e varejo"
        : "BeautyNow: cosméticos profissionais com curadoria";
const descricaoLoja =
  LOJA_ID === "bradeco"
    ? "Distribuição, consultoria e representação de cosméticos em todo o estado de SP. Cadastre o CNPJ da sua loja e acesse a tabela de preços de distribuidora."
    : LOJA.b2b
      ? "Distribuidora de cosméticos para profissionais e revenda. Cadastre o CNPJ do seu salão ou loja e acesse a tabela de preços exclusiva."
      : LOJA_ID === "pulse"
        ? "O encontro entre beleza, bem-estar e performance. Produtos de cabelo, perfumaria e cuidado pessoal para usar depois do treino. Pix com 5% de desconto."
        : "Haircare profissional, perfumaria e cuidado pessoal com curadoria de quem distribui há 15 anos. Pix com 5% de desconto.";

// cada loja tem o próprio domínio (o /pro do beautynowstore vira só um espelho;
// a PULSE começa provisoriamente em beautynowstore.com.br/pulse até o domínio
// próprio chegar)
const dominioLoja =
  LOJA_ID === "be2beauty"
    ? "https://www.be2beauty.com.br/"
    : LOJA_ID === "pulse"
      ? "https://www.beautynowstore.com.br/pulse/"
      : LOJA_ID === "bradeco"
        ? "https://www.beautynowstore.com.br/bradeco/"
        : "https://www.beautynowstore.com.br/";

export const metadata: Metadata = {
  metadataBase: new URL(dominioLoja),
  title: {
    default: tituloLoja,
    template: `%s | ${LOJA.nome}`,
  },
  description: descricaoLoja,
  // ícone para favoritos e "adicionar à tela de início" no celular — cada
  // loja com a própria logo (os arquivos -b2b são a identidade Be2Beauty)
  icons:
    LOJA_ID === "be2beauty"
      ? {
          icon: [
            { url: `${prefixo}/icone-b2b-192.png`, sizes: "192x192", type: "image/png" },
            { url: `${prefixo}/icone-b2b-512.png`, sizes: "512x512", type: "image/png" },
          ],
          apple: `${prefixo}/apple-touch-icon-b2b.png`,
        }
      : LOJA_ID === "pulse"
        ? {
            icon: [
              { url: `${prefixo}/icone-pulse-192.png`, sizes: "192x192", type: "image/png" },
              { url: `${prefixo}/icone-pulse-512.png`, sizes: "512x512", type: "image/png" },
            ],
            apple: `${prefixo}/apple-touch-icon-pulse.png`,
          }
        : LOJA_ID === "bradeco"
          ? {
              icon: [
                { url: `${prefixo}/icone-bradeco-192.png`, sizes: "192x192", type: "image/png" },
                { url: `${prefixo}/icone-bradeco-512.png`, sizes: "512x512", type: "image/png" },
              ],
              apple: `${prefixo}/apple-touch-icon-bradeco.png`,
            }
          : {
              icon: [
                { url: `${prefixo}/icone-192.png`, sizes: "192x192", type: "image/png" },
                { url: `${prefixo}/icone-512.png`, sizes: "512x512", type: "image/png" },
              ],
              apple: `${prefixo}/apple-touch-icon.png`,
            },
  manifest:
    LOJA_ID === "be2beauty"
      ? `${prefixo}/manifest-b2b.webmanifest`
      : LOJA_ID === "pulse"
        ? `${prefixo}/manifest-pulse.webmanifest`
        : LOJA_ID === "bradeco"
          ? `${prefixo}/manifest-bradeco.webmanifest`
          : `${prefixo}/manifest.webmanifest`,
  // prévia com imagem ao compartilhar o link (WhatsApp, Instagram, etc.)
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: dominioLoja,
    siteName: LOJA.nome,
    title: tituloLoja,
    description:
      LOJA_ID === "bradeco"
        ? "Distribuição, consultoria e representação. Cadastre o CNPJ e veja os preços."
        : LOJA.b2b
          ? "Venda exclusiva para profissionais. Cadastre seu CNPJ e veja os preços."
          : "Pix com 5% de desconto · Produtos 100% originais.",
    images: [
      {
        url:
          LOJA_ID === "be2beauty"
            ? "og-imagem-b2b.png"
            : LOJA_ID === "pulse"
              ? "og-imagem-pulse.png"
              : LOJA_ID === "bradeco"
                ? "og-imagem-bradeco.png"
                : "og-imagem.png",
        width: 1200,
        height: 630,
        alt: LOJA.nome,
      },
    ],
  },
};

/**
 * Hosts de onde vêm as fotos de produto e os dados ao vivo (banners, preços).
 * Avisar o navegador cedo economiza o DNS + TLS na hora de buscar a primeira
 * foto, que é justamente o que o Google cronometra na primeira dobra.
 */
const HOSTS_EXTERNOS = [
  "https://comercial.thebeautyhub.app",
  process.env.NEXT_PUBLIC_SERVIDOR_URL,
].filter((h): h is string => Boolean(h));

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      data-loja={LOJA_ID}
      className={`${inter.variable} ${fraunces.variable} ${archivo.variable} ${saira.variable} ${michroma.variable}`}
    >
      <body>
        {HOSTS_EXTERNOS.map((host) => (
          <link key={host} rel="preconnect" href={host} crossOrigin="" />
        ))}
        <Analytics />
        <ContaProvider>
          <B2BProvider>
            <FavoritosProvider>
              <CarrinhoProvider>{children}</CarrinhoProvider>
            </FavoritosProvider>
          </B2BProvider>
        </ContaProvider>
      </body>
    </html>
  );
}
