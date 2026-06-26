# Difficulty Model Study

Design context: [`budget-control-design.md`](budget-control-design.md) defines
the non-circular interpretation of traversal difficulty, slack, spend knobs, and
validation gates. This document records the empirical fits and probes.

Baseline studied:
`generated/golden-runs/attempt-true-target-objective-newgrid-a01/golden.json`
on the canonical 125k/250k/375k/500k grid.

Command:

```bash
node --import tsx scripts/v0/study_difficulty_model.ts \
  --golden=generated/golden-runs/attempt-true-target-objective-newgrid-a01/golden.json \
  --budget=250000 \
  --out=generated/studies/difficulty-model-baseline.json
```

The script is read-only. It joins the golden archive to static spec features
(duration, contact count, contact spacing, active target axes, authored impact)
and fits small linear models with leave-one-spec-out validation. It treats two
questions separately:

- **Traversal cost:** how many simulated frames it takes for handoff search to
  first consider a terminal traversal (`first_completion_frame`, with
  `repair.first_completion_frame` used only as an older-archive fallback).
- **Quality hardness:** what full-run score the compiler reaches after spending
  the whole budget.

To refresh the production constants, rerun the command above on the intended
baseline archive, inspect `canonical.first_completion.recommended_model` in the
generated JSON, and update `TRAVERSAL_BUDGET_MODEL_V1` in a reviewed commit.

## Findings

First-completion cost is easy to model from static structure. At 250k, every
seed/spec row records a first-completion frame. The safest simple model was:

```text
first_completion_frames ~= 5,848
  + 796 * contact_count
  + 29.6 * duration_frames
```

Validation:

```text
train R2 0.987, MAE 2,026 frames
leave-one-spec-out R2 0.984, MAE 2,196 frames
leave-one-family-out R2 0.984, MAE 2,144 frames
```

This is the model to trust for now. A slightly fancier model with target-axis and
impact means had similar ordinary leave-one-spec-out score, but those features
are more likely to be corpus-correlated. The simple contact-count + duration
model also survives whole-family holdouts (drums, legacy, elevation, amplitude,
combined), which is the leakage check that matters because many specs are
siblings. Per-family R2 can be unstable when a family has little internal
variance, so the actionable family errors are MAE/MAPE:

```text
drums:     MAE 1.4k frames, MAPE 1.6%
elevation: MAE 1.3k frames, MAPE 3.6%
amplitude: MAE 1.6k frames, MAPE 4.4%
combined:  MAE 2.3k frames, MAPE 5.7%
legacy:    MAE 3.5k frames, MAPE 8.7%
```

The robust part is not that the coefficients are causal truths. The robust part
is that first-completion cost is mostly a smooth function of contact count plus
simulated duration. Contact count alone already gets leave-one-spec-out R2 0.948;
duration alone gets 0.874. Median gap alone is weak at 0.380.

The budget telemetry also shows that first completion is usually much cheaper
than the requested budget:

```text
125k: 461/480 rows recorded first completion, mean 51.3k, max 122.2k
250k: 480/480 rows recorded first completion, mean 53.0k, max 126.5k
375k: 480/480 rows recorded first completion, mean 54.0k, max 111.1k
500k: 480/480 rows recorded first completion, mean 54.4k, max 113.3k
```

Training the simple traversal model at 250k and evaluating it against each
budget's independently measured first-completion rows stays stable:

```text
125k: R2 0.985, MAE 2.1k
250k: R2 0.987, MAE 2.0k
375k: R2 0.976, MAE 2.8k
500k: R2 0.972, MAE 3.0k
```

Why the fit can be this good: first completion is a compute-accounting quantity.
The compiler must simulate a roughly fixed amount of candidate/rollout work per
contact plus full/partial trajectory windows whose cost grows with authored
duration. It is much closer to a deterministic work model than to "musical
difficulty."

Full-run score is not explained well by the same static features. The best
budget-weighted score model was:

