"""Versão Bedrock (PlayStation, Xbox, Switch, celular, Windows) do castelo.

O PlayStation não aceita arquivos de fora, mas consegue entrar num servidor Bedrock.
Este módulo traduz os blocos do modelo (escritos no formato Java) para o formato Bedrock
e gera um pacote de comportamento com as funções que constroem o castelo em coordenadas
fixas: o centro do castelo fica em (0, 64, 0) e o jogador nasce em (0, 64, 96).

construir_mundo_bedrock.py usa isso para construir o castelo num servidor oficial e
entregar o mundo já pronto (com os baús cheios).
"""
import json
import os
import zipfile

import modelo as m
import equipamentos as eq

Y0 = 64          # altura do chão do castelo no mundo Bedrock

FACE = {"down": 0, "up": 1, "north": 2, "south": 3, "west": 4, "east": 5}
ESCADA = {"east": 0, "west": 1, "south": 2, "north": 3}
DIRECAO = {"south": 0, "west": 1, "north": 2, "east": 3}     # beds, trapdoors, bells...
TRILHO = {"north_south": 0, "east_west": 1, "ascending_east": 2, "ascending_west": 3,
          "ascending_north": 4, "ascending_south": 5, "south_east": 6, "south_west": 7,
          "north_west": 8, "north_east": 9}
OPOSTO = {"north": "south", "south": "north", "east": "west", "west": "east"}

RENOMEAR = {
    "dirt_path": "grass_path", "note_block": "noteblock", "cobweb": "web", "magma_block": "magma",
    "powered_rail": "golden_rail", "tripwire": "trip_wire",
    "flowering_azalea_leaves": "azalea_leaves_flowered",
    "bricks": "brick_block", "terracotta": "hardened_clay", "oak_door": "wooden_door",
}
ITENS_BEDROCK = {"minecraft:spectral_arrow": "minecraft:arrow", "minecraft:shulker_box": "minecraft:undyed_shulker_box"}
# blocos sem equivalente simples no Bedrock (decoração que exige dados de bloco)
SEM_EQUIVALENTE = ("wall_banner", "piston_head")


def _props(nome):
    base, _, resto = nome.replace("minecraft:", "").partition("[")
    props = dict(p.split("=") for p in resto.rstrip("]").split(",")) if resto else {}
    return base, props


def _fmt(base, estados):
    if not estados:
        return f"minecraft:{base}"

    def v(x):
        if isinstance(x, bool):
            return "true" if x else "false"
        if isinstance(x, int):
            return str(x)
        return f'"{x}"'
    return f"minecraft:{base} [" + ",".join(f'"{k}"={v(x)}' for k, x in estados.items()) + "]"


