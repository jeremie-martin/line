# Compile Budget Telemetry

`scripts/v0/optimizer/budget_telemetry.ts` records how a handoff compile spends
its frame budget and how much work appears to remain. It is observation-only:
no search, geometry, scoring, repair, or RNG decision reads these values.

This document is the semantic reference for the payload. The TypeScript types
are the schema reference; the frozen estimator artifact is the source of truth
for fitted coefficients and calibration bounds.

The *artifact* is no longer observation-only even though the *recorder* is:
`deadline.ts` reads its point-estimate fields. See *Non-Policy Status, And The
One Exception*.

## Mental Model And Units

The payload has one compile scope and two complementary views of its work:

```text
compile
  segments       contiguous accounting partition by work category
  attempts       searches from anchor states toward terminal traversals
    observations estimates at specific work counters and high-water gaps
```

Budget, spend, cost, and estimate fields ending in `_frames` measure **charged
simulation work** from `getSimFrames()`. These are physics frames evaluated by
the optimizer, not output-video frames, node count, or wall-clock milliseconds.
`anchor_frame` and `remaining_duration_frames` instead measure authored
timeline position; their names are similar, but they describe the specification
rather than compute spent.

The two compile budgets have different scopes:

- `hard_budget_frames` is `compileHandoff`'s `budget` argument and the outer
  accounting limit.
- `policy_budget_frames` is the budget visible to budget-aware compiler
  mechanisms and the repair phase. It defaults to the hard budget and may be
  lower, but never higher.
- `total_spent_frames` is the actual charged work. `hard_remaining_frames` is
  clamped at zero; any excess is reported separately as `hard_overrun_frames`.

This distinction lets checkpoint/resume studies preserve one hard accounting
envelope while exposing a smaller policy budget to an episode.

**Budgets are soft caps.** Charged work is committed in whole per-node chunks
and every budget test happens between node expansions, so a compile normally
finishes a little past its hard budget: in a 50-compile sample from the
2026-08-01 campaign all 50 overran, with a median overrun of 0.93% of the hard
budget and a p90 of 5.1%. A positive `hard_overrun_frames` is the ordinary case,
not an instrumentation fault; it is the cost of the last node the compile
started.

The initial search attempt's execution ceiling is the hard budget, because the
frontier may legally continue beyond a smaller policy budget. Policy budget
changes decision parameters; it does not create a fictitious local stop. A
repair attempt records the smaller compile-global ceiling it was sized against,
and that ceiling is a soft cap in the same sense: it is tested between node
expansions and never interrupts one. 84% of attempts in the same sample ended
past `ceiling_total_spent_frames`, with a median overrun of 7.7% of the local
budget. `attempt_overrun_frames > 0` therefore means "the last node cost more
than the ceiling had left", not that a limit was violated.

## Implementation Map

| concern | source of truth |
|---|---|
| payload types, accounting, observations, structural/pace arithmetic | `scripts/v0/optimizer/budget_telemetry.ts` |
| lifecycle hooks and incumbent `costToEnd` construction | `scripts/v0/optimizer/handoff.ts` |
| point selection, correction, intervals, applicability | `scripts/v0/optimizer/budget_estimator.ts` |
| fitted coefficients and calibration domain | `scripts/v0/optimizer/budget_estimator_model.json` |
| accounting validation and error statistics | `scripts/v0/analyze_budget_telemetry.ts` |
| grouped fitting and model-selection gates | `scripts/v0/calibrate_budget_estimator.ts` |

The implementation deliberately separates raw measurement from fitted
interpretation: the recorder stores structural, path, and pace components even
when the frozen model does not select them.

## Levels

`compileHandoff(..., { budgetTelemetry })` accepts:

- `off`: no recorder and `budgetTelemetry: null`.
- `summary`: compile totals, execution segments, and attempt start/end records.
- `trace`: summary plus every new high-water mark, local spend decile, and
  terminal observation.

The compiler default is `summary`. `scripts/v0/run.ts` defaults to `trace` and
accepts `--budget-telemetry=off|summary|trace`.

## Accounting Contract

The payload schema is `line.compile-budget-telemetry.v1`.

Compile identity:

```text
hard_budget + hard_overrun = total_spent + hard_remaining
```

At most one of the two slack terms is nonzero, and because budgets are soft caps
it is usually `hard_overrun`. The identity is an accounting statement about the
recorder, not a claim that the compile stopped at the budget.

Compile-level fields are deliberately small:

| field | exact meaning |
|---|---|
| `budget_exhausted` | compiler's capture-time indication that charged work reached the hard budget |
| `initial_structural_work_prior_frames` | initial attempt's structural estimate at its start |
| `initial_structural_slack` | policy budget divided by that initial estimate, or zero for a zero estimate |
| `initial_structural_applicability` | applicability of the two fields above, or null when no attempt was recorded |
| `first_terminal_total_spent_frames` | compiler's own first-terminal work counter, or null when none was considered |
| `model.*` | traversal/estimator names, estimator SHA-256 fingerprint, and fitted-artifact flag needed to interpret persisted values |

`model.calibrated` says the artifact was fitted; it does **not** say every
observation is in-domain. Use each observation's `estimator_applicability` for
that decision. The recorder copies the flag from the artifact verbatim, and the
calibrator writes `false` whenever it retained the static fallback.

The two compile-scope structural fields are a path-free estimate at the first
attempt's anchor, so they inherit the structural domain rather than the
estimator's overall accuracy. At uncalibrated policy budgets they have been
measured 2-3x wrong; `initial_structural_applicability` is that qualifier,
computed exactly as an observation's is.

`first_terminal_total_spent_frames` comes from the compiler counter that also
feeds `stats.first_completion_frame` and knows nothing about attempts. The
analyzer cross-checks it against the earliest terminal any attempt claims,
which is the one cheap external check on attempt attribution.

Execution segments are contiguous and partition `total_spent` into startup,
initial search, repair attempts, resumed search, and any explicitly
unattributed remainder. An analyzer violation means the instrumentation is
wrong; it is not a soft statistical warning.

For every segment, `spent_frames = end_total_spent_frames -
start_total_spent_frames`. `attempt_id` links work owned by a search attempt and
is `null` for a segment no attempt owns. `finalization` is a declared kind the
current compiler never emits. `unattributed` is emitted at snapshot time only
when recorded segments do not yet cover all charged work, making an
instrumentation gap visible rather than silently dropping it.

A segment's `stop_reason` is a free-form string, and its vocabulary is **not**
the attempt-scope `BudgetAttemptStopReason` (`handoff_to_repair`,
`budget_capture`, `local_ceiling`, `frontier_exhausted`,
`first_completion_stop`, `compile_finished`):

| segment | stop reason |
|---|---|
| `startup` | `search_ready` |
| `initial_search` | the initial attempt's own typed stop reason |
| `repair_attempt` | `terminal_considered` or `no_terminal` |
| `resumed_search` | `hard_budget` or `frontier_exhausted` |
| `unattributed` | `snapshot_gap` |

The two scopes answer different questions and routinely disagree about the same
work: a repair segment reading `terminal_considered` normally sits under an
attempt whose stop reason is `local_ceiling`. The segment says what the phase
achieved; the attempt says why its frontier stopped.

Segment boundaries and attempt boundaries are also offset at the head of a
compile. `attempts[0].start_total_spent_frames` is `0`, so the initial attempt's
spend counter includes startup work, while the `initial_search` segment begins
where the `startup` segment ends. The initial attempt's spend and its segment's
spend therefore differ by exactly the startup segment. The one-time startup
intercept is a separate question: it is charged to the structural estimate for
as long as that attempt's high water is still at its anchor gap, which
`structural_startup_included` reports per observation.

Every attempt records:

- its parent, deterministic search seed, and fallback state;
- anchor gap/contact/duration suffix;
- global start, local ceiling, how that ceiling was sized, available hard
  budget, and local budget;
- for a repair, the causal context of its anchor: which round picked it, how
  far upstream this attempt walked, and the weakness key it was picked on;
- start/end estimates and optional trace observations;
- stop reason, charged work, first-terminal offset, censoring, whether a repair
  improved the incumbent, when it first did, and by how much score.

An attempt is `completed` only when it considered a terminal traversal.
Otherwise it is explicitly `censored`; budget exhaustion is not treated as an
observed completion cost.

Attempt kinds have exact meanings:

- `initial`: search from a newly constructed start state;
- `snapshot`: search resumed from a supplied compiler snapshot;
- `repair`: seed-perturbed search from a prefix of a completed incumbent;
- `resumed`: the initial frontier restarted after the repair phase released the
  remaining budget.

