# Colocar o Pulso na internet (gratuito)

Ao final você terá um link público (ex.: `https://pulso.vercel.app`) para acessar de
qualquer lugar, protegido por uma senha que só você conhece.

Usamos dois serviços com plano gratuito generoso:
- **Turso** — o banco de dados (SQLite na nuvem)
- **Vercel** — a hospedagem do app (criadores do Next.js)

Tempo total: ~15 minutos.

## 1. Criar o banco no Turso (~5 min)

1. Acesse [turso.tech](https://turso.tech) e clique em **Sign Up** (entre com o GitHub).
2. No painel, clique em **Create Database** — dê o nome `pulso` e escolha a região
   `São Paulo (gru)` se disponível.
3. Abra o banco criado e copie a **URL** (começa com `libsql://`).
4. Ainda no banco, vá em **Tokens** (ou "Generate Token") e crie um token — copie-o.
5. No seu computador, adicione os dois valores ao `.env`:
   ```
   TURSO_DATABASE_URL="libsql://pulso-....turso.io"
   TURSO_AUTH_TOKEN="eyJ..."
   ```
6. Crie as tabelas no banco da nuvem:
   ```bash
   npm run db:push:turso
   ```
   Deve aparecer "Schema aplicado no Turso".

## 2. Publicar na Vercel (~5 min)

1. Acesse [vercel.com](https://vercel.com) e clique em **Sign Up → Continue with GitHub**.
2. Clique em **Add New… → Project** e importe o repositório `teste`
   (autorize o acesso ao GitHub se pedido). Em "Branch", selecione a branch do projeto.
3. Antes de clicar em Deploy, abra **Environment Variables** e adicione:

   | Nome | Valor |
   |---|---|
   | `TURSO_DATABASE_URL` | a URL `libsql://...` do passo 1 |
   | `TURSO_AUTH_TOKEN` | o token do passo 1 |
   | `SENHA_DE_ACESSO` | uma senha forte, só sua — será pedida ao abrir o site |
   | `GEMINI_API_KEY` **ou** `ANTHROPIC_API_KEY` | sua chave de IA (Gemini é gratuito — docs/INTEGRACOES.md) |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | chaves de push (docs/NOTIFICACOES.md) |
   | `CRON_SECRET` | texto aleatório longo — protege o disparo diário de notificações |
   | `DATABASE_URL` | `file:./dev.db` (exigido pelo Prisma no build; não é usado em produção) |

4. Clique em **Deploy** e aguarde (~2 min). A Vercel mostrará o link do seu projeto —
   algo como `https://teste-xxxx.vercel.app`.
5. (Opcional) Em *Settings → Domains* você pode trocar para um nome melhor, ex.:
   `pulso.vercel.app`, se estiver livre.

Pronto: abra o link, digite sua senha e use de qualquer lugar, inclusive do celular.

## 3. Google (Classroom/Gmail/Drive) em produção

Se você configurou as integrações Google (docs/INTEGRACOES.md), ajuste para o novo endereço:

1. No [Google Cloud Console](https://console.cloud.google.com/apis/credentials), edite seu
   OAuth Client e **adicione** aos URIs de redirecionamento:
   ```
   https://SEU-LINK.vercel.app/api/google/callback
   ```
   (mantenha o de localhost também, para uso local)
2. Na Vercel, adicione as variáveis:

   | Nome | Valor |
   |---|---|
   | `GOOGLE_CLIENT_ID` | o mesmo do `.env` |
   | `GOOGLE_CLIENT_SECRET` | o mesmo do `.env` |
   | `GOOGLE_REDIRECT_URI` | `https://SEU-LINK.vercel.app/api/google/callback` |

3. Em *Deployments*, clique em **Redeploy** para aplicar.

## Atualizações futuras

A Vercel fica conectada ao GitHub: **todo push na branch configurada publica sozinho** uma
nova versão. Nenhum passo manual.

## Problemas comuns

- **Erro de banco no primeiro acesso** — o passo `npm run db:push:turso` não foi executado
  (as tabelas não existem no Turso).
- **Pede senha em loop** — confira se `SENHA_DE_ACESSO` na Vercel não tem espaços extras.
- **Assistente IA não responde** — falta `ANTHROPIC_API_KEY` nas variáveis da Vercel.
- **Mudei o schema do banco** — rode `npm run db:push:turso` de novo para aplicar no Turso.
