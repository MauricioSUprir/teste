import { chromium } from 'playwright-core';
const W = +(process.env.W || 1280), H = +(process.env.H || 720);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: W, height: H } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/CERT|fonts/.test(m.text())) errs.push(m.text()); });
const check = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const Q = process.env.Q || 'low';
await p.goto(`http://localhost:4173/?debug=1&quality=${Q}`);
await p.waitForFunction(() => window.__ready === true, null, { timeout: 240000 });
await p.evaluate(() => { __debug.newGame('normal'); __debug.freeze(true); __debug.setTime(21.5); });
// habitat pronto ao lado do spawn
await p.evaluate(() => { const P = __debug.play_(); P.st.buildings.push({ id: 900, type: 'habitat', x: 12, z: 10, rot: 0, dust: 0 }); P.world.sync(P.st); });
await p.evaluate(() => __debug.play_().enterHab());
await p.evaluate(() => __debug.renderOnce(0.5));
let s = await p.evaluate(() => ({ inside: __game.inside, y: __game.player.pos.y, hab: __debug.play_().inHab, input: __game.input.enabled, sky: __game.sky.mesh.visible }));
check(s.inside && s.hab && s.input && !s.sky && s.y > 1400, `entrou andando no habitat (y=${s.y.toFixed(1)}, controle livre)`);
await p.screenshot({ path: 'test-output/v2/int_3p.png', timeout: 120000 });
// anda para dentro 2 s
await p.evaluate(() => { __game.input.move.y = 1; __debug.renderOnce(2); __game.input.move.y = 0; __debug.renderOnce(0.2); });
s = await p.evaluate(() => ({ z: __game.player.pos.z, y: __game.player.pos.y }));
check(s.z < 3 && s.y > 1499.5, `andou no piso (z=${s.z.toFixed(2)}, y=${s.y.toFixed(2)})`);
// não atravessa a parede: corre 6 s para o lado
await p.evaluate(() => { __game.player.yaw = -Math.PI / 2; __game.input.move.y = 1; __debug.renderOnce(6); __game.input.move.y = 0; });
s = await p.evaluate(() => Math.hypot(__game.player.pos.x, __game.player.pos.z));
await p.evaluate(() => { __game.player.teleport(0, 0, 0, 1500.05); __game.player.yaw = Math.PI * 0.75; __game.input.move.y = 1; __debug.renderOnce(6); __game.input.move.y = 0; });
s = await p.evaluate(() => Math.hypot(__game.player.pos.x, __game.player.pos.z));
check(s < 4.9, `parede segura o jogador (raio ${s.toFixed(2)} m)`);
// primeira pessoa olhando o console
await p.evaluate(() => { __debug.camera(true); __game.player.teleport(0.2, -2.2, 0, 1500.05); __debug.look(0, -8); __debug.renderOnce(0.6); });
await p.screenshot({ path: 'test-output/v2/int_console.png', timeout: 120000 });
await p.evaluate(() => { __debug.look(120, -10); __debug.renderOnce(0.1); });
await p.screenshot({ path: 'test-output/v2/int_bed.png', timeout: 120000 });
await p.evaluate(() => { __debug.look(-135, -10); __debug.renderOnce(0.1); });
await p.screenshot({ path: 'test-output/v2/int_garden.png', timeout: 120000 });
// usar o console
await p.evaluate(() => { __debug.look(0, -8); __game.player.teleport(0, -3.4, 0, 1500.05); __debug.renderOnce(0.1); __game.input.fire('interact'); __debug.renderOnce(0.1); });
s = await p.evaluate(() => __debug.play_().hud.habOpen);
check(s, 'console abre o painel de status');
await p.evaluate(() => { document.getElementById('hab-exit').click(); __debug.renderOnce(0.1); });
s = await p.evaluate(() => ({ open: __debug.play_().hud.habOpen, input: __game.input.enabled, inside: __game.inside }));
check(!s.open && s.input && s.inside, '"Voltar" fecha o painel e continua dentro');
// dormir na cama
const sol0 = await p.evaluate(() => __game.sol);
await p.evaluate(() => { __game.player.teleport(2.9, -0.6, 0, 1500.05); __debug.look(-90, 0); __debug.renderOnce(0.1); __game.input.fire('interact'); __debug.renderOnce(0.1); });
const sol1 = await p.evaluate(() => __game.sol);
check(sol1 > sol0 + 0.2, `dormiu na cama (sol ${sol0.toFixed(2)} → ${sol1.toFixed(2)})`);
// sair pela eclusa
await p.evaluate(() => { __game.player.teleport(0, 4.0, 0, 1500.05); __debug.look(180, 0); __debug.renderOnce(0.1); __game.input.fire('interact'); __debug.renderOnce(0.3); });
s = await p.evaluate(() => ({ inside: __game.inside, hab: __debug.play_().inHab, x: __game.player.pos.x, z: __game.player.pos.z, sky: __game.sky.mesh.visible }));
check(!s.inside && !s.hab && s.sky && Math.hypot(s.x - 12, s.z - 17.5) < 3, `saiu pela eclusa ao lado da porta (${s.x.toFixed(1)}, ${s.z.toFixed(1)})`);
// save feito dentro não guarda coordenadas do interior
await p.evaluate(() => { const P = __debug.play_(); P.enterHab(); P.persist(false); });
s = await p.evaluate(() => JSON.parse(JSON.parse(localStorage.getItem('ares.save.v1')).data).player);
check(s && s.y < 100, `salvar dentro guarda a posição da porta (y=${s?.y?.toFixed?.(1)})`);
console.log('erros:', errs.join('\n') || 'nenhum');
await b.close();
