import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto('http://localhost:5190/', { waitUntil: 'networkidle' });
await p.waitForTimeout(1000);
await p.click('#play');
await p.waitForTimeout(3000);
const info = await p.evaluate(() => {
  const app = window.__app;
  const batch = app.match.batch;
  const out = [];
  for (const [k, b] of batch.batches) {
    const ic = b.mesh.instanceColor;
    out.push({ key: k, count: b.mesh.count, hasColor: !!ic, first: ic ? [ic.array[0], ic.array[1], ic.array[2]] : null, needsUpdate: ic ? ic.needsUpdate : null, matHasColorAttr: !!b.mesh.material.defines });
  }
  const w = app.match.views.get(1).wobbler;
  return { batches: out, skin: w.skinColor, accent: w.accentColor, ver: w.colorVersion };
});
console.log(JSON.stringify(info, null, 1));
await b.close();
