# Trajectory Synthesis Experiment Log

This is a concise decision log. Detailed immutable inputs and row-level output
live under `generated/studies/`; a generated result is evidence, not compiler
source or a promotion record.

## 2026-07-14: Earlier Local Formulations

**Question.** Can a target-frame one-line boundary, then a bounded
collision-strip plus a static outgoing envelope, replace the legacy fragment?

**Result.** No. The one-line form had little local coverage, and the
collision-strip screen did not create a broad enough basin. A mean-speed
support initialization was rejected because it uses incoming state after an
impact where the actual outgoing state can differ substantially.

**Decision.** Keep the target-frame coordinate and exact evaluator. Do not add
the tested boundaries, strip controls, or support law to the compiler. Move the
physical observation boundary to the collision itself.

## 2026-07-14: Capture-Band Calibration (archival endpoint)

**Question.** Does a speed-normalized C1 capture boundary plus adaptive
polyline response provide local closure
across dense, ordinary, and 3--7-second low-air states without a duration
branch?

**Protocol.** Eight frozen physical-prefix fixtures, captured and replayed at
WASM/500k. The fixed menu has four impact-turn allocations and three continuous
predicted event phases (`T`, `T+0.5`, `T+1`), for 12 rows per fixture. It is a
calibration coverage screen; no row is selected. The equal-count raw-normal
stream is an operational comparator only.

```sh
LR_ENGINE=wasm npx tsx scripts/v0/study_local_contact_closure.ts \
  --fixture=generated/studies/trajectory-fixtures/b500k-v2-calibration/frontier5-b500000.json \
  --formulation=capture-arc \
  --out=generated/studies/local-contact-closure/b500k-v2-calibration/capture-arc/frontier5.json
```

| Row | Direct local closure | Raw normal local closure |
| --- | ---: | ---: |
| dense capability state* | 11 / 12 | 4 / 12 |
| dense 240ms capability state* | 8 / 12 | 0 / 12 |
| ordinary | 9 / 12 | 11 / 12 |
| low-air 3s | 11 / 12 | 12 / 12 |
| low-air 4s | 11 / 12 | 11 / 12 |
| low-air 5s | 7 / 12 | 5 / 12 |
| low-air 6s | 8 / 12 | 5 / 12 |
| low-air 7s | 8 / 12 | 6 / 12 |

`*` Full-spec-invalid baseline prefix; capability evidence only.

Every direct local closure passed the separate downstream evaluator with a
neutral stitch. The resulting capture events are explicitly recorded with
event state, detector ownership, fired sled point(s), capture-boundary distance,
persistence-end state, and six-frame response-end state.

**Decision.** This is archival containment evidence only. The endpoint has
since been strengthened to require complete persistence and scorer-response
windows plus production-faithful impact residuals; v1--v3 records cannot be
pooled with the new v4 endpoint. The one-sided screen is not a compiler
candidate, source menu, or validated support law. The 3--7-second rows remain
one correlated family, and the raw-normal count is not a causal comparison.

## 2026-07-14: Protocol Repair

**Finding.** The old reserve `validation` cohort was not suitable as active
confirmation, and the declared WASM/500k calibration protocol had not been
enforced everywhere. The local observation also originally exposed only the
five-frame persistence state while the impact score uses six frames.

**Repair.** V2 reserve rows are quarantined and the capture CLI rejects an
empty active validation cohort. Fixture capture and calibration replay now
fail closed on an engine or budget mismatch. Local output records separate
persistence and response endpoints. A selected event now carries its exact
state, emitted sled collision points, and distance from the named construction
boundary. Full admission is labelled as end-to-end observation rather than
post-stitch contact reattribution.

**Decision.** Preliminary V3 rows that reuse calibration or quarantined source
families are not valid held-out evidence and are retired before capture. A
clean V3 cohort must be declared before any predictive test. Zero-impact
contacts remain explicitly out of scope until a separately predeclared
neutral-incidence study exists.

## 2026-07-14: Transition Ownership and Extent Audit

**Question.** Is the long low-air failure primarily a missing line-length
capability, or does the generator lack a correct transition interface?

**Result.** The literal-target audit found 1,896 interior contact transitions;
incoming/outgoing values differ by more than 0.05 for 26 air, 9 speed, and 103
amplitude transitions. Separately, the legacy support diagnostic already
produced 1.75--3.65kpx plans for the 4--7s ladder, while final air matching
remained inconsistent. There is no evidence for a simple hard extent ceiling.

**Decision.** Freeze the three-way transition contract: incoming interval,
current event, outgoing non-event axes, and separate next event. Do not extend
`support_geometry.ts` as a supposed universal solution. The next experiment is
a two-pass exact-engine state-shot support study: capture, observe response,
then derive one support path from the observed state and replay it from the
original prefix.

## 2026-07-14: State-Shot Support Is Structurally Feasible, Not Yet a Continuation Law

**Question.** Can a post-impact exact state seed long support geometry without
using a future event, target jitter, or a legacy support plan?

**Protocol.** Fixed mirrored 24-row capture screen on all eight frozen
WASM/500k calibration fixtures. For every closed capture, measure the exact
state at `event + IMPACT_WINDOW + 1`, account for scorer samples already
consumed, add one neutral support path, and compare it with the identical
capture-only replay. The v3 record rejects unexpected row errors, records
literal ownership, raw-state prefix identity, scorer-faithful capture impact,
and paired support effects, and calls physical replay
success `structurallyCoherent`, not a quality pass.

