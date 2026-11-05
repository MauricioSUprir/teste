# GIDEON — Kickoff: explicação do projeto e início da estruturação

*05/11/2026 · Leia junto com `jarvis-arquitetura-roadmap.md`*

Este arquivo é para quem vai construir o GIDEON, seja uma IA (Claude Code, por exemplo) ou uma pessoa. Ele explica o projeto e diz o que fazer agora: **estruturar o projeto antes de escrever qualquer funcionalidade nova.**

---

## 1. O que é o GIDEON

O GIDEON é um assistente pessoal de IA. A ideia é ele deixar de só responder mensagens e passar a lembrar de tudo, pesquisar a fundo, mexer no computador, enxergar a tela, falar e ouvir, e trabalhar com uma pequena equipe de agentes.

Os 9 projetos da lista original (GIDEON Prime, Neural Core, AI Company, Deep Research, Self-Improving, Nexus OS, Screen Intelligence, Voice OS e Universal Memory) **não são 9 sistemas separados**. Eles são peças de um sistema só, organizadas em 4 camadas:

| Camada | O que faz | Projetos |
| --- | --- | --- |
| Canais | Por onde o dono fala com o GIDEON | Telegram/WhatsApp (já existe), Voice OS, Nexus OS |
| Orquestrador | Recebe o pedido e decide quem resolve | GIDEON no n8n (já existe) |
| Cérebro | Pensa e lembra | Gemini + Claude (já existe), Universal Memory, Neural Core |
| Equipe | Faz trabalhos longos com vários passos | Deep Research, AI Company, Self-Improving |
| No computador | Age no PC do dono | GIDEON Prime, Screen Intelligence |

A ordem de construção está no roadmap: **Fase 1 Memória → 2 Pesquisa → 3 Mãos no PC → 4 Visão de tela → 5 Voz → 6 Cérebro local → 7 Equipe → 8 Auto-melhoria → 9 Painel.**

---

## 2. O que já existe hoje

Não comece do zero. Isto já funciona:

