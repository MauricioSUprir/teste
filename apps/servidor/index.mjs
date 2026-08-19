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

const VALIDADE_MS = 10 * 60_000;
const MAX_TENTATIVAS = 5;
const MAX_ENVIOS_POR_JANELA = 3;

const aplicacao = express();
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
  const { pedido, meio } = req.body ?? {};
  if (!pedido?.numero || !Array.isArray(pedido.itens)) {
    return res.status(400).json({ erro: "Pedido incompleto." });
  }
  try {
    const preferencia = await mp("/checkout/preferences", {
      method: "POST",
      body: JSON.stringify({
        external_reference: pedido.numero,
        items: pedido.itens.map((i) => ({
          title: i.titulo,
          quantity: i.quantidade,
          currency_id: "BRL",
          unit_price: Math.round(i.precoCentavos) / 100,
        })),
        payer: { email: pedido.clienteEmail, name: pedido.clienteNome },
        payment_methods:
          meio === "boleto"
            ? { excluded_payment_types: [{ id: "credit_card" }, { id: "debit_card" }] }
            : { excluded_payment_types: [{ id: "ticket" }], installments: 6 },
        back_urls: {
          success: `${SITE_URL}/checkout/confirmacao/`,
          pending: `${SITE_URL}/checkout/confirmacao/`,
          failure: `${SITE_URL}/checkout/`,
        },
        auto_return: "approved",
        statement_descriptor: "BEAUTYNOW",
      }),
    });
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

aplicacao.listen(PORTA, () => {
  console.log(`Servidor BeautyNow na porta ${PORTA} · e-mail=${EMAIL_MODO} · origens=${ORIGENS.join(", ")}`);
});
