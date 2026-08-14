# Selective-backtracking DFS roadmap

## Objective

Generalize the handoff compiler's depth-first frontier traversal so it may
change course before the active path dies. This is a search strategy, not a
repair feature:

```text
ranked branch point
-> follow the preferred child
-> observe realized authored-target quality
-> either keep descending or suspend that continuation
-> promote a causal alternative from the remembered branch point
-> retain the suspended work for later traversal
```

The compiler still receives one fixed budget and optimizes the best track it
can return at that budget. This is not an anytime algorithm. Candidate
generation, candidate ranking, rescue, tail completion, repair, and the global
best-so-far register keep their existing responsibilities.

## Search semantics

- **ordinary DFS**: the retained diagnostic control. The most recently
  enqueued viable child is processed first; another branch is selected when
  the active subtree exhausts.
- **selective backtrack**: a policy-requested change of branch before subtree
  exhaustion.
- **branch point**: an expansion that produced at least two ranked viable
  children.
- **leader**: the preferred child selected by the existing ranker.
- **causal alternative**: the next ranked child from that same branch point.
- **suspended continuation**: the current prefix placed immediately behind the
  promoted alternative. It is deferred, not deleted or declared dominated.
- **rewind distance**: committed contact count between the current prefix and
  the remembered branch point. Gap indices are reported separately.

Trigger signal, rewind target, and current-subtree disposition are independent
policy decisions. The shared scheduler must not bake one signal into its
frontier operations.

## Invariants

1. With the policy unset, node order, charged simulation work, output track,
   and serialized telemetry are byte-identical to the explicitly named
   production catch-up policy. Explicit DFS remains a separate control.
2. A selective backtrack never changes candidate admission, candidate order,
   authored targets, scoring, or register comparison.
3. The first implementation suspends work; it does not prune it.
4. A promoted alternative is a real queued child of the recorded branch
   point, identified by object identity. It is never regenerated or inferred
   from a seed.
5. Decisions use the compile's fixed-budget deadline signal. Once the compiler
   is under deadline pressure, completion progress wins and the strategy falls
   back to ordinary DFS.
6. The strategy is phase-independent. Initial, repair, snapshot, and resumed
   traversals call the same scheduler; telemetry labels the lane explicitly.
7. Every trigger has direct evidence: branch point, realized loss change,
   contact advance, gap rewind, deadline state, promoted target, and eventual
   resumption of suspended work.
8. Experimental policy state is compile-local. No state or environment read
   may leak between compiles.

## First policy: authored-axis regret V1

The retained V1 study snapshot used
`LR_FRONTIER_POLICY=selective-axis-regret`. That closed value is no longer a
live compiler mode. Ordinary DFS was the default at this V1 evidence boundary;
the accepted bounded-catch-up successor is the live default now.

At every contact branch point, the controller remembers the leader, its next
ranked sibling, the committed-contact ordinal, and the leader's prefix
authored-axis loss. Descendants of the leader carry that watch point. A watch
may fire once when all of these hold:

1. the leader path has advanced at least two committed contacts;
2. combined authored-axis loss has worsened by at least 0.20 (equivalent to an
   RMS normalized-axis error increase of 0.05 under the canonical tolerance);
3. the remembered sibling is still present in the same live frontier; and
4. the existing deadline estimator's start-event upper interval, evaluated at
   the concrete alternative's gap rather than at the current deeper prefix,
   reports zero pressure; and
5. the traversal's concrete local ceiling has not been reached.

The current prefix is then suspended immediately behind the remembered sibling,
which is promoted to the hot end. The sibling's subtree proceeds under ordinary
DFS; if it exhausts before the budget, the exact suspended prefix resumes before
unrelated alternatives. Resumption starts at expansion and never repeats the
prefix's detector evaluation or register offer. Nested watches remain causal:
each names its own concrete branch point and concrete sibling.

The two constants define this policy version, not the scheduler API. Later
policies may use prediction surprise, equal-depth tournaments, incumbent
comparison, gap-local loss, or a different rewind target without changing the
frontier mechanism.

## Telemetry contract

Telemetry is absent under the explicit ordinary-DFS control. The production
catch-up policy records:

