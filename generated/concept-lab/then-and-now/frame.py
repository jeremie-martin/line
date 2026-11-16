"""The frame laid over two full-size 9:16 videos side by side: the ground around them and their rounded corners.

  python3 generated/concept-lab/then-and-now/frame.py

Writes frame.png beside this file: 2256 x 1984, opaque ground with a transparent rounded window of 1080 x 1920 for each
video (at x = 32 and x = 1144, y = 32); join.ts lays it over the videos, which stay at their own size. The words on the
videos are captions drawn by the renderer (scripts/video/caption.js), not part of the frame.
"""
import os

from PIL import Image, ImageDraw

TILE_W, TILE_H, MARGIN, RADIUS, SCALE = 1080, 1920, 32, 44, 4  # px; drawn SCALE times larger, then reduced, for smooth edges
# The ground is a neutral charcoal: a light video stands out against it at full contrast, and a dark theme, which is never
# neutral nor this dark, still reads as a coloured surface; the line around each window, a little lighter, keeps its edge.
GROUND, HAIRLINE = (27, 27, 29), (62, 62, 66)


def frame() -> Image.Image:
    """The frame as RGBA, shape (1984, 2256)."""
    width, height = 2 * TILE_W + 3 * MARGIN, TILE_H + 2 * MARGIN
    big = Image.new("RGBA", (width * SCALE, height * SCALE), GROUND + (255,))
    draw = ImageDraw.Draw(big)
    for i in range(2):
        x, y = (MARGIN + i * (TILE_W + MARGIN)) * SCALE, MARGIN * SCALE
        box = (x, y, x + TILE_W * SCALE - 1, y + TILE_H * SCALE - 1)
        draw.rounded_rectangle((box[0] - 2 * SCALE, box[1] - 2 * SCALE, box[2] + 2 * SCALE, box[3] + 2 * SCALE), (RADIUS + 2) * SCALE, fill=HAIRLINE + (255,))
        draw.rounded_rectangle(box, RADIUS * SCALE, fill=(0, 0, 0, 0))
    return big.resize((width, height), Image.LANCZOS)


if __name__ == "__main__":
    frame().save(os.path.join(os.path.dirname(__file__), "frame.png"))
