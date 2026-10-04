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
| 23:10 | Survival envelope (instrument) | The strongest single hit the rider survives is about 0.9; 1.0 is out of reach. |
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
| 00:57 | **Upright steep arrival adopted** | Head-down or backward strong arrivals 30% → 15%, impact unchanged. |
| 01:15 | Agent C: why "L'amour de ma vie" is hard | The spec asks near a momentum limit (back-to-back ≥ 0.9 hits 13 frames apart); intro speed unreachable; not budget-bound. Questions for the owner. |
| 01:16 | **Compile speed-up** (structural) | Native whole-body read: 75 s → 60 s per ride, byte-identical. |
| 01:22 | Night report tooling | Data generator, page, honest before/after clips, scale clips, blind-study key builder. |
| 01:31 | Half-budget robustness | Tonight's profile also helps at 1.5M (completion +6 pp authored, strong bias +0.03). |
| 01:42 | Visual check | Before: a head-down tumble (0.54). After: an upright slam into a V (0.88). The numbers match what the eye sees. |
| 01:50 | **Headline, evening → tonight (all four panels, owner-validated measure)** | Impact loss 0.092 → 0.037 (−60%); strong shortfall −0.28 → −0.13; double impacts 0.11 → <0.01; head-down strong arrivals 22% → 15%; speed unchanged; air +0.005; completion 100%. |
