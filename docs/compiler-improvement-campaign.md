# Compiler Improvement Campaign

Target: accepted Benchmark V2 development headline 550.

Current accepted baseline:
`accept-2026-07-22T18-26-42Z-8565eddc`, canonical headline 513.77. Its
cache covers 300 seeds per budget.

The previous long-form campaign log remains recoverable from repository
history; older material is also under `docs/archive/`. This file now follows
the concise hypothesis/evidence/decision format required by `goal.md`.

## Current mechanism: ballistic launch read

Hypothesis: the short-probe launch read uses the correct discrete free-fall
law, but its constant vertical correction may be slightly miscalibrated for
the six-body-point rider aggregate. The source-default candidate changes
`LAUNCH_VY_OFFSET_PX` from `0.0345` to `0.043`. Boundary: the shared launch
state read only; no case identity or failure-specific behavior.

Mechanism evidence:

- The equal ten-point body+sled aggregate follows the engine's discrete
  ballistic law to floating-point precision in collision-free flight.
- The public six-body aggregate oscillates around that conserved center due
  to articulation.
- Assembly-center and rotation corrections reduced clean-flight coordinate
  error but worsened fitted next-state prediction through the production
  response model.
- Cross-seed state-dependent corrections were unstable and were retired.
- Focused launch-read/ballistic tests pass (37/37).

Retired probe screen:

- baseline 506.24, candidate 500.51;
- delta -5.72, seed-block SE 10.19;
- validity gained 1, lost 2;
- largest loss: shifted pickup progression -249.43.

Canonical cached N=100 comparison (13,200 candidate compiles, zero baseline
compiles):

- headline 512.82 -> 513.79, delta +0.97, seed-block SE 1.03;
- interval [-1.71, +3.65], result inconclusive;
- budgets: 250k +4.81, 500k -0.86, 750k +1.46;
- validity gained 118, lost 100;
- capability -2.74; largest regression was 7s low-air endurance -29.54.

Decision: retire `0.043` and restore `0.0345`. The point estimate was slightly
positive, but not resolved, not uniformly coherent, and came with a material
capability regression. It is not convincing evidence for promotion.

Workflow changes:

- comparisons are arbitrary-N, cache-backed, stateless, and candidate-only;
- the old accounting/certification workflow was removed;
- a cache-prefix validation bug found by N=2 smoke was fixed without
  recompiling candidate rows;
- the separate probe screen was removed: it cost the same 264 candidate
  compiles as canonical N=2, omitted 750k, used a different seed schedule, and
  was directionally misleading here;
- live progress now reports row counts only; canonical scores appear only
  after hierarchical aggregation.

Ballistic-predictor research now has its own objective and frozen-corpus
workflow in `ballistic-goal.md`. Keep direct prediction evidence there; return
to this campaign only when evaluating an integrated compiler candidate.

## 2026-07-25 — the contact-indexed pipeline is 26.6 behind, and why

The ballistic/readiness rework (`6d064b0`, `9ce9430`) is complete and internally
correct, but does not clear the accepted baseline. This entry records what the
deficit actually is, so the next attempt does not re-derive it.

### Where it stands

`npm run benchmark -- eval --seeds=3`, base `accept-2026-07-22T18-26-42Z-8565eddc`:

| | headline | delta | valid |
|---|---:|---:|---:|
| baseline | 517.92 | — | 391/396 |
| pipeline before the anchor work | 493.30 | −24.62 | 368/396 |
| pipeline at `9ce9430` | 491.31 | −26.62 | 364/396 |

The anchor work is −2.0 against a seed-block SE of 3.73 — noise — and is not
uniformly negative: `frontier_low_air_endurance_7s` improved by 101 points
(−137.1 → −35.6) and gained a valid run, because it corrected a runway gate
that had been measuring from an anchor up to three frames past the exit.

The deficit is not spread out. By stratum: `representative` +3.07,
`legacy_regression` +22.20, `capability` **−199.13**. On most of the suite the
new pipeline is fine or better.

### What the failure is

Four long/dense specs never finish a track. Every failing run:

```
budget_exhausted true    sim_frames 250508 / 250000
terminus rideStalled     reported_contacts 88/123
missing 55  -> always a CONTIGUOUS TAIL [68..122]
full_evaluations 0       first_completion_frame never
gap_backtracks 0         handoff_skips 0
```

`handoff_deepest_seen_gap` equals `gap_commits`, so the search reaches a gap it
cannot place a catch at and stops advancing; it then spends the remaining
budget on rescue attempts (57 on dense_recovery vs 0 on healthy cases). Zero
full evaluations means it never once scored a complete track — the entire
compile runs on partial estimates. Tripling the budget moves completion from 88
to 98 of 123 contacts, so this is not "slightly short of budget".

Frame accounting rules out the ballistic layer as the drain: the failing cases
spend LESS on forward-eval (18-23% vs 28-37%) and aim probes (16-17% vs 20-27%)
than healthy ones, and `frontier_dense_recovery` runs the least collision-free
work of any case measured (40,806 kernel frames against 250,508 engine frames;
`river_reentry`, which is healthy, runs 249,025).

