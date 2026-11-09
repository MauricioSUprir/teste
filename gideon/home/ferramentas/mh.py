"""Leitura do modelo base do MakeHuman (CC0) e dos ajustes (targets). Sem dependências além do numpy."""
import gzip, json, os
import numpy as np

class Base:
    def __init__(self, raiz):
        self.raiz = raiz
        v, vt, faces, fuv, grupos_f = [], [], [], [], []
        grupo = None
        with open(os.path.join(raiz, "3dobjs/base.obj")) as f:
            for linha in f:
                if linha.startswith("v "): v.append([float(x) for x in linha.split()[1:4]])
                elif linha.startswith("vt "): vt.append([float(x) for x in linha.split()[1:3]])
                elif linha.startswith("g "): grupo = linha.split()[1]
                elif linha.startswith("f "):
                    pts = [p.split("/") for p in linha.split()[1:]]
                    faces.append([int(p[0]) - 1 for p in pts]); fuv.append([int(p[1]) - 1 if len(p) > 1 and p[1] else -1 for p in pts]); grupos_f.append(grupo)
        self.v = np.array(v, np.float64); self.vt = np.array(vt, np.float64)
        self.faces, self.fuv, self.grupos_f = faces, fuv, grupos_f
        self.vgrupos = json.load(open(os.path.join(raiz, "mesh_metadata/basemesh_vertex_groups.json")))

    def target(self, nome):
        caminho = os.path.join(self.raiz, "targets", nome + ".target.gz")
        d = np.zeros_like(self.v)
        with gzip.open(caminho, "rt") as f:
            for linha in f:
                p = linha.split()
                if len(p) == 4 and not linha.startswith("#"): d[int(p[0])] = [float(x) for x in p[1:]]
        return d

    def indices(self, grupo):
        out = []
        for a, b in self.vgrupos[grupo]: out.extend(range(a, b + 1))
        return np.array(out)
