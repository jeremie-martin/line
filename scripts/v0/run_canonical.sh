#!/usr/bin/env bash
# run_canonical.sh <archive-name> [baseline-golden-json]
# Runs the CANONICAL golden suite (40 specs × 12 seeds × 125k/250k/375k/500k,
# LR_ENGINE=wasm, --jobs=32) on the CURRENT working-tree compiler, archives to
# generated/golden-runs/<archive-name>, then decides vs the baseline (default =
# the committed baseline of record).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
NAME="${1:?usage: run_canonical.sh <archive-name> [baseline-golden-json]}"
BASE="${2:-generated/golden-runs/attempt-impact-portfolio-current-a01/golden.json}"
ARCH="generated/golden-runs/${NAME}"
echo "== canonical run -> ${ARCH} (baseline ${BASE}) =="
LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir="${ARCH}"
echo "== decide =="
npm run decide -- "${ARCH}/golden.json" "${BASE}"
