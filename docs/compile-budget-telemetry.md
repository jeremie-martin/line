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

The initial search attempt's execution ceiling is the hard budget, because the
frontier may legally continue beyond a smaller policy budget. Policy budget
changes decision parameters; it does not create a fictitious local stop. Repair
attempts record their actual, potentially smaller compile-global ceilings.

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

Compile-level fields are deliberately small:

| field | exact meaning |
|---|---|
| `budget_exhausted` | compiler's capture-time indication that charged work reached the hard budget |
| `initial_structural_work_prior_frames` | initial attempt's structural estimate at its start |
| `initial_structural_slack` | policy budget divided by that initial estimate, or zero for a zero estimate |
| `model.*` | traversal/estimator names, estimator SHA-256 fingerprint, and fitted-artifact flag needed to interpret persisted values |

`model.calibrated` says the artifact was fitted; it does **not** say every
observation is in-domain. Use each observation's `estimator_applicability` for
that decision.

Execution segments are contiguous and partition `total_spent` into startup,
initial search, repair attempts, resumed search, and any explicitly
unattributed finalization. An analyzer violation means the instrumentation is
wrong; it is not a soft statistical warning.

For every segment, `spent_frames = end_total_spent_frames -
start_total_spent_frames`. `attempt_id` links work owned by a search attempt;
segments such as unowned finalization may use `null`. `unattributed` is emitted
at snapshot time only when recorded segments do not yet cover all charged work,
making an instrumentation gap visible rather than silently dropping it.

Each initial, snapshot, or repair attempt records:

- its parent, deterministic search seed, and fallback state;
- anchor gap/contact/duration suffix;
- global start, local ceiling, available hard budget, and local budget;
- start/end estimates and optional trace observations;
- stop reason, charged work, first-terminal offset, censoring, and whether a
  repair improved the incumbent.

An attempt is `completed` only when it considered a terminal traversal.
Otherwise it is explicitly `censored`; budget exhaustion is not treated as an
observed completion cost.

Attempt kinds have exact meanings:

- `initial`: search from a newly constructed start state;
- `snapshot`: search resumed from a supplied compiler snapshot;
- `repair`: seed-perturbed search from a prefix of a completed incumbent.

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
trace. Duplicate events at the same work counter and gap are suppressed.

## Remaining-Work Quantities

For a completed attempt, the analyzer defines the ground-truth remaining work
at observation `o` as:

```text
terminal total = attempt start + first terminal offset
actual remaining(o) = terminal total - o.total_spent_frames
```

Only positive pre-terminal values enter estimator-error statistics. Incomplete
attempts are censored and never assigned a fictional completion cost.

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
| `incumbent_path_work_estimate_frames` | measured work from this gap to first completion on the original incumbent search | repair attempts where that incumbent gap was observed; otherwise `null` |

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

A repair at gap `k` inherits `costToEnd`. The repair keeps the incumbent prefix
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

The current correction factors are `0.939428` with a path and `0.973451`
without one. Measured episode pace remains a first-class diagnostic but was not
selected: every tested pace blend made grouped held-out point error worse. Read
the artifact rather than copying these constants into code; recalibration may
replace them.

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

Completion margins have direct units:

```text
hard_completion_margin    = hard remaining / estimated remaining work
attempt_completion_margin = local remaining / estimated remaining work

hard_completion_surplus    = hard remaining - estimated remaining work
attempt_completion_surplus = local remaining - estimated remaining work
```

For example, a margin of `1.5` means the available budget is 1.5 times the point
estimate; a surplus of `-20,000` means the point estimate exceeds the available
budget by 20,000 charged frames. Margins are `null` outside the estimator's
calibration domain. Surpluses remain visible as arithmetic diagnostics but do
not become calibrated claims.

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
selected estimate   = 72,000 * 0.939428              = 67,639
hard remaining      = 750,000 - 540,000              = 210,000
attempt remaining   = 650,000 - 540,000              = 110,000
hard margin         = 210,000 / 67,639                = 3.10
attempt margin      = 110,000 / 67,639                = 1.63
```

The current high-water interval ratios produce approximately
`[53,776, 84,662]`. If this attempt first reaches a terminal at global work
605,000, actual remaining work at the observation was 65,000, giving this point
estimate an absolute percentage error of about 4.1%.

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
- `unvalidated_attempt_kind`: a structural snapshot/resume estimate for an
  attempt kind absent from the calibration corpus. Path-backed estimates still
  use their separately validated applicability.

For extrapolated observations, the point components remain visible for study,
but calibrated margins are `null` and the uncertainty interval expands to at
least the remaining hard budget. Do not turn extrapolated point estimates into
policy decisions.

## Persistence

Telemetry is kept separate from score/report semantics:

- `run.ts`: `<out>.budget-telemetry.json`;
- Benchmark V1 checkpoints: `budget_telemetry`;
- Benchmark V2 and scale-study runs: `budgetTelemetry`;
- production bundles: `budget-telemetry.json`;
- lab SQLite: `checkpoints.budget_telemetry_json`.

The report semantic fingerprint does not include telemetry.

## Analysis And Calibration

Validate one or more sidecars/archives:

```bash
npx tsx scripts/v0/analyze_budget_telemetry.ts \
  generated/budget-telemetry/panel.json \
  --source-manifest=benchmark/v2/compat/source-manifest.json \
  --out=generated/budget-telemetry/panel.analysis.json
```

The command exits nonzero on accounting violations and emits JSON plus Markdown.
It reports component error, interval coverage, censoring, attempt-kind splits,
and calibrated versus extrapolated samples.

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
`combined` is the point estimate selected by the frozen artifact.

Refit the frozen artifact only from a reviewed analysis corpus:

```bash
npx tsx scripts/v0/calibrate_budget_estimator.ts \
  generated/budget-telemetry/panel.analysis.json \
  --folds=5 --coverage=0.95 \
  --out=scripts/v0/optimizer/budget_estimator_model.json \
  --report=generated/budget-telemetry/panel.calibration.json
```

The calibrator holds source families together, fits non-negative structural
coefficients, evaluates structural/path/pace combinations out of fold, and
retains the static model unless median log error improves by at least 5% without
more than a 5% p90 underprediction regression.

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

## Non-Policy Status

This telemetry is a characterization surface, not a controller. Before any
optimizer mechanism consumes it, that policy needs a separate proposal,
multi-budget evidence for the intended domain, paired search-quality evaluation,
and an explicit benchmark-governance decision.
