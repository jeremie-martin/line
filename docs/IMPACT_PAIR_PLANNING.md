# Impact pair planning — architecture review, evidence, and design

2026-06-10 · branch arc-rewrite · baseline canonical 586.53 · impact still costs
~57 headline points (`npm run lab -- report loss`). This is the working document
for the structural impact effort. Every claim lists its reproduction.

## 1. The question

Achieved impact undershoots its target everywhere (bias ≈ −0.15, worse at high
asks). Physics: measured impact = CoM velocity redirection over the 6-frame
window after contact, normalized by REDIR_CAP=8.5 — a 0.5 ask at 10 px/f needs
~25° of sustained path bend. Final tracks deliver ~8°. Where is the bend lost?

## 2. What is implemented today (and its logic)

State across gaps (verified in code, see file refs):

- **Generation at gap k is fully re-conditioned on k−1's real arrival**: the
  probe simulates the committed prefix to k's frame and reads
  `targetState = {sledX, sledY, velocity, speed, angleDeg}`
  (`optimizer/sample.ts getCandidateProbe` → `arc_placement.ts
  readTargetStateFromRider`). So two-gap "dive-scoop" pairs are REPRESENTABLE:
  a steep k−1 launch changes what k samples.
- **targetState is CoM kinematics only.** No sled orientation / rider pose.
  angleDeg = atan2 of velocity, not sled angle. Catchability ("can this arrival
  actually ride this surface") is purely emergent: sample geometry → simulate →
  survival/landing/off-beat gates. The system filters pose, never plans it.
- **Five launch shapers** point gap k's exit at gap k+1, all attempt-spanned
  blends of the same `postAngleDeg` (arc_placement.ts): energy (speed target),
  elevation, amplitude, air-length, and impact-ARRIVAL (`gap.nextImpact` —
  the only one budget-faded: full ≤50k → off ≥100k).
- **Impact shaping at gap k itself**: curvature modulation (flatten + front-load
  — the carrier, +53 by ablation), redir angle nudges (±2), post-turn (±2),
  SLAM-HOP template lane (turn ≤22°, every 3rd late attempt, ±2).
- **Selection**: local axis-L2 cost (impact weight 0.5) pre-ranks; forward-eval
  `greedy:2` (true partial-track score of a charged rollout, ≥75k) re-ranks;
  DFS + repair completes. The rollout extends each candidate through
  `getCandidatesSorted(at, …, branch=1)` — ONLY the locally-top candidate of
  the next gap.

## 3. Evidence chain (each item reproducible)

1. **Lab** (`npm run lab -- report ...`): undershoot universal; ceiling not
   binding (clamped/at-ceiling ≈ 0); speed and scoop-shape predict achieved
   impact; steep entry + deep scoop achieves impact AND speed (arcs⋈gaps 2D).
2. **Ranking probe**: `LR_IMPACT_LOCAL_W=2` → 580.53 vs 580.83, excl-impact
   −5: ranking pressure trades 1:1. Not the lever.
3. **Generation-ramp probe**: widening the timid target ramps → 578.15 with
   ZERO movement in selected geometry. Not the lever either.
4. **Carrier sweep**: flatten 12 / frontload 1.2 → 585.56, +4.7 ACCEPT
   (commit b500904). Cheap surface now near-exhausted.
5. **Funnel study** (`LR_ENGINE=wasm npx tsx scripts/v0/study_impact_funnel.ts`,
   probe in core/candidate.ts, commit 829625a), 477 impact gaps @300k:
   - 56% `A_not_generated`: no candidate ever sampled with |turn| ≥ needed.
   - 32% `C_ranking_loses`: deep candidates admitted; forward-eval ranks them
     0.76 pctl — and is RIGHT: deepest admitted achieve 0.25 vs 0.36 target,
     barely above the flat picks (~0.23). **Turn without steep arrival does
     not convert to redirection.** (Lab landings: high redir needs vy_in 4-6.)
   - 4% gates (86-100% admission to 90° — exonerated). 8% works (bias −0.07).
6. **Arrival unfade probe** (`LR_IMPACT_ARRIVAL_FADE=0`): 580.57 — blanket
   steep arrivals without matching catches dilute high budget.
7. **Branch-widening probe** (`LR_FWD_EVAL_IMPACT_BRANCH=3|5`, default off):
   551.89 / 328.08 — charged branch^depth rollouts starve the search. Pair
   discovery by brute search breadth is unaffordable.

## 4. Diagnosis

The pair (steep arrival at k−1 → converting scoop at k) is representable and
sampled, but invisible end to end:

- generation at k from a steep arrival has no mechanism that sizes the scoop
  from the ACTUAL arrival vector (the existing turn machinery is capped/gated
  and conditioned on the ask, not the arrival), so the converting scoop is
  rarely in the pool and almost never top-ranked;
- greedy:2 therefore scores every steep k−1 launch through a generic flat
  continuation → arrivals look bad → faded out at high budget → flat arrivals
  → deep scoops under-deliver → ranker correctly rejects them. A closed loop.

## 5. Design (next step): arrival-conditioned scoop = attempt-0 lane

Break the loop at the one point that is cheap: **make the converting scoop the
TOP of the sample order whenever the arrival is steep and the gap has an
impact ask.** Concretely, in `sampleContactCenteredLines`:

- condition: `targets.impact ≥ ~0.3` AND arrival is steep
  (`targetState.angleDeg ≥ ~12°`, i.e. a dive is actually happening);
- scoop sized from the arrival vector: needed turn
  `asin(min(0.95, target·REDIR_CAP / speed))` measured from the INCOMING
  velocity direction (not from a capped template constant), sustained contact
  ≈ speed × IMPACT_WINDOW px, exit at the energy-consistent launch for k+1
  (hop exit, per the documented early-bend failure);
- placed in EARLY attempts (low attempt indices), not the late lane — so
  `branch=1` rollouts see it, which is what makes k−1 dives start WINNING
  forward-eval, which is what re-justifies arrival shaping;
- then re-test `LR_IMPACT_ARRIVAL_FADE=0` (item 6 should flip sign once the
  catch exists) and re-run the funnel study (A and C shares should both drop).

Falsifiable predictions, in order: (1) funnel D-share rises on steep-arrival
gaps; (2) impact bias shrinks at high asks; (3) arrival unfade flips positive;
(4) canonical headline up with validity held.

## 6. Open questions (deliberately deferred)

- **Pose/rotation**: targetState carries no sled orientation; if
  arrival-conditioned scoops still under-deliver, the next instrument is
  recording sled angle (PEG/TAIL vector) at landing in the probe/landings tier
  and checking it predicts conversion residue. Don't model pose until the
  CoM-level design is measured.
- Whether IMPACT_TEMPLATE/POST_TURN should be folded into the new lane or
  retired (each is ±2 today).
- Two-gap JOINT optimization (sliding window) — only if attempt-0 pairing
  proves insufficient; the branch-widening result warns against any design
  that multiplies charged rollouts.
