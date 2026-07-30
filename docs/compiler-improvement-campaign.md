# Compiler Improvement Campaign

Target: accepted Benchmark V2 development headline above 650, then continue
pushing the same broad compiler laws as far as the evidence supports.

Current active campaign baseline:
`postcompletion-aim-center-reuse-750k`, headline **587.0568** at 750k/N=48,
2112/2112 valid. It is a zero-compile projection of the accepted
`postcompletion-aim-center-reuse` archive. The frozen 250k/500k/750k baseline
remains intact at 571.0840, but 250k and 500k are temporarily deferred from
the official optimization headline.

All campaign acceptance runs are now 750k/N=48 only (2,112 candidate
compiles). Compiler mechanisms must still scale continuously through 150k and
1M-3M; no budget-identity branching or acceleration-line work.

| baseline | canonical | evidence |
|---|---:|---|
| `steep-arrival-default` | 507.33 | N=48 +11.29 |
| `dive-span-floor` | 528.69 | N=48 +18.30 |
| `segment-refine` | 532.40 | N=48 +2.01 |
| `paced-forward-eval-width` | 541.57 | N=24 +10.66 [+5.13, +16.19] |
| `paced-aim-lane` | 548.54 | N=8 +6.97, three strata exactly 0.00 |
| `readiness-catch-impact` | 553.73 | N=24 +6.05, promotable, validity 3089→3131 |
| `pool-five` | 557.05 | N=24 +4.18, promotable, every stratum and budget positive |
| `scarce-lean` | 558.63 | N=24 +1.00 [-0.71, +2.70]; 500k/750k exactly 0.00 by construction |
| `span-handover` | 559.75 | N=24 +0.65 SE 0.27, ACCEPT/promotable, every stratum and budget positive |
| `breadth-law` | 560.85 | N=24 +1.24 SE 0.27 [+0.49, +1.98], ACCEPT/promotable; a law, not a refit |
| `fitted-law-command` | 568.28 | N=24 +5.57 SE 1.45 [+1.62, +9.51], ACCEPT/promotable; two unfitted constants fitted |
| `air-matched-breadth-law` | 572.67 | N=8 +4.39 SE 1.46, one-sided lower +0.39; all-base air matching plus linear aim refinement |
| **`postcompletion-aim-center-reuse`** | **571.08** | **N=48 +0.0842 SE 0.0217, 95% CI [+0.0271,+0.1413]; exact center-row reuse after first completion** |

### What 650 now requires

`study_headline_counterfactual.ts` now accepts `--budgets=750000`, so it can
replay the active projected scope rather than silently pricing the frozen
three-budget ladder. On the accepted N=48 archive it reproduces **587.0568**
exactly:

| counterfactual | 750k headline | delta |
|---|---:|---:|
| every seed scores its cell's BEST | 603.31 | +16.25 |
| every run scores its cell's MEAN | 587.17 | +0.11 |
| impact rms x0.75 / **x0.70** / x0.5 | 640.94 / **651.69** / 693.22 | +53.89 / **+64.63** / +106.16 |
| air rms x0.75 / x0 | 597.26 / 612.28 | +10.20 / +25.23 |
| speed rms x0.75 / x0 | 592.93 / 600.85 | +5.87 / +13.80 |
| amplitude rms x0.75 / x0 | 592.39 / 600.88 | +5.33 / +13.82 (576 runs) |

There is no validity prize left at this operating point: all 2,112 runs are
valid. Best-seed reliability cannot reach 650 either. No non-impact axis can
reach it even if its error disappears entirely. The single-axis scale of the
new target is therefore about a **30% reduction in impact RMS**; combinations
remain possible, and 650 is a milestone rather than a ceiling.

The raw accepted residuals make the direction sharper:

| axis | observations | rms | mean achieved-target | undershoot |
|---|---:|---:|---:|---:|
| impact | 194,688 | 0.2110 | **-0.1589** | **92.38%** |
| air | 194,688 | 0.1099 | +0.0547 | 22.74% |
| speed | 194,688 | 0.0743 | **-0.0055** | 48.51% |
| amplitude | 47,328 | 0.2303 | -0.1230 | 82.13% |

Speed is already centered. A useful impact mechanism therefore cannot simply
raise physical speed everywhere; it must preserve the gap mean or buy back the
speed error elsewhere.

The old delivery-curve shape also survives on the new baseline. Asks in
0.20-0.35 and 0.35-0.50 deliver only 50.9% and 53.5% of the request while their
mean feasibility bounds are both about 0.55; together they carry 30.4% of
impact SSE. Asks at 0.65+ carry 60.0% of impact SSE, but their mean bounds
(0.58) are below their mean asks (0.72/0.87). The phase study must therefore
separate addressable delivery from bound-limited demand; a universal arrival
boost would repeat the rejected carrier mistake.

## 2026-07-30 — research reset: speed is an integral constraint, not a phase command

**Primary hypothesis.** If a gap asks for speed 0.5 but its ending impact is
more deliverable with arrival speed 0.6, the compiler may deliberately seek
0.6 in the impact-relevant late approach and compensate with approximately 0.4
elsewhere. The evaluator sees the realized arithmetic mean over the complete
inclusive gap, so a compensated physical profile can score 0.5 while presenting
more kinetic speed to the ending catch. The numbers are illustrative; the
mechanism must derive its allocation from physical state, authored asks, phase
lengths and feasibility.

This is **temporal allocation under a whole-gap constraint**, not a compiler
target rewrite. The exact evaluator target remains 0.5.

### What the code already does

- Speed is the arithmetic mean of every measured `|velocity|` from
  `gap.startFrame` through `gap.endFrame`, grounded and airborne alike. Air is
  the airborne-frame fraction over the same inclusive interval.
- Impact is event-local: incoming CoM speed one frame before the ending contact
  times the net heading change through contact +6.
- Generation nevertheless feeds one scalar speed ask into several different
  jobs: brake/acceleration and carry pressures, contact and post angles, the
  energy-shaped launch, and speed-relative elevation. That is the coupling a
  phase allocator would have to separate.
- `STEEP_ARRIVAL` already uses the following contact's impact ask to shape the
  outgoing launch. It raises the probability of a steep, fast arrival, but it
  neither represents nor closes a compensated speed budget.
- The local aim model already predicts **both quantities needed for this
  experiment**: `next.meanSpeedPx` and the projected next-contact state,
  including arrival speed and angle. Its two normal coordinates are
  `tail_pitch` and `post_contact_pitch`. The proposal objective currently reads
  the whole-gap mean, air and elevation, but not arrival speed; the full ranker
  sees a learned impact-feasibility signal only after a candidate has been
  proposed and exactly evaluated.

That last boundary is the most concrete untapped potential: the compiler
already observes a local response surface containing whole-gap mean and arrival
speed, but its proposer never asks whether a point on that surface preserves
the first while improving the second.

### What the old negative result did and did not test

The 2026-07-28 endpoint-speed arm raised the compiler's scalar speed target.
Arrival surplus rose 0.10 -> 0.71 px/frame and contact speed 10.70 -> 11.22,
while delivered impact stayed 0.366 -> 0.367 because all the speed-conditioned
contact pressures re-centered on the higher scalar ask and incidence fell.
Smaller mean-target and energy-cost arms agreed.

Keep that as a boundary: a scalar target lift is not the lever, and
cross-sectional arrival-surplus correlations are not causal. It does **not**
test a fixed-mean phase exchange. No arm held the exact whole-gap mean near its
authored value while independently varying arrival speed, nor did one use the
existing two-output response surface to propose such pairs. The later
descent-cap null likewise asked search to discover the exchange incidentally;
it did not place a compensated Pareto candidate in the pool.

### Study sequence before a compiler candidate

1. **Final-trajectory phase audit, N=48/750k.** Regenerate the fixed accepted
   schedule and retain compact per-gap
   moments: exact whole mean, arrival speed at -1, grounded and airborne means,
   release frame, early/middle/late speed sums, air, incidence, delivered
   impact and every axis residual. The accepted archive retains per-gap means
   and track hashes, but neither track geometry nor frame trajectories, so it
   cannot answer the phase question. Use associations only to size the
   experiment, never as causal evidence.
2. **Frozen-state response/Pareto assay.** Reuse the arc-control study harness
   on representative current compiler states. Enumerate the existing
   `tail_pitch × post_contact_pitch` response surface without changing the
   compiler judge. For each base, ask whether an exactly evaluated candidate
   can increase next arrival speed while keeping next mean-speed error no worse,
   preserving air/current quality and surviving. Report coverage by impact ask,
   speed ask, air ask, gap duration, ride/flight share and source family.
3. **One-contact causal transfer.** Continue matched base and compensated
   candidates through the next catch. Measure delivered impact, incidence,
   speed loss through +6, all axes and validity. This is the decisive guard
   against repeating the old cancellation: arrival speed is useful only if the
   next catch converts it into `v * delta-theta`.
4. **Compensation-location grid.** If transfer exists, compare where the offset
   is paid: supported ride, launch/transit, or a mixture. Vary arrival surplus
   and compensation strength continuously. Select from a Pareto frontier; do
   not install a fixed `0.6/0.4` schedule.
5. **Only then, proposer candidate.** Emit a small number of compensated
   Pareto proposals while leaving ordinary candidates, exact evaluation and the
   canonical ranker unchanged. Publish or reject only with the official
   cache-backed N=48/750k comparison.

The mechanism is falsified early if the current controls cannot produce arrival
surplus at fixed mean, if exact simulation erases the modeled exchange, if the
next catch gives the speed back as reduced incidence, or if the exchange merely
moves error into air/amplitude/adjacent gaps. A positive result must be broad
across continuous physical strata, not driven by named cases.

Any compute-dependent policy remains a scale law over work and physical
opportunity, checked at 150k, 750k and 1M-3M. Budget identity must not enter the
compiler. Acceleration/kinematic-line work remains deferred.

Accepted this session, both on one mechanism — the steep-arrival dive:

| baseline | canonical | N=48 delta | evidence |
|---|---:|---:|---|
| `accept-2026-07-25T15-30-00Z-closed-form` | 498.91 | — | previous |
| `steep-arrival-default` | 507.33 | **+11.29** [+7.49, +15.09] | dive at every attempt, whole span |
| `dive-span-floor` | **528.69** | **+18.30** [+13.67, +22.94] | ask floor deleted, span floor 0.5 |

Qualification monitor 394.17 → 399.50 → 404.04, at 120/120 valid throughout.

The declared canonical profile remains exactly eight seeds per budget and
disjoint from the three-seed probe profile. A promotion from fixed-N evidence
now retains the accepted deeper prefix as the baseline cache itself; the
current baseline therefore publishes `[0,48)` rather than throwing away 40
measured slots. Profile-level disjointness still applies to the first eight
canonical slots, while fixed-N tail slots retain their literal schedule.

The previous long-form campaign log remains recoverable from repository
history; older material is also under `docs/archive/`. This file now follows
the concise hypothesis/evidence/decision format required by `goal.md`.

## 2026-07-29 — ACCEPTED: air matching inherits the breadth law

**Hypothesis.** The last 24 hours' largest gains came from stale ceilings:
ordinary per-gap generation now scales 27/54/81, but the aim lane still refined
six bases at every canonical budget, and only its first base emitted the
deterministic air-matched ride-out. The exact ranker can admit narrowly from a
broader set of release solutions, so emit air matching for every already-refined
base and scale non-low-air refinement linearly from six bases at 250k:
6/12/18. The accepted low-air cap of three remains fixed.

**Evidence.** Focused optimizer tests passed (4 files, 48 tests). Canonical N=2
screening took about 2m25s per arm: all-base air matching +6.75; two bases only
+0.68; all-base plus linear K +7.80; sqrt K (6/8/10) +5.77. The exact N=8
comparison took 8m22s:

| result | headline | delta | 250k | 500k | 750k | valid |
|---|---:|---:|---:|---:|---:|---:|
| `air-allbases-linear-aimk-n8` | **572.67** | **+4.39** | +2.98 | **+5.25** | **+3.90** | 1046/1056 |

Seed-block SE 1.46, one-sided lower bound +0.39; representative +5.15
[+2.96,+7.34]. Validity changes only in the already-marginal 250k frontier
(4 gained, 5 lost); both mature budgets remain 352/352 valid. Qualification
407.57 -> **410.94**, 120/120 valid.

**Neighbor brackets.** The old air mismatch gate remains at an interior optimum
(0.05 +2.66 and 0.15 +0.17 versus 0.10 +6.75 at N=2). Four search children are
parity (+7.76 versus +7.80), pool four loses (+6.02 and one extra invalid),
delivery efficiency 1.00 loses (+2.45), and scaling the low-air K cap loses
(+7.22 with direct endurance regressions). A semantic forward-value memo was
byte-identical despite 132k hits; terminal-air occupancy conventions lost
-8 to -11; start width 24 concentrated a noisy gain at 250k but lost mature
quality; paced brake suppression lost validity. Retired.

**Decision.** Promoted as `air-matched-breadth-law` from the exact N=8 snapshot.
The general mechanism is the same one that paid yesterday: generate wider,
admit narrowly, and remove a budget ceiling only where the work unit has fixed
per-gap cost. Next: reduce the now-priced +19.48 seed/basin spread; no
acceleration-line work.

## 2026-07-30 — RETIRED: low-discrepancy launch/length tail

**Hypothesis.** Once the accepted breadth law grows the ordinary pool past its
historical 16-attempt profile, later attempts should cover launch and ride-out
length jointly instead of repeating the same profile. Attempts 0--15 stayed
byte-identical; attempt 16 onward used a deterministic, non-repeating R2
sequence. The mechanism had no benchmark rung, case identity, or candidate-count
ceiling.

**Evidence.** Focused optimizer tests passed (4 files, 72 tests). The full N=48
comparison took about 53 minutes including checkpoint resume after the host
reboot:

| result | headline | delta | 250k | 500k | 750k | valid |
|---|---:|---:|---:|---:|---:|---:|
| `r2-profile-tail-n48` | 568.52 | **-2.48** | +0.93 | **-5.19** | -0.25 | 6253/6336 |

Seed-block SE 1.24, 99% central interval [-5.79,+0.82]. Representative was
flat (+0.04), but capability fell -14.43 and validity moved 31 gained / 36
lost. The broader coordinate basis therefore did not become broader *physical*
coverage in the nonlinear generator; this independently confirms the earlier
Halton-prefix observation.

**Decision.** Retired and source-reverted. N=48 baseline cache coverage is now
published for slots 0--47, so subsequent candidates compile only their 6,336
candidate cells. Candidate evaluation now uses N=48 only.

## 2026-07-30 — RETIRED: branch-lineage proposal streams

**Hypothesis.** Sibling prefixes previously replayed the same normalized
`(searchSeed, gapIndex)` proposal coordinates. A deterministic lineage derived
from committed attempt identities should make ordinary frontier branches cover
different basins without adding candidates. The root stream stayed historical;
the rule had no budget, case identity, or candidate-count ceiling.

**Evidence.** Focused optimizer tests passed (4 files, ultimately 71 tests).
Three paired N=48 comparisons separated the mechanism from rollout and repair
stream interactions:

| formulation | delta | 250k | 500k | 750k | representative | capability |
|---|---:|---:|---:|---:|---:|---:|
| lineage in frontier and rollouts | +0.97 | +5.96 | -0.13 | -0.51 | -0.83 | +10.87 |
| common rollout streams | +1.45 | **+10.99** | -0.76 | -1.22 | -1.51 | **+17.11** |
| common rollouts, historical repair | **+1.71** | **+11.19** | -0.59 | -0.79 | -1.25 | **+17.16** |

The best formulation scored 572.71 versus the deep baseline 571.00, SE 0.80,
99% central interval [-0.41,+3.82], and remained inconclusive/non-promotable.
Validity moved 6258 -> 6281 (49 gained, 26 lost), entirely at 250k. The gain
was dominated by `frontier_pickup_progression_shifted`; mature budgets and the
representative stratum remained negative. Keeping common rollout coordinates
required cache isolation by resolved proposal seed; a focused regression test
caught and fixed the otherwise call-order-dependent rollout/frontier cache.

**Decision.** Retired and source-reverted. This larger current-baseline N=48
read confirms the older prefix-conditioned-sampling panel: diversification can
recover a scarce rapid-pickup basin, but it is not broad reliability. Repair
already supplies fresh deterministic seeds, and further stream-policy tuning
would be adapting to one capability family rather than improving the compiler.

## 2026-07-30 — RETIRED: measured residual air correction

**Hypothesis.** The accepted closed-form air matcher assumes a one-to-one
release response. Its first exact evaluated fit supplies a measured response:
when that fit reduced absolute projected air error but remained outside the
ordinary 0.05 deliverability deadband, offer one further residual correction
from the fit's own ballistic launch. This added at most one deterministic,
fixed-cost candidate per already-refined base and inherited the accepted linear
aim-base budget law; it had no case, benchmark-rung, or acceleration logic.

**Evidence.** Focused optimizer tests passed sequentially (5 files, 86 tests).
The N=48 candidate-only comparison took 46m54s:

| result | headline | delta | 250k | 500k | 750k | valid |
|---|---:|---:|---:|---:|---:|---:|
| `air-residual-correction-n48` | 567.97 | **-3.03** | -0.01 | -1.52 | **-7.57** | 6253/6336 |

Seed-block SE 1.20, 95% central interval [-6.19,+0.13], one-sided upper
-0.18: not better than baseline. Representative (+0.06), legacy (+0.26), and
development music (+0.14) were near parity, but capability fell -20.71. The
loss was concentrated in mature tight catches:
`frontier_pickup_progression_shifted` fell -81.82 and lost five valid runs.

**Decision.** Retired and source-reverted. A first-pass reduction in projected
air error does not establish a convergent physical tail-length response; the
second correction over-controls the geometry precisely where mature catches
are tight. The accepted one-pass matcher remains the boundary.

## 2026-07-30 — RETIRED: scale-relative rescue breadth

**Hypothesis.** Ordinary generation now follows the accepted linear breadth law
(27/54/81 at canonical budgets), while dead-end and short-deadline rescue
remained fixed at their 250k counts. Preserve each measured rescue/ordinary
ratio and scale only deterministic rescue generation with ordinary breadth;
keep admission fixed. The same law extends without a ceiling to 150k and
1M--3M, and the 250k compiler stays exact.

**Evidence.** Focused tests passed in an isolated accepted-source worktree
(69 tests). The candidate was then frozen and evaluated from the cache-owning
worktree at N=48, taking 46m48s:

| result | headline | delta | 250k | 500k | 750k | valid |
|---|---:|---:|---:|---:|---:|---:|
| `scale-relative-rescue-n48` | 567.88 | **-3.12** | +0.00 | -1.63 | **-7.68** | 6252/6336 |

Seed-block SE 1.20, 95% central interval [-6.27,+0.04], one-sided upper
-0.28: not better than baseline. The reference 250k configuration reproduced
to +0.004, while capability fell -20.74 at mature budgets. Six valid runs were
lost, dominated by `frontier_pickup_progression_shifted` (-81.82, five losses)
and `frontier_dense_recovery_240ms_figures` (-14.93, one loss).

**Decision.** Retired and source-reverted. Rescue is not ordinary generation:
once the main pool is already 54/81-wide, multiplying emergency retries
displaces completion work and changes marginal tight-catch paths. The fixed
rescue dose is a protective selection boundary, not an untapped breadth
ceiling; do not revisit with a smaller fitted ratio.

## 2026-07-30 — RETIRED: support-time coverage ablation

**Hypothesis.** All-base air matching may have superseded the older
support-time candidate family. Disable that family by default while preserving
its physical deficit calculation and the independent kinematic lane exactly;
the ablation removes work only from the six low-air/sparse families where the
legacy lane still runs.

**Evidence.** Focused tests passed (4 files, 67 tests). The candidate-only N=48
comparison took 47m24s:

| result | headline | delta | 250k | 500k | 750k | valid |
|---|---:|---:|---:|---:|---:|---:|
| `support-ablation-n48` | 555.28 | **-15.72** | -14.93 | -17.11 | -13.93 | 6150/6336 |

Seed-block SE 0.54, 95% interval [-17.13,-14.31]. Capability fell -101.47
and validity lost 108 runs, with no gains. The mechanism is direct:
`frontier_low_air_endurance_7s` lost 79/144 valid runs and fell -550.70;
the 6s variant lost 29 and fell -410.18. Representative also moved
significantly negative (-0.72), while unaffected strata stayed exactly zero.

**Decision.** Retired and source-reverted. The lane's low selection count was
misleading: its support geometry is a completion prerequisite on long grounded
ride-outs, not redundant tail diversity. Preserve it at every budget; the
all-base air matcher complements rather than supersedes it.

## 2026-07-30 — RETIRED: post-aim air matching

**Hypothesis.** The accepted aim controller and closed-form air matcher each
improve a different part of the same arc, but the air slot currently edits the
raw sampled base before aim. Keep exactly one air-match attempt per refined
base and source it from the quality-best exactly evaluated aim proposal,
falling back to the raw base only when no aim proposal survives. This composes
the controls without extra simulation, RNG, budget thresholds, or acceleration
logic; fixed work per refined base inherits the accepted scale-free K law.

**Evidence.** Focused tests passed (4 files, 67 tests). The candidate-only N=48
comparison took 49m38s:

| result | headline | delta | 250k | 500k | 750k | valid |
|---|---:|---:|---:|---:|---:|---:|
| `postaim-airmatch-n48` | 567.19 | **-3.81** | -2.74 | -5.03 | -2.50 | 6245/6336 |

Seed-block SE 1.24, 95% interval [-7.08,-0.55]. Every stratum moved negative:
representative -1.02, capability -18.61, legacy -2.70, and development music
-0.71. Validity moved 6258 -> 6245 (30 gained, 43 lost). The largest losses
were shifted pickup (-67.82), pickup (-21.88), 7s low-air endurance (-28.05),
and dense-240 recovery (-7.16).

