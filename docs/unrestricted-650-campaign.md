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

The 44-source geometry study completed: baseline discovery aggregate 607.4692;
fixed suffix 607.4883 (+0.0191, 10 improved sources); translation 607.6918
(+0.2226, 34 improved); similarity 607.6409 (+0.1717, 35 improved). All retained
tracks remain valid by incumbent preservation and exact replay. Trial validity
was 163/2,816, 863/2,816, and 965/2,816. Among translated/similarity failures,
1,396/1,398 ended in rider ejection. Full propagation still destabilizes many
later contacts. Cost: 23,941,986 trial/replay frames plus 205,094 calibration
and neutral frames; 249.11 summed worker seconds. Plan SHA-256:
`484d4404e81f4a966ad517775a447aeb98363563b40fade88d18d21251549a00`.
These gains do not repay integration cost or approach the required improvement.

Next physical hypothesis: matching incoming heading throughout a catch carries
the incoming error into its release, allowing errors to grow over many contacts.
Test an input-aligned catch that gradually returns to its original exit tangent
and scale. The transform blends from arrival similarity at the nearest capture
point to pure translation before the final segment, preserving the original
terminal tangent. This is geometry feedback, not a fabricated state reset.
Test the same four-source/eight-anchor geometry pilot with this `restore` arm;
five control invariants pass. A stronger optimizer is useful only if there is a
stable region of complete-track improvements to exploit.

The release-restoring pilot improved two sources by at most 0.0138, with
33/128 valid trials. It cost 421,839 trial/replay frames plus 18,916 calibration
and neutral frames, and 5.51 summed worker seconds. Exact neutral and winner
replays passed. Plan SHA-256:
`e503054e9c46709dfaf337e8f8fd403b1516fdc287b10523515ff3415e0c1af6`.
The input/output blend does not solve the stability problem. No compiler arm
or governed experiment is justified by these small offline gains.

The next architectural direction is to jointly synthesize contact and release
geometry over a short horizon, with acceleration/braking as native track
actions and explicit recovery of contact constraints. The demonstrated
weakness is dependence on old catch templates: rigid transport preserves too
little of the rider's articulated state, and restoring only the exit tangent
does not correct it. A planner should optimize realized intermediate states
and generate geometry for them, retaining a valid complete incumbent while
allowing its internal search to explore temporarily infeasible proposals.
This is an open hypothesis, not yet an implementation or a claimed gain.

All experiment artifacts are checksummed and resumable. No benchmark, scorer,
evaluation physics, production compiler, or accepted baseline was modified by
these assays. Five focused tests pass; the repository-wide TypeScript check
still has pre-existing failures, with no diagnostics in either new assay file
or its test after the final extension. All 385 JSON artifacts pass checksum
verification. Total research cost is 26,838,954 physics frames and 276.39 summed
worker seconds, with no repeated baseline searches. The accepted headline
remains 607.2582.

Recorded commands, run with the corresponding committed implementation and
`LR_ENGINE=wasm node --import tsx scripts/benchmark/whole_track_energy.ts`:

| Implementation | Output suffix under `generated/benchmark-v2/unrestricted-650/` | Plan arguments |
|---|---|---|
| `a5235837` | `energy-pilot-typed` | `--plan --anchors=8 --sources=amplitude_tides,frontier_dense_recovery,regression_transition_mosaic,believer_impact_56s` |
| `4fb41225` | `geometry-pilot` | Same four-source plan plus `--family=geometry` |
| `4fb41225` | `geometry-discovery` | `--plan --family=geometry --anchors=16` |
| `c96e76db` | `restore-pilot` | Four-source geometry plan plus `--modes=restore` |

Each command supplies its explicit `--out` directory. Execute the resulting
frozen plan with that same output argument and `--jobs=4` for pilots or
`--jobs=8` for discovery. Readers refuse mismatched implementations or changed
inputs; committed source and checksum-bound artifacts preserve reconstruction.


### Physical prefix planning (2026-09-07, continuing)

The next architecture is implemented in `scripts/benchmark/whole_track_planner.ts`.
It carries a beam of real immutable prefix engines, regenerates each catch from
its actual incoming state, and synthesizes independent release length, exit
heading, smooth impact-window bends, and native material. It preserves the
exact original path alongside alternatives. Every changed proposal must preserve
the complete articulated packet at H−2, then land on beat and survive its
interval. Intermediate branches may lose local score; only the final complete
track is retained against the fixed V2 score. A cold full-duration replay must
reproduce the selected report and score exactly. No states are spliced.

The beam can rank by measured next-interval motion, or explicitly simulate the
next catch under two causal transports before pruning. It can continue from a
previous verified improvement, with checksum-bound input geometry and reports.
The warm start's line ownership is reconstructed and required to partition the
complete geometry exactly. No additional baseline compiler search is used.
All runs remain **additional-compute research**, never 750k promotion evidence.

Three important checks corrected research implementation details:

