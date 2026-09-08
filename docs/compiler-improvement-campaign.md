# Compiler improvement campaign

The active normal-line arc compiler is **arc-guidance-planning**, promoted at
**744.5000** on Benchmark V2 at 750k, up **56.9898** from 687.5102.
All **352/352 runs** pass across the full 44-case development suite and eight
seeds (16–23). The governed comparison accepts the first N=8 look of the
declared N=48 maximum; no forced promotion was used. Benchmark, scorer,
targets, physics, validity and frame accounting are unchanged.

The three approved work items are complete: causal rail ablation, general
curve geometry, and planning across beats. The selected compiler searches
guide clearance, tests the next arc before selecting the current arrival,
and retains useful continuations for later construction and recovery.
A replay identifies unused upper rails and unused ends; removal must preserve
the entire raw trajectory under the frozen judge. Supporting arcs remain
intact. Single arcs, partial guides and full pairs follow from physical need,
without a motif schedule or random variety quota. Coverage search, joint
shape refinement and deeper trees were also implemented and evaluated;
their results and failed experiments remain in the
[research record](arc-guidance-planning-campaign.md).

Across the 44 final tracks, 952 of 4,100 upper guides are removed and 2,969
shortened. Their combined length drops 59.48%. The remaining guides are
contiguous curves; every line is normal type 0. All proposals, lookahead,
backtracking and two full cold replays count toward actual physics work.
Canonical costs are 687,744–737,686 frames, median 715,502, compared with the
reference median 358,313. This is an improvement under the same allowance,
with greater actual expenditure. A 320-proposal local-only control fails
nine cases and scores 567.2923; increasing local breadth alone did not
reproduce the gain in the tested implementation.

## Validation and limits

Forty-two development cases improve; Amplitude Tides Restrained regresses
23.9440 and Believer Impact regresses 5.5561. Canonical zero-jitter seeds
repeat identical tracks, giving 44 distinct tracks and seed SE zero. The
catalog sensitivity interval for the gain is [50.3714, 63.8088].

Qualification passes **120/120**, with monitor scores 607.1908 / 641.5005 /
690.3029 at 250k / 500k / 750k, combined 649.2793 (reference 626.5448).
A separate all-44-case search-target-jitter study, jitter 0.02 and seeds
101–104, passes **176/176 distinct tracks** versus 175/176 for the reference:
one rescue, no losses, mean per-cell gain 60.6337. This stress study is not
the canonical headline or a guarantee for other perturbations.

| Actual frame allowance | Full-suite score | Valid cases | Reading |
| --- | ---: | ---: | --- |
| 150k | 481.1128 | 38/44 | All scores, reports and costs equal the reference |
| 250k | 610.9446 | 44/44 | Score parity with reference |
| 500k | 709.4171 | 44/44 | Reference 673.6385 |
| 750k | 744.5000 | 44/44 | Canonically certified across eight seeds |
| 1M | 745.0343 | 44/44 | Default search breadth saturates |
| 3M | 745.0343 | 44/44 | All tracks equal the 1M output |

The noncanonical rows use one seed per case. The separate standing 250k
reading passes 528/528, scores 645.6560 and returns **PARITY** against the
old arc reference, with no lost completions or score changes. Six 150k
failures remain inherited limitations. Higher-budget saturation and the
two score regressions warrant further work; no performance ceiling is established.

Two complete tracks, River Reentry and Dense Dialogue, exactly match the
published JavaScript engine in raw trajectory and detected events. Seven
focused test files pass all 22 tests. Repository-wide TypeScript checking
still reports existing unrelated errors; it reports none in the changed
compiler or review files. [Validation index](../benchmark/v2/studies/arc-guidance-planning-validation.json).

## Videos and preservation

[Open the three-video gallery](../archives/arc-guidance-2026-09-08/index.html).
All production specifications have full 1080×1920 / 60 fps videos with music,
camera, spectrum and locked post-processing. Full decode and physical
contracts pass. Actual frames at 12 and 30 seconds were inspected in each
video. Their standing time is zero, below the unchanged 2% creative floor;
these are review examples, not a claim that all selection floors pass.
[Video details and direct links](arc-guidance-video-review.md).

Work branch: `codex/arc-guidance-planning`; preservation branch:
`archive/arc-guidance-planning-744`; compiler source commit: `6f71b4d8`.
The [active baseline](../benchmark/v2/campaign-baseline.json) binds candidate
`fd1f576b36213e0c1e9a32f6ad7a058658b151e1e81757e2fda258374679a1d2`
to compiler fingerprint
`05a89447ceabbadec189d0222b03ad4f53c44918709ca2d4a3137865a5b7c55d`.
The [current baseline analysis](benchmark-v2-current-baseline-analysis.md)
is regenerated from the accepted archive. Videos, original production inputs,
source snapshot, research evidence and checksums are stored locally.

The 687 arc reference, 662 normal-point proof and 761 acceleration proof remain
on their respective `archive/connected-arc-feedback-687`,
`archive/normal-motion-feedback-662` and `archive/native-motion-feedback-761`
branches, with their original videos. Compiler research remains open within
the owner's normal-line, coherent-arc requirements and fixed benchmark.
