# Repair selection study

> Historical result only. This report was generated from the retired
> attempt-era telemetry and an era-pinned repair replay. It is evidence about
> that compiler, not a current V3 mechanics report. Current inputs must use the
> exact V3 schema and frontier repair episodes; surgical repair is a separate
> mechanism.

Phase 2's offline replay study from [`budget-unification-plan.md`](budget-unification-plan.md).
`pickFeasibleWeakGap` (`handoff.ts:4725`) ranks repair anchors by raw axis-SSE under
an affordability cap and calls itself "v1, a proxy for true upstream blame"; the
selection axis has never been evaluated, while
[`repair-roi-study.md`](repair-roi-study.md) measured that 18.6% of 750k compiles
spend their whole repair allocation for exactly zero gain. This study replays
alternative rankings against 3,520 archived compiles (3,482 of them with a repair
phase) and their 9,479 repair attempts, and prices the difference from those
archives' own acceptance and gain distributions. Everything below is produced by
`scripts/v0/study_repair_selection.ts`; nothing is compiled or refitted.

**Headline: no ranking in the plan's list earns a Phase 2 candidate, and the
zero-yield pool is not a target.** Four results, in descending order of how firmly
the archives pin them down.

1. **Ceiling-exclusion is a strict no-op.** Of 320,092 reported gaps across five
   archives, **zero** have their weak axis sitting at its `weakAxisCeiling`, and 48
   carry any irreducible `target − ceiling` residue at all. The replay is bit-exact
   at `+0.000` because the candidate set never changes. This is not a small effect;
   it is the absence of one.
2. **Scorer-weighting is a near-no-op by construction.** The register's
   `axis_quality` pools every axis error into ONE rms, so the marginal value of
   fixing an error is the same constant at every gap and raw axis-SSE is *already*
   the exact scorer-weighted ranking for the comparator that decides acceptance. The
   only divergence from the benchmark's ruler is its weighted-rms-over-per-axis-rms
   form, which on this suite reduces to the twelve sources that author `amplitude`
   at weight 0.1 — measured, not argued: it moves the opening pick on 216 of the 576
   amplitude compiles at N=48 and on **0** of the other 1,536. It prices at
   **−0.001, 90% CI [−0.117, +0.112]** — an order of magnitude below the ROI study's
   0.3-point measurability floor at 750k.
3. **Error-per-estimated-frame is the only policy that moves anything at scale, and
   it loses.** It changes the top-1 pick on 84.9% of compiles and triples the
   attempt count, but where the archives can price it honestly it is negative:
   **−0.913 on the opening decision at 750k** and **−1.436, CI [−2.701, −0.097] at
   150k**, the budget where the ROI study says allocation actually binds. Two
   mechanical facts sit underneath. The compiler's own `costToEnd` goes to ~0 at the
   last gaps of the incumbent path, so an unfloored per-frame ranking is unbounded
   there and degenerates into "always restart from the final gap" — a restart the
   compiler would size `ceiling = now`, run for zero nodes and charge zero frames.
   And the acceptance data says anchor size is the wrong thing to trade: across the
   whole local-budget range at a fixed attempt ordinal, mean gain spans at most
   1.5x, while one step in ordinal at a fixed local budget costs 3–10x.
4. **The zero-yield pool is a coin flip, not a population.** An independent model
   over the same (attempt ordinal, local budget) cells reproduces the observed
   zero-gain share to within half a point at every budget (750k: 19.1% modelled vs
   18.6% observed) at an overdispersion of 1.30. There is no separable unfixable
   subpopulation for a ranking to route around — and the one policy that *does*
   empty the pool (per-frame ranking takes it from 20.8% to 5.6%) extracts exactly
   the same 5.54 points from it as the live policy does. It converts one zero into
   several near-zeros.

The recommendation and what it does license are in *Verdict* at the end.

## Protocol

```text
npx tsx scripts/v0/study_repair_selection.ts extract --archive=<label>:<path> ... \
  --out=generated/budget-telemetry/repair-selection/records.json
npx tsx scripts/v0/study_repair_selection.ts report \
  --records=generated/budget-telemetry/repair-selection/records.json \
  --replicates=1000 --out=docs/repair-selection-study.md \
  --json=generated/budget-telemetry/repair-selection/report.json
```

Every archive is read for its `budgetTelemetry` attempts and its final drift
report. The attempt counts reproduce `docs/repair-roi-study.md` exactly, which is
the reader's cross-check that the two studies see the same population. `cost floor`
is the smallest local budget any restart in that archive was ever sized to — the
empirical lower bound the per-frame policies need to be well defined (see
*Policies*).

| archive | budget | compiles w/ repair | repair attempts | telemetry | feasMargin | deepest restart | cost floor (kf) | path |
|---|---:|---:|---:|---|---:|---:|---:|---|
| 150k | 150k | 322 | 626 | trace:352 | 1.025 | 5 | 0.8 | `generated/budget-telemetry/law/panel-150k.json.checkpoint.jsonl` |
| 300k | 300k | 346 | 929 | trace:352 | 1.000 | 8 | 0.6 | `generated/budget-telemetry/law/panel-300k.json.checkpoint.jsonl` |
| 750k | 750k | 350 | 953 | trace:352 | 1.000 | 8 | 1.8 | `generated/budget-telemetry/law/panel-750k.json.checkpoint.jsonl` |
| 750k-N48 | 750k | 2112 | 5788 | summary:2112 | 1.000 | 10 | 1.6 | `generated/benchmark-v2/eval/cached-N48-2026-08-01T11-14-33Z.json.checkpoint.jsonl` |
| 1500k | 1.50M | 352 | 1183 | trace:352 | 1.000 | 16 | 3.0 | `generated/budget-telemetry/law/panel-1500k.json.checkpoint.jsonl` |

## Does the ranking even change?

