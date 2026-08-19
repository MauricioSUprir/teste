# Pendências — próxima sessão

Plano combinado com o Mauricio em 19/08/2026. Estado atual: site no ar em
https://mauriciosuprir.github.io/teste/ · PR #1 aberto · servidor e script de
importação prontos no repositório, aguardando credenciais/liberações abaixo.

## O que o Claude vai fazer

1. **Importar o catálogo real do Hub Suprir** (1.222 produtos: nomes, preços,
   marcas, fotos) — script pronto em `scripts/sincronizar-catalogo.mjs`.
   Bloqueado só pela rede do ambiente (item 1 do Mauricio abaixo).
2. **Mercado Pago** — checkout com Pix/cartão/boleto reais; cada venda cai na
   conta MP da loja. Implementar no `apps/servidor` (token nunca no front).
3. **Gráficos de vendas no painel admin** — visão dia/semana/mês/ano com
   gráficos e resumos escritos (receita, pedidos, ticket médio, comparativos).
   Sem dependências externas.
4. **Ativar Google real e código por e-mail real** — já implementados e
   testados; só ligam com as credenciais dos itens 3–4 abaixo.
5. **Hospedar `apps/servidor`** e apontar o site para ele
   (`NEXT_PUBLIC_SERVIDOR_URL`), tirando o site do modo demonstração.

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
