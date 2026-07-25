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

Lower is better, expressed as a fraction of the `frozen_anchor` reference: **0
is exact, 1 is no better than not predicting at all.**

The reference is a fixed do-nothing predictor that holds every quantity at its
launch value. Normalizing by `current` instead — as this did until 2026-07-25 —
breaks the moment the current model is exact, because the denominator is zero
and every alternative scores `Infinity`. The denominator must belong to the
PROBLEM, not to whichever model happens to be installed.

Components the reference already gets right carry no information about a
predictor and are dropped from the mean rather than scored 1 for everyone.

The score uses intact, collision-free flight rows and equally averages
reference-normalized, equal-case-and-seed errors over:

- precontact position error, excluding rows that sampled the truth frame;
- contact velocity-vector error;
- contact speed error;
- contact velocity-angle error.

No launch read may include the target frame or a later frame.

The report shows the four components, cases, horizons, and read counts so an
unexpected tradeoff remains visible.

## Decision rule

**A predictor is chosen on accuracy PER UNIT OF TIME, and the exchange rate is a
judgement, not a formula.**

The previous rule was purely error-based — *adopt when the frozen-corpus score
is at least 1% lower than `current`* — and it is worth recording why it was
replaced rather than quietly dropped. It selected three successive predictors,
each strictly more expensive than the last, and **cost was never measured
once**. The first per-prediction timing in this project's history was taken on
2026-07-25, six days and four commits after the exact kernel had shipped and the
readiness pipeline had been rebuilt on it. A fourteen-model panel of cheap
closed-form models was built, compared on error alone, and deleted without ever
being timed.

It also became self-sealing. Once the exact kernel reached zero error, the score
divided by zero, every alternative scored `Infinity`, and the rule could only
ever answer `keep_current` — a mechanism-level lock-in discovered only when
somebody went looking for a cheaper model.

So the harness now **reports** rather than decides:

- accuracy per component, as mean ± standard deviation ACROSS THE 44 CASES, so a
  model that falls apart on particular specs is distinguishable from one that is
  uniformly mediocre;
- a fixed `frozen_anchor` reference — a do-nothing predictor holding every
  quantity at its launch value — so an absolute error has a scale;
- cost in ns per prediction, measured in blocks over held real call sites,
  printed beside the accuracy and **kept out of every score and gate**.

A component a model cannot answer is skipped, not fatal. The harness exists to
run experiments; refusing to measure a model because it lacks an output is
hostile to the ones worth running.

The adoption bar for a CHEAPER predictor is **parity on the compiler benchmark,
not improvement**. A worse predictor cannot beat a perfect one; an apparent gain
is the search landing in a different basin. Judge it on `representative` and
validity, never on the headline, which the `capability` stratum dominates.

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

Consequence for this document: accuracy is not the axis with anything left on
it. What remained was **cost**, and that is now settled too — see below.

## Settled: the kernel was not cheaper, and it did not pay rent

The entire justification for this layer is that predicting a flight is cheaper
than simulating it. Measured, that claim was false for the exact kernel, and the
layer's real advantage turned out to be an accounting artefact.

**Per frame** (2026-07-24): the micro-simulation kernel costs 1.92–2.06 us,
against 1.47–1.70 us for the engine on an empty track — roughly **1.3x MORE**
expensive. Volume per compile at 250k ranged from 0.16 kernel frames per engine
frame on `frontier_dense_recovery` to 0.99 on `river_reentry`.

**Per prediction** (2026-07-25), over 202,752 real call sites:

| model | ns/call | position MAE | speed MAE | angle MAE |
|---|---:|---:|---:|---:|
| exact 22-constraint kernel | 19,806 | 0.000 | 0.0000 | 0.00 |
| **closed-form system** | **451** | 0.58 px | 0.034 px/f | 0.20 deg |
| `frozen_anchor` (do nothing) | 233 | 173.65 px | 0.732 px/f | 14.29 deg |

**The unbilled shadow simulation was the real distortion.** Kernel frames charge
nothing to the frame budget, so 31.5% of every frame the compiler simulated was
free — up to 0.92 unbilled per billed on air-heavy specs. That sat directly on
the budget axis, which is the axis the suite varies to test whether the compiler
scales, so it was quietly flattering one class of spec. Under the closed form it
is **zero**.

**Adopted 2026-07-25 at statistical parity** (24 seeds, each predictor paired
with readiness retrained on its own corpus): headline 494.91 -> 494.63, delta
-0.28, SE 2.50, 95% [-7.00, +6.44]; no stratum significantly different; validity
flat. `LR_BALLISTIC_CLOSED_FORM=0` restores the kernel.

### Why the closed form can be this cheap

In free flight every constraint moves its two points by equal and opposite
amounts, there are no per-point masses, and the joint passes only read
positions. The SUM of the ten point positions is therefore invariant under the
whole solve, so the ten-point system centre follows exact Verlet projectile
motion — measured residual **1.1e-13 px per frame**. What the 135 constraint
solves per frame actually buy is the difference between that system centre and
the six-point RIDER mean, which is coupled to the sled through the binds and
drifts 0.017–0.045 px per frame.

So the rider is carried on the offset it held at launch, and sled pose advances
at a rate taken from the system's conserved angular momentum rather than a
two-point finite difference — which alone took pose error from 12.76 to 4.64
degrees.

Its one irreducible blind spot is articulation, where it scores 0.0463 against
the do-nothing model's 0.0453, i.e. no signal at all. That was resolved by
asking whether readiness needs it: dropping all 8 `articulation:*` features
costs at most 0.75% OOF and makes two components better, so the model no longer
asks for it.

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
| 2026-07-25 | closed-form system propagation, O(1), no stepping | 0.58 px / 0.034 px-f / 0.20 deg at **451 ns vs 19,806** | **adopt as default**; compiler parity at 24 seeds, and the unbilled shadow simulation goes to zero |

Note the shape of that last row: it is the first entry in this table whose
decision was not made on the error column. Every earlier adoption was, and the
cost column did not exist to be weighed.
