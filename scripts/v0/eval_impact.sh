#!/usr/bin/env bash
#
# eval_impact.sh — IMPACT-METRIC retuning board (a copy of eval_planning.sh).
# =============================================================================
#
# Fast iteration harness for the redirArc impact-metric era (commit 79627f5: impact redefined
# as redirArc = v·Δθ, felt-anchored normImpact, dead-zone below SOFT=2.0, saturate at 6.5).
# Use this to A/B any compiler/calibration change against a FROZEN reference = the current
# current-metric, PLANNING-OFF compiler.
#   docs/impact_contract.md            — the metric contract (definition/feasibility/scoring).
#   docs/impact_definition.md          — current formula, frame semantics, ruler, legacy policy
#                                        (existing specs authored on the OLD soft≈0.2 scale).
#   generated/impact-study/            — the before/after metric study + analyze_shift.py.
#
# THE BOARD: 13 specs spanning the impact target bands (light / now-harder mid ~0.3–0.5 /
# now-easier high ≥0.6), density (dense + sparse), speed (slow + fast), plus elevation/
# amplitude collateral guards. x {150k, 300k} x 9 seeds. Two specs are drums (the strongest
# impact carriers) and pathologically SEED-VARIANT — always decide on the full 9-seed board,
# never a few-seed run.ts study. Spec names verified in golden_suite.ts GOLDEN_SPECS.
#
# PLANNING IS OFF on both arms (LR_PLAN_LOOP=0) so the impact re-aiming loop can never
# confound an impact-metric experiment.
#
# HOW TO USE
# ----------
#   ./scripts/v0/eval_impact.sh            # candidate (current code/env) vs frozen baseline, decide
#   ./scripts/v0/eval_impact.sh rebuild    # force a fresh baseline for the current params, then run
#   ./scripts/v0/eval_impact.sh info       # show resolved config + frozen baseline provenance, stop
#   ./scripts/v0/eval_impact.sh sweep <pt1> [pt2 ...]
#                                          # run each candidate-env point vs the SAME frozen baseline
#
# INJECT ENV WITHOUT EDITING THIS FILE
#   CAND_ENV="K=V K2=V2" ./eval_impact.sh   # extra env on the CANDIDATE arm only (NOT in fingerprint)
#   BASE_ENV="K=V"       ./eval_impact.sh   # extra env on the BASELINE arm (IS in the fingerprint => new baseline)
#
# SWEEP: each <pt> is one arg of comma-separated KEY=VAL (e.g. recalibrating the soft anchor
# via a future LR_IMPACT_SOFT flag, or a generation-pressure knob):
#   ./eval_impact.sh sweep LR_FOO=0.1 LR_FOO=0.2
# The frozen baseline is reused across all points (candidate env is NOT in the fingerprint).
#
# Each copied script keeps its OWN baselines under generated/<script-name>/, so copies never collide.
#
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# ============================================================================
# CONFIG — the only block you edit. Everything below it is plumbing.
# ============================================================================

# IMPACT board. 13 specs spanning impact bands x density x speed + elev/amp guards. Drums are
# pathologically seed-variant — decide on the full 9-seed board. Names verified in golden_suite.ts.
SPECS="${SPECS:-drums_crescendo,drums_dropout,dense_sprint,solo_run,grain_staircase,rhythm_ladder,syncopated_switchback,cold_start,summit_push,float_bounds,rolling_drop,dense_echo_climb,leap_cadence}"
BUDGETS="${BUDGETS:-150000,300000}"                        # two budgets = fast iteration
SEEDS="${SEEDS:-0,1,2,3,4,5,6,7,8}"                        # 9 seeds
JOBS="${JOBS:-48}"                                         # parallelism only — NOT in the fingerprint

# --- env shared by BOTH arms. Planning OFF so it can't confound impact experiments. ---
COMMON_ENV=( LR_ENGINE=wasm LR_FWD_EVAL=greedy:2 LR_PLAN_LOOP=0 )

