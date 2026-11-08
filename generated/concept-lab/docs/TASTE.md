# What the owner likes in a theme, and why

*8 November 2026, from 57 rated looks: round 27's 25 themes (love 9, keep 7, unsure 5, cut 2) and round 28's graded versions
(out of 10; where only words were given, their reading is in `analysis` below). Measured in OKLab on each look's scheme. A small,
noisy sample: these are tendencies to design toward, not laws; the owner's eye decides. Craft rules: `THEME-CRAFT.md`.*

## The language

1. **One hot note.** A single vivid accent, the strongest predictor of a high grade (accent chroma: correlation +0.47; loved
   looks .17, weak ones .12). Often echoed by the sun: "the color of the circle and the color of the accent is beautiful" (Blue and
   Rose). Separating the accent further from the bars does not help once it reads (no correlation); its *vividness* does.
2. **A quiet ground.** The paper carries little colour (correlation −0.45; loved .03, weak .05). Light or dark makes no
   difference (6.6 either way). The bars carry more colour than the paper (+0.30).
3. **A crisp line.** The inked line stands well off the paper (+0.36; loved 13.7:1, weak 11.3:1).
4. **A second element.** A sun scores highest (7.0), then a title or nothing (6.4). Titles stay a minority ("I like it, but don't
   love it").
5. **Bands that read in a video.** Solid bars (6.8) or the fork (6.7); the Iris contour band scores lowest (5.5): "looks nice, but
   not for a video". The whole-rail line scores low too (5.7); pencil → ink is the favourite (7.0).
6. **Drops that transform.** Night (7.2) and switches (6.9) beat none (6.4). The main look must be the stronger one: a dark base
   that turns light at the drop read as "a shame… the dark version is the weakest" (Night to Morning).
7. **Coherence over correctness.** A Wada match wins when it makes a distinct, coherent palette ("completely different… awesome":
   Silver and Rust; "way better, significantly": Lemon and Blue) and loses when it greys the hot note ("very bad": Coral and Rose;
   "I don't like the Wada at all": Violet and Citron).

## What it means for drafting

- Start from the hot note: choose the accent (and sun) first, vivid (chroma ≥ .15), then a quiet ground and bars that frame it.
- The pencil (lines not yet ridden) is a quiet neutral between paper and ink, never a hue of its own ("a huge smell").
- Every theme shows the music; prefer bars or fork.
- Show a version only when it is visibly different: the "tuned" versions of round 28 changed too little to see, except where the
  accent moved ("is there really one?"). A variant must move a key colour by a clearly visible step.
- Vary the hue families and the references, not the recipe: the language above holds across palettes; the owner wants new colours
  that speak it, not the same palette again.

## Analysis

`analyse.py` (scratch, 8 November) over `rated.json`. Round 28 readings of words: "very bad" 3, "okay" 6, "way better" than a
graded one +2. Correlations with the grade (n = 57): accent chroma +0.47, paper chroma −0.45, ink contrast +0.36, hottest note
chroma +0.35, bars minus paper chroma +0.30, bar step +0.12, accent/bars ΔL −0.10, paper lightness +0.08. Means by element: sun 7.0,
title 6.4, none 6.4; bars 6.8, fork 6.7, Iris 5.5; Night drop 7.2, switch 6.9, none 6.4; pencil → ink 7.0, all ink 6.5, whole rail
5.7.
