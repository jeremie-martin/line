# Arc motion compiler campaign

Opened 2026-09-08 after the owner rejected the constellation of point controls.
The numerical proofs of concept remain preserved, but the active goal is a
normal-line compiler whose physical geometry consists of coherent visible arcs.
Arc shape and parameterization may change. Benchmark V2, scorer, authored
specifications, physics, and frame accounting remain fixed. The target is a
verified 750k headline above 650, with early full vertical video review.

Work branch: `codex/arc-motion-650`. The public compiler routes ordinary requests to connected arcs, now promoted
at 687.5102 with 352/352 valid canonical runs. The previous 662.5889 point-control
compiler and its evidence remain preserved. Existing arc research
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

## Bidirectional curved support

The paired geometry still inherited a one-sided proposal assumption: almost
all impact turns bent upward. Allowing both turn directions raises Dense
Dialogue from 386.4700 to **714.3362** with impact objective weight 1 (all valid,
349,814 physical frames). Dense Recovery reaches 489.4605, River 679.2321, and
Believer Impact 546.0506. Weight 2 instead gives 616.8673 / 457.2512 / 757.7943 /
238.2564. These are discovery pilots; broad evidence is still required.
The objective weights affect search only; the evaluator remains unchanged.

The complete v10 weight-1 panel is **623.8803**, 44/44 valid; weight 2 is
573.0172, also 44/44 valid. The sparse lowline regression reaches a steep
speed runaway and scores 11.2046 in the weight-1 arm. Merely keeping physical
validity is insufficient: the planner must reconsider bad motion states too.

The v11 prototype revisits preceding curves when outgoing speed error exceeds
0.3, with two retries per contact and a remaining-construction budget reserve.
Sparse Lowline recovers to **637.2194**, Believer Rhythm to 645.1766, Believer
Impact to 603.3246, and Dense Recovery to 508.2126; Dense Dialogue stays at
714.3362. All five are valid, maximum 436,155 physics frames. Five retries
raises sparse to 654.4009 but costs more and slightly hurts dense recovery.
The conservative two-retry policy is undergoing the full discovery panel.

The full v11 panel is **643.3307**, 43/44 valid. High Air Drive enters a speed
runaway and spends its budget on unsuccessful recovery (748,981 physical
frames, three missing contacts). This candidate is not eligible for promotion.
All three production specifications do compile validly; full vertical renders
are running from frozen v11 outputs (production metrics 666.84 / 760.16 / 674.81
for Amor / Luna / Tiki, not benchmark scores).

V12 adds a broad arrival-heading objective: no penalty inside -15 to +45
 degrees, with a soft quadratic penalty beyond that interval. At weight 0.3,
High Air Drive recovers to 665.0856 with three backtracks, River reaches
819.6094, Dense Recovery 529.4652, Pickup Progression 544.0775, Sparse Lowline
640.1087, and amplitude mosaic 584.7618. All six are valid, max 509,155 frames.
Weight 0.1 is also valid on all six but less effective on most; it remains a
recorded alternative. The 0.3 objective is proceeding to the full panel.

## Complete arc candidate and integration

The full v12 discovery is **687.5102**, **44/44 valid**, maximum **509,155**
physical frames. Strata: representative 725.5574, capability 542.9614, legacy
regression 668.0486, development music 627.4190. This remains a one-seed
exploratory reading, not a promoted headline. Frozen research source: `fb3e4a81`.

The integrated public compiler uses this design, scales proposal breadth with
budget and ride length, honors seeded jitter and explicit starts, and emits
standard compile/budget telemetry. Seven focused physical, repeatability,
budget, jitter, and compiler-identity tests pass. Public River Reentry exactly
matches the frozen research track, report, and 341,926 charged physics frames.
A later completed TypeScript audit caught two omitted viable-candidate fields;
they are corrected in finalization below. Unrelated repository errors remain. Canonical verification is next.

The three v11 videos are complete and checksummed in the local arc gallery;
see `arc-motion-video-review.md`. Exact integrated-candidate videos are also
rendering through `scripts/produce/review.ts`. All 12 scale checks (River,
Pickup Progression, Low Air Endurance at 150k/250k/1M/3M) are valid and within
their actual budgets. The 1M and 3M outputs match per source. River and Dense
Dialogue have exact complete trajectory/event parity with the published
JavaScript engine as well as the frozen WASM judge.

## Canonical acceptance

The integrated candidate `c58607b1` is accepted and promoted as **connected-arcs**
at **687.5102**, **352/352 valid**, on all 44 cases × seeds 16–23. The existing
N=8 boundary accepts +24.9213 over the normal point baseline. Both deterministic
zero-jitter arms have zero measured seed-block variation; the independent
catalog-sensitivity interval is [18.2560, 31.1076]. No scoring or suite identity
changed, and no forced acceptance was used. Maximum actual compile cost is
509,155 physical frames, median 358,313, minimum 316,533.

Qualification passes 120/120, monitor 616.9096 (250k/500k/750k monitors
566.8867 / 622.2936 / 641.2847). The lower-budget standing reading is running,
with its 528-cell point baseline reused after checksum and exact candidate
identity verification. Twenty-eight development sources improve and sixteen
regress against the point compiler. Monitor regressions are retained openly;
these are not a change to the 750k promotion policy.

## Final telemetry and lower-budget correction

The first accepted 687.5102 snapshot omitted the required viable-candidate
count in two diagnostics. A completed TypeScript check caught this after the
first promotion. The compiler now counts every fully evaluated viable proposal
and reports it in both standard stats and telemetry. This does not affect
geometry, proposal decisions, or frame charging.

The first 250k reading is ADVERSE: 480/528 valid, with all 48 losses on the
shifted pickup variant. At this smaller budget, increasing construction breadth
from 0.6 to 0.7 of the per-frame allowance recovers the variant; the complete
11-source seed-0 development reading is 11/11 valid and scores 645.66. The
750k development proposal count stays at the already tested 160 throughout
all 44 cases. The corrected source is being freshly certified and the full
lower-budget reading repeated. The pre-campaign point baseline is restored
only as the unchanged comparator for this final certification. The initial
accepted arc reference and every original artifact remain preserved separately.

## Final delivery

Final source **affc8efd** is freshly accepted and promoted as
**connected-arc-feedback**, again **687.5102**, **352/352 valid** at N=8.
Every canonical track, score and charged frame count matches the initial
accepted snapshot; viable-candidate counters are present. The 250k reading
now passes **528/528**, repairing the earlier 48 losses, but its subset score
645.6560 remains below the point baseline's 670.9793 (ADVERSE on score).
Final qualification passes **120/120**, monitor **626.5448**; per-budget monitors
are 583.7360 / 630.8295 / 647.9428. Final scale checks pass 11/12, with one
150k pickup failure; all stay within budget. A completed TypeScript check has
no errors in the new arc compiler, research or review files; unrelated existing
repository errors remain.

All three final vertical production videos are archived. Sampled rendered
frames were visually inspected and all complete streams decoded without errors.
Their tracks and reports exactly match the final compiler. The user has not
yet approved the paired-arc appearance. See the gallery, video record, and
`benchmark/v2/studies/connected-arc-feedback-validation.json` for durable evidence.
The numerical objective and requested visual artifacts are complete.
