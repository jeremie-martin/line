# Benchmark V2 Context and Contract

Status: authoritative contract for the canonical compiler benchmark. Benchmark V1 and
earlier V2 prototypes are historical evidence and are not score-comparable with this
suite.

## Product question

The compiler produces long Line Rider tracks synchronized to music. Benchmark V2 asks:

> Given finite compiler compute, how reliably and accurately can the compiler realize
> representative production intent, important desired capabilities, and valuable
> regression behavior across nearby, deliberately varied authored scores?

The natural unit is an approximately one-minute musical score with a coherent contact
timeline and interacting target programs. V2 is not V1 with extra cases, and it is not a
collection of isolated axis probes.

## Catalog

The development headline contains 44 specifications: 21 normative scores and 23
deliberate, materialized variants. Every normative parent has one variant except the
low-air endurance frontier, whose 4s, 6s, and 7s duration variants surround the
normative 5s case. All cases are TypeScript modules under `benchmark/v2/cases/`;
`benchmark/v2/catalog.ts` is the membership source of truth.

The low-air endurance score itself contains 2s and 3s stages before its terminal
frontier. Together, the parent and its variants therefore exercise a continuous 2s-7s
duration ladder without assigning each duration an independent parent weight.

| Stratum | Weight | Parents | Materialized cases | Purpose |
|---|---:|---:|---:|---|
| representative | 70% | 14 | 28 | production-distribution performance |
| capability | 15% | 3 | 8 | explicit desired frontiers |
| legacy regression | 10% | 2 | 4 | useful V1 mechanisms, manually recomposed |
| development music | 5% | 2 | 4 | two Believer interpretations and nearby axis variants |

Variants are authored transformations, not runtime randomness. Each records its parent,
kind, parameters, and rationale. Examples include bounded tempo changes, phrase
microtiming, impact contrast, target offsets, 240ms dense figures, shifted pickup
thresholds, and four-, six-, and seven-second low-air boundaries around the normative
five-second case.
Static audit prevents variants from crossing cohort rules or becoming unacknowledged
copies of unrelated scores.

Every case has named phase metadata. Phases are diagnostic units for locating terminal
failure and target difficulty; the complete score remains the scoring unit.

## Qualification

Five production references form a linked qualification monitor:

- `productions/amor_na_praia_46s/spec.ts`;
- `productions/luna_bala_44s/spec.ts`;
- `productions/tiki_tiki_48s/spec.ts`;
- `scripts/v0/specs/shelter_impact_sync.ts`;
- `scripts/v0/specs/amour_de_ma_vie_short.ts`.

A favorable eval confirmation first seals the complete development archive,
then runs qualification and links it to that archive by SHA-256. Qualification
is displayed and trended but never enters the headline or accepts a compiler
candidate. Because these five results are shown at accepted milestones, they
are monitors rather than untouched statistical holdouts;
case-specific tuning against them is prohibited. New production works preserve genuinely
unseen evidence only when frozen before their first compile.

## Authoring contract

The primary product surface is contact synchronization and survival, speed, airborne
time versus sustained riding, and per-contact impact. Amplitude is secondary but real.
Elevation and grain do not shape this canonical distribution.

Axis absence has one meaning end to end:

- undefined target: the compiler is free and the evaluator assigns no weight;
- defined target with a measurement: score it;
- defined target without its expected measurement: invalidate the run;
- declared diagnostic target: measure it without headline weight.

Authored impact is always the optimizer and evaluator target. `feasibility_bound` is a
diagnostic estimate of the physically reachable impact at a contact. It may explain why
a request is difficult, but it never caps, normalizes, replaces, or otherwise changes the
authored target or score.

## Distribution and frontiers

Representative parents cover locally regular rhythm with musical exceptions,
subdivisions and pickups, played microtiming, cadence transitions, spacious amplitude,
sustained compact density, high-air energy, and sparse supported transitions. Isolated
250-300ms pickups may be representative when they resolve into ordinary pulse.

Capability parents intentionally remain hard and contribute a fixed 15%:

1. progressive 300ms, 250ms, 200ms, and 180ms pickups;
2. two- and three-contact dense figures, a bounded dense stream, and recovery;
3. two-, three-, and five-second low-air rideouts with ordinary surrounding cadence.

Sub-250ms pickups, short dense streams, and multi-second supported rideouts belong here
until compiler improvements make them ordinary production behavior.

## Validity and quality

A run is valid only if it reaches end-of-spec, reports and hits every authored contact
within the one-frame contract, creates no off-beat landing, and supplies every expected
axis measurement. Invalid runs score zero.

