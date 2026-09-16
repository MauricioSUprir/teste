# Auditoria de escopo

Tabela viva do que os três documentos de escopo pedem e do que existe de fato.
Atualizada a cada fase. Legenda: **OK** existe e foi testado · **PARCIAL**
existe a base mas falta profundidade · **—** ausente.

## Regra que guia a ordem

> "Nenhuma dessas features importa se correr for ruim, pular for ruim, câmera
> for ruim, colisões forem ruins, FPS estiver ruim, multiplayer estiver ruim."

O núcleo vem primeiro. Cada fase seguinte só começa sem P0/P1 pendentes.

---

## Documento 1 — o jogo base

| Sistema | Estado | Nota |
|---|---|---|
| Movimentação, aceleração, desaceleração, controle no ar | OK | medido: 0,12 s até 90% da velocidade |
| Pulo (coyote time, jump buffer, gravidade dividida, jump cut) | OK | 1,75 m de altura, 0,65 s no ar, salto de 4,75 m correndo |
| Dive com cooldown, escorregão e recuperação | OK | ~8,3 m de alcance |
| Ragdoll parcial + classificação de impacto | OK | nudge → tropeço → queda → ragdoll |
| Escorregar em rampas, plataformas móveis, esteiras | OK | |
| Colisão suave entre jogadores, com limite de impulso | OK | |
| Câmera 3ª pessoa: colisão, FOV dinâmico, suavização, shake | OK | |
| Controles PC + mobile + gamepad, remapeáveis | OK | |
| 18 tipos de obstáculo parametrizados | OK | função pura do tempo |
| Mapas | OK | 3 mapas: SKY FOUNDRY (corrida, 240 m, 3 rotas, 4 layouts), JARDIM NÉON (corrida fácil, 170 m, 2 layouts), ANEL DA TEMPESTADE (eliminação, arena de 3 anéis que desabam) |
| Modos além de corrida | PARCIAL | sobrevivência/eliminação completo; equipes declarado no mapa mas ainda sem pontuação por equipe na tela |
| Kit de autoria de mapas | OK | `maps/kit.ts` — um mapa novo é um arquivo curto, não uma cópia do anterior |
| Checkpoints, respawn seguro, invulnerabilidade | OK | escolhe ponto livre |
| Linha de chegada, photo finish autoritativo | OK | |
| Bots com rota, dificuldade e personalidade | OK | 4 dificuldades × 5 perfis. Escada real: easy termina em ~66 s, hard em ~46 s. No layout padrão 18 de 32 cruzam a linha, vencedor em ~52 s |
| Sorteio de mapa/layout antes da partida | OK | as cartas embaralham, mas o resultado já foi sorteado pelo servidor — a animação nunca decide nada |
| HUD enxuto, menu, resultados, progressão | OK | |
| Áudio 3D sintetizado + música em camadas | OK | |
| VFX em pool, iluminação, qualidade adaptativa | OK | |
| Texturas procedurais e identidade de cor por setor | OK | painéis, chapa, listras de perigo, grade, borracha, vidro, esteira — todas desenhadas em canvas |
| i18n (pt-BR / en / es) | OK | nenhuma string fixa no código |
| Save versionado com merge campo a campo | OK | compatível com updates futuros |
| Modo treino | PARCIAL | funciona; falta reinício instantâneo e ghost |
| Sistema de rodadas (32→16→8→final) | PARCIAL | classificação e eliminação existem; falta o encadeamento de rodadas |
| Multiplayer autoritativo em rede | PARCIAL | a simulação já é autoritativa e determinística; falta o transporte WebSocket + reconciliação |
| Espectador | PARCIAL | trocar de alvo funciona; falta a UI |
| Lobby, matchmaking, party | — | |
| Loja, passe, missões, ranked | — | |
| Tutorial e onboarding | — | |
| Replay | — | arquitetura preparada (eventos já são dados) |

## Documento 2 — profundidade de party game moderno

