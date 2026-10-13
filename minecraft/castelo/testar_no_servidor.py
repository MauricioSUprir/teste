#!/usr/bin/env python3
"""Testa o castelo num servidor Minecraft Java de verdade (sem precisar abrir o jogo).

  python3 testar_no_servidor.py sistemas [versão]   # cada sistema de redstone sozinho
  python3 testar_no_servidor.py castelo  [versão]   # castelo inteiro: confere bloco a bloco
                                                    # e roda os testes dos sistemas no lugar

Baixa o server.jar oficial da Mojang para ./servidores/ na primeira vez.
Use JAVA=/caminho/do/java se a versão pedir um Java mais novo (26.x pede Java 25).
"""
import json
import os
import queue
import re
import shutil
import subprocess
import sys
import threading
import time
import urllib.request
import zipfile

import numpy as np

import modelo as m
import exportar as ex

AQUI = os.path.dirname(os.path.abspath(__file__))
SERVIDORES = os.path.join(AQUI, "servidores")


def baixar_servidor(versao):
    os.makedirs(SERVIDORES, exist_ok=True)
    jar = os.path.join(SERVIDORES, f"server-{versao}.jar")
    if not os.path.exists(jar):
        manifesto = json.load(urllib.request.urlopen(
            "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json"))
        url = next(v["url"] for v in manifesto["versions"] if v["id"] == versao)
        info = json.load(urllib.request.urlopen(url))
        print(f"baixando servidor {versao}...", flush=True)
        urllib.request.urlretrieve(info["downloads"]["server"]["url"], jar)
    return jar


class Servidor:
    def __init__(self, versao, pasta, datapacks):
        self.pasta = pasta
        shutil.rmtree(pasta, ignore_errors=True)
        os.makedirs(os.path.join(pasta, "world", "datapacks"))
        with open(os.path.join(pasta, "eula.txt"), "w") as f:
            f.write("eula=true\n")
        with open(os.path.join(pasta, "server.properties"), "w") as f:
            f.write("level-type=minecraft\\:flat\ngenerate-structures=false\nonline-mode=false\n"
                    "spawn-protection=0\nmax-tick-time=-1\nview-distance=4\nsimulation-distance=4\n"
                    "spawn-monsters=false\nspawn-animals=false\npause-when-empty-seconds=0\n")
        for dp in datapacks:
            shutil.copy(dp, os.path.join(pasta, "world", "datapacks"))
        java = os.environ.get("JAVA", "java")
        self.proc = subprocess.Popen([java, "-Xmx4G", "-jar", baixar_servidor(versao), "nogui"],
                                     cwd=pasta, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                     stderr=subprocess.STDOUT, text=True)
        self.saida = queue.Queue()
        self.log = open(os.path.join(pasta, "console.log"), "w")
        threading.Thread(target=self._ler, daemon=True).start()
        self.esperar(r"Done \(", 300)

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

    def cmd(self, c):
        self.proc.stdin.write(c + "\n")
        self.proc.stdin.flush()

    def perguntar(self, condicao):
        """Executa `execute <condicao>` e devolve True/False."""
        self.cmd(f"execute {condicao} run say SIM")
        self.cmd("say FIM")
        sim = False
        while True:
            linha = self.esperar(r"\[Server\] (SIM|FIM)", 30)
            if "SIM" in linha:
                sim = True
            else:
                return sim

    def construir(self, namespace, origem, zona):
        (x1, z1), (x2, z2) = zona
        self.cmd(f"forceload add {x1} {z1} {x2} {z2}")
        time.sleep(3)
        x, y, z = origem
        self.cmd(f"execute positioned {x} {y} {z} run function {namespace}:construir")
        time.sleep(4)
        for _ in range(240):
            if self.perguntar(f"unless entity @e[type=minecraft:marker,tag={namespace}_origem]"):
                self.cmd(f"forceload add {x1} {z1} {x2} {z2}")   # o datapack solta a área no fim
                time.sleep(3)
                return
            time.sleep(1)
        raise TimeoutError("construção não terminou")

    def parar(self):
        self.cmd("stop")
        self.proc.wait(timeout=120)
        self.log.close()


def rodar_passos(srv, teste, mundo):
    """Executa os passos de um roteiro. `mundo(x,y,z)` converte coordenadas do modelo."""
    def pos(p):
        return "%d %d %d" % mundo(*p)
    ok = True
    print(f"\n== {teste['nome']}")
    for passo in teste["passos"]:
        tipo = passo[0]
        if tipo == "espera":
            time.sleep(passo[1])
        elif tipo == "cmd":
            texto, p = passo[1], passo[2]
            if p:
                x, y, z = mundo(*p)
                texto = texto.replace("{centro}", f"{x + 0.5} {y} {z + 0.5}").replace("{}", pos(p))
            srv.cmd(texto)
        elif tipo == "cutucar":
            # troca um bloco por outro e volta, para avisar os vizinhos (como uma atualização do jogo)
            _, p, bloco = passo
            srv.cmd(f"setblock {pos(p)} minecraft:bedrock")
            srv.cmd(f"setblock {pos(p)} minecraft:{bloco}")
        elif tipo == "alavanca":
            # como um clique: troca a alavanca e "cutuca" o bloco onde ela está presa
            _, p, estado, anexo, bloco = passo
            srv.cmd(f"setblock {pos(p)} minecraft:air")
            srv.cmd(f"setblock {pos(p)} minecraft:{estado}")
            srv.cmd(f"setblock {pos(anexo)} minecraft:bedrock")
            srv.cmd(f"setblock {pos(anexo)} minecraft:{bloco}")
        else:
            if tipo == "bloco":
                cond = f"if block {pos(passo[1])} minecraft:{passo[2]}"
            elif tipo == "dados":
                cond = f"if data block {pos(passo[1])} {passo[2]}"
            elif tipo == "sem_dados":
                cond = f"unless data block {pos(passo[1])} {passo[2]}"
            elif tipo == "entidade":
                x, y, z = mundo(*passo[2])
                cond = f"if entity @e[type=minecraft:{passo[1]},x={x + 0.5},y={y},z={z + 0.5},distance=..{passo[3]}]"
            passou = srv.perguntar(cond)
            ok &= passou
            print(f"   [{'ok' if passou else 'FALHOU'}] {passo[-1]}")
    return ok


