# Gallery expansion: scattered contacts, waves and facets

The gallery now compares five implementations: the existing arcs and guides,
the original scattered controller, improved scattered construction, wave curves,
and faceted curves. Production still uses coherent normal arcs. All emitted
materials in these studies are ordinary type-0 lines; the benchmark, detector,
scorer and physics are unchanged.

## What changed

The original scattered controller chooses narrow collision planes from a desired
velocity schedule. Its fixed candidate grid often finishes well before its
allowance. Increasing the allowance alone then repeats the same result. Pose,
vertical drift and impact-feedback ablations changed individual results but did
not provide a large consistent improvement. See the
[exploratory measurements](evidence/motion-gallery-exploration-20260929.json),
including rejected reference-velocity and geometry-postprocessing prototypes.

The new scattered construction keeps that validated track as an incumbent. With
its remaining allowance it plans an arc ride, observes the actual collision
footprints, and rebuilds those footprints as tiny disconnected normal segments.
It replays and measures the fragments themselves before comparing them with the
incumbent using the existing whole-trajectory compiler objective, including the
quiet tail after the last beat. The planning arcs are never
emitted under the scattered label. This reuses the strong trajectory planner;
it is not evidence for an equally capable independent scattered planner.

A reference-engine observer records each collision immediately, before later
constraint iterations mutate the point. Its complete detector trajectory must
agree exactly with the fixed WASM judge. Each reconstructed candidate then gets its own
fixed-engine replay, and the selected reconstruction gets a second replay.
Only owned judge instances are disposed. The observer and its dependencies are
fingerprinted in each study plan.

Reconstruction is numerically delicate. Splitting a line changes its floating
point representation and spatial-grid participation. A contact location alone
does not guarantee equivalent future motion. Global width sweeps and local width
repair failed to reliably preserve some reference rides. Therefore reconstruction
is a measured candidate, not an assumed identity transformation. The gallery
records the selected construction and failed reconstruction probes. Reference
motion fidelity and actual output quality are separate measurements: a fragment track may deviate from the
reference yet still be a useful, valid improvement. Retaining the original feedback track means a failed reconstruction need not destroy an
already valid scattered ride.

Each phase has its own enforced allowance. The reference planner reserves the
observation and validation cost in advance; its entire allowance comes from the
work left after feedback construction. The reported work is the sum of both
phase meters, including rejected reconstruction candidates. The gallery verifies
that accounting against the last phase's meter and the overall ceiling. Model
loading and wall time remain separate. Concurrent evaluation was running on the
same host, so the recorded timings are observations, not isolated speed claims.

Wave curves revive an existing geometry option: the first bend returns before
transitioning into the exit. Faceted curves use fewer, longer straight sections
of the tangent schedule. Both are searched using their actual geometry. Simply
coarsening an already optimized smooth track usually broke the ride in the
exploratory probe; optimizing the faceted geometry directly worked much better.
These are two concrete curve variants, not a new taxonomy or plug-in framework.

## A selection defect caught by the expanded panel

The first implementation reused the older contact-report loss for choosing a
candidate. That report omits intervals without a closing beat, so it ignored the
quiet tail. The new staccato-release passage exposed the error: at seed 101 and
100,000 frames it replaced a 643.5152-point feedback ride with a 270.587-point
reconstruction. This was a real regression, not seed noise.

Both scattered construction methods now expose the existing whole-trajectory
objective computed from their already validated physics. Candidate ranking and
incumbent comparison use it directly. The earlier defective run is preserved in
[adverse selection evidence](evidence/motion-gallery-contact-only-20260929.json).
A regression test exercises the complete offending passage. No scorer or physical
measurement was changed to repair selection.

## Evaluation

The initial eight 100,000-frame comparisons improved from 580.39 for the original
scattered controller to 842.19, with 8/8 valid. That was a development result on
four passages and two seeds, not a benchmark headline or a geometry ceiling.

