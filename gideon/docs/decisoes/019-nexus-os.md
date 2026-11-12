# 019 — Nexus OS: a área de trabalho da GIDEON no navegador

**Data:** 12/11/2026 · **Fase:** 6 (Nexus OS) · **Situação:** aceita (falta o dono abrir e testar)

## Decisão
- **Uma página nova no site que já existe:** `https://gideon-home.onrender.com/nexus.html` (Render estático, grátis, publica sozinho a cada envio ao Git).
- **Parece um computador:**
  - área de trabalho com ícones;
  - janelas que dá para arrastar, redimensionar, minimizar e maximizar; a página lembra onde cada uma ficou e quais estavam abertas;
  - barra de tarefas com o menu **G**, as janelas abertas, se o PC está ligado, o sino 🔔 e o relógio.
  - **No celular**, cada janela ocupa a tela inteira.
- **Aplicativos:**
  - **Conversa:** fala com a GIDEON pelo núcleo de verdade (canal `home`, sessão `nexus`), com as mesmas ferramentas e a mesma memória dos outros canais.
  - **Arquivos:** pasta GIDEON do PC (navegar, procurar, abrir no editor ou no PC) e busca no Google Drive.
  - **Terminal:** comandos do PC só da lista permitida (git, python, node, npm…). Instalar e `git push` pedem OK numa caixa de confirmação.
  - **Editor de código:** abre, edita e salva arquivos de texto da pasta GIDEON. Sobrescrever pede OK; a versão antiga vai para a lixeira da GIDEON.
  - **Memória:** o que entrou por último, busca por significado, projetos e linha do tempo.
  - **Tarefas e lembretes:** ver, criar, concluir e cancelar.
  - **Equipe:** o painel `equipe.html` dentro de uma janela.
  - **Automações e sistema:** as rotinas do agendador (quando rodam, última vez, falhas em 24 h), as baterias de testes, as melhorias, as missões da equipe e o GIDEON PC.
- **Central de notificações (sino):**
  - pedidos esperando OK, com **Aprovar / Negar**;
  - avisos que a GIDEON mandou sozinha;
  - erros das últimas 24 h e próximos lembretes.
  - Atualiza a cada 20 s. Um pedido novo aparece também num aviso no canto da tela.
- **Aprovar pelo Nexus:**
  - quem executa é a função `gideon` (`resolverAprovacao`), igual ao botão do Telegram;
  - o pedido fica com `decidido_via = nexus`;
  - **o dono recebe no Telegram** "🖥️ Pelo Nexus: …". Assim ele vê se alguém mais usou a chave.
- **Servidor:**
  - **função nova e pequena, `nexus`** (`supabase/functions/nexus/index.ts`), com as rotas `painel`, `conversa`, `historico`, `aprovar`, `automacoes` e `memoria`;
  - a função `gideon`, que já funciona, **não foi mexida**;
  - para conversar e aprovar, a `nexus` chama as rotas da `gideon` com o segredo do agendador;
  - arquivos, terminal, Drive, tarefas e memória usam a rota `home-ferramenta`, que o GIDEON Home já tinha.
- **Banco:** migração 015 cria `gideon_nexus_automacoes()`, que lê o agendador (`cron.job` e `cron.job_run_details`). Só a chave de serviço pode chamar.

## Login (6.3)
- **Mesma chave do GIDEON Home**, não Supabase Auth.
  - O dono manda `/home` no Telegram e abre o link uma vez no navegador.
  - A chave fica guardada no navegador e vale 30 dias. Ela é assinada com o segredo do Vault: só a GIDEON sabe gerar.
  - Sem chave, ou com a chave vencida, o Nexus mostra como entrar e aceita colar o link.
  - "Sair deste navegador" (no menu G) apaga a chave.
- **Por quê:**
  - um dono só;
  - o Telegram já é o lugar seguro dele;
  - o Supabase Auth pediria cadastro, e-mail de confirmação e regras de acesso em todas as tabelas, sem ganho para uma pessoa só;
  - a chave do Home já dava acesso às mesmas ferramentas (voz). **O Nexus não abre nada novo.**

## Testes
- **Rotas no ar** (chave gerada no banco):
  - `painel`, `automacoes`, `memoria` e `historico` respondem 200;
  - chave errada → 401.
- **Aprovação de verdade (6.4):**
  - pedido de teste "criar a tarefa Teste do Nexus" → Aprovar pela rota `aprovar` → tarefa criada, pedido `aprovada` via `nexus`, aviso no Telegram;
  - a tarefa de teste foi apagada depois.
- **Conversa:** "quais tarefas e lembretes eu tenho abertos?" → usou `listar_tarefas` e `listar_lembretes` e respondeu certo em 12 s.
- **Página** (navegador automático, com dados de exemplo):
  - abriu as 8 janelas e arrastou uma;
  - aprovou pela central;
  - conversou;
  - contador do sino e título da aba certos;
  - nenhum erro no console;
  - no celular (390 px), sem rolagem para o lado.
- **Achado no teste:** as janelas abriam em cima da segunda coluna de ícones. Agora abrem mais à direita.

## Custo
- Zero. Site estático no Render e funções no Supabase grátis.
- Com a página aberta, o painel faz 3 chamadas por minuto (~4.300 por dia se ficar aberta o dia todo; o plano grátis tem 500 mil por mês). A conversa gasta IA como qualquer outro canal.

## Alternativas descartadas
- **Mexer na função `gideon` para pôr as rotas do Nexus:** exigiria publicar de novo os 14 arquivos dela. Uma função separada é menor, mais segura e mais rápida de mudar.
- **Um sistema operacional de verdade:** anos de trabalho e pouco ganho (roadmap). O Nexus é uma página que se comporta como uma área de trabalho.
- **O navegador falar direto com o banco:** precisaria de login do Supabase e regras de acesso em todas as tabelas. O navegador só fala com as funções, que conferem a chave.
