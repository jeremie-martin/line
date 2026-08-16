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

A clean seed-128 smoke after deleting depth-two scaffolding is exactly identical
to the retained proper arm on all five tracks, scores, and validity outcomes;
the analyzer passes. This verifies that simplification restored the intended
lean mechanism rather than creating a fourth behavioral variant. The canonical
campaign can now start from the committed source state.

The canonical campaign ran through every predeclared look. Its final N=48
headline is 604.2751 against 604.2665, a +0.0086 change with 0.0097 seed-block
SE and 81.01% directional probability of improvement. The final boundary
requires 97.23%, so the governed result is inconclusive and not promotable.
Running hundreds more seeds to resolve an effect this small would not be a
meaningful route toward the headline target.

Validity does not explain the result. Both arms are valid in 2,111 of 2,112
paired cells, with no candidate-only or reference-only validity outcome. The
one invalid cell is shared: `frontier_pickup_progression_shifted` at actual seed
635 stalls in both arms and therefore contributes zero comparative movement.
The exact weight-preserving both-valid counterfactual remains +0.0086 and the
validity-sensitive remainder is zero. Among jointly valid cells, 38 improve,
38 regress, and 2,035 tie.

The mechanism is safe but too narrow. The representative, capability, and
legacy-regression strata are exact; all movement remains in development music,
where `believer_impact_56s` is +0.25 and its amplitude variant +0.64 at N=48.
The strong focused-seed lead therefore does not reproduce as broad canonical
quality. Close this exact proper-discrepancy policy without promotion, remove
its live environment fork, preserve the archived telemetry in the analyzer,
and move to a categorically different selective-search design.

The retirement is complete. The parser no longer accepts the policy, the local
route execution and its parent/counter fields are deleted, and the normal
compiler exposes only causal catch-up routes. The causal routes continue to map
their already-generated inner alternatives because that map is behavior-neutral
and remains useful for designing a genuinely different strategy; it cannot run
one of those alternatives. The offline analyzer still validates the archived
proper-discrepancy evidence. A five-cell seed-128 smoke against the committed
pre-retirement default is exact: five valid pairs, zero changed tracks, and zero
score delta.

## Budgeted proactive branch tournaments

The proper-discrepancy closeout does not close proactive backtracking. It closes
one second-order route that could act only after production branch regret had
already launched a causal catch-up and that route had lost. The more general
question is whether deliberately sampling an alternative branch before death or
terminal completion can buy better decisions than spending the same frames on
ordinary DFS and post-terminal repair. Production's accepted bounded catch-up
is already positive evidence for that family; the next proof of concept must be
broader than another nested discrepancy and must expose its budget trade.

### Fixed proof-of-concept mechanism

Call the study operation a **budgeted periodic branch tournament**. It layers on
the production regret policy without changing candidate generation, ranking,
repair anchors, or the equal-depth comparator:

1. At every eighth authored contact ordinal, if production regret did not
   already act, look for the live causal runner-up exactly three contact
   advances behind the active prefix. If that exact rewind is unavailable, do
   nothing; do not silently choose a longer rewind.
2. Suspend the active prefix, remove that already-generated runner-up from the
   ordinary frontier, and advance its preferred viable route to the suspended
   prefix's exact authored gap. Nested voluntary backtracking remains disabled
   inside the excursion. All generated side branches remain ordinary frontier
   work.
3. Rank the two equal-depth prefixes by the existing strict authored-prefix
   axis-loss comparator and schedule the winner first. Neither side is pruned.
4. Admit the operation only when its conservative estimated rewind-to-target
   work fits both an explicit exploration allowance and the current execution
   episode after reserving 1.25 times the conservative target-to-terminal work.
   Periodic probe work may consume at most 15% of the policy budget by admission;
   an admitted comparison is allowed to finish and its actual charged work is
   recorded.

The constants are one categorical proof, not a parameter sweep. Eight contacts
makes the intervention regular but not continuous; three contacts creates a
real alternative path while bounding its comparison horizon; the 25% terminal
headroom and 15% exploration allowance make the cost visible without allowing
the proof to starve completion. A failed or inactive proof should change the
mechanism, not tune adjacent integers or percentages on the same outcomes.

### Causal separation and fixed panel

Two policies use the identical operation and differ only in where it may act:

- `periodic-initial`: initial search only, before the first terminal;
- `periodic-repair`: self-contained repair attempts only.

Production branch-regret catch-up remains active in every lane in both arms.
Snapshot and resumed lanes receive no new periodic action. Keeping the contexts
separate answers whether proactive work improves the first complete track or
the marginal return of repair; combining both before that attribution would be
uninformative.

The first live panel is fixed before outputs are observed:

- budgets: 750,000 and 1,250,000 frames;
- actual seeds: 150-153, shared across budgets and arms;
- requested sources: the believer-impact, sparse-lowline, high-air, and
  wide-breaths parent/variant pairs;
- Benchmark V2 mini-manifest controls: `frontier_pickup_progression` and
  `regression_transition_mosaic`, yielding ten sources and 80 cells per arm.

This is matched multi-budget evidence, not a canonical headline and not ten
independent copies of each seed. Analysis blocks by actual seed and reports each
budget separately before any pooled direction. No full canonical run or wider
budget sweep is authorized by this proof.

### Required attribution

Telemetry must distinguish production regret from periodic exploration and
record, per periodic opportunity and action: lane, contact ordinal, exact
rewind, conservative target and alternative work, estimated probe work,
episode frames remaining, terminal reserve, exploration allowance remaining,
admission or suppression reason, actual probe frames, equal-depth outcome, and
later resumption. Aggregate identities must reconcile those events with probe
work and lane/signal counters.

The paired report must separate validity from completed-track quality and, at
each budget, report first-terminal movement, periodic frames/actions/wins,
repair attempts/completions/accepted improvements, repair frames displaced,
and final score movement. The useful comparison is marginal value per charged
frame, not merely whether a more expensive policy sometimes finds a better
track. Four seeds can establish activity, mechanics, obvious failure, and a
direction worth investigating; they cannot establish a production improvement.

The pre-panel seed-150 integration smoke found and removed one accidental
restriction. The first repair build applied the production catch-up's binary
deadline-pressure gate before the new explicit episode reserve. It observed 30
exact periodic opportunities over five runs but admitted none. That was not the
policy above: it stacked a legacy boolean on the replacement budget controller.
After deleting only that redundant periodic gate, the same compile inputs admit
three repair tournaments in two runs while production branch-regret admission
remains untouched. The initial arm admits 22 tournaments in all five smoke runs.
All five cells remain valid in both contexts, the generic selective-telemetry
validator passes, and the dedicated analyzer reconciles opportunity, action,
probe-work, lane, reserve, first-terminal, and repair-episode ledgers. The smoke
uses one already-fixed panel seed and is integration evidence only; no constant,
source, or final decision is selected from its score.

### Two-budget result

The fixed panel completed all 240 cells: one shared production reference and
the two 80-cell candidate arms. Every run passed the full contract. The
dedicated `line.proactive-tournament-proof-analysis.v2` report validates policy,
lane, exact rewind, opportunity/action, budget arithmetic, actual probe work,
first-terminal, and repair-episode identities; the generic selective analyzer
also accepts both archives.

Initial-only is active everywhere. At 750k it admits all 323 exact
opportunities, spends 2,699,281 probe frames (9.00% of aggregate policy budget),
delays first terminal by 59,486 frames on average, and moves score by -0.6201
+/- 2.3251 SE per cell. At 1.25M it again admits 323, spends 3,890,737 frames
(7.78%), delays first terminal by 83,410 frames, and moves score by +0.1949 +/-
1.1057 SE. Those probe frames mostly replace later repair: repair work falls by
2.36M and 3.33M frames respectively. The paired high-minus-low change is only
+0.8150 +/- 2.7563 SE. Thirty-nine of 40 tracks move at each budget, so the
fixed cadence broadly rearranges search without a stable return.

Repair-only preserves the first terminal exactly and is isolated to cells that
actually act: every inactive cell is track-identical to production. The terminal
reserve is the binding gate. At 750k it admits 15 of 244 exact opportunities in
11 cells, spends 169,640 frames (0.57%), and moves score by -0.1479 +/- 0.1575
SE per cell. At 1.25M it admits 19 of 295 in 14 cells, spends 306,311 frames
(0.61%), and moves score by +0.0277 +/- 0.1013 SE. Its paired budget contrast is
+0.1756 +/- 0.2054 SE. Active-cell means change from -0.5377 to +0.0793, but
four seeds and activity-conditioned selection make this a lead, not a claim.

The work estimator is conservative in initial search (actual aggregate probe
work is 76-80% of estimate) and mildly optimistic in repair (111-117%). That
lane difference should be calibrated before materially broadening repair
admission. More importantly, neither exact periodic policy earns promotion or
a larger score campaign. Do not tune eight contacts, three-contact rewind,
1.25 reserve, or 15% allowance against this panel. Retain the bounded tournament
and its telemetry behind explicit experiment policies as a scaffold for one
categorically different, state-triggered opportunity rule; production remains
unchanged. The complete evidence and checksums are recorded in
`benchmark/v2/studies/proactive-periodic-tournaments-v1.json`.

## Value-ranked selective DFS campaign

The periodic proof rejects a cadence, not voluntary backtracking. Its deeper
lesson is that an excursion has two independent prices: whether this branch is
worth interrupting for, and how much search power the excursion itself may use.
The first policy ignored the former by acting every eight contacts and inherited
the compile-wide candidate breadth for the latter. Consequently the same 323
initial actions cost 2.70M frames at 750k and 3.89M at 1.25M. A larger compile
did not buy more decisions; it made each identical local decision more
expensive.

One deterministic repair outlier makes the missing local work boundary
concrete. `regression_transition_mosaic`, actual seed 151, starts a three-contact
repair tournament with estimated probe work 11,566/16,562 frames at 750k/1.25M,
then spends 59,061/89,638 frames and reaches the repair execution ceiling at
both budgets. The first probe node reaches the penultimate gap in 4,000 frames
at 750k with the alternative already worse, while the second atomic expansion
consumes another 55,061. This one event is 34.8%/29.3% of all repair-only
tournament work. A new trigger must not be evaluated while an optional probe
can silently inherit the rest of its episode.

### Phase A: behavior-neutral value map

The map is production traversal plus telemetry. It performs every accepted
production branch-regret action exactly as today and performs no new action.
At each authored contact boundary in initial or repair traversal, it considers
each live causal watch at maturity three or greater and records the first
crossing and first single-action admission for these value densities:

    max(0, current prefix axis loss - branch baseline axis loss)
    ---------------------------------------------------------------- × 10,000
                 conservative incremental probe frames

Thresholds are 0.005, 0.01, 0.02, and 0.04 axis-loss units per 10k estimated
frames. They are a coarse mechanism grid derived without final-score fitting:
in the retained periodic events, local alternative selection rises from roughly
34% below 0.01 raw regret to 42% at 0.01-0.03 and 48% at 0.03-0.10; density 0.04
is locally strong but sparse at 1.25M. The map also records lane, watch identity,
contact and gap rewind, raw regret, estimated probe work, terminal reserve,
execution remainder, and admission reason. Crossed/admitted identities are
unique per watch and threshold.

The fixed identity panel uses the same ten-source mini-suite as the periodic
proof, budgets 750,000 and 1,250,000, and fresh actual seeds 154-157. The map
arm and production reference therefore contain 80 cells each. Every track,
score, validity outcome, first-terminal frame, and repair episode must be exact;
otherwise no live policy follows.

Threshold selection is score-blind and separate by lane. Choose the highest
threshold that, at each budget, has at least 20 single-action admissions across
at least eight runs and four sources. The rule must also retain at least half as
many admissions at 1.25M as at 750k, preventing a threshold selected only on one
budget surface. Failure closes that lane for this campaign. Counts select only
an action set; they say nothing about output quality.

### Phase B: bounded live policy

Only a lane clearing Phase A receives a live arm. It removes periodic cadence.
At a contact boundary it ranks all newly threshold-crossing, live, mature,
single-action-affordable watches by value density, then raw regret, then nearest
rewind, with stable lineage order as the final tie. At most the winner launches
the unchanged one-sibling equal-depth tournament. Production branch regret has
priority and remains unchanged.

The exploration fund stays at the predeclared 15% and terminal reserve stays at
1.25 times conservative target-to-terminal work; they are not tuned on the
periodic scores. Unlike the periodic proof, admission and execution share one
actual optional-work ledger. Each action receives a local frame allowance equal
to the smaller of remaining exploration funds and execution remainder after
terminal reserve. Before another atomic probe node, the policy must either show
that the next node fits its remaining local allowance or yield the alternative
back to the ordinary frontier and restore the suspended route. A completed
atomic node may overshoot its estimate, but that overshoot is charged and no
further probe node may start. Speculative terminal tail completion is disabled
inside this bounded equal-depth excursion: it cannot help reach the comparison
target and is the likely source of the repeated 55k/73k penultimate-gap atomic
overrun. The first live arm deliberately retains ordinary budget-specific
candidate breadth and reports it, so the value trigger is not confounded with a
second breadth intervention. Its estimated-work denominator prices that width.
Probe-local breadth becomes a separate factorial only after the action itself
has positive evidence; production and ordinary repair breadth remain untouched.

Initial and repair remain distinct policies and evidence arms. The first live
screen uses fresh actual seeds 158-161, the same ten sources, and both budgets.
Each authorized lane receives 80 candidate cells against one shared production
reference. Analysis reports budgets separately, blocks uncertainty by actual
seed, and distinguishes local wins, yielded probes, actual/estimated work,
first-terminal movement, displaced repair, accepted repairs, final authored
score, and inactive identity. This screen cannot promote or launch canonical.

A lane merits one fresh confirmation only if all cells remain valid, its total
score is positive at both budgets, at least three of four seed blocks are
positive at one budget and no fewer than two at the other, its active-cell mean
is positive at both budgets, no cell loses 20 points, and the action set spans
at least eight runs and four sources at each budget. Otherwise close the exact
rule. Candidate-breadth interaction, longer race horizons, and canonical
Benchmark V2 remain out of scope until a value-ranked action has positive
marginal evidence.

### Phase A result

The fixed map completed all 160 compiles (80 map cells and 80 references) with
every cell valid. Track hashes, scores, validity, first-terminal frames, and
repair-episode ledgers are exact in all 80 pairs, so the instrumentation is
behavior-neutral on the declared panel.

The score-blind rule selects 0.020 for the initial lane. It admits 823 of 831
crossed watches at 750k and 561 of 561 at 1.25M, spanning all 40 runs and ten
sources at each budget. The stricter 0.040 threshold admits 394 and 194; it
misses the declared high-budget retention requirement by three admissions
(194 is less than half of 394), so it is not selected despite otherwise broad
coverage.

The repair lane is closed. At the broadest 0.005 threshold it admits only 46
watches across six runs at 750k, below the required eight; stricter thresholds
are narrower. Phase B is therefore initial-only at density 0.020. No repair
live arm, threshold exception, or score-based substitution is permitted.

### Phase B result and closure

The live screen completed all 160 compiles (80 candidate and 80 reference)
with every cell valid. Both the policy-specific and generic telemetry auditors
reconcile all actions, probe frames, candidate requests, local allowances,
atomic overshoots, disabled tail completion, outcomes, and lane attribution.
The policy acts in every run and source.

The direction is promising. At 750k the mean paired score is +0.6438 +/-
0.8549 seed-block SE, with three of four positive seed blocks. At 1.25M it is
+4.1376 +/- 1.8153, with all four seed blocks positive. The policy spends
3,462,229 and 3,874,420 probe frames in 446 and 311 actions respectively. Its
first terminal moves later by 51,193/41,790 frames on average, while ordinary
repair work falls by 2,063,149/1,681,858 aggregate frames. All 80 tracks change;
this is a broad search-order intervention, not a sparse repair.

The exact rule nevertheless closes. `regression_transition_mosaic`, seed 161,
loses 29.7908 points at 750k, violating the declared no-20-point-loss gate.
The other continuation clauses pass at both budgets. There is no exception,
confirmation, or canonical run for density-0.020 as implemented.

The mechanism evidence supports a distinct follow-up rather than a threshold
tweak. Actions in the first 10% of normalized gap progress select the local
alternative in only 26.8% of completed tournaments at 750k and 23.1% at
1.25M, versus 43.6%/47.1% in the 25-50% band. The early band contains 56/52
actions and spends 492,178/680,380 frames. The two low-budget transition-mosaic
tail losses both begin with voluntary actions in this early region. This is an
association with local outcomes, not proof that deleting those actions repairs
the final scores.

### Phase C: delayed value-ranked exploration

The next arm changes one categorical condition: value-ranked actions require
the current authored gap index to reach 10% of the specification's gap count.
Before that boundary production traversal, production branch regret, watch
lineage, and telemetry remain active, but value exploration cannot consume a
watch; it can become eligible after the boundary. Density 0.020, maturity
three, ranking, ordinary budget-specific breadth, the 15% exploration fund,
the 1.25 terminal reserve, local atomic-work boundary, and initial-only lane
remain exact. Ten percent is a round normalized horizon selected from the
predeclared progress bin, not from a final-score sweep.

