# Budget dividends plan

The successor to [`budget-unification-plan.md`](budget-unification-plan.md)
(CLOSED 2026-08-02): that program built the two-coordinate architecture and
paid −0.37 for it; this one collects what the architecture made collectible.
Every phase here traces to a measured number in the closed program's evidence,
not to an idea. Written 2026-08-02 at `c1b6e59`, baseline
`deadline-two-anchor-750k` (595.53).

## What this campaign is for

Three facts left on the table, in value order:

- **+11 to +15 capability points of healed completions** were measured in
  every arm of the 1b investigation — the prize is real; the mechanism that
  reached for it was a lottery and was closed. A lottery-free mechanism is a
  design problem with a priced payoff.
- **The value gradient points below the acceptance surface.** ROI ∝ B^−1.22
  (a 150k frame buys 7.5× a 750k frame), the only ROI hypothesis that ever
  cleared the eval-slot floor lives at 150k–300k, the margin's largest accuracy
  wins are below 300k — and the promoting instrument sees none of it.
- **Production runs at 1,000,000 frames with zero recorded evidence** — above
  every budget the compiler has ever been tuned, calibrated, or benchmarked at.

## Success criteria, checkable at the end

1. The **capability debt is repaid**: the capability stratum recovers the
   −1.85 booked at the `deadline-margin-750k` promotion, at a headline the
   ledger tolerates — or the repayment lane is closed as measured with its
   trade curve on record.
2. **Production's operating point has evidence**: a 1M validation panel exists,
   its accounting is clean, and anything it surprises us with is filed as work.
3. **The acceptance-surface decision is made and executed** — a decision
   criterion, satisfied by either outcome: a 300k tier live with its baseline
   cache, or a recorded decision to stay 750k-only with the rationale written.
4. The **drift ledger stays above −3.0**. It carries forward at **−0.37**; it
   is not reset — the unification's cost is this campaign's opening balance.
5. **No zombie lanes**: every phase and probe opened here ends landed,
   or closed as measured with reopening conditions named.

## Standing regime

Inherited whole from the closed plan — the gold standard as evidence with the
campaign owning the decision; promote unless the negative boundary or an
anomaly, investigate before judging; deliberate `--force` promotions with the
numbers recorded; bundles as candidates; stale-sweep ledger; comment hygiene;
one deadline signal; the observation invariant — plus the two lessons that
program paid for:

- **Action-set power.** No preview is believed until the candidate's action
  set is counted: how many cells CAN it change, and what failure rate would
  the observed zero exclude? (1b's clean preview had P(zero collapses) ≈ 0.55
  on 14 changed cells.) The 7-source mini-manifest instrument (4-minute
  48-seed mover grids, verified compile-identical) is the standard tool; Track
  T promotes it into the repo.
- **Composition re-probes.** Sequential candidates in one mechanism family are
  re-probed against the current tree before their eval. The tree between
  candidates is also a composition.

## Phase 0 — operating points (evidence first, then the decision)

**0a — the 1M validation panel.** 44 development sources × ≥2 seeds × 1M,
trace telemetry, through the family-grouping collection path. Questions it
must answer: does accounting hold (it always has — violations are
instrumentation bugs); where does the margin sit across a 1M compile (the
estimator's domain reaches 1.5M — this is in-domain, unlike everything else
about 1M); what does the breadth law's 108 candidates/gap actually buy
(first-completion cost, phase shares, repair economics vs the 750k tables);
and does anything about the production operating point contradict the laws.
Deliverable: a short dated section in `budget-law-study.md` — not a new study
file — plus filed work items for surprises. Cost: minutes.

**0b — the acceptance-surface decision. DECIDED AND EXECUTED 2026-08-03.** The
owner chose **(ii): a second, non-promoting but tracked surface** — over (i) a
300k promoting tier and (iii) 750k-only.

