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

### 2026-07-25 — bisect: the deficit is `cdba2d7`, and the ballistic work is exonerated

Hypothesis-free localisation. A Tier-0 screen (5 dense + 3 healthy cases, 250k,
2 seeds, ~2 min per state) run in a detached worktree at each buildable commit
between the accepted baseline and HEAD. `engine-rs` is unchanged across the
whole range, so one shared WASM binary keeps the comparison fair.

| commit | dense land% | dense viab% | **completions** | healthy land% | healthy viab% |
|---|---:|---:|---:|---:|---:|
| `02c7828` accepted baseline | 46.9 | 41.9 | **6/10** | 73.3 | 68.3 |
| `2d66844` articulated predictor | 45.8 | 40.6 | **8/10** | 73.6 | 68.8 |
| `8f73527` constraint predictor | 48.6 | 43.8 | **9/10** | 71.1 | 65.7 |
| **`cdba2d7` refactor pipeline** | **39.5** | **33.4** | **1/10** | 73.4 | 68.6 |
| `6d064b0` contact-indexed | 33.9 | 27.6 | **0/10** | 75.5 | 71.0 |
| `9ce9430` anchor = exit (HEAD) | 33.5 | 27.0 | 0/10 | 75.3 | 70.8 |

Healthy controls are flat across the entire range (71–76%), which is exactly the
control behaviour the screen needs to be trusted.

Three conclusions, none of which required a hypothesis:

1. **The ballistic predictor work is exonerated.** `2d66844` and `8f73527` are
   at or ABOVE the baseline on every column — 8/10 and 9/10 completions against
   the baseline's 6/10. Whatever costs the deficit, it is not the predictor.
2. **`cdba2d7` is the primary culprit**: 48.6 → 39.5 land, 43.8 → 33.4 viable,
   and completions collapse 9/10 → 1/10. That single commit carries most of it.
3. **`6d064b0` is a real but secondary second drop** (39.5 → 33.9), and
   `9ce9430` is noise (39.5 → 33.5 is within the 6d064b0 step).

Critically, **`cdba2d7` predates `arc_proposal.ts`** — it still aims the
geometry sampler at the literal `gap.targets`. So the composed-target aim, which
had been the leading suspect all evening, belongs to the SMALLER second drop and
cannot explain the big one.

File-level bisection inside `cdba2d7` does not work: it is one entangled
refactor, and reverting subsets produces chimeras that fail to compile
(`measure.ts` back to `8f73527` breaks `polish.ts`'s `measureGrainFromLines`
import; `aim.ts` back breaks on `OBJECTIVE_AIR_DEADBAND`). A revert of the whole
candidate-evaluation group (candidate + measure + substrate + polish) gave dense
land 33.0% — worse than `cdba2d7` itself, i.e. an incoherent mixed state rather
than evidence.

Next: mechanism-level measurement rather than file reverts. `cdba2d7` changed
the arc-exit detector (`firstAirborneExitFrame` → `firstCleanAirborneExitFrame`,
horizon-relative and much stricter), which changes how often the short-horizon
gap fit TRUNCATES. That matters for the gates, because a truncated fit clamps
the survival gate to the truncated horizon (`min(horizon, …)`) and narrows the
off-beat window, while a full-horizon fallback applies both at full width. The
screen now reports `trunc%` alongside the per-gate failure split so the bisect
can show it directly.

### 2026-07-25 — trajectory, not generation; three falsifications and two keeps

**The discriminator.** Per-gap viability, `8f73527` (healthy, 9/10 completions)
vs `cdba2d7` (broken, 1/10), same spec and seed, on two dense cases. At gap 0
both compilers start from an identical engine state, so the candidate SET is
generator-determined.

| band | 8f73527 | cdba2d7 | | 8f73527 | cdba2d7 |
|---|---:|---:|---|---:|---:|
| | *dense_recovery* | | | *pickup_progression* | |
| gaps 0–4 | 45.5% | **44.4%** | | 45.7% | **45.5%** |
| gaps 5–9 | 42.7% | **43.2%** | | 45.0% | **43.4%** |
| gaps 10–19 | 41.7% | 23.6% | | 41.9% | 31.5% |
| gaps 40+ | 28.2% | 17.9% | | 34.3% | 25.7% |

Early gaps are **identical**; divergence begins only once the trajectories
separate. **The generator is fine. The search commits worse catches.** This is
why the approach-aim arm failed — it changed generation, which was never the
problem.

**Falsified this session, with the measurement that killed each:**

1. *Approach aim from the incoming gap* — see the previous entry. Landing rate
   did not recover, depth got worse, headline 491.31 → 487.03.
