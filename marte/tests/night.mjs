import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://localhost:4173/?debug=1&quality=' + (process.env.Q || 'medium'));
await p.waitForFunction(() => window.__ready === true, null, { timeout: 300000 });
await p.evaluate(() => { __debug.newGame('normal'); __debug.freeze(true); const P = __debug.play_(); P.st.buildings.push({ id: 900, type: 'habitat', x: 14, z: 12, rot: 0.4, dust: 0 }, { id: 901, type: 'panel', x: 22, z: 8, rot: 0.2, dust: 0 }); P.world.sync(P.st); __debug.setTime(23.2); });
const shot = async (name, fn) => { await p.evaluate(fn); await p.evaluate(() => __debug.renderOnce(0.3)); await p.screenshot({ path: `test-output/v2/${name}.png`, timeout: 180000 }); };
// base à noite vista de fora (sinalizador aceso: força o flash)
await shot('noite_base', () => { __debug.teleport(2, 30); __debug.look(-150, 2); __debug.lamp(true); __debug.camDist(4); __game.fxT = 0; });
// céu estrelado
await shot('noite_ceu', () => { __debug.lamp(false); __debug.look(40, 38); });
// primeira pessoa com geada no visor
await shot('noite_visor', () => { __debug.camera(true); __debug.lamp(true); __game.visorFrost = 0.9; __debug.look(-150, -4); });
console.log('erros:', errs.join('\n') || 'nenhum');
await b.close();
