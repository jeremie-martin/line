# Arc 850 production review videos

All three full vertical videos are generated from the promoted **852.1248**
compiler, measured commit `5c397b51da11ac42422af6504ad8db1ff4042719`. Open the local
[video gallery](../archives/arc-850-852/index.html).

| Production | Video | Production score | Physical frames | Single / paired curve groups |
| --- | --- | ---: | ---: | ---: |
| Amor na Praia | [46.5s MP4](../archives/arc-850-852/amor_na_praia_46s/video.mp4) | 915.0055 | 938,315 | 9 / 70 |
| Luna Bala | [44.5s MP4](../archives/arc-850-852/luna_bala_44s/video.mp4) | 902.9911 | 937,366 | 24 / 52 |
| Tiki Tiki | [48.5s MP4](../archives/arc-850-852/tiki_tiki_48s/video.mp4) | 822.5694 | 961,336 | 15 / 63 |

These production-specification scores use the original **1M** allowance and seed
`260908011`. They are separate from the canonical 750k benchmark headline.
All three reach the end, pass the track contract and have zero off-beat contacts.
Every physical line is normal type 0; each interval group contains one or two
substantial connected curves.

The complete scaffold was used: source music, physical replay, camera, portrait
1080×1920 at 60fps, spectrum, zoom 1.8, beat punch 70%, and the locked production
post-processing recipe with H.264/AAC and CRF 16. All files pass full decode
validation. Frames at 12s and 30s in each video were visually inspected; coherent
arcs, the rider, spectrum and effects are present. This is sampled-frame review,
not a claim of watching every frame or assessing musical motion throughout.

All three have **0% standing time**, below the original 2% creative-selection
floor. They are complete review renders, not creative-selection passes.
`review.json` binds the compiler files, model, track, report, telemetry and video.
Production inputs, sample frames, posters and the gallery are stored locally.

Two initial concurrent Remotion overlays crashed; Luna reported insufficient
browser resources. Failed logs are retained in `render-failures/`. Both were
successfully rerendered sequentially with `LR_REMOTION_CONCURRENCY=4`, preserving
the locked visual recipe. `render-recovery.json` binds the renderer change and
execution limit. Tiki Tiki's original render succeeded. The compiler outputs
were reused and remained identical throughout the rendering recovery.

Code, compact benchmark evidence and the preservation index are pushed. Large
research and video archives remain local in `archives/arc-850-852/`.
