# Folds carried from below

The owner asked for folds that read as useful geometry and depend less on an
upper rail. This study uses the compiler after unused-end trimming (`e06720f9`),
on `geometry-improvements`. It leaves the quiet-impact work and physics alone.

## What the sled actually rides

Replaying the 164 baseline V7.1 rides finds 908 intact folds, each a lead-in and
three straight faces. Of these, 735 touch a guide, 510 touch main and guide in the
same frame, and 431 touch all three faces with the sled. Contact windows include
three frames before the authored section, to catch early landings. Simultaneous
contacts are a diagnostic; they do not by themselves establish a squeezing force.

All 908 folds change turn direction: 836 dip down and turn back up, while 72 form
a ridge. The sled touches the middle face of 409/836 dips, versus 72/72 ridges;
it touches the last face of only 26/72 ridges. A drawn three-face fold is therefore
not necessarily a shape the sled rides through. The existing fulfillment check
also allows guide contact to establish traversal of the shape.

There is another construction already expressible by the controls: two corners
that both turn upward. Each corner can push the sled from below, and the final
face can serve as a launch. This need not finish pointing upward: a descending
entry may finish almost level. No realization rule needs to change.

## The experiment

Every fourth generic paired-fold proposal uses this construction instead of the
inherited generic proposal. The ordinary optimizer remains free to reject or
refine it; other families and separated transfers retain their proposals. The
number of proposals and physics allowance stay fixed.

The first face starts 1–20 degrees above the incoming direction, limited to
−45 through 80 degrees. The exit turns another 30–70 degrees upward, limited at
−80 degrees. The middle heading is their average (`foldBend = 0`), giving two
substantial corners. Entry and first face agree (`turn = 0`). Existing timing
controls place the corners; initial guide clearance spans 12–22 px. These are
initial proposals, not constraints on the final controls. Rails are still offered.

The test declared before running is the complete V7.1 panel, 41 specifications
at four seeds, against the branch point. Completion, every score ruler, body
contacts, extra impacts, upper hits and rail use accompany the geometry review.
There is no speed claim and no new aesthetic score or rail quota.

## Results

All 164 rides finish in both arms; all 216 explicit requested gaps remain
fulfilled. Headline 798.21 → 796.90, difference −1.32, seed-block 95% interval
[−6.2, +3.5]. Of the 35 headline specifications, 15 improve and 20 worsen;
seed-block differences are +3.0, −1.4, −3.0, −3.9. Explicit specifications,
reported separately, improve by 1.94 points. This is not a demonstrated score gain.

Equal-weight means over the eight headline strata, lower loss is better:

| ruler | before | candidate | difference |
|---|---:|---:|---:|
| contact-impact loss | 0.059154 | 0.059763 | +0.000609 |
| strike loss | 0.037513 | 0.037833 | +0.000320 |
| impact v2 loss | 0.005676 | 0.005807 | +0.000130 |
| impact v3 loss | 0.005693 | 0.005829 | +0.000136 |

The historical frozen grade rises 6.51 → 12.73 under these same weights, but its
validity gate passes only 1 → 2 of all 164 rides; it must not be presented as
broad quality improvement. Current production completion is 164/164.

The full report also shows body drag 3.74 → 3.70 seconds/minute and strong extra
impacts 0.10 → 0.08 per 100 beats. Overall rails rise about one percentage point
(41% → 42% rounded), and clean upper hits on strong beats fall 10.3% → 9.8%.
The equal-stratum detail, including explicit requests, shows quiet bias worsening
by 0.003, very-strong bias falling 0.002, rail contact rising 0.072 seconds/minute,
air RMS slightly down, speed RMS slightly up, amplitude RMS down 0.001, and no
change in off-beat kicks. These small aggregates hide gains and losses by category:
headline G −0.5, P1 −2.9, P2 −3.3, P3 +5.4, P4 −3.5, P5 −1.2, P6 −8.4, P7 +3.9.
Per-spec seed signs and every ruler remain in the complete report.

Physics work stays about 3.51 million frames per ride in both arms. The
headline-stratum mean changes by +547 frames, about 0.015%; simultaneous compile
wall times are not a speed benchmark.

The local mechanism does work:

| fold contact diagnostic | before | candidate |
|---|---:|---:|
| intact folds | 908 | 908 |
| guide touched | 735 (80.9%) | 717 (79.0%) |
| sled touches all three faces | 431 (47.5%) | 457 (50.3%) |
| main and guide touched in the same frame | 510 | 518 |
| two upward corners | 0 | 17 |

All 17 upward-turning folds touch all three faces; 13 have no rail. But 18 fewer
fold rails are offset by 100 more rails in other families: scattered +24,
terraces +38, serpentines +26, ripples +14, arcs −2. These are pooled counts,
not the stratum-weighted percentages above. Changing the fold proposals changes
later physical states and searches too; a local success does not guarantee a
better complete ride.

**Verdict: not adopted on `geometry-improvements`.** Preserve the candidate on
`experiment/folds-carried-from-below`, including its own parity references, for
reproduction and visual review. The long-running branch keeps the prior compiler.
The useful finding is an available construction the old proposals never retained;
the integration does not meet the whole-ride rail and upper-hit goals. Increasing
its frequency blindly would not address that failure. A next study should inspect
the release and subsequent catches on the paired rides before changing selection.

Construction verification passes on all 164 candidates (12,178 supports), and all
six before/after review pages load and seek without JavaScript errors. The
candidate's full `npm run check` passes: 627 tests, 32 Rust tests, exact engine
checks, compile and judge parity, and timing/production/review smoke checks
(2.4 minutes). The default compiler and its parity references are unchanged on
`geometry-improvements`.

## Review material

Generated files are local and uncommitted:

- `generated/fold-study/diagnosis.html`: baseline examples and actual face contacts.
- `generated/fold-study/folds.html`: paired examples of the new construction,
  selected to explain its mechanism, not to represent the whole result.
- `generated/fold-study/whole-rides.html`: whole-ride geometry, including a loss.
- `generated/compare/upward-folds/collection.json`: six playable before/after rides.
- `generated/eval/compare/upward-folds/report.txt`: the complete comparison.

The local fold diagrams align each first face's start and use equal scales.
The incoming motion can differ because earlier sections changed too. The
comparison is of full compiles, not an isolated replacement at a fixed state.
