# Search rethink — state hand-offs, feasibility, and the budget contract

> A discussion note (2026-05-30), not a spec. Captures a step-back conversation
> about the LDS compiler: what it actually is, why it's the wrong shape for the
> problem, what a cleaner architecture would look like, and — importantly — the
> back-and-forth that sharpened it, including a correction. Companion to
> `future_search_architectures.md`, `compiler_goals.md`, `GOAL_LDS.md`,
> `GOAL_LDS_LOW_BUDGET.md`. No code was changed in producing this.

---

## 0. What triggered it

Observation (user): looking at the LDS compiler, *every "leaf" the search
considers is an entire full track*. The search generates a whole track, then
jumps to the next gap and largely redoes the same thing with some heuristics.
That feels like "a far cry from optimal" — built to technically satisfy the
compiler properties rather than to be a sane, simple, robust, efficient compiler.
The ask: step back, understand the *nature* of the problem and the search space,
find the shortcomings, and think future-oriented about a cleaner architecture —
not write V1. Also: revisit "pre-worlding" (good initial conditions), which felt
powerful and may be under-leveraged.

This was confirmed: the "new compiler" in question is the LDS optimizer
(`scripts/v0/optimizer/`), not the legacy greedy (`scripts/lib/search.ts`) nor
the preview greedy `compile.ts`.

---

## 1. What the LDS compiler actually is

A "leaf" = a **complete, assembled, end-to-end track**. (`scripts/v0/optimizer/`)

1. `buildBacktrackingLeaf` (`lds.ts`) descends gap-by-gap, committing the
   lowest-cost surviving candidate per contact, with bounded backtracking and a
   skip-march fallback → the **d=0 base leaf** (one whole track). This *is*
   essentially the legacy greedy, re-housed in an explicit stack.
