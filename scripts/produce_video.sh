#!/usr/bin/env bash
#
# One-shot creative pipeline: spec → track → ride render → audio mux → overlay
# data → annotated Remotion render. Produces remotion/out/<name>_annotated.mp4.
#
#   scripts/produce_video.sh \
#     --spec=scripts/v0/specs/believer_curves.ts \
#     --name=believer_curves \
#     --budget=2000000 [--seed=0] [--audio=beats/audio.mp3]
#
# Defaults target the Believer curve spec, so a bare `scripts/produce_video.sh`
# reproduces the showcase end to end. Starts the Playwright mirror on :8765 if
# it isn't already running, and stops it on exit.
set -euo pipefail

SPEC="scripts/v0/specs/believer_curves.ts"
NAME="believer_curves"
BUDGET=2000000
SEED=0
AUDIO="beats/audio.mp3"

for a in "$@"; do
  case "$a" in
    --spec=*)   SPEC="${a#*=}" ;;
    --name=*)   NAME="${a#*=}" ;;
    --budget=*) BUDGET="${a#*=}" ;;
    --seed=*)   SEED="${a#*=}" ;;
    --audio=*)  AUDIO="${a#*=}" ;;
    *) echo "unknown arg: $a" >&2; exit 1 ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GEN="generated/$NAME"
SHK="shakedown/$NAME"
MIRROR_URL="http://127.0.0.1:8765/index.html"

echo "==> 1/5  compile  ($SPEC  budget=$BUDGET  seed=$SEED)"
npx tsx scripts/v0/run.ts --spec="$SPEC" --compiler=handoff --budget="$BUDGET" --seed="$SEED" --out="$GEN"

# Ensure the mirror is up (inspect.ts drives it via Playwright). Start a throwaway
# one if needed and tear it down on exit.
MIRROR_PID=""
if ! curl -sf -o /dev/null "$MIRROR_URL"; then
  echo "==>      starting mirror server on :8765"
  python3 -m http.server 8765 --bind 127.0.0.1 --directory mirror >/dev/null 2>&1 &
  MIRROR_PID=$!
  trap '[ -n "$MIRROR_PID" ] && kill "$MIRROR_PID" 2>/dev/null || true' EXIT
  for _ in $(seq 1 20); do curl -sf -o /dev/null "$MIRROR_URL" && break; sleep 0.5; done
fi

echo "==> 2/5  render ride → $SHK/video.mp4"
npx tsx scripts/inspect.ts --track="$GEN.track.json" --name="$NAME" --render --1080p

echo "==> 3/5  mux audio → $SHK/video_with_audio.mp4"
cp "$AUDIO" "$SHK/audio.mp3"
ffmpeg -y -i "$SHK/video.mp4" -i "$SHK/audio.mp3" \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -shortest \
  "$SHK/video_with_audio.mp4" >/dev/null 2>&1

echo "==> 4/5  overlay data → remotion/public/$NAME.overlay.json"
npx tsx scripts/make_overlay_data.ts \
  --spec="$SPEC" --report="$GEN.report.json" --track="$GEN.track.json" \
  --out="remotion/public/$NAME.overlay.json"
cp "$SHK/video_with_audio.mp4" "remotion/public/source.mp4"

DUR="$(python3 -c "import json;print(json.load(open('remotion/public/$NAME.overlay.json'))['durationS'])")"
echo "==> 5/5  annotated render → remotion/out/${NAME}_annotated.mp4 (dur=${DUR}s)"
( cd remotion && npx remotion render src/index.ts CurveOverlay "out/${NAME}_annotated.mp4" \
    --props="{\"dataFile\":\"$NAME.overlay.json\",\"videoFile\":\"source.mp4\",\"durationS\":$DUR}" )

echo ""
echo "DONE → remotion/out/${NAME}_annotated.mp4"
