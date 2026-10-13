"""Sistemas de redstone do castelo.

Cada sistema é desenhado num quadro local (u, v, h):
  u = ao longo da parede/linha, v = atravessando (para "dentro" do mecanismo), h = altura.
Um `Quadro` converte para as coordenadas do modelo e traduz direções como "+u" ou "-v"
nos estados dos blocos (ex.: "sticky_piston[facing={+u}]").

Cada função devolve um roteiro de teste: passos executados num servidor real por
testar_no_servidor.py para provar que o mecanismo funciona.
"""
import re

import modelo as m


class Quadro:
    def __init__(self, ox, oy, oz, u="east", v="south"):
        self.o = (ox, oy, oz)
        self.un, self.vn = u, v
        self.u, self.v = m.DIRS[u], m.DIRS[v]

    def p(self, u, v, h):
        ox, oy, oz = self.o
        return (ox + u * self.u[0] + v * self.v[0], oy + h, oz + u * self.u[1] + v * self.v[1])

    def d(self, token):
        return {"+u": self.un, "-u": m.OPOSTO[self.un], "+v": self.vn, "-v": m.OPOSTO[self.vn]}[token]

    def fmt(self, estado):
        return re.sub(r"\{([+-][uv])\}", lambda mt: self.d(mt.group(1)), estado)

    def put(self, u, v, h, b):
        m.put(*self.p(u, v, h), self.fmt(b))

    def box(self, u1, v1, h1, u2, v2, h2, b):
        (x1, y1, z1), (x2, y2, z2) = self.p(u1, v1, h1), self.p(u2, v2, h2)
        m.box(x1, y1, z1, x2, y2, z2, self.fmt(b))

    def ordenado(self, u, v, h, b, nbt=""):
        m.ordenado(*self.p(u, v, h), self.fmt(b), nbt)

    def porta(self, u, v, h, material, facing, **kw):
        m.porta(*self.p(u, v, h), material, self.fmt(facing), **kw)


# ---------------------------------------------------------------- S1
def porta_secreta_biblioteca(q):
    """Estante que se abre quando um livro é colocado no atril ao lado.

    A "porta" é uma coluna de 2 estantes em (0,0,0) e (0,0,1). Um pistão grudento
    embaixo puxa a de baixo para o chão e outro em cima puxa a de cima para o teto.
    Biblioteca no lado -v; passagem secreta no lado +v (corredor em v=1 indo para -u).
    Atril em (1,-1,0). Por dentro, uma alavanca em (2,2,0) abre a porta.
    """
    # porta e mecanismo vertical
    q.put(0, 0, 0, "bookshelf")
    q.put(0, 0, 1, "bookshelf")
    q.ordenado(0, 0, -2, "sticky_piston[facing=up,extended=true]")
    q.ordenado(0, 0, -1, "piston_head[facing=up,type=sticky,short=false]")
    q.ordenado(0, 0, 3, "sticky_piston[facing=down,extended=true]")
    q.ordenado(0, 0, 2, "piston_head[facing=down,type=sticky,short=false]")
    # leitura do atril através da estante (1,0,0)
    q.put(1, 0, 0, "bookshelf")
    q.ordenado(1, -1, 0, "lectern[facing={-v},has_book=false,powered=false]")
    q.put(1, 1, -1, "smooth_stone")
    q.ordenado(1, 1, 0, "comparator[facing={-v},mode=compare,powered=false]")
    q.put(1, 2, 0, "smooth_stone")                     # K: fica energizado com o livro
    q.ordenado(2, 2, 0, "lever[face=wall,facing={+u},powered=false]")  # abre por dentro
    # ramo de cima: tocha inversora + linha até o pistão de cima
    q.ordenado(1, 2, 1, "redstone_torch[lit=true]")
    q.put(1, 2, 2, "smooth_stone")
    q.put(0, 2, 2, "smooth_stone")
    q.put(0, 1, 2, "smooth_stone")
    q.ordenado(1, 2, 3, "redstone_wire")
    q.ordenado(0, 2, 3, "redstone_wire")
    q.ordenado(0, 1, 3, "redstone_wire")
    # ramo de baixo: pó sob K até a tocha que alimenta o pistão de baixo
    q.put(1, 2, -2, "smooth_stone")
    q.put(0, 2, -2, "smooth_stone")
    q.ordenado(1, 2, -1, "redstone_wire")
    q.ordenado(0, 2, -1, "redstone_wire")
    q.ordenado(0, 1, -2, "redstone_wall_torch[facing={-v},lit=true]")
    q.put(0, 1, -1, "glass")                           # piso do corredor sobre a tocha
    for p in ((1, 1, 1), (1, 1, 2), (2, 2, 1), (1, 3, 1), (0, 2, 1), (0, 2, 0)):
        q.put(*p, "air")
    livro = '{Book:{id:"minecraft:writable_book",count:1},Page:0}'
    return {
        "nome": "Porta secreta da biblioteca",
        "passos": [
            ("espera", 2),
            ("bloco", q.p(0, 0, 0), "bookshelf", "fechada: estante de baixo no lugar"),
            ("bloco", q.p(0, 0, 1), "bookshelf", "fechada: estante de cima no lugar"),
            ("cmd", "setblock {} " + q.fmt("lectern[facing={-v},has_book=true]") + livro, q.p(1, -1, 0)),
            ("cutucar", q.p(1, 0, 0), "bookshelf"),
            ("espera", 2),
            ("bloco", q.p(0, 0, 0), "air", "aberta: vão de baixo livre"),
            ("bloco", q.p(0, 0, 1), "air", "aberta: vão de cima livre"),
            ("cmd", "setblock {} " + q.fmt("lectern[facing={-v},has_book=false]"), q.p(1, -1, 0)),
            ("cutucar", q.p(1, 0, 0), "bookshelf"),
            ("espera", 2),
            ("bloco", q.p(0, 0, 0), "bookshelf", "fechou de novo (baixo)"),
            ("bloco", q.p(0, 0, 1), "bookshelf", "fechou de novo (cima)"),
            ("alavanca", q.p(2, 2, 0), q.fmt("lever[face=wall,facing={+u},powered=true]"), q.p(1, 2, 0), "smooth_stone"),
            ("espera", 2),
            ("bloco", q.p(0, 0, 0), "air", "alavanca interna abre (baixo)"),
            ("bloco", q.p(0, 0, 1), "air", "alavanca interna abre (cima)"),
            ("alavanca", q.p(2, 2, 0), q.fmt("lever[face=wall,facing={+u},powered=false]"), q.p(1, 2, 0), "smooth_stone"),
            ("espera", 2),
            ("bloco", q.p(0, 0, 0), "bookshelf", "alavanca desligada fecha"),
        ],
    }


