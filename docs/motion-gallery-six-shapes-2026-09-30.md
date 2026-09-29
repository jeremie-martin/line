# Six more physical geometry choices

The gallery adds six styles to arcs/guides, improved scattered segments, waves
and facets. The original scattered controller remains an eleventh entry for
comparison. Production still defaults to coherent normal arcs.

| New choice | Visible construction |
| --- | --- |
| Serpentine rails | One broad S-shaped sweep after the landing section. |
| Terraced rails | Two eased steps, with short ledges and rounded transitions. |
| Ripple rails | Two successive undulations along the supporting curve. |
| Ribbed ribbons | Curved bands divided by crossbars. |
| Crystal teeth | Repeated triangular teeth along the outside of the rails. |
| Petal chains | Rounded lobes along the outside of the rails. |

These are six geometry choices, not six independently invented motion solvers.
The first three change the supporting path. The latter three retain supporting
rails and build material-side structures around them. Every emitted edge is a
normal type-0 collision line, present during candidate search and cold replay.
There are no acceleration lines, scenery substitutes, or outlines added after
validation. This does not mean every outline edge is touched on every ride.

The gallery's new visual selectors show actual compiled geometry near the same
second authored beat for the selected passage, allowance and seed. They do not
use illustrations or cherry-picked best runs. Both panels retain synchronized
playback, interval measurements, failure reasons and raw artifact links.

## Qualified measurements

Compiler **4236051f** produced **528 recorded rides**,
including **288 using the six new styles**. **528/528** pass the fixed
timing and survival contract. All **744,840 emitted lines are normal type-0**.
Every track, replay and manifest checksum and every physical-work allowance was
verified. Each new style produced 48 distinct tracks on its 48 inputs;
the full evidence records this count separately for each method.

| Method | Mean at 100k | Valid / 36 | Mean at 250k | Valid / 12 |
| --- | ---: | ---: | ---: | ---: |
| Arcs and guides | 863.38 | 36/36 | 847.32 | 12/12 |
| Scattered · original | 559.52 | 36/36 | 554.71 | 12/12 |
| Scattered · improved | 849.15 | 36/36 | 839.33 | 12/12 |
| Wave curves | 830.06 | 36/36 | 812.91 | 12/12 |
| Faceted curves | 846.73 | 36/36 | 851.41 | 12/12 |
| Serpentine rails | 771.52 | 36/36 | 778.13 | 12/12 |
| Terraced rails | 825.54 | 36/36 | 839.97 | 12/12 |
| Ripple rails | 760.32 | 36/36 | 780.42 | 12/12 |
| Ribbed ribbons | 759.91 | 36/36 | 776.74 | 12/12 |
| Crystal teeth | 866.34 | 36/36 | 865.82 | 12/12 |
| Petal chains | 851.75 | 36/36 | 860.61 | 12/12 |

The 100k column covers six passages × six seeds (201–206); the 250k column
covers six passages × seeds 201–202. Compare allowances using those same twelve
inputs, not by subtracting these differently sized columns. These are research
means, including any zero scores, not benchmark headlines. All new shapes are
visible choices; weaker target adherence is not hidden by an ordinary-arc fallback.

Crystal teeth retain particularly good control on this panel (866.34 at 100k,
versus 863.38 for ordinary arcs); this small difference is not evidence of a
universal advantage. Long quiet endings remain a concrete weakness for ripple
rails: their mean on that passage is 459.65 versus 752.87 for ordinary arcs.
Passing timing and survival does not imply close adherence on every axis.

On the **same twelve inputs** at both allowances, extra search improves
serpentine rails by 30.62 points, terraces by 48.39, ripples by 37.12 and petals
by 16.57. Ribbons lose 5.97 and teeth gain 1.20. These measured differences support
further work on geometry-specific search; they do not justify assuming more
allowance always helps.

The six new styles take about 2.1–3.3 seconds per short ride on average at 100k
in this run. Wall times include warm-up and concurrent work on the shared host;
they are observations, not a controlled speed benchmark.

The unchanged production path remains at **952.4726 on canonical V4**. All
**352/352 tracks, scores, observations, geometry, compiler statistics and physical
frame counts exactly match** the preceding qualified version (176 specifications,
seeds 16/17). All **195 focused tests in 46 files pass**. The TypeScript check
retains the same 251 inherited diagnostics, with no new diagnostics.

