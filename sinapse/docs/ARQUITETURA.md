# Sinapse — Estrutura do Projeto

> Agente de IA pessoal em formato de site. Um dono, várias APIs de IA,
> banco de dados próprio e um sistema de conexões feito para crescer até
> milhares de serviços.
>
> Status deste documento: **PLANEJADO** (nada abaixo está implementado ainda,
> exceto o esqueleto de pastas e dependências em `sinapse/`).

---

## 1. Premissas

| Premissa | Consequência na arquitetura |
|---|---|
| Uso pessoal (um dono) | Sem cadastro público. O primeiro acesso cria a conta do dono e o cadastro fecha. O modelo de dados mantém `user_id` em tudo (custa pouco e permite convidar alguém no futuro). |
| Exposto na internet e guardando chaves de muitas contas | A segurança precisa ser **mais** rígida, não menos: senha forte + 2FA (TOTP), sessões revogáveis, cofre de segredos cifrado, aprovação humana para ações com efeito externo. |
| Várias APIs de IA | Camada de *providers* desacoplada; troca de modelo por conversa/agente; fallback entre modelos. |
| "Milhares de conexões" | Não dá para escrever milhares de integrações à mão. O núcleo é um **protocolo genérico** (MCP + OpenAPI + HTTP), mais alguns conectores nativos profundos. O agente **busca** ferramentas em vez de receber todas. |
| Agente, não só chat | Orquestrador com loop de ferramentas, limites, cancelamento e aprovações. |

---

## 2. Stack escolhida

| Camada | Escolha | Por quê | Alternativa |
|---|---|---|---|
| Linguagem | TypeScript (front + back) | Tipos compartilhados, um só ecossistema | — |
| Backend | Node 22 + **Fastify** | Rápido, streaming nativo, plugins maduros (cookies, multipart, rate limit, helmet) | Hono, NestJS |
| Frontend | **React + Vite** (SPA) + React Router + TanStack Query | Carrega rápido, code splitting simples, estado de servidor bem resolvido | Next.js (desnecessário: não há SEO num app privado) |
| Banco | **PostgreSQL 16 + pgvector** | Relacional + busca vetorial (RAG, memória, busca de ferramentas) num só lugar | SQLite (sem vetores robustos) |
| Fila/jobs | **pg-boss** (fila sobre o próprio Postgres) | Processar arquivos, resumos, sincronizações, tarefas agendadas — sem precisar de Redis | BullMQ + Redis |
| Arquivos | Disco local (dev) / **S3 compatível** (prod: R2, S3, MinIO) | Interface única `StorageAdapter` | — |
| Streaming | **SSE** com log de eventos por execução | Reconexão com `Last-Event-ID`; a execução continua no servidor se a aba cair | WebSocket |
| Validação | **Zod** (entrada de API, argumentos de ferramentas, env) | Um schema serve para validar e para gerar o JSON Schema das ferramentas | — |
| Logs | Pino (JSON estruturado, com *redaction* de segredos) | — | — |
| Métricas | Prometheus (`/metrics` protegido) + OpenTelemetry (opcional) | — | — |
| Testes | Vitest (unit/integração com Postgres real) + Playwright (E2E, desktop e mobile) | — | — |
| Deploy | Docker Compose (app + Postgres) num VPS, ou Render | Simples para uso pessoal | Fly.io, Railway |

---

## 3. Visão geral

```
Navegador (React SPA)
   │  HTTPS · cookie HttpOnly · SSE
   ▼
API (Fastify) ── auth · CSRF · rate limit · validação
   │
   ├── Conversas / Mensagens / Agentes / Arquivos / Memória / Configurações
   │
   ▼
Run Manager ── cria a execução, guarda eventos, permite cancelar/reconectar
   │
   ▼
Orquestrador do agente
   ├── Gerenciador de contexto (histórico recente + resumo + memórias + trechos de arquivos)
   ├── Provider de IA (Anthropic · OpenAI · Gemini · OpenRouter · Ollama)
   ├── Tool Router ── valida argumentos · checa permissão · pede aprovação · timeout
   │      ├── Ferramentas internas (arquivos, memória, web, calculadora…)
   │      ├── Conectores nativos (Google, GitHub, Notion…)
   │      ├── Servidores MCP (qualquer serviço que fale MCP)
   │      ├── APIs via OpenAPI/HTTP
   │      └── Bancos de dados externos
   └── Loop: modelo → ferramenta → resultado → modelo … → resposta final
   │
   ▼
PostgreSQL + pgvector · Storage de arquivos · Fila (pg-boss)
```

