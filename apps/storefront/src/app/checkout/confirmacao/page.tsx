import type { Metadata } from "next";
import { Confirmacao } from "@/components/checkout/Confirmacao";

export const metadata: Metadata = {
  title: "Pedido confirmado",
  robots: { index: false },
};

export default function PaginaConfirmacao() {
  return <Confirmacao />;
}
