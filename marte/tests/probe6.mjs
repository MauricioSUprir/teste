import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 640, height: 360 } });
await p.goto('http://localhost:4173/?debug=1&quality=low');
await p.waitForFunction(() => window.__ready === true, null, { timeout: 240000 });
for (const [h, pitch, lamp] of [[3.1, 0, false], [3.1, 60, false], [3.1, 60, true], [22.5, 25, true]]) {
  const r = await p.evaluate(([h, pitch, lamp]) => { __debug.freeze(true); __debug.play(); __debug.lamp(lamp); __debug.setTime(h); __debug.look(180, pitch); __debug.renderOnce(0); const g = __game; return { exp: g.exposure, skyLum: g.skyLum, sunAlt: g.sky0.sunAlt, camY: g.camera.position.y, fogD: 0 }; }, [h, pitch, lamp]);
  await p.screenshot({ path: `test-output/probe_${h}_${pitch}_${lamp}.png` });
  console.log(h, pitch, lamp, JSON.stringify(r));
}
await b.close();
