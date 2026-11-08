# Colour tools for themes: what each is good for

*9 November 2026. Two agents tried established colour tools on this medium, drafting five themes each (round 29). The owner asked
for real tools "even just to play with, to investigate". Every final colour still needed editing by eye against `TASTE.md`. Round 29's
"The tools, raw" shows three tools' unedited output beside one finished draft.*

| Tool | Verdict | Good for | Wrong for |
|---|---|---|---|
| Palette extraction from real artworks (OKLab k-means; AIC and Met open access) | **keep** | grounding a hue family in the real work, not memory | photos of oil paintings sample grey (Vermeer's ultramarine skirt at chroma .034); museum backdrops swamp the clusters |
| Adobe Leonardo (`@adobe/leonardo-contrast-colors`) | **keep** | placing ink, pencil and bars at exact contrasts against a paper (±0.1) | it knows lightness contrast only: it cannot tell whether an accent reads against the bars |
| culori (OKLCH, gamut mapping) | **keep** | the pigment cap, gamut limits, every TASTE number | nothing; it is a measuring tool |
| Material Color Utilities (Google, HCT) | **suggestions only** | hue pairings (Expressive, Fidelity: violet with petrol, viridian with sienna); a light/dark pair from one seed as a drop partner | its schemes as designed: the accent at the bars' lightness (it vanishes), pastel suns, chroma .06–.11, a pencil tinted with the seed |
| Colormind (`default` model) | **optional** | painterly mid-tones for bars, given a locked paper and accent | crisp ink (it has no roles); muddy when unseeded |
| Huemint (transformer, diffusion) | **drop** | it respects roles and contrast | screen colours (#ff1a0b, #41ffff), a second hot note, bars as loud as the accent: the neon TASTE.md warns against |

## The workflow they suggest

1. Choose the hue family: a real artwork, cropped and sampled with its vivid pixels clustered separately, or MCU's hue relations.
2. Choose the hot note first, at pigment chroma (about .15; never above .2, never neon) and a quiet paper (chroma ≤ .03).
3. Place ink (≥ 12:1), pencil (a neutral at about 1.9:1) and bars with Leonardo. Measure everything with culori.
4. Edit by eye, render with `stills.mjs`, and keep only versions that differ visibly (`theme-variants.py`).

Sources: the scratch reports of 9 November (not kept). The tools themselves were installed in scratch, never in the repository.
