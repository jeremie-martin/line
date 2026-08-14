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

That mirror bracket is negative too. Across the same 16 affected cells,
tolerances 0.0025, 0.005, and 0.01 lost 15.0410, 26.3719, and 39.4053 points,
with no validity changes. The smallest rung has seed-block t = -1.83; the two
wider rungs are below -2.0. Together with the positive-margin result, this is
useful local evidence that the sign of authored-axis gain is a meaningful
disposition boundary. Both experimental families are closed rather than left
as live knobs.

The next observation pass moves to the trigger. Each causal watch now reports,
without changing traversal, whether its realized regret ever crosses 0.05,
0.10, 0.15, or the production 0.20 threshold, and whether the exact sibling is
actually admissible at that point (present, below the execution ceiling, and
outside conservative deadline pressure). Counts are unique per watch and each
threshold, not repeated mature-node checks. One shallow full-catalog pass can
therefore locate lower-threshold action sets before any live policy variants
are built.

### Lower-trigger opportunity map

The behavior-neutral map is complete at the canonical 750k budget on the first
two canonical actual seeds (16 and 17), all 44 sources, and 88/88 valid runs.
Every scored drift-report hash, score, and validity result exactly matched the
promoted baseline. The analyzer also verifies per run that threshold counts are
nested, that 0.20 crossings equal the old production crossing counter, and that
0.20 admissible watches equal actual selective backtracks.

Production admitted 26 watches across five runs and three sources. A 0.15
threshold observed 76 admissible watches: 50 additional opportunities, still
limited to seven runs and five sources. At 0.10 the action set jumps to 247
admissible watches (221 additional) over 18 runs and 12 sources. At 0.05 it
reaches 753 (727 additional) over 50 runs and 29 sources. These are genuinely
different intervention sizes, not four interchangeable nearby constants.

The focused next arm is therefore 0.15. It changes only the realized
authored-axis-loss trigger; maturity, causal sibling identity, conservative
deadline admission, bounded catch-up, and equal-depth disposition stay fixed.
The five-source action set is tested first. The offline counts are not treated
as a replay: taking an earlier backtrack changes later traversal, so live
behavior and output must be measured directly.

The first live 0.15 grid used those five sources, eight canonical seeds, and two
automatic cross-stratum controls. All 56 paired cells stayed valid; 16 changed,
with ten improvements, six regressions, and +35.3555 total score. Seed-blocked
movement was +0.6313 per grid cell with 0.2783 SE (t = 2.27). The controls were
exactly unchanged, and four of five target sources were positive in aggregate.

That attractive aggregate is not yet independent: seeds 16 and 17 helped
select the five-source action set. On the six fresh seeds 18-23, the targeted
mean remains positive at +0.6081 but has 0.4454 SE (t = 1.37). A second block
on predeclared fresh seeds 24-31, with the exact same sources and policy, is
therefore required before spending a canonical evaluation. Mechanically the
lower threshold raised tournaments from 100 to 124 and probe frames by 495,905;
the extra completed decisions overwhelmingly retained the current path (21
more) rather than selecting the alternative (one more), an important behavior
to carry into the confirmation analysis.

The fresh seeds 24-31 did not confirm the preview: all cells remained valid,
but the targeted block lost 11.6737 points, a mean of -0.2918 with 0.4188 SE.
Across all 14 fresh seeds (18-31), movement is +0.0938 with 0.3193 SE (t =
0.29), with 14 improved, 13 regressed, and 43 tied cells. The three sparse and
split-signal sources never moved outside the two source-selection seeds. Only
the believer pair remained active, with opposing aggregate signs.

The 0.15 arm is therefore closed without a canonical run. This is not evidence
that lower triggers cannot work: the arm consistently created 24 more
tournaments per eight-seed block and spent roughly 0.5M-0.6M more catch-up
frames. It is evidence that this small dose remains too sparse and its added
work has near-zero measured value. Any next lower-trigger experiment should be
a deliberately broader strategy intervention, measured on the full catalog or
a source panel fixed before its live outcomes—not another adaptively chosen
five-source confirmation.

### Shallow lower-trigger hybrid

The failed unbounded 0.15 arm also identifies a cleaner next strategy. Across
its two eight-seed blocks, 162 tournaments triggered below the production 0.20
boundary and consumed 6,544,506 frames. Only 33 of those rewound at most seven
gaps; they consumed 775,943 frames (11.9% of the work). Among completed probes,
the shallow subset selected the alternative 15/31 times, versus 53/160 for the
whole lower-trigger set. Long lower-regret rewinds were therefore both the main
cost and more likely to return to the prefix they interrupted.

The next arm keeps 0.20 as the unrestricted production trigger and admits the
lower 0.15 threshold only when the concrete rewind is at most seven gaps. This
is a hybrid trigger surface, not another global threshold. It directly tests
the earlier idea that available budget should not by itself justify restarting
far back. The failed pure-0.15 environment value is removed; the live study has
one categorical name and reports both its lower-trigger rewind cap and unique
cap suppressions.

Its first screen is fixed before execution: all 44 canonical sources at 750k
on fresh actual seeds 32 and 33. That avoids selecting sources from the same
outcomes used to judge the arm. Two seeds can only screen mechanism and
direction; they cannot authorize a canonical evaluation.

