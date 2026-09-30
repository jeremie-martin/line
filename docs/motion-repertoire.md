# Motion gallery and measured construction

The product is visually interesting tracks synchronized to the authored music.
The score measures adherence, not whether a video looks good. The current task
starts with concrete examples and measurements; it does not introduce a geometry
plug-in framework, motion motifs, style quotas, or new specification controls.

## Current gallery

The [Arcs & facets guide-choice experiment](http://localhost:8767/motion-gallery/?data=/generated/motion-gallery/20260930-guide-coverage/manifest.json)
now makes one artistic preference explicit: prefer fewer guided sections, then
shorter visible guides, while keeping measured whole-ride motion error within a
chosen allowance. Its slider selects among a fixed set of recorded alternatives;
it does not run a new search. The comparison menu also exposes both branches of
each physical fork, including unsuccessful searches. The gallery starts at zero
additional error; no production tolerance has been selected.

The latest [coverage study](guide-coverage-2026-09-30.md) compares the previous
balanced search with a focused two-path search on nine passages, eight fresh
seeds, two allowances and both arcs and facets. At 900,000 frames, the focused
search lowers mean error under a half-guide cap by 16.35% for arcs and 8.38% for
facets at essentially unchanged actual work. Best accuracy is nearly unchanged.
Other guide limits regress, and the three new passages show mixed transfer.
Focused coverage remains an explicit research option; production is unchanged.

The gallery contains all nine passages at seeds 271/272, with 1,288 recorded
attempts and one visible failed continuation. The Geometry selector preserves
the playhead. Changing geometry changes the available alternatives and their
best measured error; the slider's ceiling is relative to that selected pool.
The report uses common absolute error ceilings within each shape when comparing
search algorithms. Those are different comparisons.

Both searches start with independently optimized guided and unguided rides,
then keep two promising continuations while charging all work to the same
total allowance. The [preceding evaluation](guide-search-2026-09-30.md) covers
six passages × eight seeds × two ceilings. At 900,000 frames, mean best target
error falls 8.59%; at a common baseline-best +0.020 ceiling, mean guided sections
fall from 3.479 to 2.229. Some comparisons regress, particularly at intermediate
guide limits. These results improve the available choices without defining a
geometric ceiling or changing production. The
[preceding two-path gallery](http://localhost:8767/motion-gallery/?data=/generated/motion-gallery/20260930-guide-search/manifest.json)
contains seed 241 from that panel; the complete measurements are in the report. The
[original four-seed gallery](http://localhost:8767/motion-gallery/?data=/generated/motion-gallery/20260930-guide-intent/manifest.json)
remains available.

In plain terms: if the best valid recorded track has target error **0.030** and
the slider allows **0.010** extra, the selector considers valid tracks with
error at most **0.040**, then chooses the fewest guided sections, followed by
the shortest total guide length. It selects an entire measured track; it does
not strip rails until a threshold is reached. At zero allowance it retains the
best accuracy found in that pool. Timing and survival must still pass.

“Target error” is the compiler's existing normalized whole-ride RMS objective
over air, speed, amplitude and impact. It is neither additional physical motion
nor benchmark points, and an aggregate ceiling does not bound every individual
beat's error. This gallery preference is separate from production's early-stop
tolerance described below. Both guided and unguided search can improve; the
current tradeoffs are provisional. Fewer guides are an explicit preference in
this experiment, not a general definition of beauty. Other geometries need
their own concrete comparisons before assuming the same preference applies.

An optional **Inspect rail contacts** view now identifies guide rails and
actual collided segments, with buttons to jump between guide-contact frames.
A separate [single-versus-paired study](motion-gallery-guidance-2026-09-30.md)
contains 144 matched rides, including 48 independently searched without guides.
All pass timing and survival; guides improve average adherence, while single
rails outperform them on most quiet-tail comparisons. These are measured
search results, not geometric capability ceilings or automatic style rules.

The shape gallery focuses on eight functional geometry choices: arcs with trimmed
or full paired guides, improved scattered segments, waves, facets, serpentine
rails, terraces and ripples. The original scattered controller remains an
additional comparison. Ribbons, teeth and petals are archived as optional
contour experiments. The gallery now uses native Line Rider line rendering
and Bosh artwork, including the scarf, with verified playback and synchronized
scrubbing. See [the functional rails and rendering report](motion-gallery-native-2026-09-30.md).

The [six-shape report](motion-gallery-six-shapes-2026-09-30.md) preserves the
preceding experiments; [the four-shape report](motion-gallery-expansion-2026-09-29.md)
preserves the scattered reconstruction studies. Normal lines remain mandatory;
the production compiler still defaults to coherent arcs.

### Playback and loading

Changing seed, search allowance, style or the accuracy allowance preserves the
playhead and play/pause intent within the same passage. Playback waits for the
new verified pair, then resumes if it was playing; loading time does not advance
the ride. Changing passage resets the playhead. Selecting a particular guide
fork pauses at its boundary for inspection. Pause remains available while a
replacement loads. Old panels and beat controls are cleared during loading so
they cannot appear to describe the newly selected input.

The selected pair loads before shape previews. Superseded downloads are aborted;
queued native replays are cancelled, and an active obsolete replay's worker is
terminated. Only successfully checked artifacts and replay results are cached.
Identical left/right selections share their load and native replay. A visible
retry button recovers comparison failures, including temporary track downloads,
artwork failures and worker errors; preview failures have a separate retry.
Existing thumbnails are retained when only the selected style changes.

These changes address reproduced failures where switching seed stopped playback
and reset time, and one HTTP 503 poisoned the download cache for subsequent
attempts. Browser regressions also inject delayed downloads and a stuck worker,
exercise rapid seed changes, and check pause intent during loading. Run them
against the local studies and dashboard with:

```sh
npm run gallery:renderer
node scripts/gallery/check_interactions.mjs \
  --out=generated/gallery-interactions/checks.json
```

The [compact validation record](evidence/gallery-interactions-20260930.json)
also records 648 native replays with zero body-position error, 216 shape
comparisons, 144 preference selections, and 204 physical-fork inspections.
No compiler search, benchmark or physics behavior changed in this repair.

## Behavior contract for guide choice

The goal is understandable artistic direction with measured adherence and cost.
Adding geometry is paused while the existing main-curve/guide construction is
made explicit. This is a research path, not a new music-specification language.

| Decision | Current meaning |
| --- | --- |
| Shape | The connected main curve and opposing guide are emitted before simulation. Only normal type-0 lines are allowed. |
| Guide permission | A forbidden guide cannot be emitted for the selected support. An allowed guide may be absent, unused, or contacted; permission does not require contact. |
| Search | Both alternatives get the same incoming state, shape, targets, model settings and physics allowance. Each independently searches its geometry and the complete remaining ride. |
| Earlier geometry | Every segment before the selected support is locked. Backtracking and guide trimming cannot alter it. Both branch prefixes must reproduce the source rider state and independent replay history. |
| Continuation | Later supports use the same guide-allowed search in both branches. Their shapes and guide use may differ because the fork changes the arrival state. This is a continuation comparison, not an isolated contact-force experiment. |
| Trimming | Unused guide sections can be removed after replay while retaining coherent curves. This preserves the measured trajectory; it is not a decision that a different unguided solution could not work. |
| Delivery preference | Among valid measured tracks within the explicit error ceiling, prefer fewer guide-bearing sections, then shorter total guide length, then lower error and a stable ID. Contact count is diagnostic, not an aesthetic objective. |
| Failure | Report that an attempt did not find a valid continuation within its allowance. Do not claim physical necessity or impossibility. |

The geometry catalog now stores geometry, guide settings and search overrides
separately. Existing recipes keep their previous behavior. In particular, some
historical shape comparisons disable the preview policy; the old single-rail
recipe also changed `channel`, which then affected initialization as well as
implicit guide clearance. Those comparisons were not pure shape interventions.
Initialization now ignores an inactive channel when guides are explicitly
forbidden; a regression check confirms identical tracks and work. The
paired-fork study keeps preview disabled and channel fixed for **both** branches;
only guide permission changes. Inactive guide search dimensions are removed.

The implementation uses a serialized prefix rather than retaining engine
handles across compilations. The fork boundary is the frame immediately before
the selected support, including startup as section zero. A cold prefix replay
must match the original complete track's full rider state. The compiler checks
that state again, and the gallery harness independently compares every recorded
body-point frame through the boundary. The final complete ride still passes the
unchanged judge. Unsupported combinations that could edit the locked prefix,
such as whole-track refinement, are rejected explicitly for this research API.

The focused exploratory traversal starts from two complete references, one
guide-allowed and one guide-forbidden. At successive supports it compares both
guide permissions from each retained path. It keeps the most accurate track and
an intermediate track that fills the largest measured error gap between the
accurate and sparse endpoints over integer guide-count caps. With no useful
intermediate it follows the sparse endpoint. It reconsiders **all** measured
tracks, and keeps the endpoints available for delivery. This is an exploration
heuristic, separate from the delivery preference. The previous balanced two-path
and original single-path traversals remain available for comparisons. The delivery selector
applies the chosen full-ride error ceiling over the entire fixed pool.
The common budget pays for both reference constructions, all branches, prefix checks
and the compiler's cold replays. Independent gallery observation is recorded
validation work, outside that construction allowance. All continuations use the
same search configuration; per-branch ceilings scale with remaining ride length.

An explicit research option can preserve the source's later guide permissions
while still rebuilding its geometry. Both fork branches share those later
permissions. It is not enabled in the focused gallery; experiments showed mixed
results. The comparison explanation states which continuation policy was used.

The ceiling is the lowest measured whole-trajectory RMS error in that pool plus
the explicit extra allowance. It uses the compiler's existing authored-axis
objective, not a modified benchmark score. Nested eligibility guarantees that
relaxing the allowance cannot select more guided sections. At equal guide count,
length cannot increase; choosing fewer guide sections can still increase total
guide length. Both are visible in the gallery. The controls make no promise
about unsearched alternatives or aesthetic quality. A finite portfolio plateau
is not evidence that a geometry reached its capability ceiling.

The sections below preserve the first gallery's findings and the efficiency work
that preceded this expansion. Its local 48-run dataset remains available through
the explicit historical manifest link in the expansion report.

## What exists

The production compiler builds connected normal-line arcs, with optional paired
or partial guides. Those are variations of the existing arc builder. Construction
methods such as learned proposals and measured search are compiler internals,
not additional artistic primitives.

The scattered normal-segment controller remains in
[`normal_motion.ts`](../scripts/v0/optimizer/normal_motion.ts). It is now exercised
through an explicit research entry point. It is not selected by the production
dispatcher, and no acceleration lines are introduced. Its historical scores do
not establish its capability on current inputs.

## Open the gallery

Run `npm run dash` and open **http://localhost:8767/motion-gallery/**. Through SSH,
forward port 8767 to this machine. The Motion link also appears in the other
dashboards. The generated assets stay local.

The first study compares both implementations on the same four short passages,
three actual-physics allowances (25,000 / 100,000 / 750,000), and seeds 101/102
with 2% target jitter: **48 recorded runs**. The passages are separate from the
frozen benchmark catalog. These two seeds characterize this small study; they
do not establish broad robustness.

The gallery provides synchronized play, pause, scrubbing and slower playback;
a follow camera or whole-track view; authored versus measured interval targets;
and visible scores, failures, geometry counts, physics work and compile time.
It validates artifact checksums and input/compiler identities before displaying
replays. It uses recorded physical rider positions, with interpolation between
40 Hz frames, not invented trajectories. This is a physics inspection view,
without music or final vertical-video post-processing.

To regenerate with the current checkout:

```sh
LR_ENGINE=wasm node --import tsx scripts/gallery/build.ts \
  --compiler-root="$PWD" --out=generated/motion-gallery/my-study
```

Then open `/motion-gallery/?data=/generated/motion-gallery/my-study/manifest.json`.
Use a new output directory after changing compiler, inputs or study code. The
script records the full compiler inventory and frozen judge identity, verifies
all construction work against its allowance, and independently replays each
implementation using the fixed engine. Raw tracks and traces are local;
compact measurements are versioned under `docs/evidence/`.

The score uses the unchanged V4 evaluator on these research passages. It is
**not a V4 headline**. Scattered segments do not satisfy the separate coherent-arc
qualification contract. A physically valid ride can still have very poor target
adherence, which the gallery displays rather than hiding.

## Spend work when the measured result needs it

The old production path always ran general search after a completed preliminary
track. A full validity-only stopping experiment reproduced the earlier
counterfactual: 952.4696 on V4, 352/352 valid, with 96.18% less simulated work.
However, the new gallery exposed a valid preliminary track scoring 598.3382 that
continued search improved to 942.3736 at 100,000 frames. Physical validity alone
is therefore not the production acceptance rule.

Early acceptance now requires both the complete physical contract and a measured
whole-trajectory RMS error no greater than **0.025** in the existing normalized,
weighted target coordinates. Otherwise general search retains its full original
allowance and uses the preliminary measurements as before. This is an explicit
compiler stopping tolerance, not a new scorer, a claim of visual quality, or a
per-case exception. The tolerance is a conservative initial engineering choice;
its cost/quality tradeoff is recorded in the accompanying evidence. Research can
set `previewMaxRmsError`, or use `searchAfterPreview: 'always'` for a matched
comparison. Missing or nonfinite loss cannot qualify for early acceptance.

Every attempt and its cold replays share one actual physics meter. Accepting a
cheap track preserves the declared budget and reports actual work separately.
Model loading, lookup and elapsed time are measured separately from simulation;
a physics-work ratio is never presented as a wall-time speedup.

See the [qualified results and detailed findings](compiler-efficiency-2026-09-29.md)
for the full panel, separate jitter diagnostic, paired timing and gallery scores.

## What the first examples establish—and what they do not

Both implementations can produce complete rides on this small panel. The old
segment controller is fast, but its target adherence is substantially weaker,
particularly on the long quiet tail. Its terminal-continuation shortcut can
accept a surviving trajectory after the last beat even when the remaining speed,
air or amplitude misses the specification. More budget alone does not resolve
that behavior. This is a specific controller limitation to investigate, not
evidence that scattered geometry is inherently incapable of better motion.

The gallery does not yet measure alternating styles within one track, or score
as a function of the fraction of beats allowed to use each style. Those require
working transitions and an actual usage constraint. Introducing probabilities,
preferences or new specification syntax before that experiment would suggest
control we have not demonstrated.

The first expansion improved scattered adherence and added waves and facets.
The six-shape study extends the concrete repertoire. Transitions and mixed styles
remain future experiments; production keeps its qualified arc path. Further
geometry should arrive with real examples and measured limitations.
