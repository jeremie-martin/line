#!/usr/bin/env bash
#
# eval_planning.sh — LONG-TERM PLANNING campaign board (a copy of eval_geometry.sh).
# =============================================================================
#
# Fast iteration harness for a FRESH look at long-term / global planning: reading the
# whole spec to anticipate where carried state (speed first) will be needed, and
# biasing the local machinery to have it there. Starting clean — no inherited design.
#   docs/global-planning.md  — a PRIOR crack at this space that was board-REJECTED.
#                              Read only for what already failed, NOT as the plan.
#
# One command, a frozen baseline you never re-run by hand, a fixed planning-focused
# board, then `decide` + a rich per-track/per-axis summary. This board is the
# campaign's decision instrument: there is no separate canonical gate — modify the
# production default, run, decide.
#
# The board: 4 specs. drums_pendulum, drums_crescendo, solo_run carry the strongest
# impact/air "demand" signal; dense_sprint is a guard so a planning change can't
# quietly regress the staple dense path. x {150k, 300k} x 9 seeds. NOTE: the drums
# specs are pathologically seed-variant — always decide on the full 9-seed board,
# never a few-seed run.ts study (a 6-seed study reversed sign last session). Spec
# names verified in golden_suite.ts.
#
# HOW TO USE
# ----------
#   1.  Copy this file to a task-specific name, e.g.
#           cp scripts/v0/eval_template.sh scripts/v0/eval_my_thing.sh
#   2.  Edit ONLY the CONFIG block below (it's the only thing meant to change).
#   3.  Run it:
#           ./scripts/v0/eval_my_thing.sh           # build baseline if needed, run candidate, decide
#           ./scripts/v0/eval_my_thing.sh rebuild   # force a fresh baseline for the current params, then run
#           ./scripts/v0/eval_my_thing.sh info      # show resolved config + the frozen baseline's provenance, then stop
#
#   Each copied script keeps its OWN baselines under generated/<script-name>/, so
#   copies never collide.
#
# THE ONE IDEA: a fingerprinted, frozen baseline
# ----------------------------------------------
#   The baseline is keyed by a HASH of the params that define it (specs, budgets,
#   seeds, and the baseline arm's env) — NOT by the code. Consequences:
#     * Change a param (seeds/specs/budgets/baseline env) -> hash changes -> the
#       baseline auto-rebuilds for the new params.
#     * Change only your CODE and rerun -> hash unchanged -> the baseline is
#       REUSED. You are now comparing current code against a frozen reference.
#       (This is the "same baseline forever on this machine" property.)
#     * Each distinct param-set caches its own baseline-<hash>/, so flipping specs
#       and back reuses the earlier one instead of rebuilding.
#   `rebuild` force-rebuilds the baseline for the current params; deleting
#   generated/<script-name>/ (or moving to a fresh machine) makes it self-rebuild.
#
# TWO MODES (same machinery — you pick by how you set the two arms below)
# ----------------------------------------------------------------------
#   * FROZEN-SNAPSHOT (the default, and the ONLY mode the planning campaign uses):
#     BASELINE_ENV == CANDIDATE_ENV (both empty). The baseline freezes the code as of
#     its first build; the candidate is your current code. You A/B a CODE change by
#     editing the production default and rerunning — the frozen baseline IS the A/B,
#     so a change is never hidden behind an env flag. Answers "did my edit help?".
#   * A/B ON A FLAG: BASELINE_ENV != CANDIDATE_ENV — only for comparing two
#     env-SELECTABLE modes that already exist (e.g. an engine/leaf switch), never for
#     testing a code change. The planning campaign does not use this mode.
#
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# ============================================================================
# CONFIG — the only block you edit. Everything below it is plumbing.
# ============================================================================

# --- evaluation config (these define the baseline fingerprint, except JOBS) ---
# LONG-TERM PLANNING board. Narrowed to the specs that carry the strongest demand
# signal for the planning idea (impact/drums) plus one dense guard. Drums are
# pathologically seed-variant — decide on the full 9-seed board. Names verified in
# golden_suite.ts GOLDEN_SPECS.
SPECS="${SPECS:-dense_sprint,drums_crescendo,drums_pendulum,solo_run}"
BUDGETS="${BUDGETS:-150000,300000}"                        # two budgets = fast iteration
SEEDS="${SEEDS:-0,1,2,3,4,5,6,7,8}"                        # 9 seeds
JOBS="${JOBS:-48}"                                         # parallelism only — NOT in the fingerprint (machine has 64 cores)

# --- env shared by BOTH arms (engine, forward-eval mode, ...) ---
COMMON_ENV=( LR_ENGINE=wasm LR_FWD_EVAL=greedy:2 )

