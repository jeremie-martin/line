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
BEAT_PUNCH=1          # locked default: per-beat zoom punch on. --no-beat-punch to disable.
BP_PCT=70            # punch the top (100-PCT)% of this spec's beats by impact
JOBS=12              # parallel compiles in phase A
RENDER_JOBS=1        # parallel render pipelines in phase B (raise for big batches)
RIDE_QP=14           # ride intermediate quality (low = near-lossless, fed to the compositor)
FINAL_CRF=16         # published overlay quality (low = high quality master)
KEEP_INTER=0         # keep big intermediates (ride/source/overlay)? default: delete
INBOX=""             # if set, also emit upload-contract bundles here (video.mp4 + upload.json)
PROJECT="tiki"       # upload-contract project name (must match projects/<project>.toml)

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
  --beat-punch-pct=*) BP_PCT="${a#*=}" ;;
  --no-beat-punch) BEAT_PUNCH=0 ;;
  --jobs=*)      JOBS="${a#*=}" ;;
  --render-jobs=*) RENDER_JOBS="${a#*=}" ;;
  --ride-qp=*)   RIDE_QP="${a#*=}" ;;
  --final-crf=*) FINAL_CRF="${a#*=}" ;;
  --keep-intermediates) KEEP_INTER=1 ;;
  --inbox=*)     INBOX="${a#*=}" ;;
  --project=*)   PROJECT="${a#*=}" ;;
  *) echo "unknown arg: $a" >&2; exit 1 ;;
esac; done

BP_ARGS=""
[ "$BEAT_PUNCH" = "1" ] && BP_ARGS="--beat-punch --beat-punch-pct=$BP_PCT --zoom-ease=cubic"
GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
HOSTN="$(hostname 2>/dev/null || echo unknown)"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
mkdir -p "$COLLECT" "$GENDIR" remotion/public remotion/out
[ -n "$INBOX" ] && mkdir -p "$INBOX"

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
for s in json.load(open(sys.argv[1])): print(f'{s["rank"]:02d}\t{s["seed"]}\t{s["name"]}\t{s["score"]}\t{s["revolutions"]}')
PY
)

# ── music spectrum: computed ONCE (same song for every winner) ───────────────
SPECT="remotion/public/${PREFIX}.spectrum.json"
echo ""; echo "==> computing music spectrum once → $SPECT"
python3 scripts/make_spectrum.py --audio="$AUDIO" --out="$SPECT" --fps=30 --bands=56 | tail -1
SPECT_BASE="$(basename "$SPECT")"

# ── phase A: deterministic compiles (track + report), capped at JOBS ──────────
echo ""; echo "==> phase A: compiling ${#SEL[@]} winners (budget=$BUDGET, jobs=$JOBS)"
running=0
for line in "${SEL[@]}"; do
  IFS=$'\t' read -r rank seed name score rev <<<"$line"
  if [ -s "$GENDIR/$name.track.json" ]; then echo "    cached r$rank seed $seed"; continue; fi
  ( npx tsx scripts/v0/run.ts --spec="$SPEC" --compiler=handoff --budget="$BUDGET" \
      --seed="$seed" --out="$GENDIR/$name" >"$GENDIR/$name.compile.log" 2>&1 \
      && echo "    compiled r$rank seed $seed" \
      || echo "    FAILED r$rank seed $seed (see $GENDIR/$name.compile.log)" ) &
  running=$((running + 1))
  if (( running >= JOBS )); then wait -n; running=$((running - 1)); fi
done
wait

# ── mirror server for the ride render ────────────────────────────────────────
MIRROR_URL="http://127.0.0.1:8765/index.html"; MIRROR_PID=""
if ! curl -sf -o /dev/null "$MIRROR_URL"; then
  echo "==> starting mirror server on :8765"
  python3 -m http.server 8765 --bind 127.0.0.1 --directory mirror >/dev/null 2>&1 &
  MIRROR_PID=$!
  trap '[ -n "$MIRROR_PID" ] && kill "$MIRROR_PID" 2>/dev/null || true' EXIT
  for _ in $(seq 1 20); do curl -sf -o /dev/null "$MIRROR_URL" && break; sleep 0.5; done
fi

