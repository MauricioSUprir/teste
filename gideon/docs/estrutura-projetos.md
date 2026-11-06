# GIDEON — Estrutura completa por categorias

*06/11/2026 · Substitui a ordem de trabalho do `plano-completo.md` (o "como se junta" continua valendo)*

Cada **categoria** é um dos seus projetos. Cada categoria tem **subcategorias**, e cada subcategoria tem **itens** pequenos o bastante para fazer e testar em uma sessão. Legenda: ✅ feito · 🟡 em andamento · ⬜ a fazer.

Ordem de construção: **0 → 9 → ★ → 4 → 1 → 7 → 8 → 2 → 3 → 5 → 6**. Primeiro a base e a memória, porque tudo depende delas; depois o **Jarvis de voz (★)**, que é o rosto do GIDEON; depois o que roda na nuvem; por último o que precisa do seu computador.

---

## 0. BASE — o que liga tudo (antes de qualquer projeto)

**0.1 Servidor e orquestrador**
- ✅ GIDEON no Supabase (Edge Function + pg_cron), grátis — decisão 011
- ✅ n8n desligado (reserva no Railway); teste no Render suspenso

**0.2 Núcleo (o cérebro único)**
- ✅ Núcleo: memória → agente Gemini → guarda conversa → registra execução
- ✅ Telegram ligado ao Núcleo, só responde ao dono
- ⬜ Roteador de modelos (simples → Flash-Lite; difícil → Flash; privado → local)
- ⬜ Reserva automática quando o Gemini falhar ou bater o limite grátis

**0.3 Conexões do GIDEON** (fazer antes de começar os projetos)
- ✅ Google (gui.drodrigues21@gmail.com): Agenda (ler e criar com confirmação), Gmail (só leitura) e Drive (busca) — conectado e testado em 06/11
- ⬜ WhatsApp (WAHA no Render; reconstruir o "Despertador")
- ⬜ GitHub (para o Self-Improving e para o GIDEON ler seus projetos)
- ⬜ Notion (opcional: anotações e projetos)
- ⬜ Outras que você usa no dia a dia (lista com você)

**0.4 Qualidade e custos**
- ✅ Registro de cada pedido, alerta de erro, relatório semanal
- ✅ Regra "testar o caso vazio" (incidente dos lembretes)
- ⬜ Contar tokens por pedido (para não bater o limite grátis do Gemini)
- ⬜ Cache por significado (pergunta repetida não gasta o modelo)
- ⬜ Botões Útil e Não útil

**0.5 Segurança**
- ✅ Banco fechado (RLS) e usuário restrito para o GIDEON
- ⬜ Fila de aprovações no Telegram (botões Aprovar e Negar)
- ⬜ Diário de ações (`gideon_acoes`) em uso

---

## 9. UNIVERSAL MEMORY — memória pesquisável

**9.1 Base da memória**
- ✅ Tabela com vetores (pgvector), busca por significado, sem duplicar
- ✅ Toda conversa vira memória

**9.2 Fontes**
- ⬜ PDFs, Word, Excel e fotos enviados no Telegram
- ⬜ Pasta do Google Drive (indexar e vigiar mudanças)
- ⬜ Gmail (e-mails importantes, posts do Classroom)
- ⬜ Agenda (eventos passados e futuros)
- ⬜ Projetos do GitHub (README e histórico)
- ⬜ Anotações ("anota que...")

**9.3 Organização**
- ⬜ Projeto, data e origem automáticos em cada item
- ⬜ Linha do tempo de cada projeto ("o que fiz no projeto X")
- ⬜ Esquecer sob pedido ("apaga isso da memória")

**9.4 Pronto quando**
- ⬜ "Onde está aquele projeto que comecei em agosto?" → arquivo certo, com link e histórico

---

## ★ GIDEON HOME — o Jarvis: casa própria, interface e conversa contínua por voz

A "revolução": você fala, o GIDEON responde falando e continua ouvindo, como uma conversa de verdade. Dá para interromper no meio, ele lembra de você e age (lembretes, tarefas, pesquisa e, depois, o PC).