The final evaluation adds two passages defined after those probes and six more
seeds, with 2% target jitter throughout. It records every result, including
failures and retained feedback incumbents. The main gallery compares three
allowances (25,000 / 100,000 / 750,000) at seeds 101/102. A second manifest extends
the 100,000-frame panel through seeds 103–108. The underlying six passages are
separate from the frozen benchmark catalog.

The final 100,000-frame panel has **48 runs per method**, six passages × seeds
101–108, with 48 distinct tracks for each method and **48/48 valid** throughout:

| Construction | Mean score | Mean line count |
| --- | ---: | ---: |
| Arcs and guides | 855.91 | 964 |
| Scattered, original | 572.49 | 1270 |
| Scattered, improved | 843.21 | 2825 |
| Wave curves | 824.43 | 1022 |
| Faceted curves | 850.88 | 153 |

Improved scattered construction gains **270.72 points** over the original on
this panel. It selects reconstructed fragments in 47/48 runs; one retains the
original feedback ride. Every paired scattered result is at least as good as the
original here. These are empirical results, not a guarantee on unseen inputs.
On the additional six seeds alone, its mean is **838.82 versus 568.32**.

Across all three allowances, the gallery contains **360 recorded rides**, all
physically valid, comprising **430,952 type-0 segments and zero other materials**.
The original 48-run gallery also contains only normal lines (46,669 segments).
The final browser check displays every new artifact and checks playback, seeking,
mobile layout, historical-manifest compatibility and rejection of corrupted data.

The selection fix changes 7 scattered outputs without changing any run's
physics work; all four other methods keep identical tracks. The original
regression case now scores **898.396**. The fixed production compiler remains at
**952.4726 on V4**, with all **352 tracks, scores, observations, geometry, compiler
statistics and physical-frame counts identical** to the preceding qualified
version. All **184 focused tests pass**. TypeScript retains its 251 pre-existing
diagnostics, with no new diagnostics.

The small allowance still matters: at 25,000 frames reconstruction wins only
1/12 comparisons, so extra planning often buys nothing there. At 750,000 frames,
improved scattered construction averages **850.34** over the same 12 inputs;
100,000 frames gives **856.38** on those inputs. More allowance is not a monotonic
quality guarantee because it changes search allocation and reference plans.
Remaining opportunities include better allocation at small budgets and more
robust fragment realization. Neither the scores nor these two curve variants
establish a geometry ceiling. Recorded mean compile time at 100,000 frames is
about 2.31 s for improved scattered construction and 1.03 s for facets on this
shared host; these observations include contention and process warm-up.

Final measurements and checks are recorded in
[compact gallery evidence](evidence/motion-gallery-expansion-20260929.json),
[production parity](evidence/motion-gallery-expansion-20260929-production.json),
and [validation checks](evidence/motion-gallery-expansion-20260929-checks.json).
The original gallery and all exploratory outputs remain local for comparison.

## Use and reproduce

Start `npm run dash` and open <http://localhost:8767/motion-gallery/>. Choose the
left and right implementations independently, then compare a passage, allowance
and seed with synchronized playback. The original gallery remains available at
`/motion-gallery/?data=/generated/motion-gallery/20260929/manifest.json`.

```sh
LR_ENGINE=wasm node --import tsx scripts/gallery/build.ts \
  --compiler-root=/path/to/clean/compiler --out=generated/motion-gallery/new-run

LR_ENGINE=wasm node --import tsx scripts/gallery/build.ts \
  --compiler-root=/path/to/clean/compiler --out=generated/motion-gallery/new-transfer \
  --budgets=100000 --seeds=103,104,105,106,107,108
```

`--methods=arcs,segments,scattered,waves,facets` selects the implementations to
measure. Use a new directory when inputs or source change. The UI also accepts
`?data=/generated/motion-gallery/new-transfer/manifest.json`.

This remains a physical playback playground, without music or production video
post-processing. Mixing styles within one track, usage preferences, and visual
quality objectives need separate experiments and artistic review. No new
specification controls were introduced.
