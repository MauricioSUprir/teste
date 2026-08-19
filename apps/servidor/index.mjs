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

const VALIDADE_MS = 10 * 60_000;
const MAX_TENTATIVAS = 5;
const MAX_ENVIOS_POR_JANELA = 3;

const aplicacao = express();
aplicacao.use(express.json({ limit: "100kb" }));
aplicacao.use(cors({ origin: ORIGENS }));

// transporte de e-mail
const transporte =
  EMAIL_MODO === "gmail"
    ? createTransport({
        service: "gmail",
        auth: { user: process.env.EMAIL_USUARIO, pass: process.env.EMAIL_SENHA_APP },
      })
    : null;

async function enviarEmailCodigo(email, codigo) {
  const texto = `Seu código de verificação BeautyNow é: ${codigo}\n\nEle vale por 10 minutos. Se você não tentou entrar, ignore este e-mail.`;
  if (!transporte) {
    // modo console (teste): o código sai no log do servidor
    console.log(`[email-teste] para=${email} codigo=${codigo}`);
    return;
  }
  await transporte.sendMail({
    from: `"BeautyNow" <${process.env.EMAIL_USUARIO}>`,
    to: email,
    subject: `Seu código BeautyNow: ${codigo}`,
    text: texto,
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

  if (!transporte) {
    console.log(`[email-teste] notificacao-venda para=${EMAILS_NOTIFICACAO.join(",")} pedido=${pedido.numero} total=${formatarReais(pedido.totalCentavos ?? 0)}`);
    return;
  }
  await Promise.all(
    EMAILS_NOTIFICACAO.map((destino) =>
      transporte.sendMail({
        from: `"BeautyNow" <${process.env.EMAIL_USUARIO}>`,
        to: destino,
        subject: assunto,
        html,
      })
    )
  );
}

// códigos pendentes em memória: email → {codigo, expiraEm, tentativas, envios[]}
const pendentes = new Map();

const emailValido = (e) => typeof e === "string" && /^\S+@\S+\.\S+$/.test(e) && e.length <= 254;

aplicacao.get("/saude", (_req, res) => {
  res.json({ ok: true, emailModo: EMAIL_MODO, hubConfigurado: HUB_API_KEY.length > 0 });
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

  // notificação de venda para o(s) admin(s) — independe do Hub
  notificarVenda(pedido).catch((erro) =>
    console.error("falha ao notificar venda:", erro.message)
  );

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

aplicacao.listen(PORTA, () => {
  console.log(`Servidor BeautyNow na porta ${PORTA} · e-mail=${EMAIL_MODO} · origens=${ORIGENS.join(", ")}`);
});
