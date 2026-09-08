# Arc-based normal-line compiler improvement goal

Owner correction, 2026-09-08: high benchmark scores alone do not fulfill the
project's visual goal. The owner rejected the constellation of tiny segments
in the production previews. Future compiler work must use coherent, visible
arcs as the physical track primitive, with normal type-0 lines only. The arc
shape, variety, parameterization, and control may evolve. Isolated point-like
controls, including controls merely disguised by decorative curves, do not
meet this request. Preserve the motion-planning and feedback ideas where they
help real arc geometry. Keep the benchmark and score unchanged, and use full
vertical production videos to evaluate appearance alongside measured quality.

The 662.5889 result below is a completed numerical milestone, not completion
of this corrected visual objective. The normal-motion previews are complete. The owner has now asked to adapt
the planning and feedback principles to real arcs. Arc-based improvement is
the active task; numerical and visual objectives must both be addressed.

Raise the active 750k Benchmark V2 headline above 650 using only normal Line
Rider lines (type 0). Acceleration lines (type 1) are excluded from this campaign.
The owner added this constraint on 2026-09-07 because normal-line tracks are
preferred aesthetically. The benchmark, score, authored targets, catalog,
weights, validity, physics, and compute accounting remain fixed.

Within the arc-based normal-line requirement, compiler directions remain open:
new geometry, different contact representations, kinematic planning, joint multi-contact and whole-track
optimization, learned models, search architecture, and exact simulation reuse.
Challenge assumptions, collect decisive physical evidence, and improve promising
ideas beyond their first implementation. Earlier closures and workflow limits
are historical evidence, not restrictions or permission requirements. Use the
existing infrastructure where it helps, and work autonomously toward results.
Research compute is unrestricted; the accepted compiler must earn its headline
under the actual 750k budget. Every claimed normal-line output must contain
only type-0 geometry and pass the unchanged full-track replay and scoring.

The starting normal-line reference was `value-ranked-startup-expiration`: 607.2582 at
750k/N=32, with its complete N=48 cache retained. Restoring that reference for
this new constraint is not a new promotion or a score-definition change.
The earlier normal-line numerical objective was achieved: `normal-motion-feedback`
is promoted at **662.5889**, with 352/352 valid canonical runs at 750k/N=8. The paired gain
is **55.3569** (SE 0.9294) against the matching old normal-line baseline prefix.
Qualification passes 120/120 runs; the standing 250k reading passes 528/528 and
recovers 63 old-baseline failures with no losses. All accepted output uses
normal type-0 lines. Benchmark and score identities are unchanged.

Preserve the acceleration result separately: `archive/native-motion-feedback-761`
at commit `7cb77df1` retains the accepted 761.9107 compiler and evidence.
`codex/native-motion-video-review` retains its production video review tooling.
Generate all three full vertical production videos through the existing renderer,
with music, camera, overlays, and locked post-processing. Keep the videos, tracks,
reports, and provenance in `generated/reviews/native-motion-2026-09-07/` for later
viewing. This explicit review request permits acceleration in those preserved
examples only. No upload or publication is requested.

The active implementation branch is `codex/arc-motion-650`, now checked out
in `/home/wyss/line`. The separate `/home/wyss/line-normal` checkout is detached
at the validated discovery implementation. All three acceleration videos are
complete and preserved with code and evidence in
`archives/native-motion-feedback-2026-09-07/`. The current research record is
`docs/arc-motion-650-campaign.md`.
Keep the concise campaign current and preserve comparable evidence. The
above-650 numerical milestone is verified; the arc-based visual objective
remains active.

The requested current normal-motion previews are complete for all three
production specifications, in full vertical format with music and production
effects. They are preserved in `archives/normal-motion-feedback-2026-09-08/`
and indexed by `docs/normal-motion-video-review.md`. These previews precede
an arc redesign and retain point-like geometry. The numerical compiler is
preserved on `archive/normal-motion-feedback-662` at `a02315e2`.
