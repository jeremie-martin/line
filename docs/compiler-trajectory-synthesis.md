# Trajectory Synthesis Direction

## Purpose

The compiler needs to generate terrain that works across dense contacts,
ordinary musical phrases, very short pickups, and low-air rideouts of varying
duration. The goal is not to add a 5-second exception or another pressure
term to the legacy sampler. It is to establish a reusable physical interface
that scales continuously with state, speed, authored axes, and elapsed time.

This document records the current design direction and its evidence. It is not
a production-change proposal. All code below `scripts/v0/trajectory/` remains
study-only unless a separately reviewed compiler integration crosses the normal
Benchmark V2 decision workflow.

## Diagnosis

The existing normal sampler in `scripts/v0/arc_placement.ts` combines contact
jitter, speed and impact pressure, support length, launch pressure, templates,
and attempt-index lanes. It uses the current scored gap's target bag while
forming terrain that physically governs the next interval, with only selected
next-gap facts entering later heuristics. That ownership mismatch cannot be
repaired by another threshold: the post-contact state is determined by an
exact, multi-point collision that the pre-contact sampler cannot reliably
predict.

The engine and evaluator are useful contracts and remain authoritative:

```text
immutable prefix engine
  -> proposed terrain
  -> exact engine simulation + detector gates
  -> measured GapFit / release state
  -> existing pool ranking and prefix search
  -> scorer-faithful final report
```

`tryCandidateLines` remains the only admission authority. A new generator may
order proposals, but may not synthesize scores, skip gates, or convert a local
study result into a source default.

## Design Invariants

1. **Separate geometry and score frames.** Terrain placement uses a named sled
   point and its predicted velocity. Impact response uses the CoM velocity,
   because that is what the scorer measures. The two must never be silently
   substituted for one another.
2. **Separate contact from outgoing ownership.** A contact event belongs to
   `T_i`; terrain after it physically owns `[T_i, T_(i+1)]`. The latter must
   receive an explicit outgoing interval and its literal authored axes. The
   impact at `T_(i+1)` is a separate arrival event, never an outgoing-axis
   residual.
3. **Use continuous physical controls.** Event phase, incidence, reach,
   curvature, and support extent are expressed in reference-speed frames or
   physical angles. No case ID, seed, duration bucket, or target-gap branch is
   part of the formulation.
4. **Use exact local observation.** Collision response is nonlinear and
   multi-point. A short immutable-engine fork measures it; it is not replaced
   by an analytic prediction.
5. **Leave undefined axes undefined.** A missing air, speed, amplitude, or
   elevation axis creates no hidden residual or `0.5` target. Feasibility
   priors are labelled separately from authored requirements.
6. **Resolve geometry by error, not elapsed-time classes.** Long straight
   support needs one segment; curved support is subdivided by chord/turn error.
   A 0.2-second and a 7-second interval differ by scale, not topology.
7. **Make chirality explicit.** The authored impact scale is a magnitude. A
   capture proposal must name its turn orientation rather than hard-code a
   global bend direction.

## Current Architecture Hypothesis

The serious replacement direction is a staged exact generator:

```text
incoming physical state + incoming scored interval + current event
  -> bounded capture geometry at T_i
  -> exact replay through persistence and impact-response horizons
  -> observed post-contact state + literal outgoing interval + next event
  -> outgoing support/release proposal over [T_i, T_(i+1)]
  -> one final exact candidate replay through the next event
```

### C1 Capture Boundary + Polyline Response

`trajectory/contact_capture_arc.ts` implements a calibration-only primitive:

```text
finite approach -> predicted capture boundary -> short C1 runway
                -> adaptive polyline response approximation
```

Only the approach/capture/runway boundary is C1; later bounded-angle polyline
joins approximate the requested response curve. The capture boundary can move
by a continuous fraction of the predicted sled point's one-frame displacement.
Initial incidence spends a continuous share of the **catchable** authored
impact turn; the remaining turn is spread over the same six-frame horizon used
by the impact scorer. Its construction has no gap duration, case, seed, or
outgoing-support input.

