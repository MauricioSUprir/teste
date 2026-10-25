"""Trajes detalhados dos heróis (texturas 4x e peças em 3D). Usa modelos3d.py.

Cada função recebe um Traje (os cubos do capacete, peitoral, calça e botas) e pinta as faces.
Coordenadas de desenho em unidades da face (a frente da cabeça vai de 0 a 8, com y para baixo);
cada unidade tem R = 4 pixels.
"""
import math

from modelos3d import Cubo, Face, R, rgba, mistura, clarear, acabamento, espelhar_membro

PELE = "#e2b08c"


class Traje:
    def __init__(self, volume=1.0):
        v = volume
        self.cabeca = Cubo("head", [-4, 24, -4], [8, 8, 8], 1.0, "cabeca")
        self.corpo = Cubo("body", [-4, 12, -2], [8, 12, 4], 1.01 * v, "corpo")
        self.braco = Cubo("rightArm", [-8, 12, -2], [4, 12, 4], 1.0 * v, "braco")
        self.cintura = Cubo("body", [-4, 12, -2], [8, 12, 4], 0.5, "cintura")
        self.perna = Cubo("rightLeg", [-3.9, 0, -2], [4, 12, 4], 0.5, "perna")
        self.bota = Cubo("rightLeg", [-3.9, 0, -2], [4, 5, 4], 1.0, "bota")
        self.extras = {"capacete": [], "peitoral": [], "calca": [], "botas": []}

    def extra(self, peca, cubo):
        self.extras[peca].append(cubo)
        return cubo

    def pecas(self):
        """Cubos de cada peça (o lado esquerdo é o espelho do direito)."""
        braco_e = getattr(self, "braco_e", None) or espelhar_membro(self.braco, "leftArm", [4, 12, -2])
        perna_e = espelhar_membro(self.perna, "leftLeg", [-0.1, 0, -2])
        bota_e = espelhar_membro(self.bota, "leftLeg", [-0.1, 0, -2])
        return {
            "capacete": [self.cabeca] + self.extras["capacete"],
            "peitoral": [self.corpo, self.braco, braco_e] + self.extras["peitoral"],
            "calca": [self.cintura, self.perna, perna_e] + self.extras["calca"],
            "botas": [self.bota, bota_e] + self.extras["botas"],
        }

    def acabar(self):
        extra_e = [self.braco_e] if getattr(self, "braco_e", None) else []
        for i, c in enumerate([self.cabeca, self.corpo, self.braco, self.cintura, self.perna, self.bota]
                              + extra_e + sum(self.extras.values(), [])):
            acabamento(c, semente=i)


# ------------------------------------------------------------------ pincéis
def teia(f, cx, cy, cor, raios=10, aneis=None, larg=1, raio_max=12):
    """Teia de aranha: linhas saindo do centro e arcos entre elas."""
    aneis = aneis or [1.3 * k for k in range(1, 9)]
    angs = [2 * math.pi * k / raios for k in range(raios)]
    for a in angs:
        f.linha([(cx, cy), (cx + raio_max * math.cos(a), cy + raio_max * math.sin(a))], cor, larg)
    for r in aneis:
        for a1, a2 in zip(angs, angs[1:] + angs[:1]):
            meio = (a1 + a2) / 2 if a2 > a1 else (a1 + a2 + 2 * math.pi) / 2
            p1 = (cx + r * math.cos(a1), cy + r * math.sin(a1))
            p2 = (cx + r * 0.86 * math.cos(meio), cy + r * 0.86 * math.sin(meio))
            p3 = (cx + r * math.cos(a2), cy + r * math.sin(a2))
            f.linha([p1, p2, p3], cor, larg)


def escamas(f, cor, passo=0.75):
    """Textura de malha/escamas (o uniforme do Capitão)."""
    W, H = f.w, f.h
    y = 0
    k = 0
    while y < H + passo:
        x = (passo / 2) * (k % 2)
        while x < W + passo:
            f.d.arc([(x - passo / 2) * R, (y - passo / 2) * R, (x + passo / 2) * R, (y + passo / 2) * R], 0, 180,
                    fill=rgba(cor))
            x += passo
        y += passo * 0.6
        k += 1


def listras_v(f, cores, largura, x0=0, x1=None):
    x1 = f.w if x1 is None else x1
    x, i = x0, 0
    while x < x1:
        f.ret(x, 0, min(x + largura, x1), f.h, cores[i % len(cores)])
        x += largura
        i += 1


def estrela(f, cx, cy, r, cor, contorno=None):
    pts = []
    for k in range(10):
        a = -math.pi / 2 + k * math.pi / 5
        rr = r if k % 2 == 0 else r * 0.42
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    f.poli(pts, cor, contorno)


def musculos_peito(f, escuro, claro=None):
    """Peitoral e abdômen desenhados com linhas de sombra."""
    f.linha([(4, 1.2), (4, 11.5)], escuro, 2)
    f.linha([(0.8, 4.6), (2.4, 5.2), (4, 4.8), (5.6, 5.2), (7.2, 4.6)], escuro, 2)
    for y in (6.6, 8.2, 9.8):
        f.linha([(2.3, y), (5.7, y)], escuro, 2)
    f.linha([(2.2, 5.4), (2.0, 11.5)], escuro, 1)
    f.linha([(5.8, 5.4), (6.0, 11.5)], escuro, 1)
    if claro:
        for x0, y0 in ((1.5, 2.2), (4.6, 2.2)):
            f.elipse(x0 + 0.9, y0 + 1.1, 1.0, 0.7, claro)


def contorno_face(f, cor, larg=1):
    f.d.rectangle([0, 0, f.img.width - 1, f.img.height - 1], outline=rgba(cor), width=larg)


def olho(f, cx, cy, cor_iris="#3d6cc8", lado=1):
    """Olho humano pequeno: branco, íris e sobrancelha."""
    f.ret(cx - 0.6, cy - 0.25, cx + 0.6, cy + 0.3, "#f4f4f4")
    f.ret(cx - 0.25 + 0.15 * lado, cy - 0.25, cx + 0.25 + 0.15 * lado, cy + 0.3, cor_iris)
    f.ret(cx - 0.05 + 0.15 * lado, cy - 0.1, cx + 0.1 + 0.15 * lado, cy + 0.15, "#101010")


def rosto_humano(f, pele, cabelo, olhos="#3d6cc8", barba=None, boca="#a0584a", y0=0.0):
    """Rosto com olhos, nariz, boca e sombras (frente da cabeça)."""
    f.preencher(pele)
    sombra = clarear(pele, -0.18)
    f.ret(0, 0, 8, 1.6 + y0, cabelo)
    olho(f, 2.6, 3.7 + y0, olhos, 1)
    olho(f, 5.4, 3.7 + y0, olhos, -1)
    f.ret(1.8, 2.9 + y0, 3.4, 3.15 + y0, clarear(cabelo, -0.2))
    f.ret(4.6, 2.9 + y0, 6.2, 3.15 + y0, clarear(cabelo, -0.2))
    f.poli([(3.7, 4.1 + y0), (4.3, 4.1 + y0), (4.5, 5.3 + y0), (3.5, 5.3 + y0)], sombra)
    f.ret(3.0, 6.2 + y0, 5.0, 6.5 + y0, boca)
    if barba:
        f.poli([(0.6, 5.0), (1.6, 6.2), (3.0, 7.1), (5.0, 7.1), (6.4, 6.2), (7.4, 5.0), (8, 5.0), (8, 8), (0, 8),
                (0, 5.0)], barba)
        f.ret(2.8, 5.9, 5.2, 6.1, barba)
        f.ret(3.0, 6.2, 5.0, 6.45, boca)


def cabelo_todo(t, cor, comprido=False):
    """Cabelo em cima, atrás e dos lados da cabeça, com mechas."""
    escuro = clarear(cor, -0.25)
    claro = clarear(cor, 0.2)
    for f in ("up", "south", "east", "west"):
        face = t.cabeca[f]
        face.preencher(cor)
        for k in range(0, 32, 3):
            x = k / 4
            face.linha([(x, 0), (x + 0.4, face.h)], escuro if k % 2 else claro, 1)
    for f in ("east", "west"):
        if not comprido:
            t.cabeca[f].ret(1.5 if f == "west" else 0, 3.2, 6.5 if f == "west" else 6.5, 8, PELE)
            t.cabeca[f].ret(3, 3.5, 5, 5.5, clarear(PELE, -0.1))


