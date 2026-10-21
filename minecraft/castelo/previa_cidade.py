"""Prévia isométrica da cidade inteira (montada ladrilho por ladrilho)."""
import sys

import numpy as np
from PIL import Image, ImageDraw

import cidade
import exportar as ex
import modelo as m
import previa


def desenhar(caminho, s=2):
    largura = (cidade.X_MAX - cidade.X_MIN + cidade.Z_MAX - cidade.Z_MIN + 4) * s
    altura = largura // 2 + (cidade.YMAX + 10) * s * 2
    img = Image.new("RGB", (largura, altura), (198, 226, 255))
    d = ImageDraw.Draw(img)
    ox = (cidade.Z_MAX - cidade.Z_MIN + 2) * s
    oy = (cidade.YMAX + 10) * s * 2
    for tx, tz in sorted(cidade.ladrilhos(), key=lambda t: t[0] + t[1]):
        cidade.construir_ladrilho(tx, tz)
        ex.finalizar()
        ys = np.arange(m.SY)[None, :, None] + m.YMIN
        oc = ((m.grid != m.AR) & (m.grid != m.KEEP) & (ys >= -1)) | ((m.grid == m.KEEP) & (ys == -1))
        meio = np.zeros_like(oc)                        # só o miolo do ladrilho (sem a sobreposição)
        meio[0:cidade.TILE, :, 0:cidade.TILE] = True
        oc &= meio
        oculto = np.zeros_like(oc)
        oculto[:-1, :-1, :-1] = oc[1:, :-1, :-1] & oc[:-1, 1:, :-1] & oc[:-1, :-1, 1:]
        idx = np.argwhere(oc & ~oculto)
        cores = np.array([previa.cor_de(n) for n in m.palette])
        ordem = np.lexsort((idx[:, 1], idx[:, 0] + idx[:, 2]))
        for i in ordem:
            x, y, z = idx[i]
            cor = tuple(int(v) for v in cores[m.grid[x, y, z]])
            gx = x - m.XR + tx - cidade.X_MIN
            gz = z - m.XR + tz - cidade.Z_MIN
            gy = y + m.YMIN
            px = ox + (gx - gz) * s
            py = oy + (gx + gz) * s // 2 - gy * s * 2
            d.polygon([(px, py - s), (px + s, py - s // 2), (px, py), (px - s, py - s // 2)], fill=cor)
            d.polygon([(px - s, py - s // 2), (px, py), (px, py + s * 2), (px - s, py + s * 2 - s // 2)],
                      fill=tuple(int(v * 0.78) for v in cor))
            d.polygon([(px, py), (px + s, py - s // 2), (px + s, py + s * 2 - s // 2), (px, py + s * 2)],
                      fill=tuple(int(v * 0.62) for v in cor))
        print(tx, tz, flush=True)
    img.save(caminho, optimize=True)


if __name__ == "__main__":
    desenhar(sys.argv[1] if len(sys.argv) > 1 else "saida/previa_nova_york.png")
