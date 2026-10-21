"""Os pontos famosos de Nova York (e da Marvel) da cidade. Coordenadas da cidade (ver cidade.py)."""
import math
import random

import numpy as np

import modelo as m
import cidade as c
from cidade import P, BX, G, col, I, novo, blit, escrever, no_ladrilho, reservar, arvore, arvore_calcada

TS = (-90, -30)                    # Times Square: Broadway cruza a 7ª Avenida


def reservas():
    c.RESERVADOS.clear()
    reservar("empire", 30, 77, 119, 112)
    reservar("flatiron", 30, 127, 119, 162)
    reservar("grand_central", 140, -23, 229, 12)
    reservar("vingadores", 140, -73, 229, -38)
    reservar("chrysler", 250, -23, 339, 12)
    reservar("rockefeller", -80, -123, 9, -88)
    reservar("baxter", 30, -73, 119, -38)
    reservar("bugle", -190, 27, -101, 62)
    reservar("msg", -190, 77, -101, 112)
    reservar("wsp1", -80, 227, 9, 262)
    reservar("wsp2", 30, 227, 119, 262)
    reservar("sanctum", -262, 177, -244, 194)
    reservar("wtc", -410, 327, -321, 362)
    reservar("memorial", -410, 377, -321, 412)
    reservar("nyse", 140, 377, 229, 412)
    reservar("ponte_m", 360, 327, 420, 362)
    reservar("ponte_b", 466, 327, 512, 362)
    reservar("guggenheim", 30, -423, 119, -388)
    reservar("parker", 568, 9, 586, 26)
    import monumentos
    monumentos.reservas()


def todos():
    for nome, f, caixa in (
        ("central_park", central_park, c.CENTRAL_PARK),
        ("times_square", times_square, (-200, -90, 20, 30)),
        ("empire", empire_state, (30, 77, 119, 112)),
        ("flatiron", flatiron, (30, 127, 119, 162)),
        ("grand_central", grand_central, (140, -23, 229, 12)),
        ("vingadores", torre_vingadores, (140, -80, 229, -38)),
        ("chrysler", chrysler, (250, -23, 339, 12)),
        ("rockefeller", rockefeller, (-80, -123, 9, -88)),
        ("baxter", baxter, (30, -73, 119, -38)),
        ("bugle", daily_bugle, (-190, 27, -101, 62)),
        ("msg", madison_square_garden, (-190, 77, -101, 112)),
        ("wsp", washington_square, (-80, 220, 119, 270)),
        ("sanctum", sanctum, (-262, 170, -244, 194)),
        ("wtc", one_wtc, (-410, 327, -321, 412)),
        ("nyse", wall_street, (140, 377, 229, 412)),
        ("touro", touro, (150, 400, 190, 430)),
        ("ponte", ponte_brooklyn, (355, 325, 515, 364)),
        ("liberdade", estatua_liberdade, (-275, 445, -225, 495)),
        ("guggenheim", guggenheim, (30, -423, 119, -388)),
        ("parker", casa_parker, (568, 4, 586, 26)),
        ("dique", dique_sul, (116, 420, 143, 499)),
    ):
        if no_ladrilho(*caixa, margem=12):
            f()
    import monumentos
    monumentos.todos()


# ------------------------------------------------------------------ utilidades
def prisma(x1, z1, x2, z2, y0, y1, parede, vidro, faixa=None, passo=2, andar=4, luz=True, teto=True):
    """Bloco de prédio oco com janelas em listras verticais e faixas a cada andar."""
    faixa = faixa or parede
    BX(x1, y0, z1, x2, y1 - 1, z2, parede)
    BX(x1 + 1, y0, z1 + 1, x2 - 1, y1 - 1, z2 - 1, "air")
    for x in range(x1 + 1, x2):
        if (x - x1) % passo == 1 % passo:
            col(x, z1, y0 + 1, y1 - 2, vidro); col(x, z2, y0 + 1, y1 - 2, vidro)
    for z in range(z1 + 1, z2):
        if (z - z1) % passo == 1 % passo:
            col(x1, z, y0 + 1, y1 - 2, vidro); col(x2, z, y0 + 1, y1 - 2, vidro)
    for y in range(y0 + andar, y1 - 1, andar):
        BX(x1 + 1, y, z1 + 1, x2 - 1, y, z2 - 1, c.PISO)
        if faixa != parede:
            for (a, b, cc, d) in ((x1 + 1, z1, x2 - 1, z1), (x1 + 1, z2, x2 - 1, z2),
                                  (x1, z1 + 1, x1, z2 - 1), (x2, z1 + 1, x2, z2 - 1)):
                BX(a, y, b, cc, y, d, faixa)
    if teto:
        BX(x1, y1 - 1, z1, x2, y1 - 1, z2, parede)
    if luz:
        for x in range(x1 + 4, x2 - 2, 9):
            for z in range(z1 + 4, z2 - 2, 9):
                col(x, z, y0, y1 - 2, "sea_lantern")


def escada_mao(x, z, y0, y1, parede="polished_andesite"):
    """Núcleo com escada de mão (subida de y0 até y1, atravessando os pisos)."""
    col(x, z, y0, y1, parede)
    col(x + 1, z, y0, y1, "ladder[facing=east]")


def linha(p, q, b, grossura=0):
    """Linha 3D de blocos de p até q."""
    n = int(max(abs(q[i] - p[i]) for i in range(3))) + 1
    for k in range(n + 1):
        t = k / max(n, 1)
        x, y, z = (round(p[i] + (q[i] - p[i]) * t) for i in range(3))
        for dx in range(-grossura, grossura + 1):
            for dz in range(-grossura, grossura + 1):
                P(x + dx, y, z + dz, b)


def escrever_chao(texto, x0, z0, cor, u=(1, 0), escala=1):
    """Escreve no chão (y = -1): `u` é a direção da leitura; a parte de cima das letras fica a -z."""
    px, _ = c.es.pixels(texto)
    ux, uz = u
    vx, vz = (uz, -ux)
    for cc, r in px:
        for a in range(escala):
            for b in range(escala):
                i, j = cc * escala + a, r * escala + b
                P(x0 + ux * i + vx * j, -1, z0 + uz * i + vz * j, cor)


