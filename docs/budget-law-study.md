# Budget Law Study

First-completion cost is not a property of a spec. It is a property of a spec
*and* the policy budget the compiler was given, and it scales as a power law:

```text
cost(spec, B) = D(spec) * (B / 750,000)^0.82
```

with one exponent, no ceiling, and no per-budget constants. The exponent is
`0.82 +- 0.02` (source-family jackknife) and it moves by at most 0.03 whichever
budget is withheld from the fit. On a budget the law never
saw, it predicts first completion to 3.6-12.2% median absolute percentage
error, against 19.9-79.7% for `TRAVERSAL_BUDGET_MODEL_V1` and 5.0-259.6% for
the frozen estimator artifact's structural component. At 3x the calibrated
budget — 2,250,000 frames, a budget nothing in the repository has ever been
fitted at — the law reads 5.7% where V1 reads 85.9% and the artifact reads
60.7%.

That is the headline. The consequence is not the one it looks like. The law is
a *spend* model, and `budget_slack` needs a *difficulty* model; substituting one
for the other would collapse the live slack coordinate from a 30x span to a 1.9x
span across the budgets measured here. See *The Live Slack Coordinate*.

This is a Phase 1 study. Nothing in it changed policy, the frozen calibrator,
the recorder, the estimator, or the artifact.

## Protocol

One panel, four budgets, collected fresh on `09f1400` under current production
policy:

- 44 development sources from 14 origin families, seeds 0-7, budgets
  {150k, 300k, 750k, 1500k}: 1,408 compiles, 5,329 attempts, 167,835 samples,
  970,880,224 charged frames;
- two out-of-range edge budgets, 44 sources x seeds 0-1: 75k (0.1x reference)
  and 2,250k (3x reference), 176 compiles, 208,393,146 charged frames;
- the existing four 2M music sidecars (2 Shelter, 2 Believer), re-scored, not
  re-run.

Every panel was collected through `scripts/v0/benchmark_v2/scale_study.ts` at
`--budget-telemetry=trace`, the only trace-level producer whose archives the
analyzer can group into origin families, and validated by
`scripts/v0/analyze_budget_telemetry.ts` with the compat source manifest.
**All six panels segmented every charged frame with zero accounting
violations.** All payloads were recorded by one estimator artifact,
`calibrated-path_if_available+none-053987e23480`, and every observation's point
estimate, interval, and margins were re-derived from its own components and
matched.

The 750k panel is also an independent replication of the shipped artifact:
freshly collected in its own invocation, it measures the
published calibration headline exactly — structural 6.1% median APE, combined
3.2%, calibrated interval coverage 95.1%. Refitting the calibrator's own
structural population on it returns 24,378.6 / 3,928.0 / 11.5 against the
artifact's 24,341.4 / 3,922.7 / 11.7. The pipeline reproduces.

### Three populations

The same panel answers two different questions, so every fit is reported over
three populations:

| id | population | what it is |
|---|---|---|
| `first_completion` | initial-attempt `start` observations, one per compile | exactly the quantity `predictFirstCompletionFrames` predicts and `budget_slack` divides by |
| `calibrator` | initial + snapshot + repair, attempt-weighted | the frozen calibrator's own fit population, reproduced |
| `path_free` | observations with no usable incumbent path | the artifact's actual structural domain (`structuralAttemptKinds: ["initial"]`) |

`resumed` attempts are excluded from every fit for the reason the calibrator
excludes them: they report their tree's root anchor while their frontier is
already deep.

### Reproduction

```bash
for B in 150000 300000 750000 1500000; do
  node --import tsx scripts/v0/benchmark_v2/scale_study.ts \
    --budgets=$B --seeds=0,1,2,3,4,5,6,7 --jobs=32 --budget-telemetry=trace \
    --out=generated/budget-telemetry/law/panel-$((B/1000))k.json
  npx tsx scripts/v0/analyze_budget_telemetry.ts \
    generated/budget-telemetry/law/panel-$((B/1000))k.json \
    --source-manifest=benchmark/v2/compat/source-manifest.json \
    --out=generated/budget-telemetry/law/panel-$((B/1000))k.analysis.json
  npx tsx scripts/v0/study_budget_law.ts extract \
    --panel=generated/budget-telemetry/law/panel-$((B/1000))k.json \
    --out=generated/budget-telemetry/law/compiles-$((B/1000))k.json
done
npx tsx scripts/v0/study_budget_law.ts fit \
  --analysis=... --compiles=... --edge=<label>:<analysis.json> \
  --out=generated/budget-telemetry/law/budget-law.json
```

