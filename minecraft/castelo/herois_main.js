// Heróis Marvel (e o Flash): o Relógio dos Heróis, os trajes e os poderes.
// Gerado por herois.py: as listas abaixo são preenchidas automaticamente.
import { world, system, ItemStack, EquipmentSlot, EntityDamageCause } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

const NS = "mv";
const HEROIS = /*HEROIS*/[];
const NOMES_PODERES = /*NOMES_PODERES*/{};
const RECARGA_PODERES = /*RECARGA_PODERES*/{};
const PECAS = [["capacete", EquipmentSlot.Head], ["peitoral", EquipmentSlot.Chest],
               ["calca", EquipmentSlot.Legs], ["botas", EquipmentSlot.Feet]];
const IGNORAR = { excludeTypes: ["minecraft:item", "minecraft:xp_orb", "minecraft:arrow", "minecraft:lightning_bolt",
                                 "minecraft:small_fireball", "minecraft:armor_stand", "minecraft:painting"],
                  excludeFamilies: ["player"] };

// ------------------------------------------------------------------ utilidades
function efeito(e, nome, ticks, nivel = 0) {
  try { e.addEffect(nome, ticks, { amplifier: nivel, showParticles: false }); } catch (err) { }
}
function particula(dim, id, loc) {
  try { dim.spawnParticle(id, loc); } catch (err) { }
}
function som(dim, id, loc) {
  try { dim.playSound(id, loc); } catch (err) { }
}
function soma(a, b, k = 1) { return { x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k }; }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z); }
function unit(v) { const n = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / n, y: v.y / n, z: v.z / n }; }

function rastro(e, ate, id) {
  // partículas em linha, da mão do herói até o alvo
  const de = e.getHeadLocation();
  const n = Math.min(40, Math.ceil(dist(de, ate)));
  for (let i = 1; i <= n; i++) particula(e.dimension, id, soma(de, unit({ x: ate.x - de.x, y: ate.y - de.y, z: ate.z - de.z }), i));
}
function alvoEntidade(e, alcance) {
  try {
    const hits = e.getEntitiesFromViewDirection({ maxDistance: alcance });
    for (const h of hits) {
      const t = h.entity;
      if (t && t.isValid && t.id !== e.id && !IGNORAR.excludeTypes.includes(t.typeId) && t.typeId !== "minecraft:player") return t;
    }
  } catch (err) { }
  return undefined;
}
function alvoBloco(e, alcance) {
  try {
    const h = e.getBlockFromViewDirection({ maxDistance: alcance });
    if (h) return h.block;
  } catch (err) { }
  return undefined;
}
function ponto(e, alcance) {
  // onde o herói está mirando: a entidade, o bloco ou um ponto no ar
  const t = alvoEntidade(e, alcance);
  if (t) return { loc: t.location, entidade: t };
  const b = alvoBloco(e, alcance);
  if (b) return { loc: { x: b.location.x + 0.5, y: b.location.y + 1, z: b.location.z + 0.5 }, bloco: b };
  return { loc: soma(e.getHeadLocation(), e.getViewDirection(), alcance) };
}
function ferir(alvo, dano, quem) {
  try { alvo.applyDamage(dano, { cause: EntityDamageCause.entityAttack, damagingEntity: quem }); }
  catch (err) { try { alvo.applyDamage(dano); } catch (e2) { } }
}
function empurrar(alvo, de, forca, cima = 0.4) {
  const d = unit({ x: alvo.location.x - de.x, y: 0, z: alvo.location.z - de.z });
  try { alvo.applyKnockback({ x: d.x * forca, z: d.z * forca }, cima); }
  catch (err) { try { alvo.applyImpulse({ x: d.x * forca * 0.5, y: cima, z: d.z * forca * 0.5 }); } catch (e2) { } }
}
function emVolta(e, raio) {
  return e.dimension.getEntities({ location: e.location, maxDistance: raio, ...IGNORAR }).filter(t => t.id !== e.id);
}
function impulso(e, frente, cima) {
  const d = e.getViewDirection();
  try { e.applyKnockback({ x: d.x * frente, z: d.z * frente }, Math.max(cima, d.y * frente + cima)); } catch (err) { }
}
function projetil(e, tipo, velocidade) {
  const d = e.getViewDirection();
  const p = e.dimension.spawnEntity(tipo, soma(e.getHeadLocation(), d, 1.5));
  try { p.applyImpulse({ x: d.x * velocidade, y: d.y * velocidade, z: d.z * velocidade }); } catch (err) { }
  return p;
}

