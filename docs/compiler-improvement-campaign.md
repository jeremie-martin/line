# Compiler Improvement Campaign

Target: certified Benchmark V2 canonical headline 550. Historical detail is in
`compiler-improvement-campaign-2026-07-12.md`; this file stays concise and
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
