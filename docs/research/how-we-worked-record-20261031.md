# How we worked, from the record (2026-10-31)

A read-only study of how the owner (Jérémie) and his AI collaborators worked
on the compiler from about June to October 2026, centred on August–October. It
asks what that record says about how to work now. No code or data changed.

**Sources.**
- The rules: `CLAUDE.md`, `WORKING.md`, `REWORK.md` and `ARCHITECTURE.md`.
- Current research in `docs/research/`.
- Archived docs at tag `archive/pre-rework-2026-10-03` (cited as `tag:<path>`).
- `git log --all` since 2026-07-15: about 1,600 commits on 46 active days.
- The assistant's memory files in `~/.claude/projects/-home-wyss-line/memory/`
  (cited as `mem:<name>`).

**Caveats.**
- Every commit carries Jérémie's name, so git cannot tell his work from an
  agent's. Attribution comes from the docs and memory.
- Memory files are the assistant's own summaries. They are close to his words,
  but they are not transcripts.
- The August–September Codex records are written in Codex's own register.
- I read the documents that bear on the questions, not all 425 archived files.
- Some principles were first stated in June, before the window. They are cited
  because they recur later.

## 1. Four eras

| era | how work ran | what it produced |
|---|---|---|
| **June – Aug 4.** Claude (Fable orchestrating, Opus agents) on Benchmark V2 | Headline campaigns (550 → 570 → 590 → "mandate 620"), a 48-seed sequential eval, baselines of record, `decide`/`rebaseline`, a drift ledger, evaluator fingerprints | Real mechanisms (breadth law, closed-form ballistic predictor, exit read, short-horizon gap fit, pool-five), a lot of governance machinery, and ~90 "Close … study" commits |
| **Aug 10 – Oct 2.** Codex, mostly autonomous | Successive frozen benchmarks V3 → V4 → V5 → V6, each opened and then optimized ("Open frozen V4 940 campaign", "Complete frozen V4 recovery at 926.9397"), plus roadmaps the owner approved and agents then executed whole | Guided shapes, folds and the automatic repertoire, which the owner liked: "strongly confirmed… aligned" (`docs/research/production-repertoire-feedback-20261001.md`). Also a 1,242-line closure, 134 options and saturating caps |
| **Oct 3–6.** The rework | Audit, then prune and restructure with byte-identical parity; impact redefined from the owner's blind pairs; then one more autonomous overnight campaign (Codex, v7 beam) | 68% dead code removed, 425 → 43 docs, the parity harness, `line.strike.v3` |
| **Oct 29–31.** Re-entry | Discussion first; groundwork, then stop; spec authoring with the owner's taste reviews; step-back documents; a new stratified benchmark | Specs liked "from the first try"; the `minFrames` stopgap (held-out completion 5/16 → 15/16); the framing document; the headline restored |

## 2. What he endorsed and what he pushed back on

**Endorsed, with dates:**
- **Clean, general mechanisms over gates.** On 2026-07-01 he said: "I would really,
  really like to have something clean, something robust, something
  future-proof, something scalable" (`mem:feedback_avoid_hardcoded_thresholds`).
  On 2026-10-31 he asked "what's a short section? what happens at 260 ms?"
  (`mem:compiler-change-philosophy`).
- **Scale-free laws.** On 2026-07-28: "this kind of saturations are quite
  questionable, the compiler behaviour should scale to just about any budget".
  The breadth law that followed replaced seven constants with one anchor and
  predicted a budget it had not been fitted to (+1.24, c7f1518;
  `mem:budget-scaling-laws-not-saturations`).
- **One mechanism, no trigger lanes.** On 2026-06-10 he called it "one prediction
  function". He rejected the launch/catch split, and the scoop and legacy lanes
  were deleted at parity (`mem:readiness-program`).
- **Minimal simulation.** On 2026-06-12: the engine simulates full paths only inside
  arcs and in DFS expansion; ballistic prediction covers everything else. The
  evidence was that full simulation lost −3.9 despite 2–4× better model
  accuracy (`mem:knob-model-pitch3`). It was written into CLAUDE.md
  (`tag:CLAUDE.md`).
- **The benchmark is an instrument, not the goal.** He accepted a ~1-point loss for
  less duplicated code (`mem:consistency-review-cleanups`, June). "Material
  simplification can justify a small measured score tradeoff… individual
  regressions do not create an additional perfection veto" (`tag:docs/compiler_goals.md`,
  `tag:docs/compiler-design-audit-2026-09-11.md`).
- **Understanding first, scaffolding first.** On 2026-08-01, for the budget work: expose the
  right quantities, implement them correctly, validate them on real runs. "Micro-accuracy
  chasing (~1%): don't." He made developer experience a first-class goal
  (`mem:budget-telemetry-campaign`).