### The proximate cause: candidate viability

At 250k, mean over seeds:

| case | baseline viable | now | commits | deepest |
|---|---:|---:|---:|---:|
| frontier_dense_recovery | 32.9% | **23.8%** | 98 → 69 | 102 → 71 |
| frontier_dense_recovery_240ms | 34.8% | 23.5% | 103 → 59 | 108 → 61 |
| frontier_pickup_progression | 42.8% | 26.0% | 106 → 71 | 106 → 71 |
| frontier_pickup_progression_shifted | 41.1% | 27.3% | 102 → 81 | 102 → 82 |
| dense_dialogue_impact_contrast_10 | 57.0% | 36.6% | 130 → 108 | 130 → 110 |
| amplitude_tides (control) | 68.8% | 68.2% | 97 → 97 | 97 → 97 |
| countercurrent (control) | 76.5% | 79.8% | 79 → 79 | 79 → 79 |

Committed depth tracks viability exactly, and healthy specs are untouched. It
is the LANDING gate specifically: `direct_landed` as a share of attempts falls
47.0% → 31.4% on pickup_progression while survival failures FALL (2.0% → 1.2%)
and off-beat is flat. Split across the two changes, baseline → pre-anchor →
now: 47.0 → 36.6 → 31.4 (pickup), 62.1 → 46.5 → 45.4 (dense_dialogue). Roughly
two-thirds arrived with the contact-indexed refactor.

### Falsified: approach aim

Hypothesis: `composeArcProposalTargets` moved the geometry sampler's APPROACH
shaping to the outgoing gap along with its ride-out shaping, and the approach
should read the incoming gap. Implemented in `3aea1b3`, reverted in `bd573cf`.

Wrong on both counts. The arc placed at a contact controls its own impact, its
own line lengths, and the entire ride from that contact to the next — the arc,
the exit, and the flight, all one gap. The interval ENDING at the contact was
shaped by the previous arc. So the composed bag is correct as written, and
`brakePressure` comparing the arriving speed against the OUTGOING target is the
right question ("how much must this catch brake or carry to deliver the gap it
opens"). The measurement agreed: landing rate did not recover (29.8% → 29.1%
on dense_recovery), committed depth got worse (69 → 51), headline 491.31 →
487.03.

### Open: `cost` scores the wrong gap

For an arc placed at a contact, the gap it OWNS is the one starting there.

| stage | aims at the owned gap? |
|---|---|
| geometry sampling | yes — motion from the owned gap, impact/grain from its own contact |
| pool objective | yes — settled(previous) x projected(owned) x readiness(next arc) |
| **`cost`** | **no** — `axisCost(previous gap targets, axes over the previous gap)` |

At the baseline, `cost` was computed over the lookahead window completed with a
ballistic suffix, so it could see the arc's ride-out. That window is active on
64%, 64% and 77% of gaps on the three worst-regressing frontier cases, so the
refactor removed a real signal there. `cost` still drives branch selection
(`handoff.ts:5122` `localScore`, sorted at `:3334/:3582/:3597`),
`pickLowestCost`, `cumulativeCost`, and the pool-sort tiebreak.

How much it matters is bounded by measurement, with `LR_AIM_STUDY_STATS=1`:

| case | objective defined | bail | top-1 disagreement vs cost |
|---|---:|---:|---:|
| frontier_dense_recovery | 98.5% | 1.5% | **23.0%** |
| frontier_dense_recovery_240ms | 98.4% | 1.6% | 22.0% |
| amplitude_tides | 98.7% | 1.3% | 8.8% |
| high_air_drive | 99.6% | 0.5% | 8.4% |

So the correct objective already orders 98.5% of the pool — `cost` decides only
the remainder there. But it is unconditional in branch selection and cumulative
path cost, and it disagrees with the objective about the best candidate nearly
3x more often on the failing specs.

Next step is to align `cost` with generation and the objective rather than to
keep a second definition, and to measure landing rate, viability and committed
depth on the five dense cases before any headline claim. Deferred until that
change is designed rather than guessed: today's falsified attempt cost a full
comparison run.

### Deliberately not done

- readiness corpus recollect + retrain. The guard correctly refuses the stale
  corpus (`readiness corpus sampler policy is stale`). Retraining ranks
  candidates; the failure is that viable candidates are not generated, so it
  would bake the current search behaviour into a new corpus for no gain.
- `verify:optimizer` re-baselining. Left diverged deliberately; re-baselining
  records acceptance and the compiler score is not yet acceptable.
- `EVALUATOR_FINGERPRINT` refresh. Live is `6d58e529b802`, the committed
  constant is `6f760d9c1cc9`, and it was ALREADY stale at `HEAD~1`
  (`31c8c167c6bf`). Golden-harness tripwire only; benchmark-v2 is unaffected.
