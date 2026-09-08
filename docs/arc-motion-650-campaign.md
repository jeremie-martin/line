# Arc motion compiler campaign

Opened 2026-09-08 after the owner rejected the constellation of point controls.
The numerical proofs of concept remain preserved, but the active goal is a
normal-line compiler whose physical geometry consists of coherent visible arcs.
Arc shape and parameterization may change. Benchmark V2, scorer, authored
specifications, physics, and frame accounting remain fixed. The target is a
verified 750k headline above 650, with early full vertical video review.

Work branch: `codex/arc-motion-650`. The public compiler is temporarily still
the preserved 662.5889 normal point-control compiler while arc prototypes are
measured separately. No arc prototype has been promoted. Existing arc research
is evidence rather than a restriction on the new approach.

## First physical experiments

The new research compiler proposes one connected normal-line curve per support
interval. It integrates a tangent schedule with an impact phase and later slope,
then measures entry timing, contact persistence, release, outgoing axes, and
current impact in the actual engine. Trials preserve the committed physical
prefix. Final tracks exactly match a cold replay in the frozen judge. Every
simulation, including failed trials and revisited prefixes, is metered.

All figures below are discovery readings on seed 260908011, not headlines.

- First River Reentry prototype: 88/88 contacts, valid, 231.3453. Repeated catches
  drain speed despite locally good timing; speed RMS is 0.6001.
- A next-arrival heading/speed objective raises River to 463.2773, valid. The
  same first implementation fails late in amplitude tides and dense recovery.
- Reconsidering diverse earlier curves when a later catch fails restores both:
  amplitude tides 541.3554 (97/97 contacts), dense recovery 241.2414 (123/123).
  River reaches 492.7276 (88/88), with a stronger arrival objective. All use
  under 394k physical frames within 750k. These are feasibility results, not
  improvements over the previous arc compiler.

The tests expose specific weaknesses to address: entry deflection can dissipate
speed, downward-bending curves can outrun gravity and release prematurely, and
short-horizon choices can arrive at the next curve in an unusable state. The
next experiments will test continuous support feasibility and gentler entry
before increasing search breadth.

Artifacts: `generated/benchmark-v2/arc-motion-650/`. The v1/v2 filenames record
the earlier discovery arms; the v3 source checkpoint preserves the first
backtracking implementation. Current research entry:

```bash
LR_ENGINE=wasm node --import tsx scripts/benchmark/arc_motion_study.ts \
  --source=river_reentry --arrival-weight=0.6 \
  --out=generated/benchmark-v2/arc-motion-650/EXPERIMENT.json
```

## Paired-arc control and first complete panel

The gravity-limited single-curve and local Newton variants keep the tested
tracks valid, but do not yield a broad improvement. A paired-curve prototype
adds a second real normal rail. Radius limits prevent the parallel curve from
folding at a tight bend; an arrival-speed objective lets the stronger geometry
choose a useful approach rather than imposing the one-sided catch's steep
heading prior.

The frozen v7 design (`1d258ec9`, channel clearance 12 px, minimum nominal
radius 24 px, no transient wave, arrival-speed weight 0.3, 160 proposals) passes
all 44 development cases at seed 260908011 and 750k. Its discovery aggregate
is **582.9259**, not a canonical headline; all 44 are valid. It uses
16,117,438 physical frames, max 502,772 per source. Representative score is
626.1023; capability 437.6782; legacy regression 555.1495; development music
469.7527. The full panel, checksums, and frozen plan are in `full-v7/`.

River Reentry reaches **743.4679** with air / impact / speed RMS
0.0493 / 0.0807 / 0.0868. These improvements do not generalize uniformly to dense
passages, which remain the principal weakness. A complete mixed-family
experiment is pricing the old arc builder on the budget actually left after
the new one. Its checkpoint behavior can overshoot its requested allocation,
so an explicit reserve is being tested; no over-budget run is accepted as
portfolio evidence. The benchmark accounting is unchanged.

The first complete production preview uses the v7 paired-arc compiler on
Amor na Praia. It is a valid 46.5-second, 1080×1920/60 fps video with music and
all production effects. Its production metric is 635.7647 and it has 1.72%
standing time; this is a visual prototype, not production selection approval.
The first attempt exposed an omitted-preroll handling error in the prototype;
the corrected compiler uses the existing `PREROLL.DEFAULT_S` convention and
honors explicit starts and zero-preroll specifications.

Open [the early arc preview](../archives/arc-motion-2026-09-08/index.html).
The archive retains the frozen generated track, report, controls, source copies,
video validation, and checksums. The owner was asked whether paired curves are
welcome or single curves should dominate; both directions remain open pending
that optional preference.

The River geometry audit finds 89 connected curve pairs (178 physical rails,
9,348 normal segments; minimum segment length 1.687 px). The upper rails
actually collide with the rider on 248 frames. Removing them changes the
trajectory at frame 136 and ejects the rider at frame 177; the complete track
survives through frame 2340. Audit simulation is charged separately as 4,680
frames and is not compiler-budget evidence. See `geometry-audit-river-v7.json`.

## Complementary builders and arrival posture

The v8 two-builder discovery uses the v7 paired arcs plus the legacy single-arc
compiler in the remaining budget, with a 40k reserve for legacy checkpoint
completion. All 44 combined costs fit 750k (maximum 730,712); the exploratory
aggregate is **620.2903**, with legacy winning 23 cases. This reuses the frozen
v7 evidence and is not an integrated portfolio or canonical headline.

A v9 arrival-pose/angular-rate prior (weight 0.1) raises River Reentry to
758.8610 and Believer Impact to 625.1991, and amplitude mosaic to 524.6445.
It hurts dense dialogue (266.4945) and dense recovery (268.9151); increasing
weight to 0.3 hurts recovery further (235.3533). All six are valid and below
354k physics frames. The prior is optional, not a new default. Dense sequences
still expose repeated speed loss and poor approach orientation.
