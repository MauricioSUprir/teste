-- GIDEON — GitHub (decisão 022): ler os projetos de código do dono (só leitura) e guardar um resumo de cada um na memória.
-- Usuário do GitHub do dono (o repositório do GIDEON já é público com esse nome).
insert into public.gideon_config (chave, valor) values ('github_usuario', 'MauricioSUprir')
  on conflict (chave) do update set valor = excluded.valor;

-- 1 vez por dia (07h43 de Brasília): README + últimas mudanças de até 3 projetos que mudaram viram memória.
select cron.schedule('gideon-indexar-github', '43 10 * * *', $$
  select net.http_post(
    url := 'https://ntgsrfqmlaocxjelvnef.supabase.co/functions/v1/gideon/indexar',
    headers := jsonb_build_object('Content-Type','application/json','x-gideon-chave',(select decrypted_secret from vault.decrypted_secrets where name='gideon_cron_segredo')),
    body := '{"fontes":["github"]}'::jsonb, timeout_milliseconds := 10000);
$$);

-- Dois testes novos para a bateria de domingo
insert into public.gideon_testes (pedido, esperado, area, deve_usar, nao_deve_usar) values
  ('quais são meus projetos no GitHub?',
   'Listar os projetos de código do dono no GitHub com os nomes que vieram da ferramenta, de forma curta. Não inventar projeto.', 'github', '{github_listar}', '{}'),
  ('o que mudou por último no meu jogo de futebol no GitHub?',
   'Ler o projeto do jogo de futebol no GitHub e dizer as últimas mudanças com data, sem inventar, com o link do projeto.', 'github', '{github_ler}', '{}');
