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

Probe trail:
- `impact-entry-redir-dense-slice-01`: focused Delta +0.7, inconclusive. Helped mainly target-impact .55-.75 at 200k/300k.
- `impact-entry-redir-dense-v2-slice-01`: focused Delta +0.2, inconclusive. Broader/stronger pressure hurt the important .35-.55 band.
- `impact-entry-redir-dense-mature-v1-slice-01`: focused Delta +0.7, inconclusive. Best entry-only shape; no score delta at 50k/100k.
- `impact-entry-redir-sign-aware-slice-01`: focused Delta +0.2, inconclusive. Sign-aware entry direction washed out.
- `impact-entry-redir-highband-slice-01`: focused Delta +0.4, inconclusive. Over-narrow target gate reduced useful lift.
- `impact-entry-redir-cap12-slice-01`: focused Delta -0.0, inconclusive. Overdriving the entry cap regressed 300k.
- `impact-arrival-entry-combo-slice-01`: focused Delta +2.4, inconclusive but strong enough to justify canonical; canonical accepted.
