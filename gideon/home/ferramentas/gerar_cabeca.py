"""GIDEON — gera a cabeça 3D do rosto holográfico (home/rosto-cabeca.js) a partir do modelo base do MakeHuman (CC0).

Por que assim: a cabeça antiga era montada por código (rosto do MediaPipe + crânio, orelhas e pescoço aproximados) e ficava
artificial. O MakeHuman tem um corpo humano modelado por artistas, com crânio, orelhas, pálpebras e pescoço de verdade, e
"expressões" prontas (piscar, abrir a boca, sorrir, fazer bico). Tudo CC0: pode usar sem pedir licença.

O rosto é ORIGINAL: mulher adulta jovem, mistura igual dos três tipos-base do MakeHuman (não é nenhuma pessoa real),
com alguns ajustes de forma para ficar no estilo do logo (rosto oval e elegante, maxilar fino, maçãs marcadas).

Uso:  python3 gerar_cabeca.py /caminho/para/mpfb2/src/mpfb/data
(o MPFB2 é o repositório github.com/makehumancommunity/mpfb2; só precisa das pastas 3dobjs, mesh_metadata e targets)
"""
import base64, json, os, sys
import numpy as np
from mh import Base

RAIZ = sys.argv[1] if len(sys.argv) > 1 else "/home/user/makehumancommunity/mpfb2/src/mpfb/data"
SAIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "rosto-cabeca.js")

RACAS = ["african", "asian", "caucasian"]
# Forma do rosto (alvo do MakeHuman → peso). Pequenos ajustes, no estilo do logo e do holograma.
FORMA = {
    "head/head-oval": 0.85, "head/head-scale-vert-incr": 0.3, "head/head-scale-horiz-decr": 0.3,
    "chin/chin-width-decr": 0.55, "chin/chin-height-decr": 0.1, "chin/chin-prominent-incr": 0.25, "chin/chin-bones-decr": 0.3,
    "cheek/l-cheek-bones-incr": 0.6, "cheek/r-cheek-bones-incr": 0.6,
    "cheek/l-cheek-volume-decr": 0.55, "cheek/r-cheek-volume-decr": 0.55, "cheek/l-cheek-inner-decr": 0.3, "cheek/r-cheek-inner-decr": 0.3,
    "nose/nose-scale-horiz-decr": 0.35, "nose/nose-point-width-decr": 0.4, "nose/nose-point-up": 0.25, "nose/nose-flaring-decr": 0.3,
    "mouth/mouth-upperlip-volume-incr": 0.4, "mouth/mouth-lowerlip-volume-incr": 0.35, "mouth/mouth-angles-up": 0.35,
    "mouth/mouth-cupidsbow-incr": 0.5, "mouth/mouth-scale-horiz-decr": 0.1,
    "eyes/l-eye-scale-incr": 0.2, "eyes/r-eye-scale-incr": 0.2,
    "eyes/l-eye-corner2-up": 0.35, "eyes/r-eye-corner2-up": 0.35,
    "eyebrows/eyebrows-angle-up": 0.3, "forehead/forehead-temple-decr": 0.3,
    "neck/neck-scale-horiz-decr": 0.4, "neck/measure-neck-height-incr": 0.35, "neck/neck-scale-depth-decr": 0.2,
}
# Expressões (unidades do MakeHuman, média dos três tipos-base) que o rosto usa ao vivo
EXPRESSOES = {
    "abre": "mouth-open", "bico": "mouth-pursing", "sorri": "mouth-corner-puller", "estica": "mouth-retraction",
    "pisca_e": "eye-left-closure", "pisca_d": "eye-right-closure",
    "sobe_e": "eyebrows-left-up", "sobe_d": "eyebrows-right-up",
}
CORTE = 5.25   # altura (dm) abaixo da qual a malha é cortada: fica a cabeça e o pescoço
ESCALA = 10.0  # MakeHuman usa decímetros; a cena usa centímetros

b = Base(RAIZ)
v = b.v.copy()
for r in RACAS: v += b.target(f"macrodetails/{r}-female-young") / len(RACAS)
v += b.target("macrodetails/universal-female-young-averagemuscle-averageweight")
for nome, peso in FORMA.items(): v += peso * b.target(nome)

# ---------- recorte: só faces do corpo com todos os vértices acima do corte ----------
corpo = [k for k, g in enumerate(b.grupos_f) if g == "body"]
faces = [k for k in corpo if all(v[i, 1] > CORTE for i in b.faces[k])]
# dentes e língua (ficam dentro da boca, aparecem fracos quando ela abre; as expressões também os movem)
BOCA_DENTRO = ("helper-upper-teeth", "helper-lower-teeth", "helper-tongue")
facesBoca = [k for k, g in enumerate(b.grupos_f) if g in BOCA_DENTRO]
# vértices usados, renumerados (sem separar costuras: o efeito de pontos não usa o mapa de textura)
usados = sorted({i for k in faces + facesBoca for i in b.faces[k]})
novo = {vi: n for n, vi in enumerate(usados)}
orig = np.array(usados)
tri, arestas = [], set()
for k in faces:
    ids = [novo[i] for i in b.faces[k]]
    for j in range(1, len(ids) - 1): tri += [ids[0], ids[j], ids[j + 1]]
    for j in range(len(ids)): a, c = ids[j], ids[(j + 1) % len(ids)]; arestas.add((min(a, c), max(a, c)))  # linhas do quadriculado (sem diagonais)
