#!/usr/bin/env bash
#
# From a poc_tiki_stats sweep summary, pick top-N-by-score → top-K-by-rotation and
# render each winner as a VERTICAL (9:16, 1080x1920) YouTube Short:
#   ride (export.ts --res=1080x1920 --zoom=action --zoom-mult=1.8) + song
#   + the CurveOverlayVertical music-spectrum overlay (its baked-in defaults = the
#     locked "1_sym_lifted_edge" look).
#
# Compiles run in parallel (deterministic run.ts, same jolt as the sweep → exact
# reproduction). The music spectrum is computed ONCE (same song for every winner).
# The mirror ride-render + Remotion overlay run sequentially. Writes manifest.json.
#
#   scripts/render_vert_shorts.sh \
#     --summary=generated/tiki_sweep100/summary.json \
#     --spec=scripts/v0/specs/tiki_tiki_48s.ts \
#     --audio=beats/tiki_tiki_48s.mp3 \
#     --budget=1000000 --prefix=tiki_short \
#     --collect=shakedown/tiki_shorts --gendir=generated/tiki_shorts \
#     [--top-score=30] [--top-rot=10] [--zoom-mult=1.8]
set -euo pipefail

SUMMARY="generated/tiki_sweep100/summary.json"
SPEC="scripts/v0/specs/tiki_tiki_48s.ts"
AUDIO="beats/tiki_tiki_48s.mp3"
BUDGET=1000000
PREFIX="tiki_short"
COLLECT="shakedown/tiki_shorts"
GENDIR="generated/tiki_shorts"
TOP_SCORE=30
TOP_ROT=10
ZOOM_MULT=1.8

for a in "$@"; do case "$a" in
  --summary=*)   SUMMARY="${a#*=}" ;;
  --spec=*)      SPEC="${a#*=}" ;;
  --audio=*)     AUDIO="${a#*=}" ;;
  --budget=*)    BUDGET="${a#*=}" ;;
  --prefix=*)    PREFIX="${a#*=}" ;;
  --collect=*)   COLLECT="${a#*=}" ;;
  --gendir=*)    GENDIR="${a#*=}" ;;
  --top-score=*) TOP_SCORE="${a#*=}" ;;
  --top-rot=*)   TOP_ROT="${a#*=}" ;;
  --zoom-mult=*) ZOOM_MULT="${a#*=}" ;;
  *) echo "unknown arg: $a" >&2; exit 1 ;;
esac; done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
mkdir -p "$COLLECT" "$GENDIR" remotion/public remotion/out

# ── selection: top-N by score → top-K by revolutions ─────────────────────────
echo "==> selecting top-$TOP_SCORE by score → top-$TOP_ROT by rotation from $SUMMARY"
python3 - "$SUMMARY" "$TOP_SCORE" "$TOP_ROT" "$PREFIX" "$GENDIR/selection.json" <<'PY'
import json, sys
summary, topScore, topRot, prefix, outPath = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5]
rows = json.load(open(summary))["rows"]
byScore = sorted(rows, key=lambda r: r["score"], reverse=True)[:topScore]
byRot   = sorted(byScore, key=lambda r: r["revolutions"], reverse=True)[:topRot]
sel = [{"rank": i, "seed": r["seed"], "name": f'{prefix}_r{i:02d}_s{r["seed"]}',
        "score": round(r["score"], 1), "revolutions": round(r["revolutions"], 2)} for i, r in enumerate(byRot, 1)]
json.dump(sel, open(outPath, "w"), indent=2)
for s in sel: print(f'  r{s["rank"]:02d} seed {s["seed"]:>4}  score {s["score"]}  rev {s["revolutions"]}')
PY

mapfile -t SEL < <(python3 - "$GENDIR/selection.json" <<'PY'
import json, sys
for s in json.load(open(sys.argv[1])): print(f'{s["rank"]:02d}\t{s["seed"]}\t{s["name"]}')
PY
)

# ── music spectrum: computed ONCE (same song for every winner) ───────────────
SPECT="remotion/public/${PREFIX}.spectrum.json"
echo ""; echo "==> computing music spectrum once → $SPECT"
python3 scripts/make_spectrum.py --audio="$AUDIO" --out="$SPECT" --fps=30 --bands=56 | tail -1
SPECT_BASE="$(basename "$SPECT")"