The cap-seven all-source screen stayed valid in all 88 cells and was genuinely
cheap: seven additional backtracks and 99,330 additional probe frames. Its
score was nevertheless flat-negative at -0.4361 total, with four improvements,
three regressions, and 81 ties, so it fails the predeclared positive-sum gate.

There is one non-arbitrary refinement left. In the two prior unbounded panels,
cap six retained 15 lower-trigger events and 279,894 frames; cap seven retained
33 events and 775,943 frames. The added rewind-seven shell chose the alternative
only five times and returned to the interrupted current prefix 13 times. Cap
six therefore removes a mechanically distinct low-yield shell, not merely one
unit from a tuned constant. It receives a separately named, fresh all-catalog
screen; cap seven is closed and its environment value is removed.

The cap-six screen was exactly behavior-neutral on fresh actual seeds 34 and
35: all 88 paired cells were valid and all 88 tracks and scores tied. This was
not caused by a missing signal. The candidate observed 1,500 watches crossing
0.15 versus 1,104 crossing 0.20, and found 52 generically admissible 0.15
watches versus 22 at 0.20. But all 30 additional opportunities required a
rewind greater than six gaps. Consequently both arms executed the same 22
backtracks, made the same 8 alternative and 14 current-prefix selections, and
spent the same 959,939 catch-up frames.

This closes the fixed rewind-cap family. Cap seven was active but flat-negative;
cap six had no action set on its fresh full-catalog screen. Neither warrants a
canonical evaluation, and another adjacent integer cap would be parameter
tuning rather than a new hypothesis. The next strategy should predict the value
of an individual tournament from its expected work and local evidence instead
of treating rewind distance itself as the decision rule.

### Conservative-reserve admission

The next arm uses the cost signal the compiler already has. Every prospective
alternative carries a conservative completion margin: policy budget remaining
divided by the upper-interval estimate of work from that exact sibling to the
end. Production admits once this margin is outside deadline pressure (2.0 or
higher). The study arm requires 2.25, reserving an additional quarter of the
estimated upper-bound suffix cost for later search and repair work.

This is not a blind time cutoff and it is not fitted from output scores. In the
retained N48 production archive, the rule would have suppressed 79 of 598
observed tournaments across 68 runs and 17 sources. Those contain 47 eventual
current-prefix selections, 14 dead/deferred outcomes, and 18 of 194 eventual
alternative selections, for 3.60M of 23.07M measured catch-up frames. Thus it
retains 90.7% of observed alternative winners while targeting 15.6% of work.
Those labels are design evidence only: changing admission alters later search,
so a fresh paired run remains necessary.

One categorical arm is predeclared on all 44 sources, fresh actual seeds 36 and
37, and the canonical 750k budget. It advances only on preserved validity,
positive total direction, and non-isolated movement. There is no adjacent
margin sweep; failure closes this hypothesis.

The fresh screen rejects the arm. Both sides completed all 88 cells, but only
three tracks changed: one improved, two regressed, and the both-valid score sum
was -11.2014. The arm did perform its mechanical job: six reserve-band
suppressions reduced backtracks from 24 to 22 and catch-up work from 919,011 to
761,558 frames. The saved 157,453 frames nevertheless produced worse completed
tracks. No validity movement is involved.

This is also a methodological result. A tournament eventually retaining the
current prefix is not evidence that skipping it is score-neutral: running the
tournament changes frontier order and consumes budget, while skipping it makes
that work available to a different continuation. Historical tournament outcome
is useful for sizing an action set, but it is not a causal value label. The
reserve arm is removed, and no neighboring margin is tuned.

### Multi-sibling opportunity map

The current causal watch retains the ranker's first runner-up and selective
catch-up probes only that sibling. Ordinary search admits up to three children,
so a second nonpreferred sibling may still be present when regret matures. A
multi-sibling tournament would be a genuinely broader search strategy: catch
both alternatives up to the interrupted depth, compare three like-for-like
prefixes, and schedule the best first while retaining the others.

Configured branch width is not evidence that the third child survives until a
trigger. Behavior-neutral telemetry now records accepted alternative count at
watch creation and exact live additional-sibling availability at each executed
backtrack. A predeclared 32-cell paired panel covers the four believer cases,
the sparse-lowline pair, and the meter-exchange pair on fresh seeds 38-41. It
must be byte-identical to its reference. A live arm follows only if at least ten
production backtracks occur and at least half still have another sibling.

The observation panel passes both gates. Its automatic stratum controls expand
the run to 40 paired cells; all 40 tracks, scores, and validity outcomes are
identical. It records 5,358 causal watches, of which 5,351 have two alternatives
at creation. More importantly, all 47 executed production backtracks still have
exactly one additional sibling in the live frontier. The opportunity is thus
universal in the active believer cells, not an inference from branch width.

The next categorical arm generalizes the bounded catch-up operation itself. At
one admitted regret event it probes both causal alternatives independently to
the interrupted depth, compares the current prefix and every completed probe
using the same authored-prefix axis loss, and schedules the lowest-loss prefix
first while retaining every other prefix as ordinary frontier work. Trigger,
maturity, deadline admission, candidate generation, and ordinary DFS stay
unchanged.

The first implementation probes every live causal sibling sequentially under
the existing hard ceiling. Dead and deferred probes are recorded individually
and do not prevent the next sibling from being tried. Successful probes, the
current prefix, and all generated side branches are retained; only traversal
priority changes. The equal-depth order is authored-axis loss ascending, stable
on current prefix then original sibling rank, so production's strict tie rule is
preserved.