**Decision.** Retired and source-reverted. Pitch/rotation aiming and tail-length
air correction are not separable controls merely because each succeeds alone:
the aimed geometry changes the release/catch basin on which the closed-form
tail edit acts. Keep the accepted one-pass matcher on the raw refined base.
Do not retry source blends or post-aim residual variants.

## 2026-07-30 — RETIRED: extra air-only breadth

**Hypothesis.** The accepted quality-ranked refinement band may leave useful
raw bases unexplored by the cheap exact air matcher. Give a second,
equally-sized quality-ranked band air matching only, keeping the aim:air work
ratio at 1:2 under the same continuous structural-slack activation and
low-air cap. This adds no acceleration logic and scales with the existing
150k–3M breadth law.

**Evidence.** Focused policy tests covered the 150k, 250k, 500k, 750k, 1M,
and 3M mappings. The candidate-only N=48 comparison took 47m34s:

| result | headline | delta | 250k | 500k | 750k | valid |
|---|---:|---:|---:|---:|---:|---:|
| `extra-airband-n48` | 570.39 | **-0.61** | -0.06 | -0.64 | -0.92 | 6256/6336 |

Seed-block SE was 0.93 with a 95% interval of [-3.09,+1.87], so the small N=8
gain did not survive the acceptance sample. Representative improved
significantly (+0.90), but capability fell -7.98; validity moved 6258 -> 6256.
The largest regressions were shifted pickup (-28.44, one loss) and dense-240
recovery (-13.68, one loss), outweighing gains in the high-air, dense-contrast,
pickup-lattice, and meter cases.

**Decision.** Retired and source-reverted. The second band finds some useful
representative diversity, but at mature budgets it displaces stronger
completion paths and loses capability validity. Preserve the accepted
single-band air matcher; do not infer promotion from the earlier N=8 result.

## 2026-07-30 — RETIRED: traversal-slack future weighting

**Hypothesis.** A retained N=48 objective sweep had measured settled:future
1:4 at +19.90 for the scarce budget and -10.67 for the plentiful budget.
Express scarcity as `budget / predicted_first_completion_frames`: use that
endpoint through two predicted traversals, then smoothstep back to the accepted
per-spec settled policy and neutral future power by three traversals. This
reproduced the measured scarce endpoint without naming a benchmark budget,
became exactly inert when work was plentiful, and extended unchanged from 150K
through multi-million-frame budgets.

**Evidence.** Focused policy/optimizer tests passed (4 files, 43 tests). The
candidate-only N=48 comparison took 47m46s:

| result | headline | delta | 250k | 500k | 750k | valid |
|---|---:|---:|---:|---:|---:|---:|
| `traversal-future-n48` | 568.64 | **-2.36** | **-13.76** | +0.78 | +0.00 | 6247/6336 |

Seed-block SE was 0.27 with a 95% interval of [-3.09,-1.64]. Validity moved
6258 -> 6247 (25 gained, 36 lost), entirely at 250k. Representative fell
-2.61 and legacy regression -1.90; development music gained +0.71. The largest
loss was 7s low-air endurance (-15.11, one validity loss), while dense dialogue
gained +7.62/+10.75. The high-budget boundary was exactly inert as designed,
and the narrow transition band at 500k was modestly positive, but the historical
scarce-budget sign reversed decisively on the current compiler.

**Decision.** Retired and source-reverted. The old 1:4 endpoint was not a
portable scarcity law: after the steep-arrival and air-matched breadth changes,
future-heavy admission again trades away more scored quality and low-air
completion than it recovers. Structural traversal slack is still the right
scale-free unit for policies that genuinely vary with scarcity, but it cannot
make a stale objective endpoint current. Do not fit a weaker ratio to this
benchmark ladder.

## 2026-07-30 — RETIRED: exact aim center-row reuse

**Hypothesis.** Every refined base was already an exact evaluated candidate
with scorer axes and a confirmed ballistic launch, yet the five-row local aim
fit rode its unchanged zero-control lines again. Reconstruct that center row
from the retained exact fit and closed-form ballistic projection; keep all four
nonzero probes and every proposed candidate on the ordinary exact evaluator.
This removes one duplicated ride per refined base under the existing unbounded
6/12/18 aim law, without changing acceleration, controls, or RNG.

**Evidence.** Exact-output and cross-scale pool-equivalence tests passed at
150k, 250k, 750k, and 3M. The candidate-only N=48 comparison took 49m46s:

| result | headline | delta | 250k | 500k | 750k | valid |
|---|---:|---:|---:|---:|---:|---:|
| `aim-zero-reuse-n48` | 569.32 | **-1.68** | +0.54 | **-3.77** | +0.32 | 6256/6336 |

Seed-block SE was 1.28 with a 95% interval of [-5.09,+1.74]. The saved work
did buy more refined bases (tail-shard totals +5.3%/+6.1%/+6.1% across the
three budgets), and 750k improved significantly by +0.32. Representative
also improved +0.50, with legacy +0.58 and development music +0.21. But
capability fell -13.99: shifted pickup -48.90, dense-240 recovery -24.04,
7s low-air -12.99, and ordinary pickup -10.07. Validity moved 6258 -> 6256
(34 gained, 36 lost), including three losses at 500k.

**Decision.** Retired; the source lived only in the isolated measured
worktree. Exact semantic reuse is not automatically score-monotone under a
frame-bounded search: the extra traversal changes which capability basin owns
the later budget. The positive representative and 750k movements still price
probe efficiency, but do not justify this pure reinvestment path. A distinct
follow-up may amortize a pool-local response across bases only if it treats the
shared model as a proposal prior and retains exact candidate validation.

## 2026-07-30 — ACCEPTED: exact aim center-row reuse after completion

**Hypothesis.** The unconditional center-row reuse above changed the search
basin before the compiler owned a valid full track. Keep the exact historical
probe during completion search, then enable the same semantic reuse only after
`hasCompletion`: reconstruct the unchanged center row from the already-exact
candidate axes and confirmed ballistic launch, while all four nonzero probes
and every proposal continue through exact engine evaluation. The phase gate is
structural rather than budget-based, so the mechanism inherits the existing
aim-breadth law from 150k through 3M and beyond.

**Evidence.** Exact-output and fresh-engine pool-equivalence tests passed at
150k, 250k, 750k, and 3M; the focused optimizer suite passed 70/70 tests. The
candidate-only N=48 comparison was positive at every canonical budget with
validity exactly unchanged:

| result | headline | delta | 250k | 500k | 750k | valid |
|---|---:|---:|---:|---:|---:|---:|
| `postcompletion-zero-reuse-n48` | **571.0840** | **+0.0842** | +0.0329 | +0.1123 | +0.0718 | 6258/6336 |

Seed-block SE was 0.0217, 95% interval [+0.0271,+0.1413], and the one-sided
lower bound was +0.0328. All strata moved positive: representative +0.0862,
capability +0.0302, legacy +0.1483, and development music +0.0920. Validity
was bit-for-bit flat at every budget: zero gained and zero lost.

**Decision.** Promoted as `postcompletion-aim-center-reuse`. The baseline
retains the full accepted `[0,48)` archive at 571.08; the refreshed probe is
563.78 and qualification is 411.10 at 120/120 valid. The publication path was
also corrected to distinguish the declared eight-seed canonical profile from
deeper fixed-N cache tails, allowing accepted N=48 evidence to become the
baseline without weakening profile-level seed disjointness.

## 2026-07-29 — the impact bias, attacked from the delivery curve: the compiler is already right

Impact is not a passive consequence of the flight geometry. Testing that
directly: airborne frames predict achieved impact at only **r = 0.34**, and the
symmetric-ballistic law `redirArc ~ g * airborneFrames` over-predicts (mean
0.486 against 0.378). What achieved impact DOES track is the ask itself, at
**r = 0.816** — far above air (0.23), speed (0.21) or gap duration (0.24). The
compiler is actively steering impact and falling short, not drifting.

**The delivery curve is non-monotonic, and that looked like a gate.**
`achieved = 0.870 * ask - 0.093` overall, but by band:

| ask band | n | mean ask | achieved | ratio | mean dur | mean speed ask |
|---|---:|---:|---:|---:|---:|---:|
| 0-0.2 | 1,868 | 0.136 | 0.124 | **0.91** | 1.122 s | 0.609 |
| 0.2-0.35 | 27,162 | 0.288 | 0.142 | **0.49** | 0.572 s | 0.695 |
| 0.35-0.5 | 13,314 | 0.398 | 0.203 | **0.51** | 0.578 s | 0.698 |
| 0.5-0.65 | 16,888 | 0.583 | 0.473 | **0.81** | 0.576 s | 0.691 |
| 0.65-0.8 | 22,918 | 0.719 | 0.552 | 0.77 | 0.617 s | 0.713 |
| 0.8+ | 14,899 | 0.868 | 0.622 | 0.72 | 0.693 s | 0.749 |

The three middle bands sit on the SAME gaps — duration 0.572 / 0.578 / 0.576 s,
speed ask 0.695 / 0.698 / 0.691 — and deliver 0.49 / 0.51 / 0.81 of their ask. A
SMALLER turn delivered worse than a larger one on identical geometry is not a
physical limit, and the discontinuity lands exactly where the impact-curve
pressure ramp does: `IMPACT_CURVE_TARGET_START` 0.25 / `SPAN` 0.40 puts ~0.10
pressure at a 0.29 ask and ~0.83 at a 0.58 ask. 42% of gaps sit at a tenth of
the lever. Closing that gap would move the bias from -0.164 to about -0.11,
past what 590 needs.

**It is not a gate. Re-sweeping the ramp rejects, hard and monotonically:**

| ramp | delta | SE | repr |
|---|---:|---:|---:|
| START 0.25 → 0.10, SPAN 0.40 → 0.25 | **-42.49** | 0.96 | **-47.19** |
| SPAN 0.40 → 0.22 | -9.05 | 1.52 | -14.05 |
| START 0.25 → 0.15, SPAN 0.40 → 0.33 | -20.62 | 1.32 | -22.56 |

**So the band table inverts.** The mid-band gaps deliver half their ask not
because a threshold blocks them but because the compiler correctly DECLINES the
trade there: applying the impact machinery to a mid-band ask costs far more in
the other axes than the turn is worth. The discontinuity is a selection
outcome, and the ramp that produces it is at a sharp optimum. The apparent
anomaly was the compiler being right.

**With the post-angle bracket also closed** — tilt 0 is -1.52, 3 shipped, 6 is
-3.42, 9 is -16.56 with capability -60.40 — every route to the impact bias this
campaign can name is now measured and closed: the arrival angle (the dive, at
its bracketed limit), the post-contact angle (the ballistic solution for the
authored air), the ranker's weighting (symmetric optimum), the repair target
(raw SSE optimum), the forward predictor (worse than the learned estimate), and
the delivery ramp (sharp optimum). The bias is where the axis trade puts it.

## 2026-07-29 — why the impact bias will not move: the post-contact angle is not free

The metric is the ENDPOINT heading at `landing+6`, not the peak turn, so
whatever the rider's heading is six frames after a contact IS its impact. And
the ride-out is typically ~15 frames (`targetGroundFrames ~ (1-air)*N`), so the
rider is still ON the post-contact line at +6: its heading is that line's
angle, with no gravity dilution. That makes

    Delta-theta = |theta_post - theta_in|

almost exactly, and every degree of extra upward tilt on the post-contact line
is a degree of measured turn. `nonBrakePostAngleDeg = contactAngleDeg - (3 + 6 *
air) + ...` sets `theta_post`, clamped to `[-8, 65]`. A direct, continuous,
never-swept lever pointed straight at the bias.

| arm | delta | SE | 250k | capa | valid |
|---|---:|---:|---:|---:|---:|
| clamp floor -8 → -20 (allow more upward) | -2.84 | 0.95 | -7.3 | -9.82 | 1047 → 1040 |
| base tilt 3 → 9 (more upward everywhere) | **-16.56** | 4.93 | -15.5 | **-60.40** | 1047 → 1039 |

**Both reject, and the second one explains the whole frontier.** Capability
-60.40 is a timing failure, not a quality one: a more upward launch flies higher
and longer and arrives at the next contact LATE. That is the same mechanism the
+18.30 `dive-span-floor` commit identified when it found its gain was "mostly
not impact — it is TIMING".

**The post-contact angle is the ballistic solution for the authored air, not a
free parameter.** A launch at angle `theta` with speed `v` is airborne for
`2 v sin(theta) / g` frames, and the compiler must be airborne for `air * N` of
them. Solving gives the angle the shipped formula already produces:

| air ask | shipped `-(3 + 6*air)` | `asin(g * air * N / 2v)` at N=30, v=10.6 |
|---|---:|---:|
| 0.35 | 5.1° | 5.0° |
| 0.50 | 6.0° | 7.1° |

The formula IS the flight-time relation. Tilting the line further up does not
buy turn — it buys air the gap did not ask for and an arrival the next contact
cannot catch.

**So the frontier, stated structurally.** `Delta-theta = |theta_post -
theta_in|`, where `theta_post` is PINNED by the authored air ask and the gap
duration, and `theta_in` is the arrival angle that the steep-arrival dive
already pushes to its bracketed limit. Both terms are determined by quantities
the compiler does not get to choose. This is a sharper statement than the
campaign's earlier "`v * dtheta` is near-conserved": it names WHICH constraint
binds, and it predicts that impact moves only if the authored air or the gap
length moves — neither of which is the compiler's to change.

## 2026-07-29 — the forward impact predictor: built, measured, and retired

The previous entry named the missing mechanism: a PHYSICAL forward prediction
of delivered turn, the way speed and air have one. It is buildable in closed
form and it does not pay. All arms N=8 against `fitted-law-command` (568.28).

**The predictor.** The scorer measures `redirArc = speed(landing-1) *
|theta(landing+6) - theta(landing-1)|`, and the ballistic projection already
carries the first two exactly, in `boundary.incoming`. The third belongs to an
arc the search has not chosen, so the prediction is of the turn the arrival
MAKES AVAILABLE, using the compiler's own model rather than a new one:
`steepArrivalDeltaDeg` sizes a commanded dive by inverting `needRad = redirArc
/ (efficiency * speed)`, which read forward says a rider arriving `angle` below
horizontal onto a level catch supplies about `speed * angle` of turn, capped by
the ejection limit `asin(IMPACT.CATCHABLE_REDIR_FRACTION)` that `impactCeiling`
already uses. A closed form over numbers the projection produced — no
simulation, consistent with the minimal-simulation rule.

**As a fourth projected axis it fails for two structural reasons.**

| form | delivery 0.6/0.7 | 1.0 | 1.4/1.5 |
|---|---:|---:|---:|
| unbounded (the available turn) | -2.75 | **-5.14** | -12.98 |
| bounded at the ask | -2.31 | -2.27 | **-1.01** |

*The axis error is signed.* An upper bound reports OVERSHOOT wherever the
arrival could turn further than the ask, while the realized axis undershoots
92% of the time — a wrong-signed error is worse than none. Bounding the
prediction at the ask (the compiler aims at the ask, so the delivery is capped
by the aim as well as the physics) turns it into a feasibility signal
denominated in axis error and halves the loss, -5.14 -> -2.27.

*And `axisQualityFromErrors` divides by the axis count.* Adding an axis
renormalizes quality for every gap that has an impact target, regardless of
whether the prediction is any good. The bounded form improves monotonically as
the signal fires LESS (-2.27 at delivery 1.0, -1.01 at 1.4), and the limit —
where the prediction is effectively always satisfied — still costs about -1.
That residual is pure renormalization, so the design is unsound independently
of predictor quality.

**As a multiplicative factor it is simply worse than the learned one.** The
right home for a feasibility signal is the readiness product, where
`impactFeasibility` already lives as a gradient-boosted component and neither
structural flaw applies. Substituting the physical form for it:

| physical share of `impactFeasibility` | 0.25 | 0.5 | 1.0 |
|---|---:|---:|---:|
| delta | -0.60 | -6.98 | **-7.90** |
| capability | - | - | **-30.75** |

Monotone toward the shipped learned component, so the physical estimate carries
no complementary information either.

**Decision: retire the forward impact predictor.** It answers the question the
projection cannot — but a physical arrival-angle bound is a worse reachability
estimate than the learned component already in the readiness product, and there
is no role in which it pays. The lead this campaign generated for itself is
closed by its own evidence. What remains true is the diagnosis that produced
it: impact's spread is structural per gap, the ranker's treatment of impact is
optimal given what it has, and 590 needs the bias itself to move.

## 2026-07-29 — the forward half of the ranker cannot see impact, and the settled half weighs it correctly

The impact spread is structural per gap, so the actionable question is whether
the RANKER handles a gap it cannot satisfy. Two paths, and the first one turned
out not to exist.

**`scoreProjectedOutgoingAxes` never sees impact.** Adding an impact branch to
`recoverabilityWeightedError` — the existing axis-and-sign hook that already
discounts speed overshoot and air undershoot — is **byte-identical at 0.4, 0.7
AND 1.3**. The reason is structural: `scoreProjectedOutgoingSurrogate` fills
`achieved` with speed, air and elevation ONLY, so the axis loop skips impact
and amplitude entirely. **The projected AXIS-QUALITY term is blind to impact:**
it ranks a candidate's future by the speed and air its arc will produce, never
by the turn it will deliver.

To be precise, the forward signal as a whole is NOT blind — `readiness` is a
separate multiplicative factor and its product contains `impactFeasibility`, a
LEARNED estimate of whether the next ask is reachable. So the ranker does carry
a forward impact signal; what it lacks is impact in the projected axis quality,
where the other axes are predicted physically rather than learned.

That is not an oversight to fix casually: impact at a contact is the endpoint
heading change over a six-frame window, which the ballistic projection does not
predict. It is the reason the arc-ownership model gives an arc the impact at
its OWN contact — which is the settled half.

**And the settled half weighs it correctly.** Softening or sharpening impact
undershoot in `scoreSettledIncomingQuality`, the one place the ranker does see
an arc's own impact:

| weight on impact undershoot | 0.4 | 0.7 | **1.0 (shipped)** | 1.3 |
|---|---:|---:|---:|---:|
| delta | -9.39 | -4.27 | **0** | -10.02 |
| 750k | -10.9 | -11.6 | - | -4.0 |

A clean interior optimum in both directions. Softening loses because the scorer
measures RAW error, so a marginal impact gain is worth more than the air and
speed it costs — the same lesson the repair weak-gap standardisation taught.
Sharpening loses because the extra impact is bought from axes that could have
delivered.

**So the impact frontier is not a weighting or a selection problem.** The
ranker's treatment of impact is optimal given what it has: an exact measurement
at the arc's own contact, and a learned feasibility estimate for the next one.
What it lacks is a PHYSICAL forward prediction of delivered turn, the way it
has one for speed and air. Closing the axis means building that predictor —
impact is the endpoint heading change over a six-frame window, which the
ballistic projection does not compute — not re-weighting the terms that exist.
That is the concrete next mechanism, and it is a substantial one.

## 2026-07-29 — the stale-sweep audit, executed: only the efficiency was stale

The efficiency find generalises to a rule — *when a mechanism changes what a
neighbouring constant MEANS, every prior sweep of that constant is stale* — so
every constant downstream of the two changes was re-swept. N=8 against
`fitted-law-command` (568.28).

| stale-by | constant | arms | verdict |
|---|---|---|---|
| breadth now 27/54/81, was flat 29 | `HANDOFF_CANDIDATE_POOL` | 7 → -1.56, 10 → -5.46 | not stale; 5 holds |
| efficiency now 1.10, was 0.68 | `STEEP_ARRIVAL_SPAN_FLOOR` | 0.35 → -7.91, 0.65 → -1.16 | not stale; 0.5 holds |
| efficiency now 1.10 | `STEEP_ARRIVAL_DELTA_MAX_DEG` | 22 → -3.01, 10 → -9.40 | not stale; 15 holds |
| efficiency now 1.10 | `STEEP_ARRIVAL_ABS_CAP_DEG` | 55 → -0.30 | not stale |
| breadth: the ranker now sorts 81, not 29 | objective `settled` | 1.5 → -4.94, 2.0 → -12.76 | not stale; 1 holds |
| ditto | objective `future` | 1.5 → -3.65 | not stale |
| ditto | objective `readiness` | 0.5 → **-40.13** | readiness is the load-bearing term |
| breadth: more candidates to find a safe one | room-gated low-air cap | -0.90 | still closed |
| ditto | `ARC_LEN_SPAN_HI` 2.40 | +0.01 | 1.85 holds |

**Nine re-sweeps, one live.** Only the delivery efficiency was genuinely stale;
everything else sits at a local optimum in both directions under the new
regime. That is a strong statement about the fitted configuration rather than a
run of bad luck — the audit was designed to find staleness and did not.

**The efficiency-as-a-law arm.** Efficiency is the fraction of a commanded turn
the search actually delivers, which depends on how well it can SELECT for one —
and that now scales with the budget. Coupling it the same way (0.68 at the
reference, exponent 0.5, so 0.68 / 0.96 / 1.18) is **+0.45 with 250k +3.8 and
validity 1047 → 1050**, recovering three of the runs the flat 1.10 cost. Both
higher references reject (0.80 -3.19, 0.90 -2.14). Positive and
reliability-improving but not decisive, so it is recorded rather than promoted.

**Four more constants, stale by the same rule** (all bracketed under
`span-handover`, i.e. at a flat 29 candidates per gap):

| constant | then | now | verdict |
|---|---:|---:|---|
| `HANDOFF_FORWARD_EVAL_TOP` = 1 | +0.89 | **-1.07** | 2 is right at the new breadth |
| `HANDOFF_FORWARD_EVAL_TOP` = 3 | -1.25 | -4.05 | idem |
| `HANDOFF_FORWARD_EVAL_PACE_FULL` = 1.2 | +1.30 | **-2.32** | 1.0 is right now |
| **`HANDOFF_BRANCHING` = 4** | **-1.73** | **+0.74** | **the sign flipped** |