# ---------------------------------------------------------------- S2
SENHA = (1, 0, 1, 1, 0, 1)   # 1 = alavanca ligada


def cofre_com_senha(q, senha=SENHA):
    """Painel com alavancas em (2i, -1, 1). A porta de ferro em (2n+1, 0, 0) só abre com a senha.

    Atrás do painel: para cada alavanca que deve ficar LIGADA, uma tocha (inversor);
    para as que devem ficar DESLIGADAS, um repetidor. Tudo cai numa linha OU: se qualquer
    alavanca estiver errada a linha acende e a tocha final apaga, mantendo a porta fechada.
    """
    n = len(senha)
    fim = 2 * n           # última posição da linha; o bloco X fica em fim+1
    up = fim + 1          # coluna da porta
    q.box(-1, 0, -1, up + 1, 3, 2, "polished_deepslate")
    q.box(0, 1, 0, fim, 2, 2, "air")
    for i, bit in enumerate(senha):
        u = 2 * i
        q.put(u, 0, 1, "polished_deepslate")
        q.ordenado(u, -1, 1, "lever[face=wall,facing={-v},powered=false]")
        if bit:
            q.ordenado(u, 1, 1, "redstone_wall_torch[facing={+v},lit=true]")
        else:
            q.put(u, 1, 0, "polished_deepslate")          # apoio do repetidor
            q.ordenado(u, 1, 1, "repeater[facing={-v},delay=1,locked=false,powered=false]")
    for u in range(0, fim + 1):
        q.put(u, 2, 0, "polished_deepslate")
        q.ordenado(u, 2, 1, "redstone_wire")
    q.put(up, 2, 1, "polished_deepslate")           # X
    q.put(up, 1, 0, "air")
    q.put(up, 1, 2, "air")
    q.ordenado(up, 1, 1, "redstone_wall_torch[facing={-v},lit=false]")
    q.porta(up, 0, 0, "iron", "{+v}")
    q.put(up + 1, 0, 0, "polished_deepslate")
    q.ordenado(up + 1, 1, 0, "stone_button[face=wall,facing={+v},powered=false]")
    passos = [("espera", 2), ("bloco", q.p(up, 0, 0), "iron_door[open=false]", "porta começa fechada")]

    def alavancas(bits):
        out = []
        for i, bit in enumerate(bits):
            out.append(("alavanca", q.p(2 * i, -1, 1), q.fmt(
                f"lever[face=wall,facing={{-v}},powered={'true' if bit else 'false'}]"),
                q.p(2 * i, 0, 1), "polished_deepslate"))
        return out
    errada = list(senha)
    errada[1] = 1 - errada[1]
    passos += alavancas(errada) + [("espera", 2),
                                   ("bloco", q.p(up, 0, 0), "iron_door[open=false]", "senha errada: continua fechada")]
    passos += alavancas(senha) + [("espera", 2),
                                  ("bloco", q.p(up, 0, 0), "iron_door[open=true]", "senha certa: porta abre")]
    passos += alavancas([0] * n) + [("espera", 2),
                                    ("bloco", q.p(up, 0, 0), "iron_door[open=false]", "zerou: porta fecha")]
    return {"nome": "Cofre com senha de alavancas", "passos": passos, "porta": q.p(up, 0, 0)}


