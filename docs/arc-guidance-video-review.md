# Arc guidance and planning: production video review

All three production specifications were rendered with the final public
compiler, seed 260908011, jitter zero and the original 1M physics-frame
allowance. [Open the gallery](../archives/arc-guidance-2026-09-08/index.html).

| Video | Video duration | Production score | Single-curve groups / all groups | Lines |
| --- | ---: | ---: | ---: | ---: |
| [Amor na Praia](../archives/arc-guidance-2026-09-08/amor_na_praia_46s/video.mp4) | 46.5s | 795.8006 | 37/79 | 2,905 |
| [Luna Bala](../archives/arc-guidance-2026-09-08/luna_bala_44s/video.mp4) | 44.5s | 794.7926 | 28/76 | 2,752 |
| [Tiki Tiki](../archives/arc-guidance-2026-09-08/tiki_tiki_48s/video.mp4) | 48.5s | 688.2247 | 41/78 | 3,244 |

Group counts include the initial supporting group. Remaining groups have
paired or partial upper guidance; the compiler sets no quota for either.
Every line is normal type 0. The production scores use the production metric,
not the canonical V2 headline. Tiki's metric is slightly below the earlier
arc review's 690.8831, so this is not an improvement in every production score.

All videos are 1080×1920, 60 fps, H.264 with stereo AAC music. Rendering uses
the full existing production pipeline: camera zoom 1.8, beat punch 70,
spectrum, overlays and locked effects (CRF 16). Each whole file decodes without
error; the archived validation includes ffprobe output and SHA-256 hashes.
All tracks reach the end, have zero off-beat landings, and pass physical
contracts. All three have zero standing time, below the unchanged 2% creative
selection floor. These are complete review renders, not passing creative
selection candidates. No production settings or selection floors were changed.

Actual rendered frames at 12 and 30 seconds were inspected in each video.
They show long connected supporting arcs, with upper guidance retained where
used. Those frame checks and whole-file decoding are not a claim that the
entire videos have been watched. Posters are actual 12-second video frames.
The [previous paired-arc gallery](../archives/arc-motion-2026-09-08/index.html)
remains available for comparison.

## Reproduction and provenance

For each production ID in the table, use the existing review command:

```sh
LR_ENGINE=wasm node --import tsx scripts/produce/arc_review.ts --compiler=public --song=amor_na_praia_46s --out=archives/arc-guidance-2026-09-08/amor_na_praia_46s
```

The source compiler is commit `6f71b4d8`; renders were executed from
`173cd5b8`, which only adds a type annotation to the review runner.
The compiler fingerprint is
`05a89447ceabbadec189d0222b03ad4f53c44918709ca2d4a3137865a5b7c55d`,
the same implementation subsequently promoted as arc-guidance-planning.
Per-song `review.json` binds source hashes, spec, audio, track, report,
budget telemetry, render settings and output video. Its `researchOnly` flag
identifies the review workflow; `options.compiler` is `public`.

`archives/arc-guidance-2026-09-08/` preserves the original nested render
bundles and adds direct video paths. It also contains authored production
inputs, exact source snapshot, research evidence, manifest and `SHA256SUMS`.
The files are stored locally and have not been uploaded or published.
See the [campaign record](arc-guidance-planning-campaign.md) and
[validation index](../benchmark/v2/studies/arc-guidance-planning-validation.json).
