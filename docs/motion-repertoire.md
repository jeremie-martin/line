# A visual motion repertoire

Owner direction, 2026-09-29. The product should create visually interesting,
enjoyable tracks synchronized to the authored music/specification. Numerical
adherence supports that purpose; it does not define the entire creative result.
The architecture and experiments below are proposals, not a frozen framework.

## Revised creative direction

The owner is open to revisiting scattered normal-line segments as an intentional,
possibly occasional visual effect. The earlier rejection concerned their look
and pervasive use; it should not permanently exclude them from exploration.
Frequency, placement and combinations should be discovered through examples.
No particular probability, music-intensity rule or specification-format change
was requested. Coherent arcs remain the current production default. The existing
acceleration restriction is not broadened by this direction.

The frozen V4 suite, scoring and qualification contract remain intact. A study
using a different visual/material contract must say so rather than present its
score as an ordinary qualified V4 result. The completed performance goal remains
complete; this direction does not open a new numeric target.

## What the code already supports

The current [arc builder](../scripts/v0/optimizer/arc_geometry.ts) has continuous
control over entry, turn, exit, support length, easing, bend, turn timing and
guide geometry. Single, partially guided and fully guided arcs already belong
to this family. The [control registry](../scripts/v0/optimizer/arc_motion_control.ts)
shares search bounds, steps, identity and diversity across construction/repair.

The [normal-line segment controller](../scripts/v0/optimizer/normal_motion.ts)
also remains in the tree, with the archived compiler and videos described in
[the earlier review](normal-motion-video-review.md). It builds geometry through
feedback over time, rather than evaluating only a complete parametric arc.
The acceleration-based predecessor is a separate retained implementation.
Their historical scores use earlier benchmark versions and cannot establish
performance in the current 900-point range.

The compiler is not yet a general plug-in system for unrelated geometry:

- Search and learned proposal outputs are typed as `ArcMotionControl`.
- Candidate construction calls `motionArc` directly.
- Guide reduction and repair rely on arc chains and interval ownership encoded
  in line IDs.
- Stored demonstrations and model output schemas describe the current controls.

The shared registry makes adding arc dimensions easier. Supporting a materially
different construction procedure requires another boundary in the architecture.
Likewise, strong results on exposed development demonstrations do not show that
arbitrary new families or unfamiliar specifications are already solved.

## Separate shape, construction and composition

A useful vocabulary distinguishes three things:

| Concept | Meaning | Example |
|---|---|---|
| Geometry family | The physical structures available to build | Smooth support arcs, paired guides, scattered normal segments |
| Construction method | How a feasible structure is found | Parameter search, learned examples, measured feedback |
| Motion motif | A recognizable visual passage, possibly using several structures | A sweeping descent, a quiet glide followed by a sharp catch |

These are different axes. Several construction methods may produce the same
family. One motif may span several beats, and the same family may produce many
motifs. A new artistic effect need not require a new primitive class.

The reusable boundary should be a physically measured proposal over an authored
time window. Families can have different parameters and proposal methods,
including methods that need intermediate physics probes. They share access to
the incoming physical state, authored targets, metered work allowance and
validation of the existing prefix and resulting continuation. Each candidate
retains its geometry, measured outcome, construction provenance and family
identity. Cached or learned controls must include their family/schema identity.

Geometry ownership should be explicit enough that an arc-specific guide trimmer
cannot accidentally process another family's segments. Search may refine within
a family, but must not average unrelated parameter vectors together. Borrow
existing metering, evaluation and continuation logic instead of copying an entire
compiler for each family. Introduce only enough abstraction to support two real,
different implementations before designing a larger extension system.

Transitions deserve their own experiments. A visually appealing isolated motif
may leave an arrival speed, pose or position that makes the next one difficult.
Test entry and exit compatibility, include surrounding motion, and let the
planner revise earlier choices when a later passage cannot be realized.

## A playable gallery as a research instrument

Start with a small set of short musical/physical situations and several actual
rendered alternatives for each. Use the existing [playback dashboard](../dashboard/index.html),
[specification timeline](../spec-dashboard/index.html) and
[production rendering path](../scripts/produce/arc_review.ts) as reusable pieces.
A motion gallery is not already implemented by those pages.

Useful capabilities would be:

- Synchronized comparisons of the same authored passage, including lead-in and
  continuation, with a consistent camera treatment.
- A geometry view and the finished vertical presentation with music. A beautiful
  shape in an overview can still produce an awkward close-up ride.
- A few meaningful family-specific controls, reproducible variants, and the
  ability to pin a result and record what makes it interesting.
- Visible physical/timing outcomes, actual search work and failed attempts,
  alongside the videos. Failed construction should not silently become an arc
  while retaining the requested family's label.
- Examples of family transitions and longer sequences, so repetition, contrast
  and pacing can be judged beyond a single isolated trick.

The first gallery can compare existing arc variations with the retained normal
segment approach. New curves or other structures should enter as hypotheses
with rendered examples, rather than names in an empty catalog. Asset and compile
identities must make the displayed video traceable to the actual tested inputs.

## Choosing variety deliberately

If the score is the sole selector, a small numerical advantage can cause one
family to dominate. Creative choice therefore needs an explicit role of its own.
Initially, manual family selection and reproducible seeded variation are enough
to explore it. A future composer could choose among physically feasible,
sufficiently faithful alternatives according to visual preferences and the
surrounding sequence. The amount of permissible adherence loss is a product
tradeoff to measure and inspect, not a new aesthetic scalar to invent now.

Sparse use of a fragmented style might create an interesting contrast, or it
might look distracting. That is a visual hypothesis. Randomness should vary
which candidates are considered or selected, while preserving physical checks
and reproducibility. An intensity-to-family rule should wait for evidence and
the owner's musical/visual judgment; no such rule belongs in the specification
format merely because it is easy to hardcode.

## Practical next experiments

The [unconditional-search finding](compiler-design-audit-2026-09-11.md#follow-up-the-99-finding-is-an-immediate-scheduling-problem)
remains relevant: successful preliminary tracks should become reusable
incumbents, with a deliberate choice to accept them or spend more on a measured
improvement. A gallery should not inherit a nearly full-budget second attempt
for every already successful variant. The recorded savings are in physics work;
model loading, retrieval, rendering and wall-clock costs need separate measures.

A useful small progression is to expose existing variations visually, compare
the normal segment controller on matching situations, then compose two distinct
families through the smallest shared physical contract that works. Use those
examples to discover which new families and controls are worth building. Include
unfamiliar situations as well as recorded development demonstrations.

This progression is adaptable. Its purpose is to earn the architecture through
actual attractive motion and reliable composition, while giving new ideas room
to improve beyond their first implementation.
