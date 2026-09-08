# Compiler improvement campaign

Owner feedback, 2026-09-08: the point-like geometry is visually unacceptable.
Future work must recover coherent physical arcs using normal lines, while
retaining useful planning and feedback ideas. Arc shapes and controls may
evolve; benchmark and scorer remain fixed. Full production video review is
part of assessing that objective. The current normal-motion previews are complete. Active arc work is on
`codex/arc-motion-650`; see [the research record](arc-motion-650-campaign.md).
The connected-arc candidate reaches 687.5102 in the 44-case discovery panel,
with every case valid. Integration and canonical verification are underway;
no arc candidate has been promoted.

The earlier normal-line above-650 numerical goal is achieved. The active 750k
Benchmark V2 headline is **662.5889**, promoted as `normal-motion-feedback`, with
**352/352 valid runs** across all 44 development cases and eight seeds (16–23).
All accepted output uses **normal type-0 lines**. The benchmark, scoring,
validity rules, physics, and compute accounting are unchanged.

The governed comparison accepts at the existing N=8 look: **+55.3569 paired
points**, SE **0.9294**, t=59.5620 versus the required 4.8106. The matching
old-baseline prefix scores 607.2320; its previous promoted N=32 headline was
607.2582. N=48 was the declared maximum, not the executed sample size. The new
cache retains the accepted N=8 prefix. No forced acceptance was used.

## Compiler change and validation

The compiler plans authored motion and constructs ordinary collision planes
from observed solver positions. Physical normal projections steer motion and
pose; small tilts prevent a plane intended for one rider point from collapsing
another aligned point. Actual simulation, contact checks, and short backtracking
select the geometry. A complete physical continuation can finish the track
without unnecessary support search after the last impact window.

The output consists of many small **normal-line segments**. This is a different
construction style from the old catch templates; the score alone does not
establish a visual preference. Every completed track must exactly match a cold
replay with the frozen judge. All simulation, including failed proposals and
continuations, is charged. Canonical compiles use 60,775–238,882 frames each,
median 122,733.5, within the actual 750k budget.

| Validation surface | Result |
|---|---|
| Canonical development, 44 × 8 at 750k | 662.5889; 352/352 valid; accepted and promoted |
| Standing 250k reading, 11 × 48 | 528/528 valid versus 465/528; 63 rescued, zero lost |
| Qualification, 5 × 8 × three budgets | 120/120 valid; monitor 644.8292 |
| Budget range, three sources at 150k/750k/1M/3M | 12/12 valid and within budget; 1M/3M outputs match 750k |
| Published JavaScript-engine replay, two full tracks | Exact full trajectories and events; both track hashes match all eight canonical outputs |

The 250k subset aggregate is 670.9793 versus 552.3198; it is not the suite
headline. Its arithmetic per-cell paired gain is 191.6936 (SE 4.9870).
The old baseline arm was reused with verified identity and checksums, saving
528 duplicate compiles. Qualification uses the frozen candidate with no tuning;
its monitor scores are 645.8415 / 646.4513 / 641.4508 at 250k / 500k / 750k.
These monitors do not change the deferred lower-budget governance fields.

All four canonical strata improve. **Fourteen individual source averages
regress**, led by impact Believer (−183.5657), its amplitude variant (−162.1426),
and the two off-grid conversation cases (about −85). All remain valid. Speed
and amplitude control, and preserving the old compiler's strongest cases,
remain useful future improvement directions.

Twelve focused integration/identity/CLI tests, 61 broader optimizer/budget tests,
seven post-completion-fix compiler/CLI tests, and the normal-projection physical
regression test pass. Suites overlap. Repository-wide TypeScript checking retains
unrelated existing failures; none points to the final normal-motion production
files or audit scripts. The baseline analysis is refreshed from the exact
promoted prefix.

## Preserved acceleration work and videos

The acceleration compiler's **761.9107** result is shelved on
`archive/native-motion-feedback-761` (`7cb77df1`). Its complete production review
is on `codex/native-motion-video-review` (`f8996b76`). All three requested videos
are complete: Amor na Praia, Luna Bala, and Tiki Tiki, each with full vertical
1080×1920 / 60 fps production rendering, music, camera, overlays and post-effects.
Nothing was uploaded or published.

The durable local archive is
`archives/native-motion-feedback-2026-09-07/`: open `index.html` for the video
gallery, or `README.md` for direct links. It retains the videos, compiler outputs,
original song audio, source archive, frozen judge, benchmark evidence, and file
checksums. [The video record](native-motion-video-review.md) explains the creative
selection settings used for these explicitly requested previews.

## Reproduction

- Active branch: `codex/normal-line-650`, checked out in `/home/wyss/line`.
- Final compiler commit: `06680c3c`.
- Candidate: `3ce6b356f9bcd18041e8e0818fd727683019f14859ca6144922c570f24eab1e1`.
- Source: `2149de41ba31b88500eabc8cfd5ccf8d83123339722b0ffa3e9f1dad7ec9944f`.
- [Active manifest](../benchmark/v2/campaign-baseline.json) and
  [checksummed validation index](../benchmark/v2/studies/normal-motion-feedback-validation.json).
- [Current baseline analysis](benchmark-v2-current-baseline-analysis.md) and
  [detailed campaign](normal-line-650-campaign.md).

The retained comparison, request, compiler snapshot, and canonical archive are
under `benchmark/v2/runs/normal-motion-feedback-*`. `npm run benchmark -- status`
verifies the active reference and current committed compiler identity.

## Normal-line video review — 2026-09-08

All three production specifications now have complete vertical videos from the
current normal-motion compiler, with the same seed and full production effects
as the acceleration previews. [Open the normal-line gallery](../archives/normal-motion-feedback-2026-09-08/index.html)
or [read the verification record](normal-motion-video-review.md). The compiler
is preserved on `archive/normal-motion-feedback-662` at `a02315e2`.
These previews still use point-like normal segments; the requested arc-based
visual objective remains outstanding. Benchmark and compiler are unchanged.