# ------------------------------------------------------------------ Central Park
def central_park():
    x1, z1, x2, z2 = c.CENTRAL_PARK
    rnd = random.Random(59)
    ocupado = set()

    def marcar(xa, za, xb, zb, folga=2):
        for x in range(xa - folga, xb + folga + 1):
            for z in range(za - folga, zb + folga + 1):
                ocupado.add((x, z))

    # muro baixo de pedra em volta, com entradas
    for x in range(x1, x2 + 1):
        for z in (z1, z2):
            if (x - x1) % 40 > 5:
                P(x, 0, z, "stone_bricks")
    for z in range(z1, z2 + 1):
        for x in (x1, x2):
            if (z - z1) % 40 > 5:
                P(x, 0, z, "stone_bricks")
    # o Reservatório (Jacqueline Kennedy Onassis), com pista de corrida e grade
    rx, rz, ax, az = -90, -425, 68, 42
    for x in range(rx - ax - 4, rx + ax + 5):
        for z in range(rz - az - 4, rz + az + 5):
            d = ((x - rx) / ax) ** 2 + ((z - rz) / az) ** 2
            if d <= 1:
                col(x, z, -4, -1, "water"); P(x, -5, z, "sand")
            elif d <= 1.16:
                P(x, -1, z, "dirt_path")
                if d <= 1.05:
                    P(x, 0, z, "iron_bars")
                ocupado.add((x, z))
    marcar(rx - ax, rz - az, rx + ax, rz + az, 3)
    # o Lago, com a Ponte Bow e o Terraço Bethesda
    lagos = [(-125, -300, 26), (-100, -292, 22), (-150, -318, 18), (-80, -305, 14)]
    for x in range(-190, 10):
        for z in range(-345, -265):
            if any((x - a) ** 2 + (z - b) ** 2 <= r * r for a, b, r in lagos):
                col(x, z, -3, -1, "water"); P(x, -4, z, "sand")
                ocupado.add((x, z))
    for x in range(-115, -94):                               # Ponte Bow (ferro fundido, em arco)
        y = int(2 - abs(x + 104) * 0.15)
        BX(x, y, -318, x, y, -315, "white_concrete")
        P(x, y + 1, -318, "iron_bars"); P(x, y + 1, -315, "iron_bars")
        col(x, -318, -1, y - 1, "air") if False else None
    marcar(-115, -318, -94, -315)
    bx, bz = -95, -272                                       # Bethesda: terraço e fonte com o anjo
    BX(bx - 22, -1, bz - 4, bx + 22, -1, bz + 14, "smooth_sandstone")
    for x in range(bx - 22, bx + 23):
        if (x - bx) % 6 != 0:
            P(x, 0, bz + 14, "sandstone_wall" if False else "smooth_sandstone_slab[type=bottom]")
    for dx in range(-8, 9):
        for dz in range(-8, 9):
            r = math.hypot(dx, dz)
            if r <= 8:
                P(bx + dx, 0, bz + 4 + dz, "smooth_sandstone" if r > 7 else "water")
    col(bx, bz + 4, 0, 4, "smooth_sandstone")
    col(bx, bz + 4, 5, 9, "oxidized_copper")                 # o Anjo das Águas
    for k in (1, 2, 3):
        P(bx - k, 8 - (k // 2), bz + 4, "oxidized_copper"); P(bx + k, 8 - (k // 2), bz + 4, "oxidized_copper")
    P(bx, 10, bz + 4, "oxidized_copper")
    marcar(bx - 22, bz - 4, bx + 22, bz + 14)
    # Castelo Belvedere, em cima de uma pedra
    kx, kz = -60, -365
    for dx in range(-9, 10):
        for dz in range(-7, 8):
            if dx * dx / 81 + dz * dz / 49 <= 1:
                col(kx + dx, kz + dz, 0, 3 - int(abs(dx) / 4), "stone")
    BX(kx - 5, 4, kz - 4, kx + 5, 9, kz + 4, "stone_bricks")
    BX(kx - 4, 4, kz - 3, kx + 4, 8, kz + 3, "air")
    for x in range(kx - 5, kx + 6, 2):
        P(x, 10, kz - 4, "stone_bricks"); P(x, 10, kz + 4, "stone_bricks")
    BX(kx + 2, 4, kz - 4, kx + 5, 17, kz - 1, "stone_bricks")
    for x in range(kx + 2, kx + 6, 2):
        P(x, 18, kz - 4, "stone_bricks"); P(x, 18, kz - 1, "stone_bricks")
    P(kx, 4, kz + 4, "air"); P(kx, 5, kz + 4, "air")
    marcar(kx - 9, kz - 7, kx + 9, kz + 7)
    # pista de patinação Wollman
    for x in range(-60, -14):
        for z in range(-232, -206):
            d = ((x + 37) / 23) ** 2 + ((z + 219) / 13) ** 2
            if d <= 1:
                P(x, -1, z, "packed_ice")
            elif d <= 1.2:
                P(x, -1, z, "smooth_stone"); P(x, 0, z, "white_concrete" if d <= 1.08 else "air")
    marcar(-60, -232, -14, -206)
    # Strawberry Fields: o mosaico "IMAGINE"
    mx, mz = -168, -245
    for dx in range(-9, 10):
        for dz in range(-9, 10):
            r = math.hypot(dx, dz)
            if r <= 9:
                ang = math.atan2(dz, dx)
                P(mx + dx, -1, mz + dz, "black_concrete" if int(r + ang * 3) % 3 == 0 else "white_concrete")
    escrever_chao("IMAGINE", mx - 20, mz + 3, "black_concrete") if False else None
    escrever_chao("IMAGINE", mx - 20, mz - 12, "white_concrete")
    marcar(mx - 21, mz - 20, mx + 21, mz + 9)
    # Museu Metropolitano (Met), na beira do parque, de frente para a 5ª Avenida
    _met(-28, -385, 8, -330)
    marcar(-28, -385, 8, -330, 3)
    # caminhos curvos
    for k in range(6):
        zc = z1 + 20 + k * 52
        for x in range(x1 + 2, x2 - 1):
            z = int(zc + 12 * math.sin((x + k * 37) / 23))
            if z1 < z < z2 and (x, z) not in ocupado:
                for dz in (0, 1, 2):
                    P(x, -1, z + dz, "dirt_path")
                ocupado.update({(x, z), (x, z + 1), (x, z + 2)})
    for k in range(4):
        xc = x1 + 25 + k * 50
        for z in range(z1 + 2, z2 - 1):
            x = int(xc + 10 * math.sin((z + k * 53) / 29))
            if x1 < x < x2 and (x, z) not in ocupado:
                for dx in (0, 1, 2):
                    P(x + dx, -1, z, "dirt_path")
                ocupado.update({(x, z), (x + 1, z), (x + 2, z)})
                if z % 30 == 0:
                    P(x - 1, 0, z, "spruce_stairs[facing=east]")
                if z % 24 == 12:
                    c._poste(x + 3, z, 1, 0)
    # árvores (o Sheep Meadow, ao sul, fica aberto)
    for _ in range(1400):
        x, z = rnd.randint(x1 + 3, x2 - 3), rnd.randint(z1 + 3, z2 - 3)
        if -170 < x < -110 and -260 < z < -195:
            continue
        if any((x + dx, z + dz) in ocupado for dx in (-2, 0, 2) for dz in (-2, 0, 2)):
            continue
        arvore(x, z, rnd.choice([4, 5, 6, 7]), rnd.choice(["oak", "oak", "birch", "dark_oak"]))
        marcar(x, z, x, z, 2)


def _met(x1, z1, x2, z2):
    """Fachada do Met: colunas duplas, três arcos e os estandartes, de frente para o leste."""
    pedra = "smooth_sandstone"
    prisma(x1, z1, x2, z2, 0, 24, pedra, "glass", passo=4, andar=8)
    xf = x2
    zc = (z1 + z2) // 2
    BX(xf + 1, 0, zc - 22, xf + 1, 22, zc + 22, pedra)
    for k in (-14, 0, 14):                                    # três grandes arcos
        for z in range(zc + k - 4, zc + k + 5):
            for y in range(1, 16):
                r = math.hypot(z - (zc + k), y - 10)
                if y <= 10 and abs(z - zc - k) <= 4 or y > 10 and r <= 4.5:
                    P(xf + 1, y, z, "glass" if y > 3 else "air")
                    P(xf, y, z, "air")
    for k in (-20, -9, -7, 7, 9, 20):                        # pares de colunas
        col(xf + 2, zc + k, 0, 20, "quartz_pillar")
    BX(xf + 2, 21, zc - 22, xf + 2, 22, zc + 22, "smooth_quartz")
    for k, cor in ((-14, "red_wool"), (0, "light_blue_wool"), (14, "yellow_wool")):   # estandartes
        col(xf + 3, zc + k - 1, 10, 18, cor); col(xf + 3, zc + k + 1, 10, 18, cor)
    for z in range(zc - 24, zc + 25):                        # escadaria
        for k in range(3):
            P(xf + 3 + k, k - 1 if False else 0, z, "smooth_sandstone_slab[type=bottom]" if k == 2 else "smooth_sandstone")


# ------------------------------------------------------------------ Times Square
TELOES = ["red_concrete", "blue_concrete", "yellow_concrete", "lime_concrete", "magenta_concrete", "orange_concrete",
          "cyan_concrete", "purple_concrete", "white_concrete", "pink_concrete"]
PALAVRAS = ["TIMES SQ", "NEW YORK", "MARVEL", "BROADWAY", "AVENGERS", "I LOVE NY", "DAILY BUGLE", "SPIDER", "STARK",
            "COCA", "NASDAQ", "OSCORP", "ROXXON"]


def teloes(x1, z1, x2, z2, niveis, seed):
    """Telões coloridos nas fachadas (prédios em volta da Times Square)."""
    rnd = random.Random(seed)
    alt = min(niveis[0][1] - 2, 44)
    for lado in "nswe":
        if lado in "ns":
            z = z1 - 1 if lado == "n" else z2 + 1
            a, b = x1, x2
        else:
            x = x1 - 1 if lado == "w" else x2 + 1
            a, b = z1, z2
        y = 6
        while y + 8 < alt:
            h = rnd.choice([8, 10, 12, 14])
            cor = rnd.choice(TELOES)
            if y + h > alt:
                break
            for k in range(a, b + 1):
                for yy in range(y, y + h):
                    if lado in "ns":
                        P(k, yy, z, cor)
                    else:
                        P(x, yy, k, cor)
            palavra = rnd.choice(PALAVRAS)
            largura = len(palavra) * 6 - 1
            if largura <= b - a - 2 and h >= 10:
                letra = "white_concrete" if cor not in ("white_concrete", "yellow_concrete") else "black_concrete"
                meio = (a + b) // 2
                # quem olha a face n para o sul tem o oeste à direita, e assim por diante
                if lado == "n":
                    escrever(palavra, (meio + largura // 2, y + 2, z), (-1, 0), letra)
                elif lado == "s":
                    escrever(palavra, (meio - largura // 2, y + 2, z), (1, 0), letra)
                elif lado == "w":
                    escrever(palavra, (x, y + 2, meio - largura // 2), (0, 1), letra)
                else:
                    escrever(palavra, (x, y + 2, meio + largura // 2), (0, -1), letra)
            else:
                for k in range(a + 1, b, 3):
                    for yy in range(y + 1, y + h - 1, 3):
                        if (k + yy) % 2:
                            if lado in "ns":
                                P(k, yy, z, "glowstone")
                            else:
                                P(x, yy, k, "glowstone")
            y += h + rnd.choice([1, 2, 3])


def times_square():
    """A praça: a Broadway vira calçadão, com a arquibancada vermelha (TKTS) e a bola do Ano Novo."""
    tx, tz = TS
    for x in range(tx - 60, tx + 61):
        for z in range(tz - 60, tz + 61):
            if not no_ladrilho(x, z, x, z, 0):
                continue
            d = float(c.dist_broadway(x, z))
            if d < 6 and math.hypot(x - tx, z - tz) < 60 and not (tx - 6 <= x <= tx + 5):
                P(x, -1, z, "smooth_stone" if (x + z) % 5 else "red_concrete")
    # arquibancada vermelha do TKTS
    ax, az = -66, -2
    for k in range(8):
        BX(ax, 0, az + k, ax + 11, k, az + k, "red_concrete")
        BX(ax, k + 1, az + k, ax + 11, k + 1, az + k, "red_nether_brick_stairs[facing=south]" if False else "air")
    BX(ax, 0, az - 2, ax + 11, 2, az - 1, "glass")
    # a bola do Ano Novo no alto de um prédio (One Times Square)
    bx, bz, by = tx + 4, tz + 20, 0
    if no_ladrilho(bx - 6, bz - 6, bx + 6, bz + 6):
        c.predio(bx - 5, bz - 4, bx + 5, bz + 4, [(0, 60)], "deco", "n", 4242, loja=True)
        teloes(bx - 5, bz - 4, bx + 5, bz + 4, [(0, 60)], 77)
        col(bx, bz, 62, 72, "iron_bars")
        for dx in range(-2, 3):
            for dy in range(-2, 3):
                for dz in range(-2, 3):
                    if dx * dx + dy * dy + dz * dz <= 5:
                        P(bx + dx, 74 + dy, bz + dz, "sea_lantern" if (dx + dy + dz) % 2 else "glass")


# ------------------------------------------------------------------ Empire State
def empire_state():
    pedra, vidro, metal = "polished_diorite", "gray_stained_glass", "iron_block"
    # base de 5 andares ocupando o lote
    prisma(40, 79, 110, 110, 0, 21, pedra, vidro, metal, passo=2)
    prisma(52, 84, 98, 105, 21, 150, pedra, vidro, metal, passo=2)
    prisma(58, 87, 92, 102, 150, 160, pedra, vidro, metal, passo=2)
    prisma(64, 90, 86, 99, 160, 170, pedra, vidro, metal, passo=2)
    prisma(69, 92, 81, 97, 170, 186, metal, "sea_lantern", metal, passo=2, luz=False)
    # mirante do 86º andar (no recuo de 150) com grade
    for x in range(52, 99):
        P(x, 150, 84, "iron_bars"); P(x, 150, 105, "iron_bars")
    for z in range(84, 106):
        P(52, 150, z, "iron_bars"); P(98, 150, z, "iron_bars")
    BX(58, 150, 87, 92, 150, 102, "air") if False else None
    # mastro e antena
    for k, (a, y0, y1) in enumerate(((3, 186, 194), (2, 194, 202), (1, 202, 210))):
        BX(75 - a, y0, 94 - a // 2 - 1, 75 + a, y1, 95 + a // 2, metal)
    col(75, 95, 211, 228, "iron_bars")
    P(75, 229, 95, "redstone_lamp[lit=true]" if False else "sea_lantern")
    # entrada pela 5ª Avenida (lado oeste) com marquise e o saguão dourado
    BX(40, 0, 92, 40, 6, 97, "air")
    BX(38, 7, 90, 39, 7, 99, metal)
    BX(41, -1, 80, 109, -1, 109, "smooth_quartz")
    for z in range(82, 108):
        col(108, z, 1, 12, "gold_block" if (z % 4) else "smooth_quartz")
    escada_mao(54, 86, 0, 150)
    escada_mao(60, 89, 150, 170)
    for z in (84, 105):                                    # o nome em cima da entrada
        pass
    escrever("EMPIRE STATE", (39, 9, 81), (0, 1), "gold_block") if False else None


# ------------------------------------------------------------------ Flatiron
def flatiron():
    """O Edifício Flatiron: triangular, entre a 5ª Avenida e a Broadway, com a ponta para o norte."""
    pedra = "white_terracotta"
    celulas = []
    for x in range(30, 80):
        for z in range(127, 163):
            if float(c.dist_broadway(x, z)) >= 9.5 and z >= c.z_broadway(x) and terra_ok(x, z):
                celulas.append((x, z))
    cel = set(celulas)
    for x, z in celulas:
        borda = any((x + dx, z + dz) not in cel for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if borda:
            for y in range(0, 46):
                janela = (y % 4 in (1, 2)) and ((x + z) % 2 == 0) and y > 3
                P(x, y, z, "black_stained_glass" if janela else pedra)
        else:
            for y in range(4, 45, 4):
                P(x, y, z, c.PISO)
            P(x, -1, z, c.PISO)
        P(x, 46, z, "smooth_sandstone")
    # cornija e lojas
    for x, z in celulas:
        if any((x + dx, z + dz) not in cel for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            P(x, 45, z, "smooth_sandstone")
            if 0 < x - 30 and (x + z) % 3:
                col(x, z, 0, 2, "glass")
    xs = [x for x, z in celulas]
    if xs:
        mx = min(xs)
        col(mx + 1, min(z for x, z in celulas if x == mx) + 2, 0, 46, "sea_lantern")
    # o resto do quarteirão (do outro lado da Broadway): dois prédios comuns
    c.predio(80, 132, 119, 162, [(0, 64), (3, 96)], "deco", "s", 1902)


def terra_ok(x, z):
    return c.terra(x, z)


# ------------------------------------------------------------------ Grand Central e Chrysler
def grand_central():
    """Grand Central Terminal: fachada beaux-arts com três arcos, relógio e o saguão estrelado."""
    pedra = "smooth_sandstone"
    x1, x2, z1, z2 = 150, 219, -21, 10
    BX(x1, 0, z1, x2, 28, z2, pedra)
    BX(x1 + 2, 0, z1 + 2, x2 - 2, 25, z2 - 2, "air")
    BX(x1 + 2, -1, z1 + 2, x2 - 2, -1, z2 - 2, "polished_diorite")
    for x in range(x1 + 2, x2 - 1):                       # piso de mármore em xadrez
        for z in range(z1 + 2, z2 - 1):
            if (x + z) % 2:
                P(x, -1, z, "smooth_quartz")
    rnd = random.Random(42)
    BX(x1 + 2, 26, z1 + 2, x2 - 2, 26, z2 - 2, "cyan_terracotta")      # o teto com as constelações
    for _ in range(140):
        P(rnd.randint(x1 + 3, x2 - 3), 26, rnd.randint(z1 + 3, z2 - 3), "glowstone")
    mx = (x1 + x2) // 2
    for k in (-20, 0, 20):                                 # os três grandes arcos da fachada sul
        for x in range(mx + k - 6, mx + k + 7):
            for y in range(2, 22):
                r = math.hypot(x - mx - k, y - 15)
                if (y <= 15 and abs(x - mx - k) <= 6) or (y > 15 and r <= 6.5):
                    P(x, y, z2, "glass_pane" if y > 4 else "air")
                    P(x, y, z2 - 1, "air")
    for k in (-27, -13, -7, 7, 13, 27):                    # colunas
        col(mx + k, z2 + 1, 0, 23, "quartz_pillar")
    BX(x1, 24, z2 + 1, x2, 25, z2 + 1, "smooth_quartz")
    for dx in range(-3, 4):                                # o relógio com o grupo de estátuas
        for dy in range(-3, 4):
            r = math.hypot(dx, dy)
            if r <= 3.4:
                P(mx + dx, 31 + dy, z2 + 1, "gold_block" if r > 2.4 else "white_concrete")
    P(mx, 31, z2 + 2, "black_concrete"); P(mx, 32, z2 + 2, "black_concrete"); P(mx + 1, 31, z2 + 2, "black_concrete")
    BX(mx - 9, 28, z2, mx + 9, 29, z2, pedra)
    for k in (-6, 6):
        col(mx + k, z2 + 1, 28, 33, "oxidized_copper")
    col(mx, z2 + 1, 35, 36, "oxidized_copper")
    # o relógio de quatro faces no balcão de informações
    gx, gz = mx, (z1 + z2) // 2
    for dx in range(-3, 4):
        for dz in range(-3, 4):
            if 2 <= math.hypot(dx, dz) <= 3.3:
                P(gx + dx, 0, gz + dz, "smooth_quartz")
    col(gx, gz, 0, 3, "gold_block")
    P(gx, 4, gz, "gold_block")
    for x in range(x1 + 6, x2 - 5, 4):                     # guichês
        P(x, 1, z1 + 2, "iron_bars"); P(x, 2, z1 + 2, "iron_bars")
    for x in range(x1 + 2, x1 + 12):                       # escadarias leste e oeste
        BX(x, 0, z1 + 4, x, x - x1 - 2, z1 + 10, "polished_diorite")
    for x in range(x2 - 11, x2 - 1):
        BX(x, 0, z1 + 4, x, x2 - 2 - x, z1 + 10, "polished_diorite")


def chrysler():
    """O Edifício Chrysler: tijolo branco, faixas escuras e a coroa de aço com janelas triangulares."""
    branco, vidro, aco = "white_concrete", "gray_stained_glass", "iron_block"
    prisma(276, -23, 311, 12, 0, 36, branco, vidro, "black_concrete", passo=2)
    prisma(280, -19, 307, 8, 36, 120, branco, vidro, "light_gray_concrete", passo=2)
    for dx, dz in ((0, 0), (1, 0), (0, 1), (1, 1)):         # as águias de aço nos cantos
        x = 280 if dx == 0 else 307
        z = -19 if dz == 0 else 8
        sx, sz = (-1 if dx == 0 else 1), (-1 if dz == 0 else 1)
        for k in range(1, 4):
            P(x + sx * k, 118, z + sz * k, aco)
        P(x + sx * 3, 119, z + sz * 3, aco)
    prisma(282, -17, 305, 6, 120, 128, branco, vidro, passo=2)
    prisma(284, -15, 303, 4, 128, 134, branco, vidro, passo=2)
    # coroa: cinco degraus de arcos com janelas triangulares iluminadas
    meio_x, meio_z = 293.5, -5.5
    for k in range(5):
        meia = 9 - 2 * k
        y0 = 134 + 6 * k
        for x in range(int(meio_x - meia), int(meio_x + meia) + 1):
            for z in range(int(meio_z - meia), int(meio_z + meia) + 1):
                borda = abs(x - meio_x) > meia - 1 or abs(z - meio_z) > meia - 1
                for y in range(y0, y0 + 6):
                    if not borda:
                        continue
                    u = (x if abs(z - meio_z) > meia - 1 else z)
                    fase = (u - int(meio_x if abs(z - meio_z) > meia - 1 else meio_z)) % 4
                    tri = (y - y0) < 4 and abs(fase - 1.5) < (4 - (y - y0)) / 2.5
                    P(x, y, z, "sea_lantern" if tri else aco)
    for k, a in enumerate((2, 1, 1, 0, 0, 0)):              # a agulha
        BX(int(meio_x) - a, 164 + 4 * k, int(meio_z) - a, int(meio_x) + a, 167 + 4 * k, int(meio_z) + a, aco)
    col(int(meio_x), int(meio_z), 188, 196, "iron_bars")
    BX(278, 0, 12, 309, 0, 12, "air") if False else None
    BX(290, 0, 12, 297, 4, 12, "air")
    escada_mao(282, -16, 0, 134)


# ------------------------------------------------------------------ Torre dos Vingadores
def torre_vingadores():
    """A Torre dos Vingadores (antiga Torre Stark), em cima da Grand Central, na Park Avenue.

    Vidro azul com a "espinha" branca no lado oeste, plataformas de pouso, o grande "A" iluminado,
    o reator arc no topo, elevadores de bolhas, o Salão dos Heróis, o laboratório e a cobertura.
    """
    cx, cz = 182, -56
    vidro, branco = I("light_blue_stained_glass"), I("white_concrete")
    piso, luz = I("smooth_quartz"), I("sea_lantern")
    X0, Z0, Y0 = 140, -80, -1
    arr = novo(92, 240, 46)                                   # x 140..231, y -1..238, z -80..-35

    def A(x, y, z, v):
        arr[x - X0, y - Y0, z - Z0] = v

    # pódio de 6 andares ocupando o lote
    for x in range(145, 225):
        for z in range(-71, -39):
            borda = x in (145, 224) or z in (-71, -40)
            for y in range(0, 24):
                if borda:
                    A(x, y, z, vidro if (y % 4 and (x + z) % 4) else branco)
            A(x, 24, z, branco)
            A(x, -1, z, piso)
            for y in (16,):
                if not borda:
                    A(x, y, z, piso)
    # a torre: planta elíptica que afina, com o corte em degraus no lado leste
    topo = 196
    for y in range(24, topo + 1):
        t = (y - 24) / (topo - 24)
        ax, az = 22 - 5 * t, 14 - 3 * t
        corte = cx + ax - (y - 120) * 0.12 if y > 120 else 999
        for x in range(int(cx - ax) - 1, int(cx + ax) + 2):
            for z in range(int(cz - az) - 1, int(cz + az) + 2):
                d = ((x - cx) / ax) ** 2 + ((z - cz) / az) ** 2
                if d > 1 or x > corte:
                    continue
                borda = any(((x + dx - cx) / ax) ** 2 + ((z + dz - cz) / az) ** 2 > 1 or x + dx > corte
                            for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                if borda:
                    A(x, y, z, branco if (y % 4 == 0 and (x + z) % 3 == 0) else vidro)
                elif y % 4 == 0 or y == topo:
                    A(x, y, z, piso)
    for px, pz in ((cx - 10, cz), (cx + 10, cz), (cx, cz - 6), (cx, cz + 6)):       # colunas de luz
        for y in range(0, topo):
            A(px, y, pz, luz)
    # a "espinha" branca do lado oeste, mais alta que a torre
    for y in range(0, 226):
        for x in range(156, 162):
            for z in range(-59, -52):
                A(x, y, z, branco)
    for y in range(226, 236):
        A(158, y, -56, I("iron_bars"))
    # plataformas de pouso (leste) nos degraus do corte
    for yp in (140, 164):
        corte = int(cx + (22 - 5 * (yp - 24) / (topo - 24)) - (yp - 120) * 0.12)
        for x in range(corte - 4, corte + 12):
            for z in range(cz - 6, cz + 7):
                A(x, yp, z, branco if (x - corte) % 6 else I("yellow_concrete"))
        for z in range(cz - 6, cz + 7):
            A(corte + 11, yp + 1, z, I("glass_pane"))
    # heliponto no topo com o "H"
    for dx in range(-11, 12):
        for dz in range(-9, 10):
            if dx * dx / 121 + dz * dz / 81 <= 1:
                A(cx + dx, topo + 1, cz + dz, I("gray_concrete"))
    for y in range(-4, 5):
        A(cx - 3, topo + 1, cz + y, I("yellow_concrete")); A(cx + 3, topo + 1, cz + y, I("yellow_concrete"))
    for x in range(-3, 4):
        A(cx + x, topo + 1, cz, I("yellow_concrete"))
    # o reator arc: anel iluminado em volta do topo e a antena
    for ang in range(0, 360, 4):
        a = math.radians(ang)
        A(int(round(cx + 15 * math.cos(a))), topo - 2, int(round(cz + 9 * math.sin(a))), luz)
    # escada de mão e elevadores de bolhas (sobem e descem) do saguão até o topo e até o Salão
    for y in range(0, topo + 1):
        A(cx - 6, y, cz - 3, I("polished_andesite"))
        A(cx - 5, y, cz - 3, I("ladder[facing=east]"))
    blit(arr, X0, Y0, Z0)
    _interior_vingadores(cx, cz, topo)
    for x, z, t, fundo, lado in ((cx - 2, cz + 2, topo, "soul_sand", "north"), (cx + 2, cz + 2, topo, "magma_block", "north"),
                                 (cx - 2, cz - 4, 100, "soul_sand", "south"), (cx + 2, cz - 4, 100, "magma_block", "south")):
        _elevador(x, z, t, fundo, lado)
        if t == topo:
            P(x, topo + 1, z, "air")                          # saída no heliponto
    _logo_vingadores(cx, 172, cz + 13, 1)                    # o "A" na face sul (Grand Central)
    _logo_vingadores(cx, 172, cz - 13, -1)                   # e na face norte


def _elevador(x, z, topo, fundo, porta):
    """Elevador de bolhas: tubo de vidro com água, areia das almas (sobe) ou magma (desce)."""
    for y in range(-1, topo + 1):
        for dx in (-1, 0, 1):
            for dz in (-1, 0, 1):
                if (dx, dz) != (0, 0):
                    P(x + dx, y, z + dz, "glass")
    P(x, -2, z, fundo)
    col(x, z, -1, topo, "water")
    dz = -1 if porta == "north" else 1
    BX(x, 0, z + dz, x, 1, z + dz, "air")
    m.porta(x - c.TX, 0, z + dz - c.TZ, "oak", porta, aberta=True)


def _logo_vingadores(cx, cy, z, lado):
    """O símbolo dos Vingadores: o "A" dentro do círculo, com a flecha saindo para a direita."""
    luz = "sea_lantern"
    # quem olha a face sul (virado para o norte) tem o leste à direita: a flecha aponta para lá
    for dx in range(-15, 16):
        for dy in range(-15, 16):
            r = math.hypot(dx, dy)
            perna_esq = abs((dx + 9) - (dy + 12) * 0.5) <= 1.4 and -12 <= dy <= 12
            perna_dir = 3 <= dx <= 5 and -12 <= dy <= 12
            barra = -3 <= dy <= -1 and -4 <= dx <= 15
            seta = dx >= 13 and abs(dy + 2) <= 15 - dx + 1 and dx <= 16
            anel = 12.2 <= r <= 13.8 and not (dx > 0 and -4 <= dy <= 0)
            if perna_esq or perna_dir or barra or seta or anel:
                P(cx + dx * (1 if lado > 0 else -1), cy + dy, z, luz)


def _interior_vingadores(cx, cz, topo):
    """Saguão, Salão dos Heróis (y = 100), laboratório (y = 140) e a cobertura do Tony (y = 184)."""
    # saguão: letreiro AVENGERS na parede norte e balcão
    escrever("AVENGERS", (cx - 23, 4, -70), (1, 0), "light_blue_concrete")
    BX(cx - 8, 0, cz + 8, cx + 8, 0, cz + 9, "white_concrete")
    BX(cx - 8, 1, cz + 8, cx + 8, 1, cz + 8, "smooth_quartz_slab[type=bottom]")
    BX(178, 0, -40, 186, 3, -40, "air")                       # portas da frente (sul)
    # Salão dos Heróis: 21 nichos em volta, com o pedestal e as cores de cada herói
    cores = ["red_concrete", "blue_concrete", "white_concrete", "yellow_concrete", "lime_concrete", "black_concrete",
             "purple_concrete", "gray_concrete", "orange_concrete", "magenta_concrete", "green_concrete",
             "red_concrete", "cyan_concrete", "yellow_concrete", "light_gray_concrete", "black_concrete",
             "brown_concrete", "red_concrete", "orange_concrete", "brown_concrete", "red_concrete"]
    y0 = 100
    BX(cx - 18, y0 + 1, cz - 9, cx + 18, y0 + 11, cz + 9, "air")
    for x in range(cx - 18, cx + 19):
        for z in range(cz - 9, cz + 10):
            P(x, y0, z, "black_concrete" if (x + z) % 2 else "gray_concrete")
    for n, cor in enumerate(cores):
        ang = math.radians(n * 360 / 21)
        x = int(round(cx + 17 * math.cos(ang)))
        z = int(round(cz + 8 * math.sin(ang)))
        P(x, y0 + 1, z, "smooth_quartz")
        col(x, z, y0 + 2, y0 + 4, "air")
        P(x, y0 + 6, z, cor)
        P(x, y0 + 7, z, "sea_lantern")
    _logo_chao(cx, y0, cz)
    # laboratório do Tony: bancadas, hologramas e a vitrine das armaduras
    yl = 140
    for x in range(cx - 14, cx + 10, 4):
        P(x, yl + 1, cz - 4, "smithing_table"); P(x + 1, yl + 1, cz - 4, "crafting_table")
        P(x, yl + 3, cz - 4, "light_blue_stained_glass"); P(x + 1, yl + 3, cz - 4, "light_blue_stained_glass")
    for x in range(cx - 14, cx + 10, 3):
        BX(x, yl + 1, cz + 5, x, yl + 3, cz + 5, "glass")
        P(x, yl + 2, cz + 6, "red_concrete"); P(x, yl + 3, cz + 6, "yellow_concrete")
    # cobertura: bar, sofás e a vista
    yc = 184
    BX(cx - 6, yc + 1, cz - 2, cx + 6, yc + 1, cz - 2, "dark_oak_planks")
    BX(cx - 6, yc + 2, cz - 2, cx + 6, yc + 2, cz - 2, "dark_oak_slab[type=bottom]")
    for x in range(cx - 8, cx + 9):
        P(x, yc + 1, cz + 7, "white_concrete" if False else "white_wool")
        P(x, yc + 1, cz + 8, "quartz_stairs[facing=south]")


def _logo_chao(cx, y, cz):
    for dx in range(-6, 7):
        for dz in range(-6, 7):
            r = math.hypot(dx, dz)
            if 5 <= r <= 6.2:
                P(cx + dx, y, cz + dz, "sea_lantern")


# ------------------------------------------------------------------ outros prédios famosos
def rockefeller():
    """Rockefeller Center: o 30 Rock, a pista de gelo afundada, o Prometeu dourado e a árvore de Natal."""
    pedra, vidro = "light_gray_terracotta", "gray_stained_glass"
    prisma(-78, -118, -50, -93, 0, 60, pedra, vidro, passo=2)
    prisma(-75, -116, -53, -95, 60, 110, pedra, vidro, passo=2)
    prisma(-72, -113, -56, -98, 110, 141, pedra, vidro, passo=2)
    for x in range(-72, -55):                                 # mirante Top of the Rock (grade de vidro)
        P(x, 141, -113, "glass_pane"); P(x, 141, -98, "glass_pane")
    escada_mao(-70, -110, 0, 141)
    escrever("30 ROCK", (-76, 50, -92), (1, 0), "gold_block") if False else None
    for x in range(-45, 10):                                  # praça
        for z in range(-121, -89):
            P(x, -1, z, "smooth_stone")
    BX(-36, -4, -114, -4, -1, -98, "stone_bricks")            # pista de gelo afundada
    BX(-35, -3, -113, -5, -1, -99, "air")
    BX(-35, -4, -113, -5, -4, -99, "packed_ice")
    for x in range(-36, -3):
        P(x, 0, -114, "iron_bars"); P(x, 0, -98, "iron_bars")
    for z in range(-114, -97):
        P(-36, 0, z, "iron_bars")
    for k in range(4):                                       # escadinha até o gelo
        P(-4 - k if False else -4, -1 - k, -106, "air")
    # Prometeu dourado (deitado, segurando o fogo) na ponta oeste
    gx, gz = -33, -106
    BX(gx, -3, gz - 2, gx, -3, gz + 2, "gold_block")
    BX(gx, -2, gz - 1, gx, -2, gz + 1, "gold_block")
    col(gx, gz + 2, -2, 0, "gold_block")
    P(gx, 1, gz + 2, "glowstone")
    BX(gx - 2, -3, gz - 3, gx - 1, 2, gz + 3, "polished_granite")
    # bandeiras em volta
    for x in range(-34, -4, 3):
        col(x, -116, 0, 6, "iron_bars")
        P(x, 6, -117, TELOES[x % len(TELOES)].replace("concrete", "wool"))
    # a árvore de Natal
    tx, tz = -20, -94
    col(tx, tz, 0, 2, "spruce_log")
    for y in range(3, 34):
        r = max(0.5, (34 - y) / 3.0)
        for dx in range(-int(r) - 1, int(r) + 2):
            for dz in range(-int(r) - 1, int(r) + 2):
                if dx * dx + dz * dz <= r * r:
                    h = (dx * 7 + dz * 13 + y * 5) % 23
                    bloco = ("red_concrete", "yellow_concrete", "blue_concrete", "glowstone")[h % 4] if h < 3 else \
                        "spruce_leaves"
                    P(tx + dx, y, tz + dz, bloco)
    for dy, dx in ((34, 0), (35, 0), (35, -1), (35, 1), (36, 0)):
        P(tx + dx, dy, tz, "glowstone")


def baxter():
    """Edifício Baxter (Quarteto Fantástico): torre azul com o grande "4" no alto."""
    prisma(50, -70, 99, -41, 0, 120, "white_concrete", "blue_stained_glass", "light_blue_concrete", passo=3)
    escada_mao(52, -68, 0, 120)
    for z, sentido in ((-71, -1), (-40, 1)):
        for dx in range(-9, 10):
            for dy in range(-9, 10):
                if math.hypot(dx, dy) <= 9.3:
                    P(75 + dx, 104 + dy, z, "blue_concrete" if math.hypot(dx, dy) > 7.8 else "white_concrete")
        px, _ = c.es.pixels("4")
        for cc, r in px:
            for a in range(2):
                for b in range(2):
                    x = 75 + sentido * (cc * 2 + a - 5)
                    P(x, 97 + r * 2 + b, z, "blue_concrete")


def daily_bugle():
    """O Clarim Diário, com o letreiro DAILY BUGLE no telhado (de frente para a Times Square)."""
    c.predio(-186, 30, -105, 60, [(0, 88)], "deco", "s", 1897, loja=True, caixa_dagua=False)
    BX(-180, 89, 44, -111, 103, 46, "white_concrete")
    for x in range(-180, -110, 6):
        col(x, 47, 89, 103, "iron_bars"); col(x, 43, 89, 103, "iron_bars")
    largura = len("DAILY BUGLE") * 6 - 1
    meio = -145
    escrever("DAILY BUGLE", (meio + largura // 2, 93, 44), (-1, 0), "black_concrete")   # lido do norte
    escrever("DAILY BUGLE", (meio - largura // 2, 93, 46), (1, 0), "black_concrete")    # lido do sul


def madison_square_garden():
    cx, cz, r = -145, 95, 17
    for dx in range(-r - 1, r + 2):
        for dz in range(-r - 1, r + 2):
            d = math.hypot(dx, dz)
            if d <= r:
                x, z = cx + dx, cz + dz
                if d > r - 1:
                    col(x, z, 0, 22, "light_gray_concrete" if int(math.degrees(math.atan2(dz, dx))) % 12 < 6
                        else "gray_stained_glass")
                else:
                    P(x, -1, z, "oak_planks" if d < 8 else c.PISO)
                    sy = int(max(0, (d - 8) / 1.2))
                    if d >= 8:
                        col(x, z, 0, sy, "red_concrete" if (int(d) % 2) else "light_gray_concrete")
                P(x, 23, z, "white_concrete")
    BX(cx - 3, 0, cz + r, cx + 3, 3, cz + r, "air")
    escrever("MSG", (cx - 8, 15, cz + r + 1), (1, 0), "red_concrete", fundo="white_concrete")


def washington_square():
    """Washington Square Park: o arco de mármore no fim da 5ª Avenida, a fonte e os caminhos."""
    for x in range(-80, 120):
        for z in range(221, 263):
            if not no_ladrilho(x, z, x, z, 0):
                continue
            diag = abs((x - 20) - (z - 245)) < 2 or abs((x - 20) + (z - 245)) < 2 or abs(z - 245) < 2
            P(x, -1, z, "smooth_stone" if diag or z < 228 else "grass_block")
            P(x, 0, z, "air")
    rnd = random.Random(11)
    for _ in range(60):
        x, z = rnd.randint(-76, 116), rnd.randint(232, 260)
        if abs(x - 20) > 14 and abs((x - 20) - (z - 245)) > 4 and abs((x - 20) + (z - 245)) > 4:
            arvore(x, z, rnd.choice([5, 6]), "oak")
    for dx in range(-10, 11):                                 # a fonte
        for dz in range(-10, 11):
            r = math.hypot(dx, dz)
            if r <= 10:
                P(20 + dx, -1, 245 + dz, "smooth_quartz")
                if r <= 9:
                    P(20 + dx, 0, 245 + dz, "water") if r > 1.5 else col(20 + dx, 245 + dz, 0, 3, "water")
                else:
                    P(20 + dx, 0, 245 + dz, "smooth_quartz_slab[type=bottom]")
    # o arco
    for x in range(9, 32):
        for y in range(0, 26):
            r = math.hypot(x - 20, y - 15)
            vao = (abs(x - 20) <= 5 and y <= 15) or (y > 15 and r <= 5.5)
            if not vao:
                for z in (227, 228, 229):
                    P(x, y, z, "smooth_quartz")
    BX(8, 23, 226, 32, 23, 230, "quartz_slab[type=top]" if False else "chiseled_quartz_block")
    BX(8, 26, 226, 32, 26, 230, "smooth_quartz_slab[type=bottom]")


def sanctum():
    """Sanctum Sanctorum (177A Bleecker Street): a casa do Doutor Estranho, com a janela redonda."""
    x1, x2, z1, z2 = -260, -246, 177, 193
    tijolo, pedra = "bricks", "smooth_sandstone"
    BX(x1, 0, z1, x2, 20, z2, tijolo)
    BX(x1 + 1, 0, z1 + 1, x2 - 1, 19, z2 - 1, "air")
    BX(x1 + 1, -1, z1 + 1, x2 - 1, -1, z2 - 1, "dark_oak_planks")
    for y in (6, 12):
        BX(x1 + 1, y, z1 + 1, x2 - 1, y, z2 - 1, "dark_oak_planks")
    BX(x1 - 1, 20, z1 - 1, x2 + 1, 20, z2 + 1, "dark_oak_slab[type=bottom]" if False else pedra)
    for x in range(x1, x2 + 1):                               # cornijas de pedra
        P(x, 6, z1, pedra); P(x, 12, z1, pedra); P(x, 19, z1 - 1, "smooth_sandstone_slab[type=top]")
    mx = (x1 + x2) // 2
    for x in (mx - 1, mx, mx + 1):                            # porta dupla e degraus
        col(x, z1, 0, 3, "air")
    P(mx - 1, 0, z1, "air")
    for x in range(mx - 2, mx + 3):
        P(x, 0, z1 - 1, "stone_bricks")
        P(x, 0, z1 - 2, "stone_brick_stairs[facing=south]")
    for x in (x1 + 2, x1 + 3, x2 - 3, x2 - 2):               # janelas
        for y in (2, 3, 8, 9, 10):
            P(x, y, z1, "black_stained_glass")
    # a janela redonda com o Selo dos Vishanti
    jy = 15
    for dx in range(-4, 5):
        for dy in range(-4, 5):
            r = math.hypot(dx, dy)
            if r <= 4.4:
                ang = math.degrees(math.atan2(dy, dx)) % 120
                raio = abs(ang - 90) < 14 and r > 1.2
                bloco = "black_stained_glass" if (r > 3.6 or raio or 1.4 < r < 2.2) else "light_blue_stained_glass"
                P(mx + dx, jy + dy, z1, bloco)
                P(mx + dx, jy + dy, z1 - 1, "air")
    # dentro: escadaria, biblioteca, tapete vermelho e a sala das relíquias
    for k in range(6):
        BX(x1 + 2 + k, k, z2 - 4, x1 + 2 + k, k, z2 - 2, "dark_oak_stairs[facing=east]")
    BX(x1 + 2, 6, z2 - 4, x1 + 8, 6, z2 - 2, "air")
    for x in range(x1 + 1, x2):
        col(x, z2 - 1, 7, 10, "bookshelf")
        P(x, 0, (z1 + z2) // 2, "red_carpet")
    for y in (5, 11, 18):
        P(mx, y, (z1 + z2) // 2, "lantern[hanging=true]")
    for x in range(x1 + 3, x2 - 2, 3):                        # vitrines das relíquias (2º andar)
        BX(x, 13, z1 + 3, x, 14, z1 + 3, "glass")


def one_wtc():
    """One World Trade Center (base quadrada que vira octógono, com a agulha) e o memorial."""
    cx, cz, a = -365.5, 344.5, 18
    vidro, aco = I("light_blue_stained_glass"), I("iron_block")
    arr = novo(40, 240, 40)
    X0, Z0 = -385, 325
    topo = 220
    for y in range(0, topo + 1):
        t = y / topo
        b = 2 * a - a * t
        for x in range(-384, -346):
            for z in range(326, 364):
                dx, dz = abs(x - cx), abs(z - cz)
                if dx > a or dz > a or dx + dz > b:
                    continue
                viz = [(x + 1, z), (x - 1, z), (x, z + 1), (x, z - 1)]
                borda = any(abs(p - cx) > a or abs(q - cz) > a or abs(p - cx) + abs(q - cz) > b for p, q in viz)
                ix, iz = x - X0, z - Z0
                if borda:
                    arr[ix, y + 1, iz] = aco if (y < 20 and (x + z) % 2) or y % 16 == 0 else vidro
                elif y % 4 == 0 or y == topo:
                    arr[ix, y + 1, iz] = I(c.PISO)
    for y in range(0, topo):
        arr[-366 - X0, y + 1, 340 - Z0] = I("sea_lantern")
        arr[-366 - X0, y + 1, 349 - Z0] = I("sea_lantern")
        arr[-370 - X0, y + 1, 344 - Z0] = I("polished_andesite")
        arr[-369 - X0, y + 1, 344 - Z0] = I("ladder[facing=east]")
    blit(arr, X0, -1, Z0)
    col(-366, 344, topo + 1, topo + 16, "iron_bars")
    for ang in range(0, 360, 30):
        P(int(round(-366 + 3 * math.cos(math.radians(ang)))), topo + 2, int(round(344 + 3 * math.sin(math.radians(ang)))),
          "iron_bars")
    BX(-366, 0, 362, -363, 3, 362, "air")
    # memorial do 11 de Setembro: duas piscinas quadradas de granito escuro
    for x in range(-410, -320):
        for z in range(377, 413):
            P(x, -1, z, "smooth_stone")
    for px in (-406, -358):
        BX(px - 1, -6, 380, px + 26, 0, 407, "polished_blackstone")
        BX(px, -6, 381, px + 25, -1, 406, "air")
        BX(px, -6, 381, px + 25, -6, 406, "polished_blackstone")
        BX(px, -5, 381, px + 25, -3, 406, "water")
        BX(px + 9, -6, 390, px + 16, -1, 397, "polished_blackstone")
        BX(px + 10, -6, 391, px + 15, -1, 396, "air")
        BX(px + 10, -6, 391, px + 15, -6, 396, "black_concrete")
    for x in range(-408, -322, 9):
        for z in (379, 410):
            arvore(x, z, 5, "oak")


def wall_street():
    """Bolsa de Valores (NYSE): colunas, frontão e a grande bandeira."""
    x1, x2, z1, z2 = 150, 219, 380, 410
    prisma(x1, z1, x2, z2, 0, 30, "smooth_sandstone", "gray_stained_glass", passo=3)
    BX(160, 0, z1 - 4, 209, 0, z1 - 1, "smooth_sandstone")
    for x in range(163, 207, 7):
        col(x, z1 - 3, 1, 22, "quartz_pillar")
    BX(160, 23, z1 - 4, 209, 24, z1 - 1, "smooth_quartz")
    for k in range(7):
        BX(160 + 4 * k, 25 + k, z1 - 4, 209 - 4 * k, 25 + k, z1 - 2, "smooth_quartz")
    for y in range(5, 20):                                     # a bandeira atrás das colunas
        for x in range(166, 204):
            listra = "red_wool" if (y // 1) % 2 else "white_wool"
            canto = x < 182 and y > 12
            P(x, y, z1 - 1, "blue_wool" if canto else listra)
            if canto and (x + y) % 3 == 0:
                P(x, y, z1 - 1, "white_wool")
    BX(182, 0, z1, 187, 3, z1, "air")


def touro():
    """O Touro de Wall Street (Charging Bull) no Bowling Green, no fim da Broadway."""
    for x in range(160, 181):
        for z in range(402, 425):
            P(x, -1, z, "smooth_stone")
    for x in range(163, 178):
        for z in range(414, 423):
            if ((x - 170.5) / 7.5) ** 2 + ((z - 418.5) / 4.5) ** 2 <= 1:
                P(x, -1, z, "grass_block")
                if ((x - 170.5) / 7.5) ** 2 + ((z - 418.5) / 4.5) ** 2 > 0.8:
                    P(x, 0, z, "iron_bars")
    b = "brown_terracotta"
    x, z = 170, 404                                           # olhando para o norte (sobe a Broadway)
    BX(x - 1, 2, z, x + 1, 4, z + 6, b)                        # corpo
    for dx in (-1, 1):
        for dz in (0, 6):
            col(x + dx, z + dz, 0, 1, b)                       # patas
    BX(x - 1, 1, z - 2, x + 1, 3, z - 1, b)                    # cabeça abaixada
    P(x - 2, 3, z - 2, b); P(x + 2, 3, z - 2, b)
    P(x - 3, 4, z - 3, b); P(x + 3, 4, z - 3, b)                # chifres
    col(x, z + 7, 4, 6, b)                                     # rabo


def ponte_brooklyn():
    """A Ponte do Brooklyn: torres góticas de pedra, cabos, estais e o passeio de madeira no meio."""
    y_tab = 20
    za, zb = 336, 353
    for x in range(362, 507):                                  # tabuleiro (com as rampas)
        if x < 402:
            y = (x - 362) // 2
        elif x > 466:
            y = max(0, y_tab - (x - 466) // 2)
        else:
            y = y_tab
        BX(x, y, za, x, y, zb, "gray_concrete")
        for z in (za + 4, zb - 4):
            if x % 4 == 0:
                P(x, y, z, "white_concrete")
        BX(x, y + 2, 343, x, y + 2, 346, "spruce_planks")       # passeio elevado de madeira
        P(x, y + 3, 342, "iron_bars"); P(x, y + 3, 347, "iron_bars")
        P(x, y + 1, 343, "iron_bars"); P(x, y + 1, 346, "iron_bars")
        P(x, y + 1, za, "iron_bars"); P(x, y + 1, zb, "iron_bars")
        if y > 2 and 402 <= x <= 466:
            col(x, za, y - 3, y - 1, "iron_bars"); col(x, zb, y - 3, y - 1, "iron_bars")
        if y > 0 and (x < 402 or x > 466):
            BX(x, 0, za, x, y - 1, zb, "stone_bricks")
    for tx in (428, 451):                                      # as torres
        BX(tx, -5, 331, tx + 7, 48, 358, "smooth_sandstone")
        for zc in (337.5, 351.5):                              # arcos góticos (pontiagudos)
            for z in range(331, 359):
                for y in range(y_tab, 42):
                    dz = abs(z - zc)
                    if (y <= 34 and dz <= 4.5) or (y > 34 and dz <= 4.5 - (y - 34) * 0.65):
                        BX(tx, y, z, tx + 7, y, z, "air")
        BX(tx, y_tab + 1, 343, tx + 7, y_tab + 5, 346, "air")
        BX(tx - 1, 48, 330, tx + 8, 48, 359, "smooth_sandstone_slab[type=bottom]" if False else "smooth_sandstone")
        for z in range(331, 359, 2):
            P(tx - 1, 49, z, "smooth_sandstone"); P(tx + 8, 49, z, "smooth_sandstone")
    # cabos principais (curvas) e pendurais
    for z in (za, zb):
        pts = []
        for x in range(402, 491):
            if x < 428:
                y = 46 - (428 - x) * (46 - y_tab - 1) / 26
            elif x <= 458:
                u = (x - 443) / 15
                y = y_tab + 6 + (46 - y_tab - 6) * u * u
            else:
                y = 46 - (x - 458) * (46 - y_tab - 1) / 32
            pts.append((x, int(round(y))))
        for (x, y), (x2, y2) in zip(pts, pts[1:]):
            col(x, z, min(y, y2), max(y, y2), "iron_bars")
            if x % 3 == 0 and y > y_tab + 2:
                col(x, z, y_tab + 2, y - 1, "iron_bars")
        for tx in (428, 458):                                  # estais diagonais saindo das torres
            for k in (6, 12, 18, 24):
                for sx in (-1, 1):
                    linha((tx + (7 if tx == 428 else 0), 44, z), (tx + sx * k + (7 if tx == 428 else 0), y_tab + 2, z),
                          "iron_bars")


def estatua_liberdade():
    """A Estátua da Liberdade na sua ilha: o forte em estrela, o pedestal e a estátua de cobre verde."""
    cx, cz = c.LIBERTY[0], c.LIBERTY[1]
    cobre, cobre2 = "oxidized_copper", "oxidized_cut_copper"
    # forte em estrela de 11 pontas
    for dx in range(-17, 18):
        for dz in range(-17, 18):
            ang = math.atan2(dz, dx)
            r = math.hypot(dx, dz)
            rlim = 12 + 4 * abs(math.cos(ang * 11 / 2))
            if r <= rlim:
                col(cx + dx, cz + dz, 0, 6, "stone_bricks")
    BX(cx - 7, 7, cz - 7, cx + 7, 26, cz + 7, "smooth_stone")   # pedestal
    BX(cx - 8, 26, cz - 8, cx + 8, 27, cz + 8, "stone_bricks")
    BX(cx - 6, 7, cz - 8, cx + 6, 9, cz + 8, "stone_bricks")
    # a estátua (olhando para o norte, para a cidade): manto, cabeça com a coroa, tocha e a tábua
    base = 28
    for y in range(base, base + 27):
        t = (y - base) / 27
        rx, rz = 6 - 1.6 * t, 4.6 - 1.0 * t
        for dx in range(-7, 8):
            for dz in range(-6, 7):
                if (dx / rx) ** 2 + (dz / rz) ** 2 <= 1:
                    P(cx + dx, y, cz + dz, cobre2 if (dx + y) % 5 == 0 else cobre)
    cab = base + 29
    for dx in range(-3, 4):
        for dy in range(-3, 4):
            for dz in range(-3, 4):
                if dx * dx + dy * dy * 1.2 + dz * dz <= 7:
                    P(cx + dx, cab + dy, cz + dz, cobre)
    BX(cx - 1, base + 26, cz - 1, cx + 1, base + 27, cz + 1, cobre)          # pescoço
    for k in range(7):                                                      # os raios da coroa
        ang = math.radians(-160 + k * 23.3)
        for r in range(3, 7):
            P(int(round(cx + r * math.cos(ang))), cab + 2 + r // 2, int(round(cz + r * math.sin(ang) * 0.8)), cobre)
    # braço direito erguido (o lado leste) com a tocha dourada
    for y in range(base + 22, base + 40):
        x = cx + 5 + (y - base - 22) // 9
        P(x, y, cz, cobre); P(x, y, cz + 1, cobre)
    tx = cx + 7
    BX(tx - 1, base + 40, cz - 1, tx + 1, base + 41, cz + 1, "gold_block")
    P(tx, base + 42, cz, "glowstone"); P(tx, base + 43, cz, "glowstone")
    P(tx - 1, base + 42, cz, "gold_block"); P(tx + 1, base + 42, cz, "gold_block"); P(tx, base + 44, cz, "gold_block")
    # braço esquerdo com a tábua (o lado oeste)
    BX(cx - 7, base + 12, cz - 3, cx - 6, base + 20, cz + 1, cobre2)
    col(cx - 6, cz + 2, base + 18, base + 21, cobre)
    # escada até o pedestal e o mirante da coroa
    escada_mao(cx - 3, cz + 6, 0, 27, "smooth_stone") if False else None
    BX(cx - 1, 7, cz - 8, cx + 1, 10, cz - 8, "air")
    for k in range(7):
        BX(cx - 1, k, cz - 15 + k, cx + 1, k, cz - 15 + k, "stone_brick_stairs[facing=south]")


def guggenheim():
    """Museu Guggenheim: a espiral branca que se alarga para cima, com a rampa por dentro."""
    gx, gz = 55, -406
    for nivel in range(6):
        r = 12 + nivel
        y0 = nivel * 4
        for dx in range(-r - 1, r + 2):
            for dz in range(-r - 1, r + 2):
                d = math.hypot(dx, dz)
                if r - 1 <= d <= r:
                    for y in range(y0, y0 + 4):
                        P(gx + dx, y, gz + dz, "gray_stained_glass" if y == y0 + 3 else "white_concrete")
    for dx in range(-18, 19):
        for dz in range(-18, 19):
            d = math.hypot(dx, dz)
            if d <= 17:
                P(gx + dx, 24, gz + dz, "glass" if d <= 9 else "white_concrete")
                P(gx + dx, -1, gz + dz, "smooth_quartz")
    for a in range(0, 360 * 5, 4):                            # a rampa em espiral
        y = a // 75
        r = 9 + a / 360
        ang = math.radians(a)
        for w in range(3):
            P(int(round(gx + (r + w) * math.cos(ang))), y, int(round(gz + (r + w) * math.sin(ang))), "smooth_quartz")
    BX(gx - 2, 0, gz + 12, gx + 2, 2, gz + 13, "air")
    c.predio(78, -420, 98, -392, [(0, 40)], "deco", "w", 1959)


def casa_parker():
    """A casa do Peter Parker: 20 Ingram Street, Forest Hills (Queens)."""
    c.casa(568, 9, 586, 26, "n", 2001)
    P(573, 0, 7, "spruce_fence"); P(573, 1, 7, "red_concrete")
    P(574, 1, 7, "blue_concrete")


def dique_sul():
    """A Park Avenue continua por um dique sobre a baía até a estrada que leva ao castelo."""
    for z in range(418, c.Z_MAX + 1):
        for x in range(117, 143):
            borda = x in (117, 142)
            if z >= 425:
                col(x, z, -5, -2, "stone_bricks")
            if borda:
                P(x, -1, z, "stone_bricks"); P(x, 0, z, "stone_bricks"); P(x, 1, z, "iron_bars")
            else:
                calcada = x < 121 or x > 138
                P(x, -1, z, "smooth_stone" if calcada else "gray_concrete")
                P(x, 0, z, "smooth_stone_slab[type=bottom]" if calcada else "air")
                P(x, 1, z, "air")
                if not calcada and x in (128, 131) and (z // 4) % 2 == 0:
                    P(x, -1, z, "white_concrete")
        if z % 20 == 0:
            c._poste(118, z, 1, 0); c._poste(141, z, -1, 0)