2. *The deleted catch+8 release fallback dumps candidates to the bottom of the
   pool.* Measured objective-bail rates: `8f73527` 3.7% / 14.0% / 6.7% vs
   `cdba2d7` 4.0% / 2.0% / 9.0% on dense_recovery / pickup / amplitude_tides.
   `cdba2d7` is not systematically worse and is much better on pickup. Nearly
   all candidates ARE scored, so ranking blindness is not the mechanism.
3. *The scorer's RMS axis pooling compresses the projected term on short gaps.*
   Measured per-pool spread of each objective layer: the projected layer is
   MORE spread on dense specs (0.406, 0.419) than on healthy ones (0.267,
   0.469). Not compressed.

Also ruled out by the gate breakdown across the bisect: truncation rate ROSE at
`cdba2d7` (95.0% → 97.6%) rather than falling, and survival failures FELL
(2.8% → 1.4%). Only landing failures track the deficit: 39.0 → 42.7 → 46.6.

**Kept, both principled and measured, neither closing the deficit:**

- *Projected outgoing air is scored against the deliverable ask* (`e142a44`).
  Restores a physical constraint the pre-refactor readiness encoded as
  `effectiveAirAsk` and which survives as `airDeliverabilityAsk`, applied where
  ranking scores air. Binds on 47%/46% of dense gaps and 0% of healthy — the
  discriminating pattern the mechanism predicts. Dense land 33.5 → 34.5, depth
  better on three cases and worse on none, healthy bit-identical.
