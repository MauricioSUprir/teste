"""Pacote de heróis para o Minecraft Bedrock (celular, PlayStation, Windows...).

Gera um pacote de comportamento (itens + script) e um pacote de recursos (texturas):
  - o Relógio dos Heróis: abre um menu para escolher o herói;
  - para cada herói, um traje (capacete, peitoral, calça e botas, desenhados aqui em pixel art)
    e os itens de poder (voar, raios, teia, martelo...), programados em scripts/main.js;
  - efeitos passivos de cada herói (força, velocidade, pulo...).

    python3 herois.py      -> saida/Herois.mcaddon e as pastas em addon/
"""
import json
import os
import shutil
import zipfile

import numpy as np
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
NS = "mv"
UUID = {
    "bp": "6a0c2f1e-41b7-4c6e-9d1a-3b5e7f9a1c20", "bp_dados": "9e7d1c3b-2a4f-4d6b-8e0f-1a3c5e7b9d21",
    "bp_script": "c3b5a7e9-1d2f-4a6c-8b0e-2d4f6a8c0e22", "rp": "2f4a6c8e-0b1d-4e3f-9a5c-7e9b1d3f5a23",
    "rp_mod": "5d7f9b1c-3e5a-4c7e-8f1b-3d5f7a9c1e24",
}
VERSAO = [1, 0, 0]
SERVER_API, UI_API = "2.1.0", "2.0.0"


def cor(h):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


# ------------------------------------------------------------------ pintura dos trajes
# Mapa UV clássico 64x32 (o mesmo das armaduras): (x, y, largura, altura) de cada face
PARTES = {
    "cabeca": {"topo": (8, 0, 8, 8), "baixo": (16, 0, 8, 8), "dir": (0, 8, 8, 8), "frente": (8, 8, 8, 8),
               "esq": (16, 8, 8, 8), "tras": (24, 8, 8, 8)},
    "corpo": {"topo": (20, 16, 8, 4), "baixo": (28, 16, 8, 4), "dir": (16, 20, 4, 12), "frente": (20, 20, 8, 12),
              "esq": (28, 20, 4, 12), "tras": (32, 20, 8, 12)},
    "braco": {"topo": (44, 16, 4, 4), "baixo": (48, 16, 4, 4), "dir": (40, 20, 4, 12), "frente": (44, 20, 4, 12),
              "esq": (48, 20, 4, 12), "tras": (52, 20, 4, 12)},
    "perna": {"topo": (4, 16, 4, 4), "baixo": (8, 16, 4, 4), "dir": (0, 20, 4, 12), "frente": (4, 20, 4, 12),
              "esq": (8, 20, 4, 12), "tras": (12, 20, 4, 12)},
}


class Traje:
    """Duas texturas 64x32: a camada 1 (capacete, peitoral, botas) e a 2 (calça)."""

    def __init__(self):
        self.c1 = np.zeros((32, 64, 4), np.uint8)
        self.c2 = np.zeros((32, 64, 4), np.uint8)

    def _img(self, camada):
        return self.c1 if camada == 1 else self.c2

    def parte(self, parte, c, camada=1, faces=None, linhas=None):
        """Pinta a parte inteira (ou só algumas faces / linhas de cima para baixo)."""
        img = self._img(camada)
        for nome, (x, y, w, h) in PARTES[parte].items():
            if faces and nome not in faces:
                continue
            y1, y2 = y, y + h
            if linhas and nome not in ("topo", "baixo"):
                y1, y2 = y + linhas[0], y + min(h, linhas[1])
            elif linhas and nome == "topo" and linhas[0] > 0:
                continue
            elif linhas and nome == "baixo" and linhas[1] < h:
                continue
            img[y1:y2, x:x + w] = cor(c)

    def desenho(self, parte, face, linhas, legenda, camada=1, x0=0, y0=0):
        """Pixel art numa face: `linhas` = lista de strings; cada letra é uma cor da legenda ('.' = mantém)."""
        img = self._img(camada)
        x, y, w, h = PARTES[parte][face]
        for r, linha in enumerate(linhas):
            for cc, ch in enumerate(linha):
                if ch != "." and r + y0 < h and cc + x0 < w:
                    img[y + y0 + r, x + x0 + cc] = cor(legenda[ch])

    def salvar(self, pasta, nome):
        os.makedirs(pasta, exist_ok=True)
        Image.fromarray(self.c1, "RGBA").save(os.path.join(pasta, f"{nome}_1.png"))
        Image.fromarray(self.c2, "RGBA").save(os.path.join(pasta, f"{nome}_2.png"))


def basico(t, cabeca, corpo, bracos, pernas, botas, luvas=None, calca_cintura=None, pele=None):
    """Traje base: cada parte de uma cor, luvas e botas nas pontas."""
    t.parte("cabeca", cabeca)
    t.parte("corpo", corpo)
    t.parte("braco", bracos)
    if luvas:
        t.parte("braco", luvas, linhas=(8, 12))
    t.parte("perna", botas, linhas=(8, 12))           # botas (camada 1, parte de baixo da perna)
    t.parte("corpo", calca_cintura or pernas, camada=2)
    t.parte("perna", pernas, camada=2)
    if pele:
        t.desenho("cabeca", "frente", ["........"] * 5 + ["SSSSSSSS", "SSSSSSSS", "SSSSSSSS"], {"S": pele})


PELE, PELE2 = "#e0ac8a", "#8d5a3b"


def _rosto_olhos(t, fundo, olho, contorno=None, linha=3):
    leg = {"O": olho, "C": contorno or fundo}
    t.desenho("cabeca", "frente", [".CCC.CCC" if contorno else "........",
                                   ".OOC.COO" if contorno else ".OO..OO.",
                                   ".COC.COC" if contorno else "........"], leg, y0=linha - 1)


# Cada herói: id, nome, desenho do traje, itens de poder e efeitos passivos ([efeito, nível]).
def ironman(t):
    basico(t, "#b11e1e", "#b11e1e", "#b11e1e", "#b11e1e", "#b11e1e", luvas="#d4a72c")
    t.desenho("cabeca", "frente", ["RRRRRRRR", "RGGGGGGR", "RGGGGGGR", "RCCGGCCR", "RGGGGGGR", "RGGGGGGR",
                                   "RRGGGGRR", "RRRGGRRR"], {"R": "#b11e1e", "G": "#d4a72c", "C": "#9ff3ff"})
    t.desenho("corpo", "frente", ["RRRRRRRR", "RGRRRRGR", "RRRBBRRR", "RRBWWBRR", "RRRBBRRR", "RRRRRRRR",
                                  "GGRRRRGG", "GRRRRRRG", "RRRRRRRR"], {"R": "#b11e1e", "G": "#d4a72c", "B": "#7fe7ff",
                                                                        "W": "#ffffff"})
    t.parte("perna", "#d4a72c", camada=2, linhas=(0, 5))


