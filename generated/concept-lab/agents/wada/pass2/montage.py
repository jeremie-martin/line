# python3 montage.py OUT.png TITLE COLS shots_dir song key[:label] ...   — a labelled contact sheet of rendered frames
import sys
from PIL import Image, ImageDraw, ImageFont
out, title, cols, d, songs = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4], sys.argv[5].split(',')
items = [a.split(':', 1) if ':' in a else [a, a] for a in sys.argv[6:]]
tw, th, lab = 240, 427, 34
try:
    font = ImageFont.truetype('/usr/share/fonts/TTF/DejaVuSans.ttf', 15); big = ImageFont.truetype('/usr/share/fonts/TTF/DejaVuSans-Bold.ttf', 22)
except OSError:
    font = big = ImageFont.load_default()
rows_per_song = -(-len(items) // cols)
W = cols * (tw + 6) + 6; H = 50 + len(songs) * (rows_per_song * (th + lab + 6) + 34)
img = Image.new('RGB', (W, H), 'white'); dr = ImageDraw.Draw(img)
dr.text((10, 12), title, fill='black', font=big)
y = 50
for s in songs:
    dr.text((10, y + 4), s, fill='black', font=big); y += 34
    for i, (k, l) in enumerate(items):
        x = 6 + (i % cols) * (tw + 6); yy = y + (i // cols) * (th + lab + 6)
        try: im = Image.open(f'{d}/{k}_{s}.png').convert('RGB').resize((tw, th), Image.LANCZOS)
        except FileNotFoundError: continue
        img.paste(im, (x, yy)); dr.text((x + 2, yy + th + 6), l, fill='black', font=font)
    y += rows_per_song * (th + lab + 6)
img.save(out)