- *The next-arc air factor is excluded from the readiness product.* It carries
  no boundary information (a no-physics lookup scores 0.01228 against the
  model's 0.01022; boundary-only 0.03843 against a global mean of 0.03925), and
  removing it is better on BOTH strata. The compiler ablation independently
  prices it lowest of the four factors (~5 points against catchability's ~25).

**The open structural fact, not yet acted on.** Per-pool spread shows that on
dense specs `readiness` sits at a mean level of **0.089–0.095** with ~118%
relative spread, against 0.288–0.300 and ~80% on healthy specs. So the ranking
of a real arc is dominated by a prediction about an arc that does not exist
yet, and the domination gets stronger exactly as catchability falls — a
feedback loop: hard spec → low catchability → readiness dominates → ranking
driven by next-arc prediction → worse commits → harder spec. `settled` and
`projected` are qualities on ~0.5; multiplying them by a probability-like
product on ~0.09 is a scale mismatch, not a search-policy choice anyone made.

Sweeping `LR_OBJECTIVE_FUTURE_POWER` to 0.5 and 2.0 both improved dense landing
slightly (35.4 and 36.5 against 34.3), which is knob noise at 2 seeds rather
than a mechanism, and is recorded here only so it is not mistaken for a lead.

**Falsification 5 — the composed aim is not responsible for the second drop
either.** The `6d064b0` step (dense landing 39.5% → 33.9%) introduced
`arc_proposal.ts` and the contact-owned target composition. Probed by aiming the
sampler at the literal `gap.targets` exactly as every commit up to `cdba2d7`
did:

  legacy literal aim   dense 34.5 / 27.8, 0/10   healthy 76.8 / 72.8
  composed (current)   dense 34.3 / 27.8, 1/10   healthy 76.4 / 72.0

Identical on dense. So the composition costs nothing, which is consistent with
it being the correct ownership: an arc owns the impact at its own contact and
the motion of the gap it OPENS. The probe flag was removed rather than left in
the tree as a parallel path.

What remains unexplained in `6d064b0` is therefore the exit-detector change and
the replacement of the hand-built readiness estimators with the trained
artifact — the latter being a model fitted on a corpus collected under a
DIFFERENT compiler, replacing estimators that had co-evolved with the search.

**Falsification 6 — `cost` scoring the wrong gap is a real inconsistency but
not the deficit.** Implemented the principled version: `cost` measures what the
arc owns, using the SAME ownership split as `composeArcProposalTargets` — the
impact and grain it delivers at its own contact (from the exact measurement the
fit already carries) plus the motion of the gap it opens (from the memoized
outgoing projection, zero engine frames).

  owned-gap cost   dense 34.7 / 28.2, 0/10   healthy 76.4 / 72.0
  current          dense 34.3 / 27.8, 1/10   healthy 76.4 / 72.0

A wash: +0.4 on dense landing, one completion lost, healthy identical, per-case
depth better on three and worse on two. Reverted rather than kept behind a
default-off flag, which would be another parallel path.

The reason it cannot matter is measurable and was already in hand: at the
benchmark's budgets the three-layer objective orders **98.5%** of the pool, and
`localScore` — the only branch-selection consumer of `cost` — is short-circuited
by forward-eval above 75k. So `cost` survives mainly as a tiebreak. The design
inconsistency is real and worth fixing eventually for coherence; it is not worth
attributing the deficit to.

### 2026-07-25 — the failure is an oscillation the search stops damping

Per-gap landing rate at the deepest gaps of `frontier_dense_recovery` — the
wall, where `deepest_seen_gap == gap_commits` and the compile stops advancing:

```
HEAD      gap 59..70:  29.5  3.5  41.0  12.4  42.2  18.4  42.7  15.0  40.1  2.7  0.9  0.0
          attempts:     234  173   178   161   256   267   525   594   973 2370 1160  168
8f73527   gap 58..64:    2.8 45.6   1.5  44.3   8.9  50.0  17.0   ... then 27-50% through gap 75
          attempts:      71   68    67    61    45    78    53   ... 59-138
```

The landing rate ALTERNATES with period two: a catch that is good locally
leaves the rider unable to make the next one, the search barely recovers, and
it repeats.

**Both compilers meet the oscillation, so it is a property of the spec.** The
one that completes the track DAMPS it — amplitude falls and the rate settles at
27–50% through the end. The one that does not AMPLIFIES it — 2.7, 0.9, 0.0 —
and dies, while throwing ten to forty times more candidates at the wall gaps
(2370 attempts against 65) as the rescue machinery burns the remaining budget.

Efficiency confirms the same shape, and cleanly exonerates everything global:

| case | frames per committed contact | | | candidates sampled |
|---|---|---|---|---|
| | `8f73527` | `cdba2d7` | HEAD | |
| frontier_dense_recovery | 2075 | 4918 | 3687 | 8707 → 11328 → 10853 |
| amplitude_tides | 2581 | 2593 | 2580 | 5328 → 6140 → 5655 |
| countercurrent | 3165 | 3165 | 3169 | 5295 → 6080 → 5751 |

The healthy specs are **identical** across all three commits. Nothing global
regressed. Only the dense specs' search dynamics changed, and they now spend
30% more candidates to commit half as many contacts.

This reframes the whole deficit: it is not a wrong quantity anywhere, it is a
loss of DAMPING. That is what motivated weighting projected error by which side
is recoverable (`9da13c0`) — preferring the recoverable side of a target is
what damping looks like. It materially improved the healthy strata (land 76.4 →
78.2) and did not move the dense ones.

**Rollout depth is not the answer either.** The oscillation has period two and
the forward rollout defaults to `greedy:2`, which is exactly the depth that
sees one good catch and one bad one and averages them. Sweeping deeper:

  greedy:2 (default)  dense 34.2 / 27.8   healthy 78.2 / 74.2
  greedy:3            dense 34.5 / 28.3   healthy 77.2 / 73.4
  greedy:4            dense 34.5 / 28.1   healthy 78.8 / 75.5

Dense is flat at 34.5 with zero completions at every depth. Deeper lookahead
does not damp it.

### 2026-07-25 — N=48: the deficit is −17.06, and most of the suite is now AHEAD

First real measurement of the night. `npm run benchmark -- eval --seeds=48`,
6,336 candidate compiles, tree at `e142a44` (deliverable air ask + next-arc air
factor excluded), against `accept-2026-07-22T18-26-42Z-8565eddc`:

```
headline 512.67 -> 495.61   delta -17.06   seed-block SE 1.92   95% [-22.11, -12.02]
validity 6227/6336 -> 5866/6336  (gained 15, lost 376)
  250k  -10.43  [-20.59,  -0.26]
  500k  -19.24  [-27.50, -10.99]
  750k  -17.85  [-25.60, -10.11]
strata
  representative      +8.69  [ +4.04, +13.33]
  legacy_regression  +29.59  [+18.41, +40.78]
  development_music  -12.22  [-20.63,  -3.82]
  capability        -169.93  [-195.36,-144.50]
largest improvements  high_air_drive +64.21, _air_minus_5 +61.73,
                      amplitude_tides +45.52, _restrained_10 +45.45,
                      loose_pocket +42.64   — all at full 144/144 validity
largest regressions   dense_recovery_240ms -308.01 (valid 116->8/144)
                      dense_recovery       -265.71 (valid 109->8/144)
                      pickup_shifted       -194.95 (valid 119->81/144)
```

Two things this settles.

**The deficit is smaller than the 3-seed screen implied** — −17.06 with SE 1.92,
against −26.62 with SE 3.73 at N=3. The earlier figure was a low-power estimate
and should not be quoted again.

**Most of the suite is now clearly AHEAD of the accepted baseline.**
`representative` +8.69 and `legacy_regression` +29.59 are both significantly
positive, with individual gains above +60 at full validity. The contact-indexed
pipeline is not a broad regression; it is a broad improvement carrying two
pathological cases. `frontier_dense_recovery` and its 240ms variant alone
account for roughly 200 of the 376 lost valid runs, and both collapse to 8/144.

This changes what "closing the deficit" means. It is not a matter of recovering
a general loss — it is a matter of those specs completing at all.
