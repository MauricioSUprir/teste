-- Aplicadas em 06/11/2026: gideon_agendador e gideon_guardar_segredo
-- pg_cron: gideon-lembretes (* * * * *), gideon-relatorio (0 22 * * 0 = domingo 19h Brasília), gideon-limpeza (17 6 * * *)
-- Cada job chama net.http_post na Edge Function com o header x-gideon-chave lido do Vault (gideon_cron_segredo).
create or replace function public.gideon_guardar_segredo(nome text, valor text)
returns void language plpgsql security definer set search_path = ''
as $$
declare sid uuid;
begin
  select id into sid from vault.secrets where name = nome;
  if sid is null then perform vault.create_secret(valor, nome, 'GIDEON');
  else perform vault.update_secret(sid, valor); end if;
end $$;
revoke all on function public.gideon_guardar_segredo(text, text) from public, anon, authenticated;
grant execute on function public.gideon_guardar_segredo(text, text) to service_role;
