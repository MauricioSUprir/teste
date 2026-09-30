// modo construção holográfico: faixa, fantasma, girar, colocar (impressão 3D), celular deitado
import { chromium } from 'playwright-core';
const out = 'test-output/v5';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const check = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
for (const dev of ['desktop', 'phone']) {
  const ctx = dev === 'phone'
    ? await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' })
    : await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/CERT|fonts/.test(m.text())) errs.push(m.text()); });
  await p.goto('http://localhost:4173/?debug=1&quality=' + (dev === 'phone' ? 'mobile' : 'medium'));
  await p.waitForFunction(() => window.__ready === true, null, { timeout: 400000 });
  await p.addStyleTag({ content: '.subtitle { display: none !important; }' });
  await p.evaluate((touch) => { __debug.newGame('normal'); __debug.freeze(true); __game.input.touchMode = touch; const P = __debug.play_(); P.st.buildings.push({ id: 900, type: 'habitat', x: 14, z: 12, rot: 0, dust: 0 }); P.world.sync(P.st); P.st.inv.scrap = 30; P.st.inv.electronics = 10; P.st.flags.computer = true; __debug.setTime(9.5); __debug.teleport(20, 22); __game.player.yaw = 0.3; __debug.renderOnce(0.5); }, dev === 'phone');
  await p.evaluate(() => { __game.input.fire('build'); __debug.renderOnce(0.2); });
  let s = await p.evaluate(() => ({ mode: __debug.play_().buildMode, ghost: !!__debug.play_().world.ghost, tiles: document.querySelectorAll('.btile').length, thumbs: [...document.querySelectorAll('.btile img')].filter((i) => i.src.startsWith('data:image')).length }));
  check(s.mode && s.ghost && s.tiles >= 4 && s.thumbs === s.tiles, `${dev}: modo construção abriu com ${s.tiles} estruturas e miniaturas holográficas`);
  await p.screenshot({ path: `${out}/b_${dev}.png`, timeout: 240000 });
  // gira e coloca
  const r0 = await p.evaluate(() => __debug.play_().world.ghost.rotation.y);
  await p.evaluate(() => { __game.input.fire('rotate'); __debug.renderOnce(0.05); });
  const r1 = await p.evaluate(() => __debug.play_().world.ghost.rotation.y);
  check(Math.abs(r1 - r0 - Math.PI / 4) < 0.01, `${dev}: girar 45°`);
  const n0 = await p.evaluate(() => __debug.play_().st.buildings.length);
  // procura um lugar válido virando o jogador
  for (let i = 0; i < 12; i++) { const ok = await p.evaluate(() => __debug.play_().world.ghostValid); if (ok) break; await p.evaluate(() => { __game.player.yaw += 0.5; __debug.renderOnce(0.05); }); }
  await p.evaluate((touch) => { if (touch) document.getElementById('b-place').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); else __game.input.fire('fire'); __debug.renderOnce(0.6); }, dev === 'phone');
  await p.screenshot({ path: `${out}/b_${dev}_print.png`, timeout: 240000 });
  const n1 = await p.evaluate(() => __debug.play_().st.buildings.length);
  check(n1 === n0 + 1, `${dev}: estrutura colocada (${n0} → ${n1}), impressão 3D em andamento`);
  await p.evaluate(() => __debug.renderOnce(2));
  s = await p.evaluate(() => { const P = __debug.play_(); const b = P.st.buildings[P.st.buildings.length - 1]; return P.world.buildingObjs.get(b.id).obj.scale.y; });
  check(Math.abs(s - 1) < 1e-6, `${dev}: impressão terminou (escala ${s})`);
  await p.evaluate((touch) => { if (touch) document.getElementById('b-exit').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); else __game.input.fire('build'); __debug.renderOnce(0.1); }, dev === 'phone');
  s = await p.evaluate(() => ({ mode: __debug.play_().buildMode, ghost: !!__debug.play_().world.ghost, ui: !document.querySelector('.buildui').classList.contains('hidden') }));
  check(!s.mode && !s.ghost && !s.ui, `${dev}: saiu do modo construção`);
  console.log(dev, 'erros:', errs.join('\n') || 'nenhum');
  await ctx.close();
}
await b.close();