A normal authored interval is hit by a detector landing. When the interval is no longer
than the detector's minimum landing run, a persistent bounce may represent the authored
ground contact because a distinct landing cannot physically occur between those beats.
This exception is interval-derived; bounces remain excluded from ordinary contacts and
from off-beat landing accounting.

For valid runs:

`1000 * exp(-weighted_axis_rms / 0.25)`

Active axes use air 30%, speed 30%, impact 30%, and amplitude 10%. Undefined axes are
removed and the remaining weights are renormalized.

Aggregation is explicit and hierarchical:

1. shifted geometric mean over seeds within a specification;
2. shifted geometric mean over a normative parent and its variants;
3. shifted geometric mean over equally weighted parents in a coverage group;
4. fixed weighted arithmetic mean over groups within a stratum;
5. fixed 70/15/10/5 weighted arithmetic mean over strata;
6. 20/50/30 weighted arithmetic mean over 250k/500k/750k budgets.

Parent aggregation is explicit, so adding more variants to one parent cannot silently
increase that behavior's influence. Duration and contact count do not directly multiply
weight. The V2 score scale is independent of V1 and its historical headline.

## Compute profiles

Stage 0 and confirmation use the same 44 development cases. Actual seeds are
disjoint across budgets, and every confirmation declaration allocates a fresh
canonical epoch that does not reuse stage-0 development seeds or a prior attempt.

| Profile | Budgets | Seeds per budget | Development compiles |
|---|---|---:|---:|
| probe | 250k / 500k | 3 | 264 |
| canonical (per compiler side) | 250k / 500k / 750k | 8 | 1,056 |

A certified promotion attempt runs both the checksummed baseline compiler
snapshot and the declared candidate on one fresh canonical schedule at its
declared depth. Qualification is candidate-only and runs after an accept.
Canonical seed epochs are allocated after declaration and never reused.

The allocation was frozen from a 1,512-run study using 12 reference seeds at every
budget. One-seed probes had 20.87 points of p95 headline error; three-seed probes reduced
that to 7.38. Eight canonical seeds per budget provide a more stable promotion surface;
the separate zero-inflated coverage study drove the conservative critical values used by
the gate. The 750k ceiling bounds per-compile compute. Public execution defaults to
48 workers on the 64-logical-CPU reference host and reports resource use while running.
The seed-count study estimates allocation behavior; actual seed labels are deterministic
IID inputs and the profile ranges are separated for confirmation.

## Identity and evidence

The suite fingerprint covers generated policy and inventory, every case and dependency,
the typed case contract, materialized variant catalog, target resolution and keyframe
interpolation, measurement, scoring, weights, budgets, transform, and seed policy.
The scoring boundary explicitly includes the shared shifted-geometric-mean helper in
`scripts/v0/score.ts`; changing headline aggregation therefore changes the suite identity.

Each archive also records an execution-policy fingerprint covering suite identity,
explicit execution protocol, engine, compiler entry point, profile, exact sources,
budgets, resolved seeds, and transform. Exact runner bytes are recorded separately as an
implementation fingerprint. Mismatched runner bytes require an explicit reviewed
bit-identity approval. Comparisons require matching semantic policies and exact
`source/budget/seed-slot/actual-seed` scope. Compiler source and non-engine `LR_*`
environment form the candidate identity and may differ by design.

A canonical V9 baseline separately freezes the inference, protocol, and
validated-calibration fingerprints. Suite identity alone is not authority to reuse
a promotion slot after thresholds, critical levels, inference, or calibration change.

Before compilation, deterministic preparation regenerates compatibility manifests,
characterization, static audit, and candidate review from the typed catalog, and validates
the tracked listening review against the current musical source manifest and click hashes.
Canonical baseline and promotion
remain blocked until every judgment and the reviewer attestation are complete. The runner
then validates their hashes, current source identities, audit-rule identity, raw-report
rescoring, and a recomputed audit. Behavior-defining interpolation code is included in
suite identity.

## Governance

1. Author or revise cases without compiler or qualification outcomes.
2. Materialize variants and regenerate static evidence.
3. Complete and sign the tracked structural and listening review without compiler outcomes.
4. Freeze catalog, weights, evaluator, profiles, and fingerprints.
5. Establish a checksummed initial or suite-rollover baseline.
6. Improve the compiler using development results only.
7. Screen with reusable stage-0 evidence, then declare a certified eval
   confirmation using `docs/benchmark-v2-decisions.md`.
8. Run qualification only as the linked sidecar of an accepted confirmation.

Any change to cases, membership, parent structure, weights, scoring, target
interpretation, budgets, or seed policy creates a new suite fingerprint and requires a
new suite-rollover baseline. Decision-policy, inference, or calibration changes require
the approved migration command and fresh evidence at the scope named by its guard; the
baseline contract is re-stamped only by that recoverable publication path.
