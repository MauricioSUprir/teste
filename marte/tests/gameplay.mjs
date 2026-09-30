// Teste automatizado do ciclo de jogo (etapa 2). node tests/gameplay.mjs [url]
import { chromium } from 'playwright-core';
const url = process.argv[2] || 'http://localhost:4173/?debug=1&quality=low';
const out = 'test-output';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/CERT|404/.test(m.text())) errs.push(m.text().slice(0, 300)); });
await p.goto(url);
await p.waitForFunction(() => window.__ready === true, null, { timeout: 240000 });
const ev = (f, a) => p.evaluate(f, a);
const step = async (sec = 0.5) => { await ev((s) => __debug.renderOnce(s), sec); };
const shot = async (n) => { await ev(() => __debug.renderOnce(0)); await p.screenshot({ path: `${out}/gp_${n}.png`, timeout: 180000 }); };
const state = () => ev(() => { const P = __debug.play_(); return { obj: P.st.objective, inv: P.st.inv, suit: P.st.suit, hab: P.st.hab, b: P.st.buildings.map((x) => x.type), inHab: P.inHab, pos: __game.player.pos.toArray().map((v) => +v.toFixed(1)) }; });
const check = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) process.exitCode = 1; };

await ev(() => { __debug.freeze(true); __debug.newGame('normal'); __debug.setTime(9); });
await step(1);
let s = await state();
check(s.obj === 0, `objetivo inicial = caixa (${s.obj})`);
await shot('01_inicio');
// vai até a caixa 0 e segura E
const c0 = await ev(() => { const l = __debug.play_().world.loot.find((x) => x.id === 'crate0'); return [l.pos.x, l.pos.z]; });
await ev(([x, z]) => { __debug.teleport(x + 1.4, z + 0.3); const g = __game; g.player.yaw = Math.atan2(-(x - g.player.pos.x), -(z - g.player.pos.z)); }, c0);
await step(0.3);
await shot('02_prompt_caixa');
await ev(() => __game.input.setHeld('interact', true));
await step(1.6);
await ev(() => __game.input.setHeld('interact', false));
s = await state();
check(s.inv.kit_habitat === 1 && s.inv.kit_panel === 1, `caixa aberta: kit habitat/painel (${JSON.stringify(s.inv)})`);
await step(0.3);
check(s.obj >= 1, `objetivo avançou para montar habitat (${s.obj})`);
// menu de construção
// computador de pulso: montado com a sucata da primeira caixa (libera construção)
s = await state();
check(s.inv.scrap >= 2, `caixa trouxe sucata para o computador (${s.inv.scrap})`);
await ev(() => { __debug.play_().togglePC(true); });
await step(0.1);
await shot('02_computador');
await ev(() => { __debug.play_().pcAction('assemble'); __debug.play_().togglePC(false); });
check(await ev(() => !!__debug.play_().st.flags.computer), 'computador de pulso montado');
await ev(() => __game.input.fire('build'));
await step(0.1);
await shot('03_menu_construcao');
await ev(() => __debug.play_().hud.onBuildPick('habitat'));
await ev(() => { __debug.teleport(14, 14); __game.player.yaw = 0.8; });
await step(0.3);
const valid = await ev(() => __debug.play_().world.ghostValid);
await shot('04_fantasma_habitat');
console.log('ghost valid:', valid);
if (!valid) { await ev(() => { __debug.teleport(30, 20); }); await step(0.3); }
await ev(() => __game.input.fire('interact'));
await step(0.3);
s = await state();
check(s.b.includes('habitat'), `habitat construído (${s.b})`);
await ev(() => { __debug.camDist(9); __game.player.pitch = -0.35; });
await step(0.5);
await shot('05_habitat');
// painel solar pelo kit
await ev(() => { __game.input.fire('build'); });
await step(0.1);
await ev(() => __debug.play_().hud.onBuildPick('panel'));
await ev(() => { const h = __debug.play_().world.habitat(__debug.play_().st); __debug.teleport(h.x + 9, h.z - 2); __game.player.yaw = -1.57; });
await step(0.3);
await ev(() => __game.input.fire('interact'));
await step(0.3);
s = await state();
check(s.b.includes('panel'), `painel instalado (${s.b})`);
// entra no habitat
const door = await ev(() => { const d = __debug.play_().world.doorPos(__debug.play_().st); return [d.x, d.z]; });
await ev(([x, z]) => { const h = __debug.play_().world.habitat(__debug.play_().st); __debug.teleport(x + Math.sin(h.rot) * 1.2, z + Math.cos(h.rot) * 1.2); __game.player.yaw = h.rot; }, door);
await step(0.3);
await shot('06_porta');
await ev(() => __game.input.fire('interact'));
await step(0.5);
s = await state();
check(s.inHab, 'entrou no habitat');
await step(3);
s = await state();
check(s.suit.o2 > 0.3, `traje reabastecendo O2 (${s.suit.o2.toFixed(3)})`);
await shot('07_habitat_painel');
await ev(() => __debug.play_().openConsole());
await ev(() => document.getElementById('hab-sleep').click());
await step(0.2);
s = await state();
console.log('após dormir', JSON.stringify(s.hab), 'suit', JSON.stringify(s.suit));
await shot('08_depois_de_dormir');
await ev(() => __debug.play_().exitHab());
await step(0.3);
await ev(() => __game.input.fire('map'));
await step(0.2);
await shot('09_mapa');
await ev(() => __game.input.fire('map'));
// salvamento
const saved = await ev(() => !!localStorage.getItem('ares.save.v1'));
check(saved, 'jogo salvo no localStorage');
// oxigênio acabando → morte
await ev(() => { const P = __debug.play_(); P.st.suit.o2 = 0.001; });
await step(32);
s = await state();
const dead = await ev(() => __debug.play_().dead);
check(dead, `morte por falta de O2 (saúde ${s.suit.health.toFixed(0)})`);
await shot('10_morte');
await ev(() => document.getElementById('end-respawn').click());
await step(0.5);
s = await state();
check(!(await ev(() => __debug.play_().dead)) && s.suit.health >= 60, 'renasceu do último salvamento');
console.log('erros:', errs.length ? [...new Set(errs)].join('\n') : 'nenhum');
await b.close();