// ------------------------------------------------------------------ os poderes
function raio(e, alcance, dano, part, extra) {
  const p = ponto(e, alcance);
  rastro(e, p.loc, part);
  if (p.entidade) { ferir(p.entidade, dano, e); if (extra) extra(p.entidade); }
  return p;
}
function voar(e, forca = 2.0) {
  impulso(e, forca, 0.7);
  efeito(e, "slow_falling", 100);
  particula(e.dimension, "minecraft:basic_flame_particle", e.location);
}
function teleportar(e, alcance, part) {
  const b = alvoBloco(e, alcance);
  const destino = b ? { x: b.location.x + 0.5, y: b.location.y + 1, z: b.location.z + 0.5 }
                    : soma(e.location, e.getViewDirection(), alcance * 0.5);
  particula(e.dimension, part, e.location);
  e.teleport(destino, { keepVelocity: false });
  particula(e.dimension, part, destino);
  som(e.dimension, "mob.endermen.portal", destino);
}
function golpe(e, alcance, dano, forca = 1.5) {
  const t = alvoEntidade(e, alcance);
  if (t) { ferir(t, dano, e); empurrar(t, e.location, forca); particula(e.dimension, "minecraft:critical_hit_emitter", t.location); }
  return t;
}
function areaDano(e, raioArea, dano, forca, part) {
  for (const t of emVolta(e, raioArea)) { ferir(t, dano, e); empurrar(t, e.location, forca, 0.6); }
  particula(e.dimension, part, e.location);
}
function prender(t, segundos) {
  efeito(t, "slowness", segundos * 20, 10);
  efeito(t, "weakness", segundos * 20, 2);
  const b = t.dimension.getBlock(t.location);
  if (b && b.isAir) {
    try {
      b.setType("minecraft:web");
      system.runTimeout(() => { try { if (b.typeId === "minecraft:web") b.setType("minecraft:air"); } catch (err) { } }, segundos * 20);
    } catch (err) { }
  }
}

