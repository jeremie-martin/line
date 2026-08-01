# Repair ROI Study

Measured answer to the layer-4 question in [`budget-control-design.md`](budget-control-design.md):
what a marginal repair frame buys, and whether the post-completion knobs are sized for it.
Every number below is produced by `scripts/v0/study_repair_roi.ts` from archived
`budgetTelemetry`; nothing is simulated or refitted.

**Headline.** `accepted_score_delta` is a benchmark point — the compiler's `full_score` and
the benchmark's run score are the same number on 72% of compiles and agree to six decimals at
the median. In that unit the repair phase buys 5.8 points per compile at 750k for 348 kf, and
it buys roughly the same 5-8 points at every budget from 150k to 2.25M while its frame cost
multiplies by 34. Repair spend scales as `B^1.33`, repair yield as `B^0.11`, so repair ROI
collapses as `B^-1.22`. Three quarters of the gain arrives in the first restart and 98% in the
first three; `maxAttempts = 64` never binds anywhere (max observed: 17). The post-completion
tail at 750k is flat in every direction the telemetry can see, which is why reallocation
candidates there measure neutral. The one place allocation still binds is 150k-300k, and the
lever there is first-completion cost, not a repair knob.

## Protocol

One reader over two archive families; `.gz` accepted. A repair restart is one
`repair`-kind attempt in `budgetTelemetry.attempts`, indexed in recorded order
(`restart 0` is the compile's first). `outcome_fields = fresh` means every repair
attempt in the archive carries `accepted_score_delta`; `stale` archives are dropped
from every table below. `75k` sits below the 100k `LR_REPAIR_MIN_BUDGET` gate and runs no
repair at all — it is the control that shows the gate holding, and it appears only in the
phase-allocation, knob and overrun tables.

```text
npx tsx scripts/v0/study_repair_roi.ts extract --archive=<label>:<path> ... --out=records.json
npx tsx scripts/v0/study_repair_roi.ts report --records=records.json --out=docs/repair-roi-study.md
```

| archive | budget | compiles | telemetry | repair restarts | outcome fields | head | path |
|---|---:|---:|---:|---:|---:|---:|---:|
| 75k | 75k | 88 | trace | 0 | none | 09f1400 | `generated/budget-telemetry/law/edge-75k.json` |
| 150k | 150k | 352 | trace | 626 | fresh | 09f1400 | `generated/budget-telemetry/law/panel-150k.json` |
| 300k | 300k | 352 | trace | 929 | fresh | 09f1400 | `generated/budget-telemetry/law/panel-300k.json` |
| 750k | 750k | 352 | trace | 953 | fresh | 09f1400 | `generated/budget-telemetry/law/panel-750k.json` |
| 750k-N48 | 750k | 2112 | summary | 5788 | fresh | f96dc03 | `generated/benchmark-v2/eval/cached-N48-2026-08-01T11-14-33Z.N48.json` |
| 1500k | 1.5M | 352 | trace | 1183 | fresh | 09f1400 | `generated/budget-telemetry/law/panel-1500k.json` |
| 2250k | 2.25M | 88 | trace | 313 | fresh | 09f1400 | `generated/budget-telemetry/law/edge-2250k.json` |

## Units: `accepted_score_delta` is a benchmark point

`accepted_score_delta` is the incumbent's `full_score` after a restart minus before it
(`register.ts`: `full_score = 1000 * axis_quality * drift_quality * missing_quality *
off_beat_quality * survival_quality`). That is not obviously the benchmark's unit, so the
study re-scores every archived `report` with `scoreDriftReport` and compares.

Paired valid compiles: **3649**. Ratio internal `full_score` / benchmark run score:

| p0 | p05 | p25 | median | p75 | p95 | p100 | exact to 1e-6 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 0.8195 | 0.8761 | 0.9786 | 1.000000 | 1.0000 | 1.0000 | 1.0202 | 2641/3649 (72.4%) |

**The two scores are the same number.** The median ratio is 1 to six decimals and
72.4% of compiles match bit-for-bit. Both are
`1000 * exp(-rms(axis_error) / 0.25)`; they only differ where a spec's three scored axes
carry unequal observation counts, because the benchmark takes an equally-weighted RMS over
per-axis RMS while `scoreDriftReport` pools every axis error into one RMS. That is the whole
spread (p05 0.876 to p95 1.000).
The other factors are inert on this population: `drift_quality < 1` on 0/3649
compiles, and every repair-bearing compile ends `endOfSpec` so `survival_quality = 1`.

**So one unit of `accepted_score_delta` is one point of that spec's benchmark run score**,
and the headline is the mean of run scores. A mean repair gain of `X` per compile is `X`
headline points *at that grid*, up to the per-spec axis-count reweighting above.

### Reconciliation limit

The telescoping identity is exact by construction: `beforeScore` of restart `i+1` is
`evaluateCached(bestCompleteNode).key.full_score`, which is `afterScore` of restart `i`
(`handoff.ts` 2157/2181), so the deltas sum to `full_score(end of repair phase) -
full_score(first completion)`. What is **not** recorded is `full_score` at first completion,
so the sum cannot be checked against an independent measurement. The available check is the
implied start score `internal_final - sum(deltas)`, which must land in a plausible score range
and never go negative:

| archive | compiles | mean final | mean sum(delta) | mean implied start | min implied start | negative |
|---|---:|---:|---:|---:|---:|---:|
| 150k | 322 | 564.03 | 4.928 | 559.10 | 318.06 | 0 |
| 300k | 346 | 566.35 | 5.554 | 560.79 | 313.05 | 0 |
| 750k | 350 | 582.60 | 5.568 | 577.03 | 347.20 | 0 |
| 750k-N48 | 2112 | 581.99 | 5.810 | 576.18 | 324.54 | 0 |
| 1500k | 352 | 589.13 | 6.026 | 583.10 | 332.90 | 0 |
| 2250k | 87 | 594.00 | 7.829 | 586.17 | 361.87 | 0 |

The implied start is inflated wherever the `resumed` phase improved the incumbent after
repair, because those improvements land in `internal_final` and in no delta. See
*Phase allocation*.

## Repair ROI by restart index

Per restart index, pooled over compiles. `ROI` is `sum(delta) / sum(spent) * 1000` — points
per thousand charged repair frames, the quantity a controller would compare against any other
use of the same frames. `share` is the restart index's share of all repair gain in the archive.

### 150k (150k, 352 compiles, 626 restarts, total gain 1586.8 pts)

| restart | n | accept | mean spent (kf) | mean gain (pts) | ROI (pts/kf) | share | cum share |
|---|---:|---:|---:|---:|---:|---:|---:|
| 0 | 322 | 58.1% | 29.9 | 4.443 | 0.1485 | 90.2% | 90.2% |
| 1 | 177 | 46.3% | 11.7 | 0.740 | 0.0635 | 8.3% | 98.4% |
| 2 | 90 | 25.6% | 8.4 | 0.208 | 0.0248 | 1.2% | 99.6% |
| 3 | 30 | 30.0% | 5.5 | 0.215 | 0.0388 | 0.4% | 100.0% |
| 4 | 6 | 33.3% | 2.2 | 0.004 | 0.0016 | 0.0% | 100.0% |
| 5 | 1 | 0.0% | 1.3 | 0.000 | 0.0000 | 0.0% | 100.0% |

### 300k (300k, 352 compiles, 929 restarts, total gain 1921.8 pts)

| restart | n | accept | mean spent (kf) | mean gain (pts) | ROI (pts/kf) | share | cum share |
|---|---:|---:|---:|---:|---:|---:|---:|
| 0 | 346 | 54.9% | 69.9 | 4.325 | 0.0618 | 77.9% | 77.9% |
| 1 | 296 | 41.9% | 33.7 | 0.933 | 0.0277 | 14.4% | 92.2% |
| 2 | 167 | 40.1% | 18.9 | 0.752 | 0.0399 | 6.5% | 98.8% |
| 3 | 71 | 33.8% | 12.3 | 0.226 | 0.0184 | 0.8% | 99.6% |
| 4 | 30 | 30.0% | 9.9 | 0.095 | 0.0096 | 0.1% | 99.7% |
| 5 | 11 | 54.5% | 11.1 | 0.234 | 0.0211 | 0.1% | 99.9% |
| 6-9 | 8 | 25.0% | 6.5 | 0.286 | 0.0439 | 0.1% | 100.0% |

### 750k (750k, 352 compiles, 953 restarts, total gain 1948.8 pts)

| restart | n | accept | mean spent (kf) | mean gain (pts) | ROI (pts/kf) | share | cum share |
|---|---:|---:|---:|---:|---:|---:|---:|
| 0 | 350 | 58.6% | 201.9 | 4.254 | 0.0211 | 76.4% | 76.4% |
| 1 | 320 | 48.1% | 110.4 | 1.052 | 0.0095 | 17.3% | 93.7% |
| 2 | 154 | 31.2% | 67.7 | 0.595 | 0.0088 | 4.7% | 98.4% |
| 3 | 73 | 34.2% | 48.9 | 0.283 | 0.0058 | 1.1% | 99.4% |
| 4 | 29 | 24.1% | 28.2 | 0.191 | 0.0068 | 0.3% | 99.7% |
| 5 | 13 | 23.1% | 31.7 | 0.323 | 0.0102 | 0.2% | 99.9% |
| 6-9 | 14 | 14.3% | 23.4 | 0.093 | 0.0040 | 0.1% | 100.0% |

### 750k-N48 (750k, 2112 compiles, 5788 restarts, total gain 12269.7 pts)

| restart | n | accept | mean spent (kf) | mean gain (pts) | ROI (pts/kf) | share | cum share |
|---|---:|---:|---:|---:|---:|---:|---:|
| 0 | 2112 | 59.1% | 203.2 | 4.378 | 0.0215 | 75.4% | 75.4% |
| 1 | 1941 | 45.6% | 109.7 | 1.151 | 0.0105 | 18.2% | 93.6% |
| 2 | 901 | 37.8% | 69.1 | 0.557 | 0.0081 | 4.1% | 97.7% |
| 3 | 408 | 34.6% | 48.5 | 0.449 | 0.0092 | 1.5% | 99.1% |
| 4 | 204 | 30.9% | 27.7 | 0.337 | 0.0122 | 0.6% | 99.7% |
| 5 | 101 | 29.7% | 26.8 | 0.234 | 0.0087 | 0.2% | 99.9% |
| 6-9 | 119 | 23.5% | 20.1 | 0.105 | 0.0052 | 0.1% | 100.0% |
| 10-15 | 2 | 50.0% | 11.1 | 0.019 | 0.0017 | 0.0% | 100.0% |

### 1500k (1.5M, 352 compiles, 1183 restarts, total gain 2121.2 pts)

| restart | n | accept | mean spent (kf) | mean gain (pts) | ROI (pts/kf) | share | cum share |
|---|---:|---:|---:|---:|---:|---:|---:|
| 0 | 352 | 51.7% | 380.1 | 3.957 | 0.0104 | 65.7% | 65.7% |
| 1 | 342 | 41.8% | 264.2 | 1.441 | 0.0055 | 23.2% | 88.9% |
| 2 | 242 | 35.5% | 153.6 | 0.666 | 0.0043 | 7.6% | 96.5% |
| 3 | 116 | 32.8% | 107.2 | 0.462 | 0.0043 | 2.5% | 99.0% |
| 4 | 64 | 28.1% | 56.8 | 0.204 | 0.0036 | 0.6% | 99.6% |
| 5 | 26 | 11.5% | 55.4 | 0.126 | 0.0023 | 0.2% | 99.8% |
| 6-9 | 33 | 27.3% | 47.6 | 0.131 | 0.0028 | 0.2% | 100.0% |
| 10-15 | 7 | 14.3% | 42.7 | 0.008 | 0.0002 | 0.0% | 100.0% |
| 16-23 | 1 | 100.0% | 4.0 | 0.045 | 0.0111 | 0.0% | 100.0% |

### 2250k (2.25M, 88 compiles, 313 restarts, total gain 681.1 pts)

| restart | n | accept | mean spent (kf) | mean gain (pts) | ROI (pts/kf) | share | cum share |
|---|---:|---:|---:|---:|---:|---:|---:|
| 0 | 87 | 65.5% | 583.2 | 5.061 | 0.0087 | 64.6% | 64.6% |
| 1 | 85 | 43.5% | 392.7 | 1.198 | 0.0030 | 14.9% | 79.6% |
| 2 | 68 | 47.1% | 219.8 | 1.504 | 0.0068 | 15.0% | 94.6% |
| 3 | 31 | 41.9% | 167.1 | 0.939 | 0.0056 | 4.3% | 98.9% |
| 4 | 18 | 22.2% | 163.8 | 0.182 | 0.0011 | 0.5% | 99.4% |
| 5 | 13 | 46.2% | 79.1 | 0.268 | 0.0034 | 0.5% | 99.9% |
| 6-9 | 9 | 11.1% | 28.1 | 0.100 | 0.0036 | 0.1% | 100.0% |
| 10-15 | 2 | 0.0% | 49.0 | 0.000 | 0.0000 | 0.0% | 100.0% |

## The repair phase obeys a scale-free law

Grid, then the law. Fit is OLS of `ln(y)` on `ln(policy budget)` over the four equal-grid
panels (44 specs x 8 seeds each); the other archives are out-of-fit checks, reported as
`actual / predicted`.

| archive | budget | first completion (kf) | repair spend (kf/compile) | repair gain (pts/compile) | repair ROI (pts/kf) | restarts/compile | accept rate |
|---|---:|---:|---:|---:|---:|---:|---:|
| 150k | 150k | 112.0 | 35.9 | 4.508 | 0.12565 | 1.78 | 0.484 |
| 300k | 300k | 190.1 | 109.8 | 5.460 | 0.04972 | 2.64 | 0.454 |
| 750k | 750k | 413.5 | 345.3 | 5.536 | 0.01603 | 2.71 | 0.466 |
| 750k-N48 | 750k | 411.9 | 348.0 | 5.810 | 0.01670 | 2.74 | 0.473 |
| 1500k | 1.5M | 720.2 | 797.4 | 6.026 | 0.00756 | 3.36 | 0.407 |
| 2250k | 2.25M | 1040.0 | 1233.7 | 7.740 | 0.00627 | 3.56 | 0.479 |

| quantity | value @750k | alpha | 750k-N48 act/pred | 2250k act/pred |
|---|---:|---:|---:|---:|
| first completion (kf) | 409.7 | 0.814 | 411.9 / 409.7 | 1040.0 / 1001.3 |
| repair spend (kf/compile) | 334.4 | 1.334 | 348.0 / 334.4 | 1233.7 / 1447.3 |
| repair gain (pts/compile) | 5.632 | 0.111 | 5.810 / 5.632 | 7.740 / 6.362 |
| repair ROI (pts/kf) | 0.01684 | -1.223 | 0.01670 / 0.01684 | 0.00627 / 0.00440 |
| restarts/compile | 2.86 | 0.242 | 2.74 / 2.86 | 3.56 / 3.73 |
| accept rate | 0.439 | -0.062 | 0.473 / 0.439 | 0.479 / 0.410 |

**Repair spend scales faster than the budget and repair yield barely scales at all.** Spend
per compile goes as `B^1.33`, gain as `B^0.11`, so the return per frame collapses as `B^-1.22`.
Between 150k and 2.25M the repair phase's frame cost multiplies by 34 and its score yield by
1.7. Every allocation question about the post-completion tail is downstream of that.

Two independent checks on the fit. `750k-N48` is a different head (`f96dc03`), a different seed
set (48 vs 8) and a different harness, and lands within 3% of the law on every quantity. The
first-completion exponent `0.814` independently reproduces the `budget^0.82` law committed in
`16266ec`. The 2.25M edge is only 2 seeds per spec and its gain runs 22% above the
extrapolation — treat the gain exponent as the weakest of the six.

## Cap counterfactual: `maxAttempts`

Counterfactual on `LR_REPAIR_MAX_ATTEMPTS` alone: keep the first `r` restarts of every
compile, discard the rest. `gain kept` is the retained share of repair gain, `frames freed`
the share of repair spend released. This is an **upper bound on the loss and a lower bound
on the saving** — the freed frames would in production flow to the `resumed` frontier, whose
gain is not recorded, and a shorter repair phase changes which weak gap is picked next.

### 150k (150k) — restarts per compile: mean 1.78, median 2, max 6, at the 64 cap: 0/352

| maxAttempts | gain kept | frames freed | pts lost / compile | kframes freed / compile |
|---|---:|---:|---:|---:|
| 1 | 90.2% | 23.7% | 0.444 | 8.5 |
| 2 | 98.4% | 7.4% | 0.071 | 2.7 |
| 3 | 99.6% | 1.4% | 0.018 | 0.5 |
| 4 | 100.0% | 0.1% | 0.000 | 0.0 |
| 6 | 100.0% | 0.0% | 0.000 | 0.0 |

### 300k (300k) — restarts per compile: mean 2.64, median 2, max 9, at the 64 cap: 0/352

| maxAttempts | gain kept | frames freed | pts lost / compile | kframes freed / compile |
|---|---:|---:|---:|---:|
| 1 | 77.9% | 37.4% | 1.209 | 41.1 |
| 2 | 92.2% | 11.6% | 0.424 | 12.8 |
| 3 | 98.8% | 3.5% | 0.067 | 3.8 |
| 4 | 99.6% | 1.2% | 0.022 | 1.3 |
| 6 | 99.9% | 0.1% | 0.006 | 0.1 |
| 8 | 100.0% | 0.0% | 0.000 | 0.0 |
| 9 | 100.0% | 0.0% | 0.000 | 0.0 |

### 750k (750k) — restarts per compile: mean 2.71, median 2, max 9, at the 64 cap: 0/352

| maxAttempts | gain kept | frames freed | pts lost / compile | kframes freed / compile |
|---|---:|---:|---:|---:|
| 1 | 76.4% | 41.9% | 1.307 | 144.6 |
| 2 | 93.7% | 12.8% | 0.351 | 44.2 |
| 3 | 98.4% | 4.2% | 0.090 | 14.6 |
| 4 | 99.4% | 1.3% | 0.031 | 4.4 |
| 6 | 99.9% | 0.3% | 0.004 | 0.9 |
| 8 | 100.0% | 0.0% | 0.000 | 0.1 |
| 9 | 100.0% | 0.0% | 0.000 | 0.0 |

### 750k-N48 (750k) — restarts per compile: mean 2.74, median 2, max 11, at the 64 cap: 0/2112

| maxAttempts | gain kept | frames freed | pts lost / compile | kframes freed / compile |
|---|---:|---:|---:|---:|
| 1 | 75.4% | 41.6% | 1.432 | 144.7 |
| 2 | 93.6% | 12.6% | 0.374 | 43.9 |
| 3 | 97.7% | 4.2% | 0.136 | 14.5 |
| 4 | 99.1% | 1.5% | 0.050 | 5.1 |
| 6 | 99.9% | 0.3% | 0.006 | 1.1 |
| 8 | 100.0% | 0.1% | 0.002 | 0.2 |
| 11 | 100.0% | 0.0% | 0.000 | 0.0 |

### 1500k (1.5M) — restarts per compile: mean 3.36, median 3, max 17, at the 64 cap: 0/352

| maxAttempts | gain kept | frames freed | pts lost / compile | kframes freed / compile |
|---|---:|---:|---:|---:|
| 1 | 65.7% | 52.3% | 2.069 | 417.3 |
| 2 | 88.9% | 20.1% | 0.669 | 160.7 |
| 3 | 96.5% | 6.9% | 0.211 | 55.1 |
| 4 | 99.0% | 2.5% | 0.059 | 19.7 |
| 6 | 99.8% | 0.7% | 0.013 | 5.3 |
| 8 | 100.0% | 0.2% | 0.002 | 1.7 |
| 12 | 100.0% | 0.1% | 0.000 | 0.5 |
| 16 | 100.0% | 0.0% | 0.000 | 0.0 |
| 17 | 100.0% | 0.0% | 0.000 | 0.0 |

### 2250k (2.25M) — restarts per compile: mean 3.56, median 3, max 12, at the 64 cap: 0/88

| maxAttempts | gain kept | frames freed | pts lost / compile | kframes freed / compile |
|---|---:|---:|---:|---:|
| 1 | 64.6% | 53.3% | 2.736 | 657.2 |
| 2 | 79.6% | 22.5% | 1.580 | 277.9 |
| 3 | 94.6% | 8.8% | 0.418 | 108.1 |
| 4 | 98.9% | 4.0% | 0.087 | 49.2 |
| 6 | 99.9% | 0.3% | 0.010 | 4.0 |
| 8 | 100.0% | 0.1% | 0.000 | 1.4 |
| 12 | 100.0% | 0.0% | 0.000 | 0.0 |

## Where the gain arrives

Per compile, over compiles that ran at least one restart. `first accept` is the share of all
repair gain carried by each compile's first accepting restart, `first 3` by its first three.

| archive | compiles | mean gain (pts) | mean accepts | first accept | first 3 | zero-gain compiles |
|---|---:|---:|---:|---:|---:|---:|
| 150k | 322 | 4.928 | 0.94 | 92.6% | 100.0% | 31.7% |
| 300k | 346 | 5.554 | 1.22 | 83.7% | 99.8% | 25.1% |
| 750k | 350 | 5.568 | 1.27 | 85.1% | 99.9% | 18.0% |
| 750k-N48 | 2112 | 5.810 | 1.30 | 83.7% | 99.8% | 18.6% |
| 1500k | 352 | 6.026 | 1.37 | 83.1% | 99.5% | 19.9% |
| 2250k | 87 | 7.829 | 1.72 | 75.6% | 99.5% | 16.1% |

## Acceptance economics

The register's own acceptance (`accepted_improvement`) and the subset that actually moved
`full_score` upward. Repair restarts almost always reach a terminal, so completion carries no
signal — acceptance is the scarce event.

**Acceptance is 41-48%, not ~20%.** The lower figure circulating in the campaign notes predates
measured-cost ceilings: a restart now gets a ceiling sized from the incumbent's own cost-to-end
at that anchor, so there are far fewer restarts and each one is given enough budget to finish.
Acceptance is high and it is not the thing to optimize; what a restart is *worth* is.

| archive | restarts | accepted | delta > 0 | reached terminal |
|---|---:|---:|---:|---:|
| 150k | 626 | 48.4% | 48.4% | 99.7% |
| 300k | 929 | 45.4% | 45.4% | 97.2% |
| 750k | 953 | 46.6% | 46.6% | 96.7% |
| 750k-N48 | 5788 | 47.3% | 47.3% | 96.9% |
| 1500k | 1183 | 40.7% | 40.7% | 96.8% |
| 2250k | 313 | 47.9% | 47.9% | 97.8% |

### How big is an accept

Accepted deltas only, in points. The register's comparator is `axis_quality`, not `full_score`,
so an accept can in principle move the score the wrong way; on this population it never does
(see *Distribution hygiene*), because `drift_quality = 1` on every compile makes
`full_score = 1000 * axis_quality` exactly.

| archive | accepts | p10 | median | p90 | max | top decile's share | accepts < 0.1 pt |
|---|---:|---:|---:|---:|---:|---:|---:|
| 150k | 303 | 0.1428 | 1.804 | 12.130 | 75.73 | 57.4% | 7.9% |
| 300k | 422 | 0.0765 | 1.748 | 11.441 | 54.68 | 49.2% | 12.1% |
| 750k | 444 | 0.1388 | 2.181 | 11.188 | 42.76 | 46.5% | 7.9% |
| 750k-N48 | 2738 | 0.1644 | 2.098 | 10.399 | 103.48 | 48.6% | 7.3% |
| 1500k | 481 | 0.1334 | 1.924 | 10.382 | 59.10 | 50.1% | 9.4% |
| 2250k | 150 | 0.1589 | 1.752 | 9.245 | 61.42 | 53.9% | 6.0% |

### By anchor position

`early` / `mid` / `tail` are terciles of `anchor.gap_index / total gaps` — how deep into the
incumbent the restart re-enters. A tail anchor rebuilds a short suffix and is cheap.

| archive | anchor | n | accepted | mean spent (kf) | mean gain | ROI (pts/kf) |
|---|---:|---:|---:|---:|---:|---:|
| 150k | mid | 103 | 54.4% | 44.5 | 6.297 | 0.1414 |
| 150k | tail | 523 | 47.2% | 15.4 | 1.794 | 0.1167 |
| 300k | early | 35 | 37.1% | 121.5 | 5.090 | 0.0419 |
| 300k | mid | 274 | 47.1% | 76.0 | 3.628 | 0.0477 |
| 300k | tail | 620 | 45.2% | 21.9 | 1.209 | 0.0552 |
| 750k | early | 97 | 48.5% | 295.8 | 3.035 | 0.0103 |
| 750k | mid | 328 | 47.3% | 181.6 | 3.449 | 0.0190 |
| 750k | tail | 528 | 45.8% | 63.1 | 0.991 | 0.0157 |
| 750k-N48 | early | 558 | 50.0% | 298.2 | 4.168 | 0.0140 |
| 750k-N48 | mid | 2028 | 48.8% | 180.2 | 3.326 | 0.0185 |
| 750k-N48 | tail | 3202 | 45.9% | 63.4 | 0.999 | 0.0158 |
| 1500k | early | 133 | 40.6% | 523.8 | 4.052 | 0.0077 |
| 1500k | mid | 426 | 39.9% | 326.9 | 2.461 | 0.0075 |
| 1500k | tail | 624 | 41.2% | 115.0 | 0.856 | 0.0074 |
| 2250k | early | 32 | 56.3% | 809.1 | 6.439 | 0.0080 |
| 2250k | mid | 114 | 49.1% | 486.1 | 2.871 | 0.0059 |
| 2250k | tail | 167 | 45.5% | 163.2 | 0.885 | 0.0054 |

### By ceiling source

| archive | ceiling_source | n | share | mean local budget (kf) | mean spent (kf) | accepted | ROI (pts/kf) |
|---|---:|---:|---:|---:|---:|---:|---:|
| 150k | measured_cost_to_end | 626 | 100.0% | 18.4 | 20.2 | 48.4% | 0.1257 |
| 300k | measured_cost_to_end | 928 | 99.9% | 40.5 | 41.5 | 45.4% | 0.0497 |
| 300k | repair_budget_remaining | 1 | 0.1% | 94.4 | 96.0 | 100.0% | 0.0452 |
| 750k | measured_cost_to_end | 953 | 100.0% | 111.7 | 127.6 | 46.6% | 0.0160 |
| 750k-N48 | measured_cost_to_end | 5787 | 100.0% | 111.6 | 127.0 | 47.3% | 0.0167 |
| 750k-N48 | repair_budget_remaining | 1 | 0.0% | 4.4 | 4.5 | 0.0% | 0.0000 |
| 1500k | measured_cost_to_end | 1183 | 100.0% | 208.0 | 237.3 | 40.7% | 0.0076 |
| 2250k | measured_cost_to_end | 313 | 100.0% | 304.2 | 346.9 | 47.9% | 0.0063 |

### By local budget

Quintiles of `local_budget_frames = ceiling - start`, the frames the restart was sized to
afford. This is the direct test of *do bigger ceilings buy acceptance or only spend*.

| archive | quintile | local budget (kf) | n | mean restart idx | accepted | mean spent (kf) | mean gain | ROI (pts/kf) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 150k | Q1 | 0.8–6.7 | 125 | 1.84 | 36.8% | 4.2 | 0.246 | 0.0591 |
| 150k | Q2 | 6.7–12.0 | 125 | 1.06 | 45.6% | 10.5 | 1.140 | 0.1089 |
| 150k | Q3 | 12.1–17.4 | 125 | 0.71 | 48.8% | 15.5 | 1.529 | 0.0987 |
| 150k | Q4 | 17.7–30.1 | 125 | 0.18 | 53.6% | 27.5 | 3.741 | 0.1358 |
| 150k | Q5 | 30.1–51.2 | 126 | 0.01 | 57.1% | 43.0 | 5.990 | 0.1393 |
| 300k | Q1 | 0.6–11.2 | 185 | 2.31 | 45.4% | 5.7 | 0.183 | 0.0319 |
| 300k | Q2 | 11.2–23.2 | 186 | 1.84 | 40.3% | 17.7 | 1.077 | 0.0607 |
| 300k | Q3 | 23.2–42.0 | 186 | 0.95 | 51.1% | 32.1 | 1.868 | 0.0582 |
| 300k | Q4 | 42.1–68.3 | 186 | 0.60 | 46.8% | 56.8 | 2.658 | 0.0468 |
| 300k | Q5 | 68.3–134.1 | 186 | 0.07 | 43.5% | 95.5 | 4.547 | 0.0476 |
| 750k | Q1 | 1.8–31.2 | 190 | 2.42 | 38.9% | 18.0 | 0.311 | 0.0173 |
| 750k | Q2 | 31.3–66.7 | 191 | 1.62 | 45.5% | 65.2 | 0.901 | 0.0138 |
| 750k | Q3 | 66.9–121.1 | 190 | 1.08 | 50.0% | 117.1 | 2.350 | 0.0201 |
| 750k | Q4 | 121.1–194.1 | 191 | 0.63 | 48.7% | 164.0 | 2.922 | 0.0178 |
| 750k | Q5 | 194.4–355.4 | 191 | 0.13 | 49.7% | 272.9 | 3.734 | 0.0137 |
| 750k-N48 | Q1 | 1.6–30.7 | 1157 | 2.70 | 42.0% | 17.2 | 0.368 | 0.0214 |
| 750k-N48 | Q2 | 30.7–69.8 | 1158 | 1.61 | 45.2% | 65.9 | 0.954 | 0.0145 |
| 750k-N48 | Q3 | 70.0–121.9 | 1157 | 1.13 | 48.7% | 119.3 | 2.003 | 0.0168 |
| 750k-N48 | Q4 | 121.9–191.1 | 1158 | 0.63 | 47.3% | 162.3 | 2.858 | 0.0176 |
| 750k-N48 | Q5 | 191.2–359.6 | 1158 | 0.09 | 53.4% | 270.0 | 4.415 | 0.0163 |
| 1500k | Q1 | 3.0–62.1 | 236 | 3.57 | 36.9% | 35.4 | 0.231 | 0.0065 |
| 1500k | Q2 | 62.5–129.4 | 237 | 1.95 | 42.6% | 123.7 | 0.804 | 0.0065 |
| 1500k | Q3 | 129.9–228.8 | 236 | 1.28 | 39.8% | 222.6 | 2.075 | 0.0093 |
| 1500k | Q4 | 228.8–350.7 | 237 | 0.86 | 43.0% | 312.5 | 2.467 | 0.0079 |
| 1500k | Q5 | 351.3–749.0 | 237 | 0.30 | 40.9% | 491.3 | 3.382 | 0.0069 |
| 2250k | Q1 | 4.3–81.6 | 62 | 3.50 | 38.7% | 52.9 | 0.335 | 0.0063 |
| 2250k | Q2 | 83.2–160.5 | 63 | 2.32 | 47.6% | 171.1 | 0.488 | 0.0029 |
| 2250k | Q3 | 163.2–324.8 | 62 | 1.48 | 54.8% | 312.1 | 3.453 | 0.0111 |
| 2250k | Q4 | 325.9–512.5 | 63 | 1.02 | 39.7% | 463.5 | 1.703 | 0.0037 |
| 2250k | Q5 | 513.2–1111.5 | 63 | 0.24 | 58.7% | 729.4 | 4.892 | 0.0067 |

**Bigger ceilings buy both, at flat ROI.** Acceptance rises monotonically with ceiling size at
750k (42.0% -> 53.4%) and mean gain rises 12-fold, but points per frame are flat to slightly
falling. Ceiling size is priced correctly; it is not a mispriced axis.

Read the `mean restart idx` column before treating these three splits as three findings.
Ceiling size is derived from the anchor's measured cost-to-end, the anchor marches toward the
tail as the phase proceeds, and the phase proceeds by restart index. **Local budget, anchor
depth and restart index are one variable seen three ways**, not three independent effects.

## Post-improvement overshoot

For accepting restarts, `spent - first_accepted_improvement_offset` is the charged work that
happened **after** the register had already taken the improvement — the only spend a tighter
per-restart ceiling could reclaim without losing the improvement. `reclaimable` expresses it
as a share of *all* repair spend in the archive (accepting and not), which is the ceiling on
what any ceiling-tightening policy could win.

| archive | accepting | mean overshoot (kf) | median frac | p90 frac | reclaimable | improvement at the wire (<2%) |
|---|---:|---:|---:|---:|---:|---:|
| 150k | 303 | 0.5 | 0.000 | 0.122 | 1.1% | 70.0% |
| 300k | 422 | 2.9 | 0.069 | 0.140 | 3.2% | 19.0% |
| 750k | 444 | 19.7 | 0.124 | 0.420 | 7.2% | 25.5% |
| 750k-N48 | 2738 | 20.4 | 0.128 | 0.372 | 7.6% | 23.1% |
| 1500k | 481 | 38.4 | 0.148 | 0.370 | 6.6% | 23.1% |
| 2250k | 150 | 58.2 | 0.153 | 0.351 | 8.0% | 20.0% |

## The per-restart ceiling is advisory

`ceiling = min(repairBudget, now + estCost * feasMargin)` is only tested at frontier node
boundaries (`runFrontier(pass, fb, () => getSimFrames() < ceiling)`), so a restart stops at the
first boundary *past* its ceiling. `spent / local_budget` is how far past.

| archive | restarts | overran | median spent/ceiling | p90 | mean beyond (kf) | beyond-ceiling share of repair spend |
|---|---:|---:|---:|---:|---:|---:|
| 150k | 626 | 99.2% | 1.079 | 1.201 | 1.7 | 8.6% |
| 300k | 929 | 99.0% | 1.022 | 1.122 | 1.1 | 2.6% |
| 750k | 953 | 99.5% | 1.100 | 1.624 | 15.8 | 12.4% |
| 750k-N48 | 5788 | 99.0% | 1.100 | 1.557 | 15.4 | 12.2% |
| 1500k | 1183 | 99.0% | 1.116 | 1.560 | 29.2 | 12.3% |
| 2250k | 313 | 98.7% | 1.126 | 1.590 | 42.6 | 12.3% |

Sizing accuracy therefore cannot be worth much: at 750k the ceiling is exceeded on 99% of
restarts and the beyond-ceiling frames are themselves ~12% of repair spend, the same order as
any plausible sizing error. This is the mechanical reason candidate A (repair-ceiling accuracy)
came back score-neutral.

## Phase allocation

Shares of all charged frames, from `budgetTelemetry.segments` (accounting is closed — the
recorder emits an `unattributed` segment for any gap and there is none here).

| archive | budget | startup | initial search | repair | resumed | post-completion | repair share of post |
|---|---:|---:|---:|---:|---:|---:|---:|
| 75k | 75k | 5.8% | 94.2% | 0.0% | 0.0% | 0.0% | n/a |
| 150k | 150k | 5.7% | 69.1% | 23.3% | 1.9% | 25.2% | 92.4% |
| 300k | 300k | 3.2% | 59.6% | 36.2% | 1.0% | 37.2% | 97.2% |
| 750k | 750k | 1.3% | 52.8% | 45.0% | 1.0% | 46.0% | 97.8% |
| 750k-N48 | 750k | 1.3% | 52.5% | 45.3% | 1.0% | 46.3% | 97.9% |
| 1500k | 1.5M | 0.6% | 46.4% | 52.0% | 0.9% | 53.0% | 98.2% |
| 2250k | 2.25M | 0.4% | 45.0% | 53.8% | 0.7% | 54.6% | 98.7% |

### Attribution

Repair's side is priced. The resumed frontier's is not: `handoff.ts` ends the resumed attempt
with `budgetRecorder.endActive(resumeEnd, stopReason)` and no outcome object, so
`accepted_improvement`, `first_accepted_improvement_offset_frames` and `accepted_score_delta`
are all `null` for `resumed` attempts. Only `completed`, `first_terminal_offset_frames` and
`spent_frames` survive. **The repair-vs-resumed split therefore has a measured numerator on
one side only**, and every resumed improvement silently inflates the implied first-completion
score in the units table.

| archive | repair kf / compile | repair pts / compile | repair ROI (pts/kf) | resumed attempts | resumed kf / compile | resumed pts |
|---|---:|---:|---:|---:|---:|---:|
| 75k | 0.0 | 0.000 | 0.0000 | 0 | 0.0 | unrecorded |
| 150k | 35.9 | 4.508 | 0.1257 | 114 | 2.9 | unrecorded |
| 300k | 109.8 | 5.460 | 0.0497 | 211 | 3.1 | unrecorded |
| 750k | 345.3 | 5.536 | 0.0160 | 119 | 7.6 | unrecorded |
| 750k-N48 | 348.0 | 5.810 | 0.0167 | 732 | 7.5 | unrecorded |
| 1500k | 797.4 | 6.026 | 0.0076 | 106 | 14.4 | unrecorded |
| 2250k | 1233.7 | 7.740 | 0.0063 | 20 | 16.6 | unrecorded |

## Why the repair phase stops

`runRepairPhase` leaves its loop on one of three conditions: the repair budget (which is the
whole policy budget) is spent, `pickFeasibleWeakGap` returns nothing affordable, or
`maxAttempts` is reached. Only the middle case leaves frames for the resumed frontier, so the
presence of a `resumed` attempt identifies it exactly.

| archive | compiles w/ repair | budget-bound | feasibility-bound | at maxAttempts | zero-gain compiles | their share of repair frames |
|---|---:|---:|---:|---:|---:|---:|
| 150k | 322 | 64.6% | 35.4% | 0.0% | 31.7% | 29.2% |
| 300k | 346 | 39.3% | 60.7% | 0.0% | 25.1% | 25.4% |
| 750k | 350 | 66.0% | 34.0% | 0.0% | 18.0% | 17.4% |
| 750k-N48 | 2112 | 65.3% | 34.7% | 0.0% | 18.6% | 17.6% |
| 1500k | 352 | 69.9% | 30.1% | 0.0% | 19.9% | 19.1% |
| 2250k | 87 | 77.0% | 23.0% | 0.0% | 16.1% | 15.1% |

**`maxAttempts` never binds anywhere on this grid.** And roughly one compile in five spends its
entire repair allocation for exactly zero points.

### What the resumed frontier actually gets

| archive | resumed attempts | headroom p50 (kf) | p90 | max | median spent (kf) | overran |
|---|---:|---:|---:|---:|---:|---:|
| 150k | 114 | 0.5 | 1.0 | 1.6 | 9.9 | 100.0% |
| 300k | 211 | 0.6 | 1.5 | 2.7 | 1.8 | 99.5% |
| 750k | 119 | 1.3 | 3.4 | 5.3 | 19.5 | 100.0% |
| 750k-N48 | 732 | 1.5 | 3.2 | 7.8 | 20.4 | 100.0% |
| 1500k | 106 | 2.9 | 6.5 | 10.4 | 54.3 | 100.0% |
| 2250k | 20 | 4.3 | 12.3 | 16.7 | 95.5 | 100.0% |

The resumed phase is not an allocation — it is the budget overshoot of one more node expansion.
Headroom is what was left when repair gave up; it is a rounding error against the budget even
at its maximum. **The repair-vs-resumed split is not a dial. Repair takes everything, and the
"feasibility-bound" exit only means the residual was smaller than the cheapest remaining
restart.** Both exits are the budget.

## What the knobs see

`mainMargin` is a multiplier on first completion, so the repair/main split is decided by
`first_terminal_total_spent_frames / policy_budget`. At the top of the grid first completion
eats most of the budget and the post-completion tail is short; at the bottom the compile may
never complete at all and repair never runs.

| archive | budget | completed | median C/B | p90 C/B | post-completion kf | restarts |
|---|---:|---:|---:|---:|---:|---:|
| 75k | 75k | 72/88 | 0.698 | 1.077 | 18.1 | 0.00 |
| 150k | 150k | 323/352 | 0.717 | 0.863 | 42.3 | 1.94 |
| 300k | 300k | 351/352 | 0.610 | 0.757 | 113.3 | 2.65 |
| 750k | 750k | 351/352 | 0.543 | 0.663 | 354.6 | 2.72 |
| 750k-N48 | 750k | 2112/2112 | 0.544 | 0.661 | 356.1 | 2.74 |
| 1500k | 1.5M | 352/352 | 0.476 | 0.574 | 812.6 | 3.36 |
| 2250k | 2.25M | 88/88 | 0.456 | 0.551 | 1251.0 | 3.56 |

### The price of a reallocated repair frame

Any candidate that moves frames out of repair takes them off the **tail** of the restart
sequence, so the average ROI is the wrong price. `from restart k` is
`sum(delta) / sum(spent)` over restarts `k` and later. The last two columns price the
post-improvement overshoot at the tail rate — the whole prize available to a tighter
per-restart ceiling.

| archive | all restarts | from restart 1 | from restart 2 | from restart 3 | overshoot kf/compile | its value (pts) |
|---|---:|---:|---:|---:|---:|---:|
| 150k | 0.1257 | 0.0521 | 0.0269 | 0.0357 | 0.4 | 0.020 |
| 300k | 0.0497 | 0.0294 | 0.0332 | 0.0177 | 3.5 | 0.103 |
| 750k | 0.0160 | 0.0090 | 0.0079 | 0.0062 | 24.8 | 0.224 |
| 750k-N48 | 0.0167 | 0.0099 | 0.0085 | 0.0094 | 26.4 | 0.261 |
| 1500k | 0.0076 | 0.0050 | 0.0042 | 0.0038 | 52.5 | 0.260 |
| 2250k | 0.0063 | 0.0042 | 0.0057 | 0.0039 | 99.2 | 0.413 |

## Knob hypotheses

Ranked by predicted magnitude, all framed for a future paired benchmark candidate. The
calibration is candidate A (repair sized from measured cost at tail anchors): it moved
`per_gap_fallback` ceilings 58.9% -> 0% and scored `+0.01` at N=48, 750k. **Any hypothesis
whose predicted effect is under ~0.3 points at 750k is not measurable there** and should not
consume an eval slot.

### H1 — `LR_REPAIR_MAX_ATTEMPTS` is dead. Predicted effect: exactly 0.

The cap is 64. The maximum restarts observed anywhere is 17 (one compile, 1.5M); at 750k it is
11, and 0 of 3,696 compiles reach the cap. Any value at or above 18 is bit-identical on this
grid. The knob's own comment — *"1M affords ~30-40 restarts; 64 -> 706.6 (the cap, not the
budget, was the 1M plateau)"* — describes a compiler that no longer exists: measured-cost
ceilings made restarts several times larger and several times fewer. This is a stale sweep, not
a live knob. The correct action is to re-document or delete it, not to re-tune it.