`NODE_OPTIONS=--max-old-space-size=20480` is needed for the 1500k analysis.
Total compute for this study: **1,179,273,370 charged frames**, about 21
minutes of wall clock at `--jobs=32`.

## The Scaling Is A Power Law

The cleanest evidence needs no model at all. Restrict to the 323 of 352
(source, seed) cells whose initial attempt completed at every budget — this
removes the censoring at 150k as an explanation — and take each cell's cost at
budget B over its own cost at 750k:

| budget | median first-completion cost | paired ratio vs 750k | implied exponent |
|---:|---:|---:|---:|
| 150,000 | 107,513 | 0.2835 | 0.783 |
| 300,000 | 181,414 | 0.4482 | 0.876 |
| 750,000 | 405,544 | 1 | — |
| 1,500,000 | 707,879 | 1.7623 | 0.818 |

Consecutive pairs give 0.755, 0.878, 0.804. They scatter around 0.82 with no
trend, which is what a constant exponent looks like and not what a saturating
ramp looks like.

Stated the other way: the compile spends a slowly falling *share* of its budget
reaching first completion — 0.72 at 150k, 0.61 at 300k, 0.54 at 750k, 0.48 at
1500k, 0.46 at 2250k. A budget-independent cost model would have that share fall
as `1/B`.

### The coefficient mix rotates; only the scalar transfers

Per-budget NNLS on the path-free population, family-jackknife standard errors:

| budget | intercept | +- | contact | +- | duration | +- |
|---:|---:|---:|---:|---:|---:|---:|
| 150,000 | 8,258.8 | 1,357.2 | 346.1 | 171.3 | 31.28 | 7.38 |
| 300,000 | 11,184.7 | 1,681.9 | 1,685.1 | 266.7 | 10.06 | 9.90 |
| 750,000 | 14,802.4 | 4,738.9 | 4,054.0 | 764.2 | 10.86 | 27.32 |
| 1,500,000 | 20,449.9 | 10,004.5 | 6,712.4 | 1,401.9 | 34.87 | 51.43 |

Ratios to the 750k row: intercept 0.56 / 0.76 / 1 / 1.38, contact 0.09 / 0.42 /
1 / 1.66, duration 2.88 / 0.93 / 1 / 3.21. The three coefficients do **not**
each follow `s^0.82` (which would be 0.27 / 0.47 / 1 / 1.77). The contact term
rises far faster than the shared exponent and the duration term is not
monotone: as the budget grows, forward-search breadth loads more of the cost
onto contacts and less onto authored time. The mix rotates.

What transfers is the scalar. A per-coefficient law with three exponents fits
the panel slightly better in sample and is **worse** out of sample at the budget
that matters most — 8.6% against 3.6% at held-out 1500k in the first-completion
view, 10.5% against 3.9% in the path-free view. Three exponents buy overfit.
One exponent on the whole difficulty scalar is the law.

The same collinearity is why the compile-level `first_completion` view must not
be read coefficient by coefficient: on 323 points the intercept and contact term
trade off almost freely (intercept 95,449 +- 44,407 at 150k, contact 75 +- 115),
and NNLS pushes the duration coefficient to exactly zero at 750k and above. Its
*predictions* are fine; its individual coefficients are not identified. Read the
coefficient scaling off the observation-level populations, which decorrelate the
features by sampling many high-water depths per compile.

## The Law

```text
remaining(spec suffix, B) =
  ( intercept * [startup still due]
  + contact   * remaining contacts
  + duration  * remaining authored frames )
  * (B / 750,000)^alpha
```

Fitted on all four budgets, weighted NNLS for the reference coefficients with
the exponent found by grid search on the same weighted SSE:

| population | intercept | contact | duration | alpha | alpha jackknife SE |
|---|---:|---:|---:|---:|---:|
| `first_completion` | 43,967.8 | 3,974.4 | 0 | 0.814 | 0.018 |
| `calibrator` | 24,126.7 | 3,696.4 | 19.04 | 0.819 | 0.019 |
| `path_free` | 13,123.9 | 3,803.1 | 19.03 | 0.828 | 0.018 |