- exact policy name and frozen V1 constants;
- observed and armed branch points;
- mature watch checks and loss-threshold crossings;
- deadline/local-ceiling-suppressed crossings and missing-target invariant
  failures;
- executed selective backtracks and resumed suspended continuations;
- sums/maxima for loss delta, contact advance, and gap rewind;
- executed backtracks split by initial, snapshot, repair, and resumed lane.
- one event per executed backtrack with its causal branch/current/alternative
  gaps, baseline and trigger loss, alternative-specific conservative deadline
  margin, charged-frame timestamp, and nullable resumption timestamp.

The metric `selective_backtracks` means an actual frontier reorder. A signal
crossing that deadline policy suppresses is not a backtrack.

## Execution plan

1. Add a small, independently tested controller for watch lineage, one-shot
   decisions, and exact telemetry.
2. Give the shared frontier driver explicit operations for membership,
   suspension, and identity-based promotion while preserving its default stack
   behavior.
3. Integrate authored-axis loss and the existing deadline signal at the point
   immediately after node consideration and before tail/pool work.
4. Prove deterministic enabled behavior and byte identity between the unset
   production policy and its explicit name.
5. Run a small repair-disabled mechanism probe to verify real backtracks,
   rewinds, alternatives, budget exhaustion, completion, and resumption.
6. Only after mechanism validation, compare the arm on canonical V2 at 750k.
   Do not run a multi-budget sweep unless it is requested again.

## Progress ledger

| Date | Milestone | Status | Evidence |
|---|---|---|---|
| 2026-08-14 | Semantics and V1 policy frozen | complete | This document |
| 2026-08-14 | Controller and shared scheduler | complete | `3859e9b`, `25d7db5`; compile-local causal watch lineage, identity promotion, suspension/resumption, exact opt-in events |
| 2026-08-14 | Deterministic V1 verification | complete | 47 focused controller/deadline/handoff tests passed; the then-unset DFS default equaled explicit DFS; enabled runs were deterministic |
| 2026-08-14 | Repair-disabled mechanism probe | complete | One-budget panels below; zero unavailable alternatives and no validity loss after the target-aware deadline correction |
| 2026-08-14 | Canonical V1 evaluation | complete, inconclusive | N=48: delta +0.0035 +/- 0.0340 SE, 95% interval [-0.0878, +0.0948], directional P+ 54.08%; validity unchanged at 2,111/2,112 |
| 2026-08-14 | Bounded equal-depth catch-up | implemented, verifying | Clean-break `selective-axis-regret-catchup` arm; focused 47/47 tests pass; active 750k probe reaches five tournaments with no starvation |
| 2026-08-14 | Bounded catch-up promotion | complete | Exact environment arm and unset-default confirmations both accept at N=48 with +0.0815; active campaign headline 604.2665 |
| 2026-08-14 | Progressive stopping observations | in progress | Behavior-neutral like-for-like loss checkpoints plus an offline guard simulator; compact active-case panel replaces one compile per candidate rule |

## Initial mechanism evidence

These are deterministic diagnostics, not statistical performance evidence.
They use the production compiler path with repair disabled so the traversal
effect is not confounded with the repair controller.

The first 100k implementation priced deadline pressure at the current deep
prefix. On `believer_impact_56s` seeds 0 and 1 it executed two backtracks per
run and lost both completions. The action actually rewound to an earlier
sibling, so that margin understated the work being admitted. This was an
implementation/design error, not a parameter result.

The corrected controller prices the concrete alternative gap with the budget
estimator artifact's start-event upper interval. Repeating the frozen six-case
x two-seed 100k panel produced:

- 12 paired cells, all byte-identical between DFS and the selective arm;
- 132 loss crossings suppressed by the conservative deadline;
- zero executed backtracks and zero unavailable alternatives;
- validity 6/12 in both arms (the other six baseline runs were also incomplete).

At 750k, a four-case x one-seed active-mechanism panel produced:

| Case | Backtracks | Resumed | First completion DFS -> selective | Score delta | Valid |
|---|---:|---:|---:|---:|---:|
| `river_reentry` | 0 | 0 | 415,584 -> 415,584 | +0.000 | yes/yes |
| `dense_dialogue` | 0 | 0 | 497,212 -> 497,212 | +0.000 | yes/yes |
| `frontier_pickup_progression` | 0 | 0 | 553,934 -> 553,934 | +0.000 | yes/yes |
| `believer_impact_56s` | 7 | 0 | 264,682 -> 557,454 | +5.220 | yes/yes |

