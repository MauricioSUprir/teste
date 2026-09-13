import { comBase } from "@/lib/caminho";
import { NEGOCIO } from "@/lib/negocio";

/**
 * Time por trás da loja, com foto real de cada pessoa — o item de confiança
 * que mostra que existe gente de verdade atendendo. Enquanto não houver fotos
 * cadastradas em `lib/negocio`, a seção simplesmente não aparece.
 */
export function NossoTime() {
  const equipe = NEGOCIO.equipe;
  if (!equipe || equipe.length === 0) return null;

  return (
    <section aria-labelledby="nosso-time" className="mt-12">
      <h2 id="nosso-time" className="font-titulo text-[1.25rem] font-semibold">
        Quem atende você
      </h2>
      <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {equipe.map((pessoa) => (
          <li key={pessoa.nome} className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={comBase(`/equipe/${pessoa.foto}`)}
              alt={`${pessoa.nome}, ${pessoa.cargo}`}
              width={72}
              height={72}
              loading="lazy"
              className="h-18 w-18 shrink-0 rounded-[999px] object-cover"
            />
            <div className="min-w-0">
              <p className="text-[0.9375rem] font-semibold text-tinta">{pessoa.nome}</p>
              <p className="text-[0.875rem] text-grafite">{pessoa.cargo}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