**Result.** Neutral state-shot support produced structurally coherent replays
on ordinary and every 3--7s low-air state; the 5s case had 5/24 such rows. It
substantially improved paired low-air occupancy (for example, air absolute
error about `0.94 -> 0.01--0.04` on the 5s rows), but left large speed errors.
Dense states leave too little space for the later fixed 12-frame response assay
after collision response, which is an explicit feasibility outcome.

**Decision.** Keep the measured-state boundary and paired replay guards. Do
not call the result a compiler improvement or install the neutral support law.
Test local controllability before considering a receding rollout.

## 2026-07-14: Grade Is a Support/Release Lever, Not an Independent Speed Control

**Question.** Does a small state-relative support-grade action have a smooth,
useful local response that could justify exact feedback rollout?

**Protocol.** A separate 12-frame exact response assay uses no authored axes
after the response state. Its coarse seven-action stencil is neutral,
`+/-16` degrees, and early/late curvature variants. After seeing a
support/release boundary, a declared one-dimensional `-8/-4/0/+4/+8` follow-up
refined only that boundary. Every action retains prefix identity, capture
ownership, pre-boundary collision telemetry, survival, air, speed, heading,
and exact physics work. No action is selected.

**Result.** The first aggregate table mixed structurally invalid rows and
action-specific denominators, so it was retired. After fixing the first-tangent
resolution invariant and reporting complete-paired rows, the 5s result has
five fully paired captures: air is `0.015, 0.015, 0.015, 0.662, 0.800` at
`-8, -4, 0, +4, +8`, while mean authored speed is
`0.722, 0.732, 0.744, 0.746, 0.747`. Positive grade is a support/release
switch in this finite one-shot form, not controlled supported acceleration.

**Decision.** Do not build a grade root or rollout from this form. This is a
rejection of the tested finite one-shot grade law, not a proof about every
dynamic grade schedule. Dense remains unavailable under the fixed local horizon
and requires a separate contact-to-contact construction.

## 2026-07-14: Continuation Control, V1--V3 Retracted and V4 Re-run

**Question.** Does a finite carrier alter the local outcome, and separately,
does representing a fixed collinear union as merged or split geometry have a
material effect?

**Protocol.** V1--V2 had a detector-only prefix guard; V3 added a full-engine
prefix guard but still had no line-label/order control and inferred too much
from a raw hash. V4 uses full non-scarf engine-state prefix identity, all-body
collision telemetry, strict terminal-frame survival, and a five-arm matrix:
`firstOnlyA`, `mergedA`,
`mergedB`, `splitAB`, `splitBA`. The primary carrier contrast preserves the
first chunk byte-for-byte; topology and label contrasts are reported separately.
No verdict threshold is encoded in the study.

**Result.** The eight-fixture WASM/500k panel has 258 complete comparable rows
(dense rows have no available continuation horizon). The finite carrier changes
local occupancy in 153 rows, with air-fraction differences as large as `0.333`.
Both label controls are bit-identical in all 258 rows. Topology raw hashes differ
in 147 rows, but the largest position difference is `2.9841e-11px`, with zero
airborne mismatches and no material measured-window delta. A 256-ULP diagnostic
flags 141 rows; it is deliberately numerical telemetry, not a physical-effect
or score-equivalence test.

**Decision.** Retract the earlier claim that segmentation is physical. V4
establishes only a finite-carrier effect for this fixed local form. It does not
validate a receding rollout, rule out other representation effects, or justify
a compiler change. Any next support formulation must be predeclared and tested
on its own physical endpoint.

## 2026-07-14: Study Artifact Identity Repair

**Finding.** The coarse and threshold response menus initially defaulted to
the same result path, so a later follow-up could overwrite a prior assay even
though its source fingerprint differed.

**Repair.** State-shot support now writes schema `v5`; response assays write
schema `v4` under their declared menu; continuation controls write schema `v4`.
Each artifact binds its frozen fixture, static source-import closure, observed
compiler candidate, and predeclared protocol into an identity-addressed,
append-only path. An occupied explicit path is rejected before replay; identity
drift receives a distinct forensic path and a nonzero exit status.

New frozen-prefix capture writes schema `v3` with the same discipline: the
selected source file, transitive capture closure, and compiler candidate are
bound before `compileHandoff` and sampled again before publication. V2 fixtures
remain readable audit inputs; they are not relabelled as V3. A drifted V3 record
is forensic only and preparation rejects it before any replay.

## 2026-07-14: Exact Support-Slice V1 Rejected by Its Own Safety Guard

**Question.** Can a tangent-aligned static rail placed at the exact post-impact
reference point produce a prefix-safe local response?

**Protocol.** A fixed capture-only plus five-rail stencil used the same named
reference displacement from `H` to `H + 1` to choose the active side, with a
normal preload of `0.1 * responseSpeed`. Every arm had to preserve the full
physical prefix and capture-only state through `H`, with zero support collision
through that inclusive boundary.

**Result.** The fresh WASM/500k `frontier5` smoke fixture closed 7 of 24
capture rows. Of its 35 rail replays, 15 violated the construction guard across
three capture rows: static rail geometry collided at `H - 1` or `H`, often via
non-anchor body points. The runner wrote the complete artifact and exited 2;
its local response numbers are not interpreted.

**Decision.** Reject the point-anchored V1 placement. Do not weaken the
inclusive guard or treat the four clean rows as evidence. The next formulation
must establish a shared, target-blind collision-safe phase for all five rail
arms using only exact pre-`H` replay, then retain every rejected phase before
measuring any post-`H` response.

**Decision.** Re-ran the state-shot, both response menus, and continuation
matrix under the repaired contract. Generated artifacts remain ignored evidence,
not repository payloads. The source identity is sampled before and after replay;
literal byte-snapshot evidence still requires an external immutable workspace.
