import type { Metadata } from "next";
import { PainelAdmin } from "@/components/conta/PainelAdmin";

export const metadata: Metadata = { title: "Painel do administrador", robots: { index: false } };

export default function RotaAdmin() {
  return <PainelAdmin />;
}
