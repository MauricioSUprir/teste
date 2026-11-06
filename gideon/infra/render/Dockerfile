# GIDEON: n8n no Render (plano grátis, 512 MB). Banco no Supabase (esquema n8n).
# Senha do banco e chave de criptografia ficam nas variáveis secretas do Render, nunca aqui.
FROM n8nio/n8n:2.46.6

ENV N8N_PORT=5678 \
    N8N_PROTOCOL=https \
    N8N_PROXY_HOPS=1 \
    GENERIC_TIMEZONE=America/Sao_Paulo \
    TZ=America/Sao_Paulo \
    DB_TYPE=postgresdb \
    DB_POSTGRESDB_DATABASE=postgres \
    DB_POSTGRESDB_PORT=5432 \
    DB_POSTGRESDB_SCHEMA=n8n \
    DB_POSTGRESDB_SSL_ENABLED=true \
    DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED=false \
    DB_POSTGRESDB_POOL_SIZE=3 \
    EXECUTIONS_DATA_PRUNE=true \
    EXECUTIONS_DATA_MAX_AGE=336 \
    EXECUTIONS_DATA_PRUNE_MAX_COUNT=5000 \
    N8N_DIAGNOSTICS_ENABLED=false \
    N8N_PERSONALIZATION_ENABLED=false \
    N8N_TEMPLATES_ENABLED=false \
    N8N_COMMUNITY_PACKAGES_ENABLED=false \
    N8N_VERSION_NOTIFICATIONS_ENABLED=false \
    N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true \
    NODE_OPTIONS=--max-old-space-size=300

EXPOSE 5678