All seven events promoted a concrete available sibling; no identity invariant
failed. Their rewinds ranged from 1 to 12 gaps and every conservative target
margin was at least 2.047. The score gain is one deterministic association and
must not be generalized. More importantly, the active row delayed first
completion by 292,772 frames. Production repair begins at first completion, so
the full compiler comparison must measure whether this traversal investment
beats the repair work it displaces.

## Canonical V1 mechanism audit

The governed canonical run establishes a sharper distinction between the
scheduler capability and the V1 policy. At N=48:

- 126 of 2,112 cells executed at least one selective backtrack;
- 756 backtracks executed: 755 initial and one repair;
- only 15 suspended continuations resumed;
- 26,613 of 27,369 signal crossings were suppressed by the conservative deadline;
- no remembered alternative was missing;
- baseline and candidate validity were identical at 2,111/2,112;
- the paired headline estimate was +0.0035 +/- 0.0340 SE, with 95% interval
  [-0.0878, +0.0948] and directional P+ 54.08%.

The action was heavily concentrated: the two `believer_impact_56s` variants
accounted for 96/126 active cells and 707/756 backtracks. Across all events the
median rewind was 10 gaps (median contact advance 11). Ordinary DFS then searched
the promoted sibling's whole live subtree before the suspended node, so retaining
that node in the frontier was technically non-pruning but rarely operationally
reversible within 750k.

Paired telemetry on the 126 active cells makes the trade clearer. Median first
completion moved 284,159 frames later, median leaves considered increased by 70,
and repair episodes fell by one (mean -1.48). The active-cell score delta ranged
from -17.55 to +36.20. The two dominant long cases delayed first completion by
about 277k-295k frames on average and regressed, while several sparse/local cases
showed large mean gains. This is heterogeneous causal action, not an inert arm;
the aggregate happens to balance almost exactly at this budget and weighting.

This does not support promoting V1 at the measured canonical 750k setting. It
does identify a concrete limitation of this first disposition rule: retaining
a node below an unbounded sibling subtree rarely makes suspension reversible
within the measured budget. The trigger, exact sibling identity, and general
scheduler capability are working and remain promising infrastructure.

Nothing here tests the wider selective-backtracking family. In particular it
does not establish behavior at higher budgets, with repair-relative signals,
with local rather than old watch points, with different rewind targets, or with
bounded/interleaved subtree scheduling. A sparse aggregate result from this one
policy must not be read as evidence against those schemes.

## Strategy space

Future arms should be described as explicit choices on independent dimensions,
so experiments accumulate knowledge instead of becoming a bag of constants:

| Dimension | Example choices |
|---|---|
| signal | realized authored-axis regret; local-gap regret; prediction surprise; repair-incumbent deficit; search plateau |
| branch point | causal runner-up; nearest eligible watch; highest estimated value per work; weakest affordable authored gap |
| disposition | prune; suspend under a whole subtree (V1); bounded excursion; equal-depth tournament; interleaved work quanta |
| alternative breadth | one exact sibling; top-k sibling tournament; limited-discrepancy paths containing one or two rank deviations |
| phase | initial only; repair only with incumbent-relative evidence; both through one shared policy |
| budget response | conservative completion admission; probe-work allowance; rewind depth or tournament breadth scaled from remaining-work evidence |

The dimensions should remain separable in code. For example, a good trigger
must not force an unbounded disposition, and a repair-relative comparator must
not require a repair-only scheduler. Higher-budget behavior is an open question;
the current canonical run measures only 750k and no multi-budget sweep is being
started here.

## One focused next policy: bounded equal-depth excursion

The focused successor should separate *asking an alternative for evidence*
from *committing the rest of the compile to its subtree*:

1. A regret trigger suspends the current prefix and names the same exact queued
   sibling as V1.
2. The scheduler gives that alternative a bounded excursion, advancing one
   preferred viable child at a time toward the suspended prefix's contact
   depth. Nested voluntary backtracks are disabled inside the excursion.
