-- GIDEON — Nexus OS (fase 6, decisão 019): situação das automações para o painel.
-- Só a função "nexus" (chave de serviço) pode chamar; o navegador nunca fala direto com o banco.
create or replace function public.gideon_nexus_automacoes()
returns table (nome text, agenda text, ativo boolean, ultima_execucao timestamptz, ultimo_status text, ultima_mensagem text, execucoes_24h int, falhas_24h int)
language sql security definer set search_path = '' as $$
  select j.jobname::text, j.schedule::text, j.active, u.start_time, u.status::text, left(u.return_message, 200),
    (select count(*)::int from cron.job_run_details d where d.jobid = j.jobid and d.start_time > now() - interval '24 hours'),
    (select count(*)::int from cron.job_run_details d where d.jobid = j.jobid and d.start_time > now() - interval '24 hours' and d.status = 'failed')
  from cron.job j
  left join lateral (select d.start_time, d.status, d.return_message from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1) u on true
  order by j.jobname;
$$;
revoke all on function public.gideon_nexus_automacoes() from public, anon, authenticated;
grant execute on function public.gideon_nexus_automacoes() to service_role;
