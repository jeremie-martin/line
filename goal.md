# Goal: stronger trajectory shaping with varied coherent arcs

Active continuation, 2026-09-08: the owner approved an ambitious next campaign
on completed-track refinement, selective longer-horizon planning, expressive
coherent arc geometry, and useful older proposal/difficulty/budget mechanisms.
Study the earlier whispers and diminishing returns as evidence, while remaining
free to redesign the approach. Preserve 744.5 as the reference and measure
actual progress across the full fixed suite and higher budgets. Continue video
review; broader aesthetic objective design is deferred for discussion.
Work branch: `codex/arc-refinement`. Research: `docs/arc-refinement-campaign.md`.

The previous milestone is complete:
**Arc-guidance-planning is promoted at 744.5000**, up **56.9898** from the
preserved 687.5102 arc compiler. The complete 44-case Benchmark V2 development
suite passes **352/352 canonical runs**, eight seeds (16–23), within the
unchanged 750k actual physics-frame allowance. All three full production
videos are generated and archived.

## Owner requirements

Use only normal type-0 Line Rider lines and coherent, visible physical arc
primitives. The owner rejected constellations of tiny point controls.
Arc shape, variety, parameterization and planning may evolve; isolated controls
disguised by decorative curves do not satisfy this requirement.
The benchmark, scorer, authored targets, catalog, weights, validity rules,
physics and compute accounting remain fixed.

Within those requirements, compiler research remains open: geometry, planning,
feedback, search, models and architecture may all change. Earlier workflow
closures, deferrals and study caps are historical evidence, not restrictions.
Research compute is unrestricted; accepted compilers must earn their results
inside the measured execution budget. Use full production videos to assess
appearance alongside numerical quality.

The owner welcomed paired arcs but asked for less repetitive geometry without
hardcoded motifs, quotas or special cases. Praise for an effect is not a
request to prescribe its frequency. Single arcs, partial guidance and full
pairs should follow from geometry and measured physical need.

## Delivered work

1. **Causal reduction.** Audited all 4,100 upper rails of the reference.
   The final compiler removes unused guidance and shortens unused ends while
   preserving substantial contiguous curves. A complete frozen-judge replay
   must reproduce the original trajectory exactly. Across the final suite,
   952 upper rails disappear, 2,969 become shorter, and upper-rail length falls
   59.48% without changing the planned motion.
2. **General geometry.** Added guide clearance and coverage to the common
   smooth-curve representation; tested single, partial, full and joint shape
   refinement. The strongest measured version searches clearance and uses
   causal reduction for coverage. No source-ID dispatch or variety quota.
3. **Planning across beats.** Simulate candidate continuations before committing
   the current arc, evaluate the terminal arrival, reuse useful next curves,
   and retain viable continuations during recovery. Deeper trees were tested;
   the selected implementation plans one future interval within the allowance.

Qualification passes **120/120**. A separate search-target-jitter study passes
**176/176 distinct tracks**, versus 175/176 for the reference. The 250k standing
reading passes 528/528 with score parity. Two whole tracks match the published
JavaScript engine exactly, and all 22 focused tests pass.

The zero-jitter canonical repetitions produce 44 distinct tracks, not 352
independent robustness samples. Two development cases regress in score.
At 150k, six failures are inherited unchanged from the reference. The default
search plateaus at 745.0343 between 1M and 3M. The videos pass physical contracts
but miss the unchanged 2% standing-time creative floor. These remain useful
research directions; this milestone does not establish a performance ceiling
or completion of every aesthetic ambition.

## Saved result

- [Full vertical video gallery](archives/arc-guidance-2026-09-08/index.html)
- [Current campaign and limitations](docs/compiler-improvement-campaign.md)
- [Experiments and reproducible evidence](docs/arc-guidance-planning-campaign.md)
- [Video review and provenance](docs/arc-guidance-video-review.md)
- [Validation index](benchmark/v2/studies/arc-guidance-planning-validation.json)

Work branch: `codex/arc-guidance-planning`; compiler source: `6f71b4d8`.
Preservation branch: `archive/arc-guidance-planning-744`.
The earlier arc result remains on `archive/connected-arc-feedback-687`, the
normal point proof on `archive/normal-motion-feedback-662`, and the acceleration
proof on `archive/native-motion-feedback-761`, with their original video archives.
The current archive contains videos, authored inputs, source snapshot, research
records, validation and checksums. It is stored locally; nothing was published.
