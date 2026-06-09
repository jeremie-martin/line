# New Impact Work Log

Baseline ruler:
- Archive: `generated/golden-runs-old4/impact-ballistic-bound-canon-01/golden.json`
- Fingerprint: `eede9661bba6`
- Headline: 570.3 canonical; validity 50k 95%, 100k/200k/300k 100%.

Accepted 2026-06-09:
- Candidate: impact-arrival default on plus mature dense entry redirection.
- Archive: `generated/golden-runs/impact-arrival-entry-combo-canon-01/golden.json`
- Canonical decide: baseline 570.3 -> candidate 572.5, Delta +2.3, 95% CI [-0.9, 6.7], P(Delta<=0)=8.9%, effect=1.16, VERDICT: ACCEPT.
- Per-budget deltas: 50k +24.2, 100k +0.0, 200k +0.7, 300k +0.5.
- Validity: 50k 95% -> 96%; mature budgets unchanged at 100%.
- Code shape: `LR_IMPACT_ARRIVAL=0` now reverts the scarce-budget arrival ramp; entry redirection adjusts only the final approach segment on dense, mature, missing-impact rows with cap 10 deg and target pressure 0.30/0.25.

Accepted 2026-06-10:
- Candidate: scarce-budget contract branch cap plus low-budget tail window 17.
- Archive: `generated/golden-runs/contract-branch-cap2-tailwin17-clean-canon-01/golden.json`
- Canonical decide vs `impact-arrival-entry-combo-canon-01`: baseline 572.5 -> candidate 575.4, Delta +2.9, 95% CI [-0.3, 8.3], P(Delta<=0)=10.0%, effect=1.14, VERDICT: ACCEPT.
- Per-budget deltas: 50k +37.2, 100k +0.0, 200k +0.1, 300k +0.0.
- Validity: 50k 96% -> 98%; 100k/200k/300k unchanged at 100%.
- Code shape: before any passing output exists, 50k contract search branches 2-wide after gap 12, fading back to 3-wide by 100k; contract tail completion gets a 17-contact low-budget window so deep prefixes can finish instead of scoring zero.

Accepted 2026-06-10:
- Candidate: mature high-impact post-turn sampler.
- Archive: `generated/golden-runs/impact-postturn-highgate-canon-01/golden.json`
- Canonical decide vs `contract-branch-cap2-tailwin17-clean-canon-01`: baseline 575.4 -> candidate 577.9, Delta +2.5, 95% CI [-0.2, 5.3], P(Delta<=0)=3.7%, effect=1.76, VERDICT: ACCEPT.
- Per-budget deltas: 50k +0.0, 100k +0.0, 200k +3.4, 300k +3.0.
- Validity unchanged: 50k 98%, 100k/200k/300k 100%.
- Code shape: `LR_IMPACT_POST_TURN=0` reverts the new sampler. At mature budgets only, high bounded impact targets (0.60/0.20 ramp) add a spanned upward post-contact turn sized from the missing ceiling-aware redirection angle, leaving normal candidates in the pool.
- Anatomy: total 300k impact squared-error 494.9 -> 486.5; high target band [0.75,1] mean achieved 0.571 -> 0.606 and mean |err| 0.240 -> 0.204. Low/mid bands stayed effectively flat.

Probe trail:
- `impact-entry-redir-dense-slice-01`: focused Delta +0.7, inconclusive. Helped mainly target-impact .55-.75 at 200k/300k.
- `impact-entry-redir-dense-v2-slice-01`: focused Delta +0.2, inconclusive. Broader/stronger pressure hurt the important .35-.55 band.
- `impact-entry-redir-dense-mature-v1-slice-01`: focused Delta +0.7, inconclusive. Best entry-only shape; no score delta at 50k/100k.
- `impact-entry-redir-sign-aware-slice-01`: focused Delta +0.2, inconclusive. Sign-aware entry direction washed out.
- `impact-entry-redir-highband-slice-01`: focused Delta +0.4, inconclusive. Over-narrow target gate reduced useful lift.
- `impact-entry-redir-cap12-slice-01`: focused Delta -0.0, inconclusive. Overdriving the entry cap regressed 300k.
- `impact-arrival-entry-combo-slice-01`: focused Delta +2.4, inconclusive but strong enough to justify canonical; canonical accepted.
- `impact-template-current-slice-01`: focused Delta -1.6, inconclusive; template lane not useful here.
- `impact-axisq-overpressure/contact-centered/residual-gate`: all inconclusive; contact-centered fixed landing rate but not score.
- `impact-repair-anchor-slice-01`: focused Delta -0.4, inconclusive; impact-weighted repair anchor caused bad row swaps.
- `impact-postturn-worst10-slice-01`: focused Delta -8.1, REJECT. Ungated post-turn raised tangentChange but regressed the large .35-.55 target band.
- `impact-postturn-highgate-worst10-slice-01`: focused Delta +4.8, indicative ACCEPT. Target gate preserved high-band gains while removing mid-band damage; canonical accepted.
- `impact-postturn-stronger/start055/contact-start045`: focused inconclusive/negative; accepted high gate is near the local optimum.
- `impact-arrival-floor15-canon-01`: canonical Delta -1.2, P(Delta<=0)=85.5%, INCONCLUSIVE negative; mature arrival residual reverted.
- Low-budget tail probes (`tailwin18`, `tailbranch3`, `tail-ncand5`, `desperate-tail21`) all regressed the 50k failure slice; accepted tail settings kept.
- Selection/search probes: `LR_IMPACT_LOCAL_W=1`, `LR_QUALITY_NCAND=48/24`, `HANDOFF_REUSE_K=2`, and repair main-margin 1.0/1.2 did not produce promotable signal. Portfolio oracle showed full-lane headroom but equal-slice 300k was negative.
- `contract-branch-cap2-canon-01`: 50k +5.6 but canonical Delta +0.4, P(Delta<=0)=42.2%, inconclusive; cap needed a warmup.
- `contract-branch-cap2-warmup12-canon-01`: 50k +38.1 but canonical Delta +2.9, P(Delta<=0)=12.5%, inconclusive; tail window still left the gate just short.
- `contract-branch-cap2-tailwin17-clean-canon-01`: canonical accepted. Window 17 kept the 50k rescue and removed the main `drums_pendulum` seed 10 regression; window 20 was too broad and regressed 50k validity.
