"""Os estádios: Maracanã e São Januário, em tamanho real (1 bloco = 1 metro).

Feitos a partir de fotos e plantas reais:
  Maracanã     oval de 316 x 272 m, arquibancada única com o anel de camarotes no meio,
               cadeiras amarelas, azuis e brancas, cobertura branca de membrana (anel com a
               abertura sobre o campo), fachada de pilares e vidro, quatro níveis de circulação,
               tribuna de imprensa e de honra, cabines de rádio/TV, vestiários, sala de coletiva,
               a passarela elevada que chega da praça, a estátua do Bellini, o Maracanãzinho
               e o parque aquático.
  São Januário a fachada neocolonial de 118 m (Ricardo Severo, 1927) com o frontão de
               azulejos e o escudo, a social coberta, a curva com a Cruz de Malta, a
               arquibancada preta com VASCO escrito, o lado aberto com o placar, as torres de
               luz, a estátua do Romário, a sala de troféus, o salão nobre, a sala de imprensa,
               as cabines e os vestiários.

Cada estádio é um modelo próprio (modelo.configurar) com o centro do campo em (0, 0) e o
eixo comprido do campo ao longo de x. O chão fica em y = -1 e é preservado ("manter") onde
nada é construído; por isso só o que muda vira comando.
"""
import math
import random

import numpy as np

import modelo as m
from modelo import put, get, box

ESTR = "light_gray_concrete"     # estrutura de concreto
PISO = "polished_andesite"

# --------------------------------------------------------------------- letras
FONTE = {
    "A": "01110 10001 10001 11111 10001 10001 10001", "B": "11110 10001 10001 11110 10001 10001 11110",
    "C": "01111 10000 10000 10000 10000 10000 01111", "D": "11110 10001 10001 10001 10001 10001 11110",
    "E": "11111 10000 10000 11110 10000 10000 11111", "F": "11111 10000 10000 11110 10000 10000 10000",
    "G": "01111 10000 10000 10011 10001 10001 01111", "H": "10001 10001 10001 11111 10001 10001 10001",
    "I": "11111 00100 00100 00100 00100 00100 11111", "J": "00111 00010 00010 00010 00010 10010 01100",
    "K": "10001 10010 10100 11000 10100 10010 10001", "L": "10000 10000 10000 10000 10000 10000 11111",
    "M": "10001 11011 10101 10101 10001 10001 10001", "N": "10001 11001 10101 10011 10001 10001 10001",
    "O": "01110 10001 10001 10001 10001 10001 01110", "P": "11110 10001 10001 11110 10000 10000 10000",
    "Q": "01110 10001 10001 10001 10101 10010 01101", "R": "11110 10001 10001 11110 10100 10010 10001",
    "S": "01111 10000 10000 01110 00001 00001 11110", "T": "11111 00100 00100 00100 00100 00100 00100",
    "U": "10001 10001 10001 10001 10001 10001 01110", "V": "10001 10001 10001 10001 10001 01010 00100",
    "W": "10001 10001 10001 10101 10101 11011 10001", "X": "10001 10001 01010 00100 01010 10001 10001",
    "Y": "10001 10001 01010 00100 00100 00100 00100", "Z": "11111 00001 00010 00100 01000 10000 11111",
    "0": "01110 10011 10101 10101 11001 10001 01110", "1": "00100 01100 00100 00100 00100 00100 01110",
    "2": "01110 10001 00001 00010 00100 01000 11111", "3": "11110 00001 00001 01110 00001 00001 11110",
    "<": "00010 00100 01000 11111 01000 00100 00010", ">": "01000 00100 00010 11111 00010 00100 01000",
    "-": "00000 00000 00000 11111 00000 00000 00000", " ": "00000 00000 00000 00000 00000 00000 00000",
}
ACENTOS = {"Ã": ("A", ["01101", "10110"]), "Á": ("A", ["00010", "00100"])}


def pixels(texto):
    """Lista de (coluna, linha) acesas; linha 0 = base do texto. Acentos ficam acima (linhas 8-9)."""
    out, coluna = [], 0
    for ch in texto:
        base, acento = ACENTOS.get(ch, (ch, None))
        for r, linha in enumerate(FONTE[base].split()):
            for c, bit in enumerate(linha):
                if bit == "1":
                    out.append((coluna + c, 6 - r))
        if acento:
            for r, linha in enumerate(acento):
                for c, bit in enumerate(linha):
                    if bit == "1":
                        out.append((coluna + c, 9 - r))
        coluna += 6
    return out, coluna - 1


def escrever(texto, origem, u, cor, escala=1, fundo=None, margem=1):
    """Escreve num plano vertical: `u` = direção da leitura (dx, dz); origem = canto de baixo à esquerda.

    Quem olha o texto de frente tem `u` à sua direita. Devolve a largura em blocos.
    """
    px, largura = pixels(texto)
    ox, oy, oz = origem
    ux, uz = u
    if fundo:
        for c in range(-margem, largura * escala + margem):
            for r in range(-margem, 10 * escala + margem):
                put(ox + ux * c, oy + r, oz + uz * c, fundo)
    for c, r in px:
        for a in range(escala):
            for b in range(escala):
                cc, rr = c * escala + a, r * escala + b
                put(ox + ux * cc, oy + rr, oz + uz * cc, cor)
    return largura * escala


def em_cruz(i, j, raio):
    """A Cruz de Malta (cruz pátea do Vasco): braços que se alargam para as pontas."""
    ai, aj = abs(i), abs(j)
    if max(ai, aj) > raio:
        return False
    return (ai >= aj and aj <= 1 + ai * 0.55) or (aj >= ai and ai <= 1 + aj * 0.55)


# --------------------------------------------------------------------- utilidades
def _chao():
    """Tudo de y = -1 para baixo fica como está no mundo (grama, terra, pedra)."""
    m.grid[:, : -1 - m.YMIN + 1, :] = m.KEEP


def col(x, z, y1, y2, b):
    if y2 >= y1:
        box(x, y1, z, x, y2, z, b)


def virado(dx, dz):
    """Direção cardeal mais próxima do vetor (dx, dz)."""
    if abs(dx) >= abs(dz):
        return "east" if dx > 0 else "west"
    return "south" if dz > 0 else "north"


def espelhar_estado(b):
    return b.replace("east", "@").replace("west", "east").replace("@", "west")


def palmeira(x, z, altura=7):
    col(x, z, 0, altura - 1, "jungle_log")
    t = altura
    put(x, t, z, "jungle_leaves")
    put(x, t - 1, z, "jungle_leaves")
    for dx, dz in m.DIRS.values():
        for k in (1, 2):
            put(x + dx * k, t, z + dz * k, "jungle_leaves")
        put(x + dx * 3, t - 1, z + dz * 3, "jungle_leaves")
    for dx, dz in ((1, 1), (1, -1), (-1, 1), (-1, -1)):
        put(x + dx, t, z + dz, "jungle_leaves")
        put(x + 2 * dx, t - 1, z + 2 * dz, "jungle_leaves")


def arvore(x, z, altura=5):
    col(x, z, 0, altura - 1, "oak_log")
    for dx in range(-2, 3):
        for dz in range(-2, 3):
            for dy in (-1, 0, 1):
                if abs(dx) + abs(dz) + abs(dy) <= 3 and (dx, dz) != (0, 0):
                    if get(x + dx, altura + dy, z + dz) == "minecraft:air":
                        put(x + dx, altura + dy, z + dz, "oak_leaves")
    put(x, altura, z, "oak_leaves")
    put(x, altura + 1, z, "oak_leaves")


def poste(x, z, altura=6):
    col(x, z, 0, altura - 1, "iron_bars")
    put(x, altura, z, "sea_lantern")


def lance(p0, u, lado, f1, f2, largura=2, mat="polished_andesite"):
    """Lance de escada do piso f1 até o piso f2, começando em p0 e subindo na direção u."""
    face = virado(*u)
    for k in range(f2 - f1):
        y = f1 + 1 + k
        for w in range(largura):
            x = p0[0] + u[0] * k + lado[0] * w
            z = p0[1] + u[1] * k + lado[1] * w
            col(x, z, max(f1 + 1, 0), y - 1, mat)
            put(x, y, z, f"{mat}_stairs[facing={face},half=bottom]")
            col(x, z, y + 1, y + 4, "air")


# --------------------------------------------------------------------- campo
CAMPO_X, CAMPO_Z = 52, 34      # meias-medidas do campo: 105 x 68


