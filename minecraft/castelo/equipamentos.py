"""Equipamentos e tesouros dos baús, como tabelas de loot do datapack.

Tabelas de loot (com set_enchantments / set_potion) funcionam do mesmo jeito em todas as
versões 1.21+, ao contrário do formato de itens encantados no NBT, que mudou várias vezes.
O baú guarda só o nome da tabela e é preenchido quando alguém o abre pela primeira vez.
"""
import json

import modelo as m

EQUIPAMENTO = {
    "netherite_helmet": {"protection": 4, "unbreaking": 3, "mending": 1, "respiration": 3, "aqua_affinity": 1},
    "netherite_chestplate": {"protection": 4, "unbreaking": 3, "mending": 1},
    "netherite_leggings": {"protection": 4, "unbreaking": 3, "mending": 1, "swift_sneak": 3},
    "netherite_boots": {"protection": 4, "feather_falling": 4, "depth_strider": 3, "soul_speed": 3,
                        "unbreaking": 3, "mending": 1},
    "netherite_sword": {"sharpness": 5, "looting": 3, "fire_aspect": 2, "sweeping_edge": 3,
                        "knockback": 2, "unbreaking": 3, "mending": 1},
    "netherite_axe": {"sharpness": 5, "efficiency": 5, "unbreaking": 3, "mending": 1},
    "netherite_pickaxe": {"efficiency": 5, "fortune": 3, "unbreaking": 3, "mending": 1},
    "netherite_shovel": {"efficiency": 5, "silk_touch": 1, "unbreaking": 3, "mending": 1},
    "bow": {"power": 5, "punch": 2, "flame": 1, "infinity": 1, "unbreaking": 3},
    "crossbow": {"quick_charge": 3, "multishot": 1, "unbreaking": 3, "mending": 1},
    "trident": {"loyalty": 3, "channeling": 1, "impaling": 5, "unbreaking": 3, "mending": 1},
    "mace": {"density": 5, "wind_burst": 3, "fire_aspect": 2, "unbreaking": 3, "mending": 1},
    "shield": {"unbreaking": 3, "mending": 1},
    "elytra": {"unbreaking": 3, "mending": 1},
}

DIAMANTE = {
    "diamond_helmet": {"protection": 4, "unbreaking": 3},
    "diamond_chestplate": {"protection": 4, "unbreaking": 3},
    "diamond_leggings": {"protection": 4, "unbreaking": 3},
    "diamond_boots": {"protection": 4, "feather_falling": 4, "unbreaking": 3},
    "diamond_sword": {"sharpness": 5, "unbreaking": 3},
    "bow": {"power": 4, "unbreaking": 3},
}


def _item(nome, qtd=1, encantos=None, pocao=None, titulo=None):
    funcs = []
    if qtd != 1:
        funcs.append({"function": "minecraft:set_count", "count": qtd})
    if encantos:
        funcs.append({"function": "minecraft:set_enchantments",
                      "enchantments": {f"minecraft:{k}": v for k, v in encantos.items()}})
    if pocao:
        funcs.append({"function": "minecraft:set_potion", "id": f"minecraft:{pocao}"})
    if titulo:
        funcs.append({"function": "minecraft:set_name", "name": titulo})
    entrada = {"type": "minecraft:item", "name": f"minecraft:{nome}"}
    if funcs:
        # até a 1.21.x o campo é "functions"; a partir da 26.x é "modifier" (com "type").
        # Cada versão ignora o campo que não conhece, então mandamos os dois.
        entrada["functions"] = funcs
        entrada["modifier"] = [{"type" if k == "function" else k: v for k, v in f.items()} for f in funcs]
    return {"rolls": 1, "entries": [entrada]}


def _tabela(itens):
    return {"type": "minecraft:chest", "pools": itens}


def _kit_armas(titulo):
    return [_item(n, encantos=e, titulo=f"{titulo}" if n == "netherite_sword" else None)
            for n, e in EQUIPAMENTO.items()]


def _kit_suprimentos():
    return [
        _item("totem_of_undying"), _item("totem_of_undying"),
        _item("enchanted_golden_apple", 8), _item("golden_apple", 32), _item("golden_carrot", 64),
        _item("ender_pearl", 16), _item("firework_rocket", 64), _item("arrow", 64), _item("spectral_arrow", 64),
        _item("splash_potion", pocao="strong_healing"), _item("splash_potion", pocao="strong_healing"),
        _item("splash_potion", pocao="strong_healing"), _item("potion", pocao="strong_strength"),
        _item("potion", pocao="strong_strength"), _item("potion", pocao="long_fire_resistance"),
        _item("potion", pocao="strong_regeneration"), _item("potion", pocao="long_swiftness"),
        _item("potion", pocao="long_night_vision"), _item("potion", pocao="long_water_breathing"),
        _item("potion", pocao="strong_turtle_master"), _item("cooked_beef", 64), _item("obsidian", 64),
        _item("end_crystal", 8), _item("respawn_anchor", 2), _item("glowstone", 16), _item("water_bucket"),
    ]


