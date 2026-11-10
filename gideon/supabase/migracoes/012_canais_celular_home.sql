-- 012 — registro de execuções aceita os canais novos: "celular" (atalho do iPhone) e "home" (arquivos mandados pelo GIDEON Home).
-- Sem isso o registro dessas conversas falhava em silêncio (a resposta saía, mas não ficava no gideon_execucoes).
alter table public.gideon_execucoes drop constraint if exists gideon_execucoes_canal_check;
alter table public.gideon_execucoes add constraint gideon_execucoes_canal_check
  check (canal = any (array['telegram', 'whatsapp', 'voz', 'painel', 'sistema', 'celular', 'home']));
