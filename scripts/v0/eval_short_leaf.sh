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
# SPECS empty => run ALL golden specs (no --specs override); set it to a comma list to focus.
SPECS="${SPECS:-}"
BUDGETS="100000,200000,300000"
SEEDS="0,1,2,3,4,5,6,7,8,9,10,11"   # 12 seeds
JOBS="${JOBS:-48}"

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
  local specflag=()
  [[ -n "$SPECS" ]] && specflag=(--specs="$SPECS")   # omit => golden runs ALL golden specs
  LR_ENGINE=wasm LR_FWD_EVAL=greedy:2 LR_FWD_EVAL_LEAF="$leaf" GOLDEN_SEEDS_OVERRIDE="$SEEDS" \
    npx tsx scripts/v0/golden.ts \
      "${specflag[@]}" --budgets="$BUDGETS" --jobs="$JOBS" --archive-dir="$dir" \
      > "$dir.log" 2>&1
}

echo "=== short-leaf eval ==="
echo "specs=${SPECS:-ALL golden specs}"
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
budgets = sorted({cp["budget"] for r in cand.get("rows", []) for cp in r.get("checkpoints", [])})
specs   = sorted({r.get("name") for r in cand.get("rows", [])})
def cells(d):
    # (spec,budget) -> [sum_score, pass, total]
    agg = {}
    for r in d.get("rows", []):
        sp = r.get("name")
        for cp in r.get("checkpoints", []):
            k = (sp, cp.get("budget")); a = agg.setdefault(k, [0.0, 0, 0])
            if isinstance(cp.get("score"), (int, float)): a[0] += cp["score"]
            a[1] += 1 if cp.get("contract_passed") else 0; a[2] += 1
    return agg
cc, bc = cells(cand), cells(base)
def m(a, k): v = a.get(k); return (v[0] / v[2]) if v and v[2] else 0.0
def fb(b): return f"{b//1000}k" if b % 1000 == 0 else str(b)
ch = cand.get("headline", {}).get("score"); bh = base.get("headline", {}).get("score")
if isinstance(ch, (int, float)) and isinstance(bh, (int, float)):
    print(f"  HEADLINE (budget-weighted)   short {ch:7.2f}   full {bh:7.2f}   Δ {ch-bh:+.2f}")
print()
print("  per-budget (mean over specs):")
print(f"    {'budget':>6} {'short':>8} {'full':>8} {'Δ':>8}")
for b in budgets:
    cs = sum(m(cc, (sp, b)) for sp in specs) / len(specs)
    bs = sum(m(bc, (sp, b)) for sp in specs) / len(specs)
    print(f"    {fb(b):>6} {cs:8.1f} {bs:8.1f} {cs-bs:+8.1f}")
print()
print("  per-track × budget   (valid = short,full pass-rate):")
print(f"    {'spec':16s} {'budget':>6} {'short':>8} {'full':>8} {'Δ':>8}   valid")
for sp in specs:
    for b in budgets:
        c, f = cc.get((sp, b)), bc.get((sp, b))
        cm, fm = m(cc, (sp, b)), m(bc, (sp, b))
        cv = f"{c[1]}/{c[2]}" if c else "-"; fv = f"{f[1]}/{f[2]}" if f else "-"
        print(f"    {sp:16s} {fb(b):>6} {cm:8.1f} {fm:8.1f} {cm-fm:+8.1f}   {cv},{fv}")
PY
echo "============================================================"

# Per-axis & factor diagnostics, read from the per-checkpoint report.json files (true-scorer on
# the OUTPUT tracks). CAVEAT: short and full ran DIFFERENT searches, so this shows where the output
# TRACKS differ, not per-arc scorer error — see eval_arc_apples.ts for the apples-to-apples test.
echo
echo "=== per-axis & factor diagnostics (true-scorer; NOT apples-to-apples — different searches) ==="
python3 - "$CAND_JSON" "$BASELINE_JSON" <<'PY'
import json, sys, os
from collections import defaultdict
def gather(path):
    g = json.load(open(path)); out = {}
    for r in g.get("rows", []):
        d = out.setdefault(r.get("name"), dict(drift=0, off_beat=0, missing=0, deaths=0,
            axis=defaultdict(lambda: [0.0, 0])))
        for cp in r.get("checkpoints", []):
            d["drift"] += cp.get("drift", 0); d["missing"] += cp.get("missing", 0)
            for hf in cp.get("hard_failures", []):
                if hf.startswith("offBeat:"): d["off_beat"] += int(hf.split(":")[1])
                if hf.startswith("died:"):    d["deaths"] += 1
            rp = cp.get("report_path")
            if rp and os.path.exists(rp):
                for gap in json.load(open(rp)).get("gaps", []):
                    for ax, v in (gap.get("axes") or {}).items():
                        e = v.get("error")
                        if isinstance(e, (int, float)): d["axis"][ax][0] += abs(e); d["axis"][ax][1] += 1
    return out
cand, base = gather(sys.argv[1]), gather(sys.argv[2])
for sp in sorted(base):
    c, b = cand.get(sp, {}), base.get(sp, {})
    print(f"  {sp}")
    print(f"    factors short/full :  drift {c.get('drift',0)}/{b.get('drift',0)}"
          f"   off_beat {c.get('off_beat',0)}/{b.get('off_beat',0)}"
          f"   missing {c.get('missing',0)}/{b.get('missing',0)}"
          f"   deaths {c.get('deaths',0)}/{b.get('deaths',0)}")
    ca, ba = c.get("axis", {}), b.get("axis", {})
    def mae(a, ax): v = a.get(ax); return (v[0] / v[1]) if v and v[1] else 0.0
    cells = "  ".join(f"{ax} {mae(ca,ax)-mae(ba,ax):+.3f}" for ax in sorted(set(ca) | set(ba)))
    print(f"    mean|err| short−full:  {cells}")
PY
echo "============================================================"