Telemetry is tournament-aware rather than stretching the old singular label:
each event names alternatives requested, every probe's ordinal/outcome/depth/
work/loss, and the selected ordinal. Aggregate probe work is the exact sum of
those records. The offline binary checkpoint analyzer excludes multi-sibling
events because one tournament winner cannot label several checkpoint streams.

The first live screen is deliberately focused: the two believer impact cases
that produced all 47 opportunities in the fresh map, actual seeds 42-49, 750k,
plus Benchmark V2's automatic cross-stratum controls. It advances only with
preserved validity, positive target-source sum, and more than one positive
changed target cell. This is a screen, never a promotion decision.

The focused screen is strongly positive. All 40 paired cells are valid; the 16
target tracks all change, with 12 improvements and four regressions, for
+39.2286 total. Every one of eight seed blocks is positive: target mean +2.4518
with 0.6798 seed-block SE (t = 3.61). The base believer case improves on all
eight seeds (+37.6545); its amplitude variant is heterogeneous but slightly
positive (+1.5741).

Mechanically, 61 tournaments run 122 probes, 120 of which reach equal depth;
the second sibling wins 13 tournaments. Catch-up work rises by 705,119 frames
and target first completion moves from 484,604 to 528,710 frames on average,
yet all tracks complete and score improves. The new telemetry validator checks
every per-probe ordinal, outcome, loss, frame/node sum, checkpoint bound, final
winner, and compile aggregate; the archive passes. A default-policy refactor
smoke is also exactly identical on eight paired cells.

The next screen broadens before it deepens: all 44 sources, fresh actual seeds
50 and 51, 750k. It asks whether movement and direction extend beyond the
selected believer panel. Only preserved validity, positive full-catalog sum,
and non-isolated positive movement justify a larger independent confirmation;
N2 cannot justify canonical evaluation.

The breadth screen passes narrowly: all 88 cells are valid, five tracks change,
three improve and two regress, for +0.5988 total. Seeds 50 and 51 have opposite
small directions. Movement is not believer-only: `high_air_drive_air_minus_5`
gains +1.2281. Over the believer pair, pooling the untouched focused block and
these two fresh seeds gives +1.9300 per cell with 0.6475 SE (t = 2.98), nine of
ten seed blocks positive. This is enough to continue, but far too little to
call the catalog direction established.

A fresh confirmation is fixed on actual seeds 52-67 and four target sources:
the believer pair plus `high_air_drive` and its air-minus variant. Benchmark V2
adds capability and legacy controls, yielding 96 cells per arm. A canonical
N48 evaluation follows only with preserved validity, positive fresh target sum,
at least ten of sixteen positive target seed blocks, and non-isolated movement.
The canonical evaluator—not this screen—remains the promotion authority.

The fresh confirmation decisively rejects that exact allocation. All 96 cells
in both arms remain valid, so there is no completion-failure explanation: the
candidate's completed tracks lose 111.2914 points in total (11 better, 19
worse, 66 tied). Seed-blocked movement is -1.1593 +/- 0.4289 per cell
(t = -2.70); on the four target sources it is -1.2442 +/- 0.4222 (t = -2.95),
with only five of sixteen seed blocks positive. The high-air pair never moves;
both believer cases reverse, and one regression-control cell loses 31.6615.

The mechanical result explains the next design boundary. Always probing the
second sibling spends 1,226,368 more catch-up frames in this panel, while the
second sibling is ultimately selected in only 28 of 129 tournaments. The
always-probe-both arm is closed without a canonical run. This does not reject
multi-sibling search: the next categorical design asks for the second sibling
only as a fallback when the runner-up failed to catch up or did not strictly
beat the interrupted prefix. It preserves an extra escape route while avoiding
the measured cost of trying to improve an already winning runner-up.

That second-chance design is now predeclared as a clean replacement diagnostic,
not another live legacy mode. Its fresh 750k screen uses actual seeds 68-75,
the believer and high-air pairs, the regression-transition source, and one
automatic capability control (48 cells per arm). It advances only with complete
validity, positive target sum, at least five of eight positive target seed
blocks, non-isolated improvement, and no target-cell loss of 20 points or more.
No multi-budget or canonical run is authorized by this screen.

The screen is positive but fails its replication gate. Both arms complete all
48 cells; 14 believer tracks change, split seven better and seven worse, for
+11.6170 total. The target seed-block mean is +0.2904 +/- 0.3373 (t = 0.86),
with four positive and four negative seeds rather than the required five. The
other 32 cells are bit-identical and no target cell loses more than 3.10.

Mechanically the rule is sound: 28 already-winning first probes skip their
second sibling, while 46 fallback probes still run and sibling two wins nine
tournaments. All skip and aggregate invariants pass. This is useful positive
direction, but not stable evidence: the exact arm closes without replication,
canonical evaluation, or promotion. A successor should change the signal or
work scheduling structure, not fit another threshold to these eight outcomes.

### Repair-incumbent regret opportunity map

The next structural signal uses information that does not exist during the
first completion: every repair has a complete incumbent. At a mature causal
watch, compare the active repair prefix with that incumbent through the exact
same authored gap. A positive delta says the attempted suffix is currently
worse than the track it must eventually beat. This is cumulative prefix loss,
not only the independently selected repair target's local SSE; earlier target-
ordering studies showed that improving one gap alone is not enough.

