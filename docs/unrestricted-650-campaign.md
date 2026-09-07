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


The second broad paired-contact pass reaches **618.4730**, improving 38 of 44
inputs, with all retained tracks valid. Cost: 135,130,267 frames and 1,052.26
summed worker seconds. Its plan is
`686bff8b04dfc5aa9bad27c0c3a8db47d8b47c614886920970ac4c7578d2382c`.
The post-window energy pilot improves all four sources over the paired-contact
panel: gains from the original tracks are 1.2932 (amplitude), 0.3127 (dense),
17.4087 (transition), and 38.2114 (Believer). All selected energy actions are
forward and follow a pulse; Believer now changes 48 of 49 catches. Its impact
RMS falls 0.1174 → 0.0867, while speed improves 0.0610 → 0.0572 and amplitude
0.2415 → 0.2189; air worsens 0.0548 → 0.0582. This is a complete physical track,
not a local score extrapolation. Pilot cost: 13,790,708 frames and 108.52 worker
seconds. The implementation is `a8ad3cd3`. A 44-source energy pass is running
from the 618.4730 incumbent.

A separate small physics probe tests point-local contacts sharing a common
normal across either the sled or all rider points. Coincident points merge and
surface width is limited by tangential point separation. At a free-flight
frame, 7/24 sled-only proposals and 11/24 whole-rider proposals preserve the
previous full packet and remain intact through five later frames. Largest
next-frame velocity changes are 0.8843 and 2.1378 px/frame respectively. The
first artifact recorded the contact frame's stored velocity and therefore did
not yet observe its causal response; the companion next-frame artifact records
the response at frames 21 and 25. Both artifacts are retained. These are actuator
physics observations, not benchmark or scored-contact evidence. A focused exact
engine test covers the causal, intact whole-rider example before integration
into the research planner.


### Collective control and search distillation

The full post-window energy pass reaches **620.5976** (43 further improved
sources; 139,958,489 frames; 1,098.10 worker seconds). Whole-rider point-local
contacts then improve the panel substantially: amplitude +14.5643, dense
+0.3438, transition +55.8450, and Believer +41.9014 from their original tracks.
The transition's impact RMS falls 0.1663 → 0.1200 while speed also improves
0.0756 → 0.0735. The complete-track tradeoff is now much better than a pulse
without energy recovery. All four neutral and selected-track replays pass.
The collective implementation is `be726ad8`; 12 focused tests pass, including
an exact-engine causal whole-rider force example.

The 44-source collective pass reaches **626.4268**, improving 42 tracks again
from 620.5976. Cost: 194,142,636 frames and 1,640.09 summed worker seconds.
Its plan is `8243630391e08d34372ec8423e56e3e415c63066281fe63af52991edd06bf2d3`.
A full collective run starting directly from the original saved tracks reaches
**624.5730 in one pass**, with 44/44 improved: this is not dependent on all the
earlier optimization passes. Cost: 214,545,031 frames / 1,979.81 worker seconds.
Another pass on the prior 626.4268 tracks reaches **628.7368**, with 39 further
improvements, costing 180,450,502 frames / 1,697.47 worker seconds.

Those last two runs collect candidate training observations. The collector
reproduces all four panel scores, track replays, and physics-frame counts
exactly. Inputs comprise incoming articulated state, authored current/next
targets and durations, candidate geometry, and control parameters. They contain
no source ID, seed, absolute time index, or measured candidate outcome. Labels
record exact validity (including the prefix/capture checks) and realized local
plus outgoing loss. Each checksum-bound gzip stream contains parent-context
bundles. Collection is an observer, not a new scoring or selection rule.

`retain_physical_incumbent.ts` keeps the best of these two already-executed
44-source arms by copying verified track/report bytes. The resulting research
portfolio reads **632.3348**, with no new simulation; all preceding research
compute remains charged to its original runs. Thirteen sources prefer the
single-pass result to the iterated result. This portfolio is an additional-work
research incumbent, not a fixed-budget score or a benchmark promotion. A new
collective pass is running from that complete incumbent.

In parallel, `train_physical_planner.py` fits a compact candidate-validity and
loss model. It samples uniformly within parent contexts for validity, adding
best valid candidates for loss fitting. Internal model selection holds related
source families together; it is explicitly not independent campaign validation.
Model features describe inputs available before candidate evaluation. The exact
engine will still decide every emitted candidate and the finished track.
Cross-language inference parity will be checked before using the model.

