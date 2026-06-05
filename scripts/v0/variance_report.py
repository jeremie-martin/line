#!/usr/bin/env python3
"""variance_report - seed-noise / statistical-adequacy report for the golden benchmark.

Reads one or two golden.json archives and reports the empirical noise model that the
decision methodology rests on:

  - within-spec seed variance, split into validity-bistability vs quality-jitter-among-valid
    (the score is bimodal: a failed compile collapses to ~0, so raw SD mostly measures how
     OFTEN a spec fails, not how much a valid track's quality varies)
  - noise floor of the suite metric M vs number of seeds (analytic + empirical subsampling)
  - where the documented triples {100,101,102} and {20,21,22} fall vs the population
    (holdout representativeness)
  - PAIRED delta analysis when a candidate archive is given: because the same seeds are used
    for both configs, common-mode seed-luck cancels and the delta is ~10x tighter than the
    absolute metric. The paired bootstrap CI is the real decision threshold.

Produce the inputs with e.g.:
  GOLDEN_SEEDS_OVERRIDE=0,1,2,...,11,20,21,22,100,101,102 \\
    LR_ENGINE=wasm npx tsx scripts/v0/golden.ts --budgets=50000,75000,100000,125000,150000 \\
    --jobs=6 --archive-dir=generated/golden-runs/_base
  (set LR_ARC_PLACEMENT=continuous for the candidate)

Usage:
  python3 scripts/v0/variance_report.py BASE.json [CANDIDATE.json] [--budget=150000]
"""
import json
import sys
import itertools
import random
import statistics as st
from math import sqrt

POP_SEEDS = list(range(12))  # clean contiguous population for variance estimation
TRIPLES = {"canonical(100-102)": [100, 101, 102], "holdout(20-22)": [20, 21, 22]}
SUBSAMPLE_CAP = 1500
random.seed(0)


def load(path):
    """Return cells[budget][spec][seed] = (score: float, valid: bool)."""
    d = json.load(open(path))
    out = {}
    for r in d["rows"]:
        for ck in r["checkpoints"]:
            score = float(ck.get("score") or 0.0)
            valid = bool(ck.get("contract_passed"))
            out.setdefault(ck["budget"], {}).setdefault(r["name"], {})[r["seed"]] = (score, valid)
    return out


def suite_M(cb, specs, seeds, valid_only=False):
    """Suite metric at one budget: mean-over-seeds then mean-over-specs."""
    per_spec = []
    for sp in specs:
        cells = [cb[sp][se] for se in seeds if se in cb.get(sp, {})]
        if valid_only:
            cells = [c for c in cells if c[1]]
        if not cells:
            continue
        per_spec.append(sum(c[0] for c in cells) / len(cells))
    return sum(per_spec) / len(per_spec) if per_spec else float("nan")


def _combos(pop, n):
    combos = list(itertools.combinations(pop, n))
    return random.sample(combos, SUBSAMPLE_CAP) if len(combos) > SUBSAMPLE_CAP else combos


