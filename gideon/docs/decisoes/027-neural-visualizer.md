# 027 — Neural Visualizer (módulo 86, parte 1)

**Data:** 13/11/2026 · **Situação:** aceita, no ar no GIDEON Core (Neural Lab)

## Decisão
- **O que é:** uma **rede neural de verdade**, pequena, que aprende ao vivo no próprio aparelho do dono. Não precisa de servidor e não manda nada para fora.
- **O que mostra por dentro:**
  - **em 3D:** as camadas lado a lado. Cada **bolinha é um neurônio** e acende com a ativação do ponto escolhido. Cada **linha é um peso**: azul é positivo, laranja é negativo, e quanto mais forte, mais brilha;
  - **"O que a rede vê":** os pontos de duas classes e o fundo pintado com o que a rede acha de cada lugar, que é a fronteira de decisão se formando. Tocar num ponto mostra em 3D como a rede pensa sobre ele;
  - **"Aprendizado":** acerto, erro e passos, com a curva do erro caindo.
- **Montar a rede:**
  - dados: círculo, xadrez (XOR), espiral ou dois grupos;
  - 1 a 3 camadas escondidas, com 4 a 12 neurônios;
  - velocidade de aprender;
  - ativação tanh ou ReLU;
  - pausar e recomeçar.
- **A conta é toda feita no aparelho:** rede de várias camadas (perceptron), saída softmax, erro de entropia cruzada, otimizador Adam, lotes de 24 pontos. Arquivo `home/core-neural.js`, com o mesmo 3D do Core (`vendor/three-core.js`).
- **Como abrir:**
  - botão "Abrir o Neural Visualizer" no Neural Lab, ou tecla 6;
  - pedindo à GIDEON ("abre o Neural Visualizer"): `abrir_na_tela` com o destino `neural_visualizer`, que entra no ar junto com a próxima publicação da função gideon.
  - Enquanto está aberto, o núcleo 3D do Core pausa para não pesar.
- **Honestidade:** a tela diz que é uma rede pequena, da mesma ideia das IAs grandes, que têm bilhões de pesos. Não finge mostrar o "pensamento" da GIDEON.

## Falta (partes seguintes do 86)
- Ver **modelos de verdade** por dentro (camadas, atenção entre palavras) com um modelo pequeno rodando no navegador ou com a IA local do PC (Ollama). Precisa do PC ou de um modelo baixado.

## Testes (13/11/2026)
- **Navegador de testes**, no computador (1366×800) e no celular (390×844):
  - **espiral:** o acerto subiu de 70% para 98% em uns 10 s;
  - **círculo:** chegou a 100%;
  - trocar os dados, tocar num ponto e fechar com Esc funcionaram;
  - nenhum erro e nenhuma rolagem para o lado.

## Atualização (13/11/2026): 3D melhor, a pedido do dono
- **Camadas:** viraram **placas holográficas**, com borda acesa e linhas de varredura.
- **Neurônios:** um **miolo que acende** com a ativação, dentro de uma bolha de vidro com brilho na borda e um anel girando. Azul é ativação positiva, laranja é negativa, e o branco aparece quando é forte.
- **Sinais correndo** pelas conexões, da entrada para a saída. O tamanho de cada sinal é o quanto aquela conexão pesa para o ponto escolhido (|peso × ativação|).
- **Saída:** mostra a chance de cada classe (ex.: "laranja 99%", "azul 1%").
- **Visual:** brilho de cinema (bloom e cor ACES), névoa e poeira ao fundo. Arrastar gira para os lados e para cima e para baixo.
- **Testes:** os mesmos de antes, sem erro; a espiral chegou a 100% e o círculo, de 97% a 100%.

