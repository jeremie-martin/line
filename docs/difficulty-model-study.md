# Difficulty Model Study

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

- **Traversal cost:** how many simulated frames it takes to reach the first
  complete track before repair (`repair.first_completion_frame`).
- **Quality hardness:** what full-run score the compiler reaches after spending
  the whole budget.

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

## Next Study

The script includes an optional synthetic grid (`--synthetic`) that can vary
contact count and gap spacing independently. Use it to separate simulated-duration
cost from true tight-cadence quality pressure before promoting any spacing term
into compiler policy.
