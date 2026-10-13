"""Tudo que fica embaixo da terra: masmorra, as três bases secretas, o metrô e os elevadores.

  Base 1 - QG Secreto do Rei   (embaixo da torre de menagem, y -26)
  Base 2 - Refúgio do Poço     (embaixo do pátio sudeste; entra pulando no poço)
  Base 3 - Base Submarina      (embaixo do fosso oeste, com teto de vidro para a água)
"""
import modelo as m
from modelo import put, get, box, casca, ordenado
import redstone as rs
import equipamentos as eq

PISO = -27            # bloco do chão das bases 1 e 2 (o jogador fica em y = -26)
Y = PISO + 1

QG = (-31, -53, 31, -5)            # interior (x1, z1, x2, z2)
REFUGIO = (11, 27, 43, 53)
SUBMARINA = (-88, -36, -80, -4)
SUB_PISO = -12

ELEV_QG = [(-20, False), (-16, True)]       # (x, desce?) em z = -44
ELEV_POCO = [(26, False), (28, True)]       # em z = 38

LINHA_Z = -32           # o metrô corre em z = -32 dentro do QG


def dentro_de(base, x, z, margem=0):
    x1, z1, x2, z2 = base
    return x1 - margem <= x <= x2 + margem and z1 - margem <= z <= z2 + margem


# ------------------------------------------------------------------ cascas
def sala(x1, z1, x2, z2, piso, teto, parede="deepslate_bricks", chao="polished_deepslate", protecao=2):
    """Sala subterrânea: uma camada grossa de pedra (contra cavernas), paredes e piso."""
    box(x1 - 1 - protecao, piso - protecao, z1 - 1 - protecao, x2 + 1 + protecao, teto + protecao,
        z2 + 1 + protecao, "stone")
    casca(x1 - 1, piso - 1, z1 - 1, x2 + 1, teto, z2 + 1, parede)
    box(x1, piso, z1, x2, piso, z2, chao)


# ------------------------------------------------------------------ masmorra
def masmorra():
    sala(0, -48, 23, -8, -9, -2, parede="mossy_stone_bricks", chao="cobblestone", protecao=1)
    box(23, -8, -10, 23, -2, -10, "mossy_stone_bricks")
    for y in range(-8, 0):
        put(22, y, -10, "ladder[facing=west]")
    # celas com grades ao norte
    for x0 in range(1, 22, 5):
        box(x0 + 4, -8, -48, x0 + 4, -3, -42, "mossy_stone_bricks")
        for x in range(x0, x0 + 4):
            for y in range(-8, -4):
                put(x, y, -41, "iron_bars")
        put(x0 + 1, -8, -41, "air"); put(x0 + 1, -7, -41, "air")
        m.porta(x0 + 1, -8, -41, "iron", "north")
        put(x0 + 2, -8, -47, "cobweb") if x0 % 2 else put(x0 + 2, -8, -47, "hay_block")
        put(x0 + 1, -4, -45, "lantern[hanging=true]")
    # adega ao sul
    for z in range(-20, -8, 2):
        box(2, -8, z, 8, -7, z, "barrel[facing=east,open=false]")
    for z in (-14, -24, -34):
        put(12, -3, z, "lantern[hanging=true]")