def homem_aranha(t):
    basico(t, "#c8102e", "#c8102e", "#c8102e", "#1f3fbf", "#c8102e")
    t.desenho("cabeca", "frente", ["RKRRRRKR", "KRRKKRRK", "KKWRRWKK", "KWWKKWWK", "RKWRRWKR", "RRKRRKRR",
                                   "RKRRRRKR", "KRRKKRRK"], {"R": "#c8102e", "K": "#222222", "W": "#ffffff"})
    for face in ("dir", "esq", "tras", "topo"):
        t.desenho("cabeca", face, ["RKRKRKRK", "KRRKRRKR", "RKRKRKRK", "KRRKRRKR"] * 2,
                  {"R": "#c8102e", "K": "#222222"})
    t.desenho("corpo", "frente", ["RKRRRRKR", "KRRKKRRK", "RRKKKKRR", "RKRKKRKR", "RRRKKRRR", "RRKRRKRR",
                                  "BRRRRRRB", "BBRRRRBB", "BBRRRRBB", "BBBRRBBB", "BBBRRBBB", "BBBBBBBB"],
              {"R": "#c8102e", "K": "#222222", "B": "#1f3fbf"})
    t.parte("corpo", "#1f3fbf", faces=("dir", "esq"))
    t.parte("braco", "#1f3fbf", faces=("dir", "tras"), linhas=(2, 9))
    t.parte("corpo", "#c8102e", camada=2, linhas=(0, 2))


def capitao(t):
    basico(t, "#1d3c8f", "#1d3c8f", "#1d3c8f", "#1d3c8f", "#a8151b", luvas="#a8151b", pele=PELE)
    t.desenho("cabeca", "frente", ["BBBWBBBB", "BBWBWBBB", "BBWWWBBB", "BWBBBWBB"], {"B": "#1d3c8f", "W": "#ffffff"})
    t.desenho("cabeca", "frente", [".BB..BB."], {"B": "#3a2a1c"}, y0=5)
    for face in ("dir", "esq"):
        t.desenho("cabeca", face, ["........", "........", "..WWWW..", "...WW..."], {"W": "#ffffff"})
    t.desenho("corpo", "frente", ["BBBBBBBB", "BBBWWBBB", "BBWWWWBB", "BBBWWBBB", "BBWBBWBB", "BBBBBBBB",
                                  "RWRWRWRW", "RWRWRWRW", "RWRWRWRW", "KKKKKKKK", "RWRWRWRW", "RWRWRWRW"],
              {"B": "#1d3c8f", "W": "#ffffff", "R": "#a8151b", "K": "#5a3a22"})


def thor(t):
    basico(t, "#e7c35a", "#3b3f46", "#3b3f46", "#2b2d33", "#4a4e57", luvas="#2b2d33")
    t.desenho("cabeca", "frente", ["YYYYYYYY", "YYYYYYYY", "YSSSSSSY", "SBBSSBBS", "SSSSSSSS", "SYYSSYYS",
                                   "YYYYYYYY", ".YYYYYY."], {"Y": "#d9b04a", "S": PELE, "B": "#3d6cc8"})
    t.desenho("corpo", "frente", ["GGGGGGGG", "GSGSGSGG", "GGGGGGGG", "GSGSGSGG", "GGGGGGGG", "GSGSGSGG",
                                  "GGGGGGGG", "GGGGGGGG", "KKKKKKKK", "GGGGGGGG"], {"G": "#3b3f46", "S": "#c9ced6",
                                                                                     "K": "#1c1d21"})
    t.parte("corpo", "#b3121b", faces=("tras",))                  # a capa vermelha


def hulk(t):
    verde = "#4f9a33"
    basico(t, verde, verde, verde, "#5b2a86", verde)
    t.desenho("cabeca", "frente", ["KKKKKKKK", "KKKKKKKK", "GKKGGKKG", "GWKGGKWG", "GGGGGGGG", "GGGDDGGG",
                                   "GDDDDDDG", "GGGGGGGG"], {"K": "#141414", "G": verde, "W": "#ffffff",
                                                             "D": "#2f5f1f"})
    t.parte("cabeca", "#141414", faces=("topo", "tras"))
    t.desenho("corpo", "frente", ["GGGGGGGG", "GDDGGDDG", "GGGGGGGG", "GGGDDGGG", "GGGDDGGG", "GGDGGDGG",
                                  "GGGDDGGG", "GGGGGGGG"], {"G": verde, "D": "#3d7a28"})
    t.parte("perna", "#5b2a86", camada=2)
    t.parte("perna", verde, camada=2, linhas=(9, 12))


def viuva(t):
    basico(t, "#b5371d", "#1b1b1f", "#1b1b1f", "#1b1b1f", "#1b1b1f", pele=PELE)
    t.desenho("cabeca", "frente", ["RRRRRRRR", "RRRRRRRR", "RSSSSSSR", "RBBSSBBR", "RSSSSSSR", "RSSRRSSR",
                                   "RSSSSSSR", "R.SSSS.R"], {"R": "#b5371d", "S": PELE, "B": "#2d5a3b"})
    t.desenho("corpo", "frente", ["........"] * 9 + ["KKKRRKKK"], {"K": "#555555", "R": "#d81e1e"})


def gaviao(t):
    basico(t, "#4a3524", "#2d2a33", "#5d3d7a", "#2d2a33", "#1b1b1f", luvas="#1b1b1f", pele=PELE)
    t.desenho("cabeca", "frente", ["HHHHHHHH", "HHHHHHHH", "HSSSSSSH", "SPPSSPPS"], {"H": "#4a3524", "S": PELE,
                                                                                    "P": "#5d3d7a"})
    t.desenho("corpo", "frente", ["PPKKKKPP", "PPKPPKPP", "PKKPPKKP"], {"P": "#5d3d7a", "K": "#2d2a33"})