Share of compiles whose unconstrained top-1 anchor differs from the live pick, on
the archived incumbent. A policy that never moves the pick cannot move the score,
and this is the cheapest way to retire one.

| archive | bench_weighted | sse_per_frame | ceiling_excl | headroom | combined | suffix | suffix_per_frame |
|---|---:|---:|---:|---:|---:|---:|---:|
| 150k | 10.9% | 80.7% | 0.0% | 0.0% | 79.8% | 95.0% | 92.5% |
| 300k | 12.1% | 84.7% | 0.0% | 0.0% | 83.8% | 95.4% | 93.4% |
| 750k | 12.9% | 87.4% | 0.0% | 0.0% | 86.0% | 94.9% | 89.7% |
| 750k-N48 | 10.2% | 84.9% | 0.0% | 0.0% | 84.3% | 95.2% | 90.2% |
| 1500k | 11.9% | 88.6% | 0.0% | 0.0% | 87.2% | 95.5% | 90.3% |

**What P2 actually is.** The compiler's `axis_quality` pools every axis error into
one RMS (`score.ts:155`), so `d(axis_quality)/d(error²)` is the SAME constant at
every gap and raw axis-SSE is *already* the exact marginal-scorer ranking for the
register's own comparator. The benchmark differs: it takes a weighted RMS over
per-axis RMS values with `air/speed/impact = 0.3` and `amplitude = 0.1`
(`benchmark/v2/compat/suite-manifest.json`), so the two rankings can only diverge
where a spec's axes carry unequal weight-per-observation. Every source in the suite
reports all its axes on all its gaps, which leaves exactly one mechanism: the twelve
sources that author `amplitude`, whose weight is a third of the others'.

| archive | compiles | with a 4th scored axis | P2 moves the pick there | P2 moves the pick elsewhere |
|---|---:|---:|---:|---:|
| 150k | 322 | 96 | 35 | 0 |
| 300k | 346 | 96 | 42 | 0 |
| 750k | 350 | 96 | 45 | 0 |
| 750k-N48 | 2112 | 576 | 216 | 0 |
| 1500k | 352 | 96 | 42 | 0 |

## How much error is at a ceiling?

`weakAxisCeiling` exists on two axes only (`substrate.ts:697/713`: the elevation
climb ceiling and the impact catchable-redirection ceiling). The exclusion policy
needs gaps whose weak axis error is already the irreducible `target − ceiling`
residue. This is how many there are.

| archive | reported gaps | weak axis at its ceiling | any ceiling floor > 0 | mean floor share of SSE |
|---|---:|---:|---:|---:|
| 150k | 28953 | 0 | 8 | 0.00000 |
| 300k | 31775 | 0 | 5 | 0.00000 |
| 750k | 32228 | 0 | 6 | 0.00000 |
| 750k-N48 | 194688 | 0 | 25 | 0.00000 |
| 1500k | 32448 | 0 | 4 | 0.00000 |

## Cost model

`estCostOf(k)` is reconstructed from `incumbent_path_work_estimate_frames`, the
value the estimator read off the compiler's own `costToEnd` array at every
observation's high-water gap: exact there, linearly interpolated elsewhere,
anchored at `costToEnd[0] = firstCompletionFrame`. `LOO` holds out one known point
and predicts it from the rest. `sparse-vs-dense` is the accuracy of the
two-points-per-attempt reconstruction a `summary`-level archive allows, scored
against the dense `trace` truth — it is the error the N48 replay carries, and the
N48's own LOO column is pessimistic because it holds a point out of an already
two-or-three-point set.

| archive | known gaps / compile | coverage | LOO median APE | LOO p90 APE | sparse-vs-dense median APE |
|---|---:|---:|---:|---:|---:|
| 150k | 14.8 | 16.5% | 0.3% | 1.4% | 1.3% |
| 300k | 28.1 | 30.6% | 0.2% | 0.9% | 1.2% |
| 750k | 36.6 | 39.8% | 0.3% | 1.1% | 1.4% |
| 750k-N48 | 2.6 | 2.8% | 3.0% | 21.1% | n/a |
| 1500k | 40.5 | 44.0% | 0.2% | 0.9% | 1.0% |

## Replay fidelity

The live ranking replayed against the archive with the observed accept/reject
sequence and the observed per-attempt spend substituted in, so the only thing under
test is the SELECTION arithmetic: weakness map, cost model, affordability cap,
`exhausted`, upstream walk. `zero-accept` compiles are the clean stratum — their
archived report IS the incumbent report the live policy saw at every round, because
nothing was ever adopted. Everywhere else the report has moved under the replay's
feet, and the gap between the two strata is the size of that problem.

| archive | stratum | compiles | decision-1 anchor exact | within +/-1 | all-attempt anchor exact |
|---|---|---:|---:|---:|---:|
| 150k | zero-accept | 102 | 98.0% | 100.0% | 96.4% |
| 150k | accepting | 220 | 41.4% | 51.8% | 59.9% |
| 150k | all | 322 | 59.3% | 67.1% | 67.9% |
| 300k | zero-accept | 87 | 96.6% | 97.7% | 96.6% |
| 300k | accepting | 259 | 38.6% | 49.8% | 63.2% |
| 300k | all | 346 | 53.2% | 61.8% | 69.6% |
| 750k | zero-accept | 63 | 100.0% | 100.0% | 97.0% |
| 750k | accepting | 287 | 41.1% | 49.1% | 63.6% |
| 750k | all | 350 | 51.7% | 58.3% | 68.3% |
| 750k-N48 | zero-accept | 393 | 98.0% | 98.7% | 96.4% |
| 750k-N48 | accepting | 1719 | 40.1% | 50.1% | 60.8% |
| 750k-N48 | all | 2112 | 50.9% | 59.1% | 66.0% |
| 1500k | zero-accept | 70 | 98.6% | 100.0% | 97.9% |
| 1500k | accepting | 282 | 36.2% | 44.7% | 63.2% |
| 1500k | all | 352 | 48.6% | 55.7% | 68.7% |

