"""Modelos 3D detalhados (trajes, vilões e artefatos) para o Minecraft Bedrock.

Cada modelo é uma lista de cubos presos aos ossos do corpo (head, body, rightArm, leftArm,
rightLeg, leftLeg). Cada face de cada cubo tem a sua própria imagem, pintada aqui com resolução
R pixels por unidade (R = 4: a frente da cabeça tem 32 x 32 pixels). As faces são juntadas num
atlas (uma textura por personagem) e cada cubo aponta para o seu pedaço com "uv" por face.

Também tem um renderizador simples, para ver o modelo em 3D (prévia em PNG).
"""
import math
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

R = 4                                    # pixels por unidade
FACES = ("north", "south", "east", "west", "up", "down")
# tamanho (largura, altura) de cada face em unidades, para um cubo (w, h, d)
TAM = {"north": lambda w, h, d: (w, h), "south": lambda w, h, d: (w, h), "east": lambda w, h, d: (d, h),
       "west": lambda w, h, d: (d, h), "up": lambda w, h, d: (w, d), "down": lambda w, h, d: (w, d)}
PIVOS = {"head": [0, 24, 0], "body": [0, 24, 0], "rightArm": [-5, 22, 0], "leftArm": [5, 22, 0],
         "rightLeg": [-1.9, 12, 0], "leftLeg": [1.9, 12, 0], "root": [0, 0, 0]}
PAIS = {"head": "body", "rightArm": "body", "leftArm": "body", "body": "root", "rightLeg": "root",
        "leftLeg": "root"}


def rgba(c, a=255):
    if isinstance(c, tuple):
        return c if len(c) == 4 else (*c, a)
    c = c.lstrip("#")
    return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), a)


def mistura(c1, c2, t):
    a, b = rgba(c1), rgba(c2)
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(4))


def clarear(c, k):
    return mistura(c, "#ffffff", k) if k > 0 else mistura(c, "#000000", -k)


class Face:
    """Uma face de cubo, com desenho em coordenadas de unidade (0..w, 0..h, y para baixo)."""

    def __init__(self, w, h, nome):
        self.w, self.h, self.nome = w, h, nome
        self.img = Image.new("RGBA", (max(1, round(w * R)), max(1, round(h * R))), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.img)
        self.brilho = None                    # máscara do que brilha (não leva sombra)

    def _p(self, x, y):
        return (x * R, y * R)

    def preencher(self, c):
        self.d.rectangle([0, 0, self.img.width, self.img.height], fill=rgba(c))
        return self

    def degrade(self, c1, c2, vertical=True):
        W, H = self.img.size
        for i in range(H if vertical else W):
            t = i / max(1, (H if vertical else W) - 1)
            cor = mistura(c1, c2, t)
            if vertical:
                self.d.line([(0, i), (W, i)], fill=cor)
            else:
                self.d.line([(i, 0), (i, H)], fill=cor)
        return self

    def ret(self, x0, y0, x1, y1, c):
        a0, b0 = round(x0 * R), round(y0 * R)
        a1, b1 = max(a0, round(x1 * R) - 1), max(b0, round(y1 * R) - 1)
        self.d.rectangle([a0, b0, a1, b1], fill=rgba(c))
        return self

    def poli(self, pts, c, contorno=None):
        self.d.polygon([self._p(*p) for p in pts], fill=rgba(c), outline=rgba(contorno) if contorno else None)
        return self

    def elipse(self, cx, cy, rx, ry, c, contorno=None, larg=1):
        self.d.ellipse([(cx - rx) * R, (cy - ry) * R, (cx + rx) * R - 1, (cy + ry) * R - 1], fill=rgba(c) if c else None,
                       outline=rgba(contorno) if contorno else None, width=larg)
        return self

    def linha(self, pts, c, larg=1):
        self.d.line([self._p(*p) for p in pts], fill=rgba(c), width=larg)
        return self

    def pixel(self, x, y, c):
        if 0 <= x < self.img.width and 0 <= y < self.img.height:
            self.img.putpixel((int(x), int(y)), rgba(c))
        return self

    def acender(self, desenho):
        """Desenha algo que brilha (olhos, reator...): não recebe sombra no acabamento."""
        if self.brilho is None:
            self.brilho = Image.new("L", self.img.size, 0)
        antes = np.array(self.img).copy()
        desenho(self)
        depois = np.array(self.img)
        mudou = (antes != depois).any(axis=2)
        b = np.array(self.brilho)
        b[mudou] = 255
        self.brilho = Image.fromarray(b)
        return self


class Cubo:
    def __init__(self, osso, origem, tamanho, inflar=0.0, nome=""):
        self.osso, self.origem, self.tamanho, self.inflar, self.nome = osso, list(origem), list(tamanho), inflar, nome
        w, h, d = tamanho
        self.faces = {f: Face(*TAM[f](w, h, d), f) for f in FACES}
        self.esconder = set()

    def __getitem__(self, f):
        return self.faces[f]

    def todas(self, c):
        for f in self.faces.values():
            f.preencher(c)
        return self