# ---------------------------------------------------------------- S3
ITENS_SEPARADOR = ["cobblestone", "iron_ingot", "gold_ingot", "diamond",
                   "redstone", "coal", "emerald", "lapis_lazuli"]


def separador_de_itens(q, itens=ITENS_SEPARADOR, passo=3):
    """Separador automático: baú de entrada em (-2,0,2), esteira de funis em h=1 ao longo de +u,
    um módulo a cada 3 blocos (u = 0, 3, 6...), barris de saída em (u,1,-1) e barril de sobras no fim.

    Módulo (em u): o funil-filtro F (u,0,0) fica virado para o comparador (não tem para onde
    empurrar) e guarda 68 itens: 28 do item-alvo + 4x10 barreiras, o que dá sinal 3 no
    comparador. Como todos os espaços estão ocupados, F só puxa da esteira o item-alvo.
    Um item a mais sobe o sinal para 4, o único valor que alcança o 4º pó de redstone
    (os pós D2-D4 descem pela coluna u+1) e apaga a tocha que trava o funil de baixo
    (u,0,-1): ele puxa um item de F, manda para o barril e trava de novo.
    """
    n = len(itens)
    ultimo = passo * (n - 1)
    q.box(-3, -4, -5, ultimo + 2, 1, -1, "air")
    for u in range(-2, ultimo + 2):
        q.ordenado(u, 0, 1, "hopper[facing={+u},enabled=true]")
    q.ordenado(-2, 0, 2, "chest[facing={+v},type=single]")
    q.ordenado(ultimo + 2, 0, 1, "barrel[facing=up,open=false]")      # sobras
    for k, item in enumerate(itens):
        u = passo * k
        filtro = ("{Items:[{Slot:0b,id:\"minecraft:%s\",count:28}" % item +
                  "".join(",{Slot:%db,id:\"minecraft:barrier\",count:10}" % s for s in range(1, 5)) + "]}")
        q.ordenado(u, 0, 0, "hopper[facing={-v},enabled=true]", filtro)     # F (filtro)
        q.ordenado(u, 0, -1, "hopper[facing={+v},enabled=false]")          # funil de saída (travado)
        q.ordenado(u, 1, -1, "barrel[facing=up,open=false]")
        q.put(u, -1, -1, "stone_bricks")
        q.ordenado(u, -1, 0, "comparator[facing={+v},mode=compare,powered=false]")
        q.put(u, -2, -1, "stone_bricks")
        q.ordenado(u, -2, 0, "redstone_wire")                            # D1 (sinal 3 / 4)
        q.put(u + 1, -2, -2, "stone_bricks")
        q.ordenado(u + 1, -2, -1, "redstone_wire")                       # D2
        q.put(u + 1, -1, -2, "stone_bricks")
        q.ordenado(u + 1, -1, -1, "redstone_wire")                       # D3
        q.put(u + 1, 0, -2, "stone_bricks")                              # X
        q.ordenado(u + 1, 0, -1, "redstone_wire")                        # D4 (0 / 1)
        q.ordenado(u, 0, -2, "redstone_wall_torch[facing={-u},lit=true]")  # trava o funil de saída
    entrada = q.p(-2, 0, 2)
    passos = [("espera", 2)]
    for slot, item in enumerate(itens[:5] + ["dirt"]):
        passos.append(("cmd", "item replace block {} container.%d with minecraft:%s 10" % (slot, item), entrada))
    passos.append(("espera", 75))
    for k, item in enumerate(itens[:5]):
        passos.append(("dados", q.p(passo * k, 1, -1), 'Items[{id:"minecraft:%s"}]' % item, f"barril de {item} recebeu"))
        passos.append(("dados", q.p(passo * k, 0, 0), 'Items[{Slot:0b,id:"minecraft:%s"}]' % item,
                       f"filtro de {item} continua com o item-alvo"))
        passos.append(("sem_dados", q.p(ultimo + 2, 0, 1), 'Items[{id:"minecraft:%s"}]' % item,
                       f"nenhum {item} foi para as sobras"))
    passos.append(("dados", q.p(ultimo + 2, 0, 1), 'Items[{id:"minecraft:dirt",count:10}]', "terra foi para as sobras"))
    return {"nome": "Separador automático de itens", "passos": passos, "entrada": entrada}