# ------------------------------------------------------------------ base 1
def qg():
    x1, z1, x2, z2 = QG
    sala(x1, z1, x2, z2, PISO, -18, parede="deepslate_bricks", chao="polished_deepslate")
    box(x1 - 3, PISO - 5, -30, 0, PISO - 1, -21, "stone")       # fundação do separador
    testes = []
    # iluminação geral
    for x in range(x1 + 4, x2, 8):
        for z in range(z1 + 4, z2, 8):
            put(x, -19, z, "sea_lantern")
    # paredes internas (zonas)
    box(x1, Y, -36, x2, -19, -36, "deepslate_bricks")            # norte | corredor
    box(x1, Y, -29, x2, -19, -29, "deepslate_bricks")            # corredor | sul
    box(-11, Y, z1, -11, -19, -37, "deepslate_bricks")           # hall dos elevadores | comando
    box(11, Y, z1, 11, -19, -37, "deepslate_bricks")             # comando | cofre
    box(0, Y, -28, 0, -19, z2, "deepslate_bricks")               # armazém | dormitório
    for x, z in ((-20, -36), (0, -36), (-15, -29), (15, -29)):
        box(x - 1, Y, z, x + 1, Y + 2, z, "air")
    # --- elevadores para a sala secreta do 1º andar da torre de menagem
    for x, desce in ELEV_QG:
        testes.append(rs.elevador_de_bolhas(rs.Quadro(x, Y, -44, "east", "north"), 12 - Y, descer=desce))
    # --- sala de comando
    box(-6, Y, -48, 6, Y, -42, "dark_oak_planks")
    put(0, Y + 1, -45, "cartography_table")
    for x in (-4, 4):
        put(x, Y + 1, -45, "lectern[facing=south,has_book=false,powered=false]")
    box(-10, Y, z1, 10, Y + 2, z1, "bookshelf")
    for i, x in enumerate(range(-9, 10, 3)):
        eq.bau(x, Y, -38, "north", ("kit_netherite", "suprimentos", "pocoes")[i % 3])
    # --- cofre com senha (painel virado para o corredor, em z = -37)
    box(12, Y, -40, x2, -19, -37, "deepslate_bricks")
    q = rs.Quadro(12, Y, -37, "east", "north")
    t = rs.cofre_com_senha(q)
    testes.append(t)
    box(26, Y, -40, 26, Y + 1, -39, "air")                     # passagem atrás da porta
    put(26, Y + 1, -38, "air")
    box(12, Y, z1, x2, Y, -41, "gold_block")
    for x in range(13, x2, 3):
        eq.bau(x, Y + 1, -50, "south", "tesouro")
        put(x, Y + 1, -46, "diamond_block")
    box(18, Y + 1, z1, 24, Y + 1, z1, "emerald_block")
    box(13, Y + 1, -43, 15, Y + 1, -41, "iron_block")
    put(14, Y + 2, -42, "beacon")
    # --- armazém com o separador automático
    qs = rs.Quadro(-26, Y + 1, -24, "east", "south")
    t = rs.separador_de_itens(qs)
    testes.append(t)
    for k in range(len(rs.ITENS_SEPARADOR)):
        for du in (1, 2):
            if 3 * k + du <= 3 * (len(rs.ITENS_SEPARADOR) - 1):
                qs.put(3 * k + du, 1, -1, "glass")
    qs.box(-3, 1, 0, 3 * (len(rs.ITENS_SEPARADOR) - 1) + 2, 1, 1, "glass")
    for x in range(-29, -1, 3):
        put(x, Y, -7, "barrel[facing=north,open=false]")
        put(x + 1, Y, -7, "chest[facing=north,type=single]")
    # --- dormitório e estação
    for z in range(-26, -8, 4):
        m.cama(28, Y, z, "black", "east")
        eq.bau(30, Y, z + 1, "west", "kit_netherite" if z % 8 else "suprimentos")
    put(4, Y, -8, "crafting_table"); put(5, Y, -8, "furnace[facing=north,lit=false]")
    put(6, Y, -8, "brewing_stand[has_bottle_0=false,has_bottle_1=false,has_bottle_2=false]")
    put(8, Y, -8, "enchanting_table")
    # --- hub do metrô no corredor
    q = rs.Quadro(0, Y, LINHA_Z, "east", "south")
    rs.estacao(q, -2, 0, 0, +1)          # linha oeste (Base Submarina)
    rs.estacao(q, 2, 0, 0, -1)           # linha leste (Refúgio do Poço)
    box(-1, Y, LINHA_Z, 1, Y + 1, LINHA_Z, "polished_blackstone_bricks")
    put(0, Y + 2, LINHA_Z, "lantern")
    return testes


# ------------------------------------------------------------------ base 2
def refugio():
    x1, z1, x2, z2 = REFUGIO
    sala(x1, z1, x2, z2, PISO, -18, parede="spruce_planks", chao="spruce_planks")
    box(x1, -18, z1, x2, -18, z2, "spruce_planks")
    testes = []
    for x in range(x1 + 3, x2, 6):
        for z in range(z1 + 3, z2, 6):
            put(x, -19, z, "lantern[hanging=true]")
    # poço: dois elevadores (sobe com areia das almas, desce com magma)
    for x, desce in ELEV_POCO:
        testes.append(rs.elevador_de_bolhas(rs.Quadro(x, Y, 38, "east", "north"), -1 - Y + 1, descer=desce))
    # boca do poço no pátio
    box(25, 0, 37, 29, 1, 39, "cobblestone")
    for x, desce in ELEV_POCO:
        put(x, 0, 38, "air"); put(x, 1, 38, "air")
        put(x, 0, 39, "air"); put(x, 1, 39, "air")
    put(27, 0, 39, "cobblestone"); put(27, 1, 39, "air")
    box(25, 2, 37, 29, 2, 39, "air")
    for x in (25, 29):
        for z in (37, 39):
            box(x, 2, z, x, 3, z, "spruce_fence")
    box(24, 4, 36, 30, 4, 40, "spruce_slab")
    put(27, 3, 38, "lantern[hanging=true]")
    # mobília
    for z in range(z1 + 2, z1 + 16, 4):
        m.cama(x1 + 1, Y, z, "green", "west")
        eq.bau(x1 + 1, Y, z + 1, "east", "kit_netherite" if z % 8 else "suprimentos")
    put(x1 + 6, Y, z2, "crafting_table"); put(x1 + 7, Y, z2, "furnace[facing=north,lit=false]")
    put(x1 + 8, Y, z2, "smoker[facing=north,lit=false]")
    put(x1 + 10, Y, z2, "brewing_stand[has_bottle_0=false,has_bottle_1=false,has_bottle_2=false]")
    put(x1 + 12, Y, z2, "anvil[facing=north]")
    put(18, Y, 46, "enchanting_table")
    for dx in range(-2, 3):
        for dz in (-2, 2):
            put(18 + dx, Y, 46 + dz, "bookshelf")
            put(18 + dz, Y, 46 + dx, "bookshelf")
    put(18, Y, 44, "air"); put(18, Y, 48, "air")
    box(x2 - 6, Y, z1, x2, Y + 2, z1, "barrel[facing=south,open=false]")
    eq.bau(x2 - 3, Y, z1, "south", "pocoes", tipo="barrel")
    eq.bau(x2 - 1, Y, z1, "south", "cozinha", tipo="barrel")
    return testes


