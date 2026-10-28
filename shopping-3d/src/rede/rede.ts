/**
 * Conexão com o servidor do shopping (servidor/index.mjs): avisa quem é,
 * manda onde está (até 8 vezes por segundo, só quando mexe) e recebe os
 * outros visitantes, o chat e os gestos. Caiu? Tenta de novo sozinha, com
 * espera crescente (o servidor grátis "dorme" e leva ~1 min para acordar).
 */
import type { Visual } from "../avatar/avatares";

export interface Pessoa {
  id: string;
  nome: string;
  visual: Visual;
  x: number;
  z: number;
  r: number;
  v: number;
}

export interface MensagemChat {
  id: string;
  nome: string;
  texto: string;
  hora: number;
}

export type EstadoRede = "conectando" | "online" | "offline";

export interface OuvintesRede {
  bemVindo: (id: string, outros: Pessoa[], chat: MensagemChat[]) => void;
  entrou: (p: Pessoa) => void;
  saiu: (id: string) => void;
  mudouVisual: (p: Pessoa) => void;
  estados: (l: [string, number, number, number, number][]) => void;
  chat: (m: MensagemChat) => void;
  gesto: (id: string, g: string, alvo?: string) => void;
  total: (n: number) => void;
  estado: (e: EstadoRede) => void;
}

export function enderecoServidor(): string {
  const env = import.meta.env.VITE_SERVIDOR_WS as string | undefined;
  if (env) return env;
  const local = ["localhost", "127.0.0.1"].includes(location.hostname);
  return local ? `ws://${location.hostname}:8787/ws` : "wss://shopping-da-beleza-servidor.onrender.com/ws";
}

export class Rede {
  private ws: WebSocket | null = null;
  private espera = 2000;
  private ultimoEnvio = 0;
  private ultima: [number, number, number, number] = [0, 0, 0, 0];
  private apresentacao: { nome: string; visual: Visual } | null = null;
  private desligada = false;
  meuId: string | null = null;

  constructor(
    private url: string,
    private ouvir: OuvintesRede
  ) {}

  conectar(nome: string, visual: Visual) {
    this.apresentacao = { nome, visual };
    this.desligada = false;
    if (this.ws) return;
    this.abrir();
    // acorda o servidor grátis (ele dorme sem visitas) antes mesmo do WebSocket
    void fetch(this.url.replace(/^ws/, "http").replace(/\/ws$/, "/saude"), { mode: "cors" }).catch(() => undefined);
  }

  private abrir() {
    this.ouvir.estado("conectando");
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch {
      this.ouvir.estado("offline");
      return this.tentarDeNovo();
    }
    this.ws = ws;
    ws.onopen = () => {
      this.espera = 2000;
      if (this.apresentacao) this.mandar({ t: "oi", ...this.apresentacao });
    };
    ws.onmessage = (ev) => {
      let m: Record<string, unknown>;
      try {
        m = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      switch (m.t) {
        case "bemvindo":
          this.meuId = m.id as string;
          this.ouvir.estado("online");
          this.ouvir.bemVindo(m.id as string, m.outros as Pessoa[], m.chat as MensagemChat[]);
          break;
        case "entrou":
          this.ouvir.entrou(m.p as Pessoa);
          break;
        case "saiu":
          this.ouvir.saiu(m.id as string);
          break;
        case "visual":
          this.ouvir.mudouVisual(m.p as Pessoa);
          break;
        case "estados":
          this.ouvir.estados(m.l as [string, number, number, number, number][]);
          break;
        case "chat":
          this.ouvir.chat(m.m as MensagemChat);
          break;
        case "gesto":
          this.ouvir.gesto(m.id as string, m.g as string, m.alvo as string | undefined);
          break;
        case "total":
          this.ouvir.total(m.n as number);
          break;
      }
    };
    ws.onclose = () => {
      this.ws = null;
      this.meuId = null;
      this.ouvir.estado("offline");
      if (!this.desligada) this.tentarDeNovo();
    };
    ws.onerror = () => ws.close();
  }

  private tentarDeNovo() {
    setTimeout(() => !this.desligada && !this.ws && this.abrir(), this.espera);
    this.espera = Math.min(20000, this.espera * 1.7);
  }

  private mandar(m: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  get online() {
    return !!this.meuId;
  }

  /** chamado a cada quadro; só manda se mexeu e no máximo 8 vezes por segundo */
  posicao(x: number, z: number, r: number, v: number) {
    if (!this.meuId) return;
    const agora = performance.now();
    if (agora - this.ultimoEnvio < 125) return;
    const [ux, uz, ur, uv] = this.ultima;
    // rumo perto de ±π pula de um lado para o outro: compara pela diferença de ângulo
    const dr = Math.abs(Math.atan2(Math.sin(r - ur), Math.cos(r - ur)));
    const mexeu = Math.abs(x - ux) > 0.02 || Math.abs(z - uz) > 0.02 || dr > 0.03 || (uv > 0) !== (v > 0.05);
    // parado, repete a cada 2 s (quem chegou agora vê a pessoa no lugar certo)
    if (!mexeu && agora - this.ultimoEnvio < 2000) return;
    this.ultimoEnvio = agora;
    this.ultima = [x, z, r, v > 0.05 ? v : 0];
    this.mandar({ t: "pos", x, z, r, v: v > 0.05 ? v : 0 });
  }

  falar(texto: string) {
    this.mandar({ t: "chat", texto });
  }

  gesto(g: string, alvo?: string) {
    this.mandar({ t: "gesto", g, alvo });
  }

  mudarVisual(nome: string, visual: Visual) {
    this.apresentacao = { nome, visual };
    this.mandar({ t: "visual", nome, visual });
  }

  desligar() {
    this.desligada = true;
    this.ws?.close();
  }
}