# ------------------------------------------------------------------ os heróis
def homem_de_ferro(t):
    verm, verm2, ouro, ouro2 = "#a3141b", "#6e0b10", "#e3b23c", "#a47a1f"
    brilho = "#dff8ff"
    c = t.cabeca
    for f in c.faces.values():
        f.preencher(verm)
    fr = c["north"]
    fr.poli([(1.0, 1.4), (7.0, 1.4), (7.3, 3.0), (7.0, 6.2), (5.6, 7.7), (2.4, 7.7), (1.0, 6.2), (0.7, 3.0)], ouro, ouro2)
    fr.linha([(1.0, 1.4), (4, 0.9), (7.0, 1.4)], ouro2, 1)
    fr.acender(lambda f: (f.poli([(1.5, 3.2), (3.4, 3.4), (3.3, 3.95), (1.7, 3.8)], brilho),
                          f.poli([(6.5, 3.2), (4.6, 3.4), (4.7, 3.95), (6.3, 3.8)], brilho)))
    fr.linha([(3.0, 6.3), (5.0, 6.3)], ouro2, 2)
    fr.linha([(1.4, 5.0), (2.6, 6.0), (2.6, 7.4)], ouro2, 1)
    fr.linha([(6.6, 5.0), (5.4, 6.0), (5.4, 7.4)], ouro2, 1)
    fr.linha([(4, 1.0), (4, 2.6)], ouro2, 1)
    for f in ("east", "west"):
        c[f].elipse(4, 4.6, 1.5, 1.5, ouro, verm2, 2)
        c[f].elipse(4, 4.6, 0.6, 0.6, ouro2)
        c[f].linha([(0, 2), (8, 2)], verm2, 1)
    c["up"].linha([(4, 0), (4, 8)], verm2, 2)
    c["south"].linha([(0, 6), (8, 6)], verm2, 1)
    c["south"].linha([(4, 0), (4, 6)], verm2, 1)
    # peitoral
    b = t.corpo
    for f in b.faces.values():
        f.preencher(verm)
    fr = b["north"]
    fr.poli([(0.4, 0.4), (3.6, 0.6), (3.4, 4.8), (0.4, 4.4)], clarear(verm, 0.08), verm2)
    fr.poli([(7.6, 0.4), (4.4, 0.6), (4.6, 4.8), (7.6, 4.4)], clarear(verm, 0.08), verm2)
    for k, y in enumerate((6.2, 7.6, 9.0, 10.4)):
        fr.ret(2.2, y, 3.8, y + 1.1, ouro if k % 2 == 0 else clarear(ouro, -0.1))
        fr.ret(4.2, y, 5.8, y + 1.1, ouro if k % 2 == 0 else clarear(ouro, -0.1))
    fr.ret(0.2, 5.6, 1.4, 11.6, ouro2)
    fr.ret(6.6, 5.6, 7.8, 11.6, ouro2)
    fr.ret(0, 11.2, 8, 12, verm2)
    fr.acender(lambda f: (f.elipse(4, 3.0, 1.5, 1.5, "#5ad8ff", "#1d4f6a", 2), f.elipse(4, 3.0, 0.8, 0.8, brilho)))
    ct = b["south"]
    ct.ret(1, 1, 7, 6, clarear(verm, -0.1))
    ct.linha([(4, 0), (4, 12)], verm2, 2)
    for y in (7, 9, 11):
        ct.linha([(0, y), (8, y)], verm2, 1)
    reator = t.extra("peitoral", Cubo("body", [-1, 20, -3.6], [2, 2, 0.6], 0, "reator"))
    reator.todas("#1d4f6a")
    reator["north"].acender(lambda f: (f.elipse(1, 1, 1, 1, "#5ad8ff"), f.elipse(1, 1, 0.5, 0.5, brilho)))
    # braços: ombro vermelho, antebraço dourado, palma com repulsor
    a = t.braco
    for nome, f in a.faces.items():
        f.preencher(verm)
        if nome in ("north", "south", "east", "west"):
            f.ret(0, 6.5, f.w, 12, ouro)
            f.ret(0, 6.2, f.w, 6.6, ouro2)
            f.ret(0, 3.6, f.w, 4.0, verm2)
            f.linha([(0.3, 1.0), (f.w - 0.3, 1.0)], clarear(verm, 0.2), 1)
    a["down"].acender(lambda f: f.elipse(2, 2, 1.2, 1.2, brilho, "#5ad8ff", 2))
    # calça e botas
    for f in t.cintura.faces.values():
        f.preencher(verm)
    t.cintura["north"].ret(0, 10.4, 8, 12, ouro2)
    p = t.perna
    for nome, f in p.faces.items():
        f.preencher(verm)
        if nome == "north":
            f.ret(0.6, 0.8, 3.4, 5.2, ouro)
            f.ret(0.8, 6.2, 3.2, 7.6, ouro)
        if nome in ("east", "west"):
            f.ret(0, 0.5, 4, 5.5, ouro2)
    o = t.bota
    for nome, f in o.faces.items():
        f.preencher(verm)
        if nome in ("north", "south", "east", "west"):
            f.ret(0, 0, f.w, 0.6, ouro)
            f.ret(0, 3.8, f.w, 5, verm2)
    o["down"].acender(lambda f: f.elipse(2, 2, 1.0, 1.0, brilho, "#5ad8ff", 2))


def homem_aranha(t):
    verm, verm2, azul, azul2, preto = "#cc1b2b", "#8a0f1b", "#1f46b8", "#132e7a", "#16161a"
    c = t.cabeca
    for nome, f in c.faces.items():
        f.preencher(verm)
        cx, cy = {"north": (4, 3.8), "up": (4, 4)}.get(nome, (4, 3.5))
        teia(f, cx, cy, preto, raios=12 if nome == "north" else 10)
    fr = c["north"]
    for lado in (-1, 1):
        x = 4 + lado * 2.1
        pts = [(4 + lado * 0.5, 2.6), (4 + lado * 3.4, 2.2), (4 + lado * 3.4, 4.6), (4 + lado * 1.4, 5.0)]
        fr.poli(pts, preto)
        dentro = [(4 + lado * 0.95, 2.95), (4 + lado * 3.0, 2.65), (4 + lado * 3.0, 4.25), (4 + lado * 1.55, 4.55)]
        fr.poli(dentro, "#f6f8fb")
        fr.poli([(4 + lado * 2.4, 2.75), (4 + lado * 2.95, 2.7), (4 + lado * 2.9, 3.4)], "#ffffff")
    # tronco: centro vermelho com teia, laterais azuis, aranha preta
    b = t.corpo
    for nome, f in b.faces.items():
        f.preencher(verm)
        if nome in ("north", "south"):
            teia(f, 4, 3, preto, raios=12)
            f.poli([(0, 4.5), (1.6, 6.5), (2.6, 12), (0, 12)], azul)
            f.poli([(8, 4.5), (6.4, 6.5), (5.4, 12), (8, 12)], azul)
            f.ret(0, 11, 8, 12, verm)
            teia(f, 4, 11.5, preto, raios=8, aneis=[0.7, 1.4], raio_max=1.6)
        elif nome in ("east", "west"):
            f.preencher(azul)
            f.ret(0, 0, 4, 3.5, verm)
            teia(f, 2, 1, preto, raios=6, aneis=[1, 2], raio_max=3)
            f.ret(0, 11, 4, 12, verm)
    fr = b["north"]
    fr.elipse(4, 3.2, 0.55, 0.75, preto)
    fr.elipse(4, 4.4, 0.75, 1.0, preto)
    for lado in (-1, 1):
        for dy, dx in ((-0.6, 1.6), (-0.2, 1.9), (0.3, 1.9), (0.7, 1.6)):
            fr.linha([(4, 3.8 + dy * 0.6), (4 + lado * dx, 3.8 + dy * 2.2)], preto, 2)
    ct = b["south"]
    ct.elipse(4, 4.2, 0.9, 1.3, verm2, preto)
    for lado in (-1, 1):
        for dy in (-1.5, -0.5, 0.5, 1.5):
            ct.linha([(4, 4.2), (4 + lado * 2.5, 4.2 + dy * 1.5)], preto, 1)
    a = t.braco
    for nome, f in a.faces.items():
        f.preencher(verm)
        teia(f, f.w / 2, 0, preto, raios=6, aneis=[1.5, 3, 4.5, 6, 7.5, 9, 10.5], raio_max=12)
    a["west"].preencher(azul).ret(0, 0, 4, 2.5, verm)
    a["south"].poli([(0, 2), (4, 2), (4, 8), (0, 9)], azul)
    for f in t.cintura.faces.values():
        f.preencher(azul)
    t.cintura["north"].ret(0, 9.5, 8, 12, verm)
    teia(t.cintura["north"], 4, 12, preto, raios=8, aneis=[1, 2, 3], raio_max=3.5)
    for f in t.perna.faces.values():
        f.preencher(azul)
        f.linha([(0.5, 0), (0.6, 12)], azul2, 1)
    for nome, f in t.bota.faces.items():
        f.preencher(verm)
        teia(f, f.w / 2, 0, preto, raios=6, aneis=[1.2, 2.4, 3.6, 4.8], raio_max=6)
        if nome in ("north", "south", "east", "west"):
            f.poli([(0, 0), (f.w, 0), (f.w, 0.5), (f.w / 2, 1.3), (0, 0.5)], azul)