The screen uses the same ten sources and budgets 750,000/1,250,000 with fresh
actual seeds 162-165. Its continuation gate is unchanged from Phase B. If it
passes, one confirmation uses seeds 166-169 under the same fixed contract. If
it fails, close the exact delayed rule. No canonical run, breadth interaction,
reserve tuning, or additional progress threshold is authorized by this arm.

### Phase C result and Phase D declaration

Delayed eligibility closes. All 80 candidate cells remain valid, but paired
means are -0.2919 +/- 1.8911 SE at 750k and -0.2049 +/- 1.8953 at 1.25M.
`regression_transition_mosaic` falls 30.34 points on average and contains the
largest losses. The exact rule therefore receives neither its reserved
confirmation nor a canonical run.

The failed mechanism is informative: delay reduces actions from 446/311 in
Phase B to 356/290, yet probe work rises from 3.46M/3.87M to 3.58M/4.85M.
Mean work per action increases from about 7.8k/12.5k to 10.1k/16.7k, and the
first-terminal delay grows to 61.5k/98.5k frames. A watch first valuable during
startup survives, accumulates more rewind, and can launch a more expensive
excursion after the boundary. Phase C postponed early work; it did not reject
the early opportunity.

Phase D keeps the same 10% normalized boundary but expires a value opportunity
when it first crosses density 0.020 before that boundary. Expiration affects
only the experimental value signal: the causal watch remains live for ordinary
frontier DFS and the production branch-regret rule. It cannot later return as a
deeper value-ranked rewind. Telemetry records every unique expiration and
reconciles it separately from admission, ranking, budget suppression, and
production priority.

Everything else remains fixed. The screen uses fresh seeds 166-169 over the
same ten sources and two budgets. The unchanged continuation gate applies. A
pass earns one confirmation on seeds 170-173; a failure closes this exact
startup-expiration rule. No alternate horizon, density threshold, reserve,
breadth, or canonical run is authorized by Phase D.

### Phase D result and campaign boundary

Startup expiration is the strongest arm in this compact campaign, but it does
not clear its predeclared gate. All 80 candidate cells remain valid and all 80
tracks change. At 750k the paired mean is +6.5534 +/- 1.3799 seed-block SE;
all four seed blocks are positive, 28/40 cells improve, and the worst cell is
-8.3812. At 1.25M the paired mean is +1.6031 +/- 0.7345; three of four seed
blocks are positive and 22/40 cells improve. The high-budget tail condition
fails on exactly one named cell: `regression_transition_mosaic`, seed 168,
loses 24.4130 points. The declared limit was -20, so there is no confirmation
and no canonical run.

The mechanism behaves as intended. The policy expires 62/55 pre-horizon
watches and admits 380/260 actions at 750k/1.25M. Probe work falls to
2,938,201/3,020,189 frames, or 9.79%/6.04% of aggregate policy budget. Unlike
Phase C, expiration does not turn a cheap early watch into a later expensive
rewind: mean work per action is about 7.7k/11.6k, close to or below Phase B.
There is one correctly bounded yield, no tail-completion work inside probes,
no local-allowance prefix overrun, and aggregate actual work is about 71% of
the conservative estimate at both budgets.

The added initial work continues to substitute for later search. First
terminal moves later by 54,489/41,557 frames per run, while repair work falls
by 2.19M/1.66M aggregate frames. At 1.25M the candidate reaches 80 accepted
repairs versus 91 in reference even though it attempts two more repairs. In
the sole tail-gate failure, first terminal moves 96,119 frames later, eight
value actions spend 93,207 frames, and only three repair episodes remain versus
six in reference. Its final impact quality falls from 0.5214 to 0.4810. These
facts establish allocation and outcome, not that any one action caused the
final loss.

The phase sequence separates three conclusions. A density-ranked voluntary
action has genuine positive score signal on this panel; merely delaying early
crossings is harmful because their rewind cost grows; expiring them fixes that
mechanical defect and greatly improves the observed mean, but still does not
control run-level tail risk. Counts of actions, local alternative selections,
and probe frames have only weak descriptive relationships with final paired
score inside either budget. The current local comparator therefore should not
be treated as a calibrated predictor of final-track value.

This closes the predeclared 10% horizon family. Do not tune a neighboring
horizon, density threshold, reserve, or exploration fraction on these scores.
A subsequent campaign should change a categorical mechanism: retain
score-blind opportunity selection, but test a run-level allocation or
progressive stopping rule that explicitly limits the amount of initial work
that may displace completion and repair. Such a campaign needs its own fresh
seeds and gate. The full canonical benchmark remains unwarranted until that
mechanism demonstrates both positive mean return and controlled cell tails.

## Run-proof progressive-allocation campaign

### Challenged assumption

The startup-expiring policy treats every admitted value opportunity as an
independent local purchase. Its strongest screen was positive at both budgets,
but repeated purchases can continue after an early probe establishes that its
causal sibling cannot even reach the equal-depth comparison target. The local
failure may be evidence about persistent run state, not merely one sibling.

The existing seeds 166-169 are motivation only. At 1.25M, the six runs whose
first voluntary tournament ended in `probe_dead_end` averaged -2.3677 against
production and include the -24.4130 and -17.7254 tails; later voluntary work in
those six runs consumed 266,451 frames. At 750k the corresponding three-run
cohort averaged +3.4763, so the relationship is not a conclusion and cannot be
used as an offline score splice. Fresh paired evidence decides the live rule.

### Frozen rule

Add the explicit experimental policy
`selective-axis-regret-catchup-value-initial-expire-10-run-proof`. It inherits
the closed startup-expiring policy exactly: density 0.020, maturity three, 10%
startup expiration, initial lane only, 15% compile-level optional-work fund,
1.25 terminal reserve, atomic local admission, no speculative tail completion,
and the existing equal-depth tournament and comparator.

It adds one compile-local state machine:

1. Begin `awaiting_first_tournament`.
2. The first actually admitted value tournament is the proof action. Production
   branch-regret actions and value opportunities lost to production priority do
   not count.
3. If any causal probe in that tournament reaches the equal-depth target, set
   `first_tournament_reached_target`. This includes both `current_selected` and
   `alternative_selected`: the proof concerns structural reachability, not
   whether the alternative wins one local comparison.
4. If no probe reaches the target (`probe_dead_end`, `probe_deferred`,
   `probe_budget_yield`, or `execution_ceiling`), set
   `sealed_after_failed_first_tournament`.
5. Once sealed, every later otherwise-eligible value opportunity is recorded
   as `run_proof_sealed` and cannot launch a voluntary tournament. Its watch and
   sibling remain available to ordinary DFS and production branch regret. No
   frontier node is deleted and no authored target is changed.
6. A successful first proof never seals the run after a later failure. This
   campaign tests a first-action latent-state hypothesis, not a failure-count or
   streak threshold.

### Telemetry and mechanical gate

Selective telemetry records the exact run-proof state, the first value event
index and outcome, whether that tournament reached its target, and the number
and identities of subsequent `run_proof_sealed` opportunities. Existing event,
atomic probe, budget, resume, and frontier telemetry remains authoritative.
Budget Telemetry stays V12 because the new state changes admission only and
introduces no new budget lane or episode stop reason.

Focused tests and a trace smoke must prove:

- unset production and all prior policy names remain exact;
- the proof state can change only once, after an admitted value tournament;
- a reached target proves the run regardless of local winner;
- a first tournament with no reached target seals all later value admissions;
- suppressed watches are recorded once and remain live for ordinary traversal;
- action, event, frame, candidate, resume, first-terminal, and Budget Telemetry
  identities reconcile; and
- disabling the new explicit policy leaves no run-proof effect.

### Fresh screen

Use the same ten-source compact panel, budgets 750k and 1.25M, actual seeds
186-189, four workers per arm, and summary Budget Telemetry. Candidate and
production reference come from one committed source; only the candidate gets
the new categorical policy. This is mover-grid evidence, not a headline.

The rule earns one confirmation only if:

- all candidate cells are valid and no reference-valid completion or contract
  is lost;
- total and active-cell paired means are positive at both budgets;
- at least three of four seed blocks are positive at one budget and at least
  two at the other;
- no cell loses 20 points;
- value actions span at least eight cells/four sources per budget; and
- sealing occurs in at least two cells/two sources per budget, so the score is
  not credited to an inert progressive gate.

A pass earns exactly one confirmation on seeds 190-193. A failure closes this
exact first-tournament proof rule. No density, horizon, allowance, breadth,
failure count, source exception, or canonical V2 run may be substituted.

### Progress ledger

| Date | Milestone | Status | Evidence |
|---|---|---|---|
| 2026-08-15 | Rule, state machine, telemetry, and score gates frozen | complete | This section |
| 2026-08-15 | Live implementation and mechanical proof | complete | `4fac0a4f`; 24 controller tests, focused telemetry/archive suites, targeted typecheck, and `generated/benchmark-v2/mover-grid/value-run-proof-mechanism-smoke/analysis.json` |
| 2026-08-15 | Fresh paired two-budget screen | closed | `generated/benchmark-v2/mover-grid/value-run-proof-two-budget-n4/analysis.json` |

The trace smoke used reused seed 168 only, so its scores are not decision
evidence. All 10 candidate and reference cells completed. The proof state was
reconstructed from raw events without mismatch: at 750k, four runs proved
equal-depth reachability and one failed proof sealed 14 later opportunities; at
1.25M, three proved and two failed proofs sealed 18 later opportunities. All
32 suppressions occurred after the attributed first action, no sealed run
admitted a second voluntary value tournament, and ordinary production
traversal remained available. This clears the mechanical gate for fresh seeds.

The fresh seeds close this exact rule without confirmation or canonical V2.
All 80 candidate and 80 reference cells completed and remained valid. The
paired mean was +0.9615 +/- 1.6271 seed-block SE at 750k and +1.1966 +/-
2.1938 at 1.25M; positive seed blocks were 3/4 and 2/4. These positive totals
do not establish a run-proof gain: the new proof state sealed only one 750k run
and four 1.25M runs, all on `frontier_pickup_progression`, whose source mean was
-0.2739 and -1.5782 respectively. Coverage therefore missed the frozen
two-source gate at both budgets. The tail gate also failed on
`regression_transition_mosaic`: -41.0883 at 750k and -30.8189/-22.8378 at
1.25M. Optional probe work delayed the first terminal by 45,967 and 36,553
frames on average and displaced 1,829,962 and 1,454,030 repair frames. No
source exception or post-hoc threshold is permitted.

Because the screen compares the full inherited Phase-D rule with production,
its positive total cannot isolate the new gate's five-run causal effect. A
small same-cell ablation against the ungated
`selective-axis-regret-catchup-value-initial-expire-10` parent is diagnostic
only. It may characterize the failed hypothesis, but it cannot reopen the
closed rule or substitute for its frozen gates.

That direct ablation is complete and reproducible through
`benchmark:v2:value-run-proof-ablation`; its artifact is
`generated/benchmark-v2/mover-grid/value-run-proof-parent-ablation/analysis.json`.
The five affected cells share an identical first tournament with the parent,
and all 11 overlapping unsealed cells are output-identical. Sealing improves
the sole 750k cell by +1.2635, but loses 18.1148 points over the four 1.25M
cells (-4.5287/cell), for -3.3703/cell overall. It saves 247,266 optional probe
frames and redirects 738,223 frames into repair, so the loss cannot be
explained as insufficient later search. The parent instead shows why the
state model was wrong: after the failed first tournament, 28 of 38 later
tournaments reach equal depth and 17 select the alternative. A failed probe is
route-local evidence, not a persistent run condition; more repair is not an
automatic substitute for this initial exploration.

## Phase E: challenge the compact tail veto at the real headline

The run-proof failure leaves the ungated Phase-D policy as the strongest broad
candidate. Two disjoint 750k ten-source panels now cover actual seeds 166-169
and 186-189. Reconstructing the one proof-affected cell from its direct parent
ablation gives the exact Phase-D aggregate: 80 cells, mean +3.7417 +/- 1.4523
seed-block SE, six of eight positive seed blocks, and complete validity. The
worst cell is -41.0883. This is both stronger evidence of positive average
return and honest evidence of a heavy tail.

The earlier campaign correctly closed under its predeclared no-cell-below--20
screening rule. This new campaign challenges the higher-level assumption that
such a cellwise veto is the right promotion instrument for a broad stochastic
search-order change. Benchmark V2 already has the authoritative instrument: a
48-seed, all-44-source 750k headline with strict N=8/16/32/48 sequential looks
and a one-sided probability decision. It retains every bad cell in the nested
headline and estimates whether the aggregate improvement is real. A compact
tail threshold must not silently replace it forever.

### Frozen canonical challenger

Make `selective_axis_regret_catchup_value_initial_expire_10` the candidate's
unset default while keeping the previous production policy available under its
explicit `selective-axis-regret-catchup` name. No mechanism changes: density
0.020, maturity three, startup expiration below 10% gap progress, initial lane
only, 15% optional-work fund, 1.25 terminal reserve, atomic local allowance,
ordinary budget-shaped breadth, strict positive equal-depth gain, and no
speculative tail completion inside value probes.

Run only `npm run benchmark -- eval --seeds=48 --jobs=48` at the canonical 750k
budget. Use the standing cached reference and decision rule. Do not run another
multi-budget sweep, compact score screen, source exception, threshold variant,
reserve variant, breadth composition, or proof gate. If the standing decision
accepts, rebaseline through the ordinary promotion workflow and clean up the
now-default policy naming. If it rejects, restore the previous unset default;
the explicit experimental policy and its evidence may remain, but no score
salvage follows.

| Date | Milestone | Status | Evidence |
|---|---|---|---|
| 2026-08-15 | Exact Phase-D N8 combined premise | complete | Two disjoint targeted panels; +3.7417 +/- 1.4523, 80/80 valid |
| 2026-08-15 | Candidate default and regression tests | complete | Unset/explicit Phase-D identity; 27 handoff integration tests and focused telemetry/controller suites pass |
| 2026-08-15 | Canonical sequential adjudication | accepted at N=32 | `generated/benchmark-v2/comparisons/phase-d-canonical-n48.json` |
| 2026-08-15 | Promotion to active 750k baseline | complete | `benchmark/v2/campaign-baseline.json`; label `value-ranked-startup-expiration` |

The canonical challenge succeeds. The strict N=8 look was +0.8055 +/- 0.6301
seed-block SE with P(positive)=87.91%, below its 99.90% early boundary. N=16
was +1.1267 +/- 0.3873 with P(positive)=99.46%, just below 99.80%. N=32 was
+1.2390 +/- 0.3366 with P(positive)=99.96%, clearing the 98.88% boundary and
stopping with `accept`; N=48 was correctly not run. All 1,408 candidate and
1,408 matched reference cells were valid. The matched N=32 headline moved
606.0192 to 607.2582, with a 95% interval of [+0.32, +2.16].

The effect is broad but not uniform. Representative gains +1.64 and capability
gains +4.86; legacy regression loses 5.21 and development music loses 2.30.
Largest source gains are `frontier_dense_recovery_240ms_figures` +11.86,
`sparse_lowline` +7.51, and `frontier_dense_recovery` +6.86. Largest losses are
`regression_transition_mosaic_tempo_fast_5` -11.78,
`regression_transition_mosaic` -6.89, and `believer_56_6s` -6.49. These rows
remain fully counted in the accepted headline. They define the next natural
improvement surface; they are not grounds to undo or condition the promotion.

`npm run benchmark -- rebaseline` promoted the exact source under label
`value-ranked-startup-expiration`. The active campaign baseline now matches the
current compiler at 607.26 and records promotion depth N=32. Frozen 250k/500k
evidence was neither run nor changed.

The post-promotion cache extension completed all 704 missing N=32--48 cells
with 704/704 valid. That independent suffix scores 607.25, essentially the
same as the promoted N=32 headline, and the canonical cache now covers
`[0,32), [32,48)`. This is a descriptive stability monitor and does not revise
the N=32 stopping decision.

## Phase F: challenge endpoint-only route priority

### Canonical attribution

The accepted N=32 archive has now been mined directly against its checksum-
verified canonical reference through
`benchmark:v2:canonical-value-attribution`. The analysis keeps authoritative
pooled Benchmark V2 scores separate from descriptive matched per-run scores:
the scorer pools axis observations before its nonlinear quality transform, so
an average of run scores is not the headline.

Several direct observations narrow the next question:

- 1,328/1,408 cells execute at least one value tournament. The remaining 80
  no-action cells have identical track hash, score, first-terminal work,
  repair work, candidates, terminal evaluations, and improvements. The gain is
  therefore intervention-bound, but not rare-admission-bound.
- The policy spends 102,522,844 probe frames across 12,724 tournaments. It
  delays first terminal by 68,136 frames/cell on average and displaces 68,075
  repair frames/cell. Within-source associations between final run-score delta
  and probe frames, first-terminal delay, or repair-frame displacement are all
  near zero (absolute Pearson below 0.04). Raw opportunity cost is not the
  leading explanation of the score split.
