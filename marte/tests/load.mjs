import { chromium } from 'playwright-core';
// mede travadas do thread principal no carregamento (tarefas longas)
const port = process.argv[2] || '4173', q = process.argv[3] || 'high';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.addInitScript(() => { window.__lt = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ entryTypes: ['longtask'] }); });
const t0 = Date.now();
await p.goto(`http://localhost:${port}/?quality=${q}`);
await p.waitForFunction(() => window.__ready === true, null, { timeout: 600000 });
await p.waitForTimeout(3000);
const lt = await p.evaluate(() => window.__lt);
lt.sort((a, c) => c[1] - a[1]);
console.log(port, q, 'pronto em', ((Date.now() - t0) / 1000).toFixed(1), 's; maiores travadas (início ms, duração ms):', JSON.stringify(lt.slice(0, 6)));
await b.close();
