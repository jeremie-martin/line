#!/usr/bin/env bash
#
# Re-render an already-selected top-K set at HIGH QUALITY, reusing the existing
# compiled tracks (no recompile, no re-selection):
#   - base ride video at 1080p, HQ, low QP (near-lossless) + 320k audio  → the showcase plain video
#   - annotated overlay re-rendered from that HQ base with a crisp encode (CRF 12, PNG frames)
# Base renders run in parallel (independent headless browsers on the shared mirror);
# the Remotion annotated renders run sequentially.
#
#   scripts/rerender_hq.sh \
#     --selection=generated/tiki_top10/selection.json \
#     --spec=scripts/v0/specs/tiki_tiki_48s.ts \
#     --audio=beats/tiki_tiki_48s.mp3 \
#     --gendir=generated/tiki_top10 --collect=shakedown/tiki_top10 \
#     [--qp=14] [--crf=12] [--jobs=5]
set -euo pipefail

SELECTION="generated/tiki_top10/selection.json"
SPEC="scripts/v0/specs/tiki_tiki_48s.ts"
AUDIO="beats/tiki_tiki_48s.mp3"
GENDIR="generated/tiki_top10"
COLLECT="shakedown/tiki_top10"
QP=14
CRF=12
JOBS=5
for a in "$@"; do
  case "$a" in
    --selection=*) SELECTION="${a#*=}" ;;
    --spec=*)      SPEC="${a#*=}" ;;
    --audio=*)     AUDIO="${a#*=}" ;;
    --gendir=*)    GENDIR="${a#*=}" ;;
    --collect=*)   COLLECT="${a#*=}" ;;
    --qp=*)        QP="${a#*=}" ;;
    --crf=*)       CRF="${a#*=}" ;;
    --jobs=*)      JOBS="${a#*=}" ;;
    *) echo "unknown arg: $a" >&2; exit 1 ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p "$COLLECT"

mapfile -t SEL < <(python3 - "$SELECTION" <<'PY'
import json, sys
for s in json.load(open(sys.argv[1])):
    print(f'{s["rank"]:02d}\t{s["seed"]}\t{s["name"]}')
PY
)

# ── mirror for the Playwright base render ────────────────────────────────────
MIRROR_URL="http://127.0.0.1:8765/index.html"
MIRROR_PID=""
if ! curl -sf -o /dev/null "$MIRROR_URL"; then
  echo "==> starting mirror server on :8765"
  python3 -m http.server 8765 --bind 127.0.0.1 --directory mirror >/dev/null 2>&1 &
  MIRROR_PID=$!
  trap '[ -n "$MIRROR_PID" ] && kill "$MIRROR_PID" 2>/dev/null || true' EXIT
  for _ in $(seq 1 20); do curl -sf -o /dev/null "$MIRROR_URL" && break; sleep 0.5; done
fi

# ── phase 1: HQ base ride videos (parallel) ──────────────────────────────────
echo "==> phase 1: HQ base renders (1080p, hq, QP=$QP, ${JOBS} parallel)"
base_one() {
  local rank="$1" seed="$2" name="$3"
  local GEN="$GENDIR/$name" SHK="shakedown/$name"
  if [ ! -s "$GEN.track.json" ]; then echo "    skip r$rank seed $seed (no track)"; return; fi
  mkdir -p "$SHK"
  if npx tsx scripts/export.ts --track="$GEN.track.json" --spec="$SPEC" --zoom=action \
      --res=1080p --hq --qp="$QP" --out="$SHK/video.mp4" >"$GEN.hqbase.log" 2>&1; then
    cp "$AUDIO" "$SHK/audio.mp3"
    ffmpeg -y -i "$SHK/video.mp4" -i "$SHK/audio.mp3" \
      -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -shortest \
      "$SHK/video_with_audio.mp4" >/dev/null 2>&1
    cp "$SHK/video_with_audio.mp4" "$COLLECT/r${rank}_s${seed}.mp4"
    cp "$SHK/video_with_audio.mp4" "remotion/public/$name.source.mp4"
    echo "    HQ base r$rank seed $seed → $COLLECT/r${rank}_s${seed}.mp4 ($(du -h "$COLLECT/r${rank}_s${seed}.mp4" | cut -f1))"
  else
    echo "    FAILED base r$rank seed $seed (see $GEN.hqbase.log)"
  fi
}
running=0
for line in "${SEL[@]}"; do
  IFS=$'\t' read -r rank seed name <<<"$line"
  base_one "$rank" "$seed" "$name" &
  running=$((running+1))
  if [ "$running" -ge "$JOBS" ]; then wait -n; running=$((running-1)); fi
done
wait

# ── phase 2: crisp annotated overlays from the HQ base (sequential) ───────────
echo "==> phase 2: HQ annotated renders (CRF=$CRF, PNG frames)"
for line in "${SEL[@]}"; do
  IFS=$'\t' read -r rank seed name <<<"$line"
  OVL="remotion/public/$name.overlay.json"
  SRC="remotion/public/$name.source.mp4"
  if [ ! -f "$OVL" ] || [ ! -f "$SRC" ]; then echo "    skip r$rank seed $seed (missing overlay/source)"; continue; fi
  DUR="$(python3 -c "import json;print(json.load(open('$OVL'))['durationS'])")"
  if ( cd remotion && npx remotion render src/index.ts CurveOverlay "out/${name}_annotated.mp4" \
        --scale=1 --image-format=png --crf="$CRF" --audio-bitrate=320K \
        --props="{\"dataFile\":\"$name.overlay.json\",\"videoFile\":\"$name.source.mp4\",\"durationS\":$DUR}" \
        >/dev/null 2>&1 ); then
    cp "remotion/out/${name}_annotated.mp4" "$COLLECT/r${rank}_s${seed}_annotated.mp4"
    echo "    HQ annotated r$rank seed $seed → $COLLECT/r${rank}_s${seed}_annotated.mp4 ($(du -h "$COLLECT/r${rank}_s${seed}_annotated.mp4" | cut -f1))"
  else
    echo "    FAILED annotated r$rank seed $seed"
  fi
done

echo "DONE → $COLLECT/ (HQ: base QP=$QP, annotated CRF=$CRF)"