Two of these reversed sign, which is the audit working as designed: the
constants really did re-optimise when the pool they draw from went from 29 to
81. `HANDOFF_BRANCHING` is the only one that moved in our favour — with 81
candidates a wider tree pays — and it peaks at 4 (5 is -2.88). At +0.74 with
SE 1.81 it is not decisive on its own, and it ANTI-COMPOSES with the efficiency
law (-1.76 together), because that law lowers exactly the mature efficiency a
wider tree wants high. Neither is promoted.

**The recoverability weight, flagged stale by its own comment** ("measured
before the closed-form projection became the default, and has not been
re-measured since"), is at a clean interior optimum: off -2.17, 0.25 -1.76,
**0.5 shipped**, 0.75 -1.94. The mechanism is confirmed real under the new
regime and the value survives — the source's open question is now answered.

**The readiness retrain is closed, and instructively.** `SAMPLER_FILES`
includes both files changed today, so the corpus fingerprint is genuinely
stale; regenerating it (523M, composite MSE 0.0137, r 0.742) and retraining is
**-16.03, capability -118.28** — and identically so with `--incumbent-model`,
so the trainer adopts the same components either way. The fresh model is BETTER
on `representative` (+2.27) and collapses on the hard cases. The incumbent, on
a corpus that no longer matches the sampler, generalises better than one fitted
to the sampler as it stands. Retrain reverted.

## 2026-07-29 — ACCEPTED: the two constants that were chosen, not measured

Asked which of the last 48 hours' gains still had headroom. The answer was the
same defect in both of the largest: **a parameter nobody had swept, because the
sweep that would have caught it predated the change that made it wrong.**

**The arc-command efficiency, 0.68 → 1.10.** Every sweep of this constant ran
DOWNWARD (0.4 / 0.5 / 0.6) and every one of them predates the span floor that
shipped in the same commit as the +18.30 gain. Once the floor makes every pool
member carry at least half the commanded dive, the command itself is
over-sized, so the untested direction is up:

| efficiency | 0.76 | 0.85 | 0.95 | **1.00** | 1.10 | 1.30 | 1.50 |
|---|---:|---:|---:|---:|---:|---:|---:|
| delta | -0.84 | +2.88 | -0.08 | **+4.44** | +3.62 | +0.05 | -9.61 |

**The breadth law, sqrt/24 → linear/27.** Committed hours earlier with BOTH
parameters picked rather than measured — sqrt because it is the textbook
diminishing-returns form, and the anchor inherited from a sweep of the old
piecewise function under a different pool size.

The anchor is bracketed at the reference budget, where the exponent cannot
matter, and it reproduces across independent runs (two arms with different
exponents measured the identical 250k configuration and both read +7.0):

| anchor (250k nCand) | 21 | 24 | **27** | 30 |
|---|---:|---:|---:|---:|
| 250k delta | -8.0 | 0 | **+7.0** | -8.5 |

The exponent, bracketed against the efficiency it interacts with:

| exponent at eff 1.10 | 0.70 | 0.85 | **1.00** | 1.20 |
|---|---:|---:|---:|---:|
| delta | +6.25 | +6.84 | **+7.44** | +6.81 |

**Linear is what the frame arithmetic says.** The search visits a fixed set of
gaps, so frames-per-gap is proportional to the budget; per-gap breadth should
be too. 27 / 54 / 81 candidates at 250k / 500k / 750k, still with no ceiling.

**They are complements at their peak, not substitutes.** Efficiency 1.10 alone
costs 250k (-3.7); the breadth anchor pays for exactly that (+7.0 there). Every
budget is positive together where neither is alone.

**N=24: +5.57, SE 1.45, CI [+1.62, +9.51], ACCEPT, promotable.** 250k +0.04,
500k +5.82, 750k +8.83; every stratum positive (repr +7.14, capa +0.20, lega
+2.40, dev +6.01). Qualification 405.64 → **407.57**, agreeing with development
this time.

**REGRESSION, recorded not hidden.** Validity 3144 → 3128 (10 gained, 26 lost),
entirely in the three `capability` sources at 250k that were already the only
invalid runs in the archive: `frontier_dense_recovery` (16),
`frontier_pickup_progression_shifted` (12), `..._240ms_figures` (11). This
deepens the standing `rideStalled` debt rather than opening a new failure, and
the capability stratum still nets +0.20 — but it is a reliability cost, and the
next arm should be aimed at recovering it.

**The lesson worth keeping.** When a mechanism changes what a neighbouring
constant means, every prior sweep of that constant is stale. Both of these sat
in the two biggest gains of the campaign, in plain sight, for two days.

**What 590 requires, exactly.** The headline is `1000 * exp(-rms / 0.25)`, so
568.28 is a weighted axis rms of 0.1413 and 590 is 0.1319 — a **6.6%
reduction**. From impact alone that is rms 0.216 -> 0.194, i.e. the bias moving
**-0.164 -> -0.130**. That is the quantity eleven batches and this campaign's
frontier analysis have failed to move, and it did not move when the arrival
geometry changed either (-0.167 -> -0.164 across the efficiency refit).

**Where impact's error actually lives** (new instrument, on the accepted
archive). Its rms of 0.216 splits into a bias of 0.164 and a spread of 0.140,
and that spread decomposes as:

| component | sd |
|---|---:|
| **between-gap** (the seed-mean differs by gap) | **0.1245** |
| within-run across gaps | 0.1156 |
| across-seed at a FIXED gap | **0.0546** |

The spread is **structural per-gap, not seed luck** — 5x larger between gaps
than between seeds at the same gap. Some gaps fail to deliver impact for every
seed. So the counterfactual's +19.24 "every seed scores its cell's best" is
mostly NOT reachable by making the search luckier; the same gaps are hard every
time. The addressable form of the question is which gaps are structurally
infeasible and what the arc should do instead of chasing them —
`impactFeasibility` already computes the first half, but it enters only through
the readiness PRODUCT, which scales the whole objective uniformly and never
de-prioritises the impact axis at a gap that cannot reach its ask. That
plumbing does not exist yet and is the concrete next mechanism.

## 2026-07-28 — ACCEPTED: one scale-free law for per-gap breadth

Jeremie, on the campaign's habit of chasing the scarce budget: *250k will never
reach 750k, that's the whole point of using a higher budget* — and then, on the
shape of the fix: *these saturations are quite questionable, the compiler
behaviour should scale to just about any budget.* Both are right, and together
they produced the cleanest mechanism of the campaign.

**What the stack actually was.** `budgetAwareQualitySampleCount` had five
piecewise pieces — `scarceLean` (faded out by 100k), `matureLean` (saturated by
250k), a canonical-scarce segment, and a hard `HANDOFF_QUALITY_N_CAND` ceiling
over all of it. The curve it produced is not monotone:

| budget | 100k | 125k | 250k | 500k | 750k |
|---|---:|---:|---:|---:|---:|
| nCand | 29 | **32** | **24** | 29 | 29 |

That is an interpolation through the three budgets the benchmark runs, not a
statement about budget. Outside the window the answer is arbitrary.

**The ceiling was the binding part.** The "mature" lean leans DOWNWARD from 32,
so every canonical budget sat pinned at 29 and the compiler could not invest
more per gap however much budget existed — a 750k compile spent with a 500k
policy that merely ran longer. Lifting the top alone confirms it, with the
other budgets byte-identical by construction:

| arm | delta | SE | 250k | 500k | 750k |
|---|---:|---:|---:|---:|---:|
| 750k ceiling → 44 | +0.82 | 0.12 | +0.0 | +0.0 | **+2.7** |
| 750k ceiling → 36 | +0.33 | 0.33 | +0.0 | +0.0 | +1.1 |

**The law.** Per-gap breadth grows as the SQUARE ROOT of the budget: doubling
the frames buys sqrt(2) times the candidates per gap — the standard
diminishing-returns allocation, monotone, no ceiling, no special budgets. ONE
anchor (24 candidates at 250k, the point measured directly at +8.8 against 29)
replaces seven constants:

| budget | 50k | 100k | 250k | 500k | 750k | 1M | 2M |
|---|---:|---:|---:|---:|---:|---:|---:|
| nCand | 11 | 15 | **24** | 34 | 42 | 48 | 68 |

**500k was not fitted, and the law predicted it.** Anchored at 250k and
calibrated at 750k, it says 500k should sample 34 rather than the shipped 29 —
an operating point neither end informed. It verified: 500k +0.97 at N=8, +1.25
at N=24. Predicting an unfitted budget is evidence of a different kind from a
refit, and it is exactly what the piecewise stack could never do.

**N=24: +1.24, SE 0.27, CI [+0.49, +1.98], ACCEPT, promotable.** 250k +0.00
(byte-identical), 500k +1.25, 750k +2.03; every stratum positive (repr +1.15,
capa +0.37, lega +2.95, dev +1.66); validity unchanged at 3144. Qualification
405.41 → 405.64, up this time.

**The boundary: generate wider, admit narrower.** Applying the identical law to
`HANDOFF_CANDIDATE_POOL` — the pool the ranker ADMITS from, a flat constant with
no budget dependence at all — is **-1.75** at the sqrt exponent (5/7/9 across
the budgets; 500k -2.1, 750k -2.3) and **-1.94** at a quarter power (5/6/7;
750k -4.9). Both lose precisely at the budgets they widen, which agrees with the
accepted `pool-five`: narrowing that pool from 8 to 5 was +3.32. Breadth is a
GENERATION device and more budget should buy more of it; the pool is a SELECTION
device, and widening selection dilutes it however much budget exists. The rule
is about the SHAPE of a budget dependence, not a claim that every knob grows —
a scale-free law for a selection knob may correctly be flat.

**The audit, executed: only ONE ceiling was binding.** Every other capped
budget knob was tested with the same law and the same anchor, N=8 against
`breadth-law`:

| knob | its cap | delta | 750k | verdict |
|---|---|---:|---:|---|
| per-gap breadth | 32, leaned to 29 | **+1.24** | +2.03 | **ACCEPTED** |
| admitted pool | flat 5, no budget term | -1.75 | -2.3 | correctly flat |
| ditto, quarter power | | -1.94 | -4.9 | correctly flat |
| tree width `HANDOFF_BRANCHING` | flat 3 | -1.73 | -0.5 | at its optimum |
| ditto via `branchLimit` | | **+0.00** | +0.0 | the gate never binds |
| tail-completion window | `8 + 4p`, max 12 | -0.86 | **+0.0** | no headroom at the top |
| mature reuse extra | at most +1, ever | -0.32 | -1.1 | correctly capped |

**And the distinctions that fell out of it.** Widening pays for GENERATION
WITHIN a gap and nowhere else:
- *not* for selection — the pool admits from the breadth, and widening it
  dilutes (which is why `pool-five` narrowed it and paid +3.32);
- *not* for tree width — a wider sample costs linearly, a wider tree multiplies
  and starves depth, so 3 is optimal even at 750k;
- *not* for reuse — reuse recycles committed geometry rather than generating
  fresh options, so more of it behaves like a selection widening.

So "the compiler must scale to any budget" is a rule about the SHAPE of a
budget dependence — no saturation or ceiling fitted to the benchmark's
operating points — and for most knobs the correct scale-free law turns out to
be flat. Only the per-gap breadth was being held back by its ceiling.

**The generalisation to carry forward.** The same critique applies to every
other maturity ramp in `handoff.ts`: `maturityPressure` is
`smoothstep(b/(b+150k))`, which reads 0.684 / 0.865 / 0.926 at 250k / 500k /
750k — asymptotic, so a doubling of budget from 500k to 750k moves it 0.06. It
governs future-preview pressure, mature reuse, the tail throttle and the
tail-completion window. Every one of those is a ceiling waiting to be replaced
by a law.

## 2026-07-28 — the accepted ramp's own shape, bracketed on all four sides

The synthesis above says live-state adaptation pays as a continuous ramp on
expenditure magnitude. The campaign's largest accept (+10.66) is exactly that
ramp — and neither of its two shape constants had ever been fitted. Both are
now bracketed, N=8 against `span-handover`.

| arm | delta | SE | 250k | capa | valid |
|---|---:|---:|---:|---:|---:|
| `PACE_START` 1.5 → 2.0 (wider window) | -1.56 | 1.51 | -7.2 | - | 1046 |
| `PACE_FULL` 1.0 → 0.7 (slower rise) | -2.53 | 1.72 | -13.1 | -17.11 | **1039** |
| **`PACE_FULL` 1.0 → 1.2 (faster rise)** | **+1.30** | 1.36 | **+6.2** | **+8.23** | **1050** |
| `FORWARD_EVAL_TOP` 2 → 0 | -4.59 | 4.41 | -3.0 | -31.76 | 1046 |
| **`FORWARD_EVAL_TOP` 2 → 1** | **+0.89** | 2.18 | **+5.0** | **+6.20** | **1049** |
| `FORWARD_EVAL_TOP` 2 → 3 | -1.25 | 1.49 | -6.2 | -8.48 | 1046 |
| `TOP` 1 + `PACE_FULL` 1.2 | +0.30 | 2.20 | +1.0 | +1.60 | 1049 |

**The gradient runs one way: narrow HARDER.** Every arm that keeps the rolled
head wider under pace pressure loses and loses validity; both arms that narrow
it further gain, and gain validity. The floor has a clean interior optimum
(0 is -4.59, 1 is +0.89, 2 shipped, 3 is -1.25).

**And the two ways to narrow are SUBSTITUTES, not complements.** Composing the
tighter window with the lower floor is +0.30 — below either alone — because both
express the same thing and doing both overshoots into the same territory that
made `TOP = 0` cost 31.8 of capability.

**Resolved and NOT promoted.** The best single arm, `PACE_FULL` 1.2, is +0.42 at
N=24 (SE 0.93, CI [-2.19, +3.02]) against +1.30 at N=8 — 250k +6.2 → +1.92 and
capability +8.23 → +2.77. Validity still improves (3144 → 3149, 16 gained / 11
lost) and the point estimate is positive at both depths, but the interval is
not decisive and this is a re-tune of a constant rather than a defect fix. The
shipped 1.0 stands; the bracket is recorded at the constant so the next
campaign does not re-spend it.

## 2026-07-28 — adapting to the budget that is LEFT: what it pays for, and what it does not

Jeremie's framing: every high-budget compile becomes a low-budget one as it
spends, so the compiler should adapt to the budget REMAINING rather than
pre-deciding from the budget it started with. The campaign's two largest
accepts are already of exactly this kind — `observedTraversalBudgetSlack`
re-estimates the slack from the compile's own traversal rate — so the question
is which decisions it generalises to. Three families, all N=8 against
`span-handover`.

| adaptation | shape of the decision | delta | SE | capa |
|---|---|---:|---:|---:|
| forward-eval rollout width on live pace | **continuous ramp** on HOW MUCH | **+10.66** | (N=24) | - |
| aim-lane suppression on live pace | **continuous ramp** | **+6.97** | (N=8) | - |
| per-gap sample count on remaining budget | per-decision QUALITY | -0.41 | 0.34 | -0.96 |
| ditto, half strength | per-decision QUALITY | -0.26 | 0.19 | -1.38 |
| pre-completion sample share 0.60 | per-decision QUALITY | -4.47 | 1.93 | -11.64 |
| branch + rollout-depth gates on live pace | **binary gate** on WHETHER | -5.38 | 3.28 | **-33.87** |
| rollout-depth gate alone on live pace | **binary gate** | -8.05 | 4.53 | **-51.59** |

**The principle holds, with two clauses it did not obviously have.**

*It must throttle magnitude, not trigger a mode.* `pacedSlack` FALLS as a
compile spends, so feeding it to a binary threshold makes the pre-completion
throttles fire far more often — depth 1, branching 2 — on compiles that would
have finished comfortably. Capability loses 33.9 and 51.6 and six valid runs.
The accepted arms feed the same signal into a ramp between slack 1.5 and 1.0
and adjust HOW MUCH to spend; those pay +10.66 and +6.97. Same signal, opposite
sign, and the shape of the decision is the only difference.

*It applies to deadline pressure, not to decision quality.* Re-keying the
per-gap sample count on the budget still unspent is -0.41, and its budget split
is the tell: 250k is EXACTLY 0.00 (it already samples at the scarce value)
while 500k and 750k lose as they deplete. A mature compile wants its full
sample all the way to the end, because sampling width buys the quality of each
gap's decision, which is worth the same at frame 10,000 and frame 700,000.
Deadline pressure is a property of the remaining budget; decision quality is
not.

**Retire**: remaining-keyed sample count, pre-completion sample share, and both
paced binary gates. **Retain and generalise**: live-state adaptation as a
continuous throttle on expenditure magnitude — which is what the two largest
accepts in this campaign already are.

## 2026-07-28 — where the headline is, and why the scarce budget cannot be bought

The headline decomposes 20/50/30 over budgets that score **250k 524.87, 500k
564.47, 750k 571.41**. The 750k budget already clears 570 on its own; the
weighted headline is held down by a 250k that is 40 points behind 500k.

**What makes 250k different, measured.** The share of the budget spent before
any completion exists:

| budget | first completion | % of budget pre-completion |
|---|---:|---:|
| 250k | 168,789 | **67.5%** |
| 500k | 194,747 | 38.9% |
| 750k | 214,018 | 28.5% |

Two-thirds of the scarce budget goes to reaching a first completion, leaving a
third for repair — the compiler's improvement engine, which cannot run at all
until a completion is held. The obvious move is to reach it more cheaply:
before a completion the decision is "can I finish?", not "which is best?".

| pre-completion share of the quality sample | delta | SE | 250k | capa |
|---|---:|---:|---:|---:|
| 0.35 | **-13.25** | 1.86 | -21.3 | -27.90 |
| 0.60 | -4.47 | 1.93 | -7.6 | -11.64 |
| 0.80 | -2.53 | 1.39 | -10.7 | - |
| 1.00 (shipped) | 0 | - | - | - |

**Falsified, monotonically and steeply, and 250k is hurt WORST** — the budget
the change was designed to help. The pre-completion phase is not overhead. The
quality of the gaps it commits is what determines whether the search can reach
the end at all, so a cheaper sample commits worse gaps and completion recedes.
This also retro-explains the accepted `scarce-lean`: 24 of 29 is 0.83, a mild
trim at the edge of the same cliff that 0.60 falls off.

**And repair's raw-SSE targeting is right, despite aiming at bounded axes.**
Impact is the largest error on 61.8% of gaps and the two physics-bounded axes
(impact, amplitude) take 73.1% of repair's targets, so standardising each
axis by its own spread should send repair where improvement is available. It is
**-0.39 (SE 0.13), reject**, uniformly, and half-strength is -0.33. The reason
is that the scorer measures raw error: a small gain on a large error moves the
headline more than a large gain on a small one. "Improvable" and "worth points"
are different quantities and only the second is paid.

## 2026-07-28 — every invalid run is a ride that stalls, and the handoff cannot see it

The remaining validity pool is worth +6.16 (`invalid runs score their cell's
MEAN`). It is exactly 8 runs of 1056, and they are strikingly uniform: **all 8
are at 250k, all 8 are `terminus:rideStalled`**, on three `capability` sources
(`frontier_dense_recovery` x4, `..._240ms_figures` x2,
`frontier_pickup_progression_shifted` x2).

**It is not a completion failure.** On `frontier_pickup_progression_shifted`
all 110 authored contacts are reported and 99 are hit — the track is built and
the rider stops at contact 99. The failure is a slow speed bleed, not a search
that ran out of budget.

That makes the stall guard the obvious suspect: `handoffStateCost` charges
`HANDOFF_STATE_STALL_WEIGHT_MULTIPLIER` only under `if (speed <= 1e-6)` — a
cliff at literally zero, so a rider crawling toward a stall is charged nothing
until it has already stopped and the track is committed. Replacing the cliff
with a ramp over a stall speed (the cliff being its limit as speed → 0) is the
direct test.

| ramp reaches below | delta | valid |
|---|---:|---:|
| 1.5 px/frame | **+0.00** | 1048 |
| 3.0 px/frame | **+0.00** | 1048 |
| 6.0 px/frame | **+0.00** | 1048 |

**Byte-identical at every floor, including 6.0 px/frame against a typical
arrival speed of ~10.6.** No committed handoff in the entire archive ever exits
below 6 px/frame. The rider is healthy at every single handoff boundary and
stalls anyway.

**Decision: retire the handoff-side stall guard, and relocate the failure.**
`rideStalled` is not predictable from the handoff exit state, because the exit
state is never near a stall. The bleed happens INSIDE a gap's ride — grounded
deceleration over the committed geometry between handoffs — so any fix belongs
in arc geometry (do not build a segment that bleeds the rider), not in handoff
selection or ranking. That is a different mechanism from anything this campaign
has touched.

## 2026-07-28 — the sampler's determinism is at an interior optimum too

The one live measurement left is the within-cell seed spread of 35.6 points.
`placementGuideWeight` is the knob that produces it: `baseGuide = 1 / (1 +
(attempt/6)^2)` decays the deterministic low-discrepancy sequence into the
seed's raw random draw as the attempt index grows. A low-discrepancy sequence
covers a sample space more evenly than random draws, so holding it for more of
the batch should cut the spread and cover better.

| guide reach | delta | SE | 250k | 500k | 750k | capa | valid |
|---|---:|---:|---:|---:|---:|---:|---:|
| 3 (less guided) | -1.79 | 1.44 | -7.9 | -0.1 | -0.6 | -12.55 | 1048 → 1045 |
| **6 (shipped)** | **0** | - | - | - | - | - | 1048 |
| 12 | -0.97 | 0.92 | -6.0 | +0.2 | +0.4 | -6.58 | 1048 → 1043 |
| 24 | -1.31 | 1.43 | -4.7 | -0.4 | -0.5 | -7.67 | 1048 → 1047 |