# ------------------------------------------------------------------ base 3
def submarina():
    x1, z1, x2, z2 = SUBMARINA
    yb = SUB_PISO
    box(x1 - 2, yb - 1, z1 - 2, x2 + 2, -7, z2 + 2, "prismarine_bricks")
    box(x1, yb, z1, x2, yb, z2, "dark_prismarine")
    box(x1, yb + 1, z1, x2, -7, z2, "air")
    box(x1, -6, z1, x2, -6, z2, "glass")                       # teto = fundo do fosso
    for z in range(z1 + 2, z2, 5):
        put(x1, yb + 3, z, "sea_lantern"); put(x2, yb + 3, z, "sea_lantern")
    for z in range(z1 + 4, z2 - 4, 6):
        m.cama(x1 + 1, yb + 1, z, "cyan", "west")
        eq.bau(x1 + 1, yb + 1, z + 1, "east", "kit_netherite" if z % 12 else "suprimentos")
    put(x2 - 1, yb + 1, z2, "crafting_table")
    put(x2 - 2, yb + 1, z2, "brewing_stand[has_bottle_0=false,has_bottle_1=false,has_bottle_2=false]")
    put(-84, yb + 1, z2, "conduit[waterlogged=false]")
    testes = []
    # fuga: corredor com alarme e armadilha até um alçapão escondido fora do fosso
    box(-93, yb, -21, -89, yb + 3, -19, "deepslate_bricks")
    qa = rs.Quadro(-98, yb + 1, -24, "south", "east")
    t = rs.alarme_com_armadilha(qa, largura=3, comprimento=6, lampadas=(2, 4))
    testes.append(t)
    box(-92, yb + 1, -21, -92, yb + 2, -21, "air")
    box(-92, yb + 1, -20, -89, yb + 2, -20, "air")
    box(-99, yb + 3, -24, -97, -2, -22, "stone")
    for y in range(yb + 1, -1):
        put(-98, y, -23, "ladder[facing=east]")
    put(-98, -1, -23, "air")
    ordenado(-98, -1, -23, "spruce_trapdoor[facing=north,half=top,open=false,powered=false,waterlogged=false]")
    for x, z in ((-99, -23), (-97, -23), (-98, -24), (-99, -24), (-97, -24)):
        put(x, 0, z, "azalea_leaves[persistent=true,distance=1,waterlogged=false]")
    put(-98, 1, -24, "flowering_azalea_leaves[persistent=true,distance=1,waterlogged=false]")
    return testes


# ------------------------------------------------------------------ metrô
def _forma(a, b):
    (x1, y1, z1), (x2, y2, z2) = a, b
    dx, dz = x2 - x1, z2 - z1
    return {(1, 0): "east", (-1, 0): "west", (0, 1): "south", (0, -1): "north"}[(dx, dz)]


