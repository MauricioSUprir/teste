/**
 * Servidor BeautyNow — a parte que o site estático não pode fazer sozinho:
 *
 *   1. POST /codigo            → gera o código de verificação e ENVIA POR E-MAIL
 *   2. POST /codigo/verificar  → confere o código digitado no site
 *   3. POST /pedidos           → repassa o pedido ao Hub Suprir com a X-API-Key
 *                                (a chave vive SÓ aqui, nunca no navegador)
 *
 * Configuração por variáveis de ambiente (ver .env.example na raiz):
 *   PORTA                porta HTTP (padrão 4000)
 *   ORIGENS_PERMITIDAS   origens liberadas no CORS, separadas por vírgula
 *   EMAIL_MODO           "gmail" (produção) ou "console" (teste: código no log)
 *   EMAIL_USUARIO        conta Gmail remetente (ex.: lojabeautynow@gmail.com)
 *   EMAIL_SENHA_APP      senha de app do Gmail (Conta Google → Segurança →
 *                        Verificação em 2 etapas → Senhas de app)
 *   HUB_API_URL          https://comercial.thebeautyhub.app/api/loja
 *   HUB_API_KEY          chave do Hub Suprir (grava pedido — só no servidor!)
 */
import express from "express";
import cors from "cors";
import { createTransport } from "nodemailer";
import { randomInt } from "node:crypto";

// Render/Heroku definem PORT; localmente usamos PORTA (padrão 4000)
const PORTA = Number(process.env.PORTA ?? process.env.PORT ?? 4000);
/** e-mails de administrador que recebem a notificação de cada venda */
const EMAILS_NOTIFICACAO = (process.env.ADMIN_NOTIFICACAO_EMAILS ?? "lojabeautynow@gmail.com")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);
const ORIGENS = (process.env.ORIGENS_PERMITIDAS ?? "https://mauriciosuprir.github.io,http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const EMAIL_MODO = process.env.EMAIL_MODO ?? "console";
const HUB_API_URL = (process.env.HUB_API_URL ?? "https://comercial.thebeautyhub.app/api/loja").replace(/\/$/, "");
const HUB_API_KEY = process.env.HUB_API_KEY ?? "";
/** Access Token do Mercado Pago (teste ou produção) — liga o pagamento real */
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN ?? "";
const MP_API = "https://api.mercadopago.com";
/** URL pública do site, usada nos retornos do Checkout Pro */
const SITE_URL = (process.env.SITE_URL ?? "https://mauriciosuprir.github.io/teste").replace(/\/$/, "");
const SITE_URL_B2B = (process.env.SITE_URL_B2B ?? "https://www.be2beauty.com.br").replace(/\/$/, "");

/** As duas lojas usam o mesmo servidor — o pedido diz de qual loja veio, pra
 * voltar pro site certo depois do pagamento e identificar a marca no extrato. */
function dadosDaLoja(lojaId) {
  return lojaId === "be2beauty"
    ? { siteUrl: SITE_URL_B2B, statementDescriptor: "BE2BEAUTY" }
    : { siteUrl: SITE_URL, statementDescriptor: "BEAUTYNOW" };
}

const VALIDADE_MS = 10 * 60_000;
const MAX_TENTATIVAS = 5;
const MAX_ENVIOS_POR_JANELA = 3;

const aplicacao = express();
// upload de logos precisa de corpo maior (imagem em base64) — antes do parser
// geral, senão o limite de 100kb derruba o envio primeiro
aplicacao.use("/enviar-logos", express.json({ limit: "8mb" }));
aplicacao.use("/enviar-banners", express.json({ limit: "10mb" }));
aplicacao.use(express.json({ limit: "100kb" }));
aplicacao.use(cors({ origin: ORIGENS }));

// transporte de e-mail — timeouts explícitos: sem eles, uma conexão
// engasgada com o Gmail deixa o /codigo pendurado e o site sem resposta
const EMAIL_USUARIO = (process.env.EMAIL_USUARIO ?? "").trim();
const EMAIL_SENHA_APP = (process.env.EMAIL_SENHA_APP ?? "").replace(/\s+/g, "");
/** chave de API do Brevo (envio via HTTPS — funciona onde SMTP é bloqueado,
 * como no plano gratuito do Render) */
const BREVO_API_KEY = (process.env.BREVO_API_KEY ?? "").trim();
const transporte =
  EMAIL_MODO === "gmail"
    ? createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: EMAIL_USUARIO, pass: EMAIL_SENHA_APP },
        connectionTimeout: 15_000,
        greetingTimeout: 10_000,
        socketTimeout: 30_000,
      })
    : null;

const brevoAtivo = EMAIL_MODO === "brevo" && BREVO_API_KEY.length > 0;
/** o site pergunta em /saude se o e-mail real está ligado */
const emailRealLigado = () => brevoAtivo || transporte !== null;

async function enviarViaBrevo({ para, assunto, texto, html }) {
  const resposta = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: "BeautyNow", email: EMAIL_USUARIO },
      to: [{ email: para }],
      subject: assunto,
      textContent: texto,
      htmlContent: html,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => "");
    throw new Error(`Brevo respondeu ${resposta.status}: ${corpo.slice(0, 200)}`);
  }
}

/** envia por qualquer modo ativo (brevo → gmail → console) */
async function enviarEmail({ para, assunto, texto, html }) {
  if (brevoAtivo) return enviarViaBrevo({ para, assunto, texto, html });
  if (transporte) {
    return transporte.sendMail({
      from: `"BeautyNow" <${EMAIL_USUARIO}>`,
      to: para,
      subject: assunto,
      text: texto,
      html,
    });
  }
  console.log(`[email-teste] para=${para} assunto="${assunto}"`);
}

// testa a autenticação no boot — o resultado aparece nos logs do Render
if (transporte) {
  transporte
    .verify()
    .then(() => console.log("[email] Gmail autenticado com sucesso — envio real ativo"))
    .catch((erro) =>
      console.error(
        `[email] FALHA na autenticação do Gmail (${erro.code ?? "?"}): ${erro.message} — confira EMAIL_USUARIO e EMAIL_SENHA_APP`
      )
    );
}
if (brevoAtivo) console.log("[email] modo Brevo ativo — envio via HTTPS");

