# Workflows do n8n

Export JSON de cada workflow, **sem segredos** (credenciais aparecem só pelo nome). Padrão de nome: `GIDEON - <Área> - <Ação>`.

n8n atual: https://n8n-production-a0ba2.up.railway.app (Railway, decisão 007). Vai mudar para o Hugging Face (decisão 010).

| Workflow | Função | Situação |
| --- | --- | --- |
| GIDEON - Núcleo - Atender pedido | Cérebro único: memória → agente → guarda → registra | Ativo |
| GIDEON - Memória - Guardar | Texto → trechos → vetor → Supabase (sem duplicar) | Ativo (sub-workflow) |
| GIDEON - Memória - Buscar | Pergunta → vetor → até 5 trechos parecidos | Ativo (sub-workflow) |
| GIDEON - Lembretes - Disparar | A cada minuto, envia lembretes vencidos | Ativo |
| GIDEON - Sistema - Relatório semanal | Domingo 19h | Ativo |
| GIDEON - Sistema - Alerta de erro | Avisa no Telegram quando algo falha | Ativo |
| GIDEON - Telegram - Conversa | Canal antigo (sem memória) | Ativo até a troca |
| GIDEON - Telegram - Canal | Canal novo, usa o Núcleo | Desligado, aguarda OK |

## Como restaurar em outro n8n

1. Crie as credenciais com estes nomes: `Telegram account` (Telegram API), `Google Gemini(PaLM) Api account` e `GIDEON Supabase` (Postgres; dados em `supabase/README.md`).
2. Importe nesta ordem: Alerta de erro → Memória - Guardar → Memória - Buscar → Núcleo → Lembretes → Relatório → Canal.
3. Ao importar, os IDs mudam: no Núcleo, aponte "Buscar memória" e "Guardar conversa" para os sub-workflows novos; no Canal, aponte "Núcleo"; em cada workflow, escolha o "Alerta de erro" em *Settings → Error workflow*.
4. Troque `DONO_TELEGRAM_ID` pelo ID do usuário do dono no Telegram (não fica no Git por privacidade).
5. Publique na ordem: Alerta, Memória (2), Núcleo, Lembretes, Relatório, Canal.

Os workflows do n8n Cloud antigo ("Jarvis - ...") se perderam sem export (decisão 007).
