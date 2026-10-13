"""Modelo 3D do castelo: uma grade de blocos e primitivas de desenho.

Coordenadas locais: x = leste, y = cima, z = sul. O chão fica em y = -1 e o
jogador fica de pé em (0, 0, POS_JOGADOR_Z), olhando para o norte.
"""
import math
import random

import numpy as np

XR = 100            # o modelo vai de -XR a +XR em x e z
YMIN, YMAX = -34, 92
POS_JOGADOR_Z = 96  # onde o jogador fica (em z local), em frente à ponte
ZOFF = -POS_JOGADOR_Z

SX, SY, SZ = 2 * XR + 1, YMAX - YMIN + 1, 2 * XR + 1

MANTER = "manter"   # célula que não é tocada (terreno original do mundo)

grid = np.zeros((SX, SY, SZ), dtype=np.int16)
palette = ["minecraft:air", MANTER]
pidx = {"minecraft:air": 0, MANTER: 1}
AR, KEEP = 0, 1

# blocos colocados um a um, em ordem, no final (redstone, portas, camas...)
ordenados = []          # lista de (x, y, z, estado, nbt)
pos_ordenadas = {}      # (x, y, z) -> índice em `ordenados`
rng = random.Random(42)


def resetar():
    global grid
    grid[:] = 0
    ordenados.clear()
    pos_ordenadas.clear()
    rng.seed(42)


def B(nome):
    if nome != MANTER and not nome.startswith("minecraft:"):
        nome = "minecraft:" + nome
    if nome not in pidx:
        pidx[nome] = len(palette)
        palette.append(nome)
    return pidx[nome]


def dentro(x, y, z):
    return -XR <= x <= XR and YMIN <= y <= YMAX and -XR <= z <= XR


def put(x, y, z, b):
    if dentro(x, y, z):
        grid[x + XR, y - YMIN, z + XR] = B(b)
        if (x, y, z) in pos_ordenadas:   # um bloco comum sobrescreve um ordenado
            i = pos_ordenadas.pop((x, y, z))
            ordenados[i] = None


def get(x, y, z):
    if not dentro(x, y, z):
        return "minecraft:air"
    return palette[grid[x + XR, y - YMIN, z + XR]]


def nome_curto(x, y, z):
    return get(x, y, z).replace("minecraft:", "").split("[")[0]


def box(x1, y1, z1, x2, y2, z2, b):
    x1, x2 = sorted((x1, x2))
    y1, y2 = sorted((y1, y2))
    z1, z2 = sorted((z1, z2))
    x1, x2 = max(x1, -XR), min(x2, XR)
    y1, y2 = max(y1, YMIN), min(y2, YMAX)
    z1, z2 = max(z1, -XR), min(z2, XR)
    if x1 > x2 or y1 > y2 or z1 > z2:
        return
    grid[x1 + XR:x2 + XR + 1, y1 - YMIN:y2 - YMIN + 1, z1 + XR:z2 + XR + 1] = B(b)
    for p in [p for p in pos_ordenadas if x1 <= p[0] <= x2 and y1 <= p[1] <= y2 and z1 <= p[2] <= z2]:
        ordenados[pos_ordenadas.pop(p)] = None


def casca(x1, y1, z1, x2, y2, z2, parede, interior="air"):
    """Caixa com paredes `parede` e miolo `interior`."""
    box(x1, y1, z1, x2, y2, z2, parede)
    box(x1 + 1, y1 + 1, z1 + 1, x2 - 1, y2 - 1, z2 - 1, interior)


def ordenado(x, y, z, estado, nbt=""):
    """Bloco colocado individualmente, na ordem de chamada, depois de todo o resto."""
    if not estado.startswith("minecraft:"):
        estado = "minecraft:" + estado
    if dentro(x, y, z):
        grid[x + XR, y - YMIN, z + XR] = B(estado)
        if (x, y, z) in pos_ordenadas:
            ordenados[pos_ordenadas[(x, y, z)]] = None
        pos_ordenadas[(x, y, z)] = len(ordenados)
        ordenados.append((x, y, z, estado, nbt))


def disco(r):
    """Células (dx, dz) de um disco de raio r (aceita raio fracionário)."""
    n = int(math.ceil(r)) + 1
    lim = r * r + r
    return [(dx, dz) for dx in range(-n, n + 1) for dz in range(-n, n + 1)
            if dx * dx + dz * dz <= lim]


def anel(r_ext, r_int):
    interno = set(disco(r_int))
    return [c for c in disco(r_ext) if c not in interno]


def cilindro(cx, cz, celulas, y1, y2, b):
    for dx, dz in celulas:
        for y in range(y1, y2 + 1):
            put(cx + dx, y, cz + dz, b)


def anel_quadrado(m):
    """Células (x, z) com max(|x|, |z|) == m."""
    return [(x, z) for x in range(-m, m + 1) for z in range(-m, m + 1)
            if max(abs(x), abs(z)) == m]


def ameias(x, z):
    return (x + z) % 2 == 0


# direções
DIRS = {"north": (0, -1), "south": (0, 1), "east": (1, 0), "west": (-1, 0)}
OPOSTO = {"north": "south", "south": "north", "east": "west", "west": "east"}


def porta(x, y, z, material, facing, hinge="left", aberta=False):
    """Porta de duas metades (colocada em par: metade de baixo, depois a de cima)."""
    ab = "true" if aberta else "false"
    ordenado(x, y, z, f"{material}_door[facing={facing},half=lower,hinge={hinge},open={ab},powered=false]")
    ordenado(x, y + 1, z, f"{material}_door[facing={facing},half=upper,hinge={hinge},open={ab},powered=false]")


def cama(x, y, z, cor, facing):
    """Cama: o pé em (x, y, z) e a cabeceira um bloco para `facing`."""
    dx, dz = DIRS[facing]
    ordenado(x, y, z, f"{cor}_bed[facing={facing},part=foot]")
    ordenado(x + dx, y, z + dz, f"{cor}_bed[facing={facing},part=head]")
