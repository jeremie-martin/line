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

### 2026-07-25 — the deficit is a SEARCH-EFFICIENCY loss, not a capability loss

The previous entry left "those specs completing at all" as the open question.
It has an answer, and it changes the diagnosis completely.

`frontier_dense_recovery` was believed not to complete "at ANY budget". That was
an artefact of only ever asking it at benchmark budgets. Given more:

```
                first completion   250k   500k   750k
baseline 02c7828      334k frames    no    yes    yes
HEAD                1,420k frames    no     no     no
```

HEAD is not incapable of these specs. It reaches the first complete track
**4.25x slower**, which drops it below two of the three budget tiers. The
capability stratum scores a non-completing run as invalid, so a continuous
efficiency loss shows up as a binary cliff.

That gives the campaign the instrument it had been missing all night:
`first_completion_frame` at a large fixed budget — continuous, deterministic per
(spec, seed, budget), ~4 minutes for six numbers, immune to CPU contention.
Three seeds, two specs, 1.5M frames:

```
                       dense_recovery              pickup_progression
baseline 02c7828   470k / 433k / 639k          335k / 340k / 351k   (sd 8k)
HEAD              1337k / 1509k / none         513k / 396k / 549k   (sd 79k)
```

Two signals: HEAD is systematically slower, and its variance explodes. The
baseline is metronomic on pickup (sd 8k); HEAD wanders (sd 79k).

**Where the frames go.** Decomposing TTC into cost-per-look and looks-per-step
exonerates the ballistic layer a second time:

```
                    frames/eval        evals/commit      commits @250k
dense_recovery    15.4 vs 15.6 base   198.7 vs 206.2      82 vs 78
pickup_progress   14.8 vs 18.4 base   206.4 vs 123.7      82 vs 110
amplitude_tides   19.2 vs 21.1 base   134.5 vs 122.5      97 vs 97
countercurrent    18.6 vs 20.7 base   171.0 vs 155.0      79 vs 79
```

Each look is as cheap or cheaper than the baseline's — the deleted engine-based
suffix measurement means HEAD gets *more* looks per frame budget (16,927 vs
13,606 on pickup). It converts them worse: 206 looks per committed contact
against 124. Healthy controls are unaffected to the commit (97/97, 79/79).

**The shape of the loss: cumulative drift, not a wall.** Per-gap landing rate on
`frontier_pickup_progression` at 250k:

```
gap band    HEAD    baseline
0-4         44.1      45.8
5-9         42.9      44.8
10-19       38.6      39.9
20-39       28.8      41.5
40+         20.3      28.7
```

The two are within ~1.5 points for the first twenty gaps and then separate. The
baseline holds 41-50% all the way to gap 109 and never degrades; HEAD decays
with depth and its tail goes ragged (7.5, 45.8, 8.9, 9.1, 2.9, 18.6, ...) while
attempts explode (940, 1291, 1135 at the last three gaps).

This rules out the framing every earlier entry assumed. There is no single hard
gap that HEAD cannot pass. Each committed arc leaves the rider slightly worse
placed than the baseline's would, the deficit compounds with depth, and on a
123-contact spec it compounds past the budget. Short specs never accumulate
enough drift to show it — which is exactly why `representative` (+8.69) and
`legacy_regression` (+29.59) are significantly AHEAD.

### 2026-07-25 — falsified: the learned catchability model (8th)

`cdba2d7` replaced the baseline's hand-fit bilinear grid of empirical landing
rates (`readinessCatch` over a 10x7 (angle, speed) RATE_GRID) with a learned
component (`infer(artifact, "catchability", features)`). Since catchability is
precisely the dead-end predictor, and dead ends are what "looks per committed
contact" counts, a mis-calibrated model is a clean explanation for the drift.

Probe (legacy-shaped, therefore screen-only by the working agreement): drop the
baseline grid back in behind `LR_READINESS_CATCH_GRID=1`. Identical inputs —
arrival speed and CoM velocity angle.

```
                    dense_recovery TTC        pickup TTC
HEAD (learned)   1337k / 1509k / none     513k / 396k / 549k
grid probe        none / none / none      740k / 803k / 1416k
```

The learned model is decisively BETTER than the grid it replaced, on both specs
and every seed. Catchability is exonerated, and the queued "the corpus is stale,
retrain it" lead is much weaker than it looked: whatever the corpus's provenance
bookkeeping says, the component it produced outperforms the hand-fit surface.
Reverted.

