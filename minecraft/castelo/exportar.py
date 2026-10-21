"""Transforma o modelo em comandos, datapack, schematic e imagens."""
import gzip
import json
import os
import struct
import zipfile

import numpy as np

import modelo as m

LIMITE_FILL = 32768
COMANDOS_POR_TICK = 2500

NAO_SOLIDOS = ("air", "water", "glass_pane", "iron_bars", "fence", "stairs", "slab", "lantern",
               "ladder", "carpet", "lightning_rod", "bed", "chest", "poppy", "dandelion", "cornflower",
               "daisy", "short_grass", "enchanting_table", "lectern", "dirt_path", "torch", "door",
               "trapdoor", "rail", "redstone_wire", "repeater", "comparator", "lever", "button", "hopper",
               "piston_head", "tripwire", "tripwire_hook", "bell", "daylight_detector", "anvil",
               "cauldron", "brewing_stand", "flower_pot", "candle", "banner", "sign", "campfire",
               "grindstone", "stonecutter", "bubble_column", "fern", "azalea", "sapling", "sugar_cane",
               "lily_pad", "vine", "cobweb", "end_rod", "sea_pickle", "kelp", "seagrass", "scaffolding",
               "pressure_plate", "wheat", "carrots", "potatoes", "beetroots", "farmland", "smithing_table",
               "cartography_table", "composter", "fletching_table", "loom", "allium", "tulip", "lily_of_the_valley")
NAO_CONDUTORES = ("glass", "leaves", "glowstone", "sea_lantern", "redstone_block", "observer",
                  "piston", "redstone_lamp", "ice", "barrier", "beacon", "hopper", "slime_block",
                  "honey_block", "tnt", "target", "dispenser", "dropper")


def base_de(nome):
    return nome.replace("minecraft:", "").split("[")[0]


def eh_solido(nome):
    if nome == m.MANTER:
        return True
    b = base_de(nome)
    return not any(b == s or b.endswith("_" + s) or b.endswith(s) for s in NAO_SOLIDOS)


def eh_condutor(nome):
    if not eh_solido(nome) or nome == m.MANTER:
        return False
    b = base_de(nome)
    return not any(s in b for s in NAO_CONDUTORES)


# ------------------------------------------------------------- acabamento
def envelhecer():
    """Troca alguns blocos expostos por variantes musgosas/rachadas."""
    variantes = {
        "minecraft:stone_bricks": [("mossy_stone_bricks", 0.07), ("cracked_stone_bricks", 0.05)],
        "minecraft:cobblestone": [("mossy_cobblestone", 0.25)],
        "minecraft:deepslate_tiles": [("cracked_deepslate_tiles", 0.04)],
        "minecraft:deepslate_bricks": [("cracked_deepslate_bricks", 0.05)],
    }
    ar = m.grid == m.AR
    exposto = np.zeros_like(ar)
    for eixo in range(3):
        for passo in (1, -1):
            exposto |= np.roll(ar, passo, axis=eixo)
    ordenadas = np.zeros_like(ar)
    for (x, y, z) in m.pos_ordenadas:
        ordenadas[x + m.XR, y - m.YMIN, z + m.XR] = True
    for nome, opcoes in variantes.items():
        if nome not in m.pidx:
            continue
        for i, j, k in np.argwhere((m.grid == m.pidx[nome]) & exposto & ~ordenadas):
            r = m.rng.random()
            acum = 0.0
            for var, p in opcoes:
                acum += p
                if r < acum:
                    m.grid[i, j, k] = m.B(var)
                    break


def grama_morta():
    """Grama coberta por bloco sólido vira terra (o jogo faria isso sozinho)."""
    if "minecraft:grass_block" not in m.pidx:
        return
    g = m.pidx["minecraft:grass_block"]
    terra = m.B("dirt")
    solido = np.array([eh_solido(n) and n != m.MANTER and n != "minecraft:air" and "leaves" not in n
                       for n in m.palette])
    for nome in ("minecraft:grass_block", "minecraft:dirt_path"):
        if nome in m.pidx:
            cobertas = (m.grid[:, :-1, :] == m.pidx[nome]) & solido[m.grid[:, 1:, :]]
            m.grid[:, :-1, :][cobertas] = terra