def campo(margem_x=7, margem_z=6, cores=None, lado_bancos=1, bandeira="yellow_wool"):
    """Gramado listrado com todas as marcações, gols com rede, bandeirinhas, placas e bancos."""
    X, Z = CAMPO_X, CAMPO_Z
    box(-X - margem_x, -1, -Z - margem_z, X + margem_x, -1, Z + margem_z, "grass_block")
    for x in range(-X, X + 1):
        if ((x + X) // 7) % 2:
            box(x, -1, -Z, x, -1, Z - 1, "moss_block")
    b = "white_concrete"
    box(-X, -1, -Z, X, -1, -Z, b); box(-X, -1, Z - 1, X, -1, Z - 1, b)
    box(-X, -1, -Z, -X, -1, Z - 1, b); box(X, -1, -Z, X, -1, Z - 1, b)
    box(0, -1, -Z, 0, -1, Z - 1, b)
    zc = -0.5
    for ang in range(0, 360, 2):
        a = math.radians(ang)
        put(round(9 * math.cos(a)), -1, round(zc + 9 * math.sin(a)), b)
    put(0, -1, 0, b); put(0, -1, -1, b)
    for s in (-1, 1):
        fundo = s * X
        box(fundo - s * 16, -1, -20, fundo - s * 16, -1, 19, b)
        box(fundo, -1, -20, fundo - s * 16, -1, -20, b); box(fundo, -1, 19, fundo - s * 16, -1, 19, b)
        box(fundo - s * 5, -1, -9, fundo - s * 5, -1, 8, b)
        box(fundo, -1, -9, fundo - s * 5, -1, -9, b); box(fundo, -1, 8, fundo - s * 5, -1, 8, b)
        put(fundo - s * 11, -1, 0, b); put(fundo - s * 11, -1, -1, b)
        for ang in range(-60, 61, 3):        # meia-lua
            a = math.radians(ang)
            x = fundo - s * 11 - s * round(9 * math.cos(a))
            if s * x < s * (fundo - s * 16) and abs(x) < X:
                put(x, -1, round(zc + 9 * math.sin(a)), b)
        gx = fundo + s                       # gol: 7 x 3 (medida oficial: 7,32 x 2,44), rede atrás
        box(gx, 0, -4, gx, 2, 3, "air")
        for z in (-4, 3):
            box(gx, 0, z, gx, 2, z, "white_concrete")
            box(gx + s, 0, z, gx + 2 * s, 2, z, "white_stained_glass_pane")
        box(gx, 3, -4, gx, 3, 3, "white_concrete")
        box(gx + s, 3, -4, gx + 2 * s, 3, 3, "white_stained_glass_pane")
        box(gx + 2 * s, 0, -3, gx + 2 * s, 2, 2, "white_stained_glass_pane")
        for z in (-Z, Z - 1):                # bandeirinhas de escanteio
            put(fundo, 0, z, "oak_fence")
            put(fundo, 1, z, bandeira)
    cores = cores or ["blue_concrete", "yellow_concrete", "white_concrete", "green_concrete"]
    zb = lado_bancos * (Z + 2) - (1 if lado_bancos > 0 else 0)
    zf = -lado_bancos * (Z + 3) - (1 if lado_bancos < 0 else 0)
    for x in range(-X - 4, X + 5):           # placas de publicidade
        cor = cores[((x + 200) // 8) % len(cores)]
        put(x, 0, zf, cor)
        if abs(x) > 14:
            put(x, 0, zb, cor)
    for z in range(-Z - 3, Z + 3):
        if abs(z) > 6:
            cor = cores[((z + 200) // 8) % len(cores)]
            put(-X - 4, 0, z, cor); put(X + 4, 0, z, cor)
    zz = lado_bancos * (Z + 4)
    encosto = "south" if lado_bancos > 0 else "north"
    for s in (-1, 1):                        # bancos de reservas cobertos
        for x in range(s * 6, s * 14, s):
            put(x, 0, zz, f"spruce_stairs[facing={encosto}]")
            put(x, 0, zz + lado_bancos, "white_concrete")
            put(x, 1, zz + lado_bancos, "glass")
            put(x, 2, zz + lado_bancos, "glass")
            put(x, 3, zz, "glass")
            put(x, 3, zz + lado_bancos, "glass")
    for x in (-2, -1, 0, 1, 2):              # mesa do quarto árbitro
        put(x, 0, zz, "white_concrete")


# ===================================================================== MARACANÃ
MAR_XR = 256
A0, B0 = 72, 50                 # elipse da frente da arquibancada (borda interna)
S_FACH = 84                     # fachada (de 84 a 86): oval externo de 316 x 272 m
NIVEIS = [-1, 7, 19, 31]        # pisos dos níveis 1 a 4 de circulação (o 1 é o chão)
AMARELO, AZUL, BRANCO = "yellow_concrete", "blue_concrete", "white_concrete"


def _deslocamento_elipse(xs, zs, A, B, smax):
    """Para cada ponto, o s tal que ele está na elipse de semi-eixos (A + s, B + s)."""
    lo = np.full(np.broadcast(xs, zs).shape, -min(A, B) + 0.5)
    hi = np.full_like(lo, smax)
    for _ in range(36):
        mid = (lo + hi) / 2
        dentro = (xs / (A + mid)) ** 2 + (zs / (B + mid)) ** 2 <= 1
        hi = np.where(dentro, mid, hi)
        lo = np.where(dentro, lo, mid)
    return hi


def _assento(si):
    """Altura (y) do degrau da arquibancada do Maracanã a uma distância si da borda interna."""
    if 2 <= si < 34:
        return 3 + (si - 2) // 2              # parte de baixo
    if 42 <= si < 72:
        return 25 + (si - 42) // 2            # parte de cima (acima dos camarotes)
    return None


def _oca(x, z, base, minimo=2):
    """Pisos e vãos embaixo da arquibancada (só abre um vão se ele tiver altura útil)."""
    if base < 2:
        return
    put(x, -1, z, PISO)
    for n, f in enumerate(NIVEIS):
        if f >= base:
            break
        if f >= 0:
            put(x, f, z, PISO)
        topo = min(NIVEIS[n + 1] if n + 1 < len(NIVEIS) else 999, base) - 1
        if topo - f < minimo:
            col(x, z, f + 1, topo, ESTR)


def _cor_cadeira(si, t, lf):
    """Mosaico do Maracanã: amarelas embaixo, azuis no meio, brancas em cima (misturadas)."""
    fila = si // 2
    u = int(math.radians(t) * lf / 2)
    r = random.Random(fila * 100003 + u * 7 + 11).random()
    if si < 16:
        return AMARELO if r < 0.62 else (AZUL if r < 0.9 else BRANCO)
    if si < 34:
        return AMARELO if r < 0.25 else (AZUL if r < 0.8 else BRANCO)
    if si < 57:
        return AZUL if r < 0.62 else (BRANCO if r < 0.88 else AMARELO)
    return BRANCO if r < 0.55 else (AZUL if r < 0.93 else AMARELO)


class Anel:
    """Coordenadas do oval do Maracanã: s (distância da borda interna), t (ângulo) e escala."""

    def __init__(self):
        eixo = np.arange(-m.XR, m.XR + 1, dtype=float)
        xs, zs = eixo[:, None], eixo[None, :]
        self.S = _deslocamento_elipse(xs, zs, A0, B0, 130.0)
        self.T = np.degrees(np.arctan2(zs / (B0 + self.S), xs / (A0 + self.S))) % 360
        self.LF = np.hypot((A0 + self.S) * np.sin(np.radians(self.T)),
                           (B0 + self.S) * np.cos(np.radians(self.T)))

    def celulas(self, s1, s2):
        for i, k in np.argwhere((self.S >= s1) & (self.S < s2)):
            yield int(i), int(k), int(i) - m.XR, int(k) - m.XR

    def lateral(self, i, k, periodo, desloc=0.0):
        """Distância (em blocos, ao longo do anel) até o múltiplo de `periodo` graus mais próximo."""
        d = ((self.T[i, k] - desloc + periodo / 2) % periodo) - periodo / 2
        return abs(math.radians(d)) * self.LF[i, k]

    def s(self, x, z):
        return self.S[x + m.XR, z + m.XR]


def maracana():
    m.configurar(MAR_XR, -8, 60)
    _chao()
    an = Anel()
    lat = an.lateral
    for i, k, x, z in an.celulas(0, 100):
        s = an.S[i, k]
        si, t, lf = int(s), an.T[i, k], an.LF[i, k]
        if 8 <= si < 88:                                       # cobertura (membrana branca)
            yr = 46 + (si - 8) // 20
            put(x, yr, z, "white_concrete")
            if si < 10:                                        # anel interno com os refletores
                put(x, yr - 1, z, "sea_lantern" if lat(i, k, 2.0) < 0.6 else "iron_block")
            elif lat(i, k, 5.0) < 0.6 or si in (30, 60):       # treliças por baixo
                put(x, yr - 1, z, "light_gray_concrete")
            if si >= 86:
                put(x, yr - 1, z, "white_concrete")
        if si >= 86:                                           # esplanada em volta
            put(x, -1, z, "smooth_stone")
            if si == 95 and lat(i, k, 8.0, 4.0) < 0.5:
                poste(x, z, 7)
            continue
        sy = _assento(si)
        if si < 2:                                             # mureta de frente para o campo
            col(x, z, 0, 2, "white_concrete")
            if si == 1:
                put(x, 3, z, "glass_pane")
        elif sy is not None:                                   # degraus com as cadeiras
            col(x, z, sy - 3, sy - 1, ESTR)
            corredor = lat(i, k, 10.0) < 0.9
            put(x, sy, z, "smooth_stone" if corredor else _cor_cadeira(si, t, lf))
            _oca(x, z, sy - 3)
        elif si < 42:                                          # anel de camarotes
            _oca(x, z, 19)
            put(x, 19, z, PISO)
            put(x, 24, z, ESTR)
            tribuna = z > 0 and abs(x) <= 40
            if si == 34:
                col(x, z, 20, 23, "glass_pane")
            elif si >= 40:
                put(x, 25, z, "white_concrete")
                put(x, 26, z, "glass_pane")
            elif lat(i, k, 3.0) < 0.5 and not tribuna:
                col(x, z, 20, 23, "white_concrete")            # divisórias
            elif si == 35 and not tribuna:
                gx, gz = x / (A0 + s) ** 2, z / (B0 + s) ** 2
                put(x, 20, z, f"quartz_stairs[facing={virado(gx, gz)}]")
            if si == 38 and lat(i, k, 3.0, 1.5) < 0.5:
                put(x, 24, z, "sea_lantern")
        elif si < 74:                                          # passarela no alto da arquibancada
            col(x, z, 37, 39, ESTR)
            put(x, 40, z, PISO)
            _oca(x, z, 37)
        elif si < S_FACH:                                      # prédio dos níveis de circulação
            _oca(x, z, 40, minimo=3)
            put(x, 40, z, PISO)
            if si == 79 and lat(i, k, 4.0) < 0.6:              # pilares internos
                for f, g in zip(NIVEIS, NIVEIS[1:] + [40]):
                    col(x, z, f + 1, g - 1, ESTR)
        else:                                                  # fachada: pilares em pares e vidro
            yr = 46 + (si - 8) // 20
            if min(lat(i, k, 6.0), lat(i, k, 6.0, 1.5)) < 1.0:
                col(x, z, 0, yr - 1, "white_concrete")
                continue
            _oca(x, z, 40, minimo=3)
            for f in (7, 19, 31, 40):
                put(x, f, z, "white_concrete")
            if si == S_FACH:
                for a, b in ((0, 6), (8, 18), (20, 30), (32, 39)):
                    col(x, z, a, b, "glass_pane")
                if lat(i, k, 30.0, 15.0) < 2.0:                # portões do nível 1
                    col(x, z, 0, 3, "air")
                put(x, 41, z, "glass_pane")

    for t0 in np.arange(5.0, 360, 20.0):                       # vomitórios
        _vomitorio(an, t0, 7, 10, 84)
        _vomitorio(an, t0 + 10, 31, 54, 84)
    for i, k, x, z in an.celulas(81, 82):                     # catracas atrás dos portões
        if lat(i, k, 30.0, 15.0) < 3.0 and lat(i, k, 1.5) < 0.4:
            col(x, z, 0, 1, "iron_bars")
    for i, k, x, z in an.celulas(58, 61):                     # lanchonetes (níveis 1 e 2)
        if lat(i, k, 30.0) < 3.0:
            si = int(an.S[i, k])
            for f in (-1, 7):
                if si == 60:
                    put(x, f + 1, z, "smooth_quartz")
                elif si == 58:
                    put(x, f + 1, z, "barrel[facing=up]")
                    put(x, f + 2, z, "smoker[facing=north]" if (x + z) % 3 == 0 else "barrel[facing=up]")
                put(x, f + 5, z, "yellow_concrete" if si == 60 else ESTR)
    for i, k, x, z in an.celulas(62, 69):                     # banheiros (nível 1)
        d = lat(i, k, 45.0, 22.5)
        if d < 4.0:
            si = int(an.S[i, k])
            borda = si in (62, 68) or d >= 3.0
            porta = si == 68 and d < 1.0
            if borda and not porta:
                col(x, z, 0, 6, "white_concrete")
            elif si == 63 and lat(i, k, 2.0) < 0.5:
                put(x, 0, z, "cauldron")
            put(x, -1, z, "white_concrete")
    _escadarias_mar(an)
    _tribuna_e_imprensa(an)
    _area_tecnica()
    campo(margem_x=14, margem_z=12, lado_bancos=1)
    for sx in (-1, 1):                                        # telões nas duas pontas
        x = sx * 87
        box(x, 31, -26, x, 43, 26, "black_concrete")
        box(x, 44, -24, x, 45, -24, "iron_bars"); box(x, 44, 24, x, 45, 24, "iron_bars")
        u = (0, 1) if sx > 0 else (0, -1)
        escrever("MARACANÃ", (x, 33, -23 if sx > 0 else 23), u, "yellow_concrete")
    _passarela_e_praca()
    _maracanazinho((-190, 160))
    _parque_aquatico((150, 196))
    # letreiro sobre a entrada da passarela (lido por quem vem da praça, olhando para o norte)
    largura = len("MARACANÃ") * 6 - 1
    escrever("MARACANÃ", (-largura // 2, 30, 139), (1, 0), "blue_concrete", fundo="white_concrete", margem=2)
    for x in (-largura // 2 - 2, largura // 2 + 2):
        box(x, 28, 137, x, 41, 138, "white_concrete")
    return an


def _vomitorio(an, t0, f, s_ini, s_fim, meia=1.5):
    """Corredor reto do nível de circulação (piso f) até a arquibancada."""
    for i, k, x, z in an.celulas(s_ini, s_fim):
        d = ((an.T[i, k] - t0 + 180) % 360) - 180
        if abs(math.radians(d)) * an.LF[i, k] < meia:
            put(x, f, z, PISO)
            col(x, z, f + 1, f + 3, "air")


def _escadarias_mar(an):
    """Oito escadarias em zigue-zague ligando os quatro níveis e o terraço do alto."""
    andares = NIVEIS + [40]

    def primeiro(fixo, alvo, lado, ao_longo_de_x):
        for d in range(0, m.XR):
            v = d * lado
            s = an.s(fixo, v) if ao_longo_de_x else an.s(v, fixo)
            if s >= alvo:
                return d
        raise ValueError

    for lado in (-1, 1):
        for sx in (-1, 1):                       # lados compridos (norte e sul): lances ao longo de x
            xs = [sx * (22 + k) for k in range(13)]
            d = max(primeiro(x, 75.5, lado, True) for x in xs)
            _zigue((sx * 22, d * lado), (sx, 0), (0, lado), andares)
        for sz in (-1, 1):                       # pontas (leste e oeste): lances ao longo de z
            zs = [sz * (14 + k) for k in range(13)]
            d = max(primeiro(z, 75.5, lado, False) for z in zs)
            _zigue((d * lado, sz * 14), (0, sz), (lado, 0), andares)


def _zigue(p, u, lat, andares):
    p_b = (p[0] + u[0] * 11 + lat[0] * 3, p[1] + u[1] * 11 + lat[1] * 3)
    voltar = (-u[0], -u[1])
    for n, (f1, f2) in enumerate(zip(andares, andares[1:])):
        lance(p if n % 2 == 0 else p_b, u if n % 2 == 0 else voltar, lat, f1, f2)


def _tribuna_e_imprensa(an):
    """Lado sul (o da passarela): tribuna de imprensa, tribuna de honra e cabines de rádio/TV."""
    for x in range(-40, 41):
        for z in range(0, m.XR):
            si = int(an.s(x, z))
            if not 34 <= si < 42:
                continue
            if abs(x) <= 8:                                   # tribuna de honra
                put(x, 20, z, "red_carpet")
                if si in (36, 38, 40):
                    put(x, 20, z, "crimson_stairs[facing=south]")
            elif si in (35, 38):                              # bancadas da imprensa
                put(x, 20, z, "spruce_slab[type=top]")
            elif si in (36, 39):
                put(x, 20, z, "spruce_stairs[facing=south]")
        if abs(x) > 30:
            continue
        zc = [z for z in range(0, m.XR) if 72 <= an.s(x, z) < 78]     # cabines de rádio e TV
        for z in zc:
            si = int(an.s(x, z))
            if si == 72:
                col(x, z, 42, 43, "glass_pane")
                put(x, 41, z, "white_concrete")
            elif si == 77 or x % 6 == 0 or abs(x) == 30:
                col(x, z, 41, 43, "white_concrete")
            elif si == 73:
                put(x, 41, z, "spruce_slab[type=top]")
            elif si == 74:
                put(x, 41, z, "spruce_stairs[facing=south]")
            put(x, 44, z, "white_concrete")
        if x % 6 == 3:
            put(x, 44, zc[3], "sea_lantern")
            put(x, 41, zc[-1], "air")                         # porta dos fundos
            put(x, 42, zc[-1], "air")


def _area_tecnica():
    """Nível 1 do lado sul: túnel, vestiários, zona mista e sala de coletiva."""
    z1, z2 = 72, 94
    box(-3, -1, 50, 3, -1, 98, PISO)
    for z in range(48, z2 + 5):                       # túnel e corredor central
        box(-2, 0, z, 2, 2 if z < 70 else 5, z, "air")
        for x in (-3, 3):
            col(x, z, 0, 3 if z < 70 else 6, "white_concrete")
        if z < 70:
            for x in range(-3, 4):
                if get(x, 3, z) == "minecraft:air":
                    put(x, 3, z, ESTR)
    for z in range(72, z2 + 1, 4):
        put(0, 5, z, "sea_lantern")
    salas = [(-24, -5, "vestiario"), (5, 24, "vestiario"), (-46, -27, "coletiva"), (27, 46, "zona_mista")]
    for xa, xb, tipo in salas:
        box(xa - 1, -1, z1 - 1, xb + 1, 6, z2 + 1, "white_concrete")
        box(xa, 0, z1, xb, 5, z2, "air")
        box(xa, -1, z1, xb, -1, z2, "smooth_quartz" if tipo == "vestiario" else PISO)
        if tipo == "vestiario":                       # porta para o corredor central
            px = xb + 1 if xa < 0 else xa - 1
            box(px, 0, 82, px, 2, 83, "air")
        else:                                         # porta para a circulação do nível 1
            xm = (xa + xb) // 2
            box(xm - 1, 0, z2 + 1, xm + 1, 2, z2 + 1, "air")
        for x in range(xa + 2, xb - 1, 5):
            put(x, 5, (z1 + z2) // 2, "sea_lantern")
    box(-3, 0, 82, 3, 2, 83, "air")
    for xa, xb in ((-24, -5), (5, 24)):               # vestiários
        sinal = -1 if xa < 0 else 1
        fundo = xa if xa < 0 else xb
        frente = "east" if sinal < 0 else "west"
        for z in range(z1 + 1, z2):                   # armários e banco
            put(fundo, 0, z, f"barrel[facing={frente}]")
            put(fundo, 1, z, f"barrel[facing={frente}]")
            put(fundo - sinal * 2, 0, z, f"spruce_stairs[facing={m.OPOSTO[frente]}]")
        for x in range(min(xa, xb) + 3, max(xa, xb) - 2):
            put(x, 0, z2, "barrel[facing=north]")
            put(x, 1, z2, "barrel[facing=north]")
            put(x, 0, z2 - 2, "spruce_stairs[facing=south]")
        for x in range(min(xa, xb) + 4, max(xa, xb) - 3, 4):   # macas
            put(x, 0, z1 + 3, "white_concrete")
            put(x, 1, z1 + 3, "white_carpet")
        put(fundo - sinal * 6, 0, z1 + 7, "water_cauldron")    # banheira de gelo
        box(min(xa, xb) + 3, 1, z1, max(xa, xb) - 3, 3, z1, "black_concrete")   # quadro tático
        for x in range(min(xa, xb) + 5, max(xa, xb) - 4, 3):
            put(x, 2, z1, "white_concrete")
    for z in range(z1, z2 + 1):                       # coletiva: painel de patrocinadores
        for y in range(0, 6):
            put(-46, y, z, ["blue_concrete", "yellow_concrete", "white_concrete"][((z // 2) + (y // 2)) % 3])
    for z in range(78, 89):                           # mesa com os entrevistados
        put(-43, 0, z, "dark_oak_slab[type=top]")
        if z % 2 == 0:
            put(-44, 0, z, "dark_oak_stairs[facing=west]")
    for x in range(-39, -29, 2):                      # plateia de jornalistas
        for z in range(76, 92):
            if z != 83:
                put(x, 0, z, "spruce_stairs[facing=east]")
    for z in (78, 83, 88):                            # câmeras
        put(-28, 0, z, "iron_bars"); put(-28, 1, z, "dispenser[facing=west]")
    for x in range(30, 45, 4):                        # zona mista: grades e painel
        for z in range(z1 + 2, z2 - 1):
            put(x, 0, z, "iron_bars")
    for z in range(z1, z2 + 1):
        for y in range(0, 6):
            put(46, y, z, ["blue_concrete", "yellow_concrete"][((z // 3) + (y // 3)) % 2])


def _passarela_e_praca():
    """A passarela elevada que sai da praça (com a estátua do Bellini) e chega ao nível 2."""
    box(-6, 8, 129, 6, 12, 137, "air")                # abertura na fachada, no nível 2
    for z in range(130, 201):                         # tabuleiro reto no nível 2
        box(-7, 7, z, 7, 7, z, PISO)
        if z < 137:
            continue
        put(-7, 8, z, "glass_pane"); put(7, 8, z, "glass_pane")
        put(-8, 7, z, "white_concrete"); put(8, 7, z, "white_concrete")
        if z % 10 == 0:
            for x in (-5, 5):
                col(x, z, 0, 6, "white_concrete")
        if z % 8 == 4:
            for x in (-6, 6):
                col(x, z, 8, 9, "iron_bars")
                put(x, 10, z, "sea_lantern")
    for zp in range(1, 17):                           # rampa: desce meio bloco por bloco
        z = 200 + zp
        meios = 16 - zp
        for x in range(-7, 8):
            col(x, z, 0, meios // 2 - 1, PISO)
            if meios % 2:
                put(x, meios // 2, z, "polished_andesite_slab[type=bottom]")
        for x in (-8, 8):
            col(x, z, 0, meios // 2, "white_concrete")
            put(x, meios // 2 + 1, z, "glass_pane")
    for bx in (-30, 30):                              # bilheterias
        box(bx - 3, 0, 244, bx + 3, 3, 248, "blue_concrete")
        box(bx - 2, 1, 244, bx + 2, 2, 244, "glass_pane")
        box(bx - 3, 4, 243, bx + 3, 4, 249, "white_concrete")
    cx, cz = 0, 216                                   # praça semicircular e rotunda com colunata
    for x in range(-48, 49):
        for z in range(196, 251):
            r = math.hypot(x - cx, z - cz)
            if r <= 47 or (z < cz and abs(x) <= 8):
                if get(x, -1, z) == m.MANTER:
                    put(x, -1, z, "smooth_stone" if int(r) % 6 < 3 else "polished_diorite")
            if z >= cz and 13 <= r <= 21:
                put(x, 8, z, "white_concrete")        # marquise
                ang = math.degrees(math.atan2(z - cz, x - cx))
                if (abs(r - 20) < 0.6 or abs(r - 14) < 0.6) and (ang % 12) < 2.2:
                    col(x, z, 0, 7, "quartz_pillar")
                if abs(r - 17) < 0.5 and int(ang) % 10 == 0:
                    put(x, 7, z, "sea_lantern")
    _bellini((0, 241))
    for ang in range(0, 181, 18):
        for r in (26, 32, 38, 44):
            x = round(cx + r * math.cos(math.radians(ang)))
            z = round(cz + r * math.sin(math.radians(ang)))
            livre = all(get(x + dx, 0, z + dz) == "minecraft:air" for dx in (-3, 0, 3) for dz in (-3, 0, 3))
            if livre and not (abs(x) <= 6 and z > cz):
                palmeira(x, z, 7 + (r + ang) % 3)
    for z in range(160, 200, 12):                     # palmeiras ao lado da passarela
        palmeira(-14, z, 8); palmeira(14, z, 8)


def _bellini(pos):
    """Estátua do Bellini (capitão de 1958) erguendo a taça, sobre o globo."""
    cx, cz = pos
    box(cx - 4, 0, cz - 4, cx + 4, 0, cz + 4, "polished_andesite")
    for dx in range(-4, 5):
        for dy in range(-4, 5):
            for dz in range(-4, 5):
                if dx * dx + dy * dy + dz * dz <= 12.5:
                    put(cx + dx, 4 + dy, cz + dz, "polished_blackstone")
    br = "netherite_block"                             # bronze escuro
    for dz in (0, 1):
        for x in (cx - 1, cx + 1):
            col(x, cz + dz, 8, 11, br)                 # pernas
        box(cx - 1, 12, cz + dz, cx + 1, 14, cz + dz, br)   # tronco
    put(cx, 15, cz, br); put(cx, 15, cz + 1, br)      # cabeça
    col(cx + 2, cz, 13, 17, br)                        # braço erguido
    put(cx + 2, 18, cz, "gold_block")                  # a taça Jules Rimet
    put(cx + 2, 19, cz, "gold_block")
    col(cx - 2, cz, 12, 13, br)                        # o outro braço


def _maracanazinho(c):
    """O ginásio ao lado: cilindro com a cúpula branca e arquibancada em volta da quadra."""
    cx, cz = c
    R = 44
    for dx in range(-R, R + 1):
        for dz in range(-R, R + 1):
            r = math.hypot(dx, dz)
            if r > R + 0.5:
                continue
            x, z = cx + dx, cz + dz
            yd = 15 + int(11 * math.sqrt(max(0.0, 1 - (r / R) ** 2)))
            yo = 15 + int(11 * math.sqrt(max(0.0, 1 - (min(r + 1, R) / R) ** 2)))
            col(x, z, min(yd, yo + 1), yd, "glass" if r < 4 else "white_concrete")
            put(x, -1, z, PISO)
            ang = math.degrees(math.atan2(dz, dx)) % 360
            entrada = min(abs(((ang - a + 180) % 360) - 180) for a in (0, 90, 180, 270)) * math.pi / 180 * r < 2.5
            if r >= R - 2:
                if entrada:
                    col(x, z, 4, 14, "light_gray_concrete")
                elif (ang % 10) < 1.5:
                    col(x, z, 0, 14, "light_gray_concrete")
                else:
                    put(x, 0, z, "light_gray_concrete")
                    if r >= R - 0.5:
                        col(x, z, 1, 11, "gray_stained_glass_pane")
                    col(x, z, 12, 14, "light_gray_concrete")
            elif r >= 16:
                sy = int((r - 16) // 2)
                if entrada:
                    col(x, z, 4, sy, ESTR)
                    continue
                col(x, z, 0, sy - 1, ESTR)
                put(x, sy, z, ["blue_concrete", "white_concrete", "yellow_concrete"][int(r) % 3])
            else:
                put(x, -1, z, "oak_planks" if abs(dx) <= 13 and abs(dz) <= 7 else "orange_concrete")
    box(cx, -1, cz - 7, cx, -1, cz + 7, "white_concrete")


def _parque_aquatico(c):
    """Parque aquático Júlio Delamare: piscina olímpica, arquibancada coberta e torre de saltos."""
    cx, cz = c
    x1, x2, z1, z2 = cx - 25, cx + 25, cz - 10, cz + 10
    box(x1 - 10, -1, z1 - 22, x2 + 10, -1, z2 + 6, "smooth_stone")
    box(x1 - 1, -5, z1 - 1, x2 + 1, -1, z2 + 1, "white_concrete")
    box(x1, -4, z1, x2, -1, z2, "water")
    for z in range(z1 + 2, z2, 3):
        box(x1 + 2, -5, z, x2 - 2, -5, z, "black_concrete")
    for z in range(z1 - 21, z1 - 2):                    # arquibancada (sobe para o norte)
        sy = (z1 - 3 - z) // 2
        for x in range(x1, x2 + 1):
            col(x, z, 0, sy - 1, ESTR)
            put(x, sy, z, "blue_concrete" if (x // 4) % 2 else "white_concrete")
    for x in range(x1, x2 + 1):                         # cobertura em grelha
        for z in range(z1 - 22, z1 - 1):
            if x % 4 == 0 or z % 4 == 0:
                put(x, 14, z, "white_concrete")
    for x in range(x1, x2 + 1, 10):
        col(x, z1 - 22, 0, 13, "white_concrete")
    tx = x2 + 4                                          # torre de saltos
    box(tx, 0, cz - 2, tx + 2, 10, cz + 2, "white_concrete")
    for y, ponta in ((5, x2 - 2), (10, x2 - 5)):
        box(ponta, y, cz - 1, tx - 1, y, cz + 1, "white_concrete")
    for y in range(1, 11):
        put(tx + 3, y, cz, "ladder[facing=east]")


# ===================================================================== SÃO JANUÁRIO
SJ_XR = 112
XC, CA, CB = 28, 34, 42         # a curva (fundo leste) é meia elipse centrada em x = 28
FACE = 76                       # z da fachada (lado sul, de frente para a rua)
ZT = FACE - 9                   # parede dos fundos do prédio (lado da arquibancada)
PROF = {"social": 24, "vasco": 30, "curva": 26}
INCL = {"social": 0.6, "vasco": 0.55, "curva": 0.55}


def _sy(setor, s):
    return 2 + int((s - 2) * INCL[setor])


def sao_januario():
    m.configurar(SJ_XR, -6, 46)
    _chao()
    eixo = np.arange(-m.XR, m.XR + 1, dtype=float)
    S = _deslocamento_elipse(eixo[:, None] - XC, eixo[None, :], CA, CB, 60.0)
    for i in range(m.SX):
        x = i - m.XR
        if x < -58:
            continue
        for k in range(m.SZ):
            z = k - m.XR
            if x > XC:
                setor, s = "curva", S[i, k]
            else:
                setor, s = ("social" if z > 0 else "vasco"), abs(z) - CB
            if s < 0 or s >= PROF[setor] + 2:
                continue
            si = int(s)
            if si < 2:                                       # mureta e alambrado
                col(x, z, 0, 1, "white_concrete")
                if si == 1:
                    col(x, z, 2, 3, "iron_bars")
                continue
            if si >= PROF[setor]:                            # parede de trás / borda do topo
                if setor == "social":
                    col(x, z, 0, 14, ESTR)
                    put(x, 15, z, PISO)
                    continue
                topo = _sy(setor, PROF[setor] - 1)
                col(x, z, 0, topo + 1, "white_concrete")
                if setor == "curva":
                    col(x, z, topo + 1, topo + 2, "red_concrete")
                continue
            sy = _sy(setor, si)
            col(x, z, 0, sy - 1, ESTR)
            put(x, sy, z, _cor_sj(setor, x, z, si, S[i, k]))
    _vasco_na_arquibancada()
    _cobertura_social()
    _cabines_vasco()
    campo(margem_x=6, margem_z=6, cores=["black_concrete", "white_concrete", "red_concrete", "white_concrete"],
          lado_bancos=1, bandeira="red_wool")
    _fundo_aberto()
    _predio()
    _fachada()
    _interior()
    _subsolo_social()
    _rua()


def _cor_sj(setor, x, z, si, s):
    if setor == "vasco":
        return "black_concrete"
    if setor == "social":
        if abs(x) <= 10 and si >= 16:
            return "red_concrete"                           # tribuna de honra
        return "gray_concrete" if (x // 6) % 2 else "light_gray_concrete"
    # curva: branca no meio com a Cruz de Malta vermelha, preta dos lados
    ang = math.atan2(z / (CB + s), (x - XC) / (CA + s))
    u = ang * ((CA + CB) / 2 + s)
    if abs(u) <= 22:
        return "red_concrete" if em_cruz(u, si - 13, 11) else "white_concrete"
    return "black_concrete"


def _vasco_na_arquibancada():
    """VASCO em letras brancas gigantes nas cadeiras pretas (lido de frente, da social)."""
    px, largura = pixels("VASCO")
    esc = 3
    x0 = -15 - (largura * esc) // 2
    for c, r in px:
        for a in range(esc):
            for b in range(esc):
                x = x0 + c * esc + a
                si = 4 + r * esc + b
                put(x, _sy("vasco", si), -(CB + si), "white_concrete")


def _cobertura_social():
    """Cobertura da social: telhado cinza apoiado em colunas, com refletores na borda."""
    for x in range(-58, XC + 1):
        for s in range(1, PROF["social"] + 1):
            put(x, 19 + (s - 1) // 9, CB + s, "light_gray_concrete" if x % 6 == 0 else "gray_concrete")
        if x % 4 == 0:
            put(x, 18, CB + 1, "sea_lantern")
        if (x + 58) % 14 == 0:
            col(x, CB + 4, _sy("social", 4) + 1, 18, "white_concrete")


def _cabines_vasco():
    """Cabines de imprensa no alto da arquibancada do VASCO, com o letreiro VASCO DA GAMA."""
    zf, zt = -(CB + 30), -(CB + 35)            # frente (vidro) e fundo
    piso = 17
    box(-50, 0, zf, 26, piso, zt, ESTR)
    for x in range(-50, 27):
        for z in range(zt, zf + 1):
            if z == zf:
                col(x, z, piso + 1, piso + 3, "glass_pane")
            elif z == zt or x in (-50, 26) or (x + 50) % 7 == 0:
                col(x, z, piso + 1, piso + 3, "white_concrete")
            elif z == zf - 1:
                put(x, piso + 1, z, "spruce_slab[type=top]")
            elif z == zf - 2:
                put(x, piso + 1, z, "spruce_stairs[facing=north]")
            put(x, piso + 4, z, "white_concrete")
        if (x + 50) % 7 == 3:
            put(x, piso + 4, zf - 2, "sea_lantern")
    for x in range(-49, 26):                   # portas entre as cabines (corredor do fundo)
        if (x + 50) % 7 == 0:
            col(x, zt + 1, piso + 1, piso + 2, "air")
    # letreiro: quem está na social olha para o norte e tem o leste à direita
    largura = len("VASCO DA GAMA") * 6 - 1
    escrever("VASCO DA GAMA", (-12 - largura // 2, piso + 6, zf), (1, 0), "black_concrete",
             fundo="white_concrete", margem=1)
    for k in range(piso + 1):                  # escada externa pelos fundos
        x = 44 - k
        for z in (zt - 1, zt - 2):
            col(x, z, 0, k - 1, ESTR)
            put(x, k, z, "polished_andesite_stairs[facing=west]")
    box(26, piso, zt - 2, 28, piso, zt + 3, PISO)
    box(26, piso + 1, zt + 2, 26, piso + 2, zt + 3, "air")


def _fundo_aberto():
    """Fundo oeste sem arquibancada: placar, torres de luz, estátua do Romário e quadra de tênis."""
    for z in range(-41, 42):
        col(-60, z, 0, 1, "white_concrete")
        col(-60, z, 2, 3, "iron_bars")
    xp = -74                                           # placar sobre duas pernas, virado para o campo
    for z in (-7, 7):
        col(xp, z, 0, 9, ESTR)
    box(xp, 10, -17, xp, 21, 17, "black_concrete")
    escrever("VASCO", (xp, 13, 14), (0, -1), "white_concrete")
    for sz in (-1, 1):                                 # torres de luz treliçadas
        cx, cz = -66, sz * 50
        for y in range(0, 38):
            for dx, dz in ((0, 0), (2, 0), (0, 2), (2, 2)):
                put(cx + dx, y, cz + dz, "iron_block")
            if y % 4 == 0:
                for d in range(3):
                    put(cx + d, y, cz, "iron_bars"); put(cx + d, y, cz + 2, "iron_bars")
                    put(cx, y, cz + d, "iron_bars"); put(cx + 2, y, cz + d, "iron_bars")
        box(cx - 2, 38, cz - 2, cx + 4, 38, cz + 4, "iron_block")
        box(cx + 4, 39, cz - 2, cx + 4, 43, cz + 4, "sea_lantern")
    _romario((-70, 24))
    box(-108, -1, -62, -84, -1, -46, "orange_terracotta")      # quadra de tênis (saibro)
    for x in range(-107, -84):
        put(x, -1, -60, "white_concrete"); put(x, -1, -48, "white_concrete")
    box(-96, -1, -60, -96, -1, -48, "white_concrete")
    box(-96, 0, -61, -96, 0, -47, "white_stained_glass_pane")
    for x in range(-109, -82):
        col(x, -63, 0, 3, "iron_bars"); col(x, -45, 0, 3, "iron_bars")
    for z in range(-63, -44):
        col(-109, z, 0, 3, "iron_bars"); col(-83, z, 0, 3, "iron_bars")


def _romario(pos):
    """Estátua de bronze do Romário comemorando com o dedo para o alto."""
    cx, cz = pos
    box(cx - 2, 0, cz - 2, cx + 2, 1, cz + 2, "smooth_quartz")
    br = "netherite_block"
    for z in (cz - 1, cz + 1):
        col(cx, z, 2, 5, br)                           # pernas
    box(cx, 6, cz - 1, cx, 8, cz + 1, br)              # tronco
    put(cx, 9, cz, br)                                 # cabeça
    col(cx, cz + 2, 7, 10, br)                         # braço erguido
    put(cx, 11, cz + 2, "iron_bars")                   # o dedo
    col(cx, cz - 2, 6, 7, br)


def _subsolo_social():
    """Embaixo da social: túnel, vestiários e sala do árbitro."""
    for z in range(CB - 1, ZT + 1):                    # túnel do saguão até o campo
        box(-2, 0, z, 2, 2, z, "air")
        if z < CB + 6:
            box(-3, 3, z, 3, 3, z, ESTR)
            col(-3, z, 0, 2, ESTR); col(3, z, 0, 2, ESTR)
    box(-2, -1, CB - 1, 2, -1, ZT, PISO)
    for z in range(CB + 8, ZT, 5):
        put(0, 3, z, "sea_lantern")
    z1, z2 = CB + 9, CB + 22
    for xa, xb in ((-26, -5), (5, 26)):
        box(xa, 0, z1, xb, 3, z2, "air")
        box(xa, -1, z1, xb, -1, z2, "smooth_quartz")
        porta = xb + 1 if xa < 0 else xa - 1
        box(porta, 0, z1 + 6, porta + (2 if xa < 0 else -2), 2, z1 + 7, "air")
        fundo, sinal = (xa, -1) if xa < 0 else (xb, 1)
        frente = "east" if sinal < 0 else "west"
        for z in range(z1, z2 + 1):
            put(fundo, 0, z, f"barrel[facing={frente}]")
            put(fundo, 1, z, f"barrel[facing={frente}]")
            put(fundo - sinal * 2, 0, z, f"spruce_stairs[facing={m.OPOSTO[frente]}]")
        for x in range(min(xa, xb) + 4, max(xa, xb) - 3, 4):
            put(x, 0, z2, "white_concrete"); put(x, 1, z2, "white_carpet")
            put(x, 3, (z1 + z2) // 2, "sea_lantern")
        box(min(xa, xb) + 4, 1, z1, max(xa, xb) - 4, 2, z1, "black_concrete")
        put(fundo - sinal * 5, 0, z1 + 2, "water_cauldron")
    box(-36, 0, z1 + 4, -29, 3, z2, "air")             # sala do árbitro
    box(-36, -1, z1 + 4, -29, -1, z2, "smooth_quartz")
    box(-28, 0, z1 + 8, -27, 2, z1 + 9, "air")
    put(-35, 0, z2, "barrel[facing=north]"); put(-33, 0, z2 - 3, "spruce_stairs[facing=south]")


# --------------------------------------------------------------------- sede e fachada
TERRACOTA = "white_terracotta"      # paredes creme
ORN = "smooth_quartz"               # ornamentos brancos


def _sim(x, y, z, b):
    """Coloca o bloco em x e no simétrico -x (espelhando a orientação)."""
    put(x, y, z, b)
    put(-x, y, z, espelhar_estado(b))


def _altura(x):
    ax = abs(x)
    return 21 if ax <= 12 else (19 if ax >= 50 else 15)


def _predio():
    """Prédio da sede (118 m): térreo, 1º andar e terraço; corpo central com pé-direito duplo."""
    for x in range(-59, 60):
        ax, h = abs(x), _altura(x)
        box(x, 0, ZT, x, h, FACE, TERRACOTA)
        box(x, 0, ZT + 1, x, h - 1, FACE - 1, "air")
        for z in range(ZT + 1, FACE):                   # piso xadrez preto e branco
            put(x, -1, z, "black_concrete" if (x + z) % 2 else "white_concrete")
        if ax <= 6:                                     # saguão; presidência no mezanino
            box(x, 14, ZT + 1, x, 14, FACE - 1, "dark_oak_planks")
        else:
            box(x, 8, ZT + 1, x, 8, FACE - 1, "dark_oak_planks")
            if ax <= 49:
                box(x, h, ZT + 1, x, h, FACE - 1, PISO)    # terraço
    for z in range(ZT, FACE + 1):                       # paredes internas
        for y in range(0, 21):
            _sim(13, y, z, TERRACOTA)
        for y in range(0, 19):
            _sim(50, y, z, TERRACOTA)
        for y in range(0, 22):
            _sim(7, y, z, TERRACOTA)
    for y in (0, 1, 2, 9, 10, 11):                      # portas
        for z in (ZT + 4, ZT + 5):
            _sim(13, y, z, "air"); _sim(50, y, z, "air")
            if y < 3:
                _sim(7, y, z, "air")
    for y in (15, 16):                                  # torre leste -> presidência
        for z in (FACE - 2, FACE - 1):
            put(7, y, z, "air")
    box(-2, 0, ZT, 2, 2, ZT, "air")                     # saguão -> túnel
    for x in range(-6, 7):
        for z in (FACE, FACE + 1):
            put(x, -1, z, PISO)


def _fachada():
    F = FACE
    for x in range(-59, 60):
        put(x, 0, F + 1, "smooth_stone")                # rodapé
    for x in range(13, 50):                             # cornijas e balaustrada das alas
        _sim(x, 8, F + 1, "smooth_quartz_slab[type=top]")
        _sim(x, 15, F, ORN)
        _sim(x, 15, F + 1, "smooth_quartz_slab[type=top]")
        _sim(x, 16, F, ORN)
        _sim(x, 17, F, "quartz_pillar" if x % 2 else "air")
        _sim(x, 18, F, "smooth_quartz_slab[type=bottom]")
    for x in (13, 22, 31, 40, 49):                      # pináculos
        for y in (17, 18, 19):
            _sim(x, y, F, "quartz_pillar")
        _sim(x, 20, F, "smooth_quartz_slab[type=bottom]")
    for x in (17, 26, 35, 44):                          # bandeiras do Vasco no telhado
        _bandeira(x, 18, F, 1)
        _bandeira(-x, 18, F, -1)
    for xc in (17, 26, 35, 44):                         # janelas em arco (térreo) e com frontão (1º andar)
        for y in range(0, 8):
            _sim(xc - 3, y, F + 1, ORN); _sim(xc + 3, y, F + 1, ORN)
        for x in range(xc - 2, xc + 3):
            for y in range(1, 6):
                _sim(x, y, F, "glass_pane")
        for x in range(xc - 1, xc + 2):
            _sim(x, 6, F, "glass_pane")
        _sim(xc - 2, 6, F, "quartz_stairs[facing=east,half=top]")
        _sim(xc + 2, 6, F, "quartz_stairs[facing=west,half=top]")
        _sim(xc, 7, F + 1, "chiseled_quartz_block")
        for x in range(xc - 1, xc + 2):
            for y in range(10, 14):
                _sim(x, y, F, "glass_pane")
            _sim(x, 9, F + 1, "smooth_quartz_slab[type=top]")
            _sim(x, 14, F + 1, ORN)
        _sim(xc - 2, 14, F + 1, "quartz_stairs[facing=east]")
        _sim(xc + 2, 14, F + 1, "quartz_stairs[facing=west]")
    for xn in (21, 30, 39):                             # janelas estreitas: toldo vermelho e sacada
        for x in (xn, xn + 1):
            for y in range(1, 5):
                _sim(x, y, F, "glass_pane")
            _sim(x, 5, F + 1, "red_wool")
            for y in range(10, 14):
                _sim(x, y, F, "glass_pane")
            _sim(x, 9, F + 1, "smooth_quartz_slab[type=top]")
            _sim(x, 9, F + 2, "smooth_quartz_slab[type=top]")
            _sim(x, 10, F + 2, "iron_bars")
    # pavilhões das pontas: portão, janela em arco e frontão curvo
    for x in range(50, 60):
        _sim(x, 19, F + 1, "smooth_quartz_slab[type=top]")
    for x in range(53, 57):
        for y in range(0, 5):
            _sim(x, y, F, "air")
        _sim(x, 5, F + 1, "chiseled_quartz_block")
        for y in range(9, 14):
            _sim(x, y, F, "glass_pane")
        _sim(x, -1, F, PISO)
    _sim(53, 14, F, "quartz_stairs[facing=east,half=top]")
    _sim(56, 14, F, "quartz_stairs[facing=west,half=top]")
    for y, (a, b) in zip(range(20, 24), ((51, 58), (52, 57), (53, 56), (54, 55))):
        for x in range(a, b + 1):
            _sim(x, y, F, ORN if x in (a, b) or y == 23 else TERRACOTA)
    _sim(54, 21, F, "glass_pane"); _sim(55, 21, F, "glass_pane")
    for x in (50, 59):
        for y in (20, 21):
            _sim(x, y, F, "quartz_pillar")
        _sim(x, 22, F, "smooth_quartz_slab[type=bottom]")
    _bandeira(54, 24, F, 1); _bandeira(-55, 24, F, -1)
    # torres dos lados do corpo central
    for x in range(7, 13):
        _sim(x, 21, F + 1, "smooth_quartz_slab[type=top]")
        _sim(x, 8, F + 1, "smooth_quartz_slab[type=top]")
    for x in (9, 10):
        for y in range(1, 6):
            _sim(x, y, F, "glass_pane")
        for y in range(10, 14):
            _sim(x, y, F, "glass_pane")
        _sim(x, 9, F + 1, "smooth_quartz_slab[type=top]")
        _sim(x, 9, F + 2, "smooth_quartz_slab[type=top]")
        _sim(x, 10, F + 2, "iron_bars")
        _sim(x, 17, F, "glass_pane"); _sim(x, 18, F, "glass_pane")
    for x, y in ((8, 17), (11, 17), (8, 18), (11, 18), (9, 16), (10, 16), (9, 19), (10, 19)):
        _sim(x, y, F, ORN)                              # moldura oval
    for x, y in ((8, 22), (9, 22), (10, 22), (11, 22), (9, 23), (10, 23)):
        _sim(x, y, F, ORN)
    for y in (22, 23, 24):
        _sim(12, y, F, "quartz_pillar"); _sim(7, y, F, "quartz_pillar")
    _bandeira(9, 24, F, 1); _bandeira(-10, 24, F, -1)
    # corpo central, avançado um bloco
    G = F + 1
    for x in range(-6, 7):
        for y in range(0, 22):
            put(x, y, G, TERRACOTA)
    for x in range(-6, 7):                              # o grande portão em arco
        for y in range(0, 14):
            r = math.hypot(x, y - 8.5)
            dentro = (abs(x) <= 4 and y <= 8) or (y > 8 and r <= 4.6)
            moldura = not dentro and ((abs(x) <= 5 and y <= 8) or (y > 8 and r <= 5.7))
            if dentro:
                put(x, y, G, "air" if (abs(x) <= 2 and y <= 4) else "glass_pane")
                put(x, y, F, "air")
            elif moldura:
                put(x, y, G + 1, ORN)
    put(0, 14, G + 1, "chiseled_quartz_block")
    for x in range(-4, 5):                              # sacada sobre o portão
        put(x, 14, G + 1, ORN); put(x, 14, G + 2, ORN)
        put(x, 15, G + 2, "quartz_pillar" if x % 2 == 0 else "air")
        put(x, 16, G + 2, "smooth_quartz_slab[type=bottom]")
    for x in (-3, 0, 3):
        put(x, 13, G + 2, "quartz_stairs[facing=north,half=top]")
    for x in (-4, -3, -2, 2, 3, 4):                     # janelas da presidência
        for y in range(15, 19):
            put(x, y, G, "glass_pane"); put(x, y, F, "air")
    for y in (15, 16):                                  # porta para a sacada
        put(0, y, G, "air"); put(0, y, F, "air")
    for y in (17, 18):
        put(0, y, G, "glass_pane"); put(0, y, F, "air")
    for y in range(15, 20):
        put(-1, y, G, "quartz_pillar"); put(1, y, G, "quartz_pillar")
    for x in range(-5, 6):
        put(x, 19, G + 1, "smooth_quartz_slab[type=top]")
    put(-2, 20, G + 1, "quartz_stairs[facing=east]"); put(2, 20, G + 1, "quartz_stairs[facing=west]")
    put(0, 20, G + 1, "chiseled_quartz_block"); put(-1, 20, G + 1, ORN); put(1, 20, G + 1, ORN)
    meia = {21: 6, 22: 6, 23: 6, 24: 6, 25: 6, 26: 6, 27: 6, 28: 5, 29: 5, 30: 4, 31: 3, 32: 2, 33: 1}
    for y, hw in meia.items():                          # frontão barroco com volutas
        for x in range(-hw, hw + 1):
            borda = abs(x) == hw or y == 33 or abs(x) > meia.get(y + 1, 0)
            put(x, y, G, ORN if borda else TERRACOTA)
    for x, y, b in ((7, 21, ORN), (8, 21, ORN), (9, 22, ORN), (9, 23, ORN), (8, 24, "quartz_stairs[facing=west]"),
                    (7, 24, ORN), (6, 28, "quartz_stairs[facing=west]"), (7, 27, ORN)):
        _sim(x, y, G, b)
    _azulejos(G + 1)
    put(0, 34, G, "chiseled_quartz_block")
    col(0, G, 35, 43, "iron_bars")
    _bandeira_grande(1, 37, G)


def _azulejos(z):
    """Painel de azulejos azuis e brancos com o escudo do Vasco no frontão."""
    for x in range(-5, 6):
        for y in range(21, 31):
            if abs(x) == 5 or y in (21, 30):
                cor = "blue_concrete"
            elif (x * x + (y - 25) ** 2) % 4 == 1:
                cor = "blue_concrete"
            else:
                cor = "light_blue_concrete" if (x + y) % 3 == 0 else "white_concrete"
            put(x, y, z, cor)
    # escudo: preto com a faixa branca em diagonal, do alto à esquerda (oeste, para quem
    # olha da rua para o norte) até embaixo à direita
    for x in range(-3, 4):
        for y in range(22, 30):
            if (y == 22 and abs(x) > 0) or (y == 23 and abs(x) > 1) or (y == 24 and abs(x) > 2):
                continue
            faixa = abs((x + 3) - (29 - y)) <= 1
            put(x, y, z, "white_concrete" if faixa else "black_concrete")
    put(0, 26, z, "red_concrete")
    put(0, 31, z, "chiseled_quartz_block")


def _bandeira(x, y, z, sentido):
    """Mastro com a bandeira do Vasco (preta com a faixa branca)."""
    col(x, z, y, y + 5, "iron_bars")
    for r, linha in enumerate(["WWBBB", "BWWWB", "BBBWW"]):
        for c, ch in enumerate(linha):
            put(x + sentido * (c + 1), y + 5 - r, z, "white_wool" if ch == "W" else "black_wool")


def _bandeira_grande(x0, y0, z):
    for c in range(9):
        for r in range(6):
            faixa = abs(c * 6 / 9 - (5 - r)) < 1.0
            put(x0 + c, y0 + r, z, "white_wool" if faixa else "black_wool")
    for dx, dy in ((4, 2), (4, 3), (3, 3), (5, 2)):
        put(x0 + dx, y0 + dy, z, "red_wool")


def _interior():
    zi1, zi2 = ZT + 1, FACE - 1
    zm = (zi1 + zi2) // 2
    for sx in (-1, 1):                                  # escadas nas alas: térreo -> 1º -> terraço
        lance((sx * 41, zi1), (sx, 0), (0, 1), -1, 8)
        lance((sx * 49, zi1 + 3), (-sx, 0), (0, 1), 8, 15)
    lance((9, zi1), (0, 1), (1, 0), 8, 14)             # torre leste: 1º andar -> presidência
    box(8, 14, zi1 + 6, 11, 14, zi2, PISO)
    for x in range(-5, 6):                              # saguão: azulejos e lustres
        for y in range(4, 12):
            put(x, y, ZT, "blue_concrete" if (x + y) % 3 == 0 else "white_concrete")
    for x in (-3, 3):
        put(x, 13, zm, "lantern[hanging=true]")
    for x in range(-34, -14, 4):                        # sala de troféus (oeste, térreo)
        for z in (zi1 + 1, zi2 - 1):
            put(x, 0, z, ORN); put(x, 1, z, "polished_blackstone"); put(x, 2, z, "gold_block")
    col(-24, zi1 + 4, 0, 0, ORN)
    col(-24, zi1 + 4, 1, 3, "gold_block")
    for x in range(-48, -14, 6):
        put(x, 7, zm, "lantern[hanging=true]")
    for x in range(16, 36, 6):                          # loja oficial (leste, térreo)
        _camisa(x, 1, ZT + 1)
    for x in range(15, 38):
        put(x, 0, zi1 + 4, ORN)
    for x in range(15, 38, 2):
        put(x, 0, zi2, "barrel[facing=north]"); put(x, 1, zi2, "barrel[facing=north]")
    for x in range(-40, -14):                           # salão nobre (oeste, 1º andar)
        for z in range(zi1 + 1, zi2):
            put(x, 9, z, "red_carpet")
    for x in range(-36, -18):
        put(x, 9, zi1 + 4, "dark_oak_slab[type=top]")
        if x % 2 == 0:
            put(x, 9, zi1 + 3, "dark_oak_stairs[facing=north]")
            put(x, 9, zi1 + 5, "dark_oak_stairs[facing=south]")
    for x in range(-38, -14, 6):
        put(x, 14, zm, "lantern[hanging=true]")
    for z in range(zi1, zi2 + 1):                       # sala de imprensa (leste, 1º andar)
        for y in range(9, 15):
            put(40, y, z, "black_concrete" if ((z // 2) + (y // 2)) % 2 else "white_concrete")
    for z in (zi1 + 2, zi1 + 5):
        put(40, 12, z, "red_concrete")
    for z in range(zi1 + 2, zi2 - 1):
        put(38, 9, z, "dark_oak_slab[type=top]")
    for x in range(22, 35, 3):
        for z in range(zi1 + 1, zi2):
            put(x, 9, z, "spruce_stairs[facing=west]")
    for z in (zi1 + 2, zi2 - 2):
        put(18, 9, z, "iron_bars"); put(18, 10, z, "dispenser[facing=east]")
    for x in range(-5, 6):                              # presidência (mezanino do corpo central)
        for z in range(zi1, zi2 + 1):
            put(x, 15, z, "red_carpet")
    box(-2, 15, zi1 + 2, 2, 15, zi1 + 2, "dark_oak_planks")
    put(0, 15, zi1 + 1, "dark_oak_stairs[facing=north]")
    for x in (-5, 5):
        col(x, zi1, 15, 17, "bookshelf")


def _camisa(x, y, z):
    """Camisa do Vasco (preta com a faixa diagonal branca) pendurada na parede."""
    for r, linha in enumerate(["BB.BB", "BBBBB", "WBBBB", ".WWB.", ".BWW.", ".BBW."]):
        for c, ch in enumerate(linha):
            if ch != ".":
                put(x + c, y + 5 - r, z, "white_wool" if ch == "W" else "black_wool")


def _rua():
    """Rua General Almério de Moura, em frente à fachada, com calçadas e árvores."""
    for x in range(-m.XR, m.XR + 1):
        for z in range(FACE + 1, FACE + 5):
            if get(x, -1, z) == m.MANTER:
                put(x, -1, z, "smooth_stone")
        for z in range(FACE + 5, FACE + 17):
            put(x, -1, z, "gray_concrete")
        if (x // 4) % 2 == 0:
            put(x, -1, FACE + 10, "white_concrete")
        for z in range(FACE + 17, FACE + 20):
            put(x, -1, z, "smooth_stone")
    for x in range(-104, 105, 13):
        if abs(x) > 8 and abs(abs(x) - 54.5) > 4:
            arvore(x, FACE + 3, 5)
    for x in range(-100, 101, 25):
        poste(x, FACE + 18, 7)


# ===================================================================== acessos (estrada)
EST_XR = 310


def acessos():
    """Estrada que liga o castelo aos dois estádios, com placas.

    Modelo centrado em (160, 130) do mundo: o eixo da estrada fica em z = 0 do modelo e a
    entrada do castelo (x = 0 do mundo) fica em x = -160.
    """
    m.configurar(EST_XR, -2, 20)
    _chao()
    for x in range(-300, 301):                   # mundo: x de -140 a 460
        for z in range(-9, 10):
            put(x, -1, z, "gray_concrete" if -5 <= z <= 6 else "smooth_stone")
        if (x // 4) % 2 == 0:
            put(x, -1, 0, "white_concrete")
        if x % 20 == 0:
            poste(x, -8, 7); poste(x, 8, 7)
    for z in range(-29, -9):                     # caminho da frente do castelo até a estrada
        for x in range(-162, -157):
            put(x, -1, z, "smooth_stone")
    # placas: quem vem do castelo olha para o sul e tem o leste à esquerda
    _placa("< MARACANÃ", -100, "white_concrete", "blue_concrete")
    _placa("SÃO JANUÁRIO >", -172, "white_concrete", "black_concrete")


def _placa(texto, x_ini, cor, fundo):
    """Placa ao sul da estrada, de frente para o norte (a leitura vai para oeste)."""
    z = 13
    largura = escrever(texto, (x_ini, 3, z), (-1, 0), cor, fundo=fundo, margem=1)
    for x in (x_ini + 1, x_ini - largura):
        col(x, z, 0, 1, "iron_block")


# ===================================================================== conjunto
ESTRUTURAS = {
    # nome: (função que monta o modelo, deslocamento (x, z) no mundo)
    "maracana": (maracana, (400, -126)),
    "sao_januario": (sao_januario, (-250, 44)),
    "acessos": (acessos, (160, 130)),
}


def main():
    """Monta os modelos e gera as prévias (os estádios só existem no mundo Bedrock)."""
    import os
    import time
    import exportar as ex
    import previa
    saida = os.path.join(os.path.dirname(os.path.abspath(__file__)), "saida")
    for nome, (funcao, _) in ESTRUTURAS.items():
        t = time.time()
        funcao()
        ex.finalizar()
        n = int(((m.grid != m.AR) & (m.grid != m.KEEP)).sum())
        print(f"{nome}: {n:,} blocos ({time.time() - t:.0f} s)", flush=True)
        if nome != "acessos":
            previa.estadio(os.path.join(saida, f"previa_{nome}.png"))


if __name__ == "__main__":
    main()