## The identifying cross-tab

Each cell is `n / accept rate / mean gain (pts)` for observed repair attempts at
that (attempt ordinal, local budget). The ROI study's marginal tables cannot
separate these two — "local budget, anchor depth and restart index are one variable
seen three ways" — and every question a selection policy raises is a question about
the off-diagonal. Cells below the
30-sample floor are marked `*` and are priced from the nearest populated
bin of the SAME ordinal, never from a different one.

**150k** — local-budget bins as a share of policy budget: Q1 < 4.5%, Q2 4.5%–8.0%, Q3 8.0%–11.8%, Q4 11.8%–20.1%, Q5 > 20.1%.

| attempt | Q1 | Q2 | Q3 | Q4 | Q5 |
|---|---|---|---|---|---|
| 0 | n=3\* 66.7% 0.89 | n=32 65.6% 2.71 | n=58 60.3% 2.82 | n=104 55.8% 4.12 | n=125 56.8% 6.00 |
| 1 | n=49 49.0% 0.35 | n=62 45.2% 0.74 | n=46 43.5% 0.51 | n=19\* 47.4% 2.08 | n=1\* 100.0% 5.04 |
| 2 | n=46 23.9% 0.11 | n=22\* 27.3% 0.42 | n=20\* 30.0% 0.22 | n=2\* 0.0% 0.00 | — |
| 3 | n=20\* 35.0% 0.28 | n=9\* 22.2% 0.08 | n=1\* 0.0% 0.00 | — | — |
| 4 | n=6\* 33.3% 0.00 | — | — | — | — |
| 5+ | n=1\* 0.0% 0.00 | — | — | — | — |

**300k** — local-budget bins as a share of policy budget: Q1 < 3.7%, Q2 3.7%–7.7%, Q3 7.7%–14.0%, Q4 14.0%–22.8%, Q5 > 22.8%.

| attempt | Q1 | Q2 | Q3 | Q4 | Q5 |
|---|---|---|---|---|---|
| 0 | n=4\* 75.0% 0.12 | n=24\* 75.0% 3.42 | n=52 63.5% 3.66 | n=92 62.0% 4.17 | n=174 45.4% 4.83 |
| 1 | n=48 50.0% 0.25 | n=59 40.7% 0.84 | n=100 51.0% 1.32 | n=78 30.8% 1.06 | n=11\* 9.1% 0.03 |
| 2 | n=67 41.8% 0.11 | n=58 39.7% 1.07 | n=26\* 34.6% 0.85 | n=15\* 40.0% 1.89 | n=1\* 100.0% 5.76 |
| 3 | n=38 39.5% 0.21 | n=24\* 29.2% 0.19 | n=8\* 25.0% 0.42 | n=1\* 0.0% 0.00 | — |
| 4 | n=17\* 47.1% 0.10 | n=13\* 7.7% 0.08 | — | — | — |
| 5+ | n=10\* 50.0% 0.37 | n=9\* 33.3% 0.13 | — | — | — |

**750k** — local-budget bins as a share of policy budget: Q1 < 4.2%, Q2 4.2%–8.9%, Q3 8.9%–16.2%, Q4 16.2%–25.9%, Q5 > 25.9%.

| attempt | Q1 | Q2 | Q3 | Q4 | Q5 |
|---|---|---|---|---|---|
| 0 | n=6\* 83.3% 1.14 | n=31 80.6% 3.12 | n=54 66.7% 5.52 | n=91 58.2% 4.38 | n=168 51.2% 4.10 |
| 1 | n=51 56.9% 0.56 | n=80 50.0% 0.65 | n=87 49.4% 1.37 | n=81 40.7% 1.37 | n=21\* 42.9% 1.17 |
| 2 | n=61 31.1% 0.23 | n=42 31.0% 0.28 | n=32 28.1% 0.55 | n=17\* 41.2% 2.83 | n=2\* 0.0% 0.00 |
| 3 | n=37 37.8% 0.14 | n=19\* 31.6% 0.37 | n=15\* 33.3% 0.56 | n=2\* 0.0% 0.00 | — |
| 4 | n=18\* 27.8% 0.12 | n=10\* 10.0% 0.24 | n=1\* 100.0% 0.94 | — | — |
| 5+ | n=17\* 11.8% 0.11 | n=9\* 22.2% 0.18 | n=1\* 100.0% 2.03 | — | — |

**750k-N48** — local-budget bins as a share of policy budget: Q1 < 4.1%, Q2 4.1%–9.3%, Q3 9.3%–16.3%, Q4 16.3%–25.5%, Q5 > 25.5%.

| attempt | Q1 | Q2 | Q3 | Q4 | Q5 |
|---|---|---|---|---|---|
| 0 | n=33 72.7% 3.75 | n=172 71.5% 3.06 | n=301 67.8% 4.45 | n=548 59.1% 4.20 | n=1058 54.3% 4.68 |
| 1 | n=296 46.3% 0.37 | n=506 49.4% 0.67 | n=547 47.3% 1.30 | n=501 39.5% 1.85 | n=91 45.1% 1.61 |
| 2 | n=317 46.4% 0.27 | n=276 35.5% 0.52 | n=196 35.2% 0.99 | n=103 23.3% 0.67 | n=9\* 33.3% 1.19 |
| 3 | n=201 37.3% 0.26 | n=104 35.6% 0.66 | n=100 28.0% 0.62 | n=3\* 33.3% 0.33 | — |
| 4 | n=142 35.9% 0.24 | n=56 16.1% 0.27 | n=5\* 40.0% 1.88 | n=1\* 100.0% 10.29 | — |
| 5+ | n=168 31.0% 0.12 | n=44 13.6% 0.26 | n=8\* 12.5% 0.46 | n=2\* 0.0% 0.00 | — |