- **The working pattern** (2026-10-01): "discuss feedback, investigate it, draft
  an ambitious but focused roadmap, obtain the owner's green light, then execute
  the entire roadmap" (`docs/research/production-repertoire-feedback-20261001.md`).
- **Blind pairwise studies** for perception. He called them "very fun and
  convenient". Absolute grades gave ρ ≈ 0.2–0.3 and were useless
  (`mem:owner-review-method`, Oct 4).
- **No legacy constraints.** On 2026-10-03/04: "Not limited by past design decisions"
  (`mem:rework-foundations-2026-10`).
- **Keep months of work.** On 2026-10-31 he had the headline restored "as the headline has been formed
  for months" (commit 527990fd, `WORKING.md`).
- **Taste and ambition.** Variety is part of taste, "not a metric to maximize". He wants
  holistic, careful and ambitious work, and finds trying something slightly
  worse "fine: iterate with the benchmark" (`mem:compiler-change-philosophy`).

**Pushed back on:**
- **Scope that misread the lever.** On 2026-06-14 he was "emphatic" that more compute, repair
  and bigger pools "DON'T move the needle"; the idea was a whole-spec aim
  (`mem:planning-campaign`).
- **Saturating ramps and gates**, as above. The `budget>=200k AND air<0.38` double gate
  shipped once, and it is now the cautionary example.
