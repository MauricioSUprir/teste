import { chromium } from 'playwright-core';
// Civilização: antena chama colonos → nave espera requisitos → pousa → colonos andam → ataque à colônia com torre → 20 colonos = vitória
const out = 'test-output/v6';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 }, locale: 'pt-BR' });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const check = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
await p.goto('http://localhost:4173/?debug=1&quality=' + (process.env.Q || 'low'));
await p.waitForFunction(() => window.__ready === true, null, { timeout: 400000 });
await p.addStyleTag({ content: '.subtitle { display: none !important; }' });
const H = { x: 30, z: 40 };
await p.evaluate((H) => {
  __debug.newGame('normal'); __debug.freeze(true);
  const P = __debug.play_(), S = P.st;
  let id = 900; const add = (type, dx, dz, rot = 0) => S.buildings.push({ id: id++, type, x: H.x + dx, z: H.z + dz, rot, dust: 0 });
  add('habitat', 0, 0); add('panel', 9, -3); add('panel', 9, 1); add('panel', 9, 5); add('moxie', -8, -2); add('bioreactor', -8, 3);
  P.world.sync(S);
  S.flags.computer = true; S.flags.firstContact = true; S.looted.push('crate0');
  S.objective = 13; S.antennaFixedSol = S.sol; S.hab.batt = S.hab.battCap;
  __debug.setTime(9); __debug.teleport(H.x + 4, H.z + 16); __debug.renderOnce(0.5);
}, H);
let s = await p.evaluate(() => ({ c: __debug.play_().st.colony, obj: __debug.play_().st.objective, txt: document.querySelector('.objective')?.textContent }));
check(s.c.nextSol !== null, `antena chamou colonos: 1ª nave marcada (${JSON.stringify(s.c)})`);
check(/👥 1\/4/.test(s.txt ?? ''), `objetivo mostra população (${s.txt})`);
// sem módulo residencial: nave espera em órbita
await p.evaluate(() => { __game.sol += 1.05; __debug.renderOnce(0.3); });
s = await p.evaluate(() => ({ c: __debug.play_().st.colony, w: __debug.play_().st.flags.wait0 }));
check(s.w && s.c.landing === 0 && s.c.ships === 0, 'sem camas: nave espera em órbita (sem punição)');
// PC mostra requisitos
await p.evaluate(() => __debug.play_().togglePC(true));
await p.waitForTimeout(200);
check(await p.evaluate(() => /Camas/.test(document.querySelector('.pc-col')?.textContent ?? '')), 'computador mostra a seção Colônia com requisitos');
await p.screenshot({ path: `${out}/col_pc.png`, timeout: 240000 });
await p.evaluate(() => __debug.play_().togglePC(false));
// constrói módulo residencial → nave desce
await p.evaluate((H) => { const P = __debug.play_(), S = P.st; S.buildings.push({ id: 950, type: 'residence', x: H.x - 2, z: H.z - 12, rot: 0.3, dust: 0 }); P.world.sync(S); __debug.renderOnce(0.3); }, H);
s = await p.evaluate(() => __debug.play_().st.colony.landing);
check(s > 0, `com os requisitos, a nave começa a descer (${s})`);
// câmera olhando a nave descendo
await p.evaluate(() => { const pad = __debug.play_().colony.ship.position; const pl = __game.player.pos; const d = pad.clone().sub(pl); __game.player.yaw = Math.atan2(-d.x, -d.z); __game.player.pitch = 0.25; __debug.camDist(5); for (let i = 0; i < 16; i++) __debug.renderOnce(0.5); });
await p.screenshot({ path: `${out}/col_pouso.png`, timeout: 240000 });
const scrap0 = await p.evaluate(() => __debug.play_().st.inv.scrap);
for (let i = 0; i < 8; i++) await p.evaluate(() => __debug.renderOnce(0.5));
s = await p.evaluate(() => ({ c: __debug.play_().st.colony, scrap: __debug.play_().st.inv.scrap }));
check(s.c.pop === 4 && s.c.ships === 1 && s.scrap === scrap0 + 8, `nave pousou: 4 colonos + carga (${JSON.stringify(s)})`);
// colonos andando
for (let i = 0; i < 6; i++) await p.evaluate(() => __debug.renderOnce(0.5));
s = await p.evaluate(() => __debug.play_().colony.people.count);
check(s === 3, `3 colonos andando na base (${s})`);
await p.evaluate((H) => { __debug.teleport(H.x + 14, H.z + 14); const d = { x: -14, z: -18 }; __game.player.yaw = Math.atan2(-d.x, -d.z); __game.player.pitch = -0.15; __debug.camDist(5.5); __debug.renderOnce(0.2); }, H);
await p.screenshot({ path: `${out}/col_base.png`, timeout: 240000 });
// ataque à colônia à noite, torre atira
await p.evaluate((H) => { const P = __debug.play_(), S = P.st; S.buildings.push({ id: 960, type: 'turret', x: H.x + 6, z: H.z + 9, rot: 0, dust: 0 }); P.world.sync(S); __debug.setTime(22.5); __debug.renderOnce(0.2); }, H);
s = await p.evaluate(() => ({ raid: __debug.play_().combat.raidActive, sol: __debug.play_().st.colony.raidSol }));
check(s.raid, `à noite, alerta de ataque à colônia (${JSON.stringify(s)})`);
for (let i = 0; i < 44; i++) await p.evaluate(() => __debug.renderOnce(0.5));
s = await p.evaluate(() => { const L = __debug.play_().combat.creatures.list; return { n: L.filter((c) => c.raid).length, hurt: L.filter((c) => c.raid && c.hp < 60).length, kills: __debug.play_().st.stats2?.kills ?? 0 }; });
check(s.n + s.kills >= 2, `criaturas vieram atacar a colônia (${JSON.stringify(s)})`);
// torre: criatura a 14 m dela
const tk = await p.evaluate(() => { const P = __debug.play_(); const t = [...P.world.turrets.values()][0]; const c = P.combat.creatures.spawn(t.pos.x + 14, t.pos.z, false); c.state = 'hunt'; c.t = 0; c.raid = t.pos.clone(); const k0 = P.st.stats2?.kills ?? 0; for (let i = 0; i < 10; i++) __debug.renderOnce(0.3); return { hp: c.hp, alive: c.alive && c.state !== 'dead', k: (P.st.stats2?.kills ?? 0) - k0 }; });
check(tk.hp < 60 || tk.k > 0, `torre de defesa acertou a criatura (${JSON.stringify(tk)})`);
await p.evaluate((H) => { const t = [...__debug.play_().world.turrets.values()][0]; __debug.teleport(H.x + 2, H.z + 20); const d = t.pos.clone().sub(__game.player.pos); __game.player.yaw = Math.atan2(-d.x, -d.z); __game.player.pitch = -0.05; __debug.renderOnce(0.1); }, H);
await p.screenshot({ path: `${out}/col_ataque.png`, timeout: 240000 });
// vitória: 20 colonos
await p.evaluate((H) => {
  const P = __debug.play_(), S = P.st; P.combat.creatures.clear();
  let id = 970; const add = (type, dx, dz) => S.buildings.push({ id: id++, type, x: H.x + dx, z: H.z + dz, rot: 0, dust: 0 });
  for (let i = 0; i < 4; i++) add('residence', -25 + i * 9, 22);
  for (let i = 0; i < 3; i++) add('moxie', -18 + i * 3, -14);
  for (let i = 0; i < 2; i++) add('bioreactor', 14, -12 + i * 4);
  for (let i = 0; i < 4; i++) add('panel', 18, 2 + i * 4);
  add('turret', -12, 12);
  P.world.sync(S); S.colony.pop = 10; S.colony.ships = 2; __debug.setTime(10); S.colony.nextSol = 0; __debug.renderOnce(0.3);
}, H);
for (let i = 0; i < 30; i++) await p.evaluate(() => __debug.renderOnce(0.5));
await p.waitForTimeout(3000);
await p.evaluate(() => __debug.renderOnce(0.2));
s = await p.evaluate(() => ({ pop: __debug.play_().st.colony.pop, won: __debug.play_().won, title: document.querySelector('#end h1, #end .title, .endscreen h1')?.textContent }));
check(s.pop === 20 && s.won, `20 colonos: civilização fundada (${JSON.stringify(s)})`);
await p.screenshot({ path: `${out}/col_vitoria.png`, timeout: 240000 });
console.log('erros:', errs.join('\n') || 'nenhum');
await b.close();
