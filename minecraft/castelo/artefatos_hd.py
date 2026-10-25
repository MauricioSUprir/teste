"""Artefatos em 3D (cubos com textura 4x). Servem para os ícones detalhados e para a prévia."""
import math

from PIL import Image

import modelos3d as m3
from modelos3d import Cubo, clarear, acabamento


class Modelo:
    def __init__(self):
        self.cubos = []

    def cubo(self, origem, tamanho, cor, nome="", contorno=None):
        c = Cubo("root", origem, tamanho, 0, nome)
        c.todas(cor)
        if contorno:
            for f in c.faces.values():
                m3_contorno(f, contorno)
        self.cubos.append(c)
        return c

    def brilhante(self, origem, tamanho, cor, nucleo=None):
        c = Cubo("root", origem, tamanho, 0, "brilho")
        for f in c.faces.values():
            f.acender(lambda ff: (ff.preencher(cor), nucleo and ff.ret(ff.w * 0.25, ff.h * 0.25, ff.w * 0.75, ff.h * 0.75, nucleo)))
        self.cubos.append(c)
        return c

    def esfera(self, centro, raio, cor, passos=5, nome="esfera", brilho=False):
        cx, cy, cz = centro
        out = []
        for k in range(passos):
            a = (k + 0.5) / passos * math.pi
            meia = raio * math.sin(a)
            y0 = cy + raio * math.cos(a + math.pi / passos / 2) if False else cy - raio + 2 * raio * k / passos
            c = Cubo("root", [cx - meia, y0, cz - meia], [2 * meia, 2 * raio / passos, 2 * meia], 0, nome)
            if brilho:
                for f in c.faces.values():
                    f.acender(lambda ff: ff.preencher(cor))
            else:
                c.todas(cor)
            self.cubos.append(c)
            out.append(c)
        return out

    def acabar(self):
        for i, c in enumerate(self.cubos):
            acabamento(c, 0.9, 0.05, i)


def m3_contorno(f, cor):
    f.d.rectangle([0, 0, f.img.width - 1, f.img.height - 1], outline=m3.rgba(cor), width=1)


GEMAS = {"espaco": "#3d7cff", "mente": "#ffe14a", "realidade": "#ff2a2a", "poder": "#b25cff",
         "tempo": "#3dff6a", "alma": "#ff9a1a"}


def manopla(m):
    ouro, ouro2 = "#e0b030", "#9a7414"
    pulso = m.cubo([-3.2, 0, -3.2], [6.4, 5, 6.4], ouro, "pulso")
    for f in m3.FACES[:4]:
        pulso[f].ret(0, 0, pulso[f].w, 0.6, ouro2)
        pulso[f].ret(0, 4.4, pulso[f].w, 5, ouro2)
        for x in range(1, 6):
            pulso[f].ret(x, 1.4, x + 0.3, 3.6, clarear(ouro, 0.2))
    mao = m.cubo([-3, 5, -2], [6, 5.5, 4], ouro, "mao")
    for f in ("north", "south"):
        mao[f].ret(0, 0, mao[f].w, 0.5, ouro2)
    for k in range(4):
        d = m.cubo([-2.9 + k * 1.5, 10.5, -1.6], [1.3, 3.6 - abs(k - 1.5) * 0.4, 1.5], ouro, "dedo")
        for f in ("north", "south", "east", "west"):
            d[f].ret(0, 1.2, d[f].w, 1.45, ouro2)
            d[f].ret(0, 2.5, d[f].w, 2.75, ouro2)
    pol = m.cubo([3, 6.5, -1.6], [1.6, 3.5, 1.5], ouro, "polegar")
    pol["north"].ret(0, 1.6, 1.6, 1.85, ouro2)
    cores = list(GEMAS.values())
    for k in range(4):
        m.brilhante([-2.6 + k * 1.5, 9.4, -2.5], [0.9, 0.9, 0.6], cores[k], "#ffffff")
    m.brilhante([-1.1, 6.4, -2.7], [2.2, 2.2, 0.8], cores[4], "#ffffff")
    m.brilhante([3.3, 8.2, -2.0], [0.9, 0.9, 0.6], cores[5], "#ffffff")
    mao["north"].ret(0.5, 0.8, 5.5, 4.8, ouro2)
    mao["north"].ret(0.8, 1.1, 5.2, 4.5, ouro)


