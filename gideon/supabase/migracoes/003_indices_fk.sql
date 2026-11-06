-- Aplicada em 06/11/2026 (migração gideon_indices_fk)
create index if not exists gideon_acoes_aprovacao_idx     on public.gideon_acoes (aprovacao_id);
create index if not exists gideon_memoria_arquivo_idx    on public.gideon_memoria (arquivo_id);
create index if not exists gideon_tarefas_pc_aprovacao_idx on public.gideon_tarefas_pc (aprovacao_id);