### 2026-07-25 — readiness gets its own exponent (default-off, no-op at 1)

The drift signature says the search under-weights future feasibility against
present quality. The three-layer product could not express that: `readiness` and
`projectedOutgoingQuality` shared one exponent (`objectiveFuturePower`), so the
rate at which the search trades score against feasibility was fixed.

They answer different questions about the same future — projected quality asks
how good the gap this arc opens is, readiness asks whether the NEXT arc can be
built at all — so they get separate exponents.
`LR_OBJECTIVE_READINESS_POWER`, default 1, which reproduces the previous product
bit-for-bit (verified: gamma=1 returns the earlier HEAD TTC numbers exactly).

### 2026-07-25 — the fix: split the future layer by role, weight feasibility

The drift signature says the search under-weights future feasibility against
present quality, and the three-layer product could not express that. The first
attempt bolted an extra exponent onto `catchability`, which already appears
inside `readiness`; the objective's own test caught it as a violation of
"contains all three temporal layers exactly once" and was right to.

The principled form groups the readiness factors by the QUESTION they answer
rather than by which model produced them:

```text
proposalUtility =
    settledIncomingQuality ^ 1
  x (projectedOutgoingQuality x speedFit x airFit
     x impactFeasibility x elevationFit) ^ 1
  x catchability ^ 2
```

`catchability` ADMITS the next arc — it is the dead-end predictor, and dead ends
are what the search pays for in backtracking. The other four GRADE it, which is
the question `projectedOutgoingQuality` already asks. Every factor still appears
exactly once and neutral exponents reproduce `settled x projected x readiness`
algebraically, which a test now asserts directly.

**The screen (TTC, 3 seeds, mean).** First arm of the campaign with no downside
anywhere:

```
                              500k budget        default    previous
frontier_pickup_progression_shifted              296k       2/3 seeds never
dense_dialogue_impact_contrast_10                246k       302k
dense_dialogue                                   262k       268k
frontier_low_air_endurance_7s                    213k (3/3) 2/3 seeds never
amplitude_tides            (healthy control)     170k       197k
countercurrent             (healthy control)     194k       213k
high_air_drive             (healthy control)     185k       205k
loose_pocket               (healthy control)     196k       223k
frontier_pickup_progression      @1.5M           330k       486k   (base 342k)
```

Two specs recover a seed that previously never completed, and the healthy
controls improve 10–14% as well — this is not a capability-vs-representative
trade.

`frontier_dense_recovery` remains unresolved. It completes on two of three seeds
either way, at 1.0–1.5M frames against the baseline's 470k, and a 1.5M probe
budget is the same order as its completion frame, so that comparison is noise
and is reported as such rather than counted as a win.

The exponent sweeps that led here, for the record (TTC on
`frontier_pickup_progression` @1.5M, mean of 3 seeds): readiness exponent
0.5 → 610k, 1 → 486k, 1.5 → 349k, 2 → 373k, 3 → 331k; feasibility exponent
1 → 486k, 1.5 → 301k, 2 → 330k, 3 → 320k. The sign is unambiguous and the
optimum is broad, which is what a real effect looks like rather than a tuned one.

### 2026-07-25 — the dense_recovery trade, resolved at a budget that can see it

The screen reported `frontier_dense_recovery` as unresolved because a 1.5M probe
budget is the same order as its completion frame. Re-run at 3M, where both arms
can actually finish, it resolves — and not in the new default's favour:

```
                                       previous product      feasibility^2
frontier_dense_recovery            3/3, mean  917k        3/3, mean 1557k
  per seed                     1595k / 667k / 490k    2040k / 1007k / 1624k
frontier_dense_recovery_240ms_figures  2/3               3/3, mean 2047k
  per seed                     563k / none / 2184k     870k / 2794k / 2476k
```

So the feasibility weighting is not free. It helps every other spec measured,
healthy and capability alike, and it converts the 240ms variant from 2/3 seeds
to 3/3 — but it costs `frontier_dense_recovery` roughly 70% more frames to
reach its first completion.

**Why this is still the right default, stated as a judgement and not as a
measurement:** at benchmark budgets neither arm completes that spec at all.
Both need ≳0.9M frames and the top tier is 750k, so the slowdown is invisible to
the score, while the gains elsewhere are not. That reasoning would flip
immediately if the suite gained a budget tier above 1M, and it is recorded here
so the trade is re-examined rather than inherited if that happens.

