# Workflows do n8n

Export JSON de cada workflow, **sem credenciais**. Padrão de nome: `GIDEON - <Área> - <Ação>`.

n8n: https://n8n-production-a0ba2.up.railway.app (Railway, decisão 007).

| Workflow | Arquivo | Situação |
| --- | --- | --- |
| GIDEON - Telegram - Conversa | `workflows/GIDEON - Telegram - Conversa.json` | Ativo |
| GIDEON - Sistema - Alerta de erro | `workflows/GIDEON - Sistema - Alerta de erro.json` | Ativo |

## Como restaurar um workflow

1. No n8n, crie as credenciais `Telegram account` (Telegram API) e `Google Gemini(PaLM) Api account`.
2. Importe o JSON (menu do n8n → Import from file).
3. Troque `DONO_TELEGRAM_ID` pelo ID do usuário do dono no Telegram (não fica no Git por privacidade).
4. Selecione as credenciais nos nós e ative.

Os workflows do n8n Cloud antigo ("Jarvis - Fase 1", "Jarvis - Despertador WhatsApp" e outros) se perderam sem export (decisão 007).
