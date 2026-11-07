-- 007 — Fase Memória: o GIDEON lê sozinho o Gmail, a Agenda e o Google Drive (rota /indexar da função gideon).
-- 1) Índice para achar rápido o que já foi guardado (metadados.origem_id).
-- 2) Relatório semanal: as rodadas automáticas (indexador) e os diagnósticos do Home não contam como "pedidos".
-- 3) Agendamentos no pg_cron (minutos quebrados para não bater com outros serviços).

create index if not exists gideon_memoria_origem_idx on public.gideon_memoria ((metadados->>'origem_id'));

create or replace function public.gideon_relatorio_semanal()
 returns json
 language sql
 stable
 set search_path to 'public'
as $function$
  select json_build_object(
    'total', count(*),
    'sucesso', count(*) filter (where status = 'sucesso'),
    'erros', count(*) filter (where status = 'erro'),
    'tempo_medio_ms', coalesce(round(avg(tempo_ms)), 0),
    'tokens_entrada', coalesce(sum(tokens_entrada), 0),
    'tokens_saida', coalesce(sum(tokens_saida), 0),
    'nao_util', count(*) filter (where nota_usuario = 'nao_util'),
    'top_erros', (select coalesce(json_agg(e), '[]'::json) from (
        select left(erro_mensagem, 120) as erro, count(*) as n from public.gideon_execucoes
        where data_hora > now() - interval '7 days' and status = 'erro' group by 1 order by 2 desc limit 3) e),
    'memorias_novas', (select count(*) from public.gideon_memoria where criado_em > now() - interval '7 days'),
    'tarefas_abertas', (select count(*) from public.gideon_tarefas where status = 'aberta'),
    'lembretes_enviados', (select count(*) from public.gideon_lembretes where enviado_em > now() - interval '7 days'))
  from public.gideon_execucoes
  where data_hora > now() - interval '7 days'
    and coalesce(ferramenta, '') not in ('indexador', 'diagnostico');
$function$;

select cron.schedule('gideon-indexar-gmail', '7 */2 * * *', $$
  select net.http_post(
    url := 'https://ntgsrfqmlaocxjelvnef.supabase.co/functions/v1/gideon/indexar',
    headers := jsonb_build_object('Content-Type','application/json','x-gideon-chave',(select decrypted_secret from vault.decrypted_secrets where name='gideon_cron_segredo')),
    body := '{"fontes":["gmail"]}'::jsonb, timeout_milliseconds := 30000);
$$);

select cron.schedule('gideon-indexar-drive', '37 */2 * * *', $$
  select net.http_post(
    url := 'https://ntgsrfqmlaocxjelvnef.supabase.co/functions/v1/gideon/indexar',
    headers := jsonb_build_object('Content-Type','application/json','x-gideon-chave',(select decrypted_secret from vault.decrypted_secrets where name='gideon_cron_segredo')),
    body := '{"fontes":["drive"]}'::jsonb, timeout_milliseconds := 30000);
$$);

select cron.schedule('gideon-indexar-agenda', '22 */6 * * *', $$
  select net.http_post(
    url := 'https://ntgsrfqmlaocxjelvnef.supabase.co/functions/v1/gideon/indexar',
    headers := jsonb_build_object('Content-Type','application/json','x-gideon-chave',(select decrypted_secret from vault.decrypted_secrets where name='gideon_cron_segredo')),
    body := '{"fontes":["agenda"]}'::jsonb, timeout_milliseconds := 30000);
$$);
