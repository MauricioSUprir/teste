#!/usr/bin/env python3
"""Gerador do Castelo Enorme (com bases secretas e redstone) para Minecraft Java 1.21+.

    python3 gerar_castelo.py

Gera em ./saida/:
  castelo_datapack.zip   datapack: /function castelo:construir
  castelo.schem          schematic para WorldEdit/FAWE (//schem load castelo, //paste)
  comandos_java.txt      todos os comandos /fill e /setblock, em ordem
  previa.png             vista do castelo
  previa_subterraneo.png vista em corte das bases secretas
"""
import os

import modelo as m
import exportar as ex
import castelo
import bases
import equipamentos as eq

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, "saida")


def construir_tudo():
    """Monta o modelo inteiro e devolve os roteiros de teste dos sistemas."""
    m.resetar()
    m.grid[:, : -6 - m.YMIN + 1, :] = m.KEEP        # abaixo de y=-6: terreno original
    castelo.terreno()
    castelo.muralha()
    castelo.torres()
    castelo.portao()
    testes = castelo.menagem()
    t, _ = castelo.patio()
    testes += t
    castelo.decorar()
    testes += bases.construir()
    testes.append(eq.teste((0, 1, 90)))
    ex.finalizar()
    return testes


def areas_imprevisiveis():
    """Regiões que o jogo muda sozinho (árvores geradas, colunas de bolhas)."""
    arvores = castelo.ARVORES
    colunas = bases.colunas_de_agua()
    return [
        lambda x, y, z: y >= -1 and any(abs(x - ax) <= 5 and abs(z - az) <= 5 for ax, az in arvores),
        lambda x, y, z: (x, z) in colunas,
    ]


def exportar_tudo(previas=True):
    os.makedirs(SAIDA, exist_ok=True)
    lista = ex.limpeza() + ex.caixas()
    cmds = [ex.comando_java(c) for c in lista]
    cmds += [f"place feature minecraft:oak {ex.rel(x, 0, z)}" for x, z in castelo.ARVORES]
    for x, y, z in bases.ESTACOES:
        cmds.append(f"summon minecraft:minecart ~{x + 0.5} ~{y} ~{z + m.ZOFF + 0.5}")
    zona = ((-m.XR, -m.XR + m.ZOFF), (m.XR, m.XR + m.ZOFF))
    etapas = ex.datapack(os.path.join(SAIDA, "castelo_datapack.zip"), "castelo", cmds, zona=zona,
                         titulo="Castelo", extras=eq.arquivos_datapack(),
                         mensagem_pronto="Pronto! Atravesse a ponte levadiça. Dica: na biblioteca do 1º andar, "
                                         "coloque um livro no atril...")
    with open(os.path.join(SAIDA, "comandos_java.txt"), "w", encoding="utf-8") as f:
        f.write("# Castelo Enorme - comandos para Minecraft Java 1.21+, relativos à posição do jogador.\n")
        f.write("# O castelo fica à frente (ao norte). Use o datapack para rodar todos de uma vez.\n")
        f.write("\n".join(cmds) + "\n")
    ex.schematic(os.path.join(SAIDA, "castelo.schem"), (-m.XR, m.YMIN, -m.XR + m.ZOFF))
    if previas:
        import previa
        previa.isometrica(os.path.join(SAIDA, "previa.png"))
        previa.subterraneo(os.path.join(SAIDA, "previa_subterraneo.png"))
    return len(cmds), etapas


def main():
    testes = construir_tudo()
    n, etapas = exportar_tudo()
    total = int(((m.grid != m.AR) & (m.grid != m.KEEP)).sum())
    print(f"Blocos no modelo: {total:,}")
    print(f"Comandos: {n:,} em {etapas} etapas (ticks)")
    print(f"Sistemas com teste automático: {len(testes)}")


if __name__ == "__main__":
    main()
