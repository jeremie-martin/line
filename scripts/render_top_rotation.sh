#!/usr/bin/env bash
#
# From a poc_tiki_stats sweep summary, pick the top-N by score, then the top-K by
# rotation among those, and render each winner two ways:
#   1. the plain ride video with the song muxed in   → <collect>/r<NN>_s<seed>.mp4
#   2. the Remotion annotated-overlay video          → <collect>/r<NN>_s<seed>_annotated.mp4
#
# Compiles run in parallel (deterministic run.ts, same jolt as the sweep, so the
# selected seeds reproduce exactly); the GPU/Playwright/Remotion render steps run
# sequentially. Writes <collect>/manifest.json for browsing.
#
#   scripts/render_top_rotation.sh \
#     --summary=generated/tiki_sweep100/summary.json \
#     --spec=scripts/v0/specs/tiki_tiki_48s.ts \
#     --audio=beats/tiki_tiki_48s.mp3 \
#     --budget=1000000 --prefix=tiki_t10 \
#     --collect=shakedown/tiki_top10 --gendir=generated/tiki_top10 \
#     [--top-score=30] [--top-rot=10] [--res=1080p]
set -euo pipefail

SUMMARY="generated/tiki_sweep100/summary.json"
SPEC="scripts/v0/specs/tiki_tiki_48s.ts"
AUDIO="beats/tiki_tiki_48s.mp3"
BUDGET=1000000
PREFIX="tiki_t10"
COLLECT="shakedown/tiki_top10"
GENDIR="generated/tiki_top10"
TOP_SCORE=30
TOP_ROT=10
RES="1080p"

for a in "$@"; do
  case "$a" in
    --summary=*)   SUMMARY="${a#*=}" ;;
    --spec=*)      SPEC="${a#*=}" ;;
    --audio=*)     AUDIO="${a#*=}" ;;
    --budget=*)    BUDGET="${a#*=}" ;;
    --prefix=*)    PREFIX="${a#*=}" ;;
    --collect=*)   COLLECT="${a#*=}" ;;
    --gendir=*)    GENDIR="${a#*=}" ;;
    --top-score=*) TOP_SCORE="${a#*=}" ;;
    --top-rot=*)   TOP_ROT="${a#*=}" ;;
    --res=*)       RES="${a#*=}" ;;
    *) echo "unknown arg: $a" >&2; exit 1 ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p "$COLLECT" "$GENDIR"

case "$RES" in
  1080p) RIDE_FLAG="--1080p"; REMOTION_SCALE=1 ;;
  720p)  RIDE_FLAG="";        REMOTION_SCALE=0.667 ;;
  480p)  RIDE_FLAG="";        REMOTION_SCALE=0.444 ;;
  *) echo "unknown --res=$RES" >&2; exit 1 ;;
esac

# ── selection: top-N by score → top-K by revolutions ─────────────────────────
echo "==> selecting top-$TOP_SCORE by score → top-$TOP_ROT by rotation from $SUMMARY"
python3 - "$SUMMARY" "$TOP_SCORE" "$TOP_ROT" "$PREFIX" "$GENDIR/selection.json" <<'PY'
import json, sys
summary, topScore, topRot, prefix, outPath = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5]
rows = json.load(open(summary))["rows"]
byScore = sorted(rows, key=lambda r: r["score"], reverse=True)[:topScore]
byRot   = sorted(byScore, key=lambda r: r["revolutions"], reverse=True)[:topRot]
sel = []
for i, r in enumerate(byRot, 1):
    sel.append({
        "rank": i, "seed": r["seed"], "name": f'{prefix}_r{i:02d}_s{r["seed"]}',
        "score": round(r["score"], 1), "revolutions": round(r["revolutions"], 2),
        "netRotationDeg": round(r["netRotationDeg"]), "flipCount": r["flipCount"],
        "peakOmega": round(r["peakAngularSpeedDegPerFrame"], 1),
    })
json.dump(sel, open(outPath, "w"), indent=2)
print(f'{"rk":>2} {"seed":>5} {"score":>6} {"rev":>5} {"netDeg":>7} {"flips":>5}')
for s in sel:
    print(f'{s["rank"]:>2} {s["seed"]:>5} {s["score"]:>6} {s["revolutions"]:>5} {s["netRotationDeg"]:>7} {s["flipCount"]:>5}')
PY

# TSV of "rank<TAB>seed<TAB>name" for the bash loops
mapfile -t SEL < <(python3 - "$GENDIR/selection.json" <<'PY'
import json, sys
for s in json.load(open(sys.argv[1])):
    print(f'{s["rank"]:02d}\t{s["seed"]}\t{s["name"]}')
PY
)