*Why (ii) and not (i).* Two reasons, both about keeping the promoting
instrument honest. The **apples-to-apples headline**: adding a budget to the
acceptance surface changes what the headline number *means*, and every
promotion in the ledger — and the drift ledger itself, criterion 4 — is
denominated in the current one. A tier is a ruler change, and this campaign has
already paid for one. The owner's **episode-transfer principle**: what
transfers between operating points is the *evidence* about a mechanism, not the
acceptance threshold; a mechanism that rescues completions at 250k should be
*seen* at 250k and then *judged* on the surface the campaign already trusts.
(ii) buys the seeing without touching the judging.

*Why not (iii).* The motivating measurement is not marginal. At 250k the
rescue-class lever read **capability +112.9 with 11 completions gained** —
against the same mechanism family whose 750k reading was a −5.41 lottery. (That
figure comes from the Phase-1 rescue-scale investigation and is quoted here as
the decision's stated input; when Phase 1 closes it should be cited to its own
archive, and this paragraph updated with the reference.) §6.2
explains the gap structurally rather than as noise: on the promotion ladder's
own seeds at 750k the capability sources are already all valid, so a rescue
lever has nothing to rescue and can only lose. Staying 750k-only would keep
that class of result permanently invisible, which is a measurement failure, not
a conservative choice.

*What was built.* `npm run benchmark:v2:low-budget-reading` — a standing paired
reading, capability mini manifest (11 sources) x 48 seeds x 250k, working tree
against the promoted campaign baseline's **compiler snapshot** (resolved from
`campaign-baseline.json` and checksum-verified, the way the eval machinery does
it — not a checkout of the promoting commit, because the snapshot is what the
promotion actually verified and it holds the benchmark framework fixed across
arms). Fixed verdict vocabulary — PARITY / RESCUE-POSITIVE / SCORE-POSITIVE /
ADVERSE / UNDERPOWERED — with the criteria in the instrument header, an
always-printed action-set power footer, and an accumulating history under
`generated/benchmark-v2/low-budget/`. It is a **loop step, not a chain step**:
documented in `HOW_TO_WORK.md`, wired into nothing, writing to no governance
state. Built on Track T's mini-manifest and power calculator; the arm-reading
and pairing half they share now lives in `scripts/benchmark/paired_grid.ts`.

*Why 250k and not 300k.* 300k is the edge of the remaining-work estimator's
calibrated domain — an argument about a *model*. This surface is evidence, and
evidence wants the regime where completions are actually at risk. 250k is where
the rescue-class measurement above was taken, it is a member of the canonical
suite's own `probe` and `canonical` budget profiles, and it is one of the two
budgets the campaign deferred rather than deleted — so the conversion path
below reuses this exact operating point instead of inventing one.

*The first reading, 2026-08-03, is in the history.* Tree at `c7b01d8` against
`reach-stamp-min-merge-750k`: **PARITY, every one of 528 cells bit-identical**,
controls included — the pipeline is proven end to end and the instrument
self-checked. Two things worth keeping from it. First, the tree's
`compilerSourceFingerprint` differs from the baseline's (`408db03…` vs
`cfba095…`) purely because `package.json` gained npm-script lines, and the
reading still correctly read PARITY: compiler identity is a conservative
*identity*, tracks are the behaviour test, and the instrument uses the right
one. Second, and the point of the whole phase: **118 of the 528 baseline cells
are invalid at 250k** — `dense_recovery_frontier` is valid on 17 of 96 and
`rapid_pickup_frontier` on 57 of 96, while every control and all of
`low_air_frontier` are 100% valid. That is the rescue headroom, measured, on the
promotion ladder's own seeds. At 750k it is zero. The surface has something to
see.

*The conversion path, if (i) is ever wanted.* Nothing here forecloses it, and
the reading is deliberately shaped to be the on-ramp: (1) the operating point
is already a deferred campaign budget with a literal seed schedule; (2) the
accumulated readings under `generated/benchmark-v2/low-budget/` are the
variance evidence a sequential calibration at that budget would need, at no
extra compute; (3) promoting it means adding 250k to `scope.budgets`, building
its baseline cache, and re-deriving the look boundary — and accepting the
headline redefinition that (ii) was chosen to avoid. Phase 2 remains open under
(ii) as the plan states.

## Phase 1 — revisitable depth (the campaign's centerpiece)