# ---------------------------------------------------------------- S4
def trilho(q, u, v, h, forma, impulso=False):
    """Trilho comum ou trilho de impulso sobre bloco de redstone."""
    forma = q.fmt(forma)
    if impulso:
        q.put(u, v, h - 1, "redstone_block")
        q.ordenado(u, v, h, f"powered_rail[shape={forma},powered=true,waterlogged=false]")
    else:
        q.ordenado(u, v, h, f"rail[shape={forma},waterlogged=false]")


def eixo(q, token):
    """Forma de trilho reto ao longo de uma direção do quadro."""
    return "north_south" if q.d(token) in ("north", "south") else "east_west"


def estacao(q, u, v, h, sentido):
    """Fim de linha: para-choque em u, trilho de lançamento em u-sentido, botão acima dele.
    `sentido` = +1 se a linha continua para -u a partir do para-choque, -1 se para +u."""
    s = sentido
    q.box(u, v, h, u, v, h + 1, "polished_blackstone_bricks")
    forma = eixo(q, "+u")
    q.ordenado(u - s, v, h, f"powered_rail[shape={forma},powered=false,waterlogged=false]")
    q.ordenado(u - s, v, h + 1, "stone_button[face=wall,facing=%s,powered=false]" % q.d("-u" if s > 0 else "+u"))
    q.ordenado(u - 2 * s, v, h, f"rail[shape={forma},waterlogged=false]")


