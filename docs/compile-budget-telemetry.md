# Compile Budget Telemetry

`scripts/v0/optimizer/budget_telemetry.ts` records how a handoff compile spends
its frame budget and how much work appears to remain. It is observation-only:
no search, geometry, scoring, repair, or RNG decision reads these values.

This document is the semantic reference for the payload. The TypeScript types
are the schema reference; the frozen estimator artifact is the source of truth
for fitted coefficients and calibration bounds.

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

`ceiling_source` names how `ceiling_total_spent_frames` was sized:

| value | meaning |
|---|---|
| `hard_budget` | the compile's hard budget; initial and resumed attempts |
| `measured_cost_to_end` | the incumbent's measured cost-to-end at this anchor, times the repair feasibility margin |
| `per_gap_fallback` | the anchor is in neither reach map, so the coarse per-gap average was used; rare |
| `repair_budget_remaining` | the sized ceiling reached the repair budget and was clipped to it |

This field makes one tautology visible in data. A `measured_cost_to_end`
ceiling is derived from the same `costToEnd` profile the estimator uses as its
path base, so at such a repair's start `attempt_completion_margin` is the
constant `feasMargin / correctionWithPathFactor` — arithmetic, not evidence
about estimator accuracy. `feasMargin` itself ramps with the compile budget
(1.05 scarce, 1 from 200k up), so at the calibrated 750k budget the constant is
measured at exactly 1.062964 on every such start. Since repair ceilings became
measured wherever a reach stamp exists, this covers nearly every repair start,
so never read a repair's start margin as an accuracy signal.

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
structural S = startup intercept when applicable
             + contact coefficient * remaining contacts
             + duration coefficient * remaining duration frames

structural progress fraction = clamp((S0 - S) / S0, 0, 1)

episode pace = attempt spent * S / (S0 - S)

incumbent path = measured cost-to-end suffix inherited by a repair attempt
```

The component fields and availability are:

| field | meaning | availability |
|---|---|---|
| `structural_work_prior_frames` | fitted structure-only remaining work `S` | always |
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

The current correction factors are `0.940766` with a path and `1.013378`
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

Prediction bounds are empirical and event-specific. Starts, high-water updates,
and spend-without-progress observations have different error distributions, so
one aggregate interval would either undercover the latter or be needlessly wide
for all observations.

```text
estimate lower = selected estimate * event lower ratio
estimate upper = selected estimate * event upper ratio
estimate uncertainty = (upper - lower) / 2
```

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
`feasMargin / correctionWithPathFactor` constant described under
`ceiling_source`: it is the sizing rule read back, and it carries no information
about whether that repair will finish.

At compile scope:

```text
initial structural slack = policy budget / initial structural work prior
```

It is zero when the initial prior is zero. This is a frozen, start-of-compile
ratio; it does not adapt as work is observed.

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
selected estimate   = 72,000 * 0.940766              = 67,735
hard remaining      = 750,000 - 540,000              = 210,000
attempt remaining   = 650,000 - 540,000              = 110,000
hard margin         = 210,000 / 67,735                = 3.10
attempt margin      = 110,000 / 67,735                = 1.62
```

The current high-water interval ratios produce approximately
`[53,342, 85,838]`. If this attempt first reaches a terminal at global work
605,000, actual remaining work at the observation was 65,000, giving this point
estimate an absolute percentage error of about 4.2%.

## Applicability

The structural estimator is calibrated for the measured 750k policy budget.
That qualifier matters because the compiler itself changes forward-search
breadth as the initial policy budget and structural slack increase. A 2M run is
not merely the same traversal with more frames after completion.

Each observation therefore reports:

- `calibrated`: structural estimate at the calibrated policy budget, or a
  path-backed repair estimate;
- `extrapolated_policy_budget`: structural estimate under an uncalibrated
  policy budget.
- `unvalidated_attempt_kind`: a structural estimate for an attempt kind with no
  path-free evidence in the calibration corpus, which today means `snapshot`,
  `resumed`, and `repair`. The first two are never fitted at all; `repair` joins
  them because full incumbent-path coverage means no repair observation is
  path-free any more, so a repair that somehow lacked a path would be an
  unmeasured case. Path-backed estimates still use their separately validated
  applicability, which is what every real repair observation gets.

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
and every attempt's identity, anchor, counters, and outcome, but drops the
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

Refit the frozen artifact only from a reviewed analysis corpus:

```bash
npx tsx scripts/v0/calibrate_budget_estimator.ts \
  generated/budget-telemetry/panel.analysis.json \
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

## Non-Policy Status

This telemetry is a characterization surface, not a controller. Before any
optimizer mechanism consumes it, that policy needs a separate proposal,
multi-budget evidence for the intended domain, paired search-quality evaluation,
and an explicit benchmark-governance decision.
