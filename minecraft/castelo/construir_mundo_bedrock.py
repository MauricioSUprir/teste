#!/usr/bin/env python3
"""Constrói o castelo num servidor Bedrock oficial e empacota o mundo pronto.

    python3 construir_mundo_bedrock.py /caminho/do/bedrock_server   [--testar]

Precisa do Bedrock Dedicated Server (grátis em minecraft.net/download/server/bedrock).
Gera saida/Castelo_PlayStation.zip: a pasta do mundo (com o castelo e os baús cheios)
e um server.properties pronto, para colocar no servidor do seu computador.
"""
import io
import os
import queue
import re
import shutil
import struct
import subprocess
import sys
import threading
import time
import zipfile

import exportar as ex
import gerar_castelo as g
import modelo as m
import bedrock as bd

AQUI = os.path.dirname(os.path.abspath(__file__))
MUNDO = "Castelo"
CAMADAS = ('{"biome_id":1,"block_layers":[{"block_name":"minecraft:bedrock","count":1},'
           '{"block_name":"minecraft:stone","count":123},{"block_name":"minecraft:dirt","count":3},'
           '{"block_name":"minecraft:grass_block","count":1}],"encoding_version":6,'
           '"structure_options":null,"world_version":"version.post_1_18"}')   # grama em y = 63
PROPRIEDADES = {
    "server-name": "Castelo Enorme", "level-name": MUNDO, "level-type": "FLAT", "gamemode": "survival",
    "difficulty": "easy", "allow-cheats": "true", "allow-list": "false", "online-mode": "true",
    "default-player-permission-level": "operator", "content-log-console-output-enabled": "true",
    "view-distance": "16", "tick-distance": "6",
}


# ------------------------------------------------------------- NBT little-endian (level.dat)
def _ler_nbt(dados):
    pos = [0]

    def ler(fmt):
        v = struct.unpack_from("<" + fmt, dados, pos[0])
        pos[0] += struct.calcsize("<" + fmt)
        return v[0]

    def string():
        n = ler("H")
        s = dados[pos[0]:pos[0] + n].decode("utf-8")
        pos[0] += n
        return s

    def payload(t):
        if t == 1: return ler("b")
        if t == 2: return ler("h")
        if t == 3: return ler("i")
        if t == 4: return ler("q")
        if t == 5: return ler("f")
        if t == 6: return ler("d")
        if t == 7: return [ler("b") for _ in range(ler("i"))]
        if t == 8: return string()
        if t == 9:
            tt = ler("b")
            return (tt, [payload(tt) for _ in range(ler("i"))])
        if t == 10:
            d = {}
            while True:
                tt = ler("b")
                if tt == 0:
                    return d
                k = string()
                d[k] = (tt, payload(tt))
        if t == 11: return [ler("i") for _ in range(ler("i"))]
        if t == 12: return [ler("q") for _ in range(ler("i"))]
        raise ValueError(t)
    t = ler("b")
    nome = string()
    return nome, payload(t)


def _escrever_nbt(nome, raiz):
    out = io.BytesIO()

    def w(fmt, v):
        out.write(struct.pack("<" + fmt, v))

    def string(s):
        b = s.encode("utf-8")
        w("H", len(b)); out.write(b)

    def payload(t, v):
        if t == 1: w("b", v)
        elif t == 2: w("h", v)
        elif t == 3: w("i", v)
        elif t == 4: w("q", v)
        elif t == 5: w("f", v)
        elif t == 6: w("d", v)
        elif t == 7:
            w("i", len(v)); [w("b", x) for x in v]
        elif t == 8: string(v)
        elif t == 9:
            tt, itens = v
            w("b", tt); w("i", len(itens)); [payload(tt, x) for x in itens]
        elif t == 10:
            for k, (tt, vv) in v.items():
                w("b", tt); string(k); payload(tt, vv)
            w("b", 0)
        elif t == 11:
            w("i", len(v)); [w("i", x) for x in v]
        elif t == 12:
            w("i", len(v)); [w("q", x) for x in v]
    w("b", 10); string(nome); payload(10, raiz)
    return out.getvalue()


def ajustar_level_dat(caminho, mudancas):
    with open(caminho, "rb") as f:
        dados = f.read()
    versao = struct.unpack_from("<i", dados, 0)[0]
    nome, raiz = _ler_nbt(dados[8:])
    raiz.update(mudancas)
    corpo = _escrever_nbt(nome, raiz)
    with open(caminho, "wb") as f:
        f.write(struct.pack("<ii", versao, len(corpo)) + corpo)