A `resumed` attempt continues the initial attempt's own tree, so it reports that
tree's root anchor and the hard budget as its ceiling. Its frontier is
mixed-depth by construction: `anchor`, `structural_progress_fraction`,
`episode_pace_work_estimate_frames`, and `first_terminal_offset_frames` are
approximate continuations of the initial search rather than fresh-start
measurements. It exists because the phase owns real charged work — up to 48% of
a compile — and can hold a compile's first terminal; without an active attempt
both were invisible to the attempt view.

Three fields carry a repair attempt's causal context and are `null` on every
other kind. `repair_round_index` is the round that picked the weak gap; a round
may spend several attempts walking its anchor upstream, so the attempt ordinal
within a compile is NOT the round. `anchor_upstream_offset` is that walk's `up`,
with `picked weak gap = anchor.gap_index + up`. `incumbent_weak_gap_sse` is the
Σ axis-error² the ranking sorted the picked gap on, read off the incumbent drift
report THAT round saw. The archive otherwise carries only the report at the end
of the whole repair phase, so an offline replay of the selection sees a weakness
map that accepted repairs have already moved — exact on zero-accept compiles,
~40% decision-1 agreement everywhere else
([`repair-selection-study.md`](repair-selection-study.md) *Limits* 1 and 5).
All three are additive: an archive recorded before them reads `null` and is not
in violation of anything.

`ceiling_source` names how `ceiling_total_spent_frames` was sized:

| value | meaning |
|---|---|
| `hard_budget` | the compile's hard budget; initial and resumed attempts |
| `measured_cost_to_end` | the estimator's upper interval bound over the incumbent's measured cost-to-end at this anchor |
| `per_gap_fallback` | the anchor has no positive measured cost, so the coarse per-gap average was used; rare |
| `repair_budget_remaining` | the sized ceiling reached the repair budget and was clipped to it |

This field makes one tautology visible in data. A `measured_cost_to_end`
ceiling is the estimator's own `start`/`withPath` upper bound over the same
`costToEnd` profile the estimator uses as its path base, so at such a repair's
start `attempt_completion_margin` is exactly the artifact's `start`/`withPath`
upper ratio — **1.223889** under the current artifact, on every such start —
and it is arithmetic, not evidence about estimator accuracy. Since repair
ceilings became measured wherever a reach stamp exists, this covers nearly every
repair start, so never read a repair's start margin as an accuracy signal.

