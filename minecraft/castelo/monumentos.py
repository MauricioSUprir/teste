"""Monumentos dos heróis e covis dos vilões em Nova York (coordenadas da cidade, ver cidade.py).

Heróis: Praça dos Heróis (estátuas gigantes feitas a partir dos próprios trajes) com o Memorial do
Tony Stark, Mansão X (com a Sala de Perigo e o Cérebro no subsolo), Triskelion da S.H.I.E.L.D. com o
Aeroporta-aviões no céu, Embaixada de Wakanda, a Balsa (prisão) e o Quinjet.
Vilões: Torre Oscorp, Embaixada da Latvéria, base secreta da Hidra, fábrica do Ultron, ferro-velho,
usina do Electro, laboratório do Octopus, a nave do Thanos, a máquina do Galactus, a nave do Ronan,
o portal do Kang e a pista de corrida do Flash Reverso.
"""
import math
import random

import numpy as np

import cidade as c
from cidade import P, BX, col, I, no_ladrilho, reservar, escrever, arvore

# ------------------------------------------------------------------ estátuas a partir dos trajes
PALETA = {
    "white_concrete": (207, 213, 214), "orange_concrete": (224, 97, 1), "magenta_concrete": (169, 48, 159),
    "light_blue_concrete": (36, 137, 199), "yellow_concrete": (241, 175, 21), "lime_concrete": (94, 169, 24),
    "pink_concrete": (214, 101, 143), "gray_concrete": (55, 58, 62), "light_gray_concrete": (125, 125, 115),
    "cyan_concrete": (21, 119, 136), "purple_concrete": (100, 32, 156), "blue_concrete": (45, 47, 143),
    "brown_concrete": (96, 60, 32), "green_concrete": (73, 91, 36), "red_concrete": (142, 33, 33),
    "black_concrete": (8, 10, 15), "white_terracotta": (210, 178, 161), "orange_terracotta": (162, 84, 38),
    "yellow_terracotta": (186, 133, 35), "red_terracotta": (143, 61, 47), "brown_terracotta": (77, 51, 36),
    "light_gray_terracotta": (135, 107, 98), "gray_terracotta": (57, 42, 35), "green_terracotta": (76, 83, 42),
    "blue_terracotta": (74, 60, 91), "purple_terracotta": (118, 70, 86), "cyan_terracotta": (87, 91, 91),
    "pink_terracotta": (162, 78, 79), "lime_terracotta": (104, 118, 53), "gold_block": (246, 208, 61),
    "iron_block": (220, 220, 220), "smooth_sandstone": (223, 214, 170), "red_wool": (161, 39, 34),
    "blue_wool": (53, 57, 157), "yellow_wool": (249, 198, 40), "lime_wool": (112, 185, 26),
    "light_blue_wool": (58, 175, 217), "green_wool": (84, 109, 27), "purple_wool": (122, 42, 173),
}
_NOMES = list(PALETA)
_RGB = np.array([PALETA[n] for n in _NOMES], float)


def bloco_da_cor(rgb):
    d = ((_RGB - np.array(rgb[:3], float)) ** 2).sum(1)
    return _NOMES[int(d.argmin())]


def _faces_traje(hid):
    """As texturas do traje, juntando as camadas (calça embaixo, o resto por cima)."""
    import herois
    t = herois.Traje()
    dict((h[0], h[2]) for h in herois.HEROIS)[hid](t)
    c1, c2 = t.c1, t.c2
    junto = c2.copy()
    m1 = c1[:, :, 3] > 0
    junto[m1] = c1[m1]
    return junto, c1


