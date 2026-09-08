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
