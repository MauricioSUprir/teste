/**
 * O conteúdo de cada painel: produto, sacola, caixa, aluguel, editor da loja,
 * mapa e ajuda. Cada função recebe a Interface e o que fazer nos botões.
 */
import { textos } from "../copy/textos";
import { fichaDe, formatarPreco, fotoDe, nomeMarca, precoPix, type Produto } from "../dados/catalogo";
import { ANCORAS, PLANTA, UNIDADES, type Inquilino, type LojaPrevia, type Unidade } from "../dados/lojas";
import { sacola, totalDe } from "../dados/sacola";
import { h, icone } from "./dom";
import { fichaEmHtml } from "./ficha";
import { blocoPreco, type Interface } from "./interface";

export function painelProduto(ui: Interface, p: Produto, loja: Inquilino, aoColocar: () => void) {
  let qtd = 1;
  const numero = h("output", { "aria-live": "polite" }, "1");
  const muda = (d: number) => {
    qtd = Math.max(1, Math.min(9, qtd + d));
    numero.textContent = String(qtd);
  };
  const colocar = h(
    "button",
    {
      class: "principal",
      type: "button",
      onclick: () => {
        sacola.colocar(p, { id: loja.id, nome: loja.nome, unidade: loja.unidade }, qtd);
        colocar.textContent = textos.produto.colocado;
        colocar.classList.add("feito");
        aoColocar();
        setTimeout(() => ui.painelAberto === `produto:${p.id}` && ui.fecharPainel(), 900);
      },
    },
    icone("sacola"),
    textos.produto.colocar
  );
  ui.abrirPainel(
    `produto:${p.id}`,
    nomeMarca(p.marca),
    [
      h("div", { class: "foto-produto" }, h("img", { src: fotoDe(p), alt: p.titulo, decoding: "async" })),
      h("h3", { class: "titulo-produto" }, p.titulo),
      blocoPreco(p),
      fichaEmHtml(fichaDe(p)),
      h("p", { class: "vendido" }, textos.produto.vendidoPor(loja.nome)),
    ],
    [
      h(
        "div",
        { class: "quantidade", role: "group", "aria-label": textos.produto.quantidade },
        h("button", { type: "button", "aria-label": textos.sacola.menos, onclick: () => muda(-1) }, icone("menos")),
        numero,
        h("button", { type: "button", "aria-label": textos.sacola.mais, onclick: () => muda(1) }, icone("mais"))
      ),
      colocar,
    ]
  );
}

export function painelSacola(ui: Interface, aoLevar: (unidade: string) => void) {
  const desenhar = () => {
    const lojas = sacola.lojas();
    if (!lojas.length) {
      ui.abrirPainel("sacola", textos.sacola.titulo, [h("p", { class: "vazio" }, textos.sacola.vazia)]);
      return;
    }
    const blocos = lojas.map((l) => {
      const itens = sacola.daLoja(l.id);
      return h(
        "section",
        { class: "sacola-loja" },
        h("h3", {}, textos.sacola.daLoja(l.nome)),
        h(
          "ul",
          {},
          itens.map((i) =>
            h(
              "li",
              { class: "item" },
              h("img", { src: fotoDe(i.produto), alt: "", width: 56, height: 56 }),
              h("div", { class: "item-texto" }, h("span", { class: "item-titulo" }, i.produto.titulo), h("strong", {}, formatarPreco(i.produto.preco * i.qtd))),
              h(
                "div",
                { class: "quantidade pequena" },
                h("button", { type: "button", "aria-label": textos.sacola.menos, onclick: () => (sacola.mudar(i.produto.id, i.lojaId, -1), desenhar()) }, icone("menos")),
                h("output", {}, String(i.qtd)),
                h("button", { type: "button", "aria-label": textos.sacola.mais, onclick: () => (sacola.mudar(i.produto.id, i.lojaId, 1), desenhar()) }, icone("mais"))
              )
            )
          )
        ),
        h("p", { class: "subtotal" }, h("span", {}, textos.sacola.subtotal), h("strong", {}, formatarPreco(totalDe(itens)))),
        h("button", { class: "secundario", type: "button", onclick: () => aoLevar(l.unidade) }, icone("loja"), textos.sacola.levar(l.nome))
      );
    });
    ui.abrirPainel("sacola", textos.sacola.titulo, [h("p", { class: "nota" }, textos.sacola.comoPagar), ...blocos]);
  };
  desenhar();
}

