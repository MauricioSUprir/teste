"""O castelo acima do chão: terreno, fosso, muralhas, torres, portão, torre de menagem e pátio."""
import math

import modelo as m
from modelo import put, get, box, casca, disco, anel, cilindro, anel_quadrado, ameias, ordenado
import redstone as rs
import equipamentos as eq

# ------------------------------------------------------------------ medidas
MURO = 64                 # face externa da muralha (meia-largura)
MURO_INT = 60             # face interna
PASSADICO = 18            # topo da muralha (o jogador anda em y=19)
FOSSO = (79, 89)          # anéis de água
TORRE_CANTO_R, TORRE_CANTO_TOPO = 11, 30

# torre de menagem (keep)
KX1, KX2, KZ1, KZ2 = -26, 26, -50, -6     # paredes externas (2 de espessura)
IX1, IX2, IZ1, IZ2 = -24, 24, -48, -8     # interior
ANDARES = [-1, 11, 22, 33, 44]            # pisos: térreo, 1º, 2º, 3º, telhado
ESCADA_K = (24, -46)                      # escada de mão (canto nordeste)
PORTA_SECRETA = (-11, -30)                # estante secreta no 1º andar (parede oeste da biblioteca)


# ------------------------------------------------------------------ terreno
def terreno():
    box(-m.XR, -5, -m.XR, m.XR, -5, m.XR, "stone")
    box(-m.XR, -4, -m.XR, m.XR, -2, m.XR, "dirt")
    box(-m.XR, -1, -m.XR, m.XR, -1, m.XR, "grass_block")
    a, b = FOSSO
    for r in range(a, b + 1):
        for x, z in anel_quadrado(r):
            put(x, -1, z, "air")
            for y in range(-5, -1):
                put(x, y, z, "water")
            put(x, -6, z, "gravel" if m.rng.random() < 0.3 else "stone")
            put(x, -7, z, "stone")
    for r in (a - 1, b + 1):
        for x, z in anel_quadrado(r):
            for y in range(-7, -1):
                put(x, y, z, "stone_bricks")


# ---------------------------------------------------------------- muralhas
def muralha():
    for r in range(MURO_INT, MURO + 1):
        for x, z in anel_quadrado(r):
            for y in range(0, PASSADICO + 1):
                put(x, y, z, "stone_bricks")
            put(x, -1, z, "stone_bricks")
    for x, z in anel_quadrado(MURO + 1):
        for y in range(0, 3):
            put(x, y, z, "cobblestone")
        if abs(x) == MURO + 1 and abs(z) == MURO + 1:
            continue
        if abs(z) == MURO + 1:
            facing = "north" if z > 0 else "south"
        else:
            facing = "west" if x > 0 else "east"
        put(x, PASSADICO - 2, z, f"stone_brick_stairs[facing={facing},half=top]")
        for y in range(PASSADICO - 1, PASSADICO + 2):
            put(x, y, z, "stone_bricks")
        if ameias(x, z):
            put(x, PASSADICO + 2, z, "stone_bricks")
            if (x + z) % 8 == 0:
                put(x, PASSADICO + 3, z, "lantern")
    for x, z in anel_quadrado(MURO_INT):
        put(x, PASSADICO + 1, z, "stone_brick_slab")
    # seteiras e estandartes de pedra
    for x, z in anel_quadrado(MURO):
        t = x if abs(z) == MURO else z
        if t % 8 == 4 and abs(t) < 50:
            for y in range(6, 10):
                put(x, y, z, "air")
    # escadas de pedra do pátio até o passadiço (dos dois lados do portão)
    for s in (-1, 1):
        for i in range(PASSADICO + 1):
            x = s * (14 + i)
            box(x, 0, MURO_INT - 2, x, i, MURO_INT - 1, "stone_bricks")
            put(x, i, MURO_INT - 2, f"stone_brick_stairs[facing={'east' if s < 0 else 'west'}]")
            put(x, i, MURO_INT - 1, f"stone_brick_stairs[facing={'east' if s < 0 else 'west'}]")


