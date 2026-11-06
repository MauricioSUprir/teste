# Changelog

## 2026-11-05
- Estrutura inicial do projeto criada (pastas, docs, decisões, schema de `gideon_execucoes`, checklist da Fase 1).
- Provisoriamente dentro do repositório `teste`, em `gideon/`; mover para o repositório privado `gideon`.

- Nome oficial da IA definido como GIDEON (decisão 006); pasta renomeada de `jarvis/` para `gideon/`.
- Adicionado `CLAUDE.md` com as instruções permanentes para o Claude.

## 2026-11-06
- n8n Cloud fora do ar (instância não existe). Decisão 007: n8n self-hosted no Railway, projeto `gideon-n8n`.
- Conta de dono criada no n8n novo. Ambiente `gideon` criado no Claude Code, com a API key do n8n como segredo de rede. Acesso pela API testado (0 workflows, 0 credenciais).
- Workflows `GIDEON - Telegram - Conversa` (Gemini 3.5 Flash-Lite, decisão 008) e `GIDEON - Sistema - Alerta de erro` criados, ativados e testados pelo dono. Exports em `n8n/workflows/`. Prompt em `prompts/gideon-principal.md`.
- Decisão 009: escopo completo (9 projetos) e orçamento zero por enquanto; memória no Supabase.
- Supabase: projeto `sinapse` pausado (a pedido do dono) e projeto `gideon` criado (us-east-1, plano grátis). Tabela `gideon_execucoes` aplicada.
- Render descartado para o n8n: a conta já tem 8 serviços grátis dividindo 750 h/mês. Hospedagem grátis do n8n em decisão (ver `docs/plano-completo.md`).
- Supabase: tabelas da espinha dorsal e da memória (migrações 002 a 004), usuário `gideon_n8n` com acesso restrito.
- Fase 1 (parte): `GIDEON - Núcleo - Atender pedido`, `Memória - Guardar/Buscar`, `Lembretes - Disparar`, `Sistema - Relatório semanal` criados, ativos e testados. Canal novo do Telegram criado desligado (aguarda OK).
- Decisão 010: n8n grátis no Hugging Face Spaces; arquivos em `infra/hf-space/`.
- Teste dos vetores do Gemini (`gemini-embedding-2`, 768 dimensões) no plano grátis: ok.