The initial 12-row capture screen used one negative response orientation. That
is historical containment evidence, not a universal sign law. The study model
now requires an explicit `-1 | +1` orientation and exposes a fixed mirrored
screen; neither screen is a source menu.

This is not yet universal. It deliberately rejects an authored `impact: 0`:
zero impact is valid, but there is no independently justified neutral-incidence
law yet. A future no-impact study must define and validate one explicitly rather
than pretending that zero requested redirection implies a physically catchable
zero-incidence surface.

### Measured Outgoing Envelope

The next stage must start from the exact state after the capture band, not the
incoming speed or target-frame prediction. Its outgoing contract names elapsed
frames, inclusive scorer samples, literal non-event axes, and a separate next
arrival event. Air informs supported versus release-and-arrival occupancy only
when authored; speed is an interval average, not an exit-speed command. The
existing envelope modules remain historical study scaffolding: their neutral
support begins from pre-impact state and is not evidence for a measured-state
support law.

### Competing Continuation Forms

The capture boundary alone does not decide how to continue terrain. The active
design choices below are deliberately ordered by what exact evidence can
falsify, rather than by how easily they can be added to the legacy sampler.

| Form | New physical claim | Next falsifier | Status |
| --- | --- | --- | --- |
| State-shot support | An exact response state can seed outgoing geometry without retroactive intrusion. | Support changes the prefix, or cannot improve a paired outgoing measurement. | Established only as structural feasibility. |
| Local support-response assay | A declared state-relative form has a usable, directional exact response. | No structurally valid action or no supported interior response. | The tested one-shot grade form is not a supported energy actuator. |
| Two-chunk continuation control | A finite carrier can be separated from a representation-only topology contrast. | Carrier, topology, and line-label controls disagree on a material endpoint. | V1--V3 inference retracted; V4 finds a finite-carrier effect but no material topology effect in this matrix. |
| Receding exact rollout | Repeated bounded state observations can reduce remaining error without duration branches. | A local action cannot change the required state while staying in its physical mode and under a resolution invariant. | Do not implement from the current grade/polyline form. |
| Ballistic-offset contact rail | A declared collidable-side preload can retain contact while a state-relative curvature field changes rail dynamics. | Preload ordering does not retain contact, intrudes on capture, or offers no measurable interior response. | Next bounded physical study. |
| Hybrid support/release graph | Supported rail and release are distinct physical modes, with continuous phase timing. | No fixed mode family covers fresh dense/ordinary/low-air states. | Plausible successor if support normal-force study confirms it. |
| Contact-to-contact multiple shooting | Capture, release, and arrival can be solved jointly from exact checkpoints. | No stable local basin at equal physics-frame cost. | Reserve for a component form that works locally but fails the next event. |

The current realizer's global `abs(tangent) <= 85` guard is a temporary study
envelope, not a physical constraint. A general form must express support
tangents relative to travel and gravity, then let exact replay reject invalid
geometry. It must also treat adaptive subdivision as a scored-output decision:
the `grain` axis measures median line length.

## Evidence So Far

### Representation containment

Historic dense witnesses can be expressed losslessly in an explicit incoming
target frame. This proves that a target-frame language can contain known valid
geometry; it does **not** prove that copied witness controls, endpoint turns,
or legacy anchor semantics should be used in production. In particular, the
old phase-relative diagnostic anchor mixed a future fallback position with an
earlier velocity on some rows and is not a valid future coordinate system.

### Earlier formulations

The one-line target-boundary and two-stage collision-strip studies were useful
falsifications. They did not establish a broad local basin, and a mean-speed
support initialization was physically unsound because it substituted incoming
speed for post-impact state. Their generated records remain audit evidence;
they are not active source options.

### Capture-band calibration screen (archival v3 endpoint)

On 2026-07-14, the fixed one-sided 12-row C1-boundary/polyline menu was run over
eight frozen 500k WASM calibration fixtures. It crosses four impact-turn
allocations with three predicted sled-point phases (`T`, `T+0.5`, `T+1`). Each
row reports preclear, survival, on-time owned contact, off-beat events,
selected event state, capture-boundary distance, fired sled points, and a
separate downstream evaluator observation.