def livro(m, capa, detalhe, simbolo, brilho):
    corpo = m.cubo([-4, 0, -1.4], [8, 10.5, 2.8], capa, "livro")
    for f in ("north", "south"):
        fc = corpo[f]
        fc.ret(0.4, 0.4, 7.6, 10.1, clarear(capa, -0.2))
        fc.ret(0.7, 0.7, 7.3, 9.8, capa)
        for (x, y) in ((0, 0), (6.8, 0), (0, 9.3), (6.8, 9.3)):
            fc.ret(x, y, x + 1.2, y + 1.2, detalhe)
        simbolo(fc)
        fc.acender(brilho)
    corpo["east"].preencher("#efe6cf")
    for y in range(1, 21):
        corpo["east"].linha([(0, y / 2), (2.8, y / 2)], "#d8ccb0", 1)
    corpo["up"].preencher("#efe6cf")
    corpo["west"].preencher(clarear(capa, -0.1))
    for y in (1.5, 3, 7.5, 9):
        corpo["west"].ret(0, y, 2.8, y + 0.5, detalhe)
    fecho = m.cubo([3.8, 4.4, -1.6], [0.8, 1.8, 3.2], detalhe, "fecho")


def darkhold(m):
    def simb(f):
        f.poli([(4, 2), (6, 5.2), (4, 8.5), (2, 5.2)], "#3a1414")
        f.linha([(4, 2), (4, 8.5)], "#5a2a2a", 1)
        f.linha([(2, 5.2), (6, 5.2)], "#5a2a2a", 1)
    livro(m, "#3a1f1a", "#6a6a70", simb,
          lambda f: (f.elipse(4, 5.2, 0.7, 0.7, "#ff2a2a"), f.linha([(2.6, 3.6), (5.4, 6.8)], "#ff3a3a", 1)))


def livro_vishanti(m):
    def simb(f):
        for k in range(12):
            a = k / 12 * 2 * math.pi
            f.linha([(4, 5.2), (4 + 2.6 * math.cos(a), 5.2 + 2.6 * math.sin(a))], "#d4a72c", 1)
    livro(m, "#e8e2d0", "#d4a72c", simb, lambda f: f.elipse(4, 5.2, 1.2, 1.2, "#ffe88a"))


def olho_agamotto(m):
    ouro, ouro2 = "#d4a72c", "#8a6a14"
    for k in range(9):
        a = math.pi * k / 8
        m.cubo([-0.4 - 3.4 * math.cos(a), 11.6 + 3.4 * math.sin(a), -0.3], [0.8, 0.8, 0.6], ouro2, "corrente")
    disco = m.cubo([-4, 3, -0.8], [8, 8, 1.6], ouro, "disco")
    for f in ("north", "south"):
        d = disco[f]
        d.preencher((0, 0, 0, 0))
        d.elipse(4, 4, 4, 4, ouro, ouro2, 2)
        d.elipse(4, 4, 3.2, 3.2, ouro2)
        d.poli([(0.8, 4), (2.4, 2.4), (5.6, 2.4), (7.2, 4), (5.6, 5.6), (2.4, 5.6)], ouro)
        d.acender(lambda ff: (ff.elipse(4, 4, 1.6, 1.6, "#2fdc4a"), ff.elipse(4, 4, 0.6, 0.6, "#c8ffd0")))
    for f in ("east", "west", "up", "down"):
        disco[f].preencher(ouro2)
    m.cubo([-1, 11, -0.6], [2, 1.4, 1.2], ouro, "argola")


def capa_levitacao(m):
    verm, verm2, ouro = "#b51d24", "#7a1016", "#d4a72c"
    c = m.cubo([-5, 0, 0], [10, 14, 0.6], verm, "capa")
    for f in ("north", "south"):
        for k in range(10):
            c[f].ret(0.4 + k, 0, 0.8 + k, 14, verm2)
        c[f].ret(0, 13.2, 10, 14, clarear(verm, 0.1))
    gola = m.cubo([-5.6, 13, -0.8], [11.2, 4.5, 0.8], verm, "gola")
    for f in ("north", "south"):
        for k in range(6):
            gola[f].linha([(1 + k * 1.9, 0), (1.5 + k * 1.9, 4.5)], verm2, 1)
    for lado in (-1, 1):
        g = m.cubo([lado * 2.6 - 0.8, 11.5, -1.0], [1.6, 1.6, 0.6], ouro, "fecho")
        g["north"].elipse(0.8, 0.8, 0.6, 0.6, "#f2d060", "#8a6a14")
    m.cubo([-1.8, 12, -0.9], [3.6, 0.3, 0.3], ouro, "corrente")


