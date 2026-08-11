# Benchmark V2 multi-budget profile

## Context

The active Benchmark V2 campaign answers one important question at one operating
point: whether a compiler improves the 44-source development headline at a hard
budget of 750,000 frames. That remains the canonical promotion surface.

The Shelter WASM sweep exposed a different product question. It ran one
specification and one optimizer seed at 116 hard budgets from 100,000 through
11.6 million frames. The dense curve made budget-dependent behavior visible:
candidate generation grew by orders of magnitude, score was non-monotone,
post-first-terminal work became large, repair value was sparse, duplicate
terminal evaluations remained common, estimator error changed with scale, and
some gap-axis errors persisted regardless of budget.

That sweep is exact evidence for its one deterministic `(specification, seed)`
path, but it cannot establish how often the behavior occurs across optimizer
seeds or source structures. Conversely, a many-seed 750k comparison cannot
measure a budget-response curve. The two instruments answer different
questions.

## Product question

The multi-budget profile asks:

> Given the budget before compilation begins, how reliably and accurately does
> the compiler use that exact amount of compute across a broad operating range?

Each budget is a separate compilation contract. A checkpoint from a larger run
is not a substitute for a run that was initially given the smaller budget: the
compiler is allowed to use its declared horizon and to choose a different
search policy from the beginning.

The desired behavior is therefore not identical tracks or identical execution
across budgets. It is coherent performance: completion remains reliable,
quality improves overall as compute grows, regressions are bounded and visible,
and additional work is spent on search, evaluation, or repair that has measured
value.

## Scope

This is a first-class Benchmark V2 profile, not merely a plotting script and
not a replacement for the canonical 750k headline.

The frozen compact profile uses eight unmodified development parents selected
from the catalog by authored/search structure:

- `countercurrent`: regular musical exceptions and impact phrasing;
- `offgrid_conversation`: irregular microtiming;
- `rising_switch`: cadence transition;
- `amplitude_tides`: spacious amplitude and impact behavior;
- `dense_dialogue`: sustained compact density;
- `frontier_pickup_progression`: rapid-pickup capability;
- `frontier_dense_recovery`: dense-recovery capability;
- `frontier_low_air_endurance`: multi-second low-air capability.

Qualification references, including Shelter, are deliberately excluded from
iterative compiler comparison. Shelter remains a valuable dense diagnostic,
but the scale benchmark must not turn qualification monitors into tuning cases.

The initial hard-budget grid is:

`150k, 250k, 500k, 750k, 1M, 1.5M, 2.5M, 4M`.

The profile uses the same actual optimizer seeds at every budget so one seed's
complete source-by-budget curve is the repeated-measurement block. The frozen
maximum is 16 seeds, with declared comparison looks at 4, 8, and 16. Its
dedicated seed block starts at 14,016 and is not borrowed from the active
canonical campaign.

This makes the work explicit: the full reference is 1,024 compilations; the
candidate looks contain 256, 512, and 1,024 compilations. Extending 4→8 or
8→16 imports the completed checkpoint and runs only the newly added seed
curves.

## Score and statistics

Run validity and per-run scoring are exactly Benchmark V2's current rules.
The authored impact requests remain the scoring target; feasibility estimates
are diagnostic and never cap, rewrite, or replace those requests.
Within each `(source, budget)`, seed results use V2's shifted geometric mean.
The compact panel then gives equal weight to its eight structurally selected
sources. The scale headline gives equal weight to the eight declared budget
operating points. It is a separate number named `scaleHeadline`; it is never
presented as the canonical V2 headline.

Candidate and baseline cells are paired by `(source, budget, actual seed)`.
Uncertainty is computed by deleting one entire seed curve at a time and
recomputing the nonlinear scale headline. Budget points inside a seed are not
treated as independent observations.

The profile reports a reference-Student-t directional probability for the
paired scale-headline delta. Its predeclared 4/8/16 repeated looks use a
conservative symmetric Bonferroni boundary over a 2.5% directional error budget.
This deliberately does not reuse the active 750k campaign's sequential
calibration: the catalog, budget structure, aggregation, and statistical blocks
are different. A result can prefer the candidate, prefer the reference, or
remain inconclusive. It does not automatically mutate the canonical baseline.

Every comparison also reports:

- score and validity at every budget;
- source-level paired changes;
- the canonical-budget (750k) change as a visible diagnostic;
- gained and lost valid cells;
- changed track hashes;
- the complete per-look estimate, standard error, interval, and probability.

