# Pendências — próxima sessão

Plano combinado com o Mauricio em 19/08/2026. Estado atual: site no ar em
https://mauriciosuprir.github.io/teste/ · PR #1 aberto · servidor e script de
importação prontos no repositório, aguardando credenciais/liberações abaixo.

## O que o Claude vai fazer

1. **Importar o catálogo real do Hub Suprir** (1.222 produtos: nomes, preços,
   marcas, fotos) — script pronto em `scripts/sincronizar-catalogo.mjs`.
   Bloqueado só pela rede do ambiente (item 1 do Mauricio abaixo).
2. **Mercado Pago** — ✅ IMPLEMENTADO (Pix direto com QR + cartão/boleto via
   Checkout Pro + webhook de aprovação). Falta apenas o Access Token no
   servidor (variável `MP_ACCESS_TOKEN`) para ligar.
3. **Gráficos de vendas no painel admin** — visão dia/semana/mês/ano com
   gráficos e resumos escritos (receita, pedidos, ticket médio, comparativos).
   Sem dependências externas.
4. **Código por e-mail real** — ✅ FEITO em 19/08 via Brevo (HTTPS, 300/dia
   grátis; SMTP do Gmail é bloqueado no Render gratuito). Notificações de
   venda saem pelo mesmo canal. Falta só o **Google real** (Client ID).
5. ~~Hospedar `apps/servidor`~~ — ✅ FEITO em 19/08: servidor no ar em
   https://beautynow-servidor.onrender.com e site conectado a ele.
6. **Notificações de venda para o admin** — a cada venda concluída, o
   servidor envia e-mail de notificação para a conta do administrador
   (lojabeautynow@gmail.com e demais e-mails que o Mauricio indicar), com:
   - a logo BeautyNow (monograma BN roxo + wordmark violeta) no topo;
   - tipografia parecida com a do site (títulos serifados estilo Fraunces
     com fallback Georgia, texto em Inter/Arial — e-mail exige fontes com
     fallback seguro);
   - resumo da venda: número do pedido, cliente, itens, total, forma de
     pagamento e link para o painel /admin.
   Depende dos mesmos itens 4–5 do Mauricio (senha de app do Gmail +
   hospedagem do servidor). Já existe template de e-mail em
   `apps/servidor/index.mjs` para seguir de base.

## Extras já entregues (19/08)

- **Cupons de desconto**: cliente aplica na sacola (seed `BEMVINDA10`,
  10% acima de R$ 99); gestão na aba **Cupons** do painel /admin
  (criar percentual ou valor fixo, pedido mínimo, ativar/desativar, excluir).
- **Favoritos ♡**: coração nos cards + seção "Meus favoritos" em /conta.
- **Busca no FAQ**: filtro por texto (ignora acentos) em /atendimento.

## O que depende do Mauricio

1. **Liberar a rede do ambiente Claude**: claude.ai/code → ícone de nuvem
   acima da caixa de mensagem → engrenagem do ambiente → Network access →
   **Full** (ou Custom com `comercial.thebeautyhub.app` + caixinha dos
   package managers marcada). Depois avisar "liberei".
   *Plano B: anexar no chat um export JSON/CSV do painel com os produtos.*
2. **Access Token do Mercado Pago**: mercadopago.com.br/developers →
   Suas integrações → Criar aplicação → enviar o token (teste e produção).
3. **Client ID do Google**: console.cloud.google.com → APIs e serviços →
   Credenciais → ID do cliente OAuth (Aplicativo da Web) com origem
   `https://mauriciosuprir.github.io` → enviar o Client ID.
4. **Senha de app do Gmail** (lojabeautynow@gmail.com): Conta Google →
   Segurança → Verificação em duas etapas → Senhas de app → enviar.
5. **Hospedagem do servidor**: conta gratuita no render.com (enviar token de
   API) ou acesso à VPS.

## Referências rápidas

- Admin do site: `/admin` (e-mail da loja + senha + código de verificação)
- Rodar local: `npm install && npm run dev`
- Sincronizar catálogo: `HUB_API_KEY=... node scripts/sincronizar-catalogo.mjs`
- Variáveis: ver `.env.example`
