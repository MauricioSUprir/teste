import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 400, height: 300 } });
await p.goto('http://localhost:4173/?debug=1&quality=low');
await p.waitForFunction(() => window.__ready === true, null, { timeout: 240000 });
const r = await p.evaluate(() => {
  const g = __game; g.freeze(true);
  const out = [];
  for (const [x, z] of [[16, -16], [-16, 16], [100, 300], [300, 100], [-500, 50], [50, -500], [0.5, 0.5], [200, -700]]) {
    const hit = g.physics.castDown(x, 400, z, 800, g.player.collider);
    out.push({ x, z, vis: +g.terrain.heightAt(x, z).toFixed(2), phys: hit === null ? null : +hit.toFixed(2), visSwap: +g.terrain.heightAt(z, x).toFixed(2) });
  }
  return out;
});
console.log(JSON.stringify(r, null, 0));
await b.close();
