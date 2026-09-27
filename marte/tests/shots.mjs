// Testes visuais/smoke: node tests/shots.mjs [url] [outdir]
import { chromium } from 'playwright-core';
const url = process.argv[2] || 'http://localhost:4173/?debug=1';
const out = process.argv[3] || 'test-output';
const scen = (process.env.SCEN || 'morning').split(',');
const W = +(process.env.W || 1600), H = +(process.env.H || 900);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
const t0 = Date.now();
await page.goto(url);
try { await page.waitForFunction(() => window.__ready === true, null, { timeout: +(process.env.TO || 300000) }); }
catch (e) { console.log('TIMEOUT; msg=', await page.evaluate(() => document.getElementById('load-msg')?.textContent)); console.log(errors.slice(0, 8).join('\n').slice(0, 3000)); await page.screenshot({ path: `${out}/timeout.png` }); process.exit(1); }
console.log('ready in', (Date.now() - t0) / 1000, 's');
await page.evaluate(() => { __debug.freeze(true); __debug.renderOnce(0); });
await page.screenshot({ path: `${out}/00_menu.png`, timeout: 180000 });
await page.evaluate(() => { window.__debug.play(); window.__debug.freeze(true); });
const S = {
  suit: async () => { await page.evaluate(() => { __debug.setTime(9.2); __debug.camDist(2.0); __debug.look(160, -5); }); },
  crash: async () => { await page.evaluate(() => { __debug.setTime(8.6); __debug.teleport(6, 8); __debug.look(52, -4); __debug.camDist(4.5); }); },
  ref: async () => { await page.evaluate(() => { __debug.setTau(0.5); __debug.lamp(false); __debug.camera(false); __debug.setTime(8.0); __debug.teleport(150, 260); __debug.look(115, -24); __debug.camDist(5.5); }); },
  ref2: async () => { await page.evaluate(() => { __debug.setTime(16.2); __debug.teleport(-420, 120); __debug.look(-60, -10); __debug.camDist(5); }); },
  devil: async () => { await page.evaluate(() => { __debug.setTau(0.5); __debug.setTime(12.2); __debug.teleport(150, 260); __debug.look(115, -4); __debug.camDist(5); const d = __game.devils; for (let i = 0; i < 40; i++) d.update(0.5, __game.camera.position, 12.2, 0.5, __game.sunColI, __game.sunColI); }); },
  storm2: async () => { await page.evaluate(() => { __debug.setTime(13); __debug.setTau(4.0); __debug.teleport(150, 260); __debug.look(115, -6); }); },
  morning: async () => { await page.evaluate(() => { __debug.setTime(8.3); __debug.look(30, -6); }); },
  noon: async () => { await page.evaluate(() => { __debug.setTime(12.5); __debug.look(200, -8); }); },
  sunset: async () => { await page.evaluate(() => { __debug.setTime(17.75); __debug.look(80, 4); }); },
  night: async () => { await page.evaluate(() => { __debug.setTime(22.5); __debug.lamp(true); __debug.look(0, 25); }); },
  fp: async () => { await page.evaluate(() => { __debug.setTime(9.5); __debug.camera(true); __debug.look(60, -10); }); },
  storm: async () => { await page.evaluate(() => { __debug.lamp(false); __debug.setTime(11); __debug.setTau(3.5); __debug.look(90, -2); }); },
  delta: async () => { await page.evaluate(() => { __debug.setTime(9); __debug.teleport(-560, 60); __debug.look(90, 8); }); },
};
for (const s of scen) {
  await S[s]();
  // envelhece a cena (exposição, LODs, texturas) e renderiza 1 quadro limpo
  for (let i = 0; i < +(process.env.FRAMES || 6); i++) await page.evaluate(() => __debug.renderOnce(0.25));
  await page.waitForTimeout(+(process.env.WAIT || 500));
  await page.evaluate(() => __debug.renderOnce(0));
  await page.screenshot({ path: `${out}/${s}.png`, timeout: 180000 });
  console.log(s, JSON.stringify(await page.evaluate(() => __debug.state())));
}
const uniq = [...new Set(errors.map((e) => e.split('\n').filter((l) => /ERROR|error|pageerror/.test(l)).slice(0, 6).join('\n') || e.slice(0, 300)))];
console.log('errors:', uniq.length ? uniq.slice(0, 12).join('\n---\n') : 'none');
await browser.close();