const PODERES = {
  voo: e => voar(e), voo_martelo: e => voar(e, 2.4), jato: e => voar(e, 1.4),
  levitar: e => { efeito(e, "levitation", 30, 2); efeito(e, "slow_falling", 200); },
  repulsor: e => raio(e, 32, 8, "minecraft:blue_flame_particle"),
  rajada_fotonica: e => raio(e, 32, 10, "minecraft:basic_flame_particle"),
  raio_mistico: e => raio(e, 28, 8, "minecraft:basic_flame_particle"),
  raio_joia: e => raio(e, 32, 9, "minecraft:villager_happy"),
  rajada_optica: e => raio(e, 40, 12, "minecraft:redstone_wire_dust_particle", t => empurrar(t, e.location, 2.5)),
  blaster: e => raio(e, 28, 7, "minecraft:basic_flame_particle"),
  ferrao: e => raio(e, 20, 6, "minecraft:electric_spark_particle"),
  choque: e => raio(e, 12, 6, "minecraft:electric_spark_particle", t => efeito(t, "slowness", 60, 4)),
  raio_veloz: e => { const p = raio(e, 30, 8, "minecraft:electric_spark_particle"); e.dimension.spawnEntity("minecraft:lightning_bolt", p.loc); },
  magia_caos: e => raio(e, 30, 9, "minecraft:redstone_wire_dust_particle", t => efeito(t, "levitation", 60, 2)),
  telecinese: e => { const t = alvoEntidade(e, 30); if (t) { efeito(t, "levitation", 40, 4); system.runTimeout(() => ferir(t, 8, e), 40); } },
  missil: e => { const p = ponto(e, 64); rastro(e, p.loc, "minecraft:basic_smoke_particle"); e.dimension.createExplosion(p.loc, 3, { breaksBlocks: false, causesFire: false, source: e }); },
  granada: e => { const p = ponto(e, 24); system.runTimeout(() => e.dimension.createExplosion(p.loc, 2.5, { breaksBlocks: false, source: e }), 30); },
  flecha: e => projetil(e, "minecraft:arrow", 3),
  flecha_explosiva: e => { const p = ponto(e, 48); rastro(e, p.loc, "minecraft:basic_smoke_particle"); e.dimension.createExplosion(p.loc, 2.5, { breaksBlocks: false, source: e }); },
  bola_de_fogo: e => raio(e, 30, 8, "minecraft:basic_flame_particle", t => { try { t.setOnFire(5, true); } catch (err) { } }),
  teia: e => { const t = alvoEntidade(e, 30); if (t) { rastro(e, t.location, "minecraft:snowflake_particle"); prender(t, 5); } },
  balanco: e => {
    const b = alvoBloco(e, 48);
    if (!b) return impulso(e, 1.5, 0.6);
    const d = unit({ x: b.location.x - e.location.x, y: b.location.y - e.location.y, z: b.location.z - e.location.z });
    rastro(e, b.location, "minecraft:snowflake_particle");
    try { e.applyKnockback({ x: d.x * 3, z: d.z * 3 }, Math.max(0.5, d.y * 2 + 0.5)); } catch (err) { }
    efeito(e, "slow_falling", 60);
  },
  esticar: e => {
    const t = alvoEntidade(e, 14);
    if (t) { ferir(t, 5, e); empurrar(t, soma(t.location, unit({ x: t.location.x - e.location.x, y: 0, z: t.location.z - e.location.z }), 4), 2); }
    else PODERES.balanco(e);
  },
  escudo: e => {
    let n = 0;
    for (const h of e.getEntitiesFromViewDirection({ maxDistance: 24 })) {
      const t = h.entity;
      if (!t || t.typeId === "minecraft:player" || IGNORAR.excludeTypes.includes(t.typeId)) continue;
      ferir(t, 9, e); empurrar(t, e.location, 2); if (++n >= 3) break;
    }
    rastro(e, ponto(e, 24).loc, "minecraft:critical_hit_emitter");
    som(e.dimension, "random.anvil_land", e.location);
  },
  mjolnir: e => { const p = ponto(e, 48); e.dimension.spawnEntity("minecraft:lightning_bolt", p.loc); },
  relampago: e => {
    const p = ponto(e, 48);
    for (const [dx, dz] of [[0, 0], [3, 2], [-2, 3]]) {
      try { e.dimension.spawnEntity("minecraft:lightning_bolt", { x: p.loc.x + dx, y: p.loc.y, z: p.loc.z + dz }); } catch (err) { }
    }
  },
  esmagar: e => { areaDano(e, 7, 14, 3, "minecraft:huge_explosion_emitter"); som(e.dimension, "random.explode", e.location); },
  salto_hulk: e => { impulso(e, 3.5, 1.4); efeito(e, "slow_falling", 50); efeito(e, "resistance", 100, 4); },
  agilidade: e => { impulso(e, 1.8, 0.9); efeito(e, "speed", 200, 2); efeito(e, "jump_boost", 200, 3); },
  garras: e => golpe(e, 5, 11), garras_vibranium: e => golpe(e, 5, 10), katanas: e => golpe(e, 5, 10),
  soco_metal: e => golpe(e, 5, 13, 3),
  pulso_cinetico: e => areaDano(e, 6, 8, 3, "minecraft:sonic_explosion"),
  portal: e => teleportar(e, 64, "minecraft:basic_flame_particle"),
  teleporte: e => teleportar(e, 32, "minecraft:dragon_breath_trail"),
  atravessar: e => {
    const d = e.getViewDirection();
    for (let k = 6; k >= 2; k--) {
      const alvo = soma(e.location, { x: d.x, y: 0, z: d.z }, k);
      const b = e.dimension.getBlock(alvo), c = e.dimension.getBlock(soma(alvo, { x: 0, y: 1, z: 0 }));
      if (b && c && b.isAir && c.isAir) { e.teleport(alvo); return; }
    }
  },
  escudo_magico: e => { efeito(e, "resistance", 160, 4); areaDano(e, 5, 2, 2.5, "minecraft:totem_particle"); },
  campo_forca: e => { efeito(e, "resistance", 160, 4); areaDano(e, 5, 2, 3, "minecraft:endrod"); },
  campo_magnetico: e => { for (const t of emVolta(e, 12)) { efeito(t, "levitation", 40, 3); ferir(t, 6, e); } },
  ventania: e => areaDano(e, 10, 2, 4, "minecraft:cloud"),
  raizes: e => { for (const t of emVolta(e, 9)) { prender(t, 5); ferir(t, 4, e); } },
  cura_groot: e => {
    for (const p of e.dimension.getPlayers({ location: e.location, maxDistance: 10 })) { efeito(p, "regeneration", 120, 3); efeito(p, "instant_health", 1, 1); }
    particula(e.dimension, "minecraft:villager_happy", e.location);
  },
  encolher: e => { efeito(e, "invisibility", 400); efeito(e, "speed", 400, 3); },
  crescer: e => { efeito(e, "strength", 300, 3); efeito(e, "resistance", 300, 2); areaDano(e, 6, 10, 3, "minecraft:huge_explosion_emitter"); },
  drone: e => { const t = emVolta(e, 20)[0]; if (t) { rastro(e, t.location, "minecraft:redstone_wire_dust_particle"); ferir(t, 8, e); } },
  supervelocidade: e => { efeito(e, "speed", 200, 9); efeito(e, "jump_boost", 200, 2); },
  furia: e => { efeito(e, "strength", 200, 3); efeito(e, "speed", 200, 2); efeito(e, "regeneration", 200, 3); },
  disfarce: e => { efeito(e, "invisibility", 600); },
  invisivel: e => { efeito(e, "invisibility", 600); },
  fenix: e => {
    efeito(e, "fire_resistance", 400); efeito(e, "regeneration", 400, 3); efeito(e, "absorption", 400, 4); efeito(e, "levitation", 20, 1);
    areaDano(e, 8, 10, 3, "minecraft:huge_explosion_emitter");
    for (const t of emVolta(e, 8)) { try { t.setOnFire(5); } catch (err) { } }
  },
};