**★.1 Casa própria**
- ⬜ App GIDEON Home: site que se instala como aplicativo no celular e no PC (PWA), com endereço próprio
- ⬜ Login só seu
- ⬜ Opcional: aparelho dedicado ligado o tempo todo (tablet, celular antigo, notebook ou Raspberry Pi) como "central" da casa

**★.2 Interface estilo Jarvis**
- ⬜ Tela cheia com orbe animado que reage à voz (ouvindo / pensando / falando)
- ⬜ Legenda ao vivo do que você diz e do que ele responde
- ⬜ Cartões na tela: lembretes, tarefas, resultados de pesquisa, aprovações
- ⬜ Histórico das conversas

**★.3 Voz contínua** (Gemini Live: áudio direto, plano grátis com limites)
- ⬜ Fala e ouve ao mesmo tempo, com resposta em menos de 1 s
- ⬜ Interromper no meio ("para, não é isso")
- ⬜ Percebe sozinho quando você terminou de falar
- ⬜ Voz em português, escolhida por você
- ⬜ Modo "sempre ouvindo": palavra de ativação "GIDEON" rodando no próprio aparelho; dorme depois de um tempo em silêncio

**★.4 Cérebro conectado**
- ⬜ A voz usa as mesmas ferramentas do Núcleo: memória, lembretes, tarefas, pesquisa e, depois, o PC
- ⬜ Toda conversa por voz vira memória e entra no registro de execuções
- ⬜ Mesma personalidade e prompt do GIDEON no Telegram

**★.5 Segurança**
- ⬜ A chave do Gemini nunca vai para o navegador: o servidor (Edge Function) entrega uma senha temporária por conversa
- ⬜ Ações sensíveis pedem "confirma?" por voz e por botão na tela

**★.6 Modo privado / sem internet (depois, com o Neural Core)**
- ⬜ Whisper + Kokoro + modelo local para conversas que não podem sair de casa

**★.7 Pronto quando**
- ⬜ Conversa de 10 min só por voz, com interrupções, em que ele lembra de algo antigo, cria um lembrete e responde rápido

*Custo: grátis dentro dos limites do plano grátis do Gemini Live; acima disso, ~US$ 0,023 por minuto de conversa. Hospedagem: site estático grátis + Supabase.*

---

## 4. DEEP RESEARCH — pesquisador artificial

**4.1 Busca**
- ⬜ Busca na web grátis (Gemini com Google Search; SerpApi com 100 grátis por mês)
- ⬜ Leitura de páginas e PDFs inteiros
- ⬜ Cache de 24 h (pesquisa repetida não gasta)

**4.2 Análise**
- ⬜ Planejar as perguntas antes de buscar
- ⬜ Comparar fontes e apontar contradições
- ⬜ Organizar as evidências por força

**4.3 Entrega**
- ⬜ Relatório com referências clicáveis
- ⬜ Salvar no Drive e na memória
- ⬜ Aviso de progresso no Telegram ("li 8 de 15 fontes")

**4.4 Pronto quando**
- ⬜ "Faça uma investigação completa sobre energia nuclear" → relatório com fontes em menos de 5 min

---

## 1. JARVIS PRIME — controla o computador

**1.1 Ponte com o PC**
- ⬜ Programa pequeno no seu PC que recebe ordens pelo Supabase (nada aberto na internet)
- ⬜ Pasta liberada (só altera dentro dela)
- ⬜ Aprovação no Telegram antes de apagar, enviar ou instalar

**1.2 Arquivos**
- ⬜ Organizar arquivos (por tipo, data, projeto)
- ⬜ Procurar arquivos ("acha o PDF do contrato")

**1.3 Aplicativos e terminal**
- ⬜ Abrir e fechar aplicativos
- ⬜ Rodar comandos do terminal (lista do que é permitido)
- ⬜ Preparar ambiente de programação de um projeto