**Both directions lose, and both lose the same way** — through `capability` and
through validity, both at 250k. The seed's randomness is doing real work at the
scarce budget: it finds completions the deterministic sequence misses, and the
low-discrepancy sequence's even coverage does not substitute for that. At 500k
and 750k more determinism is mildly positive (+0.2/+0.4 at reach 12), which is
consistent — a mature budget does not need luck to complete.

**Decision: retire the guide lever.** The shipped 6 is an interior optimum on a
four-point bracket.

**Where this leaves the seed spread.** It is +13.16 of headline, it is not
start selection (1055/1056 runs pick rank 0), it is not the guide, and every
knob governing the per-gap sampling that produces it — pool size, sample count,
length span, three angle spans, guide reach — is now bracketed at or beside its
optimum. Closing it requires a mechanism that does not yet exist in the
compiler, not a re-tune of one that does.

## 2026-07-28 — "add candidates" only pays when the candidates are viable

The accepted span widening suggests a general rule: widen a sampling degree of
freedom and let the ranker choose. Tested on the three angle rolls, N=8 against
`span-handover`.

| arm | delta | SE | capa | valid | verdict |
|---|---:|---:|---:|---:|---|
| `postAngle` span ±7° → ±11° | -2.29 | 2.08 | **-14.00** | 1048 → 1042 | reject |
| `contactAngle` span ±7-12° → ±11-17° | -0.96 | 2.03 | -6.25 | 1048 → 1047 | reject |
| `preAngle` span ±5-9° → ±8-13° | **+0.00** | 0.00 | +0.00 | 1048 → 1048 | **inert** |

**The rule needs its second clause.** Widening the LENGTH span was +0.65 with
every stratum positive and validity unchanged; widening the ANGLE spans loses,
and loses through validity — six runs on `postAngle`, one on `contactAngle`,
with capability taking the damage both times. A longer arc is geometrically
safe; a wilder launch angle produces candidates that gate-fail, and at a pool of
five a wasted slot is expensive. Candidate viability already sits at 65.1% /
65.9% / 67.5% across the three budgets, so the shipped spans are tuned at that
frontier, not below it.

**The `preAngle` roll is dead weight.** Its span was verified applied at the
call site and the result is byte-identical at every budget and stratum, so the
pre-arc angle it samples never reaches committed output. Left in place — this
is an observation, not a change — but it is one sixth of the sampler's degrees
of freedom producing nothing.

**Start selection is not the seed-variance source.** 1055 of 1056 runs choose
start rank 0 and only 1 of 132 cells varies across seeds. But the mean
within-cell score spread is **35.6 points**, which is where the +13.16 seed
counterfactual lives: it comes from the per-gap geometry sampling, and every
knob that governs that sampling — pool size, per-gap sample count, length span,
the three angle spans — is now bracketed at or beside its optimum.

## 2026-07-28 — ACCEPTED: the span, the handover, and 194 lines of dead gates

The three arms that survived their brackets, composed and resolved.

| part | own N=8 delta |
|---|---:|
| `ARC_LEN_SPAN_HI` 1.45 → 1.85 | +0.65 |
| `REPAIR_MAIN_MARGIN_MATURE` 1.1 → 1.0 | +0.28 |
| delete the three signature exponent gates | +0.00 |

Composite N=8 **+1.12** (SE 0.56); N=24 **+0.65, SE 0.27, CI [-0.07, +1.37],
ACCEPT, promotable**. Every stratum positive (repr +0.36, capa +1.43, lega
+0.47, dev +2.66), every budget positive (250k +0.84, 500k +0.78, 750k +0.30),
validity unchanged at 3144/3168.

**The cleanup is the other half.** 194 lines of profile-band carve-outs go:
five that force the repair margin back to 1.0 and are no-ops at the new
default, three that gate a 0.75 objective exponent on spec signatures and
measured exactly +0.00. After the deletion the committed source re-measured at
N=8 as +1.12 — identical to the pre-cleanup arm, confirming the deletion is
behaviour-preserving.

**Qualification falls 407.33 → 405.41** while development rises. That is the
held-out monitor and it is recorded, not tuned against. Per cell it is broad
rather than one outlier — 12 of 15 down, concentrated at the scarce budget:

| cell | before | after | delta |
|---|---:|---:|---:|
| `luna_bala_44s` 250k | 595.8 | 582.2 | **-13.6** |
| `amor_na_praia_46s` 250k | 579.0 | 568.4 | -10.6 |
| `tiki_tiki_48s` 250k | 485.4 | 476.3 | -9.1 |
| `luna_bala_44s` 750k | 603.3 | 597.8 | -5.6 |
| (11 more, all within ±4.4) | | | |

The qualification specs are real music tracks of 44-81 s — far longer and
denser than any development case — and the loss is at 250k, where such a spec
is already budget-starved. A longer ride-out costs simulation frames, so the
span widening reaching further under budget pressure is the mechanism that fits
the shape. Development's own 250k moved +0.84, so the two disagree on the
scarce budget specifically. Recorded for the next campaign; the accepted
contract is development and this is not tuned against.

**Friction.** A `rebaseline` needs a comparison holding exactly 8 canonical
seeds, so an N=24 resolution can never be promoted directly: the N=8 arm must
be re-run against the identical committed source and promoted with `--force`
citing the deeper evidence. This is the second time this session; it costs a
7-minute re-measure each time.

## 2026-07-28 — the axis map is complete, and most of the priced pool is physics

`REPAIR_FEAS_MARGIN_MATURE` 1.0 → 1.20 is **-0.63, reject** (250k -0.6, 500k
-0.6, 750k -0.7). Both directions on restart cost now lose, so the shipped
repair economics sit at a genuine optimum and the vein is closed.

**Amplitude, the one axis not inspected this session, closes on a physical
law.** It carries the largest rms of any axis (0.235) and undershoots 82.3% of
the time, and the undershoot grows with the ask — 0.8+ asks deliver a mean
0.363, bias -0.499. But split by gap duration, the high-ask population is
duration-bound:

| gap duration | mean ask | mean achieved | **max achieved** |
|---|---:|---:|---:|
| 0.3-0.45 s | 0.554 | 0.052 | **0.095** |
| 0.45-0.6 s | 0.749 | 0.073 | 0.139 |
| 0.6-0.9 s | 0.672 | 0.206 | 0.355 |
| 0.9 s+ | 0.660 | **0.597** | 1.000 |

The maximum ACHIEVED over 4,728 runs scales as N^2 — the ballistic apex law
`pop ~ g*N^2/8` that `track-variety` documented. On gaps with room the axis is
essentially delivered (bias -0.063); on short gaps the authored ask is not
reachable by any geometry. Amplitude's -0.122 bias is an authored-vs-physics
mismatch, not a compiler deficiency, and is not a legitimate target.

**What this does to the counterfactual pricing.** The re-priced pools —
impact +52.08, air +12.23, speed +6.37, amplitude +5.00 for a 25% bias removal
— are upper bounds on the PHYSICS, not on the engineering:

| axis | bias | status |
|---|---:|---|
| impact | -0.167 | frontier bracketed over eleven batches; `v * dtheta` near-conserved |
| amplitude | -0.122 | `pop ~ g*N^2/8`; unreachable on short gaps |
| air | +0.066 | floor real below ~0.14 s/gap; addressable part measured at +0.65 |
| speed | -0.005 | already unbiased |

Three of the four are bounded by the same fact: a gap of N frames admits only
so much flight. The one pool that is not a physics bound is the seed spread
(+13.16), and the phase that would close it is now measured at its optimum in
both directions.

## 2026-07-28 — the deep repair restart is the productive unit

Given that repair spends 503k of a 750k budget to touch 5.4 gaps and accept 2,
the obvious hypothesis is that the same frames should be spread over more gaps.
Bounding a single restart by the share of the repair budget it leaves behind —
rather than by its own cost-to-end — tests it directly.

| restart may claim | delta | SE | 250k | 500k | 750k | repr | capa | lega |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 0.20 of remaining | **-4.92** | 0.30 | -4.0 | -6.1 | -3.6 | -5.23 | -3.06 | -6.58 |
| 0.34 of remaining | -2.37 | 0.30 | -3.0 | -3.0 | -1.0 | -2.48 | -1.33 | -3.89 |
| 0.60 of remaining | -0.50 | 0.17 | -1.5 | -0.5 | +0.2 | -0.56 | -0.22 | -0.84 |
| all of it (shipped) | 0 | - | - | - | - | - | - | - |

**Falsified, monotonically, on every stratum and every budget.** The dose
response is as clean as the campaign has produced: truncating a repair restart
costs in direct proportion to how much of it is truncated. Concentration is not
the flaw — it is the mechanism. A restart that re-completes the track from an
early anchor is the unit of work that pays, and 5.4 gaps of it beats any
larger number of shallower attempts.

**Decision: retire the restart-cost lever, and invert the indication.** If
truncation costs proportionally, then the shipped `REPAIR_FEAS_MARGIN_MATURE`
of exactly 1.0 — which sizes a mature restart's ceiling at precisely its own
estimated cost-to-re-complete, with zero headroom — is truncating every restart
whose estimate under-prices it. At 750k only 4.2 of 15.5 restarts reconverge
and 2.0 accept; the remainder are unaccounted for and truncation is a candidate
explanation.

## 2026-07-28 — repair spends two-thirds of the budget to accept two things

The seed spread is the largest addressable pool left (`valid runs score their
cell's BEST` = 571.80, +13.16, which alone clears 570), and the phase that
converts leftover budget into per-seed improvement is repair. Its telemetry,
read straight off the accepted archive:

| budget | restarts | gaps touched | accepts | frames spent | first completion |
|---|---:|---:|---:|---:|---:|
| 250k | 24.3 | 7.0 | 0.9 | 69,686 | 161,735 |
| 500k | 20.5 | 6.5 | 1.6 | 276,540 | 192,523 |
| 750k | 15.5 | **5.4** | **2.0** | **502,982** | 211,730 |

**At 750k, repair burns 503k frames — two-thirds of the whole budget — to touch
5.4 gaps and accept 2 improvements.** And `gaps_touched` FALLS as the budget
grows while frames spent rises 7x, because each restart is sized by its own
measured cost-to-re-complete: a bigger budget buys bigger restarts, not more of
them.

**Both count levers are exactly null**, and the same telemetry says why —
`budget_exhausted` is 352/352 at every budget, so the loop is never terminated
by running out of candidate gaps:

| arm | delta | SE | verdict |
|---|---:|---:|---|
| clear the exhausted-gap ban whenever a repair is accepted | -0.01 | 0.02 | null |
| `LR_REPAIR_MAX_ATTEMPTS` 64 → 160 | **+0.00** | 0.00 | **byte-identical** |

The ban set was a real suspicion — a gap is excluded for the rest of the
compile after one failed round, even though every accepted repair replaces the
incumbent that ban was measured against — but it never binds, because budget
runs out first. Restarts average 15.5-24.3 against a cap of 64, so the cap
never binds either.

**Decision: retire both count levers; the binder is restart COST.** The
indicated change is to bound a single restart by the budget it leaves behind
rather than by its own cost-to-end, which forces cheaper and nearer anchors and
spreads the same frames over more gaps.

## 2026-07-28 — pool-widening pays where cap-raising breaks

Six arms, N=8 against `scarce-lean` (558.63).

| arm | delta | SE | repr | capa | lega | dev |
|---|---:|---:|---:|---:|---:|---:|
| safe cap 0.50, **room-gated by `dense`** | +0.07 | 1.87 | +0.82 | **-5.28** | +2.83 | +0.14 |
| room gate `DENSE_FRAMES` 26 → 18 | -1.16 | 1.53 | -0.14 | -5.82 | -1.77 | -0.21 |
| `ARC_LEN_SPAN_HI` 1.45 → 1.65 | -0.28 | 0.54 | -0.12 | +1.01 | -5.17 | +3.38 |
| **`ARC_LEN_SPAN_HI` 1.45 → 1.85** | **+0.65** | 0.61 | +0.14 | +1.51 | +1.22 | +3.96 |
| `ARC_LEN_SPAN_HI` 1.45 → 2.30 | +0.21 | 0.56 | -0.53 | +1.49 | +0.85 | +5.44 |
| span 1.85 + gated cap 0.36 | -0.08 | 1.50 | +0.38 | -4.06 | +0.85 | +3.44 |

**The gate is the right mechanism and it is not enough.** Gating the low-air
cap bonus by `dense` — the room signal already in that formula, where it gates
only the penalty term — recovers capability from -37.77 to -5.28 and keeps the
`representative` and `legacy_regression` gains. But it still costs 250k and
three valid runs at 0.50, and still costs capability -4.06 at 0.36. The cap
resists every relaxation that reaches it.

**The distinction that separates the whole batch: add candidates, do not move
caps.** Widening the room-gated `ARC_LEN_SPAN` high end puts LONGER arcs in the
pool while leaving the short ones there, so dense gaps keep the candidate they
need and the ranker chooses. That is the only arm with every stratum positive
and validity unchanged. Raising `safePostCap` forces the choice on every
candidate at once, and the gaps that need the short arc have nowhere to go.

**Decision: retire the safe-cap lane; the span widening peaks at 1.85 and is
inside noise.** The bracket is 1.65 -0.28, 1.85 +0.65, 2.30 +0.21 against SEs
of ~0.55 — a real but ~1-sigma effect, not worth a promotion and a cache reset
on its own. The air axis's systematic half is defended by a cap that is doing
its job.

**Next.** Of the counterfactuals, the seed spread is the largest addressable
pool: `valid runs score their cell's BEST` = 571.80, +13.16, which alone clears
570. The mechanism that converts leftover budget into per-seed improvement is
the repair phase, and its loop terminates on a permanent ban — a gap that
fails once is excluded for the rest of the compile, even though every accepted
repair elsewhere replaces the incumbent that ban was measured against.

## 2026-07-28 — air overshoots, and the cap that causes it is load-bearing

Re-pricing the accepted archive (`study_headline_counterfactual.ts`, zero
compiles) moved the aim off impact: **air is worth +12.23 for a 25% bias
removal** against the +11.4 that 570 needs, and the seed spread alone is
+13.16.

**The diagnosis.** Signed per-gap axis bias over 97,046 gaps:

| axis | bias | rms | undershoot% |
|---|---:|---:|---:|
| impact | -0.167 | 0.219 | 90.7 |
| amplitude | -0.122 | 0.235 | 82.3 |
| **air** | **+0.066** | 0.129 | **24.8** |
| speed | -0.005 | 0.085 | 46.7 |

Air is the one axis that OVERSHOOTS — 75% of gaps deliver more air than
authored. Bucketed by ask, it is a floor signature: asks in 0-0.2 are met at a
mean 0.424 (100% over), and the bias falls monotonically to -0.059 by 0.8+.

**The floor is real but not binding where the mass is.** Minimum achieved air
scales as ~0.14 s / gap-duration (0.667 at 0-0.2 s, 0.462, 0.333, 0.231, 0.036
at 0.7 s+) — the ~5-frame contact floor. But on the dominant low-ask
population, 18,707 gaps of 0.45-0.7 s, the floor is 0.231, the ask is 0.249 and
the delivery is 0.381. The physics permits the ask.

**The low-ask band is 23.3% of gaps and 71.1% of all air error.** Split across
seeds on 2,859 low-ask gap cells: ask 0.239, mean achieved 0.411, BEST-seed
achieved 0.324, across-seed spread 0.198. So the overshoot is about half
systematic (+0.085 that no seed beats) and half selection (+0.087). Closing
only the selection half takes air rms to x0.819.

**The chain, traced.** `targetStatePostLength` already aims correctly —
`targetGroundFrames = (1 - air) * nextGapFrames` is exactly the complement of
the ask. But for a low-air ask (air 0.25, `lowAir` 0.545) the request of 0.75
is clipped to `GROUND_ROOM_BASE` 0.72, and then `targetStateSafePostCap`
permits only `speed * N * (0.34 + 0.26 * 0.545)` = **0.482 * speed * N**.

| arm | delta | SE | repr | capa | lega | verdict |
|---|---:|---:|---:|---:|---:|---|
| `GROUND_ROOM_BASE` 0.72 → 0.88 | **+0.00** | 0.00 | +0.00 | +0.00 | +0.00 | **byte-identical** |
| `SAFE_CAP_LOW_AIR_BONUS` 0.26 → 0.50 | -5.10 | 4.12 | +0.57 | **-37.77** | +1.61 | **reject** |
| both | -5.15 | 4.11 | +0.57 | -38.10 | +1.61 | reject |

**The byte-identical result is the confirmation.** Raising the ground-room clip
changes nothing because `safePostCap` clips `targetPost` first, exactly as the
arithmetic predicts. `safePostCap` is the binding constraint on delivering a
low air ask.

**And it is load-bearing.** Relaxing it uniformly costs -37.77 on `capability`
and six valid runs — precisely the "a longer ride-out crowds the next landing"
failure the cap exists to prevent. But `representative` is +0.57 and
`legacy_regression` +1.61: where there is room, the longer ride-out is better.

**Decision: retire the uniform cap relaxation; the lever is the room gate, not
the coefficient.** The cap already carries `dense` as its room signal, but
`dense` gates only the penalty term and not the low-air bonus. Next arms gate
the bonus by room, and widen the room-gated `ARC_LEN_SPAN` high end — which
adds long candidates to the pool rather than moving a cap, the shape that made
the original span widening survive at +7.7.

## 2026-07-28 — the simulation-economy vein is bracketed on every side

Five arms, N=8 against `scarce-lean` (558.63), ~7 min each.

| arm | delta | SE | 250k | 500k | 750k | verdict |
|---|---:|---:|---:|---:|---:|---|
| `REPAIR_MAIN_MARGIN_MATURE` 1.1 → 1.0 | +0.28 | 0.14 | +0.8 | +0.3 | -0.0 | simplification |
| `REPAIR_MAIN_MARGIN_MATURE` 1.1 → 1.25 | -0.52 | 0.15 | -0.8 | -0.5 | -0.4 | **reject** |
| 0.75 exponent re-pointed at readiness alone | +0.17 | 0.20 | +0.1 | +0.2 | +0.3 | null |
| the three signature exponent gates deleted | **+0.00** | 0.19 | -0.1 | +0.1 | -0.1 | **null** |
| `HANDOFF_FORWARD_EVAL_PACE_START` 1.5 → 2.0 | -1.56 | 1.51 | **-7.2** | -0.2 | +0.0 | **reject** |

**The pace ramp is at its start point for a reason.** Engaging the width
narrowing earlier (slack 2.0 rather than 1.5) costs -7.2 at 250k. Together with
the accepted arm's own bracket this closes the ramp on both sides.

**The repair handover margin is at its optimum.** 1.25 rejects cleanly; 1.0 is
weakly better than the shipped 1.1. The interesting part is not the +0.28 but
that 1.0 makes five hand-carved signature rules (`M101` flat-compact, `M102`
high-air-low-grain, `M108` drums-pulse, `M116` stable-dense, `M144` residual)
into no-ops, since every one of them exists only to force the margin back to
1.0 on a narrow profile band.

**Two documented defects are worth exactly nothing.** `BALLISTIC_READINESS_
CONTRACT.md` and the source comment at `objectiveBlendReadinessPowerForSpec`
both flag that the 0.75 softening has, since `6d064b0` (2026-07-24), been
discounting the ballistic projection as well as readiness — accepted on
2026-07-04 when the objective had no projected term, never revalidated. It
reaches 5 of 44 development cases, all `representative`. Re-pointing it at
readiness alone (the plumbing already exists: `readinessPower` defaults to
following `futureQualityPower`) is +0.17 ± 0.20. Deleting the three gates
outright is **+0.00 ± 0.19** — the tightest null the campaign has produced.

**Decision: retire the vein; retain both simplifications.** Pool size, per-gap
sample count, forward-eval width, pace-ramp start and repair handover margin
have now all been bracketed on both sides and all sit at or beside their
optimum. Eight case-keyed rules are removable at measured parity, which is
worth doing on its own terms but is not headline progress.

**Next.** Re-pricing the accepted archive moved the aim. Air is now worth
+12.23 for a 25% bias removal against the +11.4 that 570 needs, and the seed
spread alone is +13.16 (`valid runs score their cell's BEST` = 571.80).

## 2026-07-28 — the budget-aware sample count was not budget-aware

**Hypothesis.** `budgetAwareQualitySampleCount` exists to scale the per-gap
candidate sample with the budget, but both of its leans terminate below the
range the benchmark measures: the scarce lean fades out by 100k and the mature
lean saturates by 250k. If the shipped 29 is a compromise between two budget
regimes that never actually got to disagree, then sweeping the count should
show the scarce end and the mature end wanting different values.

**Evidence** (`LR_QUALITY_NCAND`, N=8 against `pool-five`, ~7 min per arm):

| nCand | delta | 250k | 500k | 750k |
|---:|---:|---:|---:|---:|
| 16 | -9.57 | -3.1 | -13.7 | -7.0 |
| 24 | -0.26 | **+8.8** | -2.5 | -2.6 |
| 29 (shipped) | - | - | - | - |
| 48 | -2.02 | -4.1 | -3.7 | +2.1 |

They disagree, cleanly and in the direction the dormant lean was written for:
the scarce budget wants a smaller per-gap pool and the mature budgets do not.
A flat re-tune is a wash precisely because it averages the two regimes.

**The change.** Extend the scarce lean into the canonical range — start 250k,
span 200k, floor 24 — giving 24 at 250k, 27 at 350k, and 29 from 450k up. 500k
and 750k are byte-identical by construction.

**Result.** N=8 +1.58 (SE 1.30); N=24 **+1.00**, SE 0.61, CI [-0.71, +2.70],
`inconclusive`. Both untouched budgets measure exactly 0.00, so the whole
effect is the 250k stratum's +4.99 (N=8: +7.9), and validity strictly improves,
3136 → 3144 valid (18 gained, 10 lost). Capability +6.90.