def mjolnir(m):
    cinza, cinza2 = "#9aa0aa", "#5c6270"
    cab = m.cubo([-4, 10, -2.5], [8, 5, 5], cinza, "cabeca")
    for f in ("north", "south", "up", "down"):
        k = cab[f]
        k.ret(0, 0, k.w, 0.5, cinza2)
        k.ret(0, k.h - 0.5, k.w, k.h, cinza2)
        k.elipse(k.w / 2, k.h / 2, 1.4, 1.4, None, cinza2, 1)
        for a in range(4):
            ang = a * math.pi / 2 + 0.6
            k.linha([(k.w / 2 + 1.4 * math.cos(ang), k.h / 2 + 1.4 * math.sin(ang)),
                     (k.w / 2 + 2.5 * math.cos(ang), k.h / 2 + 2.0 * math.sin(ang))], cinza2, 1)
    for f in ("east", "west"):
        cab[f].ret(0.5, 0.5, 4.5, 4.5, clarear(cinza, 0.1))
        cab[f].ret(0, 0, 5, 0.4, cinza2)
    cabo = m.cubo([-0.75, 0, -0.75], [1.5, 10, 1.5], "#6a4528", "cabo")
    for f in ("north", "south", "east", "west"):
        for y in range(0, 40, 3):
            cabo[f].linha([(0, y / 4), (1.5, y / 4 + 0.6)], "#3a2414", 1)
    m.cubo([-1, -0.8, -1], [2, 0.8, 2], cinza2, "pomo")
    m.cubo([-0.2, -3.8, -0.2], [0.4, 3, 0.4], "#4a2a18", "alca")


def rompe_tormentas(m):
    madeira, madeira2, metal, metal2 = "#8a6a44", "#5a4026", "#a8aeb8", "#5c6270"
    cabo = m.cubo([-0.7, -6, -0.7], [1.4, 22, 1.4], madeira, "cabo")
    for f in ("north", "south", "east", "west"):
        for y in range(0, 88, 5):
            cabo[f].linha([(0, y / 4), (1.4, y / 4 + 0.5)], madeira2, 1)
        cabo[f].ret(0, 0, 1.4, 4, "#4a3a2a")
    mar = m.cubo([-4.5, 11, -2], [4.5, 4, 4], metal, "martelo")
    for f in mar.faces.values():
        f.ret(0, 0, f.w, 0.4, metal2)
    lam = m.cubo([0.7, 9.5, -0.5], [5, 7, 1], metal, "lamina")
    for f in ("north", "south"):
        lam[f].poli([(0, 0), (5, 0), (5, 7), (0, 7)], metal)
        lam[f].ret(4.0, 0, 5, 7, "#d8dee8")
        lam[f].linha([(0.4, 3.5), (3.8, 3.5)], metal2, 1)
        lam[f].acender(lambda ff: ff.linha([(1, 1.5), (2, 3.5), (1.4, 5.5)], "#7fd6ff", 1))


def tesseract(m):
    m.brilhante([-3.5, 0, -3.5], [7, 7, 7], (90, 170, 255, 255), (200, 235, 255, 255))
    for (x, y, z, w, h, d) in ((-3.7, -0.2, -3.7, 7.4, 0.4, 0.4), (-3.7, 6.8, -3.7, 7.4, 0.4, 0.4),
                               (-3.7, -0.2, 3.3, 7.4, 0.4, 0.4), (-3.7, 6.8, 3.3, 7.4, 0.4, 0.4),
                               (-3.7, -0.2, -3.7, 0.4, 7.4, 0.4), (3.3, -0.2, -3.7, 0.4, 7.4, 0.4),
                               (-3.7, -0.2, 3.3, 0.4, 7.4, 0.4), (3.3, -0.2, 3.3, 0.4, 7.4, 0.4)):
        m.brilhante([x, y, z], [w, h, d], (220, 245, 255, 255))


