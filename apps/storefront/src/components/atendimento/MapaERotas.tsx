import { NEGOCIO, consultaMapa, enderecoEmLinha } from "@/lib/negocio";

/**
 * Onde estamos: mapa embutido + botão de rota. Só aparece nas lojas com
 * endereço público confirmado — sem endereço, mostrar mapa seria chutar
 * um ponto no mapa e mandar o cliente para o lugar errado.
 */
export function MapaERotas() {
  const e = NEGOCIO.endereco;
  if (!e) return null;

  const consulta = consultaMapa(e);
  return (
    <section aria-labelledby="onde-estamos" className="mt-10">
      <h2 id="onde-estamos" className="font-titulo text-[1.25rem] font-semibold">
        Onde estamos
      </h2>
      <p className="mt-2 text-[0.9375rem] text-grafite">{enderecoEmLinha(e)}</p>
      <p className="mt-1 text-[0.875rem] text-cinza">{NEGOCIO.horario}</p>

      <div className="mt-4 overflow-hidden rounded-[12px] border border-linha">
        <iframe
          title={`Mapa — ${e.rua}, ${e.cidade}/${e.uf}`}
          src={`https://maps.google.com/maps?q=${consulta}&z=16&output=embed`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="block h-[320px] w-full border-0"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${consulta}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center rounded-[999px] bg-roxo px-5 text-[0.9375rem] font-semibold text-white hover:bg-roxo-escuro"
        >
          Traçar rota até aqui
        </a>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${consulta}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center rounded-[999px] border border-linha px-5 text-[0.9375rem] font-semibold text-grafite hover:border-roxo hover:text-roxo"
        >
          Abrir no Google Maps
        </a>
      </div>
    </section>
  );
}