def _conexoes_painel(x, y, z, nome):
    if "fence" in nome:
        regra = lambda n: (eh_solido(n) and "glass" not in n) or ("fence" in n and "gate" not in n)
    else:
        regra = lambda n: eh_solido(n) or "pane" in n or "iron_bars" in n
    return ",".join(f"{lado}={'true' if regra(m.get(x + dx, y, z + dz)) else 'false'}"
                     for lado, (dx, dz) in m.DIRS.items())


FONTES = ("redstone_torch", "redstone_wall_torch", "lever", "button", "comparator", "redstone_block",
          "daylight_detector", "lectern", "tripwire_hook", "target", "pressure_plate", "observer")


def _conexoes_fio(x, y, z):
    lados = {}
    acima_condutor = eh_condutor(m.get(x, y + 1, z))
    for lado, (dx, dz) in m.DIRS.items():
        viz = m.get(x + dx, y, z + dz)
        b = base_de(viz)
        if b == "redstone_wire" or any(b.endswith(f) for f in FONTES):
            lados[lado] = "side"
        elif b == "repeater":
            fac = viz.split("facing=")[1].split(",")[0].rstrip("]")
            lados[lado] = "side" if fac in (lado, m.OPOSTO[lado]) else "none"
        elif base_de(m.get(x + dx, y + 1, z + dz)) == "redstone_wire" and not acima_condutor:
            lados[lado] = "up"
        elif not eh_condutor(viz) and base_de(m.get(x + dx, y - 1, z + dz)) == "redstone_wire":
            lados[lado] = "side"
        else:
            lados[lado] = "none"
    ligados = [l for l, v in lados.items() if v != "none"]
    if len(ligados) == 1:
        lados[m.OPOSTO[ligados[0]]] = "side"
    elif not ligados:
        lados = {l: "side" for l in lados}
    return ",".join(f"{l}={lados[l]}" for l in ("east", "north", "south", "west")) + ",power=0"


def conectar():
    """Calcula conexões de vidros, grades, cercas e pó de redstone."""
    alvos = [i for i, n in enumerate(m.palette)
             if ("pane" in n or "iron_bars" in n or ("fence" in n and "gate" not in n)) and "[" not in n]
    for i, j, k in np.argwhere(np.isin(m.grid, alvos)):
        nome = m.palette[m.grid[i, j, k]]
        x, y, z = i - m.XR, j + m.YMIN, k - m.XR
        m.grid[i, j, k] = m.B(f"{nome}[{_conexoes_painel(x, y, z, nome)}]")
    novos = {}
    for idx, item in enumerate(m.ordenados):
        if item and item[3] == "minecraft:redstone_wire":
            x, y, z = item[:3]
            novos[idx] = f"minecraft:redstone_wire[{_conexoes_fio(x, y, z)}]"
    for idx, estado in novos.items():
        x, y, z, _, nbt = m.ordenados[idx]
        m.ordenados[idx] = (x, y, z, estado, nbt)
        m.grid[x + m.XR, y - m.YMIN, z + m.XR] = m.B(estado)


def finalizar():
    grama_morta()
    envelhecer()
    conectar()


# -------------------------------------------------------- compressão em caixas
ESTRUTURAIS = ("stairs", "slab", "dirt_path", "fence", "farmland")


def ordem_dos_blocos(contagem, presentes):
    solidos = sorted((i for i in presentes if eh_solido(m.palette[i])), key=lambda i: -contagem[i])
    estruturais = [i for i in presentes if not eh_solido(m.palette[i])
                   and any(e in base_de(m.palette[i]) for e in ESTRUTURAIS)]
    agua = [i for i in presentes if m.palette[i] == "minecraft:water"]
    apoiados = [i for i in presentes if not eh_solido(m.palette[i])
                and i not in estruturais and i not in agua]
    return solidos + [m.AR] + estruturais + apoiados, agua


