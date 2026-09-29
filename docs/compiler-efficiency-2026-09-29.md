# Compiler stopping policy and first motion gallery — 2026-09-29

Compiler `2e2dd1f7` reduces V4 physics work by **82.22%**, while moving the
headline from **952.5191 to 952.4726** (−0.0465). All **352/352 runs** remain
valid across 176 specifications and seeds 16/17. The frozen catalog, score,
detector and physics are unchanged. The output remains connected normal arcs.
This implements the scheduling follow-up from the
[earlier audit](compiler-design-audit-2026-09-11.md).

## What changed, and why validity alone was insufficient

The old path always ran a second general search after its preliminary track.
The first implementation accepted any preliminary track that survived, hit the
beats and avoided extra landings. A complete public rerun confirmed the earlier
counterfactual: **952.4696**, 352/352 valid, **96.18% less simulated work**.

The new gallery then found a counterexample outside that catalog. For even
catches, seed 102, a preliminary track met all those physical conditions but
scored **598.3382**. Running general search on exactly the same input raised it
to **942.3736** at 100,000 frames, or **929.6832** at 750,000 frames. Accepting
physical validity alone would have discarded valuable search. It is retained
as an explicit research ablation, not the production rule.

Production now also requires whole-trajectory RMS target error ≤ **0.025**,
using the existing compiler objective and normalized target coordinates.
Nonfinite or missing measurements cannot qualify. This is a single adjustable
compiler stopping tolerance, without benchmark identities or case exceptions.
The chosen tolerance is a conservative starting point, not a proven universal
optimum. A retrospective work-only sweep is preserved; only the selected rule
and validity-only alternative received new complete canonical reruns.

The resulting 176-case attempt decisions are:

| Decision | Cases |
|---|---:|
| Accept complete, sufficiently accurate preliminary track | 146 |
| Continue search because measured target error is larger | 25 |
| Continue search because the preliminary track is incomplete | 5 |

The two canonical seeds reproduce 176 distinct tracks. Only two specifications
change their selected track relative to the previous baseline, each replicated
at both seeds. The full allowance remains 750,000 frames: it is a ceiling, not a
spending obligation. Every attempt, candidate and cold replay remains metered.
Early return preserves the declared allowance and reports actual work separately.
The explicit `searchAfterPreview: 'always'` route supports controlled comparisons.

## Qualification and work

| Panel | Before | After | Physical work |
|---|---:|---:|---|
| Full V4, 352 runs | 952.5191 | 952.4726 | 261,277,684 → 46,454,822 frames |
| V3 subset within V4 | 958.0530 | 958.0520 | Included above |
| V4 extension | 947.0434 | 946.9519 | Included above |
| Separate 2% target jitter, 176 runs | 874.0738 mean | 874.0738 mean | 131,144,711 → 122,319,389 frames |

All jitter tracks and scores match the previous compiler exactly, with
176/176 valid and 148 distinct tracks. Only 12 jitter runs finish within the
preliminary allowance. The **6.73%** work saving on this diagnostic is much
smaller than the canonical saving. General search remains necessary on these
perturbed inputs. This is why the earlier “99% of work” observation must not be
read as evidence that 99% of the compiler can be deleted or is always useless.
The jitter catalog contains reused V2 development inputs; it is not an independent
held-out test or a jittered copy of the full V4 catalog.

The canonical maximum is 749,981 actual frames; the jitter maximum is 749,998.
All 352 public canonical tracks, grades and frame counts match the 176-case
research panel. The existing normal-line and connected-component checks pass.

## Elapsed time is measured separately

Six equally spaced V4 catalog entries were compiled in both modes, three times
each, in one warmed process with alternating order. Every paired track hash
matched. Median times ranged from **22.22–34.57 seconds** with unconditional
search to **0.31–0.75 seconds** with early acceptance. Loading and decoding the
model separately took **3.45 seconds**.

These six entries all qualified for early acceptance. The ratios describe this
sample, not the complete suite or unfamiliar inputs. The host also ran other
qualification jobs, so this is not an isolated latency benchmark. Import,
rendering and video post-processing are outside these compile timings. The
large policy artifact and retrieval cost remain separate efficiency opportunities.

## A working gallery, with measured limitations

See [the motion gallery guide](motion-repertoire.md). Its 48 recordings compare
arcs/guides and scattered normal segments on four new short passages, three
allowances, and seeds 101/102 with 2% target jitter. The same authored inputs and
scores are used for both implementations, with no cross-method fallback.

| Allowance | Arc mean | Segment mean | Valid per method |
|---|---:|---:|---:|
| 25,000 | 637.04 | 580.21 | 8/8 |
| 100,000 | 842.64 | 580.39 | 8/8 |
| 750,000 | 840.61 | 580.39 | 8/8 |

These are **research-passage averages, not V4 headlines**. The larger allowance
is not a guarantee of a better result. Two seeds and four passages are too few
to choose a universal production budget, but they expose useful failure modes.
All eight segment tracks at 100,000 and 750,000 frames are identical: its finite
local proposal grid has already saturated. Allocating more frames does not add
a new correction strategy.

A diagnostic replay reproduced the quiet-tail failure precisely. On seed 102,
the segment controller failed to construct support at frame **134**, six frames
after the final beat. Its terminal-continuation shortcut accepted the remaining
trajectory through frame 360 because survival and beat timing passed. Tail speed
was **3.1395** against **0.5**, air **0.9742** against **0.3991**, and amplitude
**1.0** against **0.13**. The score was **7.9417**. Seed 101 also had poor tail
adherence, without taking that shortcut: disabling the shortcut alone would not
solve all of the controller's limitations.

This argues for improving and remeasuring terminal control before claiming that
scattered geometry offers reliable artistic control. It does not establish a
limit on the geometry itself. The gallery does not yet test mixed tracks,
transition compatibility, or a limit on the frequency of a style. No motif
system, family framework or new specification control was added.

## Evidence and checks

- [Canonical qualification](../benchmark/v4/studies/preview-quality-20260929-validation.json), [full compact result](../benchmark/v4/runs/preview-quality-20260929.json.gz).
- [Work and stopping decisions](../benchmark/v4/studies/preview-quality-20260929-work.json), [jitter qualification](../benchmark/v4/studies/preview-quality-20260929-jitter.json), [paired timing](../benchmark/v4/studies/preview-quality-20260929-timing.json).
- [Gallery measurements and terminal diagnostic](evidence/motion-gallery-20260929.json), [verification record](evidence/motion-gallery-20260929-checks.json).

The focused suite passes **176 tests in 43 files**. TypeScript retains its **251
inherited diagnostics**, with no new diagnostics after normalizing checkout
paths. Browser verification exercised all 24 comparisons / 48 artifacts, play
and pause, beat seeking, both views, mobile layout, and refusal to display an
altered replay. The experimental normal controller now normalizes inputs,
reserves replay work and keeps judge cleanup separate from caller-owned engines.

Source and compact evidence are versioned. Raw qualification tracks, timing
outputs, gallery traces and screenshots stay local. No new production video or
owner audiovisual approval is claimed by this physics-view gallery.
