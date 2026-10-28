/**
 * Tudo o que fica por cima do 3D: barra com os botões, "você está em", a
 * dica de ação (E), avisos, o balão da ficha do produto, o painel lateral
 * (produto, sacola, caixa, mapa, aluguel, editor) e o joystick do celular.
 */
import { textos } from "../copy/textos";
import { descontoPct, fichaDe, formatarPreco, fotoDe, nomeMarca, parcelamento, precoPix, type Produto } from "../dados/catalogo";
import type { Entrada } from "../motor/entrada";
import { h, icone } from "./dom";
import { fichaEmHtml } from "./ficha";

export interface AcoesHud {
  mapa: () => void;
  conversa: () => void;
  sacola: () => void;
  visual: () => void;
  musica: (ligar: boolean) => void;
  telaCheia: () => void;
  ajuda: () => void;
  acao: () => void;
}

export class Interface {
  readonly raiz: HTMLElement;
  private hud: HTMLElement;
  private local: HTMLElement;
  private contagem: HTMLElement;
  private naoLidas: HTMLElement;
  private online: HTMLElement;
  private botaoSom: HTMLButtonElement;
  private dica: HTMLElement;
  private dicaTexto: HTMLElement;
  private aviso: HTMLElement;
  private balao: HTMLElement;
  private painel: HTMLElement;
  private painelTitulo: HTMLElement;
  private painelCorpo: HTMLElement;
  private painelRodape: HTMLElement;
  private carregando: HTMLElement;
  private carregandoTexto: HTMLElement;
  private joystick: HTMLElement;
  private musicaLigada = true;
  private timerAviso = 0;
  painelAberto: string | null = null;
  aoFecharPainel: (() => void) | null = null;

