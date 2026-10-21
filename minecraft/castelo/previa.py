"""Imagens isométricas do modelo (castelo e corte das bases subterrâneas)."""
import numpy as np
from PIL import Image, ImageChops, ImageDraw

import modelo as m

CORES = {
    "stone_bricks": (122, 121, 122), "mossy_stone_bricks": (115, 121, 105),
    "cracked_stone_bricks": (118, 117, 118), "chiseled_stone_bricks": (119, 118, 119),
    "cobblestone": (127, 127, 127), "mossy_cobblestone": (110, 118, 94),
    "deepslate_tiles": (54, 54, 55), "cracked_deepslate_tiles": (52, 52, 52),
    "deepslate_bricks": (70, 70, 71), "cracked_deepslate_bricks": (64, 64, 65),
    "polished_deepslate": (72, 72, 73), "chiseled_deepslate": (54, 54, 55),
    "grass_block": (95, 159, 53), "dirt": (134, 96, 67), "stone": (125, 125, 125),
    "water": (63, 118, 228), "gravel": (131, 127, 126), "dirt_path": (148, 122, 65),
    "spruce_planks": (115, 85, 49), "dark_oak_planks": (66, 43, 20), "spruce_log": (58, 37, 16),
    "white_terracotta": (209, 178, 161), "gold_block": (246, 208, 61), "glass": (190, 225, 235),
    "glass_pane": (175, 213, 219), "iron_bars": (136, 139, 135), "polished_andesite": (132, 134, 133),
    "polished_diorite": (192, 193, 194), "lantern": (255, 200, 90), "red_carpet": (160, 39, 34),
    "bookshelf": (117, 94, 59), "lightning_rod": (200, 120, 90), "farmland": (110, 75, 45),
    "wheat": (200, 180, 70), "carrots": (90, 160, 50), "prismarine_bricks": (99, 171, 158),
    "dark_prismarine": (51, 91, 75), "sea_lantern": (210, 230, 220), "redstone_block": (175, 24, 5),
    "redstone_wire": (190, 20, 10), "rail": (130, 110, 90), "powered_rail": (190, 150, 60),
    "hopper": (70, 70, 72), "barrel": (125, 90, 50), "diamond_block": (98, 237, 228),
    "emerald_block": (42, 203, 87), "iron_block": (220, 220, 220), "white_concrete": (207, 213, 214),
    "black_concrete": (8, 10, 15), "glowstone": (250, 210, 120), "redstone_lamp": (150, 90, 50),
    "polished_blackstone_bricks": (48, 42, 49), "hay_block": (166, 136, 38),
    "yellow_concrete": (241, 175, 21), "blue_concrete": (45, 47, 143), "light_gray_concrete": (125, 125, 115),
    "gray_concrete": (55, 58, 62), "red_concrete": (142, 33, 33), "green_concrete": (73, 91, 36),
    "moss_block": (89, 110, 45), "smooth_stone": (158, 158, 158), "smooth_quartz": (235, 229, 222),
    "quartz_block": (235, 229, 222), "chiseled_quartz_block": (231, 226, 218), "white_stained_glass_pane": (240, 240, 240),
    "iron_bars": (136, 139, 135), "yellow_wool": (249, 198, 40), "red_wool": (161, 39, 34),
    "white_terracotta": (226, 205, 185), "netherite_block": (66, 61, 63), "polished_blackstone": (53, 48, 56),
    "orange_terracotta": (180, 92, 48), "orange_concrete": (224, 97, 1), "light_blue_concrete": (36, 137, 199),
    "polished_diorite": (192, 193, 194), "quartz_pillar": (235, 229, 222), "white_wool": (233, 236, 236),
    "black_wool": (21, 21, 26), "oak_planks": (162, 130, 78), "manter": (95, 159, 53),
    "oak_leaves": (60, 120, 40), "birch_leaves": (90, 130, 60), "dark_oak_leaves": (50, 95, 30),
    "jungle_leaves": (55, 130, 30), "spruce_leaves": (40, 80, 50), "oxidized_copper": (82, 162, 132),
    "oxidized_cut_copper": (80, 153, 126), "light_blue_stained_glass": (110, 170, 215),
    "cyan_stained_glass": (75, 125, 150), "gray_stained_glass": (75, 75, 75), "black_stained_glass": (30, 30, 35),
    "blue_stained_glass": (50, 75, 175), "light_gray_stained_glass": (150, 150, 150), "packed_ice": (140, 180, 250),
    "brown_terracotta": (77, 51, 36), "red_terracotta": (143, 61, 47), "terracotta": (152, 94, 68),
    "bricks": (150, 97, 83), "granite": (149, 103, 86), "polished_granite": (154, 107, 89),
    "smooth_sandstone": (223, 214, 170), "cut_sandstone": (217, 206, 159), "light_gray_terracotta": (135, 107, 98),
    "stone_bricks": (122, 121, 122), "cyan_terracotta": (87, 91, 91), "lime_concrete": (94, 169, 24),
}


