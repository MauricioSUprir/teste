// Controlador de combate: quando/onde as criaturas aparecem, armas (energia do traje), mira assistida no
// toque, dano ao jogador, coleta de quitina e o "primeiro contato" roteirizado. Não mexe nos índices de objetivos.
import * as THREE from 'three';
import type { Game } from '../game';
import type { GameState } from '../sim/state';
import { BAL } from '../sim/balance';
import { Creatures, type Crawler } from './creatures';
import { CombatVFX } from './vfx';
import { SPAWN, WEAPONS, WEAPON_BATT_FLOOR, WEAPON_ORDER, weaponStats, type WeaponId } from './defs';
import { sfx } from '../audio/sfx';

export interface CombatHooks {
  toast: (key: string, kind?: 'ok' | 'warn' | 'info', vars?: Record<string, string | number>) => void;
  say: (key: string) => void;
  hurt: (dmg: number, from: THREE.Vector3) => void;
  hitMarker: (kill: boolean) => void;
  threats: (list: { x: number; y: number; ang: number; behind: boolean; near: number }[]) => void;
  targetBar: (screen: { x: number; y: number } | null, frac: number) => void;
}

export class Combat {
  creatures: Creatures;
  vfx = new CombatVFX();
  private cd = 0;
  private spawnT = 8;
  private killCd = 0;
  private noPowerT = 0;
  private lastTarget: Crawler | null = null;
  private targetT = 0;
  hurtT = 99; // s desde o último dano (regeneração em campo)
  aimAssist = false;

  constructor(private game: Game, private st: () => GameState, private hooks: CombatHooks) {
    this.creatures = new Creatures(game.terrain);
    game.scene.add(this.creatures.group, this.vfx.group);
    // pré-compila os shaders de criatura/efeitos agora (sem travada no primeiro contato)
    const undo = this.creatures.warmup(game.scene);
    this.vfx.warm(true);
    game.renderer.compileAsync(game.scene, game.camera).catch(() => {}).finally(() => { undo(); this.vfx.warm(false); });
  }

  reset() { this.creatures.clear(); this.spawnT = 8; this.killCd = 0; this.cd = 0; }

  get weapon(): WeaponId { return this.st().weapons.eq; }
  cycleWeapon() {
    const w = this.st().weapons;
    const i = w.owned.indexOf(w.eq);
    w.eq = w.owned[(i + 1) % w.owned.length];
    sfx.click();
    this.hooks.toast(`w_${w.eq}`, 'info');
  }

  /** passo por quadro (só fora do habitat e fora de menus) */
  update(dt: number, o: { active: boolean; inside: boolean; driving: boolean; habitat: THREE.Vector3 | null; storm: boolean }) {
    const g = this.game, st = this.st();
    this.cd = Math.max(0, this.cd - dt);
    this.killCd = Math.max(0, this.killCd - dt);
    this.noPowerT = Math.max(0, this.noPowerT - dt);
    this.hurtT += dt;
    this.creatures.night = g.night;
    const night = g.night > 0.6;
    const P = g.player.pos;

    // ---- aparecimento
    const canSpawn = o.active && !o.inside && !o.driving && !!o.habitat && (night || o.storm);
    this.spawnT -= dt;
    if (canSpawn && this.spawnT <= 0) {
      this.spawnT = 15;
      const alive = this.creatures.alive().length;
      const nightN = Math.floor(st.sol);
      let limit = o.storm ? 4 : nightN >= 4 ? 3 : 2;
      if (st.difficulty === 'easy') limit = Math.max(1, limit - 1);
      if (st.difficulty === 'hard') limit += 1;
      if (!st.flags.firstContact && st.objective > 3) {
        // primeiro contato: um só, que foge com meia vida (ensina sem punir)
        if (this.spawnNear(P, o.habitat, true)) { st.flags.firstContact = true; this.hooks.say('vo_contact'); this.hooks.toast(g.input.touchMode ? 'tip_fire_touch' : 'tip_fire', 'info'); }
      } else if (st.flags.firstContact && this.killCd <= 0 && alive < limit) {
        const n = 1 + Math.floor(Math.random() * Math.min(2, limit - alive));
        for (let i = 0; i < n; i++) this.spawnNear(P, o.habitat, false);
      }
    }

    // ---- IA
    const retreat = st.suit.o2 / BAL.suitO2Cap < 0.15;
    const dmgMul = st.difficulty === 'easy' ? 0.6 : st.difficulty === 'hard' ? 1.4 : 1;
    const ev = this.creatures.update(dt, { player: P, canAttack: o.active && !o.inside && !o.driving, habitat: o.habitat, retreat, dmgMul, day: !night && !o.storm });
    if (ev.screech) sfx.screech();
    if (ev.windup) sfx.windup();
    if (ev.playerHit > 0) { this.hurtT = 0; this.hooks.hurt(ev.playerHit, P); }
    for (const c of ev.died) {
      const drop = { chitin: 1 + (Math.random() < 0.5 ? 1 : 0), electronics: Math.random() < 0.2 ? 1 : 0 };
      this.creatures.dropLoot(c.pos, drop);
      this.vfx.burst(c.pos.clone().setY(c.pos.y + 0.2), 14, 'ichor');
    }
    // coleta de quitina
    if (!o.inside && !o.driving) for (const got of this.creatures.collect(P, dt)) {
      st.inv.chitin += got.chitin; st.inv.electronics += got.electronics;
      sfx.pickup();
      this.hooks.toast('got_chitin', 'ok', { n: got.chitin, e: got.electronics ? ` · +${got.electronics} ${'⚙'}` : '' });
    }
    // regeneração leve em campo: 2 de saúde por minuto real após 10 s sem dano
    if (!o.inside && this.hurtT > 10 && st.suit.health > 0 && st.suit.health < 100) st.suit.health = Math.min(100, st.suit.health + (2 / 60) * dt);

    // ---- disparo
    if (o.active && !o.inside && !o.driving && g.input.enabled) {
      if (g.input.consume('weapon')) this.cycleWeapon();
      if (g.input.isHeld('fire') || g.input.consume('fire')) this.tryFire();
    } else g.input.consume('fire');
    this.vfx.update(dt);
    this.updateHud(dt, o.inside || o.driving);
  }

