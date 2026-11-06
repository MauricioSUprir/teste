-- Aplicada em 06/11/2026 (migração gideon_espinha_e_memoria)
-- GIDEON: espinha dorsal compartilhada por todos os projetos (docs/plano-completo.md) + memória (Fase 1)
create extension if not exists vector with schema extensions;

create table public.gideon_arquivos (
  id            bigint generated always as identity primary key,
  hash          text not null unique,
  nome          text,
  origem        text not null,
  link          text,
  mime          text,
  tamanho_bytes bigint,
  projeto       text,
  status        text not null default 'novo' check (status in ('novo','processado','erro','ignorado')),
  erro          text,
  criado_em     timestamptz not null default now(),
  processado_em timestamptz
);

create table public.gideon_memoria (
  id          bigint generated always as identity primary key,
  conteudo    text not null,
  resumo      text,
  embedding   extensions.vector(768),
  tipo        text not null check (tipo in ('conversa','arquivo','nota','tarefa','pesquisa','email','evento','acao')),
  origem      text not null,
  projeto     text,
  link        text,
  arquivo_id  bigint references public.gideon_arquivos(id) on delete cascade,
  data_ref    timestamptz,
  metadados   jsonb not null default '{}'::jsonb,
  hash_trecho text unique,
  criado_em   timestamptz not null default now()
);
create index gideon_memoria_embedding_idx on public.gideon_memoria using hnsw (embedding extensions.vector_cosine_ops);
create index gideon_memoria_projeto_idx   on public.gideon_memoria (projeto);
create index gideon_memoria_data_idx      on public.gideon_memoria (data_ref desc);
create index gideon_memoria_tipo_idx      on public.gideon_memoria (tipo);

create or replace function public.gideon_buscar_memoria(
  consulta       extensions.vector(768),
  qtd            int default 5,
  filtro_projeto text default null,
  filtro_tipo    text default null,
  desde          timestamptz default null,
  ate            timestamptz default null
)
returns table (id bigint, conteudo text, resumo text, tipo text, origem text, projeto text, link text, data_ref timestamptz, metadados jsonb, similaridade float)
language sql stable
set search_path = public, extensions
as $$
  select m.id, m.conteudo, m.resumo, m.tipo, m.origem, m.projeto, m.link, m.data_ref, m.metadados,
         1 - (m.embedding <=> consulta) as similaridade
  from public.gideon_memoria m
  where m.embedding is not null
    and (filtro_projeto is null or m.projeto ilike filtro_projeto)
    and (filtro_tipo is null or m.tipo = filtro_tipo)
    and (desde is null or m.data_ref >= desde)
    and (ate is null or m.data_ref <= ate)
  order by m.embedding <=> consulta
  limit least(greatest(qtd, 1), 20);
$$;

create table public.gideon_tarefas (
  id           bigint generated always as identity primary key,
  titulo       text not null,
  descricao    text,
  status       text not null default 'aberta' check (status in ('aberta','feita','cancelada')),
  prazo        timestamptz,
  projeto      text,
  origem       text,
  criado_em    timestamptz not null default now(),
  concluida_em timestamptz
);
create table public.gideon_lembretes (
  id          bigint generated always as identity primary key,
  texto       text not null,
  quando      timestamptz not null,
  recorrencia text,
  canal       text not null default 'telegram',
  enviado_em  timestamptz,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);
create index gideon_lembretes_pendentes_idx on public.gideon_lembretes (quando) where ativo and enviado_em is null;

create table public.gideon_aprovacoes (
  id          bigint generated always as identity primary key,
  acao        text not null,
  descricao   text not null,
  detalhes    jsonb not null default '{}'::jsonb,
  pedido_por  text,
  status      text not null default 'pendente' check (status in ('pendente','aprovada','negada','expirada')),
  expira_em   timestamptz default now() + interval '24 hours',
  criado_em   timestamptz not null default now(),
  decidido_em timestamptz,
  decidido_via text
);
create index gideon_aprovacoes_pendentes_idx on public.gideon_aprovacoes (criado_em) where status = 'pendente';

create table public.gideon_acoes (
  id           bigint generated always as identity primary key,
  data_hora    timestamptz not null default now(),
  quem         text not null,
  acao         text not null,
  alvo         text,
  detalhes     jsonb not null default '{}'::jsonb,
  reversivel   boolean not null default false,
  como_desfazer jsonb,
  aprovacao_id bigint references public.gideon_aprovacoes(id),
  status       text not null default 'feita' check (status in ('feita','erro','desfeita'))
);
create index gideon_acoes_data_idx on public.gideon_acoes (data_hora desc);

create table public.gideon_tarefas_pc (
  id           bigint generated always as identity primary key,
  criado_em    timestamptz not null default now(),
  tipo         text not null,
  comando      jsonb not null,
  status       text not null default 'pendente' check (status in ('pendente','aguardando_aprovacao','executando','feita','erro','cancelada')),
  aprovacao_id bigint references public.gideon_aprovacoes(id),
  resultado    jsonb,
  iniciado_em  timestamptz,
  concluido_em timestamptz
);
create index gideon_tarefas_pc_pendentes_idx on public.gideon_tarefas_pc (criado_em) where status in ('pendente','executando');

alter table public.gideon_arquivos   enable row level security;
alter table public.gideon_memoria    enable row level security;
alter table public.gideon_tarefas    enable row level security;
alter table public.gideon_lembretes  enable row level security;
alter table public.gideon_aprovacoes enable row level security;
alter table public.gideon_acoes      enable row level security;
alter table public.gideon_tarefas_pc enable row level security;
revoke execute on function public.gideon_buscar_memoria(extensions.vector, int, text, text, timestamptz, timestamptz) from public, anon, authenticated;

create schema if not exists n8n;
revoke all on schema n8n from public, anon, authenticated;