def acabamento(cubo, forca=1.0, ruido=0.04, semente=0):
    """Sombras de volume: mais claro em cima, mais escuro embaixo e nas bordas, e uma textura leve."""
    rnd = np.random.default_rng(semente)
    for nome, f in cubo.faces.items():
        a = np.array(f.img).astype(float)
        if a[:, :, 3].max() == 0:
            continue
        H, W = a.shape[:2]
        yy, xx = np.mgrid[0:H, 0:W]
        luz = {"up": 1.12, "north": 1.0, "south": 0.9, "east": 0.94, "west": 0.94, "down": 0.75}[nome]
        if nome not in ("up", "down"):
            luz = luz * (1.06 - 0.16 * yy / max(1, H - 1))
        borda = np.minimum(np.minimum(xx, W - 1 - xx), np.minimum(yy, H - 1 - yy))
        luz = luz * (0.86 + 0.14 * np.clip(borda / (R * 0.75), 0, 1))
        luz = luz * (1 + ruido * rnd.standard_normal((H, W)))
        luz = 1 + (luz - 1) * forca
        if f.brilho is not None:
            b = np.array(f.brilho) > 0
            luz = np.where(b, 1.0, luz)
        a[:, :, :3] = np.clip(a[:, :, :3] * luz[:, :, None], 0, 255)
        f.img = Image.fromarray(a.astype(np.uint8))


def espelhar_membro(cubo, osso, origem):
    """Cópia espelhada de um braço/perna (o lado esquerdo a partir do direito)."""
    novo = Cubo(osso, origem, cubo.tamanho, cubo.inflar, cubo.nome)
    for f in FACES:
        src = {"east": "west", "west": "east"}.get(f, f)
        novo.faces[f].img = cubo.faces[src].img.transpose(Image.FLIP_LEFT_RIGHT)
        if cubo.faces[src].brilho is not None:
            novo.faces[f].brilho = cubo.faces[src].brilho.transpose(Image.FLIP_LEFT_RIGHT)
    novo.esconder = set(cubo.esconder)
    return novo


# ------------------------------------------------------------------ atlas e geometria Bedrock
def atlas(cubos):
    """Junta todas as faces numa textura (prateleiras) e devolve a imagem e as posições."""
    itens = []
    for i, c in enumerate(cubos):
        for f in FACES:
            if f in c.esconder:
                continue
            itens.append((c.faces[f].img.height, c.faces[f].img.width, i, f))
    itens.sort(key=lambda t: (-t[0], -t[1]))
    largura = 256
    while sum(w * h for h, w, _, _ in itens) > largura * largura * 0.7:
        largura *= 2
    x = y = alt_fila = 0
    pos = {}
    for h, w, i, f in itens:
        if x + w > largura:
            x, y, alt_fila = 0, y + alt_fila, 0
        pos[(i, f)] = (x, y, w, h)
        x += w
        alt_fila = max(alt_fila, h)
    altura = 1
    while altura < y + alt_fila:
        altura *= 2
    img = Image.new("RGBA", (largura, altura), (0, 0, 0, 0))
    for (i, f), (x, y, w, h) in pos.items():
        img.paste(cubos[i].faces[f].img, (x, y))
    return img, pos


def geometria(ident, cubos, pos, tam_tex, ossos=None, pais=False, limites=4):
    """JSON de geometria Bedrock (formato 1.12.0) com UV por face."""
    ossos = ossos or sorted({c.osso for c in cubos}, key=lambda o: list(PIVOS).index(o) if o in PIVOS else 99)
    lista = []
    for o in ossos:
        b = {"name": o, "pivot": PIVOS.get(o, [0, 0, 0]), "cubes": []}
        if pais and PAIS.get(o) in ossos:
            b["parent"] = PAIS[o]
        for i, c in enumerate(cubos):
            if c.osso != o:
                continue
            uv = {}
            for f in FACES:
                if (i, f) in pos:
                    x, y, w, h = pos[(i, f)]
                    uv[f] = {"uv": [x, y], "uv_size": [w, h]}
            cub = {"origin": [round(v, 3) for v in c.origem], "size": [round(v, 3) for v in c.tamanho], "uv": uv}
            if c.inflar:
                cub["inflate"] = c.inflar
            b["cubes"].append(cub)
        lista.append(b)
    return {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": ident, "texture_width": tam_tex[0], "texture_height": tam_tex[1],
                        "visible_bounds_width": limites, "visible_bounds_height": limites,
                        "visible_bounds_offset": [0, limites / 2, 0]},
        "bones": lista}]}


