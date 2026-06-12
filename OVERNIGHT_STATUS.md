# Overnight session status — 2026-06-11 → 12

High-level log of the autonomous overnight run (Fable orchestrating, Opus subagents
implementing). Newest entries at the bottom of each section. Concise by design;
full numbers live in the agent reports and `generated/golden-runs/`.

## ☀️ MORNING SUMMARY (read this first)

**Headline: the combined stack ACCEPTS — 602.8 → 607.8 (Δ +5.0, P(Δ≤0)=5.5%,
validity clean).** `stack-predict-topk3-01` = LR_RANK_PREDICT_ARRIVAL=1 +
LR_AIM_TOPK_BASES=3 (maturity-gated). The two individually-inconclusive positives
compose exactly as designed: below 150k the gate makes it byte-identical to
predict-only (50k +41.6, validity 97→99%); above, top-K adds +1.9/+2.3.
Day's cumulative: **593.0 → 607.8 (+14.8)**.

**Recommendation:** promote the stack as one commit (both flags default-on, keeping
escape hatches), after the small pre-commit cleanups: review NITs (mark the charged
path dead under predict-only; note the duplicated launch-read constants; consider a
cross-check test), and decide predict-only vs hybrid (see ledger — predict-only has
the better headline and a measured-benign bias; hybrid is semantically cleaner,
+1.1 only). Awaiting your call — nothing committed overnight.

**Also resolved tonight:** lazy pool evaluation REJECTED with a precise diagnosis
(predictor blind to gate survival; mechanism sound and kept dormant — pool rides
are 56–60% of all frames, so the prize remains); one benchmark-pollution incident
caught, root-caused, and fixed with a snapshot-isolation protocol; predict-only
confirmed at 25 seeds (+3.8, P=90%); support-catch bias measured and attributed.

## Committed today

- **`1180043` — quality-objective pool sort, default-on** (`LR_RANK_QUALITY`, `=off`
  escape hatch). Canonical +9.8 → **new baseline 602.8** (`rankr-pool-01`,
  fingerprint 1df7e3a417bc). Rejected "full" arm (branch judge) deleted.
  Adversarially reviewed; flag-off byte-identity verified twice independently.

## Experiment ledger

