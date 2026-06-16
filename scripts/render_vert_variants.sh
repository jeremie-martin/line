#!/usr/bin/env bash
#
# Render a MATRIX of vertical-overlay variants as fast single-frame stills and
# montage them into one contact sheet, so we can eyeball many layout ideas at once
# (margins, rider height, panel size, bottom treatment). Iterating on the look is
# the whole point — edit the VARIANTS list below and re-run.
#
# Prereq: remotion/public/<name>.overlay.json + <name>.source.mp4 already exist
# (produced by make_overlay_data.ts + an ffmpeg mux — see render the single clip).
#
#   scripts/render_vert_variants.sh --name=tiki_t10_r01_s36_vert [--frame=540]
#
# Output: shakedown/vertical_test/sheet_<name>.png (+ the individual stills).
set -euo pipefail

NAME="tiki_t10_r01_s36_vert"
FRAME=540
GUIDES=0
for a in "$@"; do case "$a" in
  --name=*)  NAME="${a#*=}" ;;
  --frame=*) FRAME="${a#*=}" ;;
  --guides)  GUIDES=1 ;;
  *) echo "unknown arg: $a" >&2; exit 1 ;;
esac; done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
DUR=$(python3 -c "import json;print(json.load(open('remotion/public/$NAME.overlay.json'))['durationS'])")
BASE="\"dataFile\":\"$NAME.overlay.json\",\"videoFile\":\"$NAME.source.mp4\",\"durationS\":$DUR"
[ -f "remotion/public/$NAME.spectrum.json" ] && BASE="$BASE,\"spectrumFile\":\"$NAME.spectrum.json\""
OUT="shakedown/vertical_test"; mkdir -p "$OUT"

# label | variant-props fragment  (merged onto BASE). Edit freely.
# Safe-zone candidates: lift the spectrum out of the YouTube bottom-UI dead zone.
# Run with --guides to draw the YT safe zones (red = avoid) on the sheet.
VARIANTS=(
  "0_current_BURIED|\"specSym\":true,\"specCenterPct\":0.78,\"specMaxBarPct\":0.20,\"riderShiftPct\":0.09,\"specFullWidth\":true"
  "1_sym_lifted_edge|\"specSym\":true,\"specCenterPct\":0.66,\"specMaxBarPct\":0.17,\"riderShiftPct\":0.15,\"specFullWidth\":true"
  "2_uponly_big_edge|\"specSym\":false,\"specCenterPct\":0.74,\"specMaxBarPct\":0.26,\"riderShiftPct\":0.15,\"specFullWidth\":true"
  "3_sym_inset_fade|\"specSym\":true,\"specCenterPct\":0.62,\"specMaxBarPct\":0.15,\"riderShiftPct\":0.16,\"specFullWidth\":false,\"sideMarginPct\":0.03"
)

cd remotion
PNGS=(); LABELS=()
for v in "${VARIANTS[@]}"; do
  label="${v%%|*}"; frag="${v#*|}"
  png="out/var_${label}.png"
  echo "==> $label"
  npx remotion still src/index.ts CurveOverlayVertical "$png" --frame="$FRAME" --props="{$BASE,$frag}" 2>&1 | tail -1
  PNGS+=("$ROOT/remotion/$png"); LABELS+=("$label")
done
cd "$ROOT"

# montage into one contact sheet with PIL (no imagemagick needed). With guides,
# overlay the YouTube Shorts safe zones (red = covered by UI, avoid).
python3 - "$OUT/sheet_${NAME}.png" "$GUIDES" "${#PNGS[@]}" "${PNGS[@]}" "${LABELS[@]}" <<'PY'
import sys
from PIL import Image, ImageDraw, ImageFont
out = sys.argv[1]; guides = sys.argv[2] == "1"; n = int(sys.argv[3])
pngs = sys.argv[4:4+n]; labels = sys.argv[4+n:4+2*n]
COLW, GAP, LABH = 360, 16, 34          # per-tile width, gap, label band
cols = 2 if n == 4 else min(n, 3); rows = (n + cols - 1) // cols
ims = [Image.open(p).convert("RGB") for p in pngs]
scale = COLW / ims[0].width; COLH = int(ims[0].height * scale)
tileH = COLH + LABH
sheet = Image.new("RGB", (cols*COLW + (cols+1)*GAP, rows*tileH + (rows+1)*GAP), (24,26,32))
d = ImageDraw.Draw(sheet)
try: font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 20)
except Exception: font = ImageFont.load_default()

def overlay_guides(tile):
    # conservative YT Shorts safe zones as fractions of a 1080x1920 frame
    ov = Image.new("RGBA", tile.size, (0, 0, 0, 0)); g = ImageDraw.Draw(ov)
    W, H = tile.size; fill = (255, 55, 55, 64); ln = (255, 70, 70, 200)
    g.rectangle([0, 0.78*H, W, H], fill=fill)                 # bottom UI (~22%)
    g.line([0, 0.78*H, W, 0.78*H], fill=ln, width=2)
    g.rectangle([0.87*W, 0.547*H, W, 0.844*H], fill=fill)     # right action rail
    g.rectangle([0, 0, W, 0.094*H], fill=fill)                # top UI (~9%)
    return Image.alpha_composite(tile.convert("RGBA"), ov).convert("RGB")

for i,(im,lab) in enumerate(zip(ims,labels)):
    r,c = divmod(i, cols)
    x = GAP + c*(COLW+GAP); y = GAP + r*tileH
    d.text((x+4, y+6), lab, fill=(235,238,242), font=font)
    tile = im.resize((COLW, COLH))
    if guides: tile = overlay_guides(tile)
    sheet.paste(tile, (x, y+LABH))
sheet.save(out)
print(f"\nsheet -> {out}  ({cols}x{rows}, {n} variants{', +YT safe-zone guides' if guides else ''})")
PY
echo DONE