// ------------------------------------------------------------------ trajes e menu
function heroiDe(p) { return HEROIS.find(h => h.id === p.getDynamicProperty("heroi")); }

function limparPoderes(p) {
  const inv = p.getComponent("minecraft:inventory").container;
  for (let i = 0; i < inv.size; i++) {
    const it = inv.getItem(i);
    if (it && it.typeId.startsWith(`${NS}:poder_`)) inv.setItem(i, undefined);
  }
}

function tirarTraje(p) {
  const eq = p.getComponent("minecraft:equippable");
  for (const [, slot] of PECAS) {
    const it = eq.getEquipment(slot);
    if (it && it.typeId.startsWith(`${NS}:`)) eq.setEquipment(slot, undefined);
  }
  limparPoderes(p);
  p.setDynamicProperty("heroi", undefined);
}

function vestir(p, h) {
  const eq = p.getComponent("minecraft:equippable");
  const inv = p.getComponent("minecraft:inventory").container;
  tirarTraje(p);
  for (const [peca, slot] of PECAS) {
    const velho = eq.getEquipment(slot);
    if (velho) { const sobra = inv.addItem(velho); if (sobra) p.dimension.spawnItem(sobra, p.location); }  // guarda a armadura antiga
    eq.setEquipment(slot, new ItemStack(`${NS}:${h.id}_${peca}`));
  }
  p.setDynamicProperty("heroi", h.id);
  p.setDynamicProperty("poder", 0);
  p.sendMessage(`§eAgora você é o(a) §l${h.nome}§r§e! Poderes: §b${h.poderes.map(x => NOMES_PODERES[x]).join(", ")}`);
  p.sendMessage("§7Os poderes vêm com o traje: segure o §6Relógio§7 e toque para usar o poder. Agachado + toque abre o menu para trocar de poder ou de herói.");
  particula(p.dimension, "minecraft:totem_particle", p.location);
  som(p.dimension, "random.levelup", p.location);
}

// ------------------------------------------------------------------ poderes do traje (sem itens)
const prontoEm = new Map();

function poderAtual(p, h) {
  const i = Math.min(Math.max(0, p.getDynamicProperty("poder") || 0), h.poderes.length - 1);
  return h.poderes[i];
}

function usarPoder(p, h) {
  const pid = poderAtual(p, h);
  const chave = `${p.id}:${pid}`, agora = system.currentTick;
  const falta = (prontoEm.get(chave) || 0) - agora;
  if (falta > 0) {
    p.onScreenDisplay.setActionBar(`§c${NOMES_PODERES[pid]}: recarregando ${Math.ceil(falta / 20)}s`);
    return;
  }
  prontoEm.set(chave, agora + Math.max(4, Math.round((RECARGA_PODERES[pid] || 1) * 20)));
  try { PODERES[pid] && PODERES[pid](p); } catch (err) { console.warn(`poder ${pid}: ${err}`); }
}

