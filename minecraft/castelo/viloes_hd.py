"""Vilões detalhados (texturas 4x e peças em 3D), no mesmo sistema dos trajes HD."""
import random

from modelos3d import Cubo, R, rgba, mistura, clarear
from trajes_hd import (Traje, PELE, pintar_tudo, lados, costuras, luvas, botas, cinto, capa, cabelo_todo,
                       cabelo_comprido, rosto_humano, olho, escamas, teia, raio_simbolo, estrela, pedras,
                       musculos_peito)


def placas(f, cor, escuro, passo=2.0):
    """Placas de armadura com rebites."""
    y = 0
    while y < f.h:
        f.ret(0, y, f.w, y + 0.25, escuro)
        for x in range(1, int(f.w), 2):
            f.ret(x, y + 0.5, x + 0.3, y + 0.8, clarear(cor, 0.25))
        y += passo


def gavinhas(f, cor, semente, n=10, larg=2):
    rnd = random.Random(semente)
    for _ in range(n):
        x, y = rnd.uniform(0, f.w), rnd.uniform(0, f.h)
        pts = [(x, y)]
        for _ in range(4):
            x += rnd.uniform(-1.4, 1.4)
            y += rnd.uniform(-1.4, 1.4)
            pts.append((x, y))
        f.linha(pts, cor, larg)


# ------------------------------------------------------------------ os vilões
def thanos(t):
    roxo, roxo2, ouro, ouro2, azul = "#7a5a9a", "#55406e", "#d4a72c", "#9a7414", "#2b4a9a"
    pintar_tudo(t, roxo, azul, azul, azul, azul, ouro)
    fr = t.cabeca["north"]
    fr.preencher(roxo)
    for x in (1.0, 2.0, 3.0, 5.0, 6.0, 7.0):
        fr.linha([(x, 5.8), (x + 0.2, 8)], roxo2, 1)
    olho(fr, 2.6, 3.6, "#3a6ac8", 1)
    olho(fr, 5.4, 3.6, "#3a6ac8", -1)
    fr.ret(1.6, 2.7, 3.6, 3.1, roxo2)
    fr.ret(4.4, 2.7, 6.4, 3.1, roxo2)
    fr.ret(2.6, 6.4, 5.4, 6.8, "#3a2a4a")
    t.cabeca["up"].preencher(ouro)
    for f in ("east", "west", "south"):
        t.cabeca[f].preencher(ouro)
        placas(t.cabeca[f], ouro, ouro2)
    t.cabeca["north"].ret(0, 0, 8, 1.5, ouro)
    queixo = t.extra("capacete", Cubo("head", [-3.5, 22.5, -5.2], [7, 3, 2], 0, "queixo"))
    queixo.todas(roxo)
    for f in queixo.faces.values():
        for x in range(1, 7):
            f.linha([(x, 0), (x, f.h)], roxo2, 1)
    co = t.corpo["north"]
    co.preencher(azul)
    co.poli([(0, 0), (8, 0), (8, 5), (4, 7), (0, 5)], ouro)
    placas(co, ouro, ouro2, 1.6)
    co.ret(0, 7, 8, 12, azul)
    musculos_peito(co, clarear(azul, -0.2))
    cinto(t, ouro, ouro2, 10.0)
    for f in lados(t.braco):
        f.ret(0, 0, f.w, 3, ouro)
        placas(f, ouro, ouro2, 1.5)
        f.ret(0, 3, f.w, 12, azul)
    luvas(t, ouro, 7.5)
    joias = ["#ff2a2a", "#ff9a1a", "#ffe14a", "#3dff6a", "#3d9cff", "#b25cff"]
    m = t.braco["north"]
    m.acender(lambda f: [f.elipse(0.8 + k * 0.5, 9.4 + (k % 2) * 0.9, 0.3, 0.3, c) for k, c in enumerate(joias)])
    for f in lados(t.perna):
        f.linha([(f.w / 2, 0), (f.w / 2, 12)], ouro, 2)


def loki(t):
    verde, verde2, ouro, ouro2, preto = "#1f6a3a", "#124226", "#d4a72c", "#8a6a14", "#1b1b20"
    pintar_tudo(t, "#121212", preto, verde, preto, preto, preto)
    cabelo_comprido(t, "#121212")
    fr = t.cabeca["north"]
    rosto_humano(fr, "#e8c4a8", "#121212", olhos="#3e8a5a", boca="#9a5050")
    fr.poli([(0, 0), (8, 0), (8, 2.2), (6.4, 2.6), (4, 1.6), (1.6, 2.6), (0, 2.2)], ouro)
    fr.linha([(0, 2.2), (1.6, 2.6), (4, 1.6), (6.4, 2.6), (8, 2.2)], ouro2, 1)
    for f in ("east", "west"):
        t.cabeca[f].ret(0, 0, 8, 2.5, ouro)
    for lado in (-1, 1):
        x = -4.6 if lado < 0 else 3.6
        h1 = t.extra("capacete", Cubo("head", [x, 32, -3.5], [1, 3, 1], 0, "chifre"))
        h2 = t.extra("capacete", Cubo("head", [x + lado * 0.8, 34.2, -3.0], [1, 3.5, 1], 0, "chifre"))
        h3 = t.extra("capacete", Cubo("head", [x + lado * 1.6, 37, -2.4], [0.8, 2.5, 0.8], 0, "chifre"))
        for h in (h1, h2, h3):
            h.todas(ouro)
            h["north"].linha([(0.2, 0), (0.2, h["north"].h)], clarear(ouro, 0.3), 1)
    co = t.corpo["north"]
    co.poli([(0, 0), (2.5, 0), (3.6, 12), (0, 12)], verde)
    co.poli([(8, 0), (5.5, 0), (4.4, 12), (8, 12)], verde)
    co.ret(2.5, 0, 5.5, 12, "#2a2a30")
    for y in (2, 4, 6, 8):
        co.ret(3.2, y, 4.8, y + 0.5, ouro)
    for f in lados(t.corpo):
        f.ret(0, 0, f.w, 1.5, ouro)
    for f in lados(t.braco):
        f.ret(0, 0, f.w, 2, ouro)
        costuras(f, verde2, 1.5)
    luvas(t, preto, 9)
    c = capa(t, verde, verde2, y0=2)
    c["north"].preencher("#2a1a3a")


