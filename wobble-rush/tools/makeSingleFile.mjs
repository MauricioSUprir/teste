/**
 * Bundles the whole game into one self-contained .html file.
 *
 * No module imports, no side-car assets: it opens from file:// with a double
 * click and can be dropped onto any static host as-is. Everything the game
 * needs - three.js, the simulation, the textures, the audio - is generated in
 * code, so there is nothing else to ship.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'dist-single/assets';
const files = readdirSync(dir);
const cssFile = files.find((f) => f.endsWith('.css'));
const jsFile = files.find((f) => f.endsWith('.js'));
if (!jsFile) throw new Error('no bundle found - build with inlineDynamicImports first');

const css = cssFile ? readFileSync(join(dir, cssFile), 'utf8') : '';
// A literal </script> inside the bundle would close the tag early.
const js = readFileSync(join(dir, jsFile), 'utf8').replace(/<\/script/gi, '<\\/script');

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="#0d1424">
<title>WOBBLE RUSH</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><circle cx='16' cy='13' r='9' fill='%23ff7a5c'/><circle cx='12' cy='12' r='3' fill='%23fff'/><circle cx='20' cy='12' r='3' fill='%23fff'/><circle cx='12' cy='12' r='1.4' fill='%231b2233'/><circle cx='20' cy='12' r='1.4' fill='%231b2233'/></svg>">
<style>${css}</style>
</head>
<body>
<canvas id="stage"></canvas>
<div id="ui"></div>
<script type="module">${js}</script>
</body>
</html>
`;
writeFileSync('wobble-rush.html', html);
console.log('wobble-rush.html', (html.length / 1024 / 1024).toFixed(2), 'MB');