# ── phase A: parallel deterministic compiles ─────────────────────────────────
echo ""
echo "==> phase A: compiling ${#SEL[@]} winners in parallel (budget=$BUDGET)"
pids=()
for line in "${SEL[@]}"; do
  IFS=$'\t' read -r rank seed name <<<"$line"
  if [ -s "$GENDIR/$name.track.json" ]; then
    echo "    cached r$rank seed $seed → $GENDIR/$name.track.json"
    continue
  fi
  ( npx tsx scripts/v0/run.ts --spec="$SPEC" --compiler=handoff --budget="$BUDGET" \
      --seed="$seed" --out="$GENDIR/$name" >"$GENDIR/$name.compile.log" 2>&1 \
      && echo "    compiled r$rank seed $seed → $GENDIR/$name.track.json" \
      || echo "    FAILED r$rank seed $seed (see $GENDIR/$name.compile.log)" ) &
  pids+=($!)
done
for p in "${pids[@]}"; do wait "$p"; done

# ── mirror for the Playwright ride render ────────────────────────────────────
MIRROR_URL="http://127.0.0.1:8765/index.html"
MIRROR_PID=""
if ! curl -sf -o /dev/null "$MIRROR_URL"; then
  echo "==> starting mirror server on :8765"
  python3 -m http.server 8765 --bind 127.0.0.1 --directory mirror >/dev/null 2>&1 &
  MIRROR_PID=$!
  trap '[ -n "$MIRROR_PID" ] && kill "$MIRROR_PID" 2>/dev/null || true' EXIT
  for _ in $(seq 1 20); do curl -sf -o /dev/null "$MIRROR_URL" && break; sleep 0.5; done
fi

# ── phase B: sequential render (ride → mux → overlay → annotated) ─────────────
echo ""
echo "==> phase B: rendering ${#SEL[@]} winners (res=$RES, zoom=action)"
for line in "${SEL[@]}"; do
  IFS=$'\t' read -r rank seed name <<<"$line"
  GEN="$GENDIR/$name"
  SHK="shakedown/$name"
  if [ ! -s "$GEN.track.json" ]; then echo "    skip r$rank seed $seed (no track)"; continue; fi
  echo "  -- r$rank seed $seed ($name)"

  # one winner failing must not abort the other nine
  if ( set -e
    # 1. ride render (spec camera) → shakedown/<name>/video.mp4
    npx tsx scripts/inspect.ts --track="$GEN.track.json" --spec="$SPEC" --name="$name" \
      --render $RIDE_FLAG --zoom=action >/dev/null

    # 2. mux the song
    cp "$AUDIO" "$SHK/audio.mp3"
    ffmpeg -y -i "$SHK/video.mp4" -i "$SHK/audio.mp3" \
      -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -shortest \
      "$SHK/video_with_audio.mp4" >/dev/null 2>&1

    # 3. overlay data + per-name source for Remotion
    npx tsx scripts/make_overlay_data.ts \
      --spec="$SPEC" --report="$GEN.report.json" --track="$GEN.track.json" \
      --out="remotion/public/$name.overlay.json" >/dev/null
    cp "$SHK/video_with_audio.mp4" "remotion/public/$name.source.mp4"
    DUR="$(python3 -c "import json;print(json.load(open('remotion/public/$name.overlay.json'))['durationS'])")"

    # 4. annotated Remotion render → remotion/out/<name>_annotated.mp4
    ( cd remotion && npx remotion render src/index.ts CurveOverlay "out/${name}_annotated.mp4" \
        --scale="$REMOTION_SCALE" \
        --props="{\"dataFile\":\"$name.overlay.json\",\"videoFile\":\"$name.source.mp4\",\"durationS\":$DUR}" \
        >/dev/null )

    # 5. collect tidy copies
    cp "$SHK/video_with_audio.mp4" "$COLLECT/r${rank}_s${seed}.mp4"
    cp "remotion/out/${name}_annotated.mp4" "$COLLECT/r${rank}_s${seed}_annotated.mp4"
  ); then
    echo "     → $COLLECT/r${rank}_s${seed}.mp4 (+ _annotated.mp4)"
  else
    echo "     FAILED r$rank seed $seed (render step errored)"
  fi
done

# ── manifest ─────────────────────────────────────────────────────────────────
python3 - "$GENDIR/selection.json" "$COLLECT" <<'PY'
import json, os, sys
sel, collect = json.load(open(sys.argv[1])), sys.argv[2]
out = []
for s in sel:
    plain = f'{collect}/r{s["rank"]:02d}_s{s["seed"]}.mp4'
    anno  = f'{collect}/r{s["rank"]:02d}_s{s["seed"]}_annotated.mp4'
    out.append({**s,
                "video": plain if os.path.exists(plain) else None,
                "annotated": anno if os.path.exists(anno) else None})
json.dump(out, open(f"{collect}/manifest.json", "w"), indent=2)
print(f'\nmanifest → {collect}/manifest.json ({sum(1 for o in out if o["video"])}/{len(out)} rendered)')
PY

echo ""
echo "DONE → $COLLECT/"
