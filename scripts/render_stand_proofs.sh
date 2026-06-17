#!/usr/bin/env bash
#
# Render the top-by-longest-stand winners from a sweep_stands.ts run, with the
# DETECTED stand windows burned into each clip (a colored border + side label that
# flashes on exactly while computeStands says "standing"), so a human can visually
# verify the detector matches what they call a tail/nose-stand.
#
#   scripts/render_stand_proofs.sh [--summary=generated/luna_stands/summary.json]
#     [--spec=scripts/v0/specs/luna_bala_44s.ts] [--audio=beats/luna_bala_44s.mp3]
#     [--res=720x1280] [--zoom-mult=1.8] [--out=shakedown/luna_stands]
#
# Border colors: tail = cyan, nose = orange. Output: <out>/seedN_stand.mp4 + a flat
# numbered copy rankNN_seedSS.mp4, plus a manifest.
set -euo pipefail

SUMMARY="generated/luna_stands/summary.json"
SPEC="scripts/v0/specs/luna_bala_44s.ts"
AUDIO="beats/luna_bala_44s.mp3"
RES="720x1280"
ZOOM_MULT="1.8"
OUT="shakedown/luna_stands"
for a in "$@"; do case "$a" in
  --summary=*) SUMMARY="${a#*=}" ;;
  --spec=*)    SPEC="${a#*=}" ;;
  --audio=*)   AUDIO="${a#*=}" ;;
  --res=*)     RES="${a#*=}" ;;
  --zoom-mult=*) ZOOM_MULT="${a#*=}" ;;
  --out=*)     OUT="${a#*=}" ;;
  *) echo "unknown arg: $a" >&2; exit 1 ;;
esac; done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
GENDIR="$(dirname "$SUMMARY")"
mkdir -p "$OUT"
FONT="$(fc-match -f '%{file}' sans 2>/dev/null || true)"

# mirror server for the ride render
MIRROR_URL="http://127.0.0.1:8765/index.html"; MIRROR_PID=""
if ! curl -sf -o /dev/null "$MIRROR_URL"; then
  echo "==> starting mirror server on :8765"
  python3 -m http.server 8765 --bind 127.0.0.1 --directory mirror >/dev/null 2>&1 &
  MIRROR_PID=$!
  trap '[ -n "$MIRROR_PID" ] && kill "$MIRROR_PID" 2>/dev/null || true' EXIT
  for _ in $(seq 1 20); do curl -sf -o /dev/null "$MIRROR_URL" && break; sleep 0.5; done
fi

# Emit "seed<TAB>longest<TAB>label<TAB>tailEnable<TAB>noseEnable" per winner.
mapfile -t WINNERS < <(python3 - "$SUMMARY" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
for w in d["winners"]:
    tail = [s for s in w["stands"] if s["side"] == "tail"]
    nose = [s for s in w["stands"] if s["side"] == "nose"]
    def enable(spans):
        # ffmpeg expr: OR of per-span windows; empty -> "0" (never)
        return "+".join(f"between(t,{s['startS']:.3f},{s['endS']:.3f})" for s in spans) or "0"
    label = f"seed {w['seed']}  longest {w['longestStandS']:.2f}s  {w['standCount']} stands"
    print("\t".join([str(w["seed"]), f"{w['longestStandS']:.2f}", label, enable(tail), enable(nose)]))
PY
)

echo "==> rendering ${#WINNERS[@]} stand-proof clips (res $RES) → $OUT/"
RANK=0
MANIFEST="$OUT/manifest.txt"; : > "$MANIFEST"
for line in "${WINNERS[@]}"; do
  RANK=$((RANK + 1))
  IFS=$'\t' read -r SEED LONGEST LABEL TAIL_EN NOSE_EN <<<"$line"
  TRACK="$GENDIR/seed${SEED}.track.json"
  RIDE="$GENDIR/seed${SEED}.ride.mp4"
  FINAL="$OUT/$(printf 'rank%02d_seed%s.mp4' "$RANK" "$SEED")"
  if [ ! -s "$TRACK" ]; then echo "  skip seed $SEED (no track)"; continue; fi
  if [ -s "$FINAL" ]; then echo "  cached rank $RANK seed $SEED"; echo "$FINAL  ($LABEL)" >> "$MANIFEST"; continue; fi

  # 1. ride render (vertical, spec camera + spec beat-punch)
  npx tsx scripts/export.ts --track="$TRACK" --spec="$SPEC" --zoom=action \
    --zoom-mult="$ZOOM_MULT" --res="$RES" --qp=20 --out="$RIDE" >"$GENDIR/seed${SEED}.render.log" 2>&1

  # 2. build the burn-in filter: a thick border that flashes on during stands
  #    (cyan=tail, orange=nose) + a side label, + a persistent header.
  VF="drawbox=x=0:y=0:w=iw:h=ih:t=18:color=cyan@0.95:enable='${TAIL_EN}'"
  VF="$VF,drawbox=x=0:y=0:w=iw:h=ih:t=18:color=orange@0.95:enable='${NOSE_EN}'"
  if [ -n "$FONT" ]; then
    ESC_LABEL="${LABEL//:/\\:}"
    VF="$VF,drawtext=fontfile='${FONT}':text='${ESC_LABEL}':x=(w-text_w)/2:y=24:fontsize=30:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=8"
    VF="$VF,drawtext=fontfile='${FONT}':text='STAND tail':x=(w-text_w)/2:y=h-70:fontsize=34:fontcolor=cyan:box=1:boxcolor=black@0.6:boxborderw=8:enable='${TAIL_EN}'"
    VF="$VF,drawtext=fontfile='${FONT}':text='STAND nose':x=(w-text_w)/2:y=h-70:fontsize=34:fontcolor=orange:box=1:boxcolor=black@0.6:boxborderw=8:enable='${NOSE_EN}'"
  fi

  # 3. burn in + mux the song
  ffmpeg -y -i "$RIDE" -i "$AUDIO" -vf "$VF" -map 0:v:0 -map 1:a:0 \
    -c:v libx264 -crf 20 -pix_fmt yuv420p -c:a aac -shortest "$FINAL" >>"$GENDIR/seed${SEED}.render.log" 2>&1

  rm -f "$RIDE"
  echo "  rank $RANK  seed $SEED  longest ${LONGEST}s  → $FINAL"
  echo "$FINAL  ($LABEL)" >> "$MANIFEST"
done

echo "DONE → $OUT/  (manifest: $MANIFEST)"
