import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { DrawerCarrinho } from "@/components/carrinho/DrawerCarrinho";

/**
 * Layout das páginas de loja: header com megamenu, footer e drawer de carrinho.
 * O checkout fica fora deste grupo de propósito — sem navegação, só logo e
 * selo de segurança (docs/03 §5).
 */
export default function LayoutLoja({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main id="conteudo">{children}</main>
      <Footer />
      <DrawerCarrinho />
    </>
  );
}
