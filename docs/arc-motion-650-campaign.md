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