### 2026-07-25 — N=48 #3 rejects the feasibility weight, and indicts the instrument

```
headline delta -25.25   SE 1.74   95% [-29.82, -20.68]     (previous arm -15.33)
validity 6227 -> 5951   (gained 22, lost 298; previous arm lost 372)
strata
  representative      -10.29   was +9.93
  legacy_regression   +10.55   was +30.56
  development_music   -28.83   was -12.61
  capability         -117.71   was -164.65
largest regressions  dense_recovery_240ms -306.64 (valid 116->20/144)
                     dense_recovery       -264.11 (valid 109->20/144)
                     dense_dialogue       -101.29 (valid 144->119/144)
```

The arm did exactly what it was designed to do. Every completion measure
improved — 74 fewer lost runs, `frontier_dense_recovery` from 8 to 20 of 144
valid, its 240ms variant from 10 to 20, `pickup_shifted` from 85 to 110, the
capability stratum up 47 points. And the headline got 10 points worse, because
score fell everywhere else.

**Over-weighting admission makes the search prefer arcs that land safely over
arcs that score.** A completed track that misses its axes is worth less than the
axes are. That is a coherent, predictable consequence of the change, and it was
invisible to every screen that selected it.

**The instrument was the mistake, not the knob.** `first_completion_frame` ranks
how fast a spec finishes; the benchmark scores how well it finishes. The two
agree while a spec is failing to complete at all — which is why TTC diagnosed
the deficit correctly — and diverge exactly when an arm starts trading quality
for completion, which is what this arm did. Eight specs improving on TTC with no
downside anywhere looked like an unambiguous win and was measuring half the
objective.

TTC keeps its place as a *diagnostic* for why a spec cannot finish. It is not a
selection criterion, and no arm should be promoted on it again without a paired
quality measure.

**Kept:** the role split itself, at the neutral exponent. Grouping the
objective's factors by the question they answer is clearer than grouping them by
which model emitted them, and at exponent 1 it is the same product — but the
identity is ALGEBRAIC, not bitwise. The regrouping changes multiplication order,
so results differ in the last ulp and the search takes a different path:
`pickup_progression` TTC 319k/305k/345k against 513k/396k/549k before the split.
This tree is therefore NOT the one N=48 #2 measured, and is being measured in
its own right rather than inheriting that result.

### 2026-07-25 — N=48 #4: an algebra-preserving regroup costs 14 points

The role split was re-measured at its neutral exponent, expecting the same
compiler written more clearly. It is not the same compiler:

```
delta -29.34  [-33.84, -24.83]        vs -15.33 unsplit, -25.25 weighted
strata  representative -10.75 | capability -137.67 | legacy +3.13 | music -29.50
validity 6227 -> 5945
```

The regrouping is algebraically exact. Verified over two million random inputs:
61% differ between the two associations, maximum relative difference **8.0e-16**
(~3.6 ulp). That is the entire semantic content of the change, and it moved the
headline 14 points — **seven times the seed-block SE** — because ranking ties
break differently and the search walks a different tree.

Reverted; the restored product is bit-for-bit the tree N=48 #2 measured
(`pickup_progression` TTC 513010/396401/548736, identical).

**The corollary applies to every number in this campaign.** A 14-point swing can
be produced with zero semantic content. The confidence interval measures seed
variance; it does not measure how much of a delta is the search landing in a
different basin. Deltas of this magnitude are therefore weak evidence about a
mechanism unless the change is bit-level inert or the effect is much larger.

### 2026-07-25 — the ballistic layer was never priced; pricing it paid 44x

A history survey of the predictor chain turned up a single structural fact:
**every predictor generation was chosen on error ratio alone, and cost was never
measured once.** The written rule was "adopt when the frozen-corpus score is at
least 1% lower". Under it, three successive models shipped — point-mass parabola
(1.19 px), articulated assembly (0.52 px), exact 22-constraint kernel
(0.047 px) — each strictly more expensive than the last. A fourteen-model panel
of cheap closed-form alternatives was built on 2026-07-23, compared on error,
and deleted **without ever being timed**. The first per-prediction timing in the
project's history was taken on 2026-07-25, six days and four commits after the
exact kernel shipped.

