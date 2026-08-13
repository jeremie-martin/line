# Repair efficiency campaign

## Foundation decision

The independent, budget-aware repair controller is the production foundation
for this campaign. It is promoted for its verified semantics, clean
architecture, and useful across-budget behavior. Its N=16 score comparison was
inconclusive, so this decision is deliberately not recorded as a canonical
benchmark `ACCEPT`.

The machine-readable decision is
`benchmark/v2/studies/repair-controller-foundation.json`. The reusable scale
reference is
`generated/benchmark-v2/scale/independent-repair-foundation-16.json`. A
self-comparison over all 1,024 cells is exactly zero and preserves 989/1,024
valid outcomes in both arms.

## Why optimize from here

The controller's correctness and diversity questions are settled well enough
to move the campaign's uncertainty from mechanism to allocation:

- iteration zero produces 3,559.27 of 5,235.02 internal-score points at 12.61
  points per million repair frames;
- efficiency falls to 5.52, 4.06, 3.61, and 2.09 over iterations one through
  four;
- repair consumes 49.53% of charged work at 4M while averaging only 4.88
  iterations per run, because later repairs rebuild long suffixes; and
- incumbent-identical and exact repeated-terminal work is negligible, so a
  duplicate-suppression mechanism is not the primary opportunity.

These are direct measurements or deterministic associations, not proof that a
particular replacement allocation will improve authored impact. In particular,
stopping a later repair is useful only if the resumed ordinary frontier spends
the released budget more effectively.

## Objective and constraints

The optimization target remains authored impact under each declared hard
budget. The feasibility bound remains diagnostic. A candidate must preserve:

1. the full contact/survival contract and validity outcomes;
2. one independent anchor decision and at most one terminal per repair
   iteration;
3. exact budget, incumbent, register, divergence, and attribution telemetry;
4. deterministic behavior for a fixed specification, seed, and budget; and
5. clean recomputation from the current incumbent after every result.

The scale headline is the primary comparison. Per-budget score, validity,
repair gain, repair work, resumed-frontier work, estimator coverage, anchor
depth, suffix length, and accepted alternatives explain the result; they do not
replace it.

## First experiment: three-iteration allocation bracket

The first candidate changes allocation only: cap independent repair at three
iterations, then give any remaining hard budget to the existing
remainder-aware ordinary-frontier resume. It uses the existing declared
`LR_REPAIR_MAX_ATTEMPTS=3` compiler environment, so the frozen foundation and
candidate have explicit, distinct identities without adding a permanent
experimental mode.

This is a diagnostic, not a foregone policy choice. It tests the concrete
counterfactual left open by the audit: whether iterations three and later beat
the work that can resume in their place. The governed progression is N=4, then
N=8 only if the score/mechanics evidence is coherent, and N=16 only for a
predeclared retained candidate. Reading the foundation's N=16 result does not
turn a later exploratory arm into an `ACCEPT`.

## Natural follow-ups

If the cap loses, retain unrestricted repair and study allocation without
cross-iteration exclusion state:

1. a continuous minimum-affordable-suffix/value threshold that can decline
   naturally with remaining budget;
2. target-anchor value per estimated cost, validated against authored global
   gain rather than selected-gap SSE alone; and
3. breadth re-evaluation under the promoted controller, because breadth data
   from the removed repair economy is not authoritative.

Every retained follow-up begins from the foundation record above and receives
a new identity and paired scale artifact.

## Progress

### Three-iteration allocation bracket — rejected at N=4

The complete 256-cell look prefers the unrestricted foundation:

- scale delta -0.1986, with 0.69% directional probability of improvement;
- 750k delta -0.0488;
- identical validity, 246/256 in each arm; and
- every one of 17,040 repair invariant/attribution checks passed.

The mechanism moved work exactly as intended. Relative to the foundation it
removed 289 repairs and 15.81M repair frames. Resumed-frontier work gained
13.00M frames, 4,026 terminal offers, and 22 register improvements, but only
1.93 internal-score points. The removed repair work contained 126 register
improvements and 51.51 internal-score points. The net internal loss closely
matches the paired headline loss.

Conclusion: late repair is inefficient only relative to early repair; it is
still substantially more valuable than the existing resumed frontier. A hard
iteration cap is rejected and will not advance to N=8.

### Next bracket — maximum affordable parent depth

The bounded depth-six extension is accepted by the scale decision protocol at
N=8. It stopped at the first decisive look; no optional N=16 sampling was used.

- scale headline 571.1644 versus 570.6516, delta +0.5128;
- 99.5397% directional probability versus the predeclared 99.1667% boundary;
- 750k delta +0.3746;
- identical validity, 495/512 in each arm, with no gains or losses; and
- 47,944 repair decision, budget, lineage, diversity, and attribution checks
  across 1,947 repair episodes, with zero violations.

The score result is mechanically credible. Of 1,918 terminal alternatives,
1,902 were globally distinct and only 16 were incumbent-identical; none of the
identical alternatives was accepted and they consumed 0.026% of repair work.
Depths five and six produced no incumbent-identical terminals. The first
divergence occurred at the selected anchor in 95.0% of divergent terminals.

Depth six is therefore the production default. The separate canonical 750k
qualification subsequently reached `ACCEPT` at its N=32 stopping look:

- canonical headline 602.4958 to 602.9306, delta +0.4348;
- 99.20% directional probability versus the 98.88% N=32 boundary;
- one-sided lower bound +0.0164; and
- identical validity, 1,408/1,408 in both arms.

The accepted archive was promoted as campaign baseline
`independent-repair-depth-six`. No N=48 rows were sampled after the N=32 accept
boundary. The scale and canonical decisions, exact identities, behavior audit,
and evidence hashes are bound in
`benchmark/v2/studies/repair-depth-six-promotion.json`.

### Value-aware anchor runway — rejected at N=8

After promotion of the distilled aim-impact controller and a fresh breadth
revisit, the campaign tested whether repair should always restart as early as
affordability permits. The candidate retained the same worst gap, but priced
each affordable parent by direct anchor-to-target SSE plus one target-arrival
opportunity per regenerated parent transition, divided by estimated frames.
Offline replay deliberately selected a sparse arm: only 139/3,839 historical
decisions changed, all toward later anchors.

The live mechanism behaved exactly as intended but did not improve authored
impact:

