# Compiler Improvement Campaign

Target: certified Benchmark V2 canonical headline 550. Historical detail is in
`compiler-improvement-campaign-2026-07-12-full.md`; this file stays concise and
records the active loop.

## 2026-07-12: short-contact boundary state

Baseline: `accept-2026-07-12T20-14-09Z-c8f9c284`, canonical 467.07.

- `benchmark explain` on the accepted development archive took about 3s.
- Remaining canonical invalidity is 365/6336 rows: 337 are capability rows.
- At 750k, pickup/dense cases are 46/48, 30/48, 26/48, and 43/48 valid.
- Rapid-pickup and dense-recovery group scores are only 49.08 and 33.65.
- Existing short rescue samples 80 candidates only after the short contact has
  no viable option. It cannot repair a predecessor catch whose release state
  already makes the imminent contact unreachable.

Hypothesis: the main short-gap failure is missing predecessor boundary-state
coverage, not insufficient retry count at the failing contact. Test release
timing, support extent, viability, admission, and next-contact survivors before
changing breadth or ranking.

Focused 500k study (seeds 27-29, four short cases):

- Baseline completed 3/12 rows. Compact support below 28px and one-segment
  tails reached 4/12; accounting for the contact frame reached 5/12, but moved
  failures between seeds and left shifted pickup at 0/3.
- Zero-tail and upstream-clearance variants still produced no viable recovery
  after the 160ms boundary. Length contraction alone is insufficient; none of
  these study modes is a production candidate.

## 2026-07-12: Shelter comparison audit

A reported Shelter drop from 629 to 532 was a semantic comparison failure, not
a comparable compiler regression.

- Same 500k/seed-0 run: July 6 commit `9d928e1` scored 630.7 and pre-V2
  `fab03d2` scored 527.3. The first change is exactly `0a46180`.
- That commit removed the impact feasibility cap from optimization and scoring;
  old reports used easier capped targets, while new reports use authored impact.
- Normalizing both stored tracks to the new authored target surface gives
  519.711 (old track) versus 527.306 (new track). Authored-impact mean error
  improves from 0.213 to 0.199. Current HEAD is identical to 527.3 at this row.
- The accepted support change remains valid: its paired representative stratum
  was +0.28/+0.38/+0.37 and Shelter qualification was -7.7/+1.4/-8.0 across
  250k/500k/750k, while canonical improved 450.03 to 467.07.

Workflow friction: production reports had no scoring/target identity, and
`compare_reports.ts` silently compared incompatible target surfaces. New run
reports now bind report semantics and the compiled spec; comparison fails closed
unless identities match or the operator explicitly selects
`--normalize-targets=a|b` for matching contact topology.

## 2026-07-12: retained-evidence repair

The full suite exposed that a blanket `benchmark/v2/runs/*` ignore rule had
made the accepted probe, compiler snapshot, and V2.5 calibration references
local-only. That blocked a clean clone before any certified evaluation.

- Restored the accepted 462.73 probe and exact compiler-content snapshot.
- Regenerated the three V2.5 probe controls with the accepted WASM artifact:
  identical delta 0, `LR_QUALITY_NCAND=1` delta -150.17 (`stop`), and
  `LR_IMPACT_OFF=1` delta -446.06 (`stop`).
- Replayed 99 conformance tests and six fixtures bit-identically; published
  calibration-only migration `2026-07-12T22-21-53Z-a568d7c7`.
- Recovered the exact historical pairing-study inputs under immutable names.
  Large canonical/qualification raws remain external hash-bound history;
  fresh decisions replay the retained compiler snapshot.

## 2026-07-13: detector-limited authored contacts

- A six-frame authored interval cannot produce a detector landing: only five
  airborne frames exist between its grounded endpoints, while landing requires
  more than `K=5`. The accepted compiler sampled thousands of surviving
  candidates at the boundary but admitted none because the full detector called
  the persistent contact a bounce.
- Lowering `K` from 5 to 4 was causal but globally changes event classification.
  Treating every bounce as a contact completed the short panel but coherently
  regressed ordinary controls by 8-65 points. Both broad alternatives were
  rejected.
- The narrow contract accepts a persistent bounce only when the authored
  interval is no longer than the detector's minimum landing run. It changes
  shifted pickup from 0/3 to 3/3 at 500k (scores 390-397); dense, dense240, and
  ordinary intervals retain landing-only semantics. Off-beat accounting remains
  landing-only.
- The optimizer separately used `K/gap` as its achievable-air floor even though
  the detector requires `(K+1)/gap`. Correcting that invariant raised the
  12-row short panel from 3/12 to 8/12 and improved both long-frontier controls.
  A symmetric compact-support lane was then rejected: validity stayed 8/12,
  quality fell, and survivors merely moved between seeds.
- Scoring semantics and optimizer behavior are being rolled out separately. The
  contact interpretation requires an explicit suite rollover first; the `K+1`
  optimizer floor remains the first ordinary candidate against that baseline.
  Listening approval now binds its actual subject (source and exact click hashes),
  so unchanged musical material does not require a fictional second review when
  only scorer semantics change.
- The V2.6 rollover regenerated 3,168 pooled calibration compiles (seeds 0-23)
  in about 14 minutes and 1,584 disjoint holdout compiles (seeds 36-47) in about
  seven minutes at 48 workers. Pooled budget means were 434.96/472.57/483.74;
  holdout means were 439.38/471.77/480.78.
- Fresh probe controls were baseline 462.73, quality breadth one 310.87
  (-151.86), and impact disabled 0.00 with 0/264 valid. Menu certification met
  all nine predeclared bars; the independent holdout met all seven required bars
  and all three reported power checks.
- Full baseline freeze `v2.6-detector-limited-contact-2026-07-13` took 6m40s,
  peaked at 8.07 GiB RSS, and published probe 462.73, canonical 469.54, and
  indicative qualification 373.47. This baseline contains the semantic fix but
  not the `K+1` optimizer-floor correction.
- Post-rollover stage 0 rejected the global floor correction. Combined objective
  and geometry floors gave +0.08 with four validity gains and two losses.
  Objective-only gave +3.35 and five gains/one loss, but regressed dense240 by
  31.72, sparse by 11.96, and frontier5 by 7.98; geometry-only was -0.19 with
  no validity movement. The apparent off-by-one conflated detector run length
  with the scorer's discrete air-fraction convention. No confirmation or era
  spend was used; all floor variants were reverted.

## 2026-07-13: exact-jolt short-boundary diagnosis

- The support-response study had compiled raw cases while Benchmark V2 applies
  its frozen -15ms jolt. It now defaults to the policy jolt, records overrides,
  and reproduces the canonical validity pattern on seeds 8-15.
- At the terminal dense/shifted failures, 98-100% of survival-passing candidates
  physically touched their own new line at the target frame. Almost every event
  was a bounce; qualifying landings were usually 2-19 frames late. The failure
  is insufficient pre-contact flight from the predecessor state, not spatial
  reach, target timing, or retry breadth.
- A consistent six-frame detector floor recovered 9/10 focused 500k failures,
  but stage 0 was unsafe: +3.62 headline, six validity gains/two losses, with
  dense-dialogue -91.21, 7s endurance -13.11, and sparse -7.56. Rejected.
- Relaxing the existing air-tail truncation recovered only 3/10 and moved dense
  failures earlier. A symmetric additive support-time coverage trigger recovered
  5/10 focused failures but screened -7.38 with one gain/three losses, including
  Believer -153.26 and dense-dialogue -102.55. Both were reverted.
- Workflow friction: a corrected comment in `scripts/produce/seed.ts` changed the
  suite fingerprint and invalidated an otherwise complete 264-compile screen.
  The edit was removed and the comparable screen rerun (1m08s, 6.67 GiB peak).
  Fingerprinted semantic boundaries remain intentionally strict, but study-only
  documentation should stay outside them.

Next hypothesis: preserve the accepted support family and add launch-state
coverage that jointly varies support duration and exit trajectory. Length-only
contraction is falsified; any new proposal must leave a detector-valid flight
while remaining catchable, and must be additive/inert when the normal pool
already contains such a state.

## 2026-07-13: fixed-cost compact support family

- Proactive additive coverage recovered all 10 focused failures but changed DFS
  allocation: stage 0 was +1.00 with seven validity gains/three losses, including
  dense-dialogue -107.18. Synchronous dead-end repair recovered only 4/7 focused
  rows, lost a valid dense-240 row, and cost dense-dialogue 26 points. Both were
  reverted; extra work is unsafe under the fixed-budget traversal.
- A fixed sample-slot family keeps total candidate simulations unchanged and
  preserves the solver prefix property. Only intervals where a normal landing is
  possible and authored air is below the detector floor use time-normalized
  support in the reserved slots. One/two/four slots recovered 2/5/6 of 10 focused
  failures; four began degrading the safeguard, so two slots (attempts 7 and 15)
  were selected.
- Two-slot stage 0: 462.73 -> 464.52 (+1.79), validity 243 -> 245/264
  (two gains, zero losses), 83.3% paired outputs identical. Largest regressions
  were -2.91/-2.62/-1.76; dense recovery gained +30.98. The screen projects the
  tight candidate should resolve at certified depth 48; confirmation is required.
- The first confirmation declaration failed before compilation: snapshot replay
  rsynced 6.9 GiB of untracked `shakedown/` media and exhausted disk. Attempt
  `2026-07-13T01-43-56Z-52c52c7a` was aborted honestly; its 0.0209 spend remains
  charged. Snapshot overlay now copies `git ls-files -z` only. An end-to-end
  baseline workspace build/extract/`npm ci`/dispose completed in 6.1s without
  media; this protocol-only fix requires governed compatibility migration before
  the one remaining affordable confirmation declaration.
- Runner replay then matched all 264 probe rows bit-for-bit and 99 conformance
  tests/six fixtures matched under the migrated protocol. The fresh depth-48
  confirmation took 58m16s: 468.20 -> 470.39 (+2.19), SE 1.22, 99% one-sided
  lower bound -0.69, therefore **inconclusive**. Validity gained 103 and lost 68;
  capability was +13.73, but dense-dialogue was -13.89 and 7s endurance -6.31.
  No retry or promotion: the two compact slots were reverted. The result proves
  compact timing coverage is valuable, but selection/traversal must avoid
  exchanging mature dense and long-endurance paths for capability gains.

## 2026-07-13: compact attribution and detector-flight rescue

- Exact certified-seed replay showed why fixed slots were unstable. The study
  now has a true production mode, selected sample-attempt traces, track hashes,
  and completion timing; eight baseline replays matched the canonical archive
  byte-for-byte. Fixed attempts 7/15 changed traversal even when neither was on
  the final path, so their 103 gains/68 losses were search-basin exchange rather
  than monotone candidate coverage.
- A continuous detector-constrained contraction changed all 24 short-panel
  tracks: six validity gains/five losses. Coupling support duration to a launch
  recomputed from remaining flight time improved the exchange to five/four, but
  still lost mature dense-240 and shifted rows. Both were reverted.
- An exact reactive gate generated coupled candidates only when every admitted
  normal option had no one-step continuation. On four canonical frontier/dense
  safeguards it gained one 502-point completion with no losses and left 6/8
  tracks identical. The independent 24-row short panel falsified it: one gain,
  two losses, score-sum -344.97; rescue work also changed rows where no rescue
  survived on the final path. Endurance/reentry gates removed both collateral
  and the gain, proving the apparent frontier win was not duration-causal.
- Successful 500k dense controls first completed at 295k, 448k, and 502k;
  shifted controls at 400k and 439k. A no-completion scheduler therefore cannot
  identify failures early enough to reserve a useful fallback slice without
  starving late legitimate completions. All rescue/compiler candidates were
  removed; no Stage-0 screen or era spend was used.
- A stable deepest-prefix frontier pop was byte-identical to DFS on eight
  canonical safeguards and three 500k short rows. The stack already preserves
  that invariant; old frontier nodes are retained alternatives, not traversal
  priority. The no-op was reverted without screening.
- A new exact predecessor oracle resumed the real compiler from the deepest
  failing prefix. Of ten 500k failures, five had no bridge in 32 predecessor
  candidates; widening to 128 found bridges in only two of six zero-coverage
  rows and none of three shifted-pickup rows. The other five already had local
  bridges, so remaining failure is a mix of geometry coverage and search
  economy rather than one missing rank term.
- Dense-240 seed 12 reached its decisive parent only at frame 435,528/500k.
  Ranks 2/3 had exact one-step continuations and were explored immediately;
  an equal 500k suffix replay made rank 1 valid at 367.97 while rank 0 stayed
  one contact short. Forward work was 80,963 frames and 1,542/1,811 rollouts
  found no candidate. Completion is possible but often reached too late.
- Global forward breadth (`best:1:2` and `best:1:4`) made all eight safeguards
  invalid; depth is load-bearing. Global Q24 exchanged four gains for seven
  losses on the 500k short panel. A small 250k Q28/Q30 family selected Q30 on
  safeguards, then formal Stage 0 rejected its smooth source form: 462.73 ->
  457.36 (-5.37), two validity gains/one loss, dense-dialogue -105.93. Reverted;
  no confirmation or era spend.
- Detector-limited pickup failures were not a sampler-breadth problem: a
  1024-candidate predecessor sweep still found no ordinary two-contact bridge
  on the decisive shifted row. Exact catch-manifold studies instead isolated
  entry angle as the useful state coordinate. A shallow-entry short-offset
  catch and steep-entry long-offset catch were each locally viable, but the
  discrete two-template form displaced two good 500k paths (-3.52/-25.22).
- The retained source candidate replaces those alternatives with one continuous
  state-relative control: entry angle smoothly changes approach by 3 -> 0 deg
  and tangent lead by 1.4 -> 2.1 speed-frames. It is offered only for contact
  intervals one to three frames above the detector landing floor and only when
  the incumbent pool exposes no measured release runway. Exact production
  evaluation and the existing quality rank remain the judges.
- Formal Stage 0 (`stage0-contact-phase-continuous-slack3-a01`, 1m09s,
  6.92 GiB peak):
  462.73 -> 468.78 (+6.05), validity 243/264 -> 248/264 (five gains, zero
  losses), 97.0% paired scores identical. Twelve hashes moved; eight scores
  improved and none regressed. On independent shifted-pickup
  seeds 8..15 at 500k, seeds 10/13 converted, no validity was lost, incumbent
  deltas ranged -1.76..+1.39, and seed 9 remained unresolved.
- The third runway-slack frame extends the same formulation from 7/8-frame
  pickup pairs to the adjacent 9-frame dense figure. It leaves all 250k/500k
  validity unchanged, advances the two failing 500k dense rows much deeper,
  and changes the one valid dense-240 row by +0.04. At 750k, dense seeds 28/29
  convert from invalid to 370.42/379.81; with the extension disabled, both
  remain invalid. This is promising canonical-budget evidence, not a probe
  headline claim.
- Extending the same compact control through six slack frames (10--12-frame
  cadence) was rejected on the focused panel: no validity gain, while the two
  valid dense-240 500k rows fell 373.36 -> 335.53 and 364.17 -> 320.40. The
  detector-boundary control remains capped at three slack frames; ordinary
  dense cadence needs a different mechanism.
- Workflow friction: adding the non-scoring telemetry type to shared
  `scripts/v0/types.ts` correctly changed the suite fingerprint and invalidated
  the first 264-compile comparison after it finished. The runtime diagnostic
  was retained but its type moved outside the suite-bound file; `status` then
  reported the Stage-0 reference comparable and the rerun used suite `d01c8a`.
  Confirmation was not launched: depth 48 is heuristically under-powered for
  this concentrated +6.05 effect (estimated depth 57), and the era is already
  0.0418/0.05, so a certified attempt requires an explicit budget override.

## 2026-07-13: forward saturation and kinematic support

- Dense-240 seed 29 exposed a ranker saturation rather than missing breadth:
  the selected predecessor had no continuation while an adjacent pool member
  had ten, but their charged two-step scores differed by only 0.28%. Wider
  forward rollouts spent 106k--343k frames and moved the frontier backward.
  Falling back to local quality when all forward values were near zero fixed
  the focused seed but failed Stage 0: 462.73 -> 461.19, 14 validity gains/two
  losses, with 39--47 point representative-group regressions. Reverted.
- The 7s endurance failure was geometric. At its deepest parent, ordinary arcs
  released 65--272 frames early or arrived near 80 degrees. A 5,760-cell exact
  surface found a continuous solution around 248--260 riding frames and a
  near-horizontal exit. The derived model reserves the authored/detector-valid
  flight, integrates entry/target speed over the remaining grounded frames,
  and derives support slope from required tangential acceleration.
- Naively admitting that family rescued the failing row but hid 8--20 point
  losses behind its large zero-to-valid gain. Exact continuation gating still
  let viable but mediocre side branches consume the budget. The retained gate
  is additive only at the current deepest frontier, before any completion, and
  only when the already-charged forward rollouts show every ordinary pool option
  has no continuation. The proposal must restore a continuation in its own
  normal forward rollout and occupies the last of three local branches.
- Final Stage 0 (`stage0-contact-phase-kinematic-support-a05`, 1m09s,
  7.02 GiB peak): baseline 462.73 -> 470.89 (+8.16), validity 243 -> 249/264
  (six gains, zero losses). Incremental to contact-phase-only: +2.11 headline;
  only three rows changed, all in low-air endurance: -0.64, +3.43, and the
  failing 7s row 0 -> 481.58. All other 261 rows and all 41 non-endurance
  sources were bit-identical. No confirmation was launched because the era has
  only 0.0082 risk budget remaining versus 0.0209 required.
- Workflow feedback: the first aggregate-positive support screen concealed
  concentrated regressions, so every capability rescue needs an incremental
  row audit against the preceding candidate, not only the frozen baseline.
  A fallback-order edit initially matched the wrong of two identical sorter
  blocks; identical A02/A03 archives exposed it before commit. Reusing existing
  forward evidence then removed duplicate admission probes and simplified the
  final design.

## 2026-07-13: online traversal pace and continuation control

- The remaining dense failures were not missing local geometry. On dense seed
  29, the eventual path entered both three-contact figures with a complete
  three-contact continuation already available at rank 0. The first path into
  each figure instead had no immediate continuation and left the rider nearly
  horizontal/downward. Finding the better predecessor basin cost 104k and 141k
  simulated frames.
- A global three-contact rollout did not address that scheduling failure: its
  first divergence was at gap 3, it converted two focused failures, and it
  regressed every valid control by 18--25 points. Global removal of proven
  dead-end candidates converted the failures but regressed dense seed 27 by
  about 32 points. A reserved third branch was worse and made a valid row fail.
  All three broad policies were removed.
- The retained controller measures traversal pace online for each seed and
  budget. It anchors at the first processed contact, subtracts that measured
  startup cost, and compares remaining-budget spend with completed-contact
  progress. It does not use the static difficulty model, spec identity, cadence
  class, or a raw budget threshold.
- Ordinary backtracking remains untouched until the traversal falls more than
  the existing eight-contact tail-completion horizon behind pace. Then, only
  before first completion and within the existing three-gap active-frontier
  band, candidates already proven to have no next-contact continuation are
  dominated when at least one proven continuation exists. Unknown and
  universally dead-ended pools are preserved. `LR_ONLINE_CONTINUATION=0` is the
  exact diagnostic escape hatch.
- The hysteresis was measured rather than guessed. Successful pickup controls
  reached maximum precompletion lags of 2.49 and 6.56 contacts; failing dense
  rows reached 46.59--50.87. Six contacts still changed a successful pickup
  basin; eight preserved it. The predecessor study now reports the exact first
  visit, selected source, every precompletion lag visit, independent search
  seeds, compile landing probes, and two-step knob/continuation coverage.
- Final Stage 0 (`stage0-online-continuation-a03`, 1m13s, 7.31 GiB peak): frozen
  baseline 462.73 -> 475.47 (+12.75), validity 243 -> 251/264 (eight gains, zero
  losses), and 94.7% pairing. Incremental to the retained kinematic-support
  candidate: 470.89 -> 475.47 (+4.58), two validity gains/zero losses. Only
  10/264 rows changed; the two gains were dense/dense-240 500k rows, another
  valid dense-240 row gained +12.08, and seven still-invalid rows mostly moved
  deeper. No representative, regression, music, or endurance score regressed.
- The shared traversal model remains a follow-up, not evidence for this change.
  It is sourced from an old V1 250k archive and underpredicts current V2 median
  first completion by about 40%; completed dense rows cost 2.22--2.82 times its
  prediction. Recharacterization must account for short-figure structure and
  censored failures before any policy relies on it.
- Workflow friction: adding diagnostic fields to shared `types.ts` changed the
  suite fingerprint and correctly blocked comparison after a complete run. The
  temporary schema edit was removed; the final screen restored suite
  `d01c8a064a201b08`. Compiler-only observability stays in study tooling unless
  a governed suite change is intended. Confirmation remains blocked by the era
  risk budget (0.0082 available versus 0.0209 required).
- A focused frontier-radius family did not justify a broader policy. Expanding
  the active band from three gaps to eight moved dense seed 29 at 500k from gap
  75 to 85, but it still failed; 16, 32, and an effectively unbounded radius
  produced the same gap-85 result. The experimental override was removed, so
  the retained controller keeps the existing three-gap frontier invariant.
- Post-selection held-out validation on `shelter_impact_sync` at 500k/seed 0
  produced byte-identical 508-line tracks with the controller enabled and
  disabled. Both runs hit 113/113 contacts, survived the full 81.5 seconds, and
  scored 527.3; the reports differed only in `generatedAt`. This result was not
  used to tune the policy, but it supports the intended ordinary-track
  invariance outside the development catalog.
- Tooling follow-up: the repository has no trustworthy `typecheck` command.
  Plain `tsc --noEmit` rejects the project's `.ts` import convention; enabling
  that convention reaches numerous unrelated existing errors. Vitest is the
  current executable validation gate, but the workflow should eventually define
  a scoped TypeScript check (or explicitly document why runtime tests are the
  only supported gate) so contributors do not mistake configuration noise for
  a result of their candidate.

## 2026-07-13: exact local continuation transforms rejected

- The retained Stage-0 archive has 13 invalid rows: ten capability rows at
  250k, two capability rows at 500k, and one fully traversed music row with a
  scoring miss. No representative or regression row is invalid. The 250k panel
  is mixed: some prefixes have no next-catch geometry at their terminal state,
  while others expose many bridges but exhaust the budget before the end.
- A direct exact study showed that the compiler's existing arc controls can
  create real local continuations: a small pitch/whole-arc-rotation grid found
  continuations at the dense 250k failures, and contact-support edits did too.
  The shifted 160--180ms pickup failure had no continuation under either
  transform or a 729-point state-relative catch manifold, so it is not the
  same mechanism.
- A deliberately narrow production prototype admitted those transformed arcs
  only when the normal pool had already proved every next contact dead, live
  progress was behind schedule, and the node was in the active frontier. Each
  transformed arc still had to pass exact current-contact evaluation and prove
  exact next-contact continuation. It improved dense 250k progress from
  53 -> 82/88 contacts and shifted-pickup 500k from 90 -> 95, but changed an
  already-valid dense 500k seed from 391.29 to invalid (deepest gap 123 -> 70).
  Rejected and removed.
- This falsifies immediate next-contact continuation as a sufficient dominance
  signal for introducing a new branch. The next mechanism must either preserve
  the incumbent branch allocation or establish a longer-horizon advantage; it
  must not promote a local continuation merely because the existing short
  rollout reports no continuation.

## 2026-07-13: nominal frame-budget audit deferred to a protocol migration

- The public optimizer contract says a scalar compile is bounded by its
  simulated-frame budget. An audit of the retained Stage-0 reference found
  that the current traversal checks its budget only between whole node
  expansions: all 264 probe rows exceeded their nominal budget, by as much as
  135,433 frames at 250k and 40,940 at 500k. Forward-evaluation settings can
  therefore receive materially different unreported compute allowances.
