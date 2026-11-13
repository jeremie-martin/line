# Foundations rework (started 2026-10-03)

## November 13 (late): hypothesis, the search weighs each span by its length, as the grade does (stated before running)

- **Basis** (found by a review agent, checked): the grade weighs a span's air, speed and amplitude errors by its length
  and each beat's strength by one over the beat count. The interval search adds each span's errors at weight 1 whatever
  its length (`arc_evaluate.ts`, `arc_boundary.ts`), while terminal selection (`arc_objective.ts`) already weighs by
  length. Relative to the grade, the search over-weights short spans' air and speed against strength (2.5× for an
  8-frame span in a ride averaging 20) and under-weights long floats.
- **Change** (`exp/gap-length-weights`): span terms, the boundary correction and the remembered-response units carry
  length · beats / total span length, the grade's own ratio. Nothing else.
- **Hypothesis:** dense strong passages trade a little air and speed for strength; long spans gain air and speed. V8 up,
  mostly G and the dense categories; strength on strong asks up; air or speed rms may rise slightly on short spans.
  Measure: V8, 4 seeds, paired against `compiler`; then V7.1 and held out if positive.

## November 13 (late): compare review shows whole rides and a geometry sheet

The owner could not judge the few-second before/after passages: two compiler versions build entirely different tracks,
so there is no single moment to compare. `npm run compare -- review` now writes:
- the whole rides of a few songs (one per song among those that moved most, `--rides=4`, or `--cases`), both versions in
  one player that switches between them at the same moment;
- `geometry.html`, a still sheet of more rides (one per spec, `--sheet=8`) cut into 10-second windows, before left and
  after right at one scale: lines black, rail guides blue, the sled's path grey, beats red (bigger = stronger ask), and
  the phrases' constructions under each panel.
V8 rides are left out (their specs are time-warped away from the recordings): review on V7.1. `passages.ts` and the
side-by-side composition went with the old review.

## November 13 (night): strong phrases are offered guides (adopted); why the search keeps strong catches soft

**Why** (`loss_attribution.ts --suite=v8`, seed 101, 2,520 catches before a strong ask):
- The arrival prior asks for √(v² + Δv²) before a strong catch, enough to hit and leave at the authored speed. The kept
  arrival averages 11.1 px/frame against 12.3 asked; 57% arrive more than 1 px/frame short.
- In 71% of those intervals the pool held an arrival fast enough. Against the kept move, the fastest-enough alternative
  costs, on average, +0.17 in this catch's squared strength residual, +0.06 in the other preferences, +0.02 air,
  +0.003 speed. Keeping speed for the next strong hit means hitting softer now: consecutive strong catches share one
  energy budget, and only descent refills it. The weight sweep agrees: the search sits at its optimum.

**Where the families differ** (strong asks on V8, complete rides; within a context the family is drawn by the seed):

| family | strong catches | short of the ask | speed residual after |
|---|---|---|---|
| open arcs (guide forbidden) | 3,264 | 0.147 | −0.054 |
| arcs offered a guide | 1,382 | 0.101 | −0.029 |
| scattered | 1,173 | 0.111 | −0.029 |
| terraces | 1,230 | 0.123 | −0.040 |
| scallops | 979 | 0.124 | −0.037 |
| serpentine | 1,139 | 0.131 | −0.050 |
| fold | 913 | 0.159 | −0.066 |

The planner forbids the guide in about a third of every loud phrase (weight 1 − 11/17), whatever the asks.

**Hypothesis** (`exp/guides-on-strong-phrases`, `intentional_repertoire.ts`). In a strong phrase, the open arcs' share
becomes arcs offered a guide, phased in over the phrase's mean ask from 0.4 (none) to 0.8 (all). Other families and quiet
or middle phrases are unchanged. Strength and speed up on strong asks; V8 up, mostly G. **Cost to watch:** fewer open arcs
in intense passages (variety), more guide lines drawn, upper contact and body drag. Measure: V8 then V7.1, 4 seeds,
paired against `compiler`; geometry mix and ride character.

**Result: adopted.**

| panel | change | interval | specs up / down |
|---|---|---|---|
| V8, 8 seeds | **+7.7** | [+4.1, +11.3], support > 0.99 | 40 / 3 |
| V7.1, 8 seeds | **+4.0** | [+0.4, +7.7], support 0.98 | 31 / 4 |
| held out (4 songs, 4 seeds) | **+13.9** | [−7.4, +35.1], support 0.94 | 4 / 0 |

- V8 by category (8 seeds): G +16.0, P1 +8.3, P2 +1.1, P3 +5.3, P4 +8.6, P5 +7.1, P6 +11.1, P7 +4.2; explicit +3.8.
  V7.1: G +12.6, P6 −5.3 (its single long ride), explicit +4.9. No ride lost anywhere; physics unchanged.
- **Where the points come from** (V8, 4 seeds): strong asks too soft +6.2, speed +1.0, air +0.9, extra hits +0.5.
- **Costs and guards:** body drag +13% on V8, +16% on V7.1, +10% held out (an eye proxy, reported, not a veto);
  strong extra impacts 0.19 against 0.16 per 100 beats on V8, 0.14 against 0.12 on V7.1, 0.07 against 0 held out;
  strong arrivals head-down or backward −12% on V8, −5% on V7.1, −16% held out.
- **Ride character** (V8, 196 rides paired): strong beats hit from above +3.2 points [2.1, 4.3] (the archive version
  was +2.3 over today), all beats +2.3; guide contact +1.7 s/min; air −1.2 points; body contact +1.2 s/min.
- **Variety:** open arcs 35% → 25% of ride time, arcs offered a guide 13% → 23%; other families unchanged; distinct
  families per ride 5.88 → 5.76. Open arcs now come in middle and quiet passages only.
- Parity references refreshed: 13 of 25 cells change (their plans change). For the owner's eye: fewer open arcs in
  intense passages, more upper hits.
- **Not run:** giving the folds' share of strong phrases to guided arcs too (folds are worst on strong asks: 0.159
  short). It removes folds from energetic passages, which `intentional_repertoire.test.ts` forbids by design (no
  expressive choice eliminated by context). Open arcs are kept as a family; only their share in strong phrases moved.

## November 13 (night): hypothesis, the search weights after the archive's removal (stated before running)

- **Basis.** `impactWeight` 1, `valueWeight` 0.45 and `arrivalWeight` 0.3 (`connected_arcs.ts`) were set with the 52 MB
  archive's proposals. The compact sources propose differently (weaker strong catches), and no weight was checked since.
- **Arms** (one line each, `exp/w-*`): impact weight 1.5; value weight 0.3 and 0.6; arrival weight 0.45.
- **Hypothesis.** At most one of them moves V8 by more than seed noise; a stronger impact weight trades speed for strength.
- **Decision rule.** A weight changes only for a gain of about +3 or more whose interval excludes zero on V8, no loss on
  V7.1, and no guard worse; otherwise the archive-era values stay.
- **Result: none changes** (V8, 4 seeds, paired against `compiler`):

  | arm | V8 | interval | specs up / down | note |
  |---|---|---|---|---|
  | impact weight 1.5 | −2.4 | [−5.4, +0.6] | 10 / 33 | G −21.3, explicit −16.8, strong extras ×2 (0.31) |
  | value weight 0.3 | +1.6 | [−4.3, +7.4] | 27 / 16 | P6 −9.2, P4 +7.6, P5 +8.1 |
  | value weight 0.6 | −0.3 | [−5.9, +5.4] | 19 / 24 | strong extras +52% |
  | arrival weight 0.45 | +0.3 | [−6.1, +6.7] | 23 / 20 | |

  The search's weights survived the archive's removal. Weighting strength harder makes everyday songs worse and doubles
  the strong extra hits: the strength the search gives up is not cheaply available.

## November 13 (night): hypothesis, a beam slot for the fastest arrival (stated before running)

- **Basis.** A strong hit removes kinetic energy by its very definition: one inelastic contact of strength s takes about
  ½(7.55 s)² (20 units at 0.85; measured 16 per strong catch on V8). Only descent gives it back, about 120 px per strong
  catch, and after strong catches the rider is slower than asked (next span's speed residual −0.05 to −0.08). The arrival
  prior already asks for √(v² + Δv²) before a strong ask; but a prefix that banks speed earlier pays a speed error at once,
  and its worth shows only passages later, past the ranking's two-interval prediction.
- **Change** (`exp/fastest-arrival-slot`, `arc_sequence.ts`). When the beam has room for three prefixes, one slot keeps the
  distinct continuation arriving fastest at the next catch (beside the existing lowest-measured-cost slot). No extra physics
  per prefix; which prefixes survive changes.
- **Hypothesis.** Strong passages entered with more speed: strength and speed up on G and the dense categories.
- **Risk.** A ranked slot is lost; fast arrivals overshoot speed and air in calm passages.
- **Measure.** V8, 4 seeds, paired against `compiler`.
- **Result: not adopted.** V8 **−4.7 [−10.6, +1.3]**, 15 specs up, 28 down; P2 −17.6 (Circus `voice-drums` −62), strength
  −1.8, speed −2.0; strong extras −21%. Keeping a fast prefix costs a ranked one, and the speed it banks is not spent well.

## November 13 (night): hypothesis, ask the learned sources for a little more (stated before running)

- **Basis.** The catalogue, network and memory demonstrations are labelled with the asks their moves faced. Those moves, like
  today's rides, landed softer than asked on strong asks (about 0.12 below at every gap length on V8). Asked for 0.85, a
  source returns moves that tended to give about 0.73.
- **Change** (`exp/raised-ask-proposals`, `arc_proposals.ts`). Before a strong catch, half of the policy slots and half of the
  memory slots query their source with the ask raised by 0.15, phased in like the steep arrival (ask 0.4 none, 0.8 all).
  Ranking, local search and every cost still use the true ask; the number of proposals is unchanged.
- **Hypothesis.** Pools get moves that land near the ask; strength on strong asks up, G up; no new cost in physics.
- **Risk.** Half the slots leave the situation the sources know best; spans (speed, air) and extras may lose.
- **Measure.** V8, 4 seeds, paired against `compiler`.
- **Result: not adopted.** V8 **−4.8 [−6.9, −2.7]**, every block negative, 8 specs up, 35 down; explicit −8.0. Strength
  itself got worse (G −8.8; strong too soft −1.4), and speed −2.4. The sources are better aimed at the true ask than their
  labels suggested: moves for the true ask are worth more than moves for a higher one.

## November 13 (night): hypothesis, hindsight memory (stated before running)

- **Basis.** On V8 the loss is mostly strong asks landing too soft (G 64% of the grade's loss); for 30% of the squared
  strength error no candidate in the pool came within 0.05 of the ask (`loss_attribution.ts --suite=v8`). The archive's
  +14.9 on V8 is mostly there (strong too soft +7.8): coverage of real strong moves near the exact arrival.
- **Change** (`exp/hindsight-memory`, `arc_sequence.ts`). The ride's memory keeps each committed control, labelled with the
  asks it faced. Now it also keeps, per interval, the strongest catch measured there when it beat the committed one by 0.05,
  labelled with what it achieved: its strength in place of the ask, the air, speed and amplitude of its gap in place of
  their targets. A real move, measured in this ride's physics, for the strength it reached. No storage.
- **Hypothesis.** Later strong asks from similar arrivals get memory proposals that really hit hard: strength on strong
  asks up, G and the dense categories up.
- **Risk.** The 16 memory slots get crowded by hard-hitting moves with poor spans; strong extra impacts rise.
- **Measure.** V8, 4 seeds, paired against `compiler`; every ruler; ride character if it gains.
- **Result: not adopted.** A first run measured nothing: the beam commits each interval with its pool reduced to the
  chosen candidate, so no hindsight move was ever stored (fixed on the branch: about 190 moves per ride). Then, V8:
  **+1.5 [−3.6, +6.5]**, 23 specs up, 20 down; G 0.0, P1 −6.1, P6 +6.5. Strong asks too soft gain only +0.3; body drag −3%,
  strong extras −7%. The ride's own strongest candidates had already lost to the same trade-off (mostly speed), and they
  add nothing where the pool had nothing closer.

## November 13 (evening): the ending refinement deleted; V8 baselined

**V8** (`docs/benchmark.md`, "V8"): every V7.1 spec and eight formerly held-out ones (Trouble, Valhalla, Circus `pairs4` and
`voice-drums`, four library songs), gaps ×0.85 (never below 6 frames or their own length), impact asks ×1.25 around 0.5,
frozen as generated files. Held out now: Bones, Dernière Danse coral, Lua na Praça, Petrunko. Reference `nov13` (ca6a0c6a,
the compact sources).
- **Baseline, 4 seeds:** V8 **762.1** (G 645.5, P1 767.0, P2 817.1, P3 756.5, P4 794.6, P5 782.9, P6 716.9, P7 816.0;
  explicit 709.0); every ride complete, Circus `pairs4` included. V7.1 800.8. Guards on V8: strong extra impacts 0.16 per
  100 beats (V7.1 0.09), strong arrivals head-down or backward 14.6% (V7.1 10.4%).
- **Where the loss is** (shares of the grade's loss, complete rides): impact strength 42–67% per category, almost all of it
  strong asks too soft (G 64%); never too hard. Asks of 0.6–0.9 get about 0.12 less at every gap length; asks ≥0.9 at
  18–24 frames get 0.78, at 6–12 frames 0.67–0.70.
- **Does it tell compilers apart?** The archive version (`merged`) against `nov13`: **+14.9 [+6.1, +23.7]** on V8, 41 of 43
  specs up (G +22.8, P7 +23.6, P5 +17.4), strong extra impacts 0.09 against 0.16. On V7.1 the same pair was +11.7
  [+5.5, +17.9] (8 seeds). A somewhat larger, consistent gap: V8 is at least as sensitive. One known pair is thin evidence.

**The ending refinement is deleted** (my call, delegated by the owner; hypothesis below, stated before running).
- V8: −0.2 [−0.4, +0.1], 0 specs up, 22 down (lowest −6.9), 21 unchanged; explicit −0.7. V7.1: −0.1 [−0.3, 0.0], lowest −1.1.
- Physics −0.3%; no ride lost; body drag, strong extras and head-down arrivals unchanged. As predicted.
- Parity references refreshed: 9 of 25 cells change (8 only in physics frames, which the refinement spent; one track,
  `luna_bala_44s` automatic #101).

### Hypothesis, stated before running


- **Decision delegated** by the owner (brief of November 13): the ending refinement's deletion is mine to decide.
- **Change** (`exp/delete-ending-refinement`): `arc_refinement.ts`, `arc_complete_refinement.ts`, their five options and
  tests go, with the interval overrides only refinement set (`arrivalReference`, `localOnly`, `completeGuidanceBudget`,
  `warmIncoming`): 424 lines out.
- **Hypothesis.** As on November 1 (−0.2) and November 8 (−0.2 [−0.4, −0.0], 0 of 35 specs up): a small loss, uniform over
  specs, about 1% fewer physics frames, no ride lost, every other ruler unchanged.
- **Measure.** V8 and V7.1, 4 seeds, paired against `nov13`.
- **Decision rule.** Delete if the loss is about a point or less on both suites and no category or guard moves beyond seed
  noise; the code is simpler for it.

## November 13: the compact sources replace the archive

**Decision (owner).** The 210 KB version is adopted on visual-lab: "reducing it to 200 kilobytes, to me, is completely
acceptable." The 52 MB archive is gone from the tree (last at `ad969bfb`).

- **What it is:** `exp/compact-sources-memory`: the catalogue, the 57-feature network, and 493 representative demonstrations for
  the memory lookup.
- **What it costs** (the night of November 11, below): −11.7 [−17.9, −5.5] on V7.1 at 8 seeds, held out −15.6 [−20.9, −10.4];
  no ride lost; ride character kept. The loss is mostly strong beats too soft on everyday songs.
- **Parity references refreshed** (9 of 25 cells changed: this is a behavioural change). Tests, typecheck, reach, parity and judge
  parity pass.
- **Not judged by eye.** The review clips offered on November 11 could not be judged: the two versions build different tracks
  for the same song, so there is nothing to compare side by side. The adoption rests on the numbers and the owner's size
  preference.
- **A new reference is needed** for later comparisons: the baseline is now this commit, not `merged`.

## November 11 (night): replacing the archive, what moves the score and what doesn't

**The goal (owner).** A compiler without the 52 MB construction archive that at least matches main. It should be clean and
readable where it can be, and it should be a different approach, not a mere iteration of the catalogue. Size: "a few dozen KB,
maybe 100 KB" (October). Budget is not the problem (the owner: even ten times the budget barely moves the score).

All results are V7.1 and 4 seeds unless stated, against main `9d065738` (813.5; 813.8 at 8 seeds) on the remote machine, or
against `merged` (visual-lab with foundations, no jolt, 812.1) where stated. No ride was lost in any arm.

**1. How much stored real moves are worth** (archive subsets, full lookup, data-only):

| moves kept | size | change |
|---|---|---|
| 79,778 (main) | 52 MB | 0 |
| 49,306 (earlier) | 33 MB | −5.3 |
| 8,000 (10%) | ~5 MB | −9.7 [−13.4, −6.0] |
| 3,200 (4%) | ~2 MB | −16.8 |
| 493 medoids (earlier) | 147 KB | −27.7 |
| none | — | −70.6 |

Density matters all the way down. No subset small enough matches main.

The full archive looked up by 17 readable numbers only (arrival 7, the asks ahead 10; no body point state, no trees) loses
−9.8 [≈ −14, −4]. The rider's body at arrival matters to which stored move is right (at 4%: −18.9 against −16.8).

**2. Compressing what to do stalls around −20.**

| policy | size | change |
|---|---|---|
| network, 12 features (earlier) | 18 KB | −25.1 |
| network, 57 features, hidden 32, 32 styles (new) | 57 KB | −23.6 [−38.6, −8.6] |
| catalogue, 64 styles all tried (earlier) | 44 KB | −22.7 |
| catalogue + 57-feature network together | 107 KB | −19.0 [−25.5, −12.6]; **−17.4 [−21.9, −13.0] at 8 seeds**; held out −21.9 [−28.9, −14.9] |
| the same with 64 network styles (paired against 32) | 119 KB | −0.1 [−3.4, +3.3] |

Seeing the body helps a lookup, not a network (57 vs 12 features: about the same). Two compact sources together beat either one.
Breadth beyond that is saturated.

The loss of catalogue + network breaks down (`loss_parts.py`, 380 rides) as −17.9 in all:
- strength −9.6 (strong beats too soft −8.4; everyday songs G −18.3);
- speed −4.6, timing −1.6, extra hits −1.3, air −1.0.

This is the chain-setup gap foundations diagnosed.

**3. Real moves for the memory lookup add a little** (data-only on top of catalogue + network):
- 493 representative demonstrations (210 KB in all): +2.9 [−0.1, +5.9] paired, support 0.97; explicit requests +8.0; strong extras −38%.
  Against main: **−14.4 [−21.5, −7.3] at 8 seeds**.
- 1,600 demonstrations (344 KB): −13.9 [−18.8, −8.9] at 8 seeds, no better than 493. Memory density is saturated inside the
  combination too.

**4. Generating moves, with physics or a learned model of it, does not reach the right geometry.**
- **Readable physics** (Codex study, 5.25 M measured candidates): strength from speed and entry R² 0.36, against 0.82 for trees.
  Strength sums speed × change of direction over six frames after contact, so it depends on the whole contact. The next arrival
  from the exit gives R² 0.39 (0.88 for trees). No readable inverse can aim.
- **Staged probes** (a Codex design note, then its pilot `exp/staged-probes`): build a move in stages with short metered
  simulations (entry 24 → redirect 12 → runout 8; ordinary unguided arcs only). Null: −1.7 paired against no-archive, 16 specs up
  and 19 down, at equal physics.
- **Imagined proposals** (`exp/imagined-proposals`):
  - The model: an 88.5 KB MLP forward model trained on training songs only (122 rides, 2 seeds; accepted and rejected
    evaluations). On unseen V7.1 it predicts strength at R² 0.85, the next heading at 0.91 and the next speed at 0.82, and failure
    with AUC 0.87.
  - The source: 512 correlated generated controls per side are scored by the model; the best 64 distinct ones are tried.
  - Result: **−51.6** [−63.4, −39.8] against merged, no better than the generator alone. It improved the compiler's own strength
    rulers (R1, strike) and worsened v3 (strong beats soft): self-grading. Within an interval the model ranks only moderately
    (best tenth in the predicted best quarter 35%, against 87% for perfect prediction). The pool is the bottleneck: imagination
    can't make incoherent combinations coherent.

**5. On today's compiler** (`exp/compact-sources`: the 107 KB sources ported onto visual-lab, the merged compiler without the
jolt; against `merged`):
- V7.1, 8 seeds: **−14.7 [−20.2, −9.3]**; 2 specs up, 33 down; physics +1%. Body drag −8%; strong extra impacts 0.12 against 0.08
  per 100 beats; head-down strong arrivals 10.5% against 9.7%.
- Held out (13 specs, 52 rides): **−19.9 [−32.1, −7.8]**; 1 up, 12 down; head-down strong arrivals 11.3% against 9.6%.
- **Ride character is kept** (`ride_character.ts`, 328 rides each, paired):
  - beats hit from above 26.8% against 27.5% (−0.6 points [−1.1, −0.2]);
  - strong beats from above 21.0% against 21.1% (no change);
  - contact from above −0.30 s/min, guide contact −0.32 s/min;
  - ride-outs, flights, air and body contact within a fraction.
- With the 493 memory demonstrations (`exp/compact-sources-memory`, 210 KB), paired against it at 8 seeds: **+3.1 [−0.2, +6.3]**,
  support 0.97; 23 specs up, 12 down; explicit requests +8.1; head-down strong arrivals −5%. So about −11.6 against merged.
  Directly against merged: **−11.7 [−17.9, −5.5]** at 8 seeds (1 spec up, 34 down; G −24.7; explicit requests −12.9; physics +1%;
  body drag −5%; strong extra impacts 0.12 against 0.08; head-down strong arrivals 9.9% against 9.7%). Held out:
  **−15.6 [−20.9, −10.4]** (3 up, 10 down), against −19.9 for the 107 KB version.
- With about 940 strong-chain demonstrations added to the memory (current and next beat both requested ≥ 0.6, features 48 and 53;
  `exp/compact-sources-memory-chains`, 400 KB), paired against the 210 KB version: −0.2 [−2.9, +2.5] at 8 seeds (everyday songs
  G +6.4; P6 −12.6 on its single spec). Held out: +3.0 [−4.7, +10.7], 6 specs up, 7 down. Inconclusive; not worth its size.
- With 32 memory proposals instead of 16 (samples 224): −2.6 [−6.0, +0.8] paired at 8 seeds; more memory crowds out refinement.
- With its network retrained on the pooled archive (twice the demonstrations; `exp/compact-sources-pooled`), paired, 4 seeds:
  +0.3 [−4.0, +4.7], 14 specs up, 21 down. Null: more training data does not move the compact sources.

**Reading.** What wins is coherent moves, real or learned from real ones, and many of them, close to the exact state including
the rider's body. Compressing them caps around −15 on today's compiler (−17 on the old base). A few hundred real moves for the
memory gain about 3 more; more of them gain nothing. Generating
moves and searching by physics, staged or imagined, did not find what the stored moves carry. Matching main without the archive
remains open.

**Built.** On visual-lab, report only: `catch_outcomes.ts --cases=train` (training songs) and a rejected-evaluation observer
(parity identical). On branches: the experiments above, `exp/compact-sources` and `exp/compact-sources-memory` (the candidates,
on visual-lab, ready to compare and adopt).

**Not adopted.** No change to main; the archive stays.

## November 11: the merged compiler's baseline

`visual-lab` with `rework/foundations` merged (the November 7 archive, no jolt; reference `merged` = 9e311371) scores **812.1** on
V7.1, 4 seeds, 164/164 rides complete. Explicit requests score 781.0. Strong extra impacts are 0.10 per 100 beats, body drag
4.20 s/min, and strong arrivals head-down or backward 10.1%. Main before the jolt removal scored 813.5, so the difference, −1.4,
is within seed noise, as the owner judged. Every compiler comparison from here on is against this baseline.

## November 11: `rework/foundations` merged into `visual-lab`; parity references refreshed

The merge composes two adopted behavioural changes: the November 7 construction policies (the archive, frozen November 8)
from `rework/foundations` and the jolt removal (November 11) from `visual-lab`. Neither parent's compile references can hold.
- `npm run parity -- --update`: the 20 fixture cells now equal `rework/foundations`' references exactly (the jolt never
  reached them); the 5 cells compiled from current specs changed tracks, with quality on the 3 judged ones 830.5 → 836.8
  (tiki_tiki bench-pairs), 844.8 → 856.7 (luna_bala v7-rideout) and 771.0 → 780.3 (amor_na_praia v7-explicit-handover),
  against `visual-lab`. One ride per cell: not a comparison.
- Adapted: `tools/research/candidate_origins.ts` and `catch_outcomes.ts` no longer pass a jolt to `resolveCase`.
- V7.1 813.5 (TODO.md, item 9) was measured with the jolt; the merged main needs its own baseline before the next compiler
  comparison.

## November 11: the video code keeps only what production draws (structural, owner's decision)

The owner: "now for the actual production code base, let's clean that up". The rounds, their answers and every earlier look stay
in git history; the code keeps what the 24 themes, their drop pairings and the plain review look draw.
- `palettes.js`, 327 → 29 lines: the ~200 named schemes, the paper and theme variant generators, the `LIBRARY` tiers and the old
  `DROP_SCHEMES` go. What stays: `graphite` (V1's, so the plain clips and the lab's Swatch), each theme's scheme under its id,
  Hokusai's judged partner, Paper Print's black and white, the pairings.
- `grade.js`, 79 → 49: one response, vibrance on the soft-start curve with the paper half, and `plain`. Whisper, saturation,
  contrast, brightness and the other vibrance curves go. `theme.js` loses Night and Whisper (`nightPaper`, `nightInk` and `tone`
  stay in the specifications, which are the themes' identities, but nothing draws them).
- `look.js`: values no theme, `PLAIN` or `V1` uses go: drop `night`, `bandHeight` low and mid, `riderLower` 8 and 16, `sunRider`
  0, 48 and 96, `sunLift` 0, 19.2, 32 and 38.4. Every key stays, so every judged id is unchanged (the test recomputes all 24).
- The lab (`lab.js`): the round-29 questions and their copied schemes go; the candidate files of rounds 29–44 go (10 files, 9,679
  lines). `?set=NAME&q=1` still asks a new round. The test questions and `uicheck.mjs` now use collection schemes (76/76; two
  checks had failed since the collection replaced the old theme names).
- Pages that drew retired looks go: the showcase (`showcase.html`, `.mjs`, `showcase-films.html`), `theme-ratings.html` and
  `films7.sh`. The rounds index greys the rounds whose questions or pages are retired. Other round pages are self-contained and stay.
- `fingerprint.mjs` now covers production: every collection theme, four pairings, every remaining option value, plain and the
  old rides (182 frames; new baseline).
- Frozen sets: `stills.html` accepts a scheme already named with identical colours, so `freeze.mjs --rerender` works for the
  sets of collection themes (it refused them before). A set judged with retired values is refused with its own renderer commit.

scripts/video: 1,779 → 1,446 lines; 10,083 lines of retired lab files deleted.

**Proof.** Before the change, 174 stills (each of the 24 themes on Circus at 18 and 44.65 s and on Petrunko; all 20 pairings at
18, 44.6 and 44.65 s and on Los Voltaje inside its drop; plain, V1, Swatch) at 1080 px, JPEG 0.92: after it, all 174 are
byte-identical, and the 48 Circus theme stills equal the judged frozen ones. The new fingerprint is identical before and after
(182 frames). `freeze.mjs --rerender` on copies of the light-collection and cut-outs sets reproduces their 12 stills exactly.
Tests (569), typecheck, reach, compile and judge parity pass; the lab plays a theme and every option chip, the collection page and
the rounds index load without errors. Unchanged: `check.mjs` still reports horizontal overflow at 390 px.

## November 11: each video's look is chosen for it; drops (rounds 43–44)

The project is a mass generator: no one picks a video's look. `scripts/video/choose.js` chooses from the ride's id:
- 75% light themes;
- for a light theme whose song has a drop, a dark partner half the time, drawn by weight.

The same ride always gets the same look. `npm run render` (each ride of a batch) and `npm run video` both choose unless `--look`
names a theme. Each record says its theme and partner. `DEFAULT_THEME` is retired.

**Pairings** are the owner's round 43–44 answers, in `collection.js` `DROPS`, light to dark only. At the drop the picture takes the
partner's colours and keeps the light theme's layout, hot note and sun, so a sun never appears or leaves. Paper Print's second
partner, pure black and white, is a drop-only colour set (`DROP_ONLY`). A pairing is its own scheme, `<light id>+<dark id>`, a
copy, because the switch caches per scheme object, so judged theme ids are unchanged. The test-only drop value `partner` (the
partner's own hot note) was removed: the owner keeps the hot note and sun.

**The collection page** lists each light theme's partners and previews any of them through the drop.

**Fixed on the way:** the render record's score read the cells' removed `metrics` field. `--set` values are checked before any
work even when the look is chosen later.

**Checks:** 570 tests (a new `video_choose` test covers pairings, the switch per pairing and the shares over 4,000 picks),
typecheck, reach, compile parity and judge parity pass.

## November 11: the old production characterization removed (structural, owner's decision)

The owner: the per-song characterization and qualification ("the number of rotations… completely outdated") goes entirely.
- Removed: `scripts/produce/measure.ts` (production metrics and the qualification floors), `scripts/produce/config.ts` (the
  `select.json` and `characterization.json` schemas, floor derivation, `loadSelect`), the 11 `select.json`,
  `characterization.json` and `select.suggested.json` files, the cells' `metrics` field and the `revolutions` and
  `standTimePct` of `upload.json`. With them, code only they reached: `scripts/v0/score.ts` (the old drift score) and its test,
  `scripts/v0/core/trace.ts` and `scripts/lib/rotation.ts`. No ruler or compiler used any of it.
- A song is now its directory: `spec.ts` (or a variant), `audio.mp3`, `audio.json`. Every song already used those defaults.
  `select.json`'s `render` block, read by nothing, goes too.
- Identities change knowingly: `render` left the music case (evaluation `resolvedSha256`, production `musicSource`) and the
  compiler content lost dead files, so saved arms are recompiled. No parity or test reference stores them.
- Proof: compile parity byte-identical against the previous commit's references (25 cells), judge parity, tests (570, in a
  clean worktree of this commit; the drift score's 13 went with it) and typecheck pass; reach finds nothing unreachable
  from this change (it lists `scripts/video/choose.js`, dead since 266d1db2).

## November 11: jolt 0, declared before running (timing stage 4)

The jolt still shifts every authored contact 15 ms later before compiling (`scripts/produce/jolt.ts`, `JOLT_DEFAULT_MS = -15`,
the owner's choice by ear in June). It only moves the compiler's targets. Since stage 1 a video aligns each ride itself
(offset = mean strongest frame − authored beat), so presentation no longer depends on the jolt. At 0, `applyJolt` returns the
spec unchanged and its early-contact clamp never runs. No spec needs the clamp: all 85 specs and variants have their first
contact at or after the earliest catchable 0.125 s.

**Change.** `JOLT_DEFAULT_MS = 0` (branch `exp/jolt-0`). Nothing else.

**Hypothesis.** Quality is neutral: at 40 frames a second the shift moved each target by 0 or 1 frame, and scoring follows the
targets.

**Measure.** `compare` on V7.1, 4 seeds, against `visual-lab`: completion first, then the headline with its interval and per-spec
signs, and every ruler.

**Accept if:**
- no ride is lost;
- the headline change is not worse than −3 points, with its interval including 0 or above it;
- no ruler is clearly worse (a ruler that is worse is disclosed).

**Then:** jolt 0 in the same commit, with the parity references updated; the jolt code, `LR_JOLT_OFFSET_MS` and the spec's unused
`music.offset` removed in a structural commit after it.

**Result (V7.1, 4 seeds; `compare --candidate-jolt=0`, added for this): not adopted.**
- 164/164 rides finish in both arms.
- The headline moved −4.1 [−14.7, +6.4], support 0.15. The seed blocks were −2.3, +3.4, −12.6 and −5.0.
- 18 specs went up and 17 down. The losses sit in the long-gap categories: P6 −15.9, P7 −11.1, P3 −8.9.
- The rulers barely moved (strength rms about +0.002). Strong extra impacts went from 0.05 to 0.08 per 100 beats, mostly in P6.
- Past the declared −3 bound, so the jolt stays at −15. Neutral is neither shown nor ruled out.

Report: `generated/eval/compare/b17d3af4-vs-visual-lab@fa2c274e-v7.1-cand-jolt-0/report.txt`.

**Adopted by the owner's decision (2026-11-11).** The measurement is consistent with no effect: 18 specs up and 17 down, and
the interval spans 0. The −3 bound was too tight for a 4-seed interval about ±10 points wide, so missing it says little. The
owner reads the seed blocks as noise and removes the jolt for simplicity: contacts are compiled at their authored times.
- Removed: `scripts/produce/jolt.ts`, `LR_JOLT_OFFSET_MS`, every jolt parameter and field (spec loading, evaluation plans, arms,
  production plans, the gallery job identity), `compare --candidate-jolt` with `assertJoltPair`/`allowJolt`, the evaluation
  plans' redundant `authoredTargets`, and the spec type's unused `music.offset` (the spec dashboard now reads the spec on the
  audio's clock).
- The silent clamp became a validation: a spec whose first contact is before the earliest catchable 0.125 s (frame 5) is
  refused when it loads. All 85 specs and variants pass.
- Old records are refused, not relabelled. Evaluation runs (`line.eval.v2`), arms (`line.eval-arm.v2`) and production
  collections (`line.production-library-plan.v2`) say they were compiled under the retired shift and must be recompiled;
  `remeasure` refuses them; arm keys and gallery job identities no longer match, so no old cell is reused. New schemas: v3,
  and `line.automatic-production.v2` for production plans. Saved rides still play: each aligns itself from its beats.
- Parity references refreshed: the 5 cells compiled from current specs changed tracks (4 frame counts; quality on the 3
  judged ones 819.6 → 830.5, 815.7 → 844.8, 787.6 → 771.0); the 20 fixture cells are byte-identical. Tests, typecheck, reach,
  compile and judge parity pass.

## November 10, night: Cut-outs joins the collection (round 42)

The bars sit a third of the way from Prussian toward the deeper blue (OKLCH; #014a7a). The theme is frozen as set
`2026-11-10-cutouts` and added to `collection.js`, which now holds 24 themes: 12 dark families and 11 light. Its id is
reproduced, its stills rendered by name are byte-identical to the frozen ones, and the tests, typecheck and reach pass.

## November 10, night: six light themes join the collection (rounds 40–41)

Round 40 gave 11 light themes a page each: the theme as judged and three directions. The owner answered the colour pages again
with Redshift off. Round 41 refined the close ones by a few percent and asked two questions about the collection itself.

**In** (frozen as set `2026-11-10-light-collection`, then added to `collection.js`):
- Paper as judged, and Paper's black and red print;
- White and Vermilion with deep red bars and gold;
- Lavender Dusk with violet bars;
- Peony with stronger bars and marigold;
- Seashell, paler with a softer jasper.

The collection is now 23 themes: 12 dark families, 10 light.

**Out:**
- Celadon: "we have alternatives that are even better".
- Prussian and Slate: a muted theme must be exceptional to earn its place.
- Wisteria: Lavender's cousin, Lavender kept.
- Blushing Dawn: Amber and Purple was preferred beside it; its refined version stays in the round-41 file.
- Sumi, Morning and the pencil drawing: they repeat looks the collection has.

**Still open:** Cut-outs' blue, between Prussian and a deeper blue (round 42, `?set=cutouts`).

**Checks:**
- All 23 production themes reproduce their judged ids.
- The 12 new stills rendered by theme name are byte-identical to the frozen ones.
- 579 tests, typecheck, reach, compile parity and judge parity pass.

## November 10, evening: colour judgments made through Redshift (a correction)

The owner's desktop runs Redshift: 3500 K at night, neutral 6500 K by day. All of round 38 was judged through it: 125
comparisons and 22 notes, on November 9 at 21–22 h and November 10 at 7 h, CET. Round 40's first answers were too. The
earlier sets were judged in the morning on desktop (neutral) or on the phone.

**Corrected claim.** In mixed dark/light pairs, the dark theme wins:
- desktop by day: 57% (124);
- desktop at night: 70% (20);
- phone: 44% (78).

The "dark beats light about 7 in 10" in the entry below is mostly this artefact, not taste. The notes on grounds and warmth
from round 38 ("too red", "a bit sad", poor harmony) are unconfirmed until seen on a neutral screen.

**Kept.** The collection stays, by the owner's decision, and its strengths come mostly from neutral sessions. Judgments of form
(band shape, a sun or not, inking) are less affected by the filter.

## November 10: the collection goes into production (owner's decision)

**Why.** 39 rounds of proposing and judging had stopped converging. To test whether an agent's eye could take over some of the judging, I
predicted 40 of the owner's decisive comparisons blind: no theme whose score I had seen, the answers hidden until my picks were
written down. My picks matched 26 of 40, 65 % [50, 78]. The rule "the darker theme wins" scores the same 65 %. Where I went
against that rule I was right 8 of 16 times. So no agent judgement stands in for the owner's beyond that rule, and no taste
"language" should drive generation. What is reliable is coarse:
- dark beats light about 7 times in 10 (+0.77 against −0.07);
- the track is never a colour;
- no red grounds.

The owner's decision: the themes they consistently liked become the collection, with no quota and no further rounds on them.

**What.** `scripts/video/collection.js` holds 17 themes in 16 families. Each is its frozen round-38 specification (v1), copied
from the judging registry, with its hash id:
- **dark:** Jungle Moon (tuned, vermilion), Rothko, Cyanotype, Cerulean and Coral, Cobalt and Chartreuse, Lily White and Leaf
  Green, Old Rose, Black Iris (bold), Violet and Marigold, Gilt and Amber, Negoro (cream line), Forest Green and Gold;
- **light:** Amber and Purple, Hokusai, Dune (inked), Silver and Rust.

How it is wired:
- `look.js` `THEMES` is now this collection. The round-20 to round-28 themes left it; their schemes stay in the palette library.
- `palettes.js` names each collection scheme by its theme id, as the judging stills are drawn.
- Productions default to `DEFAULT_THEME` (Jungle Moon, the strongest) instead of Paper Night.
- The lab's round-29 questions keep their old looks written out, so they play as before.

**Checks.**
- A new test proves every production theme reproduces its judged id and specification.
- All 34 stills rendered by theme name are byte-identical to the judged ones.
- 579 tests, typecheck, reach, compile parity and judge parity pass.
- The lab loads every round set and plays all 19 presets at 16.7 ms a frame; the question walk passes.
- The fingerprint's theme cases now name collection themes, so its theme frames have a new baseline.
- Unchanged and failing before this change too: `check.mjs` reports horizontal overflow at 390 px.

**Next.** Light themes, worked one theme at a time: a few versions of one theme, iterated briefly, as video in the lab.

## November 10: validation against the visual direction and judging workflow

Reviewed the recent owner decisions through R39 and traced named themes, candidate
looks, frozen judging specifications, ranking and one-pass renders. The current
62-theme comparison material is preserved: all 124 stills byte-identical to both
the pre-refactor renderer and the actual archived images; all 197 frozen theme
identities valid. Sampled intensity, hit times and spans agree across all eight
lab songs. No pending theme refinement or drop decision was adopted.

The fork/heat correction is visibly consequential on affected older/free looks
(including Blue and Rose), but no active R38 theme uses it. Inspected before/after
stills and documented that matching the intended driver does not establish taste
approval. Corrected the lab's intensity caption to follow the resolved look and
name colour response accurately. Updated stale current-state docs without changing
owner answers. Full intent/evidence map and limits:
`docs/research/visual-direction-validation-20261110.md`.

Found and fixed an evidence-integrity gap: frozen still regeneration now renders
to a temporary directory, rejects any changed existing image before publication,
and only adds missing files. It cannot silently replace judged images while
keeping their votes. Three regression tests plus the real freeze command on a
throwaway set cover identical, differing and incomplete batches. The judging UI's
cut-undo check now asserts the restored theme instead of comparing it to itself.

Validation: lab 76/76 checks; judging phone/desktop checks pass on an isolated set;
real Rothko excerpt through the production writer: 150 frames, 0.00 ms audio-start
error. All 578 tests (110 files), typecheck and reachability pass. The renderer's
compile/judge parity checks also passed; this validation made no compiler changes.

## November 10: visual models and composition, structural review

Reviewed intensity, music, inking, camera/framing, drops and colour together.
`picture.js` now composes explicit frame inputs: prepared track/ink frames,
shared motion and calibrated intensity, one camera representation including
bookends, effective theme colours, then music, track, rider and hit compositing.
Removed the dead airborne/steady-zoom machinery, duplicate finite differences,
duplicate rider/camera positions, three parallel colour-response definitions,
and the implicit last-drawn intensity used by colour queries. Colour arithmetic
is shared; drop and Night decisions are resolved once rather than by each element.
Active theme variants and the intensity study helpers remain: they are used in
ongoing comparisons and diagnostics, not compatibility fallbacks.

Two corrections: the fork's dot radius (7) shadowed ride time, so its heat was
always sampled at seven seconds; both band shapes now share heat-based accent
selection. `schemeAt(t, look)` now uses intensity at t, even before drawing or
after an unrelated seek. Tests cover both. The saved `paper` field is preserved
for frozen theme identities; the lab labels it “Colour response”.

Validation: all 116 lab fingerprint frames unchanged; 40,446 graded palettes
identical. A 2,592-frame synthetic comparison spans bands, accents, intensity
responses, changing speed, zoom, bookends, tops and drops; differences occur only
in fork/heat cases affected by the correction. New model and browser tests cover
rail membership/inking/visibility, absolute intensity and slew, spectrum and
accents, framing limits, drop boundaries, palette integrity and seek independence.
All 575 tests (109 files), compile/judge parity, typecheck and reachability pass.

## November 10: hit effects, structural review

Kept the approved R23/R26 picture: measured peak timing, onset-line direction,
slow-start split, colour boost excluding paper and pencil, shake above 0.6,
clean rider overlay, and the title's smaller split and overscan. Separated the
pure hit model (`scripts/video/hits.js`) from canvas separation (`split.js`);
`picture.js` keeps drawing order. Removed the one-entry recipe registry,
per-frame curve wrappers, the before/after title protocol and mutable split/title
state. Hit fields name time, strength, energy and normal explicitly. Band heat
still accumulates independently; the intensity-driven theme grade is unchanged.
Historical round pages already hold their own curve samples and need no runtime
compatibility export. The existing `hits: v1/none` look choices remain valid.

Validation: all 116 lab fingerprint frames and 504 targeted synthetic frames
byte-identical against the original renderer. New tests
cover event selection/direction, peak onset and recovery, thresholds and strong-hit
growth, overlap and heat, exaggeration, seek/top/size changes, and paper/pencil
preservation on light and dark grounds. All 562 tests (108 files), compile and
judge parity, typecheck, and reachability (including the new files) pass.

## November 8: a hit happens at its strongest frame (timing stage 3 done; branch `visual-lab`)

The lab's rides were recompiled at the same jolt (identical tracks, now with
beats, so aligned at 24 to 33 ms) and round 23 compared four timings on whole
films: today's, then aligned with the effects at the first touch, at the
strongest frame and on the beat. The owner chose the strongest frame. It is the
one rule now, with no option: everything a hit triggers runs on the ride clock
from its strongest frame, the intensity metric reads the same moment, the impact
panel plots it, and a hit's direction stays the line struck at its onset (at the
strongest frame the nearest line differs on about 10 % of hits, some reversed).
The lab fingerprint moved on 55 of 116 frames.

A step-back review (Codex and an independent agent, at design level) found and
this change fixes: study clips had lost their beat marks in stage 1 (they are
the spec's authored beats again: an eval cell's own spec, checked against its
hash; the visibility study's spec.ts, which its observe step requires);
a crashed ride could not open (the replay required a trace past the ride's end);
the scene took its sections from the song's current authoring (now the record's
own, with its recording); the span was enforced by some callers only (now by the
writer); a compare export of a perturbed cell failed (now through the
evaluation's own case); two compatibility paths and a duplicate frame rate. The
scene now checks its invariants once (all 194 saved records pass), the review
player says how a ride is timed, and the cross-offset test covers hit effects.
Study clips are declared what they were: bare tracks, shown as compiled, judging
motion rather than sync.

Then folded: the lab's song table is defined once (`rides.js`, which also feeds
`recompile.sh`), and `look.d.ts` no longer repeats the options (no TypeScript
reads one; `resolveLook` checks them). A throwaway visibility study (three pairs
from the published key, preserved tracks only) and a short `npm run video` ran
end to end; the pair-study builder and compare's review could not, for lack of
their source data on this machine.

## November 8: rides record their authored beats (timing stage 2 of 4; branch `visual-lab`)

`loadMusicSpec` takes the beats from the spec as authored, before the jolt, and
rejects contacts that are not strictly increasing (all 85 specs and variants
already are), so beat i is target i everywhere; `saveMusicCell` saves them
beside the impact account. They enter no identity: parity and judge parity are
unchanged. The 8 lab rides recompile to identical tracks and are aligned at
24.3 to 33.4 ms; the lab keeps its saved rides (as compiled) until stage 3.

## November 8: timing, two clocks (stage 1 of 4; branch `visual-lab`)

Hit effects, the intensity metric, seek bounds, study clips and the review
panel each converted physics frames to seconds their own way, and the jolt
drove several of them at once. Now (`generated/concept-lab/docs/TIMING-DESIGN.md`):
song time and ride time, one relation r = s + offset (`scripts/video/timing.js`),
and the scene as the single source: the impact account as recorded, the song
span, and the ride's timing. A ride is aligned (offset = mean of strongest
frame − authored beat) only when its record has beats; none does yet, so every
ride is shown as compiled, and the lab is byte-identical but for 2 of 876 hits
whose recorded strike start differs from the old first-touch search. What hit
effects follow is a look option, `effectsAt` (touch in v1). Next: beats
recorded by the compiler, then alignment with the effects round, then jolt 0.

## November 8: one video renderer (adopted; branch `visual-lab`)

Finished videos were a ride exported by the native player and re-composited by
Remotion with the June look. Measured on real renders (Lua s101, Petrunko s202):

- **The audio was 42.7 ms late** in every finished video, the published ones
  too: Remotion read the source AAC ignoring its priming and wrote its own.
- **The ride was one frame late** (16.7 ms): frame 0 was shown twice.
- **Colours were wrong on every player:** the ride was encoded with BT.601 and
  no tag, then read and labelled as BT.709 (the Hokusai sun #d4412a showed as
  #ec5620).
- **Edge bars:** the colour split left cyan and yellow strips at the frame's
  edges on strong hits (39 and 37 frames in one shipped video).
- **Render hashes:** each saved video recorded hashes of 12 presentation files
  and all of `remotion/src`, so any edit to them made saved productions refuse
  to re-render.

The lab's own pipeline had none of these: one canvas, piped once into FFmpeg,
audio measured at 0 ms. So the lab's drawing became the one renderer,
`scripts/video/` (ARCHITECTURE.md, Review), and everything goes through it:

- `npm run video`, study renders, the compiler's review clips (the plain look)
  and the lab's films;
- one encoding standard with all four colour tags, and a check of every
  written video (frames, tags, audio within 1 ms of the song);
- a render is an output of its inputs and look; the renderer's commit is
  recorded, never checked.

**Deleted:** Remotion and the June look (LOCKED_FX), the beat punch, the
overlay data, the native video exporter, the horizontal format, the dormant
style study, cross-study video reuse, and the render hashes.

**Checks:**
- **Proof of the move:** the extraction is byte-identical on 116 lab frames
  (themes, every option, the plain look, the round-5 rides).
- **Data path:** the scenes then moved to the shared builder. It keeps the
  measured values instead of re-rounding them, which moves band heights by at
  most 0.14 px; 111 frames changed, the 5 plain frames did not.
- **Gates:** parity and judge parity pass, as do the tests (444), the
  typecheck (0 errors), reach (0 unreachable) and the smoke check.

The review player (`motion-gallery/production.html`) draws the same picture, plain
by default or in any theme, with its contact inspection as an overlay; its 16:9
format, zoom slider and the official-follower drawing are gone.

**Not changed:**
- The compiler.
- The specs, kept as authored by the owner's choice (TODO.md, item 11).
- The jolt, to be judged again by ear on videos now in sync.

## November 8 (evening): readable proposals, first construction steps

The owner asked for broad, methodical construction work on a readable
proposal system, led by Claude: a piece is not rejected only for scoring
below the archive. Progress is measured as the gap closed between the
no-archive floor (−70.6) and main, with every version reported in full.

### What a move is, and how the archive's moves are organized

- **A move is already an editable shape.** `motionArcPaths`
  (`arc_geometry.ts`) builds an arc from a tangent schedule:
  - the rider is met at `entry` (shifted by `offset`) and turned by `turn`
    over the first frames (`turnFraction`, eased by `bias`);
  - the heading then eases to `exit` over `support` frames, with an
    optional mid-arc `bend`;
  - the family's profile modulates it, and the guide follows at
    `clearance` (`guideFlare`, `guideTilt`).
  A catalogue is therefore a question of which values good moves use, not
  of a new representation.
- **The six main controls do not compress.** Per group, four principal
  directions cover only 83–89% of their variation. A handful of sliders
  cannot describe the archive.
- **The structure is modes set by the situation.**
  - With a strong ask and a steep arrival the archive redirects: turn
    −20° to −25°, exit −25° to −43° relative to the arrival.
  - With a light ask and a shallow arrival it follows or dives. Unguided
    arcs are then mostly caught from the opposing side (60–83%).
  - Requested strength, arrival heading and the next ask explain 30–60% of
    turn and exit (guided arcs: turn 0.46, exit 0.60).
  - Support, bias and offset do not depend on the situation at all
    (R² ≤ 0.06): they are free style, the source of variety.
- **Instrument.** A renderer (scratch, research) rebuilds a stored case's
  situation from its features and draws its control with the compiler's
  own `motionArcPaths`, so moves can be looked at.

### A readable catalogue in the compiler (V7.1, 4 seeds, against main)

- **Form.** Per construction group and contact side:
  - a **core table**: entry, turn and exit relative to the arrival, on a
    5 × 5 grid over requested strength (0 to 1) and arrival heading (−10°
    to 70°), read by bilinear interpolation and fitted with a smoothness
    penalty;
  - **styles**: real demonstrations, the medoids of k-means on their
    residual from the table and their free fields. Each keeps its whole
    control, so a style is a coherent real move.
  - A proposal is the table's core for the situation plus a style's
    residual, with the style's free and optional fields. It takes the
    policy lookup's 32 slots; the memory reads no archive (ride memory
    only), as in the compact-network arm.
- **Results.**

  | version | numbers | V7.1 | 95% interval | explicit requests |
  |---|---|---|---|---|
  | table + 32 styles, fixed order | 5,582 | −37.9 | −51.3 to −24.6 | −37.0 |
  | table + 32 styles, ranked by situation | 13,582 | −33.2 | −48.7 to −17.7 | −32.7 |
  | table + 64 styles, ranked by situation | 25,647 | **−29.1** | −41.9 to −16.4 | −30.3 |

  - "Ranked by situation": each style records how often its demonstrations
    occur in each cell of the grid (25 counts). Styles are offered most
    typical first.
  - No ride lost in any version. Strong extra impacts rise to 0.13–0.18
    per 100 beats, against 0.04.
  - Ranked 64, per category: G −45.6, P7 −41.5, P5 −37.5, P1 −28.7, P4
    −24.2, P6 −22.6, P3 −17.7, P2 −15.4.
- **Reading.**
  - A readable table with fixed styles reaches the 32 typical moves
    (−33.1), not the compact network (−25.1).
  - Ranking the styles by two readable quantities is worth about 5 points,
    and a larger ranked set about 4 more.
  - The everyday songs (G) carry most of the remaining loss.
- **More styles plateau.** 128 ranked styles (42,471 numbers, 74 KB): −31.7
  against −29.1 for 64. The remaining loss is not a matter of more stored
  moves.
- **Where the ranked 64 still lose** (`loss_parts.py`, headline points
  against main, with the compact network for comparison):
  - strong beats too soft −11.6 (network −12.0);
  - speed −8.6 (−7.7); extra hits −2.9 (−0.9); air −1.2 (+0.1).
  - Strength is now as good as the network's. The large shared loss of
    every compact source (strong beats about 12, speed about 8) remains.
- Branches: `exp/readable-catalogue`, `exp/catalogue-ranked-32`,
  `exp/catalogue-ranked-64`, `exp/catalogue-ranked-128` (local).

### What a candidate leads to: a forward model of a catch (report only)

- **Instrument.** `tools/research/catch_outcomes.ts` records every retained
  candidate of every offered interval: its control relative to the
  arrival, and what it led to (measured strength, span residuals, local
  cost, arrival at the next catch).
  - Main, V7.1, seed 101: 41 rides, all tracks identical to the saved arm.
  - 27,723 intervals, 5.25 million measured candidates (about 190 per
    interval), 3,489 committed. That is 65 times the archive's winners,
    and it includes the candidates that lost.
- **How predictable the outcomes are** (boosted trees on situation and
  control, 40 candidates sampled per interval, about 1 million rows; fitted
  on some songs and scored on held-out songs):

  | outcome | R² across songs | rank agreement within one pool |
  |---|---|---|
  | measured strength | **0.85** | 0.54 |
  | arrival heading at the next catch | **0.93** | 0.70 |
  | arrival speed at the next catch | 0.80 | 0.61 |
  | air residual | 0.58 | 0.49 |
  | speed residual | 0.66 | 0.60 |
  | local cost | −0.08 | 0.24 |

  - The physical outcomes are well predicted. The total cost is not, since
    it is dominated by rare failures.
  - As a screen inside a pool, the predicted parts combined with the
    compiler's weights put 38% of the measured best tenth into their best
    quarter (chance 25%), and 50% on strong asks.
- **Readable versions are weak.** Straight lines on named physical terms
  (speed × sine of the redirect, heading + exit, durations…): strength
  0.43, next heading 0.76, next speed 0.58. Contact physics is nonlinear.
- **Reading.**
  - A compact nonlinear model can say what a move will do: how hard the
    hit, and where the next arrival. Its role would be narrow: aim the
    readable moves, while simulation still decides.
  - Within a pool, where candidates are near-copies of each other, it
    discriminates only moderately. Whether aiming pays is tested first
    without any model (next).

### Aiming by fixed physical variants: worse

- **Change** (on the 64 ranked styles; `exp/catalogue-aimed`). The 8 most
  typical normal-side moves also come aimed:
  - with 8° more redirect (turn −8°) when the beat this arc lands on is
    requested at 0.6 or more;
  - with an exit 10° steeper when the next beat is strong, for a steeper
    arrival there.
  - The variants take the places of the least typical moves.
- **Expectation.** Strong beats less often too soft.
- **Result: −38.6** [−46.7, −30.6], against −29.1 without aiming; every
  seed block worse; strong extra impacts 0.20 per 100 beats.
  - Strength −17.4 against −14.0, speed −10.4 against −8.6, extra hits −4.7
    against −2.9.
- **Reading.**
  - Fixed "harder" variants do not hit harder; they only take the places of
    real moves. This agrees with the night's strength-seeking response step
    (−3.1): the strong options the compact sources miss are not a fixed
    step away from the moves they have.
  - All compact sources so far stall around −25 to −30, whether ranked by
    two readable quantities (−29.1) or by all 57 features (64
    representatives, −27.7).
- **The proposal slots.** The search tries `samples / 2` = 40 initial
  proposals per catch, shared in proportion among the sources. The
  archive's lookups ask for 16 + 16, which fit. The catalogue asks for 32
  beside memory's 16, so only about 24 of its moves are tried (about 18 on
  shaped families, which reserve a quarter for the generic sweep). This is
  why ranking matters, and why 128 styles could not help.

### All the catalogue's moves tried: −22.7, closer than the compact network

- **Change.** The 64 ranked styles are all offered: `policySamples: 64`,
  and `samples: 160` per catch, so 80 initial proposals
  (`exp/catalogue-64-all-tried`).
  - Physics frames +1%: the allowance caps the total, so this moves
    effort from depth to breadth rather than adding compute.
- **Control.** Main with the same `samples: 160` (`exp/main-samples-160`):
  **−1.1** [−5.9, +3.6], no effect. More initial slots do not help the
  archive, which already fits.
- **Result: −22.7** [−33.9, −11.4]; every seed block negative (−12.8 to
  −28.9); no ride lost; explicit requests −26.8; strong extra impacts 0.07
  per 100 beats (main 0.04).
  - Per category: G −36.7, P5 −35.7, P7 −31.0, P4 −27.0, P1 −23.6, P2
    −17.2, P3 −14.2, P6 +3.9.
  - By part (against main; compact network in brackets): strong beats too
    soft −10.4 (−12.0), speed −6.3 (−7.7), extra hits −3.1 (−0.9), timing
    −1.0 (−2.5), air −0.9 (+0.1).
- **128 ranked styles offered the same way: −25.1** [−37.4, −12.8]. About
  68 of the 128 fit in the slots; more moves crowd each other out. 64,
  all tried, is the best so far.
- **The extra hits sit in the shaped, guided families**: over 164 rides,
  terraces 653 hits (main 492) and serpentine 712 (main 358), all weak
  (under 0.3). A real move placed in a new situation likely brings a guide
  clearance the rider touches. About 2 points.
- **Reading.**
  - The readable catalogue's moves were good; most were never tried.
    Offered in full, a 5 × 5 table per family and side plus 64 real moves
    (25,647 numbers) beats the compact network, at the same physics cost.
  - That is within about 3 points of the owner's acceptable drop (about
    20).
  - The loss left is the shared one: strong beats on everyday songs, and
    speed.

### Where the all-tried catalogue still misses strong beats

`strong_catches.py` on an origins study of `exp/catalogue-64-all-tried`
(seed 101, 41 rides, tracks identical to its saved arm). The catalogue's
moves start 53% of committed arcs.

| arm | short by more than 0.2 | arrivals below 15° | short at 25–35° | short at main's headings |
|---|---|---|---|---|
| main | 8% | 6% | 6% | 8% |
| catalogue, all tried | 12% | **13%** | **7%** | 10% |
| compact network | 14% | 11% | 13% | 12% |

- **Conversion is nearly the archive's.** At the same arrival heading the
  catalogue's landing arcs hit almost as well as main's (7% short at
  25–35°, against 6%).
- **The setup is not.** It arrives shallow (below 15°) twice as often.
  The 175 strong beats only it misses arrive at 17° (main 35° on the same
  beats). A third of them land from the opposing side (main 13%).
- **Why.** The catalogue's table and ranking read only the beat the arc
  lands on. The arc before a strong beat must leave so that the rider
  arrives steep, and nothing tells the catalogue that the next beat is
  strong. The archive's distance weighs the next beats four times. The
  compiler's steep-arrival preference then has nothing steep to choose.
- **Next.** The table and the ranking gain a third readable axis: the next
  beat's requested strength (a 5 × 5 × 3 grid, trilinear). In-sample, the
  table then explains more of the exit (terraces 0.38 → 0.49, scallops
  0.51 → 0.61).

### Paired comparisons between catalogue versions, and variety

- **Paired, same seeds** (candidate against reference, V7.1, 4 seeds). The
  comparisons against main are about ±12 wide, too wide to separate
  catalogue versions, so these are compared directly:

  | change | paired difference |
  |---|---|
  | all 64 tried, against 64 ranked in the default slots | **+6.5** [+1.5, +11.4], every block positive |
  | 128 instead of 64, both all tried | −2.4 [−5.9, +1.0] |
  | next beat's strength as a third axis, against all tried | −5.3 [−14.2, +3.6] |

- **The next-beat axis** (`exp/catalogue-64-next`, 58,553 numbers): −28.0
  against main. Arrivals at strong beats below 15° fell only from 13% to
  10% (main 6%), and strong beats short by more than 0.2 stayed at 12%.
  The setup depends on the whole chain of arcs and on which candidates
  ranking keeps, not on one move's exit. Not kept; an open thread.
- **Variety of the drawn lines** (`move_variety.py`, saved arms, 164
  rides; unvalidated against the owner's eye):

  | arm | ratio (own ride / other songs) | distinct shapes per ride | recurring 3-arc motifs |
  |---|---|---|---|
  | main (archive) | 0.87 | 45.8 | 0.6% |
  | readable catalogue, all tried | 0.84 | 44.4 | 1.0% |
  | compact network | 0.85 | 43.9 | 0.6% |
  | none | 0.76 | 42.5 | 0.9% |

  Catalogue against main, paired by ride: ratio −0.03 [−0.05, −0.01],
  distinct shapes −1.3 [−2.0, −0.6]. A readable catalogue of 64 moves per
  family does not lock rides into repetition. It is within a few percent
  of the archive, and far from the no-archive arm.

### Chains of strong beats: why the catalogue's arrivals run shallow

- **Where.** 91% of the catalogue's shallow arrivals at strong beats (below
  15° where main arrives at 25° or more; 157 beats) follow another strong
  beat. 76% of strong beats do.
- **The loop.** In those chains the catalogue's arc before redirects hard
  (turn −18°, exit −18° relative to its arrival) to land its own strong
  beat. That leaves the rider flatter, and the next arrival is shallow.
  On the same beats main's arc before turns −7° with exit −2°. It still
  lands its beat, because its own arrival was steep (35° against 18°), and
  it leaves steep for the next. Main keeps the chain steep; the catalogue
  drifts shallow.
- **Proposals or choice?** `catch_outcomes.ts` on the all-tried catalogue
  (5.36 million candidates, tracks identical) and on main. Committed
  catches in strong chains, 1,478 each:

  | | main | catalogue |
  |---|---|---|
  | the pool holds a move that hits this beat within 0.1 and leaves the next arrival at 30° or steeper | 54% | 44% |
  | the committed move does both | 32% | 22% |
  | next arrival after the committed move, median | 31.0° | 27.3° |

  Mostly availability: such moves are scarcer in the catalogue's pools,
  and chosen a little less often when present.
- **What those moves look like** (main's pools; candidates that hit a
  strong beat within 0.1 with the next beat strong; medians relative to
  the arrival):

  | arrival | moves that hit and leave steep | moves that hit and leave flat |
  |---|---|---|
  | below 25° | **caught from above, then dived**: opposing side, turn +27°, exit +18°; next arrival 54° | redirect: turn −17°, exit −17°; next 14° |
  | 25–40° | **hit by the entry angle, then dived**: entry −17°, turn +10°, exit +6°; next 36° | redirect: turn −19°, exit −17°; next 20° |
  | 40° or more | redirect (turn −18°, exit −18°); next 36° | stronger redirect (exit −26°); next 26° |

  - A shallow rider in a strong chain is best caught on the underside of a
    line that sends them down: an upper-receiver catch.
  - At medium angles the line meets the rider flatter than they arrive,
    so the hit comes from the contact itself, and then turns down instead
    of redirecting up.
  - The catalogue's table says "redirect" for every strong ask, and its
    styles rarely carry a +10° turn.
- **Next: chain moves** (`exp/catalogue-chain-moves`). Per family, 16
  measured moves of exactly this kind: medoids of main's pool candidates
  that hit a strong beat within 0.1 and left the next strong arrival at
  30° or steeper, each with the arrival heading it was measured at.
  - In the arc families, a quarter to nearly half are caught from above.
  - When this beat and the next are strong, they are offered first,
    closest arrival heading first, within the same 64 proposals.
  - 26,799 numbers in all (50 KB).
- **Result: no gain.** Paired against the all-tried catalogue: −1.8
  [−4.6, +1.0]; explicit requests +4.6; strong extra impacts 0.13 against
  0.07 per 100 beats.
  - Arrivals at strong beats below 15°: 13% → 11% (main 6%). Short by more
    than 0.2: 12% → 11% (main 8%).
- **Reading.** Three readable patches on the setup have now been tried:
  aimed variants, a next-beat axis, and chain moves. None fixes the drift.
  The archive's steepness is a property of the whole chain from the
  start of the ride, held by every move being close to what worked in that
  exact state. Offering the right kind of move at one catch does not
  restore it. This thread is set aside; the setup costs the catalogue
  about 2 of its 4 extra points of strong beats short.

### The held-out panel: where the readable catalogue stands

- **Run.** The all-tried catalogue (`exp/catalogue-64-all-tried`) and the
  no-archive arm against main on the held-out panel (13 specs from songs
  never used in training, 4 seeds; `--panel=heldout --heldout`).
- **Result.**

  | | no archive | readable catalogue | share of the archive's worth recovered |
  |---|---|---|---|
  | V7.1 | −70.6 | −22.7 [−33.9, −11.4] | 68% |
  | held out | −75.3 [−89.1, −61.4] | **−30.3** [−38.7, −21.9] | 60% |

  - Held out: all 13 specs down for the catalogue (lowest −55.0,
    `no_batidao_selection`; highest −5.5); no ride lost; strong extra
    impacts 0.23 against 0.04 per 100 beats.
- **Reading.**
  - With 25,647 numbers (0.05% of the archive's size), a readable
    catalogue recovers about two thirds of what the archive is worth, on
    the benchmark and on new music.
  - On new music it stays beyond the owner's acceptable drop (about 20).
  - What is left is understood: strong beats on everyday songs (mostly the
    chain setup), speed, and extra hits on shaped guided families.
- **For the owner's eye:** a Catalogue Catch Sheet (artifact) shows every
  catch of eight rides, the archive against the catalogue under shuffled
  letters.

### Step back with the owner: does the catalogue escape the archive's issues?

- **The owner's question:** the goal was not a catalogue, but a solution
  free of the archive's issues. Did we fall into the same ones?
- **Answer (Claude):** partly.
  - It fixes size and git growth: 44 KB against 52 MB.
  - Its table is readable. Its 64 moves per family are copied real
    demonstrations: inspectable, not understood.
  - It does not fix the rest. It is distilled from the archive's
    demonstrations, so it inherits the same habits; improving it would
    mean retraining on the compiler's own rides, the same loop; and a new
    construction starts with nothing. It is a much smaller archive, not a
    different foundation.
- **The owner:** in practice the archive's tracks were already appreciated,
  so a valid worry is fine if, in practice, the result is fine. How it
  looks and behaves matters as much as the score. **Upper hits matter
  most.** Characterize the rider's behaviour: upper hits, slides, long
  ride-outs.
- **Agreed next.**
  1. A ride-character profile per version (below).
  2. Replace the copied moves with generated variation: the table's core
     plus a spread over the free parameters, no copied cases.

### Ride character: how the rider meets the track (report only)

- **Instrument.** `tools/research/ride_character.ts` replays each saved
  ride and classifies every collision.
  - **From above** (an upper hit): the touched line pushes the rider down.
    The engine (`line.rs`) gives a line the normal (−dy, dx)/length,
    negated when flipped, and pushes a colliding point against it. A push
    more than 0.2 downward counts, so near-vertical walls count as
    neither.
  - Also: guide lines, sled against body points, unbroken sled-contact
    runs (ride-outs), and flights.
  - Unvalidated against the owner's eye. An earlier version that compared
    positions was wrong (70% "from above"), because a colliding point sits
    on the line itself.
- **Result** (V7.1, saved arms, 164 rides each):

  | measure | main | catalogue | compact network | none |
  |---|---|---|---|---|
  | beats hit from above | 27.9% | 25.4% | 24.9% | 23.2% |
  | strong beats hit from above | 20.7% | 19.4% | 19.6% | 20.8% |
  | contact from above, s/min | 7.90 | 7.79 | 7.23 | 6.12 |
  | guide contact, s/min | 6.11 | 5.86 | 5.64 | 4.53 |
  | time with the sled on a line | 34.1% | 34.0% | 33.7% | 32.7% |
  | ride-outs of 1 s or more, s/min | 0.74 | 0.74 | 0.72 | 0.70 |
  | time in the air | 60.9% | 60.5% | 61.9% | 63.8% |
  | flights of 1 s or more, per min | 2.41 | 2.25 | 2.44 | 2.69 |
  | body contact, s/min | 16.1 | 16.2 | 15.3 | 13.3 |

  Paired by ride, catalogue against main: beats hit from above −2.5
  points [−3.2, −1.8]; strong beats from above −1.3 [−2.4, −0.1]; guide
  contact −0.25 s/min [−0.38, −0.10]; time in the air −0.5 points. Every
  other measure is within a fraction of main.
- **Reading.**
  - The catalogue keeps the rides' character, upper hits included, within
    a few percent.
  - Without the archive, rides lose upper hits and guide contact and fly
    more.
  - Ride-outs of a second or more are rare in every version (under 1 s per
    minute). Worth the owner's eye: long rides along a line hardly exist.

### Generated variation instead of copied moves

- **Form** (`exp/catalogue-generated`; 2,756 numbers, 9 KB). Per family:
  - the same core table per contact side;
  - the share of opposing-side catches per grid cell (smoothed);
  - every other parameter (the deviations of entry, turn and exit from the
    core, support/span, bias, offset, and the optional fields present in at
    least half of the demonstrations) as its observed range: 11
    quantiles.
  - Proposal k takes its side from the opposing share, then each parameter
    from an evenly spread sequence mapped through its quantiles. 64
    proposals, all offered. No demonstration is stored.
  - Every number reads as a range. For guided arcs, the turn deviates from
    the typical move by −25° to +36°, and the guide sits 8 to 22 px away.
    The opposing-side share is about a third at light asks, under a tenth
    at strong asks with steep arrivals.
- **Result: −51.6** [−67.6, −35.7] against main; paired against the copied
  catalogue −29.0 [−39.6, −18.3]. Body drag −26% (3.08 s/min); strong
  arrivals head-down or backward 12.3% against 10.2%.

  | source | against main | share of the archive's worth recovered |
  |---|---|---|
  | none | −70.6 | 0% |
  | generated, independent ranges | −51.6 | 27% |
  | catalogue, 64 copied moves | −22.7 | 68% |

- **Reading.** Copying real moves carries about 29 points. Sampled
  independently, the parameters lose their coherence: in a real move,
  turn, exit, length, easing and offset fit together. The correlations
  are strong and readable (guided arcs: the extra turn against the extra
  entry −0.67, the extra exit +0.51, turnFraction +0.46, support +0.40).
- **Next** (`exp/catalogue-generated-correlated`; 3,786 numbers, 12 KB).
  The same ranges, with the parameters varying together as their
  correlations say: normal scores combined through a correlation factor
  per family and side.
- **Result: −47.0** [−57.2, −36.7] against main; paired against the copied
  catalogue −24.3 [−33.7, −14.9]. Only 4.6 better than independent
  ranges. Body drag −23%; strong extra impacts 0.27 per 100 beats.

  | source | against main | share recovered |
  |---|---|---|
  | none | −70.6 | 0% |
  | generated, independent ranges | −51.6 | 27% |
  | generated, correlated | −47.0 | 33% |
  | catalogue, 64 copied moves, all tried | −22.7 | 68% |
  | (catalogue, 32 copied moves, fixed order, 40 slots) | −37.9 | 46% |

- **Reading.**
  - Real moves are worth far more than sampled ones. Even the plainest
    copied catalogue beats the best generated one.
  - What makes a real move good is not in its parameters' ranges, nor in
    how they vary pairwise. It is in specific joint combinations: a move
    that works is a coherent shape, and sampled combinations are often
    awkward (more extra hits, more head-down arrivals).
  - So "copying what worked" carries about 25 points that a readable
    statistical description cannot.
  - This answers the question the step back raised. Moves cannot simply be
    generated from statistics. Moves that work have to come from somewhere:
    stored real moves, or a model of what works.

## November 8: the archive is frozen; today's compiler is the baseline

- **Decision** (agreed with the owner).
  - Today's compiler, archive included, is the baseline.
  - The construction-policy archive is frozen: no more retrains. It stays
    committed, because compare and collection checkouts build every arm
    from git, and old commits must stay rebuildable. Keeping it only
    locally would break those checkouts and would not shrink the history
    already there.
  - `tests/policy_archive_frozen.test.ts` pins its fingerprint. The
    compiler already checks the file against that fingerprint when it
    loads it. Unfreezing needs the owner's decision and a deliberate edit
    of the pin.
  - The pooled archives (100 MB and more) stay on local branches only.
- **The owner's position.**
  - A drop of about 20 points (say 780 against 800) is significant but not
    the end of the world. A drop of 70 (the archive's worth) is
    unacceptable.
  - Such a drop could be worth taking for a much simpler compiler: more
    linear, not a black box, something that makes sense and can be
    improved.
- **Why not swap in the compact network now.** It costs 25 points as
  trained on the archive's data, and 22 at best after retraining. It is
  still a black box (5,361 numbers no one can read). It saves storage but
  does not give the readable foundation the owner asks for.
- **The way forward: reduce our reliance on the archive step by step.**
  - Readable mechanisms are added beside the archive. After each one, the
    no-archive comparison measures what the archive is still worth.
  - Once its worth is about 20 points or less, it can be removed.
  - Each attempt is bounded, about a day: a hypothesis stated in advance,
    one implementation, then two comparisons against main: the new mechanism
    with the archive, and the new mechanism without it. No implementation
    without the owner's go-ahead.
- **The design space is wide, and the options combine.**
  - Physics-aimed proposals: the redirect a strong hit needs, computed
    from arrival speed and the requested strength.
  - A concise learned model that proposes geometry.
  - Better refinement: proposals are only starting points, and local
    search finishes 97% of committed arcs.
  - A catalogue of geometries, each modifiable in specific ways.
  - These are not rivals of each other or of the archive; several can
    work together.
- **What they must cover** (from the studies below):
  - reliable hard hits on strong beats: landing arcs that redirect;
  - arrivals that stay steep enough;
  - several good alternatives per situation, since no single rule
    describes the archive's good catches.
- **Next.** A short design note for the owner: each approach made
  concrete, which part of the archive's work it would take over, how
  readable it is, and how the approaches fit together. The owner picks the
  first bounded attempt from it.

**Terms used in the November 8 entries.**

- **Main**: today's compiler, 813.5 on V7.1 at 4 seeds (813.8 at 8 seeds).
- **V7.1**: the benchmark suite: 35 specs plus 6 explicit requests, each
  compiled at several seeds. Its **headline** is the mean over strata (G,
  everyday songs; P1 to P7, one musical pattern each). Each stratum is the
  mean of its specs, and each spec the mean of its seeds. **Explicit
  requests** (E) are reported apart.
- **Arm**: one compiler version in a comparison. **Ride**: one spec at one
  seed. **Section**: one arc of a ride and the gap it opens.
- **Beat** j is the contact at the end of section j. It lands on arc j + 1,
  so that arc owns the beat's impact, while arc j sets the arrival.
- **The archive** (also: construction policies, policy archive): 79,778
  demonstrations, the committed controls of earlier compiles.
  - Two lookups read it, for each section after the first. The **policy
    lookup** gives 16 proposals from proximity trees. The **memory lookup**
    gives 16 from the nearest cases among the stored demonstrations and
    this ride's own earlier commits.
  - **Ride memory** means those earlier commits of the same ride. It needs
    no archive, so it keeps working in the no-archive arm.
  - The experimental arms that replace the lookups use their freed slots:
    32 proposals from one source.
- **The compact network**: a small model per construction group (5,361
  numbers, 18 KB). It maps the situation to a control, and 32 fixed
  "styles" spread proposals around it. It takes the policy lookup's place;
  variants are retrained on more data or have 32 outputs ("multiple
  choice").
- **Root source**: where a committed arc's first proposal came from,
  before refinement changed it.
- **Controls**: an arc's numbers (entry, turn, exit, support, bias,
  offset). Entry and exit are measured relative to the arriving heading.
- **Sled pose**: the sled's angle, positive nose-down. **Head down**: the
  rider's head below the sled at the strong hit.
- **Spread** is used in two senses, each stated where it is used: a unit
  (the standard deviation of a control over the committed arcs), and a
  variety measure (the mean distance between two random arcs of one
  family).

## November 8: plan, understand the candidates and measure variety before changing them

The owner's direction: no new candidate generator yet. Keep the archive
(it stays in production) and use it as an instrument for comparison and
analysis. First understand what each
candidate source does and why, and build the telemetry to see variety and
repetition. Every measure is report-only, never a target.

1. **The candidate pipeline, mapped with numbers.** Every source of a
   catch's starting pool:
   - the hand-made centre;
   - the generic sweep;
   - the two archive lookups;
   - within-compile memory and responses;
   - compact folds, opposing entries, recovery.
   Then local search and the learned estimate. For each source: tried,
   viable, frames, and (new, report-only, parity-checked) **which source the
   committed arc descends from**.
2. **Variety telemetry.** Today's measures are plan-level (the family drawn
   per phrase) and seed-to-seed (family and airtime differences). Nothing
   measures the shapes themselves. Needed:
   - repetition within a ride (how alike its arcs are; how many distinct
     moves it uses);
   - sameness across songs (whether different music gets the same moves);
   - both per family, and per arm: archive, none, compact.
   They stay unvalidated until compared with the owner's eye in a blind
   pairwise study.
3. **What the archive has learned.** Its most common moves, rare moves, and
   what it never shows, rendered so the owner can see what is being
   reapplied.
4. **Then decide** the candidate design together.

The self-training round on the compact model continues as a comparison
point.

**Where the plan stands** (end of November 8):

- Steps 1 and 2: done, below. Step 2 includes the owner's first look at
  the drawn catches.
- Step 3, rendering the archive's common, rare and missing moves, was not
  done. To the owner's eye the variety differences were small, so the work
  turned to what the archive's points are made of and how strong beats are
  caught (below).
- Step 4: the direction is decided (entry above: freeze the archive,
  then reduce reliance on it step by step). The candidate design itself is
  still to choose, from the design note.
- The self-training round: last below; its hypothesis was not confirmed.

### Step 1: where the committed arcs come from (report only)

- **Instrument.**
  - `scripts/v0/optimizer/arc_origin.ts` labels every proposal with its
    root source. Each refinement step appends its stage, and the label
    keeps a copy of the proposal as first made.
  - Labels are off unless a research tool enables them, and the compiler
    never reads one. `npm run check` passes (parity identical).
  - `tools/research/candidate_origins.ts` compiles V7.1 rides with labels
    on. All 41 rides (seed 101) are identical to main's saved arm.
- **Root source of the 3,508 committed arcs** (V7.1, seed 101, main):

  | source | share of initial proposals | share of committed arcs |
  |---|---|---|
  | archive, policy lookup | 33% | **46%** |
  | archive, memory's stored demonstrations | 33% (memory, both kinds) | **27%** |
  | memory, arcs committed earlier in this ride | (in the 33%) | 7% |
  | response proposals (this ride's response steps) | 8% | 17% |
  | generic sweep | 23% | **1%** |
  | hand-made centre | 2% | 1% |
  | warm start, opposing entries, recovery | — | 2% |

  - 73% of committed arcs start from an archive demonstration. Most of the
    rest (responses and this ride's own arcs) descend from earlier arcs of
    the same ride, which mostly started from the archive.
  - The generic sweep makes a quarter of the proposals and starts 1 arc in
    100.
  - The shares are the same in every family and every stratum. Transfer
    arcs (9) are the exception, starting from responses and this ride's
    memory.
- **Refinement.** 97% of committed arcs were refined after being proposed
  (53% coordinate then response steps, 27% coordinate, shape, then
  response). These are ARCHITECTURE.md's coordinate, guide and
  joint-response steps of local search. Refinement moved them a median 0.57 of the committed arcs'
  spread from their proposal (quartiles 0.36–0.85). The rare winners from
  the sweep moved 1.1.
- **Reading.** The archive chooses the neighbourhood and local search
  finishes the arc. A committed arc is not a copy of a demonstration; it
  starts near one. The sweep and the centre almost never win against them.

### Step 2, first reading: variety of the moves, with and without the archive (report only)

- **Measures** (each per family, then over the ride):
  - **ratio**: the median distance from an arc to the nearest arc of the
    same family in its own ride, divided by the same distance to as many
    arcs drawn from other songs. Below 1, a ride repeats itself more than
    songs differ from each other.
  - **distinct moves per ride**: 24 move clusters per family; how many a
    ride effectively uses.
  - **recurring 3-arc motifs**: the share of three-arc runs (as clusters)
    that occur more than once in the ride.
  - **spread**: the mean distance between two random arcs of one family,
    whole catalogue.
- **Instrument.** `tools/research/move_variety.py` reads one
  `candidate_origins.ts` study per arm (V7.1, seed 101, 41 rides, 3,508 arcs
  each).
  - A move is the six main controls relative to the arrival, standardized
    per family on the pooled arcs of all arms.
  - These are controls, not rendered shapes, and the measures are
    unvalidated: they are a first reading, to be checked by the owner's eye
    in a blind pairwise study.
- **Where the arcs start without the archive and with the compact model.**

  | root source of committed arcs | archive (main) | none | compact network |
  |---|---|---|---|
  | learned lookup (archive or network) | 46% | — | 45% |
  | archive's stored demonstrations | 27% | — | — |
  | this ride's earlier arcs (memory) | 7% | **44%** | 27% |
  | response proposals | 17% | 28% | 20% |
  | generic sweep | 1% | 18% | 2% |
  | hand-made centre, opposing entries, warm start, recovery | 3% | 10% | 6% |

  - Without the archive, the generic sweep is 59% of the tried proposals.
    It starts 18% of the arcs, and those need the most refinement (median
    1.0 spread, against 0.7 for memory).
  - Nearly three quarters of the arcs then start from this ride's own
    earlier arcs or their responses.
- **Variety.**

  | arm | spread | ratio (own ride / other songs) | distinct moves per ride | recurring 3-arc motifs |
  |---|---|---|---|---|
  | archive (main) | 3.25 | 0.94 | 48.4 | 0.5% |
  | none | 3.35 | **0.79** | **41.6** | **1.6%** |
  | compact network | 3.15 | 0.88 | 45.7 | 0.8% |

  Paired by spec against main (bootstrap over 41 specs, 95%):
  - **None.** The ratio is −0.16 (−0.19 to −0.12), lower in 95% of rides;
    6.0 fewer distinct moves per ride (−7.6 to −4.4); motifs +1.1 points
    (+0.4 to +2.0).
  - **Compact network.** The ratio is −0.05 (−0.09 to −0.02); 2.5 fewer
    moves (−4.0 to −1.0); motifs +0.3 (−0.4 to +1.2).
- **Reading.**
  - In control terms, the archive does not make a ride repeat itself; it is
    the other way round. Without it, a ride's arcs are much closer to each
    other than to other songs' arcs. A ride uses fewer distinct moves and
    repeats short sequences more, because the ride copies its own first
    successes.
  - On the training songs, 14% of the archive compiler's commits lie close
    to a stored demonstration (step-back entry below). Part of that is the
    compiler re-committing what it did on the same songs last round. Within
    a ride, the archive still gives the most varied repertoire of the three
    arms.
  - Across songs, main's ratio 0.94 means a ride's own arcs are almost as
    close to each other as to other songs'. Songs do not develop a vocabulary
    of their own. Whether that is a problem is a taste question.
  - The spread (whole-catalogue variety) barely differs between arms.
- **The drawn lines agree, more weakly** (the same tool on the saved compare
  arms: V7.1, 4 seeds, 164 rides, about 14,000 arcs each).
  - Here a move is the direction of the arc's main line (guides left out)
    at 16 points evenly spaced along it, in the world frame: the shape the
    eye sees, without its size.

  | arm | ratio (own ride / other songs) | distinct moves per ride | recurring 3-arc motifs | line length, median (quartiles) |
  |---|---|---|---|---|
  | archive (main) | 0.87 | 45.6 | 0.5% | 99 (71–139) |
  | none | 0.75 | 41.9 | 1.1% | 94 (69–129) |
  | compact network | 0.85 | 44.1 | 0.7% | 98 (70–136) |

  - **None against main**, paired by ride: ratio −0.10 (−0.13 to −0.08),
    lower in 79% of rides; 3.8 fewer distinct moves (−4.7 to −3.0); motifs
    +0.6 points (+0.3 to +1.0).
  - **Compact network against main**: ratio −0.02 (−0.05 to 0.00); 1.5
    fewer moves (−2.3 to −0.8); motifs not different.
  - **Per family** (ratio, main / none / network):
    - arcs unguided 0.88 / 0.81 / 0.86;
    - arcs 0.88 / 0.84 / 0.85;
    - terraces 0.91 / 0.84 / 0.85;
    - serpentine 0.89 / 0.76 / 0.89;
    - scallops 0.88 / 0.77 / 0.87;
    - fold 0.89 / 0.74 / 0.85;
    - scattered 0.72 / 0.76 / 0.79.

    Scattered is the one family where main repeats itself the most of the
    three arms, and the most of any family. In fold, none uses more distinct
    moves (6.2 against 5.7) while repeating itself more.
  - Even with the archive, a ride's drawn arcs are closer to each other
    (0.87) than to other songs' arcs. In shape terms there is some
    within-ride repetition everywhere; the archive reduces it.
- **First look by the owner's eye** (Catch Sheet page: every catch of 8
  rides, seed 101, main line and guides, three versions under shuffled
  letters).
  - "The differences are a bit subtle … maybe they're not so bad." The
    owner was unsure in each case.
  - Three rides looked at, briefly and unsure. The owner: no conclusion
    should be drawn from which versions were picked. What stands is that
    the variety differences are small to the eye.
  - The owner's own idea of repetition is broader than these measures: the
    same way of catching repeated many times in a ride (for instance, a long
    arc with an upper rail that controls the rider, then the catch), which
    spans several arcs and their guides.
- **Open.**
  - The shape descriptor is a choice (directions along the line, size
    apart), not a validated one.
  - The Catch Sheet's lookalike groups (main line and guides, size
    included) are the check: whether "close" here means "looks alike".
  - The page shows lines only, not the rider's motion through them.

### What the lost points are made of (report only)

- **Why.** The owner could accept about 20 points for a much simpler,
  readable candidate source, but not 70. Before designing one, find out what
  the archive's points buy.
- **Instrument.** `tools/research/loss_parts.py` reads saved compare arms
  (V7.1, 4 seeds, 164 rides, each against main).
  - It splits each ride's score difference over the grade's parts (air,
    speed, impact strength, timing, extra hits) at the midpoint loss. The
    remainder is under 2 points in every arm.
  - Rides combine as in the headline.
  - It also splits by the family of the arc that owns the gap, and splits
    impact strength by requested level and direction.
- **Result** (headline points against main):

  | arm | headline | strong beats too soft | rest of strength | speed | timing | extra hits | air |
  |---|---|---|---|---|---|---|---|
  | none | −70.6 | −23.7 | −6.7 | −16.0 | −10.0 | −5.0 | −7.4 |
  | 16 representatives | −38.6 | −15.5 | −3.8 | −7.9 | −3.5 | −5.7 | −1.9 |
  | 32 prototypes | −33.1 | −14.7 | −3.8 | −6.9 | −2.4 | −4.7 | −0.5 |
  | 64 representatives | −27.7 | −11.5 | −2.5 | −5.5 | −1.9 | −4.2 | −2.1 |
  | multiple-choice network | −25.9 | −11.9 | −1.0 | −7.5 | −1.8 | −2.4 | −1.4 |
  | network | −25.1 | −12.0 | −1.9 | −7.7 | −2.5 | −0.9 | +0.1 |
  | network, self-trained | −25.3 | −14.0 | −2.1 | −8.0 | −2.4 | +1.0 | +0.2 |
  | network, pooled | −22.2 | −12.6 | −1.3 | −7.0 | −2.2 | −0.8 | +2.1 |
  | memory lookup only | −8.0 | −3.4 | −0.7 | −2.5 | −0.8 | −0.9 | +0.1 |
  | policy lookup only | −6.7 | −3.8 | +1.4 | −3.3 | −1.1 | −0.8 | +0.8 |

  - Strong beats are those requested at 0.6 or more. Strong hits that are
    too hard, and quiet beats in either direction, cost under 1 point in
    every arm.
  - The everyday-song stratum (G) carries the most strength loss: −25 for
    the pooled network, against −4 to −8 for P1 to P3. The long ride (P6)
    gains air (+23) in the network arms.
  - Per family (air, speed and strength, pooled network): unguided arcs
    −7.8, arcs −3.4, fold −3.0, serpentine −2.0, terraces −1.8, scallops
    −1.0, scattered 0.0.
    - Corrected: a beat's strength now goes to arc j + 1, on which the
      rider lands. A first version gave it to the arc before.
- **Reading.**
  - The largest single part is **hitting strong beats hard enough**.
    - In the compact arms (representatives, prototypes, networks) it is 40%
      to 57% of the loss.
    - Gap speed adds 5.5 to 8.
    - With no archive at all, strong beats are 34% (23.7 of 70.6), and
      speed (16), timing (10) and everything else are lost too.
  - Timing costs 2 to 3.5 in the compact arms, against 10 with no archive.
  - Extra hits cost 4 to 6 with stored representatives or prototypes, and
    about 1 with the networks.
  - Air is small everywhere except with no archive.
  - So a readable candidate source does not need to know everything the
    archive knows. Above all it needs to catch strong beats well; the next
    study shows what that takes.

### How the strong beats are caught (report only)

- **Instrument.** `tools/research/strong_catches.py` joins the
  `candidate_origins.ts` studies (committed controls, situation, sources)
  with the saved arms' per-beat strength. Tracks are identical.
  - Beat j is the landing on arc j + 1; arc j sets the arrival.
  - Seed 101, 41 rides; main, compact network, none.
- **Strong beats are the norm.** 1,948 of 3,508 beats are requested at 0.6
  or more (mean 0.75). Every arm undershoots them: median achieved 0.67
  (main), 0.65 (network), 0.64 (none).
  - The difference is the tail. Short by more than 0.2: 8%, 14%, 17%.
- **What a short strong hit looks like** (paired beat by beat, main against
  network; the same picture whichever arm fails):

  | strong beats (medians) | arrival heading (descending) | sled pose | landing arc turn | head down |
  |---|---|---|---|---|
  | both hit (1,586) | 32–35° | 22–24° | −16 to −17° | 11% |
  | only the network short (205): network | 21° | 39° | −4° | 26% |
  | the same 205 beats: main | 35° | 28° | −17° | 16% |
  | only main short (89): main | 21° | 50° | +5° | 27% |
  | the same 89 beats: network | 33° | 27° | −16° | 15% |

  - The landing arc's turn is its control (negative: it redirects the
    rider upward). Its exit relative to the arrival tells the same story:
    −19° for main against +3° for the network on the 205 beats.

  - The failure: a shallow arrival with the sled pitched nose-down, then a
    landing arc that does not redirect the rider.
  - On those 205 beats, the arc before has no systematic difference in its
    own controls. The paired median differences are 1–4°, against
    11–15° of ordinary scatter. The shallow arrival comes from the ride's
    history.
- **Setup against conversion** (arrival heading bands; share of strong
  beats, then share short):

  | arm | below 15° | 15–25° | 25–35° | 35–45° | 45° and more | short, all |
  |---|---|---|---|---|---|---|
  | main | 6%, 32% | 24%, 15% | 23%, 6% | 21%, 3% | 26%, 2% | 8% |
  | network | 11%, 41% | 27%, 15% | 21%, 13% | 17%, 8% | 24%, 5% | 14% |
  | none | 11%, 44% | 27%, 21% | 24%, 12% | 16%, 9% | 23%, 9% | 17% |

  - The archive does both: fewer shallow arrivals, and better conversion at
    every heading.
  - The network is short on 14% of strong beats, main on 8%. With main's
    mix of arrival headings and its own short rate per heading, the network
    would be short on 12%. So 4 of its 6 extra points are conversion at the
    landing arc, and 2 are the arrival setup.
- **Is there a straight-line recipe?** Main's landing controls on beats hit
  within 0.1 of the request, fitted from named inputs:
  - from requested strength, arrival heading and speed: R² 0.15 to 0.16
    for entry, turn and exit;
  - adding pose and the durations and impact of the contacts around it:
    R² 0.17 to 0.22.
  - Good catches of the same situation come in many forms. No single
    control per situation describes them: one rule per situation would
    land where the compact network already is.
- **Reading.**
  - What the archive's points buy is reliable strong hits. It has many good
    alternative landing arcs to start local search from, and arrivals that
    stay steep.
  - A readable replacement would need either several alternatives per
    situation (as the archive has) or a way to aim the landing arc at the
    requested strength directly. The impact is the heading turn times
    arrival speed (November 7), so the redirect a strong hit needs can be
    computed rather than learned. That would be a physics-aimed generator:
    a design option for the owner, not implemented.
  - Arrival steepness is a ride-level budget: a ride that has run shallow
    cannot make the next strong hit hard. The compiler already prefers a
    steep arrival in the catch before a strong ask (the search profile in
    ARCHITECTURE.md). These shallow arrivals happen despite it.

### The compact model's self-training round: hypothesis not confirmed

- **Setup.** The network compiler (717f0d64) was collected on the training
  songs (840 compiles, 5 seeds). The network was then retrained on that
  collection alone ("self"), and pooled with the archive's demonstrations
  ("pooled"). V7.1, 4 seeds, against main at 813.5.
- **Result.**

  | arm | stored | V7.1 | 95% interval | explicit requests |
  |---|---|---|---|---|
  | compact network (archive data) | 18 KB | −25.1 | −31.1 to −19.2 | −26.0 |
  | retrained on its own collection | 15 KB | −25.3 | −36.5 to −14.1 | −22.1 |
  | retrained, pooled | 20 KB | −22.2 | −27.4 to −16.9 | −23.8 |

  - No ride lost in any arm, and physics frames are unchanged.
  - Body drag (reported only) is lower: 3.2 and 3.5 s/min against 4.2.
  - Strong extra impacts are higher: 0.12 and 0.13 per 100 beats against
    0.04.
- **Reading.**
  - The hypothesis (pooled gains 5 to 10) is not confirmed. The pooled
    retrain gains 2.9, about at the noise level, and self-training alone
    gains nothing.
  - A 5k-number network trained on more of the same demonstrations does
    not close the gap. The missing 22–25 points are not a data-count
    problem for this model.
  - The archive's earlier retraining gains came from adding
    demonstrations: more stored cases, so a closer neighbour for each new
    situation (November 8, morning: an equal-size mix gained nothing). The
    compact network stores no cases, so it cannot gain that way.

## November 8: step back on the policy archive, what it is worth

- **Why.** The owner does not want a 50–100 MB archive that grows git
  history with every retrain. A learned proposal source should be a few
  kilobytes, built on an understanding of which features drive it. The
  pooled archive stays off main; no archive is committed until this is
  understood. (Settled later the same day: the archive is frozen as it is;
  see the entry at the top.)
- **What the archive is.** 79,778 demonstrations (the committed controls of
  fulfilled sections on 838 training compiles, plus two earlier
  transfer-layout collections). In production two lookups read
  them for each section after the first: 16 policy proposals (neighbours
  under 32 proximity trees) and 16 memory proposals (plain feature
  distance, over the demonstrations and what the compile itself commits). Every proposal is simulated and ranked;
  the archive only suggests.
- **Results at a glance** (V7.1, 4 seeds, against main 9d065738, in the
  order run; the size table further down gathers them):
  - no archive −70.6, a much larger loss than the hypothesis (−15 to −40);
  - memory lookup only −8.0 and policy lookup only −6.7: the hypothesis
    (each keeps most of the worth) confirmed;
  - 64 and 16 representatives −27.7 and −38.6: refuted;
  - 32 control prototypes −33.1: inside the hypothesis;
  - compact network −25.1: inside the hypothesis, at its edge;
  - multiple-choice network −25.9: refuted.
- **First measurements** (V7.1, 4 seeds, against main 9d065738):
  1. **No archive.** Neither lookup reads demonstrations; their slots go to
     generic samples. Memory still learns within the compile. On October 4
     this was "slightly worse"; three retrains since gained +15.5, +8.3 and
     +2.0. **Hypothesis:** a clear loss, −15 to −40.
  2. **Memory lookup only** (no policy proposals) and
  3. **Policy lookup only** (memory starts empty). Both read the same
     demonstrations. **Hypothesis:** each keeps most of the worth, because
     they are redundant.
- **Offline, alongside:** which of the 57 situation features predict the
  committed controls, and how much of the controls' spread a handful of
  prototypes per construction group covers.
- **Offline result** (5 contiguous folds, so one ride's catches do not leak;
  six main controls, standardized; the six groups with ≥ 5,000
  demonstrations):
  - The controls are only about half predictable from the situation: trees
    on all 57 features explain 0.40–0.56 of their spread (entry, exit and
    support 0.4–0.75; bias and offset 0.1–0.3). A linear fit explains
    0.27–0.44.
  - The 12 most important features give nearly all of it (0.39–0.52). They
    are what is asked next (impact, air and duration of the next two catches)
    and the body's vertical velocities (which restate the arrival velocity).
    Body positions and most of the 40 body numbers add little.
  - Without any situation, 16 prototypes per group cover 0.70 of the spread
    and 64 cover 0.84.
- **Result, no archive: −70.6** [−82.4, −58.7]; 34 of 35 specs down, every
  category down (P4 −88.7, P7 −87.0, G −79.2), explicit requests −50.8. No
  ride lost; frames unchanged. Body drag halves (2.14 against 4.16 s/min),
  so the demonstrations are also where today's drag comes from. Strong extra
  impacts ×6. The archive carries a large part of the compiler's quality.
- **Result, memory lookup only: −8.0** [−15.2, −0.9]; 6 of 35 specs up,
  every category down. Memory alone keeps about 89% of the archive's worth.
  The policy lookup adds the rest, so the two are not fully redundant.
- **Next: representative demonstrations** (V7.1, 4 seeds, against main).
  Each group's demonstrations are clustered in the joint space of situation
  (weighted as the memory distance weighs it) and control. The real
  demonstration nearest each centre is kept, at 4 significant digits, and
  the proximity trees are retrained on what is kept. Both lookups run as
  today.
  - **64 per group:** 493 demonstrations, 147 KB (0.6% of the rows).
  - **16 per group:** 157 demonstrations, 43 KB.
  - **Hypothesis.** The archive's worth is "the right region of control
    space for this situation", not the density of 80k rows. Then 64 per group
    keeps most of the 70 points (within −10) and 16 per group keeps more than
    half. A steep loss at 64 would mean precise local neighbours matter, and
    a compact replacement has to interpolate rather than retrieve.
- **Result: refuted.**
  - 64 per group: **−27.7** [−39.3, −16.2]; 0 of 35 specs up; explicit
    requests −28.1; strong extra impacts ×3. Keeps 61% of the archive's
    worth.
  - 16 per group: **−38.6** [−52.8, −24.3]; 1 of 35 up. Keeps 45%.
  - No ride lost; frames unchanged; body drag unchanged at 64 and −11% at
    16.
- **Reading.** Even well-chosen prototypes lose 40% of the worth: a close
  neighbour matters. The archive works as a cache of solved situations: 838
  compiles of search, distilled. A cache needs coverage, so its worth grows
  with its size (as the smaller-archive test of November 7 found). A compact replacement must
  *interpolate*: map the situation to controls, rather than look up the
  nearest stored case.
- **Offline coverage test** (a guide, not a decision). For held-out
  demonstrations (the last 20% of each group, from other compiles): how
  close does the nearest of 16 proposals come to the committed control (six
  main fields, standardized)?

  | proposal source | closest (mean of 6 groups) | benchmark |
  |---|---|---|
  | full archive | 0.874 | 0 |
  | random 62% of it | 0.907 | −5.3 (the 49k archive of November 7) |
  | 64 representatives per group | 1.167 | −27.7 |
  | 16 representatives per group | 1.367 | −38.6 |
  | 16 control prototypes, situation ignored | 1.239 | |
  | linear mean + 16 residual prototypes | 1.125 | |
  | small network mean + 16 residual prototypes | 1.057 | |
  | trees mean + 16 residual prototypes | 1.046 | |

  - It orders the four benchmarked retrieval variants correctly.
  - It favours retrieval by construction: the committed controls grew out
    of the archive's own proposals and the local search around them.
- **Next: control prototypes** (V7.1, 4 seeds). 32 per group: the real
  demonstration nearest each k-means centre of the relative controls,
  situation ignored. 3,684 numbers, 17 KB as stored (a dedicated format
  would be a few KB). The memory lookup offers all 32 in its freed slots (it learns within the
  compile as today); no policy lookup.
  - **Question.** How much of the 70 points is knowing *where* good controls
    lie, independent of the situation?
  - **Hypothesis** (from the coverage test): about half, so −25 to −45.
    Much better would mean the generic sampler's box, not the situation, is
    what the archive fixes.
- **Result, policy lookup only: −6.7** [−12.5, −1.0]; 12 of 35 up; P7
  −19.3, P1 −16.6. With memory only at −8.0, either lookup alone keeps about
  90% of the worth: the two are mostly redundant, each adding 7–8 points.
- **Next: compact network proposals** (V7.1, 4 seeds). One small model per
  construction group:
  - A one-layer network (16 units) maps the 12 most important situation
    features to the six relative main controls.
  - 32 residual styles (k-means of the training residuals) spread the
    proposals around that mean. Each style carries the optional fields
    (bend, clearance…) of the real demonstration nearest its centre.
  - Groups under 1,000 demonstrations (transfer) get the mean only, plus
    styles.
  - 5,361 numbers in all, 18 KB as stored.
  - Runtime: 15 lines in `arc_control_policy.ts`. The model offers 32
    proposals in the freed slots; memory learns within the compile only, as in the
    no-archive arm. Coverage 0.975 against 0.746 (full) and 1.073
    (prototypes) at 32 proposals.
  - **Hypothesis:** −15 to −25, at least 5 better than the prototypes. That
    would show that interpolating the situation works, and the gap left is
    what to close next.
- **Results:**
  - **Control prototypes: −33.1** [−46.5, −19.8]; 1 of 35 up; explicit
    requests −41.9; body drag −17%.
  - **Compact network: −25.1** [−31.1, −19.2]; 2 of 35 up; explicit
    requests −26.0; body drag −21%; strong extra impacts ×3.5; no ride lost;
    frames unchanged. Inside the hypothesis (at its edge), 8 better than
    the prototypes. The coverage test had predicted about −22.

  | proposal source | size | V7.1 |
  |---|---|---|
  | archive (both lookups) | 52 MB | 0 |
  | policy lookup only | 52 MB | −6.7 |
  | memory lookup only | 52 MB | −8.0 |
  | compact network | 18 KB | −25.1 |
  | 64 representatives per group | 147 KB | −27.7 |
  | 32 control prototypes | 17 KB | −33.1 |
  | 16 representatives per group | 43 KB | −38.6 |
  | none (generic samples only) | 0 | −70.6 |

- **Reading.**
  - About half of the archive's worth is knowing where good controls lie
    at all (prototypes recover 37 of 70 points). The generic sampler's box
    is far from them.
  - Mapping the situation to controls adds 8 more, with 5k numbers.
  - The remaining 25 points are what nearest neighbours in 80k rows still
    give.
- **Next: the compact model learns from its own compiler.** Collect on the
  network compiler (benchmark/v4 training songs, 5 seeds), then retrain the
  network on that collection, alone and pooled with the archive's
  demonstrations. The data stays in `generated/`; only the model is
  committed.
  - **Hypothesis:** each round of self-training closes part of the gap, as
    retraining always has for the archive. A pooled retrain gains 5–10
    over −25.1. (Result in the plan entry above: not confirmed, +2.9.)
- **Alongside: multiple-choice proposals** (V7.1, 4 seeds, the archive's
  data).
  - **Why.** The fixed residual styles spread every situation the same way.
    Here one network per group (16 units, all 57 features) has 32 heads. Each
    demonstration trains only the head closest to it (5% shared among the
    others, so no head dies). The heads therefore learn situation-dependent
    alternatives: the quantity the coverage test measures.
  - Each head carries the optional fields of the real demonstration it fits
    best among those it wins. Small transfer groups get constant heads.
  - 27,947 numbers, 83 KB as stored. Runtime: the same 15 lines, reading a
    head instead of a residual.
  - **Offline coverage:** 0.853 (network + styles 0.975, full 0.746).
  - **Hypothesis:** −8 to −16; clearly better than −25.1. If so, the
    remaining gap is under a fifth of the archive's worth, and the size
    can be cut further (one network shared by all groups).
- **Result: refuted.** −25.9 [−36.1, −15.8]; 0 of 35 specs up; explicit
  requests −27.3; body drag −19%. Equal to the simpler network (−25.1).
- **Reading.** The coverage test ordered the retrieval variants but fails
  across model kinds. Coming closer to the committed six main controls is
  not what makes a proposal useful. Candidates for what retrieval gives that
  a learned map does not:
  - a coherent complete control (the optional fields come from the same
    case);
  - physical viability (a neighbour's control worked in a nearly identical
    state);
  - the committed controls' fine detail, which local search then needs
    less effort to reach.
  The per-source viability of initial proposals separates the first two.
  It is not in the saved rides, so it is measured next on four cases per
  arm.
- **Viability of initial proposals** (four V7.1 cases, seed 101, compiled
  in-process per arm; the learned source is the policy lookup or the
  compact model):

  | arm | learned: tried, viable | memory: tried, viable | generic: tried, viable |
  |---|---|---|---|
  | archive | 43,600, 48% | 43,322, 49% | 30,208, 35% |
  | compact network | 72,112, 43% | 30,480, 45% | 15,476, 13% |
  | multiple-choice | 71,530, 51% | 29,887, 48% | 15,358, 14% |
  | control prototypes | n/a | 86,719, 46% | 29,172, 35% |
  | none | n/a | 38,892, 44% | 75,177, 33% |

  Viability is not the difference: the multiple-choice proposals are viable
  more often than the archive's and still score lower. The learned proposals
  are physically fine; what they lack is quality among the viable ones, or
  the fit with the rest of a compiler co-adapted with the archive (the
  learned estimate and the priors were all tuned with it in place).
- **Where the archive enters.** One place: the starting pool of each
  catch after the first (`proposeInitialControls`), through its two lookups.
  Local search, ranking, the learned estimate and the priors never read it.
  The memory's within-compile learning (this ride's own commits and
  responses) is separate and needs no archive.
- **Does it make the compiler repeat itself?** (report only)
  - *Near-copies.* For committed controls on the training songs, take the
    16 demonstrations nearest in situation and find the closest control
    (standardized six main controls):
    - archive compiler (`collect-policies-today`): median 0.58; 5% within
      0.10, 14% within 0.25, 41% within 0.5;
    - compact-network compiler (`collect-network`, 355 compiles so far):
      median 1.07; 0%, 1%, 8%.
    - Random demonstrations: median 1.5.
    - Caveat: the archive holds the previous compiler's commits on these
      same training songs, so part of this is the compiler re-committing
      what it did there last round.
  - *Seed-to-seed variety.* Airtime differs between random starts by 0.032
    per gap with the archive, 0.045 without it, and 0.035–0.037 with the
    compact sources.
  - *Habits are reinforced.* Body drag is 4.16 s/min with the archive and
    2.14 without; it rose 14% at the last retrain. Demonstrations are only
    the compiler's own commits, so each retrain teaches the compiler what it
    already does, good habits and incidental ones alike.
  - *Novelty starts behind.* A new construction has no demonstrations until
    it is used, and competes with 80k proven ones.

## November 8 (morning): hypothesis, an equal-size mix of both collections

- **Question.** Did the pooled policies gain because of the doubled
  demonstration count, or because they mix two compiler versions?
- **Data.** Seeds 101, 303 and 505 of the first collection (6e815a57),
  seeds 202 and 404 of the second (9d065738), plus the transfer
  collections: 900 sources, 80,029 demonstrations, 52.3 MB. That matches
  main (79,778, 52 MB).
- **Hypothesis.**
  - If the mix itself helps, a gain over main at equal size, adoptable
    within today's storage.
  - If only count matters, null.
- **Result (V7.1, 4 seeds): null; not adopted.**
  - −1.7 [−9.0, +5.7], 0.26; 18 of 35 specs up.
  - P7 −21.6, one fragile ride-out ride −126.8.
- **Reading.** The pooled gain comes from demonstration count, not from
  mixing compilers. More demonstrations therefore need more storage: the
  owner's decision. (Settled later the same day: no more storage; the
  archive is frozen.)

## November 8 (morning): summary of November 7 and the night

**Where main stands** (9d065738, against the morning main 72e6ed9a, from
saved rides):

| panel | morning | now | change |
|---|---|---|---|
| V7.1, 8 seeds | 786.0 | **813.8** | **+27.8**; 34 of 35 specs up; every category up (G +41.9, P4 +42.1, P7 +28.7, P1 +28.0) |
| held out, 11 songs | 712.0 | **767.1** | **+55.1**; 13 of 13 specs up |

No ride lost; physics frames unchanged.

**Adopted on November 7, in order:**
1. **No forced flight before a catch:** V7.1 +5.1, held out +33.6.
2. **Half-weight prediction in ranking:** V7.1 +6.2, held out +2.9.
3. **Local search judges like ranking:** V7.1 +8.3, held out +5.7.
4. **Construction policies from today's compiler:** V7.1 +8.3, held out
   +12.8.

Also: a candidate too long for its section's ids is rejected, not fatal (a
latent crash on two training cases).

**For the owner to decide:**
- **Pooled policies** (both of today's collections): V7.1 +2.0 [−1.0, +5.0]
  at 8 seeds, held out **+8.9 [+1.7, +16.0]**, 11 of 13 up.
  - It needs a 75.5 MB brotli archive (100.2 MB as gzip, over GitHub's
    limit).
  - Ready on local branch `exp/policies-pooled-brotli`, verified to give
    identical rides.
  - Storage options: accept the size in git, use git LFS, or keep archives
    outside git with a fetch step. Demonstrations dominate the size (121 of
    130 MB raw), so encoding gains are small.
  - An equal-size mix of both collections is null (−1.7): the gain is the
    count.
- **Ending refinement:** worth −0.2 if removed (uniform, 1% of frames).
  Delete for leanness, or keep.
- **Body drag** rose about 14% with today's policies. It is an unvalidated
  proxy, reported only; the review pages show the rides.

**Tested overnight and not adopted** (each stated before running, on the
benchmark):
- second-round policies +1.3 (8 seeds);
- a smaller archive −5.3 (demonstration count matters);
- twice the policy proposals +0.7 (the first attempt changed a value
  production overrides);
- a generic reserve on ordinary arcs +1.0;
- a smaller reserve on shaped constructions +1.3;
- policies with forced-family demonstrations +0.8;
- 64 proximity trees −2.4;
- strength-seeking response steps −3.1;
- two retrained learned estimates −3.6 and −0.1;
- twice the allowance −2.7 (compute does not limit).

**What the evidence says now.**
- The largest share of strength loss is proposal coverage: no candidate
  near the ask was ever proposed (39% on the library songs).
- Ranking and search effort are not the limit.
- The policies are the lever: learned from the current compiler, with as
  many demonstrations as storage allows.

## November 8 (night): measurement, the ending refinement on today's main

- **Question.** On the November 1 compiler, removing the ending refinement
  (R0) cost −0.2, uniform across specs; its deletion waits for the owner.
  The compiler has changed since. What is it worth today?
- **Run.** `refineAttempts: 0` (no refinement; `arc_motion.ts` skips the
  stage) against main, V7.1, 4 seeds. This is information for the owner's
  decision, not a change to adopt.
- **Hypothesis.** About the same as before: a small loss, uniform.
- **Result.**
  - −0.2 [−0.4, −0.0]; 0 of 35 specs up, 26 slightly down (lowest −1.0),
    9 unchanged.
  - The refinement costs 1% of physics frames.
  - Unchanged since November 1: it is worth a fraction of a point. Keeping
    or deleting it stays the owner's call; nothing changed.

## November 8 (night): hypothesis, strength-seeking response steps

- **Basis.** The largest share of strength loss (39% on G) is "no
  candidate in the pool meaningfully closer to the ask". Local search's
  response step moves the best candidate by a damped Gauss–Newton step that
  balances every residual at once, so candidates that trade other errors
  for strength are rarely proposed. Ranking would still judge them on
  everything.
- **Change** (`arc_local_search.ts`, response search). Each round also
  evaluates two candidates along the minimal-norm step that cancels only the
  strength residual, using the Jacobian the round already measured: the full
  step and half of it. They count toward the round's allowance; nothing
  else changes.
- **Hypothesis.** Pools hold more candidates near the asked strength;
  ranking takes them where they pay. Strength on strong asks up; V7.1 up.
- **Risk.** Fewer balanced response rounds; span errors and extras may
  rise.
- **Result (V7.1, 4 seeds): not adopted.**
  - −3.1 [−4.0, −2.1], < 0.01; every block negative; 13 of 35 specs up.
  - P1 −15.4; strong extra impacts +145%.
  - Pushing the same shapes toward strength along the measured Jacobian
    spends response work badly. The missing strong options are not one
    linear step away.

## November 8 (night): hypothesis, policies with every family on paired rails

- **Basis.** Proposal coverage is now the largest share of strength loss
  (39% on G). Demonstration count matters, and a second round of the same
  cases saturates.
- **Data.**
  - The adopted policies' data (today's first collection plus the transfer
    collections).
  - Plus a new collection, `--catalog=v6paired`: explicit V6 plans for each
    family (single, arcs, fold, serpentine, scallops, terraces, scattered)
    on paired rails, on non-evaluation music, 4 plans each. 280 compiles on
    main (worktree 6ee6f0f52db8, structurally identical to main), 26,879 probes.
  - 90,870 demonstrations (main: 79,778); 59.0 MB as gzip.
- **Hypothesis.** Demonstrations of every family across varied music widen
  what gets proposed: strength on strong asks up, V7.1 up, held out up.
- **Risk.** Explicit-family plans differ from automatic plans; their
  demonstrations may pull proposals toward forced shapes.
- **Result (V7.1, 4 seeds): not adopted.**
  - +0.8 [−5.8, +7.4], 0.63; 15 of 35 specs up.
  - Strong extra impacts double; explicit requests −3.1.
  - Demonstrations of forced family plans do not widen the proposals that
    matter.

## November 8 (night): hypothesis, finer policy neighbourhoods (64 trees)

- **Basis.** The policies propose by nearest-exemplar retrieval through
  proximity forests (32 trees, leaf 4, from the archived trainer). More
  trees give a finer, steadier similarity between the current situation
  and past demonstrations.
- **Change.** The adopted policies retrained on the same demonstrations
  with 64 trees (`--trees=64`); nothing else.
- **Hypothesis.** Better-matched proposals, so less "no candidate closer to
  the ask"; V7.1 up.
- **Risk.** A larger archive; finer neighbourhoods may overfit to single
  demonstrations.
- **Result (V7.1, 4 seeds): not adopted.**
  - −2.4 [−8.0, +3.1], 0.13; 14 of 35 specs up.
  - P4 −6.8, P5 −6.7, P1 −6.0.
  - The archived trainer's 32 trees stand.

## November 8 (night): why strong catches miss, re-measured on today's main

`loss_attribution.ts` on main 9d065738 (V7.1, seed 101, 3,448 catches),
against November 7 afternoon (before half-weight prediction, local search
judging like ranking, and today's policies). Shares of the squared strength
error on the library songs (G):

| cause | Nov 7 afternoon | now |
|---|---|---|
| no candidate in the pool meaningfully closer to the ask | 29% | **39%** |
| a closer candidate was cheaper here; the next catch would pay | 32% | 21% |
| a closer candidate cost this span: speed | 21% | 24% |
| other span costs (air, extra, timing, rest) | 18% | 15% |

- **The ranking changes did what they meant to.** The "next catch would
  pay" share fell by a third.
- **The largest share is now proposal coverage:** the strong catch was never
  proposed. This fits the night's other results:
  - policies are the lever (+8.3 / +12.8; demonstration count matters);
  - more search effort is not (twice the allowance −2.7; twice the policy
    proposals +0.7).
- **Next:** demonstrations that cover more situations (a V6 collection of
  every family on paired rails is running), rather than more of the same.

## November 8 (night): hypothesis, a smaller generic reserve on shaped constructions

- **Basis.** `arc_proposals.ts` reserves 25% of the initial proposals for
  generic samples on novel constructors (a profile, or the transfer layout),
  because "the inherited model already covers ordinary arcs" and not these.
  Today's policies hold 6–9k demonstrations per shaped group (fold 6,252,
  scallops 8,965, serpentine 7,480, terraces 8,265).
- **Change.** The reserve on novel constructors goes from 25% to 10%;
  ordinary arcs keep none.
- **Hypothesis.** The policies now cover these constructors, so the
  reserve spends slots generic samples use less well: shaped sections, and
  explicit requests, up.
- **Risk.** Transfer layouts hold few demonstrations (about 600) and may
  lose.
- **Result (V7.1, 4 seeds): not adopted.**
  - +1.3 [−2.6, +5.1], 0.81; 15 of 35 specs up.
  - The gain sits in the single long-float spec (P6 +19.0); P4 −5.8,
    P1 −5.6, P5 −5.5; explicit requests −2.8.
  - The reserve is not what limits shaped sections.

## November 8 (night): pooled policies pass, held for the owner's storage decision

**Settled later on November 8: not merged.** The archive is frozen as it is
(entry at the top); `exp/policies-pooled-brotli` stays a local branch.

| panel | change | interval / support |
|---|---|---|
| V7.1, 8 seeds | +2.0 | [−1.0, +5.0], 0.92; 26 of 35 specs up (G +7.4, P6 +7.2) |
| held out, 11 songs | **+8.9** | [+1.7, +16.0], 0.99; **11 of 13 specs up**; all 4 blocks positive |

- No ride lost.
- **Costs.**
  - Body drag +4% (V7.1) and +1% (held out).
  - Strong extra impacts −33% on V7.1, +77% held out (0.08 against 0.04
    per 100 beats).
- By the bar used for today's adoptions this passes. Its only cost is the
  archive: 156,009 demonstrations, 100.2 MB as gzip (over GitHub's file
  limit), 75.5 MB as brotli.
- **Ready, not merged.**
  - Local branch `exp/policies-pooled-brotli` holds the brotli archive on
    top of the brotli-capable loader.
  - It reproduces the benchmarked gzip rides exactly (6 specs compared,
    every ride identical).
  - Merging needs the owner's word: about 75 MB added to the repository
    history for good.
  - On merge: refresh parity, `npm run check`, then set the `main`
    reference.

## November 8 (night): diagnostic, today's main at twice the allowance

- **Question.** Before today's changes, twice the allowance bought +0.1:
  the search was not limited by compute. Ranking now trusts measurement
  more, local search judges like ranking, and the policies come from
  today's compiler. Is it still unlimited?
- **Run.** The same commit (main 9d065738) at `standard*2` against
  `standard`, V7.1, 4 seeds. Not a candidate for adoption: compute is a
  cost. It tells where to work next.
- **Reading plan.**
  - A clear gain means search effort pays again, and the budget laws
    (scale-free, per the owner's rule) are worth revisiting.
  - A null means proposals, not effort, still limit.
- **Result: no gain from compute.**
  - −2.7 [−6.8, +1.3], 0.06; 16 of 35 specs up; +3% physics frames.
  - The search is still not limited by compute. Proposals (what is tried)
    limit it, as the policy results tonight show. Budget work stays off the
    list.

## November 8 (night): the policy archive may be brotli-encoded

- `parseArcPolicyArtifact` (`connected_arcs.ts`) reads a `brotli-file`
  companion (`.br`) as well as `gzip-file` (`.gz`). Both checksums
  (compressed and raw) are verified as before, so the encoding cannot
  change the model.
- The current archive re-encoded in brotli loads to an identical model
  (same hash).
- **Structural:** parity unchanged, `npm run check` passes. New test:
  `arc_policy_archive`.
- **Why.** Brotli is 24% smaller than gzip on these archives (39.6 MB
  against 52 MB for the current one). The pooled policies (+2.0 on V7.1,
  +8.9 held out; next entry) need 100.2 MB as gzip, over GitHub's file
  limit, and about 79 MB as brotli.

## November 8 (night): hypothesis, a learned estimate matched to today's policies

- **Data.** The second collection (main 9d065738, today's policies): 840
  compiles, 80,548 probes.
- **Training.** Same trainer and target. Held-out-group regret 0.0426
  against the October model's 0.0423.
- **Change.** `arc_value_model.json` replaced; weight unchanged.
- **Hypothesis.** The earlier retrain (−3.6) learned from a compiler whose
  policies were then replaced. A model learned from the compiler it serves
  should do better: V7.1 up.
- **Risk.** The same as before: a one-step-better model need not make
  better rides.
- **Result (V7.1, 4 seeds): not adopted.** −0.1 [−5.1, +4.8], 0.47; 22 of
  35 specs up; strong extra impacts +168%. Two retrains are null or
  negative, so the October model stays: the lever is what is proposed, not
  how the future is priced.

## November 8 (night): hypothesis, a generic reserve on ordinary arcs

- **Basis** (the inventory). On ordinary arcs every initial proposal slot
  not taken by policies or memory goes to them. Novel constructions keep 25%
  for generic samples. Ride-outs lost under each policy change tonight
  (P7 −9.3, −10.3).
- **Change** (`arc_proposals.ts`). Ordinary arcs reserve 10% of the initial
  proposals for generic samples (novel constructions keep 25%).
- **Hypothesis.** Coverage the policies miss returns. Ride-outs and floats
  up; headline up a little or neutral.
- **Risk.** Fewer policy and memory proposals; the dense strata may lose.
- **Result (V7.1, 4 seeds): not adopted.** +1.0 [−5.7, +7.6], 0.66; 18 of
  35 specs up; explicit requests −7.5. Ride-outs barely move (+1.2), so the
  policies' ride-out losses are not a coverage gap.

## November 8 (night): hypotheses, second-round and pooled policies

- **Data.** A second five-seed collection on the new main (9d065738: the
  policies from today's compiler).
  - All 840 compiles finished, now that the id-range fix is in; 80,548
    probes.
- **Second-round policies.** That collection plus the transfer
  collections: 79,919 demonstrations, 52.1 MB.
  - **Hypothesis.** Demonstrations from a compiler that already proposes
    well; a gain over main if recency still pays, null if rounds saturate
    (H2 and H4 diminished before).
- **Pooled policies.** Both of today's collections plus the transfer
  collections: 156,009 demonstrations, 100.2 MB.
  - **Hypothesis.** Demonstration count matters (three seeds instead of
    five lost 5.3), so twice the demonstrations gains over main.
  - The archive exceeds GitHub's 100 MB file limit. The branch stays local,
    and adopting it would need another encoding (brotli: −24%) or storage
    outside git, the owner's call.
- **Second-round result (V7.1, 4 seeds): inconclusive.**
  - +2.7 [−4.7, +10.1], 0.84; 21 of 35 specs up.
  - P3 +10.2, P1 +9.0, P2 +7.3, P6 +6.7, G +5.1 against P7 −15.2 (one
    fragile ride-out ride −148.7) and explicit requests −5.9.
  - Extended to 8 seeds.
- **Second round at 8 seeds: not adopted.** +1.3 [−4.3, +7.0], 0.70; 24 of
  35 specs up; blocks split 4 and 4. A second round of demonstrations from
  an already retrained compiler adds little, as before (H2, H4).
- **Pooled (4 seeds, 8 workers): inconclusive, promising.**
  - +3.3 [−3.1, +9.7], 0.90; 27 of 35 specs up.
  - P6 +13.4, G +7.1, P2 +6.3, P3 +5.3, P1 +4.0, E +3.8 against P7 −10.3.
  - Extended to 8 seeds.
- **Pooled at 8 seeds:** +2.0 [−1.0, +5.0], 0.92; 26 of 35 specs up; G +7.4,
  P6 +7.2, P5 +3.7, P2 +3.5 against P7 −4.5, P4 −2.6; strong extra impacts
  −33%. A small, consistent gain for twice the archive (100.2 MB, over
  GitHub's file limit): the owner's call on storage. Held out runs for the
  record.
- **Memory.** The pooled archive (260 MB uncompressed) is parsed by every
  compile worker. Run beside the second-round comparison at 22 workers each,
  free memory fell to 4 GB, and the pooled run was stopped before the system
  stopped anything. It is re-run alone at 8 workers.

## November 7 (night): hypothesis, twice the proposals for the policies

- **Basis.** The policies from today's compiler gained +8.3 and +12.8
  through the proposals they make, but they still get the share sized for
  the older ones: `policySamples` = 32·(guide allowance)/160, at most 32 of
  each interval's initial proposals, with the rest generic samples.
- **Change** (`connected_arcs.ts`). `policySamples` doubles (64 at the
  standard allowance), the same law ×2. The proposal total is unchanged:
  the policies take the share from generic samples.
- **Hypothesis.** More of each interval's search starts where today's
  compiler catches well; V7.1 up, most on the dense strata.
- **Risk.** Fewer generic samples means less coverage of novel situations;
  floats or explicit requests may lose.
- **Result: no change at all** (every ride identical). Production overrides
  this value: `repertoire_search.ts` sets `policySamples: 16` and
  `memorySamples: 16`, so `connected_arcs.ts`'s value never reaches a
  production compile.
- **Re-run on the real setting:** `policySamples` 16 → 32 in
  `repertoire_search.ts`, same hypothesis (branch
  `exp/policy-proposals-x2`).
- **Result (V7.1, 4 seeds): not adopted.** +0.7 [−1.7, +3.0], 0.78; 18 of
  35 specs up. The policies' gain comes from what they propose, not from
  proposing more.

## November 7 (night): hypothesis, a smaller policy archive

- **Basis.** The adopted policies are a 49.7 MB archive (79,778
  demonstrations), just under GitHub's 50 MB warning.
- **Change.** The same training, on 3 of the 5 seeds of today's collection
  (101, 202, 303) plus the same transfer collections: 49,306
  demonstrations, 32.6 MB.
- **Hypothesis.** No headline loss against the full archive (within
  noise). If so, the smaller archive replaces it for the repository's sake.
- **Risk.** A loss means demonstration count still matters at this size.
- **Result (V7.1, 4 seeds): not adopted.**
  - −5.3 [−12.1, +1.4], 0.04; 11 of 35 specs up; every block negative.
  - P6 −23.0, P7 −13.7; strong extra impacts triple.
  - Demonstration count matters: the full archive stays. The repository
    size has to be solved another way (storage outside git, or a denser
    encoding), not by fewer demonstrations.

## November 7: construction policies from today's compiler (adopted)

`repertoire_policy_model_v3.json(.gz)` is replaced. It holds 79,778
demonstrations: today's five-seed collection on main 6e815a57 (838 compiles
of the training catalog, songs disjoint from every benchmark and held-out
song), pooled with the two earlier transfer-layout collections. Hypothesis
and basis: the entry on construction policies from today's compiler.

| panel | change | interval / support |
|---|---|---|
| V7.1, 8 seeds | **+8.3** | [+4.5, +12.1], > 0.99; **32 of 35 specs up**; all 8 seed blocks positive (G +15.6, P1 +12.5, P2 +9.6, P3 +7.0, P4 +10.4, P5 +12.3, P6 −14.5, P7 +13.4) |
| held out, 11 songs | **+12.8** | [+5.4, +20.2], > 0.99; **11 of 13 specs up**; all 4 blocks positive (lowest lua_na_praca −1.7, highest petrunko +37.6) |
| explicit requests | +10.4 | |

- **No ride lost**; physics frames unchanged.
- **Every ruler** (V7.1, 8 seeds):
  - strong catches fall less short: strong bias +0.006, very strong +0.008
    (+0.014 on the library songs, +0.027 on intense passages);
  - air and speed errors lower except on long floats (P6, a single spec);
  - head-down or backward strong arrivals −0.015.
- **Costs.**
  - body drag +14% (V7.1) and +12% (held out);
  - strong extra impacts −16% and −12%;
  - head-down or backward strong arrivals −10% and −17%.
- **Archive:** 49.7 MB, against 22.6 MB before, just under GitHub's 50 MB
  warning. Pruning it (fewer, deduplicated demonstrations) is a follow-up
  for the owner.
- **Reading.** Policies learned from the compiler they serve matter more
  than anything about ranking. They decide which catches are ever proposed,
  and the short hops and the new local search changed that.
- Parity references were refreshed.

## November 7: hypothesis, construction policies from today's compiler

- **Basis.** The inventory found the construction policies collected
  before two of today's changes (no forced flight, half-weight prediction),
  so every demonstration had a flight of six frames or more. The last
  retrain on a current compiler was the largest single gain of the period
  (+15.5, November 1).
- **Data.** The construction demonstrations of today's five-seed
  collection (main 6e815a57, 838 compiles of the training catalog), pooled
  with the two earlier transfer-layout collections (rounds 1 and 2), which
  today's collection lacks.
  - 79,778 demonstrations (the adopted pooled policies: about 34,000).
  - The archive grows to 50 MB from 22.6 MB.
- **Change.** `repertoire_policy_model_v3.json(.gz)` replaced; nothing else.
- **Hypothesis.** Proposals that match how today's compiler catches (short
  hops, the new ranking and local search). V7.1 up, most on the dense
  strata; held out up.
- **Risks.**
  - Demonstrations echo the compiler that produced them (diminishing
    returns from more rounds: H2, H4).
  - The archive size is a repository question for the owner if it wins.

## November 7: hypothesis, the learned estimate retrained on today's compiler

- **Data.** `value_collect.ts` from main's frozen worktree (6e815a57):
  - the training catalog (benchmark/v4 groups, disjoint from every
    benchmark and held-out song), 5 seeds, 838 of 840 compiles. Two were
    excluded and named in the provenance: they failed on the id-range bug
    fixed above;
  - 80,353 probe rows (the October model: 82,903);
  - 16 workers (40 ran out of memory).
- **Training** (`train_value_v3.py`, unchanged target and hyper-parameters;
  validation holds out whole groups):
  - Spearman 0.68 against the October model's 0.63;
  - mean absolute error 0.066 against 0.073;
  - mean regret 0.054 against 0.054.
- **Screen** (within-catch, today's main, 1,946 alternatives in 344
  catches, correlation with the measured next interval's cost):
  - new model 0.37;
  - October model 0.30 (0.41 on the half-weight main: it no longer matches
    how local search now searches);
  - jointly: new 0.27 [0.18, 0.34], October 0.16 [0.04, 0.29].
- **Change.** `arc_value_model.json` replaced by the new model. Its weight
  in ranking is unchanged (0.225).
- **Hypothesis.** Better future discrimination gives better choices: V7.1
  up, held out up, most where the next catch is costly (dense strong G, P1,
  P4).
- **Risk.** Last time a retrain lost (−4.8) despite equal regret. That
  model had a fifth of the data and was never screened within a catch.
- **Result (V7.1, 4 seeds): not adopted.**
  - −3.6 [−15.2, +8.0], 0.20; 15 of 35 specs up.
  - G +3.3, but P1 −13.1, P5 −9.9 and P4 −5.0.
  - Strong extra impacts +56%, body drag +6%, head-down or backward
    arrivals −15%.
- **Reading.**
  - A better one-step, within-catch screen did not carry to whole rides.
    Twice today (here and the per-part calibration), one-step measures
    ranked a change correctly as a hypothesis but not as an outcome.
  - The October model's errors may be partly absorbed by the weights tuned
    with it, half-weight prediction included.
  - The new model and its data are kept (`generated/value-v4/
    model-local-search`, `collect-local-search`) for a later, joint test:
    for example, the new model with its weight re-chosen on the benchmark,
    or retrained construction policies from the same collection.

## November 7: a candidate too long for its section's ids is rejected, not fatal

- **Found by** the five-seed training collection. Two training compiles
  failed with "contact interval exceeds its segment namespace":
  `stretch_bridge_frontier_low_air_endurance_6s` seed 202, and
  `stretch_supported_speed_change` seed 404 (the second in the collector's
  probes).
- **Cause.** A section owns 10000 line ids (1000 + 10000·i). In very long
  intervals (gaps of several seconds), the scattered construction can split
  a carrier into more than 10000 fragments, and ordinary geometry has the
  same guard. Both guards threw, failing the whole compile.
- **Age.** Present at least since this morning's main (4613abbc), on both
  pre-afternoon mains, and on today's. Earlier collections used seed 101
  only and never met it. No benchmark or held-out ride ever reached it.
- **Fix.**
  - Such a candidate is rejected (`id_range`) like any other unbuildable
    geometry: `fragmentInterval` returns null, and the evaluator rejects
    before simulating.
  - The search continues; a shaped section that offers nothing already
    falls back to plain arcs.
  - Both compiles now finish, and both rides are valid.
- **Structural:** compile and judge parity unchanged; `npm run check`
  passes.
- New test: `contact_interval_ids`.

## November 7: hypothesis, the response step solves with ranking's weights

- **Basis.** "Local search judges like ranking" changed which candidate
  local search starts from and what counts as an improvement. The response
  step (a damped Gauss–Newton step from measured sensitivities) still
  solves for the residual vector with every prior at full weight, so its
  steps still aim at arrivals that ranking discounts. Refinement is already
  consistent: it turns the arrival and heading priors off and judges
  complete revisions.
- **Change** (`arc_local_search.ts`, response search only). Each prior row
  of the residual vector and of the Jacobian is scaled by the square root of
  its ranking weight:
  - arrival rows by √0.25;
  - the heading row by √0.5;
  - repair's reference rows by √0.25.

  The step solves the same weighted problem ranking judges. Nothing else
  changes.
- **Hypothesis.** Response steps land nearer what ranking keeps. A small
  V7.1 gain over the new main, the same direction as the last change.
- **Risk.** Little: the response step is one part of local search.
- **Result (V7.1, 4 seeds): not adopted.**
  - −1.9 [−11.3, +7.5], 0.29; 18 of 35 specs up.
  - G +4.0, but P7 −9.5 and P1 −7.1.
  - Strong extra impacts double (0.10 against 0.05 per 100 beats).
- **Reading.** Aiming the step at the full priors helps the search even
  though ranking discounts them: the response step needs the strong pull to
  move at all.

## November 7: the steep-angle prior re-tested on the new main (kept)

Removing the steep-angle prior before strong catches (Y, earlier a neutral
trade left to the owner's eye) was re-tested on top of "local search judges
like ranking".

- V7.1, 4 seeds: **−5.7 [−20.9, +9.5], 0.16; 31 of 35 specs down**.
- Every category is down (P6 −9.9, P4 −8.4, P1 −6.7, G −6.4).
- Head-down or backward strong arrivals −16% and body drag −4%, but the
  headline loss is broad.
- Before, local search climbed toward this prior at full weight and ranking
  discounted it. Weighed consistently, it pays.
- **Closed: the prior stays.** The branch `exp/no-steep-angle` is kept for
  the record.

## November 7: local search judges like ranking (adopted)

The interval's best candidate (where local search starts and what it improves)
and the response step's improvement check compare candidates with ranking's
weighting of the priors (`searchRank` in `arc_candidates.ts`): heading prior
at 0.5, other arrival priors at 0.25, no learned estimate. Before, they used
the candidate cost with every prior at full weight. Local search climbed
toward arrivals that ranking then discounted. The response step's residuals
and refinement keep the full cost. Hypothesis: LS in the entry on the
inventory of predictions.

| panel | change | interval / support |
|---|---|---|
| V7.1, 8 seeds | **+8.3** | [+1.5, +15.0], 0.99; **29 of 35 specs up**; every category up (G +2.5, P1 +2.4, P2 +4.4, P3 +9.9, P4 +5.0, P5 +8.9, P6 +16.5, P7 +16.5) |
| held out, 11 songs | **+5.7** | [−3.2, +14.6], 0.93; 9 of 13 specs up (valhalla +31.4; lowest petrunko −16.2) |
| explicit requests | +1.5 | |

- **No ride lost**; physics frames unchanged.
- **Every ruler** (V7.1, 8 seeds):
  - air errors fall most: air rms −0.004, −0.015 on long floats;
  - strong extra hits −0.018 per beat;
  - strength about even: strong strength rms −0.001, very strong bias
    −0.002, the older R1 strength rms +0.005.
- **Costs:**
  - body drag −10% (V7.1) and −4% (held out);
  - strong extra impacts −11% and −66%;
  - **head-down or backward strong arrivals +11% (10.9% against 9.8%) and
    +21% (10.9% against 9.0%).**

  That last one is a rendering of the owner's eye, never validated. A
  before/after review is rendered for his judgment.
- **Tests:**
  - two more legacy landing-report assertions now use the scored account:
    validity, and no unmatched touch strong enough to read as a hit (under
    0.15). The landing the legacy report flagged off the beat is a 0.09
    touch in the account;
  - the memo scenario moves to interval 2 (interval 1 no longer admits a
    prefix-invalidating support within its 400-step spread);
  - two budget scenarios are re-derived (2000 → 1850; 2100 → 1925, each the
    middle of the band where the scenario holds).
- Parity references were refreshed.

## Experiment names from November 7 on

From now on experiments are named by what they change. The letters used
earlier on November 7 map to:

| letter | name |
|---|---|
| R | no forced flight before a catch (adopted) |
| S | no curvature cap on catch lines |
| T | supports may reach the next catch |
| U | meet the line at the angle that gives the asked strength |
| V | redirect within two frames |
| Y | no steep-angle prior before strong catches (left to the owner's eye) |
| Z | arrival speed counts twice |
| AA | half-weight prediction in ranking (adopted) |
| AC | each part of the prediction at its one-step worth |
| ROOF | steering roof |
| VW | stronger learned estimate |
| LS | local search judges like ranking |
| PP | measured continuations per parent |

## November 7: where the compiler predicts instead of measuring; hypotheses VW, LS and PP

An inventory (an agent, read-only) of every prediction or fitted estimate the
compiler uses found 12.
- **Reliable:** control memory (learned within the compile) and effort
  pacing (grounded in measured cost).
- **Stale:**
  - the learned future estimate (Oct 5 compiler; its flight-length feature
    never saw the 3–5-frame hops R allowed);
  - the construction policies (collected before R and AA);
  - hand-set seeding and allocation formulas.
- **Inconsistent:** ranking counts the arrival priors at 0.25, but the
  interval's best candidate and local search's improving check still use
  them at full weight.
- **Already tested:** the leftover 6-frame clamp in proposal centring (T,
  −1.9).

Three single-change hypotheses (V7.1, 4 seeds; held out at decisions):

**VW: the learned estimate at 0.4.**
- **Basis.** Its within-catch one-step worth is 0.57 [0.41, 0.77], against
  0.225 used since AA, and it is the informative part of the prediction.
  Heading prior and arrival priors stay at AA's weights.
- **Hypothesis.** Better choices where the estimate discriminates; V7.1 up
  over AA.
- **Risk.** It is stale (Oct 5 compiler), so more weight may amplify its
  errors on the short hops.

**LS: local search judges candidates as ranking does.**
- **Change.** The interval's best candidate (the origin of local search) and
  the response search's improving check use ranking's weighting of the
  priors (heading 0.5, other arrival priors 0.25), not their full weight.
  The learned estimate stays out of local search, as before.
- **Hypothesis.** Local search stops climbing toward steepness and speed that
  ranking then discounts. Its effort goes to what ranking values; V7.1 up,
  fewer extras.

**PP: two of each parent's eight continuations by measured cost.**
- **Change.** The per-parent cut (`distinctCandidates`, 8 by rank) keeps 6
  by rank, then up to 2 more by lowest measured local cost with distinct
  arrivals.
- **Hypothesis.** As the beam's measured slot (B) did, measurement recovers
  continuations the prediction drops; V7.1 up a little, dense strata most.

**Results (V7.1, 4 seeds, against the AA main):**

| | change | interval / support | specs up | notes |
|---|---|---|---|---|
| VW | +1.0 | [−9.5, +11.5], 0.61 | 17 of 35 | null; not adopted |
| **LS** | **+11.3** | [−5.0, +27.7], 0.94 | **29 of 35** | every category up: P6 +25.5, P7 +17.5, P3 +16.9, P5 +13.1; body drag −11%; strong extra impacts −46% |
| PP | +4.4 | [−3.1, +11.8], 0.92 | 22 of 35 | P6 +21.4, P7 +9.5; P2 −4.8; strong extra impacts −48% |

LS goes to 8 seeds, then held out. PP is retested on top of LS if LS is
adopted.

**PP (measured continuations per parent) on top of LS: not adopted.**
- −2.8 [−12.8, +7.3], 0.22; 19 of 35 specs up.
- P6 −10.0, P5 −8.9.
- Local search judging like ranking absorbs its earlier gain.

**VW (stronger learned estimate): not adopted (null).**

Review of local search judging like ranking (before above after, the six
passages that differ most):
`/motion-gallery/video-compare.html?collection=/generated/compare/exp_search-as-ranking-vs-pre-search-as-ranking@b679799e-v7.1/review.json`.

## November 7: the learned estimate is the part worth improving

- **Dose and calibration together.**
  - Ranking without its prediction loses 7.7.
  - Halving the whole prediction gained 6.2 (AA).
  - Setting each part to its one-step worth lost 1.2 (AC).
  - So the prediction carries real information, but too much noise to be
    trusted at full weight.
- **Within-catch comparison of learned models** (`alternation_probe.ts
  --mode=sample --any --alt-model=…`; current main; 1,953 alternatives in
  344 catches):

  | model | training rows | within-catch correlation with the measured next cost |
  |---|---|---|
  | current (October compiler) | 82,903 | 0.41 |
  | model-1 (November 1 compiler) | 16,086 | 0.35 |
  | arrival priors | — | 0.22 |

  - Jointly: current 0.45 [0.24, 0.68], model-1 0.11 [0.01, 0.20], priors
    0.08 [0.00, 0.22].
  - The retrain failed for lack of data, not for the compiler it learned
    from.
- **Next.**
  - A five-seed collection on today's main from its frozen worktree:
    840 compiles of the training catalog, with songs disjoint from every
    benchmark and held-out song.
  - Train, then screen the model offline with this within-catch
    correlation before any benchmark run.

## November 7: ROOF result; hypothesis AC, each part of the prediction at its measured worth

**ROOF (steering roof as a construction option), V7.1, 4 seeds against the
AA main: not adopted.**
- +0.5 [−6.8, +7.9], 0.58; 18 of 35 specs up.
- P3 +9.8 and P7 +9.5 against P6 −7.3 and P2 −4.1.
- Strong extra impacts −28%; body drag +2%.
- Option 1 is now closed on the benchmark, not only on the probe.

**Calibration over all catches** (`--mode=sample --any`: every third catch of
every V7.1 spec, current main; 2,770 alternatives in 488 catches):

| part | one-step worth per unit | ranking's weight now |
|---|---|---|
| other arrival priors | 0.10 [0.05, 0.20] | 0.25 |
| learned estimate | 0.57 [0.41, 0.77] | 0.225 |
| heading prior | 0.01 [−0.31, +1.16] (not identified) | 0.5 |

It agrees with the strong-catch sample (0.14 and 0.56).

**Hypothesis AC.**
- **Change.** Ranking counts the other arrival priors at 0.1 and the
  learned estimate at 0.57, their measured one-step worth. The heading
  prior stays at 0.5: one step cannot value it, and D showed it prices
  extras two catches ahead.
- **Hypothesis.** Better choices where AA's uniform halving under-counted
  the learned estimate; V7.1 up over AA, most on dense strong strata, and no
  category losing much.
- **Risk.** What the arrival priors buy beyond one step (strength at the
  catch they prepare, as Y showed) is under-counted, and very strong asks may
  lose a little.
- **Result (V7.1, 4 seeds): not adopted.**
  - −1.2 [−5.9, +3.4], 0.23; 11 of 35 specs up.
  - G −3.9, P2 −5.5, P4 −5.6 against P7 +10.0.
- **Lesson.** One-step measurements under-value what the arrival priors buy
  at the catch they prepare. They can rank hypotheses, but not set weights.

## November 7: the dose of ranking's prediction, and what each part is worth

**Dose** (V7.1, 4 seeds, against the new main at weight 0.5):

| weight | headline | specs up | where |
|---|---|---|---|
| 0 (local cost only) | **−7.7 [−10.6, −4.9], < 0.01** | 6 of 35 | P1 −26.4, G −14.4, P4 −10.0; head-down or backward strong arrivals +44% |
| 0.25 | +3.3 [−6.0, +12.6], 0.83 | 23 of 35 | P6 +10.7, P3 +8.5, P7 +7.8, E +5.3; P4 −6.2, P1 −1.5 |
| 0.5 (main) | | | |
| 1 (before AA) | −6.2 (8 seeds) | | |

- The prediction is clearly worth having, about 8 points over local cost
  alone.
- A single weight is a compromise between contexts: dense strong passages
  want more of it, floats and ride-outs want less. The parts of the
  prediction differ in quality.

**What each part is worth within a catch** (`--mode=sample`, 1,317
alternatives in 226 strong catches followed by a strong ask, on the compiler
before AA; regression of the measured next interval's cheapest cost on the
three parts, bootstrap 95% intervals):

| part | one-step worth per unit | ranking's weight before AA | after AA |
|---|---|---|---|
| other arrival priors | 0.14 [0.07, 0.29] | 0.5 | 0.25 |
| learned estimate | 0.56 [0.35, 0.82] | 0.45 | 0.225 |
| heading prior | not identified (spread 0.0004: inactive before strong asks) | 1 | 0.5 |

- After AA the arrival priors are still counted about twice their measured
  worth, and the learned estimate at about 40% of it.
- This sample covers strong-then-strong catches only. A sample over all
  catches (every third catch of every V7.1 spec, current main) is running to
  calibrate the three parts on representative data, the heading prior
  included.

## November 7: ranking leans half as much on its prediction of the future (adopted)

`valueRank` (`arc_candidates.ts`) counts everything beyond the local cost at
half: the heading prior, the other arrival priors (already at half), and the
weighted learned estimate. Candidate cost and local search are unchanged.
Hypothesis and basis: AA in the entry on hypotheses Z and AA.

| panel | change | interval / support |
|---|---|---|
| V7.1, 8 seeds | **+6.2** | [+0.7, +11.8], 0.98; **32 of 35 specs up**; every category up (G +4.5, P1 +2.9, P2 +7.9, P3 +5.2, P4 +4.6, P5 +5.5, P6 +10.3, P7 +8.9) |
| held out, 11 songs | +2.9 | [−9.1, +15.0], 0.75; **11 of 13 specs up** (lowest lua_na_praca −31.9) |
| explicit requests | +3.2 | |

- **No ride lost**; physics frames unchanged.
- **Every ruler.**
  - Span errors down: air rms −0.002, speed rms −0.001.
  - Strong extra hits −29% (V7.1).
  - The older strength rulers move slightly the other way: R1 strength rms
    +0.003, very strong bias −0.004.
- **Costs.**
  - V7.1: body drag −1%; strong extra impacts 0.07 against 0.10 per 100
    beats; head-down or backward arrivals +5%.
  - Held out: body drag −7%; strong extra impacts 0.15 against 0.11;
    head-down or backward arrivals −6%.
- **Reading.** Ranking had over-trusted its prediction of the future: within
  a catch it varied 2.5 times more than the next interval measured. A
  calibration across catches (`catch_price`) could not see this, because it
  compares averages across catches, not differences within one.
- **Test.** The budget scenario in `arc_budget_interruptions` is re-derived
  (3400 → 2000; 1825–2150 hold).
- Parity references were refreshed.
- **Next.** The dose (0.25, and local cost alone) shows how much the current
  prediction is worth. A better future estimate may be the structural lever.

## November 7: hypothesis ROOF, a steering roof as a construction option

- **Basis.** Option 1 of the structural study was judged on probes alone
  (`roof_probe.ts`). Only the benchmark decides, so it is now offered to the
  search as a real construction.
- **Change** (branch `exp/steering-roof`).
  - Two guide controls: `steer`, a push in px/frame², and `steerFrames`.
  - The guide continues past the support over the nominal ballistic flight
    from the support's end, part of the same connected guide curve. It
    closes toward the rider by ½·steer·t².
  - Applied only where the guide reaches the support's end, outside transfer
    layouts.
  - A last proposal stage, after local search, offers the interval's best
    candidate again with steer 0.1, 0.2 and 0.35, the roof ending 4 frames
    before the next catch.
  - Each is measured like every proposal: a crash rejects it, and contact
    that registers counts as an extra hit. Ranking chooses.
  - Without `steer` the geometry is unchanged.
- **Check** (one ride, `amour_de_ma_vie_44s~spec`): 305 viable roof
  candidates; ranking put one first at 5 steps; 2 of 86 intervals in the
  final ride.
- **Hypothesis.** Where steering pays, ranking takes it: a little more
  strength on dense strong passages and a small headline gain.
- **Expected outcome (from the probe):** null. A steeper arrival bought this
  way measured worth little, and the contact often registers. Body drag
  will rise if roofs are chosen.

## November 7: hypotheses Z and AA, tested on the benchmark

The probes above choose what to test; only the benchmark decides. Two levers
that probes alone had judged are now tested as compiler changes.

**Z: arrival speed counts twice in the arrival prior.**
- **Basis.** Within-catch regression: ranking charges −0.016 per px/frame of
  arrival speed, and the next interval measures −0.031. A breakdown by speed
  relative to the target suggested the price was about right, so this is a
  direct test.
- **Change.** The speed residual r2 is multiplied by √2 (its cost doubles);
  nothing else changes.
- **Hypothesis.** Faster arrivals at strong catches; strength on strong asks
  up; headline up a little. Risk: speed overshoot on dense passages (F's
  failure mode).
- **Result (V7.1, 4 seeds): not adopted.** −4.4 [−13.0, +4.2], 0.10; 15 of
  35 specs up; P1 −14.6, P6 −10.1, P4 −9.0. The benchmark agrees with the
  band-by-band view, not the regression: the speed price was right.

**AA: ranking leans half as much on its prediction of the future.**
- **Basis.** Within a catch, ranking's future charge (valueRank minus the
  local cost) varies about 2.5 times more than the measured next cost
  (slope 0.40, correlation 0.38). Ranking may be choosing on prediction
  noise. `catch_price`'s average agreement is a different measure: it
  compares means across catches, not differences within one.
- **Change.** In `valueRank`, everything beyond the local cost (heading
  prior, other priors at ½, the learned estimate) is multiplied by 0.5.
  Candidate cost and local search are unchanged.
- **Hypothesis.** Better local choices; strength and span errors down;
  headline up. Risk: what the future estimate prices beyond one step
  (D: extras in long floats) comes back; ride-outs and floats may lose.

## November 7: the two energy levers checked (report only)

Within-catch comparisons (`alternation_probe.ts`, seed 101, 226 strong catches
followed by a strong ask; bootstrap 95% intervals over catches).

**1. Ranking's price of arrival speed is about right** (`--mode=sample`,
1,317 alternatives).
- The regression gap (charged −0.016 per px/frame against measured −0.031)
  comes from speed moving with steepness. By speed relative to the arrival
  prior's own target, ranking's charge tracks the measured next interval:

  | arrival against the prior's target | n | measured next cost | charged |
  |---|---|---|---|
  | −1.9 px/frame | 187 | +0.009 | +0.005 |
  | −1.0 | 693 | −0.003 | −0.002 |
  | −0.2 | 409 | −0.003 | −0.004 |
  | +0.7 | 19 | +0.038 | +0.044 |

- Ranking's charge split by part, per +1 px/frame:
  - arrival priors at ranking weight −0.023;
  - learned estimate +0.007;
  - heading prior 0.

  Per +10° steeper: priors −0.021, learned estimate −0.008, measured
  +0.004.
- The mispricing is the steepness reward (Y), not speed. Almost every
  alternative arrives below the target, where the price is right.

**2. Efficiency at equal strength is not a lever** (`--mode=peer`: K and
up to six cheapest candidates within 0.04 of its strength, each with the
energy it loses through the catch; 1,516 candidates).
- Within a catch, equal-strength candidates differ by only 2.7 energy units
  (median 1.7) out of about 15.5 lost.
- The wide spread across catches (0.73 to 1.68 × ½J²) belongs to the
  situations, not to the choices within one.
- Per 5 more units lost:
  - span speed residual −0.035 [−0.054, −0.024];
  - arrival −0.22 px/frame;
  - this span's cost −0.001;
  - next interval +0.007;
  - two steps +0.006 [−0.010, +0.032].
- The most efficient peer saves 1.2 units against the kept catch, and is
  worse over two steps in 74% of catches (+0.028).

**Where this leaves strength on dense songs.**
- Every lever reached from the search's side has now been measured:
  - search breadth (×10);
  - the starting shape (U, V);
  - the price of the future (calibrated, `catch_price`);
  - the arrival's angle, attitude and speed;
  - steering from above;
  - hits from above;
  - spin;
  - efficiency.
- Each is either already used or null.
- What remains is the trade the specs ask for: strong hits dissipate the
  energy the asked speed needs. Today's compiler sits near its frontier for
  that trade. Moving it needs new kinds of construction that none of these
  probes found.
- The one actionable item is Y, a neutral trade left to the owner.

## November 7: hypothesis Y, no steep-angle prior before strong catches

- **Basis** (`alternation_probe.ts --mode=sample`, now recording what ranking
  charges each alternative for the future; 1,317 alternatives in 226
  catches; within-catch regression, bootstrap 95% intervals):

  | per alternative | ranking charges ahead | measured next interval (cheapest local cost) |
  |---|---|---|
  | +10° steeper arrival | −0.029 [−0.061, −0.006] | +0.004 [−0.023, +0.036] |
  | +1 px/frame faster | −0.016 [−0.046, +0.012] | −0.031 [−0.054, −0.010] |
  | +10° more nose-down | −0.002 | −0.001 |

  Ranking rewards steep arrivals that buy nothing measurable at the next
  catch, and rewards arrival speed about half as much as it is worth. The
  angle term of the arrival prior (`addArrivalPriors`, r1) asks for a steep
  arrival whenever the next ask is strong (`steep`), on the premise that a
  steep arrival makes a strong catch possible. The intervention tests in the
  entry below show that premise does not hold.
- **Change** (`arc_evaluate.ts`). The angle term applies only to unpowered
  arrivals (`passiveArrival`), whose construction needs it, and no longer
  scales with the next ask's strength. The arrival speed term, the heading
  prior and everything else are unchanged.
- **Hypothesis.**
  - Ranking stops trading span quality for steepness before strong catches.
  - Strength on strong asks unchanged or up; span errors down a little.
  - Headline up a little on V7.1, most on the dense strata.
- **Risk.** Steepness may pay two catches ahead, beyond the one-step
  measure; ride-outs and floats may lose.
- **Result: neutral headline, a trade; not adopted, left to the owner's eye**
  (branch `exp/no-steep-angle`, before/after review rendered).

  | panel | change | interval / support |
  |---|---|---|
  | V7.1, 8 seeds | +1.2 | [−2.2, +4.6], 0.78; 20 of 35 specs up |
  | held out, 11 songs | −1.3 | [−11.4, +8.8], 0.36; 7 of 13 up |

  - **Every ruler:** strong hits a little weaker (strong bias −0.005, very
    strong −0.009, strength rms +0.003) against fewer extra hits (strong
    extra hits −0.025 per beat, extra strikes −0.005).
  - **Costs** (both panels): body drag −11% and −10%; strong extra impacts
    −24% and −17%; head-down or backward strong arrivals −13% and −16%.
  - **Reading.** The angle prior buys a little strength at the catch it
    prepares, though not at the one after, and pays for it with more extras,
    drag and head-down arrivals.
  - The tiki ride-out ride at seed 303 that lost 121 points is fragile: four
    other arms land near 660 on it too.

## November 7: the three structural options probed; the turning budget corrected (report only)

**Correction.** The turning-budget reading in the two entries below is not
supported. Intervening on the arrival does not reproduce the correlation it
rested on:
- **Steeper alternatives** from the kept catch's own pool (arriving 58°
  against 33°): the next catch's strongest candidate is 0.733 against 0.733.
  With 10× the next search it is 0.791 against 0.801.
- **Nose-up alternatives** (the same arrival angle within 6°, the sled at
  least 15° more nose-up): 0.71 against 0.73.
- **The roof** (below) steepens arrivals by 4–15° without strengthening the
  next catch.
- These comparisons are biased toward the kept catch, which ranking chose for
  its future using everything it sees. The sound design compares
  alternatives with one another within the same catch.

**Within-catch comparison** (`alternation_probe.ts --mode=sample`; 1,317
alternatives in 226 strong catches followed by a strong ask; the six
cheapest other candidates with distinct arrivals; regression on differences
within each catch, bootstrap 95% intervals over catches):

| arrival feature | strongest next candidate | cheapest next: strength | cheapest next: cost | a candidate within 0.06 of the ask |
|---|---|---|---|---|
| +10° steeper | +0.024 [−0.001, +0.046] | +0.013 | +0.004 | +7.8% [+1.5, +15.8] |
| +10° more nose-down | −0.005 [−0.009, −0.001] | −0.000 | −0.001 | −1.5% |
| +1 px/frame faster | +0.027 [−0.003, +0.053] | **+0.052 [+0.027, +0.079]** | **−0.031 [−0.056, −0.013]** | +13% [+3, +23] |
| +0.1 own strength | −0.009 [−0.038, +0.017] | +0.004 | −0.002 | +4% |

- Arrival speed is the one clear causal lever. Steepness helps modestly,
  about a sixth of what the raw correlation suggested.
- A stronger catch does not by itself weaken the next one.
- The cross-sectional association with steepness came from what steep
  arrivals come with in the compiler's own choices.

**Option 1, steering down from above without a hit**
(`tools/research/roof_probe.ts`; 191 strong catches followed by a strong ask):
- A roof is traced over the rider's free flight, 2 px above its top point,
  deviating toward it by ½·a·t², from 2 frames after the support to 4 before
  the next catch.
- Results by push a (0.15 / 0.3 / 0.5 px/frame²):
  - arrival 37° / 42° / 48° against 33°;
  - the rider stays intact 97% / 96% / 78%;
  - the contact registers a hit in 79% / 99% / 98% of rides (strongest
    0.08 / 0.14 / 0.21);
  - the roof touches mostly the shoulder, the sled's front top point and the
    hands;
  - the next catch's strongest candidate is 0.751 / 0.752 / 0.727 against
    0.761, and its cheapest costs more.
- **Not viable:** the steering registers as hits, and the steeper arrival it
  buys is worth little (see the table above).

**Option 2, hits from above.**
- After a rising arrival, the strongest candidate from a surface above
  averages 0.32–0.45 (alternation probe).
- Across all strong catches, with 10× the samples, it averages 0.51.
- K and K′ (flush with the rider's top edge or outline) were null before.
- Hits from above build over about 4 frames as the shoulder, hands and the
  sled's top point meet the surface in turn. **Not available with today's
  constructions.**

**Option 3, strength from spin** (379 hits of 0.4 and up on the library
songs, by spin's share of the 2-frame impulse):
- the most-spin quarter (27% spin) is weaker (0.565 against 0.651);
- it dissipates more for its strength (1.31 against 1.12 × ½J²).
- **Not a way around the energy cost.**

**What remains true.**
- Strong catches dissipate energy, about ½J² each, and the arrival speed
  the next catch needs comes from that same energy.
- The levers are energy-efficient catches (the efficient quarter loses 0.73
  against 1.68) and arrival speed; neither weights nor search add any.

## November 7: alternation probed; the turning budget (report only)

**Probe** (`tools/research/alternation_probe.ts`, seed 101, 206 strong catches
followed by a strong ask, 21.7 frames apart):
- From each catch's own pool, up to three candidates that send the rider up
  (arrival under −5°; 307 in all) are followed by the next interval's own
  search, which proposes surfaces above as usual.
- **Result: no.** The rising candidates cost 0.20 apart from strength
  (kept: 0.007).
- After them, the strongest catch averages 0.32–0.45 from a surface above
  and 0.26–0.44 from below (ask 0.74). After the kept candidate it averages
  0.73 from below and 0.47 from above.
- Over two steps, rising never beats the kept catch (0 of 204).
- Hits from a surface above stay weak even when the rider rises into them;
  with today's constructions, alternation is not available.

**Spin.** Of strong hits' 2-frame impulse (strength ≥ 0.5, 379 hits on the
library songs), spin is 8.5% of the square: median 3.9%, p90 24%.
Strength today is almost all a change of travel.

**Reading: a turning budget** (superseded: see the correction above).
- A floor catch registers strength by turning the rider: about J/v, so
  roughly 24° for 0.64 at 11.5 px/frame.
- Between catches only gravity turns the rider back down: about
  0.9°·cos(heading) per frame, so roughly 17° over the 21.7 frames between
  strong catches. A support line cannot turn the rider down faster, or the
  rider leaves it.
- So on dense strong passages, catches spend more turning than gravity
  returns. Arrivals flatten (33° after a strong catch, 42° after a weak one),
  and the next catch is weaker or costs speed.
- That matches every measurement above:
  - arrival angle predicts strength;
  - close beats lose most;
  - a stronger catch makes the next weaker;
  - more search does not help.
- **Ways around it, all construction questions for the owner:**
  - **turning down between catches without a hit:** a surface above the
    rider whose contact never forms an impulse peak (steering, free in the
    account). It touches the rider from above: lines over the rider, body
    drag;
  - **stronger hits from above:** today they stay under 0.5 even when the
    rider rises into them;
  - **strength from spin,** which turns nothing: rocking or rotating hits;
  - **spec authoring:** tell the author (a tool's report, not a rule) where
    dense strong asks exceed the turning budget at the asked speed.

## November 7: what limits strength, studied three ways (report only)

What follows describes today's compiler, not a physics limit. Seed 101; every
studied ride is identical to `main`'s saved ride. Tools:
- `tools/research/loss_attribution.ts`: each final catch matched to the pool
  it was chosen from, and the ride's energy frame by frame;
- `tools/research/catch_frontier.ts`: the same interval searched again with
  10× the samples.

**1. Why a catch misses its strength** (all V7.1, 3,445 catches; shares of
the squared strength error; 95% of it is undershoot, 98% on G):
- **no option** (31%; G 29%): the pool holds no candidate meaningfully
  closer to the ask (by 0.05);
- **the next catch would pay** (30%; G 32%): a closer candidate was cheaper
  locally, but ranking expects the next interval to pay more:
  - +0.072 ahead against 0.013 saved;
  - calibrated by `catch_price`;
  - in 20% of this class the beam's other lineages decided instead;
- **it costs this span** (39%): mostly speed (20%), then air, timing and
  extra hits.

**2. Ten times the search changes little** (774 strong catches short by more
than 0.08; ask 0.78, kept 0.63):
- A candidate within 0.05 of the ask exists in 51% of pools, and in 60% with
  10× the samples.
- The cheapest candidate within 0.06 of the ask costs +0.09 apart from
  strength in both pools, mostly span speed (−0.12). Closing a 0.15 shortfall
  saves only about 0.02, so declining is right.
- Surfaces above appear in half the pools, but their strongest candidate
  averages 0.51.
- Search is not the limit; this confirms the allowance diagnostics.

**3. The arrival angle predicts the next catch** (an association; the intervention tests above show it is mostly not causal). Within
the same ask band (0.8 and up), the kept strength and the share of pools
holding a near-ask candidate rise with the arrival's steepness:

| arrival | kept strength | pools with a near-ask candidate |
|---|---|---|
| under 25° | 0.65 | 44% |
| 25–40° | 0.73 | 64% |
| 40–55° | 0.78 | 75% |
| 55° or steeper | 0.80 | 80% |

- Arrival speed matters less: 12–14 px/frame against 10–12 is about 0.04
  less shortfall.
- Close beats lose more: 0.15 short under 10 frames, against 0.07 over 20.
- After a strong catch the next arrival is shallower: 33° after 0.6 and up,
  against 42° after under 0.4.

**Energy.** On G, catches dissipate 26 energy units per second; between
catches the change is only −1. Rides descend 162 px/s to pay for it. The
energy a strong catch loses does not show in the next span's speed residual
(−0.009 to −0.016 across loss quartiles): the rides pay for it by descending.

**Reading.**
- A floor catch registers its strength best when the rider meets it
  steeply.
- A strong floor catch turns the rider up. Before the next beat only gravity
  turns it back down: about 0.9° per frame at 11 px/frame, so under 20° in a
  typical gap.
- On dense strong passages the next arrival is therefore shallow, and the
  next catch is weak or expensive. That one coupling explains both the "next
  catch would pay" share and much of the "no option" share.
- Neither more search nor reweighting changes it.
- A structural fix makes steep arrivals cheap. Two candidates:
  - **(a) alternating receivers:** the floor catch sends the rider up into a
    surface above on the next beat. The rider meets it rising, which is
    steep relative to that surface, and it turns the rider down, steep onto
    the next floor. Each hit is a redirection, and the two cancel each
    other's turn. This is the owner's upper/lower pairs, and why N (a prior
    alone) could not produce them: the launch and the upper catch must be
    planned together.
  - **(b) steering down without a hit:** a surface above that turns the
    rider down gently, with contact that never forms an impulse peak, so it
    is not an event.

## November 7: re-tests after R, E (guide ends searched) and K′ (flush upper catches)

- **Basis.** Both were null on the compiler before R, which forced 6
  frames of flight before every catch. After R, 18% of library catches come
  from 3–5-frame hops, and dense passages changed most. Both mechanisms act
  on dense passages: E on the guide's holding job, K′ on hits from a surface
  above, which the owner likes.
- **Change.** The original commits re-applied on today's main (eafced45; K
  then K′, c3aeae8a and 86208baa).
- **Hypotheses** (as originally stated):
  - E: fewer extras in guided sections, more partial upper rails, headline
    +1 to +4;
  - K′: timelier and stronger hits from above on mid and strong asks, a
    small headline gain.
  - The null before R is the likeliest outcome for both.
- **Results (V7.1, 4 seeds): neither adopted; both stay closed.**
  - **E:** −5.0 [−12.7, +2.7], 0.07; 10 of 35 specs up. Losses in P1
    (−13.3), P6 (−10.4) and P4 (−9.2).
  - **K′:** +0.3 [−7.0, +7.7], 0.55; 21 of 35 specs up. Calm and ride-outs
    gain (P3 +9.2, P7 +4.8) while pairs and intense passages lose (P1
    −10.6, P4 −6.7). Strong extra impacts fall 27%.
  - R did not change either verdict.

## November 7: hypothesis V, redirect within two frames

- **Basis** (the study below). The catches that lose the least energy for
  their strength meet the line nearly along the travel and bend it hard.
  The scored strength is a 2-frame impulse, so a bend completed within 2
  frames registers fully as a redirection, without the inelastic stop's
  loss.
  - The centre already meets the line along the travel, but by default it
    spreads its bend over min(5, support/2) frames.
  - The generic samples outside independent guides never set when the bend
    happens.
- **Change** (`arc_proposals.ts`).
  - The centre completes its bend in 2 frames: `turnFraction` =
    clamp(2 / support, 0.1, 0.5).
  - One generic sample in four does the same, scaled by 0.75–1.25.
  - Nothing else changes: the search, the policies and the guide sweep
    already vary `turnFraction`.
- **Hypothesis.**
  - Strength on strong asks rises on the dense songs (G), with span speed
    no worse.
  - The headline rises a little.
- **Risks.**
  - Sharper bends crash more (`binding`).
  - The start may not matter (U), giving a null result.
- **Result (V7.1, 4 seeds): not adopted.** −0.9 [−7.5, +5.8], 0.35; 18
  specs up, 17 down; strong-ask strength unchanged (G very strong bias
  +0.005). With U, this closes the starting shape as a lever: the search
  reaches the same catches from either start. Strong extra impacts halve
  (0.06 against 0.12 per 100 beats), but they are rare either way.

## November 7: why strong catches fall short on dense songs (study, report only)

What follows describes today's compiler, not a physics limit.

- **Where the loss is.** On `main`, strength is 62% of G's squared error;
  speed is 13%, air 13%, timing 6% and extra hits 6%. P6 is the exception:
  air 40%.
- **What a stronger catch costs** (`catch_price`, which now records each
  candidate's cost parts, its signed residuals, its controls and its
  mechanical energy; 8 rides, seed 101, 246 strong catches).
  - The pool's candidate closest to the ask is stronger (0.728 against 0.677
    kept; ask 0.756) but costs +0.057 locally:
    - speed +0.024 (span speed −0.088 against −0.022 kept);
    - extra hits +0.012;
    - the preceding span's correction +0.012;
    - timing +0.009;
    - air +0.009;
    - against −0.009 gained on strength.
  - The next interval then pays as much again (+0.066). Ranking already
    charges that price (+0.059), so ranking is not the lever.
- **Energy.** A catch dissipates energy (½v² − g·y per unit mass, body
  mean, 3 frames before to 4 after the contact). The loss is about 1.24 ×
  ½J² at the median, J being the registered impulse in px/frame: roughly an
  inelastic stop. At 11 px/frame a 0.8 catch removes about a quarter of the
  kinetic energy, and only a descent of about 100 px gives it back.
  - The spread is wide: 0.79 at p10, 1.67 at p90.
  - The most efficient quarter (0.73) meets the line nearly along the travel
    (7°) and bends it hard (turn −19°), redirecting the rider.
  - The lossiest quarter (1.68) meets it at 17° and bends only −9.5°,
    stopping the rider.
  - U pushed the start toward stopping, which fits its loss.
- **What this means for the compiler.**
  - The search already varies when the bend happens (`turnFraction`, in the
    broad sweep and the policies), and it keeps efficient catches when they
    cost less.
  - The arrival prior already asks for the extra arrival speed a stop
    dissipates.
  - So the trade between strength and the spec's speed is priced
    consistently. Closing the gap needs constructions that register strength
    with less dissipation: redirections, or more hits that also climb.
  - That is the construction discussion with the owner. Neither the
    starting shape (U) nor the weights are the lever.

## November 7: hypothesis U, meet the line at the angle that gives the asked strength

- **Basis** (an audit of fixed limits in construction, read-only).
  - The proposal centre still follows the turn-sum strength of September:
    it meets the line almost along the travel (`entry: incoming − 0.5`) and
    asks the line to turn by impulse ÷ speed over its first 5 frames.
  - The scored account (v3) counts the whole-body impulse over 2 frames.
    A bend spread over 5 frames counts about 40% of itself, while meeting
    the line at an angle α gives speed × sin α at once (a head-on stop counts
    fully).
  - The generic samples cap that angle at 32° (`min(32, turn + 10)`), which
    sits at the boundary of strong asks (about 33° for 0.8 at 11 px/frame).
  - Strong asks on the dense library songs fall 0.12 short; the learned
    policies learned from this compiler's own choices, so they inherit the
    centre's bias.
  - Not tested: the `unusable_arrival` gate (0.4% of rejections on four
    dense songs) is too rare to matter.
- **Change** (`arc_proposals.ts`).
  - α = asin(min(0.95, impulse ÷ speed)), the angle whose head-on component
    is the asked impulse.
  - The centre meets the line at α, and the line then turns only by what α
    leaves, max(0, turn − α); its exit is unchanged. The guided centre's
    rising-rider case is unchanged.
  - The generic samples' approach range is 2 + frac·(α + 10), with no
    fixed cap. The guided samples that graze the line (−1 to 5°) stay.
  - Ranking, rejections and the learned policies are unchanged.
- **Hypothesis.**
  - Strength on strong asks rises, most on the dense library songs
    (G, P1, P4).
  - Headline up on V7.1.
  - Physics frames about the same.
- **Risks.**
  - Steeper meetings crash more (`binding`) or make extra hits.
  - Body drag may rise.
  - Ride-outs and floats may lose where a grazing catch was right.
- **Result (V7.1, 4 seeds): not adopted.** −2.7 [−8.1, +2.7], 0.10; 15
  specs up, 20 down; P1 −12.0, P6 −10.9. Very strong bias does not move
  (+0.000 on G). The starting shape is not what keeps strong catches short:
  the search finds its way regardless of where it starts.
- **Calibration re-measured after R** (`catch_price`, fixed: research
  probes no longer trip the accounting check; 16 rides, seeds 101 and 102,
  every probed seed-101 ride identical to `main`'s). Ranking still charges
  what the next interval pays: closest-to-ask +0.053 charged against +0.061
  measured; lowest-cost +0.019 against +0.020. The closest-to-ask candidate
  is stronger (0.724 against 0.677 kept, ask 0.757) but costs +0.061 locally
  and as much again in the next interval: stronger catches exist in the
  pools, and what they cost is the rest of the ride's shape.

## November 7: hypothesis S, no fixed curvature cap on catch lines

- **Basis.**
  - After R, the rejection reasons show no other big pre-filter. 85% of
    rejected proposals are crashes (`binding`), which is physics, and the
    rest are construction checks the owner wants kept.
  - The geometry has one hard limit left: a catch line may not bend more
    sharply than a fixed radius of 24 px (`radius: 24`, which clamps each
    segment's angle to the previous ± v·dt/24).
  - A sharp catch is what a strong hit needs. In the V4 era the cap was
    binding on arcs holding about half the largest strength misses; only
    tightening it was tried, never removing it.
- **Change.** `radius: 0` in the production options: no curvature clamp.
  Angular folds were already exempt. Crashes, extras and the scored account
  decide what is rideable.
- **Hypothesis.**
  - Sharper catches become possible where they pay: strength on strong asks
    rises, most on dense songs; headline up.
  - Fewer viable smooth candidates is unlikely, since nothing is removed.
- **Risk.** Kinked lines give harsher rides, more extras or body drag. The
  guards line watches extras and drag.
- **Result (V7.1, 4 seeds): not adopted.** −1.7 [−9.7, +6.3], 0.28; 21 of 35
  specs down; very strong bias −0.007. The cap is not what limits strong
  catches.

## November 7: hypothesis T, supports may reach the next catch

- **Basis.** After R nothing rejects a late release, but the geometry still
  builds one in. A support is clamped to end 4 frames before the next catch
  (`span − 4` in the control's normalization), and the nominal support 6
  frames before it (`span − RELEASE_FRAMES`). R's gain came from shorter hops
  on dense songs.
- **Change.** Both clamps are lifted, so a support may run to the next catch.
  The scored account decides whether a catch reached that way registers as
  its own hit.
- **Hypothesis.** Further gains on dense songs (G, P1, P4) from catches
  reached by riding or by 0–3-frame hops; long-gap categories about neutral.
- **Risk.** Ride-in catches read weaker or as extras; the account should
  reject or price them.
- **Result (V7.1, 4 seeds): not adopted.** −1.9 [−7.4, +3.7], 0.18; specs
  split 17 up and 18 down. Strong extra impacts nearly double (0.22 against
  0.12 per 100 beats). Removing the rejection (R) gave the flexibility that
  pays; stretching supports to the catch does not.

## November 7: no forced flight before a catch (adopted)

The `late_release` rejection is removed (`arc_evaluate.ts`). It rejected any
candidate whose sled touched its line in the last 6 frames before the next
catch. The scored account now decides alone whether a catch registers as its
own hit. Hypothesis and basis: the entry below.

| panel | change | interval / support |
|---|---|---|
| held out, 11 songs | **+33.6** | [+22.8, +44.5], > 0.99, every block positive; **13 of 13 specs up** (+2.5 to +181.8) |
| V7.1, 8 seeds | **+5.1** | [+1.6, +8.5], > 0.99 |
| explicit requests | −1.1 | |

- **Dense categories gain:** G +19.3, P4 +22.1, P1 +10.1, P2 +4.7.
- **Ride-outs and floats lose a little:** P7 −10.0, P3 −3.4, P6 −2.0.
- No ride lost.
- **Style:** catches still arrive from a flight. On the library songs, 17.8%
  now come from a 3–5-frame hop instead of 6 or more frames, and 0.4% from
  under 3 frames; 6.1% change on the other specs.
- **Costs** (the comparison's guards line):
  - body drag +10% (V7.1) and +18% (held out);
  - strong extra impacts up but tiny (about 0.1 per 100 beats);
  - head-down or backward strong arrivals +6%.
- **Tests:**
  - three synthetic tests asserted the legacy landing report's `hit` status;
    they now assert the scored account's validity (every beat matched), which
    is the product's measure;
  - one budget scenario is re-derived (3100 → 3400).
- **Owner review (November 7):** the owner watched the before/after passages
  that differ most (`npm run compare -- review`) and found the after
  "completely fine". Style approved.

Parity references were refreshed.

## November 7: hypothesis R, no forced flight before a catch

- **Basis.**
  - Every candidate whose sled touches its line in the last 6 frames before
    the next catch is rejected (`late_release`, `RELEASE_FRAMES = 6`).
  - On gaps under 15 frames this is 27% of all rejections on the library songs
    (33 per interval), against 5–7% on longer gaps.
  - Strength on dense strong songs is V7.1's largest loss.
  - The rule predates the scored account. The account now rejects any candidate
    whose catch does not register as its own hit (`missed_impact`), so the
    reserve is a hard threshold on top of a measurement.
- **Change.** Remove the `late_release` rejection. The account decides. The
  nominal support stays clamped as before (it only centres proposals).
- **Hypothesis.** On short gaps, more candidates survive: the rider can ride
  into a catch, or leave later. Strength and timing improve on dense songs
  (library, P1, P4); the headline is up, most in G. Long-gap categories are
  about neutral.
- **Risk.** Catches reached by sliding read weaker or blur into the previous
  hit. The account should reject or price these, but extras or contested beats
  could rise. October's test of a 3-frame reserve, on V7.0 with no dense
  library songs, was null.

## November 7: hypothesis H4, a third round of demonstrations

- **Basis.** The construction policies have been the most productive lever:
  retrained +15.5, and pooling two rounds added more on held-out music. Round
  3 collects demonstrations from today's compiler, which now runs BJH (same
  catalogs, frozen worktree at 2fc98a94).
- **Two arms:**
  - **H4a:** rounds 2 and 3 pooled. About the archive size of today (22.6 MB),
    dropping the oldest compiler's demonstrations.
  - **H4b:** rounds 1, 2 and 3 pooled. About 51k demonstrations; the archive
    grows to roughly 34 MB.
- **Hypothesis.** Fresher and more demonstrations make proposals closer to
  what today's compiler keeps: a further gain over `main` on V7.1 and held
  out, smaller than BJH's. H4b ≥ H4a if quantity matters more than recency.
  Each must show its gain against its size; H4b's larger archive needs a
  clear margin.
- **Result: not adopted; the demonstration-rounds line is closed.**
  - H4a (rounds 2 and 3): V7.1 +2.3 [−3.4, +8.1], 0.86.
  - H4b (rounds 1 to 3): V7.1 +3.1 [+1.8, +4.5], > 0.99, 22 of 35 specs up,
    body drag +8%; held out +3.9 [−12.7, +20.4], 0.74, 7 of 13 specs up,
    one block (+18.6) carrying it. Its archive would grow by 11 MB, to 33.7.
  - Each round still helps a little, but less each time.

## November 7: hypothesis J2, the dose of strong-catch effort

J scales an interval's local search by 1 + 0.3 × the steep-arrival step of its
catch's ask. The 0.3 came from October's lookahead and was never re-derived.
J2 uses 0.6.
- **Hypothesis.** If effort at strong catches is still underspent, J2 gains
  over `main` (V7.1 +2 or more, strength on strong asks up). If not, 0.3 is
  near where it stops paying, and J2 is about neutral for more frames.
- **Result (V7.1, 4 seeds): not adopted.** +2.2 [−2.8, +7.2], 0.87. Specs split
  17 up and 18 down, and the gain sits in the single long-ride spec (P6 +17.7),
  the pattern the long-gap question warns about. Physics frames +1%. The
  allowance's pacing absorbs most of the extra local effort, and 0.3 is near
  where effort at strong catches stops paying.

## November 7: beam slot, strong-catch effort and pooled policies, together (adopted)

Three mechanisms parked on November 1–2 as small and unconfirmed, adopted
together:
- **B:** when the beam has room for two, one slot keeps the continuation with
  the lowest measured cost (`arc_sequence.ts`).
- **J:** an interval's local search is scaled by 1 + 0.3 × the steep-arrival
  step of its catch's ask (`arc_sequence.ts`).
- **H3:** construction policies trained on both collection rounds pooled
  (34,125 demonstrations, `repertoire_policy_model_v3.json`).

Each alone on V7.1 gave +3.2 to +3.7, and +1.0 to +2.5 held out. The stated
hypothesis was that, as different mechanisms, they add.

| panel | change | interval / support |
|---|---|---|
| V7.1, 8 seeds | **+9.7** | [+7.6, +11.8], > 0.99, every block positive; 31 of 35 specs up, every category up (G +12.0) |
| held out, 11 songs | **+8.6** | [+0.3, +16.9], 0.98; 11 of 13 specs up |
| explicit requests | +9.9 | |

- B and J without H3: V7.1 +7.2 (4 seeds), held out +4.8. The pooled
  policies add the rest.
- No ride lost.
- Strong-ask bias +0.005, very strong +0.006; air rms −0.002, speed rms
  −0.002.
- Costs:
  - physics frames +0.34M per ride (+11%, from J), within an allowance
    that rides used to about 45%;
  - body drag +0.47 s/min;
  - the policy archive grows from 10.3 to 22.6 MB.
- **Tests re-derived:** the terminal-selection scenario's allowance (180000 →
  200000, its ride had one off-beat landing), and the recovery test's mocked
  context gains the `gaps` the effort scaling reads.

Parity references were refreshed.

## November 7: hypothesis N, a steep arrival either way

- **Basis.** Dense strong beats are V7.1's largest loss. A strong floor hit
  turns the rider up, and before the next catch only gravity turns it back
  down: about 10° in 20 frames, against the 25–30° a strong hit spends. A
  surface above can turn the rider down, and a hit from above on the next beat
  is the upper/lower pair the owner loved (Trouble). But the steep-arrival
  prior asks only for descending arrivals (20–70° down), and no beat is ever
  hit by a rising rider (0.14%).
- **Change.** The prior's angle term measures steepness either way: the
  arrival's |heading| against the desired angle, instead of its signed descent.
  The search can then prepare a steep rising arrival into a surface above as
  readily as a steep descent onto a floor. Nothing else changes.
- **Hypothesis.** More on-beat hits from above in dense strong passages;
  strong-ask strength up on V7.1's library songs; headline up. Body drag may
  rise (body contact with surfaces above).
- **Risk.** Steering arrivals upward where the next interval finds no good
  surface above loses those catches.
- **Result (V7.1, 4 seeds): null; closed.** −0.7 [−1.9, +0.6], 0.09; 11 of 35
  specs unchanged. The search almost never generates a steep rising arrival,
  so a prior indifferent to direction has nothing to accept. Alternating
  floor and ceiling hits would need the launch and the catch above proposed
  together: a construction change, for the geometry discussion with the owner.
- **Re-tests on V7.1 (4 seeds):**
  - J (strong-catch effort): +3.3 [−1.8, +8.3], 0.93; +0.34M physics frames
    (+11%).
  - B (beam slot): +3.2 [+1.5, +4.9], > 0.99, but split (17 of 35 specs up).
    The gain sits in P6 and P7 (+10.8, +6.2), with groove −3.1.
  - H3 (pooled policies): +3.7 [−1.8, +9.3], 0.94. Held out on the 11 songs:
    +1.0 [−8.2, +10.2], 10 of 13 specs up.
- **Held out (11 songs, 4 seeds):**
  - B: +1.8 [−5.1, +8.8], 10 of 13 specs up;
  - J: +2.5 [−5.0, +10.1], 10 of 13 specs up.

  All three are small and positive on both panels, but none is established on
  held-out alone.
- **Hypothesis BJ, then BJH.** The three are different mechanisms (what the
  beam keeps, search effort at strong catches, what the policies propose), so
  their gains add. B+J, then B+J+H3: V7.1 about +6 to +10, and held out
  clearly positive. If they don't add, they share one small gain and stay
  parked.

## November 7: where V7.1 loses, and the next experiments

On the library songs (G, 678 against 745 for V7.0's songs), strength is 55% of
the loss. Strong asks fall short: 0.6–0.8 at −0.12 and 0.8+ at −0.12, with 32%
of each more than 0.15 short (V7.0's songs: about 5%). These songs ask for
strong hits on 58–76% of beats, densely: the close-strong-beats coupling found
on November 1. Next, each with its hypothesis stated before running (paired
V7.1 at 4, then 8 seeds; held out at decisions):
- re-tests on V7.1 of the parked H3 (pooled policies), B (beam slot) and J
  (strong-catch effort). Same hypotheses as before; V7.1's dense strong songs
  and the 11-song held-out panel may resolve them;
- then new mechanisms aimed at dense strong passages.

## November 7: V7.1 and eight more held-out songs

The music library's 22 specs (14 songs) were split by song, never by spec.
- **Development (V7.1 = V7.0 plus 13 specs, stratum G):** Amor na Praia and
  Luna Bala, already development songs, and the songs with several tempo
  versions (Passo Bem Solto, Los Voltaje, Montagem Tomada, Funk do Bounce).
- **Held out:** the eight single-version songs. With Trouble, Valhalla and
  Circus that makes 11 songs, sealed from compiler decisions.

The new specs are dense one-minute songs with little time in long gaps, so V7.1
does not add to V7's long-gap weight. All 13 development specs compile and
finish (seed 101). `v7` stays V7.0 for the parity cells; `v7.1` is the default
panel.

Baselines at `main` = a3c845fd (the compiler of the perf merge):
- **V7.1, 8 seeds:** headline **776.3**; G 694.1, P1 801.1, P2 835.7, P3 768.1,
  P4 791.7, P5 795.4, P6 702.3, P7 822.2; explicit requests 763.2; 328 of 328
  finished. G falls from 744.9 (V7.0's four songs) because the library songs are
  harder, so dense real songs and the long ride are now the weakest categories.
- **Held out, 13 specs × 4 seeds:** **703.4**; 52 of 52 finished. Per-song scores
  stay unread (sealed). A test checks that no held-out song is a development song, matched
across tempo versions. The other agent's earlier perf and visuals branches
were fast-forwarded first (Node 26, `npm run check` all green on this machine).

## November 7: not done, on purpose

Making one `advance` the only call that simulates: the detector serves the native engine,
the fixed judge and the JavaScript references, and the other two simulate when read, so
it would need a second path, and tools would need explicit advances or convenience
reads that simulate again. The charge check already fails any compile that simulates
uncharged; this would only move the failure from run time to writing time. Replacing
`LineGrid`'s table with `IntMap` and a bucket pool: its −0.7% is measured and the
rewrite would risk more than it saves.

## November 7: three more removals, timed with `--candidate`

Each measured against its parent commit, with the checkout untouched: the motion memo,
−0.0% [−0.8, +2.2] and 26 MB less memory; the whole-sweep bounds, +1.0% [−0.7, +2.5],
about 60 lines of bit faces and overflow limits whose gain near lines had absorbed; and
`getRider`'s 24 copied sled values, which only tools read, −0.4% [−0.8, +1.4].
4.7 GB of old-format timing runs and eight stale `/tmp` worktrees are gone too.

## November 7: every simulated frame is charged, or the compile fails

The engine counts every frame it simulates, and `compileHandoff` compares the count with
the frames it charged, less those charged on the independent judge (its two replays of
the final track). A metered read charges whatever a cache grows by, so a leak inside a
read was always charged; one outside them now fails the compile, which a test checks by
simulating 40 frames when lines are added. No parity cell trips it, and in the four
checked the counts are exactly equal. It costs
one counter add per extension and needs no tool to remember it.

## November 7: tools that answer in a line

`perf:engine` ends with one line per run, and with no options lists the latest runs, so
comparing runs needs no script. It measures whole compiles only, in one frozen directory
per arm, and keeps just `result.json` (16 KB, where runs held gigabytes of source copies).
It reads memory from the timed compiles, accepts a lockfile change, measures a commit with
`--candidate`, and drops the confirmation stage, controls and warmup: a result that
matters gets a second run, as plain guidance. 278 lines to 146. An identical-arms run:
+0.3% [−1.3, +4.2]. `perf:profile` opens with native, JS and GC totals and time by file.
`npm run check` prints one line per step, keeps logs, stops at the first failure and
refuses a Node older than 26. `compare --candidate` accepts saved reference names.

## November 7: owner decisions

The speed goal closes at 5,460 ns. The `Math.pow` rebaseline is accepted: track quality
should not depend on how `pow` rounds. Bun's memory saving matters, for soon rather than now.

## November 7: a compiler review, and where cleverness stays

Removed: my `predictions` memo (−0.06%, no cost), `restoreCandidate`, the identity checks
in the policy index. Measured and kept: the top-k heap in control retrieval, since a plain
sort cost +4.1% [+2.8%, +5.1%], or +5.2% with typed indices; and the partial-distance
bound, whose removal cost +1.2% [+0.1%, +2.8%]. The line drawn: raw pointers and hidden
state must earn a lot, while a pure, local, tested function may stay for a clear gain.
`perf:engine` now defaults to what it is used for: whole compiles, margin 0.5%.

## November 7: an engine with less scaffolding

An independent review of the engine found the core sound and the waste in leftovers.
Removed: `cur` and `cur_dirty`, whose reason (repeated truncation) ended when batches
truncated once; the epochs of `QueryCache` and `PointCell`, now plain flags; the
`ActiveCellCache` of raw pointers into the history map; the `frame_index` argument,
always `history.len()`; every collision frame but a line's first, the only one read;
and `getSledPointPositionsAtFrame`. This also undoes two of my own November 7 choices:
the raw pointer in `LineRef`, whose −0.8% was noise, and the `narrow`/`cursor` state
machine, now two plain loops. Paired on real compiles, all together: +1.8% [+0.2%, +4.9%],
8 pairs, about 200 lines fewer in the engine. No part alone was distinguishable from
noise. Accepted: a percent or two is not worth that structure.

## November 7: Math.pow, and `exactPow` removed

This replaces the `exactPow` entry below: rebuilding an old V8 routine to keep tracks
still was the wrong trade. Math.pow from Node 24 on calls the system libm, and that is
stable: Node 26 and Bun, and glibc 2.39 and Arch's 2.44, give identical bits over
3 million samples. It is also the fastest, at 14 ns against 92, and it is no code of ours.
Only `pow` in the compiler reaches libm. A Mac or a musl system may round differently,
and parity would say so.

Tracks change, once. Stated first: no systematic change in quality. V7, 112 paired rides:
headline 780.8 against 782.3, −1.6 [−5.3, +2.2]; 10 specs up, 12 down, by up to 13;
112 of 112 finished both ways; explicit requests 763.8 against 766.5, 216 of 216 gaps
realized both ways; physics 2.98 M against 2.99 M frames. That is a new draw of the same
compiler, on tracks earlier decisions were never tuned to. References updated here.
Three compiles under Arch's glibc 2.44 match them exactly. Parity's reach barely moved:
four small branches, 381 bytes, are no longer visited.

## November 7: current tools, no machine in the repo

TypeScript 7 typechecks in 0.35 s, from 1.9 s, with no source change beyond declaring
`types: ["node"]`. Also vitest 5, Playwright 1.65, @types/node 26 and esbuild 0.28.2. `reach` keeps the
TypeScript 6 compatibility package for now, since 7 has no parser API until 7.1.
`engines` is now a range and `.nvmrc` a major, because parity, not a pin, proves a
runtime. `perf:score` no longer refuses another Node or assumes this laptop's cores:
it inherits affinity and names its CPU and Node. Bun 1.4.4 runs the compiler unchanged
with 35% less memory, but at equal speed (5,431 and 5,487 ns against 5,463 and 5,587,
four alternating runs), with different tracks, since its exp, log and atan2 are not
V8's. Node stays; memory is the case for revisiting it.

## November 7: where the clean gains stop

At 5,465 the goal of 5,000 needs 1.3 s more from a 15 s compile. Measured on Node 26 and
rejected: a SIMD engine build (no gain), V8 inlining budgets, earlier tier-up and tiering
settings (all within drift, and the same command moved from 14.5 to 15.1 s within one
session), and `x * x` for `x ** 2` (equal once optimized). History scans find nothing in 91%
of 158 k calls, but a per-batch cache of their cell lists gave −0.3%, within noise. Removing
`SnapshotBounds` to simplify the scan cost 3.7%, so it stays. Next by size, each still to be designed and neither started: an overlay for
candidate lines, perhaps 0.5 s of registration, and measurement in Rust, perhaps 1 s of a
6.4 s JS share. Both add real structure, so they need an owner's decision.

## November 7: Node 26, and a `pow` of our own (superseded above)

V8 14 runs the same compile 6% faster than V8 12, native and JS alike, with no source
change. Maglev alone on Node 22 was slower. Tracks moved at first, and the cause was
one function: Math.pow in Node 22 is V8's fdlibm routine, and from Node 24 it is the
system libm, which rounds 9% of results differently. `exactPow` reproduces the Node 22
routine, 45 million samples exact, so tracks are byte-identical on both Nodes and no
longer depend on a machine's libm. It costs 60 ns more per call. Other Math functions
match. All 25 cells and 10 judged tracks are exact on 26.13.0. Node 26 is the newest
LTS; Node 24 timed the same. Score 5,465. Larger young generations stay within noise on
V8 14 too. Rejected: `pow` in the engine binary, about 1.6%, because a math helper does
not belong to the physics contract and `--reference` engines would need its export.

## November 7: what stepping is made of

Splitting `step_state` for one profile: the rider's constraint solver takes 2.9 s of a
15.5 s compile, its 120 square roots and divisions per frame cannot be skipped or reordered
exactly, and sweeps, near lines and registration are 1.7, 1.6 and 1.9 s. Bucket searches
chased two pointers for each line id, so a reference now carries its id: −0.8%, within
noise, and simpler to read. Rejected, each measured: comparing positions instead of
dividing per sweep (−0.2%), `wasm-opt -O3` (no change), compact retained candidate
geometry (scavenges 810 to 750 ms, not worth a new type). V8 is healthy: 172 deopts,
controls keep fast properties, mark-compact costs 23 ms. Of 160 k candidates, 106 k pass
every check, so measurement is not wasted on losers.

## November 7: test only the lines a point can reach

A collision sweep tested about 360 lines per frame, and 90% were out of reach of any
point within two pixels of where the frame began. Each point now keeps those near lines,
chooses again if it moves further, and falls back to its full list after a hit, so the
order of tests that can matter is unchanged. Paired on real compiles: −2.92% [−4.29%,
−1.24%], 8 of 8 faster. Rejected: one combined pass in place of the direction and reach
passes, −0.6% and inconclusive, because the branchless direction pass is what pays.

## November 7: rank candidates lazily

The future-value model ran for every viable candidate, though ranking needs only the
best few. A prediction is never negative, so base rank bounds each candidate from
below and most are never predicted; a 200-seed test matches the full sort. Paired on
real compiles: −2.78% [−3.73%, −1.48%], 8 of 8 faster. V8 semi-space, Liftoff,
Sparkplug and feedback settings stayed within noise, so the runtime needs no flags.

## November 7: one speed number

`npm run perf:score` reports ns per charged frame on two real compiles, one at a time.
Two runs gave 6,128 and 6,166. The goal is 5,000 with identical tracks
([brief](docs/performance-goal.md)).

## November 6: using the tools as written

Running each documented workflow found what gates did not. `perf:engine --against`
failed once audio existed locally, so snapshots now exclude everything git ignores.
`production.html` kept a link to a removed stylesheet; a test now checks local page
assets. `npm run measure` needed October data and is gone. In real Chromium, `?t=12.5`
opens at 12.50 s and the retired `?review=` is ignored. `npm run check:smoke`, now part
of `check`, runs these workflows; it caught both page bugs when they were put back.
The saved review collection still predates the compiler.

## November 6: one compiler, one ruler, one panel family

Owner decisions: retire landing, strike v1 and v2 as compile modes, the V3–V6
lineage, the dev, confirm and bench panels, the night report and the October 2
review study. V1 and v2 stay as report rows. `perturb` stays, because the unanswered
night study's saved runs use it. `npm run eval` stays for one-checkout panels.

Coverage over 114 runs chose the parity cells: 28 KB of search code (backtracking,
budget failure, section fallback) had never run under parity. Fourteen new strike3
cells, recorded from the old code before any removal, make 25; all stay exact after
it. They lose only the retired branches. Parity: 228 s this morning, 58 s now, with
more coverage. Direct old/new timing of one real compile: unchanged, about 16.6 s.

New baseline `lean-foundation` (dcb0fc3a, after review and simplification), V7 at the standard allowance: headline
782.3, explicit requests 766.5, 112 of 112 rides finished, 8 min 21 s. Open questions
and unanswered blind studies are in `TODO.md`. Rename of `scripts/v0` deferred.

## November 6: lean foundation, first pass

Goal: a clean base for resuming headline work. Parallel compiles within a ride are
ruled out: headline work is already parallel across rides. Raw evidence left the
repository (`docs/research` 77 → 3.4 MB); see "Recording decisions" in WORKING.md.
One `WorkerPool` replaces five spawn loops. `npm run reach` was wrong: comments and
module specifiers made edges, and all of `tools/**` counted as entries. Rebuilt on
the syntax tree, it found about 4,300 dead lines; deleting those and 62 unreferenced
declarations takes live code from 35,991 to 30,100 lines, with `noUnusedLocals` on.
Tests fall from 457 to 418 with the deleted code. Tracks, work and the engine binary
are unchanged. The night page stays: it may hold unanswered owner questions.

## November 6: measure real compiles; −3.89% on the production workload

The timing target used a warmed 150 k cell, 5% of a real compile, with a different
profile. `perf:engine` now defaults to the standard allowance, cold, with
`--against=<ref>`; `perf:profile` shows where a real compile goes. The 6,500 ns
target is retired with its workload. Fresh twelve-pair comparison with `3b1e0ae0`:
−3.89% [−4.10%, −3.39%], 12 of 12 faster, both songs individually; 17.2 → 16.5 s.
All structural gates pass: 452 JS and 32 Rust tests, 65 physics cases, 63 compiler
cases, 33 judge tracks. Worker defaults follow measured memory; parity takes 155 s.
Sibling trajectory reuse and several other ideas are rejected with evidence.

[Findings, rejected ideas and the remaining ceiling](docs/research/engine-real-workload-20261106.md).

## November 6: consume cached contacts directly; confirm 6,724 ns

Contact-only finalization and replay consumers no longer manufacture full
constraint/update streams. The independent judge adapter exposes cached contact
presence and IDs; guide pruning consumes a shared contact snapshot as a pure
operation. Both physics binaries, search behavior and charged work are unchanged.

Fresh 24-pair confirmation is **−4.419% [−4.552%, −3.983%]**, qualifying at the
declared 0.5% margin. The candidate's separate arm median is **6,723.99 ns per
charged frame**; the 6,500 ns target remains open. Larger and cold guards pass.
All 800 measured/warmup/resource compiles are exact, and the full structural
suite passes: 451 JS tests, 31 Rust tests, 65 physics cases, 63 compiler cases,
33 judge tracks, zero type errors and zero unreachable files.

[Design, measurements and validation](docs/research/engine-contact-readers-20261106.md).

## November 6: audit retrieval work and reject partition-bound machinery

Full model queries never repeat, and alternate memo-key encoders are slower;
retain neither cache nor encoder change. A global partition bound can exclude
85.5%/80.8% of default/larger physical-distance calls, but the first implementation
regresses and is abandoned after nine pairs. Profiles localize a shared-distance
function cost increase; a scalar revision removes it but screens inconclusively
at −0.410% [−0.802%, +0.072%]. Remove both versions and preserve their evidence.
Repeated future-feature suffixes remain a static opportunity, not an adopted index.

[Query-cost audit](docs/research/engine-query-cost-20261106.md).
[Partition-bound experiments](docs/research/engine-partition-bound-20261106.md).

## November 6: an exact angular shortcut misses confirmation

A conservative kick-angle predicate removes 99.3% of `atan2` calls in two
workloads, with exact complete checkpoints and full validation. Screening passes,
but fresh confirmation is −0.379% [−0.869%, +0.082%], inconclusive at the declared
zero margin. Remove the candidate; retain the evidence and numerical tests in
the study archive. The last qualified default result remains 7,172.5 ns/frame.

[Angular exclusion study](docs/research/engine-kick-gate-20261106.md).

## November 6: runtime probes and a rejected memory tradeoff

Keep the pinned runtime after Node 24/26 feasibility probes. Exact duplicated
model rows offer too little distance-reuse opportunity to justify a cache.
An explicit 32 MiB V8 semi-space setting improves default and larger compiler
timings, but raises larger cold-process peak RSS by 16.3%, exceeding its declared
15% allowance. Reject it before confirmation and retain no runtime configuration
change. The default screen's 6,997 ns/frame is not a qualified target result;
7,172.5 ns remains the last qualified default measurement.

[Runtime and retrieval probes](docs/research/engine-runtime-probes-20261106.md).
[Nursery tradeoff and rejected evidence](docs/research/engine-nursery-20261106.md).

## November 6: remove the compiler's runtime transpiler

Run CLI and measurement workers directly on pinned Node 22.22.2. Explicit fields
replace two parameter properties; erasable syntax and verbatim type imports are
checked statically. No search/physics change or new production mode. Fresh
24-pair confirmation is −3.530% [−3.764%, −2.995%], with a default median of
7,172.5 ns per charged frame. Larger and cold guards, native null control, full
structural validation and complete checkpoint equality pass. WASM capacity is
unchanged; separate default/larger peak-RSS observations are lower.

Preserve the loader policy as the explicit treatment, with a one-off recorded
runner and exact lock metadata audit; the normal shared-input guard stays strict.
The <7,000 ns target remains open. Earlier history reconstruction, version-owned
bounds, insertion-capacity and exact-solver shortcut trials were rejected; their
code is absent and their evidence is preserved.

[Runtime qualification](docs/research/engine-node-types-20261106.md).
[Algorithm and allocation studies](docs/research/engine-exploration-20261106.md).


## November 5: omit provably empty collision sweeps

Adopt a conservative whole-grid bound that skips all ten point queries only
when every neighborhood is provably empty. Constraint arithmetic, traces,
history snapshots, frame charging and search behavior remain exact. Per-point
scratch now excludes the two binding-status entities. An exhaustive-query
shadow validates 246,491 / 1,212,820 excluded sweeps and both full checkpoints.

The initial version passed timing but failed its unchanged-capacity guard;
close it without confirmation. The smaller representation saves 320 KiB of
default WASM capacity while adding one 64 KiB page (0.19%) on the larger case.
After untimed probes, before this version's timing, explicitly revise the
resource allowance to one additional page, retaining the +15% RSS guard.
This is assistant engineering judgment; preserve the original failed rule.

Final fixed screen: −1.449% [−1.730%, −1.217%]. Default guard: −0.603%
[−0.975%, +0.391%], bounding regression without establishing a speedup.
Fresh 24-pair confirmation: −1.566% [−1.774%, −1.178%], all pairs faster.
Use a zero speed margin prospectively; the CLI now supports it. All resource
and correctness gates pass: 449 JS, 30 Rust, 65 physics, 63 compiler and 33
judge cases, with types/reach clean. Default descriptive cost is 7,359 ns per
charged frame; larger confirmation is 6,895 ns. Default <7,000 remains open.

Retain the guide/heap abandoned screens, two slower cell-bound trials, and
history-replay demand study alongside the successful algorithmic trial.
[Evidence, proof and policy history](docs/research/engine-empty-sweeps-20261105.md).

## November 5: prepare control rules once and expose timing progress

Prepare active control definitions once per interval, preserving the canonical
registry, candidate ownership and exact normalization. A 202,176-case shadow
and full compiler checkpoints agree. Frozen 12-pair screen: −0.981%
[−1.353%, −0.707%]; separate default guard: −0.704% [−1.342%, −0.186%];
fresh 24-pair confirmation: −0.660% [−0.840%, −0.434%]. The original 0.5%
confirmation verdict is INCONCLUSIVE. Explicitly correct the assistant's hard
0.5% adoption minimum after 17 confirmation pairs to honor the owner's earlier
preference for supported smaller gains with simple code; preserve both policies
and the unchanged verdict. Adopt with all correctness/resource guards passing.
Default descriptive timing is 7,403 ns per charged frame; <7,000 remains open.

After measurement, add descriptive running medians and pair counts, readable
unfinished reports, and atomic evidence snapshots. Partial trials can be
abandoned but cannot qualify a candidate; fixed-sample inference is unchanged.
Evidence and validation: `docs/research/engine-control-normalization-20261105.md`.

## November 4: keep candidate facts minimal and measure geometry at reporting

Trajectory workspace reuse also misses the 2% speed gate: screen −2.052%
[−2.588%, −1.693%], INCONCLUSIVE. Finish its declared default guard and preserve
the trial; no confirmation or extra pairs. Leave the working-array change out
of the next candidate and retain the simpler facts/fixed-future implementation.

Further ownership audit finds two residual slices created for every candidate:
arrivalResiduals has no consumer; localResiduals is used only in a research
report. Keep one vector plus its local partition count, derive a slice only at
that report, and remove optimizationCost, which always duplicates cost.
Likewise grain is a geometry-only reporting axis, never a search term. The
counter records 1,201,491 line lengths across cell-62 full-axis measurements.
Keep trajectory reductions in candidate facts and add grain only at reporting,
using one existing grain formula and the canonical axis field order. No scoring,
model, search, observation or native arithmetic changes.

Compare this new combined candidate independently with `4d2346e8`: fixed v3
cell-62 screen12 then fresh confirm24, both FASTER at 2%, and separate
default-cell-61 guard12 bounding regression at +2%. CPU 2, five warmups,
three repeats, requested 95% confidence, seeds 1729/2718. Require unchanged
WASM capacity, at most 15% higher fresh peak RSS, frozen-reference axis tests,
exact full checkpoints and the full structural gate. Freeze before timing;
no heavy concurrent work, optional extension or unchanged-source restart.

The fixed screen passes: −3.733% [−4.244%, −3.390%], FASTER at 2%.
The default guard passes: −1.739% [−2.222%, −0.465%], bounding regression
below +2% (its two-sided timing verdict is INCONCLUSIVE at the ±2% margin).
Both resource guards pass. The unchanged candidate is in fresh confirm24.

While confirmation is underway, the owner revises the adoption preference:
2% is too rigid as a universal minimum; weigh evidence of benefit together with
cleaner design instead of rejecting a sound improvement narrowly below it.
Keep the frozen protocol, 24 pairs and raw 2% timing verdict unchanged. The
engineering decision now considers the confidence interval and simplicity gains,
with exact correctness and no unresolved meaningful default/resource regression
still required. Earlier trial results and decisions remain recorded as run.

Final confirmation passes at −3.643% [−4.002%, −3.090%], FASTER at 2%.
Adopt the minimal-facts/fixed-future/reporting version; it qualifies under both
policies. All 774 measurement compiles match exact tracks/work, all resource
guards pass, and `npm run check` passes (442 JS, 29 Rust, 65 saved/live physics,
63 compiler cases and 33 judge tracks; types/reach clean). Frozen source/test
hashes remain unchanged. Default median compile cost is 7,432 ns per charged
frame; the 7,000 ns default target remains open. See the
[full trial history and evidence](docs/research/engine-candidate-records-20261104.md).

## November 4: reuse the candidate trajectory prefix

The facts/future-feature screen closes at −2.470% [−2.798%, −1.960%],
INCONCLUSIVE at the declared 2% margin. Its default guard passes at −0.835%
[−0.979%, −0.498%], EQUIVALENT; all 388 compiles match tracks/work and both
resource guards pass. No confirmation, extra pairs or adoption of that version.

The next candidate also removes repeated trajectory-prefix copies. Isolated
counters find 28,113 reusable replays copying 25,021,462 unchanged prefix entries
versus 669,523 suffix entries on cell 62 (default: 5,141 replays, 4,431,336 prefix
entries and 117,886 suffix entries). One interval-owned working array retains
its prefix and replaces the suffix. Evaluation borrows it synchronously, just
like detector storage; the immutable prefix retained by terminal scoring stays
separate. Invalidated prefixes continue to use the existing full native read.
Candidate facts never retain the mutable trajectory array. No new cache or API.

Compare the combined change independently with `4d2346e8`. Fixed v3 cell-62
screen12 and fresh confirm24 must both be FASTER at 2%; default-cell-61 guard12
must bound regression at +2%. CPU 2, five warmups, three repeats, requested 95%
confidence, seeds 1729/2718. Require unchanged WASM capacity, fresh peak RSS at
most 15% higher, full-checkpoint equality, focused ownership tests and the full
structural gate. Freeze before timing; no concurrent heavy work, extra pairs or
restart of an unchanged candidate. All earlier trials stay closed.

## November 4: share candidate facts and prepare fixed future features

Keep all earlier screens closed. The owner asks to combine the clean candidate
representation with another improvement to reach the declared 2% threshold.
Fresh profiles of separate live handles still put candidate recording at 3.78%
self time on cell 62. Instrumented exact-checkpoint compiles find 16,299 future
value feature constructions across only 425 eligible interval searches. Their
target and construction suffix is constant within a search. Prepare that suffix
when opening the interval; concatenate each candidate's physical arrival onto
it. Keep one encoding, no cache or compatibility path. Proposal/response feature
shapes, all values, scoring and search remain unchanged. The same counters find
zero excess-amplitude rescans in both cells, so leave that path alone.

The combined candidate is independently compared with `4d2346e8`, not with an
earlier prototype. Fixed protocol v3: cell-62 screen12 then fresh confirm24,
both FASTER at 2%; separate default-cell-61 guard12 bounds regression at +2%.
CPU 2, five warmups, three repeats, requested 95% confidence, seeds 1729/2718.
Require unchanged WASM capacity, at most 15% higher fresh peak RSS, exact full
checkpoints, feature-contract/ownership tests and the full structural gate.
Freeze after focused validation; no heavy work alongside timing, no additional
pairs or restart of an unchanged candidate. No isolated speedup claim for the
feature change from this combined comparison.

## November 4: separate candidate facts from live handles

The flat candidate-record screen completes at −1.140% [−1.585%, −0.008%],
EQUIVALENT within ±2%; its speed gate fails. Finish its fixed default guard
and preserve both results. No confirmation or adoption of that version.

A distinct follow-up removes its remaining whole-record spread: live evaluations
pair `{candidate, child}` instead of copying every measured field to attach an
engine. Local search reads the shared facts; selection and refinement use the
explicit candidate they selected. One canonical owned record and one small live
handle wrapper, with no fallback metadata lookup or compatibility layer.

Reference remains `4d2346e8`. This new candidate must independently pass the
same fixed v3 cell-62 screen12 and fresh confirm24 at 2%, plus default-cell-61
guard12 bounding regression at +2%. CPU 2, five warmups, three repeats, requested
95% confidence, seeds 1729/2718. Require unchanged WASM capacity, at most 15%
higher fresh peak RSS, complete exact checkpoints and the full structural gate.
Freeze after implementation/checks; no other heavy work during timing and no
extra pairs or restart of an unchanged candidate.

The separate-handle screen also fails the speed gate: −1.172%
[−1.570%, −0.833%], EQUIVALENT within ±2%. No confirmation or adoption.
The default guard passes at −0.732% [−1.249%, −0.376%], EQUIVALENT.
All 388 warmup/timed/resource compiles match exact tracks/work, and both
resource guards pass. The owner explicitly asks to keep developing or combine
this idea to achieve the required 2%. Retain it as an unadopted experimental
base, preserving the closed results; profile/count complementary repeated
measurement work before choosing the next frozen candidate. Production remains
the earlier qualified prefix-scoring commit until a candidate qualifies.

## November 4: one owned candidate record

Reference remains `4d2346e8`; the query-normal trial is closed and reverted.
Fresh profiles put candidate recording at 4.78% self time in cell 62. Unlike
the earlier copy-removal trial, consolidate the representation itself: one
read-only measurement/arrival record shared by the candidate list and memo;
only live evaluation adds an engine handle. Remove duplicated `measurement`,
`meta` and memo `result` records; project reporting fields only when selected.
Adapt search, restoration, refinement and study consumers together. Preserve
scoring, selection, record ownership and complete compiler output/work.

Adoption requires larger cell 62 FASTER at 2% in fixed v3 screen12 and fresh
confirm24, plus a separate default-cell-61 guard12 bounding regression at +2%.
CPU 2, five warmups, three repeats, requested 95% confidence, seeds 1729/2718.
WASM capacity must remain unchanged, fresh-process peak RSS may rise at most
15%, and full structural/design gates must pass. Freeze before measuring;
no heavy work alongside timings or extra pairs for an unchanged candidate.

## November 4: contiguous collision-query normals

Reference `4d2346e8`, on `perf/compiler-after-foundations`. Fresh Inspector
profiles (five warmups, three measured compiles, 250 us samples, CPU 2)
retain native stepping/collision lookup as the main cost. Hypothesis: store
the two immutable normal components alongside each flattened neighborhood
entry, so each frame's direction filter reads contiguous values instead of
following every geometry pointer. Preserve the exact dot product, ordered
entries/duplicates, borrowed-pointer lifetime and all invalidation boundaries.
One private query-entry record; no new cache or geometry owner.

Speed adoption requires default cell 61 FASTER at the 2% margin in fixed
v3 screen12 and fresh confirm24; separate larger-budget cell 62 guard12
must bound regression at +2%. CPU 2, five warmups, three repeats, requested
95% confidence, order seeds 1729/2718. Require at most 5% higher WASM
capacity and 15% higher fresh-process peak RSS, exact tracks/work, all
structural gates and a clean design. No heavy work during timing, no
extension/restart of an unchanged candidate, and no target claim from a
different workload. Freeze before timing.

The screen is EQUIVALENT: 0.231%, interval [-0.405%, 1.114%].
The 2% speed gate fails; no guard, confirmation or extra pairs. Candidate
source/package restored exactly. All 30 candidate Rust tests and 65 saved/live
physics cases passed. Raw timing and the candidate patch are retained.

## November 4: improve the near-miss prefix objective

Owner explicitly requests another attempt at the strongest prior approach.
Keep that trial's evidence unchanged; this is a new implementation, not extra
pairs for the old candidate. Reference remains the executable tree at `4edec76a`
(identical to `61c88f1c`); branch remains `perf/compiler-after-foundations`.

Hypothesis: completed support costs make cached motion samples redundant. Observe
only the earliest unfinished support and its burst history, retaining scalar
costs instead of whole-prefix sample arrays. Measure only targeted objective
axes, cache their completed reductions, and reuse completed contact engagements
while recomputing the trailing open engagement in full. Keep one scoring formula
and the original accumulation order, with an independent frozen full-rescore
test oracle and real-compiler shadow comparisons.

Adoption requires a speedup on larger-budget cell 62: fixed v3 screen12 then
fresh confirm24, CPU 2, five warmups, three repeats, requested 95% confidence,
2% practical margin. Both stages must be FASTER. A separate fixed default-cell
61 guard12 must bound regression at +2%. Require unchanged WASM capacity,
no more than 15% higher fresh-process peak RSS, exact tracks/work and the full
structural gate. Freeze executable sources before screening; no heavy work
alongside timings, no extending an unchanged trial, and no absolute-default
speedup claim from a high-budget improvement.

Focused validation passes: typecheck/reach and 30 tests, including an independent
frozen full scorer. Actual compiles compare all 394 terminal losses and regret
arrays exactly, with unchanged tracks/work. On cell 62 the new scorer reads
52,982 motion rows versus 682,880 in complete rescoring, and 49,002 engagement
rows versus 691,028 (excluding the old impact diagnostic's additional gain scan).
These are work counts, not speed claims. Source is frozen before timing;
screen/guard use order seed 1729, fresh confirmation uses 2718.

The fixed screen qualifies: −2.641% [−3.246%, −2.271%]. The separate default
guard passes at −0.176% [−1.228%, +0.601%], EQUIVALENT. Fresh confirm24 also
qualifies: −2.903% [−3.111%, −2.657%], with larger-workload medians 7,581 →
7,365 ns/charged frame. All 774 warmup/timed/resource compiles keep exact
tracks/work. WASM capacity is unchanged and every peak-RSS guard passes.
Adopted after `npm run check` passes on the exact frozen source: 439 JavaScript
tests, 29 Rust tests, zero type errors/unreachable files, 65 saved/live physics
cases, 63 exact compiler cells and 33 judge tracks. The default workload remains
equivalent at 7,527 ns/charged frame; the 7,000 ns target is not met. See
[the study](docs/research/engine-prefix-scoring-20261104.md) for raw evidence.

## November 4: resume performance work from the calibrated foundations

Branch `perf/compiler-after-foundations`, reference `4edec76a`. Fresh V8 Inspector
profiles (250 us sampling, CPU 2, five warmups and three measured compiles) put
candidate recording at 0.99% of default cell 61 and 8.34% of high-budget cell 62.
Its own body accounts for 0.61% and 4.39%; whole-trajectory scoring is only part
of that cost. Native replay and geometry registration remain the largest costs.
The unprofiled baseline is about 7,500 / 7,700 ns per charged frame under this
warmup policy, which must not be compared directly with historical one-warmup
results. Exact track hashes and charged work match in all diagnostic iterations.

First hypothesis: build owned candidate facts directly, instead of creating a
live result, copying it twice to omit its engine, then copying the candidate for
the memo. Search and memo can share their owned measurement; the live result is
the one wrapper that adds an engine. This removes redundant object copying and
expresses the ownership boundary at construction, without changing scoring,
search order, lifetimes or the native engine. Source is frozen before timing.

Predeclared adoption: speed improvement required, not a memory tradeoff. Protocol
v3, compile cells 61 and 62, CPU 2, 12 screening pairs then 24 fresh confirmation
pairs if qualified; five warmups, three repeats, 95% requested confidence and a
2% practical margin. Require aggregate FASTER in both stages and each cell's
upper regression bound at most +2%. Report both cells separately; an aggregate
win does not establish a default-cell speedup or the 7,000 ns target. Preserve
every result, collect resources separately, and require the full structural gate
and a clean design before adoption. No other heavy work during timing.

The first screen is complete and rejected: aggregate −0.32% [−1.26%, +0.16%]
(EQUIVALENT within ±2%), default cell 61 −0.24% [−1.17%, +4.38%]
(INCONCLUSIVE, failing its regression guard), cell 62 −0.65% [−1.39%, −0.33%]
(EQUIVALENT). All 384 warmup/measured compiles and four resource compiles kept
exact tracks/work. WASM capacity stayed 17.3125 / 32.5 MiB. No confirmation or
repeat was run; the candidate code is reverted. Raw evidence is retained in
`docs/research/engine-owned-candidate-20261104-screen.json`.

An untimed V8 layout audit closes the control-deletion hypothesis: all 9,905
default controls keep fast properties, and only 255 of 44,631 large-workload
controls lose them. Default terminal scoring runs only six times, versus 388
times at the larger budget; it cannot explain a large default-workload gain.

Next diagnostic: share direction filtering among points within the *same solver
frame*, using their actual velocity bounds. This differs from the rejected
fixed-rectangle cache across changing velocities. Count original direction dots,
unique cell/frame queries, ambiguous lines needing all ten exact predicates and
the resulting extra collision-line visits; check every proposed common verdict
against all ten original predicates while leaving the solver unchanged. Proceed
only if the conservative cost (two bound dots per query line plus ten dots per
ambiguous line) removes at least 50% of original dots, and shared lists increase
collision-line visits by no more than 10%. Otherwise close this design without
a production cache or timing trial. Both diagnostic cells must keep track/work.

The shared-frame direction design fails: the default workload would increase
direction dots by 95.26% and collision-line visits by 29.01%. Both cells preserve
exact track/work in the unchanged shadow solver; no production change follows.

A distinct diagnostic tests certificates over *line normals*, not a fixed
velocity rectangle or a shared superset. Each query keeps component bounds for
its accepted and rejected normals. At a new velocity, at most two exact bound
dots may prove that the complete ordered filter is unchanged. Validate every
predicted reuse against the original full filter. Before implementation, require
at least 50% fewer estimated arithmetic operations, counting three per dot and
four bounds updates per line on a miss, plus the certificate dots. No parameter
tuning or timing follows a failed diagnostic. Output/work must remain exact.

The normal certificate also fails: estimated arithmetic rises 64.84% / 57.81%
in the two workloads, despite exact shadow verdicts and track/work. No cache is
added. Investigation then identifies unnecessary whole-trajectory scoring during
refinement: only planning reads candidate terminal scores; refinement sorts by
local cost and judges its shortlisted complete revisions separately.

Demand counts close that lead for these workloads: default has 6 terminal
scores and large has 388, but neither has a terminal score from local refinement.
All are needed by planning. No deferred score or phase option is introduced.

Next implementation hypothesis: a search's whole-trajectory objective can reuse
owned measurements of its unchanged raw prefix. Cache only completed span-axis
reductions, motion samples whose next velocity is in the prefix, and completed
support motion terms. Preserve the original per-axis/per-support accumulation
order, recompute boundary-dependent observations, and fall back to full scoring
when the candidate does not extend that prefix. Reuse the already-continued
strike events for terminal accounting instead of detecting the same prefix again.

Predeclared adoption requires a speedup on the larger-budget cell 62: protocol
v3, CPU 2, screen12 then fresh confirm24, five warmups, three repeats, 95%
confidence, 2% margin. Separately run a fixed cell-61 guard12 with the same policy;
its upper regression bound must be at most +2%. Separate processes avoid the
large-cell heap affecting the default workload's warmup. Report absolute timings
for each workload; this does not establish the 7,000 ns default target. Require
unchanged WASM capacity, no more than 15% increase in separately measured peak
RSS, exact track/work and the complete structural validation gate. Freeze all
executable changes before screening; no timing/profiling/check overlap.

The prefix-objective screen measures −2.498% [−3.197%, −1.997%], narrowly
INCONCLUSIVE at the declared 2% margin. No confirmation or extra pairs follow;
the default guard finishes as declared, then the candidate is reverted. Its
patch, all 394 exact shadow scores and the complete timing evidence are retained
in `docs/research/engine-performance-20261104.md` and its linked artifacts.

Next hypothesis: collision-history snapshots duplicate velocities already held
by their owning saved frame. Velocity is fixed during all six solver sweeps;
only position changes. Keep the exact snapshot position and point identity,
resolve velocity from that frame, and consolidate the inline/linked snapshot
records. Expected linked-record size is 24 bytes instead of 40. History and
saved states already clone and roll back under the same FrameCache owner.

This trial permits a resource tradeoff: require at least 15% lower WASM high-water
capacity in both cells 61/62, reproduced in three fresh processes per arm/cell;
peak process RSS must not rise more than 15%. CPU regression bounds must be at
most +2% in separate fixed 12-pair v3 compile guards for both workloads (CPU 2,
five warmups, three repeats, 95% confidence, 2% margin). No speedup claim without
fresh FASTER confirmation of a qualifying screen. Also report native workload
costs separately. Full structural gates and a straightforward ownership model
are mandatory. Check resource eligibility before spending the timing rounds;
do not change the thresholds after observing results.

The velocity-storage trial passes 30 Rust tests, all 65 saved/live physics
cases and all 12 fresh compiler resource observations with exact track/work.
WASM capacity falls 17.3125 → 15.625 MiB (9.75%) and 32.5 → 31.375 MiB (3.46%).
It fails the declared 15% resource gate in both workloads. No timing trial or
adoption follows; source and packaged binary are reverted. The complete patch,
resource observations and validation counts are archived with this round's
diagnostics. Smaller individual records are not sufficient evidence of a useful
whole-workload improvement.

Round closed with no production change adopted. All 788 warmup/timed/resource
compiles preserve exact track/work. The final restored tree passes `npm run
check`: 424 JS tests, 29 Rust tests, zero type/reach errors, 65 saved/live physics
cases, 63 exact compiler track/work cells (254 s), and 33 judge tracks. Native
WASM remains `b0fc5d3b…`; all executable sources match `4edec76a`. Latest paired
default reference median is 7,578 ns/charged frame with five warmups; the 7,000 ns
target remains unmet. Full results and rejected patches:
`docs/research/engine-performance-20261104.md`.


## November 4: separate saved physics contracts from generation provenance

Review exposed that `check:physics` compared historical generation hashes with
current files. Reproduced with the documented `npm run build:wasm` and Binaryen
133: the oracle changed from `fd01a182…` to `dcd97ed5…`, and the saved check failed
before comparing any physics. The same design also required a local judge for a
saved check and invalidated evidence on harmless generator/corpus-source edits.

The single current reference format now separates the encoding contract from
historical provenance. Verification checks encoding, ordered case/input identities
and physical fingerprints; it never reads a judge or generation-source hashes.
Generation reads the independent oracle once and hashes those exact bytes. The
fixture's format-only migration preserves all cases, expected physics and original
oracle/generator/corpus provenance. No compatibility reader or new dependency is
introduced. Build/setup documentation now describes the separate saved and live
checks consistently.

Regression tests exercise the real CLI in minimal checkouts with an absent or
unusable judge, harmless source edits, and a valid byte-different oracle. They
verify explicit generation/provenance, no overwrite, and rejection of incompatible
formats, changed inputs (including an RNG dependency), missing/reordered cases
and altered physics. The new tests also pass a standalone strict TypeScript check.

Validation: the documented `npm run build:wasm` with Binaryen 133 followed by
`npm run check` passes: 424 JS tests, 29 Rust tests, zero type/reach errors, all
65 live/saved physics cases (68,827 frame states and 432,018 ordered collisions),
all 63 exact compiler track/work cells (256 s), and all 33 judge tracks. Direct
checks also match every saved case with both the original Cargo artifact and the
optimized artifact. The optimized local judge is retained; the packaged native
WASM remains `b0fc5d3b…`. No compiler/judge expected result or physics fingerprint
changed. Performance optimization remains paused.

## November 4: simplify and calibrate the foundation workflow

Follow-up on `refactor/compiler-foundations`, based on `148dc46d`. Scope: one
exact paired timing interval and explicit non-regression margin; saved physics
fingerprints plus live/stress checks; owned counterfactual study state; concise
fast/full/performance commands. No physics or compiler behavior change intended.
The fixed calibration protocol is predeclared in
`docs/research/compiler-foundations-20261104-calibration.md`. Two null controls
and one real 5% CPU slowdown control will all be retained, including failures.
Performance optimization remains paused.

Completed: quick saved-reference parity now covers 65 cases, 68,827 states and
432,018 ordered collisions in a 53 KB fixture; its first isolated run took 0.61 s.
The full live check covers the same corpus, and lifecycle/charged-work checks
remain independent. Counterfactual studies own copied search state and a rebuilt
engine prefix, replacing private-array save/restore. The study CLI requires a
fresh output and records its preparation policy. Current commands and contracts
are consolidated in `docs/engine-validation.md`; `check:physics` is fast feedback,
`check` is the full gate, and `perf:engine -- --help` explains the paired experiment.

Timing v3 uses a balanced randomized AB/BA order, fixed warmup/repeats, all raw
iterations and one exact median-change interval with a predeclared practical
margin. All three fixed controls passed: null intervals [−0.13%, +0.57%] and
[−0.99%, +0.55%] fit ±2%; the real 5% CPU slowdown measured +5.09%, interval
[+4.62%, +5.41%]. All raw records, the warmup pilots and the earlier failed v2
control are preserved. This qualifies neither an optimization nor steady state;
it supports the declared resolution on cell 61. The WASM remains unchanged.

Validation: full structural gate passed (412 JS tests at that checkpoint, 29 Rust
tests, all 63 exact compiler track/work cells and 33 judge tracks, zero type/reach
errors). Final option/research-CLI checks pass (17 focused tests; suite total 418).
Calibration contains 576 exact warmup/measured compiles plus six resource compiles.
Results and provenance: `docs/research/compiler-foundations-20261104-calibration.md`.

## November 4: implement the compiler and engine foundations

Implemented on `refactor/compiler-foundations`, based on `27562780` (executable
baseline `13f9175b`). This is structural foundation work. Performance optimization
remains paused; physics, search policy, scoring, budgets and parity references
are unchanged. The packaged WASM remains byte-identical:
`b0fc5d3bd8da5e7c136607de11e347ce8823c88909da075b4f2cbe1471b7481c`.

- The real evaluation CLI failure/resume test now generates its own local music
  fixtures in an isolated git root. It still exercises all 24 failed workers and
  incompatible-resume rejection, without requiring production audio downloads.
- Candidate facts, evaluated candidates and accepted/rejected memo records have
  explicit types. Owned measurements reject live engine handles, and cached
  prefix geometry is read-only. Runtime layouts and evaluation order are preserved.
- Public detections are read-only, including nested observations. Packed motion
  reads use a synchronous callback; calls to any engine during that read fail
  before invalidating the shared view. Owned results survive subsequent reads.
  Compile-only negative tests cover mutation and asynchronous-consumer mistakes.
- Compiler accounting rejects reentrancy before a nested compile can reset it,
  and restores caller limits on every exit. Study observer installation is scoped
  and exception-safe. The arbitrary counter-refund API is replaced by a scoped
  research probe that restores both counters and the limit after failure or
  budget interruption. Both existing study consumers use the scoped interfaces.
- Evaluation, comparison and parity share the conservative CPU/memory worker
  default (four on this host), retaining explicit overrides. Node 22.22.2 and
  Rust 1.95.0 are pinned. Native manifests record the actual build toolchain,
  target, release profile, pin hash and environment overrides.
- `npm run check:engine` combines the existing structural gates. Paired compile
  protocol `line.engine-ab.v2` gives CPU and wall time the same `compileHandoff`
  boundary, excluding input preparation, hashing and output. Separate fresh
  processes per arm/cell collect WASM capacity, JS heap, RSS and process peak RSS.
  Old v1 evidence keeps its original meaning. Frozen runners include their new
  worker-policy dependency and snapshots retain toolchain pins.
- Five deterministic seeds exercise 500 mixed add/branch/detach/reset/observe/
  release operations and budget failures. The initial test exposed stale geometry
  in lr-core's shared computed cache after branch/start-reset switches. Native
  output matched a cold JS reconstruction. The final sequence test therefore uses
  cold independent reference replays; cached work has separate metering and
  compiler-parity coverage. No kernel change was needed.

Validation: `npm run check:engine` passed: 401 JS tests at that checkpoint, all 29
native Rust tests, zero type errors, zero unreachable files, all 63 exact compiler
track/work cells, all 33 judge tracks, and native verification of 61,115 frame
states plus 305,336 ordered collisions and the corresponding raw/motion/contact
observations. After adding the saved-report CLI checks, the final full JS suite
passed all 404 tests in 97 files, and typechecking remained clean.

**The A/A checkpoint did not pass.** The fixed eight-pair control used identical
frozen source and WASM, CPU 2, default compile cell 61, one warmup and one measured
compile per arm/process. Its timing rule produced KEEP: mean -1.0985%, median
-0.6514%, bootstrap interval [-2.6137%, -0.1239%], seven wins in eight pairs. That
is a false positive between identical arms, not a speedup. `controlPassed=false`
and `performanceQualified=false` are preserved in
[`compiler-foundations-20261104-aa.json`](docs/research/compiler-foundations-20261104-aa.json).
Both fresh resource samples report 18,153,472 bytes (17.3125 MiB) of WASM capacity.
Heap and RSS snapshots differ and are not retained-live-memory measurements.

The failed control revealed an operational reporting gap: its CLI had exited
successfully and omitted `controlPassed` from the concise output. The final CLI
prints that field, exits nonzero for a failed control, rejects controls as
candidate-confirmation input, and supports `--report=<result.json>` without
rerunning or rewriting measurements. Re-reporting this saved control now exits 1.
The frozen A/A sources predate this report-only follow-up; its raw measurements
are unchanged. The unchanged timing run was not repeated until it passed. No
performance improvement or new absolute frame-speed qualification is claimed.
Before another optimization campaign, investigate timing conditions and declare
a fresh calibration protocol; this control does not clear small-gain claims.

The remaining boundaries are explicit: compilation is sequential per isolated
worker; TypeScript read-only types cannot enforce borrow lifetimes or prevent
mutation through another alias; counterfactual research still owns its specialized
search-state isolation in addition to scoped accounting. No generic concurrent
session or automatic rollback framework has been introduced. The solver and
independent judge remain separate, and the compiler can still evolve its proposals,
objectives and ranking through the existing behavioral evaluation workflow.

## November 4: foundation review before another optimization campaign

Reviewed executable commit `13f9175b` after the owner requested a broader
maintainability checkpoint. Optimization remains paused. This review changes
documentation only; it makes no new timing claim and does not promote another
implementation. Scope: native ownership/cache mutation, the compiler's candidate
and memo boundary, borrowed observations, metering/research hooks, and build,
validation and measurement workflows. The recent full validation still applies
to the unchanged executable; two small lifetime demonstrations supplement the
source review, not the parity suite.

**Assessment.** The core is usable and can evolve; it is not yet the simplest
or most robust complete development system. The latest history sharing is a
good consolidation: one safe immutable-prefix implementation serves states and
collision snapshots, without depending on search ranking or musical objectives.
Private native modules own mutation and invalidation, line batches own immutable
geometry, and the independent judge stays separate. Keep those boundaries.
Keep the measured, localized solver specializations rather than replacing them
with a broad abstraction solely for uniformity. Their unsafe pointer shortcuts
still deserve explicit invariant coverage when mutation paths change.

The compiler remains free to change proposals, ranking, recovery and objectives.
Track/work parity is the structural-change gate, not a prohibition on improving
behavior. Intentional behavioral changes use the existing paired quality panels,
fixed independent rulers, declared inputs and explicit reference updates. Physics
parity and compiler-output parity are different contracts.

Findings and bounded follow-up work, in priority order:

1. **Restore a completely usable validation baseline before another campaign.**
   `tests/eval_evidence.test.ts:70` launches the real evaluation CLI against local
   production assets. Missing `amor_na_praia_46s/audio.mp3` stops planning before
   the intended failed-worker and resume assertions can run. The known red test
   is a coverage gap, not merely a noisy status. Make this scenario self-contained
   with controlled fixtures; retain the actual worker-failure/resume assertions.
   Do not skip it or loosen the assertions to accept an unrelated input failure.
   Completion means the full suite is green without external production audio.

2. **Make candidate ownership and memo contents explicit before expanding search.**
   `arc_interval_state.ts` stores `best`, candidates and memo values as `any`;
   `arc_candidates.ts` ranks/restores untyped records. `arc_lineage.ts` caches a
   prefix hash over mutable `TrackLine[]` references. Current code carefully
   strips engine wrappers from memoized measurements, and the exhaustive
   `EVALUATION_IDENTITY` option classification is a valuable safeguard. Preserve
   both. Define a small set of owned measurement/candidate types and an explicit
   accepted/rejected memo union, with readonly geometry where identity is cached.
   This should be an incremental type/boundary change, preserving runtime object
   layout, evaluation order and outputs; it does not need a new search framework.

   Borrowing also needs a clearer boundary. `getCachedMotionWindow()` returns an
   ordinary `Float64Array`; `DetectionContinuation.withDetection()` passes a
   mutable `Detection` and permits returning that same object. In deliberate
   review probes, a retained detection's speed-array length changed from 40 to
   20 after workspace reuse, and a motion view's first value changed from 4 to
   8 after another engine's read. These violate the documented lifetime contract;
   they are not observed failures of the current consumers. Keep borrowed views
   internal to synchronous observation code and stored results owned. Readonly
   types help prevent mutation but cannot by themselves enforce a borrow lifetime.

3. **Correct host assumptions and capture the supported toolchain.**
   `tools/eval/eval.ts:72` still defaults to 24 workers and
   `tools/eval/compare.ts:293` to 44, while parity already sizes concurrency for
   this 16 GB machine. Use a shared, conservative host-aware default with explicit
   overrides before large quality runs. Oversubscription is an avoidable risk;
   this review did not reproduce an out-of-memory failure.
   The repository has no Node engine declaration/version file or Rust toolchain
   pin. The qualified environment is Node 22.22.2 / V8 12.4.254.21-node.39 and
   Rust 1.95.0. In particular, `hypot2` equality was established against that V8
   calculation; do not assume an arbitrary runtime upgrade preserves it.
   Record supported versions/build provenance and requalify explicit upgrades.

4. **Make the operating boundary explicit before introducing concurrency.**
   `detector.ts` owns global counters/limits, while the engine wrapper owns one
   WASM instance and synchronous engine scopes. This supports the current
   sequential compile inside isolated workers; it is not an in-process parallel
   compiler-session abstraction. Preserve worker isolation. Before permitting
   overlapping or reentrant compilation, scope accounting and cleanup explicitly.
   The production module also exports `refundPhysicsFramesTo`, used by
   `tools/research/catch_price.ts`, and `arc_sequence.ts` exposes a mutable global
   research observer. These are live research facilities, not dead code. Narrow
   their ability to mutate production accounting and ensure exception-safe
   installation/restoration; do not casually extend manual save/restore lists
   when adding compiler state.

5. **Align resource measurements and make decisions reproducible.**
   Compile CPU time in `engine_ab.ts:50` encloses the entire `compileWorker`,
   including fixture resolution and output handling. `compileMs` starts inside
   that worker and includes track hashing before its timestamp. The two fields
   therefore describe different scopes. Existing paired wall-time comparisons
   remain valid under their unchanged protocol; do not relabel those records.
   For a new measurement version, capture CPU and wall time over the same declared
   operation and label complete-process cost separately. Report WASM high-water,
   JS heap and process RSS as distinct resources when measured.
   Keep frozen sources, fixed interleaving, fresh confirmation and exact outputs.
   Consolidate repeated qualification/memory/report steps around those existing
   tools so a decision does not depend on reconstructing several `/tmp` scripts.
   Declare a resource tradeoff policy before future trials; a native timing
   verdict alone is not an overall design/adoption decision. The last memory
   adoption remains explicitly a post-result user-priority decision, with its
   failed original guards preserved.

Alongside boundary work, extend deterministic reference comparisons with seeded
sequences of add, branch, detach, reset, observe and release operations, including
exceptions and budget interruptions. Existing tests already cover many of these
individually. Sequence coverage targets future invalidation/lifetime mistakes;
parity over saved tracks alone is not an architectural proof.

The next phase should address the green baseline, resource-aware tooling and
candidate/observation contracts before renewed tuning. Avoid a wholesale engine
rewrite, a directory-renaming campaign, or adding layers merely to hide the
specialized kernel. The previous campaign should have taken this design and
whole-process profiling checkpoint earlier, rather than spending so long on
small isolated probes. Use bounded campaigns with explicit review points next
time. Runtime, physics, search, scoring, budgets and performance targets are
unchanged by this review.

## November 4: share immutable history and stop after this resource optimization

Coarse geometry-lifecycle instrumentation finds that collision-history cloning
accounts for about 86% of whole-cache clone time. Grid edits shift only about
2.5 entries on average, and walking version ancestry itself is small; neither
supports the proposed broader rewrite. These spans include instrumentation
cost and are diagnostic attribution, not paired performance evidence.

Generalize the existing immutable 64-entry saved-state chunks to `SharedPrefix<T>`
and use the same store for collision snapshots. Detached caches share immutable
prefixes; appending copies a shared partial tail, and truncation bounds visibility.
This consolidates two storage needs without another cache, unsafe operation or
optional implementation. Physics arithmetic, collision order, search, scoring,
work accounting and complete compiler checkpoints remain exact.

Fresh full-default confirmation24 measures **9,149.19 → 9,003.94 ns per charged
physics frame**, a paired **−1.56% [−2.39, −0.77]**. The candidate's absolute
95% interval is **[8,955.22, 9,052.34] ns**; the 7,000 ns target remains unmet.
The larger compile guard8 improves **2.84% [2.32, 3.30]**, 8/8 wins.

The main benefit is WASM linear-memory high-water: **58.8125 → 17.3125 MiB**
(−70.56%) for default compilation and **134.6875 → 32.5 MiB** (−75.87%) for
the larger workload. These are fresh-process high-water sizes, not live heap
or process RSS. Native-only workload memory is unchanged for registration and
replay, and falls from 2.0625 to 2 MiB for branching.

There is a measured runtime tradeoff. The native-only guard24 is **+2.76%
[+2.43, +3.12]**, REJECT, with 0/24 wins. Its descriptive workload means show
branching +4.07%, replay +0.50%, and registration +1.85%. The separate stepping
check12 is INCONCLUSIVE: −0.86% [−2.17, +0.53]. Do not call this a uniform
engine speedup or represent the original native guard as passed.

The original requirement that confirmation's entire interval exceed a 1%
improvement also failed. After confirmation, the owner explicitly prioritized
the large memory saving alongside correctness and absence of substantial
end-to-end regression. Adoption is a resource tradeoff under that direction:
both real compile workloads improve, while the native-only cost is disclosed.
The initial plan, failed gates, user amendment and final judgment are retained.
No run was extended or retried, and the frozen candidate was not retuned.

Validation: 29 Rust tests; all 63 exact compiler track/work cells; 33 judge
tracks; independent native replay over 61,115 states and 305,336 ordered
collisions, including cached observations; typecheck and zero unreachable
files. JavaScript has 389 passes and the existing missing-audio failure in
`eval_evidence.test.ts`. Full sources, raw pairs, diagnostics, identities,
validation and both native binaries are in
`docs/research/engine-shared-history-prefix-20261104.json`.

This is the final attempt at the owner's request. The validated resource
optimization stays on the separate performance branch, without pushing.
Further optimization is paused; the 7,000 ns objective remains unfinished.

## November 4: distinguish observation allocation from addressable runtime cost

The follow-up ownership/demand audit preserves the complete default checkpoint
and its 147,209 charged frames. Across 5,592 native prefix/candidate windows,
all 492,859 rows have their position, velocity, binding flags and contact-presence
values read. Lazy whole-frame fields would not avoid those reads. However, the
search copies 200,850 sled-point names and 277,625 line ids without reading their
array elements. Contact presence and contact detail are distinct interface needs.
The final replay still requires the full records and their exact contact order.

This is an interface opportunity, not evidence for a large speedup. The existing
CPU stacks attribute only **1.70%** of default application time to
`getCachedRawFrames`, including its descendants. The detector shares vectors;
strike observations use ten-point motion rather than the detector's six-point
body velocity. Construction callbacks can invalidate native transport buffers.
The ownership map therefore rejects both indiscriminate signal fusion and a
borrowed buffer spanning an entire candidate evaluation. Do not launch a broad
record-format migration solely from the large cumulative allocation figure.

A separate conservative collision-packet shadow tests an algorithm with a larger
potential runtime scope. Consecutive groups of eight direction-qualified lines
bound the original rounded perpendicular expression. Every original collision
test still executes, and every predicted packet miss is checked against its
actual events. All 30 Rust tests and the exact default checkpoint pass, but only
**28.05%** of 50,368,237 line visits can be excluded, below the predeclared 70%
gate. Avoided visits per packet visit plus build are **1.462**, below 4. Close
this mechanism without a bypass implementation, packet-size tuning or timing.

Production stays unchanged. The next architecture investigation is candidate
geometry registration and shared-lineage version switching: measure the actual
reconciliation, grid, clone and history costs before choosing a rewrite. Full
ownership findings, instrumented sources, corrected initial probe/build logs,
shadow binary and counts are in
`docs/research/engine-observation-boundaries-20261104.json`.

## November 4: profile whole candidate lifecycles before further optimization

Fresh V8 Inspector CPU profiles of unchanged `214e38a8` cover one warmup and
three full compiles each for automatic cells 61 and 62, pinned to CPU 2. A
separate V8 allocation sample covers three default compiles. All nine captured
compiles retain exact track/work and full checkpoint digests. Fixture loading,
warmup and output serialization are excluded; profiler-control stacks remain in
the raw captures but are excluded from application percentages. Linux `perf` is
installed but denied by `perf_event_paranoid=4`; system settings are unchanged.

The compiler's native WASM accounts for about **47%** of application samples in
both workloads. Exclusive phase shares are replay/prefix checks **31.6%/33.6%**,
geometry construction/registration **17.1%/16.3%**, and trajectory assessment,
detection, objectives and candidate recording **12.7%/21.5%**. Candidate recording
alone grows from **0.94% to 8.15%**. Model lookup is roughly **5%** of the default
case; eliminating it cannot close the remaining **22.9%** reduction to 7,000 ns.
These are diagnostic cost shares, not speedup evidence or hardware-counter data.

Default sampled cumulative JavaScript allocation is **886 MiB/compile**, including
collected objects, not live heap or RSS. Materializing cached raw-frame objects
alone accounts for **134 MiB**. Impact observation, strikes, detector arrays and
motion samples allocate further intermediate representations. This profile has a
narrower boundary than earlier allocation studies, so their totals are not direct
comparisons. GC samples remain unattributed to individual allocation sites.

Prioritize the trajectory boundary: investigate one common representation and
explicit observation lifetime across detection, impact, motion and construction
assessment, preserving exact arithmetic and output. Then examine short-lived
candidate geometry versus long-lived version registration, and the larger
case's repeated whole-trajectory scoring. These are hypotheses requiring further
ownership/cost evidence, not demonstrated improvements. Do not repeat the closed object
pool, virtual-view or eager-column trials unchanged. Candidate order, physical
work, collision order and the scoring contract remain fixed.

Standard CPU/allocation flame graphs and a Speedscope export are available in
`generated/report/engine-cost-map-20261104/`. Raw profiles, renderer provenance,
classification code, limitations and design priorities are preserved in
`docs/research/engine-cost-map-20261104.json`. No runtime change or new timing
claim is made; the qualified default remains **9,076 ns/frame**. The next action
is a cross-consumer trajectory investigation, not another series of small probes.

## November 4: qualify scalar two-dimensional norms at 9,076 ns

The final source cleanup removes the duplicate constraint tuple table and
numeric indices while retaining the original ordered calls. Rest constants
derive directly from their fixed endpoints. The packaged WASM is **byte-identical**
to `144ae46c`; executed JavaScript is unchanged. A tested monotonicity argument
replaces the stale repel-gate warning. All 28 Rust tests, 63 exact compiler cells,
33 judge/native tracks, typecheck and reach pass; JavaScript retains 389 passes
and the existing missing-audio failure. This is a maintainability improvement,
with **no new timing claim**. Full evidence: `docs/research/engine-direct-topology-20261104.json`.

The same archive records a closed observation-demand diagnostic: deferred
summary prefixes would avoid only 11.50% of constructions after clone/reset/
rollback effects, below the declared 25% gate. No lazy-summary path is added.

A runtime constraint table removes duplicate metadata/calls and shrinks the two
generated solver bodies **41.61%**. All 28 Rust tests (including 60,000 unrolled
solver comparisons) and independent native replay pass. Screen12 nevertheless
REJECTs it: **+2.02% [+1.42,+2.66]**, 0/12 wins. No loop tuning, confirmation or
adoption follows (`docs/research/engine-constraint-table-20261104.json`).

A single-feature metric bound chosen by model range preserves the original
heap/output/work and checks every predicted rejection. Its extra probes cost
more than the distance terms avoided: **1.96% more arithmetic**, or 8.19% with
model setup. The declared 25% reduction gate fails. No alternate axis, tuning or
timing follows (`docs/research/engine-metric-axis-bound-20261104.json`).

Native history performs 498,884 immutable line-finiteness checks for 402,034
constructed lines: **1.24 checks per line**, below the predeclared 3× reuse
gate. Exact default track/work holds. No precomputed flag or performance trial
follows (`docs/research/engine-line-finite-20261104.json`).

Preparing fold timing once per curve and reusing adjacent stations preserves
165,280 numeric comparisons, 5,000 geometry comparisons, 15 focused tests,
typecheck and the full default checkpoint. Fold exponentials fall 73.24%, but
screen12 is **+0.18% [−0.78,+1.09]**, 6/12 wins, INCONCLUSIVE. No confirmation,
tuning or adoption follows (`docs/research/engine-prepared-fold-time-20261104.json`).

A fresh V8 optimization/deoptimization audit shows **6, 3, then 1** deoptimizations
after the warmup, with exact work/output in every repetition. It does not establish
persistent hot-loop churn. No shape rewrite or runtime-flag change follows
(`docs/research/engine-deopt-audit-20261104.json`).

A conservative grid-envelope diagnostic finds **23.28%** of ordinary ten-point
collision sweeps wholly outside the registered geometry. Every predicted miss
is checked while the complete original solver still runs; exact track/work
holds. The predeclared 25% eligibility gate fails. No bypass, padding tuning or
timing follows (`docs/research/engine-grid-envelope-20261104.json`).

Overwriting detector measurement suffixes before truncating preserves 15,120
frozen-reference comparisons, four resume tests, typecheck and the complete
default checkpoint. Fresh sampled `scanFrames` allocations nevertheless rise
**54.37 → 64.49 MiB/compile**, failing the declared 25% reduction gate. No timing,
tuning or adoption follows (`docs/research/engine-detector-overwrite-20261104.json`).

Ordering learned-policy rows by their existing supervised proximity bounds
reduces full distance calculations by **93.67%**. All 10,335 exact proposal
comparisons, ten focused tests, typecheck and complete default checkpoint parity
pass. The fixed screen nevertheless reads **+0.56% [−0.18,+1.38]**, 5/12 wins,
INCONCLUSIVE. Required KEEP and upper-bound gates fail; no confirmation, tuning
or adoption follows (`docs/research/engine-policy-partition-order-20261104.json`).

Deferring terminal rider-state materialization past trajectory/construction
validation removes 1,985 cached full-state reads (5,592 → 3,607). The complete
default compiler checkpoint is byte-identical, integrating reads and detailed
work match, and 16 focused tests/typecheck pass. Screen12 is **+0.36%
[−0.61,+1.37]**, 4/12 wins, INCONCLUSIVE. Required KEEP fails; no confirmation,
tuning or cleanup bypass follows (`docs/research/engine-deferred-state-20261104.json`).

Inlining the direction filter into the shared point loop passes 27 Rust tests
and exact native replay, but screen12 is **−0.54% [−1.20,+0.03]**, 7/12 wins,
INCONCLUSIVE. Required KEEP fails. No confirmation, tuning or adoption follows
(`docs/research/engine-filter-inline-20261104.json`).

An untimed shared direction-range diagnostic preserves exact track/work and
checks every predicted hit against the complete ordered result. Fixed ±0.25
velocity rectangles could skip 1,832,622 of 15,779,285 direction dots, but their
certificates need 13,741,636 extra dots: **75.47% more**, before cache overhead.
The declared reduction gate fails. No cache, parameter tuning or timing follows
(`docs/research/engine-direction-ranges-20261104.json`).

Separating raster offsets from hot collision geometry and calculating acceleration
only on an acceleration hit reduces the actual WASM line record from 104 to
80 bytes. All 29 Rust tests and independent native replay pass; 96 additional
acceleration scenarios match 7,776 states and 19,318 ordered collisions. Its
screen12 remains **INCONCLUSIVE: −0.27% [−1.23,+0.67]**, 7/12 wins. Required
KEEP fails; no confirmation, tuning or adoption follows. Full evidence:
`docs/research/engine-hot-line-record-20261104.json`.

Sharing immutable geometry buckets across cache copies passes 28 Rust tests and
independent native replay, including ownership and edit-isolation checks. The
fixed screen12 is **+1.07% [−0.20,+2.48]**, 5/12 wins, INCONCLUSIVE. Required
KEEP fails; no follow-up timing, tuning or adoption follows. Source, tests and
raw pairs: `docs/research/engine-shared-grid-buckets-20261104.json`.

An owned numeric-column impact representation passes 36 focused tests, typecheck
and 41,971 exact frozen-reference comparisons. It nevertheless loses all 12
timing pairs: **+5.24% [+4.04,+6.56]**, REJECT. No confirmation, tuning or
adoption follows (`docs/research/engine-strike-columns-20261104.json`).

Untimed diagnostics also close two cache proposals. All 195 physical-prefix
observations are unique. Even an unlimited exact whole-state map could reuse
only 8.86% of ordinary collision-free steps, before validation or lookup cost;
this fails the declared 25% eligibility gate. Neither cache is implemented.
The impact read-demand counts and both exact track/work checks are preserved in
`docs/research/engine-prefix-demand-20261104.json`.

Indexed strike traversal and avoiding an empty-prefix continuation copy pass
17 focused tests, typecheck and 23,061 frozen-reference comparisons. The fixed
screen12 is inconclusive: **+0.45% [−0.36,+1.36]**, 5/12 wins. Required KEEP
fails; no confirmation, retry or adoption follows. The qualified implementation
and open 7,000 ns target remain unchanged. Full evidence is retained in
`docs/research/engine-strike-iteration-20261104.json`.

Full default automatic compilation now takes **9,076 ns per charged physics
frame**, with an absolute 95% interval of **9,037–9,115**. Against qualified
`974e4d2e`, screen12 passes at −4.36% [−5.10,−3.71], 12/12 wins; fresh confirm24
passes at **−3.81% [−4.32,−3.29]**, 24/24 wins. The **7,000 ns target remains
open**. Every timed compile preserves the same track and 147,209 charged frames.

One small `hypot2` helper replaces 47 two-argument calls across 18 compiler
modules. For finite numbers it scales before squaring and keeps the original
two-term operation order; the first compensation in the reference builtin's
Kahan sum is exactly zero. The zero vector returns positive zero, and nonfinite
inputs delegate to the builtin. Three-argument calls remain unchanged. This
removes temporary argument storage without approximate arithmetic or changes
to physics, search, budgets, scoring or the independent judge.

The native guard24 passes its +0.5% upper-bound condition: −0.21%
[−0.49,+0.07], INCONCLUSIVE. Both arms use the identical native binary, so this
is a non-regression check, not a native speedup claim. The larger compile guard8
passes at **8,608 → 8,244 ns/frame**, −4.23% [−4.74,−3.75], 8/8 wins.
Fresh sampled allocations fall about **15.8%**, from 1,146 to 965 MiB per
compile in the profiling protocol; the `hypot` attribution falls from about
124 to 2.4 MiB. Sampling includes collected objects and fixture loading and is
neither live memory, RSS nor timing evidence. WASM memory high-water stays at
**58.8125 MiB** for the default compile and **134.6875 MiB** for the larger one.

All 63 compiler cells, 33 judge tracks and independent native replay pass.
The helper also passes **944,722** numerical comparisons covering signed zero,
nonfinite values, subnormals, arbitrary binary64 inputs and nearby magnitudes
in both orders. JavaScript has 389 passes and the same pre-existing missing-audio
failure; typecheck and reachability are clean. Rust source and binary are
unchanged from the preceding 27-test qualification. Before any helper timing,
the reference was advanced to the newly qualified topology solver and combined
validation was repeated; the original checks and amendment remain archived.
Full source, tests, raw pairs, audits, memory readings, sampled profiles and
upstream algorithm provenance are in `docs/research/engine-hypot2-20261104.json`.

Follow-up state compaction keeps all velocities in one representation and moves
the mixed entity layout to the output boundary. It passes 28 Rust tests and
independent native replay, but screen12 is inconclusive: **+0.08%
[−0.85,+1.00]**, 5/12 wins. Its required KEEP fails, so it is not adopted,
confirmed or rerun (`docs/research/engine-dense-state-20261104.json`). A separate
snapshot diagnostic finds only **0.5268%** exact consecutive-per-point repeats
among 600,761 history submissions. No deduplication path is added. That diagnostic
and fresh CPU profiles of the qualified compiler are preserved in
`docs/research/engine-after-hypot2-diagnostics-20261104.json`; profile timings
include inspector overhead and are not promotion evidence.

Further fixed 12-pair screens leave the qualified implementation unchanged:

| candidate | paired time delta, 95% interval | favorable pairs |
|---|---|---:|
| paired SIMD direction predicates | +0.31% [−0.62,+1.30] | 6/12 |
| streaming motion summaries | −0.46% [−1.82,+0.96] | 7/12 |
| adjacent x/y state with scoped compiler vectorization | −0.93% [−2.04,+0.19] | 9/12 |

All three are **INCONCLUSIVE** and fail their declared KEEP/minimum-benefit
gates. None is adopted, extended, confirmed or rerun. The direction helper
passes 3,257,049 comparisons with independent scalar JavaScript; the streaming
summary passes 1,000 exact trajectory comparisons against its frozen batch
predecessor. Both native candidates pass 27 Rust tests and exact native replay.
The coordinate layout emits vectorized point stepping and loads/stores, but
static inspection does not show vectorized constraint multiplication.
Full source, tests, plans and raw pairs are retained in
`docs/research/engine-simd-direction-pairs-20261104.json`,
`docs/research/engine-stream-motion-20261104.json` and
`docs/research/engine-vector-state-20261104.json`.

An untimed redundant-work diagnostic finds 195 distinct retrieval queries in
195 calls, with only 1,086 duplicate feature rows among 796,643 query-weighted
model rows. Only 55,336 of 492,859 adjacent raw-frame observations repeat
exactly (11.23%). These counts do not justify additional caches, and equality
does not authorize sharing owned mutable observations. No such implementation
is added. Exact track/work and diagnostic code are preserved in
`docs/research/engine-observation-retrieval-counts-20261104.json`.

Replacing manual grid flooring with `floor()` passes 28 Rust tests, exact native
replay and 1,060,016 independent WASM/JavaScript conversion comparisons. Its
fixed screen12 is **+0.20% [−0.61,+0.96]**, 6/12 wins, INCONCLUSIVE. The upper
bound also exceeds the separately predeclared +0.5% cleanup guard, so neither
speedup nor cleanup adoption qualifies. No further run follows; the original
conversion remains. Evidence: `docs/research/engine-grid-floor-20261104.json`.

Constructing complete impact records and avoiding the account's extra spread
array passes 20 focused tests and typecheck, but screen12 rejects it:
**+2.46% [+1.20,+3.80]**, 1/12 wins. No further qualification or variant follows
(`docs/research/engine-impact-records-20261104.json`). Reusing previous nearest
rows only as initial heap seeds preserves exhaustive stable retrieval and passes
16 focused tests. Its untimed distance-term count falls 7.38%, below the declared
10% minimum, so no timing follows. The extra membership workspace is not adopted
(`docs/research/engine-retrieval-seeds-20261104.json`). These trials leave the
qualified 9,076 ns implementation unchanged.

A separately declared explicit Vec2 primitive trial addresses the automatic
layout's missing vector multiplication. It emits 88 `f64x2.mul` instructions
and passes 27 Rust tests, native replay and 8,228,488 scalar-JavaScript numeric
comparisons (exact non-NaN bits, including signed zero; NaN classification).
Screen12 is still inconclusive: **−0.37% [−1.05,+0.36]**, 7/12 wins. It fails
both KEEP and its stronger −2% upper-bound gate. No variant, confirmation or
conditional ablation follows. The production solver retains scalar coordinate
arrays; source, numeric probes and raw pairs are archived in
`docs/research/engine-vector-operators-20261104.json`.

## November 4: qualify the simpler topology solver at 9,495 ns

The new qualified checkpoint takes **9,495 ns per charged physics frame** for
full default automatic compilation; its absolute 95% interval is **9,447–9,538**.
Against the preceding qualified `c942b254` implementation, fixed screen12 and
fresh confirm24 both pass KEEP and the stronger predeclared minimum benefit:
the paired interval's upper bound must be at most −1%. Confirmation gives
**−1.53% [−2.05,−1.04]**, with 21/24 favorable pairs. The **7,000 ns target
remains unmet**; exact work remains 147,209 frames.

Rest lengths and endurance now derive from the fixed topology instead of
per-cache arrays. One ordered point/friction table replaces ten duplicated
collision calls. Safe constraint indexing produces the same optimized binary
as the earlier unchecked accesses. Equations, floating-point order, zero-friction
behavior, point/collision order, search and scoring are unchanged. The packaged
WASM shrinks from 116,065 to **94,087 bytes**. Neither isolated predecessor was
adopted or rerun: this jointly declared candidate has its own identity and
stronger acceptance gate.

The native guard24 passes at **3,124 → 3,095 ns/frame**, −0.94%
[−1.17,−0.70], 23/24 wins. The larger-budget guard8 passes at **8,665 → 8,607**,
−0.67% [−0.96,−0.38], 8/8 wins. Isolated post-registration stepping is a
diagnostic, **2,647 → 2,619**, −1.06% [−1.98,−0.12], but only 7/12 wins:
its verdict is INCONCLUSIVE, not a separately confirmed speedup.

Fresh WASM linear-memory high-water falls from **64.6875 to 58.8125 MiB** on
the default compile and **146.75 to 134.6875 MiB** on the larger compile.
Native registration/replay/branches remain **3.0625/6.3125/2.0625 MiB**.
These readings are neither live memory nor RSS. All 63 compiler cells, 33 judge
tracks, independent native replay and 27 Rust tests pass. JavaScript has 386
passes and the existing missing-audio failure; typecheck and reachability are
clean. The evidence audit reproduces decisions and checks every timed compile's
exact track/work. Full evidence: `docs/research/engine-topology-solver-20261104.json`.

A separate untimed chunk-copy diagnostic finds only 1,395 avoidable state copies
(under 1 MiB) per default compile. That opportunity does not justify another
ownership path; no implementation or timing trial follows. Counts, original
instrumented code and exact work/hash are archived in
`docs/research/engine-visible-frame-prefix-20261104.json`.

## November 4: qualify a 9,658 ns compiler checkpoint; 7,000 ns remains open

Full default automatic compilation now takes **9,658 ns per charged physics
frame**, compared with **13,527 ns** at `421c0e81` (production code `265545b6`).
The fresh 24-pair confirmation gives **28.60% less time**, paired 95% interval
**28.26–28.95%**, with 24/24 favorable pairs. The candidate mean's separate
fixed-sample bootstrap interval is **9,617–9,699 ns**. This qualifies a useful
checkpoint, but **does not meet the user's 7,000 ns target**. The denominator
remains exactly 147,209 charged frames, and the track hash is unchanged.

Construction memory now retrieves exact stable nearest neighborhoods with a
bounded heap and expands only when adaptation needs more examples. Conservative
partial-distance bounds preserve the original floating-point summation order
for retained rows; nonfinite or ragged input keeps stable full sorting. Local
examples remain fresh. Policy neighborhoods use stable insertion. Model weights,
proposal order, search allowances, scoring and the independent judge stay fixed.

Native registration batches share contiguous immutable geometry and raster
footprints. Registration takes one minimum invalidation over a batch; borrowed
history lists are reused within that query. Lazy component bounds exclude
impossible snapshot collisions before the exact predicate scan. Saved states
share 64-frame chunks across detached caches. Connected solid paths use the same
batch writer as individual lines, and rejected prefix/binding checks avoid
unneeded reporting records. Cached raw windows cross the ABI once; direct
ballistic-state reads/comparisons and native binding-stop replay share the frame
meter. The unused computing candidate-window API is removed.

One detector workspace owns each interval's prefix observations and scalar
checkpoint. Evaluation consumes its borrowed detection synchronously and saves
only owned measurements. Construction inspection, geometry generation and motion
summaries also avoid duplicated scans and temporary records. Ownership, bounds,
fallbacks and output lifetimes are documented in the backend README.

Qualification uses the existing frozen full-source scaffold, Node 22.22.2,
Rust 1.95.0, CPU 2, one warmup and unchanged workloads. Fixed screen12 precedes
fresh confirm24; no timing overlaps correctness checks or profiling.

| Separate guard or diagnostic | Baseline → candidate ns/frame | Paired time delta, 95% interval |
|---|---:|---:|
| Native workloads, guard24 | 3,194 → 3,135 | −1.85% [−2.20, −1.41] |
| Larger automatic budget, guard8 | 12,094 → 8,666 | −28.34% [−28.68, −28.04] |
| Isolated post-registration stepping, diagnostic12 | 2,695 → 2,676 | −0.69% [−1.93, +0.58] |

Both regression guards pass. They are not separate fresh-confirmation speedup
claims; isolated stepping is inconclusive. Fresh WASM linear-memory high-water
is mixed: default compilation **60.8125 → 64.6875 MiB**, larger compilation
**168.625 → 146.75 MiB**. Native registration/replay/branches fall from
**3.5/10.3125/2.125** to **3.0625/6.3125/2.0625 MiB**. These readings are neither
live allocations nor RSS. Shared batches may retain removed members, and a
truncated chunk can retain at most 63 hidden tail states. The packaged binary
is 116,065 bytes, up from 111,085; the build remains ordinary Cargo release output.

Validation: all 63 compiler cells preserve exact tracks and charged work;
all 33 judge tracks pass; independent replay matches 61,115 states, 305,336
ordered collisions and 61,115 raw observations. All 27 Rust tests pass;
JavaScript has 386 passes and the existing missing-audio failure in
`tests/eval_evidence.test.ts` (`productions/amor_na_praia_46s/audio.mp3`).
Typecheck and reachability are clean.

`docs/research/engine-under7k-20261103.json` preserves the frozen patch, source
and binary identities, raw pairs, checks, memory readings, profiles and failed
experiments. Early screens are cumulative comparisons against the original
baseline, not isolated evidence for each added optimization. Later experiments
use direct frozen development references. Ablations that failed their declared
non-regression criterion were restored. Spatial-miss caching, compact grid
storage, raw-frame object reuse and Binaryen O3 did not qualify; frame-local
solver copies failed their static instruction prerequisite. None remains as a
production option. The final raw-sample audit independently reproduces every
completed paired decision and checks each measured compile's exact work/hash.

Follow-up probes leave this production checkpoint unchanged. There are no exact
repeat feature queries across 195 construction-memory retrievals, so a result
cache has no demonstrated opportunity. A shadow 64-slot history-list cache saves
27.52% of map reads but hashes every query; the current slots avoid hashing on
72.27% of queries. Retaining two neighborhoods instead saves only 0.422% of map
reads. Neither cache is added. Direct fixed screen12 comparisons also fail to
qualify a leading-edge bucket shortcut (+0.11%, interval [−0.54,+0.79]) or an
owning line pointer (−0.45%, [−1.43,+0.57]). The latter also fails its stronger
predeclared minimum 1% benefit condition for adding an unsafe invariant. Both
are restored without reruns or confirmations. Exact track/work and native replay
pass throughout. `docs/research/engine-under7k-followup-20261104.json` records the
diagnostics, patches, artifacts, raw pairs and independent decision audit.

Two further collision-loop prototypes also remain outside production. Conservative
per-line position enclosures safely reject 96.16% of candidate visits, but their
fixed direct screen12 is slower: +7.22% [6.64,7.79], 0/12 wins. Grouped direction
extrema classify 33.76% of entries uniformly, yet their screen is also slower:
+2.76% [2.17,3.35], 0/12 wins. Shadow assertions, native tests and independent
replay pass for both. Neither earns confirmation or retention; reducing arithmetic
counts alone does not establish a speedup. Full code, binaries, raw pairs and
decision audits are in `docs/research/engine-line-bounds-20261104.json` and
`docs/research/engine-direction-blocks-20261104.json`.

Flat numeric support/guide paths pass 3,000 exact geometry comparisons and
20 targeted tests, with an identical native binary, but their screen12 is
inconclusive: −0.33% [−1.03,+0.42], 8/12 wins. A separate native constraint-phase
working record removes 37 generated stores in each solver variant; safe indexing
produces that same candidate binary. It passes 27 native tests and independent
replay, but its screen12 is also inconclusive: +0.27% [−0.49,+1.03], 6/12 wins.
Both required KEEP, so neither is retained or rerun. Their frozen evidence is in
`docs/research/engine-packed-paths-20261104.json` and
`docs/research/engine-constraint-phase-20261104.json`.

Deriving rest/endurance constants directly from the fixed topology removes the
per-cache arrays, 30 loads per solver and 1,476 binary bytes. Exact constant
checks, 27 Rust tests and native replay pass. Its screen12 remains inconclusive:
−0.71% [−1.40,−0.03], but only 8/12 wins, failing the declared sign safeguard.
It is not promoted or rerun (`docs/research/engine-fixed-constraints-20261104.json`).
An untimed line-use diagnostic also closes the lazy-bound follow-up: 69.22% of
constructed lines are visited, and profiles do not show a substantial collision
solver saving to justify further certificate machinery. Counts, exact work/hash,
raw profiles and cautiously mapped names are in
`docs/research/engine-line-use-20261104.json`; no new lazy implementation is added.

An ordered point/friction loop shrinks the two generated solver bodies by about
65% and 61%, and the binary by 20,490 bytes. Rust tests and native replay pass,
but its isolated screen12 is inconclusive: −1.20% [−2.06,−0.32], 9/12 wins,
failing the sign safeguard. Binary control memo keys also preserve all 41,495
equivalence cases but fail their screen: −0.36% [−1.31,+0.62], 7/12 wins.
Neither isolated candidate is adopted or rerun. Evidence is in
`docs/research/engine-point-loop-20261104.json` and
`docs/research/engine-binary-control-key-20261104.json`.

Fresh untimed stage counts find 9,550 geometry builds, 5,397 successful replays,
3,412 successful inspections and 3,365 measured candidates. Native raw-window
reads materialize 492,859 frame records across 5,592 calls. Sampled allocation
profiles identify substantial temporary storage in `Math.hypot`; these include
collected objects and fixture loading, and are neither live memory nor timing
evidence. The raw profile, instrumentation and exact track/work checks are in
`docs/research/engine-candidate-stages-20261104.json`.

## November 3: reject inline native version slots; finish three experiments

Third sequential experiment, against accepted `265545b6`: replace boxed versions
with inline optional arena slots. References stay inside a checked arena call,
so movement is safe. All 20 Rust ownership tests, 14 targeted wrapper/cache tests,
33 independent replay fixtures (61115 states and 305336 ordered collisions),
typecheck and reach pass.

The frozen full-source default compile screen12 REJECTs: +0.768% time,
95% interval [+0.503,+1.043], 11/12 pairs slower, with exact track/work parity.
No confirmation follows a rejected screen. Raw-engine WASM high-water is
unchanged. Fresh compile high-water falls from 60.8125 to 57.625 MiB and from
168.625 to 149.125 MiB for the default/larger-budget cases; WASM is 51 bytes
smaller. These storage benefits do not override the declared performance gate.
Restore the boxed arena and archive the experiment.

All three trials are complete: retain packed cached observations; reject shared
trajectory spans and inline versions. Final production sources, tests and packaged
WASM exactly match the fully validated `265545b6`; later commits contain study
evidence only. `docs/research/engine-data-oriented-20261103.json` retains every
fixed run, candidate patch, artifact identity, validation log and memory reading.


## November 3: reject shared trajectory spans

Second sequential data-oriented experiment, against accepted `265545b6`.
A read-only two-span view retained physical prefix/suffix arrays separately;
detection, motion scoring and construction checks read it without whole-trajectory
concatenation. Targeted tests covered every trajectory split, slice boundaries,
resumed detection, motion and authored construction windows; all ten passed,
with zero type errors/unreachable files.

The frozen full-source default compile screen12 REJECTs: +0.695% time,
95% interval [+0.389,+1.009], 11/12 pairs slower. Every timed compile preserves
track/work parity. No confirmation or full promotion checks follow a rejected
screen. Fresh compiler WASM high-water is unchanged (60.8125/168.625 MiB).
The removed allocation does not justify this implementation's added access
abstraction; restore the simpler flat candidate arrays. The prototype patch,
raw paired samples and checks remain in `docs/research/engine-data-oriented-20261103.json`.


## November 3: packed cached physics observations

First of three sequential data-oriented experiments, against `32da1e18`.
The compiler reads contiguous [vx, vy, angular momentum, radius, contact]
records with one cached-only native call per observed window. Strike frames
consume those values directly, sharing the scalar path's arithmetic without
intermediate motion objects. Reads validate the complete window, never simulate,
and borrow output only until the next engine call. The independent judge is
unchanged.

CPU 2, frozen full source/binary arms: A/A12 is inconclusive (+0.072%,
95% interval [-0.136,+0.295]); default automatic screen12 and fresh confirm24
both KEEP. Confirmation is -1.768% time [-1.963,-1.556], 24/24 favorable pairs.
Engine guard24 is +0.001% [-0.313,+0.429], within the predeclared +0.5% upper
bound. The separate 750k-budget guard8 is -2.889% [-3.247,-2.533]; it is a
regression guard, not independently confirmed speedup evidence. Adopt.

Engine-panel WASM high-water remains 3.5/10.3125/2.125 MiB for registration,
replay and branching. Fresh compile high-water is mixed: default 70.3125 to
60.8125 MiB; larger-budget 151.25 to 168.625 MiB. These single-process readings
include allocator/GC lifetime effects and are not live allocations or RSS;
no memory-reduction claim is made. WASM grows by 670 bytes to 111085 bytes.

Validation: exact tracks and work in all 63 compiler cells; 33 judge tracks;
61115 independent frame states/packed observations and 305336 ordered collisions;
20 Rust tests; zero type errors and unreachable files. JavaScript: 367 pass,
one existing missing-audio fixture failure in `eval_evidence.test.ts`.
Raw paired samples, protocol, source patch, identities, memory readings and logs:
`docs/research/engine-data-oriented-20261103.json`.


## November 3: overlap independent loading and render preparation

A fresh async-path audit scanned 206 first-party source files, including the
compiler, engine adapters, producer/evaluation tools, browser review pages,
dashboard and mirror helper. Physics stepping and search were already
synchronous. Their code, WASM artifacts, ownership rules and accounting remain
unchanged. Independent startup imports now load together in the producer,
evaluation adapter, judge and research workers. Saved-cell lookup and its
comparison-state caller now return synchronously instead of creating and
awaiting promises around synchronous reads and already resolved inputs.

Render preparation now overlaps overlay-data generation with the dependent
ride-export/audio-mux chain. Composition waits for both; failure cleanup waits
for both writers to settle. The worker and Remotion resource limits remain.
Static requests bypass asynchronous API misses through namespace dispatch.

Gallery artifacts fetch their bytes and checksum together, and an optional
video response is reused instead of downloaded twice. Music downloads overlap
native preparation; video metadata and library/job loading also overlap their
independent work. Pair/night pages load independent resources together, while
the night report still renders before optional resources finish. Dashboard
audio starts while analysis loads. Checksum verification, superseded-selection
cancellation, optional-media fallbacks and audio-failure scrubbing are preserved.

The audit deliberately retains sequential physics/replay, bounded worker loops,
benchmark arms, produced-file dependencies, save-before-reload operations and
validation-before-publication. Promise grouping does not parallelize synchronous
CPU work. External renderer readiness waits were not proven unnecessary.

Validation: all 63 compiler parity cells retain exact tracks and charged work;
judge parity passes all 33 tracks. JavaScript has 366 passes and the same
pre-existing missing-audio fixture failure in `tests/eval_evidence.test.ts`.
Typecheck and reachability pass. Deferred-operation tests prove overlap and
cleanup barriers without relying on wall-clock thresholds. Four browser checks
cover overlapping loads, superseded selection, bad-audio recovery and dashboard
audio/analysis loading. They use synthetic signed artifacts and the installed
Chromium; the unavailable generated production collection was not re-rendered.

A predeclared controlled latency diagnostic used eight alternating pairs after
one warmup per arm, pinned to CPU 2, after correctness work completed. With an
80 ms delay per loopback response, verified JSON plus checksum averaged
167.3 ms before and 84.4 ms after. Every result was identical and both candidate
requests overlapped in every pair. This is evidence for removing the network
wait, not an end-to-end application or physics speedup. The plan, full source
inventory, decisions about retained ordering, frozen hashes, tests and raw
latency pairs are in `docs/research/async-hot-paths-20261103.json`.

## November 3: simplify engine ownership, observations and private ABI

The engine now has explicit owners: `EngineArena` manages versions and lineage
reconciliation; `FrameCache` owns geometry, computed frames and derived read
summaries; `CollisionHistory` owns rollback indexes; the kernel only steps the
state and records into an explicitly supplied trace. The former `frame` module
is named `history`, and `Holder` is named `Lineage`. Redundant forwarding functions
and cached-read layers are gone. Cache storage is private, so edits, reset and
truncation maintain its invariants in one place.

Collision traces now belong to the requesting version. Interleaved siblings
cannot overwrite each other's observations, and pending trace eviction happens
before metered reads report available frames. History reconstruction never
records a requested trace. The private ABI has a typed adapter with centralized
view refresh, including vectors moving within an unchanged memory buffer.
Dynamic retained outputs replace fixed event/window arrays and their silent
limits. Batch insertion is the only insertion ABI; the unused batch simulator,
single-line export, recording selector and wrapper compatibility fallbacks are
removed. The independent judge and reference implementations stay independent.

JavaScript wrappers have one construction path and one handle registration.
Explicit disposal, finalization and scope cleanup share an idempotent release;
disposed wrappers fail even after a slot is reused. Empty insertion keeps its
existing owner. Synchronous scopes protect caller-owned engines and reject
asynchronous callbacks. The old study-specific cleanup name becomes
`disposeEngines`. Build manifests discover the current source set and tests
check completeness and hashes. The root, architecture, judge and native manuals
now describe the actual boundaries and workflows.

Cached observations check availability and read in one native operation.
Raw frames use cached contact IDs and first-contact point order. Body motion
is a pure lazy `OnceCell` observation owned by each frame summary; shared cache
snapshots may fill it without copying simulation state, and rollback discards
it with its frame. It preserves the reference arithmetic order. Extra solver
trace specialization and a finite contact-order interning table were tried and
removed: neither justified the added complexity.

**Measure the entire change, including its wrapper.** `perf:engine` now accepts
`--reference-root` to compare frozen source arms in one disposable execution
directory, with a fixed runner and judge binary. It rejects differing fixtures,
dependencies and judge source, records both source identities and requires both
source and binary equality for an A/A control. Fresh confirmation checks both
identities. The initial cleanup passed its engine panel but regressed default
automatic compilation by 3.79% and the larger budget by 1.17%; it was rejected.
Profiles and twelve fixed, changed-candidate diagnostics led to the compact
observations and lazy memo. All failures remain in the evidence; no unchanged
run was extended or restarted to obtain acceptance.

**Final cleanup regression guards against `2a5ef4f1`, without a speedup claim:**
the final source and packaged binary were frozen before full correctness checks
and fresh fixed guards. Runs used CPU 2, Node 22.22.2 and plain Rust 1.95.0 release
builds, without simultaneous builds or tests. Adoption requires no REJECT in
any guard and upper 95% time-delta bounds below +0.5% for the engine panel and
default automatic. Engine arms have two measured repetitions after one warmup;
compiler arms have one. The twelve-pair identical-source/binary control is
INCONCLUSIVE.

| workload | pairs | mean time delta | 95% paired-bootstrap interval |
|---|---:|---:|---:|
| combined engine panel | 24 | +0.07% | -0.25% to +0.47% |
| standalone automatic, cell 61 | 24 | -0.92% | -1.15% to -0.70% |
| 750k-budget automatic, cell 62 | 8 | -0.58% | -0.82% to -0.33% |

All three guards pass. Every warmup and measured compile preserves the committed
track and charged work (147,209 or 741,902 frames). These cleanup screens do not
qualify an independently confirmed speedup. The twelve-pair isolated
post-registration stepping diagnostic is INCONCLUSIVE, with mean time delta
+0.43% (95% interval -0.33% to +1.26%). It alternates arms in one
process after three warmups; it is a phase diagnostic, not promotion confirmation.
It does not exclude a small stepping regression.

Measured WASM linear-memory high-water sizes fall from 5.0625 to 3.5 MiB for
registration, 10.8125 to 10.3125 MiB for replay, and 3.75 to 2.125 MiB for branches.
The inline lazy memo consumes part of the removed fixed buffers' savings.
These macro workloads do not request variable window/event outputs, which grow
and retain storage when used. These are buffer sizes, not live allocations or
RSS. The package shrinks from 112,337 to 110,415 bytes and exactly matches the
frozen measured artifact. ABI transport remains synchronous and module-global;
this cleanup does not make it a concurrent native C API.

Validation: all 63 compiler parity cells preserve exact tracks and charged work.
Independent replay passes on 33 tracks, 61,115 states and 305,336 ordered
collisions. The expanded gate also checks raw frames, body motion, contact IDs
and cached-only observation behavior on all 61,115 frames. Judge parity passes
all 33 tracks. All 20 Rust tests pass; JavaScript has 355 passes and the same
pre-existing missing-audio failure in `tests/eval_evidence.test.ts`.
Typecheck and reachability pass. New regression coverage exercises disposed
handle reuse, scope lifetimes, interleaved traces, rollback/memo isolation,
memory growth, output beyond former limits and frozen source overlays.

The plans, rejected candidates, prototype patches, profiles, 20 fixed paired
runs (232 pairs), isolated stepping/memory diagnostics and reproducible final
identity/decision audit are archived in
`docs/research/engine-design-cleanup-20261103.json`. The archive explicitly marks
coverage limits of historical prototype source snapshots; the final complete
source identities, binary, manifest and every frozen changed file are verified.

## November 3: scope engine ownership and centralize history rollback

The native engine now owns version slots, lineage holders, free lists and
reconciliation scratch in one `EngineArena`. Stateful operations borrow it
through one checked scope; internal references cannot escape that call.
This removes every mutable static and unsafe block from `engine.rs`.
The existing ABI exchange buffers and trace state remain synchronous and
module-global; this change does not make the whole backend concurrent.

`CollisionHistory` now owns the invalidation indexes, snapshots, active-cell
shortcuts and rollback boundaries. Its boundary length replaces the redundant
tracked-length counter. Reset, rollback and frame completion maintain all
boundaries together; the kernel takes one history owner instead of six mutable
history arguments. Clone clears borrowed shortcuts, and reset/rollback invalidate
them before releasing nodes. Physics arithmetic, collision order, cached public
frames, charged work and the ABI are unchanged.

**Cleanup regression guards against `b512e1ae`, without a speedup claim:**
the predeclared cleanup guards use the existing paired-process scaffolding,
pinned to CPU 2 with Node 22.22.2 and plain Rust 1.95.0 release builds. Adoption
requires no REJECT in any guard, upper 95% time-delta bounds below +0.5% in
engine and standalone automatic, unchanged or lower measured memory and exact
structural gates. Engine arms use two measured repetitions after one warmup;
compile arms use one. The twelve-pair identical-binary control is INCONCLUSIVE.

| workload | pairs | mean time delta | 95% paired-bootstrap interval |
|---|---:|---:|---:|
| combined engine panel | 24 | -0.48% | -0.69% to -0.25% |
| standalone automatic, cell 61 | 24 | -2.08% | -2.22% to -1.92% |
| 750k-budget automatic, cell 62 | 8 | -0.66% | -0.86% to -0.42% |

All three guards pass. These fixed runs were not extended, and their screening
decisions are not presented as independently confirmed speedups. Every warmup
and timed compile preserves the committed track and charged work (147,209 or
741,902 frames). The twelve-pair isolated post-registration stepping diagnostic
has mean time delta +0.98% (95% interval -0.42% to +2.28%).
Its result is INCONCLUSIVE and does not exclude a small stepping regression.
It alternates arms in one process after three warmups and is not a promotion
confirmation.

Measured WASM linear-memory high-water sizes match baseline: 5.06 MiB for
registration, 10.81 MiB for replay and 3.75 MiB for branches. These are memory
buffer sizes, not live allocations or RSS. The package grows from 111,336 to
112,337 bytes and exactly matches the frozen measured artifact.

A further experiment combined three boundary vectors into one record array.
It preserved exact diagnostics and memory, but its isolated stepping result
was slower by 1.88% (interval +0.78% to +2.93%). It was rejected; the accepted
owner keeps separate private arrays with centralized operations. The arena-only
and history-only probes, combined candidate, rejected boundary layout, source
patches, plans and all raw pairs are archived in
`docs/research/engine-ownership-cleanup-20261103.json`.

Validation: all 63 compiler cells preserve exact tracks and charged work.
Independent engine parity is exact on 33 tracks, 61,115 states and 305,336
ordered collisions; judge parity passes on all 33 tracks. All eighteen Rust
tests pass, including arena reentry rejection, independent ownership, and
history clone/rollback isolation. Typecheck and reachability pass. JavaScript
has 340 passes and the same pre-existing missing-audio failure in
`tests/eval_evidence.test.ts`.

## November 3: compact collision direction filters directly in reserved space

The physics kernel now compacts accepted line pointers directly into the
already-reserved query buffer. Each input writes at the current output count;
only a passing direction predicate advances that count. This removes both
per-entry vector growth checks and a direction-dependent branch. The vector
publishes only the initialized accepted prefix. Before input i, the output
count is at most i, so every write fits within the reserved input length.
The original arithmetic, NaN rejection, order and cross-cell duplicates remain
unchanged. No search code, simulation equations or work accounting changed.

**Confirmed against `71bab968` on this machine:** fixed twelve-pair screens,
then twenty-four fresh pairs for each workload, pinned to CPU 2 with Node
22.22.2 and plain Rust 1.95.0 release builds. The engine panel uses two measured
repetitions per arm; standalone automatic uses one, both after one warmup.
A fresh twelve-pair identical-binary control was INCONCLUSIVE.

| workload | time reduction | 95% paired-bootstrap interval | faster pairs |
|---|---:|---:|---:|
| combined engine panel | 2.25% | 1.86–2.61% | 23/24 |
| standalone automatic, cell 61, 150k allowance | 1.26% | 1.06–1.46% | 24/24 |

Within the confirmed panel, component averages are 22.6→22.2 ms for registration,
189.1→182.1 ms for replay including registration, and 332.3→327.4 ms for
branches/edits. Registration's paired result is INCONCLUSIVE.
The separately declared eight-pair 750k-budget regression
check was KEEP, with mean time delta -1.62% (95% interval -2.12% to -1.21%).
It is not a separately confirmed speedup claim. Every warmup and timed compile
preserves the committed track and charged work (147,209 or 741,902 frames).

The final twelve-pair isolated post-registration stepping diagnostic has mean
time delta **-4.63% (95% interval -5.52% to -3.64%)** against this round's baseline.
A separate, predeclared twelve-pair comparison with `4be353e8`, before lazy
queries, has delta **-2.09% (95% interval -2.59% to -1.57%)**. These alternate
arms in one process after three warmups; they are phase diagnostics, not
fresh-process promotion confirmations.
The older-baseline check was declared after engine confirmation and does not
change the promotion criteria.

Measured WASM linear-memory high-water sizes match baseline: 5.06 MiB for
registration, 10.81 MiB for replay and 3.75 MiB for branches. These are memory
buffer sizes, not live allocations or RSS. The package grows from 111,185 to
111,336 bytes and exactly matches the frozen measured binary.

This round also tested a conservative spatial filter to skip history replay
for disjoint edits, outlined collision functions, suppression of unused history
events, direct writes retaining the direction branch, and contiguous query
normals. The spatial filter and outlining were slower; suppressing history
events showed no reliable benefit. Contiguous normals did not establish an
additional benefit over the simpler chosen design. All prototype patches,
profiles, raw pairs and decisions remain in
`docs/research/engine-direction-compaction-20261103.json`.

Validation: all 63 compiler cells preserve exact tracks and charged work.
Independent engine parity is exact on 33 tracks, 61,115 states and 305,336
ordered collisions; judge parity passes on all 33 tracks. All fifteen Rust
tests pass, including full, empty, growing and shrinking filter buffers.
Typecheck and reachability pass. JavaScript has 340 passes and the same
pre-existing missing-audio failure in `tests/eval_evidence.test.ts`.

## November 3: transfer detached physics caches without eager copying

The native engine now shares an immutable cache snapshot between detached
lineages until either needs to write. If the source is released first, the
remaining lineage keeps the storage without copying geometry, frames or
history. Cached reads never trigger a copy. If both remain live, the first
writer receives its own cache before any edit, extension, reset or trace
eviction. An actual cache copy clears borrowed line queries; ownership transfer
keeps those queries with their owning grid. Solver equations, frame storage,
the ABI and physical-frame accounting are unchanged.

Fresh replay and automatic-workload profiles guided this round. Kernel
experiments included SIMD, constraint factoring, predicate short-circuiting,
empty-query reuse and inactive-trace call removal. None qualified for adoption.
Compact saved frames reduced memory but did not pass the compiler screening
gate. The automatic profile also exposed prefix detachment cost, leading to
the accepted ownership change. All prototype patches and measurements are
preserved in `docs/research/engine-copy-on-write-20261103.json`.

**Confirmed against `6a0f4c01` on this machine:** the frozen candidate used
plain Rust 1.95.0 release builds, Node 22.22.2 and CPU 2. Before screening it,
standalone automatic compilation was declared primary because it frequently
detaches prefixes; the broad engine panel has few detachments. Twelve screen
pairs followed by twenty-four fresh confirmation pairs, with one warmup and
one measured compile per arm, give **3.39% less compile time** on cell 61
(150k allowance), interval **3.17–3.60%**, winning **24/24 pairs**. Every warmup
and measured compile preserves the committed track and 147,209 charged frames.
A fresh twelve-pair identical-binary control was INCONCLUSIVE.

The predeclared twenty-four-pair engine regression guard was INCONCLUSIVE:
mean time delta +0.15%, interval −0.12% to +0.44%, with two measured repetitions
after one warmup. The eight-pair 750k-budget guard won all eight pairs,
averaging 1.57% less time (interval 1.12–1.99%) with exact tracks and 741,902
charged frames. These are regression checks, not independently confirmed
speedup claims. This change removes engine ownership overhead; the results
do not establish faster solver arithmetic.

Separate twelve-pair diagnostics after three warmups in one process found
no detectable stepping change (−0.10%, interval −0.40% to +0.22%). Twenty
detach-and-release cycles per committed track remove almost all copying cost
(−99.88%). Keeping the source alive and including the detached cache's first
write instead gives +0.13%, interval −0.15% to +0.41%, INCONCLUSIVE. This
explicitly includes the deferred copy cost. These phase diagnostics are not
fresh-process promotion confirmations.

WASM linear-memory high-water size is unchanged for registration (5.06 MiB)
and replay (10.81 MiB); the branch workload falls from 3.875 to 3.750 MiB.
These are memory-buffer sizes, not live allocations or RSS. The packaged WASM
grows from 110,887 to 111,185 bytes and is byte-identical to the measured
candidate. The independent judge and compiler search code remain unchanged.

Validation: all 63 compiler cells preserve exact tracks and charged work.
Independent engine parity is exact on 33 tracks, 61,115 states and 305,336
ordered collisions; judge parity passes on all 33 tracks. All fourteen Rust
tests pass. New tests exercise the first mutation of a shared snapshot from
either live lineage and continuation after all source handles are released.
Typecheck and reachability pass. JavaScript tests have 340 passes and the same
pre-existing missing-audio failure in `tests/eval_evidence.test.ts`.

## November 3: reuse collision direction checks within each frame

The physics kernel now filters nearby lines with the original
normal-dot-velocity > 0 predicate when a point starts a frame or changes cell.
Velocity stays fixed through the six solver sweeps, so the intervening sweeps
reuse that ordered list. Cell order, cross-cell duplicates, NaN rejection and
all response arithmetic are preserved. Each step resets the filtered lists,
including history replay at an already-used frame index. A shared refill
routine keeps list construction out of each specialized point solver.

**Confirmed against `d63cd32a` on this machine:** twelve screening pairs followed
by twenty-four fresh pairs for each primary workload, pinned to CPU 2, plain
Rust 1.95.0 release builds and Node 22.22.2. The engine panel uses two measured
repetitions per arm; the standalone compiler case uses one, both after one
warmup. A fresh twelve-pair identical-binary control was INCONCLUSIVE.

| workload | time reduction | 95% paired-bootstrap interval | faster pairs |
|---|---:|---:|---:|
| combined engine panel | 1.76% | 1.30–2.13% | 23/24 |
| standalone automatic, cell 61, 150k allowance | 2.42% | 2.18–2.67% | 24/24 |

Engine component averages are 22.8→22.9 ms for registration,
197.8→190.9 ms for replay including registration, and 337.0→334.0 ms for
branches/edits. The separately declared eight-pair 750k-budget regression check
won all eight pairs, averaging 2.47% less compile time. It is not a separately
confirmed speedup claim. Every warmup and timed compile preserved its committed
track hash and physical-frame charge.

The final twelve-pair post-registration diagnostic takes **4.23% less time**
than `d63cd32a` (interval 3.17–5.27%). A fresh comparison with the pre-lazy-query
engine still takes **1.88% more time** (interval 1.19–2.56%). This recovers part
of the previous stepping cost; it does not establish a universal solver gain.
These diagnostics use alternating pairs in one process, separately from the
fresh-process promotion confirmations.

**Memory affected selection.** The first filtered candidate passed confirmation
at 1.82% less engine time and 4.40% less automatic compile time, but replay WASM
linear-memory high-water grew from 10.81 to 13.31 MiB. It was not adopted.
Reserving the full query length before filtering avoids repeated buffer growth.
That revised binary went through its own screening and fresh confirmations.
Its measured high-water sizes match the baseline on all three workloads:
5.06 MiB registration, 10.81 MiB replay and 3.88 MiB branches. These are WASM
linear-memory sizes, not live allocations or RSS. The package itself shrinks
from 114,166 to 110,887 bytes.

Spatial cache slots, cached neighboring buckets, a separate unfiltered point
list and world-coordinate cache bounds were also explored. They were slower
or inconclusive and were not adopted. Source patches, raw measurements, frozen
artifact hashes and both candidate decisions are preserved in
`docs/research/engine-direction-filter-20261103.json`. The packaged rebuild is
byte-identical to the final measured artifact.

Validation: all 63 compiler cells preserve exact tracks and charged work.
Independent engine parity is exact on 33 tracks, 61,115 states and 305,336
ordered collisions; judge parity passes on all 33 tracks. All thirteen Rust
tests pass, including the new frame/velocity filtering cases. Typecheck and
reachability pass. JavaScript tests have 339 passes and the same pre-existing
missing-audio failure in `tests/eval_evidence.test.ts`.

## November 3: lazy nearby-line queries in the compiler engine

The native compiler backend now registers a line only in its original raster
cells. Previously each registration expanded into nine neighboring buckets.
That made edits and version reconciliation costly; a fresh automatic-workload
profile put substantial time in registration and reconciliation.

A shared cache now flattens nearby-line queries on demand. Each point retains
its own copy of the ordered line pointers until it changes cell or the grid is
edited. Query buffers reuse capacity. The grid owns the immutable lines, edits
invalidate both query levels (including empty queries), and detached engines
start with empty queries. Cell order, descending ids within cells and duplicates
across cells are preserved. A collision keeps traversing its original list even
if it moves the point into another cell. Physics arithmetic and the ABI are
unchanged; the independent judge is untouched.

**Confirmed against `4be353e8` on this machine:** twelve screening pairs followed
by twenty-four fresh pairs for each primary workload, pinned to CPU 2, plain
Rust 1.95.0 release builds and Node 22.22.2. Both confirmations won 24/24 pairs.

| workload | time reduction | 95% paired-bootstrap interval |
|---|---:|---:|
| combined engine panel | 20.99% | 20.74–21.24% |
| standalone automatic, cell 61, 150k allowance | 13.52% | 13.36–13.68% |

The confirmed engine components average 78.6→22.9 ms for registration,
241.6→195.8 ms for full replay including registration, and 381.3→335.5 ms for
branches/edits. A separately declared eight-pair standalone 750k-budget check
(cell 62) won all eight pairs, averaging 16.20% less compile time. It is a
regression guard, not a separately confirmed speedup claim. Every measured and
warmup compile matched its committed track hash and charged frame count.

**Tradeoff:** stepping after registration takes 8.37% more time in a separate
twelve-pair diagnostic (interval 7.69–9.02%). The registration and edit savings
outweigh that cost in the measured compiler workloads. This is an optimization
for the compiler backend, not a universal solver-speed improvement. The study
reports this phase separately so the combined replay result cannot conceal it.
WASM linear-memory high-water size on replay falls from 14.50 to 10.81 MiB;
registration falls from 6.44 to 5.06 MiB, and the branch workload stays at
3.88 MiB. These are linear-memory sizes, not process RSS or live allocations.

Development tried cached bucket arrays, compact bucket lists, separate flat
lists per point and a shared flat cache before combining the two query levels.
The final candidate was frozen before confirmation. The package rebuild is
byte-identical to that measured binary; its sources, prototype patches and raw
measurements are in `docs/research/engine-lazy-neighborhoods-20261103.json`.

Validation: all 63 compiler cells preserve exact tracks and charged work.
Independent engine parity is exact on 33 tracks, 61,115
frame states and 305,336 ordered collisions; judge parity passes on 33 tracks.
All twelve Rust tests pass, including cache eviction, grid edits, epoch wrap,
duplicate ordering and movement during a sweep. Typecheck and reachability
pass. The suite has 339 passing tests and the same pre-existing missing-audio
failure.

## November 3: restore the paired engine promotion workflow

The archived `archive/pre-rework-2026-10-03:scripts/v0/bench/perf_ab.ts`
contains the right foundation: alternate paired, fresh, warmed processes;
change only WASM; normalize by physical work; preserve samples and make an
explicit decision. The earlier `bench:engine` diagnostic did not restore that
whole workflow. `npm run perf:engine` now adapts it to the current backend and
uses the actual parity worker for compiler timings.

The adapter snapshots source and fixtures in a private directory instead of
swapping the live package. It fixes the old bootstrap RNG's floating-point
integer multiplication, treats ties neutrally, requires an exact sign test as
well as bootstrap support and a favorable median, and requires fixed sample
counts plus a fresh confirmation of frozen artifacts. Source/input/WASM hashes
are checked between stages; the final adapter also enforces host, Node and CPU
affinity identity. Installed dependencies must remain fixed. Bootstrap support
is a resampling fraction, not a posterior probability or an anytime-valid rule.

All measurements used the same November 3 laptop, Rust 1.95.0 plain release
builds, Node 22.22.2, CPU 2, and sequential workers without concurrent builds or
tests. A real identical-binary A/A control was INCONCLUSIVE: 6 wins/6 losses,
mean delta +0.10%, 95% bootstrap interval −0.31% to +0.54%.

**Retained:** the already committed collision-cache reuse passed 12 screening
and 24 fresh confirmation pairs against a same-toolchain pre-change rebuild.
Confirmation reduced composite engine time by 2.11% (95% interval 1.88–2.33%),
winning all 24 pairs. This composite includes registration, replay and branch
edits; it is different from the earlier 4.3% replay-only result.

The separate default automatic case (cell 61, seed 101, 150k allowance) also
passed 12 screening and 24 fresh confirmation pairs: **1.18% less compile time**
(95% interval 0.94–1.42%), winning 23/24 confirmation pairs. Every warmup and
timed compile preserved its track hash and 147,209 charged physics frames.
This supports a gain on that warmed case, not on every song or budget.

**Further experiments were not promoted:**

| candidate versus the retained cache | evidence | decision |
|---|---|---|
| shared immutable geometry alone | 12 engine pairs: 0.48% slower | reject |
| shared geometry plus cached raster cells | 24 fresh engine pairs: 0.92% less time; 12 fresh three-case compiler pairs: 1.21% less time | reject after default-path check |
| one lookup to edit/remove empty grid buckets | 24 engine pairs: estimated 0.18% less time, interval −0.48% to +0.16% delta; 12 automatic pairs: no detected difference | inconclusive; do not promote |

The raster-cache trial is the important counterexample. In the three-case
150k-budget compiler panel (fold, terraces, automatic), the automatic case was
0.41% slower despite the aggregate win. A subsequently declared standalone
automatic check lost **all 24 fresh pairs**, averaging 1.55% slower (interval
1.26–1.86%). Lower WASM memory and faster explicit layouts did not justify
that default-path regression. Its source and WASM were removed from the package.

The final report now exposes individual compile-cell decisions and blocks
qualification on a detected cell regression. The workflow also requires a
separate default automatic workload before adoption: mixed-case warming can
produce a different context from standalone use. No inconclusive run was
extended until it passed; no new native-engine change was adopted in this round. Candidate patches,
artifact hashes and every raw sample are preserved in
`docs/research/engine-promotion-20261103.json`.

Validation: 63/63 compiler track/work cells, 33/33 judge tracks, 61,115 frame
states and 305,336 ordered collisions exact; ten Rust tests pass, typecheck has
zero errors, reachability has zero unreachable files. The suite has 339 passing
tests and the previously reproduced missing-audio failure in
`eval_evidence.test.ts`.

## November 3: physics-engine baseline and collision lookup reuse

Structural physics work on the new host: i7-12800H, 20 logical CPUs, 16 GB RAM,
Node 22.22.2, Rust 1.95.0. Earlier host timings are not this machine's baseline.
The compiler's `native_motion` backend is separate from `engine-rs`, and is not
selected by `LR_ENGINE`. The independent reference engine and compiler search
are unchanged.

**Kept:** collision-grid lookup shortcuts now survive frame boundaries, and
each point retains its current bucket. Grid edits invalidate both cache levels,
including cached misses. A detached grid starts with empty shortcuts, so it
cannot retain pointers into its source grid. Physics arithmetic, collision
order, trajectories and charged frame counts are unchanged.

**Measurements:** 12 sequential pairs per workload, alternating order after
four warmups, pinned to CPU 2 with GC before each sample. Both arms consume the
same 33 committed tracks. Against the originally shipped binary:

| workload | before | after | time reduction |
|---|---:|---:|---:|
| registration | 77.1 ms | 76.3 ms | within noise |
| full replay | 251.5 ms | 240.6 ms | 4.3% (95% ratio interval: 0.944–0.970) |
| sibling edits, rollback and detached prefix | 388.8 ms | 381.5 ms | 1.9% (0.976–0.986) |

A separate comparison against a same-source, same-toolchain rebuild gives
4.3% and 2.0% reductions. These are engine workloads, not whole-compiler claims.
Six real compile pairs (arcs, scattered geometry and low-budget automatic;
two pairs each) range from 0.2% slower to 1.2% faster, all with exact track/work
parity. This small sample does not establish a reliable whole-compiler gain.
The intervals describe timing noise on these fixed workloads, not quality
across seeds or new songs. A conservative world-coordinate bounds shortcut
and a different cache slot hash did not add reliable gains and were removed.

**Workflow repairs:** `build:native` rebuilds and hashes the compiler package
without touching the judge. `verify:engine` uses committed tracks instead of
missing local trace fixtures. The legacy numeric diagnostic now fails on
missing references, mismatched frame counts, non-finite values or drift.
`bench:engine` records hardware, artifact/input hashes and all paired samples,
and checks states, events, cached contact positions and cache work outside
timing. Parity defaults to machine-appropriate concurrency (four here) and
rejects invalid worker counts or empty selections.

**Validation:** 63/63 compiler track/work cells and 33/33 judge tracks exact;
61,115 frame states and 305,336 ordered collisions match the independent
engine. Cache edits, sibling switches, resets and detachments also match
published JavaScript physics. Ten Rust tests pass; TypeScript has zero errors,
and reachability has zero unreachable files. The full suite has 335 passing
tests and one missing-audio failure, reproduced on untouched HEAD
(`productions/amor_na_praia_46s/audio.mp3` is absent on this host).

Evidence, including rejected trials and raw samples:
`docs/research/engine-performance-20261103.json`.

## November 2: bright post-processing family

Following owner feedback, seven bright candidates explore paper, pastel light,
contact zoom, ink hue and registration, with two new frequency graphics. Four
full-film choices keep their earlier references. Presets remain opt-in study
candidates; production defaults stay unchanged. Rebased onto `eeec89e2`, retaining
upstream's shared construction verifier. Details and evidence are in
`docs/research/postprocessing-style-study-20261102.md`.

## November 2: expanded style study and comparison reliability

Phone feedback exposed a hidden-video compositor-callback dependency and excessive
preloading. Comparison now loads only active/incoming media and retains a usable
picture/control when browser playback policy refuses a transition. Fault injection,
delayed real-video switches and the existing Brave session exercise the fix.

Eleven additional opt-in treatments and an energetic combination explore paper, luminous geometry, actual
spectral memory and different spectrum compositions. Independent critique refined
phone legibility, continuous dot transitions and alpha-safe contact ink expansion.
The approved production recipe stays unchanged. Evidence and artistic judgments
are appended to `docs/research/postprocessing-style-study-20261102.md`.

## November 2: curated post-processing study (opt-in)

Four experimental directions—Elastic print, Electric paper, Suspension and
Graphite—share the existing Remotion render path. Fast accents use measured
contact onset/strength; slow breathing uses existing authored asks. The approved
static soft-base treatment remains the default. Independent review caught and
fixed overlapping-kick discontinuities and an ink-mask alpha bug before delivery.

The comparison player now groups looks and focused effects across musical
passages, preserving style while changing passage and preserving time while
changing style. The study contains three contrasting 14-second passages and two
full-length picks with references. Details, rationale and deferred ideas are in
`docs/research/postprocessing-style-study-20261102.md`; artifacts are under
`generated/style-lab/`. No compiler, specification or native-camera change.

## November 1: native frames to FFmpeg (tooling)

The shared exporter now draws with the vendored physics, WebGL renderer, sprites
and camera directly, without starting the editor. Lossless PNG frames stream over
an isolated loopback connection to native FFmpeg. Transfer is sequential and
bounded, with frame-order and dimension checks; FFmpeg fails on decode errors,
and output frame count, dimensions and FPS are checked before atomic publication.
No intermediate images are written to disk. Each render owns and closes its
browser, server and encoder; the shared mirror-server lifecycle has been removed.
The public `video` command and presentation recipe are unchanged.

On the same Petrunko seed 404 and settings, ride export fell from 213s to 76s.
Finished rendering from the saved track fell from about 310s to **173.2s**; the
presentation pass remains about 95s. This is a render comparison, excluding
compilation. A separate full ride exported in 78s. Short authored-camera and
beat-punch tests fell from 9.6–9.9s to 4.8s.

Validation compared every frame of a full 3,600-frame ride and two 243-frame
camera tests (mean PSNR 61–63 dB). All 3,630 finished-video frames were compared
too (mean 52.8 dB, minimum 48.5 dB); worst-difference frames were visually checked.
The encoders differ, so pixels/bytes are not identical, but motion, framing and
timing are preserved. Decoded audio is byte-identical. The native exporter keeps
the legacy repeated first pose and first frame beyond the track duration.

Raw RGBA transfer was slower; lossless PNG transport made the useful difference.
Explicit NVIDIA rendering worked but was unnecessary for the adopted speedup;
the tested default remains software-compatible. Experiments and comparisons are
under `generated/video-workflow-audit/`. Tests, both typechecks, judge parity and
reachability pass; all 63 compiler outputs/frame counts still match the pre-work
baseline. The pre-existing saved-golden mismatches remain, unchanged.

## November 1: shared video command (tooling)

`npm run video` accepts a fresh song/seed, a saved study, or a raw track with
optional audio. Plain/finished presentation and horizontal/vertical format are
independent. It prints progress and stage timings, preserves source artifacts,
and decodes the finished output before publishing the requested MP4. There is no
resume protocol. Gallery bundles and review clips now call the same rendering
function; the spec-camera resolver is shared with the legacy exporter.

Removed a fixed two-second startup sleep and an uncleared 15-second download
timeout. A four-second test took 32.85s for the old ride export alone versus
16.14s for the new plain command including audio and verification; all 243
decoded picture frames match exactly. Single-video jobs use up to 16 workers
instead of a collection lane's four. Two repeated four-second compositor tests
took 12.7s at four workers versus 7.6–7.8s at sixteen, with identical decoded
frames. These are excerpt timings, not a claim of that speedup for every movie.

A fresh Petrunko seed 404 produced a verified 60.5s vertical video in 414.9s:
105s compilation, 213s ride export, 96s presentation. Compilation overlapped
the test/parity jobs. Phone-sized Chromium playback passed. Horizontal plain and
finished samples also rendered. Evidence is in `generated/video-workflow-audit/`.
Ride capture/encoding remains the main render cost; native physics replay on
three full tracks was only 104–144ms. Direct canvas/WebGL composition and GPU
configuration experiments did not establish a worthwhile replacement; they stay
out of the production code. The existing effects, camera and native exporter stay.

Validation: full tests, focused command/export tests, both TypeScript projects,
reachability (zero unreachable), and judge parity passed. Compile parity still
has the pre-existing saved-reference mismatches: all 63 actual track hashes and
physics-frame counts match the untouched baseline exactly. Goldens unchanged.

## October 31: geometry use in the bench report (tooling)

Report-only; no compiler, spec or ruler change, parity identical. Every new
cell records compact geometry facts from the plan and the realization, and
the stratified report gains section 4, Geometry: shares of ride time and of
sections by family × guidance, transfer vs paired, distinct families per
ride, short sections (under the shaped `minFrames`) by planned family, and
on complete cells fulfilled sections, guides never touched and shaped turns
realized. It is descriptive: variety is part of the owner's taste, not a
target. The evaluator identity changes; old runs load and say "not recorded"
(the facts are compiler output; remeasure cannot recover them).
- **Not recorded:** whether short-shape fitting changed a section. The plan
  keeps only the fitted family, and a guided-arcs draw looks the same. It
  needs a compiler-side field (the drawn family on the request); until then
  the report shows short shaped and short guided-arcs sections.
- **First look,** on recompiles of the minFrames pair (both arms reproduce
  `bench-minframes-20261031` and `bench-base-rm-20261031` track for track):
  the rule moves 0.19 sections per ride (mean over strata; all in P1, P2 and
  P4) from short shaped to short guided arcs; family shares move by at most
  0.3 points; every complete ride realizes every section, touches every guide
  and realizes its shaped turns.

## November 1: construction policies retrained on today's compiler (adopted)

**Why:** the owner suggested recalibrating the compiler's learned parts,
which were all fitted on October compilers, before judging any of them.
- Removing the learned future estimate cost −2.7 (it carries information).
- Retraining it did not help (−4.8; −2.1 at a level-matched weight). The
  October value model stays.
- The construction policies were the stale part.

**Data:** `tools/research/value_collect.ts`, run from a worktree frozen at
fc9a428a, at the standard allowance. It covers the benchmark/v4 training
cases without the four evaluation songs (168 records) and V6 transfer-layout
plans on non-evaluation music (30 records); no held-out song appears.
`train_construction_v3.py` gives 17,077 demonstrations. The artifact
replaces `repertoire_policy_model_v3.json(.gz)`; provenance is in its
pointer.

**Results** (no ride lost; physics frames unchanged):

| panel | change | interval / support |
|---|---|---|
| V7, 8 seeds | **+15.5** | [+12.4, +18.6], every block positive; 21 of 22 specs up, every category up |
| held out | **+10.5** | [+9.2, +11.8], > 0.99; 4 of 5 specs up |
| explicit requests | +12.3 | |

- Strong-ask bias +0.007, very strong +0.007.
- Air rms −0.003, speed rms −0.005.
- Head-down or backward strong arrivals −1.1 points.
- **Costs:**
  - body drag +0.66 s/min (about a third more; reported, per the owner an
    eye-only proxy for roof and control-rail use);
  - strong extra hits +0.018 per beat.
- No test needed re-deriving.

Parity references were refreshed.

## November 1: the heading prior keeps full weight in ranking (adopted)

**Found** (studies agent, `docs/research/compiler-ideas-20261101.md`): the
half-weight adoption cost Amour bench-long 8.8 points.
- Extra hits inside long floats doubled.
- More soft catches that open a float were reached steeper than 45°, where
  the heading prior starts charging.
- That prior prices a cost two catches ahead, which the one-interval probes
  behind the half-weight calibration did not see.

**Change:** each candidate records its heading-prior cost. `valueRank`
counts it fully and the other arrival priors at ½ (`arc_evaluate.ts`,
`arc_candidates.ts`).

**Results** (no ride lost; compute unchanged):

| panel | change | interval / support |
|---|---|---|
| V7, 8 seeds | +0.9 | [−1.1, +3.0], 0.85; Amour bench-long +9.1, other categories within ±2.4 |
| held out | **+4.7** | [+2.8, +6.6], > 0.99; 4 of 5 specs up |

- Strength rulers unchanged; body drag −0.05 s/min.
- No test needed re-deriving.

Parity references were refreshed.

## November 1: ranking counts the arrival priors at half weight (adopted)

**Found** (`docs/research/compiler-ideas-20261101.md`):
- **At strong catches, the search usually had a catch nearer the ask** (73%
  of pools) but kept a weaker one. About half of the kept candidate's rank
  came from the arrival priors, which steer toward a good next arrival.
- **Same-state probes measured the real cost** to the next interval of
  keeping the alternative. It was about 0.45 of what ranking charged (0.042
  against 0.093; 0.024 against 0.053). All 16 probed compiles were identical
  to the saved rides.

**Change:** in `valueRank` (`arc_candidates.ts`; prefix choice and beam
ranking), the arrival-prior part of a candidate's cost counts ½. Local search
keeps the priors in full, so proposals are steered as before. It calibrates
an estimate to what it was measured to estimate.

**Results** (no ride lost; compute and variety unchanged):

| panel | change | interval / support |
|---|---|---|
| V7, 8 seeds | **+7.2** | [+3.4, +10.9], every block positive |
| held out | +8.1 | [−1.7, +18.0], 0.96; all 5 specs up |
| explicit requests | +10.6 | |

- 19 of 22 V7 specs improve. Amour bench-long (P6) is −8.8.
- **Strength error² by ask:**
  - under 0.4: −4%;
  - 0.4–0.6: −21%;
  - 0.6–0.8: −11%;
  - 0.8+: −3%.
- **Other rulers:**
  - head-down or backward strong arrivals −1.3 points;
  - strong extras and contested beats fewer;
  - air and speed rms slightly better.
- Body drag +0.22 s/min (reported; per the owner, an eye-only proxy for
  roof and control-rail use).

**Tests re-derived:**
- Two budget scenarios get new allowances: 2100 (was 3500) and 2400 (was
  2600).
- The repair-sync test uses 0.8 asks: the coarse first search now gets the
  0.4 asks right, so nothing would exercise repairs.

Parity references were refreshed.

## November 1: catches placed mid-frame (adopted)

**Found** (`docs/research/compiler-ideas-20261101.md`): the catch line was
anchored at the rider points' positions at the beat frame's first collision
pass. Crossings therefore fell near the frame's start (median −0.4 frame from
its middle, in every offset and incidence group). 15% of hits, and 21% of
strong ones, tipped into the frame before, and those early hits were also the
weak ones.

**Change:** each point is placed half a frame of its own motion later
(`catchReceivers` in `arc_interval_state.ts`), so the line is crossed
mid-frame. It is a law of motion, not a fitted number.

**Results** (no ride lost anywhere; compute and variety unchanged):

| panel | change | interval / support |
|---|---|---|
| V7, 8 seeds | **+15.5** | [+11.8, +19.3], every block positive |
| V7, half the allowance | +15.0 | [+10.8, +19.1] |
| held out | +12.7 | all 5 specs up, `voice-drums` +9.6 |
| explicit requests | +10.5 | |

- All 22 V7 specs improve.
- Early hits fall from 15.3% to 4.4% (strong: 20.9% → 6.3%), and late hits
  do not rise (4.0% → 4.1%).
- Strong-ask bias improves, and body drag is lower.

**Tests re-derived:**
- Four scenarios had budgets or a seed tuned to the old construction's exact
  frame use; they get new values with comments, asserting the same things.
- The sync test now uses the shared placement function instead of its own
  copy.
- The scattered-incumbent fixtures are regenerated by a committed script.
  One assertion is generalised: at the ceiling the search returns the best
  already-validated realization, since the carriers can now realize. Its
  fresh-fragment check runs on Tiki only, because Luna's carriers now fail
  before reaching fragments.

Parity references were refreshed.

## November 1: target jitter removed (adopted)

**Found:** every Amour spec omitted `jitter`, so the compiler applied the
legacy default (σ 0.05). It perturbed each gap's air and speed targets at
random and aimed at them, while the scorer measures the authored targets.

**Change:**
- the compiler reads targets exactly (behavioural);
- then the feature was removed entirely: `Spec.jitter`, `CALIB.SIGMA`,
  `sampleGapTargets`, and the `jitter: 0` lines (structural, byte-identical,
  compile and judge parity pass). The range clamp stays.

**Result** (V7, 4 seeds): +7.2, interval [+4.5, +10.0], support > 0.99.
- Only the 8 Amour specs moved (up to +84 on a ride); the rest are
  identical.
- Air error is −0.004, speed −0.002, and no ride was lost.
- The held-out songs already used 0, so they are unchanged.

Specifications carry no randomness now. The search is deterministic, and a
seed reaches the compiler only through the plan
(`docs/research/compiler-ideas-20261101.md`).

## November 1: the steep-arrival threshold becomes a smooth step (adopted, first V7 decision)

**Why:** a hard switch at ask 0.6 turned four preferences on at once; on V7,
removing the mechanism cost −6.1 (Amour), so it is needed, but its cliff was
worth questioning.

**Change:**
- Structural, byte-identical: the switch becomes a weight.
- Behavioural: the weight rises smoothly from ask 0.4 to 0.8, centred on the
  old threshold.

**Results** (`npm run compare`, against `main`, every ride finished):

| panel | headline |
|---|---|
| V7 | +0.2 |
| V7 confirmation seeds | +3.8 |
| held-out songs | +4.7 |

- Body drag is lower.
- Disclosed: the long ride (P6), one spec, is −7.8 and −4.3.
- A linear law (weight = ask) was −0.9 and is not adopted.
- Details: `docs/research/v7-rejudge-20261101.md`.

**Correction after the tooling review.** With seed-block uncertainty over
8 seeds, the change is +2.0, interval [−1.9, +5.9], directional support 0.87.
It leans positive but is not established. The adoption rests on the smooth
law, no lost rides and lower drag, not on a demonstrated headline gain.

## November 1 (overnight): studies and ablations (nothing adopted)

Full log: `docs/research/overnight-20261101.md`. Each hypothesis was stated
before its run. Bench headline against the adopted HEAD, every ride complete
in every arm.

| arm | bench | other panels | verdict |
|---|---|---|---|
| A1: no future-value model | −10.2 | — | kept: the model earns its place |
| R0: no ending refinement | −0.18 | confirm −0.21, pairs8 −0.32, held out −0.07, sealed −3.8 (one ride: 532 → 466) | proposed for deletion, owner's call (`exp/no-tail-refinement`: −330 lines, ~5% faster) |
| G0: no passive-arrival gate | −1.4 | — | kept (P2 −7, P6 −14, more drag) |
| S1: steep arrival law at every catch | −12.5 | — | kept the 0.6 threshold (lower in every stratum) |
| uncapped per-section effort | 1×: −2.4, 2×: +7.8 | — | not adopted; design question (scale-free law) |

Studies (report only):
- **Stray hits:** about half are the body brushing a guide, half the
  shape's own steps. The rate is 0.4 per minute in plain arcs and 2.6–7.9 in
  shaped sections. The search already pays for them.
- **Headline loss:** impact strength 35%, air 24%, speed 19%, one-frame
  timing 16%, extras 7%. Strong asks undershoot (−0.07 even with ≥ 1 s of
  room; −0.22 for asks ≥ 0.8 after 10–19 frames).
- **Allowance:** ¼× 644, ½× 707, ¾× 727, 1× 739, 2× 739.
- **Compile time:** physics is 44% of CPU. The engine fork (`add_lines`)
  takes 24%, the largest single speed lever.
- **The sealed long ride's overnight drop** is one seed with a runaway
  ending (last-gap speed 1.29 against 0.32). Bad endings are 1 in 148 rides.

## November 1 (overnight): guides offered, never required (adopted)

**Why:** with no plan (plain unguided arcs everywhere), the headline was 753
against 717, with fewer stray hits and less body drag, but no variety. Shapes
*without* guides scored 686: the guide does real work for shapes. The forced
touch ("guide required") was the costly part. Graded shape fulfilment gained
only +4.4, so the cost of variety was not search waste.

**Hypothesis** (stated before the run): offering a guide instead of requiring
it keeps the shapes, removes forced touches, raises the headline and lowers
stray hits, at equal completion.

**Change:** the automatic planner's guided families ask for `optional`
guidance, and no transfer layout is drawn. Explicit plans keep `required` and
`transfer`.

**Results:** completion is equal everywhere, with no ride lost. Changes are
against the previous HEAD (section fallback).

| panel | headline | strong extras / beat | v3 loss |
|---|---|---|---|
| bench (experiment, same draws) | +25.6 | −0.032 | −0.003 |
| bench (clean version) | +22.4 | −0.023 | −0.003 |
| pairs8 | +23.1 | −0.022 | −0.003 |
| confirm | +17.3 | −0.027 | −0.002 |
| sealed | +26.7 | −0.029 | −0.002 |
| held out | +22.7 | −0.041 | −0.003 |

- **Air and speed:** equal or better on every panel.
- **Body drag:** mixed and small, from −0.2 to +0.17 s/min.
- **Guide use:** 78% of the sections that offer a guide touch it (folds 92%,
  plain arcs 59%). The rest are untouched clutter, for G1 to trim.
- **Disclosed:**
  - transfer receivers are gone from automatic rides; the owner liked them
    "with variety, not everywhere", and they caused most U2 bumps;
  - distinct families per ride are 5.65 against 5.93 (the random draws
    changed with the transfer draw removed).

**Gates:**
- tests, typecheck and reach pass; three tests updated to the new rule;
- judge parity passes;
- parity: 22 cells differ, as expected (every automatic cell with a guided
  section); references refreshed.

## November 1 (overnight): the 9-frame rule replaced by a section fallback (adopted)

**Hypothesis** (stated before the run): completion equals the 9-frame rule on
every stratum with no threshold; geometry and quality stay within noise; on
specs without short sections the tracks are identical.

**Change:** a shaped section that offers no viable candidate is asked for plain
arcs, keeping its guidance and rail layout, before backtracking. `minFrames`
and `fitShapesToSections` are deleted, and the plan is rewritten to the
realized requests. The planner again reproduces V6's frozen plans exactly.

**Results against the rule** (headline, completion):

| panel | headline | completion | lost |
|---|---|---|---|
| bench | +0.4 | 41/41 = 41/41 | 0 |
| bench-pairs8 | +3.6 | 32/32 = 32/32 | 0 |
| bench-confirm | +2.2 | 41/41 = 41/41 | 0 |
| sealed | −4.1 | 18/18 = 18/18 | 0 |
| held out | +44.0 | 16/16 vs 15/16 | 0 |

- **Held out:** X finishes the one Circus ride the rule still failed (seed
  303); it was not targeted.
- **Sealed:** the −4.1 comes from rides where the search now *keeps* a shape
  squeezed into a 7–8-frame section where it was feasible (serpentine 8, fold 8,
  scallops 7), at a cost of 10–28 points on those rides. The rule always
  replaced such shapes. Whether a 0.2 s shape is worth it is a question for
  the owner's eye.
- **Other rulers:** within noise. On bench P1, inverted strong arrivals are
  +0.08 (6 cells) and body drag is lower.

**Gates:**
- tests, typecheck and reach pass, and judge parity passes;
- parity: 5 of 63 cells differ. The V6 case the rule had changed returns to
  its original track (its fold was feasible). Four cells differ at the 150k
  allowance, where dead ends are frequent. References are refreshed in this
  commit.

## October 31: quick re-landings fixed by fitting shapes to section length (adopted)

**Hypothesis** (stated before the runs): quick-pair and voice-word completion
rises, with no completion loss elsewhere; quality on both-complete cells stays
within noise under every ruler; the shaped share drops only in sections under 9
frames.

**Change:** each shaped family (fold, serpentine, scallops, terraces) has a
measured `minFrames: 9`. A shorter section gets plain arcs with the same
guidance and rail layout, and its phrase is split around it. The plan's draws
are unchanged.
- **Probe on Luna:** 8-frame quick pairs failed for every shaped family; 9
  frames passed 150 of 150 for each; guided arcs passed every 8-frame section.
- **Why guided arcs:** the guide requirement itself was never the problem, so
  the guided shapes the owner likes are kept.

**Results:** completion, baseline → candidate; no ride lost anywhere.

| panel | before | after |
|---|---|---|
| bench | 38/41 | 41/41 |
| bench-pairs8 | 27/32 | 32/32 |
| bench-confirm | 40/41 | 41/41 |
| sealed | 18/18 | 18/18 |
| held out, at the decision point | 5/16 | 15/16 |

Held out, in detail: Trouble 1/4 → 4/4, Circus pairs3 0/4 → 3/4, Circus pairs4
0/4 → 4/4, Valhalla 4/4 → 4/4. The one failure left is Circus pairs3 seed 303
at 69.7 s.

**Quality** on cells complete in both arms:
- identical tracks where no section is under 9 frames (G, P3, P5, P6);
- within noise on P1 and P2, mostly slight gains: v3 window loss −0.002/−0.001,
  strong extra hits −0.025 on P1.

**Gates:**
- parity: 1 of 63 cells differs, the V6 automatic case whose 8-frame fold
  became arcs (references refreshed in their own commit);
- judge parity passes;
- the V6 test now states the one intended difference from V6's frozen plans
  (7 of 756 plans);
- tests, typecheck and reach pass.

## October 31: the new benchmark and its first baseline

**What was built:**
- **Tooling:** stratified panels, docs/research/benchmark-audit-20261031.md.
- **Panel songs:** each now has a measured `music.ts`, plus the full 108.5 s
  Amour for P6.
- **Bench specs:** 11 dev specs, all variants: P1 Amour/Tiki, P2 Tiki/Amour,
  P3 Tiki/Amor, P4 Amour/Luna, P5 Amor/Luna, P6 Amour 108 s.
- **Sealed siblings:** P1 Luna, P2 Luna, P3 Luna, P4 Amour 44 s (Amor has no
  dense section, so this sibling shares a recording with its dev spec), P5
  Tiki, P6 Amour 108 s.

**Baseline at edd318fa:**
- **`bench-base-20261031`:** 41 cells in 249 s.
  - Completion: G 8/8, P1 5/6, P2 5/6, P3 6/6, P4 5/6, P5 6/6, P6 3/3.
- **`pairs8-base-20261031`:** 32 cells in 179 s.
  - P1: Amour 5/8, Tiki 8/8.
  - P2: Amour 6/8, Tiki 8/8.
- **The three failures, recompiled with `produce`:** each stops at an 8-frame
  section with a guide-required family.
  - Amour pairs 202: fold, budget, 193 backtracks.
  - Amour words 101: scallops, no_arc.
  - Luna intense 303: scallops, budget, 98 backtracks.

  This is the step-back's finding, on panel material.

## October 31: what comes next (owner decision)

The spec work is closed out for now:
- Trouble prefers `contrast-clusters`.
- Valhalla prefers `words3` (production ready).
- Circus Minimus prefers `pairs3`; `pairs4` is the intended spec the compiler
  cannot yet realize.

Next, agreed with the owner:
1. **Compiler step back (Claude):** one map of every open compiler thread, with
   evidence, plus an investigation of why quick re-landings at speed fail. The
   result is a ranked proposal, with no code before the owner chooses.
2. **Benchmark audit (agent, read-only):** what the current benchmark contains,
   rewards and misses; what to keep, change, add or remove.
3. **Held out:** Trouble, Valhalla and Circus Minimus stay held out from all
   compiler decisions; they are the test of whether compiler changes help real
   authored specs. The benchmark gets new dev specs on the four panel songs that
   stress the same kinds of patterns (short audible pairs, voice-led stretches,
   intense sections), with weight set through how many specs stress each pattern.
   Use the categories only, never the held-out specs' exact parameters.

## October 31: stratified benchmark tooling

Tooling only (`tools/eval`); no compiler, spec or ruler change, parity
identical. It implements the evaluation side of the benchmark audit; the bench
specs themselves are written separately.
- **Panels.** `bench` (G: the four `spec.ts` × 2 seeds; every
  `productions/*/variants/bench-*.ts` × 3), `bench-confirm` (fresh seeds),
  `bench-pairs8` (P1 and P2 × 8 seeds), `sealed` (only with `--sealed`) and
  `heldout` (Trouble, Valhalla, Circus `spec.ts` and Circus `pairs4` × 4
  seeds; only with `--heldout`, at decision points). `dev` and `confirm` are
  unchanged. Specs are discovered from file names; each declares
  `bench = {stratum, pattern, windows}`.
- **Report.** Completion first per stratum (recovered and lost cells, failure
  time and beats reached), then quality on both-complete cells under every
  ruler, plus v3 loss parts and the v3 account inside each spec's windows.
  Per-spec seed sign counts; strata weigh equally; no intervals and no
  headline number.
- **Cells** now also store the replay terminus, the v3 timing part, per-beat
  timing error and the unrequested v3 events. The evaluator identity changes;
  old runs still load and report.

## October 31: geometry hygiene (diagnosis)

TODO item 7. Report only; no compiler, measure or ruler change
(docs/research/geometry-hygiene-20261031.md, evidence in the JSON beside it;
tools in `tools/measure/geometry_hygiene/`, outside the evaluation
fingerprint). 24 fresh rides at a7d680f1 (four songs, seeds 7101–7106), all
valid; Trouble as held-out examples only.
- **Pass-throughs.** 22 crossings per ride, mostly 1–2 px contact dips. A line
  drawn through the rider 3 px or more deep: 2.8 per ride, 1–8 frames.
  - The visible kind is the rider flying through the next section's lead-in
    from behind just before the beat, in 40 of 119 fold sections. The fold
    proposal rotates the lead-in by the turn (`arc_proposals.ts` 60–62).
  - A second kind: falling into a channel through a guide's leading end, in
    36 of 745 paired guided sections.
  - The crossed segments are never touched (154 of 156). Removing them leaves
    the ride byte-identical (179 of 179 replays).
- **Untouched geometry.** 62% of the drawn length is never touched, about
  6,000 px per ride. Removing it never changes a ride (24 of 24).
  - The judge's role inference and the shape checks read it: removing chain
    ends only fails 12 sections per ride.
  - 28% of guide chains are touched only by the body.
  - `contactSummary` counts sub-pixel fragments as guides, so the Trouble
    "681 of 1,137" is 150 of 606 for real guide rails.
- **Next, owner.** Watch the collection
  (`/generated/geometry-hygiene-20261031/collection.json`) and discuss G1–G7.
  No geometry change before that.

## October 31: review-page camera no longer lurches in spins

Review page only (docs/research/camera-20261031.md). The page centred on PEG,
a sled point that circles the body in a spin (camera speed +17% / −14% against
the body centre). It now uses the videos' follower (mirror module 560) on the
ten-point body centre: +3–5% / −2% in the same spins, with no spin-induced part.
- **Videos and clips** have a third of the artifact: their follower tracks a
  six-point body mean (+3–5% / −4–5%). The video path is not changed; the
  one-function fix is described in the report. (Later the same day, with the
  owner's go-ahead, the exporter was changed too: `mirror/helper.js`.)

## October 31: impact visibility study built (unanswered)

Pre-registration only; no tool, measure or compiler change used by the product.
- **Study `impact-visibility-2026-11`** (docs/research/impact-visibility-study-20261031.md):
  55 pairs, about 17–21 minutes, from 76 of the 96 unexamined held-out rides
  (seeds 9101–9124), chosen from measured values only (seed 20261031).
  - Block A (34): unrequested extras (0.05–0.10, 0.10–0.20, 0.20–0.35), launch
    pushes and in-contact pushes after quiet touchdowns, 4 anchors, each against
    a lit blank.
  - Block R (21): clean, upright requested hits at v3 ratios 1.25, 1.5, 2 (and 3
    at base 0.25), bases about 0.25 and 0.5. Information, not a case for
    flattening requested strengths.
- **Rules fixed before answers:** 5 of 6 seen = visible, 1 of 6 = not visible
  (block A), 2 of 6 = not visible (block R); void if an anchor is missed, block A
  void if blanks are picked more than twice.
- **Changed from the step-back plan:** blanks with nothing within ±8 frames
  exist in 4 of 96 rides, so the blank window is the lit span ±1 frame (0.05
  ceiling kept), and blanks come from the same song rather than the same ride.
- **Next, owner:** answer it. No measure or compiler change before.

## October 31: the impact measure (U1 stopped, step back)

Reports only; no tool, measure or compiler change merged.
- **U1 candidate stopped** (docs/research/u1-measure-study-20261031.md). v3
  with both detector fixes gets 45 of 63 decisive owner pairs against v3's 47;
  on the 4 pairs it re-ranks, his answers side with v3 (2 decisive, 1 same,
  1 neither). Its values there equal the old "strength" candidate he had
  already ruled against. The candidate code stays on branch
  `worktree-agent-a1f12a7790eda8a3d` (a804bc08); 96 held-out rides (seeds
  9101–9124) are compiled, unexamined, in that worktree.
- **Step back** (docs/research/measure-step-back-20261031.md). Validated:
  ordering of clearly different hits only. Not validated: scale, timing,
  extras, and what counts as the hit of a quiet beat (two October clips: v3
  matched a near-invisible touch; he saw one "late" hit 200–275 ms later).
  The October labels are now spent as test data.
- **Night study answered** (result in the step-back report). On 16 random
  strong beats he answered "same" 10 times, including pairs v3 rates 1.5–1.9×
  apart; v3 got 3 of 6 decisive. On 6 head-down vs upright pairs v3 got 6 of 6.
  Strength differences among ordinary strong hits are mostly not visible to
  him in isolation.
- **Next, owner:** the visibility study (extras, late pushes), now with a
  strength-resolution block. No measure or compiler change before fresh answers.

## October 30 follow-up: unwanted impacts (diagnosis)

TODO item 3. Report only, with no compiler, measure or ruler change
(docs/research/unwanted-impacts-20261030.md, evidence in the JSON beside it).
It covers the 48 dev and confirm panel rides, with Trouble as held-out
examples only.

- **Counted extras are real but mostly weak.** On authored rides there are
  7.8 per ride of strength 0.1 or more (median 0.05, max 0.33). They are 12%
  of the v3 loss.
  - The cost is carried by the shoulder or hands hitting an upper guide or
    receiving rail. That is 69% of the extra cost, and 71% of these come
    within 12 frames after a strong hit.
  - Long floats and seams are minor on the panel.
  - The Trouble slam "float" at 3.85 s is a guide-required terraces section.
    The shoulder grazes the guide, then the sled re-lands (0.38).
- **The account misses bigger pushes.** About 3 force maxima per ride lie in
  no event's frames (median about 0.3–0.37, up to 0.95). That is 155 of 0.2
  or more, against 48 counted. Two of the causes are detector defects:
  - a renewal whose 6-frame window ends before its own peak (6 panel cases,
    9 on Trouble);
  - a gentle touchdown followed by a hard turn with no valley, which can never
    form an event (86 cases, mostly after quiet beats).
- **The search exploits that window.** 55% of quiet catches meet an uncounted
  turn of 0.2 or more in the same contact. Its timing is 6–9 frames after
  contact (173 cases) and almost never 2–5 (8 cases).
- **Transfer layouts force extras.** They are 9% of sections but carry 48% of
  the extra cost. 324 of 332 touch their receiver only through unmatched
  events, because fulfilment requires a separated second contact.
- **Next.** U1–U5 are hypotheses. The measure fix (U1) comes first and needs
  owner pairs before it may become an objective.

Independent check before merging (2026-10-30). Simulating the four review
rides and taking the raw whole-body impulse over every 2-frame window,
independent of where the detector places events:
- requested strong hits (≥ 0.7) match v3 (medians 0.67–0.77 both ways), so
  the check is calibrated;
- amour 303 at 1.625 s: a raw 0.80 push with no requested beat within 0.3 s;
- tiki 101, quiet beat at 42.73 (asked 0.03, v3 0.04): raw 0.50 five frames
  later. Luna 404: quiet beats are followed 4–7 frames later by raw pushes of
  0.20–0.39 (1.5, 2.1, 3.4 s). On these two rides the raw peak after a
  quiet beat falls 4–6 frames after it in 17 of 23 cases;
- Trouble slam 101, 3.85 s: inside a terraces section with guide lines (frames
  141–231), as the report says.

## October 30 follow-up: cheaper candidate geometry

Structural (TODO item 1). After the crashed-candidate stop, physics stepping is
a minor part of a candidate. Profiles of the four songs (seed 3001) and the
93-second long case attributed each candidate's main-thread CPU to its parts
(innermost enclosing function):

| part | songs, before | songs, after | long, before | long, after |
|---|---|---|---|---|
| line registration and undo (native addLine) | 19–21% | 18–21% | 29% | 31% |
| construction inspection | 7–9% | 5–6% | 20% | 8% |
| geometry construction (motionArc) | 10–11% | 7–8% | 8% | 6% |
| physics stepping | 12–13% | 14% | 14% | 19% |
| objective, impact checks, detection | 25–30% | 29–33% | 11% | 16% |
| garbage collection | 7–8% | 8–9% | 11% | 13% |

Shares are of a smaller total afterwards; in seconds, physics is unchanged and
the other parts shrank. Registration in the long case went from 90 to 71 s of
sampled main-thread time, inspection from 63 to 17 s, motionArc from 26 to 13 s.

Four commits, each with identical tracks, frame counts and scores:

1. **Contacted guides only.** Construction inspection attributed every guide
   line (up to about 2,000) to its nearest main-rail segment, but only
   contacted lines are ever read. The long case spent 19% of its main thread
   there. The report fields, shared with the judge, are unchanged.
2. **motionArc helpers at module scope.** Two arrows defined inside the step
   loop cost a closure and, under tsx, an `Object.defineProperty` (`__name`)
   per step: about 3% of a song compile.
3. **Binary search in grid buckets.** Pays only in the long case.
4. **One native version per addLine batch.** Lines crossed the ABI one at a
   time and each became its own version node. A batch is now one version with
   the same `_addLine` sequence; reconciliation undoes and redoes its lines in
   the same order.

Paired process CPU, three pairs per case, every pair identical (medians):

| change | luna | amor | tiki | amour | long |
|---|---|---|---|---|---|
| 1. contacted guides | 0.978 | 0.974 | 0.974 | 0.967 | 0.867 |
| 2. motionArc helpers | 0.956 | 0.974 | 0.979 | 0.972 | 0.963 |
| 3. bucket search | 1.006 | 0.990 | 1.003 | 0.989 | 0.974 |
| 4. batch versions | 0.973 | 0.949 | 0.963 | 0.962 | 0.926 |
| all four, against 458fe8af | 0.917 | 0.906 | 0.925 | 0.889 | 0.731 |

The long case went from 287 to 210 s of process CPU (median of the combined
pairs). Peak RSS rose with change 4: songs by up to 60 MiB in most pairs, the
long case by about 140–250 MiB of 2.1 GiB. The cause is not established.

Gates at the series head: parity 63/63 identical, judge parity 33/33, 284
tests, 9 native tests (one new: bucket search against the old scans under
random churn), typecheck 0, reach 0, engine trace identical.

Dropped: storing each grid entry's line id beside it (pairs 0.99–1.02). The
profile with separated native functions had suggested pointer-chasing in the
bucket search; the timing did not confirm it.

What remains: registration is still the largest part. Most of it is the nine
center-cell buckets each line enters and leaves, the history lookup per cell,
and small allocations. Lazily materializing a center bucket only when the
rider reaches it could avoid registering lines the rider never approaches,
but invalidation must then reproduce the same truncations; it is a larger
engine change and was not attempted.

Behavioural opportunities noticed, not taken:

- Facet density, as on October 29: long sections are built from 1–4 px
  facets, so registration and undo scale with facet count. Coarser facets
  would change geometry.
- If CPU should be the budget, registration could be charged per line, as the
  binding-stop ruling noted; a crashed candidate still pays it in full.

Evidence: `docs/research/geometry-cpu-20261030.json` (all pairs with hashes,
frames, CPU and peak RSS; both profile breakdowns).


Review before merging (2026-10-30):
- Changes 1–3 checked by reading: change 1 attributes only the guides a
  report reads, and each guide's attribution is independent of the others;
  change 2 is the same arithmetic; change 3 keeps every bucket in the order
  the binary search assumes, and every write goes through the two functions.
- Change 4: the old loop never exposed versions inside a batch, undo and redo
  keep the per-line order, and Rust makes every match on the patch type
  handle the batch.
- Memory: the native engine's memory is lower after change 4 (luna 158 → 153
  MiB, amour 180 → 168 MiB), and the live JS heap after forced GC is the same
  (about 40 MiB). The higher peak RSS is garbage-collection timing, not
  retained memory.
- Independent CPU check, fresh seed 777, concurrent pairs against 458fe8af:
  luna 0.905, amor 0.920, tiki 0.897, amour 0.915, with identical charged and
  simulated frames.
- Owner ruling: the three noted opportunities (lazy collision grid, coarser
  facets, charging geometry to the allowance) are not taken. Keep the code
  lean; this was groundwork, not the focus.

## October 30 follow-up: stopping crashed candidates early

The owner ruled to take the first behavioural observation of the long-ride CPU
follow-up. A candidate whose rider or sled came unbound was simulated to the
interval horizon before being rejected.

**Step 1, structural (f763b5e3).** An unbinding is permanent in the kernel. The
replay now steps frame by frame and stops at the first unbound frame. It is
still charged, and checked against the limit, as the full read was.

The stop waits until one of the candidate's own lines has been hit. The engine
shares one frame cache per lineage, and reading another version truncates it
to the first collision of the lines it removes. Stopping before such a hit
could leave a sibling to re-simulate frames that the full read would have
cached. The new native test shows this: the sibling's charge goes from 80 to
149 frames.

- Every gate passes: parity 63/63 identical, judge parity 33/33, tests,
  typecheck 0, reachability 0, engine trace identical.
- The 48 dev and confirm panel cases are also identical to the base, in track
  and frame count.
- Five instrumented rides: every crash had already hit the candidate's own
  lines, so all frames after the crash are skipped. That is 18.2% (luna),
  18.4% (amor), 17.0% (tiki), 25.3% (amour) and 13.0% (long case) of physical
  frames.
- Paired process CPU, six concurrent pairs per case, every pair identical:
  median ratios 0.997 (luna), 0.988 (amor), 0.989 (tiki), 0.972 (amour) and
  0.980 (long case). The saving is only 0.3–2.8%, far below the frame share.
  Physics stepping is a small part of a candidate's cost (16% of the long
  case's CPU). A crashed candidate still builds and registers its geometry
  and replays up to its crash, and the new loop reads every frame once.

**Step 2, behavioural (the commit after this record).** It charges only the
frames simulated and stops at the first unbound frame. It was evaluated as
14dd3f72, kept as branch `bstop-step2-evaluated`. The hypothesis and decision
rule were written before any step-2 run (in the evidence file):

- freed allowance buys more search;
- completion and v3 loss equal or better;
- no other ruler worse with its song interval excluding zero.

Results:

- Work, five rides: 9–14% more fresh candidate evaluations. The search now
  ends at 84–98% of its allowance (step 1: 99.7% or more), so the allowance
  stops binding and frames fall 2–16%.
- Panels, paired against step 1 (48 cases, song bootstrap):
  - completion 48/48 in both arms;
  - v3 impact loss, authored: −0.0004 on dev (−1.7%) and −0.0011 on
    confirm (−4.5%), with intervals that only just exclude zero;
  - v3 impact loss, perturbed: +0.0004 and −0.0001, null;
  - strong and very strong bias, speed, contested beats and body drag show
    no change outside their intervals; air improves on confirm perturbed
    (−0.004);
  - quiet bias (−0.007) and inverted strong arrivals (−1.9 pp) improve on
    dev authored only;
  - worse, with intervals excluding zero: R1 strong extra hits on dev
    authored (+0.010/beat) and R1 strong strength rms on confirm authored
    (+0.006). Each is one of four panel cells, with the opposite sign
    elsewhere.
- Catalog, the Oct 5 audit's 336 training-catalog compiles (equal group
  weight, 15 groups; quality on the 317 complete in both):
  - completion 318/336 in both; one case recovered and one lost, all
    failures budget, as on Oct 5;
  - v3 impact loss −0.0006 (−3.4%), lower in 14 of 15 groups;
  - air (−0.0013) and speed (−0.0018) rms also improve, with intervals
    excluding zero;
  - quiet bias, body drag and R1 extra hits lean worse, but their intervals
    include zero.
- Paired CPU against step 1, three pairs per case: median ratios 1.09
  (luna), 1.09 (amor), 1.07 (tiki), 1.11 (amour) and 1.17 (long case).
  Catalog: +6.6%. The extra evaluations cost more than the frames saved.
- Parity references are refreshed in that commit. The V6 sentinel cells are
  neutral (mean 883.5 → 883.8, 18/18 valid). Three scenario tests now use the
  nearest allowance that reproduces them under the new accounting.

Decision, by the rule stated in advance: step 2 does not qualify. Two R1
cells are worse with intervals excluding zero, and it costs 7–17% more CPU.
Recommend merging step 1 alone; its saving is small but free.

Step 2's v3 gain is small but consistent (two authored panels and 14 of 15
catalog groups). The owner may still prefer it, at the CPU cost, if that
search is worth buying. The catalog evidence came after the rule and is
training-catalog data, so it does not change the rule.

Evidence: `docs/research/binding-stop-20261030.json`. Branch
`worktree-agent-a011b559a887ffc0e`.

**Owner ruling (2026-10-30): take step 2.** Verification before merging:

- Accounting audit (every engine method wrapped; frames the native engines
  actually stepped, against frames charged): before the change and with step 2,
  charged − stepped is the same constant (3,560 on luna seed 101, the final
  replays outside the wrapped engine). Step 1 alone charged about 430,000
  frames it never simulated (luna, amour, tiki). Step 2 neither leaves frames
  unbilled nor bills frames not simulated.
- Why about 11% of the allowance stays unused: the expansion search spends
  about 86% instead of 97% of it. The whole-ride refinement then stops at its
  12-attempt cap under both accountings, accepting 0–3 of its 48 proposals
  (luna, tiki, amour). The rest is not search cut short.
- Matched-CPU comparison (dev and confirm panels, 48 compiles per arm, all
  three arms run at the same time; step 1 at ×1.00 reproduces the agent's
  step-1 tracks 48/48):

  | arm | complete | mean v3 loss | compile time | physics frames |
  |---|---|---|---|---|
  | step 1, allowance ×1.00 | 48/48 | 0.02278 | baseline | baseline |
  | step 1, allowance ×1.10 | 48/48 | −0.5% | +5.5% | +8.3% |
  | step 2, allowance ×1.00 | 48/48 | −2.0% | +6.3% | −11.0% |

  Paired by song, step 2 against step 1 ×1.10 is within noise on most
  rulers. v3 loss is better on confirm perturbed and worse on dev perturbed;
  quiet bias, strong bias and inverted arrivals are mixed. So step 2's search
  is at least as efficient per CPU second as more allowance, not a free gain.
  Its own merit is that the allowance now counts the physics actually done.
- Consequence: the allowance counts physics frames, but most of a candidate's
  CPU is building its geometry. A crashed candidate is now nearly free in
  frames while still costing that CPU. If CPU should be the budget, geometry
  work must be charged too; that would be a separate decision.

## October 30: spec variants, old toolchain removed

- Owner rulings: remove the May–June `beats/` consensus toolchain entirely
  (done; Amour's files moved into its production folder; parity and judge
  parity pass); generate several whole-spec variants of a song from one
  measured reading, with no fixed set and no versioning machinery; take the
  stop-after-crash opportunity (agent, two steps).
- `productions/<song>/music.ts` holds the measured layers; `variants/*.ts` are
  whole specs; `spec.ts` re-exports the preferred one. `produce --variant`,
  `coverage --variant`, and the dashboard lists variants. Dashboard notes now
  snap to measured events (they snapped to madmom's wrong grid) at 10 ms.
- Trouble rides (`generated/trouble-variants-v1`): kick, voice, slam, pulse.
  All complete except pulse seed 101 (budget, in the groove). 50.07 lands;
  0.21 s pickups land; a landing at 0.13 s cannot. v3 loss: kick
  0.010/0.013, voice 0.007/0.009, slam 0.018/0.008, pulse 0.022.

## October 29–30 follow-up: music authoring

Structural for the compiler (no compiler change). A first
draft of a new song, Trouble, was mostly wrong by the owner's ear. The single-mix
analyzer had detected every flagged event; the draft was authored grid-first
(half-time, out of phase with a 3-3-2 kick), read a near-zero sub-band as
"beatless", and used onset strength as loudness. New workflow
(docs/music-authoring.md):
- Demucs stems and ADTOF drum transcription (`tools/music`);
- an event list per instrument and close-up sheets;
- a coverage report relative to the spec's own choices;
- the spec dashboard restored read-only (`spec-dashboard/`,
  `scripts/gallery/spec_api.ts`), with an events lane and clicks at landings.

Trouble was re-authored event by event (draft v1). It is new music: keep it out
of compiler tuning. The review pages now verify artifacts over plain HTTP on a
LAN/VPN (`motion-gallery/sha256.js`); `crypto.subtle` exists only on localhost
or HTTPS.

## October 29 follow-up: long-ride compiler CPU

This was structural work to prepare for longer songs. The 93-second catalog case
(`stretch_supported_speed_change`, seed 101) cost 164 µs of CPU per physical
frame, against 29.5 µs for luna_bala_44s (seed 3001). Its first 40 contacts
(45 s) took 593 s of CPU, against 89 s for luna with about the same number of
physical frames (3.1M vs 3.0M).

Profiles and work counters located the cost outside the search and outside
physics stepping. Stepping was 3% of the long case.

- **Construction inspection, 59% of the long case.** Each guide segment was
  attributed to its nearest main-rail segment by scanning every segment.
  Long supported sections produce candidates with up to about 2,000 segments
  on each rail, which made 5.6 billion pairs in the first 40 contacts.
- **Prefix rescans, quadratic in ride length.** Every candidate re-detected
  the whole ride from frame 0. On luna this scanned 89M frames for 3M physical
  frames.
- **Whole-ride terminal objective.** It recomputed whole-ride gains and motion
  filters once per contact.
- **Line undo.** Undoing each candidate scanned the cached events once per
  removed line.

Five commits fix these with identical tracks, frame counts and scores:

1. Resumable prefix detection.
2. Single-pass terminal objective.
3. Bounding-box skipping.
4. A cell grid for guide attribution.
5. One-scan line undo in the compiler engine (`engine.wasm` rebuilt).

Every commit passes 63/63 parity cells, judge parity, tests, typecheck and
reachability. Paired process CPU, with both arms running concurrently:

- **Long case:** 1,045 → 269 s and 1,038 → 266 s (0.257 and 0.256), with peak
  RSS about 6–16% lower.
- **Four production songs at seed 3001, two pairs each:** medians 0.842, 0.850,
  0.806 and 0.840.
- **Per-frame cost:** 37–45 µs at every truncation of the long case, from
  6.8 s to 92.7 s. Before, it rose from 40 to 191 µs.

Rejected because measured effects were within noise:

- set membership for main-rail contacts;
- 16 px grid cells, whose gain appeared only in an offline microbenchmark.

Behavioural observations, not implemented:

- **Simulation after a crash.** Candidates rejected for a broken binding are
  simulated to the interval horizon. Frames after the rider or sled first came
  unbound are 18.2% of luna's physical frames and 13.0% of the long case's.
  Stopping at that frame would reject the same candidates, but it would change
  the allowance accounting and therefore the tracks. (October 30, above: the
  stop can keep the accounting unchanged, and it saves only 0.3–2.8% of CPU.)
- **Facet density.** Long supported sections build rails from facets with
  median lengths of 1.1–3.7 px (three captured inspections). Their line
  registration remains about a quarter of the long case's CPU. Coarser facets
  would change geometry.

Evidence: `docs/research/speed-20261029.json`, with 65 paired records (hashes,
frames, CPU, peak RSS), both length-scaling batches, counts and profile shares.
Branch `worktree-agent-a9af6a2373848b41e`.

## October 29 follow-up: geometry-family registry

Structural. A geometry family is now one row of `geometry_families.ts`: its
review-page label, its fixed profile settings and, for a shaped family, its
tangent schedule. The planner's family list and default repertoire, the
section styles, the motion profiles and the review page's choices all read
that table.

Before, a new family had to touch at least four files: the profile schedule,
the planner's list and section style, the review-page labels, and a test that
counted six families. Two gallery recipe modules and the documentation needed
edits to stay consistent. Extending the value model's six-family features
was an undocumented trap: it breaks the model's 73-feature contract.

A toy family added only as a table row plans, builds, compiles valid and
passes its realization check (`tests/geometry_families.test.ts`). Adding a
real row is still a behavioural change: ARCHITECTURE.md lists what it changes
and which check fails on purpose. Parity cannot see it, because the automatic
cells pin the six-family repertoire.

Dead code removed:

- `motionArc`'s `flow` and `wave` arguments;
- rail contours and their gallery recipes;
- the retired composition documents (`repertoire_plan.ts`, presets and
  request validation) and the gallery recipe table they used.

Validation, at each of the three commits:

- compile parity 63/63 identical, judge parity 33/33;
- all tests pass;
- typecheck 0 errors, reachability 0 unreachable.

An equivalence digest also matches the previous commit over a grid of inputs.
It covers plans (including the default repertoire, which parity does not
reach), section styles with key order, profile headings (bit-exact), profile
validation and built geometry.

Looking a heading up in the table costs about 20–30 ns more per shaped step
than the old `switch`. One V6-budget automatic compile makes 1.09M such calls
in 79 s, so the cost is at most about 0.04%.

## October 28 follow-up: reuse candidate span measurements

Structural compiler work while the next behavioral direction is being considered.
Candidate scoring previously measured air, speed and amplitude twice on the same
trajectory window. It now reuses the reported axes and separately recovers raw
amplitude only when a targeted amplitude reaches the reporting cap. The reported
values remain capped; search residual arithmetic and physics accounting are
unchanged. The regression check covers capped and uncapped spans, untargeted
amplitude, immutable reported measurements and exclusion of survival grace.

An isolated span-scoring microbenchmark (20,000 measurements, five warmed pairs)
went from a median 80.5 ms to 56.5 ms with identical sums. This measures only that
scoring operation, not end-to-end compilation speed.

Validation: all 63 compiler parity cells preserve tracks, physics-work counts
and scores exactly; 33 judge tracks and all 280 tests pass. Typecheck and
reachability pass with zero unreachable files. No reference updates.

Branch `rework/foundations`, from `7e2a3dfb`. Everything before the rework is
preserved at tag `archive/pre-rework-2026-10-03` (code, docs, evidence, tests,
models). Deleting something from this branch never loses it.

## Why

The October 3 audit (memory note `codex-era-audit-2026-10-03`) found:

- **Measurement is misaligned with the goal.** Frozen V6 rewards accumulated
  landing impact inside a 150 ms window. It is inversely related to measured
  hit clarity (July tracks 514 / clarity 6.5; current 822 / 2.6). The
  experimental `line.contact-impact.v1` fixes event identity but keeps the
  strength kernel, times hits at onset rather than peak, and has a renewal
  blind spot the compiler already exploits. Its headline gains are self-graded.
- **Evaluation is weaker than it looks.** Seeds mostly reproduce identical
  tracks, every V6 input is a training input, the reserved panel is a sibling,
  the V2 sequential test cannot reject, V6 gains were ~87% completion.
- **The compiler is a monolith.** Key facts:
  - `compileArcMotionOnce` is 1,242 lines and `ArcMotionOptions` has 134 fields.
  - The budget caps were tuned to V4 and saturate.
  - The old search compiler is always loaded, and an unused 102 MB model is
    loaded too.
  - The frozen judge hashes 36 compiler files.
- **The repository is mostly dead weight.** 68% of the TypeScript is
  unreachable from production, `npm run verify` tests only the retired
  compiler, docs contradict each other, and there are 149 npm scripts.

## Principles for this rework

1. **One product.** The product is the automatic-arrangement compiler: music
   spec → seeded plan → normal-line geometry → native physics, plus the tools
   to author specs, review rides and render videos. Anything else is archived.
2. **Behaviour changes are separate from structure changes.**
   - Structural steps must leave tracks, frame counts and scores byte-identical,
     proven by the parity harness.
   - Behavioural steps are separate commits, with a stated hypothesis and an
     honest paired measurement.
3. **Never optimize an unvalidated measure.** A measure becomes an objective
   only after it agrees with the owner's blind judgments on held-out passages.
   Every result is also reported under the other rulers, so self-grading is
   visible.
4. **Honest comparisons.** The song is the unit. Report completion separately
   from quality, use intervals rather than point estimates, and use real
   perturbations rather than repeated seeds. Report on new music when making
   claims about generality.
5. **Lean by default.** Delete rather than flag-off. Experiments live on
   branches. The codebase holds what the product uses, plus the instruments
   that judge it.
6. **Few, current documents.**
   - `README.md` — what it is and how to run it.
   - `ARCHITECTURE.md` — how it works.
   - `WORKING.md` — the rules for changing it.
   - `docs/decisions/` — dated decisions with evidence.

## Decisions (owner can overturn; all reversible via the tag)

- **D1 — Retire the old search compiler and the non-arrangement routes.**
  - What goes: `legacy_handoff.ts` and its closure; the ordinary
    connected-arcs route and its preview rollout; the 102 MB arc policy model;
    grain/elevation axes; non-WASM compile backends.
  - Why: production and V6 never use them.
  - What stays: the JS reference engine, kept for engine parity checks only.
- **D2 — V6 becomes a frozen sentinel defined by outputs, not file hashes.**
  - It runs only at delivery boundaries, as a regression check.
  - It is no longer a target; no further benchmark versions get built for
    chasing.
  - V2–V5 runners and data are archived.
- **D3 — Two impact rulers coexist explicitly until Phase 3 decides.**
  - The frozen landing ruler (for the sentinel) and the contact-impact ruler.
  - Both live in one `contract/` module that has no compiler dependencies.
- **D4 — Learned artifacts must earn their place.**
  - Each needs provenance, size and an ablation.
  - Models must be trained on data disjoint from what judges them.

## Phases

Each phase ends with a gate. Phases 0–2 must be byte-identical on the parity
harness.

### Phase 0 — Safety net (done)

- **Parity harness** (`npm run parity`):
  - Fixed V6 cells covering every fixed family and the automatic panel,
    including the production songs, in default and contact-impact modes.
  - Each cell must match the stored reference exactly: track hash,
    physics-frame count and score.
  - Runtime should be a few minutes.
- **Judge parity:** re-score every stored V6 track; scores must be identical.
- **Typecheck:** a `typecheck` script that works, with the error count
  recorded as a ceiling that only goes down.

### Phase 1 — Prune (done)

- Archive the unreachable code: studies, probes, old benchmark runners,
  galleries and dashboards that are not the production player, and
  stale docs.
- Retire the old compiler (D1).
- Remove force-added data and dead npm scripts.
- Rewrite `README`, `CLAUDE.md` and the working rules to describe what
  actually exists.
- **Gate:** parity, judge parity, live tests and typecheck ceiling.

### Phase 2 — Restructure (done; judge/compiler file separation remains)

- **Separate the contract.** Measurement (detector, impact rulers, scoring,
  layout checks) moves out of the compiler into `contract/`. It has an
  explicit section map, no env reads and no compiler types.
- **Redefine the sentinel's identity** as stored-output parity.
- **Split the compiler into stages:** plan → interval solve → sequence →
  refine → validate.
  - Production configuration is kept separate from research overrides.
  - Dead options are removed, and the memo key is derived from declared
    option sets.
  - There is one validity predicate.
- **Geometry-family registry**, so a new family touches one module (done:
  `geometry_families.ts`).
- **Replace the legacy-schema telemetry shim** with native telemetry.
- **Gate:** parity (identical tracks), judge parity.

### Phase 3 — Measurement foundation (done: line.strike.v1, decided by physics and evidence at the owner's request; blind labelling remains available)

- **Candidate sync measures:**
  - the renewal fix;
  - "nothing hidden" accounting;
  - peak or centroid timing;
  - the 10-point external impulse as a diagnostic;
  - clarity.
- **A blind labelling tool**, built on the production player, with about 300
  beat-level judgments split into design and holdout halves.
- **Adopt one impact definition** only if it wins on holdout. It then becomes
  the single ruler for both the compiler and evaluation.

### Phase 4 — Evaluation foundation (done except held-out new music, which needs new songs)

- One evaluation command:
  - **Songs as units:** bootstrap intervals; completion and quality reported
    separately.
  - **Real perturbations** rather than repeated seeds.
  - **A held-out new-music set** that no training or tuning has touched.
  - **The V6 sentinel** as a regression check.
- One review page per track:
  - beat time and requested impact;
  - onset and peak;
  - strength;
  - competing hits;
  - every ruler's value.

### Current focus (owner, 2026-10-04): measuring impact, separately from producing it

Two problems, worked on in order. Status on 2026-10-05: see
docs/research/overnight-20261005.md and the dashboard (motion-gallery/night.html).

1. **Measuring impact: done** (line.strike.v3).
   - The owner's blind pairs chose the change of the rider's whole-body
     motion (travel and spin) within 50 ms.
   - Floor-then-rail opposite pushes are two impacts.
   - Open: the absolute scale (isolated maximal hits are physically
     possible; dense runs are capped near 0.6–0.7) and whether pass-throughs
     and body drag matter. Both are owner questions.
2. **Producing impact: at the measured frontier for tonight.**
   - Adopted: the v3 objective, the steep upright arrival before strong asks
     and a wider lookahead into them.
   - Result, evening → tonight: impact loss −60% on four panels; speed
     unchanged; air +0.005.
   - Past this, strength trades against speed (a slam spends speed the spec
     asks for) and survival.
   - Open: retraining the learned models on v3; owner choices on the
     speed/strength and air/impact trades.

### Phase 5 — Compiler quality (resumed 2026-10-04 night under line.strike.v3)

Only on validated measures:

- a scale-free, incumbent-preserving budget schedule (default allowance now
  scales with ride length; the width schedule is still saturating caps; see
  docs/research/compiler-budget-20261004.md);
- lookahead value per frame;
- learned models retrained on disjoint data, or removed;
- extensibility proven by adding a geometry family through the registry
  (shown with a toy family in `tests/geometry_families.test.ts`; a production
  family remains).

## Log

- 2026-10-03: branch and tag created; plan written.
- 2026-10-03: **Phase 0 done.** Parity harness: 23 cells, plus judge parity on
  483 stored tracks. Typecheck works (255 errors).
- 2026-10-03: **Phase 1 done.**
  - The V6 freeze moved from source hashes to outputs.
  - Retired: the legacy compiler, the ordinary route, studies and probes,
    V2–V5 runners and data, old dashboards, 210 dead tests and 137 npm
    scripts.
  - The server went from 1,952 to 70 lines.
  - Compiler identity is now git-based.
  - Docs went from 425 files to 43: owner-feedback research plus README,
    ARCHITECTURE, WORKING and CLAUDE.
  - Tracked files went from about 3,900 to about 1,450.
  - Typecheck: 16 errors. Parity holds and all tests pass.
- 2026-10-03: **Phase 2 started.**
  - The unused 102 MB arc policy and the ordinary compile route are removed;
    parity holds and is faster (88 → 81 s).
  - A focused agent is splitting `arc_motion.ts` on branch
    `rework/compiler-split`.
- 2026-10-03: **Phase 3 and 4 instruments.**
  - `tools/measure` (observations plus candidate per-beat measures).
  - A blind labelling study, `impact-2026-10`: 120 clips, waiting for owner
    labels.
  - `tools/eval`: a song-level behavioural evaluation.
  - Reading:
    - "Contested strong beats" separates the eras cleanly: July 0%, current
      28%, experimental 5%.
    - Contact mode against the default, paired: contested −19 pp, strong extra
      hits −0.25/beat and late peaks −6 pp, holding on perturbed inputs too.
      It costs +39% physics.
- 2026-10-03: **Phase 2, compiler split** (branch `rework/compiler-split`).
  - 61 research-only options removed: interval options went from 145 to 84
    (77 production fields, 7 set only inside the compiler); one search
    attempt instead of the preview/completion-first attempt layer.
  - `compileArcMotionOnce` (1,242 lines) is split into stage modules with
    explicit state; `arc_motion.ts` went from 1,519 to 56 lines.
  - Production configuration is declared separately from per-interval
    overrides; the memo context is derived from `EVALUATION_IDENTITY`.
  - One validity predicate (`ride_validity.ts`).
  - Every commit: parity byte-identical, output fingerprints of all 23 cells
    identical apart from deliberately dropped telemetry, typecheck 16.
- 2026-10-04: **Phase 2 gate passed.** The full V6 sentinel at 5eea516e is
  identical to the stored reference on all 460 runs (track hash, frames and
  score; headline 835.616).
- 2026-10-04: **Strike account.**
  - `line.strike.v1` (`scripts/lib/strike_impact.ts`;
    docs/research/strike-definition-20261004.md) is integrated through the
    impact-account registry.
  - Its search profile: preparation 2, which was accepted; H1 and H2 were
    rejected.
  - Paired against the default: strike loss −0.21, strong extra strikes
    −0.32/beat, contested strong beats −20 pp (to 5%, July 3%), late peaks
    −11 pp, at +0.67 M frames.
- 2026-10-04: **Strike adopted as the product objective.**
  - The registry holds `line.strike.v1` only; contact-impact v1 is now a
    research diagnostic.
  - Production, dashboard jobs and the library default to strike, with
    `landing` as a temporary comparison mode.
  - Parity gained strike cells.
  - The review library was regenerated: 12/12 fulfilled.
  - Motion checks all pass.
  - Perturbed panel against the old default: peak lag −47 ms, contested beats
    −24 pp, strike loss −0.20.
- 2026-10-04: **Old schema retired.**
  - `CompileStats` is lean (types.ts went from 1,743 to about 830 lines), and
    a native work record replaced the budget-telemetry shim.
  - Deleted: `selective_backtracking.ts`, `repair_branch_bound.ts`,
    `register.ts`, `budget_telemetry.ts`, `budget_estimator.ts` (with its model)
    and `budget_model.ts`, about 7,100 lines.
  - Typecheck errors: 0.
- 2026-10-04: **Budget study** (docs/research/compiler-budget-20261004.md).
  - Every search width saturates by about 0.52M on 45 s songs, and the
    saturated search costs 1,200–1,550 frames per ride frame.
  - Ablations: A1 (no value model) and A2 (no construction policies) are both
    slightly worse, so both are kept.
  - Rejected: R1 (refine every section), K1 (recalibrated allowance), P1
    (fair-share pacing of local search), L1 (lookahead off: −1.65M frames
    but strike loss +0.007) and P2 (reserve factor 1.2).
  - Adopted, S1: the default allowance is 1,700 frames per ride frame
    (`production_budget.ts`), so long songs are not starved. It is neutral on
    the panel; requests may omit `budget`.
- 2026-10-04: **Review library regenerated** with the current compiler
  (`generated/production-repertoire/library-strike-s1`; the earlier strike
  library predates the work record, so it cannot render).
  - 12/12 fulfilled; published to the dashboard against library-candidate-8.
  - Motion check: 4- and 10-frame burst burdens 0, reported windows and
    openings pass. **The 1-frame burden ratio is 0.52 against a 0.50 limit**
    (the earlier strike draw was 0.34). It is driven by amour #303 (142 vs
    the previous library's 272) and tiki #303, a draw-to-draw difference: a
    single-frame spike is also what a strong requested hit looks like.
- 2026-10-04: **Constant options removed** (structural, branch
  rework/constant-options, merged).
  - Interval options went from 84 to 58: 17 constant base options, 9
    repertoire and intentional-plan flags, `arrivalMode` (now an internal
    passive-arrival flag), and `guidance` narrowed to 'clearance'.
  - Research knobs were removed from `arc_motion_control.ts`. v1 plans are
    rejected explicitly.
  - Tests went from 266 to 255; each deleted case only compared a removed
    option on and off.
  - Parity now also pins 18 low-budget cells (150k and 750k), where the
    budget-gated options take other values. All 41 cells and judge parity
    pass.
- 2026-10-04: The review library is rendered (12/12 videos).
- 2026-10-04: **Impact measured as the owner sees it: line.strike.v2.**
  - Owner blind pair studies: 3 rounds, 77 pairs (`labels/studies/impact-pairs-*`).
  - Strike v1's strength matched the owner on 31 of 63 decisive pairs. The
    pairs were chosen where the measures disagree; head to head, v2 won
    22 : 7.
  - The whole-body motion change (travel and spin) within 50 ms matched on
    46 of 63. Spin: 8 : 3 where it was the only difference (p ≈ 0.11, so
    supported but weakly; an earlier "12 : 4" counted 5 pairs twice, as the
    code review found).
  - v2 is the product default: v2 impact loss 0.078 → 0.037, with no
    completion or timing cost.
  - Parity gained 11 strike2 cells (52 in all).
  - Problem 1 (measuring) is done apart from the absolute scale and the
    separation of floor-then-ceiling hits. Problem 2 (producing strong hits)
    is next.
  - The review library was regenerated under v2
    (`generated/production-repertoire/library-strike-v2`): 12/12 fulfilled,
    published to the dashboard.
  - Motion check: the 4- and 10-frame burst burdens fell by 90–100%, and the
    windows and openings pass. The 1-frame burden ratio is 1.06, which fails
    the halving rule.
  - The 1-frame rule counts single-frame speed GAINS (kicks), not slams. There
    are only 13 such frames in 12 rides, about half away from any beat: a
    small item to watch in problem 2.
- 2026-10-04 night: **Pre-registered H-v3** (double hits). Under line.strike.v3,
  opposite pushes (floor then upper rail) are separate impacts.
  - Measurement check: on rides with rails, 94% of the added splits start on an
    opposite-facing surface; July (no rails) has none; the count is insensitive
    to the threshold (107°–135°: 181–189).
  - Hypothesis: compiling with v3 instead of v2 reduces double impacts per beat
    (v3 − v2) and v3 loss, with no worse-than-noise change in v2 strength rms,
    completion, peak timing, contested beats, air/speed/amplitude rms, bursts
    or compile cost.
  - Adopted as default only if all hold on both panels.
- 2026-10-04 night: **H-v3 result** (s3-a against s2-base).
  - Primary goals passed on both panels: double impacts per beat −0.13 / −0.16;
    v3 loss −0.011 / −0.021; strong extra impacts per beat −0.08 / −0.10.
  - Completion, timing, contested beats, bursts and air are unchanged or better.
  - **Two guards regressed on the authored panel only:** v2 strength rms
    +0.008 [0.002, 0.016] and speed rms +0.007 [0.001, 0.012]. Amplitude was
    mixed (−0.005 / +0.011). The pre-registered rule therefore strictly fails.
  - **Adopted anyway, as an explicit exception:** the owner asked directly for
    double hits to be fixed; they fall about 75%; the regressions are small.
    The cause is unexplained. The history brief
    (docs/research/producing-impact-brief-20261004.md) finds the rail push is
    the bigger push in only 15 of 111 doubles, and re-scoring the library under
    v3 costs a median of 0.00. So "rail bounces helped" is not supported; fewer
    viable catches or speed effects are untested alternatives.
  - Recovering both guards is compiler hypothesis H-1.
  - The default account and eval mode are now v3; parity gained 11 strike3 cells.
- 2026-10-04 night: **Compiler experiments under v3** (each against s3-base,
  both panels):
  - Rejected: H-1a (catch turn seeded in 2 frames: null), H-1b (impact weight
    2: strong bias +0.02 but speed rms +0.026), L6 (release reserve 3: null,
    contested +0.7 pp), L1 at weight 1 (no better than 0.3, air +0.008).
  - **Adopted, L1 (steep, ask-driven arrival prior before asks ≥ 0.6):**
    - v3 strong bias +0.020 / +0.024, very strong +0.033 / +0.024;
    - v2 strength rms −0.015 / −0.015; v3 loss −0.004 / −0.002;
    - speed rms −0.014 / −0.022;
    - contested strong beats +1.1 / +1.0 pp (the only cost; v3 strong extras
      unchanged);
    - air, bursts and frames within noise.
  - Survival envelope: the strongest single hit the rider survives is about
    0.9 on a flat floor; a 1.0 request is physically out of reach for a clean
    hit (an absolute-scale question for the owner).
  - Rejected: L1 thresholds 0.4 and 0.75 (0.6 is bracketed).
  - **Adopted, L9 (lookahead width and sample caps ×1.3 for the interval
    leading into a strong ask), against s3-l1:**
    - v3 strong bias +0.009 / +0.005; v3 loss −0.005 / −0.001;
    - contested strong beats −0.8 / −0.2 pp (earns back most of L1's cost);
    - +0.32M frames and +20 s compile per ride.
    - At ×1.6 the gain was similar for +100 s, so it was held.
  - Agent B (exp/sharp-catch, against the pre-L1 base):
    - Catches are already sharp (turn done in 2.8 frames); sharper or larger
      turns mostly crash (42–81%).
    - Energy audit: passages are not energy-bound; the real speed bill of a
      strong hit is about 5× smaller than first estimated.
    - Arrival-speed headroom 0.5 helped on that base (+0.015 strong bias).
  - Rejected on top of L1 + L9 (against s3-l9):
    - headroom 0.5: speed rms +0.010, very strong −0.037;
    - headroom 0.5 + impact weight 1.5: mixed, air +0.005.
    - L1's steep-arrival speed formula already does this bookkeeping for
      strong catches.
  - Rejected T1 (search aims at most 0.85): strong strength fell, no guard
    improved. The search is not trading guards for unreachable requests.
  - Agent A (exp/catch-pose): pose-matched catches add nothing on top of L1.
    An arrival prior on sled pitch makes things worse (contested +4 pp).
    Physics: a slam at an angle loses speed (tan(incidence/2) per unit of
    impact), which the spec's speed target charges for; sharper turns crash.
    Past L1, strength trades against speed and survival: a frontier.
  - **Confirmation on fresh seeds** (`--panel=confirm`: seeds 505–808,
    perturbations 3–4), L1 + L9 against the same code with both off:
    - v3 strong bias +0.031 / +0.023; v3 loss −0.005 / −0.007;
    - speed rms −0.025 / −0.023; contested and air neutral.
    - The gains generalize beyond the dev panel.
  - Per-gap diagnosis (s3-l9b): air and speed errors concentrate in the
    densest, most strongly asked song (amour: air rms 0.105, speed 0.135,
    against about 0.06 elsewhere) and around strong asks. Measured
    strength spans about 0.06 (gentlest touchdown) to about 0.9 (hardest
    survived hit), narrower than the authored 0–1 scale.
  - Learned models under v3 (against s3-l9b):
    - A1′, no value model: slightly worse (strong bias −0.007, air +0.005,
      speed +0.009), so kept.
    - A2′, no construction policies: much worse (completion −12.5 pp, speed
      rms +0.096), so kept.
    - Policy samples 32: null, rejected.
    - Retraining on v3 needs the archived training pipeline: a follow-up.
  - Calm impact multiplier 3 (quiet asks): quiet bias −0.024 / −0.036, but
    authored strong bias −0.013 and v3 loss +0.004. Mixed, not adopted.
  - **Blind-spot audit** (docs/research/scorecard-blind-spots-20261005.md,
    tools/measure/blind_spots.ts):
    - L1 raised head-down or backward strong arrivals from 24% to 31%
      (July 13%), invisible to the scorecard; the owner's one explicit
      negative example was such an arrival.
    - Also: more body drag than July; 6–8 pass-throughs of 3 px or more per
      ride; the motion check's 1-frame rule counts body-on-sled motion.
    - The eval gains three guard rows: strong arrivals inverted/backward,
      body drag s/min, off-beat kicks per ride.
  - **Adopted, uprightArrival 1** (the steep arrival penalizes a head-down
    or backward sled; search profile v4), against s3-l9c:
    - strong arrivals inverted/backward 29% → 15% (perturbed 31% → 15%;
      against the evening product about 22% → 15%). This is judged by the
      same geometric test as the penalty (the review's point), and the
      owner evidence is one disliked example; perceptual confirmation is
      pending;
    - body drag −0.14 s/min;
    - impact and every guard neutral; fresh-seed panel impact-neutral.
  - Rejected: uprightArrival 2 (authored inverted −4.6 pp more, air +0.004);
    calm multiplier 2.2 (quiet −0.016, very strong −0.015 / −0.023).
  - Agent C (exp/amour), why amour is hard:
    - The spec asks more: 77 of 85 beats strong, 47% of asks ≥ 0.9, 26 gaps
      under 14 frames. Consecutive strong hits about 13 frames apart sit
      near a momentum limit (the centre-of-mass part is capped near 0.34
      strength); delivered strength is about 0.6 in every song at such
      spacing.
    - Air overshoot is a construction trade (catch, ride 6–8, fly 17–19).
    - The intro speed targets cannot be reached from the authored start.
    - Not budget-bound: 1.5× allowance gave no gain, with zero interruptions.
    - Rejected: gap-length-weighted search residuals; lookahead deepened to
      40 frames.
  - **Structural: native whole-body read** (`bodyMotionAt` in
    native_motion/engine.ts, used by the v2/v3 observation). It allocates
    no point states; the arithmetic order is unchanged. Compile 75 s → 60 s
    per ride (−20%), byte-identical: parity passes on all 63 cells.
  - Robustness at half budget (1.5M), tonight's profile against the same code
    with its options off:
    - completion +6 pp authored; strong bias +0.036 / +0.030;
    - head-down strong arrivals −10 pp; contested −1 pp.
    - The hardest song (amour) loses one perturbed ride in each version at
      this budget: low-budget completion there is fragile either way.
  - Housekeeping: unused steepArrivalWeight removed (parity unchanged).
    Shared eval summaries (tools/eval/summary.ts), the night report
    (tools/report, motion-gallery/night.html) and shared clip rendering
    added.
  - Rejected: air weight 1.5 in the search (air −0.003 / −0.007 but strong
    bias −0.010 / −0.014): a dial for the owner, not a free gain.
  - **Headline, evening → tonight**, under the impact account and independent diagnostics, on
    four panels (dev and fresh seeds × authored and perturbed):
    - impact loss 0.092–0.097 → 0.033–0.038;
    - strong bias −0.28 → −0.13; very strong −0.35 → −0.17;
    - double impacts about 0.11 → under 0.01 per beat; contested −2 to −3 pp;
    - peak lag −5 to −9 ms; head-down strong arrivals about 22% → 15%;
    - speed rms unchanged: the v3 adoption's regression (0.075 → 0.094)
      is recovered by L1, which closes H-1;
    - air rms +0.004 to +0.006; +0.4M physics frames; completion 100%.
  - Rejected: upright penalty before every catch (null; very strong −0.028
    authored).
- 2026-10-05: **Code review of tonight's changes** (agent; no correctness bug in
  product code), fixes in 85b09cf3 and 6736cf38:
  - per-account search profiles: v1/v2 back to the evening profile, so
    `--mode=strike` reproduces the evening product;
  - evidence corrected: spin 8 : 3 (p ≈ 0.11), not 12 : 4; v1's 31/63 is on
    disagreement-selected pairs (head to head 22 : 7); the upright change is
    judged by its own geometric test, about 22% → 15% against the evening;
  - tool safety (clip cache key, unmatched beats, case-set checks, ties) and
    tests (v2/v3 incremental = cold; native read exact).
  - **Survival corrected.** The fine grid (`survival_envelope.ts --fine`)
    shows a near-vertical drop onto flat ground surviving strength 1.00
    (about 9 px/frame into the floor); at 45° the rider crashes above about
    0.9. "1.0 is out of physical reach" was wrong. Dense passages are capped
    by time and energy (about 0.6–0.7), not survival.
- 2026-10-05: **Pressing rail (agent, exp/pressing-rail)**, negative:
  - a roof that forces the descent breaks the sled–body binding or removes
    the hit;
  - in dense runs, descent refills each hit's speed bill almost exactly;
  - a gravity-ride continuation was null on the panel, so rejected;
  - a strong hit costs about 6 px/frame of speed per unit of strength.
- 2026-10-05: **Learned artifacts retrained under v3** (agent, exp/retrain-v3,
  merged for provenance: tools/research/*, plus a probe hook in
  arc_lookahead.ts that leaves tracks unchanged under parity).
  - Hygiene finding: both V6-era artifacts were trained partly on the four
    evaluation songs, against WORKING.md's disjointness rule.
  - Value model retrained on disjoint data: no better. Old, retrained,
    constant and none land within about 0.01, so it is not adopted.
  - **Construction policies rebuilt under v3 on disjoint songs (C), adopted
    for the v3 profile (search profile v5; v1/v2/landing keep the V6-era
    policies).** Reproduced in main, against s3-up1 / c-up1:
    - impact loss −0.008 / −0.006 (dev), −0.007 / −0.005 (fresh seeds);
    - strong bias +0.017 / +0.009, +0.014 / +0.017;
    - very strong bias +0.018 / +0.036 / +0.031 / +0.024;
    - air rms −0.005 / −0.003 / −0.007 / −0.005 (recovers tonight's air
      cost); contested −1.1 pp (dev authored); fewer physics frames.
    - Exceptions, explicit: body drag +0.4 to +0.5 s/min (about +30%) and
      quiet bias +0.010 (fresh seeds, authored).
    - The archive is 10.3 MB, beside the 8.5 MB V6-era one.
- 2026-10-05: **Construction policies, round 2** (collected with the round-1
  v3 policies searching; agent, exp/policy-round2): not adopted.
  - Impact loss −0.003 on all four panels, about half of round 1's gain.
  - Body drag +0.5 / +0.95 s/min (dev), on top of round 1's +0.4–0.5; quiet
    bias +0.019 (fresh seeds, perturbed).
  - Diminishing returns, and the body-drag trade needs the owner's ruling.
  - Round 1 retrains byte-identically from its sources
    (tools/research/construction_v3_round1_sources.json); the round-2
    archive (sha256 a19c42b3…) stays out of git.


Evidence correction (2026-10-05): earlier “double impacts” figures based on
v3-minus-v2 thresholded counts are historical proxies, not literal counts.
The corrected overnight report uses direct opposite-push boundaries and counts
adjacent pairs with both strengths ≥0.2. R1 bend-peak timing remains a separate
diagnostic. See `docs/research/overnight-20261005.md` for the remeasurement,
preserved evidence and corrected blind-study sampling.

2026-10-05: **Evidence integrity implemented** (structural; compiler output unchanged).
Evaluation now declares resolved inputs, timing, compiler and measurement identity
before any workers run. Each saved result belongs to that plan and its saved track;
reports require the complete panel. Worker failures fail the command, while an
incomplete ride remains an explicit result. Evaluation and production collections
have one writer and reject stale resumes. Measurement identity follows indirect
dependencies and both replay engine artifacts.

Compilation and historical replay share one measurement path. Direct opposite-push
observations replace the invalid difference between thresholded event counts.
The independent R1 bend diagnostic stays intact and is explicitly named. Scorecard
posture and blind selection share the same first-contact observation. Published
studies remain immutable; a new 22-pair study corrects the sampling instant.
Review renders verify their source inputs, renderer identity and movie bytes.

Remeasured all 33 historical runs with saved tracks (792 tracks), preserving their
compiler identities and outputs; the 31 table-only runs and all originals remain
archived locally. The six displayed runs retain the 67–70% impact-loss reduction.
Direct opposite-push counts are 863 → 58, or 414 → 9 when both hits reach 0.2.
The report distinguishes those observations from a universal visual definition.
Validation and artifact identities are recorded in
`docs/research/evidence-integrity-20261005.json`.

## Compiler quality campaign, October 5 evening

Owner direction: improve the actual automatic-arrangement rides while preserving
the lean foundations and trustworthy comparisons. Strong, precise musical hits,
smooth quiet passages and meaningful geometric variety must improve together.
The existing impact contract, authored requests and engine remain fixed. A high
score alone is not grounds for adopting a change.

Plan of work:

1. Reproduce the current compiler on the complete development panel; analyze
   residual errors and where search work goes, using saved tracks and telemetry.
2. Investigate how adjacent supports are searched jointly: continuation quality,
   dimensionality of refinement, and whether complete-track revision can usefully
   preserve an incumbent. State each hypothesis before its paired experiment.
3. Explore better physical proposals or search only where the measurements expose
   a limitation. Keep construction requests and variety fixed for comparisons;
   do not hide difficult requests or trade them away through authoring changes.
4. Judge candidates on all rulers and guards, including completion, strength by
   requested band, timing, extra hits, air, speed, amplitude, motion and work.
   Diagnose regressions before accepting or rejecting an idea; first attempts
   are not conclusions about a mechanism's potential.
5. Confirm useful changes on reserved seeds and perturbations, retain compact
   evidence and rejected experiments, and update the real production review with
   comparable landscape examples. Generalization to new music remains unproved
   until new music is actually tested. Visual judgments remain the owner's.

Experiments run in an isolated checkout, so the existing production dashboard and
baseline remain usable throughout. Each adopted behavior change gets tests,
updated parity references and a coherent implementation; research switches do not
accumulate in production.

21:30 UTC: Fresh baseline reproduces all 24 `s3-c` tracks and physics counts exactly. Q1 (spending unused pair-response allowance) is mixed, not promoted: authored impact loss +0.002; perturbed −0.004 but body dragging +0.56 s/min. Q2 tests better local fitting inside continuation probes at unchanged nominal allowance. Full ledger: `docs/research/quality-20261005.json`. Earlier review pages and unanswered questions remain untouched.

21:42 UTC: Q2 and Q3 remain research-only: neither provides a convincing overall improvement, and sharper catch proposals increase body dragging. Replay diagnostics cover 1,890 matched hits; response instrumentation reproduces all four original tracks and work counts exactly. Testing a coherent arrival prior and rebased response steps; collecting 336 disjoint catalog compiles to examine geometry-aware future prediction. A separate four-ride feasibility study checks whether bounded repair can make full-track refinement useful. No product change promoted; prior dashboard untouched.

22:21 UTC: No product change promoted. The full ledger now includes 13 complete paired comparisons with all rulers and per-song intervals. Preserving scattered arrival alternatives is the first promising candidate across both development subsets; reserved-seed confirmation is running. A separate 179-catch fixed-prefix study reproduced every saved impact and exposed two cases where extra scattered search discarded a verified incumbent. The retention fix reproduces both successfully. Disjoint value-model collection continues; prior review pages remain untouched.

22:41 UTC: Adopted the structural configuration cleanup: select the impact profile before loading its construction archive. V3 no longer loads and discards the V6 policies. Exact parity: 63 compiler cells and 493 judge tracks; all 274 tests, typecheck and reachability pass. The resolved options digest is identical; the cold configuration retains about 17 MB less JS heap. Track behavior is unchanged. Scattered-search and learned-value work continues separately.

22:57 UTC: Complete disjoint future-model study: 336 compiles (318 complete rides), 15 source groups, 82,903 probe rows. Better held-group prediction did not reliably improve complete tracks; keep both models experimental. Q16 scattered alternatives improves average impact loss across development and reserved confirmation, with explicit strongest-hit and individual-clip regressions. New campaign page at `generated/report/quality-20261005/` preserves all earlier reports and questions; 20 complete comparisons and eight paired clips are available. Testing ranking without local model gradients, budget scaling, and persistent physical-prefix beam search.

23:32 UTC: Persistent physical-prefix search with disjoint geometry-aware ranking improves impact loss on both development and earlier confirmation, but a new 48-case panel catches two completion failures. Bounded recovery is under test; no behavioral promotion. Confirmed three search inconsistencies: scattered incumbent eligibility, authored-span replacement windows, and duplicated whole-track objectives. Native counterfactual tests verify the defects and proposed invariants. The span correction alone has quality tradeoffs; testing coherent integration rather than equating a bug fix with better rides. Full evidence now includes 35 complete comparisons; previous dashboard and questions remain unchanged.

23:43 UTC: Recovery now completes and fulfills 48/48 recheck rides. The coherent beam retains musical gains after accounting corrections, but body-drag and specific quiet inverted contacts remain concerns. Physical clips and travel/spin decomposition show real stronger upright catches as well as counterexamples. Testing whole-incumbent suffix repair at ordinary and doubled allowance, with explicit model ablations. New whole-objective tests pass and fail on the old implementation. No behavioral promotion yet; original reports remain preserved.

00:10 UTC: Fifty complete paired comparisons now retained. Disjoint future ranking helps, but the strongest beam still raises body dragging. Preserving the existing arrival prior during future ranking reduces that tradeoff; confirmation is running. Doubling the allowance and repairing suffixes spends roughly 3.2M more frames for a small gain, so testing complete-objective joint repair and narrower beams instead. Previous reports, clips, questions and the production compiler remain intact; current research results live on the separate campaign page.

00:34 UTC: Adopted shared complete-track selection objective (Q31). The old terminal, refinement and final paths disagreed about motion/engagement terms; native tests reproduce the disagreement and enforce equality. Development and confirmation cover 48 paired rides with negligible quality changes under every ruler. All 63 parity cells were compiled: six track hashes intentionally change, including three low-budget cells; 33 saved judge tracks pass, 276 tests pass, typecheck and reachability pass. Historical metric definitions are unchanged. The stronger physical-prefix search remains isolated while its implementation and visual tradeoffs are checked.

00:59 UTC: Lean beam implementation qualifies with 63 exact compiler references, 33 judge tracks, 273 tests, typecheck and zero unreachable files; it remains a candidate while arrival and budget variants are compared. Native contact observation matches 219,681 reference-engine collisions across 24 tracks, and remeasurement preserves all 37 measures on 48 saved tracks. Testing removal of the duplicate JavaScript contact replay; no physics equation, benchmark engine or impact ruler changes. A fresh 48-case confirmation panel is predeclared, and a new disjoint 336-compile training collection is in progress. Earlier reports and unanswered questions remain untouched.

01:16 UTC: Native observation alone passes all 63 exact track/work cells and 33 judge tracks. Replacing the JS observer with native replay (Q51) is mixed and not promoted; its long-case peak memory drops only 4446→4381 MiB. Testing cached collision positions instead (Q52): reference contact positions match exactly, reads add no physics, and the separate observer/replay is deleted. Extra-budget arrival search helps authored strong impacts but worsens some perturbed motion; preserve that tradeoff. Fresh confirmation and disjoint training continue; historical review material remains untouched.

01:36 UTC: Cached-contact construction completes 48/48 development and confirmation rides. Confirmation v3 loss improves ~.006 authored/.008 perturbed, with explicit body-drag and older-ruler caveats; all63 instrument-only compiler tracks/work are exact. The long stress case remains valid, with peak RSS about 3.1 GB versus 4.4 GB for Q42, but 512 MB heaps fail and will not become a default. Allocation profiling reveals oversized vacant native version slots and retained dead branches; testing compact storage and ownership-based reclamation without physics/search changes. New Q48 clips include upright strong-hit gains, the worst strong-hit regression and a quiet passage. Old reports/questions remain unchanged.

01:54 UTC: Native branch reclamation passes all63 exact compiler tracks/work, 33 judge tracks, 275 tests, typecheck and eight Rust ownership/kernel tests. Long-case sampled peak RSS falls 3235→1459 MiB for the identical track and 5,297,435 frames. Six paired normal cases show CPU +8%, so testing dense storage to avoid per-node allocation cost. Cached-contact arrival forecast is mixed across 48 cases; model removal weakens strong impacts and increases dragging on development, with confirmation running. New disjoint collection has passed 240/336 compiles. Earlier review material remains intact.

02:10 UTC: Q52 physical review includes a stronger upright Luna catch (.664→.941 for request1), a gentler but still overshooting quiet Tiki catch (.326→.154 for request.03), and the real worst Amour regression (.827→.419). Re-observed timing is not broadly later: strong-response-window absolute error averages about11ms versus13ms, with four-song uncertainty recorded. The no-model ablation confirms weaker perturbed strong hits. Dense native storage shows no direct resource advantage over simpler boxed ownership and is rejected. Separate campaign page updated; original reports/questions untouched.

02:34 UTC: Fresh catalog replays confirm one completion regression in Q52; retaining all distinct measured alternatives at four recent boundaries, reopened eight at a time, fixes it within the same allowance. The other two suspected regressions already complete with cached contacts. All three refitted continuation models weaken strong production hits and are not adopted. Q52 completes63 compatibility cells; the lean recovery candidate passes276 tests, typecheck and reachability. Full336 paired catalog compiles with all rulers are starting, followed by the untouched48-case musical confirmation. Evidence now covers81 complete paired comparisons; previous reports and unanswered questions remain unchanged.

02:45 UTC: Q62 recovery fixes the dense catalog case while all48 development/confirmation music tracks and work counts remain exactly Q52. Frozen candidate954d0353 is running untouched48-case confirmation and the336-case paired catalog audit under every ruler. Replayed all48 development tracks to reproduce the existing body-contact guard exactly: added contact concentrates in strong passages, but Amour404 has a worse inverted quiet opening. The separate report now includes both this counterexample and an upright scattered-contact example. Testing the existing posture preference on passive catches separately; no new aesthetic metric or impact definition. Mobile review passes with37 measures, eight impact pairs and two diagnostic pairs; earlier pages/questions remain intact.

03:07 UTC: Frozen Q62 completes all48 fresh musical cases; v3 impact loss falls16.6%/26.7% against adopted Q31, with explicit extra body-contact and older-ruler tradeoffs. Strong response-window timing improves on cold replay. All63 compiler references and33 judge tracks qualify;276 tests pass. Six exact production cases use9.4% more CPU, so no speedup claim. Passive-catch posture preparation visibly repairs the quiet inverted opening and reduces authored quiet dragging on two panels, but has mixed strong-hit results; a new untouched48-case comparison and336-candidate catalog audit are running. Full paired Q62 catalog continues. Old reports, clips and questions remain untouched;90 complete comparisons are preserved on the separate campaign page.

03:54 UTC: The final untouched48-case panel confirms v3 impact-loss reductions24.5% authored/13.5% perturbed against adopted Q31. Cold replay reproduces every saved strength; strong response-window timing improves15.1→10.3ms authored and12.9→10.1ms perturbed. Quiet body-contact contributions fall, while aggregate body contact rises and some strongest perturbed hits weaken. New paired movies include real upright-catch gains, the worst upper-contact regression and a quiet improvement. Native ownership scope fixes retained-engine corruption with63 exact track/work references,33 judge tracks and278 tests. Full catalog audits continue; no final behavioral adoption yet. Old reports and unanswered questions remain untouched.

04:16 UTC: Fresh physical review now includes eight impact pairs, three body-contact counterexamples and all four full songs at fixed seed3001. Phone-sized playback and source switching pass. The worst quiet Amour upper-body slide remains visible; the Luna quiet example changes an inverted slide into an upright exit. Archive verification covers107 runs,13 datasets and6,188 files. All336 model-source records match provenance and exclude the evaluation songs. The related continuation-collector ownership failure is reproduced and fixed, with identical labels/work under retained caller engines. Catalog validation now also checks identical construction plans and exact budget accounting. Full audits and adoption remain pending; previous dashboard material is unchanged.

04:41 UTC: Final musical evidence and four full landscape pairs are preserved on the separate campaign page. Catalog audits continue (266/336 original–Q62 pairs;308/336 final-candidate records); no partial averages or adoption decision. Final packaging audit corrected the native wrapper manifest hash and added a source/WASM identity check. Earlier report and questions remain intact. Preparing an exact four-ride integration check and durable catalog/media manifests.

05:12 UTC: Both336-case catalog audits are complete and verified against their saved plans, tracks, work accounting and identical construction requests. Final candidate v3 loss falls14.6% across all cases and26.4% on317 common completions. Both versions complete318/336: one pickup case recovers, one dense terrace transition regresses after56 backtracks exhaust the allowance. All31,000 requests are accounted for; this is a bounded-search limitation, not infeasibility. Strong delivery/air/posture improve; body contact rises. All279 tests pass under normal settings; typecheck and reachability pass. Complete catalog controls and movies pass the mobile review check. Q69 now replays one costly case with synchronized compilers to separate runtime behavior from the catalog's unequal concurrent loads.

05:34 UTC: Adopted the qualified coherent search and passive-catch preference, with all63 refreshed references in the same commit. Fresh musical v3 loss improves24.5%/13.5%; catalog improves14.6% overall with unchanged318/336 completion and explicit case tradeoff. Final six-case matched timing is+6.9% CPU/-2.1% peak RSS; controlled long-case timing confirms a2.06x CPU cost. All279 tests/type/reach and33 judge checks pass. Previous review is preserved. Final main-checkout replay will bind the four full musical videos to the integrated code and all saved physical measurements.

05:41 UTC: Campaign complete. Integrated commit abdad07e reproduces all four full musical review tracks, work counts and every saved physical measurement exactly. Main typecheck/reach pass; final mobile scorecards, catalog controls and movie playback pass. Preserved107 complete evaluation runs,19 research datasets and the separate review:9,136 files/6.83GB, all bytes and source aliases verified. Large artifacts stay local; code, compact evidence and research scripts are committed/pushed. Previous report, blind study and unanswered questions remain untouched. Decision and limits: `docs/research/quality-20261005-decision.json`.
