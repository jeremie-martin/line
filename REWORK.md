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

Two problems, worked on in order:

1. **Measuring impact (now).** Does the number agree with what the owner sees
   as a big or small impact, upper hits included? Whether the compiler can
   produce a hit is irrelevant here. The owner's description:
   - impact = contact visibly changes the rider's motion: direction, speed
     (a head-on stop is a very big impact) or spin;
   - faster gives a stronger impact;
   - a clean impact is short and locatable in time; a long smooth bend is not
     the impact he values;
   - a bottom hit followed by an upper hit is two impacts.

   Candidate: the change of the rider's rigid-body motion (centre-of-mass
   velocity and spin) over a short window, with sharpness reported beside it.
   It is validated by blind pairwise comparisons chosen where the candidate
   and the current measure disagree. It is adopted only if it matches the
   owner better.
2. **Producing impact (after 1).** The compiler reaches strong hits where the
   music asks, including dense beats, for example by using control rails to
   gain speed before a hit.

### Phase 5 — Compiler quality (paused until the impact measure is validated)

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
  - Strike v1's strength matched the owner on 31 of 63 decisive pairs, which
    is chance.
  - The whole-body motion change (travel and spin) within 50 ms matched on
    46 of 63; spin mattered (12 : 4).
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
    - strong arrivals inverted/backward 29% → 15% (perturbed 31% → 15%);
    - body drag −0.14 s/min;
    - impact and every guard neutral; fresh-seed panel impact-neutral.
