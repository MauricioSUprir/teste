import { chromium } from 'playwright-core';
// iPhone deitado (844x390): HUD, painel do habitat, construção e tela de vitória precisam caber na tela
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'pt-BR', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const check = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const inView = (sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, ok: r.top >= 0 && r.bottom <= innerHeight && r.height > 0 }; }, sel);
await p.goto('http://localhost:4173/?debug=1&quality=low');
await p.waitForFunction(() => window.__ready === true, null, { timeout: 240000 });
await p.evaluate(() => { __debug.freeze(true); __debug.renderOnce(0); });
await p.screenshot({ path: 'test-output/v2/phone_menu.png', timeout: 120000 });
const logo = await inView('#menu .logo'); check(logo.ok, `menu: logo inteiro na tela (${logo.top.toFixed(0)}..${logo.bottom.toFixed(0)})`);
await p.evaluate(() => { __debug.newGame('normal'); __debug.freeze(true); __debug.setTime(9); __debug.give('scrap', 20); __debug.give('electronics', 8); __debug.renderOnce(0.3); });
await p.screenshot({ path: 'test-output/v2/phone_hud.png', timeout: 120000 });
// painel do habitat
await p.evaluate(() => { const P = __debug.play_(); P.refreshHab(); });
await p.waitForTimeout(200);
let r = await inView('#hab-exit'); check(r && r.ok, `habitat: botão Sair visível (${r?.top.toFixed(0)}..${r?.bottom.toFixed(0)})`);
await p.screenshot({ path: 'test-output/v2/phone_hab.png', timeout: 120000 });
await p.evaluate(() => __debug.play_().hud.closeHab());
// tela de vitória com "continuar explorando"
await p.evaluate(() => { const P = __debug.play_(); P.hud.showEnd(true, 12, { distance: 5230, built: 9, deaths: 1 }); });
r = await inView('#end-free'); check(r && r.ok, 'vitória: botão "Continuar explorando" visível');
await p.screenshot({ path: 'test-output/v2/phone_win.png', timeout: 120000 });
await p.tap('#end-free');
const st = await p.evaluate(() => ({ free: __debug.play_().st.flags.freeplay, won: __debug.play_().won, input: __game.input.enabled }));
check(st.free && !st.won && st.input, 'continuar explorando: controle devolvido ao jogador');
// configurações
await p.evaluate(() => { __debug.pause(); document.getElementById('btn-psettings').click(); });
await p.waitForTimeout(200);
r = await inView('#settings [data-back]'); check(r && r.ok, `configurações: Voltar visível (${r?.top.toFixed(0)}..${r?.bottom.toFixed(0)})`);
await p.screenshot({ path: 'test-output/v2/phone_settings.png', timeout: 120000 });
console.log('erros:', errs.join('\n') || 'nenhum');
await b.close();