The first step is behavior-neutral. For thresholds 0, 0.01, 0.02, 0.05, and
0.10, telemetry counts each causal watch once and separately requires its exact
sibling to remain live, the local ceiling to remain open, and conservative
deadline pressure to be absent. No frontier order or simulation work changes.

The map reuses the existing all-catalog reference for actual seeds 50 and 51,
so only one new 88-cell arm is compiled. Exact identity of all tracks, scores,
and validity is mandatory. A live arm follows only if the highest threshold
with 20-200 admissible watches still spans at least four sources. That chooses
action breadth without looking at output deltas and authorizes neither a sweep
nor a canonical evaluation.

The map passes exact identity: all 88 tracks, scores, and validity outcomes
match the reused reference. At delta >0.02 it finds 74 admissible watches in
six runs and six source families. Delta >0.05 retains 20 watches but only two
families, so the predeclared score-blind breadth rule selects 0.02.

One live arm is fixed before execution. It preserves the production branch-
regret catch-up everywhere, and in repair only adds the same one-sibling bounded
equal-depth tournament when mature prefix loss exceeds incumbent prefix loss
through the same gap by more than 0.02. Fresh actual seeds 76-83 cover the six
mapped sources at 750k. Complete validity, positive total movement, five of
eight positive seed blocks, non-isolated improvement, and no 20-point loss are
required merely to continue; this screen cannot promote or launch canonical.

The live arm is positive in aggregate but fails that replication gate. Every
one of 48 paired cells is valid, so completion failures explain none of the
movement. Among completed tracks, three improve, two regress, and 43 tie for
+4.9291 total, but only two of eight seed blocks are positive (two negative,
four exact ties; mean +0.1027 +/- 0.3868, t = 0.27). `wide_breaths` gains
+7.2982 while `sparse_lowline_air_minus_4` loses 2.3691; the other four mapped
sources are exact.

The causal mechanics expose a better next boundary than threshold tuning.
The arm takes 47 incumbent-relative tournaments in only eight runs: 23 choose
the sibling and 24 retain the interrupted prefix for 189,854 probe frames. One
regressing sparse-lowline cell alone takes 28 of them before its repair attempt
returns a terminal. An incumbent-relative intervention is therefore not a
one-time decision under the current rule: each later branch can arm another
watch and trigger another tournament in the same repair DFS. The unrestricted
arm closes without canonical evaluation. The next categorical scheduler should
allow at most one incumbent-relative intervention per self-contained repair
attempt, while leaving production branch-regret events untouched; this tests
whether the useful signal can redirect a repair without repeatedly thrashing
its suffix.

### One incumbent-relative intervention per repair attempt

This successor makes the repair attempt—not the entire compile and not an
individual causal watch—the scheduling boundary. The first mature, admissible
incumbent-relative signal may run the unchanged one-sibling equal-depth
tournament. Later incumbent-relative signals in that same attempt are counted
but cannot launch another tournament. When repair independently selects a new
anchor and starts its next attempt, the allowance resets. Ordinary branch-
regret backtracks remain eligible regardless of this allowance.

The boundary is explicit in both code and evidence. Repair passes its iteration
index into the controller; every incumbent-relative event records it; the
offline validator rejects duplicate incumbent events within an attempt and
reports unique eligible watches suppressed by the limit. While adding this
attribution, the generic trigger-opportunity trust identity was corrected to
compare its branch-regret admission ledger with branch-regret actions only,
rather than incorrectly mixing in the new repair-incumbent action class.

The unrestricted live environment is retired. A fresh 750k screen uses actual
seeds 84-91 and the same six mapped sources (48 cells per arm). It requires
complete validity, positive total completed-track movement, at least three
positive moving seed blocks with more positive than negative moving blocks,
non-isolated improvement, no 20-point loss, and actual signal activity in at
least four runs. Sparse activity is underpowered, not evidence of neutrality;
passing this focused screen still cannot authorize canonical evaluation.

A known-activity mechanical smoke validates the boundary before consuming
fresh seeds. On sparse-lowline actual seed 77, the unrestricted arm had taken
28 incumbent-relative actions; the bounded arm takes one in repair attempt zero
and records 24 later eligible watches suppressed. All four smoke cells remain
valid and every analyzer invariant passes. Because that seed was deliberately
chosen from prior outcomes, its score is excluded from the fresh decision.

The fresh screen closes the arm. All 48 pairs are valid, so the result again
comes entirely from completed-track quality: three improve, two regress, and 43
tie for -4.8443 total (mean -0.1009 +/- 0.2117, t = -0.48). Two moving seed
blocks are positive, one is negative, and five tie; the predeclared gate needed
a positive total and at least three positive moving blocks. `wide_breaths`
accounts for -4.8595 while sparse-lowline is nearly neutral at +0.0152.

The scheduler nevertheless does exactly what it was designed to do. It takes
nine incumbent-relative actions across eight runs and two sources while
recording 186 later eligible watches suppressed. The unrestricted arm had 47
actions on its N8 panel. The remaining problem is action value, not repeated
suffix thrashing: eight of nine retained actions fire at the earliest possible
two-contact maturity and rewind one gap; the ninth fires after three contacts.
No confirmation or canonical run follows. The next behavior-neutral map should
ask whether incumbent-relative regret persists at deeper causal maturity before
another live traversal change is considered.

