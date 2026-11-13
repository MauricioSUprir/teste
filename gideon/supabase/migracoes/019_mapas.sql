-- 019 — Thought Map (módulo 72, 13/11/2026): mapas de pensamento do GIDEON Core.
-- Cada mapa guarda os nós em JSON: [{ id, pai, titulo, tipo, nota, tarefa_id? }]. Só a função nexus (chave de serviço) mexe.
create table if not exists public.gideon_mapas (
  id bigserial primary key,
  titulo text not null,
  objetivo text not null,
  nos jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.gideon_mapas enable row level security;
comment on table public.gideon_mapas is 'Thought Map do GIDEON Core (módulo 72): mapas de pensamento com nós em JSON. Ver decisão 026.';
