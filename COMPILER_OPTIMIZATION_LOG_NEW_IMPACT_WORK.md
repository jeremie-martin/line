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

Accepted 2026-06-10:
- Candidate: budget-shaped quality candidate breadth.
- Archive: `generated/golden-runs/quality29-slow-mature-gate-canon-01/golden.json`
- Canonical decide vs `impact-postturn-highgate-canon-01`: baseline 577.9 -> candidate 578.6, Delta +0.7, 95% CI [-0.2, 1.6], P(Delta<=0)=6.3%, effect=1.54, VERDICT: ACCEPT.
- Per-budget deltas: 50k +1.3, 100k +0.0, 200k +0.4, 300k +1.1.
- Validity unchanged: 50k 98%, 100k/200k/300k 100%.
- Code shape: quality-phase candidate count still defaults to 32 at mid budget and honors `LR_QUALITY_NCAND`; without the env override it leans toward 29 at scarce and mature budgets, giving canonical counts 50k=29, 100k=32, 200k=31, 300k=29.

Accepted 2026-06-10:
- Candidate: budget-gated impact template lane with vertical compatibility and 22-degree cap.
- Archive: `generated/golden-runs/template-maxturn22-canon-01/golden.json`
- Canonical decide vs `quality29-slow-mature-gate-canon-01`: baseline 578.6 -> candidate 580.0, Delta +1.4, 95% CI [-0.1, 3.1], P(Delta<=0)=3.4%, effect=1.73, VERDICT: ACCEPT.
- Per-budget deltas: 50k +0.0, 100k +2.7, 200k +0.9, 300k +1.5.
- Validity unchanged: 50k 98%, 100k/200k/300k 100%.
- Code shape: `LR_IMPACT_TEMPLATE=0` reverts the lane. The template is off at 50k and fully on by 100k, appears only on every third late attempt, is limited to no-vertical or elevation+amplitude beats plus isolated sparse amplitude-only gaps, and uses a gentler slam-hop scoop capped at 22 degrees.

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
- `impact-frontload105-worst20-slice-01`: raising the existing impact curvature front-load globally to 1.05 gave 300k +2.4 on the hard slice but damaged 50k (-30.0) and was net negative; not kept.
- `impact-frontload-mature105-worst20-slice-01`: mature-only extra front-load preserved 50k and kept the 300k slice signal (+2.4), but focused Delta was only +1.1 with P(Delta<=0)=24.1%.
- `impact-frontload-mature120-worst20-slice-01`: stronger mature front-load diluted the signal (focused Delta +0.8, P(Delta<=0)=28.1%); too much trajectory churn.
- `impact-frontload-mature105-canon-01`: canonical Delta +0.1, CI [-2.2, 2.2], P(Delta<=0)=47.4%, INCONCLUSIVE; wins on terrace/drum/soar rows were canceled by rhythm_ladder, float_bounds, drums_tide, tiny_dance, and other broad losses. Source reverted.
- Low-budget tail probes (`tailwin18`, `tailbranch3`, `tail-ncand5`, `desperate-tail21`) all regressed the 50k failure slice; accepted tail settings kept.
- `probe-repair-min50-fail10-slice-01`: enabling repair at 50k via `LR_REPAIR_MIN_BUDGET=50000` did not rescue the known zero rows; focused 50k/100k Delta -0.5, P(Delta<=0)=93.7%, validity 98% -> 92% at 50k. Rejected.
- `probe-contract-warmup10-fail10-slice-01`: starting the scarce 2-wide contract cap at gap 10 instead of 12 did not improve the failure slice; focused 50k/100k Delta -0.0, P(Delta<=0)=57.3%, and 50k validity regressed on the paired intersection. Reverted.
- `quality28/30/31-current-canon-01`: scalar quality-breadth sweeps stayed positive but inconclusive; `quality30` was Delta +0.5, P(Delta<=0)=16.3%, while `quality31` weakened to Delta +0.1.
- `quality29-current-canon-01`: best scalar sweep, Delta +0.6, P(Delta<=0)=12.3%, with 50k +1.3 and 300k +1.1 but a small 100k loss. Pushed into a budget gate instead of accepting the global constant.
- `quality29-budget-gate-canon-01`: 29 at 50k/200k/300k and 32 at 100k improved to Delta +0.7, P(Delta<=0)=10.3%; slowing the mature ramp so 200k uses 31 crossed ACCEPT.
- `impact-mid-postturn-dense8-slice-01`: dense mid-band post-turn lane targeted the dominant [0.35,0.55) impact-error mass but regressed the focused slice, Delta -2.1, P(Delta<=0)=90.3%, with 200k/300k losses. Reverted.
- `impact-segdensity-dense8-slice-01`: finer mature post-contact segmentation for impact beats preserved 200k but hurt 300k on the same dense-error slice, Delta -0.8, P(Delta<=0)=71.9%. Reverted.
- `repair-impact-weakness-focused8-01`: adding one extra impact-SSE vote to the repair weakest-gap picker regressed the focused slice, Delta -0.8, P(Delta<=0)=85.5%, with 300k -1.4. Reverted.
- `repair-impact-weakness-half-focused8-01`: half-weight repair impact vote was a focused REJECT, Delta -0.7, P(Delta<=0)=92.1%, with 200k/300k losses. Reverted.
- `impact-avgfwd-focused8-01`: routing impact-targeted gaps through the existing mature avg forward-eval predicate was a focused REJECT, Delta -17.1, P(Delta<=0)=100%, across 100k/200k/300k. Reverted.
- `gentle-impact-template-focused8-01`: gentle default-on template lane was focused Delta +0.3, P(Delta<=0)=38%; promoted to canonical.
- `gentle-impact-template-canon-01`: canonical Delta -1.3, P(Delta<=0)=80.0%; 50k damage (-15.7) required a budget gate.
- `gentle-impact-template-budgetgate-canon-01`: canonical Delta -0.1, P(Delta<=0)=54.7%; 50k fixed, but 200k dragged.
- `gentle-impact-template-midgate-focused8-01`: target-band gate weakened the focused signal, Delta -0.3, P(Delta<=0)=61.2%; reverted.
- `gentle-impact-template-verticalgate-canon-01`: vertical compatibility gate lifted canonical to Delta +0.7, P(Delta<=0)=16.1%; positive but still inconclusive.
- `gentle-impact-template-verticalgate-mod2-focused8-01`: denser modulo-2 lane was focused Delta -0.5, P(Delta<=0)=64.9%; reverted to modulo 3.
- `gentle-impact-template-verticalgate-isolatedamp-canon-01`: isolated sparse amplitude-only exception gave canonical Delta +0.8, P(Delta<=0)=14.6%; still short, so geometry was tightened.
- `template-missingturn-balanced17-seed8-01`: ceiling-aware missing-turn cap weakened the balanced probe to Delta +0.3, and was worse than the isolated-amplitude branch; reverted.
- `template-elevonly-sparse5-canonseeds-01`: sparse elevation-only extension was a focused REJECT, Delta -3.3, P(Delta<=0)=94.3%; reverted.
- `template-minattempt11-balanced17-seed8-01`: later template attempts were positive vs baseline but worse than the current branch on the same intersection; reverted.
- `template-maxturn24-canon-01`: 24-degree cap improved canonical to Delta +0.9, P(Delta<=0)=13.2%; still inconclusive, so the cap was pushed lower.
- `template-max24-noamp-amp5-canonseeds-01`: disabling sparse amplitude-only was effectively neutral on the affected specs; exception kept.
- `template-max24-pressure45-balanced17-seed8-01`: pressure threshold 0.45 was weaker than the 24-degree branch on the balanced intersection; reverted.
- `template-maxturn22-balanced17-seed8-01`: 22-degree cap reached indicative Delta +2.4, P(Delta<=0)=10.7% on the balanced probe; canonical accepted.
- Selection/search probes: `LR_IMPACT_LOCAL_W=1`, `LR_QUALITY_NCAND=48/24`, `HANDOFF_REUSE_K=2`, and repair main-margin 1.0/1.2 did not produce promotable signal. Portfolio oracle showed full-lane headroom but equal-slice 300k was negative.
- `contract-branch-cap2-canon-01`: 50k +5.6 but canonical Delta +0.4, P(Delta<=0)=42.2%, inconclusive; cap needed a warmup.
- `contract-branch-cap2-warmup12-canon-01`: 50k +38.1 but canonical Delta +2.9, P(Delta<=0)=12.5%, inconclusive; tail window still left the gate just short.
- `contract-branch-cap2-tailwin17-clean-canon-01`: canonical accepted. Window 17 kept the 50k rescue and removed the main `drums_pendulum` seed 10 regression; window 20 was too broad and regressed 50k validity.
