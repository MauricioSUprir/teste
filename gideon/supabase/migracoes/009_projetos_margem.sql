-- 009 — Projetos: marcar pela MARGEM acima de uma conversa neutra, e não pela semelhança pura.
-- Motivo (teste de 10/11/2026): toda conversa é guardada como "Dono: ... / GIDEON: ...", então tudo ficava parecido com o
-- projeto GIDEON (0,61 a 0,85), até papo de futebol. Agora: margem = semelhança com o projeto − semelhança com uma conversa
-- neutra ("oi, tudo bem?"), guardada em gideon_projetos com nome '_base' (inativa, não aparece na lista). Margem ≥ 0 marca.
-- Com vários projetos, cada item vai só para o projeto mais parecido.
-- A linha '_base' foi criada em 10/11/2026 copiando o vetor de uma conversa neutra guardada na memória ("oi, tudo bem?"):
--   insert into gideon_projetos (nome, descricao, embedding, ativo) select '_base', '...', embedding, false from gideon_memoria where id = <id da conversa neutra>;
-- e gideon_config.limite_projeto = '0'.

create or replace function public.gideon_projeto_do_vetor(consulta extensions.vector, limite double precision default 0)
returns table (nome text, similaridade double precision)
language sql stable set search_path to 'public', 'extensions'
as $$
  select nome, margem from (
    select p.nome, (1 - (p.embedding <=> consulta))
      - coalesce((select 1 - (b.embedding <=> consulta) from public.gideon_projetos b where b.nome = '_base' and b.embedding is not null), 0) as margem
    from public.gideon_projetos p
    where p.ativo and p.embedding is not null
    order by p.embedding <=> consulta
    limit 1
  ) melhor
  where margem >= limite;
$$;

create or replace function public.gideon_marcar_projeto(p_nome text, limite double precision default 0)
returns integer
language plpgsql set search_path to 'public', 'extensions'
as $$
declare n integer;
begin
  update public.gideon_memoria m set projeto = p.nome
  from public.gideon_projetos p
  left join public.gideon_projetos b on b.nome = '_base'
  where lower(p.nome) = lower(p_nome) and p.ativo and m.projeto is null and m.embedding is not null
    and (1 - (m.embedding <=> p.embedding)) - coalesce(1 - (m.embedding <=> b.embedding), 0) >= limite
    and not exists (select 1 from public.gideon_projetos q where q.ativo and q.id <> p.id and q.embedding is not null
                    and (m.embedding <=> q.embedding) < (m.embedding <=> p.embedding)); -- só se este é o projeto mais parecido
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.gideon_projeto_do_vetor(extensions.vector, double precision) from public, anon, authenticated;
revoke execute on function public.gideon_marcar_projeto(text, double precision) from public, anon, authenticated;