- 4,859 tournaments prioritize an alternative. The final axis-loss advantage
  is often tiny (median 0.00503; 10th percentile 0.00052), and 2,489/4,859
  selected routes were nonpositive at an earlier catch-up checkpoint before
  becoming positive at the equal-depth endpoint. The current comparator gives
  any strictly positive endpoint gain immediate priority.
- A global stability veto is not justified offline: strong sources also contain
  many late flips, and cells can contain both stable and late-flip selections.
  The archive cannot reveal the counterfactual terminal after changing their
  priority. It does justify a live categorical test in which the already-built
  alternative remains available as fallback.
- 9,396/12,724 probes encounter a nonpositive checkpoint. They subsequently
  spend 34,594,914 frames, 33.7% of all value-probe work; 9,032 still reach the
  endpoint and 2,489 eventually win there. Under an all-checkpoints-positive
  priority rule, that later work can no longer change immediate eligibility.
  It is therefore a large, explicitly measured surface for a later early-stop
  mechanism, but not “free” work: stopping would return a shallower fallback to
  the ordinary frontier, so only a live compile can determine terminal value.

The supporting artifact is
`generated/benchmark-v2/analysis/value-ranked-startup-expiration-canonical-attribution.json`.
Its raw-run projections are checked against every decision-index report hash
and the complete compressed/decompressed archive hashes; all important cohort
claims remain labeled direct or descriptive rather than causal.

### Frozen stable-priority challenger

Add an explicit policy
`selective-axis-regret-catchup-value-initial-expire-10-stable-priority`.
Admission, density 0.020, three-contact maturity, 10% startup expiration,
initial-only lane, 15% optional-work allowance, 1.25 terminal reserve, probe
execution, and ordinary frontier ownership stay identical to the promoted
baseline.

Only equal-depth priority changes. A completed alternative receives immediate
priority over the suspended current route when its authored-axis loss is
strictly lower at the endpoint **and** its relative gain was strictly positive
at every recorded catch-up checkpoint. Otherwise the current route remains
first, while the completed alternative and every local fallback remain in the
ordinary frontier. No node is pruned, no probe work is refunded, and no source,
score, authored target, or numeric gain threshold enters the rule.

Telemetry must report the priority rule, stable/late-flip assessment, and the
number of endpoint winners whose immediate priority was suppressed. Focused
tests must prove that the baseline comparator is unchanged, the new rule only
changes ordering after a completed probe, and all alternatives remain owned by
the frontier. After a trace mechanical proof, run only the standing 750k
canonical `npm run benchmark -- eval --seeds=48 --jobs=48` ladder. No budget
sweep or post-hoc source condition is authorized. An accept promotes; any
other formal outcome closes this exact rule and informs the next categorical
mechanism rather than ending the campaign.

| Date | Milestone | Status | Evidence |
|---|---|---|---|
| 2026-08-15 | Full promoted-baseline cache | complete | 704/704 valid suffix cells; cache `[0,32), [32,48)` |
| 2026-08-15 | Checksum-bound canonical attribution | complete | `benchmark:v2:canonical-value-attribution` |
| 2026-08-15 | Stable-priority rule frozen | complete | This section |
| 2026-08-15 | Implementation and mechanical proof | complete | Focused 89-test suite; `stable-priority-mechanism-smoke-seed16` |
| 2026-08-15 | Canonical sequential decision | complete: inconclusive | N=48, -2.24 +/- 1.74, P(positive)=10.15% |

The trace smoke is mechanical, not score evidence. It ran one actual seed over
one source plus the three mandatory stratum controls. All eight candidate and
reference cells were valid. The candidate recorded eight suppressed unstable
endpoint winners, every counter matched its event ledger, every suppression
had a positive endpoint gain plus a nonpositive earlier checkpoint, and no
alternative was removed. The sole cell with zero suppressions remained
track-identical to the promoted reference. Three affected cells regressed in
this tiny panel; that is an honest warning, but the frozen canonical ladder is
the scorer and will decide the rule without changing it.

At N=32 the stable-priority challenger is -0.18 +/- 0.36 seed-block SE with
P(positive)=30.60%. All 1,408 candidate cells are valid. The standing rule said
`continue`, so the frozen evaluation extended to N=48. This intermediate
result rejects the working assumption that a route which flips sign before
equal depth is obviously a worse immediate continuation; it does not reject
value-ranked exploration itself.

The N=48 extension closes the rule as `inconclusive`. The matched headline is
607.25 -> 605.01, delta -2.24 +/- 1.74 SE, P(positive)=10.15%. One
`frontier_pickup_progression_shifted` cell loses validity; that validity-
sensitive remainder is -1.73. This is not merely a failure artifact: across
the 2,111 both-valid pairs the counterfactual headline is still -0.51 +/- 0.29,
with 747 better, 849 worse, and 515 tied. Stable priority is retained only as
an explicit closed experiment and is not the default.

The lost-validity cell is actual seed 644. It reaches only 90/110 authored
contacts and terminates `rideStalled`; the stable arm suppressed two endpoint
winners in that run, with gains 0.001875 and 0.000076. This is direct event
attribution, not proof that either suppression alone caused the later stall.
It does show why even tiny endpoint wins cannot be dismissed as harmless noise,
consistent with the negative both-valid result.

## Phase G: challenge synchronous catch-up work, not route existence

The checksum-bound attribution was extended before implementing a stop rule.
The earlier 9,396 count included nonpositive observations at equal depth, where
there is no continuation work to stop. The corrected pre-target count is 8,193
events and the measured continuation remains 34,594,914 frames (33.7% of value
probe work). More importantly, the first checkpoint is structurally unusual:
8,146 routes are nonpositive there, while only 193 have a nonpositive
observation after at least two checkpoints and only 155 have two consecutive
nonpositive observations. A zero threshold would therefore treat near-zero
noise as categorical evidence and alter most tournaments.

The first-checkpoint deficit grid gives a less indiscriminate live arm. A
deficit of at least 0.005 occurs in 3,416 accepted-baseline probes and precedes
14,685,191 measured continuation frames (14.3% of all value-probe work). In the
unchanged run, 846 of those routes eventually receive immediate endpoint
priority. This is descriptive evidence, not a stopped counterfactual; every
partial route must remain owned by the ordinary frontier.

### Frozen first-deficit-stop challenger

Add
`selective-axis-regret-catchup-value-initial-expire-10-first-deficit-stop-005`
as an explicit experimental policy. It retains the promoted Phase-D admission,
budgeting, and endpoint-gain priority rule. Only the first checkpoint before
equal depth can stop privileged probing, and only when its relative authored-
axis gain is at most -0.005. On that event, enqueue the partial alternative,
then enqueue the suspended incumbent so LIFO traversal resumes the incumbent
first. Do not prune, refund work, change the authored objective, introduce a
source condition, or inherit the stable-priority comparator.

Telemetry reports the stop rule and threshold, an explicit
`probe_first_deficit_stop` outcome, exact stop counts, the single triggering
checkpoint, and later incumbent resumption. A trace smoke must prove frontier
ownership and exact trigger semantics. Because saved synchronous work may be
re-spent when the partial route later reaches the ordinary frontier, compare
first-terminal, resumed, repair, terminal-track, and total probe behavior; do
not equate the 14.7M-frame offline surface with guaranteed savings.

Use a four-source, four-seed 750k paired panel only as a mechanical/directional
screen, with the promoted commit as reference. If the mechanism is not broadly
adverse, make it the source-native default and run the standing 750k canonical
ladder. Do not run a multi-budget sweep. A formal accept promotes; any other
formal outcome closes this exact 0.005 rule and redirects the campaign to a
different high-value mechanism.

| Date | Milestone | Status | Evidence |
|---|---|---|---|
| 2026-08-15 | Correct pre-target and threshold attribution | complete | `value-ranked-startup-expiration-canonical-attribution.json` schema v2 |
| 2026-08-15 | First-deficit-stop implementation and unit telemetry | complete | Focused 27-test controller suite; scoped TypeScript check |
| 2026-08-15 | One-seed trace ownership proof | complete | 19 exact stops; zero-stop control track-identical; all 8 runs valid |
| 2026-08-15 | Four-seed directional panel | complete: adverse | `first-deficit-stop-005-n4-seeds16-19` |
| 2026-08-15 | Canonical sequential decision | not authorized | Directional screen closed the exact rule |

The directional panel closes first-deficit stopping. All 32 candidate/reference
runs are valid, but 14/16 tracks change and the candidate loses 87.6 points in
total (-5.48/cell): five improve, nine regress, and two tie. Three of four
source controls lose; `regression_transition_mosaic` is -22.19 in its pooled
four-seed source score. The mechanism does redirect work: 69 stops reduce value
probe frames by 82,101, move aggregate first terminal 99,093 frames earlier,
and add 116,090 repair frames. They also increase admitted actions from 184 to
211. More nominal exploration does not compensate for interrupting these
catch-ups; no threshold salvage or canonical run follows.

## Phase H: separate speculative probe breadth from production breadth

Phase B deliberately inherited full production breadth until value-ranked
actions had positive evidence. Phase D is now accepted, so that deferred
factorial is authorized. The checksum-bound N=32 archive contains 25,721
ranked-option calls inside value probes, 2,079,911 requested normal proposals,
2,713,346 candidate-geometry evaluations, and 102,522,844 charged probe frames.
The weighted request is 80.86 candidates/call; the per-probe median and both
quartiles are exactly 81. Full production sampling is therefore a concrete
speculative cost, not a vague global-breadth hypothesis.

Predeclare one categorical arm:
`selective-axis-regret-catchup-value-initial-expire-10-probe-breadth-3q`.
Keep Phase-D admission, value ranking, 15% fund, 1.25 reserve, branch limit,
endpoint comparator, production traversal, ordinary resumed traversal, and all
repair traversal exact. Only after a value tournament is admitted, scale the
already-resolved normal `nCand` by 3/4 after target-profile floors, rounded to
the nearest integer and never below the production scarce-budget floor. At the
750k surface this is 81 -> 61. Rescue lanes keep their explicit breadths.

Keep admission's conservative work estimate at production breadth for this
first arm. This prevents a second intervention in which cheaper assumed work
admits a different initial action set; actual lower spend may still leave more
of the existing exploration fund for later opportunities. The atomic budget
guard observes actual reduced-width cost after execution. Telemetry must name
the probe-only breadth rule and scale, while each probe continues to report its
actual ranked-option calls, requested proposals, geometry evaluations, nodes,
and frames.

Mechanically prove 81 -> 61, floor preservation, unchanged no-action cells,
and exact production/reference identity outside value probes. Reuse the Phase-G
four-source/four-seed reference rather than recompiling it. The directional
screen must report proposal and frame displacement in addition to score and
validity. Only a non-adverse broad result authorizes the ordinary 750k canonical
ladder. Do not combine this arm with first-deficit stopping, stable priority,
global breadth scaling, repair breadth, or a multi-budget sweep.

| Date | Milestone | Status | Evidence |
|---|---|---|---|
| 2026-08-15 | Exact accepted-run probe economics | complete | Attribution schema v3; 2.08M normal proposals at weighted nCand 80.86 |
| 2026-08-15 | Probe-only three-quarter policy and telemetry | complete | Pure 81 -> 61/floor unit proof; focused 28-test suite; scoped TypeScript check |
| 2026-08-15 | Reused-reference four-seed directional panel | complete: positive | `probe-breadth-3q-n4-seeds16-19` |
| 2026-08-15 | Source-native canonical challenger | complete | Unset default changed only after Phase-F closure; focused 55-test suite passes |
| 2026-08-15 | Canonical N=8 look | continue | 607.08; delta -0.15 +/- 0.65 SE; P(positive)=40.93%; 352/352 valid |
| 2026-08-15 | Canonical N=16 look | continue | 607.02; delta -0.06 +/- 0.42 SE; P(positive)=44.60%; 704/704 valid |
| 2026-08-15 | Canonical N=32 look | continue | 607.65; delta +0.40 +/- 0.36 SE; P(positive)=85.86%; 1,408/1,408 valid |
| 2026-08-15 | Canonical maximum look | complete: inconclusive | N=48, +0.38 +/- 0.26 SE, P(positive)=92.24%; 2,112/2,112 valid |

The directional panel authorizes canonical evaluation, but it overturns a
third simplistic model. All 32 candidate/reference runs are valid and the
candidate gains 28.9 run-score points (+1.81/cell), with capability +3.69 and
legacy +10.57 but representative -1.35 and music -5.30. Seven cells improve
and nine regress; every track changes, so only the canonical suite can decide.

Every candidate probe call requests exactly 61 normal proposals. Nevertheless,
calls rise 382 -> 421 and actions rise 184 -> 209, so total proposals fall only
30,939 -> 25,795 (-16.6%) and probe frames only 1,466,838 -> 1,451,235 (-1.1%).
Aggregate first terminal is 315,441 frames later, repair loses 303,900 frames,
and distinct terminal tracks fall 101 -> 89. The positive score is therefore
not evidence that narrow probes create more repair; it is evidence that the
different catch-up search shape can improve local choices despite consuming
nearly the same probe work. Preserve these adverse mechanics in the canonical
test rather than relabeling the arm as an efficiency win.

The panel's actual seeds 16-19 overlap canonical seed slots 0-3. It is valid
mechanism evidence but not independent of the first sequential looks: 16 of
the N=8 look's 352 cells were observed while choosing the arm. Therefore the
candidate cannot promote at N=8 or N=16 even if the ordinary tool crosses
early. Require at least N=32, where the overlap is 1.14% of cells, and retain
the standing calibrated directional-probability boundary as the only score
criterion. This is a minimum evidence depth correcting reuse, not a new tail,
source, or effect-size veto.

The first two canonical looks are neutral, not adverse, and expose what the
three-quarter arm actually controls. At the directional panel's exact probe
boundary, atomic probe nodes become 9.6% cheaper on average (3,870 -> 3,497
frames), but the fixed exploration fund reinvests that saving: actions rise
184 -> 209 and processed probe nodes rise 379 -> 415. Consequently total probe
frames are almost fixed (1,466,838 -> 1,451,235), while first completion moves
later and repair loses work. This is a test of *more, cheaper tournaments*, not
a test that releases three quarters of the nominal candidate saving to repair.
The per-node candidate stream is nevertheless causally clean: the cache's
sample-attempt contract makes the 61-wide pool an exact prefix of the 81-wide
pool at the same node. Divergence begins only when an omitted attempt changes a
selected child; it is not caused by advancing a shared global RNG.

The N=48 maximum closes the exact uniform arm as `inconclusive`. Its positive
607.25 -> 607.63 headline is +0.38 +/- 0.26 seed-block SE with 92.24%
directional probability, below the calibrated 97.23% boundary. All 2,112 pairs
are valid, so there is no failure artifact: 940 cells improve, 952 regress, and
220 tie. The shape is highly nonuniform: representative is +0.27, capability
-1.70 (both dense-recovery cases are the largest regressions), legacy is
+4.62, and music is -0.33. The accepted Phase-D policy remains the unset
default. The explicit three-quarter policy and its frozen archive remain
available as evidence, not as a promoted baseline.

## Phase I: adaptive full-width retry for an empty narrow probe pool

Uniform probe narrowing challenges a useful assumption but need not make an
empty 61-attempt pool final. In the four-source/four-seed mechanism panel, the
three-quarter arm records 38 probe dead ends versus 25 at production width.
Twenty narrow dead ends have a reference event with the same source, seed, and
branch/from/alternative gap tuple. The reference reaches equal depth in five of
those events and selects the alternative in three. This is a structural
association rather than an identical-prefix counterfactual, but it identifies
one concrete failure mode without fitting a score threshold.

Predeclare one categorical successor informed by the three-quarter arm. Every admitted
value probe first requests the existing 3/4 normal pool. If and only if that
normal ranked-option result is empty, extend the same node's deterministic
sample prefix to the full already-resolved production width and rank it before
entering the existing rescue cascade. The node cache guarantees that this adds
no candidate attempts outside the missing deterministic prefix (61 through 80
at 750k), and adds none when a wider prefix is already cached; it does not
redraw the first 61 or advance a compile-global RNG. Ranking/scoring is rebuilt
at full width, so this is not assumed to cost only the fresh geometry. A
nonempty narrow result never widens.
Production traversal, the exploration fund, action admission/ranking, branch
limit, endpoint comparator, rescue widths/order, repair traversal, and authored
targets remain exact.

Telemetry must name the adaptive rule and record retry attempts, retry
successes, the full requested width, the requested prefix increment, actual
candidate-geometry evaluations, exact charged retry frames, and resulting
probe outcome per route. The analyzer must reject partial, negative,
cross-policy, or internally inconsistent records and report the distinct
quantities without calling a successful pool rebuild a completed probe or an
accepted improvement.
Mechanically prove prefix extension, no retry on a nonempty narrow pool, exact
fallback width, and unchanged work outside value probes. First use a fresh
750k-only mechanism panel spanning representative, capability, legacy, and
music behavior; this is characterization, not a promotion decision and not a
multi-budget sweep. If it is not grossly adverse, the ordinary canonical
sequential evaluator remains the sole score authority. Do not combine the arm
with a fund-size change, final-step width rule, repair breadth change, or stop
threshold.