def ultron(t):
    prata, prata2, verm = "#b8bec8", "#7a808a", "#ff2a1a"
    pintar_tudo(t, prata, prata, prata, prata2, prata, prata2)
    for cubo in (t.cabeca, t.corpo, t.braco, t.perna, t.bota):
        for f in cubo.faces.values():
            costuras(f, prata2, 2.0)
            costuras(f, prata2, 3.0, vertical=False)
    fr = t.cabeca["north"]
    fr.preencher(prata)
    fr.poli([(0.6, 2.6), (3.4, 3.4), (3.2, 4.6), (0.8, 4.0)], "#2a2a30")
    fr.poli([(7.4, 2.6), (4.6, 3.4), (4.8, 4.6), (7.2, 4.0)], "#2a2a30")
    fr.ret(1.6, 5.6, 6.4, 7.0, "#2a2a30")
    for x in range(8):
        fr.ret(1.8 + x * 0.6, 5.6, 2.0 + x * 0.6, 7.0, prata2)
    fr.acender(lambda f: (f.poli([(1.0, 2.9), (3.1, 3.5), (3.0, 4.3), (1.1, 3.8)], verm),
                          f.poli([(7.0, 2.9), (4.9, 3.5), (5.0, 4.3), (6.9, 3.8)], verm),
                          f.ret(2.0, 6.0, 6.0, 6.6, verm)))
    co = t.corpo["north"]
    musculos_peito(co, prata2, clarear(prata, 0.2))
    co.acender(lambda f: f.elipse(4, 3.5, 1.0, 1.0, verm))
    for x0 in (-4.8, 4.0):
        a = t.extra("capacete", Cubo("head", [x0, 28, -2], [0.8, 5, 3], 0, "antena"))
        a.todas(prata2)


def caveira_vermelha(t):
    verde, verde2, preto, verm = "#3a4a2a", "#26321a", "#1b1b1f", "#c01818"
    pintar_tudo(t, verm, verde, verde, preto, verde, preto)
    fr = t.cabeca["north"]
    fr.preencher(verm)
    fr.elipse(2.5, 3.7, 1.3, 1.2, "#2a0606")
    fr.elipse(5.5, 3.7, 1.3, 1.2, "#2a0606")
    fr.elipse(2.5, 3.7, 0.3, 0.3, "#ffd84a")
    fr.elipse(5.5, 3.7, 0.3, 0.3, "#ffd84a")
    fr.poli([(3.6, 4.6), (4.4, 4.6), (4, 5.6)], "#2a0606")
    fr.ret(2.0, 6.2, 6.0, 7.4, "#f2e8d0")
    for x in range(1, 7):
        fr.linha([(2.0 + x * 0.57, 6.2), (2.0 + x * 0.57, 7.4)], "#2a0606", 1)
    fr.linha([(0.5, 1.0), (2, 2.4)], clarear(verm, -0.3), 1)
    fr.linha([(7.5, 1.0), (6, 2.4)], clarear(verm, -0.3), 1)
    for f in ("east", "west", "south", "up"):
        t.cabeca[f].preencher(clarear(verm, -0.1))
    co = t.corpo["north"]
    co.ret(3.4, 0, 4.6, 12, verde2)
    for y in (2, 5, 8):
        co.ret(3.6, y, 4.4, y + 0.6, "#c9a227")
    co.elipse(1.8, 2.0, 0.9, 0.9, "#c01818", "#101010", 1)
    cinto(t, preto, "#8a8f99", 10.0)
    luvas(t, preto, 8.5)
    botas(t, preto)
    for f in lados(t.braco):
        f.ret(0, 2.0, f.w, 3.4, verm)
        f.ret(0.8, 2.3, f.w - 0.8, 3.1, preto)


