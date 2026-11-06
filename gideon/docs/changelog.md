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
