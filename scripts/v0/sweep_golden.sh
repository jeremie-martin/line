#!/usr/bin/env bash
# sweep_golden.sh — run the golden budget-curve suite across a range of commits.
#
# Drives the existing scripts/v0/golden.ts (no compiler/scoring reimplementation)
# inside an isolated detached git worktree, looping over commits oldest->newest.
# Resumable (skips commits whose golden.json is already complete) and crash-tolerant
# (one bad commit logs and continues). The dirty main working tree is never touched.
#
# Usage:
#   scripts/v0/sweep_golden.sh              # full sweep (with go/no-go reminder)
#   CALIBRATE=1 scripts/v0/sweep_golden.sh  # one-spec calibration, then stop
#
# Overridable env (defaults below):
#   FROM_COMMIT BRANCH BUDGETS SEEDS JOBS SPECS KEEP_CHECKPOINTS ARCHIVE_ROOT WT CALIBRATE
set -euo pipefail

# ---- config -----------------------------------------------------------------
MAIN="${MAIN:-/home/jmartin/line}"
FROM_COMMIT="${FROM_COMMIT:-646b0da}"
BRANCH="${BRANCH:-reach-handoff-wyss}"
BUDGETS="${BUDGETS:-25000,50000,100000,150000,200000}"   # canonical grid (each an independent run)
SEEDS="${SEEDS:-$(seq -s, 10 1 19)}"                # seeds 10..19

default_jobs() {
  local cpus
  if command -v nproc >/dev/null 2>&1; then
    cpus="$(nproc)"
  elif command -v getconf >/dev/null 2>&1; then
    cpus="$(getconf _NPROCESSORS_ONLN 2>/dev/null || printf '1')"
  elif command -v sysctl >/dev/null 2>&1; then
    cpus="$(sysctl -n hw.ncpu 2>/dev/null || printf '1')"
  else
    cpus=1
  fi
  [[ "$cpus" =~ ^[0-9]+$ ]] || cpus=1
  local jobs=$(( cpus / 2 ))
  (( jobs >= 1 )) || jobs=1
  printf '%s\n' "$jobs"
}

JOBS="${JOBS:-$(default_jobs)}"
SPECS="${SPECS:-}"                                  # empty = all 20 headline specs
KEEP_CHECKPOINTS="${KEEP_CHECKPOINTS:-0}"
SKIP_NN="${SKIP_NN:-}"                              # space-separated NN indices to skip (non-functional commits)
ARCHIVE_ROOT="${ARCHIVE_ROOT:-$MAIN/generated/golden-runs}"
WT="${WT:-/home/jmartin/line-sweep-wt}"
CALIBRATE="${CALIBRATE:-0}"
LOGDIR="$ARCHIVE_ROOT/_sweep_logs"
TSX="$MAIN/node_modules/tsx/dist/cli.mjs"

# derived expectations for the completeness validator
EXPECT_BUDGET_COUNT="$(echo "$BUDGETS" | tr ',' '\n' | grep -c .)"
EXPECT_SEEDS="$SEEDS"

