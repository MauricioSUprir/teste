"use client";

/**
 * Contas de cliente e administrador — versão de demonstração.
 *
 * Na demo (site estático, sem servidor) as contas ficam no localStorage do
 * navegador e o "e-mail com o código" é simulado: o código aparece na tela,
 * num aviso claramente marcado como demonstração. Na versão com backend, este
 * módulo passa a chamar a API (que envia o e-mail de verdade e guarda as
 * contas no banco) mantendo exatamente a mesma interface pública.
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
import { ADMIN_EMAIL, ADMIN_SENHA_HASH, CODIGO_VALIDADE_MIN } from "./config";

export interface Usuario {
  nome: string;
  email: string;
  senhaHash: string;
  cep: string;
  numero: string;
  complemento: string;
  viaGoogle: boolean;
  admin: boolean;
}

export type UsuarioPublico = Omit<Usuario, "senhaHash">;

interface VerificacaoPendente {
  email: string;
  codigo: string;
  expiraEm: number; // epoch ms
}

interface ContaContexto {
  usuario: UsuarioPublico | null;
  /** verificação em 2 etapas aguardando código */
  aguardandoCodigo: boolean;
  /** código "enviado por e-mail" — exposto apenas no modo demonstração */
  codigoDemo: string | null;
  criarConta: (dados: {
    nome: string;
    email: string;
    senha: string;
    cep: string;
    numero: string;
    complemento: string;
  }) => Promise<{ ok: boolean; erro?: string }>;
  iniciarLogin: (email: string, senha: string) => Promise<{ ok: boolean; erro?: string }>;
  confirmarCodigo: (codigo: string) => { ok: boolean; erro?: string };
  cancelarVerificacao: () => void;
  entrarComGoogle: () => void;
  sair: () => void;
}

const Contexto = createContext<ContaContexto | null>(null);

const CHAVE_USUARIOS = "beautynow:usuarios:v1";
const CHAVE_SESSAO = "beautynow:sessao:v1";

