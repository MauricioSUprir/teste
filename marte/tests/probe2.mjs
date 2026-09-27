import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('http://localhost:4173/?debug=1&quality=low');
await p.waitForFunction(() => window.__ready === true, null, { timeout: 200000 });
await p.evaluate(() => { __debug.play(); __debug.freeze(true); __debug.setTime(9); __debug.camDist(1.6); __debug.look(160, 5); __debug.envShow(); __debug.renderOnce(0.3); __debug.renderOnce(0); });
await p.screenshot({ path: 'test-output/env.png', timeout: 120000 });
await b.close();