| Conditional row | C1 local closures | Raw-normal local closures |
| --- | ---: | ---: |
| dense capability state* | 11 / 12 | 4 / 12 |
| dense 240ms capability state* | 8 / 12 | 0 / 12 |
| ordinary representative state | 9 / 12 | 11 / 12 |
| low-air 3s | 11 / 12 | 12 / 12 |
| low-air 4s | 11 / 12 | 11 / 12 |
| low-air 5s | 7 / 12 | 5 / 12 |
| low-air 6s | 8 / 12 | 5 / 12 |
| low-air 7s | 8 / 12 | 6 / 12 |

`*` These frozen prefixes came from full-spec-invalid compiler runs. They are
valuable capability/failure-state evidence, but are not representative evidence
and must not be pooled with the contract-passing rows.

These counts are archival only. The original endpoint did not require a fully
readable scorer response window or report the production impact residual. The
local study is now schema v4; historical v1--v3 output cannot be pooled with
v4 or used to choose a capture control. Its downstream neutral stitch was also
pre-impact/prediction-based, so its admission result is not evidence for a
measured-state support law. Raw normal remains an operational comparator only:
it proposes a complete legacy fragment, whereas direct form owns a bounded
phase, so its count is not a topology treatment effect or a confidence interval.

The pattern is worth re-running under v4, not installing. The 3--7-second
ladder is one correlated family, not five independent observations. Generated
historical evidence is under:
`generated/studies/local-contact-closure/b500k-v2-calibration/capture-arc/`.

### Ownership and extent audits

The literal-target transition audit covers 21 normative sources and 1,896
interior contact-to-contact transitions after the frozen jolt. Incoming versus
outgoing values differ by more than 0.05 on 26 air, 9 speed, and 103 amplitude
transitions. The ownership split is therefore a real interface requirement,
especially for amplitude, but it does not by itself explain the five-second
rideout: that row's air and speed targets are nearly continuous at its boundary.

The support-geometry diagnostic also falsifies a simplistic hard-length
explanation. The existing `shape-time-deficit` path produced 1,754, 2,214,
2,907, and 3,651px support plans on its 4--7 second rows, including admitted
multi-thousand-pixel lines, while final air errors remained inconsistent. This
is diagnostic evidence, not a causal proof, but it rules out treating another
length cap as the primary fix. The remaining hypotheses concern
collision-conditioned release state, support topology/resolution, and proposal
selection.

### Exact State-Shot Support (v3 Structural Endpoint)

The first two-pass state-shot study was run on the eight frozen calibration
fixtures under WASM/500k. It uses the fixed mirrored 24-row capture screen,
then starts one neutral support path at the exact state
`H = observed event + IMPACT_WINDOW + 1`. The output has explicit literal
ownership, a scrubbed outgoing measurement bag (no next-event impact), raw-state prefix
fingerprints, pre-`H` support-collision telemetry, and paired capture-only
effects. A runner exception writes forensic output but exits nonzero, so it
cannot look like an ordinary negative observation.

| State | Outgoing frames | Closed captures | Ready support plans | Structurally coherent replays |
| --- | ---: | ---: | ---: | ---: |
| dense | 9 | 13 | 9 | 9 |
| dense 240ms | 12 | 9 | 0 | 0 |
| ordinary | 25 | 9 | 9 | 6 |
| low-air 3s | 120 | 13 | 13 | 11 |
| low-air 4s | 160 | 13 | 11 | 8 |
| low-air 5s | 200 | 7 | 7 | 5 |
| low-air 6s | 240 | 10 | 10 | 6 |
| low-air 7s | 280 | 10 | 10 | 8 |

This is **not** a quality pass. On the five-second state, support commonly
reduced the paired air absolute error from about `0.94` to `0.01--0.04`, while
the remaining speed error was often `0.46--0.84`. It proves that exact
state-shot support can materially change occupancy without corrupting the
capture prefix; it does not prove a viable full continuation law.

### Local Support-Response Assay: Repaired Evidence Boundary