Cada seta acima é um módulo separado no código (seção 5).

---

## 4. Decisões centrais

### 4.1 Camada de IA (providers)

Interface única, implementada por adaptador:

```ts
interface AIProvider {
  id: string;                         // 'anthropic' | 'openai' | 'gemini' | 'openrouter' | 'ollama'
  listModels(): Promise<ModelInfo[]>; // contexto máximo, visão, ferramentas, preço
  stream(req: ChatRequest, signal: AbortSignal): AsyncIterable<ProviderEvent>;
  countTokens?(req: ChatRequest): Promise<number>;
}
```

- `ProviderEvent` normalizado: `text_delta`, `tool_call`, `usage`, `stop` (com motivo: fim, limite, ferramenta, recusa).
- Padrão: **Anthropic `claude-opus-5-5`**, com streaming, ferramentas e fallback server-side de recusas habilitado. OpenRouter dá acesso a centenas de modelos com uma chave só; Ollama permite modelos locais.
- **Chaves de API**: cadastradas pela tela *Configurações → IA* e guardadas **cifradas** (AES-256-GCM) no banco, ou via variáveis de ambiente. Nunca vão ao navegador — a interface só vê "configurada / últimos 4 caracteres".
- Retry com backoff só antes do primeiro token; depois disso, erro recuperável na interface ("Tentar de novo").
- Fallback entre modelos configurável (ex.: Opus → Sonnet → GPT).
- Registro de uso por chamada: tokens de entrada/saída, custo estimado, latência e tempo até o primeiro token.

### 4.2 Agente (orquestrador)

```
objetivo do usuário
 → monta contexto
 → modelo decide: responder ou chamar ferramenta(s)
 → Tool Router: valida (Zod) → checa política → [aprovação humana?] → executa com timeout
 → resultado volta ao modelo como DADO (nunca como instrução)
 → repete até resposta final ou limite
```

Proteções: máximo de etapas (padrão 12), timeout total, cancelamento a qualquer momento,
detecção de repetição (mesma ferramenta + mesmos argumentos), erro de ferramenta vira
resultado de erro para o modelo (não derruba a execução).

