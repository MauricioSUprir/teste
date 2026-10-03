# Projeto ARES — jogo de sobrevivência em Marte (pasta `marte/`)

## Como o dono do projeto quer trabalhar
- **Responder sempre em português (Brasil).** Linguagem simples, sem jargão técnico desnecessário.
- O usuário é o produtor; eu (Claude) sou o gestor/dev. Tirar dúvidas, pedir autorizações e conexões só quando necessário.
- **Para cada ideia nova, consultar os 5 conselheiros** (subagentes em `.claude/agents/conselheiro-*.md`:
  gráficos, celular, física, jogabilidade, desempenho) antes de implementar.
- **Sempre testar, mandar prints** (SendUserFile) e **o link público**: https://ares-marte.onrender.com
- Qualidade máxima, realismo (estilo "Perdido em Marte"), mas **roda liso no iPhone** (plataforma principal,
  jogado **deitado**, como app instalado na tela de início).
- Tela limpa: só o essencial no HUD do celular; o resto fica no computador de pulso.
- 4 idiomas: pt (principal), en, es, fr — todo texto novo vai para `src/locales/game_*.ts` (ou `pt/en/es/fr.ts`).

## Stack e comandos (rodar dentro de `marte/`)
- Vite + TypeScript + Three.js r186 + Rapier (rapier3d-compat) + postprocessing.
- `npm run build` (tsc + vite) · `npx tsc --noEmit` (o hook faz isso após cada edição de `.ts`).
- Servidor de teste: `npx vite preview --port 4173 --strictPort` (em segundo plano).
- Testes (Playwright + SwiftShader, `node tests/<nome>.mjs`): gameplay, rover, interior, combat, build,
  rotate, forceland, autorot, portrait, phoneui, pc, slope, nest, colony. Rodar a bateria antes de publicar.
  SwiftShader na qualidade média leva ~15–30 s por quadro: muitos `renderOnce` seguidos + screenshot estouram o tempo
  (use `quality=low` em testes longos). No celular, toque em botão com `p.touchscreen.tap(x, y)` (o `p.tap` erra o alvo).
  Prints: `tests/shots.mjs`, `tests/objs.mjs`. API de depuração: `window.__debug` (`?debug=1`).
- Publicação: push na branch → Render faz o deploy automático. Conferir o hash do bundle no site.

## Regras de código importantes
- Objetivo do jogo: sobreviver → consertar a antena → a Terra manda colonos → fundar a civilização (20 colonos,
  `sim/colony.ts`). Colmeias de alienígenas (`combat/nests.ts`) dão núcleos para as torres de defesa.
- Material transparente com `DoubleSide` precisa de `forceSinglePass: true` (senão compila outra variante na 1ª vez).
- Nunca mudar o número de luzes em tempo de jogo (recompila shaders e trava o iPhone): usar intensidade 0.
  Isso vale também para luzes criadas no construtor do `Play` (depois da compilação do `Game.init`): toda luz nova
  nasce em `game.ts` antes de `compileChunked` (ex.: `game.porch`). Senão o 1º quadro recompila TUDO e o navegador
  "para de responder" no carregamento. Medir travadas do carregamento: `node tests/load.mjs 4173 high`.
- Pré-compilação: `game.compileChunked(raiz)` (pedaços curtos, mesmo destino de render do pós-processamento).
  Nunca `renderer.compileAsync(scene)` da cena inteira em tempo de jogo.
- Materiais novos passam por `enhance()` (render/materials.ts) — névoa + sombras em cascata; clones também.
- Não inserir itens no meio de `OBJECTIVES` (os saves guardam o índice); usar `st.flags`.
- Save: `sim/state.ts` com `SAVE_VERSION` + `migrate()` — todo campo novo precisa de padrão na migração.
- ShaderMaterial que desenha na tela precisa de `#include <tonemapping_fragment>` e `<colorspace_fragment>`
  (a qualidade "Celular" renderiza sem pós-processamento).
- HUD do celular: usar variáveis `--safe-*` (nunca `env()` direto) — o modo deitado forçado gira o `body`.
- Modelos 3D da NASA (domínio público) otimizados por `scripts/nasa.mjs`; texturas Poly Haven (CC0).
