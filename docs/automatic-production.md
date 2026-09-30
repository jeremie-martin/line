# Automatic musical production

Open [the production library](http://localhost:8767/motion-gallery/production.html)
with `npm run dash`. Choose a song, a seed and broad preferences. The compiler
chooses repeated constructions itself; the manual editor remains available for
advanced inspection. All physical geometry uses normal type-0 lines.

Generate the same kind of artifact from the command line:

```sh
npm run produce:automatic -- --song=luna_bala_44s --seed=101 \
  --budget=3000000 --out=generated/my-production/luna-101
LR_REMOTION_CONCURRENCY=4 LR_ENGINE=wasm node --import tsx \
  scripts/produce/render_repertoire.ts --study=generated/my-production/luna-101
```

A fresh output directory preserves earlier results. `--creative` accepts JSON
with optional `repertoire` (arcs, fold, serpentine, scallops, terraces, scattered),
`variation` in [0,1], and `guidedBalance` in [0,1]. For example,
`--creative='{"variation":0.7,"guidedBalance":0.6}'`. Seed changes the arrangement
independently of musical jitter; increasing budget does not reroll it. Existing
production phrase boundaries are respected. The ordinary startup support is a
structural exception to the chosen repertoire.

The ordinary reference has a separate 750,000-frame allowance, adjustable with
`--reference-budget`. It is a comparison, not a source required by the varied
compiler. Exact cached reference reuse records both its original cost and the
current job's actual work. Automatic production has one allowance covering all
search, reconstruction, failed proposals and compiler verification. Independent
judging and rendering are separate.

Each result saves the actual musical inputs and jolt offset, compiler identity,
creative settings, requested plan, physical realization, budget telemetry, full
track, native rider trajectory and report. The dashboard verifies checksums and
replays the native rider before enabling playback. A complete ride can still miss
a construction request; that distinction remains visible. There is no silent
ordinary-arc substitution or seed search.

Finished videos use the existing 1080×1920, 60 fps production pipeline with music,
camera, overlays and post-processing. Geometry and authored-input identities are
checked again at render time. Partial rides stay inspectable but are not labeled
completed production videos. Functional realization checks are not aesthetic
ratings; artistic approval remains a review of the actual ride.

## Reproduce the review collection

The collection declares seeds 101, 202 and 303 for all four music/specification
pairs before generation. It retains every scheduled outcome.

```sh
LR_ENGINE=wasm node --import tsx scripts/produce/production_library.ts \
  --out=generated/production-repertoire/library --phase=compile --jobs=3
LR_REMOTION_CONCURRENCY=4 LR_ENGINE=wasm node --import tsx \
  scripts/produce/production_library.ts \
  --out=generated/production-repertoire/library --phase=render --jobs=1
```

Compilation resume requires the same declared compiler and harness. Rendering
uses preserved artifacts, and can resume independently. A changed compiler gets
a new collection directory. Large recordings, runs and videos stay local; the
small review index and evidence can be committed. L’amour de ma vie uses the
existing `beats/amour_de_ma_vie_short.mp3` asset (locally linked as
`productions/amour_de_ma_vie_44s/audio.mp3`).