The rule was also self-sealing. Once the kernel reached zero error the score
divided by zero, every alternative scored `Infinity`, and `decision` could only
answer `keep_current`. A cheaper model was unreachable by construction.

**What pricing it revealed.** Per frame the kernel costs 1.92–2.06 us against
the engine's 1.47–1.70 — 1.3x MORE. Its real advantage was that its frames were
never charged to the frame budget: 31.5% of everything the compiler simulated
was unbilled, up to 0.92 unbilled per billed on air-heavy specs, sitting
directly on the axis the suite varies to test scaling.

**The replacement.** In free flight every constraint moves its two points
equally and oppositely, there are no masses, and the joints only read positions,
so the ten-point system centre is exactly ballistic — residual 1.1e-13 px/frame.
The 135 solves per frame buy only the rider-vs-system difference. Carrying the
rider on its launch offset, and taking sled-pose rate from conserved angular
momentum rather than a two-point difference (12.76 -> 4.64 deg), gives:

```
                  ns/call   posMAE    speedMAE   angleMAE
exact kernel       19,806    0.000     0.0000      0.00
closed form           451    0.58 px   0.034       0.20      44x cheaper
do nothing            233  173.65 px   0.732      14.29
```

**Adopted at parity, which is the correct bar** — a worse predictor cannot beat
a perfect one, so an apparent gain is the search finding a different basin.
24 seeds: headline 494.91 -> 494.63, delta -0.28, SE 2.50, 95% [-7.00, +6.44];
no stratum significantly different; validity flat. Micro-sim frames: zero.

Known cost, checked rather than assumed: `frontier_pickup_progression` stalls
more often (750k: 3/24 vs 0/16). The failure mode is IDENTICAL in both —
`terminus:rideStalled` on a marginal-energy track the kernel itself fails 15/16
times at 250k — so it is the same margin crossed more often, not a new
mechanism.

### 2026-07-25 — readiness had been training on a distribution that no longer existed

Independent of the above, and a latent defect: the readiness corpus carries a
sampler fingerprint over the whole proposal path, and the guard had been
refusing to load it since the overnight rework. **Every readiness number the
compiler acted on came from a model fitted to inputs it no longer saw.**
Recollected and retrained; measured alone, with the predictor unchanged, it was
worth +7.34 headline and took `legacy_regression` from significant (-5.98) to
not (-3.13).

### 2026-07-25 — the extractor and the model are now separate lists

Removing a feature from the readiness model used to require editing the
extractor, which the corpus guard fingerprints, which invalidated the corpus,
which can only be rebuilt by running the compiler, which needs a model matching
the extractor. Feature selection was impossible without a hand-written bootstrap
artifact or weakening the guard.

`READINESS_FEATURE_NAMES` now says what the compiler can OBSERVE; an artifact's
`featureNames` say what it USES. Compatibility requires only that every column
exists in the extractor and appears once; `infer` projects. This is not weaker —
unknown and repeated columns are still rejected, and `featureTransformId` still
binds a column's meaning. Feature-selection experiments now cost a retrain.

First use: the 8 `articulation:*` features are gone from the model (at most
0.75% OOF, two components BETTER). They were the one output the closed-form
predictor cannot supply at all — 0.0463 against the do-nothing model's 0.0453.

### 2026-07-25 — instrument lessons worth more than the result

1. **A metric that ranks completion does not rank quality.** `first_completion_frame`
   diagnosed the capability deficit correctly and cheaply, then selected a
   losing arm, because it measures how fast a spec finishes rather than how well.
   Diagnostic, never a selection criterion, without a paired quality measure.
2. **A 14-point headline swing can have zero semantic content.** An
   algebraically exact regrouping of `proposalUtility` cost 14 points at N=48 —
   7x the seed-block SE — purely through last-ulp reassociation changing which
   ranking ties break. The confidence interval measures seed variance; it does
   not measure which basin the search landed in.
3. **The `capability` stratum cannot rank arms at these seed counts.** Its CI
   spans +/-60 and it inverted the ranking between the two best arms we measured.
   Judge on `representative` and validity.

### NEXT CAMPAIGN — `frontier_dense_recovery`: the outstanding capability debt

Named here so it is inherited deliberately rather than forgotten. This is the
largest single prize left, and it is worth more than any remaining ballistic
accuracy.

