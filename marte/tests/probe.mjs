import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 640, height: 360 } });
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('http://localhost:4173/?debug=1&quality=low');
await p.waitForFunction(() => window.__ready === true, null, { timeout: 200000 });
await p.evaluate(() => { __debug.freeze(true); __debug.setTime(9); });
console.log(JSON.stringify(await p.evaluate(() => __debug.envProbe())));
await b.close();
