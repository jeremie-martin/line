# The geometry of the shot and the catch — campaign

## Goal

Improve the compiler by improving the **geometry** — where the rider's shot (launch)
and catch (landing) physically go, and the length / curvature / placement of the arc
that carries it. The bet is that the remaining headroom on the geometry-capped specs
(air / impact / elevation / amplitude) is bound by the **shape of the generated
situation**, not by search depth or budget allocation: the search is choosing well
among the arcs it is offered; the arcs it is offered are the ceiling. We want the
headline number to go **up** (north star ≥ 700). This is an arc-placement / generation
problem, not a search problem.

## What the geometry pipeline actually is (ground truth, read before theorizing)

Traced from the code, not the narrative:

- **Candidate arcs are a guided random sweep, not a designed set.** `expandNode` →
  `getCandidatesSorted` (`node.ts:110`) → `solveOneGap` → `sampleOneCandidate`
  (`sample.ts:149`) → `sampleArcPlacementGeometry` → `sampleContactCenteredLines`
  (`arc_placement.ts:820`). Per gap, a deterministic RNG keyed on `(seed, gapIndex)`
  draws K attempts; each is one engine ride; the pool is sorted by cost and the best
  kept. Early attempts are random, later attempts converge to a quasi-random sweep
  (`guideContactCenteredRolls`). So "we sample arcs until something scores well" is
  literally what happens. Pool breadth K is a phase constant (contract ~13–14, quality
  32), not state-derived.
- **What a candidate's knobs are.** Built as pre+post line fragments through the
  predicted contact point: `segmentLength`/grain, `contactAngleDeg`, `preLength`/
  `preAngleDeg`, `postLength`/`postAngleDeg` (the grounded ride-out). Production emits
  **line fragments, not parametric `Arc` objects** — the `Arc`/`curveBias` path
  (`arc.ts`, `sampleTargetStateArc`) is legacy / reachability-probe only.
- **The arc-length lever already exists and is shipped near-neutral.** `arcLenFactor`
  with `ARC_LEN_SPAN_LO/HI = 0.80/1.45`, `ARC_LEN_FLOOR/CAP = 28/260`
  (`arc_placement.ts:198–216`); its own header calls it "the campaign lever for arc
  placement." Arc length is **already coupled to incoming speed** through `speed ×
  frames` pixel sizing (`arc_placement.ts:1004–1006`) — what is *not* speed-coupled is
  the `ARC_LEN_SPAN_*` multiplier (it's room/budget-gated). So "longer arcs when fast"
  is partly already true; the open lever is the span multiplier and the caps.
- **Aim = a probe/fit/propose lane with two knobs.** `makeEnumAimedCandidates` →
  `makeJointAimedCandidates` (`aim.ts:681,704`). Knobs (`ArcKnobs`, `arc_model.ts:15`):
  `pitchDeg` rotates the last ~third of the arc about the suffix joint; `rotateDeg`
  rotates the **whole** arc about its entry. It probes a few knob sets, fits a local
  response model, then enumerates the knob space *inside the model for free* and emits
  the top-k by the readiness objective (`scoreJointKnobs` = current-axis-quality ×
  next-gap-readiness). `LR_AIM_ENUM=0` disables the lane.
- **Geometry → where/how-fast it lands.** The catch point is read from the rider at
  `gap.endFrame` (`readTargetStateFromRider`); the launch (exit) state is captured at
  the geometric arc exit (`releaseExitArrivalState`); the **next** landing is projected
  ballistically by `propagateBallisticArrivalState` (`arc_model.ts:36`), consumed by the
  pool ranker (`predictArrivalAtNextContact`, `objective.ts:111`) and by aim. This is
  the one minimal-simulation map: arc params → release state → ballistic → arrival at
  the next contact, charging zero physics frames.
- **The safe region is narrow and already instrumented.** Hard gates in
  `evaluateCandidateLines` (`candidate.ts:761`): survival (terminus past
  `endFrame+16`), landing (±1 frame of the beat), off-beat, and a pre-beat contact
  reject. Whole-arc `rotate` moves the entire landing surface, so rotated proposals fail
  landing/survival far more often — tracked as `enum_rot_gate_fail` (`aim.ts:794`).

## Where the levers are (hypotheses to test, not claims)

- **Smarter / wider candidate sampling.** The pool is a blind random sweep over a fixed
  parameterization. Is a state-aware proposal (arc length/curvature/angle as a function
  of incoming speed & angle & next-gap distance) better than sampling and sorting? Does
  more breadth K on geometry-capped gaps help, or is the parameterization the limit?
- **The arc-length span lever.** `ARC_LEN_SPAN_*` is near-neutral; couple the span/caps
  to incoming speed ("longer when fast") and measure — separate from the existing
  `speed × frames` base sizing.
- **Curvature / shape.** Today's ride-out is a straight-ish grounded fragment. Is there a
  shape DOF (bias, multi-segment) that the scorer rewards on air/amplitude specs?
- **Aim inside the safe region.** Rotate is high-variance; pitch is safer. Is there a
  better knob basis, a tighter safe-region predictor, or a cheaper proposer that lifts
  impact/air without the gate-fail tax?
- **Match geometry to arrival state.** Make the proposed geometry more compatible with
  the state the rider arrives in (speed/angle/pose), rather than proposing blindly and
  filtering by gates.

## The harness

`scripts/v0/eval_geometry.sh` (frozen-snapshot mode, copy of `eval_template.sh`):
**12 specs x {150k, 300k} x 9 seeds**. Specs (why each):

- *Geometry-capped headroom* — `drums_pendulum`, `drums_crescendo` (impact drums),
  `big_air_ramp` (long air flights), `climb_terrace`, `terrace_sprint` (terraces /
  elevation under sprint pressure), `skyline_push` (combined elevation+amplitude),
  `swoop_dive` (dive), `summit_push` (climb), `pop_train`, `soar_settle` (amplitude).
- *Dense guards* — `dense_sprint`, `solo_run` (the staple dense path must not regress).

The frozen baseline is the current default geometry; each edit is one
`./scripts/v0/eval_geometry.sh run` against it, then `decide` + the summary. The board
is the campaign's fast measure of record (probe tier); **a canonical run promotes**.

## Companion

`docs/geometry-log.md` — terse running log of every attempt (setup · what · result ·
verdict). Facts only; no presumed-mechanism explanations.
