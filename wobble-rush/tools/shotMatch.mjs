import { chromium } from 'playwright';
const url = 'http://localhost:5190/';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
p.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
p.on('pageerror', e => errors.push('PAGEERROR: '+e.message));
await p.goto(url, { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);
await p.click('#play');
await p.waitForTimeout(1000);
// Reveal the dev overlay.
await p.keyboard.press('F3');
const marks = Number(process.argv[2] || 5);
for (let i = 0; i < marks; i++) {
  await p.waitForTimeout(Number(process.argv[3] || 3000));
  // Hold forward so the local player actually runs.
  await p.keyboard.down('KeyW');
  await p.screenshot({ path: `/tmp/claude-0/match${i}.png` });
}
await p.keyboard.up('KeyW');
console.log('errors:', errors.length ? errors.slice(0,6).join('\n') : 'none');
await b.close();