def _agrupar(tipos, precisa, permitido_por_rank, rank_grid, rank_de):
    resultado = []
    for tipo in tipos:
        alvo = (m.grid == tipo) & precisa
        if not alvo.any():
            continue
        r = rank_de[tipo]
        permitido = alvo | ((rank_grid > r) & permitido_por_rank)
        coberto = np.zeros_like(alvo)
        for x, y, z in np.argwhere(alvo):
            if coberto[x, y, z]:
                continue
            x2 = x
            while x2 + 1 < m.SX and permitido[x2 + 1, y, z] and (x2 + 2 - x) <= LIMITE_FILL:
                x2 += 1
            z2 = z
            while (z2 + 1 < m.SZ and (x2 - x + 1) * (z2 + 2 - z) <= LIMITE_FILL
                   and permitido[x:x2 + 1, y, z2 + 1].all()):
                z2 += 1
            y2 = y
            while (y2 + 1 < m.SY and (x2 - x + 1) * (z2 - z + 1) * (y2 + 2 - y) <= LIMITE_FILL
                   and permitido[x:x2 + 1, y2 + 1, z:z2 + 1].all()):
                y2 += 1
            coberto[x:x2 + 1, y:y2 + 1, z:z2 + 1] = True
            resultado.append((x - m.XR, y + m.YMIN, z - m.XR, x2 - m.XR, y2 + m.YMIN, z2 - m.XR,
                              m.palette[tipo], ""))
    return resultado


def caixas(limpar_acima=True):
    """Agrupa os blocos em caixas para /fill.

    Ordem: sólidos (mais comuns primeiro), ar abaixo do chão, lajes/escadas/cercas, objetos
    que precisam de apoio, blocos ordenados (redstone, portas, camas...) e por último a água.
    Uma caixa pode cobrir células de tipos que vêm depois (elas serão sobrescritas), mas
    nunca células de tipos anteriores, células "manter" nem o ar já limpo acima do chão.
    """
    contagem = np.bincount(m.grid.ravel(), minlength=len(m.palette))
    ordenada = np.zeros(m.grid.shape, dtype=bool)
    for (x, y, z) in m.pos_ordenadas:
        ordenada[x + m.XR, y - m.YMIN, z + m.XR] = True
    presentes = [i for i in range(len(m.palette)) if contagem[i] and i not in (m.AR, m.KEEP)]
    ordem, agua = ordem_dos_blocos(contagem, presentes)
    rank_de = np.full(len(m.palette), -1)
    for r, i in enumerate(ordem + agua):
        rank_de[i] = r
    rank_grid = rank_de[m.grid]
    rank_grid[ordenada] = len(ordem) + len(agua) + 1        # pode ser coberta por qualquer um
    ar_limpo = np.zeros(m.grid.shape, dtype=bool)
    if limpar_acima:
        ar_limpo = (m.grid == m.AR) & (np.arange(m.SY)[None, :, None] + m.YMIN >= 0)
    precisa = (m.grid != m.KEEP) & ~ordenada & ~ar_limpo
    principal = _agrupar(ordem, precisa, precisa | ordenada, rank_grid, rank_de)
    ordenados = [(x, y, z, x, y, z, e, nbt) for item in m.ordenados if item
                 for (x, y, z, e, nbt) in [item]]
    final_agua = _agrupar(agua, precisa, precisa, rank_grid, rank_de)   # água nunca cobre ordenados
    return principal + ordenados + final_agua


def limpeza():
    """Caixas de ar que limpam todo o espaço acima do chão."""
    out = []
    for x in range(-m.XR, m.XR + 1, 32):
        for z in range(-m.XR, m.XR + 1, 32):
            for y in range(0, m.YMAX + 1, 32):
                out.append((x, y, z, min(x + 31, m.XR), min(y + 31, m.YMAX), min(z + 31, m.XR),
                            "minecraft:air", ""))
    return out


# ------------------------------------------------------------ comandos Java
def rel(x, y, z, zoff=None):
    zoff = m.ZOFF if zoff is None else zoff
    return " ".join(("~" if v == 0 else f"~{v}") for v in (x, y, z + zoff))


def comando_java(c, zoff=None):
    x1, y1, z1, x2, y2, z2, b, nbt = c
    if (x1, y1, z1) == (x2, y2, z2):
        return f"setblock {rel(x1, y1, z1, zoff)} {b}{nbt}"
    return f"fill {rel(x1, y1, z1, zoff)} {rel(x2, y2, z2, zoff)} {b}"


