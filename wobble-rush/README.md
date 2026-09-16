# WOBBLE RUSH

Party platformer 3D multiplayer — corridas rápidas, obstáculos caóticos, física
engraçada e mapas que mudam durante a partida.

Projeto original: nenhum mapa, personagem, nome, interface, som ou asset é
copiado de jogos existentes. Tudo aqui é construído em código.

```bash
npm install
npm run dev        # http://localhost:5180
npm run build      # build de produção
npm run test:sim   # 21 verificações de física e game feel (headless)
npm run test:bots  # partidas completas com 32 bots + heatmap de quedas
```

**Controles** — WASD mover · SPACE pular · SHIFT/CTRL/E mergulhar · mouse câmera
· `[` `]` trocar de espectador · ESC sair · F3 painel de depuração.
No celular: joystick virtual à esquerda, câmera à direita, botões PULO/MERGULHO.

---

## Por que o núcleo é assim

### Simulação determinística compartilhada
`src/shared/` não importa nada do renderizador. O mesmo código roda no cliente
(previsão) e no servidor autoritativo (Node). Nada na simulação usa
`Math.random` ou `Date.now`: toda aleatoriedade passa por um PRNG com seed
(`Rng`), porque um cliente que reexecuta um tick precisa chegar exatamente no
mesmo resultado.

### Obstáculos são função pura do tempo
Um martelo na marca de 12,4 s está sempre no mesmo lugar. Isso significa:
- **zero tráfego de rede** para hazards, não importa quantos existam no mapa;
- previsão perfeita no cliente (ele já sabe onde o martelo está);
- bots podem "ler o ritmo" de um obstáculo como um jogador treinado faria.

### O que você vê é o que colide
Malha e colisor nascem do mesmo `MapDef`. Se viessem de dados diferentes,
eles divergiriam e o jogador seria parado por coisas invisíveis.

### Controller cinemático, não corpo rígido
Um party game precisa de movimento **previsível** com comédia **imprevisível**.
A comédia vem dos obstáculos e do ragdoll — nunca do controller.

Três correções que definiram o game feel, todas encontradas por teste
automatizado antes de existir um único pixel:

| Problema | Sintoma | Correção |
|---|---|---|
| Depenetração ao longo da normal | Toda emenda entre plataformas virava um degrau invisível que roubava velocidade | Superfícies caminháveis são resolvidas **verticalmente** |
| Velocidade de superfície aplicada duas vezes | Esteiras empurravam com o dobro da força | A fricção relativa já embute o movimento horizontal da plataforma |
| Sem step-up | Um lábio de 8 cm parava um jogador correndo | Tentativa de subir e reassentar, aceita só se houve progresso real |

---

## Round Director — o diferencial

Um mapa não deve parecer a mesma partida toda vez.

**Layouts** (sorteados por seed no servidor): 4 variantes do SKY FOUNDRY que
abrem e fecham rotas inteiras — `standard`, `gauntlet`, `highroad`, `overdrive`.

**Transformações no meio da rodada**, sempre telegrafadas antes:
1. `PICO DE PRESSÃO` (24 s) — todo o maquinário acelera;
2. `COLAPSO DO SETOR` (48 s) — o caminho de vidro desaba e uma rota alternativa
   aparece;
3. `APAGÃO` (72 s) — luz de emergência e hazards no máximo.

Tudo é dado (`LayoutVariant`, `PhaseEventDef`), determinístico e compatível com
bots, checkpoints e multiplayer. Adicionar um layout novo não toca em uma linha
de lógica de jogo.

---

## Arquitetura

```
src/
  shared/      simulação — sem renderizador, roda no Node
    math, quat, collision, character, obstacles, mapdef, world, bots, config
    maps/skyfoundry.ts        o mapa como dados
  render/      three.js — palette, character, characterBatch, mapBuilder, scene, vfx
  game/        matchClient, camera, input, playerView
  ui/          hud, i18n
  audio/       áudio sintetizado em runtime
  meta/        save e progressão
tools/         testes headless e captura de tela
```

Sistemas separados de propósito (`PlayerController`, `CameraController`,
`ObstacleSystem`, `MapManager`, `RoundManager`…). Não existe um `GameManager`
gigante.

### Performance
- **Personagens instanciados**: 32 personagens articulados = ~19 draw calls
  (eram ~474 com uma malha por parte). LOD por distância remove sobrancelhas e
  dedos que ocupariam 3 pixels.
- Geometria estática mesclada por (grupo de layout × material).
- Partículas em pool — nada é alocado durante a partida.
- Qualidade adaptativa: o jogo abre mão de resolução antes de abrir mão de FPS.
- Simulação de 32 jogadores: **~0,3 ms/tick** (2% de um frame de 60 Hz).

### Sem assets licenciados
Personagem, mapa, céu, partículas, interface e **todo o áudio** são gerados em
código. Nenhum sample, nenhuma textura baixada, nenhuma música de terceiros.

---

## Estado atual

Ver [`docs/AUDIT.md`](docs/AUDIT.md) para a tabela completa
(EXISTE / PARCIAL / AUSENTE) dos três documentos de escopo e a ordem de
implementação planejada.
