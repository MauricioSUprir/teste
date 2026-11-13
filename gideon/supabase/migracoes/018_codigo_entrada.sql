-- 018 — Código de entrada (13/11/2026): entrar no GIDEON Home/Core sem o Telegram.
-- O Claude (ou, no futuro, outro canal do dono) gera um código curto; só o hash fica aqui.
-- O código vale 15 minutos, serve uma vez e trava depois de 8 tentativas erradas (somando todas as tentativas enquanto ele vale).
create table if not exists public.gideon_codigos_entrada (
  id bigserial primary key,
  hash text not null unique,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  usado_em timestamptz,
  tentativas int not null default 0
);
alter table public.gideon_codigos_entrada enable row level security; -- só a função (chave de serviço) mexe
comment on table public.gideon_codigos_entrada is 'Códigos de entrada de uso único para o GIDEON Home/Core (só o hash sha256). Ver decisão 024.';