def pantera(t):
    preto = "#16161a"
    basico(t, preto, preto, preto, preto, preto)
    t.desenho("cabeca", "frente", ["KPKKKKPK", "KKPKKPKK", "KWWKKWWK", "KKKPPKKK", "KKKKKKKK", "KKPPPPKK",
                                   "KKKKKKKK", "KKKKKKKK"], {"K": preto, "P": "#8a5cd6", "W": "#e8e8e8"})
    t.desenho("corpo", "frente", ["SKSKKSKS", "KSKSSKSK", "KKSKKSKK", "KKKPPKKK", "KKPKKPKK", "KKKPPKKK"],
              {"S": "#c0c4cc", "K": preto, "P": "#8a5cd6"})


def estranho(t):
    basico(t, "#2a2a2a", "#1f3b73", "#1f3b73", "#25262b", "#3a2a1c", luvas="#6e4a2c", pele=PELE)
    t.desenho("cabeca", "frente", ["HHHHHHHH", "WHHHHHHW", "WSSSSSSW", "SBBSSBBS", "SSSSSSSS", "SSHHHHSS",
                                   "SSHSSHSS", "..HHHH.."], {"H": "#2a2a2a", "W": "#9a9a9a", "S": PELE,
                                                             "B": "#3e6a4a"})
    t.desenho("corpo", "frente", ["CBBBBBBC", "CBBBBBBC", "CBBGGBBC", "CBBGGBBC", "CBBBBBBC", "CBBBBBBC",
                                  "CKKKKKKC", "CBBBBBBC"], {"C": "#b51d24", "B": "#1f3b73", "G": "#d4a72c",
                                                            "K": "#5a3a22"})
    t.parte("corpo", "#b51d24", faces=("tras", "dir", "esq"))      # a Capa da Levitação


def feiticeira(t):
    basico(t, "#7a1520", "#8f1b2a", "#1c1c22", "#1c1c22", "#5a1018", pele=PELE)
    t.desenho("cabeca", "frente", ["HRRRRRRH", "HRHRRHRH", "HSRSSRSH", "HBBSSBBH", "HSSSSSSH", "HSSRRSSH",
                                   "HSSSSSSH", "H.SSSS.H"], {"H": "#6b2a1f", "R": "#c21f35", "S": PELE,
                                                             "B": "#3e6a4a"})


def visao(t):
    basico(t, "#b52532", "#2f6b3a", "#2f6b3a", "#2f6b3a", "#2f6b3a", luvas="#d9b04a")
    t.desenho("cabeca", "frente", ["RRRRRRRR", "RRRYYRRR", "RRRYYRRR", "RBBRRBBR", "RRRRRRRR", "RRGGGGRR",
                                   "RRRRRRRR", "RRRRRRRR"], {"R": "#b52532", "Y": "#f2d23a", "B": "#5be3ff",
                                                             "G": "#7a121c"})
    t.desenho("corpo", "frente", ["YGGGGGGY", "GYGGGGYG", "GGYGGYGG", "GGGYYGGG"], {"Y": "#d9b04a", "G": "#2f6b3a"})
    t.parte("corpo", "#d9b04a", faces=("tras",))


def capita_marvel(t):
    basico(t, "#e3c26a", "#1f3a8a", "#1f3a8a", "#1f3a8a", "#b0161f", luvas="#b0161f", pele=PELE)
    t.desenho("cabeca", "frente", ["YYYYYYYY", "YYYYYYYY", "YSSSSSSY", "YBBSSBBY", "YSSSSSSY", "YSSRRSSY",
                                   "YSSSSSSY", "Y.SSSS.Y"], {"Y": "#e3c26a", "S": PELE, "B": "#3d6cc8",
                                                             "R": "#c0504d"})
    t.desenho("corpo", "frente", ["RRBBBBRR", "RRRGGRRR", "BRGGGGRB", "BBRGGRBB", "BBRBBRBB", "BBBBBBBB",
                                  "BBBBBBBB", "RRRRRRRR"], {"R": "#b0161f", "B": "#1f3a8a", "G": "#e8c040"})


def homem_formiga(t):
    basico(t, "#8c8f96", "#a3161c", "#1b1b1f", "#1b1b1f", "#a3161c", luvas="#a3161c")
    t.desenho("cabeca", "frente", ["SSSSSSSS", "SSSSSSSS", "SRRSSRRS", "SRRSSRRS", "SSSSSSSS", "SSKKKKSS",
                                   "SSKSSKSS", "SSSSSSSS"], {"S": "#8c8f96", "R": "#e2202a", "K": "#3a3a3a"})
    t.desenho("corpo", "frente", ["RRKKKKRR", "RKKKKKKR", "KKKSSKKK", "KKSSSSKK", "KKKSSKKK"],
              {"R": "#a3161c", "K": "#1b1b1f", "S": "#c0c4cc"})


def vespa(t):
    basico(t, "#2b2b30", "#2b2b30", "#2b2b30", "#2b2b30", "#c9a227", luvas="#c9a227")
    t.desenho("cabeca", "frente", ["KKKKKKKK", "KYKKKKYK", "KYYKKYYK", "KYYKKYYK", "KKKKKKKK", "KKKKKKKK",
                                   "KKYYYYKK", "KKKKKKKK"], {"K": "#2b2b30", "Y": "#e8c84a"})
    t.desenho("corpo", "frente", ["YKKKKKKY", "KYKKKKYK", "KKYKKYKK", "KKKYYKKK", "KKKYYKKK"],
              {"Y": "#e8c84a", "K": "#2b2b30"})


def falcao(t):
    basico(t, "#3a3a40", "#5c5f68", "#3a3a40", "#3a3a40", "#2b2b30", pele=PELE2)
    t.desenho("cabeca", "frente", ["KKKKKKKK", "KKKKKKKK", "KRRRRRRK", "KRRKKRRK", "SSSSSSSS"],
              {"K": "#2b2b30", "R": "#d02a2a", "S": PELE2})
    t.desenho("corpo", "frente", ["SSSSSSSS", "SRRSSRRS", "SSSRRSSS", "SSSSSSSS"], {"S": "#5c5f68",
                                                                                  "R": "#c02424"})
    t.parte("corpo", "#9aa0aa", faces=("tras",))                  # as asas dobradas


def soldado(t):
    basico(t, "#2b2018", "#1f2024", "#1f2024", "#1f2024", "#141414", pele=PELE)
    t.desenho("cabeca", "frente", ["HHHHHHHH", "HHHHHHHH", "HSSSSSSH", "HKKSSKKH", "HKKKKKKH", "HKKKKKKH",
                                   "HKKKKKKH", "H.SSSS.H"], {"H": "#2b2018", "S": PELE, "K": "#141414"})
    t.parte("braco", "#b8bcc4", faces=("dir", "frente", "esq", "tras", "topo"))   # o braço de metal
    t.desenho("braco", "frente", ["....", "RRRR", ".RR.", "R..R"], {"R": "#c0161f"}, y0=1)


