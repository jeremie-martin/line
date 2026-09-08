# Arc 825 production review videos

All three full vertical review videos are generated with the promoted 828.1228
compiler at commit `eafc32a51a6dfa0a881d38bef96feb2a40c5cc4f`.
Open the local [video gallery](../archives/arc-825-828/index.html).

| Production | Video | Production score | Physical frames | Single / paired curve groups |
| --- | --- | ---: | ---: | ---: |
| Amor na Praia | [46.5s MP4](../archives/arc-825-828/amor_na_praia_46s/video.mp4) | 894.4229 | 940,678 | 14 / 65 |
| Luna Bala | [44.5s MP4](../archives/arc-825-828/luna_bala_44s/video.mp4) | 863.4771 | 937,848 | 27 / 49 |
| Tiki Tiki | [48.5s MP4](../archives/arc-825-828/tiki_tiki_48s/video.mp4) | 811.1092 | 960,064 | 18 / 60 |

These are production-specification scores at the original **1M** allowance,
seed `260908011`, rather than 750k canonical scores. All three reach the end,
pass their track contracts, and have zero off-beat contacts. All geometry is
normal type 0, with one or two substantial connected curves per interval group.

The entire rendering scaffold was used: source music, replay, camera, portrait
1080×1920 at 60fps, spectrum, zoom 1.8, beat punch 70%, and the locked production
post-processing recipe (H.264/AAC, CRF 16). Full files pass decode validation.
Frames at 12s and 30s in every video were visually inspected: the rider and
coherent arcs are visible, and the spectrum and effects are present. This is
sampled-frame review, not a claim of watching every frame or evaluating musical
motion quality throughout each video.

All three have **0% standing time**, below the original 2% creative-selection
floor. They are complete review renders and are not presented as creative-selection
passes. Their `review.json` files bind compiler files, model, track, report,
budget telemetry and video hashes. Production inputs, sample images and the
gallery are stored with the videos in the local `archives/arc-825-828/` folder.
Large videos and raw research stay local; source and compact evidence are pushed.