Three independent populations, three exponents inside 0.014 of each other. Per
family, alpha runs 0.58 to 0.88; eleven of fourteen families sit in 0.80-0.88
and the three below are `rapid_pickup_frontier` (0.58), `sparse_transition`
(0.68), and `low_air_frontier` (0.74) — short, sparse specs whose search
saturates before the budget does. A per-family exponent is not warranted by
this panel and is not proposed; the pooled value carries them at the error rates
below.

### Budget-transfer holdout: fit three budgets, predict the fourth

This is the decisive test and it is the one the design rule names. Median
absolute percentage error on the withheld budget's cells:

`first_completion`:

| held out | n | fitted alpha | **law** | per-coefficient | slack form | pooled constant | V1 | artifact |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 150,000 | 323 | 0.817 | **12.2%** | 12.3% | 11.9% | 283.3% | 34.3% | 259.6% |
| 300,000 | 351 | 0.803 | **7.3%** | 7.3% | 7.5% | 128.4% | 19.9% | 122.0% |
| 750,000 | 351 | 0.820 | **5.5%** | 6.5% | 5.3% | 15.4% | 63.9% | 5.0% |
| 1,500,000 | 352 | 0.830 | **3.6%** | 8.6% | 5.3% | 66.8% | 79.7% | 43.6% |

`path_free`:

| held out | n | fitted alpha | **law** | per-coefficient | slack form | pooled constant | V1 | artifact |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 150,000 | 26,278 | 0.833 | **10.2%** | 10.1% | 9.8% | 314.6% | 43.4% | 275.2% |
| 300,000 | 28,943 | 0.813 | **9.8%** | 10.0% | 10.1% | 138.1% | 17.2% | 123.4% |
| 750,000 | 28,643 | 0.835 | **5.3%** | 5.6% | 5.4% | 14.1% | 63.1% | 5.3% |
| 1,500,000 | 28,668 | 0.844 | **3.9%** | 10.5% | 6.3% | 67.0% | 79.4% | 45.0% |

The law beats both incumbents at three of four held-out budgets and ties the
artifact at the fourth. That fourth is 750k — the budget the artifact was fitted
at, where it is in domain by construction. A law that never saw 750k predicts it
to 5.5% where the artifact fitted there reads 5.0%. That is the acceptance test
passing, not failing.

`pooled constant` is the honest control: the same training rows, same NNLS, no
budget term. It is 15-315% wherever the held-out budget differs from the
training centroid. Every point of the law's advantage comes from the exponent.

### Double-blocked (family x seed) holdout

Five family folds crossed with four seed folds; each sample scored only by a fit
that withheld both its family and its seed, exactly as the frozen calibrator
blocks. All four budgets in the fit.

| budget | law (`first_completion`) | law (`path_free`) | V1 | artifact |
|---:|---:|---:|---:|---:|
| 150,000 | 12.7% | 11.1% | 34.3% / 43.4% | 259.6% / 275.2% |
| 300,000 | 6.3% | 8.3% | 19.9% / 17.2% | 122.0% / 123.4% |
| 750,000 | 6.6% | 6.2% | 63.9% / 63.1% | 5.0% / 5.3% |
| 1,500,000 | 5.7% | 4.8% | 79.7% / 79.4% | 43.6% / 45.0% |

Spec and seed generalization cost the law under a point almost everywhere.
Budget generalization is the hard axis, and the exponent is what handles it.

### Rejected variants

**Per-coefficient exponents** (`ref_j * s^alpha_j`, six constants). Rejected:
worse on held-out budgets, and in the `first_completion` view its duration
exponent runs to the search bound because that coefficient is zero — an exponent
on nothing.

**Slack-normalized single form**, fitted in log space as
`k * D^gamma * s^alpha`, where `gamma = 1` is the law above and
`gamma = 1 - alpha` is the pure slack form `D * (B/D)^alpha`. Rejected as
unnecessary: on the population it is meant for, `path_free`, the fit returns
`gamma = 0.9925` against a pure-slack prediction of 0.187, and the residual of
the law regressed on log difficulty has slope `-0.008`. Cost depends on the
budget, not on the budget relative to the spec. In the `calibrator` view the
slack form is strictly worse out of sample (11.8-18.8% against 5.1-9.6%). The
one place it helps is the compile-level `first_completion` view (`gamma = 0.73`,
residual slope `-0.27`), which is the same collinearity that makes that view's
coefficients unreadable. One reference shape, one exponent, no slack term.

