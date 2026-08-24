<img src="public/logo.svg" alt="Logo do Pulso" width="72" align="right" />

# Pulso

Sistema completo e pessoal de organização de estudos, com assistente de IA (Gemini
gratuito ou Claude) e integrações com Google Classroom, Gmail e Drive. Roda no seu computador, com seus dados
guardados em um banco local — nada vai para a nuvem além das chamadas de IA e do Google
que você autorizar.

## O que ele faz

| Módulo | Descrição |
|---|---|
| **Painel** | Visão do dia: meta semanal, sequência de dias estudados, prazos próximos, blocos de hoje |
| **Matérias** | Disciplinas com cores, tópicos e progresso |
| **Tarefas** | Deveres de casa × avaliativos, com **urgência automática** (prazo + dificuldade + vale nota), em kanban |
| **Calendário** | Provas e eventos: adicione manualmente ou **envie uma foto** do calendário da escola e a IA preenche as datas |
| **Cronograma** | Blocos fixos de estudo na semana |
| **Pomodoro** | Timer de foco que registra cada sessão na matéria |
| **Flashcards** | Revisão com repetição espaçada (algoritmo SM-2, estilo Anki) |
| **Modos de estudo** | Quiz gerado por IA e técnica Feynman (explique e receba correção) |
| **Notas** | Anotações por matéria |
| **Assistente IA** | Tutor com contexto real dos seus estudos — funciona com **Gemini (grátis)** ou Claude |
| **Notificações** | Resumo diário por **push na tela** (PC e celular) e por e-mail no seu Gmail |
| **Estatísticas** | Horas por matéria, evolução diária, tarefas concluídas |
| **Integrações** | Classroom → tarefas já classificadas; e-mails de estudo do Gmail; arquivos do Drive |

## Como rodar

Pré-requisito: [Node.js](https://nodejs.org) 20 ou mais novo.

```bash
# 1. Instale as dependências e crie o banco de dados
npm run setup

# 2. Crie seu arquivo de configuração
cp .env.example .env

# 3. Inicie o sistema
npm run dev
```

Abra **http://localhost:3000** no navegador. Pronto — todos os módulos de organização já
funcionam sem nenhuma configuração extra.

### Ativar a IA (opcional, recomendado)

Opção gratuita: chave do **Gemini** em [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → `GEMINI_API_KEY` no `.env`.
Opção paga: chave do **Claude** em [console.anthropic.com](https://console.anthropic.com/settings/keys) → `ANTHROPIC_API_KEY`.
Detalhes em [`docs/INTEGRACOES.md`](docs/INTEGRACOES.md).

### Ativar Google Classroom, Gmail e Drive (opcional)

Siga o passo a passo em [`docs/INTEGRACOES.md`](docs/INTEGRACOES.md) — leva ~10 minutos e
é gratuito.

### Publicar na internet (opcional)

Para acessar de qualquer lugar por um link público protegido por senha, siga
[`docs/DEPLOY.md`](docs/DEPLOY.md) — Vercel + Turso, gratuito, ~15 minutos.

## Documentação

- [`docs/VISAO.md`](docs/VISAO.md) — o que é o projeto e para quem
- [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) — como o código está organizado
- [`docs/MODELO-DE-DADOS.md`](docs/MODELO-DE-DADOS.md) — as tabelas do banco
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — o que já existe e o que vem depois
- [`docs/INTEGRACOES.md`](docs/INTEGRACOES.md) — configurar Google e IA

---

*Obs.: `calculadora.py` e `test_calculadora.py` são arquivos de demonstração anteriores do
repositório, sem relação com o Pulso.*