- N=8 scale headline 579.5054 versus 579.5092, delta -0.0038;
- identical validity, 497/512 in each arm;
- first-terminal frames exactly unchanged;
- mean repair depth -4.3% and mean attempt cost -2.6%;
- repair episodes +4.6% and accepted alternatives +2.6%; but
- aggregate internal repair gain -0.12%.

Seven of eight budget deltas were neutral-to-negative. The 4M cell mean was
positive by only +0.043 points, too small and isolated to retain. The result
answers the causal question: cheaper later restarts buy more terminals, but the
lost parent runway is worth approximately the saved work. The production
deepest-affordable selector remains unchanged. Exact decision semantics,
score, mechanics, invariants, and evidence hashes are recorded in
`benchmark/v2/studies/repair-runway-opportunity-selector.json`.

### Aim-base breadth phase isolation — declared

The promoted distilled proposer reopened the mature aim-base breadth question.
The first arm changes the exponent globally from 1 to 0.875 while retaining the
K=6 anchor at 250k. It is a mechanism experiment, not a candidate-count fit:
the arm measures whether fewer expensive local refinements reach the first
terminal earlier and convert the saved work into useful independent repairs.

If the global arm loses while exhibiting that mechanism, one and only one
phase-isolation follow-up is declared. It applies the same 0.875 law only while
`repairLaneActive` is true. Initial search and the ordinary resumed frontier
remain exactly exponent 1, so first-terminal work and the first incumbent must
be byte-identical. The repair arm asks whether probe savings themselves are
useful after removing the global arm's incumbent-quality confound.

Both arms use the frozen 4/8/16 multi-budget looks, paired source-budget-seed
cells, unchanged validity, and V3 repair mechanics. No canonical run follows a
negative scale result. The repair-only arm is not permission to tune another
exponent: 0.875 is inherited unchanged from the global bracket. The subsequent
anchor-allocation question is conditional on this result; a failed breadth arm
does not reopen already-rejected cheap/later restart selectors.

### Aim-base breadth global result — not promoted at N=16

The global 0.875 exponent produced the expected budget transfer but not a score
gain. At N=16 it reached the first terminal 7.9% earlier, increased post-first
terminal work 8.3%, repair episodes 5.7%, distinct terminal tracks 4.1%, and
accepted alternatives 5.5%. Repair gain per frame did not improve, however,
and the score arm finished -2.6907 with one lost valid cell. Every changed
budget was negative at the final look, including -1.5872 at 750k.

This closes the global law without promotion and activates the single declared
phase-isolation follow-up: retain exponent 1 for initial and resumed work and
apply the same 0.875 exponent only during repair. The complete result and
evidence hashes are recorded in
`benchmark/v2/studies/aim-topk-breadth-bracket.json`.

### Aim-base breadth repair-only result — neutral at N=16

Phase isolation behaved exactly as intended: first-terminal frames were
byte-identical, while the same repair spend produced 7.6% more repair episodes
and 4.3% more distinct terminal tracks. Those additional attempts were lower
yield. Accepted alternatives rose only 0.7%, internal repair gain fell 0.3%,
and gain per million frames rose only 0.1%.

The score result was +0.0444 overall with identical validity and -0.5118 at
750k. That is useful causal evidence but not a promotion: neither the global
nor repair-only fixed 0.875 exponent ships, and the bracket will not tune a
nearby exponent. The bottleneck is now attempt selection/yield rather than the
ability to manufacture more attempts.

### Post-breadth anchor allocation — declared revalidation

The breadth bracket proves that manufacturing more repair attempts is not
enough by itself. The next arm therefore revisits the already-implemented
`reserve-cheapest-else-deepest` allocator under the accepted distilled
proposal scorer. This is a stale-evidence revalidation, not a new algebraic
selector: its previous N=16 evidence predates the scorer that now ranks every
repair pool.

For the unchanged worst affordable target, the allocator reserves the minimum
upper-bound cost of one further currently affordable repair. It then chooses
the deepest parent whose own upper-bound cost plus that reserve fits. If no
second repair can fit, it uses the production deepest-affordable parent for the
last iteration. The reserve and anchor are recomputed independently from the
current best track after every terminal. There is no carried tried-anchor state
or fallback chain.

The previous arm reduced parent depth 17.1%, reduced mean attempt cost 8.9%,
increased episodes 11.2%, and increased accepted alternatives 9.2%, while
finishing score-neutral (-0.0342 overall, +0.2275 at 750k). The new 4/8/16
paired scale look asks whether the distilled scorer makes those extra accepted
alternatives valuable. First-terminal work, validity, breadth, target choice,
and the accepted proposal scorer remain fixed. A promotion still requires the
scale decision and then the canonical protocol; a neutral result closes this
stale-sweep licence without tuning the reserve.

### Post-breadth anchor allocation result — not promoted at N=16

The current scorer did not make the reserve allocator valuable. First-terminal
work remained exact and validity stayed 997/1,024 in both arms. The allocator
reduced mean parent depth 19.5% and mean attempt cost 10.3%, which produced
13.7% more repair episodes, 8.7% more distinct terminal tracks, and 12.8% more
accepted alternatives. Yet aggregate repair gain fell 1.2% and gain per
million repair frames fell 3.5%.

The score result was -0.0718 overall and -0.2907 at 750k. Six of eight budgets
were negative. This closes the stale-sweep licence and the generic
later-anchor/more-attempt family without promotion or reserve tuning. The next
repair family must improve the value of an attempt—suffix ordering or explicit
diversity—rather than merely produce more attempts.

### First-repair aimed-breadth investment — declared

The V3 iteration accounting shows a steep repair-value gradient: iteration
zero has historically returned 12.61 score points per million frames, versus
5.52, 4.06, 3.61, and 2.09 for iterations one through four. The two preceding
arms also show that saving work to manufacture additional late attempts does
not raise score. This arm tests the inverse allocation: add one aimed proposal
base only to repair iteration zero.

The intervention is a flat `+1`, not another budget exponent. Initial and
resumed work, generic candidate breadth, target and anchor selection, later
repair iterations, and the accepted scorer remain unchanged. The mature
low-air cap remains three, so the arm does not override that specialized
policy. Repair iteration is passed directly by the handoff loop; it is not
inferred from telemetry. The environment control defaults to zero and exists
only to freeze this arm through the scale runner.

The arm uses the frozen paired 4/8/16 multi-budget looks. Extension depends on
the declared scale decision, unchanged validity, and mechanics consistent with
the intervention. There is no adjacent increment tuning: `+1` is the only
declared arm. A successful scale result requires canonical confirmation before
promotion; otherwise production remains unchanged.

