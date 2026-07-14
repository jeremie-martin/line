# Arc Generation Research Plan

## Purpose

The compiler should generate support geometry that scales continuously across
dense contacts, ordinary gaps, and multi-second low-air rideouts. This is a
research plan, not a production design or a benchmark-promotion policy.

## Current Findings

- The production contact-centered sampler still couples launch, length, impact,
  speed, elevation, topology, attempt index, and deterministic rolls in one
  proposer. Its support-length coordinate is derived from attempt patterns,
  rather than from an independently declared support control.
- Existing production runs can emit multi-thousand-pixel support geometry for
  four- through seven-second cases. The current failure is therefore not merely
  an absolute length cap: collision-conditioned support and release behavior is
  poorly controlled and selected.
- `continuous_support_curve.ts` is a useful state-relative, target-blind local
  response primitive. Its fixed 12-frame extent makes it a calibration assay;
  it is not evidence for a general long-rideout generator and must not be
  promoted directly.
- The local assay records H-to-H+1 orientation evidence and a 2x realization
  diagnostic. Neither is a convergence certificate or a compiler-performance
  result. The side signal can be weak, so its coverage must be measured before
  relying on active-normal semantics.

## Intended Separation

1. Capture realization consumes the current event's impact and exact physical
   prefix only, then establishes a post-impact state at H.
2. A target-aware planner may consume observed state at H, outgoing interval
   duration, and explicitly defined outgoing axes. It must not inspect the
   later arrival event. It outputs normalized controls, not geometry.
3. A target-blind geometry realizer consumes only state-relative geometry and
   already-selected controls. It cannot import targets, score, case identity,
   attempt number, or RNG policy.
4. Exact replay evaluates outgoing occupancy and later-arrival readiness as
   separate observations.

This separation allows a numeric support-duration control to be planner output
without allowing the geometry realizer to discover why that control was chosen.

## Continuous-Curve Panel Evidence

On 2026-07-14, the fixed curve assay ran once on the eight frozen V3 boundary
fixtures: dense, dense240, ordinary, and the 3s through 7s low-air frontier
cases. Generated artifacts are audit evidence, not benchmark data.

- Seven fixtures completed with descriptive rows; the denser fixture completed
  without an eligible five-arm row. That is an availability result, not a
  favorable or unfavorable response.
- Across the panel, 89 capture rows reached a selected certified phase, 74
  reached complete measurement, and 31 completed all five nominal arms. Of
  the 20 matched-neutral contrasts available under the predeclared causal
  exposure rule, all were monotone and 19 exceeded the two-degree endpoint
  contrast threshold.
- Active-normal evidence is often weak: the per-fixture median normal-step
  projection ratio ranges roughly from 0.01 to 0.03, with a global observed
  minimum of 0.000382. The current side convention is therefore observable
  local evidence, not a general robustness claim.
- The source-declared 2x realization is materially sensitive in a tail of
  collision-conditioned arms. Across 236 nominal/2x comparisons, median
  absolute terminal-heading change was about 0.20 degrees, but the maximum
  was 4.76 degrees; air-fraction changes reached 0.40. This explicitly rules
  out interpreting the diagnostic as a convergence or stability certificate.

Decision: retain the curve only as a local calibration instrument. Do not
compose it into the compiler or use it as the carrier primitive. The next
study should reuse only the sealed capture boundary and test a simpler neutral
duration control directly.

## Long-Carrier Calibration Study

`study_long_carrier_duration_response.ts` is a calibration-only implementation
of the following protocol. It uses only the `ordinary` and `frontier3` through
`frontier7` frozen V3 fixtures, and every capture row closed by the
pre-outcome local guard.

- Capture realization first receives only the physical prefix and current
  impact. It closes a named rider reference state at
  `H = selectedOwnedEvent + impactWindow + 1` and its exact H-to-H+1 step.
  The selected owned event may be a gate-eligible bounce on a short gap; it is
  not assumed to be a landing.
- Only after that closure has returned may the long-carrier-specific reduced
  handoff release scalar `outgoingEndFrame`; its stage-two token contains only
  physical capture state, current timing, and an opaque protected-impact
  equality verifier. It deliberately excludes the current impact target, raw
  score, outgoing axes, next impact, case identity, and authored contact
  frames until all carrier phases have been constructed. The generic staged
  helper guarantees ordering and endpoint release; this reduced token is the
  mechanism that enforces score blindness. This is a duration-aware planner,
  not a fully target-blind planner.