The bound the policy sizes from is the CALIBRATED one. `estimate_upper_frames`
on the same observation can be larger: outside the artifact's policy-budget
domain the recorder widens the recorded interval to the hard budget remaining,
which is a rule about what it may *claim*, not a second bound. Policy consumes
the point ratio and the fitted interval at every budget, exactly as
[the margin does](#applicability).

`first_accepted_improvement_offset_frames` is charged work from attempt start to
the first improvement the best-so-far register adopted. That leaf need not be
terminal and need not be the one that ended the attempt. `accepted_score_delta`
is the incumbent full score after the attempt minus before it. Both are
repair-only today; repairs complete at nearly 100%, so completion is not the
scarce event, and these two are what a controller would need instead.

`start_total_spent_frames` and `ceiling_total_spent_frames` are compile-global
counters. Their difference is `local_budget_frames`. At an observation:

```text
attempt_spent     = total spent - attempt start
attempt_remaining = max(0, local ceiling - total spent)
attempt_overrun   = max(0, total spent - local ceiling)
available_hard    = max(0, hard budget - attempt start)
```

`first_terminal_offset_frames` is charged work from attempt start to the first
terminal considered by that attempt. It is not the time at which the final
accepted incumbent was found. For repairs, `accepted_improvement` separately
states whether the terminal changed the best-incumbent register.

## Observations And High Water

The `high_water` is the greatest gap index reached by that attempt so far. It is
monotonic even when the frontier later backtracks. Its suffix fields are:

| field | exact meaning |
|---|---|
| `gap_index` | next gap at the high-water boundary; `gaps.length` means terminal |
| `anchor_frame` | authored start frame of that gap, or spec duration at terminal |
| `remaining_gaps` | `gaps.length - gap_index` |
| `remaining_contacts` | contact-ending gaps in that suffix |
| `remaining_duration_frames` | spec duration minus `anchor_frame` |

Trace telemetry records these event types:

| event | emitted when |
|---|---|
| `start` | an attempt is created |
| `high_water` | the attempt reaches a greater gap index |
| `spend` | another 10% of the attempt's local budget is charged without a new high water |
| `terminal` | the attempt first considers a terminal traversal |
| `end` | the attempt is closed or captured |

Summary telemetry retains attempt starts and ends but omits the intermediate
trace. Deduplication is narrow: an observation is dropped only when the
immediately preceding one has the **same event type** as well as the same work
counter and gap index. Adjacent observations of different types at an identical
counter and gap — a `terminal` immediately followed by the `spend` or `end` that
records the same instant — are legitimate and are kept.

## Remaining-Work Quantities

For a completed attempt, the analyzer defines the ground-truth remaining work
at observation `o` as:

```text
terminal total = attempt start + first terminal offset
actual remaining(o) = terminal total - o.total_spent_frames
```

Only positive pre-terminal values enter estimator-error statistics. Incomplete
attempts are censored and never assigned a fictional completion cost.

`terminal` and `end` observations can therefore never appear in an error
statistic or in a fitted interval, and the reason is construction rather than
sampling: a `terminal` observation's counter *is* the terminal total, and an
`end` observation is at or past it, so actual remaining work is zero or negative
at both. No panel, however large, will ever produce one.

Every observation stores three point-estimate components separately. Let `S0`
be structural work at the attempt anchor and `S` structural work at the current
high water:

```text
structural S = ( startup intercept when applicable
               + contact coefficient * remaining contacts
               + duration coefficient * remaining duration frames )
             * budget scale

budget scale = (policy budget / reference budget) ^ budget exponent

structural progress fraction = clamp((S0 - S) / S0, 0, 1)

episode pace = attempt spent * S / (S0 - S)

incumbent path = measured cost-to-end suffix inherited by a repair attempt
```

### The Budget Scale

First-completion cost is not a property of a spec. It is a property of a spec
*and* the policy budget the compiler was given, because the compiler's own
breadth ramps spend more when handed more. Measured across a 10x budget range it
scales as a power law with a single exponent near 0.82 and no ceiling; see
[`budget-law-study.md`](budget-law-study.md).

The artifact carries that as `structural.budgetExponent` and
`structural.referenceBudgetFrames`. Three properties are load-bearing:

- **One exponent on the whole difficulty scalar, never one per coefficient.**
  The coefficient *mix* rotates with the budget — as the budget grows,
  forward-search breadth loads more cost onto contacts and less onto authored
  time — but only the scalar transfers. A three-exponent fit is slightly better
  in sample and materially worse on a budget it was not fitted at.
- **An absent or zero exponent is exactly the old model.** The scale is then the
  literal number `1`, so a pre-law artifact predicts identically through the same
  arithmetic. There is no second code path and no migration step.
- **One scalar per compile.** The scale depends only on the policy budget, so
  the recorder resolves it once at construction. It multiplies `S` and the
  anchor work `S0` alike, which means it cancels in
  `structural progress fraction` and in `episode pace`: both stay pure
  measurements, unchanged by the law.

Schema `line.compile-budget-estimator-model.v2` is what declares the law.
Artifacts without one still declare `.v1`, and the runtime parses both. The
version changes exactly when reading the artifact with v1 semantics would be
wrong, because dropping the exponent silently is a 2-3x error away from the
reference budget — the failure a version string exists to prevent. A `.v1`
artifact carrying law fields is rejected at parse time.

The component fields and availability are:

| field | meaning | availability |
|---|---|---|
| `structural_work_prior_frames` | fitted structure-only remaining work `S`, budget scale included | always |
| `structural_startup_included` | whether `S` includes one-time startup work | initial attempt at its anchor only |
| `structural_progress_fraction` | share of anchor structural work removed at high water | always; 1 when `S0` is zero |
| `episode_pace_work_estimate_frames` | remaining work projected from this attempt's observed spend per unit of structural progress | after positive structural progress; otherwise `null` |
| `incumbent_path_work_estimate_frames` | measured work from this gap to first completion on the original incumbent search | repair attempts where that gap has a **positive** measured cost; otherwise `null` |

A zero cost-to-end is recorded as `null`, not as zero work remaining. The
profile writes zero whenever first completion did not post-date reaching that
node, and the estimator's own selector discards non-positive paths anyway.
Admitting zero would leave a structural estimate labelled path-backed, and
therefore `calibrated`, on no evidence.

Episode pace estimates **remaining** work, not total attempt work. It can react
when a spec is easier or harder than its static structure suggests. It can also
be noisy when little progress has occurred or substantial work is spent while
the high water is unchanged.

### Incumbent Path Measurement

After the initial search first completes, the repair phase constructs one
stable suffix profile from that original incumbent:

```text
costToEnd[k] = firstCompletionFrame - framesAtReach(incumbent node at gap k)
```

`framesAtReach` is the compile-global charged-work count when that incumbent
node was first reached. Consequently, `costToEnd[k]` includes all charged
search work between first reaching that node and first completion, including
exploration of other branches. It is not track playback duration.

A reach timestamp comes from either of the two producers that build incumbent
nodes: the frontier, which stamps each node it processes, and the near-tail
completion pass, which stamps the suffix nodes it constructs at construction
time inside its own charged tail attempt. Both answer the same question — the
charged work at which that node first existed on the search's path.

The terminal index `gaps.length` is outside the profile's domain by
construction: the incumbent's terminal node is reached at first completion, so
its measured cost-to-end is zero, which the recorder stores as `null` rather
than as a path-backed estimate of no remaining work.

**One profile.** Repair policy — feasibility screening, weak-gap selection,
and restart ceilings — and the recorder read the same array. The two stamp
sources were briefly kept apart, with policy reading the frontier's alone while
telemetry read both, so that closing the coverage hole could be proven
behaviour-neutral first. They were merged once the wider profile had been
measured: `per_gap_fallback` now means a node in neither reach map, which is
rare. See "Measured repair cost everywhere" in
`docs/budget-control-design.md` for that change and its evaluation status.

The distinction matters because first completion routinely arrives through the
tail pass. On the 2026-07-31 panel, all 34 repair-bearing cells completed that
way, leaving 20.2% of pre-terminal repair observations and 155 of 307 repair
anchors with no measured path at all — five compiles had none. Under the merged
profile those cells measure a path at every pre-terminal repair observation.
The 2026-08-01 recalibration panel confirms it end to end: **100% of pre-terminal
repair observations (16,236 of 16,236) and 100% of repair anchors (883 of 883)
carry a measured path**, against 79.8% and 47.6% before the fix. That is why the
refitted artifact's `structuralAttemptKinds` is `["initial"]`: with full path
coverage no repair observation lands in the path-free bucket, so the corpus
contains no evidence for a path-free repair estimate.

A repair at gap `k` inherits the profile. The repair keeps the incumbent prefix
state but uses a new deterministic seed, so its eventual cost can differ. The
profile is currently computed once from the original first completion and is
not relearned after later repairs.

### Selected Point Estimate

The frozen artifact is
`scripts/v0/optimizer/budget_estimator_model.json`. It was selected with grouped
source-family cross-validation, with every attempt receiving total weight one.

In general, the runtime can choose a structural or path base, geometrically
blend it with episode pace according to structural progress, then apply a fitted
correction factor. The current frozen model is exactly:

```text
base = incumbent path when available, otherwise structural
selected estimate = base * correction(path availability)
pace weight = 0
```

The current correction factors are `0.940948` with a path and `1.015649`
without one. Measured episode pace remains a first-class diagnostic but was not
selected: on the 750k calibration corpus every tested pace blend made grouped
held-out point error worse. That is a statement about that corpus, not a general
law: the out-of-domain diagnostics under *Validation Evidence* show pace still
tracking real work where the structural estimate collapses, so a corpus
collected at other budgets could select it. Read the artifact rather than
copying these constants into code; recalibration may replace them.

`estimated_remaining_work_frames` is this selected point estimate. It is not a
promise that the current local ceiling is sufficient and is not the expected
cost of improving the incumbent after reaching a terminal.

### Bounds And Budget Headroom

Prediction bounds are empirical and conditioned on the observation's regime.
Starts, high-water updates, and spend-without-progress observations have
different error distributions, so one aggregate interval would either undercover
the latter or be needlessly wide for all observations. Since schema v2 each
event is split again by whether the estimate is path-backed, because those are
two more regimes with different spreads:

```text
estimate lower = selected estimate * lower ratio
estimate upper = selected estimate * upper ratio
estimate uncertainty = (upper - lower) / 2
```

The ratios resolve most-specific-first — the `(event, path availability)`
stratum, then the event, then the aggregate — and each level is optional, so an
artifact that fits only events behaves exactly as artifacts did before strata
existed. On the shipped artifact the split is large: a path-backed high-water
estimate reads `[0.943, 1.132]` and a path-free one `[0.712, 1.269]`, because
one is a measurement of the incumbent's own suffix and the other is a regression
on spec structure. Pooling them under one band necessarily undercovers whichever
population is noisier, and their mixture weight varies across the corpus — the
path-free share runs 84% at 150k against 57% at 1.5M.

"Path-backed" means the artifact's selector actually routed the estimate through
the path base, not merely that a path existed: under a `structural` base mode it
never does. That is the same predicate the correction factors split on.

The interval is multiplicative and generally asymmetric around the point;
`estimate_uncertainty_frames` is half-width, not a standard deviation. Events
without a fitted event-specific interval use the artifact's aggregate ratios.
The ratios are fitted per observation rather than per attempt, so
`nominalCoverage` is a claim about the observation population — see *Two
Weightings, Deliberately*.

The artifact fits `start`, `high_water`, and `spend` and nothing else, because
those are the only events that can produce an error sample at all. `terminal`
and `end` observations fall back to the aggregate ratios, which were themselves
fitted without a single terminal or end sample. An interval on those two events
is therefore arithmetic, never a calibrated claim — and on a completed attempt
it is arithmetic on a zero point estimate.

A stratum is fitted only when it holds enough observations for its tails to mean
something: four expected observations per tail, so 160 at `nominalCoverage:
0.95`. A thinner stratum falls back to its event rather than promising coverage
from a single extreme order statistic, and the calibration report says which
strata were fitted and which fell back.

Completion margins have direct units:

```text
hard_completion_margin    = hard remaining / estimated remaining work
attempt_completion_margin = local remaining / estimated remaining work

hard_completion_surplus    = hard remaining - estimated remaining work
attempt_completion_surplus = local remaining - estimated remaining work
```

For example, a margin of `1.5` means the available budget is 1.5 times the point
estimate; a surplus of `-20,000` means the point estimate exceeds the available
budget by 20,000 charged frames.

A margin is `null` for two distinct reasons, and a reader must not conflate
them:

- the observation is outside the estimator's calibration domain, so the ratio
  would be a calibrated-looking number with no calibration behind it;
- `estimated_remaining_work_frames` is zero, so there is nothing to be a
  multiple of. This is every observation at the terminal high-water index — the
  `terminal` event and any `end` recorded there — because a terminal suffix has
  no remaining contacts, gaps, or duration and the path profile stores `null` at
  `gaps.length`.

Surpluses remain visible in both cases as arithmetic diagnostics but do not
become calibrated claims.

A controller reading these should prefer `hard_completion_margin` and the two
surpluses over `attempt_completion_margin`. On a repair whose `ceiling_source`
is `measured_cost_to_end`, the attempt margin at the attempt's own start is the
`start`/`withPath` upper-ratio constant described under `ceiling_source`: it is
the sizing rule read back, and it carries no information about whether that
repair will finish.

At compile scope:

```text
initial structural slack = policy budget / initial structural work prior
```

It is zero when the initial prior is zero. This is a frozen, start-of-compile
ratio; it does not adapt as work is observed. Its definition is unchanged by the
budget law, but its denominator is not: under a law artifact the prior carries
the exponent, so this ratio grows as `B^(1-alpha)` instead of as `B`. That is
telemetry describing measured spend and it is **not**
`compile_stats.budget_slack`, which is the budget-independent V1 coordinate live
policy reads — see *Two Structural Models*.

## Worked Observation

Suppose a repair starts at compile-global work 500,000 with a local ceiling of
650,000 and a hard budget of 750,000. At a high-water event:

```text
total spent = 540,000       attempt spent = 40,000
S0 = 120,000                S = 80,000
incumbent path = 72,000
```

Then:

```text
structural progress = (120,000 - 80,000) / 120,000 = 0.333
episode pace        = 40,000 * 80,000 / 40,000       = 80,000
selected estimate   = 72,000 * 0.940948              = 67,748
hard remaining      = 750,000 - 540,000              = 210,000
attempt remaining   = 650,000 - 540,000              = 110,000
hard margin         = 210,000 / 67,748                = 3.10
attempt margin      = 110,000 / 67,748                = 1.62
```

This observation is path-backed, so it reads the `high_water/withPath` band and
its interval is approximately `[63,870, 76,714]`. If this attempt first reaches a
terminal at global work 605,000, actual remaining work at the observation was
65,000, giving this point estimate an absolute percentage error of about 4.2%.

## Applicability

The structural estimator is calibrated for the policy budgets its corpus
covered, `applicability.structuralPolicyBudgetFrames`. That qualifier matters
because the compiler itself changes forward-search breadth as the initial policy
budget and structural slack increase. A 2M run is not merely the same traversal
with more frames after completion.

Without a budget law that domain is a single point — the one budget the panel
was collected at. With one it is the band the panel spanned, because the
exponent is what lets a fit at four budgets answer at every budget between them.
Read the artifact; do not assume either shape.

Outside the domain the behaviour is unchanged in both cases:
`extrapolated_policy_budget`, null margins, and an interval widened to at least
the remaining hard budget. There is deliberately **no graded middle band** — no
third applicability grade for "outside the fitted band but inside the range the
law was shown to extrapolate over". The study measured the law holding to 3x
reference and breaking at 0.1x, so such a grade is defensible, but it would need
its own fitted interval widening and its own coverage claim. It is a documented
future option, not something to infer from the exponent's existence.

Each observation therefore reports:

- `calibrated`: an estimate inside the artifact's validated domain;
- `extrapolated_policy_budget`: an estimate under a policy budget outside it;
- `unvalidated_attempt_kind`: a path-free estimate for an attempt kind with no
  path-free evidence in the calibration corpus, which today means `snapshot`,
  `resumed`, and `repair`. The first two are never fitted at all; `repair` joins
  them because full incumbent-path coverage means no repair observation is
  path-free any more, so a repair that somehow lacked a path would be an
  unmeasured case.

A path-backed estimate always skips the attempt-kind test — it is a measurement
of the incumbent's suffix and does not depend on how the attempt was started.
**Whether it also skips the policy-budget test is the artifact's own
declaration**, `applicability.pathEstimate`:

| value | meaning |
|---|---|
| `calibrated_when_available` | the original rule: a path-backed estimate is calibrated at any policy budget |
| `calibrated_when_available_in_domain` | schema v2: the policy-budget domain applies to path-backed estimates too |

The shipped artifact declares the scoped rule, and the four-budget panel is why.
Path-backed estimates are unbiased inside the domain — median actual/predicted
0.994 at 1.5M, 0.995 at 750k, 1.006 at 300k — and **1.189 at 150k**, a 19%
underprediction. At a scarce budget the incumbent handed to repair came out of a
search that barely completed, so its measured cost-to-end understates what a
repair will actually need. That is a point-estimate failure no interval width
can honestly absorb: under the shipped bands only 35% of 150k path-backed
observations fall inside their interval while the label said `calibrated`.
Retracting the claim there is the whole reason the option exists. An independent
2026-08-03 corpus on a later tree measures the same cell at **33.4%**, which is
the cleanest available evidence that this is a property of the regime and not of
one panel.

The domain floor is **250k**, extended down from 300k on 2026-08-03 without
touching the point estimate or the bands; see *2026-08-03 The 250k Extension*.
150k remains outside it, measured and closed.

The cost is real and was accepted deliberately: at 2M, path-backed observations
are accurate (2.5% median APE) and were `calibrated` under the old rule. They are
now `extrapolated_policy_budget`, so the artifact gives up a true claim above the
domain in exchange for not making a false one below it. Their components and
point estimates are still recorded; only the margins go null and the interval
expands. The rule lives in the artifact rather than in the runtime so that
payloads recorded under the original rule keep re-deriving exactly.

For extrapolated observations, the point components remain visible for study,
but calibrated margins are `null` and the uncertainty interval expands to at
least the remaining hard budget. Do not turn extrapolated point estimates into
policy decisions.

### Two Structural Models

There are two structural traversal models in the repository, and they are not
interchangeable:

| coefficient | `TRAVERSAL_BUDGET_MODEL_V1` | estimator artifact fit |
|---|---:|---:|
| intercept frames | 5,848.25 | 24,341.44 |
| frames per remaining contact | 796.20 | 3,922.70 |
| frames per remaining authored frame | 29.59 | 11.74 |

`TRAVERSAL_BUDGET_MODEL_V1` in `budget_model.ts` drives **all** live policy:
`compile_stats.predicted_first_completion_frames`, `budget_slack`, the observed
paced slack, and everything downstream of them — traversal branch limit,
forward-eval gating, opening breadth. Telemetry drives nothing. The two fits
weight the same two features oppositely — the estimator loads the intercept and
the contact term, V1 loads the duration term — and their predictions diverge by
2-3x away from 750k.

So the headline "the fitted estimator beats the legacy static model by an order
of magnitude in median log error" is a measurement at one policy budget, about
remaining-work prediction from mid-search observations. At 150k the V1 prior was
measured closer to truth than the estimator's structural component. Nothing here
is a finding that V1 should be replaced in policy, and copying the estimator's
coefficients into `budget_model.ts` would silently re-scale every slack-driven
knob. V1 remains the live-policy coordinate system until a deliberate migration
with its own multi-budget evidence and paired evaluation.

**The budget law hardens that separation rather than softening it.** V1's job is
to be a budget-*independent* difficulty yardstick so `budget_slack` can mean "how
rich am I relative to this spec". The law's entire content is that actual cost is
budget-*dependent* with exponent ~0.82. Substituting it for V1 would make slack
proportional to `B^0.18` instead of `B`, collapsing a 30x live coordinate to a
1.9x one and moving hundreds of compiles across the 1.5 branch-limit threshold —
measured, not conjectured, in `budget-law-study.md`. An exponent in the telemetry
estimator is a *spend* model in the one place a spend model belongs; the live
predictor still needs a *difficulty* model. Do not port one to the other.

## Persistence

Telemetry is kept separate from score/report semantics:

- `run.ts`: `<out>.budget-telemetry.json`, alongside `<out>.stats.json` — the
  compile-stats envelope (`sim_frames`, `first_completion_frame`,
  `predicted_first_completion_frames`, `budget_slack`, `budget_exhausted`, …)
  that the recorder's accounting can be checked against;
- Benchmark V1 (golden) checkpoints: `budget_telemetry`;
- Benchmark V2 and scale-study runs: `budgetTelemetry`;
- production bundles: `budget-telemetry.json`;
- lab SQLite: `checkpoints.budget_telemetry_json`.

Golden archives embed a **reduced** copy, marked `archive_form:
"observations_reduced"`. It keeps the whole compile, model, and segment account
and every attempt's identity, anchor, repair context (`repair_round_index`,
`anchor_upstream_offset`, `incumbent_weak_gap_sse`), counters, and outcome, but drops the
`observations` array entirely and trims `start`/`end` to the point estimate,
interval, applicability, and the accounting terms the analyzer's identities need.
The full payload is still produced by every compile and persisted by run.ts
sidecars, benchmark V2 rows, and `golden.ts --details` archives; a reader who
finds a stripped observation field should check `archive_form` before
concluding the recorder omitted it.