### Repair-incumbent maturity map

The next instrument is behavior-neutral. With the incumbent deficit fixed at
the score-blind 0.02 selected by the first opportunity map, it counts each
causal watch at minimum contact advances two through six. “Admissible” retains
the exact production meaning: the sibling still exists, the local execution
ceiling is open, and the conservative deadline is not pressured. Counts must be
nested as maturity rises, and the compile outputs must be exactly identical to
the reference before any count is interpreted.

Fresh actual seeds 92-95 cover the six mapped sources at 750k (24 cells per
arm). The score-blind selection rule takes the highest maturity with 12-120
admissible watches across at least four runs and two sources. If none qualifies,
the delayed family stops. If one qualifies, only then is a fresh one-action-per-
repair-attempt live arm predeclared. This small map avoids spending a canonical
or multi-budget run on an action set we have not established exists.

The map is exactly behavior-neutral: all 24 tracks, scores, and validity
outcomes match the reference. Regret does persist—admissible counts at advances
two through six are 38, 33, 26, 21, and 15—but breadth does not. Advances two
through five touch only three of 24 runs; advance six touches two. No maturity
meets the predeclared four-run minimum, so no delayed live arm is built. This
closes the present repair-incumbent signal family: unrestricted action,
per-attempt bounding, and delayed maturity now have distinct evidence. The next
policy should change the search signal or work disposition rather than tune the
same deficit threshold or contact count.

### Branch-point choice map

The next study returns to the general selective DFS rather than extending the
closed repair-incumbent signal. Production currently takes the nearest causal
sibling whenever inherited axis-loss regret justifies a backtrack. That is a
simple safe default, but it is a branch-order convention rather than an
evidence-backed value choice: an older sibling can be simultaneously live,
affordable, and associated with more removable regret.

The first step remains behavior-neutral. At each actual production branch-
regret action, telemetry records every watch on the active lineage that
independently passes the same regret, maturity, liveness, ceiling, and deadline
rules. The first entry must exactly equal the sibling production chose. Each
choice records its regret and conservative deadline margin, allowing categorical
counts for maximum regret, minimum estimated suffix work, and maximum regret
per estimated suffix work without pretending that any counterfactual was run.

Fresh actual seeds 96-99 cover the believer and sparse-lowline parent/variant
pairs at 750k; capability and regression controls are back-filled. All outputs
must exactly match commit `489d6e72`. One live policy follows only if maximum
regret per estimated work differs from nearest-first on at least 20 events
spanning four runs and two sources. This gate is score-blind. It asks whether a
materially different policy exists before spending fresh cells on its outcome;
the map cannot authorize canonical evaluation or a multi-budget sweep.

The map passes exact identity across all 24 cells. It observes 138 admissible
choices across 50 production actions; 29 actions have more than one choice and
one has 13. Yet maximum regret per estimated work differs from nearest-first on
only four actions in three runs and two sources, below the fixed 20-action,
four-run gate. Maximum regret differs on the same four actions, while minimum
estimated work never differs. Thus older siblings often remain nominally
available, but nearest-first is already strongly aligned with both conservative
suffix cost and regret per work. No live arm follows. A successor should change
the signal or the disposition of catch-up work rather than tune this ranking.

### One-discrepancy catch-up opportunity

The next categorical disposition stays inside the causal sibling rather than
adding siblings at the original branch. Production catch-up follows one greedy
preferred-child route to equal depth. Every nonpreferred child created along
that route is returned to the ordinary frontier. When the preferred route loses
the equal-depth comparison, the tournament therefore retains the interrupted
prefix even if an inner runner-up was already locally better at its own depth.

A behavior-neutral map records those inner runner-ups at the instant the primary
probe ends. A choice counts only if it is still in the frontier, has not skipped
an authored contact, and is outside conservative deadline pressure. Its axis
loss is compared with the suspended prefix through exactly the same gap. This
is not the closed multi-sibling design: those arms tried more siblings at the
original branch; this one permits one discrepancy later within the same causal
alternative.

Fresh actual seeds 100-103 cover the believer parent and amplitude variant at
750k, with the three other stratum controls back-filled (20 cells per arm).
Exact output identity to `e4f25232` is mandatory. A live arm follows only if at
least 20 current-selected production events have a strictly positive local
runner-up across four runs and both requested sources. The fixed policy would
choose at most one by positive prefix gain times conservative deadline margin,
extend it greedily to the original target, and use the unchanged strict equal-
depth winner rule. Opportunity breadth, never score, controls selection.

The map passes exact identity on all 20 cells and clears the action-set gate.
Of 48 production tournaments, 34 retain the current prefix. Twenty-three of
those 34 have a positive-gain admissible inner runner-up, spanning all eight
target runs and both believer sources; together they contain 598 admissible and
158 positive-gain choices. The fixed one-discrepancy arm is therefore authorized
for implementation and a fresh focused screen. This is breadth evidence only:
none of those unexecuted runner-ups has an observed equal-depth or final score.

### One-discrepancy live arm

The live arm adds one route only after the ordinary causal route reaches the
tournament target and fails to strictly beat the suspended prefix. From the
already-generated inner runner-ups it keeps only positive exact prefix gains,
selects maximum gain times conservative deadline margin with a stable tie, and
extends that one node by the ordinary preferred-child path to the same target.
The suspended prefix, primary route, and local route then use the unchanged
strict authored-axis ranking. No recursive discrepancy is allowed.