Because uniform three-quarter breadth did not promote, the accepted Phase-D
policy remains the reference for this combined narrow-then-recover challenger.
The mechanism panel must therefore distinguish (a) how often narrowing creates
an empty normal result, (b) how often full width refutes it, (c) its exact
incremental cost, and (d) downstream equal-depth and score outcomes. It is not
a threshold salvage of the closed uniform arm.

| Date | Milestone | Status | Evidence |
|---|---|---|---|
| 2026-08-15 | Narrow-then-full retry predeclaration | complete | This section; one categorical policy |
| 2026-08-15 | Implementation and exact retry telemetry | complete | Focused 55-test suite; scoped TypeScript check has only the pre-existing readiness error |
| 2026-08-15 | Fresh 750k mechanism panel | complete: mechanism falsified | 32/32 pairs valid; 56 retries, zero normal-pool refutations |
| 2026-08-15 | Canonical decision | not authorized | Positive subset score cannot be attributed to the fallback |

The eight-source/four-seed panel is directionally positive against Phase D:
+39.2 score points (+1.23/cell), with 17 better, 15 worse, no ties, and all 32
pairs valid. Dense recovery is +7.10 and low-air capability +2.42. That score is
not evidence for the proposed recovery mechanism. The candidate performs 56
empty-pool retries, requests 4,536 full-width proposals (a 1,120-proposal
deterministic-prefix increment), evaluates exactly 1,120 additional candidate
geometries, and spends 18,096 charged frames. Not one full-width rebuild
returns an option; all 56 routes still dead-end. The reference correctly
records zero cross-policy retries, and the analyzer's field and aggregate
checks pass for both archives.

This directly falsifies the assumption behind Phase I. The earlier structural
join between a narrow dead end and a full-width reference completion did not
identify the same causal prefix; upstream traversal had already diverged. Once
the exact narrowed route is at an empty pool, attempts 61 through 80 are not
where its missing continuation lives. The panel's positive score is another
observation of the broader uniform-narrowing search shape, plus 18k frames of
unsuccessful retries. It cannot rescue the N=48-inconclusive arm and does not
authorize a canonical run.

## Phase J: locate breadth within the catch-up route

Phase I shows that widening only after the exact route is already dead is too
late. It also provides a simpler experimental surface. In its fresh panel, 396
of 438 routes process exactly two nodes; 29 process one, and only 13 process
more than two. Likewise, 418 of 430 value-ranked actions target a three-contact
catch-up. Uniform 3/4 breadth therefore usually changes two consecutive suffix
decisions, while the empty fallback acts after both opportunities have failed.

Predeclare two positional breadth arms. `full-first` uses production width for
the first processed node of each independently executed probe route and 3/4
width after it. `full-last` uses 3/4 width until the final contact expansion
before the tournament target and production width there. A one-node route is
full width in both arms. A two-node route—the dominant population—requests the
same nominal 81 + 61 proposals in opposite order. Longer routes receive exactly
one full-width contact decision, at the named end. Non-contact bookkeeping
nodes do not consume the positional slot.

This is a location contrast, not a breadth grid. It tests whether early suffix
diversity is more valuable because its child owns a longer downstream path, or
late diversity is more valuable because it directly shapes the equal-depth
endpoint comparison. Both retain Phase-D admission/ranking/fund/reserve,
production and repair traversal, branch limits, rescue behavior, endpoint
comparison, authored targets, and conservative full-width work estimates.
Neither inherits the failed empty-pool retry.

Each probe route must record the primary normal width used at every processed
atomic node alongside its existing per-node frames. A focused pure test proves
the first/last positional laws, one-node coincidence, production floor, and
no effect on non-positional policies. Run both arms on the same fresh 750k-only
eight-source/four-seed panel (actual seeds 104-107) against Phase D. The shared
cells make the two mechanisms directly comparable; the panel remains
characterization, never promotion. Advance at most one arm, only when score,
validity, width traces, work allocation, and route outcomes are jointly
coherent. The canonical evaluator then uses its disjoint standing seed schedule
and remains the sole score authority.

| Date | Milestone | Status | Evidence |
|---|---|---|---|
| 2026-08-15 | Positional breadth contrast predeclared | complete | This section; dominant two-node route distribution |
| 2026-08-15 | Full-first/full-last implementation and width telemetry | complete: unit | Focused 55-test suite; pure positional law and aligned trace schema |
| 2026-08-15 | Shared fresh mechanism panel | complete: location identified | Full-first beats full-last by +130.0 across the 32 shared cells |
| 2026-08-15 | Canonical decision | not authorized | Neither fixed positional arm is independently broad and coherent |

The exact width traces close: the dominant full-first sequence is 81,61 (349
routes), while full-last is 61,81 (364 routes). Full-last is broadly adverse
against Phase D: -111.5 points (-3.48/cell), 12 better versus 18 worse, and six
of eight sources regress. Full-first is much better in the direct paired
location contrast: +130.0 points (+4.06/cell), 21 better versus 10 worse, and
seven of eight sources improve relative to full-last. This is strong evidence
that breadth has more value at the early suffix commitment than at the endpoint.

Full-first itself is not promotion-ready against Phase D. Its aggregate is
+18.5 (+0.58/cell), but one valid Believer cell contributes +50.9; without it
the sum is negative, and six of eight source means regress. All cells remain
valid in both positional arms. The correct conclusion is location, not score:
keep early breadth, but do not narrow every final decision categorically.

## Phase K: retain late breadth for a weak alternative prefix

The next arm combines the positional result with an exact online signal already
measured by every catch-up. The first contact expansion remains at full
production width. At each later contact expansion, use 3/4 width only when the
alternative's cumulative authored-axis loss is strictly lower than the
suspended incumbent through the same gap (prefix gain > 0). If the alternative
is tied, worse, or has no checkpoint yet, retain full width. Re-evaluate this
condition independently after every checkpoint; do not add hysteresis,
threshold fitting, source conditions, stopping, pruning, or an empty-pool
fallback.

This rule spends diversity where the route has demonstrated weakness instead
of assuming every endpoint is equally cheap. It differs materially from the
failed first-deficit stop: a weak route is neither abandoned nor demoted; it
receives the accepted production breadth. A promising route pays the narrower
continuation cost that lets the fixed exploration fund consider more actions.
The exact zero boundary is semantic and predeclared, not chosen from a score
grid.

Per-route telemetry must align three arrays: atomic frames, actual primary
normal widths, and the starting same-depth prefix gain used by the breadth
decision (null before the first checkpoint or when no contact pool expands).
Pure tests prove full first, narrow on strictly positive gain, full on zero or
negative gain, production floor, and no effect outside the policy. Use a fresh
eight-source/four-seed 750k panel (actual seeds 108-111) against Phase D. A
canonical run is authorized only if the adaptive arm removes the fixed
full-first panel's isolated-tail dependence and is not broadly adverse.

| Date | Milestone | Status | Evidence |
|---|---|---|---|
| 2026-08-15 | Positive-prefix breadth policy predeclared | complete | This section; no fitted threshold |
| 2026-08-15 | Implementation and aligned decision telemetry | complete: unit | Focused 55-test suite; width/gain arrays validated and analyzer-attributed |
| 2026-08-15 | Fresh mechanism panel | complete: positive | +15.5 over 32 valid pairs; 11 better, 9 worse, 12 unchanged |
| 2026-08-15 | Canonical N=8 look | continue | 607.57; +0.33 +/- 0.36 SE; P(positive)=80.84%; 352/352 valid |
| 2026-08-15 | Canonical N=16 look | continue | 607.15; +0.07 +/- 0.26 SE; P(positive)=60.51%; 704/704 valid |
| 2026-08-15 | Canonical N=32 look | continue | 607.55; +0.29 +/- 0.26 SE; P(positive)=86.02%; 1,408/1,408 valid |
| 2026-08-15 | Canonical maximum look | complete: inconclusive | 607.25 -> 607.55; +0.2926 +/- 0.1937 SE; P(positive)=93.12%; 2,112/2,112 valid |

The trace closes the policy exactly. Across 371 value-ranked routes, all 371
first contact-pool expansions have null starting gain and use 81 proposals.
All 117 expansions starting from a strictly positive checkpoint gain use 61.
All 270 expansions starting from a tied or negative checkpoint gain use 81.
No empty-pool retry fires. The aligned width/gain/frame arrays pass the analyzer
for every route.

The fresh paired panel is modestly positive and much less fragile than fixed
full-first: +15.5 points (+0.48/cell), 11 better, 9 worse, 12 unchanged, with
all 32 pairs valid. Four source means improve and four regress; three
regressions are between -0.18 and -0.43, while dense recovery is the material
-3.32 warning. The largest cell gain/loss are +17.0/-15.5, so no single
50-point tail owns the result. Candidate and reference record essentially the
same action population (371 versus 370 value events); the candidate reaches
333 completed tournaments versus 331 and has two budget yields versus four.

This panel is not headline evidence, but it is mechanically exact and not
broadly adverse. Make the categorical policy source-native only as the frozen
canonical challenger, keep Phase D as the benchmark baseline, and run the
standing sequential 750k ladder. The ordinary calibrated probability boundary
is the only promotion criterion; do not add a dense-recovery veto or a
multi-budget sweep.

The N=48 maximum closes the exact positive-prefix arm. Its +0.2926 headline
estimate is fully both-valid, with 607 better, 576 worse, and 929 tied cells,
but 93.12% directional probability remains below the calibrated 97.23%
boundary. The effect is heterogeneous: legacy regression gains +3.37 while
development music loses -0.65; representative is +0.02 and capability -0.16.
The tool estimates roughly 223 seeds would resolve an effect of this size. That
is not an efficient route to the headline, so do not extend this arm. Restore
accepted Phase D as the unset default and retain positive-prefix only as an
explicit, checksum-bound comparison arm for Phase L.

## Phase L: treat breadth as investment, not rescue

Phase K encodes an untested allocation assumption: after the mandatory full-
width first suffix decision, a route already beating the suspended incumbent
gets cheaper 3/4-width continuation, while a tied or losing route keeps full
production breadth. That treats candidate breadth primarily as rescue capacity
for a lagging alternative. The opposite model is at least as plausible:
breadth has higher return on a route that has already demonstrated authored-
axis value, while a lagging route should receive a cheaper but still complete
chance to recover.

Predeclare the exact inverse policy
`selective-axis-regret-catchup-value-initial-expire-10-probe-breadth-3q-nonpositive-prefix`.
Its first contact-pool expansion is always full production width. On each later
contact expansion, a strictly positive same-depth prefix gain keeps full width;
a zero or negative gain uses 3/4 width after the production floor. Missing gain
stays full. The sign is recomputed after every checkpoint. Nothing is stopped,
pruned, refunded, widened after an empty pool, or scored against terminal
outcomes. Admission, the 15% exploration fund, terminal reserve, route target,
endpoint comparator, ordinary traversal, repair, and authored objective remain
unchanged. This is deliberately a soft allocation contrast with the adverse
first-deficit stop, not a threshold salvage.

Do not change the source-native default or begin this arm's performance screen
until Phase K reaches its governed maximum or accepts. First prove the inverse
sign law and the existing aligned width/gain telemetry. Then use one same-cell
750k-only eight-source panel on fresh actual seeds 194-197 containing the
accepted baseline, the explicit positive-prefix arm, and this nonpositive-
prefix arm. The direct positive-versus-nonpositive contrast answers the sign
question; the accepted-baseline contrast answers whether either allocation is
worth advancing. All three share the same compile inputs. Report validity,
score, width-by-gain traces, actions, target reaches, probe frames, first
terminal, and repair displacement. This is characterization, not headline
evidence. At most one new arm may advance to canonical, and only through the
standing calibrated 750k evaluator. No multi-budget sweep or adjacent gain
threshold is authorized.

| Date | Milestone | Status | Evidence |
|---|---|---|---|
| 2026-08-15 | Inverse allocation rule and fresh panel frozen | complete | This section; categorical sign inversion, no fitted threshold |
| 2026-08-15 | Explicit implementation and mechanical proof | complete: unit | Exact inverse sign/floor tests; 55 focused tests; scoped typecheck clean; one-budget analyzer is explicitly characterization-only |
| 2026-08-15 | Same-cell three-arm panel | complete: inverse favored | Nonpositive vs positive +82.3; nonpositive vs Phase D +25.4; 96/96 valid |
| 2026-08-15 | Source-native canonical challenger | complete | Unset default changed only after Phase-K closure and the frozen three-arm panel |
| 2026-08-15 | Canonical N=8 look | continue | 607.23 -> 607.38; +0.1430 +/- 0.6917 SE; P(positive)=57.89%; 352/352 valid |
| 2026-08-15 | Canonical N=16 look | continue | 607.08 -> 607.24; +0.1580 +/- 0.4517 SE; P(positive)=63.43%; 704/704 valid |
| 2026-08-15 | Canonical N=32 look | continue | 607.26 -> 606.31; -0.9463 +/- 1.1806 SE; P(positive)=21.45%; 1,407/1,408 valid |
| 2026-08-15 | Canonical maximum | complete: inconclusive | 607.25 -> 606.68; -0.58 +/- 0.80 SE; P(positive)=23.79%; 2,111/2,112 valid |

The three-arm panel validates the intervention and overturns the rescue model.
Every width trace is exact: the inverse arm uses 81 for all 387 first/unobserved
expansions and all 113 positive-gain expansions, and 61 for all 278
nonpositive-gain expansions. The positive-prefix control applies the exact
opposite later rule (61 for 120 positive and 81 for 259 nonpositive). All 96
runs remain valid.

On the 32 shared cells, inverse beats positive-prefix by +82.3 score points
(+2.57/cell): 17 improve, eight regress, seven tie; three of four seed-block
means and six of eight source means favor the inverse. It wins every transition-
mosaic seed and improves that source by +16.42/cell. Relative to accepted
Phase D, the inverse is +25.4 (+0.79/cell), with 17 better, nine worse, and six
tied. That baseline contrast is noisier (two positive seed blocks, one
effectively tied, one negative; four positive and four negative source means),
and retains a -23.09 dense-recovery tail. These cautions belong in canonical
evidence; they are not new promotion vetoes.

The work attribution is coherent rather than merely a score reshuffle. The
inverse admits 387 value actions versus 374 positive-prefix and 373 Phase D,
while spending 2.880M probe frames versus 2.876M and 2.915M. It reaches 321
value-probe targets versus 315 in both controls. Against Phase D it completes
142 repair attempts versus 136 and accepts 62 versus 53, although total repair
frames fall 123,393; against positive-prefix it adds seven completed attempts
and nine accepted repairs while using 162,565 fewer repair frames. Narrowing a
lagging prefix therefore buys both more voluntary actions and more completed,
accepted repairs on this panel. It does not establish a linear breadth-to-
repair conversion, because route and anchor identity also change.

This is broad enough and mechanically exact enough to ask the only promotion
authority. Make nonpositive-prefix source-native as a frozen challenger, retain
Phase D in the campaign baseline, and run the ordinary 750k canonical ladder.
Do not extend positive-prefix toward its estimated 223 seeds, fit a gain
threshold, add a tail exception, or run a multi-budget sweep.

The N=48 maximum closes the inverse arm without promotion. The governed
headline is -0.58 +/- 0.80 seed-block SE with 23.79% directional probability,
far below the 97.23% boundary. The sole lost completion contributes a -0.76
validity-sensitive remainder. Across the other 2,111 paired cells, the exact
both-valid counterfactual is mildly positive at +0.18 +/- 0.25, with 734
better, 712 worse, and 665 tied. Legacy regression gains +3.22, while
capability loses 5.65 almost entirely through the named stalled endurance
cell. Restore accepted Phase D as the unset default. Keep the explicit inverse
policy and checksum-bound archive as mechanism evidence; do not extend or
salvage it.

The N=32 continuation exposes a real completion regression rather than a
worker or scoring failure. `frontier_low_air_endurance_7s`, actual seed 619,
is fully valid under Phase D: it reaches its first terminal at 445,540 frames,
then completes and accepts a repair. The inverse arm admits 13 value
tournaments and spends 101,498 probe frames, never reaches a terminal, exhausts
750,031 frames in the initial lane, and returns a stalled partial with 56 of 76
reported contacts hit (90 contacts are authored). Phase D admits ten
tournaments and spends 77,351 probe
frames in the same cell. This one validity loss owns the N=32 headline reversal;
it does not make the other 1,407 paired cells disappear. Preserve both the
formal validity-sensitive result and the completed-run counterfactual at the
maximum look.

## Phase M: couple speculative breadth to its optional-work fund

### Challenged assumption

Every breadth arm so far retains Phase D's 15% compile-level exploration fund.
That does not send a narrower pool's nominal saving to completion or repair.
It lets actual cheaper or shorter tournaments refill the same ledger and admit
later tournaments. In the original uniform three-quarter panel, calls rose
382 -> 421 and value actions 184 -> 209 while total probe frames fell only
1.1%; first terminal moved later and repair lost 303,900 frames. The test was
therefore *more cheap tournaments*, not the user's proposed breadth-to-repair
allocation.