def linha_de_metro(q, comprimento):
    """Linha reta de teste: estação A em u=0 (para-choque), estação B em u=comprimento."""
    q.box(-1, -2, -1, comprimento + 1, 2, 3, "stone_bricks")
    q.box(-1, -1, 0, comprimento + 1, 1, 2, "air")
    estacao(q, 0, 0, 0, -1)
    estacao(q, comprimento, 0, 0, +1)
    for u in range(3, comprimento - 2):
        trilho(q, u, 0, 0, eixo(q, "+u"), impulso=(u % 4 == 1))
    for u in range(2, comprimento - 1, 6):
        q.ordenado(u, -1, 0, "lantern[hanging=false,waterlogged=false]")
    a, b = q.p(1, 0, 0), q.p(comprimento - 1, 0, 0)
    return {"nome": "Metrô secreto", "passos": [
        ("espera", 2),
        ("cmd", "summon minecraft:minecart {centro}", a),
        ("espera", 2),
        ("cmd", "setblock {} minecraft:redstone_block", q.p(1, 0, 1)),
        ("espera", 1),
        ("cmd", "setblock {} " + q.fmt("stone_button[face=wall,facing={+u},powered=false]"), q.p(1, 0, 1)),
        ("espera", max(6, comprimento // 6)),
        ("entidade", "minecart", b, 2.5, "carrinho chegou e parou na estação B"),
    ]}


# ---------------------------------------------------------------- S5
def elevador_de_bolhas(q, altura, descer=False):
    """Coluna de água com areia das almas (sobe) ou magma (desce).

    Poço em (0,0) de h=0 até h=altura-1; entrada embaixo por uma porta aberta em (0,-1)
    (a porta segura a água); saída em cima pela plataforma em (0,-1, altura-1).
    """
    q.box(-1, -1, -1, 1, 1, altura + 2, "stone_bricks")
    q.put(0, 0, -1, "magma_block" if descer else "soul_sand")
    q.box(0, 0, 0, 0, 0, altura - 1, "water")
    q.box(0, 0, altura, 0, 0, altura + 1, "air")
    q.box(0, -1, altura, 0, -1, altura + 1, "air")       # saída no topo
    q.porta(0, -1, 0, "spruce", "{+v}", aberta=True)
    meio = q.p(0, 0, altura // 2)
    return {"nome": "Elevador de bolhas " + ("(desce)" if descer else "(sobe)"), "passos": [
        ("espera", 4),
        ("bloco", meio, "bubble_column[drag=%s]" % ("true" if descer else "false"), "coluna de bolhas formada"),
        ("bloco", q.p(0, -2, 0), "air", "a porta segura a água (nada vaza)"),
    ]}


# ---------------------------------------------------------------- S6
def poste_automatico(q, altura=3):
    """Poste de cerca com lâmpada de redstone e sensor de luz invertido: acende à noite."""
    for h in range(altura):
        q.put(0, 0, h, "dark_oak_fence")
    q.ordenado(0, 0, altura, "redstone_lamp[lit=false]")
    q.ordenado(0, 0, altura + 1, "daylight_detector[inverted=true,power=0]")
    return {"nome": "Poste que acende à noite", "passos": [
        ("cmd", "time set noon", None), ("espera", 3),
        ("bloco", q.p(0, 0, altura), "redstone_lamp[lit=false]", "de dia: apagado"),
        ("cmd", "time set midnight", None), ("espera", 3),
        ("bloco", q.p(0, 0, altura), "redstone_lamp[lit=true]", "à noite: aceso"),
        ("cmd", "time set noon", None),
    ]}


# ---------------------------------------------------------------- S7
def alarme_com_armadilha(q, largura=4, comprimento=8, lampadas=(3, 5)):
    """Corredor ao longo de +v (u de 0 a largura-1). Um fio de armadilha cruza o corredor em v=1.

    O gancho em (0,1,0) energiza a parede (-1,1,0); atrás dela, em u=-2, uma linha de pó
    corre ao longo do corredor (algumas lâmpadas de alerta servem de apoio para o pó),
    sobe um degrau no fundo e passa por trás dos dispensers da parede final, que atiram
    flechas corredor abaixo. A linha termina tocando um sino.
    """
    w, L = largura, comprimento
    q.box(-3, -1, -1, w, L + 3, 2, "deepslate_bricks")
    q.box(0, -1, 0, w - 1, L, 1, "air")                       # corredor
    q.ordenado(0, 1, 0, "tripwire_hook[facing={+u},attached=true,powered=false]")
    q.ordenado(w - 1, 1, 0, "tripwire_hook[facing={-u},attached=true,powered=false]")
    lados = ("east=true,west=true,north=false,south=false" if q.d("+u") in ("east", "west")
             else "north=true,south=true,east=false,west=false")
    for u in range(1, w - 1):
        q.ordenado(u, 1, 0, f"tripwire[attached=true,disarmed=false,powered=false,{lados}]")
    # linha ao longo do corredor (u=-2, h=0), apoiada em h=-1
    for v in range(1, L + 2):
        q.put(-2, v, -1, "redstone_lamp" if v in lampadas else "deepslate_bricks")
        q.ordenado(-2, v, 0, "redstone_wire")
        q.put(-2, v, 1, "air")
    # sobe um degrau e corre por trás da parede final (v=L+2, h=1)
    for u in range(-2, w):
        q.put(u, L + 2, 0, "deepslate_bricks")
        q.ordenado(u, L + 2, 1, "redstone_wire")
        q.put(u, L + 2, 2, "air")
    for v in range(1, L + 2):
        q.put(-2, v, 1, "air")
    flechas = '{Items:[{Slot:0b,id:"minecraft:arrow",count:64}]}'
    for u in range(0, w):
        q.ordenado(u, L + 1, 0, "dispenser[facing={-v},triggered=false]", flechas)
    q.put(w, L + 2, 0, "deepslate_bricks")
    q.ordenado(w, L + 2, 1, "bell[attachment=floor,facing={+v},powered=false]")
    for v in lampadas:
        q.ordenado(-2, v, -1, "redstone_lamp[lit=false]")
    lamp = q.p(-2, lampadas[0], -1)
    return {"nome": "Alarme com armadilha de flechas", "passos": [
        ("espera", 2),
        ("bloco", lamp, "redstone_lamp[lit=false]", "alarme desligado"),
        ("cmd", 'summon minecraft:item {} {Item:{id:"minecraft:stone",count:1},PickupDelay:32767}', q.p(1, 1, 0)),
        ("espera", 1),
        ("bloco", lamp, "redstone_lamp[lit=true]", "fio cruzado: lâmpada de alerta acende"),
        ("bloco", q.p(0, L + 1, 0), "dispenser[triggered=true]", "dispenser disparou"),
        ("bloco", q.p(w, L + 2, 1), "bell[powered=true]", "sino tocando"),
        ("entidade", "arrow", q.p(1, L // 2, 0), 12, "flechas voando no corredor"),
    ]}
