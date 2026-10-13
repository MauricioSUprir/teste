"""Testes do castelo num servidor Bedrock (chamado por construir_mundo_bedrock.py --testar).

No Bedrock não existe /data, então para saber se um baú ou barril tem itens colocamos
um comparador "sonda" ao lado dele e vemos se acende.
"""
import random
import re
import time

import bedrock as bd
import modelo as m


def perguntar(srv, comando, sucesso, resposta):
    """Envia o comando e espera a linha de resposta que casa com `resposta` (as respostas do
    console podem chegar atrasadas, então não dá para pegar simplesmente a próxima linha)."""
    srv.cmd(comando)
    linha = srv.esperar(resposta, 30)
    return bool(re.search(sucesso, linha))


def bloco(srv, pos, estado):
    x, y, z = bd.mundo(*pos)
    return perguntar(srv, f"testforblock {x} {y} {z} {estado}", r"Successfully found",
                     rf"at {x},{y},{z}\b")


def ver(nome, ok, falhas):
    print(f"   [{'ok' if ok else 'FALHOU'}] {nome}", flush=True)
    if not ok:
        falhas.append(nome)


def setb(srv, pos, estado):
    x, y, z = bd.mundo(*pos)
    srv.cmd(f"setblock {x} {y} {z} {estado}")


def sonda(srv, pos_container, lado):
    """Comparador ao lado do container (em `lado`), lendo-o. Devolve True se acendeu."""
    dx, dz = m.DIRS[lado]
    x, y, z = pos_container
    p = (x + dx, y, z + dz)
    java = f"comparator[facing={m.OPOSTO[lado]},mode=compare,powered=false]"
    setb(srv, p, bd.traduzir(java))
    time.sleep(1.5)
    acesa = bloco(srv, p, "powered_comparator") or bloco(srv, p, 'unpowered_comparator ["output_lit_bit"=true]')
    setb(srv, p, "minecraft:air")
    return acesa


def conferir_amostra(srv, n=4000):
    """Sorteia blocos do modelo e confere no mundo."""
    random.seed(1)
    celulas = [tuple(c) for c in __import__("numpy").argwhere((m.grid != m.AR) & (m.grid != m.KEEP))]
    ordenadas = set(m.pos_ordenadas)
    erros = []
    for i, j, k in random.sample(celulas, n):
        x, y, z = int(i) - m.XR, int(j) + m.YMIN, int(k) - m.XR
        nome = m.palette[m.grid[i, j, k]]
        est = bd.traduzir(nome)
        if est is None or "air" in est or "leaves" in nome or "farmland" in nome or "water" in nome:
            continue
        if (x, y, z) in ordenadas or "rail" in nome or "wire" in nome:
            est = est.split(" [")[0]
            if "comparator" in est or "repeater" in est or "redstone_torch" in est or "lamp" in est:
                continue
        if not bloco(srv, (x, y, z), est):
            erros.append(f"{x} {y} {z} {est}")
    return erros