# ------------------------------------------------------------------- torres
def torre(cx, cz, R, topo, y0=0, oca=True, pisos=(), escada=None, janelas=(), passadico=None,
          porta_telhado=None, porta_terreo=None, lampadas=True, cor_telhado="deepslate_tiles"):
    """Torre redonda com mísulas, parapeito com ameias e telhado cônico oco."""
    if y0 == 0:
        cilindro(cx, cz, disco(R + 1), 0, 2, "cobblestone")
    cilindro(cx, cz, disco(R), y0, topo, "stone_bricks")
    borda = anel(R + 1, R)
    cilindro(cx, cz, borda, topo - 1, topo - 1, "chiseled_stone_bricks")
    cilindro(cx, cz, borda, topo, topo + 1, "stone_bricks")
    for dx, dz in borda:
        if ameias(dx, dz):
            put(cx + dx, topo + 2, cz + dz, "stone_bricks")
    if oca:
        interior = disco(R - 2)
        cilindro(cx, cz, interior, y0, topo - 1, "air")
        if y0 == 0:
            cilindro(cx, cz, interior, -1, -1, "spruce_planks")
        for p in pisos:
            cilindro(cx, cz, interior, p, p, "spruce_planks")
            if lampadas:
                put(cx, p - 1, cz, "lantern[hanging=true]")
        if lampadas:
            put(cx, topo - 1, cz, "lantern[hanging=true]")
        for (ux, uz), ys in janelas:
            for k in (R - 1, R):
                for y in ys:
                    put(cx + ux * k, y, cz + uz * k, "glass_pane")
        if passadico:
            for x, z in [(cx + dx, cz + dz) for dx, dz in anel(R, R - 2)]:
                if passadico(x, z):
                    for y in (PASSADICO + 1, PASSADICO + 2):
                        put(x, y, z, "air")
        if porta_terreo:
            _abrir(cx, cz, R, porta_terreo, range(y0, y0 + 3), R - 2)
        if escada:
            ux, uz = escada
            lx, lz = cx + ux * (R - 2), cz + uz * (R - 2)
            facing = {(1, 0): "west", (-1, 0): "east", (0, 1): "north", (0, -1): "south"}[escada]
            for y in range(y0, topo + 1):
                put(lx, y, lz, f"ladder[facing={facing}]")
    # telhado cônico oco
    r, y = R - 0.5, topo + 1
    while r >= 0:
        dentro_cone = set(disco(r - 1.3)) if r > 1.3 else set()
        for dx, dz in disco(r):
            if (dx, dz) not in dentro_cone:
                put(cx + dx, y, cz + dz, cor_telhado)
        r -= 0.55
        y += 1
    put(cx, y, cz, "gold_block")
    put(cx, y + 1, cz, "lightning_rod")
    if oca and porta_telhado:
        _abrir(cx, cz, R + 1, porta_telhado, (topo + 1, topo + 2), R - 3)


def _abrir(cx, cz, R, direcao, ys, desde):
    ux, uz = direcao
    norma = math.hypot(ux, uz)
    for dx, dz in disco(R + 1):
        proj = (dx * ux + dz * uz) / norma
        perp = abs(dx * uz - dz * ux) / norma
        if proj >= desde and perp <= 1.0:
            for y in ys:
                put(cx + dx, y, cz + dz, "air")


def torres():
    W = MURO
    for sx in (-1, 1):
        for sz in (-1, 1):
            cx, cz = sx * W, sz * W

            def passa(x, z, sx=sx, sz=sz, cx=cx, cz=cz):
                return ((MURO_INT <= sz * z <= W and sx * (x - cx) < 0) or
                        (MURO_INT <= sx * x <= W and sz * (z - cz) < 0))
            torre(cx, cz, TORRE_CANTO_R, TORRE_CANTO_TOPO, pisos=(6, 12, PASSADICO, 24), escada=(0, sz),
                  janelas=[((sx, 0), ys) for ys in ((3, 4), (9, 10), (15, 16), (21, 22), (27, 28))],
                  passadico=passa, porta_telhado=(-sx, -sz), porta_terreo=(-sx, -sz))
    # torres do meio das muralhas leste, oeste e norte
    for cx, cz, fora in ((W, 0, (1, 0)), (-W, 0, (-1, 0)), (0, -W, (0, -1))):
        ox, oz = fora

        def passa(x, z, cx=cx, cz=cz, ox=ox):
            dentro_muro = (MURO_INT <= abs(x) <= W) if ox else (MURO_INT <= abs(z) <= W)
            return dentro_muro and ((z != cz) if ox else (x != cx))
        lado = (oz, ox) if ox == 0 else (0, 1)
        torre(cx, cz, 7, 26, pisos=(9, PASSADICO), escada=lado,
              janelas=[(fora, (4, 5)), (fora, (12, 13)), (fora, (22, 23))],
              passadico=passa, porta_telhado=(-ox, -oz), porta_terreo=(-ox, -oz))