`run.ts` compiles the spec **after** applying the production jolt offset
(`applyJolt`, `LR_JOLT_OFFSET_MS`), so a panel collected through that CLI
describes slightly shifted contacts rather than the authored spec; golden,
benchmark, and tests call `compileHandoff` directly and are offset-free.

`scripts/v0/describe_budget_telemetry.ts` renders one compile's payload for a
human — the compile account, the segment partition, the attempt table, and a
per-attempt observation walk — and picks up a sibling `<prefix>.stats.json`
when run.ts wrote one. It tolerates missing fields, lists any key it does not
recognize, and names `archive_form` in its header, so a reduced copy is never
read as a full payload with holes in it.

The report semantic fingerprint does not include telemetry.

## Analysis And Calibration

Validate one or more sidecars, archives, or directories of sidecars:

```bash
npx tsx scripts/v0/analyze_budget_telemetry.ts \
  generated/budget-telemetry/panel.json \
  --source-manifest=benchmark/v2/compat/source-manifest.json \
  --out=generated/budget-telemetry/panel.analysis.json
```

A directory input expands to the `*.budget-telemetry.json` (and `.gz`) files
directly inside it. `--samples=off` omits the bulky `calibration_samples` array
for human-only runs; the calibrator consumes that array, so the default keeps
it. `--source-manifest` only resolves origin families for benchmark-archive
inputs, which is what the calibrator's grouped folds hold together; against
plain sidecars it is inert and every payload groups as `sidecar`, so a
sidecar-only corpus collapses to one group and the calibrator — which requires
at least two — refuses it.

The command exits nonzero on violations and emits JSON plus Markdown. It reports
component error, interval coverage, censoring, attempt-kind and event splits,
and calibrated versus extrapolated samples.

Two whole-corpus checks precede the per-payload ones:

- **Estimator identity.** Estimates recorded by different artifacts are not
  comparable, so mixing fingerprints in one analysis is a violation.
  `--allow-mixed-estimators` downgrades it to a warning. When the corpus
  fingerprint differs from the artifact this checkout loads, the report warns
  prominently: the error statistics then describe the recording artifact.
- **Estimate accounting.** When the corpus fingerprint matches the local
  artifact, every observation's point estimate, interval, uncertainty, margins,
  and surpluses are recomputed from its own recorded components and flagged on
  mismatch. Without it, a payload whose estimates were all replaced by garbage
  still satisfies every work-counter identity. Reduced archive forms that drop
  the components are counted as skipped, not flagged.

Error rows use only observations from completed attempts:

