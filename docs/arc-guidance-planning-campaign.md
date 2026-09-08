# Arc guidance and planning campaign

Opened 2026-09-08 after the owner welcomed the paired-arc videos and approved
thorough work on causal rail removal, variable guidance geometry, and planning
across beats. The accepted reference remains connected-arc-feedback at 687.5102.
Benchmark V2, score, authored targets, physics and actual-frame accounting are
fixed. Only normal type-0 coherent physical curves are allowed.

Implementation branch: `codex/arc-guidance-planning`. The reference source and
videos remain on `archive/connected-arc-feedback-687` and in the original archive.
Research evidence is under `generated/benchmark-v2/arc-guidance/`; every worker
record and plan has a SHA-256 sidecar. Discovery panels use seed 260908011 and
750k actual physics frames unless their plan specifies otherwise. A partial
panel's arithmetic mean is exploratory, never a benchmark headline.

## Causal rail evidence

`ablation/` covers every one of the 44 reference development tracks, comprising
4,100 upper rails. Each single-rail removal and the combined trimmed track was
fully replayed in the frozen judge; the full reference score was reproduced
before each study. The study charged 29,304,164 separate research frames.

- 1,389 rails (33.88%) never collide with any rider body and are exactly removable.
- Of 4,100 complete-rail removals, 1,399 preserve the full physical contract;
  only 1,389 preserve the exact recorded trajectory. Thus most actively used
  rails are essential to the already-built track, even if a redesigned track
  could behave differently.
- Among the 2,711 active rails, retaining the early half preserves 423 exact
  trajectories; retaining the late half preserves 1,292. These halves are
  ordered along the supporting curve, not by collision time.
- Retaining one contiguous span covering all contacted segments with two
  neighboring segments at either end preserves all 2,711 individual trajectories.
- Combining those trims and removing unused rails preserves exact raw trajectories
  and scores on all 44 tracks. It removes 146,472 of 203,400 upper segments
  (72.01%), or 35.29% of all physical segments.

The compiler reduction additionally retains at least 24 px or 20% of each
used guide's original length, whichever is larger (capped by its source length),
and at least three segments when available. This preserves substantial curves
rather than reducing guidance to isolated contact points. It inspects an already
metered cold replay and verifies the reduced track against it with a complete
frozen-engine replay; both replays count inside the compiler budget.

## First search and planning experiments

The geometry family now supports searched clearance and contiguous upper-rail
start/end positions. Zero coverage is a single supporting arc. The fixed pair
remains available as an experimental control. The initial geometry search
refines the best existing curve; this is a first implementation with substantial
scope for joint search of curve shape and guidance.

The first planning implementation compares several distinct current arrivals
by constructing and simulating the next curve. It chooses a current curve by
the measured current and next-interval costs. All speculative physics is metered;
remaining construction and final replay capacity are reserved.

Eight-case exploratory panels: guidance span alone was adverse; clearance
search and paired lookahead were promising but mixed. Their combination was
stronger. A 208-proposal fixed-pair control improved less than the combined
method, despite using more proposals than the 160-proposal reference.

Full discovery panels from source `b08491bb`, all 44 cases and one seed:

| Configuration | Fixed V2 score | Valid | Maximum actual frames |
|---|---:|---:|---:|
| Accepted reference | 687.5102 | 44/44 | 509,155 |
| Clearance search, 48 extra proposals | 702.0956 | 44/44 | 560,277 |
| Full guidance, three arrivals, 32-proposal next-curve search | 720.6183 | 44/44 | 741,557 |

These are discovery results, not canonical promotion. The first lookahead
does not carry its proposed next curve into the following full search; that
reuse is the next experiment. The numerical and visual delivery remains in progress.

## Planning, joint geometry and recovery

Carrying a planned curve forward improved the initial eight-case panel, but
the full panel exposed budget exhaustion on later difficult approaches. Those
failures are retained in `full-l2-*`: full guidance completed 42/44, clearance
43/44, and wider lookahead 42/44. Small-panel success did not justify promotion.

Replacing the current-arrival prior in the lookahead comparison with the
measured next curve and its terminal arrival cost produced 741.5662, 44/44.
Reserving more future construction work produced 741.8474, 44/44, using at
most 722,807 frames (`full-l3-reserve`). Looking two future intervals ahead
with two continuations per branch was viable, but scored 719.4856 at the same
budget (`full-l3-deep`). Longer horizons consume proposal quality and breadth;
the deeper implementation remains available for research, not selected by default.

Joint refinement of supporting-curve controls, clearance and guide coverage
was implemented and tested after the first span-only result was adverse.
It scores 733.6547, 44/44 (`full-l4-joint`), a useful result but below the
best clearance-plus-planning configuration. This is evidence about this
implementation and compute allocation, not proof that coverage search is inferior.

Recovery now prefers alternatives with simulated viable continuations and
carries their proposed next curves into subsequent search. If the initial
shortlist has no viable continuation, it examines more diverse arrivals while
budget remains. Combined with clearance search and terminal planning, this
scores **744.5**, **44/44**, at most **737,686** actual frames
(`full-l4-recovery`). Disabling geometry search while retaining terminal
planning scores 705.2066, 44/44 (`full-ablate-guidance`). Together with the
702.0956 geometry-only result, this supports a complementary contribution
from geometry and planning rather than merely extra local proposals.

## Integration and remaining validation

The public integration preserves the selected 750k configuration. Initial
small-budget allocations were adverse: adding geometry proposals to the old
allocation lost completions. A proportional allocation repaired 500k to
44/44 and 717.4848 (reference 673.64), but still lost four 250k completions.
The preserved reference was independently rerun on all 44 cases at both
budgets: 44/44 at 250k and 500k, with 610.9446 at 250k.

The next allocation gives basic curve construction priority before expanding
geometry variables and planning, using available physics work per ride frame.
This is a continuous compiler allocation, with no benchmark-budget or source-ID
dispatch. Public verification, canonical evaluation and final video delivery
are still pending at this entry.
