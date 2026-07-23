# Ballistic Predictor Goal

Build the most accurate cheap prediction of rider state from an arc's airborne
exit to the authored next contact. This is separate from the compiler goal and
does not use the compiler's promotion machinery.

## Lean workflow

There are only two models:

- `current`: the implementation used by the compiler that produced the corpus;
- `alternative_*`: the one replacement currently being tested.

Between experiments there is no alternative, and the benchmark simply validates
`current` against its corpus.

There is no permanent experiment flag or model matrix. Run the alternative on
the frozen corpus:

```bash
npm run benchmark:ballistic
```

To try an idea, add one pure predictor beside `predictCurrent` in
`scripts/v0/study_ballistic_predictor_v2.ts` and return its name and function
from `configuredAlternative`. The input already contains the raw launch
samples, target frame, current fallback, and exact point/previous-point state. No
collector, scoring, or command-line code changes are needed.

If it improves the score by at least 1%, record the result below and make it the
new current implementation. Verify that every compiler call site preserves the
same inputs and semantics, then recollect once from that newly current compiler.

If it does not improve by 1%, record the result, remove the alternative, and try
the next idea.

## Frozen data

The expensive work happens once:

```bash
npm run benchmark:ballistic:collect
```

This freezes a deterministic uniform sample of the real predictor calls made
by all current V2 cases at 250k with the first three canonical seeds. It covers
both candidate-pool ranking and aiming probes, with at most 1,536 calls per
case/seed (up to 202,752 observations total). Collection runs the independent
case/seed shards in 48 isolated workers and writes compressed shards directly.
Every saved call contains the exact one-to-four pre-target reads, all ten rider
points with their Verlet previous positions, binding state, collision witnesses,
and simulated truth.

The corpus always belongs to `current`. Recollect only when `current`, the V2
case membership, or the fixed protocol changes. Collection refuses to overwrite
it unless `--replace-corpus` is explicitly supplied, and evaluation refuses a
corpus whose compiler fingerprint no longer matches `current`. Ordinary model
iterations reuse it, perform no compilation or truth simulation, and finish in
seconds.

## Score

Lower is better. `current` is normalized to `1.0`.

The score uses intact, collision-free flight rows and equally averages four
current-normalized, equal-case-and-seed errors:

- precontact position error, excluding rows that sampled the truth frame;
- contact velocity-vector error;
- contact speed error;
- contact velocity-angle error.

No launch read may include the target frame or a later frame.

The report shows the four components, cases, horizons, and read counts so an
unexpected tradeoff remains visible.

## Decision rule

Adopt a predictor change when its frozen-corpus score is at least 1% lower than
`current`:

```text
(current_score - new_score) / current_score >= 0.01
```

Otherwise remove it and keep iterating. There is no predictor ledger,
confidence procedure, staged screen, budget ladder, or separate promotion
process.

## Boundary

This score answers whether the direct prediction model is better on the state
distribution the compiler actually sends it. It does not answer whether the
compiler's fitted approximation or downstream use preserves that improvement.

After selecting a direct predictor, audit the compiler path separately:

```text
callsite state -> direct prediction -> fitted approximation
               -> readiness -> candidate rank -> forward winner
```

Only then use the normal compiler benchmark from `goal.md`.

## Experiment log

| Date | Alternative | Score vs current | Decision |
|---|---|---:|---|
| 2026-07-23 | articulated assembly/body model | 0.4116 (58.84% lower) | adopt; direct terminal outputs used for fitted compiler path |
| 2026-07-24 | collision-free ten-point constraint micro-simulation | 0.0313 (96.87% lower) | adopt; causal launch-only state, exact shared production kernel |
