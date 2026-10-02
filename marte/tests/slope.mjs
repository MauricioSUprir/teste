import { chromium } from 'playwright-core';
// Andar morro acima: a velocidade não pode despencar em subidas suaves (antes caía em espiral quadro a quadro)
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 640, height: 360 } })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const check = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
await p.goto('http://localhost:4173/?debug=1&quality=low');
await p.waitForFunction(() => window.__ready === true, null, { timeout: 240000 });
await p.evaluate(() => { __debug.newGame('normal'); __debug.setTime(10); });
// acha uma rampa de 12–22° perto do pouso
const spot = await p.evaluate(() => {
  const T = __game.terrain; let best = null;
  for (let r = 10; r < 220 && !best; r += 6) for (let a = 0; a < 6.28 && !best; a += 0.3) {
    const x = Math.cos(a) * r, z = Math.sin(a) * r; if (!T.inBounds(x, z, 40)) continue;
    const n = T.normalAt(x, z); const deg = Math.acos(n.y) * 57.3;
    if (deg > 12 && deg < 22) {
      // rampa contínua: 8 m morro acima também inclinados
      const ux = -n.x, uz = -n.z, l = Math.hypot(ux, uz); let ok = true;
      for (let k = 1; k <= 8; k++) { const m = T.normalAt(x + ux / l * k, z + uz / l * k); const d = Math.acos(m.y) * 57.3; if (d < 8 || d > 26) ok = false; }
      if (ok) best = { x, z, deg, yaw: Math.atan2(-(ux / l), -(uz / l)) };
    }
  }
  return best;
});
check(!!spot, `rampa encontrada (${spot && spot.deg.toFixed(1)}°)`);
const run = (analog, mag, sprint) => p.evaluate(async ({ s, analog, mag, sprint }) => {
  __debug.teleport(s.x, s.z); const P = __game.player; P.yaw = s.yaw;
  const I = __game.input; I.analog = analog; I.sprint = sprint;
  const y0 = P.pos.y, x0 = P.pos.x, z0 = P.pos.z;
  let ax = 0, az = 0;
  for (let i = 0; i < 30; i++) { if (i === 15) { ax = P.pos.x; az = P.pos.z; } I.move.x = 0; I.move.y = mag; __debug.renderOnce(0.1); }
  const d = Math.hypot(P.pos.x - ax, P.pos.z - az) * 2; // velocidade de cruzeiro (últimos 1,5 s)
  I.move.y = 0; I.analog = false; I.sprint = false;
  return { v: d / 3, dy: P.pos.y - y0 };
}, { s: spot, analog, mag, sprint });
const flatSpot = { x: spot.x, z: spot.z, yaw: spot.yaw };
const walk = await run(false, 1, false);
check(walk.v > 1.3 && walk.dy > 0.3, `subida caminhando: ${walk.v.toFixed(2)} m/s, subiu ${walk.dy.toFixed(2)} m`);
const runr = await run(false, 1, true);
check(runr.v > 2.6, `subida correndo: ${runr.v.toFixed(2)} m/s`);
const joy = await run(true, 0.8, false);
check(joy.v > 1.5, `subida joystick 80%: ${joy.v.toFixed(2)} m/s`);
console.log('erros:', errs.join('\n') || 'nenhum');
await b.close();