- **n8n cloud:** [https://mauriciosrn8n.app.n8n.cloud](https://mauriciosrn8n.app.n8n.cloud), conectado ao Claude via MCP.
- **Workflow “Jarvis - Fase 1”:** Telegram → Claude → Telegram.
- **WhatsApp:** WAHA rodando no Render ([https://jarvis-waha.onrender.com](https://jarvis-waha.onrender.com)), a partir do repositório `MauricioSUprir/jarvis-waha`. O workflow “Jarvis - Despertador WhatsApp” acorda o serviço a cada 10 minutos. Ferramenta “WhatsApp - Enviar mensagem” ligada ao GIDEON.
- **Dois cérebros:** Gemini como modelo principal + Pesquisador com Claude Haiku e SerpApi para pesquisas.
- **Leitura de arquivos:** PDF, Word, PowerPoint, Excel, fotos, vídeos (Telegram e Drive), YouTube e links.
- **Integrações:** Google Agenda e Gmail (inclusive as postagens do Google Classroom que chegam por e-mail).
- **Memória simples:** tabelas do n8n `jarvis_memoria`, `jarvis_tarefas` e `jarvis_lembretes`.

---

## 3. Sua missão agora: estruturar o projeto

Antes de construir a Fase 1, organize a casa. Faça nesta ordem:

1. **Criar o repositório** `gideon` no GitHub (privado), na mesma conta do `jarvis-waha`, com esta estrutura:

    ```
    gideon/
    ├── README.md                 ← o que é o GIDEON e como as peças se ligam
    ├── .env.example              ← só os NOMES das chaves, nunca os valores
    ├── docs/
    │   ├── roadmap.md            ← cópia do jarvis-arquitetura-roadmap.md
    │   ├── arquitetura.md        ← o estado atual, peça por peça
    │   ├── seguranca.md          ← as regras de segurança do roadmap
    │   └── decisoes/             ← uma decisão por arquivo (001-gemini-principal.md…)
    ├── n8n/
    │   └── workflows/            ← export JSON de cada workflow, sem credenciais
    ├── memoria/                  ← Fase 1: schema do banco e indexação
    ├── pesquisa/                 ← Fase 2
    ├── agente-local/             ← Fases 3 e 4
    ├── voz/                      ← Fase 5
    ├── cerebro-local/            ← Fase 6
    ├── equipe/                   ← Fase 7
    ├── testes/
    │   └── tarefas-reais.md      ← pedidos reais + resposta esperada (base da Fase 8)
    └── painel/                   ← Fase 9
    ```

    As pastas das fases futuras começam vazias, só com um `README.md` de uma linha dizendo o que vai entrar ali.

2. **Fazer backup do que existe:** exportar todos os workflows do n8n para `n8n/workflows/`, removendo credenciais antes do commit.
3. **Escrever `docs/arquitetura.md`:** inventário do estado atual (seção 2 deste arquivo), com um diagrama simples de como as peças conversam.
4. **Registrar as decisões já tomadas** em `docs/decisoes/`: Gemini como cérebro principal, Pesquisador com Claude Haiku + SerpApi, WAHA no Render, voz por último.
5. **Começar o `testes/tarefas-reais.md`** com 10 pedidos que o dono já fez ao GIDEON e a resposta que ele esperava.
6. **Perguntar ao dono as decisões em aberto** (seção 5) e registrar as respostas.
7. **Quebrar a Fase 1 em tarefas pequenas** (issues no GitHub ou checklist no `memoria/README.md`).
8. **Só então começar a Fase 1.**

---

## 4. Regras de trabalho

- **Uma fase por vez.** A próxima só começa quando o critério de pronto da atual passa.
- **Explique cada passo de forma didática.** O dono não é programador: diga o que vai fazer, por quê, e coloque links diretos (URL completa) para cada lugar onde ele precisar clicar.
- **Nada de segredos no repositório.** Chaves de API, senhas e tokens ficam fora do Git; o `.env.example` só lista os nomes.
- **Backup antes de mexer em produção.** Antes de alterar ou apagar um workflow que já funciona, exportar a versão atual e pedir OK.
- **Ferramenta pronta antes de código próprio.** Se já existe algo open source que resolve (ver tabela do roadmap), teste primeiro.
- **Commits pequenos**, com mensagem clara do que mudou.
- **Tudo documentado em `docs/`.** Se não está escrito, não foi decidido.

---

## 5. Decisões em aberto (perguntar antes da Fase 1)

- [ ] Computador: Windows ou Mac, quanta RAM e qual placa de vídeo? Define as Fases 3 e 6.
- [ ] Banco da memória: Supabase (plano grátis, recomendado) ou Qdrant?
- [ ] Orçamento mensal de API (Claude, Gemini, ElevenLabs, SerpApi): define quantos agentes e quanto roda local.
- [ ] Lista do que o GIDEON pode fazer sem perguntar.

---

## 6. O que entregar ao fim desta etapa

- [ ] Link do repositório `gideon` com a estrutura criada
- [ ] Workflows atuais exportados em `n8n/workflows/`, sem credenciais
- [ ] `docs/arquitetura.md` com o estado atual
- [ ] `docs/decisoes/` com as decisões já tomadas
- [ ] `testes/tarefas-reais.md` com os primeiros 10 pedidos
- [ ] Respostas das decisões em aberto (ou a lista do que ainda falta)
- [ ] Checklist detalhado da Fase 1
- [ ] Proposta do próximo passo

---

## 7. Prompt pronto para colar no Claude Code

```
Leia os arquivos jarvis-kickoff.md e jarvis-arquitetura-roadmap.md.

Sua tarefa agora é ESTRUTURAR o projeto GIDEON, seguindo a seção
"3. Sua missão agora" do kickoff, na ordem indicada, respeitando as
regras da seção 4.

Não comece a Fase 1 antes de eu responder as decisões em aberto da
seção 5. Explique cada passo de forma simples, com links diretos para
onde eu precisar clicar, e me peça OK antes de alterar qualquer
workflow que já está funcionando.

Ao terminar, me mostre o checklist da seção 6 preenchido.
```
