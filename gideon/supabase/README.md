# Supabase do GIDEON

- **Projeto:** `gideon` (ref `ntgsrfqmlaocxjelvnef`), região us-east-1, plano grátis.
- **Painel:** https://supabase.com/dashboard/project/ntgsrfqmlaocxjelvnef
- **Migrações aplicadas** (em ordem, na pasta `migracoes/`):

| # | Arquivo | O que cria | Aplicada em |
| --- | --- | --- | --- |
| 001 | `001_gideon_execucoes.sql` | Diário de cada pedido (`gideon_execucoes`) | 06/11/2026 |
| 002 | `002_espinha_e_memoria.sql` | Memória com vetor, arquivos, tarefas, lembretes, aprovações, ações, ponte com o PC, função de busca, esquema `n8n` | 06/11/2026 |
| 003 | `003_indices_fk.sql` | Índices das chaves estrangeiras | 06/11/2026 |
| 004 | `004_usuario_n8n.sql` | Usuário `gideon_n8n` (só tabelas do GIDEON) | 06/11/2026 |
| 005 | `005_nucleo_supabase.sql` | Memória curta, configuração, pg_cron, segredo do agendador, funções de lembretes e relatório | 06/11/2026 |

## Tabelas

| Tabela | Para quê | Usada a partir de |
| --- | --- | --- |
| `gideon_execucoes` | Um registro por pedido: canal, modelo, tokens, custo, tempo, status, nota | Base |
| `gideon_memoria` | Trechos com vetor (gemini-embedding-2, 768 dimensões) + data, origem, projeto, link | Fase 1 |
| `gideon_arquivos` | Impressão digital (hash) de cada arquivo, para não processar duas vezes | Fase 1 |
| `gideon_tarefas`, `gideon_lembretes` | Substituem as antigas `jarvis_tarefas` e `jarvis_lembretes` | Fase 1 |
| `gideon_aprovacoes` | Fila do que precisa do OK do dono | Fase 1 |
| `gideon_acoes` | Diário de ações feitas no mundo (para desfazer) | Fase 3 |
| `gideon_tarefas_pc` | Ponte n8n ↔ agente no PC | Fase 3 |
| esquema `n8n` | Tabelas internas do n8n, quando ele mudar para o Supabase | Hospedagem grátis |

**Função de busca:** `gideon_buscar_memoria(consulta, qtd, filtro_projeto, filtro_tipo, desde, ate)` devolve até 20 trechos mais parecidos (padrão 5).

**Segurança:** todas as tabelas com RLS ligado e sem políticas, ou seja, só o dono do banco (n8n, pelo usuário do banco) acessa. A chave pública (anon) não lê nada. O aviso "RLS Enabled No Policy" do Supabase é esperado.

## Usuário do n8n (migração 004, 06/11/2026)

- Usuário `gideon_n8n`: acessa só as tabelas `gideon_*`, a função de busca e o esquema `n8n` (RLS com política só para ele).
- Conexão: *Session pooler* `aws-0-us-east-1.pooler.supabase.com`, porta 5432, usuário `gideon_n8n.ntgsrfqmlaocxjelvnef`, banco `postgres`, SSL obrigatório.
- A senha foi gerada pelo Claude e **nunca foi exibida**: o banco guarda só o hash SCRAM, e a senha está na credencial "GIDEON Supabase" do n8n. Para trocar: gerar outra senha, `alter role gideon_n8n password '...'` e atualizar a credencial.
