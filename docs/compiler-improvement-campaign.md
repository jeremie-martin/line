# Compiler improvement campaign

The active normal-line, arc-based compiler is **connected-arc-feedback**, promoted at
**687.5102** on Benchmark V2 at 750k: **352/352 valid runs**, all 44 development
cases × eight seeds (16–23). The governed comparison accepts at N=8, with
**+24.9213** over the preserved point-control compiler's 662.5889. N=48 was the
declared maximum; the accepted first look executed eight seeds. No forced
promotion was used. Benchmark, score, targets, physics, validity, and frame
accounting remain unchanged.

The compiler builds coherent physical curve pairs from normal type-0 lines.
It proposes smooth curves, measures their actual motion, balances upward and
downward redirection, and revisits earlier curves before bad approach states
compound. A broad arrival-angle objective prevents steep speed runaways.
The upper rail performs real physical control: removing it changes the audited
River trajectory at frame 66 and ejects the rider at frame 192. The full track
survives to frame 2340. This is physical arc construction, with no decorative
cover over isolated point controls.

Canonical compiles use 316,533–509,155 actual physics frames (median 358,313),
including failed proposals, backtracking, and two complete cold replays.
Both compiler and preserved point baseline are deterministic across these
zero-jitter development seeds, so measured seed-block SE is zero; this does
not imply zero uncertainty about other specifications. The catalog sensitivity
interval for the gain is [18.2560, 31.1076].

Qualification passes **120/120**, with monitor scores 583.7360 / 630.8295 /
647.9428 at 250k / 500k / 750k. The combined monitor is 626.5448, below the
previous point-control monitor of 644.8292. Twenty-eight development cases
improve and sixteen regress; low-air and pickup cases are prominent weaknesses.
The standing 250k comparison passes 528/528 with no lost completions, but
its subset score is 645.6560 versus 670.9793; the reading is ADVERSE on score. These monitors do not change the 750k acceptance policy.

Twelve final scale checks across three sources at 150k, 750k, 1M, and 3M
stay within their actual budgets. Eleven are valid; Pickup Progression fails
at 150k. The 1M and 3M outputs match per source. Two
complete tracks exactly match the published JavaScript engine, frame by frame
and event by event, as well as the frozen WASM judge. Seven focused integration
and identity tests plus 22 physics/runner/scoring tests pass.

[Open the arc video gallery](../archives/arc-motion-2026-09-08/index.html).
All three final videos are complete and archived, alongside the earlier
research previews. The final compiler reproduces every rendered track and report. All use the production vertical format, music, camera,
overlays, and locked effects. [Video details](arc-motion-video-review.md).
The standing-time creative selection floor is not met by these review examples;
physical survival and contact contracts are required and pass. The owner has
reviewed the videos and welcomes the paired-arc appearance, while encouraging
further performance and less repetitive geometry. See the
[owner feedback and research hypotheses](arc-motion-video-review.md#owner-feedback-2026-09-08).

## Evidence and continuation

- Implementation branch: `codex/arc-motion-650`; final compiler source `affc8efd`.
- Candidate: `8a81558e2ca3e5cc67a27b45bc9bba7be5b42c58c2026f7923544a754ee139fe`.
- Source fingerprint: `9f2b2ebb223ae82ff8f3dd844eb227a5d2101de561ebbd9cfbcbd3694e0d5db7`.
- [Active reference](../benchmark/v2/campaign-baseline.json) and
  [current baseline analysis](benchmark-v2-current-baseline-analysis.md).
- [Research history and experiments](arc-motion-650-campaign.md).
- [Prior normal point compiler](normal-line-650-campaign.md) preserved on
  `archive/normal-motion-feedback-662`; its original previews remain archived.
- [Acceleration proof of concept](native-motion-video-review.md) preserved on
  `archive/native-motion-feedback-761`, with all three original videos.

Keep the benchmark and score fixed. Future compiler directions remain open
within the owner's normal-line and coherent-arc requirements. Improve the
physical planner and arc variety while using actual videos to evaluate the
result. This campaign's numerical milestone is verified; it does not establish
that all aesthetic goals or future optimization opportunities are exhausted.

The first accepted arc snapshot was subsequently corrected to report viable
candidate counts and allocate more breadth at small budgets. The final source
was freshly certified: all 352 canonical tracks, scores and frame costs match
the first accepted snapshot, and the 250k validity loss is repaired. Both
certifications and the initial adverse reading are retained. See the
[checksummed validation index](../benchmark/v2/studies/connected-arc-feedback-validation.json).
