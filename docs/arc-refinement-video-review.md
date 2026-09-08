# Arc refinement: full production video review

All three production specifications use the promoted public compiler at the
original 1M actual-frame allowance and seed 260908011. Each is a full vertical
render through the existing production pipeline.
[Open the gallery](../archives/arc-refinement-2026-09-08/index.html).

| Video | Duration | Production score | Single-curve groups / all groups | Actual physics frames |
| --- | ---: | ---: | ---: | ---: |
| [Amor na Praia](../archives/arc-refinement-2026-09-08/amor_na_praia_46s/video.mp4) | 46.5s | 852.6109 | 26/79 | 908,902 |
| [Luna Bala](../archives/arc-refinement-2026-09-08/luna_bala_44s/video.mp4) | 44.5s | 804.9057 | 38/76 | 903,789 |
| [Tiki Tiki](../archives/arc-refinement-2026-09-08/tiki_tiki_48s/video.mp4) | 48.6s | 753.6612 | 29/78 | 919,914 |

Production scores are the unchanged production metric, not the Benchmark V2
headline. The prior videos scored 795.8006, 794.7926 and 688.2247 respectively.
Each new track reaches the end, has zero off-beat landings and passes its
physical contract. Every line is normal type 0. Curves remain contiguous,
with one support and optional partial or full upper guidance per beat group.
The compiler imposes no quota for single curves or pairs.

All three videos fully decode without errors. They are 1080×1920 at 60 fps,
H.264 with AAC music, using the original camera zoom 1.8, beat punch 70,
spectrum, overlays and locked post-processing at CRF16. No authored production
specification, audio, render setting, selection floor or scoring rule changed.
Amor and Tiki have zero standing time; Luna has 1.6292%. All three miss the
unchanged 2% creative floor;
these are review renders, not passing creative-selection candidates. Broader
motion-quality and aesthetic objective design remains for owner discussion.

Actual video frames at 12 and 30 seconds were inspected for all three outputs.
The reviewed frames show continuous supporting curves, including single arcs
and partial upper guides. Posters are unaltered 30-second video frames. Whole-file
decoding and these frame checks do not mean the entire videos were watched.
The [previous gallery](../archives/arc-guidance-2026-09-08/index.html) remains
available for side-by-side review.

## Reproduction and preservation

```sh
LR_ENGINE=wasm node --import tsx scripts/produce/arc_review.ts --compiler=public --song=amor_na_praia_46s --out=archives/arc-refinement-2026-09-08/amor_na_praia_46s
```

Repeat for `luna_bala_44s` and `tiki_tiki_48s`. The preserved branch is
`archive/arc-refinement-767`; the compiler integration is commit `ddcc679c`.
Each `review.json` records the actual render commit and binds compiler modules,
the frozen learned model, authored input, audio, report, track and output video.
The compiler source fingerprint is
`36ba7724f3d734de63979859d6b88f0ed19c1918bdb0c96fae251a4444bb87bb`.

The archive contains direct videos, original render bundles, input tracks and
reports, production inputs, accepted and reference compiler snapshots, the
frozen judge, model training and validation evidence, all research trials,
a manifest and `SHA256SUMS`. Files are stored locally; nothing was uploaded or
published. See the [campaign record](arc-refinement-campaign.md) and
[validation index](../benchmark/v2/studies/arc-refinement-validation.json).