def testar(srv, _testes=None):
    falhas = []
    print("\n== Conferência de blocos (amostra)", flush=True)
    erros = conferir_amostra(srv)
    for e in erros[:30]:
        print("   diferente:", e)
    ver(f"amostra de blocos ({len(erros)} diferentes)", len(erros) <= 10, falhas)

    print("\n== Porta secreta da biblioteca", flush=True)
    porta = [(-11, 12, -30), (-11, 13, -30)]
    ver("fechada (estantes no lugar)", all(bloco(srv, p, "bookshelf") for p in porta), falhas)
    alav = (-13, 12, -28)
    setb(srv, alav, 'minecraft:lever ["lever_direction"="south","open_bit"=true]')
    time.sleep(2)
    ver("alavanca interna abre", all(bloco(srv, p, "air") for p in porta), falhas)
    setb(srv, alav, 'minecraft:lever ["lever_direction"="south","open_bit"=false]')
    time.sleep(2)
    ver("desligando, fecha de novo", all(bloco(srv, p, "bookshelf") for p in porta), falhas)

    print("\n== Cofre com senha", flush=True)
    import redstone as rs
    porta_cofre = (25, -26, -37)

    def alavancas(bits):
        for i, bit in enumerate(bits):
            setb(srv, (12 + 2 * i, -25, -36),
                 'minecraft:lever ["lever_direction"="south","open_bit"=%s]' % ("true" if bit else "false"))
        time.sleep(2)
    ver("começa fechada", bloco(srv, porta_cofre, 'iron_door ["open_bit"=false]'), falhas)
    errada = list(rs.SENHA); errada[1] = 1 - errada[1]
    alavancas(errada)
    ver("senha errada: fechada", bloco(srv, porta_cofre, 'iron_door ["open_bit"=false]'), falhas)
    alavancas(rs.SENHA)
    ver("senha certa: abre", bloco(srv, porta_cofre, 'iron_door ["open_bit"=true]'), falhas)
    alavancas([0] * len(rs.SENHA))
    ver("zerou: fecha", bloco(srv, porta_cofre, 'iron_door ["open_bit"=false]'), falhas)

    print("\n== Separador de itens", flush=True)
    ex, ey, ez = bd.mundo(-28, -23, -24)
    itens = rs.ITENS_SEPARADOR
    for slot, item in enumerate(itens[:4] + ["dirt"]):
        srv.cmd(f"replaceitem block {ex} {ey} {ez} slot.container {slot} minecraft:{item} 10")
    time.sleep(70)
    for k, item in enumerate(itens[:4]):
        ver(f"barril de {item} recebeu", sonda(srv, (-26 + 3 * k, -26, -23), "south"), falhas)
    ver("barril de carvão (não enviado) vazio", not sonda(srv, (-26 + 3 * 5, -26, -23), "south"), falhas)
    ver("sobras receberam a terra", sonda(srv, (-3, -24, -24), "north"), falhas)

    print("\n== Elevadores de bolhas", flush=True)
    for x, z, y in ((-20, -44, -7), (-16, -44, -7), (26, 38, -13), (28, 38, -13)):
        ver(f"coluna de bolhas em x={x}", bloco(srv, (x, y, z), "bubble_column"), falhas)

    print("\n== Postes automáticos", flush=True)
    srv.cmd("time set noon"); time.sleep(3)
    ver("de dia: apagado", bloco(srv, (-4, 3, 4), "redstone_lamp"), falhas)
    srv.cmd("time set midnight"); time.sleep(3)
    ver("à noite: aceso", bloco(srv, (-4, 3, 4), "lit_redstone_lamp"), falhas)
    srv.cmd("time set noon")

    print("\n== Metrô", flush=True)
    for nome, partida, botao, chegada in (("QG -> Refúgio do Poço", (3, -26, -32), (3, -25, -32), (34, -26, 45)),
                                          ("QG -> Base Submarina", (-3, -26, -32), (-3, -25, -32), (-86, -11, -32))):
        x, y, z = bd.mundo(*partida)
        srv.cmd(f"summon minecart {x + 0.5} {y} {z + 0.5}")
        time.sleep(2)
        setb(srv, botao, "minecraft:redstone_block")
        time.sleep(1)
        lado = "east" if partida[0] > 0 else "west"
        setb(srv, botao, bd.traduzir(f"stone_button[face=wall,facing={lado},powered=false]"))
        time.sleep(25)
        cx, cy, cz = bd.mundo(*chegada)
        time.sleep(1)
        srv.limpar()
        ok = perguntar(srv, f"testfor @e[type=minecart,x={cx},y={cy},z={cz},r=3]", r"Found", r"Found|No targets")
        ver(f"{nome}: carrinho chegou", ok, falhas)
        srv.cmd("kill @e[type=minecart]")

    print("\n== Alarme com armadilha", flush=True)
    lamp = (-96, -12, -26)
    ver("desligado", bloco(srv, lamp, "redstone_lamp"), falhas)
    x, y, z = bd.mundo(-97, -11, -23)
    srv.cmd(f"summon arrow {x + 0.5} {y + 0.2} {z + 0.5}")   # bichos quase não se mexem sem jogador perto
    time.sleep(2)
    ver("fio cruzado: lâmpada acende", bloco(srv, lamp, "lit_redstone_lamp"), falhas)
    srv.cmd("kill @e[type=arrow]")

    print("\n== Baús equipados", flush=True)
    for pos, lado, nome in (((-9, -26, -38), "south", "QG: kit de netherite"),
                            ((13, -25, -50), "north", "cofre: tesouro"),
                            ((-3, 23, -48), "south", "aposento do rei")):
        ver(nome, sonda(srv, pos, lado), falhas)

    print(f"\n{'TUDO OK' if not falhas else 'FALHAS: ' + ', '.join(falhas)}", flush=True)
    return not falhas