**Decision: retain, promoted as `scarce-lean` (558.63).** The headline evidence
is inconclusive on its own and is recorded as such. It is promoted on the
mechanism rather than the point estimate: a function whose entire purpose is
budget-awareness was returning one identical value at every budget the
benchmark measures, and the fix cannot regress the two budgets it provably does
not touch. Qualification monitor moves 407.55 → 407.33 (monitoring evidence).

**Friction.** `rebaseline --from=` needs the `.json.comparison.json` sidecar,
not the eval `--out=` path; the run archive itself fails with the unhelpful
`unsupported cached comparison artifact`. Also: a baseline archive must hold
exactly 8 canonical seeds per budget, so every promotion resets the cache and
the next N=24 pays a ~14 min `baseline-cache extend` before it can start.

**Next.** The three accepts before this one and this one are all the same
principle — spend a charged simulation only where it changes a decision the
search will act on. That vein is now bracketed on both sides at four sites.
Moving to the post-completion phase, where 500k and 750k (80% of the budget
weight) actually spend their frames.

## 2026-07-28 — the delivered turn IS the incidence, and the incidence is not for sale

Baseline of record for this entry: `segment-refine`, canonical 532.40, cache
[0,8). The tree at `06b4b6e` replays it bit-identically (N=2, delta +0.00 on
every stratum and case), so the engine-speed commits since the promotion are
behaviourally inert and every arm below is attributable. Those commits DO change
the WASM bytes, and `eval` correctly refuses a comparison until the baseline's
own artifact is restored from
`benchmark/v2/runs/segment-refine-compiler-snapshot.tar.gz`.

### The measurement: what the rider rides inside the scoring window

`scripts/v0/study_impact_branch.ts` walks the contiguous surface ahead of each
scored contact and records the branch's angle profile over the deadline distance
(`IMPACT_WINDOW * speed`, about 60 px — the only surface the metric can see),
the frame the rider separates, and the turn accrued by then. 512 committed
contacts over six specs at 250k:

| rotation to the deadline | > +6 deg | +2..+6 | -2..+2 | rotates up |
|---|---:|---:|---:|---:|
| separation frame | 3.68 | 4.81 | 5.52 | 6.0..6.7 |
| delivered / ask | 0.51 | 0.62 | 0.66 | 0.59 |

The rider leaves because the branch curves DOWN out from under it — 92% of
branches are longer than the deadline distance, so it is not running out of
line. Contacts that never separate have rotated +1.50 degrees where the
population mean is +4.98.

**But the turn does not accrue from support.** Holding the caught angle across
the deadline distance and spending the rotation on the rest of the ride-out
(`IMPACT_DEADLINE_KNEE`) moves support at +6 from 60% to 75% and the per-frame
turn does not change at all: 0.99/1.71/4.35/6.99/9.22/10.73/11.74 against
0.94/1.70/4.76/7.82/10.02/11.11/11.91. The delivered turn simply IS the
incidence — 11.74 degrees against a mean incidence of 10.85, and 4.51 against
2.51 in the mid band. Everything else nets out.

So the mid-band shortfall is an incidence shortfall, and it is arithmetic: a
0.25 ask needs 10.4 degrees at speed 10 and the sampler's offset terms supply
2.5.

### Three arms, and the incidence is refuted in its decoupled form too

The 2026-07-27 incidence floor moved `contactAngleDeg` itself, which is also the
reference for the approach, the ride-out and therefore the launch — so it
flattened the whole arc and the arrival speed fell 10.16 to 8.13. This session
separated them: `contactSurfaceDeg` floors only the surface the rider meets
(final approach segment, contact vertex, post branch), leaving every derived
angle on the unfloored reference.

| arm | headline | delta | SE |
|---|---:|---:|---:|
| deadline knee alone | 521.96 | **−10.44** | 4.83 |
| incidence floor 12 deg, decoupled | 510.90 | **−21.49** | 5.27 |
| both | 464.47 | **−67.93** | 3.11 |

Strongly super-additive in the wrong direction. The geometry probe says why:
mid-band delivered impact does rise exactly as designed (0.119 → 0.183, mid
incidence 2.75 → 10.88) and the arrival speed collapses with it, 10.70 → 9.01
across the whole population. **The coupling was not the obstacle — the energy
was.** Turning the rider costs `sin^2(theta)` of its kinetic energy at every
contact, the compiler is already at the equilibrium its speed asks allow, and
there is nothing to spend.

### And the arrival surplus is a marker, not a lever

Splitting committed contacts by the arrival speed's surplus over the gap's own
authored speed ask is the strongest correlate of delivered impact in the
campaign, and it survives controlling for the ask:

```
mid band (ask 0.31)   surplus -0.58  -0.05  +0.48  +1.34   delivered 0.114 0.140 0.202 0.285
high band (ask 0.63)  surplus -0.67  +0.05  +0.57  +1.27   delivered 0.250 0.383 0.508 0.646
```

The mechanism is explicit in the sampler — `brakePressure` flattens the contact
by 18 degrees times the surplus over 6.6 px/frame, `accelPressure` steepens it
by 16 — so the cross-section reads as causal and prices +1 px/frame of surplus
at +0.10 to +0.20 of delivered impact, which is +70 headline.

It is not. Aiming the compiler's own speed targets at the endpoint the impact
ask needs (`ask / cos(neededTurn)`, resolved once in `resolveImpactTargets`,
compiler aim only — the evaluator resolves its own targets) DOES move the rider:
mean arrival surplus 0.10 → 0.71, contact speed 10.70 → 11.22. Delivered impact
moves 0.366 → 0.367. The pressures re-centre on the lifted target, so the
incidence falls by exactly what the speed buys. Two smaller launch arms agree —
targeting the gap MEAN rather than its endpoint (+0.02 surplus), and adding the
next catch's `1 − cos(theta)` energy cost to the drop target with the descent cap
opened to 3.0 (+0.08) — and the campaign's earlier descent-cap sweep already
said the search will not commit a steeper launch.

**So the surplus split was selection.** Contacts that arrive fast are contacts
whose gap went well. This is the second time this campaign has priced a
mechanism off a cross-section and found nothing there; the first was
"impact accuracy is nearly free" in the 2026-07-26 entry.

### Where the headline actually is, priced on the accepted archive

`scripts/v0/study_headline_counterfactual.ts` replays a retained archive through
`v2HeadlineForDecisionRuns` — the exact promotion aggregation — so it reproduces
532.3973 to four decimals and prices a counterfactual with zero compiles:

| counterfactual | headline | delta |
|---|---:|---:|
| every seed scores its cell's BEST | 567.19 | +34.79 |
| every run scores its cell's MEAN | 555.31 | +22.91 |
| **invalid runs score their cell's MEAN** | **555.18** | **+22.79** |
| valid runs score their cell's BEST | 543.71 | +11.32 |
| impact rms x0.75 / x0.5 / x0 | 582 / 630 / 685 | +49.7 / +97.5 / +152.2 |
| air rms x0.75 / x0 | 542 / 556 | +9.6 / +23.3 |
| speed rms x0.75 / x0 | 538 / 546 | +5.8 / +13.6 |
| amplitude rms x0.75 / x0 | 537 / 545 | +5.0 / +12.9 (n=288) |

**The reliability prize IS the validity prize.** Removing all seed-to-seed
variation is worth +22.91 and removing invalidity alone is worth +22.79 of it;
the spread among valid runs is only +11.32. And it is concentrated: two cells
are 0 of 8 — `frontier_pickup_progression_shifted|250k` and
`frontier_dense_recovery_240ms_figures|250k` — with `frontier_dense_recovery`
1 of 8 at 250k.

Every one of them fails the same way, and it is not what the 2026-07-25 entry
assumed: `terminus rideStalled`, contacts hit 90 of 110, and the emitted TRACK
is 1,941 frames of an authored 2,340. The rider is moving at 8-11 px/frame right
to the end — it simply runs off the end of a track the compile never finished
building. Frame accounting on that cell: 73,803 of 250,000 frames go to forward
rollouts, `fwd_rollout_no_candidate` is 769 of 1,453 calls, and the first
complete traversal arrives at frame 271,068.

### ACCEPTED: forward evaluation only refines the head of an ordering the pool already has

`admittedHandoffPool` hands `rankedOptions` eight candidates already sorted by the
free local cost, of which `HANDOFF_BRANCHING` = 3 are expanded, and every one of
the eight then pays a CHARGED forward rollout. The staged path directly above it
already implements the alternative — score a cheap pre-stage, promote finalists —
but it is gated on `forwardStageTop`, which is 0 outside a post-completion env
override. So the pre-prune the campaign has had on its lever list since the
forward-eval entry ("top-k pre-prune, winner mean q-rank 2.6") was never built.

`HANDOFF_FORWARD_EVAL_TOP` builds it: the pre-sorted head is rolled honestly and
the tail is scored without a rollout and sorted behind it. N=8 against
`segment-refine`:

| top | headline | delta | SE | valid | representative | capability |
|---|---:|---:|---:|---:|---:|---:|
| 6 | 528.90 | −3.50 | 4.42 | | | |
| 4 | 531.11 | −1.28 | 5.39 | | | |
| 3 | 534.20 | +1.80 | 5.95 | 1012→1019 | −3.4 | +32.7 |
| **2** | **542.26** | **+9.86** | **2.38** | 1012→1027 | −10.31 | **+126.56** |
| 1 | 526.66 | −5.74 | 2.42 | 1012→1034 | −26.3 | +112.1 |

**An interior optimum, bracketed on both sides.** Narrowing always buys validity
(1019 → 1027 → 1034) and always costs breadth (−3.4 → −10.3 → −26.3); two is
where the two curves cross. This is a continuous trade between how many
candidates a gap ranks honestly and how far the compile gets, not a threshold at
`HANDOFF_BRANCHING` = 3. It buys the dense frontier and it costs breadth:

```
frontier_dense_recovery_240ms_figures  +253.90  valid  9 -> 16
frontier_dense_recovery                +216.81  valid 13 -> 17
frontier_pickup_progression_shifted    +163.65  valid 13 -> 17
frontier_low_air_endurance_6s           -36.29  valid 24 -> 24
frontier_low_air_endurance              -31.52  valid 24 -> 24
sparse_lowline_air_minus_4              -27.32  valid 24 -> 24
```

Validity 1012 → 1027 with none lost, and 500k and 750k reach 352 of 352. The
losers are the LOW-AIR family, which needs breadth to find a long grounded
ride-out — the same population the incidence arm below hurts, for the same
reason: they have the least energy to spare and the most search to do.

`representative` −10.31 [−11.70, −8.92] and `legacy_regression` −19.12 are
significantly negative, so this is a real capability-for-quality trade rather
than a free win; the headline says the trade is favourable and the validity side
of it is a count rather than a noisy score.

### The width should follow the compile's own pace, and then the trade disappears

The bracket says narrowing buys the frontier and sells breadth, so the question
is whether the compiler can tell the two apart at the moment it chooses. It can:
`traversalBudgetSlack` is a regression on contact count and duration, but
`spent / deepestGap * totalGaps` is the compile's own measured cost to reach the
end. `observedTraversalBudgetSlack` blends them by the share of budget already
spent — exactly the prior when nothing has been observed, the evidence once
there is any, and no threshold. The rolled head then runs full width while the
compile is on course and narrows to two once its own pace says it will not
finish.

| arm | delta | SE | repr | capability | legacy | dev-music | valid |
|---|---:|---:|---:|---:|---:|---:|---:|
| flat top-2 | +9.86 | 2.38 | −10.31 | +126.56 | −19.12 | — | 1027 |
| **paced width** | **+9.17** | 4.86 | **+0.42** | +58.5 | **+1.3** | **+0.2** | 1020 |
| paced + attempt-ramped incidence floor | +8.58 | 5.12 | −1.8 | +66.3 | +3.4 | −9.1 | 1027 |
| flat top-2 + attempt-ramped floor | +6.49 | 2.41 | −11.9 | +110.4 | −16.1 | −2.3 | 1031 |

**Same headline, and the trade is gone.** The paced arm keeps
`frontier_dense_recovery_240ms_figures` +272.7 (9 → 16 valid) and
`frontier_dense_recovery` +134.8 while `representative`, `legacy_regression` and
`development_music` all come back to zero or better — where the flat prune was
significantly negative on two of them. It costs half the capability gain and a
wider interval, because it fires on fewer nodes.

The attempt-ramped incidence floor adds validity on both bases (1020 → 1027,
1027 → 1031) and pays for it: `development_music` −9.1 paced, `representative`
−11.9 flat. Its catching surface is real and the population that wants it is
already served by the width, so it stays retired.

### N=24 — ACCEPTED, +10.66

`npm run benchmark -- eval --seeds=24 --jobs=48`, after extending the baseline
tail by 16 slots (2,112 baseline compiles) — 3,168 candidate compiles:

```
headline 531.29 -> 541.95   delta +10.66   seed-block SE 1.98   95% [+5.13, +16.19]
RESULT: STRONGER THAN BASELINE          promotable
validity 3027/3168 -> 3065/3168  (gained 49, lost 11)
  250k  -0.47
  500k  +10.33
  750k  +18.63
strata
  representative      +0.20
  capability         +70.02
  legacy_regression   +0.16
  development_music   +0.02
```

Every stratum non-negative and one strongly positive, which no arm in this
campaign has managed before; the gain is monotone in budget, which is what a
mechanism that stops wasting a scarce resource should look like — the more
budget there is, the more of it the paced width leaves for depth. The flat
prune's +9.86 is inside this interval and its shape is strictly worse, so the
pacing is what is promoted rather than the prune.

### The same rule on the second lookahead consumer: the aiming lane

The enumerative proposer fits a local response model by SIMULATING a probe
design per base, and it is the compiler's second largest lookahead spend:
measured on `frontier_dense_recovery` at 250k it charges 42,859 of 250,851
frames — 17% of the budget — on a compile that never finishes building its
track. Holding it to the same rule (`AIM_LANE_PACE_SUPPRESS`: the lane runs
while the compile is on course, and not once its own pace says it will not
finish) takes that cell from 78 to **108 of 123 committed contacts**.

N=8 against `paced-forward-eval-width`:

```
headline 541.57 -> 548.54   delta +6.97   SE 4.90
validity 1020/1056 -> 1032/1056
  250k +4.1   500k +12.3   750k +0.1
strata  representative 0.0 | capability +46.5 | legacy_regression 0.0 | development_music 0.0
  frontier_pickup_progression  +119.0  valid 16 -> 21
  frontier_dense_recovery       +98.6
  frontier_low_air_endurance_7s +55.3  valid 23 -> 24
```

**Three strata are exactly zero** — the pace gate never fires on a compile that
finishes, so 85% of the headline weight is byte-identical and the whole movement
is on the frontier that was failing. It reads inconclusive only because
`capability` carries all of the variance.

**Falsified in the same batch: pacing the per-gap SAMPLE COUNT.** Cutting `nCand`
by up to half on the same signal takes `frontier_dense_recovery` back from 108 to
83 committed contacts and drops `river_reentry` from 24 full evaluations to 3 —
the early-compile pace estimate is pessimistic before any gap has been reached,
so a breadth cut fires on healthy compiles too. Lookahead is refundable; the
pool that lookahead ranks is not.

### Two more closures on the improvement phase and the air axis

**The ride-out does not hold because it is short — and holding it straight is
worse.** The air axis inverts into a grounded ride-out LENGTH, and none of the
length controls bind: the reference cap replaced by the detector's physical
landing floor is +0.002 of bias, the blend floor at 0.5 and the blend strength at
0.85 are flat, and raising the 220px clamp to 360 is BYTE-IDENTICAL. Holding the
caught angle for the distance the air ask wants grounded — the same shape that
raised supported-at-+6 from 60% to 75% — makes the capped population WORSE, air
bias +0.110 -> +0.123. The rider on those gaps is bouncing rather than riding, so
a branch that rotates down follows it and re-contacts while a straight one lets
it bounce over. Air is not a length problem.

**The post-completion staged rollout is inert.** `forwardStageTop` has been
present and off since it was written; turning it on at 4 (so only four finalists
pay the full-depth rollout after the first completion, which is where 500k and
750k spend most of their budget) is **+0.10 with SE 0.24** — the cleanest null in
the campaign.

### The fifth closure: supplying the energy directly does not move impact either

Every impact arm this session ended at the same explanation — turning the rider
costs `v^2 sin^2(theta) / 2` of kinetic energy and nothing replaces it, because
the energy-targeted launch only converts the rider's PACE to the gap's ask and is
capped at `LAUNCH_DESCENT_CAP * g * N` besides. Elevation is unauthored in this
distribution, so height is free here exactly as grain was for the segment
refinement, and `netDyToElevation` is the axis's own inverse. Commanding each
gap's drop to be the drop its next contact's turn will cost — resolved through
`elevationToLaunchVy` against the band the speed supports, `min(g*N,
VERTICAL_FRACTION * speed)`, which on a dense gap is 2.2x what the descent cap
allows and reached by a path that cap does not bound — is the direct test of that
explanation.

It arrives and it does not convert: arrival speed 10.62 -> 10.78, surplus 0.10 ->
0.22, delivered impact 0.363 -> 0.360, mid-band incidence 4.19 -> 4.14. Reverted.

So the energy account was the right diagnosis of why the earlier arms failed and
is not itself the lever: paying the bill does not buy the turn, because what
converts speed into incidence is the sampler's `brakePressure` against a target
that moves with the rider. Five independent mechanisms this session — support
through the window, the decoupled incidence floor, the speed-target lift with
un-lifted pressures, the launch turn-loss term, and now the commanded drop — all
land within 1% of the same impact bias.

### Falsified: stratifying the candidate pool's wide tail

With validity nearly spent, the priced prize moved: on the accepted archive
giving every VALID run its own cell's best score is worth **+14.18**, more than
the +8.93 left in validity. That is search variance under a fixed budget, and the
textbook answer is to stop sampling the pool independently. The sampler half
does it already — `ccGuidedRoll` stratifies against the attempt index through
`lowDiscrepancyRoll` — but the guide weight decays as `1/(1+(attempt/4)^2)`, so
the wide tail that supplies most of the pool is drawn independently. Stratifying
that tail costs no draws: the RNG stream is consumed identically.

It is **−11.60**, with `capability` −38.0 and validity 1042 → 1035, and the case
table says exactly what was traded:

```
frontier_low_air_endurance_7s        +107.3  valid 23 -> 24
frontier_pickup_progression_shifted  -115.1
frontier_dense_recovery               -98.1  valid 20 -> 18
dense_dialogue_impact_contrast_10     -79.7  valid 24 -> 21
```

Even coverage helps the case that needs a well-covered knob space and hurts every
case that needs a RARE draw. On the dense frontier a viable catch is a small
region the pool finds by luck, and independence is what buys the lottery tickets;
a covering sequence spends the same draws on the space's middle. The pool's
randomness is not a defect to be averaged out — it is the search's only source of
the improbable.

### The largest un-attacked population: 35% of contacts BOUNCE

`study_impact_branch.ts` now splits scored contacts by whether support goes
supported → airborne → supported inside the window. Over 532 committed contacts:

| population | n | ask | delivered | share | turn | incidence | rotate-to-deadline |
|---|---:|---:|---:|---:|---:|---:|---:|
| bounces in window | 184 (35%) | 0.520 | 0.273 | **53%** | 10.50° | 11.27° | **+5.27** |
| no bounce, separates | 108 (20%) | 0.588 | 0.366 | 62% | 14.00° | 15.06° | +6.92 |
| **no bounce, held** | 240 (45%) | 0.554 | 0.430 | **78%** | 16.72° | 14.97° | **−1.06** |

The held population is the only one whose TURN EXCEEDS ITS INCIDENCE — a concave
branch keeps turning the rider after the impulse — and it rides the only surface
that rotates UP across the deadline. Bouncers deliver 0.8 degrees LESS than their
incidence and leave at frame 3.03 against 4.94 and 7.

Bringing the 184 bouncers to the held population's 78% would be +0.047 of mean
delivered impact, about **+33 headline** at the campaign's 7-points-per-0.01 —
the largest single population left, and the impact axis's error concentrated in
one physically-named failure.

**Not an impulse-granularity problem.** Doubling `IMPACT_SEGMENT_REFINE` to 4
takes bounces only 184 → 170 and their delivery 0.273 → 0.286, with the
population mean unmoved at 0.363.

**And the bounce is removable — removing it does not pay.** The held group's
branch rotates only −1.06 degrees across the deadline, so the shape it needs is a
SHALLOW valley rather than the template's, and building one directly into the
ordinary branch (rise across the window's own share of the ride-out, scaled by
the ask) works far better than any template gate ever did:

| window rise per unit ask | bounces | held | delivered | arrival speed |
|---|---:|---:|---:|---:|
| 0 (shipped) | 184 | 240 | 0.363 | 10.67 |
| 1.5 deg | 68 | — | 0.348 | 10.33 |
| 3 deg | 68 | — | 0.346 | 10.26 |
| 6 deg | **75** | **351** | 0.341 | 10.12 |

**Bounces fall 59% and delivered impact falls with them, at every dose.** The
mechanism saturates immediately — 1.5 degrees removes as many bounces as 6 — and
the cost does not: riding up the valley brakes the rider, and the metric
multiplies the speed it takes. This is the sixth closure of the impact axis this
session and the most complete: the bounce is a real, large, correctly-identified
failure, and the branch shape that fixes it costs more than the turn it recovers.

### The correction the six closures point at: normal forces do no work

Every impact closure this session was explained as "turning the rider costs
kinetic energy nothing replaces". That is true of a COLLISION and false of a
CURVE. A surface exerts only a normal force, and a normal force does no work on a
rider sliding along it — a smooth curve redirects the velocity for free. The
energy account is therefore not a property of turning; it is a property of two
specific things:

1. **discrete impulses**, which kill the normal component and cost
   `v(1 − cos θ)` per vertex — the polyline's price, and why the accepted
   segment refinement paid;
2. **net climb**, which is potential energy — and why the shallow valley above
   brakes: it turns the rider by rising, and pays gravity for the privilege.

