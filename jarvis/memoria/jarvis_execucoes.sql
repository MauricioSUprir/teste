-- Tabela de execuções (regras-qualidade.md, seção 2.1). PROPOSTA — ainda não aplicada em nenhum banco.
-- Decisão pendente: Supabase (Postgres) ou tabela do n8n. Esta versão é para Supabase.
create table if not exists jarvis_execucoes (
  id              bigint generated always as identity primary key,
  data_hora       timestamptz not null default now(),
  canal           text not null check (canal in ('telegram','whatsapp','voz','painel')),
  pedido_resumo   text,
  ferramenta      text,
  modelo          text,                 -- gemini / claude-haiku / local ...
  tokens_entrada  integer,
  tokens_saida    integer,
  custo_estimado  numeric(10,4),        -- em reais
  tempo_ms        integer,
  status          text not null check (status in ('sucesso','erro','fallback')),
  erro_mensagem   text,
  nota_usuario    text check (nota_usuario in ('util','nao_util'))
);
create index if not exists jarvis_execucoes_data_idx   on jarvis_execucoes (data_hora desc);
create index if not exists jarvis_execucoes_status_idx on jarvis_execucoes (status);
alter table jarvis_execucoes enable row level security;  -- só o service role acessa
