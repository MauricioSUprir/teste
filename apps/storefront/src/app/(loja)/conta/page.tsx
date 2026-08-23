import type { Metadata } from "next";
import { PaginaConta } from "@/components/conta/PaginaConta";

export const metadata: Metadata = { title: "Minha conta", robots: { index: false } };

export default function RotaConta() {
  return <PaginaConta />;
}