That is exactly what the held population's numbers say. Its turn EXCEEDS its
incidence — more rotation than the impulse delivered — because the surface keeps
turning it afterwards, and it does so at the HIGHEST arrival speed of the three
groups (10.72 against 10.55). Free turning is already visible in the data.

So the open question is sharper than "the energy is not there". It is: what
surface turns the rider through the scored window while its height still FALLS?
The arrival is descending and a catch must present a surface no steeper than the
arrival, so the vertex turn is upward by construction — but the rotation AFTER it
need not climb if the branch starts steep enough to keep descending while it
curves. Nothing in this session tried that shape; every valley arm rotated up
from an already-flat contact and paid for it in height.

### THE CEILING, correctly stated at last: there is no descending rotation left

The correction above predicts a specific shape — meet the rider on a surface
closer to its arrival, then curve down to the flattened angle across the window,
so the same heading is reached at the deadline by free curvature instead of a
lossy impulse, while descending the whole way. Measured (`ENTRY_CURVE_SHARE`,
share of the flatten moved from vertex to curve):

| share | delivered | arrival speed | turn | incidence | free rotation past the impulse |
|---|---:|---:|---:|---:|---:|
| 0 (shipped) | 0.363 | 10.67 | 14.02° | 13.71° | **+0.31°** |
| 0.25 | 0.340 | 10.51 | 13.20° | 11.61° | +1.59° |
| 0.50 | 0.340 | **10.74** | 12.86° | 9.61° | **+3.25°** |

**The physics is confirmed and the ceiling is elsewhere.** At share 0.5 the
arrival speed is fully preserved — 10.74 against the shipped 10.67, the first
arm all session to add turn-shaping at no speed cost — bounces fall 184 → 50, and
the branch delivers **ten times** the post-impulse rotation the shipped one does.
Free turning is real and the compiler was not using it.

It still loses, and the reason is geometric rather than energetic. The catch
surface is ALREADY nearly horizontal: the carrier flattens `contactAngleDeg` to
about +2 degrees against a 13-degree descending arrival. Rotation that keeps
descending is rotation between the arrival angle and horizontal, and the vertex
impulse has already spent all of it. Everything past horizontal is climb, which
is what every valley arm paid for. So moving turn from impulse to curve cannot
ADD turn here — it can only re-allocate the same 13 degrees, and it gives up more
at the vertex than the capped window share returns.

**Which names the one lever that remains.** More descending rotation requires a
STEEPER ARRIVAL — more angle between the incoming heading and horizontal. That is
the steep-arrival dive, already accepted twice this campaign, and its cap is the
AIR axis: a deeper dive lengthens the flight (+0.062 air bias at a 30-degree
delta cap). So the impact ceiling on this suite is an AIR ceiling wearing
impact's clothes, and the open question is the one the 2026-07-27 entry left:
buy the arrival with SLOPE instead of flight time.

### And the lever that names closes too: slope cannot be bought by length

The entry above ends by naming the 2026-07-27 lever — buy the arrival with SLOPE
instead of flight time — so it was built: when the steep-arrival dive fires,
extend the grounded ride-out in proportion to the commanded dive, so the same
vertical velocity is reached on the ground instead of in the air.

It does nothing for air and costs impact: air bias +0.0427 → +0.0445 with its rms
0.1083 → 0.1229, delivered impact 0.363 → 0.354, and 13 of 532 scored contacts
lost. The reason is the one the air-length work already established and this
confirms from the other side: **the rider does not ride to the end of the
branch.** Lengthening the line cannot keep it grounded, exactly as raising the
reference cap, the blend floor, the blend strength and the 220px clamp could not.

So the air ceiling that caps the dive is not a line-length ceiling either. Every
lever this campaign has named — including the ones its own log left open — has now
been measured.

### The separation primitive is not smooth curvature

The one thing left unexplained was why the rider leaves a branch that is still
there. The rigid-body criterion is exact and computable — a rider holds while
`v^2 * kappa < g cos(theta)`, which at the measured operating point (v 10.7,
g 0.175) is 0.088 deg/px, or 5.3 degrees across the 60px the metric sees — and
the population split sits exactly on it: the branches that lose the rider rotate
+5.27 and +6.92 across the deadline, the ones that hold rotate −1.06.

Capping the branch's per-segment DOWNWARD rotation at that limit — which adds no
climb and so cannot brake — binds as intended (mean rotation across the deadline
2.75 → 1.82 degrees) and changes nothing else: delivered 0.363 → 0.360, bounces
184 → 179, held 240 → 249, air bias +0.0427 → +0.0465.

So separation is NOT governed by the smooth-curvature criterion. It is governed
by the bounce — 35% of contacts — and by the articulated sled, whose points leave
and return on their own dynamics rather than the centre of mass's. That is the
primitive the next attempt has to model, and no arc-shape lever in this
vocabulary reaches it.

### The bounce is invariant to everything the arc vocabulary controls

Four independent controls, all measured against the bounce rate of 184 in 532:

| control | bounces | delivered |
|---|---:|---:|
| shipped | 184 | 0.363 |
| segment granularity (`IMPACT_SEGMENT_REFINE` 2 → 4) | 170 | 0.363 |
| ballistic curvature limit enforced | 179 | 0.360 |
| contact surface lifted 1.5px toward the rider | 186 | 0.356 |
| shallow valley across the window (6 deg/ask) | **68** | 0.341 |

Only the valley moves it, and only by turning the rider with a climb it pays for
in speed. Granularity, the exact rigid-body curvature limit, and the contact
depth — which is the one control that reaches the sled rather than the centre of
mass, meeting the rider earlier in the same fall at a lower normal closing speed
— all leave it within 3%.

**Resolved at depth: the no-convexity zone is a null.** It reads +0.98 with
SE 0.97 at N=8 and **−0.23 [−1.60, +1.15] at N=24**, validity 3131 → 3129. The
N=8 positive was noise, and the deeper run is what a +1 point estimate on a 1.0
standard error deserves before anyone promotes it.

A fifth control tests the finite-body reading directly — the rider is not a
point, so a convexity gentle for the centre of mass can still be sharp under the
15px sled, and bouncers arrive with LOWER normal closing speed than holders (2.06
against 2.77 px/frame), which rules impact severity out. Forbidding DOWNWARD
rotation over the first sled length is the first intervention that improves the
bouncers themselves — their delivered impact 0.273 → 0.306 and their turn 10.50 →
11.93 degrees — and the population nets exactly flat at every dose (8px 0.365,
15px 0.363, 25px 0.362 against 0.363), because the holders give back what the
bouncers gain.

So the bounce is a property of the articulated rider meeting a surface at these
arrival speeds, not of anything the arc vocabulary shapes. Its 25-point delivery
gap (53% of ask against 78%) is the largest identified prize left on this suite
and it is not reachable from geometry; reaching it means modelling the sled's
own response, which is a different project from arc placement.

### The template gates were never a ranking artefact

The impact template lane builds exactly the concave shape the bounce measurement
identifies as best-delivering, and its gates were refuted against
`dive-span-floor` — three baselines and, more to the point, one readiness refit
ago, with `impactFeasibility` since improved 71%. If the search had been
declining the converting shape out of a bad estimate, this is where it would
show.

It does not. Lane rate ⅓ → 0.66 under the refit ranker is **−5.26 (reject)**,
against the −4.06 the same arm measured under the old one: `representative` −6.3,
`legacy_regression` −8.1, `development_music` −7.0, and the loss deepens with
budget (250k −2.7, 500k −4.4, 750k −8.4). `frontier_pickup_progression` −52.2 and
`high_air_drive` −34.5 carry it.

So the search declines the template for reasons its ranker gets RIGHT, and a
better ranker declines it harder. Combined with the bounce work above — where the
shallow valley removes 63% of bounces and loses anyway — the converting shape is
closed from both the geometry side and the ranking side.

### ACCEPTED: the pool is larger than the width the search can rank

The accepted forward-eval prune stops paying for rollouts on candidates the
search will not expand. One layer down, the pool's own per-candidate PREVIEW is
also a charged simulation — so with the rolled head at 2 and `HANDOFF_BRANCHING`
at 3, a pool of eight was paying preview cost for candidates it could neither
rank honestly nor expand.

| pool | delta (N=8) | note |
|---|---:|---|
| 3 | +1.83 | |
| 4 | −3.54 | capability −34.8 |
| **5** | **+3.32** | every stratum and budget positive |
| 6 | +2.28 | |
| 8 | shipped | |

An interior optimum with a sharp hole at 4. N=24:

```
headline 553.53 -> 557.71   delta +4.18   seed-block SE 1.66   promotable
validity 3131/3168 -> 3136/3168
  250k +2.75   500k +6.07   750k +1.99
strata  representative +2.50 | capability +15.03 | legacy_regression +0.02 | development_music +3.41
```

This is the third accept from one principle — spend a charged simulation only
where it changes a decision the search will act on — after the paced rolled head
and the paced aim lane.

### The engine-speed commits are behaviourally inert, verified

`eval` refuses a comparison when the WASM bytes differ from the baseline's, so
the four engine commits of 2026-07-27 were disabled all session by restoring the
retained artifact. They cost nothing: compiled against each artifact in turn,
`river_reentry`, `dense_dialogue` and `frontier_dense_recovery` produce identical
line counts, committed gaps, sim-frame totals and durations (951/88/250117,
960/130/254805, 1197/123/260967). They are pure speedups, so the working
artifact can be rebuilt and re-frozen into a baseline whenever convenient with no
score consequence — only the comparison lock requires the swap.

### The branching factor is at its optimum, bracketed both ways

The forward-eval width bracket implied that search width is the live parameter,
so the actual branching factor was bracketed directly: `HANDOFF_BRANCHING` 2 is
**−8.16** (validity 1042 → 1020, `representative` −9.2, 250k −20.1) and 4 is
**−4.32** (`capability` −17.7, `development_music` −17.8). 3 is the peak.

Two brackets in one session then agree on the shape without agreeing on the
parameter: narrowing the ROLLED head to 2 pays +9.86 while narrowing the EXPANDED
tree to 2 costs 8.16. What the accepted mechanism buys is not a narrower search —
it is not paying to rank candidates the search will not expand.

### Two scorer-alignment nulls, and where the ranking actually happens

`axisCost` weights every axis 1 except `impact` at 0.5, while the headline
weights air/speed/impact 0.3 and amplitude 0.1 — so on the 288 amplitude-authored
gaps it valued amplitude error three times what the headline pays. Correcting it
is **byte-identical on every case**, which locates the ranking: `axisCost` is a
tiebreak, and the pool is ordered by `sortCandidatesByQuality`. That also
explains the 2026-07-26 result that moving `LOCAL_IMPACT_COST_WEIGHT` to 1 "moves
nothing" — it was never the deciding function.

The same misalignment IS present where the decision happens.
`scoreProjectedOutgoingAxes` pools axis errors through
`axisQualityFromErrors`, an UNWEIGHTED rms, so on an air+speed+amplitude gap the
search weights amplitude a third against the headline's 14.3%. Scaling each error
by `sqrt(w / mean w)` before the pooling makes that rms the weighted one without
touching `score.ts` or the suite fingerprint — and it is **−0.54 with SE 0.49**.

So the search's equal pooling is not costing the headline anything: the axis it
over-weights is the one whose error it can least change, and correcting the
weights just moves effort onto axes that were already at their limit.

### The pool's two populations cannot be told apart

The flat stratification's case table is a split, not a null, so it was gated
three ways. None separates the populations:

| gate | `low_air_endurance_7s` | `pickup_progression_shifted` | headline |
|---|---:|---:|---:|
| none (flat) | +107.3 | −115.1 | −11.60 |
| air ask below 0.45 | — | — | dense_recovery 108 → 68 commits |
| gap room (`denseContactPressure`) | — | — | dense_recovery 108 → 51 commits |
| attempt index, tail left random | +110.3 | −106.7 | −2.09 |

The air ask fails because both populations author 0.248. Gap length fails
because the per-gap spread is what matters and the mean hides it — and both
gates collapse `frontier_dense_recovery`, which the attempt gate instead takes
to **123 of 123 committed contacts at 250k**, the only configuration all session
to finish that spec at the scarce budget.

The dose is bracketed too — strength 0.25 is −1.95 against 0.5's −2.09, with
`pickup_progression_shifted` at −107.6 either way — so the trade is structural
rather than a matter of degree.

The attempt gate is the right shape and still not enough: coverage is worth +110
to the case whose ride-out lives in a wide continuous range and −107 to the case
whose viable catch is a rare small region, and no quantity measured this session
tells those two apart. They are both `capability` frontier cases with the same
authored air and opposite needs from their pool.

### Repair looks wasteful and is at its optimum

With the pacing accepted twice, the remaining budget question is the repair
phase, and its accounting looks damning. At 500k it spends **43-59% of the whole
budget** — `river_reentry` 252,092 frames on 5 restarts, `open_hook` 295,304 on
4 — for one to three accepts, and full evaluations fall as a result:
`river_reentry` 39 at 250k against 14 at 500k, `open_hook` 59 against 10. At 250k
it is 21-42 restarts for zero or one accept.

Both ways of cheapening it are rejected. Each restart is sized to the measured
cost-to-end, so an early anchor costs nearly a whole recompile; `upstreamOrder`
gives that expensive early anchor first claim. Flipping to `nearest-first` is
**−3.28 (reject)**, every stratum negative. Giving the main search half again as
much before repair begins (`mainMargin` 1.1 → 1.5) is **−1.89 (reject)**, every
stratum negative and every budget.

So the expensive early-anchor restart earns its cost: it can alter the weak gap's
inherited ARRIVAL, which is the one thing a cheap local restart cannot do, and
the comment that shipped that choice was right. Repair is not the pacing family's
next target — it is already paying for what it takes.

### Falsified: rushing the first completion — and it bounds the pacing family

The budget decomposition says where the headline is lost: at 250k the accepted
compiler scores 508 and at 750k it scores **569 on its own**, and the difference
is almost entirely how much budget is left after the first complete track.
Measured on the healthy representative cases at 250k, the first completion costs
**65-82% of the budget** — `river_reentry` 186,796, `dense_dialogue` 204,121,
`open_hook` 162,026 — so only a fifth to a third of the compile is spent
improving. At 750k that same ~180k is a quarter of the budget.

The obvious inference is that lookahead before the first completion is ranking
two speculative futures against nothing, so it should be bought at the narrow
width and opened up afterwards. It does what it says — first completion
186,796 → 167,626 on `river_reentry`, 162,026 → 149,111 on `open_hook` — and it
is **−4.11**, with `representative` −8.7, `legacy_regression` −15.7 and 750k
−12.1.

The reason is visible in the same probe: full evaluations collapse 24 → 5 on
`river_reentry` and 55 → 3 on `countercurrent`. **The pre-completion search is
not speculative — it is choosing the prefix the whole track is built on**, and a
narrow prefix arrives sooner at a path the improvement phase cannot escape.

That bounds the whole pacing family, and explains why the two accepted arms
work: they narrow only where the compile's own pace says it will NOT finish, so
the prefix they degrade is one that was going to score zero. Where a completion
is reachable, breadth in the prefix is worth more than the budget it costs.

### The readiness model was stale after all — well calibrated, badly fit

`SAMPLER_FILES` includes `arc_placement.ts`, so the corpus behind
`optimizer/readiness_model.json` predates the steep-arrival dive, the span
floor and the segment refinement. The 2026-07-25 entry declined to recollect on
the argument that the failure was generation rather than ranking; with the
generation questions closed, the argument no longer holds.

Collecting a fresh canonical corpus is cheap — 132 compiles, 132,647 contexts,
about four minutes — and it first says the incumbent is FINE: catchability
AUC 0.844 development / 0.839 validation, ECE 0.034, composite r 0.646/0.634.
Calibration is not fit, though. Refitting on that corpus improves the
decision-seed composite MSE by **80.9%** and the trainer's own rule adopts it.

N=8 against `paced-aim-lane`:

```
headline 548.54 -> 553.07   delta +4.54   SE 5.78
validity 1032/1056 -> 1048/1056        (only 8 invalid runs left in the suite)
  250k +15.0   500k +3.4   750k -0.5
strata  representative -1.7 | capability +44.4 | legacy_regression -9.6 | development_music +1.0
  frontier_pickup_progression_shifted  +90.1  valid 15 -> 22
  frontier_pickup_progression          +73.3  valid 21 -> 24
  frontier_dense_recovery_240ms_figures +36.3 valid 20 -> 23
  regression_transition_mosaic         -17.1  valid 24 -> 24
```

A better ranker converts almost entirely into validity at the scarce budget
(+15.0 at 250k, −0.5 at 750k) and costs quality where the old model's biases
happened to suit the case.

**N=24 settles it at +2.96 [−3.78, +9.70], not promotable**: validity
3089 → 3136 (gained 52, lost 5) against `representative` −4.21,
`legacy_regression` −9.09 and `development_music` −1.32, with capability +45.87.
Retired, and the model reverted.

**Why the 80.9% did not arrive.** Per component the refit improves `airFit` by
90.2%, `impactFeasibility` by 71.4%, `speedFit` by 51.2% — and `catchability`,
the factor that actually gates whether a catch lands, by 3.1%. The composite the
adoption rule scores is dominated by `airFit`, which
`readiness_scoring.ts` deliberately EXCLUDES from the readiness product on the
argument that it carries no information the incoming boundary can change. So the
trainer adopts on a metric the compiler does not use. The rule should be scored
over the components the product multiplies; that is the fix a future retrain
needs before this lever is worth re-opening, and it is why an 80% model gain is
worth three headline points.

**ACCEPTED, once the components are separated.** Projecting the training dataset
onto the incumbent's own 80 columns makes the refit's components interchangeable
with the shipped ones, and the attribution is clean:

| readiness components refit | delta (N=8) | representative | legacy | capability |
|---|---:|---:|---:|---:|
| all four | −2.87 | −2.6 | −13.1 | +2.2 |
| **catchability + impactFeasibility** | **+5.20** | **−0.7** | **−3.9** | **+41.3** |

`speedFit` carries the entire damage — which is exactly the component the
adoption rule had no business selecting, since the composite it scored was
dominated by the `airFit` the product excludes. N=24 on the retained hybrid:

```
headline 547.48 -> 553.53   delta +6.05   seed-block SE 2.20   promotable
validity 3089/3168 -> 3131/3168  (gained 46, lost 4)
  250k +4.24   500k +10.80   750k -0.67
strata  representative -1.36 | capability +49.70 | legacy_regression -3.92 | development_music -1.26
```

**And the loop converges in one round.** Recollecting under the promoted model —
the shipped hybrid measures composite MSE 0.0182 on its own corpus against the
0.0409 the old model measured on the previous one — and refitting again adopts
(55.6% composite improvement) and is worth **−0.47** on the headline, trading
capability −13.1 for representative +1.6 and legacy +2.8. One refit is the whole
prize; policy iteration on this model does not compound.

**Tooling fix required to get there**: `train_readiness.py` demanded that the
incumbent artifact's feature list EQUAL the corpus's, which is the stale half of
the extractor/model split `readiness_scoring.ts` documents as deliberate — the
incumbent declares 80 of the extractor's 88 columns. The check is now a subset
check with a projection wherever the incumbent is evaluated, exactly as the
TypeScript side already does.

### The incidence floor is a VALIDITY mechanism, not an impact one

Reading the refuted arm's own case table settles what it was actually doing:

```
frontier_dense_recovery_240ms_figures  +220.55  valid  9 -> 23 of 24
frontier_dense_recovery                 +84.86  valid 13 -> 19
dense_dialogue                         -118.56  valid 24 -> 24
frontier_low_air_endurance_6s           -96.15  valid 24 -> 24
```

validity 1012 → 1041, capability +31.48, representative −31.10. A surface
further across the arrival is a surface that CATCHES — it intercepts a rider the
aligned surface passes through — and it costs `1 − cos(incidence)` of the speed
to do it. Where the search is landing its catches that is pure loss; where it is
failing to land any it is the difference between a scored run and a zero.

So the floor belongs where the ordinary sample has already failed, and the
compiler's own measure of that is the ATTEMPT index. Ramping the floor across the
attempt span leaves the guided prefix at the shipped surface and offers the
catching one in the wide tail that a healthy gap never reaches. Not yet measured
at the time of writing.

### Falsified: pacing the forward-eval gate on the compile's own progress

`HANDOFF_LOW_SLACK_BRANCH_THRESHOLD` disables pre-completion forward evaluation
below a slack of 1.5, and `traversalBudgetSlack` is a regression on contact count
and duration that reads 1.52 on the cell it decides — a 1.65x underestimate of
that cell's true cost. Replacing it with a blend of the prediction and the
compile's own measured pace (`spent / deepestGap * totalGaps`, weighted by the
share of budget observed, so it is exactly the prior when nothing is observed)
fires as designed and makes the cell WORSE: rollout frames 73,803 → 39,498 and
committed gaps 110 → 89. Pre-completion forward evaluation is not only a quality
refinement — it is what advances the frontier. Reverted.

## 2026-07-26 — where the headline actually is: impact, and it is steering

Every entry before this one attacks the SEARCH. This one starts from the
scorer's own error budget and arrives somewhere else.

### The instrument: exact counterfactual re-scoring, zero compiles

`weightedAxisRms` is `sqrt(sum(w * rms_axis^2) / sum(w))` and the run score is
`1000 * exp(-rms / 0.25)`, so a per-gap axis archive can be re-scored under any
counterfactual and re-aggregated through the exact hierarchy. Replaying the
accepted baseline archive unchanged reproduces `498.9141` to four decimals, so
the tool is the evaluator, not a model of it.

Where the squared weighted error sits (974 valid runs, 87,453 scored contacts):

| axis | rms | mean signed | share of weighted SSE |
|---|---:|---:|---:|
| **impact** | **0.2223** | **−0.1713** | **54%** |
| amplitude | 0.2373 | −0.1275 | 19% |
| speed | 0.1142 | −0.0446 | 14% |
| air | 0.1090 | +0.0476 | 13% |

