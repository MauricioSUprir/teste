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

