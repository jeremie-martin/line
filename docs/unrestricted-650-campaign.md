# Unrestricted compiler improvement campaign

Opened by the owner's 2026-09-07 instruction to remove compiler limitations,
challenge previous assumptions, and execute ambitious ideas efficiently.
The owner clarified that the benchmark and score cannot change. `goal.md` is
the current authority. The previous planning approval question is resolved;
neither its three-contact horizon nor its 22-million-frame study cap is a
restriction on this campaign.

The starting accepted 750k headline is **607.2582**, at N=32, from
`value-ranked-startup-expiration`. The scorer, authored benchmark, validity,
accounting, and evaluation physics remain fixed. No score has been promoted
by opening this campaign.

## Reassessment

Previous experiments establish results for their tested implementations, not
universal physical ceilings. In particular, preserving a local release packet,
rebuilding a suffix with the old search, requiring each local axis to improve,
and retaining the old ranker can each rule out useful whole-track solutions.
The metadata audit also shows that a physical assay can accidentally change
future search behavior. New experiments should isolate these assumptions.

The strongest directions to assess are:

1. **Optimize a complete feasible track directly.** Jointly change contact
   geometry and material controls against the exact full-track objective,
   retaining the incumbent. This tests whether local admission and suffix
   reconstruction were hiding reachable improvements.
2. **Control energy over several contacts.** Acceleration and braking can act
   before and after the scored impact window. Solve the coupled delivery,
   arrival, and outgoing motion problem instead of forcing one passive catch
   to satisfy every demand.
3. **Make larger optimization affordable.** Reuse exact prefixes, represent
   controls in physical units, and exploit engine structure or learned response
   models where they reduce actual cost. Judge their proposals with realized
   tracks. Redesign allocation and ranking if the existing architecture is the
   bottleneck. Simulation optimizations must preserve evaluation physics.

Begin with an exact complete-track optimization assay on the existing verified
discovery tracks, combining solid-geometry controls with newly authorized
material controls. This avoids another baseline capture and measures complete
retained changes directly. Use the results to choose the representation and
integration effort, then open fresh validation for a fixed candidate. Specific
initial experiment sizes are resource allocations, not permanent scope limits.

## Evidence and decisions

- Authorization: compiler research restrictions removed from `goal.md`; its
  previous contents are preserved in
  `archive/goal-before-unrestricted-research-2026-09-07.md`.
- Historical evidence: `impact-delivery-650-campaign-new.md` and the earlier
  campaign archives. Their compiler closures and deferrals are superseded as
  policy; their observations remain evidence.
- Current headline: 607.2582. Implementation and experiment results follow here.

### First implemented assay: causal template transport and energy control

`scripts/benchmark/whole_track_energy.ts` consumes the verified seed 260907001
captures. It measures the original unforced arrival state at every catch, then
replays a single real engine while transporting downstream catch geometry to
the changed arrival. Three arms distinguish a fixed suffix, position transport,
and position/heading/speed transport. Similarity scales initially use [0.5, 2]
to keep this prototype numerically well behaved; that choice is revisable.
No rider states are spliced and no ordinary suffix search is run.

Controls apply native forward acceleration, braking, or an opposing adjacent
pair to whole catches. A greedy update is retained only when the exact valid
complete-track V2 score improves. The zero replay must exactly reproduce the
saved geometry, every contact, every gap report, and the V2 score. Replaying
the final selected controls must reproduce the winner again. All work is
charged and reported as extra research compute beyond the captured compile.

The initial implementation panel is amplitude tides, dense recovery,
transition mosaic, and impact Believer: four strata, the same saved discovery
seed, eight anchors per source chosen by baseline weighted axis error, one
sweep of four energy actions, all three transports. Three physical-control
invariants pass. After fidelity and implementation checks, apply the same
assay to all 44 sources with 16 anchors; this is exploratory evidence, not
independent validation or a 750k promotion result.

The energy pilot completed with exact neutral controls on all four sources.
Only 20/378 changed trials were valid (fixed 2, translated 10, similarity 8),
and none improved the incumbent. Cost: 1,135,726 trial/replay frames plus
9,476 reference-calibration and 9,440 neutral frames; 11.37 summed worker
seconds. Its artifacts are under `unrestricted-650/energy-pilot-typed` with
plan SHA-256 `54e32a71480ff3741a32d4e2764f2c1ca3fa6060e944620acf2c2513ac9c97c7`.
The earlier `energy-pilot` contains only an unexecuted plan superseded by a
TypeScript annotation fix. Whole-catch actuation is too coarse for this initial
representation; do not scale that version merely to collect more failures.

The next pilot uses the same four sources and eight anchors, now with continuous
catch rotation ±0.002 radians and log-scale ±0.005 about the measured arrival
point. The three transport arms and exact full-track objective remain the same.
This tests local geometry authority after removing the old fixed-suffix and
local no-axis-debt assumptions. Four physical-control invariants pass.

The geometry pilot passed all neutral and final-winner replay checks. Fixed
suffixes improved one source by 0.0052; translation improved two (maximum
0.0527); similarity improved three (maximum 0.9819 on impact Believer).
Validity among the 128 trials per arm was 9/34/39 respectively. The four-source
mean gains were 0.0013/0.0174/0.2554. Cost: 1,077,561 trial/replay frames,
18,916 calibration/neutral frames, and 10.39 summed worker seconds. These
small complete-track gains justify measuring coverage, not integration yet.
Plan `952898bfc13f0814201a5577d5c5d6a45b7ce7a1158e16e302e4da2db9b317d9`
is retained under `unrestricted-650/geometry-pilot`.

Next: the same geometry algorithm on all 44 saved sources, 16 error-ranked
anchors, one sweep, all three transports. This reuses discovery data and is
explicitly exploratory. Report its exact hierarchical score as an offline
postprocessing result with extra frames, never as an accepted 750k headline.
