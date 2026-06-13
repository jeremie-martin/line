#!/usr/bin/env bash
#
# eval_rollout_ranking.sh — rollout-INTERNAL telemetry: where, how often, and WHY the
# short leaf ranks a pool's top candidate differently than the full leaf.
#
# Runs the compiler in SHADOW mode (LR_FWD_EVAL_LEAF=shadow ranks by the FULL leaf,
# byte-identical to production, while ALSO computing the short leaf value AND the
# per-factor breakdown of every pool candidate's rollout leaf — LR_SHADOW_FACTORS=1,
# handoff.ts, gated/diagnostic). Then reports, per pool:
#   - top-1 agreement and the "real cost" (full value the short pick gives up),
#   - on each disagreement, the FULL-measured factor breakdown of the full winner vs
#     the short winner (what the short pick sacrifices, per factor), and the short
#     leaf's OWN view of its pick (where ballistic vs composed diverges).
# This catches the mis-ranking in the rejected branches, not the committed path.
#
# Usage:  ./scripts/v0/eval_rollout_ranking.sh [SPEC] [BUDGET] [SEEDS]
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

SPEC="${1:-big_air_ramp}"
BUDGET="${2:-200000}"
SEEDS="${3:-0,1,2,3,4,5}"
DIR="generated/short-leaf-eval/rollout-ranking-${SPEC}"

echo "=== rollout-ranking telemetry: ${SPEC} @ ${BUDGET}, seeds ${SEEDS} (shadow + per-factor) ==="
LR_ENGINE=wasm LR_FWD_EVAL=greedy:2 LR_FWD_EVAL_LEAF=shadow LR_SHADOW_FACTORS=1 \
  GOLDEN_SEEDS_OVERRIDE="$SEEDS" \
  npx tsx scripts/v0/golden.ts --specs="$SPEC" --budgets="$BUDGET" --jobs=12 \
    --archive-dir="$DIR" > "$DIR.log" 2>&1
echo "compiled (log: $DIR.log)"

python3 - "$DIR/golden.json" <<'PY'
import json, sys
g = json.load(open(sys.argv[1]))
agg = {}
for r in g.get("rows", []):
    for cp in r.get("checkpoints", []):
        fe = (cp.get("compile_stats") or {}).get("fwd_eval") or {}
        for k, v in fe.items():
            if k.startswith("shadow") and isinstance(v, (int, float)):
                agg[k] = agg.get(k, 0) + v
            elif k.startswith("shadow") and isinstance(v, list):
                agg.setdefault(k, [0]*len(v))
                for i, x in enumerate(v):
                    agg[k][i] += x
pools = agg.get("shadow_pools", 0)
dis = agg.get("shadow_disagree_count", 0)
print(f"\n  pools={pools}  top1_agree={agg.get('shadow_top1_agree',0)} "
      f"({100*agg.get('shadow_top1_agree',0)/max(1,pools):.1f}%)  "
      f"disagree={dis} ({100*dis/max(1,pools):.1f}%)")
rc = agg.get("shadow_real_cost_sum", 0.0)
print(f"  real_cost_sum={rc:.1f}  mean/disagree={rc/max(1,dis):.3f}  "
      f"value-gap hist={agg.get('shadow_real_cost_hist')}")
n = agg.get("shadow_fx_n", 0)
print(f"\n  per-factor on {n} disagreements (FULL-measured leaf factors of each pick):")
print(f"  {'factor':9} {'full-pick':>10} {'short-pick':>10} {'sacrifice':>11}")
for fac, fw, ow in [("axis","fx_fw_axis","fx_ow_axis"),("drift","fx_fw_drift","fx_ow_drift"),
                    ("off_beat","fx_fw_offb","fx_ow_offb"),("missing","fx_fw_miss","fx_ow_miss"),
                    ("survival","fx_fw_surv","fx_ow_surv")]:
    fwm = agg.get(f"shadow_{fw}", 0)/max(1, n); owm = agg.get(f"shadow_{ow}", 0)/max(1, n)
    print(f"  {fac:9} {fwm:>10.4f} {owm:>10.4f} {fwm-owm:>+11.4f}")
print(f"\n  short leaf's OWN view of its pick vs the composed truth (ballistic divergence):")
for fac, sk, fk in [("axis","fx_ows_axis","fx_ow_axis"),("missing","fx_ows_miss","fx_ow_miss"),
                    ("survival","fx_ows_surv","fx_ow_surv")]:
    sm = agg.get(f"shadow_{sk}", 0)/max(1, n); fm = agg.get(f"shadow_{fk}", 0)/max(1, n)
    print(f"     {fac:9} short-view={sm:.4f}  full-truth={fm:.4f}  diff={sm-fm:+.4f}")
print()
print("  READ: sacrifice ~0 on every factor => disagreements are true-value TIES (short does not")
print("        pick worse). Non-zero short-view-vs-truth on a factor => that is the noisy signal the")
print("        short leaf breaks ties with; the deficit is downstream compounding of those tie-breaks.")
PY