# --- the two arms. FROZEN-SNAPSHOT default: identical arms => baseline freezes the current
#     new-metric/planning-off compiler, candidate is current code. A/B a CODE change by editing
#     the production default and rerunning. For a flag sweep, leave BASELINE_ENV clean.
BASELINE_ENV=( )      # what you compare AGAINST  (empty => current defaults / clean)
CANDIDATE_ENV=( )     # what you are testing      (empty => current defaults)

BASELINE_LABEL="${BASELINE_LABEL:-baseline}"
CANDIDATE_LABEL="${CANDIDATE_LABEL:-candidate}"

# --- env injected from the environment WITHOUT editing this file (space-separated KEY=VAL).
#     CAND_ENV -> candidate arm only (not in fingerprint). BASE_ENV -> baseline arm (IS in the
#     fingerprint => builds a distinct frozen baseline). ---
if [[ -n "${BASE_ENV:-}" ]]; then read -ra _BASE_EXTRA <<< "$BASE_ENV"; BASELINE_ENV+=( "${_BASE_EXTRA[@]}" ); fi
if [[ -n "${CAND_ENV:-}" ]]; then read -ra _CAND_EXTRA <<< "$CAND_ENV"; CANDIDATE_ENV+=( "${_CAND_EXTRA[@]}" ); fi

# ============================================================================
# PLUMBING — you should not need to touch anything past here.
# ============================================================================

SELF="$(basename "$0" .sh)"
OUTROOT="generated/$SELF"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUTROOT"

baseline_fingerprint () {
  {
    printf 'specs=%s\n'   "$SPECS"
    printf 'budgets=%s\n' "$BUDGETS"
    printf 'seeds=%s\n'   "$SEEDS"
    printf 'env=%s\n' "${COMMON_ENV[@]}" "${BASELINE_ENV[@]}"
  } | LC_ALL=C sort | sha1sum | cut -c1-12
}
HASH="$(baseline_fingerprint)"
BASELINE_DIR="$OUTROOT/baseline-$HASH"
BASELINE_JSON="$BASELINE_DIR/golden.json"
BASELINE_META="$BASELINE_DIR/eval.meta.json"
CAND_DIR="$OUTROOT/cand-$STAMP"
CAND_JSON="$CAND_DIR/golden.json"

run_golden () {
  local dir="$1"; shift
  local -a arm=( "$@" )
  local -a specflag=()
  [[ -n "$SPECS" ]] && specflag=( "--specs=$SPECS" )
  env "${COMMON_ENV[@]}" "${arm[@]}" "GOLDEN_SEEDS_OVERRIDE=$SEEDS" \
    npx tsx scripts/v0/golden.ts \
      "${specflag[@]}" "--budgets=$BUDGETS" "--jobs=$JOBS" "--archive-dir=$dir" \
      > "$dir.log" 2>&1
}

write_meta () {
  local dir="$1" role="$2"; shift 2
  python3 - "$dir/eval.meta.json" "$role" "$HASH" "$SPECS" "$BUDGETS" "$SEEDS" "$JOBS" \
    "${COMMON_ENV[*]}" "$*" "$dir" <<'PY'
import json, sys, socket, subprocess, datetime
out, role, h, specs, budgets, seeds, jobs, common, arm, archive = sys.argv[1:11]
def sh(*c):
    try: return subprocess.check_output(c, text=True, stderr=subprocess.DEVNULL).strip()
    except Exception: return None
def ints(s): return [int(x) for x in s.split(",") if x.strip()]
json.dump({
    "role": role, "fingerprint": h,
    "created": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
    "host": socket.gethostname(),
    "git": {"commit": sh("git", "rev-parse", "HEAD"), "branch": sh("git", "rev-parse", "--abbrev-ref", "HEAD"),
            "dirty": bool(sh("git", "status", "--porcelain"))},
    "config": {"specs": specs.split(",") if specs else "ALL", "budgets": ints(budgets), "seeds": ints(seeds), "jobs": int(jobs)},
    "common_env": common.split(), "arm_env": arm.split(), "archive": archive,
}, open(out, "w"), indent=2)
PY
}