def capitao_america(t):
    azul, azul2, branco, verm, marrom = "#25438f", "#152a5e", "#eef0f4", "#b5121b", "#6b4423"
    c = t.cabeca
    for f in c.faces.values():
        f.preencher(azul)
        escamas(f, azul2, 0.9)
    fr = c["north"]
    rosto_humano(fr, PELE, azul, olhos="#2f5fb8")
    fr.ret(0, 0, 8, 2.3, azul)
    fr.poli([(0, 2.3), (1.2, 2.3), (1.0, 5.5), (0, 6)], azul)
    fr.poli([(8, 2.3), (6.8, 2.3), (7.0, 5.5), (8, 6)], azul)
    olho(fr, 2.6, 3.4, "#2f5fb8", 1)
    olho(fr, 5.4, 3.4, "#2f5fb8", -1)
    fr.poli([(3.0, 2.0), (4, 0.4), (5.0, 2.0), (4.5, 2.0), (4, 1.2), (3.5, 2.0)], branco)
    fr.ret(3.55, 1.45, 4.45, 1.7, branco)
    fr.linha([(0, 2.35), (8, 2.35)], azul2, 1)
    for f, s in (("east", 1), ("west", -1)):
        asa = c[f]
        cx = 4.5
        for k in range(3):
            asa.poli([(cx - 2.2 * s, 2.4 + k * 0.7), (cx + 0.6 * s, 2.0 + k * 0.7), (cx + 0.4 * s, 2.5 + k * 0.7),
                      (cx - 1.8 * s, 2.9 + k * 0.7)], branco)
        asa.ret(0 if s > 0 else 5.8, 4.6, 2.2 if s > 0 else 8, 8, PELE)
    # tronco: estrela, listras vermelhas e brancas, cinto
    b = t.corpo
    for nome, f in b.faces.items():
        f.preencher(azul)
        escamas(f, azul2, 0.8)
    fr = b["north"]
    estrela(fr, 4, 3.4, 2.1, "#d9dde4", "#8a8f99")
    estrela(fr, 4, 3.4, 1.7, branco)
    for k in range(5):
        fr.ret(0, 6.0 + k * 0.95, 8, 6.0 + k * 0.95 + 0.95, verm if k % 2 == 0 else branco)
    fr.ret(0, 10.8, 8, 12, marrom)
    fr.ret(3.4, 10.9, 4.6, 11.9, "#c9a227")
    for x in (0.6, 6.2):
        fr.ret(x, 10.6, x + 1.2, 12, clarear(marrom, -0.15))
    ct = b["south"]
    ct.ret(0, 10.8, 8, 12, marrom)
    for nome in ("east", "west"):
        b[nome].ret(0, 6, 4, 10.8, verm)
        b[nome].ret(0, 10.8, 4, 12, marrom)
    a = t.braco
    for nome, f in a.faces.items():
        f.preencher(azul)
        escamas(f, azul2, 0.8)
        if nome != "up":
            f.ret(0, 8.2, f.w, 12, marrom)
            f.ret(0, 8.0, f.w, 8.5, clarear(marrom, -0.2))
            f.ret(0, 0, f.w, 1.0, branco)
    for f in t.cintura.faces.values():
        f.preencher(azul)
        escamas(f, azul2, 0.8)
    t.cintura["north"].ret(0, 10.8, 8, 12, marrom)
    for nome, f in t.perna.faces.items():
        f.preencher(azul)
        escamas(f, azul2, 0.8)
        if nome == "north":
            f.ret(0.6, 5.0, 3.4, 6.6, azul2)
    for nome, f in t.bota.faces.items():
        f.preencher(marrom)
        if nome in ("north", "south", "east", "west"):
            f.ret(0, 0, f.w, 0.7, clarear(marrom, -0.25))
            f.linha([(0, 2.4), (f.w, 2.4)], clarear(marrom, -0.25), 1)
    # o escudo nas costas
    e = t.extra("peitoral", Cubo("body", [-4.6, 13.2, 3.25], [9.2, 9.2, 0.6], 0, "escudo"))
    for nome in ("north", "east", "west", "up", "down"):
        e[nome].preencher("#8a8f99")
    s = e["south"]
    r0 = 4.6
    for r, cor in ((r0, verm), (r0 * 0.8, branco), (r0 * 0.6, verm), (r0 * 0.4, azul)):
        s.elipse(4.6, 4.6, r, r, cor)
    estrela(s, 4.6, 4.6, 1.75, branco)
    s.elipse(4.6, 4.6, r0, r0, None, clarear(verm, -0.3), 1)


def thor(t):
    loiro, cinza, cinza2, prata, verm, verm2 = "#e2bb55", "#34373e", "#202227", "#c8cdd5", "#a3121b", "#6a0b12"
    c = t.cabeca
    cabelo_todo(t, loiro, comprido=True)
    fr = c["north"]
    rosto_humano(fr, PELE, loiro, olhos="#3d7ad6", barba=clarear(loiro, -0.1))
    fr.ret(0, 0, 8, 1.4, loiro)
    fr.poli([(0, 1.4), (1.0, 1.4), (0.8, 6), (0, 7)], loiro)
    fr.poli([(8, 1.4), (7.0, 1.4), (7.2, 6), (8, 7)], loiro)
    c["up"].preencher(loiro)
    # armadura escura com os seis discos prateados
    b = t.corpo
    for nome, f in b.faces.items():
        f.preencher(cinza)
        f.linha([(0, 3), (8, 3)], cinza2, 1)
    fr = b["north"]
    fr.poli([(0, 0), (8, 0), (6.5, 5.5), (4, 6.2), (1.5, 5.5)], clarear(cinza, 0.06))
    for y in (2.0, 4.0, 6.0):
        for x in (2.4, 5.6):
            fr.elipse(x, y, 0.8, 0.8, prata, "#7a808a", 2)
            fr.elipse(x - 0.2, y - 0.2, 0.25, 0.25, "#ffffff")
    fr.ret(0, 10.6, 8, 12, cinza2)
    fr.ret(3.2, 10.7, 4.8, 11.9, prata)
    for x in (0.4, 7.0):
        fr.elipse(x + 0.3, 0.6, 0.5, 0.5, "#d4a72c")
    a = t.braco
    for nome, f in a.faces.items():
        f.preencher(cinza)
        f.ret(0, 0, f.w, 3.5, clarear(cinza, 0.08))
        f.linha([(0, 3.5), (f.w, 3.5)], cinza2, 1)
        f.ret(0, 7.5, f.w, 12, prata)
        for y in (8.5, 10, 11.4):
            f.linha([(0, y), (f.w, y)], "#8a909a", 1)
    for f in t.cintura.faces.values():
        f.preencher(cinza2)
    for f in t.perna.faces.values():
        f.preencher(cinza2)
        f.linha([(2, 0), (2, 12)], cinza, 1)
    for nome, f in t.bota.faces.items():
        f.preencher(cinza)
        if nome in ("north", "south", "east", "west"):
            f.ret(0, 0, f.w, 1.2, prata)
    # a capa vermelha (atrás, até os joelhos)
    capa = t.extra("peitoral", Cubo("body", [-4.6, 4.0, 3.1], [9.2, 20.2, 0.45], 0, "capa"))
    for nome, f in capa.faces.items():
        f.preencher(verm)
    sul = capa["south"]
    for k in range(9):
        x = 0.5 + k * 1.05
        sul.ret(x, 0, x + 0.45, 20.2, verm2 if k % 2 else clarear(verm, 0.08))
    capa["north"].preencher(verm2)


def hulk(t):
    verde, verde2, verde3, roxo, roxo2 = "#5a9a33", "#3d6e22", "#77b84a", "#5b2a86", "#3c1a5a"
    c = t.cabeca
    cabelo_todo(t, "#151515")
    for f in ("east", "west"):
        c[f].ret(1.5 if f == "west" else 0, 3.0, 6.5, 8, verde)
    fr = c["north"]
    fr.preencher(verde)
    fr.ret(0, 0, 8, 1.8, "#151515")
    fr.poli([(0, 1.8), (1.5, 1.8), (0.8, 3.0), (0, 3.4)], "#151515")
    fr.poli([(1.4, 2.8), (3.6, 3.3), (3.4, 3.7), (1.3, 3.2)], verde2)
    fr.poli([(6.6, 2.8), (4.4, 3.3), (4.6, 3.7), (6.7, 3.2)], verde2)
    fr.ret(1.9, 3.7, 3.3, 4.2, "#d8f0c0")
    fr.ret(4.7, 3.7, 6.1, 4.2, "#d8f0c0")
    fr.ret(2.5, 3.75, 3.0, 4.2, "#2a4a12")
    fr.ret(5.0, 3.75, 5.5, 4.2, "#2a4a12")
    fr.poli([(3.6, 4.4), (4.4, 4.4), (4.8, 5.5), (3.2, 5.5)], verde2)
    fr.ret(2.3, 6.0, 5.7, 7.1, "#3a1414")
    for x in range(0, 7):
        fr.ret(2.4 + x * 0.48, 6.0, 2.7 + x * 0.48, 6.4, "#f2f2e6")
        fr.ret(2.4 + x * 0.48, 6.75, 2.7 + x * 0.48, 7.1, "#f2f2e6")
    fr.linha([(1.5, 7.2), (4, 7.8), (6.5, 7.2)], verde2, 1)
    b = t.corpo
    for nome, f in b.faces.items():
        f.preencher(verde)
    musculos_peito(b["north"], verde2, verde3)
    ct = b["south"]
    ct.linha([(4, 0), (4, 12)], verde2, 2)
    ct.linha([(0.5, 2), (3, 5), (4, 4.5), (5, 5), (7.5, 2)], verde2, 1)
    a = t.braco
    for nome, f in a.faces.items():
        f.preencher(verde)
        if nome in ("north", "south"):
            f.elipse(2, 2.6, 1.6, 2.0, clarear(verde, 0.07))
            f.linha([(0.6, 6), (2, 7), (3.4, 6)], verde2, 1)
            f.elipse(2, 9.0, 1.5, 1.8, clarear(verde, 0.06))
    for f in t.cintura.faces.values():
        f.preencher(roxo)
    t.cintura["north"].linha([(0, 9.5), (8, 9.5)], roxo2, 2)
    for nome, f in t.perna.faces.items():
        f.preencher(roxo)
        if nome in ("north", "south", "east", "west"):
            pts = [(0, 7.5), (0.8, 8.6), (1.5, 7.6), (2.3, 9.0), (3.1, 7.7), (4, 8.4), (4, 12), (0, 12)]
            f.poli(pts, verde)
            f.linha([(0.5, 2), (1.5, 4)], roxo2, 1)
            f.linha([(3, 1), (2.5, 3)], roxo2, 1)
    for nome, f in t.bota.faces.items():
        f.preencher(verde)
        if nome == "north":
            for x in (0.4, 1.4, 2.4, 3.4):
                f.ret(x, 4.3, x + 0.4, 5, verde2)