**1500k** — local-budget bins as a share of policy budget: Q1 < 4.2%, Q2 4.2%–8.7%, Q3 8.7%–15.3%, Q4 15.3%–23.4%, Q5 > 23.4%.

| attempt | Q1 | Q2 | Q3 | Q4 | Q5 |
|---|---|---|---|---|---|
| 0 | n=6\* 66.7% 0.60 | n=24\* 83.3% 3.41 | n=56 55.4% 4.66 | n=95 51.6% 4.21 | n=171 45.6% 3.78 |
| 1 | n=13\* 61.5% 0.61 | n=72 51.4% 0.87 | n=98 39.8% 1.28 | n=98 42.9% 1.54 | n=61 27.9% 2.39 |
| 2 | n=68 42.6% 0.20 | n=81 34.6% 0.36 | n=54 31.5% 0.62 | n=35 28.6% 2.16 | n=4\* 50.0% 2.39 |
| 3 | n=50 38.0% 0.28 | n=38 34.2% 0.38 | n=19\* 26.3% 1.11 | n=8\* 12.5% 0.51 | n=1\* 0.0% 0.00 |
| 4 | n=48 29.2% 0.19 | n=11\* 27.3% 0.17 | n=5\* 20.0% 0.41 | — | — |
| 5+ | n=51 25.5% 0.13 | n=11\* 0.0% 0.00 | n=3\* 0.0% 0.00 | n=2\* 50.0% 0.56 | — |


## What another attempt is worth, observationally

Mean total repair gain per compile, by how many restarts that compile happened to
run; and the per-round mean gain profile (rounds 0..8). Both are confounded — a
compile runs more restarts when its restarts are cheap AND when a productive gap
keeps getting re-picked — but they bound the direction: the per-round profile
collapses by a factor of four after round 0 and by an order of magnitude by round
3, and no archive has ever observed the many-cheap-restarts sequence that a
per-frame ranking would produce.

| archive | 1 | 2 | 3 | 4 | 5 | 6+ | per-round mean gain |
|---|---|---|---|---|---|---|---|
| 150k | 3.27 (n=145) | 6.18 (n=87) | 6.86 (n=60) | 6.36 (n=24) | 2.17 (n=5) | 0.05 (n=1) | 4.44 0.74 0.21 0.21 0.00 0.00 |
| 300k | 2.22 (n=50) | 4.46 (n=129) | 6.73 (n=96) | 9.46 (n=41) | 5.99 (n=19) | 7.92 (n=11) | 4.32 0.93 0.75 0.23 0.09 0.23 0.46 0.00 0.00 |
| 750k | 2.18 (n=30) | 5.18 (n=166) | 5.78 (n=81) | 8.78 (n=44) | 6.39 (n=16) | 5.14 (n=13) | 4.25 1.05 0.60 0.28 0.19 0.32 0.16 0.00 0.00 |
| 750k-N48 | 2.96 (n=171) | 5.42 (n=1040) | 5.94 (n=493) | 6.28 (n=204) | 10.41 (n=103) | 8.38 (n=101) | 4.38 1.15 0.56 0.45 0.34 0.23 0.06 0.13 0.25 |
| 1500k | 3.31 (n=10) | 5.16 (n=100) | 4.62 (n=126) | 7.77 (n=52) | 9.54 (n=38) | 8.58 (n=26) | 3.96 1.44 0.67 0.46 0.20 0.13 0.13 0.16 0.01 |

## Is the zero-yield pool a population or a coin flip?

The conversion question has a prior. If per-attempt acceptance were independent
given (round, local budget), the zero-gain share would already be the tail of that
product — nothing to detect, nothing to avoid. `independent-model zero` is
`prod(1 − p_i)` per compile, averaged over the archive, with `p_i` the compile's own
cross-cell rate; `observed var / model var` is the accepts-per-compile
overdispersion against the same model. A ratio near 1 with a matching zero share
says there is no separable unfixable subpopulation for a ranking to route around.

| archive | compiles | attempts/compile | accept rate | observed zero-gain | independent-model zero | observed var / model var |
|---|---:|---:|---:|---:|---:|---:|
| 150k | 322 | 1.94 | 48.4% | 31.7% | 29.2% | 1.42 |
| 300k | 346 | 2.68 | 45.4% | 25.1% | 22.6% | 1.56 |
| 750k | 350 | 2.72 | 46.6% | 18.0% | 19.3% | 1.12 |
| 750k-N48 | 2112 | 2.74 | 47.3% | 18.6% | 19.1% | 1.30 |
| 1500k | 352 | 3.36 | 40.7% | 19.9% | 19.8% | 1.43 |

## Predicted yield — 150k (150k)

Observed mean repair gain: **4.928 pts/compile**; the replay's own
current-policy figure is 4.888, which is the
calibration check. Cluster bootstrap over compiles,
1000 replicates, outcome model refit inside each replicate. Every
policy sees the same resampled compiles and the same per-compile random stream, so
the delta columns are PAIRED and their CIs are CIs of the difference.

`no-fallback delta` re-runs the same arithmetic crediting ONLY attempts whose
(ordinal, local-budget) cell was directly populated at n >= 30; the gap
between it and the headline delta is how much of the claim rests on the
nearest-bin fallback, and the fallback's bias has a known sign — the nearest
populated bin of a thin cheap cell is a MORE expensive bin with a HIGHER mean gain,
so the fallback flatters whichever policy shops in the cheap bins.
`decision-1 delta` is the opening attempt alone, everything downstream ignored —
the only number LC-22 lets us read as a real counterfactual.

