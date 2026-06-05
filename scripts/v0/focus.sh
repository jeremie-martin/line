#!/usr/bin/env bash
# Fragile-spec focus loop runner.
#
# Optimizes the 5 historically-shaky specs on FRESH seeds (200-219, never used
# during the headline campaign — anti-overfit) over the 60k..120k curve window,
# with the current default compiler.
#
#   scripts/v0/focus.sh <label>   # writes generated/focus-runs/<label>/golden.json
#   node scripts/v0/focus_report.mjs generated/focus-runs/<label>/golden.json
#
# See FOCUS_FRAGILE_SPECS.md for the working method.
set -euo pipefail

LABEL="${1:?usage: focus.sh <label>}"
SPECS="${FOCUS_SPECS:-opening_burst,drums_breath,solo_run,cold_start,syncopated_switchback}"
# 20 FRESH optimization seeds (200-219) + 3 known-hard cross-check seeds
# (100-102). The report scores the primary metric on 200-219 only and reports
# 100-102 separately as a generalization check (never tuned against directly).
SEEDS="${FOCUS_SEEDS:-200,201,202,203,204,205,206,207,208,209,210,211,212,213,214,215,216,217,218,219,100,101,102}"
BUDGETS="${FOCUS_BUDGETS:-60000,65000,70000,75000,80000,85000,90000,95000,100000,105000,110000,115000,120000}"
JOBS="${FOCUS_JOBS:-6}"
OUT="generated/focus-runs/${LABEL}"

LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE="$SEEDS" \
  npx tsx scripts/v0/golden.ts --json --details \
  --specs="$SPECS" --budgets="$BUDGETS" --jobs="$JOBS" \
  --archive-dir="$OUT"

echo ""
node scripts/v0/focus_report.mjs "$OUT/golden.json"
