import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
p.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
p.on('pageerror', e => errors.push('PAGEERROR: '+e.message));
await p.goto('http://localhost:5190/', { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);
await p.click('#play');
await p.waitForTimeout(600);
await p.keyboard.press('F3');
// Teleport the local player down the course, then run and photograph.
const spots = JSON.parse(process.argv[2] || '[20,60,100,150,200]');
for (let i = 0; i < spots.length; i++) {
  await p.evaluate((z) => {
    const w = window;
    const app = w.__app;
    if (app?.match) { const me = app.match.localPlayer; if (me) { me.pos.z = z; me.pos.y = 3; me.pos.x = 0; } }
  }, spots[i]);
  await p.keyboard.down('KeyW');
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `/tmp/claude-0/run${i}.png` });
  await p.keyboard.up('KeyW');
}
console.log('errors:', errors.length ? errors.slice(0,5).join('\n') : 'none');
await b.close();