```text
score ~= 1,020
  - 2.97 * contact_count
  - 49.6 * active_axis_mean
  - 147.0 * impact_mean
```

Validation:

```text
train R2 0.362, MAE 47.1 score points
leave-one-spec-out R2 0.216, MAE 52.6 score points
```

The same model shape was best at each individual budget, but still weak:

```text
125k: LOO R2 0.220, MAE 53.7
250k: LOO R2 0.213, MAE 53.3
375k: LOO R2 0.213, MAE 52.7
500k: LOO R2 0.217, MAE 51.9
```

This is the important separator. A spec can be expensive to traverse but easy to
score (`drums_zigzag`, `drums_crosscut`), or relatively cheap to traverse but
hard to score (`skyline_push`, `syncopated_switchback`, `dense_echo_climb`).
`drums_pendulum` is both expensive and very hard, but it is not representative
of all 55-contact drum rows.

## Implication

Do not collapse difficulty to one scalar yet. A sane budget-aware policy should
probably carry at least two smooth terms:

- `budget_slack = budget / predicted_first_completion_frames`
- `quality_hardness = predicted_score_deficit` or a learned residual/risk term

The first term is strong enough to use as a structural budget-normalizer. The
second term needs more evidence before it drives compiler behavior, because
current static features do not explain final score well. That missing information
is likely tied to axis feasibility, impact/air interaction, and geometry-family
limitations rather than just count, duration, or median spacing.

## Repair-Cost Probe

The current repair phase already has a measured per-incumbent `costToEnd`:
`firstCompletionFrame - framesAtReach[anchor]`. To compare that adaptive measure
with the static model, run:

```bash
LR_ENGINE=wasm LR_REPAIR_LOG=1 GOLDEN_SEEDS_OVERRIDE=0,1 npm run golden -- \
  --specs=drums_pendulum,solo_run,skyline_push,tiny_dance,dense_echo_climb \
  --budgets=250000 \
  --jobs=5 \
  --archive-dir=generated/studies/difficulty-repair-log-probe

node --import tsx scripts/v0/study_difficulty_model.ts \
  --golden=generated/golden-runs/attempt-true-target-objective-newgrid-a01/golden.json \
  --budget=250000 \
  --repair-log=generated/studies/difficulty-repair-log-probe/golden.json \
  --out=generated/studies/difficulty-model-baseline.json
```

On that 5-spec / 2-seed probe, completed repair restart records compared as:

```text
repair estCost:             corr 0.925, MAE 3.8k, bias +1.1k
static suffix, no intercept: corr 0.950, MAE 2.5k, bias -0.2k
static suffix, with intercept:           MAE 6.9k
```

The "no intercept" detail matters. The full-run intercept is startup/root
overhead; a suffix from an existing node should mostly use the remaining
contacts plus remaining duration. This probe does not prove the static model
should replace repair's measured cost, but it suggests a useful hybrid:
initialize suffix feasibility from the smooth static model, then blend toward
measured `costToEnd` as real reach timestamps become available.

## Production Model

The current trusted traversal model is stored in
`scripts/v0/optimizer/budget_model.ts` as `TRAVERSAL_BUDGET_MODEL_V1`.
It deliberately changes no compiler behavior yet. It exposes three policy-facing
helpers:

- `predictFirstCompletionFrames(spec)` estimates the structural cost of the
  first complete traversal from feasible contact count plus authored duration.
- `predictSuffixCompletionFrames(spec, gapIndex)` estimates the remaining cost
  from a gap boundary with no full-run intercept, matching the repair-cost probe.
- `traversalBudgetSlack(budget, spec)` normalizes a requested budget by predicted
  first-completion cost.

New budget-aware policy should prefer this normalized slack over raw budget
thresholds when the question is "how much compute do we have for this spec?"
Raw frame budgets are still appropriate for fixed engine/accounting costs, but
not as a proxy for global search maturity across specs of different length and
contact density.

## Budget Policy Map