Telemetry treats this as a route within the same causal alternative, not as a
fictional second sibling. Every probe has a route kind and ordinal; the local
route names its parent route and exact parent choice. The analyzer verifies the
parent reached target and lost, the chosen option is the declared maximum, and
there is at most one local route. Binary checkpoint rules exclude these multi-
route tournaments because a primary checkpoint cannot label the local route's
eventual win.

A known-activity seed-100 smoke exercises three local routes across both target
sources. All reach equal depth; two win and one retains the suspended prefix;
all invariants pass. Its positive score movement is deliberately excluded from
decision evidence because opportunity activity on this seed was already known.
The fresh focused screen is fixed on actual seeds 104-111, the believer pair,
and three automatic controls at 750k (40 cells per arm). Both target-source sums,
five of eight seed blocks, four improved cells, full validity, bounded loss, and
eight action runs must pass before even a two-seed all-catalog breadth screen.

The fresh arm is positive but does not clear that breadth boundary. All 40
paired cells are valid. The 16 target cells sum to +9.2908; six of eight seed
blocks are positive, with seven improvements and seven regressions (mean
+0.5807 +/- 1.1611 seed-block SE). The amplitude variant gains +15.7513, but
the base believer loses 6.4630, violating the fixed requirement that both
source sums be positive. The exact arm closes without a catalog or canonical
run.

Mechanically, 36 local routes run in 15 target cells, 35 reach equal depth, and
ten win; they spend 532,299 frames. Five of the ten winners have zero remaining
gap advance: the inner runner-up was already at the tournament target, so no
search extension occurred. That is a free broader equal-depth choice rather
than the intended one-discrepancy search. A clean categorical successor can
require at least one remaining authored-gap advance. This is not a scored
counterfactual claim; it separates the mechanism before testing fresh seeds.

### Proper one-discrepancy successor

The categorical successor requires at least one authored-gap advance from the
inner runner-up to the tournament target. Everything else is unchanged. Among
positive nonzero-advance choices it still selects maximum prefix gain times
conservative deadline margin, runs at most one preferred-child extension, and
uses the same strict equal-depth final ranking. The closed environment is
retired rather than accumulated as another live mode.

This boundary is mechanical, not a score-fit threshold. A zero-advance node is
already at equal depth and therefore represents broader sibling selection, not
backtracking search. The first arm observed 31 nonzero-advance routes across 14
runs and both sources, so the successor remains broad enough to test. Its fresh
focused screen is fixed on actual seeds 112-119 at 750k with the believer pair
and three controls. Both source sums, five positive seed blocks, positive total,
four improvements, full validity, bounded loss, and eight action runs are again
required before a fresh two-seed all-catalog screen.

A known seed-100 smoke confirms the categorical boundary. Four proper local
routes run across both target sources, all reach equal depth, one wins, and no
selected choice has zero remaining advance. The analyzer's parent-choice,
argmax, primary-loss, one-action, and aggregate invariants all pass. As before,
the deliberately reused seed contributes no score evidence.

The fresh proper-discrepancy arm is stronger in aggregate but still misses its
replication gate. All 40 cells are valid. Both source sums are positive
(+9.3486 and +10.1701), and the target total is +19.5187, or +1.2199 +/-
0.7484 seed-block SE (t = 1.63). Four substantial improvements outweigh nine
mostly small regressions. Only four of eight seed blocks are positive, however,
short of the fixed five, so no catalog or canonical run follows.

Thirty-two proper local routes execute in 15 target runs, 31 reach equal depth,
and seven win, consuming 502,121 frames. The mechanism is broad and capable of
large gains, but its direction is not yet stable. A successor should use exact
route-progress evidence to improve or bound this work, rather than weakening
the replication rule or fitting a score threshold to these outcomes.

### Local-route sign-reversal map

The next step instruments that route progress without changing traversal. A
proper local route is admitted because it is strictly better than the suspended
prefix at its starting gap, but 24 of the 31 completed local routes in the fresh
screen lose by equal depth. The useful diagnostic is therefore not another
score-fit threshold: it is whether the route's exact cumulative axis-loss gain
turns non-positive at an intermediate authored gap, whether such routes later
recover, and how much measured search follows the first reversal.

Every checkpoint now carries an explicit route ordinal, route kind, causal
alternative ordinal, authored gap, route-local nodes and frames, and the two
like-for-like prefix losses. Validation binds it to exactly one probe result and
requires monotone, result-bounded counters. The analyzer deliberately excludes
the equal-depth target from intermediate progress: otherwise every eventual
loss would be mislabeled as an early stopping opportunity.

This map reuses actual seeds 112-119 and the retained proper-discrepancy archive
only for mechanism characterization. The new one-arm output must be exactly
identical in track, score, and validity; no reused score can select a policy. A
single fixed live successor is authorized only if first non-positive gains
occur on at least 12 routes across six runs and both believer sources, at most
10% recover to a strict target win, and at least 100,000 measured probe frames
follow those reversals. That successor would stop the local route at the first
such checkpoint. The observation remains non-causal: only a fresh live screen
can measure the changed frontier timing and final score.