Predeclare one coupled arm:
`selective-axis-regret-catchup-value-initial-expire-10-probe-breadth-3q-no-refill`.
It inherits Phase D and uses uniform three-quarter candidate breadth in every
admitted value-probe contact expansion, after the existing production floor.
Its value-exploration allowance is coupled by the same exact categorical
factor: `0.15 * 3/4 = 0.1125` of the search-policy budget. Actual probe frames
continue to debit the ledger exactly; there is no invented full-width cost,
shadow-frame estimate, refund, source condition, or score-dependent stop.
The 1.25 terminal reserve, conservative admission work, density and maturity,
startup expiration, comparator, branch limit, production traversal, repair,
and authored objective remain Phase D.

The smaller fund is not claimed to model full-width work. It is a simple
allocation contract: reducing the speculative breadth and its maximum
optional-work share together prevents the entire saving from being reinvested
inside the same subsystem. A behavior-only replay of the old 16-cell uniform
trace sizes the intervention but cannot score it: truncating the observed
event stream at 84,375 actual probe frames would retain 178 of 209 actions and
1.219M of 1.451M probe frames. Traversal will diverge live, so those numbers are
not a counterfactual output.

Do not implement or run this arm until Phase L's frozen maximum closes. Then
restore Phase D as the unset governed baseline if Phase L does not accept.
Mechanically prove the 61-width/11.25%-allowance coupling, the production
floor, and exact identity outside value exploration. Use a fresh same-cell
750k-only three-arm panel on actual seeds 198-201 and the same eight-source
representative/capability/legacy/music set used in Phase L: Phase D, the
existing uniform-three-quarter arm with its 15% refill, and the coupled arm.
The refill-versus-coupled contrast is the allocation test; Phase D is the score
and validity reference. Report validity, action and suppression counts, probe
frames, first terminal, terminal reach, repair frames/attempts/acceptance, and
score. Advance at most the coupled arm, only if the work displacement is real,
it is not adverse against Phase D, and it improves on the refill arm on the
shared cells. Any formal promotion still belongs solely to the standing 750k
canonical evaluator. Do not fit another breadth, fund fraction, source rule, or
run a budget sweep.

| Date | Milestone | Status | Evidence |
|---|---|---|---|
| 2026-08-15 | Coupled allocation rule and fresh three-arm panel frozen | complete | This section; 11.25% is exactly 15% times the declared 3/4 breadth |
| 2026-08-15 | Implementation and mechanical proof | complete: unit | Exact 61-width/11.25%-allowance/floor contracts; 56 focused tests; touched-file typecheck clean |
| 2026-08-15 | Shared fresh allocation panel | complete: coupled favored | Coupled +90.3 vs Phase D and +27.7 vs refill; all 96 arm-cells valid |
| 2026-08-15 | Source-native canonical challenger | complete | Unset default changed only after the frozen allocation panel |
| 2026-08-15 | Canonical N=8 look | continue | 607.26; +0.02 +/- 0.74 SE; P(positive)=51.22%; 352/352 valid |
| 2026-08-15 | Canonical N=16 look | continue | 606.79; -0.29 +/- 0.45 SE; P(positive)=26.25%; 704/704 valid |
| 2026-08-15 | Canonical N=32 look | continue | 607.06; -0.19 +/- 0.35 SE; P(positive)=29.09%; 1,408/1,408 valid |
| 2026-08-15 | Canonical maximum | complete: inconclusive | 607.25 -> 606.84; -0.41 +/- 0.35 SE; P(positive)=12.39%; 2,112/2,112 valid |

The explicit policy is now source-native without changing the unset Phase D
baseline. Its live opportunity ledger reports
`value_live_exploration_budget_fraction = 0.1125`; compiler-level tests verify
that every observed 20k opportunity receives exactly 2,250 frames while the
uniform refill policy remains at 15%. The value-ranked analyzer independently
checks policy identity, breadth rule and scale, the declared fraction, and the
per-opportunity allowance arithmetic before summarizing any score. No
production traversal, comparator, reserve, or repair behavior changes outside
the explicit arm.

The fresh panel confirms the allocation mechanism. Coupled versus Phase D is
+90.3 score points (+2.82/cell), with 16 better, 15 worse, one tied, all 32
pairs valid, and three of four seed-block means positive. Coupled versus the
15%-refill control is +27.7 (+0.86/cell), with 11 better, 11 worse, and ten
tied. Transition mosaic supplies most of the Phase-D gain; dense recovery is
the material negative source. These are canonical cautions, not fitted vetoes.

The work movement is real but is not a linear breadth-to-repair-count law.
Against refill, coupling admits 299 rather than 385 value actions, processes
603 rather than 778 value-probe contact nodes, and spends 2,201,181 rather than
2,778,521 probe frames. Mean first terminal is another 16,061 frames earlier.
Repair then spends 8,179,071 rather than 7,652,180 frames, but across 128
rather than 136 terminal-reaching attempts, with 51 rather than 52 accepted.
The freed work therefore funds longer or earlier-anchored repairs, not more
repair completions. Relative to Phase D, coupled remains 16,538 frames earlier
to first terminal but spends 554,917 more repair frames across eleven fewer
attempts. Preserve this attribution in the canonical interpretation.

The arm passes every predeclared advancement condition: exact work
displacement, no completion loss and positive score against Phase D, and a
positive shared-cell contrast against refill. Make it the sole source-native
challenger, retain Phase D in the benchmark baseline, and ask only the ordinary
750k calibrated probability ladder. Do not fit the fund fraction, add a source
exception, or run a multi-budget sweep.

The N=48 maximum closes the exact coupled arm without promotion. Its governed
headline is -0.41 +/- 0.35 seed-block SE, 95% interval [-1.36, +0.53], with
12.39% directional probability against a 97.23% boundary. All 2,112 paired
cells remain valid; this is entirely completed-run quality, with 913 better,
985 worse, and 214 tied cells. Representative is -0.15, capability -1.65,
legacy regression -0.54, and development music -0.13. The largest source
regressions are amplitude-mosaic contrast (-11.93), dense recovery (-6.56),
and split signal (-4.70); endurance 7s improves +5.34 and remains 48/48 valid.

The result rejects two tempting but incorrect generalizations. First, the
compact panel's +90.3 does not generalize to the full canonical population.
Second, eliminating speculative reinvestment fixes the inverse arm's observed
completion failure but does not turn saved probe frames into headline value.
The allocation mechanism is real and robust; its score return is not. Restore
accepted Phase D as the unset default. Keep the explicit coupled policy,
11.25% telemetry contract, checksum-bound archives, and panel analyses as
mechanism evidence. Do not extend this exact arm, tune the 11.25% fraction, or
fit source exclusions.

## Phase N: audit what the value numerator actually measures

### Challenged assumption

Phase D calls

    current whole-prefix axis loss - branch whole-prefix axis loss

"regret" and divides it by estimated catch-up work. Both losses are RMS-derived
quantities over different numbers of observations. Their difference is not an
additive loss belonging to the divergent suffix: old prefix observations are
renormalized at the later horizon, and a new imperfect suffix can even reduce
the cumulative RMS by dilution. The accepted policy has causal score value,
but that does not make this numerator a semantically faithful estimate of the
work a rewind can recover.

The causal runner-up also already owns one exact committed contact at the
branch point. Phase D retains its object but does not report whether that
measured contact was better or worse than the preferred child's contact. The
trigger therefore prices deterioration of the current route without directly
pricing the only concrete alternative it may buy.

### Behavior-neutral evidence contract

Do not change admission, ranking, breadth, allowance, traversal, comparator,
repair, or the authored objective. Extend each watch and value-opportunity
record with quantities computable from already committed fits:

- preferred and runner-up whole-prefix axis loss at the branch's first child;
- runner-up advantage (preferred loss minus runner-up loss) at that equal
  first-child horizon; and
- current divergent-suffix axis count, SSE, and RMS-derived loss from the
  branch gap through the opportunity horizon.

Every admitted event must copy the exact watch values from its opportunity.
The analyzer must reject non-finite values, unequal child horizons, invalid
SSE/count/loss combinations, or an event/opportunity mismatch. No physics
frame, candidate, RNG draw, frontier node, or policy decision may depend on
these fields.

Re-run the accepted Phase D on the existing eight-source, actual-seed 198-201,
750k panel and compare it with the checksum-bound Phase-D arm already stored in
`probe-breadth-no-refill-n4-seeds198-201`. Tracks, score, validity,
first-terminal work, and repair identities must be exact. Reusing these cells
is legal because this phase reads only mechanism labels and does not select a
score rule from their output.

### Score-blind signal assay and live boundary

For every admitted tournament, report target reach, endpoint winner, charged
frames, and conservative estimate by:

- sign of the runner-up's first-child advantage;
- current divergent-suffix loss above/below the inherited prefix loss; and
- quartiles of the existing cumulative-RMS density and the suffix-only
  alternatives.

Compare signals with rank AUC and top-quartile precision for target reach and
strict alternative selection. These are local mechanism labels, not final-score
surrogates. A live successor is licensed only if one semantic, zero-threshold
signal is broad and strictly improves both target-reach and winner enrichment
over the current numerator without increasing the selected action count in
offline replay. Otherwise close the trigger rewrite and pivot to another
search representation. Any live arm uses fresh 750k cells only; no multi-budget
sweep and no canonical run is authorized by the audit itself.

| Date | Milestone | Status | Evidence |
|---|---|---|---|
| 2026-08-15 | Numerator audit and behavior-neutral gate frozen | complete | This section; no score-selected threshold |
| 2026-08-15 | Exact identity and local-signal assay | complete: close rewrite | `value-numerator-audit-seeds198-201/signal-audit.json`; 32/32 exact tracks, scores, first-terminal work, and budget/repair ledgers |

The audit closes the semantic numerator replacement cleanly. All 358 admitted
tournaments carry valid branch and divergent-suffix evidence, while all 32
instrumented cells exactly reproduce the old track, score, validity,
first-terminal frame, and complete budget/repair telemetry. The evidence pass
therefore changed no search behavior.

The less faithful production density remains the better local ranker. Its AUC
is 0.576 for target reach and 0.570 for strict alternative selection; the
divergent-suffix excess density reaches only 0.382 and 0.533. Its top quartile
reaches 91.1% of targets and selects 43.3% alternatives, versus 82.2% and 41.1%
for suffix excess. The runner-up's exact first-child advantage is also weaker
(AUC 0.400/0.518). These event-level associations are descriptive and
clustered; within-run and within-source summaries are retained in the artifact.

Both zero-threshold rewrites fail for direct reasons. A divergent suffix worse
than its inherited prefix occurs in 358/358 admitted actions: once the
cumulative loss has crossed positively, that sign is an algebraic consequence,
not a new gate. The 131 actions whose runner-up first child is better reach
targets and select alternatives at 84.0%/34.4%; the top 131 actions under the
production density achieve 92.4%/41.2%. No live or canonical arm follows. The
important inference is not that the current numerator is a literal suffix-loss
estimate; it is that its horizon normalization is a useful compact surrogate.

## Phase O: hand control back before equal depth

### Challenged assumption

Every Phase-D tournament treats equal depth as indivisible: after a runner-up
has already caught up to the first comparable checkpoint and is strictly
better there, privileged probing still continues until the original current
prefix's depth. Equal depth is necessary for the final comparator, but it is
not necessary for safe frontier ownership. The partially caught-up alternative
and the suspended current prefix are both concrete nodes. Ordinary DFS can
continue the better partial alternative first while retaining the current
prefix as fallback.

This is not the closed first-deficit stop. That arm interrupted a losing
alternative, resumed the incumbent, and increased later action churn. The new
categorical rule interrupts only at the first genuinely pre-target checkpoint
whose exact like-for-like authored-axis gain is strictly positive. It enqueues
the suspended current prefix first and the partial alternative second, so LIFO
ordinary traversal gives the alternative control immediately. Neither is
pruned. A zero gain does not hand off; a one-step route with no pre-target
checkpoint still performs the ordinary equal-depth comparison.

### Score-blind opportunity and frozen screen

The behavior-neutral Phase-N panel contains 344 tournaments with a first
pre-target checkpoint. Exactly 109 are strictly positive, spanning 30 runs and
all eight sources. In the unchanged execution, 93 later reach equal depth and
62 ultimately select the alternative, while 419,279 synchronous probe frames
follow those positive checkpoints. The corresponding 229 negative checkpoints
produce only 60 endpoint alternative winners. These are local mechanism labels,
not a stopped score counterfactual; they authorize one live categorical test.

Add explicit policy
`selective-axis-regret-catchup-value-initial-expire-10-first-advantage-handoff`.
It inherits Phase D's trigger, density, maturity, startup expiration, 15% fund,
1.25 reserve, full production probe breadth, candidate generation, repair,
authored target, and every non-value traversal rule. Telemetry must distinguish
a partial advantage handoff from target reach, completed tournament, accepted
alternative, and later suspended-prefix resumption. It must bind the handoff to
one first pre-target checkpoint with strict positive gain, exact partial axis
loss, correct frontier ownership, and aligned probe work.

After unit and one-run mechanical proof, use the same eight-source 750k-only
panel on fresh actual seeds 202-205 against Phase D. Continue only with full
validity, positive total movement, at least three positive seed blocks and four
positive source means, no cell loss of 20 points, at least 50 exact handoffs,
and coherent displacement from synchronous probe work into ordinary search or
repair. This is characterization, never promotion. If it passes, the unchanged
standing canonical 750k evaluator is the sole score authority. Do not tune a
gain threshold, combine it with breadth arms, add a source condition, or run a
multi-budget sweep.

| Date | Milestone | Status | Evidence |
|---|---|---|---|
| 2026-08-15 | First-advantage opportunity and live rule frozen | complete | 109 strict-positive first checkpoints; zero numeric threshold |
| 2026-08-15 | Implementation and mechanical proof | complete | 57 focused tests; known-activity smoke records 35/35 exact next-turn handoffs across eight sources |
| 2026-08-15 | Fresh 750k characterization | complete: pass | `first-advantage-handoff-n4-seeds202-205`; +111.71 across 32 valid pairs |
| 2026-08-15 | Canonical N=8 look | continue | 607.07; -0.16 +/- 0.52 SE; P(positive)=38.10%; 352/352 valid |
| 2026-08-15 | Canonical N=16 look | continue | 606.22; -0.86 +/- 0.45 SE; P(positive)=3.75%; 704/704 valid |
| 2026-08-15 | Canonical N=32 look | continue | 604.49; -2.77 +/- 2.58 SE; P(positive)=14.59%; 1,407/1,408 valid |
| 2026-08-15 | Canonical maximum | complete: inconclusive | 607.25 -> 605.39; -1.86 +/- 1.75 SE; P(positive)=14.69%; 2,111/2,112 valid |

The fresh screen clears the entire predeclared boundary. All 64 arm-cells are
valid. Candidate minus Phase D is +111.7062 points (+3.4908/cell), with 14
better, 14 worse, four tied, and seed-block SE 1.8762. Three of four seed means
and five of eight source means are positive; the worst cell is -15.7781. The
largest source gain is transition mosaic (+25.3387/cell), so the full canonical
population—not this renormalized subset—must decide whether the direction is
broad enough.

The intervention is mechanically exact in every cell. It performs 145 partial
handoffs across all 32 runs and all eight sources; all 145 receive the next
ordinary-frontier turn at exactly trigger frames plus charged probe frames.
Sixteen suspended incumbents later resume, proving fallback ownership is real
rather than nominal. The arm uses 144,959 fewer synchronous value-probe frames,
but initial search grows by 553,920 frames and repair falls by 560,625 frames
across eleven fewer terminal-reaching attempts and four fewer accepted repairs.
Excluding value probes, ordinary-initial-plus-repair work grows by 138,254
frames. This is an earlier transfer of search control, not free work or a
promise of more repairs.

Make this exact explicit policy source-native solely as the frozen canonical
challenger. Retain accepted Phase D in campaign governance, use the ordinary
750k sequential probability rule, and restore Phase D if the challenger does
not formally accept. Do not fit the positive gain, add a transition-mosaic
condition, combine breadth changes, or run another budget.

The N=48 maximum closes the exact arm without promotion. The governed
headline is -1.8633 +/- 1.7547 seed-block SE, with a 95% interval of
[-6.5739, +2.8473] and 14.69% directional probability against the 97.23%
boundary. One candidate cell loses completion: actual seed 626 on
`frontier_pickup_progression_shifted` reaches gap 98/110, exhausts the budget,
and terminates `rideStalled`; its matched Phase-D cell completes with score
442.8767. This is a real search failure, not a scoring or report artifact.

Validity does not hide a broad score gain. Neutralizing that one discordant
cell while keeping every canonical weight fixed gives a both-valid headline
delta of -0.1490 +/- 0.2584 SE. Across the 2,111 completed pairs, raw run score
movement is 639 better, 673 worse, and 799 tied. The validity-sensitive
headline remainder is -1.7143. Representative is -0.17, capability -12.16,
legacy regression +0.96, and development music -0.27. These are descriptive
attributions of the governed result, not a second decision.

