-- Aplicada em 06/11/2026 (migração gideon_nucleo_supabase) — decisão 011
-- (o ID do dono no Telegram foi gravado direto no banco; aqui fica o marcador)
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create table if not exists public.gideon_mensagens (
  id bigint generated always as identity primary key, sessao text not null,
  papel text not null check (papel in ('user','model')), texto text not null, canal text,
  criado_em timestamptz not null default now());
create index if not exists gideon_mensagens_sessao_idx on public.gideon_mensagens (sessao, criado_em desc);
create table if not exists public.gideon_config (chave text primary key, valor text not null, atualizado_em timestamptz not null default now());
insert into public.gideon_config (chave, valor) values ('dono_telegram_id','DONO_TELEGRAM_ID'), ('modelo_conversa','gemini-3.5-flash-lite'),
  ('modelo_embedding','gemini-embedding-2'), ('limite_similaridade','0.6') on conflict (chave) do nothing;
alter table public.gideon_mensagens enable row level security;
alter table public.gideon_config enable row level security;
grant select, insert, update, delete on public.gideon_mensagens, public.gideon_config to gideon_n8n;
create policy gideon_n8n_tudo on public.gideon_mensagens for all to gideon_n8n using (true) with check (true);
create policy gideon_n8n_tudo on public.gideon_config for all to gideon_n8n using (true) with check (true);
-- Segredo do agendador: gerado no banco, guardado no Vault, nunca exibido
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'gideon_cron_segredo', 'Autentica o pg_cron nas Edge Functions do GIDEON')
where not exists (select 1 from vault.secrets where name = 'gideon_cron_segredo');
create or replace function public.gideon_segredo(nome text) returns text language sql stable security definer set search_path = ''
as $$ select decrypted_secret from vault.decrypted_secrets where name = nome $$;
revoke all on function public.gideon_segredo(text) from public, anon, authenticated;
grant execute on function public.gideon_segredo(text) to service_role;
-- gideon_pegar_lembretes_vencidos(), gideon_agendar_proximo(bigint), gideon_relatorio_semanal(): ver o banco
-- (mesmo texto aplicado; só o service_role executa)