# ----------------------------------------------------------------- portão
def portao():
    W = MURO
    box(-9, 0, W - 8, 9, 24, W + 6, "stone_bricks")
    box(-10, 0, W - 9, 10, 2, W + 7, "cobblestone")
    for x in range(-9, 10):
        for z in range(W - 8, W + 7):
            if x in (-9, 9) or z in (W - 8, W + 6):
                put(x, 25, z, "stone_bricks")
                if ameias(x, z):
                    put(x, 26, z, "stone_bricks")
    # sala da guarita (sobre a passagem), com acesso pelo passadiço
    box(-8, 13, W - 7, 8, 23, W + 5, "air")
    box(-8, 12, W - 7, 8, 12, W + 5, "spruce_planks")
    for x in (-6, 0, 6):
        put(x, 23, W - 1, "lantern[hanging=true]")
    for x in range(-7, 8, 2):
        put(x, 13, W + 5, "air")
    for y in (PASSADICO + 1, PASSADICO + 2):
        for z in range(MURO_INT, W + 1):
            put(-9, y, z, "air")
            put(9, y, z, "air")
    box(-8, PASSADICO, MURO_INT, 8, PASSADICO, W, "spruce_planks")
    # escada interna da sala até o telhado
    for y in range(PASSADICO + 1, 25):
        put(0, y, W + 5, "ladder[facing=north]")
    put(0, 24, W + 5, "ladder[facing=north]")
    box(0, 24, W + 5, 0, 24, W + 5, "ladder[facing=north]")
    # balcão com mata-cães
    box(-7, 18, W + 7, 7, 22, W + 7, "stone_bricks")
    for x in range(-7, 8):
        put(x, 17, W + 7, "stone_brick_stairs[facing=north,half=top]")
        if ameias(x, W + 7):
            put(x, 23, W + 7, "stone_bricks")
    box(-1, 11, W + 7, 1, 15, W + 7, "chiseled_stone_bricks")
    # torres do portão
    for sx in (-1, 1):
        cx, cz = sx * 15, W + 2

        def passa(x, z, sx=sx, cx=cx):
            return MURO_INT <= z <= W and sx * (x - cx) > 0
        torre(cx, cz, 8, 30, pisos=(9, PASSADICO), escada=(-sx, 0),
              janelas=[((0, 1), (4, 5)), ((0, 1), (12, 13)), ((0, 1), (24, 25)), ((sx, 0), (12, 13))],
              passadico=passa, porta_telhado=(-sx, 0))
    # passagem em arco
    box(-4, 0, W - 9, 4, 8, W + 8, "air")
    box(-3, 9, W - 9, 3, 9, W + 8, "air")
    box(-2, 10, W - 9, 2, 10, W + 8, "air")
    box(-4, -1, W - 9, 4, -1, W + 8, "polished_andesite")
    for z in (W + 4,):
        for x in range(-4, 5):
            for y in (7, 8):
                put(x, y, z, "iron_bars")
        for x in range(-3, 4):
            put(x, 9, z, "iron_bars")
        for x in range(-2, 3):
            put(x, 10, z, "iron_bars")
    for z in (W - 6, W - 1, W + 6):
        put(0, 10, z, "lantern[hanging=true]")
    # ponte levadiça baixada
    a, b = FOSSO
    box(-4, -1, W + 9, 4, -1, b + 3, "spruce_planks")
    for z in range(W + 9, b + 4):
        for sx in (-5, 5):
            put(sx, -1, z, "dark_oak_log[axis=z]")
            put(sx, 0, z, "spruce_fence")
    for z in (W + 9, a - 1, b + 1, b + 3):
        for sx in (-5, 5):
            put(sx, 1, z, "spruce_fence")
            put(sx, 2, z, "lantern")
    for z in (a + 2, b - 2):
        box(-5, -5, z, -5, -2, z, "dark_oak_log")
        box(5, -5, z, 5, -2, z, "dark_oak_log")


# --------------------------------------------------------------- telhados e prédios
def telhado(x0, z0, x1, z1, y, mat="dark_oak", recheio="spruce_planks"):
    """Telhado de duas águas sobre o retângulo (beirais de 1 bloco), cumeeira no eixo mais longo."""
    if (x1 - x0) >= (z1 - z0):
        a, b, i = z0 - 1, z1 + 1, 0
        while a <= b:
            yy = y + i
            if a == b:
                box(x0 - 1, yy, a, x1 + 1, yy, a, f"{mat}_planks")
                box(x0 - 1, yy + 1, a, x1 + 1, yy + 1, a, f"{mat}_slab")
            else:
                box(x0 - 1, yy, a, x1 + 1, yy, a, f"{mat}_stairs[facing=south]")
                box(x0 - 1, yy, b, x1 + 1, yy, b, f"{mat}_stairs[facing=north]")
                if a + 1 <= b - 1:
                    box(x0, yy, a + 1, x1, yy, b - 1, recheio)
            a, b, i = a + 1, b - 1, i + 1
    else:
        a, b, i = x0 - 1, x1 + 1, 0
        while a <= b:
            yy = y + i
            if a == b:
                box(a, yy, z0 - 1, a, yy, z1 + 1, f"{mat}_planks")
                box(a, yy + 1, z0 - 1, a, yy + 1, z1 + 1, f"{mat}_slab")
            else:
                box(a, yy, z0 - 1, a, yy, z1 + 1, f"{mat}_stairs[facing=east]")
                box(b, yy, z0 - 1, b, yy, z1 + 1, f"{mat}_stairs[facing=west]")
                if a + 1 <= b - 1:
                    box(a + 1, yy, z0, b - 1, yy, z1, recheio)
            a, b, i = a + 1, b - 1, i + 1


