import type { Metadata } from "next";
import { Suspense } from "react";
import { LevarSacola } from "@/components/carrinho/LevarSacola";

// porta de entrada da sacola do Beauty Shopping: não é página para o Google
export const metadata: Metadata = { title: "Sua sacola", robots: { index: false } };

export default function RotaLevar() {
  return (
    <Suspense fallback={null}>
      <LevarSacola />
    </Suspense>
  );
}