### First-repair aimed-breadth result — not promoted at N=16

The arm was neutral and slightly negative at the final look: -0.0256 scale
points, -0.0090 at 750k, and 38.28% directional probability, with identical
validity in all 1,024 paired cells. Sixteen-seed budget deltas alternated sign;
there is no coherent budget-response gain to promote.

The direct controller audit had zero invariant violations and confirms that the
mechanism ran as intended. First-terminal frames were byte-identical. Iteration
zero spent 1.23% more repair frames, accepted 2.15% more alternatives, and
produced 1.50% more internal score gain, but its gain per frame improved only
0.27%. That small return displaced 1.82% of iteration-one episodes; iteration
one's internal gain fell 6.17%. Across all repairs, accepted alternatives rose
4.52% while aggregate internal gain fell 0.43% and gain per frame fell 0.43%.

This closes the fixed first-repair `+1` arm without promotion or adjacent
increment tuning. The result also sharpens the next allocation requirement:
repair-register acceptance count is not a sufficient objective. A future
scheme must predict marginal authored-score value well enough to decide where
extra candidate work belongs, rather than assigning it solely from the average
historical return of an iteration index. Exact score, mechanics, audit, and
evidence hashes are recorded in
`benchmark/v2/studies/aim-first-repair-investment.json`.

### Late-repair generic breadth isolation — declared

The repair-wide 7/8 generic breadth arm manufactured 206 additional repair
episodes but lost 98.93 aggregate internal score points. Its retained iteration
audit locates the damage: iteration zero lost 151.36 points and iteration one
lost 83.73, while their reference returns were 11.97 and 6.34 points per
million frames. The return then drops sharply to 2.84, 2.09, and 2.82 for
iterations two through four.

This single phase-isolation arm inherits the already-tested 7/8 ratio but
applies it only at repair iteration two and later. Initial and resumed search,
repair iterations zero and one, breadth floors, target and anchor selection,
aim breadth, and scoring remain unchanged. Iteration index is passed directly
from the repair loop and reset with the compile; it is not reconstructed from
telemetry. Therefore work through the end of iteration one must be exact.

The arm uses the frozen paired 4/8/16 multi-budget looks and V3 iteration audit.
It asks whether cheaper low-return repairs create useful additional attempts
without paying the early-repair quality loss. The ratio and threshold will not
be tuned around the result. Promotion still requires the scale decision,
unchanged validity, the declared phase invariants, and canonical confirmation.

### Late-repair generic breadth result — useful, not promoted at N=16

The phase isolation stayed slightly positive at all three looks (+0.0930,
+0.0457, +0.0158), but the final 73.15% directional probability did not meet
the frozen promotion rule. The 750k delta was +0.0321 and validity remained
exactly 997/1,024. Budget deltas were mixed, from -0.0653 at 2.5M to +0.0779
at 4M, so the arm does not establish a broad authored-score improvement.

The mechanism is nevertheless real and correctly isolated. Iterations zero
and one were exact in episode count, terminal count, spent frames, accepts,
and internal gain. From iteration two onward, repair candidate samples fell
1.27%; the same total repair spend produced 4.48% more episodes, 4.58% more
reached terminals, 3.10% more distinct terminal tracks, and 2.86% more accepted
alternatives. Aggregate internal repair gain rose 0.30%, while terminal
improvements per million frames rose 1.63%. The controller audit reported zero
invariant violations in both arms.

This is substantially cleaner than repair-wide narrowing, but the authored
gain is too small to promote and the declared ratio/threshold will not be tuned.
The result establishes that late-repair breadth can be reduced without harming
the high-value early repairs; it also shows that manufacturing still more very
late alternatives has sharply diminishing authored value. Exact evidence is in
`benchmark/v2/studies/late-repair-breadth-isolation.json`.

### Late-repair anchor reserve — declared

The deferred question is whether a repair should restart earlier merely because
the longer suffix is affordable. The current-scorer all-repair reserve audit
provides a narrow phase hypothesis. Relative to production, its iterations zero
and one lost 67.11 aggregate internal score points. Its iteration-two-and-later
rows gained 8.34 points while replacing longer suffixes with more short repair
attempts. Those later rows inherit changed incumbents and therefore are an
association, not a causal result.

This arm isolates that hypothesis. Repair iterations zero and one use the
production `worst_gap_deepest_affordable` selection exactly. Beginning at
iteration two, the unchanged worst affordable target uses the already-audited
`worst_gap_reserve_cheapest_else_deepest` law: reserve the cheapest currently
affordable further repair, choose the deepest parent whose upper cost plus that
reserve fits, and use the production deepest parent only when no second repair
fits. The incumbent, target, costs, and reserve are recomputed after every
terminal. The effective underlying law is recorded in each V3 repair decision,
so the phase boundary is directly auditable.

Breadth, scorer, first-terminal search, repair budget, maximum parent depth,
and acceptance remain fixed. In particular, the arm is not combined with the
positive-but-inconclusive late 7/8 breadth result. The single inherited phase
boundary follows the observed return break after iteration one and will not be
tuned. The frozen 4/8/16 scale ladder decides whether to extend. Promotion
requires unchanged validity, exact iteration-zero/one mechanics, a positive
scale decision, and canonical confirmation.

### Late-repair anchor reserve result — useful, not promoted at N=16

The phase-isolated arm finished +0.0495 at N=4, -0.0087 at N=8, and
+0.0099 at N=16. Its final directional probability was 70.08%, the 750k
delta was +0.0314, and validity remained exactly 997/1,024. Budget deltas
were mixed: four positive and four negative, from -0.0584 at 4M to +0.1018
at 500k. The frozen decision is inconclusive, so the arm is not promoted.

The mechanism is implemented and isolated correctly. Iterations zero and one
are exact in episode count, terminal count, spent frames, accepted alternatives,
internal score gain, target, and anchor. At iteration two and later, the reserve
law increased attempts from 1,914 to 2,285 and accepted alternatives from 775
to 921 while holding late repair work effectively constant. Across the whole
panel, mean repair cost fell 8.08%, parent depth fell 11.90%, distinct terminal
tracks rose 6.22%, and accepted alternatives rose 8.36%. All decision and
attribution invariants replayed with zero violations.