function menuTraje(p, h) {
  const atual = poderAtual(p, h);
  const f = new ActionFormData().title(`§6${h.nome}`).body("Escolha o poder que o Relógio vai usar:");
  for (const pid of h.poderes) f.button((pid === atual ? "§2» " : "") + NOMES_PODERES[pid]);
  f.button("§9Trocar de herói");
  f.button("§cTirar o traje");
  f.show(p).then(r => {
    if (r.canceled || r.selection === undefined) return;
    if (r.selection < h.poderes.length) {
      p.setDynamicProperty("poder", r.selection);
      p.onScreenDisplay.setActionBar(`§bPoder escolhido: ${NOMES_PODERES[h.poderes[r.selection]]}`);
    } else if (r.selection === h.poderes.length) abrirMenuHerois(p);
    else { tirarTraje(p); p.sendMessage("§7Você voltou a ser você mesmo."); }
  }).catch(() => { });
}

function abrirMenu(p) {
  const h = heroiDe(p);
  if (h) return menuTraje(p, h);
  abrirMenuHerois(p);
}

function abrirMenuHerois(p) {
  const f = new ActionFormData().title("§6Relógio dos Heróis").body("Escolha o seu herói:");
  for (const h of HEROIS) f.button(h.nome, `textures/items/${h.id}_capacete`);
  f.button("§cTirar o traje");
  f.show(p).then(r => {
    if (r.canceled || r.selection === undefined) return;
    if (r.selection === HEROIS.length) { tirarTraje(p); p.sendMessage("§7Você voltou a ser você mesmo."); return; }
    vestir(p, HEROIS[r.selection]);
  }).catch(() => { });
}

function darRelogio(p) {
  const inv = p.getComponent("minecraft:inventory").container;
  for (let i = 0; i < inv.size; i++) { const it = inv.getItem(i); if (it && it.typeId === `${NS}:relogio`) return; }
  inv.addItem(new ItemStack(`${NS}:relogio`));
}

// ------------------------------------------------------------------ eventos
const recarga = new Map();
world.afterEvents.itemUse.subscribe(({ source: p, itemStack }) => {
  if (!itemStack) return;
  const id = itemStack.typeId;
  if (id === `${NS}:relogio`) {
    const h = heroiDe(p);
    if (!h || p.isSneaking) return abrirMenu(p);
    return usarPoder(p, h);
  }
  if (!id.startsWith(`${NS}:poder_`)) return;
  const pid = id.slice(`${NS}:poder_`.length);
  const chave = `${p.id}:${pid}`, agora = system.currentTick;
  if ((recarga.get(chave) || 0) > agora) return;
  recarga.set(chave, agora + 4);
  try { PODERES[pid] && PODERES[pid](p); } catch (err) { console.warn(`poder ${pid}: ${err}`); }
});

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (initialSpawn) system.runTimeout(() => { try { darRelogio(player); } catch (err) { } }, 40);
});

system.afterEvents.scriptEventReceive.subscribe(ev => {
  if (ev.id === `${NS}:relogio` && ev.sourceEntity) darRelogio(ev.sourceEntity);
  if (ev.id === `${NS}:teste`) testar(ev.message);
});

// mostra o poder escolhido enquanto segura o relógio
system.runInterval(() => {
  for (const p of world.getAllPlayers()) {
    const h = heroiDe(p);
    if (!h) continue;
    let mao;
    try { mao = p.getComponent("minecraft:inventory").container.getItem(p.selectedSlotIndex); } catch (err) { continue; }
    if (!mao || mao.typeId !== `${NS}:relogio`) continue;
    const pid = poderAtual(p, h);
    const falta = (prontoEm.get(`${p.id}:${pid}`) || 0) - system.currentTick;
    p.onScreenDisplay.setActionBar(`§e${h.nome} §7| §b${NOMES_PODERES[pid]} ` +
      (falta > 0 ? `§c(${Math.ceil(falta / 20)}s)` : "§a(pronto)") + " §7| agache + toque: trocar");
  }
}, 10);

// efeitos passivos e escalada do Homem-Aranha
system.runInterval(() => {
  for (const p of world.getAllPlayers()) {
    const h = heroiDe(p);
    if (!h) continue;
    for (const [nome, nivel] of h.efeitos) efeito(p, nome, 80, nivel);
    if (h.id === "homem_aranha" && p.isJumping) {
      const d = p.getViewDirection();
      const frente = p.dimension.getBlock(soma(p.location, unit({ x: d.x, y: 0, z: d.z }), 0.8));
      if (frente && !frente.isAir && !frente.isLiquid) { try { p.applyKnockback({ x: 0, z: 0 }, 0.42); } catch (err) { } }
    }
  }
}, 10);

// ------------------------------------------------------------------ vilões
const VILOES = /*VILOES*/[];
const ARTEFATOS = /*ARTEFATOS*/[];
const proximoSpawn = new Map();

