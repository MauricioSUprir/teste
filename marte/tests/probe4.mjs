import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 640, height: 360 } });
await p.goto('http://localhost:4173/?debug=1&quality=low');
await p.waitForFunction(() => window.__ready === true, null, { timeout: 200000 });
const r = await p.evaluate(() => {
  const g = window.__game; __debug.freeze(true);
  const rt = g.envRT; const w = rt.width, h = rt.height;
  const buf = new Uint16Array(4);
  const res = { w, h, type: rt.texture.type, samples: [] };
  const H = (x) => { const s = (x & 0x8000) >> 15, e = (x & 0x7C00) >> 10, f = x & 0x03FF; return (s ? -1 : 1) * (e === 0 ? Math.pow(2, -14) * (f / 1024) : e === 31 ? NaN : Math.pow(2, e - 15) * (1 + f / 1024)); };
  for (const [x, y] of [[w*0.1|0, h*0.1|0], [w*0.3|0, h*0.2|0], [w*0.5|0, h*0.15|0], [w*0.8|0, h*0.2|0], [w*0.2|0, h*0.6|0], [w*0.5|0, h*0.7|0]]) {
    g.renderer.readRenderTargetPixels(rt, x, y, 1, 1, buf);
    res.samples.push([x, y, ...Array.from(buf.slice(0, 3)).map(v => +H(v).toFixed(3))]);
  }
  return res;
});
console.log(JSON.stringify(r));
await b.close();