**Goal.** Capture the healed-completion pool and repay criterion 1, with a
mechanism that cannot lose a completion the baseline keeps.

**The design problem, precisely.** Graded depth pressure failed because the
withdrawal was permanent: a shallowed node that needed its second hop never
got it back, and one lost completion (~50 points) erases the mechanism's
entire value (+12ish). Revisitable depth makes the economy reversible:
shallow under pressure, **re-deepen when the shallowed choice fails to place
its contact** — a local, deterministic, per-node event, not a threshold on a
signal. The re-deepening charges its frames honestly; the bet becomes "spend
the second hop only where the first hop proved insufficient."

**Constraints, all inherited from paid-for lessons:** no mode triggers (the
binary arm measured −6.2/−41.5; the graded arm at saturation IS the binary
arm); depth decisions stay post-sort (no pool-content change, no cache-key
debt); determinism in (spec, seed, budget); re-deepen conditions must be
functions of the node's own outcome, never of a second "am I behind?" signal.

**Gates.** Collapse-enriched mover grids first (the four known lost cells and
their seed blocks are in the p1b-collapse archive); the action-set power check
on every preview; a full 44×8+ grid before the eval; then N=48 under the
posture. The decisive metric is the lottery's own arithmetic: lost-completion
rate versus healed value, both sides shown. A variant that loses any
completion the baseline keeps must show its healing math beats ~50 points per
loss — or it is the same lottery with better clothes.

**On an unexpected result:** investigate with the instruments until
understood; the p1b-collapse decomposition method (env-gated arms, bit-identity
off) is the template.

## Phase 2 — the low-budget estimator regime (conditional on 0b)

Only if a sub-750k surface opens. The calibrated domain stops at 300k; 150k is
a proven distinct regime (censoring-heavy, 84% path-free, incumbents
themselves 19% biased). The named ingredient: **episode pace**, weight-zero in
the shipped artifact yet the most accurate remaining-work component at
75k–300k (0.088–0.093 vs structural 0.102–0.305). The work: a
regime-conditional fit under the inherited calibration protocol (double-blocked
folds, per-observation intervals, resumed exclusion), honest applicability,
and only then any policy consumer at those budgets. If 0b chooses 750k-only,
this phase closes unopened — that is not a failure of the plan.

## Phase 3 — the margin base-shape decision (deliberate, low urgency)

The shipped margin's structural base is V1-shaped × the artifact's law scale —
documented as a deviation, possibly load-bearing (it reconstructs the proven
prior+correction architecture that the deleted pace blend used, and the
requires-staleness finding says that architecture wants a biased prior).
Resolve it deliberately: one candidate that swaps to artifact coefficients and
re-anchors the three constants, against the incumbent, one eval. Either
outcome is a win: an accuracy gain, or the accident blessed with a measurement
instead of a footnote. Nothing waits on this.

## Track P — probes (free, anytime, archives only)

- **Acceptance signal probe**: does the margin's trajectory at first
  completion predict repair acceptance? One script over the existing archives.
  If null, the 18.6% zero-yield pool's acceptance-prediction lane stays parked
  with two nulls behind it.
- **Loss-rate bounding** (optional): ~1 hour of mover grids bounds the
  share-0.2 capped variant's loss rate below/above the ~0.3% break-even —
  only worth running if Phase 1's design stalls.
- **`HANDOFF_QUALITY_N_CAND_FLOOR = 8` bracket**: sub-benchmark evidence only
  (golden v1 75k tier); the floor binds below 69k.

## Track T — tooling

Promote the mini-manifest into the repo as a supported instrument (it lives in
a scratchpad today); add an action-set power calculator to the preview
workflow (changed-cell count + the failure rate an observed zero excludes).
Small, unglamorous, and the difference between the next 1b being caught in a
4-minute grid instead of a 26-minute eval.

