# Normal-line compiler production videos

All three production specifications were rendered on 2026-09-08 with the
current `normal-motion-feedback` compiler, whose benchmark headline is
662.5889. These are previews before the requested arc redesign. The geometry
still consists of tiny type-0 segments; they do not establish visual acceptance.

Open [the video gallery](../archives/normal-motion-feedback-2026-09-08/index.html).
The archive README provides direct MP4 links and reproduction notes. Original
outputs remain under `generated/reviews/normal-motion-2026-09-08/`.

| Production specification | Video duration | Normal segments | Production score |
|---|---:|---:|---:|
| Amor na Praia | 46.5s | 4,343 | 667.25 |
| Luna Bala | 44.5s | 3,948 | 655.87 |
| Tiki Tiki | 48.5s | 5,199 | 612.97 |

Every video is H.264, 1080×1920, 60 fps, with AAC music. Rendering uses the
existing Playwright ride exporter, action camera at zoom 1.8, 70% beat punch,
−15 ms jolt, spectrum overlay, and locked Remotion post-processing (CRF 16).
All videos pass full decoding without errors and format checks. Checksums
cover the completed videos, compilation records, reports, and archive assets.
Representative rendered frames were inspected for framing and overlays.

All three tracks use only normal type-0 geometry and pass the physical
production contract. These explicitly requested previews record creative
selection floors without suppressing renders: each fails the standing-time
floor, and the per-production score floors may also fail. Production scores
in the table are not Benchmark V2 headlines. Production selection settings,
the compiler, renderer, benchmark, and scoring were not changed.

The seed is 260907010 for every song, matching the acceleration previews, at
the original production budget of 1,000,000 frames. The compiler is preserved
on `archive/normal-motion-feedback-662` at `a02315e2`, with its accepted
snapshot and benchmark evidence retained. The review harness gained only a
configurable project label so normal previews are labeled correctly.

```bash
LR_ENGINE=wasm node --import tsx scripts/produce/review.ts \
  --out=generated/reviews/normal-motion-2026-09-08 \
  --project=normal-motion-review --seed=260907010
```

[The checksummed review index](../benchmark/v2/studies/normal-motion-production-review.json)
records compiler identity, per-song measurements, line types, and MP4 hashes.
The archive also retains source music, specifications, settings, tracks,
reports, compiler snapshot, and render provenance. Nothing was uploaded or
published. Arc-based compiler work remains outstanding under the corrected
requirements in `goal.md`.