- A detector-level hard limit was prototyped and tested. It stopped atomic
  simulations before their next charge would exceed the cap, produced no
  overshoot, and completed the full Stage-0 panel. Its headline was 464.27
  instead of 475.47 under the current soft-budget reference (250k: -25.48;
  500k: -5.49). This is expected: the candidate and its reference no longer
  receive the same effective compute. It is neither evidence for nor against
  a compiler search policy.
- The implementation was removed rather than silently treating that
  incomparable result as a rejection. A genuine hard-budget change requires a
  governed protocol migration, a fresh baseline/recharacterization, and ideally
  budget-aware atomic evaluation so the final remaining frames are not simply
  stranded. Until then, comparisons retain the frozen soft-budget semantics;
  any forward-evaluation experiment must report actual `sim_frames`, not only
  its requested budget.

## 2026-07-13: online-controller hysteresis family

- The online continuation controller has one causal scheduling parameter: the
  number of contacts a traversal must fall behind its measured pace before
  candidates with a proven failed continuation are dominated. Its former reuse
  of the tail-quality constant was extracted into an explicit source default,
  leaving the eight-contact behavior unchanged.
- Family `online-hysteresis-a01` compared source-baked delays 7, 8, and 9 on
  one fresh six-seed-per-budget epoch (2,112 compiles, about 11 minutes at 48
  jobs). Relative to that epoch's frozen baseline, delay 8 was +11.52 headline
  with 10 validity gains/zero losses; delay 9 was +11.47 with 9/0; delay 7 was
  +10.89 with 12 gains/one loss. The delay-8 vs delay-9 contrast was -0.05,
  90% interval [-0.20, +0.10], and 99.62% of paired outputs were identical.
- The observed leader reversed trivially between the four- and six-seed report
  prefixes (-0.003 at the former). That is why family selection is descriptive
  rather than a promotion claim. Eight retains both the observed champion and
  the independent earlier Stage-0 result; nine has no credible advantage, while
  seven supplies direct evidence against earlier activation. The family selected
  the exact eight-contact source snapshot. No qualification, confirmation, or
  era risk was used.
- Workflow friction fixed during the run: snapshot overlays used the Git index
  path list verbatim, so an intentionally deleted tracked scheduler lock made
  `rsync` fail before any arm started. Overlays now omit absent dirty-worktree
  paths, preserving the committed file already in the detached worktree. A
  second guard wrongly treated a protocol-only snapshot copier repair as a
  reason to strand an exploration family. Families now require current
  inference/calibration semantics but may finish frozen exploratory comparisons
  across protocol-only changes; the promotion eval path remains strict.

## 2026-07-13: impact-pool attribution

- The retained probe's lowest fully valid rows are impact-limited: the two
  56-second music cases have impact RMS about 0.41--0.45 despite complete,
  beat-accurate tracks. A four-source, three-seed, 500k observation-only funnel
  found 506/1,041 impact-targeted contact gaps with a materially closer admitted
  candidate than the selected path. Selected impact is systematically low, not
  high, relative to authored target.
- This is not evidence to add a broad impact scorer. The readiness-pareto study
  over 4,131 exact pools found that the globally closest impact candidate is in
  the eight-member handoff pool only 245/1,067 times on `believer_56_6s`,
  158/875 on its impact-relief neighbor, 271/897 on `believer_impact_56s`, and
  418/1,292 on `dense_dialogue`. Among candidates constrained to lose at most
  0.05 next-contact readiness, zero materially better impact candidates were
  already in that pool.
- This reproduces the useful part of the historical broad-impact failures with
  current V2 evidence: the problem is coupled predecessor/arrival geometry, not
  an omitted local rank penalty. A new candidate must construct and evaluate a
  paired predecessor-plus-impact arrival with a genuine downstream continuation;
  merely retaining or re-ranking a current-gap impact specialist is expected to
  spend the fixed search budget on a worse future state. No source policy was
  changed from this study.

## 2026-07-13: impact pair-oracle boundary

- A 12-row, four-source, three-seed 500k post-compile parent-pitch oracle was
  intentionally negative: only two rows improved at floating-point scale; the
  largest lift was 0.083. Arbitrary rotation of an already built predecessor is
  therefore not a causal impact control and was not made into a compiler knob.
- The new V2-native pair oracle avoids the retired feasibility cap and applies
  the frozen V2 jolt. It captures an accepted full prefix, enumerates current
  predecessor/arrival pairs, and validates an exact suffix. Its self-check
  rebuilds the original prefix/tail before evaluating a pair, so target or
  replay drift fails visible rather than becoming a false negative.
- With the incumbent tail held fixed, none of 59 high-objective/high-impact
  candidate pairs on the `believer_impact_56s` smoke row could rebuild that
  tail. This rules out a local pair rerank as a sufficient mechanism: changing
  the boundary state generally requires a newly searched continuation.
- A bounded 100k suffix-search panel (four sources, three seeds, 500k prefix,
  up to 16 by 16 candidate pairs and four finalists per ordering) found 2,165
  locally evaluated pairs. Forty-six pair suffixes were searched; 19 completed
  the full contract and exactly one improved, `believer_56_6s_impact_relief`
  seed 1 by +2.04. Its selected pair still had 0.852 local impact error, and
  the other 11 rows did not improve. This is insufficiently broad and not
  impact-causal evidence for an admission, ranking, or geometry policy.
- Workflow feedback: a single long-lived Node study accumulated about 1.9 GiB
  RSS across the 12-row run even though it completed in about 90 seconds. The
  next wide exact study should isolate rows in child processes or expose an
  explicit maximum-RSS/row checkpoint, rather than assume a serial diagnostic
  has constant memory. Generated study evidence remains observation-only.

Next impact step: derive a continuous paired geometry family from a measurable
boundary-state coordinate and test it first on a small, predeclared panel. Do
not broaden impact ranking, promote the isolated +2.04 row, or spend the nearly
exhausted confirmation era without cross-source evidence.

## 2026-07-13: dense allocation and shifted-pickup release boundary

- A controlled 500k breadth response rejects raw candidate-count expansion as
  a dense-recovery mechanism. On the three dense seeds, 36 candidates rescued
  seed 29 but invalidated seeds 27 and 28; 40 candidates completed seeds 27
  and 29 but invalidated seed 28. More sampling changes deterministic frontier
  allocation rather than exposing a uniformly absent geometric family. No
  breadth constant was changed.
- The remaining shifted-pickup 500k failure is physically localized. At its
  160ms pickup boundary, all 32 regenerated predecessor candidates passed the
  current contact but each left zero next-contact candidates. The selected
  path had only two airborne frames before the next target; detector-valid
  landing needs six. The exact post-contact tail shortening and whole-arc
  rotation grids either invalidated the current contact or retained the same
  two-frame state, and 56 two-step knob trials produced no continuation.
- This is not evidence for a terminal rescue lane. Pure time-normalized support
  geometry completed the formerly failing shifted-pickup seed 27, but made
  seed 28 fail (2/3 valid both before and after, with the survivor exchanged).
  At the terminal boundary, neither `time` nor `time-extend` produced a next
  continuation even with 64 regenerated candidates. A global support-mode
  switch and a local tail transform are both rejected.
- Next geometry work: measure an earlier release boundary where a candidate
  can still alter the incoming state, then test a fixed-cost, state-conditioned
  *continuous* support coordinate against the incumbent under equal suffix
  budget. It must be keyed to measurable time-to-contact and detector runway,
  not phase, case identity, or a hard-coded pickup duration; no production
  implementation follows from the current evidence yet.

## 2026-07-13: mature forward-evaluation horizon

- The shifted pickup failure supplied a falsifiable ranker diagnosis. At gap
  74 on the failing 500k seed, the incumbent rank-0 branch and ranks 0--1 all
  reached the same later gap-90 dead end under an equal 330k suffix. Already
  admitted rank 2 had better measured next-contact readiness (0.191 vs 0.172),
  17 continuations (vs 14), and completed the full contract with that same
  suffix budget. The old charged greedy depth-2 value ordered it just behind
  the incumbent.
- A global `greedy:3` evaluator completed all shifted-pickup 500k seeds, but
  a full Stage-0 screen showed that it harms the 250k operating point: 475.47
  -> 470.58 overall, with the 500k portion improved and the 250k portion
  substantially worse. This rejects an unconditional horizon increase.
- A budget-aware global depth-3 prototype was then screened at 475.47 ->
  481.27 (+5.79), keeping all 250k rows bit-identical and reproducing the 500k
  pickup rescue. Depth 4 was worse in the full screen (463.30 overall), so no
  wider depth family was justified.
- Fresh shared-seed family evidence rejects the global depth-3 policy despite
  its headline: it was the stable observed leader over depth 4 (+11.32 on the
  fresh epoch; depth 4 was -10.14 relative to it), but it regressed the
  representative (-7.60), legacy-regression (-8.94), and development-music
  (-63.12) strata while gaining capability (+137.90). It is deliberately not
  selected or promoted. This is a useful failure: a mature-budget gate alone
  is too broad.
- Next hypothesis: use longer charged lookahead only as a fixed-cost tie-break
  among existing, near-equal greedy depth-2 candidates. The causal pickup
  boundary had a 0.4% normalized depth-2 score spread, and the rank-2 candidate
  outside the ordinary three branches completed an equal-budget suffix. The
  tie-break must preserve the current specialized adaptive evaluators and be
  inactive outside a measured score-ambiguity band; it introduces neither a
  spec/cadence classifier nor a new candidate class.
- Two such tiebreak prototypes were tested and removed. Re-scoring up to five
  0.5%-band finalists at mature budget improved Stage 0 to 484.59 and rescued
  the shifted pickup, but invalidated a previously valid dense seed. Restricting
  the work to ambiguities crossing the three-branch cutoff retained the pickup
  rescue but instead invalidated dense-240 (482.24). The score band by itself
  is therefore not predictive enough of a robust longer-horizon win.
- Next observation must measure the joint state of score ambiguity, continuation
  coverage, terminal/runway margin, and subsequent equal-budget suffix outcome
  across a predeclared mixed panel. Do not reinstate global depth-3 or either
  tiebreak based on their aggregate headline gains.

## 2026-07-13: forward ambiguity boundary and support-manifold oracle

- The predeclared mixed panel measured the shifted-pickup rescue boundary
  (seed 27, gap 75), the dense control that the broad tiebreak broke (seed 27,
  gap 85), the shifted dense-240 control (seed 28, gap 74), and an ordinary
  representative control (`countercurrent`, seed 24, gap 45). The observation
  tool now matches the selected candidate directly against the pool captured at
  that prefix; reconstructing the normal pool was not a reliable identity
  witness for a path that may have passed through another search lane.
- Score ambiguity, one-step continuation count, and detector runway are not a
  sufficient policy. The pickup rescue had six of eight candidates within
  0.5% of the local score, and rank 2 completed an equal 330k suffix where the
  selected branch stalled. But the valid dense control also had five of eight
  candidates within that band; its selected rank-6 branch had 38 immediate
  continuations and only seven airborne frames. The representative control had
  three near-tied candidates and every tested suffix completed. The old score
  band cannot be repaired simply by adding these two local features.
- The existing kinematic-support lane was inactive at all four boundaries.
  Its strict guard requires *zero* one-step forward continuation, whereas the
  pickup branch still has 14. Widening that guard would be a policy change, not
  evidence that its current three-candidate parameterization is correct.
- An exact, observation-only contact-support manifold then replaced the
  terminal support segment of four existing candidates. On shifted pickup seed
  27, it increased the best immediate continuation count from 14 to 35 and the
  detector runway from 15 to 20 frames. It could not increase dense seed 27
  beyond its incumbent 38 continuations, dense-240 seed 28 beyond 38, or the
  representative control beyond 45. This is a useful continuous geometry
  signal rather than a case identifier.
- The coverage-max oracle is nevertheless rejected as a selector: it completed
  pickup seeds 27 and 29 but made already-valid seed 28 stall at the same later
  gap. The least-cost manifold candidate that *strictly improves* immediate
  coverage completed all three equal 330k shifted-pickup suffixes (scores
  405.38, 380.36, and 388.86 for seeds 27--29). This is evidence for a bounded
  state-conditioned support family, not for a 2,940-point exhaustive grid or a
  raw coverage-max rank rule.

Next step: express the successful support duration and exit direction as a
small continuous function of gap timing, target velocity, and the incumbent
support geometry; compare that formula with the existing kinematic plan on the
same panel before adding any source candidate. It must remain inactive when it
does not strictly improve exact continuation coverage.

## 2026-07-13: normalized support source prototype rejected

- The existing physical plan is well-scaled but deliberately inactive at the
  pickup boundary: its 24-frame next gap asks for 18 grounded frames and a
  207px support, while its long-support extension pressure is zero. A compact
  diagnostic mesh using 0.65/0.85/1.05 of that support length and -4/0/+8
  degrees relative to the inherited segment completed all three pickup suffix
  checks. It did not improve exact continuation coverage on the dense or
  representative controls.
- That is still insufficient to choose a source policy. An environment-gated
  prototype activated the mesh at detector-floor flights on the live frontier,
  retained the existing air-coverage gate for ordinary support candidates, and
  let normalized candidates compete without reserving a branch. It was active
  (61--74 pools and 513--645 exact fits across the three pickup runs) but did
  not complete seed 27, only moving its dead end from gap 90 to 98. It also
  regressed valid seed 28 from 383.63 to 366.74 and seed 29 from 385.91 to
  383.24.
- The prototype was removed before Stage 0. The causal gap is now clear: the
  oracle's "least-cost candidate with strictly higher *exact* next-pool
  coverage" is a useful retrospective selector, but detector-floor activation
  plus the existing forward score cannot reproduce that selection. Do not add a
  broad detector-floor support lane or reserve a support branch based on these
  data.

Next geometry work must either find a cheap, pre-commit continuation value that
predicts the exact coverage ordering across the control panel, or change the
frontier allocation so it can evaluate a small support family under a bounded
shared suffix budget. Neither is justified by an airtime-only trigger.

## 2026-07-13: bounded continuation-capacity replication

- Reducing the exact continuation check from 32 to 16 candidates retained the
  least-cost strictly-improving normalized support choice on all three
  shifted-pickup seeds. Their equal 330k suffixes all completed (397.60,
  380.36, and 393.50). The same rule emitted no candidate on dense, dense-240,
  or representative controls because their incumbent capacities were already
  at or above the requested 16-candidate capacity.
- This is evidence for a bounded continuation-capacity *experiment*, not a
  source change yet. The compiler does not currently expose the scored
  incumbent's exact capacity at a prefix, and the rejected detector-floor
  policy proves that substituting a cheaper proxy is unsafe. Any implementation
  must charge this continuation work, preserve the 250k operating point, and
  compare only a fixed small support family against the actual scored
  incumbent.

## 2026-07-13: charged continuation-capacity source prototype rejected

- A mature-budget-only experimental lane measured the score-leading
  incumbent's 16-sample continuation capacity, generated the compact
  normalized support family, and admitted only the least-cost candidate with a
  strictly higher measured capacity. The work was charged by the normal engine
  counter and never ran at 250k.
- It rescued shifted-pickup seed 27 (399.46) and preserved seed 29 (405.17),
  but invalidated already-valid shifted-pickup seed 28 and both dense controls.
  It also activated far more often than the local panel suggested: 55--80
  support pools and 492--684 exact support fits per 500k compile. The actual
  scored incumbent at live prefixes is not equivalent to the fixed observation
  boundary, so the local capacity test cannot simply be applied everywhere.
- The environment-gated source code was removed before Stage 0. This rejects
  both the detector-floor proxy and the direct capacity gate as broad policies;
  do not reintroduce either from the isolated pickup wins.

Next step: characterize *where* the capacity gate changes a valid control path
(first activation gap, incumbent/source, capacity delta, and later suffix
outcome) before considering a narrower allocation mechanism. The evidence now
supports instrumentation of activation provenance, not another rank policy.

## 2026-07-13: continuation-capacity provenance rejects activation itself

- A diagnostic-only hook measured the actual score-leading candidate's charged
  16-sample capacity at every mature-budget prefix, without changing candidate
  selection. The pickup failure had 103 deficient observations in 156, but the
  valid dense and dense-240 controls had 169/256 and 146/205 respectively; the
  valid representative control still had 35/195. Zero-capacity rows occur on
  successful paths in every control.
- Therefore capacity is a search-local property, not a causal sign that the
  prefix should be redirected. This directly explains why the capacity source
  prototype harmed controls: its activation premise was satisfied throughout
  ordinary backtracking. The diagnostic is retained behind an explicit study
  hook; production never installs it.

Next step: abandon continuation capacity as a rank or activation feature. Return
to the remaining independent weakness, coupled impact arrival geometry, where
the prior pair oracle established that a predecessor change requires a newly
searched continuation rather than a local rerank.

## 2026-07-13: impact attribution and wide-pair replication

- A fresh observation-only funnel at 500k on the four development music cases
  (seed 0, 19.1s, 508 MiB RSS) classified 347 impact-targeted contacts: 134
  (39%) did not generate the needed turn, 32 (9%) generated it but lost it at
  a survival/admission gate, 168 (48%) retained a deep candidate that was not
  scored by the handoff pool, and 13 (4%) selected a sufficient turn. The
  closest admitted candidate reduced mean absolute impact error from 0.29 to
  0.04; this is real local coverage, but not evidence that its boundary state
  supports the rest of the track.
- To test that distinction directly, the V2 pair oracle widened only the
  predecessor/arrival sample set (up to 64 predecessor and 32 child samples),
  kept its existing objective/impact finalist rules, and ran unchanged 100k
  suffix searches. `believer_56_6s` seed 0 had no valid improvement (308
  pairs, 2/14 valid suffixes); `believer_impact_56s` seed 0 had 2,568 pairs
  and 16/16 valid suffixes but no improvement. `dense_dialogue` seed 0 was
  excluded by the oracle's intentional exact-tail replay invariant: the
  incumbent itself could not replay, so no pair result would be interpretable.
- One row, `believer_56_6s_impact_relief` seed 0, rose +11.96, but its selected
  pair still had local impact error 0.844. Independent seeds 1 and 2 then had
  zero lift (5/19 valid suffixes total). This is an alternate search basin, not
  a reproducible impact or geometry effect; no candidate lane, rank rule, or
  generator constant was changed.

Next step: return to the remaining incomplete capability frontier. The current
headline is still dominated by dense/pickup validity at 250k and 500k; any
next mechanism must use a causal path property more specific than local
continuation capacity, and must retain ordinary-path controls before a family
run.

## 2026-07-13: measured-pace capacity is still non-specific

- The capacity study now also evaluates each exact probe at the production
  online controller's measured-pace predicate. This is observation-only and
  mirrors the controller from the recorded first-progress frame, contact count,
  budget, and prefix gap; it does not infer pace from a static difficulty model.
- On the four predeclared 500k rows (24.4s total), the ordinary representative
  control had zero behind-schedule observations, while the failing shifted
  pickup had 13 deficient observations among 14 behind-schedule probes. That
  initially looks promising, but the two *valid* dense controls also had 13/17
  and 93/120 behind-schedule deficient observations. Their first qualifying
  deficits occur around frame 242k, long before their successful late
  completions. Pace filtering would reduce ordinary activation but cannot make
  capacity a causal allocation signal.
- Therefore the proposed combination of online lag plus capacity is rejected
  before source work. The existing online controller remains limited to its
  proven dominance fact (a scored candidate has an explicitly failed immediate
  continuation while another has one); it must not be extended to install
  normalized support candidates merely because capacity is low.

Next step: characterize the value of *frontier alternatives* rather than their
local sample capacity. A candidate mechanism needs evidence that a bounded
alternative changes the achievable suffix outcome under the same allocation,
not just that it exposes more immediate descendants.

## 2026-07-13: frontier-alternative ordering and width-four rejection

- Equal-suffix replay made the alternative result concrete. At shifted-pickup
  seed 27's parent gap 74, the ordinary three-wide frontier admitted raw pool
  ranks 0, 1, and 3. Raw rank 2 was the first excluded child: under the same
  330k suffix it completed at 401.40, while ranks 0--1 reached the gap-90
  dead-end. A streaming, observation-only frontier hook confirmed this was an
  early branch-allocation loss, not a sibling that ordinary DFS later left
  waiting. The parent was still ahead of the measured pace, so a late
  behind-schedule pulse cannot recover it.
- The same exact alternative oracle found outcome-positive routes on a valid
  dense control. Therefore "an excluded viable alternative exists" is not a
  source selector; it says only that the local depth-two ranker has finite
  horizon.
- A predeclared 500k seed-27 panel tested the smallest broad allocation
  change, globally raising handoff branching 3 -> 4. It completed the shifted
  pickup (0 -> 395.22), but made dense-240 invalid (373.36 -> 0), reduced
  dense recovery by 26.29, and reduced ordinary pickup by 7.84. The long
  endurance and representative controls were unchanged or nearly unchanged.
  Eight direct compiles took 35.3s wall-clock at about 0.28 GiB RSS; artifacts
  are `generated/studies/branch{3,4}-local-panel-500k-s27-a01.json`.
- Reverted the width immediately. This rejects unconditional extra frontier
  breadth, just as prior mature depth-three and ambiguity-only tie-breaks were
  rejected. The retained frontier probe is diagnostic-only and has no effect
  unless a study installs it.

Next step: do not add another ambiguity, capacity, or cadence threshold.
Characterize a bounded *shared-allocation* alternative evaluator: it must
compare a small fixed number of alternatives using the same pre-completion
allocation, then demonstrate that its allocation differs from both global
width-four and the rejected longer-horizon re-ranker on the mixed panel before
any source candidate is proposed.

## 2026-07-13: pre-completion repair affordability, not yet a policy

- A four-way equal-slice replay is feasible on the pickup fork. Four 82.5k
  suffix slices (the 330k suffix budget split evenly) completed raw ranks 2
  and 3, while ranks 0--1 stalled at gap 90. The same slice protocol on the
  valid dense control completed its rank-0 alternative and rejected the other
  three. Exact completion is a useful allocation outcome; local score is not.
- A new observation-only failed-expansion hook located when such a repair could
  first be funded. On shifted pickup seed 27, the selected branch first had no
  viable expansion at gap 79/frame 172,280, leaving 327,720 frames. Restarting
  raw rank 2 from the earlier gap-74 fork with precisely that remainder
  completed (401.40). This proves the rescue is affordable before the ordinary
  DFS exhausts its budget.
- The same trigger is unsafe as a selector: valid dense seed 27 encountered a
  clean-path dead end at gap 86/frame 290,987 with 209,013 frames left, and its
  corresponding alternate ended one contact short even though ordinary search
  later completed. A repair that abandons or reserves budget at the first dead
  end would regress a valid control.

Artifacts: `generated/studies/shared-slice-{pickup-shifted,dense}-s27-a01.json`
and `generated/studies/deadend-repair-affordance-{pickup,dense}-s27-a01.json`
(about 34s total, peak 0.40 GiB). The hook and replay are study-only.

Next step: a source repair needs an incumbent-preserving protocol, not an
early-abandonment threshold. First characterize whether a bounded sidecar can
earn a completion certificate while ordinary traversal continues under the
same total budget; otherwise return to generator/ranker work rather than
installing a brittle rescue switch.

## 2026-07-13: small sidecar progress is non-causal

- A 20k sidecar slice is too short to certify the pickup route: ranks 2/3
  reached gap 82 versus the selected route's gap 82 and only moved the stall
  15 frames later. It cannot safely justify abandoning the incumbent.