3. At equal contact depth, compare authored-prefix axis loss on like-for-like
   prefixes. Continue the better prefix; retain the other in the ordinary
   frontier.
4. If the probe dies or reaches its explicit work allowance before catching
   up, resume the suspended prefix immediately. Any already-created ordinary
   siblings remain valid frontier work; no node is regenerated.
5. Record excursion starts, catch-ups, deaths/timeouts, charged work, the
   equal-depth loss contrast, selected side, and eventual loser resumption.

This is one especially direct follow-up, not a claim that the scheme space has
been exhausted or ranked conclusively. Other promising families include local
watch expiry, score-relative repair traversal, budget-dependent rewind depth,
interleaved subtree quanta, and alternative target selection. The excursion is
a general frontier strategy, not repair. Its bound is the suspended prefix's
exact authored gap, with ordinary fixed-budget deadline admission; it does not
read wall time or benchmark identity.

### Implemented clean-break arm

The accepted successor is the unset production policy.
`LR_FRONTIER_POLICY=selective-axis-regret-catchup` names it explicitly, while
`LR_FRONTIER_POLICY=dfs` retains the old traversal as a diagnostic control. The
closed V1 environment value is rejected; its compiler snapshot remains bound to
the retained study artifact, so the live code has one selective strategy.

For each admitted trigger, the scheduler removes the exact causal sibling from
the ordinary frontier and follows only its preferred viable child until it
reaches the suspended prefix's exact gap. Every non-preferred child created by
that work is retained in its normal frontier lane. Voluntary nested backtracks
are disabled during the probe. At equal gap, the two prefixes have the same
authored history: the lower authored-prefix axis loss continues and the other
prefix remains queued. A dead end, deferred node, or local execution ceiling
returns immediately to the suspended prefix.

Telemetry closes every trigger with catch-up outcome, end gap, processed nodes,
charged frames, equal-depth axis loss and gain, selected side, and later
resumption. Aggregate counters distinguish completed tournaments, current vs
alternative selection, dead ends, deferrals, and ceiling stops.

On the repair-disabled `believer_impact_56s` seed-0 750k mechanism probe:

- five excursions all reached equal depth;
- three retained the current prefix and two selected the alternative;
- four suspended prefixes resumed (V1 resumed none on this probe);
- 59 preferred-path nodes and 288,947 frames were charged to catch-up;
- first completion was 422,333, versus 557,454 for V1 and 264,682 for DFS.

This is mechanism evidence, not a performance conclusion. It confirms that the
new disposition prevents whole-subtree starvation and makes a measured
like-for-like decision. It also exposes probe work as the next quantity whose
value must be tested.

### Canonical result and deliberately narrow conclusion

The full canonical 750k campaign accepted this environment-gated arm at N=48:

- headline 604.1850 -> 604.2665, delta +0.0815;
- seed-block SE 0.0358 and directional probability 98.6294%;
- calibrated N=48 acceptance requirement 97.2265%;
- validity unchanged at 2111/2112;
- sequential looks continued at N=8, N=16, and N=32, then accepted at N=48.

Across all 2,112 cells, 126 activated the policy. They produced 598 bounded
tournaments: 565 reached equal depth, 194 selected the alternative, 371 kept
the current prefix, 33 probes died, and 404 suspended prefixes later resumed.
The probes processed 5,148 nodes and charged 23,070,186 frames. The two
`believer_impact_56s` cases account for 551 of the 598 tournaments, so this is
not evidence of broad activation across the catalog.

This result establishes only that this first bounded-catch-up scheme is useful
at the canonical 750k budget. It does not rank selective-backtracking families,
identify a best trigger or excursion rule, establish higher-budget behavior,
or imply that the strategy space is close to exhausted. It is positive evidence
for continuing the general direction. The formerly environment-gated arm was
subsequently made the unset production behavior. Because that source change
gives it a new compiler identity, the canonical result must be reproduced with
no policy environment before the campaign baseline is promoted.

That confirmation completed at N=48 with the exact same four look estimates and
the exact same final +0.0815 delta. Its compiler snapshot declares an empty
compiler environment and the governed action is `accept`. It was promoted as
the active 750k campaign baseline `selective-axis-regret-catchup`, with headline
604.2665. The promotion does not change the conclusion's scope: this is a
successful first scheme and a foundation for further selective-backtracking
work, not a final strategy or a claim about unmeasured budgets.