def traduzir(nome):
    """Estado de bloco Java -> (bloco Bedrock para /setblock, ou None para pular)."""
    if nome == m.MANTER:
        return None
    base, p = _props(nome)
    if any(base.endswith(s) for s in SEM_EQUIVALENTE):
        return "minecraft:air"
    b = lambda k: p.get(k) == "true"
    e = {}
    if base.endswith("_stairs"):
        e = {"weirdo_direction": ESCADA[p.get("facing", "north")], "upside_down_bit": p.get("half") == "top"}
    elif base.endswith("_slab"):
        e = {"minecraft:vertical_half": "top" if p.get("type") == "top" else "bottom"}
    elif base == "ladder":
        e = {"facing_direction": FACE[p["facing"]]}
    elif base == "lantern":
        e = {"hanging": b("hanging")}
    elif base.endswith("_log") or base in ("hay_block", "quartz_pillar"):
        e = {"pillar_axis": p.get("axis", "y")}
    elif base.endswith("_bed"):
        return _fmt("bed", {"direction": DIRECAO[p["facing"]], "head_piece_bit": p["part"] == "head"})
    elif base.endswith("_door"):
        e = {"minecraft:cardinal_direction": p["facing"], "upper_block_bit": p["half"] == "upper",
             "door_hinge_bit": p.get("hinge") == "right", "open_bit": b("open")}
    elif base.endswith("_trapdoor"):
        e = {"direction": DIRECAO[p["facing"]], "upside_down_bit": p.get("half") == "top", "open_bit": b("open")}
    elif base in ("chest", "furnace", "smoker", "blast_furnace", "lectern", "anvil"):
        e = {"minecraft:cardinal_direction": p.get("facing", "north")}
        if base == "lectern":
            e["powered_bit"] = False
    elif base in ("barrel", "dispenser", "hopper"):
        e = {"facing_direction": FACE[p.get("facing", "down")]}
        if base == "barrel":
            e["open_bit"] = False
        if base == "dispenser":
            e["triggered_bit"] = False
        if base == "hopper":
            e["toggle_bit"] = p.get("enabled") == "false"
    elif base == "grindstone":
        e = {"attachment": "standing", "direction": DIRECAO[p.get("facing", "north")]}
    elif base == "campfire":
        e = {"minecraft:cardinal_direction": p.get("facing", "north"), "extinguished": False}
    elif base == "candle":
        e = {"candles": int(p.get("candles", 1)) - 1, "lit": b("lit")}
    elif base in ("water_cauldron", "lava_cauldron"):
        return _fmt("cauldron", {"fill_level": 6, "cauldron_liquid": "lava" if base == "lava_cauldron" else "water"})
    elif base.startswith("potted_"):
        return "minecraft:flower_pot"
    elif base.endswith("leaves"):
        e = {"persistent_bit": True}
    elif base == "farmland":
        e = {"moisturized_amount": 7}
    elif base in ("wheat", "carrots"):
        e = {"growth": 7}
    elif base == "lightning_rod":
        e = {"facing_direction": 1}
    elif base == "redstone_wire":
        e = {"redstone_signal": 0}
    elif base == "redstone_torch":
        return _fmt("redstone_torch" if b("lit") else "unlit_redstone_torch", {"torch_facing_direction": "top"})
    elif base == "redstone_wall_torch":
        return _fmt("redstone_torch" if b("lit") else "unlit_redstone_torch",
                    {"torch_facing_direction": OPOSTO[p["facing"]]})
    elif base == "repeater":
        return _fmt("unpowered_repeater", {"minecraft:cardinal_direction": p["facing"],
                                           "repeater_delay": int(p.get("delay", 1)) - 1})
    elif base == "comparator":
        return _fmt("unpowered_comparator", {"minecraft:cardinal_direction": p["facing"],
                                             "output_subtract_bit": False, "output_lit_bit": False})
    elif base == "lever":
        face, fac = p["face"], p["facing"]
        direcao = fac if face == "wall" else ("up_north_south" if face == "floor" else "down_north_south")
        e = {"lever_direction": direcao, "open_bit": b("powered")}
    elif base.endswith("_button"):
        face = p.get("face", "wall")
        e = {"facing_direction": FACE[p["facing"]] if face == "wall" else (1 if face == "floor" else 0),
             "button_pressed_bit": b("powered")}
    elif base == "sticky_piston":
        e = {"facing_direction": FACE[p["facing"]]}
    elif base == "tripwire_hook":
        e = {"direction": DIRECAO[p["facing"]], "attached_bit": b("attached"), "powered_bit": False}
    elif base == "tripwire":
        e = {"attached_bit": b("attached"), "disarmed_bit": False, "powered_bit": False, "suspended_bit": True}
    elif base == "bell":
        e = {"attachment": "standing", "direction": DIRECAO[p.get("facing", "north")], "toggle_bit": False}
    elif base == "daylight_detector":
        return "minecraft:daylight_detector_inverted" if b("inverted") else "minecraft:daylight_detector"
    elif base == "redstone_lamp":
        return "minecraft:lit_redstone_lamp" if b("lit") else "minecraft:redstone_lamp"
    elif base in ("rail", "powered_rail"):
        e = {"rail_direction": TRILHO[p["shape"]]}
        if base == "powered_rail":
            e["rail_data_bit"] = b("powered")
    elif base == "brewing_stand":
        e = {}
    elif base.endswith("_fence") or base.endswith("_pane") or base == "iron_bars":
        e = {}
    return _fmt(RENOMEAR.get(base, base), e)


# ---------------------------------------------------------------- comandos
DESLOC = [0, 0]   # deslocamento (x, z) da estrutura sendo exportada (estádios ficam ao lado do castelo)


def mundo(x, y, z):
    return x + DESLOC[0], Y0 + y, z + DESLOC[1]


def comandos(lista):
    """Converte as caixas do exportador em comandos Bedrock com coordenadas absolutas.

    Pistões estendidos não podem ser colocados no Bedrock: colocamos o pistão recolhido,
    com o bloco empurrável na posição da cabeça; ao receber energia ele se estende sozinho.
    """
    cmds, extras = [], []
    for (x1, y1, z1, x2, y2, z2, b, nbt) in lista:
        if "piston_head" in b:
            # no lugar da cabeça vai o bloco que ela segura; a posição dele fica vazia
            dy = 1 if "facing=up" in b else -1
            segurado = traduzir(m.get(x1, y1 + dy, z1))
            w, w2 = mundo(x1, y1, z1), mundo(x1, y1 + dy, z1)
            cmds.append(f"setblock {w2[0]} {w2[1]} {w2[2]} minecraft:air")
            cmds.append(f"setblock {w[0]} {w[1]} {w[2]} {segurado}")
            continue
        bloco = traduzir(b)
        if bloco is None:
            continue
        a = mundo(x1, y1, z1)
        if (x1, y1, z1) == (x2, y2, z2):
            cmds.append(f"setblock {a[0]} {a[1]} {a[2]} {bloco}")
        else:
            c = mundo(x2, y2, z2)
            cmds.append(f"fill {a[0]} {a[1]} {a[2]} {c[0]} {c[1]} {c[2]} {bloco}")
        if nbt:
            extras += _conteudo(a, nbt)
    return cmds, extras