def deadpool(t):
    basico(t, "#a8121c", "#a8121c", "#a8121c", "#a8121c", "#1b1b1f", luvas="#1b1b1f")
    t.desenho("cabeca", "frente", ["RRRRRRRR", "RRRKKRRR", "KKKRRKKK", "KWWKKWWK", "KKKRRKKK", "RRRRRRRR",
                                   "RRRRRRRR", "RRRRRRRR"], {"R": "#a8121c", "K": "#141414", "W": "#ffffff"})
    t.desenho("corpo", "frente", ["RRRRRRKK", "RRRRRKKR", "RRRRKKRR", "RRRKKRRR", "RRKKRRRR", "RKKRRRRR",
                                  "KKRRRRRR", "RRRRRRRR", "KKKKKKKK"], {"R": "#a8121c", "K": "#141414"})
    t.parte("corpo", "#1b1b1f", camada=2, linhas=(0, 2))


def senhor_estrelas(t):
    basico(t, "#4a4c52", "#7a2a1f", "#7a2a1f", "#2d2a26", "#3a2a1c")
    t.desenho("cabeca", "frente", ["SSSSSSSS", "SKKKKKKS", "SRRKKRRS", "SRRKKRRS", "SKKKKKKS", "SSKKKKSS",
                                   "SSSKKSSS", "SSSSSSSS"], {"S": "#4a4c52", "K": "#1b1b1f", "R": "#e2202a"})
    t.desenho("corpo", "frente", ["RRRBBRRR", "RRBBBBRR", "RRBBBBRR", "RRRBBRRR"], {"R": "#7a2a1f",
                                                                                  "B": "#2d2a26"})


def groot(t):
    madeira, folha = "#6e4b2a", "#3f8a2c"
    basico(t, madeira, madeira, madeira, madeira, madeira)
    t.desenho("cabeca", "frente", ["LLLMLLLM", "MMMMMMMM", "MDMMMMDM", "MKDMMDKM", "MMMMMMMM", "MMDDDDMM",
                                   "MMMMMMMM", "MDMMMMDM"], {"L": folha, "M": madeira, "D": "#4a321b",
                                                             "K": "#20140a"})
    t.parte("cabeca", folha, faces=("topo",))
    for parte in ("corpo", "braco", "perna"):
        for camada in (1, 2):
            if parte == "braco" and camada == 2:
                continue
            t.desenho(parte, "frente", ["M.D.", ".D..", "..D.", "D..M"] * 3, {"M": "#7d5733", "D": "#4a321b"},
                      camada=camada)


def flash(t):
    verm, amar = "#c8141c", "#f2c418"
    basico(t, verm, verm, verm, verm, amar)
    t.desenho("cabeca", "frente", ["RRRRRRRR", "RRRRRRRR", "RWWRRWWR", "RRRRRRRR", "SSSSSSSS", "SSSSSSSS",
                                   "SSSSSSSS", "SSSSSSSS"], {"R": verm, "W": "#ffffff", "S": PELE})
    for face in ("dir", "esq"):
        t.desenho("cabeca", face, ["...Y....", "..YY....", ".YYYYY..", "...YY...", "...Y...."], {"Y": amar})
    t.desenho("corpo", "frente", ["RRRRRRRR", "RRWWWWRR", "RWWYWWWR", "RWYYYWWR", "RWWYYYWR", "RWWWYWWR",
                                  "RRWWWWRR", "RRRRRRRR", "YYYYYYYY"], {"R": verm, "W": "#ffffff", "Y": amar})


def wolverine(t):
    amar, azul = "#f2c418", "#1f3fbf"
    basico(t, amar, amar, azul, azul, "#5a3a22", luvas=azul)
    t.desenho("cabeca", "frente", ["YKYYYYKY", "YKKYYKKY", "KWWKKWWK", "KKKKKKKK", "SSSSSSSS", "SSSSSSSS",
                                   "SSSSSSSS", "SSSSSSSS"], {"Y": amar, "K": "#1b1b1f", "W": "#ffffff", "S": PELE})
    t.desenho("corpo", "frente", ["BBYYYYBB", "BYYYYYYB", "YYYYYYYY", "BBYYYYBB", "YBBYYBBY", "YYYYYYYY",
                                  "YYYYYYYY", "RRRRRRRR"], {"Y": amar, "B": azul, "R": "#c8141c"})
    t.parte("perna", azul, camada=2)
    t.parte("perna", amar, camada=2, faces=("dir", "esq"))


def magneto(t):
    verm, roxo = "#a8121c", "#5b2a86"
    basico(t, verm, verm, verm, roxo, verm, luvas=roxo, pele=PELE)
    t.desenho("cabeca", "frente", ["RRRRRRRR", "RRRRRRRR", "RRSSSSRR", "RBBSSBBR", "RSSSSSSR", "RSSKKSSR",
                                   "RSSSSSSR", "RSSSSSSR"], {"R": verm, "S": PELE, "B": "#3d6cc8", "K": "#a06a50"})
    t.parte("corpo", roxo, faces=("tras",))
    t.desenho("corpo", "frente", ["PPRRRRPP", "PRRRRRRP", "RRRRRRRR"], {"P": roxo, "R": verm})


def mistica(t):
    azul, verm = "#2f5fb3", "#c8361f"
    basico(t, azul, azul, azul, azul, azul)
    t.desenho("cabeca", "frente", ["HHHHHHHH", "HHHHHHHH", "HAAAAAAH", "HYYAAYYH", "HAAAAAAH", "HAAKKAAH",
                                   "HAAAAAAH", "H.AAAA.H"], {"H": verm, "A": azul, "Y": "#f2d23a", "K": "#1d3f7a"})
    t.parte("cabeca", verm, faces=("topo", "tras"))
    t.desenho("corpo", "frente", ["ADAADAAD", "DAADAADA", "AADAADAA"] * 4, {"A": azul, "D": "#244a8a"})


def ciclope(t):
    azul, amar = "#1f3a8a", "#f2c418"
    basico(t, azul, azul, azul, azul, amar, luvas=amar)
    t.desenho("cabeca", "frente", ["BBBBBBBB", "BBBBBBBB", "RRRRRRRR", "RRRRRRRR", "SSSSSSSS", "SSSSSSSS",
                                   "SSSKKSSS", "SSSSSSSS"], {"B": azul, "R": "#e21f2a", "S": PELE, "K": "#a06a50"})
    t.desenho("corpo", "frente", ["BYYBBYYB", "BBYBBYBB", "BBBBBBBB", "BBBBBBBB", "BBBBBBBB", "BBBBBBBB",
                                  "BBBBBBBB", "YYYXYYYY"], {"B": azul, "Y": amar, "X": "#c8141c"})


