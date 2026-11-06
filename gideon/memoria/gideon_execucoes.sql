-- Tabela de execuções (regras-qualidade.md, seção 2.1).
-- APLICADA em 06/11/2026 no Supabase, projeto `gideon` (ref ntgsrfqmlaocxjelvnef), migração `gideon_execucoes`.
-- Nome novo (gideon_*): as tabelas jarvis_* antigas se perderam com o n8n Cloud.
create table if not exists public.gideon_execucoes (
  id              bigint generated always as identity primary key,
  data_hora       timestamptz not null default now(),
  canal           text not null check (canal in ('telegram','whatsapp','voz','painel','sistema')),
  pedido_resumo   text,
  ferramenta      text,
  modelo          text,
  tokens_entrada  integer,
  tokens_saida    integer,
  custo_estimado  numeric(10,4),
  tempo_ms        integer,
  status          text not null check (status in ('sucesso','erro','fallback')),
  erro_mensagem   text,
  nota_usuario    text check (nota_usuario in ('util','nao_util')),
  workflow        text,
  execucao_n8n    text
);
create index if not exists gideon_execucoes_data_idx   on public.gideon_execucoes (data_hora desc);
create index if not exists gideon_execucoes_status_idx on public.gideon_execucoes (status);
alter table public.gideon_execucoes enable row level security;