This efficiency work has a concrete budget reason. A checksum-verified reading
of all 1,408 accepted N32 `first_completion_frame` statistics finds a minimum of
307,713, median 491,381, 90th percentile 551,169, and maximum 730,037 frames.
These are existing 750k-policy costs, not reduced-budget compiler experiments
or first-completion scores. The median leaves roughly 259k frames for a new
improvement phase, so an exhaustive multi-million-frame planner is not yet a
750k compiler. No new canonical baseline search was performed for this reading.


### Retained physical gains and first efficiency ablation

Two further exact passes on the 632.3348 portfolio reach **635.1623** and then
**636.0228**. All 44 retained tracks remain valid, including cold full-report
and full-score equality. The first pass improves 39 sources and uses
173,943,804 frames / 1,467.55 summed worker seconds; plan
`95c504f5f6a924841a461a1800b081cad5ddd34d5f6c5083203fc2987ee849dd`.
The second improves 32 sources and uses 171,735,915 frames / 1,455.75 seconds;
plan `888e43bbc12fbfb27c8e2f79fd25fba463a96afc887c24345bd2d88f98d7f374`.
These are additional-work research readings, not the active headline.

The first student fits 3,728,862 sampled rows from 18,945,348 exact candidate
observations in 128,330 incoming contexts. Its internal family-held validity
AUC is 0.94198, loss MAE 0.02257, and keep-16 proposal regret 0.01641 with a
0.1 invalidity penalty. Training uses 336.50 seconds. Model SHA:
`61550260b84a0c29433d28202faad342d80d5438ebc67055ae40aa5d4fc57a8d`.
TypeScript inference agrees on all 64 parity rows to 1.11e-16. The model only
selects which proposals receive exact simulation; it cannot admit geometry.

The four-source keep-16/width-4 pilot uses **791,350 frames total**, averaging
197,838 per source, but averages only +0.8404 points. Gains are amplitude
+0.2811, dense +0.1312, transition +0.0036, and Believer +2.9458. Width 16 with
the same selector averages +2.1194 using 3,188,346 frames. Width 4 without
filtering averages +3.4035 using 4,578,063 frames. The full width-16 reference
averages +28.1636. Both pruning and beam width lose useful paths; the wider
student winners contain no collective contacts. AUC alone did not establish
useful search selection. A larger model now learns loss centered within each
incoming context, with a checksum-verified array cache for efficient iteration.
The saved corpora and first model remain intact.

A 384-proposal free-flight probe combines point-local collective surfaces with
native energy layers. It finds 119 causal, intact cases through five later
frames in 1,205 charged frames. A 32-layer example adds 3.53 px/frame of speed
with a 4.01 px/frame next-frame velocity change. This uses ordinary native
segments and the existing acceleration constant. A focused engine test now
covers the causal acceleration and intact bindings; all 13 physical-helper
tests pass. The probe is physical authority evidence, not scored-track evidence.
A whole-track energy pilot is running. Collective paired pulses were also
implemented with the second placement based on the actual first-pulse state;
their pilot averages +23.2391 versus +28.1636 without them, so that broader
proposal family does not yet earn a full-cohort run. Its cost is 19,739,518
frames / 167.74 summed worker seconds.


### Native energy, bounded history, and complete-path distillation

The energy pilot initially completes Believer (+49.4950), then traps in
`addLine` on the other three workers as native patch history grows. Those
three aborted workers did not emit frame counters; successful-cohort totals do
not pretend to include that missing work. The harness now records frames on
future failures. A cold reconstruction every four contacts releases discarded
histories, charges every replayed frame, and checks full incoming packets.
Its Believer control exactly reproduces the unmodified collective track and
report; the energy Believer also reproduces its previously completed result.
The completed energy panel gains +8.6846 amplitude, +2.3240 dense, +50.5321
transition, and +49.4950 Believer, using 24,774,751 frames / 544.92 worker seconds.
This is a mixed panel result; dense and Believer improve over the prior family.

An isolated compiler backend now copies computed prefixes into independent
caches. `build_planner_backend.py` reads the checksum-verified accepted compiler
archive. All seven original Rust source files match the workspace exactly.
Only Clone derivations and a cache-copy ABI are added in a generated directory;
no stepping, collision, invalidation, benchmark accounting, or evaluator source
is changed. The benchmark engine artifact remains untouched. Copying previously
computed states performs no integration; all actual new reads still use the
existing meter. The final cold judge always instantiates the frozen engine.
The backend manifest SHA is
`75ad0584a7511e885388e54d5326573c8c911115df502ca741936fc9a1a8fd9b`.