If execution continues beyond an already decisive declared look, the artifact
keeps the sequential decision fixed at its original stopping depth and adds a
`requestedDepthCharacterization` over every requested seed curve. The latter
is explicitly post-decision characterization, not another independent look.
Mechanics always state their cell count and cover the complete requested
archive.

The raw run archive retains reports, compile statistics, track hashes, and
strict `line.compile-budget-telemetry.v3` for later characterization or anomaly
analysis. Scale baseline/eval commands require summary or trace telemetry;
`off` is rejected because it would make the paired mechanics archive
uninterpretable. Those
secondary analyses must not redefine the frozen comparison score after results
are visible.

## Workflow

The workflow reuses the existing V2 compiler identity, optimized WASM engine,
compiler snapshots, resumable scale-study checkpoints, checksummed archives,
run scoring, and paired statistical helpers.

Record a checksummed scale baseline from the current compiler:

```bash
npm run benchmark -- scale baseline --seeds=16 \
  --out=generated/benchmark-v2/scale/reference.json
```

V1/V2 telemetry baselines cannot be reused for V3 mechanics comparison. Keep
them as immutable historical evidence, but regenerate both paired arms under
V3 before drawing work, repair, or candidate-efficiency conclusions.

Evaluate a candidate against an existing scale baseline:

```bash
npm run benchmark -- scale eval \
  --baseline=generated/benchmark-v2/scale/reference.json \
  --seeds=8 \
  --out=generated/benchmark-v2/scale/candidate.json \
  --artifact=generated/benchmark-v2/scale/comparison.json
```

Both commands compile an immutable snapshot of the selected compiler bytes.
Every new scale baseline also passes the source production repair mode
explicitly to that snapshot and records the exact mode and adaptive
tries-per-anchor value in both its archive and versioned manifest. A baseline
therefore keeps the policy it actually measured even if the production default
changes later. Missing repair-policy provenance is rejected rather than
inferred from today's default.

The baseline may contain the full 16-seed ladder while a candidate uses a
declared prefix. `--resume` continues the same candidate plan from its
checkpoint. Baseline and candidate archives remain useful independently of the
compact comparison artifact.

If a 4- or 8-seed comparison asks for the next declared look, extend it without
recompiling the completed seed curves:

```bash
npm run benchmark -- scale eval \
  --baseline=generated/benchmark-v2/scale/reference.json \
  --seeds=16 \
  --extend-from=generated/benchmark-v2/scale/candidate-8.json \
  --out=generated/benchmark-v2/scale/candidate-16.json
```

Extension is accepted only when the earlier archive and retained checkpoint
use the same frozen profile, exact compiler identity, and a smaller declared
seed prefix. The comparison artifact prints this continuation command when it
is needed.

The scale evaluator can also run a narrowly declared study intervention while
retaining the same snapshots, checkpoints, pairing, and statistics. The first
such use is the candidate-breadth experiment documented in
`docs/candidate-breadth-multi-budget-experiment.md`; its declared
`--breadth-policy` values are recorded in the candidate archive and comparison
artifact and never enter the production baseline arm. This includes the later
repair-only phase isolation policy described in that experiment record.

The same runner also supported the explicitly experimental
`--repair-mode=one-terminal-adaptive` arm. That arm changed only post-completion
frontier repair and recorded the intervention in the archive. It was promoted
after the retained compact and canonical evidence; the frozen reference arm
explicitly records `multi-terminal`. New production baselines explicitly
record `one-terminal-adaptive` with one try per anchor, and the evaluator can
use `--repair-mode=multi-terminal` as the reverse reference intervention. A
declared repair intervention identical to the baseline policy is rejected. Its mechanics question,
tries-per-anchor arms, and staged comparison protocol are documented in
`docs/one-terminal-adaptive-repair-experiment.md`.

## Relationship to other instruments

- The canonical 44-source 750k campaign remains the main operating-point
  headline and ordinary promotion workflow.
- This compact profile compares general budget response with useful seed
  replication.
- A dense one-source sweep remains the right microscope for locating policy
  boundaries and producing detailed telemetry.
- Focused hard-budget/policy-budget matrices remain mechanism experiments that
  separate additional execution work from changes in search policy.

The instruments complement one another. No checkpoint curve, dense sweep, or
compact scale score is silently substituted for the question another
instrument was designed to answer.