Every axis is biased the same way — too much air, too little speed, impact and
amplitude — but impact is the only one that pays: removing its bias alone is
worth **+66.8 headline** (498.91 → 565.72), against +2.9 for amplitude, +1.8 for
speed and +1.8 for air. Bias is 58% of impact's MSE. The conversion is roughly
**7 headline points per 0.01 of mean impact**, priced directly:

```
uniform lift of achieved impact   +0.02  +0.04  +0.06  +0.08  +0.10  +0.12
headline delta                   +14.2  +27.4  +39.4  +49.7  +58.1  +64.1
```

### The diagnosis: the undershoot is on the EASY asks

Splitting by whether the authored ask is inside the ballistic feasibility bound
(`substrate.ts impactFeasibilityBound`, a diagnostic that never touches the
target) settles what kind of failure this is:

| population | n | ask | bound | achieved | delivered |
|---|---:|---:|---:|---:|---:|
| ask ≤ bound | 13,178 | 0.250 | 0.591 | 0.136 | **55% of ask** |
| ask ≤ bound | 23,633 | 0.360 | 0.570 | 0.190 | **53% of ask** |
| ask ≤ bound | 6,064 | 0.590 | 0.703 | 0.514 | 87% of ask |
| ask ≤ bound | 3,527 | 0.792 | 0.914 | 0.705 | 89% of ask |
| ask > bound | 15,972 | 0.620 | 0.511 | 0.447 | 88% of BOUND |
| ask > bound | 20,570 | 0.786 | 0.539 | 0.555 | 103% of BOUND |

**The compiler is at the physical limit whenever the ask is hard and leaves half
of an easy ask on the table** — on contacts carrying 0.21–0.34 of bound
headroom. It is not a capability ceiling and not a budget question: the bias is
−0.170 / −0.174 / −0.169 at 250k / 500k / 750k.

Two more measurements make it steering rather than ranking:

- **No axis trade.** Within one (spec, gap) across seeds, a larger delivered
  impact correlates −0.14 with |speed error| and −0.03 with |air error|. Impact
  accuracy is very nearly free, and across seeds a lower impact rms goes with a
  HIGHER run score (r = −0.71).
- **The pool already contains it.** Per contact, the best of 24 runs delivers
  +0.144 more impact than the mean run; 41.5% of contacts are hit by at least
  one run and 3.4% on average. Replacing each contact by its own best-across-runs
  value takes impact rms 0.212 → 0.104.

### The reframing this forces: validity is an +11 prize, impact is a +67 one

Priced on the same instrument, giving **every** invalid run the mean score of
its own (spec, budget) valid runs is worth **+11.3** headline (498.91 → 510.21).
That is the whole of the `frontier_dense_recovery` capability debt that the
previous entry names as "the largest single prize left", plus every other
invalid run in the suite, and it is a sixth of what the impact bias costs.

The arithmetic is the aggregation's: `capability` is 15% of the headline and its
`dense_recovery_frontier` group is one of three, while impact is 30% of the axis
weight on all 44 cases at all three budgets. Nothing about the earlier
diagnosis was wrong — the deficit is real and its shape was correctly
identified — but it is not where the headline is.

### The mechanism: a hand-placed onset in the carrier's ask ramp

`arc_placement.ts impactCurvePressure` is
`smoothstep((ask − 0.25)/0.40) * smoothstep((speed − 6)/4)`. Observed speeds are
9–11.4 px/frame, so the speed factor is 0.94–1.00 and inert; the ask factor is
**0.04 at a 0.30 ask and 0.32 at 0.40**, reaching 1 only at 0.65. That pressure
scales the whole carrier: the contact-angle flatten (18°), the front-loaded
post-contact curvature (−1.6), the post-turn sampler and the template lane.

The delivered share of the ask tracks that pressure, not the ask:

```
ask 0.62-0.75   P=0.0 -> 0.195   P=0.6 -> 0.474   P=0.8 -> 0.673   P=1.0 -> 0.766
ask 0.50-0.62                    P=0.4 -> 0.555   P=0.6 -> 0.688   P=0.8 -> 0.789
d(achieved)/d(ask)  = 0.25 inside the dead zone, > 1.0 across the ramp
```

Hypothesis: the ask→pressure map, not the carrier's authority, is what leaves
the reachable asks unserved. Boundary: one continuous map from an authored input;
no case identity, no budget or failure keying.

### Falsified first, cheaply

`LOCAL_IMPACT_COST_WEIGHT` (`LR_IMPACT_LOCAL_W`, flat 0.5) is a documented,
deliberate 2:1 divergence from the scorer's equal axis weighting. Setting it to
1 at N=8 (1,056 candidate compiles, 7m17s) moves **nothing**: delta −0.02,
validity identical 974/1056, and the impact bias is unchanged to four decimals
(−0.1713). It survives only as a tiebreak, exactly as §5.7 of
`BALLISTIC_READINESS_DECISIONS.md` predicted. Retired.

The same run established the reference point: the tree at `85e9d96` is
**bit-identical** to the accepted baseline (delta +0.00 on every budget, stratum
and case, validity 974/1056 → 974/1056), so the `arc_model.ts` /
`arc_vector_model.ts` drift noted in §13 of the decisions doc is behaviourally
inert and every arm below is attributable.

### Batch 1 — the carrier's ask pressure is refuted, monotonically

Five arms at N=8 (1,056 candidate compiles each, ~7m15s each, ~37min total),
all env-configured against the same cached baseline prefix. The carrier arms
move the ask→pressure map's onset to 0 and vary where it reaches full pressure.

| arm | headline | delta | valid | representative | capability |
|---|---:|---:|---:|---:|---:|
| onset 0, full at 0.65 | 498.08 | −0.83 | 974→1007 | −11.94 | +57.29 |
| onset 0, full at 0.45 | 478.23 | −20.68 | 974→1011 | −36.32 | +50.58 |
| onset 0, full at 0.30 | 460.15 | −38.77 | 974→1012 | −54.01 | +28.38 |
| pop-arrival on at every budget | 488.32 | −10.59 | 974→971 | −8.85 | −24.29 |
| steep-arrival band 0.6→0.25 | 498.91 | **+0.00** | 974→974 | +0.00 | +0.00 |

**The mechanism is confirmed and the lever is refuted.** Paired on the 969 cells
valid in both arms, the first carrier arm does exactly what the hypothesis
predicted in the band it targets — delivered impact at a 0.25 ask +0.014, at a
0.36 ask +0.019, band rms −0.005 and −0.014 — and then loses more elsewhere:

```
                     ask 0.25   ask 0.36   ask 0.61   ask 0.79   speed bias
onset 0 / full 0.65   +0.0136    +0.0185    -0.0434    -0.0274     -0.0257
onset 0 / full 0.45   +0.0238    +0.0338    -0.069     -0.056      -0.0604
onset 0 / full 0.30   +0.049     +0.043     -0.076     -0.074      -0.0802
```

Priced on the counterfactual instrument, the first arm decomposes as mid-band
gain **+5.3**, speed cost **−5.3**, high-band impact cost **−18.9**, validity
gain ~+18. So the carrier's scoop is not free: it brakes the rider, and it
flattens the launch that the NEXT contact has to arrive on. Turning at a contact
costs the speed axis and costs the following contact its arrival angle, and both
costs scale with the pressure while the gain saturates.

Two corrections this forces on the earlier reasoning:

- **"Impact accuracy is nearly free" was an artefact of the comparison.** The
  within-contact correlation of −0.14 against |speed error| is across SEEDS of
  one compiler — selection variation, where the pool's higher-impact members
  happen to be its better-behaved ones. A geometry change that manufactures
  impact pays for it. Selection variation does not price a mechanism.
- **The high band is worth 4x the mid band per unit of impact.** A 0.043 loss
  above a 0.5 ask costs 18.9 headline; the whole mid-band gain was 5.3. Any arm
  that touches impact must be read on both bands.

**Retired**: the carrier ask-ramp onset, in the direction of more pressure.
Also retired: forcing the impact-arrival pop arc on at benchmark budgets
(−10.59, and the impact bias does not move at all, −0.1713 → −0.1738), so the
V1-era dilution finding that set its fade still holds.

**Instrument defect found and fixed**: the steep-arrival arm was bit-identical
because `steepArrivalMatureZeroBand` returns `HARD_IMPACT_ZERO_BAND` (0.5) for
any spec whose authored max impact is ≥ 0.68, which is all 44 development cases.
The 0.6 constant the arm moved is unreachable on this suite. Both bands are now
env-tunable so a shadowed arm reports as a change of nothing rather than as
evidence.

### Batch 2 — the carrier is at a true optimum, and the arrival is the lever

| arm | headline | delta | valid | representative | impact bias | speed bias |
|---|---:|---:|---:|---:|---:|---:|
| carrier onset 0.35 (less scoop) | 492.22 | −6.69 | 974→969 | −0.74 | −0.1717 | −0.0226 |
| carrier onset 0.45 | 486.41 | −12.50 | 974→983 | −11.43 | −0.1830 | **+0.0016** |
| carrier OFF (onset 2) | 429.37 | **−69.55** | 974→1025 | −89.95 | −0.2267 | +0.0499 |
| post-turn onset 0.60→0.15, carrier gate off | 476.99 | −21.93 | 974→957 | −16.57 | −0.1755 | −0.0505 |
| **steep-arrival mature band 0.5→0.15** | **506.05** | **+7.13** | 974→980 | **+4.77** | −0.1696 | −0.0398 |

**The carrier's ask onset is a genuine local optimum**: 0.25 beats 0, 0.35, 0.45
and off, and the ablation prices the whole mechanism at **+69.5**. Two facts fall
out of the ablation that are worth more than the arm:

- **The speed undershoot IS the carrier.** Weaken it and the speed bias goes to
  zero (+0.0016 at onset 0.45, +0.0499 with it off) — so −0.045 of speed is the
  price the suite currently pays for its impact, knowingly or not.
- **The carrier's scoop is what kills `frontier_dense_recovery`.** With it off,
  that case goes 0→14 of 24 valid, its 240ms variant 1→14, `dense_dialogue`
  18→23, and total validity 974→1025. The documented capability debt is a side
  effect of impact steering, not of the contact-indexed refactor alone.

**Falsified: widening the post-contact launch angle.** Opening
`impactPostTurnExtraDeg` to mid-band asks and removing its carrier gate moves the
impact bias by 0.004 and costs 21.9 headline with 20 lost valid runs. The reason
is physical and settles a whole family of ideas: after the catch the rider LEAVES
the surface, so a wider post-contact angle just drops the line away beneath it.
Redirection can only come from velocity the surface can still turn — which means
it has to come from the ARRIVAL.

**The live mechanism: arrival vertical velocity.** Reading the feasibility bound
under a flat launch instead of a symmetric pop — fall for the whole airborne
share of the gap rather than rise and return — raises the mean reachable impact
from 0.575 to **0.650** against an achieved 0.374, and takes the reachable share
of asks from 54% to **66%**. Elevation is unauthored in this suite, so altitude
is a free axis and a dive is nearly free on the scored ones; air OVERSHOOTS by
+0.048, so spending airtime on falling rather than rising helps that axis too.
`STEEP_ARRIVAL` already inverts the metric properly (it computes the arrival
angle the next ask needs and pitches the launch down by the deficit), but it is
gated to attempt > 0, asks ≥ 0.30, a 15° cap, and half the attempt span. Opening
only the span is +7.13 with representative +4.77 [+2.34, +7.20] and
development_music +7.64 [+1.90, +13.38] — every stratum positive, six valid runs
gained, and both the impact and speed biases improved together for the first
time in the campaign.

### Batch 3 — the candidate: the dive is the default shape, not a late variant

| arm | headline | delta | valid | representative | impact | speed |
|---|---:|---:|---:|---:|---:|---:|
| objective axis pooling rms→mse | 484.32 | −14.60 | 974→962 | −7.88 | −0.1683 | −0.0486 |
| mature span reserve 0.5→0 | 504.78 | +5.87 | 974→983 | +4.62 | −0.1692 | −0.0387 |
| span reserve 0.15 + 30° cap | 494.58 | −4.33 | 974→986 | −1.05 | −0.1709 | −0.0373 |
| span reserve 0 + 30° cap | 502.81 | +3.90 | 974→1000 | −0.27 | −0.1733 | −0.0357 |
| **span reserve 0 + every attempt** | **507.33** | **+8.42** | 974→984 | **+10.64** | **−0.1660** | **−0.0370** |

The winner is the only arm in the campaign with three of four strata
significantly positive: representative +10.64 [+8.14, +13.14],
legacy_regression +12.71 [+6.33, +19.08], development_music +10.76
[+5.81, +15.72]. `capability` reads −5.59 with a ±104 interval, which is the
stratum §7.1 of the decisions doc already records as unable to rank arms at these
seed counts. Impact bias −0.1713 → −0.1660 and speed −0.0446 → −0.0370 move
together, which no scoop arm managed.

Two brackets close the mechanism rather than leaving it open: raising the 15°
delta cap to 30° is negative at both span settings (−4.33, +3.90 against +7.13,
+5.87) because a bigger dive buys the arrival with air (+0.062 air bias), and
attempt-0 exemption costs 2.5 points, so the dive belongs in every pool member
rather than in the late attempts only.

**Also falsified: aligning the search's axis pooling with the scorer's.**
`proposalUtility` multiplies per-gap `exp(-rms/T)`, so the search orders
candidates by a sum of square ROOTS while the scorer orders a run by a sum of
SQUARES; the root form is concave, prefers concentrating error in one gap, and
its per-axis gradient saturates at `1/sqrt(k)` once one axis dominates — which is
impact on 54% of the weighted error. Replacing it with `exp(-mse/T^2)` (same
value at `rms = T`, same ordering within one gap, different trade between gaps)
does move the axes in the predicted direction: impact bias −0.1683, high-band
0.79-ask bias −0.2029 against −0.2096, best of any non-arrival arm. It costs
14.60 headline anyway, through 15 lost valid runs concentrated on
`frontier_pickup_progression` (−271.94). The argument survives; the form does
not, and `score.ts` was never touched so the suite identity is intact.

### The candidate, as a source default

Baked into `arc_placement.ts` rather than left as a knob:

- the steep-arrival dive applies at **every attempt**, not only after the first;
- the mature share of the attempt span reserved for undived launches is **0**,
  which deleted `steepArrivalMatureZeroBand`, its two hard-impact constants, the
  unreachable general band, and the `setSteepArrivalSpecMaxImpact` plumbing in
  `handoff.ts` — the branch was dead, since all 44 development cases author a max
  impact of at least 0.86 against its 0.68 threshold;
- scarce budgets keep their own 0.25 reserve, which the canonical suite never
  exercises (lowest tier 250k) and which protects completion where the search has
  no room to recover.

Every refuted knob was reverted to its shipped constant with the measurement
recorded in its comment, so the diff is the mechanism plus evidence and nothing
else. Full test suite: 864 passing. `verify:optimizer` now differs from its
recorded baseline by design.

### N=48 — ACCEPTED, +11.29

`npm run benchmark -- eval --seeds=48 --jobs=48`, 6,336 candidate compiles,
42m54s, zero baseline compiles:

```
headline 497.82 -> 509.11   delta +11.29   seed-block SE 1.45   95% [+7.49, +15.09]
one-sided lower +7.87                      RESULT: STRONGER THAN BASELINE
validity 5852/6336 -> 5902/6336  (gained 96, lost 46)
  250k  +14.78  [+10.87, +18.69]
  500k  +12.07  [ +6.31, +17.84]
  750k   +7.65  [ -0.64, +15.94]
strata
  representative     +11.33  [+10.23, +12.44]
  legacy_regression  +12.22  [ +8.23, +16.20]
  development_music   +8.26  [ +6.19, +10.33]
  capability         +11.46  [-12.40, +35.32]
largest improvements  low_air_endurance_7s +56.75 (valid 140->143),
                      low_air_endurance +36.49, pickup_progression +33.04
                      (valid 85->91), _4s +31.79, _6s +22.04
largest regression    pickup_progression_shifted -11.59 (valid 78->79)
```

Everything a promotion should check is coherent. All four strata positive and
three of them significantly so; all three budgets positive; the effect is
monotone in scarcity (+14.78 at 250k to +7.65 at 750k) which is what a mechanism
that supplies a physically missing quantity should look like — it helps most
where the search has least room to find the shape by luck. Nothing is traded:
the single regression is −11.59 against improvements up to +56.75, and
`frontier_dense_recovery` goes 6→20 of 144 valid with its 240ms variant 7→16, so
the documented capability debt moved in the right direction as a side effect
rather than being paid for.

Promoted with `rebaseline --label=steep-arrival-default`.

## 2026-07-27 — the arrival vein pays again: the ask floor is not a limit

Every dial on the steep-arrival lever is positive against the new baseline
(N=8, 1,056 candidate compiles each):

| arm | headline | delta | valid | representative | capability |
|---|---:|---:|---:|---:|---:|
| ask floor 0.30 → 0.15 | 526.33 | **+19.00** | 984→1005 | +11.50 [+9.54, +13.47] | +71.91 |
| ask floor 0.30 → 0 | 526.43 | **+19.09** | 984→1005 | +11.63 [+9.72, +13.55] | +71.91 |
| delta cap 15° → 18° | 515.91 | +8.58 | 984→986 | +0.66 | +51.72 |
| delivery efficiency 0.68 → 0.5 | 514.87 | +7.54 | 984→992 | +1.58 | +45.79 |
| ride-out span floor 0.5 | 512.33 | +5.00 | 984→982 | +2.27 [+0.29, +4.24] | +23.43 |
| ride-out blend strength 1 | 505.32 | −2.02 | 984→979 | +0.79 | −4.65 |
| ask floor 0 + delta 18° | 528.31 | **+20.98** | 984→1011 | +13.46 [+10.92, +16.00] | +73.43 |
| ask floor 0 + efficiency 0.5 | 531.26 | **+23.93** | 984→1009 | +12.50 [+10.57, +14.43] | **+101.41 [+36.53, +166.30]** |
| ask floor 0 + ride-out floor 0.5 | 522.13 | +14.79 | 984→1000 | +12.24 | +39.55 |

**The 0.30 ask floor was pure cost.** Removing it entirely is the same as
lowering it to 0.15 (+19.09 vs +19.00), which is what should happen if the floor
was never doing anything but suppression: the dive is computed as
`needed arrival angle − predicted arrival angle`, and that difference already
goes to zero on its own for a small ask. The constant only stopped the formula
from being consulted.

**And the gain is not (only) impact.** The impact bias barely moves (−0.1660 →
−0.1673) while `dense_dialogue` gains +112.19 and goes 20→24 of 24 valid, its
contrast variant +108.83 and 18→24, `frontier_pickup_progression` +167.13 and
16→19. On a short gap a flat or rising launch flies past the beat and the catch
misses; a small downward pitch lands the rider on time. So the same lever that
supplies redirection on a long gap supplies TIMING on a short one, which is why
the dense specs — the standing capability debt of this campaign — move first.

### Batch 6 — four ways to deepen the same dive, and why the headline cannot rank them

All on top of the removed ask floor, N=8:

| arm | delta | representative | capability | valid |
|---|---:|---:|---:|---:|
| delivery efficiency 0.4 | +24.67 | +12.97 [+10.50, +15.45] | +103.26 [+46.37, +160.15] | 984→1016 |
| delivery efficiency 0.5 | +23.93 | +12.50 [+10.57, +14.43] | +101.41 [+36.53, +166.30] | 984→1009 |
| **span floor 0.5** | **+21.36** | **+18.08 [+15.43, +20.73]** | +50.64 [−33.24, +134.51] | 984→1012 |
| efficiency 0.5 + span floor 0.5 | +20.50 | +11.58 [−3.63, +26.79] | +79.03 | 984→1021 |
| efficiency 0.6 | +13.29 | +12.66 [+11.34, +13.98] | +29.37 | 984→999 |

Every one of these deepens the average dive and they are **substitutes, not
complements** — combining efficiency 0.5 with the span floor is worse than
either alone. Their headline deltas sit inside one standard error of each other,
which is exactly the situation §12.2 of the decisions doc says a small screen
cannot resolve.

So the choice is made on `representative`, which is 70% of the headline and the
stratum with an interval narrow enough to mean something: **the span floor is
+18.08 against +11.6 to +13.0 for the others**, and the arms that beat it on the
headline do so entirely through `capability`, whose interval spans ±100 here.
The span floor also has the cleanest statement — the pool's mean member should
carry the dive the ask needs, not half of it — and it is bracketed on both sides
(efficiency 0.6 +13.29, the ride-out analogue at full strength −2.02).

### Batches 7-9 — the vein is now bracketed on every side

Re-measured against `dive-span-floor`, all N=8:

| arm | delta | representative | verdict |
|---|---:|---:|---|
| carrier onset 0.15 | −0.23 | −10.66 | the ramp's optimum did NOT move |
| carrier onset 0, full at 0.65 | +0.54 | −13.20 | idem |
| dive span floor 0.75 | −10.42 | −5.10 | 0.5 is bracketed above |
| dive span floor 1.0 | −14.34 | −12.97 | idem |
| delivery efficiency 0.5 | −0.86 | −6.50 | substitutes with the span floor |
| template arrival angle 8°→4° | −5.50 | −0.63 | closed |
| template lane rate ⅓→0.66 | −4.06 | −6.14 | closed |
| template attempt ramp 6→2 | −6.63 | −0.00 | closed |
| template pressure gate 0.35→0.2 | +0.34 (SE 0.38) | +0.61 | inert |
| all three template gates open | −17.47 | −12.80 | closed |
| carrier front-load 1.6→2.0 | +1.75 | +0.29 | noise |