| policy | delta vs current | 90% CI | no-fallback delta | decision-1 delta | 90% CI | attempts | gain past attempt 5 | fallback-priced | uncredited |
|---|---:|---|---:|---:|---|---:|---:|---:|---:|
| P1 current — raw axis-SSE | +0.000 | [+0.000, +0.000] | +0.000 | +0.000 | [+0.000, +0.000] | 1.79 | 0.000 | 13.5% | 0.3% |
| P2 scorer-weighted axis error | +0.028 | [-0.244, +0.306] | +0.035 | +0.049 | [-0.246, +0.342] | 1.71 | 0.000 | 11.5% | 0.0% |
| P3 SSE per estimated frame | -1.022 | [-2.380, +0.279] | -1.749 | -1.436 | [-2.701, -0.097] | 3.93 | 0.000 | 40.4% | 11.3% |
| P4 ceiling-exclusion | +0.000 | [+0.000, +0.000] | +0.000 | +0.000 | [+0.000, +0.000] | 1.79 | 0.000 | 13.5% | 0.3% |
| P4b headroom SSE (raw SSE minus its ceiling floor) | +0.000 | [+0.000, +0.000] | +0.000 | +0.000 | [+0.000, +0.000] | 1.79 | 0.000 | 13.5% | 0.3% |
| P5 = P2 + P3 + P4 combined | -1.010 | [-2.388, +0.290] | -1.738 | -1.418 | [-2.691, -0.100] | 3.89 | 0.000 | 40.3% | 11.0% |
| P6 suffix SSE (a restart rebuilds gaps k..end) | +0.399 | [-0.470, +1.271] | +0.470 | +0.686 | [-0.193, +1.569] | 1.00 | 0.000 | 1.3% | 0.0% |
| P7 suffix SSE per estimated frame | -0.252 | [-1.040, +0.562] | -0.371 | -0.252 | [-1.018, +0.497] | 2.01 | 0.000 | 26.6% | 4.1% |

Zero-yield conversion. The last two columns restrict to the compiles that actually
ended with zero gain in this archive (n=102) — the stratum where
the replay is exact because the archived report never moved.

| policy | replayed zero-yield share | on the observed zero-yield pool: gain | converted |
|---|---:|---:|---:|
| P1 current — raw axis-SSE | 31.2% | 4.763 | 62.7% |
| P2 scorer-weighted axis error | 31.9% | 4.726 | 63.0% |
| P3 SSE per estimated frame | 16.2% | 3.790 | 80.8% |
| P4 ceiling-exclusion | 31.2% | 4.763 | 62.7% |
| P4b headroom SSE (raw SSE minus its ceiling floor) | 31.2% | 4.763 | 62.7% |
| P5 = P2 + P3 + P4 combined | 16.3% | 3.820 | 80.8% |
| P6 suffix SSE (a restart rebuilds gaps k..end) | 42.9% | 4.935 | 57.0% |
| P7 suffix SSE per estimated frame | 31.6% | 4.523 | 64.6% |

## Predicted yield — 300k (300k)

Observed mean repair gain: **5.554 pts/compile**; the replay's own
current-policy figure is 5.579, which is the
calibration check. Cluster bootstrap over compiles,
1000 replicates, outcome model refit inside each replicate. Every
policy sees the same resampled compiles and the same per-compile random stream, so
the delta columns are PAIRED and their CIs are CIs of the difference.

`no-fallback delta` re-runs the same arithmetic crediting ONLY attempts whose
(ordinal, local-budget) cell was directly populated at n >= 30; the gap
between it and the headline delta is how much of the claim rests on the
nearest-bin fallback, and the fallback's bias has a known sign — the nearest
populated bin of a thin cheap cell is a MORE expensive bin with a HIGHER mean gain,
so the fallback flatters whichever policy shops in the cheap bins.
`decision-1 delta` is the opening attempt alone, everything downstream ignored —
the only number LC-22 lets us read as a real counterfactual.

| policy | delta vs current | 90% CI | no-fallback delta | decision-1 delta | 90% CI | attempts | gain past attempt 5 | fallback-priced | uncredited |
|---|---:|---|---:|---:|---|---:|---:|---:|---:|
| P1 current — raw axis-SSE | +0.000 | [+0.000, +0.000] | +0.000 | +0.000 | [+0.000, +0.000] | 2.55 | 0.014 | 15.5% | 0.0% |
| P2 scorer-weighted axis error | +0.035 | [-0.217, +0.281] | -0.045 | +0.002 | [-0.240, +0.235] | 2.64 | 0.024 | 18.5% | 0.0% |
| P3 SSE per estimated frame | +0.338 | [-1.195, +1.908] | -2.417 | -0.686 | [-1.989, +0.692] | 7.35 | 0.512 | 52.8% | 13.6% |
| P4 ceiling-exclusion | +0.000 | [+0.000, +0.000] | +0.000 | +0.000 | [+0.000, +0.000] | 2.55 | 0.014 | 15.5% | 0.0% |
| P4b headroom SSE (raw SSE minus its ceiling floor) | +0.000 | [+0.000, +0.000] | +0.000 | +0.000 | [+0.000, +0.000] | 2.55 | 0.014 | 15.5% | 0.0% |
| P5 = P2 + P3 + P4 combined | +0.350 | [-1.151, +1.897] | -2.314 | -0.677 | [-1.993, +0.677] | 7.16 | 0.491 | 52.7% | 12.8% |
| P6 suffix SSE (a restart rebuilds gaps k..end) | -0.774 | [-1.693, +0.143] | -0.539 | +0.323 | [-0.529, +1.172] | 1.06 | 0.000 | 3.2% | 0.0% |
| P7 suffix SSE per estimated frame | -0.079 | [-0.740, +0.615] | -0.627 | -0.113 | [-0.759, +0.565] | 3.47 | 0.112 | 32.7% | 10.7% |

