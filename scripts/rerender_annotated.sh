#!/usr/bin/env bash
#
# Re-render ONLY the Remotion annotated overlays for an already-rendered top-K set,
# reusing the per-name source videos + overlay JSON the main pipeline left in
# remotion/public/. Use this to give every winner a consistent overlay look after
# the overlay component changed mid-batch. No recompile, no ride render.
#
#   scripts/rerender_annotated.sh \
#     --selection=generated/tiki_top10/selection.json \
#     --collect=shakedown/tiki_top10 [--res=1080p]
set -euo pipefail

SELECTION="generated/tiki_top10/selection.json"
COLLECT="shakedown/tiki_top10"
RES="1080p"
for a in "$@"; do
  case "$a" in
    --selection=*) SELECTION="${a#*=}" ;;
    --collect=*)   COLLECT="${a#*=}" ;;
    --res=*)       RES="${a#*=}" ;;
    *) echo "unknown arg: $a" >&2; exit 1 ;;
  esac
done
case "$RES" in
  1080p) REMOTION_SCALE=1 ;;
  720p)  REMOTION_SCALE=0.667 ;;
  480p)  REMOTION_SCALE=0.444 ;;
  *) echo "unknown --res=$RES" >&2; exit 1 ;;
esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

mapfile -t SEL < <(python3 - "$SELECTION" <<'PY'
import json, sys
for s in json.load(open(sys.argv[1])):
    print(f'{s["rank"]:02d}\t{s["seed"]}\t{s["name"]}')
PY
)

echo "==> re-rendering ${#SEL[@]} annotated overlays (res=$RES)"
for line in "${SEL[@]}"; do
  IFS=$'\t' read -r rank seed name <<<"$line"
  OVL="remotion/public/$name.overlay.json"
  SRC="remotion/public/$name.source.mp4"
  if [ ! -f "$OVL" ] || [ ! -f "$SRC" ]; then echo "    skip r$rank seed $seed (missing source/overlay)"; continue; fi
  DUR="$(python3 -c "import json;print(json.load(open('$OVL'))['durationS'])")"
  ( cd remotion && npx remotion render src/index.ts CurveOverlay "out/${name}_annotated.mp4" \
      --scale="$REMOTION_SCALE" \
      --props="{\"dataFile\":\"$name.overlay.json\",\"videoFile\":\"$name.source.mp4\",\"durationS\":$DUR}" \
      >/dev/null )
  cp "remotion/out/${name}_annotated.mp4" "$COLLECT/r${rank}_s${seed}_annotated.mp4"
  echo "    → $COLLECT/r${rank}_s${seed}_annotated.mp4"
done
echo "DONE"