```text
signed error = predicted remaining - actual remaining
bias          = mean(signed error)
MAE           = mean(abs(signed error))
APE           = abs(signed error) / actual remaining
log error     = abs(log(predicted remaining / actual remaining))
coverage      = share where lower <= actual remaining <= upper
```

Negative bias means systematic underprediction. Median APE answers the
intuitive "how far off as a fraction of actual work?" question, while absolute
log error treats reciprocal overprediction and underprediction symmetrically.
Component rows evaluate `structural`, `path`, and `pace` independently;
`combined` is the point estimate selected by the frozen artifact. Each row uses
one population: predictions that are not positive have no log ratio and are
excluded from every statistic in the row, so its `n` describes all of them.

Headline interval coverage counts **calibrated observations only**. An
out-of-domain observation's interval is `[0, max(upper, hard remaining)]` by
construction, so covering it says nothing; those samples are reported on their
own row, labelled trivial, alongside the share of the corpus they represent.

Refit the frozen artifact only from a reviewed analysis corpus. One or more
analyses may be given, and they are pooled into one corpus:

```bash
npx tsx scripts/v0/calibrate_budget_estimator.ts \
  generated/budget-telemetry/law/panel-150k.analysis.json \
  generated/budget-telemetry/law/panel-300k.analysis.json \
  generated/budget-telemetry/law/panel-750k.analysis.json \
  generated/budget-telemetry/law/panel-1500k.analysis.json \
  --folds=5 --coverage=0.95 \
  --out=scripts/v0/optimizer/budget_estimator_model.json \
  --report=generated/budget-telemetry/panel.calibration.json
```

The calibrator fits non-negative structural coefficients, evaluates
structural/path/pace combinations out of fold, and retains the static model
unless median log error improves by at least 5% without more than a 5% p90
underprediction regression. A retained static model is emitted with
`calibrated: false`, and the emitted artifact is parsed with the runtime's own
validator before it is written — an invalid artifact would otherwise turn every
compile in the repository into an import-time throw.

### Two Layers, And Widening A Claim Without Refitting

The artifact has two halves and they have different consequences:

| layer | fields | who reads it |
|---|---|---|
| point estimate | `structural.*`, `combination.baseMode`, both correction factors | the recorder **and `deadline.ts`** — live policy since the margin's structural base became the artifact |
| claim | `applicability.*`, `interval.*`, `metrics.*`, `modelId` | telemetry only |

`combination.paceSchedule` sits between them and is inert in practice:
`deadline.ts` overrides it to `linear_progress` on its own copy for the reason
written there, so the artifact's value never reaches policy.

That split matters because moving a point-estimate field changes what the
compiler searches. Measured, a 1% change to `structural.contactFrames` moved
`sim_frames` on two of four probe cells; the claim layer and the pace schedule
moved nothing at all. A refit is therefore a promotion-class change needing a
paired benchmark evaluation, while widening a domain need not be one.

`--freeze-point-model=<artifact.json>` is the mode that keeps them apart. The
point estimate comes from the named artifact and is re-emitted **verbatim**, so
the diff against its source is confined to the claim layer and that confinement
is checkable byte for byte. The corpus is used only to re-validate it and to fit
what a claim is made of — interval strata, the applicability domain, the
structural attempt kinds, and the metrics:

```bash
npx tsx scripts/v0/calibrate_budget_estimator.ts \
  generated/budget-telemetry/p2/panel-250k.analysis.json \
  generated/budget-telemetry/p2/panel-300k.analysis.json \
  generated/budget-telemetry/p2/panel-750k.analysis.json \
  generated/budget-telemetry/p2/panel-1500k.analysis.json \
  --freeze-point-model=scripts/v0/optimizer/budget_estimator_model.json \
  --folds=5 --coverage=0.95 \
  --out=scripts/v0/optimizer/budget_estimator_model.json \
  --report=generated/budget-telemetry/p2/extension.calibration.json
```

An applicability domain is a statement about validated behaviour, not about
which rows entered a sum of squares, so widening one does not require refitting
the model it qualifies. Freezing is also the *stricter* validation: nothing is
estimated from the corpus, so every prediction is out of sample by construction
rather than out of fold. The folds are still reported, because the interval
percentiles are taken over exactly those residuals, but they no longer gate the
point estimate — `foldDesign.appliedToPredictions` says so. The unseen-seed
replay remains what validates the intervals, exactly as in the fitting mode.

Two guards keep the mode honest. A frozen model that cannot clear the static
gates on the corpus it is being claimed over is **refused** rather than silently
replaced by V1: a shipped artifact must not be thrown away on the strength of an
out-of-domain panel, and an interval fitted around a bad point estimate is a
calibrated-looking lie. And the emitted `modelId` reads `revalidated-…` rather
than `calibrated-…`, so the provenance word says which half this corpus
produced.

`--pace-schedule=<schedule|search>` is the one override the mode offers, and
only with a frozen model. The schedule is the sole point-estimate component that
carries no fitted constant — the coefficients, the exponent and the two
corrections are the numbers a fit produces, and a schedule is a fixed shape read
off `progressFraction` — so re-selecting it re-reads the model rather than
re-deriving it. `search` scores all four under the same comparator the fitting
mode uses; either way every schedule's numbers land in the report's
`pointModel.paceScheduleSweep`, so the choice is visible rather than asserted.

### Multi-Budget Fitting

A corpus spanning at least **three** distinct policy budgets also fits the
budget exponent. Two budgets determine an exponent exactly and therefore measure
nothing about it; three is the smallest corpus that can disagree with a power
law. Below the threshold the fit is the historical budget-independent one, bit
for bit, and the artifact keeps declaring schema v1 — a single-budget refit of
an existing panel reproduces its predecessor byte for byte, which is the
cheapest available proof that the law machinery is inert when unused.

With the law, reference coefficients are anchored at 750,000 frames and the
exponent is searched jointly with them under the same weighted SSE the
coefficients are fitted under. Acceptance is unchanged: out-of-fold weighted
median log error against the `TRAVERSAL_BUDGET_MODEL_V1` fallback, evaluated
over the whole multi-budget corpus with the same double-blocked family x seed
folds. The exponent is therefore *fitted* by SSE and *judged* by the gate. The
form of the fit is decided once over the whole corpus, never per fold, so the
held-out numbers describe one model rather than a mixture of two.

Everything else is unchanged and deliberately so: `resumed` samples are still
excluded from every part of the fit, interval percentiles are still taken per
observation while the rest of the fit is attempt-weighted, and the applicability
domain is still simply the min and max policy budget the fitted samples covered.

Interval percentiles are taken per `(event, path availability)` stratum on the
same double-held-out predictions and under the same per-observation weighting,
with the fallback and the minimum-sample rule described under *Bounds And Budget
Headroom*. Conditioning on the regime is deliberate and conditioning on the
policy budget is deliberately avoided: a stratum uses only what the runtime also
knows at the moment it reads the interval, so it generalizes to a budget between
the fitted ones, whereas a per-budget table would only re-describe the corpus.

The calibration report gains three sections:

- `structuralForm` — the fitted exponent, the reference budget, the budgets
  present, and sample counts per budget.
- `byBudget` — every headline held-out statistic split by budget: selected and
  path-free median APE with their signed twins, interval coverage under both
  weightings, and per-path and per-event breakdowns. The per-path rows are how
  the stratification's claim is checked: each regime should hold its coverage at
  every budget, which is what "conditioning on the regime generalizes" has to
  mean if it is true. Each event row also carries `residualRatiosAtThisBudget`,
  the interval that budget's own residuals would have asked for. It is a
  **diagnostic and is never fitted into the artifact**; comparing it to the
  shipped ratios is what says whether the fitted strata can serve the whole
  domain.
- `budgetTransfer` — for each budget, a structural fit on every *other* budget
  scored on that one, next to two controls: the same training rows with no
  budget term at all, and V1.

**Budget transfer is reported evidence and deliberately not an acceptance
gate.** A gate needs a defined fallback and there is none: "the exponent did not
transfer" implies neither "emit the budget-independent fit", which is worse at
every budget in a multi-budget corpus, nor "emit V1", which the existing gate
already tests. It would also gate the wrong quantity, since the selected
estimate is path-backed at most observations while transfer measures the
structural component alone. And any threshold chosen today would be a constant
tuned to one panel's operating points, which is the shape this campaign's design
rule forbids. The table exists so a reviewer can set a bar with evidence.

### Double-Blocked Folds

Held-out evaluation blocks on **both source family and seed**. Family folds are
crossed with seed folds — five families by four seed pairs on the standard
eight-seed panel, giving twenty cells — and each sample is scored only by the
fit that withheld both its family and its seed. Both assignments are
deterministic hashes of the group key, independent of the candidate being
evaluated.

