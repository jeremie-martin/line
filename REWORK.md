# Foundations rework (started 2026-10-03)

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

### Phase 2 — Restructure (done; geometry registry and judge/compiler file separation remain)

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
- **Geometry-family registry**, so a new family touches one module.
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
- extensibility proven by adding a geometry family through the registry.

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
