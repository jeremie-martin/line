"""The frame laid over two full-size 9:16 videos side by side: the ground around them, rounded corners, and a label inside each.

  python3 generated/concept-lab/then-and-now/frame.py [LEFT_LABEL RIGHT_LABEL]     (THEN and NOW by default)

Writes frame.png beside this file: 2256 x 1984, opaque ground with a transparent rounded window of 1080 x 1920 for each
video (at x = 32 and x = 1144, y = 32); join.ts lays it over the videos, which stay at their own size.
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

TILE_W, TILE_H, MARGIN, RADIUS, SCALE = 1080, 1920, 32, 44, 4  # px; drawn SCALE times larger, then reduced, for smooth edges
GROUND, HAIRLINE = (236, 231, 221), (203, 197, 186)  # warm paper, and a line a little darker around each window
FONT = "/usr/share/fonts/noto-sans-display/NotoSansDisplay[wdth,wght].ttf"


def frame(left: str, right: str) -> Image.Image:
    """The frame as RGBA, shape (1984, 2256)."""
    width, height = 2 * TILE_W + 3 * MARGIN, TILE_H + 2 * MARGIN
    big = Image.new("RGBA", (width * SCALE, height * SCALE), GROUND + (255,))
    draw = ImageDraw.Draw(big)
    font = ImageFont.truetype(FONT, 44 * SCALE)
    font.set_variation_by_axes([700, 100])  # weight, width
    for i, text in enumerate((left, right)):
        x, y = (MARGIN + i * (TILE_W + MARGIN)) * SCALE, MARGIN * SCALE
        box = (x, y, x + TILE_W * SCALE - 1, y + TILE_H * SCALE - 1)
        draw.rounded_rectangle((box[0] - 2 * SCALE, box[1] - 2 * SCALE, box[2] + 2 * SCALE, box[3] + 2 * SCALE), (RADIUS + 2) * SCALE, fill=HAIRLINE + (255,))
        draw.rounded_rectangle(box, RADIUS * SCALE, fill=(0, 0, 0, 0))
        # the label: bold capitals in a dark pill, inside the video near its lower edge, readable on any theme
        gap = 7 * SCALE
        widths = [draw.textlength(c, font=font) for c in text]
        text_w = sum(widths) + gap * (len(text) - 1)
        pill_w, pill_h = text_w + 76 * SCALE, 84 * SCALE
        cx, cy = x + TILE_W * SCALE / 2, y + (TILE_H - 118) * SCALE
        draw.rounded_rectangle((cx - pill_w / 2, cy - pill_h / 2, cx + pill_w / 2, cy + pill_h / 2), pill_h / 2, fill=(20, 20, 22, 214), outline=(255, 255, 255, 70), width=2 * SCALE)
        at = cx - text_w / 2
        for c, w in zip(text, widths):
            draw.text((at, cy), c, font=font, fill=(255, 255, 255, 255), anchor="lm")
            at += w + gap
    return big.resize((width, height), Image.LANCZOS)


if __name__ == "__main__":
    labels = sys.argv[1:3] if len(sys.argv) >= 3 else ["THEN", "NOW"]
    frame(*labels).save(os.path.join(os.path.dirname(__file__), "frame.png"))