Those extra alternatives added only 4.96 aggregate internal score points in
the late phase, a 1.20% increase, and whole-run authored score remained too
small to distinguish from noise. This closes the phase boundary and reserve
amount without tuning or combination with the late-breadth arm. The evidence
supports a general lesson: more short late repairs are real and cheap, but the
remaining bottleneck is the marginal authored value of the alternatives they
produce. Exact evidence and hashes are recorded in
`benchmark/v2/studies/late-repair-anchor-reserve.json`.

### Current-scorer improvement-gated suffix ordering — declared revalidation

The late breadth and late anchor arms both manufacture more terminal and
accepted alternatives without a material authored-score gain. The next arm
therefore changes the value of the first alternative explored inside a repair,
not the number or price of repair attempts.

`target-improvement-first` acts only when suffix search reaches the independently
selected target gap. If the ordinary first branch already lowers that gap's
exact incumbent authored-axis SSE, ordinary ordering is preserved. Otherwise,
if another already-selected ordinary top-three branch lowers the target SSE,
that branch is explored first. Candidate generation, evaluation, branch width,
anchor, budget ceiling, order at every other gap, and global terminal acceptance
remain unchanged. The boundary is parameter-free and the existing compile
statistics directly record its eligible pools, reorders, local SSE gain, and
forward-score debt.

The prior N=16 result under the pre-distillation proposal scorer was neutral:
+0.0037 scale, -0.0402 at 750k, unchanged validity, and 244 reorders among
5,904 target pools. It improved terminal-offer target quality but added only
5.48 aggregate internal points. That evidence is stale because the accepted
distilled next-impact scorer now ranks every repair proposal pool and may change
both ordinary branch zero and the eligible alternative. This is a single
current-scorer revalidation, not a reopened bracket: the retired ungated
top-three and eligible-pool policies remain closed.

The arm uses the frozen 4/8/16 scale ladder with trace telemetry. A promotion
requires unchanged validity, a material governed scale decision, mechanics
consistent with the declared gate, and canonical confirmation. An inconclusive
result closes this policy under the current scorer without changing the gate,
widening the pool, or combining it with breadth or anchor interventions.

### Current-scorer improvement-gated suffix ordering result — retired

The current-scorer revalidation stayed practically flat at every look: +0.0067
at N=4, +0.0049 at N=8, and +0.0032 at N=16. Final directional probability
was 56.68%, the 750k slice was -0.0162, all eight budget effects straddled a
narrow mixed range, and validity remained exactly 997/1,024. The arm is not
promoted and the gated local-SSE policy is closed without tuning.

The mechanism worked exactly as declared. First-terminal frames were identical.
Across N=16 it observed 5,765 target pools and reordered 225 first branches,
about 5.5% on a per-run rate basis. Terminal offers improved the selected gap
5.51 percentage points more often. But repair acceptance rose only 0.34%,
aggregate internal repair gain rose 0.0065%, and gain per frame fell 0.80%.
Local target SSE is therefore a valid explanatory signal but not a sufficient
proxy for marginal global authored value. The accepted distilled scorer does
not change that conclusion.

Future attempt-value work should predict the global downstream value or basin
of an alternative, rather than strengthen the selected gap in isolation. Exact
evidence and hashes are recorded in
`benchmark/v2/studies/current-scorer-target-improvement-first.json`.

### Distilled-impact top-choice resolution — declared

The accepted proposal controller is the only recent intervention with a large
authored-score effect. Its 32-tree distillation outperformed the exact 200-tree
teacher despite approximating that teacher with held-out MAE 0.03894. Better
teacher imitation is therefore not the objective; the remaining question is
whether impact-driven proposal changes smaller than the compact model's own
validated resolution are useful or merely ranking churn.

The single `validated-mae-top1` arm keeps the production scorer unless the
impact-aware and ordinary objectives choose different top knob vectors and the
active top vector's modeled impact-feasibility advantage is no larger than the
artifact's held-out MAE. Only in that case does the grid retain ordinary order.
There is no fitted threshold: the boundary is read from the shipped model
artifact. Probe grid, ordinary admission set, proposal count, exact candidate
evaluation, generic breadth, tree branching, repair policy, and authored
targets remain unchanged.

The frozen 4/8/16 multi-budget ladder applies. Telemetry must report eligible
top-choice changes, their mean modeled advantage, and suppressed changes. An
inconclusive result closes this exact resolution boundary without threshold
tuning or combination with breadth or repair allocation.

### Distilled-impact top-choice resolution result — retired

The artifact-MAE gate lost coherently at every governed look: -6.0491 at N=4,
-4.7337 at N=8, and -3.5261 at N=16. Final directional probability was 7.72%,
the 750k slice was -1.2420, and validity fell from 997 to 989 cells (7 gained,
15 lost). Six budgets from 250k through 1.5M were negative; the +0.4009 and
+0.1424 readings at 2.5M and 4M were small and isolated.

The gate was active, not inert: across 1,024 runs it observed 2,791,131
impact-versus-ordinary top-choice changes and suppressed 989,162 (35.44%). The
changed choices had mean modeled impact advantage 0.1221 when weighted by
eligible decisions. Aggregate repair acceptance and internal repair gain rose
slightly, but first-terminal work changed, capability validity regressed, and
authored score fell. Pointwise teacher-approximation MAE is therefore not a
valid decision boundary for pairwise proposal ranking. The accepted compact
scorer's useful behavior includes choices below that numerical boundary.

The arm is retired without threshold tuning, and production remains the
ungated distilled impact scorer. Exact governed evidence and hashes are in
`benchmark/v2/studies/aim-impact-resolution-gate.json`.

### Anchor-protected repair candidate breadth — declared

The independent repair controller makes candidate breadth a spatial allocation
question, not only a scalar count. Prior repair-wide 3/4 narrowing reduced
actual candidate samples 10.65%, mean episode cost 11.65%, and produced 11.53%
more repair episodes, but accepted alternatives rose only 2.09% and aggregate
internal repair gain fell 2.85%. Later 7/8 narrowing under the accepted scorer
likewise produced 5.37% more episodes while losing 2.00% of aggregate internal
gain. Both arms narrowed the selected anchor pool together with the suffix.