Before considering a receding rollout, a separate exact 12-frame response
assay tested fixed state-relative support actions. The coarse menu has neutral,
`+/-16` degree mean-grade residuals, and early/late curvature variants; a
declared follow-up refines only grade at `-8/-4/0/+4/+8` with zero curvature.
Neither menu accepts raw controls, selects a member, or reads an outgoing
target or next event. The repaired schema v2 records raw-state prefix identity,
scorer-faithful capture impact telemetry, temporal support-contact/airborne
runs, per-action intention-to-treat availability, and a complete-paired
summary. A row contributes to the latter only if every declared action is
observed, structurally valid, and has a readable local state.

The corrected five-second threshold assay has seven ready captures and five
complete paired rows, all at the negative capture orientation:

| Grade residual | Valid / 7 | Local air | Local mean speed | Support-contact duty |
| --- | ---: | ---: | ---: | ---: |
| -8 deg | 6 | 0.015 | 0.722 | 0.954 |
| -4 deg | 6 | 0.015 | 0.732 | 0.954 |
| 0 deg | 5 | 0.015 | 0.744 | 0.954 |
| +4 deg | 6 | 0.662 | 0.746 | 0.308 |
| +8 deg | 6 | 0.800 | 0.747 | 0.169 |

This is a sharp exact-engine support/release transition with little mean-speed
movement, not an independent speed actuator. It disqualifies the tested finite
one-shot grade form as the basis for a grade root or immediate rollout; it does
not prove that every conceivable multi-chunk grade controller fails. The fixed
12-frame action horizon is unavailable on both dense calibration states after
the response window, so it supplies no dense continuation evidence. The 3--7s
ladder is correlated and the closed captures are strongly one-chiral.

The response realizer also required repair before interpreting the rerun. When
it anchored the first segment to the measured entry tangent, its former segment
count could violate its own maximum adjacent-turn bound. The new realization
adds the necessary initial angular sample; historical response output is not
pooled with the rerun.

### Two-Chunk Continuation Control: V1--V3 Inference Retracted

The earlier two-chunk result claimed that segmentation was physical because a
merged-versus-split raw rider hash differed. That conclusion is retracted.
V1--V2 lacked the full-engine prefix guard; V3 strengthened that safety check,
but still lacked the line-label/order controls and inferred a material endpoint
from a raw hash. None of those records establishes a material causal endpoint.
V1--V3 continuation output remains historical audit material only; it cannot
be pooled with, or used to support, a continuation or compiler decision.

The repaired V4 control is a five-arm matrix from one exact response state:
`firstOnlyA`, `mergedA`, `mergedB`, `splitAB`, and `splitBA`. `A` and `B` are
the two available line IDs. The primary carrier contrast preserves every
first-chunk line byte-for-byte and adds the carrier (`firstOnlyA` versus
`splitAB`). The two topology contrasts hold the collinear geometric union fixed
(`mergedA` versus `splitAB`, and `mergedB` versus `splitBA`); the two label
controls exchange only `A` and `B`. All arms prove full non-scarf engine-state
identity over the physical prefix, capture-only identity through `H-1`, zero
all-body proposed-support collision before `H`, the selected capture event, and
strict survival through `H+17`.

The current source-addressed WASM/500k calibration panel has 258 complete
matrix rows across the ordinary and 3--7-second frontier fixtures; the two
dense fixtures have no available continuation horizon. The finite-carrier
contrast is materially nonzero in 153 rows: its largest observed local air
fraction change is `0.333`, so a finite support tip is a real property of this
particular action. That is a carrier-presence observation, not a rollout law.

The topology result is different. Both label controls are bit-identical in all
258 rows. The topology contrasts have raw kinematic hash differences in
147/258 rows, but the largest difference is only `2.9841e-11px` in position,
`5e-12px/frame` in velocity, and `2.004e-12px/frame` in speed; there are zero
airborne-sample mismatches and no material window delta. The fixed 256-ULP
diagnostic reports 141 topology rows above its numerical screen, which records
floating-point sensitivity rather than a physical or score-equivalence
verdict. This study therefore finds **no evidence of a material segmentation
effect** for this collinear matrix. It also does not prove that every terrain
representation is interchangeable.