def pack_mcmeta(descricao):
    return json.dumps({"pack": {"description": descricao, "pack_format": 48,
                                "supported_formats": [48, 999], "min_format": 48, "max_format": 999}},
                      indent=2, ensure_ascii=False)


def datapack(caminho, namespace, cmds, extras=(), mensagem_pronto="Pronto!", zona=None, titulo="Castelo"):
    """Datapack que roda `cmds` relativos a um marcador, em etapas de COMANDOS_POR_TICK por tick."""
    ns = namespace
    partes = [cmds[i:i + COMANDOS_POR_TICK] for i in range(0, len(cmds), COMANDOS_POR_TICK)]
    marcador = f"@e[type=minecraft:marker,tag={ns}_origem,limit=1]"
    arquivos = {"pack.mcmeta": pack_mcmeta(f"{titulo} - /function {ns}:construir")}

    def tell(texto, cor="white"):
        return ('tellraw @a [{"text":"[%s] ","color":"gold"},{"text":%s,"color":"%s"}]'
                % (titulo, json.dumps(texto, ensure_ascii=False), cor))
    arquivos[f"data/minecraft/tags/function/load.json"] = json.dumps({"values": [f"{ns}:carregar"]})
    arquivos[f"data/{ns}/function/carregar.mcfunction"] = tell(
        f"Datapack carregado! Fique num lugar aberto e digite /function {ns}:construir") + "\n"
    fl = ""
    if zona:
        (x1, z1), (x2, z2) = zona
        fl = f"~{x1} ~{z1} ~{x2} ~{z2}"
    linhas = [f"kill @e[type=minecraft:marker,tag={ns}_origem]",
              f'summon minecraft:marker ~ ~ ~ {{Tags:["{ns}_origem"]}}']
    if fl:
        linhas.append(f"forceload add {fl}")
    linhas += [tell("Carregando a área... a construção começa em 3 segundos."),
               f"schedule function {ns}:_etapa1 3s"]
    arquivos[f"data/{ns}/function/construir.mcfunction"] = "\n".join(linhas) + "\n"
    for n, parte in enumerate(partes, start=1):
        arquivos[f"data/{ns}/function/_blocos{n}.mcfunction"] = "\n".join(parte) + "\n"
        et = [f"execute as {marcador} at @s run function {ns}:_blocos{n}"]
        if n < len(partes):
            pct = int(100 * n / len(partes))
            et.append(tell(f"Construindo... {pct}%", "gray"))
            et.append(f"schedule function {ns}:_etapa{n + 1} 1t")
        else:
            if fl:
                et.append(f"execute as {marcador} at @s run forceload remove {fl}")
            et.append(f"kill @e[type=minecraft:marker,tag={ns}_origem]")
            et.append(tell(mensagem_pronto, "green"))
        arquivos[f"data/{ns}/function/_etapa{n}.mcfunction"] = "\n".join(et) + "\n"
    for nome, conteudo in extras:
        arquivos[nome] = conteudo
    with zipfile.ZipFile(caminho, "w", zipfile.ZIP_DEFLATED) as zf:
        for nome, conteudo in arquivos.items():
            zf.writestr(nome, conteudo)
    return len(partes)


# --------------------------------------------------------- .schem
def _nbt_string(s):
    b = s.encode("utf-8")
    return struct.pack(">H", len(b)) + b


def _tag(tipo, nome, payload):
    return bytes([tipo]) + _nbt_string(nome) + payload


def _varints(valores):
    out = bytearray()
    for v in valores:
        while True:
            byte = v & 0x7F
            v >>= 7
            if v:
                out.append(byte | 0x80)
            else:
                out.append(byte)
                break
    return bytes(out)


