import { chromium, devices } from 'playwright';
const url = process.argv[2];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const desktop = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
desktop.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
desktop.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await desktop.goto(url, { waitUntil: 'load', timeout: 60000 });
await desktop.waitForTimeout(4000);
const ok = await desktop.$('#play');
await desktop.screenshot({ path: '/tmp/claude-0/cdn-menu.png' });
await desktop.click('#play').catch(() => {});
await desktop.waitForTimeout(10000);
await desktop.keyboard.down('KeyW');
await desktop.waitForTimeout(3000);
await desktop.screenshot({ path: '/tmp/claude-0/cdn-match.png' });

// And the same URL on a phone.
const ctx = await b.newContext({ ...devices['Pixel 5 landscape'], hasTouch: true, isMobile: true });
const phone = await ctx.newPage();
await phone.goto(url, { waitUntil: 'load', timeout: 60000 });
await phone.waitForTimeout(3500);
await phone.screenshot({ path: '/tmp/claude-0/cdn-phone.png' });

console.log('menu:', ok ? 'OK' : 'FAIL', '| errors:', errs.length ? errs.slice(0, 5).join(' | ') : 'none');
await b.close();
