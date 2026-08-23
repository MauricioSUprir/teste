"use client";

/** Orquestra login (e-mail + código) → cadastro/status → painel do afiliado. */
import { copy } from "@/lib/copy";
import { AfiliadoProvider, useAfiliado } from "@/lib/afiliado/contexto";
import { EtapaLogin } from "./EtapaLogin";
import { EtapaCodigo } from "./EtapaCodigo";
import { CadastroAfiliado } from "./CadastroAfiliado";
import { PainelAfiliado } from "./PainelAfiliado";

function Conteudo() {
  const afiliado = useAfiliado();

  if (afiliado.aguardandoCodigo) return <EtapaCodigo />;
  if (!afiliado.email) return <EtapaLogin />;

  if (afiliado.status === "aprovado") return <PainelAfiliado />;

  const cabecalho = (
    <div className="mb-4 flex items-center justify-between gap-3">
      <p className="text-[0.8125rem] text-grafite">
        Entrou como <strong className="text-tinta">{afiliado.email}</strong>
      </p>
      <button
        type="button"
        onClick={() => {
          afiliado.sair();
        }}
        className="shrink-0 text-[0.8125rem] font-medium text-grafite underline"
      >
        {copy.afiliado.trocarEmail}
      </button>
    </div>
  );

  if (afiliado.status === "pendente") {
    return (
      <div>
        {cabecalho}
        <div className="rounded-[16px] border border-linha p-6">
          <h2 className="font-titulo text-[1.25rem] font-semibold text-tinta">
            {copy.afiliado.statusPendenteTitulo}
          </h2>
          <p className="mt-1 text-[0.9375rem] text-grafite">{copy.afiliado.statusPendenteTexto}</p>
          <button
            type="button"
            onClick={() => void afiliado.verificar()}
            className="mt-4 h-11 rounded-[999px] border border-roxo px-5 text-[0.875rem] font-semibold text-roxo hover:bg-roxo-claro"
          >
            {copy.afiliado.verificarNovamente}
          </button>
        </div>
      </div>
    );
  }

  if (afiliado.status === "recusado") {
    return (
      <div>
        {cabecalho}
        <div className="rounded-[16px] border border-linha p-6">
          <h2 className="font-titulo text-[1.25rem] font-semibold text-tinta">
            {copy.afiliado.statusRecusadoTitulo}
          </h2>
          <p className="mt-1 text-[0.9375rem] text-grafite">{copy.afiliado.statusRecusadoTexto}</p>
        </div>
      </div>
    );
  }

  // "nao_cadastrado" — primeira vez com este e-mail
  return (
    <div>
      {cabecalho}
      <CadastroAfiliado />
    </div>
  );
}

export function PaginaAfiliado() {
  return (
    <AfiliadoProvider>
      <Conteudo />
    </AfiliadoProvider>
  );
}
