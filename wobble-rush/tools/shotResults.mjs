import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
p.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
p.on('pageerror', e => errors.push('PAGEERROR: '+e.message));
await p.goto('http://localhost:5190/', { waitUntil: 'networkidle' });
await p.waitForTimeout(1000);
await p.click('#play');
await p.waitForTimeout(2500);
// Force the local player across the line, and enough bots too, so the round ends.
await p.evaluate(() => {
  const app = window.__app;
  const sim = app.match.sim;
  const me = sim.byId.get(1);
  sim.finishPlayer(me);
  for (let i = 2; i < 20; i++) { const b = sim.byId.get(i); if (b) sim.finishPlayer(b); }
});
await p.waitForTimeout(2500);
await p.screenshot({ path: '/tmp/claude-0/results.png' });
const hasAgain = await p.$('#again');
console.log('results screen:', hasAgain ? 'OK' : 'MISSING');
console.log('errors:', errors.length ? errors.slice(0,5).join('\n') : 'none');
await b.close();
