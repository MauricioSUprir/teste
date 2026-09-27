import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:4173/?debug=1&quality=high');
await p.waitForFunction(() => window.__ready === true, null, { timeout: 240000 });
// procura um horário noturno com Fobos alto no céu
const r = await p.evaluate(() => {
  __debug.freeze(true); __debug.newGame('normal');
  let best = null;
  for (let h = 19; h < 29; h += 0.1) {
    __debug.setTime(h % 24);
    const d = __game.sky0.phobosDir, s = __game.sky0.sunAlt;
    if (s < -0.25 && d[1] > 0.35 && (!best || d[1] > best.y)) best = { h: h % 24, y: d[1], dir: d };
  }
  return best;
});
console.log('phobos', JSON.stringify(r));
if (r) {
  await p.evaluate((r) => { __debug.setTime(r.h); const d = r.dir; __game.player.yaw = Math.atan2(-d[0], -d[2]); __game.player.pitch = Math.asin(d[1]) - 0.15; __debug.camDist(4); __debug.lamp(true); __game.camera.fov = 45; __game.camera.updateProjectionMatrix(); }, r);
  for (let i = 0; i < 3; i++) await p.evaluate(() => __debug.renderOnce(0.2));
  await p.screenshot({ path: 'test-output/sky_phobos.png', timeout: 240000 });
}
await b.close();