TABELAS = {
    "kit_netherite": _tabela(_kit_armas("Espada do Rei")),
    "suprimentos": _tabela(_kit_suprimentos()),
    "arsenal_diamante": _tabela([_item(n, encantos=e) for n, e in DIAMANTE.items()] +
                                [_item("arrow", 64), _item("shield"), _item("crossbow"), _item("golden_apple", 8)]),
    "quartel": _tabela([_item(n) for n in ("iron_helmet", "iron_chestplate", "iron_leggings", "iron_boots",
                                           "iron_sword", "shield", "bow")] +
                       [_item("arrow", 32), _item("bread", 16), _item("cooked_porkchop", 16)]),
    "tesouro": _tabela([_item("diamond", 64), _item("diamond", 64), _item("diamond", 64),
                        _item("netherite_ingot", 16), _item("netherite_block", 4), _item("emerald", 64),
                        _item("gold_block", 64), _item("enchanted_golden_apple", 16), _item("totem_of_undying"),
                        _item("totem_of_undying"), _item("totem_of_undying"), _item("elytra", encantos=EQUIPAMENTO["elytra"]),
                        _item("nether_star"), _item("heart_of_the_sea"), _item("beacon"),
                        _item("netherite_upgrade_smithing_template", 4), _item("shulker_box"), _item("shulker_box")]),
    "biblioteca": _tabela([_item("book", encantos={k: v}) for k, v in (
        ("mending", 1), ("protection", 4), ("sharpness", 5), ("efficiency", 5), ("unbreaking", 3),
        ("fortune", 3), ("looting", 3), ("feather_falling", 4), ("power", 5), ("silk_touch", 1),
        ("infinity", 1), ("respiration", 3), ("depth_strider", 3), ("frost_walker", 2), ("thorns", 3))] +
        [_item("experience_bottle", 64), _item("lapis_lazuli", 64)]),
    "pocoes": _tabela([_item("splash_potion", pocao=p) for p in ("strong_healing",) * 4] +
                      [_item("potion", pocao=p) for p in ("strong_strength", "strong_swiftness", "long_fire_resistance",
                                                          "long_invisibility", "long_night_vision", "strong_regeneration",
                                                          "long_slow_falling", "strong_leaping")] +
                      [_item("blaze_powder", 64), _item("nether_wart", 64), _item("glass_bottle", 16)]),
    "cozinha": _tabela([_item(n, q) for n, q in (("cooked_beef", 64), ("bread", 64), ("baked_potato", 64),
                                                ("pumpkin_pie", 32), ("cake", 1), ("golden_carrot", 32),
                                                ("cooked_salmon", 32), ("cookie", 64), ("honey_bottle", 16))]),
    "ferreiro": _tabela([_item(n, q) for n, q in (("iron_ingot", 64), ("iron_ingot", 64), ("gold_ingot", 64),
                                                 ("diamond", 32), ("netherite_ingot", 4), ("coal_block", 32),
                                                 ("netherite_upgrade_smithing_template", 2), ("anvil", 1),
                                                 ("lava_bucket", 1))]),
    "rei": _tabela(_kit_armas("Excalibur")),
}


def bau(x, y, z, facing, tabela, tipo="chest"):
    """Baú (ou barril) que se enche com a tabela de loot `castelo:<tabela>` ao ser aberto."""
    assert tabela in TABELAS, tabela
    estado = f"{tipo}[facing={facing},type=single,waterlogged=false]" if tipo == "chest" else f"{tipo}[facing={facing},open=false]"
    m.ordenado(x, y, z, estado, '{LootTable:"castelo:%s"}' % tabela)


def arquivos_datapack():
    return [(f"data/castelo/loot_table/{nome}.json", json.dumps(t, indent=1, ensure_ascii=False))
            for nome, t in TABELAS.items()]


def teste(pos_barril):
    """Gera cada tabela num barril de teste e confere um item-chave de cada uma."""
    chave = {"kit_netherite": "netherite_sword", "suprimentos": "totem_of_undying", "arsenal_diamante": "diamond_sword",
             "quartel": "iron_sword", "tesouro": "netherite_block", "biblioteca": "enchanted_book",
             "pocoes": "splash_potion", "cozinha": "cooked_beef", "ferreiro": "netherite_ingot", "rei": "mace"}
    passos = []
    for nome, item in chave.items():
        passos += [("cmd", "setblock {} minecraft:air", pos_barril),
                   ("cmd", "setblock {} minecraft:barrel", pos_barril),
                   ("cmd", f"loot replace block {{}} container.0 loot castelo:{nome}", pos_barril),
                   ("espera", 1),
                   ("dados", pos_barril, 'Items[{id:"minecraft:%s"}]' % item, f"tabela '{nome}' tem {item}")]
    passos.append(("dados", pos_barril, 'Items[{id:"minecraft:mace",components:{"minecraft:enchantments":{}}}]',
                   "maça gerada com encantamentos"))
    return {"nome": "Baús equipados (tabelas de loot)", "passos": passos}
