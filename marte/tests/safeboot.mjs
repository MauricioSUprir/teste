import { chromium } from 'playwright-core';
// trava de segurança do carregamento: se o boot anterior não terminou, abre numa qualidade mais leve
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 960, height: 540 }, locale: 'pt-BR' });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const check = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
await p.goto('http://localhost:4173/?debug=1&quality=low');
await p.waitForFunction(() => window.__ready === true, null, { timeout: 300000 });
check(await p.evaluate(() => localStorage.getItem('ares.boot') === null), 'carregamento completo limpa a marca de boot');
// simula: boot anterior em "medium" travou
await p.evaluate(() => { localStorage.setItem('ares.boot', 'medium'); localStorage.removeItem('ares.prefs'); });
await p.goto('http://localhost:4173/?debug=1');
await p.waitForFunction(() => window.__ready === true, null, { timeout: 300000 });
const s = await p.evaluate(() => ({ q: __game.q.id, boot: localStorage.getItem('ares.boot'), prefs: JSON.parse(localStorage.getItem('ares.prefs') || '{}').quality }));
check(s.q === 'mobile' && s.boot === null && s.prefs === 'mobile', `boot travado em "medium" → abriu em "mobile" (${JSON.stringify(s)})`);
console.log('erros:', errs.join('\n') || 'nenhum');
await b.close();