The single `repair-descendants-three-quarter` arm tests whether that scope
removed quality at the wrong place. Initial search and resumed ordinary work
remain production-exact. Inside each repair episode, the selected anchor node
also retains full production nCand. Only pools strictly after that anchor use
the already-measured 3/4 ratio, applied after the ordinary target-profile
floors. This protects the alternative-defining branch—historically 95% of
divergent repair terminals first diverge at the selected anchor—while making
the work that carries the branch to the terminal cheaper. Target and anchor
selection, restart seed, aim refinement breadth, ranking, branch width, episode
ceiling, acceptance, and authored targets are unchanged.

This is a mechanism-defined scope test, not a new ratio bracket. The 3/4 ratio
is inherited from the arm that demonstrated the stronger throughput transfer;
no adjacent ratio or protected-depth tuning follows from the result. The frozen
4/8/16 multi-budget ladder and trace telemetry apply. V3 atomic-node records
must prove exact first-terminal work, exact anchor requested width, narrower
descendant width, and correct episode attribution. Score interpretation must
also report terminal-returning episodes, anchor divergence, accepted
alternatives, internal repair gain per frame, final-output lineage, validity,
and per-budget authored score. A favorable scale decision still requires
canonical confirmation before promotion.

### Anchor-protected repair candidate breadth — useful, not promoted

The governed ladder finished positive at every look (+0.1294 at N=4, +0.0401
at N=8, and +0.0483 at N=16), but the final directional probability was only
60.55%. The 750k slice was +0.2229 and validity remained exactly 997/1,024.
Budget effects were mixed, from -0.6597 at 250k to +0.7282 at 2.5M, so the
small positive aggregate is not sufficient for promotion or canonical work.

The spatial mechanism was exact. All 1,024 candidate rows carried traces;
4,153 repair episodes had 4,153 full-width anchor pools and 63,616 narrowed
descendant pools. Every one of 906 eligible rows used the exact 3/4 descendant
width, with no closure, scope, or nonconstant-width violation. First-terminal
work was byte-identical. Repair samples fell 10.77%, mean episode cost fell
8.60%, and the same total repair spend produced 8.18% more episodes and 7.42%
more terminal returns.

Protecting only the anchor did not preserve enough early-repair value. Repair
iteration zero selected the same target and anchor in the two arms, yet
accepted alternatives fell from 559 to 520 and internal gain fell from
3,357.50 to 3,260.38 when the descendants narrowed. Across all iterations,
accepted alternatives rose only 1.14%, internal repair gain fell 0.78%, and
gain per repair frame fell 4.54%. The extra late terminals recovered count,
not value.

The arm is therefore useful mechanism evidence but is not promoted. The 3/4
ratio and protected-anchor boundary are closed without adjacent tuning. One
follow-up remains distinct: an accepted narrowed suffix feeds its cheaper
observed cost back into future affordability, and mean parent depth rose 3.84%
as a result. That feedback must be isolated before interpreting breadth purely
as an attempt-throughput intervention. Exact decisions, audits, and evidence
hashes are recorded in
`benchmark/v2/studies/anchor-protected-repair-breadth.json`.

### Worst-target window-per-cost anchor — declared

The closed breadth arm confirms that cheaper suffix execution can be converted
into both more repairs and earlier anchors. It also confirms that attempt count
alone is not the objective. The next arm isolates the deferred question of
whether repair should restart earlier merely because that longer suffix fits.

The `worst-target-window-per-cost` policy retains production target selection:
choose the largest authored axis-error SSE among gaps having an affordable
anchor. It retains the same estimator upper bound, zero added headroom,
depth-six cap, and one-terminal execution. Only the parent choice changes. For
that same target, each affordable anchor is assigned the sum of authored
axis-error SSE from the anchor through the target, divided by the anchor's
estimated point cost. The highest density wins; ties prefer larger absolute
opportunity and then greater parent depth. This uses direct incumbent error
only. Unlike the retired runway policy, it adds no synthetic opportunity per
parent transition; unlike the retired local-window policy, it never changes
the target gap.

Offline replay supplies scope, not causal evidence. The policy would move
1,100/3,839 production decisions later. The executed current-policy episodes
in that subset had 51.28% acceptance per terminal and 10.24 internal-score
points per million repair frames, versus 43.80% and 7.17 where the anchor would
stay. This association is strong enough for one live test but cannot predict
the alternative suffix produced by a later anchor.

The arm has no fitted threshold, reserve, exponent, or adjacent variant. It is
evaluated alone against production breadth through the frozen 4/8/16 scale
ladder. Required evidence is exact first-terminal work and validity; replayed
target, anchor, affordability, and cost-density decisions; repair spend,
terminal and acceptance yield; internal gain; final-output lineage; and
per-budget authored score. Only an accepted scale result can proceed to the
canonical 750k qualification.

### Worst-target window-per-cost anchor — rejected at N=16

The live arm lost coherently at every governed look: -0.2289 at N=4, -0.2167
at N=8, and -0.1969 at N=16. The final directional probability was 0.0735%,
with a central 95% interval [-0.3050, -0.0888]. The 750k slice was -0.0679,
validity remained exactly 997/1,024, and six of eight budget deltas were
negative.

The mechanism was active and trustworthy. All repair invariants replayed with
zero violations across 3,839 reference and 4,906 candidate episodes.
First-terminal work was exact. The candidate moved anchors later (mean parent
depth -30.82%), reduced mean repair cost 11.99%, and converted effectively the
same total repair spend into 27.85% more terminal alternatives and 11.62% more
accepted alternatives.

More accepted alternatives were not more authored value. Aggregate internal
repair gain fell from 4,953.50 to 4,700.42 (-5.11%), and gain per repair frame
fell 15.27%. Direct anchor-to-target authored SSE per estimated cost therefore
does not identify when the production parent runway can be removed. The law is
rejected without threshold, reserve, or neighboring-formula tuning. Production
remains `worst_gap_deepest_affordable`; the next family must improve the value
of the suffix generated from that anchor rather than manufacture still more
short alternatives. Exact evidence and hashes are in
`benchmark/v2/studies/worst-target-window-per-cost-anchor.json`.

### Stable-planning descendant breadth — declared

There is no separate global-score-gradient target to test. On a completed
valid track, `axis_quality = exp(-sqrt(total_axis_sse / axis_count) / 0.25)`;
the observation set is fixed, so ranking gaps by their axis SSE is exactly the
same as ranking their optimistic marginal contribution to the authored axis
score. The scale panel's terminal tracks also have unit drift, missing,
off-beat, and survival factors. A differently named global-gradient selector
would therefore replay the production target order rather than test a new
mechanism.

