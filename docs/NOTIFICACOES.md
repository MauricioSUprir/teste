# Notificações

O Pulso envia um **resumo diário** com: tarefas atrasadas e vencendo em 48h (com o
nível de urgência), provas/eventos do calendário de hoje e amanhã, flashcards vencidos e os
blocos de estudo do dia. Ele chega por dois canais:

## 🔔 Push — a notificação que aparece na tela

Funciona no computador (Chrome, Edge, Firefox) e no celular Android. No iPhone, primeiro
adicione o site à tela de início (Compartilhar → Adicionar à Tela de Início) e ative por lá.

**Configurar (uma vez):**

1. Gere as chaves:
   ```bash
   npx web-push generate-vapid-keys
   ```
2. Copie as duas chaves para o `.env` (e para as variáveis da Vercel, se publicado):
   ```
   NEXT_PUBLIC_VAPID_PUBLIC_KEY="B..."
   VAPID_PRIVATE_KEY="..."
   ```
3. Abra a página **Notificações** no app e clique em **Ativar neste dispositivo** (repita
   em cada aparelho onde quiser receber — pode ativar no computador e no celular).

## ✉️ E-mail

O resumo é enviado **pelo seu próprio Gmail, para você mesmo** — sem serviços de e-mail
externos. Basta a conta Google estar conectada (página Integrações).

> Conectou o Google antes desta funcionalidade existir? Desconecte e conecte de novo na
> página Integrações, para autorizar o envio (escopo gmail.send).

## ⏰ Quando dispara

- **Publicado na Vercel**: automaticamente todo dia às **8h de Brasília** (11h UTC — ajuste
  em `vercel.json`), e só quando existe algo pendente. Defina também `CRON_SECRET` (um
  texto aleatório) nas variáveis da Vercel para proteger o disparo.
- **Rodando localmente**: o computador precisa estar ligado com o servidor rodando; use o
  botão **"Enviar resumo agora"** na página Notificações, ou agende no seu sistema
  (ex.: Agendador de Tarefas do Windows chamando
  `curl -X POST http://localhost:3000/api/notificacoes/enviar`).

## Como funciona por dentro

- `lib/notificacoes.ts` monta o resumo e envia: push via protocolo Web Push (biblioteca
  `web-push` + chaves VAPID) e e-mail via API do Gmail com a conta conectada.
- `public/sw.js` é o service worker que recebe o push e mostra a notificação, mesmo com a
  aba fechada (com o navegador aberto ou o celular ligado).
- Cada dispositivo ativado vira uma linha na tabela `PushSubscription`; inscrições
  expiradas são limpas automaticamente ao enviar.
