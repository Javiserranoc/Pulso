"""Genera los iconos de la PWA: fondo oscuro con un anillo de progreso azul."""
from PIL import Image, ImageDraw
import sys, os

BG, TRACK, BLUE = (10, 11, 13), (34, 37, 43), (47, 123, 255)

def icon(size, pad_ratio=0.0, radius_ratio=0.0):
    s = size * 4  # supersampling
    img = Image.new('RGB', (s, s), BG)
    d = ImageDraw.Draw(img)
    pad = s * pad_ratio
    inner = s - 2 * pad
    r = inner * 0.30
    w = inner * 0.085
    c = s / 2
    box = [c - r, c - r, c + r, c + r]
    d.arc(box, 0, 360, fill=TRACK, width=int(w))
    d.arc(box, -90, -90 + 245, fill=BLUE, width=int(w))
    # extremos redondeados del arco
    import math
    for ang in (-90, -90 + 245):
        a = math.radians(ang)
        x, y = c + (r - w / 2) * math.cos(a), c + (r - w / 2) * math.sin(a)
        d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=BLUE)
    return img.resize((size, size), Image.LANCZOS)

out = sys.argv[1]
icon(192).save(os.path.join(out, 'pwa-192.png'))
icon(512).save(os.path.join(out, 'pwa-512.png'))
icon(512, pad_ratio=0.1).save(os.path.join(out, 'pwa-512-maskable.png'))
icon(180).save(os.path.join(out, 'apple-touch-icon.png'))