- Exact neutral comparison exposed the earlier transport harness's omitted
  20-frame rideout. The harness now uses track duration and compares the entire
  report and score, including terminus. `replay_whole_track_tail.ts` audited all
  160 retained tracks, deduplicating to 119 exact replays: zero invalid tracks,
  zero score changes, 281,856 frames and 2.35 seconds. The earlier outcomes are
  confirmed over the full duration. The initial planner pilot aborted on the
  neutral check; a one-source diagnostic identifies only terminus frame
  2240 versus 2260. The first aborted four-worker attempt did not persist its
  counters; it is excluded from the measured totals below.
- The first beam combined per-axis RMSs as its internal objective. The fixed
  judge combines MSEs before taking the square root. The planner now uses that
  same reduction; the benchmark never changed. Explicit terminal comparisons
  of accumulated versus realized per-axis SSE agree within 3.6e-15 on the
  corrected four-source studies. Their final scores were always judged by the
  unchanged scorer, including the earlier proxy-objective study.
- A real-engine rail test exposed reversed forward/brake labels in the study
  helper. The kernel applies its stored acceleration vector to *previous
  position*, so realized propulsion follows the stored tangent. Both directions
  were enumerated in earlier studies; their saved physical tracks and scores
  remain evidence, but the old numeric sign labels are reversed. The helper
  and tests are corrected. Exact physics now verifies forward versus passive
  versus braking motion, and stronger force from two/four rail layers.

The baseline four-source panel is unchanged: amplitude tides, dense recovery,
transition mosaic, and impact Believer. All retained tracks in completed runs
below are valid and reproduce in a cold replay. Entries marked 44 use the full
hierarchical discovery aggregate; four-source means are descriptive.

| Output directory | Sources | Mean per-source gain | Best source gain | Frames | Summed worker seconds |
|---|---:|---:|---:|---:|---:|
| `planner-pilot-full-tail` | 4 | 2.8155 | 10.6014 | 2,093,145 | 14.62 |
| `planner-discovery` | 44 | 1.1071 | 11.3008 | 22,727,720 | 159.96 |
| `planner-mse-pilot` | 4 | 0.7764 | 2.3097 | 2,067,370 | 14.61 |
| `planner-mse-global-pilot` | 4 | 5.4292 | 21.0046 | 5,424,073 | 37.33 |
| `planner-target-pilot` | 4 | 6.0096 | 22.7223 | 9,077,546 | 64.77 |
| `planner-lookahead-pilot` | 4 | 3.8094 | 14.2874 | 8,504,094 | 63.37 |
| `planner-target-pass2` | 4 | 2.6340 | 9.4948 | 8,892,491 | 64.85 |
| `planner-target-pass3` | 4 | 1.7778 | 6.0154 | 8,809,004 | 64.61 |
| `planner-layer-pilot` | 4 | 6.0096 | 22.7223 | 9,938,483 | 76.21 |
| `planner-target-discovery` | 44 | 3.7421 | 25.3363 | 97,939,756 | 710.97 |

`planner-discovery` moves 607.4692 → 608.2268 (+0.7576; 41/44 improve).
The corrected wider target-program search, `planner-target-discovery`, moves
607.4692 → **610.1912 (+2.7220; 44/44 improve)**. Its cold replay and all
neutral checks pass. The four-source iterative target program reaches a
cumulative Believer gain of **38.2325** after three passes; the other three
cumulative gains are 0.9660, 0.2777, and 2.2094. These outcomes establish more
physical authority than rigid transport, while dense-case gains remain small.
A 640-frame flat-rail probe establishes that native layers increase propulsion;
the layer pilot produces no gain beyond the target-program pilot, so the
expensive extra family is not included in the next broad pass.

The first planner implementation is commit `5104b1e3`; MSE ranking and full-tail
checks are `c03218c2`; target-derived release geometry is `2d8f30d5`; two-contact
lookahead is `682933c1`; iterative warm starts are `663bece7`; rail-layer trials
are `251c701d`; corrected propulsion labels and exact-physics tests are
`ac8cc980`. Each directory contains its full checksum-bound plan, per-source
search records, selected track/report, and summary. The plans bind source
hashes, original capture hashes, engine and suite identity, and warm-start hashes
where applicable. Eleven focused tests pass after the physical sign correction.

Commands use `LR_ENGINE=wasm node --import tsx scripts/benchmark/whole_track_planner.ts`.
Every command supplies an explicit `--out=generated/benchmark-v2/unrestricted-650/NAME`.
Create with `--plan`, then execute with `--jobs=4` (panel) or `--jobs=8` (44).
The original panel uses `--width=6`; the wider target planner uses
`--width=16 --selection=global --target-programs=on`. Omit `--sources` for all
44. Two-contact lookahead adds `--lookahead=2`; native layers add
`--rail-layers=on`; iterative planning adds the same explicit
`--warm-start=PREVIOUS_OUTPUT` to plan and execution. The four-source IDs are
listed above and in every panel's plan.