2. `enumerateLeaves` yields more whole tracks: guided-repair leaves (re-descend
   the whole track with one gap's candidate forbidden), then a discrepancy sweep
   d=1, d=2, … where **discrepancy = edit-distance from the base path**. Each
   d-leaf is a full re-descent.
3. `BestSoFarRegister` (`register.ts`) keeps the strictly-best whole track under
   a fixed comparator. Budget (sim-frames) truncates the fixed leaf sequence.

So "more compute → better" is implemented as *"enumerate more complete tracks
near a greedy spine and keep the best."* Three things make this worse than it
sounds:

- **Unit of work is the whole track; the decision is per-gap.** To reconsider
  gap 3 you re-derive gaps 3..N. Engine prefixes are cached, but the model still
  throws away everything learned and re-walks.
- **The d=0 floor does all the real work and is budget-exempt** — so on hard
  specs the "anytime" machinery never runs. `GOAL_LDS_LOW_BUDGET.md` documents
  this: `solo_run` seed 1 burns ~220k sim-frames in the floor alone,
  `drums_crescendo` ~457k, before a single repair/deviation leaf runs
  (`leaves_considered=1, repair_rounds=0`). The elaborate layer is inert on
  exactly the specs that need it.
- **It was built against a warning already on file.** `DECISIONS.md` D31:
  *"Building the anytime API around a non-anytime algorithm would be premature
  abstraction — the surface would exist with nothing behind it."* That is what
  shipped: the discrepancy/repair/deviation scaffolding is the surface; the
  greedy floor is the thing behind it.

---

## 2. The key realization — the property didn't require any of this

The LDS structure exists to guarantee **monotonicity-in-budget** (Property 1).
But that property is *cheap*. It follows from two things only:

1. the search order is a deterministic function of `(spec, seed)`, and budget
   only **extends** how far you go;
2. a **strict-improvement-only register** holds the best complete track seen.

That gives "more compute never worse" for **any** deterministic search whose
explored sequence grows with budget — best-first, iterative-deepening, adaptive
backtracking, restarts. It does **not** require leaves to be whole tracks, nor
discrepancy ordering, nor base-rotation / repair-chain machinery. Those are
complexity in service of one specific enumeration order whose central premise is
false for this problem (§4).

Two goals had been fused and should be separated:

- **(a) Debuggability / iteration discipline** — the real point of
  `compiler_goals.md`: a code change's effect should be legible, not lost in
  cascading noise. Genuinely valuable; delivered by determinism + the register.
- **(b) A smooth "buy quality with seconds" product dial** — a future feature.

The architecture is contorted to serve (b). You can keep (a) for free and drop
the machinery built for (b). **(Note: this framing was partly corrected — see
§6. The *objective budget unit* is not the speculative part; the *enumeration
order built to spend it* is.)**

---

## 3. Pre-worlding — still there, and it's the whole story in miniature

`scripts/v0/core/preroll.ts`, `withOptimizedPrerollStart`, active when
`spec.preroll > 0`. It morphed exactly as remembered: it no longer synthesizes
pre-first-frame geometry; it picks the initial `(vx, vy)` by scoring the first
gap (plus an optional 4-gap prefix lookahead with a robustness term that favors
starts with more surviving candidates).

The insight: **pre-worlding is the t=0 boundary case of the per-gap hand-off
problem (§4.2).** "Choose the arrival state that makes the next catch feasible"
is *literally* what `prerollPrefixStartCost` does for gap 0 — it even has a
robustness term preferring states deeper inside the feasible region. It felt
powerful because it's the one place the compiler reasons in **state space and
about feasibility margin** instead of edit-distance and local cost. Every gap
boundary has the same question. Pre-worlding shouldn't be a bolted-on opener; it
should be the *recurring primitive*.

---

## 4. The nature of the problem (the load-bearing part)

The compiler treats Spec→Track as **combinatorial search over discrete
whole-track points**. It isn't. It's a **chained dynamical control problem**.
Almost every pathology follows from that mismatch.

1. **Dynamical system with sensitive dependence.** Rider state evolves; each gap
   steers a system whose input is the previous gap's hand-off state. Symptom on
   file: `dense_sprint` diverged on a **0.001 cost difference at one gap** and
   ended up 2.4× worse 30 gaps later (`future_search_architectures.md`).
   *Implication:* "edit-distance between tracks" (discrepancy) is meaningless
   here — a d=1 neighbor is not a *nearby* track. Searching in edit-distance
   space is searching the wrong space.

2. **A chain of two-point boundary-value problems coupled through hand-off
   state.** Each gap is a function
   `(entry_state, target_frame, axis_targets) → {(geometry, exit_state)}`. The
   contact is a **state-handoff interface**. `exit_state` of gap *i* is both an
   output of *i* and a feasibility constraint on *i+1* — not every exit state is
   catchable next. *Implication:* the natural decomposition is per-gap with
   `exit_state` first-class; the natural difficulty metric is
   **feasibility/reachability**, not local cost.

3. **Feasibility is the bottleneck, not optimization.** On hard specs the failure
   is *landing the contacts at all*, not axis fidelity. The floor thrashes because
   greedy commits a locally-cheap landing whose **exit state is a dead end**. The
   backtracking is the search discovering, expensively, that a hand-off was
   doomed. *Implication:* compute should buy **feasibility foresight**, not more
   quality variants of an already-feasible track.

4. **Local cost weakly predicts global quality** (Phase-0: r≈0.7–0.8). The greedy
   spine LDS rotates around is itself unreliable, so spending budget around its
   low-discrepancy neighborhood is spending budget around a bad center. The LDS
   premise ("heuristic usually right; failures are a few wrong turns") is
   violated by construction.

5. **Per-gap difficulty is heterogeneous.** Most gaps trivial; a few brutal.
   *Implication:* compute must be **allocated adaptively** (more where it's hard).
   Fixed-discrepancy / fixed-width-beam can't; adaptive backtracking / best-first
   can. This is why greedy's adaptive DFS beat beam in Phase 4.

---

## 5. A cleaner architecture to explore (directions, priority order)

Throughline: **stop searching the space of whole tracks; search the space of
state hand-offs, and reason about which hand-offs are feasible.**

- **A. Make rider state at contacts first-class; rank by hand-off margin.**
  Change the per-gap objective from "cheapest landing" to "cheapest landing that
  leaves the rider in a *robust* state" (far from ejection thresholds, moderate
  vy, sane velocity angle). Lives inside existing candidate ranking. Smallest
  change; cheapest test of the whole feasibility hypothesis. **Do first.**
- **B. Backward reachability (the real lever).** A right-to-left pass computing,
  per gap, an approximate **catchable entry region** in a *reduced* state space
  (speed, velocity-angle, maybe vy — empirical). Then a left-to-right commit
  picking the candidate whose exit state sits **deepest inside the next gap's
  catchable region**, subject to hard gates + axis cost. Standard trajectory-opt
  approach for this problem shape; dissolves the dead-end-hand-off failure mode
  *and* the cascading-divergence fragility. Engine stays ground truth (D2): the
  region only *orders/targets* the search; an approximate region can mis-prioritize
  but never emit an infeasible track. **Build only after A confirms most
  backtracks are doomed hand-offs.**
- **C. Generalized pre-worlding / re-anchoring.** Treat initial conditions as B's
  boundary case; consider re-choosing hand-off targets at section boundaries
  (D26, currently deferred) — natural re-anchor points. Rides on B's machinery.
- **D. Multi-arc gaps as state-shaping (D30), framed by feasibility.** Stops being
  a separate feature: *if the arrival state lies outside every single-arc
  catchable region, insert an energy-bleeding bounce to move it into one.*
  Feasibility tells you exactly when, instead of the current "first contact ≥2s
  out → vy≈14 → nothing survives" cliff. **Agreed: defer; its shape is only known
  after B.**
- **E. Keep monotonicity the cheap way.** Deterministic search order +
  strict-improving register. Budget buys *adaptive depth where it's hard*, not a
  global discrepancy superset. Keeps Property 1 + debuggability; deletes
  base-rotation, repair-as-leaves, the discrepancy sweep. **E is not a feature to
  sequence — it's the frame A–D sit inside.** Its compatibility contract is §7.

---

## 6. Correction — the objective budget is crucial, keep it

Pushback (user), accepted: the §2 framing wrongly swept up the budget. Two
different things had been lumped together:

1. **An objective, reproducible, environment-independent budget unit** —
   sim-frames, deterministic, charged at the trajectory-extraction boundary.
2. **A smooth "buy quality with seconds" product dial** (speculative).

The skepticism was aimed at (2) but worded to hit (1). **(1) is not speculative.**
It is what replaced wall-clock, and wall-clock was a real defect: same compiler +
same spec + different machine → different track. That is the difference between a
function and a non-function — not reproducible, not regression-testable, not
reason-about-able. The sim-frame budget was the right call; **keep it untouched.**

The unit choice is specifically good: **sim-frames are cheat-resistant in a way an
iteration counter isn't** — "iterations" can be inflated by doing more work per
iteration (the curve silently degrades); sim-frames can't, because every physics
consultation costs frames and the engine is the thing we don't control. That is
Property 3 in `compiler_goals.md`.

Restated position: **the problem is not the budget — it's the enumeration order
built to spend it** (discrepancy sweep, base-rotation, repair-as-leaves). The
budget is the baby; that machinery is the bathwater.

---

## 7. Is E compatible with the objective budget? (the proof)

Yes — and on conditions *much weaker* than LDS. The budget is **orthogonal** to
the search strategy. The load-bearing conditions:

1. **The search policy is a pure function of `(spec, seed)` and partial search
   state — it never reads the budget.**
2. **The budget is charged in sim-frames at the extraction boundary, and is a
   pure *stop condition* — never a policy parameter.**
3. **A strict-improvement-only register holds the best complete track seen.**

Given these three you get **determinism + objective budget + monotonicity
simultaneously, for essentially any deterministic search** (adaptive
backtracking, feasibility-guided best-first, fixed-schedule restarts). The
argument is identical to LDS's: if the policy doesn't read the budget, the
*sequence of nodes the search visits* is a fixed deterministic sequence and
budget only truncates it. B′ > B visits a **prefix-superset**; the set of
complete tracks reached is a superset; the strict register can only improve. LDS
is just *one* such sequence — and it over-paid by insisting the sequence be
ordered by edit-distance from a greedy spine (the premise false under §4.1).

**What breaks monotonicity is not adaptivity — it's letting the budget become an
input to the policy.** That is exactly the wyss beam search the TODO rejected:
"budget-dependent epoch chopping; no prefix-superset." If beam-width / depth is
computed *from* the budget, a bigger budget changes the *prefix*, not just the
length, and the guarantee dies.

The rule that keeps everything compatible:

> **Adaptive allocation must key off *local difficulty signals* (gap hardness,
> candidate survival, hand-off margin), never off the remaining budget.**
> "Backtrack deeper at a hard gap" is fine (a property of the deterministic
> policy). "Backtrack deeper because the budget is large" is fatal.

This is also a *test* any future design (including E) must pass — the same
property `tests/optimizer_*.test.ts` checks; the clean architecture inherits it.

### The one genuine tension

The current d=0 floor is **budget-exempt** — runs to completion regardless of
cost. That guarantees a complete track but is *exactly why small budgets are
meaningless on hard specs* (floor eats 220k–457k frames before any
budget-subject work). Budget-exemption and low-budget-meaningfulness are in
direct opposition.

Resolution (falls out of conditions 1–3):

- Make the descent **budget-subject too.** No exemption.
- The register already ranks failing/partial leaves by full score (survival
  included). At a budget too small to complete even one track, return the **best
  partial track** — honestly failing, but monotonic (a later passing track
  strictly dominates).
- Still monotonic by prefix-superset: the deterministic descent at B′ reaches
  every complete track B reached, plus more.

Payoff: a **feasibility-guided** descent (A/B) lands contacts cheaply because it
stops committing doomed hand-offs → finds a complete track *fast* → the budget is
meaningful at 20k/40k *and* there's headroom for genuine improvement. **The clean
architecture doesn't just preserve the objective budget — it's what finally makes
a small one mean something.** The `GOAL_LDS_LOW_BUDGET` campaign is fighting the
symptom (cheap floor) of the disease E removes (budget-exempt greedy floor that
thrashes on bad hand-offs).

---

## 8. Roadblocks to plan for

- **Approximation can lie about feasibility.** Mitigated structurally:
  engine-in-loop stays the gate; reachability only prioritizes. Can waste a
  little search, never produce a bad track.
- **Which state dims matter is empirical.** The right reduced state for
  "catchability" is unknown — needs a probe. (`project-v0-arc-angle-floor`
  already shows pure arc geometry has subtle reachable-speed floors: real but
  tractable.)
- **Determinism is the one hard rule.** Any reachability cache / region
  computation must be a pure function of `(spec, seed)`.
- **Don't relitigate the soft/hard split or the axes** (D4–D12 are sound). This
  is purely about the search — the only thing `compiler_goals.md` scopes for
  rebuild anyway.

---

## 9. Next steps (agreed)

1. **The budget-contract test** — make §7's proof executable as an
   *architecture-agnostic* black-box property harness (determinism +
   monotonicity-in-budget + budget-is-a-pure-stop-condition/freeze), written
   against the public compile API so the *future* compiler must pass the same
   contract, not one wired to LDS internals. → `tests/optimizer_budget_contract.test.ts`.
2. **The feasibility probe** — instrument the existing floor on `solo_run` /
   `drums_crescendo`: *what fraction of backtracks are triggered by a hand-off
   state the next gap can't catch?* If most → A and B are validated, and so is the
   claim that a budget-subject feasibility-guided descent makes the budget
   meaningful — before any architecture is committed.

Priority within the rebuild: **A first**, B is the real lever (after A confirms),
C rides on B, D deferred, E is the frame (verify "adaptive on local signal, not
budget" — checkable via step 1's harness).

**Sequencing is evidence-first, not rewrite-first.** Per `docs/HOW_TO_WORK.md`
("empirical evidence for every decision", "fast first, big later", "diagnose every
failure"), the order is: (1) land the budget-contract harness, (2) run the
feasibility probe on what we have *now*, (3) only then commit to the new compiler.
Do **not** delete the existing LDS machinery until the probe confirms the
diagnosis — a green probe is the gate, not this document.

---

## 10. Feasibility probe — RESULT (2026-05-30): hypothesis CONFIRMED

Step 2 ran (throwaway `_probe_handoff` — black-box, optimizer untouched,
deterministic; per-gap RNG replicated from `node.ts`). For each spec it ran the
**real floor** (`buildBacktrackingLeaf` + telemetry) to get its committed path,
backtracks, and skips, then replayed that committed path and classified every
contact gap. A gap where the floor committed a **non-cheapest** candidate while
the **cheapest had survivors** is a doomed hand-off (`handoff_forced`): the gap
is trivially landable, but the cheap catch's *exit state* dooms a downstream gap,
forcing the deviation. Counterfactuals (K=256 same-arrival; upstream re-anchor)
classify true dead-ends as poverty / hand-off / intrinsic.

| spec | contactGaps | backtracks | floor sim-frames | deviated gaps | classification |
|---|---|---|---|---|---|
| tiny_dance (control) | 4 | 0 | 27k | 0 | — (all easy) |
| cold_start | 15 | 7 | 58k | 1 | 1 handoff_forced |
| dense_sprint | 41 | 16 | 71k | 2 | 2 handoff_forced |
| drums_pendulum | 55 | 5 | 110k | 4 | 4 handoff_forced |
| drums_crescendo | 55 | 59 | 457k | 12 | 12 handoff_forced |
| solo_run (seed 1) | 77 | 46 | 220k | 21 | 21 handoff_forced |

Across all specs: **40 deviated gaps, 40 `handoff_forced`, 0 candidate-poverty,
0 intrinsic, 0 skipped contacts.**

**Verdict — H confirmed, decisively.** On every hard spec, the floor's completing
path deviates from the everywhere-cheapest greedy choice only at gaps where the
**cheapest candidate had survivors** (rank-0 survivors ranged 2–18, typically
5–17) — i.e. the gap is trivially landable; the deviation is *not* about
landability but about the **downstream consequence of the cheap catch's exit
state**. Every single deviation classified `handoff_forced`. None were
candidate-poverty (more samples wouldn't help), none intrinsic, none skipped. The
entire per-spec thrash — **5–59 backtracks, 58k–457k sim-frames** — is the floor
discovering, the expensive way, that a cheap upstream hand-off was doomed. The
control (tiny_dance) shows 0 deviations / 0 backtracks. **Compute is being burned
fighting doomed hand-offs, exactly as §4.3 predicted.**

**Correlation worth noting:** thrash cost tracks deviation count, not spec size —
drums_crescendo (12 deviations) costs **457k** frames and 59 backtracks while
drums_pendulum (same 55 gaps, 4 deviations) costs **110k** and 5. The expense is
the doomed hand-offs, not the track length.

**Two smoke-test claims the full run RETRACTED (honesty):**
- ✗ "exactly one deviation, always the opening gap." FALSE — that was the
  2-spec smoke. Deviations are **distributed through the track**: solo_run at
  g5..g63 (21 of them), drums_pendulum entirely **mid-track** (g17, g21, g34,
  g45 — nowhere near the opening). cold_start happens to be the only single-
  deviation spec. So this is a *general* per-gap hand-off phenomenon, not an
  initial-condition special case — which actually **strengthens** the case for a
  recurring mechanism (A/B) over a pure pre-worlding fix (C alone is insufficient).
- ✗ "arrival-state values looked buggy/identical." FALSE — also a premature smoke
  hedge. The full data shows meaningful variation: near-vertical openers on the
  cold specs (cold_start g0 vy=5.25 angle=85.6°; drums_crescendo g0 vy=3.5
  angle=83.5° — the D30 "high-vy drop" regime) vs shallow mid-track hand-offs on
  solo_run (angles 11–47°, vy 1–5). The arrival signature is usable for direction B.

**What is NOT yet measured (the next probe — discriminates A vs B):** the
**manifests→resolves distance** — how many gaps downstream the doomed hand-off
actually bites. The probe found *where the floor fixes it* (the deviation gap),
not *where the pain appears*. Small distance everywhere ⇒ local margin-aware
ranking (A) likely suffices; large/variable distance ⇒ real backward reachability
(B) is needed. solo_run's 21 distributed deviations hint the distance is small and
recurring (A-friendly), but that's not yet measured. One seed per spec here (suite
uses 0,1,2); a multi-seed confirm would harden it before committing to the rebuild.

---

## 10b. Re-probe under impact-anchored placement (2026-05-30): finding SURVIVES

After rebasing onto origin's `impact-anchored arc placement` POC (`46a7916`,
integrated locally on top of the LDS+core refactor) the same hand-off probe was
re-run under `LR_ARC_PLACEMENT=legacy` vs `impact_anchor`, same LDS floor. The
integration is clean: legacy path byte-identical (determinism preserved), all 13
LDS+anytime property tests green, impact_anchor active on the LDS path and
deterministic.

| spec | floor frames L→I | backtracks L→I | handoff_forced L→I | skips L→I |
|---|---|---|---|---|
| tiny_dance | 27k→16k (40%↓) | 0→1 | 0→1 | 0→0 |
| cold_start | 58k→11k (81%↓) | 7→3 | 1→1 | 0→0 |
| dense_sprint | 71k→32k (55%↓) | 16→10 | 2→5 | 0→0 |
| drums_pendulum | 110k→45k (60%↓) | 5→13 | 4→9 | 0→0 |
| drums_crescendo | 457k→28k (94%↓) | 59→5 | 12→0 | **0→9** |
| solo_run (s1) | 220k→53k (76%↓) | 46→74 | 21→31 | 0→0 |
| **total** | **943k→185k (80%↓)** | 133→106 | 40→47 | 0→9 |

**Verdict — the doomed-hand-off finding SURVIVES impact_anchor, and the two are
orthogonal.** What impact_anchor changes vs. what it doesn't:

- **It makes candidates far cheaper to evaluate** — 80% fewer floor sim-frames
  overall (the POC's stated goal: a better candidate *prior* + a pre-target
  proximity reject, so the engine spends less work per candidate). Real, large win.
- **It does NOT remove doomed hand-offs.** `handoff_forced` is *unchanged or
  HIGHER* on 4 of 6 specs (solo_run 21→31, drums_pendulum 4→9, dense_sprint 2→5,
  tiny_dance 0→1). Cheaper candidates mean the floor thrashes through *more*
  deviations, not fewer — the per-gap hand-off structure (§10) is untouched.
  Every hard gap is still `handoff_forced`, never poverty/intrinsic, in BOTH modes.
- **So A/B remain justified and remain the lever for quality/feasibility.**
  impact_anchor attacks *cost-per-candidate*; A (margin-aware ranking) and B
  (reachability) attack *which hand-off to commit*. They compose — impact_anchor
  makes the feasibility-guided search cheaper to run, it doesn't replace it.

**One honest caveat — drums_crescendo's win is partly contacts dropped, not caught.**
Its 457k→28k and 12→0 handoff_forced look spectacular, but it now **skips 9
contacts** (4 handoff, 4 poverty, 1 intrinsic) — the floor's skip-march gave up
on them rather than catching them. So part of crescendo's frame saving is *not*
landing those beats. Net: impact_anchor's cost reduction is genuine and big, but
on the hardest spec it trades some contact coverage for speed. That tradeoff is
exactly what a feasibility-guided commit (A/B) would fix — keep the cost win,
stop dropping the catchable contacts. (impact_anchor also slightly *regressed* the
easy control tiny_dance: 0→1 backtrack — it is not strictly dominant.)

**Bottom line for the rebuild:** keep impact_anchor (big honest cost win, clean
integration, determinism intact), and proceed with A then B on top of it — the
evidence says they address different problems and the §10 diagnosis is unchanged
under the new placement. Probes run at one seed per spec; multi-seed confirm still
advisable before locking decisions.

---

## 10c. Impact-anchor survivor-starvation — diagnosed + lever found (2026-05-30)

Making impact_anchor the **default** was tried and measured. Canonical golden:
GOAL_SCORE 269.8→286.2 (+6%) but contract_pass_rate **87%→85% (−1 row)**, and it
broke greedy_v2 + 2 LDS property tests by **candidate starvation** (≈2/32 survivors
vs ≈13/32 legacy). Determinism was NOT broken (verified by direct repro — the
determinism *test* failed by 30s timeout, not a hash mismatch; I initially
over-read it as a determinism break and corrected). Decision: **do not flip the
default yet — fix starvation first.**

**Throwaway instrumentation** (`_probe_iafail` / `_probe_center` / `_probe_tangency`,
all deleted; black-box, optimizer untouched, deterministic) classified the fate of
every impact-anchored candidate per contact gap. Three hypotheses were tested and
**two refuted** — the value was in killing them cheaply before building anything:

- ✗ **REFUTED: open-loop early-intercept timing** (my hypothesis, and the
  algorithm agent's whole Newton-on-anchorY fix rested on it). Median landing
  error is **+1 frame**, `early` is 0–6%. Timing is fine; bisection/Newton-style
  correction would fix nothing. Good thing we measured instead of building the
  fallback the owner distrusted.
- ✗ **REFUTED: pre-clear gate rejecting good candidates.** Preclear is ~47–49% of
  all candidates — the biggest bucket — so it looked like the culprit. But moving
  the impact point to the leading edge (`impactCenter` 0.5→0.06) collapsed preclear
  58%→11% while **onbeat barely moved** (29%→33%): the freed candidates reclassified
  into `late`/`offbeat`, not survivors. Preclear was *cheaply rejecting candidates
  that would have failed anyway* — a red herring, and removing it is worse on
  sims-per-survivor.
- ✓ **CONFIRMED: geometric catchability, governed by APPROACH ANGLE.** Survivor
  rate tracks approach angle hard: vertical (70°+) **84%**, mid 44–63%, shallow
  (<40°) **15–19%**. impact_anchor was tuned for the drop case and starves on
  grazing/shallow approaches. drums_signature is almost all shallow → worst hit →
  the lost contract row. Failures there are **ejected (20%) + offbeat (28%)**:
  the arc surface meets the velocity at a steep *relative* angle and throws/redirects
  the rider.

**The lever — tangency-matched leading-edge placement.** Set the arc's tangent AT
the impact point to the approach direction minus an incidence angle, so the rider
**grazes onto** an aligned catch instead of being intercepted across it. Measured
(survivor-rate probe, K=32, floor-spine arrival states):

| spec | onbeat default → tan-lead-i15 | shallow-onbeat default → best |
|---|---|---|
| tiny_dance | 55% → **99%** | 44% → **100%** |
| cold_start | 36% → **87%** | 31% → **89%** |
| drums_signature | 18% → **48%** (peak at i5) | 20% → **59%** (i5) |

Both failure modes (preclear AND ejection) collapse together; onbeat roughly
triples on the hard shallow regime. **Incidence should scale DOWN with speed:**
on slow specs bigger incidence is strictly better (i25→99%); on fast dense
drums_signature onbeat peaks at i5–i15 then *falls* as ejection climbs
(30%→46%→59% at i5→i15→i25) — too flat an arc lets a fast sled skip/eject. A
principled local rule (incidence ∝ 1/speed), not a constant. This is the
impact-anchor idea done *right* — match the surface to the flight, not just the
position — i.e. exactly the §5.A "hand-off margin" intuition realized in geometry.

**Status / caveats (honest):** this is a **survivor-rate** result (does a candidate
land on-beat in isolation), NOT yet a contract/golden result. Higher yield is
necessary (it directly attacks the diversity-starvation that cost the row) but not
sufficient — it must translate to landed contacts + axis quality in the assembled
track, and be re-gated on full golden + the property tests before any default flip.
drums_signature still tops at ~48% (ejection-limited) — consistent with it being
the genuinely-hard high-speed dense spec; tangency helps but doesn't fully crack it.
Probed at 3 regime-representative specs; broaden before locking. **Next:** implement
speed-scaled tangency in `sampleImpactAnchoredArc`, measure on golden + property
tests, then revisit the default flip.

**Process note:** two sub-agents were used. The *algorithm* agent (independent) was
valuable on economics (sims-per-survivor; the diversity trap) but wrong on mechanism
(timing). The *geometry* agent was NOT independent — it found and reasoned from this
probe's saved JSON, so it echoed the probe rather than corroborating it; weight
accordingly. The data (engine-in-loop probe) was the tiebreaker, not the agents.

---

## 11. Colleague review (2026-05-30) — endorsed, with three caveats

A colleague reviewed this doc and **agreed with the main thesis**: the LDS
compiler searches whole-track leaves near a greedy spine rather than the natural
problem space (§1); the objective sim-frame budget is the good idea and the LDS
enumeration order is the questionable one, correctly separated (§6); "pre-worlding
is the boundary case of every hand-off" is exactly right (§3); and "state
hand-offs + feasibility/reachability" is the cleanest framing of the problem (§5).

The reservations are **implementation-risk, not conceptual** — fold each into the
work before it starts:

1. **Define "partial track" precisely before making the floor budget-subject.**
   §7's "return the best partial track at tiny budgets" is right, but a partial
   *output* and its *DriftReport* must be defined exactly — what `contacts`,
   `off_beat_landings`, `terminus`, and the section axes mean for a track that
   didn't reach end-of-spec — or the monotonicity test goes fuzzy. The register
   comparator already scores failing leaves by `full_score` (survival included),
   so the hook exists; the work is pinning the *report semantics* so the
   black-box key is well-defined at every budget. **This must precede budget-
   subjecting the floor.**

2. **Reduced reachability state is empirical — expect surprises.** `speed +
   velocity-angle + vy` (§5.B) is the *plausible* first basis, not the answer. Be
   ready to discover that contact state, recent stability, or sled orientation
   matters more than expected. The probe (step 2) should measure which dims
   actually separate catchable from doomed hand-offs, not assume them.

3. **Don't delete LDS until the probe proves the diagnosis.** Same as the §9
   sequencing note, stated as a hard gate: budget-contract test first, then the
   probe measuring whether backtracks are really caused by doomed hand-off states,
   *then* build. Net recommendation: right strategic direction; **next move is
   evidence-gathering, not a rewrite.**
