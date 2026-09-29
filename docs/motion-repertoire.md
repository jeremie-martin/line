# Motion gallery and measured construction

The product is visually interesting tracks synchronized to the authored music.
The score measures adherence, not whether a video looks good. The current task
starts with concrete examples and measurements; it does not introduce a geometry
plug-in framework, motion motifs, style quotas, or new specification controls.

## Current gallery expansion

The gallery now has ten geometry choices: arcs/guides, improved scattered
segments, waves, facets, serpentine rails, terraces, ripples, ribbed ribbons,
crystal teeth and petal chains. The original scattered controller remains an
additional comparison. Visual selectors and synchronized left/right playback
show actual measured geometry. See [the six-shape report](motion-gallery-six-shapes-2026-09-30.md)
for the latest implementation and evaluation; [the preceding report](motion-gallery-expansion-2026-09-29.md)
preserves the scattered reconstruction studies. Normal lines remain mandatory;
the production compiler still defaults to coherent arcs.

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