Current work: continue the target-program planner on all 44 improved tracks,
and test selection of reusable geometry from elsewhere in the same generated
track by its measured impact/release behavior. This is per-compile geometry
reuse, not a benchmark-output lookup. Measure coverage and accumulated gains
before choosing the production-budget allocation and source integration.
The accepted headline is still **607.2582**; no governed eval or promotion has
been performed in this phase.


Further completed runs: self-reuse of measured shapes adds little on the dense
panel; fresh native sampling improves the other three more strongly; state
spacing at width eight reduces compute but not the dense bottleneck. The second
44-source target-program pass improves 42 tracks again, moving 610.1912 →
**611.4610**, cumulative +3.9918 over the captured 607.4692. All 44 final tracks
are valid. The measured versus accumulated terminal SSE discrepancy across the
first 44-source target-program run is at most 5.33e-15.

| Output directory | Sources | Mean incremental gain | Best incremental gain | Frames | Summed worker seconds |
|---|---:|---:|---:|---:|---:|
| `planner-reuse-pilot` | 4 | 5.7368 | 20.2491 | 12,098,940 | 86.47 |
| `planner-target-discovery-pass2` | 44 | 1.4421 | 9.4948 | 94,410,546 | 696.25 |
| `planner-state-pilot` | 4 | 3.5575 | 13.9037 | 4,536,474 | 34.12 |
| `planner-native-pilot` | 4 | 8.4866 | 28.5125 | 17,392,551 | 114.83 |

Self-reuse (`--reuse=12`) and the full second pass use implementation
`67a8967d`. Fresh sampling (`--native-draws=64`, width 16/global) and state
diversity (`--selection=state --width=8`) use `e55644f9`. Native geometry is
regenerated for the actual incoming state and outgoing authored targets; it
passes the same exact physical prefix and final-track judge. State diversity
uses translation-relative articulated positions and point velocities only as a
compiler search heuristic. Neither changes the evaluator.

Next physical test: small finite contacts aimed at observed TAIL/NOSE states
inside the impact window, with both normal directions. These preserve the exact
initial capture packet and are judged through the following interval. Unlike a
single flow-facing full-sled membrane, they can apply different turning actions
at different phases and be followed by the new multi-contact planner. This is
a new tested formulation, not a claim that earlier membrane failures were wrong.


The single-pulse pilot (`4766e260`) and paired-pulse pilot (`7d594655`) are
complete. All four sources improve and replay exactly. Pair geometry observes
the state produced by its first pulse before placing its second, and requires
that second geometry preserve the complete packet through H+3. It changes
ordinary geometry; no state is forced or reset.

| Output directory | Mean source gain | Best source gain | Frames | Worker seconds |
|---|---:|---:|---:|---:|
| `planner-pulse-pilot` | 8.0924 | 28.9751 | 11,379,887 | 80.37 |
| `planner-pulse-pair-pilot` | 10.6301 | 28.9751 | 13,226,022 | 101.01 |

The transition case rises by 12.8601 with pairs, versus 2.7093 with single
pulses. Its winner changes 56 of 91 catches, including five single pulses and
four pairs. Impact RMS falls 0.1663 → 0.1370, while air worsens 0.0644 → 0.0712
and speed worsens 0.0756 → 0.1019. These are real whole-track tradeoffs: the
impact improvement outweighs the added debt in the unchanged final score.
Among all locally admitted transition-case pulse trials, 6,064 single pulses
make a scored-window sled contact and 114 do not; 1,221 pairs engage both
pulses and one engages only one. The mechanism is physically active.

The paired planner is now running on all 44 verified outputs of
`planner-target-discovery-pass2`, preserving that 611.4610 offline incumbent.
This tests whether the contact-level authority composes across the suite.
A subsequent energy-control direction can address the observed speed cost,
using support after the impact window rather than changing the score or
relabeling a loss as progress.


The 44-source paired-contact pass completed: **611.4610 → 616.1740**, cumulative
**+8.7048** over the captured discovery aggregate. All 44 tracks remain valid;
42 improve further. Incremental gains include Rising Switch +51.3530,
Open Hook amplitude variant +27.3305, Countercurrent impact variant +16.1567,
impact Believer amplitude variant +14.8277, and delayed Loose Pocket +14.5315.
This is broader evidence for composed physical contacts, still additional
research compute. Cost: 143,012,318 frames and 1099.47
summed worker seconds. Plan SHA-256 is
`f45c8ca90e78caa16391ee49ece8c408f5155c16e6a0ce96ad45610a80ac44ff`. The original 750k benchmark headline remains 607.2582.

The next pass continues from these 44 verified tracks. A parallel panel tests
native energy on support unused through H+6. The material proposal is admitted
only if it reproduces the complete articulated H+6 packet of its unmodified
candidate, preserving the realized impact while attempting to recover outgoing
speed. It is generated for an incumbent or pulse candidate whose measured next
speed misses its target. Both future acceleration and braking are available;
the signed measured residual selects the direction.
