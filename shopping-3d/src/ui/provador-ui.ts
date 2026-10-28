/**
 * Painel do provador: a grade de retratos (16 pessoas), as cores do cabelo,
 * da blusa e da calça/saia, o nome e o botão de entrar. Guarda a escolha no
 * aparelho para a próxima visita.
 */
import { textos } from "../copy/textos";
import { AVATARES, infoAvatar } from "../dados/avatares";
import { CORES_CABELO, CORES_CALCA, CORES_ROUPA, type Visual } from "../avatar/avatares";
import { h } from "./dom";

export interface Escolha extends Visual {
  nome: string;
}

const CHAVE = "shopping3d.visual";

export function lerEscolha(): Escolha {
  try {
    const e = JSON.parse(localStorage.getItem(CHAVE) ?? "null");
    if (e && AVATARES.some((a) => a.id === e.avatar)) return { avatar: e.avatar, cabelo: e.cabelo ?? null, cima: e.cima ?? null, baixo: e.baixo ?? null, nome: typeof e.nome === "string" ? e.nome : "" };
  } catch {
    /* primeira visita */
  }
  return { avatar: AVATARES[0].id, cabelo: null, cima: "#6b2bd9", baixo: null, nome: "" };
}

export function gravarEscolha(e: Escolha) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(e));
  } catch {
    /* sem armazenamento */
  }
}

export interface OpcoesProvadorUi {
  emShopping: boolean;
  aoMudar: (e: Escolha) => void;
  aoEntrar: (e: Escolha) => void;
}

export function montarProvadorUi(pai: HTMLElement, inicial: Escolha, op: OpcoesProvadorUi) {
  const e: Escolha = { ...inicial };
  const t = textos.provador;
  const nomeCor = (chave: string) => (textos.cores as Record<string, string>)[chave] ?? chave;

  const retratos = h("div", { class: "retratos", role: "radiogroup", "aria-label": t.pessoa });
  const linhaCabelo = h("div", { class: "amostras", role: "radiogroup", "aria-label": t.cabelo });
  const linhaCima = h("div", { class: "amostras", role: "radiogroup", "aria-label": t.cima });
  const linhaBaixo = h("div", { class: "amostras", role: "radiogroup", "aria-label": t.baixo });
  const notaCabelo = h("p", { class: "nota-curta" }, t.semCabelo);
  const notaBaixo = h("p", { class: "nota-curta" }, t.semBaixo);

  const avisar = () => op.aoMudar({ ...e });

  const desenharRetratos = () =>
    retratos.replaceChildren(
      ...AVATARES.map((a, i) =>
        h(
          "button",
          {
            type: "button",
            role: "radio",
            class: "retrato",
            "aria-checked": String(e.avatar === a.id),
            "aria-label": t.pessoaN(i + 1),
            title: t.pessoaN(i + 1),
            onclick: () => {
              if (e.avatar === a.id) return;
              e.avatar = a.id;
              desenharRetratos();
              desenharCores();
              avisar();
            },
          },
          h("img", { src: `./avatares/${a.id}-retrato.webp`, alt: "", width: 72, height: 72, loading: i < 8 ? "eager" : "lazy" })
        )
      )
    );

  const linha = (el: HTMLElement, cores: [string, string][], atual: () => string | null, definir: (c: string | null) => void, original: string | null) => {
    const botao = (valor: string | null, cor: string, rotulo: string) =>
      h("button", {
        type: "button",
        role: "radio",
        class: valor === null ? "amostra original" : "amostra",
        "aria-checked": String(atual() === valor),
        "aria-label": rotulo,
        title: rotulo,
        style: `--cor:${cor}`,
        onclick: () => {
          definir(valor);
          desenharCores();
          avisar();
        },
      });
    el.replaceChildren(botao(null, original ?? "#bbb", textos.cores.original), ...cores.map(([k, c]) => botao(c, c, nomeCor(k))));
  };

  const secaoCabelo = h("section", {}, h("h2", {}, t.cabelo), linhaCabelo, notaCabelo);
  const secaoBaixo = h("section", {}, h("h2", {}, t.baixo), linhaBaixo, notaBaixo);

  function desenharCores() {
    const info = infoAvatar(e.avatar);
    linha(linhaCabelo, CORES_CABELO, () => e.cabelo, (c) => (e.cabelo = c), null);
    linha(linhaCima, CORES_ROUPA, () => e.cima, (c) => (e.cima = c), info.corCima);
    linha(linhaBaixo, CORES_CALCA, () => e.baixo, (c) => (e.baixo = c), info.corBaixo);
    linhaCabelo.hidden = !info.temCabelo;
    notaCabelo.hidden = info.temCabelo;
    linhaBaixo.hidden = !info.corBaixo;
    notaBaixo.hidden = !!info.corBaixo;
  }

  const nome = h("input", { type: "text", maxlength: 18, value: e.nome, autocomplete: "nickname", placeholder: t.nomeDica, id: "nome-visitante" });
  nome.addEventListener("input", () => (e.nome = nome.value));
  nome.addEventListener("keydown", (ev) => ev.key === "Enter" && entrar());
  const entrar = () => {
    e.nome = nome.value.trim();
    gravarEscolha(e);
    op.aoEntrar({ ...e });
  };

  desenharRetratos();
  desenharCores();
  const painel = h(
    "div",
    { class: "provador-ui" },
    h(
      "div",
      { class: "provador-topo" },
      h("div", { class: "hud-marca" }, h("span", { class: "hud-shopping" }, "Shopping da"), h("span", { class: "hud-beleza" }, "Beleza")),
      h("h1", {}, t.titulo),
      h("p", { class: "subtitulo" }, t.subtitulo)
    ),
    h(
      "div",
      { class: "provador-rolagem" },
      h("section", {}, h("h2", {}, t.pessoa), retratos),
      secaoCabelo,
      h("section", {}, h("h2", {}, t.cima), linhaCima),
      secaoBaixo,
      h("section", {}, h("label", { for: "nome-visitante" }, h("h2", {}, t.nome)), nome)
    ),
    h(
      "div",
      { class: "provador-rodape" },
      h("button", { class: "principal grande", type: "button", onclick: entrar }, op.emShopping ? t.voltar : t.entrar),
      h("p", { class: "nota-curta" }, `${t.girar} · ${t.salvo}`)
    )
  );
  pai.appendChild(painel);
  return { painel, remover: () => painel.remove() };
}