def duende_verde(t):
    verde, verde2, roxo, roxo2 = "#3e8a2a", "#285a1a", "#5a2d86", "#3d1d5e"
    pintar_tudo(t, verde, verde, verde, roxo, verde, roxo)
    for cubo in (t.corpo, t.braco, t.perna):
        for f in lados(cubo):
            escamas(f, verde2, 0.9)
    fr = t.cabeca["north"]
    fr.preencher(verde)
    fr.poli([(0.6, 2.4), (3.6, 3.2), (3.2, 4.6), (0.8, 4.0)], "#ffe14a", "#101010")
    fr.poli([(7.4, 2.4), (4.4, 3.2), (4.8, 4.6), (7.2, 4.0)], "#ffe14a", "#101010")
    fr.poli([(3.6, 4.0), (4.4, 4.0), (4.7, 5.6), (3.3, 5.6)], verde2)
    fr.poli([(1.6, 6.0), (6.4, 6.0), (5.4, 7.4), (2.6, 7.4)], "#1a1a10")
    for x in (2.4, 3.4, 4.6, 5.6):
        fr.poli([(x, 6.0), (x + 0.6, 6.0), (x + 0.3, 6.8)], "#f0f0e0")
    for f in ("east", "west"):
        t.cabeca[f].poli([(2, 3), (6, 3), (4, 0)], verde2)
    chapeu = t.extra("capacete", Cubo("head", [-5, 32.5, -5], [10, 0.6, 10], 0, "aba"))
    chapeu.todas(roxo2)
    top = t.extra("capacete", Cubo("head", [-3, 33.1, -3], [6, 4, 6], 0, "chapeu"))
    top.todas(roxo)
    for lado in (-1, 1):
        o = t.extra("capacete", Cubo("head", [-5.2 if lado < 0 else 4.2, 28, -0.5], [1, 3, 1], 0, "orelha"))
        o.todas(verde)
    co = t.corpo["north"]
    co.ret(0, 0, 8, 12, roxo)
    co.poli([(0, 0), (3, 0), (4, 4), (5, 0), (8, 0), (8, 2), (4, 6), (0, 2)], roxo2)
    cinto(t, roxo2, "#c9a227", 10.0)
    for f in lados(t.braco):
        f.ret(0, 0, f.w, 5, roxo)
    luvas(t, roxo, 9)
    bolsa = t.extra("peitoral", Cubo("body", [-4.6, 9.5, -1], [1.2, 2.5, 2], 0, "bolsa"))
    bolsa.todas("#5a3a22")


def doutor_octopus(t):
    verde, verde2, metal, metal2 = "#3e5a2a", "#26381a", "#8a909a", "#4a4f58"
    pintar_tudo(t, "#3a2a1c", verde, verde, verde2, "#2a2a30", "#3a2a1c")
    cabelo_todo(t, "#3a2a1c")
    fr = t.cabeca["north"]
    rosto_humano(fr, PELE, "#3a2a1c", olhos="#6a4a2a")
    fr.ret(1.4, 3.0, 3.8, 4.4, "#2a2a30")
    fr.ret(4.2, 3.0, 6.6, 4.4, "#2a2a30")
    fr.ret(3.8, 3.5, 4.2, 3.8, "#2a2a30")
    fr.ret(1.7, 3.3, 3.5, 4.1, "#4a8ac8")
    fr.ret(4.5, 3.3, 6.3, 4.1, "#4a8ac8")
    co = t.corpo["north"]
    co.poli([(0, 0), (3, 0), (3.6, 12), (0, 12)], verde2)
    co.poli([(8, 0), (5, 0), (4.4, 12), (8, 12)], verde2)
    co.ret(3, 0, 5, 12, "#e8e0c8")
    cinto(t, metal2, metal, 9.5)
    luvas(t, "#2a2a30", 10)
    for k, (dx, dy) in enumerate(((-1, 1), (1, 1), (-1, -1), (1, -1))):
        x0 = -2 + dx * 1.5
        base_y = 18 + dy * 3
        for s in range(5):
            seg = t.extra("peitoral", Cubo("body", [x0 + dx * (2.2 * s + 1.5), base_y - dy * 0.0 + (s * 1.2 if dy > 0 else -s * 2.2),
                                                    3.2 + s * 0.4], [2, 2, 2], 0, "tentaculo"))
            seg.todas(metal)
            for f in seg.faces.values():
                f.ret(0, 0, f.w, 0.4, metal2)
        garra = t.extra("peitoral", Cubo("body", [x0 + dx * 12.5, base_y + (6 if dy > 0 else -11), 5.2], [2.4, 2.4, 2.4], 0, "garra"))
        garra.todas(metal2)
        garra["north"].acender(lambda f: f.elipse(1.2, 1.2, 0.5, 0.5, "#ff3a2a"))
        garra["south"].acender(lambda f: f.elipse(1.2, 1.2, 0.5, 0.5, "#ff3a2a"))


def venom(t):
    preto, preto2, branco = "#121216", "#26262e", "#f4f4f4"
    pintar_tudo(t, preto, preto, preto, preto, preto, preto)
    for cubo in (t.cabeca, t.corpo, t.braco, t.perna, t.bota):
        for k, f in enumerate(cubo.faces.values()):
            gavinhas(f, preto2, k * 7 + id(cubo) % 5, 6, 1)
    fr = t.cabeca["north"]
    fr.poli([(0.4, 1.2), (3.6, 3.2), (3.0, 4.8), (0.6, 3.8)], branco)
    fr.poli([(7.6, 1.2), (4.4, 3.2), (5.0, 4.8), (7.4, 3.8)], branco)
    fr.poli([(0.6, 5.0), (7.4, 5.0), (6.6, 7.8), (1.4, 7.8)], "#5a0a14")
    for x in range(8):
        fr.poli([(0.8 + x * 0.82, 5.0), (1.5 + x * 0.82, 5.0), (1.15 + x * 0.82, 6.0)], branco)
        fr.poli([(1.2 + x * 0.72, 7.8), (1.8 + x * 0.72, 7.8), (1.5 + x * 0.72, 6.9)], branco)
    lingua = t.extra("capacete", Cubo("head", [-0.7, 23.0, -5.6], [1.4, 0.4, 2.0], 0, "lingua"))
    lingua.todas("#d0405a")
    co = t.corpo["north"]
    co.poli([(4, 1.5), (1, 0), (0.4, 1.6), (3.0, 4.0), (1.8, 7.5), (3.4, 6.4), (4, 9.5), (4.6, 6.4), (6.2, 7.5),
             (5.0, 4.0), (7.6, 1.6), (7.0, 0)], branco)
    musculos_peito(co, preto2)
    s = t.corpo["south"]
    s.poli([(4, 1.0), (1, 0), (0.4, 1.6), (3.0, 4.0), (2.5, 9), (4, 6), (5.5, 9), (5.0, 4.0), (7.6, 1.6), (7, 0)], branco)