### H2 — `LR_REPAIR_MAIN_MARGIN` is at its optimum. Predicted effect of raising it: -0.35 at 750k.

The margin is 1.0, so repair takes over at first completion. Raising it to 1.1 hands main
search 10% of first completion — 41 kf at 750k — and takes those frames off the repair tail.
The cap-2 counterfactual prices almost exactly that quantity: 43.9 kf freed costs 0.374 points
(0.0085 pts/kf). So `mainMargin 1.1` costs ~0.35 points unless main-search frames are worth
more than the last repair frames. The shipped bracket, run against the then-default 1.1, put
1.0 at `+0.28` (SE 0.14) and 1.25 at `-0.52`: main-search frames there are worth *less*. The
two measurements agree in sign and order of magnitude, which is as much corroboration as an
unpriced phase allows. Below 750k the case is stronger still: at 150k the tail repair frame is
worth 0.052 pts/kf, six times more. **Do not re-sweep `mainMargin`.**

### H3 — a tighter per-restart ceiling. Predicted effect: at most +0.26 at 750k.

Stopping every accepting restart the moment the register takes its improvement would reclaim
7.6% of repair spend at 750k (26 kf/compile). Re-spent at the tail rate that is +0.26 points —
and that is the *upper* bound, because `first_accepted_improvement_offset_frames` records only
the **first** improvement while `accepted_score_delta` is measured at attempt end, so an
unmeasured share of each delta arrives during the frames the truncation would delete. The
beyond-ceiling slop is a further 12.2% of repair spend, but it exists because the ceiling is
tested only at node boundaries, so collecting it means changing the granularity of the frontier
loop, not the sizing formula. Candidate A already tested sizing accuracy on this axis and
measured `+0.01`. **This lane is closed at 750k.**

