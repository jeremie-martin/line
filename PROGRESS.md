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
| 22:50 | v3 as the objective | Adopted. Double impacts −0.13 per beat; speed rms +0.007 (authored only). |
| 23:20 | Seed catch turn in 2 frames; impact weight 2; release reserve 3 | Rejected: null, or impact gain paid for with speed. |
| 23:30 | Survival envelope (instrument) | The strongest single hit the rider survives is about 0.9; 1.0 is out of reach. |
| 23:45 | **L1, steep arrival before strong asks** | **Adopted.** Strong bias +0.02, speed rms −0.014 / −0.022; contested beats +1 pp. |
| 00:10 | Diagnosis | Strong hits are mostly sled-tip strikes plus spin (sled 39° to the surface), not slams. Quiet overshoot comes from sled pitch too. |
| 00:30 | Lookahead boost into strong asks (L9) 1.6 / 1.3 | 1.6: small gain, +100 s per compile. 1.3: strong bias +0.009, contested −0.8 pp, +20 s. |
| 00:40 | Agent B: sharp catch turn, energy audit | Catches are already sharp, and sharper ones crash. Passages are not energy-bound. **Arrival-speed headroom** is a new lever. |