def electro(t):
    verde, verde2, amar = "#2f8a3a", "#1d5a26", "#f2e23a"
    pintar_tudo(t, verde, verde, verde, verde, verde, amar)
    fr = t.cabeca["north"]
    fr.preencher(verde)
    fr.ret(1.0, 4.8, 7.0, 8, PELE)
    fr.ret(3.0, 6.6, 5.0, 6.9, "#a0584a")
    fr.poli([(4, 0), (5.2, 2.5), (8, 1.5), (6.4, 4.0), (8, 5.0), (4, 4.6), (0, 5.0), (1.6, 4.0), (0, 1.5), (2.8, 2.5)],
            amar, "#a47a1f")
    fr.ret(2.0, 3.0, 3.4, 3.7, "#ffffff")
    fr.ret(4.6, 3.0, 6.0, 3.7, "#ffffff")
    for lado in (-1, 1):
        for k in range(3):
            p = t.extra("capacete", Cubo("head", [(-6 - k * 1.2) if lado < 0 else (4 + k * 1.2), 29 + k * 1.3, -4.4], [1.2, 1.0, 0.6], 0, "raio"))
            p.todas(amar)
    co = t.corpo["north"]
    for f in lados(t.corpo):
        raio_simbolo(f, f.w / 2, 5.5, 3.6, amar, "#a47a1f")
    for f in lados(t.braco):
        f.linha([(0, 2), (f.w, 4), (0, 7), (f.w, 9)], amar, 2)
    for f in lados(t.perna):
        f.linha([(0, 1), (f.w, 4), (0, 8)], amar, 2)
    t.braco["down"].acender(lambda f: f.elipse(2, 2, 1.6, 1.6, "#bff4ff"))
    luvas(t, amar, 10)


def mysterio(t):
    verde, verde2, roxo, roxo2 = "#2f6a3a", "#1d4a26", "#6a3a8a", "#4a2462"
    pintar_tudo(t, "#c8e4ff", verde, verde, verde2, verde, verde2)
    fr = t.cabeca["north"]
    fr.preencher((180, 220, 255, 110))
    for f in ("east", "west", "south", "up"):
        t.cabeca[f].preencher((180, 220, 255, 110))
    fr.acender(lambda f: f.elipse(4, 4, 2.6, 2.6, (160, 230, 255, 200)))
    fr.linha([(1.0, 1.0), (2.4, 0.6)], "#ffffff", 1)
    nev = t.extra("capacete", Cubo("head", [-2.5, 25.5, -2.5], [5, 5, 5], 0, "nevoa"))
    nev.todas("#c8f0e0")
    for f in nev.faces.values():
        gavinhas(f, "#88d0b0", 3, 4, 2)
    co = t.corpo["north"]
    for y in range(0, 12, 2):
        co.ret(0, y, 8, y + 0.5, verde2)
    co.elipse(4, 1.0, 3.2, 1.0, "#c9a227")
    for x in range(1, 8):
        co.ret(x - 0.2, 0.5, x + 0.2, 1.4, "#c9a227")
    cinto(t, "#c9a227", "#1d4a26", 10.0)
    luvas(t, verde2, 8.5)
    c = capa(t, roxo, roxo2, y0=2, gola="#c9a227")
    c["north"].preencher("#1d1d22")


def abutre(t):
    verde, verde2, cinza = "#3e5a3a", "#283a26", "#8a909a"
    pintar_tudo(t, PELE, verde, verde, verde2, verde, "#3a2a1c")
    fr = t.cabeca["north"]
    rosto_humano(fr, "#d8b098", "#d8b098", olhos="#4a4a3a")
    fr.ret(0, 0, 8, 1.4, "#c8a890")
    fr.ret(1.2, 3.0, 3.8, 4.4, "#2a2a30")
    fr.ret(4.2, 3.0, 6.8, 4.4, "#2a2a30")
    fr.acender(lambda f: (f.ret(1.5, 3.3, 3.5, 4.1, "#3dff6a"), f.ret(4.5, 3.3, 6.5, 4.1, "#3dff6a")))
    for f in ("east", "west", "south", "up"):
        t.cabeca[f].preencher("#c8a890")
    gola = t.extra("peitoral", Cubo("body", [-4.8, 22, -2.8], [9.6, 2.5, 5.6], 0, "gola"))
    gola.todas("#e8e0d0")
    for f in gola.faces.values():
        for x in range(0, int(f.w * 2)):
            f.linha([(x / 2, 0), (x / 2 + 0.2, f.h)], "#c0b8a8", 1)
    for lado in (-1, 1):
        x0 = 0.6 if lado > 0 else -14.6
        asa = t.extra("peitoral", Cubo("body", [x0, 8, 3.4], [14, 15, 0.4], 0, "asa"))
        asa.todas(cinza)
        for f in (asa["south"], asa["north"]):
            for k in range(10):
                x = k * 1.4 if lado < 0 else f.w - k * 1.4
                f.poli([(x, 0), (x + (1.2 if lado < 0 else -1.2), 0), (x + 0.6 * (1 if lado < 0 else -1), f.h - k * 1.0)],
                       "#b8bec8", "#4a4f58")
    luvas(t, verde2, 9)


