# 022 — GitHub na GIDEON (só leitura)

**Data:** 12/11/2026 · **Fase:** 0 (Base, conexões) e 9 (Memória) · **Situação:** aceita

## Decisão
- **Ferramentas novas** (`github.ts`), em todos os canais (Telegram, iPhone, voz, Nexus) e na equipe de agentes:
  - `github_listar`: os projetos de código do dono (nome, descrição, linguagem, quando mudou por último, link).
  - `github_ler`: README, arquivos da raiz e últimas mudanças (commits, com a data em que entraram no ramo principal). Com `caminho`, lê um arquivo (até 20 mil letras) ou lista uma pasta.
- **Só leitura.** A GIDEON nunca cria, muda ou apaga nada no GitHub.
- **Memória:** o agendador `gideon-indexar-github` roda 1 vez por dia (07h43). Para cada projeto que mudou, ele guarda na memória um resumo com o link e as últimas mudanças. Até 3 projetos por dia, com o modelo de fundo e dentro do teto diário de leitura automática. Projeto que muda tem o resumo antigo trocado pelo novo.
- **Equipe:** o pesquisador e o programador podem ler o código de verdade antes de escrever (`github_ler`).
- **Usuário:** `gideon_config.github_usuario = MauricioSUprir`.

## Sem chave (como está hoje)
- O GitHub deixa 60 pedidos por hora sem chave, e só os projetos **públicos** aparecem (5 de 7).
- **Para ver os privados** (`sinapse` e `ogideon.project`), o dono cria uma chave grátis só de leitura e ela é cadastrada no Supabase como `GITHUB_TOKEN`. Isso também sobe o limite para 5.000 pedidos por hora. Fica para quando ele quiser; o resto já funciona.

## Por quê
- Item da Base que faltava ("GitHub, para o GIDEON ler seus projetos") e item da Memória ("projetos do GitHub: README e histórico").
- Sem dinheiro e sem cadastro: a API pública do GitHub é grátis.
- Só leitura porque mexer em código de verdade é trabalho do Claude, com revisão. A GIDEON propõe; não publica.

## Testes (12/11/2026, função de teste `gideon-teste`)
- `github_listar`: os 5 projetos públicos, do mais recente ao mais antigo, com link.
- `github_ler`:
  - "jogo de futebol" achou `jogo-futebol` (o nome falado não precisa ser exato);
  - o Be2Beauty não tem README e isso apareceu como "(sem README)";
  - uma pasta e um arquivo foram lidos.
- Conversa "o que mudou por último no meu jogo de futebol no GitHub?": chamou `github_ler`, respondeu com a mudança, a data e o link, em 3,8 s, com o modelo rápido.
- Conversa "quais são meus projetos no GitHub?": chamou `github_listar` e listou os 5, com links, em 3,9 s.
- Dois testes novos entraram na bateria de domingo (área `github`).
- Resumo diário: o primeiro resumo (projeto `teste`) copiou um PIN de administrador escrito no README. Corrigido: o resumo é instruído a nunca copiar senha, PIN, chave ou token, e um filtro (`semSegredos`) apaga o que escapar. O resumo antigo foi trocado na rodada seguinte.
- Quando o Google fica sobrecarregado (erro 503), a rodada para e o projeto fica para a próxima, sem ser pulado.