The checksum-bound mechanism reader validates all 6,813 handoffs and the
complete N=48 reference assembled from the two retained Phase-D cache shards.
Every handoff receives the exact next frontier turn. Every one of the 237 cells
without a handoff has identical track and score, binding movement to this
mechanism. Yet only 652 suspended incumbents are ever resumed: retaining a
node is not the same as granting a bounded alternative trial. Fully 6,462
handoffs occur only one gap before the existing equal-depth comparison, and
4,390 gains are at most 0.005. The failed cell's final, never-resumed handoff
occurs one gap before equal depth on a gain of 0.00013975.

The work premise also fails. Relative to Phase D, the arm saves 11,874,880
synchronous probe frames but moves 18,175,844 additional frames into initial
search, reaches the first terminal 8,566 paired frames later on average, and
removes 18,412,763 repair frames, 179 terminal-reaching repairs, and 58
accepted repairs. Immediate control transfer did not buy more downstream
optimization; it displaced it. Restore Phase D as the unset default. Preserve
the explicit arm, its telemetry, the canonical archives, comparison, and
`N48.first-advantage-analysis.json` as reproducible negative evidence. Do not
tune a positive-gain threshold or a source exception.

## Phase P: audit whether a selected route receives an unbounded lease

### Challenged assumption

Phase O mostly weakened an equal-depth comparator: 95% of its interventions
handed off one gap before the comparison Phase D would already perform. It did
not test the broader proactive-backtracking idea cleanly. After Phase D does
select an equal-depth alternative, ordinary LIFO traversal can still follow
that route until death or completion. The displaced incumbent remains in the
frontier, but there is no continuing contract that revisits it when the chosen
route spends its local advantage. Calling that node a fallback overstates what
the algorithm actually guarantees.

Start with behavior-neutral evidence on the accepted Phase-D policy. For each
equal-depth alternative selection, bind the selected node, displaced incumbent,
their same-horizon authored-axis counts/SSE/losses, and the exact selection
frame. Follow only the selected preferred lineage and record subsequent contact
checkpoints until terminal, death, another selective tournament, or incumbent
resumption. At each checkpoint report the added suffix axis count/SSE/loss,
the selected route's cumulative loss, whether it has risen above the displaced
incumbent's last comparable loss, charged work, and termination reason. Do not
change frontier order, candidate generation, RNG, budget, repair, or scoring.
Instrumented Phase D must be byte-identical to retained Phase D on a
checksum-bound compact panel.

This audit asks whether an equal-depth winner commonly becomes observably weak
before death while an affordable displaced route remains available. It does
not infer the displaced route's unobserved future and must not label a local
crossing as terminal-score truth. If the opportunity is broad, implement one
explicit **bounded route lease**: on the first zero-threshold loss crossing,
and only when the existing conservative estimator says the displaced route can
still complete with reserve, put the current route back in the frontier and
resume the displaced route next. Retain both; prohibit nested or repeated
rollback for the same lease; record exact selection, crossing, affordability,
rollback, later resumption, terminal, and work outcomes.

Use unit proof and fresh compact 750k cells before any canonical request.
Require full validity, exact no-crossing identity, broad exercised rollback,
and visible work attribution. This is a new proactive-backtracking mechanism,
not a threshold-tuned repair, source rule, breadth arm, or multi-budget sweep.

| Date | Milestone | Status | Evidence |
|---|---|---|---|
| 2026-08-15 | Unbounded-lease assumption and behavior-neutral audit frozen | complete | Phase O shows 652/6,813 incumbent resumptions and 6,462/6,813 one-gap handoffs |
| 2026-08-15 | Audit implementation and controller proof | complete | Explicit `LR_ROUTE_LEASE_AUDIT=1`; 59 focused tests; default Phase D hot path unchanged |
| 2026-08-15 | Known-activity identity smoke | complete: opportunity broad | 8/8 exact paired cells; 37 takeovers, 22 crossings, all 22 incumbent-available and affordable with 1.25 reserve, seven sources |
| 2026-08-16 | Four-seed behavior-neutral audit | complete: opportunity broad | 32/32 exact cells; 131 takeovers, 79 crossings, 78 affordable, 29 runs and all eight sources |
| 2026-08-16 | Bounded route-lease rollback implementation | complete: unit | First crossing, available incumbent, existing 1.25 reserve; retain both routes; 59 focused tests |
| 2026-08-16 | Known-activity rollback smoke | complete: positive | 8/8 valid; 19/19 exact rollbacks; +26.7 raw score, 5/2/1 better/worse/tied |
| 2026-08-16 | Fresh four-seed rollback characterization | complete: close | +1.067 +/- 1.356 seed-block SE; 13/15/4 better/worse/tied; only 2/4 positive seeds; 85/85 exact actions |

The audit is an explicit compiler mode, not a permanent cost in accepted Phase
D. It records the actual selected alternative subtree, same-horizon takeover
counts/SSE/loss, additive divergent-suffix evidence, exact first loss crossing,
frontier availability, conservative deadline margin, and whether the incumbent
work fits with the existing 1.25 terminal-reserve factor. It neither reads a
score nor changes a frontier operation. The analyzer removes only these audit
fields and requires exact status, authored contacts, track, report, score,
every other stat, and complete budget telemetry against the retained reference.

The first corrected known-activity panel passes that contract in all eight
cells. It observes 37 selected equal-depth alternatives and 22 first crossings
across seven sources. Every crossing occurs while the displaced incumbent is
still in the frontier and its conservative work fits inside remaining budget
with the existing 1.25 reserve. This establishes a broad observable action set
without claiming that rollback is beneficial. Proceed to the already declared
four-seed behavior-neutral audit; do not select a source, gain, gap, or timing
threshold from the smoke.

The four-seed audit strengthens the opportunity claim without score reuse. All
32 instrumented cells are exact against retained Phase D. It records 131
equal-depth takeovers and 79 first loss crossings in 29/32 runs and all eight
sources; 78 crossings retain an available incumbent whose conservative suffix
fits with the existing 1.25 reserve. Median crossing is the second selected
node, one gap and 4,293 charged frames after takeover. The one reserve
suppression has margin 1.1435. This is broad enough for one categorical live
rule; no source, gain, gap, time, or new reserve value was selected.

### Frozen bounded route lease

Enable the live arm only with `LR_ROUTE_LEASE_ROLLBACK=1`; it implies the audit
but leaves unset Phase D unchanged. On the first strict whole-prefix loss
crossing, require the displaced incumbent to remain in the ordinary frontier
and require its conservative remaining work times the already shipped 1.25
terminal-reserve factor to fit the budget remaining. Retain the crossing route,
remove the exact incumbent object from its old frontier position, enqueue the
crossing route first and the incumbent second, so LIFO gives the incumbent the
exact next ordinary turn. Its suspended-continuation marker prevents duplicate
detector, register, and evaluation work. Permit one rollback per lease; a new
selective tournament closes the previous lease, so rollback cannot nest or
repeat inside it.

The first known-activity panel is encouraging but not a decision: all eight
cells complete, 19/19 admitted rollbacks execute and resume their causal
incumbent at the same charged frame, seven tracks change, and raw run-score
movement is +26.7 (+3.34/cell), with five better, two worse, and one tied.
First completion is 15,503 paired frames later, so any larger panel must report
repair displacement rather than treating rollback as free.

Use fresh actual seeds 206-209 on the same eight sources at 750k. Continue only
if all candidate cells complete, no reference completion is lost, total raw
score movement is positive, at least three seed blocks and four source means
are positive, no cell loses 20 points, at least 40 exact rollbacks execute,
every admitted rollback executes, and all eight sources exercise the action.
This gate is evaluated only on the declared four-seed panel. If it passes, the
standing canonical 750k probability ladder is the sole promotion authority.
Do not tune the crossing, reserve, source set, or run a multi-budget sweep.

The frozen panel closes the categorical rollback arm before canonical work.
All 32 candidate cells complete, all 85 admitted actions execute exactly, all
eight sources exercise rollback, total raw score movement is +34.16, and no
cell loses 20 points. The result is nevertheless diffuse: 13 cells improve,
15 regress, four tie, only seeds 206 and 207 are positive, and the mean is
+1.067 +/- 1.356 seed-block SE. The arm therefore fails its declared
three-positive-seed condition. It also reaches first terminal 18,638 paired
frames later, removes seven terminal-reaching repair attempts, and adds only
five accepted repairs. Preserve it as an explicit negative/diagnostic mode;
do not make it the unset default or send it to the canonical evaluator.

The closure challenges two assumptions in the categorical rule. Its trigger
compares the selected route after it advances with an incumbent still frozen
at the takeover horizon; it is evidence that the selected route's original
advantage has been diluted, not a same-horizon observation that the incumbent
is now better. The action then grants that unobserved incumbent the next
ordinary DFS turn, recreating the unbounded-lease problem in the opposite
direction. A stronger structural challenger must measure both routes at the
same current horizon before choosing priority.

## Phase Q: bounded same-horizon route revalidation

### Frozen question

Can proactive backtracking improve authored impact when it is used to obtain a
real same-horizon comparison, rather than to reverse control on a
different-horizon loss crossing? Keep Phase D as the unset baseline. On the
same broad, score-blind first crossing used by Phase P, and only while the
incumbent remains queued and fits the shipped 1.25 terminal reserve, retain the
current route and run the displaced incumbent as one isolated preferred-path
probe to the current route's exact gap. Disable nested selective backtracking
inside the probe. Its local allowance is all execution work remaining above
the existing 1.25 conservative terminal reserve at the target gap; before
moving either route, require the observed atomic-cost upper bound to fit that
allowance. A failed preflight leaves the frontier byte-for-byte unchanged.
Retain every generated sibling in the ordinary frontier. If
the probe reaches the target, compare authored-axis loss over the same prefix
horizon and put the measured winner on top of the LIFO frontier; retain the
loser immediately below it. If the probe dies, defers, exhausts its allowance,
or reaches the compile ceiling, retain all surviving work and resume the
current route. Neither route receives a new open-ended lease from the action.

Implement this as a separate explicit mode and telemetry contract, not as a
threshold tweak or a relabeling of Phase-P rollback. Record admission, exact
probe work, target reach, both endpoint losses, selected route, retained route,
and terminal-reserve/ceiling dispositions. Unit tests must prove exact
same-horizon comparison, LIFO ownership, sibling retention, no duplicate
suspended-node processing, and behavior identity when no action is admitted.
Use only a known-activity smoke and a fresh compact 750k panel before deciding
whether the arm warrants the standing canonical probability ladder. Do not use
the multi-budget sweep and do not select source-specific eligibility from
compact outcomes.

The fresh decision panel is the same eight sources at 750k with actual seeds
210-213. Evaluate the continuation gate only when all four seed blocks are
complete. Continue only if every candidate cell is valid, no reference
completion is lost, total raw score movement is positive, at least three seed
blocks and four source means are positive, no cell loses 20 points, at least
40 probes reach an exact same-horizon comparison, at least 90% of started
probes reach that horizon, both current and incumbent routes win at least once,
and exercised actions span all eight sources. Every eligible action must
either be admitted or explicitly rejected by the atomic preflight, and every
admitted action must start. Passing this
gate permits the ordinary canonical 750k probability ladder; it is not
promotion. Failure closes the frozen rule without threshold, source, reserve,
or budget tuning.

| Date | Milestone | Status | Evidence |
|---|---|---|---|
| 2026-08-16 | Same-horizon controller and scheduler | complete: unit | Separate `LR_ROUTE_LEASE_REVALIDATION=1`; focused suite and targeted type check clean |
| 2026-08-16 | Known-activity production smoke | complete: mechanically exact | 8/8 valid; 22/22 probes reach equal horizon; current wins 14, incumbent wins 8; no yield/death/ceiling |
| 2026-08-16 | Fresh four-seed continuation panel | complete: close | +0.981 +/- 1.172 seed-block SE; 3/4 positive seeds, 6/8 positive sources, but one -27.19 cell violates the frozen gate |

The first smoke also caught and removed a false experiment before evidence was
used. An initial allowance equal only to the estimator's mean gap-to-gap work
caused 20/22 probes to yield before processing any node. The frozen contract
now uses the work remaining above the shipped target-horizon terminal reserve,
plus an atomic preflight. With that correction, all 22 admitted probes reach
the exact target, compare equal axis counts, and exercise both priority
outcomes. Raw score movement is +14.90 (+1.862/cell; 3/3/2), but this reused
known-activity seed is mechanics evidence only and does not evaluate the gate.

The fresh panel closes this one-shot revalidation rule before canonical work.
All 32 cells remain valid, 91/94 started probes reach an exact equal-horizon
comparison, both winners are exercised (current 62, incumbent 29), and actions
span all eight sources. Raw movement is +31.40 (+0.981/cell), with seeds
210/211/213 and six source means positive. The result nevertheless has 14
wins, 15 losses, three ties, and `regression_transition_mosaic` seed 212 loses
27.19 points, violating the frozen no-20-point-loss condition. Do not waive the
gate, select a source exception, or send this arm to the canonical evaluator.

All 94 actions occur in the initial lane before first terminal. They add
526,234 initial-search frames, reach first terminal 16,445 paired frames later,
and displace 510,461 repair frames, three terminal-reaching repair attempts,
and one accepted repair. The catastrophic cell still has four repair attempts
in each arm; its two revalidations spend 28,456 frames, first retain the
current route, then select the incumbent, and lead to a different terminal
basin. This is an association, not proof that the second switch caused the
loss.

The structural assumption left untested is important: after measuring an
equal-horizon winner once, Phase Q ends the audit and gives that winner ordinary
DFS priority again. In other words, it can recreate an unbounded lease one
level later. Before making another live policy, instrument behavior-neutral
**lease renewal** after a completed revalidation. Bind its measured winner and
loser as a new equal-horizon pair, observe whether the winner later crosses the
loser's measured loss while the loser remains affordable, and attribute the
opportunity to the parent revalidation. First prove exact identity on a compact
panel and inspect the catastrophic cell. Only if renewed crossings are broad
should a repeated, budget-bounded live revalidation be designed.

## Phase R: commit a measured horizon by clearing stale watch lineage

### Renewal audit result

The post-revalidation renewal audit is behavior-neutral in 32/32 paired cells:
track, report, score, complete budget telemetry, and every non-lease statistic
are exact against the saved one-shot Phase-Q arm. It binds 91 measured winners
to their measured losers. Only 16 renewed winners cross the loser's takeover
loss before the lease ends, in 12 runs, although those crossings span all eight
sources and remain available and affordable. By contrast, 85/91 renewed leases
are superseded by another selective tournament; 84 of those tournaments come
from a watch whose branch gap predates the newly measured horizon (median lag
three gaps). The catastrophic `regression_transition_mosaic` seed 212 has two
renewed leases, zero renewal crossings, and two immediate superseding watches
from three gaps before the measured horizon. Repeated loss-crossing renewal is
therefore not the focused correction. Stale causal lineage is.

### Frozen lineage-reset challenger

Enable only with `LR_ROUTE_LEASE_REVALIDATION_RESET_LINEAGE=1`; it implies the
same one-shot revalidation action and leaves unset Phase D unchanged. After a
probe reaches the target, rank and enqueue both actual equal-horizon endpoints
exactly as Phase Q does. Then clear the inherited selective-watch link only on
those two measured endpoint objects. Do not remove or reorder another frontier
node, regenerate a candidate, consume RNG, change the loss comparator, add a
threshold, or clear a global controller. When either endpoint is later
expanded, ordinary observation arms fresh watches from that new horizon.
Record the reset frame plus selected, displaced, and unique inherited watch
links cleared. A probe that does not reach target performs no reset.

The known-activity seed-202 smoke is encouraging but not a decision. Against
one-shot Phase Q it is +23.93 raw points (+2.991/cell), reaches first terminal
16,618 paired frames earlier, removes five revalidation cascades, and returns
128,776 frames to repair work. All 17 target reaches reset lineage and all
eight cells remain valid; the worst cell is -8.68. On the already-known
catastrophic seed 212, the reset changes `regression_transition_mosaic` from
-27.19 versus Phase D to +14.32, while reaching first terminal 22,514 frames
earlier than one-shot Phase Q. These reused cells establish mechanism and a
plausible causal correction only.

Freeze the decision panel before running it: the same eight sources at 750k,
actual seeds 214-217, with accepted Phase D as the paired reference. Continue
only if every candidate cell is valid, no reference completion is lost, total
raw score movement is positive, at least three seed blocks and four source
means are positive, no cell loses 20 points, at least 40 probes reach exact
same-horizon comparison, at least 90% of started probes reach target, both
measured winners occur, actions span all eight sources, every eligible action
is resolved, every admitted action starts, and every target reach performs one
lineage reset. Passing permits only the standing canonical 750k probability
ladder; it is not promotion. Do not run a multi-budget sweep or select a
source, loss, watch-age, or reset-depth exception from compact results.

| Date | Milestone | Status | Evidence |
|---|---|---|---|
| 2026-08-16 | Behavior-neutral renewal audit | complete | 32/32 exact; 16/91 crossings but 85 supersessions, 84 from pre-horizon watches |
| 2026-08-16 | Endpoint-lineage reset implementation | complete: unit | Endpoint-only reset; concrete frontier untouched; focused suite and targeted type check clean |
| 2026-08-16 | Known-activity and catastrophic-cell smokes | complete: positive | +2.991/cell vs Phase Q on seed 202; catastrophic seed 212 becomes +14.32 vs Phase D |
| 2026-08-16 | Fresh four-seed continuation panel | complete: close | -1.777 +/- 1.624 seed-block SE; only 2/4 positive seeds and 3/8 positive sources; one -38.18 cell |

