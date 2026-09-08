# Goal: coherent normal-line arcs above 650

Status, 2026-09-08: the numerical objective and full video deliverables are
complete. **Connected-arc-feedback is promoted at 687.5102**, with **352/352
valid canonical runs** across the complete 44-case Benchmark V2 development
suite and eight seeds (16–23), under the actual 750k frame budget. The owner
has reviewed the videos and welcomes the paired-arc appearance; further
performance and visual variety remain open research directions.

## Owner requirements

Use only normal type-0 Line Rider lines and coherent, visible physical arc
primitives. The owner rejected the constellation of tiny point controls.
Arc shape, variety, parameterization and control may evolve; isolated controls
merely disguised by decorative curves do not satisfy this requirement.
The benchmark, scorer, authored targets, catalog, weights, validity rules,
physics and compute accounting remain fixed.

Within those requirements, compiler research remains open: geometry, planning,
feedback, search, models and architecture may all change. Earlier workflow
closures, deferrals and study caps are historical evidence, not restrictions.
Research compute is unrestricted; accepted compilers must earn their results
inside the measured execution budget. Use full production videos to assess
appearance alongside numerical quality.

In the subsequent video review, the owner welcomed the curved guidance and
impacts, while questioning the repeated use of two rails at every beat.
Preserve general geometry and measured physical feedback. Explore when a
single arc, a shorter upper guide, or a full pair is useful, without treating
praise for an effect as a request to repeat it. Performance research can
precede broader variety work. See the [review notes](docs/arc-motion-video-review.md)
for the distinction between current design choices and proposed experiments.

## Delivered result

The compiler controls real connected curve pairs with measured feedback,
bidirectional turns, arrival planning and backtracking. Removing the upper
rail changes the physical trajectory and ejects the audited rider; it is not
scenery. Full published-engine replay and budget checks pass.

All three production specifications have full vertical 1080×1920 / 60 fps
videos with music, camera, overlays and locked post-processing. Their tracks
and reports exactly match the final compiler. The archive retains source,
inputs, tracks, reports, validation and checksums. Nothing was published.

- [Video gallery](archives/arc-motion-2026-09-08/index.html)
- [Current campaign and known limitations](docs/compiler-improvement-campaign.md)
- [Experiments and evidence](docs/arc-motion-650-campaign.md)
- [Validation index](benchmark/v2/studies/connected-arc-feedback-validation.json)

Work branch: `codex/arc-motion-650`; final compiler source: `affc8efd`.
The acceleration proof of concept remains on `archive/native-motion-feedback-761`
with its complete video archive. The normal point-control proof remains on
`archive/normal-motion-feedback-662`, also with all three original videos.

Qualification passes 120/120 and the 250k reading passes 528/528, though its
scores remain weaker than the point-control compiler. One 150k pickup stress
case still fails. The three review videos miss the standing-time creative
floor; that floor was not changed. Further aesthetic and low-budget improvement
remain worthwhile, without diminishing the completed above-650 arc milestone.