| Sistema | Estado | Nota |
|---|---|---|
| Arquitetura data-driven para conteúdo | OK | mapas, obstáculos, layouts e eventos são dados |
| RuleSet enviado pelo servidor (modificadores) | OK | gravidade, velocidade, tamanho, colisão, abilities, hazards |
| Progressão de conta (XP, nível, moedas) | PARCIAL | ganha e persiste; falta a jornada longa e milestones repetíveis |
| Abilities, loadout e progressão própria | — | campos já reservados em `PlayerSim.ability` |
| Missões, stars, passe sazonal | — | |
| Clubs, amigos, party, presença social | — | |
| Grand Prix, Play Center, rotação de modos | — | |
| Time trials, ghost, leaderboards | PARCIAL | recorde pessoal por mapa já é salvo |
| Workshop / editor de mapas | — | o formato `MapDef` já é o formato do editor |
| Eventos, moeda de evento, community goals | — | |
| Ranked com divisões | — | |
| Analytics e heatmap de mapas | PARCIAL | heatmap de quedas existe como ferramenta de desenvolvimento |

## Documento 3 — diferenciais próprios

| Sistema | Estado | Nota |
|---|---|---|
| **Dynamic Round Director** | **OK** | 4 layouts + 3 transformações telegrafadas — a fatia vertical recomendada |
| Mapas que mudam durante a partida | OK | colapso de setor abre rota alternativa |
| Rotas ramificadas e atalhos de risco | OK | 3 rotas com perfis de risco distintos |
| Multi-layer (cair custa tempo, não a rodada) | OK | deck de resgate sob o vão das balsas |
| Procedural remix / daily course | — | módulos validados ainda não existem |
| Social world, Adventure co-op, Creator 2.0 | — | roadmap de longo prazo |
| Replay cinematográfico, photo mode, broadcast | — | |
| Música dinâmica por intensidade | OK | camadas, sem reiniciar a faixa |

---

## Dívidas conhecidas

- O layout `highroad` ainda leva menos gente ao fim que os outros (13 de 32
  chegam a 70% do percurso, contra 18 no padrão). Passarela superior é
  legitimamente mais difícil, mas merece mais um passe de ajuste.
- O `MatchClient` já aceita um roster e devolve a classificação completa, então
  o encadeamento de rodadas é ligação de telas, não refactor.

## Bugs corrigidos (leva 2)

| Bug | Causa | Correção |
|---|---|---|
| Rampas colidiam **planas** | a função de euler tem assinatura (rx, ry, rz) e os três chamadores passavam (y, x, z) | `qFromEulerArray`, que recebe o array do mapa |
| D andava para a esquerda | produto vetorial invertido: com a câmera olhando +Z, a direita da tela é −X | base corrigida no controller e nos bots |
| Dash parecia um segundo pulo | lift de 5.2 contra 2.4 de impulso útil | dash rasante: 15.5 à frente, 2.4 de lift |
| Step-up nunca funcionava | avançava só a sobra do movimento, a descida empurrava de volta na horizontal, e a flag lida era do movimento errado (objeto de resultado compartilhado) | refaz o movimento inteiro elevado, sondagem vertical pura, flags capturadas na hora |
| Passarela superior intransponível | a rampa atravessava o próprio piso (só visível depois do conserto do euler) | deck encurtado e rampas recalculadas |

## Bugs corrigidos (leva 1)

| Bug | Causa | Correção |
|---|---|---|
| Câmera ficava **na frente** do personagem | a base de movimento mapeava W para +Z, mas o braço da câmera também era colocado em +Z — 180° fora de fase | braço da câmera invertido para ficar atrás |
| Via-se o mapa por baixo na largada | a câmera saía pela traseira do deck, que acabava logo atrás do grid | deck estendido 8 m para trás |
| Bots pulavam cedo e caíam antes do vão | uma única sonda decidia *pular* e *frear*; ao escalar com a velocidade, o salto disparava 4 m antes da beirada | sondas separadas: decolagem a 1,5 m, frenagem proporcional à velocidade |
| Bots expert mais lentos que os easy | perícia era tratada como "reage mais", então os melhores reagiam até ao que não ia acertá-los | perícia virou **precisão de percepção**: o fraco entra em pânico com fantasmas e ignora martelos reais |

## Próxima fase planejada

1. **Rodadas encadeadas** — 32 → 16 → 8 → final, com tela de classificação
   entre rodadas e espectador completo.
2. **Multiplayer em rede** — servidor WebSocket usando a `MatchSim` que já
   existe, com prediction/reconciliation e interpolação.
3. **Abilities + loadout** — a camada de estratégia do documento 2, já com
   espaço reservado na simulação.

Nenhuma dessas começa antes de o núcleo estar sem P0/P1.
