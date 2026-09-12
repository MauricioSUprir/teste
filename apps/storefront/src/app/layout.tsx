import type { Metadata } from "next";
import { Archivo, Fraunces, Inter } from "next/font/google";
import { B2BProvider } from "@/lib/b2b/contexto";
import { CarrinhoProvider } from "@/lib/carrinho/contexto";
import { ContaProvider } from "@/lib/conta/contexto";
import { FavoritosProvider } from "@/lib/favoritos/contexto";
import { LOJA, LOJA_ID } from "@/lib/loja";
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
});

const tituloLoja =
  LOJA_ID === "be2beauty"
    ? "Be2Beauty — O e-commerce do cabeleireiro"
    : LOJA_ID === "pulse"
      ? "Pulse Beauty Store — Cuidado no ritmo certo"
      : "BeautyNow — Cosméticos profissionais com curadoria";
const descricaoLoja = LOJA.b2b
  ? "Distribuidora de cosméticos para profissionais e revenda. Cadastre o CNPJ do seu salão ou loja e acesse a tabela de preços exclusiva."
  : LOJA_ID === "pulse"
    ? "O encontro entre beleza, bem-estar e performance: haircare, perfumaria e cuidado pessoal para o seu ritmo. Pix com 5% de desconto."
    : "Haircare profissional, perfumaria e cuidado pessoal com curadoria de quem distribui há 15 anos. Pix com 5% de desconto.";

// cada loja tem o próprio domínio (o /pro do beautynowstore vira só um espelho;
// a PULSE começa no endereço provisório do GitHub até o domínio próprio chegar)
const dominioLoja =
  LOJA_ID === "be2beauty"
    ? "https://www.be2beauty.com.br/"
    : LOJA_ID === "pulse"
      ? "https://mauriciosuprir.github.io/pulse/"
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
            { url: "icone-b2b-192.png", sizes: "192x192", type: "image/png" },
            { url: "icone-b2b-512.png", sizes: "512x512", type: "image/png" },
          ],
          apple: "apple-touch-icon-b2b.png",
        }
      : LOJA_ID === "pulse"
        ? {
            icon: [
              { url: "icone-pulse-192.png", sizes: "192x192", type: "image/png" },
              { url: "icone-pulse-512.png", sizes: "512x512", type: "image/png" },
            ],
            apple: "apple-touch-icon-pulse.png",
          }
        : {
            icon: [
              { url: "icone-192.png", sizes: "192x192", type: "image/png" },
              { url: "icone-512.png", sizes: "512x512", type: "image/png" },
            ],
            apple: "apple-touch-icon.png",
          },
  manifest:
    LOJA_ID === "be2beauty"
      ? "manifest-b2b.webmanifest"
      : LOJA_ID === "pulse"
        ? "manifest-pulse.webmanifest"
        : "manifest.webmanifest",
  // prévia com imagem ao compartilhar o link (WhatsApp, Instagram, etc.)
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: dominioLoja,
    siteName: LOJA.nome,
    title: tituloLoja,
    description: LOJA.b2b
      ? "Venda exclusiva para profissionais — cadastre seu CNPJ e veja os preços."
      : "Pix com 5% de desconto · Produtos 100% originais.",
    images: [
      {
        url:
          LOJA_ID === "be2beauty"
            ? "og-imagem-b2b.png"
            : LOJA_ID === "pulse"
              ? "og-imagem-pulse.png"
              : "og-imagem.png",
        width: 1200,
        height: 630,
        alt: LOJA.nome,
      },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      data-loja={LOJA_ID}
      className={`${inter.variable} ${fraunces.variable} ${archivo.variable}`}
    >
      <body>
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