def report_single(cb, budget):
    specs = sorted(cb)
    present = lambda se: all(se in cb[sp] for sp in specs)
    pop = [se for se in POP_SEEDS if present(se)]
    S = len(specs)
    print(f"\n{'='*84}\nBUDGET {budget//1000}k    specs={S}   population seeds={pop}")

    # variance decomposition: validity bistability vs quality jitter among valid
    sd_all, sd_valid, reliable = [], [], []
    print(f"\n  {'spec':<24}{'P(valid)':>9}{'SD_all':>8}{'SD|valid':>9}{'mean|valid':>11}")
    for sp in specs:
        vals = [cb[sp][se] for se in pop]
        sc = [v[0] for v in vals]
        valid = [v[0] for v in vals if v[1]]
        pv = sum(v[1] for v in vals) / len(vals)
        sda = st.pstdev(sc)
        sd_all.append(sda)
        sdv = st.pstdev(valid) if len(valid) >= 2 else float("nan")
        if len(valid) >= 2:
            sd_valid.append(sdv)
        if pv == 1.0:
            reliable.append(sp)
        flag = " <bistable>" if 0 < pv < 1 else (" <always-fail>" if pv == 0 else "")
        print(f"  {sp:<24}{pv:>9.2f}{sda:>8.0f}{(sdv if sdv == sdv else 0):>9.0f}"
              f"{(st.mean(valid) if valid else 0):>11.0f}{flag}")

    pooled_all = sqrt(st.mean([s * s for s in sd_all]))
    pooled_valid = sqrt(st.mean([s * s for s in sd_valid])) if sd_valid else float("nan")
    print(f"\n  pooled sigma_seed  ALL        = {pooled_all:5.1f}   (validity flips + quality jitter)")
    print(f"  pooled sigma_seed  VALID-ONLY  = {pooled_valid:5.1f}   (quality jitter among valid tracks)")
    print(f"  reliable specs (100% valid): {len(reliable)}/{S}")

    # noise floor of M vs #seeds: analytic SE + empirical subsampling SD
    var_terms = [s * s for s in sd_all]
    se_analytic = lambda n: sqrt(sum(var_terms) / (S * S) / n)
    print(f"\n  M (population, n={len(pop)}) = {suite_M(cb, specs, pop):6.1f}")
    print(f"\n  noise floor of suite M vs #seeds:")
    print(f"    {'n':>3}  {'SE analytic':>12}  {'SE subsample':>13}  {'95% half-width':>15}")
    for n in [1, 2, 3, 4, 5, 6, 8, 10, 12]:
        if n > len(pop):
            break
        Ms = [suite_M(cb, specs, list(c)) for c in _combos(pop, n)]
        se_sub = st.pstdev(Ms) if len(Ms) > 1 else 0.0
        print(f"    {n:>3}  {se_analytic(n):>12.2f}  {se_sub:>13.2f}  {1.96*se_sub:>15.2f}")

    # holdout: where do the documented triples land?
    print(f"\n  holdout adequacy (absolute M):")
    M3 = sorted(suite_M(cb, specs, list(c)) for c in itertools.combinations(pop, 3))
    pct = lambda x: 100.0 * sum(1 for m in M3 if m <= x) / len(M3)
    print(f"    random 3-seed M: min={M3[0]:.1f} med={M3[len(M3)//2]:.1f} max={M3[-1]:.1f}")
    for name, tri in TRIPLES.items():
        if all(present(s) for s in tri):
            m = suite_M(cb, specs, tri)
            nval = sum(1 for sp in specs for se in tri if cb[sp][se][1])
            print(f"    {name:<20} M={m:6.1f}  (~{pct(m):3.0f}th pct)  valid {nval}/{S*3}")


def report_paired(base, cand, budget):
    bb, cc = base[budget], cand[budget]
    specs = sorted(set(bb) & set(cc))
    present = lambda se: all(se in bb[sp] and se in cc[sp] for sp in specs)
    pop = [se for se in POP_SEEDS if present(se)]
    print(f"\n{'#'*84}\nPAIRED DELTA (candidate - base) @ {budget//1000}k   specs={len(specs)}  pop={pop}")
    full = suite_M(cc, specs, pop) - suite_M(bb, specs, pop)
    print(f"  full-population mean delta (n={len(pop)}) = {full:+.1f}"
          f"   [base {suite_M(bb, specs, pop):.0f} -> cand {suite_M(cc, specs, pop):.0f}]")
    deltas = sorted(suite_M(cc, specs, list(c)) - suite_M(bb, specs, list(c)) for c in _combos(pop, 3))
    sd = st.pstdev(deltas)
    neg = sum(1 for d in deltas if d <= 0)
    print(f"  measured delta over random 3-seed sets: min={deltas[0]:+.1f} med={deltas[len(deltas)//2]:+.1f}"
          f" max={deltas[-1]:+.1f}")
    print(f"  paired delta SD={sd:.1f}  95%CI-halfwidth={1.96*sd:.1f}  (<=0 in {100*neg/len(deltas):.1f}% of draws)")
    print(f"  => smallest reliably-positive change vs #seeds (paired, ~1/sqrt(n)):")
    for n in (3, 6, 8, 12, 24):
        print(f"       n={n:>3}: ~{1.96*sd*sqrt(3/n):.1f}")
    for name, tri in TRIPLES.items():
        if all(present(s) for s in tri):
            d = suite_M(cc, specs, tri) - suite_M(bb, specs, tri)
            print(f"     triple {name:<20} delta = {d:+.1f}")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    opts = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--") and "=" in a)
    base = load(args[0])
    cand = load(args[1]) if len(args) > 1 else None
    budgets = [int(opts["budget"])] if "budget" in opts else [max(base), 100000, 50000]
    for b in budgets:
        if b in base:
            report_single(base[b], b)
    if cand:
        for b in budgets:
            if b in cand:
                report_paired(base, cand, b)


if __name__ == "__main__":
    main()