export function painelCaixa(ui: Interface, loja: Inquilino) {
  const itens = sacola.daLoja(loja.id);
  const t = textos.caixa;
  if (!itens.length) {
    ui.abrirPainel("caixa", t.titulo(loja.nome), [h("p", { class: "fala" }, h("strong", {}, loja.atendente.nome), t.nadaDaqui(loja.nome))], [h("button", { class: "principal", type: "button", onclick: () => ui.fecharPainel() }, t.voltar)]);
    return;
  }
  const total = totalDe(itens);
  ui.abrirPainel(
    "caixa",
    t.titulo(loja.nome),
    [
      h("p", { class: "fala" }, h("strong", {}, loja.atendente.nome), t.ola),
      h("h3", {}, t.resumo),
      h(
        "ul",
        { class: "resumo" },
        itens.map((i) => h("li", {}, h("span", {}, `${i.qtd}× ${i.produto.titulo}`), h("strong", {}, formatarPreco(i.produto.preco * i.qtd))))
      ),
      h("p", { class: "total" }, h("span", {}, t.total), h("strong", {}, formatarPreco(total))),
      h("p", { class: "total pix" }, h("span", {}, t.totalPix), h("strong", {}, formatarPreco(precoPix(total)))),
      h("h3", {}, t.formas),
      h(
        "ul",
        { class: "formas" },
        h("li", {}, h("div", {}, h("strong", {}, t.pix), h("span", {}, t.pixDesc)), h("em", {}, t.emBreve)),
        h("li", {}, h("div", {}, h("strong", {}, t.cartao), h("span", {}, t.cartaoDesc)), h("em", {}, t.emBreve))
      ),
      h("p", { class: "nota" }, t.aviso),
    ],
    [h("button", { class: "principal", type: "button", onclick: () => ui.fecharPainel() }, t.voltar)]
  );
}

export function painelAluguel(ui: Interface, u: Unidade, aoMontar: () => void) {
  const a = textos.aluguel;
  const resposta = h("p", { class: "nota", hidden: true }, a.interesseTexto);
  ui.abrirPainel(
    "aluguel",
    a.titulo(u.numero),
    [
      h("p", { class: "destaque" }, a.area(u.area), h("br", {}), a.frente(PLANTA.frente)),
      h("h3", {}, a.inclui),
      h("ul", { class: "lista" }, a.itens.map((i) => h("li", {}, i))),
      resposta,
    ],
    [
      h("button", { class: "secundario", type: "button", onclick: () => (resposta.hidden = false) }, a.interesse),
      h("button", { class: "principal", type: "button", onclick: aoMontar }, a.montar),
    ]
  );
}

const CORES_MARCA = ["#6B2BD9", "#C2185B", "#E8467C", "#D97706", "#0F766E", "#1D4ED8", "#13315C", "#1C1714", "#7C2D12", "#4D7C0F"];
const CORES_PAREDE = ["#FBF8FF", "#FFF7F2", "#F1F5FA", "#F4EEE7", "#F2F2F0", "#FDF2F8", "#ECFDF5", "#2B2B30"];

