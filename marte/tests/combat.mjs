import { chromium } from 'playwright-core';
const out = 'test-output/v5';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/CERT|fonts/.test(m.text())) errs.push(m.text()); });
const check = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
await p.goto('http://localhost:4173/?debug=1&quality=' + (process.env.Q || 'medium'));
await p.waitForFunction(() => window.__ready === true, null, { timeout: 400000 });
await p.addStyleTag({ content: '.subtitle { display: none !important; }' });
await p.evaluate(() => { __debug.newGame('normal'); __debug.freeze(true); const P = __debug.play_(); P.st.buildings.push({ id: 900, type: 'habitat', x: 90, z: 90, rot: 0, dust: 0 }); P.world.sync(P.st); P.st.objective = 4; __debug.setTime(22.8); __debug.renderOnce(1); });
// 1) primeiro contato roteirizado aparece à noite
await p.evaluate(() => { const C = __debug.play_().combat; C.spawnT = 0; __debug.renderOnce(3); });
let s = await p.evaluate(() => ({ n: __debug.play_().combat.creatures.list.length, fc: !!__debug.play_().st.flags.firstContact, scripted: __debug.play_().combat.creatures.list[0]?.scripted }));
check(s.n === 1 && s.fc && s.scripted, `primeiro contato: 1 criatura roteirizada surgiu (${JSON.stringify(s)})`);
// 2) aproxima e mostra a criatura de perto (noite, bioluminescência)
await p.evaluate(() => { const c = __debug.play_().combat.creatures.list[0]; const P = __game.player.pos; c.pos.set(P.x + 0, 0, P.z - 5); c.state = 'chase'; c.t = 0; __game.player.yaw = 0; __game.player.pitch = -0.18; __debug.camDist(3.2); __debug.renderOnce(0.35); });
await p.screenshot({ path: `${out}/c_noite.png`, timeout: 240000 });
// 3) a criatura ataca: aviso (windup) e dano no jogador
const hp0 = await p.evaluate(() => __debug.play_().st.suit.health);
await p.evaluate(() => { __debug.renderOnce(4); });
const hp1 = await p.evaluate(() => __debug.play_().st.suit.health);
check(hp1 < hp0 && hp0 - hp1 <= 24, `criatura atacou com aviso: saúde ${hp0.toFixed(0)} → ${hp1.toFixed(1)}`);
// 4) cortador de plasma (corpo a corpo) acerta e faz fugir com 50% (roteiro)
await p.evaluate(() => { const c = __debug.play_().combat.creatures.list[0]; const P = __game.player.pos; c.pos.set(P.x, 0, P.z - 1.6); c.state = 'chase'; __game.player.yaw = 0; __game.input.fire('fire'); __debug.renderOnce(0.05); __game.input.fire('fire'); __debug.renderOnce(0.6); __game.input.fire('fire'); __debug.renderOnce(0.1); });
s = await p.evaluate(() => { const c = __debug.play_().combat.creatures.list[0]; return c ? { hp: c.hp, st: c.state } : null; });
check(s && s.hp < 60 && (s.st === 'flee' || s.hp <= 30), `cortador acertou; criatura roteirizada foge (${JSON.stringify(s)})`);
// 5) pistola: fabrica na bancada e mata uma criatura à distância
await p.evaluate(() => { const P = __debug.play_(); P.st.inv.scrap = 20; P.st.inv.electronics = 10; P.craftWeapon('pistol'); });
s = await p.evaluate(() => __debug.play_().st.weapons);
check(s.owned.includes('pistol') && s.eq === 'pistol', 'pistola fabricada e equipada');
await p.evaluate(() => { const C = __debug.play_().combat; C.creatures.clear(); const P = __game.player.pos; const c = C.creatures.spawn(P.x, P.z - 12); c.state = 'hunt'; c.t = 0; __game.player.yaw = 0; __debug.camera(false); __debug.renderOnce(0.2); });
for (let i = 0; i < 12; i++) await p.evaluate(() => { const c = __debug.play_().combat.creatures.list[0]; if (!c) return; const cam = __game.camera; const d = c.pos.clone().setY(c.pos.y + 0.25).sub(cam.position); __game.player.yaw = Math.atan2(-d.x, -d.z); __game.player.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); __debug.renderOnce(0.02); __game.input.fire('fire'); __debug.renderOnce(0.34); });
await p.screenshot({ path: `${out}/c_pistola.png`, timeout: 240000 });
s = await p.evaluate(() => ({ list: __debug.play_().combat.creatures.list.map((c) => [c.state, c.hp]), kills: __debug.play_().st.stats2.kills, batt: __debug.play_().st.suit.batt, drops: __debug.play_().combat.creatures.drops.length }));
check(s.kills >= 1, `pistola matou a criatura (abates=${s.kills}, estado=${JSON.stringify(s.list)})`);
await p.evaluate(() => __debug.renderOnce(1.5));
s = await p.evaluate(() => __debug.play_().combat.creatures.drops.length);
check(s >= 1, `deixou quitina no chão (${s})`);
// 6) coleta automática
await p.evaluate(() => { const d = __debug.play_().combat.creatures.drops[0]; if (d) __debug.teleport(d.mesh.position.x, d.mesh.position.z); __debug.renderOnce(0.3); });
s = await p.evaluate(() => __debug.play_().st.inv.chitin);
check(s >= 1, `quitina coletada (${s})`);
// 7) bancada: melhoria de dano
await p.evaluate(() => { const P = __debug.play_(); P.st.inv.chitin = 20; P.st.inv.electronics = 10; P.upgradeWeapon('pistol', 'dmg'); });
s = await p.evaluate(() => __debug.play_().st.weapons.lvl.pistol.dmg);
check(s === 1, `melhoria de dano instalada (nível ${s})`);
// 8) energia: arma para em 20% da bateria
await p.evaluate(() => { const P = __debug.play_(); P.st.suit.batt = 1400 * 0.201; const C = P.combat; C.cd = 0; __game.input.fire('fire'); __debug.renderOnce(0.05); });
s = await p.evaluate(() => __debug.play_().st.suit.batt / 1400);
check(s > 0.2, `arma não drena a bateria abaixo de 20% (${(s * 100).toFixed(1)}%)`);
// 9) bancada visual
await p.evaluate(() => { const P = __debug.play_(); P.st.suit.batt = 1000; P.hud.openArmory(P.st); });
await p.screenshot({ path: `${out}/c_bancada.png`, timeout: 240000 });
await p.evaluate(() => __debug.play_().hud.closeArmory());
// 10) dia: criatura de perto à luz do sol
await p.evaluate(() => { __debug.setTime(10.5); const C = __debug.play_().combat; C.creatures.clear(); const P = __game.player.pos; const c = C.creatures.spawn(P.x + 1.5, P.z - 4); c.state = 'windup'; c.t = 0.3; __debug.camera(false); __debug.camDist(3.4); __game.player.yaw = -0.2; __game.player.pitch = -0.22; __debug.renderOnce(0.1); });
await p.screenshot({ path: `${out}/c_dia.png`, timeout: 240000 });
// save: armas persistem
await p.evaluate(() => __debug.play_().persist(false));
s = await p.evaluate(() => JSON.parse(JSON.parse(localStorage.getItem('ares.save.v1')).data).weapons);
check(s.owned.includes('pistol') && s.lvl.pistol.dmg === 1, 'armas e melhorias ficam salvas');
console.log('erros:', errs.join('\n') || 'nenhum');
await b.close();
