import { chromium } from 'playwright-core';
// Colmeias: guardas aparecem e atacam DE DIA, colmeia leva tiro, é destruída, solta núcleos e volta a crescer
const out = 'test-output/v6';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const check = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
await p.goto('http://localhost:4173/?debug=1&quality=' + (process.env.Q || 'medium'));
await p.waitForFunction(() => window.__ready === true, null, { timeout: 400000 });
await p.addStyleTag({ content: '.subtitle { display: none !important; }' });
await p.evaluate(() => { __debug.newGame('normal'); __debug.freeze(true); const P = __debug.play_(); P.st.buildings.push({ id: 900, type: 'habitat', x: 2, z: 8, rot: 0, dust: 0 }); P.world.sync(P.st); P.st.objective = 4; P.st.flags.firstContact = true; P.st.flags.computer = true; __debug.setTime(10.5); __debug.renderOnce(0.5); });
// 1) chega perto da colmeia n1 de dia
await p.evaluate(() => { const n = __debug.play_().combat.nests.list[0]; __debug.teleport(n.pos.x, n.pos.z + 16); __game.player.yaw = 0; __game.player.pitch = -0.12; __debug.camDist(4.2); __debug.renderOnce(0.2); });
for (let i = 0; i < 8; i++) await p.evaluate(() => __debug.renderOnce(0.5));
let s = await p.evaluate(() => { const C = __debug.play_().combat; return { n: C.creatures.list.length, g: C.creatures.list.filter((c) => c.guard).length, st: C.creatures.list.map((c) => c.state), seen: !!__debug.play_().st.flags.nestSeen }; });
check(s.g >= 2, `guardas surgiram de dia (${JSON.stringify(s)})`);
check(s.seen, 'ARES avisou sobre a colmeia');
check(!s.st.includes('burrow'), 'guardas não se enterram de dia');
await p.screenshot({ path: `${out}/n_colmeia.png`, timeout: 240000 });
// 2) close de um guarda (olhos vermelhos, mandíbulas) de dia
await p.evaluate(() => { const C = __debug.play_().combat; const c = C.creatures.list[0]; const P = __game.player.pos; c.pos.set(P.x + 0.3, 0, P.z - 2.6); c.yaw = 0.15; c.state = 'windup'; c.t = 0.25; __game.player.yaw = 0; __game.player.pitch = -0.32; __debug.camera(true); __debug.renderOnce(0.05); });
await p.screenshot({ path: `${out}/n_guarda_dia.png`, timeout: 240000 });
await p.evaluate(() => __debug.camera(false));
// 3) eles atacam de dia
const hp0 = await p.evaluate(() => { __debug.play_().st.suit.health = 100; return 100; });
for (let i = 0; i < 8; i++) await p.evaluate(() => __debug.renderOnce(0.5));
const hp1 = await p.evaluate(() => __debug.play_().st.suit.health);
check(hp1 < hp0, `guardas atacaram de dia (saúde ${hp0} → ${hp1.toFixed(1)})`);
// 4) pistola contra a colmeia
await p.evaluate(() => { const P = __debug.play_(); P.combat.creatures.clear(); P.st.suit.health = 100; P.st.suit.batt = 1400; P.st.weapons.owned.push('pistol'); P.st.weapons.eq = 'pistol'; const n = P.combat.nests.list[0]; __debug.teleport(n.pos.x, n.pos.z + 12); __debug.camera(false); __debug.renderOnce(0.1); });
const aim = () => p.evaluate(() => { const n = __debug.play_().combat.nests.list[0]; const cam = __game.camera; const d = n.pos.clone().setY(n.pos.y + 0.9).sub(cam.position); __game.player.yaw = Math.atan2(-d.x, -d.z); __game.player.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); __debug.renderOnce(0.02); });
await aim();
const h0 = await p.evaluate(() => __debug.play_().combat.nests.list[0].hp);
for (let i = 0; i < 4; i++) { await aim(); await p.evaluate(() => { __debug.play_().combat.creatures.clear(); __game.input.fire('fire'); __debug.renderOnce(0.34); }); }
const h1 = await p.evaluate(() => __debug.play_().combat.nests.list[0].hp);
check(h1 < h0, `tiros acertam a colmeia (${h0} → ${h1})`);
await p.screenshot({ path: `${out}/n_tiro.png`, timeout: 240000 });
// 5) destrói (atalho) e coleta os núcleos
await p.evaluate(() => { const P = __debug.play_(); P.combat.hitNest(P.combat.nests.list[0], 999, P.combat.nests.list[0].pos.clone()); __debug.renderOnce(0.3); });
s = await p.evaluate(() => { const P = __debug.play_(); return { alive: P.combat.nests.list[0].alive, saved: P.st.nests, drops: P.combat.creatures.drops.length }; });
check(!s.alive && s.saved.n1 !== undefined && s.drops >= 1, `colmeia destruída e gravada no save (${JSON.stringify(s)})`);
await p.evaluate(() => { const d = __debug.play_().combat.creatures.drops.at(-1); __debug.teleport(d.mesh.position.x, d.mesh.position.z); __debug.renderOnce(0.3); });
s = await p.evaluate(() => __debug.play_().st.inv.core);
check(s === 2, `coletou 2 núcleos alienígenas (${s})`);
// 6) volta a crescer depois de 2 sóis
await p.evaluate(() => { __game.sol += 2.1; __debug.renderOnce(0.1); });
s = await p.evaluate(() => __debug.play_().combat.nests.list[0].alive);
check(s, 'colmeia voltou a crescer após 2 sóis');
console.log('erros:', errs.join('\n') || 'nenhum');
await b.close();
