import { chromium } from 'playwright-core';
// Computador de pulso + HUD mínimo no iPhone deitado: só o básico na tela, o resto dentro do computador
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'pt-BR', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const check = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const vis = (s) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1; }, s);
await p.goto('http://localhost:4173/?debug=1&quality=low');
await p.waitForFunction(() => window.__ready === true, null, { timeout: 240000 });
await p.evaluate(() => { __debug.newGame('normal'); __debug.freeze(true); __debug.setTime(9.5); __debug.renderOnce(0.3); });
await p.waitForTimeout(300);
// HUD mínimo
for (const id of ['tb-build', 'tb-map', 'tb-pause', 'tb-cam', 'tb-light']) check(!(await p.$('#' + id)), `botão ${id} saiu da tela`);
check(await vis('#tb-pc'), 'botão 💻 do computador visível');
check(await vis('#tb-fire') && await vis('#tb-jump') && await vis('#tb-use'), 'básicos visíveis (atirar, pular, usar)');
await p.screenshot({ path: 'test-output/v2/pc_hud_min.png', timeout: 120000 });
// construir bloqueado antes do computador
await p.evaluate(() => __game.input.fire('build'));
await p.evaluate(() => __debug.renderOnce(0.1));
check(await p.evaluate(() => !__debug.play_().buildMode), 'construção bloqueada sem computador');
// abre o computador quebrado
await p.tap('#tb-pc');
await p.waitForTimeout(200);
check(await p.evaluate(() => __debug.play_().hud.pcOpen), 'toque no 💻 abre o computador');
check(await vis('.pc-banner'), 'aviso "computador danificado" com botão montar');
await p.screenshot({ path: 'test-output/v2/pc_broken.png', timeout: 120000 });
// ganha sucata e monta
await p.evaluate(() => { __debug.give('scrap', 3); __debug.play_().refreshPC(); });
await p.waitForTimeout(100);
await p.tap('.pc-banner [data-a="assemble"]');
await p.waitForTimeout(200);
const s = await p.evaluate(() => ({ c: !!__debug.play_().st.flags.computer, scrap: __debug.play_().st.inv.scrap }));
check(s.c && s.scrap === 1, `computador montado gastando 2 sucatas (sobrou ${s.scrap})`);
check(await vis('.pctile[data-a="build"]') && await vis('.pctile[data-a="map"]'), 'construir e mapa liberados e visíveis');
await p.screenshot({ path: 'test-output/v2/pc_ok.png', timeout: 120000 });
// lanterna pelo computador
const l0 = await p.evaluate(() => __game.player?.lamp ?? null);
await p.tap('.pctile[data-a="light"]'); await p.waitForTimeout(150);
check(await p.evaluate(() => __debug.play_().hud.pcOpen), 'computador continua aberto após lanterna');
// construir fecha o computador e entra no modo construção
await p.tap('.pctile[data-a="build"]'); await p.waitForTimeout(200);
const bst = await p.evaluate(() => ({ open: __debug.play_().hud.pcOpen, b: !!__debug.play_().buildMode }));
check(!bst.open, 'construir fecha o computador');
await p.evaluate(() => __debug.renderOnce(0.1));
await p.screenshot({ path: 'test-output/v2/pc_build.png', timeout: 120000 });
// tela forçada (celular em pé, jogo deitado)
await p.setViewportSize({ width: 390, height: 844 });
await p.evaluate(() => { __debug.play_().buildMode && __game.input.fire('build'); __debug.renderOnce(0.1); });
await p.waitForTimeout(300);
await p.evaluate(() => __debug.play_().togglePC(true));
await p.waitForTimeout(200);
await p.screenshot({ path: 'test-output/v2/pc_forceland.png', timeout: 120000 });
const inside = await p.evaluate(() => { const r = document.querySelector('.holo.pc').getBoundingClientRect(); return r.width > 0 && r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; });
check(inside, 'painel cabe na tela forçada');
console.log('erros:', errs.join('\n') || 'nenhum');
await b.close();