### H4 — the zero-gain pool is the biggest number in the study and it is not a knob.

18.6% of 750k compiles run their whole repair allocation and end with a delta of exactly zero:
17.6% of all repair frames, 61 kf per compile, 8.2% of the entire budget, bought nothing. That
is 6x the size of every ceiling and cap effect combined. But abandoning them requires
predicting acceptance before spending, which is a model, not a setting — and the freed frames
would have to go somewhere with better returns. **There is no such place at 750k.** Repair ROI
collapses as `B^-1.22`; by 750k the whole post-completion phase is buying 5.8 points for 348
kf. This is the structural reason candidate A, and every other 750k reallocation, measures
neutral: at that budget the post-completion tail is flat in every direction.

### H5 — allocation binds at 150k-300k, and the binding knob is not in the repair phase.

At 150k a repair frame is worth 0.126 pts/kf, 7.5x its 750k value, and the tail frame is worth
0.052 — still 6x the 750k tail. Repair there gets only 23.3% of charged frames because first
completion eats 112 kf of 150 kf (75%), and 29 of 352 compiles never complete at all. The
measured arithmetic: every 10% shaved off first completion at 150k frees 11 kf, which repair
converts at 0.05-0.13 pts/kf, so **+0.6 to +1.4 points at 150k**. That is the largest
data-supported effect in this study by a factor of three, and it is a question about in-run
spend rate (candidate breadth, forward-eval gating) — the *other* knob family in
`budget-control-design.md` — not about the post-completion split. Nothing in the repair phase
can reach it.