function jogadorPerto(dim, loc, raio) {
  return dim.getPlayers({ location: loc, maxDistance: raio })[0];
}

// covis: quando um jogador chega perto, o vilão aparece (e volta 5 minutos depois de derrotado)
system.runInterval(() => {
  const dim = world.getDimension("overworld");
  for (const v of VILOES) {
    const [x, y, z] = v.covil;
    const loc = { x: x + 0.5, y, z: z + 0.5 };
    if (!jogadorPerto(dim, loc, v.id === "galactus" ? 96 : 56)) continue;
    let vivos = [];
    try { vivos = dim.getEntities({ type: `${NS}:${v.id}`, location: loc, maxDistance: 160 }); } catch (err) { continue; }
    if (vivos.length) continue;
    if ((proximoSpawn.get(v.id) || 0) > system.currentTick) continue;
    try {
      const e = dim.spawnEntity(`${NS}:${v.id}`, loc);
      e.nameTag = `§c${v.nome}`;
      proximoSpawn.set(v.id, system.currentTick + 20 * 300);
      for (const p of dim.getPlayers({ location: loc, maxDistance: 64 })) p.sendMessage(`§4⚠ ${v.nome} apareceu!`);
    } catch (err) { }
  }
}, 100);

// ataques especiais dos vilões
const ATAQUES = {
  thanos: (e, p) => { e.dimension.spawnEntity("minecraft:lightning_bolt", p.location); efeito(e, "strength", 100, 2); },
  loki: (e, p) => { const d = p.getViewDirection(); e.teleport(soma(p.location, d, -3)); efeito(p, "nausea", 100); },
  ultron: (e, p) => { rastro(e, p.location, "minecraft:redstone_wire_dust_particle"); ferir(p, 6, e); },
  caveira_vermelha: (e, p) => { rastro(e, p.location, "minecraft:basic_smoke_particle"); ferir(p, 5, e); },
  duende_verde: (e, p) => e.dimension.createExplosion(p.location, 2, { breaksBlocks: false, source: e }),
  doutor_octopus: (e, p) => { empurrar(p, soma(p.location, unit({ x: p.location.x - e.location.x, y: 0, z: p.location.z - e.location.z }), 3), 2); ferir(p, 5, e); },
  venom: (e, p) => { impulsoPara(e, p.location, 2.5); efeito(p, "slowness", 60, 3); },
  electro: (e, p) => e.dimension.spawnEntity("minecraft:lightning_bolt", p.location),
  mysterio: (e, p) => { efeito(p, "blindness", 100); efeito(p, "nausea", 160); },
  abutre: (e, p) => { efeito(e, "levitation", 20, 2); system.runTimeout(() => { try { impulsoPara(e, p.location, 3); } catch (err) { } }, 25); },
  doutor_destino: (e, p) => { rastro(e, p.location, "minecraft:villager_happy"); ferir(p, 8, e); },
  hela: (e, p) => { for (let i = 0; i < 2; i++) e.dimension.spawnEntity("minecraft:skeleton", soma(e.location, { x: i * 2 - 1, y: 0, z: 1 })); },
  kang: (e, p) => { efeito(p, "slowness", 100, 3); efeito(p, "mining_fatigue", 100, 2); },
  killmonger: (e, p) => { efeito(e, "speed", 60, 2); ferir(p, 5, e); },
  ronan: (e, p) => e.dimension.createExplosion(p.location, 2.5, { breaksBlocks: false, source: e }),
  galactus: (e, p) => { for (const q of e.dimension.getPlayers({ location: e.location, maxDistance: 24 })) { efeito(q, "levitation", 40, 2); ferir(q, 8, e); } },
  carnificina: (e, p) => { impulsoPara(e, p.location, 2.5); efeito(p, "wither", 60, 1); },
  kraven: (e, p) => { efeito(e, "speed", 80, 3); prender(p, 3); },
  abominavel: (e, p) => { for (const q of e.dimension.getPlayers({ location: e.location, maxDistance: 7 })) { empurrar(q, e.location, 3, 0.8); ferir(q, 8, e); } },
  flash_reverso: (e, p) => { const d = p.getViewDirection(); e.teleport(soma(p.location, { x: -d.x, y: 0, z: -d.z }, 2)); ferir(p, 6, e); },
};
function impulsoPara(e, alvo, forca) {
  const d = unit({ x: alvo.x - e.location.x, y: 0, z: alvo.z - e.location.z });
  try { e.applyImpulse({ x: d.x * forca * 0.4, y: 0.5, z: d.z * forca * 0.4 }); } catch (err) { }
}
system.runInterval(() => {
  const dim = world.getDimension("overworld");
  let viloes = [];
  try { viloes = dim.getEntities({ families: ["vilao"] }); } catch (err) { return; }
  for (const e of viloes) {
    const id = e.typeId.slice(NS.length + 1);
    const p = jogadorPerto(dim, e.location, id === "galactus" ? 40 : 20);
    if (!p || Math.random() > 0.45 || !ATAQUES[id]) continue;
    try { ATAQUES[id](e, p); } catch (err) { }
  }
}, 60);

