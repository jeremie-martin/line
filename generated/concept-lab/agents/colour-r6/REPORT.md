# Colour clarity, round 6

Written by the main session from the colour agent's final summary. The agent's own tool refused to save a report file. The numbers are in `measure-out.tsv` and `chroma420-out.txt`. The scripts are `measure.mjs`, `colour.mjs`, `chroma420.py` and `pairs.mjs`.

## Key finding (tentative)

On a phone, the thin line is about 2–3 arcminutes wide, the width of small text. At that size people see detail through **lightness, not colour**. Perception research agrees, and APCA asks for Lc ≈ 90 for thin strokes.

YouTube-style 4:2:0 encoding agrees as well. On 2 px strokes, 92–101 % of the lightness difference between line and paper survives, but only 10–62 % of the line's chroma does.

Riso is the odd one out on three counts:
- It has the lightest and most saturated ink: L .37, C .18, where every other scheme has C ≤ .07.
- It has the most vivid band, at C .20.
- It leaves the largest colour halo on the paper after encoding, ΔE .035.

On light papers, rating falls as the ink gets lighter:

| Scheme | Ink L | Rating |
|---|---|---|
| graphite, dune, hokusai | .21–.28 | 5 |
| lagoon | .31 | 4 |
| riso | .37 | 3.5 |

Plum's amber bar has the same lightness as its lilac bars (ΔL .007), so the two differ by hue alone and vibrate.

Dune breaks plain contrast: it has the lowest ink Lc (85) and still got a 5.

**How weak this is:** about 22 measures were tried against 7 ratings, and the best permutation p-values are 0.07–0.10, so one of them was expected by chance. The findings deserve action only because the literature predicted them independently.

## Provisional guardrail (a check, not a score; thresholds set after seeing the ratings)

1. **Ink:** near-black on light paper (L ≤ .30, C ≤ .10), or L ≥ .92 on dark paper, with ink Lc ≥ 85 either way.
2. **Paper:** light means L ≥ .91 and C ≤ .035; dark means L ≤ .24 and C ≤ .045.
3. **Pencil:** Lc 18–40 on light paper or 12–30 on dark, with the ink at least 50 above the pencil.
4. **Band (mass):** chroma ≤ .13.
5. **Accent:** it differs from the band by ΔL ≥ .12, by ΔE ≥ .15, and by ≥ .08 under simulated colour-blindness, with accent Lc ≥ 25.
6. **Night ink:** Lc ≥ 80.

All four schemes rated 5 pass. Riso fails three checks and plum fails one; lagoon is marginal. Klein and salmon fail on band chroma.

## Candidates (`schemes.js`, all pass)

- **slate:** fog grey and slate, with a mustard bar.
- **olive:** linen and olive, with a tomato bar and an ochre sun.
- **mauve:** dusk violet with apricot; Plum's day side.
- **bauhaus:** bone, black bars and cobalt.
- **sumi:** a pale grey band with a vermilion stamp.
- **midnight:** navy and steel, with amber and a pale moon.
- **espresso:** coffee and latte, with verdigris.
- **moss:** green-black and sage, with pale coral.

The three darks have a dimmer band than black (Lc ≈ 43 against 76).

## Tweaks

- **Lagoon:** ink `#052b35`.
- **Riso:** ink `#0d2063` and band `#304d99`. This deliberately leaves ink chroma at .12, just over the cap. If it then reads as clearly as Hokusai, the cause was lightness, and the chroma rule can go.
- **Plum, if the amber bar bothers you:** band `#a389b8`.

## Drop pairs (rare, intentional)

The idea is to keep the accent and the rider, flip lightness, and stay at the same temperature:

| Before the drop | After the drop |
|---|---|
| mauve | plum |
| slate | midnight |
| dune | espresso (keeping dune's amber) |
| olive | moss |
| sumi or bauhaus | black |

Hokusai keeps its own indigo night.
