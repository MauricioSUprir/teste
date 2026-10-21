"""Nova York: uma cidade enorme inspirada em Manhattan, ao norte do castelo (só no mundo Bedrock).

Coordenadas da cidade: x = leste, z = sul, com o centro em (0, 0); no mundo, a cidade fica em
(x, z - 850). Ela vai de x = -500 a 699 e de z = -500 a 499 (1200 x 1000 blocos):

  rio Hudson        x < -440
  Manhattan         -440 <= x <= 420   (grade de avenidas norte-sul e ruas leste-oeste,
                                         a Broadway na diagonal e o Central Park)
  East River        421 <= x <= 465    (atravessado pela Ponte do Brooklyn)
  Queens/Brooklyn   x >= 466           (casas; armazéns de tijolo no Brooklyn)
  baía              z > 430            (com a Estátua da Liberdade numa ilha)

Um modelo de 1200 x 1000 x 245 não cabe na memória de uma vez, então a cidade é montada em
"ladrilhos" de 200 x 200: cada ladrilho usa o modelo normal (modelo.py) e só desenha o que cai
dentro dele. Tudo é determinístico (sementes por quarteirão/lote), então um prédio que atravessa
dois ladrilhos sai igual nos dois.
"""
import math
import random

import numpy as np

import modelo as m
import estadios as es

DESLOC_MUNDO = (0, -850)
X_MIN, X_MAX, Z_MIN, Z_MAX = -500, 699, -500, 499
TILE = 200
YMIN, YMAX = -40, 236
SKIP = -1

# ------------------------------------------------------------------ geografia
HUDSON, EAST1, EAST2, BAIA = -440, 421, 465, 430
LIBERTY = (-250, 470, 22)                      # ilha da Estátua da Liberdade (centro x, z, raio)

AVENIDAS = [-420, -310, -200, -90, 20, 130, 240, 350]
NOMES_AV = {-420: "12TH AV", -310: "10TH AV", -200: "8TH AV", -90: "7TH AV", 20: "5TH AV",
            130: "PARK AV", 240: "LEXINGTON AV", 350: "1ST AV"}
RUAS = list(range(-480, 431, 50))              # ruas leste-oeste (centro)
BROADWAY = [(170, 432), (170, 300), (-205, -175)]

# Queens / Brooklyn (do outro lado do East River): grade menor
AV_Q = [478, 560, 642]
RUAS_Q = list(range(-480, 431, 44))

CENTRAL_PARK = (-190, -500, 9, -188)          # x1, z1, x2, z2

# áreas reservadas para os pontos famosos (nenhum prédio comum é gerado nelas)
RESERVADOS = {}


def reservar(nome, x1, z1, x2, z2):
    RESERVADOS[nome] = (x1, z1, x2, z2)


def terra(x, z):
    """True se (x, z) é chão (não é rio nem baía)."""
    lx, lz, r = LIBERTY
    if (x - lx) ** 2 + (z - lz) ** 2 <= r * r:
        return True
    if x < HUDSON or EAST1 <= x <= EAST2:
        return False
    if z > BAIA:
        return False
    return True


def distrito(x, z):
    if x >= 466:
        return "brooklyn" if z >= 280 else "queens"
    if z < -180:
        return "uptown"
    if z < 120:
        return "midtown"
    if z < 300:
        return "village"
    return "downtown"


def dist_broadway(x, z):
    """Distância até a Broadway (aceita arrays)."""
    d = None
    for (ax, az), (bx, bz) in zip(BROADWAY, BROADWAY[1:]):
        vx, vz = bx - ax, bz - az
        t = np.clip(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz), 0, 1)
        dd = np.hypot(x - (ax + t * vx), z - (az + t * vz))
        d = dd if d is None else np.minimum(d, dd)
    return d


def z_broadway(x):
    """z da Broadway diagonal na coluna x."""
    (ax, az), (bx, bz) = BROADWAY[1], BROADWAY[2]
    return az + (x - ax) * (bz - az) / (bx - ax)


# ------------------------------------------------------------------ ladrilho atual
TX = TZ = 0


def no_ladrilho(x1, z1, x2, z2, margem=6):
    return (x2 + margem >= TX - m.XR and x1 - margem <= TX + m.XR and
            z2 + margem >= TZ - m.XR and z1 - margem <= TZ + m.XR)


def P(x, y, z, b):
    m.put(x - TX, y, z - TZ, b)


def BX(x1, y1, z1, x2, y2, z2, b):
    m.box(x1 - TX, y1, z1 - TZ, x2 - TX, y2, z2 - TZ, b)


def G(x, y, z):
    return m.get(x - TX, y, z - TZ)


def col(x, z, y1, y2, b):
    if y2 >= y1:
        BX(x, y1, z, x, y2, z, b)


def I(nome):
    return m.B(nome)


def novo(lx, ly, lz):
    return np.full((lx, ly, lz), SKIP, dtype=np.int16)


def blit(arr, x0, y0, z0):
    """Copia um bloco de voxels (índices da paleta; SKIP = não mexe) com o canto em (x0, y0, z0)."""
    sx, sy, sz = arr.shape
    gx0, gy0, gz0 = x0 - TX + m.XR, y0 - m.YMIN, z0 - TZ + m.XR
    a0, a1 = max(0, -gx0), min(sx, m.SX - gx0)
    b0, b1 = max(0, -gy0), min(sy, m.SY - gy0)
    c0, c1 = max(0, -gz0), min(sz, m.SZ - gz0)
    if a0 >= a1 or b0 >= b1 or c0 >= c1:
        return
    sub = arr[a0:a1, b0:b1, c0:c1]
    g = m.grid[gx0 + a0:gx0 + a1, gy0 + b0:gy0 + b1, gz0 + c0:gz0 + c1]
    np.copyto(g, sub, where=sub != SKIP)


