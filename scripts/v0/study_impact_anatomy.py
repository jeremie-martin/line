#!/usr/bin/env python3
"""Impact error anatomy + counterfactual headlines from a stored golden archive.

Post-processing only (no compiles). For every checkpoint report:
  - per-gap impact target/achieved/error/ceiling
  - feasibility split: how much impact error is target>ceiling (physically
    unreachable at the achieved arrival speed) vs addressable
Counterfactual headlines (score' = score * aq'/aq, aq = exp(-rms/0.25)):
  - actual (self-check vs stored headline)
  - clamped: impact error measured against min(target, ceiling)
  - weighted: impact error scaled by w in the axis RMS
  - perfect: impact error zeroed (= the known "excl. impact" number)

usage: python3 scripts/v0/study_impact_anatomy.py generated/golden-runs/impact-curve-canon-on/golden.json
"""
import json
import math
import sys
from collections import defaultdict

AXIS_TOL = 0.25

golden = json.load(open(sys.argv[1]))
weights = {w["budget"]: w["weight"] for w in golden["headline"]["weight_by_budget"]}
budgets = golden["headline"]["budgets"]


def shifted_geomean(values, shift=1.0):
    if not values:
        return 0.0
    s = sum(math.log(max(0.0, v) + shift) for v in values) / len(values)
    return math.exp(s) - shift


def axis_entries(report):
    """All (axis, target, achieved, error, ceiling) entries across gaps."""
    out = []
    for gap in report.get("gaps", []):
        for axis, v in (gap.get("axes") or {}).items():
            out.append((axis, v.get("target"), v.get("achieved"), v.get("error"), v.get("ceiling")))
    return out


def rms(errors):
    if not errors:
        return 0.0
    return math.sqrt(sum(e * e for e in errors) / len(errors))


def rescore(score, entries, impact_err_fn):
    errs = [e[3] for e in entries]
    aq = math.exp(-rms(errs) / AXIS_TOL)
    errs2 = [impact_err_fn(e) if e[0] == "impact" else e[3] for e in entries]
    aq2 = math.exp(-rms(errs2) / AXIS_TOL)
    return score * (aq2 / aq) if aq > 0 else score


VARIANTS = {
    "actual": lambda e: e[3],
    "clamped": lambda e: abs(min(e[1], e[4] if e[4] is not None else e[1]) - e[2]),
    "w075": lambda e: 0.75 * e[3],
    "w050": lambda e: 0.5 * e[3],
    "w025": lambda e: 0.25 * e[3],
    "clamp_w050": lambda e: 0.5 * abs(min(e[1], e[4] if e[4] is not None else e[1]) - e[2]),
    "perfect": lambda e: 0.0,
}

# (variant, budget) -> spec -> [per-seed scores]
per_spec = {v: defaultdict(lambda: defaultdict(list)) for v in VARIANTS}
# anatomy accumulators (300k only)
impact_rows = []

for row in golden["rows"]:
    spec = f"{row['name']}/{row.get('variant', 'base')}"
    for cp in row.get("checkpoints", []):
        b = cp["budget"]
        score = cp.get("score") or 0.0
        try:
            report = json.load(open(cp["report_path"]))
            entries = axis_entries(report)
        except Exception:
            entries = []
        for vname, fn in VARIANTS.items():
            s2 = rescore(score, entries, fn) if entries else score
            per_spec[vname][b][spec].append(s2)
        if b == 300000:
            for e in entries:
                if e[0] == "impact" and e[1] is not None and e[3] is not None:
                    impact_rows.append({"spec": spec, "target": e[1], "achieved": e[2],
                                        "error": e[3], "ceiling": e[4]})

print(f"=== counterfactual headlines ({sys.argv[1]}) ===")
for vname in VARIANTS:
    headline = 0.0
    per_budget = {}
    for b in budgets:
        spec_scores = [shifted_geomean(seeds) for seeds in per_spec[vname][b].values()]
        per_budget[b] = shifted_geomean(spec_scores)
        headline += weights[b] * per_budget[b]
    pb = "  ".join(f"{b // 1000}k:{per_budget[b]:.1f}" for b in budgets)
    print(f"  {vname:12s} headline {headline:7.2f}   ({pb})")

print(f"\n=== impact error anatomy @300k ({len(impact_rows)} impact-authored gaps) ===")
infeasible = [r for r in impact_rows if r["ceiling"] is not None and r["target"] > r["ceiling"] + 1e-9]
print(f"  infeasible (target > ceiling at achieved arrival speed): {len(infeasible)}"
      f" ({100 * len(infeasible) / max(1, len(impact_rows)):.1f}%)")
sq_total = sum(r["error"] ** 2 for r in impact_rows)
sq_clamped = sum(abs(min(r["target"], r["ceiling"] if r["ceiling"] is not None else r["target"]) - r["achieved"]) ** 2
                 for r in impact_rows)
print(f"  impact squared-error: total {sq_total:.1f} -> clamped-to-ceiling {sq_clamped:.1f}"
      f" ({100 * (1 - sq_clamped / max(1e-9, sq_total)):.1f}% of sq-error is above-ceiling)")

def band(lo, hi):
    rows = [r for r in impact_rows if lo <= r["target"] < hi]
    if not rows:
        return
    me = sum(r["error"] for r in rows) / len(rows)
    ma = sum(r["achieved"] for r in rows) / len(rows)
    inf = sum(1 for r in rows if r["ceiling"] is not None and r["target"] > r["ceiling"] + 1e-9)
    print(f"    target [{lo:.2f},{hi:.2f}): n {len(rows):5d}  mean-achieved {ma:.3f}"
          f"  mean-|err| {me:.3f}  infeasible {100 * inf / len(rows):4.1f}%")

print("  by target band:")
for lo, hi in [(0, 0.35), (0.35, 0.55), (0.55, 0.75), (0.75, 1.01)]:
    band(lo, hi)

# worst specs by impact mean |err|
by_spec = defaultdict(list)
for r in impact_rows:
    by_spec[r["spec"]].append(r["error"])
worst = sorted(by_spec.items(), key=lambda kv: -sum(kv[1]) / len(kv[1]))[:10]
print("  worst specs by mean impact |err| @300k:")
for spec, errs in worst:
    print(f"    {spec:36s} n {len(errs):4d}  mean {sum(errs) / len(errs):.3f}")