def lanca_odin(m):
    ouro, ouro2 = "#d4a72c", "#8a6a14"
    haste = m.cubo([-0.5, -8, -0.5], [1, 26, 1], ouro, "haste")
    for f in ("north", "south", "east", "west"):
        for y in range(0, 104, 6):
            haste[f].ret(0, y / 4, 1, y / 4 + 0.25, ouro2)
    m.cubo([-1.4, 16, -1], [2.8, 1.2, 2], ouro2, "colar")
    p = m.cubo([-1.2, 17.2, -0.4], [2.4, 6, 0.8], "#d8dee8", "ponta")
    for f in ("north", "south"):
        p[f].preencher((0, 0, 0, 0))
        p[f].poli([(0, 6), (2.4, 6), (1.2, 0)], "#d8dee8")
        p[f].linha([(1.2, 0.4), (1.2, 6)], "#8a909a", 1)
        p[f].acender(lambda ff: ff.linha([(0.7, 4.6), (1.2, 2.5), (1.7, 4.6)], "#7fd6ff", 1))
    m.cubo([-1.2, -9, -1.2], [2.4, 1.2, 2.4], ouro2, "pomo")


def anel(m, cx, cy, r, cor, larg=0.7):
    for k in range(8):
        a = k / 8 * 2 * math.pi
        x, y = cx + r * math.cos(a), cy + r * math.sin(a)
        m.brilhante([x - larg / 2, y - larg / 2, -larg / 2], [larg, larg, larg], cor)


def dez_aneis(m):
    for k in range(5):
        anel(m, -3, 2 + k * 2.4, 2.0, "#3db8ff")
        anel(m, 3, 2 + k * 2.4, 2.0, "#7ae0ff")
    for k in range(5):
        c = m.cubo([-0.4, 1 + k * 2.4, -0.4], [0.8, 0.8, 0.8], "#c9a227", "elo")


def cetro_loki(m):
    ouro, ouro2 = "#d4a72c", "#8a6a14"
    haste = m.cubo([-0.5, -6, -0.5], [1, 18, 1], ouro, "haste")
    for f in ("north", "south", "east", "west"):
        for y in range(0, 72, 6):
            haste[f].ret(0, y / 4, 1, y / 4 + 0.25, ouro2)
    m.cubo([-1.6, 12, -1.2], [3.2, 1.6, 2.4], ouro, "base")
    m.brilhante([-1.0, 13.2, -1.0], [2, 2.6, 2], (80, 160, 255, 255), (210, 240, 255, 255))
    for lado in (-1, 1):
        l1 = m.cubo([lado * 1.6 - (1.2 if lado < 0 else 0), 13, -0.4], [1.2, 3, 0.8], "#c8ccd4", "lamina")
        l2 = m.cubo([lado * 2.2 - (1.0 if lado < 0 else 0), 15.6, -0.35], [1.0, 3.6, 0.7], "#c8ccd4", "lamina")
        l3 = m.cubo([lado * 1.2 - (0.8 if lado < 0 else 0), 19, -0.3], [0.8, 2.4, 0.6], "#d8dee8", "lamina")
    m.cubo([-0.5, -7, -0.5], [1, 1, 1], ouro2, "pomo")


def capacete_magneto(m):
    verm, verm2, roxo = "#a8121c", "#6a0a12", "#5b2a86"
    cab = m.cubo([-4.4, 0, -4.4], [8.8, 8.8, 8.8], verm, "capacete")
    f = cab["north"]
    f.ret(1.4, 2.8, 7.4, 8.8, (0, 0, 0, 0))
    f.poli([(3.2, 0), (5.6, 0), (5.0, 2.8), (3.8, 2.8)], verm2)
    for nome in ("east", "west", "south", "up"):
        cab[nome].ret(0, 0, cab[nome].w, 0.5, verm2)
    cab["down"].preencher((0, 0, 0, 0))
    m.cubo([-0.6, 8.8, -4.8], [1.2, 1.8, 9.6], verm2, "crista")
    for lado in (-1, 1):
        a = m.cubo([lado * 4.4 - (1.2 if lado < 0 else 0), 1.5, -1], [1.2, 4, 3], roxo, "lateral")
    interior = m.cubo([-3.6, 0.4, -3.6], [7.2, 8, 7.2], "#3a0a10", "interior")


def necroespada(m):
    preto, preto2 = "#1a1a1e", "#3a3a44"
    cabo = m.cubo([-0.6, -4, -0.6], [1.2, 5, 1.2], "#2a2a30", "cabo")
    for f in ("north", "south", "east", "west"):
        for y in range(0, 20, 3):
            cabo[f].linha([(0, y / 4), (1.2, y / 4 + 0.5)], "#141418", 1)
    m.cubo([-2.6, 1, -0.8], [5.2, 1.0, 1.6], preto2, "guarda")
    lam = m.cubo([-1.4, 2, -0.3], [2.8, 18, 0.6], preto, "lamina")
    for nome in ("north", "south"):
        f = lam[nome]
        f.preencher((0, 0, 0, 0))
        pts = [(0.3, 18)]
        for k in range(9):
            pts.append((0 if k % 2 else 0.5, 18 - k * 2))
        pts += [(1.4, 0)]
        for k in range(9):
            pts.append((2.8 if k % 2 == 0 else 2.3, k * 2))
        pts.append((2.5, 18))
        f.poli(pts, preto)
        f.linha([(1.4, 1), (1.4, 17)], preto2, 1)
        f.acender(lambda ff: ff.linha([(1.4, 2), (1.2, 8), (1.5, 14)], "#c8d0ff", 1))