def predio(x0, z0, x1, z1, altura, porta, parede="white_terracotta", piso="spruce_planks",
           pilar="spruce_log", base="cobblestone", mat_telhado="dark_oak", janelas=True):
    """Prédio retangular com telhado de duas águas. `porta` = ('north'|'south'|'east'|'west', posição)."""
    box(x0, 0, z0, x1, 0, z1, base)
    box(x0, 1, z0, x1, altura, z1, parede)
    for x in (x0, x1):
        for z in (z0, z1):
            box(x, 1, z, x, altura, z, pilar)
    box(x0, altura, z0, x1, altura, z1, "spruce_planks" if parede != "stone_bricks" else "stone_bricks")
    box(x0 + 1, 0, z0 + 1, x1 - 1, altura, z1 - 1, "air")
    box(x0 + 1, -1, z0 + 1, x1 - 1, -1, z1 - 1, piso)
    telhado(x0, z0, x1, z1, altura + 1, mat_telhado)
    lado, pos = porta
    if janelas:
        for x in range(x0 + 2, x1 - 1, 3):
            for z in (z0, z1):
                box(x, 2, z, x, 3, z, "glass_pane")
        for z in range(z0 + 2, z1 - 1, 3):
            for x in (x0, x1):
                box(x, 2, z, x, 3, z, "glass_pane")
    px, pz, facing = {"north": (pos, z0, "south"), "south": (pos, z1, "north"),
                      "east": (x1, pos, "west"), "west": (x0, pos, "east")}[lado]
    box(px, 0, pz, px, 0, pz, base)
    put(px, 1, pz, "air"); put(px, 2, pz, "air")
    m.porta(px, 1, pz, "spruce", facing)
    for x in range(x0 + 3, x1 - 1, 6):
        for z in range(z0 + 3, z1 - 1, 6):
            put(x, altura - 1, z, "lantern[hanging=true]")
    return (px, pz, facing)


# ------------------------------------------------------------- torre de menagem
def menagem():
    t = []
    box(KX1 - 1, 0, KZ1 - 1, KX2 + 1, 2, KZ2 + 1, "cobblestone")
    box(KX1, 0, KZ1, KX2, ANDARES[-1], KZ2, "stone_bricks")
    topo = ANDARES[-1]
    # pilastras de deepslate
    for x in range(KX1, KX2 + 1, 8):
        for z in (KZ1 - 1, KZ2 + 1):
            box(x, 3, z, x, topo - 2, z, "deepslate_bricks")
    for z in range(KZ1, KZ2 + 1, 8):
        for x in (KX1 - 1, KX2 + 1):
            box(x, 3, z, x, topo - 2, z, "deepslate_bricks")
    # faixas decorativas entre os andares
    for y in ANDARES[1:-1]:
        for x in range(KX1 - 1, KX2 + 2):
            for z in (KZ1 - 1, KZ2 + 1):
                put(x, y, z, "polished_andesite")
        for z in range(KZ1 - 1, KZ2 + 2):
            for x in (KX1 - 1, KX2 + 1):
                put(x, y, z, "polished_andesite")
    # parapeito
    for x in range(KX1 - 1, KX2 + 2):
        for z in range(KZ1 - 1, KZ2 + 2):
            if x in (KX1 - 1, KX2 + 1) or z in (KZ1 - 1, KZ2 + 1):
                put(x, topo - 1, z, "chiseled_stone_bricks")
                put(x, topo, z, "stone_bricks")
                put(x, topo + 1, z, "stone_bricks")
                if ameias(x, z):
                    put(x, topo + 2, z, "stone_bricks")
                    if (x + z) % 6 == 0:
                        put(x, topo + 3, z, "lantern")
    # torreões dos cantos
    for x in (KX1, KX2):
        for z in (KZ1, KZ2):
            torre(x, z, 6, 52, oca=False)

    # interior: andares
    box(IX1, 0, IZ1, IX2, topo - 1, IZ2, "air")
    for y in ANDARES[1:-1]:
        box(IX1, y, IZ1, IX2, y, IZ2, "dark_oak_planks")
    for x in range(IX1, IX2 + 1):
        for z in range(IZ1, IZ2 + 1):
            put(x, -1, z, "polished_andesite" if (x + z) % 2 == 0 else "polished_diorite")

    # porta principal (sul) em arco
    box(-3, 0, KZ2 - 1, 3, 5, KZ2 + 1, "air")
    box(-2, 6, KZ2 - 1, 2, 6, KZ2 + 1, "air")
    box(-1, 7, KZ2 - 1, 1, 7, KZ2 + 1, "air")
    for x in (-4, 4):
        box(x, 0, KZ2 + 1, x, 7, KZ2 + 1, "chiseled_stone_bricks")
        put(x, 8, KZ2 + 2, "lantern")
        put(x, 7, KZ2 + 2, "air")

    # janelas (vidro por fora, vão por dentro) em todos os andares
    for i, y0 in enumerate(ANDARES[:-1]):
        ys = range(y0 + 3, y0 + 8)
        for x in list(range(KX1 + 4, -4, 6)) + list(range(6, KX2 - 2, 6)):
            for y in ys:
                for (zo, zi) in ((KZ2, KZ2 - 1), (KZ1, KZ1 + 1)):
                    put(x, y, zo, "glass_pane"); put(x, y, zi, "air")
        for z in range(KZ1 + 4, KZ2 - 2, 6):
            for y in ys:
                for (xo, xi) in ((KX1, KX1 + 1), (KX2, KX2 - 1)):
                    put(xo, y, z, "glass_pane"); put(xi, y, z, "air")
    for x in range(-2, 3):
        for y in range(3, 10):
            put(x, y, KZ1, "red_stained_glass_pane" if abs(x) < 2 else "yellow_stained_glass_pane")
            put(x, y, KZ1 + 1, "air")

    terreo()
    t += primeiro_andar()
    segundo_andar()
    terceiro_andar()

    # escada de mão no canto nordeste, do térreo até o telhado
    lx, lz = ESCADA_K
    for y in range(0, topo + 1):
        put(lx, y, lz, "ladder[facing=west]")
    # grande torre central sobre o telhado
    torre(0, -28, 10, 66, y0=topo + 1, pisos=(55,), escada=(-1, 0),
          janelas=[(d, ys) for d in ((1, 0), (0, -1)) for ys in ((49, 50), (59, 60))],
          porta_terreo=(0, 1), porta_telhado=(0, 1), cor_telhado="deepslate_tiles")
    # observatório no topo da grande torre
    put(0, 67, -28, "air")
    return t