The fresh panel decisively closes endpoint-lineage reset. All 32 candidate
cells remain valid and the mechanism executes exactly: 71 probes reach their
target, every target reach resets its two endpoint links, both route winners
occur, and actions span all eight sources. Those resets clear 1,314 unique
inherited watch identifiers when summed per action. The score result is
nevertheless -56.85 raw points (-1.777 +/- 1.624 seed-block SE), with 12 cells
better, 13 worse, seven tied, only seeds 216/217 positive, and only three
positive source means. `regression_transition_mosaic` seed 215 loses 38.18
points, independently violating the frozen gate.

Reset does return work from initial traversal to repair: first terminal is
4,665 paired frames earlier, initial work falls 149,295 frames, repair work
rises 156,399 frames, and repair produces 13 more terminal-reaching attempts.
Only one additional repair is accepted. The evidence rejects the causal
shortcut behind Phase R: a watch whose branch predates one measured route pair
is not necessarily stale or harmful. Its queued alternative can still encode
valuable search diversity. Preserve the explicit mode as a diagnostic, but do
not promote it, narrow it around the observed losses, or clear inherited
lineage in production.

## Phase S: repair authored-axis branch-and-bound

### Challenged assumption

The closed repair-incumbent family used a heuristic prefix-loss delta to launch
one small equal-depth sibling tournament. That couples a noisy signal to the
nearest causal watch and asks whether a local detour catches up. Repair has a
stronger fact available: its incumbent is already a complete contract-passing
track, the authored-axis register objective is known exactly, and committed
prefix SSE cannot be removed by later gaps.

For a repair prefix with committed SSE `S` and `N` authored scored axes in the
whole specification, padding every remaining axis with zero error gives the
exact optimistic upper bound

```text
exp(-sqrt(S / N) / AXIS_QUALITY_TOLERANCE).
```

If the incumbent's axis quality exceeds that bound by more than the register's
comparison epsilon, no descendant can replace it. This is not a feasibility
cap, estimator prediction, local-gap heuristic, or rewritten specification.
It is branch-and-bound under the existing authored scoring contract.

### Frozen opportunity audit

`LR_REPAIR_AXIS_BRANCH_BOUND_AUDIT=1` is behavior-neutral. At each selected
repair node immediately after a committed contact, compare the optimistic
upper bound with the attempt's starting incumbent. Group consecutive selected
descendants beneath the first dominated root into one exact subtree. Record
its root horizon, frontier alternatives, selected-node count, charged work
until ordinary traversal leaves that lineage, and whether the repair's first
terminal descends from it. Attach every record to the independent repair
iteration and its terminal/acceptance outcome.

The audit must be byte-identical to an unset reference after removing only its
new stats field. It must fail loudly if an accepted terminal descends from a
dominated root. First use a known compact 750k panel to prove identity and
measure whether opportunities are broad and material. Do not infer the output
of an unexecuted alternative from saved work.

### Frozen live challenger

Only if the audit finds material work in dominated subtrees, enable
`LR_REPAIR_AXIS_BRANCH_BOUND=1`. It implies the same ledger. At a dominated
nonterminal root, offer the already-built prefix normally, then skip its
speculative tail, candidate pool, children, and selective excursion. Do not
remove or reprioritize any existing frontier alternative. Ordinary LIFO DFS
continues with exactly the frontier it already had. Target/anchor selection,
repair seed, candidate breadth, estimator, attempt ceiling, one-terminal rule,
register, scorer, and authored specification remain unchanged.

The compact live screen is 750k only. Require complete validity, no accepted
descendant proof violation, exercised pruning across multiple sources, and
positive work conversion rather than merely a larger attempt count. A passing
screen permits only the standing canonical 750k probability ladder. Do not
rerun the multi-budget sweep or tune an axis-loss threshold: this rule has no
empirical threshold.

| Date | Milestone | Status | Evidence |
|---|---|---|---|
| 2026-08-16 | Mathematical bound and lineage-audit contract | complete: implementation | Exact zero-remaining-error upper bound; shared register epsilon; whole-subtree attribution |
| 2026-08-16 | Focused proof and integration tests | complete | Pure bound, epsilon, subtree closure, proof violation, active-budget snapshot, and behavior identity covered |
| 2026-08-16 | Compact behavior-neutral opportunity map | complete | 32/32 exact; 141 attempts; four actionable roots in two sources contain 193,669 charged frames; zero accepted descendants |
| 2026-08-16 | Live branch-and-bound screen | complete: close exact disposition | +0.0435 +/- 0.0433 seed-block SE; only three cells move; 102 cascade prunes, five fewer attempts, two fewer acceptances |
| 2026-08-16 | Strict attempt-bound mechanics smoke | complete | One exact abort and independent recomputation; one known cell -0.3825 |
| 2026-08-16 | Fresh strict attempt-bound screen | complete: close | +0.00287 +/- 0.00188; two tiny changed cells; no canonical |

The fresh audit validates the proof and exposes its narrow timing. All 32
instrumented cells are byte-identical to the unset reference after removing
only the new audit field. Across 141 repair attempts and 897 eligible selected
nodes, 16 dominated regions appear. Twelve begin at an already-selected
terminal and are observations rather than actions. The four actionable roots
occur only in first repair attempts, in `rising_switch` seeds 220/221 and
`frontier_dense_recovery` seed 220. They retain ordinary frontier alternatives,
contain 193,669 charged frames, and produce no accepted descendant.

The exact subtree-prune disposition is mechanically safe but too narrow to
advance. All 32 cells remain valid and the proof has no accepted-descendant
violation. It moves only three scores: two improve, one regresses, the minimum
delta is -0.0004, and the paired mean is +0.0435 +/- 0.0433 seed-block SE. The
important causal result is scheduling, not score. Four audited roots become
102 live prunes as alternative routes repeatedly hit the same bound. Total
repair work changes by only -5,574 frames, terminal-reaching attempts fall
140 to 133, accepted alternatives fall 60 to 58, and internal repair gain
rises 124.75 to 126.13. Pruning a subtree does not free its apparent audit
work when ordinary DFS reconverges through many incapable alternatives.

Do not send this exact disposition to canonical evaluation. The next
categorical challenger should keep the same proof but change what owns the
remaining episode: abort the self-contained repair attempt at its first
actionable dominated root, then let the independent repair controller
recompute target, anchor, cost profile, and fresh repair seed from the global
incumbent. This directly tests whether a clean restart converts the proof into
useful breadth more efficiently than exhausting the current suffix frontier.

### Attempt-bound result and next signal

`LR_REPAIR_AXIS_ATTEMPT_BOUND=1` implements the declared categorical
alternative. It observes the same strict proof, skips all work below its first
actionable root, ends that repair episode without inventing a terminal, and
returns to the independent controller. The next iteration recomputes from the
unchanged global incumbent with current remaining budget and a fresh repair
seed. It neither consumes nor carries the abandoned frontier.

The known seed confirms the mechanism but loses 0.3825 in its sole changed
cell: one abort replaces a 128k-frame first attempt, and the later fresh-seed
sequence misses a small improvement the reference eventually found. The fresh
panel is safer but negligible. All 32 cells remain valid; four attempts abort,
repair episodes rise 141 to 147, terminal-reaching episodes rise 140 to 142,
acceptances remain 60, aggregate repair work falls 9,363 frames, and internal
gain rises 124.746 to 124.837. Only two scores move, both tiny gains in
`rising_switch`; the paired mean is +0.00287 +/- 0.00188 seed-block SE and the
minimum cell delta is zero. Close this exact strict-trigger disposition without
canonical evaluation.

The proof-safe family reveals why its score reach is intrinsically small: 12
of 16 fresh dominance observations occur only after terminal selection, and
the four earlier roots affect two sources. A broader successor must change the
signal, not weaken the proof while still calling it proof. Instrument a
behavior-neutral **suffix recovery pressure** instead. At the same horizon,
measure the current prefix's excess SSE over the incumbent prefix and divide
it by the incumbent's SSE still remaining after that horizon. A value of 0.5
means the current route must remove half of the incumbent's remaining error to
catch up; 1.0 is the raw SSE catch-up boundary, not the register proof (an
axis-quality epsilon tie can still win on drift quality). Map fixed round levels without
acting, attach crossings to actual terminal lineage and acceptance, and use
the data to choose whether an early attempt abort or a retained-route priority
handoff has an honest chance. Do not infer a threshold from final score.

## Phase T: suffix recovery-pressure map

### Signal and non-claims

For the current repair prefix `C` and the completed incumbent `I`, measured at
the same authored-axis horizon, define

```text
prefix excess = max(0, SSE(C prefix) - SSE(I prefix))
incumbent remainder = max(0, SSE(I whole) - SSE(I prefix))
recovery pressure = prefix excess / incumbent remainder.
```

The fixed audit levels are 0.25, 0.50, 0.75, and 1.00. A crossing starts one
lineage record and ordinary DFS remains untouched until it returns from that
lineage or reaches its first terminal. Record the root horizon, queued frontier
breadth, charged work, terminal descent, and accepted descent. Compute pressure
only for equal current/incumbent authored-axis populations. A current prefix
can legitimately lack a committed contact observation; count that checkpoint
and its missing observations as incomparable instead of treating missing error
as zero. Fail loudly only if current coverage exceeds the completed incumbent
or the accounting is malformed. A zero incumbent remainder with positive
excess is recorded as unbounded, not coerced to an arbitrary finite value.

This is a normalized burden, not a calibrated probability, feasibility bound,
or reason by itself to prune. It deliberately challenges two assumptions at
once: that a worse prefix usually remains worse, and that the incumbent's
remaining error is the right scale for recoverability. An accepted descendant
is valuable counterevidence, not an invariant violation.

### Frozen compact audit and selector

Run the same eight-source panel at 750k with fresh actual seeds 222-225. The
candidate differs from its reference only by
`LR_REPAIR_AXIS_BRANCH_BOUND_AUDIT=1`; after deleting the one telemetry field,
all 32 cells must be exactly identical. This is an opportunity map, so final
score is forbidden as a threshold selector.

Among the four fixed levels, select the highest level having at least 12
actionable nonterminal crossings, terminal-descendant outcomes for at least
eight of them, activity in at least four runs, and activity across at least
three sources. Then choose the first live disposition from direct false-abort
evidence:

- no accepted actionable descendant: an attempt-abort screen is admissible;
- accepted descendants, but at most 10% of actionable terminal descendants:
  retain the route and test a priority handoff to an already-queued alternative;
- a higher accepted-descendant rate: do not interrupt on this scalar signal;
  next add horizon/remaining-cost conditioning while preserving this audit.

The count gate prevents choosing a clean-looking threshold from a handful of
events. The highest qualifying level keeps the first intervention conservative.
The acceptance rule is frozen before results and uses no score delta. Any live
screen remains compact 750k evidence only; canonical promotion still requires
the standing full 750k probability ladder. Do not run the multi-budget sweep.

| Date | Milestone | Status | Evidence |
|---|---|---|---|
| 2026-08-16 | Recovery-pressure schema and behavior-neutral lineage ledger | in progress | Fixed levels; equal-horizon/equal-population SSE accounting; missing observations explicitly incomparable; accepted descendants retained as counterevidence |
| 2026-08-16 | Fresh 32-cell opportunity map | complete: scalar trigger closed | 32/32 exact; only four actionable 0.25 crossings; one accepted descendant (25%); higher levels terminal-only |

The fresh map closes recovery pressure as a stand-alone interruption signal.
All 32 candidate cells are byte-identical to the unset reference after removing
the new telemetry field. Of 900 eligible repair checkpoints, 806 have matched
authored-axis populations. The 0.25 level starts only four actionable lineages
across four runs and four sources; all reach terminal, consume 322,006 charged
frames, and one becomes the accepted repair after reducing final SSE below the
incumbent by 0.0771. That direct 25% false-abort rate violates the frozen rule.
The 0.50, 0.75, and 1.00 levels each occur seven times only at an already
selected terminal, so none is actionable and no level meets the count gate.
Do not implement an abort or priority handoff from this scalar.

The failed first instrumentation run also exposed a separate, stronger state:
94 checkpoints in one `frontier_dense_recovery` repair have 369 authored-axis
observations missing relative to the completed incumbent at the same horizon.
They all occur in a 105,840-frame attempt that never reaches terminal; the next
independently recomputed attempt is accepted. Counts alone do not establish
whether these are one dead lineage, repeated alternatives, or whether any such
lineage can later produce an accepted full evaluator result.

## Phase U: committed-observation completeness

Instrument missing-population checkpoints as whole prefix lineages. At the first
selected repair checkpoint whose current authored-axis population is below the
completed incumbent at the same horizon, record the missing count, root gap,
frontier breadth, charged work until DFS leaves the lineage, terminal descent,
terminal SSE, and acceptance. Keep ordinary traversal byte-identical. A prefix
fit is inherited by descendants, which suggests missing committed observations
may be categorical rather than merely predictive, but do not call it a proof
until the audit shows that the full evaluator and segmented prefix accounting
agree at terminal.

If an accepted terminal descends from such a root, the categorical hypothesis
is false and the state remains telemetry only. If no accepted descendant is
observed and material nonterminal lineage work recurs, first test a clean
attempt abort: end the self-contained repair episode and let the existing
controller recompute target, anchor, cost profile, and seed from the unchanged
completed incumbent. Do not mix this with recovery pressure, candidate breadth,
or a multi-budget sweep.

### Frozen incomplete-prefix attempt challenger

`LR_REPAIR_INCOMPLETE_PREFIX_ATTEMPT_BOUND=1` is a separate live mode. On the
first nonterminal repair checkpoint with fewer committed authored-axis
observations than the complete incumbent at the same horizon, process the
already-selected prefix normally but suppress all descendant construction,
end that repair episode without inventing a terminal, and return to the
independent repair controller. Existing target, anchor, estimator, breadth,
register, score, and specification logic are unchanged. The scalar recovery
pressure and strict axis bound do not trigger this mode.

First rerun the known seed-222 eight-source row as a mechanics smoke. Require
all cells valid, exactly one incomplete-prefix abort in the known
`frontier_dense_recovery` cell, no terminal attributed to the aborted episode,
and a later independently recomputed repair episode. If mechanics close, use a
fresh 32-cell panel at 750k with seeds 226-229. Canonical evaluation is allowed
only if that fresh panel remains fully valid, has positive total score movement,
has at least three positive seed blocks, no cell loses 20 points, and exercises
at least four aborts across two sources. Otherwise close or redesign the
categorical state; never add a score-selected source exception.

| Date | Milestone | Status | Evidence |
|---|---|---|---|
| 2026-08-16 | Whole-lineage incomplete-prefix audit | complete | 32/32 exact; 14 nonterminal lineages, 13 frontier returns, zero terminal descendants, 96,175 charged frames in one failed attempt |
| 2026-08-16 | Explicit attempt-abort mode and mechanical tests | complete: naive disposition closed | Separate environment; independent repair controller remains owner after abort |
| 2026-08-16 | Known-activity mechanics smoke | complete: naive abort closed | Five repeated aborts from anchor 96, then one failed anchor-99 attempt; -0.0044 in the sole changed cell |
| 2026-08-16 | Monotone anchor-progress challenger | complete: mechanics confirmed | Known seed advances 96 -> 98 -> 110, reaches two later terminals, and accepts the second; floor resets on acceptance |
| 2026-08-16 | Fresh continuation panel | complete: challenger closed | 32/32 valid; zero incomplete-prefix roots or floor advances; all 131 repair attempts reach terminal |

The naive smoke invalidates the assumption that returning saved work to the
budget-aware allocator is enough. It aborts the known failed attempt at frame
600,386 rather than 696,561, but the larger remaining budget keeps target 102
and anchor 96 affordable. The controller retries anchor 96 five times with new
seeds; each route hits another incomplete prefix. It eventually moves only to
anchor 99, reaches no repair terminal, misses the reference's later accepted
repair, and changes the final score by -0.0044. Do not run the fresh panel for
this disposition.

Challenge the removed-failed-state assumption narrowly. Under the separate
`LR_REPAIR_INCOMPLETE_PREFIX_PROGRESS=1` diagnostic, an incomplete root at gap
`g` still ends the current self-contained attempt, but raises a monotone minimum
anchor to `g`. The next iteration fully recomputes target and affordability
while excluding anchors before that proven problematic horizon. Starting from
the incumbent at `g` restores its complete authored prefix; a later incomplete
root may advance the floor again. Any accepted repair resets the floor because
the global incumbent changed. Record the floor in both repair-decision and
attempt telemetry, and keep all ordinary production decisions at floor zero.

Repeat only the known seed-222 mechanics smoke first. Require every selected
anchor to respect its recorded floor, every floor advance to equal an observed
incomplete root, no repeated abort from an anchor below the prior root, all
eight cells valid, and at least one terminal-reaching repair after the first
abort. Only then use the already-declared fresh seeds 226-229 gate.

