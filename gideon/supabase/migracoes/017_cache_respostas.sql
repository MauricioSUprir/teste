-- GIDEON — cache por significado (Base 0.4, decisão 023): respostas a perguntas gerais, para não chamar o modelo de novo.
create table if not exists public.gideon_cache_respostas (
  id bigint generated always as identity primary key,
  pergunta text not null,
  embedding extensions.vector(768) not null,   -- o mesmo vetor da busca na memória
  resposta text not null,
  canal text not null,                         -- só vale no mesmo canal (o iPhone fala, o Telegram escreve)
  versao text not null,                        -- resumo do prompt + regras: mudou o prompt, o cache antigo não vale
  modelo text,
  usos int not null default 0,
  execucao_id bigint,                          -- conversa que gerou a resposta (👎 nela apaga do cache)
  ultima_execucao bigint,                      -- última conversa que usou a resposta (👎 nela também apaga)
  criado_em timestamptz not null default now(),
  ultimo_uso timestamptz,
  expira_em timestamptz not null default now() + interval '3 days'
);
alter table public.gideon_cache_respostas enable row level security; -- só a função (chave de serviço) lê e grava
create index if not exists gideon_cache_embedding_idx on public.gideon_cache_respostas using hnsw (embedding extensions.vector_cosine_ops);

create or replace function public.gideon_cache_buscar(consulta extensions.vector, p_canal text, p_versao text, limite double precision default 0.90)
returns table (id bigint, pergunta text, resposta text, usos int, similaridade double precision)
language sql stable set search_path to 'public', 'extensions' as $$
  select c.id, c.pergunta, c.resposta, c.usos, 1 - (c.embedding <=> consulta)
  from public.gideon_cache_respostas c
  where c.canal = p_canal and c.versao = p_versao and c.expira_em > now()
    and 1 - (c.embedding <=> consulta) >= limite
  order by c.embedding <=> consulta
  limit 3;
$$;
revoke execute on function public.gideon_cache_buscar(extensions.vector, text, text, double precision) from public, anon, authenticated;

insert into public.gideon_config (chave, valor) values ('cache', 'sim'), ('cache_limite', '0.90'), ('cache_dias', '3')
  on conflict (chave) do nothing;
