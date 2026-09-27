import { chromium } from 'playwright-core';
const url = process.argv[2];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist', '--ignore-certificate-errors'] });
const ctx = process.env.MOBILE ? await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' }) : await b.newContext({ viewport: { width: 1280, height: 720 } });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
const t0 = Date.now();
await p.goto(url);
await p.waitForFunction(() => window.__ready === true, null, { timeout: 240000 });
console.log('ready', (Date.now() - t0) / 1000, 's');
await p.evaluate(() => { __debug.freeze(true); __debug.renderOnce(0); });
await p.screenshot({ path: process.env.OUT || 'test-output/live_menu.png', timeout: 120000 });
if (process.env.MOBILE) {
  await p.evaluate(() => { __debug.play(); __debug.setTime(9); __debug.renderOnce(0.2); __debug.renderOnce(0); });
  await p.screenshot({ path: 'test-output/live_mobile_play.png', timeout: 120000 });
}
console.log('errors:', [...new Set(errs)].join('\n') || 'none');
await b.close();
