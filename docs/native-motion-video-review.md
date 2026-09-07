# Preserved acceleration compiler and production videos

The owner requested these full production renders before returning to normal
lines. All three are complete and verified on 2026-09-07. The compiler is
preserved on `archive/native-motion-feedback-761` at `7cb77df1`; the production
review tooling and this index are on `codex/native-motion-video-review`.

The durable local package is `/home/wyss/line/archives/native-motion-feedback-2026-09-07/`.
Open its `README.md` for video links. It contains the videos and their track,
report, budget, configuration/provenance, and decode-validation records, plus
the compiler source archive, frozen judge, accepted benchmark evidence,
qualification, and lower-budget records. The original production pipeline
outputs remain under `generated/reviews/native-motion-2026-09-07/`.

| Production specification | Video | Native acceleration segments |
|---|---|---:|
| Amor na Praia | 46.5 seconds | 62,086 |
| Luna Bala | 44.5 seconds | 52,477 |
| Tiki Tiki | 48.5 seconds | 72,833 |

All videos are 1080×1920 at 60 fps, with AAC music, the authored action camera,
beat punch, spectrum overlay, and the existing locked post-processing recipe.
The full videos decode without errors and their SHA-256 hashes are retained.
A rendered frame was also inspected for the rider, framing, and overlays.

These are requested visual review examples. Their zero sustained stand time
fails the existing creative selection floor, so the review harness renders
valid tracks directly through `renderBundle` and records the failed creative
gate. It does not modify production selection settings. The dense, finely
placed acceleration geometry is visible in the videos; the benchmark result
does not establish that this visual style is preferred. Nothing was uploaded
or published.

Reproduce on the video-review branch:

```bash
LR_ENGINE=wasm node --import tsx scripts/produce/review.ts \
  --out=generated/reviews/native-motion-2026-09-07
```

The review command verifies saved compiler outputs and completed video hashes
on resume. The active above-650 campaign continues separately on
`codex/normal-line-650`, using normal type-0 lines only.