  constructor(pai: HTMLElement, private entrada: Entrada, readonly celular: boolean, acoes: AcoesHud) {
    const botao = (rotulo: string, nome: string, f: () => void, extra?: HTMLElement) =>
      h("button", { class: "botao-hud", type: "button", "aria-label": rotulo, title: rotulo, onclick: () => f() }, icone(nome), h("span", { class: "rotulo" }, rotulo), extra ?? null);
    this.contagem = h("span", { class: "contagem", hidden: true }, "0");
    this.naoLidas = h("span", { class: "contagem", hidden: true }, "0");
    this.online = h("span", { class: "hud-online" }, textos.social.conectando);
    this.botaoSom = botao(textos.hud.som, "som", () => {
      this.musicaLigada = !this.musicaLigada;
      this.botaoSom.replaceChildren(icone(this.musicaLigada ? "som" : "mudo"), h("span", { class: "rotulo" }, this.musicaLigada ? textos.hud.som : textos.hud.semSom));
      this.botaoSom.setAttribute("aria-pressed", String(this.musicaLigada));
      acoes.musica(this.musicaLigada);
    });
    this.botaoSom.setAttribute("aria-pressed", "true");
    this.local = h("strong", {}, textos.hud.entrada);
    this.hud = h(
      "header",
      { class: "hud", hidden: true },
      h("div", { class: "hud-marca" }, h("span", { class: "hud-shopping" }, "Shopping da"), h("span", { class: "hud-beleza" }, "Beleza")),
      h("div", { class: "hud-local" }, h("span", {}, textos.hud.voceEsta), this.local, this.online),
      h(
        "nav",
        { class: "hud-botoes", "aria-label": textos.shopping.nome },
        botao(textos.hud.mapa, "mapa", acoes.mapa),
        botao(textos.social.conversa, "conversa", acoes.conversa, this.naoLidas),
        botao(textos.hud.sacola, "sacola", acoes.sacola, this.contagem),
        botao(textos.hud.visual, "pessoa", acoes.visual),
        this.botaoSom,
        document.fullscreenEnabled ? h("span", { class: "so-largo" }, botao(textos.hud.telaCheia, "tela", acoes.telaCheia)) : null,
        botao(textos.hud.ajuda, "ajuda", acoes.ajuda)
      )
    );
    this.dicaTexto = h("span", {});
    this.dica = h("button", { class: "dica", type: "button", hidden: true, onclick: () => acoes.acao() }, h("kbd", {}, celular ? icone("mao") : "E"), this.dicaTexto);
    this.aviso = h("div", { class: "aviso", role: "status", "aria-live": "polite", hidden: true });
    this.balao = h("div", { class: "balao", hidden: true, "aria-hidden": "true" });
    this.painelTitulo = h("h2", {});
    this.painelCorpo = h("div", { class: "painel-corpo" });
    this.painelRodape = h("div", { class: "painel-rodape" });
    this.painel = h(
      "aside",
      { class: "painel", hidden: true, role: "dialog", "aria-labelledby": "painel-titulo" },
      h("div", { class: "painel-topo" }, this.painelTitulo, h("button", { class: "fechar", type: "button", "aria-label": textos.produto.fechar, onclick: () => this.fecharPainel() }, icone("fechar"))),
      this.painelCorpo,
      this.painelRodape
    );
    this.painelTitulo.id = "painel-titulo";
    this.carregandoTexto = h("p", {}, textos.carregando.titulo);
    this.carregando = h(
      "div",
      { class: "carregando" },
      h("div", { class: "carregando-marca" }, h("span", { class: "hud-shopping" }, "Shopping da"), h("span", { class: "hud-beleza" }, "Beleza")),
      h("div", { class: "carregando-anel", "aria-hidden": "true" }),
      this.carregandoTexto
    );
    const pino = h("div", { class: "pino" });
    this.joystick = h("div", { class: "joystick", hidden: true, "aria-hidden": "true" }, pino);
    this.montarJoystick(pino);
    this.raiz = h("div", { class: "ui" }, this.hud, this.dica, this.aviso, this.balao, this.painel, this.joystick, this.carregando);
    pai.appendChild(this.raiz);
    addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.painelAberto) this.fecharPainel();
    });
  }

  private montarJoystick(pino: HTMLElement) {
    const RAIO = 44;
    let id: number | null = null;
    let cx = 0;
    let cy = 0;
    const mover = (x: number, y: number) => {
      let dx = x - cx;
      let dy = y - cy;
      const d = Math.hypot(dx, dy);
      if (d > RAIO) {
        dx = (dx / d) * RAIO;
        dy = (dy / d) * RAIO;
      }
      pino.style.transform = `translate(${dx}px, ${dy}px)`;
      // zona morta no meio; depois a força cresce até a borda
      const k = Math.min(1, d / RAIO);
      const curva = k < 0.15 ? 0 : (k - 0.15) / 0.85;
      const l = Math.hypot(dx, dy) || 1;
      this.entrada.joystick.x = (dx / l) * curva;
      this.entrada.joystick.y = (-dy / l) * curva;
    };
    const soltar = () => {
      id = null;
      pino.style.transform = "";
      this.entrada.joystick.x = this.entrada.joystick.y = 0;
    };
    this.joystick.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      id = e.pointerId;
      this.joystick.setPointerCapture(e.pointerId);
      const r = this.joystick.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      mover(e.clientX, e.clientY);
    });
    this.joystick.addEventListener("pointermove", (e) => e.pointerId === id && mover(e.clientX, e.clientY));
    this.joystick.addEventListener("pointerup", soltar);
    this.joystick.addEventListener("pointercancel", soltar);
  }

  mostrarHud(sim: boolean) {
    this.hud.hidden = !sim;
    this.joystick.hidden = !(sim && this.celular);
    if (!sim) {
      this.definirDica(null);
      this.esconderBalao();
    }
  }

  definirLocal(texto: string) {
    if (this.local.textContent !== texto) this.local.textContent = texto;
  }

  definirSacola(n: number) {
    this.contagem.hidden = n === 0;
    this.contagem.textContent = String(n);
  }

  definirOnline(texto: string, ligado: boolean) {
    if (this.online.textContent !== texto) this.online.textContent = texto;
    this.online.classList.toggle("ligado", ligado);
  }

  definirNaoLidas(n: number) {
    this.naoLidas.hidden = n === 0;
    this.naoLidas.textContent = n > 9 ? "9+" : String(n);
  }

  definirDica(texto: string | null) {
    this.dica.hidden = !texto;
    if (texto && this.dicaTexto.textContent !== texto) this.dicaTexto.textContent = texto;
  }

  avisar(texto: string, ms = 3200) {
    this.aviso.textContent = texto;
    this.aviso.hidden = false;
    clearTimeout(this.timerAviso);
    this.timerAviso = window.setTimeout(() => (this.aviso.hidden = true), ms);
  }

  definirCarregando(texto: string | null) {
    this.carregando.hidden = !texto;
    if (texto) this.carregandoTexto.textContent = texto;
  }

  // ---- balão da ficha (cursor em cima do produto)

  private balaoDe: string | null = null;
  mostrarBalao(p: Produto, lojaNome: string, x: number, y: number) {
    if (this.balaoDe !== p.id) {
      this.balaoDe = p.id;
      const desc = descontoPct(p);
      this.balao.replaceChildren(
        h(
          "div",
          { class: "balao-topo" },
          h("img", { src: fotoDe(p), alt: "", width: 64, height: 64, loading: "eager", decoding: "async" }),
          h(
            "div",
            {},
            h("span", { class: "marca" }, nomeMarca(p.marca)),
            h("strong", { class: "titulo" }, p.titulo),
            h(
              "span",
              { class: "preco" },
              desc ? h("s", {}, formatarPreco(p.precoDe!)) : null,
              formatarPreco(p.preco),
              h("small", {}, ` · ${formatarPreco(precoPix(p.preco))} ${textos.produto.noPix}`)
            )
          )
        ),
        fichaEmHtml(fichaDe(p)),
        h("p", { class: "balao-rodape" }, `${textos.produto.vendidoPor(lojaNome)} · ${this.celular ? textos.produto.toque : textos.produto.clique}`)
      );
    }
    this.balao.hidden = false;
    // fica do lado do cursor que tem mais espaço
    const r = this.balao.getBoundingClientRect();
    const l = innerWidth;
    const a = innerHeight;
    let bx = x + 22;
    let by = y - r.height / 2;
    if (bx + r.width > l - 12) bx = x - r.width - 22;
    by = Math.max(72, Math.min(a - r.height - 12, by));
    this.balao.style.transform = `translate(${Math.round(bx)}px, ${Math.round(by)}px)`;
  }

  esconderBalao() {
    this.balao.hidden = true;
    this.balaoDe = null;
  }

  // ---- painel lateral

  abrirPainel(id: string, titulo: string, corpo: (Node | null)[], rodape: (Node | null)[] = []) {
    this.painelAberto = id;
    this.painelTitulo.textContent = titulo;
    this.painelCorpo.replaceChildren(...corpo.filter((x): x is Node => !!x));
    this.painelRodape.replaceChildren(...rodape.filter((x): x is Node => !!x));
    this.painelRodape.hidden = !rodape.length;
    this.painel.hidden = false;
    this.painel.dataset.tipo = id;
    // no celular o painel ocupa a parte de baixo: o joystick sai da frente
    if (this.celular) this.joystick.hidden = true;
    this.painelCorpo.scrollTop = 0;
    this.esconderBalao();
    // foco no painel para quem usa teclado (sem rolar a tela)
    (this.painel.querySelector("button.principal, input, button.fechar") as HTMLElement | null)?.focus({ preventScroll: true });
  }

  fecharPainel() {
    if (!this.painelAberto) return;
    this.painelAberto = null;
    this.painel.hidden = true;
    this.joystick.hidden = !(this.celular && !this.hud.hidden);
    this.aoFecharPainel?.();
  }

  /** o painel cobre a tela inteira no celular? (então o 3D não recebe toque) */
  painelCobre() {
    return !!this.painelAberto && this.celular;
  }
}

/** quadro de preço usado no painel do produto e no caixa */
export function blocoPreco(p: Produto) {
  const parc = parcelamento(p.preco);
  const desc = descontoPct(p);
  return h(
    "div",
    { class: "bloco-preco" },
    desc ? h("span", { class: "de" }, h("s", {}, formatarPreco(p.precoDe!)), h("em", {}, `-${desc}%`)) : null,
    h("strong", { class: "por" }, formatarPreco(p.preco)),
    h("span", { class: "pix" }, `${formatarPreco(precoPix(p.preco))} ${textos.produto.noPix}`),
    parc.vezes > 1 ? h("span", { class: "parcelas" }, textos.produto.ouEm(parc.vezes, formatarPreco(parc.valor))) : null
  );
}