async function sha256(texto: string): Promise<string> {
  const dados = new TextEncoder().encode(texto);
  const hash = await crypto.subtle.digest("SHA-256", dados);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function gerarCodigo(): string {
  const aleatorio = crypto.getRandomValues(new Uint32Array(1))[0];
  return String(aleatorio % 1000000).padStart(6, "0");
}

function lerUsuarios(): Usuario[] {
  try {
    const bruto = localStorage.getItem(CHAVE_USUARIOS);
    return bruto ? (JSON.parse(bruto) as Usuario[]) : [];
  } catch {
    return [];
  }
}

function gravarUsuarios(usuarios: Usuario[]) {
  try {
    localStorage.setItem(CHAVE_USUARIOS, JSON.stringify(usuarios));
  } catch {
    // storage indisponível — contas só em memória nesta sessão
  }
}

function publico(u: Usuario): UsuarioPublico {
  const { senhaHash: _descartada, ...resto } = u; // eslint-disable-line @typescript-eslint/no-unused-vars
  return resto;
}

export function ContaProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioPublico | null>(null);
  const [pendente, setPendente] = useState<VerificacaoPendente | null>(null);

  // restaura sessão
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_SESSAO);
      if (!salvo) return;
      const email = JSON.parse(salvo) as string;
      const u = lerUsuarios().find((x) => x.email === email);
      if (u) setUsuario(publico(u));
    } catch {
      // sem sessão
    }
  }, []);

  const criarConta: ContaContexto["criarConta"] = useCallback(async (dados) => {
    const email = dados.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, erro: "E-mail inválido. Confira a digitação." };
    if (dados.senha.length < 8) return { ok: false, erro: "A senha precisa de pelo menos 8 caracteres." };
    if (!/^\d{5}-?\d{3}$/.test(dados.cep.trim())) return { ok: false, erro: "CEP inválido. Use o formato 00000-000." };
    if (!dados.numero.trim()) return { ok: false, erro: "Informe o número da residência." };
    if (email === ADMIN_EMAIL) return { ok: false, erro: "Este e-mail é reservado. Use outro." };
    const usuarios = lerUsuarios();
    if (usuarios.some((u) => u.email === email)) {
      return { ok: false, erro: "Já existe uma conta com este e-mail. Entre com sua senha." };
    }
    const novo: Usuario = {
      nome: dados.nome.trim(),
      email,
      senhaHash: await sha256(dados.senha),
      cep: dados.cep.trim(),
      numero: dados.numero.trim(),
      complemento: dados.complemento.trim(),
      viaGoogle: false,
      admin: false,
    };
    gravarUsuarios([...usuarios, novo]);
    setUsuario(publico(novo));
    try {
      localStorage.setItem(CHAVE_SESSAO, JSON.stringify(email));
    } catch {
      // segue sem persistir
    }
    return { ok: true };
  }, []);

  const iniciarLogin: ContaContexto["iniciarLogin"] = useCallback(async (emailBruto, senha) => {
    const email = emailBruto.trim().toLowerCase();
    const senhaHash = await sha256(senha);

    const ehAdmin = email === ADMIN_EMAIL;
    if (ehAdmin) {
      if (senhaHash !== ADMIN_SENHA_HASH) {
        return { ok: false, erro: "E-mail ou senha incorretos." };
      }
    } else {
      const u = lerUsuarios().find((x) => x.email === email);
      if (!u || u.senhaHash !== senhaHash) {
        return { ok: false, erro: "E-mail ou senha incorretos. Confira os dados ou crie uma conta." };
      }
    }

    // 2ª etapa: código de verificação "enviado por e-mail" (simulado na demo)
    setPendente({
      email,
      codigo: gerarCodigo(),
      expiraEm: Date.now() + CODIGO_VALIDADE_MIN * 60_000,
    });
    return { ok: true };
  }, []);

  const confirmarCodigo: ContaContexto["confirmarCodigo"] = useCallback(
    (codigo) => {
      if (!pendente) return { ok: false, erro: "Nenhuma verificação em andamento." };
      if (Date.now() > pendente.expiraEm) {
        setPendente(null);
        return { ok: false, erro: "O código expirou. Faça login novamente." };
      }
      if (codigo.trim() !== pendente.codigo) {
        return { ok: false, erro: "Código incorreto. Confira os 6 dígitos." };
      }
      const email = pendente.email;
      let sessao: UsuarioPublico;
      if (email === ADMIN_EMAIL) {
        sessao = {
          nome: "Administrador BeautyNow",
          email,
          cep: "",
          numero: "",
          complemento: "",
          viaGoogle: false,
          admin: true,
        };
      } else {
        const u = lerUsuarios().find((x) => x.email === email);
        if (!u) return { ok: false, erro: "Conta não encontrada." };
        sessao = publico(u);
      }
      setUsuario(sessao);
      setPendente(null);
      try {
        localStorage.setItem(CHAVE_SESSAO, JSON.stringify(email));
      } catch {
        // segue sem persistir
      }
      return { ok: true };
    },
    [pendente]
  );

  const cancelarVerificacao = useCallback(() => setPendente(null), []);

  const entrarComGoogle = useCallback(() => {
    // Demo: simula o retorno do Google Identity Services. Na versão real,
    // o botão oficial do Google devolve um token com nome/e-mail verificados.
    const email = "cliente.google@demo.beautynow.com.br";
    const usuarios = lerUsuarios();
    let u = usuarios.find((x) => x.email === email);
    if (!u) {
      u = {
        nome: "Cliente Google (demonstração)",
        email,
        senhaHash: "",
        cep: "",
        numero: "",
        complemento: "",
        viaGoogle: true,
        admin: false,
      };
      gravarUsuarios([...usuarios, u]);
    }
    setUsuario(publico(u));
    try {
      localStorage.setItem(CHAVE_SESSAO, JSON.stringify(email));
    } catch {
      // segue sem persistir
    }
  }, []);

  const sair = useCallback(() => {
    setUsuario(null);
    setPendente(null);
    try {
      localStorage.removeItem(CHAVE_SESSAO);
    } catch {
      // nada a limpar
    }
  }, []);

  const valor = useMemo<ContaContexto>(
    () => ({
      usuario,
      aguardandoCodigo: pendente !== null,
      codigoDemo: pendente?.codigo ?? null,
      criarConta,
      iniciarLogin,
      confirmarCodigo,
      cancelarVerificacao,
      entrarComGoogle,
      sair,
    }),
    [usuario, pendente, criarConta, iniciarLogin, confirmarCodigo, cancelarVerificacao, entrarComGoogle, sair]
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useConta(): ContaContexto {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useConta precisa estar dentro de <ContaProvider>");
  return ctx;
}