The remaining candidate-breadth confound is real and occurs after the first
repair. `repair-descendants-three-quarter` selected the same first target and
anchor as production. Once a narrower accepted suffix supplied a cheaper
measured path, however, mean parent depth moved from 4.22 to 4.62 on iteration
one, 2.81 to 3.11 on iteration two, and 1.36 to 1.86 on iteration three. The
arm consequently spent part of its saving on longer subsequent suffixes rather
than on additional comparable repair attempts.

The single `repair-descendants-three-quarter-stable-planning` arm keeps the
previous arm's exact spatial breadth rule: production width in initial and
resumed search, production width at every selected repair anchor, and 3/4
width only at strict repair descendants. Its only additional rule is that
repair affordability and the local upper ceiling continue to use the measured
cost-to-end profile of the initial full-breadth terminal. Real simulation work
is still charged, observed, and used for budget remaining and estimator
diagnostics; nothing is refunded or synthetically rescaled. Target ranking,
depth-six option set, restart seeds, DFS, register acceptance, and authored
targets remain unchanged.

This is an isolation experiment, not a new estimator proposal. The frozen
4/8/16 scale ladder applies. Required evidence is exact first-terminal work and
first-repair target/anchor identity; exact anchor/descendant breadth scope;
later parent depth and ceiling utilization; actual repair frames, terminal and
accepted alternatives, internal gain per frame, final-output lineage,
validity, and per-budget authored score. The result closes this exact feedback
separation without ratio or cost-profile tuning.

### Stable-planning descendant breadth — useful control, not promoted

The governed ladder was +0.0540 at N=4, -0.0200 at N=8, and +0.0134 at N=16.
Final directional probability was 52.83%, the central 95% interval was
[-0.3826, +0.4094], validity stayed exactly 997/1,024, and the 750k slice was
+0.2015. Effects were mixed across budgets, including -0.5633 at 250k and
+0.4636 at 2.5M. The arm is not promotable.

The causal question is answered. First-terminal work was exact, and the first
repair was exactly identical to the prior dynamic-planning breadth arm: 989
episodes, 981 terminal returns, 520 accepted alternatives, mean parent depth
5.2447, and 3,260.38 aggregate internal gain. Thereafter the retained planning
profile moved work later. Across N=16, the same repair spend bought 4,673
episodes and 4,650 terminal returns versus 4,153 and 4,084 under dynamic
planning, while accepted alternatives rose from 1,767 to 1,973.

This is the candidate-breadth behavior originally expected: relative to
production, repair candidate samples fell 11.15%, mean repair cost fell 19.90%,
episodes rose 21.72%, terminal returns rose 22.30%, and accepted alternatives
rose 12.94%. The saving did not disappear into longer anchors once planning
feedback was held fixed.

The extra repairs were lower-value. Aggregate repair gain fell 1.52% versus
production and 0.75% versus dynamic planning. The stable profile also made the
completion estimate deliberately stale: absolute error rose 70.0% and interval
coverage fell 14.4%. It is therefore a causal control, not a viable production
controller. The feedback confound is closed without tuning.

The next breadth family protects a semantic region rather than a numeric depth:
the selected anchor through the selected target remains at production breadth,
and only post-target carry work is narrowed. This asks whether savings after
the alternative-defining transition retain more value. Exact decisions and
hashes are in `benchmark/v2/studies/stable-planning-repair-breadth.json`.

### Post-target repair candidate breadth — declared

The descendant-breadth controls locate the quality loss more precisely. Full
breadth at the anchor alone does not preserve first-repair value, while holding
later planning fixed proves that the released compute really can buy many more
terminal and accepted alternatives. The missing boundary is the transition the
repair explicitly selected because it is the incumbent's worst affordable
authored gap.

The single `repair-post-target-three-quarter` arm therefore keeps production
breadth at the selected anchor, every intervening descendant, and the selected
target pool. Only pools strictly after the target use the inherited 3/4 ratio.
This preserves the entire alternative-defining anchor-to-target window and
reduces only the work that carries that decision to a complete terminal track.
When target and anchor coincide, all strict descendants are post-target by
definition. Initial search, resumed work, dynamic measured-cost feedback,
target/anchor selection, restart seed, branch width, DFS, episode ceiling,
register acceptance, and authored targets remain production-exact.

This is a semantic boundary test, not a protected-depth or ratio bracket. The
ratio is inherited from the completed throughput controls, and no adjacent
ratio follows from the result. Compact trace evidence now separates repair pool
builds into anchor, pre-target descendant, target, and post-target buckets while
also retaining the aggregate descendant total. The frozen 4/8/16 ladder must
show exact first-terminal work and validity; correct spatial breadth; repair
samples, attempts, terminals, accepted alternatives, spend, internal gain per
frame, target improvement, final-output lineage, and per-budget authored score.
Only an accepted scale result proceeds to canonical confirmation.

### Post-target repair candidate breadth — useful boundary, not promoted

The governed ladder was -0.1443 at N=4, -0.1362 at N=8, and -0.0592 at
N=16. Final directional probability was 30.23%, the central 95% interval was
[-0.2978, +0.1794], validity stayed exactly 997/1,024, and the 750k slice was
+0.0525. Budget effects remained mixed: -0.7214 at 250k, +0.2659 at 500k,
-0.3583 at 1.5M, and +0.3556 at 2.5M. The arm is not promotable.

The semantic boundary was exact. All 862 eligible pre-target rows and all 834
eligible target rows retained production width; all 850 eligible post-target
rows used the inherited 3/4 width; 4,007 repair episodes had zero anchor
closure violations. The comparison audit is now phase-explicit under mechanics
schema V9. It no longer treats the deliberately mixed descendant region as a
single constant-width lane.

Post-target breadth was not disposable carry overhead. On the identical first
repair decisions, narrowing only that region saved 9.02% of frames but reduced
accepted alternatives from 559 to 526 and aggregate internal gain by 5.21%.
Across N=16, the saving bought 168 extra repair episodes and 139 extra terminal
alternatives, but only 15 extra accepted alternatives; total repair gain fell
2.23% at effectively identical spend. Completion-estimate absolute error also
rose 63.9%, because observed suffix costs changed beneath the dynamic planner.

This closes fixed-ratio repair breadth reduction across global, late,
anchor-protected, stable-planning, and post-target scopes. Another ratio,
protected depth, or affordability-feedback variant is not licensed by the
evidence. The next family must improve the value of candidate evaluation or
suffix choice without discarding the breadth that produces valuable completed
alternatives. Exact decisions, behavior, spatial audit, and evidence hashes are
in `benchmark/v2/studies/post-target-repair-breadth.json`.

