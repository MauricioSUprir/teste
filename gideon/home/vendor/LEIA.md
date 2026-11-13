# vendor/

- `three-gideon.js`: só os pedaços do [three.js](https://threejs.org) r186.1 (licença MIT) que o rosto usa, empacotados e minificados com esbuild. Assim a página não depende de CDN.
- Para gerar de novo (depois de mudar o que o `rosto.js` importa), numa pasta de rascunho:

```bash
npm i three@0.186.1 esbuild@0.25.10
npx esbuild entrada.js --bundle --format=esm --minify --legal-comments=eof --outfile=three-gideon.js
```

`entrada.js` (nesta pasta) lista o que é exportado.

A cabeça (`../rosto-cabeca.js`) vem do modelo base do [MakeHuman](http://www.makehumancommunity.org) (licença CC0: uso livre, sem pedir permissão), com os ajustes e as expressões do próprio MakeHuman (repositório `makehumancommunity/mpfb2`). Rosto original: mulher adulta jovem, mistura igual dos três tipos-base do MakeHuman, que não é de nenhuma pessoa real. Para gerar de novo ou mudar a forma do rosto: `ferramentas/gerar_cabeca.py` (os pesos ficam no topo do arquivo).

- `three-core.js`: os pedaços do three.js (mesma versão r186.1) que o GIDEON Core (`../core.html`) usa. A lista está em `entrada-core.js`. Para gerar de novo:

```bash
npx esbuild entrada-core.js --bundle --format=esm --minify --legal-comments=eof --outfile=three-core.js
```


- `mediapipe/`: leitor de mãos do GIDEON Core (gestos, `../core-gestos.js`), hospedado aqui para não depender de site de fora.
  - `vision_bundle.mjs` e `wasm/vision_wasm_internal.*`: pacote `@mediapipe/tasks-vision@1.2.0` (licença Apache 2.0, Google). Veio de `npm pack @mediapipe/tasks-vision@1.2.0`. Só a versão SIMD do wasm; navegadores muito antigos ficam sem gestos.
  - `hand_landmarker.task`: modelo de mãos do MediaPipe (float16, versão 1, Apache 2.0). Veio de https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
  - Tudo roda no navegador: a imagem da câmera não sai do aparelho.