# ------------------------------------------------------------------ utilidades para os outros heróis
def pintar_tudo(t, cabeca=None, corpo=None, braco=None, cintura=None, perna=None, bota=None):
    for cubo, cor in ((t.cabeca, cabeca), (t.corpo, corpo), (t.braco, braco), (t.cintura, cintura),
                      (t.perna, perna), (t.bota, bota)):
        if cor:
            cubo.todas(cor)


def lados(cubo):
    return [cubo[f] for f in ("north", "south", "east", "west")]


def costuras(f, cor, passo=3.0, vertical=True):
    """Linhas de painel / costura."""
    k = passo
    while k < (f.w if vertical else f.h):
        if vertical:
            f.linha([(k, 0), (k, f.h)], cor, 1)
        else:
            f.linha([(0, k), (f.w, k)], cor, 1)
        k += passo


def luvas(t, cor, desde=8.5):
    for f in lados(t.braco):
        f.ret(0, desde, f.w, 12, cor)
        f.ret(0, desde, f.w, desde + 0.35, clarear(cor, -0.25))
    t.braco["down"].preencher(cor)


def botas(t, cor, faixa=None):
    for f in lados(t.bota):
        f.preencher(cor)
        if faixa:
            f.ret(0, 0, f.w, 0.6, faixa)
    t.bota["down"].preencher(clarear(cor, -0.3))
    t.bota["up"].preencher(cor)


def cinto(t, cor, fivela=None, y=10.6):
    for f in lados(t.corpo):
        f.ret(0, y, f.w, min(12, y + 1.2), cor)
    for f in lados(t.cintura):
        f.ret(0, y, f.w, min(12, y + 1.2), cor)
    if fivela:
        t.corpo["north"].ret(3.2, y + 0.1, 4.8, min(12, y + 1.1), fivela)


def capa(t, cor, cor2=None, y0=4.0, gola=None):
    c = t.extra("peitoral", Cubo("body", [-4.6, y0, 3.1], [9.2, 24 - y0 + 0.2, 0.45], 0, "capa"))
    c.todas(cor)
    sul = c["south"]
    for k in range(9):
        x = 0.5 + k * 1.05
        sul.ret(x, 0, x + 0.45, sul.h, cor2 or clarear(cor, -0.18))
    c["north"].preencher(clarear(cor, -0.3))
    if gola:
        g = t.extra("peitoral", Cubo("body", [-4.8, 24.0, 2.6], [9.6, 3.0, 0.5], 0, "gola"))
        g.todas(gola)
    return c


def cabelo_comprido(t, cor):
    """Cabelo que desce pelas costas (peça extra presa à cabeça)."""
    cabelo_todo(t, cor, comprido=True)
    c = t.extra("capacete", Cubo("head", [-4.6, 19.5, 3.4], [9.2, 5.0, 1.0], 0, "cabelo"))
    c.todas(cor)
    for f in c.faces.values():
        for k in range(0, int(f.w * R), 3):
            f.linha([(k / R, 0), (k / R + 0.3, f.h)], clarear(cor, -0.22), 1)
    return c


def mascara_olhos(f, fundo, olho, contorno, y=3.4, larg=1.6, alt=1.0):
    for lado in (-1, 1):
        cx = 4 + lado * 1.7
        pts = [(cx - larg / 2, y - alt / 2), (cx + larg / 2, y - alt / 2 + lado * 0.15),
               (cx + larg / 2, y + alt / 2), (cx - larg / 2, y + alt / 2)]
        f.poli([(x - 0.25, yy - 0.25) if i == 0 else (x + 0.25, yy + 0.25) for i, (x, yy) in enumerate(pts)], contorno)
        f.acender(lambda ff, p=pts: ff.poli(p, olho))


def emblema_4(f, cx, cy, r, azul="#1f4fb3"):
    f.elipse(cx, cy, r, r, "#f4f4f4", "#101820", 2)
    f.poli([(cx + 0.15 * r, cy - 0.7 * r), (cx + 0.45 * r, cy - 0.7 * r), (cx + 0.45 * r, cy + 0.75 * r),
            (cx + 0.15 * r, cy + 0.75 * r)], azul)
    f.poli([(cx + 0.15 * r, cy - 0.7 * r), (cx - 0.55 * r, cy + 0.2 * r), (cx - 0.55 * r, cy + 0.45 * r),
            (cx + 0.7 * r, cy + 0.45 * r), (cx + 0.7 * r, cy + 0.2 * r), (cx - 0.1 * r, cy + 0.2 * r),
            (cx + 0.3 * r, cy - 0.3 * r)], azul)


def raio_simbolo(f, cx, cy, s, cor, contorno=None):
    pts = [(cx + 0.3 * s, cy - 1.2 * s), (cx - 0.5 * s, cy + 0.1 * s), (cx + 0.05 * s, cy + 0.1 * s),
           (cx - 0.35 * s, cy + 1.2 * s), (cx + 0.6 * s, cy - 0.2 * s), (cx + 0.05 * s, cy - 0.2 * s)]
    f.poli(pts, cor, contorno)


def fogo(f, semente=0):
    import random
    rnd = random.Random(semente)
    cores = ["#ffd54a", "#ffae1a", "#ff7a00", "#ff4a00", "#fff1a0"]
    f.preencher("#ff7a00")
    for _ in range(int(f.w * f.h * 1.5)):
        x, y = rnd.uniform(0, f.w), rnd.uniform(0, f.h)
        f.poli([(x, y), (x + 0.3, y - rnd.uniform(0.6, 1.6)), (x + 0.6, y)], rnd.choice(cores))


def pedras(f, base, escuro, claro, semente=0):
    import random
    rnd = random.Random(semente)
    f.preencher(escuro)
    y = 0
    while y < f.h:
        x = -rnd.uniform(0, 1)
        h = rnd.uniform(1.2, 2.0)
        while x < f.w:
            w = rnd.uniform(1.3, 2.4)
            cor = mistura(base, claro, rnd.uniform(0, 0.4))
            f.poli([(x + 0.15, y + 0.15), (x + w - 0.15, y + 0.2), (x + w - 0.2, y + h - 0.15), (x + 0.2, y + h - 0.2)],
                   cor)
            x += w
        y += h


# ------------------------------------------------------------------ Vingadores e cia
def viuva_negra(t):
    preto, cinza, ruivo = "#18181d", "#30303a", "#b03a1d"
    pintar_tudo(t, ruivo, preto, preto, preto, preto, preto)
    cabelo_comprido(t, ruivo)
    rosto_humano(t.cabeca["north"], PELE, ruivo, olhos="#2f7a4a", boca="#c0303a")
    for cubo in (t.corpo, t.braco, t.perna, t.cintura):
        for f in lados(cubo):
            costuras(f, cinza, 1.9)
    t.corpo["north"].poli([(3, 0), (5, 0), (4.6, 2.4), (3.4, 2.4)], "#e8e8e8")
    t.corpo["north"].linha([(4, 0), (4, 10.5)], "#6a6a75", 1)
    cinto(t, "#8a8f99")
    t.corpo["north"].acender(lambda f: (f.poli([(3.4, 10.7), (4.6, 10.7), (4, 11.3)], "#ff2a2a"),
                                        f.poli([(3.4, 11.9), (4.6, 11.9), (4, 11.3)], "#ff2a2a")))
    for f in lados(t.braco):
        f.ret(0, 9.0, f.w, 10.2, "#d4a72c")
        f.acender(lambda ff: ff.ret(1.2, 9.3, 2.8, 9.9, "#7fe0ff"))
    botas(t, "#101014", "#30303a")


def gaviao_arqueiro(t):
    preto, roxo, roxo2 = "#1d1d24", "#5a2d86", "#3d1d5e"
    pintar_tudo(t, "#4a3524", preto, roxo, preto, preto, preto)
    cabelo_todo(t, "#4a3524")
    rosto_humano(t.cabeca["north"], PELE, "#4a3524", olhos="#3a6aa8")
    t.cabeca["north"].ret(1.6, 3.2, 6.4, 4.0, "#2a2a30")
    t.cabeca["north"].acender(lambda f: (f.ret(1.8, 3.35, 3.6, 3.85, "#b25cff"), f.ret(4.4, 3.35, 6.2, 3.85, "#b25cff")))
    fr = t.corpo["north"]
    fr.poli([(0, 0), (2.5, 0), (5.5, 12), (3, 12)], roxo)
    fr.poli([(8, 0), (6, 0), (6, 6), (8, 7)], roxo2)
    costuras(fr, "#2c2c35", 2.0, vertical=False)
    for f in lados(t.braco):
        f.ret(0, 6.5, f.w, 10, "#2c2c35")
        f.linha([(0, 7.5), (f.w, 7.5)], roxo, 1)
    luvas(t, "#141418", 10)
    cinto(t, "#3a2a1c", "#8a8f99")
    aljava = t.extra("peitoral", Cubo("body", [0.5, 13, 3.2], [3, 11, 2], 0, "aljava"))
    aljava.todas("#5a3a22")
    for k in range(4):
        fl = t.extra("peitoral", Cubo("body", [0.8 + k * 0.6, 24, 3.6], [0.3, 3, 0.3], 0, "flecha"))
        fl.todas("#d0d0d0")
        fl["up"].preencher(roxo)
    botas(t, "#101014")