export function painelEditor(ui: Interface, u: Unidade, inicial: LojaPrevia | null, aoSalvar: (l: LojaPrevia) => void, aoDesmontar: (() => void) | null) {
  const e = textos.editor;
  const l: LojaPrevia = inicial ?? { nome: e.nomePadrao, slogan: e.sloganPadrao, primaria: CORES_MARCA[1], parede: CORES_PAREDE[1], piso: "madeira", letra: "moderna", categoria: "maquiagem" };
  const campo = (rotulo: string, el: HTMLElement) => h("label", { class: "campo" }, h("span", {}, rotulo), el);
  const nome = h("input", { type: "text", maxlength: 22, value: l.nome, autocomplete: "off" });
  nome.addEventListener("input", () => (l.nome = nome.value));
  const slogan = h("input", { type: "text", maxlength: 36, value: l.slogan, autocomplete: "off" });
  slogan.addEventListener("input", () => (l.slogan = slogan.value));
  const amostras = (cores: string[], atual: () => string, definir: (c: string) => void, rotulo: string) => {
    const grupo = h("div", { class: "amostras", role: "radiogroup", "aria-label": rotulo });
    const desenhar = () =>
      grupo.replaceChildren(
        ...cores.map((c) =>
          h("button", {
            type: "button",
            role: "radio",
            "aria-checked": String(atual() === c),
            "aria-label": c,
            class: "amostra",
            style: `--cor:${c}`,
            onclick: () => {
              definir(c);
              desenhar();
            },
          })
        )
      );
    desenhar();
    return grupo;
  };
  const opcoes = <K extends string>(mapa: Record<K, string>, atual: () => K, definir: (k: K) => void, rotulo: string) => {
    const grupo = h("div", { class: "opcoes", role: "radiogroup", "aria-label": rotulo });
    const desenhar = () =>
      grupo.replaceChildren(
        ...(Object.keys(mapa) as K[]).map((k) =>
          h(
            "button",
            {
              type: "button",
              role: "radio",
              "aria-checked": String(atual() === k),
              onclick: () => {
                definir(k);
                desenhar();
              },
            },
            mapa[k]
          )
        )
      );
    desenhar();
    return grupo;
  };
  ui.abrirPainel(
    "editor",
    `${e.titulo} · ${textos.aluguel.unidade(u.numero)}`,
    [
      h("p", { class: "nota" }, e.previa),
      campo(e.nome, nome),
      campo(e.slogan, slogan),
      h("div", { class: "campo" }, h("span", {}, e.cor), amostras(CORES_MARCA, () => l.primaria, (c) => (l.primaria = c), e.cor)),
      h("div", { class: "campo" }, h("span", {}, e.parede), amostras(CORES_PAREDE, () => l.parede, (c) => (l.parede = c), e.parede)),
      h("div", { class: "campo" }, h("span", {}, e.piso), opcoes(e.pisos, () => l.piso, (k) => (l.piso = k), e.piso)),
      h("div", { class: "campo" }, h("span", {}, e.letra), opcoes(e.letras, () => l.letra, (k) => (l.letra = k), e.letra)),
      h("div", { class: "campo" }, h("span", {}, e.produtos), opcoes(e.categorias, () => l.categoria, (k) => (l.categoria = k), e.produtos)),
    ],
    [
      aoDesmontar ? h("button", { class: "secundario", type: "button", onclick: aoDesmontar }, e.desmontar) : null,
      h("button", { class: "principal", type: "button", onclick: () => aoSalvar({ ...l }) }, e.salvar),
    ]
  );
}

