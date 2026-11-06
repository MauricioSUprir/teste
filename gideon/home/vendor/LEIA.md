# vendor/

- `three-gideon.js`: só os pedaços do [three.js](https://threejs.org) r186.1 (licença MIT) que o rosto usa, empacotados e minificados com esbuild. Assim a página não depende de CDN.
- Para gerar de novo (depois de mudar o que o `rosto.js` importa), numa pasta de rascunho:

```bash
npm i three@0.186.1 esbuild@0.25.10
npx esbuild entrada.js --bundle --format=esm --minify --legal-comments=eof --outfile=three-gideon.js
```

`entrada.js` (nesta pasta) lista o que é exportado.

A malha do rosto (`../rosto-malha.js`) é o "canonical face model" do MediaPipe (Google), licença Apache 2.0: um rosto médio, que não é de nenhuma pessoa.