def pantera_negra(t):
    preto, preto2, prata, roxo = "#141418", "#22222a", "#c9ced8", "#9a5cff"
    pintar_tudo(t, preto, preto, preto, preto, preto, preto)
    for cubo in (t.cabeca, t.corpo, t.braco, t.cintura, t.perna, t.bota):
        for f in cubo.faces.values():
            for k in range(0, int(f.w), 1):
                f.poli([(k, 0), (k + 0.5, 0.6), (k + 1, 0)], preto2)
            costuras(f, preto2, 1.0, vertical=False)
    fr = t.cabeca["north"]
    fr.poli([(1.2, 3.0), (3.4, 3.5), (3.2, 4.1), (1.4, 3.7)], "#d8dde6")
    fr.poli([(6.8, 3.0), (4.6, 3.5), (4.8, 4.1), (6.6, 3.7)], "#d8dde6")
    fr.linha([(4, 0.5), (4, 5.0)], prata, 1)
    fr.linha([(2, 6.5), (4, 7.2), (6, 6.5)], prata, 1)
    orelha = t.extra("capacete", Cubo("head", [-3.6, 32.8, -2], [1.4, 1.2, 1.2], 0, "orelha"))
    orelha.todas(preto)
    orelha2 = t.extra("capacete", Cubo("head", [2.2, 32.8, -2], [1.4, 1.2, 1.2], 0, "orelha"))
    orelha2.todas(preto)
    co = t.corpo["north"]
    for k in range(9):
        x = 0.8 + k * 0.8
        co.poli([(x, 0.4), (x + 0.5, 0.4), (x + 0.25, 1.6 + 0.4 * (4 - abs(k - 4)))], prata)
    co.acender(lambda f: (f.linha([(0.5, 4), (4, 7), (7.5, 4)], roxo, 1), f.linha([(1.5, 9), (4, 11), (6.5, 9)], roxo, 1)))
    for f in lados(t.braco):
        f.acender(lambda ff: ff.linha([(0.3, 9), (ff.w / 2, 10), (ff.w - 0.3, 9)], roxo, 1))
    for f in lados(t.perna):
        f.acender(lambda ff: ff.linha([(0.3, 4), (ff.w / 2, 5.2), (ff.w - 0.3, 4)], roxo, 1))


def doutor_estranho(t):
    azul, azul2, verm, ouro = "#23407a", "#162a52", "#a8141d", "#d4a72c"
    pintar_tudo(t, "#2a2420", azul, azul, "#1d1d22", "#1d1d22", "#3a2a1c")
    cabelo_todo(t, "#2a2420")
    for f in ("east", "west"):
        t.cabeca[f].ret(3, 1.8, 6, 3.2, "#9a9a9a")
    fr = t.cabeca["north"]
    rosto_humano(fr, PELE, "#2a2420", olhos="#3e8a5a", barba=None)
    fr.poli([(3.2, 5.9), (4.8, 5.9), (4.6, 7.8), (3.4, 7.8)], "#2a2420")
    fr.ret(2.4, 5.6, 5.6, 5.85, "#2a2420")
    fr.ret(0, 1.2, 1.0, 2.6, "#9a9a9a")
    fr.ret(7.0, 1.2, 8, 2.6, "#9a9a9a")
    co = t.corpo["north"]
    co.poli([(0, 0), (3.2, 0), (4, 12), (0, 12)], azul2)
    co.linha([(1, 0.5), (7, 9.5)], "#5a3a22", 3)
    cinto(t, "#5a3a22", ouro, 9.6)
    co.elipse(4, 2.6, 1.2, 1.2, ouro, "#7a5a10", 2)
    co.acender(lambda f: f.elipse(4, 2.6, 0.5, 0.5, "#4dff6a"))
    for f in lados(t.braco):
        f.ret(0, 7.5, f.w, 12, "#6b4a2c")
        f.linha([(0, 8.4), (f.w, 8.4)], "#4a3220", 1)
        f.linha([(0, 10.2), (f.w, 10.2)], "#4a3220", 1)
    capa(t, verm, gola=verm, y0=3.0)
    botas(t, "#3a2a1c")


def feiticeira_escarlate(t):
    verm, verm2, preto = "#9b1726", "#5e0c16", "#1e1a1e"
    pintar_tudo(t, "#7a2e22", verm, verm, preto, preto, verm2)
    cabelo_comprido(t, "#7a2e22")
    fr = t.cabeca["north"]
    rosto_humano(fr, PELE, "#7a2e22", olhos="#3e6a8a", boca="#a02838")
    fr.poli([(1.0, 1.6), (4, 0.2), (7.0, 1.6), (6.0, 2.4), (4, 1.4), (2.0, 2.4)], verm)
    fr.poli([(3.5, 1.2), (4, 0.0), (4.5, 1.2)], "#d8a0a8")
    co = t.corpo["north"]
    co.poli([(0, 0), (3.0, 0), (3.6, 12), (0, 12)], verm2)
    co.poli([(8, 0), (5.0, 0), (4.4, 12), (8, 12)], verm2)
    co.ret(3.0, 0, 5.0, 5, preto)
    for f in lados(t.braco):
        f.ret(0, 10, f.w, 12, verm2)
        f.acender(lambda ff: ff.ret(0.4, 11.0, ff.w - 0.4, 11.7, "#ff3b4e"))
    t.braco["down"].acender(lambda ff: ff.elipse(2, 2, 1.3, 1.3, "#ff3b4e"))
    capa(t, verm2, y0=5)
    botas(t, verm2, verm)


def visao(t):
    verm, verde, amarelo = "#b0283a", "#2c6a3a", "#d9b04a"
    pintar_tudo(t, verm, verde, verde, verde, verde, verde)
    fr = t.cabeca["north"]
    fr.preencher(verm)
    for x in (1.2, 2.4, 5.6, 6.8):
        fr.linha([(x, 0), (x, 8)], clarear(verm, -0.15), 1)
    fr.acender(lambda f: (f.poli([(3.2, 1.0), (4.8, 1.0), (4.4, 2.4), (3.6, 2.4)], "#ffe14a"),
                          f.ret(1.8, 3.6, 3.2, 4.2, "#7ff3ff"), f.ret(4.8, 3.6, 6.2, 4.2, "#7ff3ff")))
    fr.ret(3.0, 6.0, 5.0, 6.3, clarear(verm, -0.35))
    co = t.corpo["north"]
    co.poli([(0, 0), (8, 0), (4, 6)], amarelo)
    co.poli([(1.2, 0), (6.8, 0), (4, 4.4)], verde)
    co.poli([(2.5, 7), (5.5, 7), (4, 11)], clarear(verde, 0.12))
    for f in lados(t.braco):
        f.ret(0, 0, f.w, 3.5, amarelo)
        f.ret(0, 9, f.w, 12, amarelo)
    capa(t, amarelo, gola=amarelo, y0=3)
    botas(t, amarelo)


def capita_marvel(t):
    azul, verm, ouro, loiro = "#1e3c8c", "#b5161f", "#e8c040", "#e3c26a"
    pintar_tudo(t, loiro, azul, azul, azul, azul, verm)
    cabelo_comprido(t, loiro)
    rosto_humano(t.cabeca["north"], PELE, loiro, olhos="#3e6ac8", boca="#c06060")
    co = t.corpo["north"]
    co.poli([(0, 0), (8, 0), (8, 2.2), (6, 4.2), (4, 6.0), (2, 4.2), (0, 2.2)], verm)
    estrela(co, 4, 3.4, 1.6, ouro, "#a47a1f")
    co.linha([(0, 2.2), (2, 4.2), (4, 6.0), (6, 4.2), (8, 2.2)], ouro, 1)
    co.poli([(0, 8), (2.5, 8), (3.5, 12), (0, 12)], verm)
    co.poli([(8, 8), (5.5, 8), (4.5, 12), (8, 12)], verm)
    for f in lados(t.braco):
        f.ret(0, 0, f.w, 2.5, verm)
        f.linha([(0, 2.5), (f.w, 2.5)], ouro, 1)
        f.ret(0, 8.5, f.w, 12, verm)
    t.braco["down"].acender(lambda f: f.elipse(2, 2, 1.4, 1.4, "#ffd24a"))
    for f in lados(t.perna):
        f.linha([(0.5, 0), (0.5, 12)], verm, 2)
    botas(t, verm, ouro)


