#!/usr/bin/env python3
"""Mide sobre las capturas lo que se puede medir de C1, C4, C5, C6 y C9 (y el contraste del HUD) y guarda
recortes y guías anotadas en docs/release-v1/evidencia/. Uso: python3 scripts/evidencia-criterios.py"""
import json, colorsys
import numpy as np
from PIL import Image, ImageDraw
from collections import deque

BASE = "docs/release-v1/capturas"
OUT = "docs/release-v1/evidencia"
import os
os.makedirs(OUT, exist_ok=True)

def load(p):
    return Image.open(p).convert("RGB")

def hsv(a):
    a = a.astype(float) / 255
    mx, mn = a.max(axis=2), a.min(axis=2)
    d = mx - mn
    h = np.zeros_like(mx)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    m = d > 1e-6
    rc = m & (mx == r); gc = m & (mx == g) & ~rc; bc = m & ~rc & ~gc
    h[rc] = (((g - b)[rc] / d[rc]) % 6) * 60
    h[gc] = ((b - r)[gc] / d[gc] + 2) * 60
    h[bc] = ((r - g)[bc] / d[bc] + 4) * 60
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    return h, s, mx

def blobs(mask, min_area):
    H, W = mask.shape
    seen = np.zeros_like(mask, bool)
    out = []
    for y in range(H):
        for x in range(W):
            if mask[y, x] and not seen[y, x]:
                q = deque([(y, x)]); seen[y, x] = True; pts = []
                while q:
                    cy, cx = q.popleft(); pts.append((cy, cx))
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True; q.append((ny, nx))
                if len(pts) >= min_area:
                    ys = [p[0] for p in pts]; xs = [p[1] for p in pts]
                    out.append(dict(area=len(pts), x0=min(xs), x1=max(xs), y0=min(ys), y1=max(ys)))
    return out

def lum(c):
    c = [v / 255 for v in c]
    c = [v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]

def ratio(a, b):
    la, lb = lum(a), lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)