Zero-yield conversion. The last two columns restrict to the compiles that actually
ended with zero gain in this archive (n=87) — the stratum where
the replay is exact because the archived report never moved.

| policy | replayed zero-yield share | on the observed zero-yield pool: gain | converted |
|---|---:|---:|---:|
| P1 current — raw axis-SSE | 25.0% | 5.395 | 67.0% |
| P2 scorer-weighted axis error | 24.5% | 5.462 | 69.3% |
| P3 SSE per estimated frame | 6.3% | 5.997 | 94.2% |
| P4 ceiling-exclusion | 25.0% | 5.395 | 67.0% |
| P4b headroom SSE (raw SSE minus its ceiling floor) | 25.0% | 5.395 | 67.0% |
| P5 = P2 + P3 + P4 combined | 6.5% | 6.011 | 93.3% |
| P6 suffix SSE (a restart rebuilds gaps k..end) | 51.6% | 4.764 | 46.9% |
| P7 suffix SSE per estimated frame | 25.6% | 5.522 | 70.4% |

## Predicted yield — 750k (750k)

Observed mean repair gain: **5.568 pts/compile**; the replay's own
current-policy figure is 5.380, which is the
calibration check. Cluster bootstrap over compiles,
1000 replicates, outcome model refit inside each replicate. Every
policy sees the same resampled compiles and the same per-compile random stream, so
the delta columns are PAIRED and their CIs are CIs of the difference.

`no-fallback delta` re-runs the same arithmetic crediting ONLY attempts whose
(ordinal, local-budget) cell was directly populated at n >= 30; the gap
between it and the headline delta is how much of the claim rests on the
nearest-bin fallback, and the fallback's bias has a known sign — the nearest
populated bin of a thin cheap cell is a MORE expensive bin with a HIGHER mean gain,
so the fallback flatters whichever policy shops in the cheap bins.
`decision-1 delta` is the opening attempt alone, everything downstream ignored —
the only number LC-22 lets us read as a real counterfactual.

| policy | delta vs current | 90% CI | no-fallback delta | decision-1 delta | 90% CI | attempts | gain past attempt 5 | fallback-priced | uncredited |
|---|---:|---|---:|---:|---|---:|---:|---:|---:|
| P1 current — raw axis-SSE | +0.000 | [+0.000, +0.000] | +0.000 | +0.000 | [+0.000, +0.000] | 2.52 | 0.018 | 13.7% | 0.3% |
| P2 scorer-weighted axis error | +0.032 | [-0.212, +0.294] | +0.005 | +0.024 | [-0.228, +0.295] | 2.61 | 0.025 | 15.7% | 0.4% |
| P3 SSE per estimated frame | +0.521 | [-1.335, +2.579] | -2.073 | -0.086 | [-1.968, +2.027] | 8.66 | 0.450 | 43.2% | 24.4% |
| P4 ceiling-exclusion | +0.000 | [+0.000, +0.000] | +0.000 | +0.000 | [+0.000, +0.000] | 2.52 | 0.018 | 13.7% | 0.3% |
| P4b headroom SSE (raw SSE minus its ceiling floor) | +0.000 | [+0.000, +0.000] | +0.000 | +0.000 | [+0.000, +0.000] | 2.52 | 0.018 | 13.7% | 0.3% |
| P5 = P2 + P3 + P4 combined | +0.517 | [-1.325, +2.590] | -2.027 | -0.081 | [-1.939, +2.021] | 8.60 | 0.442 | 42.9% | 24.5% |
| P6 suffix SSE (a restart rebuilds gaps k..end) | -1.112 | [-1.920, -0.324] | -0.991 | -0.159 | [-0.923, +0.618] | 1.15 | 0.000 | 4.5% | 0.0% |
| P7 suffix SSE per estimated frame | -0.029 | [-0.928, +0.872] | -0.647 | -0.014 | [-0.828, +0.821] | 3.74 | 0.096 | 29.7% | 12.5% |

Zero-yield conversion. The last two columns restrict to the compiles that actually
ended with zero gain in this archive (n=63) — the stratum where
the replay is exact because the archived report never moved.

| policy | replayed zero-yield share | on the observed zero-yield pool: gain | converted |
|---|---:|---:|---:|
| P1 current — raw axis-SSE | 22.4% | 5.119 | 73.3% |
| P2 scorer-weighted axis error | 22.0% | 5.166 | 73.6% |
| P3 SSE per estimated frame | 5.8% | 5.796 | 94.0% |
| P4 ceiling-exclusion | 22.4% | 5.119 | 73.3% |
| P4b headroom SSE (raw SSE minus its ceiling floor) | 22.4% | 5.119 | 73.3% |
| P5 = P2 + P3 + P4 combined | 5.9% | 5.789 | 94.0% |
| P6 suffix SSE (a restart rebuilds gaps k..end) | 44.2% | 4.281 | 56.2% |
| P7 suffix SSE per estimated frame | 19.8% | 5.473 | 79.2% |

## Predicted yield — 750k-N48 (750k)

Observed mean repair gain: **5.810 pts/compile**; the replay's own
current-policy figure is 5.759, which is the
calibration check. Cluster bootstrap over compiles,
1000 replicates, outcome model refit inside each replicate. Every
policy sees the same resampled compiles and the same per-compile random stream, so
the delta columns are PAIRED and their CIs are CIs of the difference.

`no-fallback delta` re-runs the same arithmetic crediting ONLY attempts whose
(ordinal, local-budget) cell was directly populated at n >= 30; the gap
between it and the headline delta is how much of the claim rests on the
nearest-bin fallback, and the fallback's bias has a known sign — the nearest
populated bin of a thin cheap cell is a MORE expensive bin with a HIGHER mean gain,
so the fallback flatters whichever policy shops in the cheap bins.
`decision-1 delta` is the opening attempt alone, everything downstream ignored —
the only number LC-22 lets us read as a real counterfactual.

