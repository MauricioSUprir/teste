"use client";

/** Formulário de entrada no programa de afiliados — CNPJ é opcional. */
import { useState } from "react";
import { copy } from "@/lib/copy";
import { useAfiliado } from "@/lib/afiliado/contexto";
import { USUARIO_VENDEDOR_RE, cadastrarAfiliado } from "@/lib/servidor";

/** validação oficial de CNPJ (mesma regra do servidor) — só roda se preenchido */
function cnpjValido(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (tamanho: number) => {
    const pesos =
      tamanho === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = pesos.reduce((s, p, i) => s + p * Number(d[i]), 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

function formatarCnpj(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

const classeCampo =
  "h-12 w-full rounded-[6px] border border-linha bg-white px-3 text-[0.9375rem] outline-none focus:border-violeta";

export function CadastroAfiliado() {
  const afiliado = useAfiliado();
  const [nome, setNome] = useState("");
  const [usuario, setUsuario] = useState("");
  const [chavePix, setChavePix] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (!afiliado.email) return null;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const digitos = cnpj.replace(/\D/g, "");
    if (digitos && !cnpjValido(digitos)) {
      setErro(copy.afiliado.cnpjInvalido);
      return;
    }
    if (!USUARIO_VENDEDOR_RE.test(usuario.trim())) {
      setErro(copy.afiliado.usuarioInvalido);
      return;
    }
    if (!chavePix.trim()) {
      setErro(copy.afiliado.pixVazia);
      return;
    }
    setEnviando(true);
    const r = await cadastrarAfiliado({
      email: afiliado.email!,
      nome: nome.trim(),
      usuario: usuario.trim(),
      chavePix: chavePix.trim(),
      whatsapp: whatsapp.trim(),
      cnpj: digitos || undefined,
    });
    setEnviando(false);
    if (!r.ok) {
      setErro(r.erro ?? copy.afiliado.falha);
      return;
    }
    void afiliado.verificar();
  }

  return (
    <form onSubmit={enviar} className="rounded-[16px] border border-linha p-6">
      <h2 className="font-titulo text-[1.25rem] font-semibold text-tinta">{copy.afiliado.cadastroTitulo}</h2>
      <p className="mt-1 text-[0.9375rem] text-grafite">{copy.afiliado.cadastroTexto}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-[0.875rem] font-medium text-tinta">{copy.afiliado.formNome}</span>
          <input
            type="text"
            required
            autoComplete="name"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className={`${classeCampo} mt-1`}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[0.875rem] font-medium text-tinta">{copy.afiliado.usuarioRotulo}</span>
          <input
            type="text"
            required
            placeholder="MARIA#22"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value.toUpperCase())}
            className={`${classeCampo} num mt-1 uppercase`}
          />
          <span className="mt-1 block text-[0.75rem] text-cinza">{copy.afiliado.usuarioDica}</span>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[0.875rem] font-medium text-tinta">{copy.afiliado.pixRotulo}</span>
          <input
            type="text"
            required
            placeholder="CPF, e-mail, celular ou aleatória"
            value={chavePix}
            onChange={(e) => setChavePix(e.target.value)}
            className={`${classeCampo} mt-1`}
          />
          <span className="mt-1 block text-[0.75rem] text-cinza">{copy.afiliado.pixDica}</span>
        </label>
        <label className="block">
          <span className="text-[0.875rem] font-medium text-tinta">{copy.afiliado.formWhatsapp}</span>
          <input
            type="tel"
            required
            autoComplete="tel"
            inputMode="tel"
            placeholder="(21) 99999-9999"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className={`${classeCampo} num mt-1`}
          />
        </label>
        <label className="block">
          <span className="text-[0.875rem] font-medium text-tinta">{copy.afiliado.formCnpj}</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="00.000.000/0000-00"
            value={cnpj}
            onChange={(e) => setCnpj(formatarCnpj(e.target.value))}
            className={`${classeCampo} num mt-1`}
          />
          <span className="mt-1 block text-[0.75rem] text-cinza">{copy.afiliado.formCnpjDica}</span>
        </label>
      </div>
      {erro && (
        <p role="alert" className="mt-3 text-[0.875rem] font-medium text-erro">
          {erro}
        </p>
      )}
      <button
        type="submit"
        disabled={enviando}
        className="mt-5 h-12 w-full rounded-[999px] bg-roxo text-[1rem] font-semibold text-white hover:bg-roxo-escuro disabled:opacity-60 sm:w-auto sm:px-8"
      >
        {enviando ? copy.afiliado.enviando : copy.afiliado.enviar}
      </button>
    </form>
  );
}