def doutor_destino(t):
    metal, metal2, verde, verde2 = "#8a909a", "#4a4f58", "#2f6a2a", "#1d4a1a"
    pintar_tudo(t, verde, verde, metal, metal2, metal, metal)
    fr = t.cabeca["north"]
    fr.preencher(metal)
    fr.ret(0, 0, 8, 1.2, verde)
    fr.ret(0, 0, 0.8, 8, verde)
    fr.ret(7.2, 0, 8, 8, verde)
    fr.poli([(1.4, 3.0), (3.4, 3.2), (3.4, 4.0), (1.4, 3.8)], "#101010")
    fr.poli([(6.6, 3.0), (4.6, 3.2), (4.6, 4.0), (6.6, 3.8)], "#101010")
    fr.ret(3.6, 2.0, 4.4, 5.6, clarear(metal, 0.2))
    fr.ret(2.4, 6.0, 5.6, 6.3, "#101010")
    for x in (2.8, 3.6, 4.4, 5.2):
        fr.ret(x, 6.3, x + 0.3, 7.6, metal2)
    for k in range(8):
        fr.pixel(1.2 + k * 0.8, 1.4, clarear(metal, 0.3))
    for f in ("east", "west", "south", "up"):
        t.cabeca[f].preencher(verde)
        costuras(t.cabeca[f], verde2, 1.5)
    co = t.corpo["north"]
    co.preencher(verde)
    co.poli([(0, 0), (8, 0), (8, 3.5), (0, 3.5)], metal)
    placas(co, verde, verde2, 2.5)
    co.ret(0, 0, 8, 3.5, metal)
    cinto(t, "#5a3a22", "#c9a227", 9.5)
    co.ret(0, 10.7, 8, 12, verde)
    for f in lados(t.braco):
        placas(f, metal, metal2, 1.5)
    capa(t, verde, verde2, y0=0, gola=verde)


def hela(t):
    preto, verde, verde2, cinza = "#141418", "#2f8a3a", "#1d5a26", "#3a3a40"
    pintar_tudo(t, preto, preto, preto, preto, preto, preto)
    fr = t.cabeca["north"]
    fr.preencher(preto)
    fr.ret(1.0, 1.8, 7.0, 8, "#e4dcd8")
    olho(fr, 2.6, 3.8, "#3e8a5a", 1)
    olho(fr, 5.4, 3.8, "#3e8a5a", -1)
    fr.poli([(1.6, 3.2), (3.4, 3.4), (3.2, 3.6), (1.4, 3.6)], "#101010")
    fr.poli([(6.4, 3.2), (4.6, 3.4), (4.8, 3.6), (6.6, 3.6)], "#101010")
    fr.ret(3.0, 6.2, 5.0, 6.6, "#2a2a2a")
    fr.poli([(1.0, 1.8), (4, 3.0), (7.0, 1.8)], preto)
    for k in range(7):
        x = -4.4 + k * 1.4
        alt = 4 + abs(3 - k) * 2.0
        ch = t.extra("capacete", Cubo("head", [x, 31.5, -3.8 + abs(3 - k) * 0.8], [0.6, alt, 0.6], 0, "chifre"))
        ch.todas(cinza)
        ch["north"].acender(lambda f: f.linha([(0.3, 0), (0.3, f.h)], verde, 1))
    co = t.corpo["north"]
    for f in lados(t.corpo):
        for k in range(5):
            f.linha([(0, 1 + k * 2.2), (4, 2.2 + k * 2.2), (8, 1 + k * 2.2)], verde2, 1)
    co.poli([(2.4, 0), (5.6, 0), (4, 3.4)], "#d8d0cc")
    for f in lados(t.braco):
        costuras(f, verde2, 2.0, vertical=False)
    c = capa(t, preto, "#24242a", y0=1)
    c["north"].preencher(verde2)