| policy | delta vs current | 90% CI | no-fallback delta | decision-1 delta | 90% CI | attempts | gain past attempt 5 | fallback-priced | uncredited |
|---|---:|---|---:|---:|---|---:|---:|---:|---:|
| P1 current — raw axis-SSE | +0.000 | [+0.000, +0.000] | +0.000 | +0.000 | [+0.000, +0.000] | 2.57 | 0.014 | 0.2% | 0.1% |
| P2 scorer-weighted axis error | -0.001 | [-0.117, +0.112] | -0.001 | -0.042 | [-0.156, +0.070] | 2.71 | 0.028 | 0.3% | 0.1% |
| P3 SSE per estimated frame | -0.170 | [-1.133, +1.061] | -0.442 | -0.913 | [-1.789, +0.366] | 8.41 | 0.415 | 1.8% | 16.3% |
| P4 ceiling-exclusion | +0.000 | [+0.000, +0.000] | +0.000 | +0.000 | [+0.000, +0.000] | 2.57 | 0.014 | 0.2% | 0.1% |
| P4b headroom SSE (raw SSE minus its ceiling floor) | +0.000 | [+0.000, +0.000] | +0.000 | +0.000 | [+0.000, +0.000] | 2.57 | 0.014 | 0.2% | 0.1% |
| P5 = P2 + P3 + P4 combined | -0.172 | [-1.126, +0.997] | -0.431 | -0.917 | [-1.769, +0.316] | 8.30 | 0.404 | 1.7% | 16.1% |
| P6 suffix SSE (a restart rebuilds gaps k..end) | -0.951 | [-1.322, -0.594] | -0.948 | +0.204 | [-0.148, +0.558] | 1.15 | 0.000 | 0.1% | 0.0% |
| P7 suffix SSE per estimated frame | -0.255 | [-0.677, +0.182] | -0.307 | -0.283 | [-0.674, +0.127] | 3.80 | 0.092 | 0.9% | 10.2% |

Zero-yield conversion. The last two columns restrict to the compiles that actually
ended with zero gain in this archive (n=393) — the stratum where
the replay is exact because the archived report never moved.

| policy | replayed zero-yield share | on the observed zero-yield pool: gain | converted |
|---|---:|---:|---:|
| P1 current — raw axis-SSE | 20.8% | 5.537 | 74.9% |
| P2 scorer-weighted axis error | 20.3% | 5.545 | 75.7% |
| P3 SSE per estimated frame | 5.6% | 5.540 | 92.6% |
| P4 ceiling-exclusion | 20.8% | 5.537 | 74.9% |
| P4b headroom SSE (raw SSE minus its ceiling floor) | 20.8% | 5.537 | 74.9% |
| P5 = P2 + P3 + P4 combined | 5.6% | 5.537 | 92.7% |
| P6 suffix SSE (a restart rebuilds gaps k..end) | 42.0% | 4.731 | 57.1% |
| P7 suffix SSE per estimated frame | 18.9% | 5.367 | 77.9% |

## Predicted yield — 1500k (1.50M)

Observed mean repair gain: **6.026 pts/compile**; the replay's own
current-policy figure is 5.872, which is the
calibration check. Cluster bootstrap over compiles,
1000 replicates, outcome model refit inside each replicate. Every
policy sees the same resampled compiles and the same per-compile random stream, so
the delta columns are PAIRED and their CIs are CIs of the difference.

`no-fallback delta` re-runs the same arithmetic crediting ONLY attempts whose
(ordinal, local-budget) cell was directly populated at n >= 30; the gap
between it and the headline delta is how much of the claim rests on the
nearest-bin fallback, and the fallback's bias has a known sign — the nearest
populated bin of a thin cheap cell is a MORE expensive bin with a HIGHER mean gain,
so the fallback flatters whichever policy shops in the cheap bins.
`decision-1 delta` is the opening attempt alone, everything downstream ignored —
the only number LC-22 lets us read as a real counterfactual.

| policy | delta vs current | 90% CI | no-fallback delta | decision-1 delta | 90% CI | attempts | gain past attempt 5 | fallback-priced | uncredited |
|---|---:|---|---:|---:|---|---:|---:|---:|---:|
| P1 current — raw axis-SSE | +0.000 | [+0.000, +0.000] | +0.000 | +0.000 | [+0.000, +0.000] | 3.15 | 0.029 | 9.1% | 0.1% |
| P2 scorer-weighted axis error | +0.029 | [-0.264, +0.335] | -0.064 | +0.016 | [-0.255, +0.308] | 3.28 | 0.042 | 11.4% | 0.1% |
| P3 SSE per estimated frame | +1.056 | [-0.745, +3.285] | -2.635 | +0.462 | [-1.336, +2.550] | 11.22 | 0.721 | 26.1% | 9.8% |
| P4 ceiling-exclusion | +0.000 | [+0.000, +0.000] | +0.000 | +0.000 | [+0.000, +0.000] | 3.15 | 0.029 | 9.1% | 0.1% |
| P4b headroom SSE (raw SSE minus its ceiling floor) | +0.000 | [+0.000, +0.000] | +0.000 | +0.000 | [+0.000, +0.000] | 3.15 | 0.029 | 9.1% | 0.1% |
| P5 = P2 + P3 + P4 combined | +1.045 | [-0.739, +3.233] | -2.591 | +0.459 | [-1.323, +2.522] | 11.01 | 0.693 | 26.2% | 10.0% |
| P6 suffix SSE (a restart rebuilds gaps k..end) | -1.389 | [-2.390, -0.448] | -1.274 | -0.241 | [-1.102, +0.631] | 1.54 | 0.000 | 8.2% | 0.0% |
| P7 suffix SSE per estimated frame | +0.032 | [-0.874, +0.979] | -1.096 | +0.083 | [-0.750, +1.002] | 4.81 | 0.183 | 23.3% | 6.1% |