## Where The Domain Ends

Two budgets outside the fitted range, plus the 2M music corpus, all scored by
the law fitted on {150k, 300k, 750k, 1500k} only:

| corpus | budget | x reference | n | **law** | V1 | artifact | recorded estimator | episode pace |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| golden | 2,250,000 | 3.0x | 88 | **5.7%** | 85.9% | 60.7% | 55.5% | 9.5% |
| music (Shelter, Believer) | 2,000,000 | 2.67x | 4 | **10.2%** | 84.7% | 58.9% | 60.1% | 26.4% |
| golden | 75,000 | 0.1x | 72 | **29.6%** | 198.0% | 711.3% | 759.6% | 9.3% |

Figures are median APE on first completion; the last two columns are the
recorded estimator's selected point estimate and the episode-pace diagnostic
over all fitted-kind observations.

**Upward the law holds.** At 3x reference on golden specs it is *better* than
its own worst in-panel budget, 5.7%, and the 88 compiles include zero censoring
and normal repair behaviour. The music corpus at 2.67x costs a little more —
10.2%, underpredicting — but those are four runs of 84-contact, 2,264-frame
specs far outside the panel's structure, and the law is still six times better
than either incumbent there. **The upward domain is at least 3x reference and
degrades gracefully.**

**Downward the law breaks at 0.1x.** 29.6% median APE, overpredicting by 23%,
and the regime itself has changed: at 75k, 16 of 88 compiles never reach a first
terminal (18.2%) and **the repair phase never runs at all — zero repair
attempts in 88 compiles**. There is no post-completion budget to allocate, so a
model of first-completion cost is describing a search that is a different shape.
The law is still the best of the four (V1 198%, artifact 711%), but 30% is not a
number to build policy on. **Declare the domain [150k, 2250k]** — a 15x window
around the reference — and treat 75k as out of it.

### Censoring, and what the law cannot do

| budget | compiles | reached first terminal | censored | median cost / budget | repair attempts |
|---:|---:|---:|---:|---:|---:|
| 75,000 | 88 | 72 | 16 (18.2%) | 0.68 | 0 |
| 150,000 | 352 | 323 | 29 (8.2%) | 0.72 | 626 |
| 300,000 | 352 | 351 | 1 (0.3%) | 0.61 | 929 |
| 750,000 | 352 | 351 | 1 (0.3%) | 0.54 | 953 |
| 1,500,000 | 352 | 352 | 0 | 0.48 | 1,183 |
| 2,250,000 | 88 | 88 | 0 | 0.46 | 313 |

Censoring at 150k is not random noise. All 29 censored cells belong to four
specs — `frontier_dense_recovery`, `frontier_dense_recovery_240ms_figures`,
`frontier_pickup_progression`, `frontier_pickup_progression_shifted` — and they
are the same four the benchmark reports invalid at that budget. Any per-budget
fit at 150k is therefore conditioned on completing. The balanced panel above
controls for exactly this and the exponent does not move, so the scaling is
policy, not survivorship.

The law is a cost model and it is **not** a feasibility gate. Scored on the
censored cells by a law fitted without their budget:

| budget | censored | flagged infeasible | median predicted / budget | completed | false alarms |
|---:|---:|---:|---:|---:|---:|
| 75,000 | 16 | 4 | 0.907 | 72 | 4 |
| 150,000 | 29 | 0 | 0.862 | 323 | 16 |

The law ranks the censored cells correctly — median predicted/budget 0.862 for
them against 0.718 for the completers at 150k — but its point estimate never
crosses the budget, so a point-estimate screen flags none of them. V1 flags all
29, and also flags 139 of the 323 that finished; that is not discrimination,
that is V1's 34% overprediction at 150k. A feasibility screen needs the
prediction interval, not the point, and that interval does not exist for the law
yet.

## How Each Incumbent Errs, By Budget