def kang(t):
    verde, roxo, roxo2, azul = "#2f8a3a", "#5a2d86", "#3d1d5e", "#3db8ff"
    pintar_tudo(t, roxo, verde, roxo, roxo2, verde, roxo)
    fr = t.cabeca["north"]
    fr.preencher(roxo)
    fr.ret(1.0, 1.8, 7.0, 7.4, azul)
    fr.ret(1.6, 3.0, 3.4, 3.8, "#101010")
    fr.ret(4.6, 3.0, 6.4, 3.8, "#101010")
    fr.acender(lambda f: (f.ret(1.8, 3.15, 3.2, 3.65, "#ffffff"), f.ret(4.8, 3.15, 6.2, 3.65, "#ffffff")))
    fr.ret(3.0, 6.0, 5.0, 6.3, "#1a5a8a")
    for lado in (-1, 1):
        o = t.extra("capacete", Cubo("head", [-6.0 if lado < 0 else 4.4, 27, -1.5], [1.6, 3, 3], 0, "orelha"))
        o.todas(roxo2)
        o.faces["west" if lado < 0 else "east"].acender(lambda f: f.elipse(1.5, 1.5, 0.8, 0.8, azul))
    co = t.corpo["north"]
    co.preencher(verde)
    co.poli([(0, 0), (8, 0), (8, 3), (4, 5), (0, 3)], roxo)
    co.acender(lambda f: f.elipse(4, 7.5, 1.4, 1.4, azul))
    cinto(t, roxo2, None, 10.0)
    luvas(t, roxo2, 7.5)
    botas(t, roxo2)
    c = capa(t, roxo2, roxo, y0=2, gola=roxo)


def killmonger(t):
    preto, ouro, ouro2 = "#141418", "#d4a72c", "#9a7414"
    pintar_tudo(t, preto, preto, preto, preto, preto, preto)
    fr = t.cabeca["north"]
    fr.preencher(ouro)
    fr.poli([(1.0, 2.6), (3.6, 3.4), (3.2, 4.2), (1.2, 3.8)], "#e8c860")
    fr.poli([(7.0, 2.6), (4.4, 3.4), (4.8, 4.2), (6.8, 3.8)], "#e8c860")
    fr.linha([(4, 0.5), (4, 5.0)], ouro2, 1)
    fr.linha([(1.5, 6.5), (4, 7.4), (6.5, 6.5)], ouro2, 1)
    for f in ("east", "west", "south", "up"):
        t.cabeca[f].preencher(ouro)
        costuras(t.cabeca[f], ouro2, 1.0, vertical=False)
    for lado in (-1, 1):
        o = t.extra("capacete", Cubo("head", [-3.6 if lado < 0 else 2.2, 32.8, -2], [1.4, 1.2, 1.2], 0, "orelha"))
        o.todas(ouro)
    for cubo in (t.corpo, t.braco, t.perna, t.bota):
        for f in cubo.faces.values():
            for k in range(0, int(f.w)):
                f.poli([(k, 0), (k + 0.5, 0.6), (k + 1, 0)], "#22222a")
            costuras(f, "#22222a", 1.0, vertical=False)
    co = t.corpo["north"]
    for k in range(9):
        x = 0.8 + k * 0.8
        co.poli([(x, 0.4), (x + 0.5, 0.4), (x + 0.25, 1.6 + 0.4 * (4 - abs(k - 4)))], ouro)
    co.acender(lambda f: (f.linha([(0.5, 4), (4, 7), (7.5, 4)], ouro, 1), f.linha([(1.5, 9), (4, 11), (6.5, 9)], ouro, 1)))
    for f in lados(t.braco):
        f.acender(lambda ff: ff.linha([(0.3, 9), (ff.w / 2, 10), (ff.w - 0.3, 9)], ouro, 1))
    for f in lados(t.perna):
        f.acender(lambda ff: ff.linha([(0.3, 4), (ff.w / 2, 5.2), (ff.w - 0.3, 4)], ouro, 1))


def ronan(t):
    azul, preto, preto2 = "#2a4a9a", "#1b1b20", "#2c2c34"
    pintar_tudo(t, preto, preto, preto, preto2, preto, preto)
    fr = t.cabeca["north"]
    fr.preencher(azul)
    fr.ret(0, 0, 8, 1.4, preto)
    fr.poli([(1.4, 2.0), (3.4, 2.8), (3.2, 3.2), (1.2, 2.6)], preto)
    fr.poli([(6.6, 2.0), (4.6, 2.8), (4.8, 3.2), (6.8, 2.6)], preto)
    olho(fr, 2.5, 3.8, "#101010", 1)
    olho(fr, 5.5, 3.8, "#101010", -1)
    fr.linha([(4, 1.4), (4, 5.4)], preto, 1)
    fr.ret(2.0, 5.2, 6.0, 8, preto)
    fr.ret(3.0, 6.0, 5.0, 6.3, "#5a1a20")
    for f in ("east", "west", "south", "up"):
        t.cabeca[f].preencher(preto)
    cap = t.extra("capacete", Cubo("head", [-4.6, 24, 2.2], [9.2, 9.0, 2.6], 0, "capuz"))
    cap.todas(preto)
    for cubo in (t.corpo, t.braco, t.perna):
        for f in lados(cubo):
            costuras(f, preto2, 1.0)
    co = t.corpo["north"]
    co.poli([(0, 0), (8, 0), (4, 5)], preto2)
    co.ret(3.4, 3, 4.6, 12, "#3a3a44")
    cinto(t, "#3a3a44", "#8a909a", 9.6)
    c = capa(t, preto, preto2, y0=1)