**The debt.** When the contact-indexed compiler was promoted as the canonical
baseline, one regression was accepted as documented debt rather than fixed. Two
specs — `frontier_dense_recovery` and its 240ms variant — went from 46-48 of 48
valid at 500k/750k to 3-6, and account for ~200 of the lost runs. At 250k the
OLD baseline itself passed them only 15-20 times in 48, so that tier was always
a coin flip; at 500k and 750k it was deterministic, and that is the real loss.

**What is already known** (do not re-derive):

- It is **not a capability loss, it is an efficiency loss.** Given budget, the
  compiler completes `dense_recovery` — it just needs ~1.42M frames where the
  old baseline needed ~334k. That is 4.25x slower to the first complete track,
  which drops it below two of the three budget tiers.
- The shape is **cumulative drift, not a wall.** Per-gap landing rate tracks the
  old baseline within 1.5 points for twenty gaps, then separates (41.5 -> 28.8
  in the 20-39 band) while the baseline holds 41-50% out to gap 109. There is no
  single impassable gap; each committed arc leaves the rider slightly worse
  placed and it compounds. Short specs never accumulate enough to show it, which
  is why `representative` and `legacy_regression` are ahead.
- Cost per look is fine; **yield per look is not.** Frames per candidate
  evaluation are flat (15.4 vs 15.6); looks per committed contact rose 124 ->
  206.
- **Ten hypotheses are already falsified** — see the falsification list in
  `docs/BALLISTIC_READINESS_DECISIONS.md` §5. Re-deriving any of them costs
  hours.

**Instrument warnings, learned the hard way.** `first_completion_frame` (TTC) is
the natural metric here and it is a good DIAGNOSTIC — but it ranks how fast a
spec finishes, not how well it scores, and it selected a losing arm when used
alone. Pair it with a quality measure. And note the `capability` stratum cannot
rank arms at low seed counts (CI +/-60); judge on `representative` and validity.

**Framing for whoever picks this up:** the deficit is a search-efficiency loss
with a cumulative-drift signature, on specs long enough for drift to compound
past the budget. The question is not "why can't it do this" but "why does each
committed arc cost slightly more than it should, and what would make the search
notice".

### 2026-07-23 cheap-model panel — recovered from a gitignored artifact

Fourteen closed-form models were built, compared, and deleted without ever being
timed; their absolute figures appeared in no document. Recovered here from
`generated/analysis/ballistic-v2-all44-all-budgets-s735656107.json` (112 MB,
gitignored) so the artifact itself is disposable. All against engine truth,
44 cases x 3 budgets:

```
model                                     pre pos   contact pos   velMAE  angleMAE
assembly_frozen_relative                    0.390        0.453    0.1153     0.496
assembly_damped_tau4  (= production_artic)  0.419        0.520    0.0537     0.200
assembly_damped_tau6/8/12/16                0.419        0.520    0.055-0.068
assembly_rotating_position_center_velocity  0.419        0.520    0.0598     0.220
assembly_rotating_angle                     0.419        0.520    0.1022     0.373
assembly_rotating_velocity                  0.460        0.551    0.1045     0.397
body_displacement                           0.840        0.952    0.1038     0.423
body_recent_weighted                        0.958        1.067    0.1149     0.486
assembly_linear_relative                    0.979        1.073    0.1153     0.496
production (point-mass parabola)            1.082        1.188    0.1190     0.510
assembly_center                             1.291        1.363    0.0598     0.220
```

Two things this settles.

**The adopted "articulated" model was `assembly_damped_tau4`** — one of the
panel, promoted on a 58.84% error reduction with no cost column.

**An open lead, recorded not pursued.** Our shipped `closed_form_system` is
0.560 pre / 0.583 contact on position — WORSE than several of these (best
0.390/0.453) while matching the best on velocity (0.053) and angle (0.200). The
difference is the relative-velocity treatment: we freeze the rider's launch
offset, which is the tau -> infinity limit, whereas `assembly_damped_tau*` decays
the relative velocity as exp(-dt/tau). Adding that decay would likely close most
of the position gap and stay O(1).

It is **not** being pursued, deliberately: the closed form is already at compiler
parity, so there is nothing for better position accuracy to recover, and the
readiness model has since been retrained on the inputs it actually receives —
so improving them would require another retrain merely to express itself. This
is here for whoever has a reason to want the accuracy back.