## Efficient successor funnel

The first post-promotion panel added behavior-neutral, like-for-like loss
checkpoints while each alternative catches up. On 160 exact canonical cells
covering the active gains and regressions, the instrumented compiler and the
promoted reference produced zero changed tracks and identical scores/validity.
The 194 observed tournaments supplied 84 offline early-stopping rules without
84 compiler runs.

Intermediate loss sign agreed with the eventual full-depth winner only 60-69%
of the time. The strongest zero-contradiction early rejection rule saved just
123,704 measured frames across a 120,000,000-frame panel (0.10%). That is useful
negative design evidence: a progressive sign guard is too weak and too noisy to
justify a live arm yet.

The same panel identified a stronger budget-allocation axis. Catch-up consumed
150k-288k frames in the dominant long compiles. Once accumulated catch-up work
reached 30% of the fixed 750k budget, ten later tournaments remained; every one
eventually retained the current prefix. Study arms therefore bound cumulative
catch-up work at 20%, 25%, or 30% of the compile's fixed budget. The bound is an
admission quota: an admitted tournament finishes, then later triggers are
suppressed once accumulated charged probe work has reached the quota. This
keeps the operation deterministic, scales with budget, and never truncates an
in-flight comparison. These categorical arms are evidence probes, not new
defaults.

### Catch-up work-quota result

The live paired experiment rejected that global quota family. Quota 20 lost
43.0668 points over its first 32 affected cells. Quota 25 looked positive in
its selection block but finished at -10.4256 over 64 affected cells after a
fresh block. Quota 30 was deliberately carried through all 48 canonical seed
identities on the two active cases: its three disjoint blocks summed +8.4073,
+0.4808, and -6.0710. Combined, that is only +0.0293 per affected cell with
0.2208 seed-block SE (t = 0.13), with no validity changes. The base believer
case regressed while its amplitude variant improved.

No quota arm earned a canonical run or promotion. The conclusion is narrow but
useful: cumulative probe work alone does not identify expendable tournaments.
Some late tournaments remain valuable. The next efficient experiment should
improve the value decision at equal depth (where the promoted policy currently
switches on any positive authored-axis gain), or estimate tournament value
before admission; it should not keep sweeping nearby quota percentages.

### Equal-depth selection-margin arms

The next live family keeps admission, probe work, and the causal alternative
identical. It changes only the equal-depth disposition: the alternative must
beat the current prefix by a predeclared minimum authored-axis loss gain before
it takes traversal priority. The production policy retains its exact strict
positive-gain rule. Study arms use 0.0025, 0.005, and 0.01.

This bracket comes from the behavior-neutral checkpoint panel, not from output
score fitting. Of 68 alternative selections, 15 had gain below 0.0025, 30 below
0.005, and 46 below 0.01. The ladder therefore changes roughly one quarter,
one half, and two thirds of observed alternative dispositions while charging
the same tournament work. It tests whether tiny prefix wins are robust enough
to justify changing paths; it is not expected to save catch-up frames directly.

The compact live bracket rejects that direction. Across the 16 affected cells,
the 0.0025, 0.005, and 0.01 margins lost 15.1900, 33.4235, and 52.5831 points
respectively, with no validity changes. Both affected sources were negative at
every rung in aggregate, and the loss grew monotonically with the margin. The
arms therefore stop at eight seeds: none warrants replication or canonical
evaluation.

This result strengthens the comparison signal rather than weakening it: even
tiny positive equal-depth axis gains are useful. It also motivates the mirror
experiment. The strict zero boundary may be too conservative if a nearly tied
alternative offers path diversity or better downstream potential. A symmetric
tolerance bracket can test that with the same work and the same paired funnel.

The mirror study arms therefore set the equal-depth gain threshold to -0.0025,
-0.005, or -0.01. In the checkpoint panel those doses would newly select 13,
37, and 62 of the 123 alternatives currently classed as losers. The default
remains a strict positive-gain comparison. As with the rejected positive
margin, admission and catch-up work do not change; only which equal-depth prefix
receives traversal priority changes.
