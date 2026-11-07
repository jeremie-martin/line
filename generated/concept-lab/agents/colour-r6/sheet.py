"""Contact sheet: python3 -I sheet.py out.png name1 name2 ... (stills/<name>-petrunko-20.png), 5 per row, labelled."""
import sys, os
from PIL import Image, ImageDraw
H = os.path.dirname(os.path.abspath(__file__)); out, names = sys.argv[1], sys.argv[2:]
w, h, n = 300, 533, 5
o = Image.new('RGB', (w * min(n, len(names)), (h + 30) * ((len(names) + n - 1) // n)), '#888')
for i, k in enumerate(names):
    im = Image.open(f'{H}/stills/{k}-petrunko-20.png').convert('RGB').resize((w, h), Image.LANCZOS)
    x, y = (i % n) * w, (i // n) * (h + 30); o.paste(im, (x, y + 30)); ImageDraw.Draw(o).text((x + 8, y + 8), k, fill='white')
o.save(out)