### Last-chance repair breadth — accepted and promoted

The closed breadth studies all replaced an affordable full-width suffix and
lost value. They did not test the dominated residue after the full-width
selector returns no affordable repair. At that point production leaves repair
and resumes the old frontier. In the frozen reference, resumed work at 750k
spent 15,101 mean frames per compile but produced only 8 terminal register
improvements across 128 runs.

The candidate retained every ordinary repair at full production breadth. Only
after no full-width repair fit, it priced one final suffix at 90% of the
measured upper cost and ran it at the inherited 3/4 breadth. The 90% price is a
conservative policy assumption relative to the previously measured 11.65%
mean episode-cost saving; it is not a fitted estimator. Repair stops after this
suffix so its different-width cost profile cannot influence another decision.
Initial search, targets, register acceptance, and explicit historical breadth
studies remain unchanged.

The N=8 scale look preferred the candidate: 579.5092 to 579.5099, delta
+0.0007, 99.50% directional probability against a 99.17% boundary, central
95% interval [+0.0002, +0.0012], and unchanged 497/512 validity. All eight
budget point estimates were nonnegative. The mechanism audit replayed 1,928
ordinary repair episodes with zero mismatches and zero invariant violations.
It added 58 last-chance suffixes; all reached a terminal, 28 were accepted, and
they used 336,846 frames for 0.2774 aggregate internal-score gain.

Canonical qualification accepted at N=32: 605.9765 to 605.9793, delta
+0.0028, SE 0.0008, 99.93% directional probability against the 98.88%
boundary, 99% central interval [+0.0006, +0.0050], one-sided 99% lower bound
+0.0008, and unchanged 1,408/1,408 validity. No canonical case had a negative
point estimate; 30 had a positive one and 14 were exact at report precision.

This is a real but intentionally tiny improvement. It validates a useful
principle: preserve full candidate breadth whenever it fits, and narrow only
to convert otherwise-low-yield residue into a complete alternative. It does
not materially close the headline target gap. The new campaign baseline is
`last-chance-repair-breadth`; full evidence and hashes are recorded in
`benchmark/v2/studies/last-chance-repair-breadth-promotion.json`.

### Regularized distilled-impact boundary — declared

Proposal selection remains the only recent compiler seam with a large score
effect. Against the old frozen scale reference, the exact 200-tree impact
teacher gained 4.3747 points at N=8, while the 32-tree missing-articulation
distillation gained 8.3448. This directly shows that teacher fidelity is not
the compiler objective: the compact model's regularization is part of its
useful policy.

The single follow-up is the pre-existing `hist_16` boundary from the same
frozen offline distillation study. It uses the identical corpus, feature
transform, missing-articulation contract, target, learning rate, leaf count,
minimum leaf population, and L2 penalty as production `hist_32`; only boosting
iterations change from 32 to 16. Held-out teacher imitation is deliberately
worse (MAE 0.06503 versus 0.03894), so this is a causal regularization test,
not a claim that the surrogate is more accurate.

Probe geometry, ordinary admission, emitted proposal count, exact candidate
evaluation, generic candidate breadth, DFS, repair selection, last-chance
repair, register acceptance, and authored targets remain unchanged. The
artifact has exact Python/TypeScript export parity. The frozen 4/8/16
multi-budget ladder decides the arm; a non-favorable result closes this
boundary without trying 8, 24, or other tree counts.

### Regularized distilled-impact boundary — not promoted

The four-seed signal was attractive but did not reproduce. Scale moved +1.9109
at N=4, then -0.8015 at N=8 and -0.8938 at N=16. Final directional probability
was 14.47%, the central 95% interval was [-2.6281, +0.8405], and validity fell
from 997 to 993 cells (8 gained, 12 lost). The 750k slice was -2.0860. Only
150k (+2.8894) and 1M (+0.2706) were positive at the final look; six of eight
budgets were negative.

The intervention was active and correctly isolated. It reduced
impact-versus-ordinary top-choice changes by 20.26%, while actual candidate
samples changed only -0.017%. Its aimed proposals were 3.75% less likely to
rank first in the exact pool, 2.47% less likely to rank in the top three, and
their mean exact-pool rank worsened 1.39%. First terminal work fell 0.76%, but
repair acceptance fell 2.23%. Aggregate internal repair gain rose 9.41%; that
association did not translate into authored score or validity.

Production keeps the 32-tree distilled model. The 16-tree boundary is closed
without intermediate tree-count tuning. Its live compiler mode and serialized
study artifact were removed after evaluation; the offline exporter retains
`--selected=hist_16` so the frozen evidence remains reproducible without
adding a dead production branch. Full decisions, mechanics, and hashes are in
`benchmark/v2/studies/aim-impact-regularization-boundary.json`.

### Balanced fixed-count aim proposals — declared

The regularization boundary changed millions of impact-aware grid ranks but
saved essentially no candidate work, and its worse exact-pool placement tracked
the authored-score loss. The production controller still spends both of its
fixed proposal slots from one scalar impact-aware order. Fresh N=16 telemetry
shows that its selected pair can lie deep in the ordinary current/outgoing
order: in a representative compile, both active choices were within the first
four ordinary choices in only 109 of 184 scored grids, while the mean maximum
ordinary rank was 38.

The next arm changes no breadth. It retains two proposals, the same probe grid,
the same distilled impact model, the same ordinary admission set, and the same
exact evaluator. One priority is the impact-aware top choice and the other is
the ordinary current/outgoing top choice; when the objectives agree, or their
vectors fail the existing distinctness rule, the unchanged impact-aware order
fills the remaining slot. This asks whether the two signals are complementary
at fixed cost rather than tuning another exponent or model size.

The frozen 4/8/16 scale ladder applies. Required evidence includes candidate
samples, probe work, impact-driven top-choice changes, exact aimed-pool rank,
final aimed selection, first-terminal work, repair behavior, validity, and
per-budget authored score. A non-favorable result closes this fixed-count
two-signal allocation without trying weighted slot schedules.

### Balanced fixed-count aim proposals — behaviorally inert, closed

