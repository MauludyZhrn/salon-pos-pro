"""Ubah logo apa pun jadi PNG 1-bit hitam-putih untuk printer thermal.

Pakai:  python tools/make-logo.py logo-asli.png assets/receipt-logo.png
Syarat: pip install pillow
Logo asli idealnya PNG hitam di atas putih/transparan, lebar >= 600 px.
"""
import sys
from PIL import Image, ImageOps

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGBA")
white = Image.new("RGBA", im.size, (255, 255, 255, 255))
g = ImageOps.autocontrast(Image.alpha_composite(white, im).convert("L"), cutoff=1)
bbox = ImageOps.invert(g).point(lambda p: 255 if p > 55 else 0).getbbox() or (0, 0, *g.size)
g = g.crop(bbox)
pad = int(max(g.size) * 0.04)
canvas = Image.new("L", (g.width + 2 * pad, g.height + 2 * pad), 255)
canvas.paste(g, (pad, pad))
canvas = canvas.resize((384, round(384 * canvas.height / canvas.width)), Image.LANCZOS)
canvas.point(lambda p: 255 if p > 150 else 0).convert("1").save(dst)
print("ok", dst, canvas.size)