  private spawnNear(P: THREE.Vector3, hab: THREE.Vector3 | null, scripted: boolean) {
    const terr = this.game.terrain;
    for (let k = 0; k < 12; k++) {
      const a = Math.random() * Math.PI * 2;
      const d = scripted ? 38 : SPAWN.minDist + Math.random() * (SPAWN.maxDist - SPAWN.minDist);
      const x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d;
      if (!terr.inBounds(x, z, 40)) continue;
      if (hab && Math.hypot(x - hab.x, z - hab.z) < SPAWN.habitatSafe) continue;
      if (1 - terr.normalAt(x, z).y > 0.15) continue; // não nasce em paredões
      const c = this.creatures.spawn(x, z, scripted);
      if (c) { this.vfx.burst(new THREE.Vector3(x, terr.heightAt(x, z) + 0.1, z), 18, 'dust'); return c; }
    }
    return null;
  }

  private tryFire() {
    if (this.cd > 0) return;
    const g = this.game, st = this.st();
    const w = weaponStats(st.weapons.eq, st.weapons);
    // energia: armas param em 20% de bateria do traje (o aquecimento nunca fica sem energia)
    if (w.wh > 0) {
      const after = (st.suit.batt - w.wh) / BAL.suitBattCap;
      if (after < WEAPON_BATT_FLOOR) {
        if (this.noPowerT <= 0) { this.noPowerT = 2.5; sfx.click(); this.hooks.toast('weapon_nopower', 'warn'); }
        this.cd = 0.3;
        return;
      }
      st.suit.batt -= w.wh;
    }
    this.cd = w.cooldown;
    const P = g.player.pos;
    const cam = g.camera;
    if (w.melee) {
      // cortador: cone curto à frente; no toque, "gruda" no alvo mais próximo em 3,5 m / 45°
      let yaw = g.player.yaw;
      const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
      let best: Crawler | null = null, bd = this.aimAssist ? 3.5 : w.range;
      for (const c of this.creatures.alive()) {
        const to = new THREE.Vector3().subVectors(c.pos, P).setY(0); const d = to.length();
        if (d > bd || d < 1e-3) continue;
        if (to.divideScalar(d).dot(fwd) < (this.aimAssist ? 0.7 : 0.6)) continue;
        best = c; bd = d;
      }
      if (best) { yaw = Math.atan2(-(best.pos.x - P.x), -(best.pos.z - P.z)); if (this.aimAssist) g.player.yaw = yaw; }
      const bladePos = P.clone().setY(P.y + 1.05);
      this.vfx.slash(bladePos.addScaledVector(new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)), 0.4), yaw + Math.PI);
      sfx.zap();
      if (best && P.distanceTo(best.pos) <= w.range + (this.aimAssist ? 0.9 : 0.3)) this.hit(best, w.dmg, best.pos.clone().setY(best.pos.y + 0.25), P);
      return;
    }
    // armas de distância: raio pelo centro da tela (câmera)
    const o = cam.position.clone();
    const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
    if (this.aimAssist) {
      // cone de ~6° em até 40 m
      let best: Crawler | null = null, bc = Math.cos(THREE.MathUtils.degToRad(6));
      for (const c of this.creatures.alive()) {
        const to = c.pos.clone().setY(c.pos.y + 0.25).sub(o); const d = to.length();
        if (d > w.range) continue;
        const cs = to.divideScalar(d).dot(dir);
        if (cs > bc) { bc = cs; best = c; }
      }
      if (best) dir.copy(best.pos.clone().setY(best.pos.y + 0.25).sub(o).normalize());
    }
    const muzzle = P.clone().setY(P.y + 1.3).add(new THREE.Vector3(Math.cos(g.player.yaw), 0, -Math.sin(g.player.yaw)).multiplyScalar(0.3));
    const hitC = this.creatures.raycast(o, dir, w.range);
    const wall = g.physics.castRay(o, dir, w.range, g.player.collider);
    const wallT = wall ?? Infinity;
    if (st.weapons.eq === 'arc') sfx.arcShot(); else sfx.shot();
    if (hitC && hitC.t < wallT) {
      const at = o.clone().addScaledVector(dir, hitC.t);
      if (st.weapons.eq === 'arc') this.vfx.arc(muzzle, at); else this.vfx.tracer(muzzle, at);
      this.hit(hitC.c, w.dmg, at, P);
      // arco elétrico: salta para até 2 criaturas próximas (60% do dano)
      if (w.chain) {
        let from = hitC.c;
        const done = new Set([from.id]);
        for (let k = 0; k < w.chain; k++) {
          const nxt = this.creatures.alive().filter((c) => !done.has(c.id) && c.pos.distanceTo(from.pos) < 6).sort((a, b) => a.pos.distanceTo(from.pos) - b.pos.distanceTo(from.pos))[0];
          if (!nxt) break;
          done.add(nxt.id);
          this.vfx.arc(from.pos.clone().setY(from.pos.y + 0.3), nxt.pos.clone().setY(nxt.pos.y + 0.3));
          this.hit(nxt, w.dmg * 0.6, nxt.pos.clone().setY(nxt.pos.y + 0.3), from.pos);
          from = nxt;
        }
      }
    } else {
      const end = o.clone().addScaledVector(dir, Math.min(wallT, w.range));
      if (st.weapons.eq === 'arc') this.vfx.arc(muzzle, end); else this.vfx.tracer(muzzle, end);
      if (wall !== null) this.vfx.burst(end, 6, 'metal');
    }
  }

  private hit(c: Crawler, dmg: number, at: THREE.Vector3, from: THREE.Vector3) {
    const kill = this.creatures.damage(c, dmg, from);
    this.vfx.burst(at, kill ? 16 : 8, 'ichor');
    sfx.hitFlesh();
    this.hooks.hitMarker(kill);
    this.lastTarget = c; this.targetT = 2.5;
    if (kill) {
      const st = this.st();
      st.stats2 = { kills: (st.stats2?.kills ?? 0) + 1 };
      this.killCd = SPAWN.cooldownAfterKill;
      if (!st.flags.firstKill) { st.flags.firstKill = true; this.hooks.say('vo_firstkill'); }
    }
  }

  /** indicadores de ameaça na borda da tela + barra de vida do último alvo */
  private updateHud(dt: number, hidden: boolean) {
    const g = this.game, cam = g.camera;
    const out: { x: number; y: number; ang: number; behind: boolean; near: number }[] = [];
    if (!hidden) for (const c of this.creatures.alive()) {
      const d = c.pos.distanceTo(g.player.pos);
      if (d > 35 || c.state === 'emerge' || c.state === 'burrow') continue;
      const v = c.pos.clone().setY(c.pos.y + 0.3).project(cam);
      const on = v.z < 1 && Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.9;
      if (on) continue;
      let x = v.x, y = v.y;
      if (v.z > 1) { x = -x; y = -y; }
      const ang = Math.atan2(y, x);
      out.push({ x, y, ang, behind: v.z > 1, near: 1 - d / 35 });
    }
    this.hooks.threats(out);
    this.targetT -= dt;
    const t = this.lastTarget;
    if (!hidden && t && t.alive && t.state !== 'dead' && this.targetT > 0) {
      const v = t.pos.clone().setY(t.pos.y + 0.75).project(cam);
      this.hooks.targetBar(v.z < 1 ? { x: v.x, y: v.y } : null, t.hp / 60);
    } else this.hooks.targetBar(null, 0);
  }

  /** para a bancada: preço de fabricação e dono */
  canCraft(id: WeaponId) {
    const st = this.st(), c = WEAPONS[id].craft;
    if (!c || st.weapons.owned.includes(id)) return false;
    return Object.entries(c).every(([k, v]) => (st.inv as Record<string, number>)[k] >= (v as number));
  }
  static order = WEAPON_ORDER;
}
