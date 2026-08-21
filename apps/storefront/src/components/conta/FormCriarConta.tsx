"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { copy } from "@/lib/copy";
import { useConta } from "@/lib/conta/contexto";
import { EtapaCodigo } from "./EtapaCodigo";

export function FormCriarConta() {
  const conta = useConta();
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [cep, setCep] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setErro("");
    setEnviando(true);
    const r = await conta.criarConta({ nome, email, senha, cep, numero, complemento });
    setEnviando(false);
    // com sucesso, o contexto entra em "aguardando código" — a etapa de
    // verificação é renderizada abaixo antes de concluir o cadastro
    if (!r.ok) setErro(r.erro ?? "");
  }

  if (conta.aguardandoCodigo) {
    return <EtapaCodigo aoConcluir={() => router.push("/conta")} />;
  }

  return (
    <form onSubmit={criar} className="space-y-4">
      <Campo id="criar-nome" rotulo={copy.conta.nome} valor={nome} aoMudar={setNome} autoComplete="name" required />
      <Campo id="criar-email" rotulo={copy.conta.email} valor={email} aoMudar={setEmail} type="email" autoComplete="email" inputMode="email" required />
      <div>
        <Campo id="criar-senha" rotulo={copy.conta.senha} valor={senha} aoMudar={setSenha} type="password" autoComplete="new-password" required />
        <p className="mt-1 text-[0.75rem] text-cinza">{copy.conta.senhaDica}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo id="criar-cep" rotulo={copy.conta.cep} valor={cep} aoMudar={setCep} autoComplete="postal-code" inputMode="numeric" required />
        <Campo id="criar-numero" rotulo={copy.conta.numero} valor={numero} aoMudar={setNumero} inputMode="numeric" required />
      </div>
      <Campo id="criar-complemento" rotulo={copy.conta.complemento} valor={complemento} aoMudar={setComplemento} />

      {erro && (
        <p role="alert" className="rounded-[6px] bg-roxo-claro px-3 py-2 text-[0.8125rem] font-medium text-erro">
          {erro}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        aria-busy={enviando}
        className="w-full rounded-[999px] bg-roxo py-3 text-[0.9375rem] font-semibold text-white hover:bg-roxo-escuro disabled:bg-cinza"
      >
        {enviando ? copy.conta.botaoCriando : copy.conta.botaoCriar}
      </button>
      {enviando && (
        <p role="status" className="text-center text-[0.8125rem] text-grafite">
          {copy.conta.aguardeServidor}
        </p>
      )}

      <p className="text-center text-[0.875rem] text-grafite">
        {copy.conta.jaTemConta}{" "}
        <Link href="/conta" className="font-medium text-violeta underline">
          {copy.conta.entrar}
        </Link>
      </p>
    </form>
  );
}

function Campo({
  id,
  rotulo,
  valor,
  aoMudar,
  type = "text",
  autoComplete,
  inputMode,
  required = false,
}: {
  id: string;
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  type?: string;
  autoComplete?: string;
  inputMode?: "numeric" | "email" | "text";
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[0.8125rem] font-medium text-grafite">
        {rotulo}
      </label>
      <input
        id={id}
        type={type}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        autoComplete={autoComplete}
        inputMode={inputMode}
        required={required}
        className="mt-1 h-11 w-full rounded-[6px] border border-linha bg-white px-3 text-[0.9375rem] outline-none focus:border-violeta"
      />
    </div>
  );
}