def jean(t):
    verde, ouro = "#2f8a3a", "#e8c040"
    basico(t, "#c2301f", verde, verde, verde, ouro, luvas=ouro, pele=PELE)
    t.desenho("cabeca", "frente", ["RRRRRRRR", "RRRRRRRR", "RSSSSSSR", "RGGSSGGR", "RSSSSSSR", "RSSPPSSR",
                                   "RSSSSSSR", "RRSSSSRR"], {"R": "#c2301f", "S": PELE, "G": "#2f8a3a",
                                                             "P": "#d06a60"})
    t.desenho("corpo", "frente", ["GGGOOGGG", "GGOOOOGG", "GOOGGOOG", "GGGGGGGG", "GGGGGGGG", "GGGGGGGG",
                                  "GGGGGGGG", "OOOOOOOO"], {"G": verde, "O": ouro})


def tempestade(t):
    preto = "#1d1d22"
    basico(t, "#eeeeee", preto, preto, preto, preto, pele=PELE2)
    t.desenho("cabeca", "frente", ["WWWWWWWW", "WWWWWWWW", "WSSSSSSW", "WEESSEEW", "WSSSSSSW", "WSSKKSSW",
                                   "WSSSSSSW", "W.SSSS.W"], {"W": "#eeeeee", "S": PELE2, "E": "#f0f0f0",
                                                             "K": "#5a3020"})
    t.desenho("corpo", "frente", ["KYYKKYYK", "KKYKKYKK"], {"K": preto, "Y": "#e8c040"})
    t.parte("corpo", "#2c2c34", faces=("tras",))


def noturno(t):
    azul = "#24306e"
    basico(t, "#1a1f4a", "#7a1520", "#1d1d22", "#1d1d22", azul, luvas=azul)
    t.desenho("cabeca", "frente", ["HHHHHHHH", "HHHHHHHH", "HAAAAAAH", "AYYAAYYA", "AAAAAAAA", "AAWAAWAA",
                                   "AAAAAAAA", "AAAAAAAA"], {"H": "#1a1f4a", "A": "#3a4cb5", "Y": "#f2e23a",
                                                             "W": "#ffffff"})
    t.desenho("corpo", "frente", ["RRKKKKRR", "RRRKKRRR", "KRRRRRRK", "KKRRRRKK"], {"R": "#7a1520", "K": "#1d1d22"})


def quarteto(t, cabelo, pele=PELE):
    azul = "#2a4fa8"
    basico(t, cabelo, azul, azul, azul, "#1b1b1f", luvas="#e8e8e8", pele=pele)
    t.desenho("cabeca", "frente", ["HHHHHHHH", "HHHHHHHH", "HSSSSSSH", "SBBSSBBS", "SSSSSSSS", "SSSKKSSS",
                                   "SSSSSSSS", ".SSSSSS."], {"H": cabelo, "S": pele, "B": "#3d6cc8", "K": "#a06a50"})
    t.desenho("corpo", "frente", ["BBBBBBBB", "BBWBBWBB", "BBWBBWBB", "BBWWWWBB", "BBBBBWBB", "BBBBBWBB",
                                  "BBBBBBBB", "BBBBBBBB", "KKKKKKKK"], {"B": azul, "W": "#ffffff", "K": "#1b1b1f"})


def sr_fantastico(t):
    quarteto(t, "#4a3524")
    t.desenho("cabeca", "frente", ["WHHHHHHW", "WHHHHHHW", "W"], {"W": "#cfcfcf", "H": "#4a3524"})


def mulher_invisivel(t):
    quarteto(t, "#e3c26a")


def tocha(t):
    fogo = ["#ffb000", "#ff7a00", "#ff4a00", "#ffd040"]
    basico(t, fogo[1], fogo[1], fogo[1], fogo[1], fogo[2])
    for parte, faces in (("cabeca", PARTES["cabeca"]), ("corpo", PARTES["corpo"]), ("braco", PARTES["braco"]),
                         ("perna", PARTES["perna"])):
        for face, (x, y, w, h) in faces.items():
            for camada in (1, 2):
                img = t._img(camada)
                for yy in range(h):
                    for xx in range(w):
                        if img[y + yy, x + xx, 3]:
                            img[y + yy, x + xx] = cor(fogo[(xx * 3 + yy * 5 + x) % 4])
    t.desenho("cabeca", "frente", ["........", "........", ".WW..WW.", "........"], {"W": "#ffffff"})


def coisa(t):
    pedra = ["#d0702a", "#b85e22", "#e58a3e"]
    basico(t, pedra[0], pedra[0], pedra[0], "#2a4fa8", pedra[0])
    for parte in ("cabeca", "corpo", "braco", "perna"):
        for face, (x, y, w, h) in PARTES[parte].items():
            for camada in (1, 2):
                img = t._img(camada)
                for yy in range(h):
                    for xx in range(w):
                        px = img[y + yy, x + xx]
                        if px[3] and tuple(px[:3]) == cor(pedra[0])[:3]:
                            borda = (xx % 3 == 0) or (yy % 3 == 0)
                            img[y + yy, x + xx] = cor(pedra[1] if borda else pedra[(xx + yy) % 3])
    t.desenho("cabeca", "frente", ["........", "........", ".KB..BK.", "........", "........", ".KKKKKK."],
              {"K": "#5a2a10", "B": "#3d6cc8"})
    t.desenho("perna", "frente", ["BBBB", "BWWB", "BBBB"], {"B": "#2a4fa8", "W": "#ffffff"}, camada=2)