log() { printf '[sweep %(%H:%M:%S)T] %s\n' -1 "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

# ---- preflight (touch nothing) ---------------------------------------------
preflight() {
  log "preflight"
  [ -d "$MAIN/.git" ] || die "main repo not found at $MAIN"
  [ -f "$TSX" ] || die "tsx not found at $TSX (run npm install in $MAIN)"
  local cur; cur="$(git -C "$MAIN" rev-parse --abbrev-ref HEAD)"
  [ "$cur" = "$BRANCH" ] || log "note: main HEAD is '$cur', expected '$BRANCH' (continuing; sweep targets $BRANCH)"
  git -C "$MAIN" rev-parse -q --verify "$FROM_COMMIT^{commit}" >/dev/null || die "bad FROM_COMMIT $FROM_COMMIT"
  git -C "$MAIN" rev-parse -q --verify "$BRANCH^{commit}" >/dev/null || die "bad BRANCH $BRANCH"
  local n; n="$(git -C "$MAIN" rev-list --count "${FROM_COMMIT}^..${BRANCH}")"
  log "commit count ${FROM_COMMIT}^..${BRANCH} = $n"
  local freeg; freeg="$(df -BG --output=avail "$ARCHIVE_ROOT" 2>/dev/null | tail -1 | tr -dc '0-9' || echo 0)"
  [ "${freeg:-0}" -ge 10 ] 2>/dev/null || log "note: low disk (${freeg}G free)"
  mkdir -p "$ARCHIVE_ROOT" "$LOGDIR"
  log "budgets=$EXPECT_BUDGET_COUNT pts  seeds=$SEEDS  jobs=$JOBS  archive=$ARCHIVE_ROOT"
}

# ---- worktree lifecycle -----------------------------------------------------
ensure_worktree() {
  if [ ! -d "$WT/.git" ] && [ ! -f "$WT/.git" ]; then
    log "creating detached worktree at $WT ($FROM_COMMIT)"
    git -C "$MAIN" worktree add --detach "$WT" "$FROM_COMMIT" >/dev/null
  fi
  if [ ! -e "$WT/node_modules" ]; then
    ln -s "$MAIN/node_modules" "$WT/node_modules"
    log "symlinked node_modules into worktree"
  fi
  [ -f "$WT/scripts/v0/golden.ts" ] || die "worktree missing golden.ts"
}

teardown_worktree() {
  log "removing worktree"
  rm -f "$WT/node_modules" || true
  git -C "$MAIN" worktree remove --force "$WT" 2>/dev/null || true
  git -C "$MAIN" worktree prune 2>/dev/null || true
}

# ---- seed patch (idempotent, byte-stable target line) -----------------------
apply_seed_patch() {
  node -e '
    const fs = require("fs");
    const p = process.argv[1];
    let s = fs.readFileSync(p, "utf8");
    if (s.includes("GOLDEN_SEEDS_OVERRIDE")) process.exit(0); // already patched
    const orig = "  const seeds = debugSeed !== null ? [debugSeed] : [...GOLDEN_SEEDS];";
    if (!s.includes(orig)) { console.error("seed line not found in golden.ts"); process.exit(3); }
    const repl = "  const seeds = process.env.GOLDEN_SEEDS_OVERRIDE ? process.env.GOLDEN_SEEDS_OVERRIDE.split(\",\").map((x) => Math.trunc(Number(x))) : (debugSeed !== null ? [debugSeed] : [...GOLDEN_SEEDS]);";
    fs.writeFileSync(p, s.replace(orig, repl));
  ' "$WT/scripts/v0/golden.ts"
  grep -q GOLDEN_SEEDS_OVERRIDE "$WT/scripts/v0/golden.ts" || die "seed patch failed to apply"
}

# ---- golden.json completeness validator -------------------------------------
# exit 0 = complete; nonzero = missing/partial. Prints headline.score on success.
validate_json() {
  node -e '
    const fs = require("fs");
    const [p, nBudget, seedCsv, nSpecs] = process.argv.slice(1);
    let j; try { j = JSON.parse(fs.readFileSync(p, "utf8")); } catch { console.error("unparseable"); process.exit(2); }
    const wantSeeds = seedCsv.split(",").map(Number);
    const eq = (a, b) => Array.isArray(a) && a.length === b.length && a.every((v, i) => v === b[i]);
    if (!Array.isArray(j.budgets) || j.budgets.length !== Number(nBudget)) { console.error("budget count "+(j.budgets||[]).length); process.exit(3); }
    if (!eq(j.scope && j.scope.seeds, wantSeeds)) { console.error("seeds mismatch "+JSON.stringify(j.scope&&j.scope.seeds)); process.exit(4); }
    const rows = Array.isArray(j.rows) ? j.rows : [];
    const expRows = Number(nSpecs) * wantSeeds.length;
    if (rows.length !== expRows) { console.error("row count "+rows.length+" != "+expRows); process.exit(5); }
    for (const r of rows) if (!Array.isArray(r.checkpoints) || r.checkpoints.length !== Number(nBudget)) { console.error("row "+r.name+" seed "+r.seed+" checkpoints "+(r.checkpoints||[]).length); process.exit(6); }
    process.stdout.write(String(j.headline.score));
  ' "$1" "$EXPECT_BUDGET_COUNT" "$EXPECT_SEEDS" "${2:-20}"
}

# ---- strip dangling artifact refs (after checkpoints/ deletion) -------------
strip_json() {
  node -e '
    const fs = require("fs");
    const p = process.argv[1];
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    for (const r of (j.rows || [])) for (const c of (r.checkpoints || [])) {
      delete c.track_path; delete c.report_path; delete c.track_hash;
    }
    fs.writeFileSync(p, JSON.stringify(j) + "\n");
  ' "$1"
}

# ---- run golden for one checked-out commit ---------------------------------
# args: <archive-dir> <log-file> <expected-spec-count> [extra golden flags...]
run_golden() {
  local archive="$1" logf="$2" nspecs="$3"; shift 3
  local specflag=""; [ -n "$SPECS" ] && specflag="--specs=$SPECS"
  ( cd "$WT" && GOLDEN_SEEDS_OVERRIDE="$SEEDS" \
      /usr/bin/time -v node "$TSX" scripts/v0/golden.ts \
        --budgets="$BUDGETS" --jobs="$JOBS" --archive-dir="$archive" $specflag "$@" \
  ) >"$logf" 2>&1
}

# ---- calibration ------------------------------------------------------------
calibrate() {
  local spec="${SPECS:-tiny_dance}"
  local ncs; ncs="$(echo "$spec" | tr ',' '\n' | grep -c .)"          # specs in probe
  local nseeds; nseeds="$(echo "$SEEDS" | tr ',' '\n' | grep -c .)"   # seeds in probe
  local archive="$ARCHIVE_ROOT/_calib" logf="$LOGDIR/_calib.log"
  rm -rf "$archive"
  log "calibration: specs=$spec ($ncs)  budgets=$EXPECT_BUDGET_COUNT  seeds=$SEEDS ($nseeds)  jobs=$JOBS"
  git -C "$WT" checkout --force --detach "$FROM_COMMIT" >/dev/null 2>&1 || die "calib checkout failed"
  apply_seed_patch
  local t0; t0=$SECONDS
  SPECS="$spec" run_golden "$archive" "$logf" "$ncs" || { log "calibration RUN FAILED — see $logf"; tail -20 "$logf"; exit 1; }
  local dt=$((SECONDS - t0))
  local cs; cs="$(validate_json "$archive/golden.json" "$ncs")" || { log "calibration json INVALID — see $logf"; exit 1; }
  local maxrss; maxrss="$(grep -i 'Maximum resident set size' "$logf" | grep -oE '[0-9]+' | tail -1)"
  local rssg; rssg="$(awk "BEGIN{printf \"%.1f\", ${maxrss:-0}/1048576}")"
  local jsz; jsz="$(du -h "$archive/golden.json" | cut -f1)"
  local bytes; bytes="$(stat -c%s "$archive/golden.json")"
  local nchk; nchk="$(node -e 'const j=require(process.argv[1]);console.log(j.rows.reduce((a,r)=>a+r.checkpoints.length,0))' "$archive/golden.json")"
  # per-commit scales the probe up to all 20 headline specs (seeds/budgets already at target)
  local per_commit_s=$(( dt * 20 / ncs ))
  echo
  echo "================ CALIBRATION RESULT ================"
  echo "  probe              : $ncs spec(s) x $nseeds seeds x $EXPECT_BUDGET_COUNT budgets = $((ncs*nseeds)) rows"
  echo "  max budget         : $(echo "$BUDGETS" | tr ',' '\n' | tail -1)"
  echo "  wall-clock         : ${dt}s  at jobs=$JOBS"
  echo "  peak process RSS   : ${rssg} GB  (cap is ${JOBS}x3GB; RAM=30GB)"
  echo "  golden.json size   : $jsz  (stripped, $ncs specs)"
  echo "  checkpoints        : $nchk  (expect $((EXPECT_BUDGET_COUNT*ncs*nseeds)))"
  echo "  headline           : $cs"
  echo "  ---- extrapolation to all 20 headline specs ----"
  echo "  per-commit (20 specs)  : ~${per_commit_s}s  (~$((per_commit_s/60)) min)"
  echo "  full sweep (20 commits): ~$((per_commit_s*20/3600))h  (rough; specs vary in cost)"
  echo "  est. golden.json/commit: ~$(node -e "console.log(($bytes*20/$ncs/1048576).toFixed(0))") MB  x20 = ~$(node -e "console.log(($bytes*20/$ncs*20/1073741824).toFixed(1))") GB kept"
  echo "==================================================="
  echo "If peak RSS approaches RAM, re-run with JOBS lowered."
  echo "Calibration complete. Stopping before the full sweep (per plan)."
}

# ---- full sweep -------------------------------------------------------------
sweep() {
  mapfile -t HASHES < <(git -C "$MAIN" log --reverse --format=%H "${FROM_COMMIT}^..${BRANCH}")
  local total="${#HASHES[@]}"
  local -A SKIP=(); local s; for s in $SKIP_NN; do SKIP["$s"]=1; done
  log "sweeping $total commits (skipping: ${SKIP_NN:-none})"
  local i
  for ((i=0; i<total; i++)); do
    local nn; nn="$(printf '%02d' "$i")"
    local hash="${HASHES[$i]}"
    local short; short="$(git -C "$MAIN" rev-parse --short=12 "$hash")"
    local archive="$ARCHIVE_ROOT/sweep_${nn}_${short}"
    local logf="$LOGDIR/commit_${nn}_${short}.log"

    if [ -n "${SKIP[$nn]:-}" ]; then
      log "[$nn/$((total-1))] $short  SKIP (non-functional: docs/diagnostics/oracle)"
      continue
    fi

    if [ -f "$archive/golden.json" ] && validate_json "$archive/golden.json" 20 >/dev/null 2>&1; then
      log "[$nn/$((total-1))] $short  SKIP (already complete)"
      continue
    fi

    log "[$nn/$((total-1))] $short  checkout + run"
    git -C "$WT" checkout --force --detach "$hash" >/dev/null 2>&1 || { log "  checkout failed; skipping"; continue; }
    apply_seed_patch || { log "  patch failed; skipping"; continue; }
    rm -rf "$archive"
    local t0; t0=$SECONDS
    if ! run_golden "$archive" "$logf" 20; then
      log "  RUN FAILED — see $logf (continuing)"; tail -5 "$logf" | sed 's/^/    /'
      continue
    fi
    local dt=$((SECONDS - t0))
    local cs; if ! cs="$(validate_json "$archive/golden.json" 20)"; then
      log "  JSON INVALID — see $logf (left for inspection)"; continue
    fi
    [ "$KEEP_CHECKPOINTS" = "1" ] || rm -rf "$archive/checkpoints"
    strip_json "$archive/golden.json"
    local jsz; jsz="$(du -h "$archive/golden.json" | cut -f1)"
    log "  done headline=$cs  ${dt}s  json=$jsz"
  done

  echo
  echo "================ SWEEP SUMMARY ===================="
  printf '  %-4s %-13s %-12s %s\n' NN commit headline size
  for ((i=0; i<total; i++)); do
    local nn; nn="$(printf '%02d' "$i")"
    local short; short="$(git -C "$MAIN" rev-parse --short=12 "${HASHES[$i]}")"
    local archive="$ARCHIVE_ROOT/sweep_${nn}_${short}"
    if [ -n "${SKIP[$nn]:-}" ]; then
      printf '  %-4s %-13s %-12s %s\n' "$nn" "$short" "skipped" "-"
    elif [ -f "$archive/golden.json" ]; then
      local cs; cs="$(node -e 'try{console.log(require(process.argv[1]).headline.score)}catch{console.log("?")}' "$archive/golden.json")"
      local jsz; jsz="$(du -h "$archive/golden.json" | cut -f1)"
      printf '  %-4s %-13s %-12s %s\n' "$nn" "$short" "$cs" "$jsz"
    else
      printf '  %-4s %-13s %-12s %s\n' "$nn" "$short" "MISSING" "-"
    fi
  done
  echo "=================================================="
}

# ---- main -------------------------------------------------------------------
main() {
  preflight
  ensure_worktree
  trap teardown_worktree EXIT
  if [ "$CALIBRATE" = "1" ]; then
    calibrate
  else
    sweep
  fi
}
main "$@"