# ------------------------------------------------------------- servidor
class Servidor:
    def __init__(self, pasta):
        self.pasta = pasta
        self.proc = subprocess.Popen(["./bedrock_server"], cwd=pasta, stdin=subprocess.PIPE,
                                     stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                                     env={**os.environ, "LD_LIBRARY_PATH": "."})
        self.saida = queue.Queue()
        self.log = open(os.path.join(pasta, "console.log"), "a")
        threading.Thread(target=self._ler, daemon=True).start()
        self.esperar(r"Server started", 180)

    def _ler(self):
        for linha in self.proc.stdout:
            self.log.write(linha)
            self.log.flush()
            self.saida.put(linha)

    def esperar(self, padrao, timeout=60):
        fim = time.time() + timeout
        while time.time() < fim:
            try:
                linha = self.saida.get(timeout=0.5)
            except queue.Empty:
                continue
            if re.search(padrao, linha):
                return linha
        raise TimeoutError(padrao)

    def limpar(self):
        while not self.saida.empty():
            self.saida.get()

    def cmd(self, c):
        self.proc.stdin.write(c + "\n")
        self.proc.stdin.flush()

    def parar(self):
        self.cmd("stop")
        self.proc.wait(timeout=120)
        self.log.close()


def preparar(bds, destino):
    """Copia o servidor para `destino`, cria o mundo plano fundo e instala o pacote."""
    shutil.rmtree(destino, ignore_errors=True)
    shutil.copytree(bds, destino, ignore=shutil.ignore_patterns("worlds", "console.log"))
    props = os.path.join(destino, "server.properties")
    linhas = open(props).read().splitlines()
    novas = []
    for l in linhas:
        k = l.split("=")[0]
        novas.append(f"{k}={PROPRIEDADES[k]}" if k in PROPRIEDADES and "=" in l else l)
    open(props, "w").write("\n".join(novas) + "\n")
    srv = Servidor(destino)            # primeira vez: cria o level.dat
    srv.parar()
    mundo = os.path.join(destino, "worlds", MUNDO)
    ajustar_level_dat(os.path.join(mundo, "level.dat"), {
        "FlatWorldLayers": (8, bd_camadas()), "SpawnX": (3, 0), "SpawnY": (3, 64), "SpawnZ": (3, 96),
        "commandsEnabled": (1, 1), "showcoordinates": (1, 1)})
    shutil.rmtree(os.path.join(mundo, "db"), ignore_errors=True)
    return mundo


def bd_camadas():
    return CAMADAS


def instalar_pacote(mundo, grupos):
    destino = os.path.join(mundo, "behavior_packs", "castelo")
    partes = bd.pacote(destino, grupos)
    with open(os.path.join(mundo, "world_behavior_packs.json"), "w") as f:
        f.write('[{"pack_id":"%s","version":[1,0,0]}]' % bd.UUID_H)
    return partes