### H6 — unmeasurable from this telemetry

`maxUpstream` (4) and `upstreamOrder` (`oldest-first`) leave no distinguishable trace: the
attempt record carries the anchor gap `k` but not the `up` offset or the round's `kWorst`, so
an upstream walk cannot be separated from the next round's pick. Pricing them needs one more
recorded field (`up`, or the round index), which is a two-line change to the `startAttempt`
call. `feasMargin` is likewise only visible through its effect on `local_budget_frames`, which
the ceiling-overrun table shows is advisory anyway.

## Distribution hygiene

Nothing pathological in the deltas. No negative accepted delta anywhere, no accept with a
zero delta, no rejection with a non-zero one, no zero-spend or zero-budget restart, and every
accepting restart carries its improvement offset. The register comparator/`full_score`
disagreement is therefore *possible but never observed*: `drift_quality`, `missing_quality`
and `off_beat_quality` are all exactly 1 on every compile in this population, which collapses
`full_score` to `1000 * axis_quality` — the same quantity the comparator ranks by. On a suite
where landed contacts drifted, accepts with negative deltas would appear.

| archive | restarts | delta < 0 (mean) | accepted, delta = 0 | rejected, delta != 0 | zero spend | zero local budget | overran own ceiling | accepted, no offset |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 150k | 626 | 0 (0.000) | 0 | 0 | 0 | 0 | 99.2% | 0 |
| 300k | 929 | 0 (0.000) | 0 | 0 | 0 | 0 | 99.0% | 0 |
| 750k | 953 | 0 (0.000) | 0 | 0 | 0 | 0 | 99.5% | 0 |
| 750k-N48 | 5788 | 0 (0.000) | 0 | 0 | 0 | 0 | 99.0% | 0 |
| 1500k | 1183 | 0 (0.000) | 0 | 0 | 0 | 0 | 99.0% | 0 |
| 2250k | 313 | 0 (0.000) | 0 | 0 | 0 | 0 | 98.7% | 0 |