| budget | artifact structural | artifact combined | incumbent path | episode pace | V1 on first completion |
|---:|---:|---:|---:|---:|---:|
| 150,000 | 264.3% (+264.3%) | 250.1% (+250.1%) | 11.3% (-11.1%) | 8.5% (-4.6%) | 34.3% (+34.3%) |
| 300,000 | 126.0% (+126.0%) | 117.3% (+117.3%) | 5.9% (+5.7%) | 6.2% (-1.4%) | 19.9% (-19.9%) |
| 750,000 | 6.1% (+1.3%) | 3.2% (+0.2%) | 6.6% (+6.4%) | 8.5% (-2.9%) | 63.9% (-63.9%) |
| 1,500,000 | 43.7% (-43.6%) | 39.4% (-39.1%) | 7.0% (+6.8%) | 8.6% (-5.4%) | 79.7% (-79.7%) |

Median APE with median signed error; positive is overprediction.

Four things fall out of this table.

**The artifact's structural component is monotone in budget and crosses zero at
750k.** +264%, +126%, +1%, -44%: the signature of a coefficient set fitted at one
point and read at others. This is the 2-3x divergence the reference documented,
measured across the whole range and with its sign.

**V1 has the same signature, shifted.** It overpredicts by 34% at 150k, then
underpredicts by 20%, 64% and 80% — so its own zero crossing sits between 150k
and 300k. Both models cross zero at the budget they were fitted at: the artifact
at 750k, V1 near the 250k its `source` string names. That is the whole story of
the 2-3x disagreement in one observation, and it is why "V1 was closer at 150k"
is true without being a point in V1's favour. V1's coefficient mix — 5,848 /
796 / 29.6 — also sits in the panel's 150k-300k regime, where the measured
duration weight is 31.3 and the contact weight is between 346 and 1,685. V1 is
not a budget-neutral model that happens to be off; it is a 250k-era snapshot of
a budget-dependent quantity.

**Episode pace is budget-stable, and that is new.** 8.5% / 6.2% / 8.5% / 8.6%
across a 10x budget range, and 9.3% / 9.5% at the two out-of-range edges. Pace
is measured online from the compile's own spend per unit of structural progress,
so it has no coefficients to go stale — and this panel shows it does not. It
remains an unselected diagnostic; the frozen artifact gives it weight zero
because on the 750k corpus every pace blend made grouped error worse, which is
still true. But the reason to keep measuring it is now concrete: pace is the
only component in the payload that does not need the law.

**The incumbent path component is also budget-stable** (11.3% / 5.9% / 6.6% /
7.0%, and 7.7% at 2250k), which is expected — it is a measurement, not a fit —
and it is why the artifact's *selected* estimate is only wrong out of domain
where no path exists. Repairs are fine at every budget. The initial search is
where the law is needed.

## The Live Slack Coordinate

`budget_slack = policy budget / predictFirstCompletionFrames(spec)` feeds the
low-slack traversal branch limit (`HANDOFF_LOW_SLACK_BRANCH_THRESHOLD` = 1.5),
the pre-completion forward-eval gate, and the opening-breadth smoothsteps. Every
consumer is a threshold or a ramp positioned around slack 1-2. Here is that
coordinate under each predictor, and next to it the *measured* slack, budget
divided by the compile's actual first-completion cost:

| budget | median V1 slack | median law slack | median measured slack | below 1.5 under V1 | below 1.5 under the law |
|---:|---:|---:|---:|---:|---:|
| 75,000 | 0.50 | 1.21 | 1.46 | 88/88 | 84/88 |
| 150,000 | 1.00 | 1.38 | 1.40 | 352/352 | 272/352 |
| 300,000 | 2.01 | 1.57 | 1.64 | 0/352 | 112/352 |
| 750,000 | 5.02 | 1.86 | 1.84 | 0/352 | 32/352 |
| 1,500,000 | 10.03 | 2.11 | 2.10 | 0/352 | 0/352 |
| 2,250,000 | 15.05 | 2.28 | 2.20 | 0/88 | 0/88 |

The law's slack tracks the measured slack to within 5% at every budget from
150k to 2250k. V1's does not, by design: V1 is budget-independent, so its slack
is proportional to the budget and spans 30x across this table while the real one
spans 1.5x. The 75k row is the exception in both directions — the law reads 1.21
against a measured 1.46, and the measured figure is over completers only, since
18% of those compiles never finish.

