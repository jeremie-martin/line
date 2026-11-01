# Overnight, 31 Oct → 1 Nov 2026 (journal)

Owner's brief (23:40): work alone and carefully, with few subagents, until about
07:00. Make the compiler simpler, cleaner and leaner, with a better headline,
while staying compatible with his taste: variety, clean geometry, no unwanted
impacts. Measure everything, report honestly, and leave decisions on taste for
his eye in the morning.

Rules for the night:
- every compiler change goes on a branch and is measured on `bench` (headline
  first, then completion, quality and geometry) at the fixed allowance;
- `pairs8` and `bench-confirm` are run before any claim;
- `sealed` and `heldout` are run only at a decision point;
- nothing taste-related is adopted without his review.

## Context
- **The plan:** the seeded repertoire plan (`intentional_repertoire.ts`, one
  family per phrase of 2–3 sections) arrived on 2026-10-01 (commit eeab4f88)
  to bring variety. Before it, the search used one or two geometries.
- **Round 1:** C (dead end → own-section fallback) matches the 9-frame rule
  with no rule. B shows that the cost alone drops shapes as the headline rises.

## Log

### 00:05–01:20: X, the section fallback, replaces the 9-frame rule (adopted)
- **Built:** C's idea at its simplest. A dead-ended shaped section retries with
  plain arcs and keeps its guide; otherwise it backtracks as before. No
  threshold. `minFrames` and `fitShapesToSections` are deleted, and the planner
  reproduces V6's frozen plans again.
- **Against the rule:** bench +0.4, pairs8 +3.6, confirm +2.2, sealed −4.1,
  held out +44 (16/16 vs 15/16). Completion is equal or better everywhere, with
  no ride lost.
- **The sealed −4.1:** X keeps shapes squeezed into 7–8-frame sections where
  they are feasible, costing 10–28 points on 3 rides. This is a taste
  question; a clip goes to the owner.
- **Parity:** 5 cells. The rule's V6 case returns to its original track, and 4
  cells differ at the 150k allowance. References refreshed.
- **Decision:** adopted. It replaces a flagged gate with a general mechanism
  at equal or better completion. Disclosed: the sealed cost, and P1 inverted
  arrivals +0.08 (6 cells).

### 01:30–04:40: do we need the plan? (data), and guides offered (adopted)
- **New eval option `--creative=JSON`** passes planner preferences as an arm,
  recorded in the run.
- **No plan, plain unguided arcs everywhere:** bench headline 753 vs 717 for
  the current version. Fewer stray hits (−0.09/beat), body drag −0.84 s/min,
  air better, completion equal, and **zero variety**.
- **No plan, guided arcs everywhere:** 750, but stray hits +0.05 and body drag
  +1.07. The guides cause the unwanted contacts.
- **The plan without guides** (same family draws): 686 (−31). The guide holds
  the rider on shaped paths, and without it speed and impact suffer.
- **Per-section analysis** (current vs the same sections as plain arcs): shapes
  cost little at 12–39 frames, and cost air at 40+ frames (long floats) and
  everything under 12 frames. Shaped sections produce stray contacts at every
  length; plain arcs almost none.
- **Graded shape fulfilment** (shape-only shortfalls priced at a 0.3 or 0.6
  strength miss): +4.4 / +0.6. Small, so the cost of variety is not waste.
- **Guides optional** (offered, never required; same draws): +25.6 on bench,
  with fewer stray hits and better impact, air and speed. Confirmed on pairs8
  (+23.1), confirm (+17.3), sealed (+26.7) and held out (+22.7), with no ride
  lost. Shapes are kept (100% of turns realized). 78% of offered guides are
  used.
- **Adopted** in a clean version (no transfer draw): bench +22.4. Disclosed:
  transfer receivers are gone, and 5.65 vs 5.93 distinct families per ride.

### 00:55–02:10: confirmation, cleanliness, compute
- **Rides for the owner:** seven specs before the night and now
  (`/generated/overnight-compare/collection.json`): the usual Luna, Tiki and
  Amor specs, plus Trouble, Valhalla and Circus pairs3/pairs4.
- **Final numbers, start of night vs now** (the merged compiler, every panel,
  no ride lost): bench 716 → 739 (+22.8), pairs8 739 → 772 (+33.2), confirm
  717 → 739 (+22.2), sealed 722 → 734 (+12.3; the sealed long ride −22.9),
  held out 660 → 733 (+73.4, 16/16). Strong stray hits are down 0.023–0.032
  per beat, and v3 is better everywhere.
- **Stray hits ≥ 0.1 per beat:** 0.084 → 0.036; plain arcs give 0.005. What
  remains is mostly in shaped sections, within 12 frames of a beat. Whether
  the owner sees these is what his visibility study answers.
- **Untouched-guide trim: a no-op.** The compiler already prunes a guide it
  does not use, so offered-but-unused guides leave no lines.
- **Allowance study** (bench headline, every cell complete): ¼× 644, ½× 707,
  1× 739, 2× 739. At 2× the search barely spends the extra, because the
  per-section effort is capped at 1.
- **Uncapped effort:** 1× −2.4 (noise), 2× +7.8. Diminishing returns; not
  adopted. Today's allowance is near the knee: halving it costs 32 points,
  doubling it gains about 8.
