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
for a in "$@"; do case "$a" in
  --name=*)  NAME="${a#*=}" ;;
  --frame=*) FRAME="${a#*=}" ;;
  *) echo "unknown arg: $a" >&2; exit 1 ;;
esac; done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
DUR=$(python3 -c "import json;print(json.load(open('remotion/public/$NAME.overlay.json'))['durationS'])")
BASE="\"dataFile\":\"$NAME.overlay.json\",\"videoFile\":\"$NAME.source.mp4\",\"durationS\":$DUR"
[ -f "remotion/public/$NAME.spectrum.json" ] && BASE="$BASE,\"spectrumFile\":\"$NAME.spectrum.json\""
OUT="shakedown/vertical_test"; mkdir -p "$OUT"

# label | variant-props fragment  (merged onto BASE). Edit freely.
# Symmetric, edge-to-edge, spectrum-only — bracketing center (vertical position) and
# bar size. rider up 7% (9% on the last one). Goal: balanced gap above & below spectrum.
VARIANTS=(
  "c72_b18|\"specCenterPct\":0.72,\"specMaxBarPct\":0.18,\"riderShiftPct\":0.07"
  "c72_b20|\"specCenterPct\":0.72,\"specMaxBarPct\":0.20,\"riderShiftPct\":0.07"
  "c72_b22|\"specCenterPct\":0.72,\"specMaxBarPct\":0.22,\"riderShiftPct\":0.07"
  "c70_b20|\"specCenterPct\":0.70,\"specMaxBarPct\":0.20,\"riderShiftPct\":0.07"
  "c74_b20|\"specCenterPct\":0.74,\"specMaxBarPct\":0.20,\"riderShiftPct\":0.07"
  "c73_b21_r9|\"specCenterPct\":0.73,\"specMaxBarPct\":0.21,\"riderShiftPct\":0.09"
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

# montage into one contact sheet with PIL (no imagemagick needed)
python3 - "$OUT/sheet_${NAME}.png" "${#PNGS[@]}" "${PNGS[@]}" "${LABELS[@]}" <<'PY'
import sys
from PIL import Image, ImageDraw, ImageFont
out = sys.argv[1]; n = int(sys.argv[2])
pngs = sys.argv[3:3+n]; labels = sys.argv[3+n:3+2*n]
COLW, GAP, LABH = 360, 16, 34          # per-tile width, gap, label band
cols = min(n, 3); rows = (n + cols - 1) // cols
ims = [Image.open(p).convert("RGB") for p in pngs]
scale = COLW / ims[0].width; COLH = int(ims[0].height * scale)
tileH = COLH + LABH
sheet = Image.new("RGB", (cols*COLW + (cols+1)*GAP, rows*tileH + (rows+1)*GAP), (24,26,32))
d = ImageDraw.Draw(sheet)
try: font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 20)
except Exception: font = ImageFont.load_default()
for i,(im,lab) in enumerate(zip(ims,labels)):
    r,c = divmod(i, cols)
    x = GAP + c*(COLW+GAP); y = GAP + r*tileH
    d.text((x+4, y+6), lab, fill=(235,238,242), font=font)
    sheet.paste(im.resize((COLW, COLH)), (x, y+LABH))
sheet.save(out)
print(f"\nsheet -> {out}  ({cols}x{rows}, {n} variants)")
PY
echo DONE