def galactus(t):
    roxo, roxo2, azul, azul2 = "#6a2d96", "#45186a", "#3a5ac0", "#24387a"
    pintar_tudo(t, roxo, azul, roxo, roxo2, azul, roxo)
    fr = t.cabeca["north"]
    fr.preencher(roxo)
    fr.ret(1.6, 2.4, 6.4, 8, "#c8b0a0")
    olho(fr, 2.9, 3.9, "#1a1a1a", 1)
    olho(fr, 5.1, 3.9, "#1a1a1a", -1)
    fr.ret(2.0, 3.1, 3.8, 3.35, "#3a2a2a")
    fr.ret(4.2, 3.1, 6.0, 3.35, "#3a2a2a")
    fr.ret(3.0, 6.4, 5.0, 6.7, "#7a4a4a")
    fr.poli([(3.0, 0), (5.0, 0), (5.0, 2.4), (4, 3.2), (3.0, 2.4)], azul)
    fr.acender(lambda f: f.poli([(3.6, 0.6), (4.4, 0.6), (4.4, 1.8), (4, 2.3), (3.6, 1.8)], "#ffd84a"))
    for lado in (-1, 1):
        p = t.extra("capacete", Cubo("head", [-7.5 if lado < 0 else 5.0, 26, -1.5], [2.5, 7, 3], 0, "chifre"))
        p.todas(roxo)
        p2 = t.extra("capacete", Cubo("head", [-8.5 if lado < 0 else 7.0, 32, -1.0], [1.5, 6, 2], 0, "chifre"))
        p2.todas(roxo2)
    co = t.corpo["north"]
    co.preencher(azul)
    co.poli([(0, 0), (8, 0), (8, 4), (5.5, 7), (2.5, 7), (0, 4)], roxo)
    co.elipse(4, 3.0, 1.6, 1.6, "#c8141c", "#3a0a0a", 2)
    co.acender(lambda f: f.poli([(4, 1.8), (5.1, 3.0), (4, 4.2), (2.9, 3.0)], "#ffd84a"))
    for f in lados(t.corpo):
        musculos_peito(f, azul2) if f is co else None
    cinto(t, roxo2, "#c9a227", 10.0)
    luvas(t, roxo, 7.5)
    for f in lados(t.perna):
        f.ret(0, 6, f.w, 12, azul)
        f.linha([(0, 6), (f.w, 6)], roxo2, 2)


def carnificina(t):
    verm, verm2, preto = "#c8141c", "#6a0a12", "#141418"
    pintar_tudo(t, verm, verm, verm, verm, verm, verm)
    for cubo in (t.cabeca, t.corpo, t.braco, t.perna, t.bota):
        for k, f in enumerate(cubo.faces.values()):
            gavinhas(f, preto, k * 13 + 1, 7, 1)
            gavinhas(f, verm2, k * 13 + 2, 5, 2)
    fr = t.cabeca["north"]
    fr.poli([(0.4, 1.2), (3.6, 3.0), (3.0, 4.6), (0.6, 3.6)], "#ffffff", preto)
    fr.poli([(7.6, 1.2), (4.4, 3.0), (5.0, 4.6), (7.4, 3.6)], "#ffffff", preto)
    fr.poli([(1.0, 5.2), (7.0, 5.2), (6.2, 7.8), (1.8, 7.8)], "#2a0006")
    for x in range(7):
        fr.poli([(1.2 + x * 0.82, 5.2), (1.8 + x * 0.82, 5.2), (1.5 + x * 0.82, 6.2)], "#ffffff")
    for k in range(5):
        g = t.extra("peitoral", Cubo("body", [-4 + k * 1.8, 14 + (k % 3) * 3, 3.2], [0.6, 0.6, 2.5 + k % 2], 0, "tentaculo"))
        g.todas(verm2)
    for lado in (-1, 1):
        lam = t.extra("peitoral", Cubo("rightArm" if lado < 0 else "leftArm",
                                        [-7.4 if lado < 0 else 4.6, 5.5, -1.2], [2.8, 6.5, 0.4], 0, "lamina"))
        lam.todas(verm2)
        lam["north"].linha([(0.2, 6.5), (1.4, 0)], "#ff4a4a", 1)


def kraven(t):
    pele, juba, juba2, couro = "#c49070", "#c8862a", "#8a5414", "#6a4a2a"
    pintar_tudo(t, "#3a2a1c", pele, pele, couro, couro, couro)
    cabelo_todo(t, "#3a2a1c")
    fr = t.cabeca["north"]
    rosto_humano(fr, pele, "#3a2a1c", olhos="#4a3a2a", barba="#3a2a1c")
    co = t.corpo["north"]
    musculos_peito(co, clarear(pele, -0.15))
    cinto(t, "#3a2a1c", "#c9a227", 10.2)
    for f in lados(t.perna):
        for y in range(0, 12, 2):
            f.linha([(0, y), (f.w, y + 0.6)], clarear(couro, -0.2), 1)
    colete = t.extra("peitoral", Cubo("body", [-5.5, 13.0, -3.3], [11, 12.2, 6.6], 0, "colete"))
    colete.todas(juba)
    for f in colete.faces.values():
        for x in range(0, int(f.w * 3)):
            f.linha([(x / 3, 0), (x / 3 + 0.3, f.h)], juba2 if x % 2 else clarear(juba, 0.15), 1)
    colete["north"].ret(2.6, 0, 8.4, 12.2, (0, 0, 0, 0))
    colete["north"].poli([(2.6, 0), (8.4, 0), (7.4, 2.2), (3.6, 2.2)], juba2)
    for lado in (-1, 1):
        dente = t.extra("peitoral", Cubo("body", [-2.6 if lado < 0 else 2.0, 21.5, -3.9], [0.6, 1.4, 0.6], 0, "dente"))
        dente.todas("#f0e8d0")
    lanca = t.extra("peitoral", Cubo("rightArm", [-6.4, 11, -10], [0.6, 0.6, 18], 0, "lanca"))
    lanca.todas("#6a4a2a")
    ponta = t.extra("peitoral", Cubo("rightArm", [-6.6, 10.8, -12.2], [1.0, 1.0, 2.2], 0, "ponta"))
    ponta.todas("#c8ccd4")
    botas(t, couro)