- Worse, on the dense control its rank-0 sidecar reached gap 110 (versus the
  selected route's gap 98) while still being incomplete at 20k and producing
  a lower-quality 82.5k completion than ordinary DFS. "furthest short-slice
  progress" would select a plausible but inferior route.
- This rules out a fixed small sidecar as the missing incumbent-preserving
  certificate. Along with the global-width, ambiguity, capacity, and first
  dead-end negatives, no pre-completion allocation policy has a causal,
  control-safe activation signal yet. No repair source candidate is warranted.

Artifacts: `generated/studies/shared-sidecar20k-{pickup,dense}-s27-a01.json`
(two direct replays, 14.3s, below 0.40 GiB RSS). Focused handoff/kinematic
tests remain green.

Next work returns to the independent impact/arrival and candidate-generation
frontiers. Do not re-open pre-completion sidecar allocation without a new
state feature that distinguishes *eventual full-suffix quality*, not merely
local capacity, ambiguity, a dead end, or shallow progress.

## 2026-07-13: impact proposer ablation

- The existing compiler already has the relevant continuous geometry mechanism:
  its aimed lane fits a per-arc joint pitch/whole-rotation response surface,
  predicts the next arrival state, and emits exact candidates through the
  ordinary gates. It is not an absent last-segment or whole-arc knob.
- On the four development music rows at 500k/seed 0, disabling only that lane
  changed 124/347 per-gap funnel classifications, so it materially participates
  in the search. But the aggregate outcome was essentially unchanged: 134
  high-turn gaps remained ungenerated, working rows fell 13 -> 12, and the
  gate/ranking categories merely traded 32/168 for 27/174. The targeted lane
  is therefore neither inert nor a direct solution to the broad impact deficit.
- This is consistent with the exact pair-oracle results: the open problem is
  coupled multi-contact continuation, not a missing local pitch/rotation
  parameter. Do not widen the already rejected aim span or add a duplicate
  impact knob.

Artifact: `generated/studies/impact-funnel-development-music-noaim-500k-s0-a01.jsonl`
(14.1s, 0.53 GiB RSS), compared with the retained aimed funnel. Focused
compiler tests and the full suite completed successfully after the study hooks.

Next hypothesis must operate over a bounded *two-contact* generation family
and prove an exact suffix benefit on more than one source before it changes
the compiler's candidate pool. A single-gap impact fit, rank weight, or arc
range change is now directly contradicted by the evidence.

## 2026-07-13: projected two-contact impact generation rejected

- Extended the V2-native exact pair oracle with one continuous two-contact
  proposal coordinate: generate the predecessor geometry against a 50% or
  100% projection toward the *next* contact's impact target, then generate the
  child normally and judge the unchanged rebuilt/search suffix. The predecessor
  is still exact-evaluated and scored against its own authored target; this is
  proposal-only, not a scorer or feasibility change.
- On `believer_56_6s` seed 0 (64 ordinary parents, 32 children, 100k exact
  suffix), the projection produced only two gate-valid predecessors, one pair,
  and no finalist. The usual pair family also had no lift (305.99).
- The independent high-impact source made the test decisive rather than merely
  gate-limited: `believer_impact_56s` seed 0 produced 2,079 projected pairs,
  five projected objective/impact finalists, and five valid exact completions;
  none improved the 556.76 incumbent. The projected state space is reachable
  and suffix-compatible, but does not improve the track.
- Therefore projecting a future impact ask onto predecessor generation is not
  the missing coupled geometry mechanism. Do not add it as a lane, broaden its
  weights, or promote its local valid completions.

Artifacts: `generated/studies/impact-pair-v2-parent-impact-projection-*-wide-s0-a0{1,2}.json`
(two isolated 500k studies, 33.7s wall-clock, under 0.58 GiB RSS). The pair
oracle now records projected parent/pair/finalist/completion provenance, so a
future two-contact family cannot mistake an unselected proposal for evidence.

Next work: identify a family that changes the *joint shape* rather than simply
retargeting an existing predecessor. It must first show reproducible exact
suffix lift on at least two development sources; otherwise preserve the current
continuous proposer and spend no governed-family budget.

## 2026-07-13: exact joint-shape pair generation rejected

- Extended the V2-native pair oracle with a bounded continuous shape test:
  take ordinary predecessor/child bases, perturb the predecessor with four
  nonzero pitch/whole-rotation settings and the child with two nonzero pitch
  settings, then re-fit *each* arc against its literal authored target before
  rebuilding an unchanged suffix. This is intentionally not a source lane or
  a score change.
- The high-impact development row was a strong reachability test rather than a
  gate-limited null: 275 joint pairs were exact-gate valid, 11 reached the
  objective/impact finalist set, and nine had contract-valid full suffixes.
  None improved its 556.76 incumbent.
- The one historical seed-0 impact-relief signal was also tested at the wider
  64-parent/32-child setting. It produced 21 valid perturbed predecessors,
  226 joint pairs and 21 joint finalists; only one suffix was contract-valid,
  and it did not improve 336.71. This is consistent with the earlier ordinary
  pair's failure to reproduce on seeds 1 and 2, not a hidden joint-shape win.
- `believer_56_6s` and its impact-relief control had no valid ordinary pair at
  the selected weak contact under the narrow screen. `dense_dialogue` failed
  the oracle's incumbent suffix-replay invariant at seed 0, as it had in the
  earlier pair archive, so the script failed closed and the row supplies no
  conclusion. That replay limitation is logged as study-workflow friction; it
  must be repaired before this oracle is used for dense-case evidence.

Artifacts: `generated/studies/impact-pair-v2-joint-shape-*-s0-a01.json`
(two isolated 500k studies: 15.0s/0.48 GiB and 20.9s/0.66 GiB RSS). No
production compiler behavior changed. Do not add a generic adjacent-arc knob
lane, enlarge this bounded mesh, or use the seed-0 ordinary-pair lift as a
promotion signal.

Next work: return to the remaining validity failures. Separate whether the
pickup/dense failures are caused by a missing *reachable state* or by selecting
the wrong already-reachable state, using a replayable per-prefix outcome study.
That study needs an incumbent-preserving control and must treat an unreplayable
prefix as missing evidence, never as a negative result.

## 2026-07-13: shallow continuation and duplicate-geometry checks rejected

- Made the predecessor study write a self-contained `--out` record instead of
  forcing large JSON documents through stdout. It also records a geometry-only
  SHA-256 (line IDs excluded), which distinguishes a regenerated diagnostic
  equivalent from a genuinely separate branch proposal.
- The apparent pickup duplicate was refuted: it was the captured incumbent
  alongside an identical regenerated pool candidate in the diagnostic output,
  not two live frontier branches consuming the three-way allocation. Dense and
  dense-240 controls showed no duplicate geometry at their examined boundaries.
- A 500k exact two-contact continuation read at shifted-pickup seed 27 is
  actively contrary to the desired selector. The eventual completing branch
  had four immediate children and 83 two-contact descendants; the failing
  incumbent had 12 and 256. The larger shallow continuation set still stalled
  later. Thus immediate coverage, a second continuation count, and simple
  geometry de-duplication do not identify eventual suffix quality.

Artifacts: `generated/studies/{pickup-shifted-two-step-outcome,diversity-*}-*-a01.json`
(four isolated 500k reads, 21.6s total, under 0.29 GiB RSS). This prevents a
plausible but incorrect low-speed/branch-diversity policy from entering a
family screen.

Next hypothesis: an allocation improvement must preserve several genuinely
different state basins without using shallow descendant counts as a proxy for
eventual quality. Do not add a continuation-count rank weight or a geometry
dedupe policy from these data; both have direct counterexamples.

## 2026-07-13: exact forward-outcome portfolio rejected

- The expanded pool read showed genuine exact ties in the charged forward
  evaluator: shifted pickup's top two ranks had the same predicted arrival
  `(10.9602, 5.6864 degrees, 0.32 air)` and exact score, while the completing
  lower-ranked basin differed. Dense also contained exact tied outcomes. This
  motivated a deliberately narrow study policy: retain one option per exact
  forward score before falling back to the deferred ties. It used no score
  band, cadence class, state threshold, new candidate, or extra branch.
- The predeclared eight-row 500k panel falsified it. Shifted pickup remained
  invalid; dense fell 386.71 -> 384.55, believer fell 323.26 -> 323.16, and
  only dense-240 improved 373.36 -> 379.03. All other rows were effectively
  unchanged. Exact evaluator ties are therefore not enough to establish an
  interchangeable future basin.
- Removed the opt-in source switch and its unit test immediately. The only
  retained change is predecessor-study output: `--out` now records evidence
  cleanly, including already-computed arrival fields and a geometry-only hash.

Artifact: `generated/studies/forward-tie-diversity-local-panel-500k-s27-a01.json`
(eight direct compiles, 35.5s wall-clock, below 0.30 GiB RSS). No compiler
policy changed. A state-basin method needs a causal continuation certificate,
not equality of the current two-contact forward surrogate.

## 2026-07-13: completed-prefix swap and late fourth branch rejected

- A V2-native local-replacement oracle now verifies that the accepted suffix
  replays exactly before it replaces an incumbent contact with a current-pool
  alternative and re-scores the full track under literal authored impacts. The
  apparent `countercurrent` +19-point predecessor signal came from a separate
  partial-search state, not a replacement compatible with the completed
  incumbent: 20 alternatives at the predecessor produced one valid suffix at
  -33.92, and replacing the next contact produced no suffix at all. This is
  evidence against adding a post-completion swap pass from the ordinary pool.
- A bounded fourth branch was then exposed only after the existing online
  pace/continuation controller had activated. A 24-row 500k panel over seeds
  27--29, including both pickup variants, dense/dense-240, long endurance,
  representative countercurrent, and music, was exactly bit-identical. The
  controller never had a fourth eligible survivor; the apparent policy was a
  no-op, so its source hook and test were removed.

Artifacts: `generated/studies/v2-gap-swap-countercurrent-s24-*.json` and
`generated/studies/online-recovery-branch{3,4}-panel-s{27,28,29}-a01.json`.
No production behavior changed. The remaining invalid rows need a proposal
family that reaches a different boundary state, not another branch count or a
completed-prefix replay.

## 2026-07-13: compact exit-support reachability is not yet an admission rule

- The existing normalized support-manifold records contain a reproducible
  physical state for the remaining shifted-pickup failure: across seeds 27--29,
  a one-segment tail derived from the normal contact geometry, at 0.65--0.85
  of the kinematic support length and a +8-degree exit residual, restores
  several next-contact continuations. Fixed-budget suffix re-search completed
  all three rows (397.60, 380.36, and 393.50 or better).
- A six-proposal compiler arm from the two best normal bases was deliberately
  tried only behind the current deepest-frontier/no-ordinary-continuation gate.
  It was bit-identical on the failing pickup and balanced controls: that local
  gate did not fire because ordinary one-step continuations existed, even though
  they later entered the wrong basin. Removing the gate would merely revive the
  rejected shallow-continuation heuristic, so the source prototype was removed.

This establishes reachability, not a promotion candidate. The next selector
must distinguish eventual basin value from immediate continuation count; do
not add the compact grid, a raw capacity rank, or a broad support lane from this
evidence alone.

## 2026-07-13: repair accounting and equal-slice portfolio rejected

- V2-native repair logging found that a post-repair incumbent can leave later
  contact gaps with a zero measured suffix cost. On a 500k `countercurrent`
  control this produced 45 logged restarts, but only five consumed frames; the
  remaining 40 were zero-frame no-ops. A conservative cost-floor prototype
  removed those no-ops but changed the scarce restart schedule and reduced the
  same control from 660.56 to 659.24. It was reverted: this is accounting
  hygiene, not evidence for a quality policy.
- Equal 82.5k suffix slices make the pickup fork concrete: ranks 2 and 3
  complete while the incumbent route and ranks 0--1 do not. They are not a
  general portfolio rule. The late dense-240 control has only 131k remaining
  at its fork and no candidate finishes in an 82.5k slice; conversely all five
  examined `countercurrent` alternatives finish but range from 645.11 to
  667.63. Equal partitioning would either strand late legitimate paths or
  exchange established quality for a merely valid result.

Artifacts: `generated/studies/v2-repair-diagnostics-countercurrent-s27-500k-*.json`
and `generated/studies/shared-slice-{dense240-s28,countercurrent-s24}-a01.json`
(four isolated 500k observations, under 30 seconds wall-clock). No compiler
behavior changed.

Next work: a traversal redesign needs an incumbent-preserving, cost-aware
completion certificate. Do not add fixed equal sidecars, an early fork split,
or a repair-cost floor from these results.

## 2026-07-13: dense 250k boundary is multi-contact, not a runway gate

- At dense-recovery seed 24's first 250k failure (gap 53), a regenerated
  128-candidate predecessor pool had zero next-contact bridges. The selected
  state was at raw pool rank 10; none of the wider ordinary candidates left
  more than four airborne frames for the following nine-frame interval.
- A deliberately wide 1,470-point one-segment support surface found 397
  current-contact fits and many immediate next candidates, but its best flight
  remained five frames, one short of the detector's six-frame landing rule.
  Its exact 100k suffix stalled at gap 75. This rules out treating a shallow
  next-pool count as a completion proxy here.
- A narrowly more judge-aligned detector-runway gate (suppress only when the
  scored pool, rather than any raw sample, already has runway) was bit-identical
  on pickup and shifted pickup and left both dense frontier rows invalid at
  250k. It changed only 154 simulated frames on dense and was removed.

Artifacts: `generated/studies/dense250-s24-gap53-*-a01.json` and
`generated/studies/contact-phase-{raw,scored}-gate-frontier250-s24-a01.json`
(five focused 250k runs, about 25 seconds wall-clock). No compiler behavior
changed.

Next hypothesis: rapid multi-contact figures need a proposal whose support and
release state are constructed over the *whole* short-contact run. A one-contact
arc, a one-segment tail, and a gate around either have all been falsified at the
same boundary. The proposal must still be continuous in contact timing and
state, and must be exact-simulated before admission.

## 2026-07-13: existing dense candidates do not supply the missing run

- The contact-phase suppression condition was tightened from five to the
  detector's actual six airborne frames as a focused consistency test. It was
  bit-identical on pickup/shifted pickup and left dense/dense-240 invalid at
  250k, so the strict condition was reverted. The issue is not a one-frame
  gate around an otherwise useful runway candidate.
- From the prior dense contact (gap 52), each of the eight current pool routes
  received the entire remaining 132k suffix budget. None completed. Two
  routes nevertheless reached 104 and 117 of 123 contacts, so the current
  generator has substantial but insufficient reach; a single earlier rank
  change cannot explain the failure.

Artifacts: `generated/studies/contact-phase-strict-runway-frontier250-s24-a01.json`
and `generated/studies/dense250-s24-gap52-full-suffix-top8-a01.json` (about
20 seconds wall-clock). No compiler behavior changed.

Next implementation study: construct a bounded three-contact beam from the
same prefix, with exact candidate gates at every contact and a preserved
incumbent control. First establish whether the current generator contains any
complete three-contact chain before adding a new compound geometry basis.

Workflow safeguard: the first beam harness was discarded before producing an
artifact because it could not reproduce the predecessor oracle's known
two-step bridge from its captured prefix. A multi-contact study must bind the
captured pool identity and reconstructed prefix bit-for-bit before it may be
used as evidence.

## 2026-07-13: global shape/time interpolation rejected

- The alternate unified `shape-time-log` proposal mode was checked against the
  same 500k seed-27 mixed panel. It converted shifted pickup (0 -> 371.29) and
  improved low-air frontier rows, but lost 38.06 on dense, 24.84 on Believer,
  and 6.81 on ordinary pickup. This is the expected broad basin exchange, not
  a safe generalization of the compact-support reachability result.

Artifact: `generated/studies/support-shape-time-log-panel-s27-a01.json`.
The source default remains `shape-time-deficit`; do not broaden the support
interpolation globally to resolve one remaining capability seed.

## 2026-07-13: repeated dense primitives reach a real but incomplete basin

- An exact V2 oracle started at dense-recovery seed 24's failing 250k prefix
  (gap 51), translated each current admissible catch into successive rider
  states, and required the ordinary full physics gate at every contact. Two of
  18 candidates survived three repeated contacts, but none survived twelve;
  their equal 132k suffixes stalled at gaps 69--70. Literal steady-state reuse
  is therefore not a sustained dense-run proposal.
- Re-expressing the same primitive in the current rider tangent frame, with
  length scaled by current speed, is a meaningful control rather than a no-op:
  one three-contact prefix reached an ordinary suffix at gap 105. It still did
  not complete, and a wider 512-sample, twelve-contact sweep found zero stable
  primitives. This is a partial basin-reach signal, not evidence to add a
  state-normalized lane or reserve a branch.

Artifacts: `generated/studies/dense250-s24-{repeated,state-normalized}-cycle-*-a01.json`
(four exact studies, under 15 seconds total). The next candidate must actively
control energy over a multi-contact run; neither fixed world geometry nor a
speed/tangent-normalized copy supplies that control by itself.

## 2026-07-13: single-chord energy control rejected at the current gate

- The repeated-primitive oracle also tested a stricter physical control: keep
  the state-normalized incoming catch, but replace its post-contact support at
  every contact with the kinematic length and slope implied by the current
  entry speed, next speed target, and detector-floor flight time. All 18
  initially admissible dense candidates failed the *current* contact gate.
- This is a useful negative result. A support chord has the right speed-time
  dimensions but cannot replace the curved contact transition; it is not a
  viable way to make a coupled dense chain energy-stable.

Artifacts: `generated/studies/dense250-s24-energy-normalized-cycle-{d3,d12}-a01.json`.
No source policy changed.

## 2026-07-13: curved energy support does not preserve the dense catch

- A more faithful follow-up kept the incoming catch tangent and replaced only
  the tail with a four-segment smooth transition. Its length and terminal
  direction continuously blended from the accepted arc toward the same physical
  speed/time support plan. This avoids the one-chord discontinuity while making
  the energy correction explicit.
- At a 20% correction, five of 18 initial catches remained admissible for one
  contact but none formed a three-contact chain. At 50%, all 18 failed the
  current gate. The correction is not an untuned scale issue: the stable
  zero-correction control is already the state-normalized copy, which itself
  fails before twelve contacts.

Artifacts: `generated/studies/dense250-s24-curved-energy-b{02,05}-d3-a01.json`.
Do not add a curved kinematic-tail lane or open a curve-strength source family.

## 2026-07-13: breadth-first frontier allocation rejected

- The next systemic alternative was a schedule-only test: preserve the normal
  candidates, ranker, branch width, and 500k frame budget, but interleave
  admitted sibling prefixes breadth-first instead of the production
  depth-first traversal. This is a generic allocation policy, with no
  capability, cadence, or score threshold.
- It failed all eight balanced controls at seed 27: ordinary pickup, dense,
  dense-240, long-endurance, countercurrent, and Believer each went from a
  complete baseline to no completion; shifted pickup remained invalid. The
  temporary `LR_TRAVERSAL_ORDER=breadth` hook was removed immediately.

Artifacts: `generated/studies/traversal-{dfs,breadth}-panel-s27-500k-a01.json`.
Depth-first commitment is an essential convergence property at the available
budget, not an accidental allocation defect. Future traversal work must retain
that property and demonstrate a stronger outcome certificate than fairness.

## 2026-07-13: dense 250k failure is not recoverable by removing lookahead work

- The exact V2 stage-0 run remains 475.47 at 250k/500k. All three
  `frontier_dense_recovery` seeds are invalid at 250k, while two of three
  complete at 500k. The successful 500k paths use the ordinary contact-centred
  generator, so dense contact timing is physically reachable without a special
  case; the scarce run is failing before it can find and retain such a path.
- Seed 24's 250k run charges 51,483 frames to 1,050 forward rollouts and
  35,227 to aim probes, but reaches only gap 53. This is a reason to test their
  decision value, not permission to refund or delete the work.
- The controlled ablations all fail substantially earlier: forward evaluation
  off reaches 68/88 contacts, all aiming off reaches 51/88, rollout-only aiming
  off reaches 51/88, and greedy depth-one forward evaluation reaches 51/88.
  Start evaluation off reaches 75/88, still below the default path. The default
  reaches the dense boundary around 53 with 250k and completes at 500k.

Artifacts: `generated/studies/dense250-s24-{fwd-off,aim-off,rollout-aim-off,
fwd-greedy1,start-off}-a01.report.json` and
`generated/studies/dense-path-compare-s24-250-500-a01.json` (five isolated
250k runs, under 15 seconds wall-clock). No compiler behavior changed.

Next hypothesis: construct and exact-simulate a bounded, state-coupled
multi-contact proposal before the normal search ranks it. It must preserve the
curved incoming catch and control the *sequence* of release states, rather than
removing forward reasoning, changing traversal order, or adding a cadence
threshold. It must be an additive candidate basis and remain inert when the
ordinary pool already supplies an equivalent continuation.

## 2026-07-13: adaptive normal-candidate beam establishes reachability, not a policy

- An exact oracle now regenerates independent normal candidates at every child
  state, applies the ordinary gate to each edge, and retains only a bounded
  beam by the shared whole-prefix score reconstruction. It is intentionally an
  availability read, not a compiler policy or a cadence-triggered selector.
- From seed 24's gap-45 state, a width-32, 32-child beam can solve six further
  contacts, but all retained prefixes have no admissible seventh contact. From
  the earlier gap-42 state, it sustains twelve contacts; eight equal 132k
  suffix searches still produce no completion (best reaches gap 110/123).
- This separates short-horizon reachability from an eventual good basin. A
  multi-contact proposer cannot be justified by retaining the locally best
  normal candidate sequence alone, and production must not install this beam
  as a new allocation rule.

Artifacts: `generated/studies/dense250-s24-adaptive-beam-g{42,45}-*-a01.json`.
No compiler behavior changed. The remaining route is to derive a compact,
state-continuous geometry basis with an exact downstream advantage, then test
it as an additive family against the established panel.

## 2026-07-13: release speed alone does not identify the durable basin

- The failing 250k route carries excess release speed relative to the matching
  500k completion, so a release-state explanation was plausible. An exact
  24-member suffix read at the upstream gap-47 state refutes using that scalar
  as the selector: candidates between 11.63 and 12.01 px/frame release speed
  range from stalling near gap 70 to reaching 121/123 contacts.
- The longest of those suffixes remains contract-invalid. Current achieved
  speed is similarly clustered, so neither a local speed penalty nor a simple
  release-speed regularizer supplies the missing downstream certificate.

Artifact: `generated/studies/dense250-s24-g47-release-suffix-a02.json`.
No compiler behavior changed. Future coupled geometry work must preserve a
richer state (contact pose and transition shape), not merely a scalar energy
target.

## 2026-07-13: V2 arrival-prediction observation separates usable and weak signals

- A new observation-only V2 study uses the frozen jolt and target sampling,
  then compares the existing zero-frame ballistic release prediction with the
  next authored gap on the final compiler path. It excludes unspecified axes,
  exactly as the scorer does; the initial observer did not, and was corrected
  before any result was retained.
- On the 500k seed-27 capability panel (dense, dense-240, pickup, shifted
  pickup), predicted mean speed is strongly aligned with actual next-gap speed
  (correlation 0.971, MAE 0.149 px/frame) and beats the authored target as an
  outcome predictor on 78.3% of pairs. It is a useful state coordinate, not a
  reason to replace the existing ballistic model.
- Air is weaker and systematically low on that panel (correlation 0.452,
  bias -0.146, MAE 0.147). The independent endurance/representative/music
  panel has better air correlation (0.775) but the same -0.141 bias. There
  were no authored elevation observations in either panel.
- This is deliberately insufficient for a source change. These are selected
  final paths, not a candidate-level causal outcome experiment; an affine air
  correction or a new readiness weight could simply reshuffle search basins.
  Retain speed as an observed signal and reject a prediction-model tweak until
  it demonstrates an exact candidate/suffix advantage across controls.

Artifacts: `generated/studies/v2-arrival-prediction-capability-s27-500k-a02.json` and
`generated/studies/v2-arrival-prediction-controls-s27-500k-a01.json`
(eight 500k compiles in two fresh four-case processes, about 37 seconds total).
The all-eight single-process observer did not serialize after six rows because
of process-lifetime WASM allocation; bounded fresh-process batches are the
reliable execution form. No compiler behavior changed.

## 2026-07-13: short dense support is already reachable but not durable

- Added support-time and exit-shape readouts to the exact dense path observer.
  Three 500k completions use ordinary candidates with roughly 2--6 support
  frames through the tight figure, while seed-24's 250k failure uses about six
  to seven. This was a candidate-generation hypothesis, not a conclusion.
- At the exact 250k seed-24 parent before gap 50, the ordinary pool already
  contains 71--73px alternatives with four to six immediate continuations.
  Equal 132k suffix searches from 24 current-pool alternatives reach as far as
  119/123 contacts, but none completes. The selected branch reaches 70/123;
  the best short-support candidate reaches 114/123.
- Thus neither adding a short support family nor ranking by one-step runway,
  support duration, or local continuation count has a causal certificate. The
  observed shorter successful 500k geometry is real, but it is one coordinate
  of a broader state basin, not an admission rule.

Artifacts: `generated/studies/dense-path-compare-s{24,25,27,28}-*-a0{1,2}.json`
and `generated/studies/dense250-s24-g50-short-support-suffix-a01.json`
(four path reads plus one 24-suffix exact oracle, about 30 seconds). No compiler
behavior changed.

## 2026-07-13: fresh paired V2 screen is directional evidence only

- A fresh paired development epoch compared the current working tree with the
  frozen V2 baseline across 44 catalog sources, 48 seeds, and the 250k, 500k,
  and 750k budgets (6,336 compiles per side). It produced a `+2.19` headline
  estimate, but its 99% one-sided lower bound was `-0.69`; the declared result
  is therefore **inconclusive**, not promotable.
- The apparent gain is concentrated in capability: dense recovery `+34.79`,
  low-air `+3.87`, and rapid pickup `+1.46`. Representative behavior was
  `+0.23` overall, while the dense parent pair traded `-13.89` on its base
  variant for `+18.64` on its impact contrast. This is not evidence for a
  general rank or generator change.
- The explanation still identifies the same low-budget frontier: dense and
  dense-240, both pickup variants, and the 6s/7s endurance cases. At 500k and
  750k, the remaining invalids are principally the dense and pickup frontier
  cases. The next study must establish a candidate state feature with
  downstream value across independent boundaries, rather than infer a policy
  from this aggregate screen.

Artifacts: `benchmark/v2/runs/2026-07-13T01-51-38Z-da99767b-*` (local and
ignored), including the verdict and generated explanation. No attempt was
promoted and no era budget was spent.

## 2026-07-13: current-mechanism ablation is locally selective

- A fixed mixed eight-case panel at 500k/seed 27 compared the current source
  with each mechanism disabled independently. It took 35.8s per arm (about
  2.4 minutes total) and is diagnostic only: a single seed cannot establish a
  promotion effect.
- Disabling the detector-runway proposer changed tight pickup from 396.43 to
  386.21; the other seven rows changed by at most 0.04 and stayed valid.
  Disabling kinematic support or online continuation was bit-identical on all
  eight rows. The latter two controls were simply inactive for this seed/panel,
  not refuted.
- This corroborates the intended local activation and ordinary-track
  invariance. It does not license broadening any gate; the next study still
  needs cross-boundary downstream-value evidence for the unresolved pickup and
  dense basins.

Artifacts: `generated/studies/current-mechanism-panel{-online-off,-kinematic-off,-runway-off}-s27-500k-a01.json`.

## 2026-07-13: suffix-outcome oracle now fails closed on non-replayable state

- A predeclared equal-suffix read of pickup-shifted, dense, dense-240, and
  representative countercurrent showed why local continuation counts cannot be
  treated as downstream labels. Pickup's lower-readiness alternatives completed
  while its selected branch did not; dense had both valid and invalid routes
  with similar immediate coverage; countercurrent's high-coverage routes were
  mostly valid but differed substantially in final quality.
- Dense-240 exposed a study-contract failure: its original full compile is
  valid, but the selected prefix's resumed suffix was not. The current online
  controller depends on traversal history that a node-only snapshot does not
  preserve, so that outcome is not a valid negative label.
- `study_predecessor_coverage.ts` now requires the selected suffix control to
  replay whenever the source compile completed, and exits before writing an
  alternative comparison otherwise. Countercurrent passes this check; dense-240
  now fails explicitly at gap 73 (`deepest=120`). This is a study safeguard,
  not a compiler behavior change.

Artifacts: `generated/studies/outcome-oracle-*-a01.json` and
`generated/studies/outcome-oracle-control-replay-s24-a01.json` (five isolated
reads, about 2.5 minutes). A history-preserving resume contract is a separate
tooling project; do not use non-replayable suffix rows to tune the compiler.

## 2026-07-13: late fresh-seed restart cannot recover shifted pickup

- At the current shifted-pickup 500k seed-27 dead end, the selected route
  stops at contact 90 with 128,507 simulated frames left. Its ordinary rank-2
  sibling, restarted from that same prefix, reaches 109/110 contacts but still
  misses one authored contact.
- Six deterministic continuation sampling seeds (27--32), holding the source
  spec, prefix, sibling, and remaining frame budget fixed, produced five
  one-miss outputs at contact 109 and one earlier stall at 105. None completed.
- This falsifies a late pre-completion fresh-seed restart as a sufficient
  recovery policy. The successful alternate basin observed earlier must be
  preserved before the budget is exhausted; spending the terminal remainder on
  resampling cannot reach it. No compiler restart hook was added.

Artifact: `generated/studies/pickup-shifted-deadend-fresh-seeds-s27-a01.json`
(one base compile plus seven 128k suffix reads, about 16 seconds).

## 2026-07-13: deferred-frontier scheduling hypothesis refuted

- A first frontier snapshot seemed to show that a waiting rank-1 route at the
  shifted-pickup fork completed with 300k frames. That was not a sibling of
  the selected route: rank alone is not an identity, and another prefix at the
  same gap carried the same entering rank.
- The frontier diagnostic now binds a deferred node to the selected node's
  complete parent rank trace as well as gap and entering rank. Under that
  identity, the true rank-1 sibling at the 165,423-frame pickup fork reproduces
  the original contact-90 stall with 300k frames. Dense 250k's actual deferred
  sibling likewise remains invalid (deepest 62).
- Therefore a DFS/round-robin or early sibling-scheduling policy has no causal
  basis here. The useful route seen in regenerated-pool suffix work comes from
  an earlier distinct basin, not from a queued sibling the scheduler merely
  failed to visit. No traversal-order source change was made.

Artifacts: `generated/studies/pickup-shifted-frontier-*-s27-a0{1,2}.json` and
`generated/studies/dense250-frontier-r1-suffix120k-s24-a01.json`.

## 2026-07-13: fixed sampling offset is not a general search policy

- A shifted-pickup 500k/seed-27 compile completes when its candidate-sampling
  seed is advanced by one, while the default seed stalls at contact 90. This
  establishes that an earlier alternate search basin exists; it does not make
  the offset a selector.
- A balanced eight-case, 500k panel compared the default sampling seed with a
  fixed `+1` offset across compiler seeds 27--29. The offset changed validity
  from 7/8 to 8/8 at seed 27 and from 7/8 to 8/8 at seed 29, but from 8/8 to
  7/8 at seed 28: it made the otherwise-valid dense case invalid and reduced
  the panel total by 410 points. No fixed offset dominated all three reads.
- The panel's seed is now named `compilerSeed` and its effective `searchSeed`
  is recorded explicitly. The authored specification is fixed in this study;
  this is deliberate RNG-allocation evidence, not independent input variation.
- Fixed alternate sampling is therefore rejected as a compiler policy and is
  not a candidate for a governed family. The recovery remains useful only as a
  diagnosis: the missing basin must be made reachable through a state/geometry
  property, rather than selected by an arbitrary random stream.

Artifacts: `generated/studies/{current-mechanism-panel-s27-500k-a01,
search-seed-offset{0,1}-panel-s{28,29}-500k-a01}.json` (six 8-case reads,
about 2.5 minutes including reruns). No compiler behavior changed.

## 2026-07-13: prefix-conditioned sampling diversity rejected

- The normal sampler intentionally reuses a deterministic `(search seed,
  gap-index)` stream for every prefix at a gap. A diagnostic alternative keyed
  that stream by the exact committed geometry as well, providing independent
  state-relative candidate quantiles to competing prefixes without adding work
  or a track-specific condition.
- On the seed-27 panel it recovered shifted pickup and raised validity 7/8 to
  8/8, but already reduced pickup, dense, and Believer. Replication made the
  trade-off decisive: seed 28 lost 62 panel points with no validity gain, and
  seed 29 exchanged an invalid dense route for an invalid dense-240 route while
  losing 111 points overall.
- The mechanism diversifies outcomes but does not improve them reliably. The
  opt-in source switch was removed after the panel; the existing common stream
  remains the compiler behavior. This is not a reason to add a fixed
  diversification ratio or an RNG portfolio: the successor hypothesis still
  needs an observable state/geometry property that predicts a durable basin.

Artifacts: `generated/studies/diversified-node-sampling-panel-s{27,28,29}-500k-a01.json`
(three isolated eight-case reads, about 90 seconds). No compiler behavior changed.

## 2026-07-13: successful pickup basins diverge at the initial contact

- Generalized the selected-path observer so it can compare deterministic search
  streams for any capability source while preserving the existing budget study.
  On shifted pickup at 500k/seed 27, streams 28 and 30 complete while stream 27
  stalls at contact 90.
- Both completed paths differ from the stalled path at gap zero, not at a late
  fork. Their initial support durations are themselves materially different
  (about 11.7 and 15.0 release-speed frames), and their later exit angles and
  amplitudes also differ. There is no shared scalar that supports an initial
  length or pitch correction.
- This rules out treating the late stalled contact as the origin of the basin
  difference. It also strengthens the prior result that a local continuation
  selector cannot repair this family: any usable proposal must shape a
  multi-contact trajectory from the start while retaining independent evidence
  that it does not displace mature paths.

Artifact: `generated/studies/pickup-shifted-search-paths-s27-500k-a01.json`
(three isolated 500k compiles, about 30 seconds). No compiler behavior changed.

## 2026-07-13: brake-catch ablation exchanges durable routes

- Eight shifted-pickup search streams made a simple source hypothesis
  falsifiable: the sole failed stream selected a brake catch at gap zero, while
  seven completed streams selected ordinary-pool geometry. A default-off
  diagnostic ablation was therefore run before considering any rank change.
- The ablation recovered shifted pickup at seed 27, but made ordinary pickup
  invalid. Across the same mixed eight-case panel at seeds 27--29, it also
  traded a valid dense route for an invalid dense route at seed 28 and a valid
  dense-240 route for an invalid dense route at seed 29. Panel totals changed
  -15, -392, and +9 with no consistent validity gain.
- Brake catches are thus a real, coupled basin mechanism, not an expendable
  local artifact. The diagnostic switch was removed. A future evaluator may
  compare their longer-horizon state against ordinary geometry, but a global
  brake gate, root-only exclusion, or pickup-specific rule is directly
  contradicted by this panel.

Artifacts: `generated/studies/brake-off-panel-s{27,28,29}-500k-a01.json`
(three isolated eight-case reads, about 90 seconds). No compiler behavior changed.

## 2026-07-13: source-specific brake depth is compute-negative

- Brake candidates already receive the normal charged greedy depth-2 future
  rollout. A diagnostic depth-3 override for that source alone tested whether
  its setup horizon was under-valued without globally widening normal-pool
  evaluation.
- At 500k/seed 27 it recovered shifted pickup, but reduced every other panel
  score by 11--57 points and made dense-240 invalid. The fixed search budget
  is the mechanism: the extra rollout charge starves the competing trajectories
  before a later brake ranking decision can help.
- The opt-in override was removed after this single decisive refutation. Future
  work must improve candidate/state coverage at roughly equal simulation cost;
  adding a source-specific horizon is not a viable way to preserve both pickup
  basins.

Artifact: `generated/studies/brake-forward-d3-panel-s27-500k-a01.json`
(one isolated eight-case read, about 30 seconds). No compiler behavior changed.

## 2026-07-13: root-basin reachability is source-specific, not a missing macro

- On shifted pickup seed 27, the normal 500k traversal selects a brake catch at
  gap zero and stalls at contact 90. An equal-suffix replay of that exact brake
  prefix also stalls at contact 90, whereas each of eight ordinary root-pool
  prefixes completes the 110-contact track under the same independent 450k
  suffix budget (374.97--407.30).
- A bounded three-contact reachability beam added nothing beyond this result:
  its depth-one control already completed for all eight ordinary roots. The
  beam is deliberately generator-order-only; its former partial-leaf ordering
  was removed because equal-horizon prefixes do not provide a meaningful
  partial-score comparison.
- This is stronger than the prior source correlation but is still not a brake
  exclusion rule. The mixed control panel already falsified a global brake
  gate. Any successor must demonstrate a state-conditioned allocation rule
  that preserves the ordinary-pickup and dense routes for which brake is useful,
  at effectively equal search cost.
- Workflow repair: the predecessor suffix tool selected the synthetic,
  unexpanded root as a gap-zero ancestor. It now prefers the concrete expanded
  start state, and the rerun exercised the formerly impossible root snapshot.

Artifacts: `generated/studies/{pickup-shifted-coupled-root-d1-control-a02,
pickup-shifted-root-brake-equal-suffix-a02}.json` (two focused reads, about
70 seconds). No compiler behavior changed.

## 2026-07-13: impact templates are present but not an unobserved coverage gap

- The exact impact/readiness Pareto read across `believer_56_6s` and its
  impact-relief neighbor (three 500k seeds, 1,963 prefix pools) confirms that
  the current generator often contains a much closer current-impact candidate:
  mean impact error is 0.359 for the forward winner and 0.084 for the raw
  specialist. A readiness-loss threshold alone is not a selector; the
  specialist is commonly outside the three admitted branches.
- A landing-window funnel on `believer_56_6s` seed 27 shows the existing impact
  template family is active: 3,963 of 13,257 observed candidates were templates,
  including 20/56 candidates at the highest-error gap. These are not a dormant
  generator path waiting for a wider trigger.
- This reinforces the prior exact pair/suffix rejections: local impact capacity
  exists, but exchanging into it changes the downstream trajectory. Do not add
  an impact-error tie-break, widen template rate, or promote the low-readiness
  specialist from this evidence. A future impact improvement needs a paired,
  multi-contact state certificate rather than another local contact knob.

Artifacts: `generated/studies/believer-impact-pareto-s27-29-500k-a01.json` and
`generated/studies/believer-template-funnel-s27-500k-a01.json` (seven isolated
500k compiles, about 32 seconds). No compiler behavior changed.

## 2026-07-14: constrained-contact candidate screen and support-span rejection

- The current handoff candidate was first screened unchanged, including its
  observation-only diagnostic hooks. The 264-compile V2 probe completed in
  about 1m14s at 48 workers and moved the frozen baseline from 462.73 to
  475.47 (`+12.75`): validity improved from 243/264 to 251/264, with eight
  gains and no losses. The gain is concentrated in the constrained-contact
  frontier (pickup `+250.62`, dense-240 `+231.29`, and 7s endurance `+122.64`);
  94.7% of paired outputs are bit-identical. This is strong screening evidence,
  not a promotion: the current era has only 0.0082 alpha capacity while the
  certified improvement row costs 0.0209.
- The remaining support alternative was then tested as a single source-default
  change, `shape-time-deficit -> time-shape-span`, on exactly that candidate.
  It screened 475.47 to 477.25 (`+1.78`) but changed 95.5% of tracks. Direct
  pairing against the current candidate showed a 250k change of `-27.10`,
  four validity losses versus three gains, representative `-12.51`,
  dense-musical `-104.91`, and individual losses of 121.30 (dense dialogue)
  and 92.97 (high-air variant). Its apparent aggregate gain is an unresolved
  capability/music basin exchange, not a robust improvement.
- `time-shape-span` was restored to the accepted deficit default. A governed
  family would only repeat this already decisive broad screen, so none was
  opened. Focus next on the selection/traversal mechanism that makes the
  current constrained-contact candidate broadly favorable, while preserving
  the mature-path safeguards exposed by the rejected span.

Artifacts: `generated/benchmark-v2/eval/support-{control-current,time-shape-span-current}-2026-07-14.*`
and `generated/benchmark-v2/decisions/support-span-vs-deficit-current-2026-07-14.json`
(two 264-compile probe runs, about 2m30s total). The source default and empty
compiler environment were restored before further work.

## 2026-07-14: detector-runway attribution and terminal-phase limit

- Whole-suite ablations separated the current constrained-contact candidate.
  With `LR_DETECTOR_RUNWAY=0`, the probe fell 475.47 to 469.96 (`-5.52`) and
  lost four valid rows, all in capability; representative, regression, and
  music rows were bit-identical. With `LR_KINEMATIC_SUPPORT=0`, it fell to
  473.36 (`-2.11`) and lost one valid row, the 7s low-air endurance case.
  These are environment-only attribution reads, not selectable variants.
- The detector runway is therefore a real, narrowly activated source of the
  current screen gain. Its remaining shifted-pickup failure cannot be repaired
  by a last-contact parameter tweak: at seed 27's actual terminal prefix
  (gap 90, seven-frame next interval), all eight regenerated pool catches and
  every exact `+1..+10` degree rotation and bounded translation retained only
  one or two airborne frames and yielded zero next-contact candidates.
- Do not open a runway-constant family from this evidence. A useful successor
  must carry a viable release state through a short *sequence* before this
  terminal boundary; a one-contact geometry perturbation is falsified again.

Workflow friction: `study_predecessor_coverage.ts --help` previously executed
its default 500k study. It now prints usage and exits before any compiler work.

Artifacts: `generated/benchmark-v2/eval/ablate-{detector-runway,kinematic-support}-current-2026-07-14.*`,
`generated/benchmark-v2/decisions/{detector-runway-off,kinematic-support-off}-vs-current-2026-07-14.json`,
and `generated/studies/pickup-shifted-s27-g90-runway-geometry-a01.json`
(two 264-compile ablations plus one exact terminal-prefix read, about 2m35s).

## 2026-07-14: root brake-basin boundary, no production rule

- A new observation-only ranked-option hook captured the actual production
  ordering at root. On the seed-27 pickup pair, brake rank 9 narrowly beats
  ordinary pool rank 2 by 0.58% of the charged forward score; every option has
  one-step continuation. Equal 450k suffixes then separate the basins: the
  selected brake root stalls only on shifted pickup, while every sampled
  ordinary root finishes. Ordinary pickup's ordinary roots also finish under
  the same suffix, so the prior global brake-off loss is caused by later
  traversal, not a necessary root choice.
- The fixed 10-case x 3-seed root panel confirms a decisive limitation. The
  selected brake root appears only for the ordinary/shifted seed-27 pair; the
  two rows have identical root ordering but opposite brake-off outcomes. A
  current-state-only selector cannot distinguish them.
- A disabled smooth future-cadence tie-break was briefly tested as a *negative
  control*: it preserved ordinary pickup and completed shifted pickup by using
  the whole-spec minimum spacing (7 frames shifted versus 8 ordinary). That
  7-frame condition is unique to one development variant. It was removed
  immediately rather than screened, because a policy activated on one catalog
  row is not a general compiler mechanism.
- Retained result: candidate/state coverage exists at the root; a credible
  successor must use a broadly occurring, multi-contact state feature or a
  genuinely longer-horizon evaluator. Do not add a future-min-gap special case
  or treat the clean shifted completion as evidence for promotion.

Artifacts: `generated/studies/{root-options-panel-s27-500k-a01,
root-options-panel-s28-500k-a01,root-options-panel-s29-500k-a01,
pickup-root-brake-equal-suffix-a01}.json` (30 panel compiles plus one exact
suffix control, about 3 minutes). No compiler behavior changed.

## 2026-07-14: eval destination contract tightened

- A diagnostic stage-0 rerun used `--archive-dir`, a confirmation-only flag.
  The former parser silently ignored it and wrote its default stage-0 output;
  the inert instrumentation result still matched the current control exactly
  (475.47), but the command shape could misfile future evidence.
- `eval` now validates a mode-specific argument contract before suite
  preparation: stage 0 accepts `--out=FILE`, while confirmation alone accepts
  `--out-dir` and `--archive-dir`. Unsupported, valueless, or cross-mode flags
  fail before any compiler work. Focused policy/protocol tests and a live
  rejected CLI invocation verify the guard and that no output path is created.

No compiler behavior changed.

## 2026-07-14: shifted-pickup horizon recheck

- At seed 27's gap 89, all 53 observed ordinary ranked-option sets had six
  to nine admissible current-contact candidates, but none had an immediate
  continuation to the final short contact. At gap 88, 111/149 candidates did
  have that one-step continuation. The failure must therefore be prevented at
  least two contacts upstream; a terminal rescue or one-step re-ranker cannot
  recover it.
- The existing charged `greedy:3` forward evaluator confirms that diagnosis:
  it completes the 500k shifted row (380.01) where default depth 2 fails.
  This is not a new production proposal. The already-retained V2 screen and
  fresh family evidence reject global mature depth 3 because its capability
  gains exchange against representative, regression, and development-music
  behavior. The recheck narrows the required successor to a state-coupled,
  selective multi-contact geometry/allocation mechanism, not another horizon
  constant.

Artifacts: `generated/studies/pickup-shifted-s27-g{88,89}-*-a01.json` (three
isolated 500k reads, about 15 seconds). No compiler behavior changed.

## 2026-07-14: uniform whole-arc scale rejected

- Hypothesis: a third continuous coordinate, scaling a complete arc about its
  entry, could carry the shifted-pickup basin through the multi-contact short
  sequence without a catalog-specific rule. Exact suffix replays at the same
  upstream contact supported the direction: scale `0.94` completed all sampled
  shifted seed-27 suffixes and produced viable completions on seeds 28 and 29.
- The whole-suite screen falsified the *uniform, ungated* proposer. It raised
  the 500k budget from 482.68 to 495.57 and completed the shifted pickup
  (`1/3` to `3/3`), but reduced 250k from 457.46 to 438.64, reduced the
  representative stratum by 11.82, and exchanged three valid rows for three.
  The paired headline was only `+3.83`, with a 95% one-sided lower bound of
  `-20.60`; it is unresolved statistically and unacceptable on the observed
  representative regression.
- A follow-up 250k ten-case control isolates the failure mechanism. Removing
  forward-rollout charges leaves the adverse scale choices intact: shifted
  pickup remains `398.94 -> 0`, dense-240 `363.90 -> 0`, and the four
  low-air endurance rows decline by 13--130 points. This is not candidate
  overhead starving a scarce budget; uniform support scaling changes local
  selection into worse basins even when the expensive forward accounting is
  removed. Do not pursue a "cheaper" version of this proposer.
- The temporary source proposer was removed. `scaleArcLines` and the exact
  predecessor/suffix-study support remain study-only tools. A successor must
  derive scale or support duration from an observable local state and show
  stable behavior at both operating budgets before another whole-suite run.

Artifacts: `generated/studies/pickup{-shifted}-s{27,28,29}-g74-whole-scale-a01.json`,
`generated/studies/whole-scale-{control-,}panel-s27-500k-a01.json`, and
`generated/benchmark-v2/{eval/whole-scale-current-2026-07-14.json,
decisions/whole-scale-current-2026-07-14-4bc44425-vs-explicit-base-improvement.json}`
(three exact suffix reads, two ten-case panels at 250k/500k, one free-rollout
control, and one 264-compile probe; roughly 4 minutes). No compiler behavior
changed.

## 2026-07-14: legacy traversal-slack calibration is real but not a policy

- The retained structural completion model is miscalibrated on current V2
  evidence. Across the 251 completed current-probe runs, actual first
  completion was 1.40x the legacy prediction at the median (middle 50%:
  1.35x--1.46x); the completed dense/pickup capability rows needed 2.2x--3.0x.
  The model is therefore unsuitable as a literal claim of remaining search
  capacity, even though its coarse contact/duration ordering remains useful.
- A reversible causal test divided budget slack by 1.4 before the existing
  branch and lane policies. The 30-run, three-seed 250k panel did not support
  that correction: it left dense invalid and made a formerly valid pickup
  seed fail (`376.35 -> 0`), despite isolated mature-row gains. A static
  correction changes allocation; it is not a state-aware feasibility estimate.
- The override was removed. Future budget-aware work must estimate feasibility
  from the live prefix and remaining schedule, with an incumbent-preserving
  panel, rather than retuning this frozen whole-spec scalar.

Artifacts: `generated/studies/slack-scale14-panel-s{24,25,26}-250k-a01.json`
(30 direct compiles, about 25 seconds wall-clock with three workers). No
compiler behavior changed.

## 2026-07-14: live pace taper is not decision-active

- A narrower follow-up retained the base branch policy and, only while an
  incomplete traversal was behind its observed first-completion pace, tapered
  width three to width two. This used the existing online schedule predicate,
  so it was a reversible test of whether refreshed progress alone can repair
  the stale whole-spec slack signal.
- Matched 250k three-seed panels found no usable intervention: 29 of 30 rows
  matched exactly on validity, score, first-completion frame, and reported
  branch limit. The remaining invalid pickup differed only by an immaterial
  `0` versus `0.0001` score. The predicate therefore does not occur in a
  decision-relevant width-three state on this panel.
- The flag was removed. Dynamic feasibility needs a prefix signal that
  distinguishes viable from doomed future states, rather than a late global
  pace predicate or a retuned static slack constant.

Artifacts: `generated/studies/online-branch-taper-{panel,control}-s{24,25,26}-250k-a01.json`
(60 matched direct compiles, about 25 seconds wall-clock with three workers).
No compiler behavior changed.

## 2026-07-14: one-contact scale response cannot select a durable basin

- The whole-arc scale follow-up measured exact current fits, ballistic
  readiness, immediate continuation count, and equal 450k suffixes at the
  paired pickup boundary (seed 27). This corrects an initially misaddressed
  read whose `--target-gap` named the following contact; that read was not
  interpreted.
- On shifted pickup, the locally best scale was `1.10` (readiness `0.177`,
  perfect local air fit), but it stalled at gap 98. Shorter `0.90` and `0.94`
  alternatives, with worse local readiness and fewer or comparable immediate
  continuations, both completed the full suffix (402.49 and 401.32). Normal
  pickup completed at all four scales. Thus neither the current objective,
  ballistic air fit, nor one-step capacity identifies the viable multi-contact
  scale basin.
- Do not add a scale proposer selected by those local quantities. A future
  length coordinate needs a genuinely multi-contact, charged certificate or a
  response model with evidence beyond this paired boundary.

Artifacts: `generated/studies/pickup{-shifted}-s27-g75-whole-scale-{response,suffix-grid}-a0{3,4}.json`
(two corrected response reads and eight equal suffix replays; about 45 seconds
wall-clock with two workers). No compiler behavior changed.

## 2026-07-14: dense recovery needs a distinct flight-phase construction

- At dense seed 24's gap 53, the next nine-frame interval requires three
  grounded frames followed by the detector's minimum six airborne frames. The
  selected prefix has only five. This is an exact physical trace, not a score
  or budget inference.
- We exhaustively replaced the contact-local support over the same parent
  surface. A 735-trial straight-support grid and a matched 735-trial
  three-piece turning support grid both achieved at most five airborne frames.
  Widening the turning grid through terminal turns of plus or minus 90 degrees
  (1,295 exact trials) also achieved at most five. Curves increased locally
  valid fits (198 to 547) but did not cross the detector requirement.
- The support-shape experiment was removed after the read. It cannot justify a
  production curve proposer: the binding short-gap failure is a missing
  flight-phase guarantee, not a missing endpoint angle. A successor should
  construct and verify the required ground-to-flight phase across the contact
  interval, then be evaluated as one continuous policy across short, ordinary,
  and long gaps.

Artifacts: `generated/studies/dense-s24-g53-{straight-support-wide-a02,
curved-support-wide-a01,curved-support-turn90-a01}.json` (2,765 exact
candidate fits; about 12 seconds wall-clock). No compiler behavior changed.

## 2026-07-14: existing detector-runway lane is not the dense recovery path

- A matched `LR_DETECTOR_RUNWAY=0` ablation at dense seed 24, 250k is neutral:
  both runs stall at gap 53 with the same selected geometry and score. The
  predecessor study now carries the lane's existing funnel telemetry so this
  conclusion is inspectable rather than inferred from one aggregate counter.
- On the enabled run, 153 pools had a spacing in the lane's nominal window.
  Twelve were suppressed by an incumbent that already appeared to leave runway;
  of the remaining 141 exact proposals, 139 failed the *current* contact gate.
  Only two candidates were emitted, and neither reached this boundary's
  decision. The issue is not a small ranking adjustment to the old lane.
- A deliberately broad, standalone phase oracle at the failing predecessor
  jointly swept five approach angles, five contact offsets, three pre-contact
  lengths, five post-contact lengths, and five turns (1,875 exact trials). It
  produced zero valid current catches. That construction cannot replace the
  prefix-aware arc family here, so the temporary oracle was removed.

Artifacts: `generated/studies/dense-s24-g53-{runway-on-a02,runway-off-a02,
contact-phase-funnel-a01,contact-phase-grid-a01}.json` (matched 250k compiles
plus the 1,875-trial oracle; about 15 seconds wall-clock). No compiler behavior
changed; the retained telemetry is observation-only.

## 2026-07-14: coupled arc coordinates bridge, but do not yet generalize

- The exact two-coordinate predecessor oracle changes the answer at dense seed
  24, gap 53. Starting from its second captured pool member, small contextual
  whole-arc changes create downstream bridges; the two distinct observed
  geometries both complete all 123 contacts under equal 250k and 500k suffix
  budgets. This is stronger than a one-step count: the complete suffix is the
  outcome.
- The predeclared follow-up is deliberately mixed. Dense seed 25 has 11
  immediate bridges, but only three complete equal 250k suffixes, with a
  different effective tail-pitch correction. Dense-240 seed 25 has one bridge
  and no completing equal suffix. Shifted pickup seed 25 has no bridge at its
  seven-frame terminal boundary. A representative control remains valid and
  was not used to manufacture a failure trigger.
- Therefore do not add a fixed pitch/rotation recovery lane or merely widen
  the existing aiming range. The shared coordinate system is expressive enough
  to reach good dense basins, but neither immediate bridge count nor a fixed
  knob setting is a durable selector. The next design must use a bounded,
  exact multi-contact certificate to choose an existing continuous coordinate,
  and must be panel-tested against these conflicting outcomes before entering
  the compiler.
- The retained two-contact readout still does not distinguish the suffix label:
  an invalid dense-25 variant had 20 immediate next candidates and 15 of those
  continuing one further contact, while a completing sibling had 13 and 10;
  both had a 15-frame runway. The certificate must therefore include an
  explicit bounded outcome beyond this two-contact availability summary, not a
  reweighted count or runway margin.

Artifacts: `generated/studies/{dense-s24-g53-two-step-wide-suffix{250k,500k},
phase-panel-*,phase-knob-{panel,suffix}-*}-a01.json` (ten 250k boundary reads
and 19 equal-suffix replays; about 90 seconds wall-clock). No compiler behavior
changed.

## 2026-07-14: opt-in one-step phase recovery rejected before probe

- A small source experiment exercised the strongest plausible implementation:
  only after every ordinary candidate had failed its charged next-contact
  continuation, it generated at most nine velocity-oriented whole-arc variants
  from the first three contextual bases, admitted only variants with an exact
  charged continuation, and reserved at most one branch. It was opt-in and
  compared on the predeclared 250k panel, never sent to a V2 probe.
- It completed dense seed 24 and dense-240 seed 25, but did not complete dense
  seed 25 or either failing shifted-pickup seed. Crucially, it made dense seed
  26 stall at gap 94 where the unchanged compiler reached gap 101. The family
  therefore trades one future basin for another despite its exact one-step
  admission check.
- The source experiment was removed. This is direct evidence that a
  next-contact certificate is not a sufficient selector; do not retry this
  candidate grid with wider angles, more bases, or more budget. Any successor
  needs a longer bounded outcome certificate that rejects the dense-26 branch
  while retaining the two genuine recoveries.

Artifacts: `generated/studies/phase-recovery-{smoke,panel}-*-a01.json` (eleven
isolated 250k compiles; about 35 seconds wall-clock). No compiler behavior
changed.

## 2026-07-14: start-evaluator breadth does not provide a durable root policy

- The root-basin evidence made the existing charged start evaluator the cheapest
  remaining allocation hypothesis. A mixed ten-case 500k panel compared the
  default `LR_START_EVAL=best:1:5`, the local-proxy fallback, and the adjacent
  charged `greedy:2` form across independent development seeds 27--29 (60
  direct compiles, about five minutes wall-clock at one worker per compile).
- `greedy:2` looked compelling on seed 27 because it recovered shifted pickup
  (`0 -> 388.83`), but it lost 37.30 points on ordinary pickup at seed 28.
  Across the three panels it left the dense failure unchanged and exchanged
  mature-row quality rather than establishing a state-conditioned improvement.
  The proxy fallback recovered shifted pickup on that one panel too, while
  broadly lowering low-air and music quality; it is not a viable simplification.
- The nearest credible breadth member, `best:1:4`, was then screened on the
  entire current V2 stage-0 allocation (264 compiles, 48 workers). Its headline
  was `475.5193` versus the unchanged source control's `475.4729` (+0.0464),
  with the same 251/264 validity. The apparent 250k gain (+0.7912) was offset
  by a 500k loss (-0.2515), and its largest changes were ordinary regression
  rows rather than the capability frontier. This is below the screen's useful
  resolution and has no causal validity improvement.
- Keep `best:1:5`. Do not treat root alternatives or a narrower start rollout
  as a generic allocation fix. Any future root policy must use an observable
  property that predicts a durable basin without trading ordinary pickup,
  dense, or mature trajectories; a fixed evaluator breadth is directly
  contradicted by the panel.

Artifacts: `generated/studies/current-start-eval-{default,off,greedy2}-panel-s{27,28,29}-500k-a01.json`
and `generated/benchmark-v2/eval/start-eval-best14-current-2026-07-14.json`.
No compiler behavior changed.

## 2026-07-14: repair is a material V2 contributor, not free budget

- Current successful but low-quality rows visibly spend large post-completion
  fractions in repair (for example, 177k--288k frames on the sampled
  dense/music rows at 500k). This made a clean current-V2 ablation necessary:
  it tests the phase, not an old V1 conclusion.
- Disabling repair through its documented high minimum-budget override produced
  `468.6683` versus `475.4729` for the unchanged source control (-6.8046) on
  the complete 264-compile stage-0 allocation. Validity was unchanged
  (251/264), so the loss is a broad quality loss rather than a failing-row
  artifact. The 500k score fell 9.3172 points, including high-air energy,
  spacious amplitude, irregular, legacy, and development-music groups.
- Do not recover compute by disabling repair or by globally delaying it. The
  archived V1 margin experiments are consistent negative context, but the V2
  ablation is the controlling evidence here. Any future repair work needs a
  new observed opportunity/value signal, not another global margin scalar.

Artifact: `generated/benchmark-v2/eval/repair-off-current-2026-07-14.json`
(264 compiles, 48 workers). No compiler behavior changed.

## 2026-07-14: ballistic next-speed bias is descriptive, not a rank correction

- A V2-native observation over 24 current 500k runs (eight mixed frontier,
  representative, and music sources; seeds 24--26) compared the zero-frame
  ballistic next-contact read with the following selected arc's measured axes.
  Mean speed is strongly ordered (`r=0.979`, MAE 0.160 px/frame) but is high by
  0.102 px/frame on average. Air is substantially less stable (`r=0.713`
  overall, and worse than the authored ask on `countercurrent` and Believer).
- The speed result justified exactly one predeclared validation, not a fitted
  family: subtract 0.10 px/frame from the mean-speed predictor, leaving the
  physical propagation and every other axis unchanged. On the fresh mixed
  500k panel (seeds 27--29), seed 27 gained 35.11 mean points and recovered
  shifted pickup, seed 28 lost 1.56, and seed 29 lost 67.90 while invalidating
  shifted pickup and dense-240. The apparent calibration changes long-horizon
  basin allocation; it does not monotonically improve the prediction's useful
  decision role.
- The opt-in correction was removed after the panel. Do not tune a global
  ballistic speed offset from selected-path residuals, and do not touch air
  from this observation. A useful successor would need to model the next
  *chosen arc's* entry/catch effect or demonstrate candidate-level outcome
  ordering, rather than correcting a marginal launch-to-free-flight statistic.

Artifacts: `generated/studies/v2-arrival-prediction-panel-s24-26-500k-a01.json`
and `generated/studies/next-speed-corrected-panel-s{27,28,29}-500k-a01.json`
(54 direct compiles plus the observational panel, about five minutes wall-clock).
No compiler behavior changed.

## 2026-07-14: bounded phase outcome does not yet identify a durable basin

- Exact 250k suffix contrasts make the failure concrete. At dense seed 26,
  three phase coordinates from the same predecessor complete the full suffix
  (`-4:-2.5`, `0:-6`, `4:0`), while the locally cheapest `-16:-3` misses one
  contact. At dense seed 25, `8:0` and `12:0` complete, whereas `8:-6` and
  `4:-6` stall at gap 69. Local fit and two-contact coverage are not labels for
  the durable result.
- A new observation-only bounded outcome read keeps the existing generator and
  exact gates, but limits its own retained width. Depth-three/width-two retains
  the dense-26 `0:-6` completion while rejecting dense-25's completing `8:0`.
  Width four reverses the error: it keeps the dense-25 stalled coordinates and
  rejects its completing coordinates. Therefore a fixed short bounded tree is
  not a sound selector for the phase family; no source proposer was added.
- The first all-coordinate suffix invocation retained every engine state and
  exceeded 3 GiB without producing a record, so it was stopped. The
  predecessor study now has explicit coordinate filters for costly suffix and
  bounded-outcome reads, and a hard retained-width bound. Four-coordinate
  contrasts complete in about six seconds with no material memory growth.

Artifacts: `generated/studies/dense-s{25-g53,26-g94}-phase-{contrast-suffix250k,
outcome3-b{2,4}-contrast}-a0{1,2}.json`. No compiler behavior changed.

## 2026-07-14: wider normal bearing jitter is not a robust generator remedy

- A default-neutral experiment widened either the contact-centred approach or
  release bearing in the existing normal sampler; it introduced no new lane or
  selector. Approach scale 1.5 at seed 24 lost a valid shifted pickup, despite
  improving Countercurrent and Believer quality. Release scale 1.6 initially
  recovered ordinary pickup at seed 24, but at seed 25 lost that pickup and
  lowered Believer by 71.28 points; neither form made either dense row valid.
- The controls were removed after the second matched seed. A broader normal
  angle range merely exchanges search basins, so it is not a credible family
  candidate. Future generator work must derive its added coordinate from a
  physical phase state that is demonstrably predictive, not from a global
  jitter multiplier.

Artifacts: `generated/studies/bearing-{control,approach15,release16}-s{24,25}-250k-a01.json`
(30 direct compiles). No compiler behavior changed.

## 2026-07-14: kinematic support is not hidden dense coverage

- The existing kinematic-support proposer was temporarily made available on
  every exact normal forward dead end, instead of only through the separate
  predicted-air-deficit lane. This is a broad state condition and retains the
  existing physical time/speed construction and exact admission gates.
- Dense seed 24 at 250k remained bit-identical in result (stall at frame 1098);
  a matched six-case panel was also unchanged apart from 202 search frames on
  dense-240. The construction does not emit a selectable physical catch at the
  constrained dense boundary, so it cannot be the missing basis.
- The opt-in was removed. Do not broaden kinematic-support activation again
  without an exact candidate-level read showing an admitted dense catch.

Artifact: `generated/studies/kinematic-deadend-{s24-250k,
dense-s24-250k-a01}.json` (seven direct compiles, about 18 seconds wall-clock).
No compiler behavior changed.

## 2026-07-14: exact forward leaf exchanges trajectories rather than improving selection

- The default per-candidate forward rollout uses the scorer-faithful zero-frame
  reconstruction. Its only direct semantic alternative is the full detector
  re-score of the same rollout terminus, so this was screened on the complete
  current stage-0 allocation before proposing any new selector or generator.
- `LR_FWD_EVAL_LEAF=full` produced 476.39 versus the unchanged control's
  475.47 (+0.92), but validity stayed at 251/264 by exchanging a 250k ordinary
  pickup completion for a Believer-impact-relief completion. It also lost up to
  72.48 points on individual valid rows while gaining up to 22.20 on others.
  The headline movement is therefore a mixed basin exchange, not evidence that
  detector re-scoring supplies a generally better branch policy.
- The full leaf also took materially longer than the reconstructed leaf because
  each rollout re-detects its terminus. Keep the reconstruction as the default;
  do not turn this environment switch into production behavior or spend a
  certified confirmation on it. The next question is whether the unchanged
  physical candidate family contains a useful *coupled prefix* that a local
  selector cannot expose.

Artifact: `generated/benchmark-v2/eval/fwd-full-leaf-current-2026-07-14.json`
(264 compiles, 48 workers). No compiler behavior changed.

## 2026-07-14: coupled-prefix reachability is diagnostic, not a budget-feasible policy

- The unchanged generator's three-contact root beam was replayed on two current
  incomplete rows. On shifted pickup seed 27, every retained root sequence
  completed under its independent 450k suffix, whereas the ordinary 500k run
  stalled at gap 90. Dense seed 25 supplied the useful contrast: none of the
  same bounded root sequences completed under a 225k suffix.
- The pickup result is not a candidate policy. Its snapshot is reached after
  16,282 metered frames and the study then gives each suffix a new 450k budget;
  it is deliberately a reachability oracle, not a claim that the combined work
  fits within 500k. The diagnostic therefore confirms a coupled root basin but
  does not justify a macro expansion, a root exclusion, or an uncharged resume.
- A production successor must retain the existing physical stream, spend no
  more than the incumbent's budget, and use a state feature that distinguishes
  this pickup basin from the dense control. The current shallow capacity,
  outcome, and root-breadth features do not do so.

Artifacts: `generated/studies/{pickup-shifted-coupled-root-d3w12,
dense-s25-coupled-root-d3w12}-a01.json` (two observation-only reads). No
compiler behavior changed.

## 2026-07-14: scarce-budget forward-eval removal is compute-negative

- The coupled read made a simple allocation hypothesis falsifiable: preserve
  the normal generator and all mature behavior, but disable per-gap forward
  rollout only below 500k (`LR_FWD_EVAL_MIN_BUDGET=500000`). This directly
  returns rollout frames to ordinary traversal at the operating point where
  capability completion is currently binding.
- The complete stage-0 screen fell from 475.47 to 457.61. The 250k portion
  fell to 394.93 despite one extra valid run (122/132 versus 121/132); quality
  collapsed across representative, dense-musical, and development-music rows.
  The 500k portion was bit-identical by construction. More ordinary expansion
  cannot replace the direction supplied by the charged forward evaluator.
- Keep the 75k forward-evaluation gate. Do not pursue a simple budget threshold
  or a global rollout-off policy; a useful allocation change would need to
  preserve the direction signal while reducing only demonstrably redundant
  probes.

Artifact: `generated/benchmark-v2/eval/fwd-min500-current-2026-07-14.json`
(264 compiles, 48 workers). No compiler behavior changed.

## 2026-07-14: equal-order two-contact start scoring trades endurance for pickup

- The start selector's shallow `best:1:5` shape can prefer an opening brake
  basin before its later consequence is visible. A contained alternative,
  `best:2:2`, evaluates at roughly the same leaf order but carries two contact
  transitions. It was first compared on the balanced ten-case 500k panel,
  rather than sent directly to the full screen.
- It recovered shifted pickup seed 27 (0 -> 388.75), but lowered ordinary
  pickup by 4.43 and every low-air endurance member by 9.80--19.61 points.
  Dense and dense-240 were effectively unchanged, and the other representative
  control was unchanged. The longer root view is therefore a real basin switch,
  not a better universal opening objective.
- Do not run a full screen, promote a deeper start default, or make start depth
  conditional on the pickup-like cadence. The panel supplies the required
  counterexample: no observed root feature distinguishes the desired pickup
  switch from the long low-air regressions.

Artifacts: `generated/studies/start-best{15-control,22}-panel-s27-500k-a01.json`
(20 direct compiles). No compiler behavior changed.

## 2026-07-14: outgoing-speed retargeting is not a stable physical generator rule

- The post-contact arc was sampled with a geometry-only speed ask blended from
  the current landing's authored speed toward the following interval's speed;
  scoring and all acceptance gates remained literal. This hypothesis was
  physically motivated by the 3--7 second low-air ride-outs: their average air
  target is 0.25, versus 0.59 for Countercurrent and 0.62 for Believer.
- A global 0.25 blend initially moved the fixed-seed full screen from 475.47 to
  487.69, but the unseen seed-30 panel exposed large exchanges. A first
  support-weighted form incorrectly used the *incoming* air target and made the
  dense row invalid. Correcting the state alignment to the outgoing interval
  removed that validity failure at 0.25, but still lost 13.35 on shifted pickup,
  19.13 on the 4-second variant, 12.56 on the 6-second variant, and 3.72 on
  Believer. It also gained 13.14 on Countercurrent, so the simple support
  weight does not identify the desired basin.
- Reducing the corrected blend to 0.125 invalidated dense-240 and lost 59.70
  on Countercurrent, despite gains on some endurance variants. This
  non-monotone response falsifies the proposed one-coordinate generator model;
  it is not a candidate for a governed family or a source default. The study
  hook was removed rather than retained as a latent environment switch.

Artifacts: `generated/benchmark-v2/eval/next-speed-geometry-{half,quarter,
eighth,three-eighths}-current-2026-07-14.json` and
`generated/studies/next-speed-geometry-{control,quarter,support,next-support,
next-support-eighth}-panel-s30-500k-a01.json` (matched descriptive screens).
No compiler behavior changed.

## 2026-07-14: two-sided energy targeting is clearer, but still not robust

- The prior next-speed experiment changed the target used by the entire
  contact-centred construction. A narrower follow-up separated the two physical
  jobs: current-target fitting remained literal, while only the post-contact
  energy launch could use the following interval's sampled speed target. Default
  zero was directly parity-checked on Countercurrent (same score, validity, and
  simulated frames at seed 30/500k).
- Full outgoing targeting was better behaved than the earlier whole-geometry
  blend: it improved ordinary pickup (+7.42), shifted pickup (+2.16), dense-240
  (+5.55), 6s (+3.93) and 7s (+39.19) endurance, and Countercurrent (+17.53).
  It nevertheless made dense invalid and reduced Believer by 7.81 points.
- The only predeclared midpoint (0.5) restored dense validity but lost 15.32 on
  shifted pickup, 25.24 on the 4-second endurance variant, and 43.27 on
  Believer. The two strengths therefore do not reveal a stable global region;
  no family or source default is justified. The hook was removed after the
  screen. Its useful result is architectural: future multi-contact generation
  must keep pre-contact fitting and outgoing state construction separate, but a
  next-speed ask alone cannot select a durable trajectory basin.

Artifacts: `generated/studies/outgoing-energy-{default-parity-countercurrent,
next-speed,next-speed-half}-panel-s30-500k-a01.json` (21 direct 500k compiles).
No compiler behavior changed.

## 2026-07-14: repair needs its existing upstream reach

- The post-completion repair phase is a broad, globally judged and budget-charged
  mechanism, so its upstream restart breadth was checked before proposing a new
  repair selector. The cheapest falsifier set `LR_REPAIR_MAX_UPSTREAM=0`, which
  retains only the weakest affordable contact anchor and otherwise leaves the
  compiler unchanged.
- On the balanced unseen 500k seed-30 panel, this lost 9.15 points on 6-second
  endurance and 6.24 on Believer, while producing no validity gain. Most other
  rows were bit-identical; the apparent +1.34 Countercurrent movement does not
  offset the replicated quality losses. The default upstream walk is therefore
  a useful existing repair capability, not excess allocation to remove.
- The symmetric wider endpoint, `LR_REPAIR_MAX_UPSTREAM=8`, was inert: nine
  rows were bit-identical and pickup changed by -0.02. The current four-anchor
  bound is therefore sufficient on this panel; neither direction justifies a
  repair-breadth family.

Artifacts: `generated/studies/repair-upstream{0,8}-panel-s30-500k-a01.json`
(twenty direct 500k compiles, about 90 seconds wall-clock). No compiler behavior changed.

## 2026-07-14: flight-conditioned outgoing speed also exchanges basins

- The narrower two-sided energy model was given its strongest physically derived
  gate: only the following interval's airborne flight time can activate speed
  retargeting. The blend ramps from the detector's six-frame minimum landing
  flight over one 24-frame cadence, so dense supported contacts do not receive
  a ballistic correction. The default-off path was again exact on the direct
  Countercurrent parity read and focused tests.
- On the same unseen 500k panel, this did improve dense (+12.58), 7-second
  endurance (+13.78), and Countercurrent (+20.34), but it invalidated shifted
  pickup and dense-240. It also reduced the base long-endurance row and
  Believer. A flight-time gate therefore does not make next-speed retargeting a
  stable generator rule; it merely relocates the basin exchange.

Artifacts: `generated/studies/outgoing-energy-flight-default-parity-countercurrent-s30-500k-a01.json`
and `generated/studies/outgoing-energy-flight-panel-s30-500k-a01.json` (eleven
direct 500k compiles). No compiler behavior changed.

## 2026-07-14: repair's leaf comparator already matches the valid-run scorer

- The repair loop records that its register accepts a passing rebuild by
  `axis_quality` rather than the report's `full_score`, so this was checked as
  a possible global scoring-alignment defect. It is not one: for a passing
  report, drift, missing, off-beat, and survival quality are all exactly one,
  making `full_score = 1000 * axis_quality` by definition.
- Changing the comparator would therefore be semantic churn with no effect on
  valid repair ordering. The remaining weakness is candidate/state coverage,
  not a disagreement between repair acceptance and the benchmark score.

## 2026-07-14: three-contact phase survival is not a selector

- A fresh bounded phase read tested the exact next proposed certificate rather
  than installing another recovery lane. At the dense seed-24 recovery
  boundary, six of the nine current-valid phase variants had an exact
  two-contact continuation after the altered contact. This includes the known
  `pitch=8, rotate=-3` recovery, so the certificate has the required positive
  signal.
- The known one-step recovery counterexample is stronger: at dense seed 26's
  later failure boundary, 24 of 107 exact phase variants survived the same
  two-contact continuation read. A three-contact existence test would activate
  there more often, not less often, than on the desired recovery. Its shared
  partial leaf was also numerically zero at these early prefixes, so it cannot
  rank those alternatives without introducing an unrelated surrogate.
- Consequently, do not promote three-contact survival, retained beam width, or
  the current partial leaf as a phase-recovery selector. The temporary coupled
  beam harness was discarded; it repeated the same non-specific signal.

Artifacts: `generated/studies/dense-s{24-g53,26-g94}-phase-outcome3-a02.json`
(two isolated 250k reads, about 12 seconds total). No compiler behavior changed.

## 2026-07-14: Believer impact loss is both coverage and continuation

- A read-only 250k, three-seed funnel on the non-impact Believer development
  case separated missing turn geometry from selection. Of 252 impact-targeted
  contacts, 128 (51%) never generated a candidate with the turn implied by the
  target, 25 (10%) generated one that failed filtering, and 97 (38%) admitted
  such a candidate but did not select it. Only two contacts met the necessary
  turn condition in the selected track.
- The admitted impact oracle is large: mean selected absolute impact error was
  0.38, versus 0.08 for the closest admitted candidate, on 225 materially
  different contacts. But those candidates are not safely interchangeable:
  their mean handoff percentile is 0.30 and the prior Pareto study shows a
  substantial next-contact readiness cost. A global impact tie-break would
  therefore repeat an already falsified basin trade.
- A credible successor must be a continuous contact-to-launch construction that
  covers the missing high-turn shapes and evaluates their coupled continuation.
  Do not change a ranking weight or add a Believer/cadence special case.

- The matched representative Countercurrent read has the same admitted-impact
  oracle but a different split: only 26% of contacts lack the required turn and
  66% lose at ranking. This is useful external evidence that the mechanism is
  not Believer-specific, while also ruling out a single coverage-only fix.

Artifact: `generated/studies/believer-impact-funnel-s24-26-250k-a01.json`
and `generated/studies/countercurrent-impact-funnel-s24-26-250k-a01.json`
(six isolated compiles, 17 seconds wall-clock). No compiler behavior changed.

## 2026-07-14: deeper bounded survival reverses the dense signal

- The rejected three-contact phase certificate was extended, without changing
  production, from two to four subsequent contacts on the same positive and
  counterexample boundaries. This is a direct test of whether more horizon
  resolves the earlier ambiguity.
- It does not. All nine current-valid altered candidates at dense seed 24's
  desired recovery boundary died by the third subsequent contact. Conversely,
  five variants at dense seed 26's known bad boundary survived all four
  contacts (with 2--16 bounded survivors). Thus no threshold on bounded
  survival through at least four contacts can select the desired correction.
- Do not add a deeper survival gate, a phase-certificate retry, or a
  continuation-depth knob. The next dense mechanism must change the trajectory
  construction or state representation, not search farther along the current
  local-coordinate family.

Artifacts: `generated/studies/dense-s{24-g53,26-g94}-phase-outcome5-a01.json`
(two isolated 250k boundary reads, 15 seconds wall-clock). No compiler behavior changed.

## 2026-07-14: early phase re-centering is insufficient construction

- The normal contact-centred arc sampler was re-evaluated one and two frames
  before the authored contact while retaining the actual contact gate, local
  objective, and suffix state. The prediction was that a phase-relative centre
  could move the dense-24 release from its one-frame airborne run to the
  detector's six-frame minimum.
- It did not: one-frame re-centering produced at most four airborne frames and
  two-frame re-centering produced none. Neither generated a next candidate.
  On the dense-26 counterexample, the same one-frame construction removed all
  the existing next continuations except the original selected path.
- Do not add an early-centre sampler or a fixed phase offset. The missing dense
  behavior is not an anchoring error in the existing arc geometry; it requires
  an explicit, exactly verified grounded-to-flight trajectory construction.

Artifacts: `generated/studies/dense-s24-g53-phase-early{1,2}-a01.json` and
`generated/studies/dense-s26-g94-phase-early1-a01.json` (three isolated 250k
boundary reads, 10 seconds wall-clock). No compiler behavior changed.

## 2026-07-14: surviving the 500k dense prefix still needs 500k-scale search

- Dense seed 24 completes at 500k, but its first divergent successful prefix
  at gap 18 cannot simply be preserved under the 250k allocation. An exact
  snapshot control from that selected prefix completes with a fresh 500k suffix
  (123 contacts, 368.03), while the same state with a 250k suffix reaches only
  gap 81 and fails the oracle's incumbent-replay requirement.
- This is not evidence for a prefix reservation or uncharged suffix. It rules
  out the narrower claim that the 250k failure is solely caused by selecting
  the wrong early route: the known 500k route still requires materially more
  search after its early prefix.

Artifacts: `generated/studies/dense-s24-500prefix-g19-suffix500-control-a01.json`
and the refused 250k suffix invocation (about 18 seconds total). No compiler
behavior changed.

## 2026-07-14: symmetric support timing is a near-miss, not a dense solution

- A new frozen-prefix support-regime oracle compares alternate time-normalized
  support constructions from the exact default dense seed-24 gap-53 parent;
  it does not let an alternate regime alter the earlier prefix. The production
  `shape-time-deficit` pool has four viable current catches, no next bridge,
  and at most three airborne frames at the following nine-frame contact.
- Fully time-normalized support makes a real local change: one candidate has a
  32.81px tail, five airborne frames, and 43 ordinary next candidates. It is
  still one frame below the detector's six-frame requirement. The intermediate
  span reaches four frames; no tested regime yields a detector-ready catch.
- Most importantly, the five-frame bridge is not a durable basin. An exact
  suffix from that candidate with the 107,840 frames actually remaining at the
  captured parent stalls at gap 70. Do not add symmetric support timing, a
  one-frame detector relaxation, or a support-regime retry from this evidence.

Artifact: `generated/studies/dense-s24-g53-support-regime-oracle-suffix107840-a01.json`
(one 250k prefix plus one bounded suffix, about 8 seconds). The reusable
`study_support_regime_oracle.ts` is observation-only; no compiler behavior
changed.

## 2026-07-14: the current continuous support model spans the 4--7s family

- At 500k, the existing `shape-time-deficit` construction completed the 4s,
  5s, 6s, and 7s low-air ride-out variants for seed 24. This is a coverage
  check, not a selection result: the four scores remain 492.22, 476.57,
  489.80, and 501.06 respectively, so it does not establish an improvement
  over the current source.
- The result supports retaining a duration-continuous support formulation. The
  next question is whether its candidate coordinates cover physically useful
  support shapes without exchanging ordinary behavior; that requires a
  predeclared control panel before any source change.

Artifact: `generated/studies/support-geometry-current-4to7-s24-b500-a01.json`
(four direct 500k compiles, about 18 seconds wall-clock). No compiler behavior
changed.

## 2026-07-14: support-coordinate crossover exchanges ride-out durations

- The 16-step span grid binds each support-scale coordinate to a restricted
  subset of launch/length points. A temporary second-cycle crossover retained
  attempts 0--15 and changed only repeated attempts 16--31 to complementary
  support scales. This was a general candidate-coverage experiment, not a
  duration-specific rule.
- On a fixed seed-24, 500k panel, all eight ordinary controls were bit
  identical, but the 4--7s family split: 4s lost 17.12, 5s gained 22.80, 6s
  gained 14.17, and 7s lost 3.61. The +1.35 panel mean is therefore a
  cancellation, not robust evidence. The temporary schedule was removed;
  no family or source change is justified.

Artifacts: `generated/studies/support-scale-{default,cross}-{frontier,controls-a,controls-b}-s24-b500-a02.json`
(twenty-four direct 500k compiles, about 2 minutes wall-clock). No compiler
behavior changed.

## 2026-07-14: normal and support-bridge pairs lack a durable dense certificate

- A bounded two-contact expansion from the actual dense-24 gap-52 prefix has
  only two exact normal current candidates and zero exact second-contact
  children. Ranking by the existing partial-prefix value or by summed exact
  local cost is therefore equally inert at the binding boundary. This confirms
  that a policy-only pair ranker cannot recover missing trajectory material.
- The only alternate support bridge is the time-normalized candidate (attempt
  36): it leaves five airborne frames and 43 ordinary children. Its unpaired
  suffix stalls at gap 70. The lowest combined-cost two-contact child reached
  gap 112 under a 107,840-frame diagnostic suffix, but none of the first four
  such pairs completed under a 250k suffix; the same pair then stalled at gap
  75. That budget-sensitive reversal means combined local cost is not a
  durable outcome certificate.
- No paired proposer or selector is warranted. The useful conclusion is
  narrower: normal local pair expansion has no material at the dense boundary,
  while the alternate bridge needs an outcome signal stronger than two local
  fits. Do not promote an uncharged diagnostic pair.

Artifacts: `generated/studies/dense-s24-g53-pair-{prefix-value,joint-local-cost}-a01.json`
and `generated/studies/dense-s24-g53-time-support-pair-{a01,suffix250-a02}.json`
(four bounded baseline/suffix studies, about 20 seconds wall-clock). No compiler
behavior changed.

Workflow friction: `study_dense_cycle.ts --help` previously executed its
default 250k experiment. It now exits after printing usage; focused arc-model
and kinematic-support tests pass.

## 2026-07-14: extending the existing aim rotation span is inert

- The successful dense-24 oracle uses a `-3deg` whole-arc rotation, while the
  accepted five-row joint-response design samples only `+/-2.5deg`. A
  reversible source-only smoke test expanded that exact design and its
  enumeration span to `+/-3deg`; it left the frozen 250k dense-24 compile
  invalid with score zero.
- This rejects the cheap explanation that the current joint aimer merely
  excludes the first viable rotation. Its five-probe fit, scoring gate, or
  downstream search allocation fails to turn that added coordinate into a
  durable trajectory. The temporary source change was removed immediately.

Artifact: `generated/studies/dense-s24-aim-rotate3-smoke-a01.json` (one
250k compile, 3.1 seconds wall-clock). No compiler behavior changed.

## 2026-07-14: a higher-order aim fit is also not the dense solution

- The preceding span result left open one specific explanation: `cross5`
  cannot identify pitch/rotation interaction. The existing `grid9` design both
  fits that interaction and directly samples the oracle's nearby `pitch=9,
  rotate=-3` coordinate.
- A reversible one-compile `grid9` smoke test still left frozen dense-24
  invalid at 250k (zero score, 250,736 simulated frames). Extra local probes
  therefore do not turn the available coordinate into a selected, durable
  path. The source default was restored.

Artifact: `generated/studies/dense-s24-aim-grid9-smoke-a01.json` (one 250k
compile, 3.2 seconds wall-clock). No compiler behavior changed.

## 2026-07-14: richer aim fitting spends more without exposing dense material

- The fixed-seed aim funnel was added to the balanced-panel study before
  repeating the default and `grid9` dense-24 runs. `cross5` emitted 682 aimed
  candidates (631 rotational) from 2,330 probe rows and charged 35,227
  simulation frames. `grid9` emitted 679 (595 rotational) from 3,942 rows and
  charged 60,912 frames.
- `grid9` did reduce degraded response outputs (882 to 280), but it did not
  reveal a material proposal deficit and still failed the contract. Its extra
  25,685 charged frames displace the search the 250k case needs. The missing
  mechanism is neither a narrower span nor a higher-order local fit.

Artifacts: `generated/studies/dense-s24-aim-{baseline-funnel-a01,grid9-funnel-a02}.json`
(two 250k compiles, 6.2 seconds wall-clock). No compiler behavior changed.

Workflow friction: `study_branch_width_panel.ts` now treats `--help` as a
side-effect-free usage request and includes existing aim telemetry in its
output. This makes temporary source trials explainable without widening their
behavioral surface.

## 2026-07-14: dense failures are early trajectory-basin failures

- A matched 250k/500k selected-path comparison across dense seeds 24--26
  shows the two searches first diverge at contacts 18, 17, and 45,
  respectively. The visible 250k stalls happen much later (gaps 53, 53, and
  101). The 500k route is not a late recovery of the same prefix.
- The first divergent routes differ in ordinary sampled contact-centred arcs:
  support duration, release frame, release angle, and chosen rank all change.
  No common scalar correction is visible. This validates the earlier negative
  continuation studies: a terminal phase patch cannot robustly reproduce a
  basin selected tens of contacts earlier.
- Future work must improve early trajectory-basis coverage or preserve a
  genuinely distinct early state under the fixed budget. It must not add
  another g53-specific tail, detector, or local aim policy.

Artifacts: `generated/studies/dense-s{24,25,26}-path-250-500-a02.json` (six
independent compiles, 18.7 seconds wall-clock). No compiler behavior changed.

Workflow friction: `study_dense_path_compare.ts` now has a side-effect-free
`--help` path.

## 2026-07-14: mature geometry is already present in the scarce dense pool

- At the winning dense-24 prefix before contact 18, the 500k route's ordinary
  attempt-28 trajectory is reproduced byte-for-byte when sampled at 250k: a
  61.29px, three-segment arc with twelve immediate children. Re-sampling the
  same frozen prefix with a temporary 500k geometry budget produced the same
  32 candidate geometries and gates as the 250k basis. There is no missing
  mature-budget geometry to inject at this boundary.
- On the actual winning 250k prefix, that attempt is already pool rank 2 while
  the selected attempt-22 route is rank 5. Equal 450k suffix replays complete
  both paths (364.15 and 359.30). Thus neither a budget-geometry basis nor a
  local rank replacement has the required causal label: both are viable early
  basins under enough downstream search.
- Do not add a dual-budget geometry lane or promote attempt 28. The remaining
  problem is allocation among multiple early basins over many later contacts,
  which cannot be inferred from one current candidate, immediate capacity, or
  an equal long suffix.

Artifacts: `generated/studies/dense-s24-g18-{budget-geometry-basis,
winning-pool,winning-suffix450}-a01.json` (four bounded compiles, 17.4 seconds
wall-clock). No compiler behavior changed.

## 2026-07-14: early dense choice has scarce-budget value, but is not sufficient

- Replaying the same two winning-prefix candidates with an independent 250k
  suffix gives a directional, but incomplete, outcome: available attempt 28
  reaches gap 81, whereas the selected attempt 22 reaches gap 53. Neither
  completes. At 450k both complete, so the distinction is a scarce-budget
  trajectory value rather than immediate physical feasibility.
- This is the first direct evidence that a useful early-basin value exists at
  the operating point. It does not justify forcing attempt 28: one labelled
  pair is not a general state policy, and the better route still dies without
  further allocation. A future mechanism must estimate a bounded,
  multi-contact scarce-budget value across a mixed panel and charge that work;
  it cannot be a rank-2 preference or a dense-specific override.

Artifact: `generated/studies/dense-s24-g18-winning-suffix250-a02.json` (two
independent suffix compiles, 7.5 seconds wall-clock). No compiler behavior
changed.

## 2026-07-14: scarce dense outcome is not stable under a two-arm branch choice

- The predecessor oracle now supports an explicit fixed-prefix suffix-search
  portfolio, keeping authored jitter, the parent, and candidate geometry fixed
  while recording alternate search streams separately. This is a measurement
  tool, not a seed-selection mechanism.
- On dense-24's early rank-2/rank-5 contrast at 250k, attempt 28 reaches gaps
  81, 72, and 73 for search seeds 24--26. The selected attempt 22 reaches 53,
  60, and 114. Neither candidate dominates, and neither completes. The
  apparent rank-2 advantage from one suffix is therefore not robust.
- Do not add a local rank preference, a two-arm selector, or a fixed search
  portfolio. A credible multi-contact allocator would need a pre-commit value
  estimate that is predictive across independent prefixes and specifications;
  this two-candidate, three-stream read is direct evidence that local outcome
  is too variable for a deterministic shortcut.

Artifact: `generated/studies/dense-s24-g18-suffix-portfolio250-a01.json` (six
independent suffix compiles plus one parent compile, 20.7 seconds wall-clock).
No compiler behavior changed.

Workflow improvement: `study_predecessor_coverage.ts` now provides the
side-effect-free `--suffix-search-seeds` portfolio read, with each search seed
recorded in the result instead of being conflated with the authored seed.

## 2026-07-14: three dense early-basin portfolios reject a cheap value estimator

- The same 250k, three-stream suffix portfolio was repeated at the first
  scarce/high-budget divergence for dense seeds 25 and 26. Seed 25's selected
  path completes under search seed 24 while its alternate never completes;
  seed 26 reverses that result, with the alternate completing under seed 24
  and the selected path reaching gap 114 only under seed 25. Dense-24 had no
  completion in either arm and reversed by deepest progress.
- No candidate has a consistent win by completion, deepest gap, immediate
  capacity, readiness, or rank across the three independent prefixes. One or
  two fixed-cost rollouts would therefore be an uncalibrated random choice;
  enough rollout replication to estimate a useful value consumes the budget
  that the candidate must use to finish the track.
- Do not implement a two-arm sparse-budget value policy, a rollout-count
  switch, or a dense-specific prefix selector. The next viable direction must
  change the search representation or geometry basis so that durable outcomes
  are less seed-sensitive, rather than attempting to estimate unstable outcomes
  from an unaffordable sample.

Artifacts: `generated/studies/dense-s{25-g17,26-g45}-suffix-portfolio250-a01.json`
(twelve independent suffix compiles plus two parent compiles, about 27 seconds
wall-clock). No compiler behavior changed.

## 2026-07-14: seeded low-discrepancy sampling does not improve dense coverage

- A new observation-only sampler-basis read regenerates the ordinary 32-candidate
  pool from the actual winning dense-24 prefix, changing only the eight normal
  random rolls to a seed-rotated Halton basis. It retains the normal geometry
  formula, exact admission gate, and ordinary next-pool sampler.
- The current pseudorandom basis admits 32 current candidates, with nine having
  immediate children (mean 2.97 children, maximum 26). The Halton basis also
  admits 32 but leaves only five with children (mean 2.34, maximum 22). It
  therefore fails the cheapest generator-coverage criterion before any source
  change or balanced panel is warranted.
- Do not replace the normal stream with this low-discrepancy sequence. It may
  be aesthetically uniform in coordinate space, but that does not translate to
  physical continuation coverage in the current nonlinear generator.

Artifact: `generated/studies/dense-s24-g18-halton-basis-a02.json` (one 250k
prefix compile plus two exact 32-candidate basis reads, 3.3 seconds wall-clock).
No compiler behavior changed.

Workflow correction: the budget-geometry basis observer now binds its prefix to
the eventual winning path rather than the first frontier arrival. Its earlier
first-arrival Halton record is discarded.

## 2026-07-14: repair is useful but budget-limited, not a ready selector target

- A 500k repair panel on dense dialogue and open hook, each at seeds 24--26,
  completed 6/6 contracts. Dense accepted one restart (+1.11 score) in three
  runs; open hook accepted three (+0.87, +4.70, and +9.12). This confirms that
  completion-triggered repair can recover real quality after a complete path
  exists.
- It is not a simple policy lever. Across the panel, only 2--5 restart records
  per compile received any simulation frames before the repair allocation was
  spent. The many later zero-frame records are cheap infeasible tail probes,
  after which normal frontier search resumes. There is no evidence that a
  different fixed weak-gap order, upstream depth, or retry count would improve
  all cases rather than exchange the few productive restarts.
- Do not change repair selection from this six-run panel. The next repair study,
  if pursued, must predeclare a cross-case predictor for productive restarts
  and measure it against fresh seed/case observations; it cannot infer a rule
  from the accepted restarts alone.

Artifacts: `generated/studies/repair-{dense-dialogue,open-hook}-s24-26-a02.json`
(six independent 500k compiles, 30.2 seconds wall-clock, peak post-GC RSS
426 MiB in the longest process).

Workflow improvement: `study_v2_repair_diagnostics.ts` now has side-effect-free
`--help`, atomic per-row checkpoints labelled complete/incomplete, optional
`--records` causal capture without per-restart terminal spam, and post-compile
RSS reporting. The previous all-in-one panel produced no result file; the
cause was not established, so future multi-case diagnostics should remain
sharded until the memory profile is characterized.

## 2026-07-14: detector-timed tail shortening is not sufficient trajectory control

- A focused, exact control retained each selected candidate's valid approach
  and shortened only its post-contact tail by the measured number of frames
  required to reach the detector's six-frame flight floor. This is a direct
  test of release-time feedback, not a rank or cadence rule.
- At dense seed 24/gap 53, the required four-frame shortening invalidated two
  of three sampled catches. The remaining current-valid catch moved from one
  to four airborne frames at the next target and still had no next candidate.
  At shifted pickup seed 27/gap 90, all eight sampled catches became invalid
  under the corresponding three- or four-frame shortening.
- Do not add a tail-length feedback lane or a release-frame controller based on
  these traces. The missing phase cannot be created by truncating a valid
  support alone; a viable successor must jointly construct the catch and its
  release state while retaining exact current-contact validity.

Artifacts: `generated/studies/{dense-s24-g53,pickup-shifted-s27-g90}-tail-release-control-a01.json`
(two frozen-prefix reads, 4.8 seconds wall-clock). No compiler behavior changed.

## 2026-07-14: oldest feasible repair anchor wins a controlled family comparison

- Hypothesis: when a completed track has a weak contact, retrying the oldest
  feasible upstream anchor first can change the inherited arrival at that
  contact. The existing nearest-first walk instead spends the same bounded
  repair allocation on the most local restart before considering that cause.
  This is a traversal-order change only: retry count, seeds, feasibility gate,
  repair budget, and ordinary frontier search are unchanged.
- Cheap paired diagnostics first compared both orders on six 500k runs
  (countercurrent, dense dialogue, believer 56.6s, and low-air endurance;
  seeds 30--32), then on twenty more runs over ten cross-stratum cases
  (seeds 33--34). All contracts were valid. The combined direct evidence was
  positive but heterogeneous (mean +6.21; median +0.40), so it was insufficient
  to choose a default on its own.
- A full fixed-seed stage-0 screen with source-baked oldest-first was also
  positive: 480.80 versus 475.47 for the current control (+5.33 headline),
  with identical 251/264 validity. This remained only a screen, not a decision.
- The governed `repair_anchor_order` family then froze source-baked nearest and
  oldest members and ran both, plus the frozen baseline, on the same fresh four
  seeds/budget (1,056 total compiles, `--jobs=48`, approximately five minutes
  wall-clock). Oldest was the observed champion at 479.17 versus 474.30 for
  nearest: paired oldest-minus-nearest +4.87, with a 95% one-sided interval
  [3.94, 5.80]. It won at both 2- and 4-seed prefixes with no ranking reversal.
  Both variants had the same 335 valid outcomes, so oldest caused no incremental
  validity loss relative to nearest.
- Selected `oldest` descriptively with `npm run benchmark -- family select
  repair_anchor_order --variant=oldest`. This is not a baseline promotion:
  the family report explicitly remains exploration-only, and the currently
  stale decision contract plus era budget prevent `eval --to-verdict`. Before
  any promotion, run a fresh certified epoch after the required governance
  migration; inspect the per-stratum/qualification result rather than relying
  on this selection study.

Artifacts: `generated/studies/repair-order-{nearest,oldest}-{panel,broad}-*.json`,
`generated/benchmark-v2/eval/repair-order-oldest-current-2026-07-14.json`, and
`generated/benchmark-v2/families/repair_anchor_order/round-001/report.json`.

## 2026-07-14: refreshed impact funnel rejects a local tie-break

- The current 500k source was measured on three fresh seeds across the two
  Believer impact cases, dense-dialogue impact contrast, and Countercurrent
  (4,027 exact prefix pools). The gap is real: selected mean absolute impact
  error is 0.357/0.348 on the Believer cases, while the raw closest candidates
  are 0.114/0.112.
- A superficially attractive rule also fails the necessary causal check. At
  zero permitted one-step-readiness loss, 107 and 112 Believer pools contain a
  materially impact-closer candidate whose current scorer-window RMS is no
  worse; all but one are already in the eight-member admitted pool. Yet none is
  forward-rank 0, and only 36/45 enter the three-wide branch. The charged
  forward evaluator's additional horizon is therefore observing a real
  downstream trade that a current-impact/readiness tie-break would erase.
- Do not change the local impact weight, add a no-readiness-loss tie-break, or
  widen the impact-template rate from this result. The remaining impact work
  needs a genuinely coupled contact-to-launch construction with an exact
  downstream outcome, not a replacement for the current forward evaluator.

Artifact: `generated/studies/impact-readiness-current-mixed-s30-32-a01.json`
(twelve isolated 500k compiles, about 55 seconds wall-clock). No compiler
behavior changed.

## 2026-07-14: protocol migration restores a current decision contract

- The snapshot-overlay repair and exploratory-family contract boundary changed
  only execution/governance protocol. Their review evidence is bit-identical
  baseline replay; the decision inference and calibration identities are
  unchanged. The required approved protocol migration completed its seven-file
  conformance subset and re-stamped the baseline contract.
- `npm run benchmark -- status` now reports `decision contract: current`.
  It also correctly refuses both certified rows: the active era has spent
  0.0418/0.05, while the lightest remaining certified attempt costs 0.0144.
  This is not bypassed for a descriptive family selection. Only a governed
  accept ends an era; a transition rebaseline deliberately does not reset it.
- Continue cheap development screens/families, but do not call
  `eval --to-verdict` until there is either an authorized, ledgered risk
  override for a genuinely mature candidate or an era-ending accepted result.

## 2026-07-14: extending oldest-first repair beyond four anchors is neutral

- Repair records made one bounded range extension testable: under oldest-first,
  the current `up=4` edge accounted for 25/37 accepted restarts across the two
  preceding panels. `LR_REPAIR_MAX_UPSTREAM=6` therefore tests whether the
  boundary, rather than the ordering, is clipping useful inherited-arrival
  repairs. No source default changed for this diagnostic.
- On the broad twenty-run panel (ten mixed sources, seeds 33--34), the
  extension was +2.66 mean but only +0.18 median, with five losses. A disjoint
  twelve-run panel (four sources, seeds 30--32) replicated activity at offsets
  five and six (+3.40 mean, +1.21 median; 8 gains, 4 losses), with no validity
  changes in either panel. The signal was sufficiently mixed to require one
  fixed-seed full screen rather than a family capture.
- The 264-compile stage-0 screen was effectively neutral versus source-baked
  oldest-first/max-4: canonical 480.90 versus 480.80 (+0.10), 250k -0.18,
  500k +0.21, and identical 251/264 validity. It exchanges ordinary quality
  between sources without improving the capability frontier. Retain the
  current bounded maximum of four; do not add max-6 as a family member or
  promote it.

Artifacts: `generated/studies/repair-upstream6-oldest-{broad-s33-34,panel-s30-32}-a01.json`
and `generated/benchmark-v2/eval/repair-upstream6-current-2026-07-14.json`
(32 direct 500k compiles plus one 264-compile screen; about three minutes
wall-clock). No compiler behavior changed.

## 2026-07-14: upcoming contact density is descriptive, not yet a policy signal

- The dense-path diagnostic now records the authored current and four-contact
  future timing schedule independently of selected geometry. Replaying the
  250k/500k path pair on dense seed 24 shows the first differing candidate at
  gap 18, directly before an 11/12-frame figure; seed 25 differs at gap 17,
  one ordinary gap earlier. This is compatible with a trajectory basin needing
  preparation before a figure, rather than a local catch failure.
- The third independent seed falsifies a cadence-only explanation: its first
  divergence is gap 45 during ordinary 22/23-frame cadence, before a later
  nine-frame figure, and its 250k path actually reaches two gaps farther than
  its 500k path. Only seed 24 completes at 500k; seeds 25 and 26 remain
  invalid at both budgets.
- Do not add a density threshold, dense-run detector, or pre-figure candidate
  multiplier. The timing signal is useful diagnosis, but it neither predicts a
  stable winner nor separates the two failure modes. The next credible work is
  a representation or geometry-basis change with a cross-case physical
  coverage criterion, not another cadence-specific search-allocation rule.

Artifacts: `generated/studies/dense-current-s{24,25,26}-path-250-500-a03.json`
(six paired 250k/500k compiles, about 22 seconds wall-clock). No compiler
behavior changed.

## 2026-07-14: retained mature-budget curvature is a basin exchange

- The normal contact-centred generator already has a continuous post-arc
  curvature coordinate, but its ordinary span fades from full at 50k to zero at
  100k. A reversible study retained a small floor of that same coordinate at
  250k/500k. It changed no literal target, ranker, evaluator, or physics gate.
- On a ten-case 500k panel (seed 30), floor 0.5 made shifted pickup invalid
  (399.66 -> 0.00); the predeclared smaller 0.1 endpoint preserved validity but
  exchanged pickup (-4.16), shifted pickup (-5.51), and Countercurrent
  (+10.70), with every dense and low-air row unchanged. On the matched 250k
  panel (seed 24), floor 0.1 recovered no invalid capability row and reduced
  Countercurrent by 41.82 points.
- Remove the hook. The old fade-out is not merely an outdated operating-point
  constant: retaining this coordinate changes mature ordinary basins while
  failing to produce the missing dense/pickup material. Do not tune an
  intermediate floor or add it to a governed family.

Artifacts: `generated/studies/normal-curve-floor{0,01,05}-panel-s30-500k-a01.json`
and `generated/studies/normal-curve-floor{0,01}-panel-s24-250k-a01.json`
(four ten-case direct panels, about 90 seconds wall-clock). No compiler
behavior changed.

## 2026-07-14: pre-contact curvature needs a representation change, not a span

- A separate, continuous approach-curve coordinate was tested without changing
  either endpoint, total approach length, scoring, or search allocation. It
  redistributes the angular turn across the segments immediately before a
  contact, so it would have been a genuinely different geometry basis rather
  than another cadence or case detector.
- The deterministic unit witness confirms that the transform changes geometry
  when an approach contains internal segments. On the predeclared ten-case
  500k mixed panel, however, both a substantial 0.5 span and the maximum 2.0
  span were bit-identical to the source compiler: all ten tracks, scores,
  validity outcomes, and simulated-frame counts matched exactly. The actual
  selected approaches are too short/coarsely segmented for an interior
  curvature coordinate to exist.
- Remove the study hook rather than retain a permanently inactive knob. A
  future approach-shaping proposal must first change the *representation* of
  short incoming geometry while preserving the physical contact boundary; only
  then does a curvature distribution become a meaningful family. Do not tune
  this span or interpret the zero effect as evidence against representation
  work itself.

Artifacts: `generated/studies/precurve-span{05,2}-panel-s30-500k-a01.json`
(two ten-case direct panels, about 50 seconds wall-clock). No compiler
behavior changed.

## 2026-07-14: unconditioned richer approaches are not a dense solution

- The inactive-curvature result suggested one representation-level follow-up:
  short approaches often resolve to one segment, so the nominal pre-contact
  turn cannot exist geometrically. The smallest richer representation is three
  segments. It retains the sampled endpoints, total approach length, normal
  gate, objective, and all traversal logic; it only exposes the interior turn.
- A global three-segment replacement was strongly negative on the predeclared
  ten-case 500k panel: shifted pickup and dense became invalid, 8/10 remained
  valid, and the mean fell 78.40 points. A distinct portfolio test allocated
  the richer representation to two of every eight deterministic normal samples
  while leaving the incumbent representation available. It too invalidated
  dense and dense-240, with a 74.60-point mean loss despite local pickup and
  Countercurrent gains.
- Remove both hooks. More segments alone alter the contact/release trajectory
  in the wrong direction; a future multi-contact construction must solve the
  approach and grounded-to-flight transition jointly under exact physics. Do
  not add a resolution floor, sample share, or small family around them.

Artifacts: `generated/studies/pre-segment-floor3{,-share25}-panel-s30-500k-a01.json`
(two ten-case direct panels, about 50 seconds wall-clock). No compiler
behavior changed.

## 2026-07-14: contact-time-normalized forward horizon is a basin exchange

- A fixed depth-two forward rollout observes only 18 frames through a 9/9
  figure but roughly 45 at ordinary cadence. An opt-in experiment therefore
  extended the unchanged default greedy evaluator to depth three only when its
  next two contacts covered fewer than 40 physical frames. Candidate geometry,
  scorer, branch width, and charged simulation accounting were unchanged.
- On the matched ten-case 250k panel, both dense failures and every frontier
  validity outcome were unchanged; only Believer moved (+43.12). On the matched
  500k panel, dense was effectively unchanged (+0.27), while shifted pickup
  fell 16.99 and Believer fell 14.05. The single 250k gain is therefore not a
  general physical-horizon improvement.
- Remove the hook. Contact-time normalization is a coherent formulation, but
  this evaluator change still exchanges long-horizon basins rather than
  providing a predictive certificate. Do not tune its horizon or add a dense
  depth selector.

Artifacts: `generated/studies/fwd-time-normalized-{control-s24-250k,
panel-s24-250k,panel-s30-500k}-a01.json` (two matched ten-case panels, about
50 seconds wall-clock). No compiler behavior changed.

## 2026-07-14: coupled ordinary contacts reveal reachability, not yet a policy

- A new observation-only oracle freezes the actual production prefix, builds
  two *ordinary* sequential catches from their true states, installs the pair
  atomically, then resumes ordinary search. Both authored contacts are
  re-detected with owned-line attribution and no intervening offbeat landing.
  It changes no compiler code, targets, or scorer.
- At the scarce 250k dense frontier, the matched unmodified suffix stalls after
  51/68 contacts on seeds 24/25. A coupled pair reaches 114 contacts on seed
  24; on independently selected seed 25, pair `(rank 7, child rank 16)` reaches
  the end (123/123, score 371.88) with the same suffix budget where the control
  stalls at 68. Seed 26 improves from 51 to 110 contacts but remains invalid.
  Thus one-contact greediness is a real reachability limitation, not evidence
  that a dense-specific arc shape is required.
- The oracle deliberately enumerates all locally admissible pairs outside
  compiler accounting. It is therefore an existence result only. Its first
  attempted selector, immediate next-contact candidate count, misses seed 24's
  strongest pair (which has count zero), so that selector is rejected. Do not
  implement a free exhaustive pair lane, rank-2 override, or cadence detector.
  The subsequent bounded-greedy selector also failed, so the next credible
  route is a new trajectory-level construction, not another selector over the
  existing one-contact arc family.

Artifacts: `generated/studies/dense-s{24-g50,25-g17,26-g45}-coupled-future-support-a01.json`
and `dense-s24-g50-coupled-future-support-a0{4,5,6}-*.json` (exact-prefix
construction/suffix diagnostics, about two minutes wall-clock). No compiler
behavior changed.

Follow-up: a fixed four-contact greedy ordinary continuation was also tested
as the bounded selector. It saturated for many seed-25 pairs and did not select
the completing pair, so it was removed from the oracle rather than retained as
another depth knob. This independently agrees with the earlier phase-outcome
studies: bounded local survival is not a durable compound-transition selector.

## 2026-07-14: refreshed current source screen

- Command: `LR_ENGINE=wasm npm run --silent benchmark -- eval --jobs=48
  --out=generated/benchmark-v2/eval/current-source-2026-07-14-stage0-a01.json`.
  It completed 264 development compiles in about 75 seconds, with peak sampled
  process RSS 5.50 GiB.
- The current source scores 480.80 (250k 458.35, 121/132 valid; 500k 489.78,
  130/132 valid). Representative quality is 542.00 at 500k, but the primary
  leverage remains capability completion: both dense frontiers are zero at
  250k, and pickup has only one valid seed per member. This refresh is stage-0
  evidence only; the current era cannot declare another confirmation without a
  ledgered risk override.

## 2026-07-14: shared partial score cannot rank a coupled trajectory packet

- Hypothesis: the exact two-contact reachability witness could become a
  general macro candidate if the already-shared partial-score reconstruction
  ranked a fully committed pair. This would retain a coupled physical state
  without inventing a dense-case detector or a new heuristic.
- The observation-only oracle now evaluates every ordinary sequential pair at
  the frozen dense seed-25/gap-17 prefix by `objectiveLeafValue` before any
  suffix is run. The pool contained 359 fully admissible pairs. Their raw
  partial values occupied only `[1.968e-7, 2.099e-7]`; the top-ranked pair
  (`parent=0, child=19`) exhausted its suffix after 19 contacts. The known
  completing pair (`7,16`, 123/123 contacts) is not selected.
- This is not numerical underflow: all values are finite and nonzero. It is a
  semantic limitation of a prefix score whose survival/missing terms are
  necessarily almost constant far from the terminus. Rounding merely exposed
  the scale; the raw ordering was used.
- Reject a macro-packet lane ranked by the current partial objective. Do not
  promote its coupled witness, rank tuple, or local capacity as a policy. A
  future coupled construction needs a state-continuous downstream certificate
  with materially discriminative evidence, not a wider branch over the same
  prefix objective.

Artifacts: `generated/studies/dense-s25-g17-coupled-future-objective-{range,a01}.json`.
The range run took 7.1 seconds; the 30-suffix confirmation took 59.3 seconds.
No compiler behavior changed.

## 2026-07-14: early release-state diversity is already present in the branch

- Hypothesis: the scarce dense run might discard the mature route because
  rank-only branching collapses physically distinct release states. Exact
  predecessor reads at the first current-source divergence (dense seed 24,
  parent gap 18) reject that premise before any traversal implementation.
- The 500k route selects ordinary pool rank 2 (attempt 28, release
  `vx=9.790`, `vy=-0.380`); the 250k route selects rank 5 (attempt 22,
  `vx=9.878`, `vy=0.149`). Rank 2 is nevertheless already within the normal
  three-wide admitted branch at the 250k boundary. Its exact pool geometry,
  release state, and next-pool availability are identical at both budgets.
- A release-state portfolio would thus reshuffle paths that the incumbent
  already preserves, while prior equal-suffix evidence shows the rank-2 state
  still cannot finish on the scarce allocation. Reject state-bin branching and
  do not add a diversity classifier. The remaining work must make a committed
  trajectory cheaper or more predictive, not restate existing breadth.

Artifacts: `generated/studies/dense-s24-g{18,19}-release-coverage-{250,500}k-a01.json`
(four exact prefix reads, 9.2 seconds wall-clock). No compiler behavior changed.

## 2026-07-14: paired terminal readiness is informative but not budget-feasible

- Hypothesis: after two ordinary catches, the second catch's exact ballistic
  release state, scored against the third contact, might provide the missing
  state-continuous certificate. This differs from the rejected pair capacity
  and partial-prefix objective: it has no suffix label or extra simulation and
  measures the committed fragment's physical exit.
- On the frozen dense seed-25/gap-17 oracle, that ordering found one complete
  suffix in its top 30: pair `(11,0)`, readiness `0.7971`, 123/123 contacts,
  score 336.44. Independent seed-24 and seed-26 reads found no complete pair
  in their top 30 (best 105/123 and 121/123 respectively); this is a discovery
  signal, not a cross-case policy result.
- The decisive implementation test then limited the pair construction before
  suffix evaluation. A 12-parent/one-child basis, 12-by-12 basis, and
  32-by-12 basis each selected a dead end on the positive seed. The complete
  pair requires candidate diversity that appears only when both ordinary pools
  are fully expanded (921 viable pairs), which is far beyond a useful per-node
  budget at 250k.
- Retain `--rank=readiness` in the observation-only pair oracle, but do not add
  a macro lane or tune pair widths. This certificate diagnoses real state value
  yet cannot expose it at a bounded cost; charging its construction would make
  the compiler less scalable rather than solve the frontier.

Artifacts: `generated/studies/dense-s{24-g50,25-g17,26-g45}-coupled-future-readiness-a01.json`
and `dense-s25-g17-coupled-future-readiness-{small,12x12,32x12}-a01.json`
(six bounded reads, about 166 seconds total). No compiler behavior changed.

### Follow-up: the existing depth-two evaluator cannot expose the pair

- The normal charged forward evaluator already simulates a child candidate, so
  its nonterminal leaf was temporarily weighted by that child's same terminal
  readiness. This added zero physics frames and applied uniformly, rather than
  creating a macro lane. It nevertheless left the positive dense seed-25/250k
  run invalid (`0 -> 0`) while changing its later candidate funnel.
- The full-pair witness needs a parent outside the forward evaluator's retained
  trajectory, not a different order among its already simulated leaves. Remove
  the source switch. A useful future mechanism must expose new state material
  at a bounded cost; it cannot merely reweight the current depth-two rollout.

Artifacts: `generated/studies/fwd-terminal-readiness{-control,}-dense-s25-250k-a01.json`
(two isolated 250k compiles, 5.1 seconds total). No compiler behavior changed.

### Follow-up: neutral-release branching does not expose the state

- A second zero-cost basis retained the normal score winner but replaced the
  other scarce-budget branch with the existing candidate closest to a neutral
  airborne vertical release. This was a general continuous state coordinate,
  not a duration, case, or detector condition.
- On the same dense seed-25/250k necessary-condition run it remained invalid
  (`0 -> 0`) and changed the later aim funnel. The successful paired prefix is
  not recovered by a simple release-state bin among the existing branches.
  Remove the policy rather than tune a release target or reserve more branches.

Artifacts: `generated/studies/branch-release-neutral{-control,}-dense-s25-250k-a01.json`
(two isolated 250k compiles, 5.0 seconds total). No compiler behavior changed.

### Follow-up: raw-coordinate packet bases also miss the state

- A trajectory-packet precursor sampled its first ordinary arc from the first
  eight deterministic raw coordinates, then constructed a normal 32-member
  child pool and ranked exact gate-valid pairs by terminal readiness. This is
  a compact generator basis, not a rank-space selector.
- On dense seed-25/gap-17 it produced 288 valid pairs but its best packet
  stalled at 67 contacts. The completing exhaustive pair uses aimed parent and
  child candidates, so both depend on full normal pools; neither is exposed by
  a small raw-coordinate packet basis. Do not add this packet lane or tune its
  raw sample count.

Artifact: `generated/studies/dense-s25-g17-coupled-future-raw8x32-readiness-a01.json`
(one bounded read, 6.8 seconds). No compiler behavior changed.

## 2026-07-14: support-time interpolation has an unsafe budget crossover

- The current source changed after the original support-mode selection, so the
  two remaining physically coherent alternatives were rechecked on the mixed
  ten-case 500k panel at seeds 30 and 31. `shape-time-log` was negative at
  seed 30. `time-shape-span` improved dense, dense-240, most low-air rows, and
  Countercurrent on both seeds; it therefore earned a full development screen.
- The 264-run screen falsified the apparent improvement. It raised 500k from
  489.78 to 502.66 (+12.88, 130/132 to 131/132 valid), but lowered 250k from
  458.35 to 430.91 (-27.44, 121/132 to 119/132 valid). In particular,
  250k dense-musical fell 419.21 -> 54.92 when a dense-dialogue run became
  invalid, while 500k dense recovery rose 140.51 -> 369.35.
- The combined stage-0 headline is only 480.80 -> 482.16. This is a budget
  crossover, not scalable support geometry: the more time-normalized proposal
  changes 250k trajectory basins before search can recover them. Reject the
  global mode, do not capture a family, and retain `shape-time-deficit` as the
  source default.

Artifacts: `generated/studies/support-current-{control,time-shape-span}-panel-s{30,31}-500k-a01.json`,
`generated/studies/support-current-shape-time-log-panel-s30-500k-a01.json`,
and `generated/benchmark-v2/eval/support-time-shape-span-current-2026-07-14-stage0-a01.json`.
No compiler behavior changed.

### Follow-up: midpoint blending is discontinuous in trajectory selection

- A deliberately small follow-up tested the only defensible interpolation
  before considering a family: at 500k, `LR_SUPPORT_TIME_SPAN_BLEND=0.5`
  leaves the 250k behavior untouched and places the support length halfway
  between the current deficit plan and the time-shape span. On the same
  seed-30 ten-case panel it raised dense-240 by 32.32 and Frontier by 18.24,
  but made shifted-pickup invalid (`399.66 -> 0.00`) and lowered Believer by
  21.37. The panel mean fell `447.33 -> 414.65` and validity `10/10 -> 9/10`.
- This is not a usable smooth trade-off: small geometric interpolation can
  cross a search-basin boundary. Remove the study-only environment knob rather
  than retain a misleading tuning surface. The endpoint result remains
  rejected; the default support formulation is unchanged.

Artifact: `generated/studies/support-time-blend-half-panel-s30-500k-a01.json`.

## 2026-07-14: terminal polish is correctly reachable but not active on V2

- The opt-in polish pass was silently unreachable for every current handoff
  leaf because it excluded nonempty start geometry; its rebuild API could not
  replay those start lines. The rebuild now receives immutable start lines, so
  an opt-in polish evaluates the same track as the live compiler.
- A fresh ten-case 500k panel (seed 30) executed 456 terminal polish attempts.
  It changed and adopted zero variants, with per-compile runtime rising only
  about 2--5%. The existing polishers target narrow air/contact edits and do
  not mutate the mixed speed/impact objectives driving the current score gap.
- Retain the reconstruction correction and the study flag, but do not enable
  polish by default or spend a family run on it. It is not a current path to
  capability completion or the 550 headline.

Artifacts: `generated/studies/polish-{control-,}panel-s30-500k-a0{1,2}.json`
(twenty direct 500k compiles, about 90 seconds total). Focused optimizer tests
pass after the reconstruction fix.

## 2026-07-14: dense witness is an admission problem, not missing geometry

- The exact two-contact oracle was extended with an inspection-only geometry
  and provenance readout. On `frontier_dense_recovery`, seed 25, at gap 17,
  the known complete pair is ordinary production geometry: 152 px of shallow
  support followed by a 59 px child, with forward release speeds 10.35 and
  10.29 px/frame. It is not a duration-specific construction and does not
  justify a five-second or dense-special geometry path.
- Both catches are existing aim proposals. The parent is a 7.5-degree exit
  pitch of raw attempt 2; that base is fifth in the full quality ordering. The
  completed parent is ranked 11th in the merged 24-member pool, while normal
  handoff admits only eight. Thus a new direct generator would merely
  duplicate an existing continuous family before the actual bottleneck.
- The higher-ranked ready pair is not a substitute: its terminal readiness is
  0.836 versus 0.797 for the completing pair, yet it stalls at 51 contacts;
  the completing pair reaches all 123. One-contact readiness and immediate
  child-count ordering are therefore falsified as admission criteria. The
  previously tested neutral release-state branch is also insufficient.
- Next mechanism: predeclare an affordable longer-horizon state evaluation or
  a representation that predicts it before replacing the eight-member
  admission boundary. Do not widen the pool, add a release bin, or duplicate
  aim geometry based on this one witness.

Artifacts: `generated/studies/dense-s25-g17-coupled-future-readiness-provenance-a01.json`
(one 250k observation run, 8.1 seconds); the observation script's focused
optimizer test passes. No compiler behavior changed.

## 2026-07-14: cheaper pitch-only aiming loses essential rotation authority

- Hypothesis: the dense witness is a pure 7.5-degree exit-pitch proposal, so
  replacing the five-row joint `cross5` probe design with the three-row
  `pitch3` design might retain that continuous actuator while freeing two probe
  rides per refined base for scarce-budget traversal.
- The full frozen 264-compile Stage-0 screen rejects it: headline `480.80 ->
  476.29`; 250k `458.35 -> 447.74` (121 -> 122 valid) and 500k `489.78 ->
  487.72` (130 -> 126 valid). Mean wall time did fall by about 2.1s/run at
  250k and 3.5s/run at 500k, so the expected compute saving is real.
- That saving is not usable search capacity. `pitch3` lost valid dense musical
  and shifted-pickup runs at 250k, and four previously valid 500k dense
  frontier runs. It rescued three isolated 250k rows, including one shifted
  pickup and one dense-240 seed, but did not make the base dense frontier
  valid. The removed whole-arc rotation is therefore an active global actuator,
  not redundant cost.
- Restore `cross5`; do not add a budget/cadence gate around `pitch3` or treat
  its individual seed gains as family evidence. Any reduced-probe successor
  must preserve rotation when it is predictive, rather than eliminate it.

Artifact: `generated/benchmark-v2/eval/aim-pitch3-current-2026-07-14-stage0-a01.json`
(264 frozen development compiles, about one minute at 48 workers). No compiler
behavior changed.

## 2026-07-14: adaptive rotation recruitment is promising but not confirmed

- Replacing `cross5` globally with `pitch3` was harmful, but the pitch-only
  result suggested a narrower allocation question: begin the continuous joint
  response fit with three pitch probes and recruit the two rotation probes only
  when the best pitch lies near the feasible pitch boundary. The rule uses only
  the fitted response, pitch span, and compile budget; it has no source,
  duration, or capability-case condition. At 500k it retains the normal five
  probe design.
- A small, pre-captured two-member family compared recruitment margins of
  `0.25` and `0.5` degrees on six fresh shared seeds at both budgets (1,584
  total development compiles, 6m05s at 48 workers). The `0.25` member was the
  observed leader at every 2/4/6-seed prefix: headline `485.85`, versus
  `483.12` for `0.5`; both have the same 500k aggregate (`501.43`). The
  difference is therefore concentrated in intended scarce-budget allocation.
- The margin choice is not established: paired `0.25 - 0.5 = +2.73` with a
  90% exploratory interval `[-8.13, +13.59]` (equivalently the report's
  right-minus-left interval `[-13.59, +8.13]`). Selection retains `0.25` for
  further exploration because it led all prefixes and lost less on 7s
  endurance, not because it is a confirmed improvement over `0.5`.
- Both variants also include the already-dirty compiler work relative to the
  frozen v2.6 baseline, so their large baseline deltas are not attribution for
  this one rule. The only causal comparison here is between immutable sibling
  snapshots. No verdict was started: the current era has insufficient certified
  improvement budget, and a future promotion must use a fresh certified epoch.

Artifact: `generated/benchmark-v2/families/adaptive-rotation-recruitment/round-001/report.json`.
Focused optimizer tests (`43/43`) and `git diff --check` pass. The generated
family payload is ignored by Git.

## 2026-07-14: current dense failure is a short high-impact contact-phase gap

- The fresh selected-source family localizes the remaining 500k failures to
  dense recovery. On an actual failing family seed
  (`frontier_dense_recovery`, seed `3057130498`), normal search reaches gap 70
  and then has no eligible candidate. Its prior selected predecessor is pool
  rank 7. Replaying all eight sibling predecessors with exactly the remaining
  149,961-frame suffix budget rejects a local rank substitution: none is valid.
  Ranks 0 and 3 reach the terminus with `122/123` contacts, but both miss the
  same immediate contact 70; the other six stall earlier.
- The state at that boundary has two nine-frame intervals, low air asks
  (`~0.15`), speed `~0.84`, and an impact transition from `0.27` to `0.90`.
  The current impact funnel makes the limitation measurable: at gap 70, 1,421
  candidate attempts include 433 existing impact-template attempts, but none
  is admitted. The redirection estimate needs `37.6` degrees of turn; the
  normal source produces at most `29.6` degrees and only `21.6` degrees
  survive. This is a generator/gate boundary, not a ranking loss at that gap.
- A bounded cap falsification temporarily moved the template end-angle floor
  from `-28` to `-40`, `-48`, and `-54` degrees. Generated/surviving maximum
  turn rose to `33.4/32.8`, `35.6/35.6`, and `36.4/36.4` degrees respectively,
  but every variant still admitted zero candidates at gap 70 and reduced
  template survival (351 at the default to 300 at `-54`). Restore `-28`.
  Do not tune the end-angle floor further or mistake a deeper scoop for a
  contact-phase solution.
- The next credible mechanism is a bounded, state-relative contact-phase
  construction that jointly guarantees the current landing window and its
  outgoing flight phase, then competes under the existing exact gates and
  objective across all gap durations. It must be evaluated first as a
  read-only constructor oracle on mixed short/ordinary/long cases, not enabled
  because it repairs this dense witness.

Artifacts: `generated/studies/dense-current-s3057130498-500k-{localize,
g70-options,deadend-alt0-a03,deadend-alt3-a03}.json` and
`generated/studies/dense-current-s3057130498-impact-{funnel-500k-a03,
floor40-funnel-500k-a01,floor48-funnel-500k-a01,floor54-funnel-500k-a01}.json`.

Workflow fixes: three legacy diagnostic scripts now exit safely on `--help`;
`study_impact_funnel.ts --out` now emits one self-describing JSON report rather
than undocumented newline-delimited records, and records template-lane funnel
counts. These changes do not alter compiler behavior.

### Follow-up: a late catch cannot repair the phase state

- From the actual selected gap-69 predecessor, a 512-point state-relative
  catch manifold for gap 70 found zero exact current fits: 255 candidates were
  pre-clearance-rejected, 79 failed survival, and 178 failed the landing gate.
  No candidate reached detector-ready or next-pool-bridge status. This is a
  direct negative result for a late direct-catch fallback, not an inference
  from the incumbent sampler.
- The read initially labelled those manually constructed lines as impact
  templates because landing-probe provenance leaked from the prior sampled
  arc. `clearImpactTemplateMarker()` now isolates direct-study geometry; the
  rerun reports zero templates with the same physical result. The marker is
  metadata only and is never read by production search.
- Therefore do not add a gap-70 rescue, a wider late catch grid, or another
  end-angle range. A useful phase constructor must be introduced before the
  incompatible state is committed, and its value must be shown on mixed
  cadence cases before it can enter the production candidate pool.

Artifact: `generated/studies/dense-current-s3057130498-500k-g70-catch512-a02.json`.

### Follow-up: parent support exposes candidates but misses one flight frame

- A 735-point exact support/exit scan at the actual gap-69 predecessor found
  191 current-valid supports and six that expose 7--20 generated candidates at
  gap 70. Every successful bridge, however, has only five airborne frames at
  the next beat; the detector requires six. The earliest last-grounded frame is
  1459, so this is a one-frame phase deficit, not a lack of post-support length
  or a zero-candidate pool.
- The scan is particularly useful because it separates two requirements that
  the current sampler conflates: current contact placement and outgoing release
  phase. A new general constructor must choose them jointly one contact ahead,
  including a landing-time coordinate, rather than append a tail or retune an
  exit angle after the current contact is fixed. This applies continuously to
  any tight cadence; it is not a dense-case detector.

Artifact: `generated/studies/dense-current-s3057130498-500k-g69-support-wide-a01.json`.

### Follow-up: two independent dense witnesses support a phase-family hypothesis

- The broad state-relative manifold was moved one contact earlier, so each
  trial jointly chooses the current landing placement and its release phase.
  On dense seed `3057130498`, 1/1,024 exact candidates is detector-ready and
  exposes 17 next candidates. Its equal 250k suffix reaches gap 94, materially
  beyond the original gap-70 failure, but remains invalid. The construction is
  not a policy: its successful controls are a discovery witness only.
- An independent dense-240 failure (`seed 3057130496`, gap 86) reproduces the
  existence result: 1/1,024 candidates bridges the next contact and an equal
  250k suffix reaches the terminus at `117/123` contacts. Its phase, approach,
  placement, turn, and support coordinates differ sharply from the first
  witness, so neither a fixed tuple nor a dense-only trigger is defensible.
- This is stronger than the rejected local tail studies: two distinct physical
  states contain a current-valid, detector-ready one-contact phase transition
  that ordinary sampling does not expose. It is still insufficient for
  production because the 1,024-point manifold is unaffordable and neither
  suffix is valid. The next experiment must derive a compact, continuous
  parameterization from state and next-contact timing, then measure its hit
  rate on short, ordinary, and long cadence panels before it competes with the
  normal pool.

Artifacts: `generated/studies/dense-current-s3057130498-500k-g69-phase-catch1024-suffix250-a01.json`
and `generated/studies/dense240-current-s3057130496-500k-g86-phase-catch1024-suffix250-a01.json`.

### Follow-up: broad manifold sampling is not a production candidate family

- Expanding each fixed-prefix manifold to 4,096 controls found only 3 bridges
  for dense and 4 for dense-240. Their approach, turn, phase, placement, and
  support values occupy disconnected regions (including opposite-signed turns
  and approaches). This is evidence of real reachability, but a bridge rate
  below 0.1% makes a small low-discrepancy injection ineffective and a broad
  random lane unscalable.
- Reject sampled-manifold production candidates, selected attempt numbers, and
  a wider branch budget. The successor must solve a continuous residual problem
  for current landing time plus future release phase, use that solution as a
  bounded proposal, and still pass the ordinary exact gates. It should be
  assessed first on a mixed cadence panel for proposal/admission rate and
  downstream continuation, then only as a small governed compiler family.

Artifacts: `generated/studies/dense-current-s3057130498-500k-g69-phase-catch4096-a01.json`
and `generated/studies/dense240-current-s3057130496-500k-g86-phase-catch4096-a01.json`.

### Follow-up: the existing compact runway template is not the phase family

- The normalized 729-point template grid was evaluated at both fixed prefixes.
  It varies the present runway lane's phase, approach, turn, placement,
  pre-support, and post-support controls within its intended compact physical
  range. It produced zero current-valid contacts, zero detector-ready states,
  and zero bridges on both witnesses.
- This rejects an apparently simple production follow-up: widening the fixed
  runway candidate to a small Cartesian grid. The reachable trajectories require
  controls outside that template's sign/range assumptions, while the broad
  manifold demonstrates that unconstrained enumeration is not affordable.
  A next solver study must rank *near* current-contact trajectories by a
  continuous timing-and-release residual before spending exact candidate gates.

Artifacts: `generated/studies/dense-current-s3057130498-500k-g69-phase-template-grid-a01.json`
and `generated/studies/dense240-current-s3057130496-500k-g86-phase-template-grid-a01.json`.

### Follow-up: witness templates do not transfer

- The predecessor study now accepts an explicit diagnostic-only control list in
  rider-relative units (phase, approach/turn, normal placement, and tangent,
  pre-, and post-support durations). This makes an observed state witness
  exactly replayable without changing compiler generation.
- The three controls recovered from dense `g69` replayed as 3/3 exact,
  detector-ready bridges on that original prefix, but produced **zero** valid
  current contacts on the dense-240 `g86` prefix. Conversely, all four
  dense-240 controls replayed as exact bridges on their origin and produced
  **zero** valid current contacts on dense. Each read included its ordinary
  500k compile and took 4.7--5.0s wall-clock.
- This is an explicit cross-state falsification of a small reusable template
  bank. Do not promote the seven witness tuples, hard-code their signs/ranges,
  or use them as a selected-attempt fallback. The remaining hypothesis is a
  genuinely state-solving constructor whose compact proposal is derived from
  continuous current-state and timing residuals, not from these two examples.

Artifacts: `generated/studies/{dense-g69,dense240-g86}-phase-witness-{native,cross*}-a01.json`.

### Follow-up: timing residual alone is not a sufficient phase objective

- The 4,096-point manifolds were rerun with a bounded per-current-fit timing
  residual: `latest permitted grounded frame - actual last grounded frame`
  before the following contact. Dense has three exact bridges at residual zero
  and several one-frame near misses. Dense-240 has 21 detector-ready fits, but
  only four expose even one ordinary next-contact candidate.
- Thus a solver that merely maximizes detector runway would choose many states
  that still cannot continue. Its residual must include a next-contact
  reachability term, and that term has to be measured through the ordinary
  exact candidate generator. This is a two-contact state problem, not an
  off-by-one release controller.
- The observation cost is modest (each 4,096-control fixed-prefix read took
  about 5.2s wall-clock), but it is diagnostic-only. A broad manifold remains
  too sparse to use as a compiler lane, and no production behavior changed.

Artifacts: `generated/studies/{dense-g69,dense240-g86}-phase-residual-4096-a01.json`.

### Follow-up: compact early-release/extended-support mixture rejected

- Predeclared a 128-control diagnostic family with two state-normalized
  regimes: an early release with short post support and a broader extended
  support. It spans phase, approach, turn, normal placement, tangent offset,
  and pre/post duration from the observed rider state; it does not replay any
  witness control.
- At both fixed prefixes it failed the required compression test. Dense yielded
  3 current-valid candidates but zero detector-ready/bridging candidates;
  dense-240 yielded 1/0/0. A candidate family that cannot produce a bridge at
  128 controls is not a viable replacement for the 4,096-point oracle.
- Reject this regime mixture and do not widen it. The only close suffixes still
  miss later repeated contacts (dense bridge: 71/75/78; dense-240 bridge: 89),
  further confirming that a one-boundary lookup policy would be overfit.

Artifacts: `generated/studies/{dense-g69,dense240-g86}-phase-regimes128-a01.json`
and `generated/studies/*-phase-best-suffix250-localize-a02.json`.

### Follow-up: one-contact impact preload is not a sufficient state solver

- A diagnostic-only analytic manifold derived its heading preload from the
  following contact's requested redirection, evaluated in two independent
  dense prefixes. After validating the prior dense-240 witness exactly, a
  compact symmetric grid produced 12 detector-ready one-contact bridges on
  dense `g69` and 2 on dense-240 `g86`. This confirms that a meaningful
  current-state/next-contact relation exists; it does not justify a compiler
  lane by itself.
- Equal 250k suffix replays falsify the one-contact hypothesis. All 12 dense
  bridges miss contact 70 immediately despite later search exploration, while
  both dense-240 bridges reach the terminus but miss contacts 89 and 96.
  Local exact fit plus one ordinary continuation is therefore not a sufficient
  acceptance predicate for a phase proposal.
- The diagnostic control generator was removed rather than retained as a
  hidden fallback. The next mechanism must represent and score a bounded
  multi-contact trajectory, including future exact-candidate reachability,
  before it can be compared against normal generation. No compiler behavior
  changed in this investigation.

Artifacts: `generated/studies/{dense-g69,dense240-g86}-impact-preload-`
`{a06,suffix-a01}.json` and
`generated/studies/dense240-g86-prior-bridge-replay-a01.json`.

### Workflow correction: bounded continuation must not alter sampling

- The first bounded-continuation read passed its retained branch width directly
  to the candidate generator. Because that generator's low-discrepancy samples
  depend on requested width, it was not evaluating the top branch entries of
  the ordinary 32-candidate pool and falsely reported immediate dead ends.
- The read now samples at the declared ordinary width and only then truncates
  the ranked pool. On the dense-240 knob controls that previously showed
  `0` contacts, a depth-3/branch-4 read retains 6, 1, and 24 exact paths for
  the three selected coordinates. This validates the measurement contract;
  it does not make those knobs a cross-state mechanism (the dense witness has
  no such knob bridge).

Artifact: `generated/studies/dense240-g86-knob-outcome3b4-a02.json`.

### Follow-up: ordinary multi-contact selection cannot avoid the dense failure

- A depth-3, width-12 exact beam over the unchanged ordinary 32-candidate
  generator was run from the final usable dense prefix. It retained eight
  admissible current candidates, but none produced an admissible following
  contact. Starting one or two contacts later has no ordinary candidates at
  all. This is a direct availability result, not a ranking result.
- Do not spend effort on a new selector, broader ordinary branch width, or a
  forward-score retune for this failure. The next proposal must construct a
  new state-derived trajectory and then be evaluated recursively across the
  dense cadence before it is allowed into the compiler.

Artifacts: `generated/studies/frontier-dense-g{67,68,69}-coupled-beam-d3w12-a01.json`.

### Follow-up: repeated geometry is not the missing trajectory model

- At the same dense prefix, 38 ordinary candidates were individually
  re-admitted through three state-relative constructions: direct normalized
  reuse, energy-normalized reuse, and curved energy-normalized reuse. None
  completed the first repeated transition. The latter two are not merely
  weakly ranked: their exact gates reject the transformed geometry.
- This rejects a compact but incorrect direction: treating the dense stream as
  a periodic geometry problem. A useful trajectory proposal has to solve the
  next contact from its predicted state and its own axes, then maintain that
  solve recursively; translating the prior catch cannot supply the missing
  state.

Artifacts: `generated/studies/dense-g67-cycle-`
`{state-normalized,energy-normalized,curved-energy}-a01.json`.

### Follow-up: support-time regimes improve local availability but not phase

- Four existing support constructions were sampled from the identical dense
  prefix. The time-oriented mode increased one-step bridges from 3 to 34 of
  128 candidates, but every candidate still has at most five airborne frames
  before the following contact, below the detector's required six. All eight
  bounded suffix reads were invalid.
- This is a clean separation: duration-only support shaping can expose a
  locally admissible next pool, but it does not solve the coupled heading and
  release-time state. Do not promote a support-mode switch or tune its span as
  a dense remedy.
- The support-regime oracle also accepted its documented disabled
  `pairChildren=0` mode after correcting its argument validation; this is a
  diagnostic workflow fix, not compiler behavior.

Artifact: `generated/studies/dense-g67-support-regimes-a01.json`.

### Follow-up: continuous one-contact preload prototype rejected

- A default-off recursive lane was tested, not promoted. It derived two-contact
  support geometry continuously from predicted entry speed and the following
  redirection ask, then competed through unchanged exact gates at every eligible
  contact. On dense it moved the deepest explored gap from 70 to 96 at 500k,
  which proves the formulation materially changes reachability.
- The independent dense-240 seed regressed from depth 87 to 84 and neither
  dense run became valid; pickup remained valid but supplies no compensating
  evidence. The favorable dense result is therefore not sufficient and the
  complete gated lane was removed rather than tuned to that seed.
- The next formulation needs a state descriptor beyond entry speed and the
  immediately following impact. The relevant 300 ms impact motif is the same
  repeating sequence in both dense cases, so future target cadence cannot be
  used as a case discriminator; the missing information is accumulated rider
  phase/history.

Artifacts: `generated/studies/{dense,dense240,pickup}-trajectory-phase-prototype-a01.json`.

### Parallel leverage check: believer impact is not a local pair correction

- The V2 probe identifies fully valid `believer_56_6s` variants as a separate
  high-impact-error opportunity. A 12x12 causal predecessor/arrival-pair
  oracle at their selected weak-impact contacts found zero admissible pairs in
  either variant. The incumbent guided tails were valid, but no local pair was
  available to improve them.
- Reject a local impact-pair correction for these tracks. This result does not
  justify changing impact truth, applying a feasibility cap, or retuning rank
  weights. Any impact follow-up must first show a broader generator funnel
  deficiency and a cross-case candidate-level remedy.

Artifact: `generated/studies/believer-impact-pair-v2-a01.json`.

### Impact funnel: broad leverage, but no local rank shortcut

- On two fully valid believer variants at 500k, 168 high-impact contacts split
  into 42% without sufficient admitted turn, 7% rejected by exact gates, and
  51% with a near-perfect admitted impact candidate that loses the downstream
  ranking. The closest admitted candidate reduces mean absolute impact error
  from 0.35 to 0.02, so the score opportunity is real.
- This does **not** support an impact tie-break: the ranking-loser class must
  preserve continuation, while the other half needs more capable geometry or
  an exact-gate-compatible state. Keep the previously rejected rank shortcut
  rejected. A future mechanism should jointly propose/score a multi-contact
  redirection state, which may improve both dense phase and believer impact.

Artifact: `generated/studies/believer-impact-funnel-a01.json`.

### Direction reset: trajectory synthesis

- The next compiler direction is documented in
  `docs/compiler-trajectory-synthesis.md`. It explicitly replaces incremental
  sampler extensions with a short-horizon physical-state construction: first
  test the overlap between reachable release states and the next two contacts'
  entry requirements, then realize only an overlapping state through exact
  geometry gates.
- This is intentionally a design and measurement reset, not a claimed
  mechanism or a benchmark result. The first deliverable is an
  observation-only envelope study across dense, dense-240, pickup, and an
  impact-led case.