See [complete measurements](evidence/motion-gallery-six-20260930.json),
[production parity](evidence/motion-gallery-six-20260930-production.json),
[validation checks](evidence/motion-gallery-six-20260930-checks.json) and
[exploratory findings](evidence/motion-gallery-six-20260930-exploration.json).
Raw tracks, traces, screenshots and large run archives remain local.

## What changed in the implementation

`motion_profiles.ts` defines three tangent schedules. They keep the existing
landing section, global bend control and curvature limit; support length,
entry/exit angle, guide extent and clearance remain available to the shared
search. Fixed profile excursions distinguish the styles instead of allowing
search to erase the chosen style completely. The schedules are compact,
concrete geometry definitions; no case names or benchmark identities enter them.

`rail_contours.ts` walks each connected support/guide curve by arc length and
constructs its repeated structures. Binary search locates sampled points.
Ribbon crossbars are emitted once at each boundary, and normal orientation is
chosen deliberately. The complete structure stays intact: guide-only pruning
would tear these shapes, so that reduction is skipped for contour styles.

The common arc compiler accepts a small geometry-options object. Candidate memo
contexts include both profile and contour identity. The same budget meter,
planning, measurement, search and fixed-engine replay apply to all six styles.
There is no fallback that silently substitutes a different geometry. The catalog
in `scripts/gallery/methods.ts` keeps gallery labels and concrete search options
in one place. Unknown method names are rejected, and style presets are typed to
geometry fields rather than budget or scoring overrides. New styles do not introduce specification syntax, mixing rules,
probabilities, or a new scoring function.

## Development findings

Initial experiments tried complete loops, switchbacks and large crescents. They
could not establish feasible initial rides with the current proposals on the
three development passages. Those attempts remain local research evidence,
not shipped dead branches or claims that these geometries are impossible.

Growing outlines around microscopic scattered-contact fragments also failed:
a collection of independently colliding one-sided lines does not behave like a
solid polygon. Adding another face can change the ride even when the supporting
face is preserved. The working structures are therefore built before search
around substantial rails, and the actual geometry is optimized and replayed.

An early ribbon variant's downstream-facing crossbars caught the rider. Giving
those near-perpendicular faces an upstream collision orientation removed the
hard failure in the three-passage probe. A subsequent cleanup accidentally
emitted only the first contour repeat; inspection caught it before qualification.
Regression coverage now checks the entire repeated structure, not only the first
cell or a successful physical replay. That incomplete development dataset is
retained locally and is not the published gallery.

Stronger curve excursions can reduce target adherence substantially, especially
through long quiet endings. Several amplitude/control formulations were tested;
the retained version keeps the ordinary signed bend control independent from the
profile. The measured results below characterize this implementation, not a
ceiling for the geometry. Arc-trained proposals are still used as proposals and
checked in real physics; dedicated proposals for these shapes are future work.

## Reproduce and inspect

Run `npm run dash` and open <http://localhost:8767/motion-gallery/>. Through SSH,
forward port 8767. The default study contains seeds 201–202 at 100,000 and
250,000 physical-frame allowances. The additional-seed link contains seeds
203–206 at 100,000. Both studies use the same six passages and 2% target jitter.

Use a clean compiler checkout and new output directories:

```sh
LR_ENGINE=wasm node --import tsx scripts/gallery/build.ts \
  --compiler-root=/path/to/clean/compiler \
  --out=generated/motion-gallery/my-ten-shapes

LR_ENGINE=wasm node --import tsx scripts/gallery/build.ts \
  --compiler-root=/path/to/clean/compiler \
  --out=generated/motion-gallery/my-ten-shapes-seeds \
  --budgets=100000 --seeds=203,204,205,206

node --import tsx scripts/gallery/summarize.ts \
  generated/motion-gallery/my-ten-shapes/manifest.json \
  generated/motion-gallery/my-ten-shapes-seeds/manifest.json \
  --out=generated/motion-gallery/my-summary.json
```

`--methods=serpentine,terraces,scallops,ribbon,teeth,petals` limits a study to the
new choices. A custom manifest can be opened using `?data=/generated/.../manifest.json`.
The frozen V4 evaluator supplies adherence measurements on these research
passages; their mean is not a canonical V4 headline or a visual-quality score.
Seed 201 informed development; the other seeds extend evaluation. The gallery
shows every result, including failed timing/survival contracts. It remains a
physics playground without music or production-video post-processing. Mixed
styles within one track and artist-controlled usage remain separate experiments.
