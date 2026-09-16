import { chromium, devices } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const ctx = await b.newContext({ ...devices['Pixel 5 landscape'], hasTouch: true, isMobile: true });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
await p.goto('http://localhost:5190/', { waitUntil: 'networkidle' });
await p.waitForTimeout(2000);
await p.tap('#play').catch(async () => { await p.click('#play'); });
await p.waitForTimeout(9500);
await p.screenshot({ path: '/tmp/claude-0/stick-idle.png' });
await p.evaluate(() => {
  const c = document.getElementById('stage');
  const mk = (t, x, y) => {
    const touch = new Touch({ identifier: 1, target: c, clientX: x, clientY: y });
    c.dispatchEvent(new TouchEvent(t, { touches: [touch], changedTouches: [touch], bubbles: true, cancelable: true }));
  };
  mk('touchstart', 150, 210);
  setTimeout(() => mk('touchmove', 92, 168), 60);
});
await p.waitForTimeout(1600);
await p.screenshot({ path: '/tmp/claude-0/stick-held.png' });
console.log('viewport', JSON.stringify(p.viewportSize()), '| errors:', errs.length ? errs.slice(0, 4).join(' | ') : 'none');
await b.close();