**1.4 Código**
- ⬜ Escrever e rodar código numa pasta de testes
- ⬜ Criar e gerenciar projetos (pastas, Git, README)

**1.5 Pronto quando**
- ⬜ "Organiza os arquivos do meu projeto e prepara o ambiente" roda inteiro, pedindo OK antes de apagar

*Depende de: saber se seu PC é Windows ou Mac. Primeiros testes numa máquina virtual.*

---

## 7. SCREEN INTELLIGENCE — entende a tela

**7.1 Captura**
- ⬜ Atalho de teclado tira print e manda ao GIDEON
- ⬜ Print pelo Telegram (já dá para mandar foto)

**7.2 Entendimento** (visão do Gemini, grátis)
- ⬜ Explicar mensagens de erro
- ⬜ Interpretar gráficos
- ⬜ Identificar botões e campos
- ⬜ Analisar interfaces

**7.3 Ajuda guiada**
- ⬜ Orientar passo a passo ("clique em X, depois em Y")
- ⬜ Ajudar a preencher formulários (sugere, você confirma)
- ⬜ Virar os olhos do Jarvis Prime

**7.4 Pronto quando**
- ⬜ Print de um erro → causa e próximo passo

---

## 8. VOICE OS — controle por voz

**8.1 Ouvir**
- ⬜ Palavra de ativação "GIDEON" (openWakeWord, local, grátis)
- ⬜ Transcrição local (whisper.cpp)
- ⬜ Áudio do Telegram (transcrever mensagens de voz)

**8.2 Falar**
- ⬜ Voz local grátis (Kokoro); ElevenLabs quando houver orçamento

**8.3 Agir**
- ⬜ Comandos de voz viram pedidos ao Núcleo
- ⬜ Ações no PC só as permitidas (via Jarvis Prime)

**8.4 Pronto quando**
- ⬜ "Abre meu editor, procura o projeto mais recente e mostra os erros" funciona falado

---

## 2. NEURAL CORE — cérebro de IA próprio

**2.1 Modelos locais**
- ⬜ Ollama no PC com modelos que cabem na sua placa de vídeo
- ⬜ Chat próprio (Open WebUI)

**2.2 Capacidades**
- ⬜ Memória de longo prazo (a mesma da categoria 9)
- ⬜ Reconhecimento de imagens (modelo local com visão)
- ⬜ Voz (a mesma da categoria 8)
- ⬜ Geração de código
- ⬜ Leitura de documentos
- ⬜ Ferramentas personalizadas

**2.3 Integração**
- ⬜ Núcleo manda assuntos "privados" para o modelo local
- ⬜ Funcionar sem internet para o básico

**2.4 Pronto quando**
- ⬜ Pedido privado respondido sem sair do PC, registrado como `modelo = local`

---

## 3. AI COMPANY — equipe de agentes

**3.1 Estrutura**
- ⬜ Diretor (recebe o objetivo, divide em tarefas, pede seu OK no plano)
- ⬜ Painel de quem está fazendo o quê

**3.2 Equipe inicial (5 agentes)**
- ⬜ Pesquisador (usa o Deep Research)
- ⬜ Programador
- ⬜ Analista
- ⬜ Testador
- ⬜ Revisor final

**3.3 Equipe completa (até 20)**
- ⬜ Engenheiro, Designer, Escritor e outros, um de cada vez, só quando os 5 primeiros passarem nos testes
- *Cada agente a mais multiplica o uso de tokens; com orçamento zero, crescer devagar.*

**3.4 Pronto quando**
- ⬜ Tarefa complexa entregue com plano aprovado, execução e revisão registradas

---

## 5. SELF-IMPROVING — testa e melhora o próprio código

**5.1 Testes**
- 🟡 Lista de pedidos reais com resposta esperada (`testes/tarefas-reais.md`)
- ⬜ Bateria automática toda semana com nota

**5.2 Melhorias**
- ⬜ Achar os erros mais frequentes (do registro de execuções)
- ⬜ Propor correção no GitHub (Claude Code)
- ⬜ Rodar os testes na correção