HEROIS = [
    # id, nome, desenho, poderes, efeitos passivos, cor do ícone
    ("homem_de_ferro", "Homem de Ferro", ironman, ["voo", "repulsor", "missil"], [], "#b11e1e"),
    ("homem_aranha", "Homem-Aranha", homem_aranha, ["teia", "balanco"], [["jump_boost", 2], ["speed", 1]], "#c8102e"),
    ("capitao_america", "Capitão América", capitao, ["escudo"], [["resistance", 1], ["strength", 1]], "#1d3c8f"),
    ("thor", "Thor", thor, ["mjolnir", "voo_martelo"], [["resistance", 1], ["strength", 1]], "#3b3f46"),
    ("hulk", "Hulk", hulk, ["esmagar", "salto_hulk"], [["strength", 3], ["resistance", 2], ["health_boost", 4]],
     "#4f9a33"),
    ("viuva_negra", "Viúva Negra", viuva, ["choque", "agilidade"], [["speed", 1], ["jump_boost", 1]], "#1b1b1f"),
    ("gaviao_arqueiro", "Gavião Arqueiro", gaviao, ["flecha", "flecha_explosiva"], [], "#5d3d7a"),
    ("pantera_negra", "Pantera Negra", pantera, ["garras_vibranium", "pulso_cinetico"],
     [["speed", 1], ["jump_boost", 1], ["resistance", 1]], "#16161a"),
    ("doutor_estranho", "Doutor Estranho", estranho, ["portal", "escudo_magico", "raio_mistico"],
     [["slow_falling", 0]], "#1f3b73"),
    ("feiticeira_escarlate", "Feiticeira Escarlate", feiticeira, ["magia_caos", "levitar"], [], "#8f1b2a"),
    ("visao", "Visão", visao, ["raio_joia", "levitar", "atravessar"], [["resistance", 1]], "#b52532"),
    ("capita_marvel", "Capitã Marvel", capita_marvel, ["voo", "rajada_fotonica"], [["strength", 2], ["resistance", 1]],
     "#1f3a8a"),
    ("homem_formiga", "Homem-Formiga", homem_formiga, ["encolher", "crescer"], [["speed", 1]], "#a3161c"),
    ("vespa", "Vespa", vespa, ["voo", "ferrao"], [["speed", 1]], "#c9a227"),
    ("falcao", "Falcão", falcao, ["voo", "drone"], [["slow_falling", 0]], "#5c5f68"),
    ("soldado_invernal", "Soldado Invernal", soldado, ["soco_metal", "granada"], [["strength", 1]], "#1f2024"),
    ("deadpool", "Deadpool", deadpool, ["katanas", "teleporte"], [["regeneration", 1]], "#a8121c"),
    ("senhor_das_estrelas", "Senhor das Estrelas", senhor_estrelas, ["blaster", "jato"], [], "#7a2a1f"),
    ("groot", "Groot", groot, ["raizes", "cura_groot"], [["resistance", 2], ["regeneration", 0]], "#6e4b2a"),
    ("flash", "Flash", flash, ["supervelocidade", "raio_veloz"], [["speed", 4], ["haste", 2]], "#c8141c"),
    ("wolverine", "Wolverine", wolverine, ["garras", "furia"], [["regeneration", 2], ["strength", 1]], "#f2c418"),
    ("magneto", "Magneto", magneto, ["campo_magnetico", "levitar"], [["resistance", 1]], "#a8121c"),
    ("mistica", "Mística", mistica, ["disfarce", "agilidade"], [["speed", 1]], "#2f5fb3"),
    ("ciclope", "Ciclope", ciclope, ["rajada_optica"], [], "#1f3a8a"),
    ("jean_grey", "Jean Grey", jean, ["telecinese", "fenix"], [["slow_falling", 0]], "#2f8a3a"),
    ("tempestade", "Tempestade", tempestade, ["voo", "relampago", "ventania"], [], "#1d1d22"),
    ("noturno", "Noturno", noturno, ["teleporte"], [["jump_boost", 2]], "#24306e"),
    ("senhor_fantastico", "Senhor Fantástico", sr_fantastico, ["esticar", "balanco"], [], "#2a4fa8"),
    ("mulher_invisivel", "Mulher Invisível", mulher_invisivel, ["invisivel", "campo_forca"], [], "#2a4fa8"),
    ("tocha_humana", "Tocha Humana", tocha, ["voo", "bola_de_fogo"], [["fire_resistance", 0]], "#ff7a00"),
    ("coisa", "O Coisa", coisa, ["esmagar", "soco_metal"], [["strength", 3], ["resistance", 3]], "#d0702a"),
]