def _snbt_para_nbt(snbt):
    """Conversor mínimo de SNBT (o que usamos nos funis/dispensers) para NBT binário."""
    pos = [0]

    def ws():
        while pos[0] < len(snbt) and snbt[pos[0]] in " \n\t":
            pos[0] += 1

    def chave():
        ws()
        if snbt[pos[0]] == '"':
            fim = snbt.index('"', pos[0] + 1)
            k = snbt[pos[0] + 1:fim]
            pos[0] = fim + 1
        else:
            ini = pos[0]
            while snbt[pos[0]] not in ":":
                pos[0] += 1
            k = snbt[ini:pos[0]]
        return k

    def valor():
        ws()
        c = snbt[pos[0]]
        if c == "{":
            pos[0] += 1
            corpo = b""
            ws()
            while snbt[pos[0]] != "}":
                k = chave()
                ws()
                pos[0] += 1  # ':'
                tipo, payload = valor()
                corpo += _tag(tipo, k, payload)
                ws()
                if snbt[pos[0]] == ",":
                    pos[0] += 1
                ws()
            pos[0] += 1
            return 10, corpo + b"\x00"
        if c == "[":
            pos[0] += 1
            itens = []
            ws()
            while snbt[pos[0]] != "]":
                itens.append(valor())
                ws()
                if snbt[pos[0]] == ",":
                    pos[0] += 1
                ws()
            pos[0] += 1
            tipo = itens[0][0] if itens else 0
            return 9, bytes([tipo]) + struct.pack(">i", len(itens)) + b"".join(p for _, p in itens)
        if c == '"':
            fim = snbt.index('"', pos[0] + 1)
            s = snbt[pos[0] + 1:fim]
            pos[0] = fim + 1
            return 8, _nbt_string(s)
        ini = pos[0]
        while snbt[pos[0]] not in ",}]":
            pos[0] += 1
        tok = snbt[ini:pos[0]]
        if tok.endswith("b"):
            return 1, struct.pack(">b", int(tok[:-1]))
        if tok.endswith("s"):
            return 2, struct.pack(">h", int(tok[:-1]))
        return 3, struct.pack(">i", int(tok))
    tipo, payload = valor()
    assert tipo == 10
    return payload[:-1]   # sem o fim do compound, para podermos acrescentar campos


def schematic(caminho, offset):
    """Sponge Schematic v2 (WorldEdit / FAWE). Células "manter" viram pedra."""
    usados = sorted(set(np.unique(m.grid).tolist()))
    nomes = {i: ("minecraft:stone" if i == m.KEEP else m.palette[i]) for i in usados}
    paleta, remap = {}, np.zeros(len(m.palette), dtype=np.int32)
    for i in usados:
        paleta.setdefault(nomes[i], len(paleta))
        remap[i] = paleta[nomes[i]]
    dados = remap[m.grid].transpose(1, 2, 0).ravel()
    blockdata = _varints(dados.tolist())
    pal = b"".join(_tag(3, n, struct.pack(">i", v)) for n, v in paleta.items()) + b"\x00"
    ox, oy, oz = offset
    meta = (_tag(3, "WEOffsetX", struct.pack(">i", ox)) + _tag(3, "WEOffsetY", struct.pack(">i", oy)) +
            _tag(3, "WEOffsetZ", struct.pack(">i", oz)) + _tag(8, "Name", _nbt_string("Castelo Enorme")) + b"\x00")
    entidades = []
    for item in m.ordenados:
        if item and item[4]:
            x, y, z, estado, nbt = item
            pos = struct.pack(">i", 3) + struct.pack(">iii", x + m.XR, y - m.YMIN, z + m.XR)
            ident = "minecraft:" + base_de(estado)
            entidades.append(_snbt_para_nbt(nbt) + _tag(11, "Pos", pos) + _tag(8, "Id", _nbt_string(ident)) + b"\x00")
    be = bytes([10]) + struct.pack(">i", len(entidades)) + b"".join(entidades)
    corpo = (_tag(3, "Version", struct.pack(">i", 2)) + _tag(3, "DataVersion", struct.pack(">i", 3953)) +
             _tag(2, "Width", struct.pack(">h", m.SX)) + _tag(2, "Height", struct.pack(">h", m.SY)) +
             _tag(2, "Length", struct.pack(">h", m.SZ)) +
             _tag(11, "Offset", struct.pack(">i", 3) + struct.pack(">iii", 0, 0, 0)) +
             _tag(3, "PaletteMax", struct.pack(">i", len(paleta))) + _tag(10, "Palette", pal) +
             _tag(7, "BlockData", struct.pack(">i", len(blockdata)) + blockdata) +
             _tag(10, "Metadata", meta) + _tag(9, "BlockEntities", be))
    with gzip.open(caminho, "wb") as f:
        f.write(_tag(10, "Schematic", corpo + b"\x00"))
