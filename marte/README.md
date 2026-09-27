# ARES — Sobrevivência em Marte

Jogo 3D de sobrevivência realista na cratera Jezero (Marte), para navegador — PC e celular.
Three.js (WebGL2) + Rapier (física WASM) + pós-processamento (N8AO, bloom, SMAA, ACES).

## Rodar

```bash
cd marte
npm ci
npm run dev        # http://localhost:5173
npm run build      # gera dist/
npm run preview
```

As texturas processadas já estão em `public/assets`. Para regerá-las a partir da Poly Haven (CC0):
`node scripts/assets.mjs`.

## Ciência usada
- Posição do Sol: algoritmo Mars24 (NASA GISS), latitude de Jezero 18,44° N; sol de 24h39m35s.
- Céu: espalhamento por poeira (Henyey-Greenstein), céu caramelo de dia e halo azul no pôr do sol; τ controla tudo.
- Gravidade 3,721 m/s²; aderência limitada a μ·g; salto ≈ 0,6 m com ≈ 1,1 s no ar.
- Crateras: N(>D) ∝ D⁻², profundidade 0,2·D, borda 0,04·D, ejecta ∝ (r/R)⁻³.
- Temperatura do ar (MEDA/Perseverance): −80 °C antes do amanhecer, ≈ −15 °C às 13h30.

## Testes
`node tests/shots.mjs "http://localhost:4173/?debug=1&quality=high"` (Playwright + Chromium) gera prints em `test-output/`.
Parâmetros de URL: `?debug=1` (API `__debug` + contador), `?quality=low|medium|high|ultra|max`.

## Créditos
Texturas e rochas fotogramétricas: Poly Haven (CC0). Esqueleto/animações base do astronauta: modelo Xbot dos exemplos do three.js (Mixamo).