# Poderes: id -> (nome, cor do ícone, símbolo do ícone, recarga em segundos)
PODERES = {
    "voo": ("Voar", "#ffd040", "seta", 0.6), "repulsor": ("Raio Repulsor", "#7fe7ff", "raio", 0.8),
    "missil": ("Míssil", "#d02a2a", "bola", 4), "teia": ("Teia", "#ffffff", "teia", 0.8),
    "balanco": ("Balançar na Teia", "#c8102e", "seta", 0.5), "escudo": ("Escudo do Capitão", "#1d3c8f", "escudo", 1.5),
    "mjolnir": ("Mjolnir (raio)", "#9aa0aa", "martelo", 2), "voo_martelo": ("Girar o Martelo (voar)", "#c0c4cc", "seta", 0.6),
    "esmagar": ("HULK ESMAGA!", "#4f9a33", "punho", 3), "salto_hulk": ("Salto Gigante", "#5b2a86", "seta", 2),
    "choque": ("Ferrão da Viúva", "#ffe14a", "raio", 1), "agilidade": ("Acrobacia", "#ffffff", "seta", 1),
    "flecha": ("Flecha", "#c0a070", "flecha", 0.5), "flecha_explosiva": ("Flecha Explosiva", "#d02a2a", "flecha", 3),
    "garras_vibranium": ("Garras de Vibranium", "#8a5cd6", "garra", 0.6), "pulso_cinetico": ("Pulso Cinético", "#b28aff", "bola", 3),
    "portal": ("Portal", "#ff9a1e", "anel", 2), "escudo_magico": ("Escudo Místico", "#ffb040", "anel", 4),
    "raio_mistico": ("Raio Místico", "#ff9a1e", "raio", 1), "magia_caos": ("Magia do Caos", "#e2203a", "bola", 1),
    "levitar": ("Levitar", "#d0d0ff", "seta", 1), "raio_joia": ("Raio da Joia da Mente", "#f2d23a", "raio", 1),
    "atravessar": ("Atravessar Paredes", "#b52532", "anel", 2), "rajada_fotonica": ("Rajada Fotônica", "#f2c418", "raio", 0.8),
    "encolher": ("Encolher", "#a3161c", "bola", 2), "crescer": ("Gigante", "#e2202a", "punho", 4),
    "ferrao": ("Ferrão", "#e8c84a", "raio", 0.8), "drone": ("Drone Asa Vermelha", "#d02a2a", "bola", 3),
    "soco_metal": ("Soco de Metal", "#b8bcc4", "punho", 1), "granada": ("Granada", "#4a5a2a", "bola", 4),
    "katanas": ("Katanas", "#c0c4cc", "garra", 0.5), "teleporte": ("Teletransporte", "#7a4cff", "anel", 1),
    "blaster": ("Blaster Elemental", "#ff6a2a", "raio", 0.6), "jato": ("Botas a Jato", "#ffb000", "seta", 0.6),
    "raizes": ("Raízes", "#6e4b2a", "garra", 2), "cura_groot": ("Eu Sou Groot (cura)", "#3f8a2c", "anel", 6),
    "supervelocidade": ("Supervelocidade", "#f2c418", "seta", 4), "raio_veloz": ("Raio da Força de Aceleração", "#ffe14a", "raio", 1),
    "garras": ("Garras de Adamantium", "#d0d4dc", "garra", 0.4), "furia": ("Fúria Berserker", "#c8141c", "punho", 8),
    "campo_magnetico": ("Campo Magnético", "#a8121c", "anel", 2), "disfarce": ("Disfarce", "#2f5fb3", "anel", 5),
    "rajada_optica": ("Rajada Óptica", "#e21f2a", "raio", 0.6), "telecinese": ("Telecinese", "#e04aff", "anel", 1),
    "fenix": ("Força Fênix", "#ff7a00", "bola", 10), "relampago": ("Relâmpago", "#ffffff", "raio", 1.5),
    "ventania": ("Ventania", "#d0e8ff", "anel", 2), "esticar": ("Braço Elástico", "#2a4fa8", "punho", 0.6),
    "invisivel": ("Ficar Invisível", "#a0c8ff", "anel", 3), "campo_forca": ("Campo de Força", "#7fb4ff", "anel", 3),
    "bola_de_fogo": ("Bola de Fogo", "#ff4a00", "bola", 0.8),
}
ICONES = {
    "seta": ["....XX..", "...XXXX.", "..XXXXXX", "....XX..", "....XX..", "....XX..", "....XX..", "........"],
    "raio": ["....XXX.", "...XXX..", "..XXX...", ".XXXXXX.", "...XXX..", "..XXX...", ".XXX....", "........"],
    "bola": ["..XXXX..", ".XXXXXX.", "XXXXXXXX", "XXXXXXXX", "XXXXXXXX", "XXXXXXXX", ".XXXXXX.", "..XXXX.."],
    "teia": ["X..X..X.", ".X.X.X..", "..XXX...", "XXXXXXX.", "..XXX...", ".X.X.X..", "X..X..X.", "........"],
    "escudo": ["..XXXX..", ".X....X.", "X..XX..X", "X.XXXX.X", "X..XX..X", ".X....X.", "..XXXX..", "........"],
    "martelo": [".XXXXXX.", ".XXXXXX.", ".XXXXXX.", "...XX...", "...XX...", "...XX...", "...XX...", "........"],
    "punho": ["........", ".XXXXX..", "XXXXXXX.", "XXXXXXX.", "XXXXXXX.", ".XXXXX..", "..XXX...", "........"],
    "flecha": ["......XX", ".....XXX", "....XX..", "...XX...", "..XX....", "XXX.....", "XX......", "........"],
    "garra": ["X.X.X...", "X.X.X...", "X.X.X...", "X.X.X...", "XXXXX...", "XXXXX...", ".XXX....", "........"],
    "anel": ["..XXXX..", ".X....X.", "X......X", "X......X", "X......X", "X......X", ".X....X.", "..XXXX.."],
}


# ------------------------------------------------------------------ geração
def _icone(caminho, desenho, c_fundo, c_simbolo="#ffffff"):
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    px = img.load()
    for y in range(16):
        for x in range(16):
            if 1 <= x <= 14 and 1 <= y <= 14:
                px[x, y] = cor(c_fundo)
    for r, linha in enumerate(desenho):
        for cc, ch in enumerate(linha):
            if ch == "X":
                for a in (0, 1):
                    for b in (0, 1):
                        px[cc * 2 + a, r * 2 + b] = cor(c_simbolo)
    img.save(caminho)


def _icone_peca(caminho, peca, c):
    formas = {
        "capacete": ["........", ".XXXXXX.", "XXXXXXXX", "XX....XX", "XX....XX", "........", "........", "........"],
        "peitoral": ["XX....XX", "XXXXXXXX", "XXXXXXXX", ".XXXXXX.", ".XXXXXX.", ".XXXXXX.", ".XXXXXX.", "........"],
        "calca": [".XXXXXX.", ".XXXXXX.", ".XX..XX.", ".XX..XX.", ".XX..XX.", ".XX..XX.", ".XX..XX.", "........"],
        "botas": ["........", "........", ".XX..XX.", ".XX..XX.", ".XX..XX.", "XXX.XXX.", "XXX.XXX.", "........"],
    }
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    px = img.load()
    for r, linha in enumerate(formas[peca]):
        for cc, ch in enumerate(linha):
            if ch == "X":
                for a in (0, 1):
                    for b in (0, 1):
                        px[cc * 2 + a, r * 2 + b] = cor(c)
    img.save(caminho)


PECAS = [("capacete", "head", "slot.armor.head", "helmet", 1),
         ("peitoral", "chest", "slot.armor.chest", "chestplate", 1),
         ("calca", "legs", "slot.armor.legs", "leggings", 2),
         ("botas", "feet", "slot.armor.feet", "boots", 1)]


def _w(caminho, dados):
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    with open(caminho, "w", encoding="utf-8") as f:
        if isinstance(dados, str):
            f.write(dados)
        else:
            json.dump(dados, f, indent=1, ensure_ascii=False)