### Budget overrun and the `compile_stats.repair` mismatch

Two things worth knowing before anyone else reads these archives.

**Every compile overruns its budget.** The hard budget is tested at node boundaries, so a
750k compile spends 768k on the median. That is 2.4% of the budget arriving after the budget,
and it is the same mechanism as the advisory per-restart ceiling — one level up.

**`compile_stats.repair` is not the repair ledger.** `snapshot()` fires the moment charged
work crosses the target budget, which is *inside* the last repair restart, before that
restart's `repairRecords.push`. So `stats.repair.restarts` undercounts by one on half the
compiles at 750k. `budgetTelemetry.attempts` is the complete record — `endActive` runs after
the restart finishes and the recorder snapshot is taken last. Use the telemetry, not the stat.

| archive | mean overrun (kf) | median (kf) | p99 (kf) | mean / policy budget | stats.repair.restarts != telemetry |
|---|---:|---:|---:|---:|---:|
| 75k | 2.1 | 0.5 | 9.3 | 2.8% | 0/88 |
| 150k | 4.0 | 2.2 | 13.7 | 2.7% | 72/352 |
| 300k | 3.4 | 0.8 | 27.5 | 1.1% | 62/352 |
| 750k | 18.0 | 15.5 | 46.7 | 2.4% | 168/352 |
| 750k-N48 | 18.1 | 16.9 | 46.0 | 2.4% | 1056/2112 |
| 1500k | 32.8 | 29.0 | 82.5 | 2.2% | 195/352 |
| 2250k | 41.0 | 38.2 | 113.8 | 1.8% | 44/88 |