res = {}
for tag, folder in (("lia-hueso", BASE), ("calavera-chispas-medianoche", BASE + "/calavera-chispas")):
    r = {}
    # --- C4: luna (en a y b), degradado del cielo y nubes ---
    for shot in ("a-salida", "b-recta-campanario"):
        im = load(f"{folder}/{shot}.png"); a = np.array(im); H, W, _ = a.shape
        h, s, v = hsv(a)
        # Luna = píxeles casi blancos en el tercio superior, fuera del HUD (x<200 es la posición «1º», y<260 la pastilla).
        top = np.zeros((H, W), bool); top[int(H * 0.08):int(H * 0.40), :] = True
        moon = top & (v > 0.9) & (s < 0.25)
        moon[:int(H * 0.16), :int(W * 0.30)] = False   # «1º»
        bl = sorted(blobs(moon, 400), key=lambda b: -b["area"])
        if bl:
            m = bl[0]; d = max(m["x1"] - m["x0"], m["y1"] - m["y0"]) + 1
            r[f"{shot}_luna"] = dict(diametro_px=d, pct_ancho=round(100 * d / W, 1), circular=round((m["x1"] - m["x0"] + 1) / (m["y1"] - m["y0"] + 1), 2))
        # Degradado: de 5 columnas de cielo (15-85 % del ancho) se toma la que tiene menos nubes y se mide el salto
        # máximo entre filas vecinas (3 niveles de 255 o menos = sin bandas visibles) y el sentido Ciruela→Niebla.
        best = None
        for fx in (0.15, 0.32, 0.5, 0.68, 0.85):
            x0 = int(W * fx)
            col = a[int(H * 0.04):int(H * 0.30), x0:x0 + 2].astype(float).mean(axis=1)
            st = float(np.abs(np.diff(col, axis=0)).max())
            if best is None or st < best[0]:
                best = (st, col)
        r[f"{shot}_cielo"] = dict(salto_max_entre_filas=round(best[0], 1), r_g_b_arriba=[int(x) for x in best[1][0]], r_g_b_abajo=[int(x) for x in best[1][-1]])
    # --- C5: puntos cálidos (Brasa/Llama) en a y b, sin contar el botón de objeto ---
    for shot in ("a-salida", "b-recta-campanario"):
        im = load(f"{folder}/{shot}.png"); a = np.array(im); H, W, _ = a.shape
        h, s, v = hsv(a)
        warm = (h >= 18) & (h <= 50) & (s > 0.6) & (v > 0.75)
        warm[int(H * 0.36):int(H * 0.50), int(W * 0.76):] = False   # botón de objeto (borde Brasa)
        warm[int(H * 0.60):, :] = False                              # escapes del kart (tercio inferior): se cuentan aparte
        bl = [b for b in blobs(warm, 40)]
        r[f"{shot}_cálidos_fuera_del_kart"] = len(bl)
    # --- C6: postes-calavera en c ---
    im = load(f"{folder}/c-curva-valla.png"); a = np.array(im); H, W, _ = a.shape
    h, s, v = hsv(a)
    bone = (h >= 25) & (h <= 50) & (s > 0.12) & (s < 0.45) & (v > 0.6)
    band = np.zeros((H, W), bool); band[int(H * 0.28):int(H * 0.50), :] = True
    bl = [b for b in blobs(bone & band, 60) if 0.5 < (b["x1"] - b["x0"] + 1) / (b["y1"] - b["y0"] + 1) < 1.8]
    r["c_postes_calavera_detectados"] = len(bl)
    esp = (abs(h - 168) < 14) & (s > 0.5) & (v > 0.7)
    r["c_pixeles_linea_espectro"] = int(esp[int(H * 0.2):int(H * 0.7)].sum())
    purple_curb = (abs(h - 262) < 12) & (s > 0.55) & (v > 0.55)
    r["c_pixeles_bordillo_anima"] = int(purple_curb[int(H * 0.2):int(H * 0.7)].sum())
    # --- C1: guías ---
    for shot in ("a-salida", "b-recta-campanario", "c-curva-valla"):
        im = load(f"{folder}/{shot}.png"); H = im.height; W = im.width
        dr = ImageDraw.Draw(im, "RGBA")
        dr.rectangle([0, int(H * 0.25), W, int(H * 0.40)], fill=(63, 242, 200, 40), outline=(63, 242, 200, 255), width=3)   # horizonte 25-40 %
        dr.rectangle([0, int(H * 0.60), W, int(H * 0.75)], fill=(255, 180, 35, 40), outline=(255, 180, 35, 255), width=3)  # centro del kart 60-75 %
        cx = W // 2
        dr.line([cx - int(W * 0.15), int(H * 0.9), cx - int(W * 0.15), int(H * 0.97)], fill=(255, 106, 31, 255), width=4)
        dr.line([cx + int(W * 0.15), int(H * 0.9), cx + int(W * 0.15), int(H * 0.97)], fill=(255, 106, 31, 255), width=4)
        im.resize((390, 844)).save(f"{OUT}/c1-guias-{tag}-{shot}.png")
    # --- C9: recortes @1x de e-frontal ---
    im = load(f"{folder}/e-frontal.png").resize((390, 844), Image.LANCZOS)
    im.save(f"{OUT}/c9-frontal-1x-{tag}.png")
    im.crop((70, 270, 330, 560)).resize((780, 870), Image.NEAREST).save(f"{OUT}/c9-frontal-zoom-{tag}.png")
    res[tag] = r

# Contraste HUD (C9): texto sobre su fondo.
pill_bg = tuple(int(0.8 * c1 + 0.2 * c2) for c1, c2 in zip((0x1E, 0x18, 0x30), (0x5B, 0x4E, 0x7A)))   # Ciruela 80 % sobre Niebla (peor caso claro)
res["contraste_hud"] = dict(
    pastilla_texto_sobre_ciruela80=round(ratio((0xFF, 0xF7, 0xEA), pill_bg), 2),
    numeros_texto_con_trazo_noche=round(ratio((0xFF, 0xF7, 0xEA), (0x12, 0x0F, 0x1E)), 2),
    minimo_exigido=4.5,
)
json.dump(res, open(f"{OUT}/evidencia.json", "w"), indent=2, ensure_ascii=False)
print(json.dumps(res, indent=2, ensure_ascii=False))