The backend audit covers 360 detached prefixes, zero-integration cached reads,
near-contact perturbations, branch restoration, and all four full trajectories
against the original engine, using 23,572 frames. Its full-search panel then
reproduces all eight track/report files byte for byte, with the same candidate
and validity counts. Cost falls 18,544,680 → 17,829,089 frames (3.86%), with
147.06 summed worker seconds. Its main purpose is memory bounded by live search
prefixes; it does not substitute an altered physical judge.

The full energy pass on the 636.0228 incumbent reaches **641.2267**, improving
40/44 tracks, all valid and cold-replayed with the fixed engine. Cost:
215,869,676 frames / 4,080.36 summed worker seconds. Plan:
`187cbbb3ea005941f0ef43e8fffbd101e8bc854753540b07e647558d1c95fb4c`.
The original Believer case gains +134.775 in this pass; other larger gains
include sparse lowline +18.281, the slower pickup variant +13.822, wide breaths
+12.864, and the faster meter variant +12.633. A further physical pass is running.
These remain additional-work discovery tracks, not the official headline.

The centered 250-tree student improves internal validity AUC to 0.95761 and
loss MAE to 0.01343, with keep-16 regret 0.01327; cross-language error is
5.55e-17. But its wide pilot averages only +4.3268 in 3,253,467 frames. A width-8,
keep-4, family-exploration reading averages +2.7473 in 1,079,852 frames. Local
prediction quality still fails to retain the complete search's main gains.

A causal learning mismatch is now addressed: base pulses can look poor until
the post-window energy child repairs their speed loss, and that child does not
exist before admission of the pulse. `train_planner_imitation.py` learns which
proposals led to the best complete physical paths and folds winning energy
children back onto the base proposal that must be admitted. It excludes the
already-reserved incumbent/transport options from proposal ranking. It learns
from 2,357 decisions / 308,784 rows, with 354 folded energy actions. The teacher
includes 359 collective, 160 single-point, and 65 paired-pulse admissions.
Internal family-held teacher recall is 33.73% at keep 4, 49.63% at 8, 67.60% at
16, and 82.03% at 32. Training takes 120.87 seconds; all 64 TypeScript loss
predictions match Python exactly. Source IDs, seed, and absolute positions are
still absent from model features. This is discovery training, not independent
validation.

The complete-path student's width-16/keep-16 pilot averages **+24.1606** in
**3,027,193 frames**: 85.79% of the full search's average gain using 16.32% of
its physics. Source gains are amplitude +11.8425, dense +1.4193, transition
+45.3812, and Believer +37.9993. Width 4 still averages only +4.3485 in 786,053
frames. Keeping width 16 but four proposals, with paired-pulse generation off,
averages **+11.3628 in 1,028,490 frames** (257,123 per source). Keeping eight
instead averages +10.0234 in 1,624,918 frames; beam search is not monotonic in
proposal breadth. Neither is a fixed-budget compiler result yet.

The previously unused discovery seed 260907002 is now being captured at the
accepted compiler's first completion, under its actual 750k policy, with two
observer-free controls and exact ordinary replay. This measures real remaining
budget and exposes the new policy to fresh incoming states. Independent
validation and canonical evaluation seeds remain untouched. The capture script
now accepts a frozen seed, source subset, and first-completion option; prior
capture artifacts remain unchanged.


The second full energy pass reaches **641.9196**, with 33 further improved
tracks, all valid: 204,324,401 frames / 3,895.62 summed worker seconds. Its plan
is `de65a826ce050b5caf5fbe3b89b38e63d21512eea4c3eb73640a527f30678097`.
The fresh first-completion cohort completes all 44 sources and all 4,056
selected-fit checks, with both observer controls exact. Actual search cost is
21,702,749 frames; controls use 1,131,140, ordinary replay 104,256, and census
104,256. First-completion cost ranges 346,537–658,471; the upper median is
485,998. This leaves materially different improvement budgets by track.

