# Como o n8n do GIDEON roda no Hugging Face (grátis)

Space: https://huggingface.co/spaces/Gui210113/gideon-n8n
Endereço do n8n: https://gui210113-gideon-n8n.hf.space

## Segredos do Space (Settings → Variables and secrets → New secret)

| Nome | Valor | Onde pegar |
| --- | --- | --- |
| `DB_POSTGRESDB_HOST` | host do *Session pooler* | Supabase → projeto gideon → botão **Connect** → *Session pooler* |
| `DB_POSTGRESDB_USER` | `postgres.ntgsrfqmlaocxjelvnef` | idem |
| `DB_POSTGRESDB_PASSWORD` | senha do banco | Supabase → Database → Settings → *Reset database password* |
| `N8N_ENCRYPTION_KEY` | texto aleatório longo (40+ caracteres) | crie e **guarde no gerenciador de senhas**; sem ele as credenciais do n8n não podem ser lidas |

## Limites do plano grátis

- 2 vCPU e 16 GB de RAM; o disco é apagado a cada reinício (por isso tudo fica no Supabase).
- O Space **dorme depois de 48 h sem visitas**. O uso diário do Telegram o mantém acordado; o lembrete do GitHub (`keepalive.yml`) abre o endereço a cada 6 h por garantia.
- O Space precisa ser **público** para o Telegram conseguir entregar mensagens. Só a tela de login do n8n fica visível; nada de dados.
