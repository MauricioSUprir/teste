-- Aplicada em 06/11/2026 (migração gideon_usuario_n8n)
-- A senha NÃO está aqui: no banco foi aplicado só o hash SCRAM, gerado fora do chat.
create role gideon_n8n with login password '<HASH SCRAM — não versionado>' connection limit 20;
grant usage on schema public to gideon_n8n;
grant usage on schema extensions to gideon_n8n;
grant select, insert, update, delete on
  public.gideon_execucoes, public.gideon_arquivos, public.gideon_memoria,
  public.gideon_tarefas, public.gideon_lembretes, public.gideon_aprovacoes,
  public.gideon_acoes, public.gideon_tarefas_pc
  to gideon_n8n;
grant usage, select on all sequences in schema public to gideon_n8n;
grant execute on function public.gideon_buscar_memoria(extensions.vector, int, text, text, timestamptz, timestamptz) to gideon_n8n;
create policy gideon_n8n_tudo on public.gideon_execucoes  for all to gideon_n8n using (true) with check (true);
create policy gideon_n8n_tudo on public.gideon_arquivos   for all to gideon_n8n using (true) with check (true);
create policy gideon_n8n_tudo on public.gideon_memoria    for all to gideon_n8n using (true) with check (true);
create policy gideon_n8n_tudo on public.gideon_tarefas    for all to gideon_n8n using (true) with check (true);
create policy gideon_n8n_tudo on public.gideon_lembretes  for all to gideon_n8n using (true) with check (true);
create policy gideon_n8n_tudo on public.gideon_aprovacoes for all to gideon_n8n using (true) with check (true);
create policy gideon_n8n_tudo on public.gideon_acoes      for all to gideon_n8n using (true) with check (true);
create policy gideon_n8n_tudo on public.gideon_tarefas_pc for all to gideon_n8n using (true) with check (true);
grant usage, create on schema n8n to gideon_n8n;