A first explicit 750k two-stage study is running on those fresh discovery
tracks. It charges the original compile's real first-completion frames plus
all new calibration, search, cache synchronization, and final cold replay work.
Initial beam width scales with the measured budget left; four proposals are
ranked per parent, and the standard physics-frame hard guard reserves a final
replay. An unfinished improvement search returns its fully verified incumbent.
This checks a concrete budget allocation before production integration; it is
not a canonical promotion or independent validation reading.


The first explicit 750k study completes 44/44 valid tracks: **604.0352 →
606.1655** versus its fresh first-completion input, with 23 improvements. It
uses 10,357,794 new frames in addition to the 21,702,749 first-completion frames;
maximum per-source total is 747,741. This does not establish improvement over
the accepted full-budget compiler. Twenty-two searches hit the guard, mostly
within one to six contacts of the end (one during finalist judging), and keep
their verified input. The initial width heuristic alone is inadequate for an
anytime compiler. Completion reserves and fewer full finalist replays are the
next correction. A full physical teacher is also being collected from these
fresh first-completion states to reduce the training-state mismatch.

A paired native-energy probe controls the second force from the actual state
after the first, using the same absolute surface normal and opposite energy.
In 427 charged frames it finds, for example, a causal intact 1.823 px/frame
initial velocity response with only 0.318 final residual. This measures physical
response in free flight, not the benchmark's contact-gated angular impact.
Complete-track scoring must determine whether it helps the authored target.


### Completion reserves, expanded imitation, and direct native support

Completion reserves and one full finalist replay improve the explicit 750k
study to **608.0373** (31/44 improved, four budget stops). Expanding complete-path
imitation with the fresh physical teacher produces **610.4406**, 44/44 valid,
33 improved, zero budget stops, maximum total 742,842 frames. Its 10,349,547
phase frames are charged in addition to the actual first-completion search.
Plan: `31721ef0453f59b51d5c383436158c192fe1e55669955febb3e6426ce46d8c1b`.
Model: `81acaae9c1384f55989a44586e4ff60648227af782567b97744457bd707acd9d`.
The full teacher reaches **636.2329** from those 604.0352 first completions,
using 264,729,120 additional frames; all 44 improve. Seed 260907002 is now
adapted discovery data, not independent validation. No canonical evaluation or
promotion has occurred, and the accepted headline remains 607.2582.

The expanded imitation model learns 4,434 complete-path decisions, including
763 deferred-energy admissions. Its reusable training arrays avoid reparsing
the large physical corpus. Inference skips the unused validity head when its
penalty is zero; 192 stored Python/TypeScript predictions retain exact priority
parity. A wider one-proposal allocation scores only 605.6014 and is not preferred.

Free-flight inverse native energy fields achieve requested velocity changes
within about 2% in several intact examples, but they transfer poorly into the
existing support geometry. On 48 actual catch contexts, 576 direct uniform or
coherent proposals are all causal at H−2; only 48 survive their physical binding
checks. Relaxing the freeze at H does not solve that failure. Single-layer force
calibration improves a few cases but exposes uneven and repeated collisions.
A compiler-only trace backend observes positions immediately before each of
the six collision sweeps, with no change to physical stepping. Trace requests
evict and charge a replay of the observed frame. Its audit checks 360 replays,
branch/cache operations, and four full trajectories against the frozen engine;
all match. Manifest:
`6ecdf9ee2c6a3cb8cfdb0b0546ba814705207f967486041c0c1bfda5d7803f39`.
Observed pre-sweep positions differ from final collision-projected positions by
up to 1.036 px on the audit panel. Using actual solver positions raises useful
contact controls, but most proposals still fail. Coarse balanced energy pairs
also give only small complete-track improvements on the warm four-source panel.

A new construction direction builds native support directly from an empty
track. Point-local energy lines steer each physical rider point toward a common
next-frame velocity, optionally correcting accumulated pose error. These are
ordinary native line collisions; no point masks, forced states, or altered
physics are used. Every finished fixture is cold-replayed with the fixed engine
and its entire raw trajectory must match. Two constant-velocity fixtures sustain
1,000 continuous contact frames for about 125k charged frames. A varying-heading
fixture produces 47 timed landings over 1,000 frames with ten airborne frames
before each landing, costing 66,743 frames. Adding pose feedback at gain 0.15
extends a larger-turn fixture to 2,400 frames / 114 timed landings, costing
159,405 frames. Other settings fail, sometimes on a delayed collision or binding
break. These are physical feasibility fixtures, not benchmark scores. Short
physical backtracking and authored-target construction are being developed next.