- The fixed arm stencil is `supportFraction = [0, 0.25, 0.5, 0.75, 1]`. For
  each declared phase `p = [0, 1, 2, 3, 4]`, the `f > 0` arm emits exactly one
  solid non-extended type-0 line with `flipped: false`, starting at
  `reference(H+1) + p * (reference(H+1) - reference(H))`, directed along that
  measured step, and with
  `extentPx = observedReferenceSpeedAtH * f * availableCarrierIntervals`.
  The `f = 0` arm emits no carrier line.
- The first phase is selected only when every five-arm construction preserves
  physical-prefix and capture identity through H, has unique/disjoint ids,
  survives/readably reaches H, and has no carrier collision in `[0,H]`.
  Attributable at-H collisions are phase rejections only when the preceding
  trace is exact; unexplained divergence invalidates the row. There is no
  individual-arm fallback, outcome-selected phase, or fraction selection.
- Before measurement, the selected phase is sealed and revalidated against
  its issued certificate, exact ordered five-fraction roster, capture step,
  and the same released endpoint used to plan it. Any mismatch invalidates the
  study rather than silently measuring a subset or an old duration plan.
- Exact replay records survival, carrier collisions, carrier-contact duty,
  air/supported occupancy, raw speed, terminal CoM/named-reference state, and
  known versus unresolved-tail off-beat landings. V3's physical prefix ends
  before the next terrain, so the result is an `arrivalTimeSnapshot` at E, not
  a later-arrival contact/impact result.
- The primary per-row prediction is that increasing support fraction makes
  airborne occupancy non-increasing, allowing at most one detector sample of
  tolerance. Only five-arm-complete rows contribute; rows without a usable
  horizon are unavailable, not favorable or unfavorable evidence.

The study remains descriptive. It cannot alter the compiler or establish a
promotion threshold. Its claim is limited to a fixed duration-aware planner
and target-blind carrier realizer on the frozen fixture; it establishes neither
compiler performance, target fit, next-contact feasibility, independent
statistical evidence, nor permission to select a phase, fraction, or
implementation. A positive result on ordinary and at least one low-air fixture
would justify preregistering a fresh-cohort replication before a target-aware
support planner is composed with the realizer.

## Long-Carrier Evidence

On 2026-07-14, the implemented assay ran once per frozen fixture using
`LR_ENGINE=wasm`. Each artifact was written append-only, immediately reread,
and verified with a canonical content checksum covering its rows, status, and
summary. This detects accidental or stale edits under the trusted no-clobber
artifact filesystem; it is not a cryptographic signature against an actor who
can replace both a file and its checksum. Raw artifacts remain outside version
control.

| Fixture | Selected phases | Complete five-arm rows | Monotone rows |
| --- | ---: | ---: | ---: |
| ordinary | 9 | 9 | 9 |
| frontier3 | 15 | 15 | 15 |
| frontier4 | 14 | 14 | 14 |
| frontier5 | 7 | 7 | 7 |
| frontier6 | 10 | 10 | 10 |
| frontier7 | 10 | 10 | 10 |
| Total | 65 | 65 | 65 |

Every fixture reported `complete_with_descriptive_rows`. All protocol counters
were zero: capture invalidity, invalid construction phases, construction-report
mismatches, selected-roster violations, duration-endpoint mismatches, protected
boundary violations, and arm runtime errors. The six runs took about 185
seconds in total on the local WASM runtime.

This supports the narrower, falsifiable statement that every **eligible**
five-arm row on this frozen, correlated panel was monotone. The rows are
conditional on a selected construction-safe phase and a complete replay: for
example, the five-second fixture contributed 7 complete rows out of 24 capture
screen rows. This is not broad capture coverage, a production planner, target
fit, next-contact feasibility, or a compiler improvement. The recorded
terminal states also show that a straight carrier can exchange air time for
terminal speed, so it is not a continuation law by itself.

The next step is a preregistered fresh-cohort transfer study for this fixed
physical leaf, followed separately by a capture/support/release formulation
with an explicit release control. Neither step is direct compiler integration.

## Guardrails

- Do not equate an assay row count with independent statistical evidence.
- Do not use held-out production tracks to select geometry.
- Do not treat a 2x discretization result as a stability pass without a
  predeclared interpretation rule.
- Do not add another attempt-index or duration-class special case to the
  production sampler in place of the separated model above.
