import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { CarrinhoProvider } from "@/lib/carrinho/contexto";
import { ContaProvider } from "@/lib/conta/contexto";
import { FavoritosProvider } from "@/lib/favoritos/contexto";
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

export const metadata: Metadata = {
  title: {
    default: "BeautyNow — Cosméticos profissionais com curadoria",
    template: "%s | BeautyNow",
  },
  description:
    "Haircare profissional, perfumaria e cuidado pessoal com curadoria de quem distribui há 15 anos. Frete grátis a partir de R$ 199, Pix com 5% de desconto e envio em até 24h.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${fraunces.variable}`}>
      <body>
        <ContaProvider>
          <FavoritosProvider>
            <CarrinhoProvider>{children}</CarrinhoProvider>
          </FavoritosProvider>
        </ContaProvider>
      </body>
    </html>
  );
}