# --- the two arms. FROZEN-SNAPSHOT default: identical arms => baseline freezes
#     the code, candidate is current code. To do an A/B on a flag instead, make
#     them differ, e.g.:
#         BASELINE_ENV=( LR_FWD_EVAL_LEAF=full )
#         CANDIDATE_ENV=( LR_FWD_EVAL_LEAF=objective )
BASELINE_ENV=( )      # what you compare AGAINST  (empty => current defaults)
CANDIDATE_ENV=( )     # what you are testing      (empty => current defaults)

# Human label shown in the summary, e.g. "full vs short". Cosmetic only.
BASELINE_LABEL="${BASELINE_LABEL:-baseline}"
CANDIDATE_LABEL="${CANDIDATE_LABEL:-candidate}"

# ============================================================================
# PLUMBING — you should not need to touch anything past here.
# ============================================================================

SELF="$(basename "$0" .sh)"
OUTROOT="generated/$SELF"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUTROOT"

# Fingerprint of the baseline-defining params. Sorted so reordering env vars does
# NOT trigger a spurious rebuild. JOBS is excluded (parallelism never changes the
# result). The CODE is excluded on purpose — that's what makes the baseline frozen.
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

# Run one arm into <dir>. Compile spam -> <dir>.log; the archive golden.json
# (what `decide` reads) is written regardless of stdout.
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

# Sidecar metadata: commit, date, host, params, arm — so a frozen baseline always
# tells you what it is and when it was built.
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
    "role": role,
    "fingerprint": h,
    "created": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
    "host": socket.gethostname(),
    "git": {
        "commit": sh("git", "rev-parse", "HEAD"),
        "branch": sh("git", "rev-parse", "--abbrev-ref", "HEAD"),
        "dirty": bool(sh("git", "status", "--porcelain")),
    },
    "config": {
        "specs": specs.split(",") if specs else "ALL",
        "budgets": ints(budgets),
        "seeds": ints(seeds),
        "jobs": int(jobs),
    },
    "common_env": common.split(),
    "arm_env": arm.split(),
    "archive": archive,
}, open(out, "w"), indent=2)
PY
}

show_meta () {  # pretty-print a meta sidecar if it exists
  [[ -f "$1" ]] || { echo "  (no metadata)"; return; }
  python3 - "$1" <<'PY'
import json, sys
m = json.load(open(sys.argv[1]))
g = m.get("git", {})
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

ensure_baseline () {  # build the baseline for the current fingerprint if absent
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

# ---------------- verb dispatch ----------------
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
  *) echo "usage: $0 [run|rebuild|info]"; exit 2 ;;
esac

# 1) baseline (built once per fingerprint, then frozen)
ensure_baseline

# 2) candidate — ALWAYS runs fresh against current code
echo ">> candidate ($CANDIDATE_LABEL): running at $CAND_DIR ..."
run_golden "$CAND_DIR" "${CANDIDATE_ENV[@]}"
[[ -f "$CAND_JSON" ]] || { echo "ERROR: candidate produced no golden.json (see $CAND_DIR.log)"; exit 1; }
write_meta "$CAND_DIR" candidate "${CANDIDATE_ENV[@]}"
echo ">> candidate ($CANDIDATE_LABEL): done."
echo

# 3) decide: candidate vs baseline (may exit non-zero on REJECT — don't abort the summary)
echo "=== decide: $CANDIDATE_LABEL (candidate) vs $BASELINE_LABEL (baseline) ==="
npx tsx scripts/v0/analyze_golden_curve.ts decide "$CAND_JSON" "$BASELINE_JSON" || true
echo

# 4) summary: what was compared, headline + per-budget + per-track means
echo "============================================================"
echo "  baseline ($BASELINE_LABEL) : $BASELINE_DIR"
echo "  candidate($CANDIDATE_LABEL): $CAND_DIR"
echo "  logs                       : $BASELINE_DIR.log  |  $CAND_DIR.log"
echo "------------------------------------------------------------"
python3 - "$CAND_JSON" "$BASELINE_JSON" "$CANDIDATE_LABEL" "$BASELINE_LABEL" <<'PY'
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

# 5) OPTIONAL per-axis & factor diagnostics (true-scorer on the OUTPUT tracks).
#    Delete this block if you don't want it. CAVEAT: candidate and baseline ran
#    DIFFERENT searches, so this shows where the output TRACKS differ, not per-arc
#    scorer error — see eval_arc_apples.ts for the apples-to-apples test.
echo
echo "=== per-axis & factor diagnostics (true-scorer; NOT apples-to-apples) ==="
python3 - "$CAND_JSON" "$BASELINE_JSON" "$CANDIDATE_LABEL" "$BASELINE_LABEL" <<'PY'
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
