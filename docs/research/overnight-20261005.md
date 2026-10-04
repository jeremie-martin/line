# Overnight, 2026-10-04 → 05: impact measured as the owner sees it, and a compiler that delivers more of it

Dashboard: `npm run serve`, then http://127.0.0.1:8767/motion-gallery/night.html
(data from `tools/report/night.ts`). The minute-by-minute log is
`PROGRESS.md`; the full ledger is `REWORK.md`.

## 1. The measure (settled with the owner's blind pairs)

| | old (v1, redirection) | new (v2/v3, whole-body change) |
|---|---|---|
| agreement on decisive pairs (3 rounds) | 31/63 (chance) | 46/63 |
| spin counted | no | yes (12 : 4 in its favour when it was the only difference) |

- **line.strike.v2:** strength is the largest change of the rider's
  whole-body motion (centre-of-mass velocity, direction and speed, plus spin
  as angular momentum) within any 2 frames (50 ms) of the hit, ÷ 7.55
  (`scripts/lib/strike_impact.ts`). `tests/strike_v2.test.ts` proves it
  equals the research measure the owner judged, to 1e-9.
- **line.strike.v3:** v2 plus one identity rule. A push reversed more than
  120° from the current hit's peak push (floor, then upper rail) starts a new
  impact, so an unrequested second hit costs as an extra.
  - Physically checked: 94% of the added splits start on an opposite-facing
    surface; July, which has no rails, has none.
- Evidence: `docs/research/strike-definition-20261004.md`,
  `docs/research/impact-candidates-20261004.md` (an independent, answer-blind
  design pass), `labels/studies/` (every answer, key, manifest and source
  track).

## 2. The compiler (every change: hypothesis first, both panels, every ruler)

Adopted, in order (search profile `line.strike-search.v4`,
`scripts/v0/optimizer/contact_impact_profile.ts`):

1. **v3 as the objective.** Double impacts per beat −0.13.
2. **Steep, ask-driven arrival before strong beats (≥ 0.6).** Strong bias
   +0.02, speed rms −0.02; confirmed on fresh seeds (+0.03 / +0.02).
3. **Lookahead ×1.3 into strong beats.** Strong bias +0.009, contested
   −0.8 pp, +0.3M frames.
4. **Upright arrival.** Head-down or backward strong arrivals 30% → 15%;
   impact unchanged. This was found by a blind-spot audit of the scorecard:
   step 2 had raised them, and no row showed it.
5. **Native whole-body read.** Compile time −20%, byte-identical.

Tried and set aside, each measured: catch turn seeded in 2 frames; impact
weight 2; release reserve 3; L1 at weight 1 and thresholds 0.4 / 0.75;
lookahead ×1.6 (same gain, 5× the compile time); arrival-speed headroom;
pose-matched catches and guided dives; sharper catch turns; aiming below
unreachable requests; no value model or no construction policies (both still
help); more policy samples; calm-impact multipliers 2.2 and 3; upright
weight 2; air weight 1.5.

## 3. Results: this evening's product → tonight

Four panels: authored and perturbed specs, on the decision panel (seeds
101–404) and on fresh seeds (505–808). Every value is measured with the
owner-validated measure.

| | evening | tonight |
|---|---|---|
| impact loss (v3) | 0.092–0.097 | 0.033–0.038 |
| strong beats: strength − request | −0.28 | −0.13 |
| very strong beats | about −0.35 | about −0.17 |
| floor-then-rail double impacts / beat | about 0.11 | < 0.01 |
| strong beats with a competing hit | 3–5% | 1–2% |
| hit peak after the beat (median) | 22–27 ms | 13–22 ms |
| strong hits arriving head-down / backward | about 22% | 15% |
| speed rms | 0.075–0.084 | 0.072–0.076 |
| air rms | 0.066–0.068 | 0.071–0.073 |
| completion | 100% | 100% |
| physics frames per ride | about 2.35M | about 2.7M |

Robustness:
- At half budget (1.5M) tonight's profile still helps: completion +6 pp
  authored, strong bias +0.03.
- At standard budget the hardest song uses its whole allowance and still
  completes; 1.5× budget would not improve it.

## 4. What limits the rest (physics and spec, measured)

- **Survival.** A clean, surviving hit reads at most about 0.9; the gentlest
  touchdown reads about 0.06 (`tools/measure/survival_envelope.ts`,
  `tools/report/scale_clips.ts`). So both ends of the authored 0–1 scale are
  out of reach.
- **The speed bill.** A slam at an angle costs speed (tan(i/2) per unit of
  impact), which the spec's speed targets charge for; sharper turns crash.
  Past the adopted changes, strength trades against speed and survival.
- **Dense strong runs.** Back-to-back strong asks about 13 frames apart sit
  near a momentum limit: delivered strength is about 0.6 in every song at
  that spacing. "L'amour de ma vie" asks 77 of 85 beats strong, 47% of them
  ≥ 0.9.

## 5. For the owner

1. **Scale:** should 1.0 mean the hardest hit the rider survives, and 0 the
   gentlest touchdown?
2. **L'amour de ma vie:** re-author its densest strong runs, intro speed and
   low-air tail, or keep them as stretch goals?
3. **Air against impact:** air weight 1.5 recovers the evening's air
   accuracy for about a third of tonight's strong-beat gain.
4. **Lines passing through the rider** (6–8 per ride) and body drag along
   rails: visible enough to fix?
5. **A blind pair session:** this evening against tonight on random strong
   beats (dashboard link).

## 6. Follow-ups

- Retrain the learned construction policies and the value model on the v3
  objective. Both still help; their training pipeline is archived.
- New, held-out music.
- Retire `landing` mode and strike v1/v2 once the owner is satisfied.
