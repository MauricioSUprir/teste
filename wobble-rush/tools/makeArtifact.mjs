import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const assets = readdirSync('dist/assets');
const css = assets.find(f => f.endsWith('.css'));
const entry = assets.find(f => f.startsWith('index-') && f.endsWith('.js'));

// Vite hashes every filename, so a rebuild adds files instead of replacing them.
// Left alone the folder keeps every past build and the publish ships them too.
rmSync('artifact/assets', { recursive: true, force: true });
mkdirSync('artifact/assets', { recursive: true });
for (const f of assets) writeFileSync(join('artifact/assets', f), readFileSync(join('dist/assets', f)));

// Artifact pages are wrapped in their own doctype/head/body at publish time,
// so this file carries only the page content.
const html = `<title>Wobble Rush</title>
<style>
  /* The host skeleton pads :root for phone safe areas; a full-screen game
     wants the whole viewport, and both fixed layers ignore that padding. */
  html, body { height: 100%; margin: 0; overflow: hidden; background: #0d1424; }
</style>
<link rel="stylesheet" href="assets/${css}">
<canvas id="stage"></canvas>
<div id="ui"></div>
<script type="module" src="assets/${entry}"></script>
`;
writeFileSync('artifact/index.html', html);
console.log('css:', css, '\nentry:', entry, '\nfiles:', readdirSync('artifact/assets').join(', '));
