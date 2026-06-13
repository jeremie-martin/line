#!/usr/bin/env bash
#
# eval_short_leaf.sh — evaluate THE working forward-eval leaf (the short / objective
# reconstruction) on the focus config, against a one-time full-leaf BASELINE, and run `decide`.
#
# Design (deliberately not parameterized — this IS the working version, no A/B knobs):
#   * Exactly one evaluation config: drums_crescendo, solo_run, big_air_ramp
#     × budgets 100k/200k/300k × 12 seeds (0-11) × 32 jobs × greedy:2.
#   * The candidate is ALWAYS the short leaf (LR_FWD_EVAL_LEAF=objective). No alternative path.
#   * The full leaf appears ONLY as a baseline, built EXACTLY ONCE and reused thereafter. On a
#     fresh machine (or after the baseline is deleted) it self-rebuilds on the next run, so the
#     script is portable and we never hand-run A/B again.
#   * Each invocation: ensure baseline -> run short candidate -> `decide` -> print a summary.
#
# Usage:   ./scripts/v0/eval_short_leaf.sh
#          REBUILD_BASELINE=1 ./scripts/v0/eval_short_leaf.sh   # force-rebuild the full baseline
#
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# ---------------- fixed evaluation config ----------------
SPECS="drums_crescendo,solo_run,big_air_ramp"
BUDGETS="100000,200000,300000"
SEEDS="0,1,2,3,4,5,6,7,8,9,10,11"   # 12 seeds
JOBS=32

OUTROOT="generated/short-leaf-eval"
BASELINE_DIR="$OUTROOT/baseline-full"
BASELINE_JSON="$BASELINE_DIR/golden.json"
STAMP="$(date +%Y%m%d-%H%M%S)"
CAND_DIR="$OUTROOT/short-$STAMP"
CAND_JSON="$CAND_DIR/golden.json"
mkdir -p "$OUTROOT"

# golden runner for a leaf mode -> archive dir. Compile spam goes to <dir>.log; the archive
# golden.json (what `decide` reads) is written regardless of stdout.
run_golden () {
  local leaf="$1" dir="$2"
  LR_ENGINE=wasm LR_FWD_EVAL=greedy:2 LR_FWD_EVAL_LEAF="$leaf" GOLDEN_SEEDS_OVERRIDE="$SEEDS" \
    npx tsx scripts/v0/golden.ts \
      --specs="$SPECS" --budgets="$BUDGETS" --jobs="$JOBS" --archive-dir="$dir" \
      > "$dir.log" 2>&1
}

echo "=== short-leaf eval ==="
echo "specs=$SPECS"
echo "budgets=$BUDGETS  seeds=12(0-11)  jobs=$JOBS  greedy:2"
echo

# 1) one-time FULL-leaf baseline (self-builds on a fresh machine; REBUILD_BASELINE=1 forces it)
if [[ "${REBUILD_BASELINE:-0}" == "1" ]]; then rm -rf "$BASELINE_DIR" "$BASELINE_DIR.log"; fi
if [[ -f "$BASELINE_JSON" ]]; then
  echo ">> baseline (full leaf): REUSING $BASELINE_DIR"
else
  echo ">> baseline (full leaf): not found — building ONCE at $BASELINE_DIR ..."
  run_golden full "$BASELINE_DIR"
  [[ -f "$BASELINE_JSON" ]] || { echo "ERROR: baseline produced no golden.json (see $BASELINE_DIR.log)"; exit 1; }
  echo ">> baseline (full leaf): built."
fi

# 2) ALWAYS run the short-leaf candidate
echo ">> candidate (short leaf): running at $CAND_DIR ..."
run_golden objective "$CAND_DIR"
[[ -f "$CAND_JSON" ]] || { echo "ERROR: candidate produced no golden.json (see $CAND_DIR.log)"; exit 1; }
echo ">> candidate (short leaf): done."
echo

# 3) decide: candidate (short) vs baseline (full). May exit non-zero on a REJECT verdict.
echo "=== decide: short (candidate) vs full (baseline) ==="
npx tsx scripts/v0/analyze_golden_curve.ts decide "$CAND_JSON" "$BASELINE_JSON" || true
echo

# 4) summary: what was compared, headline + per-spec means
echo "============================================================"
echo "  baseline (full) : $BASELINE_DIR"
echo "  candidate(short): $CAND_DIR"
echo "  logs            : $BASELINE_DIR.log  |  $CAND_DIR.log"
echo "------------------------------------------------------------"
python3 - "$CAND_JSON" "$BASELINE_JSON" <<'PY'
import json, sys
cand = json.load(open(sys.argv[1])); base = json.load(open(sys.argv[2]))
def perspec(d):
    o = {}
    for r in d.get("rows", []):
        for cp in r.get("checkpoints", []):
            if isinstance(cp.get("score"), (int, float)):
                o.setdefault(r.get("name"), []).append(cp["score"])
    return {k: sum(v) / len(v) for k, v in o.items()}
def valid(d):
    n = p = 0
    for r in d.get("rows", []):
        for cp in r.get("checkpoints", []):
            n += 1; p += 1 if cp.get("contract_passed") else 0
    return f"{p}/{n}"
cs, bs = perspec(cand), perspec(base)
ch = cand.get("headline", {}).get("score"); bh = base.get("headline", {}).get("score")
if isinstance(ch, (int, float)) and isinstance(bh, (int, float)):
    print(f"  HEADLINE   short {ch:7.2f}   full {bh:7.2f}   delta {ch-bh:+.2f}")
print(f"  validity   short {valid(cand):>9}   full {valid(base):>9}")
print(f"  {'spec':20s} {'short':>8} {'full':>8} {'delta':>8}")
for sp in sorted(bs):
    print(f"  {sp:20s} {cs.get(sp,0):8.1f} {bs.get(sp,0):8.1f} {cs.get(sp,0)-bs.get(sp,0):+8.1f}")
PY
echo "============================================================"