def gerar(destino=None):
    destino = destino or os.path.join(AQUI, "addon")
    bp, rp = os.path.join(destino, "Herois_BP"), os.path.join(destino, "Herois_RP")
    shutil.rmtree(destino, ignore_errors=True)
    # manifestos
    _w(os.path.join(bp, "manifest.json"), {
        "format_version": 2,
        "header": {"name": "Heróis Marvel (e o Flash)", "description": "31 heróis com trajes e poderes",
                   "uuid": UUID["bp"], "version": VERSAO, "min_engine_version": [1, 21, 0]},
        "modules": [{"type": "data", "uuid": UUID["bp_dados"], "version": VERSAO},
                    {"type": "script", "language": "javascript", "uuid": UUID["bp_script"], "version": VERSAO,
                     "entry": "scripts/main.js"}],
        "dependencies": [{"module_name": "@minecraft/server", "version": SERVER_API},
                         {"module_name": "@minecraft/server-ui", "version": UI_API},
                         {"uuid": UUID["rp"], "version": VERSAO}]})
    _w(os.path.join(rp, "manifest.json"), {
        "format_version": 2,
        "header": {"name": "Heróis Marvel (texturas)", "description": "Trajes e ícones dos heróis",
                   "uuid": UUID["rp"], "version": VERSAO, "min_engine_version": [1, 21, 0]},
        "modules": [{"type": "resources", "uuid": UUID["rp_mod"], "version": VERSAO}]})
    texturas_itens = {}
    lang = []
    # o relógio
    _icone(os.path.join(rp, "textures", "items", "relogio.png"), ICONES["anel"], "#d4a72c", "#1b1b1f")
    texturas_itens[f"{NS}:relogio"] = {"textures": "textures/items/relogio"}
    _w(os.path.join(bp, "items", "relogio.json"), {
        "format_version": "1.21.40",
        "minecraft:item": {"description": {"identifier": f"{NS}:relogio", "menu_category": {"category": "equipment"}},
                           "components": {"minecraft:icon": f"{NS}:relogio", "minecraft:max_stack_size": 1,
                                          "minecraft:display_name": {"value": "§6Relógio dos Heróis"},
                                          "minecraft:glint": True, "minecraft:use_modifiers": {"use_duration": 0.1}}}})
    lang.append(f"item.{NS}:relogio=Relógio dos Heróis")
    # trajes
    for hid, nome, desenho, poderes, _, c_ic in HEROIS:
        t = Traje()
        desenho(t)
        t.salvar(os.path.join(rp, "textures", "models", "armor"), hid)
        for peca, eq, slot, geo, camada in PECAS:
            iid = f"{NS}:{hid}_{peca}"
            icone = os.path.join(rp, "textures", "items", f"{hid}_{peca}.png")
            os.makedirs(os.path.dirname(icone), exist_ok=True)
            _icone_peca(icone, peca, c_ic)
            texturas_itens[iid] = {"textures": f"textures/items/{hid}_{peca}"}
            _w(os.path.join(bp, "items", "trajes", f"{hid}_{peca}.json"), {
                "format_version": "1.21.40",
                "minecraft:item": {
                    "description": {"identifier": iid, "menu_category": {"category": "equipment"}},
                    "components": {
                        "minecraft:icon": iid, "minecraft:max_stack_size": 1,
                        "minecraft:display_name": {"value": f"{nome}: {peca}"},
                        "minecraft:wearable": {"slot": slot, "protection": 4 if peca == "peitoral" else 3},
                        "minecraft:durability": {"max_durability": 100000},
                        "minecraft:tags": {"tags": ["minecraft:is_armor"]}}}})
            visivel = {"head": "helmet", "chest": "chest", "legs": "leg", "feet": "boot"}[eq]
            _w(os.path.join(rp, "attachables", f"{hid}_{peca}.json"), {
                "format_version": "1.8.0",
                "minecraft:attachable": {"description": {
                    "identifier": iid,
                    "materials": {"default": "armor", "enchanted": "armor_enchanted"},
                    "textures": {"default": f"textures/models/armor/{hid}_{camada}",
                                 "enchanted": "textures/misc/enchanted_actor_glint"},
                    "geometry": {"default": f"geometry.humanoid.armor.{geo}"},
                    "scripts": {"parent_setup": f"variable.{visivel}_layer_visible = 0.0;"},
                    "render_controllers": ["controller.render.armor"]}}})
            lang.append(f"item.{iid}={nome}: {peca}")
    # poderes
    for pid, (nome, c_ic, simbolo, recarga) in PODERES.items():
        iid = f"{NS}:poder_{pid}"
        _icone(os.path.join(rp, "textures", "items", f"poder_{pid}.png"), ICONES[simbolo], c_ic,
               "#1b1b1f" if c_ic in ("#ffffff", "#ffe14a", "#f2c418", "#ffd040", "#e8c84a", "#d0e8ff", "#d0d0ff")
               else "#ffffff")
        texturas_itens[iid] = {"textures": f"textures/items/poder_{pid}"}
        _w(os.path.join(bp, "items", "poderes", f"{pid}.json"), {
            "format_version": "1.21.40",
            "minecraft:item": {"description": {"identifier": iid, "menu_category": {"category": "equipment"}},
                               "components": {"minecraft:icon": iid, "minecraft:max_stack_size": 1,
                                              "minecraft:display_name": {"value": f"§b{nome}"},
                                              "minecraft:use_modifiers": {"use_duration": 0.1},
                                              "minecraft:cooldown": {"category": f"{NS}_{pid}", "duration": recarga}}}})
        lang.append(f"item.{iid}={nome}")
    _w(os.path.join(rp, "textures", "item_texture.json"),
       {"resource_pack_name": "herois", "texture_name": "atlas.items", "texture_data": texturas_itens})
    for pasta in (bp, rp):
        _w(os.path.join(pasta, "texts", "pt_BR.lang"), "\n".join(lang) + "\n")
        _w(os.path.join(pasta, "texts", "en_US.lang"), "\n".join(lang) + "\n")
        _w(os.path.join(pasta, "texts", "languages.json"), ["pt_BR", "en_US"])
    # o script
    dados = [{"id": h[0], "nome": h[1], "poderes": h[3], "efeitos": h[4]} for h in HEROIS]
    nomes_poderes = {k: v[0] for k, v in PODERES.items()}
    js = open(os.path.join(AQUI, "herois_main.js"), encoding="utf-8").read()
    js = js.replace("/*HEROIS*/[]", json.dumps(dados, ensure_ascii=False))
    js = js.replace("/*NOMES_PODERES*/{}", json.dumps(nomes_poderes, ensure_ascii=False))
    _w(os.path.join(bp, "scripts", "main.js"), js)
    # ícone do pacote (o relógio)
    for pasta in (bp, rp):
        Image.open(os.path.join(rp, "textures", "items", "relogio.png")).resize((64, 64), Image.NEAREST).save(
            os.path.join(pasta, "pack_icon.png"))
    # .mcaddon
    saida = os.path.join(AQUI, "saida", "Herois.mcaddon")
    with zipfile.ZipFile(saida, "w", zipfile.ZIP_DEFLATED) as zf:
        for pasta in (bp, rp):
            for raiz, _, arquivos in os.walk(pasta):
                for a in arquivos:
                    p = os.path.join(raiz, a)
                    zf.write(p, os.path.relpath(p, destino))
    return bp, rp, saida


if __name__ == "__main__":
    print(gerar())
