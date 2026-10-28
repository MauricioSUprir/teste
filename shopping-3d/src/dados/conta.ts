/**
 * Conta do visitante (opcional). Entra com o e-mail e um código de 6
 * dígitos — o mesmo login da loja BeautyNow — e o shopping passa a guardar
 * no servidor o visual, a sacola, as lojas montadas e a música. Em outro
 * aparelho, entrando com o mesmo e-mail, tudo volta.
 *
 * Sem conta, nada muda: tudo continua salvo só neste aparelho. Com conta, o
 * aparelho continua guardando a sua cópia (abre rápido e funciona sem
 * internet) e cada mudança sobe para a conta logo depois.
 *
 * Quem sabe o que guardar e como aplicar é a sincronia (sincronia.ts): aqui
 * só se fala com o servidor.
 */
import { textos } from "../copy/textos";

export interface DadosConta {
  visual?: unknown;
  sacola?: unknown;
  lojas?: unknown;
  preferencias?: { musica?: unknown };
}

export type EstadoConta = "fora" | "carregando" | "salvando" | "salvo" | "semRede";

const CHAVE = "shopping3d.conta";
/** o servidor do plano gratuito dorme: a primeira chamada pode levar ~1 minuto */
const ESPERA_MS = 75_000;

export function enderecoContas(): string {
  const env = import.meta.env.VITE_SERVIDOR_CONTAS as string | undefined;
  if (env) return env.replace(/\/$/, "");
  const local = ["localhost", "127.0.0.1"].includes(location.hostname);
  return local ? `http://${location.hostname}:4000` : "https://beautynow-servidor.onrender.com";
}

class ErroConta extends Error {
  constructor(
    mensagem: string,
    readonly status: number
  ) {
    super(mensagem);
  }
}

class Conta {
  email: string | null = null;
  estado: EstadoConta = "fora";
  salvoEm: Date | null = null;
  /** o que guardar agora (sincronia) */
  coletar: () => DadosConta = () => ({});
  /** aplica o que veio da conta; `juntar` = mistura com o que já está neste aparelho */
  aplicar: (d: DadosConta, juntar: boolean) => void = () => undefined;

  private token: string | null = null;
  private base = enderecoContas();
  private ouvintes: (() => void)[] = [];
  /** só salva depois de ler a conta (senão a cópia velha deste aparelho apagaria a nova) */
  private lida = false;
  private mudouAntes = false;
  private aplicando = false;
  private timer = 0;
  private enviando = false;
  private deNovo = false;

  constructor() {
    try {
      const s = JSON.parse(localStorage.getItem(CHAVE) ?? "null");
      if (typeof s?.token === "string" && typeof s?.email === "string") {
        this.token = s.token;
        this.email = s.email;
        this.estado = "carregando";
      }
    } catch {
      /* sem conta neste aparelho */
    }
  }

  get logada() {
    return !!this.token;
  }

  ouvir(f: () => void) {
    this.ouvintes.push(f);
  }

  private avisar(estado?: EstadoConta) {
    if (estado) this.estado = estado;
    this.ouvintes.forEach((f) => f());
  }