arestas = sorted(arestas)
triBoca = []
for k in facesBoca:
    ids = [novo[i] for i in b.faces[k]]
    for j in range(1, len(ids) - 1): triBoca += [ids[0], ids[j], ids[j + 1]]

# posição: centímetros, centro dos olhos em (0, 2.7) e ponta do nariz por volta de z = 6
olhoE, olhoD = b.indices("helper-l-eye"), b.indices("helper-r-eye")
centroOlhos = (v[olhoE].mean(0) + v[olhoD].mean(0)) / 2
desloc = np.array([0.0, 2.7, 2.2]) - centroOlhos * ESCALA
P = v[orig] * ESCALA + desloc

olhos = []
for g in (olhoE, olhoD):
    c = v[g].mean(0) * ESCALA + desloc; r = np.linalg.norm(v[g] * ESCALA + desloc - c, axis=1).mean()
    olhos.append([round(float(x), 3) for x in (*c, r)])

# centro da boca: entre o lábio de cima e o de baixo, no meio do rosto (o lábio de baixo é o que mais desce ao abrir)
dAbre = (sum(b.target(f"expression/units/{r}/mouth-open") for r in RACAS) / len(RACAS))[orig] * ESCALA
meio = np.abs(P[:, 0]) < 0.25
iBaixo = np.argmin(np.where(meio & (P[:, 2] > P[meio, 2].max() - 3), dAbre[:, 1], 9))
boca = [0.0, round(float(P[iBaixo, 1] + 0.35), 3), round(float(P[iBaixo, 2] - 0.4), 3)]

morfs = {}
for nome, alvo in EXPRESSOES.items():
    d = sum(b.target(f"expression/units/{r}/{alvo}") for r in RACAS) / len(RACAS)
    d = d[orig] * ESCALA
    sel = np.nonzero(np.abs(d).max(1) > 1e-3)[0]
    morfs[nome] = {"i": sel.astype(np.uint16), "d": d[sel].astype(np.float32)}

# ---------- relevo (cavidades e saliências), calculado uma vez e usado pelo sombreamento ----------
viz = [set() for _ in range(len(orig))]
for a, c in arestas: viz[a].add(c); viz[c].add(a)
vizL = [np.array(sorted(x)) for x in viz]
def normais(Q):
    T3 = np.array(tri).reshape(-1, 3); n = np.zeros_like(Q)
    fn = np.cross(Q[T3[:, 1]] - Q[T3[:, 0]], Q[T3[:, 2]] - Q[T3[:, 0]])
    for k in range(3): np.add.at(n, T3[:, k], fn)
    return n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-9)
def alisar(Q, vezes):
    for _ in range(vezes): Q = 0.5 * Q + 0.5 * np.array([Q[x].mean(0) if len(x) else Q[i] for i, x in enumerate(vizL)])
    return Q
Nrm = normais(P)
def relevo(vezes):
    r = ((P - alisar(P.copy(), vezes)) * Nrm).sum(1)  # >0 saliência, <0 cavidade
    return r / (np.percentile(np.abs(r), 97) + 1e-9)
rel = np.clip(0.45 * relevo(3) + 0.55 * relevo(14), -1.5, 1.5)
rel = alisar(rel[:, None], 2)[:, 0]
print("relevo: min %.2f max %.2f" % (rel.min(), rel.max()))

b64 = lambda a: base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()
dados = {
    "n": len(orig), "pos": b64(P.astype(np.float32)), "tri": b64(np.array(tri, np.uint16)), "triBoca": b64(np.array(triBoca, np.uint16)), "arestas": b64(np.array(arestas, np.uint16)),
    "boca": boca, "relevo": b64(np.clip(rel * 90, -127, 127).astype(np.int8)),
    "olhos": olhos, "morfs": {k: {"i": b64(m["i"]), "d": b64(m["d"])} for k, m in morfs.items()},
}
with open(SAIDA, "w") as f:
    f.write("// Gerado por ferramentas/gerar_cabeca.py a partir do modelo base do MakeHuman (CC0). Não editar à mão.\n")
    f.write("export const CABECA = " + json.dumps(dados, separators=(",", ":")) + ";\n")
print(f"vértices {len(orig)}, triângulos {len(tri)//3} + boca {len(triBoca)//3}, arestas {len(arestas)}, olhos {olhos}, boca {boca}")
print("altura (cm): y de %.1f a %.1f; z de %.1f a %.1f; largura %.1f" % (P[:,1].min(), P[:,1].max(), P[:,2].min(), P[:,2].max(), P[:,0].max()-P[:,0].min()))
print({k: len(m["i"]) for k, m in morfs.items()}, "tamanho", os.path.getsize(SAIDA) // 1024, "KB")