**Painel do agente** mostra eventos objetivos ("Consultando calendário…", "Executando
`github.create_issue`…"), nunca o raciocínio interno do modelo.

### 4.3 Ferramentas — Tool Registry

Toda ferramenta, seja interna, nativa, MCP ou OpenAPI, vira o mesmo objeto:

```ts
interface ToolDefinition {
  id: string;              // 'github.create_issue', 'mcp:notion.search', 'files.search'
  name: string; description: string; category: string;
  source: 'builtin' | 'native' | 'mcp' | 'openapi' | 'database';
  connectionId?: string;   // de qual conexão ela depende
  input: ZodSchema;        // validação + JSON Schema para o modelo
  risk: 'read' | 'write' | 'external_send' | 'destructive';
  timeoutMs: number;
  execute(args, ctx): Promise<ToolResult>;  // resultado estruturado
}
```

**Política de risco (padrão, ajustável por agente):**

| Risco | Exemplo | Padrão |
|---|---|---|
| `read` | buscar e-mails, listar eventos | executa direto |
| `write` | criar rascunho, criar evento | pede aprovação |
| `external_send` | enviar e-mail, postar mensagem | sempre pede aprovação |
| `destructive` | apagar arquivo, DROP | sempre pede aprovação + confirmação explícita |

A aprovação mostra **AÇÃO · DESTINO · DADOS · IMPACTO** com botões *Aprovar* / *Cancelar*.

**Escala ("milhares de ferramentas")** — mandar milhares de ferramentas ao modelo é caro e
piora a escolha. Solução:

1. Cada ferramenta é indexada (nome + descrição → embedding no pgvector).
2. O agente recebe um conjunto pequeno fixo (memória, arquivos, `buscar_ferramentas`) e
   as ferramentas que o próprio agente personalizado fixou.
3. Para o resto, o modelo chama `buscar_ferramentas("enviar mensagem no slack")` e as
   ferramentas encontradas são carregadas sob demanda (na Anthropic, via *tool search* com
   `defer_loading`; nos demais providers, pelo mesmo mecanismo feito no nosso orquestrador).

### 4.4 Conexões — como chegar a milhares

Quatro tipos de conector, todos produzindo ferramentas no mesmo registry:

| Tipo | Cobre | Autenticação | Observação |
|---|---|---|---|
| **MCP (Model Context Protocol)** | Qualquer serviço com servidor MCP (já são milhares: Notion, Slack, Linear, Stripe, bancos, etc.) | OAuth 2.1 do próprio MCP, token ou nenhuma | **Principal via de escala.** Cola-se a URL do servidor; as ferramentas são descobertas automaticamente. |
| **Nativos** | Google (Gmail, Drive, Calendar), GitHub, Notion… | OAuth 2.0 + PKCE | Poucos, mas profundos e bem testados. Exigem criar um app OAuth em cada serviço (credenciais suas). |
| **OpenAPI / HTTP** | Qualquer API REST com especificação ou documentação | API key, Bearer, Basic, OAuth | Importa a spec → cada operação vira ferramenta; métodos que alteram dados exigem aprovação. |
| **Banco de dados** | Postgres, MySQL, SQLite remotos | String de conexão (cifrada) | Somente leitura por padrão; escrita com aprovação. |

Opcional para a cauda longa: agregadores (Composio, Pipedream Connect, n8n por webhook) — cada
um entra como mais um conector, sem mudar o núcleo.

**Estados de cada conexão:** `DESCONECTADO → CONECTANDO → CONECTADO | ERRO | EXPIRADO`.
**Fluxo OAuth:** autorização (com `state` assinado + PKCE) → callback → tokens cifrados no banco →
refresh automático antes de expirar → revogação no provedor ao desconectar.
Integrações sem credenciais configuradas aparecem como "requer configuração", nunca como falsas.

Página **Conexões**: catálogo pesquisável (nativos + MCP conhecidos + "adicionar por URL/OpenAPI"),
lista das conectadas com estado, escopos concedidos, ferramentas expostas, última utilização,
botões *Testar*, *Reconectar*, *Desconectar*.

### 4.5 Memória e contexto

- **Histórico** = todas as mensagens (tabela `messages`), nunca enviado inteiro ao modelo.
- **Memória** = fatos persistentes ("prefiro respostas curtas", "meu fuso é America/Sao_Paulo"),
  tabela `memories`, com origem (manual / sugerida pelo agente), editável e apagável na tela
  *Memória*. Memória automática é opcional e sempre visível.
- **Montagem do contexto** por prioridade, dentro de um orçamento de tokens do modelo:
  1. instruções do sistema + do agente (fixas durante a conversa, para aproveitar cache)
  2. memórias relevantes (busca vetorial + recência)
  3. resumo da parte antiga da conversa (gerado em segundo plano)
  4. mensagens recentes (o máximo que couber)
  5. trechos de arquivos recuperados (RAG), marcados como **conteúdo não confiável**
- O que não cabe é descartado de forma controlada, de baixo para cima nessa lista (exceto 1).

### 4.6 Arquivos

`upload → validação (tamanho, tipo real por assinatura de bytes) → armazenamento →
fila: extração (PDF, DOCX, TXT, CSV, MD, imagens) → divisão em trechos → embeddings →
índice (pgvector + busca textual) → recuperação → contexto`.

Imagens pequenas vão direto ao modelo (visão); documentos grandes entram só pelos trechos
relevantes. Estados visíveis: enviado, processando, pronto, falhou.

### 4.7 Autenticação (modo dono único)

- Primeiro acesso: tela de configuração inicial cria a conta do dono; depois o cadastro fecha.
- Senha com hash scrypt/argon2; **2FA TOTP** (recomendado ligar); códigos de recuperação.
- Sessão: token aleatório em cookie `HttpOnly; Secure; SameSite=Lax`, só o hash no banco,
  expiração e revogação (tela *Conta → Sessões*).
- CSRF: verificação de `Origin` + token de cabeçalho em toda requisição que altera estado.
- Rate limit agressivo em login; bloqueio progressivo após falhas.
- Toda rota privada é protegida **no servidor**.

### 4.8 Segurança (resumo)

| Risco | Medida |
|---|---|
| Vazamento de segredos | Cofre cifrado (AES-256-GCM, chave fora do banco), *redaction* nos logs, nada sensível no front |
| Prompt injection (sites, arquivos, e-mails) | Conteúdo externo delimitado e rotulado como dado; ações com efeito externo exigem aprovação; agente só usa ferramentas permitidas |
| SSRF | Ferramentas HTTP resolvem DNS e bloqueiam IPs privados/metadata; só http/https; limite de tamanho e tempo |
| Upload malicioso | Tipo real por bytes, limite de tamanho, nome aleatório no disco, nunca executado nem servido inline |
| XSS | Markdown renderizado sem HTML bruto; CSP via helmet |
| SQL injection | Consultas sempre parametrizadas |
| Abuso de ferramentas | Limite de etapas, timeouts, política de risco, log de cada execução (`tool_runs`) |
| Auditoria | `audit_logs` para login, conexões, aprovações, exclusões, mudanças de chave |

---

## 5. Estrutura de pastas

```
sinapse/
├── docs/
│   ├── ARQUITETURA.md            ← este documento
│   ├── COSINAPSEES.md               como criar apps OAuth / adicionar MCP / OpenAPI
│   └── DEPLOY.md
├── docker-compose.yml            app + postgres(pgvector)
├── .env.example                  variáveis documentadas, sem segredos
├── package.json                  workspaces: server, web, shared
│
├── shared/                       tipos e schemas usados pelo front e pelo back
│   └── src/ (api-types.ts, events.ts, tool-types.ts)
│
├── server/
│   └── src/
│       ├── index.ts              inicialização
│       ├── app.ts                monta o Fastify (plugins, rotas, erros)
│       ├── config/env.ts         variáveis de ambiente validadas
│       ├── lib/                  logger, erros, criptografia, ids, ssrf-guard, sse
│       ├── db/
│       │   ├── pool.ts
│       │   ├── migrate.ts
│       │   ├── migrations/       SQL versionado
│       │   └── repositories/     acesso a dados por entidade
│       ├── auth/                 setup inicial, login, 2FA, sessões, CSRF, guards
│       ├── secrets/              cofre: cifrar/decifrar chaves e tokens
│       ├── ai/
│       │   ├── providers/        anthropic.ts, openai.ts, gemini.ts, openrouter.ts, ollama.ts, registry.ts
│       │   ├── models.ts         catálogo: contexto, preço, capacidades
│       │   └── usage.ts          custo e métricas por chamada
│       ├── context/              montagem de contexto, orçamento de tokens, resumos
│       ├── agent/
│       │   ├── orchestrator.ts   o loop do agente
│       │   ├── approvals.ts      pedidos de aprovação humana
│       │   └── policies.ts       regras de risco por ferramenta/agente
│       ├── runs/                 Run Manager: execuções, eventos, cancelamento, reconexão SSE
│       ├── tools/
│       │   ├── registry.ts       registro central + busca de ferramentas
│       │   ├── router.ts         validação, permissão, timeout, log
│       │   └── builtin/          files, memory, web_fetch, web_search, calculator, time
│       ├── connections/
│       │   ├── service.ts        estados, OAuth, refresh, revogação
│       │   ├── oauth.ts          state assinado + PKCE
│       │   ├── native/           google/, github/, notion/ (cada um: auth + ferramentas)
│       │   ├── mcp/              cliente MCP (HTTP e stdio), descoberta de ferramentas
│       │   ├── openapi/          importador de spec → ferramentas
│       │   └── database/         conector de bancos externos
│       ├── files/                upload, validação, storage (local/S3), extração, chunking, embeddings
│       ├── memory/               memórias, extração sugerida, busca
│       ├── jobs/                 pg-boss: processar arquivo, resumir conversa, refresh de tokens
│       ├── observability/        métricas, health, tracing
│       └── routes/               auth, conversations, messages, runs, agents, files,
│                                 memories, tools, connections, settings, usage, account
│   └── test/ (unit/, integration/)
│
├── web/
│   └── src/
│       ├── main.tsx · App.tsx · router.tsx
│       ├── api/                  cliente HTTP, cliente SSE com reconexão, hooks de query
│       ├── design/               tokens (cores, tipografia, espaçamento), tema claro/escuro
│       ├── components/ui/        Button, Input, Dialog, Menu, Toast, Skeleton, Badge, Switch, Tabs…
│       ├── layout/               Sidebar (desktop fixa / mobile gaveta), AppShell
│       ├── features/
│       │   ├── auth/             setup inicial, login, 2FA
│       │   ├── chat/             lista de mensagens, composer, streaming, asinapses, painel do agente, aprovações
│       │   ├── conversations/    histórico, busca (Ctrl+K)
│       │   ├── agents/           lista, editor de agente
│       │   ├── files/
│       │   ├── connections/      catálogo, detalhes, fluxo OAuth, adicionar MCP/OpenAPI
│       │   ├── tools/
│       │   ├── memory/
│       │   └── settings/         Geral · IA · Agente · Conexões · Dados · Conta
│       └── lib/                  markdown seguro, atalhos, utilidades
│
└── e2e/                          Playwright: fluxos principais, desktop e mobile
```

---

## 6. Banco de dados (tabelas principais)

Todas com `id uuid`, `created_at`, `updated_at` e `user_id` (FK) onde aplicável.

| Tabela | Campos-chave |
|---|---|
| `users` | email, password_hash, totp_secret (cifrado), role (`owner`) |
| `sessions` | token_hash, expires_at, ip, user_agent, last_seen_at, revoked_at |
| `provider_keys` | provider, key (cifrada), base_url, last4, status |
| `conversations` | title, agent_id, mode (`chat`/`agent`), model, summary, pinned, archived |
| `messages` | conversation_id, role, content (jsonb: texto, asinapses, chamadas de ferramenta), status, model, tokens |
| `runs` | conversation_id, status, steps, error, started_at, finished_at |
| `run_events` | run_id, seq, type, payload (para reconexão do streaming) |
| `agents` | name, icon, description, instructions, model, settings (jsonb) |
| `agent_tools` | agent_id, tool_id, policy override |
| `agent_connections` | agent_id, connection_id |
| `agent_files` | agent_id, file_id (base de conhecimento) |
| `connections` | type (`native`/`mcp`/`openapi`/`database`), provider, status, scopes, config (jsonb), credentials (cifradas), expires_at, last_error |
| `tool_catalog` | tool_id, connection_id, name, description, schema, risk, embedding (vector) |
| `tool_runs` | run_id, tool_id, args, result, status (`pending_approval`/`approved`/`rejected`/`ok`/`error`), duration_ms |
| `files` | name, mime, size, storage_key, status, error, sha256 |
| `file_chunks` | file_id, idx, text, tsv (busca textual), embedding (vector) |
| `memories` | content, source, agent_id (opcional), embedding, last_used_at |
| `settings` | preferências do usuário (jsonb) |
| `usage` | run_id, provider, model, input/output tokens, custo, latência, ttft |
| `audit_logs` | action, target, metadata, ip |

Índices: `(user_id, updated_at)` nas listas, GIN em `tsv`, HNSW em `embedding`,
`(run_id, seq)` em `run_events`.

---

## 7. API (resumo)

```
POST /api/setup                       cria o dono (só funciona uma vez)
POST /api/auth/login | logout | 2fa   GET /api/auth/me
GET|POST|PATCH|DELETE /api/conversations[/:id]
GET  /api/conversations/:id/messages?before=…      (paginado)
POST /api/conversations/:id/messages               → { runId }
GET  /api/runs/:id/events             (SSE, reconectável)
POST /api/runs/:id/cancel
POST /api/runs/:id/approvals/:toolRunId            { decisão }
CRUD /api/agents · /api/files · /api/memories
GET  /api/tools · POST /api/tools/search
GET  /api/connections/catalog · CRUD /api/connections
GET  /api/connections/:provider/oauth/start · /callback
POST /api/connections/:id/test · /refresh · DELETE (revoga)
GET|PATCH /api/settings · CRUD /api/provider-keys
GET  /api/usage · /api/health · /metrics
```

---

## 8. Interface

- **Sidebar**: Nova conversa · Pesquisar (Ctrl+K) · Histórico (agrupado por data, fixadas no topo) ·
  Agentes · Arquivos · Conexões · Ferramentas · Memória · Configurações · Perfil.
- **Chat**: streaming, parar geração (Esc), regenerar, copiar, editar última mensagem,
  asinapses por arrastar/colar, seletor de modelo e de modo (chat/agente), painel de etapas do
  agente, cartões de aprovação, erros com "tentar de novo".
- **Mobile**: sidebar em gaveta, alvos de toque ≥ 44px, áreas seguras, composer acima do
  teclado virtual, upload pela câmera/galeria.
- Tema claro/escuro, identidade visual própria, skeletons, estados vazios úteis.
- Conversas longas: paginação de mensagens antigas + renderização sob demanda.

---

## 9. Orçamentos de performance (metas)

| Métrica | Meta |
|---|---|
| JS inicial (gzip) | ≤ 180 KB; telas secundárias e renderizador de markdown/código em chunks lazy |
| LCP (desktop / 4G) | < 1,5 s / < 2,5 s |
| Latência da API (p95, sem IA) | < 150 ms |
| Overhead até o 1º token (nosso lado) | < 300 ms além do provider |
| Mensagens renderizadas de uma vez | ≤ 60 (resto paginado) |

---

## 10. Fases de construção

| Fase | Entrega | Critério de pronto |
|---|---|---|
| **0. Base** | monorepo, env, Postgres + migrações, logger, erros, Docker Compose | `npm run dev` sobe tudo; health check verde |
| **1. Acesso** | setup do dono, login, sessões, CSRF, 2FA | testes de integração de auth passando |
| **2. Chat** | providers (Anthropic + OpenAI-compatível), conversas, streaming SSE, parar/regenerar, histórico, cofre de chaves | conversa real com streaming, E2E de chat |
| **3. Interface** | design system, sidebar, mobile, temas, configurações | screenshots desktop/mobile revisados |
| **4. Agente + ferramentas** | orquestrador, registry, router, aprovações, ferramentas internas | E2E com aprovação/cancelamento |
| **5. Arquivos + memória** | upload, extração, RAG com pgvector, memórias | perguntar sobre um PDF enviado |
| **6. Conexões** | MCP (escala), OAuth nativo (Google/GitHub), OpenAPI, bancos | conectar/desconectar/expirar testado |
| **7. Agentes personalizados** | editor, ferramentas/conexões/arquivos por agente | isolamento testado |
| **8. Produção** | métricas, backups, deploy, revisão de segurança | deploy acessível com HTTPS |

Cada fase passa pelo ciclo implementar → testar → inspecionar → corrigir → regressão antes da próxima.

---

## 11. O que depende de você

| Item | Necessário para | Obrigatório? |
|---|---|---|
| Chave de pelo menos um provider de IA (Anthropic, OpenAI, OpenRouter…) | conversar com IA de verdade | Sim (fase 2) |
| Onde hospedar (VPS com Docker, Render, seu computador) | deploy | Sim (fase 8) |
| Apps OAuth no Google Cloud / GitHub (client id/secret) | conectores nativos Google/GitHub | Só se quiser esses nativos |
| URLs de servidores MCP dos serviços que você usa | conexões em escala | Opcional |
| Chave de busca web (Tavily ou Brave) | ferramenta de pesquisa na web | Opcional |
| SMTP | e-mails de recuperação | Opcional (2FA + códigos de recuperação cobrem o caso pessoal) |