**This is why the law must not be dropped into `predictFirstCompletionFrames`.**
Substituting it makes slack proportional to `B^0.18` instead of `B`. Every ramp
that currently opens up as the budget grows would stop opening. At 300k, 112 of
352 compiles would newly fall below the 1.5 branch-limit threshold that none of
them cross today; at 750k, 32 would. It is not a recalibration, it is the
removal of the signal.

The deeper point is the one `budget-control-design.md` already made under
*Non-Circularity*, now with a number on it. The document requires `D(spec)` to
be a *reference* difficulty and explicitly forbids it from being "future
production spend under the new policy". `alpha = 0.82` is the measurement of how
much of the budget the current controller chooses to spend; a predictor carrying
that exponent is production spend by construction. V1 is a difficulty yardstick
that is stale in shape. The law is a spend model that is accurate in every
regime. They are different layers — layer 1 and layer 3 of that document — and
the law is evidence that they must stay separate, not evidence that one should
replace the other.

## Recommendations

### (a) The artifact should carry the law, as schema v2

Adopt a budget exponent in the structural block rather than shipping per-budget
applicability windows.

```json
{
  "schema": "line.compile-budget-estimator-model.v2",
  "structural": {
    "name": "budget-telemetry-nnls-law/<datasetFingerprint>",
    "source": "<analysis inputs>; grouped family x seed folds; budget-transfer validated",
    "referenceBudgetFrames": 750000,
    "interceptFrames": 13123.894,
    "contactFrames": 3803.064,
    "durationFrameScale": 19.025,
    "budgetExponent": 0.828
  },
  "applicability": {
    "structuralPolicyBudgetFrames": { "min": 150000, "max": 1500000 },
    "structuralPolicyBudgetExtrapolated": { "min": 75000, "max": 2250000 },
    "structuralAttemptKinds": ["initial"],
    "pathEstimate": "calibrated_when_available"
  }
}
```

The prediction becomes
`(intercept * startup + contact * C + duration * D) * (B / referenceBudgetFrames)^budgetExponent`.

Four properties make this the right shape:

1. **v1 is v2 with the exponent at zero.** A v1 artifact reads as
   `budgetExponent: 0, referenceBudgetFrames: <its calibration point>` and
   predicts identically. The migration needs no dual code path, and the
   calibrator's static fallback (`TRAVERSAL_BUDGET_MODEL_V1`) is expressible in
   it unchanged.
2. **It is the design rule's shape.** One anchor, one exponent, no ceiling, no
   piecewise ramp keyed to the grid's operating points. It predicted an unfitted
   budget correctly, which is the acceptance test.
3. **Per-budget windows fail all three.** Budgets are continuous — the policy
   budget is whatever the caller passes — so a window scheme has to
   nearest-neighbour or interpolate between fitted points, which is a saturating
   ramp tuned to the benchmark's operating points by another name. It also costs
   a full ~270M-frame panel per window, and it silently answers "what would this
   budget have cost at the nearest fitted budget?" rather than the question
   asked.
4. **`applicability` gets a third grade, not a wider window.** Today an
   observation is `calibrated` or `extrapolated_policy_budget` with the boundary
   at a single point. With the law, `calibrated` should mean inside
   [150k, 1500k], a new `extrapolated_policy_budget` grade should mean inside
   [75k, 2250k] with widened intervals, and outside that the current behaviour
   (null margins, interval at least the remaining hard budget) should stand. The
   interval ratios themselves should be refitted per event on the pooled
   multi-budget corpus and should probably widen with `|log(B / refB)|`; this
   study did not fit intervals and does not claim coverage.

Two things schema v2 must not silently inherit. The fitted reference
coefficients here come from an SSE-NNLS fit, matching how the current artifact
was built, but the calibrator's *acceptance* gate is weighted median log error —
a proper v2 calibrator should search the exponent jointly with the candidate
selection under that same gate, not bolt this study's grid search on. And
`structuralAttemptKinds` stays `["initial"]`: full incumbent-path coverage means
no repair observation is path-free, and nothing in this panel changes that.

### (b) The law should not replace V1 in live policy — and that is a finding, not a deferral

Phase 2 was framed as "is the law good enough to eventually replace V1". The
answer this panel gives is that the question is mis-posed. V1's job is to be a
budget-*independent* difficulty yardstick so that `budget_slack` can mean "how
rich am I relative to this spec". The law's whole content is that actual cost is
budget-*dependent* with exponent 0.82. Putting the law where V1 sits makes slack
nearly constant in the budget and moves hundreds of compiles across the 1.5
threshold; the table above quantifies it. Do not do it, and do not spend a
benchmark eval finding out.

