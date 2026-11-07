# python3 crops.py OUT.png shots_dir song keys...  — the band region of each frame, larger, to judge bars and accent
import sys
from PIL import Image, ImageDraw, ImageFont
out, d, s, keys = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4:]
font = ImageFont.truetype('/usr/share/fonts/TTF/DejaVuSans.ttf', 16)
cw, ch, cols = 540, 300, 4
rows = -(-len(keys) // cols)
img = Image.new('RGB', (cols * (cw + 6), rows * (ch + 26)), 'white'); dr = ImageDraw.Draw(img)
for i, k in enumerate(keys):
    im = Image.open(f'{d}/{k}_{s}.png').convert('RGB').crop((0, 1100, 1080, 1700)).resize((cw, ch), Image.LANCZOS)
    x, y = (i % cols) * (cw + 6), (i // cols) * (ch + 26)
    img.paste(im, (x, y + 22)); dr.text((x + 4, y + 2), k, fill='black', font=font)
img.save(out)