Zero-yield conversion. The last two columns restrict to the compiles that actually
ended with zero gain in this archive (n=70) — the stratum where
the replay is exact because the archived report never moved.

| policy | replayed zero-yield share | on the observed zero-yield pool: gain | converted |
|---|---:|---:|---:|
| P1 current — raw axis-SSE | 22.1% | 5.525 | 73.8% |
| P2 scorer-weighted axis error | 22.1% | 5.640 | 74.9% |
| P3 SSE per estimated frame | 4.5% | 6.804 | 94.3% |
| P4 ceiling-exclusion | 22.1% | 5.525 | 73.8% |
| P4b headroom SSE (raw SSE minus its ceiling floor) | 22.1% | 5.525 | 73.8% |
| P5 = P2 + P3 + P4 combined | 4.5% | 6.795 | 94.3% |
| P6 suffix SSE (a restart rebuilds gaps k..end) | 41.3% | 4.404 | 57.1% |
| P7 suffix SSE per estimated frame | 20.9% | 5.713 | 75.9% |

## Verdict

**No Phase 2 selection candidate.** Every ranking the plan named is either exactly
inert (P4, P4b), statistically inert an order of magnitude below the measurability
floor (P2), or negative on the one decision the archives can price (P3, P5, P7).
The two rankings this study added on its own reading of the data — suffix-SSE and
suffix-SSE-per-frame — are worse and no better respectively. The admission ticket
Phase 2 asks the replay to issue has not been earned by any of them.

**If the campaign spends an eval slot here anyway** — the posture is move-forward
and an eval is 25 minutes — the only defensible passenger is P2, and it should ride
as a *coherence* change, not a yield change: the anchor ranking would then agree
with the ruler the headline is measured by. Expect `+0.0 ± 0.1`, and note the
asymmetry it introduces — selection would follow the benchmark's weighting while
acceptance keeps following the register's pooled rms, which map Cluster E4 puts out
of bounds. A coherence argument that leaves half the loop incoherent is a weak one.
The margin/interval-quantile affordability change the plan wants to bundle here
does not need a ranking passenger and can ride alone.

**What the study does license.**

- *The blame proxy is not the bottleneck.* The plan's premise is that a better
  ranking converts part of the zero-yield pool. The cross-tab says the anchor's
  identity is a second-order variable: at a fixed attempt ordinal, acceptance and
  gain barely move with local budget, while at a fixed local budget the first
  attempt is worth several times the second and an order of magnitude more than the
  fifth. Whatever governs a repair's value, it is not which weak gap was chosen.
- *Plan item 4 is the real deliverable and it should grow.* The two additive fields
  (`up`, round index) are necessary — this study had to price by attempt ordinal
  because the round is unrecorded, and getting that wrong is worth a full point of
  spurious yield (pricing an up-walk attempt at its round's rate rather than its own
  ordinal's hands every extra attempt the FIRST attempt's acceptance, and turned
  P3's 750k reading from about −0.2 into about +1.1). Add a third: **the
  incumbent's axis-SSE at the pick**, or the drift report at first completion. Its
  absence is the binding limitation here — the replay is exact on zero-accept
  compiles (fidelity 96–100%) and drops to ~40% decision-1 agreement everywhere
  else, purely because the archived report has already moved.
- *Any future per-frame ranking needs a measured cost floor.* `costToEnd → 0` at
  the tail is a real property of the compiler's estimate, not an artifact of this
  reconstruction, and it makes `SSE / estCost` undefined exactly where it would be
  most tempting.
- *`maxAttempts` is not dead after all — for a per-frame ranking.* The ROI study
  retired `LR_REPAIR_MAX_ATTEMPTS = 64` as never-binding, which is true of the live
  policy (deepest observed restart: 16). Under P3 the replay runs 8.4 attempts at
  750k and 11.2 at 1.5M, and 16% of them land past any restart index the archives
  have ever observed. The cap becomes live the moment the ranking gets cheap.

**What would reopen it.** Item 3 of the plan — an acceptance-prediction model — is
unaffected by these results, because it targets `p`, and `p` is what the
independence finding says the zero-yield pool is made of. This study only closes
the *reranking* lane. It also says what such a model would have to beat: a
compile-level signal, not a gap-level one, since the gap-level features here
(SSE, its scorer weighting, its ceiling headroom, its cost) collectively move the
predicted yield by less than the bootstrap's own noise.

## Limits

1. **The incumbent report is the final one.** The archive records the drift report
   after the whole repair phase, not at each pick. On zero-accept compiles the two
   are the same object and the replay is exact (fidelity 96–100%); elsewhere the
   weakness map is stale in one direction — accepted repairs already lowered the
   suffix error at their own anchor — and decision-1 fidelity falls to ~40%.
2. **LC-22.** `restartCounter` advances per attempt, so the first different choice
   reseeds every downstream restart. Round 0 is the only decision the archive pins
   to a real counterfactual; every later round is a distributional statement, and
   the study reports the two separately for that reason.
3. **The outcome model is a resampler, not a mechanism.** It knows (round, local
   budget) and nothing about whether THIS anchor can be fixed. Its acceptance rates
   come from attempts the LIVE policy chose, so a counterfactual anchor is priced by
   analogy: same round, same size, different gap.
4. **Deep sequences are unobserved.** Rounds past the archive's deepest restart are
   credited zero, and the `gain past round 5` column exposes how much of a policy's
   claim sits in the thinnest rounds it does get credit for.
5. **`up` is not recorded.** The upstream walk is reconstructed from the loop, not
   observed; the archived anchor is `kWorst − up` with `up` unknown (ROI study H6).
6. **The resumed frontier is unpriced.** Frames a policy declines to spend are
   credited at zero, not at the resumed frontier's unmeasured rate.