def abominavel(t):
    verde, verde2, verde3 = "#5a7a3a", "#3a5226", "#7a9a4a"
    pintar_tudo(t, verde, verde, verde, "#4a3a2a", verde, verde2)
    for cubo in (t.cabeca, t.corpo, t.braco, t.perna, t.bota):
        for f in cubo.faces.values():
            escamas(f, verde2, 1.1)
    fr = t.cabeca["north"]
    fr.preencher(verde)
    fr.ret(1.0, 3.2, 3.4, 4.0, "#ffe14a")
    fr.ret(4.6, 3.2, 7.0, 4.0, "#ffe14a")
    fr.ret(1.0, 2.6, 7.0, 3.1, verde2)
    fr.poli([(3.4, 4.0), (4.6, 4.0), (5.0, 5.2), (3.0, 5.2)], verde2)
    fr.ret(1.4, 5.8, 6.6, 7.4, "#1a1a10")
    for x in range(6):
        fr.poli([(1.6 + x * 0.85, 5.8), (2.2 + x * 0.85, 5.8), (1.9 + x * 0.85, 6.6)], "#f0f0d0")
    for lado in (-1, 1):
        o = t.extra("capacete", Cubo("head", [-5.6 if lado < 0 else 4.4, 27, -0.5], [1.2, 3.5, 2.5], 0, "orelha"))
        o.todas(verde2)
    for k in range(6):
        e = t.extra("peitoral", Cubo("body", [-0.5, 13 + k * 2, 3.0], [1.0, 1.4, 1.2 + (k % 2) * 0.6], 0, "espinho"))
        e.todas(verde3)
    musculos_peito(t.corpo["north"], verde2, verde3)
    for f in lados(t.cintura):
        f.preencher("#4a3a2a")
    for f in lados(t.perna):
        f.ret(0, 0, f.w, 4, "#4a3a2a")
        f.linha([(0, 4), (1, 4.6), (2, 4), (3, 4.6), (4, 4)], "#2a1a0a", 1)


def flash_reverso(t):
    amar, amar2, verm, preto = "#f2c418", "#a47a1f", "#c8141c", "#1b1b1f"
    pintar_tudo(t, amar, amar, amar, amar, amar, verm)
    fr = t.cabeca["north"]
    fr.preencher(amar)
    fr.ret(1.0, 4.4, 7.0, 8, PELE)
    fr.ret(3.0, 6.6, 5.0, 6.9, "#a0584a")
    fr.poli([(1.3, 2.8), (3.4, 3.2), (3.2, 3.9), (1.4, 3.6)], verm)
    fr.poli([(6.7, 2.8), (4.6, 3.2), (4.8, 3.9), (6.6, 3.6)], verm)
    fr.acender(lambda f: (f.poli([(1.6, 3.0), (3.2, 3.3), (3.1, 3.7), (1.7, 3.5)], "#ff3030"),
                          f.poli([(6.4, 3.0), (4.8, 3.3), (4.9, 3.7), (6.3, 3.5)], "#ff3030")))
    for f in ("east", "west"):
        raio_simbolo(t.cabeca[f], 4, 3.5, 1.8, verm, preto)
    for x0 in (-4.8, 4.0):
        a = t.extra("capacete", Cubo("head", [x0, 27.5, -1], [0.8, 3, 2.2], 0, "raio"))
        a.todas(verm)
    co = t.corpo["north"]
    co.elipse(4, 3.6, 2.3, 2.3, preto, verm, 2)
    raio_simbolo(co, 4, 3.6, 1.6, verm, preto)
    cinto(t, verm, None, 9.8)
    for f in lados(t.braco):
        f.linha([(0, 9), (f.w, 10)], verm, 2)
    botas(t, verm, amar2)


VILOES_HD = {
    "thanos": (thanos, 1.25), "loki": (loki, 1.0), "ultron": (ultron, 1.1), "caveira_vermelha": (caveira_vermelha, 1.0),
    "duende_verde": (duende_verde, 1.0), "doutor_octopus": (doutor_octopus, 1.0), "venom": (venom, 1.35),
    "electro": (electro, 1.0), "mysterio": (mysterio, 1.0), "abutre": (abutre, 1.0),
    "doutor_destino": (doutor_destino, 1.05), "hela": (hela, 1.0), "kang": (kang, 1.0), "killmonger": (killmonger, 1.0),
    "ronan": (ronan, 1.1), "galactus": (galactus, 1.1), "carnificina": (carnificina, 1.1), "kraven": (kraven, 1.05),
    "abominavel": (abominavel, 1.6), "flash_reverso": (flash_reverso, 1.0),
}


def montar(vid):
    f, vol = VILOES_HD[vid]
    t = Traje(vol)
    f(t)
    t.acabar()
    return t


def cubos_entidade(vid):
    """Todos os cubos do vilão (sem a cintura, que fica escondida dentro do corpo)."""
    t = montar(vid)
    p = t.pecas()
    return [c for c in sum(p.values(), []) if c.nome != "cintura"]
