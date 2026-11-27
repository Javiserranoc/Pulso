"""Genera los iconos de la PWA: línea de latido blanca sobre fondo azul («Latido sobre azul»)."""
from PIL import Image, ImageDraw
import os, sys

BLUE, WHITE = (47, 123, 255), (255, 255, 255)
# Latido en un lienzo de 100×100 (el mismo trazo que la animación de arranque).
PULSE = [(14, 52), (33, 52), (40, 36), (50, 68), (58, 30), (65, 52), (86, 52)]

def icon(size, scale=1.0, stroke=7.0):
    s = size * 4  # supersampling para bordes suaves
    img = Image.new('RGB', (s, s), BLUE)
    d = ImageDraw.Draw(img)
    k = s / 100 * scale
    off = s * (1 - scale) / 2
    pts = [(off + x * k, off + y * k) for x, y in PULSE]
    w = stroke * k
    d.line(pts, fill=WHITE, width=round(w), joint='curve')
    for x, y in pts:  # remates y uniones redondeados
        d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=WHITE)
    return img.resize((size, size), Image.LANCZOS)

out = sys.argv[1] if len(sys.argv) > 1 else 'public'
icon(192).save(os.path.join(out, 'pwa-192.png'))
icon(512).save(os.path.join(out, 'pwa-512.png'))
icon(512, scale=0.78).save(os.path.join(out, 'pwa-512-maskable.png'))  # dentro de la zona segura
icon(180).save(os.path.join(out, 'apple-touch-icon.png'))