What is worth doing in Phase 2, in order:

1. **Land the law in the telemetry estimator (a).** That is where a spend model
   belongs. It is observation-only, it fixes a component that is currently
   2-8x wrong away from 750k, and it needs no paired evaluation because nothing
   reads it.
2. **Refit V1's *shape* under a frozen reference policy**, not its level. V1 is
   wrong in mix, not only in scale: its duration weight is a 150k-regime number.
   A reference-policy refit (see (c)) would give `D(spec)` an honest shape while
   keeping it budget-independent, and *that* is a live-policy change worth a
   paired eval.
3. **Only then consider consuming the law in policy directly**, and as a
   *second* signal rather than a redefinition of the first — for example sizing
   the pre-completion budget reserve, or a feasibility screen at scarce budgets,
   both of which want "what will this actually cost" and neither of which is
   `budget_slack`.

**The governance wrinkle is real and blocks step 2 as things stand.** The
campaign acceptance surface is 750k-only. A reference-policy V1 refit is,
by construction, roughly neutral at one budget and valuable at the others, so
the instrument that decides promotions cannot see its value — and symmetrically,
it cannot see the damage a 750k-neutral change does at 150k or 2M. This study
gives the numbers to justify an explicit decision before that work starts:
either the multi-budget scale study becomes part of the acceptance evidence for
budget-model changes, or such changes get a named exemption with their own
stated bar. Deciding that afterwards, with a candidate in hand, is how a
measurement instrument turns into an argument.

### (c) What this fit is, and is not, with respect to a reference policy

The panel was collected under **current production policy** at commit `09f1400`.
Every number in this document — the exponent above all — describes how
*production* first-completion cost scales with the budget production is given.
It is not a measurement of traversal difficulty and it is not a reference-policy
calibration.

Concretely, `alpha = 0.82` is a property of the compiler's budget-adaptive
loops, not of the specs. It is the compounded response of forward-search
breadth, the opening-breadth ramps, the forward-eval gate, and the branch limit
to being handed more frames. Change any of those and the exponent moves. That
makes it a *stale-sweep* quantity in the sense the campaign already knows: a
neighbouring mechanism change redefines what it means, and it must be re-measured
when one lands. The artifact should therefore record the compiler identity it
was fitted under, and any Phase 2 that touches a breadth ramp owes a re-fit.

This also sharpens the open question `budget-control-design.md` leaves standing.
"Should `D(spec)` continue to be fitted from production telemetry, or move to a
frozen reference policy?" — the answer is now forced. Production telemetry
cannot produce a budget-independent `D(spec)`, because the quantity it measures
is not budget-independent; that is what this study proves. A reference protocol
with fixed candidate counts, fixed branch widths, no raw-budget ramps, and a
budget high enough to avoid censoring would, if this law holds inside it, have
`alpha ~ 0` by construction — and measuring its residual exponent is the cleanest
possible check that the reference really did freeze allocation. That measurement
is cheap on this harness: the same panel, one flag.

## Artifacts

All under `generated/budget-telemetry/law/` (gitignored):

| path | contents |
|---|---|
| `panel-{150k,300k,750k,1500k}.json[.gz]` | scale_study trace panels, 352 compiles each |
| `panel-*.analysis.json` / `.md` | analyzer output, zero violations, with `calibration_samples` |
| `compiles-*.json` | per-compile records extracted for censoring and slack tables |
| `edge-{75k,2250k}.json[.gz]` and `.analysis.json` | out-of-range edge budgets, 88 compiles each |
| `compiles-edge-*.json` | edge per-compile records |
| `budget-law.json` / `budget-law.md` | every fit, holdout, and table in this document |

The 2M music corpus is the pre-existing
`generated/budget-telemetry/music2m.analysis.json`, re-scored, not re-collected.

Study script: `scripts/v0/study_budget_law.ts` (`extract` and `fit` verbs). It
adapts the frozen calibrator's NNLS and fold logic; it does not modify
`calibrate_budget_estimator.ts`, `analyze_budget_telemetry.ts`,
`budget_telemetry.ts`, `budget_estimator.ts`, or the artifact.
