// prints de objetos de perto (módulo, caixas, rover, destroços, habitat) para avaliar texturas
import { chromium } from 'playwright-core';
const out = process.argv[2] || 'test-output/v3';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/CERT|fonts/.test(m.text())) errs.push(m.text()); });
await p.goto('http://localhost:4173/?debug=1&quality=' + (process.env.Q || 'high'));
await p.waitForFunction(() => window.__ready === true, null, { timeout: 400000 });
await p.evaluate(() => { __debug.newGame('normal'); __debug.freeze(true); const P = __debug.play_(); P.st.buildings.push({ id: 900, type: 'habitat', x: 14, z: 12, rot: 0.4, dust: 0 }, { id: 901, type: 'panel', x: 24, z: 6, rot: 0.2, dust: 0 }); P.world.sync(P.st); __debug.setTime(9.5); __debug.lamp(false); __debug.renderOnce(3); });
await p.addStyleTag({ content: '.subtitle, #hud { display: none !important; }' });
await p.evaluate(() => __debug.camera(true));
// câmera em primeira pessoa (astronauta oculto) em (x,z) mirando o ponto (tx,ty,tz)
const view = (name, x, z, tx, ty, tz) => shot(name, ([x, z, tx, ty, tz]) => {
  __debug.teleport(x, z);
  const eyeY = __game.player.pos.y + 1.68; const dx = tx - x, dz = tz - z, d = Math.hypot(dx, dz);
  const ty2 = ty ?? __game.terrain.heightAt(tx, tz) + 1;
  __game.player.yaw = Math.atan2(-dx, -dz); __game.player.pitch = Math.atan2(ty2 - eyeY, d);
}, [x, z, tx, ty, tz]);
const shot = async (name, fn, arg) => { await p.evaluate(fn, arg); await p.evaluate(() => __debug.renderOnce(0.2)); await p.screenshot({ path: `${out}/${name}.png`, timeout: 240000 }); console.log('shot', name); };
const hy = (x, z) => p.evaluate(([x, z]) => __game.terrain.heightAt(x, z), [x, z]);
await view('obj_lander', -1.5, 1.5, -8, (await hy(-8, -4)) + 2.2, -4);
await view('obj_lander_close', -4.6, -1.2, -8, (await hy(-8, -4)) + 1.4, -4);
const crate = await p.evaluate(() => { const c = __game.crash.crates[0]; return [c.x, c.z]; });
await view('obj_crate', crate[0] + 2.2, crate[1] + 1.6, crate[0], (await hy(crate[0], crate[1])) + 0.3, crate[1]);
await view('obj_rover', 20.5, -11.5, 16, (await hy(16, -16)) + 1.2, -16);
await view('obj_habitat', 21, 20, 14, (await hy(14, 12)) + 1.8, 12);
await view('obj_debris', 3, 11, 7, (await hy(7, 14)) + 0.2, 14);
await view('obj_perse', -205, 228, -210, (await hy(-210, 235)) + 1.0, 235);
await view('obj_viking', 474, -365, 470, (await hy(470, -360)) + 1.0, -360);
await view('obj_sev', 10, -9, 16, (await hy(16, -16)) + 1.6, -16);
await view('obj_pebbles', 40, 40, 41, (await hy(41, 43)), 43);
await shot('obj_interior', () => { __debug.play_().enterHab(); __game.player.teleport(0.8, 1.2, 0, 1500.05); __debug.look(-20, -12); });
console.log('erros:', errs.join('\n') || 'nenhum');
await b.close();