def erva_coracao(m):
    roxo, roxo2, verde = "#9a5cff", "#5a2a9a", "#2f6a2a"
    caule = m.cubo([-0.4, 0, -0.4], [0.8, 8, 0.8], verde, "caule")
    for lado in (-1, 1):
        fo = m.cubo([lado * 0.4 - (2.6 if lado < 0 else 0), 3, -0.2], [2.6, 1.2, 0.4], "#3e8a2a", "folha")
    for k in range(6):
        a = k / 6 * 2 * math.pi
        x, z = 2.2 * math.cos(a), 2.2 * math.sin(a)
        p = m.brilhante([x - 1, 8.5, z - 1], [2, 1.2 + (k % 2) * 0.6, 2], (170, 110, 255, 255), (230, 200, 255, 255))
    m.brilhante([-1, 8.2, -1], [2, 2.4, 2], (220, 160, 255, 255), (255, 240, 255, 255))
    m.cubo([-2.4, -1.2, -2.4], [4.8, 1.2, 4.8], "#5a3a22", "terra")


def orbe_morag(m):
    prata, prata2 = "#a8aeb8", "#5c6270"
    cs = m.esfera((0, 4, 0), 4, prata, 8)
    for c in cs:
        for nome in ("north", "south", "east", "west"):
            c[nome].ret(0, 0, c[nome].w, 0.3, prata2)
    m.cubo([-4.3, 3.5, -4.3], [8.6, 1.0, 8.6], prata2, "faixa")
    m.brilhante([-1, 3.4, -4.5], [2, 1.2, 0.4], (190, 120, 255, 255), (255, 230, 255, 255))
    m.brilhante([-4.5, 3.4, -1], [0.4, 1.2, 2], (190, 120, 255, 255), (255, 230, 255, 255))


def forca_fenix(m):
    fogo1, fogo2, fogo3 = (255, 140, 20, 255), (255, 210, 60, 255), (255, 80, 0, 255)
    m.brilhante([-1.4, 5, -1.6], [2.8, 3.2, 4.4], fogo1, fogo2)
    m.brilhante([-1, 8, -2.6], [2, 2, 2], fogo2, (255, 250, 200, 255))
    m.cubo([-0.4, 8.6, -3.6], [0.8, 0.6, 1.2], "#d4a72c", "bico")
    for lado in (-1, 1):
        for k in range(4):
            x0 = lado * (1.4 + k * 1.8) - (1.8 if lado < 0 else 0)
            m.brilhante([x0, 6 + k * 1.3, -0.8], [1.8, 1.6 + k * 0.4, 2], fogo1 if k % 2 else fogo3, fogo2)
    for k in range(4):
        m.brilhante([-0.6 + (k % 2) * 0.3, 4.5 - k * 1.3, 2.4 + k * 0.6], [1.2, 1.4, 1.2], fogo3, fogo2)


ARTEFATOS_HD = {
    "manopla": manopla, "darkhold": darkhold, "olho_agamotto": olho_agamotto, "capa_levitacao": capa_levitacao,
    "livro_vishanti": livro_vishanti, "mjolnir_artefato": mjolnir, "rompe_tormentas": rompe_tormentas,
    "tesseract": tesseract, "lanca_odin": lanca_odin, "dez_aneis": dez_aneis, "cetro_loki": cetro_loki,
    "capacete_magneto": capacete_magneto, "necroespada": necroespada, "erva_coracao": erva_coracao,
    "orbe_morag": orbe_morag, "forca_fenix": forca_fenix,
}


def montar(aid):
    m = Modelo()
    ARTEFATOS_HD[aid](m)
    m.acabar()
    return m.cubos


def imagem(aid, tamanho=64, angulo=-35, escala=24):
    """Vista 3D do artefato (ícone)."""
    return m3.icone(montar(aid), tamanho, angulo, escala)
