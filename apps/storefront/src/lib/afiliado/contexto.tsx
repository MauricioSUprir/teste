"use client";

/**
 * Login do afiliado — e-mail + código, sem senha (mesmo mecanismo do login
 * do admin). Funciona em qualquer aparelho: o afiliado digita o e-mail
 * cadastrado, recebe o código e entra. Depois de confirmado, o e-mail fica
 * salvo neste navegador para não pedir código de novo a cada visita — igual
 * ao padrão do CNPJ na Be2Beauty (`lib/b2b/contexto.tsx`).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CODIGO_VALIDADE_MIN } from "@/lib/conta/config";
import { copy } from "@/lib/copy";
import {
  conferirUsuarioAfiliado,
  consultarStatusAfiliado,
  emailRealAtivo,
  solicitarCodigoPorEmail,
  verificarCodigoNoServidor,
} from "@/lib/servidor";

export type StatusAfiliado = "nao_cadastrado" | "pendente" | "aprovado" | "recusado";

interface VerificacaoPendente {
  email: string;
  /** usuário de vendedor digitado no login — validado antes do código */
  usuario: string;
  /** null quando o código vive no servidor (enviado por e-mail) */
  codigo: string | null;
  expiraEm: number;
}

interface ContextoAfiliado {
  /** e-mail confirmado neste navegador (null = não logado) */
  email: string | null;
  /** usuário de vendedor confirmado (obrigatório para abrir o painel) */
  usuario: string | null;
  status: StatusAfiliado | null;
  aguardandoCodigo: boolean;
  emailAguardandoCodigo: string | null;
  codigoDemo: string | null;
  entrar: (email: string, usuario: string) => Promise<{ ok: boolean; erro?: string }>;
  confirmarCodigo: (codigo: string) => Promise<{ ok: boolean; erro?: string }>;
  reenviarCodigo: () => Promise<{ ok: boolean; erro?: string }>;
  cancelarVerificacao: () => void;
  /** reconsulta o status no servidor (após cadastrar, ou botão "verificar novamente") */
  verificar: () => Promise<StatusAfiliado | null>;
  sair: () => void;
}

function gerarCodigo(): string {
  const aleatorio = crypto.getRandomValues(new Uint32Array(1))[0];
  return String(aleatorio % 1000000).padStart(6, "0");
}

const Contexto = createContext<ContextoAfiliado | null>(null);

const CHAVE_EMAIL = "afiliado-email";
const CHAVE_USUARIO = "afiliado-usuario";
const CHAVE_STATUS = "afiliado-status";