async function enviarEmailCodigo(email, codigo) {
  const texto = `Seu código de verificação BeautyNow é: ${codigo}\n\nEle vale por 10 minutos. Se você não tentou entrar, ignore este e-mail.`;
  if (!emailRealLigado()) {
    // modo console (teste): o código sai no log do servidor
    console.log(`[email-teste] para=${email} codigo=${codigo}`);
    return;
  }
  await enviarEmail({
    para: email,
    assunto: `Seu código BeautyNow: ${codigo}`,
    texto,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px">
        <p style="font-size:22px;font-weight:bold;margin:0">
          <span style="color:#4A2882">BN</span>
          <span style="color:#6847C8;font-size:12px;letter-spacing:4px">BEAUTY NOW</span>
        </p>
        <h2 style="color:#14161A">Confirme que é você</h2>
        <p style="color:#4A4F57">Use o código abaixo para concluir seu login. Ele vale por 10 minutos.</p>
        <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#4A2882;background:#F2EDFA;padding:16px;text-align:center;border-radius:10px">${codigo}</p>
        <p style="color:#8A9099;font-size:12px">Se você não tentou entrar, ignore este e-mail.</p>
      </div>`,
  });
}

const formatarReais = (centavos) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Notificação de venda para o(s) admin(s) — logo BN no topo e tipografia
 * da marca (serifada nos títulos com fallback Georgia; corpo Arial/Inter,
 * como e-mail exige). Enviada a cada pedido concluído no site.
 */
async function notificarVenda(pedido) {
  const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
  const linhasItens = itens
    .map(
      (i) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #E4E6EA;color:#14161A">${i.quantidade}× ${i.titulo}</td>
          <td style="padding:8px 0;border-bottom:1px solid #E4E6EA;color:#14161A;text-align:right;white-space:nowrap">${formatarReais((i.precoCentavos ?? 0) * (i.quantidade ?? 1))}</td>
        </tr>`
    )
    .join("");
  const meio = pedido.meio === "pix" ? "Pix" : pedido.meio === "cartao" ? "Cartão" : "Boleto";
  const assunto = `🛍 Nova venda ${pedido.numero} — ${formatarReais(pedido.totalCentavos ?? 0)}`;
  const html = `
    <div style="background:#F7F8FA;padding:24px 12px;font-family:Inter,Arial,Helvetica,sans-serif">
      <div style="max-width:520px;margin:auto;background:#FFFFFF;border-radius:16px;padding:28px;border:1px solid #E4E6EA">
        <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:bold;letter-spacing:-0.5px">
          <span style="color:#4A2882">BN</span>
          <span style="font-family:Inter,Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:4px;color:#6847C8">&nbsp;BEAUTY&nbsp;NOW</span>
        </p>
        <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:24px;color:#14161A;margin:20px 0 4px">Você fez uma venda! 🎉</h1>
        <p style="color:#4A4F57;font-size:14px;margin:0 0 20px">
          Pedido <strong style="color:#4A2882">${pedido.numero}</strong> · ${new Date(pedido.data ?? Date.now()).toLocaleString("pt-BR")}
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">${linhasItens}</table>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px">
          <tr>
            <td style="color:#4A4F57;padding:4px 0">Cliente</td>
            <td style="text-align:right;color:#14161A">${pedido.clienteNome ?? "—"} · ${pedido.clienteEmail ?? ""}</td>
          </tr>
          <tr>
            <td style="color:#4A4F57;padding:4px 0">Pagamento</td>
            <td style="text-align:right;color:#14161A">${meio}</td>
          </tr>
          <tr>
            <td style="color:#4A4F57;padding:8px 0;font-size:16px"><strong>Total</strong></td>
            <td style="text-align:right;color:#4A2882;font-size:20px;font-weight:bold;padding:8px 0">${formatarReais(pedido.totalCentavos ?? 0)}</td>
          </tr>
        </table>
        <a href="https://mauriciosuprir.github.io/teste/admin"
           style="display:block;text-align:center;background:#4A2882;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15px;border-radius:999px;padding:14px;margin-top:20px">
          Abrir painel do administrador
        </a>
        <p style="color:#8A9099;font-size:11px;margin:16px 0 0;text-align:center">BeautyNow · notificação automática de venda</p>
      </div>
    </div>`;

  if (!emailRealLigado()) {
    console.log(`[email-teste] notificacao-venda para=${EMAILS_NOTIFICACAO.join(",")} pedido=${pedido.numero} total=${formatarReais(pedido.totalCentavos ?? 0)}`);
    return;
  }
  await Promise.all(
    EMAILS_NOTIFICACAO.map((destino) =>
      enviarEmail({
        para: destino,
        assunto,
        texto: `Nova venda ${pedido.numero} — total ${formatarReais(pedido.totalCentavos ?? 0)}`,
        html,
      })
    )
  );
}

// códigos pendentes em memória: email → {codigo, expiraEm, tentativas, envios[]}
const pendentes = new Map();

const emailValido = (e) => typeof e === "string" && /^\S+@\S+\.\S+$/.test(e) && e.length <= 254;

aplicacao.get("/saude", (_req, res) => {
  res.json({
    ok: true,
    emailModo: EMAIL_MODO,
    hubConfigurado: HUB_API_KEY.length > 0,
    mp: MP_ACCESS_TOKEN.length > 0,
    bling: Boolean(process.env.BLING_CLIENT_ID && process.env.BLING_CLIENT_SECRET),
  });
});

/**
 * Diagnóstico do e-mail em página legível — abre no navegador e mostra em
 * português se o Gmail autenticou. Não expõe a senha, só o motivo do erro.
 */
aplicacao.get("/saude/email", async (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  const pagina = (cor, titulo, detalhe) =>
    `<div style="font-family:Arial;max-width:560px;margin:40px auto;padding:24px;border:2px solid ${cor};border-radius:14px">
       <p style="font-size:20px;font-weight:bold;margin:0 0 8px;color:${cor}">${titulo}</p>
       <p style="color:#333;font-size:15px;line-height:1.5;margin:0">${detalhe}</p>
     </div>`;
  // --- modo Brevo (envio via HTTPS — recomendado no Render gratuito) ---
  if (EMAIL_MODO === "brevo") {
    if (!BREVO_API_KEY) {
      return res.send(
        pagina(
          "#B91C1C",
          "❌ Falta a chave do Brevo",
          `EMAIL_MODO está como "brevo", mas a variável <b>BREVO_API_KEY</b> está vazia. Cole a chave (começa com xkeysib-) nas variáveis do Render e salve.`
        )
      );
    }
    try {
      const resposta = await fetch("https://api.brevo.com/v3/account", {
        headers: { "api-key": BREVO_API_KEY, accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!resposta.ok) throw new Error(`Brevo respondeu ${resposta.status}`);
      const conta = await resposta.json();
      return res.send(
        pagina(
          "#15803D",
          "✅ Brevo conectado — envio real funcionando",
          `Conta Brevo: <b>${conta.email ?? "?"}</b> · remetente: <b>${EMAIL_USUARIO}</b>.<br><br>Pode testar o login no site: o código chegará por e-mail.`
        )
      );
    } catch (erro) {
      return res.send(
        pagina(
          "#B91C1C",
          "❌ Falha no Brevo",
          `<b>Erro:</b> ${String(erro.message).slice(0, 300)}<br><br>Confira se a BREVO_API_KEY foi colada inteira (começa com xkeysib-). Se respondeu 401, gere outra chave em app.brevo.com/settings/keys/api.`
        )
      );
    }
  }

  // --- modo Gmail (SMTP — bloqueado no plano gratuito do Render) ---
  if (!transporte) {
    return res.send(
      pagina(
        "#B45309",
        "⚠️ Modo teste (console)",
        `EMAIL_MODO está como "${EMAIL_MODO}". Troque para "brevo" (com BREVO_API_KEY) ou "gmail" nas variáveis do Render para enviar e-mail de verdade.`
      )
    );
  }
  const resumoConfig = `Remetente: <b>${EMAIL_USUARIO || "(EMAIL_USUARIO vazio!)"}</b> · senha de app com <b>${EMAIL_SENHA_APP.length}</b> caracteres (o certo são 16).`;
  try {
    await transporte.verify();
    res.send(
      pagina(
        "#15803D",
        "✅ Gmail autenticado — envio real funcionando",
        `${resumoConfig}<br><br>Pode testar o login no site: o código chegará por e-mail.`
      )
    );
  } catch (erro) {
    const codigo = erro.code ?? erro.responseCode ?? "?";
    const dica =
      codigo === "EAUTH"
        ? "O Gmail recusou usuário/senha. A senha de app precisa ter sido criada LOGADO na conta do remetente acima (myaccount.google.com/apppasswords) e colada inteira no EMAIL_SENHA_APP."
        : `Não foi possível conectar ao Gmail — este é o bloqueio de SMTP do plano gratuito do Render. Solução: troque EMAIL_MODO para <b>brevo</b> e preencha BREVO_API_KEY (conta gratuita em brevo.com).`;
    res.send(
      pagina(
        "#B91C1C",
        `❌ Falha no Gmail (código ${codigo})`,
        `${resumoConfig}<br><br><b>Erro:</b> ${String(erro.message).slice(0, 300)}<br><br>${dica}`
      )
    );
  }
});

/**
 * Exporta o catálogo bruto do Hub Suprir como arquivo JSON para download.
 * A coleta demora mais que o limite de ~100s por requisição do Render, então
 * roda em SEGUNDO PLANO: o link mostra uma página de progresso que se atualiza
 * sozinha e, ao terminar, oferece o botão de baixar.
 * Uso no navegador: /exportar-catalogo?chave=SUA_EXPORT_CHAVE
 */
const EXPORT_CHAVE = (process.env.EXPORT_CHAVE ?? "").trim();
const exportacao = { estado: "parado", progresso: "", json: null, erro: null };

async function coletarCatalogoHub(modo = "rapido") {
  // até 3 tentativas por chamada — o Hub às vezes demora/engasga
  const apiHub = async (caminho) => {
    let ultimoErro;
    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      try {
        const r = await fetch(`${HUB_API_URL}${caminho}`, {
          headers: { "X-API-Key": HUB_API_KEY },
          signal: AbortSignal.timeout(45_000),
        });
        if (!r.ok) throw new Error(`${caminho} → HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
        return r.json();
      } catch (erro) {
        ultimoErro = erro;
        if (tentativa < 3) await new Promise((f) => setTimeout(f, 2000 * tentativa));
      }
    }
    throw ultimoErro;
  };
  const valor = (obj, ...nomes) => {
    for (const n of nomes) {
      const v = n.split(".").reduce((acc, p) => (acc == null ? acc : acc[p]), obj);
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return undefined;
  };
  exportacao.progresso = "listando produtos…";
  const brutos = [];
  let pagina = 1;
  for (;;) {
    const lote = await apiHub(`/produtos?pagina=${pagina}&por_pagina=100`);
    const itens = Array.isArray(lote)
      ? lote
      : (lote.produtos ?? lote.dados ?? lote.data ?? lote.items ?? []);
    if (!itens.length) break;
    brutos.push(...itens);
    exportacao.progresso = `listando produtos… ${brutos.length}`;
    const totalPaginas = valor(lote, "total_paginas", "totalPages", "meta.total_paginas", "meta.last_page");
    if (totalPaginas && pagina >= Number(totalPaginas)) break;
    if (itens.length < 100) break;
    pagina++;
  }
  const detalhes = [];
  if (modo === "completo") {
    const skus = brutos.map((b) => valor(b, "sku", "codigo", "id")).filter((s) => s !== undefined);
    const CONCORRENCIA = 8;
    for (let i = 0; i < skus.length; i += CONCORRENCIA) {
      await Promise.all(
        skus.slice(i, i + CONCORRENCIA).map(async (sku) => {
          try {
            detalhes.push([String(sku), await apiHub(`/produtos/${encodeURIComponent(sku)}`)]);
          } catch {
            // ficha indisponível — a listagem já traz o essencial
          }
        })
      );
      exportacao.progresso = `fichas completas: ${Math.min(i + CONCORRENCIA, skus.length)}/${skus.length}`;
    }
  }
  return JSON.stringify({
    exportadoEm: new Date().toISOString(),
    total: brutos.length,
    brutos,
    detalhes,
  });
}

const paginaExport = (titulo, corpo, atualizar = false) =>
  `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
   ${atualizar ? '<meta http-equiv="refresh" content="8">' : ""}
   <title>Exportar catálogo — BeautyNow</title></head>
   <body style="font-family:Arial;background:#F7F8FA;margin:0;padding:40px 16px">
   <div style="max-width:560px;margin:auto;background:#fff;border:1px solid #E4E6EA;border-radius:14px;padding:28px">
   <p style="font-size:20px;font-weight:bold;margin:0 0 10px;color:#4A2882">${titulo}</p>
   <div style="color:#333;font-size:15px;line-height:1.6">${corpo}</div></div></body></html>`;

/**
 * Modo RÁPIDO (padrão da rota /exportar-catalogo/rapido): baixa só a
 * listagem paginada — nome, preço, marca, foto e estoque vêm nela — em
 * segundos, bem abaixo do limite de requisição do Render. As fichas
 * completas (descrição longa) ficam para o modo completo.
 */
aplicacao.get("/exportar-catalogo/rapido", (req, res) => {
  res.redirect(`/exportar-catalogo?chave=${encodeURIComponent(String(req.query.chave ?? ""))}`);
});

/**
 * Baixa o logo oficial de cada marca (a partir do site oficial pesquisado)
 * e devolve um JSON com as imagens em base64 para versionar no repositório.
 * Fontes: Clearbit Logo (valida o domínio) e favicon em alta do Google.
 */
const LOGOS_DOMINIOS = {
  arvensis: ["arvensis.com.br"],
  batiste: ["batistehair.com", "batiste.com.br"],
  bioderma: ["bioderma.com.br", "bioderma.com"],
  "beleza-brasileira": ["belezabrasileira.com.br"],
  "bruna-tavares": ["lojabrunatavares.com.br", "brunatavares.com.br"],
  byem: ["byem.com.br"],
  "d-vence": ["dvence.com.br"],
  dentalclean: ["dentalclean.com.br"],
  evoly: ["evoly.com.br", "evolyprofissional.com.br"],
  hidratei: ["hidratei.com.br"],
  issue: ["issueprofessional.com"],
  "jacques-janine": ["jacquesjanine.com.br"],
  joico: ["joico.com", "joico.com.br"],
  "k-pro": ["kpro.com.br", "lojakpro.com.br"],
  latika: ["latika.com.br"],
  "mari-maria": ["marimariamakeup.com"],
  mawwal: ["mawwal.com.br"],
  melu: ["melubyrubyrose.com.br", "rubyrose.com.br"],
  nina: ["ninamakeup.com.br", "loja.ninamakeup.com.br"],
  noue: ["nouecosmeticos.com.br"],
  oceane: ["oceane.com.br"],
  rebeel: ["rebeel.com.br"],
  reyou: ["reyou.com.br"],
  sallve: ["sallve.com.br"],
  senscience: ["senscience.com"],
  soffie: ["soffie.com.br"],
  "widi-care": ["widicare.com.br"],
};

aplicacao.get("/exportar-logos", async (req, res) => {
  if (!EXPORT_CHAVE || String(req.query.chave ?? "") !== EXPORT_CHAVE) {
    return res.status(403).json({ erro: "Chave de exportação inválida." });
  }
  const CABECALHOS_NAVEGADOR = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    Accept: "image/avif,image/webp,image/png,image/*,*/*;q=0.8",
  };
  const baixar = async (url) => {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      redirect: "follow",
      headers: CABECALHOS_NAVEGADOR,
    });
    if (!r.ok) return null;
    const tipo = r.headers.get("content-type") ?? "";
    if (!tipo.startsWith("image/")) return null;
    const bytes = Buffer.from(await r.arrayBuffer());
    if (bytes.length < 400) return null; // ícone vazio/degenerado
    return { mime: tipo.split(";")[0], base64: bytes.toString("base64"), bytes };
  };
  // lê a home do site e extrai o melhor ícone declarado no HTML
  const iconeDaHome = async (dominio) => {
    try {
      const r = await fetch(`https://${dominio}/`, {
        signal: AbortSignal.timeout(15_000),
        redirect: "follow",
        headers: { ...CABECALHOS_NAVEGADOR, Accept: "text/html" },
      });
      if (!r.ok) return null;
      const html = (await r.text()).slice(0, 200_000);
      const links = [...html.matchAll(/<link[^>]+rel=["']([^"']*icon[^"']*)["'][^>]*>/gi)].map(
        (m) => m[0]
      );
      // prioriza apple-touch-icon (180px) e ícones grandes
      links.sort((a, b) => {
        const nota = (t) =>
          (/apple-touch/i.test(t) ? 2 : 0) + (/sizes=["'](\d{3,})/i.test(t) ? 1 : 0);
        return nota(b) - nota(a);
      });
      for (const tag of links) {
        const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
        if (!href) continue;
        const url = href.startsWith("http")
          ? href
          : href.startsWith("//")
            ? `https:${href}`
            : `https://${dominio}${href.startsWith("/") ? "" : "/"}${href}`;
        const img = await baixar(url).catch(() => null);
        if (img) return img;
      }
      // fallback: apple-touch-icon em caminho padrão
      return (
        (await baixar(`https://${dominio}/apple-touch-icon.png`).catch(() => null)) ??
        (await baixar(`https://${dominio}/favicon.ico`).catch(() => null))
      );
    } catch {
      return null;
    }
  };
  // favicon "globo" padrão do Google (domínio inexistente) para descartar genéricos
  const padrao = await baixar(
    "https://www.google.com/s2/favicons?domain=dominio-inexistente-bn123.com.br&sz=128"
  ).catch(() => null);

  const logos = {};
  const falhas = [];
  for (const [slug, dominios] of Object.entries(LOGOS_DOMINIOS)) {
    let achado = null;
    for (const d of dominios) {
      achado =
        (await baixar(`https://logo.clearbit.com/${d}?size=256`).catch(() => null)) ??
        (await iconeDaHome(d)) ??
        (await (async () => {
          const f = await baixar(`https://www.google.com/s2/favicons?domain=${d}&sz=128`).catch(
            () => null
          );
          if (f && padrao && f.bytes.equals(padrao.bytes)) return null; // globo genérico
          return f;
        })());
      if (achado) {
        logos[slug] = { dominio: d, mime: achado.mime, base64: achado.base64 };
        break;
      }
    }
    if (!achado) falhas.push(slug);
    console.log(`[exportar-logos] ${slug}: ${achado ? "ok (" + logos[slug].dominio + ")" : "FALHOU"}`);
  }
  res.setHeader("Content-Disposition", 'attachment; filename="logos-marcas.json"');
  res.json({ geradoEm: new Date().toISOString(), total: Object.keys(logos).length, falhas, logos });
});

aplicacao.get("/exportar-catalogo", (req, res) => {
  if (!EXPORT_CHAVE || String(req.query.chave ?? "") !== EXPORT_CHAVE) {
    return res.status(403).send(paginaExport("Chave inválida", "Confira a EXPORT_CHAVE nas variáveis do Render e o parâmetro ?chave= do link."));
  }
  if (!HUB_API_KEY) {
    return res.status(400).send(paginaExport("Falta configurar", "A variável <b>HUB_API_KEY</b> não está preenchida no Render."));
  }
  if (exportacao.estado === "pronto") {
    return res.send(
      paginaExport(
        "✅ Catálogo pronto!",
        `A coleta terminou. <br><br>
         <a href="/exportar-catalogo/baixar?chave=${encodeURIComponent(EXPORT_CHAVE)}"
            style="display:inline-block;background:#4A2882;color:#fff;text-decoration:none;font-weight:bold;border-radius:999px;padding:14px 28px">⬇ Baixar catalogo-hub.json</a>
         <br><br><small>Para coletar de novo do zero: <a href="/exportar-catalogo?chave=${encodeURIComponent(EXPORT_CHAVE)}&refazer=1">refazer exportação</a></small>`
      )
    );
  }
  if (exportacao.estado === "coletando") {
    return res.send(
      paginaExport(
        "⏳ Coletando o catálogo…",
        `O servidor está buscando os produtos no Hub Suprir.<br><br>
         <b>Progresso:</b> ${exportacao.progresso || "iniciando…"}<br><br>
         Esta página se atualiza sozinha a cada 8 segundos — deixa aberta.`,
        true
      )
    );
  }
  if (exportacao.estado === "erro" && !req.query.refazer) {
    return res.send(
      paginaExport(
        "❌ A coleta falhou",
        `<b>Erro:</b> ${exportacao.erro}<br><br>
         <a href="/exportar-catalogo?chave=${encodeURIComponent(EXPORT_CHAVE)}&refazer=1">Tentar de novo</a>`
      )
    );
  }
  // inicia a coleta em segundo plano e mostra a página de progresso.
  // modo padrão "rapido": só a listagem (nome, preço, marca, foto, estoque) —
  // termina em segundos; "completo" busca também as 1.222 fichas.
  const modo = String(req.query.modo ?? "") === "completo" ? "completo" : "rapido";
  exportacao.estado = "coletando";
  exportacao.progresso = `iniciando (modo ${modo})…`;
  exportacao.erro = null;
  exportacao.json = null;
  console.log(`[exportar-catalogo] coleta iniciada (${modo})`);
  coletarCatalogoHub(modo)
    .then((json) => {
      exportacao.json = json;
      exportacao.estado = "pronto";
      console.log("[exportar-catalogo] coleta concluída");
    })
    .catch((erro) => {
      exportacao.estado = "erro";
      exportacao.erro = String(erro.message).slice(0, 300);
      console.error("[exportar-catalogo] falha:", erro.message);
    });
  res.send(
    paginaExport(
      "⏳ Coleta iniciada!",
      "O servidor começou a buscar os produtos no Hub Suprir. Esta página se atualiza sozinha a cada 8 segundos — deixa aberta até aparecer o botão de download.",
      true
    )
  );
});

aplicacao.get("/exportar-catalogo/baixar", (req, res) => {
  if (!EXPORT_CHAVE || String(req.query.chave ?? "") !== EXPORT_CHAVE) {
    return res.status(403).send(paginaExport("Chave inválida", "Confira o link."));
  }
  if (exportacao.estado !== "pronto" || !exportacao.json) {
    return res.redirect(`/exportar-catalogo?chave=${encodeURIComponent(EXPORT_CHAVE)}`);
  }
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="catalogo-hub.json"');
  res.send(exportacao.json);
});

aplicacao.post("/codigo", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  if (!emailValido(email)) return res.status(400).json({ erro: "E-mail inválido." });

  const agora = Date.now();
  const registro = pendentes.get(email);
  const enviosRecentes = (registro?.envios ?? []).filter((t) => agora - t < VALIDADE_MS);
  if (enviosRecentes.length >= MAX_ENVIOS_POR_JANELA) {
    return res.status(429).json({ erro: "Muitos envios. Aguarde alguns minutos e tente de novo." });
  }

  const codigo = String(randomInt(0, 1000000)).padStart(6, "0");
  pendentes.set(email, {
    codigo,
    expiraEm: agora + VALIDADE_MS,
    tentativas: 0,
    envios: [...enviosRecentes, agora],
  });

  try {
    await enviarEmailCodigo(email, codigo);
    res.json({ ok: true });
  } catch (erro) {
    console.error("falha no envio de e-mail:", erro.message);
    res.status(502).json({ erro: "Não foi possível enviar o e-mail agora. Tente novamente." });
  }
});

aplicacao.post("/codigo/verificar", (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const codigo = String(req.body?.codigo ?? "").trim();
  const registro = pendentes.get(email);

  if (!registro) return res.status(400).json({ erro: "Nenhuma verificação em andamento. Faça login de novo." });
  if (Date.now() > registro.expiraEm) {
    pendentes.delete(email);
    return res.status(400).json({ erro: "O código expirou. Faça login novamente." });
  }
  registro.tentativas += 1;
  if (registro.tentativas > MAX_TENTATIVAS) {
    pendentes.delete(email);
    return res.status(429).json({ erro: "Muitas tentativas. Faça login novamente." });
  }
  if (codigo !== registro.codigo) {
    return res.status(400).json({ erro: "Código incorreto. Confira os 6 dígitos." });
  }
  pendentes.delete(email);
  res.json({ ok: true });
});

aplicacao.post("/pedidos", async (req, res) => {
  const pedido = req.body ?? {};
  guardarPedidoRecente(pedido); // o webhook do MP usa isso para faturar no Bling
  anotarPedidoAfiliado(pedido); // se veio de link de afiliado, fica anotado até pagar

  // pedido de TESTE (só com a chave do admin): registra a atribuição de
  // afiliado mas NÃO vai ao Hub nem dispara aviso de venda
  if (pedido.testeChave && EXPORT_CHAVE && pedido.testeChave === EXPORT_CHAVE) {
    return res.json({ ok: true, teste: true });
  }

  // notificação de venda para o(s) admin(s) — independe do Hub.
  // Com Mercado Pago ativo, a notificação sai no webhook quando o pagamento
  // é APROVADO (evita avisar venda que nunca foi paga).
  if (!MP_ACCESS_TOKEN) {
    notificarVenda(pedido).catch((erro) =>
      console.error("falha ao notificar venda:", erro.message)
    );
  }

  if (!HUB_API_KEY) {
    // sem chave configurada, o pedido fica só no registro do site
    return res.json({ ok: true, hub: "nao-configurado" });
  }
  try {
    const resposta = await fetch(`${HUB_API_URL}/pedidos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": HUB_API_KEY },
      body: JSON.stringify(pedido),
    });
    const corpo = await resposta.text();
    res.status(resposta.status).type("application/json").send(corpo || "{}");
  } catch (erro) {
    console.error("falha ao gravar pedido no Hub:", erro.message);
    res.status(502).json({ erro: "O Hub não respondeu. O pedido ficou registrado no site." });
  }
});

// ===== Mercado Pago =====
// O dinheiro de cada venda cai direto na conta MP dona do Access Token.
// Pix: pagamento direto com QR na confirmação. Cartão/boleto: Checkout Pro
// (página segura do próprio Mercado Pago — nenhum dado de cartão passa aqui).

async function mp(caminho, opcoes = {}) {
  const resposta = await fetch(`${MP_API}${caminho}`, {
    ...opcoes,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      ...(opcoes.headers ?? {}),
    },
  });
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error(corpo.message ?? `Mercado Pago HTTP ${resposta.status}`);
  }
  return corpo;
}

aplicacao.post("/pagamentos/pix", async (req, res) => {
  if (!MP_ACCESS_TOKEN) return res.status(503).json({ erro: "Mercado Pago ainda não configurado." });
  const { pedido, cpf } = req.body ?? {};
  if (!pedido?.numero || !pedido?.totalCentavos || !pedido?.clienteEmail) {
    return res.status(400).json({ erro: "Pedido incompleto." });
  }
  try {
    const nomes = String(pedido.clienteNome ?? "").trim().split(/\s+/);
    const pagamento = await mp("/v1/payments", {
      method: "POST",
      headers: { "X-Idempotency-Key": `bn-pix-${pedido.numero}` },
      body: JSON.stringify({
        transaction_amount: Math.round(pedido.totalCentavos) / 100,
        description: `BeautyNow — pedido ${pedido.numero}`,
        payment_method_id: "pix",
        external_reference: pedido.numero,
        payer: {
          email: pedido.clienteEmail,
          first_name: nomes[0] ?? "Cliente",
          last_name: nomes.slice(1).join(" ") || "BeautyNow",
          ...(cpf ? { identification: { type: "CPF", number: String(cpf).replace(/\D/g, "") } } : {}),
        },
      }),
    });
    const dadosPix = pagamento.point_of_interaction?.transaction_data ?? {};
    res.json({
      ok: true,
      paymentId: pagamento.id,
      status: pagamento.status,
      copiaCola: dadosPix.qr_code ?? null,
      qrBase64: dadosPix.qr_code_base64 ?? null,
    });
  } catch (erro) {
    console.error("falha ao criar Pix:", erro.message);
    res.status(502).json({ erro: "Não foi possível gerar o Pix agora. Tente novamente." });
  }
});

aplicacao.post("/pagamentos/checkout-pro", async (req, res) => {
  if (!MP_ACCESS_TOKEN) return res.status(503).json({ erro: "Mercado Pago ainda não configurado." });
  const { pedido, meio, loja } = req.body ?? {};
  if (!pedido?.numero || !Array.isArray(pedido.itens)) {
    return res.status(400).json({ erro: "Pedido incompleto." });
  }
  const { siteUrl, statementDescriptor } = dadosDaLoja(loja);
  try {
    // itens do MP precisam somar o total real do pedido (frete e cupom incluídos)
    const produtosCentavos = pedido.itens.reduce(
      (soma, i) => soma + Math.round(i.precoCentavos) * (i.quantidade || 1),
      0
    );
    const totalCentavos = Math.round(pedido.totalCentavos ?? produtosCentavos);
    let itens = pedido.itens.map((i) => ({
      title: i.titulo,
      quantity: i.quantidade,
      currency_id: "BRL",
      unit_price: Math.round(i.precoCentavos) / 100,
    }));
    const diferenca = totalCentavos - produtosCentavos;
    if (diferenca > 0) {
      itens.push({
        title: pedido.freteNome ? `Frete — ${pedido.freteNome}` : "Frete",
        quantity: 1,
        currency_id: "BRL",
        unit_price: diferenca / 100,
      });
    } else if (diferenca < 0) {
      // desconto maior que o frete: o MP não aceita item negativo,
      // então a cobrança vira uma linha única com o total já com desconto
      itens = [
        {
          title: `Pedido ${pedido.numero} — ${statementDescriptor === "BE2BEAUTY" ? "Be2Beauty" : "BeautyNow"}`,
          quantity: 1,
          currency_id: "BRL",
          unit_price: totalCentavos / 100,
        },
      ];
    }
    const preferencia = await mp("/checkout/preferences", {
      method: "POST",
      body: JSON.stringify({
        external_reference: pedido.numero,
        items: itens,
        payer: { email: pedido.clienteEmail, name: pedido.clienteNome },
        payment_methods:
          meio === "boleto"
            ? { excluded_payment_types: [{ id: "credit_card" }, { id: "debit_card" }] }
            : { excluded_payment_types: [{ id: "ticket" }], installments: 6 },
        back_urls: {
          success: `${siteUrl}/checkout/confirmacao/`,
          pending: `${siteUrl}/checkout/confirmacao/`,
          failure: `${siteUrl}/checkout/`,
        },
        auto_return: "approved",
        statement_descriptor: statementDescriptor,
      }),
    });
    // sempre o init_point oficial. Em modo teste (token TEST-), o pagamento
    // deve ser feito logado com a CONTA DE TESTE de comprador do painel MP —
    // logado com conta real, o checkout de teste recusa ("sacola vazia" /
    // "não é possível pagar com esses dados")
    res.json({ ok: true, initPoint: preferencia.init_point });
  } catch (erro) {
    console.error("falha ao criar preferência:", erro.message);
    res.status(502).json({ erro: "Não foi possível iniciar o pagamento agora. Tente novamente." });
  }
});

aplicacao.get("/pagamentos/status/:id", async (req, res) => {
  if (!MP_ACCESS_TOKEN) return res.status(503).json({ erro: "Mercado Pago ainda não configurado." });
  try {
    const pagamento = await mp(`/v1/payments/${encodeURIComponent(req.params.id)}`);
    res.json({ ok: true, status: pagamento.status, pedido: pagamento.external_reference ?? null });
  } catch (erro) {
    console.error("falha ao consultar pagamento:", erro.message);
    res.status(502).json({ erro: "Não foi possível consultar o pagamento." });
  }
});

// webhook do Mercado Pago (configurar no painel MP apontando para /pagamentos/webhook)
aplicacao.post("/pagamentos/webhook", async (req, res) => {
  res.sendStatus(200); // responde rápido; processamento segue abaixo
  try {
    const id = req.body?.data?.id ?? req.query?.id;
    if (!id || !MP_ACCESS_TOKEN) return;
    const pagamento = await mp(`/v1/payments/${id}`);
    console.log(`[mp-webhook] pedido=${pagamento.external_reference} status=${pagamento.status}`);
    // pagamento aprovado → o admin fica sabendo na hora
    if (pagamento.status === "approved") {
      // fatura no Bling com os dados completos do pedido (guardados no /pedidos)
      const completo = pedidosRecentes.get(pagamento.external_reference);
      if (completo) {
        criarPedidoNoBling(completo).catch(() => undefined);
      } else if (pagamento.external_reference) {
        console.warn(`[bling] pedido ${pagamento.external_reference} aprovado mas sem dados completos na memória`);
      }
      // venda veio de link de afiliado? credita a comissão (uma vez só)
      if (pagamento.external_reference) {
        creditarVendaAfiliado(
          pagamento.external_reference,
          Math.round((pagamento.transaction_amount ?? 0) * 100)
        ).catch((erro) => console.error(`[afiliados] falha ao creditar: ${erro.message}`));
      }
      await notificarVenda({
        numero: pagamento.external_reference ?? String(id),
        data: pagamento.date_approved ?? new Date().toISOString(),
        clienteNome: [pagamento.payer?.first_name, pagamento.payer?.last_name].filter(Boolean).join(" "),
        clienteEmail: pagamento.payer?.email ?? "",
        meio: pagamento.payment_method_id === "pix" ? "pix" : "cartao",
        totalCentavos: Math.round((pagamento.transaction_amount ?? 0) * 100),
        itens: [],
      });
    }
  } catch (erro) {
    console.error("falha no webhook MP:", erro.message);
  }
});

// ===== Envio de banners da home pelo navegador =====
// O Mauricio sobe as artes aqui; o robô do GitHub coleta em
// /enviar-banners/exportar e o site ganha o carrossel.
const BANNERS_SLOTS = ["banner-1", "banner-2", "banner-3", "banner-4", "banner-5"];
const bannersEnviados = new Map(); // slot → { mime, base64 }
const ARQ_BANNERS = "/tmp/banners-enviados.json";
const BANNERS_BACKUP_URL =
  "https://raw.githubusercontent.com/MauricioSUprir/teste/claude/beauty-now-ecommerce-fbfxh2/banners-enviados.json";
try {
  const fs = await import("node:fs");
  if (fs.existsSync(ARQ_BANNERS)) {
    for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(ARQ_BANNERS, "utf8")))) {
      bannersEnviados.set(k, v);
    }
  } else {
    // deploy novo apaga o /tmp — recarrega do backup versionado no GitHub
    const r = await fetch(BANNERS_BACKUP_URL, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
    if (r?.ok) {
      const backup = (await r.json())?.banners ?? {};
      for (const [k, v] of Object.entries(backup)) bannersEnviados.set(k, v);
    }
  }
} catch {
  /* sem banners salvos */
}

async function salvarBanners() {
  try {
    const fs = await import("node:fs");
    fs.writeFileSync(ARQ_BANNERS, JSON.stringify(Object.fromEntries(bannersEnviados)));
  } catch {
    /* segue em memória */
  }
}

// ---- endpoints públicos do carrossel (o site busca daqui em tempo real) ----
aplicacao.get("/banners", (req, res) => {
  const lista = BANNERS_SLOTS.filter((s) => bannersEnviados.has(s)).map((slot) => ({
    slot,
    url: `/banners/imagem/${slot}`,
  }));
  res.json({ ok: true, banners: lista });
});

aplicacao.get("/banners/imagem/:slot", (req, res) => {
  const b = bannersEnviados.get(String(req.params.slot));
  if (!b) return res.status(404).end();
  res.setHeader("Content-Type", b.mime);
  res.setHeader("Cache-Control", "public, max-age=300");
  res.end(Buffer.from(b.base64, "base64"));
});

aplicacao.post("/enviar-banners/excluir", async (req, res) => {
  if (!EXPORT_CHAVE || String(req.query.chave ?? "") !== EXPORT_CHAVE) {
    return res.status(403).json({ erro: "Chave inválida." });
  }
  const { slot } = req.body ?? {};
  if (!BANNERS_SLOTS.includes(slot)) return res.status(400).json({ erro: "Banner inválido." });
  bannersEnviados.delete(slot);
  await salvarBanners();
  res.json({ ok: true, total: bannersEnviados.size });
});

aplicacao.get("/enviar-banners", (req, res) => {
  if (!EXPORT_CHAVE || String(req.query.chave ?? "") !== EXPORT_CHAVE) {
    return res.status(403).send(paginaExport("Chave inválida", "Use o link com ?chave= correto."));
  }
  const blocos = BANNERS_SLOTS.map((slot, i) => {
    const ok = bannersEnviados.has(slot);
    return `<div style="border:2px dashed ${ok ? "#1E8E5A" : "#c9c2dd"};border-radius:12px;padding:16px;margin:10px 0;background:#fff">
      <b>Banner ${i + 1}</b>${i > 0 ? " (opcional)" : ""} — <span id="st-${slot}" style="color:${ok ? "#1E8E5A" : "#777"}">${ok ? "✅ recebido" : "aguardando imagem"}</span><br>
      <input type="file" accept="image/*" style="margin-top:8px" onchange="enviar('${slot}', this)">
      <div id="pv-${slot}" style="margin-top:8px"></div>
    </div>`;
  }).join("");
  res.send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Enviar banners — BeautyNow</title></head>
  <body style="font-family:system-ui,sans-serif;background:#f4f2fa;margin:0;padding:24px">
  <div style="max-width:560px;margin:0 auto">
  <h1 style="color:#4A2882">Banners da home</h1>
  <p>Envie de 1 a 5 artes. <b>Formato ideal: deitado (paisagem), pelo menos 1200 de largura</b>
  — ex.: 1600×600. O carrossel troca sozinho a cada 20 segundos, na ordem dos números.</p>
  ${blocos}
  <p id="geral" style="font-weight:bold"></p>
  <script>
  const CHAVE = ${JSON.stringify(EXPORT_CHAVE)};
  async function enviar(slot, input) {
    const arquivo = input.files[0];
    if (!arquivo) return;
    const st = document.getElementById("st-" + slot);
    st.textContent = "enviando…"; st.style.color = "#B8730C";
    const leitor = new FileReader();
    leitor.onload = async () => {
      const base64 = String(leitor.result).split(",")[1];
      try {
        const r = await fetch("/enviar-banners/salvar?chave=" + encodeURIComponent(CHAVE), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slot, mime: arquivo.type || "image/png", base64 }),
        });
        const dados = await r.json();
        if (dados.ok) {
          st.textContent = "✅ recebido"; st.style.color = "#1E8E5A";
          document.getElementById("pv-" + slot).innerHTML =
            '<img src="data:' + (arquivo.type || "image/png") + ';base64,' + base64 + '" style="max-width:100%;border-radius:8px;border:1px solid #eee">';
          document.getElementById("geral").textContent = dados.total + " banner(s) recebido(s). Pode avisar o Claude!";
        } else {
          st.textContent = "❌ " + (dados.erro || "falhou — tente de novo"); st.style.color = "#c0392b";
        }
      } catch (e) {
        st.textContent = "❌ sem conexão — tente de novo"; st.style.color = "#c0392b";
      }
    };
    leitor.readAsDataURL(arquivo);
  }
  </script>
  </div></body></html>`);
});

aplicacao.post("/enviar-banners/salvar", express.json({ limit: "10mb" }), async (req, res) => {
  if (!EXPORT_CHAVE || String(req.query.chave ?? "") !== EXPORT_CHAVE) {
    return res.status(403).json({ erro: "Chave inválida." });
  }
  const { slot, mime, base64 } = req.body ?? {};
  if (!BANNERS_SLOTS.includes(slot) || !base64 || !String(mime ?? "").startsWith("image/")) {
    return res.status(400).json({ erro: "Envio inválido." });
  }
  const bytes = Buffer.from(String(base64), "base64");
  if (bytes.length < 1000 || bytes.length > 7_000_000) {
    return res.status(400).json({ erro: "Imagem vazia ou grande demais (máx. 7MB)." });
  }
  bannersEnviados.set(slot, { mime: String(mime), base64: String(base64) });
  await salvarBanners();
  console.log(`[enviar-banners] recebido: ${slot} (${bytes.length} bytes)`);
  res.json({ ok: true, total: bannersEnviados.size });
});

aplicacao.get("/enviar-banners/exportar", (req, res) => {
  if (!EXPORT_CHAVE || String(req.query.chave ?? "") !== EXPORT_CHAVE) {
    return res.status(403).json({ erro: "Chave inválida." });
  }
  res.json({ total: bannersEnviados.size, banners: Object.fromEntries(bannersEnviados) });
});

// ===== Bling (ERP) =====
// Toda venda APROVADA vira pedido no Bling, junto com os dos marketplaces.
// Fluxo: /bling/conectar (autorizar logado no Bling) → /bling/callback guarda
// os tokens → o webhook do Mercado Pago cria o pedido ao aprovar o pagamento.
const BLING_CLIENT_ID = (process.env.BLING_CLIENT_ID ?? "").trim();
const BLING_CLIENT_SECRET = (process.env.BLING_CLIENT_SECRET ?? "").trim();
const BLING_OAUTH = "https://www.bling.com.br/Api/v3/oauth";
const BLING_API = "https://api.bling.com.br/Api/v3";
const BLING_ARQ_TOKENS = "/tmp/bling-tokens.json";

let blingTokens = null; // { access, refresh, expiraEm }
try {
  const fs = await import("node:fs");
  if (fs.existsSync(BLING_ARQ_TOKENS)) {
    blingTokens = JSON.parse(fs.readFileSync(BLING_ARQ_TOKENS, "utf8"));
  } else if (process.env.BLING_REFRESH_TOKEN) {
    blingTokens = { access: "", refresh: process.env.BLING_REFRESH_TOKEN.trim(), expiraEm: 0 };
  }
} catch {
  /* sem tokens salvos */
}

async function blingSalvarTokens() {
  try {
    const fs = await import("node:fs");
    fs.writeFileSync(BLING_ARQ_TOKENS, JSON.stringify(blingTokens));
  } catch {
    /* disco indisponível — segue só em memória */
  }
}

async function blingTrocarToken(params) {
  const basic = Buffer.from(`${BLING_CLIENT_ID}:${BLING_CLIENT_SECRET}`).toString("base64");
  const resposta = await fetch(`${BLING_OAUTH}/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(params).toString(),
    signal: AbortSignal.timeout(20_000),
  });
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok || !corpo.access_token) {
    throw new Error(corpo.error_description ?? corpo.error ?? `Bling OAuth HTTP ${resposta.status}`);
  }
  blingTokens = {
    access: corpo.access_token,
    refresh: corpo.refresh_token ?? blingTokens?.refresh ?? "",
    expiraEm: Date.now() + (Number(corpo.expires_in ?? 21600) - 300) * 1000,
  };
  await blingSalvarTokens();
  return blingTokens;
}

async function blingAccessToken() {
  if (!BLING_CLIENT_ID || !BLING_CLIENT_SECRET) throw new Error("Bling não configurado (client id/secret).");
  if (!blingTokens?.refresh && !blingTokens?.access) throw new Error("Bling não conectado. Abra /bling/conectar.");
  if (blingTokens.access && Date.now() < blingTokens.expiraEm) return blingTokens.access;
  await blingTrocarToken({ grant_type: "refresh_token", refresh_token: blingTokens.refresh });
  return blingTokens.access;
}

async function bling(caminho, opcoes = {}) {
  const token = await blingAccessToken();
  const resposta = await fetch(`${BLING_API}${caminho}`, {
    ...opcoes,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(opcoes.headers ?? {}),
    },
    signal: AbortSignal.timeout(25_000),
  });
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    const detalhe = corpo?.error?.description ?? corpo?.error?.message ?? JSON.stringify(corpo).slice(0, 300);
    throw new Error(`Bling HTTP ${resposta.status}: ${detalhe}`);
  }
  return corpo;
}

/** Acha (por CPF) ou cria o contato do cliente no Bling; devolve o id. */
async function blingContato(pedido) {
  const cpf = String(pedido.cpf ?? "").replace(/\D/g, "");
  if (cpf) {
    const busca = await bling(`/contatos?numeroDocumento=${cpf}`).catch(() => null);
    const existente = busca?.data?.[0]?.id;
    if (existente) return existente;
  }
  const e = pedido.endereco ?? {};
  const criado = await bling("/contatos", {
    method: "POST",
    body: JSON.stringify({
      nome: pedido.clienteNome || "Cliente BeautyNow",
      tipo: "F",
      numeroDocumento: cpf || undefined,
      celular: pedido.telefone || undefined,
      email: pedido.clienteEmail || undefined,
      endereco: {
        geral: {
          endereco: e.logradouro || undefined,
          numero: e.numero || undefined,
          complemento: e.complemento || undefined,
          bairro: e.bairro || undefined,
          cep: e.cep || undefined,
          municipio: e.cidade || undefined,
          uf: e.uf || undefined,
        },
      },
    }),
  });
  return criado?.data?.id;
}

const blingEnviados = new Set(); // números de pedido já criados (evita duplicar)
let blingUltimoErro = null;

async function criarPedidoNoBling(pedido) {
  if (!pedido?.numero || blingEnviados.has(pedido.numero)) return;
  try {
    const contatoId = await blingContato(pedido);
    if (!contatoId) throw new Error("não consegui criar o contato do cliente");
    const corpo = await bling("/pedidos/vendas", {
      method: "POST",
      body: JSON.stringify({
        numeroLoja: pedido.numero,
        data: String(pedido.data ?? new Date().toISOString()).slice(0, 10),
        contato: { id: contatoId },
        itens: (pedido.itens ?? []).map((i) => ({
          codigo: i.sku || undefined,
          descricao: i.titulo || "Item do site",
          quantidade: i.quantidade || 1,
          valor: Math.round(i.precoCentavos ?? 0) / 100,
        })),
        observacoes: `Pedido do site BeautyNow (${pedido.meio ?? "pagamento"} aprovado). Total R$ ${(Math.round(pedido.totalCentavos ?? 0) / 100).toFixed(2)}${pedido.cupom ? ` · cupom ${pedido.cupom}` : ""} · frete ${pedido.freteNome ?? "-"}`,
      }),
    });
    blingEnviados.add(pedido.numero);
    blingUltimoErro = null;
    console.log(`[bling] pedido ${pedido.numero} criado (id Bling ${corpo?.data?.id ?? "?"})`);
  } catch (erro) {
    blingUltimoErro = `${pedido.numero}: ${erro.message}`;
    console.error(`[bling] falha no pedido ${pedido.numero}:`, erro.message);
  }
}

// memória dos pedidos recebidos do site (o webhook do MP só traz o número)
const pedidosRecentes = new Map();
function guardarPedidoRecente(pedido) {
  if (!pedido?.numero) return;
  pedidosRecentes.set(pedido.numero, pedido);
  if (pedidosRecentes.size > 300) {
    pedidosRecentes.delete(pedidosRecentes.keys().next().value);
  }
}

// ===== Avaliações da loja (estrelas + comentário) =====
// Ficam no servidor para todo mundo ver. Persistem em /tmp (sobrevivem ao
// sono do Render) e, no boot, recarregam do backup versionado no GitHub —
// assim um deploy não apaga as avaliações já feitas.
const ARQ_AVALIACOES = "/tmp/avaliacoes.json";
const AVALIACOES_BACKUP_URL =
  "https://raw.githubusercontent.com/MauricioSUprir/teste/claude/beauty-now-ecommerce-fbfxh2/avaliacoes-backup.json";
let avaliacoes = [];
try {
  const fs = await import("node:fs");
  if (fs.existsSync(ARQ_AVALIACOES)) {
    avaliacoes = JSON.parse(fs.readFileSync(ARQ_AVALIACOES, "utf8"));
  } else {
    const r = await fetch(AVALIACOES_BACKUP_URL, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
    if (r?.ok) avaliacoes = (await r.json())?.avaliacoes ?? [];
  }
} catch {
  avaliacoes = [];
}

async function salvarAvaliacoes() {
  try {
    const fs = await import("node:fs");
    fs.writeFileSync(ARQ_AVALIACOES, JSON.stringify(avaliacoes));
  } catch {
    /* segue em memória */
  }
}

const ultimoEnvioAvaliacao = new Map(); // IP → timestamp (freio anti-spam)

aplicacao.get("/avaliacoes", (req, res) => {
  const lista = [...avaliacoes].sort((a, b) => (a.data < b.data ? 1 : -1)).slice(0, 200);
  const media = lista.length
    ? Math.round((lista.reduce((s, a) => s + (a.nota ?? 0), 0) / lista.length) * 10) / 10
    : null;
  res.json({ ok: true, total: avaliacoes.length, media, avaliacoes: lista });
});

aplicacao.post("/avaliacoes", async (req, res) => {
  const ip = String(req.headers["x-forwarded-for"] ?? req.ip ?? "").split(",")[0];
  const ultimo = ultimoEnvioAvaliacao.get(ip) ?? 0;
  if (Date.now() - ultimo < 60_000) {
    return res.status(429).json({ erro: "Calma! Espere um minutinho para enviar outra avaliação." });
  }
  const { nome, nota, notaProduto, notaExperiencia, texto, pedido } = req.body ?? {};
  const n = Number(nota);
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    return res.status(400).json({ erro: "Escolha de 1 a 5 estrelas." });
  }
  const limpo = (v, max) => String(v ?? "").trim().slice(0, max);
  const avaliacao = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    data: new Date().toISOString(),
    nome: limpo(nome, 80) || "Cliente BeautyNow",
    nota: n,
    notaProduto: Number.isInteger(Number(notaProduto)) ? Math.min(5, Math.max(1, Number(notaProduto))) : undefined,
    notaExperiencia: Number.isInteger(Number(notaExperiencia)) ? Math.min(5, Math.max(1, Number(notaExperiencia))) : undefined,
    texto: limpo(texto, 1000),
    pedido: limpo(pedido, 20) || undefined,
  };
  avaliacoes.push(avaliacao);
  if (avaliacoes.length > 2000) avaliacoes = avaliacoes.slice(-2000);
  ultimoEnvioAvaliacao.set(ip, Date.now());
  await salvarAvaliacoes();
  console.log(`[avaliacoes] nova: ${avaliacao.nota}★ de ${avaliacao.nome}`);
  res.json({ ok: true });
});

// backup para o robô do GitHub versionar (não perde avaliação em deploy)
aplicacao.get("/avaliacoes/exportar", (req, res) => {
  if (!EXPORT_CHAVE || String(req.query.chave ?? "") !== EXPORT_CHAVE) {
    return res.status(403).json({ erro: "Chave inválida." });
  }
  res.json({ geradoEm: new Date().toISOString(), avaliacoes });
});

// ===== Cadastro profissional Be2Beauty (B2B) =====
// O site profissional mostra o catálogo aberto mas esconde os preços até o
// CNPJ ser aprovado no painel do admin. Mesmo esquema de persistência das
// avaliações: /tmp (sobrevive ao sono) + backup versionado no GitHub
// recarregado no boot (deploy não apaga cadastros).
const ARQ_B2B = "/tmp/b2b-cadastros.json";
const B2B_BACKUP_URL =
  "https://raw.githubusercontent.com/MauricioSUprir/teste/claude/beauty-now-ecommerce-fbfxh2/b2b-backup.json";
let cadastrosB2B = [];
try {
  const fs = await import("node:fs");
  if (fs.existsSync(ARQ_B2B)) {
    cadastrosB2B = JSON.parse(fs.readFileSync(ARQ_B2B, "utf8"));
  } else {
    const r = await fetch(B2B_BACKUP_URL, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
    if (r?.ok) cadastrosB2B = (await r.json())?.cadastros ?? [];
  }
} catch {
  cadastrosB2B = [];
}

async function salvarB2B() {
  try {
    const fs = await import("node:fs");
    fs.writeFileSync(ARQ_B2B, JSON.stringify(cadastrosB2B));
  } catch {
    /* segue em memória */
  }
}

/** validação oficial de CNPJ (dígitos verificadores) */
function cnpjValido(cnpj) {
  const d = String(cnpj).replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (tamanho) => {
    const pesos = tamanho === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = pesos.reduce((s, p, i) => s + p * Number(d[i]), 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

const ultimoCadastroB2B = new Map(); // IP → timestamp (freio anti-spam)

aplicacao.post("/b2b/cadastro", async (req, res) => {
  const ip = String(req.headers["x-forwarded-for"] ?? req.ip ?? "").split(",")[0];
  if (Date.now() - (ultimoCadastroB2B.get(ip) ?? 0) < 60_000) {
    return res.status(429).json({ erro: "Espere um minutinho antes de enviar outro cadastro." });
  }
  const limpo = (v, max) => String(v ?? "").trim().slice(0, max);
  const cnpj = String(req.body?.cnpj ?? "").replace(/\D/g, "");
  if (!cnpjValido(cnpj)) {
    return res.status(400).json({ erro: "CNPJ inválido — confira os 14 dígitos." });
  }
  const existente = cadastrosB2B.find((c) => c.cnpj === cnpj);
  if (existente) {
    return res.json({ ok: true, status: existente.status });
  }
  const cadastro = {
    cnpj,
    razao: limpo(req.body?.razao, 120),
    nome: limpo(req.body?.nome, 80),
    email: limpo(req.body?.email, 120).toLowerCase(),
    whatsapp: limpo(req.body?.whatsapp, 20),
    criadoEm: new Date().toISOString(),
    status: "pendente",
  };
  cadastrosB2B.push(cadastro);
  if (cadastrosB2B.length > 5000) cadastrosB2B = cadastrosB2B.slice(-5000);
  ultimoCadastroB2B.set(ip, Date.now());
  await salvarB2B();
  console.log(`[b2b] novo cadastro: ${cadastro.razao || cadastro.nome} (${cnpj})`);
  for (const destino of EMAILS_NOTIFICACAO) {
    enviarEmail({
      para: destino,
      assunto: `💼 Novo cadastro profissional Be2Beauty — ${cadastro.razao || cadastro.nome}`,
      texto:
        `Novo cadastro B2B aguardando aprovação:\n\n` +
        `CNPJ: ${cnpj}\nRazão social: ${cadastro.razao}\nResponsável: ${cadastro.nome}\n` +
        `E-mail: ${cadastro.email}\nWhatsApp: ${cadastro.whatsapp}\n\n` +
        `Aprove no painel do admin (aba Profissionais).`,
    }).catch((erro) => console.error(`[b2b] falha ao notificar: ${erro.message}`));
  }
  res.json({ ok: true, status: "pendente" });
});

// consulta pública de situação (o navegador do profissional pergunta por aqui)
aplicacao.get("/b2b/status", (req, res) => {
  const cnpj = String(req.query.cnpj ?? "").replace(/\D/g, "");
  const cadastro = cadastrosB2B.find((c) => c.cnpj === cnpj);
  res.json({ ok: true, status: cadastro?.status ?? "nao_cadastrado" });
});

// lista completa para o painel do admin
aplicacao.get("/b2b/lista", (req, res) => {
  if (!EXPORT_CHAVE || String(req.query.chave ?? "") !== EXPORT_CHAVE) {
    return res.status(403).json({ erro: "Chave inválida." });
  }
  res.json({ ok: true, total: cadastrosB2B.length, cadastros: [...cadastrosB2B].reverse() });
});

// aprovação/recusa pelo painel do admin
aplicacao.post("/b2b/decidir", async (req, res) => {
  if (!EXPORT_CHAVE || String(req.body?.chave ?? "") !== EXPORT_CHAVE) {
    return res.status(403).json({ erro: "Chave inválida." });
  }
  const cnpj = String(req.body?.cnpj ?? "").replace(/\D/g, "");
  const status = String(req.body?.status ?? "");
  if (!["aprovado", "recusado", "pendente"].includes(status)) {
    return res.status(400).json({ erro: "Status deve ser aprovado, recusado ou pendente." });
  }
  const cadastro = cadastrosB2B.find((c) => c.cnpj === cnpj);
  if (!cadastro) return res.status(404).json({ erro: "Cadastro não encontrado." });
  cadastro.status = status;
  cadastro.decididoEm = new Date().toISOString();
  await salvarB2B();
  console.log(`[b2b] ${cnpj} → ${status}`);
  if (cadastro.email && status !== "pendente") {
    enviarEmail({
      para: cadastro.email,
      assunto:
        status === "aprovado"
          ? "✅ Seu cadastro Be2Beauty foi aprovado!"
          : "Sobre o seu cadastro Be2Beauty",
      texto:
        status === "aprovado"
          ? `Olá, ${cadastro.nome || "profissional"}!\n\nSeu cadastro profissional foi aprovado. Acesse o site, informe o CNPJ ${cnpj} na página "Cadastro profissional" e os preços ficam liberados.\n\nBoas compras!\nEquipe Be2Beauty`
          : `Olá, ${cadastro.nome || "profissional"}.\n\nSeu cadastro não foi aprovado neste momento. Em caso de dúvida, fale com a gente: (21) 99732-2464.\n\nEquipe Be2Beauty`,
    }).catch((erro) => console.error(`[b2b] falha ao avisar cliente: ${erro.message}`));
  }
  res.json({ ok: true, status });
});

// backup para o robô do GitHub versionar (não perde cadastro em deploy)
aplicacao.get("/b2b/exportar", (req, res) => {
  if (!EXPORT_CHAVE || String(req.query.chave ?? "") !== EXPORT_CHAVE) {
    return res.status(403).json({ erro: "Chave inválida." });
  }
  res.json({ geradoEm: new Date().toISOString(), cadastros: cadastrosB2B });
});

// ===== Afiliados Be2Beauty =====
// O profissional aprovado gera um link do BeautyNow com o código dele
// (?af=codigo). O site guarda o código no navegador do cliente por 30 dias e
// manda junto no pedido; quando o Mercado Pago APROVA o pagamento, a venda
// entra para o afiliado com a comissão da época. Persistência: /tmp + backup
// versionado no GitHub (afiliados-backup.json).
const ARQ_AFILIADOS_VENDAS = "/tmp/afiliados-vendas.json";
const ARQ_AFILIADOS_PENDENTES = "/tmp/afiliados-pendentes.json";
const ARQ_AFILIADOS_SAQUES = "/tmp/afiliados-saques.json";
const AFILIADOS_BACKUP_URL =
  "https://raw.githubusercontent.com/MauricioSUprir/teste/claude/beauty-now-ecommerce-fbfxh2/afiliados-backup.json";
const COMISSAO_PADRAO_PCT = 10;
let vendasAfiliados = [];
// pedidos com afiliado ainda não pagos: numero → { codigo, totalCentavos, data }
// (persistido porque um boleto pode compensar dias depois, após deploy/sono)
let pendentesAfiliados = {};
// pedidos de resgate da comissão (o admin paga o Pix e marca como pago)
let saquesAfiliados = [];
try {
  const fs = await import("node:fs");
  if (fs.existsSync(ARQ_AFILIADOS_VENDAS)) {
    vendasAfiliados = JSON.parse(fs.readFileSync(ARQ_AFILIADOS_VENDAS, "utf8"));
  } else {
    const r = await fetch(AFILIADOS_BACKUP_URL, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
    if (r?.ok) {
      const dados = await r.json();
      vendasAfiliados = dados?.vendas ?? [];
      pendentesAfiliados = dados?.pendentes ?? {};
      saquesAfiliados = dados?.saques ?? [];
    }
  }
  if (fs.existsSync(ARQ_AFILIADOS_PENDENTES)) {
    pendentesAfiliados = JSON.parse(fs.readFileSync(ARQ_AFILIADOS_PENDENTES, "utf8"));
  }
  if (fs.existsSync(ARQ_AFILIADOS_SAQUES)) {
    saquesAfiliados = JSON.parse(fs.readFileSync(ARQ_AFILIADOS_SAQUES, "utf8"));
  }
} catch {
  vendasAfiliados = [];
  pendentesAfiliados = {};
  saquesAfiliados = [];
}

async function salvarAfiliados() {
  try {
    const fs = await import("node:fs");
    fs.writeFileSync(ARQ_AFILIADOS_VENDAS, JSON.stringify(vendasAfiliados));
    fs.writeFileSync(ARQ_AFILIADOS_PENDENTES, JSON.stringify(pendentesAfiliados));
    fs.writeFileSync(ARQ_AFILIADOS_SAQUES, JSON.stringify(saquesAfiliados));
  } catch {
    /* segue em memória */
  }
}

/** saldo disponível para saque: comissão ganha − saques pedidos/pagos */
function saldoAfiliado(cnpj) {
  const ganho = vendasAfiliados
    .filter((v) => v.cnpj === cnpj)
    .reduce((s, v) => s + v.comissaoCentavos, 0);
  const retido = saquesAfiliados
    .filter((s) => s.cnpj === cnpj && s.status !== "recusado")
    .reduce((s, x) => s + x.valorCentavos, 0);
  return Math.max(0, ganho - retido);
}

const slugAfiliado = (texto) =>
  String(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 16) || "afiliado";

/** anota o pedido como indicado pelo afiliado; a comissão só conta quando pagar */
function anotarPedidoAfiliado(pedido) {
  const codigo = String(pedido?.afiliado ?? "").trim().toLowerCase();
  const numero = String(pedido?.numero ?? "");
  if (!codigo || !numero) return;
  if (!cadastrosB2B.some((c) => c.codigoAfiliado === codigo)) return;
  pendentesAfiliados[numero] = {
    codigo,
    totalCentavos: Number(pedido.totalCentavos ?? 0),
    data: new Date().toISOString(),
  };
  // não cresce sem limite: mantém os 500 mais recentes
  const chaves = Object.keys(pendentesAfiliados);
  if (chaves.length > 500) delete pendentesAfiliados[chaves[0]];
  salvarAfiliados();
  console.log(`[afiliados] pedido ${numero} indicado por ${codigo}`);
}

/** pagamento aprovado → credita a venda ao afiliado (uma vez só por pedido) */
async function creditarVendaAfiliado(numero, totalCentavosPagos) {
  const pendente = pendentesAfiliados[String(numero)];
  if (!pendente) return;
  if (vendasAfiliados.some((v) => v.pedido === String(numero))) return; // webhook repete
  const cadastro = cadastrosB2B.find((c) => c.codigoAfiliado === pendente.codigo);
  if (!cadastro) return;
  const pct = Number(cadastro.comissaoPct ?? COMISSAO_PADRAO_PCT);
  const total = totalCentavosPagos || pendente.totalCentavos || 0;
  const venda = {
    pedido: String(numero),
    codigo: pendente.codigo,
    cnpj: cadastro.cnpj,
    data: new Date().toISOString(),
    totalCentavos: total,
    pct,
    comissaoCentavos: Math.round((total * pct) / 100),
  };
  vendasAfiliados.push(venda);
  if (vendasAfiliados.length > 10_000) vendasAfiliados = vendasAfiliados.slice(-10_000);
  delete pendentesAfiliados[String(numero)];
  await salvarAfiliados();
  console.log(
    `[afiliados] venda ${numero} creditada a ${pendente.codigo}: ${total} centavos, ${pct}% = ${venda.comissaoCentavos}`
  );
}

// gera (ou devolve) o link de afiliado — só para cadastro aprovado
aplicacao.post("/afiliados/link", async (req, res) => {
  const cnpj = String(req.body?.cnpj ?? "").replace(/\D/g, "");
  const cadastro = cadastrosB2B.find((c) => c.cnpj === cnpj);
  if (!cadastro) return res.status(404).json({ erro: "Cadastro não encontrado." });
  if (cadastro.status !== "aprovado") {
    return res.status(403).json({ erro: "O cadastro precisa estar aprovado para gerar o link." });
  }
  if (!cadastro.codigoAfiliado) {
    const base = slugAfiliado(cadastro.razao || cadastro.nome);
    let codigo = base;
    while (cadastrosB2B.some((c) => c.codigoAfiliado === codigo)) {
      codigo = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    }
    cadastro.codigoAfiliado = codigo;
    if (cadastro.comissaoPct === undefined) cadastro.comissaoPct = COMISSAO_PADRAO_PCT;
    await salvarB2B();
    console.log(`[afiliados] código criado: ${codigo} (${cnpj})`);
  }
  res.json({
    ok: true,
    codigo: cadastro.codigoAfiliado,
    url: `${SITE_URL}/?af=${encodeURIComponent(cadastro.codigoAfiliado)}`,
    pct: Number(cadastro.comissaoPct ?? COMISSAO_PADRAO_PCT),
  });
});

// painel do próprio afiliado: vendas, comissão e código
aplicacao.get("/afiliados/painel", (req, res) => {
  const cnpj = String(req.query.cnpj ?? "").replace(/\D/g, "");
  const cadastro = cadastrosB2B.find((c) => c.cnpj === cnpj);
  if (!cadastro || cadastro.status !== "aprovado") {
    return res.status(403).json({ erro: "Cadastro não aprovado." });
  }
  const minhas = vendasAfiliados.filter((v) => v.cnpj === cnpj);
  const meusSaques = saquesAfiliados.filter((s) => s.cnpj === cnpj);
  res.json({
    ok: true,
    codigo: cadastro.codigoAfiliado ?? null,
    url: cadastro.codigoAfiliado
      ? `${SITE_URL}/?af=${encodeURIComponent(cadastro.codigoAfiliado)}`
      : null,
    pct: Number(cadastro.comissaoPct ?? COMISSAO_PADRAO_PCT),
    totais: {
      vendas: minhas.length,
      vendidoCentavos: minhas.reduce((s, v) => s + v.totalCentavos, 0),
      comissaoCentavos: minhas.reduce((s, v) => s + v.comissaoCentavos, 0),
      disponivelCentavos: saldoAfiliado(cnpj),
      aguardandoSaqueCentavos: meusSaques
        .filter((s) => s.status === "pendente")
        .reduce((s, x) => s + x.valorCentavos, 0),
      sacadoCentavos: meusSaques
        .filter((s) => s.status === "pago")
        .reduce((s, x) => s + x.valorCentavos, 0),
    },
    vendas: minhas.slice(-200).reverse(),
    saques: meusSaques.slice(-50).reverse(),
  });
});

// afiliado pede o resgate da comissão (Pix manual: o admin paga e marca)
aplicacao.post("/afiliados/saque", async (req, res) => {
  const cnpj = String(req.body?.cnpj ?? "").replace(/\D/g, "");
  const cadastro = cadastrosB2B.find((c) => c.cnpj === cnpj);
  if (!cadastro || cadastro.status !== "aprovado") {
    return res.status(403).json({ erro: "Cadastro não aprovado." });
  }
  const chavePix = String(req.body?.chavePix ?? "").trim().slice(0, 120);
  if (!chavePix) return res.status(400).json({ erro: "Informe a chave Pix para receber." });
  const disponivel = saldoAfiliado(cnpj);
  const valor = req.body?.valorCentavos != null ? Number(req.body.valorCentavos) : disponivel;
  if (!Number.isInteger(valor) || valor <= 0) {
    return res.status(400).json({ erro: "Valor de saque inválido." });
  }
  if (valor > disponivel) {
    return res.status(400).json({ erro: "Valor maior que o saldo disponível." });
  }
  const saque = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    cnpj,
    codigo: cadastro.codigoAfiliado ?? null,
    razao: cadastro.razao,
    nome: cadastro.nome,
    data: new Date().toISOString(),
    valorCentavos: valor,
    chavePix,
    status: "pendente",
  };
  saquesAfiliados.push(saque);
  if (saquesAfiliados.length > 5000) saquesAfiliados = saquesAfiliados.slice(-5000);
  await salvarAfiliados();
  console.log(`[afiliados] saque pedido: ${cnpj} ${valor} centavos (pix ${chavePix})`);
  for (const destino of EMAILS_NOTIFICACAO) {
    enviarEmail({
      para: destino,
      assunto: `💸 Pedido de saque de afiliado — ${cadastro.razao || cadastro.nome} (${formatarReais(valor)})`,
      texto:
        `O afiliado ${cadastro.razao || cadastro.nome} pediu o resgate da comissão:\n\n` +
        `Valor: ${formatarReais(valor)}\nChave Pix: ${chavePix}\nCNPJ: ${cnpj}\n\n` +
        `Faça o Pix e marque como pago no painel do admin (aba Afiliados).`,
    }).catch((erro) => console.error(`[afiliados] falha ao avisar saque: ${erro.message}`));
  }
  res.json({ ok: true, saque });
});

// admin marca o saque como pago (depois de fazer o Pix) ou recusa (devolve o saldo)
aplicacao.post("/afiliados/saque-decidir", async (req, res) => {
  if (!EXPORT_CHAVE || String(req.body?.chave ?? "") !== EXPORT_CHAVE) {
    return res.status(403).json({ erro: "Chave inválida." });
  }
  const id = String(req.body?.id ?? "");
  const status = String(req.body?.status ?? "");
  if (!["pago", "recusado"].includes(status)) {
    return res.status(400).json({ erro: "Status deve ser pago ou recusado." });
  }
  const saque = saquesAfiliados.find((s) => s.id === id);
  if (!saque) return res.status(404).json({ erro: "Saque não encontrado." });
  if (saque.status !== "pendente") {
    return res.status(400).json({ erro: "Este saque já foi decidido." });
  }
  saque.status = status;
  saque.decididoEm = new Date().toISOString();
  await salvarAfiliados();
  console.log(`[afiliados] saque ${id} → ${status}`);
  const cadastro = cadastrosB2B.find((c) => c.cnpj === saque.cnpj);
  if (cadastro?.email) {
    enviarEmail({
      para: cadastro.email,
      assunto:
        status === "pago"
          ? `✅ Seu saque de ${formatarReais(saque.valorCentavos)} foi pago!`
          : "Sobre o seu pedido de saque Be2Beauty",
      texto:
        status === "pago"
          ? `Olá, ${cadastro.nome || "afiliado"}!\n\nSeu resgate de ${formatarReais(saque.valorCentavos)} foi enviado para a chave Pix ${saque.chavePix}.\n\nObrigado por divulgar a BeautyNow!\nEquipe Be2Beauty`
          : `Olá, ${cadastro.nome || "afiliado"}.\n\nSeu pedido de saque de ${formatarReais(saque.valorCentavos)} não foi aprovado e o valor voltou para o seu saldo. Em caso de dúvida: (21) 99732-2464.\n\nEquipe Be2Beauty`,
    }).catch((erro) => console.error(`[afiliados] falha ao avisar afiliado: ${erro.message}`));
  }
  res.json({ ok: true, status });
});

// visão do admin: todos os afiliados, vendas de cada um e totais gerais
aplicacao.get("/afiliados/admin", (req, res) => {
  if (!EXPORT_CHAVE || String(req.query.chave ?? "") !== EXPORT_CHAVE) {
    return res.status(403).json({ erro: "Chave inválida." });
  }
  const afiliados = cadastrosB2B
    .filter((c) => c.status === "aprovado")
    .map((c) => {
      const minhas = vendasAfiliados.filter((v) => v.cnpj === c.cnpj);
      return {
        cnpj: c.cnpj,
        razao: c.razao,
        nome: c.nome,
        email: c.email,
        whatsapp: c.whatsapp,
        codigo: c.codigoAfiliado ?? null,
        pct: Number(c.comissaoPct ?? COMISSAO_PADRAO_PCT),
        vendas: minhas.length,
        vendidoCentavos: minhas.reduce((s, v) => s + v.totalCentavos, 0),
        comissaoCentavos: minhas.reduce((s, v) => s + v.comissaoCentavos, 0),
        disponivelCentavos: saldoAfiliado(c.cnpj),
      };
    });
  res.json({
    ok: true,
    afiliados,
    geral: {
      vendas: vendasAfiliados.length,
      vendidoCentavos: vendasAfiliados.reduce((s, v) => s + v.totalCentavos, 0),
      comissaoCentavos: vendasAfiliados.reduce((s, v) => s + v.comissaoCentavos, 0),
      saquesPendentes: saquesAfiliados.filter((s) => s.status === "pendente").length,
      aPagarCentavos: saquesAfiliados
        .filter((s) => s.status === "pendente")
        .reduce((s, x) => s + x.valorCentavos, 0),
    },
    ultimas: vendasAfiliados.slice(-100).reverse(),
    saques: saquesAfiliados.slice(-100).reverse(),
  });
});

// admin define a comissão (%) de um afiliado — vale para as PRÓXIMAS vendas
aplicacao.post("/afiliados/comissao", async (req, res) => {
  if (!EXPORT_CHAVE || String(req.body?.chave ?? "") !== EXPORT_CHAVE) {
    return res.status(403).json({ erro: "Chave inválida." });
  }
  const cnpj = String(req.body?.cnpj ?? "").replace(/\D/g, "");
  const pct = Number(req.body?.pct);
  if (!Number.isFinite(pct) || pct < 0 || pct > 90) {
    return res.status(400).json({ erro: "Comissão deve ser um número entre 0 e 90 (%)." });
  }
  const cadastro = cadastrosB2B.find((c) => c.cnpj === cnpj);
  if (!cadastro) return res.status(404).json({ erro: "Cadastro não encontrado." });
  cadastro.comissaoPct = pct;
  await salvarB2B();
  console.log(`[afiliados] comissão de ${cnpj} → ${pct}%`);
  res.json({ ok: true, pct });
});

// credita manualmente um pedido anotado (venda paga fora do MP, ou teste do
// admin) — mesmo caminho que o webhook usa, então prova o fluxo inteiro
aplicacao.post("/afiliados/creditar-manual", async (req, res) => {
  if (!EXPORT_CHAVE || String(req.body?.chave ?? "") !== EXPORT_CHAVE) {
    return res.status(403).json({ erro: "Chave inválida." });
  }
  const numero = String(req.body?.numero ?? "");
  if (!pendentesAfiliados[numero]) {
    return res.status(404).json({ erro: "Pedido não está anotado como indicação de afiliado." });
  }
  await creditarVendaAfiliado(numero, 0);
  const venda = vendasAfiliados.find((v) => v.pedido === numero);
  if (!venda) return res.status(500).json({ erro: "Não foi possível creditar." });
  res.json({ ok: true, venda });
});

// exclui um cadastro B2B e TUDO dele (vendas, saques, pendências) — usado
// para limpar cadastros de teste ou remover um profissional de vez
aplicacao.post("/b2b/excluir", async (req, res) => {
  if (!EXPORT_CHAVE || String(req.body?.chave ?? "") !== EXPORT_CHAVE) {
    return res.status(403).json({ erro: "Chave inválida." });
  }
  const cnpj = String(req.body?.cnpj ?? "").replace(/\D/g, "");
  const cadastro = cadastrosB2B.find((c) => c.cnpj === cnpj);
  if (!cadastro) return res.status(404).json({ erro: "Cadastro não encontrado." });
  cadastrosB2B = cadastrosB2B.filter((c) => c.cnpj !== cnpj);
  vendasAfiliados = vendasAfiliados.filter((v) => v.cnpj !== cnpj);
  saquesAfiliados = saquesAfiliados.filter((s) => s.cnpj !== cnpj);
  for (const [numero, p] of Object.entries(pendentesAfiliados)) {
    if (p.codigo === cadastro.codigoAfiliado) delete pendentesAfiliados[numero];
  }
  await salvarB2B();
  await salvarAfiliados();
  console.log(`[b2b] cadastro ${cnpj} excluído com vendas e saques`);
  res.json({ ok: true });
});

// backup para o robô do GitHub versionar (vendas de afiliado não se perdem)
aplicacao.get("/afiliados/exportar", (req, res) => {
  if (!EXPORT_CHAVE || String(req.query.chave ?? "") !== EXPORT_CHAVE) {
    return res.status(403).json({ erro: "Chave inválida." });
  }
  res.json({
    geradoEm: new Date().toISOString(),
    vendas: vendasAfiliados,
    pendentes: pendentesAfiliados,
    saques: saquesAfiliados,
  });
});

// ===== Envio de logos pelo navegador (sem depender de anexo no chat) =====
// O Mauricio arrasta as imagens na página; ficam guardadas aqui e o robô do
// GitHub coleta em /enviar-logos/exportar para versionar no repositório.
const LOGOS_FALTANTES = ["jacques-janine", "batiste", "latika", "mawwal", "reyou"];
const NOMES_FALTANTES = {
  "jacques-janine": "Jacques Janine",
  batiste: "Batiste",
  latika: "Latika",
  mawwal: "Mawwal",
  reyou: "Reyou",
};
const logosEnviadas = new Map(); // slug → { mime, base64 }
const ARQ_LOGOS_ENVIADAS = "/tmp/logos-enviadas.json";
try {
  const fs = await import("node:fs");
  if (fs.existsSync(ARQ_LOGOS_ENVIADAS)) {
    for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(ARQ_LOGOS_ENVIADAS, "utf8")))) {
      logosEnviadas.set(k, v);
    }
  }
} catch {
  /* sem logos salvas */
}

aplicacao.get("/enviar-logos", (req, res) => {
  if (!EXPORT_CHAVE || String(req.query.chave ?? "") !== EXPORT_CHAVE) {
    return res.status(403).send(paginaExport("Chave inválida", "Use o link com ?chave= correto."));
  }
  const blocos = LOGOS_FALTANTES.map((slug) => {
    const ok = logosEnviadas.has(slug);
    return `<div style="border:2px dashed ${ok ? "#1E8E5A" : "#c9c2dd"};border-radius:12px;padding:16px;margin:10px 0;background:#fff">
      <b>${NOMES_FALTANTES[slug]}</b> — <span id="st-${slug}" style="color:${ok ? "#1E8E5A" : "#777"}">${ok ? "✅ recebida" : "aguardando imagem"}</span><br>
      <input type="file" accept="image/*" style="margin-top:8px" onchange="enviar('${slug}', this)">
      <div id="pv-${slug}" style="margin-top:8px">${ok ? "" : ""}</div>
    </div>`;
  }).join("");
  res.send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Enviar logos — BeautyNow</title></head>
  <body style="font-family:system-ui,sans-serif;background:#f4f2fa;margin:0;padding:24px">
  <div style="max-width:560px;margin:0 auto">
  <h1 style="color:#4A2882">Logos das marcas</h1>
  <p>Para cada marca abaixo, clique em <b>Escolher arquivo</b> e selecione a imagem da logo
  (aquela que você salvou no computador). O envio é automático ao escolher.</p>
  ${blocos}
  <p id="geral" style="font-weight:bold"></p>
  <script>
  const CHAVE = ${JSON.stringify(EXPORT_CHAVE)};
  async function enviar(slug, input) {
    const arquivo = input.files[0];
    if (!arquivo) return;
    const st = document.getElementById("st-" + slug);
    st.textContent = "enviando…"; st.style.color = "#B8730C";
    const leitor = new FileReader();
    leitor.onload = async () => {
      const base64 = String(leitor.result).split(",")[1];
      try {
        const r = await fetch("/enviar-logos/salvar?chave=" + encodeURIComponent(CHAVE), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, mime: arquivo.type || "image/png", base64 }),
        });
        const dados = await r.json();
        if (dados.ok) {
          st.textContent = "✅ recebida"; st.style.color = "#1E8E5A";
          document.getElementById("pv-" + slug).innerHTML =
            '<img src="data:' + (arquivo.type || "image/png") + ';base64,' + base64 + '" style="max-height:60px;max-width:220px;background:#fff;border:1px solid #eee;border-radius:8px;padding:4px">';
          document.getElementById("geral").textContent = dados.total + " de ${LOGOS_FALTANTES.length} logos recebidas. Pode avisar o Claude!";
        } else {
          st.textContent = "❌ " + (dados.erro || "falhou — tente de novo"); st.style.color = "#c0392b";
        }
      } catch (e) {
        st.textContent = "❌ sem conexão — tente de novo"; st.style.color = "#c0392b";
      }
    };
    leitor.readAsDataURL(arquivo);
  }
  </script>
  </div></body></html>`);
});

aplicacao.post("/enviar-logos/salvar", async (req, res) => {
  if (!EXPORT_CHAVE || String(req.query.chave ?? "") !== EXPORT_CHAVE) {
    return res.status(403).json({ erro: "Chave inválida." });
  }
  const { slug, mime, base64 } = req.body ?? {};
  if (!LOGOS_FALTANTES.includes(slug) || !base64 || !String(mime ?? "").startsWith("image/")) {
    return res.status(400).json({ erro: "Envio inválido." });
  }
  const bytes = Buffer.from(String(base64), "base64");
  if (bytes.length < 400 || bytes.length > 5_000_000) {
    return res.status(400).json({ erro: "Imagem vazia ou grande demais (máx. 5MB)." });
  }
  logosEnviadas.set(slug, { mime: String(mime), base64: String(base64) });
  try {
    const fs = await import("node:fs");
    fs.writeFileSync(ARQ_LOGOS_ENVIADAS, JSON.stringify(Object.fromEntries(logosEnviadas)));
  } catch {
    /* segue em memória */
  }
  console.log(`[enviar-logos] recebida: ${slug} (${bytes.length} bytes)`);
  res.json({ ok: true, total: logosEnviadas.size });
});

aplicacao.get("/enviar-logos/exportar", (req, res) => {
  if (!EXPORT_CHAVE || String(req.query.chave ?? "") !== EXPORT_CHAVE) {
    return res.status(403).json({ erro: "Chave inválida." });
  }
  res.json({ total: logosEnviadas.size, logos: Object.fromEntries(logosEnviadas) });
});

aplicacao.get("/bling/conectar", (req, res) => {
  if (!EXPORT_CHAVE || String(req.query.chave ?? "") !== EXPORT_CHAVE) {
    return res.status(403).send(paginaExport("Chave inválida", "Use o link com ?chave= correto."));
  }
  if (!BLING_CLIENT_ID) {
    return res.status(400).send(paginaExport("Falta configurar", "Preencha <b>BLING_CLIENT_ID</b> e <b>BLING_CLIENT_SECRET</b> no Render."));
  }
  const url = `${BLING_OAUTH}/authorize?response_type=code&client_id=${encodeURIComponent(BLING_CLIENT_ID)}&state=${encodeURIComponent(EXPORT_CHAVE)}`;
  res.redirect(url);
});

aplicacao.get("/bling/callback", async (req, res) => {
  const { code, state } = req.query ?? {};
  if (!code || String(state ?? "") !== EXPORT_CHAVE) {
    return res.status(400).send(paginaExport("Autorização inválida", "Recomece em /bling/conectar."));
  }
  try {
    await blingTrocarToken({ grant_type: "authorization_code", code: String(code) });
    res.send(
      paginaExport(
        "✅ Bling conectado!",
        "O site já pode criar pedidos no Bling automaticamente a cada venda aprovada.<br><br>Pode fechar esta página."
      )
    );
  } catch (erro) {
    console.error("[bling] falha no callback:", erro.message);
    res.status(502).send(paginaExport("Falha ao conectar", `O Bling recusou: <b>${erro.message}</b><br><br>Confira o Client ID/Secret no Render e tente de novo.`));
  }
});

aplicacao.get("/bling/status", async (req, res) => {
  if (!EXPORT_CHAVE || String(req.query.chave ?? "") !== EXPORT_CHAVE) {
    return res.status(403).json({ erro: "Chave inválida." });
  }
  let conexao = "desconectado";
  if (blingTokens?.refresh || blingTokens?.access) {
    conexao = "conectado";
    try {
      await blingAccessToken();
    } catch (erro) {
      conexao = `com problema: ${erro.message}`;
    }
  }
  res.json({
    configurado: Boolean(BLING_CLIENT_ID && BLING_CLIENT_SECRET),
    conexao,
    pedidosEnviados: [...blingEnviados],
    ultimoErro: blingUltimoErro,
  });
});

// devolve o refresh token atual pra colar em BLING_REFRESH_TOKEN no Render —
// assim a conexão sobrevive a um deploy do servidor (sem isso, /tmp some a
// cada deploy e é preciso clicar em /bling/conectar de novo). NUNCA commitar
// esse valor em lugar nenhum do repositório — só copiar pro painel do Render.
aplicacao.get("/bling/refresh-token", (req, res) => {
  if (!EXPORT_CHAVE || String(req.query.chave ?? "") !== EXPORT_CHAVE) {
    return res.status(403).json({ erro: "Chave inválida." });
  }
  if (!blingTokens?.refresh) {
    return res.status(404).json({ erro: "Bling não conectado. Abra /bling/conectar primeiro." });
  }
  res.json({ refreshToken: blingTokens.refresh });
});

aplicacao.listen(PORTA, () => {
  console.log(`Servidor BeautyNow na porta ${PORTA} · e-mail=${EMAIL_MODO} · origens=${ORIGENS.join(", ")}`);
});