# ── phase B: vertical render per winner, capped at RENDER_JOBS ────────────────
# Per winner: ride render (spec camera, zoom-mult + optional beat-punch) → mux song →
# overlay bundle → CurveOverlayVertical (defaults = the locked look). Files are
# per-name so pipelines run independently in parallel; logs go to <name>.render.log.
render_one () {
  local rank="$1" seed="$2" name="$3" score="$4" rev="$5" GEN="$GENDIR/$3"
  local log="$ROOT/$GENDIR/$3.render.log"   # ABSOLUTE: the remotion step cd's into remotion/
  if [ ! -s "$GEN.track.json" ]; then echo "     skip r$rank s$seed (no track)"; return 0; fi
  local rc=0
  set +e                  # honor the inner subshell's own set -e, but don't abort the whole batch
  ( set -e
    # 1. ride render — HQ near-lossless intermediate (low QP) so compositing doesn't degrade
    npx tsx scripts/export.ts --track="$GEN.track.json" --spec="$SPEC" --zoom=action \
      --zoom-mult="$ZOOM_MULT" $BP_ARGS --res=1080x1920 --qp="$RIDE_QP" --out="$GEN.vert.mp4" >"$log" 2>&1
    # 2. mux song
    ffmpeg -y -i "$GEN.vert.mp4" -i "$AUDIO" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -shortest \
      "remotion/public/${name}.source.mp4" >>"$log" 2>&1
    # 3. overlay bundle (so the composition's data loads)
    npx tsx scripts/make_overlay_data.ts --spec="$SPEC" --report="$GEN.report.json" --track="$GEN.track.json" \
      --out="remotion/public/${name}.overlay.json" >>"$log" 2>&1
    local DUR; DUR="$(python3 -c "import json;print(json.load(open('remotion/public/${name}.overlay.json'))['durationS'])")"
    # 4. HQ overlay render (low CRF master)
    ( cd remotion && npx remotion render src/index.ts CurveOverlayVertical "out/${name}.mp4" \
        --crf="$FINAL_CRF" --jpeg-quality=100 \
        --props="{\"dataFile\":\"${name}.overlay.json\",\"videoFile\":\"${name}.source.mp4\",\"durationS\":$DUR,\"spectrumFile\":\"$SPECT_BASE\"}" >>"$log" 2>&1 )
    # 5. flat copy for easy review
    cp "remotion/out/${name}.mp4" "$COLLECT/r${rank}_s${seed}.mp4"
    # 6. upload-contract bundle: stage in a dot-dir, write upload.json, then atomic mv into place (sidecar last)
    if [ -n "$INBOX" ]; then
      local day stamp bid final tmp
      day="$(date -u +%Y/%m/%d)"; stamp="$(date -u +%Y%m%dT%H%M%SZ)"
      bid="$PROJECT/$day/${PROJECT}-s${seed}-${stamp}"
      final="$INBOX/$bid"; tmp="$INBOX/.staging-${PROJECT}-s${seed}-${stamp}"
      rm -rf "$tmp"; mkdir -p "$tmp" "$(dirname "$final")"
      cp "remotion/out/${name}.mp4" "$tmp/video.mp4"
      CREATED="$(date -u +%Y-%m-%dT%H:%M:%SZ)" PROJ="$PROJECT" python3 - "$tmp/upload.json" "$seed" "$score" "$rev" "$GIT_SHA" "$HOSTN" "$BUDGET" "$rank" <<'PY'
import json, os, sys
p, seed, score, rev, sha, host, budget, rank = sys.argv[1:9]
json.dump({
  "project": os.environ["PROJ"],
  "video": "video.mp4",
  "created_at": os.environ["CREATED"],
  "values": {"seed": int(seed), "rep": 0},
  "meta": {"git_sha": sha, "generator_host": host, "rank": int(rank),
           "score": float(score), "revolutions": float(rev), "budget": int(budget)},
}, open(p, "w"), indent=2)
PY
      mv "$tmp" "$final"
    fi
    # 7. delete big intermediates (ride/source/overlay/out) unless asked to keep
    if [ "$KEEP_INTER" != "1" ]; then
      rm -f "$GEN.vert.mp4" "remotion/public/${name}.source.mp4" "remotion/public/${name}.overlay.json" "remotion/out/${name}.mp4"
    fi
  )
  rc=$?
  set -e
  if [ "$rc" -eq 0 ]; then echo "     → r$rank s$seed  score $score rev $rev${INBOX:+  (bundled)}"
  else echo "     FAILED r$rank s$seed (see $log)"; fi
  return 0
}

echo ""; echo "==> phase B: rendering ${#SEL[@]} vertical Shorts (1080x1920, qp=$RIDE_QP→crf=$FINAL_CRF, beat-punch=$BEAT_PUNCH pct=$BP_PCT, render-jobs=$RENDER_JOBS${INBOX:+, inbox=$INBOX})"
running=0
for line in "${SEL[@]}"; do
  IFS=$'\t' read -r rank seed name score rev <<<"$line"
  render_one "$rank" "$seed" "$name" "$score" "$rev" &
  running=$((running + 1))
  if (( running >= RENDER_JOBS )); then wait -n; running=$((running - 1)); fi
done
wait

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
