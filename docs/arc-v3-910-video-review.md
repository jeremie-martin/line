# Luna Bala: 910 compiler video review

The new [Luna Bala vertical video](../archives/arc-v3-910/luna_bala_44s/video.mp4)
is ready: **44.5 seconds, 1080×1920, 60fps, 13.3 MB**. The local
[comparison gallery](../archives/arc-v3-910/index.html) also includes the previous
852 compiler's Luna review.

This uses the compiler that achieved **910.5248** on canonical V3, measured commit
`f0ca943475ada2b8656a4bfe372a487f734b7cd6`. The render started from
`f2a88b73d6102255908a435411e67330205cf558`; all 132 canonical compiler files match
the measured source hashes. No compiler changes were made for this video.

The original production specification uses seed `260908011`, a 1,000,000-frame
allowance and a −15ms jolt, matching the earlier review. It consumed 927,177
compiler physics frames and scored **905.3429** on the production specification.
This production score is separate from the canonical V3 headline. The rider
reaches the end, passes the track contract and has zero off-beat contacts.

Every physical line is normal type 0. There are 25 single-curve groups and 51
paired-curve groups, including startup: 127 connected curves, no isolated
single-segment components, and a shortest curve of 24.06 world units.

The full existing production scaffold supplies music, physical replay, camera,
spectrum and the locked post-processing recipe. Settings remain zoom 1.8, beat
punch 70%, H.264/AAC and final CRF 16. Remotion ran with concurrency 4. The output
passes full-file decode validation; its stereo audio is non-silent. Final frames
at 8.7s, 12s and 30s were inspected and show the rider, coherent arcs, spectrum
and effects. This is sampled-frame inspection; the owner's judgment of motion
and visual alignment is pending.

Standing time is 0%, below the current production selection floor of 4%. This
requested video is a review render, not a creative-selection pass.

[Compact evidence](../benchmark/v3/studies/arc-910-luna-video.json) binds the
compiler, production inputs, metrics, renderer and final video. The video,
comparison gallery, original inputs, compiler snapshot, telemetry, renderer logs,
sample frames and checksums are preserved locally under `archives/arc-v3-910/`.
Only this document and compact evidence are added to Git.