// ------------------------------------------------------------------ artefatos
system.runInterval(() => {                         // brilho em volta dos artefatos ainda não pegos
  const dim = world.getDimension("overworld");
  for (const a of ARTEFATOS) {
    const [x, y, z] = a.local;
    const loc = { x: x + 0.5, y: y + 0.5, z: z + 0.5 };
    try { if (jogadorPerto(dim, loc, 24)) particula(dim, "minecraft:totem_particle", loc); } catch (err) { }
  }
}, 40);
function temArtefato(p, id) { return !!p.getDynamicProperty(`artefato_${id}`); }
system.runInterval(() => {
  for (const p of world.getAllPlayers()) {
    for (const a of ARTEFATOS) {
      const [x, y, z] = a.local;
      if (Math.abs(p.location.x - x - 0.5) < 2 && Math.abs(p.location.y - y) < 3 && Math.abs(p.location.z - z - 0.5) < 2) {
        if (temArtefato(p, a.id)) continue;
        p.getComponent("minecraft:inventory").container.addItem(new ItemStack(`${NS}:artefato_${a.id}`));
        p.setDynamicProperty(`artefato_${a.id}`, true);
        p.sendMessage(`§d✦ Você encontrou: §l${a.nome}§r§d!`);
        som(p.dimension, "random.levelup", p.location);
        particula(p.dimension, "minecraft:totem_particle", p.location);
      }
    }
  }
}, 10);

const DESTINOS = [["Castelo", { x: 0, y: 65, z: 96 }], ["Torre dos Vingadores", { x: 182, y: 262, z: -906 }],
  ["Times Square", { x: -90, y: 65, z: -880 }], ["Central Park", { x: -95, y: 65, z: -1110 }],
  ["Estátua da Liberdade", { x: -250, y: 65, z: -366 }], ["Maracanã", { x: 400, y: 72, z: 0 }],
  ["São Januário", { x: -250, y: 64, z: 128 }], ["Mansão X", { x: 600, y: 65, z: -1290 }]];
