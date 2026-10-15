import Link from "next/link";
import { copy } from "@/lib/copy";
import { EnderecoAntigo } from "@/components/layout/EnderecoAntigo";

export default function NaoEncontrada() {
  return (
    <EnderecoAntigo>
    <div className="container-bn flex flex-col items-center py-24 text-center">
      <p className="num font-titulo text-[3rem] font-semibold text-roxo">404</p>
      <h1 className="font-titulo mt-2 text-[clamp(1.375rem,2.5vw,1.75rem)] font-semibold">
        {copy.naoEncontrada.titulo}
      </h1>
      <p className="mt-2 max-w-[48ch] text-[0.9375rem] text-grafite">
        {copy.naoEncontrada.texto}
      </p>
      <Link
        href="/"
        className="mt-6 rounded-[40px] bg-roxo px-6 py-3 text-[0.9375rem] font-semibold text-white hover:bg-roxo-escuro"
      >
        {copy.naoEncontrada.inicio}
      </Link>
    </div>
    </EnderecoAntigo>
  );
}