# ------------------------------------------------------------- estádios e estrada
def dividir(lista, desloc):
    """Divide as caixas em etapas que cabem em até 10 áreas carregadas de até 100 chunks.

    A área da estrutura é cortada em faixas norte-sul; cada etapa carrega até 10 faixas.
    Caixas que atravessam o limite de uma etapa são cortadas, então nenhuma célula é
    escrita por duas etapas (e a ordem dentro de cada etapa é mantida).
    """
    dx, dz = desloc
    x1 = min(c[0] for c in lista) + dx
    x2 = max(c[3] for c in lista) + dx
    z1 = min(c[2] for c in lista) + dz
    z2 = max(c[5] for c in lista) + dz
    cz0, cz1 = z1 // 16, z2 // 16
    largura = max(1, 100 // (cz1 - cz0 + 1))
    faixas = [(c, min(c + largura - 1, x2 // 16)) for c in range(x1 // 16, x2 // 16 + 1, largura)]
    for g0 in range(0, len(faixas), 10):
        grupo = faixas[g0:g0 + 10]
        xa, xb = grupo[0][0] * 16, grupo[-1][1] * 16 + 15
        pedacos = []
        for c in lista:
            a, b = max(c[0] + dx, xa), min(c[3] + dx, xb)
            if a <= b:
                pedacos.append((a - dx, c[1], c[2], b - dx, c[4], c[5], c[6], c[7]))
        areas = [(f0 * 16, cz0 * 16, f1 * 16 + 15, cz1 * 16 + 15) for f0, f1 in grupo]
        yield areas, (xa, xb), pedacos


def _amostra(n, desloc):
    """Blocos sorteados do modelo atual, em coordenadas do mundo, para conferir depois."""
    import random
    import numpy as np
    rnd = random.Random(3)
    celulas = np.argwhere((m.grid != m.AR) & (m.grid != m.KEEP))
    out = []
    for i, j, k in (celulas[rnd.randrange(len(celulas))] for _ in range(n)):
        nome = m.palette[m.grid[i, j, k]]
        est = bd.traduzir(nome)
        if est is None or any(p in nome for p in ("air", "leaves", "water", "cauldron", "grass_block")):
            continue
        out.append((int(i) - m.XR + desloc[0], bd.Y0 + int(j) + m.YMIN, int(k) - m.XR + desloc[1], est))
    return out


def preparar_estadios():
    """Monta o Maracanã, São Januário e a estrada; devolve os grupos de funções e as etapas."""
    import estadios as es
    grupos, etapas = {}, []
    for nome, (funcao, desloc) in es.ESTRUTURAS.items():
        funcao()
        ex.finalizar()
        # o mundo plano já está vazio acima do chão: o ar de lá não vira comando, e nenhuma
        # caixa pode cobri-lo (limpar_acima=True)
        lista = ex.caixas(limpar_acima=True)
        bd.DESLOC[:] = desloc
        amostra = _amostra(3000, desloc)
        for n, (areas, (xa, xb), pedacos) in enumerate(dividir(lista, desloc), start=1):
            cmds, extras = bd.comandos(pedacos)
            grupo = f"{nome}{n}"
            grupos[grupo] = cmds + extras
            etapas.append((grupo, areas, [a for a in amostra if xa <= a[0] <= xb]))
        print(f"{nome}: {sum(len(grupos[e[0]]) for e in etapas if e[0].startswith(nome)):,} comandos", flush=True)
    import cidade                            # Nova York, ladrilho por ladrilho
    total = 0
    for n_lad, (tx, tz) in enumerate(cidade.ladrilhos(), start=1):
        cidade.construir_ladrilho(tx, tz)
        ex.finalizar()
        lista = ex.caixas(limpar_acima=True)
        desloc = (tx + cidade.DESLOC_MUNDO[0], tz + cidade.DESLOC_MUNDO[1])
        bd.DESLOC[:] = desloc
        amostra = _amostra(400, desloc)
        for n, (areas, (xa, xb), pedacos) in enumerate(dividir(lista, desloc), start=1):
            cmds, extras = bd.comandos(pedacos)
            grupo = f"ny{n_lad}_{n}"
            grupos[grupo] = cmds + extras
            total += len(grupos[grupo])
            etapas.append((grupo, areas, [a for a in amostra if xa <= a[0] <= xb]))
    print(f"nova york: {total:,} comandos", flush=True)
    bd.DESLOC[:] = [0, 0]
    m.configurar(100, -34, 92)               # de volta ao tamanho do castelo
    return grupos, etapas


def carregar(srv, areas):
    srv.cmd("tickingarea remove_all")
    time.sleep(1)
    for i, (x1, z1, x2, z2) in enumerate(areas):
        srv.cmd(f"tickingarea add {x1} 0 {z1} {x2} 0 {z2} etapa{i} true")
    pontos = [(x, z) for x1, z1, x2, z2 in areas for x, z in ((x1, z1), (x2, z2))]
    for _ in range(40):
        time.sleep(4)
        if all(_existe(srv, (x, -64, z), "bedrock") for x, z in pontos):
            return
    raise RuntimeError("as áreas não carregaram")


def _existe(srv, pos, estado):
    x, y, z = pos
    srv.limpar()
    srv.cmd(f"testforblock {x} {y} {z} {estado}")
    try:
        linha = srv.esperar(rf"{x},{y},{z}\b|outside|Cannot", 20)
    except TimeoutError:
        return False
    return "Successfully found" in linha


def construir_estadios(srv, partes, etapas, testar=False):
    falhas = 0
    for grupo, areas, amostra in etapas:
        print(f"== {grupo}: carregando {len(areas)} áreas", flush=True)
        carregar(srv, areas)
        for n in range(1, partes[grupo] + 1):
            srv.limpar()
            srv.cmd(f"function {grupo}/parte{n}")
            print("  ", srv.esperar(r"(?i)function|Executed|error|unknown", 300).strip(), flush=True)
            time.sleep(2)
        if testar and amostra:
            erros = [a for a in amostra if not _existe(srv, a[:3], a[3])]
            for e in erros[:10]:
                print("   diferente:", e)
            ok = len(erros) <= max(2, len(amostra) // 100)
            falhas += not ok
            print(f"   [{'ok' if ok else 'FALHOU'}] amostra de {len(amostra)} blocos ({len(erros)} diferentes)",
                  flush=True)
    srv.cmd("tickingarea remove_all")
    time.sleep(2)
    return falhas


def main():
    bds = os.path.abspath(sys.argv[1])
    testar = "--testar" in sys.argv
    destino = os.path.join(AQUI, "servidores", "bedrock-castelo")
    grupos, etapas = preparar_estadios()
    testes = g.construir_tudo()
    lista = ex.caixas(limpar_acima=False)
    cmds, extras = bd.comandos(lista)
    grupos["castelo"] = cmds
    print(f"castelo: {len(cmds):,} comandos de blocos + {len(extras)} de conteúdo", flush=True)
    mundo = preparar(bds, destino)
    partes = instalar_pacote(mundo, grupos)
    srv = Servidor(destino)
    erros = [l for l in open(os.path.join(destino, "console.log")).read().splitlines()
             if re.search(r"(?i)(error|failed|falh)", l)]
    if erros:
        print("\n".join(erros[:40]))
    # carrega a área toda do castelo (áreas de até 100 chunks)
    for i, (x1, z1, x2, z2) in enumerate([(-100, -100, 0, 0), (1, -100, 100, 0), (-100, 1, 0, 100), (1, 1, 100, 100)]):
        srv.cmd(f"tickingarea add {x1} 0 {z1} {x2} 0 {z2} area{i} true")
    time.sleep(25)
    for n in range(1, partes["castelo"] + 1):
        srv.limpar()
        srv.cmd(f"function castelo/parte{n}")
        print(srv.esperar(r"(?i)function|Executed|error|unknown", 120).strip(), flush=True)
        time.sleep(3)
    for c in extras:
        srv.cmd(c)
    time.sleep(3)
    for c in ("setworldspawn 0 64 96", "gamerule showcoordinates true", "time set day"):
        srv.cmd(c)
    time.sleep(2)
    if testar:
        import testar_bedrock
        testar_bedrock.testar(srv, testes)
    srv.cmd("kill @e[type=minecart]")
    for x, y, z in __import__("bases").ESTACOES:
        wx, wy, wz = bd.mundo(x, y, z)
        srv.cmd(f"summon minecart {wx + 0.5} {wy} {wz + 0.5}")
    time.sleep(2)
    srv.cmd("tickingarea remove_all")
    time.sleep(2)
    falhas = construir_estadios(srv, partes, etapas, testar)
    if testar:
        print("\nESTÁDIOS:", "TUDO OK" if not falhas else f"{falhas} etapa(s) com diferenças", flush=True)
    srv.parar()
    empacotar(destino)


def empacotar(destino):
    """Zip com o mundo e o server.properties para o usuário."""
    mundo = os.path.join(destino, "worlds", MUNDO)
    shutil.rmtree(os.path.join(mundo, "behavior_packs"), ignore_errors=True)
    os.remove(os.path.join(mundo, "world_behavior_packs.json"))
    saida = os.path.join(AQUI, "saida", "Castelo_PlayStation.zip")
    with zipfile.ZipFile(saida, "w", zipfile.ZIP_DEFLATED) as zf:
        for raiz, _, arquivos in os.walk(mundo):
            for a in arquivos:
                p = os.path.join(raiz, a)
                zf.write(p, os.path.join("worlds", MUNDO, os.path.relpath(p, mundo)))
        props = open(os.path.join(destino, "server.properties")).read()
        props = props.replace("content-log-console-output-enabled=true", "content-log-console-output-enabled=false")
        zf.writestr("server.properties", props)
    print("pronto:", saida)
    mcworld = os.path.join(AQUI, "saida", "Castelo.mcworld")     # para abrir direto no celular
    with zipfile.ZipFile(mcworld, "w", zipfile.ZIP_DEFLATED) as zf:
        for raiz, _, arquivos in os.walk(mundo):
            for a in arquivos:
                p = os.path.join(raiz, a)
                zf.write(p, os.path.relpath(p, mundo))
    print("pronto:", mcworld)


if __name__ == "__main__":
    main()