def linha(caminho, livre):
    """Trilhos ao longo de `caminho` (lista de (x,y,z) com passos de 1 bloco; y pode subir 1).

    Trechos retos planos ganham trilho de impulso a cada 4 blocos; rampas são todas de impulso.
    `livre(x, z)` diz se a célula já está dentro de uma base (sem túnel nem casca)."""
    fora = [(x, y, z) for (x, y, z) in caminho if not livre(x, z)]
    for (x, y, z) in fora:
        box(x - 2, y - 2, z - 2, x + 2, y + 4, z + 2, "stone")
    for (x, y, z) in fora:
        box(x - 1, y - 1, z - 1, x + 1, y + 3, z + 1, "deepslate_tiles")
    for (x, y, z) in fora:
        box(x - 1, y, z - 1, x + 1, y + 2, z + 1, "air")
    n = len(caminho)
    for i, (x, y, z) in enumerate(caminho):
        ant = caminho[i - 1] if i else None
        prox = caminho[i + 1] if i + 1 < n else None
        dirs = []
        subindo = None
        for viz in (ant, prox):
            if viz is None:
                continue
            d = _forma((x, y, z), (viz[0], y, viz[2]))
            dirs.append(d)
            if viz[1] == y + 1:
                subindo = d
        if subindo:
            forma, impulso = f"ascending_{subindo}", True
        elif len(dirs) == 2 and set(dirs) not in ({"east", "west"}, {"north", "south"}):
            ns = [d for d in dirs if d in ("north", "south")][0]
            ew = [d for d in dirs if d in ("east", "west")][0]
            forma, impulso = f"{ns}_{ew}", False
        else:
            forma = "east_west" if dirs[0] in ("east", "west") else "north_south"
            impulso = i % 4 == 2
        if get(x, y - 1, z) in ("minecraft:air", m.MANTER):
            put(x, y - 1, z, "deepslate_tiles")          # o túnel pode ter escavado o apoio
        if impulso:
            put(x, y - 1, z, "redstone_block")
            ordenado(x, y, z, f"powered_rail[shape={forma},powered=true,waterlogged=false]")
        else:
            ordenado(x, y, z, f"rail[shape={forma},waterlogged=false]")
        if not livre(x, z) and i % 10 == 5:
            lado = (0, 1) if forma in ("east_west",) or forma.endswith(("east", "west")) else (1, 0)
            put(x + lado[0], y, z + lado[1], "lantern")


def metro():
    testes = []
    livre = lambda x, z: dentro_de(QG, x, z) or dentro_de(REFUGIO, x, z) or dentro_de(SUBMARINA, x, z)
    # linha oeste: QG -> Base Submarina (com rampa subindo 15 blocos)
    oeste = [(x, Y, LINHA_Z) for x in range(-5, -65, -1)]
    for k in range(15):
        oeste.append((-65 - k, Y + k, LINHA_Z))
    oeste += [(x, SUB_PISO + 1, LINHA_Z) for x in range(-80, -85, -1)]
    linha(oeste, livre)
    qs = rs.Quadro(0, SUB_PISO + 1, LINHA_Z, "east", "south")
    rs.estacao(qs, -87, 0, 0, -1)
    # linha leste: QG -> Refúgio do Poço (com curva)
    leste = [(x, Y, LINHA_Z) for x in range(5, 34)]
    leste += [(34, Y, z) for z in range(LINHA_Z, 44)]
    linha(leste, livre)
    qr = rs.Quadro(34, Y, 0, "south", "east")
    rs.estacao(qr, 46, 0, 0, +1)
    # testes: carrinho sai do QG e chega em cada base
    q = rs.Quadro(0, Y, LINHA_Z, "east", "south")
    for nome, partida, botao, chegada, tempo in (
            ("Metrô: QG -> Base Submarina", (-3, Y, LINHA_Z), (-3, Y + 1, LINHA_Z), (-86, SUB_PISO + 1, LINHA_Z), 25),
            ("Metrô: QG -> Refúgio do Poço", (3, Y, LINHA_Z), (3, Y + 1, LINHA_Z), (34, Y, 45), 25)):
        botao_estado = "stone_button[face=wall,facing=%s,powered=false]" % ("west" if partida[0] < 0 else "east")
        testes.append({"nome": nome, "passos": [
            ("cmd", "summon minecraft:minecart {centro}", partida),
            ("espera", 2),
            ("cmd", "setblock {} minecraft:redstone_block", botao),
            ("espera", 1),
            ("cmd", "setblock {} minecraft:" + botao_estado, botao),
            ("espera", tempo),
            ("entidade", "minecart", chegada, 2.5, "carrinho chegou e parou na estação"),
        ]})
    return testes


# um carrinho parado em cada estação (posição do trilho de lançamento)
ESTACOES = [(-3, Y, LINHA_Z), (3, Y, LINHA_Z), (-86, SUB_PISO + 1, LINHA_Z), (34, Y, 45)]


def construir():
    masmorra()
    testes = qg()
    testes += refugio()
    testes += submarina()
    testes += metro()
    return testes


def colunas_de_agua():
    """Células das colunas dos elevadores (viram bubble_column no jogo)."""
    out = set()
    for x, _ in ELEV_QG:
        out.add((x, -44))
    for x, _ in ELEV_POCO:
        out.add((x, 38))
    return out