## Limits

1. **No independent reconciliation of the delta sum.** `full_score` at first completion is not
   recorded, so `sum(delta) = full_score(end of repair) - full_score(first completion)` is a
   code property, checked here only for plausibility (no negative implied start, every
   non-accepting delta exactly 0, every accepting delta strictly positive).
2. **The resumed frontier is unpriced.** `resumed` attempts carry no
   `accepted_score_delta`, so one side of the repair-vs-resumed split has no numerator. The
   phase is small (about 1% of frames) and is structurally an overshoot, so the omission is
   bounded — but it is real, and it inflates the implied first-completion score.
3. **The initial search is unpriced.** Nothing here says what a main-search frame buys, so no
   statement in this study is a full reallocation argument; each one prices only the side it
   can see.
4. **Only the first improvement inside an attempt is timestamped.** Any policy that truncates
   an attempt after its first improvement forfeits an unmeasured share of that attempt's delta.
5. **One variable, three views.** Restart index, anchor depth and local budget co-vary by
   construction. The splits are descriptive, not a decomposition.
6. **Edge budgets are thin.** 75k and 2.25M are 44 specs x 2 seeds; the four law panels are
   44 x 8 and the N48 eval is 44 x 48. Weight accordingly.
7. **One compiler.** Every archive is `09f1400` or `f96dc03`, both post-promotion of
   repair-tail-measured-cost sizing. These curves describe that compiler; the `maxAttempts`
   comment in `handoff.ts` is evidence that repair-phase measurements go stale when the sizing
   mechanism changes underneath them.
