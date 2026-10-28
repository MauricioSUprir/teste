/**
 * Painel da conta: entrar com o e-mail (código de 6 dígitos), ver o que fica
 * salvo, sair e apagar a conta. Abre por cima do provador ou do shopping.
 */
import { textos } from "../copy/textos";
import { conta } from "../dados/conta";
import { h } from "./dom";
import type { Interface } from "./interface";

const t = textos.conta;
let passo: "email" | "codigo" | "apagar" = "email";
let emailDigitado = "";
let aberto: Interface | null = null;

conta.ouvir(() => {
  // o estado muda sozinho (salvando, salvo, sem rede): o painel aberto acompanha
  if (aberto?.painelAberto === "conta" && passo !== "codigo") desenhar(aberto);
});

export function painelConta(ui: Interface) {
  aberto = ui;
  passo = conta.logada ? "email" : emailDigitado ? passo : "email";
  if (passo === "apagar" && !conta.logada) passo = "email";
  desenhar(ui);
}

function erroEm() {
  return h("p", { class: "erro-conta", role: "alert", hidden: true });
}

function mostrarErro(el: HTMLElement, texto: string) {
  el.textContent = texto;
  el.hidden = false;
}

/** botão que espera a resposta: fica desligado e, se demorar, avisa que o servidor está acordando */
async function esperando(botao: HTMLButtonElement, rotulo: string, nota: HTMLElement, f: () => Promise<void>) {
  const antes = botao.textContent ?? "";
  botao.disabled = true;
  botao.textContent = rotulo;
  const demora = setTimeout(() => mostrarErro(nota, t.demorando), 5000);
  try {
    await f();
  } finally {
    clearTimeout(demora);
    if (nota.textContent === t.demorando) nota.hidden = true;
    botao.disabled = false;
    botao.textContent = antes;
  }
}

const privacidade = () =>
  h("p", { class: "nota-curta" }, `${t.privacidade} `, h("a", { href: t.urlPolitica, target: "_blank", rel: "noopener" }, t.politica));

function desenhar(ui: Interface) {
  if (conta.logada) return passo === "apagar" ? desenharApagar(ui) : desenharConectada(ui);
  return passo === "codigo" ? desenharCodigo(ui) : desenharEmail(ui);
}

function desenharEmail(ui: Interface) {
  const erro = erroEm();
  const campo = h("input", { type: "email", inputmode: "email", autocomplete: "email", placeholder: t.emailDica, value: emailDigitado, id: "conta-email" });
  const enviar = h("button", { class: "principal", type: "button" }, t.receberCodigo);
  const ir = () => {
    const email = campo.value.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return mostrarErro(erro, t.erroEmail);
    erro.hidden = true;
    void esperando(enviar, t.enviando, erro, async () => {
      try {
        await conta.pedirCodigo(email);
        emailDigitado = email;
        passo = "codigo";
        desenhar(ui);
      } catch (e) {
        mostrarErro(erro, (e as Error).message);
      }
    });
  };
  enviar.addEventListener("click", ir);
  campo.addEventListener("keydown", (e) => e.key === "Enter" && ir());
  ui.abrirPainel(
    "conta",
    t.titulo,
    [h("p", {}, t.convite), h("p", { class: "nota" }, t.semSenha), h("label", { class: "campo", for: "conta-email" }, h("span", {}, t.email), campo), erro, privacidade()],
    [enviar]
  );
}

function desenharCodigo(ui: Interface) {
  const erro = erroEm();
  const campo = h("input", { type: "text", inputmode: "numeric", autocomplete: "one-time-code", maxlength: 6, pattern: "[0-9]*", id: "conta-codigo", class: "codigo" });
  const entrar = h("button", { class: "principal", type: "button" }, t.entrar);
  const ir = () => {
    const codigo = campo.value.replace(/\D/g, "");
    if (codigo.length !== 6) return mostrarErro(erro, t.erroCodigo);
    erro.hidden = true;
    void esperando(entrar, t.entrando, erro, async () => {
      try {
        const { trouxe } = await conta.entrar(emailDigitado, codigo);
        passo = "email";
        desenhar(ui);
        ui.avisar(trouxe ? t.trouxe : t.pronta, 4500);
      } catch (e) {
        mostrarErro(erro, (e as Error).message);
      }
    });
  };
  entrar.addEventListener("click", ir);
  campo.addEventListener("keydown", (e) => e.key === "Enter" && ir());
  // colou ou o celular preencheu sozinho: entra direto
  campo.addEventListener("input", () => campo.value.replace(/\D/g, "").length === 6 && ir());
  const outro = h("button", { class: "secundario pequeno", type: "button" }, t.outroCodigo);
  outro.addEventListener("click", () =>
    void esperando(outro, t.enviando, erro, async () => {
      try {
        await conta.pedirCodigo(emailDigitado);
        mostrarErro(erro, t.codigoDeNovo);
      } catch (e) {
        mostrarErro(erro, (e as Error).message);
      }
    })
  );
  ui.abrirPainel(
    "conta",
    t.titulo,
    [h("p", {}, t.codigoEnviado(emailDigitado)), h("label", { class: "campo", for: "conta-codigo" }, h("span", {}, t.codigo), campo), erro, outro],
    [
      h("button", { class: "secundario", type: "button", onclick: () => ((passo = "email"), desenhar(ui)) }, t.trocarEmail),
      entrar,
    ]
  );
  campo.focus({ preventScroll: true });
}

function textoEstado() {
  const e = conta.estado;
  if (e === "carregando") return t.estado.carregando;
  if (e === "salvando") return t.estado.salvando;
  if (e === "semRede") return t.estado.semRede;
  const hora = (conta.salvoEm ?? new Date()).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return t.estado.salvo(hora);
}

function desenharConectada(ui: Interface) {
  const sair = h("button", { class: "secundario", type: "button" }, t.sair);
  sair.addEventListener("click", () => {
    sair.disabled = true;
    void conta.sair().then(() => {
      ui.fecharPainel();
      ui.avisar(t.saiu, 4500);
    });
  });
  ui.abrirPainel(
    "conta",
    t.titulo,
    [
      h("p", { class: "conta-email" }, h("span", {}, t.conectada), h("strong", {}, conta.email ?? "")),
      h("p", { class: `conta-estado ${conta.estado}`, role: "status" }, textoEstado()),
      h("h3", {}, t.oQueFica),
      h("ul", { class: "lista" }, t.itens.map((i) => h("li", {}, i))),
      h("button", { class: "secundario pequeno perigo", type: "button", onclick: () => ((passo = "apagar"), desenhar(ui)) }, t.apagar),
      privacidade(),
    ],
    [sair, h("button", { class: "principal", type: "button", onclick: () => ui.fecharPainel() }, textos.produto.fechar)]
  );
}

function desenharApagar(ui: Interface) {
  const erro = erroEm();
  const apagar = h("button", { class: "principal perigo", type: "button" }, t.apagarSim);
  apagar.addEventListener("click", () =>
    void esperando(apagar, t.enviando, erro, async () => {
      try {
        await conta.apagar();
        passo = "email";
        ui.fecharPainel();
        ui.avisar(t.apagada, 4500);
      } catch (e) {
        mostrarErro(erro, (e as Error).message);
      }
    })
  );
  ui.abrirPainel(
    "conta",
    t.apagarTitulo,
    [h("p", {}, t.apagarTexto), erro],
    [h("button", { class: "secundario", type: "button", onclick: () => ((passo = "email"), desenhar(ui)) }, t.cancelar), apagar]
  );
}
