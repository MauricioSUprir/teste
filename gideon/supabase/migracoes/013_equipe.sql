-- 013 — AI Company (fase 3): a equipe de agentes da GIDEON.
-- O diretor recebe o objetivo, monta um plano (tarefas para pesquisador, programador, analista e testador) e pede o OK do dono.
-- Aprovado, as tarefas rodam uma de cada vez (respeitando a ordem), o revisor confere tudo e o diretor entrega o resultado.
-- Cada passo roda numa chamada separada da função (limite de tempo do plano grátis); o agendador só chama quando há missão andando.

create table if not exists public.gideon_equipe_missoes (
  id bigserial primary key,
  objetivo text not null,
  titulo text,
  plano jsonb not null default '{}'::jsonb,       -- o que o diretor planejou (resumo, entregável)
  status text not null default 'aguardando_ok' check (status in ('aguardando_ok', 'executando', 'revisando', 'pronta', 'erro', 'cancelada')),
  canal text,                                     -- de onde veio o pedido; 'sistema' = teste (não avisa no Telegram)
  rodadas int not null default 0,                 -- quantas vezes o revisor mandou refazer (no máximo 1)
  revisao jsonb,                                  -- parecer do revisor
  resultado text,                                 -- entrega final do diretor
  progresso_msg bigint,                           -- mensagem do Telegram que mostra o andamento (é editada a cada passo)
  tokens_entrada int not null default 0,
  tokens_saida int not null default 0,
  erro text,
  criado_em timestamptz not null default now(),
  aprovado_em timestamptz,
  atualizado_em timestamptz not null default now(),
  concluido_em timestamptz
);
create index if not exists gideon_equipe_missoes_status_idx on public.gideon_equipe_missoes (status);
alter table public.gideon_equipe_missoes enable row level security; -- só a função gideon (chave de serviço) usa

create table if not exists public.gideon_equipe_tarefas (
  id bigserial primary key,
  missao_id bigint not null references public.gideon_equipe_missoes (id) on delete cascade,
  ordem int not null,
  agente text not null check (agente in ('pesquisador', 'programador', 'analista', 'testador')),
  titulo text not null,
  instrucao text not null,
  depende_de int[] not null default '{}',         -- ordens das tarefas que precisam terminar antes
  status text not null default 'pendente' check (status in ('pendente', 'executando', 'feita', 'erro')),
  resultado text,
  fontes jsonb,
  tentativas int not null default 0,
  modelo text,
  tokens_entrada int not null default 0,
  tokens_saida int not null default 0,
  inicio timestamptz,
  fim timestamptz,
  unique (missao_id, ordem)
);
create index if not exists gideon_equipe_tarefas_missao_idx on public.gideon_equipe_tarefas (missao_id, status);
alter table public.gideon_equipe_tarefas enable row level security;

-- Entrega a próxima tarefa pronta para rodar (no máximo uma por missão de cada vez) e destrava o que ficou preso.
create or replace function public.gideon_equipe_pegar_tarefa()
returns setof public.gideon_equipe_tarefas
language plpgsql security definer set search_path = public as $$
declare t public.gideon_equipe_tarefas;
begin
  perform pg_advisory_xact_lock(4242013);         -- duas chamadas ao mesmo tempo não pegam tarefas da mesma missão
  -- tarefa presa (a chamada caiu no meio): volta para a fila; na 3ª vez vira erro
  update public.gideon_equipe_tarefas set status = case when tentativas >= 2 then 'erro' else 'pendente' end,
    tentativas = tentativas + 1, resultado = case when tentativas >= 2 then '(a tarefa travou 3 vezes e foi abandonada)' else resultado end,
    fim = case when tentativas >= 2 then now() else fim end
  where status = 'executando' and inicio < now() - interval '4 minutes';
  -- revisão presa: volta para executando (a revisão roda de novo)
  update public.gideon_equipe_missoes set status = 'executando', atualizado_em = now()
  where status = 'revisando' and atualizado_em < now() - interval '5 minutes';
  select x.* into t from public.gideon_equipe_tarefas x join public.gideon_equipe_missoes m on m.id = x.missao_id
  where m.status = 'executando' and x.status = 'pendente'
    and not exists (select 1 from public.gideon_equipe_tarefas y where y.missao_id = x.missao_id and y.status = 'executando')
    and not exists (select 1 from public.gideon_equipe_tarefas d where d.missao_id = x.missao_id and d.ordem = any (x.depende_de) and d.status in ('pendente', 'executando'))
  order by m.id, x.ordem limit 1;
  if not found then return; end if;
  update public.gideon_equipe_tarefas set status = 'executando', inicio = now() where id = t.id returning * into t;
  update public.gideon_equipe_missoes set atualizado_em = now() where id = t.missao_id;
  return next t;
end $$;
revoke all on function public.gideon_equipe_pegar_tarefa() from public, anon, authenticated;

-- Agendador: a cada minuto, só se houver missão andando (sem missão, nenhuma chamada é feita)
select cron.schedule('gideon-equipe', '* * * * *', $$
  select net.http_post(
    url := 'https://ntgsrfqmlaocxjelvnef.supabase.co/functions/v1/gideon/equipe-passo',
    headers := jsonb_build_object('Content-Type','application/json','x-gideon-chave',(select decrypted_secret from vault.decrypted_secrets where name='gideon_cron_segredo')),
    body := '{}'::jsonb, timeout_milliseconds := 10000)
  where exists (select 1 from public.gideon_equipe_missoes where status in ('executando', 'revisando'));
$$);