def paredes_internas(y0, y1, paredes, material="stone_bricks"):
    for (x1, z1, x2, z2) in paredes:
        box(x1, y0, z1, x2, y1, z2, material)


def vao(x, z, y0, eixo, largura=1, altura=3):
    """Abre uma passagem numa parede interna."""
    for d in range(-(largura // 2), largura - largura // 2):
        for y in range(y0, y0 + altura):
            if eixo == "x":
                put(x + d, y, z, "air")
            else:
                put(x, y, z + d, "air")


def mesa_comprida(x1, x2, z, y):
    """Mesa de banquete: tampos de laje sobre cercas, cadeiras de escada dos dois lados."""
    for x in range(x1, x2 + 1):
        put(x, y, z, "spruce_slab[type=top]")
        if x % 2 == 0:
            put(x, y, z - 1, "spruce_stairs[facing=south]")
            put(x, y, z + 1, "spruce_stairs[facing=north]")
    for x in range(x1, x2 + 1, 3):
        put(x, y + 1, z, "candle[candles=3,lit=true]")


def terreo():
    y0, y1 = 0, ANDARES[1] - 1
    # paredes: salão central x -10..10; alas oeste e leste
    paredes_internas(y0, y1, [(-11, IZ1, -11, IZ2), (11, IZ1, 11, IZ2), (IX1, -29, -12, -29), (12, -29, IX2, -29)])
    # cornija lisa no salão para esconder o pistão da porta secreta (que fica na parede x=-11)
    box(-10, y1 - 1, IZ1, -10, y1, IZ2, "polished_andesite")
    box(10, y1 - 1, IZ1, 10, y1, IZ2, "polished_andesite")
    vao(-11, -20, 0, "z", 3, 4)   # salão -> sala de jantar
    vao(11, -20, 0, "z", 3, 4)    # salão -> sala da guarda
    vao(11, -40, 0, "z", 3, 4)    # salão -> arsenal
    vao(-18, -29, 0, "x", 3, 3)   # jantar -> cozinha
    # --- salão do trono
    for x in (-7, 7):
        for z in range(-12, IZ1, -7):
            box(x, 0, z, x, y1 - 1, z, "polished_deepslate")
            put(x, y1 - 1, z, "chiseled_deepslate")
    box(-1, 0, IZ2 - 1, 1, 0, -42, "red_carpet")
    box(-5, 0, IZ1, 5, 0, -44, "polished_deepslate")
    box(-4, 1, IZ1, 4, 1, -46, "polished_deepslate")
    for x in range(-5, 6):
        put(x, 0, -43, "polished_deepslate_stairs[facing=north]")
    for x in range(-4, 5):
        put(x, 1, -45, "polished_deepslate_stairs[facing=north]")
    put(0, 2, -47, "quartz_stairs[facing=north]")
    put(-1, 2, -47, "quartz_slab"); put(1, 2, -47, "quartz_slab")
    box(-1, 2, -48, 1, 5, -48, "gold_block")
    put(0, 6, -48, "gold_block")
    put(-3, 2, -47, "gold_block"); put(3, 2, -47, "gold_block")
    put(-3, 3, -47, "lantern"); put(3, 3, -47, "lantern")
    for z in (-14, -24, -34):
        for x in (-4, 0, 4):
            put(x, y1 - 1, z, "lantern[hanging=true]")
    # --- cozinha (noroeste)
    for x in range(IX1, -12, 2):
        put(x, 0, IZ1, "furnace[facing=south,lit=false]")
        put(x + 1, 0, IZ1, "smoker[facing=south,lit=false]")
    box(IX1, 0, -40, IX1, 0, -32, "barrel[facing=east,open=false]")
    eq.bau(IX1, 0, -36, "east", "cozinha", tipo="barrel")
    eq.bau(IX1, 1, -36, "east", "cozinha", tipo="barrel")
    box(-17, 0, -40, -13, 0, -38, "spruce_planks")
    put(-15, 1, -39, "cake")
    put(-16, 0, -36, "water_cauldron[level=3]")
    put(-14, 0, -36, "crafting_table")
    put(-18, 0, -32, "campfire[facing=north,lit=true,signal_fire=false,waterlogged=false]")
    put(-18, y1 - 1, -38, "lantern[hanging=true]")
    # --- sala de jantar (sudoeste)
    mesa_comprida(-22, -14, -18, 0)
    for z in (-14, -24):
        put(-18, y1 - 1, z, "lantern[hanging=true]")
    # --- arsenal (nordeste)
    for z in range(IZ1 + 1, -31, 3):
        eq.bau(IX2, 0, z, "west", "arsenal_diamante")
    put(16, 0, IZ1, "anvil[facing=north]")
    put(18, 0, IZ1, "grindstone[face=floor,facing=north]")
    put(20, 0, IZ1, "smithing_table")
    put(14, 0, -32, "fletching_table")
    put(18, y1 - 1, -38, "lantern[hanging=true]")
    # --- sala da guarda (sudeste) com alçapão para a masmorra
    mesa_comprida(14, 20, -18, 0)
    for z in (-14, -24):
        put(18, y1 - 1, z, "lantern[hanging=true]")
    for y in range(-8, 0):
        put(22, y, -10, "ladder[facing=west]")
    put(22, -1, -10, "ladder[facing=west]")
    put(23, 0, -10, "spruce_planks")
    ordenado(22, 0, -10, "spruce_trapdoor[facing=west,half=top,open=false,powered=false,waterlogged=false]")


def primeiro_andar():
    y0 = ANDARES[1] + 1
    y1 = ANDARES[2] - 1
    # biblioteca no centro; ala leste = escritório do rei; ala oeste = sala secreta (só pela estante!)
    box(-11, y0, IZ1, -11, y1, IZ2, "bookshelf")
    box(-10, y0 + 2, IZ1, -10, y1, IZ2, "bookshelf")      # estante "funda" esconde o pistão de cima
    paredes_internas(y0, y1, [(11, IZ1, 11, IZ2)])
    vao(11, -40, y0, "z", 1, 2)
    m.porta(11, y0, -40, "dark_oak", "east")
    for z in range(IZ1 + 1, IZ2, 4):
        box(-6, y0, z, 6, y0 + 3, z, "bookshelf")
        box(-1, y0, z, 1, y0 + 3, z, "air")
    for x in range(-9, 11):
        for y in range(y0, y0 + 4):
            put(x, y, IZ1, "bookshelf")
    put(0, y0, -28, "enchanting_table")
    eq.bau(2, y0, IZ1 + 1, "south", "biblioteca")
    eq.bau(-2, y0, IZ1 + 1, "south", "biblioteca")
    for x in (-8, 8):
        for z in range(-12, IZ1, -8):
            put(x, y1, z, "lantern[hanging=true]")
    # escritório do rei (leste)
    put(18, y0, -20, "cartography_table")
    put(20, y0, -20, "lectern[facing=west,has_book=false,powered=false]")
    box(14, y0, -14, 22, y0, -14, "red_carpet")
    put(18, y1, -18, "lantern[hanging=true]")
    put(18, y1, -38, "lantern[hanging=true]")
    # sala secreta (oeste): piso, iluminação e o topo dos elevadores
    box(IX1, ANDARES[1], IZ1, -12, ANDARES[1], IZ2, "spruce_planks")
    for z in (-14, -24, -36):
        put(-18, y1, z, "lantern[hanging=true]")
    px, pz = PORTA_SECRETA
    q = rs.Quadro(px, y0, pz, "south", "west")
    teste = rs.porta_secreta_biblioteca(q)
    return [teste]


def segundo_andar():
    y0, y1 = ANDARES[2] + 1, ANDARES[3] - 1
    # aposentos: rei (norte), rainha (sul), dois quartos de hóspedes nas alas
    paredes_internas(y0, y1, [(-11, IZ1, -11, IZ2), (11, IZ1, 11, IZ2), (-10, -28, 10, -28),
                              (IX1, -28, -12, -28), (12, -28, IX2, -28)])
    for x, z, eixo in ((0, -28, "x"), (-11, -18, "z"), (11, -18, "z"), (-11, -38, "z"), (11, -38, "z")):
        vao(x, z, y0, eixo, 1, 2)
    box(-10, ANDARES[2] + 1, -27, 10, ANDARES[2] + 1, -27, "air")
    box(-3, y0, IZ1 + 2, 3, y0, -36, "red_carpet")
    m.cama(-1, y0, IZ1 + 2, "red", "north")
    m.cama(1, y0, IZ1 + 2, "red", "north")
    eq.bau(-3, y0, IZ1, "south", "rei")
    eq.bau(3, y0, IZ1, "south", "suprimentos")
    box(-3, y0, -24, 3, y0, -12, "blue_carpet")
    m.cama(-1, y0, IZ2 - 1, "light_blue", "south")
    m.cama(1, y0, IZ2 - 1, "light_blue", "south")
    put(-5, y0, IZ2, "flower_pot")
    for (x, z, cor) in ((-18, -40, "green"), (18, -40, "yellow"), (-18, -16, "cyan"), (18, -16, "orange")):
        m.cama(x, y0, z, cor, "north")
        eq.bau(x + 2, y0, z - 1, "south", "pocoes")
        put(x, y1, z + 4, "lantern[hanging=true]")
    for z in (-14, -40):
        put(0, y1, z, "lantern[hanging=true]")


def terceiro_andar():
    y0, y1 = ANDARES[3] + 1, ANDARES[4] - 1
    # salão de festas no centro, capela real a oeste, sala do tesouro (de mentira) a leste
    paredes_internas(y0, y1, [(-11, IZ1, -11, IZ2), (11, IZ1, 11, IZ2)])
    vao(-11, -28, y0, "z", 3, 4)
    vao(11, -28, y0, "z", 3, 4)
    for x in range(-10, 11):
        for z in range(IZ1, IZ2 + 1):
            put(x, ANDARES[3], z, "white_concrete" if (x // 2 + z // 2) % 2 else "black_concrete")
    for z in (-14, -22, -34, -42):
        for x in (-5, 5):
            put(x, y1, z, "glowstone")
    for x in (-10, 10):
        for z in range(IZ1, IZ2 + 1, 4):
            put(x, y0, z, "note_block")
    # capela
    for z in range(-44, -12, 3):
        box(-22, y0, z, -14, y0, z, "spruce_stairs[facing=north]")
    box(-20, y0, -47, -16, y0, -47, "quartz_block")
    put(-18, y0 + 1, -47, "candle[candles=4,lit=true]")
    for z in range(KZ1 + 4, KZ2 - 2, 6):
        for y in range(y0 + 2, y0 + 7):
            put(KX1, y, z, "purple_stained_glass_pane")
    # sala do tesouro (falsa: o tesouro de verdade está no cofre do QG...)
    box(14, y0, -46, 22, y0, -46, "gold_block")
    eq.bau(18, y0 + 1, -46, "south", "quartel")
    put(18, y1, -30, "lantern[hanging=true]")


# --------------------------------------------------------------------- pátio
def patio():
    W = MURO_INT
    # caminho do portão até a torre de menagem + praça
    box(-2, -1, KZ2 + 1, 2, -1, W - 1, "dirt_path")
    box(-12, -1, 18, 12, -1, 30, "dirt_path")
    for sx in (-1, 1):
        cx, cz = sx * 7, 24
        box(cx - 2, -1, cz - 2, cx + 2, 0, cz + 2, "stone_bricks")
        box(cx - 1, 0, cz - 1, cx + 1, 0, cz + 1, "water")
        put(cx, 0, cz, "stone_bricks")
        put(cx, 1, cz, "stone_bricks")
        put(cx, 2, cz, "lantern")
    testes = []
    # postes automáticos ao longo do caminho
    for z in (4, 12, 36, 44, 52):
        for x in (-4, 4):
            t = rs.poste_automatico(rs.Quadro(x, 0, z, "east", "south"))
            if not testes:
                testes.append(t)
    # prédios
    portas = []
    portas.append(predio(-54, -42, -36, -24, 7, ("east", -33), parede="stone_bricks",
                         pilar="polished_andesite", mat_telhado="dark_oak"))           # capela
    for z in range(-38, -27, 3):
        box(-50, 0, z, -42, 0, z, "spruce_stairs[facing=north]")
    box(-53, 0, -41, -51, 0, -39, "quartz_block")
    for z in range(-40, -25, 3):
        for y in (2, 3, 4):
            put(-54, y, z, "light_blue_stained_glass_pane")
    portas.append(predio(-54, -16, -36, 4, 6, ("east", -6)))                            # quartel
    for z in range(-14, 3, 3):
        m.cama(-52, 0, z, "red", "west")
        m.cama(-41, 0, z, "red", "east")
    for z in (-15, -9, -3):
        eq.bau(-47, 0, z, "east", "quartel")
    portas.append(predio(-54, 12, -40, 30, 6, ("east", 21)))                            # ferreiro
    put(-50, 0, 14, "anvil[facing=north]")
    put(-47, 0, 14, "blast_furnace[facing=south,lit=false]")
    put(-45, 0, 14, "furnace[facing=south,lit=false]")
    put(-52, 0, 20, "lava_cauldron")
    put(-52, 0, 24, "smithing_table")
    put(-50, 0, 28, "grindstone[face=floor,facing=north]")
    eq.bau(-42, 0, 14, "south", "ferreiro")
    portas.append(predio(36, -42, 54, -24, 7, ("west", -33), parede="spruce_planks"))   # estábulo
    for z in range(-40, -26, 4):
        box(46, 0, z, 53, 0, z, "spruce_fence")
        put(52, 0, z + 2, "hay_block")
    portas.append(predio(38, -16, 54, 4, 6, ("west", -6)))                              # taverna
    for z in (-12, -6, 0):
        put(46, 0, z, "spruce_fence"); put(46, 1, z, "spruce_pressure_plate")
        put(45, 0, z, "spruce_stairs[facing=east]"); put(47, 0, z, "spruce_stairs[facing=west]")
    box(52, 0, -14, 52, 1, 2, "barrel[facing=west,open=false]")
    eq.bau(52, 0, -6, "west", "cozinha", tipo="barrel")
    # fazenda (leste-sul)
    box(38, -1, 12, 54, -1, 30, "farmland[moisture=7]")
    for z in (15, 21, 27):
        box(38, -1, z, 54, -1, z, "water")
    for x in range(38, 55):
        for z in range(12, 31):
            if get(x, -1, z) == "minecraft:farmland[moisture=7]":
                put(x, 0, z, "wheat[age=7]" if (x + z) % 3 else "carrots[age=7]")
    for x in range(37, 56):
        put(x, 0, 11, "oak_fence"); put(x, 0, 31, "oak_fence")
    for z in range(11, 32):
        put(37, 0, z, "oak_fence"); put(55, 0, z, "oak_fence")
    put(37, 0, 21, "air")
    # casinhas perto do portão
    for x0 in (-50, -40, 32, 42):
        predio(x0, 40, x0 + 7, 47, 5, ("north", x0 + 3))
    # poço (entrada secreta do Refúgio)
    return testes, portas


ARVORES = [(-24, 10), (24, 6), (-30, -56), (30, -56), (-12, -56), (12, -56), (-26, 50), (26, 52), (-30, 32)]


# ------------------------------------------------------------------ decoração
CORES_ESTANDARTE = ("red", "yellow", "blue", "red", "black", "yellow")


def decorar():
    """Estandartes, jardins, bancos e enfeites espalhados pelo castelo."""
    W = MURO_INT
    # estandartes na fachada da torre de menagem (sobre as pilastras) e nas faces internas da muralha
    for x in range(KX1, KX2 + 1, 8):
        if abs(x) > 5:
            for y in (9, 20, 31):
                put(x, y, KZ2 + 2, "red_wall_banner[facing=south]")
                put(x, y, KZ1 - 2, "red_wall_banner[facing=north]")
    for z in range(KZ1, KZ2 + 1, 8):
        for y in (9, 20, 31):
            put(KX1 - 2, y, z, "blue_wall_banner[facing=west]")
            put(KX2 + 2, y, z, "blue_wall_banner[facing=east]")
    for i, t in enumerate(range(-48, 49, 12)):
        cor = CORES_ESTANDARTE[i % len(CORES_ESTANDARTE)]
        for (x, z, f) in ((t, -W + 1, "south"), (-W + 1, t, "east"), (W - 1, t, "west")):
            if get(x, 12, z) == "minecraft:air":
                put(x, 12, z, f"{cor}_wall_banner[facing={f}]")
    for x in (-10, 10):
        put(x, 18, MURO + 9, "red_wall_banner[facing=south]")
    # salão do trono: estandartes atrás do trono e tapetes nas laterais
    for x in (-6, 6):
        put(x, 7, IZ1, "purple_wall_banner[facing=south]")
    for x in (-9, 9):
        box(x, 0, -40, x, 0, -12, "purple_carpet")
    # vasos de flores e velas nos cômodos
    vasos = ("potted_poppy", "potted_blue_orchid", "potted_red_tulip", "potted_allium", "potted_fern",
             "potted_azure_bluet", "potted_oxeye_daisy", "potted_lily_of_the_valley")
    for i, (x, y, z) in enumerate([(-22, 1, -18), (-14, 1, -18), (16, 1, -18), (20, 1, -18),
                                    (-20, 12, -10), (20, 12, -10), (-8, 23, IZ2), (8, 23, IZ2),
                                    (-20, 23, -24), (20, 23, -24), (-8, 34, IZ2), (8, 34, IZ2)]):
        if get(x, y, z) == "minecraft:air":
            put(x, y, z, vasos[i % len(vasos)])
    for x, z in ((-20, -24), (20, -24), (-20, -44), (20, -44)):
        put(x, 23, z, "white_carpet")
    for x in range(-20, -13):
        for z in range(-24, -9):
            if get(x, 23, z) == "minecraft:air" and (x + z) % 5 == 0:
                put(x, 23, z, "light_blue_carpet")
    # jardim na frente da torre de menagem: canteiros, cercas-vivas e bancos
    flores = ("poppy", "dandelion", "cornflower", "allium", "oxeye_daisy", "red_tulip", "azure_bluet")
    for sx in (-1, 1):
        for x in range(8 * sx, 20 * sx, sx):
            for z in (-2, 12):
                put(x, 0, z, "azalea_leaves[persistent=true,distance=1,waterlogged=false]")
            for z in range(0, 11):
                put(x, -1, z, "grass_block")
                if (x + z) % 2 == 0:
                    put(x, 0, z, flores[(x * 3 + z) % len(flores)])
        for z in (3, 7):
            put(6 * sx, 0, z, "spruce_stairs[facing=%s]" % ("east" if sx < 0 else "west"))
    # bancos na praça
    for x in (-11, 11):
        for z in (19, 22, 26, 29):
            put(x, 0, z, "spruce_stairs[facing=%s]" % ("east" if x < 0 else "west"))
    # tochas e lanternas nas casinhas e flores nas janelas da muralha interna
    for x in range(-56, 57, 8):
        for z in (-W + 1, W - 3):
            if get(x, 0, z) == "minecraft:air" and get(x, -1, z) == "minecraft:grass_block":
                put(x, 0, z, flores[(x // 8) % len(flores)])