**5.3 Aprovação**
- ⬜ Você aprova no Telegram; só então entra em produção
- ⬜ Volta automática se piorar

**5.4 Pronto quando**
- ⬜ Relatório semanal traz nota + correção proposta, aplicada só após OK

---

## 6. NEXUS OS — ambiente operacional próprio (no navegador)

**6.1 Desktop**
- ⬜ Área de trabalho com janelas
- ⬜ Central de notificações (lembretes, aprovações, alertas)

**6.2 Aplicativos**
- ⬜ Chat com o GIDEON
- ⬜ Gerenciador de arquivos (Drive + PC via Jarvis Prime)
- ⬜ Terminal (via Jarvis Prime, só comandos permitidos)
- ⬜ Editor de código
- ⬜ Memória, tarefas e lembretes
- ⬜ Painel da AI Company e das automações

**6.3 Base**
- ⬜ Site grátis (Render estático) com login (Supabase Auth)

**6.4 Pronto quando**
- ⬜ Você aprova uma ação pendente pelo Nexus e ela é executada

---

## Até onde o n8n aguenta sem dinheiro

| Ponto | Situação |
| --- | --- |
| Licença | O n8n instalado por conta própria (Community) é **grátis e sem limite de execuções**. O problema não é o n8n, é **onde ele roda**. |
| Memória que ele usa | Medido no Railway: média de 340 MB e pico de 570 MB, quase parado. Com a AI Company e o Deep Research, deve passar de 1 GB. |
| Railway | Funciona bem; ~US$ 5/mês depois do crédito de teste. |
| Render grátis | 512 MB: no limite hoje e **não aguenta** as categorias 3 e 4. Dorme sem uso e divide 750 h/mês com seus outros 8 serviços. |
| Hugging Face | Docker passou a exigir PRO (US$ 9/mês). |
| Oracle grátis | Aguenta tudo (12 GB), mas o cadastro dá trabalho. |

**Conclusão:** sem dinheiro, o n8n aguenta a Base e a Memória, mas **não aguenta o plano inteiro** em servidor grátis.

## Substituto ideal do n8n: o GIDEON no próprio Supabase

O Supabase (que já usamos, grátis) roda código direto nele, sem servidor para manter ligado:

| Peça do n8n hoje | No Supabase |
| --- | --- |
| Telegram → Núcleo | **Edge Function** `telegram` (responde na hora, não dorme) |
| Núcleo (memória + agente + ferramentas) | **Edge Function** `nucleo` (TypeScript, chama o Gemini) |
| Lembretes a cada minuto, relatório de domingo | **pg_cron** (agendador dentro do banco) |
| Memória, tarefas, lembretes, aprovações | Já estão no Supabase ✅ |
| Ponte com o PC (Jarvis Prime) | **Realtime** do Supabase (o PC escuta a tabela) |
| Painel (Nexus OS) | Site estático + **Supabase Auth** |

**Por que é o ideal para você:**
- **Custo zero de verdade:** o plano grátis inclui 500 mil chamadas de função por mês (o GIDEON usaria poucos milhares).
- **Não dorme e não tem limite de memória** de servidor: cada pedido roda e termina.
- **Tudo vira código no GitHub**, que é exatamente o que o Self-Improving (categoria 5) precisa para testar e propor melhorias.
- O Claude publica e atualiza direto pelo conector do Supabase.

**O que se perde:** os fluxos visuais do n8n. Você não vai arrastar blocos; mudanças passam pelo Claude.

**Cuidados:**
- Funções de mais de ~150 s, como pesquisas longas, são divididas em etapas.
- O projeto grátis do Supabase pausa após 7 dias sem uso; o uso diário evita.

**Proposta de troca:** reescrever o Núcleo, o Telegram e os lembretes como Edge Functions (o banco não muda), testar lado a lado com o n8n e trocar o Telegram quando estiver igual ou melhor. O n8n fica no Railway como reserva enquanto durar o crédito.
