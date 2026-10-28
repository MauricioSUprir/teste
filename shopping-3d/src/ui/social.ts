/**
 * O lado "gente" do shopping: barra de gestos (acenar, aplaudir, dançar,
 * rir, comemorar), a conversa (chat de todo o shopping) e o cartão de quem
 * a pessoa tocou (acenar para ela, ir até ela, mandar mensagem).
 */
import { textos } from "../copy/textos";
import type { MensagemChat } from "../rede/rede";
import type { Visual } from "../avatar/avatares";
import { h, icone } from "./dom";
import type { Interface } from "./interface";

export const GESTOS_BARRA = ["acenar", "aplaudir", "dancar", "rir", "comemorar"];

export function montarBarraGestos(pai: HTMLElement, aoGesto: (g: string) => void) {
  const t = textos.social;
  const barra = h(
    "div",
    { class: "gestos", role: "toolbar", "aria-label": t.gestos, hidden: true },
    GESTOS_BARRA.map((g, i) =>
      h("button", { type: "button", class: "gesto", title: `${t.nomes[g]} (${i + 1})`, "aria-label": t.nomes[g], onclick: () => aoGesto(g) }, h("span", { "aria-hidden": "true" }, t.emojis[g]))
    )
  );
  pai.appendChild(barra);
  addEventListener("keydown", (e) => {
    const el = e.target as HTMLElement | null;
    if (barra.hidden || (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA"))) return;
    const i = Number(e.key) - 1;
    if (i >= 0 && i < GESTOS_BARRA.length) aoGesto(GESTOS_BARRA[i]);
  });
  return barra;
}

const hora = (ms: number) => new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function painelConversa(ui: Interface, mensagens: MensagemChat[], meuId: string | null, online: boolean, aoEnviar: (texto: string) => void, aoConvidar: () => void, inicial = "") {
  const t = textos.social;
  const lista = h("ol", { class: "conversa", "aria-live": "polite" });
  const desenhar = () => {
    lista.replaceChildren(
      ...(mensagens.length
        ? mensagens.map((m) =>
            h(
              "li",
              { class: m.id === meuId ? "minha" : "" },
              h("span", { class: "quem" }, m.id === meuId ? t.voce : m.nome, h("time", {}, hora(m.hora))),
              h("span", { class: "texto" }, m.texto)
            )
          )
        : [h("li", { class: "vazia" }, t.vazia)])
    );
    lista.lastElementChild?.scrollIntoView({ block: "end" });
  };
  desenhar();
  const campo = h("input", { type: "text", maxlength: 140, placeholder: online ? t.escrever : t.conectando, autocomplete: "off", "aria-label": t.escrever, value: inicial });
  campo.disabled = !online;
  const enviar = () => {
    const texto = campo.value.trim();
    if (!texto) return;
    aoEnviar(texto);
    campo.value = "";
  };
  campo.addEventListener("keydown", (e) => e.key === "Enter" && enviar());
  ui.abrirPainel(
    "conversa",
    t.conversa,
    [h("p", { class: "nota" }, online ? "" : t.offline), lista],
    [campo, h("button", { class: "principal", type: "button", onclick: enviar, disabled: !online }, t.enviar), h("button", { class: "fechar", type: "button", title: t.chamar, "aria-label": t.chamar, onclick: aoConvidar }, icone("convidar"))]
  );
  if (online) campo.focus({ preventScroll: true });
  const nota = ui.raiz.querySelector(".painel .nota") as HTMLElement | null;
  if (nota && online) nota.hidden = true;
  return { atualizar: desenhar };
}

export function painelPessoa(ui: Interface, nome: string, visual: Visual, acoes: { acenar: () => void; ir: () => void; mensagem: () => void }) {
  const t = textos.social.pessoa;
  ui.abrirPainel(
    "pessoa",
    nome,
    [
      h("div", { class: "pessoa" }, h("img", { src: `./avatares/${visual.avatar}-retrato.webp`, alt: "", width: 96, height: 96 }), h("p", {}, t.aqui)),
      h("button", { class: "secundario largo", type: "button", onclick: acoes.acenar }, `${textos.social.emojis.acenar} ${t.acenar(nome)}`),
      h("button", { class: "secundario largo", type: "button", onclick: acoes.ir }, t.ir(nome)),
    ],
    [h("button", { class: "principal", type: "button", onclick: acoes.mensagem }, icone("conversa"), t.mensagem)]
  );
}