**LANDED 2026-08-03.** `npm run benchmark:v2:mover-grid` derives the mini
manifests from the canonical ones by source-id selector (presets `capability`
— the default, all three frontier groups — and `p1b-collapse`; plus
`stratum:`/`group:`/bare-id terms), runs both arms through `scale_study.ts`
with the ref compiled in a throwaway worktree, and prints per-cell,
per-source and per-group deltas. `--verify` proves compile-identity without
compiling; `--report=<cand>,<ref>` re-reports existing archives. Every report
ends with the action-set power footer —
`npm run benchmark:v2:action-set-power` is the same calculator standalone.
Evidence only: the aggregate is a renormalized subset score, never a headline.

**Extended 2026-08-03 by Phase 0b.** The half these instruments share — what a
paired cell is, when two arms are comparable, and how a paired delta is blocked
by seed — was extracted into `scripts/benchmark/paired_grid.ts` so the mover
grid and the low-budget reading cannot drift apart on the arithmetic. The one
behavioural difference is deliberate and named there: an engine-kernel
difference is fatal to a mover grid (it compares TypeScript changes) and a
stated warning in the low-budget reading (a tree legitimately spans a rebuild).

## Phase 4 — the forward-evaluation smell (added 2026-08-03, owner-mandated)

**The observation.** 51% of forward-eval rollout calls end at a hop-1
dead-end verdict (Phase 1's falsification measurement), on a mechanism that is
~half of every compile's charged frames. The owner's fork, verbatim in
spirit: *if this is real signal it is amazing; if it is artifact it is
catastrophic; the answer probably lies between, and it is a huge smell that
must be carefully understood.* Nothing in this repo has ever verified the
verdicts' truth — the prior reassurance ("pruning working as designed") is an
unverified claim of exactly the class this campaign has caught being wrong
three times.

**The fork, made checkable.** Three explanations, each with a discriminating
measurement:

1. **True signal** — the positions are genuinely dead. Check: at a sample of
   hop-1 dead-end verdicts, run the FULL search-grade expansion at that child
   (real breadth, real gates — not the rollout's view) and count survivors. A
   verified-true rate near 100% vindicates the verdicts; the terrain is sharp
   and the information is premium.
2. **Rollout artifact** — the greedy child policy or the rollout's breadth at
   the child declares death where the real search would find life. Check: the
   same sample, plus breadth-parity audit (what nCand/gates does the rollout
   use at the child versus what the search uses when it genuinely arrives
   there?), plus the confusion matrix against realized search outcomes on
   nodes the search later expanded (verdict said dead / search found child;
   verdict said alive / search dead-ended).
3. **Generation problem** — the pool's tail feeds rollouts candidates that
   were never alive. Check: dead-end rate by pool rank and by pre-sort score
   (if ranks 4–5 carry the rate and the pre-sort already priced them low, the
   rollout re-purchases known information — the "cheaper rollouts" lever); by
   gap band and spec family (concentrated = terrain, diffuse = machinery).

**Improvement lanes, one per branch** (chosen by the evidence, never
pre-committed): (1) true+concentrated → generation quality at hard gaps is
the lever and the verdicts join the map as a trusted signal; (2) artifact →
fix the rollout's child policy/breadth parity — a correctness candidate with
ranking-wide consequences, evidence ladder + eval like any other; (3)
generation → the pool/ranker feed at hard gaps, connected to the (now
current-ruler) pool verdicts. Mixed outcomes get apportioned by the confusion
matrix's numbers.

**Inputs**: the rollout-economics study (running: spend decomposition,
verdict value, rank/gap concentration) feeds this phase; the truth-check and
breadth-parity audit are its own work. **Exit**: the 51% is explained with
verified evidence, the chosen lane has its first candidate or a measured
closure, and the map's forward-eval entries carry the verdict-truth numbers.
Success criterion 5 applies: this phase ends landed or closed-as-measured.

## Explicitly out of scope

The closed plan's do-not-reopen list stands: post-completion pressure and
post-completion depth (both measured null), per-family gates, the spend law in
V1's difficulty slot, budget-adaptive objective/register/readiness-selection,
the share-capped 0.2 variant as shipped policy. Also out of scope here: the
scoring-axis campaign toward 650 — a separate effort with its own (cheap,
zero-compile) diagnosis waiting, deliberately not mixed into budget work.
