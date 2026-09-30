# Deliberate construction on real music — 2026-09-30

The [agreed plan](musical-direction-plan.md) now has concrete examples: complete
Luna Bala and Amor na Praia rides, an intentional guide-free phrase, a faceted
ride, and a local arc–facet–arc phrase. The authored music targets stay fixed.
The [music review](http://localhost:8767/motion-gallery/music.html) compares the
finished production videos and links to the exact same physical tracks in the
native inspector. The owner reviewed the mixed phrase and saw little difference from the
baseline. It is therefore not yet a convincing example of useful visual variety;
this first execution is preserved while a stronger shape change is explored.

## What is intentional, and what is searched

There are two small construction controls in this experiment: whether a support
may have a guide, and how densely its curve is segmented. A guide prohibition
is a hard construction constraint. Permission does not require a guide to remain
in the delivered track. Facets use fewer, longer segments on the same searched
curve; they are physical geometry, not decorative overlays.

The compiler still determines the actual curve and guide parameters through
physical simulation against the requested timing, air, speed, amplitude and
impact. Its learned proposals are candidates, not exemptions from validation.
Production can accept a sufficiently accurate validated proposal early; harder
rides use additional search. Measured guide trimming can remove unused portions
after replay. Consequently, a configured permission, a retained rail and an
actual contact are three different facts. The inspector exposes actual contacts;
none of these measurements alone proves a rail was necessary.

`composeArcSections` is the supported research entry point. It takes a valid
complete reference ride and sparse construction overrides keyed by physical
support index. It preserves the earlier geometry and full rider history, then
searches the changed supports and the complete continuation. Omitted supports
inherit the ordinary smooth-arc settings. The same overrides reach proposals,
lookahead and backtracking. Unsupported refinement/replay routes reject them
explicitly instead of silently ignoring them. No new music-specification syntax,
style distribution, guide quota or automatic music classification is introduced.

The baseline remains available as a separate comparison. It is not an eligible
fallback when it violates a requested construction constraint. Within ordinary
search, completed eligible incumbents survive unsuccessful further attempts.
All search and prefix-preparation work is charged to the alternative's allowance;
shared baseline construction is counted once per four-ride comparison set.

## The examples

| Song | Guide-free phrase | Faceted phrase in the mixed ride | Earlier history fixed through |
|---|---|---|---|
| Luna Bala | Supports 9–12, 6.450–8.600 s | Supports 42–44, 24.400–26.025 s | 6.425 s / 24.375 s respectively |
| Amor na Praia | Supports 4–6, 1.975–3.600 s | Supports 8–14, 4.475–9.125 s | 1.950 s / 4.450 s respectively |

Windows were selected before confirmation, then mapped to existing authored
supports. The page reports their actual achieved contact boundaries, which can
differ slightly from the intended time window. Smooth construction resumes after
the faceted supports; the later trajectory is allowed to differ from baseline.
For example, Luna's three faceted supports have 8, 7 and 8 main segments, with
7, 8 and 6 actual main-rail contact frames. The following smooth support has 47
segments and 7 contact frames. These are interacting physical constructions.
Amor's last faceted support spans the approach to the drop; the support-level edit
therefore ends at 9.125 s rather than the requested window's 7.87 s cutoff.

This is a local construction edit with a rebuilt continuation, not an assertion
that every later frame is unchanged.

The full 44- and 46-second specifications are compiled and independently replayed.
Their production camera settings, audio, authored targets and -15 ms jolt setting
are held constant. The camera follows each actual ride, so its world-space path
can differ. The downloadable excerpts cover Luna 6–38 s and Amor 2–34 s; the player
also offers the full videos, including Amor's earlier introduction.

## Measured quality and cost

The implementation was frozen at `1fb4fd77` after development on Luna seed 301.
Confirmation used seeds 311–313 on both songs, with a 1,000,000 simulated-frame
ceiling per alternative. **All 24 compilations are valid**, with normal lines
only. Their 4,476 compared prefix frames match the reference exactly. Emitted
facet geometry, the return to smooth geometry, guide prohibitions and accounting
were verified independently from the saved tracks and construction records.

Both authored specifications have zero target jitter. The three seeds reproduce
the same track for each song and treatment: **eight distinct rides**, not 24
independent samples. Amor was not used for mechanism development in this milestone;
both songs were already known to the project. This is reuse evidence on two
concrete songs, not a broad generalization claim.

| Song | Construction | Whole-ride RMS ↓ | Simulated frames | Mean compile seconds |
|---|---|---:|---:|---:|
| Luna | Baseline | 0.01232 | 5,417 | 1.25 |
| Luna | Guide-free phrase | 0.01409 | 928,211 | 23.61 |
| Luna | Facets throughout | 0.01602 | 933,782 | 14.66 |
| Luna | Arc–facet–arc | 0.01407 | 709,419 | 17.46 |
| Amor | Baseline | 0.01324 | 934,417 | 25.59 |
| Amor | Guide-free phrase | 0.01368 | 942,967 | 25.79 |
| Amor | Facets throughout | 0.01238 | 937,135 | 15.64 |
| Amor | Arc–facet–arc | 0.01248 | 938,783 | 25.08 |

Elapsed times share a host with other work. Luna's baseline mean includes initial
model loading; its warm runs take roughly a quarter second. The edited Luna rides
are much more expensive than that easy baseline. These examples demonstrate
bounded, usable search, not equal speed or a new speedup. Independent judging,
contact inspection and video rendering are additional work. Physics frames are
the reproducible work measure; wall times are descriptive.

The RMS values use the existing frozen normalized motion objective, with exact
production targets. Production video's legacy overlay score uses its existing
production measurement; it is not the canonical V4 headline. The review page uses
RMS to avoid conflating those scores. No scorer, benchmark or physics changed.

### Local consequences matter

For Luna's 23.4–27 s climax/return window, mixed construction changes mean absolute
impact error from **0.0043 to 0.0087**, with the largest error rising from **0.0071
to 0.0296**. Mean speed error is essentially unchanged; mean air error rises from
0.0148 to 0.0158. Earlier vocal-build and first-drop observations remain identical.

For Amor's 4–9.1 s percussion/return window, mixed construction lowers mean speed
error from **0.0118 to 0.0061** and impact error from **0.0124 to 0.0057**. However,
at the later main drop, impact error rises from **0.0005 to 0.0068**. A whole-track
improvement does not imply that every accent improved.

The guide-free Amor introduction improves local speed error (0.0106 → 0.0053)
while increasing whole-ride RMS slightly. Its rebuilt continuation uses more
guided supports overall, even though the selected introduction has none. That is
consistent with its local instruction; global rail count is not its objective.

Local summaries include complete authored intervals overlapping each window;
they are not newly optimized per-phrase scores. The page shows requested and
achieved values per interval, while the compact evidence preserves axis summaries.
These are measured consequences of the current execution, not ceilings on either
construction's capability or judgments of musical quality.

## Validation and artifacts

The full frozen V4 panel remains **952.4726, 352/352 valid** across 176
specifications and seeds 16/17. Every track hash, score, contact, observation,
diagnostic, geometry record, compiler statistic and physical-work count matches
the previous default run exactly: 46,454,822 simulated frames in total.

Native replay checks cover all 24 records with zero body-position error and
matching collision identities. The full Line Rider app agrees at 2,248 sampled
poses across all eight distinct tracks, including scarf and rider state. All
18 song/seed/alternative video comparisons pass browser checks for playback,
seeking, selection, transient-download recovery and the exact inspector link.
Mobile layout has no horizontal overflow. The 33 focused tests pass; the global
TypeScript check retains the same 251 inherited diagnostics and adds none.

The study manifest and raw replay records live in
`generated/musical-direction-20260930/confirmation/`. Complete production videos,
32-second excerpts and checksummed render records live beside them. Each render
uses the preserved track/report through the existing native ride, audio,
Remotion overlay and final production pipeline. Identical seed results can share
a video only after exact track/report bytes, render settings, authored inputs
and production metrics have been checked. They remain separately labelled runs.

The [compact measurements](evidence/musical-direction-20260930.json) and
[validation record](evidence/musical-direction-20260930-checks.json) bind the
results to the compiler, frozen judge, source inputs, media and browser checks.
Code and compact evidence are versioned. Large video/replay archives remain local.
The user's transcript remains private, untracked reference material.

## Reproduce

The recorded compiler checkout is `/tmp/line-musical-direction-20260930`, frozen
at `1fb4fd77`; a new checkout at that commit needs the existing WASM build and
Node dependencies. Use a new output directory if any input or implementation
changes. To reproduce with the current identical compiler:

```sh
LR_ENGINE=wasm node --import tsx scripts/produce/musical_direction.ts \
  --compiler-root=. --out=generated/musical-direction-new --seeds=311,312,313

LR_ENGINE=wasm node --import tsx scripts/produce/summarize_musical_direction.ts \
  --study=generated/musical-direction-new --out=generated/musical-direction-new/results.json

# Serve mirror/ on port 8765 and the repository dashboard on port 8767.
LR_ENGINE=wasm node --import tsx scripts/produce/render_musical_direction.ts \
  --study=generated/musical-direction-new \
  --ids=luna_bala_44s-311-baseline,luna_bala_44s-311-guidance,luna_bala_44s-311-facets,luna_bala_44s-311-mixed,amor_na_praia_46s-311-baseline,amor_na_praia_46s-311-guidance,amor_na_praia_46s-311-facets,amor_na_praia_46s-311-mixed

LR_ENGINE=wasm node --import tsx scripts/produce/reuse_musical_direction_videos.ts \
  --study=generated/musical-direction-new

node scripts/gallery/check_musical_direction_ui.mjs \
  --study=generated/musical-direction-new --out=generated/musical-direction-new/ui-checks.json
```

Open `/motion-gallery/music.html?data=/generated/musical-direction-new/manifest.json`.
The immediate artistic decision is whether these phrases read as useful,
intentional variation with natural entries and returns. That feedback should
inform the next construction experiment. The current examples do not establish
that fewer guides or more facets are universally preferable.