def escrever(texto, origem, u, cor, **kw):
    x, y, z = origem
    return es.escrever(texto, (x - TX, y, z - TZ), u, cor, **kw)


def coords_ladrilho():
    eixo = np.arange(-m.XR, m.XR + 1)
    return (TX + eixo)[:, None] * np.ones((1, m.SZ), int), (TZ + eixo)[None, :] * np.ones((m.SX, 1), int)


def pintar(mascara, y, bloco):
    """Pinta a camada y onde a máscara 2D (do ladrilho) é verdadeira."""
    m.grid[:, y - m.YMIN, :][mascara] = I(bloco)


# ------------------------------------------------------------------ chão, água e ruas
def chao_e_ruas():
    X, Z = coords_ladrilho()
    m.grid[:, : -1 - m.YMIN + 1, :] = m.KEEP
    lx, lz, r = LIBERTY
    ilha = (X - lx) ** 2 + (Z - lz) ** 2 <= r * r
    agua = ((X < HUDSON) | ((X >= EAST1) & (X <= EAST2)) | (Z > BAIA)) & ~ilha
    agua &= (X >= X_MIN) & (X <= X_MAX) & (Z >= Z_MIN) & (Z <= Z_MAX)
    for y in range(-5, 0):
        pintar(agua, y, "water")
    dentro = (X >= X_MIN) & (X <= X_MAX) & (Z >= Z_MIN) & (Z <= Z_MAX) & ~agua
    # muro do cais e calçadão em volta da água
    viz = np.zeros_like(agua)
    for dx in (-1, 0, 1):
        for dz in (-1, 0, 1):
            viz |= np.roll(np.roll(agua, dx, 0), dz, 1)
    cais = dentro & viz
    for y in range(-5, 1):
        pintar(cais, y, "stone_bricks")
    pintar(cais, 1, "iron_bars")
    perto = np.zeros_like(agua)
    for d in range(1, 6):
        for dx, dz in ((d, 0), (-d, 0), (0, d), (0, -d)):
            perto |= np.roll(np.roll(agua, dx, 0), dz, 1)
    calcadao = dentro & perto & ~cais & ~ilha
    pintar(calcadao, -1, "smooth_stone")

    park = (X >= CENTRAL_PARK[0]) & (X <= CENTRAL_PARK[2]) & (Z >= CENTRAL_PARK[1]) & (Z <= CENTRAL_PARK[3])
    manh = dentro & (X >= HUDSON) & (X < EAST1) & (Z <= BAIA) & ~calcadao & ~cais
    asf = np.zeros_like(agua)
    calc = np.zeros_like(agua)
    faixa = np.zeros_like(agua)                 # faixas de pedestre
    linha = np.zeros_like(agua)                 # marcas no asfalto
    linha_am = np.zeros_like(agua)
    for c in AVENIDAS:
        asf |= (X >= c - 6) & (X <= c + 5) & ~park
        calc |= (((X >= c - 10) & (X <= c - 7)) | ((X >= c + 6) & (X <= c + 9))) & ~park
        linha |= ((X == c - 2) | (X == c + 1)) & ((Z // 4) % 2 == 0)
    for c in RUAS:
        a = (Z >= c - 5) & (Z <= c + 4)
        asf |= a & ~park
        calc |= (((Z >= c - 7) & (Z <= c - 6)) | ((Z >= c + 5) & (Z <= c + 6))) & ~park
        linha_am |= ((Z == c - 1) | (Z == c)) & ~park
    db = dist_broadway(X, Z)
    asf |= db < 6
    calc |= (db >= 6) & (db < 9)
    linha |= (db < 0.6) & ((X + Z) // 3 % 2 == 0)
    # faixas de pedestre: listras nos cruzamentos
    for c in AVENIDAS:
        noav = (X >= c - 6) & (X <= c + 5)
        for s in RUAS:
            perto_rua = ((Z >= s - 9) & (Z <= s - 6)) | ((Z >= s + 5) & (Z <= s + 8))
            faixa |= noav & perto_rua & (X % 2 == 0)
            narua = (Z >= s - 5) & (Z <= s + 4)
            perto_av = ((X >= c - 10) & (X <= c - 7)) | ((X >= c + 6) & (X <= c + 9))
            faixa |= narua & perto_av & (Z % 2 == 0) & ~park
    asf &= manh
    calc &= manh & ~asf
    pintar(calc, -1, "smooth_stone")
    pintar(calc, 0, "smooth_stone_slab[type=bottom]")
    pintar(asf, -1, "gray_concrete")
    pintar(asf & linha & ~faixa, -1, "white_concrete")
    pintar(asf & linha_am & ~faixa & ~((X % 110) < 30), -1, "yellow_concrete")
    pintar(asf & faixa, -1, "white_concrete")

    # Queens e Brooklyn
    lado = dentro & (X >= 466)
    aq = np.zeros_like(agua)
    cq = np.zeros_like(agua)
    for c in AV_Q:
        aq |= (X >= c - 4) & (X <= c + 3)
        cq |= ((X >= c - 7) & (X <= c - 5)) | ((X >= c + 4) & (X <= c + 6))
    for c in RUAS_Q:
        aq |= (Z >= c - 3) & (Z <= c + 2)
        cq |= ((Z >= c - 5) & (Z <= c - 4)) | ((Z >= c + 3) & (Z <= c + 4))
    aq &= lado & ~calcadao & ~cais
    cq &= lado & ~aq & ~calcadao & ~cais
    pintar(cq, -1, "smooth_stone")
    pintar(aq, -1, "gray_concrete")
    pintar(aq & (((X - 478) % 82 == 0) | ((Z + 480) % 44 == 0)) & ((X + Z) % 6 < 3), -1, "yellow_concrete")
    # ilha da Liberdade: gramado e passeio
    pintar(ilha & ((X - lx) ** 2 + (Z - lz) ** 2 > (r - 3) ** 2), -1, "smooth_stone")


# ------------------------------------------------------------------ prédios
PISO = "polished_andesite"


def _face(arr, lado, xa, xb, za, zb, ya, yb, func):
    """Aplica func(i, y) -> índices numa face do prisma [xa..xb] x [za..zb], alturas [ya..yb]."""
    ys = np.arange(ya, yb + 1)
    if lado in ("n", "s"):
        n = xb - xa + 1
        i, y = np.meshgrid(np.arange(n), ys, indexing="ij")
        z = za if lado == "n" else zb
        arr[xa:xb + 1, ya + 1:yb + 2, z] = func(i, y, n)
    else:
        n = zb - za + 1
        i, y = np.meshgrid(np.arange(n), ys, indexing="ij")
        x = xa if lado == "w" else xb
        arr[x, ya + 1:yb + 2, za:zb + 1] = func(i, y, n).T


ESTILOS = {
    "vidro": {
        "vidro": ["light_blue_stained_glass", "cyan_stained_glass", "gray_stained_glass", "blue_stained_glass",
                  "light_gray_stained_glass", "black_stained_glass", "glass"],
        "parede": ["gray_concrete", "light_gray_concrete", "white_concrete", "black_concrete", "iron_block"],
    },
    "deco": {
        "parede": ["smooth_sandstone", "polished_diorite", "stone_bricks", "white_terracotta", "light_gray_terracotta",
                   "cut_sandstone", "smooth_stone"],
        "vidro": ["gray_stained_glass", "black_stained_glass", "light_blue_stained_glass"],
        "faixa": ["gray_concrete", "polished_andesite", "iron_block", "black_concrete"],
    },
    "tijolo": {
        "parede": ["bricks", "red_terracotta", "brown_terracotta", "terracotta", "bricks", "granite"],
        "vidro": ["glass", "light_gray_stained_glass", "black_stained_glass"],
        "faixa": ["smooth_sandstone", "white_concrete", "stone_bricks", "smooth_stone"],
    },
    "brownstone": {
        "parede": ["brown_terracotta", "terracotta", "polished_granite", "brown_terracotta"],
        "vidro": ["glass", "black_stained_glass"],
        "faixa": ["dark_oak_planks", "polished_andesite", "smooth_sandstone"],
    },
}
TOLDOS = ["red_wool", "green_wool", "blue_wool", "black_wool", "orange_wool", "yellow_wool", "white_wool",
          "purple_wool", "cyan_wool"]


def predio(x1, z1, x2, z2, niveis, estilo, frente, seed, loja=False, caixa_dagua=None, enfeite=None):
    """Prédio com recuos (`niveis` = [(recuo, y do teto), ...]), janelas, andares, luz e escada.

    O andar térreo vai de y = 0 a 3; cada andar tem 4 blocos. `frente` é o lado da entrada
    ("n", "s", "w", "e").
    """
    if not no_ladrilho(x1, z1, x2, z2):
        return
    rnd = random.Random(seed)
    pal = ESTILOS[estilo]
    parede = I(rnd.choice(pal["parede"]))
    vidro = I(rnd.choice(pal["vidro"]))
    faixa = I(rnd.choice(pal.get("faixa", pal["parede"])))
    piso, luz, ar = I(PISO), I("sea_lantern"), m.AR
    M = 2
    lx, lz = x2 - x1 + 1, z2 - z1 + 1
    H = niveis[-1][1] + 24
    arr = novo(lx + 2 * M, H + 1, lz + 2 * M)          # índice y = y_mundo + 1

    def jan(i, y, n):
        borda = (i == 0) | (i == n - 1)
        if estilo == "vidro":
            out = np.where((y % 4 == 0) | (i % 3 == 0), parede, vidro)
        elif estilo == "deco":
            out = np.where(i % 2 == 0, parede, np.where(y % 4 == 0, faixa, vidro))
        else:
            janela = (i % 3 == 1) & ((y % 4 == 1) | (y % 4 == 2))
            out = np.where(janela, vidro, np.where((i % 3 == 1) & (y % 4 == 3), faixa, parede))
        return np.where(borda, parede, out).astype(np.int16)

    y0 = 0
    for n_nivel, (rec, ytop) in enumerate(niveis):
        xa, xb, za, zb = M + rec, M + lx - 1 - rec, M + rec, M + lz - 1 - rec
        for lado in "nswe":
            _face(arr, lado, xa, xb, za, zb, y0, ytop - 1, jan)
        arr[xa:xb + 1, ytop + 1, za:zb + 1] = parede if estilo != "vidro" else I("gray_concrete")
        arr[xa:xb + 1, ytop + 2, za] = parede; arr[xa:xb + 1, ytop + 2, zb] = parede
        arr[xa, ytop + 2, za:zb + 1] = parede; arr[xb, ytop + 2, za:zb + 1] = parede
        for y in range(max(4, y0 + (-y0) % 4), ytop, 4):
            arr[xa + 1:xb, y + 1, za + 1:zb] = piso
        for px in range(xa + 4, xb - 2, 9):                # colunas de luz (iluminam os andares)
            for pz in range(za + 4, zb - 2, 9):
                arr[px, y0 + 1:ytop + 1, pz] = luz
        y0 = ytop
    arr[M + 1:M + lx - 1, 0, M + 1:M + lz - 1] = piso      # piso do térreo (y = -1)
    # escada de mão (no núcleo do último recuo) do térreo até o telhado
    rec_t = niveis[-1][0]
    cx, cz = M + rec_t + 1, M + rec_t + 1
    topo = niveis[-1][1]
    arr[cx, 1:topo + 2, cz] = parede
    arr[cx + 1, 1:topo + 2, cz] = I("ladder[facing=east]")
    # entrada (e marquise) no lado da frente
    if frente in ("n", "s"):
        z = M if frente == "n" else M + lz - 1
        dz = -1 if frente == "n" else 1
        meio = M + lx // 2
        largura = 2 if lx < 14 else 4
        arr[meio - largura // 2:meio + (largura + 1) // 2, 1:4, z] = ar
        if loja:
            arr[M + 1:M + lx - 1, 1:4, z] = np.where(arr[M + 1:M + lx - 1, 1:4, z] == ar, ar, vidro)
            arr[M:M + lx, 5, z + dz] = I(rnd.choice(TOLDOS))
        else:
            arr[meio - largura // 2 - 1:meio + (largura + 1) // 2 + 1, 5, z + dz] = faixa
    else:
        x = M if frente == "w" else M + lx - 1
        dx = -1 if frente == "w" else 1
        meio = M + lz // 2
        largura = 2 if lz < 14 else 4
        arr[x, 1:4, meio - largura // 2:meio + (largura + 1) // 2] = ar
        if loja:
            arr[x, 1:4, M + 1:M + lz - 1] = np.where(arr[x, 1:4, M + 1:M + lz - 1] == ar, ar, vidro)
            arr[x + dx, 5, M:M + lz] = I(rnd.choice(TOLDOS))
        else:
            arr[x + dx, 5, meio - largura // 2 - 1:meio + (largura + 1) // 2 + 1] = faixa
    # escadas de incêndio (prédios de tijolo), na fachada da frente
    if estilo == "tijolo" and frente in ("n", "s") and lx >= 7:
        z = M - 1 if frente == "n" else M + lz
        zz = z - 1 if frente == "n" else z + 1
        for y in range(4, niveis[0][1], 4):
            for x in range(M + 1, M + min(lx - 1, 8)):
                arr[x, y + 1, z] = I("polished_blackstone_slab[type=top]")
                arr[x, y + 2, zz] = I("iron_bars")
            arr[M + 1, y + 2, z] = I("iron_bars"); arr[M + min(lx - 1, 8) - 1, y + 2, z] = I("iron_bars")
    # cornija
    if estilo in ("tijolo", "brownstone", "deco"):
        rec, ytop = niveis[0]
        corn = I("dark_oak_slab[type=top]" if estilo == "brownstone" else "smooth_stone_slab[type=top]")
        arr[M - 1:M + lx + 1, ytop + 1, M - 1] = corn; arr[M - 1:M + lx + 1, ytop + 1, M + lz] = corn
        arr[M - 1, ytop + 1, M - 1:M + lz + 1] = corn; arr[M + lx, ytop + 1, M - 1:M + lz + 1] = corn
    # coisas no telhado
    rec, ytop = niveis[-1]
    xa, xb, za, zb = M + rec, M + lx - 1 - rec, M + rec, M + lz - 1 - rec
    if caixa_dagua is None:
        caixa_dagua = estilo in ("tijolo", "deco") and rnd.random() < 0.6 and (xb - xa) >= 7 and (zb - za) >= 7
    if caixa_dagua:
        _caixa_dagua(arr, xb - 4, ytop + 2, zb - 4)
    elif estilo == "vidro" and (xb - xa) >= 8:
        arr[xa + 3:xa + 7, ytop + 2:ytop + 5, za + 3:za + 6] = I("gray_concrete")
        if rnd.random() < 0.4:
            arr[(xa + xb) // 2, ytop + 2:ytop + 2 + rnd.randint(8, 18), (za + zb) // 2] = I("iron_bars")
    blit(arr, x1 - M, -1, z1 - M)
    if enfeite:
        enfeite(x1, z1, x2, z2, niveis)


def _caixa_dagua(arr, cx, y, cz):
    """A clássica caixa d'água de madeira dos telhados de Nova York."""
    fence, tabua = I("spruce_fence"), I("spruce_planks")
    for dx, dz in ((-1, -1), (-1, 1), (1, -1), (1, 1)):
        arr[cx + dx, y:y + 4, cz + dz] = fence
    for dx in range(-2, 3):
        for dz in range(-2, 3):
            if dx * dx + dz * dz <= 5:
                borda = dx * dx + dz * dz >= 3
                arr[cx + dx, y + 4, cz + dz] = tabua
                if borda:
                    arr[cx + dx, y + 5:y + 9, cz + dz] = tabua
                arr[cx + dx, y + 9, cz + dz] = I("spruce_slab[type=bottom]")
    arr[cx, y + 10, cz] = I("spruce_slab[type=bottom]")


def casa(x1, z1, x2, z2, frente, seed):
    """Casa de subúrbio (Queens): dois andares, telhado de duas águas, varanda, quintal e cerca."""
    if not no_ladrilho(x1, z1, x2, z2):
        return
    rnd = random.Random(seed)
    parede = rnd.choice(["white_concrete", "birch_planks", "oak_planks", "light_blue_terracotta", "white_terracotta",
                         "yellow_terracotta", "bricks", "light_gray_concrete"])
    telhado = rnd.choice(["dark_oak", "spruce", "stone_brick", "deepslate_brick", "brick"])
    lx, lz = x2 - x1 + 1, z2 - z1 + 1
    # casa no meio do lote, com quintal atrás e jardim na frente
    if frente in ("n", "s"):
        hx1, hx2 = x1 + 2, x2 - 2
        if frente == "n":
            hz1, hz2 = z1 + 4, min(z1 + 12, z2 - 3)
        else:
            hz1, hz2 = max(z2 - 12, z1 + 3), z2 - 4
    else:
        hz1, hz2 = z1 + 2, z2 - 2
        if frente == "w":
            hx1, hx2 = x1 + 4, min(x1 + 12, x2 - 3)
        else:
            hx1, hx2 = max(x2 - 12, x1 + 3), x2 - 4
    BX(hx1, 0, hz1, hx2, 7, hz2, parede)
    BX(hx1 + 1, 0, hz1 + 1, hx2 - 1, 6, hz2 - 1, "air")
    BX(hx1 + 1, -1, hz1 + 1, hx2 - 1, -1, hz2 - 1, "oak_planks")
    BX(hx1 + 1, 4, hz1 + 1, hx2 - 1, 4, hz2 - 1, "oak_planks")
    put_luz = (hx1 + hx2) // 2, (hz1 + hz2) // 2
    P(put_luz[0], 3, put_luz[1], "lantern[hanging=true]")
    P(put_luz[0], 7, put_luz[1], "lantern[hanging=true]")
    # janelas
    for x in range(hx1 + 1, hx2):
        if (x - hx1) % 3 == 1:
            for z in (hz1, hz2):
                P(x, 1, z, "glass_pane"); P(x, 2, z, "glass_pane")
                P(x, 5, z, "glass_pane"); P(x, 6, z, "glass_pane")
    for z in range(hz1 + 1, hz2):
        if (z - hz1) % 3 == 1:
            for x in (hx1, hx2):
                P(x, 1, z, "glass_pane"); P(x, 2, z, "glass_pane")
                P(x, 5, z, "glass_pane"); P(x, 6, z, "glass_pane")
    # telhado de duas águas (cumeeira ao longo do lado comprido)
    escada = f"{telhado}_stairs"
    if hx2 - hx1 >= hz2 - hz1:
        meia = (hz2 - hz1) // 2 + 1
        for k in range(meia + 1):
            za, zb = hz1 - 1 + k, hz2 + 1 - k
            y = 8 + k
            if za > zb:
                break
            for x in range(hx1 - 1, hx2 + 2):
                if za == zb:
                    P(x, y, za, f"{telhado}_slab[type=bottom]" if telhado != "brick" else "brick_slab[type=bottom]")
                else:
                    P(x, y, za, f"{escada}[facing=south]")
                    P(x, y, zb, f"{escada}[facing=north]")
            for x in (hx1, hx2):
                if za + 1 <= zb - 1:
                    BX(x, y, za + 1, x, y, zb - 1, parede)
    else:
        meia = (hx2 - hx1) // 2 + 1
        for k in range(meia + 1):
            xa, xb = hx1 - 1 + k, hx2 + 1 - k
            y = 8 + k
            if xa > xb:
                break
            for z in range(hz1 - 1, hz2 + 2):
                if xa == xb:
                    P(xa, y, z, f"{telhado}_slab[type=bottom]" if telhado != "brick" else "brick_slab[type=bottom]")
                else:
                    P(xa, y, z, f"{escada}[facing=east]")
                    P(xb, y, z, f"{escada}[facing=west]")
            for z in (hz1, hz2):
                if xa + 1 <= xb - 1:
                    BX(xa + 1, y, z, xb - 1, y, z, parede)
    # porta, varanda, caminho e caixa de correio
    if frente in ("n", "s"):
        zf = hz1 if frente == "n" else hz2
        dz = -1 if frente == "n" else 1
        mx = (hx1 + hx2) // 2
        P(mx, 0, zf, "air"); P(mx, 1, zf, "air")
        BX(hx1 + 1, 0, zf + dz, hx2 - 1, 0, zf + 2 * dz, "oak_slab[type=bottom]" if False else "spruce_planks")
        BX(hx1 + 1, 3, zf + dz, hx2 - 1, 3, zf + 2 * dz, "spruce_slab[type=bottom]")
        for x in (hx1 + 1, hx2 - 1):
            col(x, zf + 2 * dz, 1, 2, "spruce_fence")
        zc = z1 if frente == "n" else z2
        for z in range(min(zc, zf + 3 * dz), max(zc, zf + 3 * dz) + 1):
            P(mx, -1, z, "smooth_stone")
        for x in range(x1, x2 + 1):
            if x != mx:
                P(x, 0, zc, "white_concrete" if False else "spruce_fence")
        P(mx + 2, 0, zc, "spruce_fence"); P(mx + 2, 1, zc, "blue_concrete" if False else "barrel[facing=up]")
    else:
        xf = hx1 if frente == "w" else hx2
        dx = -1 if frente == "w" else 1
        mz = (hz1 + hz2) // 2
        P(xf, 0, mz, "air"); P(xf, 1, mz, "air")
        BX(xf + dx, 0, hz1 + 1, xf + 2 * dx, 0, hz2 - 1, "spruce_planks")
        BX(xf + dx, 3, hz1 + 1, xf + 2 * dx, 3, hz2 - 1, "spruce_slab[type=bottom]")
        xc = x1 if frente == "w" else x2
        for x in range(min(xc, xf + 3 * dx), max(xc, xf + 3 * dx) + 1):
            P(x, -1, mz, "smooth_stone")
        for z in range(z1, z2 + 1):
            if z != mz:
                P(xc, 0, z, "spruce_fence")
    # árvore no quintal
    if rnd.random() < 0.7:
        tx = x1 + 2 if frente in ("n", "s") else (x1 + 1 if frente == "e" else x2 - 1)
        tz = (z2 - 1 if frente == "n" else z1 + 1) if frente in ("n", "s") else z1 + 2
        arvore(tx, tz, rnd.choice([4, 5]), rnd.choice(["oak", "birch"]))


def arvore(x, z, altura=5, tipo="oak"):
    col(x, z, 0, altura - 1, f"{tipo}_log")
    for dx in range(-2, 3):
        for dz in range(-2, 3):
            for dy in (-1, 0, 1):
                if abs(dx) + abs(dz) + abs(dy) <= 3 and (dx, dz) != (0, 0):
                    P(x + dx, altura + dy, z + dz, f"{tipo}_leaves")
    P(x, altura, z, f"{tipo}_leaves")
    P(x, altura + 1, z, f"{tipo}_leaves")


def arvore_calcada(x, z):
    """Arvorezinha de calçada, num canteiro."""
    P(x, -1, z, "dirt" if False else "grass_block")
    P(x, 0, z, "oak_log")
    col(x, z, 1, 2, "oak_log")
    for dx in (-1, 0, 1):
        for dz in (-1, 0, 1):
            P(x + dx, 3, z + dz, "oak_leaves")
    P(x, 4, z, "oak_leaves")


# ------------------------------------------------------------------ quarteirões e lotes
def quarteiroes():
    """Lista de (x1, z1, x2, z2, i, j) dos quarteirões de Manhattan."""
    out = []
    bordas_x = [HUDSON + 6] + AVENIDAS + [EAST1 - 6]
    for i in range(len(bordas_x) - 1):
        a, b = bordas_x[i], bordas_x[i + 1]
        x1 = a + 10 if a in AVENIDAS else a
        x2 = b - 11 if b in AVENIDAS else b
        bordas_z = [Z_MIN] + RUAS + [BAIA - 6]
        for j in range(len(bordas_z) - 1):
            c, d = bordas_z[j], bordas_z[j + 1]
            z1 = c + 7 if c in RUAS else c
            z2 = d - 8 if d in RUAS else d
            if x2 - x1 >= 8 and z2 - z1 >= 8:
                out.append((x1, z1, x2, z2, i, j))
    return out


def quarteiroes_q():
    out = []
    bx = [466 + 3] + AV_Q + [X_MAX]
    for i in range(len(bx) - 1):
        x1 = bx[i] + 7 if bx[i] in AV_Q else bx[i]
        x2 = bx[i + 1] - 8 if bx[i + 1] in AV_Q else bx[i + 1]
        bz = [Z_MIN] + RUAS_Q + [BAIA - 6]
        for j in range(len(bz) - 1):
            z1 = bz[j] + 5 if bz[j] in RUAS_Q else bz[j]
            z2 = bz[j + 1] - 6 if bz[j + 1] in RUAS_Q else bz[j + 1]
            if x2 - x1 >= 8 and z2 - z1 >= 8:
                out.append((x1, z1, x2, z2, i, j))
    return out


def _sobrepoe(a, b):
    return a[0] <= b[2] and b[0] <= a[2] and a[1] <= b[3] and b[1] <= a[3]


def _lote_livre(x1, z1, x2, z2):
    r = (x1, z1, x2, z2)
    if _sobrepoe(r, CENTRAL_PARK):
        return False
    if any(_sobrepoe(r, q) for q in RESERVADOS.values()):
        return False
    pts = [(x, z) for x in (x1, (x1 + x2) / 2, x2) for z in (z1, (z1 + z2) / 2, z2)]
    if min(float(dist_broadway(x, z)) for x, z in pts) < 10:
        return False
    return all(terra(x, z) for x, z in pts)


def _praca(x1, z1, x2, z2, seed):
    """Pracinha (sobras da Broadway): piso, árvores e bancos."""
    if not no_ladrilho(x1, z1, x2, z2):
        return
    rnd = random.Random(seed)
    for x in range(x1, x2 + 1):
        for z in range(z1, z2 + 1):
            if float(dist_broadway(x, z)) >= 9 and terra(x, z):
                P(x, -1, z, "smooth_stone" if (x + z) % 4 else "polished_andesite")
    for _ in range(max(1, (x2 - x1) * (z2 - z1) // 150)):
        x, z = rnd.randint(x1 + 2, x2 - 2), rnd.randint(z1 + 2, z2 - 2)
        if float(dist_broadway(x, z)) >= 12:
            arvore_calcada(x, z)
            P(x + 2, 0, z, "spruce_stairs[facing=west]")


def lotes_manhattan():
    for x1, z1, x2, z2, i, j in quarteiroes():
        if not no_ladrilho(x1, z1, x2, z2, margem=12):
            continue
        rnd = random.Random(i * 1000 + j)
        d = distrito((x1 + x2) / 2, (z1 + z2) / 2)
        if _sobrepoe((x1, z1, x2, z2), CENTRAL_PARK):
            continue
        if d in ("midtown", "downtown"):
            x = x1
            k = 0
            while x <= x2 - 10:
                w = rnd.randint(18, 40)
                xb = min(x + w - 1, x2)
                if x2 - xb < 14:
                    xb = x2
                _lote_torre(x, z1, xb, z2, d, rnd.random(), (i, j, k))
                x = xb + 1 + (0 if xb == x2 else rnd.choice([0, 0, 2]))
                k += 1
        else:
            meio = (z1 + z2) // 2
            for fila, (za, zb, frente) in enumerate(((z1, meio - 1, "n"), (meio + 1, z2, "s"))):
                x, k = x1, 0
                while x <= x2 - 6:
                    w = rnd.randint(7, 14)
                    xb = min(x + w - 1, x2)
                    if x2 - xb < 6:
                        xb = x2
                    _lote_fila(x, za, xb, zb, d, frente, (i, j, fila, k), x in (x1,) or xb == x2)
                    x = xb + 1
                    k += 1


def _lote_torre(x1, z1, x2, z2, d, r, chave):
    if not _lote_livre(x1, z1, x2, z2):
        _praca(x1, z1, x2, z2, hash(chave))
        return
    rnd = random.Random(hash(chave))
    if d == "midtown":
        alt = rnd.choice([48, 60, 72, 88, 100, 120, 140, 160])
    else:
        alt = rnd.choice([40, 52, 64, 80, 96, 120, 150, 180])
    estilo = "vidro" if r < 0.55 else ("deco" if r < 0.85 else "tijolo")
    if estilo == "tijolo":
        alt = min(alt, 40)
    niveis = [(0, alt)]
    if alt >= 60 and rnd.random() < 0.7 and min(x2 - x1, z2 - z1) >= 18:
        b = rnd.choice([16, 24, 32])
        niveis = [(0, b), (3, alt)]
        if alt >= 120 and rnd.random() < 0.6:
            niveis.append((6, alt + rnd.choice([12, 20])))
    frente = "n" if (chave[2] % 2 == 0) else "s"
    enfeite = None
    import marcos_ny
    if math.hypot((x1 + x2) / 2 - marcos_ny.TS[0], (z1 + z2) / 2 - marcos_ny.TS[1]) < 120:
        estilo, niveis = "vidro", [(0, max(alt, 60))]                 # Times Square: prédios com telões
        enfeite = lambda a, b, cc, d, n: marcos_ny.teloes(a, b, cc, d, n, hash(chave))
    predio(x1, z1, x2, z2, niveis, estilo, frente, hash(chave) & 0xFFFFFF, loja=rnd.random() < 0.5,
           enfeite=enfeite)


def _lote_fila(x1, z1, x2, z2, d, frente, chave, esquina):
    if not _lote_livre(x1, z1, x2, z2):
        _praca(x1, z1, x2, z2, hash(chave))
        return
    rnd = random.Random(hash(chave))
    if d == "village":
        estilo = rnd.choice(["brownstone", "brownstone", "tijolo"])
        alt = rnd.choice([12, 16, 16, 20, 24])
    elif d == "uptown":
        if (x1 + x2) / 2 > 20:                       # Upper East Side: prédios de pedra mais altos
            estilo = rnd.choice(["deco", "deco", "tijolo"])
            alt = rnd.choice([24, 32, 40, 48, 56])
        else:                                        # Upper West Side: brownstones e tijolo
            estilo = rnd.choice(["brownstone", "tijolo", "brownstone"])
            alt = rnd.choice([16, 20, 24, 28])
    else:
        estilo, alt = "tijolo", 16
    predio(x1, z1, x2, z2, [(0, alt)], estilo, frente, hash(chave) & 0xFFFFFF,
           loja=esquina or rnd.random() < 0.25)
    if estilo == "brownstone":
        _escadinha(x1, z1, x2, z2, frente)


def _escadinha(x1, z1, x2, z2, frente):
    """O "stoop": escada de pedra que sobe até a porta das casas brownstone."""
    mx = (x1 + x2) // 2
    if frente == "n":
        for k, z in enumerate((z1 - 1, z1 - 2)):
            P(mx, 0, z, "stone_brick_stairs[facing=south]" if k else "stone_bricks")
            P(mx - 1, 0, z, "stone_brick_stairs[facing=south]" if k else "stone_bricks")
    else:
        for k, z in enumerate((z2 + 1, z2 + 2)):
            P(mx, 0, z, "stone_brick_stairs[facing=north]" if k else "stone_bricks")
            P(mx - 1, 0, z, "stone_brick_stairs[facing=north]" if k else "stone_bricks")


def lotes_queens():
    for x1, z1, x2, z2, i, j in quarteiroes_q():
        if not no_ladrilho(x1, z1, x2, z2, margem=12):
            continue
        if any(_sobrepoe((x1, z1, x2, z2), q) for q in RESERVADOS.values()):
            continue
        rnd = random.Random(70000 + i * 100 + j)
        d = distrito((x1 + x2) / 2, (z1 + z2) / 2)
        meio = (z1 + z2) // 2
        for fila, (za, zb, frente) in enumerate(((z1, meio, "n"), (meio + 1, z2, "s"))):
            x, k = x1, 0
            while x <= x2 - 9:
                if d == "brooklyn":
                    w = rnd.randint(10, 22)
                    xb = min(x + w - 1, x2) if x2 - (x + w - 1) >= 10 else x2
                    predio(x, za, xb, zb, [(0, rnd.choice([12, 16, 20, 24]))], rnd.choice(["tijolo", "brownstone"]),
                           frente, hash((i, j, fila, k, 7)) & 0xFFFFFF, loja=rnd.random() < 0.3)
                else:
                    w = rnd.randint(12, 15)
                    xb = min(x + w - 1, x2) if x2 - (x + w - 1) >= 12 else x2
                    casa(x, za, xb, zb, frente, hash((i, j, fila, k)))
                x = xb + 1
                k += 1


# ------------------------------------------------------------------ mobiliário urbano
def mobiliario():
    """Postes, semáforos, hidrantes, árvores, táxis, metrô, bancas e carrinhos de comida."""
    for c in AVENIDAS:
        for s in RUAS:
            if not no_ladrilho(c - 12, s - 9, c + 12, s + 9):
                continue
            if _sobrepoe((c - 12, s - 9, c + 12, s + 9), CENTRAL_PARK) or not terra(c, s):
                continue
            rnd = random.Random(c * 7919 + s)
            for sx, sz in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
                x = c + (9 if sx > 0 else -10)
                z = s + (6 if sz > 0 else -7)
                if terra(x, z) and float(dist_broadway(x, z)) >= 9:
                    _semaforo(x, z, sx, sz)
            if rnd.random() < 0.18:
                _metro(c + 6, s + 9 if rnd.random() < 0.5 else s - 13)
    for c in AVENIDAS:                            # ao longo das avenidas
        for z in range(Z_MIN, BAIA - 6, 1):
            if not (TZ - m.XR - 2 <= z <= TZ + m.XR + 2) or not no_ladrilho(c - 12, z, c + 12, z):
                continue
            if any(s - 9 <= z <= s + 9 for s in RUAS):
                continue
            for x, lado in ((c - 9, -1), (c + 8, 1)):
                if _sobrepoe((x, z, x, z), CENTRAL_PARK) or not terra(x, z) or float(dist_broadway(x, z)) < 9:
                    continue
                h = (x * 31 + z * 17) % 97
                if z % 24 == 0:
                    _poste(x, z, -lado, 0)
                elif z % 24 == 12 and h < 70:
                    arvore_calcada(x, z)
                elif h == 5:
                    P(x, 0, z, "red_concrete")                      # hidrante
                elif h == 9:
                    P(x, 0, z, "blue_concrete"); P(x, 1, z, "blue_concrete")   # caixa de correio
                elif h == 13:
                    _carrinho(x, z)
            h = (c * 13 + z * 7) % 113
            if h < 3 and z % 12 == 3:
                _taxi(c + 3 if h % 2 else c - 6, z, "z")
    for s in RUAS:                                # ao longo das ruas
        for x in range(HUDSON + 6, EAST1 - 6):
            if not (TX - m.XR - 2 <= x <= TX + m.XR + 2):
                continue
            if any(c - 11 <= x <= c + 10 for c in AVENIDAS):
                continue
            for z, lado in ((s - 7, -1), (s + 6, 1)):
                if _sobrepoe((x, z, x, z), CENTRAL_PARK) or not terra(x, z) or float(dist_broadway(x, z)) < 9:
                    continue
                h = (x * 29 + z * 11) % 89
                if x % 20 == 0:
                    _poste(x, z, 0, -lado)
                elif x % 20 == 10 and h < 60:
                    arvore_calcada(x, z)
                elif h == 7:
                    P(x, 0, z, "red_concrete")
            h = (s * 5 + x * 3) % 131
            if h < 2 and x % 10 == 0 and not _sobrepoe((x, s, x, s), CENTRAL_PARK):
                _taxi(x, s - 4 if h else s + 1, "x")
    for c in AV_Q:                                # Queens: postes e árvores
        for z in range(Z_MIN, BAIA - 6, 16):
            if no_ladrilho(c - 8, z, c + 8, z) and terra(c, z):
                _poste(c - 6, z, 1, 0)
                if (z // 16) % 2:
                    arvore_calcada(c + 5, z + 8)


def _poste(x, z, dx, dz):
    """Poste de luz com o braço (e a lâmpada) virado para (dx, dz), para cima da rua."""
    col(x, z, 0, 6, "iron_bars")
    P(x, 7, z, "polished_blackstone")
    P(x + dx, 7, z + dz, "polished_blackstone")
    P(x + dx, 6, z + dz, "sea_lantern")


def _semaforo(x, z, sx, sz):
    col(x, z, 0, 4, "iron_bars")
    P(x, 5, z, "black_concrete")
    P(x, 6, z, "red_concrete" if (x + z) % 2 else "lime_concrete")
    P(x, 7, z, "black_concrete")


def _carrinho(x, z):
    """Carrinho de cachorro-quente com guarda-sol."""
    P(x, 0, z, "white_concrete")
    P(x, 1, z, "iron_bars")
    P(x, 2, z, "iron_bars")
    for dx in (-1, 0, 1):
        for dz in (-1, 0, 1):
            P(x + dx, 3, z + dz, "yellow_wool" if (dx + dz) % 2 else "blue_wool")


def _taxi(x, z, eixo):
    """Táxi amarelo (4 de comprimento) parado na rua."""
    if eixo == "z":
        cel = [(x + a, z + b) for a in (0, 1) for b in range(4)]
    else:
        cel = [(x + b, z + a) for a in (0, 1) for b in range(4)]
    if not all(terra(cx, cz) for cx, cz in cel):
        return
    for i, (cx, cz) in enumerate(cel):
        b = i % 4
        P(cx, 0, cz, "black_concrete" if b in (0, 3) else "yellow_concrete")
        P(cx, 1, cz, "yellow_concrete" if b in (0, 3) else "black_stained_glass")
    cx, cz = cel[1]
    P(cx, 2, cz, "white_concrete")


def _metro(x, z):
    """Entrada do metrô: grade verde, globos de luz e escada descendo para uma estaçãozinha."""
    if not terra(x, z) or not terra(x + 4, z + 4):
        return
    BX(x, -6, z, x + 3, -2, z + 9, "white_concrete")        # caixa da estação (azulejos)
    for k in range(5):
        BX(x + 1, -1 - k, z + k, x + 2, -1 - k, z + k, "stone_brick_stairs[facing=north]")
        BX(x + 1, -k, z + k, x + 2, 0, z + k, "air")
    BX(x + 1, -5, z + 5, x + 2, -3, z + 8, "air")
    BX(x + 1, -6, z + 5, x + 2, -6, z + 8, "polished_andesite")
    P(x + 1, -3, z + 8, "sea_lantern")
    for zz in range(z, z + 5):
        P(x, 0, zz, "green_stained_glass_pane"); P(x + 3, 0, zz, "green_stained_glass_pane")
    P(x, 1, z, "lime_stained_glass"); P(x + 3, 1, z, "lime_stained_glass")      # globos verdes
    P(x + 1, 0, z + 5, "green_stained_glass_pane"); P(x + 2, 0, z + 5, "green_stained_glass_pane")


# ------------------------------------------------------------------ montagem
def ladrilhos():
    return [(tx, tz) for tx in range(X_MIN + TILE // 2, X_MAX + 1, TILE)
            for tz in range(Z_MIN + TILE // 2, Z_MAX + 1, TILE)]


def construir_ladrilho(tx, tz):
    """Monta o ladrilho centrado em (tx, tz) no modelo (m.XR = 100)."""
    global TX, TZ
    import marcos_ny
    TX, TZ = tx, tz
    m.configurar(TILE // 2, YMIN, YMAX)
    marcos_ny.reservas()
    chao_e_ruas()
    lotes_manhattan()
    lotes_queens()
    marcos_ny.todos()
    mobiliario()