show_meta () {
  [[ -f "$1" ]] || { echo "  (no metadata)"; return; }
  python3 - "$1" <<'PY'
import json, sys
m = json.load(open(sys.argv[1])); g = m.get("git", {})
print(f"    built : {m.get('created')}  on {m.get('host')}")
print(f"    git   : {g.get('commit','?')[:12]} ({g.get('branch','?')}){' +dirty' if g.get('dirty') else ''}")
print(f"    specs : {m.get('config',{}).get('specs')}")
print(f"    arm   : {m.get('arm_env') or '(defaults)'}")
PY
}

print_config () {
  echo "=== $SELF ==="
  echo "specs=${SPECS:-ALL golden specs}"
  echo "budgets=$BUDGETS  seeds=$SEEDS  jobs=$JOBS  common_env=[${COMMON_ENV[*]}]"
  echo "baseline arm=[${BASELINE_ENV[*]:-defaults}]   candidate arm=[${CANDIDATE_ENV[*]:-defaults}]"
  echo "fingerprint=$HASH  ->  $BASELINE_DIR"
}

ensure_baseline () {
  if [[ -f "$BASELINE_JSON" ]]; then
    echo ">> baseline ($BASELINE_LABEL): REUSING $BASELINE_DIR"
  else
    echo ">> baseline ($BASELINE_LABEL): not found for fingerprint $HASH — building ONCE ..."
    run_golden "$BASELINE_DIR" "${BASELINE_ENV[@]}"
    [[ -f "$BASELINE_JSON" ]] || { echo "ERROR: baseline produced no golden.json (see $BASELINE_DIR.log)"; exit 1; }
    write_meta "$BASELINE_DIR" baseline "${BASELINE_ENV[@]}"
    echo ">> baseline ($BASELINE_LABEL): built."
  fi
}

report () {
  local CJ="$1" CD="$2" CLABEL="$3"
  echo "=== decide: $CLABEL (candidate) vs $BASELINE_LABEL (baseline) ==="
  npx tsx scripts/v0/analyze_golden_curve.ts decide "$CJ" "$BASELINE_JSON" || true
  echo
  echo "============================================================"
  echo "  baseline ($BASELINE_LABEL) : $BASELINE_DIR"
  echo "  candidate($CLABEL): $CD"
  echo "  logs                       : $BASELINE_DIR.log  |  $CD.log"
  echo "------------------------------------------------------------"
  python3 - "$CJ" "$BASELINE_JSON" "$CLABEL" "$BASELINE_LABEL" <<'PY'
import json, sys
cand = json.load(open(sys.argv[1])); base = json.load(open(sys.argv[2]))
CL, BL = sys.argv[3][:8], sys.argv[4][:8]
budgets = sorted({cp["budget"] for r in cand.get("rows", []) for cp in r.get("checkpoints", [])})
specs   = sorted({r.get("name") for r in cand.get("rows", [])})
def cells(d):
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
    print(f"  HEADLINE (budget-weighted)   {CL:>8} {ch:7.2f}   {BL:>8} {bh:7.2f}   Δ {ch-bh:+.2f}")
print()
print("  per-budget (mean over specs):")
print(f"    {'budget':>6} {CL:>8} {BL:>8} {'Δ':>8}")
for b in budgets:
    cs = sum(m(cc, (sp, b)) for sp in specs) / len(specs)
    bs = sum(m(bc, (sp, b)) for sp in specs) / len(specs)
    print(f"    {fb(b):>6} {cs:8.1f} {bs:8.1f} {cs-bs:+8.1f}")
print()
print("  per-track x budget   (valid = cand,base pass-rate):")
print(f"    {'spec':16s} {'budget':>6} {CL:>8} {BL:>8} {'Δ':>8}   valid")
for sp in specs:
    for b in budgets:
        c, f = cc.get((sp, b)), bc.get((sp, b))
        cm, fm = m(cc, (sp, b)), m(bc, (sp, b))
        cv = f"{c[1]}/{c[2]}" if c else "-"; fv = f"{f[1]}/{f[2]}" if f else "-"
        print(f"    {sp:16s} {fb(b):>6} {cm:8.1f} {fm:8.1f} {cm-fm:+8.1f}   {cv},{fv}")
PY
  echo "============================================================"
  echo
  echo "=== per-axis & factor diagnostics (true-scorer; NOT apples-to-apples) ==="
  python3 - "$CJ" "$BASELINE_JSON" "$CLABEL" "$BASELINE_LABEL" <<'PY'
import json, sys, os
from collections import defaultdict
CL, BL = sys.argv[3][:8], sys.argv[4][:8]
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
    print(f"    factors {CL}/{BL} :  drift {c.get('drift',0)}/{b.get('drift',0)}"
          f"   off_beat {c.get('off_beat',0)}/{b.get('off_beat',0)}"
          f"   missing {c.get('missing',0)}/{b.get('missing',0)}"
          f"   deaths {c.get('deaths',0)}/{b.get('deaths',0)}")
    ca, ba = c.get("axis", {}), b.get("axis", {})
    def mae(a, ax): v = a.get(ax); return (v[0] / v[1]) if v and v[1] else 0.0
    cells = "  ".join(f"{ax} {mae(ca,ax)-mae(ba,ax):+.3f}" for ax in sorted(set(ca) | set(ba)))
    print(f"    mean|err| {CL}-{BL}:  {cells}")
PY
  echo "============================================================"
}