def _conteudo(pos, nbt):
    """Itens dos funis-filtro, flechas dos dispensers e loot dos baús."""
    x, y, z = pos
    out = []
    if "LootTable" in nbt:
        tabela = nbt.split('"castelo:')[1].split('"')[0]
        out.append(f'loot replace block {x} {y} {z} slot.container 0 loot "castelo/{tabela}"')
        return out
    import re
    for slot, item, qtd in re.findall(r'Slot:(\d+)b,id:"minecraft:([a-z_]+)",count:(\d+)', nbt):
        out.append(f"replaceitem block {x} {y} {z} slot.container {slot} minecraft:{item} {qtd}")
    return out


# ---------------------------------------------------------------- loot (formato Bedrock)
POCAO = {"strong_healing": 22, "strong_strength": 33, "long_fire_resistance": 13, "strong_regeneration": 30,
         "long_swiftness": 15, "long_night_vision": 6, "long_water_breathing": 20, "strong_turtle_master": 39,
         "strong_swiftness": 16, "long_invisibility": 8, "long_slow_falling": 41, "strong_leaping": 11}
SEM_NO_BEDROCK = {"sweeping_edge"}


def _loot_bedrock(tabela_java):
    pools = []
    for pool in tabela_java["pools"]:
        ent = pool["entries"][0]
        nome = ITENS_BEDROCK.get(ent["name"], ent["name"])
        funcs = []
        for f in ent.get("functions", []):   # (usa o formato antigo; "modifier" é ignorado)
            tipo = f["function"].replace("minecraft:", "")
            if tipo == "set_count":
                funcs.append({"function": "set_count", "count": f["count"]})
            elif tipo == "set_enchantments":
                funcs.append({"function": "specific_enchants", "enchants": [
                    {"id": k.replace("minecraft:", ""), "level": v} for k, v in f["enchantments"].items()
                    if k.replace("minecraft:", "") not in SEM_NO_BEDROCK]})
            elif tipo == "set_potion":
                funcs.append({"function": "set_data", "data": POCAO[f["id"].replace("minecraft:", "")]})
            elif tipo == "set_name":
                funcs.append({"function": "set_name", "name": f["name"]})
        e = {"type": "item", "name": nome, "weight": 1}
        if funcs:
            e["functions"] = funcs
        pools.append({"rolls": 1, "entries": [e]})
    return {"pools": pools}


# ---------------------------------------------------------------- pacote
UUID_H = "4d8c2a7e-1f6b-4b1d-9c3e-7a5f2e8b9d01"
UUID_M = "8e2f4c6a-3b5d-4e7f-a1c9-0d2b4f6e8a13"


def pacote(caminho, grupos, por_arquivo=9000):
    """Pacote de comportamento com as funções <grupo>/parteN e as tabelas de loot.

    `grupos` é {nome: lista de comandos} (ou só a lista, que vira o grupo "castelo").
    Devolve {nome: número de partes}. Cada parte fica abaixo do limite de 10 mil comandos.
    """
    if isinstance(grupos, list):
        grupos = {"castelo": grupos}
    arquivos = {"manifest.json": json.dumps({
        "format_version": 2,
        "header": {"name": "Castelo Enorme", "description": "Constrói o castelo", "uuid": UUID_H,
                   "version": [1, 0, 0], "min_engine_version": [1, 21, 0]},
        "modules": [{"type": "data", "uuid": UUID_M, "version": [1, 0, 0]}]}, indent=2)}
    partes = {}
    for grupo, cmds in grupos.items():
        lotes = [cmds[i:i + por_arquivo] for i in range(0, len(cmds), por_arquivo)]
        partes[grupo] = len(lotes)
        for n, parte in enumerate(lotes, start=1):
            arquivos[f"functions/{grupo}/parte{n}.mcfunction"] = "\n".join(parte) + "\n"
    for nome, t in eq.TABELAS.items():
        arquivos[f"loot_tables/castelo/{nome}.json"] = json.dumps(_loot_bedrock(t), indent=1, ensure_ascii=False)
    os.makedirs(caminho, exist_ok=True)
    for nome, conteudo in arquivos.items():
        p = os.path.join(caminho, nome)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "w", encoding="utf-8") as f:
            f.write(conteudo)
    return partes