def estatua(hid, x0, z0, frente="s", base=3, pedra="stone_bricks"):
    """Estátua de 32 blocos de altura do herói (1 pixel do traje = 1 bloco), sobre um pedestal.

    (x0, z0) é o canto do pedestal (16 x 8); `frente` é para onde ela olha.
    """
    if not no_ladrilho(x0 - 4, z0 - 4, x0 + 20, z0 + 20):
        return
    tex, c1 = _faces_traje(hid)
    caixas = [  # parte, x, y, z (canto), largura, altura, profundidade
        ("perna", 4, 0, 2, 4, 12, 4), ("perna", 8, 0, 2, 4, 12, 4), ("corpo", 4, 12, 2, 8, 12, 4),
        ("braco", 0, 12, 2, 4, 12, 4), ("braco", 12, 12, 2, 4, 12, 4), ("cabeca", 4, 24, 0, 8, 8, 8)]
    vox = {}
    for parte, bx, by, bz, w, h, d in caixas:
        F = c.__dict__.get("_F")  # (não usado)
        faces = __import__("herois").PARTES[parte]
        for x in range(w):
            for y in range(h):
                for z in range(d):
                    superficie = x in (0, w - 1) or y in (0, h - 1) or z in (0, d - 1)
                    if not superficie:
                        vox[(bx + x, by + y, bz + z)] = None
                        continue
                    v = h - 1 - y                                  # linha da textura (de cima para baixo)
                    if z == d - 1:
                        fx, fy, _, _ = faces["frente"]; px = tex[fy + v, fx + x]
                    elif z == 0:
                        fx, fy, _, _ = faces["tras"]; px = tex[fy + v, fx + (w - 1 - x)]
                    elif x == 0:
                        fx, fy, _, _ = faces["dir"]; px = tex[fy + v, fx + z]
                    elif x == w - 1:
                        fx, fy, _, _ = faces["esq"]; px = tex[fy + v, fx + (d - 1 - z)]
                    elif y == h - 1:
                        fx, fy, _, _ = faces["topo"]; px = tex[fy + min(z, 7), fx + x]
                    else:
                        fx, fy, _, _ = faces["baixo"]; px = tex[fy + min(z, 7), fx + x]
                    vox[(bx + x, by + y, bz + z)] = px
    # cor de dentro: a mais comum da parte
    validos = [p for p in vox.values() if p is not None and p[3] > 0]
    miolo = bloco_da_cor(validos[len(validos) // 2]) if validos else pedra
    BX(x0 - 1, 0, z0 - 1, x0 + 16, base - 1, z0 + 8, pedra)
    for (x, y, z), px in vox.items():
        b = miolo if px is None or px[3] == 0 else bloco_da_cor(px)
        if frente == "s":
            wx, wz = x0 + x, z0 + z
        elif frente == "n":
            wx, wz = x0 + 15 - x, z0 + 7 - z
        elif frente == "e":
            wx, wz = x0 + z, z0 + 15 - x
        else:
            wx, wz = x0 + 7 - z, z0 + x
        P(wx, base + y, wz, b)
    return miolo


def _acessorio(hid, x0, z0, frente, base=3):
    """Escudo do Capitão e martelo do Thor nas estátuas."""
    def W(x, y, z, b):
        if frente == "s":
            P(x0 + x, base + y, z0 + z, b)
        elif frente == "n":
            P(x0 + 15 - x, base + y, z0 + 7 - z, b)
    if hid == "capitao_america":
        for dx in range(-5, 6):
            for dy in range(-5, 6):
                r = math.hypot(dx, dy)
                if r <= 5.4:
                    cor = "blue_concrete" if r < 2.2 else ("red_concrete" if r > 4.2 or 2.2 <= r < 3.2 else "white_concrete")
                    if r < 1.3:
                        cor = "white_concrete"
                    W(14 + dx, 17 + dy, 8, cor)
    if hid == "thor":
        for y in range(8, 14):
            W(14, y, 6, "dark_oak_planks")
        for dx in range(-2, 3):
            for dz in range(-1, 2):
                for y in (5, 6, 7):
                    W(14 + dx, y, 6 + dz, "iron_block")


# ------------------------------------------------------------------ registro
def reservas():
    reservar("praca_herois", -300, -123, -211, -88)
    reservar("mansao_x", 567, -475, 634, -398)
    reservar("pista", 485, -475, 552, -442)
    reservar("wakanda", 360, -73, 415, -38)
    reservar("oscorp", 250, -73, 339, -38)
    reservar("latveria", -410, -73, -321, -38)
    reservar("hidra", -300, 277, -211, 312)
    reservar("ultron", 567, 273, 634, 306)
    reservar("ferro_velho", 649, 273, 699, 306)
    reservar("usina", -410, 227, -321, 262)
    reservar("octopus", 360, 377, 415, 412)


def todos():
    for f, caixa in (
        (praca_herois, (-300, -123, -211, -88)), (mansao_x, (567, -475, 634, -398)), (pista, (485, -475, 552, -442)),
        (triskelion, (300, 440, 425, 499)), (aeroporta_avioes, (-80, 440, 80, 499)), (balsa, (-160, 440, -50, 499)),
        (wakanda, (360, -73, 415, -38)), (oscorp, (250, -73, 339, -38)), (latveria, (-410, -73, -321, -38)),
        (hidra, (-300, 277, -211, 312)), (fabrica_ultron, (567, 273, 634, 306)), (ferro_velho, (649, 273, 699, 306)),
        (usina_electro, (-410, 227, -321, 262)), (lab_octopus, (360, 377, 415, 412)),
        (nave_thanos, (-400, -280, -210, -150)), (maquina_galactus, (-260, 400, -140, 499)),
        (nave_ronan, (415, -230, 470, -100)), (portal_kang, (-160, -240, -120, -205)), (quinjet, (190, -70, 215, -42)),
    ):
        if no_ladrilho(*caixa, margem=16):
            f()


# ------------------------------------------------------------------ heróis
ESTATUAS = ["capitao_america", "thor", "homem_de_ferro", "homem_aranha", "hulk", "pantera_negra",
            "doutor_estranho", "wolverine"]


def praca_herois():
    """Praça dos Heróis: 8 estátuas gigantes e o Memorial do Tony Stark no meio."""
    x1, z1, x2, z2 = -300, -123, -211, -88
    for x in range(x1, x2 + 1):
        for z in range(z1, z2 + 1):
            P(x, -1, z, "polished_andesite" if (x + z) % 7 else "smooth_stone")
    for k, hid in enumerate(ESTATUAS):
        fila, n = divmod(k, 4)
        xe = x1 + 3 + n * 22
        if fila == 0:
            estatua(hid, xe, z1 + 1, "n"); _acessorio(hid, xe, z1 + 1, "n")
        else:
            estatua(hid, xe, z2 - 8, "s"); _acessorio(hid, xe, z2 - 8, "s")
    # memorial do Tony Stark: o reator arc de flores e luz
    mx, mz = (x1 + x2) // 2, (z1 + z2) // 2
    for dx in range(-6, 7):
        for dz in range(-3, 4):
            r = math.hypot(dx, dz * 2)
            if 4.5 <= r <= 6.5:
                P(mx + dx, -1, mz + dz, "sea_lantern")
            elif r < 4.5:
                P(mx + dx, -1, mz + dz, "grass_block")
                P(mx + dx, 0, mz + dz, ["poppy", "dandelion", "cornflower"][(dx + dz) % 3])
    P(mx, 0, mz, "light_blue_stained_glass")
    escrever("TONY STARK", (mx - 29, 1, mz + 5), (1, 0), "gold_block") if False else None


def mansao_x():
    """Mansão X (Instituto Xavier): casarão com torres, o X, a Sala de Perigo e o Cérebro no subsolo."""
    x1, z1, x2, z2 = 567, -475, 634, -398
    for x in range(x1, x2 + 1):
        for z in range(z1, z2 + 1):
            P(x, -1, z, "grass_block")
    for z in range(z1, z2 + 1):                                 # a rua entre os dois quarteirões vira jardim
        pass
    mx1, mx2, mz1, mz2 = 575, 626, -470, -448
    pedra, teto = "stone_bricks", "deepslate_tiles"
    c.predio(mx1, mz1, mx2, mz2, [(0, 16)], "deco", "s", 1963, caixa_dagua=False)
    for x in range(mx1 - 1, mx2 + 2):                           # telhado inclinado
        for k in range(6):
            P(x, 17 + k, mz1 + k, f"{teto[:-1]}_stairs[facing=south]" if False else "deepslate_tile_stairs[facing=south]")
            P(x, 17 + k, mz2 - k, "deepslate_tile_stairs[facing=north]")
        BX(x, 17, mz1 + 6, x, 22, mz2 - 6, teto)
    for tx in (mx1, mx2 - 5):                                   # torres
        BX(tx, 0, mz2 - 5, tx + 5, 26, mz2, pedra)
        for k in range(4):
            BX(tx + k // 2, 27 + k, mz2 - 5 + k // 2, tx + 5 - k // 2, 27 + k, mz2 - k // 2, teto)
    for dx in range(-4, 5):                                     # o X na fachada
        P(600 + dx, 10 + dx, mz2 + 1, "yellow_concrete")
        P(600 + dx, 10 - dx, mz2 + 1, "yellow_concrete")
    for dy in range(-6, 7):
        for dx in range(-6, 7):
            if 5.4 <= math.hypot(dx, dy) <= 6.5:
                P(600 + dx, 10 + dy, mz2 + 1, "black_concrete")
    # subsolo: Sala de Perigo e Cérebro, com escada
    BX(580, -34, -470, 620, -12, -450, "iron_block")
    BX(581, -33, -469, 619, -13, -451, "air")
    for x in range(582, 619, 4):
        for z in (-469, -451):
            col(x, z, -30, -16, "sea_lantern")
    for k in range(22):
        BX(577, -12 - k, -460 + 0, 578, -12 - k, -460, "air")
    for k in range(22):                                          # escadaria até a Sala de Perigo
        P(577, -1 - k, -460 + k % 2, "air")
    for y in range(-33, 0):
        P(576, y, -458, "iron_block")
        P(577, y, -458, "ladder[facing=east]")
    BX(577, -33, -458, 580, -31, -458, "air")
    BX(577, -1, -458, 577, 0, -458, "air")
    cx, cy, cz = 600, -24, -440                                  # o Cérebro: esfera de metal com passarela
    BX(cx - 2, -33, cz - 12, cx + 2, -31, cz - 9, "air")
    for dx in range(-9, 10):
        for dy in range(-9, 10):
            for dz in range(-9, 10):
                r = math.sqrt(dx * dx + dy * dy + dz * dz)
                if 8 <= r <= 9:
                    P(cx + dx, cy + dy, cz + dz, "iron_block" if (dx + dy) % 3 else "light_blue_stained_glass")
                elif r < 8:
                    P(cx + dx, cy + dy, cz + dz, "air")
    BX(cx - 1, cy - 1, cz - 9, cx + 1, cy - 1, cz, "polished_andesite")
    P(cx, cy, cz, "iron_block"); P(cx, cy + 1, cz, "light_blue_stained_glass")
    BX(cx - 1, -33, cz - 9, cx + 1, cy - 2, cz - 9, "air")
    # hangar do jato X embaixo da quadra de basquete
    BX(585, -1, -430, 615, -1, -405, "orange_terracotta")
    for x in (585, 615):
        BX(x, -1, -430, x, -1, -405, "white_concrete")
    BX(600, -1, -430, 600, -1, -405, "white_concrete")
    _jato(600, -8, -418)
    BX(580, -12, -432, 620, -2, -403, "iron_block")
    BX(581, -11, -431, 619, -2, -404, "air")
    BX(581, -12, -431, 619, -12, -404, "polished_andesite")
    _jato(600, -10, -418)
    for x in range(570, 632, 6):
        arvore(x, -400, 6, "oak")


def _jato(cx, y, cz):
    """O Pássaro Negro (jato X): preto, de asas em delta."""
    for k in range(18):
        meia = max(0, 6 - abs(k - 10) // 2) if k > 6 else 1
        for dx in range(-meia, meia + 1):
            P(cx + dx, y, cz - 9 + k, "black_concrete")
        if 4 < k < 14:
            P(cx, y + 1, cz - 9 + k, "black_concrete")
    P(cx, y + 1, cz - 8, "light_blue_stained_glass"); P(cx, y + 1, cz - 7, "light_blue_stained_glass")
    for k in (14, 15, 16):
        P(cx - 3, y + 1 + (k - 14), cz - 9 + k, "black_concrete"); P(cx + 3, y + 1 + (k - 14), cz - 9 + k, "black_concrete")


def pista():
    """Pista de atletismo (onde o Flash Reverso desafia o Flash)."""
    x1, z1, x2, z2 = 485, -475, 552, -442
    cx, cz = (x1 + x2) / 2, (z1 + z2) / 2
    for x in range(x1, x2 + 1):
        for z in range(z1, z2 + 1):
            d = ((x - cx) / 32) ** 2 + ((z - cz) / 15) ** 2
            if d <= 1:
                P(x, -1, z, "red_terracotta" if d > 0.62 else "grass_block")
                if 0.62 < d <= 1 and int(d * 30) % 3 == 0:
                    P(x, -1, z, "white_concrete")
    for z in range(z1 + 1, z2):
        if ((486 - cx) / 32) ** 2 + ((z - cz) / 15) ** 2 <= 1:
            P(int(cx), -1, z, "white_concrete")


def triskelion():
    """Triskelion: o QG da S.H.I.E.L.D., numa ilha na baía, com três braços em volta da torre."""
    cx, cz = 362, 472
    for x in range(cx - 60, cx + 61):
        for z in range(cz - 28, c.Z_MAX + 1):
            if (x - cx) ** 2 / 3600 + (z - cz) ** 2 / 784 <= 1:
                col(x, z, -5, -1, "stone")
                P(x, -1, z, "smooth_stone")
    for ang in (90, 210, 330):
        a = math.radians(ang)
        for k in range(8, 46):
            for w in range(-6, 7):
                x = int(round(cx + k * math.cos(a) - w * math.sin(a)))
                z = int(round(cz + k * math.sin(a) * 0.55 + w * math.cos(a) * 0.55))
                borda = abs(w) == 6 or k == 45
                col(x, z, 0, 24, "light_gray_concrete" if borda and False else ("glass" if borda else "air"))
                P(x, 25, z, "light_gray_concrete")
                for y in range(0, 25, 4):
                    P(x, y, z, "polished_andesite" if not borda else "light_gray_concrete")
    c.predio(cx - 9, cz - 9, cx + 9, cz + 8, [(0, 60), (3, 72)], "vidro", "s", 1965, caixa_dagua=False)
    escrever("SHIELD", (cx - 17, 30, cz + 9), (1, 0), "black_concrete", fundo="white_concrete", margem=1)


def aeroporta_avioes():
    """O Aeroporta-aviões da S.H.I.E.L.D. flutuando sobre a baía, com as quatro turbinas."""
    y = 120
    x1, x2, z1, z2 = -60, 60, 458, 486
    BX(x1, y - 4, z1 + 2, x2, y - 1, z2 - 2, "gray_concrete")
    BX(x1 + 10, y - 8, z1 + 5, x2 - 10, y - 5, z2 - 5, "gray_concrete")
    BX(x1, y, z1, x2, y, z2, "gray_concrete")
    for x in range(x1, x2 + 1, 6):                               # pista de pouso
        P(x, y, (z1 + z2) // 2, "white_concrete"); P(x + 1, y, (z1 + z2) // 2, "white_concrete")
    BX(x1, y, z1 + 2, x2, y, z1 + 2, "yellow_concrete")
    BX(x1, y, z2 - 2, x2, y, z2 - 2, "yellow_concrete")
    BX(20, y + 1, z2 - 6, 34, y + 12, z2 - 1, "light_gray_concrete")       # torre de comando
    BX(21, y + 9, z2 - 6, 33, y + 10, z2 - 6, "light_blue_stained_glass")
    col(30, z2 - 3, y + 13, y + 20, "iron_bars")
    for tx, tz in ((-45, z1 - 8), (45, z1 - 8), (-45, z2 + 8), (45, z2 + 8)):      # turbinas
        for dx in range(-9, 10):
            for dz in range(-9, 10):
                r = math.hypot(dx, dz)
                if 7.5 <= r <= 9:
                    P(tx + dx, y - 2, tz + dz, "iron_block")
                elif r < 7.5 and (dx == 0 or dz == 0 or abs(dx) == abs(dz)):
                    P(tx + dx, y - 2, tz + dz, "gray_concrete")
                elif r < 7.5:
                    P(tx + dx, y - 3, tz + dz, "light_blue_stained_glass")
        BX(tx - 1, y - 2, min(tz, z1 if tz < z1 else z2), tx + 1, y - 2, max(tz, z1 if tz < z1 else z2), "gray_concrete")
    escrever("SHIELD", (x1 + 4, y + 1, z1 + 4), (1, 0), "white_concrete") if False else None


def balsa():
    """A Balsa: a prisão de supervilões numa ilha artificial na baía."""
    cx, cz = -105, 476
    for dx in range(-26, 27):
        for dz in range(-20, 21):
            if abs(dx) + abs(dz) <= 34 and abs(dx) <= 26 and abs(dz) <= 20:
                col(cx + dx, cz + dz, -5, -1, "stone")
                P(cx + dx, -1, cz + dz, "gray_concrete")
                if abs(dx) + abs(dz) >= 32 or abs(dx) == 26 or abs(dz) == 20:
                    col(cx + dx, cz + dz, 0, 6, "black_concrete")
                    P(cx + dx, 7, cz + dz, "iron_bars")
    for dx in range(-12, 13):
        for dy in range(0, 13):
            for dz in range(-12, 13):
                r = math.sqrt(dx * dx + dy * dy + dz * dz)
                if 11 <= r <= 12:
                    P(cx + dx, dy, cz + dz, "gray_concrete" if dy < 9 else "black_stained_glass")
    for k in range(6):
        ang = math.radians(k * 60)
        x, z = int(cx + 20 * math.cos(ang)), int(cz + 15 * math.sin(ang))
        col(x, z, 0, 14, "gray_concrete"); P(x, 15, z, "red_concrete")


def wakanda():
    """Embaixada de Wakanda: vidro roxo, linhas de vibranium e a Pantera na frente."""
    c.predio(368, -68, 407, -42, [(0, 48), (4, 64)], "vidro", "s", 2018, caixa_dagua=False)
    for y in range(4, 64, 8):
        BX(368, y, -43, 407, y, -43, "purple_stained_glass")
    estatua("pantera_negra", 380, -45, "s", base=2)


# ------------------------------------------------------------------ vilões
def oscorp():
    """Torre Oscorp (Duende Verde): vidro verde e o letreiro OSCORP no alto."""
    c.predio(268, -70, 321, -41, [(0, 120), (4, 150), (8, 162)], "vidro", "s", 1964, caixa_dagua=False)
    for y in range(0, 150, 4):
        for x in range(269, 321, 3):
            P(x, y, -40 + 0 * 1, "lime_stained_glass") if y % 8 == 0 else None
    largura = len("OSCORP") * 6 - 1
    for z, u, x0 in ((-71, (-1, 0), 294 + largura // 2), (-40, (1, 0), 294 - largura // 2)):
        escrever("OSCORP", (x0, 135, z), u, "lime_concrete", fundo="black_concrete", margem=1)


def latveria():
    """Embaixada da Latvéria (Doutor Destino): castelo escuro com torres e estandartes verdes."""
    x1, z1, x2, z2 = -400, -70, -331, -42
    pedra = "deepslate_bricks"
    BX(x1, 0, z1, x2, 22, z2, pedra)
    BX(x1 + 1, 0, z1 + 1, x2 - 1, 21, z2 - 1, "air")
    BX(x1 + 1, -1, z1 + 1, x2 - 1, -1, z2 - 1, "polished_blackstone")
    for y in (8, 16):
        BX(x1 + 1, y, z1 + 1, x2 - 1, y, z2 - 1, "polished_blackstone")
    for x in range(x1, x2 + 1, 2):
        P(x, 23, z1, pedra); P(x, 23, z2, pedra)
    for x in range(x1 + 4, x2 - 2, 6):
        for y in (3, 4, 11, 12, 19, 20):
            P(x, y, z2, "green_stained_glass")
        col(x + 3, z2 + 1, 10, 20, "green_wool")
    for tx, tz in ((x1, z1), (x2 - 6, z1), (x1, z2 - 6), (x2 - 6, z2 - 6)):
        BX(tx, 0, tz, tx + 6, 34, tz + 6, pedra)
        for k in range(5):
            BX(tx + k // 2 + 1, 35 + k, tz + k // 2 + 1, tx + 5 - k // 2, 35 + k, tz + 5 - k // 2, "green_concrete")
    BX(-368, 0, z2, -363, 6, z2, "air")
    escrever("LATVERIA", (-389, 25, z2 + 1), (1, 0), "green_concrete") if False else None
    for y in range(0, 10):                                      # estátua do Destino na entrada
        P(-366, y, z2 + 6, "iron_block" if y > 6 else "green_concrete")
    P(-367, 7, z2 + 6, "green_concrete"); P(-365, 7, z2 + 6, "green_concrete")


def hidra():
    """Base secreta da Hidra (Caveira Vermelha): no subsolo, com a entrada numa lojinha comum."""
    x1, z1, x2, z2 = -300, 277, -211, 312
    c.predio(-262, 280, -250, 294, [(0, 12)], "tijolo", "n", 1945, loja=True)
    for k in range(20):                                          # escada escondida
        BX(-259, -1 - k, 283 + k, -257, -1 - k, 283 + k, "stone_brick_stairs[facing=north]")
        BX(-259, -k, 283 + k, -257, 1 - k if k else 0, 283 + k, "air")
    BX(-290, -34, 300, -220, -20, 312, "black_concrete")
    BX(-289, -33, 301, -221, -21, 311, "air")
    BX(-259, -21, 302, -257, -20, 303, "air")
    for x in range(-288, -222, 6):
        col(x, 311, -32, -24, "red_concrete")
        P(x, -21, 306, "sea_lantern")
    _logo_hidra(-255, -33, 306)
    for x in range(-288, -270, 4):                               # celas
        BX(x, -33, 301, x + 3, -29, 304, "iron_bars")
        BX(x + 1, -33, 302, x + 2, -30, 303, "air")


def _logo_hidra(cx, y, cz):
    """O símbolo da Hidra no chão: caveira vermelha com tentáculos."""
    for dx in range(-8, 9):
        for dz in range(-4, 5):
            r = math.hypot(dx, dz * 2)
            if r <= 3:
                P(cx + dx, y, cz + dz, "red_concrete")
            elif abs(dx) > 3 and (abs(dx) + dz) % 3 == 0:
                P(cx + dx, y, cz + dz, "red_concrete")
    P(cx - 1, y, cz - 1, "black_concrete"); P(cx + 1, y, cz - 1, "black_concrete")


def fabrica_ultron():
    """Fábrica abandonada do Ultron no Brooklyn: galpão de dentes de serra, chaminés e a cara do Ultron."""
    x1, z1, x2, z2 = 570, 276, 631, 303
    BX(x1, 0, z1, x2, 12, z2, "bricks")
    BX(x1 + 1, 0, z1 + 1, x2 - 1, 12, z2 - 1, "air")
    BX(x1 + 1, -1, z1 + 1, x2 - 1, -1, z2 - 1, "polished_andesite")
    for x in range(x1, x2 + 1):                                  # telhado em dentes de serra
        k = (x - x1) % 8
        BX(x, 12 + min(k, 5), z1, x, 12 + min(k, 5), z2, "gray_concrete" if k < 6 else "glass")
    for x in (x1 + 4, x1 + 14):
        for y in range(0, 32):
            for dx in (-1, 0, 1):
                for dz in (-1, 0, 1):
                    if dx or dz:
                        P(x + dx, y, z1 + 4 + dz, "bricks")
    for y in range(2, 11):                                       # a cara do Ultron na fachada (vermelhos os olhos)
        for x in range(594, 608):
            P(x, y, z2 + 1, "iron_block")
    for x in (597, 598, 603, 604):
        P(x, 7, z2 + 1, "red_concrete"); P(x, 6, z2 + 1, "red_concrete")
    BX(599, 3, z2 + 1, 602, 3, z2 + 1, "black_concrete")
    for x in range(x1 + 4, x2 - 3, 6):                           # robôs nas linhas de montagem
        P(x, 0, z1 + 14, "iron_block"); P(x, 1, z1 + 14, "iron_block"); P(x, 2, z1 + 14, "redstone_lamp[lit=true]" if False else "red_concrete")


def ferro_velho():
    """Ferro-velho (Abominável): pilhas de sucata e carros amassados."""
    rnd = random.Random(8)
    for x in range(649, 700):
        for z in range(273, 307):
            P(x, -1, z, "coarse_dirt" if (x + z) % 3 else "gravel")
    for _ in range(40):
        x, z = rnd.randint(651, 696), rnd.randint(275, 304)
        h = rnd.randint(1, 5)
        for y in range(h):
            for dx in range(-(h - y), h - y + 1):
                P(x + dx, y, z, rnd.choice(["iron_block", "rusty" if False else "gray_concrete", "brown_concrete",
                                            "red_concrete", "iron_bars"]))


def usina_electro():
    """Usina do Electro: torres de transmissão, transformadores e a torre de resfriamento."""
    x1, z1, x2, z2 = -410, 227, -321, 262
    for x in range(x1, x2 + 1):
        for z in range(z1, z2 + 1):
            P(x, -1, z, "gravel")
    c.predio(-405, 230, -380, 258, [(0, 20)], "tijolo", "e", 1882, caixa_dagua=False)
    cx, cz = -345, 245                                           # torre de resfriamento (hiperboloide)
    for y in range(0, 36):
        r = 10 - 4 * math.sin(math.pi * y / 36)
        for ang in range(0, 360, 4):
            a = math.radians(ang)
            P(int(round(cx + r * math.cos(a))), y, int(round(cz + r * math.sin(a))), "light_gray_concrete")
    for x in range(-375, -355, 6):                               # transformadores e para-raios
        BX(x, 0, 232, x + 3, 3, 236, "gray_concrete")
        col(x + 1, 234, 4, 7, "lightning_rod")
        P(x + 2, 4, 234, "sea_lantern")
    for z in (230, 258):
        for y in range(0, 28):
            P(-362, y, z, "iron_bars")
        BX(-366, 28, z, -358, 28, z, "iron_bars")


def lab_octopus():
    """Laboratório do Doutor Octopus: domo de vidro, o reator de fusão e os quatro braços de metal."""
    cx, cz = 388, 395
    for dx in range(-15, 16):
        for dz in range(-15, 16):
            for dy in range(0, 16):
                r = math.sqrt(dx * dx + dy * dy + dz * dz)
                if 14 <= r <= 15:
                    P(cx + dx, dy, cz + dz, "light_blue_stained_glass" if dy > 3 else "iron_block")
            if dx * dx + dz * dz <= 225:
                P(cx + dx, -1, cz + dz, "polished_andesite")
    for dx in range(-3, 4):
        for dy in range(-3, 4):
            for dz in range(-3, 4):
                if dx * dx + dy * dy + dz * dz <= 9:
                    P(cx + dx, 7 + dy, cz + dz, "sea_lantern")
    for k in range(4):
        a = math.radians(45 + k * 90)
        for t in range(10):
            P(int(cx + (4 + t) * math.cos(a)), int(1 + t * 0.6 + 2 * math.sin(t / 2)), int(cz + (4 + t) * math.sin(a)),
              "iron_block")
    BX(cx - 1, 0, cz + 14, cx + 1, 2, cz + 15, "air")


def nave_thanos():
    """A Santuário II, a nave do Thanos, pairando sobre a cidade."""
    cx, cz, y0 = -305, -215, 175
    for dx in range(-90, 91):
        for dz in range(-60, 61):
            d = (dx / 90) ** 2 + (dz / 40) ** 2
            if d > 1:
                continue
            esp = int(10 * (1 - d))
            for y in range(y0 - esp // 2, y0 + esp // 2 + 1):
                P(cx + dx, y, cz + dz, "black_concrete" if d > 0.15 else "gray_concrete")
            if 0.85 < d <= 1:
                P(cx + dx, y0, cz + dz, "gold_block")
    for dx in range(-20, 21):                                    # a ponte de comando
        for dz in range(-6, 7):
            if (dx / 20) ** 2 + (dz / 6) ** 2 <= 1:
                P(cx + 70 + dx // 3, y0 + 6, cz + dz, "red_stained_glass")


def maquina_galactus():
    """A máquina do Galactus no céu da baía: um anel gigante roxo e azul com espinhos."""
    cx, cy, cz = -200, 160, 470
    for ang in range(0, 360, 1):
        a = math.radians(ang)
        for r in range(26, 31):
            x, y = int(round(cx + r * math.cos(a))), int(round(cy + r * math.sin(a)))
            P(x, y, cz, "purple_concrete" if r < 29 else "blue_concrete")
            P(x, y, cz + 1, "purple_concrete")
        if ang % 30 == 0:
            for r in range(31, 40):
                P(int(round(cx + r * math.cos(a))), int(round(cy + r * math.sin(a))), cz, "magenta_concrete")
    for dx in range(-6, 7):
        for dy in range(-6, 7):
            if dx * dx + dy * dy <= 36:
                P(cx + dx, cy + dy, cz, "purple_stained_glass" if dx * dx + dy * dy > 9 else "sea_lantern")


def nave_ronan():
    """O Martelo Sombrio, a nave do Ronan, sobre o East River."""
    cx, cy, cz = 443, 70, -165
    for dz in range(-60, 61):
        meia = int(16 * (1 - abs(dz) / 64))
        for dx in range(-meia, meia + 1):
            P(cx + dx, cy, cz + dz, "black_concrete")
            if abs(dx) < meia - 3:
                P(cx + dx, cy + 3, cz + dz, "gray_concrete")
            if abs(dx) == meia:
                P(cx + dx, cy + 1, cz + dz, "blue_stained_glass")
    for dz in range(-60, 61, 6):
        P(cx, cy - 1, cz + dz, "sea_lantern")


def portal_kang():
    """O portal do tempo do Kang, no Sheep Meadow do Central Park."""
    cx, cz = -140, -222
    for ang in range(0, 360, 3):
        a = math.radians(ang)
        for r in (9, 10):
            P(int(round(cx + r * math.cos(a))), int(round(10 + r * math.sin(a))), cz, "crying_obsidian")
    for dx in range(-8, 9):
        for dy in range(-8, 9):
            if dx * dx + dy * dy < 64 and 10 + dy >= 0:
                P(cx + dx, 10 + dy, cz, "purple_stained_glass")


def quinjet():
    """O Quinjet pousado na plataforma leste da Torre dos Vingadores."""
    import marcos_ny
    y = 165
    x0, z0 = 200, -56
    for k in range(16):
        meia = 1 if k < 4 else min(6, 1 + (k - 4))
        for dz in range(-meia, meia + 1):
            P(x0 + k - 8, y, z0 + dz, "gray_concrete" if abs(dz) < 2 else "black_concrete")
        if 2 < k < 13:
            P(x0 + k - 8, y + 1, z0, "black_concrete")
    P(x0 - 6, y + 1, z0, "light_blue_stained_glass"); P(x0 - 5, y + 1, z0, "light_blue_stained_glass")
    for dz in (-5, 5):
        col(x0 + 6, z0 + dz, y + 1, y + 3, "black_concrete")