function menuViagem(p, titulo) {
  const f = new ActionFormData().title(titulo).body("Para onde você quer ir?");
  for (const [nome] of DESTINOS) f.button(nome);
  f.show(p).then(r => {
    if (r.canceled || r.selection === undefined) return;
    const [nome, loc] = DESTINOS[r.selection];
    p.teleport(loc);
    p.sendMessage(`§b✦ ${nome}!`);
  }).catch(() => { });
}
function inimigosPerto(e, raio) {
  return e.dimension.getEntities({ location: e.location, maxDistance: raio, families: ["monster"] });
}
const USOS_ARTEFATOS = {
  manopla: p => {
    for (const t of inimigosPerto(p, 48)) { particula(p.dimension, "minecraft:basic_smoke_particle", t.location); ferir(t, 60, p); }
    try { p.sendMessage("§6*estalo*"); } catch (err) { }
    som(p.dimension, "random.explode", p.location);
  },
  darkhold: p => { for (const t of inimigosPerto(p, 16)) { efeito(t, "wither", 120, 2); efeito(t, "darkness", 120); } },
  olho_agamotto: p => { world.setTimeOfDay(1000); efeito(p, "instant_health", 1, 4); efeito(p, "regeneration", 200, 2); },
  capa_levitacao: p => { efeito(p, "levitation", 40, 1); efeito(p, "slow_falling", 400); impulso(p, 1.2, 0.3); },
  livro_vishanti: p => { efeito(p, "resistance", 600, 3); efeito(p, "absorption", 600, 4); },
  mjolnir_artefato: p => PODERES.mjolnir(p),
  rompe_tormentas: p => menuViagem(p, "§6Ponte Bifrost"),
  tesseract: p => menuViagem(p, "§bTesseract"),
  lanca_odin: p => { const t = inimigosPerto(p, 48)[0]; if (t) { rastro(p, t.location, "minecraft:totem_particle"); ferir(t, 18, p); } },
  dez_aneis: p => areaDano(p, 9, 10, 3, "minecraft:blue_flame_particle"),
  cetro_loki: p => { for (const t of inimigosPerto(p, 14)) { efeito(t, "weakness", 600, 255); efeito(t, "slowness", 600, 4); } },
  capacete_magneto: p => { for (const ef of ["blindness", "nausea", "slowness", "wither", "darkness"]) { try { p.removeEffect(ef); } catch (err) { } } efeito(p, "resistance", 600, 1); },
  necroespada: p => raio(p, 20, 12, "minecraft:basic_smoke_particle", t => efeito(t, "wither", 100, 1)),
  erva_coracao: p => { efeito(p, "strength", 1200, 2); efeito(p, "speed", 1200, 2); efeito(p, "jump_boost", 1200, 1); efeito(p, "night_vision", 1200); },
  orbe_morag: p => { const pt = ponto(p, 48); p.dimension.createExplosion(pt.loc, 5, { breaksBlocks: false, source: p }); },
  forca_fenix: p => PODERES.fenix(p),
};
world.afterEvents.itemUse.subscribe(({ source: p, itemStack }) => {
  if (!itemStack || !itemStack.typeId.startsWith(`${NS}:artefato_`)) return;
  const id = itemStack.typeId.slice(`${NS}:artefato_`.length);
  const a = ARTEFATOS.find(x => x.id === id);
  const chave = `${p.id}:art:${id}`, agora = system.currentTick;
  if ((recarga.get(chave) || 0) > agora) { p.sendMessage("§7Ainda recarregando..."); return; }
  recarga.set(chave, agora + (a ? a.recarga : 2) * 20);
  try { USOS_ARTEFATOS[id] && USOS_ARTEFATOS[id](p); } catch (err) { console.warn(`artefato ${id}: ${err}`); }
});

// ------------------------------------------------------------------ teste no servidor (/scriptevent mv:teste x y z)
function testar(msg) {
  const [x, y, z] = msg.split(" ").map(Number);
  const dim = world.getDimension("overworld");
  const herois = HEROIS.length, poderes = Object.keys(PODERES).length;
  const faltam = Object.keys(NOMES_PODERES).filter(k => !PODERES[k]);
  console.warn(`TESTE herois=${herois} poderes=${poderes} faltam=${faltam.join(",") || "nenhum"}`);
  const alvo = dim.spawnEntity("minecraft:zombie", { x: x + 0.5, y, z: z + 6.5 });
  const heroi = dim.spawnEntity("minecraft:zombie", { x: x + 0.5, y, z: z + 0.5 });
  heroi.teleport({ x: x + 0.5, y, z: z + 0.5 }, { facingLocation: { x: x + 0.5, y: y + 1, z: z + 6.5 } });
  const erros = [];
  for (const [pid, f] of Object.entries(PODERES)) {
    try { f(heroi); } catch (err) { erros.push(`${pid}: ${err}`); }
    try { heroi.teleport({ x: x + 0.5, y, z: z + 0.5 }, { facingLocation: alvo.location }); } catch (err) { }
  }
  console.warn(`TESTE_PODERES erros=${erros.length} ${erros.join(" | ")}`);
  const errosV = [];
  for (const v of VILOES) {
    try {
      const e = dim.spawnEntity(`${NS}:${v.id}`, { x: x + 3.5, y, z: z + 3.5 });
      try { ATAQUES[v.id](e, alvo); } catch (err) { errosV.push(`${v.id} ataque: ${err}`); }
      e.remove();
    } catch (err) { errosV.push(`${v.id}: ${err}`); }
  }
  const errosA = [];
  for (const [id, f] of Object.entries(USOS_ARTEFATOS)) {
    if (["rompe_tormentas", "tesseract"].includes(id)) continue;
    try { f(heroi); } catch (err) { errosA.push(`${id}: ${err}`); }
  }
  console.warn(`TESTE_VILOES total=${VILOES.length} erros=${errosV.length} ${errosV.join(" | ")}`);
  console.warn(`TESTE_ARTEFATOS total=${ARTEFATOS.length} erros=${errosA.length} ${errosA.join(" | ")}`);
  system.runTimeout(() => {
    try { alvo.remove(); } catch (err) { }
    try { heroi.remove(); } catch (err) { }
    console.warn("TESTE_FIM");
  }, 60);
}