### Incidente 06/11/2026 — mensagens "⏰ Lembrete:" vazias a cada minuto
- **O que houve:** o `GIDEON - Lembretes - Disparar` mandou uma mensagem vazia por minuto (~30) ao dono.
- **Causa:** no n8n, um `UPDATE ... RETURNING` que não altera nenhuma linha devolve um item `{success:true}` em vez de nenhum item; o passo seguinte (Telegram) rodava para esse item. O caso "sem lembrete vencido" não foi testado antes de ligar.
- **Correção:** workflow desligado na hora; novo passo "Só lembretes de verdade" deixa passar apenas itens com `id` e `texto`. Testado numa cópia sem envio: com zero lembretes, o fluxo para no filtro.
- **Regra nova:** todo passo do Postgres que alimenta um envio (Telegram, WhatsApp, e-mail) passa por um filtro de itens reais, e o caso "vazio" é testado antes de ligar.
- **Situação:** continua desligado até o dono aprovar o canal novo.
- Estrutura por categorias e subcategorias dos 9 projetos (`docs/estrutura-projetos.md`), análise de limites do n8n e proposta de substituto (Supabase Edge Functions + pg_cron).
- Hugging Face descartado (Docker exige PRO). Teste do n8n no Render grátis iniciado (serviço `gideon-n8n`).
- Nova categoria ★ GIDEON HOME (o Jarvis): casa própria, interface estilo Jarvis e conversa contínua por voz com Gemini Live (plano grátis).
- Decisão 011: Núcleo do GIDEON no Supabase (Edge Function `gideon` + pg_cron). Função publicada e testada (rota de relatório); falta o dono cadastrar GEMINI_API_KEY e TELEGRAM_BOT_TOKEN.
- **Troca feita:** Telegram, lembretes (pg_cron a cada minuto) e relatório (domingo 19h) rodando no Supabase. Workflows do n8n desligados (reserva). Serviço de teste no Render suspenso.
- Testes do Núcleo no Supabase: conversa com memória antiga (4,8 s), tarefa + lembrete na mesma mensagem (8 s, 2 ferramentas, fuso correto), agendador sem envios vazios.
- Conexão Google (Agenda, Gmail só leitura, Drive só leitura) publicada na função `gideon` (rotas `google/conectar` e `google/retorno`, autorização no Vault). Link de autorização enviado ao dono.
- Correção: chaves com quebra de linha no fim (o GOOGLE_CLIENT_ID foi salvo com `\n`) quebravam o login do Google; agora todas as chaves passam por `trim()`. Link de autorização também é devolvido pela rota `google/conectar`.
- Google: conta combinada fixada em `gideon_config.google_conta` (gui.drodrigues21@gmail.com); o link força a escolha de conta e a conexão é recusada se vier de outra conta.
- ✅ Google conectado (gui.drodrigues21@gmail.com). Teste: "eventos nos próximos 7 dias e e-mails não lidos" → usou agenda_listar e gmail_buscar, 3,2 s.
- WhatsApp (código pronto, ainda não publicado): webhook do WAHA → Núcleo (só o dono; ignora respostas do próprio GIDEON, que começam com 🤖), ferramenta `whatsapp_enviar` com confirmação, rota `configurar-whatsapp` com código de pareamento. WAHA no Render: versão 2026.8 CORE, sem sessão (precisa conectar de novo).
- Decisão 012: WhatsApp em espera (controle parental do WhatsApp bloqueia aparelhos conectados). Sessão do WAHA parada.
- GIDEON Home publicado: site https://gideon-home.onrender.com (Render estático), rotas home-sessao/home-ferramenta/home-conversa na função `gideon`, comando /home no Telegram. Teste da sessão: senha temporária do Google ok, 14 ferramentas.
- Pedido do dono: rosto holográfico (malha azul) que se mexe ao falar, no lugar do orbe.
- GIDEON Home: corrigido "não responde" — o Chrome deixava o áudio pausado porque os contextos de áudio eram criados depois de esperar a sessão; agora são criados e retomados no toque. Painel de diagnóstico com #debug. Teste em Chromium com microfone simulado: fala reconhecida e resposta em voz em ~1 s.
- GIDEON Home: autodiagnóstico (a página manda o que aconteceu para `gideon_execucoes`, ferramenta `diagnostico`). No Edge do dono, o microfone escolhido mandava só zeros. A página agora testa sozinha os microfones do PC e troca para o que tem som (guarda a escolha), mostra uma lista para escolher e, se nenhum tiver som, diz o que conferir no Windows.
- GIDEON Home: por voz o modelo se apresentava como "Gemini" e dizia não ter Gmail nem Agenda. Causa: a senha temporária do Google, quando traz `bidiGenerateContentSetup`, faz o Google ignorar o setup enviado pelo navegador (prompt, ferramentas e voz). Correção: a configuração inteira (prompt do GIDEON, ferramentas, voz, transcrição, compressão de contexto) vai dentro da senha temporária. Testado: responde como GIDEON, chama `listar_tarefas` e `buscar_memoria` e fala o resultado. Prompt de voz agora proíbe dizer "guardei" sem chamar a ferramenta.
- GIDEON Home: rosto holográfico 3D no lugar do orbe, seguindo o logo enviado pelo dono (cabeça careca de luz azul, orelhas, pontos em grade, olhos brilhantes, sorriso leve, riscos de luz no fundo, "G I D E O N" com a linha brilhante). Rosto original: malha genérica do MediaPipe (Apache 2.0) com traços suaves. A boca abre com o volume da voz e muda de formato com agudos e graves; pisca, olha, flutua; dorme (olhos fechados) quando desligado. three.js r186.1 empacotado em `home/vendor/` (sem CDN). Ícones do app gerados do próprio rosto. Sem WebGL, volta o orbe.