The next formulation must earn its own evidence. A ballistic-offset rail may
be a useful bounded physical hypothesis, but the continuation control neither
requires it nor validates it. Any such study must explicitly name collidable
side, preload margin, curvature, chord error, and grain footprint, use a fixed
target-blind stencil, and retain all rows. Exact replay remains the authority;
no study result is an analytic collision solver or a compiler candidate.

## Study Protocol

The declared calibration protocol is `LR_ENGINE=wasm` with a 500,000 search
budget. Fixture capture and calibration replay now fail closed if either value
differs. Fixtures serialize start state, start lines, ordered prefix fit
groups, source and transform fingerprints, materialized inputs, target
checkpoints, environment, and capture identity. Replay verifies the physical
prefix and target state before evaluating a formulation.

Existing V2 fixtures remain readable immutable archival inputs; they are not
retrofitted with provenance they did not record. New capture writes schema V3.
Before `compileHandoff`, V3 binds the selected panel source, the static capture
source-import closure, compiler candidate, engine, LR environment, budget,
transform, and selection protocol. It samples the panel source, closure, and
candidate again before publication; `stable` is derived from equality of all
three pairs. A drifted V3 record is written only to an identity-drift forensic
path and cannot be replayed as a study input. Normal paths include the start
identity, explicit occupied paths fail before compilation, and publication is
atomic no-clobber: readers see either no artifact or a complete artifact. The
in-process import caveat remains: literal byte-snapshot evidence requires an
external immutable workspace. For `--case=all`, the session additionally
freezes its closure, candidate, and every declared panel source at startup and
rechecks them before each compile; a between-panel mutation aborts before it
can create a mixed-era batch.

A local-contact study is calibration-only and has these meanings:

- **Primary endpoint (v4):** no pre-target collision, on-time owned contact on
  the bounded local primitive, bounded survival, complete persistence and
  scorer-response windows, and no off-beat landing before the next authored
  contact. Where impact is authored, the exact production
  `redirArcPxAtLanding -> normImpact` target/residual is recorded.
- **Persistence endpoint:** state at the detector's persistence horizon.
- **Response endpoint:** state at the independent six-frame impact horizon.
- **Full admission:** a downstream observation after local closure, not a
  local-closure score or ownership reattribution.

Calibration can reject a representation or motivate a new predeclared test. It
cannot choose a control, set a source default, promote a family member, or
claim generalization.

The older V2 `validation` reserve rows are **quarantined**. Preliminary V3
rows are also not an active validation cohort: they reused calibration sources
or the correlated low-air source family. They may be read as audit history but
cannot be captured or replayed as predictive validation. A future V3 cohort
must be declared before its first capture and use fresh source situations,
including independent dense, ordinary, low-air, undefined-axis, and
zero-impact conditions. Production references remain held out.

## Next Falsifiable Steps

1. Run a bounded ballistic-offset contact-retention study. It must use the
   exact response boundary; name collidable side/orientation, preload margin,
   curvature, chord-error bound, and grain footprint explicitly; and compare a
   fixed physical stencil without duration branches or target-derived selection.
2. If that rail has a coherent local response, test its fixed-resolution
   continuation boundary before proposing any receding rollout. If merged and
   split constructions remain materially different, treat their geometry grain
   as a control/invariant rather than assuming a transparent chunk join.
3. Freeze a clean V3 held-out cohort before testing any chosen fixed menu. It
   must include fresh dense, ordinary, low-air, undefined-axis, and zero-impact
   states; qualification/production references stay held out.
4. If dense continuation remains weak, run a small charged two-contact
   multiple-shooting study. It must charge exact evaluation and compare against
   raw normal at equal physics-frame cost.
5. Run a distinct zero-impact contact study before claiming a general event
   primitive. It must establish a neutral collision-incidence rule from fresh
   evidence rather than reuse the positive-impact turn scale.
6. Only after a staged formulation survives held-out replay without a material
   dense/ordinary regression should a small labelled shadow candidate source be
   proposed for compiler integration and judged through Benchmark V2.