The reason is that family folds alone leave every seed of a family in the fit
whenever that family trains, so interval percentiles could be tuned to residuals
whose seed the model had already seen. Measured on the 2026-08-01 panel the
correction turned out to be **negligible** — the fitted ratios moved in the
fourth decimal and held-out coverage was unchanged — so seed leakage was not, in
fact, what any observed coverage gap came from. The blocking stays because it
removes the possibility cheaply and because a null result is only informative
once it has been measured; do not re-derive it as an open question.

Seed identity comes from an explicit `seed` field if a future analyzer emits
one, otherwise from the analysis context (`sourceId/seed/budget`, or
`name/seed=N/budget=B` for golden archives). A corpus whose seeds cannot be
recovered — run.ts sidecars carry none — or one with fewer than two distinct
seeds falls back to family-only folds, and says so on stderr and in the report's
`foldDesign.note`. It never degrades silently.

### Two Weightings, Deliberately

Every attempt carries total weight one, so a dense trace cannot dominate the
fit. That governs candidate selection, the structural coefficients, and the
correction factors, all of which describe attempts.

**Interval percentiles are the exception: they are taken per observation.** An
interval is not a claim about attempts. It is read one observation at a time —
by the analyzer's headline coverage, and by anything looking at a single
`estimate_lower_frames`/`estimate_upper_frames` pair — so `nominalCoverage` is a
promise about the observation population and its percentiles have to be taken
over observations or the number on the tin is wrong. The wedge is not academic:
on the 2026-08-01 panel, intervals fitted under attempt weighting measured 95.2%
attempt-weighted but only 92.7% per observation, because a dense path-backed
repair and a sparse structural attempt each carry weight one while contributing
very different observation counts. Fitting them per observation moves both to
95.1% and 96.3% respectively.

The calibration report therefore carries `interval.coverageConvention`,
`interval.coverage` (attempt-weighted) and `interval.coverageBySample`, and the
artifact carries both `metrics.validationIntervalCoverage` and
`metrics.validationIntervalCoverageBySample`. `nominalCoverage` names the
per-observation one. Quote which you mean.

Path bucketing follows the same positive-path rule as the recorder: the
with-path correction is fitted only on observations the runtime would actually
route through the path branch.

**`resumed` samples are excluded from every part of the fit** — candidate
selection, the structural coefficients, both correction factors, the event
intervals, and the `structuralAttemptKinds` derivation. A resumed attempt
reports its tree's root anchor while its frontier is already deep, so its
anchor, structural progress, and pace are the continuation approximations
described under *Attempt kinds*, not fresh-start measurements: its features
describe a search state it is not in, and its remaining work is a small
fraction of what they imply. Admitting them is not merely noisy. Because the
path-free bucket is what defines `structuralAttemptKinds`, it would also put
`resumed` in the artifact's structural domain and make every such observation
report `calibrated` — the exact false claim the applicability field exists to
prevent. They remain in the analysis corpus as diagnostics, and the calibration
report records the excluded count under `fitPopulation` so the exclusion is
visible provenance rather than a silent filter. The analyzer, which measures
rather than fits, still reports them on their own attempt-kind row.

The static comparator is recomputed from `TRAVERSAL_BUDGET_MODEL_V1` and the
sample's raw structure fields. It does not reuse `sample.structural`, because
that value belongs to whichever artifact recorded the input telemetry. If the
candidate is rejected, metrics, intervals, and emitted coefficients therefore
all describe the same V1 fallback model.

Each fitted event interval is clamped to contain ratio `1`, so its lower bound
cannot exceed the point estimate and its upper bound cannot fall below it. This
is both the interval semantic and a runtime artifact-validation invariant.

## Validation Evidence

The 2026-07-31 calibration panel used 44 development sources from 14 origin
families, eight seeds, and 750k frames: 352 traces, 1,246 attempts, and
270,495,875 charged frames. All
frames were segmented with zero accounting violations. Enabling and changing
telemetry produced identical track hashes in all 352 paired runs.

Grouped validation selected `path_if_available+none`:

```text
weighted median |log(predicted / actual)|: 0.0319
legacy static baseline:                    0.8396
grouped event-conditional interval:        95.1%
```

The legacy-static line is `TRAVERSAL_BUDGET_MODEL_V1` scored on this corpus's
remaining-work question at 750k. It is not a verdict on V1 as a policy
coordinate system; see *Two Structural Models*.

An unseen seed-10 all-family replay produced 93.9% overall coverage: 96.3% at
starts, 93.8% at high-water updates, and 100% at spend observations. Its
combined median absolute percentage error was 3.9%, and its one censored attempt
did not exceed the predicted upper bound.

The required 2M music check exposed the policy-budget boundary. Two Shelter and
two Believer runs accounted for all 8,108,028 charged frames. Its pre-terminal
observations break down as follows:

| phase/component | samples | median APE | interpretation |
|---|---:|---:|---|
| no path, selected structural-only estimate | 355 | 61.0% | out-of-domain and predominantly underpredicting |
| no path, episode-pace diagnostic where available | 347 | 7.8% | observed online pace before first completion |
| repair, raw incumbent-path component | 122 | 6.1% | measured original-path suffix before correction |
| repair, selected corrected path estimate | 122 | 1.3% | calibrated estimate used after first completion |

The first row is the source of the quoted "61% at 2M" result. It is not the
post-completion estimate. Those observations are marked
`extrapolated_policy_budget`; the path-backed repair observations remain
`calibrated`.

The 7.8% pace row is a music-spec number and does not carry to the golden
corpus: a fresh golden-spec panel measured 22-23% median APE for the same
episode-pace diagnostic. Pace still degrades far more gracefully than the
structural estimate does out of domain, but quote it with its corpus — "pace is
accurate outside the calibration domain" is a property of those four music runs,
not of the mechanism.

A 2026-08-01 independent replication re-collected 112 compiles and reproduced
the calibrated headline: 3.97% median APE and 97.0% calibrated interval
coverage, with zero accounting violations. The same campaign produced the
soft-cap and ceiling-overrun measurements quoted under *Mental Model And Units*.

### 2026-08-01 Recalibration

The incumbent-path coverage fix landed after the 2026-07-31 artifact was fitted,
so its corrections and intervals reflected the sparse-path corpus. A fresh panel
was collected on the fixed tree with the same protocol — 44 development sources,
14 origin families, eight seeds, 750k, trace level via
`scripts/v0/benchmark_v2/scale_study.ts` — giving 352 traces, **1,383 attempts**
(of which 134 are the newly attributed `resumed` phase) and 270,439,760 charged
frames, all segmented with zero accounting violations. 45,047 samples were
analyzed; 168 `resumed` samples were excluded from fitting, leaving 44,879.

Grouped validation again selected `path_if_available+none`:

```text
weighted median |log(predicted / actual)|: 0.0263
legacy static baseline:                    0.8383
event-conditional interval, per observation: 95.0%
event-conditional interval, attempt-weighted: 96.3%
```

The refit reproduces the previous structural coefficients to four significant
figures, which is the cleanest evidence that the 2026-07-31 fit was sound and
that what changed is bucketing, not physics. What moved is the path-free
correction, `0.973451` to `1.013378`: the old value was pulled below one by the
20.2% of repair observations that had no measured path and therefore shared the
structural bucket. With those gone the structural branch is initial-attempt
evidence only, and it wanted no net shrink.

An unseen seed-10 all-family replay of the same 44 sources gives a **3.1%
combined median absolute percentage error, improving on the previous artifact's
3.8% on the identical corpus**, with the structural component unchanged at 6.1%.
A repeat 2M music check (two Shelter, two Believer) accounted for all 8,113,178
charged frames with zero violations, kept every path-backed repair observation
`calibrated` at 2.5% median APE, and left all 369 extrapolated observations with
null margins.

Interval coverage held, but only after the fitting convention was corrected, and
the route there is worth recording because the obvious diagnosis was wrong. A
first refit under the old attempt-weighted interval convention delivered 95.2%
attempt-weighted on the panel and 93.7% on the unseen seed, but just 92.7% and
91.0% per observation — a `nominalCoverage: 0.95` artifact under-delivering
against the convention its readers actually use. The suspicion was seed leakage
in the folds. Blocking the folds on seed as well as family (see *Double-Blocked
Folds*) moved the fitted ratios in the fourth decimal and changed coverage not
at all: seed variance was never the problem. Taking the interval percentiles per
observation instead was, and that is what the shipped artifact does.

| corpus | artifact | per observation | attempt-weighted |
|---|---|---:|---:|
| fitting panel | 2026-07-31 | 94.7% | 95.9% |
| fitting panel | 2026-08-01 | **95.1%** | 96.3% |
| unseen seed 10 | 2026-07-31 | 94.0% | 95.5% |
| unseen seed 10 | 2026-08-01 | **94.1%** | 95.1% |