# --------------------------------------------------------------- sistemas
def montar_sistemas():
    """Constrói cada sistema isolado, lado a lado, num modelo vazio (tudo "manter")."""
    import redstone as rs
    m.resetar()
    m.grid[:] = m.KEEP
    testes = []
    origens = iter([(-90, -50), (-40, -50), (10, -50), (-90, 0), (-40, 0), (-10, 0), (20, 0), (50, 0)])
    construtores = [
        lambda q: rs.porta_secreta_biblioteca(q),
        lambda q: rs.cofre_com_senha(q),
        lambda q: rs.separador_de_itens(q),
        lambda q: rs.elevador_de_bolhas(q, 12),
        lambda q: rs.elevador_de_bolhas(q, 12, descer=True),
        lambda q: rs.poste_automatico(q),
        lambda q: rs.alarme_com_armadilha(q),
        lambda q: rs.linha_de_metro(q, 40),
    ]
    for construir in construtores:
        x, z = next(origens)
        testes.append(construir(rs.Quadro(x, 20, z, "east", "south")))
    ex.conectar()
    return testes


def main():
    modo = sys.argv[1] if len(sys.argv) > 1 else "sistemas"
    versao = sys.argv[2] if len(sys.argv) > 2 else "1.21.11"
    pasta = os.path.join(SERVIDORES, f"teste-{modo}-{versao}")
    os.makedirs(SERVIDORES, exist_ok=True)
    if modo == "sistemas":
        testes = montar_sistemas()
        cmds = [ex.comando_java(c, zoff=0) for c in ex.caixas(limpar_acima=False)]
        dp = os.path.join(SERVIDORES, "teste_sistemas.zip")
        ex.datapack(dp, "teste", cmds, zona=((-100, -70), (100, 60)), titulo="Teste")
        srv = Servidor(versao, pasta, [dp])
        srv.construir("teste", (0, 0, 0), ((-100, -70), (100, 60)))
        mundo = lambda x, y, z: (x, y, z)
    else:
        import gerar_castelo as g
        testes = g.construir_tudo()
        g.exportar_tudo(previas=False)
        srv = Servidor(versao, pasta, [os.path.join(g.SAIDA, "castelo_datapack.zip")])
        srv.construir("castelo", (0, 0, 0), ((-m.XR, -m.XR + m.ZOFF), (m.XR, m.XR + m.ZOFF)))
        mundo = lambda x, y, z: (x, y, z + m.ZOFF)
        ok_blocos = conferir_blocos(srv, mundo)
    resultados = [rodar_passos(srv, t, mundo) for t in testes]
    srv.parar()
    if modo == "castelo":
        print(f"\nblocos conferidos: {'ok' if ok_blocos else 'COM ERROS'}")
    print(f"\n{sum(resultados)}/{len(resultados)} sistemas passaram")
    sys.exit(0 if all(resultados) and (modo != "castelo" or ok_blocos) else 1)


def conferir_blocos(srv, mundo, max_erros=60):
    """Compara cada bloco do mundo com o modelo (ar acima do chão por amostragem)."""
    import gerar_castelo as g
    ignorar = g.areas_imprevisiveis()
    linhas = []
    for i, j, k in np.argwhere(m.grid != m.KEEP):
        x, y, z = int(i) - m.XR, int(j) + m.YMIN, int(k) - m.XR
        nome = m.palette[m.grid[i, j, k]]
        if nome == "minecraft:air" and y >= 0 and (i + j + k) % 9:
            continue
        if any(f(x, y, z) for f in ignorar):
            continue
        estado = nome
        if (x, y, z) in m.pos_ordenadas or "leaves" in nome or "farmland" in nome:
            estado = nome.split("[")[0]      # redstone etc.: o estado (ligado/desligado) varia
        wx, wy, wz = mundo(x, y, z)
        linhas.append(f"execute unless block {wx} {wy} {wz} {estado} run say ERRO {wx} {wy} {wz} {estado}")
    partes = [linhas[i:i + 60000] for i in range(0, len(linhas), 60000)]
    dp = os.path.join(srv.pasta, "world", "datapacks", "conferir.zip")
    with zipfile.ZipFile(dp, "w") as zf:
        zf.writestr("pack.mcmeta", ex.pack_mcmeta("conferir"))
        for n, p in enumerate(partes):
            zf.writestr(f"data/conferir/function/p{n}.mcfunction", "\n".join(p) + "\n")
    srv.cmd("reload")
    time.sleep(15)
    print(f"conferindo {len(linhas):,} blocos...", flush=True)
    erros = []
    for n in range(len(partes)):
        srv.cmd(f"function conferir:p{n}")
    srv.cmd("say FIM_CONFERENCIA")
    while True:
        linha = srv.esperar(r"\[Server\] (ERRO|FIM_CONFERENCIA)", 900)
        if "FIM_CONFERENCIA" in linha:
            break
        erros.append(linha.split("ERRO ")[1].strip())
    print(f"blocos diferentes do modelo: {len(erros)}")
    for e in erros[:max_erros]:
        print("   ", e)
    return not erros


if __name__ == "__main__":
    main()