The current compiler already spends or gates budget in several places:

- `arc_placement.ts`: global compile-budget context, contact-centered redirection
  ramps, impact template/post-turn ramps, and arc-length room smoothing.
- `optimizer/aim.ts`: mature top-k aiming and extra top-k pressure.
- `optimizer/handoff.ts` start selection: ballistic starts, support starts, and
  low-air x-delay options.
- `optimizer/handoff.ts` contract and quality search: candidate/sample counts,
  sparse-contract behavior, future preview, branch limits, reuse pressure, and
  release-vertical pressure.
- `optimizer/handoff.ts` tail/forward evaluation: forward-eval gates, mature
  average forward eval, tail-completion breadth, shallow-tail throttling, and
  low-budget contract tail completion.
- `optimizer/handoff.ts` repair: main/feasibility margins, measured `costToEnd`,
  affordability filtering, restart order, and restart ceilings.

Most of those levers are already smooth functions, but many are smooth over
absolute budgets such as 50k, 100k, or 150k frames. That can overfit a particular
golden grid: 150k means something different for a short 12-contact spec than for
a long dense drum spec. The intended next step is not a wholesale rewrite; it is
to migrate one policy at a time from `targetBudget` to a small budget context
that contains at least:

```text
budget_slack = requested_budget / predicted_first_completion_frames
suffix_slack = remaining_budget / predicted_suffix_completion_frames
```

That keeps behavior continuous for 50k, 500k, 1M, or 2M budgets and lets us test
whether extra compute should buy more full-run depth, more repair breadth, or
more expensive local candidate generation.

## Spend-Control Study

The first spend-control characterization is `scripts/v0/study_budget_spend.ts`.
It does not change production policy. It explicitly sweeps one candidate-breadth
knob inside one budget, scores each compile, and records actual compute counters
plus the slack telemetry. The default mode studies quality-phase breadth:

```bash
LR_ENGINE=wasm node --import tsx scripts/v0/study_budget_spend.ts \
  --budget=200000 \
  --specs=tiny_dance,cold_start,dense_echo_climb,skyline_push,drums_pendulum,solo_run \
  --seeds=0,1 \
  --quality-ncand=24,32,40 \
  --out=generated/studies/budget-spend-qncand-200k.json
```

For larger sweeps, shard the deterministic `(spec, seed, quality_ncand)` row
order and run many workers at once. Shard indexes are zero-based:

```bash
for shard in $(seq 0 47); do
  LR_ENGINE=wasm node --import tsx scripts/v0/study_budget_spend.ts \
    --budget=500000 \
    --specs=tiny_dance,cold_start,dense_echo_climb,skyline_push,drums_pendulum,solo_run \
    --seeds=0,1,2,3 \
    --quality-ncand=16,20,24,28,32,36,40,48 \
    --shard=${shard}/48 \
    --out=generated/studies/qncand-500k-shard-${shard}.json &
done
wait
```

The shard outputs keep the same row schema. Analyze them by passing all shard
JSON files to the offline analyzer; the expensive compiler runs do not need to
be repeated while trying alternate models.

For a full q-response database, use the launcher. It keeps exactly `--workers`
child processes live, stores one JSON/log per `(budget, shard)`, and merges the
successful shard outputs into one analysis-ready panel:

```bash
LR_ENGINE=wasm node --import tsx scripts/v0/run_qcand_panel.ts \
  --workers=48 \
  --shards=48 \
  --specs=ALL \
  --seeds=0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15 \
  --budgets=150000,216667,283333,350000,416667,483333,550000,616667,683333,750000 \
  --quality-ncand=16,20,24,28,32,36,40,48 \
  --out-dir=generated/studies/qncand-large-panel-150k-750k-s0-15
```

The merged panel is written to `panel.json` under the output directory. The
manifest records task status and can be used to resume an interrupted run; by
default completed shard JSON files are skipped on rerun.

