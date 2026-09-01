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
import {
  ADMIN_EMAIL,
  ADMIN_PBKDF2_ITERACOES,
  ADMIN_SALT,
  ADMIN_SENHA_PBKDF2,
  CODIGO_VALIDADE_MIN,
} from "./config";
import {
  acordarServidor,
  emailRealAtivo,
  solicitarCodigoPorEmail,
  verificarCodigoNoServidor,
} from "@/lib/servidor";

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
  /** null quando o código vive no servidor (enviado por e-mail) */
  codigo: string | null;
  expiraEm: number; // epoch ms
}

interface ContaContexto {
  usuario: UsuarioPublico | null;
  /** verificação em 2 etapas aguardando código */
  aguardandoCodigo: boolean;
  /** e-mail que está aguardando o código (para exibir na tela) */
  emailAguardandoCodigo: string | null;
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
  /**
   * Login direto do admin — pula a senha e manda o código na hora. Só existe
   * para o e-mail do admin (fixo, não recebe parâmetro) e é usado pelo botão
   * "Conectar" entre os dois sites (mesma conta admin nos dois): a pessoa já
   * provou quem é ao entrar no primeiro site, então aqui só falta o código.
   */
  iniciarLoginDiretoAdmin: () => Promise<{ ok: boolean; erro?: string }>;
  confirmarCodigo: (codigo: string) => Promise<{ ok: boolean; erro?: string }>;
  /** manda um novo código para o mesmo e-mail (botão "Reenviar") */
  reenviarCodigo: () => Promise<{ ok: boolean; erro?: string }>;
  /**
   * Confere a senha do usuário logado (ex.: antes de pedir para virar
   * afiliado). Conta criada pelo Google não tem senha — devolve true.
   */
  validarSenha: (senha: string) => Promise<boolean>;
  cancelarVerificacao: () => void;
  /** login demonstrativo (sem Client ID do Google configurado) */
  entrarComGoogle: () => void;
  /** login real com a credencial JWT do Google — dispara a etapa do código */
  entrarComGoogleCredencial: (credencial: string) => Promise<{ ok: boolean; erro?: string }>;
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

/** Derivação PBKDF2-SHA256 — usada na verificação da senha do admin. */
async function pbkdf2(senha: string): Promise<string> {
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(senha),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new TextEncoder().encode(ADMIN_SALT),
      iterations: ADMIN_PBKDF2_ITERACOES,
    },
    chave,
    256
  );
  return Array.from(new Uint8Array(bits))
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

  // acorda o servidor gratuito em segundo plano assim que o site abre —
  // evita o login/checkout esperarem o "despertar" de até 1 minuto
  useEffect(() => {
    acordarServidor();
  }, []);

  // restaura sessão
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_SESSAO);
      if (!salvo) return;
      const email = JSON.parse(salvo) as string;
      if (email === ADMIN_EMAIL) {
        setUsuario({
          nome: "Administrador BeautyNow",
          email,
          cep: "",
          numero: "",
          complemento: "",
          viaGoogle: false,
          admin: true,
        });
        return;
      }
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

    // todo e-mail é verificado: o cadastro também exige o código antes de entrar
    if (await emailRealAtivo()) {
      const r = await solicitarCodigoPorEmail(email);
      if (!r.ok) return { ok: false, erro: r.erro };
      setPendente({ email, codigo: null, expiraEm: Date.now() + CODIGO_VALIDADE_MIN * 60_000 });
    } else {
      setPendente({ email, codigo: gerarCodigo(), expiraEm: Date.now() + CODIGO_VALIDADE_MIN * 60_000 });
    }
    return { ok: true };
  }, []);

  const iniciarLogin: ContaContexto["iniciarLogin"] = useCallback(async (emailBruto, senha) => {
    const email = emailBruto.trim().toLowerCase();

    const ehAdmin = email === ADMIN_EMAIL;
    if (ehAdmin) {
      if ((await pbkdf2(senha)) !== ADMIN_SENHA_PBKDF2) {
        return { ok: false, erro: "E-mail ou senha incorretos." };
      }
    } else {
      const u = lerUsuarios().find((x) => x.email === email);
      if (!u || u.senhaHash !== (await sha256(senha))) {
        return { ok: false, erro: "E-mail ou senha incorretos. Confira os dados ou crie uma conta." };
      }
    }

    // 2ª etapa: código de verificação
    if (await emailRealAtivo()) {
      // servidor gera o código e envia por e-mail de verdade
      const r = await solicitarCodigoPorEmail(email);
      if (!r.ok) return { ok: false, erro: r.erro };
      setPendente({ email, codigo: null, expiraEm: Date.now() + CODIGO_VALIDADE_MIN * 60_000 });
    } else {
      // demonstração: código local, exibido na tela
      setPendente({ email, codigo: gerarCodigo(), expiraEm: Date.now() + CODIGO_VALIDADE_MIN * 60_000 });
    }
    return { ok: true };
  }, []);

  const iniciarLoginDiretoAdmin: ContaContexto["iniciarLoginDiretoAdmin"] = useCallback(async () => {
    if (await emailRealAtivo()) {
      const r = await solicitarCodigoPorEmail(ADMIN_EMAIL);
      if (!r.ok) return { ok: false, erro: r.erro };
      setPendente({ email: ADMIN_EMAIL, codigo: null, expiraEm: Date.now() + CODIGO_VALIDADE_MIN * 60_000 });
    } else {
      setPendente({ email: ADMIN_EMAIL, codigo: gerarCodigo(), expiraEm: Date.now() + CODIGO_VALIDADE_MIN * 60_000 });
    }
    return { ok: true };
  }, []);

  const confirmarCodigo: ContaContexto["confirmarCodigo"] = useCallback(
    async (codigo) => {
      if (!pendente) return { ok: false, erro: "Nenhuma verificação em andamento." };
      if (Date.now() > pendente.expiraEm) {
        setPendente(null);
        return { ok: false, erro: "O código expirou. Faça login novamente." };
      }
      if (pendente.codigo === null) {
        // código guardado no servidor
        const r = await verificarCodigoNoServidor(pendente.email, codigo.trim());
        if (!r.ok) return { ok: false, erro: r.erro ?? "Código incorreto. Confira os 6 dígitos." };
      } else if (codigo.trim() !== pendente.codigo) {
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

  const reenviarCodigo: ContaContexto["reenviarCodigo"] = useCallback(async () => {
    if (!pendente) return { ok: false, erro: "Nenhuma verificação em andamento." };
    if (pendente.codigo === null) {
      // servidor gera e envia um código novo por e-mail
      const r = await solicitarCodigoPorEmail(pendente.email);
      if (!r.ok) return { ok: false, erro: r.erro };
      setPendente({ ...pendente, expiraEm: Date.now() + CODIGO_VALIDADE_MIN * 60_000 });
      return { ok: true };
    }
    // demonstração: gera outro código local
    setPendente({
      ...pendente,
      codigo: gerarCodigo(),
      expiraEm: Date.now() + CODIGO_VALIDADE_MIN * 60_000,
    });
    return { ok: true };
  }, [pendente]);

  const cancelarVerificacao = useCallback(() => setPendente(null), []);

  const validarSenha: ContaContexto["validarSenha"] = useCallback(
    async (senha) => {
      if (!usuario) return false;
      if (usuario.email === ADMIN_EMAIL) return (await pbkdf2(senha)) === ADMIN_SENHA_PBKDF2;
      const u = lerUsuarios().find((x) => x.email === usuario.email);
      if (!u) return false;
      if (u.viaGoogle && !u.senhaHash) return true; // conta Google não tem senha
      return u.senhaHash === (await sha256(senha));
    },
    [usuario]
  );

  /** garante o cadastro do usuário vindo do Google e dispara a 2ª etapa (código) */
  const iniciarVerificacaoGoogle = useCallback(async (nome: string, email: string) => {
    const usuarios = lerUsuarios();
    if (!usuarios.some((x) => x.email === email)) {
      gravarUsuarios([
        ...usuarios,
        {
          nome,
          email,
          senhaHash: "",
          cep: "",
          numero: "",
          complemento: "",
          viaGoogle: true,
          admin: false,
        },
      ]);
    }
    // mesmo pelo Google, todo login passa pelo código de verificação
    if (await emailRealAtivo()) {
      const r = await solicitarCodigoPorEmail(email);
      if (!r.ok) return { ok: false, erro: r.erro };
      setPendente({ email, codigo: null, expiraEm: Date.now() + CODIGO_VALIDADE_MIN * 60_000 });
    } else {
      setPendente({ email, codigo: gerarCodigo(), expiraEm: Date.now() + CODIGO_VALIDADE_MIN * 60_000 });
    }
    return { ok: true };
  }, []);

  const entrarComGoogle = useCallback(() => {
    // Demo: simula o retorno do Google Identity Services. Na versão real,
    // o botão oficial do Google devolve um token com nome/e-mail verificados.
    void iniciarVerificacaoGoogle(
      "Cliente Google (demonstração)",
      "cliente.google@demo.beautynow.com.br"
    );
  }, [iniciarVerificacaoGoogle]);

  const entrarComGoogleCredencial: ContaContexto["entrarComGoogleCredencial"] = useCallback(
    async (credencial) => {
      try {
        // credencial = JWT do Google Identity Services; o payload traz nome e
        // e-mail verificados pelo Google (validação criptográfica completa
        // acontece no servidor quando ele estiver no ar)
        const payload = JSON.parse(
          atob(credencial.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
        ) as { name?: string; email?: string };
        if (!payload.email) return { ok: false, erro: "O Google não devolveu um e-mail válido." };
        const email = payload.email.toLowerCase();
        return await iniciarVerificacaoGoogle(payload.name ?? email, email);
      } catch {
        return { ok: false, erro: "Não foi possível ler a resposta do Google. Tente novamente." };
      }
    },
    [iniciarVerificacaoGoogle]
  );

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
      emailAguardandoCodigo: pendente?.email ?? null,
      codigoDemo: pendente?.codigo ?? null,
      criarConta,
      iniciarLogin,
      iniciarLoginDiretoAdmin,
      confirmarCodigo,
      reenviarCodigo,
      cancelarVerificacao,
      validarSenha,
      entrarComGoogle,
      entrarComGoogleCredencial,
      sair,
    }),
    [
      usuario,
      pendente,
      criarConta,
      iniciarLogin,
      iniciarLoginDiretoAdmin,
      confirmarCodigo,
      reenviarCodigo,
      cancelarVerificacao,
      validarSenha,
      entrarComGoogle,
      entrarComGoogleCredencial,
      sair,
    ]
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useConta(): ContaContexto {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useConta precisa estar dentro de <ContaProvider>");
  return ctx;
}
