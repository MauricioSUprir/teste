/**
 * E-mail do código de 6 dígitos — no mesmo visual "vidro claro" do site:
 * fundo claro, cartão branco, faixa com o gradiente da loja, logo nova,
 * escudo e o código em destaque.
 *
 * HTML de e-mail: tabelas e estilos inline (Gmail, Outlook, Apple Mail e
 * celular não aceitam CSS de página). As imagens moram no site publicado
 * (apps/storefront/public/email); sem imagem, o texto alternativo e o resto
 * do e-mail continuam legíveis.
 *
 * O assunto mantém o código ("Seu código BeautyNow: 123456") para o celular
 * oferecer o preenchimento automático.
 */
const IMAGENS = "https://www.beautynowstore.com.br/email";

const MARCAS = {
  beautynow: {
    nome: "BeautyNow",
    site: "https://www.beautynowstore.com.br",
    dominio: "beautynowstore.com.br",
    cor: "#6B2BD9",
    escura: "#3E1A8C",
    clara: "#F1EAFD",
    borda: "#E2D5FA",
    faixa: "linear-gradient(90deg,#2F5BEA,#6B2BD9)",
    logo: { src: `${IMAGENS}/logo-beautynow.png`, largura: 88, altura: 44 },
    escudo: `${IMAGENS}/escudo-beautynow.png`,
    acao: "entrar na sua conta BeautyNow",
    rodape: "BeautyNow Cosméticos · Rio de Janeiro, RJ",
  },
  be2beauty: {
    nome: "Be2Beauty",
    site: "https://www.be2beauty.com.br",
    dominio: "be2beauty.com.br",
    cor: "#1F5FA8",
    escura: "#13315C",
    clara: "#EAF1FA",
    borda: "#D3E2F4",
    faixa: "linear-gradient(90deg,#1F6FD1,#13315C)",
    logo: { src: `${IMAGENS}/logo-be2beauty.png`, largura: 145, altura: 34 },
    escudo: `${IMAGENS}/escudo-be2beauty.png`,
    acao: "entrar na sua conta Be2Beauty",
    rodape: "Be2Beauty · Only Professional · Rio de Janeiro, RJ",
  },
  shopping: {
    nome: "Beauty Shopping",
    site: "https://shopping-da-beleza.onrender.com",
    dominio: "shopping-da-beleza.onrender.com",
    cor: "#7A2D9C",
    escura: "#4B1663",
    clara: "#F5ECFA",
    borda: "#E8D6F2",
    faixa: "linear-gradient(90deg,#B04FD6,#7A2D9C)",
    logo: null,
    escudo: `${IMAGENS}/escudo-shopping.png`,
    acao: "entrar no Beauty Shopping",
    rodape: "Beauty Shopping · o shopping 3D da beleza",
  },
};

/** marca do e-mail a partir do que o site mandou (só valores conhecidos) */
export function marcaDoEmail(valor) {
  return Object.hasOwn(MARCAS, valor) ? valor : "beautynow";
}

const FONTE = "'Jost','Helvetica Neue',Helvetica,Arial,sans-serif";

/** { assunto, texto, html, remetente } do e-mail com o código */
export function emailDoCodigo(codigo, marca = "beautynow") {
  const m = MARCAS[marcaDoEmail(marca)];
  const digitos = String(codigo).replace(/\D/g, "").slice(0, 6);

  const logo = m.logo
    ? `<img src="${m.logo.src}" width="${m.logo.largura}" height="${m.logo.altura}" alt="${m.nome}" style="display:block;border:0;outline:none;text-decoration:none;height:${m.logo.altura}px;width:${m.logo.largura}px">`
    : `<span style="font-family:${FONTE};font-size:13px;font-weight:700;letter-spacing:5px;color:${m.cor}">BEAUTY SHOPPING</span>`;

  const texto = [
    `Seu código de verificação ${m.nome}: ${digitos}`,
    "",
    "Ele vale por 10 minutos.",
    "Nunca passe este código para ninguém. Se você não tentou entrar, ignore este e-mail.",
    "",
    m.site,
  ].join("\n");

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Seu código ${m.nome}</title>
<link href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#F5F4F8;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px">Seu código de acesso é ${digitos}. Ele vale por 10 minutos.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F4F8">
<tr><td align="center" style="padding:32px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#FFFFFF;border:1px solid #EBEBEB;border-radius:20px;overflow:hidden;border-collapse:separate">
    <tr><td style="height:5px;line-height:5px;font-size:0;background-color:${m.cor};background-image:${m.faixa}">&nbsp;</td></tr>
    <tr><td align="center" style="padding:28px 32px 0">${logo}</td></tr>
    <tr><td align="center" style="padding:12px 32px 0">
      <img src="${m.escudo}" width="117" height="117" alt="" style="display:block;border:0;outline:none;width:117px;height:117px">
    </td></tr>
    <tr><td align="center" style="padding:0 32px;font-family:${FONTE}">
      <h1 style="margin:0;font-family:${FONTE};font-size:24px;line-height:1.25;font-weight:700;color:#212121">Confirme que é você</h1>
      <p style="margin:10px 0 0;font-family:${FONTE};font-size:15px;line-height:1.6;color:#4A4A4A">Use o código abaixo para ${m.acao}.<br>Ele vale por <strong style="color:#212121">10 minutos</strong>.</p>
    </td></tr>
    <tr><td align="center" style="padding:24px 32px 0">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:${m.clara};border:1px solid ${m.borda};border-radius:16px;border-collapse:separate">
        <tr><td align="center" style="padding:18px 18px 18px 30px;font-family:${FONTE};font-size:36px;line-height:1;font-weight:700;letter-spacing:12px;color:${m.escura};white-space:nowrap">${digitos}</td></tr>
      </table>
      <p style="margin:10px 0 0;font-family:${FONTE};font-size:12px;line-height:1.5;color:#707070">Digite ou cole o código na tela de verificação.</p>
    </td></tr>
    <tr><td style="padding:26px 32px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F4F8;border-radius:12px;border-collapse:separate">
        <tr><td style="padding:14px 16px;font-family:${FONTE};font-size:13px;line-height:1.55;color:#4A4A4A">
          <strong style="color:#212121">Dica de segurança:</strong> nunca passe este código para ninguém. A ${m.nome} não pede o código por telefone, WhatsApp ou e-mail.
        </td></tr>
      </table>
    </td></tr>
    <tr><td align="center" style="padding:20px 32px 28px;font-family:${FONTE};font-size:13px;line-height:1.55;color:#707070">
      Não tentou entrar? É só ignorar este e-mail: sem o código, ninguém acessa a sua conta.
    </td></tr>
    <tr><td align="center" style="padding:18px 32px;border-top:1px solid #EBEBEB;background:#FBFAFD;font-family:${FONTE};font-size:12px;line-height:1.6;color:#707070">
      <a href="${m.site}" style="color:${m.cor};font-weight:700;text-decoration:none">${m.dominio}</a><br>${m.rodape}
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

  return { assunto: `Seu código ${m.nome}: ${digitos}`, texto, html, remetente: m.nome };
}