# ── phase A: parallel deterministic compiles (track + report) ────────────────
echo ""; echo "==> phase A: compiling ${#SEL[@]} winners in parallel (budget=$BUDGET)"
pids=()
for line in "${SEL[@]}"; do
  IFS=$'\t' read -r rank seed name <<<"$line"
  if [ -s "$GENDIR/$name.track.json" ]; then echo "    cached r$rank seed $seed"; continue; fi
  ( npx tsx scripts/v0/run.ts --spec="$SPEC" --compiler=handoff --budget="$BUDGET" \
      --seed="$seed" --out="$GENDIR/$name" >"$GENDIR/$name.compile.log" 2>&1 \
      && echo "    compiled r$rank seed $seed" \
      || echo "    FAILED r$rank seed $seed (see $GENDIR/$name.compile.log)" ) &
  pids+=($!)
done
for p in "${pids[@]}"; do wait "$p"; done

# ── mirror server for the ride render ────────────────────────────────────────
MIRROR_URL="http://127.0.0.1:8765/index.html"; MIRROR_PID=""
if ! curl -sf -o /dev/null "$MIRROR_URL"; then
  echo "==> starting mirror server on :8765"
  python3 -m http.server 8765 --bind 127.0.0.1 --directory mirror >/dev/null 2>&1 &
  MIRROR_PID=$!
  trap '[ -n "$MIRROR_PID" ] && kill "$MIRROR_PID" 2>/dev/null || true' EXIT
  for _ in $(seq 1 20); do curl -sf -o /dev/null "$MIRROR_URL" && break; sleep 0.5; done
fi

# ── phase B: sequential vertical render per winner ───────────────────────────
echo ""; echo "==> phase B: rendering ${#SEL[@]} vertical Shorts (1080x1920, zoom-mult=$ZOOM_MULT)"
for line in "${SEL[@]}"; do
  IFS=$'\t' read -r rank seed name <<<"$line"
  GEN="$GENDIR/$name"
  if [ ! -s "$GEN.track.json" ]; then echo "    skip r$rank seed $seed (no track)"; continue; fi
  echo "  -- r$rank seed $seed ($name)"
  if ( set -e
    # 1. vertical ride render (spec camera, zoomed in for the tall frame)
    npx tsx scripts/export.ts --track="$GEN.track.json" --spec="$SPEC" --zoom=action \
      --zoom-mult="$ZOOM_MULT" --res=1080x1920 --out="$GEN.vert.mp4" >/dev/null
    # 2. mux the song
    ffmpeg -y -i "$GEN.vert.mp4" -i "$AUDIO" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -shortest \
      "remotion/public/${name}.source.mp4" >/dev/null 2>&1
    # 3. overlay bundle (so the composition's data loads; phases/axes unused in spectrum mode)
    npx tsx scripts/make_overlay_data.ts --spec="$SPEC" --report="$GEN.report.json" --track="$GEN.track.json" \
      --out="remotion/public/${name}.overlay.json" >/dev/null
    DUR="$(python3 -c "import json;print(json.load(open('remotion/public/${name}.overlay.json'))['durationS'])")"
    # 4. vertical spectrum overlay render (CurveOverlayVertical defaults = locked look)
    ( cd remotion && npx remotion render src/index.ts CurveOverlayVertical "out/${name}.mp4" \
        --props="{\"dataFile\":\"${name}.overlay.json\",\"videoFile\":\"${name}.source.mp4\",\"durationS\":$DUR,\"spectrumFile\":\"$SPECT_BASE\"}" >/dev/null )
    # 5. collect
    cp "remotion/out/${name}.mp4" "$COLLECT/r${rank}_s${seed}.mp4"
  ); then echo "     → $COLLECT/r${rank}_s${seed}.mp4"
  else echo "     FAILED r$rank seed $seed (see logs)"; fi
done

# ── manifest ─────────────────────────────────────────────────────────────────
python3 - "$GENDIR/selection.json" "$COLLECT" <<'PY'
import json, os, sys
sel, collect = json.load(open(sys.argv[1])), sys.argv[2]
out = []
for s in sel:
    v = f'{collect}/r{s["rank"]:02d}_s{s["seed"]}.mp4'
    out.append({**s, "video": v if os.path.exists(v) else None})
json.dump(out, open(f"{collect}/manifest.json", "w"), indent=2)
print(f'\nmanifest → {collect}/manifest.json ({sum(1 for o in out if o["video"])}/{len(out)} rendered)')
PY
echo ""; echo "DONE → $COLLECT/"
