# Overnight progress — 2026-10-04 → 05

Short, high-level log of the overnight compiler work. The full accept/reject
ledger is in `REWORK.md`; evidence is in `docs/research/`.

**Goal:** the best compiler for what the owner wants. Every spec axis counts:
impact (strength, timing, no unwanted extra or double hits), completion, air,
speed, amplitude, smoothness.

**Method:** every change gets a hypothesis, then the 24-ride panel
(`npm run eval`, about 3 min), authored and perturbed, read on every ruler.
A change is adopted only if the whole picture improves.

## Measure (done earlier tonight)
- **line.strike.v2:** impact strength = the change of the rider's whole-body
  motion (travel and spin) in 50 ms. The owner's blind pairs: 46/63, against
  31/63 for the old measure.
- **line.strike.v3:** a floor-then-rail double contact counts as two impacts.
  Double impacts per beat fall about 75%.

## Compiler

| time | change | result |
|---|---|---|
| 22:55 | v3 as the objective | Adopted. Double impacts −0.13 per beat; speed rms +0.007 (authored only). |
| 23:05 | Seed catch turn in 2 frames; impact weight 2; release reserve 3 | Rejected: null, or impact gain paid for with speed. |
| 23:10 | Survival envelope (instrument) | Coarse grid: about 0.9 survivable at 45°. Corrected at 02:25 by a fine grid: a near-vertical drop survives 1.0. |
| 23:29 | **L1, steep arrival before strong asks** | **Adopted.** Strong bias +0.02, speed rms −0.014 / −0.022; contested beats +1 pp. |
| 23:45 | Diagnosis | Strong hits are mostly sled-tip strikes plus spin (sled 39° to the surface), not slams. Quiet overshoot comes from sled pitch too. |
| 23:41 | Lookahead boost into strong asks (L9) 1.6 / 1.3 | 1.6: small gain, +100 s per compile. 1.3: strong bias +0.009, contested −0.8 pp, +20 s. |
| 23:55 | Agent B: sharp catch turn, energy audit | Catches are already sharp, and sharper ones crash. Passages are not energy-bound. **Arrival-speed headroom** is a new lever. |
| 00:03 | **L9 adopted** (×1.3) | Committed with re-recorded parity. |
| 00:13 | Headroom on top of L1 + L9 | Rejected: no gain; L1 already covers it. |
| 00:17 | Aim at most 0.85 for unreachable asks (T1) | Rejected. |
| 00:20 | Agent A: pose-matched catches, guided dive | Nothing beyond L1. Physics frontier: slams cost speed, sharper turns crash. |
| 00:22 | Per-gap analysis | Air and speed errors concentrate in the densest, strongest song. Achievable strength is about 0.06–0.9. |
| 00:26 | **Fresh-seed confirmation of L1 + L9** | **Holds:** strong bias +0.03 / +0.02, speed rms −0.025 / −0.023. |
| 00:33 | Learned models without / with more samples | Both still help under v3; more samples null. Retraining on v3 is a follow-up. |
| 00:35 | Agent C: why "L'amour de ma vie" is hard | Running. |
| 00:45 | Calm impact multiplier 3 | Mixed (quiet better, authored strong worse): not adopted. |
| 00:48 | **Blind-spot audit** (agent) | Found L1 had raised head-down or backward strong arrivals (24% → 31%; July 13%). New guard rows. |
| 00:57 | **Upright steep arrival adopted** | Head-down or backward strong arrivals 30% → 15% (about 22% → 15% against the evening), impact unchanged. Judged by its own geometric test; needs the owner's look. |
| 01:15 | Agent C: why "L'amour de ma vie" is hard | The spec asks near a momentum limit (back-to-back ≥ 0.9 hits 13 frames apart); intro speed unreachable; not budget-bound. Questions for the owner. |
| 01:16 | **Compile speed-up** (structural) | Native whole-body read: 75 s → 60 s per ride, byte-identical. |
| 01:22 | Night report tooling | Data generator, page, honest before/after clips, scale clips, blind-study key builder. |
| 01:31 | Half-budget robustness | Tonight's profile also helps at 1.5M (completion +6 pp authored, strong bias +0.03). |
| 01:42 | Visual check | Before: a head-down tumble (0.54). After: an upright slam into a V (0.88). The numbers match what the eye sees. |
| 01:50 | **Headline, evening → tonight (all four panels, owner-validated measure)** | Impact loss 0.092 → 0.037 (−60%); strong shortfall −0.28 → −0.13; double impacts 0.11 → <0.01; head-down strong arrivals 22% → 15%; speed unchanged; air +0.005; completion 100%. |
| 02:13 | **Code review** (agent) | No product bug. Evidence corrected (spin 8 : 3, not 12 : 4; upright judged by its own test). v1/v2 back on the evening profile. Tool fixes and tests. |
| 02:10 | Pressing rail (agent) | Negative: a forcing roof breaks the rider or removes the hit; dense runs already refill each hit's speed bill. |
| 02:23 | **Survival corrected** | A fine grid shows a near-vertical drop surviving 1.0; at 45° the limit is about 0.9. |
| 02:24 | Agent: retrain learned models on v3 | Running (feasibility first). |
| 02:38 | Morning deliverables | Dashboard data, honest before/after clips (evening → tonight), scale clips, a blind 22-pair study for the owner. |
| 03:37 | **Learned construction policies rebuilt under v3** (agent) | The old artifacts had been trained partly on the evaluation songs. The rebuild on disjoint songs is better on all four panels: impact loss −0.007, strong +0.015, air −0.005; body drag +30%. Adopted for v3. The value-model retrain was no better, so it is not adopted. |
| 03:56 | **Final compiler: headline, evening → tonight (all four panels)** | Impact loss 0.092–0.097 → 0.028–0.031 (about −68%); strong shortfall −0.28 → −0.11; double impacts gone; competing hits 3–5% → about 1%; peaks 3–9 ms earlier; air and speed unchanged or better; head-down strong arrivals 22% → 12–15%. Costs: body drag +0.1 to +0.6 s/min, +0.35M physics frames. Completion 100%. |
| 04:26 | Deliverables refreshed | Dashboard data, clips, scale clips, 22-pair blind study, production library (12/12) with videos. |

## Where to look in the morning

- **Dashboard:** `npm run serve`, then http://127.0.0.1:8767/motion-gallery/night.html
- **Blind check (about 10 min):** http://127.0.0.1:8767/motion-gallery/pairs.html?study=night-pairs-2026-10-05
- **Production page:** tonight's rides, with "compare previous" showing this evening's.
- **Written report:** `docs/research/overnight-20261005.md`. Ledger: `REWORK.md`.