/** mapa visto de cima: corredor, lojas, praça e onde a pessoa está */
export function painelMapa(ui: Interface, ocupadas: Map<string, Inquilino>, pos: () => { x: number; z: number }, aoIr: (unidade: string) => void) {
  const m = textos.mapa;
  // escala: 1 m = k px; o desenho (galeria, praça e âncoras) cabe em 300 px de largura
  const k = 4.4;
  const X = (x: number) => 150 + x * k;
  const Z = (z: number) => 14 + (PLANTA.zEntrada - z) * k;
  const fundoAncoras = Math.min(...ANCORAS.map((a) => a.cz - 10.5));
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 300 ${Z(fundoAncoras) + 14}`);
  svg.setAttribute("class", "mapa");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", m.titulo);
  const ns = (tag: string, attrs: Record<string, string | number>) => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [a, v] of Object.entries(attrs)) el.setAttribute(a, String(v));
    svg.appendChild(el);
    return el;
  };
  ns("rect", { x: X(-PLANTA.meioCorredor), y: Z(PLANTA.zEntrada), width: PLANTA.meioCorredor * 2 * k, height: (PLANTA.zEntrada - PLANTA.zLojasNorte) * k, fill: "#f4efe9" });
  ns("rect", { x: X(-PLANTA.meiaPraca), y: Z(PLANTA.zLojasNorte), width: PLANTA.meiaPraca * 2 * k, height: (PLANTA.zLojasNorte - PLANTA.zPraca) * k, fill: "#efe6f3" });
  ns("circle", { cx: X(0), cy: Z(-33), r: 3.5 * k, fill: "#9cc8dc" });
  const tx = ns("text", { x: X(0), y: Z(-39.5), "text-anchor": "middle", class: "mapa-rotulo" });
  tx.textContent = textos.hud.praca;
  const lista = h("ul", { class: "mapa-lista" });
  for (const a of ANCORAS) {
    const q = a.inquilino;
    const r = ns("rect", { x: X(a.cx - 15.4) + 1, y: Z(a.cz + 10.5) + 1, width: 30.8 * k - 2, height: 21 * k - 2, rx: 5, fill: q.estilo.primaria, class: "mapa-loja" });
    r.addEventListener("click", () => aoIr(q.unidade));
    const t = ns("text", { x: X(a.cx), y: Z(a.cz) + 4, "text-anchor": "middle", class: "mapa-nome" });
    t.textContent = q.nome;
    lista.appendChild(
      h(
        "li",
        {},
        h("span", { class: "ponto", style: `--cor:${q.estilo.primaria}` }),
        h("span", { class: "nome" }, `${q.nome} · ${textos.ancora.loja}`),
        h("button", { type: "button", class: "secundario pequeno", onclick: () => aoIr(q.unidade) }, m.ir)
      )
    );
  }
  for (const u of UNIDADES) {
    const q = ocupadas.get(u.numero);
    const x0 = u.lado > 0 ? X(PLANTA.meioCorredor) : X(-PLANTA.fundoLoja);
    const r = ns("rect", { x: x0 + 1, y: Z(u.z1) + 1, width: (PLANTA.fundoLoja - PLANTA.meioCorredor) * k - 2, height: PLANTA.frente * k - 2, rx: 4, fill: q ? (q.estilo.letreiro === "pulse" ? "#3a2b22" : q.estilo.primaria) : "#d9d2ca", class: "mapa-loja" });
    r.addEventListener("click", () => aoIr(u.numero));
    const t = ns("text", { x: x0 + ((PLANTA.fundoLoja - PLANTA.meioCorredor) * k) / 2, y: Z(u.zc) + 4, "text-anchor": "middle", class: q ? "mapa-nome" : "mapa-nome vaga" });
    t.textContent = q ? q.nome : u.numero;
    lista.appendChild(
      h(
        "li",
        {},
        h("span", { class: "ponto", style: `--cor:${q ? q.estilo.primaria : "#bdb3a8"}` }),
        h("span", { class: "nome" }, q ? q.nome : `${textos.aluguel.unidade(u.numero)} · ${m.alugar}`),
        h("button", { type: "button", class: "secundario pequeno", onclick: () => aoIr(u.numero) }, m.ir)
      )
    );
  }
  const voce = ns("circle", { r: 6, fill: "#e8467c", stroke: "#fff", "stroke-width": 2.5 });
  const atualizar = () => {
    if (ui.painelAberto !== "mapa") return;
    const p = pos();
    voce.setAttribute("cx", String(X(p.x)));
    voce.setAttribute("cy", String(Z(p.z)));
    requestAnimationFrame(atualizar);
  };
  ui.abrirPainel("mapa", m.titulo, [svg, h("h3", {}, m.lojas), lista]);
  atualizar();
}

export function painelAjuda(ui: Interface) {
  const a = textos.ajuda;
  const linhas = ui.celular ? [a.toque, a.acao] : [a.teclado, a.mouse, a.clique, a.acao];
  ui.abrirPainel("ajuda", a.titulo, [h("ul", { class: "lista" }, linhas.map((l) => h("li", {}, l)))], [h("button", { class: "principal", type: "button", onclick: () => ui.fecharPainel() }, a.fechar)]);
}