- **Reading the data loosely.** He "smelled" a six-arm wash ("if aiming mattered,
  swapping its brain should move the headline") and challenged the 99%
  work-share reading (`mem:knob-model-pitch3`,
  `tag:docs/compiler-design-audit-2026-09-11.md`).
- **Busywork on re-entry.** The README and micro-optimization session "didn't go the
  way I was hoping" (2026-10-29, `mem:reentry-discussion-first`).
- **Optimization campaigns nobody asked for.** On 2026-10-30, CPU work was "groundwork,
  then stop" (`mem:groundwork-vs-focus`).
- **Mixing measuring impact with producing it** (`mem:owner-review-method`).
- **Over-reading a finding into a rule.** On 2026-10-31 he said the strength-resolution result is "not a
  reason to say… put everything the same" (`mem:strength-resolution-not-flatten`).
- **Tools that decide.** Analysis should report and the author should choose; he wanted no
  automatic pipeline (`mem:tools-report-author-decides`, `mem:music-spec-authoring`).
- **Fixing one failure at a time.** "Don't target single failures" (the last Circus failure at
  69.7 s).
- **Imperative wording.** Avoid "must, have to, the problem is"; present each approach as one
  among several (`mem:compiler-change-philosophy`).

## 3. What worked and what didn't

**What produced real, lasting gains:**
- **Deleting and unifying.** The breadth law. Free capture deleted at
  byte-identical output. The scoop and legacy lanes deleted at parity. The
  closed-form ballistic predictor: 451 ns against 19,806, at parity, with the
  31.5% of unbilled shadow frames removed. The speed campaign's rule held 9
  times out of 10: "stopping work pays, reshaping work doesn't"
  (`mem:compiler-speed-campaign`).
- **Counterfactual instruments that cost no compiles.** The impact error budget
  showed that impact bias was 54% of the error and that validity was a small prize
  (`mem:benchmark-v2-impact-error-budget`). The between-gap spread showed
  impact error was structural, not seed luck.
- **The stale-sweep rule** (+5.57): a constant's earlier sweeps go stale when a
  neighbouring mechanism changes what it means (`mem:v2-570-campaign-map`).
- **Owner-in-the-loop on things he can see.** Blind pairs settled the impact
  definition in hours. Taste rounds on specs converged in 1–3 rounds.
- **Byte-identical structural work under parity.** The October 3 pruning,
  the CPU fixes on Oct 29–30, and the crashed-candidate stop.
- **Measuring before changing.** The step-back documents and the benchmark audit
  found what the old panel could not see: completion stood at 957/962 while
  Circus `pairs4` finished on 0 of 24 seeds.

**What produced churn, overfitting or self-grading:**
- **Chasing benchmarks the team had built itself.** V3 → V6 were each frozen
  and then optimized. The October 3 audit found:
  - V6 is anti-correlated with hit clarity (Spearman −0.77; July 514 / clarity 6.5
    against later 822 / 2.6);
  - about 87% of its +299 gain was completion;
  - every V6 input was a training input;
  - seeds reproduced identical tracks;
  - the reported gains for `contact-impact.v1` were self-graded, and the
    compiler exploited a renewal blind spot (`mem:codex-era-audit-2026-10-03`).
- **The headline as sole arbiter, with mandates.** "The headline is the sole
  promotion arbiter… Default-promote on inconclusive… campaign does not close
  below 620" (`tag:docs/forward-eval-value-plan.md`, Aug 3). This produced
  dozens of parity-level promotions and closures, which ended at 596 with the
  mandate unmet.
- **Governance machinery.** Evaluator fingerprints, decision-protocol canaries,
  runner-compatibility records and calibration artifacts that were live policy
  while labelled telemetry (`mem:budget-telemetry-campaign`,
  `mem:benchmark-v2-fingerprint-freeze`). Much of the effort went into keeping
  the instrument consistent with itself.
- **Sweeping knobs inside a saturated regime.** Many results were "bracketed at
  optimum" or "exactly null". The planning ruling and the forward-eval closures
  show that compute and width rarely paid.
- **Autonomous overnight campaigns without perceptual input.** After Oct 5, the
  owner gave no perceptual input until Oct 29. Five overnight questions went
  unanswered while v7 was adopted on v3 loss, with body drag rising
  (`mem:rework-foundations-2026-10`, `REWORK.md` Oct 5).
- **Monoliths and accretion.** The 1,242-line closure, 134 options, 68% of the
  TypeScript unreachable, and 149 npm scripts.

**Why October 3, and what was kept.** The `REWORK.md` "Why" section gives four
reasons: the measure was misaligned with the goal, evaluation was weaker than
it looked, the compiler was a monolith, and the repository was mostly dead
weight. Kept deliberately:
- the arc compiler and its production path, the native engine and the JS
  reference engine for parity;
- the learned artifacts that earn their place by ablation (A1/A2 in
  `docs/research/compiler-budget-20261004.md`);
- V6 as a frozen sentinel defined by outputs;
- the archive tag, so everything stays recoverable;
- the guided-shape repertoire the owner liked;
- the headline formula, `1000·exp(−rms/0.25)`, restored on Oct 31 through
  the production grade.

## 4. Principles that recur

| principle | verdict | evidence |
|---|---|---|
| No hard thresholds; smooth functions of physical quantities | **Confirmed**, from July to October | `feedback_avoid_hardcoded_thresholds`; Oct 31 "what happens at 260 ms?" |
| Scale-free laws, no ceilings | **Confirmed, with a boundary**: the law may be flat for selection knobs ("generate wider, admit narrower") | `budget-scaling-laws-not-saturations` audit table |
| One unified mechanism, no trigger lanes | **Confirmed** | readiness unification d2da185; WORKING "delete rather than flag off" |
| Spend simulation only where it changes a decision | **Confirmed, but reframed**: at a fixed allowance the search spends everything, so a saving is reinvested; a cost change has to be byte-identical (CLAUDE.md "physics accounting") | v2-570 "two earning rules"; full sim −3.9; framing §5 |
| Minimal simulation | **Confirmed in spirit**. The rule as written governed the retired legacy compiler (Oct 3 audit). Its successor is "every native observation is charged" | `tag:CLAUDE.md`; current `CLAUDE.md` |
| The benchmark is an instrument, not the goal | **Confirmed, and sharpened**: never optimize an unvalidated measure; V6 is a sentinel only | consistency review; Oct 3 audit; `CLAUDE.md` |
| Structural vs behavioural changes | **Confirmed, and now the core rule** | `WORKING.md`; Oct 31 adoption record |
| Add viable candidates, never move a cap | **Confirmed**, and it is the origin of approach B | `v2-570-campaign-map`; framing §4 |
| A first weak result is not a verdict | **Confirmed** ("push the direction even on weak results"; "first attempts are not conclusions") | `readiness-central-poc`; `REWORK.md` Oct 5 plan |

## 5. Tensions and how to reconcile them

1. **The headline as target vs "never optimize an unvalidated measure".**
   - The headline is built from v3 error. Its validated part is the ordering of
     clearly different hits. Scale, timing, extras and fine strength are not
     validated (`measure-step-back-20261031.md`), yet strength is about 70% of
     the loss.
   - The owner kept the headline for continuity.
   - *Reconcile:* report it first, as the shared thermometer, but never as the
     sole arbiter. Split every headline move into completion (a failure scores
     0: the `minFrames` rule moved 660.95 → 716.33, mostly through completion)
     and quality on both-complete cells. Say which component of v3 moved, and
     flag gains that come only from unvalidated components.
2. **Frozen, governed benchmarks vs lean tooling.**
   - Freezing protected comparability, but V2's fingerprints and canaries became
     a workload of their own, and V3–V6 became targets.
   - *Reconcile:* identity through resolved inputs and parity, as now; panels
     stay descriptive; no new benchmark versions to chase.
3. **Scale-free mechanisms vs comparisons at a fixed allowance.**
   - These do not conflict. Compare at the fixed allowance he asked for, and
     design mechanisms that never key off the allowance's value.
   - Check one other allowance now and then, as the breadth law's out-of-sample
     test did.
4. **"Try something slightly worse, iterate" vs "hypothesis in advance".**
   - Both hold. The difference is between proofs of concept, which belong on
     branches, are rough and are reported honestly, and adoption, which needs
     the predeclared protocol.
   - The August habit of default-promoting on an inconclusive result is the
     part to leave behind, except for simplifications that are explicitly
     labelled as such.
5. **Autonomous execution vs discussion first.**
   - On Oct 1 he endorsed executing whole approved roadmaps. On Oct 29 he wanted
     to discuss before any work.
   - *Reconcile:* agree the direction, then execute autonomously within it.
     Perception questions block measure changes; they never proceed around them.
6. **The `minFrames` stopgap vs "no thresholds".** It is honest because it is
   measured and labelled a stopgap. It should be retired by a general mechanism
   (B or C in `compiler-framing-20261031.md`), not built on.
7. **Ambition vs held-out discipline.** Claims about generality come only from
   held-out songs at decision points. Ambition goes into trying several
   approaches, not into tuning on the songs that judge them.

## 6. Recommended working principles for the compiler work now

1. **Keep: structural vs behavioural, strictly.** Parity for structure. For
   behaviour, predeclare the hypothesis, compare paired by song, report
   completion before quality, and give every ruler plus the geometry section.
   *Evidence:* the October 3 audit; the clean `minFrames` adoption record.
2. **Adapt: the headline is the first line, never the verdict.** Report it per
   stratum, decomposed into completion and quality, with the v3 components
   named. *Evidence:* the V6 anti-correlation; the 87% completion share; the
   restoration in 527990fd.
3. **Keep: smooth, general mechanisms, and look for the unifying root.** Before
   adding a rule, ask what higher-level mechanism would make it unnecessary
   ("plan as intent, not law"). Mark each change as smooth or as a gate.
   *Evidence:* July 1 and Oct 31 rulings; the breadth law.
4. **Keep: scale-free laws, with the boundary.** Generation may grow with
   budget; selection may be flat; nothing saturates at the benchmark's
   operating points. Print the curve and check one out-of-sample allowance.
5. **Keep: earn by adding viable candidates and by deleting, not by moving
   caps or sweeping knobs.** Before re-sweeping a constant, check whether a
   neighbouring change has made its earlier sweeps stale. *Evidence:* the two
   earning rules; "stopping work pays"; the stale-sweep rule; the long lists of
   null sweeps.
6. **Keep: run several approaches side by side as rough proofs of concept on
   branches** (framing §4–6: B, C, E1). A weak first result informs; it does not
   kill an idea. Adopt only through principle 1. *Evidence:* "push the
   direction even on weak results"; the Oct 31 guidance.
7. **Keep: perception belongs to the owner, through blind pairs, and measures
   wait for his answers.** Do not optimize extras, timing or scale until the
   visibility study is answered. *Evidence:* grades useless; the U1 stop; the
   strength-resolution ruling.
8. **Keep: variety and taste are reported, never optimized.** Show the geometry
   section for every version. Do not turn a finding into a flattening rule.
   *Evidence:* boring score-maximizing tracks; the night study ruling.
9. **Keep: held-out songs only at decision points; pattern categories only in
   dev specs.** *Evidence:* the Oct 31 decision; V6 inputs that were all
   training inputs.
10. **Leave behind: mandates, sole-arbiter rules and default-promote on
    inconclusive.** Also leave the governance machinery that grew around them
    and benchmark versions built to be chased. *Evidence:* Aug 3 plan vs
    outcome; V3–V6 history.
11. **Adapt: autonomy inside an agreed direction.** Discuss, agree, then execute
    fully. Bring back decisions and clips, not surveys. Groundwork is done
    carefully and then stops. *Evidence:* Oct 1 pattern; Oct 29 re-entry; Oct 30
    groundwork ruling.
12. **Keep: few current documents, honest about scope.** One dated research
    document per study, observations stated with how far they reach, stopgaps
    called stopgaps, neutral wording. *Evidence:* the 425 → 43 docs;
    `compiler-framing-20261031.md` as the model.

## Uncertainty and outdated material

- **Numbers from earlier eras are not comparable with today's.** V2 headlines
  (595–611), V4/V6 scores and v1/landing impact are in different units and
  contracts. Only the formula carries over.
- **Mechanism-level findings may not transfer.** Examples are the pool-five,
  the k sweeps and the forward-eval verdicts. They were measured on the
  pre-arc legacy compiler, most of which was retired on Oct 3. The habits that
  produced them transfer; the conclusions may not.
- **The owner's preference on the plan and guides is guidance, not a decision.**
  His stated wish (Oct 31) is not to take the plan or guides for granted.
- **Attribution is approximate.** It comes from documents and memory written by
  the agents themselves.