The N=4 look was byte-exact across all 256 source/budget/seed cells: scale
headline 578.6064 in both arms, 247/256 valid in both, zero changed tracks, and
zero movement at every budget from 150k through 4M. The equivalence extends to
the mechanics: candidate samples, admitted aim proposals, exact pool entries,
first-terminal frames, repair episodes, and terminal evaluations were all
identical in every aggregate comparison.

The existing geometric distinctness filter explains the result. Whenever the
ordinary top choice was inserted after the impact-aware top choice, it was
either already in the active order or was too close to consume a separate
proposal slot; the unchanged active order filled the slot. This is stronger
than an inconclusive score result: the arm generated the same work and paths on
a broad 256-cell deterministic panel. Extending identical work to N=8 would
add no useful evidence, so the study branch was removed and production keeps
the singular impact-ranked implementation. The retained comparison is
`generated/benchmark-v2/scale/aim-impact-balanced-slots-4.comparison.json`.

### Repair sampling-to-proposal reallocation — declared

The current distilled scorer changes which model proposals are valuable, but
does not change the closed breadth fact: the inherited repair-wide 7/8 arm
saved 919.7 sampled candidates per compile and created 5.37% more repair
episodes at N=16, while losing 0.0822 scale points because aggregate repair
value fell. The separate emitted-proposal evidence predates both the distilled
impact objective and the independent repair mechanism. Its documented open
boundary is a third proposal when budget economics move.

This arm composes those two already-bounded axes rather than tuning either.
Initial and resumed search retain full production sample breadth and two model
proposals, so first-terminal work must be byte-identical. Every ordinary repair
pool uses the inherited 7/8 sample width and allows one third geometrically
distinct proposal from the unchanged impact-aware order. Probe count, aim-base
breadth, knob grid, model, proposal admission, exact evaluation, target/anchor
selection, suffix DFS, register acceptance, last-chance fallback, and authored
targets remain unchanged.

The question is whether model-directed breadth can replace part of random
repair breadth while retaining the extra terminal opportunities. This is not
licensed to adjust 7/8, proposal count three, or their phase. The frozen 4/8/16
scale ladder decides it. Evidence must separate initial and repair samples,
aim emissions and exact pool rank, first-terminal identity, repair episodes,
terminal and accepted alternatives, repair gain and gain per frame, final aim
lineage, validity, and per-budget authored score.

### Repair sampling-to-proposal reallocation — useful, not promoted

The result remained slightly positive but did not clear the decision boundary.
Scale moved +0.4137 at N=4, +0.0531 at N=8, and +0.0846 at N=16. Final
directional probability was 76.62%, the central 95% interval was
[-0.1574, +0.3266], and validity stayed exactly 997/1,024. Budget effects were
mixed: +0.4762 at 500k and +0.3769 at 2.5M, but -0.1665 at 750k and -0.5137
at 1.5M. No canonical promotion follows.

The mechanism was correctly isolated and genuinely reallocated work.
First-terminal frames were byte-identical and the controller audit reported
zero invariant violations. Candidate samples fell 4.79%, while admitted model
proposals rose 22.03%. Those extra proposals were weaker individually—their
exact-pool top-three rate fell 8.13% and mean rank worsened 12.77%—but final
tracks contained 1.65% more aimed fits.

This improved repair value density without creating more repairs. At nearly
identical repair spend, episodes fell from 3,945 to 3,722 and accepted
alternatives from 1,794 to 1,728, while aggregate internal gain rose from
4,954.12 to 5,034.86 and gain per million frames from 7.918 to 8.057. The
quality-over-quantity trade is real, but too small and budget-inconsistent in
authored score. Production keeps two proposals and full ordinary repair
breadth. The branch is removed without tuning the ratio, proposal count, or
phase; full evidence is in
`benchmark/v2/studies/repair-sampling-to-aim-reallocation.json`.

### Full-breadth third repair proposal — declared

The reallocation arm leaves one causal ambiguity. It improved repair internal
gain by 1.63% and gain per frame by 1.76%, but it simultaneously replaced 1/8
of random repair samples with a third fitted-grid proposal. The final authored
result was weakly positive. The natural isolation is to retain full production
sample breadth and add only the third proposal during independent repair.

Initial and resumed search still use two proposals and production breadth;
first-terminal work must be byte-identical. Repair uses production sample
breadth, aim-base breadth, probes, distilled model, impact-aware order,
geometric distinctness, exact admission, target/anchor selection, DFS, register
acceptance, and authored targets. The only change is allowing the unchanged
distinctness filter to take a third fitted-grid choice per refined repair base.

This is not an adjacent proposal-count sweep: three is inherited from the
completed reallocation and the historical 1/2/3 boundary. The frozen 4/8/16
multi-budget ladder decides it. The same phase, aim-yield, repair-value,
validity, and authored-score evidence is required; no favorable-looking source
or budget gate may be added afterward.

### Full-breadth third repair proposal — not promoted

The third proposal remained inconclusive and budget-inconsistent. The governed
looks were +0.0140 at N=4, -0.2338 at N=8, and +0.1086 at N=16. The final
directional probability was 73.40%, the central 95% interval was
[-0.2533, +0.4705], and validity remained exactly 997/1,024. The 750k slice
was a credible +1.0662, but 250k was -0.6483 and 1.5M was -0.4133; a favorable
single budget does not override the declared across-budget decision.

The intervention was active and correctly isolated. First-terminal frames were
exact, the controller audit found zero violations, admitted fitted proposals
rose 18.84%, and final tracks contained 1.45% more aimed fits. The extra
proposal nevertheless consumed exact-evaluation budget: total candidate
samples fell 2.59%, exact-pool top-three rate fell 8.12%, and mean exact-pool
rank worsened 13.80%.

Repair spent essentially the same total frames but made each attempt 8.55%
more expensive. Episodes fell from 3,945 to 3,616, terminal alternatives from
3,908 to 3,559, and accepted alternatives from 1,794 to 1,713. Completion
estimate absolute error rose 62.23%; distinct terminal tracks fell 4.77%.
Aggregate internal gain rose 1.98% and gain per million repair frames rose
2.04%, but that quality gain was too small to recover the lost attempt
opportunities reliably in authored score.

Production therefore retains two proposals and full ordinary repair breadth.
The repair-only proposal-count branch and its test were removed after the exact
compiler snapshot and N=16 evidence were archived. This closes generic extra
proposal count and random-sample-to-proposal reallocation; the next proposal
family must improve the ranking target or information content of the existing
fixed slots rather than add another fitted-grid choice.