VERB="${1:-run}"
print_config
echo

case "$VERB" in
  info)
    echo ">> baseline status:"
    if [[ -f "$BASELINE_JSON" ]]; then echo "  EXISTS: $BASELINE_DIR"; show_meta "$BASELINE_META"
    else echo "  MISSING — first run will build it."; fi
    exit 0
    ;;
  rebuild)
    echo ">> rebuild: removing baseline for fingerprint $HASH"
    rm -rf "$BASELINE_DIR" "$BASELINE_DIR.log"
    ;;
  run) ;;
  sweep) ;;
  *) echo "usage: $0 [run|rebuild|info|sweep <pt1> [pt2 ...]]"; exit 2 ;;
esac

ensure_baseline

if [[ "$VERB" == "sweep" ]]; then
  shift
  [[ $# -ge 1 ]] || { echo "usage: $0 sweep <pt1> [pt2 ...]   (pt = comma-separated KEY=VAL)"; exit 2; }
  pt_i=0
  for pt in "$@"; do
    pt_i=$((pt_i + 1))
    IFS=',' read -ra pt_env <<< "$pt"
    d="$OUTROOT/sweep-$STAMP-$pt_i"
    echo
    echo ">> sweep point $pt_i: candidate arm += [${pt_env[*]}]  ->  $d"
    run_golden "$d" "${CANDIDATE_ENV[@]}" "${pt_env[@]}"
    [[ -f "$d/golden.json" ]] || { echo "ERROR: sweep point $pt_i produced no golden.json (see $d.log)"; continue; }
    write_meta "$d" candidate "${CANDIDATE_ENV[@]}" "${pt_env[@]}"
    report "$d/golden.json" "$d" "$pt"
  done
  exit 0
fi

echo ">> candidate ($CANDIDATE_LABEL): running at $CAND_DIR ..."
run_golden "$CAND_DIR" "${CANDIDATE_ENV[@]}"
[[ -f "$CAND_JSON" ]] || { echo "ERROR: candidate produced no golden.json (see $CAND_DIR.log)"; exit 1; }
write_meta "$CAND_DIR" candidate "${CANDIDATE_ENV[@]}"
echo ">> candidate ($CANDIDATE_LABEL): done."
echo

report "$CAND_JSON" "$CAND_DIR" "$CANDIDATE_LABEL"
