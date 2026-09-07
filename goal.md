# Normal-line compiler improvement goal — achieved

Raise the active 750k Benchmark V2 headline above 650 using only normal Line
Rider lines (type 0). Acceleration lines (type 1) are excluded from this campaign.
The owner added this constraint on 2026-09-07 because normal-line tracks are
preferred aesthetically. The benchmark, score, authored targets, catalog,
weights, validity, physics, and compute accounting remain fixed.

All other compiler directions remain open: new geometry, different contact
representations, kinematic planning, joint multi-contact and whole-track
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
The normal-line objective is now achieved: `normal-motion-feedback` is promoted
at **662.5889**, with 352/352 valid canonical runs at 750k/N=8. The paired gain
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

The active implementation branch is `codex/normal-line-650`, now checked out
in `/home/wyss/line`. The separate `/home/wyss/line-normal` checkout is detached
at the validated discovery implementation. All three acceleration videos are
complete and preserved with code and evidence in
`archives/native-motion-feedback-2026-09-07/`. The current research record is
`docs/normal-line-650-campaign.md`.
Keep the concise campaign current, preserve comparable evidence, and continue
under any future goal; this above-650 objective is achieved and verified.
