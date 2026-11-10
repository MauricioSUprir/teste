-- 010 — Deep Research (4): pesquisas na internet.
-- Guarda cada pesquisa (rápida ou profunda) com resposta e fontes. Serve de cache de 24 h (a mesma pergunta não gasta de novo)
-- e de trava (a mesma pesquisa profunda não roda duas vezes ao mesmo tempo).
create table if not exists public.gideon_pesquisas (
  id bigserial primary key,
  chave text not null,                       -- sha256 do tipo + pergunta normalizada
  tipo text not null default 'rapida' check (tipo in ('rapida', 'profunda')),
  pergunta text not null,
  resposta text,
  fontes jsonb not null default '[]'::jsonb,  -- [{ titulo, link }]
  status text not null default 'pronta' check (status in ('andamento', 'pronta', 'erro')),
  modelo text,
  tempo_ms integer,
  criado_em timestamptz not null default now()
);
create index if not exists gideon_pesquisas_chave_idx on public.gideon_pesquisas (chave, criado_em desc);
alter table public.gideon_pesquisas enable row level security; -- só a função gideon (chave de serviço) usa