The output reports raw rows, summaries by the studied knob, summaries by knob
plus slack band, and paired deltas against the relevant baseline. It also fits a
first-pass conditional spend model:

```text
first_completion_frame
  ~= predicted_first_completion_frames
     * multiplier(quality_ncand / baseline_quality_ncand - 1)
```

`quality_ncand` is expected to affect first traversal directly because the
unified quality policy is used from the first contact expansion through repair
restarts. The same script also fits a paired candidate-sample response:

```text
candidates_sampled / baseline_candidates_sampled
  ~= f(quality_ncand / baseline_quality_ncand - 1)
```

This is the bridge from the normalized signal to actual spend control:

```text
budget_slack -> candidate-count knob -> measured sim frames / score / repair share
```

To combine several one-budget study outputs, use:

```bash
node --import tsx scripts/v0/analyze_budget_spend.ts \
  --inputs=generated/studies/qncand-125k.json,generated/studies/qncand-500k.json \
  --out=generated/studies/qncand-analysis.json
```

The analyzer pairs each `(budget, spec, seed)` against the baseline knob value and
prints response tables by budget and by slack band.

For model comparison, use:

```bash
node --import tsx scripts/v0/analyze_qcand_models.ts \
  --dir=generated/studies/qncand-large-panel-150k-750k-s0-15 \
  --out=generated/studies/qncand-large-panel-150k-750k-s0-15/model-analysis.json
```

This reads completed study shard JSONs, skips non-study JSON artifacts, and ranks
simple first-completion models under in-sample, leave-one-spec-out,
leave-one-budget-out, and leave-one-seed-out metrics. It also prints paired
score, first-completion, and candidate-sample responses by `quality_ncand`.

Treat `LR_QUALITY_NCAND=32` as the explicit baseline surface for new
spend-response studies. The point is to isolate one knob before any slack-based
controller is installed.

For the broader offline characterization pass, use:

```bash
node --import tsx scripts/v0/analyze_qcand_surface.ts \
  --dir=generated/studies/qncand-large-panel-150k-750k-s0-15 \
  --out=generated/studies/qncand-large-panel-150k-750k-s0-15/surface-analysis.json
```

This analyzer is the main mining pass for the q-response database. It keeps the
compiler runs separate from the statistics: rerun the expensive panel once, then
try alternate cost, response, and policy models offline against the stored rows.
By default it analyzes only budget waves where every `(spec, seed, q)` row is
complete, so a currently running panel cannot skew the q comparison. Use
`--include-partial` only for debugging ingestion or progress checks.

The surface analysis currently reports:

- first-completion cost models with leave-one-spec, leave-one-budget, and
  leave-one-seed holdouts;
- paired first-ratio and candidate-ratio models against `q=32`;
- score-delta and repair-delta response models;
- q-response summaries overall, by budget, by slack band, by contact-count band,
  by duration band, by median-gap band, and by min-gap band;
- per-budget and per-spec q elasticity;
- best-q preference summaries by budget, spec, slack band, contact band,
  duration band, median-gap band, min-gap band, and the strongest/weakest
  spec-budget groups;
- repair/score/candidate tradeoff correlations;
- simple offline q-selection simulations, including fixed-q baselines and
  cross-validated selectors by budget, spec, slack band, contact band, and
  duration band.

Archived panel, 2026-06-26:

```text
directory: generated/studies/qncand-large-panel-150k-750k-s0-15
command:   LR_ENGINE=wasm run_qcand_panel, 48 workers, 48 shards
inputs:    all 40 golden specs, seeds 0..15, q=16,20,24,28,32,36,40,48
budgets:   planned 150k..750k, analyzed complete waves 150k..550k
rows:      35,840 analyzed, 31,360 paired q-vs-q32 comparisons
analysis:  generated/studies/qncand-large-panel-150k-750k-s0-15/surface-analysis.json
```

