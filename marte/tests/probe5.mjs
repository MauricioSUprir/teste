import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 800, height: 450 } });
p.on('console', m => { if (m.type()==='error') console.log(m.text().slice(0,300)); });
await p.goto('http://localhost:4173/?debug=1&quality=low');
await p.waitForFunction(() => window.__ready === true, null, { timeout: 200000 });
await p.evaluate(() => { __debug.play(); __debug.freeze(true); __debug.setTime(9); __debug.look(160, 0); __debug.renderOnce(0); __debug.spheres(); __debug.renderOnce(0); __debug.renderOnce(0); });
await p.screenshot({ path: 'test-output/spheres.png', timeout: 120000 });
await b.close();
