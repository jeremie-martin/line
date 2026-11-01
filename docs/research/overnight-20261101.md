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

### 23:45–00:10: X, the section fallback, replaces the 9-frame rule (adopted)
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

### 00:10–00:52: do we need the plan? (data), and guides offered (adopted)
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

### 00:52–01:20: confirmation, cleanliness, compute
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

### 01:20–01:45: where the remaining stray hits are (study only)
- **Data** (`tools/research/stray_hits.ts`): unrequested v3 impacts of strength ≥ 0.1 in the current compiler
  (`now-bench`, plus the experimental optional-guide runs on pairs8 and
  confirm). 114 complete rides, 7,852 beats, 258 stray hits; 12 of them are
  ≥ 0.25.
- **Rate per minute of ride, by section family:**

  | section | minutes | stray hits per minute |
  |---|---|---|
  | plain arcs, no guide | 28.7 | 0.38 |
  | scattered | 14.9 | 1.41 |
  | arcs with a guide offered | 11.0 | 1.91 |
  | scallops | 9.8 | 2.56 |
  | serpentine | 8.4 | 4.75 |
  | fold | 10.7 | 5.03 |
  | terraces | 10.9 | 7.89 |

- **Two kinds, in about equal parts:**
  1. *The body against the guide* (about 140 of 258): the head or arms brush
     the upper rail. This happens in every guided family.
  2. *The sled on the main line* (about 90): the shape's own steps and corners,
     mostly terraces and folds. Most of the 12 strong ones are this kind, in
     sections of 40+ frames.
- **Timing:** most happen 5–12 frames after a beat, almost never just before
  one.
- **In the score:** extras are 12% of the v3 impact loss. The search already
  pays for them (`line.strike.v3`), so they are trade-offs the search accepted
  in exchange for the shape, not blind spots.
- **Not done, on purpose:** I did not tune the extra cost or the guide
  clearance. Whether the owner sees a 0.1–0.25 body brush is exactly what his
  pending visibility study answers. Until then, any weight would optimize an
  unvalidated measure.

### 01:45: where the headline loses points, and two leanness ablations (hypotheses stated first)
- **Headline loss today** (`now-bench`, share of the mean loss):
  - impact strength 35%, air 24%, speed 19%, impact timing 16%, extras 7%.
  - Strength undershoots on strong asks: bias −0.06 at 0.6–0.8 and −0.13
    at ≥ 0.8. This is the documented frontier (ARCHITECTURE "Measured
    limits"), so I am not attacking it alone tonight.
  - Timing loss is one-frame offsets on about 6% of beats (25 ms). Whether
    that is visible is unvalidated, so it is left alone.
- **Hypotheses, stated before the runs.** Each change would make the
  compiler leaner (less learned machinery, fewer special phases) if it costs
  nothing:
  - **A1, no future-value model** (`arc_value_model.json`, 0.6 MB, plus its
    73 features). On Oct 5 a constant model or none landed within about 0.01
    of it.
    - Hypothesis: under today's compiler, removing it moves the bench
      headline by less than 3 points at equal completion.
    - If so, it is a deletion candidate for the owner. If not, it stays.
  - **R0, no tail refinement** (`refineTailSections: 1`, "spare work improves
    the ending"). This is a phase that touches only the last section.
    - Same hypothesis and decision rule.
