import { chromium } from 'playwright-core';
// iPhone com rotação TRAVADA: o viewport nunca muda; o jogo deve girar sozinho pelo sensor de gravidade
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'pt-BR', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const check = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
await p.goto('http://localhost:4173/?debug=1&quality=low');
await p.evaluate(() => localStorage.removeItem('ares.rot'));
await p.waitForFunction(() => window.__ready === true, null, { timeout: 240000 });
await p.tap('#btn-play'); await p.tap('#btn-play'); // o toque libera o sensor
await p.evaluate(() => { __debug.freeze(true); __debug.setTime(9); __debug.renderOnce(0.3); });
// convenção iOS: em pé y≈-9.8; topo para a esquerda x≈-9.8
const hold = async (x, y, z, ms = 1100) => { const n = Math.ceil(ms / 60); for (let i = 0; i < n; i++) { await p.evaluate(([x, y, z]) => dispatchEvent(new DeviceMotionEvent('devicemotion', { accelerationIncludingGravity: { x, y, z } })), [x, y, z]); await p.waitForTimeout(60); } await p.waitForTimeout(300); };
const state = () => p.evaluate(() => ({ cls: document.body.className, aspect: __game.camera.aspect }));
await hold(0.3, -9.7, 0.8); // em pé (calibra)
let s = await state(); check(s.cls.includes('portrait') && s.aspect < 1, `em pé: vertical (aspecto ${s.aspect.toFixed(2)})`);
await hold(-9.6, 0.4, 1.0, 300); s = await state(); check(!s.cls.includes('forceland'), 'giro rápido (<0,7 s) é ignorado');
await hold(-9.6, 0.4, 1.0); s = await state(); check(s.cls.includes('rot-cw') && s.aspect > 1.9, `deitado (topo à esquerda): gira sozinho 90° horário (aspecto ${s.aspect.toFixed(2)})`);
await p.evaluate(() => __debug.renderOnce(0.5)); await p.screenshot({ path: 'test-output/auto_cw.png', timeout: 120000 });
await hold(0.2, 0.3, -9.8); s = await state(); check(s.cls.includes('rot-cw'), 'celular deitado na mesa: mantém a orientação');
await hold(9.6, -0.5, 1.0); s = await state(); check(s.cls.includes('rot-ccw') && s.aspect > 1.9, 'virou para o outro lado: gira 90° anti-horário');
await hold(0.3, -9.7, 0.8); s = await state(); check(s.cls.includes('portrait') && !s.cls.includes('forceland'), 'voltou em pé: vertical de novo');
// trava desligada: o sistema gira o viewport → o jogo não gira em dobro
await p.setViewportSize({ width: 844, height: 390 }); await hold(-9.6, 0.4, 1.0); s = await state();
check(!s.cls.includes('forceland') && s.aspect > 1.9, `rotação do sistema ativa: sem giro duplo (aspecto ${s.aspect.toFixed(2)})`);
console.log('erros:', errs.join('\n') || 'nenhum');
await b.close();