The launcher was deliberately stopped once the 550k wave had completed. Higher
budget waves were not needed for the current q characterization and are omitted
by the balanced analyzer. If the manifest still contains `running` tasks, treat
the shard JSON files plus `surface-analysis.json` as the durable archive.

The robust finding is that q controls cost much more cleanly than it controls
score. Candidate-sample ratio is strongly predictable from q (leave-one-spec-out
R2 0.928, MAE 0.027), first-completion ratio is also predictable (R2 0.738, MAE
0.027), and full first-completion frames stay well predicted when q is folded
into the existing structural traversal model (leave-one-spec-out MAE about 3.25k
frames). A pure structural model with spacing plus `log(q)` is close behind
(leave-one-spec-out MAE about 3.40k frames), which is useful for future
controller work because it does not require a live traversal estimate. Score
delta remains effectively noise under simple models (leave-one-spec-out R2 near
zero), even though cross-seed spec-level q selection shows some offline signal.
Treat that as a research lead, not production evidence.

Observed cost does not scale as the naive `q / 32` multiplier:

| q | naive q/32 | first ratio | candidate ratio | mean score delta | mean repair delta |
|---:|---:|---:|---:|---:|---:|
| 16 | 0.50 | 0.881 | 0.767 | -3.10 | +6.6k |
| 20 | 0.625 | 0.911 | 0.835 | -2.86 | +5.4k |
| 24 | 0.75 | 0.941 | 0.896 | -2.11 | +3.9k |
| 28 | 0.875 | 0.967 | 0.951 | -0.80 | +2.5k |
| 36 | 1.125 | 1.030 | 1.049 | -0.08 | -1.5k |
| 40 | 1.25 | 1.062 | 1.092 | -0.18 | -3.4k |
| 48 | 1.50 | 1.123 | 1.169 | -0.43 | -7.1k |

At `q=48`, the raw knob is 1.5x, but the balanced panel sees about 1.12x
first-completion cost and 1.17x sampled candidates. The analyzer records this as
first/candidate "absorption"; values well below 1.0 mean the extra candidate
breadth is partly offset by choosing different branches, fewer downstream nodes,
or less repair work. Repair frames fall as q rises, but the repair reduction does
not translate into a reliable score model.

Offline best-q summaries are useful as diagnostics, not as policy:

| grouping | strongest observed preference |
|---|---|
| budget | 150k liked q48 (+2.11 score, 1.121 first ratio); 216667 liked q40 (+0.11); 283333..416667 stayed q32; 483333..550k weakly liked q36 |
| slack | slack <2 liked q48 (+4.99, 1.137 first ratio); 2..5 liked q40; 5..8 stayed q32; high slack bands weakly liked q48 |
| contacts | <12 liked q40; 12..19 liked q48; 20..31 stayed q32; 32..47 liked q36; >=48 weakly liked q40 |
| duration | <12s liked q40; 12..18s weakly liked q48; 18..24s liked q36; >=24s stayed q32 |
| median gap | 1.0..1.5s liked q48; tighter median-gap bands stayed q32 or only weakly liked q40 |
| min gap | <0.5s liked q16 by a negligible amount; 0.5..0.75s liked q48; 0.75..1.0s liked q36; 1.0..1.5s liked q48 |

The gap-band result matters for the next exploration-width study: extra breadth
is not uniformly good. Very tight minimum gaps are exactly where expensive wider
tails can become harmful, while looser gaps sometimes benefit from wider
candidate search.

For future one-budget characterization probes, 150k is enough to study first
completion for the current q baseline: in the archived 150k wave, `q=32`
completed under budget for all 640 `(spec, seed)` rows. At `q=48`, 638/640 rows
completed under 150k. Use 150k for quick probes and 200k when testing wider or
riskier proposal distributions where edge clipping would obscure the response.

## Next Study

The script includes an optional synthetic grid (`--synthetic`) that can vary
contact count and gap spacing independently. Use it to separate simulated-duration
cost from true tight-cadence quality pressure before promoting any spacing term
into compiler policy.
