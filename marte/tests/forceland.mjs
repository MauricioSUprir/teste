import { chromium } from 'playwright-core';
// iPhone com rotação TRAVADA em retrato: viewport continua 390x844, o jogador toca ⟳ para jogar deitado
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'pt-BR', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const check = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
await p.goto('http://localhost:4173/?debug=1&quality=low');
await p.evaluate(() => localStorage.removeItem('ares.rot'));
await p.waitForFunction(() => window.__ready === true, null, { timeout: 240000 });
check(await p.isVisible('#btn-rot'), 'botão ⟳ visível no menu (vertical)');
await p.tap('#btn-rot');
await p.waitForTimeout(500);
await p.screenshot({ path: 'test-output/deitado_menu.png' });
await p.tap('#btn-play'); await p.tap('#btn-play');
await p.evaluate(() => { __debug.freeze(true); __debug.setTime(9); __debug.renderOnce(0.3); });
const st = await p.evaluate(() => ({ cls: document.body.className, aspect: __game.camera.aspect, cw: __game.renderer.domElement.width, ch: __game.renderer.domElement.height }));
check(st.cls.includes('rot-cw') && !st.cls.includes('portrait') && st.aspect > 1.9, `jogo deitado: aspecto ${st.aspect.toFixed(2)}, canvas ${st.cw}x${st.ch}, classes "${st.cls}"`);
const cdp = await ctx.newCDPSession(p);
// joystick: empurrar "para cima" na tela do jogo = para a direita da tela física (girada 90° horário)
const drive = async (label, dirFn) => {
  const home = await p.evaluate(() => { const r = document.getElementById('joy').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const pos0 = await p.evaluate(() => [__game.player.pos.x, __game.player.pos.z, __game.player.yaw ?? 0]);
  const [dx, dy] = dirFn();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: home.x, y: home.y, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: home.x + dx, y: home.y + dy, id: 1 }] });
  const mv = await p.evaluate(() => ({ ...__game.input.move }));
  await p.evaluate(() => __debug.renderOnce(2));
  await p.screenshot({ path: `test-output/deitado_${label}.png`, timeout: 120000 });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const pos1 = await p.evaluate(() => [__game.player.pos.x, __game.player.pos.z]);
  return { mv, d: Math.hypot(pos1[0] - pos0[0], pos1[1] - pos0[1]), home };
};
let r = await drive('cw', () => [70, 0]);
check(r.mv.y > 0.9 && Math.abs(r.mv.x) < 0.1 && r.d > 1.5, `90° horário: dedo p/ direita física = frente (move ${r.mv.x.toFixed(2)},${r.mv.y.toFixed(2)}), andou ${r.d.toFixed(1)} m, joystick em (${r.home.x.toFixed(0)},${r.home.y.toFixed(0)})`);
// olhar: arrastar no lado direito do jogo
const lookBefore = await p.evaluate(() => __game.input.look.x);
await p.tap('#btn-rot'); await p.waitForTimeout(400);
const st2 = await p.evaluate(() => ({ cls: document.body.className, aspect: __game.camera.aspect }));
check(st2.cls.includes('rot-ccw') && st2.aspect > 1.9, `segundo toque: 90° anti-horário (aspecto ${st2.aspect.toFixed(2)})`);
r = await drive('ccw', () => [-70, 0]);
check(r.mv.y > 0.9 && Math.abs(r.mv.x) < 0.1 && r.d > 1.5, `90° anti-horário: dedo p/ esquerda física = frente (move ${r.mv.x.toFixed(2)},${r.mv.y.toFixed(2)}), andou ${r.d.toFixed(1)} m`);
// botões de toque continuam acertando (pular)
const box = await p.locator('#tb-use').boundingBox();
check(!!box && box.width > 20, `botões na tela girada: ✋ em (${box.x.toFixed(0)},${box.y.toFixed(0)}) ${box.width.toFixed(0)}x${box.height.toFixed(0)}`);
await p.tap('#btn-rot'); await p.waitForTimeout(400);
const st3 = await p.evaluate(() => ({ cls: document.body.className, aspect: __game.camera.aspect }));
check(st3.cls.includes('portrait') && !st3.cls.includes('forceland') && st3.aspect < 1, `terceiro toque: volta ao normal (aspecto ${st3.aspect.toFixed(2)})`);
// com o aparelho realmente na horizontal (sem trava) o botão some e o modo forçado é ignorado
await p.tap('#btn-rot'); await p.setViewportSize({ width: 844, height: 390 }); await p.waitForTimeout(1200);
const st4 = await p.evaluate(() => ({ cls: document.body.className, aspect: __game.camera.aspect, btn: !document.getElementById('btn-rot').classList.contains('hidden') }));
check(!st4.cls.includes('forceland') && !st4.btn && st4.aspect > 1.9, `giro real do aparelho: sem rotação dupla, botão oculto (aspecto ${st4.aspect.toFixed(2)})`);
console.log('erros:', errs.join('\n') || 'nenhum');
await b.close();
