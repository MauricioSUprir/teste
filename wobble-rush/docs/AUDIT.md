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
| Mapa completo (SKY FOUNDRY) com rotas e atalhos | OK | 240 m, 3 rotas, 6 checkpoints |
| Checkpoints, respawn seguro, invulnerabilidade | OK | escolhe ponto livre |
| Linha de chegada, photo finish autoritativo | OK | |
| Bots com rota, dificuldade e personalidade | PARCIAL | 4 dificuldades × 5 perfis, navegam o percurso inteiro e terminam; ainda caem demais (~12 quedas por bot em 180 s), então só ~1/3 do grid chega perto do fim. Não bloqueia a rodada (a classificação é por posição), mas é a próxima dívida de balanceamento |
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

- **Balanceamento dos bots**: terminam o percurso, mas caem com frequência alta.
  O heatmap (`npm run test:bots`) mostra as quedas hoje distribuídas, sem um
  ponto único culpado — é trabalho de ajuste fino, não um bug estrutural.
- O `MatchClient` já aceita um roster e devolve a classificação completa, então
  o encadeamento de rodadas é ligação de telas, não refactor.

## Próxima fase planejada

1. **Rodadas encadeadas** — 32 → 16 → 8 → final, com tela de classificação
   entre rodadas e espectador completo.
2. **Multiplayer em rede** — servidor WebSocket usando a `MatchSim` que já
   existe, com prediction/reconciliation e interpolação.
3. **Abilities + loadout** — a camada de estratégia do documento 2, já com
   espaço reservado na simulação.

Nenhuma dessas começa antes de o núcleo estar sem P0/P1.