The intervals this costs are wider on the lower side and tighter above: the
high-water band moved from `[0.795, 1.252]` to `[0.788, 1.267]`, and the start
band from `[0.573, 1.151]` to `[0.855, 1.256]` — the latter mostly because the
old start band was fitted when repair starts were 52% path-free and is now
fitted on a uniformly path-backed population.

### 2026-08-01 Budget Law

The shipped artifact is `calibrated-path_if_available+none-2c59b9a5802c`: schema
v2, a budget exponent of 0.825 anchored at 750k, intervals stratified by event
and path availability, a structural domain of [300k, 1.5M], and a path claim
scoped to that same domain. Getting there took two rounds and both are recorded
here, because the reasons a narrower artifact shipped are the useful part.

**Round 1 fitted the four-budget panel and was refused.** 44 sources, 14
families, seeds 0-7, budgets {150k, 300k, 750k, 1500k}, 167,835 samples of which
167,119 fitted after excluding 716 `resumed`, all recorded by one estimator
artifact with zero accounting violations. It reproduced the study's independent
`calibrator`-view fit to four significant figures — reference coefficients
24,126.7 / 3,696.4 / 19.04 against the study's 24,126.7 / 3,696.4 / 19.04, alpha
0.8185 against 0.819 — from a different implementation and under the frozen
calibrator's own fold design. Budget transfer, fitting three budgets and
predicting the fourth, gave exponents of 0.825 / 0.803 / 0.824 / 0.829 and
path-free median APEs of 10.0% / 8.3% / 5.4% / 4.6%, against 321% / 150% / 7.6% /
66% for the same rows with no budget term and 43% / 17% / 63% / 79% for V1. The
exponent, not a refreshed anchor, is what earns those numbers.

It was refused on interval coverage at 150k: 91.1% held out and 90.0% live
against a `nominalCoverage: 0.95` claim. That is the artifact's own printed
promise, and a wider domain bought with a false claim is not worth having.

**Round 2 tried to fix it with a mechanism and then narrowed instead.** The
diagnosis said 150k was a different regime rather than a farther one — 84%
path-free observations against 64% at 750k, 8.2% of panel cells censored — so
the intervals were split by `(event, path availability)`, which conditions on
the regime the runtime can see rather than on the corpus's budget identity. The
split is real and large (path-backed high-water `[0.943, 1.132]` against
path-free `[0.712, 1.269]`) and it is now how every interval is read, but at 150k
it moved coverage only 91.1% to 91.7%. It was not forced any further.

So the calibrated domain became [300k, 1.5M] — fitted on those three panels,
135,796 samples — and that exposed the second finding. With 150k out of the
structural domain, its path-backed observations were still `calibrated` through
the budget-independent path rule, and against the sharper bands they covered
**35%**. The cause is not interval width: path-backed estimates are unbiased at
300k, 750k and 1.5M (median actual/predicted 1.006, 0.995, 0.994) and **19%
biased at 150k**, where the incumbent handed to repair came out of a search that
barely completed. Narrowing the structural domain while leaving that claim
standing would have replaced one false claim with a worse one, so the path claim
was scoped to the domain as well. Every claim the shipped artifact makes is now
inside evidence, and 150k is uniformly `extrapolated_policy_budget`.

Held out, per budget and per stratum:

| budget | path-free APE | selected APE | coverage | withPath | withoutPath |
|---:|---:|---:|---:|---:|---:|
| 300,000 | 7.4% | 5.5% | 96.6% | 94.8% | 97.3% |
| 750,000 | 5.5% | 3.3% | 94.5% | 95.4% | 93.9% |
| 1,500,000 | 4.2% | 2.7% | 94.2% | 94.8% | 93.8% |

A paired live check on an unseen seed 10 — the same 44 sources compiled twice on
this tree, once under each artifact — measures the whole trade end to end:

| corpus | structural APE | combined APE | calibrated coverage | in-domain samples |
|---|---:|---:|---:|---:|
| 150k, previous | 272.0% | 260.9% | 88.1% | 628 of 4,030 |
| 150k, shipped | **9.4%** | **10.9%** | n/a — none claimed | 0 of 4,030 |
| 300k, previous | 126.1% | 119.1% | 98.7% | 1,429 of 5,089 |
| 300k, shipped | **6.9%** | **5.2%** | 97.0% | 5,057 of 5,089 |
| 750k, previous | 6.1% | 3.10% | 94.1% | 5,580 of 5,590 |
| 750k, shipped | 6.3% | 3.13% | **95.1%** | 5,580 of 5,590 |
| 1.5M, previous | 43.9% | 39.9% | 98.3% | 2,732 of 6,331 |
| 1.5M, shipped | **5.2%** | **2.8%** | 93.6% | 6,314 of 6,331 |
| 2M music, previous | 59.8% | 59.2% | 100% | 154 of 504 |
| 2M music, shipped | **10.5%** | **9.0%** | n/a — none claimed | 0 of 504 |

Three lines in that table deserve their qualifier.

**750k costs 0.03pp.** Pooling three budgets moves the reference coefficients off
the 750k-only optimum, which the study predicted; live it is 3.13% against
3.10%, and coverage at 750k improved from 94.1% to 95.1%. That is the price of
being right at every other budget, and it is smaller than the round-1 four-budget
fit's 3.31%.

**1.5M coverage is 93.6% live against 94.2% held out.** It is the thinnest
margin in the artifact, and the weakest cell is path-free at 1.5M (92.5% live,
93.8% held out). The direction is not systematic — 750k went the other way, 94.5%
held out to 95.1% live — so this reads as single-seed variation of the size the
previous artifact also showed (95.0% held out, 94.1% live). It is the number to
watch on the next panel.

**The old artifact's 98.3% at 1.5M and 98.7% at 300k are not wins.** They are
coverage over the 43% and 28% of observations that were in domain at all — the
path-backed ones — while the structural majority was extrapolated and scored 44%
and 126% APE. The shipped artifact claims four times as many observations at
those budgets and covers them.

Every out-of-range regime is labelled and behaves. At 2M — 2.67x reference — all
504 observations are `extrapolated_policy_budget` with null margins even though
the structural error collapsed from 59.8% to 10.5%; the 154 path-backed ones
would have been accurate (2.5% median APE) and are the true claim the scoped
path rule gives up. At 75k every one of 3,040 observations is extrapolated, the
structural error is 27.8% against the study's 29.6%, and zero repair attempts run
at all, which is the regime change that makes 75k out of domain rather than
merely inaccurate.

Neutrality is exact at every step: 176 paired golden compiles across four budgets
and four paired 2M music compiles produced identical track hashes, scores, and
`sim_frames` under both artifacts, and the two named reference tracks
(`cold_start` and `tiny_dance` at 150k seed 0) hash unchanged.

**150k is a distinct regime and needs its own treatment.** Both of its failures
point the same way: 8.2% of its cells never complete, so its samples are
conditioned on completing; its observations are 84% path-free; and the incumbent
its repairs inherit is the product of a search that barely finished, which is why
the path component is biased there and nowhere else. A future artifact that wants
150k needs evidence about that regime — not a wider interval fitted above it.

### 2026-08-03 The 250k Extension

The domain floor moved 300k → 250k. **Nothing else in the artifact moved**:
`structural`, `combination` and `interval` are byte-identical to
`calibrated-path_if_available+none-2c59b9a5802c`, and the emitted artifact is
`revalidated-path_if_available+none-d0ec08d7b376`. 150k was tried and refused for
the third time, now with numbers on the current tree.

**A fresh corpus, because the old one had gone stale.** The 2026-08-01 law panels
predate the whole dividends campaign body of work — Phase 1a's single deadline
signal, the eleven-ramp deletion, the Phase-3 margin base and the Phase-4
redraw-on-empty among them. Spot-checked, `split_signal` seed 0 at 750k moved its
first completion 376,849 → 331,925. So every panel was recollected at `31c2beb`:
44 development sources from 14 origin families, seeds 0-7, budgets {75k (seeds
0-1), 150k, 250k, 300k, 750k, 1500k}, plus an unseen seed-10 replay at each of
150k / 250k / 300k / 750k / 1500k. **2,068 compiles, 1,197,570,520 charged
frames, zero accounting violations, one recording artifact throughout**, all
through `scale_study.ts` at `--budget-telemetry=trace`. (Two panels were
recollected after an artifact-perturbation probe contaminated them mid-run; the
mixed-fingerprint check that caught it is a whole-corpus analyzer check and it
did its job.)

The fresh corpus first reproduces the shipped fit. Refitting the incumbent's own
form on {300k, 750k, 1500k} returns 23,316.5 / 3,614.0 / 21.74 with alpha 0.826,
against the shipped 23,860.1 / 3,699.9 / 18.35 and 0.825 — and scores *worse* out
of fold (0.0302) than the shipped model scores out of sample on the same rows
(0.0298). The estimator survived the compiler drift.

