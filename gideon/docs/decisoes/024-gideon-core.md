# 024 — GIDEON Core: núcleo 3D com painéis que funcionam (módulos 61 + 100, primeira parte)

**Data:** 13/11/2026 · **Fase:** módulos novos 61–110 (`modulos-61-a-110.md`) · **Situação:** aceita, no ar

## Decisão
- **Página nova `home/core.html`**, no mesmo site do GIDEON Home (https://gideon-home.onrender.com/core.html), com a mesma chave de acesso (link /home do Telegram).
- **Cena 3D** (three.js r186.1, só os pedaços usados, em `home/vendor/three-core.js`, sem depender de site de fora):
  - **núcleo azul no centro**, com cristais e anéis girando;
  - **GIDEON LAB, NEURAL LAB e WORLD LAB** em órbita, ligados ao núcleo por feixes de luz.
- **Cada parte abre um painel que funciona de verdade.** Nada de número inventado:
  - **Núcleo → Centro de comando (módulo 41).** Mostra só números reais:
    - situação do sistema;
    - modelos usados em 7 dias;
    - agentes da equipe;
    - automações do agendador e falhas em 24 h;
    - projetos e GitHub;
    - documentos na memória, por tipo;
    - GIDEON PC (ligado ou não, versão);
    - pedidos de hoje e nota dos testes;
    - aprovações esperando e missões andando.

    Atualiza a cada 30 s. O botão **[ INICIAR NOVA MISSÃO ]** chama a equipe de agentes: o diretor monta o plano, aparece **Aprovar** e **Cancelar**, e a equipe só começa depois do OK.
  - **GIDEON Lab:** conversa com a GIDEON (a mesma do Nexus OS), nova missão e atalhos para a voz, o Nexus e a equipe.
  - **Neural Lab:** modelos em uso, com barras; o roteador; busca na memória; nota dos testes.
  - **World Lab:** projetos monitorados. As simulações aparecem como "em construção", sem fingir que existem.
- **Controles:**
  - **Mouse:** arrastar gira; a rodinha aproxima; clicar abre.
  - **Toque:** arrastar e pinça.
  - **Teclado:** 1 a 4 abrem os painéis, Esc fecha, setas giram, + e − aproximam.
- **Telas:** com painel aberto, a cena vai para a parte livre da tela. No celular, a câmera se afasta para a órbita inteira caber e o painel sobe de baixo.
- **Rota nova no Nexus: `comando`** (função `nexus`, agora publicada pelo Git como a `gideon`, decisão 021). Ela só lê o banco; não muda nada.
- **Atalho "🌐 Core"** no topo do GIDEON Home.

## O que ainda não tem (próximas partes do 61 e do 100)
- **Gestos pela câmera** (MediaPipe): girar com a mão, pinça para aproximar, mão aberta para o menu. O documento manda começar por mouse e teclado; os gestos são a próxima parte.
- **CPU, RAM e GPU do PC:** o painel já tem o lugar. Os números aparecem quando o GIDEON PC passar a mandar o uso, o que pede uma versão nova do programa.

## Por quê
- É o primeiro protótipo recomendado no documento oficial dos módulos 61–110: "núcleo 3D, painéis ligados a funções reais; começar por mouse e teclado".
- Grátis: roda no navegador e reaproveita o Nexus e a função gideon. Não tem servidor novo.

## Testes (13/11/2026)
- **Navegador de testes** (Chromium, com respostas de exemplo no formato real), no computador (1366×800) e no celular (390×844):
  - a cena abriu, e os quatro painéis abriram pelo teclado e pelos nomes na cena;
  - nova missão: plano → aprovar → "a equipe começou";
  - conversa: mandou e recebeu;
  - busca na memória funcionou;
  - nenhum erro no console e nenhuma rolagem para o lado.
- **Rota `comando` de verdade** (função `nexus` v2, commit `205f136`): devolveu os números reais:
  - 4 modelos, 10 de 10 automações e 259 documentos;
  - 2 projetos + 4 no GitHub;
  - PC desligado, versão 2.2;
  - nota dos testes 9,7.
- **Publicado:** https://gideon-home.onrender.com/core.html respondeu, com o pacote 3D e o botão no Home.

## Atualização (13/11/2026): 3D melhor, a pedido do dono
- **Núcleo:** virou um "reator". Por dentro, um plasma azul que se mexe (feito com ruído na placa de vídeo), dentro de uma casca de vidro com brilho na borda e uma rede geodésica fina. Em volta, anéis em arcos, como num painel de comando, e um anel de marcações.
- **Base holográfica:** embaixo do núcleo, uma grade circular, um disco com uma onda de luz que se espalha e um feixe de luz subindo até o núcleo.
- **Labs:** cristais (octaedros) dentro de bolhas de luz, com dois anéis. Do núcleo até cada lab sai um arco de dados com pulsos correndo.
- **Cores:** só azul, ciano e verde-água; o Neural Lab deixou de ser roxo. O fundo ficou preto profundo, com névoa leve e escurecimento nas bordas, e tem tratamento de cor de cinema (ACES) com brilho mais contido.
- **Detalhes:** ao abrir, o núcleo "acende" crescendo. O lab embaixo do mouse aumenta um pouco, e o lab escolhido fica de frente e maior.
- **Testes:** navegador de testes no computador e no celular; os quatro painéis, a missão, a conversa e a memória funcionaram, sem erro.

## Parte 2 (13/11/2026): gestos pela câmera (módulo 61)
- **Liga e desliga** no botão **✋ Gestos** da barra de baixo (ou a tecla G). A câmera só liga nessa hora. A imagem é lida no próprio aparelho, pelo MediaPipe no navegador; **nada da câmera vai para servidor nenhum**. Aparece uma janelinha com a câmera e os pontos da mão, e a lista dos gestos.
- **Gestos:**
  - ☝️ **Apontar o indicador:** cursor de luz na tela.
  - 🤏 **Pinça rápida** (polegar no indicador): clica no que está embaixo do cursor (lab, núcleo, nome, botão do painel ou link).
  - 🤏 **Segurar a pinça e mexer:** gira o núcleo. Aproximar a mão da câmera com a pinça aproxima a vista; afastar, afasta.
  - 🖐️ **Mão aberta parada (0,6 s):** menu circular com Comando, os três labs, Voz, Nexus e Equipe. Aponte e faça a pinça para escolher.
  - ✊ **Punho:** fecha o menu ou o painel aberto.
- **Código:** `home/core-gestos.js`, carregado só quando os gestos são ligados.
- **Arquivos hospedados no próprio site** (`home/vendor/mediapipe/`, uns 23 MB): MediaPipe tasks-vision 1.2.0 e o modelo de mãos, os dois com licença Apache 2.0. O jsdelivr nem foi preciso.
- **Testes:**
  - **Câmera falsa do navegador de testes:** o leitor de mãos carregou em 9 s e ficou esperando a mão, sem erro.
  - **Mãos simuladas** (pontos da mão montados à mão): cada forma foi reconhecida (aberta, punho, apontar, pinça).
  - **Ações:** mão aberta abriu o menu; apontar para cima e fazer a pinça abriu o Comando; o punho fechou; pinça e mexer girou; pinça e aproximar deu zoom; a mão sumir escondeu o cursor.
  - **Falta** o teste com uma mão de verdade, que só o dono pode fazer, no PC ou no celular.

