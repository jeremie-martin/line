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
seed/spec row records a first-completion frame. The best simple model was:

```text
first_completion_frames ~= 12,997
  + 722 * contact_count
  + 32.3 * duration_frames
  - 1,447 * active_axis_mean
  - 3,968 * impact_mean
```

Validation:

```text
train R2 0.989, MAE 2,000 frames
leave-one-spec-out R2 0.984, MAE 2,325 frames
```

The robust part is not the exact coefficients, which are corpus-correlated and
not causal. The robust part is that first-completion cost is mostly a smooth
function of contact count plus simulated duration. Contact count alone already
gets leave-one-spec-out R2 0.948; duration alone gets 0.874. Median gap alone is
weak at 0.380.

The budget telemetry also shows that first completion is usually much cheaper
than the requested budget:

```text
125k: 461/480 rows recorded first completion, mean 51.3k, max 122.2k
250k: 480/480 rows recorded first completion, mean 53.0k, max 126.5k
375k: 480/480 rows recorded first completion, mean 54.0k, max 111.1k
500k: 480/480 rows recorded first completion, mean 54.4k, max 113.3k
```

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

## Next Study

The script includes an optional synthetic grid (`--synthetic`) that can vary
contact count and gap spacing independently. Use it to separate simulated-duration
cost from true tight-cadence quality pressure before promoting any spacing term
into compiler policy.