  private async api<T>(caminho: string, metodo = "GET", corpo?: unknown): Promise<T> {
    let r: Response;
    try {
      r = await fetch(`${this.base}${caminho}`, {
        method: metodo,
        headers: { "Content-Type": "application/json", ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
        signal: AbortSignal.timeout(ESPERA_MS),
      });
    } catch {
      throw new ErroConta(textos.conta.erroRede, 0);
    }
    const json = (await r.json().catch(() => ({}))) as T & { erro?: string };
    if (!r.ok) {
      // sessão vencida ou conta apagada em outro aparelho: sai sem perder nada daqui
      if (r.status === 401 && this.token) this.esquecer();
      throw new ErroConta(json.erro ?? textos.conta.erroRede, r.status);
    }
    return json;
  }

  private guardar() {
    try {
      if (this.token) localStorage.setItem(CHAVE, JSON.stringify({ token: this.token, email: this.email }));
      else localStorage.removeItem(CHAVE);
    } catch {
      /* sem armazenamento: a sessão vale até fechar */
    }
  }

  private esquecer() {
    clearTimeout(this.timer);
    this.token = null;
    this.email = null;
    this.lida = false;
    this.salvoEm = null;
    this.guardar();
    this.avisar("fora");
  }

  private aplicarComo(d: DadosConta, juntar: boolean) {
    this.aplicando = true;
    try {
      this.aplicar(d, juntar);
    } finally {
      this.aplicando = false;
    }
  }

  async pedirCodigo(email: string) {
    await this.api("/shopping/conta/codigo", "POST", { email });
  }

  /** confere o código, conecta e junta o que está na conta com o que está aqui */
  async entrar(email: string, codigo: string) {
    const r = await this.api<{ token: string; email: string; dados: DadosConta; atualizadaEm: string }>("/shopping/conta/entrar", "POST", { email, codigo });
    this.token = r.token;
    this.email = r.email;
    this.guardar();
    const tinha = Object.keys(r.dados ?? {}).length > 0;
    if (tinha) this.aplicarComo(r.dados, true);
    this.lida = true;
    this.avisar("salvando");
    await this.enviar();
    return { trouxe: tinha };
  }

  /** ao abrir o shopping já conectado: o que está na conta vale (pode ter mudado em outro aparelho) */
  async carregar() {
    if (!this.token) return;
    this.avisar("carregando");
    try {
      const r = await this.api<{ email: string; dados: DadosConta }>("/shopping/conta");
      this.email = r.email;
      const tinha = Object.keys(r.dados ?? {}).length > 0;
      // mexeu em algo enquanto a conta carregava: junta em vez de trocar
      if (tinha) this.aplicarComo(r.dados, this.mudouAntes);
      this.lida = true;
      if (!tinha || this.mudouAntes) await this.enviar();
      else this.avisar("salvo");
      if (!this.salvoEm) this.salvoEm = new Date();
      this.avisar();
    } catch (e) {
      if ((e as ErroConta).status === 401) return;
      this.avisar("semRede");
      setTimeout(() => void this.carregar(), 20_000);
    }
  }

  /** algo mudou neste aparelho: sobe para a conta daqui a pouco */
  mudou() {
    if (!this.token || this.aplicando) return;
    if (!this.lida) {
      this.mudouAntes = true;
      return;
    }
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.enviar(), 1200);
    if (this.estado !== "salvando") this.avisar("salvando");
  }

  /** sobe já (a página está indo para o fundo) */
  enviarJa() {
    if (!this.token || !this.lida || this.estado !== "salvando") return;
    clearTimeout(this.timer);
    void this.enviar();
  }

  private async enviar() {
    if (!this.token) return;
    if (this.enviando) {
      this.deNovo = true;
      return;
    }
    this.enviando = true;
    try {
      await this.api("/shopping/conta", "PUT", { dados: this.coletar() });
      this.salvoEm = new Date();
      this.mudouAntes = false;
      if (!this.deNovo) this.avisar("salvo");
    } catch (e) {
      const status = (e as ErroConta).status;
      if (status !== 401) {
        this.avisar("semRede");
        // sem rede ou servidor fora: tenta de novo; recusado (4xx) não adianta repetir
        if (status === 0 || status >= 500) {
          clearTimeout(this.timer);
          this.timer = window.setTimeout(() => void this.enviar(), 15_000);
        }
      }
    } finally {
      this.enviando = false;
      if (this.deNovo) {
        this.deNovo = false;
        void this.enviar();
      }
    }
  }

  async sair() {
    await this.api("/shopping/conta/sair", "POST").catch(() => undefined);
    this.esquecer();
  }

  async apagar() {
    await this.api("/shopping/conta/apagar", "POST");
    this.esquecer();
  }
}

export const conta = new Conta();