def homem_formiga(t):
    verm, preto, prata = "#a3161c", "#1b1b20", "#9ea4ad"
    pintar_tudo(t, prata, verm, preto, preto, preto, verm)
    fr = t.cabeca["north"]
    fr.preencher(prata)
    fr.ret(0.6, 2.4, 7.4, 5.2, "#2a2a30")
    fr.acender(lambda f: (f.elipse(2.4, 3.8, 1.3, 1.2, "#ff2a35"), f.elipse(5.6, 3.8, 1.3, 1.2, "#ff2a35")))
    fr.ret(2.5, 5.8, 5.5, 7.6, "#3a3a40")
    for x in (2.9, 3.7, 4.5, 5.3):
        fr.ret(x, 6.0, x + 0.4, 7.4, "#7a7f88")
    for f in ("east", "west"):
        t.cabeca[f].elipse(4, 4.5, 1.6, 1.6, "#5a5f68", "#2a2a30", 2)
    co = t.corpo["north"]
    co.poli([(0, 0), (8, 0), (8, 4), (5, 6), (3, 6), (0, 4)], preto)
    co.elipse(4, 3, 1.4, 1.4, prata, "#5a5f68", 2)
    co.poli([(3.4, 2.4), (4.6, 2.4), (4.6, 3.6), (3.4, 3.6)], verm)
    cinto(t, prata, verm)
    for f in lados(t.braco):
        f.linha([(f.w / 2, 0), (f.w / 2, 12)], verm, 2)
    luvas(t, verm, 9)
    tubo = t.extra("peitoral", Cubo("body", [-3, 15, 3.2], [6, 7, 0.8], 0, "tanque"))
    tubo.todas(prata)


def vespa(t):
    preto, ouro, azul = "#16161c", "#e0b83a", "#1e3a7a"
    pintar_tudo(t, preto, preto, preto, preto, preto, ouro)
    fr = t.cabeca["north"]
    fr.acender(lambda f: (f.poli([(1.0, 2.6), (3.4, 3.2), (3.2, 4.8), (1.2, 4.2)], "#4fd6ff"),
                          f.poli([(7.0, 2.6), (4.6, 3.2), (4.8, 4.8), (6.8, 4.2)], "#4fd6ff")))
    fr.linha([(4, 0.4), (4, 2.4)], ouro, 2)
    fr.poli([(2.4, 6), (5.6, 6), (4, 7.8)], azul)
    for cubo in (t.corpo, t.braco, t.perna):
        for f in lados(cubo):
            for k in range(3):
                f.linha([(0, 2 + k * 3.5), (f.w, 3 + k * 3.5)], ouro, 1)
    for lado in (-1, 1):
        x0 = 0.4 if lado > 0 else -8.4
        asa = t.extra("peitoral", Cubo("body", [x0, 13, 3.3], [8, 11, 0.15], 0, "asa"))
        asa.todas((150, 215, 255, 175))
        for f in (asa["south"], asa["north"]):
            f.linha([(0, 11), (8, 0)], "#e8f8ff", 1)
            f.linha([(0, 11), (8, 5)], "#e8f8ff", 1)
            f.linha([(0, 11), (5, 11)], "#e0b83a", 1)


def falcao(t):
    cinza, cinza2, verm, preto = "#5c616b", "#3c4048", "#c02424", "#1d1d22"
    pintar_tudo(t, "#2a2420", cinza, cinza2, preto, preto, preto)
    cabelo_todo(t, "#1a1410")
    fr = t.cabeca["north"]
    rosto_humano(fr, "#8d5a3b", "#1a1410", olhos="#3a2a1c")
    fr.ret(1.0, 2.9, 7.0, 4.4, "#2a2a30")
    fr.acender(lambda f: (f.ret(1.4, 3.1, 3.6, 4.2, "#ff3030"), f.ret(4.4, 3.1, 6.6, 4.2, "#ff3030")))
    co = t.corpo["north"]
    co.poli([(0, 2), (8, 2), (8, 4), (0, 4)], verm)
    co.linha([(0.5, 0), (2.5, 12)], preto, 2)
    co.linha([(7.5, 0), (5.5, 12)], preto, 2)
    for lado in (-1, 1):
        x0 = 0.6 if lado > 0 else -13.6
        asa = t.extra("peitoral", Cubo("body", [x0, 9, 3.4], [13, 16, 0.4], 0, "asa"))
        asa.todas("#6f7480")
        for f in (asa["south"], asa["north"]):
            for k in range(9):
                x = k * 1.5 if lado < 0 else f.w - k * 1.5
                f.poli([(x, 0), (x + 1.3 * (-1 if lado > 0 else 1), 0), (x + 0.6, f.h - k * 1.2)], "#9ca2ad", "#3c4048")
            f.ret(0, 0, f.w, 1.0, "#c02424")
    botas(t, preto)


def soldado_invernal(t):
    preto, cinza, prata = "#1b1b20", "#2c2e34", "#b8bec8"
    pintar_tudo(t, "#2b2018", preto, preto, preto, preto, preto)
    cabelo_comprido(t, "#2b2018")
    fr = t.cabeca["north"]
    rosto_humano(fr, PELE, "#2b2018", olhos="#4a6a8a")
    fr.ret(0.8, 4.9, 7.2, 8, "#101014")
    fr.ret(1.6, 3.0, 3.4, 3.15, "#101014")
    for f in lados(t.corpo):
        f.linha([(0.5, 0), (7.5, 12)], cinza, 2)
        f.linha([(7.5, 0), (0.5, 12)], cinza, 2)
    cinto(t, cinza, prata)
    t.braco_e = Cubo("leftArm", [4, 12, -2], [4, 12, 4], 1.0, "braco_metal")
    for nome, f in t.braco_e.faces.items():
        f.preencher(prata)
        for y in range(1, 12):
            f.linha([(0, y), (f.w, y)], "#8a909a", 1)
    t.braco_e["east"].acender(lambda f: estrela(f, 2, 2.2, 1.2, "#e01f1f"))
    botas(t, "#101014")


def deadpool(t):
    verm, verm2, preto = "#a8121c", "#6a0a12", "#141418"
    pintar_tudo(t, verm, verm, verm, verm, verm, preto)
    fr = t.cabeca["north"]
    for lado in (-1, 1):
        cx = 4 + lado * 1.9
        fr.elipse(cx, 3.8, 1.8, 1.6, preto)
        fr.poli([(cx - 0.9, 3.4), (cx + 0.9, 3.6 - lado * 0.3), (cx + 0.6, 4.3), (cx - 0.7, 4.2)], "#ffffff")
    fr.linha([(4, 0), (4, 8)], verm2, 1)
    for f in lados(t.corpo):
        f.linha([(0, 0), (8, 9)], preto, 3)
        costuras(f, verm2, 2.0)
    cinto(t, preto, "#c9a227")
    for x in (0.2, 6.2):
        t.corpo["north"].ret(x, 10.2, x + 1.6, 12, "#2a2a30")
    luvas(t, preto, 9)
    for f in lados(t.braco):
        f.ret(0, 0, 1.2, 9, preto)
    for k, x in enumerate((-2.5, 1.5)):
        cabo = t.extra("peitoral", Cubo("body", [x, 22, 3.2], [1, 4, 1], 0, "katana"))
        cabo.todas("#2a2a30")
        lam = t.extra("peitoral", Cubo("body", [x + 0.25, 10, 3.35], [0.5, 12, 0.7], 0, "bainha"))
        lam.todas(preto)


def senhor_estrelas(t):
    jaqueta, jaq2, cinza, prata = "#7a2a1f", "#4e1a13", "#3a3a40", "#9ea4ad"
    pintar_tudo(t, prata, jaqueta, jaqueta, "#2d2a26", "#2d2a26", "#3a2a1c")
    fr = t.cabeca["north"]
    fr.preencher(prata)
    fr.ret(0, 0, 8, 1.2, "#5a5f68")
    for x in (1.2, 2.4, 5.6, 6.8):
        fr.linha([(x, 0), (x, 2.5)], "#2a2a30", 1)
    fr.poli([(0.8, 2.8), (3.4, 3.1), (3.2, 4.8), (1.0, 4.4)], "#1d1d22")
    fr.poli([(7.2, 2.8), (4.6, 3.1), (4.8, 4.8), (7.0, 4.4)], "#1d1d22")
    fr.acender(lambda f: (f.poli([(1.2, 3.1), (3.0, 3.35), (2.9, 4.4), (1.3, 4.1)], "#ff3030"),
                          f.poli([(6.8, 3.1), (5.0, 3.35), (5.1, 4.4), (6.7, 4.1)], "#ff3030")))
    for x in range(0, 6):
        fr.linha([(2.0 + x * 0.8, 5.6), (2.0 + x * 0.8, 7.6)], "#2a2a30", 1)
    co = t.corpo["north"]
    co.ret(2.6, 0, 5.4, 12, cinza)
    co.linha([(2.6, 0), (2.6, 12)], jaq2, 2)
    co.linha([(5.4, 0), (5.4, 12)], jaq2, 2)
    cinto(t, "#3a2a1c", prata)
    for f in lados(t.braco):
        f.linha([(0, 4), (f.w, 4)], jaq2, 1)
    luvas(t, "#3a2a1c", 10)
    botas(t, "#3a2a1c")