**250k is in regime and 150k is not, and the path component is what says so.**
Median actual/predicted of the incumbent path, after the artifact's own
correction — the exact quantity the 2026-08-01 section reads 1.189 at 150k:

| budget | 150k | 250k | 300k | 750k | 1.5M |
|---|---:|---:|---:|---:|---:|
| corrected path actual/predicted | **1.185** | 1.011 | 1.009 | 0.998 | 0.994 |

250k lands inside the 0.99–1.01 band the domain budgets occupy; 150k is 19%
away, and the raw measurement's sign flips between them (−10.3% signed error at
150k against +5.2% at 250k). Every other regime marker agrees on where the
boundary is: initial attempts that never complete run 8.2% of cells at 150k, 4.0%
at 250k, 0.6% at 300k and 0% at 750k and 1.5M (38.6% at 75k), and the path-free
observation share runs 89.6% at 150k against 79.8% at 250k and 66.5% at 750k.

Held out per budget, under the frozen point model and the frozen bands
(`--freeze-point-model --freeze-intervals`), on the eight-seed panels and then on
the unseen seed 10:

| budget | selected APE | coverage, panel | coverage, unseen seed | withPath | withoutPath |
|---:|---:|---:|---:|---:|---:|
| 250,000 | 4.6% | **96.1%** | **95.9%** | 93.2% | 96.8% |
| 300,000 | 5.5% | 97.1% | 96.6% | 95.5% | 97.6% |
| 750,000 | 3.5% | 95.5% | 95.2% | 94.2% | 96.2% |
| 1,500,000 | 3.1% | 93.3% | 93.2% | 94.5% | 92.5% |

The three incumbent rows are **exactly** the shipped artifact's numbers on the
same corpus, because the bands are the shipped bands. That is the whole point of
freezing them, and it is a deliberate choice over the alternative:

**Refitting the bands to admit 250k was measured and rejected.** One band serves
the whole domain, so refitting is not free — the pooled percentile moves and
every other budget pays. The refit arm lifts 250k's `withPath` cell from 93.2% to
94.3% and costs 0.3pp at 300k, 0.4pp at 750k and 0.5pp at 1.5M, which lands on
the artifact's already-thinnest cell. The diagnostic says why: the high-water band
each budget's *own* residuals ask for is `[0.827, 1.264]` at 250k, `[0.841,
1.223]` at 300k, `[0.791, 1.200]` at 750k and `[0.692, 1.242]` at 1.5M. The low
tail widens with the budget, so pulling the pooled lower ratio up to serve 250k
(0.718 → 0.754) is taken straight out of 1.5M. Validating the incumbent's band at
a new budget is also the stronger evidence: the new budget's residuals were never
in the percentile they are scored against.

**1.5M is the artifact's binding weakness and it is pre-existing.** 93.3% on the
panel and 93.2% on the unseen seed, under the *shipped* artifact, against a
`nominalCoverage: 0.95` promise; the weak cell is path-free at 1.5M (92.5%). The
2026-08-01 section called this "the number to watch on the next panel" at 93.6%
live. Watched: it is still there, at the same size, on a fresh corpus and a
drifted compiler. It is not caused by the extension — freezing the bands is
precisely what keeps the extension from making it worse — and it is filed as work
rather than fixed here, because the fix is either a third interval dimension or a
point-estimate change, and both are their own evidence burden.

**150k: refused a third time, with the mechanism named.** Under the frozen point
model the 150k panel reads 9.8% selected APE — respectable — but coverage of
**87.3%** with the frozen bands and **92.4%** with bands refitted to include it.
The aggregate is not the finding. The finding is the `high_water`/`withPath` cell:
**33.4%** with the frozen bands, **77.0%** with refitted ones, on 2,739 and 3,052
observations. No interval width fixes a 19% point-estimate bias, and widening a
pooled band far enough to try would wreck every other budget. The unseen seed
agrees (93.8% aggregate, 89.9% withPath).

Three further arms close the remaining doors:

- **The unconstrained pooled refit is worse everywhere.** Fitting all five
  budgets afresh — the arm that moves live policy — gives 150k 11.4% APE against
  the frozen model's 9.8%, and degrades 250k (6.0% vs 4.6%), 300k (7.1% vs 5.5%),
  750k (3.7% vs 3.5%) and 1.5M (3.3% vs 3.1%). Its 150k coverage is 92.6% and its
  150k `withPath` cell is 77.1%: identical to the frozen model's. Refitting buys
  nothing and rescues nothing.
- **Episode pace is real at 150k and cannot be bought with one schedule.** Under
  the frozen corrections, a nonzero schedule cuts 150k's selected APE from 9.8% to
  **7.5%** (`smoothstep_progress`, `linear_progress`) or 7.3% (`sqrt_progress`) —
  the largest single improvement any arm produced at 150k. It costs 750k (3.5% →
  4.0/4.2/5.3%) and 1.5M (3.1% → 4.0/4.3/5.6%), and loses the corpus-wide
  comparator at every schedule (0.0364 against 0.0412 / 0.0429 / 0.0502). The
  reason is that pace carries a budget tilt of its own, and it runs the other way:
  its median signed error is +4.1% at 150k, −0.6% at 250k, −1.3% at 300k, −2.7% at
  750k and −4.8% at 1.5M, against the path's −10.3% / +5.2% / +5.4% / +6.5% /
  +6.9%. Blending them at a fixed weight cancels the two tilts at exactly one
  budget. Pace helps where the structural and path components are weak and hurts
  where they are strong, so a single global weight cannot capture it; the shipped
  artifact keeps `paceSchedule: "none"` on a five-budget corpus for the same
  reason it did on a one-budget corpus, now with the trade measured. Making the
  weight budget-conditional is either a per-budget table or a correction refit,
  and the first is forbidden by the campaign's design rule while the second moves
  live policy.
- **75k is still a different animal.** 39% of its cells never complete, it runs
  **zero repair attempts**, and it has no incumbent path at all — the path
  component has `n = 0`. Nothing about the low-budget treatment reaches it.

**Neutrality is exact.** The claim layer is not read by anything but telemetry, and
that was checked rather than assumed. A probe that perturbed
`structural.contactFrames` by 1% moved `sim_frames` on two of four reference
cells; perturbing the applicability domain, the interval bands and the pace
schedule moved nothing. End to end, the shipped and extended artifacts produce
**44 of 44 paired cells identical in track hash, `sim_frames`, first-completion
frame and score** on a full 250k seed-10 grid, and the four named reference cells
hash unchanged. `analyze_budget_telemetry.ts` exits 0 on the new corpora and on an
Aug-1 corpus recorded by the previous artifact. The full vitest suite has the same
41 failures as `31c2beb` before any change, all in benchmark-governance and CLI
suites that depend on generated artifacts, plus seven new passing tests.

A live end-to-end check under the extended artifact — the 250k seed-10 grid
recompiled and re-analyzed — records **4,244 of 4,282 observations `calibrated`
where the shipped artifact recorded none**, at 95.9% interval coverage and 4.3%
combined median APE, with every estimate, interval, margin and surplus re-derived
from its own components and matched.

**Reopening conditions for 150k.** The blocker is the path component's bias, so
what changes the answer is anything that changes the incumbent handed to repair
at a scarce budget: a repair mechanism that re-measures `costToEnd` after the
first repair rather than inheriting the original profile; a 150k initial-attempt
incompletion rate that stops conditioning the corpus (8.2% today, against 0.6% at
the domain floor's neighbour 300k and 0% at 750k); or
a point-estimate change that is going through a paired benchmark evaluation
anyway, in which case a budget-conditional pace weight becomes affordable and the
7.5% measurement above is what it should be judged against. Widening intervals is
not on the list and should not be retried.

## Non-Policy Status, And The One Exception

The **recorder** is a characterization surface, not a controller: no search,
geometry, scoring, repair, or RNG decision reads a telemetry payload. That has
not changed and should not.

The **artifact** is a different object and the statement no longer holds of it
whole. Since the margin's structural base became the calibrated artifact
(dividends Phase 3), `deadline.ts` reads `BUDGET_ESTIMATOR_MODEL.structural`,
`combination.baseMode` and both correction factors, and the deadline ramp drives
traversal breadth. Those fields are live policy. `applicability`, `interval`,
`metrics` and `modelId` are not read by anything but telemetry, and
`combination.paceSchedule` is overridden by `deadline.ts` before policy sees it.
See *Two Layers, And Widening A Claim Without Refitting* for the split, the
measurement behind it, and the calibrator mode that respects it.

The practical consequence: **refitting the point estimate is a compiler change**
and needs a paired benchmark evaluation like any other, while re-deriving the
claim layer is not and does not. Do not conflate the two because they live in
one file.

Before any *new* optimizer mechanism consumes this telemetry, that policy still
needs a separate proposal, multi-budget evidence for the intended domain, paired
search-quality evaluation, and an explicit benchmark-governance decision.