def cor_de(nome):
    base = nome.replace("minecraft:", "").split("[")[0]
    if base in CORES:
        return CORES[base]
    for chave, cor in (("dark_oak", (66, 43, 20)), ("spruce", (115, 85, 49)), ("stone_brick", (122, 121, 122)),
                       ("oak", (160, 130, 80)), ("bed", (170, 40, 40)), ("glass", (180, 210, 220)),
                       ("deepslate", (70, 70, 71)), ("carpet", (150, 40, 40)), ("leaves", (60, 120, 40)),
                       ("door", (110, 80, 50)), ("chest", (150, 110, 40)), ("torch", (255, 180, 60)),
                       ("quartz", (235, 229, 222)), ("terracotta", (160, 90, 70)), ("concrete", (120, 120, 120))):
        if chave in base:
            return cor
    return (150, 150, 150)


def _desenhar(mascara, caminho, escala=3, fundo=(198, 226, 255), sombra_y=None):
    s = escala
    cores = np.array([cor_de(n) for n in m.palette])
    ocupado = mascara
    oculto = np.zeros_like(ocupado)
    oculto[:-1, :-1, :-1] = ocupado[1:, :-1, :-1] & ocupado[:-1, 1:, :-1] & ocupado[:-1, :-1, 1:]
    vis = ocupado & ~oculto
    idx = np.argwhere(vis)
    w = (m.SX + m.SZ) * s + 40
    h = (m.SX + m.SZ) * s // 2 + m.SY * s * 2 + 40
    img = Image.new("RGB", (w, h), fundo)
    d = ImageDraw.Draw(img)
    ox, oy = w // 2, m.SY * s * 2 + 20
    ordem = np.lexsort((idx[:, 1], idx[:, 0] + idx[:, 2]))
    for i in ordem:
        x, y, z = idx[i]
        c = tuple(int(v) for v in cores[m.grid[x, y, z]])
        px = ox + (x - z) * s
        py = oy + (x + z) * s // 2 - y * s * 2
        topo = [(px, py - s), (px + s, py - s // 2), (px, py), (px - s, py - s // 2)]
        esq = [(px - s, py - s // 2), (px, py), (px, py + s * 2), (px - s, py + s * 2 - s // 2)]
        dir_ = [(px, py), (px + s, py - s // 2), (px + s, py + s * 2 - s // 2), (px, py + s * 2)]
        d.polygon(topo, fill=c)
        d.polygon(esq, fill=tuple(int(v * 0.78) for v in c))
        d.polygon(dir_, fill=tuple(int(v * 0.62) for v in c))
    caixa = ImageChops.difference(img, Image.new("RGB", img.size, fundo)).getbbox()
    img = img.crop((caixa[0] - 20, caixa[1] - 20, caixa[2] + 20, caixa[3] + 20))
    img.save(caminho)


def isometrica(caminho):
    ys = np.arange(m.SY)[None, :, None] + m.YMIN
    mascara = (m.grid != m.AR) & (m.grid != m.KEEP) & (ys >= -7)
    _desenhar(mascara, caminho, escala=3)


def estadio(caminho, escala=2):
    """Vista do estádio com o chão (as células "manter" do nível do chão aparecem como grama)."""
    ys = np.arange(m.SY)[None, :, None] + m.YMIN
    mascara = ((m.grid != m.AR) & (m.grid != m.KEEP) & (ys >= -1)) | ((m.grid == m.KEEP) & (ys == -1))
    _desenhar(mascara, caminho, escala=escala)


def subterraneo(caminho):
    """Corte: só o que está abaixo do chão, sem a pedra de proteção e sem os tetos."""
    ys = np.arange(m.SY)[None, :, None] + m.YMIN
    ignorar = {m.AR, m.KEEP}
    for nome in ("stone", "dirt", "grass_block", "gravel", "water", "glass", "deepslate_tiles"):
        if "minecraft:" + nome in m.pidx:
            ignorar.add(m.pidx["minecraft:" + nome])
    mascara = ~np.isin(m.grid, list(ignorar)) & (ys <= -8) & (ys != -18) & (ys != -7)
    _desenhar(mascara, caminho, escala=5, fundo=(40, 36, 34))
