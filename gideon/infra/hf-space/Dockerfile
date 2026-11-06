# n8n do GIDEON no Hugging Face Spaces (grátis). Decisão 010.
# Versão fixa: atualizar só depois de ler as notas de versão do n8n.
FROM n8nio/n8n:2.46.6

# Endereço público do Space (webhooks do Telegram chegam aqui)
ENV N8N_PORT=5678 \
    N8N_PROTOCOL=https \
    N8N_HOST=gui210113-gideon-n8n.hf.space \
    WEBHOOK_URL=https://gui210113-gideon-n8n.hf.space/ \
    N8N_EDITOR_BASE_URL=https://gui210113-gideon-n8n.hf.space/ \
    N8N_PROXY_HOPS=1 \
    GENERIC_TIMEZONE=America/Sao_Paulo \
    TZ=America/Sao_Paulo

# Banco no Supabase (projeto gideon, esquema n8n). Host, usuário, senha e
# N8N_ENCRYPTION_KEY vêm dos "Secrets" do Space, nunca deste arquivo.
ENV DB_TYPE=postgresdb \
    DB_POSTGRESDB_DATABASE=postgres \
    DB_POSTGRESDB_PORT=5432 \
    DB_POSTGRESDB_SCHEMA=n8n \
    DB_POSTGRESDB_SSL_ENABLED=true \
    DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED=false \
    DB_POSTGRESDB_POOL_SIZE=4

# Economia de espaço no banco grátis (500 MB) e privacidade
ENV EXECUTIONS_DATA_PRUNE=true \
    EXECUTIONS_DATA_MAX_AGE=336 \
    EXECUTIONS_DATA_PRUNE_MAX_COUNT=5000 \
    N8N_DIAGNOSTICS_ENABLED=false \
    N8N_PERSONALIZATION_ENABLED=false \
    N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true

EXPOSE 5678
