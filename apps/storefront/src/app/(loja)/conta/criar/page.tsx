import type { Metadata } from "next";
import { copy } from "@/lib/copy";
import { FormCriarConta } from "@/components/conta/FormCriarConta";

export const metadata: Metadata = { title: "Criar conta", robots: { index: false } };

export default function RotaCriarConta() {
  return (
    <div className="container-bn max-w-md py-12">
      <h1 className="font-titulo text-[clamp(1.625rem,3.5vw,2.25rem)] font-semibold">
        {copy.conta.criarTitulo}
      </h1>
      <div className="mt-6 rounded-[16px] border border-linha bg-white p-6">
        <FormCriarConta />
      </div>
    </div>
  );
}