Two of these were worth running for what they rule out rather than what they
find. The **carrier re-sweep** was justified — the scoop's cost is
arrival-dependent, so its optimum could have moved once every arrival carried a
dive — and it did not move at all, which closes that ramp for good. The
**template gates** are the converting half of the mechanism (the dive supplies
the vertical velocity, the valley is the surface that turns it), so steeper
arrivals should have wanted more of them; every gate is at or past its optimum
instead.

### 2026-07-27 — what the impact metric actually measures, and the measurement that follows

The campaign has been reasoning about impact from the doc comment. The
implementation says something narrower (`substrate.ts redirArcPxAtLanding`):

```ts
v0 = velocityAt(landing - 1);  aIn = atan2(v0.y, v0.x)
for (f = landing; f <= landing + W; f++) turn = |wrapPi(angle(v(f)) - aIn)|   // ASSIGNED
return |v0| * turn
```

`turn` is assigned, not accumulated, so the scored quantity is **endpoint to
endpoint**: the CoM heading at exactly `landing + 6` against the heading one
frame before the contact, scaled by the arrival speed. Four consequences, two of
which contradict things this campaign has assumed:

1. **The path inside the window is invisible.** A turn achieved and given back
   scores what remains at the deadline; a gradual turn and a snapped one score
   the same. So "sharpness" is not rewarded — which is why the front-load arms
   are flat (+1.75, −2.13). That lever redistributes rotation *within* a window
   the metric cannot see inside.
2. **The window is a deadline.** A turn still in progress at +6 is counted
   partially.
3. **Only the arrival SPEED enters as the multiplier**, not the arrival angle.
   The angle enters only as the "from" end of the difference.
4. It is absolute and wrapped, and CoM-only.

**The measurement.** `npm run study:impact-window` re-simulates committed tracks
and records the turn at every frame of the window, the maximum reached, and
whether the rider is supported. 417 contacts, six specs, 250k:

```
frame   +0     +1     +2     +3     +4     +5     +6
turn   0.91°  1.98°  6.10°  9.81° 12.89° 14.61° 15.83°     still climbing at the deadline
air     0%     3%     6%     7%    18%    25%    32%       separation begins at +4
```

- **give-back is 0.002 impact units** and the peak is AT the deadline on 89% of
  contacts. The shortfall is a truncation, not a loss.
- Split by whether the rider held contact through the window, at an identical
  mean ask (0.539 vs 0.540): supported delivers **0.449**, separating delivers
  **0.358** — 25% more impact for the same request. Per spec the ordering
  follows: `believer_impact_56s` is 3% airborne and delivers 98% of its ask;
  `dense_dialogue` and `frontier_pickup_progression` are 18-23% airborne and
  deliver 52-53%.

So impact accrues at ~2-3°/frame **only while the rider is supported**, and the
compiler separates two frames before the measurement is taken.

**Why it separates, and the ceiling that follows.** Separation distance
discriminates the two candidate causes, because the sampled ride-out is 28-220px:

```
separates at   +1     +2     +3     +4     +5     +6    never
distance      9.7px  20.9   31.1   41.6   53.2   63.3     -
delivered/ask  36%    49%    46%    59%    61%    68%     82%
```

Every extra supported frame is worth 0.05-0.08 of delivered impact, and the
median separation is at **43px**. Forcing a hard 60px floor on the ride-out —
`IMPACT_WINDOW * speed`, the length that would hold the rider to the deadline —
changes the distribution by **nothing**:

| support floor | p50 separation | airborne at +6 | achieved |
|---|---:|---:|---:|
| off | 43px | 50% | 0.283 |
| ask-scaled | 42px | 50% | 0.289 |
| hard 60px | **43px** | **52%** | 0.291 |

So the rider is not running out of line — it leaves a surface that is still
there.

**And the metric does not require contact at any frame**, which is where a
tempting conclusion has to be resisted. `impact` is `∠v(+6)` against `∠v(-1)`;
a turn delivered in two frames and then coasted loses only what gravity unwinds,
`g/|v| ≈ 1.0°` per airborne frame. So "the window and the flight compete for the
same frames" does NOT follow from separation alone, and was written here before
it was checked.

Checking it splits the population in two. Turn AFTER the rider leaves, by the
frame it left:

```
left at +1 (n=22):   1.5° -> 5.5°     +0.81 deg/frame after leaving
left at +2 (n=27):   4.7° -> 8.9°     +1.05
left at +3 (n=36):   3.8° -> 6.3°     +0.83
left at +4 (n=59):  12.1° -> 13.4°    +0.64
left at +5 (n=63):  15.1° -> 15.6°    +0.55
```

`g/|v|` is ~1.0°/frame, and for the early-separating groups it accounts for the
ENTIRE measured turn: `1.5 + 5 × 0.81 = 5.5`. Gravity steepens a free-falling
rider's heading away from its arrival heading, and the absolute-value metric
reads that as redirection.

### The frontier: `v · dtheta` is near-conserved, and that explains eleven batches

Incidence — the angle between the touched surface and the arrival heading — is
what separates the two populations, and it survives controlling for the ask:

```
ask band       glancing incidence -> achieved      engaged incidence -> achieved
0.20-0.35            1.53 deg -> 0.107                  5.26 deg -> 0.154
0.35-0.50            0.96 deg -> 0.117                 11.50 deg -> 0.262
0.50-0.70           18.39 deg -> 0.339                 19.21 deg -> 0.491
0.70-1.01           16.51 deg -> 0.357                 21.56 deg -> 0.596
```

Delivered impact tracks incidence across bands, which is what the physics
demands: the rider leaves along the surface it met, so `dtheta` is about the
angle that surface makes across the arrival. That gives the metric's inverse
directly — to deliver `X` at speed `v` the surface must sit `X * 7.29 / v`
radians across the arrival, 14.6 degrees for a 0.35 ask at speed 10, against the
5.3 the mid band gets.

The compiler cannot express that today: `contactAngleDeg` is a WORLD-frame angle
nudged by `impactCurveP * 18`, while the quantity that turns the rider is
`contactAngle - arrivalHeading`. So an incidence-targeted contact angle was
implemented and measured:

| incidence aim | engaged incidence | turn at +6 | speed at contact | achieved |
|---|---:|---:|---:|---:|
| 0 (shipped) | 13.26° | 11.1° | 10.16 | 0.283 |
| 0.5 | 14.98° | 13.1° | **8.13** | 0.275 |
| 1.0 | 21.73° | 17.9° | **7.46** | 41 of 240 contacts still land |

**It works and it does not pay.** The turn rises 18%, the contact speed falls
20%, and the score is their PRODUCT. Bending the trajectory costs speed at close
to the rate it buys angle, so `redirArc` is near-conserved along this axis — one
frontier, found eleven times. The carrier ramp in both directions and twice, the
flatten, the front-load, the post-turn widening, the template gates and this are
not eleven independent failures.

**The other factor, tested, and the frontier closes from both sides.** `v` in the
metric is the speed ONE FRAME BEFORE the contact while the speed AXIS scores the
MEAN over the gap, so arriving above one's own gap mean is impact the speed axis
cannot see. Aiming the energy-targeted launch above the gap's speed ask in
proportion to the next contact's impact ask is **byte-identical** at gains of
0.15 and 0.30 — because the launch is already saturated at its descent clamp:
`vyClamped = clamp(vyTarget, -0.92gN, 0.45gN)`, and on a dense gap the energy
target wants 1.46 against a cap of 0.79.

That cap is the real lever, and it bounds both factors at once — a harder dive
arrives faster AND steeper. Opening it does nothing either:

| descent cap | delivered impact | speed one frame before contact |
|---|---:|---:|
| 0.45 (shipped) | 0.283 | 10.55 |
| 0.7 | 0.284 | 10.54 |
| 1.0 | 0.289 | 10.49 |

The pool gains steeper-launch candidates and **the search does not commit them**.

### The way through the frontier: stop paying for the turn

If turn and speed trade at 1:1, the question is not how much to turn but what the
turn COSTS — and the cost is discrete. The redirection is delivered by a
POLYLINE, and every vertex is a collision impulse. `segmentLength` is sampled
12-40px, so the six-frame window — about 60px — spans only two or three
vertices: the turn arrives as a few slams rather than a curve.

Grain is UNAUTHORED in the canonical distribution, so line length is a free axis
exactly as elevation is, and spending a free axis is what both accepted changes
of this session did. Subdividing the post-contact branch in proportion to the
contact's ask:

| refinement | headline | representative | development_music | capability | speed rms |
|---|---:|---:|---:|---:|---:|
| 0 (shipped) | — | — | — | — | 0.0985 |
| 1 | **+6.42** | +1.33 [−8.62, +11.27] | +5.00 | +36.05 | 0.0858 |
| **2** | **+3.70** | **+3.83 [+1.75, +5.90]** | **+8.09 [+0.65, +15.54]** | +3.62 | **0.0841** |
| 3 | +0.82 | +5.09 [+2.82, +7.37] | +9.06 [+4.01, +14.11] | −23.84 | 0.0812 |

The ladder separates by SHAPE, not by headline: `representative` and
`development_music` rise monotonically with refinement while `capability` — the
stratum whose interval spans ±90 here — falls and carries the headline with it.
Rung 2 is the only one with no stratum negative and two significantly positive.

**It is the only arm in the campaign that moves every axis the same way.** Speed
bias −0.0226 → −0.0124 and its rms 0.0985 → 0.0841, air, impact and amplitude all
better; and on the window instrument the contact speed rises 10.55 → 10.72 while
the turn holds. That is precisely what the frontier predicts a smoother turn does
— it buys back the speed the impulses were spending — which is why this lever is
not the eleven that preceded it. `sparse_lowline` also recovers (+21.26, +27.46),
the group the accepted dive had cost.

### The glancing 22% cannot be commanded either

The one population left unattacked was the 22% of contacts that meet their
surface at about one degree and are never turned. Aiming every contact at the
incidence its ask needs fails by paying the speed cost everywhere, but a
one-sided FLOOR binds only on that population and leaves the rest untouched.

The floor has to be the incidence the ask NEEDS, capped — scaling a cap by the ask
defeats it exactly where the glancing contacts live, since at a 0.25 ask a
6-degree cap becomes 1.5 degrees. With `neededTurnDegForImpact` as the floor and
a cap swept off / 5 / 8 / 12 degrees:

| cap | mid-band incidence | delivered (all) | turn at +6 | give-back | peak-at-deadline |
|---|---:|---:|---:|---:|---:|
| off | 1.78° | 0.291 | 11.3° | 0.002 | 90% |
| 5° | 3.07° | 0.260 | 10.4° | 0.003 | 84% |
| 8° | 6.61° | 0.247 | 10.2° | 0.009 | 71% |
| 12° | 10.29° | 0.234 | 10.4° | 0.012 | 63% |

**Incidence rises and the measured turn FALLS**, while give-back climbs sixfold
and the peak stops arriving at the deadline. Forcing a surface across the arrival
makes those contacts EJECT rather than redirect: the rider is thrown, and
free-flight rotation unwinds the turn before it is read. So the one degree is
what those contacts can sustain, not a command the compiler failed to give — and
the give-back mechanism this campaign hypothesised early and could not find does
exist, but only when the geometry is forced past what it can carry.

### The search's own reasons are earned, not obstacles

The frontier's second half is that the search DECLINES the aggressive shapes, so
the natural follow-up is whether the factor doing the declining is informative.
`airFit` was already excluded from the readiness product on exactly that argument
and measured better, so there is precedent and an existing mechanism
(`LR_READINESS_STUDY_ABLATION`, no source change needed). Both remaining
candidates are load-bearing:

| ablation | headline | representative | legacy_regression |
|---|---:|---:|---:|
| without `impactFeasibility` | −7.98 | −8.72 [−10.71, −6.74] | −13.42 [−18.27, −8.58] |
| without `speedFit` | −17.28 | −14.84 [−17.59, −12.09] | −14.06 [−20.48, −7.63] |

So the readiness product is not over-constraining the search out of ignorance —
`impactFeasibility` in particular is the factor that would have to be wrong for
"the search declines faster arrivals" to be a modelling error, and removing it
costs 8 points with two strata significantly negative. `airFit` was the one
uninformative factor and it is already gone.

### The reservation pattern was the LEVER, not a principle

With the impact bias fixed (below), the remaining priced headroom is air, speed,
amplitude and validity — and amplitude had never been touched. It carries exactly
the double reservation the steep-arrival dive did: a hand-placed 0.30 onset below
which the pop-arc shaping is not commanded at all (roughly two thirds of authored
amplitude sits at or under it) and an attempt span whose mean member takes half.

Deleting the dive's ask floor was +19.09 and lifting its span to 0.5..1 was
+21.36. The same two moves on amplitude are **-1.16 and -0.85**, with
`development_music` significantly negative in both (-3.93, -4.69), even though the
amplitude bias does improve slightly (-0.1251 -> -0.1207). The ride-out length's
analogue behaved the same way earlier (+5.00 at a 0.5 span floor, -2.02 at full
blend strength).

So "a physically-derived shape is reserved to part of the attempt span and should
not be" is **not a general principle of this sampler**. Only the arrival carried
it — consistent with the arrival being the one input the scored impact reads
directly. (The combined amplitude arm is void: the source was edited while it was
running. The two single arms agree, so it was not re-run.)

**A workflow note worth keeping.** Mid-session the WASM artifact was rebuilt by
something in the toolchain, and `eval` correctly refused every comparison with
`engine artifact differs from the retained baseline`. Behaviour was unaffected —
`verify:optimizer` and the full suite passed on the rebuilt binary — so this was
build reproducibility, not drift. The recorded bytes are retained inside the
baseline's own compiler snapshot (`benchmark/v2/runs/<label>-compiler-snapshot.tar.gz`
contains `engine-rs/target/.../lr_engine.wasm`), and restoring them from there
returns the fingerprint exactly and unblocks comparisons.

### The impact bias is a FIXED POINT of this geometry

The strongest form of the result, and it reframes the +67 the pricing instrument
found. Mean impact bias across every arm measured this session:

```
arm                        impact bias   speed bias   speed rms   headline
segment-refine (accepted)     -0.1661      -0.0124      0.0841      532.40
carrier onset 0 / full 0.65   -0.1804      -0.0486      0.1055      529.23
carrier onset 0.15            -0.1750      -0.0454      0.1036      528.46
dive span floor 0.75          -0.1671      -0.0186      0.0990      518.27
dive span floor 1.0           -0.1675      -0.0162      0.1037      514.35
steep efficiency 0.5          -0.1697      -0.0234      0.0988      527.83
global segment refine 1.5     -0.1661      -0.0121      0.0843      530.51
global segment refine 3       -0.1661      -0.0124      0.0844      531.61
post segment refine 1         -0.1647      -0.0139      0.0858      535.11
post segment refine 3         -0.1649      -0.0093      0.0812      529.51
```

**The impact bias spans -0.1647 to -0.1804 — at most 1% — across the entire
lever family**, including the arms that were accepted. The headline moves 514 to
535 across the same set, entirely through validity and the OTHER axes. The best
impact bias any arm produced is 0.0014 better than the baseline's.

So the +67 that debiasing impact prices is **not available to arc shaping**. The
counterfactual instrument was correct about where the error IS and silent about
whether it is reachable; twenty arms answer that question. This is why every
mid-band lever measured flat: not eleven coincidences, and not even one trade —
a fixed point.

**What that makes reachable.** With the impact bias fixed, the remaining priced
headroom is air +1.7, speed +0.2, amplitude +3.1 and validity's +11 ceiling —
about +16, so roughly **548** as this compiler family's realistic ceiling on this
suite. That is a falsifiable prediction, not a resignation: any candidate that
takes the headline materially past it must move the impact bias, and nothing in
this vocabulary does.

### The frontier, stated

So both factors of `v * dtheta` are closed from opposite directions: pushing
the angle is cancelled by braking, pushing the speed is cancelled by selection.
The compiler is on the efficient frontier of this metric at this operating point,
and the remaining impact headroom is not reachable by a stronger single-axis
command. What would move it is a change to what the SEARCH is willing to commit —
the same admission-versus-score trade §5.10 of the decisions doc priced at −25
when it was pushed the other way — or a geometry family that produces incidence
without braking, which is not in the current arc vocabulary.

**So 22% of scored contacts — 85 of 383 — are GLANCING.** They touch, are not
turned at all, free-fall through the rest of the window, and deliver ~0.15
against asks of ~0.3-0.4. The contacts that stay supported past +4 have genuine
12-17° turns. The mid-band shortfall that resisted every lever in batches 1-11 is
two pooled populations: real catches that under-turn, and catches that never
engage. Nothing measured so far distinguishes the second geometrically; the
candidate quantity is the arrival heading against the contact surface angle at
the landing point, which is what the carrier's flatten is supposed to control.

At full strength the support floor did measure +6.85 headline at N=8 (+6.60 with
the flight knee), but entirely through `capability` — interval ±110 at that seed
count — with `representative` +0.81 and the impact bias unmoved. An unexplained
gain on the one stratum that cannot rank arms is the shape §7.1 of the decisions
doc warns about, so it is recorded and reverted rather than promoted.

**Also measured, and left as a lead.** The one group the accepted dive regressed
is `sparse_transition` (−14.26), and conditioning the dive on the gap's flight
share recovers it exactly (`sparse_lowline` +23.80, its variant +23.81) while
costing more elsewhere, monotonically: exponent 0.5 → −10.08, 1 → −26.97, 2 →
−53.09. A knee form that binds only where there is no flight is the right shape;
at 0.3 it is inert (−0.04) because almost every flight share is above it. The
binding knee is worth at most the ~+2 that group carries.

### What is left, priced on the new operating point

Re-scoring the `dive-span-floor` archive under counterfactuals:

```
debias impact  (-0.166)   598.82  (+70.13)      impact -> min(ask, bound)  605.19 (+76.50)
debias air     (+0.056)   530.45   (+1.75)      debias ALL axes            606.64 (+77.95)
debias speed   (-0.023)   528.88   (+0.19)      speed is nearly SOLVED - the dive
debias amplitude(-0.125)  531.80   (+3.10)      took its bias -0.045 -> -0.023
```

**Impact still holds every remaining point, and it is all in one place.** By ask
band, delivered share of the ask: 0.25 → 53%, 0.36 → 53%, 0.61 → 79%, 0.79 →
74%, 0.93 → 68%. The mid band is **immovable by every arrival lever measured** —
all three best arms leave it at 0.134-0.135 on a 0.25 ask and 0.188-0.189 on a
0.36 ask, to three decimals — while carrying 0.21-0.34 of feasibility-bound
headroom.

The one mechanism that does move it is the carrier's scoop, and that is priced:
it buys mid-band impact at +0.014 to +0.053 and pays −0.026 to −0.080 of speed
bias plus −0.043 to −0.076 of the NEXT contact's impact. Its optimum has now been
confirmed twice, before and after the arrival change.

So the next attempt needs a way to turn the rider sharply INSIDE the six-frame
scoring window without dragging it around a curve. The front-load lever is
exactly that idea and it is flat here, which suggests the limit is not how the
existing rotation is distributed but that the rotation is not there to
redistribute. A geometry that ends the approach and starts the departure at
different angles — a corner rather than an arc — is the untested shape.

**Next**: the arrival vein is open and the brackets say where. The 15° delta cap
binds on high asks (the deficit is typically 24°) and 30° fails because it buys
the arrival with AIR (+0.062 bias) — the rider must stay aloft until the beat, so
a deeper dive lengthens the flight. The physical way out is to buy the arrival
with SLOPE instead of flight time: pair the dive with a LONGER grounded ride-out
so the same vertical velocity is reached in fewer airborne frames.
`blendPostTowardPopArc` currently does the opposite (it shortens the ride-out to
give the flight room), and `postLength` is a sampled distribution modulated by
the air ask rather than an inversion of it — `grounded_frames = (1 - air) * N`
is available in closed form and untested.

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

### 2026-07-25 — a regression the benchmark structurally cannot see

`npm run verify:compiler:behavior` exercises budgets 61k/100k/150k/200k — all
BELOW the benchmark's lowest tier of 250k. It refuses to re-baseline, correctly,
because one cell of 48 is invalid:

```
opening_burst|seed1|budget61000: INVALID (sync:0drift/19missing; died:rideStalled@160)
```

Traced rather than assumed:

| state | result |
|---|---|
| recorded baseline (pre-rework) | score **629.99**, valid, 126 lines |
| closed form as measured at 24 seeds (`8a477fb`) | score **332.32**, valid, 128 lines |
| after the review-fix retrain (`405c75c`) | **INVALID**, 39 lines |
| exact kernel, same model | score 281.02, **valid**, 127 lines |

Three things this says, and one it does not.

**The case was already degrading before today.** It lost half its score during
the overnight rework, long before the closed form existed. The retrain pushed an
already-marginal cell over the line rather than breaking a healthy one.

**The predictor is implicated at this budget** — same model, kernel valid, closed
form not — which is consistent with the `frontier_pickup_progression` finding:
the same `rideStalled` margin, crossed more often, on tracks with no energy to
spare. 61k is a quarter of the lowest benchmark tier, so the search has far less
room to recover from a slightly worse arc.

**Neither new guard is responsible**, checked: production builds its packet with
`constraintBallisticStateFromRider(rider, 0)`, so the `frameOffset` refusal never
fires, and the finiteness guard can only convert a downstream throw into a clean
rejection.

**What it does not say** is that the adoption was wrong. The same tree measures
at parity at 24 seeds with the best `representative` reading of the campaign
(+4.07). One cell of 48, at a budget nothing else tests, on a case already at
half its original score.

**The standing gap this exposes.** The suite's lowest tier is 250k and the wide
determinism arm is the only thing exercising 61k-200k — but it is a
bit-identity check, not a scored comparison, so it can only say "something
changed", never "this got worse by N". Behaviour below 250k is therefore
effectively unmeasured. `verify:compiler:behavior` stays un-re-baselined until
that cell is valid again; forcing it would record an invalid track as the
reference and destroy the only signal that exists down there.