def groot(t):
    madeira, madeira2, folha = "#7a5532", "#4a321b", "#4f9a2c"
    pintar_tudo(t, madeira, madeira, madeira, madeira, madeira, madeira)
    import random
    rnd = random.Random(7)
    for cubo in (t.cabeca, t.corpo, t.braco, t.cintura, t.perna, t.bota):
        for f in cubo.faces.values():
            for _ in range(int(f.w * 3)):
                x = rnd.uniform(0, f.w)
                f.linha([(x, 0), (x + rnd.uniform(-0.8, 0.8), f.h)], madeira2, 1)
            for _ in range(int(f.w)):
                x, y = rnd.uniform(0, f.w), rnd.uniform(0, f.h)
                f.elipse(x, y, 0.4, 0.25, "#5c3c20")
    fr = t.cabeca["north"]
    fr.elipse(2.6, 4.0, 0.8, 0.7, "#2a1a0a")
    fr.elipse(5.4, 4.0, 0.8, 0.7, "#2a1a0a")
    fr.elipse(2.4, 3.8, 0.3, 0.3, "#d8b060")
    fr.elipse(5.2, 3.8, 0.3, 0.3, "#d8b060")
    fr.linha([(2.6, 6.2), (4, 6.6), (5.4, 6.2)], "#2a1a0a", 1)
    t.cabeca["up"].preencher(folha)
    for k in range(6):
        fo = t.extra("capacete", Cubo("head", [-4 + k * 1.4, 33, -1 + (k % 3)], [1.2, 1.0 + (k % 2), 1.2], 0, "folha"))
        fo.todas(folha if k % 2 else "#6abf3a")
    for lado in (-1, 1):
        fo = t.extra("peitoral", Cubo("body", [(-6 if lado < 0 else 4.5), 24, -1], [1.5, 1.2, 1.5], 0, "folha"))
        fo.todas(folha)


def flash(t):
    verm, verm2, amar = "#c8141c", "#8a0d13", "#f2c418"
    pintar_tudo(t, verm, verm, verm, verm, verm, amar)
    fr = t.cabeca["north"]
    fr.ret(1.0, 4.4, 7.0, 8, PELE)
    fr.poli([(1.0, 4.4), (3.4, 4.4), (4, 5.0), (4.6, 4.4), (7.0, 4.4), (7.0, 5.0), (1.0, 5.0)], verm)
    fr.ret(3.0, 6.6, 5.0, 6.9, "#a0584a")
    fr.poli([(1.3, 2.8), (3.4, 3.2), (3.2, 3.9), (1.4, 3.6)], "#ffffff")
    fr.poli([(6.7, 2.8), (4.6, 3.2), (4.8, 3.9), (6.6, 3.6)], "#ffffff")
    for f, s in (("east", 1), ("west", -1)):
        raio_simbolo(t.cabeca[f], 4, 3.5, 1.8, amar, "#a47a1f")
    for x0 in (-4.8, 4.0):
        asa = t.extra("capacete", Cubo("head", [x0, 27.5, -1], [0.8, 3, 2.2], 0, "raio"))
        asa.todas(amar)
    co = t.corpo["north"]
    co.elipse(4, 3.6, 2.3, 2.3, "#ffffff", amar, 2)
    raio_simbolo(co, 4, 3.6, 1.6, amar, "#a47a1f")
    cinto(t, amar, None, 9.8)
    for f in lados(t.corpo):
        f.linha([(0, 9.6), (2, 9.0), (3, 9.6)], amar, 1)
    for f in lados(t.braco):
        f.linha([(0, 9), (f.w, 10)], amar, 2)
    botas(t, amar, verm2)


# ------------------------------------------------------------------ X-Men
def wolverine(t):
    amar, azul, preto = "#f2c418", "#1f3fbf", "#1b1b1f"
    pintar_tudo(t, amar, amar, azul, azul, azul, "#5a3a22")
    fr = t.cabeca["north"]
    fr.preencher(amar)
    fr.poli([(0, 1.0), (1.5, 4.8), (3.4, 3.0), (3.6, 5.0), (0, 5.4)], preto)
    fr.poli([(8, 1.0), (6.5, 4.8), (4.6, 3.0), (4.4, 5.0), (8, 5.4)], preto)
    fr.ret(1.6, 3.6, 3.3, 4.3, "#ffffff")
    fr.ret(4.7, 3.6, 6.4, 4.3, "#ffffff")
    fr.ret(1.0, 5.2, 7.0, 8, PELE)
    fr.ret(2.8, 6.6, 5.2, 6.9, "#a0584a")
    for x0 in (-4.8, 4.0):
        f_ = t.extra("capacete", Cubo("head", [x0, 30, -1.5], [0.8, 4, 1.5], 0, "aleta"))
        f_.todas(preto)
    co = t.corpo["north"]
    co.poli([(0, 0), (2.5, 0), (4, 3.5), (5.5, 0), (8, 0), (8, 5), (6, 3), (4, 6.5), (2, 3), (0, 5)], azul)
    for y in (6.5, 8.0):
        co.poli([(0, y), (1.5, y + 0.3), (0, y + 0.8)], preto)
        co.poli([(8, y), (6.5, y + 0.3), (8, y + 0.8)], preto)
    cinto(t, "#c8141c", "#f2c418", 10.4)
    t.corpo["north"].poli([(3.4, 10.5), (4.6, 10.5), (4.6, 11.4), (3.4, 11.4)], "#1b1b1f")
    for f in lados(t.perna):
        f.ret(0, 0, f.w, 12, azul)
    for f in (t.perna["east"], t.perna["west"]):
        f.ret(0.8, 0, 3.2, 12, amar)
    luvas(t, azul, 9)
    for k in range(3):
        g = t.extra("peitoral", Cubo("rightArm", [-7.5 + k * 1.2, 6.3, -1.6], [0.3, 4.6, 0.3], 0, "garra"))
        g.todas("#e0e4ea")
        g2 = t.extra("peitoral", Cubo("leftArm", [4.5 + k * 1.2, 6.3, -1.6], [0.3, 4.6, 0.3], 0, "garra"))
        g2.todas("#e0e4ea")


def magneto(t):
    verm, verm2, roxo = "#a8121c", "#6a0a12", "#5b2a86"
    pintar_tudo(t, verm, verm, verm, roxo, roxo, verm)
    fr = t.cabeca["north"]
    fr.preencher(verm)
    fr.poli([(1.2, 2.2), (6.8, 2.2), (6.8, 8), (1.2, 8)], PELE)
    olho(fr, 2.8, 3.8, "#3d6cc8", 1)
    olho(fr, 5.2, 3.8, "#3d6cc8", -1)
    fr.poli([(3.7, 4.2), (4.3, 4.2), (4.5, 5.4), (3.5, 5.4)], clarear(PELE, -0.18))
    fr.ret(3.0, 6.3, 5.0, 6.6, "#a0584a")
    fr.poli([(3.0, 0), (5.0, 0), (4.6, 2.2), (3.4, 2.2)], verm2)
    cr = t.extra("capacete", Cubo("head", [-0.5, 32.5, -4.6], [1, 1.5, 9.2], 0, "crista"))
    cr.todas(verm2)
    co = t.corpo["north"]
    co.poli([(0, 0), (8, 0), (4, 7)], roxo)
    co.poli([(1.4, 0), (6.6, 0), (4, 5.2)], verm)
    capa(t, roxo, gola=roxo, y0=3)
    luvas(t, roxo, 9)
    botas(t, verm2, roxo)


def mistica(t):
    azul, azul2, ruivo = "#2f5fb3", "#1d3f80", "#c8361f"
    pintar_tudo(t, ruivo, azul, azul, azul, azul, azul)
    cabelo_todo(t, ruivo)
    fr = t.cabeca["north"]
    fr.preencher(azul)
    fr.ret(0, 0, 8, 1.6, ruivo)
    fr.ret(0, 1.6, 0.8, 5, ruivo)
    fr.ret(7.2, 1.6, 8, 5, ruivo)
    fr.acender(lambda f: (f.ret(1.9, 3.5, 3.2, 4.1, "#f2e23a"), f.ret(4.8, 3.5, 6.1, 4.1, "#f2e23a")))
    fr.ret(3.0, 6.2, 5.0, 6.5, azul2)
    import random
    rnd = random.Random(3)
    for cubo in (t.cabeca, t.corpo, t.braco, t.cintura, t.perna, t.bota):
        for nome, f in cubo.faces.items():
            if cubo is t.cabeca and nome != "north":
                continue
            for _ in range(int(f.w * f.h * 0.9)):
                x, y = rnd.uniform(0, f.w), rnd.uniform(0, f.h)
                if cubo is t.cabeca and (y < 1.8 or 3.2 < y < 4.4):
                    continue
                f.d.arc([(x - 0.4) * R, (y - 0.3) * R, (x + 0.4) * R, (y + 0.3) * R], 0, 180, fill=rgba(azul2))


def ciclope(t):
    azul, amar, azul2 = "#1e3a8a", "#f2c418", "#13275e"
    pintar_tudo(t, azul, azul, azul, azul, azul, amar)
    fr = t.cabeca["north"]
    fr.preencher(azul)
    fr.ret(1.0, 4.6, 7.0, 8, PELE)
    fr.ret(3.0, 6.6, 5.0, 6.9, "#a0584a")
    fr.ret(0, 2.8, 8, 4.6, "#c9a227")
    fr.acender(lambda f: f.ret(0.6, 3.2, 7.4, 4.2, "#ff2a35"))
    co = t.corpo["north"]
    co.poli([(0, 0), (2.5, 0), (4, 2.5), (5.5, 0), (8, 0), (8, 1.5), (4, 4.5), (0, 1.5)], amar)
    co.elipse(4, 11.1, 1.0, 0.9, "#c8141c", "#101010", 2)
    co.linha([(3.4, 10.5), (4.6, 11.7)], "#101010", 2)
    co.linha([(4.6, 10.5), (3.4, 11.7)], "#101010", 2)
    cinto(t, amar, None, 10.4)
    for f in lados(t.perna):
        f.linha([(0.6, 0), (0.6, 12)], amar, 2)
    luvas(t, amar, 9)


