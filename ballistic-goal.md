# Ballistic Predictor Goal

Status: **accuracy is solved and this goal is closed for accuracy work.** The
open question moved to cost — see
[Open: is the kernel actually cheaper than simulating?](#open-is-the-kernel-actually-cheaper-than-simulating).

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

The corpus freezes a representative predictor-input distribution plus
independent future truth. Recollect when V2 case membership or the collection
protocol changes, or when evidence shows that compiler behavior has materially
shifted the launch-state distribution. An unrelated compiler source fingerprint
change does not invalidate physical input/truth rows. Collection refuses to
overwrite the corpus unless `--replace-corpus` is explicitly supplied;
evaluation checks schema, fixed budget/seeds/populations, canonical case
membership, shard coverage, and shard presence. Ordinary model iterations
reuse it, perform no compilation or truth simulation, and finish in seconds.

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

## Accuracy is solved

On the corpus collected from the current compiler (2026-07-24, 202,752 real
production launches over 44 canonical V2 cases x 3 seeds):

| truth | position MAE | velocity MAE | speed MAE | angle MAE |
|---|---:|---:|---:|---:|
| precontact | 1.71e-06 px | 3.10e-07 | 1.85e-07 | 6.11e-06 deg |
| contact | 1.94e-06 px | 2.66e-07 | 1.91e-07 | 4.49e-06 deg |

Per horizon, contact truth: **exactly 0.000e+00** for every bucket at 9 frames
or more (128,727 of 202,752 rows), and for the whole `aim_probe` population.
The residual sits entirely in the 1-8 frame bucket at 5.3e-06 px.

Before the launch anchor became the confirmed geometric arc exit, the same
score was 4.53e-02 px precontact position and 1.27e-02 deg contact angle, with
0.71 px at horizons of 33+ frames. **That error was never model error.** The
old anchor sat zero to three frames into flight, so it could be captured at a
frame where a trailing point had already grazed — the state handed to
collision-free propagation was not a free-flight state. Anchoring at the
confirmed exit makes it one.

Why zero is the correct answer rather than a measurement artefact, since it
looks too good:

- the truth is a real engine read (`fork.getRider(targetFrame)`) on the Rust/
  WASM engine; the prediction is `core/ballistic_micro_sim.ts`, an independent
  TypeScript kernel. They are genuinely different code.
- the micro-simulation IS the engine's airborne kernel: Verlet point
  integration, six passes over the same 22 rider constraints, then the three
  binding joints. With no collision to resolve, an exact reimplementation must
  reproduce the engine bit for bit. Zero error means the reimplementation is
  faithful, which is the useful thing to know.
- frame alignment was audited separately: the anchor is the frame whose exact
  ten-point state is read, the target is the authored next contact, and
  `dt = targetFrame - anchorFrame`.

Consequence for this document: **no alternative predictor can clear the 1%
decision rule, because there is no error left to remove.** Stop iterating on
accuracy. Recollect the corpus after any change that moves the launch-state
distribution, and treat a non-zero score as a regression alarm rather than an
optimization target.

## Open: is the kernel actually cheaper than simulating?

The entire justification for this layer is that predicting a flight is cheaper
than simulating it. That is an empirical claim about cost, and it is **not yet
settled**.

What is measured (2026-07-24):

| | us per frame |
|---|---:|
| micro-simulation kernel | 1.92 - 2.06 |
| engine, **empty track** | 1.47 - 1.70 |

So against an empty track the kernel is roughly 1.3x **more** expensive per
frame. Volume, per compile at a 250k budget:

| case | engine frames | kernel frames | ratio |
|---|---:|---:|---:|
| frontier_dense_recovery | 250,508 | 40,806 | 0.16 |
| high_air_drive | 261,876 | 170,659 | 0.65 |
| river_reentry | 252,424 | 249,025 | **0.99** |

On some specs the compiler runs a near-complete shadow flight simulation
alongside its real one, costing up to ~9% of compile wall clock.

**Why this is not a verdict.** An empty track is the engine's best case: with no
geometry near the rider, any spatial index finds nothing and collision work is
skipped entirely. The alternative the compiler actually faces is simulating
through a dense track it has just been building. That measurement has not been
made — the first attempt crashed the WASM engine on a synthetic line batch.

**What the kernel buys regardless of wall clock**, and why the layer is not in
question:

- the compiler's budget is denominated in ENGINE frames. The kernel charges
  zero, so this lookahead is free in the currency the search is rationed by.
- it answers a counterfactual the engine cannot answer cheaply: the
  collision-free continuation *as if no further arc were placed*. Getting that
  from the engine means forking, which invalidates the frame cache.

**To settle it**, measure marginal per-frame engine cost against line count and
proximity to the flight path, with a fresh engine per flight so nothing is
served from the frame cache, then weigh it against the kernel volume now
reported per compile as `CompileStats.ballistic_micro_sim_frames`.

## Boundary

This score answers whether the direct prediction model is better on the state
distribution the compiler actually sends it. It does not answer whether the
compiler's fitted approximation or downstream use preserves that improvement.
The intended semantic boundaries and frame contract are defined in
[`docs/BALLISTIC_READINESS_CONTRACT.md`](docs/BALLISTIC_READINESS_CONTRACT.md).

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
| 2026-07-24 | launch anchor = confirmed geometric arc exit | 0.0000 (error is now float noise) | adopt; accuracy work on this goal is closed |