The map passes exact identity across all 40 cells. Of 32 proper local routes,
21 have a genuinely intermediate checkpoint and 17 first become non-positive,
spanning 11 runs and both sources. A material 250,899 measured probe frames
follow those first reversals. Two of the 17 routes nevertheless recover to a
strict win at equal depth: 11.76%, above the prospectively fixed 10% ceiling.
The breadth and work gates pass, but the recovery gate does not, so the exact
first-crossing guard closes without a live arm. Prefix sign is informative, not
yet sufficient. A successor needs a new categorical signal such as persistence
or remaining-work context; it must not relax the observed threshold after the
fact.

### Persistent local-route sign validation

The closed first-crossing map can generate a new categorical hypothesis, but
cannot validate it. Route-shape decomposition—not score—shows why persistence
is a distinct design: one non-positive checkpoint gives 17 routes and two
recoveries; two successive checkpoints give nine routes and one recovery;
three give six routes, no recovery, and 129,998 measured frames after
confirmation. The value three is fixed here, before fresh evidence, rather
than selected again on the validation archive.

A fresh behavior-neutral map uses actual seeds 120-127 on the same focused
pair and controls. A streak requires three non-positive checkpoints at adjacent
authored gaps; recovery is assessed only when the equal-depth result exists.
The live persistence guard is authorized only if the event repeats on five
routes across four runs and both sources, has no observed strict target
recovery, and precedes at least 75,000 measured frames. Exact output identity
remains mandatory. If selected, the guard will receive fresh score evidence on
seeds 128-135; these map scores never participate in that decision.

The fresh map again passes exact identity across all 40 cells. Three-checkpoint
persistence occurs on ten routes spanning nine runs and both sources, and
181,143 measured frames follow confirmation. Nine routes have an observed
equal-depth result; one nevertheless recovers to a strict win. Thus breadth and
work replicate, but the fixed zero-recovery gate fails. The persistence guard
closes without a live arm. Together the two maps show that prefix sign is a
useful risk signal but not a stopping certificate. The next design should
preserve recovery paths and alter when their work is scheduled, rather than fit
another streak length or loss magnitude to these observations.

### Yielding local discrepancy scheduler

The next design uses the validated risk signal without treating it as a death
certificate. A local discrepancy still starts from the proper positive-gain,
nonzero-advance choice and follows the ordinary preferred route. If its exact
gain remains non-positive for three adjacent authored gaps, only its synchronous
equal-depth excursion stops. The exact live route returns as an ordinary same-
lane DFS sibling. The tournament-ranked routes, including the suspended prefix,
are pushed afterward and therefore run first, but the yielded route stays ahead
of older frontier work. A recovery path is postponed, not pruned, and may still
be explored by normal DFS if budget and frontier order reach it.

This is a categorical work-disposition change rather than another sign
threshold. Telemetry names `probe_yielded`, binds the final three checkpoints
to the yielded route, requires adjacency and a pre-target endpoint, and proves
that the route is neither completed nor tournament-selected. The runtime also
asserts that the exact SearchNode remains in the frontier, and telemetry records
whether and when that exact node is later selected by ordinary DFS. The closed
proper-discrepancy environment is retired rather than accumulated.

After a known-activity mechanical smoke, fresh actual seeds 128-135 cover the
believer pair plus controls at 750k. Advancement requires full validity,
positive target total, five positive seed blocks, both source sums positive,
four improved cells, no 20-point loss, and yields across five target runs and
both sources. Only then may fresh seeds 136-137 receive a two-seed all-catalog
screen. Neither this work nor its maps authorize a multi-budget sweep.

The known seed-121 smoke exercises two yields, one on each target source, with
all five cells valid and all route/aggregate checks passing. Both exact nodes
remain owned by the frontier at yield time, but neither is selected again before
the run exhausts 750k. This sharpens the claim: ordinary-DFS placement preserves
the path, not a promise that it receives later compute. The fresh screen tests
the resulting budget reallocation. It must not credit the arm with guaranteed
recovery or interpret the known seed's score.

The fresh focused screen clears every advancement gate. All 40 paired cells are
valid, so its +30.966 target sum is entirely completed-track quality. Eleven
cells improve, four regress, and one ties; six of eight paired seed blocks are
positive (block mean +3.8708 +/- 1.6344 SE, t = 2.37). Both source sums are
positive: +22.7901 on the base believer and +8.1759 on the amplitude variant.
The three controls are exact.

Mechanically, 38 local routes execute, 24 reach target, seven win, and 12 yield
across 12 target runs and both sources. None of the yielded routes resumes before
run end. This makes the causal interpretation narrower but cleaner: the live
effect comes from reallocating immediate budget away from persistently losing
catch-up work. The predeclared fresh two-seed all-catalog screen is now
authorized; a canonical headline remains unauthorized until that breadth check
shows positive, non-isolated movement without validity loss.

The all-catalog screen keeps all 88 paired cells valid, but fails the score and
breadth gate. Only two cells change; both are amplitude-variant regressions, for
-2.8317 total. All 42 other sources and the base believer are exact. No route
yields in these two seeds: four proper local routes reach target and one wins,
so the regressions belong to the underlying discrepancy search rather than the
yield action. The exact scheduler closes without a canonical run.