def jean_grey(t):
    verde, ouro, ruivo = "#2f8a3a", "#e8c040", "#c2301f"
    pintar_tudo(t, ruivo, verde, verde, verde, verde, ouro)
    cabelo_comprido(t, ruivo)
    rosto_humano(t.cabeca["north"], PELE, ruivo, olhos="#2f8a3a", boca="#c0303a")
    co = t.corpo["north"]
    co.poli([(4, 1.0), (1.0, 3.6), (2.6, 3.6), (4, 2.6), (5.4, 3.6), (7.0, 3.6)], ouro)
    co.poli([(3.4, 3.0), (4.6, 3.0), (4.4, 7.5), (4, 8.2), (3.6, 7.5)], ouro)
    cinto(t, ouro, None, 10.4)
    luvas(t, ouro, 8.5)
    t.braco["down"].acender(lambda f: f.elipse(2, 2, 1.4, 1.4, "#ff9a2a"))


def tempestade(t):
    preto, branco, ouro = "#1d1d22", "#eeeeee", "#d4a72c"
    pintar_tudo(t, branco, preto, preto, preto, preto, preto)
    cabelo_comprido(t, branco)
    fr = t.cabeca["north"]
    rosto_humano(fr, "#7a4a32", branco, olhos="#c0d8ff")
    fr.acender(lambda f: (f.ret(1.9, 3.45, 3.3, 3.95, "#ffffff"), f.ret(4.7, 3.45, 6.1, 3.95, "#ffffff")))
    fr.poli([(2.0, 1.6), (4, 0.8), (6.0, 1.6), (4, 1.4)], ouro)
    co = t.corpo["north"]
    co.poli([(0, 0), (8, 0), (4, 5)], "#2c2c34")
    co.elipse(4, 1.6, 1.0, 0.8, ouro)
    capa(t, "#2c2c34", "#1d1d22", y0=3)
    botas(t, preto, ouro)


def noturno(t):
    azul, azul2, verm, preto = "#3a4cb5", "#24306e", "#7a1520", "#1d1d22"
    pintar_tudo(t, "#1a1f4a", verm, preto, preto, preto, azul)
    cabelo_todo(t, "#1a1f4a")
    fr = t.cabeca["north"]
    fr.preencher(azul)
    fr.ret(0, 0, 8, 1.8, "#1a1f4a")
    fr.poli([(0, 1.8), (2.4, 1.8), (1.0, 3.2), (0, 3.4)], "#1a1f4a")
    fr.acender(lambda f: (f.ret(1.6, 3.4, 3.2, 4.1, "#ffe74a"), f.ret(4.8, 3.4, 6.4, 4.1, "#ffe74a")))
    fr.linha([(2.6, 6.2), (5.4, 6.2)], azul2, 1)
    fr.ret(2.8, 6.3, 3.2, 6.8, "#ffffff")
    fr.ret(4.8, 6.3, 5.2, 6.8, "#ffffff")
    for f in ("east", "west"):
        t.cabeca[f].poli([(3, 3), (5, 3), (4, 0.6)], azul)
    co = t.corpo["north"]
    co.poli([(0, 0), (8, 0), (8, 3), (4, 6), (0, 3)], preto)
    co.poli([(3, 6.5), (5, 6.5), (4, 9)], preto)
    luvas(t, azul, 9)
    rabo = t.extra("calca", Cubo("body", [-0.4, 3, 2.5], [0.8, 10, 0.8], 0, "rabo"))
    rabo.todas(azul2)
    ponta = t.extra("calca", Cubo("body", [-0.8, 2.2, 2.3], [1.6, 1.2, 1.2], 0, "ponta"))
    ponta.todas(azul2)


# ------------------------------------------------------------------ Quarteto Fantástico
def _quarteto(t, cabelo, olhos="#3d6cc8"):
    azul, azul2, preto = "#1f4fb3", "#14357a", "#1b1b20"
    pintar_tudo(t, cabelo, azul, azul, azul, azul, preto)
    cabelo_todo(t, cabelo)
    rosto_humano(t.cabeca["north"], PELE, cabelo, olhos=olhos)
    co = t.corpo["north"]
    emblema_4(co, 4, 3.6, 2.2, azul)
    for f in lados(t.corpo):
        f.linha([(0, 0.3), (f.w, 0.3)], preto, 2)
    cinto(t, preto, None, 10.6)
    luvas(t, preto, 9.5)
    for f in lados(t.braco):
        f.linha([(0, 0.5), (f.w, 0.5)], preto, 2)
    botas(t, preto)


def sr_fantastico(t):
    _quarteto(t, "#4a3524", "#5a4a3a")
    for f in ("east", "west"):
        t.cabeca[f].ret(2.5, 1.5, 6.5, 3.0, "#d0d0d0")


def mulher_invisivel(t):
    _quarteto(t, "#e3c26a")
    cabelo_comprido(t, "#e3c26a")
    rosto_humano(t.cabeca["north"], PELE, "#e3c26a", olhos="#3d6cc8", boca="#c06060")
    t.braco["down"].acender(lambda f: f.elipse(2, 2, 1.4, 1.4, "#9fd8ff"))


def tocha_humana(t):
    for i, cubo in enumerate((t.cabeca, t.corpo, t.braco, t.cintura, t.perna, t.bota)):
        for k, f in enumerate(cubo.faces.values()):
            f.acender(lambda ff, s=i * 10 + k: fogo(ff, s))
    fr = t.cabeca["north"]
    fr.acender(lambda f: (f.ret(1.8, 3.4, 3.3, 4.0, "#ffffff"), f.ret(4.7, 3.4, 6.2, 4.0, "#ffffff")))
    for k in range(5):
        ch = t.extra("capacete", Cubo("head", [-3.5 + k * 1.5, 32.5, -2 + (k % 2) * 2], [1.0, 1.5 + (k % 3), 1.0], 0, "chama"))
        for f in ch.faces.values():
            f.acender(lambda ff, s=k: fogo(ff, 100 + s))


def coisa(t):
    laranja, escuro, claro = "#cf6e2a", "#6a3010", "#f0a050"
    for i, cubo in enumerate((t.cabeca, t.corpo, t.braco, t.perna, t.bota)):
        for k, f in enumerate(cubo.faces.values()):
            pedras(f, laranja, escuro, claro, i * 10 + k)
    fr = t.cabeca["north"]
    fr.ret(1.2, 2.6, 6.8, 3.4, escuro)
    fr.ret(1.8, 3.4, 3.2, 4.2, "#ffffff")
    fr.ret(4.8, 3.4, 6.2, 4.2, "#ffffff")
    fr.ret(2.3, 3.5, 2.9, 4.2, "#3d6cc8")
    fr.ret(5.1, 3.5, 5.7, 4.2, "#3d6cc8")
    fr.ret(2.2, 5.8, 5.8, 6.4, escuro)
    for f in t.cintura.faces.values():
        f.preencher("#1f4fb3")
    emblema_4(t.cintura["north"], 4, 9.5, 1.6)
    for f in lados(t.perna):
        f.ret(0, 0, f.w, 3.5, "#1f4fb3")
        f.ret(0, 3.5, f.w, 12, laranja)
        pedras(f, laranja, escuro, claro, 99)
        f.ret(0, 0, f.w, 3.5, "#1f4fb3")


HEROIS_HD = {
    "homem_de_ferro": (homem_de_ferro, 1.0), "homem_aranha": (homem_aranha, 1.0),
    "capitao_america": (capitao_america, 1.0), "thor": (thor, 1.0), "hulk": (hulk, 1.7),
    "viuva_negra": (viuva_negra, 1.0), "gaviao_arqueiro": (gaviao_arqueiro, 1.0),
    "pantera_negra": (pantera_negra, 1.0), "doutor_estranho": (doutor_estranho, 1.0),
    "feiticeira_escarlate": (feiticeira_escarlate, 1.0), "visao": (visao, 1.0), "capita_marvel": (capita_marvel, 1.0),
    "homem_formiga": (homem_formiga, 1.0), "vespa": (vespa, 1.0), "falcao": (falcao, 1.0),
    "soldado_invernal": (soldado_invernal, 1.0), "deadpool": (deadpool, 1.0), "senhor_das_estrelas": (senhor_estrelas, 1.0),
    "groot": (groot, 1.15), "flash": (flash, 1.0), "wolverine": (wolverine, 1.0), "magneto": (magneto, 1.0),
    "mistica": (mistica, 1.0), "ciclope": (ciclope, 1.0), "jean_grey": (jean_grey, 1.0), "tempestade": (tempestade, 1.0),
    "noturno": (noturno, 1.0), "senhor_fantastico": (sr_fantastico, 1.0), "mulher_invisivel": (mulher_invisivel, 1.0),
    "tocha_humana": (tocha_humana, 1.0), "coisa": (coisa, 1.6),
}


def montar(hid):
    f, vol = HEROIS_HD[hid]
    t = Traje(vol)
    f(t)
    t.acabar()
    return t
