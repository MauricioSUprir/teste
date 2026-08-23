"use client";

/**
 * Aba Profissionais (B2B) — cadastros com CNPJ feitos no site Be2Beauty.
 * Aprovar libera os preços para aquele CNPJ; recusar mantém fechado.
 */
import { useEffect, useState } from "react";
import { copy } from "@/lib/copy";
import {
  decidirCadastroB2B,
  listarCadastrosB2B,
  type CadastroB2B,
  type StatusB2B,
} from "@/lib/servidor";

function formatarCnpj(d: string): string {
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

const rotuloStatus: Record<StatusB2B, string> = {
  pendente: copy.b2b.admin.pendente,
  aprovado: copy.b2b.admin.aprovado,
  recusado: copy.b2b.admin.recusadoRotulo,
  nao_cadastrado: "—",
};

const corStatus: Record<StatusB2B, string> = {
  pendente: "bg-alerta/10 text-alerta",
  aprovado: "bg-sucesso/10 text-sucesso",
  recusado: "bg-erro/10 text-erro",
  nao_cadastrado: "bg-superficie text-cinza",
};

export function AbaProfissionais() {
  const [cadastros, setCadastros] = useState<CadastroB2B[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [falha, setFalha] = useState(false);

  async function carregar() {
    setCarregando(true);
    const r = await listarCadastrosB2B();
    setFalha(!r.ok);
    setCadastros(r.cadastros);
    setCarregando(false);
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function decidir(cnpj: string, status: "aprovado" | "recusado") {
    setSalvando(cnpj);
    const r = await decidirCadastroB2B(cnpj, status);
    if (r.ok) {
      setCadastros((lista) => lista.map((c) => (c.cnpj === cnpj ? { ...c, status } : c)));
    }
    setSalvando(null);
  }

  return (
    <div>
      <p className="max-w-[70ch] text-[0.9375rem] text-grafite">{copy.b2b.admin.texto}</p>

      {carregando && <p className="mt-6 text-[0.9375rem] text-cinza">Carregando…</p>}
      {!carregando && falha && (
        <p className="mt-6 text-[0.9375rem] font-medium text-erro">
          Não foi possível falar com o servidor agora.{" "}
          <button type="button" onClick={() => void carregar()} className="underline">
            Tentar de novo
          </button>
        </p>
      )}
      {!carregando && !falha && cadastros.length === 0 && (
        <p className="mt-6 text-[0.9375rem] text-cinza">{copy.b2b.admin.vazio}</p>
      )}

      <ul className="mt-4 space-y-3">
        {cadastros.map((c) => (
          <li
            key={c.cnpj}
            className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-[10px] border border-linha p-4"
          >
            <div className="min-w-0 grow">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-tinta">{c.razao || c.nome}</span>
                <span
                  className={`rounded-[999px] px-2 py-0.5 text-[0.75rem] font-semibold ${corStatus[c.status]}`}
                >
                  {rotuloStatus[c.status]}
                </span>
              </p>
              <p className="num mt-0.5 text-[0.875rem] text-grafite">CNPJ {formatarCnpj(c.cnpj)}</p>
              <p className="mt-0.5 text-[0.8125rem] text-cinza">
                {c.nome} · {c.email} · {c.whatsapp} ·{" "}
                {new Date(c.criadoEm).toLocaleDateString("pt-BR")}
              </p>
            </div>
            <div className="flex gap-2">
              {c.status !== "aprovado" && (
                <button
                  type="button"
                  disabled={salvando === c.cnpj}
                  onClick={() => void decidir(c.cnpj, "aprovado")}
                  className="h-10 rounded-[999px] bg-sucesso px-4 text-[0.875rem] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {copy.b2b.admin.aprovar}
                </button>
              )}
              {c.status !== "recusado" && (
                <button
                  type="button"
                  disabled={salvando === c.cnpj}
                  onClick={() => void decidir(c.cnpj, "recusado")}
                  className="h-10 rounded-[999px] border border-erro px-4 text-[0.875rem] font-semibold text-erro hover:bg-erro/5 disabled:opacity-50"
                >
                  {copy.b2b.admin.recusar}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
