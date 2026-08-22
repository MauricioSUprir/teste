import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
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

const tituloLoja =
  LOJA.b2b
    ? "Be2Beauty — O e-commerce do cabeleireiro"
    : "BeautyNow — Cosméticos profissionais com curadoria";
const descricaoLoja = LOJA.b2b
  ? "Distribuidora de cosméticos para profissionais e revenda. Cadastre o CNPJ do seu salão ou loja e acesse a tabela de preços exclusiva."
  : "Haircare profissional, perfumaria e cuidado pessoal com curadoria de quem distribui há 15 anos. Pix com 5% de desconto e envio em até 24h.";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.beautynowstore.com.br/"),
  title: {
    default: tituloLoja,
    template: `%s | ${LOJA.nome}`,
  },
  description: descricaoLoja,
  // ícone para favoritos e "adicionar à tela de início" no celular — cada
  // loja com a própria logo (os arquivos -b2b são a identidade Be2Beauty)
  icons: LOJA.b2b
    ? {
        icon: [
          { url: "icone-b2b-192.png", sizes: "192x192", type: "image/png" },
          { url: "icone-b2b-512.png", sizes: "512x512", type: "image/png" },
        ],
        apple: "apple-touch-icon-b2b.png",
      }
    : {
        icon: [
          { url: "icone-192.png", sizes: "192x192", type: "image/png" },
          { url: "icone-512.png", sizes: "512x512", type: "image/png" },
        ],
        apple: "apple-touch-icon.png",
      },
  manifest: LOJA.b2b ? "manifest-b2b.webmanifest" : "manifest.webmanifest",
  // prévia com imagem ao compartilhar o link (WhatsApp, Instagram, etc.)
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "https://www.beautynowstore.com.br/",
    siteName: LOJA.nome,
    title: tituloLoja,
    description: LOJA.b2b
      ? "Venda exclusiva para profissionais — cadastre seu CNPJ e veja os preços."
      : "Pix com 5% de desconto · Envio em até 24h · Produtos 100% originais.",
    images: [
      {
        url: LOJA.b2b ? "og-imagem-b2b.png" : "og-imagem.png",
        width: 1200,
        height: 630,
        alt: LOJA.nome,
      },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-loja={LOJA_ID} className={`${inter.variable} ${fraunces.variable}`}>
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
