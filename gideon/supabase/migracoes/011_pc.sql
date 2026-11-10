-- 011 — GIDEON PC (fase 1): fila de ordens para o programa no computador do dono.
-- O programa no PC só faz pedidos para fora (busca ordens pela função gideon com a chave do PC); nada fica aberto na internet.
-- O GIDEON grava a ordem, o PC pega, executa dentro da pasta liberada e devolve o resultado.

create table if not exists public.gideon_pc_ordens (
  id bigserial primary key,
  acao text not null,                          -- pc_listar, pc_organizar, pc_apagar...
  args jsonb not null default '{}'::jsonb,
  status text not null default 'pendente' check (status in ('pendente', 'executando', 'feita', 'erro', 'expirada')),
  resultado jsonb,
  canal text,                                  -- de onde veio o pedido (telegram, voz, sistema)
  criado_em timestamptz not null default now(),
  pego_em timestamptz,
  feito_em timestamptz
);
create index if not exists gideon_pc_ordens_pendentes_idx on public.gideon_pc_ordens (status, criado_em) where status = 'pendente';
alter table public.gideon_pc_ordens enable row level security; -- só a função gideon (chave de serviço) usa

-- Último sinal de vida de cada computador (o programa avisa a cada busca)
create table if not exists public.gideon_dispositivos (
  nome text primary key,                       -- 'pc'
  visto_em timestamptz not null default now(),
  info jsonb not null default '{}'::jsonb      -- versão do programa, sistema, pasta liberada
);
alter table public.gideon_dispositivos enable row level security;