| experiment | flag / archive | status | result |
|---|---|---|---|
| V1 objective as pool+branch judge | (deleted) / rankr-on-01 | done | REJECT −111.4 (cost + lost forward-eval) |
| V2 objective as pool sort only | default / rankr-pool-01 | **PROMOTED** | ACCEPT +9.8 → 602.8 |
| Top-K lane bases, flat K=3 | LR_AIM_TOPK_BASES / aim-topk3-01 | done | REJECT −28.2 (50k starvation; 300k +2.5 ⇒ cost problem, not quality) |
| Top-K maturity-gated | (same) / aim-topk3-mature-01 | done | **+1.6 INCONCLUSIVE (P(Δ>0)=85%)** — surgical: bit-identical to baseline below 150k target budget, bit-identical to ungated K=3 above (so 200k +1.5 / 300k +2.5 fully retained, zero low-budget damage). Needs ~45 seeds to resolve statistically. Uncommitted. |
| Predicted arrival for pool ranking | LR_RANK_PREDICT_ARRIVAL / rankr-predict-01 | done | **+3.5 INCONCLUSIVE (P(Δ>0)=87%)**, 50k +41.6 & validity 97→99%; charged arrival frames 25.5M → **0**; prediction error vs ground truth: 0.216 px/f speed, 1.78° angle (262k pairs). Coverage dropped (84→57% defined) yet headline rose — fidelity at top of pool beats tail coverage. Uncommitted. |
| Lazy pool evaluation (I1 revoked) | LR_LAZY_POOL / lazy-pool-01 | done | **REJECT −28.9** (uniform across budgets) — but the diagnosis is the prize: (1) budget breakdown CONFIRMS pool rides = 56–60% of all frames (Jérémie's intuition exactly); (2) the lazy mechanism (sample/ride split, rank-order quota, deterministic cache) is sound — 66–80% of rides skipped, validity unchanged, byte-identical off; (3) the falsified piece is the geometry-only predictor: blind to gate survival (24–58% of its picks die at gates), unrankable on 0–46% of pools, agrees with the best survivor only ~15%. Next arm needs gate-survival-aware prediction (cheap reachability/clearance check) before lazy ranking can beat ride-everything. Mechanism kept, dormant. |
| Seed power runs (0–24, both arms) | rankr-pool-ext25-01 + rankr-predict-ext25-02 | done (clean rerun from snapshot) | predict-only at 25 seeds: **+3.8, P(Δ>0)=90%**, still INCONCLUSIVE — effect concentrated at 50k (+53.7, P=94%), 100k–300k ≈ 0. Consistent with the 12-seed +3.5. Not chasing more seeds: the hybrid run is the sharper arbiter and supersedes predict-only either way. (First predict arm was edit-poisoned and deleted — see incident.) |
| Adversarial review of predict+topk diffs | (read-only, frozen patch) | done | 1 BUG (TS `Pick` omission — **fixed by Fable**, runtime-harmless), 1 real RISK: predict result is CONFOUNDED — support/non-air catches can never get predicted objectives (not airborne at release; free captures are air-target-only) and sink to cost tail; validation telemetry only covers the unaffected air population. Launch-read mirror, ballistic math, determinism, flag-off purity: all verified clean. A is promotable after the bug fix; B needs the bias measured first. A+B combined config untested. |
| Combined stack (predict + gated topk3) | both flags / stack-predict-topk3-01 | done | **ACCEPT +5.0 → 607.8** (P(Δ≤0)=5.5%); 50k +41.6 (= predict-only, bit-identical below the gate), 200k +1.9, 300k +2.3; validity 97→99 / 100 / 100 / 100. The promotion candidate. |
| Support-catch bias measurement + hybrid arm | LR_RANK_PREDICT_ARRIVAL=hybrid / rankr-hybrid-01 | done — **attribution answered** | **Bias confirmed, large**: predict-only changes NOTHING on 19/40 sparse specs; its +3.5 lives on dense specs where it also orphans ~76% of support catches. Hybrid canonical answered the attribution: **hybrid +1.1 vs baseline (steady +0.7–0.8 at 100k/200k/300k, coverage restored to 99%) but −2.4 vs predict-only, all from 50k (−35.4)**. So the pure prediction effect is small-positive everywhere; predict-only's big 50k edge was substantially the ECONOMICS of the tail-dump (not scoring support catches also means not paying for them) — a real budget saving entangled with a ranking bias that empirically never hurt validity. Both arms stay viable: predict-only = budget-lean with a measured benign bias; hybrid = semantically clean, slightly costlier at 50k. |

## Direction set by Jérémie (tonight's mandate)

1. **Structural cost reduction over budget rationing.** No maturity gates; make the
   mechanism cheap instead.
2. **I1 ("proposer, never judge") is relaxed by owner decision.** New policy:
   predictions may RANK everything; exact simulation is owed only to candidates
   actually CHOSEN (expanded branches / committed arcs), walked in rank order with
   fallback when the real gates fail. Tracks are still never built from predictions.
3. **The big target: lazy pool evaluation.** Today every sampled arc is fully
   simulated (pool 20–48 × ~20+ frames per node) just to be ranked. Plan: predict
   the quality objective for all sampled arcs without riding them; exact-evaluate
   only in rank order until the needed few valid candidates exist.
4. Parked for later, per Jérémie: raising golden max budget past 300k; K=2 retry
   once the lane is structurally cheap.

## Not yet explored (from the original plan/discussions — still plausible)

- **Quality objective with depth.** V1 proved one-contact lookahead can't replace
  forward-eval as branch judge; the unexplored synthesis is the objective COMPOSED
  over multi-gap rollouts (or as forward-eval's per-step score) — the real
  "one prediction function" unification. Big; natural after lazy eval.
- **Forward-eval-rank instrumentation** (original step 1): we measured cost-rank vs
  quality-rank disagreement (13%), never quality-rank vs forward-eval-rank nor
  correlation with final score. Cheap telemetry add if we ever question the branch judge.
- **Aim around every sampled arc** (original step 4): K=3 explored; "every arc"
  awaits structurally cheap probes (the predict-arrival → cheap-lane chain).
- **Improve the sampling itself** (Jérémie's aside in the original discussion):
  the sampler still proposes blind; predicted objectives could STEER sampling
  (e.g. sample more near high-predicted regions), not just rank it. Unexplored.
- **K=2 at mature budgets** — parked; cheaper probes may make it moot.
- **drums_breath −6.9** (only notable pool-mode regression) — never diagnosed.
- **Pool-mode 50k flatness** (capture overhead at small compiles) — never diagnosed;
  predicted-arrival may fix it for free (zero-frame objectives).
- **Golden max budget >300k** — Jérémie open to it later; would also raise the
  value of mature-budget-only wins like top-K.
- **Latent decomposition** (separate thread, pre-dates this campaign): at parity,
  opt-in; Jérémie wants continued development. Not part of tonight's line.

## Process rules in force

- **INCIDENT + corrected rule (02:30):** the first predict ext25 power run was
  poisoned by concurrent agent edits — golden workers import the tree PER TASK as
  they spawn, so runs are NOT immune to mid-run edits (a half-written export in
  aim.ts crashed 86% of compiles; the −598.8 "result" was an artifact and the
  archive was deleted). Jérémie called this hazard ahead of time. New protocol:
  **benchmarks run from an isolated worktree snapshot** (/tmp/line-bench = HEAD +
  frozen experiment patch); re-run launched clean. Side benefit: a snapshot run
  occupies the ps-queue, which serializes agent-initiated runs too.
- Implementations may overlap, but **canonical golden runs are serialized** and every
  run is preceded by a flag-off byte-identity check.
- Nothing committed without an ACCEPT + review, except by explicit owner authorization.
- Fable spot-checks every headline number (decide re-run) and every commit before
  relaying.

## Plan for tonight

1. Wait for the two in-flight results; verify both (decide re-run, identity checks).
2. Record maturity-gate result as data point. If predict-arrival is ≥ parity AND
   prediction error is small → it becomes the foundation; launch the **lazy pool
   evaluation** experiment (with a budget-breakdown study first: where do compile
   frames actually go — pool eval vs lane probes vs forward-eval). If prediction
   error is large → diagnose before building on it.
3. If lazy eval lands in time: canonical A/B vs 602.8, full review, leave uncommitted
   with a promotion recommendation for the morning.

## Results as they land

- **Premise correction (important):** golden budgets are INDEPENDENT compiles
  (50k/100k/200k/300k each a full compile with its own targetBudget;
  golden_suite.ts:92), NOT checkpoints of one 300k compile as earlier notes said.
  So "low budget" = a separate smaller compile, and target-budget gating gives
  literal bit-identity below the threshold.
- **Gated K=3:** clean splice (see ledger). The gate uses the compile target budget
  (same signal as forward-eval/impact-ramp precedents; consumed-frames was ruled
  out on determinism grounds — would flip K mid-node across pool rebuilds). The
  open question is purely statistical power (~45 seeds would resolve +1.6).
  Note this partially rehabilitates the gate approach: it costs nothing below
  threshold by construction. Still treated as secondary to the structural line.
- Possible late-night power run (if benchmark queue allows): both arms at extra
  seeds to resolve the gated-K3 +1.6.