export function AfiliadoProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusAfiliado | null>(null);
  const [pendente, setPendente] = useState<VerificacaoPendente | null>(null);

  // hidrata do cache e reconsulta o servidor em segundo plano
  useEffect(() => {
    const salvo = localStorage.getItem(CHAVE_EMAIL);
    if (!salvo) return;
    setEmail(salvo);
    setUsuario(localStorage.getItem(CHAVE_USUARIO));
    const salvoStatus = localStorage.getItem(CHAVE_STATUS) as StatusAfiliado | null;
    if (salvoStatus) setStatus(salvoStatus);
    consultarStatusAfiliado(salvo).then((r) => {
      if (r.ok) {
        setStatus(r.status as StatusAfiliado);
        localStorage.setItem(CHAVE_STATUS, r.status);
      }
    });
  }, []);

  const entrar: ContextoAfiliado["entrar"] = useCallback(async (emailBruto, usuarioBruto) => {
    const emailLimpo = emailBruto.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(emailLimpo)) {
      return { ok: false, erro: "E-mail inválido. Confira a digitação." };
    }
    const usuarioLimpo = usuarioBruto.trim();
    // o usuário de vendedor precisa bater com o cadastro deste e-mail
    const conf = await conferirUsuarioAfiliado(emailLimpo, usuarioLimpo);
    if (conf.ok && !conf.confere) {
      return { ok: false, erro: copy.afiliado.usuarioNaoConfere };
    }
    if (await emailRealAtivo()) {
      const r = await solicitarCodigoPorEmail(emailLimpo);
      if (!r.ok) return { ok: false, erro: r.erro };
      setPendente({ email: emailLimpo, usuario: usuarioLimpo, codigo: null, expiraEm: Date.now() + CODIGO_VALIDADE_MIN * 60_000 });
    } else {
      setPendente({
        email: emailLimpo,
        usuario: usuarioLimpo,
        codigo: gerarCodigo(),
        expiraEm: Date.now() + CODIGO_VALIDADE_MIN * 60_000,
      });
    }
    return { ok: true };
  }, []);

  const confirmarCodigo: ContextoAfiliado["confirmarCodigo"] = useCallback(
    async (codigo) => {
      if (!pendente) return { ok: false, erro: "Nenhuma verificação em andamento." };
      if (Date.now() > pendente.expiraEm) {
        setPendente(null);
        return { ok: false, erro: "O código expirou. Faça login novamente." };
      }
      if (pendente.codigo === null) {
        const r = await verificarCodigoNoServidor(pendente.email, codigo.trim());
        if (!r.ok) return { ok: false, erro: r.erro ?? "Código incorreto. Confira os 6 dígitos." };
      } else if (codigo.trim() !== pendente.codigo) {
        return { ok: false, erro: "Código incorreto. Confira os 6 dígitos." };
      }
      const emailConfirmado = pendente.email;
      const usuarioConfirmado = pendente.usuario;
      const r = await consultarStatusAfiliado(emailConfirmado);
      setEmail(emailConfirmado);
      setUsuario(usuarioConfirmado);
      setStatus(r.status as StatusAfiliado);
      setPendente(null);
      try {
        localStorage.setItem(CHAVE_EMAIL, emailConfirmado);
        localStorage.setItem(CHAVE_USUARIO, usuarioConfirmado);
        localStorage.setItem(CHAVE_STATUS, r.status);
      } catch {
        // segue sem persistir
      }
      return { ok: true };
    },
    [pendente]
  );

  const reenviarCodigo: ContextoAfiliado["reenviarCodigo"] = useCallback(async () => {
    if (!pendente) return { ok: false, erro: "Nenhuma verificação em andamento." };
    if (pendente.codigo === null) {
      const r = await solicitarCodigoPorEmail(pendente.email);
      if (!r.ok) return { ok: false, erro: r.erro };
      setPendente({ ...pendente, expiraEm: Date.now() + CODIGO_VALIDADE_MIN * 60_000 });
      return { ok: true };
    }
    setPendente({ ...pendente, codigo: gerarCodigo(), expiraEm: Date.now() + CODIGO_VALIDADE_MIN * 60_000 });
    return { ok: true };
  }, [pendente]);

  const cancelarVerificacao = useCallback(() => setPendente(null), []);

  const verificar = useCallback(async () => {
    if (!email) return null;
    const r = await consultarStatusAfiliado(email);
    if (r.ok) {
      setStatus(r.status as StatusAfiliado);
      localStorage.setItem(CHAVE_STATUS, r.status);
    }
    return r.status as StatusAfiliado;
  }, [email]);

  const sair = useCallback(() => {
    setEmail(null);
    setUsuario(null);
    setStatus(null);
    setPendente(null);
    try {
      localStorage.removeItem(CHAVE_EMAIL);
      localStorage.removeItem(CHAVE_USUARIO);
      localStorage.removeItem(CHAVE_STATUS);
    } catch {
      // nada a limpar
    }
  }, []);

  const valor = useMemo<ContextoAfiliado>(
    () => ({
      email,
      usuario,
      status,
      aguardandoCodigo: pendente !== null,
      emailAguardandoCodigo: pendente?.email ?? null,
      codigoDemo: pendente?.codigo ?? null,
      entrar,
      confirmarCodigo,
      reenviarCodigo,
      cancelarVerificacao,
      verificar,
      sair,
    }),
    [email, usuario, status, pendente, entrar, confirmarCodigo, reenviarCodigo, cancelarVerificacao, verificar, sair]
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAfiliado(): ContextoAfiliado {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useAfiliado precisa estar dentro de <AfiliadoProvider>");
  return ctx;
}
