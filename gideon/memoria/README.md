# Fase 1 — Universal Memory

Tudo que entra no GIDEON vai para um banco vetorial com data, origem e projeto.
**Pronto quando:** "onde está aquele projeto que comecei em agosto?" volta o arquivo certo, com link e histórico.

> **Bloqueada** até o dono responder as decisões em aberto (`docs/decisoes/` e abaixo).

## Decisões em aberto
- [ ] Computador: Windows ou Mac, RAM, placa de vídeo? (define Fases 3 e 6)
- [ ] Banco da memória: Supabase (recomendado) ou Qdrant?
- [ ] Orçamento mensal de API (Claude, Gemini, ElevenLabs, SerpApi)
- [ ] Lista do que o GIDEON pode fazer sem perguntar

## Checklist da Fase 1 (tarefas pequenas)

**A. Base de medição (regras de qualidade) — antes de tudo**
- [ ] A1. Criar a tabela `jarvis_execucoes` (`jarvis_execucoes.sql`) após definir o banco
- [ ] A2. Workflow "GIDEON - Sistema - Registrar execução" (sub-workflow chamado no fim de cada pedido)
- [ ] A3. Workflow "GIDEON - Sistema - Alerta de erro" (Error Trigger → Telegram)
- [ ] A4. Workflow "GIDEON - Sistema - Relatório semanal" (domingo)
- [ ] A5. Botões "Útil / Não útil" nas respostas importantes

**B. Banco**
- [ ] B1. Criar projeto no Supabase e ativar pgvector
- [ ] B2. Tabela de memória: id, conteúdo, embedding, data, origem, projeto, link, hash do arquivo
- [ ] B3. Função de busca por similaridade (máx. 5 trechos) com filtro por data/projeto
- [ ] B4. Tabelas `jarvis_memoria`, `jarvis_tarefas`, `jarvis_lembretes` mantidas como estão

**C. Indexação**
- [ ] C1. Workflow "GIDEON - Memória - Indexar arquivo" (texto/arquivo → hash → embedding → grava; não reprocessa hash já visto)
- [ ] C2. Indexar a pasta do Drive
- [ ] C3. Indexar arquivos que já passaram pelo GIDEON
- [ ] C4. Guardar conversas, anotações e tarefas novas automaticamente

**D. Busca**
- [ ] D1. Sub-workflow "GIDEON - Memória - Buscar" (meta: menos de 3 s)
- [ ] D2. Ligar a ferramenta "Buscar na memória" no GIDEON

**E. Teste e aprovação**
- [ ] E1. Testar "onde está o projeto que comecei em agosto?"
- [ ] E2. Mínimo de 10 pedidos reais em `testes/tarefas-reais.md`, com sucesso acima de 90%
- [ ] E3. Checklist de revisão de fase (`docs/regras-qualidade.md`, seção 5) e uso do dono por 3 dias

**F. Renomear para GIDEON (decisão 006) — só com backup e OK do dono**
- [ ] F1. Renomear os workflows atuais no n8n ("Jarvis - Fase 1", "Jarvis - Despertador WhatsApp")
- [ ] F2. Ajustar o nome do bot no Telegram e o prompt de sistema de cada agente
- [ ] F3. Decidir se as tabelas `jarvis_*` e o repositório `jarvis-waha` serão renomeados (exige migrar dados e atualizar o WAHA no Render)
- [ ] F4. Repositório privado: nome `gideon`