The progress smoke confirms the intended state transition. In the known
`frontier_dense_recovery` cell, attempt 0 starts at anchor 96 and raises the
floor to incomplete root 98. Attempt 1 starts at 98 and reaches a rejected
terminal; attempt 2 starts at 110, reaches a terminal, and is accepted, which
resets the floor. Attempt 3 independently starts at 120 and reaches another
rejected terminal. There is one abort rather than the naive mode's five, all
eight cells remain valid, and the sole changed score rises by 0.048.

The frozen fresh panel nevertheless closes this challenger before canonical
evaluation. All 32 cells at seeds 226-229 are valid, but none of 131 repair
attempts encounters an incomplete prefix: there are zero aborts, zero floor
advances, and zero score movement. The required activity gate was four aborts
across two sources. Keep the mechanism diagnostic-only and production behavior
unchanged.

This is also evidence against treating failed repair episodes as a broad
scheduler defect. Across the existing production references for actual seeds
218-229 (96 source/seed runs), 412 repair episodes contain only three episodes
without a terminal, totalling 112,659 frames. Only one is followed by another
repair, and that next repair already chooses a different target and anchor.
The repeated same-anchor churn was created by the naive early-abort experiment;
it was not the ordinary controller's prevailing behavior. Further work should
not weaken or elaborate this rare-state rule merely to make it activate.

## Phase V: model the value of a searched next-contact pool

### Challenged assumption

The promoted distilled next-impact controller predicts the mean
scorer-compatible impact fit of one viable next-arc proposal. That controller
was worth +3.3207 headline points at canonical 750k, so this information layer
has demonstrated leverage. But production does not take one random next arc:
it builds a broad candidate pool and retains its useful head. Treating the mean
one-proposal outcome as the value of a searched pool is an untested objective
mismatch.

Use the frozen readiness corpus before changing the compiler. Its normal
contexts with at least 27 generated attempts provide repeated outcomes from the
same incoming state and authored target. Define one robust order-statistic
label, fixed before reading its result: the mean scorer-compatible impact fit
of the best quartile of viable attempts. This is deliberately less optimistic
than the sample maximum and keeps authored impact unchanged. Contexts with
fewer than 27 attempts do not train or validate the label; they remain outside
the claim rather than being imputed as searched pools.

Fit one incumbent-anchored 16-tree residual to this label. The deployed
32-tree model stays an exact serialized prefix, matching the safer architecture
from the earlier realized-fit residual study. Stream raw compressed shards;
never materialize the corpus in memory. On the untouched validation seed,
report absolute error, source-macro error, proxy-group pairwise ordering,
selected top-one/top-two tail value, corresponding ordinary mean-fit movement,
and incumbent ranking agreement. These proxy groups are only an offline
licensing instrument because the corpus does not retain production knob-grid
identity.

A live fixed-count arm is licensed only if the residual improves tail-label
MSE and source-macro MSE, improves proxy pairwise tail ordering and both
selected top-one and top-two tail value, worsens neither selected top-one nor
top-two ordinary mean fit by more than 0.002, preserves at least 80% of
incumbent top-one choices, and improves tail MSE in at least three quarters of
represented sources. No tree-count, quantile, blend, source, target, or budget
variant may be selected from this result. If licensed, the arm changes only
the fitted-grid impact factor: probe rows, two proposal slots, exact candidate
evaluations, candidate breadth, traversal, repair, register, scorer, and
authored targets remain fixed. Use compact 750k mechanics/direction evidence
before the standing canonical ladder, and do not run a multi-budget sweep.

| Date | Milestone | Status | Evidence |
|---|---|---|---|
| 2026-08-16 | Pool-value hypothesis and offline gate frozen | complete | Best-quartile label; >=27 attempts; incumbent-prefix + 16 residual trees; no compiler behavior |
| 2026-08-16 | Streaming offline assay | complete: live arm licensed | 4,413 validation contexts, all 44 sources improve tail MSE; every frozen gate passes |
| 2026-08-16 | Explicit fixed-count live arm | complete: exact arm closed | +175.24 over 32 valid pairs, but one -37.18 cell exceeds the frozen -20 tail guard |

The streaming assay reconciles all 121,741 impact-authored training rows to
their raw contexts and finds 13,124 contexts with at least 27 attempts (8,711
development, 4,413 validation). The best-quartile label is materially distinct:
it averages 0.1843 above ordinary mean fit, while remaining 0.0965 below the
sample maximum. This is a searched-pool value rather than a relabelled mean or
an optimistic oracle.

On the untouched validation seed, the incumbent-anchored residual reduces tail
MSE from 0.06147 to 0.01414 and source-macro MSE from 0.06169 to 0.01386; all
44 sources improve. Across 347 explicit proxy choice sets, pairwise tail-order
accuracy rises 59.07% to 65.18%, selected top-one tail value rises 0.75223 to
0.75733, and selected top-two tail value rises 0.73179 to 0.73506. The same
choices also improve ordinary mean-fit top one and top two, so the pool target
does not buy its head signal by sacrificing the old one-proposal label.
Incumbent top-one agreement is 82.13%, top-two overlap is 94.96%, the serialized
incumbent prefix is bit-exact, and candidate export error is 3.4e-16. All frozen
offline gates pass. Proceed to one explicit fixed-count live arm; do not alter
the label, tree count, or scope from these outcomes.

Freeze the live directional screen before running it. Compare the explicit
pool-value arm with commit `29118ded` on seeds 230--233, budget 750,000, and
these eight sources: `believer_56_6s`, `believer_impact_56s`,
`frontier_dense_recovery`, `frontier_low_air_endurance`,
`regression_amplitude_mosaic`, `regression_transition_mosaic`,
`rising_switch`, and `split_signal`. This is 32 paired cells, not a substitute
for the canonical benchmark. Require 32/32 valid pairs, positive aggregate
movement, positive mean movement in at least three of four seed blocks and at
least four of eight source blocks, no cell loss worse than 20 points, and at
least eight score-changing pairs. Close the exact arm if any gate fails. If all
pass, make the arm the proposed default and use only the standing canonical
750k probability ladder for promotion. Do not tune the residual, sources,
seeds, or gate from this result, and do not run the multi-budget sweep.

The live arm is broad and directionally strong but fails its frozen tail gate.
All 32 tracks change, all 32 pairs remain valid, the score sum rises 175.24
(+5.48 per cell), three of four seed means and six of eight source means are
positive, and there are no lost or gained completions. Mean air, impact, and
speed quality all improve. Seed 231 nevertheless loses in all eight sources,
including a -37.18 regression-transition cell, while seeds 230, 232, and 233
average +12.99, +10.19, and +8.02. The outlier remains fully valid and does
slightly more search work; it loses both impact and speed quality. This is path
selection variance, not a failure or exhausted-search explanation. Respect the
predeclared guard: keep `pool-value` explicit and do not take this exact model
to canonical evaluation.

## Phase VI: value requested pools, not only their successful tail

### Challenged assumption

The Phase V label drops every nonviable proposal before computing its useful
head. It can therefore value a state with one excellent success out of many
failures like a reliably productive state. Production does not receive a free
pool of viable proposals: every failed request consumes work and cannot supply
an authored-impact result. A searched-pool value must include availability.

Freeze one semantic successor before examining it. Retain the corpus, >=27
attempt threshold, best-quartile fraction, feature set, development/validation
partition, incumbent 32-tree prefix, and 16-tree residual exactly. For every
requested attempt, assign its scorer-compatible authored-impact fit when it is
viable and measured, and zero otherwise; take the mean of the best quartile of
all requested attempts. Include >=27-attempt contexts with zero viable results.
Do not change authored impact, candidate breadth, probes, proposal count,
traversal, repair, register, scorer, or budget.

License a live arm only if, on untouched validation data, it improves requested-
pool MSE and source-macro MSE over both the deployed incumbent and Phase V's
conditional-pool model; improves requested-pool proxy pairwise accuracy and
selected top-one/top-two value over the incumbent; limits selected viable-tail
and ordinary-mean top-one/top-two debt to 0.002; preserves 80% incumbent top-one
agreement; and improves requested-pool MSE in at least 75% of sources. Use no
model or label variant. If licensed, test it on one fresh 750k paired panel and
retain the same validity, breadth, action-set, and -20 tail requirements before
canonical evaluation. Do not reuse seeds 230--233 or the Phase V source panel.

| Date | Milestone | Status | Evidence |
|---|---|---|---|
| 2026-08-16 | Requested-pool semantic and offline gate frozen | complete: monolithic arm closed | 12/13 gates pass; top-one agreement is 78.18%, below the frozen 80% floor |

The requested-pool label includes 14,335 eligible contexts, including 1,211
with no viable attempt. Mean request success is 66.72%; the requested-pool
label averages 0.59885 versus 0.69798 for the success-conditioned tail. On
4,832 untouched validation contexts, the residual reduces MSE from 0.06880
(deployed) and 0.05733 (conditional pool) to 0.02736, improves source-macro MSE
over both, and improves requested-pool MSE in all 44 sources. Proxy pairwise
accuracy rises 52.67% to 64.26%, selected top-one value rises 0.58759 to
0.61440, and top-two value rises 0.55676 to 0.56475. Viable-tail and ordinary-
mean choices also improve slightly. But top-one agreement is 78.18%, not the
frozen 80%; do not expose this model as a monolithic live ranking.

## Phase VII: separate the exploit and exploration proposal slots

### Challenged assumption

The configured aim lane emits two distinct proposals but ranks both with the
same scalar. They need not serve the same role. Preserve the deployed
distilled-impact top choice exactly as the exploit slot. From the remaining
ordinary-admissible, geometrically distinct vectors, choose the exploration
slot with the frozen requested-pool model from Phase VI. This resolves the
monolithic model's stability defect structurally rather than blending or
shrinking it after a result. It also preserves proposal count, exact evaluation
count, probe grid, candidate breadth, traversal, repair, register, scorer,
authored targets, and budget.

Before implementing live behavior, extend the existing offline report without
refitting either model. Require the hybrid second slot to improve aggregate
requested-pool top-two truth, incur no viable-tail or ordinary-mean top-two
debt, have positive requested-pool source-macro movement with at least as many
sources improved as worsened, and actually change at least 5% of second slots.
The exploit slot must be byte-for-byte the incumbent top choice in mechanical
tests. If those gates pass, run one fresh paired screen at 750k on seeds
234--237 and eight sources not used in Phase V: `river_reentry`,
`pickup_lattice`, `offgrid_conversation`, `dense_dialogue`, `high_air_drive`,
`frontier_pickup_progression`, `regression_transition_mosaic_tempo_fast_5`,
and `believer_56_6s_impact_relief`. Require 32/32 valid pairs, positive score
sum, positive mean in at least three seed blocks and four source blocks, no
cell below -20, and at least eight changed pairs. Only a pass may reach the
standing canonical 750k probability ladder. Do not run the multi-budget sweep.

| Date | Milestone | Status | Evidence |
|---|---|---|---|
| 2026-08-16 | Exploit/explore slot semantics and gate frozen | complete: live arm licensed | Incumbent first; requested-pool second; all six offline hybrid gates pass |
| 2026-08-16 | Explicit exploit/explore live arm | complete: exact arm closed | 121 focused tests pass, but fresh panel is -30.8 over 32 valid pairs and fails breadth/tail gates |

The factorized offline arm changes 9.77% of second slots while preserving every
incumbent first slot by construction. Requested-pool top-two truth improves by
0.00420; viable-tail and ordinary-mean top-two truth also improve by 0.00102
and 0.00048. Requested-pool source-macro movement is +0.00439, with nine
sources improved, seven worsened, and 28 unchanged. All six frozen hybrid gates
pass. Implement exactly this slot ownership behind an explicit environment
arm and mechanically prove that the primary choice is unchanged before the
fresh live panel.

The fresh hybrid panel closes the exact arm without canonical evaluation. All
32 pairs remain valid and all tracks change, but the score sum is -30.8 (-0.96
per cell), with 15 better and 17 worse. Only three of eight source means are
positive, and four cells lose more than 20 points. A stable exploit slot is not
enough: changing the second proposal still redirects the complete DFS broadly.
Keep the explicit mode as negative mechanism evidence; do not blend it or tune
slot activity from this result.

## Phase VIII: scope searched-pool value to independent repairs

### Challenged assumption

Phase V applied its strong conditional pool-value signal to every aim decision,
including the initial route whose perturbation can redirect the whole search.
The signal's semantics are more naturally aligned with repair: given a complete
incumbent and a chosen restart anchor, prefer suffix states whose following
candidate pools have a strong useful impact head. Repair is independently
budgeted, and final registration already compares a completed alternative with
the incumbent.

Freeze one scope-only arm. Initial traversal and ordinary resumed work use the
deployed distilled model exactly. During an independently identified repair
attempt only, use the unchanged Phase V conditional pool-value artifact for
both fixed proposal slots. Do not retrain, blend, gate by source/gap/score,
change proposal count, probe grid, candidate breadth, anchor selection,
affordability, repair seed, traversal, acceptance, register, scorer, authored
targets, or budget.

Mechanically require exact first-terminal track hash, frame, score, and initial
work ledger for every paired cell. Then run one fresh 750k-only paired panel on
seeds 238--241 and the Phase V eight-source set. Require 32/32 valid pairs,
positive score sum, positive mean in at least three seed blocks and four source
blocks, no cell below -20, at least eight changed final tracks, and every final
change to occur in a run with repair activity. Only a pass may reach the
standing canonical 750k probability ladder. Do not run a multi-budget sweep.

| Date | Milestone | Status | Evidence |
|---|---|---|---|
| 2026-08-16 | Repair-only pool-value scope and gate frozen | complete: exact arm closed | First-terminal identity is exact in 32/32; final score is -31.7 and seven improve versus 20 worsen |

The repair-only panel proves the scope and rejects the value rule. Every first-
terminal frame, first-terminal track hash, and initial-work total is exact, and
all 32 pairs remain valid. Repair changes 27 final tracks, but the score sum is
-31.7 (-0.99 per cell), with seven better, 20 worse, and five tied. Only
amplitude mosaic has a positive source mean, by +0.02; all other source means
are negative. The largest cell loss is a bounded -8.8, so the arm is safe but
coherently unhelpful. Do not take it to canonical evaluation.

Together, the three live scopes close this searched-pool model family. The
conditional model was broad-positive but failed its frozen tail guard; the
stability-preserving requested-pool second slot was negative on fresh data;
and conditional pool value inside repair was safely negative. Retain the
streaming offline analyses and result semantics, but remove every rejected
runtime artifact, environment mode, ordering helper, and mode-specific test.
Production remains the accepted distilled controller with no dormant pool-
value compiler path.

Cleanup is complete: the production aim/readiness sources and their artifact
test are byte-identical to the pre-arm commit `29118ded`; both runtime model
artifacts, all three environment modes, the slot-ordering helper, and its tests
are removed. The requested-pool assay now consumes the generated conditional
artifact rather than a production file. The retained production surface passes
116 focused tests.

## Phase IX: adjudicate the original pool-value arm at the real headline

### Corrected decision authority

Phase V's `-20` cell rule was a predeclared compact-screen continuation guard,
not a canonical promotion criterion. It was followed honestly, but it was too
restrictive: a selected eight-source panel cannot replace Benchmark V2's
calibrated estimate of the aggregate 750k effect. The standing sequential
evaluator already retains every adverse cell in the headline and controls its
four planned looks through one calibrated directional-probability boundary.
No cellwise tail, source, validity, effect-size, or multi-budget score veto may
be added. Evidence-integrity checks remain mandatory; compiler failures remain
inside the headline rather than becoming a second decision rule.

Restore the exact Phase V conditional-pool artifact and ranking path. Preserve
the 32-tree incumbent prefix, 16-tree residual, best viable quartile label,
minimum 27 requested attempts, feature transform, two proposal slots, ordinary
admission set, exact candidate evaluator, candidate breadth, traversal, repair,
register, scorer, authored targets, and 750k budget. Activating the already
tested `pool-value` policy as the unset default is the only source-native
challenger change; explicit `distilled` remains the exact current-baseline
control. Do not retrain, blend, scope, tune, rescreen, or run a multi-budget
sweep from the compact result.

Run only `npm run benchmark -- eval --seeds=48 --jobs=48`. The cached Phase-D
baseline and standing N=8/16/32/48 sequential probability rule are the sole
promotion authority. On `accept`, rebaseline through the ordinary workflow and
clean up the now-default naming. On `reject` or `inconclusive`, restore the
distilled unset default and retain the canonical evidence without score
salvage.

| Date | Milestone | Status | Evidence |
|---|---|---|---|
| 2026-08-16 | Exact Phase V mechanism restored as source-native challenger | complete | Artifact SHA-256 `1bf23a9660655b5eec2be5dd9c912c8bd1441c435997a57ff82dcfb1914bf37f`, identical to commit `5c930b67`; 166 focused mechanism/protocol tests pass; no model or policy retuning |
| 2026-08-16 | Canonical 750k sequential adjudication | pending | Standing cached-reference evaluator only |
