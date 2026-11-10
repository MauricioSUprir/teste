-- 008 — Fase Memória (9.3): projetos automáticos e linha do tempo.
-- Cada projeto tem nome, descrição e o vetor de significado da descrição. O que entra na memória e se parece com um
-- projeto é marcado sozinho (gideon_projeto_do_vetor); ao criar um projeto, a memória antiga também é marcada
-- (gideon_marcar_projeto). "O que fiz no projeto X?" usa gideon_linha_do_tempo.

create table if not exists public.gideon_projetos (
  id bigserial primary key,
  nome text not null,
  descricao text,
  embedding extensions.vector(768),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create unique index if not exists gideon_projetos_nome_idx on public.gideon_projetos (lower(nome));
alter table public.gideon_projetos enable row level security; -- só a função gideon (chave de serviço) usa
create index if not exists gideon_memoria_projeto_idx on public.gideon_memoria (lower(projeto), data_ref);

-- Projeto mais parecido com um vetor (só se passar do limite)
create or replace function public.gideon_projeto_do_vetor(consulta extensions.vector, limite double precision default 0.62)
returns table (nome text, similaridade double precision)
language sql stable set search_path to 'public', 'extensions'
as $$
  select p.nome, 1 - (p.embedding <=> consulta)
  from public.gideon_projetos p
  where p.ativo and p.embedding is not null and 1 - (p.embedding <=> consulta) >= limite
  order by p.embedding <=> consulta
  limit 1;
$$;

-- Marca com o projeto os itens antigos da memória (sem projeto) que se parecem com ele
create or replace function public.gideon_marcar_projeto(p_nome text, limite double precision default 0.62)
returns integer
language plpgsql set search_path to 'public', 'extensions'
as $$
declare n integer;
begin
  update public.gideon_memoria m set projeto = p.nome
  from public.gideon_projetos p
  where lower(p.nome) = lower(p_nome) and m.projeto is null and m.embedding is not null
    and 1 - (m.embedding <=> p.embedding) >= limite;
  get diagnostics n = row_count;
  return n;
end $$;

-- Projetos com quantos itens têm e quando começaram/tiveram atividade (pela data dos itens)
create or replace function public.gideon_listar_projetos()
returns table (nome text, descricao text, itens bigint, primeira_atividade timestamptz, ultima_atividade timestamptz, criado_em timestamptz)
language sql stable set search_path to 'public'
as $$
  select p.nome, p.descricao, count(m.id), min(m.data_ref), max(m.data_ref), p.criado_em
  from public.gideon_projetos p
  left join public.gideon_memoria m on lower(m.projeto) = lower(p.nome)
  where p.ativo
  group by p.id
  order by max(m.data_ref) desc nulls last;
$$;

-- Linha do tempo de um projeto (um item por registro; partes de textos longos aparecem uma vez só)
create or replace function public.gideon_linha_do_tempo(p_nome text, desde timestamptz default null, ate timestamptz default null, qtd integer default 40)
returns table (id bigint, data_ref timestamptz, tipo text, origem text, resumo text, link text)
language sql stable set search_path to 'public'
as $$
  select m.id, m.data_ref, m.tipo, m.origem, coalesce(m.resumo, left(m.conteudo, 200)), m.link
  from public.gideon_memoria m
  where lower(m.projeto) = lower(p_nome)
    and coalesce((m.metadados->>'parte')::int, 1) = 1
    and (desde is null or m.data_ref >= desde)
    and (ate is null or m.data_ref <= ate)
  order by m.data_ref
  limit least(greatest(qtd, 1), 100);
$$;

-- só a chave de serviço (função gideon) pode chamar
revoke execute on function public.gideon_projeto_do_vetor(extensions.vector, double precision) from public, anon, authenticated;
revoke execute on function public.gideon_marcar_projeto(text, double precision) from public, anon, authenticated;
revoke execute on function public.gideon_listar_projetos() from public, anon, authenticated;
revoke execute on function public.gideon_linha_do_tempo(text, timestamptz, timestamptz, integer) from public, anon, authenticated;