def icone(cubos, tamanho=64, angulo=-30, escala=16):
    """Vista 3D dos cubos, recortada e centralizada num quadrado transparente."""
    img = _render1(cubos, angulo, escala, (0, 0, 0, 0), None)
    img = img.crop(img.getbbox())
    lado = max(img.size)
    q = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    q.paste(img, ((lado - img.width) // 2, (lado - img.height) // 2))
    return q.resize((tamanho, tamanho), Image.LANCZOS) if tamanho else q


# ------------------------------------------------------------------ prévia 3D
def render(cubos, caminho, angulos=(-30, 150), escala=14, fundo=(205, 225, 245, 255), pose=None):
    """Desenha o modelo de frente (meio de lado) e de costas, lado a lado."""
    quadros = []
    for ang in angulos:
        quadros.append(_render1(cubos, ang, escala, fundo, pose))
    W = sum(q.width for q in quadros)
    H = max(q.height for q in quadros)
    out = Image.new("RGBA", (W, H), fundo)
    x = 0
    for q in quadros:
        out.paste(q, (x, 0))
        x += q.width
    out.save(caminho)
    return out


def _render1(cubos, ang_y, escala, fundo, pose):
    a = math.radians(ang_y)
    inc = math.radians(-12)

    def proj(p):
        x, y, z = p
        x2 = x * math.cos(a) - z * math.sin(a)
        z2 = x * math.sin(a) + z * math.cos(a)
        y2 = y * math.cos(inc) - z2 * math.sin(inc)
        z3 = y * math.sin(inc) + z2 * math.cos(inc)
        return x2, y2, z3

    poligonos = []
    for c in cubos:
        i = c.inflar
        x0, y0, z0 = (c.origem[k] - i for k in range(3))
        x1, y1, z1 = (c.origem[k] + c.tamanho[k] + i for k in range(3))
        # cantos de cada face, na ordem (canto da imagem: cima-esq, cima-dir, baixo-dir, baixo-esq)
        # (a imagem é a face vista de fora; na frente, a esquerda da imagem é o lado direito do
        # personagem, que no Bedrock fica em -x)
        cantos = {
            "north": [(x0, y1, z0), (x1, y1, z0), (x1, y0, z0), (x0, y0, z0)],
            "south": [(x1, y1, z1), (x0, y1, z1), (x0, y0, z1), (x1, y0, z1)],
            "east": [(x1, y1, z0), (x1, y1, z1), (x1, y0, z1), (x1, y0, z0)],
            "west": [(x0, y1, z1), (x0, y1, z0), (x0, y0, z0), (x0, y0, z1)],
            "up": [(x0, y1, z1), (x1, y1, z1), (x1, y1, z0), (x0, y1, z0)],
            "down": [(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)],
        }
        normais = {"north": (0, 0, -1), "south": (0, 0, 1), "east": (1, 0, 0), "west": (-1, 0, 0),
                   "up": (0, 1, 0), "down": (0, -1, 0)}
        for f, pts in cantos.items():
            if f in c.esconder or c.faces[f].img.getextrema()[3][1] == 0:
                continue
            n = proj(normais[f])
            if n[2] > 0.0001:                  # de costas para a câmera (a câmera olha para +z)
                continue
            pp = [proj(p) for p in pts]
            # profundidade sem a inclinação da câmera (evita que faces paralelas e próximas,
            # como capa e costas, troquem de ordem por causa da altura)
            prof = sum(p[0] * math.sin(a) + p[2] * math.cos(a) for p in pts) / 4
            poligonos.append((prof, pp, c.faces[f].img))
    poligonos.sort(key=lambda t: -t[0])
    W, H = 22 * escala, 40 * escala
    img = Image.new("RGBA", (W, H), fundo)
    for _, pp, tex in poligonos:
        quad = [(W / 2 + p[0] * escala, H * 0.86 - p[1] * escala) for p in pp]
        # mapeamento afim da textura para o paralelogramo (cantos 0, 1, 3)
        (ax, ay), (bx, by), _, (dx, dy) = quad
        tw, th = tex.size
        m = np.array([[bx - ax, dx - ax], [by - ay, dy - ay]]) / np.array([[tw, th], [tw, th]])
        try:
            inv = np.linalg.inv(m)
        except np.linalg.LinAlgError:
            continue
        coef = (inv[0, 0], inv[0, 1], -(inv[0, 0] * ax + inv[0, 1] * ay),
                inv[1, 0], inv[1, 1], -(inv[1, 0] * ax + inv[1, 1] * ay))
        t = tex.transform((W, H), Image.AFFINE, coef, resample=Image.NEAREST)
        mask = Image.new("L", (W, H), 0)
        ImageDraw.Draw(mask).polygon(quad, fill=255)
        alpha = Image.fromarray(np.minimum(np.array(mask), np.array(t.split()[3])))
        img.paste(t, (0, 0), alpha)
    return img