A retrospective three-arm decomposition on the already-observed focused seeds
clarifies the earlier +30.966 without changing the decision. Proper discrepancy
alone contributes +27.6140 versus production; yielding adds +3.3520 versus
proper, split six better and six worse cells. The important lead is therefore
the discrepancy search itself, while the current yield rule is only a small,
heterogeneous modifier. The next work should improve the quality of routes
inside that search—through a new branch-aware disposition or richer local
frontier—not tune the closed three-checkpoint guard or waive its catalog gate.

### Nested discrepancy opportunity

The next mechanism targets the larger lead exposed by three-arm attribution.
When the first proper local route loses at equal depth, it has itself generated
nonpreferred children along its greedy path. Those nodes already exist in the
ordinary frontier. A bounded second discrepancy could test one of them instead
of concluding that the local subtree has no better route.

The first step is again behavior-neutral. A dedicated map policy reproduces
proper discrepancy exactly and records the same live, affordable, non-skipped,
incumbent-relative choices on the first local route. First-level opportunity
counts are explicitly restricted to causal routes so the two depths cannot be
silently conflated. The closed yield traversal and compiler telemetry are
deleted; historical validation remains in the offline analyzer only.

The map deliberately reuses actual seeds 128-135 and the retained proper arm
only for mechanics, requiring exact track, score, and validity identity. A live
arm is authorized only if 12 losing local routes have a positive, nonzero-
advance nested choice across six runs and both sources. The fixed live policy
would choose one stable maximum gain-times-margin option only after the first
local route loses, extend it to the same target, and stop at discrepancy depth
two. Fresh seeds 138-145, not these known scores, would evaluate it.

The map passes exact identity on all 40 cells and clears the action-set gate.
Twenty-seven first-local routes reach equal depth and lose; 12 retain at least
one positive, nonzero-advance nested choice. Those routes span nine runs and
both sources and contain 66 qualifying choices (437 admissible choices in
total). This authorizes exactly one bounded depth-two live policy. It remains
breadth evidence only: none of those second routes has an observed equal-depth
or final-score result.

### Bounded nested-discrepancy live arm

The live arm gives routes explicit discrepancy depth. A causal route is depth
zero, the existing proper local route is depth one, and the single nested route
is depth two. Each local route names the exact parent route and choice that
created it. The second route can run only after the first local route reaches
equal depth and fails to strictly beat the suspended prefix; its choice uses the
same positive-gain, nonzero-advance, live, affordable, stable maximum gain-times-
margin rule. The final tournament ranks all completed routes once.

Depth two is a hard categorical boundary. It records no further choices, so the
implementation cannot silently become a recursive beam. The analyzer proves
parent depth, parent loss, argmax choice, target reach, route counts, and selected
depth. The map environment is retired rather than kept beside the live one.

Fresh actual seeds 138-145 cover the believer pair and controls at 750k. The arm
must preserve validity, have positive total and both source sums, win five seed
blocks and four cells, avoid a 20-point loss, and execute nested routes across
six target runs and both sources. Only then can fresh seeds 146-147 receive a
two-seed all-catalog screen; no canonical or multi-budget run is yet authorized.

The known seed-128 smoke executes three nested routes across both sources. All
three reach the original target with exact depth/parent/choice/argmax
attribution; none wins the final strict comparison. All five cells remain
valid. This confirms mechanism and bounds only—the known seed's score is
excluded, and route value awaits the fresh focused screen.

The fresh combined arm is +30.4206 versus production with all 40 cells valid,
both sources positive, and six of eight seed blocks positive. Nine nested routes
execute across seven target runs and both sources, but none wins the final
equal-depth comparison. A same-seed third arm resolves the attribution: proper
discrepancy alone is +37.7105 versus production, while depth two is -7.2899
versus proper (one better, two worse, 13 ties), driven by -8.9148 on the
amplitude variant.

The combined arm technically clears its original production-relative screen,
but a catalog run would misattribute inherited depth-one gains to a negative
depth-two mechanism. The nested policy therefore closes without catalog or
canonical evaluation. This is not evidence against aggressive search in
general; it is precise evidence that one more greedy discrepancy route consumes
budget without improving the selected prefix here. Proper depth one now has a
third independent positive focused block and becomes the candidate to evaluate
directly.

### Proper discrepancy replication and canonical qualification

Lean proper discrepancy now has three independent positive eight-seed focused
blocks: +19.5187 on seeds 112-119, +27.6140 on 128-135, and +37.7105 on
138-145. The already-run two-seed catalog context is -2.8317, with full
validity and only the amplitude target moving. Across all 26 paired target seed
blocks, the diagnostic sum is +82.0115, or +3.1543 +/- 0.8233 SE per paired
source block (t = 3.83); 17 blocks are positive and nine negative, and both
source totals are positive.

This pooling includes retrospective attribution arms, so it is not promotion
evidence. It does establish that the repeated gain belongs to depth one rather
than its modifiers: yielding adds only +3.3520 on its block, and depth two costs
-7.2899 on its block. The compiler is therefore simplified back to exactly one
proper local route. Nested depth, counters, and live traversal are deleted;
historical interpretation remains offline.

The candidate is now qualified for the actual canonical decision. The fixed
command requests the full N=48 campaign at 750k, whose existing sequential
looks are N=8/16/32/48 and whose one-sided probability decision—not an added
magnitude or source gate—controls acceptance. If accepted, the lean policy
becomes the sole default and follows the normal rebaseline workflow. No
multi-budget sweep is part of this decision.
